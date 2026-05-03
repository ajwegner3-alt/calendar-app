# Stack Research — v1.5 Buffer Fix + Audience Rebrand + Booker Redesign

**Domain:** Multi-tenant Calendly-style booking tool for service-based businesses
**Researched:** 2026-05-03
**Confidence:** HIGH (all findings verified against live source files; no training-data assertions)

---

## Verdict: Zero New npm Packages Required

All three v1.5 features are implementable with the existing installed stack. No new
dependencies needed. This is confirmed by reading every touch file listed below.

---

## Feature 1: Per-Event-Type Post-Event Buffer (BUFFER-01)

### Schema Situation — Critical Discovery

The initial migration (`supabase/migrations/20260419120000_initial_schema.sql`, lines 35-36)
created two columns on `event_types` that have **never been wired to the slot engine**:

```sql
buffer_before_minutes  int not null default 0 check (buffer_before_minutes >= 0),
buffer_after_minutes   int not null default 0 check (buffer_after_minutes >= 0),
```

The Phase 4 availability-settings migration (`20260425120000_account_availability_settings.sql`)
added `accounts.buffer_minutes` as an account-scoped overlay and that is what the engine reads
today (`lib/slots.ts:277` passes `account.buffer_minutes` to `slotConflictsWithBookings`).

**Implication for v1.5:** `event_types.buffer_after_minutes` already exists in production with
the correct semantics (post-event buffer). Two paths exist for the migration:

**Path A — Wire `buffer_after_minutes` (existing column, no ADD COLUMN needed):**
- Skip the ADD COLUMN migration entirely.
- Migration scope: `UPDATE event_types SET buffer_after_minutes = (SELECT buffer_minutes FROM accounts WHERE accounts.id = event_types.account_id)` to backfill from account values, then DROP `accounts.buffer_minutes`.
- The dead `buffer_before_minutes` column can remain (DEFAULT 0, no code reads it) or be dropped alongside `buffer_minutes` in the same DROP migration.

**Path B — Add `post_buffer_minutes` per spec name (new column):**
- Adds an ADD COLUMN migration before backfill + DROP.
- Cleaner semantic name; avoids adjacency confusion with the dead `buffer_before_minutes` column.
- `ALTER TABLE event_types ADD COLUMN IF NOT EXISTS post_buffer_minutes integer NOT NULL DEFAULT 0 CHECK (post_buffer_minutes >= 0);` is a single idempotent statement.

**Recommendation: Path A.** `buffer_after_minutes` is semantically correct for post-only buffer
semantics, already present in production (no ADD COLUMN risk), and already declared in the
`EventTypeRow` TypeScript type (`app/(shell)/app/event-types/_lib/types.ts:43-44`). This reduces
v1.5 migration surface to one migration file instead of two.

### Migration Apply Path (LOCKED FOR THIS REPO)

Per `PROJECT.md §200` and the v1.2 Phase 21 precedent: `supabase db push --linked` is broken in
this repo (orphan timestamps in remote migration tracking table). The canonical apply command for
every migration:

```bash
echo | npx supabase db query --linked -f supabase/migrations/<TIMESTAMP>_<name>.sql
```

The `echo |` pipe satisfies the interactive stdin prompt the CLI issues without it. The `-f` flag
runs the file; wrap multi-statement migrations in `BEGIN/COMMIT` for atomicity (the CLI does not
wrap automatically). This path was used successfully for every migration from v1.1 through v1.4
including the Phase 21 DROP.

### Two-Step DROP Deploy Protocol (CP-03)

Established in v1.2 Phase 21 for dropping `accounts.sidebar_color`, `background_color`,
`background_shade`, `chrome_tint_intensity`. The same protocol applies to `accounts.buffer_minutes`.

**Step 1 — Code stop-reading commit:**
Remove all reads of `accounts.buffer_minutes` from TypeScript. Wire the slot engine to
`event_types.buffer_after_minutes`. Run `tsc --noEmit` and `grep -r buffer_minutes app/ lib/`
to confirm zero remaining references. Deploy to Vercel. Do NOT drop the column yet.

**Drain window — minimum 30 minutes:**
Stale Vercel function instances can hold in-flight requests against old code. Dropping the column
while old instances are alive causes 500s. In v1.2, the drain ran 772 minutes (overnight); 30
minutes is the enforced minimum. Hold the DROP migration file local (do not push) during this window.

**Step 2 — DROP migration:**
After drain, apply:

