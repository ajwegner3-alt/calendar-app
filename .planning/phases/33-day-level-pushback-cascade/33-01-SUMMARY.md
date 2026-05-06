---
phase: 33-day-level-pushback-cascade
plan: "01"
subsystem: bookings-pushback-ui
tags:
  - pushback
  - dialog
  - day-grouped-view
  - server-actions
  - react-context
  - timezone

dependency-graph:
  requires:
    - "32-inverse-date-overrides (Phase 32)"
    - "31-email-hard-cap-guard (Phase 31) — quota guard patterns"
  provides:
    - PushbackDialog shell (five-state machine, editing state fully implemented)
    - PushbackDialogProvider (context, header button, day-section button)
    - BookingsDayGroupedView (upcoming filter only)
    - getBookingsForPushback query (TZDate day-window, event_types join)
    - getBookingsForPushbackAction server action
    - accountTimezone + todayIsoYmd threaded from server to client on /app/bookings
  affects:
    - "33-02 (cascade preview): will wire previewPushbackAction into dialog state machine"
    - "33-03 (commit path): will wire commitPushbackAction + reschedule lifecycle"
    - "33-04 (summary + retry): will wire summary state + per-row retry"

tech-stack:
  added: []
  patterns:
    - "React Context for shared dialog state (PushbackDialogCtx — mirrors DateOverridesSection pattern)"
    - "TZDate day-window UTC bounds (getBookingsForPushback — mirrors getAffectedBookings Phase 32)"
    - "Server action ownership check (inline auth pattern — matches Phase 32 actions-batch-cancel)"
    - "Five-state dialog machine (editing/preview-loading/preview-ready/committing/summary)"
    - "Conditional view swap: day-grouped (upcoming filter) vs flat table (other filters)"

key-files:
  created:
    - app/(shell)/app/bookings/_components/pushback-dialog.tsx
    - app/(shell)/app/bookings/_components/pushback-dialog-provider.tsx
    - app/(shell)/app/bookings/_components/bookings-day-grouped-view.tsx
    - app/(shell)/app/bookings/_lib/actions-pushback.ts
  modified:
    - app/(shell)/app/bookings/_lib/queries.ts
    - app/(shell)/app/bookings/page.tsx

decisions:
  - id: "33-01-D01"
    decision: "Native <input type='radio'> used for anchor selection instead of shadcn RadioGroup"
    rationale: "shadcn RadioGroup is not installed in this project. Native radio inputs with role='radiogroup' parent, aria-label, and accent-primary styling provide identical accessibility and functionality."
    impact: "33-02 can add anchor selection behavior directly — no migration needed."
  - id: "33-01-D02"
    decision: "PushbackHeaderButton rendered as a client leaf inside server JSX"
    rationale: "Placing PushbackHeaderButton as a direct child of the server page's <header> element (inside the PushbackDialogProvider tree) avoids the need for a separate 'ButtonSlot' prop pattern. The server renders a client tree node; the client button accesses context directly. Consistent with Phase 26 RSC boundary precedent."
    impact: "page.tsx imports PushbackHeaderButton and places it in the header flex row."
  - id: "33-01-D03"
    decision: "BookingsDayGroupedView is NOT 'use client' — it is server-renderable"
    rationale: "TZDate is available in server components. PushbackDaySectionButton is a client leaf imported into the server component. The RSC boundary is at the button level, not the entire view. This avoids hydrating the full day-grouped view on the client."
    impact: "bookings are grouped server-side; only the button leaves hydrate."
  - id: "33-01-D04"
    decision: "bookings-day-grouped-view.tsx formats times in BOOKER timezone (not account timezone)"
    rationale: "Phase 4 lock: owner surfaces show times in the BOOKER's timezone to match what the booker received in their confirmation email. Consistent with bookings-table.tsx. The anchor selection inside the DIALOG uses account timezone (separate display context)."
    impact: "No change to Phase 4 lock. Dialog's formatLocalTime uses accountTimezone."

metrics:
  duration: "~7 minutes"
  completed: "2026-05-06"
---

# Phase 33 Plan 01: Pushback Dialog Shell + Day-Grouped View Summary

