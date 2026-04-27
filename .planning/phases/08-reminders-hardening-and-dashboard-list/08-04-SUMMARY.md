---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-04"
subsystem: reminders
tags: [cron, email, reminders, vercel-cron, after-fn, supabase, vitest, infra-01, infra-02, infra-03, email-05]

requires:
  - phase: 08-reminders-hardening-and-dashboard-list
    provides: 08-01 (accounts.reminder_include_* + event_types.location columns), 08-02 (after() canonical fire-and-forget pattern + Vitest after() shim), 08-03 (rate-limit guard at top of POST /api/bookings)
  - phase: 05-public-booking-flow-email-and-ics
    provides: lib/bookings/tokens.ts (canonical hashToken via Web Crypto), sendEmail singleton, sendBookingEmails after() block in POST /api/bookings
  - phase: 07-widget-and-branding
    provides: lib/email/branding-blocks.ts (renderEmailLogoHeader/Footer/Button + brandedHeadingStyle)
provides:
  - "Reminder cron route GET /api/cron/send-reminders with Bearer CRON_SECRET auth + compare-and-set claim + token rotation + after()-driven email send (INFRA-01, INFRA-02)"
  - "Immediate-reminder hook in POST /api/bookings for bookings starting within next 24h (INFRA-03)"
  - "Reminder email sender lib/email/send-reminder-booker.ts with three account-toggle-gated content blocks (location, custom answers, lifecycle links) (EMAIL-05)"
  - "Shared booking-token facade lib/booking-tokens.ts re-exporting hashToken + adding generateRawToken — single source of truth for cron + bookings route token generation"
  - "vercel.json with Hobby-tier-safe daily cron declaration (cron-job.org hourly driver configured in 08-08)"
  - "Content-quality automated guard test (6 cases) catching broken hrefs, missing text alt, missing logo, spammy subjects, broken toggle gating"
  - "Cron integration test (8 cases) covering auth, claim, idempotency, window boundary, past-bookings, cancelled-bookings, token rotation"
affects:
  - 08-05-event-and-account-settings-ui (will surface the reminder_include_* toggles + event_types.location field in the UI; this plan provides the read-side that wires the toggles into the rendered email)
  - 08-08-rls-matrix-and-ops-hardening (will configure cron-job.org hourly driver + production CRON_SECRET in Vercel env + mail-tester live verification)

tech-stack:
  added: []
  patterns:
    - "Compare-and-set + atomic-token-rotation via single UPDATE: WHERE id=? AND reminder_sent_at IS NULL — claim and token rotation in one trip prevents the case where claim succeeds but rotation fails (would leave booking with stale unusable links)"
    - "Per-row UPDATE loop (not batched) so each booking gets a fresh token pair; acceptable for low-volume v1 (~dozens/day max)"
    - "Token-helper facade module (lib/booking-tokens.ts) re-exports the canonical hashToken from lib/bookings/tokens.ts so any future caller has a single import point and verification stays in sync"
    - "after() callback for fire-and-forget email batches inside cron route — keeps worker alive on Vercel serverless past response flush (Plan 08-02 lock applied to a new endpoint)"
    - "Hobby-tier vercel.json daily fallback + cron-job.org hourly external driver — both pass the same Bearer CRON_SECRET; CAS claim makes simultaneous invocation a silent no-op for already-claimed rows"

key-files:
  created:
    - lib/booking-tokens.ts
    - lib/email/send-reminder-booker.ts
    - app/api/cron/send-reminders/route.ts
    - vercel.json
    - tests/reminder-cron.test.ts
    - tests/reminder-email-content.test.ts
  modified:
    - app/api/bookings/route.ts

