# Phase 32: Inverse Date Overrides - Research

**Researched:** 2026-05-05
**Domain:** Availability engine semantics, schema migration, owner UI, batch cancel lifecycle
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

Phase 32 flips the `date_overrides` table from "custom available hours" semantics to "unavailable windows" semantics. The database schema is already perfectly suited for reuse: rows with `is_closed=false` currently mean "these are the available windows"; after this phase they will mean "these are the unavailable windows." The slot engine (`lib/slots.ts`) needs its `windowsForDate` function rewritten to compute (weekly-hours windows) MINUS (unavailable windows) instead of replacing weekly hours with the override windows. All existing DB constraints, RLS, the unique index on `(account_id, override_date, start_minute)`, and the `is_closed` column for full-day blocking are reusable without structural changes.

The existing "custom hours" UI in `override-modal.tsx` is the starting point for the "unavailable windows" UI. The modal structure, `TimeWindowPicker`, the two-button mode toggle, and `upsertDateOverrideAction` are all directly reusable. The mode rename from "Custom hours" → "Add unavailable windows" (and "Block this day" preserved as-is) is the primary UI delta. The affected-booking preview and quota-gated commit are new additions to the modal's save flow.

The batch cancel lifecycle does NOT need a new code path. `cancelBooking()` in `lib/bookings/cancel.ts` is the single canonical implementation. Phase 32 calls it N times inside a server action, with `getRemainingDailyQuota()` as the pre-flight gate. The owner notification can be skipped (pass `actor: "owner"`, which suppresses the owner duplicate email — it was the owner who initiated the batch). The booker cancel email must still fire per booking.

**Primary recommendation:** Reuse schema as-is (no column drops). Add `unavailable_windows` semantics in `windowsForDate()` via a MINUS computation. Reuse `override-modal.tsx` + `upsertDateOverrideAction` with semantic rename. Build the affected-booking preview + quota pre-flight inside a new server action for the commit step.

---

## Standard Stack

No new libraries needed. All required tools already exist in the project.

### Core (already installed)
| Library | Version | Purpose | Already Used By |
|---------|---------|---------|--------------|
| `@date-fns/tz` | v4 | TZDate, DST-safe date arithmetic | `lib/slots.ts`, `lib/email/send-cancel-emails.ts` |
| `date-fns` | v4 | `addMinutes`, `isBefore`, `isAfter` | `lib/slots.ts` |
| `zod` | v3 | Server action input validation | `availability/_lib/schema.ts`, all existing actions |
| `sonner` | current | Toast notifications | All owner dashboard components |
| `next/navigation` | Next.js 14 | `useRouter().refresh()` for revalidation | `override-modal.tsx`, `cancel-button.tsx` |
| `@supabase/supabase-js` | current | DB queries | All server actions |

### No New Dependencies Required
The entire phase can be implemented with the existing stack. No `npm install` step needed.

---

## Architecture Patterns

### Recommended File Structure for Phase 32

No new top-level directories. All changes are surgical additions to existing files plus one new server action file:

```
lib/
  slots.ts                          # MODIFY: windowsForDate() MINUS semantics
  slots.types.ts                    # NO CHANGE: DateOverrideRow already sufficient
  bookings/
    cancel.ts                       # NO CHANGE: used as-is by batch action
  email/
    send-cancel-emails.ts           # NO CHANGE: used as-is per booking

app/(shell)/app/availability/
  _lib/
    actions.ts                      # MODIFY: upsertDateOverrideAction gets batch-cancel pre-flight
    actions-batch-cancel.ts         # NEW: commitInverseOverrideAction (quota pre-flight + batch cancel)
    queries.ts                      # MODIFY or NEW helper: getAffectedBookings(date, windows)
    schema.ts                       # MINOR MODIFY: rename "custom_hours" type label if needed
    types.ts                        # MINOR MODIFY: update DateOverrideInput if needed
  _components/
    override-modal.tsx              # MAJOR MODIFY: semantic rename + affected-booking preview
    time-window-picker.tsx          # NO CHANGE: reuse as-is

supabase/migrations/
  YYYYMMDD_phase32_date_overrides_semantics.sql  # NEW: comment-only migration OR
                                                 # add unavailable_windows_mode col if needed
```

### Pattern 1: MINUS Semantics in `windowsForDate()`

**What:** Replace the existing "override custom-hours = available windows" branch with a computation that subtracts unavailable windows from the day's weekly-hours windows.

