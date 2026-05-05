---
phase: 31-email-hard-cap-guard
plan: 03
subsystem: ui
tags: [react, server-actions, supabase, vitest, alertdialog, sonner, gmail-quota]

# Dependency graph
requires:
  - phase: 31-email-hard-cap-guard
    provides: "checkAndConsumeQuota over 7 booking categories; QuotaExceededError; emailFailed signals on cancel/reschedule lib; errorCode EMAIL_QUOTA_EXCEEDED on manual reminder action; bookings.confirmation_email_sent partial index"
provides:
  - "Inline owner error UX in Send Reminder AlertDialog footer (NEVER toast, per locked CONTEXT)"
  - "Differentiated cancel-button success toast (locked verbatim quota copy + non-quota send fallback)"
  - "/app/bookings dashboard banner — self-suppressing, only renders when count > 0"
  - "countUnsentConfirmations(accountId) helper backed by Plan 31-01 partial index"
  - "Phase 31 test suite: 7-category × allow/refuse matrix + getRemainingDailyQuota + PII-free logQuotaRefusal + cron continue-on-refuse"
  - "Regression test for the 80% GMAIL_SMTP_QUOTA_APPROACHING warn block (uses fake timers to bypass warnedDays day-cache)"
affects: ["32-auto-cancel", "33-pushback", "future quota-resilient owner UX"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline AlertDialog error rendering for action-specific failures (vs global toast) when the user needs to read the error before dismissing"
    - "Self-suppressing dashboard banner — error-only, no always-visible widget; locks the principle that 'no signal' is a valid UX state"
    - "Plan-31 EmailCategory iteration constant `PHASE_31_CATEGORIES` — adding/removing a category requires editing the test list (regression-proof)"

key-files:
  created:
    - "app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx"
    - "tests/email-quota-refuse.test.ts"
  modified:
    - "app/(shell)/app/_components/day-detail-row.tsx"
    - "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx"
    - "app/(shell)/app/bookings/[id]/_lib/actions.ts"
    - "app/(shell)/app/bookings/_lib/queries.ts"
    - "app/(shell)/app/bookings/page.tsx"
    - "tests/quota-guard.test.ts"

key-decisions:
  - "Day-detail-row reminder dialog reads result.errorCode === 'EMAIL_QUOTA_EXCEEDED' and renders inline (NOT toast); reset on every dialog open-change"
  - "Cancel-button differentiates THREE success copies: 'quota' (locked verbatim), 'send' (non-quota fallback), default (both parties notified)"
  - "actions.ts CancelBookingAsOwnerResult extended with optional emailFailed?: 'quota' | 'send' to propagate cancelBooking lib's signal up to the UI"
  - "Page resolves accountId via canonical inline accounts lookup (matches load-month-bookings.ts) then passes to countUnsentConfirmations — defense in depth on top of RLS"
  - "Banner returns null when count <= 0 — error-only, NO quota counter, NO 80% banner, NO always-visible widget (locked CONTEXT)"
  - "Tests use vi.setSystemTime to bypass the module-level warnedDays day-cache so the 80% warn regression test can fire even after test #2 already cached today"

patterns-established:
  - "Action-specific inline error: when the user needs to read the error in context (Send button), render inside the dialog footer, not via toast"
  - "Differentiated success toast on partial-success operations: when the primary action succeeded but a secondary leg (email) failed, the toast names the secondary failure mode without rolling back the primary"

# Metrics
duration: 60min
completed: 2026-05-05
---

# Phase 31 Plan 03: Owner UX + Test Coverage Summary

**Inline reminder-dialog quota error, differentiated cancel toast, self-suppressing /app/bookings unsent-confirmations banner, and a 21-test refuse-send suite covering all 7 Phase 31 EmailCategory values + PII-free log shape + cron continue-on-refuse pattern.**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-05-05T02:21:00Z (approx)
- **Completed:** 2026-05-05T03:21:30Z
- **Tasks:** 3
- **Files modified:** 6 (2 new, 4 modified)

## Accomplishments

- Owner-triggered reminder failures at the daily Gmail SMTP cap now surface as an inline alert in the Send Reminder AlertDialog footer (never a toast), so the owner reads the Gmail-fallback hint without dismissing the dialog.
- Owner-triggered cancels now toast a differentiated success message naming the email failure mode ("quota" with locked Gmail-fallback wording, "send" with generic fallback, or default both-parties-notified) — booking is cancelled identically in all three paths.
- `/app/bookings` renders an amber alert banner above the filters/table when one or more bookings have `confirmation_email_sent=false`, with the literal "Use Gmail to notify these bookers manually" hint and UTC-midnight reset note. The banner self-suppresses when count is 0 — no always-visible widget, per locked CONTEXT.
- New `countUnsentConfirmations(accountId)` query helper exercises the partial index `bookings_confirmation_email_unsent_idx` (Plan 31-01) — keeps the dashboard query cheap at high booking volume.
- New `tests/email-quota-refuse.test.ts` (21 tests) proves all 7 new EmailCategory values are accepted by `checkAndConsumeQuota` and refused at cap; `getRemainingDailyQuota` returns the clamped remainder; `logQuotaRefusal` writes exactly 5 PII-free fields with negative assertions on `booker_email` / `booker_name` / `booker_phone` / `ip` / `answers`; the cron-loop continue-on-refuse pattern swallows `QuotaExceededError` per booking but re-throws non-quota errors.
- Added regression test #5 to `tests/quota-guard.test.ts` confirming the 80% `GMAIL_SMTP_QUOTA_APPROACHING` warn block still fires for the new `booking-confirmation` category after Plan 31-01 edits — uses `vi.setSystemTime` to bypass the module-level `warnedDays` Set day-cache populated by test #2.

## Task Commits

Each task was committed atomically:

1. **Task 1: Inline reminder error + differentiated cancel toast** — `38f5688` (feat)
2. **Task 2: Unsent-confirmations dashboard banner + count query** — `0dc55e5` (feat)
3. **Task 3: Refuse-send test coverage + 80% warn regression** — `2f53f7e` (test)

**Plan metadata:** appended at session close (docs commit)

## Files Created/Modified

- `app/(shell)/app/_components/day-detail-row.tsx` — added `reminderError` state, branched `handleReminderConfirm` on `errorCode === "EMAIL_QUOTA_EXCEEDED"`, render inline error in dialog footer with `data-testid="reminder-quota-error"`, reset on `onOpenChange`.
- `app/(shell)/app/bookings/[id]/_components/cancel-button.tsx` — branched success path on `result.emailFailed`; locked verbatim quota toast; non-quota "send" fallback toast; default success copy unchanged.
- `app/(shell)/app/bookings/[id]/_lib/actions.ts` — extended `CancelBookingAsOwnerResult` with optional `emailFailed?: "quota" | "send"`; propagates `result.emailFailed` from `cancelBooking` lib.
- `app/(shell)/app/bookings/_lib/queries.ts` — added `countUnsentConfirmations(accountId)`; uses `count: "exact", head: true`; returns 0 on error with structured `[BOOKINGS_QUERY_FAILED]` log.
- `app/(shell)/app/bookings/page.tsx` — resolves `accountId` via canonical inline accounts lookup; fetches `countUnsentConfirmations` alongside `queryBookings` + `listEventTypesForFilter`; renders `<UnsentConfirmationsBanner count={unsentCount} />` above the filters/table.
- `app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx` (new) — server component; returns null when `count <= 0`; copy contains literal "Use Gmail to notify these bookers manually" + UTC-midnight reset note; `data-testid="unsent-confirmations-banner"`; amber Tailwind palette.
- `tests/email-quota-refuse.test.ts` (new) — 14 tests for the 7-category × allow/refuse matrix, 3 for `getRemainingDailyQuota`, 2 for `logQuotaRefusal` PII-free shape (with exact-key-set assertion + null-account_id signup case), 2 for cron-loop continue-on-refuse (one positive, one re-throw).
- `tests/quota-guard.test.ts` — added regression test #5 (80% warn fires for booking-confirmation; uses `vi.setSystemTime` to bypass `warnedDays` cache).

## Decisions Made

- **Banner placement above `BookingsFilters` (not `BookingsTable`):** the page is a `flex flex-col gap-6` container; placing the banner above the filters means it appears immediately under the page header, where the owner's eye lands first. Plan said "directly above the existing filters / table markup" — first-render position matches.
- **`actions.ts` return-type extension was in scope:** the plan asked the cancel-button to branch on `result.emailFailed`, but the action wrapper was returning only `{ ok: true } | { error }`. Extending the action's union to propagate the lib's `emailFailed` field was Rule 2 (missing critical for the differentiated toast to function). One-line edit, captured in Task 1's commit.
- **`vi.setSystemTime` in the new quota-guard regression test:** the existing 80% warn block dedupes via a module-level `warnedDays` Set keyed by UTC-day. Test #2 already populates that Set with "today", so test #5 needed a different "today" to fire. Forcing a future date via fake timers is the cheapest fix and doesn't pollute the other tests (try/finally resets timers).
- **Banner copy:** included both the locked "Use Gmail to notify these bookers manually" phrase and a UTC-midnight reset note. The plan requirement was the literal Gmail-fallback hint; the reset hint is additive context that mirrors the manual-reminder action's error string (consistency across owner-facing surfaces).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Extended `CancelBookingAsOwnerResult` to propagate `emailFailed`**

- **Found during:** Task 1 (cancel-button.tsx work)
- **Issue:** The plan's Task 1B asked the cancel-button to branch on `result.emailFailed`, but `cancelBookingAsOwner` in `actions.ts` was returning only `{ ok: true } | { error: string }`. Without propagating the lib's `emailFailed` signal up through the action, the differentiated toast had no input to switch on.
- **Fix:** Extended the success branch of `CancelBookingAsOwnerResult` to include optional `emailFailed?: "quota" | "send"` and propagated `result.emailFailed` from `cancelBooking` (Plan 31-02 lib output). One short edit in actions.ts.
- **Files modified:** `app/(shell)/app/bookings/[id]/_lib/actions.ts`
- **Verification:** `npx tsc --noEmit` clean (no new errors over the 35 pre-existing test-mock errors); cancel-button now compiles against the new return type.
- **Committed in:** `38f5688` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical)
**Impact on plan:** Required for the Task 1B success criterion to function. Zero scope creep — the field flows from a Plan 31-02 lib output that the action was already calling but not surfacing.