key-decisions:
  - "Token-rotation strategy: cron (and immediate-send) generate fresh raw cancel + reschedule tokens, hash them, and UPDATE the booking row in the same atomic statement that claims reminder_sent_at. The original confirmation-email lifecycle tokens are intentionally invalidated by the rotation (RESEARCH Open Q 3 chosen design — single canonical 'current' link per booking)."
  - "lib/booking-tokens.ts is a thin facade over lib/bookings/tokens.ts (NOT a divergent implementation). hashToken is re-exported as-is so cron-rotated tokens hash identically to confirmation tokens for the existing cancel/reschedule resolvers. generateRawToken() returns crypto.randomUUID() — same format as Phase 5 tokens. The plan's example used node:crypto + base64url; that would have broken every existing token verification path. Deviated to preserve correctness."
  - "Cron schedule: 0 8 * * * (daily 08:00 UTC = 03:00 Central) on Hobby tier. Plan 08-08 will add cron-job.org hourly driver — both share the same CRON_SECRET and the CAS claim makes overlap safe."
  - "Claim query shape: full join SELECT (event_types !inner + accounts !inner) into a normalized ScanRow type, THEN per-row UPDATE...WHERE id=? AND reminder_sent_at IS NULL with token-hash rotation in the same statement. Per-row not batched because each booking needs its own fresh token pair."
  - "booking_events insert shape: event_type='reminder_sent' (matches the booking_event_kind enum), actor='system' (cron is system-initiated), account_id denormalized from booking (NOT NULL — required by RLS owners-read policy), metadata={source:'cron'} for cron and {source:'immediate'} for the booking-route hook (lets future ops queries distinguish the two paths)."
  - "Immediate-send hook in POST /api/bookings is added AFTER the existing after(() => sendBookingEmails(...)) block from 08-02 and BEFORE the 201 return. Re-fetches enriched account toggles + event_type location via a single join (the local account/eventType variables from steps 5-6 don't include those columns). 08-03's rate-limit guard at top of POST handler is preserved untouched."
  - "Failure handling: do NOT clear reminder_sent_at on email send failure (RESEARCH Pitfall 4). Acceptable for low-volume v1 — clearing would cause retry spam. Manual remediation deferred to dashboard UI (out of scope)."
  - "CRON_SECRET added to .env.local with a placeholder value. Production rotation: generate via `openssl rand -hex 32`, set in Vercel project env (Production scope), and use the SAME value for cron-job.org. Rotation procedure documented inline in route comments."

patterns-established:
  - "Cron route shape: runtime='nodejs' + Bearer auth as first line of work + service-role client + scan + per-row CAS UPDATE + audit-log insert + after() email batch + JSON {ok, scanned, claimed} response"
  - "Atomic claim + token rotation: any future endpoint that needs to claim-once + invalidate-old-tokens should use this single-UPDATE pattern (not two-statement claim then rotate)"
  - "Cron integration tests: real Supabase test project, build NextRequest with Authorization header, drain after() microtasks via 100-200ms wait, assert on DB row state + __mockSendCalls + booking_events audit row"
  - "Toggle-gated email blocks: render the segment ONLY when toggle is true AND the underlying value is non-empty (location.trim() > 0; answers object has keys). Empty cases omit the segment entirely (no empty header / empty table)"

duration: ~30 min
completed: 2026-04-26
---

# Phase 08 Plan 04: Reminder Cron + Immediate-Send Hook Summary

**End-to-end reminders pipeline: branded reminder email sender, Bearer-authenticated cron route with compare-and-set claim and token rotation, immediate-send hook for in-window bookings, Hobby-tier vercel.json daily fallback. Closes EMAIL-05, INFRA-01, INFRA-02, INFRA-03.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-27T02:04:11Z (npm test baseline)
- **Completed:** 2026-04-27T02:11:33Z (full suite green)
- **Tasks:** 3
- **Files created:** 6 (booking-tokens facade, reminder sender, cron route, vercel.json, cron test, content test)
- **Files modified:** 1 (POST /api/bookings — added immediate-send hook below existing after() block)
- **Test count:** 83 → 97 (+14 new cases: 6 content-quality + 8 cron integration)

## Accomplishments

