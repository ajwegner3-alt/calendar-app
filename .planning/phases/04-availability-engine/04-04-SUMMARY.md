---
phase: 04-availability-engine
plan: "04"
subsystem: ui
tags: [react, next.js, server-components, shadcn, sonner, radix-ui, tailwind, typescript]

# Dependency graph
requires:
  - phase: 04-03
    provides: loadAvailabilityState(), saveWeeklyRulesAction, saveAccountSettingsAction, AvailabilityState, AvailabilityRuleRow, DayOfWeek, TimeWindow types
  - phase: 03-02
    provides: shadcn UI primitives (Alert, Switch, Button, Input, Label, Separator, Skeleton, DropdownMenu), Sonner Toaster at root
provides:
  - /app/availability Server Component page (replaces Phase 2 stub)
  - WeeklyRulesEditor (7 weekday rows, Mon-first display)
  - WeekdayRow (per-row state, Open/Closed Switch, windows, Add/Copy/Save)
  - TimeWindowPicker (native <input type="time"> with HH:MM <-> minutes-since-midnight)
  - CopyFromMenu (DropdownMenu listing 6 sibling weekdays with window counts)
  - SettingsPanel (4 number inputs: buffer, min-notice, max-advance, daily-cap)
  - loading.tsx skeleton (matching page layout)
  - AvailabilityEmptyBanner (shadcn Alert, zero-state guard)
  - PLAN-04-05-REPLACE-START/END comment markers in page.tsx for date-overrides section
affects:
  - 04-05 (date-overrides UI — imports TimeWindowPicker, patches page.tsx at marker)
  - 04-06 (/api/slots route — reads same DB data)
  - 09-manual-qa (Andrew verifies /app/availability UI end-to-end)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "per-row useState (not RHF) for uniform small sub-forms — RHF overhead not justified for 7 identical single-field groups"
    - "useTransition + direct-call Server Action + toast + router.refresh() pattern (mirrors Phase 3)"
    - "PLAN-04-05-REPLACE-START/END comment markers as cross-plan patch contract"
    - "Mon-first display order (1,2,3,4,5,6,0) while preserving 0=Sun data contract"
    - "empty string -> null at form boundary for nullable number fields (daily_cap)"

key-files:
  created:
    - app/(shell)/app/availability/loading.tsx
    - app/(shell)/app/availability/_components/availability-empty-banner.tsx
    - app/(shell)/app/availability/_components/time-window-picker.tsx
    - app/(shell)/app/availability/_components/copy-from-menu.tsx
    - app/(shell)/app/availability/_components/weekday-row.tsx
    - app/(shell)/app/availability/_components/weekly-rules-editor.tsx
    - app/(shell)/app/availability/_components/settings-panel.tsx
  modified:
    - app/(shell)/app/availability/page.tsx

key-decisions:
  - "Plain useState per row (no RHF) — 7 identical uniform sub-forms, each with only TimeWindow[] state; RHF adds setup cost with zero benefit here. Phase 3 EventTypeForm used RHF for 8+ heterogeneous fields with complex validation — different situation."
  - "Mon-first display order (1,2,3,4,5,6,0) in WeeklyRulesEditor — common UX preference (Calendly, Google Calendar); Postgres dow=0=Sun is preserved in data layer, only the render order changes."
  - "TimeWindowPicker exports minutesToHHMM + hhmmToMinutes as named exports so Plan 04-05 can reuse them in the date-overrides custom_hours modal."
  - "PLAN-04-05-REPLACE-START/END comment markers in page.tsx — explicit contract for Plan 04-05 to patch in DateOverridesSection without modifying any other part of page.tsx. Keeps Wave 3 parallelism clean."
  - "daily_cap empty string -> null handled at SettingsPanel component boundary, not in the action — the action receives null directly and validates it correctly via accountSettingsSchema (z.number().nullable())."
  - "Stub components (weekly-rules-editor, settings-panel) created for Task 1 build pass, replaced atomically in Tasks 2 and 3 — avoids accumulating uncommitted partial state."

