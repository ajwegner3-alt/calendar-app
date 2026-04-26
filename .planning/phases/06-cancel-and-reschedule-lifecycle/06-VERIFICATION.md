---
phase: 06-cancel-and-reschedule-lifecycle
verified: 2026-04-25T22:00:00Z
status: human_needed
score: 5/5 must-haves verified (all automated checks pass)
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: ICS METHOD:CANCEL auto-removes calendar event in real clients
    expected: Send a real cancellation; open the cancelled.ics in Apple Mail / Gmail web / Outlook web; the original event is removed from calendar (no orphan, no duplicate, no manual delete needed)
    why_human: Calendar client iTIP behavior requires real email + real calendar app -- not simulatable in Vitest
  - test: ICS METHOD:REQUEST + same UID + SEQUENCE:1 updates calendar event in place on reschedule
    expected: Reschedule a booking; open the new invite.ics in the same calendar client where the original was added; event time updates IN PLACE -- no duplicate event
    why_human: Same as above -- real iTIP UPDATE handling requires real email client
  - test: Rate-limit live verification on /api/cancel and /api/reschedule
    expected: Hit each endpoint 11+ times rapidly with the same simulated IP within 5 minutes; 11th call returns 429 with Retry-After header visible in real browser DevTools; rate_limit_events table accumulates correctly in Supabase dashboard
    why_human: Integration test #7 already proves the code path; live check confirms Vercel does not strip the Retry-After header under real network conditions
---

# Phase 6: Cancel and Reschedule Lifecycle Verification Report

