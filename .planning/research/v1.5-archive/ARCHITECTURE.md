# Architecture Research

**Domain:** Multi-tenant Calendly-style booking tool (v1.5 milestone additions)
**Researched:** 2026-05-03
**Confidence:** HIGH — all file paths verified against live codebase; no guesses

---

## Focus

This document is scoped to the three v1.5 feature integrations. It does not re-survey the baseline architecture (fully documented in `.planning/PROJECT.md`). Every file path below was verified by reading the actual source.

---

## Feature 1: Per-Event-Type Post-Event Buffer

### What Changes Where

**New DB column:** `event_types.post_buffer_minutes INTEGER NOT NULL DEFAULT 0`

**Files that must change (in migration order):**

| File | Change |
|------|--------|
| `supabase/migrations/<ts>_add_event_type_post_buffer.sql` | ADD COLUMN + backfill UPDATE |
| `supabase/migrations/<ts+1>_drop_accounts_buffer_minutes.sql` | DROP accounts.buffer_minutes (separate migration, ships after drain) |
| `lib/slots.types.ts` | `AccountSettings` loses `buffer_minutes`; `BookingRow` gains `post_buffer_minutes` |
| `lib/slots.ts` | `slotConflictsWithBookings` signature change; `computeSlots` callsite change |
| `app/api/slots/route.ts` | bookings query adds `event_types.post_buffer_minutes` join; account query drops `buffer_minutes` |
| `app/(shell)/app/event-types/_components/event-type-form.tsx` | Add `post_buffer_minutes` input field after `duration_minutes` |
| `app/(shell)/app/event-types/_lib/schema.ts` | Add `post_buffer_minutes` to `eventTypeSchema` |
| `app/(shell)/app/event-types/_lib/actions.ts` | Write `post_buffer_minutes` on create/update |
| `app/(shell)/app/availability/_components/settings-panel.tsx` | Remove `buffer_minutes` field (Phase A2) |
| `app/(shell)/app/availability/_lib/schema.ts` | Remove `buffer_minutes` from `accountSettingsSchema` (Phase A2) |
| `app/(shell)/app/availability/_lib/actions.ts` | Remove `buffer_minutes` from the UPDATE (Phase A2) |
| `app/(shell)/app/availability/_lib/queries.ts` | Remove `buffer_minutes` from the SELECT (Phase A2) |
| `app/(shell)/app/availability/_lib/types.ts` | Remove `buffer_minutes` from `AccountSettingsRow` (Phase A2) |
| `app/(shell)/app/availability/page.tsx` | Remove `buffer_minutes` prop passed to `SettingsPanel` (Phase A2) |
| `app/[account]/[event-slug]/_lib/types.ts` | `EventTypeSummary` gains `post_buffer_minutes: number` |
| `tests/slot-generation.test.ts` | Update `baseAccount.buffer_minutes` fixture to per-event-type pattern |

### Migration Sequence with Hard Ordering

This follows the locked CP-03 two-step deploy protocol established in v1.2.