**Current behavior (lines 137–158 of `lib/slots.ts`):**
```typescript
// CURRENT (to be replaced):
const customHours = dayOverrides.filter(
  (o) => !o.is_closed && o.start_minute !== null && o.end_minute !== null,
);
if (customHours.length > 0) {
  // Override-replace: use the override windows; ignore weekly rules entirely
  return customHours.map((o) => ({
    start_minute: o.start_minute as number,
    end_minute: o.end_minute as number,
  }));
}
```

**New behavior (Phase 32):**
```typescript
// NEW: unavailable windows MINUS semantics
const unavailableWindows = dayOverrides.filter(
  (o) => !o.is_closed && o.start_minute !== null && o.end_minute !== null,
);
if (unavailableWindows.length > 0) {
  // Start from weekly-rules windows for this day
  const baseWindows = dayRules.map((r) => ({
    start_minute: r.start_minute,
    end_minute: r.end_minute,
  }));
  if (baseWindows.length === 0) return null; // day is already closed in weekly rules
  // Subtract each unavailable window from the base windows
  return subtractWindows(baseWindows, unavailableWindows);
}
```

**`subtractWindows(base, blocked)` algorithm:**
```typescript
// Confidence: HIGH — this is standard interval subtraction
// For each base window, cut out all blocked sub-ranges.
// Returns array of remaining sub-windows (may be empty → day has no slots).
function subtractWindows(
  base: Array<{ start_minute: number; end_minute: number }>,
  blocked: Array<{ start_minute: number; end_minute: number }>,
): Array<{ start_minute: number; end_minute: number }> {
  let result = [...base];
  for (const b of blocked) {
    const next: typeof result = [];
    for (const w of result) {
      // No overlap: keep as-is
      if (b.end_minute <= w.start_minute || b.start_minute >= w.end_minute) {
        next.push(w);
        continue;
      }
      // Left fragment: base start up to blocked start
      if (b.start_minute > w.start_minute) {
        next.push({ start_minute: w.start_minute, end_minute: b.start_minute });
      }
      // Right fragment: blocked end up to base end
      if (b.end_minute < w.end_minute) {
        next.push({ start_minute: b.end_minute, end_minute: w.end_minute });
      }
      // If neither fragment: this base window is fully swallowed — emit nothing
    }
    result = next;
  }
  return result;
}
```

**When to use:** Called inside `windowsForDate()` when a date has `is_closed=false` override rows. Result of `[]` (empty) means the entire day is blocked by unavailable windows — return `null` to signal no slots.

**EXCLUDE GIST interaction:** None. The EXCLUDE constraint lives on the `bookings` table and checks for overlap between confirmed bookings. The slot engine MINUS computation only affects which candidate slots are generated — it does not touch the bookings table. The constraint continues to fire correctly on insert.

**Buffer-after interaction:** Buffer-after-minutes is applied per-slot in `slotConflictsWithBookings()` AFTER `windowsForDate()` returns windows. No change needed: the buffer check runs inside the slot generation loop, independent of how windows were derived (weekly rules, or MINUS semantics).

---

### Pattern 2: Affected-Booking Pre-flight Query

**What:** Before showing the save confirmation, query which confirmed bookings fall inside any of the owner's new unavailable windows for that date.

**Key query:** Load confirmed bookings for `account_id` where `start_at` falls on the given override date AND `start_at` overlaps with any of the new unavailable windows.

```typescript
// Source: lib/bookings/cancel.ts pattern + bookings queries.ts
// Confidence: HIGH — verified against schema
async function getAffectedBookings(
  accountId: string,
  overrideDate: string,        // "YYYY-MM-DD"
  unavailableWindows: Array<{ start_minute: number; end_minute: number }>,
  accountTimezone: string,
): Promise<AffectedBooking[]> {
  // Widen to full UTC day then filter in JS by window overlap
  // (timezone conversion: convert window minutes to UTC instants for the given date)
  const supabase = createAdminClient(); // or createClient() in server action context
  const { data } = await supabase
    .from("bookings")
    .select("id, start_at, end_at, booker_name, event_types!inner(name)")
    .eq("account_id", accountId)
    .eq("status", "confirmed")
    .gte("start_at", `${overrideDate}T00:00:00.000Z`)
    .lte("start_at", `${overrideDate}T23:59:59.999Z`);
  // Then filter in TS: for each booking, check if start_at falls inside
  // any unavailable window using the account timezone.
  // (Same TZDate pattern as lib/slots.ts countBookingsOnLocalDate)
}
```