**Phase Goal:** A booker can cancel or reschedule via tokenized email links without logging in; both parties get notified; tokens are secure. Andrew can cancel any booking from the dashboard.
**Verified:** 2026-04-25T22:00:00Z
**Status:** human_needed -- all automated structural checks pass; 3 human-gated items deferred to Phase 9 per project-wide manual QA convention (Andrew approved 6/8 manual QA steps live on 2026-04-25; steps 4 and 8 explicitly deferred)
**Re-verification:** Yes -- independent goal-backward re-verification against actual codebase; replaces executor-authored VERIFICATION.md

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Booker clicks cancel link in email, lands on /cancel/[token], confirms, booking is marked cancelled and both parties notified | VERIFIED | app/cancel/[token]/page.tsx (91 lines) uses resolveCancelToken() for read-only GET; CancelConfirmForm POSTs to /api/cancel; route calls cancelBooking({ actor: booker }) which atomically sets status=cancelled and fires sendCancelEmails(); integration test #1 + Andrew manual QA step 3 |
| 2 | Booker clicks reschedule link, lands on /reschedule/[token], picks new slot from same event type SlotPicker, confirms, booking slot updated and both parties get updated .ics | VERIFIED | app/reschedule/[token]/page.tsx (68 lines) resolves token server-side; RescheduleShell reuses SlotPicker verbatim from @/app/[account]/[event-slug]/_components/slot-picker; POSTs to /api/reschedule; rescheduleBooking() atomically swaps slot, rotates tokens, fires sendRescheduleEmails() with fresh .ics METHOD:REQUEST SEQUENCE:1; integration test #2 + Andrew manual QA step 5 |
| 3 | Tokens are SHA-256 hashes in DB; raw tokens only in emails; tokens invalidated on status change and after appointment passes | VERIFIED | lib/bookings/tokens.ts: hashToken() uses crypto.subtle.digest(SHA-256) (Web Crypto, not Node); cancel_token_hash + reschedule_token_hash TEXT NOT NULL in schema; cancelBooking() replaces both with hashToken(crypto.randomUUID()) dead hashes; rescheduleBooking() WHERE includes eq(reschedule_token_hash, oldRescheduleHash) CAS guard; both routes check start_at <= new Date(); integration tests #3, #4, #6 |
| 4 | Cancel and reschedule endpoints rate-limited per IP; 429 + Retry-After returned on overrun | VERIFIED (integration) | Both route handlers: checkRateLimit() is the FIRST async call (line 37/38), before any token hash or DB token lookup; lib/rate-limit.ts sliding-window algorithm; 429 includes Retry-After header; integration tests #7-cancel and #7-reschedule pass |
| 5 | Andrew can cancel any booking on his account from the dashboard detail view at /app/bookings/[id] | VERIFIED | app/(shell)/app/bookings/[id]/page.tsx (189 lines): RLS-scoped read via createClient(); renders CancelButton when canCancel = isConfirmed && !isPast; cancelBookingAsOwner() Server Action: two-stage pipeline -- RLS pre-check then delegates to shared cancelBooking({ actor: owner }); integration tests #8a/#8b + Andrew manual QA step 6 |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| supabase/migrations/20260427120000_rate_limit_events.sql | rate_limit_events table + composite index (key, occurred_at) | VERIFIED | 32 lines; CREATE TABLE IF NOT EXISTS with key text NOT NULL; composite index rate_limit_events_key_occurred_idx; no RLS (intentional -- service-role callers only) |
| lib/rate-limit.ts | checkRateLimit(key, maxCount, windowMs) fails open on DB error | VERIFIED | 96 lines; sliding-window SELECT count + INSERT; fails open on countError; DEFAULT_TOKEN_RATE_LIMIT = { maxRequests: 10, windowMs: 5 * 60 * 1000 } exported |
| lib/email/build-ics.ts | Extended with optional method + sequence params; METHOD:CANCEL sets STATUS:CANCELLED | VERIFIED | 108 lines; method defaults to REQUEST; sequence defaults to 0; STATUS:CANCELLED set when method === CANCEL -- backward-compatible |
| lib/email/send-cancel-emails.ts | Both parties; apologetic copy for owner-cancel; reason callout opposite party only; METHOD:CANCEL .ics | VERIFIED | 259 lines; Promise.allSettled orchestrator; reason callout conditionals by actor; METHOD:CANCEL .ics attached to both |
| lib/email/send-reschedule-emails.ts | Both parties; fresh .ics same UID + SEQUENCE:1 + METHOD:REQUEST; old slot strikethrough | VERIFIED | 244 lines; ICalCalendarMethod.REQUEST; sequence: 1; uid: booking.id (same UID); old slot with strikethrough; rotated raw tokens in cancel/reschedule links |
| lib/bookings/cancel.ts | cancelBooking({ bookingId, actor, reason?, appUrl, ip? }) -- dead-hash invalidation, booking_events audit | VERIFIED | 209 lines; hashToken(crypto.randomUUID()) for dead hashes; UPDATE WHERE status=confirmed AND start_at > now(); PGRST116 -> not_active; fire-and-forget emails + audit |
| lib/bookings/reschedule.ts | rescheduleBooking({ bookingId, oldRescheduleHash, ... }) -- CAS WHERE, token rotation, status stays confirmed | VERIFIED | 231 lines; double CAS with reschedule_token_hash = oldRescheduleHash; 23505 -> slot_taken; PGRST116 -> not_active; generateBookingTokens() for fresh pair |
| app/cancel/[token]/page.tsx | Server Component GET (read-only); noindex; CancelConfirmForm POSTs /api/cancel | VERIFIED | 91 lines; resolveCancelToken() read-only; robots noindex; 3 render branches: active, cancelled, not_active |
| app/reschedule/[token]/page.tsx | Server Component GET; SlotPicker reused verbatim; RescheduleShell POSTs /api/reschedule; noindex | VERIFIED | 68 lines; resolveRescheduleToken(); SlotPicker import unmodified (184 lines); noindex set |
| app/api/cancel/route.ts | POST: rate-limit first, token lookup, cancelBooking(), 410/429/200 | VERIFIED | 102 lines; checkRateLimit() line 37 BEFORE hashToken line 63; 410 NOT_ACTIVE; 429 RATE_LIMITED + Retry-After; 200 { ok: true } |
| app/api/reschedule/route.ts | POST: rate-limit first, token lookup, rescheduleBooking(), 409/410/429/200 | VERIFIED | 113 lines; checkRateLimit() line 38 BEFORE hashToken line 61; passes oldRescheduleHash for CAS; all error paths present |
| app/(shell)/app/bookings/[id]/page.tsx | Owner booking detail; RLS-scoped; CancelButton when confirmed + not past | VERIFIED | 189 lines; createClient() RLS-scoped; canCancel = isConfirmed && !isPast; CancelButton in canCancel branch; dual-TZ time display |
| app/(shell)/app/bookings/[id]/_lib/actions.ts | cancelBookingAsOwner Server Action; RLS pre-check; identical error for not-found vs foreign | VERIFIED | 103 lines; use server; RLS ownership check; identical error (no UUID leakage); delegates to cancelBooking({ actor: owner }); revalidatePath() on success |
| app/(shell)/app/bookings/[id]/_components/cancel-button.tsx | AlertDialog with reason Textarea; Server Action invoke; toast; router.refresh() | VERIFIED | 136 lines; use client; AlertDialog + Textarea; startTransition wraps Server Action; toast.success + toast.error; router.refresh() on success |
| app/cancel/[token]/_lib/resolve-cancel-token.ts | Read-only resolver; active/cancelled/not_active states | VERIFIED | 124 lines; import server-only; SELECT only; integration test #10 proves no DB mutation on call |
| app/reschedule/[token]/_lib/resolve-reschedule-token.ts | Read-only resolver; returns tokenHash for CAS | VERIFIED | 85 lines; import server-only; returns tokenHash; SELECT only |
| tests/helpers/booking-fixtures.ts | createConfirmedBooking() fixture factory with raw tokens | VERIFIED | 103 lines; admin client insert; returns { bookingId, rawCancelToken, rawRescheduleToken, cancelHash, rescheduleHash, bookerEmail, startAt } |
| tests/cancel-reschedule-api.test.ts | 12-test integration suite; all required scenarios; real DB | VERIFIED | 647 lines; 12 test cases; real Supabase for DB; email-sender + turnstile mocked via vitest aliases |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| app/api/cancel/route.ts | lib/rate-limit.ts | checkRateLimit() at line 37 -- before token resolution | WIRED |
| app/api/cancel/route.ts | lib/bookings/cancel.ts | cancelBooking({ actor: booker }) line 83 | WIRED |
| app/api/reschedule/route.ts | lib/rate-limit.ts | checkRateLimit() at line 38 -- before token resolution | WIRED |
| app/api/reschedule/route.ts | lib/bookings/reschedule.ts | rescheduleBooking({ bookingId, oldRescheduleHash: tokenHash }) line 81 | WIRED |
| lib/bookings/cancel.ts | lib/email/send-cancel-emails.ts | void sendCancelEmails({ ... }) line 150 (fire-and-forget) | WIRED |
| lib/bookings/reschedule.ts | lib/email/send-reschedule-emails.ts | void sendRescheduleEmails({ ... }) line 174 (fire-and-forget) | WIRED |
| lib/email/send-cancel-emails.ts | lib/email/build-ics.ts | buildIcsBuffer({ method: ICalCalendarMethod.CANCEL, sequence: 1, uid: booking.id }) lines 134 + 220 | WIRED |
| lib/email/send-reschedule-emails.ts | lib/email/build-ics.ts | buildIcsBuffer({ method: ICalCalendarMethod.REQUEST, sequence: 1, uid: booking.id }) lines 126 + 204 | WIRED |
| lib/email/send-cancel-emails.ts | lib/email-sender | import { sendEmail } from @/lib/email-sender line 5 | WIRED |
| lib/email/send-reschedule-emails.ts | lib/email-sender | import { sendEmail } from @/lib/email-sender line 5 | WIRED |
| app/(shell)/app/bookings/[id]/_lib/actions.ts | lib/bookings/cancel.ts | cancelBooking({ actor: owner, ip: null }) line 80 -- after RLS pre-check | WIRED |
| app/(shell)/app/bookings/[id]/_components/cancel-button.tsx | _lib/actions.ts | cancelBookingAsOwner(bookingId, reason) line 55 | WIRED |
| app/(shell)/app/bookings/[id]/page.tsx | _components/cancel-button.tsx | CancelButton guarded by canCancel line 181 | WIRED |
| app/cancel/[token]/page.tsx | _lib/resolve-cancel-token.ts | resolveCancelToken(token) line 26 | WIRED |
| app/cancel/[token]/_components/cancel-confirm-form.tsx | /api/cancel | fetch /api/cancel POST line 22 | WIRED |
| app/reschedule/[token]/page.tsx | _lib/resolve-reschedule-token.ts | resolveRescheduleToken(token) line 23 | WIRED |
| app/reschedule/[token]/_components/reschedule-shell.tsx | slot-picker.tsx | import SlotPicker verbatim from @/app/[account]/[event-slug]/_components/slot-picker -- unmodified | WIRED |
| app/reschedule/[token]/_components/reschedule-shell.tsx | /api/reschedule | fetch /api/reschedule POST body { token, startAt, endAt } line 57 | WIRED |
| tests/cancel-reschedule-api.test.ts | app/api/cancel/route.ts | import { POST as cancelPOST } from @/app/api/cancel/route | WIRED |
| tests/cancel-reschedule-api.test.ts | app/api/reschedule/route.ts | import { POST as reschedulePOST } from @/app/api/reschedule/route | WIRED |
| tests/cancel-reschedule-api.test.ts | lib/bookings/cancel.ts (owner path) | cancelBooking({ actor: owner }) direct call | WIRED |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| LIFE-01: Booker cancels via email link; booking marked cancelled; both parties notified | SATISFIED | /api/cancel POST + cancelBooking({ actor: booker }) + sendCancelEmails() both parties |
| LIFE-02: Booker reschedules via email link; slot updated; both parties notified with fresh .ics | SATISFIED | /api/reschedule POST + rescheduleBooking() + sendRescheduleEmails() METHOD:REQUEST + same UID + SEQUENCE:1 |
| LIFE-03: Tokens stored as SHA-256 hashes; raw tokens in emails only; invalidated on use + appointment passed | SATISFIED | crypto.subtle.digest SHA-256; dead-hash on cancel; CAS guard on reschedule; start_at > now() check; 201 response body contains only { bookingId, redirectTo } |
| LIFE-04: Cancel endpoint rate-limited per IP; 429 + Retry-After on enumeration | SATISFIED (integration) | checkRateLimit() first call in both POST handlers; rate_limit_events table; tests #7-cancel and #7-reschedule pass; live Vercel check deferred to Phase 9 |
| LIFE-05: Owner can cancel any booking from dashboard bookings detail view | SATISFIED | /app/bookings/[id] + CancelButton AlertDialog + cancelBookingAsOwner Server Action with two-stage RLS auth |
| EMAIL-06: Both parties receive cancellation notification; booker gets re-book CTA | SATISFIED | send-cancel-emails.ts: booker email has Book again link; owner has triggeredBy copy; reason callout for opposite party only when non-empty |
| EMAIL-07: Both parties receive reschedule notification with updated .ics | SATISFIED | send-reschedule-emails.ts: METHOD:REQUEST + SEQUENCE:1 + same UID; old/new slot shown with strikethrough |

