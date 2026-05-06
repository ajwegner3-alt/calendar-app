# Phase 33: Day-Level Pushback Cascade - Research

**Researched:** 2026-05-05
**Domain:** Owner-initiated bulk reschedule with cascade preview, quota gate, race-safety, and post-commit failure surface
**Confidence:** HIGH (all findings sourced from codebase; no speculation)

---

## Summary

Phase 33 adds a pushback dialog to `/app/bookings` that lets an owner move all confirmed bookings from a chosen anchor point forward by a delay, computes new times via a smart gap-absorption algorithm, previews the batch, gates on email quota, commits through the existing `rescheduleBooking()` lifecycle, and surfaces per-booking send status with retry. Every building block is already in the codebase — the work is composition and a new pure-function cascade algorithm, not new infrastructure.

The dominant pattern to mirror is Phase 32's `override-modal.tsx` three-state machine (`editing → preview-loading → preview-ready`) plus the `commitInverseOverrideAction` race-safe commit path. The key structural difference from Phase 32: pushback uses an **abort-if-diverged** race strategy rather than Phase 32's union strategy, and uses `rescheduleBooking()` (in-place UPDATE retaining `status='confirmed'`) instead of `cancelBooking()`.

**Primary recommendation:** Write `lib/bookings/pushback.ts` as a pure cascade function (no Supabase), `actions-pushback.ts` as the server action layer (mirrors `actions-batch-cancel.ts`), and `pushback-dialog.tsx` as a client component following `override-modal.tsx`'s state-machine shape exactly.

---

## Codebase Anchors

### 1. Phase 31 Quota Error UX — verbatim copy to reuse

**File:** `app/(shell)/app/availability/_components/override-modal.tsx`, lines 426–433

```tsx
// Exact markup — Phase 33 must match this verbatim (CONTEXT.md decision)
{quotaError && (
  <p className="text-sm text-red-600 mt-2" role="alert">
    {affected.length} email{affected.length === 1 ? "" : "s"}{" "}
    needed, {remainingQuota} remaining today. Quota resets at UTC
    midnight. Wait until tomorrow or contact bookers manually.
  </p>
)}
```

For pushback the variable names differ but the pattern is identical: `needed = movedBookings.length`, `remaining = remainingQuota`. The `role="alert"` and `text-sm text-red-600` classes are the locked vocabulary.

---

### 2. Phase 32 Preview-Then-Commit Pattern

**File:** `app/(shell)/app/availability/_lib/actions-batch-cancel.ts`

Key signatures the planner needs:

```typescript
// Preview action (read-only, called on UI interaction)
export async function previewAffectedBookingsAction(rawInput: unknown): Promise<PreviewAffectedBookingsResult>
// Returns: { ok: true, affected: AffectedBooking[], remainingQuota: number }
//        | { ok: false, error: string }

// Commit action (write path)
export async function commitInverseOverrideAction(rawInput: unknown): Promise<CommitOverrideResult>
// Returns: { ok: true, cancelledCount, emailFailures }
//        | { ok: false, quotaError: true, needed, remaining }
//        | { ok: false, formError: string }
```

Phase 32 race-window pattern (lines 338–367): after writing the override rows, re-queries affected bookings and **unions** preview IDs with re-query IDs (`new Set([...input.affectedBookingIds, ...raceSafeIds])`). Phase 33 must **abort instead** — do not union, compare sets and return a new `{ ok: false, diverged: true }` branch.

