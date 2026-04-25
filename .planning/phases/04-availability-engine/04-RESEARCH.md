# Phase 4: Availability Engine - Research

**Researched:** 2026-04-25
**Domain:** DST-safe slot generation, @date-fns/tz v4, Supabase schema audit, shadcn/react-day-picker
**Confidence:** HIGH on schema audit, UI primitives, and Phase 3 patterns; HIGH on @date-fns/tz API; MEDIUM on slot algorithm DST behavior (derived from first-principles + library documentation); HIGH on concurrency model

---

## Summary

Phase 4 is the highest-risk phase in the project due to two intersecting dangers: DST-unsafe arithmetic and schema gaps. The schema audit reveals the `accounts` table is missing the four global settings columns Phase 4 needs (`buffer_minutes`, `min_notice_hours`, `max_advance_days`, `daily_cap`). The `date_overrides` table supports single-window overrides well but needs a redesign check for multi-window overrides (the current schema has a `unique(account_id, override_date, start_minute)` constraint that allows multiple rows per date — confirmed correct for multi-window).

The project does NOT yet have `date-fns` or `@date-fns/tz` installed. Both must be added in the first plan step. `@date-fns/tz` v1.4.1 is the current release paired with `date-fns` v4.1.0.

The `formatInTimeZone` function is from the OLD `date-fns-tz` package (v2/v3 era). It does NOT exist in `@date-fns/tz` v4. The v4 pattern is: construct a `TZDate` (which interprets wall-clock values in a named TZ), call standard `date-fns` functions on it, call `.toISOString()` to get UTC. This is the critical API distinction.

For slot generation, the UTC-first algorithm is the correct choice: convert each availability window's `start_minute`/`end_minute` (stored as local wall-clock minutes) into UTC epoch milliseconds using `TZDate`, then iterate with `addMinutes` from `date-fns` on `TZDate` instances. This approach is DST-safe because `TZDate` carries the IANA zone and `addMinutes` on a `TZDate` adds calendar minutes (preserving wall-clock intent) rather than fixed milliseconds.

**Primary recommendation:** UTC-first via `TZDate` + `addMinutes`. Never use `new Date()` arithmetic or fixed millisecond offsets for slot generation.

---

## Section 1: @date-fns/tz v4 API

### Package Installation (NOT yet installed)

```bash
npm install date-fns @date-fns/tz
```

**Current versions (verified 2026-04-25 via `npm view`):**
- `date-fns`: 4.1.0
- `@date-fns/tz`: 1.4.1

**Confidence: HIGH** — verified live.

### What @date-fns/tz v4 Exports (and does NOT export)

| Symbol | Source | Status |
|--------|--------|--------|
| `TZDate` | `@date-fns/tz` | USE — primary class |
| `TZDateMini` | `@date-fns/tz` | Available (lighter, no format) |
| `tz()` | `@date-fns/tz` | USE — context helper for `in` option |
| `tzOffset()` | `@date-fns/tz` | Available — gets UTC offset in minutes |
| `formatInTimeZone` | **does NOT exist** in `@date-fns/tz` | Was in old `date-fns-tz` (v2/v3 only) |
| `zonedTimeToUtc` | **does NOT exist** in `@date-fns/tz` | Was in old `date-fns-tz` (v2/v3 only) |
| `utcToZonedTime` | **does NOT exist** in `@date-fns/tz` | Was in old `date-fns-tz` (v2/v3 only) |

**Critical:** Do NOT install `date-fns-tz`. It is the v2/v3-era package. Use `@date-fns/tz` with `date-fns` v4.

### TZDate Constructor Signatures

```typescript
import { TZDate } from "@date-fns/tz";

// From year/month/day/hour/minute (0-indexed month, like Date constructor)
// Last argument is always the IANA timezone string
new TZDate(year, month, day, hours, minutes, "America/Chicago");
// => interprets 9:00 AM on that date IN Chicago — returns UTC epoch correctly

// From Unix timestamp (milliseconds)
new TZDate(timestampMs, "America/Chicago");

// From ISO string
new TZDate("2026-03-08T09:00:00Z", "America/Chicago");

// Static factory — timezone is FIRST argument
TZDate.tz("America/Chicago");                      // now, in Chicago
TZDate.tz("America/Chicago", year, month, day);    // specific date, Chicago
TZDate.tz("America/Chicago", timestampMs);         // from epoch ms
```

### Key Behavioral Guarantee

`TZDate` instances behave like native `Date` objects but interpret `getHours()`, `getMinutes()`, etc. in the named timezone. When you call `addMinutes(tzDate, 30)` on a `TZDate`, date-fns adds 30 calendar minutes in the named timezone — this is wall-clock-correct and DST-safe.

Calling `.toISOString()` on any `TZDate` returns the UTC ISO string (same as `Date.prototype.toISOString`) — it is the correct way to get the UTC representation for storage.

### The `tz()` Helper

`tz()` returns a context factory for use with date-fns functions that accept an `in` option:

```typescript
import { tz } from "@date-fns/tz";
import { isSameDay, addMinutes } from "date-fns";

// Use the 'in' option to make date-fns functions timezone-aware
isSameDay(dateA, dateB, { in: tz("America/Chicago") });

// addMinutes with context (returns a TZDate)
const nextSlot = addMinutes(currentSlot, 30, { in: tz("America/Chicago") });
```

### Pattern 1: Parse "9:00 in America/Chicago on 2026-03-08" → UTC ISO

The availability rules store `start_minute` and `end_minute` as integer minutes since midnight (e.g., 9:00 = 540, 17:00 = 1020). The date comes from the date range being queried. Convert to UTC:

```typescript
import { TZDate } from "@date-fns/tz";
import { addMinutes } from "date-fns";

function minutesToUTC(
  localDate: string,   // "2026-03-08" (YYYY-MM-DD, local calendar date)
  minutesSinceMidnight: number,  // e.g. 540 for 9:00 AM
  timeZone: string,   // "America/Chicago"
): string {
  // Parse the calendar date as midnight in the account timezone
  // TZDate constructor: year, month (0-indexed), day
  const [year, month, day] = localDate.split("-").map(Number);
  const midnight = new TZDate(year, month - 1, day, 0, 0, 0, timeZone);
  // Add the window's start minutes — addMinutes is wall-clock-correct on TZDate
  const slotStart = addMinutes(midnight, minutesSinceMidnight);
  return slotStart.toISOString();  // returns UTC ISO string
}

// Example:
// "2026-03-08", 540, "America/Chicago"
// => "2026-03-08T15:00:00.000Z"  (9:00 CST = UTC-6 → 15:00 UTC)
// Note: on 2026-03-08 America/Chicago transitions at 2:00 AM,
// so 9:00 AM is CDT (UTC-5) → "2026-03-08T14:00:00.000Z"
```

