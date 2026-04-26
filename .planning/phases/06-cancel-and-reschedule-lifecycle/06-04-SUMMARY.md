---
phase: 06-cancel-and-reschedule-lifecycle
plan: 04
subsystem: api
tags: [nextjs, supabase, rate-limit, token, cancel, reschedule, slot-picker, turnstile, zod]

# Dependency graph
requires:
  - phase: 06-03
    provides: cancelBooking + rescheduleBooking shared atomic functions
  - phase: 06-02
    provides: lib/rate-limit.ts checkRateLimit + DEFAULT_TOKEN_RATE_LIMIT
  - phase: 05
    provides: SlotPicker component (reused verbatim), BookingForm Turnstile pattern, /api/bookings Route Handler pattern

provides:
  - GET /cancel/[token]: read-only Server Component, noindex, status-branched render (active/cancelled/not_active)
  - POST /api/cancel: rate-limited Route Handler, token resolution, cancelBooking delegation
  - GET /reschedule/[token]: read-only Server Component, old-slot reference line, mounts RescheduleShell
  - POST /api/reschedule: rate-limited Route Handler, CAS-guarded rescheduleBooking delegation
  - app/_components/token-not-active.tsx: shared "no longer active" branded page with owner mailto

affects:
  - 06-05: owner cancel Server Action calls the SAME cancelBooking() function wired here (actor='owner')
  - 06-06: integration tests target POST /api/cancel + POST /api/reschedule + shared functions + rate-limit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Email-prefetch defense: GET pages are read-only Server Components; all mutations route through POST Route Handlers"
    - "Token resolution pattern: hashToken(rawURL) + Supabase maybeSingle on hash column + validity check (confirmed + future)"
    - "Rate-limit-before-token-resolution: checkRateLimit called FIRST in both POST handlers before any DB token lookup"
    - "CAS reschedule guard: oldRescheduleHash embedded in rescheduleBooking() UPDATE WHERE clause"
    - "Inline success state: cancel/reschedule success rendered inline inside same route URL (no redirect)"
    - "Silent booker data preservation: reschedule submission body is { token, startAt, endAt } only"

key-files:
  created:
    - app/_components/token-not-active.tsx
    - app/cancel/[token]/_lib/resolve-cancel-token.ts
    - app/cancel/[token]/page.tsx
    - app/cancel/[token]/_components/cancel-confirm-form.tsx
    - app/api/cancel/route.ts
    - app/reschedule/[token]/_lib/resolve-reschedule-token.ts
    - app/reschedule/[token]/page.tsx
    - app/reschedule/[token]/_components/reschedule-shell.tsx
    - app/api/reschedule/route.ts
  modified: []

key-decisions:
  - "GET pages are Server Components, read-only. Email clients (Gmail, Outlook) prefetch links — mutations must only fire on POST (RESEARCH Pitfall 1)"
  - "Success state rendered inline in same URL route after POST 200 — client sets done=true, no redirect (Open Question B resolution)"
  - "No Turnstile verification on cancel/reschedule POST in v1 — rate-limit is sufficient; Turnstile widget included on reschedule for UX parity with Phase 5 and Phase 8 hook-in"
  - "Token URLs are noindex (generateMetadata robots: {index:false,follow:false}) — contain booking-specific PII"
  - "TokenNotActive is shared between cancel + reschedule routes — single source of truth for expired/invalid token UX with owner mailto contact"
  - "Reschedule resolves tokenHash server-side and passes it as oldRescheduleHash CAS guard — raw token never round-trips back from client as a CAS field"

patterns-established:
  - "Route Handler shape: dynamic=force-dynamic, revalidate=0, Cache-Control:no-store on every response (matches /api/bookings)"
  - "Error code vocabulary: NOT_ACTIVE(410), RATE_LIMITED(429), SLOT_TAKEN(409), BAD_SLOT(400), VALIDATION(400), INTERNAL(500)"
  - "clientIp() + appUrl() helpers in each Route Handler (extracted from req headers; prefer NEXT_PUBLIC_APP_URL env)"

# Metrics
duration: 6min
completed: 2026-04-26
---

# Phase 6 Plan 04: Public Token Routes Summary

**Tokenized cancel + reschedule routes end-to-end: read-only GET pages (email-prefetch defense), rate-limited POST Route Handlers delegating to Plan 06-03 shared functions, Phase 5 SlotPicker reused verbatim on reschedule with Turnstile parity widget**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-26T01:57:08Z
- **Completed:** 2026-04-26T02:03:18Z
- **Tasks:** 2 of 2
- **Files created:** 9

## Accomplishments