```bash
echo | npx supabase db query --linked -f supabase/migrations/<TIMESTAMP>_drop_accounts_buffer_minutes.sql
```

Migration template (matches Phase 21 pattern — atomic, IF EXISTS guarded, RAISE NOTICE header):

```sql
BEGIN;
  DO $$ BEGIN RAISE NOTICE 'v1.5 DROP migration: accounts.buffer_minutes'; END $$;
  ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes;
COMMIT;
```

**Author a `.SKIP` rollback artifact** per CP-03 convention:
`<TIMESTAMP+1>_readd_accounts_buffer_minutes.sql.SKIP`

**Pre-flight gate before Step 2:** run
`grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"`
and confirm zero matches (excluding migration files and test files that only reference the name in
comments). Zero live references is the required gate condition.

### Engine Touch Sites — Complete Map

Every file that reads `accounts.buffer_minutes` today and must be updated:

| File | Line(s) | Change Required |
|------|---------|----------------|
| `app/api/slots/route.ts:89` | `event_types` SELECT | Add `buffer_after_minutes` to the column list |
| `app/api/slots/route.ts:121` | `accounts` SELECT | Remove `buffer_minutes` from the column string |
| `app/api/slots/route.ts:160` | `AccountSettings` construction | Replace `buffer_minutes: accountRes.data.buffer_minutes` with value from `eventType.buffer_after_minutes` |
| `lib/slots.types.ts:15` | `AccountSettings.buffer_minutes` field | Move the field out of `AccountSettings` or rename it; see note below |
| `lib/slots.ts:277` | `account.buffer_minutes` passed to `slotConflictsWithBookings` | Read from the event-type value instead |
| `app/(shell)/app/availability/_components/settings-panel.tsx:15,25,48,75,84` | `buffer_minutes` field | Remove the buffer control from the availability panel (it no longer applies account-wide) |
| `app/(shell)/app/availability/_lib/actions.ts:64` | Server Action upsert payload | Remove `buffer_minutes` from the UPDATE payload |
| `app/(shell)/app/availability/_lib/queries.ts:53` | SELECT string | Remove `buffer_minutes` from the accounts query |
| `app/(shell)/app/availability/_lib/schema.ts:135` | Zod schema | Remove `buffer_minutes` field |
| `app/(shell)/app/availability/_lib/types.ts:24` | TypeScript type | Remove `buffer_minutes` field |
| `app/(shell)/app/availability/page.tsx:50` | Page state construction | Remove `buffer_minutes` from initial state |

**Note on `AccountSettings` interface:** `buffer_minutes` is currently declared on
`AccountSettings` (the account row shape in `lib/slots.types.ts`). After the migration, the
buffer belongs to the event type, not the account. The cleanest approach: add a new field
`postBufferMinutes: number` to `SlotInput` directly and pass it from the route handler
(`eventType.buffer_after_minutes`). This keeps `AccountSettings` as a pure account-row shape.
Alternatively, rename `AccountSettings.buffer_minutes` to `buffer_minutes: 0` as a dead zero
while the engine reads from the new `SlotInput` field. Either way, `slotConflictsWithBookings`
signature at `lib/slots.ts:203` receives the value as its `bufferMinutes` parameter unchanged.

**Owner-facing UI addition:** Add a `buffer_after_minutes` (or `post_buffer_minutes`) number
input to the event-type form (`app/(shell)/app/event-types/_components/event-type-form.tsx`).
The `EventTypeRow` type (`app/(shell)/app/event-types/_lib/types.ts:43-44`) already declares
`buffer_after_minutes: number` — the form simply never rendered a control for it. The actions
and queries for the event-type edit page (`app/(shell)/app/event-types/[id]/edit/`) already
SELECT `buffer_after_minutes` (confirmed at line 18 of edit `page.tsx`).

**Test touch sites:** Existing slot tests pass `buffer_minutes` on the `account` object in
`SlotInput`. Search `tests/slots*.test.ts` for `buffer_minutes` and update to the new field
location after the type change.

### Migration Timestamps

| Migration | Suggested Timestamp |
|-----------|-------------------|
| Backfill update (Path A) — can be inline in the DROP file or separate | `20260503130000` |
| DROP `accounts.buffer_minutes` (held local during drain) | `20260503130001` |
| Rollback `.SKIP` artifact | `20260503130002_readd_accounts_buffer_minutes.sql.SKIP` |
| ADD COLUMN `post_buffer_minutes` (Path B only, runs before backfill) | `20260503125900` |

---

## Feature 2: Audience Rebrand (Contractors → Service-Based Businesses)