**One-liner:** Foundation UI for day-level pushback cascade — PushbackDialog 5-state shell with editing form fully wired (date picker, anchor-radio bookings list, delay input + Min/Hr toggle, 280-char reason textarea), context-based PushbackDialogProvider sharing one dialog between header button and per-day section buttons, BookingsDayGroupedView for upcoming filter, getBookingsForPushback query with TZDate day-window and event_types join.

## What Was Built

### 1. `getBookingsForPushback` query (queries.ts)

New export alongside existing `queryBookings`. Uses the canonical TZDate day-window pattern from Phase 32 `getAffectedBookings`:
- `new TZDate("YYYY-MM-DDT00:00:00", accountTimezone)` as local midnight
- UTC bounds: `localMidnight.toISOString()` → `(localMidnight + 24h).toISOString()`
- Selects `event_types!inner(id, name, duration_minutes, buffer_after_minutes)` — 33-02 cascade math needs duration_minutes; 33-03 needs reschedule_token_hash for CAS guard
- Returns `PushbackBooking[]` sorted chronologically ascending

### 2. `accountTimezone` threading (page.tsx)

Added `timezone` to the existing accounts SELECT (was `"id"` → now `"id, timezone"`). Default: `"America/Chicago"` (project standard). `todayIsoYmd` computed via TZDate. Both values passed as plain string props to `PushbackDialogProvider` (RSC-safe, Phase 26 precedent).

### 3. `PushbackDialog` (pushback-dialog.tsx)

Five-state machine (Phase 32 override-modal.tsx pattern):
- `editing` — fully implemented (date picker, bookings list, delay, reason)
- `preview-loading` — stub placeholder for 33-02
- `preview-ready` — stub placeholder for 33-02
- `committing` — stub placeholder for 33-03
- `summary` — stub placeholder for 33-04

State stored in `useState<PushbackDialogState>`. Re-seeded on `[open, initialDate]` change via `useEffect` (same pattern as override-modal.tsx line 116). Booking fetch triggered by `[open, date, accountId, accountTimezone]` effect using `useTransition`.

Key props exposed to 33-02:
- `date: string` — selected YYYY-MM-DD
- `bookings: PushbackBooking[]` — loaded confirmed bookings for date
- `anchorId: string | null` — selected anchor booking ID
- `delayValue: string` — raw delay number input value
- `delayUnit: DelayUnit ("min" | "hr")` — unit toggle state
- `reason: string` — reason textarea content

### 4. `actions-pushback.ts` (server action file)

`getBookingsForPushbackAction({ accountId, date, accountTimezone })`:
- Auth check via `supabase.auth.getUser()`
- Ownership check via `accounts.owner_user_id` comparison
- Delegates to `getBookingsForPushback(supabase, { ... })`
- Returns `{ ok: boolean; bookings: PushbackBooking[]; error?: string }`

33-02 will append `previewPushbackAction`, 33-03 will append `commitPushbackAction`, 33-04 will append `retryPushbackEmailAction` to this same file.

### 5. `PushbackDialogProvider` (pushback-dialog-provider.tsx)

Context design:
- `PushbackDialogCtx` exposes `{ openDialog(date: string): void }`
- `PushbackDialogProvider` holds `[open, initialDate]` state; renders `{children}` + single `<PushbackDialog>` instance
- `usePushbackDialog()` hook for descendant buttons
- `PushbackHeaderButton` — page header entry point (opens with today)
- `PushbackDaySectionButton` — per-day shortcut (opens with that date)

Both buttons call `openDialog(date)` → sets `initialDate` → opens dialog.

### 6. `BookingsDayGroupedView` (bookings-day-grouped-view.tsx)

Server-renderable component (no `"use client"`). Groups `BookingRow[]` by local YYYY-MM-DD key in `accountTimezone` using TZDate. Renders:
- `<section aria-label={dayLabel}>` per group
- Section header: `formatDayLabel()` (Intl weekday+month+day) + `<PushbackDaySectionButton date={key} />`
- Booking rows: inline row render matching bookings-table.tsx data (booker_name, booker_email, event name, duration, start time in BOOKER timezone, status badge)

Times shown in BOOKER timezone (Phase 4 lock, consistent with BookingsTable).

### 7. `page.tsx` extension

