---
phase: 32-inverse-date-overrides
plan: 03
subsystem: api
tags: [server-action, supabase, zod, vitest, quota-guard, cancel-lifecycle, race-safety]

# Dependency graph
requires:
  - phase: 31-email-hard-cap-guard
    provides: getRemainingDailyQuota() pre-flight gate
  - phase: 32-inverse-date-overrides (Plan 32-01)
    provides: Slot engine MINUS semantics + clean date_overrides table
  - phase: 06-cancel-and-reschedule
    provides: cancelBooking() shared lifecycle (audit row, .ics CANCEL, booker email)
provides:
  - skipOwnerEmail flag on cancelBooking() to gate the owner notification leg
  - getAffectedBookings() query helper (TZ-aware JS-side window filter)
  - commitInverseOverrideAction() server action with HARD quota pre-flight + batch cancel
  - vitest resolve.alias fix (string-prefix → exact regex) — unblocks 5+ pre-existing broken test files
affects: [32-02-override-editor-ui, 33-day-of-pushback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server action HARD quota gate: getRemainingDailyQuota() refuses with structured quotaError BEFORE any DB writes or sends"
    - "Race-safe batch commit: write side-effect rows (overrides) → re-query affected → union with preview IDs → batch via Promise.allSettled"
    - "Owner-initiated batch cancel: skipOwnerEmail=true suppresses N duplicate owner notifications (booker leg always fires, LD-07)"
    - "Vitest resolve.alias array-with-regex form for exact-match (no prefix bleed)"

key-files:
  created:
    - "app/(shell)/app/availability/_lib/actions-batch-cancel.ts"
    - "tests/inverse-override-batch-cancel.test.ts"
  modified:
    - "lib/bookings/cancel.ts"
    - "lib/email/send-cancel-emails.ts"
    - "app/(shell)/app/availability/_lib/queries.ts"
    - "app/(shell)/app/availability/_lib/schema.ts"
    - "vitest.config.ts"

key-decisions:
  - "Quota math: needed = affectedBookingIds.length (matches skipOwnerEmail=true behavior — booker leg only)"
  - "Race-safety via post-write re-query + union with preview IDs (no booking missed even if commit-window race occurred)"
  - "Discriminated-union schema (isFullDayBlock=true → no windows; false → ≥1 non-overlapping windows) cleanly separates the two save shapes"
  - "Used SupabaseLike type alias in queries.ts so getAffectedBookings accepts BOTH the RLS server client AND the admin client (single signature, two callsites)"
  - "Vitest alias migrated from string-prefix to array+regex (find/replacement) form — fixes pre-existing alias-bleed bug that masked module-resolution failures in 5+ broken test files"

patterns-established:
  - "Owner-initiated batch cancels suppress per-booking owner emails via skipOwnerEmail; booker leg unconditional"
  - "HARD quota pre-flight is the FIRST step after auth + validation in any batch send path"
  - "delete-all-for-date + insert is the canonical override-row write pattern (matches upsertDateOverrideAction)"

# Metrics
duration: 10 min
completed: 2026-05-05
---

# Phase 32 Plan 03: Inverse Date Overrides — Server Actions + Batch Cancel Summary

**Server-side surface for the inverse-override editor: `commitInverseOverrideAction` performs HARD quota pre-flight, atomic override write, race-safe re-query, and Promise.allSettled batch cancel via the existing single-cancel lifecycle with `skipOwnerEmail=true`.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-05T23:16:49Z
- **Completed:** 2026-05-05T23:26:53Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 edited)

## Accomplishments

- `skipOwnerEmail` flag added to `CancelBookingArgs` and plumbed through `sendCancelEmails` via a new `sendOwner?: boolean` (default true). Existing single-cancel callers untouched; batch-initiated callers (this plan + future Phase 33 pushback if it reuses the pattern) can suppress N duplicate owner notifications.
- `getAffectedBookings()` query helper exported from `availability/_lib/queries.ts`. Uses widened-UTC + JS-side TZDate filter to handle DST edges; returns `AffectedBooking[]` sorted chronologically. Reusable from both the editor UI (Plan 32-02 preview) and the server action's race-safe re-query.
- `commitInverseOverrideAction()` server action with full lifecycle:
  1. Zod discriminated-union validation (full-day block vs. windows path)
  2. HARD quota gate via `getRemainingDailyQuota()` returning `{ ok: false, quotaError: true, needed, remaining }` if `needed > remaining` — NO writes, NO sends
  3. Override write (delete-all-for-date + insert) matching `upsertDateOverrideAction`
  4. Post-write race-safe re-query → union with preview IDs
  5. `Promise.allSettled` batch over `cancelBooking({ ..., skipOwnerEmail: true, actor: "owner" })`
  6. `revalidatePath` on `/app/availability` + `/app/bookings`
