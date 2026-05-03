# Phase 28: Per-Event-Type Buffer Wire-Up + Account Column Drop — Research

**Researched:** 2026-05-03
**Domain:** Slot engine rewire + Zod/RHF form field + CP-03 two-step DROP migration
**Confidence:** HIGH — all findings verified against live source files; zero training-data assertions

---

## Summary

Phase 28 is a three-plan sequence that wires the already-existing
`event_types.buffer_after_minutes` column to the slot engine, exposes it in the
event-type editor, and permanently drops `accounts.buffer_minutes` via the CP-03
two-step deploy protocol. No new npm packages. No schema ADD COLUMN.

The column `event_types.buffer_after_minutes INT NOT NULL DEFAULT 0` has existed
in production since the v1.0 initial schema (migration
`20260419120000_initial_schema.sql` line 36). It is already declared in
`EventTypeRow` (`event-types/_lib/types.ts:44`) and already fetched by the edit
page SELECT (`event-types/[id]/edit/page.tsx:18`). Only two things are missing:
(1) the slot engine reads `account.buffer_minutes` instead of the event-type
column, and (2) the event-type form has no UI input for it.

The slot engine change is a function signature update in `lib/slots.ts` (the
`slotConflictsWithBookings` call at line 274) and a type update to `BookingRow`
in `lib/slots.types.ts`. The route handler at `app/api/slots/route.ts` must join
`event_types` for the bookings query and stop reading `buffer_minutes` from the
accounts SELECT. The availability panel cleanup removes the buffer field from
five files and a page component.

The CP-03 drain is mandatory. The DROP migration file must be held local during
the 30-minute drain window and the grep gate must return zero before it applies.

**Primary recommendation:** Follow the locked LD-01/LD-03/LD-09 decisions exactly.
Use `buffer_after_minutes` (not a new column). Asymmetric semantics: an existing
booking's buffer extends the time BEFORE the candidate slot; the candidate slot's
own buffer extends the time AFTER it. Write the backfill UPDATE idempotently with
`WHERE buffer_after_minutes = 0`.

---

## Standard Stack

All existing. Zero new npm packages.

### Core (unchanged from v1.4)
| Library | Version | Purpose |
|---------|---------|---------|
| Supabase Postgres | (live) | `event_types.buffer_after_minutes` already exists; backfill + DROP only |
| Next.js 15 App Router | (installed) | Server Actions, Route Handlers — no new patterns needed |
| Zod v4 | (installed) | Add `buffer_after_minutes` field to `eventTypeSchema` |
| react-hook-form | (installed) | Register the new number input with `valueAsNumber: true` |
| shadcn `Input` | (installed) | Same component already used for `duration_minutes` field |

### Migration Apply Path (LOCKED)
```bash
echo | npx supabase db query --linked -f supabase/migrations/<TIMESTAMP>_<name>.sql
```
`supabase db push --linked` is broken in this repo. This is the only working path.
Wrap multi-statement migrations in `BEGIN/COMMIT`.

---

## Architecture Patterns

### Slot Engine Rewire (Plan 28-01 code change)

**Current state in `lib/slots.ts`:**

```
Line 203-218: slotConflictsWithBookings(
  slotStartUtc: Date,
  slotEndUtc: Date,
  bufferMinutes: number,       // single account-wide value
  bookings: SlotInput["bookings"],
): boolean
  → buffers the slot symmetrically on both sides using bufferMinutes

Line 274-278: slotConflictsWithBookings(
  slotStartUtc,
  slotEndUtc,
  account.buffer_minutes,      // <-- THIS IS THE READ TO CHANGE
  bookings,
)
```

**Current state in `lib/slots.types.ts`:**

```
Line 11-22: interface AccountSettings {
  timezone: string;
  buffer_minutes: number;      // <-- FIELD TO REMOVE
  min_notice_hours: number;
  max_advance_days: number;
  daily_cap: number | null;
}

Line 47-52: interface BookingRow {
  start_at: string;
  end_at: string;
                               // <-- buffer_after_minutes FIELD TO ADD
}
```

**Required change — asymmetric buffer semantics (LD-04):**

```typescript
// lib/slots.types.ts — BookingRow gains per-booking buffer
export interface BookingRow {
  start_at: string;
  end_at: string;
  buffer_after_minutes: number;  // from event_types join in route.ts
}

// lib/slots.types.ts — AccountSettings loses buffer_minutes
export interface AccountSettings {
  timezone: string;
  // buffer_minutes REMOVED
  min_notice_hours: number;
  max_advance_days: number;
  daily_cap: number | null;
}

// lib/slots.ts — slotConflictsWithBookings signature change
// Asymmetric: existing booking's buffer blocks BEFORE the candidate slot;
// candidate slot's own buffer blocks AFTER it.
function slotConflictsWithBookings(
  slotStartUtc: Date,
  slotEndUtc: Date,
  slotBufferAfterMinutes: number,    // NEW: candidate slot's event type
  bookings: SlotInput["bookings"],
): boolean {
  for (const b of bookings) {
    // Existing booking's post-buffer pushes candidate slot start forward
    const bufferedStart = addMinutes(slotStartUtc, -b.buffer_after_minutes);
    // Candidate slot's own post-buffer pushes its end backward
    const bufferedEnd = addMinutes(slotEndUtc, slotBufferAfterMinutes);
    const bStart = new Date(b.start_at);
    const bEnd = new Date(b.end_at);
    if (isBefore(bufferedStart, bEnd) && isBefore(bStart, bufferedEnd)) {
      return true;
    }
  }
  return false;
}

// lib/slots.ts — computeSlots callsite change (line 274-278)
// Add slotBufferAfterMinutes to SlotInput; pass from input:
if (
  slotConflictsWithBookings(
    slotStartUtc,
    slotEndUtc,
    input.slotBufferAfterMinutes,  // NEW field on SlotInput
    bookings,
  )
) continue;
```