### Pattern 2: Iterate 30-Min Steps Inside a Local Window

```typescript
import { TZDate } from "@date-fns/tz";
import { addMinutes } from "date-fns";

function* generateSlots(
  localDate: string,           // "2026-03-08"
  startMinute: number,         // e.g. 540 (9:00 AM)
  endMinute: number,           // e.g. 1020 (17:00 PM)
  durationMinutes: number,     // event duration (step size = duration)
  timeZone: string,
): Generator<{ start: string; end: string }> {
  const [year, month, day] = localDate.split("-").map(Number);
  const midnight = new TZDate(year, month - 1, day, 0, 0, 0, timeZone);
  const windowStart = addMinutes(midnight, startMinute);
  const windowEnd = addMinutes(midnight, endMinute);

  let cursor = windowStart;
  while (true) {
    const slotEnd = addMinutes(cursor, durationMinutes);
    // Slot must fit entirely within the window
    if (slotEnd > windowEnd) break;
    yield {
      start: cursor.toISOString(),
      end: slotEnd.toISOString(),
    };
    cursor = slotEnd;  // next slot starts where this one ends (step = duration)
  }
}
```

**DST note:** On 2026-03-08, `addMinutes(midnight, 120)` = 2:00 AM which skips to 3:00 AM CDT. If a rule says 1:00–3:00 AM, the 2:00 AM slot does not exist and `addMinutes` will correctly jump past the gap — the window simply has fewer slots that day. On 2026-11-01, `addMinutes(midnight, 60)` produces 1:00 AM, and adding another 60 produces 1:00 AM again (the repeated hour). The algorithm will generate two slots for the 1:00 AM hour — both are real bookable moments (different UTC values). This is the CORRECT behavior.

### Pattern 3: Format UTC Instant in Account TZ (for display/logging)

```typescript
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

function formatInAccountTZ(
  utcIso: string,      // "2026-03-08T15:00:00.000Z"
  timeZone: string,    // "America/Chicago"
  formatStr: string,   // "HH:mm" or "yyyy-MM-dd HH:mm"
): string {
  // Construct TZDate from UTC iso → interprets as that instant in Chicago
  const tzDate = new TZDate(utcIso, timeZone);
  return format(tzDate, formatStr);
}

// "2026-03-08T15:00:00.000Z" → "10:00" (CDT, 15:00 UTC = 10:00 CDT = UTC-5)
```

**Confidence: HIGH** — API verified from official GitHub README, maintainer discussion, and date-fns.org v4 docs.

---

## Section 2: Recommended Slot Generation Algorithm

### Recommendation: UTC-First (LOCAL window → UTC epoch loop)

**Why UTC-first over local-first:**
- Local-first (iterating wall-clock strings) requires additional string parsing on each step and can produce ambiguous results during fall-back (when 1:00-2:00 AM exists twice, string parsing returns only one).
- UTC-first using `TZDate` + `addMinutes` lets the library handle the DST math. Each iteration returns a concrete, unambiguous UTC instant. The fall-back duplicate hour naturally yields two distinct UTC values. The spring-forward missing hour simply results in `addMinutes` jumping over the gap.
- `TZDate.toISOString()` always returns UTC, which matches the `timestamptz` columns in Postgres directly.

### Algorithm Pseudo-Code

```
function computeSlots(input):
  account = getAccount(input.account_id)
  eventType = getEventType(input.event_type_id)
  TZ = account.timezone              // "America/Chicago"
  duration = eventType.duration_minutes
  buffer = account.buffer_minutes    // default 0
  minNotice = account.min_notice_hours * 60  // convert to minutes
  maxAdvance = account.max_advance_days
  dailyCap = account.daily_cap       // nullable integer

  now = new Date()                   // UTC now
  earliest = addMinutes(now, minNotice)     // UTC lower bound
  latestDate = addDays(now, maxAdvance)     // UTC upper bound (date)

  // Query: bookings in range (confirmed only, not cancelled)
  existingBookings = supabase.from("bookings")
    .select("start_at, end_at")
    .eq("account_id", account.id)
    .gte("start_at", input.range_start)
    .lte("start_at", input.range_end)
    .neq("status", "cancelled")

  results = []

  for each localDate in [input.range_start .. input.range_end]:
    // AVAIL-02: Check date_overrides first
    override = getOverrideForDate(account.id, localDate)

    if override and override.is_closed:
      continue  // blocked day — no slots

    if override and override windows exist:
      windows = override windows  // use override windows
    else:
      dow = getDayOfWeek(localDate, TZ)  // 0=Sun in account TZ
      windows = availability_rules for (account.id, day_of_week=dow)
      if windows is empty:
        continue  // closed weekday

    // Check daily cap
    if dailyCap is not null:
      dayBookingCount = count of existingBookings on localDate (in TZ)
      if dayBookingCount >= dailyCap:
        continue  // cap reached — skip whole day

    for each window in windows:
      windowSlots = generateSlots(localDate, window.start_minute,
                                   window.end_minute, duration, TZ)
      for each slot in windowSlots:
        // Apply min-notice filter
        if slot.start < earliest:
          continue

        // Apply max-advance filter
        if slot.start > latestDate:
          continue

        // Apply buffer: slot must not overlap any existing booking
        // A slot conflicts if its buffered range overlaps any booking's buffered range
        bufferedStart = slot.start - buffer minutes
        bufferedEnd = slot.end + buffer minutes
        if any existingBooking overlaps [bufferedStart, bufferedEnd]:
          continue

        results.push({ start_at: slot.start, end_at: slot.end })

  return results (flat array, sorted ascending by start_at)
```

### DST Transition Behavior — March 8, 2026 (Spring Forward)