Phase 32 `skipOwnerEmail` flag (line 383): passed to `cancelBooking({ skipOwnerEmail: true })` to suppress N owner notifications. Phase 33 will call `rescheduleBooking()` in a loop, which currently has NO `skipOwnerEmail` equivalent — **this is a required extension** (see Open Questions #1).

---

### 3. Existing Reschedule Lifecycle

**File:** `lib/bookings/reschedule.ts`

`rescheduleBooking(args: RescheduleBookingArgs)` is the single source of truth. It:
- Validates `newStartAt > now()` and `newEndAt > newStartAt`
- Pre-fetches booking + event_type + account (1 round-trip)
- Generates fresh cancel + reschedule tokens via `generateBookingTokens()` (lib/bookings/tokens.ts:45)
- Atomic UPDATE: sets `start_at`, `end_at`, fresh token hashes; `status` stays `'confirmed'`
- CAS guard: `WHERE id=? AND status='confirmed' AND reschedule_token_hash=oldHash AND start_at > now()`
- Failure codes: `not_active` (PGRST116), `slot_taken` (23505 or 23P01), `bad_slot`, `db_error`
- Calls `sendRescheduleEmails()` with old+new times + raw tokens
- `booking_events` audit row via `after()` with `event_type: 'rescheduled'`, `actor: 'booker'`

**Issue for Phase 33:** The `actor` field is hardcoded to `'booker'` (line 250 — "public reschedule path is booker-initiated only in v1"). Phase 33 pushback is owner-initiated — the audit row needs `actor: 'owner'`. The current function signature does not accept an `actor` param. **Must add `actor?: 'booker' | 'owner'` param** or call `booking_events` INSERT directly in `commitPushbackAction`.

**Token CAS issue for batch pushback:** `rescheduleBooking()` requires `oldRescheduleHash` as a CAS guard. For owner-initiated pushback, the owner doesn't have the current `reschedule_token_hash` at hand. Phase 33's commit action will need to pre-fetch each booking's current `reschedule_token_hash` before calling `rescheduleBooking()`. This adds 1 extra query per booking in the batch OR can be done in a single batch pre-fetch.

**.ics METHOD:REQUEST SEQUENCE:1** is generated in `lib/email/send-reschedule-emails.ts` lines 166–180 (`buildIcsBuffer({ ..., method: ICalCalendarMethod.REQUEST, sequence: 1 })`). This is called inside `sendRescheduleEmails()`, which is called inside `rescheduleBooking()`. No additional work needed for the .ics — it fires automatically when `rescheduleBooking()` runs.

**`booking_events` enum:** The `booking_event_kind` enum in `supabase/migrations/20260419120000_initial_schema.sql` line 10 already includes `'rescheduled'`. No migration needed for the audit row.

---

### 4. Slot Engine — Buffer and Rounding

**File:** `lib/slots.ts`

**`subtractWindows()`** (line 143, exported): subtracts blocked intervals from base intervals. Not directly needed for cascade math but the same interval-arithmetic pattern applies.

**No slot-rounding helper exists.** The slot engine uses `durationMinutes` as the step size (line 337: `cursor = slotEnd`). Cascade math needs "round up to next slot boundary." The slot grid for a given event type is defined by its `duration_minutes` column (`event_types.duration_minutes`). The rounding formula:

```
slotStep = eventType.duration_minutes
roundedStartMinutes = Math.ceil(rawStartMinutes / slotStep) * slotStep
```

This does NOT exist as a helper today. It belongs in `lib/bookings/pushback.ts` as an exported pure function `snapToNextSlot(utcMs: number, slotStepMinutes: number): number`.

**End-of-workday determination:** `windowsForDate()` in `lib/slots.ts` line 183 returns the windows array for a date (or null if closed). The LAST window's `end_minute` is the end-of-workday. This function is NOT exported. Phase 33 needs to know if a new start time exceeds the day's last window end. Two options:

1. Export a thin `getEndOfDayMinute(date, dow, rules, overrides)` helper from `lib/slots.ts` (preferred — keeps the logic in one place).
2. Re-implement inline in `lib/bookings/pushback.ts` — duplicates logic.

**Recommendation:** Export `windowsForDate` from `lib/slots.ts` (or a wrapper) so `computeCascadePreview()` can call it to determine EOD.

**`buffer_after_minutes`:** Lives on `event_types.buffer_after_minutes` (confirmed in initial schema line 37, backfill migration `20260503221744_v15_backfill_buffer_after_minutes.sql`). The slot type `BookingRow` (lib/slots.types.ts:55) already carries `buffer_after_minutes`. Cascade math must fetch this per booking via a join or a separate event_types lookup.

---

### 5. `/app/bookings` Page Structure

**File:** `app/(shell)/app/bookings/page.tsx`

This is a **pure server component** (async function, reads `searchParams` as a Promise). There is no existing client component wrapper. The page renders:
- `<header>` with `<h1>Bookings</h1>` (line 89) — **header button target**
- `<UnsentConfirmationsBanner>` (client-safe, stateless)
- `<BookingsFilters>` (client component — `"use client"` implied by state hooks)
- `<BookingsTable>` — flat paginated table, **no day-grouping today**
- `<BookingsPagination>`

**Critical finding: There are no day-section groups in the current `/app/bookings` layout.** The table is a flat list sorted by `start_at`. The per-day-section button variant (CONTEXT.md decision) requires a day-grouped layout that does NOT currently exist.

The planner must add day-grouping to `BookingsTable` (or replace it with a day-grouped component) to place per-day Pushback buttons. This is additional scope beyond just the dialog.

**Dialog mounting pattern:** `DateOverridesSection` (`app/(shell)/app/availability/_components/date-overrides-section.tsx`) shows the canonical pattern — a `"use client"` wrapper component holds `[modalOpen, setModalOpen]` state and passes props down to the modal. The server page passes data down to the client shell, which manages modal open/close state. Phase 33 should follow this: create a `PushbackDialogProvider` client component that renders both the header button and the modal, passed `accountTimezone` and `accountId` from the server page.

**`accountTimezone` threading:** `loadAvailabilityState()` queries `accounts.timezone`. The bookings page already resolves `accountId` inline (lines 57–68) using `supabase.auth.getClaims()` + accounts lookup. The pushback dialog needs timezone for preview time display. Pattern: the server page fetches `accountTimezone` alongside existing queries (add to the existing accounts lookup or use `resolveOwnerContext()` from actions-batch-cancel.ts pattern).

---

### 6. EXCLUDE GIST + Capacity Index

**Files:**
- `supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql` — EXCLUDE constraint
- `supabase/migrations/20260428130002_phase11_slot_index_and_concurrent_index.sql` — unique partial index

**EXCLUDE constraint** (`bookings_no_account_cross_event_overlap`): triggers on UPDATE when two confirmed bookings of DIFFERENT event types on the same account have overlapping `during` ranges. Phase 33's `rescheduleBooking()` UPDATE will hit this constraint if the new time conflicts with a different event type's confirmed booking. Error code: `23P01` → mapped to `slot_taken` in `rescheduleBooking()` (line 162–169). This is already handled.

**Capacity index** (`bookings_no_double_book` partial unique on `(event_type_id, start_at)` WHERE `status='confirmed'`): triggers on UPDATE if the new time is already taken by the same event type. Error code: `23505` → mapped to `slot_taken` in `rescheduleBooking()` (line 153–157). Also already handled.

**Both constraints are enforced at the DB layer automatically** on the `rescheduleBooking()` UPDATE. Phase 33 doesn't need to add anything — it just needs to handle `slot_taken` result gracefully in the post-commit summary.

---

### 7. Email Send Log + Quota Guard

**File:** `lib/email-sender/quota-guard.ts`

Key exports:
- `getRemainingDailyQuota(): Promise<number>` (line 95) — used for pre-flight; returns `max(0, 200 - todayCount)`
- `checkAndConsumeQuota(category: EmailCategory): Promise<void>` (line 68) — called inside each email sender; throws `QuotaExceededError` if at cap
- `logQuotaRefusal(params)` (line 106) — PII-free structured log; called inside senders before re-throwing
- `EmailCategory` type (line 18) — includes `'reschedule-booker'` and `'reschedule-owner'` already

**`SIGNUP_DAILY_EMAIL_CAP = 200`** (line 9).

For Phase 33, the quota pre-flight at preview time: `needed = movedBookings.length` (only MOVE-classified bookings send emails — ABSORBED and PAST_EOD also send reschedule emails per PUSH-09, so actually `needed = movedBookings.length + pastEodBookings.length`, i.e. every booking that changes times). ABSORBED bookings do NOT move, so no email. The CONTEXT.md states `needed = affected.length` where `affected` = bookings that MOVE (including PAST EOD). Confirm: 1 booker reschedule email per booking that moves. Owner notification: the existing `sendRescheduleEmails()` sends owner notification for each booking — for a pushback batch this means N owner emails. CONTEXT.md says `skipOwnerEmail=true` for batch cancels in Phase 32. Consider whether owner wants N reschedule notifications or a single summary — see Open Questions #2.

---

### 8. Dialog + Modal Patterns

**File:** `app/(shell)/app/availability/_components/override-modal.tsx`

State machine (lines 59, 107): `type CommitState = "editing" | "preview-loading" | "preview-ready"`. Phase 33 needs an additional `"commit-loading"` and `"summary"` state (post-commit summary persists until dismissed). Recommended:

```typescript
type PushbackDialogState =
  | "editing"
  | "preview-loading"
  | "preview-ready"
  | "committing"
  | "summary"; // replaces preview content; persists until Close
```

The dialog uses shadcn `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogFooter` (override-modal.tsx lines 284–495). Phase 33 uses the same primitives.

`useTransition` (line 104) + `startTransition(async () => { ... })` is the pattern for calling server actions from dialogs. Both preview and commit use the same `isPending` from the single `useTransition` hook.

The `useEffect` on `[open, initialDate, ...]` (lines 116–140) re-seeds state when the modal opens. Phase 33 needs the same: on open, reset to `"editing"`, reset preview + summary state, seed the date from the prop.

---

### 9. Buffer-After-Minutes in Event Types

**Schema:** `event_types.buffer_after_minutes INT NOT NULL DEFAULT 0` (initial schema line 37). Backfilled from `accounts.buffer_minutes` in migration `20260503221744_v15_backfill_buffer_after_minutes.sql`. The `accounts.buffer_minutes` column was then dropped in `20260504004202_v15_drop_accounts_buffer_minutes.sql`.

**In slot engine:** `lib/slots.types.ts` line 66 — `BookingRow.buffer_after_minutes` is the per-booking value from the event type join. The cascade algorithm needs each booking's event type's `buffer_after_minutes` to compute the gap between consecutive bookings. The server action query for the day's bookings must include `event_types!inner(duration_minutes, buffer_after_minutes)` in the SELECT.

---

### 10. `booking_events` Table

**Schema:** `supabase/migrations/20260419120000_initial_schema.sql` lines 114–124

```sql
create table booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  account_id uuid not null,
  event_type booking_event_kind not null,  -- enum: 'created'|'cancelled'|'rescheduled'|'reminder_sent'
  occurred_at timestamptz not null default now(),
  actor booking_actor not null,            -- enum: 'booker'|'owner'|'system'
  metadata jsonb not null default '{}'::jsonb
);
```

No helper function exists — all callers use direct Supabase insert inside `after()`. Example from `lib/bookings/reschedule.ts` lines 241–258:

```typescript
after(async () => {
  await supabase.from("booking_events").insert({
    booking_id: pre.id,
    account_id: pre.account_id,
    event_type: "rescheduled",
    actor: "booker",           // Phase 33 needs "owner" here
    metadata: { old_start_at: oldStartAt, new_start_at: updated.start_at, ip: null },
  });
});
```

Phase 33 wraps `rescheduleBooking()` which fires its own `booking_events` insert with `actor: 'booker'`. As noted in Anchor #3, Phase 33 should add an `actor` param or insert the audit row separately after the batch commit with `actor: 'owner'`.

---

## Recommended Cascade Algorithm Pseudocode

Located in: `lib/bookings/pushback.ts` (new pure module, no Supabase)

```typescript
// Input types needed from the DB query:
interface PushbackBooking {
  id: string;
  start_at: string;           // UTC ISO
  end_at: string;             // UTC ISO
  booker_first_name: string;
  duration_minutes: number;   // from event_types join
  buffer_after_minutes: number; // from event_types join
  event_type_id: string;
}

type CascadeStatus = "MOVE" | "ABSORBED" | "PAST_EOD";

interface CascadeRow {
  booking: PushbackBooking;
  status: CascadeStatus;
  old_start_at: string;
  new_start_at: string | null;  // null if ABSORBED
  new_end_at: string | null;
}

function computeCascadePreview(
  bookings: PushbackBooking[],   // all confirmed bookings for the date, sorted by start_at
  anchorId: string,              // first booking to move
  delayMs: number,               // delay in milliseconds
  slotStepMinutes: number,       // event_type.duration_minutes of anchor (or global step)
  endOfDayMinutes: number,       // last available window's end_minute for the date (in local tz)
  accountTimezone: string,
): CascadeRow[] {
  // Split into before-anchor (untouched) and at/after-anchor (cascade candidates)
  const anchorIdx = bookings.findIndex(b => b.id === anchorId);
  const before = bookings.slice(0, anchorIdx);
  const cascade = bookings.slice(anchorIdx);

  const result: CascadeRow[] = before.map(b => ({
    booking: b, status: "ABSORBED",
    old_start_at: b.start_at, new_start_at: null, new_end_at: null,
  }));

  let priorNewEndMs = new Date(cascade[0].start_at).getTime() + delayMs;

  for (let i = 0; i < cascade.length; i++) {
    const b = cascade[i];
    const origStartMs = new Date(b.start_at).getTime();
    const origEndMs = new Date(b.end_at).getTime();
    const durationMs = origEndMs - origStartMs;

    if (i === 0) {
      // Anchor always moves by the full delay
      const rawNewStart = new Date(b.start_at).getTime() + delayMs;
      const snappedStart = snapToNextSlotMs(rawNewStart, slotStepMinutes);
      const newEnd = snappedStart + durationMs;
      priorNewEndMs = newEnd;
      const pastEod = isPastEod(snappedStart, accountTimezone, endOfDayMinutes);
      result.push({
        booking: b, status: pastEod ? "PAST_EOD" : "MOVE",
        old_start_at: b.start_at,
        new_start_at: new Date(snappedStart).toISOString(),
        new_end_at: new Date(newEnd).toISOString(),
      });
    } else {
      const priorBuffer = cascade[i - 1].buffer_after_minutes;
      const candidateStart = priorNewEndMs + priorBuffer * 60_000;

      if (candidateStart <= origStartMs) {
        // Gap absorbs the push — booking stays in place
        priorNewEndMs = origEndMs; // priorNewEnd resets to THIS booking's original end
        result.push({
          booking: b, status: "ABSORBED",
          old_start_at: b.start_at, new_start_at: null, new_end_at: null,
        });
      } else {
        // Booking must move
        const snappedStart = snapToNextSlotMs(candidateStart, slotStepMinutes);
        const newEnd = snappedStart + durationMs;
        priorNewEndMs = newEnd;
        const pastEod = isPastEod(snappedStart, accountTimezone, endOfDayMinutes);
        result.push({
          booking: b, status: pastEod ? "PAST_EOD" : "MOVE",
          old_start_at: b.start_at,
          new_start_at: new Date(snappedStart).toISOString(),
          new_end_at: new Date(newEnd).toISOString(),
        });
      }
    }
  }

  return result;
}

function snapToNextSlotMs(rawMs: number, slotStepMinutes: number): number {
  const stepMs = slotStepMinutes * 60_000;
  return Math.ceil(rawMs / stepMs) * stepMs;
}

function isPastEod(
  startMs: number, accountTimezone: string, endOfDayMinutes: number
): boolean {
  const local = new TZDate(new Date(startMs), accountTimezone);
  const localMinutes = local.getHours() * 60 + local.getMinutes();
  return localMinutes >= endOfDayMinutes;
}
```

**Key formula (CONTEXT.md lock):** `candidateStart = prior_new_end_ms + prior_event_type.buffer_after_minutes * 60_000`, then snap UP to next slot grid boundary. The `priorNewEndMs` tracks the cascade frontier. When a booking is ABSORBED, `priorNewEndMs` resets to that booking's ORIGINAL end (the cascade "cools off").

**Slot step:** The spec says "per existing slot-engine semantics." The slot engine steps by `durationMinutes` (the event type's duration). For the pushback preview, use the anchor booking's event type's `duration_minutes` as the slot step, OR — if bookings on the same day have different event types with different durations — use a per-booking `duration_minutes`. The simplest correct approach: snap each moved booking to the nearest `duration_minutes`-boundary of THAT booking's event type. This requires knowing `duration_minutes` per booking, which the DB query must supply.

---

## Recommended Plan Split

The CONTEXT.md tentative split of 4 plans is correct. Refined:

### Plan 33-01: Pushback Dialog Shell
**Objective:** Add day-grouped view to `/app/bookings`, mount `PushbackDialog` client component with header + per-day buttons, date picker, bookings-list-with-anchor-radio, delay input (number + Min|Hr segmented toggle), reason textarea (280 char counter). No cascade logic yet — just the form UI with placeholder preview state.

**Dependency:** Requires `accountTimezone` to be passed from the server page (add to existing accounts query in `page.tsx`).

**Files touched:**
- `app/(shell)/app/bookings/page.tsx` — add timezone fetch, add `<PushbackDialogProvider>`
- `app/(shell)/app/bookings/_components/pushback-dialog.tsx` (new)
- `app/(shell)/app/bookings/_components/bookings-table.tsx` — add day-grouping + per-day Pushback button

**Must-have:** The day-grouped layout in `BookingsTable` (or a new `BookingsGroupedView`) is the biggest structural addition in this plan. The existing flat table sort works fine for the paginated list; day-grouping may require a separate component that's used when the `statusFilter = 'upcoming'` and when the pushback feature is enabled. Alternatively, the per-day button can live outside the table as a section header above each date group.

---

### Plan 33-02: Cascade Algorithm + Real-Time Preview
**Objective:** Write `lib/bookings/pushback.ts` with `computeCascadePreview()` pure function. Add `getBookingsForPushback(accountId, date, accountTimezone)` query in `app/(shell)/app/bookings/_lib/queries.ts` (fetches confirmed bookings for a date with event_type join for `duration_minutes`, `buffer_after_minutes`). Add `previewPushbackAction()` server action in `actions-pushback.ts`. Wire preview into dialog: on delay change (debounced) → call server action → render MOVE/ABSORBED/PAST_EOD badges + quota indicator.

**Files touched:**
- `lib/bookings/pushback.ts` (new — pure cascade function)
- `lib/slots.ts` — export `windowsForDate` (or a `getEndOfDayMinute` wrapper)
- `app/(shell)/app/bookings/_lib/queries.ts` — add `getBookingsForPushback()`
- `app/(shell)/app/bookings/_lib/actions-pushback.ts` (new)
- `app/(shell)/app/bookings/_components/pushback-dialog.tsx` — wire preview render

**Must-have:** End-of-workday determination requires availability rules + overrides for the chosen date. `previewPushbackAction` must fetch these and pass `endOfDayMinutes` to `computeCascadePreview()`. This adds a query for `availability_rules` and `date_overrides` for the account.

---

### Plan 33-03: Commit Path — Reschedule Lifecycle + Race Safety
**Objective:** Add `commitPushbackAction()` to `actions-pushback.ts`. Implements: (1) quota hard pre-flight, (2) race-safe re-query of day's confirmed bookings, (3) abort-if-diverged check (ID sets differ → return `{ ok: false, diverged: true }`), (4) batch `rescheduleBooking()` calls via `Promise.allSettled`, (5) `revalidatePath`. Also: add `skipOwnerEmail?: boolean` to `RescheduleBookingArgs` in `lib/bookings/reschedule.ts` (see Open Questions #2).

**Files touched:**
- `lib/bookings/reschedule.ts` — add `skipOwnerEmail` param + `actor` param
- `lib/email/send-reschedule-emails.ts` — add `sendOwner` flag (mirrors `send-cancel-emails.ts`)
- `app/(shell)/app/bookings/_lib/actions-pushback.ts` — add `commitPushbackAction()`

**Must-have:** The `oldRescheduleHash` CAS guard in `rescheduleBooking()` requires the current token hash. `commitPushbackAction` must pre-fetch `reschedule_token_hash` for each booking-to-move in a single batch query before calling `rescheduleBooking()` in the loop. Add this as a step between race re-query and batch-reschedule.

---

### Plan 33-04: Post-Commit Summary + Per-Row Email Retry
**Objective:** Wire the `"summary"` state into the dialog. Each booking row shows `Sent` / `Failed` / `Skipped` badge. Each `Failed` row gets a `<RetryEmailButton>` that calls a new `retryPushbackEmailAction(bookingId)` server action. The retry path: re-fetch fresh tokens for the booking, call `sendRescheduleEmails()` directly (no DB UPDATE needed — booking time is already updated). Summary persists until owner clicks Close.

**Files touched:**
- `app/(shell)/app/bookings/_lib/actions-pushback.ts` — add `retryPushbackEmailAction()`
- `app/(shell)/app/bookings/_components/pushback-dialog.tsx` — summary state + retry buttons

**Must-have:** The retry action needs to mint fresh tokens (same pattern as `sendReminderForBookingAction()` in `app/(shell)/app/bookings/[id]/_lib/actions.ts` lines 196–208) and call `sendRescheduleEmails()` with the NEW tokens. The booking `start_at` / `end_at` are already updated (from plan 33-03), so `oldStartAt` for the "Was:" field in the email is no longer available. The retry email will need to either omit the "Was:" row or store `old_start_at` in the summary state from the commit response.

---

## Open Questions for Planner

### OQ-1: `skipOwnerEmail` for Pushback Reschedule Batch (HIGH PRIORITY)
`cancelBooking()` has `skipOwnerEmail: true` for batch use (Phase 32 added this). `rescheduleBooking()` has NO equivalent. A pushback of 5 bookings would send 5 owner reschedule notification emails. The current `sendRescheduleEmails()` always sends both legs.

**Options:**
A. Add `skipOwnerEmail?: boolean` to `RescheduleBookingArgs` → thread through to `sendRescheduleEmails({ sendOwner: !skipOwnerEmail })` → mirror the `send-cancel-emails.ts` `sendOwner` pattern. Required: add `sendOwner` param to `sendRescheduleEmails()` (similar to cancel leg).
B. Send owner notifications for all N bookings — owner expects to see N emails for N reschedules they initiated.

CONTEXT.md is silent on this. Recommend Option A (suppress N duplicates, consistent with Phase 32 pattern), but planner should confirm with Andrew.

### OQ-2: Slot Step for Rounding — Per-Booking or Per-Day?
If a day has bookings of different event types with different `duration_minutes` (e.g., a 30-min consultation and a 60-min assessment), each booking should snap to its own event type's slot grid. The cascade math above handles this by using each booking's own `duration_minutes` as the snap step. However, this means a 30-min booking at 9:05 snaps to 9:30, but a 60-min booking at 9:35 snaps to 10:00 — which may still create awkward gaps. This is correct per PUSH-06 semantics but worth the planner noting in plan 33-02.

### OQ-3: "Was:" Time in Retry Email
When a retry email fires (Plan 33-04), the booking `start_at` is already the NEW time. `sendRescheduleEmails()` takes `oldStartAt` to show "Was: [old time]" in the email body. The retry action no longer has the old time — it was only in the commit response, held in dialog state.

**Options:**
A. Store `oldStartAt` per booking in the commit response's `emailFailures` array (add a field to the failure shape).
B. Omit the "Was:" row in retry emails (the booker already got the NEW time; retry is just a re-send of the update notification).
C. Store the full summary (including old times) in the dialog's React state from the commit result.

Option C is cleanest — the `commitPushbackAction` response should include the full per-booking result with `old_start_at`, `new_start_at`, and `email_status`. The dialog state holds this and the retry button uses it.

### OQ-4: `actor` on `booking_events` Audit Row
`rescheduleBooking()` hardcodes `actor: 'booker'` on the audit row (line 250). Pushback is owner-initiated. This is a minor data quality issue (reporting, not a bug). Fix: add `actor?: 'booker' | 'owner'` param to `rescheduleBooking()`, default `'booker'`. Pushback passes `'owner'`.

### OQ-5: endOfDayMinutes When No Rules Exist for the Date
If the chosen date has NO availability rules (e.g., a Sunday with no Sunday rule) and no date override, `windowsForDate()` returns `null` (day is closed). In that case there is no "end of day" — all bookings on a closed day are technically PAST_EOD. Decision needed: should pushback dialog allow selecting a date with no availability rules? Probably yes (owner may have ad-hoc bookings on days they didn't configure). In this case `endOfDayMinutes = 24 * 60` (never flag PAST_EOD) or `0` (always flag PAST_EOD). The safe choice is `24 * 60` to match "no constraint" semantics.

### OQ-6: Day-Grouping in BookingsTable
The per-day-section Pushback button requires day-grouping in the bookings view. The current `BookingsTable` is a flat paginated table. Day-grouping with embedded action buttons is a significant UI change. Options:

A. Add a new `BookingsDayGroupedView` component used when the filter is "upcoming" (the most common owner use case), with the flat table remaining for other filters.
B. Day-group the entire table (affects pagination if a day crosses page boundaries).
C. The per-day button is only in the header (drop the per-day-section variant) — simplifies scope significantly.

CONTEXT.md locks both the header button AND the per-day button. Option A is recommended but adds layout scope to Plan 33-01.

---

## Risk & Pitfall Notes

### Risk 1: `rescheduleBooking()` requires `oldRescheduleHash` — not available without a pre-fetch
The CAS guard in `rescheduleBooking()` line 148 requires the current `reschedule_token_hash` from the DB. The commit action must do a batch pre-fetch of all affected bookings' hashes AFTER the re-query (step 3 in commit flow). If the hash rotates between pre-fetch and UPDATE (another concurrent reschedule), the UPDATE returns 0 rows → `not_active` → surfaces as a per-row failure in the summary (correct behavior). No data corruption, just a graceful per-row failure.

### Risk 2: Race Abort vs. Union — Set Comparison Implementation
Phase 33 aborts if the set of confirmed booking IDs on the chosen date differs from what was previewed. "Differs" must be defined precisely: if a NEW booking arrived (not in preview set), abort. If a booking CANCELLED (was in preview set, now gone), abort. Compare: `previewIds.sort().join(',') !== reQueryIds.sort().join(',')`. Return `{ ok: false, diverged: true, message: "Bookings changed — review again" }`. The owner re-opens the dialog and sees fresh preview.

### Risk 3: 23505 / 23P01 on `rescheduleBooking()` for Overlapping New Times
If two bookings in the cascade end up with the same new `start_at` (possible if `snapToNextSlotMs` produces identical results for consecutive bookings with different durations), `rescheduleBooking()` will throw 23505 (`slot_taken`). This can't happen in the cascade algorithm as written (each booking's new start is strictly after the prior booking's new end + buffer), but rounding could theoretically collapse two bookings onto the same slot if the slot step is larger than both durations. The planner should add a post-cascade validation step in `commitPushbackAction` that checks for duplicate new start times before calling `rescheduleBooking()`.

### Risk 4: RSC Boundary (Phase 26 Precedent)
The `/app/bookings` page is a server component. The `PushbackDialogProvider` must be `"use client"`. It cannot receive non-serializable props (functions, class instances). All data passed from server → dialog must be plain serializable types. `accountTimezone` (string), `accountId` (string), and any pre-fetched bookings are fine. No server action closures should be passed as props (use imported server actions directly in the client component).

### Risk 5: `booking_events` Insert After Batch — `after()` and Vercel Function Lifetime
`rescheduleBooking()` wraps the audit insert in `after()` (next/server). In Vercel serverless, `after()` may not execute if the function is killed before it fires. For a batch of N bookings, N `after()` calls are queued. This is existing behavior inherited from the lifecycle function — acceptable risk per established pattern.

### Risk 6: Day-Grouping and Pagination Edge Case
If day-grouping is added to the bookings table, a single page (25 items) may split across multiple days. The per-day Pushback button for a day that's split across pages would only show bookings for that partial page, not all bookings for the day. The pushback dialog re-fetches all confirmed bookings for the chosen date server-side, so the dialog's data is correct — the button is just a shortcut that pre-fills the date. This is acceptable: the dialog is the source of truth, not the table display.

### Risk 7: `slot_taken` Failure in Summary — Not an Email Failure
If a `rescheduleBooking()` call fails with `slot_taken` (DB constraint), the booking is NOT updated. This is different from an email failure (booking IS updated but email didn't send). The post-commit summary must distinguish: `Sent` / `EmailFailed` / `SlotTaken` / `NotActive`. The `Retry` button should only appear on `EmailFailed` rows — there's nothing to retry for `SlotTaken` (the new time is taken; owner must manually rebook).

### Risk 8: `sendRescheduleEmails()` Sends to Owner for Every Booking
Without `skipOwnerEmail`, a 5-booking pushback sends 5 owner notification emails. This may surprise the owner. Add `skipOwnerEmail` (OQ-1) to avoid. Also note: each `rescheduleBooking()` call consumes 2 quota slots (`reschedule-booker` + `reschedule-owner`). If `skipOwnerEmail` is NOT implemented, `needed = movedBookings.length * 2`. If implemented, `needed = movedBookings.length`. The quota pre-flight formula must match actual behavior exactly.

---

## Sources

### Primary (HIGH confidence — all from codebase direct reads)

| File | What was checked |
|------|-----------------|
| `app/(shell)/app/bookings/page.tsx` | Page structure, server component, accountId resolution, no day-grouping |
| `app/(shell)/app/bookings/_components/bookings-table.tsx` | Flat table structure, no day grouping today |
| `app/(shell)/app/bookings/_lib/queries.ts` | `queryBookings()` signature, `BookingRow` type |
| `app/(shell)/app/availability/_components/override-modal.tsx` | 3-state machine, quota error UX verbatim markup, shadcn Dialog pattern |
| `app/(shell)/app/availability/_lib/actions-batch-cancel.ts` | `previewAffectedBookingsAction`, `commitInverseOverrideAction`, race-union pattern, `skipOwnerEmail` |
| `app/(shell)/app/availability/_lib/queries.ts` | `getAffectedBookings()`, `AffectedBooking` type, TZDate day-boundary pattern |
| `app/(shell)/app/availability/_components/date-overrides-section.tsx` | Dialog mounting pattern (client wrapper + modal) |
| `lib/bookings/cancel.ts` | `cancelBooking()` full lifecycle, `skipOwnerEmail`, audit row pattern |
| `lib/bookings/reschedule.ts` | `rescheduleBooking()` full lifecycle, CAS guard, `oldRescheduleHash` requirement, hardcoded `actor:'booker'` |
| `lib/bookings/tokens.ts` | `generateBookingTokens()`, `hashToken()` |
| `lib/email/send-reschedule-emails.ts` | Template HTML structure, `oldStartAt`/`newStartAt` params, .ics METHOD:REQUEST SEQUENCE:1, `checkAndConsumeQuota('reschedule-booker'/'reschedule-owner')` |
| `lib/email/build-ics.ts` | `buildIcsBuffer()` signature, SEQUENCE param |
| `lib/email-sender/quota-guard.ts` | `getRemainingDailyQuota()`, `EmailCategory`, `logQuotaRefusal()`, cap=200 |
| `lib/slots.ts` | `computeSlots()`, `subtractWindows()` (exported), `windowsForDate()` (NOT exported), `generateWindowSlots()`, no slot-rounding helper |
| `lib/slots.types.ts` | `BookingRow.buffer_after_minutes`, `SlotInput`, `AvailabilityRuleRow` |
| `supabase/migrations/20260419120000_initial_schema.sql` | `booking_event_kind` enum, `booking_events` schema, `event_types.buffer_after_minutes` |
| `supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql` | EXCLUDE constraint binding on `during` (tstzrange), `event_type_id WITH <>`, WHERE `status='confirmed'` |
| `supabase/migrations/20260428130001_phase11_capacity_columns.sql` | `max_bookings_per_slot`, `bookings_no_double_book` partial unique index |
| `app/(shell)/app/bookings/[id]/_lib/actions.ts` | `sendReminderForBookingAction()` — token-mint pattern for retry sends |
| `.planning/REQUIREMENTS.md` | PUSH-01 through PUSH-12, EMAIL-22 full text |
| `.planning/config.json` | `commit_docs: true` |

---

## Metadata

**Confidence breakdown:**
- Codebase anchors: HIGH — direct file reads
- Cascade algorithm: HIGH — derived from slot engine patterns + CONTEXT.md locked formula
- Plan split: HIGH — follows Phase 32 precedent structure
- Open questions: HIGH — identified by reading actual function signatures

**Research date:** 2026-05-05
**Valid until:** 2026-06-04 (stable codebase; no planned breaking changes in 30 days)
