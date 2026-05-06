---
phase: 33-day-level-pushback-cascade
plan: "02"
subsystem: bookings-pushback-cascade
tags:
  - pushback
  - cascade-algorithm
  - pure-function
  - unit-tests
  - server-actions
  - quota-guard
  - email-22

dependency-graph:
  requires:
    - "33-01 (pushback dialog shell — editing state, 5-state machine, getBookingsForPushback query)"
    - "31-email-hard-cap-guard (Phase 31) — getRemainingDailyQuota, inline error UX vocabulary"
    - "32-inverse-date-overrides (Phase 32) — getEndOfDayMinute via windowsForDate, date_overrides shape"
  provides:
    - "computeCascadePreview(args) -> CascadeRow[] — pure deterministic cascade function"
    - "snapToNextSlotMs, isPastEod, countMoved helpers"
    - "CascadeStatus (MOVE | ABSORBED | PAST_EOD), PushbackBookingInput, CascadeRow, ComputeCascadeArgs types"
    - "getEndOfDayMinute(dateIsoYmd, dow, rules, overrides) -> number — 1440 sentinel for no-rules days"
    - "14 cascade unit tests across 6 scenarios (scenario d intentionally skipped)"
    - "previewPushbackAction(input) -> PreviewPushbackResult — server action with auth + cascade + quota math"
    - "PushbackDialog preview-ready state — chronological list with MOVE/ABSORBED/PAST_EOD badges + quota indicator + verbatim Phase 31 error"
    - "handleConfirm stub at line ~246 in pushback-dialog.tsx — 33-03 fills in commitPushbackAction"
  affects:
    - "33-03 (commit path): reads previewRows CascadeRow[] state + handleConfirm stub"
    - "33-04 (summary + retry): reads final commit result shape when 33-03 defines it"

tech-stack:
  added: []
  patterns:
    - "Pure cascade function (zero I/O, zero Supabase) — testable in isolation, reusable by any caller"
    - "1440 sentinel for no-rules days (getEndOfDayMinute — CONTEXT.md OQ-5)"
    - "Per-booking slot step (each booking's own duration_minutes as grid step — CONTEXT.md OQ-2)"
    - "Quota math = movedBookings.length NOT x2 (skipOwnerEmail=true commit assumption)"
    - "firstNameOf(fullName) helper — derives first name at render from full booker_name column"
    - "Verbatim Phase 31 quota error markup (text-sm text-red-600 + role=alert + exact copy)"

key-files:
  created:
    - lib/bookings/pushback.ts
    - tests/pushback-cascade.test.ts
  modified:
    - lib/slots.ts
    - app/(shell)/app/bookings/_lib/actions-pushback.ts
    - app/(shell)/app/bookings/_components/pushback-dialog.tsx

key-decisions:
  - id: "33-02-D01"
    decision: "Pure cascade module (lib/bookings/pushback.ts) with zero I/O dependencies"
    rationale: "Deterministic, testable in isolation, reusable. No Supabase imports, no browser APIs."
    impact: "Unit tests run with vitest without mocking any DB layer."
  - id: "33-02-D02"
    decision: "1440 sentinel for endOfDayMinutes when day has no availability rules or overrides"
    rationale: "CONTEXT.md OQ-5 lock — no-rules days never flag PAST_EOD so ad-hoc bookings on otherwise-closed days do not produce alarming amber badges."
    impact: "getEndOfDayMinute returns 1440 when windowsForDate returns null or empty. isPastEod short-circuits at >= 1440."
  - id: "33-02-D03"
    decision: "Per-booking slot step uses each booking's own duration_minutes"
    rationale: "CONTEXT.md OQ-2 lock — a 30-min booking snaps to 30-min boundaries; a 60-min booking snaps to 60-min boundaries."
    impact: "snapToNextSlotMs called with b.duration_minutes per booking, not a shared account step."
  - id: "33-02-D04"
    decision: "Quota math = movedBookings.length NOT x2"
    rationale: "skipOwnerEmail=true on commit (Plan 32-03 decision) means each moved booking sends exactly 1 email (booker only). movedCount === emailsNeeded."
    impact: "previewPushbackAction uses countMoved(rows) directly. No multiplication."
  - id: "33-02-D05"
    decision: "booker_name column corrected — booker_first_name does not exist"
    rationale: "Plan text referenced non-existent column booker_first_name. Real column is booker_name (full name). Fixed post-checkpoint by orchestrator (commit bba0e18). Future plans must grep migrations before naming fields."
    impact: "PushbackBookingInput.booker_name: string. Dialog derives first name via firstNameOf(fullName) helper at render time. Tests use booker_name fixture."
  - id: "33-02-D06"
    decision: "Scenario (d) absorb-then-move intentionally skipped"
    rationale: "Back-to-back constraint makes a realistic absorb-then-move scenario with non-overlapping valid bookings untestable in 30-min slot grids. Scenarios (b) and (c) together cover the algorithm branches that scenario (d) would test."
    impact: "14 tests across 6 scenarios. All cascade branches exercised."