- America/Chicago: 2:00 AM → 3:00 AM (CST → CDT, UTC offset -6 → -5)
- The `addMinutes(midnight, minutesSinceMidnight)` call for minute 120 (2:00 AM) will correctly land at 3:00 AM CDT.
- A rule like "9:00–17:00" generates slots correctly. A rule like "1:00–3:00 AM" produces fewer slots (no 2:00 AM slot).
- The iteration loop naturally handles this: `addMinutes(cursor, duration)` jumps from 1:30 AM directly to 3:00 AM. No 2:00 AM slot is generated, which is the correct behavior.

### DST Transition Behavior — November 1, 2026 (Fall Back)

- America/Chicago: 2:00 AM → 1:00 AM (CDT → CST, UTC offset -5 → -6)
- The 1:00–2:00 AM wall-clock hour exists TWICE.
- `addMinutes(midnight, 60)` = first 1:00 AM (CDT) → UTC 06:00
- The next `addMinutes(cursor, duration)` advances to the second 1:00 AM (CST) → UTC 07:00
- Both are valid slots with distinct UTC values. The algorithm correctly generates both.
- **Important:** For daily cap counting, both occurrences count as the same calendar date in the account TZ. The cap logic must count all bookings where `start_at::date AT TIME ZONE 'America/Chicago' = localDate`.

### Implementation Notes

- `addMinutes` from `date-fns` on a `TZDate` instance is wall-clock-safe (does not add fixed milliseconds).
- Never use `Date.now() + minutes * 60_000` for slot boundaries — this is millisecond arithmetic that ignores DST.
- Never use `new Date(year, month, day, hour, minute)` — this uses the server's system timezone, not the account timezone.
- Generating slots for a multi-day range (e.g., 14 days) produces at most ~14 × 8 × 2 = 224 slots for a 30-min event with 8-hour days. This is computationally trivial — no streaming or pagination needed.

### Concurrency and Caching

The `/api/slots` endpoint is read-only — it reads rules, overrides, and existing bookings, then computes the slot list. Phase 5 handles writes. The concurrency risk is:

1. User A and User B both call `/api/slots` and see slot X as available.
2. User A books slot X (Phase 5 INSERT, gets the DB-level partial unique index guard).
3. User B tries to book slot X — Phase 5 INSERT fails with `23505`, returns HTTP 409.

**Recommendation for `/api/slots`:**
- Set `Cache-Control: no-store` on the response (do not cache). The slot list changes as bookings are made; a stale cache of 5-10 seconds is the primary source of "I see the slot as available but then get a 409" UX problems.
- Do NOT use `revalidatePath` or ISR for this endpoint — it must be fresh every request.
- `revalidateTag` is not useful here because Phase 5's booking happens in a different user session.
- The read-side staleness window is inherently O(network latency) — there is no practical way to eliminate the TOCTOU window at the application layer. The DB partial unique index is the true last-resort guard (Phase 1 already created it: `bookings_no_double_book`).

**Confidence: HIGH** — The DB guard (`bookings_no_double_book` partial unique index on `event_type_id, start_at where status='confirmed'`) already exists and will enforce correctness regardless of any application-layer race.

---

## Section 3: Phase 1 Schema Audit

### `accounts` Table — Current Columns

```sql
id uuid, slug text, name text, owner_user_id uuid,
timezone text, logo_url text, brand_primary text, brand_accent text,
created_at timestamptz
```

**Missing for Phase 4 (all four global settings):**

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `buffer_minutes` | `int not null default 0` | 0 | Pre/post buffer (AVAIL-03) |
| `min_notice_hours` | `int not null default 24` | 24 | Hours before slot is bookable (AVAIL-04) |
| `max_advance_days` | `int not null default 14` | 14 | Days into future slots are shown (AVAIL-05) |
| `daily_cap` | `int` | null | Max bookings/day, nullable = no cap (AVAIL-06) |

**Note on event_types columns:** `event_types` already has `buffer_before_minutes`, `buffer_after_minutes`, `min_notice_minutes`, `max_advance_days`. Per AVAIL-07, account-wide settings in Phase 4 take precedence. In Phase 4, the slot engine reads from `accounts`. The `event_types` columns can remain but will be ignored by the slot algorithm until v2's per-event-type overrides.

### `availability_rules` Table — Current Columns

```sql
id uuid, account_id uuid, day_of_week smallint (0-6, 0=Sun),
start_minute smallint (0-1439), end_minute smallint (1-1440),
created_at timestamptz
CHECK (end_minute > start_minute)
```

**Assessment: Correct as-is for Phase 4.**
- No `is_open` toggle column needed. The CONTEXT.md decision says the Open/Closed toggle can be represented by presence/absence of rows. A weekday with no rows = closed. The UI toggle on "Closed" deletes all rows for that `day_of_week`; toggle back to "Open" inserts a default window (e.g., 9:00–17:00).
- Multiple windows per day: supported via multiple rows with same `account_id, day_of_week`. The existing index `availability_rules_account_id_dow_idx` covers the query pattern.
- No additional columns needed.

### `date_overrides` Table — Current Columns

```sql
id uuid, account_id uuid, override_date date,
is_closed boolean not null default false,
start_minute smallint (nullable), end_minute smallint (nullable),
note text, created_at timestamptz
UNIQUE (account_id, override_date, start_minute)
CHECK (is_closed OR (start_minute IS NOT NULL AND end_minute IS NOT NULL AND end_minute > start_minute))
```

**Assessment: Mostly correct, but has a design tension.**

The `unique(account_id, override_date, start_minute)` constraint allows multiple rows per date (multi-window overrides) as long as `start_minute` differs. This matches the "multiple windows per day" decision for weekly rules and is intentional.

**Issue with `is_closed`:** When `is_closed = true`, `start_minute` and `end_minute` are NULL. If there is also an is_closed row AND windows rows for the same date, the constraint allows both. The slot algorithm must check: if ANY row for a date has `is_closed = true`, the date is fully blocked (no slots). The UI should prevent mixed states.

**Recommended approach in UI:** When saving a "Block this day" override, delete any existing window rows for that date before inserting the `is_closed = true` row. When saving "Custom hours," delete any `is_closed = true` row before inserting windows.

**No migration changes needed** for `date_overrides`.

### `bookings` Table — Current Columns

```sql
id uuid, account_id uuid, event_type_id uuid,
start_at timestamptz, end_at timestamptz,
booker_name text, booker_email citext, booker_phone text, booker_timezone text,
answers jsonb, status booking_status,
cancel_token_hash text, reschedule_token_hash text,
reminder_sent_at timestamptz, cancelled_at timestamptz, cancelled_by text,
created_at timestamptz
```