patterns-established:
  - "TimeWindowPicker (path: app/(shell)/app/availability/_components/time-window-picker.tsx) is the canonical HH:MM <-> minutes-since-midnight component. Plan 04-05 imports it directly."
  - "CopyFrom pattern: allDays prop flows from WeeklyRulesEditor -> each WeekdayRow -> CopyFromMenu, giving each row read-only access to sibling state without lifting state up to a shared store."

# Metrics
duration: 5min
completed: 2026-04-25
---

# Phase 4 Plan 04: Weekly Editor and Settings Panel Summary

**Calendly-style weekly availability editor with per-row Open/Closed toggle, native time pickers, Copy-from menu, and 4-field booking settings panel — all wired to Phase 4 Server Actions with toast + router.refresh pattern.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-25T17:54:56Z
- **Completed:** 2026-04-25T17:59:23Z
- **Tasks:** 3
- **Files modified:** 8 (1 modified, 7 created)

## Accomplishments

- Replaced Phase 2 stub at `/app/availability` with a real Server Component calling `loadAvailabilityState()`, redirecting unlinked users, and rendering the full page layout
- Weekly rules editor: 7 weekday rows in Mon-first display order, each with Open/Closed Switch (state derived from `windows.length > 0`), stacked TimeWindowPicker instances using native `<input type="time">`, Add window button, Copy-from DropdownMenu listing sibling windows, and per-row Save button wired to `saveWeeklyRulesAction` inside `useTransition`
- Settings panel: 4 plain `<input type="number">` fields (buffer_minutes, min_notice_hours, max_advance_days, daily_cap), field-level error display, `saveAccountSettingsAction`, daily_cap empty → null at form boundary
- Empty-state banner (shadcn Alert) renders when both rules and overrides arrays are empty — prevents silent zero-availability state
- `loading.tsx` skeleton matches the page layout (header + 3 sections) so Suspense transition feels correct

## Task Commits

1. **Task 1: Server Component page + loading skeleton + empty-state banner** - `1ee1d16` (feat)
2. **Task 2: Weekly rules editor — TimeWindowPicker, CopyFromMenu, WeekdayRow, WeeklyRulesEditor** - `2b0c65b` (feat)
3. **Task 3: Settings panel with 4 number inputs** - `4368d66` (feat)

**Plan metadata commit:** (included in STATE.md update commit)

## Files Created/Modified

- `app/(shell)/app/availability/page.tsx` — Server Component; loadAvailabilityState(); empty-banner condition; weekly editor, date-overrides placeholder, settings panel sections
- `app/(shell)/app/availability/loading.tsx` — Skeleton matching page layout (7 row skeletons + 4 input skeletons)
- `app/(shell)/app/availability/_components/availability-empty-banner.tsx` — shadcn Alert (amber border) with CONTEXT-locked copy
- `app/(shell)/app/availability/_components/time-window-picker.tsx` — native `<input type="time">` pair; exports `minutesToHHMM`, `hhmmToMinutes`, `TimeWindowPickerProps`, `TimeWindowPicker`
- `app/(shell)/app/availability/_components/copy-from-menu.tsx` — DropdownMenu listing 6 sibling weekdays with window count labels
- `app/(shell)/app/availability/_components/weekday-row.tsx` — per-row useState + useTransition + saveWeeklyRulesAction + toast + router.refresh
- `app/(shell)/app/availability/_components/weekly-rules-editor.tsx` — groups AvailabilityRuleRow[] by day_of_week; renders 7 WeekdayRow in Mon-first order; passes allDays to each row
- `app/(shell)/app/availability/_components/settings-panel.tsx` — 4 number inputs; empty daily_cap -> null; saveAccountSettingsAction; field + form error display

## Decisions Made