`SlotInput` gains a `slotBufferAfterMinutes: number` field. The route handler
populates it from `eventType.buffer_after_minutes` (already fetched in Step 1).

### Route Handler Rewire (Plan 28-01 code change)

**File:** `app/api/slots/route.ts`

**Change 1 — Event type SELECT (line 89):** Add `buffer_after_minutes` to the
event_types SELECT so `eventType.buffer_after_minutes` is available.

```typescript
// BEFORE:
.select("id, account_id, duration_minutes, max_bookings_per_slot, show_remaining_capacity")

// AFTER:
.select("id, account_id, duration_minutes, buffer_after_minutes, max_bookings_per_slot, show_remaining_capacity")
```

**Change 2 — Account SELECT (line 121):** Remove `buffer_minutes` from the
accounts SELECT string.

```typescript
// BEFORE:
"timezone, buffer_minutes, min_notice_hours, max_advance_days, daily_cap"

// AFTER:
"timezone, min_notice_hours, max_advance_days, daily_cap"
```

**Change 3 — Bookings query (line 137):** Add `event_types!inner(buffer_after_minutes)`
join so each booking row carries its event type's buffer.

```typescript
// BEFORE:
supabase.from("bookings").select("start_at, end_at")

// AFTER:
supabase.from("bookings").select("start_at, end_at, event_types!inner(buffer_after_minutes)")
```

**Change 4 — AccountSettings construction (lines 158-164):** Remove
`buffer_minutes` field.

**Change 5 — BookingRow mapping (line 176-178):** Add `buffer_after_minutes` from
the join.

```typescript
const bookings: BookingRow[] = (bookingsRes.data ?? []).map((b) => ({
  start_at: b.start_at,
  end_at: b.end_at,
  buffer_after_minutes: (b.event_types as { buffer_after_minutes: number })?.buffer_after_minutes ?? 0,
}));
```

**Change 6 — computeSlots call (line 182-194):** Pass `slotBufferAfterMinutes`.

```typescript
const slots = computeSlots({
  ...existing fields...
  slotBufferAfterMinutes: eventType.buffer_after_minutes,
});
```

### Event-Type Form Field Addition (Plan 28-01 code change)

**Pattern reference:** The `duration_minutes` field at `event-type-form.tsx:282-297`
is the exact pattern to replicate for `buffer_after_minutes`. Same `Input` component,
same `type="number"`, same `valueAsNumber: true` registration, same
`max-w-[160px]` class, same error display pattern.

**Differences from duration_minutes:**
- `min={0}` (not 1 — 0 is valid, means no buffer)
- `max={360}` (CONTEXT decision — 6 hours)
- `step={5}` (CONTEXT decision — 5-minute increments)
- Empty string treated as 0 (z.coerce handles this via Zod)

**Position:** Immediately after the `duration_minutes` block (lines 281-297), before
the `max_bookings_per_slot` block. They are "how long does this take" siblings.

**DEFAULTS object update** (`event-type-form.tsx:39-52`): Add
`buffer_after_minutes: 0`.

**Edit page defaultValues** (`event-types/[id]/edit/page.tsx:57-69`): Add
`buffer_after_minutes: eventType.buffer_after_minutes ?? 0`.

### Zod Schema Addition (Plan 28-01 code change)

**File:** `app/(shell)/app/event-types/_lib/schema.ts`

Add to `eventTypeSchema`:
```typescript
buffer_after_minutes: z.coerce
  .number()
  .int("Buffer must be a whole number of minutes.")
  .min(0, "Buffer cannot be negative.")
  .max(360, "Buffer cannot exceed 360 minutes (6 hours).")
  .default(0),
```

Note: `z.coerce.number()` handles the empty-string-to-0 requirement from
CONTEXT. An empty input becomes `""` → `z.coerce` converts to `NaN` → `.int()`
rejects it. To treat empty as 0, use `.or(z.literal("").transform(() => 0))`
prepended, or use `.catch(0)` as a fallback. The cleanest pattern matching the
CONTEXT decision (empty = 0, no "required" error):

```typescript
buffer_after_minutes: z.coerce
  .number()
  .int()
  .min(0, "Buffer cannot be negative.")
  .max(360, "Buffer cannot exceed 360 minutes (6 hours).")
  .catch(0),
```

`z.coerce.number().catch(0)` converts any non-numeric input (including `""`) to 0
without a validation error. Matches "Treat empty string as 0. Forgiving."

### Actions Update (Plan 28-01 code change)

**File:** `app/(shell)/app/event-types/_lib/actions.ts`

Add `buffer_after_minutes` to the INSERT and UPDATE payloads. Both
`createEventTypeAction` (line 110-124) and `updateEventTypeAction` (line 244-259)
must include:
```typescript
buffer_after_minutes: parsed.data.buffer_after_minutes,
```

### Backfill Migration (Plan 28-01 database change)

**File:** `supabase/migrations/20260503XXXXXX_v15_backfill_buffer_after_minutes.sql`