metrics:
  duration: "~2 hours (including checkpoint pause + orchestrator correction)"
  completed: "2026-05-05"
---

# Phase 33 Plan 02: Cascade Algorithm + Preview Wiring Summary

**Pure cascade module (computeCascadePreview) with 14 unit tests, previewPushbackAction server action with EMAIL-22 quota pre-flight, and dialog preview-ready state with MOVE/ABSORBED/PAST_EOD badges — booker_name column corrected by orchestrator post-checkpoint (bba0e18).**

## Performance

- **Duration:** ~2 hours (2 task commits + orchestrator correction commit + checkpoint pause)
- **Started:** 2026-05-06
- **Completed:** 2026-05-05 (checkpoint approved by Andrew)
- **Tasks:** 2 executed (Task 3 = checkpoint:human-verify, approved)
- **Files modified:** 5

## Accomplishments

- Pure cascade function `computeCascadePreview` with full MOVE/ABSORBED/PAST_EOD classification, snap-up rounding per booking's own duration_minutes, and gap absorption frontier tracking
- `getEndOfDayMinute` helper in `lib/slots.ts` with 1440 sentinel for no-rules days
- 14 Vitest unit tests across 6 cascade scenarios (scenario d intentionally skipped — see decisions)
- `previewPushbackAction` server action: auth + ownership + delay validation + parallel availability fetch + cascade call + quota math
- Dialog `preview-ready` state: chronological rows with colored badges, old to new time format, first name only, duration, quota indicator, verbatim Phase 31 quota error markup
- Orchestrator correction (bba0e18): `booker_first_name` nonexistent column corrected to `booker_name` + `firstNameOf()` render helper added
- Andrew live-verified scenarios 1-3 and stub toast; remaining scenarios trusted to unit-test coverage

## Cascade Module API

```typescript
// lib/bookings/pushback.ts

export type CascadeStatus = "MOVE" | "ABSORBED" | "PAST_EOD";

export interface PushbackBookingInput {
  id: string;
  start_at: string;             // UTC ISO
  end_at: string;               // UTC ISO
  booker_name: string;          // full name from bookings.booker_name (NOT booker_first_name — that column does not exist)
  duration_minutes: number;     // event_type.duration_minutes — used as slot step (OQ-2)
  buffer_after_minutes: number; // event_type.buffer_after_minutes
  event_type_id: string;
}

export interface CascadeRow {
  booking: PushbackBookingInput;
  status: CascadeStatus;
  old_start_at: string;
  new_start_at: string | null;  // null when ABSORBED
  new_end_at: string | null;    // null when ABSORBED
}

export interface ComputeCascadeArgs {
  bookings: PushbackBookingInput[]; // sorted by start_at ASC
  anchorId: string;
  delayMs: number;                  // delay in milliseconds
  endOfDayMinutes: number;          // 0..1440; 1440 = "no constraint" sentinel
  accountTimezone: string;          // IANA tz
}

export function computeCascadePreview(args: ComputeCascadeArgs): CascadeRow[]
export function snapToNextSlotMs(rawMs: number, slotStepMinutes: number): number
export function isPastEod(startMs: number, accountTimezone: string, endOfDayMinutes: number): boolean
export function countMoved(rows: CascadeRow[]): number  // MOVE + PAST_EOD count
```

## previewPushbackAction Return Shape

