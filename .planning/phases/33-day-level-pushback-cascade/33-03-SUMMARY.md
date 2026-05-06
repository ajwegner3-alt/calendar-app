---
phase: 33-day-level-pushback-cascade
plan: 03
subsystem: api
tags: [reschedule, pushback, server-action, email, race-safety, supabase]

# Dependency graph
requires:
  - phase: 33-day-level-pushback-cascade
    provides: "Plan 33-02: previewPushbackAction, CascadeRow[], PushbackBooking with reschedule_token_hash, dialog preview-ready state"
  - phase: 32-inverse-date-overrides
    provides: "Plan 32-03: skipOwnerEmail pattern in cancelBooking + sendCancelEmails, commitInverseOverrideAction abort-or-union pattern"
  - phase: 31-email-hard-cap-guard
    provides: "Plan 31-01: getRemainingDailyQuota, quota-guard pattern for server actions"
provides:
  - "commitPushbackAction server action with auth + race-safe re-query + ABORT-on-diverge + batch reschedule"
  - "RescheduleBookingArgs.skipOwnerEmail + actor extensions (backward-compatible)"
  - "SendRescheduleEmailsArgs.sendOwner extension (mirrors Phase 32 send-cancel-emails.ts)"
  - "CommitPushbackResultRow type with 5-variant status discriminator"
  - "Dialog Confirm button wired end-to-end; transitions to summary state with commitRows"
affects:
  - "33-04: renders commitRows in summary state; implements retry button for email_failed rows"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ABORT-on-diverge race strategy (contrast: Phase 32 unions) — cascade math is order-dependent"
    - "rescheduleBooking returns discriminated union (not throws) for DB failures — check ok field, not catch"
    - "Promise.allSettled per-booking batch — one failure does not abort the rest"
    - "Token hash pre-fetch from currentBookings map (no N+1 round-trip)"

key-files:
  created: []
  modified:
    - lib/bookings/reschedule.ts
    - lib/email/send-reschedule-emails.ts
    - app/(shell)/app/bookings/_lib/actions-pushback.ts
    - app/(shell)/app/bookings/_components/pushback-dialog.tsx

key-decisions:
  - "ABORT-on-diverge: any ID set difference aborts entire batch (no partial commits); contrast with Phase 32 UNION"
  - "rescheduleBooking() returns discriminated union — DB failures are ok:false returns, not throws; email failures surface as emailFailed field on ok:true result"
  - "reason text NOT plumbed to reschedule email — RescheduleBookingArgs has no reason field; owner sees reason in dialog context only (tech debt for future polish)"
  - "booker_name (full name) stored in CommitPushbackResultRow.booker_name; first-name derivation at render via firstNameOf() helper (same pattern as preview)"
  - "ABSORBED rows emit status='skipped' result rows for complete 33-04 summary rendering"

patterns-established:
  - "skipOwnerEmail pattern: RescheduleBookingArgs → sendRescheduleEmails sendOwner flag — mirrors Phase 32 cancelBooking → sendCancelEmails pattern exactly"
  - "actor param on rescheduleBooking: overrides hardcoded 'booker' in booking_events audit row for owner-initiated batches"
  - "Diverged state UX: reset to editing + refresh bookings + amber banner; Preview clears banner on date change"

# Metrics
duration: 10min
completed: 2026-05-05
---

# Phase 33 Plan 03: Commit Path — Destructive Pushback Batch Summary

**commitPushbackAction with ABORT-on-diverge race safety, skipOwnerEmail/actor reschedule extensions, and 5-variant per-booking result rows wired to dialog summary state**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-05T21:08:07Z
- **Completed:** 2026-05-05T21:18:31Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Extended `rescheduleBooking()` with `skipOwnerEmail?: boolean` + `actor?: 'booker' | 'owner'` — mirroring Phase 32's `cancelBooking` extension exactly. `sendRescheduleEmails()` gains `sendOwner?: boolean` to gate the owner leg.
- Implemented `commitPushbackAction` — auth, HARD quota pre-flight at commit time, ABORT-on-diverge race-safe re-query (contrast: Phase 32 unions), token-hash pre-fetch, `Promise.allSettled` batch reschedule, per-booking result aggregation with 5-variant status discriminator, `revalidatePath('/app/bookings')`.
- Wired dialog `handleConfirm` to `commitPushbackAction` — all 4 result branches handled; `commitRows` stored in state for 33-04; diverge banner shown inline in editing state with bookings refresh.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend rescheduleBooking + sendRescheduleEmails** - `5c96a9c` (feat)
2. **Task 2: commitPushbackAction** - `f31b064` (feat)
3. **Task 3: Wire dialog handleConfirm + summary state** - `18577de` (feat)

**Plan metadata:** (appended after summary creation)

## Files Created/Modified

- `lib/bookings/reschedule.ts` — `RescheduleBookingArgs` extended with `skipOwnerEmail?: boolean` (default false) and `actor?: "booker" | "owner"` (default 'booker'); `sendOwner: !skipOwnerEmail` plumbed to `sendRescheduleEmails`; `actor ?? "booker"` in booking_events audit row
- `lib/email/send-reschedule-emails.ts` — `SendRescheduleEmailsArgs.sendOwner?: boolean` added; owner leg gated with `sendOwner !== false` check (same idiom as `send-cancel-emails.ts`)
- `app/(shell)/app/bookings/_lib/actions-pushback.ts` — `commitPushbackAction`, `CommitPushbackInput`, `CommitPushbackResultRow`, `CommitPushbackResult` types added
- `app/(shell)/app/bookings/_components/pushback-dialog.tsx` — `commitRows` + `divergedMessage` state, real `handleConfirm`, diverge banner in editing state, summary placeholder with JSON dump + Close button