## Issues Encountered

- **8 pre-existing test files fail with `@/lib/email-sender` mock-helper imports** — these are the unchanged broken test files documented in STATE.md (under "Open tech debt"). Verified by stashing my changes and re-running the same files: same failures. Not caused by Phase 31 work, not in scope to fix here. Tracked already.
- The `warnedDays` day-cache caused test #5 to silently no-op until I added `vi.setSystemTime` — typical "first run pollutes module-level state" pattern, resolved with try/finally fake timers.

## User Setup Required

None — all changes are application-code only. No env vars, no dashboard config, no migrations.

## Next Phase Readiness

- Phase 31 is now feature-complete pending verifier sign-off:
  - Plan 31-01: schema foundation (DONE)
  - Plan 31-02: sender wiring + caller routing (DONE)
  - Plan 31-03: owner UX + test coverage (DONE)
- Phase 32 (auto-cancel) and Phase 33 (pushback) can now consume:
  - `getRemainingDailyQuota()` for batch pre-flight (already exported, now test-covered).
  - `confirmation_email_sent=false` save-and-flag pattern as a precedent for analogous "save-and-flag" surfaces (auto-cancel banner, pushback banner if needed).
  - Inline-error UX pattern for action-specific failures (manual-reminder dialog precedent).
- No blockers. Pre-existing test-mock breakage is unrelated tech debt — Phase 31 did not introduce or worsen it.

---
*Phase: 31-email-hard-cap-guard*
*Completed: 2026-05-05*