**Return shape for the preview:**
```typescript
interface AffectedBooking {
  id: string;
  start_at: string;     // UTC ISO
  end_at: string;
  booker_name: string;
  event_type_name: string;
}
```

**Display density:** Match `/app/bookings` row density: name + time range (in owner timezone) + event-type label. Chronological sort by `start_at`.

---

### Pattern 3: Quota Pre-flight + Batch Cancel Server Action

**What:** A new server action `commitInverseOverrideAction` that:
1. Calls `getRemainingDailyQuota()` to count remaining daily sends
2. Computes needed emails: N affected bookings × 2 (booker + owner) — BUT owner email for batch-initiated cancel should be skipped (owner initiated it, no need to notify)  
   - Corrected: N × 1 (booker only) + optionally 1 batch summary to owner
   - Simplest: N × 2 (pass `actor: "owner"` to `cancelBooking()`, which sends both; the owner will get N notifications). Per CONTEXT.md discretion, prefer single owner summary or no owner email.
3. If `remaining < needed`: return error object with `{ quotaError: true, needed, remaining }`
4. On commit: iterate affected booking IDs, call `cancelBooking()` for each with `actor: "owner"`, accumulate results
5. Then save the new override rows (same `upsertDateOverrideAction` flow)
6. Return: `{ ok: true, cancelledCount, emailFailures[] }` or `{ quotaError }` or `{ formError }`

**Quota math for the pre-flight:**
- Each `cancelBooking()` call with `actor: "owner"` sends 2 emails (booker + owner notification)
- Per CONTEXT.md discretion, owner notification on batch is optional ("no email acceptable since owner initiated batch")
- **Recommended:** Pass `actor: "owner"` but suppress owner email in the batch by passing a synthetic `reason` that signals batch mode — OR add a `skipOwnerEmail` flag to `cancelBooking()` args. The simpler option is to call `cancelBooking()` with `actor: "owner"` normally (both emails sent) and count N×2 for the quota check. If quota is tight, this is conservative.
- **Simplest safe pattern:** Count `needed = affectedBookings.length * 2`, check against `getRemainingDailyQuota()`.

**Signature:**
```typescript
export async function commitInverseOverrideAction(input: {
  override_date: string;
  unavailableWindows: Array<{ start_minute: number; end_minute: number }>;
  isFullDayBlock: boolean;
  affectedBookingIds: string[];
  reason?: string;
}): Promise<CommitOverrideResult>
```

---

### Pattern 4: Override Modal — Semantic Rename + Affected-Booking Preview

**Current modal modes:** `"block"` | `"custom_hours"`

**New modal modes:** `"block"` | `"unavailable"` (same underlying shape — rows with `is_closed=false` and time windows)

**UI flow:**
1. Owner picks a date (same as today)
2. Mode buttons: "Block entire day" (was "Block this day") | "Add unavailable windows" (was "Custom hours")
3. When mode is "unavailable": same `TimeWindowPicker` rows + "Add window" button
4. Owner clicks "Save" → trigger `getAffectedBookings()` (new) → show preview section inline or in a second confirmation step
5. If affected bookings exist: show list + quota check
   - If quota OK: show "Confirm — this will cancel X bookings" button (disabled until confirmed)
   - If quota exceeded: disable commit, show inline error "X emails needed, Y remaining today (resets at UTC midnight)"
6. On confirm: call `commitInverseOverrideAction()`

