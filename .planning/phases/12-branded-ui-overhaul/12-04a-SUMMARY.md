---
phase: 12-branded-ui-overhaul
plan: 04a
subsystem: ui
tags: [react-day-picker, server-actions, calendar, token-rotation, reminder-email]

# Dependency graph
requires:
  - phase: 12-03
    provides: shell layout with GradientBackdrop + FloatingHeaderPill; sidebar Home item routes to /app
  - phase: 10-09
    provides: OnboardingChecklist component at components/onboarding-checklist.tsx
  - phase: 08-04
    provides: sendReminderBooker canonical sender + token-rotation precedent
  - phase: 06-03
    provides: hashToken + generateBookingTokens in lib/bookings/tokens.ts

provides:
  - loadMonthBookings server-only query (app/(shell)/app/_lib/load-month-bookings.ts)
  - regenerateRescheduleTokenAction Server Action (app/(shell)/app/_lib/regenerate-reschedule-token.ts)
  - sendReminderForBookingAction Server Action (app/(shell)/app/bookings/[id]/_lib/actions.ts)
  - HomeCalendar client component with capped-dot DayButton (app/(shell)/app/_components/home-calendar.tsx)
  - OnboardingBanner compact wrapper (app/(shell)/app/_components/onboarding-banner.tsx)
  - Refactored /app page.tsx (WelcomeCard removed, calendar + banner wired)
affects:
  - 12-04b (DayDetailSheet drawer — consumes onDayClick callback + both new Server Actions)
  - Phase 13 QA (visual smoke of calendar, dots, banner, empty state)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() for mocks that reference variables in vi.mock() factory functions"
    - "Inline accounts SELECT (no helper wrapper) — canonical auth pattern confirmed"
    - "Server Action token rotation: crypto.randomUUID() + hashToken() for single-token rotation (vs generateBookingTokens() for both)"

key-files:
  created:
    - app/(shell)/app/_lib/load-month-bookings.ts
    - app/(shell)/app/_lib/regenerate-reschedule-token.ts
    - app/(shell)/app/_components/home-calendar.tsx
    - app/(shell)/app/_components/onboarding-banner.tsx
    - tests/load-month-bookings.test.ts
    - tests/regenerate-reschedule-token.test.ts
    - tests/send-reminder-for-booking.test.ts
  modified:
    - app/(shell)/app/bookings/[id]/_lib/actions.ts
    - app/(shell)/app/page.tsx

key-decisions:
  - "Empty-state copy: 'No bookings in {Month YYYY}. Bookings will appear here as they're scheduled.' (research recommendation) — calendar still renders behind it for month navigation"
  - "WelcomeCard removed — replaced by HomeCalendar; flagged for revisit in v1.2 if Andrew wants a welcome message"
  - "OnboardingBanner is a thin div wrapper preserving existing OnboardingChecklist visibility gate (no new logic)"
  - "regenerateRescheduleTokenAction composes crypto.randomUUID() + hashToken() rather than generateBookingTokens() (which mints both cancel + reschedule — overshoots scope for single-token rotation)"
  - "sendReminderForBookingAction rotates BOTH cancel and reschedule tokens before sending (matches Phase 8 cron precedent in app/api/cron/send-reminders/route.ts); owner-initiated reminder also invalidates booker's existing email links — accepted side effect"
  - "Supabase FK join (event_types!inner) returns array type in TS inference; cast via (Array.isArray(raw) ? raw[0] : raw) as TypedShape to handle mismatch cleanly"
  - "HomeCalendar uses UTC date key (YYYY-MM-DD from ISO slice) for day grouping; v1.2 upgrade to account IANA timezone via TZDate"
  - "Dot color via CSS var --brand-primary with hsl(var(--primary)) fallback; Phase 7 pitfall LOCKED (no runtime Tailwind dynamic classes)"

patterns-established:
  - "vi.hoisted() pattern: declare mock spy variables via vi.hoisted() before vi.mock() factories to avoid TDZ hoisting errors"
  - "_lib/ and _components/ colocated directories inside route group for route-scoped server + client primitives"

# Metrics
duration: 7min
completed: 2026-04-29
---

# Phase 12 Plan 04a: Home-Tab-Server-and-Calendar Summary

**Monthly calendar Home tab with capped booking-day dots, server-only month query, and two owner Server Actions (reschedule-token rotation + manual reminder send with Phase 8 token-rotation precedent)**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-29T12:53:32Z
- **Completed:** 2026-04-29T13:00:20Z
- **Tasks:** 3
- **Files modified/created:** 9

## Accomplishments
- `loadMonthBookings` server-only query: RLS-scoped + explicit account_id filter, status='confirmed', month range via startOfMonth/endOfMonth
- `regenerateRescheduleTokenAction`: mints fresh reschedule token, stores new hash, returns rawToken — invalidates old emailed link (Phase 8 cron precedent)
- `sendReminderForBookingAction`: rotates both cancel + reschedule tokens then delegates to `sendReminderBooker`; added next to existing `cancelBookingAsOwner` in same file for 12-04b single-import convenience
- `HomeCalendar`: custom DayButton with capped dots (1-3 dots + "+N" overflow); `onDayClick(date, dayBookings)` prop exposed for 12-04b drawer wiring
- `OnboardingBanner`: thin mb-6 wrapper preserving Phase 10 ONBOARD-09 visibility gate
- `/app/page.tsx` refactored: WelcomeCard removed, banner + header + empty-state + calendar wired; all Phase 10 redirects and checklist gate logic preserved verbatim
- 17 new unit tests (12 for month query + regenerate-token, 5 for sendReminder); total 208 passing + 26 skipped (up from 191)

## Task Commits