- 9 unit tests covering quota refusal, successful batch, default-reason fallback, race-safe re-query union, email-failure surface (both `emailFailed: "send"` and rejected-promise paths), full-day block path, and Zod input validation (overlap + malformed date).
- Vitest `resolve.alias` migrated from object/string-prefix form to array/regex form. The previous `"@/lib/email-sender": ...` was a prefix replacement, so `@/lib/email-sender/quota-guard` was being rewritten to `tests/__mocks__/email-sender.ts/quota-guard` — every test that touched code importing the quota guard failed at module-resolution. Net result: 30 of 31 test files now pass (was 24 of 31 before this plan).

## Task Commits

1. **Task 1: skipOwnerEmail flag on cancelBooking + getAffectedBookings query** — `a001b0a` (feat)
2. **Task 2: commitInverseOverrideAction server action with quota pre-flight** — `73c32ed` (feat)
3. **Task 3: Tests for batch cancel + vitest alias fix** — `d05dd88` (test)

**Plan metadata:** *(appended at session close)*

## Files Created/Modified

- `app/(shell)/app/availability/_lib/actions-batch-cancel.ts` — **created**. The single server-side entry point for inverse-override commits. Exports `commitInverseOverrideAction` and the `CommitOverrideResult` discriminated-union return type.
- `tests/inverse-override-batch-cancel.test.ts` — **created**. 9 tests across 6 describe blocks covering quota, batch, race-safety, email failures, full-day path, and validation.
- `lib/bookings/cancel.ts` — added optional `skipOwnerEmail?: boolean` to `CancelBookingArgs`; destructured in body and forwarded as `sendOwner: !skipOwnerEmail` to `sendCancelEmails`.
- `lib/email/send-cancel-emails.ts` — added optional `sendOwner?: boolean` (default true) to `SendCancelEmailsArgs`; gates the owner leg when explicitly false. Booker leg unconditional (LD-07 preserved).
- `app/(shell)/app/availability/_lib/queries.ts` — added `AffectedBooking` interface, `getAffectedBookings()` helper, and a `SupabaseLike` type alias accepting both the RLS server client and the admin client.
- `app/(shell)/app/availability/_lib/schema.ts` — exported `findOverlap` (was internal) so the new server-action schema can refine on it.
- `vitest.config.ts` — `resolve.alias` migrated from object form to array form with explicit regex `find` for `@/lib/email-sender` (exact match) — see Deviations below.

## Decisions Made