### Identifier Rename Scope — Smaller Than Expected

A grep of all `.ts` and `.tsx` files for `tradeContractor`, `TradeContractor`, `serviceBusiness`,
and `ServiceBusiness` returns **zero matches**. No camelCase or PascalCase internal identifiers
using these terms exist in the TypeScript codebase. The PROJECT.md requirement to rename
`tradeContractor*` / `contractor*` → `serviceBusiness*` applies to identifiers that may be
introduced during v1.5 (e.g. for the buffer form field or new event-type schema constants), not
to existing ones.

**Runtime copy touch sites (`.ts`/`.tsx` files):**

| File | Line | Content | Scope |
|------|------|---------|-------|
| `app/(auth)/_components/auth-hero.tsx:21` | Default `subtext` prop | `"A multi-tenant scheduling tool built for trade contractors..."` | Owner-facing (login/signup page) |
| `app/(auth)/_components/auth-hero.tsx:42` | Static copy | `"Built for trade contractors, by NSI in Omaha."` | Owner-facing (login/signup page) |
| `app/[account]/[event-slug]/_components/booking-form.tsx:138` | Comment only | `// leak that the contractor has another appointment` | Code comment, not user-visible |

**Public booking surfaces:** The only `.ts`/`.tsx` match in the public booking path is the code
comment at `booking-form.tsx:138`. No user-visible copy on any public surface uses "contractor."
The booker-facing 409 error message at line 139 already reads "That time is no longer available"
— generic and correct, no change needed.

**Transactional email templates:** A grep of `lib/email/` for `contractor` returns zero matches.
All 6 email templates are contractor-copy-free.

**Documentation touch sites:**

| File | Lines | Content |
|------|-------|---------|
| `README.md:3` | 1 line | `"for trade contractors (plumbers, HVAC, roofers, electricians)"` |
| `FUTURE_DIRECTIONS.md:62` | 1 line | Incidental mention in SMTP description |
| `FUTURE_DIRECTIONS.md:226` | 1 line | Incidental mention in slug-redirect context |
| `FUTURE_DIRECTIONS.md:232` | 1 line | Incidental mention in onboarding template context |

**Rename strategy:** IDE find-and-replace across the `app/` tree is sufficient. No AST tooling
(ts-morph, jscodeshift) is needed because:
1. Zero camelCase/PascalCase `contractor*` identifiers exist to rename.
2. All touch sites are string literals or prose comments.
3. The total is 6 touch sites across 5 files.

**Any new identifiers added in v1.5** (e.g. a constant for the buffer field label, a new schema
type) should use `serviceBusiness*` naming convention from the start.

**Touch-site count summary:**

| Category | Count | Files |
|----------|-------|-------|
| User-visible runtime copy | 2 | `auth-hero.tsx` |
| Code comments | 1 | `booking-form.tsx` |
| Documentation prose | 3 | `README.md`, `FUTURE_DIRECTIONS.md` |
| **Total** | **6** | **5 files** |

---

## Feature 3: Public Booker 3-Column Desktop Layout

### Current Layout Architecture

The booker is two client components with nested grids:

**`booking-shell.tsx`** is the outer container. It holds all interaction state and renders:
```html
<div class="grid gap-8 p-6 lg:grid-cols-[1fr_320px]">
  <!-- Left: SlotPicker (has its own internal 2-col grid) -->
  <!-- Right: BookingForm (320px fixed) -->
</div>
```

**`slot-picker.tsx`** renders its own internal grid:
```html
<div class="grid gap-6 lg:grid-cols-2">
  <!-- Left: Calendar -->
  <!-- Right: slot time buttons -->
</div>
```

On desktop, the effective layout is `[[calendar | slot-times] | form]` — two nested grid contexts,
with the calendar and slot-time list sharing a 2-col grid inside the left panel of an outer 2-col
grid. The symptom ("calendar far-right, text chaotic") is a consequence of this nesting and the
`1fr_320px` split leaving a wide left panel where the inner 2-col grid distributes unevenly.

### Target Layout

Three flat columns at `lg:` breakpoint: **Calendar LEFT — Slot times MIDDLE — Form RIGHT.**
Form hidden (but layout-present) until slot selected; revealed in-place with no layout shift.
Mobile: single column stack (Calendar → Times → Form).

### Recommended Approach: Flatten to One Grid Context in `booking-shell.tsx`

