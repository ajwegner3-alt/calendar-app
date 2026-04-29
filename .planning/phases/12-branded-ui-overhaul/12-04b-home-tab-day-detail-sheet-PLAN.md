---
phase: 12-branded-ui-overhaul
plan: 04b
type: execute
wave: 4
depends_on: ["12-04a"]
files_modified:
  - app/(shell)/app/_components/home-dashboard.tsx
  - app/(shell)/app/_components/day-detail-sheet.tsx
  - app/(shell)/app/_components/day-detail-row.tsx
  - app/(shell)/app/page.tsx
  - tests/day-detail-sheet.test.tsx
  - tests/day-detail-row.test.tsx
autonomous: true

must_haves:
  truths:
    - "Clicking a day-with-bookings on the Home calendar opens a shadcn Sheet drawer (right side on desktop, bottom on mobile via Sheet defaults) listing every booking on that day"
    - "Each row in the drawer shows booker name + start time (formatted to account timezone) + event-type name"
    - "Each row exposes 4 actions: View (link to /app/bookings/{id}), Cancel, Copy reschedule link, Send reminder"
    - "Cancel action opens an AlertDialog confirming the destructive cancel, then invokes cancelBookingAsOwner(bookingId)"
    - "Copy-reschedule-link action opens an AlertDialog warning that the previously-emailed link will be invalidated, then invokes regenerateRescheduleTokenAction and writes the resulting URL to the clipboard"
    - "Send-reminder action opens an AlertDialog warning that issuing a fresh reminder also rotates cancel/reschedule tokens (invalidating the previously-emailed links), then invokes sendReminderForBookingAction"
    - "Successful actions toast confirmation and refresh the page (revalidation already wired in the Server Actions); failures toast the returned error and keep the dialog open"
    - "Clicking a day with NO bookings opens the same drawer with an empty-state message ('No bookings on {date}.')"
  artifacts:
    - path: "app/(shell)/app/_components/home-dashboard.tsx"
      provides: "Client wrapper that owns drawer open/close state and connects HomeCalendar onDayClick to DayDetailSheet"
      exports: ["HomeDashboard"]
    - path: "app/(shell)/app/_components/day-detail-sheet.tsx"
      provides: "Client Sheet drawer rendering a list of DayDetailRow items for the selected date"
      exports: ["DayDetailSheet"]
    - path: "app/(shell)/app/_components/day-detail-row.tsx"
      provides: "Per-booking row with View / Cancel / Copy-reschedule-link / Send-reminder actions and confirmation AlertDialogs"
      exports: ["DayDetailRow"]
    - path: "app/(shell)/app/page.tsx"
      provides: "Renders <HomeDashboard /> wrapping HomeCalendar (replaces direct <HomeCalendar /> render)"
      contains: "HomeDashboard"
  key_links:
    - from: "app/(shell)/app/_components/home-dashboard.tsx"
      to: "app/(shell)/app/_components/home-calendar.tsx"
      via: "passes onDayClick callback that sets drawer open state + selected date/bookings"
      pattern: "onDayClick"
    - from: "app/(shell)/app/_components/day-detail-row.tsx"
      to: "app/(shell)/app/bookings/[id]/_lib/actions.ts"
      via: "imports cancelBookingAsOwner + sendReminderForBookingAction"
      pattern: "cancelBookingAsOwner|sendReminderForBookingAction"
    - from: "app/(shell)/app/_components/day-detail-row.tsx"
      to: "app/(shell)/app/_lib/regenerate-reschedule-token.ts"
      via: "imports regenerateRescheduleTokenAction; uses returned rawToken to compose /reschedule/{token} URL"
      pattern: "regenerateRescheduleTokenAction"
---

<objective>
Close the second half of the Home tab from Phase 12 must_have #2: ship the shadcn `Sheet` day-detail drawer with per-row View / Cancel / Copy-reschedule-link / Send-reminder actions. 12-04a delivered the calendar surface and all three Server Actions; this plan wires the UI consumer.

Purpose: Phase 12 verification cannot pass without this — ROADMAP.md must_have #2 explicitly requires the drawer with row actions. The Server Actions (`cancelBookingAsOwner`, `regenerateRescheduleTokenAction`, `sendReminderForBookingAction`) already exist; this plan only adds three new client components plus the page-level swap.