**Pre-flight gate (run BEFORE migration):**
```sql
SELECT id, slug, buffer_after_minutes FROM event_types WHERE buffer_after_minutes <> 0;
```
Must return 0 rows. If non-zero rows exist, hard stop and investigate.

**Backfill SQL (idempotent — WHERE guard ensures no-op on re-run):**
```sql
BEGIN;
  DO $$ BEGIN RAISE NOTICE 'v1.5 Phase 28 backfill: event_types.buffer_after_minutes from accounts.buffer_minutes'; END $$;

  UPDATE event_types et
  SET buffer_after_minutes = a.buffer_minutes
  FROM accounts a
  WHERE et.account_id = a.id
    AND et.buffer_after_minutes = 0;   -- idempotency guard (LD-03)
  -- Note: rows where buffer_after_minutes is already 0 and accounts.buffer_minutes
  -- is also 0 are a no-op (SET 0 = 0), so the WHERE guard is an optimization
  -- but not strictly required for correctness. Still keeps re-run safe.

COMMIT;
```

**Verify after backfill:**
```sql
SELECT DISTINCT buffer_after_minutes FROM event_types ORDER BY 1;
-- Should show 0 (and potentially 15 for nsi account if it had buffer_minutes=15)
```

**Scope filter:** Apply to ALL rows (no archived filter). `event_types.deleted_at`
is a soft-delete column but the schema confirmed it exists. The backfill should
include archived rows — if an owner restores an archived event type, it should
inherit the correct buffer value. Applying to all rows is the cleanest approach.

### DROP Migration (Plan 28-02 database change — held local during drain)

**File:** `supabase/migrations/20260503XXXXXX_v15_drop_accounts_buffer_minutes.sql`

Template from Phase 21 precedent (`20260502034300_v12_drop_deprecated_branding_columns.sql`):

```sql
BEGIN;
  DO $$ BEGIN RAISE NOTICE 'v1.5 Phase 28 DROP migration: accounts.buffer_minutes'; END $$;
  ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes;
COMMIT;
```

Author a `.SKIP` rollback artifact per CP-03 convention:
`20260503XXXXXX_readd_accounts_buffer_minutes.sql.SKIP`

### Availability Panel Cleanup (Plan 28-02 code change)

**Five files to change.** All `buffer_minutes` references must be removed.

**File 1: `app/(shell)/app/availability/_lib/types.ts`**
- Line 23: Remove `buffer_minutes: number;` from `AccountSettingsRow`
- After change, `AccountSettingsRow` has: `min_notice_hours`, `max_advance_days`,
  `daily_cap`, `timezone`

**File 2: `app/(shell)/app/availability/_lib/schema.ts`**
- Lines 134-139: Remove entire `buffer_minutes` field from `accountSettingsSchema`

**File 3: `app/(shell)/app/availability/_lib/queries.ts`**
- Line 53: Remove `buffer_minutes,` from the accounts SELECT string

**File 4: `app/(shell)/app/availability/_lib/actions.ts`**
- Line 64: Remove `buffer_minutes: parsed.data.buffer_minutes,` from the
  `accounts.update()` payload

**File 5: `app/(shell)/app/availability/_components/settings-panel.tsx`**
- Line 15: Remove `buffer_minutes: number;` from `SettingsPanelProps.initial`
- Line 24-25: Remove `bufferMinutes` state and `useState(initial.buffer_minutes)`
- Line 47-48: Remove `buffer_minutes: Number(bufferMinutes),` from the save call
- Lines 74-85: Remove the entire `<Field id="buffer_minutes" .../>` JSX block
  (the "Buffer (minutes)" input)

**File 6: `app/(shell)/app/availability/page.tsx`**
- Line 49: Remove `buffer_minutes: state.account.buffer_minutes,` from
  `SettingsPanel initial` prop

**After cleanup**, `SettingsPanel` renders a 3-field grid (min_notice_hours,
max_advance_days, daily_cap) instead of 4.

### Availability Page Copy Decision (Claude's Discretion — Plan 28-02)

**Current page structure** (verified at `app/(shell)/app/availability/page.tsx`):

```
<section aria-label="Booking settings">
  <h2>Booking settings</h2>
  <SettingsPanel initial={{ buffer_minutes, min_notice_hours, max_advance_days, daily_cap }} />
</section>
```

The subtitle already reads: "Define when people can book and customize buffers,
notice, and caps." After removing buffer from the panel, "buffers" in the subtitle
is stale.

**Recommendation (minimal change, no cross-link):**

1. Remove the buffer field silently (no inline acknowledgment note). The field's
   absence is self-explanatory to owners who check — they will find buffer in the
   event-type editor.
2. Update page subtitle from "...customize buffers, notice, and caps" to
   "...customize notice and caps." One word change.
3. The section heading "Booking settings" still applies to the 3 remaining fields
   — do NOT collapse or remove the section heading.
4. Do NOT add a cross-link from the Availability page to the event-type editor.
   The editor is one click away from the Event Types page in the left nav. A
   cross-link adds UI complexity for a feature that owners will discover naturally.
