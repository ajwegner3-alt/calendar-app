---
phase: 04-availability-engine
plan: "05"
subsystem: ui
tags: [react-day-picker, shadcn, date-overrides, calendar, modal, dialog, tailwind]

# Dependency graph
requires:
  - phase: 04-availability-engine/04-03
    provides: upsertDateOverrideAction, deleteDateOverrideAction, DateOverrideRow type, dateOverrideSchema
  - phase: 04-availability-engine/04-04
    provides: TimeWindowPicker (reused in OverrideModal), PLAN-04-05-REPLACE markers in page.tsx
  - phase: 04-availability-engine/04-01
    provides: shadcn Calendar (react-day-picker v9), .day-blocked/.day-custom CSS classes in globals.css
provides:
  - DateOverridesSection client component (calendar + list + modal composition)
  - OverridesCalendar with red/blue dot markers via react-day-picker modifiers
  - OverridesList with Card-per-date, Blocked/Custom-hours Badge, Edit + Remove
  - OverrideModal supporting Add and Edit modes, Block and Custom-hours tabs
  - page.tsx patched to render DateOverridesSection in the overrides section slot
affects: [phase-05-public-booking, phase-09-manual-qa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-button mode toggle instead of shadcn Tabs for 2-option choice (saves ~80 LOC dep)
    - DateOverrideRow[] grouping by override_date for multi-window Card consolidation
    - useEffect re-seed pattern for modal state when open/initialDate change
    - Local-TZ Date construction for calendar markers (browser TZ acceptable for visual-only)
    - isEdit detection from allOverrides array in modal (no separate prop)

key-files:
  created:
    - app/(shell)/app/availability/_components/overrides-calendar.tsx
    - app/(shell)/app/availability/_components/overrides-list.tsx
    - app/(shell)/app/availability/_components/override-modal.tsx
    - app/(shell)/app/availability/_components/date-overrides-section.tsx
  modified:
    - app/(shell)/app/availability/page.tsx

key-decisions:
  - "Two-button mode toggle (Block / Custom hours) instead of shadcn Tabs — Tabs not installed, two buttons sufficient for 2-option toggle, avoids extra dep (~80 LOC)"
  - "Date input disabled in Edit mode — forces remove+add for date changes; simpler delete-all-for-date semantic, no orphan-row risk"
  - "Calendar marker rendering uses local browser TZ — acceptable for visual-only marker placement; override_date string identity is what goes to the server"
  - "Mutual exclusion is action-layer responsibility (Plan 04-03 lock) — UI just sends the payload shape, no client enforcement"
  - "No nested Dialogs — Remove button calls deleteDateOverrideAction directly and closes modal on success (STATE.md RestoreCollisionDialog decision applies)"

patterns-established:
  - "OverridesCalendar: is_closed wins marker when both types exist for same date (mirrors Plan 04-02 engine)"
  - "OverrideModal re-seeds all form state (date, mode, windows, note, error) on every open via useEffect([open, initialDate, allOverrides])"
  - "OverridesList groups raw DateOverrideRow[] by override_date so multiple windows for one date appear as a single Card with comma-separated time strings"

# Metrics
duration: 18min
completed: 2026-04-25
---

# Phase 4 Plan 05: Date Overrides UI Summary

**Calendar with red/blue dot markers + Card list view + Block/Custom-hours modal wired into /app/availability, reusing TimeWindowPicker from Plan 04-04**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-25T13:04:11Z
- **Completed:** 2026-04-25T13:22:30Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 patched)

## Accomplishments

- `OverridesCalendar`: shadcn Calendar with `modifiers`/`modifiersClassNames` producing red (`.day-blocked`) and blue (`.day-custom`) dots on override dates; date clicks forwarded as YYYY-MM-DD strings
- `OverridesList`: Card-per-date view with Blocked (destructive badge) / Custom hours (secondary badge), comma-separated window summary or "All day", Edit + Remove buttons; Remove calls `deleteDateOverrideAction` via `useTransition` with sonner toast + `router.refresh()`
- `OverrideModal`: shadcn Dialog with two-button mode toggle (Block / Custom hours), date input disabled in Edit mode, windows array editor reusing `TimeWindowPicker` from Plan 04-04, optional note Textarea, Save/Cancel and Remove-override (Edit only) footer actions
- `DateOverridesSection`: composition component holding `modalOpen` + `selectedDate` state, wiring all three click paths (calendar day, list edit, Add button)
- `page.tsx` patched in exactly two places: commented import uncommented, placeholder paragraph + PLAN-04-05-REPLACE markers replaced with `<DateOverridesSection overrides={state.overrides} />`
- `npm run build` + `npm test` (45/45) both pass

## Task Commits

Each task was committed atomically:

1. **Task 1: OverridesCalendar with red/blue dot markers** - `78a8b72` (feat)
2. **Task 2: OverridesList + OverrideModal** - `5d093c8` (feat)
3. **Task 3: DateOverridesSection + page.tsx patch** - `e7b44ca` (feat)

## Files Created/Modified

- `app/(shell)/app/availability/_components/overrides-calendar.tsx` - shadcn Calendar with modifiers for blocked/custom-hours dates; formats clicked Date to YYYY-MM-DD for parent
- `app/(shell)/app/availability/_components/overrides-list.tsx` - groups DateOverrideRow[] by override_date; Card per date with Badge, summary, Edit/Remove; Remove calls deleteDateOverrideAction
- `app/(shell)/app/availability/_components/override-modal.tsx` - Dialog with Block/Custom-hours two-button toggle; reuses TimeWindowPicker; calls upsertDateOverrideAction/deleteDateOverrideAction
- `app/(shell)/app/availability/_components/date-overrides-section.tsx` - composes all three subcomponents; manages modal + selectedDate state
- `app/(shell)/app/availability/page.tsx` - uncommented DateOverridesSection import; replaced placeholder paragraph with `<DateOverridesSection overrides={state.overrides} />`

## Decisions Made

**Two-button mode toggle instead of shadcn Tabs**
Tabs primitive is not installed in the project. Installing it would add ~80 LOC for a 2-option toggle. Two `<Button>` elements with `variant="default"` (active) vs `variant="outline"` (inactive) achieve identical UX with zero extra deps. No shadcn install needed.

**Date input disabled in Edit mode**
The action's delete-all-for-date semantic (`upsertDateOverrideAction` deletes ALL rows for a date before inserting the new shape) only works correctly when the date stays constant. If the user could change the date, we'd need to track the original date separately and delete it, then insert at the new date — complex and error-prone. Requiring remove+add for date changes is simpler and more explicit.

**Calendar marker rendering uses local browser TZ**
The shadcn Calendar requires JavaScript `Date` objects for its `modifiers` prop. The `override_date` values are YYYY-MM-DD strings in account-local TZ. Converting them via `@date-fns/tz` would require threading `account.timezone` through the component tree just for visual markers. Using `new Date(y, m-1, d)` (local-midnight) is a known acceptable simplification: the marker may shift ±1 day at midnight in timezones far from the account TZ, but the string identity passed to the action is always correct. Documented in plan notes.

**Mutual exclusion at action layer only**
UI sends discriminated union payloads; `upsertDateOverrideAction` (Plan 04-03) deletes ALL rows for the date first, then inserts the chosen shape. UI never needs to detect or prevent mixed states — the action enforces it. This keeps the modal stateless with respect to the existing DB shape.

**No nested Dialogs**
The Remove button in OverrideModal calls `deleteDateOverrideAction` directly and closes the modal on success (sonner toast confirms). No confirmation sub-Dialog. This follows the STATE.md "RestoreCollisionDialog: standalone Dialog, not nested" decision (Radix nested-modal focus-trap issues). If a confirmation step is needed in v2, it should be a top-level AlertDialog or a sonner toast with Undo action.

## Deviations from Plan

None — plan executed exactly as written. All four components implemented per spec; page.tsx patched in exactly two places as specified; TimeWindowPicker reused from Plan 04-04 via sibling import; no additional shadcn installs; no nested Dialogs.

## Issues Encountered

`npm run lint` reports the pre-existing ESLint flat-config circular JSON error (documented in STATE.md "Phase 8 backlog: ESLint flat-config migration"). This is not caused by Plan 04-05 changes. `npm run build` (TypeScript + Next.js compile) exits 0.

## User Setup Required

None — no external service configuration required. Live smoke test on Vercel after auto-deploy:
- Visit `/app/availability`
- Date overrides section renders below weekly editor with "Add override" button + calendar + empty list
- "Add override" opens modal; select date + Block/Custom hours + optional note → saves, red/blue dot appears on calendar, card appears in list
- Click calendar dot → modal opens in Edit mode preloaded with date's override
- Edit button in card → same Edit mode behavior
- Remove from modal footer OR Remove button in card → override deleted, dot removed, card removed

## Next Phase Readiness

Phase 4 is now fully complete:
- Plan 04-01: deps + accounts migration
- Plan 04-02: slot engine + computeSlots + DST tests
- Plan 04-03: data layer + server actions
- Plan 04-04: weekly editor + settings panel UI
- Plan 04-05: date overrides UI (this plan)
- Plan 04-06: /api/slots GET handler + 13-test integration suite

Ready for Phase 5 (Public Booking Flow). The `/api/slots` endpoint (Plan 04-06) is live on Vercel and returns `{slots: Array<{start_at, end_at}>}`. Phase 5 will consume this to render the public booking page.

---
*Phase: 04-availability-engine*
*Completed: 2026-04-25*