```
MIGRATION 1 — "Add column + backfill" (ships with Deploy 1):
  BEGIN;
  ALTER TABLE event_types
    ADD COLUMN post_buffer_minutes INTEGER NOT NULL DEFAULT 0;
  UPDATE event_types et
    SET post_buffer_minutes = a.buffer_minutes
    FROM accounts a
    WHERE et.account_id = a.id;
  COMMIT;

  Apply via: supabase db query --linked -f <migration-1-file>

DEPLOY 1 — code reads new column; old column still exists (no reads removed yet):
  - lib/slots.types.ts: BookingRow gains post_buffer_minutes; AccountSettings loses buffer_minutes
  - lib/slots.ts: slotConflictsWithBookings reads per-booking buffer
  - app/api/slots/route.ts: bookings query joins event_types; account query drops buffer_minutes SELECT
  - app/[account]/[event-slug]/_lib/types.ts: EventTypeSummary gains post_buffer_minutes
  - event-type-form.tsx: new post_buffer_minutes input field visible
  - event-types/schema.ts + actions.ts: write post_buffer_minutes

  >>> HARD GATE: Wait minimum 30 minutes (CP-03 drain).
  >>> ALL deployed instances must be reading post_buffer_minutes before proceeding.
  >>> Do NOT push the next commit until drain is satisfied.

MIGRATION 2 — "Drop old column" (ships with Deploy 2):
  BEGIN;
  ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes;
  COMMIT;

  Apply via: supabase db query --linked -f <migration-2-file>

DEPLOY 2 — code stops referencing accounts.buffer_minutes:
  - availability/settings-panel.tsx: remove buffer_minutes UI field
  - availability/schema.ts: remove buffer_minutes from schema
  - availability/actions.ts: remove buffer_minutes from UPDATE
  - availability/queries.ts: remove buffer_minutes from SELECT
  - availability/types.ts: remove buffer_minutes from AccountSettingsRow
  - availability/page.tsx: remove buffer_minutes from SettingsPanel initial prop
```

**Hard ordering constraints:**
1. Migration 1 must apply BEFORE Deploy 1 pushes (column must exist before code reads it)
2. Deploy 1 must be live and drained BEFORE Migration 2 applies (no deployed code reads `accounts.buffer_minutes`)
3. Migration 2 must apply BEFORE Deploy 2 pushes (no code that still reads the dropped column)
4. The Migration 2 + Deploy 2 commit pair must be held local during the 30-min drain window (do not push until drain satisfied, per CP-03 pattern from v1.2 Phase 21)

### lib/slots.ts Signature Change

**Current `slotConflictsWithBookings` (lib/slots.ts:203-218):**
```typescript
function slotConflictsWithBookings(
  slotStartUtc: Date,
  slotEndUtc: Date,
  bufferMinutes: number,          // currently a single account-wide value
  bookings: SlotInput["bookings"],
): boolean
```

**Required change — Option A (recommended):** Extend `BookingRow` to carry its own buffer; pass the candidate slot's buffer separately.

```typescript
// lib/slots.types.ts — BookingRow extended
export interface BookingRow {
  start_at: string;
  end_at: string;
  post_buffer_minutes: number;  // NEW: from event_types join in route.ts
}

// lib/slots.types.ts — AccountSettings loses buffer_minutes
export interface AccountSettings {
  timezone: string;
  // buffer_minutes REMOVED — now per event type
  min_notice_hours: number;
  max_advance_days: number;
  daily_cap: number | null;
}

// lib/slots.ts — updated signature
function slotConflictsWithBookings(
  slotStartUtc: Date,
  slotEndUtc: Date,
  slotPostBufferMinutes: number,  // candidate slot's event type buffer
  bookings: SlotInput["bookings"],
): boolean {
  for (const b of bookings) {
    // Extend the slot backward by the EXISTING booking's buffer
    // (the existing booking's event type needs post-buffer after it)
    const bufferedSlotStart = addMinutes(slotStartUtc, -b.post_buffer_minutes);
    // Extend the slot forward by the CANDIDATE slot's own post buffer
    const bufferedSlotEnd   = addMinutes(slotEndUtc, slotPostBufferMinutes);
    const bStart = new Date(b.start_at);
    const bEnd   = new Date(b.end_at);
    if (isBefore(bufferedSlotStart, bEnd) && isBefore(bStart, bufferedSlotEnd)) {
      return true;
    }
  }
  return false;
}
```

**computeSlots callsite change (lib/slots.ts:272-279):** Currently passes `account.buffer_minutes`. Must be updated to pass `eventType.post_buffer_minutes` (the event type for the candidate slot). The `SlotInput` interface gains `postBufferMinutes: number` or reads it from a new field.

### app/api/slots/route.ts Query Change

**Current bookings query (route.ts:136-148):** flat select of `start_at, end_at` from `bookings`, no join.

**Required change:** Join `event_types` to get `post_buffer_minutes` per booking.