**1. Plain useState per row (no RHF)**
7 identical weekday rows each hold only a `TimeWindow[]` array. React Hook Form adds validation orchestration and field-registration overhead designed for complex heterogeneous forms (like Phase 3's EventTypeForm with 8+ fields + nested questions). For 7 uniform single-array rows the overhead is not justified. If Phase 8 adds client-side overlap validation on blur, RHF could be introduced then.

**2. Mon-first display order**
`WeeklyRulesEditor` renders days as `[1, 2, 3, 4, 5, 6, 0]` (Mon→Sat→Sun). Standard UX pattern from Calendly, Google Calendar, Outlook. The data layer uses `day_of_week = 0..6 = Sun..Sat` (Postgres convention) unchanged — only the render order differs.

**3. TimeWindowPicker exports minutesToHHMM + hhmmToMinutes**
Made these conversion helpers named exports so Plan 04-05 can import them into the date-overrides custom_hours modal without duplicating the conversion logic.

**4. PLAN-04-05-REPLACE-START/END comment markers**
The date-overrides section in `page.tsx` is fenced with comment markers so Plan 04-05 can patch in `<DateOverridesSection overrides={state.overrides} />` with a minimal diff. Plan 04-05 contract:
1. Create `_components/date-overrides-section.tsx`
2. Uncomment the `import { DateOverridesSection }` line at the top of `page.tsx`
3. Replace the paragraph between the marker comments with `<DateOverridesSection overrides={state.overrides} />`

**5. daily_cap null handling at form boundary**
`SettingsPanel` converts empty string to `null` before calling `saveAccountSettingsAction`. The action receives `null` directly (not the string `""`), which passes `z.number().nullable()` validation and writes `NULL` to Postgres (DB CHECK: `daily_cap IS NULL OR daily_cap > 0`). Avoids coercing zero which the DB rejects.

## Plan 04-05 Import Contract

Plan 04-05 imports from this plan's work:

| Import | Source file | Used in |
|--------|-------------|---------|
| `TimeWindowPicker` | `_components/time-window-picker.tsx` | Date-overrides custom_hours modal window rows |
| `minutesToHHMM` | `_components/time-window-picker.tsx` | Display of override windows |
| `hhmmToMinutes` | `_components/time-window-picker.tsx` | Override form field parsing |

**page.tsx patch points for 04-05:**
- Line 11 (approx): `// import { DateOverridesSection }` → uncomment
- PLAN-04-05-REPLACE-START block: replace placeholder `<p>` with `<DateOverridesSection overrides={state.overrides} />`

## Deviations from Plan

**Minor: Stub files created for Task 1 build**

- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** `page.tsx` imports `WeeklyRulesEditor` and `SettingsPanel` which are built in Tasks 2 and 3. Build would fail on Task 1 without them.
- **Fix:** Created minimal stub versions of `weekly-rules-editor.tsx` and `settings-panel.tsx` with correct export signatures for Task 1 build pass, then replaced them atomically in Tasks 2 and 3 respectively.
- **Impact:** Zero — stub files were never committed; the final committed versions are the complete implementations. Task 1 commit includes only the 3 files specified in the plan.

No functional deviations. Plan executed as specified.

## Issues Encountered

**Transient test failure on first run (`slots-api.test.ts`)**

On the first `npm test` run, `tests/slots-api.test.ts` threw a duplicate key violation on `event_types_account_id_slug_active`. This is a pre-existing DB state issue (Plan 04-06 test leaving a row in the DB from a prior run). All 5 test files passed on the second run (45/45 tests, no skips). Not caused by Plan 04-04 code.

Pre-existing `npm run lint` failure (ESLint circular JSON, Phase 1 backlog item, tracked in STATE.md Phase 8 backlog) unchanged.

## Next Phase Readiness

**Plan 04-05 (Date overrides UI):** Ready to proceed. `TimeWindowPicker` is at `app/(shell)/app/availability/_components/time-window-picker.tsx`. page.tsx has PLAN-04-05-REPLACE-START/END markers. The `DateOverridesSection` component placeholder paragraph is the only thing to replace.

**Plan 04-06 (/api/slots route):** Already shipped in parallel (visible in git log as `b74c65f`). No dependency on 04-04 UI components.

**Phase 5 (Public Booking Flow):** The availability editor is the prerequisite for booking slots to exist. Andrew should verify the weekly editor works end-to-end (set Mon-Fri 9-17, confirm slots appear via /api/slots) before Phase 5 plan.

---
*Phase: 04-availability-engine*
*Completed: 2026-04-25*