**Flatten the nested grid.** The `booking-shell.tsx` outer `div` becomes the single 3-column
grid owner. `slot-picker.tsx` loses its internal `lg:grid-cols-2` and exposes the Calendar and
slot-time list as two separately placeable blocks. `booking-shell.tsx` controls all three columns.

**Grid declaration:**

```tsx
<div className="grid gap-6 lg:grid-cols-[auto_1fr_320px]">
  {/* Col 1: Calendar — auto width (≈280px natural width of shadcn Calendar) */}
  {/* Col 2: Slot time list — takes remaining space */}
  {/* Col 3: Form — fixed 320px */}
</div>
```

`auto` for the calendar column lets `shadcn/ui Calendar` size to its intrinsic width (~280px)
without over-allocating whitespace. `1fr` for the slot list adapts to remaining card width.
`320px` for the form matches the existing shell convention. Alternative: `lg:grid-cols-3` (equal
thirds) — simpler but gives the calendar more horizontal room than it uses. `[auto_1fr_320px]`
is tighter and more intentional.

**Tailwind v4 bracket syntax** (`lg:grid-cols-[auto_1fr_320px]`) is first-class and JIT-compiled.
The codebase already uses `lg:grid-cols-[1fr_320px]` in `booking-shell.tsx:77` — same syntax,
same behavior. No `tailwind.config.*` change needed.

**Mobile breakpoint convention:** The codebase uses `lg:` exclusively for layout breakpoints
(`lg:grid-cols-2`, `lg:border-l`, `lg:pt-0`, `lg:pl-6` in `booking-shell.tsx`; `lg:flex` in
`auth-hero.tsx`; `lg:grid-cols-2` in `slot-picker.tsx`). Use `lg:` (1024px) for the 3-column
breakpoint. Do not introduce a `md:` grid column variant — it would break codebase convention.

### Form Reveal With No Layout Shift

The form column must occupy its 320px slot at all times so the 3-column grid does not collapse
to 2-column when the form is hidden. Conditional rendering (`{selectedSlot && <BookingForm />}`)
removes the element from the DOM and collapses the column — this causes layout shift.

**Correct pattern using Tailwind `invisible`:**

```tsx
<aside className={selectedSlot ? "" : "invisible pointer-events-none"}>
  <BookingForm
    key={selectedSlot?.start_at ?? "none"}
    ...
  />
</aside>
```

`invisible` sets `visibility: hidden` — the element participates in layout (holds its column
width and height), is not painted, and receives no pointer events. The `pointer-events-none` is
belt-and-suspenders to prevent keyboard/tab focus reaching a visually hidden form. The `key` prop
forces a remount when a new slot is selected, resetting form state cleanly.

`BookingForm` must always be mounted for this to work. Its internal RHF `useForm` initializes
from props on mount; a fresh `key` on slot change is the standard pattern for resetting RHF state.

**Precedent in this codebase:** `app/(auth)/_components/auth-hero.tsx:24` uses
`hidden lg:flex lg:flex-col` (display-based hide/show) for the auth layout. The booker case
requires `invisible` instead of `hidden` because we need the column to occupy layout space even
when not visible.

### SlotPicker Refactor Strategy

Three options for splitting the current monolithic `SlotPicker` into two separately placeable
blocks:

| Option | Description | Recommendation |
|--------|-------------|---------------|
| A — Render props | `SlotPicker` accepts `renderCalendar` and `renderSlots` props; caller places them separately | Adds indirection for no gain |
| B — Two components (`SlotCalendar` + `SlotList`) | Shared state via context or props | Context overhead for simple state |
| C — Lift state to `BookingShell` | Move slots fetch, loading, fetchError, slotsByDate up to `BookingShell`; delete `slot-picker.tsx` | **Recommended** |

**Option C is recommended.** `BookingShell` already owns `selectedDate`, `selectedSlot`,
`refetchKey`, `showRaceLoser`, `raceLoserMessage`. Adding `slots`, `loading`, `fetchError` is
natural — it is the same state layer. The fetch logic in `slot-picker.tsx` is a single `useEffect`
with one `fetch()` call; lifting it adds ~20 lines to `booking-shell.tsx` and removes one
component file entirely. The Calendar and slot-time list then render as inline JSX in their
respective grid column positions.

### shadcn Components — Sufficiency Check

All components needed for the redesign are already installed and used in the current booker:

| Component | Current location | Status |
|-----------|-----------------|--------|
| `Calendar` (shadcn/ui) | `slot-picker.tsx` | Sufficient; no changes to component |
| `Button` | `booking-form.tsx` | Sufficient |
| `Input`, `Label`, `Textarea` | `booking-form.tsx` | Sufficient |
| `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` | `booking-form.tsx` | Sufficient |

