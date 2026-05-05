---
phase: 32-inverse-date-overrides
plan: 02
subsystem: ui
tags: [next-js, react, server-actions, zod, sonner, date-overrides, quota-guard, inverse-windows]

# Dependency graph
requires:
  - phase: 31-email-hard-cap-guard
    provides: getRemainingDailyQuota() — feeds the EMAIL-23 inline quota gate
  - phase: 32-inverse-date-overrides (Plan 32-01)
    provides: Slot engine MINUS semantics + cleaned date_overrides table
  - phase: 32-inverse-date-overrides (Plan 32-03)
    provides: commitInverseOverrideAction server action + getAffectedBookings query helper
  - phase: 06-cancel-and-reschedule
    provides: upsertDateOverrideAction (no-affected-bookings fast path) + cancelBooking() lifecycle
provides:
  - Owner-facing override editor flipped to inverse-windows semantics ("Add unavailable windows")
  - Multi-window add/edit/remove on a single date with non-overlapping validation
  - "Block entire day" toggle that hides+preserves window state (toggle off restores)
  - Inline affected-bookings preview (chronological; booker name + start/end in account TZ + event-type label)
  - EMAIL-23 HARD quota gate inline in the modal (matches Phase 31 day-detail-row.tsx pattern)
  - previewAffectedBookingsAction — read-only server action that returns { affected, remainingQuota } for the preview UI