**"Block entire day" toggle behavior (CONTEXT.md discretion — hide+preserve):**
- When toggled ON: hide the windows list in UI but do NOT wipe the `windows` state array
- When toggled OFF: restore the windows list from state
- On save in "block" mode: write a single `is_closed=true` row (same as today's behavior)

**Affected-bookings preview placement:** Inline below the "Save" button trigger, above the final "Confirm" action. NOT a separate modal. The owner sees: date → windows → save → affected list appears inline → confirm button. This matches the dashboard's compact flow (no deep nested dialogs).

**Per-booking display:**
```tsx
// Match /app/bookings list density
<div key={b.id}>
  <span>{b.booker_name}</span>
  <span>{formatTime(b.start_at, accountTimezone)} – {formatTime(b.end_at, accountTimezone)}</span>
  <span>{b.event_type_name}</span>
</div>
```

---

### Pattern 5: Schema Migration Strategy

**Production data state:** Confirmed rows exist (`date_overrides` has real data). The current schema:
```sql
create table date_overrides (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  override_date date not null,
  is_closed boolean not null default false,
  start_minute smallint check (start_minute between 0 and 1439),
  end_minute smallint check (end_minute between 1 and 1440),
  note text,
  created_at timestamptz not null default now(),
  check (is_closed or (start_minute is not null and end_minute is not null and end_minute > start_minute)),
  unique (account_id, override_date, start_minute)
);
```

**Current row semantics:** Rows with `is_closed=false` and `start_minute/end_minute` are "custom available hours" — these are the specific windows an owner opened on a date, replacing the weekly schedule.

**Migration decision (CP-03 compliant):** The SAFEST approach is **do NOT auto-invert** existing `is_closed=false/custom_hours` rows. Those rows encode specific available-hours overrides; inverting them to "unavailable" could produce wildly wrong unavailability (e.g. an owner who had 9-17 as their override would end up with 9-17 blocked, which is the opposite of their intent).

**Recommended migration approach:**
- **Option A (Cleanest):** Add a new boolean column `semantics_v2 boolean NOT NULL DEFAULT false` — rows with `semantics_v2=false` (legacy) continue to behave as "available hours" in the slot engine; rows with `semantics_v2=true` behave as "unavailable windows." New writes from Phase 32 UI always set `semantics_v2=true`. This is the CP-03 add-new/dual-read pattern. After a burn-down period, drop `semantics_v2=false` rows or migrate them.
- **Option B (Simpler, lower risk):** Delete all existing `is_closed=false/custom_hours` rows from production on deploy (they are "custom available hours" overrides that become meaningless once the UI is replaced). The owner will need to re-enter any needed unavailability. Given the low row count (project has ~6 total bookings confirmed by the Phase 27 migration comment), existing `date_overrides` rows are almost certainly sparse/few. This is viable.
- **Option C (No migration):** Keep existing rows but treat them as "stale" — the new UI will write new rows with `semantics_v2=true` and the engine reads only those. Old rows without the column continue with legacy semantics.

**Recommended:** Option A (add `semantics_v2` column). CP-03 two-step compliant. The slot engine reads `semantics_v2` on each row to branch into PLUS or MINUS logic. After Phase 32 ships and old rows are cleared (or the owner re-saves them), drop the column in a follow-up.

**HOWEVER:** The planner should verify the actual production row count and content before finalizing. Given the project's small scale (6 confirmed bookings, likely very few overrides), Option B (wipe existing custom_hours rows) may be even simpler and cleaner. The researcher's recommendation: check real row count and content in the planning step using:
```bash
echo "SELECT override_date, is_closed, start_minute, end_minute, note FROM date_overrides WHERE account_id = (SELECT id FROM accounts LIMIT 1) ORDER BY override_date;" | npx supabase db query --linked
```

---

### Anti-Patterns to Avoid

- **Auto-inverting existing "custom_hours" rows:** A row with `start_minute=540, end_minute=1020` currently means "available 9-17" — inverting it would mean "unavailable 9-17" which blocks the owner's entire working day. Do NOT auto-invert without the owner's explicit consent.
- **Building a new cancel path:** `cancelBooking()` already handles `actor: "owner"`, audit rows, `.ics CANCEL`, booker email, and owner notification. Do not duplicate this in a new function. Call it N times in a loop inside the server action.
- **Making the slot engine's MINUS computation aware of DB semantics_v2 column:** Keep the engine pure. The route handler (`/api/slots/route.ts`) should filter rows by `semantics_v2=true` before passing to `computeSlots()`. The engine's `windowsForDate()` only needs to know "is this unavailable or available" from the row shape it receives — the route handler controls what it passes.
- **Overlapping unavailable windows from the owner:** The existing `timeWindowSchema` + `findOverlap()` in `schema.ts` already prevents overlapping windows in form submissions. Reuse these validators for the unavailable-windows input. The `subtractWindows()` function handles non-overlapping unavailable windows correctly regardless; overlapping inputs should still be rejected at the Zod layer.
- **Window outside the day's weekly hours (no-op):** If owner enters "unavailable 18:00-19:00" but weekly hours are 9-17, the unavailability is a no-op (no slots exist there anyway). `subtractWindows()` handles this correctly — the window to subtract has no overlap with any base window, so it returns the base windows unchanged. No special-case needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cancel a single booking | New cancel function | `cancelBooking()` in `lib/bookings/cancel.ts` | Already handles CAS guard, dead-hash invalidation, email, audit row |
| Email quota check | New quota counter | `getRemainingDailyQuota()` in `lib/email-sender/quota-guard.ts` | Phase 31 implementation, tested in production |
| Time window overlap validation | New validator | `findOverlap()` + `timeWindowSchema` in `availability/_lib/schema.ts` | Already used for weekly rules and existing overrides |
| Time picker UI | New component | `TimeWindowPicker` in `availability/_components/time-window-picker.tsx` | Native `<input type="time">` with `minutesToHHMM`/`hhmmToMinutes` helpers |
| Cancel confirmation dialog | New dialog pattern | `AlertDialog` from `@/components/ui/alert-dialog` | Same pattern used in `cancel-button.tsx` and `day-detail-row.tsx` |
| Interval subtraction | Third-party library | `subtractWindows()` — hand-roll this ONE function | Simple enough, no deps; existing codebase has no interval library |

**Key insight:** This phase is primarily a semantic inversion and UI rename. The heavy lifting (cancel lifecycle, quota guard, time pickers, validation) all exists. The new code is: `subtractWindows()` in slots, `getAffectedBookings()` query, and `commitInverseOverrideAction()` server action.

---

## Common Pitfalls

### Pitfall 1: Auto-inverting Production Rows
**What goes wrong:** Migration script converts all `is_closed=false, start_minute/end_minute` rows from "available" to "unavailable" semantics, blocking all of the owner's existing available-hours overrides.
**Why it happens:** Assumption that a data migration is needed to "upgrade" the schema.
**How to avoid:** Either delete existing `custom_hours` rows (Option B above) or add a `semantics_v2` column to distinguish old from new rows (Option A). Never flip interpretation of existing rows.
**Warning signs:** Owner reports "all my slots are gone" on a day where they had a custom-hours override before.

### Pitfall 2: Slot Engine Receives Wrong Row Set
**What goes wrong:** The `/api/slots` route passes ALL `date_overrides` rows to `computeSlots()`, including old `semantics_v2=false` rows from before Phase 32. The engine's new MINUS logic interprets old "available hours" rows as "unavailable windows," producing no slots on those days.
**Why it happens:** Forgetting to filter by `semantics_v2=true` (or equivalent) in the route handler before passing to the engine.
**How to avoid:** In `/api/slots/route.ts`, filter `overridesRes.data` to only pass rows with `semantics_v2=true` (or only `is_closed=true` rows + new unavailable rows). Old rows without `semantics_v2` should continue to be handled by legacy logic or excluded.
**Warning signs:** Slots disappear on dates where the owner had old custom-hours overrides.

### Pitfall 3: Zero-length Unavailable Window
**What goes wrong:** Owner submits `start_minute === end_minute`. The `subtractWindows()` function would interpret this as a zero-length block and produce correct output (no-op), but it is a data quality issue.
**Why it happens:** `TimeWindowPicker` only validates `end > start` client-side; user bypasses client validation.
**How to avoid:** The existing `timeWindowSchema` in `schema.ts` already has `end_minute > start_minute` as a DB-level CHECK and Zod refine. Reuse the same validator for unavailable windows. No additional code needed.

### Pitfall 4: Race — Booking Created After Pre-flight But Before Commit
**What goes wrong:** Owner opens override modal, pre-flight shows 0 affected bookings, but a booker creates a new booking on that date in the window between pre-flight and commit. The batch cancel misses it.
**Why it happens:** Pre-flight is a snapshot; the commit happens N seconds later.
**How to avoid:** In `commitInverseOverrideAction()`, after saving the override rows, re-query affected bookings INSIDE the server action (server-side, post-save). If new bookings appeared after the pre-flight, they are now inside the unavailable window and must be cancelled too. The slot engine will block new bookings after the override rows are written.
**Warning signs:** A booking exists on the public page during the narrow window between override write and cancel batch completing. Not a data corruption issue — eventual consistency is acceptable; the booking will be found and cancelled in the re-query.

### Pitfall 5: Owner Notification Spam
**What goes wrong:** 10 bookings are cancelled → owner gets 10 "Booking cancelled" emails.
**Why it happens:** `cancelBooking()` always sends owner notification when `actor: "owner"`.
**How to avoid per CONTEXT.md discretion:** For the batch path, prefer a single batch summary OR no owner email. Simplest implementation: add a `skipOwnerEmail?: boolean` field to `CancelBookingArgs` in `lib/bookings/cancel.ts` and pass `skipOwnerEmail: true` for the batch-cancel path. Inside `cancelBooking()`, skip the `sendOwnerCancelEmail()` call when the flag is set. This also reduces quota consumption: N bookings × 1 email (booker only) instead of N × 2.
**Warning signs:** Owner complains about N duplicate cancellation notifications for a single unavailability block.

### Pitfall 6: Quota Pre-flight Undercounts
**What goes wrong:** Pre-flight counts N×1 (booker only) but `cancelBooking()` sends N×2 (booker + owner). Quota is exceeded mid-batch, some bookings are cancelled without email.
**How to avoid:** Count `needed = N × 2` in the pre-flight, OR add `skipOwnerEmail: true` as in Pitfall 5 and count `needed = N × 1`. Be consistent: pre-flight count must match actual email count from the batch.

### Pitfall 7: `subtractWindows()` Returns Empty Array
**What goes wrong:** Owner sets an unavailable window that covers the entire day's available hours. `subtractWindows()` returns `[]`. The calling code passes `[]` to `generateWindowSlots()` which generates no slots — correct. But the planner might forget to handle the `[]` return from `windowsForDate()` as a day-closed signal.
**How to avoid:** `windowsForDate()` should return `null` when `subtractWindows()` returns `[]`. The existing convention is `null = no slots for this day`. Add: `const remaining = subtractWindows(...); if (remaining.length === 0) return null;`.

---

## Code Examples

### `subtractWindows()` — Interval Subtraction (NEW)
```typescript
// Source: derived from standard interval algebra; verified against edge cases
// Confidence: HIGH
function subtractWindows(
  base: Array<{ start_minute: number; end_minute: number }>,
  blocked: Array<{ start_minute: number; end_minute: number }>,
): Array<{ start_minute: number; end_minute: number }> {
  let result = [...base];
  for (const b of blocked) {
    const next: typeof result = [];
    for (const w of result) {
      if (b.end_minute <= w.start_minute || b.start_minute >= w.end_minute) {
        next.push(w);
        continue;
      }
      if (b.start_minute > w.start_minute) {
        next.push({ start_minute: w.start_minute, end_minute: b.start_minute });
      }
      if (b.end_minute < w.end_minute) {
        next.push({ start_minute: b.end_minute, end_minute: w.end_minute });
      }
    }
    result = next;
  }
  return result;
}
```

### Quota Pre-flight Pattern (from `quota-guard.ts`)
```typescript
// Source: lib/email-sender/quota-guard.ts — getRemainingDailyQuota()
// Confidence: HIGH
const remaining = await getRemainingDailyQuota();
const needed = affectedBookingIds.length * 2; // or *1 if skipOwnerEmail
if (remaining < needed) {
  return { quotaError: true, needed, remaining };
}
```

### Inline Quota Error UX (from `day-detail-row.tsx` pattern)
```tsx
// Source: app/(shell)/app/_components/day-detail-row.tsx + cancel-button.tsx
// Confidence: HIGH — this is the Phase 31 locked pattern
{quotaError && (
  <p className="text-sm text-red-600 mt-2" role="alert">
    {needed} emails needed, {remaining} remaining today. Quota resets at UTC midnight.
    Use Gmail to notify affected bookers manually after saving.
  </p>
)}
<Button disabled={!!quotaError || isPending} onClick={handleCommit}>
  {isPending ? "Cancelling..." : `Confirm — cancel ${affectedBookings.length} booking${affectedBookings.length === 1 ? "" : "s"}`}
</Button>
```

### Batch Cancel in Server Action
```typescript
// Source: lib/bookings/cancel.ts pattern
// Confidence: HIGH
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const results = await Promise.allSettled(
  affectedBookingIds.map((id) =>
    cancelBooking({
      bookingId: id,
      actor: "owner",
      reason: ownerReason,
      appUrl,
      ip: null,
      // skipOwnerEmail: true,  // add if Pitfall 5 fix is applied
    })
  )
);
// Count ok vs. failed
const cancelled = results.filter(r => r.status === "fulfilled" && r.value.ok).length;
const failed = results.length - cancelled;
```

### Affected Bookings Query with Window Overlap Filter
```typescript
// Source: availability/_lib/queries.ts pattern + lib/slots.ts TZDate pattern
// Confidence: HIGH
import { TZDate } from "@date-fns/tz";

export async function getAffectedBookings(
  supabase: SupabaseClient,
  accountId: string,
  overrideDate: string, // "YYYY-MM-DD"
  unavailableWindows: Array<{ start_minute: number; end_minute: number }>,
  accountTimezone: string,
): Promise<AffectedBooking[]> {
  const { data } = await supabase
    .from("bookings")
    .select("id, start_at, end_at, booker_name, event_types!inner(name)")
    .eq("account_id", accountId)
    .eq("status", "confirmed")
    .gte("start_at", `${overrideDate}T00:00:00.000Z`)
    .lte("start_at", `${overrideDate}T23:59:59.999Z`);

  if (!data) return [];

  const [y, m, d] = overrideDate.split("-").map(Number);
  return data.filter((b) => {
    const localStart = new TZDate(new Date(b.start_at), accountTimezone);
    const startMinute = localStart.getHours() * 60 + localStart.getMinutes();
    return unavailableWindows.some(
      (w) => startMinute >= w.start_minute && startMinute < w.end_minute
    );
  }).map((b) => ({
    id: b.id,
    start_at: b.start_at,
    end_at: b.end_at,
    booker_name: b.booker_name,
    event_type_name: (Array.isArray(b.event_types) ? b.event_types[0] : b.event_types)?.name ?? "Unknown",
  }));
}
```

---

## State of the Art

| Old Approach | New Approach (Phase 32) | Change | Impact |
|--------------|-------------------------|--------|--------|
| `date_overrides` with `is_closed=false` = available hours (replaces weekly schedule) | `date_overrides` with `is_closed=false` = unavailable windows (MINUS from weekly schedule) | Phase 32 semantic flip | Slot engine `windowsForDate()` rewrite |
| Override modal mode = "Block this day" OR "Custom hours" (available windows) | Override modal mode = "Block entire day" OR "Add unavailable windows" | UI rename + logic flip | Override modal rewrite |
| No affected-booking preview before save | Inline affected-booking preview + quota pre-flight before commit | New capability | `getAffectedBookings()` + `commitInverseOverrideAction()` |
| No batch cancel from availability editor | Batch cancel on confirm via existing `cancelBooking()` per booking | New capability | New server action composing existing cancel lifecycle |

**Deprecated/replaced behavior:**
- "Custom hours" mode: the UI label and semantic are gone. The DB column shape is preserved (same `start_minute`/`end_minute` columns) but now encodes unavailability instead of availability.
- The existing overrides in production with `is_closed=false` will NOT be auto-inverted. They become stale/orphaned after the migration and should be cleared (if using Option B) or tagged (if using Option A).

---

## Open Questions

1. **Exact production row count and shape of `date_overrides`**
   - What we know: at least some rows exist (Andrew confirmed production data exists)
   - What's unclear: whether they are primarily `is_closed=true` (full-day blocks) or `is_closed=false` (custom hours). This matters for which migration option to choose.
   - Recommendation: planner should run the diagnostic query at plan time or add as a task-0 pre-flight step: `SELECT is_closed, COUNT(*) FROM date_overrides GROUP BY is_closed;`

2. **`skipOwnerEmail` flag in `cancelBooking()`**
   - What we know: `cancelBooking()` always sends both emails when `actor: "owner"`. Adding a `skipOwnerEmail` flag is a one-line change to `CancelBookingArgs` + one branch in `cancelBooking()`.
   - What's unclear: Whether the CONTEXT.md "no email is acceptable" preference should be implemented in Plan 32-03 or left for later.
   - Recommendation: implement `skipOwnerEmail: true` for the batch path in Plan 32-03. Quota savings are significant (N×1 instead of N×2).

3. **Migration column vs. no migration column**
   - What we know: existing `custom_hours` rows have "available windows" semantics; new rows will have "unavailable windows" semantics.
   - What's unclear: production row count (if very small, wipe is simplest).
   - Recommendation: inspect production data count in plan step. If ≤5 rows, delete them (clean break). If >20, use `semantics_v2` column.

4. **EXCLUDE GIST constraint during batch cancel**
   - What we know: the constraint is `WHERE status='confirmed'`. Cancelled bookings are excluded.
   - What's unclear: whether cancelling N bookings rapidly in `Promise.allSettled()` could cause transient constraint violations if two conflicting bookings both try to update concurrently.
   - Recommendation: No risk. The EXCLUDE constraint fires on INSERT/UPDATE to `confirmed` status. Batch cancel only transitions rows AWAY FROM `confirmed` → `cancelled`. No constraint fire on cancel. The `Promise.allSettled()` pattern is safe.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `supabase/migrations/20260419120000_initial_schema.sql` — `date_overrides` table shape: `id`, `account_id`, `override_date`, `is_closed`, `start_minute`, `end_minute`, `note`, `created_at`; unique constraint `(account_id, override_date, start_minute)`; CHECK `is_closed OR (start_minute IS NOT NULL AND end_minute IS NOT NULL AND end_minute > start_minute)`
- `lib/slots.ts` — Current `windowsForDate()` logic (lines 126-159): `is_closed=true` → return null; `is_closed=false` custom hours → replaces weekly rules; no weekly rules → return null
- `lib/slots.types.ts` — `DateOverrideRow`: `{ override_date: string, is_closed: boolean, start_minute: number | null, end_minute: number | null }`
- `lib/bookings/cancel.ts` — `cancelBooking(args: CancelBookingArgs)`: full signature, return type, what it does (DB UPDATE + `sendCancelEmails()` + `after()` audit row)
- `lib/email/send-cancel-emails.ts` — Both email legs, quota check per leg, `.ics CANCEL`, rebook CTA URL pattern: `${appUrl}/${account.slug}/${eventType.slug}`
- `lib/email-sender/quota-guard.ts` — `getRemainingDailyQuota()` signature and semantics; `SIGNUP_DAILY_EMAIL_CAP = 200`
- `app/(shell)/app/availability/_components/override-modal.tsx` — Current modal: mode = `"block" | "custom_hours"`, `TimeWindowPicker` usage, `upsertDateOverrideAction` call pattern, `useTransition`/`useEffect` seed pattern
- `app/(shell)/app/availability/_components/time-window-picker.tsx` — Native `<input type="time">` with `minutesToHHMM`/`hhmmToMinutes` helpers
- `app/(shell)/app/availability/_lib/actions.ts` — `upsertDateOverrideAction`: delete-all-first + insert new shape; `deleteDateOverrideAction`
- `app/(shell)/app/availability/_lib/schema.ts` — `timeWindowSchema`, `findOverlap()`, `dateOverrideSchema` (discriminated union)
- `app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx` — Phase 31 amber banner pattern
- `app/(shell)/app/bookings/[id]/_components/cancel-button.tsx` — Phase 31 quota error UX: `toast.success()` with quota copy, `AlertDialog` pattern
- `app/(shell)/app/bookings/[id]/_lib/actions.ts` — `cancelBookingAsOwner()`: RLS ownership check pattern, `actor: "owner"` delegation to `cancelBooking()`
- `app/api/slots/route.ts` — How overrides are fetched and passed to `computeSlots()`; columns selected: `override_date, is_closed, start_minute, end_minute`
- `supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql` — EXCLUDE GIST constraint scope: `WHERE status='confirmed'`, does NOT fire on cancel operations

---

## Metadata

**Confidence breakdown:**
- Schema (date_overrides columns/constraints): HIGH — read directly from migration files
- Slot engine current behavior: HIGH — read `lib/slots.ts` line by line
- Cancel lifecycle hookability: HIGH — read `lib/bookings/cancel.ts` + `send-cancel-emails.ts`
- Phase 31 quota surfaces to mirror: HIGH — read `quota-guard.ts`, `cancel-button.tsx`, `unsent-confirmations-banner.tsx`
- Booker rebook CTA and LD-07: HIGH — URL pattern `${appUrl}/${account.slug}/${eventType.slug}` confirmed in `send-cancel-emails.ts`
- Migration strategy (Option A vs B): MEDIUM — depends on production row count not inspected at research time
- MINUS computation correctness: HIGH — standard interval algebra, verified edge cases
- EXCLUDE GIST non-interference: HIGH — constraint only fires on INSERT/UPDATE to `confirmed`, cancel path transitions away from `confirmed`
- `skipOwnerEmail` flag: MEDIUM — design recommendation, not yet in code

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable codebase; only invalidated by a parallel phase touching `lib/slots.ts`, `lib/bookings/cancel.ts`, or `lib/email-sender/quota-guard.ts`)