**Assessment: Correct as-is for Phase 4.**
- Slot algorithm filters: `.neq("status", "cancelled")` — correct (mirrors Phase 3 pattern).
- The `bookings_no_double_book` partial unique index already exists: `ON bookings(event_type_id, start_at) WHERE status = 'confirmed'`.
- Daily cap query needs: `SELECT count(*) FROM bookings WHERE account_id = $1 AND status != 'cancelled' AND start_at::date AT TIME ZONE $tz = $localDate`.

### Required Migration for Phase 4

```sql
-- Phase 4: Add global availability settings to accounts table
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS buffer_minutes int NOT NULL DEFAULT 0
    CHECK (buffer_minutes >= 0),
  ADD COLUMN IF NOT EXISTS min_notice_hours int NOT NULL DEFAULT 24
    CHECK (min_notice_hours >= 0),
  ADD COLUMN IF NOT EXISTS max_advance_days int NOT NULL DEFAULT 14
    CHECK (max_advance_days > 0),
  ADD COLUMN IF NOT EXISTS daily_cap int
    CHECK (daily_cap IS NULL OR daily_cap > 0);
```

One migration file, no index changes needed (reads are by `account_id` primary key lookup).

**Confidence: HIGH** — derived directly from reading migration files.

---

## Section 4: Existing UI Primitives

### Components Already Installed in `components/ui/`

| Component | File | Relevant Use in Phase 4 |
|-----------|------|------------------------|
| `button` | `button.tsx` | Save buttons, override modal actions |
| `input` | `input.tsx` | `<input type="number">` for settings, `<input type="time">` for time pickers |
| `label` | `label.tsx` | Form field labels |
| `alert` | `alert.tsx` | Empty-state banner ("You haven't set availability yet") |
| `card` | `card.tsx` | Override list cards |
| `dialog` | `dialog.tsx` | Override edit modal |
| `dropdown-menu` | `dropdown-menu.tsx` | "Copy from →" menu per weekday row |
| `switch` | `switch.tsx` | Open/Closed toggle per weekday row |
| `badge` | `badge.tsx` | Override type badge (Blocked / Custom hours) |
| `select` | `select.tsx` | Time pickers if using dropdowns |
| `skeleton` | `skeleton.tsx` | Loading state for availability page |
| `sonner` | `sonner.tsx` | Toast on save success/error |
| `separator` | `separator.tsx` | Section dividers |

**Toaster is already in `app/layout.tsx`:** The `<Toaster />` from `components/ui/sonner.tsx` is already mounted in the root layout. No change needed — `toast.success(...)` / `toast.error(...)` from `sonner` will work immediately.

### Calendar Component: NOT Installed

The `components/ui/` directory does NOT contain `calendar.tsx`. The shadcn Calendar component (built on `react-day-picker`) must be installed:

```bash
npx shadcn@latest add calendar
```

This installs:
- `components/ui/calendar.tsx` — the shadcn Calendar wrapper
- `react-day-picker` npm package (v9.x) as a dependency
- No additional `date-fns` install needed if it's already installed

**react-day-picker v9 API for date markers (override dots):**

```typescript
import { DayPicker } from "react-day-picker";

// Mark override dates with custom CSS classes
const blockedDates = [new Date(2026, 2, 15)];  // March 15, 2026
const customHoursDates = [new Date(2026, 2, 20)];

<DayPicker
  mode="single"
  modifiers={{
    blocked: blockedDates,
    customHours: customHoursDates,
  }}
  modifiersClassNames={{
    blocked: "day-blocked",      // red dot via CSS
    customHours: "day-custom",   // blue dot via CSS
  }}
  onDayClick={(day) => handleDayClick(day)}
/>
```

Add CSS to `globals.css`:
```css
.day-blocked { position: relative; }
.day-blocked::after { content: ""; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; border-radius: 50%; background: hsl(var(--destructive)); }
.day-custom::after { background: hsl(var(--primary)); }
```

**shadcn Calendar component:** Pass `modifiers` and `modifiersClassNames` through to the underlying DayPicker. The shadcn wrapper forwards all DayPicker props.

### Components to Install for Phase 4

```bash
npx shadcn@latest add calendar
```

That is the only new shadcn component. Everything else is already installed.

**Form Patterns from Phase 3 (carry forward verbatim):**

1. **Server Action shape:** `{ fieldErrors?, formError? }` return type. Same pattern for availability save actions.
2. **RHF + `useActionState` bridge:** Client components call server actions directly (not via `<form action>`), enabling typed structured data (arrays of windows) without FormData serialization issues.
3. **`Controller` for Switch fields:** The Open/Closed toggle (`switch.tsx`) requires `Controller`, not `register()`.
4. **`Controller` for Select fields:** Time picker selects require `Controller`.
5. **`revalidatePath("/app/availability")`** after every mutation.
6. **`.neq("status", "cancelled")`** for ignoring cancelled bookings (daily cap count, buffer conflict check).
7. **`.is("deleted_at", null)`** pattern is N/A for Phase 4 tables (no soft-delete on availability tables).

### Existing Tests Structure

```
tests/
├── setup.ts           — dotenv loader
├── helpers/
│   └── supabase.ts    — adminClient(), anonClient(), getOrCreateTestAccount()
├── race-guard.test.ts        — booking uniqueness
├── rls-anon-lockout.test.ts  — RLS lockout
└── rls-authenticated-owner.test.ts
```

**Vitest config:** `environment: "jsdom"` default; override per-file with `// @vitest-environment node` for DB tests. `testTimeout: 15_000`. `include: ["tests/**/*.test.ts"]`.

Phase 4 DST unit tests should go in `tests/slot-generation.test.ts` with `// @vitest-environment node`.

---

## Section 5: Test Strategy for AVAIL-09

Unit tests for the slot generation algorithm. These tests are pure logic — no DB calls — so they run in `node` environment.

### Test File Structure

```typescript
// tests/slot-generation.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeSlots } from "@/lib/slots";  // pure function, no Supabase

// The computeSlots function under test accepts:
// { localDate, startMinute, endMinute, durationMinutes, timeZone }
// Returns: Array<{ start: string; end: string }>  (UTC ISO strings)
```

### Test Case 1: Spring Forward — March 8, 2026

```
America/Chicago transitions 2:00 AM → 3:00 AM (CST → CDT)
UTC offset changes: -6 → -5
```