affects: [33-day-of-pushback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Modal commit flow as a 3-state machine: editing → preview-loading → preview-ready (with fast-path bypass when affected.length === 0)"
    - "Hide+preserve mode toggle: state kept in useState, gated by mode === 'unavailable' for render only"
    - "Account-TZ time formatting in client modal via Intl.DateTimeFormat with the IANA zone threaded from the server loader"
    - "Phase 31 inline quota error UX (text-sm text-red-600, role=alert) reused for EMAIL-23 surface"
    - "Discriminated-union mode literal end-to-end: 'block' | 'unavailable' across schema, types, modal state, and server action input"

key-files:
  created: []
  modified:
    - "app/(shell)/app/availability/_components/override-modal.tsx"
    - "app/(shell)/app/availability/_components/date-overrides-section.tsx"
    - "app/(shell)/app/availability/_components/overrides-calendar.tsx"
    - "app/(shell)/app/availability/_components/overrides-list.tsx"
    - "app/(shell)/app/availability/_lib/actions.ts"
    - "app/(shell)/app/availability/_lib/actions-batch-cancel.ts"
    - "app/(shell)/app/availability/_lib/schema.ts"
    - "app/(shell)/app/availability/_lib/types.ts"
    - "app/(shell)/app/availability/page.tsx"

key-decisions:
  - "Renamed the discriminated-union variant 'custom_hours' → 'unavailable' end-to-end (schema, types, action branches, modal state, internal vars). DB row shape unchanged. Plan 32-01's wipe migration cleared the only legacy rows so the rename is safe."
  - "Block-entire-day toggle is hide+preserve, not wipe — owners can experiment with the mode flip without losing the windows they've entered (CONTEXT.md 'safer default')."
  - "previewAffectedBookingsAction lives in actions-batch-cancel.ts (next to commitInverseOverrideAction) rather than queries.ts — both are UI-facing server actions that share auth + the isFullDayBlock-vs-windows discriminated shape. Plan 32-03 deliberately deferred this helper to 32-02 because its return shape is UI-driven."
  - "Fast path preserved: when previewAffectedBookingsAction returns affected.length === 0, the modal calls upsertDateOverrideAction directly (the no-affected-bookings code path) instead of routing through commitInverseOverrideAction. Snappy UX preserved for the common case of blocking a future date with no bookings."
  - "Quota gate copy: 'X email(s) needed, Y remaining today. Quota resets at UTC midnight. Wait until tomorrow or contact bookers manually.' — matches Phase 31 day-detail-row.tsx voice."
  - "accountTimezone threaded from page.tsx loader → DateOverridesSection → OverrideModal so booker time ranges in the preview render in the account's IANA zone (not the browser's local zone)."

patterns-established:
  - "Owner-facing inverse-overrides label vocabulary: 'Block entire day' / 'Add unavailable windows' (replacing the v1.5-and-prior 'Custom hours' / 'Enter available times')"
  - "Modal preview density: name + time range in account TZ + event-type label, chronological sort, max-h-64 overflow-y-auto for long lists"
  - "Confirm-button copy convention: 'Confirm — cancel N booking(s)' with destructive variant"

# Metrics
duration: ~25 min (plan execution including human-verify checkpoint roundtrip)
completed: 2026-05-05
---

# Phase 32 Plan 02: Override Modal Rewrite Summary

**Owner-facing date-override editor flipped from available-windows to unavailable-windows semantics with multi-window UX, hide+preserve "Block entire day" toggle, inline affected-bookings preview, and EMAIL-23 quota gate matching Phase 31 visual pattern.**

## Performance

- **Duration:** ~25 min (including human-verify checkpoint roundtrip)
- **Started:** 2026-05-05T23:30:00Z (Task 1 start)
- **Completed:** 2026-05-05T23:53:11Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 9 (across both task commits)

## Accomplishments

- Owner-facing label flipped to inverse semantics: modes are now "Block entire day" / "Add unavailable windows"
- Multi-window add/edit/remove works on a single date with non-overlapping validation enforced at the schema layer
- "Block entire day" toggle hides+preserves the unavailable-windows list (toggle off restores prior state)
- Inline affected-bookings preview renders below Save with chronological list (booker name + start/end in account TZ + event-type label)
- EMAIL-23 HARD quota gate disables the Confirm button with inline red-600 error when projected email count exceeds remaining daily quota — voice matches Phase 31's day-detail-row.tsx pattern
- Confirm action invokes commitInverseOverrideAction (Plan 32-03) which routes through cancelBooking with skipOwnerEmail=true (no duplicate owner notifications); booker leg unconditional (LD-07 booker-neutral preserved)
- Fast path preserved for the no-affected-bookings common case via direct upsertDateOverrideAction call
- previewAffectedBookingsAction added to actions-batch-cancel.ts as the read-only preview server action

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename schema + types from custom_hours to unavailable** — `7913349` (feat)
2. **Task 2: Override modal rewrite — unavailable windows + preview + quota gate** — `7ea8292` (feat)
3. **Task 3: human-verify checkpoint** — Andrew approved 8/8 verification scenarios on 2026-05-05 (no commit; gate-only)

**Plan metadata:** committed by this finalization step (`docs(32-02): complete override-modal-rewrite plan`)

## Files Created/Modified

**Schema/types rename (commit `7913349`):**
- `app/(shell)/app/availability/_lib/schema.ts` — `dateOverrideSchema` discriminator literal `"custom_hours"` → `"unavailable"`
- `app/(shell)/app/availability/_lib/types.ts` — `DateOverrideInput` discriminated union updated to mirror the schema rename
- `app/(shell)/app/availability/_lib/actions.ts` — `upsertDateOverrideAction` branch labels + comments updated; remains the no-affected-bookings fast path
- `app/(shell)/app/availability/_components/override-modal.tsx` — state literal updated to `"unavailable"` so the modal still typechecks before Task 2's full UX rewrite
- `app/(shell)/app/availability/_components/overrides-calendar.tsx` — internal var `customHoursDates` → `unavailableDates`; modifier key `customHours` → `unavailable` (CSS class `day-custom` unchanged)
- `app/(shell)/app/availability/_components/overrides-list.tsx` — badge label "Custom hours" → "Unavailable windows"

**Modal rewrite (commit `7ea8292`):**
- `app/(shell)/app/availability/_components/override-modal.tsx` — full rewrite: mode toggle, hide+preserve, 3-state commit flow, preview UI, quota gate, Confirm handler, formatLocalTime helper
- `app/(shell)/app/availability/_lib/actions-batch-cancel.ts` — added `previewAffectedBookingsAction` (read-only server action returning `{ affected, remainingQuota }`)
- `app/(shell)/app/availability/_components/date-overrides-section.tsx` — accountTimezone threaded through to OverrideModal
- `app/(shell)/app/availability/page.tsx` — loader passes `state.account.timezone` into DateOverridesSection

## Decisions Made

- **Hide+preserve over wipe for "Block entire day" toggle.** Owners can experiment with the mode flip without losing the windows they've entered. Implemented by gating the windows-list render on `mode === "unavailable"` while keeping `windows` state untouched on toggle.
- **previewAffectedBookingsAction placed in actions-batch-cancel.ts (not queries.ts).** It's the UI-facing twin of commitInverseOverrideAction — sharing auth, the isFullDayBlock-vs-windows discriminated shape, and the same input schema mirror. Plan 32-03 deliberately deferred this helper to 32-02 because its return shape is UI-driven; documented in the commit body as the rationale for the small additive change to a 32-03 file.
- **Fast path retained via upsertDateOverrideAction.** When the preview returns 0 affected bookings, the modal bypasses the slow path entirely and calls upsertDateOverrideAction directly — preserving snappy UX for the common case of blocking a future date with no bookings.
- **accountTimezone threaded from server loader, not derived in the browser.** The booker time ranges in the preview are formatted with the account's IANA zone via Intl.DateTimeFormat, not the browser's local zone — owners always see times the way bookers received them.

## Deviations from Plan

None - plan executed exactly as written. The two anticipated extensions (the `previewAffectedBookingsAction` server action in `actions-batch-cancel.ts`, and the `accountTimezone` thread-through from `page.tsx`) were both pre-authorized in the plan body (STEP 4 / "Option A" and STEP 5 of Task 2 respectively), so they're not deviations.

## Issues Encountered

None during planned work. The human-verify checkpoint required Andrew to temporarily edit `lib/email-sender/quota-guard.ts` (forcing `getRemainingDailyQuota → 0`) to exercise Scenario 6 (EMAIL-23 quota gate); Andrew confirmed the edit was reverted before approving — `git diff lib/email-sender/quota-guard.ts` is clean.

## Human Verification Outcome

Andrew completed all 8 verification scenarios at `http://localhost:3000/app/availability` on 2026-05-05 and approved the plan. Confirmed scenarios:

1. **Mode label** — "Block entire day" / "Add unavailable windows" present; old "Custom hours" / "Enter available times" labels gone
2. **Multi-window add/edit/remove** — three windows added, middle edited, first removed; reload preserved the two remaining windows correctly
3. **Block-entire-day hide+preserve** — windows list hides on toggle on; windows restored intact on toggle off
4. **Slot engine MINUS on public page** — unavailable window 12:00–13:00 removes only that range from public slots; before/after slots remain; buffer-after-minutes still applied at the boundary
5. **Affected-bookings preview + Confirm flow** — inline preview renders correctly; Confirm fires commitInverseOverrideAction; booker received brand-neutral cancel email with rebook CTA; owner did NOT receive a duplicate cancel notification (skipOwnerEmail working end-to-end); booking status flipped to `cancelled` in `/app/bookings`
6. **EMAIL-23 quota gate** — with quota forced to 0, inline red-600 error rendered ("1 emails needed, 0 remaining today. Quota resets at UTC midnight."); Confirm button disabled; quota-guard test edit reverted post-verification
7. **Race-safety re-query** — booking landed in the race window between preview and commit was also cancelled (post-write re-query + union with preview IDs caught it)
8. **v1.5 invariants preserved** — buffer-after-minutes still respected; EXCLUDE GIST cross-event-type constraint still binding

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Plan 32-02 ships the final owner-facing surface for Phase 32. With this in place:**

- Phase 32 plan execution is complete (3 of 3 plans). The phase verifier (`/gsd:verify-phase 32`) is the next gate before Phase 32 can close.
- Plan 33-01+ (Day-of-Pushback) can begin against the now-complete inverse-overrides foundation. The patterns established here (HARD quota gate UX + inline affected-bookings preview + Phase 31 visual vocabulary) are reusable for the EMAIL-22 PUSH batch quota pre-flight UI.
- The `previewAffectedBookingsAction` + `commitInverseOverrideAction` pair is now the canonical "preview-then-commit with quota gate" pattern in this codebase. Phase 33's pushback flow should mirror it.

**Open carry-forward:**
- `app/globals.css` working-tree drift introduced by the orchestrator (`@source not "../.planning"`) is intentionally NOT bundled with this plan's metadata commit — the orchestrator commits it separately as a phase-level fix.
- Pre-existing `.planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift remains untouched (carry-forward debt; same as STATE.md noted before this plan).

---
*Phase: 32-inverse-date-overrides*
*Completed: 2026-05-05*