5. No changes to other page copy (title "Availability", section headings "Weekly
   hours", "Date overrides").

**Rationale:** CONTEXT says "Bias toward minimal change — silent removal +
collapse-if-empty is the likely default unless the existing copy makes the field's
absence confusing." The subtitle IS slightly confusing ("buffers" but no buffer
field), so update the subtitle. Everything else is fine as-is.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Empty string → 0 coercion | Custom string-to-number transform | `z.coerce.number().catch(0)` |
| Supabase join for per-booking buffer | Separate query per booking | `event_types!inner(buffer_after_minutes)` in the bookings SELECT |
| Backfill safety | Manual pre-flight with hard-coded checks | `WHERE buffer_after_minutes = 0` idempotency guard |
| Migration apply | `supabase db push --linked` (broken) | `echo \| npx supabase db query --linked -f <file>` |

---

## Common Pitfalls

### Pitfall 1: ARCHITECTURE.md used wrong column name (post_buffer_minutes)

**What goes wrong:** The v1.5 ARCHITECTURE.md (written before LD-01 was locked)
consistently uses `post_buffer_minutes` as the new column name. LD-01 locks the
name as `buffer_after_minutes` (the existing column). The ARCHITECTURE.md is
superseded by CONTEXT.md and STATE.md. Do NOT use `post_buffer_minutes` anywhere
in Phase 28.

**Prevention:** Verify: every code change uses `buffer_after_minutes`.

### Pitfall 2: Symmetric vs. Asymmetric Buffer Math

**What goes wrong:** The current `slotConflictsWithBookings` applies buffer
symmetrically: extends the SLOT by `bufferMinutes` on BOTH sides. The new
asymmetric semantics are different: extend slot start BACKWARD by the EXISTING
BOOKING's buffer (to check if the existing booking needs post-event space), and
extend slot end FORWARD by the CANDIDATE SLOT's own buffer (to check if the new
slot needs post-event space). Getting this backwards produces wrong availability.