- **`needed = affectedBookingIds.length`** (NOT 2N). With `skipOwnerEmail: true` each `cancelBooking()` sends exactly 1 email (booker leg only), so the quota math matches the actual send count. Documented inline in the action source.
- **Race-safety pattern: union of preview IDs and post-write re-query results.** Even if a booking COMMITS during the brief window between override-row insert and re-query, the preview IDs (already approved by the owner) ensure no booking is missed. The re-query catches any booking that snuck in between the UI preview and commit. Re-query failure logs but does not abort — preview IDs alone are still authoritative.
- **`SupabaseLike` type in queries.ts** matches the shape returned by both `createClient()` (RLS-scoped) and `createAdminClient()` (service role). Both expose the same `.from(...).select(...)` chain at the call sites we need, so a single signature covers both consumers.
- **Discriminated-union zod schema for `commitInverseOverrideAction` input.** `isFullDayBlock=true` accepts no windows; `isFullDayBlock=false` requires ≥1 non-overlapping windows (refined via the now-exported `findOverlap` from schema.ts). Caller errors are surfaced as `formError` via the existing result shape; quota refusal uses the dedicated `quotaError: true` discriminant.
- **`emailFailed` propagation:** when `cancelBooking()` returns `{ ok: true, emailFailed: "quota" | "send" }` the booking is still counted in `cancelledCount` (the DB row flipped — that's what matters); the failure is surfaced separately in `emailFailures` so the UI can show a "cancelled but email didn't send" notice without claiming the cancel itself failed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest `resolve.alias` was a string-prefix match — broke `@/lib/email-sender/quota-guard` resolution**

- **Found during:** Task 3 (running the new test file)
- **Issue:** The previous `"@/lib/email-sender": path.resolve(...)` alias was a string-prefix replacement. When the production source `actions-batch-cancel.ts` imported `from "@/lib/email-sender/quota-guard"`, vite rewrote the path to `tests/__mocks__/email-sender.ts/quota-guard` and module resolution failed. The error blocked the new test from loading. Stashing my changes and re-running the pre-existing `tests/cancel-reschedule-api.test.ts` reproduced the same error — confirming this is a long-standing bug that was masking itself behind already-broken test-mock files (those listed in STATE.md tech debt).
- **Fix:** Migrated `resolve.alias` from object form to array form with `find: /^@\/lib\/email-sender$/` (exact regex match). The bare specifier `@/lib/email-sender` still routes to the mock; sub-paths like `@/lib/email-sender/quota-guard` and `@/lib/email-sender/types` now pass through to the tsconfig path resolver as intended.
- **Files modified:** `vitest.config.ts`
- **Verification:**
  - New test file: `npx vitest run tests/inverse-override-batch-cancel.test.ts` → **9 pass / 9**
  - Phase 31 quota tests: `npx vitest run tests/quota-guard.test.ts tests/email-quota-refuse.test.ts` → **26 pass / 26**
  - Full suite: **30 of 31 test files pass / 275 of 285 tests pass / 9 skipped / 1 fail.** The one remaining failure (`tests/bookings-api.test.ts > "(a) 201 returns bookingId..."`) is a pre-existing fixture issue (mock-call-count assertion against the production code that now goes through the quota guard) — confirmed unrelated by stashing my changes (pre-stash that file failed to even import).
- **Commit:** `d05dd88` (Task 3 commit; commit body explicitly tags this as a Rule 3 deviation)

**2. [Rule 3 - Blocking] Exported `findOverlap` from `schema.ts`**

- **Found during:** Task 2 (defining the new schema)
- **Issue:** The new `commitInverseOverrideAction` input schema needs the same overlap-detection helper that the existing `weeklyRulesSchema` and `dateOverrideSchema` use, but `findOverlap` was a module-internal function.
- **Fix:** Added `export` keyword. No behavior change for existing consumers.
- **Files modified:** `app/(shell)/app/availability/_lib/schema.ts`
- **Verification:** TypeScript clean; existing `weeklyRulesSchema` / `dateOverrideSchema` superRefines still resolve the local reference (export does not change in-file resolution).
- **Commit:** `73c32ed` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking)
**Impact on plan:** Both deviations were blocking — without them Task 3 couldn't even load the test file, and Task 2's schema couldn't refine on overlap. The vitest alias fix is also a positive side effect: it unblocks 5+ pre-existing broken test files, raising the green-test-file count from 24/31 to 30/31. No scope creep.

## Issues Encountered

- **Initial UUID test fixtures were not RFC-4122-compliant.** Used patterns like `11111111-1111-1111-1111-111111111111` which lack the `4` (version) and `8/9/a/b` (variant) bits zod's `.uuid()` validator requires. Updated all fixtures to canonical v4 shape (e.g. `11111111-1111-4111-8111-111111111111`). Caught by zod returning `formError: "Invalid UUID"` from the discriminated-union validation step. No code changes — test fixtures only.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 32-02 (override editor UI) is unblocked.** It can import:
  - `commitInverseOverrideAction` from `app/(shell)/app/availability/_lib/actions-batch-cancel`
  - `getAffectedBookings`, `AffectedBooking` from `app/(shell)/app/availability/_lib/queries`
  - `getRemainingDailyQuota` directly for live quota-budget UI feedback (the editor's "X needed, Y remaining today" indicator can show the projected refusal before the user clicks Save)
- **Phase 33 (pushback) can reuse the same pattern.** The `skipOwnerEmail` flag on `cancelBooking()` is symmetric with what a future `skipOwnerEmail` on `rescheduleBooking()` would need; this plan leaves a clean precedent. (Not implemented here — out of scope.)
- **Pre-existing tech debt unchanged:** the `02-VERIFICATION.md` working-tree drift is still uncommitted; the `bookings-api.test.ts` fixture mismatch (now visible because the alias fix lets the file load) remains as the lone failing test. STATE.md tech debt list to be carried forward.
- **No production deploy implication.** This plan adds server-side surface only; no DB migration; no email content change; LD-07 booker-neutrality preserved.

---
*Phase: 32-inverse-date-overrides*
*Completed: 2026-05-05*