- Cancel side end-to-end: GET /cancel/[token] reads booking from cancel_token_hash and renders booking details + optional reason textarea + confirm/keep buttons; POST /api/cancel rate-limits, resolves token, delegates to cancelBooking(actor:'booker'); client renders success state inline on 200 ("Book again" CTA per CONTEXT decision)
- Reschedule side end-to-end: GET /reschedule/[token] renders old-slot reference line + RescheduleShell; RescheduleShell reuses Phase 5 SlotPicker verbatim (zero modifications to slot-picker.tsx), includes Managed Turnstile for parity, POST /api/reschedule rate-limits + passes oldRescheduleHash CAS guard to rescheduleBooking()
- Shared TokenNotActive component covers both routes with owner mailto contact link

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared TokenNotActive + token resolvers + cancel page (GET) + cancel API (POST)** - `0ecbab9` (feat)
2. **Task 2: Reschedule page (GET) + RescheduleShell client + POST /api/reschedule** - `92739c5` (feat)

## Files Created

- `app/_components/token-not-active.tsx` - Shared "no longer active" branded page, owner mailto link (cancel + reschedule shared)
- `app/cancel/[token]/_lib/resolve-cancel-token.ts` - server-only: hashToken + Supabase lookup by cancel_token_hash + validity → active|cancelled|not_active
- `app/cancel/[token]/page.tsx` - Server Component: noindex, status-branched render (active→form, cancelled→inline success, not_active→TokenNotActive)
- `app/cancel/[token]/_components/cancel-confirm-form.tsx` - Client: reason textarea + confirm/keep buttons → POST /api/cancel, inline success with "Book again" CTA
- `app/api/cancel/route.ts` - Route Handler: rate-limit → token resolve → cancelBooking(actor:'booker') → NOT_ACTIVE(410)/INTERNAL(500)/ok(200)
- `app/reschedule/[token]/_lib/resolve-reschedule-token.ts` - server-only: hashToken + lookup by reschedule_token_hash + validity → active|not_active, returns tokenHash for CAS
- `app/reschedule/[token]/page.tsx` - Server Component: noindex, old-slot reference line in booker TZ, mounts RescheduleShell
- `app/reschedule/[token]/_components/reschedule-shell.tsx` - Client: browser TZ detection, SlotPicker verbatim, Turnstile widget, race-loser banner, inline success state, booker data silent
- `app/api/reschedule/route.ts` - Route Handler: rate-limit → token resolve → rescheduleBooking(oldRescheduleHash CAS) → SLOT_TAKEN(409)/NOT_ACTIVE(410)/BAD_SLOT(400)/ok(200)

## Decisions Made

- GET pages are Server Components, read-only — email clients prefetch links; mutations only on POST (RESEARCH Pitfall 1)
- Success state renders inline in same URL after POST 200 — client sets done=true state, no redirect, URL stays stable (Open Question B from 06-CONTEXT resolved this way)
- No Turnstile server-side verification on /api/cancel or /api/reschedule in v1 — rate-limit is the primary defense; widget included on reschedule for Phase 5 UX parity and Phase 8 hook-in with zero UI change
- Both GET pages export generateMetadata returning { robots: { index: false, follow: false } } — token URLs contain booking-specific PII and must never be indexed
- Reschedule CAS guard (oldRescheduleHash) is derived server-side from tokenHash, never round-tripped from client — client only ever sends { token, startAt, endAt }
- TokenNotActive shared component passes ownerEmail from the resolved account when known; passes null when account couldn't be resolved (defensive)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Forward Locks for Plan 06-05 (Owner Routes)

The `cancelBooking()` function called by `/api/cancel` with `actor:'booker'` is the SAME function the owner Server Action will call with `actor:'owner'`. The apologetic vs. confirmation email tone divergence is already wired via the actor parameter in Plan 06-03.

## Forward Locks for Plan 06-06 (Integration Tests)

Integration tests should target:
- `POST /api/cancel`: valid token → 200, expired token → 410, rate-limit → 429, invalid JSON → 400
- `POST /api/reschedule`: valid token + open slot → 200, slot_taken → 409, not_active → 410, bad_slot → 400, rate-limit → 429
- `lib/bookings/cancel.ts` + `lib/bookings/reschedule.ts` unit-level CAS behavior
- `lib/rate-limit.ts` sliding-window count behavior
- SlotPicker is unchanged so no Phase 5 regression expected

## Next Phase Readiness

- Cancel + reschedule public token routes fully functional
- Owner cancel surface (Plan 06-05) can import and call cancelBooking() with actor:'owner'
- Integration tests (Plan 06-06) have clear targets: POST /api/cancel + POST /api/reschedule + shared functions
- slot-picker.tsx was not modified (confirmed via git diff empty output) — Phase 5 booking flow unaffected

---
*Phase: 06-cancel-and-reschedule-lifecycle*
*Completed: 2026-04-26*
