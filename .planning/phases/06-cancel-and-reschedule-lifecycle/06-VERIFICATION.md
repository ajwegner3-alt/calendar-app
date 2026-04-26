---
phase: 06-cancel-and-reschedule-lifecycle
verified: 2026-04-25T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "ICS METHOD:CANCEL auto-removes calendar event in real clients"
    expected: "Send a real cancellation; open the cancelled.ics in Apple Mail / Gmail web / Outlook web; the original event is removed from calendar (no orphan, no duplicate, no manual delete needed)"
    why_human: "Calendar client iTIP behavior requires real email + real calendar app — not simulatable in Vitest"
  - test: "ICS METHOD:REQUEST + same UID + SEQUENCE:1 updates calendar event in place on reschedule"
    expected: "Reschedule a booking; open the new invite.ics in the same calendar client where the original was added; event time updates IN PLACE — no duplicate event"
    why_human: "Same as above — real iTIP UPDATE handling"
  - test: "Rate-limit live verification on /api/cancel and /api/reschedule"
    expected: "Hit each endpoint 11+ times rapidly with the same simulated IP within 5 minutes; 11th call returns 429 with Retry-After header in real browser DevTools"
    why_human: "Integration test #7 already proves the code path; live check confirms Vercel does not strip headers and the rate_limit_events table accumulates correctly under real network conditions"
---

# Phase 6 Verification Report

**Phase Goal:** A booker can cancel or reschedule via tokenized email links without logging in; both parties get notified; tokens are secure. Andrew can cancel any booking from the dashboard.
**Verified:** 2026-04-25T00:00:00Z
**Status:** human_needed — all automated must-haves verified; Andrew completed manual QA steps 1-3, 5-7 on the live Vercel deployment (2026-04-25); steps 4 and 8 explicitly deferred to Phase 9 per project-wide manual QA convention
**Re-verification:** No (initial verification)

---

## Goal Achievement

### Must-haves Verified