## Decisions Made

**1. ABORT-on-diverge (NOT union)**
Phase 32's `commitInverseOverrideAction` unions the preview-approved IDs with re-queried IDs so no booking is missed. Phase 33 ABORTS instead — cascade math is order-dependent; a new or missing booking on the day invalidates the entire preview and the cascaded new times. Any addition or removal returns `{ ok: false, diverged: true, message }`. NO partial commits.

**2. rescheduleBooking returns discriminated union — not throws**
The plan assumed `rescheduleBooking()` throws on DB failures. The actual implementation returns `{ ok: false, reason: "slot_taken" | "not_active" | ... }`. This is important: the `catch` block in `commitPushbackAction` would never fire for DB-layer failures. The implementation correctly checks `rescheduleResult.ok` instead of wrapping in try/catch.

**3. reason text not plumbed to reschedule email**
PUSH-10 specifies reason text appears in the email. However, `RescheduleBookingArgs` has no `reason` field, and the reschedule email template has no reason block. Adding reason to the reschedule email template would be an additive change beyond this plan's scope. The reason is stored in `CommitPushbackInput` for owner context and recorded indirectly via the audit row's `actor='owner'` signal. Tracked as tech debt.

**4. booker_name (full name) in result rows**
`CommitPushbackResultRow` uses `booker_name` (full name string, matching DB column) rather than `booker_first_name`. First-name derivation happens at render time via `firstNameOf()` helper (established in Plan 33-02). This is consistent with the inherited decision from 33-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] rescheduleBooking uses return-type discriminator not throws**
- **Found during:** Task 2 (commitPushbackAction implementation)
- **Issue:** Plan's pseudocode assumed `rescheduleBooking()` throws with a `code` field on DB failure. Actual implementation returns `{ ok: false, reason: "slot_taken" | "not_active" | "bad_slot" | "db_error" }` — never throws on DB failures (only email failures surface, and those via `emailFailed` field on the ok:true branch).
- **Fix:** Replaced the try/catch + code-reading pattern with `if (!rescheduleResult.ok)` check reading `rescheduleResult.reason` directly.
- **Files modified:** `app/(shell)/app/bookings/_lib/actions-pushback.ts`
- **Verification:** TypeScript clean; logic correctly maps `slot_taken` → `"slot_taken"` and everything else → `"not_active"`.
- **Committed in:** `f31b064`

**2. [Rule 3 - Blocking] reason param removed from rescheduleBooking call**
- **Found during:** Task 2 (TypeScript error: `'reason' does not exist in type 'RescheduleBookingArgs'`)
- **Issue:** Plan instructed passing `reason: input.reason` to `rescheduleBooking()`, but that field does not exist in `RescheduleBookingArgs`.
- **Fix:** Removed the `reason` parameter from the call. Added inline comment explaining PUSH-10 partial non-fulfillment (reason for owner context only; email template doesn't include it).
- **Files modified:** `app/(shell)/app/bookings/_lib/actions-pushback.ts`
- **Committed in:** `f31b064`

---

**Total deviations:** 2 auto-fixed (1 bug — wrong assumption about throw behavior; 1 blocking — TS error on non-existent param)
**Impact on plan:** Both fixes were essential for correctness. PUSH-10 (reason in email) is partially unmet — reason is captured but not shown in email body. Documented as tech debt.

## Issues Encountered

None beyond the deviations documented above.

## Hand-off Notes for Plan 33-04

**State field name:** `commitRows` (type `CommitPushbackResultRow[]`) in `pushback-dialog.tsx`

**`CommitPushbackResultRow` shape** (from `actions-pushback.ts`):
```typescript
{
  booking_id: string;
  booker_name: string;           // full name; use firstNameOf() for display
  old_start_at: string;          // UTC ISO
  new_start_at: string | null;   // null when skipped or DB failure
  status: "sent" | "email_failed" | "slot_taken" | "not_active" | "skipped";
  error_message?: string;        // present on non-sent, non-skipped rows
}
```

**Status semantics for 33-04 UI:**
- `sent` — DB updated + email sent (green check badge)
- `email_failed` — DB updated, email not sent (amber badge + Retry button — retry is possible)
- `slot_taken` — DB rejected (new time was taken); booking unchanged (red badge; no retry — owner must pick a different time)
- `not_active` — DB rejected (CAS: booking cancelled/past); booking unchanged (red badge; no retry)
- `skipped` — ABSORBED booking; no change, no email (slate badge)

**Retry-eligible:** only `email_failed` rows. The retry action (`retryPushbackEmailAction`) is 33-04's deliverable.

**Current summary state:** Shows "N/M sent" header + raw JSON dump. 33-04 replaces the JSON dump with styled per-row badges and retry buttons.

**Dialog state machine:** `setState("summary")` is called by `handleConfirm` on success. The Close button is wired in the summary `DialogFooter`. No other state transitions in/out of `summary` — it is a terminal state (close = unmount).

## Next Phase Readiness

Plan 33-04 (Summary rendering + retryPushbackEmailAction) is unblocked:
- `commitRows: CommitPushbackResultRow[]` is populated in dialog state on success
- `CommitPushbackResultRow` shape is finalized and exported from `actions-pushback.ts`
- Status discriminator is complete and stable
- The JSON debug dump placeholder in summary state is ready to be replaced

No blockers. The full commit path is live in production (pushed to main).

---
*Phase: 33-day-level-pushback-cascade*
*Completed: 2026-05-05*
