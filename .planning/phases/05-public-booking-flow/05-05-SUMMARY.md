---
phase: 05-public-booking-flow
plan: "05"
subsystem: api
tags: [nextjs, route-handler, supabase, zod, turnstile, web-crypto, bookings, race-condition, 409]

# Dependency graph
requires:
  - phase: 05-01
    provides: accounts.owner_email column populated for NSI account
  - phase: 05-02
    provides: lib/email-sender singleton (Gmail SMTP via App Password)
  - phase: 05-03
    provides: bookingInputSchema, verifyTurnstile, sendBookingEmails, build-ics
  - phase: 04
    provides: bookings_no_double_book partial unique index (race gate), createAdminClient pattern, /api/slots route handler pattern

provides:
  - POST /api/bookings Route Handler (race-safe booking creation with 409 on slot collision)
  - lib/bookings/tokens.ts (generateBookingTokens + hashToken using Web Crypto API)
  - Cancel/reschedule token generation + SHA-256 hashing (raw tokens in email only; hashes in DB)
  - 201 response with {bookingId, redirectTo} pointing to confirmation route
  - Full validation pipeline: JSON parse → Zod → Turnstile → DB resolve → insert → email

affects:
  - 05-06 (booking form must POST to this endpoint and handle 409 SLOT_TAKEN + 400 VALIDATION + 403 TURNSTILE)
  - 05-07 (confirmed page consumes the bookingId from the 201 redirectTo path)
  - 06 (cancel/reschedule routes consume rawCancel/rawReschedule tokens from emails; hash-lookup pattern established here)
  - 08 (integration tests for /api/bookings 409 path + token absence in response; rate limiting deferred here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route Handler POST with explicit Cache-Control: no-store + export const dynamic=force-dynamic"
    - "Web Crypto API (crypto.subtle.digest SHA-256) for server-side token hashing (Edge-runtime compatible)"
    - "Fire-and-forget email: void sendBookingEmails(...) — no await after 201 response"
    - "Postgres 23505 unique_violation surfaced as HTTP 409 with structured {error, code: SLOT_TAKEN}"
    - "Raw tokens never in HTTP response body — passed only to email orchestrator"
    - "Validation sequence locked: JSON parse → Zod → Turnstile → DB → insert → email → 201"

key-files:
  created:
    - app/api/bookings/route.ts
    - lib/bookings/tokens.ts
  modified: []

key-decisions:
  - "Route Handler (NOT Server Action) — Server Actions cannot return 409; locked since RESEARCH Pitfall 1"
  - "No pre-flight slot validity check — DB partial unique index is the authoritative race gate; pre-flight adds latency without closing the race window"
  - "Web Crypto API (crypto.subtle.digest) NOT Node crypto.createHash — Edge-runtime compatible for future migration"
  - "Raw tokens in email only; hashes in DB; 201 body is {bookingId, redirectTo} only — raw tokens never in response"
  - "Rate limiting deferred to Phase 8 INFRA-01"
  - "redirectTo format: /${account.slug}/${eventType.slug}/confirmed/${booking.id} — LOCKED"
  - "409 body: {error: 'That time was just booked. Pick a new time below.', code: 'SLOT_TAKEN'} — CONTEXT decision #5 verbatim"
  - "sendBookingEmails fired with void — no await; email failure must not roll back booking or delay 201 response"

patterns-established:
  - "Error code naming: BAD_REQUEST / VALIDATION / TURNSTILE / NOT_FOUND / SLOT_TAKEN / INTERNAL"
  - "All error responses include a machine-readable {code} field for client-side branching"
  - "NO_STORE constant reused across all NextResponse.json() calls (mirrors /api/slots)"

# Metrics
duration: 12min
completed: 2026-04-25
---

# Phase 5 Plan 05: Bookings API Route Handler Summary

**Race-safe POST /api/bookings Route Handler with Zod validation, Turnstile bot guard, Postgres 23505 → 409 collision handling, Web Crypto token generation, and fire-and-forget email dispatch**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-25T22:22:52Z
- **Completed:** 2026-04-25T22:34:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Token helper `lib/bookings/tokens.ts` generates UUID v4 cancel/reschedule token pairs and SHA-256 hashes them via Web Crypto API (Edge-runtime compatible); raw tokens go to email only; hashes persist to DB
- `POST /api/bookings` Route Handler enforces locked validation sequence (JSON parse → Zod → Turnstile → DB resolve → insert → email → 201); each stage returns a structured `{error, code}` response
- Postgres `bookings_no_double_book` partial unique index collision surfaces as HTTP 409 + `code: "SLOT_TAKEN"` with the locked CONTEXT decision #5 user-facing copy
- `sendBookingEmails` fired fire-and-forget (`void`) after insert; email failure cannot roll back or delay the booking confirmation
- `npm run build` exits 0; route appears in Next.js route table as dynamic `ƒ /api/bookings`

## Task Commits

Each task was committed atomically:

1. **Task 1: Token generation + SHA-256 hash helpers** - `3d3e0de` (feat)
2. **Task 2: POST /api/bookings Route Handler** - `7743869` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `lib/bookings/tokens.ts` — `hashToken(raw)` + `generateBookingTokens()` using Web Crypto API; `import "server-only"`
- `app/api/bookings/route.ts` — Race-safe POST handler; validation pipeline; 409/403/404/400/500 error shapes; fire-and-forget emails; 201 `{bookingId, redirectTo}`

## Decisions Made

1. **Route Handler over Server Action** — Server Actions cannot return arbitrary HTTP status codes; 409 is required for the race-loser UX (RESEARCH Pitfall 1, locked from Phase 5 research).

2. **No pre-flight slot validity check** — The DB-level partial unique index `bookings_no_double_book ON (event_type_id, start_at) WHERE status='confirmed'` is the authoritative race gate. A pre-flight `computeSlots()` call would add latency without closing the race window (the gap between check and INSERT is still a race). Plan 05-08 integration tests verify the 409 path end-to-end.

3. **Web Crypto API (crypto.subtle.digest) NOT Node crypto.createHash** — Keeps `lib/bookings/tokens.ts` Edge-runtime compatible if the route is ever migrated to Edge. Both Node 20+ and Vercel Edge support `globalThis.crypto.subtle`. No HMAC or salt needed — tokens are random secrets (UUID v4, 122 bits entropy), not passwords.

4. **Raw tokens never in HTTP response** — Raw cancel/reschedule tokens are passed only to `sendBookingEmails()` for inclusion in email links. The 201 response body is `{bookingId, redirectTo}` only. Plan 05-08 integration test will assert absence of raw tokens from the response body.

5. **Locked redirectTo format** — `/${account.slug}/${eventType.slug}/confirmed/${booking.id}` — matches the confirmation route segment structure from Plan 05-04 and Plan 05-07.

6. **Rate limiting deferred to Phase 8 (INFRA-01)** — No per-IP or per-email rate limiting in this plan. Turnstile provides bot protection; full rate limiting is a hardening concern.

7. **Error code vocabulary** — `BAD_REQUEST | VALIDATION | TURNSTILE | NOT_FOUND | SLOT_TAKEN | INTERNAL` — structured `{error, code}` shape on all responses enables client-side branching in the booking form (Plan 05-06).

## Response Shape Reference

```
201 → { bookingId: string; redirectTo: "/${account.slug}/${eventType.slug}/confirmed/${booking.id}" }
400 → { error: "Invalid JSON." | "Validation failed.", code: "BAD_REQUEST" | "VALIDATION", fieldErrors?: Record<string, string[]> }
403 → { error: "Bot check failed. Please refresh and try again.", code: "TURNSTILE" }
404 → { error: "Event type not found." | "Account not found.", code: "NOT_FOUND" }
409 → { error: "That time was just booked. Pick a new time below.", code: "SLOT_TAKEN" }
500 → { error: "Booking failed. Please try again.", code: "INTERNAL" }
```

All responses include `Cache-Control: no-store`.

## Deviations from Plan

None — plan executed exactly as written.

The plan's Task 2 stub included a placeholder `redirectTo` with a TODO comment. The final implementation resolves this correctly using `eventType.slug` (already included in the `.select()` per the plan's own "Note on the redirectTo field" section).