Critical pitfalls:
- Reschedule tokens are SHA-256-hashed at rest. "Copy link" must mint+store a new hash via `regenerateRescheduleTokenAction` and use the returned `rawToken` to compose `${appUrl}/reschedule/${rawToken}`. AlertDialog must warn that the previously-emailed link is invalidated (Pitfall 8 from research; STATE.md "Token rotation on every reminder send" precedent).
- `sendReminderForBookingAction` ALSO rotates both cancel + reschedule tokens (Phase 8 cron precedent). The AlertDialog should surface this so owners don't get blindsided.
- Clipboard write requires user gesture — call `navigator.clipboard.writeText` synchronously inside the dialog's confirm-handler click context after awaiting the Server Action; if clipboard fails, fall back to showing the URL in a copyable text input.
- Sheet `side` prop default is "right"; that's correct for desktop. shadcn Sheet does NOT auto-switch to bottom on mobile, but the layout is fine — leave default `right` and let the sheet take full height. Width: `w-full sm:max-w-md`.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/12-branded-ui-overhaul/12-CONTEXT.md
@.planning/phases/12-branded-ui-overhaul/12-04a-SUMMARY.md

# Existing primitives this plan consumes (do NOT re-implement)
@app/(shell)/app/_components/home-calendar.tsx
@app/(shell)/app/_lib/load-month-bookings.ts
@app/(shell)/app/_lib/regenerate-reschedule-token.ts
@app/(shell)/app/bookings/[id]/_lib/actions.ts
@app/(shell)/app/page.tsx

