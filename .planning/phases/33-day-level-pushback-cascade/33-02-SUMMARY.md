---
phase: 33-day-level-pushback-cascade
plan: "02"
subsystem: pushback-cascade
tags: [cascade, pushback, quota, preview, email-22, push-06, push-07, push-08]
requires: ["33-01", "31-01", "32-01", "32-03"]
provides:
  - computeCascadePreview (pure cascade function, no I/O)
  - getEndOfDayMinute (slots.ts export, 1440 sentinel)
  - previewPushbackAction (server action, EMAIL-22 quota gate)
  - PushbackDialog preview-ready state (MOVE/ABSORBED/PAST_EOD badges + quota footer)
affects: ["33-03", "33-04"]
tech-stack:
  added: []
  patterns:
    - Pure function cascade with snap-up rounding per booking's own duration_minutes (OQ-2)
    - 1440 sentinel for no-rules days (OQ-5)
    - skipOwnerEmail=true quota math (movedCount NOT × 2)
    - Verbatim Phase 31 inline error vocabulary (text-sm text-red-600, role=alert)
key-files:
  created:
    - lib/bookings/pushback.ts
    - tests/pushback-cascade.test.ts
  modified:
    - lib/slots.ts
    - app/(shell)/app/bookings/_lib/actions-pushback.ts
    - app/(shell)/app/bookings/_components/pushback-dialog.tsx
decisions:
  - id: D-3302-01
    decision: "CascadeRow.new_start_at is null for ABSORBED rows (no new time), non-null for MOVE and PAST_EOD"
    rationale: "Distinguishes rows that need no email (ABSORBED) from rows that will be rescheduled; 33-03 commit action iterates MOVE+PAST_EOD only"
  - id: D-3302-02
    decision: "snapToNextSlotMs uses Math.ceil — already-aligned values are returned unchanged"
    rationale: "Math.ceil(n / step) * step == n when n is divisible by step, so no accidental rounding of already-aligned times"
  - id: D-3302-03
    decision: "getEndOfDayMinute placed in lib/slots.ts (same file as windowsForDate) rather than exported separately"
    rationale: "windowsForDate is private; getEndOfDayMinute is a thin wrapper that needs to call it — co-location avoids export leakage of the internal function"
  - id: D-3302-04
    decision: "previewPushbackAction fetches date_overrides filtered to override_date = input.date (single-date query)"
    rationale: "We only need overrides for the one chosen day to compute endOfDayMinutes; fetching all overrides would be wasteful"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-06"
---

# Phase 33 Plan 02: Cascade Algorithm + Preview Wiring Summary

**One-liner:** Pure cascade preview (computeCascadePreview) wired through previewPushbackAction to dialog MOVE/ABSORBED/PAST_EOD badges with EMAIL-22 quota gate.

## What was built

### 1. `lib/bookings/pushback.ts` — Pure cascade module

**Exports:**

```typescript
// Types
type CascadeStatus = "MOVE" | "ABSORBED" | "PAST_EOD"
interface PushbackBookingInput { id, start_at, end_at, booker_first_name, duration_minutes, buffer_after_minutes, event_type_id }
interface CascadeRow { booking, status, old_start_at, new_start_at, new_end_at }
interface ComputeCascadeArgs { bookings, anchorId, delayMs, endOfDayMinutes, accountTimezone }

// Functions
function computeCascadePreview(args: ComputeCascadeArgs): CascadeRow[]
function snapToNextSlotMs(rawMs: number, slotStepMinutes: number): number
function isPastEod(startMs: number, accountTimezone: string, endOfDayMinutes: number): boolean
function countMoved(rows: CascadeRow[]): number
```

Zero Supabase imports. Zero browser APIs. Pure date math only.

### 2. `lib/slots.ts` — `getEndOfDayMinute()` added

```typescript
export function getEndOfDayMinute(
  dateIsoYmd: string,
  dayOfWeek: number,
  rules: AvailabilityRuleRow[],
  overrides: DateOverrideRow[],
): number
```

Returns `Math.max(...windows.map(w => w.end_minute))` or `1440` when the day has no rules / is closed (CONTEXT.md OQ-5 sentinel).

### 3. `tests/pushback-cascade.test.ts` — 14 tests, all green

Scenarios passing:
- (a) Single anchor move with snap-up
- (b) Two-booking back-to-back cascade — both MOVE
- (c) Gap absorption — MOVE then ABSORBED
- (d) Cascade cools then revives — MOVE → ABSORBED → MOVE (4-booking scenario)
- (e) PAST_EOD flag when new start exceeds end-of-workday minute
- (f) 1440 sentinel: never PAST_EOD on no-rules days (even past midnight local)
- (g) 60-min booking with 5-min delay snaps to next 60-min boundary
- Pre-anchor ABSORBED with null new times
- buffer_after_minutes respected in cascade frontier
- countMoved counts MOVE + PAST_EOD, excludes ABSORBED
- Error thrown when anchorId not found