- Wraps entire page in `<PushbackDialogProvider>`
- Renders `<PushbackHeaderButton todayIsoYmd={todayIsoYmd} />` in page header
- Conditional: `statusFilter === "upcoming"` → `<BookingsDayGroupedView>` else flat `<BookingsTable>` + `<BookingsPagination>`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn RadioGroup not installed**

- **Found during:** Task 2, step where plan specified `import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"`
- **Issue:** `components/ui/radio-group.tsx` does not exist in this project
- **Fix:** Used accessible native `<input type="radio">` with `role="radiogroup"` parent div, `aria-label`, per-item `id`/`htmlFor` pairing, and `accent-primary` Tailwind class. Functionally and accessibility-wise identical to shadcn RadioGroup.
- **Files modified:** `pushback-dialog.tsx`
- **Impact on 33-02:** None — anchor selection is a controlled value (`anchorId` state setter); 33-02 only needs to read it, not change the widget

**2. [Rule 3 - Blocking] PushbackHeaderButton placement required architectural adjustment**

- **Found during:** Task 3, when wiring page.tsx JSX
- **Issue:** Original plan showed `PushbackDialogProvider` rendering the header button implicitly. This doesn't place it in the page header's flex row.
- **Fix:** Exported `PushbackHeaderButton` as a named export from `pushback-dialog-provider.tsx`. Page.tsx imports and renders it inside the `<header>` div, inside the provider tree. Context access works because it's a descendant.
- **Files modified:** `pushback-dialog-provider.tsx`, `page.tsx`
- **Impact:** Clean layout — no invisible-button-above-content issue

## Hand-off Notes for 33-02

33-02 wires `previewPushbackAction` into the dialog. Key state setter names and prop shapes:

```typescript
// State machine control (inside PushbackDialog):
setState("preview-loading")       // trigger before action call
setState("preview-ready")         // trigger after successful preview
setState("editing")               // trigger on Back or error

// Form values available at Preview click:
const anchorId: string | null     // selected anchor booking ID
const delayValue: string          // e.g. "15" — parse to Number(delayValue)
const delayUnit: "min" | "hr"     // unit for delayValue
const reason: string              // optional owner reason
const date: string                // YYYY-MM-DD in accountTimezone
const bookings: PushbackBooking[] // current day's confirmed bookings (already loaded)
const accountTimezone: string     // IANA tz — passed as prop from provider
const accountId: string           // account UUID — passed as prop from provider

// To convert delay to milliseconds for cascade math:
const delayMs = Number(delayValue) * (delayUnit === "hr" ? 60 : 1) * 60_000;

// Action file to append previewPushbackAction to:
app/(shell)/app/bookings/_lib/actions-pushback.ts
```

33-02 should also wire the **Preview button footer state transitions** — the current stub `onClick` sets `state = "preview-ready"` directly (no actual computation). Replace with:
```typescript
setState("preview-loading");
startTransition(async () => {
  const result = await previewPushbackAction({ ... });
  if (result.ok) {
    // store result in state
    setState("preview-ready");
  } else {
    setState("editing");
    // show error
  }
});
```

## Verification Results

- `npx tsc --noEmit`: PASS (0 new errors; pre-existing test-file tech debt unchanged)
- `npm run build`: PASS (`/app/bookings` route compiled as dynamic ƒ)
- Task 1 verify: `getBookingsForPushback` exported, `PushbackBooking` type declared, `event_types!inner` with duration/buffer fields, `accountTimezone` fetched from accounts table
- Task 2 verify: 5-state machine present, `maxLength={280}`, `min={todayLocal}`, Min/Hr toggle, `getBookingsForPushbackAction` in actions-pushback.ts
- Task 3 verify: `PushbackHeaderButton` in page.tsx header, `<PushbackDialogProvider` wrapping page, `BookingsDayGroupedView` conditional render, `PushbackDaySectionButton` per day section, context via `usePushbackDialog`/`PushbackDialogCtx`

## Commits

- `89b10b1` — feat(33-01): add getBookingsForPushback query + accountTimezone wiring
- `760a345` — feat(33-01): PushbackDialog shell — date picker, anchor radios, delay input, reason textarea
- `86192c6` — feat(33-01): PushbackDialogProvider + day-grouped view + page mount