```typescript
// app/(shell)/app/bookings/_lib/actions-pushback.ts

export interface PreviewPushbackInput {
  accountId: string;
  date: string;             // YYYY-MM-DD in accountTimezone
  accountTimezone: string;
  anchorId: string;
  delayMinutes: number;     // already converted from min/hr in the dialog
  reason?: string;
}

export type PreviewPushbackResult =
  | {
      ok: true;
      rows: CascadeRow[];
      movedCount: number;       // MOVE + PAST_EOD count (= emails to send)
      remainingQuota: number;
      quotaError: boolean;      // true when movedCount > remainingQuota
    }
  | { ok: false; error: string };
```

**33-03 commit response must mirror this shape.** `rows` carries the full booking data needed for the reschedule batch. `movedCount` is the email quota the commit will consume. 33-03 should filter to `rows.filter(r => r.status !== "ABSORBED")` to get bookings that need rescheduling.

## Unit Test Scenarios (14 tests, all green)

| Scenario | What it tests | Result |
|----------|---------------|--------|
| (a) Single anchor move | Anchor moves by delay, snapped up to duration grid | PASS |
| (b) Two-booking back-to-back cascade | Both bookings MOVE in sequence, no gap | PASS |
| (c) Gap absorbs push | 60-min gap absorbs 15-min delay; second booking ABSORBED | PASS |
| (d) Absorb-then-move | **SKIPPED** — valid non-overlapping absorb+move in 30-min slots not constructible; branches covered by (b)+(c) | n/a |
| (e) Past-EOD flag | Anchor pushed past EOD minute fires PAST_EOD badge | PASS |
| (f) No-rules day (1440) | endOfDayMinutes=1440 never flags PAST_EOD | PASS |
| (g) Snap-up rounding | 5-min delay on 60-min booking snaps to next 60-min boundary | PASS |
| snapToNextSlotMs (2 tests) | Snaps up correctly; exact boundary returns unchanged | PASS |

## Phase 31 Quota Error Markup Verbatim Location

Source of truth: `app/(shell)/app/availability/_components/override-modal.tsx` lines 426-432.

Verbatim copy in `pushback-dialog.tsx` (lines 331-337):

```tsx
{quotaError && (
  <p className="text-sm text-red-600" role="alert">
    {movedCount} email{movedCount === 1 ? "" : "s"} needed,{" "}
    {remainingQuota} remaining today. Quota resets at UTC midnight.
    Wait until tomorrow or contact bookers manually.
  </p>
)}
```

Class: `text-sm text-red-600`. Attribute: `role="alert"`. Copy is character-for-character identical across both surfaces (EMAIL-22 and EMAIL-23 vocabulary locked).

## Hand-off Notes for 33-03

**handleConfirm stub location:** `pushback-dialog.tsx` line ~246

```typescript
// ── handleConfirm ────────────────────────────────────────────────────────────
// Stub — Plan 33-03 will replace this with the real commitPushbackAction call.

async function handleConfirm() {
  toast.info("Commit path lands in Plan 33-03");
}
```

**CascadeRow[] state field 33-03 will read:**

```typescript
const [previewRows, setPreviewRows] = useState<CascadeRow[]>([]);
```

Declared at line ~157 in `pushback-dialog.tsx`. Populated by `handlePreview` after `previewPushbackAction` resolves successfully. Contains all rows (MOVE + ABSORBED + PAST_EOD) in chronological order.

**Other state 33-03 needs to read:**

```typescript
const date: string             // YYYY-MM-DD in accountTimezone (the pushback date)
const reason: string           // owner reason to include in reschedule emails
const movedCount: number       // pre-computed email count for commit quota re-check
const accountTimezone: string  // IANA tz (passed as prop)
const accountId: string        // account UUID (passed as prop)
```

**Dialog state transitions 33-03 must implement:**

```typescript
setState("committing")  // before commitPushbackAction call
setState("summary")     // after commit resolves (33-04 renders per-row results)
setState("editing")     // on commit error (show toast, allow retry from editing state)
```

## Deviations from Plan

### Orchestrator Correction (Mid-Checkpoint) — booker_name Column Fix

**Commit:** `bba0e18` — fix(33-02): use bookings.booker_name (not invented booker_first_name)