1. **Task 1: load-month-bookings + regenerate-reschedule-token** - `99a9ec8` (feat)
2. **Task 2: sendReminderForBookingAction** - `c48f541` (feat)
3. **Task 3: HomeCalendar + OnboardingBanner + page.tsx refactor** - `f93bab9` (feat)

**Plan metadata:** (docs commit follows this SUMMARY)

## Files Created/Modified
- `app/(shell)/app/_lib/load-month-bookings.ts` - server-only month bookings query, account-scoped, status='confirmed'
- `app/(shell)/app/_lib/regenerate-reschedule-token.ts` - Server Action: mint + store new reschedule hash, return rawToken
- `app/(shell)/app/_components/home-calendar.tsx` - client calendar wrapper with capped-dot DayButton
- `app/(shell)/app/_components/onboarding-banner.tsx` - thin wrapper for OnboardingChecklist above-calendar placement
- `app/(shell)/app/bookings/[id]/_lib/actions.ts` - added sendReminderForBookingAction (cancelBookingAsOwner unchanged)
- `app/(shell)/app/page.tsx` - refactored: WelcomeCard removed, HomeCalendar + OnboardingBanner + loadMonthBookings wired
- `tests/load-month-bookings.test.ts` - 6 unit tests
- `tests/regenerate-reschedule-token.test.ts` - 6 unit tests
- `tests/send-reminder-for-booking.test.ts` - 5 unit tests

## Decisions Made

1. **Empty-state copy** — "No bookings in {Month YYYY}. Bookings will appear here as they're scheduled." — calendar renders behind it so owner can navigate to other months even when current month is empty.

2. **WelcomeCard removed** — Replaced by the calendar landing. v1.2 candidate if Andrew wants a welcome message element; flagged in this summary for revisit.

3. **OnboardingBanner is a thin wrapper** — No new visibility logic. The existing `OnboardingChecklist` already gates itself server- and client-side per Phase 10 ONBOARD-09.

4. **regenerateRescheduleTokenAction composes primitives directly** — `crypto.randomUUID() + hashToken()` rather than `generateBookingTokens()`. The latter mints both cancel + reschedule tokens — overshoots scope when only one needs rotation.

5. **sendReminderForBookingAction rotates BOTH tokens** — Matches Phase 8 cron behavior exactly. Side effect: previously-emailed cancel/reschedule links are invalidated. Accepted per project pattern (STATE.md lock).

6. **Supabase FK join type assertion** — TypeScript infers `event_types` join as array; resolved via `(Array.isArray(raw) ? raw[0] : raw) as TypedShape`. No new lib needed.

7. **UTC date bucketing in HomeCalendar** — `toISOString().slice(0, 10)` for day key. v1.2: upgrade to account IANA timezone using TZDate when account timezone is available client-side.

8. **Dot color via CSS var** — `var(--brand-primary, hsl(var(--primary)))` inline style. Phase 7 pitfall LOCKED: no runtime Tailwind dynamic classes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.hoisted() required for mock variable references**
- **Found during:** Task 1 test run
- **Issue:** `mockRevalidatePath` variable referenced inside `vi.mock()` factory triggered TDZ error (vitest hoists `vi.mock()` factories before variable declarations)
- **Fix:** Used `vi.hoisted()` to declare all mock functions before `vi.mock()` factories. Applied pattern to both regenerate-reschedule-token and send-reminder-for-booking tests
- **Files modified:** tests/regenerate-reschedule-token.test.ts, tests/send-reminder-for-booking.test.ts
- **Verification:** All 11 tests in those files pass
- **Committed in:** `99a9ec8` + `c48f541`

**2. [Rule 1 - Bug] endOfMonth date range test assertion**
- **Found during:** Task 1 test run
- **Issue:** Test asserted `lteArgs[1]` starts with `2026-04-30` but `endOfMonth` returns last millisecond of April in local time, which can be `2026-05-01T04:59:59.999Z` in UTC when timezone offset > 0
- **Fix:** Changed assertion to verify `lteDate > gteDate` and `lteDate < May 2nd UTC` (timezone-agnostic)
- **Files modified:** tests/load-month-bookings.test.ts
- **Verification:** Test passes in all timezone environments
- **Committed in:** `99a9ec8`

**3. [Rule 1 - Bug] Supabase FK join TypeScript type mismatch**
- **Found during:** Task 2 TSC check
- **Issue:** `booking.event_types` inferred as array by TS (Supabase join inference) but is a single object at runtime
- **Fix:** `(Array.isArray(raw) ? raw[0] : raw) as TypedShape` cast
- **Files modified:** app/(shell)/app/bookings/[id]/_lib/actions.ts
- **Verification:** `tsc --noEmit` clean (no test-file errors in production code)
- **Committed in:** `c48f541`

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bugs)
**Impact on plan:** All fixes for correctness; no scope creep.

## Issues Encountered
None beyond the three auto-fixed bugs above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness

**12-04b can plug in immediately:**
- `HomeCalendar` exposes `onDayClick(date, dayBookings)` — 12-04b wraps it with a small client component that opens `DayDetailSheet`
- `regenerateRescheduleTokenAction` and `sendReminderForBookingAction` are both ready; 12-04b adds AlertDialog warning UX before invocation
- `cancelBookingAsOwner` is unchanged in the same file — 12-04b imports all three from one path

**Cookie-state note:** `HomeCalendar` uses local `useState` only; sidebar_state cookie untouched.

**Phase 13 QA items:**
- Visual smoke: visit /app, confirm calendar renders with booking dots, capped dots for days with >3 bookings
- Empty state renders for months with no bookings
- OnboardingBanner shows for new accounts within 7-day window
- Onboarding-incomplete redirect to /onboarding preserved

---
*Phase: 12-branded-ui-overhaul*
*Completed: 2026-04-29*