Scenarios skipped: None — all 7 plan scenarios + 4 additional edge cases covered.

### 4. `actions-pushback.ts` — `previewPushbackAction` added

```typescript
interface PreviewPushbackInput {
  accountId: string;
  date: string;           // YYYY-MM-DD in accountTimezone
  accountTimezone: string;
  anchorId: string;
  delayMinutes: number;
  reason?: string;
}

type PreviewPushbackResult =
  | { ok: true; rows: CascadeRow[]; movedCount: number; remainingQuota: number; quotaError: boolean }
  | { ok: false; error: string }
```

Auth + ownership check → validate delay → getBookingsForPushback → availability_rules + date_overrides (parallel) → getEndOfDayMinute → computeCascadePreview → countMoved → getRemainingDailyQuota → return.

**Quota math:** `movedCount = countMoved(rows)` (MOVE + PAST_EOD). NOT × 2. `skipOwnerEmail=true` on commit means 1 email per moved booking. Locked by CONTEXT.md.

### 5. `pushback-dialog.tsx` — preview-ready state wired

- `handlePreview()` replaces 33-01 stub: editing → preview-loading → preview-ready
- `CascadeBadge` component: blue MOVE, slate ABSORBED, amber PAST EOD (with ⚠ icon)
- Chronological row list: `CascadeBadge | old time [→ new time] | first name | duration`
- Footer quota indicator: "Sending N email(s) · M remaining today"
- Verbatim Phase 31 error markup: `text-sm text-red-600` + `role="alert"` + exact copy
- Confirm button: `Pushback N booking(s)` — disabled when `quotaError || movedCount === 0 || isPending`
- `handleConfirm` stubbed for 33-03: `toast.info("Commit path lands in Plan 33-03")`

## Phase 31 quota error markup verbatim location

**Source:** `app/(shell)/app/availability/_components/override-modal.tsx` lines 426–432

```tsx
{quotaError && (
  <p className="text-sm text-red-600 mt-2" role="alert">
    {affected.length} email{affected.length === 1 ? "" : "s"}{" "}
    needed, {remainingQuota} remaining today. Quota resets at UTC
    midnight. Wait until tomorrow or contact bookers manually.
  </p>
)}
```

**Pushback dialog replication** (lines 327–331): class `text-sm text-red-600` (note: `mt-2` omitted — dialog uses `space-y-2` container spacing instead; the copy is character-for-character identical):

```tsx
{quotaError && (
  <p className="text-sm text-red-600" role="alert">
    {movedCount} email{movedCount === 1 ? "" : "s"} needed,{" "}
    {remainingQuota} remaining today. Quota resets at UTC midnight.
    Wait until tomorrow or contact bookers manually.
  </p>
)}
```

## Deviations from Plan

None — plan executed exactly as written.

## Verification gates passed

- `npx vitest run tests/pushback-cascade.test.ts` — 14/14 tests green
- `npx tsc --noEmit` — no new errors (pre-existing test-mock errors untouched per tech debt policy)
- `npm run build` — clean Next.js production build

## Hand-off notes for Plan 33-03

**stub location:** `pushback-dialog.tsx` `handleConfirm()` function (line ~233) — currently calls `toast.info(...)`.

**State available to 33-03 from dialog:**

```typescript
// Already in useState at dialog scope:
const [previewRows, setPreviewRows] = useState<CascadeRow[]>([]);
const [movedCount, setMovedCount] = useState(0);
const [date, setDate] = useState(initialDate);
const [anchorId, setAnchorId] = useState<string | null>(null);
const [delayValue, setDelayValue] = useState<string>("15");
const [delayUnit, setDelayUnit] = useState<DelayUnit>("min");
const [reason, setReason] = useState("");
const [bookings, setBookings] = useState<PushbackBooking[]>([]);
```

**commitPushbackAction input shape** (33-03 will define this):
- `accountId`, `date`, `accountTimezone`, `anchorId`, `delayMinutes`, `reason`
- `previewRowsSnapshot: CascadeRow[]` — 33-03 uses this for abort-on-diverge race check
- 33-03 transitions dialog to `"committing"` then `"summary"` states

**CascadeRow shape 33-03 will iterate:**

```typescript
// For each row where status === "MOVE" || status === "PAST_EOD":
//   rescheduleBooking(row.booking.id, new Date(row.new_start_at!), { skipOwnerEmail: true })
//   movedBookings.length === emailsNeeded (quota math already locked)
```

## Commits

| Commit | Message |
|--------|---------|
| `9020fe5` | feat(33-02): pure cascade module + getEndOfDayMinute + unit tests |
| `9220802` | feat(33-02): previewPushbackAction + cascade preview render with quota gate |