```typescript
supabase
  .from("bookings")
  .select("start_at, end_at, event_types!inner(post_buffer_minutes)")
  .eq("account_id", eventType.account_id)
  .eq("status", "confirmed")
  .gte("start_at", bookingsRangeStart)
  .lte("start_at", `${to}T23:59:59.999Z`)
```

**Verified:** The current bookings query at route.ts:136 has no join — this is entirely new. The `!inner` join syntax already exists in other supabase selects in this codebase.

**Account query change (route.ts:121):** Drop `buffer_minutes` from the SELECT string: `"timezone, min_notice_hours, max_advance_days, daily_cap"`.

### event-type-form.tsx Field Addition

**File:** `app/(shell)/app/event-types/_components/event-type-form.tsx`

- Add `post_buffer_minutes: 0` to the `DEFAULTS` object
- Add a number input for `post_buffer_minutes` after the `duration_minutes` field in the JSX
- The Zod schema (`app/(shell)/app/event-types/_lib/schema.ts`) needs: `post_buffer_minutes: z.coerce.number().int().min(0).max(240).default(0)`

### Pre-flight Diagnostic SQL

Run before Deploy 1 to confirm Migration 1 applied correctly:

```sql
-- Must return 0 (NOT NULL DEFAULT guarantees this, but verify):
SELECT COUNT(*) FROM event_types WHERE post_buffer_minutes IS NULL;

-- Should show values equal to what was in accounts.buffer_minutes:
SELECT DISTINCT post_buffer_minutes FROM event_types ORDER BY 1;
```

Non-zero on the first query is a stop-the-workflow condition.

### SettingsPanel Impact (Phase A2)

`app/(shell)/app/availability/_components/settings-panel.tsx` currently owns the `buffer_minutes` UI field. In Deploy 2 this field disappears from the availability page. Buffer is now per-event-type. This is a visible UX change — document in release notes.

---

## Feature 2: Audience Rebrand (contractors → service-based businesses)

### Surface Enumeration (verified)

**Runtime code with audience copy:**

| File | Line | Current String |
|------|------|----------------|
| `app/(auth)/_components/auth-hero.tsx` | 21 | `"A multi-tenant scheduling tool built for trade contractors..."` (default `subtext` prop) |
| `app/(auth)/_components/auth-hero.tsx` | 42 | `"Built for trade contractors, by NSI in Omaha."` (bullet list item) |
| `README.md` | 3 | `"...booking tool for trade contractors (plumbers, HVAC, roofers, electricians)..."` |

**Not in scope (verified clean):**
- Onboarding wizard (`app/onboarding/` — 10 files): zero contractor copy
- Test files (26 files): zero audience copy assertions; no snapshot tests exist
- `lib/` directory: zero contractor identifier symbols
- `app/[account]/[event-slug]/_components/booking-form.tsx:138`: comment only (`// leak that the contractor has another appointment.`) — inert; optional update

**Internal TypeScript identifiers:** None exist. No `ContractorAccount`, `TradeContractor`, or `contractor*` symbols are present anywhere in the codebase. The rebrand is entirely visible-string copy — no symbol renames required.

**Database:** No column renames. `accounts.name` is user-supplied display data; shape unchanged.

### Change Scope

Single pass, 2 runtime files + 1 doc file:

1. `app/(auth)/_components/auth-hero.tsx` — rewrite `subtext` default (line 21) and bullet item (line 42)
2. `README.md` — rewrite line 3 description

### Cross-Feature Independence

Fully independent of the buffer fix and the booker redesign. No shared files. Safe in any phase order.

---

## Feature 3: Public Booker 3-Column Desktop Layout

### Current Layout (verified by source read)