# shadcn primitives available
@components/ui/sheet.tsx
@components/ui/alert-dialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: DayDetailRow component with 4 actions + AlertDialog confirmations</name>
  <files>
    app/(shell)/app/_components/day-detail-row.tsx
    tests/day-detail-row.test.tsx
  </files>
  <action>
    Create `app/(shell)/app/_components/day-detail-row.tsx` (`'use client'`). One row per booking. Renders booker name, formatted start time (`Intl.DateTimeFormat` with `timeZone` prop — pass account timezone from prop), and event-type name. Below the metadata, four action affordances:

    1. **View** — plain `<Link href={\`/app/bookings/\${booking.id}\`}>` (no confirmation needed).

    2. **Cancel** — opens an `<AlertDialog>` with title "Cancel this booking?" and description naming the booker + start time. Confirm button is destructive variant. On confirm: calls `cancelBookingAsOwner(booking.id)`. On `{ ok: true }`: toast success + call `router.refresh()`. On `{ error }`: toast the error message; keep dialog open.

    3. **Copy reschedule link** — opens an `<AlertDialog>` titled "Generate a new reschedule link?" with description: "This will invalidate the link we previously emailed to {booker_name}. They'll only be able to reschedule via the new link." Confirm: calls `regenerateRescheduleTokenAction(booking.id)`. On success (returns `{ ok: true, rawToken }`): compose URL = `${window.location.origin}/reschedule/${rawToken}` (use `window.location.origin` rather than env — this is a client component); attempt `navigator.clipboard.writeText(url)`. If clipboard write succeeds, toast "Reschedule link copied." If it throws (some browsers block without user-gesture chain even though we're inside a click handler), fall back: show a small inline `<input readOnly value={url}>` next to the action so the owner can manually copy. On `{ error }`: toast.

    4. **Send reminder** — opens an `<AlertDialog>` titled "Send a reminder email now?" with description: "{booker_name} will receive a reminder for this booking. This rotates the cancel and reschedule tokens — the links from previous emails will stop working." Confirm: calls `sendReminderForBookingAction(booking.id)`. On `{ ok: true }`: toast "Reminder sent." On `{ error }`: toast.

    All four affordances render as small text-buttons inside a horizontal flex-wrap container under the metadata. Use existing button/dropdown styling conventions from the codebase — check `app/(shell)/app/bookings/[id]/_components/` for the canonical owner-action button pattern. If the existing detail page uses a `<DropdownMenu>` to consolidate Cancel + others, mirror that here for visual consistency. Otherwise, plain text-buttons in a row are fine.

    Use `useTransition()` to wrap each Server Action call so the buttons disable while pending. Use the existing toast helper — `sonner` is the project's toast lib (check `components/ui/sonner.tsx` or `lib/toast.ts`); follow whatever the existing owner-side toasting convention is.

    Props:
    ```ts
    interface DayDetailRowProps {
      booking: MonthBooking;       // imported type from ../_lib/load-month-bookings
      accountTimezone: string;     // IANA TZ (e.g., 'America/Chicago')
    }
    ```

    Tests at `tests/day-detail-row.test.tsx` using `@testing-library/react`:
    - Renders booker name, start time, event-type name
    - Cancel button click opens AlertDialog with destructive copy
    - Cancel confirm calls cancelBookingAsOwner with booking.id
    - Copy-reschedule-link confirm calls regenerateRescheduleTokenAction; success path calls navigator.clipboard.writeText with composed URL
    - Send-reminder confirm calls sendReminderForBookingAction
    - Error toast appears when action returns `{ error }`

    Use `vi.hoisted()` for Server Action mocks (the 12-04a pattern documented in 12-04a-SUMMARY.md).
  </action>
  <verify>
    1. `npm test -- day-detail-row` — all tests pass.
    2. `npx tsc --noEmit` clean for new component file.
    3. Manual smoke (deferred to Task 3): row renders inside a parent and all 4 actions are clickable.
  </verify>
  <done>
    `DayDetailRow` component renders metadata + 4 actions; AlertDialog confirmations cover all destructive/state-mutating actions; clipboard fallback in place; tests cover the four action paths.
  </done>
</task>

<task type="auto">
  <name>Task 2: DayDetailSheet drawer + HomeDashboard wrapper</name>
  <files>
    app/(shell)/app/_components/day-detail-sheet.tsx
    app/(shell)/app/_components/home-dashboard.tsx
    tests/day-detail-sheet.test.tsx
  </files>
  <action>
    Create `app/(shell)/app/_components/day-detail-sheet.tsx` (`'use client'`). Thin wrapper around shadcn `<Sheet>` / `<SheetContent>` / `<SheetHeader>` / `<SheetTitle>` / `<SheetDescription>`. Props:

    ```ts
    interface DayDetailSheetProps {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      date: Date | null;             // null when closed
      bookings: MonthBooking[];      // [] = empty-state branch
      accountTimezone: string;
    }
    ```

    Renders:
    - `<SheetTitle>` formats `date` to "Wednesday, May 6, 2026" using `Intl.DateTimeFormat` with the account timezone.
    - `<SheetDescription>` says "{count} booking{plural}" or — when bookings.length === 0 — "No bookings on this day."
    - Body: scrollable list of `<DayDetailRow>` separated by `<hr>` or border-bottom; or the empty-state message centered with muted text.
    - Width: `className="w-full sm:max-w-md"`. Default `side="right"`.

    Create `app/(shell)/app/_components/home-dashboard.tsx` (`'use client'`). Owns the drawer state. Renders `<HomeCalendar bookings={bookings} onDayClick={...} />` and `<DayDetailSheet>` as siblings. State:

    ```ts
    const [open, setOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedBookings, setSelectedBookings] = useState<MonthBooking[]>([]);
    ```

    `onDayClick` handler: store date + dayBookings, set `open = true`. Note: `HomeCalendar` already calls `onDayClick` on every day click (including empty days) — pass through unchanged so empty-state branch fires for those.

    Props:
    ```ts
    interface HomeDashboardProps {
      bookings: MonthBooking[];
      accountTimezone: string;       // forwarded to DayDetailSheet
    }
    ```

    Tests at `tests/day-detail-sheet.test.tsx`:
    - Renders SheetTitle with formatted date when open
    - Renders empty-state message when bookings prop is []
    - Renders one DayDetailRow per booking when bookings prop is populated (mock the row component with a passthrough that exposes booking.id as a data attribute, then count rendered ids)
    - onOpenChange propagates close
  </action>
  <verify>
    1. `npm test -- day-detail-sheet` — passes.
    2. `npx tsc --noEmit` clean.
    3. Sheet width respects `sm:max-w-md` (visual smoke at Task 3).
  </verify>
  <done>
    `DayDetailSheet` + `HomeDashboard` ship as a connected pair. Open state owned by HomeDashboard. Empty-state branch handles days with zero bookings.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire HomeDashboard into /app page.tsx and pass account timezone</name>
  <files>
    app/(shell)/app/page.tsx
  </files>
  <action>
    Modify `app/(shell)/app/page.tsx`:
    1. Extend the `accounts` SELECT to also include `timezone` (it's already a non-null column on the accounts table — verify against existing migrations).
    2. Replace `<HomeCalendar bookings={bookings} />` with `<HomeDashboard bookings={bookings} accountTimezone={account.timezone} />`.
    3. Remove the placeholder comment `{/* 12-04b: wrap HomeCalendar with a client-component... */}` since this plan ships that wrap.
    4. Update the import: drop `HomeCalendar`, add `HomeDashboard`.

    Manual smoke (you'll need to start dev server briefly):
    - `npm run dev` → log in as NSI owner → visit `/app`
    - Click a day with no bookings: drawer opens with "No bookings on this day."
    - Click a day with bookings: drawer opens; each row shows name + time + event-type + 4 action affordances.
    - Click View on a row: navigates to `/app/bookings/{id}` (existing detail page).
    - Click Cancel → confirm dialog → confirm: booking cancels (toast success); page refreshes; cancelled booking no longer appears in calendar dot count.
    - Click Copy reschedule link → confirm dialog → confirm: clipboard receives `${origin}/reschedule/{token}` (verify by pasting into another tab; the URL should load the public reschedule page).
    - Click Send reminder → confirm dialog → confirm: toast "Reminder sent"; check Gmail SMTP quota log to confirm no 200/day breach.

    Reset any test bookings created during smoke. Note any deviations in SUMMARY.

    NOTE: Manual smoke can be deferred to Phase 13 if the dev server is unavailable in this session. The unit tests from Tasks 1+2 are the load-bearing verification for code correctness; manual smoke confirms UX. Document the deferral in SUMMARY if you skip it.
  </action>
  <verify>
    1. `/app` renders the calendar AND the drawer wrapper without errors.
    2. `npx tsc --noEmit` clean.
    3. `npm test` — full suite still ≥208 passing (12-04a baseline) + new tests from Tasks 1+2.
    4. Sidebar Home item still routes here (12-03 IA preserved — no change to layout).
  </verify>
  <done>
    `/app` renders `<HomeDashboard>` instead of `<HomeCalendar>` directly. Day-detail drawer fires on every day click. All 4 actions reachable + functional. Phase 12 ROADMAP must_have #2 fully satisfied (calendar + modifiers + Sheet drawer + per-row View/Cancel/Copy-link/Send-reminder).
  </done>
</task>

</tasks>

<verification>
**Plan-level checks (after all 3 tasks complete):**
- `<HomeDashboard>` mounts on `/app` without error.
- Clicking any day on the calendar opens the Sheet drawer.
- Empty-state branch renders for days with zero bookings.
- All 4 row actions invoke their respective Server Actions; AlertDialog confirmations gate the destructive ones.
- Cancel removes the booking from the calendar after refresh.
- Copy-reschedule-link writes URL to clipboard (or falls back to inline input).
- Send-reminder rotates tokens (verify by checking that the booking row's `cancel_token_hash` and `reschedule_token_hash` change in the DB after action).
- All Vitest suites pass; `npx tsc --noEmit` clean.

**Requirements satisfied:**
- UI-07 (day-detail drawer)
- UI-08 (per-row View/Cancel/Copy-link/Send-reminder actions) — fully closes the requirement that 12-04a only partially addressed
</verification>

<success_criteria>
1. `DayDetailRow` ships with 4 actions + 3 confirmation AlertDialogs (View has none).
2. `DayDetailSheet` ships with empty-state branch.
3. `HomeDashboard` owns drawer state and replaces direct `<HomeCalendar>` render in `/app/page.tsx`.
4. Account `timezone` flows from page.tsx → HomeDashboard → DayDetailSheet → DayDetailRow for accurate time formatting.
5. Clipboard write has a graceful fallback (inline input) when blocked.
6. All Server Actions invoked correctly; success/error toasts wired.
7. Tests cover row action paths + sheet rendering + empty-state.
8. No regressions in Vitest baseline (208+) or `npx tsc --noEmit`.
9. Phase 12 ROADMAP must_have #2 fully satisfied.
</success_criteria>

<output>
After completion, create `.planning/phases/12-branded-ui-overhaul/12-04b-SUMMARY.md` documenting:
- Components shipped (DayDetailRow, DayDetailSheet, HomeDashboard)
- Server Action consumption pattern (3 actions + 3 AlertDialogs)
- Clipboard fallback behavior + which browsers triggered the fallback during smoke (if smoke ran)
- Whether manual smoke ran or was deferred to Phase 13
- For Phase 13 QA: visual smoke checklist for the drawer + each action path
</output>