---

### Locked Invariants from Earlier Phases -- All Preserved

| Invariant | Status |
|-----------|--------|
| bookings_no_double_book partial unique index | PRESERVED -- rescheduleBooking() catches 23505 returns slot_taken; integration test #5 exercises real DB index |
| Service-role only for public reads/writes | PRESERVED -- all token resolvers and API routes use createAdminClient(); dashboard uses createClient() RLS-scoped |
| UID = booking.id for .ics stable identity | PRESERVED -- buildIcsBuffer() called with uid: booking.id in all 4 call sites |
| Rate-limit-before-token-resolution pattern | ESTABLISHED -- checkRateLimit() at line 37/38; hashToken() at line 63/61 -- confirmed ordering |
| Fire-and-forget email contract | PRESERVED -- sendCancelEmails / sendRescheduleEmails use Promise.allSettled; called via void; errors caught per-sender |
| SlotPicker not modified | VERIFIED -- slot-picker.tsx is 184 lines; reschedule shell imports it verbatim |

---

### Anti-Patterns Found

No blockers or warnings.

| Item | Severity | Impact |
|------|---------|--------|
| RescheduleShell includes Turnstile widget UI but /api/reschedule does NOT verify the token in v1 (rate-limit only) | Info | Documented in code comment as intentional v1 decision. Phase 8 hardening candidate. No security gap for current threat model. |
| rate_limit_events table has no automated cleanup | Info | Documented in migration comment. Phase 8 hardening candidate. Growth manageable until then. |
| Server Actions cannot capture client IP (ip: null in cancelBookingAsOwner) | Info | Documented in actions.ts. Forensics slightly reduced for owner-initiated cancels. Acceptable v1 limitation. |