```
app/[account]/[event-slug]/page.tsx        (Server Component — UNCHANGED)
  PublicShell                               (sets BackgroundGlow + glass pill — UNCHANGED)
    BookingShell                            ("use client"; owns ALL state — MODIFIED)
      <header> hero (max-w-3xl, centered)
      <section> booking card (max-w-3xl)
        <div class="rounded-2xl border bg-white shadow-sm">
          <div class="grid gap-8 p-6 lg:grid-cols-[1fr_320px]">   ← CURRENT 2-col
            SlotPicker                      ("use client" — MODIFIED)
              <p> timezone hint
              <div class="grid gap-6 lg:grid-cols-2">             ← CURRENT inner 2-col
                Calendar (shadcn)            ← col 1
                <div> slot list              ← col 2
            <aside class="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              {selectedSlot ? <BookingForm/> : <hint text/>}
```

**State ownership:** All state (`selectedDate`, `selectedSlot`, `bookerTz`, `refetchKey`, `showRaceLoser`, `raceLoserMessage`) lives in `BookingShell`. `SlotPicker` receives state as props. No state topology changes required.

### Recommended 3-Column Implementation

**Do NOT introduce a new `BookingLayout` wrapper.** `BookingShell` already owns all the state and is the correct place for the layout grid. A new wrapper would add a component boundary with no responsibility gain.

**Two-file change:**

**File 1: `app/(shell)/app/[account]/[event-slug]/_components/booking-shell.tsx`**

Change the outer grid from 2-column to 3-column:

```tsx
// BEFORE:
<div className="grid gap-8 p-6 lg:grid-cols-[1fr_320px]">
  <SlotPicker ... />
  <aside className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
    {selectedSlot ? <BookingForm .../> : <p>Pick a time...</p>}
  </aside>
</div>

// AFTER:
<div className="grid gap-8 p-6 lg:grid-cols-[auto_1fr_320px]">
  {/* Calendar fills col 1 (auto = content-sized; Calendar has fixed internal width) */}
  {/* Slot list fills col 2 (1fr = remaining space) */}
  {/* Form fills col 3 (320px fixed, always reserved) */}
  <SlotPicker ... />   {/* SlotPicker renders 2 direct grid children — see below */}
  <aside className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
    {selectedSlot ? <BookingForm .../> : <p>Pick a time on the left to continue.</p>}
  </aside>
</div>
```

**File 2: `app/[account]/[event-slug]/_components/slot-picker.tsx`**

Remove the internal `<div class="grid gap-6 lg:grid-cols-2">` wrapper so calendar and slot-list render as direct children of the parent's 3-column grid:

```tsx
// BEFORE (slot-picker.tsx return, simplified):
return (
  <>
    <p className="text-xs ...">Times shown in {props.bookerTimezone}</p>
    <div className="grid gap-6 lg:grid-cols-2">   {/* ← REMOVE THIS WRAPPER */}
      <Calendar ... className="justify-self-center rounded-md border" />
      <div>
        {/* slot list */}
      </div>
    </div>
  </>
);

// AFTER:
return (
  <>
    {/* col 1: Calendar — justify-self-center preserved */}
    <Calendar ... className="justify-self-center rounded-md border" />
    {/* col 2: slot list + timezone hint */}
    <div>
      <p className="text-xs ...">Times shown in {props.bookerTimezone}</p>
      {/* slot list content */}
    </div>
  </>
);
```

Note: The timezone hint `<p>` currently sits ABOVE the grid in SlotPicker. In the 3-column layout it should move to the top of col 2 (slot list column) so it's positioned near the times it describes, not floating above both calendar and times.

**No-layout-shift contract:** The form `<aside>` in BookingShell already renders both states (hint text OR BookingForm). The `320px` column is always present in the grid template. Content inside col 3 changes conditionally — the column width never changes. No layout shift.

**Mobile:** `grid-cols-1` at base; `lg:grid-cols-[auto_1fr_320px]` at `lg:` (1024px+). Mobile stacking order: calendar → slot list → form. This is the correct interaction flow.

**`auto` for calendar column rationale:** The shadcn Calendar component has a fixed internal width. `auto` allows the column to be content-sized rather than artificially stretched. `1fr` for slot list gives it all remaining space after calendar and form.