- **EMAIL-05** — `sendReminderBooker` ships branded reminder emails with subject "Reminder: {event_name} tomorrow at {time_local}" (booker timezone), conditional account-toggle blocks for location / custom answers / lifecycle links, full visual parity with Phase 7 confirmation email.
- **INFRA-01** — Cron route claims via compare-and-set on `reminder_sent_at IS NULL`; double-fire from overlapping cron triggers (Vercel daily + cron-job.org hourly) is provably safe — second tick gets `null` back from `.maybeSingle()` and silently skips.
- **INFRA-02** — Bearer `CRON_SECRET` enforced as the first line of work in the route handler; misses return 401 + Cache-Control: no-store. Test cases #1-#3 prove all three auth paths (no header / wrong secret / valid).
- **INFRA-03** — Bookings created with `start_at` inside the next 24h fire a `sendReminderBooker` immediately via a second `after()` block in POST /api/bookings; the same atomic CAS claim + token rotation pattern as the cron route prevents the future cron tick from double-sending.
- **vercel.json** declares the cron at `0 8 * * *` (daily 08:00 UTC). Hobby-tier-safe; cron-job.org hourly driver added in Plan 08-08 manual checkpoint.
- **Token rotation** — Each reminder send (whether cron-driven or immediate) generates fresh raw cancel + reschedule tokens, stores their SHA-256 hashes on the booking, and embeds the raw tokens in the email body. The original confirmation-email tokens are intentionally invalidated (RESEARCH Open Q 3 — single canonical "current" link per booking).
- **Content-quality automated guard** — `tests/reminder-email-content.test.ts` runs in CI on every commit; catches broken hrefs (`href="undefined"`), missing text-alternative parts, missing logo wiring, spammy ALL-CAPS subjects, and broken toggle gating. Manual mail-tester score now only needs to verify SPF/DKIM/DMARC fundamentals (Plan 08-08 checkpoint).
- **Shared token-helper facade** — `lib/booking-tokens.ts` is the single import point for both the cron route and the bookings route; re-exports the canonical `hashToken` from `lib/bookings/tokens.ts` so cron-rotated tokens hash identically to confirmation tokens for the existing cancel/reschedule resolvers.

## Task Commits

1. **Task 1 — Sender + token-helper facade + content-quality test** — `dc2ccd4` (feat)
2. **Task 2 — Cron route + vercel.json** — `0548ce7` (feat)
3. **Task 3 — Immediate-send hook in POST /api/bookings + cron integration tests** — `a4ba982` (feat)

## Files Created/Modified

### Created (6 files, ~735 LOC)
- `lib/booking-tokens.ts` (~37 LOC) — Thin facade re-exporting `hashToken` from `lib/bookings/tokens.ts` and adding `generateRawToken` (UUIDv4 — same format as Phase 5).
- `lib/email/send-reminder-booker.ts` (~210 LOC) — Reminder sender mirroring `send-booking-confirmation.ts` shape. Subject locked. Three toggle-gated content blocks. Self-contained `escapeHtml` + `stripHtml` helpers (matches Phase 5/6 pattern).
- `app/api/cron/send-reminders/route.ts` (~230 LOC) — GET handler with Bearer auth, scan, per-row CAS claim with atomic token rotation, audit-log insert, after()-driven email batch, JSON response.
- `vercel.json` (~9 LOC) — Daily cron declaration.
- `tests/reminder-cron.test.ts` (~280 LOC) — 8 integration cases.
- `tests/reminder-email-content.test.ts` (~155 LOC) — 6 content-quality cases.

### Modified (1 file)
- `app/api/bookings/route.ts` — Added imports for `generateRawToken`, `hashToken`, `sendReminderBooker`. Added new step "8b" (~110 LOC) between the existing 08-02 `after(() => sendBookingEmails(...))` block and the 201 return: 24h-window check → CAS claim with token rotation → audit log insert → enriched data fetch → second `after()` shipping the immediate reminder. 08-03's rate-limit guard at the top of POST handler is preserved untouched. 08-02's `after(() => sendBookingEmails(...))` block is preserved untouched.

## Decisions Made

### Token-rotation strategy
Cron and immediate-send paths both generate fresh raw cancel + reschedule tokens, hash them, and write the hashes in the SAME UPDATE that claims `reminder_sent_at`. Three implications:

1. **Atomicity** — claim and rotation can't desync. If claim succeeds, the new tokens are already stored; if claim fails (CAS guard), nothing changes.
2. **Original confirmation tokens invalidated** — The Phase 5 confirmation email's lifecycle links stop working as soon as the reminder ships. Trade-off: bookings that need to use confirmation-email tokens (cancel/reschedule from the original confirmation) have a window of ~24h before the reminder fires. After the reminder fires, only the reminder's links work. RESEARCH Open Q 3 chose this for simplicity (single canonical "current" link per booking).
3. **Mailbox storage of stale tokens is harmless** — A booker could click the confirmation-email cancel link days after the reminder fired; they'd hit `/cancel/[token]` → resolver returns `state: 'not_active'` → friendly "no longer active" page (the same flow used today for bookings already cancelled). No 404, no 500.