---

### Test Results (at time of verification)

```
Test Files  7 passed (7)
      Tests  66 passed (66)
```

Phase 6 cancel-reschedule-api.test.ts -- all 12 cases confirmed in test file:
- #1 cancel happy path + METHOD:CANCEL .ics assertions
- #2 reschedule happy path + DB row updated + both emails with .ics
- #3 token invalidation (cancel then re-use same token -> 410 NOT_ACTIVE)
- #4 token invalidation (appointment in past -> 410 NOT_ACTIVE)
- #5 reschedule slot conflict -> 409 SLOT_TAKEN (real DB partial unique index)
- #6 reschedule CAS guard (old token second attempt -> 410 NOT_ACTIVE)
- #7-cancel rate limit sliding window -> 429 + Retry-After
- #7-reschedule rate limit sliding window -> 429 + Retry-After
- #8a owner cancel with reason -> apologetic email with reason callout
- #8b owner cancel without reason -> reason row omitted entirely
- #9 .ics shape: METHOD:CANCEL + UID + SEQUENCE:1 + STATUS:CANCELLED
- #10 email-prefetch defense: GET resolver is read-only (DB row unchanged)

---

### Human Verification Required (Phase 9 QA Gate)

Three items require human testing. All automated infrastructure is verified and in place. Andrew completed 6/8 manual QA steps live on 2026-04-25 (steps 1-3, 5-7 approved). Steps 4 and 8 explicitly deferred to Phase 9.

