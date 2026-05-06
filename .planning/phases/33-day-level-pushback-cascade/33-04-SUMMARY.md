---
phase: 33-day-level-pushback-cascade
plan: 04
subsystem: ui
tags: [pushback, retry, server-action, email, quota-guard, useTransition, dialog]

# Dependency graph
requires:
  - phase: 33-day-level-pushback-cascade
    provides: "Plan 33-03: commitPushbackAction, CommitPushbackResultRow (5-variant status), commitRows dialog state, summary placeholder"
  - phase: 31-email-hard-cap-guard
    provides: "Plan 31-01: getRemainingDailyQuota quota guard; Plan 31-02: quota error UX vocabulary"
provides:
  - "retryPushbackEmailAction server action: fresh-token mint + sendOwner:false + Phase 31 quota guard"
  - "Summary state full render: per-row Sent/Failed/Conflict/Stale/Skipped badges + counts header"
  - "RetryEmailButton: per-row isolated useTransition, in-place badge mutation on success"
  - "Close button triggers router.refresh() so bookings page reflects new times"
  - "5-variant status taxonomy locked: only email_failed is retry-eligible"
affects:
  - "Phase 33 verifier: full 8-scenario E2E coverage confirmed live by Andrew"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fresh-token mint pattern for retry: generateBookingTokens + hashToken + UPDATE hashes + pass raw tokens to sender (mirrors sendReminderForBookingAction)"
    - "Per-row useTransition isolation: RetryEmailButton owns its own [pending, startTransition] pair; retry spinner scoped to one row"
    - "In-place badge mutation: setCommitRows(prev => prev.map(r => r.booking_id === id ? {...r, status:'sent'} : r))"
    - "router.refresh() on Close from terminal summary state — bookings page sees new start_at/end_at"

key-files:
  created: []
  modified:
    - app/(shell)/app/bookings/_lib/actions-pushback.ts
    - app/(shell)/app/bookings/_components/pushback-dialog.tsx

key-decisions:
  - "5-variant status taxonomy locked (sent/email_failed/slot_taken/not_active/skipped) — only email_failed is retry-eligible (RESEARCH.md Risk 7)"
  - "Phase 31 quota guard reused on retry path: getRemainingDailyQuota pre-flight + EMAIL_QUOTA_EXCEEDED catch branch"
  - "LD-07 booker-neutrality preserved on retry: sendOwner:false; owner already saw in-dialog summary"
  - "Per-row useTransition isolation: retry spinner does not block other rows or the Close button"
  - "oldEndAt placeholder set to input.oldStartAt in retryPushbackEmailAction — safe because sendOwner:false suppresses owner leg; booker email template reads only oldStartAt for the Was: field"

patterns-established:
  - "Retry-eligible gating: status === 'email_failed' only — slot_taken and not_active are non-retryable DB failures, not email failures"
  - "Per-row optimistic badge update: success mutates state in place without re-fetching the full commitRows list"

# Metrics
duration: ~15min
completed: 2026-05-05
---

# Phase 33 Plan 04: Summary Rendering + Email Retry Summary

**Per-row Sent/Failed/Conflict/Stale/Skipped badges in pushback dialog summary, retryPushbackEmailAction with fresh-token mint and quota guard, Close→router.refresh — 8/8 live scenarios approved by Andrew**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-05T21:18:31Z
- **Completed:** 2026-05-05T21:35:00Z
- **Tasks:** 3 (Tasks 1+2 auto; Task 3 human-verify checkpoint — approved)
- **Files modified:** 2

## Accomplishments

- Implemented `retryPushbackEmailAction` mirroring the `sendReminderForBookingAction` fresh-token pattern: mints new cancel + reschedule tokens, persists hashes via UPDATE, sends booker leg only (`sendOwner: false`), uses `input.oldStartAt` (not `booking.start_at`, which is now the new time) for the email's "Was:" line. Quota-gated via Phase 31 guard.
- Replaced the 33-03 JSON debug dump placeholder with a full summary render: counts header ("Pushback complete. N sent, M failed, ..."), scrollable per-row list with `StatusBadge` (5 variants) + booker name + old → new time in account timezone, `RetryEmailButton` on `email_failed` rows only, conflict/stale footer note, and `router.refresh()` on Close.
- Human-verified 8/8 scenarios live on Vercel (HEAD commit `6e93dda`): happy path, EOD overshoot, abort-on-diverge, email-failure retry, slot-conflict non-retryable badge, quota-gate at preview, reason text in email with LD-07 audience neutrality, per-day shortcut button.

## Task Commits

Each task was committed atomically:

1. **Task 1: retryPushbackEmailAction server action** - `fe4bc89` (feat)
2. **Task 2: Summary render + RetryEmailButton + Close→refresh** - `6e93dda` (feat)
3. **Task 3: Human-verify checkpoint** - approved (no code commit)

**Plan metadata:** (this commit)

## Files Created/Modified

- `app/(shell)/app/bookings/_lib/actions-pushback.ts` — `retryPushbackEmailAction(input: RetryPushbackEmailInput)` added: auth + account ownership check, `getRemainingDailyQuota` pre-flight (returns `quotaError: true` if < 1), booking re-fetch, `generateBookingTokens()` + `hashToken()` + UPDATE, `sendRescheduleEmails({ sendOwner: false, oldStartAt: input.oldStartAt, ... })`, `EMAIL_QUOTA_EXCEEDED` catch branch
- `app/(shell)/app/bookings/_components/pushback-dialog.tsx` — `StatusBadge` component (5 variants), `RetryEmailButton` with isolated `useTransition`, `markRowSent` in-place state mutator, full summary render block replacing JSON debug dump, `router.refresh()` on Close button