No new shadcn components required. The redesign is a grid restructure + visibility toggle.

### Mobile Stack

Below `lg:` (i.e. `< 1024px`): no `grid-cols-*` applied = single column. DOM order determines
visual order. Required order: Calendar → Slot times → Form. This is the natural DOM order when
the three blocks are placed in order inside the single grid `div`. No additional ordering
classes needed.

The existing `justify-self-center` on the `Calendar` component (added in v1.3 PUB-13 for mobile
centering, per project memory) should be preserved. In a single-column grid on mobile, it will
continue to center the calendar correctly.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `supabase db push --linked` | Broken in this repo (orphan timestamps in remote tracking table) | `echo \| npx supabase db query --linked -f <file>` |
| `md:grid-cols-*` for booker layout | Breaks codebase `lg:`-only breakpoint convention | `lg:grid-cols-[auto_1fr_320px]` |
| `{selectedSlot && <BookingForm />}` conditional render | Collapses form column on hide, causing layout shift | Always-mounted `<BookingForm key={...}>` inside `invisible` wrapper |
| `hidden` class on form column | Removes from layout flow, same shift problem as above | `invisible pointer-events-none` |
| `bg-[${color}]` dynamic Tailwind (MP-04) | Purged at build time; not regenerated at runtime | Inline `style={{}}` for runtime color values — already the codebase pattern |
| ts-morph / jscodeshift for identifier rename | Zero camelCase identifiers to rename; AST tooling is overhead for 6-touch-site text replacement | IDE find-and-replace |
| DROP migration without 30-min drain | Stale Vercel instances still reading the column → 500 errors | CP-03 two-step protocol: code deploy first, drain, then DROP |

---

## Sources

All findings verified against live source files read on 2026-05-03 (HIGH confidence):

| Source | What Was Verified |
|--------|-------------------|
| `supabase/migrations/20260419120000_initial_schema.sql:35-36` | `buffer_before_minutes`, `buffer_after_minutes` already on `event_types` since day 0 |
| `supabase/migrations/20260425120000_account_availability_settings.sql` | `accounts.buffer_minutes` added Phase 4; this is what the engine reads today |
| `lib/slots.ts:277` | `account.buffer_minutes` passed to `slotConflictsWithBookings` |
| `lib/slots.types.ts:15` | `AccountSettings.buffer_minutes` field declaration |
| `app/api/slots/route.ts:89,121,160` | Full buffer read chain in the slots API |
| `app/(shell)/app/availability/_components/settings-panel.tsx:15,25,48,75,84` | All 5 UI touch sites for `buffer_minutes` |
| `app/(shell)/app/availability/_lib/actions.ts:64` | Server Action writes `buffer_minutes` |
| `app/(shell)/app/availability/_lib/queries.ts:53` | SELECT includes `buffer_minutes` |
| `app/(shell)/app/availability/_lib/schema.ts:135` | Zod schema declares `buffer_minutes` |
| `app/(shell)/app/availability/_lib/types.ts:24` | TypeScript type declares `buffer_minutes` |
| `app/(shell)/app/availability/page.tsx:50` | Page state uses `buffer_minutes` |
| `app/(shell)/app/event-types/_lib/types.ts:43-44` | `EventTypeRow` already has `buffer_before_minutes`, `buffer_after_minutes` |
| `app/(shell)/app/event-types/[id]/edit/page.tsx:18` | Edit page SELECT already includes `buffer_after_minutes` |
| `app/(auth)/_components/auth-hero.tsx:21,42` | 2 contractor copy touch sites |
| `app/[account]/[event-slug]/_components/booking-form.tsx:138` | 1 contractor comment-only touch site |
| `README.md:3`, `FUTURE_DIRECTIONS.md:62,226,232` | Documentation touch sites |
| `app/[account]/[event-slug]/_components/booking-shell.tsx:77` | Current `lg:grid-cols-[1fr_320px]` outer grid |
| `app/[account]/[event-slug]/_components/slot-picker.tsx:125` | Current `lg:grid-cols-2` inner grid |
| `supabase/migrations/20260502034300_v12_drop_deprecated_branding_columns.sql` | CP-03 DROP migration template (Phase 21 precedent) |
| `PROJECT.md §196-209` | Two-step DROP deploy protocol documentation |

---

*Stack research for: calendar-app v1.5 — Buffer Fix + Audience Rebrand + Booker Redesign*
*Researched: 2026-05-03*