### Component Boundaries

| Component | Status | File |
|-----------|--------|------|
| `BookingShell` | MODIFIED — grid template change + `<aside>` always rendered | `app/[account]/[event-slug]/_components/booking-shell.tsx` |
| `SlotPicker` | MODIFIED — remove internal `lg:grid-cols-2` wrapper; timezone hint moves to slot-list div | `app/[account]/[event-slug]/_components/slot-picker.tsx` |
| `BookingForm` | UNCHANGED | `app/[account]/[event-slug]/_components/booking-form.tsx` |
| `RaceLoserBanner` | UNCHANGED | `app/[account]/[event-slug]/_components/race-loser-banner.tsx` |
| `page.tsx` (public booker) | UNCHANGED | `app/[account]/[event-slug]/page.tsx` |
| `PublicShell` | UNCHANGED | `app/_components/public-shell.tsx` |
| `Calendar` (shadcn) | UNCHANGED — per-instance override pattern preserved | `components/ui/calendar.tsx` |

**PublicShell boundary (confirmed):** PublicShell sets page chrome (BackgroundGlow + glass pill). The booking card (`rounded-2xl border bg-white shadow-sm`) lives inside BookingShell, which is PublicShell's child. The 3-column grid lives inside the booking card — one layer below PublicShell. PublicShell does not change.

### Embed Widget Decision

**Verified:** `app/embed/[account]/[event-slug]/_components/embed-shell.tsx:107` calls `<BookingShell account={account} eventType={eventType} />` directly. If BookingShell gets the 3-column grid, the embed gets it automatically.

**Decision: let embed inherit 3-column grid, no embed-specific flag.**

Rationale:
- The `lg:` Tailwind breakpoint is 1024px. Embedded iframes in typical client sites are 400-600px wide — well below `lg:`. The 3-column template will not fire at those widths. The embed naturally stacks as 1-column on any realistically-sized iframe.
- If a customer embeds in a very wide sidebar (>1024px wide iframe), the 3-column layout fires — which is arguably desirable.
- Adding a flag to suppress 3-column in embed would be extra code with negligible benefit.
- `EmbedHeightReporter` measures `document.body.scrollHeight`. Grid-template changes affect rendered height, which is exactly what EmbedHeightReporter is supposed to report. No infinite-loop risk — the `relative overflow-hidden` + `min-height: auto` invariants on EmbedShell are unaffected by grid template.

Mark this decision explicitly in the phase plan so it is not revisited mid-execution.

---

## Suggested Phase Structure

### Cross-Feature Dependency Matrix

| Pair | Shared Files | Dependency |
|------|-------------|------------|
| Buffer fix + Rebrand | None | Independent |
| Buffer fix + Booker layout | `app/[account]/[event-slug]/_lib/types.ts` (Phase A adds `post_buffer_minutes` to `EventTypeSummary`; Phase C reads `EventTypeSummary`) | Soft: Phase A should merge before Phase C touches the same type, but Phase C does not READ `post_buffer_minutes` from EventTypeSummary — it only reads layout-relevant fields. Safe to develop in parallel; merge Phase A first. |
| Rebrand + Booker layout | None | Independent |

### Recommended Phase Order

**Phase A: Per-Event-Type Buffer (two sub-phases)**
- A1: Migration 1 + Deploy 1 (add column, code reads new column, event-type-form UI)
- A2: 30-min drain satisfied → Migration 2 + Deploy 2 (drop column, remove old UI)
- Do first: most complex ordering constraint (CP-03), schema mutation, type changes that cascade to slots engine and route handler

**Phase B: Audience Rebrand**
- Single sub-phase: 2 file changes + README
- Do second: zero risk, fast to ship, good momentum phase between complex schema work and layout work

**Phase C: Booker 3-Column Desktop Layout**
- Single sub-phase: `booking-shell.tsx` + `slot-picker.tsx` grid changes
- Do last: purely visual; Andrew deploy-and-eyeball approves on production; if Phase A's `EventTypeSummary` type change is already stable, Phase C has no type conflicts