### lib/booking-tokens.ts as a facade (not a divergent impl)
The plan's example showed `node:crypto.randomBytes(32).toString("base64url")` for `generateRawToken` and `node:crypto.createHash("sha256")` for `hashToken`. Both would have **broken every existing token verification path** (cancel route, reschedule route, owner cancel server action). The existing tokens are UUIDs hashed via Web Crypto `crypto.subtle.digest("SHA-256", ...)`. The two implementations produce different hash outputs from the same input.

Resolution: `lib/booking-tokens.ts` re-exports the existing canonical `hashToken` from `lib/bookings/tokens.ts` and adds a single-token `generateRawToken()` that returns `crypto.randomUUID()`. Same format. Same hash. Existing verification untouched. The facade module satisfies the plan's "shared helper module" intent without divergent semantics.

### Cron schedule (Hobby-tier rationale)
- Vercel Hobby plan only deploys daily cron schedules (verified via Plan 08 RESEARCH Pitfall 1).
- Schedule: `0 8 * * *` = daily 08:00 UTC = 03:00 America/Chicago (NSI timezone). Far enough into the morning that bookings at 08:00 local get a useful reminder; far enough before business hours that the worker isn't competing with peak booking traffic.
- Plan 08-08 will configure cron-job.org as an hourly external driver (free tier supports per-minute schedules). The cron-job.org webhook will pass the SAME `Authorization: Bearer ${CRON_SECRET}`.
- The CAS claim on `reminder_sent_at IS NULL` makes simultaneous Vercel-daily + cron-job.org-hourly invocation safe: the first tick claims, every subsequent tick within the 24h window for the same booking is a no-op.
- If Andrew upgrades to Vercel Pro tier (08-08 will confirm), the schedule can swap to `0 * * * *` (hourly) and the cron-job.org driver becomes redundant.

### Claim query shape
Single SELECT pulls all fields the email sender needs (booking row + event_type via `!inner` join + account with toggles via `!inner` join), then a per-row UPDATE with the CAS guard. Per-row not batched because:

1. Each booking needs its own fresh token pair (can't share rotated tokens across rows).
2. The CAS guard `WHERE reminder_sent_at IS NULL` semantics work cleanly per-row (`.maybeSingle()` returns null on miss; the loop just `continue`s).
3. Volume is low (~dozens/day max for v1); the round-trip cost is negligible.

If volume grows past low hundreds/day, batching into chunks of N parallel UPDATEs is a straightforward optimization (out of scope here).

### booking_events audit insert shape
Required columns (per `20260419120000_initial_schema.sql`):
- `booking_id` — the booking
- `account_id` — denormalized for RLS owners-read policy (NOT NULL)
- `event_type` — `booking_event_kind` enum, value `reminder_sent` (already in the enum from initial schema)
- `actor` — `booking_actor` enum, value `system` (cron is system-initiated)
- `metadata` — `{source: 'cron'}` for cron route, `{source: 'immediate'}` for the booking-route hook. Lets future ops queries distinguish the two paths.

The plan's example omitted `account_id` and `actor`. Both are NOT NULL — adding them was required for the insert to succeed.

### Failure handling (do NOT clear reminder_sent_at on send failure)
RESEARCH Pitfall 4. If the email send fails (SMTP timeout, Gmail rate limit, etc.), do NOT clear `reminder_sent_at` — the next cron tick would re-send and continue retrying indefinitely (= retry spam to the booker if the failure is transient and resolves on the second send). Acceptable trade-off for v1: a failed send means no reminder for that booking. Manual remediation deferred to dashboard UI (Phase 8 Plan 08-07 surfaces booking detail; future work could add a "Resend reminder" action).

### Test architecture choices
- **Real Supabase project for cron tests** — Mirrors Phase 6 cancel-reschedule-api.test.ts pattern. The `reminder_sent_at` claim is a critical race-safety guard; mocking the DB would defeat the purpose. Cleanup via `afterAll` deletes inserted bookings; `booking_events` rows cascade via FK ON DELETE CASCADE.
- **Mocked email-sender for content tests** — `tests/reminder-email-content.test.ts` doesn't need DB; it just calls `sendReminderBooker` directly with fixture args and inspects `__mockSendCalls`. Six toggle-permutation cases catch the most common content regressions.
- **after() shim from 08-02** — Vitest's `next/server` mock fires `after()` callbacks as microtasks; the existing 100-200ms drain wait pattern from Phase 5/6 tests works as-is. Cron tests inherit this for free.

## Test Outcomes

| Suite | Cases | Status |
|-------|-------|--------|
| `tests/reminder-email-content.test.ts` | 6 | All pass |
| `tests/reminder-cron.test.ts` | 8 | All pass |
| Pre-existing 10 test files | 83 | All still green |
| **Total** | **97** | **97/97 green** |

### Content-quality assertions (all 6 cases pass)
1. All toggles ON: hrefs well-formed, text alt non-empty, logo present, subject not spammy, all conditional sections render
2. All toggles OFF: location / custom answers / lifecycle CTAs all omitted; core booking details still present
3. Mixed toggles (only location off): selective omission proven
4. No logo_url: `<img>` tag omitted entirely (no broken-image placeholder)
5. Empty answers `{}` with toggle on: section omitted (no empty table)
6. Whitespace-only location with toggle on: section omitted (no empty Location: header)

### Cron integration assertions (all 8 cases pass)
1. No Bearer header → 401 + Cache-Control: no-store
2. Wrong Bearer secret → 401
3. Valid Bearer + empty window → 200 with scanned/claimed counts
4. In-window booking: reminder_sent_at populated, status unchanged, both token hashes rotated, email sent, audit row inserted with actor='system'
5. Idempotency: second invocation does NOT re-claim; reminder_sent_at + tokens unchanged; no duplicate email; audit log still has exactly one row for the booking
6. Window boundary: booking 25h out is NOT claimed
7. Past booking: NOT claimed
8. Cancelled booking inside window: NOT claimed

## Deviations from Plan

### Deviation 1 (Rule 1 — bug prevention) — booking-tokens facade vs divergent impl
**Found during:** Task 1 design phase
**Issue:** The plan's example `lib/booking-tokens.ts` used `node:crypto` (`randomBytes(32).toString("base64url")` + `createHash("sha256")`). The existing `lib/bookings/tokens.ts` uses Web Crypto (`crypto.randomUUID()` + `subtle.digest("SHA-256", ...)`). Different raw-token format AND different hash function. Implementing the plan literally would have created two parallel token systems where cron-rotated tokens couldn't be verified by any of the existing cancel/reschedule resolvers.
**Fix:** Made `lib/booking-tokens.ts` a thin facade — re-exports `hashToken` from the canonical Phase 5 module and adds a single-token `generateRawToken()` returning `crypto.randomUUID()` (same format). Single source of truth preserved.
**Files modified:** `lib/booking-tokens.ts` (deviation embedded in initial implementation; never wrote the broken version)
**Commit:** `dc2ccd4`

### Deviation 2 (Rule 1 — bug prevention) — async hashToken
**Found during:** Task 1 design phase
**Issue:** The plan's example `hashToken` was synchronous. The existing canonical `hashToken` is async (`crypto.subtle.digest` returns a Promise). Calling `hashToken(rawCancel)` (no await) would return a Promise object that gets `.toString()`'d into something like `"[object Promise]"` and stored in the DB. Verification would always fail.
**Fix:** Kept `hashToken` async (it's re-exported, so the type signature is the canonical one). Cron route and bookings route both `await hashToken(...)`.
**Files modified:** `app/api/cron/send-reminders/route.ts`, `app/api/bookings/route.ts` (both correctly await from initial implementation)
**Commit:** `0548ce7`, `a4ba982`

### Deviation 3 (Rule 1 — bug prevention) — booking_events insert columns
**Found during:** Task 2 implementation
**Issue:** The plan's example `booking_events` insert was `{booking_id, event_type, occurred_at, metadata}`. The actual schema (`20260419120000_initial_schema.sql` line 114-122) requires `account_id` (NOT NULL, denormalized for RLS) AND `actor` (NOT NULL, `booking_actor` enum). The plan's example would have failed insert with a NOT NULL violation.
**Fix:** Added `account_id` (selected from booking row) and `actor: 'system'` to both inserts (cron + immediate-send). `occurred_at` defaults to `now()` per the schema; omitted from insert payload (Postgres default fills it).
**Files modified:** `app/api/cron/send-reminders/route.ts`, `app/api/bookings/route.ts`
**Commit:** `0548ce7`, `a4ba982`

### Deviation 4 (clarification, not a fix) — email-sender mock not modified
**Found during:** Task 1 Step D
**Issue:** The plan asked to "update `tests/__mocks__/email-sender.ts` to include a `sendReminderBooker` named export". But `sendReminderBooker` lives in `lib/email/send-reminder-booker.ts`, NOT in `lib/email-sender`. The mock at `tests/__mocks__/email-sender.ts` only intercepts the LOW-LEVEL `sendEmail` call from `lib/email-sender`. Since `sendReminderBooker` calls `sendEmail` internally, the existing mock already captures all its output via `__mockSendCalls` — no change needed.
**Resolution:** Left `tests/__mocks__/email-sender.ts` untouched. Tests assert on `__mockSendCalls[i].subject / .html / .text` — same pattern Phase 5/6 use.
**Files modified:** none (this is a no-op clarification)

### Deviation 5 (housekeeping) — added CRON_SECRET to .env.local
**Found during:** Task 2 implementation
**Issue:** No CRON_SECRET existed in `.env.local`. Tests need it; production cron in Vercel needs it.
**Fix:** Added a placeholder secret (`test-cron-secret-do-not-use-in-prod-...`) with inline comment explaining how to rotate via `openssl rand -hex 32` and where to set it in Vercel. `.env.local` is gitignored so the placeholder doesn't leak. Plan 08-08 will document the production-rotation procedure as part of the ops checkpoint.
**Files modified:** `.env.local` (gitignored — not committed)

### Deviation 6 (clarification) — `npm run build` skipped per orchestrator instruction
The plan's `<verify>` block listed `npm run build` as a check. The spawning orchestrator explicitly instructed "Do NOT run npm run build". Honored the orchestrator instruction; relied on `npx tsc --noEmit` (clean for the new files) + `npm test` (97/97 green) as the verification floor. Build verification deferred to Plan 08-08 / Phase 9 manual QA.

## Carried Concerns / Forward Notes

- **Production CRON_SECRET rotation** — Andrew must set a real secret in Vercel project env (Production scope) before the live cron fires for the first time. Plan 08-08 will include this as a checklist item alongside the cron-job.org configuration.
- **cron-job.org hourly driver** — Configure in 08-08; webhook URL = `https://calendar-app-xi-smoky.vercel.app/api/cron/send-reminders` (or final domain), header `Authorization: Bearer ${CRON_SECRET}`.
- **Mail-tester live verification** — Plan 08-08 manual checkpoint. The automated content-quality test catches broken hrefs / missing text alt / spammy subjects in CI; the manual mail-tester step verifies SPF/DKIM/DMARC pass on Gmail SMTP.
- **Reminder retry/resend UI** — Out of scope for v1. If a send fails, the booking gets no reminder (RESEARCH Pitfall 4: clearing reminder_sent_at would cause retry spam). Future dashboard work could add a "Resend reminder" action on the booking detail page (08-07 surfaces the detail page).
- **Pro-tier upgrade swap** — When Andrew confirms tier in 08-08, the vercel.json schedule can swap from `0 8 * * *` to `0 * * * *` (hourly) and the cron-job.org driver becomes redundant.
- **booking_events `actor` column for cron path** — Used `'system'` (one of the three enum values). Future analytics can filter `actor='system'` to count cron-driven sends vs `actor='booker'`/`'owner'` for human-driven cancel/reschedule events.

## Next Plan Readiness

Plan 08-04 unblocks **Plan 08-08 (RLS matrix + ops hardening)** which depends on the cron route existing before the operational checkpoints (CRON_SECRET in Vercel env, cron-job.org hourly driver, mail-tester live run).

Plans 08-05 / 08-06 / 08-07 (other Wave 2 plans — settings UI, dashboard list, bookings detail) are independent of this plan's deliverables and can run in parallel.