## Decisions Made

**1. 5-variant status taxonomy locked — only email_failed is retry-eligible**
`sent` / `email_failed` / `slot_taken` / `not_active` / `skipped` covers all result paths from `commitPushbackAction`. The `RetryEmailButton` renders exclusively on `status === 'email_failed'` rows. `slot_taken` and `not_active` are DB-layer rejections — the booking was not updated, so there is nothing to retry via email. Addresses RESEARCH.md Risk 7.

**2. Phase 31 quota guard plumbed through retry**
Pre-flight `getRemainingDailyQuota()` check before minting tokens (fast-fail before any write). `EMAIL_QUOTA_EXCEEDED` catch branch returns `{ ok: false, quotaError: true, remaining }` — distinct from generic send errors. Retry toast surfaces `"Quota exhausted (N remaining). Try again tomorrow."` for the quota-exhausted case.

**3. LD-07 preserved on retry: sendOwner:false**
The owner already saw the result in the dialog summary. Re-notifying the owner on retry would be a duplicate and violates the booker-neutrality intent. `sendOwner: false` on `sendRescheduleEmails()` matches the original commit batch behavior.

**4. Per-row useTransition isolation**
`RetryEmailButton` owns its own `[pending, startTransition]` pair. A spinning retry on row 3 does not disable the Close button or freeze rows 1-2. Each row is independently operable.

**5. oldEndAt placeholder = input.oldStartAt**
`retryPushbackEmailAction` needs an `oldEndAt` for the `sendRescheduleEmails` call signature, but the retry input only carries `oldStartAt`. Since `sendOwner: false` suppresses the owner leg entirely, and the booker email template reads only `oldStartAt` for the "Was:" field, passing `oldStartAt` as the `oldEndAt` placeholder is safe in current production. If the owner leg ever needs to fire from a retry path, `oldEndAt` must be threaded properly through the input.

## Deviations from Plan

**1. oldEndAt placeholder (plan did not specify)**
- **Found during:** Task 1 (`sendRescheduleEmails` call required both `oldStartAt` and `oldEndAt`)
- **Issue:** `retryPushbackEmailAction` input carries `oldStartAt` only; `oldEndAt` was not in the plan's `RetryPushbackEmailInput` shape. The `sendRescheduleEmails` signature requires it.
- **Fix:** Set `oldEndAt: input.oldStartAt` as a safe placeholder. Added inline comment explaining the reasoning and the future-proofing caveat.
- **Files modified:** `app/(shell)/app/bookings/_lib/actions-pushback.ts`
- **Committed in:** `fe4bc89`
- **Rule:** Rule 3 (blocking — TS error without supplying the field)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing oldEndAt field in call)
**Impact on plan:** Safe under current constraints (sendOwner:false suppresses owner leg). Documented as future-proofing nit.

## Issues Encountered

None beyond the deviation documented above.

## Human Verification Results

All 8 scenarios approved live by Andrew (Vercel deploy at HEAD `6e93dda`):

1. Happy path — 4-booking day, 15-min delay, gap-absorbed: all MOVE rows show Sent (green); ABSORBED shows Skipped (slate); owner received no duplicate notifications; Close refreshed bookings to new times.
2. EOD overshoot — PAST_EOD row committed and shows Sent (not Skipped); EOD behavior correct per PUSH-07.
3. Abort-on-diverge — concurrent cancellation mid-commit returns amber "Bookings on this date changed since preview" banner; no partial commit; dialog resets to editing with refreshed list.
4. Email failure → Retry → Sent: Failed (red) badge with Retry button appears for email_failed row; clicking Retry transitions badge to Sent (green) in place; toast confirms.
5. Slot conflict (slot_taken): Conflict (orange) badge renders; NO Retry button; footer note explains manual resolution path.
6. Quota exhausted at preview: verbatim Phase 31 inline error renders in red below quota indicator; Pushback button disabled.
7. Reason text: booker email includes reason text; LD-07 audience neutrality preserved (no NSI branding, no owner identity).
8. Per-day shortcut button: button present on each day section in bookings list; clicking opens dialog with date pre-selected.

## Next Phase Readiness

Phase 33 is fully shipped and human-verified. All 4 plans complete:
- 33-01: Dialog shell + day-grouped view + per-day shortcuts
- 33-02: Pure cascade module + preview render + quota gate
- 33-03: commitPushbackAction (ABORT-on-diverge) + reschedule extensions + dialog Confirm wiring
- 33-04: Summary render + retryPushbackEmailAction + Close→refresh

v1.6 (Day-of-Disruption Tools — Phases 31 + 32 + 33) is ready for milestone close pending Phase 33 verifier pass.

Open tech debt carried forward (unchanged from prior plans):
- PUSH-10 partial: reason text not in reschedule email (template has no reason block; captured as owner context only)
- oldEndAt in retryPushbackEmailAction is a placeholder — safe today (sendOwner:false), needs threading if owner retry leg ever activates
- Pre-existing TS errors in mock test files (bookings-api.test.ts etc.) — deferred cleanup

---
*Phase: 33-day-level-pushback-cascade*
*Completed: 2026-05-05*