| # | Must-have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Cancel link in confirmation email → /cancel/[token] → booking cancelled + both parties notified | VERIFIED | `app/api/cancel/route.ts` POST handler wired to `cancelBooking()` shared function; integration test #1 + Andrew manual QA step 3 |
| 2 | Reschedule link → /reschedule/[token] → new slot picked → booking updated + both parties notified with fresh .ics | VERIFIED | `app/api/reschedule/route.ts` POST handler wired to `rescheduleBooking()` shared function; SlotPicker reused verbatim; integration test #2 + Andrew manual QA step 5 |
| 3 | Tokens stored as SHA-256 hashes; raw tokens in emails only; tokens invalidated on status change + appointment passed | VERIFIED | `lib/bookings/tokens.ts` hashToken() SHA-256; cancel_token_hash + reschedule_token_hash in DB; dead-hash invalidation on cancel (integration test #3 + #4); CAS guard on reschedule (integration test #6) |
| 4 | Cancel + reschedule endpoints rate-limited per IP (429 + Retry-After on overrun) | VERIFIED (integration) | `lib/rate-limit.ts` checkRateLimit() wired into both POST handlers; rate_limit_events table accumulates; integration test #7 proves 429 + Retry-After; live confirmation deferred to Phase 9 |
| 5 | Andrew can cancel any booking from the dashboard detail view | VERIFIED | `/app/bookings/[id]` Server Component + `cancelBookingAsOwner` Server Action + CancelButton AlertDialog; two-stage RLS auth; integration test #8a/#8b (via cancelBooking() direct call) + Andrew manual QA step 6 |

**Score:** 5/5 must-haves structurally verified (integration tests + codebase); rate-limit live Vercel confirmation deferred to Phase 9

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| supabase/migrations/20260426000000_rate_limit_events.sql | rate_limit_events table + composite index (key, occurred_at) | VERIFIED | Plan 06-01; applied to remote DB; no RLS |
| lib/rate-limit.ts | checkRateLimit(key, windowMs, maxCount) fails open on DB error | VERIFIED | Plan 06-02; 5-min window; 10 max per key; INSERT + COUNT pattern |
| lib/email/build-ics.ts | Extended with optional method + sequence params (METHOD:CANCEL path) | VERIFIED | Plan 06-02; default REQUEST/0; CANCEL branch sets ICalEventStatus.CANCELLED |
| lib/email/send-cancel-emails.ts | Booker + owner cancel emails; apologetic copy + re-book CTA for owner-cancel; reason callout for opposite party only | VERIFIED | Plan 06-02; reason-callout rule: opposite party only, non-empty only |
| lib/email/send-reschedule-emails.ts | Booker + owner reschedule emails; fresh .ics with same UID + SEQUENCE:1 + METHOD:REQUEST | VERIFIED | Plan 06-02; rawCancelToken + rawRescheduleToken from post-reschedule rotation |
| lib/bookings/cancel.ts | cancelBooking({ bookingId, actor, reason? }) — dead-hash invalidation, booking_events audit row | VERIFIED | Plan 06-03; both cancel_token_hash + reschedule_token_hash replaced with hashToken(randomUUID()) |
| lib/bookings/reschedule.ts | rescheduleBooking({ bookingId, rawRescheduleToken, newStartAt, newEndAt }) — CAS WHERE clause, token rotation, status stays 'confirmed' | VERIFIED | Plan 06-03; UPDATE WHERE reschedule_token_hash = oldHash; status='confirmed' (not 'rescheduled') |
| app/cancel/[token]/page.tsx | Server Component GET (read-only resolver); inline POST success state; noindex | VERIFIED | Plan 06-04; resolveCancelToken() read-only; POST via fetch to /api/cancel; email-prefetch defense integration test #10 |
| app/reschedule/[token]/page.tsx | Server Component GET (read-only); SlotPicker reused verbatim; POST /api/reschedule; noindex | VERIFIED | Plan 06-04; SlotPicker import unchanged; git diff confirmed empty for slot-picker.tsx |
| app/api/cancel/route.ts | POST handler: rate-limit-first, token lookup, cancelBooking(), 410 NOT_ACTIVE / 429 RATE_LIMITED / 200 | VERIFIED | Plan 06-04; rate-limit called BEFORE token resolution; integration tests #1-4 + #7 |
| app/api/reschedule/route.ts | POST handler: rate-limit-first, token lookup, rescheduleBooking(), conflict → 409 SLOT_TAKEN | VERIFIED | Plan 06-04; integration tests #2 + #5 + #6 + #7 |
| app/(shell)/app/bookings/[id]/page.tsx | Owner booking detail Server Component; RLS-scoped read; CancelButton AlertDialog | VERIFIED | Plan 06-05; two-stage auth; /app/bookings/[id] URL contract locked for Phase 8 |
| app/(shell)/app/bookings/[id]/_lib/actions.ts | cancelBookingAsOwner Server Action; RLS pre-check + service-role cancelBooking(); appUrl resolution | VERIFIED | Plan 06-05; identical error for not-found vs foreign-account (no UUID existence leakage) |
| tests/helpers/booking-fixtures.ts | createConfirmedBooking() fixture factory | VERIFIED | Plan 06-06; 34554b6 |
| tests/cancel-reschedule-api.test.ts | 12-test integration suite; all 10 required scenarios | VERIFIED | Plan 06-06; f346b33; 66/66 total suite green |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| app/api/cancel/route.ts | lib/rate-limit.ts | checkRateLimit() BEFORE token lookup | WIRED |
| app/api/cancel/route.ts | lib/bookings/cancel.ts | cancelBooking({ actor: 'booker', ... }) | WIRED |
| app/api/reschedule/route.ts | lib/rate-limit.ts | checkRateLimit() BEFORE token lookup | WIRED |
| app/api/reschedule/route.ts | lib/bookings/reschedule.ts | rescheduleBooking({ bookingId, rawRescheduleToken, ... }) | WIRED |
| lib/bookings/cancel.ts | lib/email/send-cancel-emails.ts | sendCancelEmails({ ... }) fire-and-forget | WIRED |
| lib/bookings/reschedule.ts | lib/email/send-reschedule-emails.ts | sendRescheduleEmails({ ... }) fire-and-forget | WIRED |
| lib/email/send-cancel-emails.ts | lib/email/build-ics.ts | buildIcsBuffer({ method: ICalCalendarMethod.CANCEL, sequence: 1, ... }) | WIRED |
| lib/email/send-reschedule-emails.ts | lib/email/build-ics.ts | buildIcsBuffer({ method: ICalCalendarMethod.REQUEST, sequence: 1, ... }) | WIRED |
| app/(shell)/app/bookings/[id]/_lib/actions.ts | lib/bookings/cancel.ts | cancelBooking({ actor: 'owner', reason, ... }) after RLS pre-check | WIRED |
| app/cancel/[token]/_lib/resolve-cancel-token.ts | lib/supabase/admin.ts | createAdminClient() read-only | WIRED |
| tests/cancel-reschedule-api.test.ts | app/api/cancel/route.ts | import { POST as cancelPOST } | WIRED |
| tests/cancel-reschedule-api.test.ts | app/api/reschedule/route.ts | import { POST as reschedulePOST } | WIRED |
| tests/cancel-reschedule-api.test.ts | lib/bookings/cancel.ts (owner path) | cancelBooking({ actor: 'owner', ... }) direct call | WIRED |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| LIFE-01: Booker cancels via email link; booking marked cancelled; both parties notified | SATISFIED | /api/cancel POST + cancelBooking() shared function + sendCancelEmails() |
| LIFE-02: Booker reschedules via email link; slot updated; both parties notified with fresh .ics | SATISFIED | /api/reschedule POST + rescheduleBooking() + sendRescheduleEmails() + SlotPicker reused |
| LIFE-03: Tokens stored as SHA-256 hashes; raw tokens in emails only; invalidated on use + appointment passed | SATISFIED | hashToken(SHA-256) in lib/bookings/tokens.ts; dead-hash invalidation in cancelBooking(); CAS guard in rescheduleBooking() |
| LIFE-04: Cancel endpoint rate-limited per IP; 429 on enumeration | SATISFIED (integration) | checkRateLimit() in both POST handlers; rate_limit_events table; integration test #7; live Vercel confirmation deferred to Phase 9 |
| LIFE-05: Owner can cancel any booking from dashboard bookings detail view | SATISFIED | /app/bookings/[id] + cancelBookingAsOwner Server Action; two-stage RLS auth |
| EMAIL-06: Both parties receive cancellation notification email; booker gets re-book CTA | SATISFIED | send-cancel-emails.ts; booker gets "Book again" link; owner gets reason callout (if provided) |
| EMAIL-07: Both parties receive reschedule notification email with updated .ics | SATISFIED | send-reschedule-emails.ts; METHOD:REQUEST + same UID + SEQUENCE:1 |

---

### Locked Invariants from Earlier Phases — All Preserved

| Invariant | Status |
|-----------|--------|
| bookings_no_double_book partial unique index | PRESERVED — rescheduleBooking() catches 23505 and returns SLOT_TAKEN |
| Service-role only for public reads/writes | PRESERVED — all token route handlers use createAdminClient() |
| UID = booking.id for .ics stable identity | PRESERVED — buildIcsBuffer() still sets id: booking.id; same UID in cancel + reschedule .ics |
| Rate-limit-before-token-resolution pattern | ESTABLISHED — checkRateLimit() is the first DB call in both POST handlers |
| Fire-and-forget email contract | PRESERVED — sendCancelEmails/sendRescheduleEmails use Promise.allSettled; never throw |
| SlotPicker not modified | VERIFIED — git diff confirms zero changes to app/[account]/[event-slug]/_components/slot-picker.tsx |

---

### Test Results

```
Test Files  7 passed (7)
      Tests  66 passed (66)
   Duration  ~5s
```

Phase 6 cancel-reschedule-api.test.ts coverage — all 12 cases:
- #1 cancel happy path + METHOD:CANCEL .ics assertions — PASS
- #2 reschedule happy path + DB row updated + both emails with .ics — PASS
- #3 token invalidation (cancel then re-use same token → 410 NOT_ACTIVE) — PASS
- #4 token invalidation (appointment in past → 410 NOT_ACTIVE) — PASS
- #5 reschedule slot conflict → 409 SLOT_TAKEN (DB partial unique index) — PASS
- #6 reschedule CAS guard (old token second attempt → 410 NOT_ACTIVE not 23505) — PASS
- #7 rate limit sliding window — /api/cancel 11th request → 429 + Retry-After — PASS
- #7b rate limit sliding window — /api/reschedule 11th request → 429 + Retry-After — PASS
- #8a owner cancel with reason → booker gets apologetic email with reason callout — PASS
- #8b owner cancel without reason → booker email omits reason row entirely — PASS
- #9 .ics shape: METHOD:CANCEL + UID:<uuid> + SEQUENCE:1 + STATUS:CANCELLED — PASS
- #10 email-prefetch defense: GET /cancel/[token] is read-only (DB row unchanged after GET) — PASS

Build: npm run build exits 0. All Phase 6 routes appear as dynamic in build output.

---

### Deferred to Phase 9

See `human_verification` frontmatter above for the three items deferred:

**1. .ics METHOD:CANCEL — real calendar client removal (step 4)**
Rationale: Consolidated with Phase 5's "ICS file structure for Gmail inline card" item and QA-03 mail-tester checks in Phase 9. Requires real email + real calendar app.

**2. .ics METHOD:REQUEST + same UID — in-place update on reschedule (step 4)**
Rationale: Same as above — iTIP UPDATE behavior requires real email client.

**3. Rate-limit live verification on Vercel (step 8)**
Rationale: Integration test #7 proves the code path with real Supabase. Live confirmation verifies that Vercel does not strip Retry-After header and that rate_limit_events accumulates correctly under real network load.

---

### Notes

- **12 integration tests passing** (66/66 total suite green; no Phase 1-5 regressions)
- **Email deliverability:** Second-booking confirmation during manual QA took longer than expected but arrived. No code change. If lambda-timeout symptoms appear in Phase 9 hardening, the fix path is `waitUntil()` from `@vercel/functions` on fire-and-forget email paths in `/api/bookings`, `/api/cancel`, `/api/reschedule`, and `cancelBookingAsOwner` Server Action. Tracked as Phase 8 INFRA-01/INFRA-04 hardening candidate.
- **Manual QA Andrew sign-off:** 2026-04-25 — steps 1, 2, 3, 5, 6, 7 approved live on Vercel deployment. Steps 4 + 8 explicitly deferred to Phase 9 (not failures).

---

*Verified: 2026-04-25T00:00:00Z*
*Verifier: Claude (gsd-executor) + Andrew (manual QA sign-off 2026-04-25)*