**Scenario A: Window entirely before the gap (should produce normal slots)**
```
Input: localDate="2026-03-08", startMinute=540, endMinute=660, duration=30, tz="America/Chicago"
// 9:00–11:00 AM CST → CDT (well after transition at 2 AM)
Expected: 4 slots (9:00, 9:30, 10:00, 10:30 CDT)
Expected start_at values:
  "2026-03-08T14:00:00.000Z"   // 9:00 CDT = UTC-5 → 14:00 UTC
  "2026-03-08T14:30:00.000Z"
  "2026-03-08T15:00:00.000Z"
  "2026-03-08T15:30:00.000Z"
```

**Scenario B: Window spanning the missing hour (fewer slots than normal)**
```
Input: localDate="2026-03-08", startMinute=60, endMinute=240, duration=30, tz="America/Chicago"
// 1:00 AM – 4:00 AM (spans the 2:00 AM → 3:00 AM gap)
// Normal non-DST day: 6 slots (1:00, 1:30, 2:00, 2:30, 3:00, 3:30)
// DST day: 2:00 and 2:30 don't exist → 4 slots (1:00, 1:30, 3:00, 3:30)
Expected slot count: 4
Expected start_at[2]: "2026-03-08T09:00:00.000Z"  // 3:00 CDT
```

**Scenario C: Window only in the missing hour (zero slots)**
```
Input: localDate="2026-03-08", startMinute=120, endMinute=180, duration=30, tz="America/Chicago"
// 2:00–3:00 AM — this hour does not exist on spring-forward day
Expected slot count: 0
```

### Test Case 2: Fall Back — November 1, 2026

```
America/Chicago transitions 2:00 AM → 1:00 AM (CDT → CST)
UTC offset changes: -5 → -6
The 1:00–2:00 AM hour exists TWICE
```

**Scenario A: Window spanning the repeated hour (more slots than normal)**
```
Input: localDate="2026-11-01", startMinute=60, endMinute=240, duration=60, tz="America/Chicago"
// 1:00 AM – 4:00 AM (spans the repeated 1:00–2:00 AM)
// Normal day: 3 slots (1:00, 2:00, 3:00)
// Fall-back day: 4 slots (1:00 CDT, 1:00 CST, 2:00 CST, 3:00 CST)
Expected slot count: 4
// Verify the two 1:00 AM slots have different UTC values:
Expected start_at[0]: "2026-11-01T06:00:00.000Z"  // 1:00 CDT (UTC-5)
Expected start_at[1]: "2026-11-01T07:00:00.000Z"  // 1:00 CST (UTC-6)
```

**Scenario B: Normal window well outside transition (unchanged)**
```
Input: localDate="2026-11-01", startMinute=540, endMinute=1020, duration=30, tz="America/Chicago"
// 9:00 AM–5:00 PM CST (after transition, normal business hours)
Expected slot count: 16
```

### Test Case 3: Normal Day Baseline

```
Input: localDate="2026-06-15", startMinute=540, endMinute=1020, duration=30, tz="America/Chicago"
// 9:00–17:00 CDT (mid-summer, no DST transition)
Expected slot count: 16
Expected start_at[0]: "2026-06-15T14:00:00.000Z"  // 9:00 CDT = UTC-5 → 14:00 UTC
```

### Test Case 4: Buffer Removes Overlapping Slots

```
// Single existing booking at 10:00–10:30 CDT on 2026-06-15
// Buffer = 15 min → blocked window: 9:45–10:45 CDT
// Window: 9:00–17:00, duration=30
// Slots 9:30 and 10:00 are removed; 11:00 is the next valid slot
// Expected: 14 slots instead of 16
```

### Test Case 5: Daily Cap

```
// Daily cap = 2, two existing bookings on 2026-06-15
// Expected: empty array ([] )
```

### Implementation Note

The `computeSlots` function must be a pure function in `lib/slots.ts` that accepts pre-fetched data (rules, overrides, bookings, account settings) rather than calling Supabase directly. This makes it unit-testable without mocking. The Route Handler at `app/api/slots/route.ts` fetches data from Supabase and passes it to `computeSlots`.

---

## Section 6: Open Recommendations (Claude's Discretion Items)

### Time-window picker UX

**Recommendation: `<input type="time">`** (native HTML time input).
- Renders a browser-native time picker on mobile (clock wheel on iOS/Android).
- Outputs "HH:mm" string, easy to parse to minutes with `parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1])`.
- Avoid HH:MM dropdowns (requires 48 Select options for 30-min increments, verbose DOM).
- Avoid free-text (requires parsing and validation).
- On desktop Chrome/Edge, renders a spinner; on Firefox, renders a text field with format hint.

### Form-validation timing for overlapping windows

**Recommendation: Validate on save, not on blur.** Show an error like "Time windows overlap (9:00–12:00 and 11:00–14:00)" in the form-level error banner when the user clicks Save. Do NOT auto-merge silently — overlapping windows are likely a user mistake, not an intent to merge. Reject with a clear error that lists the conflict.

Detection: for each day's windows, sort by `start_minute`, then check `windows[i].end_minute > windows[i+1].start_minute`.

### Daily cap counting cancelled bookings

**Recommendation: Exclude cancelled bookings from cap count.** Filter: `.neq("status", "cancelled")`. This mirrors Phase 3's `DeleteConfirmDialog` pattern: `.neq("status", "cancelled")` for booking-count pre-checks. A cancelled slot is a free slot — the cap should reflect confirmed bookings only.

### `/api/slots` response envelope

**Recommendation: Flat array of `{start_at, end_at}` UTC ISO strings.**
```typescript
// Response shape
type SlotsResponse = {
  slots: Array<{ start_at: string; end_at: string }>;
};
```
Simple, cacheable as JSON, trivially sorted, easy for Phase 5 to group by local date client-side. No envelope needed beyond the `slots` key for future extensibility.

**Do NOT** include `cap_reached` flag — deferred. **Do NOT** include local-date grouping — Phase 5 groups by converting `start_at` to account timezone on the client.

### Daily cap behavior in API

**Recommendation: When cap is reached for a day, return no slots for that day.** The day simply has zero slots in the response, identical to a fully-blocked or closed day. Phase 5 renders "No times available right now" for any date with zero slots.

### Loading skeleton for Availability page

