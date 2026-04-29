---
phase: 12-branded-ui-overhaul
plan: 04b
subsystem: ui
tags: [react, shadcn, sheet, alert-dialog, sonner, useTransition, vitest, rtl, next-navigation, clipboard]

# Dependency graph
requires:
  - phase: 12-04a
    provides: "HomeCalendar with onDayClick(date, dayBookings) callback; cancelBookingAsOwner, regenerateRescheduleTokenAction, sendReminderForBookingAction Server Actions; MonthBooking type"
provides:
  - "DayDetailRow: per-booking row component with 4 action affordances (View/Cancel/Copy-reschedule-link/Send-reminder) + 3 AlertDialog confirmations"
  - "DayDetailSheet: shadcn Sheet drawer (right side, w-full sm:max-w-md) with empty-state branch and scrollable booking list"
  - "HomeDashboard: client wrapper owning Sheet open state, connects HomeCalendar.onDayClick to DayDetailSheet"
  - "/app page.tsx: accounts SELECT extended to include timezone; renders HomeDashboard instead of HomeCalendar directly"
affects: ["phase-13-manual-qa"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sheet drawer with client-owned open state (HomeDashboard as state container)"
    - "AlertDialog e.preventDefault() + useTransition pattern for Server Action calls (mirrors cancel-button.tsx)"
    - "vi.hoisted() mock spies pattern for RTL component tests with Server Action dependencies"
    - "navigator.clipboard.writeText with inline readOnly input fallback on SecurityError"

key-files:
  created:
    - "app/(shell)/app/_components/day-detail-row.tsx"
    - "app/(shell)/app/_components/day-detail-sheet.tsx"
    - "app/(shell)/app/_components/home-dashboard.tsx"
    - "tests/day-detail-row.test.tsx"
    - "tests/day-detail-sheet.test.tsx"
  modified:
    - "app/(shell)/app/page.tsx"

key-decisions:
  - "HomeDashboard is the state container for open/selectedDate/selectedBookings — Sheet state lives in the client wrapper, not in HomeCalendar or DayDetailSheet"
  - "Empty-day clicks pass through onDayClick with bookings=[] — HomeCalendar fires onDayClick unconditionally; DayDetailSheet branches on bookings.length"
  - "SheetDescription doubles as the empty-state message (No bookings on this day.) — avoids duplicate text elements in the DOM"
  - "Manual smoke deferred to Phase 13 — unit tests are the load-bearing correctness verification; dev server unavailable in this session"
  - "useTransition wraps each Server Action call independently — one pending state per action button; buttons disable individually during execution"

patterns-established:
  - "DayDetailRow pattern: metadata block (name + time·event-type) + fallback URL input (conditionally rendered) + action flex-wrap row"
  - "AlertDialog confirm buttons use e.preventDefault() to prevent auto-close; component closes manually after result"
  - "Clipboard fallback: set state with URL string → renders <input readOnly value={url}> when clipboard.writeText throws; input onClick selects all for easy manual copy"
  - "RTL tests for client components use vi.hoisted() for all mock spies + afterEach(cleanup) to prevent DOM accumulation across test cases"

# Metrics
duration: ~90min
completed: 2026-04-29
---

# Phase 12 Plan 04b: Home Tab Day-Detail Sheet Summary

**shadcn Sheet drawer with 4-action DayDetailRow (View/Cancel/Copy-reschedule-link/Send-reminder + AlertDialog confirmations) wired to HomeCalendar.onDayClick via HomeDashboard state container**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-04-29T19:51:00Z (approx)
- **Completed:** 2026-04-29T21:15:13Z
- **Tasks:** 3 of 3
- **Files modified/created:** 6 (3 components + 2 test files + page.tsx update)

## Accomplishments

- `DayDetailRow` ships with all 4 actions: View (Link, no confirmation), Cancel (AlertDialog, destructive), Copy reschedule link (AlertDialog, warns about token invalidation + clipboard/fallback), Send reminder (AlertDialog, warns about token rotation)
- `DayDetailSheet` + `HomeDashboard` connected pair: Sheet opens on every day click (empty-state branch for days with zero bookings); SheetDescription serves as both count summary and empty-state text
- `/app page.tsx` SELECT extended to include `timezone` column; `<HomeCalendar>` replaced by `<HomeDashboard bookings={bookings} accountTimezone={account.timezone} />`; IANA timezone flows all the way to `Intl.DateTimeFormat` in DayDetailRow
- 17 new Vitest tests (9 row-action tests + 8 sheet/dashboard tests); full suite now 225 passing + 26 skipped (up from 208 baseline)
- Phase 12 ROADMAP must_have #2 fully satisfied: calendar + capped-dot modifiers (12-04a) + Sheet drawer + per-row View/Cancel/Copy-link/Send-reminder (12-04b)

## Task Commits

1. **Task 1: DayDetailRow component with 4 actions + AlertDialog confirmations** — `a2f9e2c` (feat)
2. **Task 2: DayDetailSheet drawer + HomeDashboard wrapper** — `7afbf15` (feat)
3. **Task 3: Wire HomeDashboard into /app page.tsx and pass account timezone** — `341f7b0` (feat)

## Files Created/Modified

- `app/(shell)/app/_components/day-detail-row.tsx` — Per-booking row: metadata display + Cancel/Copy-reschedule-link/Send-reminder AlertDialogs + clipboard fallback + View Link; `'use client'`
- `app/(shell)/app/_components/day-detail-sheet.tsx` — shadcn Sheet wrapper; formats date with Intl in account timezone; renders DayDetailRow list or empty-state via SheetDescription; `'use client'`
- `app/(shell)/app/_components/home-dashboard.tsx` — Client state container for open/selectedDate/selectedBookings; wires HomeCalendar.onDayClick → DayDetailSheet; `'use client'`
- `app/(shell)/app/page.tsx` — Extended SELECT to include `timezone`; replaced `<HomeCalendar>` with `<HomeDashboard>` + `accountTimezone={account.timezone}`; removed 12-04b placeholder comment
- `tests/day-detail-row.test.tsx` — 9 tests covering all 4 action paths, error toasts, clipboard write, clipboard fallback to readOnly input
- `tests/day-detail-sheet.test.tsx` — 8 tests: formatted date heading, empty-state, row count by data-testid, onOpenChange on Escape, HomeDashboard mount + closed-by-default

## Decisions Made

- **HomeDashboard is the drawer state container** — Sheet open state, selected date, and selected bookings all live in HomeDashboard; neither HomeCalendar nor DayDetailSheet own this state. Clean separation: HomeCalendar is pure display, DayDetailSheet is pure presentation, HomeDashboard owns coordination.
- **SheetDescription doubles as empty-state message** — When bookings=[], SheetDescription reads "No bookings on this day." and the body is an empty spacer div. This avoids duplicating the text (which would have caused RTL getByText multi-match failures).
- **Each action uses its own `useTransition`** — Four independent pending states; individual action buttons disable independently during execution. Could have used a single shared pending state but independent transitions are more precise.
- **DayDetailRow re-exports both named Server Actions in one import** — `cancelBookingAsOwner` and `sendReminderForBookingAction` both live in `app/(shell)/app/bookings/[id]/_lib/actions.ts`; two named imports from the same path.
- **`window.location.origin` for clipboard URL composition** — Plan specified this; DayDetailRow is a client component so `window` is available. Avoids env var lookup which isn't needed since the URL needs to be correct at client request time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SheetDescription empty-state text was duplicated**
- **Found during:** Task 2 (DayDetailSheet tests)
- **Issue:** Component initially rendered "No bookings on this day." in both SheetDescription AND a body `<p>` element. RTL `getByText` failed with "Found multiple elements". The duplicate body paragraph was unnecessary since SheetDescription already surfaced the message.
- **Fix:** Replaced the empty-state body `<p>` with an empty spacer `<div>`. SheetDescription remains the single source of the empty-state text.
- **Files modified:** `app/(shell)/app/_components/day-detail-sheet.tsx`
- **Verification:** Test (b) passes; single text node with "No bookings on this day." in the DOM.
- **Committed in:** `7afbf15` (Task 2 commit)

**2. [Rule 1 - Bug] Test selector ambiguity on "Cancel" button name**
- **Found during:** Task 1 (DayDetailRow tests, iteration 1)
- **Issue:** RTL `getByRole("button", { name: /cancel/i })` matched both the Cancel trigger button AND the AlertDialogCancel "Keep booking" / "Cancel" close button. Used `getAllByRole` + index 0 to target the trigger specifically.
- **Fix:** Changed test selector to `getAllByRole("button", { name: /^cancel$/i })[0]` (exact match, first element = trigger).
- **Files modified:** `tests/day-detail-row.test.tsx`
- **Verification:** Tests (b), (c), and error path all pass.
- **Committed in:** `a2f9e2c` (Task 1 commit)

**3. [Rule 2 - Missing Critical] afterEach(cleanup) added to RTL tests**
- **Found during:** Task 1 (DayDetailRow tests, iteration 1)
- **Issue:** RTL's automatic cleanup was not running between tests (possibly due to vitest environment config). Multiple renders were accumulating in the jsdom; `getByRole("button", { name: /copy reschedule link/i })` found 4 elements in test (d) because 4 prior tests had each rendered the component.
- **Fix:** Added `afterEach(() => cleanup())` to both test files.
- **Files modified:** `tests/day-detail-row.test.tsx`, `tests/day-detail-sheet.test.tsx`
- **Verification:** All getBy assertions resolve to single elements.
- **Committed in:** `a2f9e2c` and `7afbf15` respectively.

---

**Total deviations:** 3 auto-fixed (1 component bug, 2 test correctness fixes)
**Impact on plan:** All fixes required for test correctness and component correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Manual Smoke Status

**Deferred to Phase 13.** The dev server was not started in this session. Unit tests (17 new, all passing) are the load-bearing correctness verification. Phase 13 manual QA checklist for this plan:

### Phase 13 Smoke Checklist for 12-04b

- [ ] `/app` renders `HomeDashboard` (calendar visible, no JS errors in console)
- [ ] Click a day with NO bookings → Sheet opens with "No bookings on this day." in both description and body visible
- [ ] Click a day WITH bookings → Sheet opens; each booking shows name + time in Chicago timezone + event-type name
- [ ] Click **View** on a row → navigates to `/app/bookings/{id}` (back button works)
- [ ] Click **Cancel** → AlertDialog opens with correct booker name + time; click "Keep booking" → dialog closes without action; click "Yes, cancel" → toast "Booking cancelled." fires; page refreshes; booking disappears from calendar dots
- [ ] Click **Copy reschedule link** → AlertDialog warns about link invalidation; click "Generate & copy" → toast "Reschedule link copied."; paste URL into new tab → public reschedule page loads
- [ ] Click **Send reminder** → AlertDialog warns about token rotation; click "Send reminder" → toast "Reminder sent."; check Gmail inbox for reminder email; verify old cancel/reschedule links in original confirmation email no longer work
- [ ] Test clipboard fallback: disable clipboard permissions in browser dev tools → Copy reschedule link → confirm → inline readOnly input appears with URL; select and paste manually
- [ ] Sidebar "Home" navigation still routes to `/app` (12-03 IA preserved)

## Next Phase Readiness

Phase 12 is **fully complete** (all 7 plans: 12-01, 12-02, 12-03, 12-04a, 12-04b, 12-05, 12-06 done).

Phase 13 (Manual QA + Andrew Ship Sign-Off) can begin. Key items for Phase 13:
- Manual smoke of 12-04b drawer (checklist above)
- Phase 10 deferred QA items (P-A8 email_confirmed_at pre-flight, RLS 3-tenant browser QA, onboarding checklist browser QA)
- Phase 11 manual event-type capacity form smoke
- Phase 12 visual sweep: auth pages, dashboard chrome, public surfaces, email branded header
- NSI mark image swap (public/nsi-mark.png placeholder → real brand asset)

---
*Phase: 12-branded-ui-overhaul*
*Completed: 2026-04-29*