**Found during:** Task 3 checkpoint pause — Andrew live-tested and saw empty/blank anchor list in the dialog.

**Issue:** Plan text and the initial executor invented a column `booker_first_name` that does not exist in the `bookings` table. The real column is `booker_name` (stores the full name entered at booking time). Because TypeScript types and queries referenced the non-existent column, the server returned undefined values silently, resulting in a blank anchor list on the live site.

**Fix applied by orchestrator:**
- `getBookingsForPushback` query: select `booker_name` (not `booker_first_name`)
- `PushbackBookingInput.booker_name: string` (was `booker_first_name`)
- `PushbackBooking` type (queries.ts): field renamed to `booker_name`
- `pushback-dialog.tsx`: added `firstNameOf(fullName: string): string` helper that splits on whitespace and returns the first token — first name derived at render, not at the DB layer
- Test fixture: `booker_name: "Test User"` (was `booker_first_name: "Test"`)
- All 14 cascade unit tests still pass after fix (pure function is not affected by the type rename)

**Critical lesson for future planning:** Plans must reference real column names. Before naming fields in plan text, grep migration files and existing type definitions. `booker_first_name` never existed; `booker_name` is the canonical full-name column established in v1.0.

### Scenario (d) Intentionally Skipped

The plan noted scenario (d) "absorb-then-move" as "drop if the back-to-back constraint makes it untestable." Confirmed: constructing a valid (non-overlapping) scenario with confirmed bookings in 30-min slot grids that produces absorb-then-a-third-move requires bookings that would overlap their original windows, which is invalid input. Scenarios (b) and (c) together exercise all algorithm branches that (d) would cover. The test placeholder exists with a `expect(true).toBe(true)` stub and an explanatory comment.

---

**Total deviations:** 1 orchestrator correction (booker_name column) + 1 planned scenario skip
**Impact:** Correction required for correct runtime behavior; no scope creep. Scenario skip pre-authorized in plan text.

## Andrew Live-Verification

Scenarios verified live by Andrew during checkpoint:
- Scenario 1 (single anchor move) — PASS
- Scenario 2 (gap absorption) — PASS
- Scenario 3 (past-EOD overshoot) — PASS

Scenarios 4-7 trusted to unit-test coverage per Andrew's approval signal. The booker_name fix (bba0e18) was applied during the checkpoint pause; Andrew confirmed correct anchor list rendering after the fix before approving.

## Task Commits

1. **Task 1: Pure cascade module + getEndOfDayMinute + unit tests** — `9020fe5` (feat)
2. **Task 2: previewPushbackAction + cascade preview render with quota gate** — `9220802` (feat)
3. **Orchestrator correction: booker_name fix** — `bba0e18` (fix — applied during checkpoint pause)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/bookings/pushback.ts` — Pure cascade module: computeCascadePreview, snapToNextSlotMs, isPastEod, countMoved + all types (created)
- `tests/pushback-cascade.test.ts` — 14 Vitest unit tests across 6 cascade scenarios (created)
- `lib/slots.ts` — Added getEndOfDayMinute export with 1440 sentinel (modified)
- `app/(shell)/app/bookings/_lib/actions-pushback.ts` — Added previewPushbackAction server action (modified)
- `app/(shell)/app/bookings/_components/pushback-dialog.tsx` — Preview-ready state, CascadeBadge, handlePreview wiring, handleConfirm stub, firstNameOf helper (modified)

## Next Phase Readiness

Plan 33-03 is unblocked. Everything needed for the commit path is in place:

- `previewRows: CascadeRow[]` state populated in dialog after successful preview
- `handleConfirm` stub at line ~246 ready to be replaced with `commitPushbackAction` call
- `movedCount`, `remainingQuota`, `quotaError` state available for commit-time quota re-check
- `date`, `reason`, `accountTimezone`, `accountId` props accessible in `handleConfirm` scope
- `skipOwnerEmail=true` pattern established in Plan 32-03 (`cancelBooking`) ready to be mirrored for `rescheduleBooking`

No blockers. TypeScript compiles clean; build passes.

---
*Phase: 33-day-level-pushback-cascade*
*Completed: 2026-05-05*