**Recommendation: Use the existing `skeleton.tsx` component.** The page is a Server Component shell that renders a loading skeleton while the three queries (account settings, availability rules, date overrides) run. Use Next.js `loading.tsx` in the `app/(shell)/app/availability/` directory with `Skeleton` blocks matching the layout:
- Row of 7 weekday skeletons (weekly editor)
- Calendar skeleton block (overrides section)
- Three input skeletons (settings panel)

### Slot computation algorithm

**Recommendation: Generate-then-filter.** Interval-merge is more complex to implement and only pays off with thousands of exclusions. For this use case (max ~20 bookings per day, max 5 override windows), generate-then-filter is readable, testable, and fast enough.

### Calendar picker library

**Recommendation: Install `shadcn calendar` (`react-day-picker` v9).** This is the canonical shadcn approach, already prepared for in the existing component system. No third-party calendar library needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DST-safe time arithmetic | `Date.now() + minutes * 60_000` | `addMinutes(tzDate, n)` on a `TZDate` | Fixed ms arithmetic ignores DST transition clock changes |
| Local-to-UTC conversion | `new Date(year, month, day, hour, min)` | `new TZDate(year, month, day, hour, min, "America/Chicago")` | `new Date()` uses server TZ, not account TZ |
| "Format UTC as local time" | Manual offset math | `format(new TZDate(utcIso, tz), "HH:mm")` | Offset changes at DST transitions |
| Calendar with date markers | Custom grid | `react-day-picker` + `modifiers` | Browser-tested, accessible, already in shadcn ecosystem |
| Double-booking prevention | App-level lock | DB partial unique index `bookings_no_double_book` | Already exists from Phase 1; race-proof at DB level |
| Time overlap detection | Complex algorithm | Sort by `start_minute` + check `end_minute > next.start_minute` | 3 lines, no library needed |

---

## Common Pitfalls

### Pitfall 1: Using `formatInTimeZone` from `@date-fns/tz`

**What goes wrong:** TypeScript import error or "not exported" runtime error.
**Why it happens:** `formatInTimeZone` exists in the OLD `date-fns-tz` package (v2/v3). It does NOT exist in `@date-fns/tz` v4.
**How to avoid:** Use `format(new TZDate(utcString, tz), "HH:mm")` instead.
**Warning signs:** `Module '"@date-fns/tz"' has no exported member 'formatInTimeZone'`.

### Pitfall 2: Using `new Date(year, month, day)` for local time

**What goes wrong:** Slots computed in the server's system timezone (UTC on Vercel), not America/Chicago. A 9:00 AM Chicago slot becomes a 9:00 AM UTC slot.
**Why it happens:** `new Date()` always uses system TZ.
**How to avoid:** Always use `new TZDate(year, month, day, 0, 0, 0, accountTimezone)` to construct dates in the account's timezone.
**Warning signs:** Slots displayed at the correct local time during standard time but off by 1 hour during DST, or vice versa.

### Pitfall 3: Missing `date-fns` install

**What goes wrong:** Build error — `@date-fns/tz` is installed but `addMinutes` from `date-fns` is not found.
**Why it happens:** `date-fns` is a peer dependency of `@date-fns/tz` but is not currently in the project's `package.json`.
**How to avoid:** Install both: `npm install date-fns @date-fns/tz`. The first plan step must verify both are in `package.json`.
**Warning signs:** `Cannot find module 'date-fns'` at compile time.

### Pitfall 4: Caching `/api/slots` responses

**What goes wrong:** A booker sees a slot as available, a concurrent booker takes it, the first booker sees a cached response, clicks the slot, gets a 409 from Phase 5.
**Why it happens:** Next.js Route Handlers default to caching GET responses.
**How to avoid:** Export `export const dynamic = "force-dynamic"` from the route handler, or set `Cache-Control: no-store`. Do NOT use `revalidatePath` for this endpoint.
**Warning signs:** 409 collision rate higher than expected, slot list doesn't update after booking.

### Pitfall 5: `date_overrides` mixed is_closed + windows rows

**What goes wrong:** A date override has both `is_closed = true` and window rows, causing the algorithm to treat it as both blocked and with custom hours.
**Why it happens:** The `date_overrides` schema allows this if the UI doesn't enforce mutual exclusivity.
**How to avoid:** Server Action for saving overrides must: (a) when saving "block," delete all window rows for the date first; (b) when saving "custom hours," delete the `is_closed` row first. Algorithm: check for `is_closed = true` row first; if found, skip day regardless of other rows.
**Warning signs:** A day shows as both blocked (no slots) in some code paths but with custom hours in others.

### Pitfall 6: Day-of-week derived in UTC instead of account TZ

**What goes wrong:** On a date that's Monday in Chicago, the server (UTC) might see it as Sunday or Tuesday depending on the time.
**Why it happens:** `new Date().getDay()` returns UTC day-of-week on Vercel.
**How to avoid:** Use `getDay(new TZDate(utcDate, accountTimezone))` from date-fns to get the day-of-week in the account timezone.
**Warning signs:** Availability rules for Monday appear on Sunday or Tuesday for Chicago-timezone accounts.

### Pitfall 7: Daily cap counts cancelled bookings

**What goes wrong:** A cancellation doesn't free up a slot because the cap count includes it.
**Why it happens:** Forgetting to filter `.neq("status", "cancelled")` in the cap count query.
**How to avoid:** Always filter `status != 'cancelled'` in any booking-count query. Mirror Phase 3's pattern.
**Warning signs:** Cap appears to be reached but the day has confirmed bookings below the cap number.

---

## Code Examples

### Installing the Packages

```bash
npm install date-fns @date-fns/tz
npx shadcn@latest add calendar
```

### Route Handler for /api/slots