**1. ICS METHOD:CANCEL -- real calendar client auto-removal**
Test: Send a real cancellation from the live deployment; open the cancellation email containing cancelled.ics in Apple Mail, Gmail web, and Outlook web.
Expected: The original calendar event is automatically removed in each client -- no orphan event, no duplicate, no manual delete required.
Why human: Calendar client iTIP cancel behavior requires real email delivery to a real inbox and real calendar application.

**2. ICS METHOD:REQUEST + same UID -- in-place update on reschedule**
Test: Book a slot, add the invite.ics to your calendar, then reschedule the booking; open the reschedule email in the same calendar client.
Expected: The existing calendar event updates in place to the new time -- no duplicate event created.
Why human: Real iTIP UPDATE (SEQUENCE:1 + same UID) behavior depends on the calendar client iTIP implementation.

**3. Rate-limit live verification on Vercel**
Test: Hit POST /api/cancel 11+ times rapidly from the same IP using real browser DevTools or curl within a 5-minute window.
Expected: The 11th response returns HTTP 429 with a Retry-After header visible in the browser network tab; rate_limit_events table shows accumulated rows for that key.
Why human: Integration test #7 exercises the code path against real Supabase. Live check confirms Vercel does not strip the Retry-After header under real network conditions.

---

### Notes

- Re-verification scope: Independent goal-backward verification against actual codebase, replacing executor-authored VERIFICATION.md. No gaps found -- all claimed artifacts exist, are substantive (no stubs, real implementations), and correctly wired.
- Manual QA Andrew sign-off: 2026-04-25 -- steps 1, 2, 3, 5, 6, 7 approved live on Vercel. Steps 4 and 8 explicitly deferred to Phase 9 per CLAUDE.md project-wide convention.
- Email deliverability note: Fire-and-forget email paths in /api/cancel, /api/reschedule, and cancelBookingAsOwner may benefit from waitUntil() from @vercel/functions if lambda-timeout symptoms appear in Phase 9. Tracked as Phase 8 INFRA-01/INFRA-04 hardening candidate.

---

*Verified: 2026-04-25T22:00:00Z*
*Verifier: Claude (gsd-verifier) -- independent goal-backward re-verification*
*Prior manual QA sign-off: Andrew (2026-04-25, steps 1-3, 5-7 live on Vercel)*