**Correct asymmetric logic (LD-04):**
- `bufferedStart = slotStart - existingBooking.buffer_after_minutes`
  (would placing this slot here violate the existing booking's post-event buffer?)
- `bufferedEnd = slotEnd + candidateSlot.buffer_after_minutes`
  (would placing this slot here crowd out the next slot by its own post-event buffer?)

**Detection:** The BUFFER-06 divergence test must verify that event-type A with
`buffer=0` does NOT block an adjacent candidate slot while event-type B with
`buffer=15` DOES block an adjacent candidate slot.

### Pitfall 3: Test fixtures still pass buffer_minutes on account (V15-CP-04)

**What goes wrong:** `tests/slot-generation.test.ts:32` defines:
```typescript
const baseAccount: AccountSettings = {
  timezone: TZ,
  buffer_minutes: 0,   // <-- will not compile after type change
  ...
}
```
And line 216 passes `account: { ...baseAccount, buffer_minutes: 15 }`.

After `AccountSettings` loses `buffer_minutes`, TypeScript `tsc --noEmit` will
catch these. But if the field is kept as an optional alias, the test will compile
while silently passing the wrong value (the engine no longer reads it).

**Prevention:** Remove `buffer_minutes` from `AccountSettings` entirely (not
optional). Update `baseAccount` to remove the field. The buffer test at line 213-229
must be rewritten to pass `slotBufferAfterMinutes` via `SlotInput` and embed
`buffer_after_minutes` on the `BookingRow`.

### Pitfall 4: Migration order violation (V15-MP-02)

**What goes wrong:** Deploying code that reads `buffer_after_minutes` from
`event_types` before the backfill migration has run means existing event types
have `buffer_after_minutes = 0` (the column default) and all buffers silently
disappear for the `nsi` account (or any account with `buffer_minutes > 0`).

**Correct order:**
1. Backfill migration runs (verifying pre-flight = 0 rows first)
2. Verify backfill values: `SELECT DISTINCT buffer_after_minutes FROM event_types`
3. Deploy code (28-01 deploy)
4. 30-minute drain
5. Grep gate: `grep -rn "buffer_minutes" app/ lib/` = 0
6. DROP migration runs
7. Deploy cleanup (28-02 deploy)

### Pitfall 5: Event-types list page does not show buffer_after_minutes

**What goes wrong:** CONTEXT requires "Always show the buffer value for every
event type (e.g. `Buffer: 15 min` or `Buffer: 0 min`). Never hide it for zero
values." But the list page (`event-types/page.tsx`) queries only:

```typescript
.select("id, name, slug, duration_minutes, is_active, deleted_at, created_at")
```

And `EventTypeListItem` does not include `buffer_after_minutes`. The
`EventTypesTable` component renders only Name, Duration, Slug, Status columns.

**Prevention:** Add `buffer_after_minutes` to the `EventTypeListItem` type,
the list page query SELECT, and add a "Buffer" column to `EventTypesTable`. This
is a Plan 28-01 task, not an afterthought.

### Pitfall 6: lib/slots.types.ts has a conflicting AccountSettings vs. availability types.ts

`lib/slots.types.ts` exports `AccountSettings` (slot engine type).
`app/(shell)/app/availability/_lib/types.ts` exports `AccountSettingsRow` (DB row
for the availability panel). These are separate interfaces in separate files.
Removing `buffer_minutes` from both is required but they are edited independently.
Do not confuse them.

---

## Code Examples

### Backfill SQL (idempotent, with pre-flight inline)
```sql
BEGIN;
  DO $$ BEGIN RAISE NOTICE 'v1.5 backfill: buffer_after_minutes from accounts.buffer_minutes'; END $$;

  UPDATE event_types et
  SET buffer_after_minutes = a.buffer_minutes
  FROM accounts a
  WHERE et.account_id = a.id
    AND et.buffer_after_minutes = 0;

COMMIT;
```

### Supabase join for per-booking buffer (route.ts)
```typescript
supabase
  .from("bookings")
  .select("start_at, end_at, event_types!inner(buffer_after_minutes)")
  .eq("account_id", eventType.account_id)
  .eq("status", "confirmed")
  .gte("start_at", bookingsRangeStart)
  .lte("start_at", `${to}T23:59:59.999Z`)
```

### BookingRow mapping with join result (route.ts)
```typescript
const bookings: BookingRow[] = (bookingsRes.data ?? []).map((b) => ({
  start_at: b.start_at,
  end_at: b.end_at,
  buffer_after_minutes:
    (b.event_types as { buffer_after_minutes: number } | null)
      ?.buffer_after_minutes ?? 0,
}));
```

### Buffer field in event-type form (after duration_minutes, before max_bookings_per_slot)
```tsx
{/* Buffer after event */}
<div className="grid gap-2">
  <Label htmlFor="buffer_after_minutes">Buffer after event (minutes)</Label>
  <Input
    id="buffer_after_minutes"
    type="number"
    min={0}
    max={360}
    step={5}
    inputMode="numeric"
    className="max-w-[160px]"
    {...register("buffer_after_minutes", { valueAsNumber: true })}
  />
  {errors.buffer_after_minutes && (
    <p className="text-sm text-destructive">{errors.buffer_after_minutes.message}</p>
  )}
  <p className="text-sm text-muted-foreground">
    Blocks additional time after this event type ends, preventing back-to-back bookings.
  </p>
</div>
```

### DROP migration (CP-03 pattern from Phase 21)
```sql
BEGIN;
  DO $$ BEGIN RAISE NOTICE 'v1.5 Phase 28 DROP: accounts.buffer_minutes'; END $$;
  ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes;
COMMIT;
```

### New per-event-type divergence test (slot-generation.test.ts)
```typescript
describe("computeSlots — per-event-type buffer divergence (BUFFER-06)", () => {
  it("event-type with buffer=0 does NOT block adjacent slots", () => {
    // Booking at 10:00-10:30 with buffer_after_minutes=0.
    // Adjacent slot at 10:30 should be available.
    const booking: BookingRow = {
      start_at: "2026-06-15T15:00:00.000Z",
      end_at:   "2026-06-15T15:30:00.000Z",
      buffer_after_minutes: 0,
    };
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      slotBufferAfterMinutes: 0,
      rules: [rule(1)],
      bookings: [booking],
    }));
    const starts = result.map(s => s.start_at);
    expect(starts).toContain("2026-06-15T15:30:00.000Z");  // 10:30 CDT — adjacent, not blocked
  });

  it("event-type with buffer=15 DOES block adjacent slots", () => {
    // Booking at 10:00-10:30 with buffer_after_minutes=15.
    // Slot at 10:30 (15:30Z) should be blocked:
    //   bufferedStart = 15:30Z - 15min = 15:15Z
    //   booking bEnd = 15:30Z
    //   isBefore(15:15Z, 15:30Z)=T AND isBefore(15:00Z, 16:00Z)=T → conflict
    const booking: BookingRow = {
      start_at: "2026-06-15T15:00:00.000Z",
      end_at:   "2026-06-15T15:30:00.000Z",
      buffer_after_minutes: 15,
    };
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      slotBufferAfterMinutes: 0,   // candidate event type has no buffer
      rules: [rule(1)],
      bookings: [booking],
    }));
    const starts = result.map(s => s.start_at);
    expect(starts).not.toContain("2026-06-15T15:30:00.000Z");  // 10:30 CDT — blocked by existing booking's buffer
  });

  it("divergence: same account, two event types, booking with buffer=15 blocks event-B slot but not event-C slot", () => {
    // Event B (the booked event type) had buffer=15 on its booking.
    // Event C is what we are computing slots for (buffer=0 on candidate).
    // Candidate slot at 10:30: blocked because the existing booking has buffer=15.
    // If we compute slots for event type D (candidate buffer=15), slot at 10:30 is
    // also blocked (same existing booking buffer).
    // This tests the asymmetry: the EXISTING booking's buffer determines blocking,
    // not the candidate event type's buffer.
    const bookingWithBuffer: BookingRow = {
      start_at: "2026-06-15T15:00:00.000Z",
      end_at:   "2026-06-15T15:30:00.000Z",
      buffer_after_minutes: 15,
    };
    // Candidate = event type with buffer=0: still blocked by existing booking's buffer
    const resultNoBuf = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      slotBufferAfterMinutes: 0,
      rules: [rule(1)],
      bookings: [bookingWithBuffer],
    }));
    expect(resultNoBuf.map(s => s.start_at)).not.toContain("2026-06-15T15:30:00.000Z");

    // Now with a booking that has buffer=0: slot at 10:30 IS available
    const bookingNoBuffer: BookingRow = {
      start_at: "2026-06-15T15:00:00.000Z",
      end_at:   "2026-06-15T15:30:00.000Z",
      buffer_after_minutes: 0,
    };
    const resultWithNoBuf = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      slotBufferAfterMinutes: 0,
      rules: [rule(1)],
      bookings: [bookingNoBuffer],
    }));
    expect(resultWithNoBuf.map(s => s.start_at)).toContain("2026-06-15T15:30:00.000Z");
  });
});
```

---

## File Touch Map

### Plan 28-01 (Deploy A1 — backfill + code rewire + UI)

| File | Change | Direction |
|------|--------|-----------|
| `supabase/migrations/<TS>_v15_backfill_buffer_after_minutes.sql` | Backfill UPDATE with idempotency guard | NEW |
| `lib/slots.types.ts` | `AccountSettings` loses `buffer_minutes`; `BookingRow` gains `buffer_after_minutes: number`; `SlotInput` gains `slotBufferAfterMinutes: number` | MODIFY |
| `lib/slots.ts` | `slotConflictsWithBookings` signature + asymmetric body; `computeSlots` reads `input.slotBufferAfterMinutes` at line 274-278 | MODIFY |
| `app/api/slots/route.ts` | event_types SELECT adds `buffer_after_minutes`; accounts SELECT drops `buffer_minutes`; bookings query adds `event_types!inner(buffer_after_minutes)` join; BookingRow mapping adds field; computeSlots call adds `slotBufferAfterMinutes` | MODIFY |
| `app/(shell)/app/event-types/_lib/schema.ts` | Add `buffer_after_minutes` Zod field with `.catch(0)` | MODIFY |
| `app/(shell)/app/event-types/_lib/types.ts` | `EventTypeListItem` gains `buffer_after_minutes` | MODIFY |
| `app/(shell)/app/event-types/_lib/actions.ts` | INSERT and UPDATE payloads gain `buffer_after_minutes` | MODIFY |
| `app/(shell)/app/event-types/_components/event-type-form.tsx` | Add buffer field after duration; add to DEFAULTS; receive in defaultValues path | MODIFY |
| `app/(shell)/app/event-types/_components/event-types-table.tsx` | Add Buffer column; update query to include `buffer_after_minutes` in SELECT | MODIFY |
| `app/(shell)/app/event-types/page.tsx` | Add `buffer_after_minutes` to the SELECT string | MODIFY |
| `app/(shell)/app/event-types/[id]/edit/page.tsx` | Pass `buffer_after_minutes: eventType.buffer_after_minutes ?? 0` in defaultValues | MODIFY |
| `app/[account]/[event-slug]/_lib/types.ts` | (No change needed — `EventTypeSummary` does not expose buffer; it's a slot-engine input, not a client-facing field) | NO CHANGE |
| `tests/slot-generation.test.ts` | Update `baseAccount` to remove `buffer_minutes`; rewrite buffer test at line 213-229; add BUFFER-06 divergence tests | MODIFY |

### Plan 28-02 (Deploy A2 — DROP migration + availability cleanup)

| File | Change | Direction |
|------|--------|-----------|
| `supabase/migrations/<TS>_v15_drop_accounts_buffer_minutes.sql` | `ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes` | NEW |
| `supabase/migrations/<TS>_readd_accounts_buffer_minutes.sql.SKIP` | Rollback artifact (CP-03 convention) | NEW |
| `app/(shell)/app/availability/_lib/types.ts` | Remove `buffer_minutes` from `AccountSettingsRow` | MODIFY |
| `app/(shell)/app/availability/_lib/schema.ts` | Remove `buffer_minutes` field from `accountSettingsSchema` | MODIFY |
| `app/(shell)/app/availability/_lib/queries.ts` | Remove `buffer_minutes` from accounts SELECT (line 53) | MODIFY |
| `app/(shell)/app/availability/_lib/actions.ts` | Remove `buffer_minutes` from UPDATE payload (line 64) | MODIFY |
| `app/(shell)/app/availability/_components/settings-panel.tsx` | Remove `buffer_minutes` from props, state, save call, and Field JSX | MODIFY |
| `app/(shell)/app/availability/page.tsx` | Remove `buffer_minutes` prop; update subtitle ("buffers, notice, and caps" → "notice and caps") | MODIFY |

### Plan 28-03 (Tests — no deploy)

| File | Change | Direction |
|------|--------|-----------|
| `tests/slot-generation.test.ts` | BUFFER-06 divergence tests (verify already done in 28-01 if not split out) | VERIFY/EXTEND |
| `tests/slots-api.test.ts` | The integration test passes the event type through DB; `buffer_after_minutes = 0` default will work; no test changes needed unless the test explicitly checks buffer behavior | VERIFY |

---

## Drain Protocol Summary (CP-03)

```
STEP 1: Apply backfill migration
  echo | npx supabase db query --linked -f supabase/migrations/<TS>_v15_backfill_buffer_after_minutes.sql
  Verify: SELECT DISTINCT buffer_after_minutes FROM event_types ORDER BY 1;

STEP 2: Deploy 28-01 code (git add + push → Vercel deploy)
  - lib/slots.types.ts, lib/slots.ts, app/api/slots/route.ts
  - event-type-form.tsx, schema.ts, actions.ts, types.ts, page.tsx (list), edit/page.tsx
  - event-types-table.tsx
  - tests/slot-generation.test.ts
  Verify: tsc --noEmit clean; vitest run tests/slot-generation.test.ts green

DRAIN WINDOW — minimum 30 minutes
  Do NOT apply DROP migration. Do NOT push 28-02 commit.

STEP 3: Drain gate
  grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"
  Must return ZERO matches. Any match = stop, investigate.

STEP 4: Apply DROP migration
  echo | npx supabase db query --linked -f supabase/migrations/<TS>_v15_drop_accounts_buffer_minutes.sql
  Verify: SELECT column_name FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'buffer_minutes';
  Must return 0 rows.

STEP 5: Deploy 28-02 code (git add + push → Vercel deploy)
  - availability/_lib/types.ts, schema.ts, queries.ts, actions.ts
  - availability/_components/settings-panel.tsx
  - availability/page.tsx
  Verify: tsc --noEmit clean
```

---

## Test Surface

### Tests to Update in Plan 28-01

**`tests/slot-generation.test.ts`:**
- Line 32: `baseAccount` — remove `buffer_minutes: 0`
- Line 43-61: `input()` helper — no change needed (buffer is on SlotInput directly)
- Lines 213-229: Buffer test — rewrite to use new asymmetric API:
  - Pass `slotBufferAfterMinutes: 15` on the SlotInput
  - Pass `buffer_after_minutes: 0` on the `BookingRow` (existing booking has no buffer)
  - Verify same 13-slot result (existing booking blocks around itself, candidate checks its own buffer extending forward)
  - The test comment math changes because the asymmetric semantics differ slightly from symmetric
- Add BUFFER-06 divergence tests (3 tests, see Code Examples above)

**`tests/slots-api.test.ts`:**
- The test inserts an event type via admin client. The `buffer_after_minutes` column
  defaults to 0 — no explicit insert of that value required.
- No test changes needed for Plan 28-01.
- After Plan 28-02 (column dropped), run `vitest run tests/slots-api.test.ts` to
  confirm the integration test still passes. The test does NOT reference
  `accounts.buffer_minutes` so it should pass cleanly.

**`tests/cross-event-overlap.test.ts`:**
- The `createEventType` helper at line 40-63 does not set `buffer_after_minutes`.
  After the column exists with default=0, this is fine.
- No changes needed.

### New Test in Plan 28-01

**Location:** `tests/slot-generation.test.ts` (extend existing file)

**Describe block:** `"computeSlots — per-event-type buffer divergence (BUFFER-06)"`

**Tests:**
1. Event type buffer=0 — adjacent slot IS available after a booking
2. Existing booking buffer=15 — adjacent slot NOT available (regardless of candidate's buffer)
3. Two-event divergence — same account, booking with buffer=15 blocks candidate, booking with buffer=0 does not block candidate

No pg-driver test is needed for BUFFER-06. The pure unit test in
`slot-generation.test.ts` is sufficient because the divergence behavior is in
the `computeSlots` engine, not a DB constraint. The Phase 28-03 smoke checkpoint
verifies live behavior on the `nsi` account.

---

## Claude's Discretion Recommendations

### Backfill Source Value
**Recommendation:** Copy `accounts.buffer_minutes` to ALL `event_types.buffer_after_minutes`
rows for that account. `nsi` account currently has `buffer_minutes = 0` based on
the Phase 4 default. Verify at migration time with:
```sql
SELECT slug, buffer_minutes FROM accounts;
```
If `nsi` has `buffer_minutes = 0`, the backfill is a no-op (0 → 0) but still
runs cleanly through the idempotency guard.

### Backfill Scope Filter
**Recommendation:** Apply to ALL rows (no soft-delete filter). The schema has
`event_types.deleted_at` for soft deletes, but excluding archived rows creates
risk: if an owner restores an archived event type, it would have `buffer_after_minutes = 0`
even if the account previously had `buffer_minutes = 15`. All rows is safer.

### Availability Panel Cleanup Specifics
**Recommendation (see Architecture Patterns section):**
- Silent removal of buffer field (no inline note)
- Update subtitle from "...customize buffers, notice, and caps" to "...customize notice and caps"
- Keep section heading "Booking settings" (still accurate for 3 remaining fields)
- No cross-link to event-type editor
- No other copy changes

### Validation / Error UX Details
**Recommendation:** The `buffer_after_minutes` field uses `z.coerce.number().catch(0)`.
This means no validation error for empty or 0 input. Out-of-range (> 360) and
non-integer inputs display inline errors below the field, consistent with
`duration_minutes` error display pattern at line 294-296.

For non-multiple-of-5 input: CONTEXT says `step={5}` but does NOT lock a
"must be multiple of 5" validation error. The `step` attribute provides browser
UI affordance (up/down arrows step by 5) but does not prevent typing arbitrary
values. Do NOT add server-side validation for multiples of 5 — it would break
existing behavior if someone types 12 minutes. Trust the step UI to guide owners.

### Help Text Exact Wording
**Recommendation:** One line, plain language, consistent with `max_bookings_per_slot`
help text tone (see form lines 315-317):
```
"Blocks additional time after this event type ends, preventing back-to-back bookings."
```

---

## Phase-Specific Pitfalls from PITFALLS.md

The following V15 pitfalls are directly relevant to Phase 28 planning:

| Pitfall | Risk | How to Avoid |
|---------|------|-------------|
| V15-CP-01 | Column naming collision (`buffer_after_minutes` vs `post_buffer_minutes`) | LOCKED: use `buffer_after_minutes`. Architecture.md uses wrong name — ignore it. |
| V15-CP-02 | Nullable column + NaN buffer math | Column is NOT NULL DEFAULT 0; verified at schema line 36. No nullable risk. |
| V15-CP-03 | CP-03 two-step DROP required | 30-min drain between 28-01 and 28-02 deploys. DROP file held local during drain. |
| V15-CP-04 | Slot engine type contract — stale test fixtures | Remove `buffer_minutes` from `AccountSettings` entirely. Update test fixtures synchronously. |
| V15-CP-05 | No divergence test exists | Add BUFFER-06 three-case divergence test in Plan 28-01. |
| V15-CP-06 | Reschedule lib must NOT gain buffer reads | `lib/bookings/reschedule.ts` must have zero `buffer` references after Phase 28. Verify with grep. |
| V15-MP-01 | `AccountSettings` type change breaks availability action compile | Remove `buffer_minutes` from both `lib/slots.types.ts:AccountSettings` AND `availability/_lib/types.ts:AccountSettingsRow`. They are separate interfaces. |
| V15-MP-02 | Migration-before-code ordering | Backfill migration runs first. Verify backfill values. Then code deploy. |
| V15-XF-03 | Pre-flight + drain gates are mandatory | Both gates are explicit checkpoints in the plan. Block on human verification at each. |

---

## Open Questions

1. **`nsi` account's current `buffer_minutes` value:** If it's non-zero (e.g. 15),
   the backfill will write 15 to all nsi event types. If it's 0 (the Phase 4
   default), the backfill is a semantic no-op. Verify with
   `SELECT slug, buffer_minutes FROM accounts;` before the backfill runs.
   The plan assumes 0 based on Phase 4 defaults.

2. **`slots-api.test.ts` reads `buffer_minutes` from account indirectly:** The test
   calls the real GET handler. After 28-01 deploy, the handler no longer reads
   `accounts.buffer_minutes`. After 28-02 drop, the column is gone. The test's
   `beforeAll` reads `max_advance_days` from the account (not `buffer_minutes`) so
   no test breakage expected. Confirm by running the test after each deploy.

3. **`EventTypeSummary` in `app/[account]/[event-slug]/_lib/types.ts`:** Currently
   does NOT include `buffer_after_minutes`. The slot engine reads it from the
   `SlotInput.slotBufferAfterMinutes` field populated by the route handler, not from
   the client-facing `EventTypeSummary`. No change needed to this type.

---

## Sources

### Primary (HIGH confidence — direct source file inspection, 2026-05-03)

| Source | What Was Verified |
|--------|------------------|
| `lib/slots.ts:203-218, 274-278` | `slotConflictsWithBookings` current signature; `account.buffer_minutes` passed at line 277 confirmed |
| `lib/slots.types.ts:11-22, 47-52` | `AccountSettings.buffer_minutes` at line 15; `BookingRow` shape (no buffer field) confirmed |
| `app/api/slots/route.ts:89, 121, 137, 158-164, 176-179, 182-194` | Full buffer read chain confirmed; `buffer_minutes` in accounts SELECT at line 121 |
| `app/(shell)/app/event-types/_lib/schema.ts:48-95` | `eventTypeSchema` — no `buffer_after_minutes` field; `duration_minutes` pattern at line 61-65 confirmed |
| `app/(shell)/app/event-types/_lib/types.ts:36-57` | `EventTypeRow` includes `buffer_after_minutes: number` at line 44 |
| `app/(shell)/app/event-types/_lib/actions.ts:110-124, 244-259` | INSERT and UPDATE payloads — `buffer_after_minutes` absent; pattern for adding confirmed |
| `app/(shell)/app/event-types/_components/event-type-form.tsx:39-52, 282-297` | DEFAULTS object; `duration_minutes` field pattern confirmed |
| `app/(shell)/app/event-types/[id]/edit/page.tsx:17-19, 57-69` | `buffer_after_minutes` already in SELECT; NOT in defaultValues |
| `app/(shell)/app/event-types/page.tsx:46-48` | SELECT string excludes `buffer_after_minutes` |
| `app/(shell)/app/event-types/_components/event-types-table.tsx` | No buffer column in table |
| `app/(shell)/app/availability/_components/settings-panel.tsx:13-20, 24-26, 74-85` | `buffer_minutes` prop, state, Field JSX confirmed |
| `app/(shell)/app/availability/_lib/actions.ts:63-64` | `buffer_minutes` in UPDATE payload confirmed |
| `app/(shell)/app/availability/_lib/queries.ts:52-53` | `buffer_minutes` in SELECT confirmed |
| `app/(shell)/app/availability/_lib/schema.ts:134-139` | `buffer_minutes` Zod field confirmed |
| `app/(shell)/app/availability/_lib/types.ts:23-24` | `buffer_minutes: number` in `AccountSettingsRow` confirmed |
| `app/(shell)/app/availability/page.tsx:44-57` | `buffer_minutes` prop pass-through; subtitle text confirmed |
| `tests/slot-generation.test.ts:32, 213-229` | `baseAccount.buffer_minutes` at line 32; buffer test at line 213-229 confirmed |
| `supabase/migrations/20260419120000_initial_schema.sql:35-36` | `buffer_after_minutes INT NOT NULL DEFAULT 0` exists on `event_types` since v1.0 |
| `supabase/migrations/20260425120000_account_availability_settings.sql` | `accounts.buffer_minutes` added Phase 4 — this is the column to DROP |
| `supabase/migrations/20260502034300_v12_drop_deprecated_branding_columns.sql` | CP-03 DROP migration template (BEGIN/COMMIT pattern, IF EXISTS guard, RAISE NOTICE header) |
| `app/[account]/[event-slug]/_lib/types.ts` | `EventTypeSummary` confirmed — no `buffer_after_minutes` needed here |

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable, no external dependencies)