```typescript
// app/api/slots/route.ts
export const dynamic = "force-dynamic";  // NEVER cache this endpoint

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSlots } from "@/lib/slots";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const eventTypeId = searchParams.get("event_type_id");
  const rangeStart = searchParams.get("range_start");  // "2026-03-08" (local date)
  const rangeEnd = searchParams.get("range_end");       // "2026-03-21" (local date)

  if (!eventTypeId || !rangeStart || !rangeEnd) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch event type (for duration)
  const { data: eventType } = await supabase
    .from("event_types")
    .select("id, duration_minutes, account_id")
    .eq("id", eventTypeId)
    .is("deleted_at", null)
    .single();

  if (!eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  // Fetch account settings (including TZ and global settings)
  const { data: account } = await supabase
    .from("accounts")
    .select("timezone, buffer_minutes, min_notice_hours, max_advance_days, daily_cap")
    .eq("id", eventType.account_id)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Fetch availability rules for this account
  const { data: rules } = await supabase
    .from("availability_rules")
    .select("day_of_week, start_minute, end_minute")
    .eq("account_id", eventType.account_id);

  // Fetch date overrides in range
  const { data: overrides } = await supabase
    .from("date_overrides")
    .select("override_date, is_closed, start_minute, end_minute")
    .eq("account_id", eventType.account_id)
    .gte("override_date", rangeStart)
    .lte("override_date", rangeEnd);

  // Fetch existing confirmed bookings in range
  const { data: bookings } = await supabase
    .from("bookings")
    .select("start_at, end_at")
    .eq("account_id", eventType.account_id)
    .neq("status", "cancelled")
    .gte("start_at", `${rangeStart}T00:00:00Z`)
    .lte("start_at", `${rangeEnd}T23:59:59Z`);

  const slots = computeSlots({
    rangeStart,
    rangeEnd,
    eventType,
    account,
    rules: rules ?? [],
    overrides: overrides ?? [],
    bookings: bookings ?? [],
    now: new Date(),
  });

  return NextResponse.json(
    { slots },
    { headers: { "Cache-Control": "no-store" } }
  );
}
```

### Pure computeSlots Function Skeleton

```typescript
// lib/slots.ts
import { TZDate } from "@date-fns/tz";
import { addMinutes, addDays, getDay, isBefore, isAfter } from "date-fns";

export interface SlotInput {
  rangeStart: string;  // "YYYY-MM-DD"
  rangeEnd: string;
  eventType: { duration_minutes: number };
  account: {
    timezone: string;
    buffer_minutes: number;
    min_notice_hours: number;
    max_advance_days: number;
    daily_cap: number | null;
  };
  rules: Array<{ day_of_week: number; start_minute: number; end_minute: number }>;
  overrides: Array<{ override_date: string; is_closed: boolean; start_minute: number | null; end_minute: number | null }>;
  bookings: Array<{ start_at: string; end_at: string }>;
  now: Date;
}

export interface Slot { start_at: string; end_at: string; }

export function computeSlots(input: SlotInput): Slot[] {
  const { account, eventType, rules, overrides, bookings, now } = input;
  const TZ = account.timezone;
  const duration = eventType.duration_minutes;
  const buffer = account.buffer_minutes;
  const earliest = addMinutes(now, account.min_notice_hours * 60);
  const latest = addDays(now, account.max_advance_days);

  const overrideMap = new Map<string, typeof overrides[0][]>();
  for (const o of overrides) {
    if (!overrideMap.has(o.override_date)) overrideMap.set(o.override_date, []);
    overrideMap.get(o.override_date)!.push(o);
  }

  const results: Slot[] = [];

  // Iterate local calendar dates
  const startDate = new TZDate(`${input.rangeStart}T00:00:00`, TZ);
  const endDate = new TZDate(`${input.rangeEnd}T00:00:00`, TZ);

  let cursor = startDate;
  while (!isAfter(cursor, endDate)) {
    const localDate = cursor.toISOString().split("T")[0];  // NOT safe — use format() below
    // Correct local date extraction:
    const [year, month, day] = [cursor.getFullYear(), cursor.getMonth(), cursor.getDate()];
    const localDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const overrideRows = overrideMap.get(localDateStr) ?? [];
    const isBlocked = overrideRows.some(o => o.is_closed);

    if (!isBlocked) {
      const hasWindowOverride = overrideRows.some(o => !o.is_closed && o.start_minute !== null);
      let windows: Array<{ start_minute: number; end_minute: number }>;

      if (hasWindowOverride) {
        windows = overrideRows
          .filter(o => !o.is_closed && o.start_minute !== null)
          .map(o => ({ start_minute: o.start_minute!, end_minute: o.end_minute! }));
      } else {
        const dow = getDay(cursor);  // 0=Sun, in account TZ because cursor is TZDate
        windows = rules.filter(r => r.day_of_week === dow);
      }

      // Daily cap check
      if (account.daily_cap !== null) {
        const dayBookingCount = bookings.filter(b => {
          const bDate = new TZDate(b.start_at, TZ);
          return bDate.getFullYear() === year && bDate.getMonth() === month && bDate.getDate() === day;
        }).length;
        if (dayBookingCount >= account.daily_cap) {
          cursor = addDays(cursor, 1);
          continue;
        }
      }

      for (const window of windows) {
        const midnight = new TZDate(year, month, day, 0, 0, 0, TZ);
        const windowStart = addMinutes(midnight, window.start_minute);
        const windowEnd = addMinutes(midnight, window.end_minute);
        let slotCursor = windowStart;

        while (true) {
          const slotEnd = addMinutes(slotCursor, duration);
          if (isAfter(slotEnd, windowEnd)) break;
          if (isBefore(slotCursor, earliest)) { slotCursor = slotEnd; continue; }
          if (isAfter(slotCursor, latest)) break;

          const bufferedStart = addMinutes(slotCursor, -buffer);
          const bufferedEnd = addMinutes(slotEnd, buffer);
          const conflicts = bookings.some(b =>
            isBefore(new Date(b.start_at), bufferedEnd) &&
            isAfter(new Date(b.end_at), bufferedStart)
          );

          if (!conflicts) {
            results.push({
              start_at: slotCursor.toISOString(),
              end_at: slotEnd.toISOString(),
            });
          }
          slotCursor = slotEnd;
        }
      }
    }

    cursor = addDays(cursor, 1);
  }

  return results;
}
```

---

## Standard Stack

### Core (to install)

| Library | Version | Purpose |
|---------|---------|---------|
| `date-fns` | 4.1.0 | `addMinutes`, `addDays`, `getDay`, `isBefore`, `isAfter`, `format` |
| `@date-fns/tz` | 1.4.1 | `TZDate` class, `tz()` helper |
| `react-day-picker` | (installed via shadcn calendar) | Override calendar picker |

### Already Installed (reuse)