## Issues Encountered

**ESLint circular reference (pre-existing):** `npm run lint` fails with `TypeError: Converting circular structure to JSON` in `@eslint/eslintrc`. This is a pre-existing bug in the ESLint configuration (confirmed by stashing changes and running lint on the prior commit — identical failure). TypeScript compilation (`npm run build`) exits 0 and is the authoritative type-check gate. The lint issue is unrelated to this plan's changes.

## User Setup Required

None — no new environment variables or external service configuration required for this plan. Existing `TURNSTILE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and Gmail vars from prior plans are sufficient.

**Smoke test (after Vercel deploy with Turnstile dev keys):**
```bash
# Set Turnstile dev keys in .env.local:
#   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
#   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
# Then get a token by visiting the booking page and submit:
curl -i -X POST https://calendar-app-xi-smoky.vercel.app/api/bookings \
  -H "content-type: application/json" \
  -d '{"eventTypeId":"<uuid>","startAt":"2026-06-15T14:00:00.000Z","endAt":"2026-06-15T14:30:00.000Z","bookerName":"Test","bookerEmail":"test@example.com","bookerPhone":"5551234567","bookerTimezone":"America/Chicago","answers":{},"turnstileToken":"<token>"}'
# Expected: 201 + {bookingId, redirectTo}
# Repeat IMMEDIATELY same payload → expected 409 + {error, code: "SLOT_TAKEN"}
```

## Next Phase Readiness

- `POST /api/bookings` is ready to be wired into the booking form (Plan 05-06)
- The form must handle: 201 (redirect), 409 SLOT_TAKEN (inline banner + slot refetch), 400 VALIDATION (field errors), 403 TURNSTILE (reset Turnstile widget), 500 INTERNAL (generic error)
- Cancel/reschedule token infrastructure is in place; Phase 6 routes only need to hash the URL token and look up by `cancel_token_hash` / `reschedule_token_hash`
- No blockers

---
*Phase: 05-public-booking-flow*
*Completed: 2026-04-25*