**Parallel-safety:** All three features are independently developable. In GSD sequential execution the above order is clean — no cross-phase file conflicts when executed in order.

---

## Component Boundary Map (v1.5 complete view)

```
Phase A changes:
  lib/slots.types.ts                   BookingRow gains post_buffer_minutes;
                                       AccountSettings loses buffer_minutes
  lib/slots.ts                         slotConflictsWithBookings signature change
  app/api/slots/route.ts               bookings query gains event_types join;
                                       account query drops buffer_minutes
  app/[account]/[event-slug]/_lib/types.ts  EventTypeSummary gains post_buffer_minutes
  app/(shell)/app/event-types/_components/event-type-form.tsx  new field
  app/(shell)/app/event-types/_lib/schema.ts  new field
  app/(shell)/app/event-types/_lib/actions.ts  new field
  tests/slot-generation.test.ts        fixture update
  [Phase A2 only]:
    app/(shell)/app/availability/_components/settings-panel.tsx  field removed
    app/(shell)/app/availability/_lib/schema.ts                  field removed
    app/(shell)/app/availability/_lib/actions.ts                 field removed
    app/(shell)/app/availability/_lib/queries.ts                 field removed
    app/(shell)/app/availability/_lib/types.ts                   field removed
    app/(shell)/app/availability/page.tsx                        prop removed

Phase B changes:
  app/(auth)/_components/auth-hero.tsx  2 string rewrites
  README.md                             1 line rewrite

Phase C changes:
  app/[account]/[event-slug]/_components/booking-shell.tsx  grid template
  app/[account]/[event-slug]/_components/slot-picker.tsx    grid wrapper removed

UNCHANGED by any phase:
  app/[account]/[event-slug]/_components/booking-form.tsx
  app/[account]/[event-slug]/_components/race-loser-banner.tsx
  app/[account]/[event-slug]/page.tsx
  app/embed/[account]/[event-slug]/page.tsx
  app/embed/[account]/[event-slug]/_components/embed-shell.tsx
  app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx
  app/_components/public-shell.tsx
  components/ui/calendar.tsx
  lib/slots.ts (structure unchanged; only slotConflictsWithBookings internals change)
```

---

## Sources

- Live codebase — all file paths verified by Read tool (2026-05-03):
  - `lib/slots.ts` lines 203-218: `slotConflictsWithBookings` current signature confirmed
  - `lib/slots.types.ts`: `AccountSettings.buffer_minutes`, `BookingRow` shape confirmed
  - `app/api/slots/route.ts` lines 117-149: bookings query has no join confirmed; account SELECT string confirmed
  - `app/(shell)/app/availability/` — 5 files confirmed reading/writing `accounts.buffer_minutes`
  - `app/(shell)/app/event-types/_lib/schema.ts`: `eventTypeSchema` has no `post_buffer_minutes`
  - `app/(auth)/_components/auth-hero.tsx` lines 21, 42: contractor copy confirmed
  - `README.md` line 3: contractor copy confirmed
  - `app/onboarding/` (10 files): zero contractor copy confirmed
  - Test files (26 files listed): zero audience copy assertions; no snapshots confirmed
  - `lib/` directory: zero contractor identifier symbols confirmed
  - `app/[account]/[event-slug]/_components/booking-shell.tsx`: current grid `lg:grid-cols-[1fr_320px]` confirmed
  - `app/[account]/[event-slug]/_components/slot-picker.tsx`: current inner grid `lg:grid-cols-2` confirmed
  - `app/embed/[account]/[event-slug]/_components/embed-shell.tsx:107`: `BookingShell` call confirmed
  - `app/[account]/[event-slug]/_lib/types.ts`: `EventTypeSummary` shape confirmed; no `post_buffer_minutes`

---
*Architecture research for: calendar-app v1.5 (Buffer Fix + Audience Rebrand + Booker Redesign)*
*Researched: 2026-05-03*