| Library | Already In | Reuse For |
|---------|-----------|-----------|
| `react-hook-form` | package.json | Availability form state |
| `@hookform/resolvers` | package.json | Zod adapter |
| `zod` | package.json | Settings schema validation |
| `@supabase/ssr` | package.json | Server/client DB access |
| `sonner` | package.json | Save toasts |
| `lucide-react` | package.json | Icons (Plus, Copy, Trash2, X) |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|-------------|------------------|--------|
| `date-fns-tz` (v2/v3) with `formatInTimeZone`, `zonedTimeToUtc` | `@date-fns/tz` (v4) with `TZDate` + standard `date-fns` functions | Old API does not exist in v4; never install `date-fns-tz` for a date-fns v4 project |
| `new Date(year, month, day)` | `new TZDate(year, month, day, 0, 0, 0, tz)` | System TZ vs named IANA TZ |
| Static UTC offset arithmetic | `addMinutes` on `TZDate` | DST-safe vs DST-broken |
| ISR/cache for availability API | `dynamic = "force-dynamic"` | Prevents stale slot lists |

---

## Open Questions

1. **`addDays` DST behavior on `TZDate`**
   - What we know: `addMinutes` on a `TZDate` is wall-clock-safe. `addDays` adds 1 calendar day.
   - What's unclear: Whether `addDays` on a `TZDate` at midnight during DST transition produces midnight the next day or midnight + 1 hour.
   - Recommendation: In the slot algorithm, advance the `cursor` by 1 day using `addDays(cursor, 1)`. Test with a date cursor that crosses the spring-forward and fall-back boundaries. If `addDays` is ambiguous, use `new TZDate(year, month, day + 1, 0, 0, 0, TZ)` with explicit day increment instead.
   - **Risk level: LOW** — only affects the outer date iteration, not slot generation within a day.

2. **`getDay()` with `TZDate` — does it return TZ-aware day of week?**
   - What we know: The date-fns maintainer confirmed `TZDate` instances remain `TZDate` after operations: `endOfDay(new TZDate(from, timezone)) instanceof TZDate === true`. Date-fns functions that accept a date use `[Symbol.for("constructDateFrom")]` to preserve the type.
   - What's unclear: Whether `getDay(tzDate)` from date-fns uses the TZDate's timezone for the day-of-week calculation (returns 1 for Monday in Chicago) vs. the UTC day-of-week.
   - Recommendation: Use `tzDate.getDay()` (method call on TZDate instance, not function call) which is guaranteed to use the TZ. Alternatively, derive day-of-week from `getDay` with `in: tz(timezone)` option. Write a unit test to confirm.
   - **Risk level: MEDIUM** — if wrong, availability rules are applied to the wrong weekday.

3. **shadcn Calendar and `react-day-picker` version pinning**
   - What we know: shadcn's calendar component had a v8→v9 compatibility issue (GitHub #4366). The current `npx shadcn@latest add calendar` installs the latest resolved version.
   - What's unclear: Whether the current shadcn CLI installs react-day-picker v8 or v9.
   - Recommendation: After `npx shadcn@latest add calendar`, check `package.json` for `react-day-picker` version. If v8, the modifiers API shown above is correct. If v9, the API is compatible (v9 modifiers work the same way).
   - **Risk level: LOW** — the modifiers API is stable across v8 and v9.

---

## Sources

### Primary (HIGH confidence)
- Phase 1 migration `20260419120000_initial_schema.sql` — read directly — accounts/availability_rules/date_overrides/bookings schema
- Phase 3 migration `20260424120000_event_types_soft_delete.sql` — read directly
- Phase 3 RESEARCH.md — Server Action patterns, RHF patterns, sonner toast, `.neq("status","cancelled")` pattern
- `package.json` — read directly — confirmed date-fns and @date-fns/tz NOT installed; versions of all installed packages
- `components/ui/` directory listing — confirmed calendar NOT installed; all other Phase 3+ components are present
- `app/layout.tsx` — confirmed `<Toaster />` already mounted in root layout
- `vitest.config.ts` — confirmed test setup
- `npm view date-fns version`, `npm view @date-fns/tz version` — live versions: 4.1.0 / 1.4.1
- `@date-fns/tz` GitHub README (WebFetch) — TZDate constructor signatures, TZDate.tz factory, DST example
- `@date-fns/tz` src/tz/index.ts (WebFetch) — `tz()` function implementation: `(timeZone) => (value) => TZDate.tz(timeZone, +new Date(value))`
- date-fns/orgs discussion #3904 (WebFetch) — maintainer confirmed TZDate preserves type through date-fns operations
- shadcn Calendar docs (WebFetch) — `npx shadcn@latest add calendar` install command, `modifiers`/`modifiersClassNames` props

### Secondary (MEDIUM confidence)
- `@date-fns/tz` v4 does NOT export `formatInTimeZone` — confirmed by WebSearch cross-reference with multiple sources; the function belongs to old `date-fns-tz` package only
- Cal.com DST bug report GitHub #24350 (WebFetch) — confirms static offset arithmetic is the root cause of DST booking errors
- react-day-picker v9 modifiers API (daypicker.dev via WebSearch) — `modifiers` / `modifiersClassNames` props confirmed stable across v8/v9

### Tertiary (LOW confidence)
- `addDays(TZDate)` preserving TZ context — inferred from maintainer's statement about type preservation; not directly tested
- `getDay(TZDate)` using account TZ for day-of-week — inferred from TZDate design; recommend unit-testing to confirm

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Schema audit (existing columns) | HIGH | Read directly from migration files |
| Required migration | HIGH | Directly derived from schema + CONTEXT.md decisions |
| @date-fns/tz v4 API surface | HIGH | GitHub README + maintainer discussion + WebSearch cross-reference |
| `formatInTimeZone` absence | HIGH | Multiple sources confirm it's from old `date-fns-tz` only |
| Slot algorithm DST behavior | MEDIUM | First-principles + library docs; needs AVAIL-09 tests to confirm |
| `addDays`/`getDay` TZDate behavior | LOW-MEDIUM | Inferred; write unit tests in plan |
| UI primitives (installed) | HIGH | Read directly from filesystem |
| Calendar install command | HIGH | Official shadcn docs |
| react-day-picker modifiers API | MEDIUM | Cross-referenced with official daypicker.dev |
| Concurrency model | HIGH | Phase 1 DB guard already exists and was race-tested |
| Phase 3 patterns to mirror | HIGH | Read directly from existing source files |

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days; @date-fns/tz and date-fns ship frequently — re-verify versions at install time)
