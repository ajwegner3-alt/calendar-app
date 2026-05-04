# Phase 30: Public Booker 3-Column Desktop Layout - Research

**Researched:** 2026-05-03
**Domain:** CSS grid restructure — `booking-shell.tsx` + `slot-picker.tsx`
**Confidence:** HIGH (all findings from live source files read directly; no training-data assertions)

---

## Summary

This phase is a pure layout restructure of two files. No new dependencies, no schema changes, no new components. The current booker uses two nested grid contexts — an outer 2-column grid in `booking-shell.tsx` with a `SlotPicker` in the left column (which itself has an inner `lg:grid-cols-2`), and a `BookingForm` in the right column. The target is a flat 3-column grid owned by `booking-shell.tsx`.

The central constraint is Turnstile lifecycle (V15-MP-05): `BookingForm` uses `@marsidev/react-turnstile` which initializes on mount. If `BookingForm` is always-mounted (to hold the form column's space), Turnstile fires on page load and the 2-minute token will expire before the user picks a slot. Therefore the form column placeholder must be a plain `<div>` — not a mounted `<BookingForm>` — and the form column space must be held by CSS, not by the form component itself.

The embed widget (`app/embed/[account]/[event-slug]/`) renders `BookingShell` directly inside `EmbedShell`. The embed's parent page wraps it in `<main className="mx-auto max-w-3xl">`. The `lg:` breakpoint will activate inside an iframe only if the iframe is wide enough (1024px+), which is atypical for embed usage (320–600px normal range). This means the `lg:` breakpoint guard provides automatic embed protection — but this must be verified, not assumed.

**Primary recommendation:** Flatten the nested grid by lifting slot-fetch state from `SlotPicker` into `BookingShell`. Render Calendar and slot list as direct grid children. Use `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]` with the form column always present as a fixed-320px slot. Placeholder div before slot pick; `BookingForm` mount on slot pick. Change `max-w-3xl` to `max-w-4xl` in the booking section (896px gives 3 columns comfortable space).

---

## Standard Stack

### No New Dependencies

All required capabilities exist in the currently installed stack.

| Capability | How It's Already Available |
|-----------|---------------------------|
| CSS grid with custom column templates | Tailwind v4 JIT; `lg:grid-cols-[auto_1fr_320px]` syntax already used in `booking-shell.tsx:77` |
| Calendar component | `@/components/ui/calendar` (shadcn/ui) — already imported in `slot-picker.tsx:6` |
| Visibility toggle | Tailwind `invisible` utility — zero layout shift, element stays in flow |
| Conditional rendering | React `{selectedSlot ? ... : ...}` — current pattern |

**Installation:** No new packages required.

---

## Architecture Patterns

### Current File Structure (What Exists Today)

**`app/[account]/[event-slug]/_components/booking-shell.tsx`** — 112 lines

- Owns all interaction state: `bookerTz`, `selectedDate`, `selectedSlot`, `refetchKey`, `showRaceLoser`, `raceLoserMessage`
- Outer grid at line 77: `<div className="grid gap-8 p-6 lg:grid-cols-[1fr_320px]">`
- `<SlotPicker>` in left column (lines 79–89), `<BookingForm>` conditionally in right column (lines 93–100)
- Current conditional: `{selectedSlot ? <BookingForm .../> : <p>Pick a time on the left to continue.</p>}`
- Card wrapper at line 76: `<div className="mt-4 rounded-2xl border bg-white shadow-sm">`
- Card is inside `<section className="mx-auto max-w-3xl px-6 pb-12 md:pb-20">` (lines 73–74) — **max-w-3xl (768px) must change to max-w-4xl (896px) for 3 columns to breathe**

**`app/[account]/[event-slug]/_components/slot-picker.tsx`** — 198 lines

- Internal state: `slots`, `loading`, `fetchError` (lines 35–37)
- Fetch logic: single `useEffect` at lines 51–79, deps: `[props.eventTypeId, rangeFrom, rangeTo, props.refetchKey]`
- Internal grid at line 125: `<div className="grid gap-6 lg:grid-cols-2">` — **this is what must be dissolved**
- Calendar at lines 127–144 with `className="justify-self-center rounded-md border"` — **preserve `justify-self-center`**
- Slot buttons at lines 169–191 with selected-state styling (lines 173–178)
- Timezone hint at lines 122–124: `<p className="text-xs text-muted-foreground mb-3">Times shown in {props.bookerTimezone}</p>` — **currently first element in SlotPicker JSX**
- Empty-state early return at lines 99–118 (renders a standalone card when no slots exist) — **must be handled in the new flat architecture**

### Recommended Architecture: Flatten to One Grid Context

**Option C (STACK.md recommendation, confirmed here):** Lift `slots`, `loading`, `fetchError`, `slotsByDate` state and the fetch `useEffect` from `SlotPicker` up to `BookingShell`. Delete or gut `slot-picker.tsx`. Render `<Calendar>` and the slot-time list as direct children of the 3-column grid in `BookingShell`.

This eliminates the nested grid problem entirely. `BookingShell` becomes the single grid owner and places all three content blocks in named columns.

### Recommended Project Structure After This Phase

```
app/[account]/[event-slug]/_components/
├── booking-shell.tsx   # MODIFIED — owns 3-col grid + all state including slots fetch
├── booking-form.tsx    # UNCHANGED
├── slot-picker.tsx     # GUTTED or DELETED — Calendar + slot list inline in shell
└── race-loser-banner.tsx  # UNCHANGED
```

### Pattern 1: Flat 3-Column Grid in `booking-shell.tsx`

**What:** Single `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]` grid with Calendar in col 1, slot list in col 2, form/placeholder in col 3.

**When to use:** Desktop widths ≥1024px (`lg:` breakpoint). Mobile falls back to natural single-column DOM order.

**Grid template reasoning:**
- `minmax(280px,auto)` for Calendar: shadcn Calendar's minimum usable width is ~280px (cell size × 7 days + padding). `auto` lets it expand if the card is very wide.
- `minmax(160px,auto)` for slot list: time labels ("9:00 AM") need ~120px minimum; `160px` gives comfortable padding. `auto` allows it to grow.
- `320px` for form column: matches the existing `1fr_320px` convention in the current shell. Fixed width guarantees zero layout shift when form is revealed — the column is always 320px wide regardless of whether it holds a placeholder or the form.

```tsx
// Source: booking-shell.tsx (target state)
<div className="grid gap-6 p-6 lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]">
  {/* Col 1: Calendar */}
  <Calendar ... className="justify-self-center rounded-md border" />

  {/* Col 2: Slot time list */}
  <div>
    {/* loading/error/empty/slots UI */}
  </div>

  {/* Col 3: Form placeholder or BookingForm — 320px always reserved */}
  <aside>
    {selectedSlot ? (
      <BookingForm
        key={selectedSlot.start_at}  // forces remount on slot change
        ...
      />
    ) : (
      <div className="text-sm text-muted-foreground">
        Pick a time on the left to continue.
      </div>
    )}
  </aside>
</div>
```

**Why `{selectedSlot ? <BookingForm> : <div>}` and NOT `invisible`:**

CONTEXT.md locks this as a placeholder `<div>`, NOT a mounted `<BookingForm>` (V15-MP-05 Turnstile lifecycle lock). The STACK.md research suggested `invisible` with an always-mounted form, but that approach causes Turnstile to fire on page load. The correct pattern is conditional mount with a `<div>` placeholder that visually holds the column space. Since the form column is fixed at `320px` in the grid template, the column width is guaranteed even when the `<div>` placeholder is mounted — no layout shift occurs.

### Pattern 2: Timezone Hint Placement

**Current location:** `slot-picker.tsx:122-124`, renders as first element in the `SlotPicker` return — above the `lg:grid-cols-2` sub-grid.

**CONTEXT.md:** Claude's discretion — full-width banner above the 3-col grid (V15-MP-04 preference) vs. top-of-middle-column header.

**Recommendation:** Move it above the 3-column grid as a full-width element in `BookingShell`, consistent with V15-MP-04 preference cited in PITFALLS.md. It applies semantically to the times column but is better discovered by users before they start interacting.

```tsx
{/* Full-width timezone hint above grid */}
<p className="text-xs text-muted-foreground mb-3">
  Times shown in {bookerTz}
</p>
<div className="grid gap-6 p-6 lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]">
  ...
</div>
```

### Pattern 3: Mobile Stack

Below `lg:` (< 1024px): no grid-cols-* applied = single column. DOM order determines visual order. Required order: Calendar → slot list → form. This is the natural DOM order when children are placed in order inside the grid div. No ordering classes needed.

The existing `justify-self-center` on the Calendar (added in v1.3 for mobile centering) continues to work in single-column grid context — verified by the project memory note that `justify-self-center` is the canonical grid-item alignment property.

### Anti-Patterns to Avoid

- **`{selectedSlot && <BookingForm />}` in the aside** — the `&&` pattern removes the element entirely from the DOM, collapsing the 320px grid column. Use `{selectedSlot ? <BookingForm> : <div>}` instead so the aside always occupies the column.
- **`hidden` class on form column** — `display: none` removes from layout flow, same column-collapse problem.
- **`invisible` + always-mounted `<BookingForm>`** — avoids layout shift but violates Turnstile lifecycle lock (V15-MP-05). Token fires on page load.
- **`lg:grid-cols-3` (equal thirds)** — gives calendar ~30% of card width (~267px at max-w-4xl=896px), which is fine, but less intentional than the template that reflects actual content widths.
- **Keeping `slot-picker.tsx`'s internal `lg:grid-cols-2` while spanning `col-span-2`** — simpler refactor but leaves a nested grid context. Either approach works; STACK.md recommends the full lift for cleanliness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fixed-width form column | CSS tricks (min-width on parent, etc.) | Fixed `320px` in grid template | Grid template guarantees column width regardless of child content |
| Column-width reservation without form mount | Always-mounted invisible form | `{selectedSlot ? <BookingForm> : <div>}` with fixed grid column | Turnstile token expiry risk with always-mount; grid column holds space regardless |
| Mobile stack ordering | CSS `order:` property | Natural DOM order | CSS `order` breaks keyboard tab order (accessibility violation) |
| Calendar width | Explicit `width: 280px` wrapper | `justify-self-center` + `minmax(280px,auto)` column | shadcn Calendar sizes to content; constraining with a wrapper breaks its internal layout |

---

## Common Pitfalls

### Pitfall 1: Turnstile Token Expiry (V15-MP-05) — CRITICAL

**What goes wrong:** If `<BookingForm>` is always mounted (to hold column space), Turnstile initializes on page load. Cloudflare Turnstile tokens have a ~2-minute validity window. If the user spends more than 2 minutes picking a date and time before seeing the form, `turnstileRef.current?.getResponse()` returns `""` and the submit fails with "Please wait for the security check to complete."

**Why it happens:** `@marsidev/react-turnstile` calls the Cloudflare challenge API on mount. There is no "delayed init" option — mounting the component starts the challenge.

**How to avoid:** Keep the current conditional-mount pattern. The form column placeholder is a `<div>`, not `<BookingForm>`. The 320px column width is guaranteed by the grid template, not by having a wide element in the column.

**Warning signs:** If you see `turnstileRef.current?.getResponse()` returning `""` in the 3-column layout, it means `BookingForm` is being mounted before slot selection.

### Pitfall 2: max-w-3xl Too Narrow for 3 Columns (V15-mp-03)

**What goes wrong:** The current `max-w-3xl` (768px) barely fits 3 columns at minimum widths: `280px (calendar) + gap + 160px (times) + gap + 320px (form)` = 760px + 2×24px gaps = ~808px. At exactly 768px the columns would be at their absolute minimum and would feel cramped.

**How to avoid:** Change `max-w-3xl` to `max-w-4xl` (896px) in the `<section>` wrapper at `booking-shell.tsx:74`. The header at line 62 is separately set to `max-w-3xl` — it can stay narrow (centered title/subtitle looks better narrower than the card).

**Warning signs:** Horizontal overflow or cramped columns at 1024px viewport width.

### Pitfall 3: Selected-Slot State Persists Across Slot Changes

**What goes wrong:** CONTEXT.md locks "selected slot stays visually highlighted in the middle column while the form is mounted." The current selected-state styling in `slot-picker.tsx:173-178` is already decoupled from the "form mounted" state — it depends only on `props.selectedSlot?.start_at === s.start_at`. When state is lifted to `BookingShell`, the `selectedSlot` state prop is passed straight down to wherever the slot buttons render. No change to the button className logic is needed — it already works correctly for this case.

**How to avoid:** When lifting state, pass `selectedSlot` as a prop to whatever renders the slot buttons. The className comparison `props.selectedSlot?.start_at === s.start_at` remains unchanged.

### Pitfall 4: Empty-State Early Return in slot-picker.tsx

**What goes wrong:** `slot-picker.tsx:99-118` has an early return that renders a standalone `rounded-lg border p-8` card when no slots exist at all (`isCompletelyEmpty`). In the current 2-column layout this card spans the entire left column. In the flat 3-column layout, if this early return remains in a child component, it would render a bordered card inside the calendar column only — incorrect.

**How to avoid:** When lifting state to `BookingShell`, the `isCompletelyEmpty` condition must be handled at the `BookingShell` level, rendering the empty-state message either above the grid or spanning all 3 columns (`col-span-3`).

### Pitfall 5: Embed Widget at Narrow Widths (V15-CP-11)

**What goes wrong:** `embed-shell.tsx` renders `<BookingShell account={account} eventType={eventType} />` directly. The `lg:` breakpoint will only activate if the iframe is ≥1024px wide. Since most embed contexts use 320–600px iframes, the `lg:` 3-column grid will NOT activate in typical embed usage — single-column behavior is automatic.

However, the embed's outer page at `app/embed/[account]/[event-slug]/page.tsx:63` wraps EmbedShell in `<main className="mx-auto max-w-3xl">`. If `BookingShell`'s section is changed to `max-w-4xl`, this has no effect on the embed because the embed page's own `max-w-3xl` outer wrapper constrains width. The embed path is safe.

**Warning signs to check:** Load the embed URL at 1280px viewport width. If the iframe is not constrained to a narrow width by the parent page's iframe CSS, the 3-column grid COULD activate inside the embed. Verify the embed `widget.js` or embedding HTML sets a max-width of <1024px on the iframe.

### Pitfall 6: `RaceLoserBanner` and `bookerTz` After Slot Lift

**What goes wrong:** When `slots`, `loading`, `fetchError`, `slotsByDate` are lifted to `BookingShell`, the `bookerTz` value is already in `BookingShell` state (line 17). The fetch effect in `slot-picker.tsx` uses `props.bookerTimezone` — in the lifted version this becomes the local `bookerTz` state directly. The `rangeFrom`/`rangeTo` computation uses `bookerTimezone` — this must move to `BookingShell` as well or be passed correctly.

---

## Code Examples

### Selected-Slot Button Styling (Current — Preserve Exactly)

```tsx
// Source: slot-picker.tsx:173-178 — DO NOT CHANGE
className={
  "w-full rounded-md border px-3 py-2 text-sm text-left font-medium transition-colors " +
  (isSelected
    ? "bg-primary text-primary-foreground border-primary"
    : "bg-background hover:bg-muted border-border")
}
```

`isSelected` is `props.selectedSlot?.start_at === s.start_at`. This is decoupled from form-mount state — it persists correctly across the form-reveal transition.

### Current Conditional-Mount Pattern (Keep, Augment)

```tsx
// Source: booking-shell.tsx:92-106 — current pattern
<aside className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
  {selectedSlot ? (
    <BookingForm
      accountSlug={account.slug}
      eventType={eventType}
      selectedSlot={selectedSlot}
      bookerTimezone={bookerTz}
      onRaceLoss={handleRaceLoss}
    />
  ) : (
    <p className="text-sm text-muted-foreground">
      Pick a time on the left to continue.
    </p>
  )}
</aside>
```

In the 3-column layout the `border-t` / `border-l` responsive border logic is removed (CONTEXT.md: no dividers). The `key` prop on `<BookingForm>` should be added for re-pick reset: `key={selectedSlot.start_at}`.

### Codebase Breakpoint Convention

```tsx
// Source: booking-shell.tsx:77 — existing syntax, same pattern to reuse
className="grid gap-8 p-6 lg:grid-cols-[1fr_320px]"

// Target (Phase 30):
className="grid gap-6 p-6 lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]"
```

Tailwind v4 bracket syntax is already in use in this file. No `tailwind.config.*` change needed.

---

## State of the Art

| Old Approach | Current (Before Phase 30) | Phase 30 Target | Impact |
|--------------|--------------------------|-----------------|--------|
| Nested grid: outer `[1fr_320px]` + inner `[lg:grid-cols-2]` | Two grid contexts, SlotPicker owns calendar+times | Single flat grid, BookingShell owns all 3 columns | Eliminates column-width distribution bugs |
| `max-w-3xl` (768px) booking card | Works for 2-column | `max-w-4xl` (896px) — fits 3 columns comfortably | More card width at desktop |
| Conditional `{selectedSlot && <BookingForm>}` form | Form appears/disappears with layout shift | `{selectedSlot ? <BookingForm> : <div>}` + fixed grid column | Zero layout shift |
| Timezone hint inside SlotPicker | Top of left panel | Full-width above the 3-column grid | More visible before interaction |

---

## Open Questions

1. **Re-pick form reset behavior (Claude's discretion)**
   - What we know: `BookingForm` uses RHF `useForm` with `defaultValues`. A `key={selectedSlot.start_at}` prop on `<BookingForm>` forces remount on slot change, which resets all form state cleanly.
   - Recommendation: Use `key={selectedSlot.start_at}` (standard RHF reset pattern). This is "lowest friction" — user picks a new time, form clears, they re-enter. No "Change time" link needed.

2. **Form column header (Claude's discretion)**
   - What we know: The form already has "Name / Email / Phone" labels. Adding a "Booking [time], [date]" header duplicates information visible in the middle column (highlighted slot).
   - Recommendation: No header. The selected-slot highlight in the times column is the spatial anchor per CONTEXT.md decisions.

3. **Per-column headings (Claude's discretion)**
   - Recommendation: None. "Date / Time / Your details" micro-labels add visual noise to what should feel like one seamless surface (CONTEXT.md "seamless single card" lock).

4. **Prompt-to-form transition (Claude's discretion)**
   - Recommendation: Instant swap (no animation). Any fade/slide requires `transition` classes and potentially `opacity-0` → `opacity-100` state, which adds complexity for marginal UX benefit in a column the user just clicked toward.

---

## Sources

### Primary (HIGH confidence)

All findings verified against live source files read on 2026-05-03:

| Source | Lines | What Was Verified |
|--------|-------|-------------------|
| `app/[account]/[event-slug]/_components/booking-shell.tsx` | 1–112 | Full file — grid classes, max-w, conditional mount, state inventory |
| `app/[account]/[event-slug]/_components/slot-picker.tsx` | 1–198 | Full file — internal grid, timezone hint location, selected-slot styling, empty-state early return |
| `app/[account]/[event-slug]/_components/booking-form.tsx` | 1–392 | Full file — Turnstile mount pattern, `key` prop absence, RHF init |
| `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` | 1–117 | Full file — `<BookingShell>` direct render, no variant prop |
| `app/embed/[account]/[event-slug]/page.tsx` | 1–72 | Embed page `max-w-3xl` outer wrapper |
| `.planning/research/STACK.md` (Feature 3 section) | Lines 209–345 | All booker redesign findings from previous research cycle |
| `.planning/research/PITFALLS.md` | V15-CP-10, V15-CP-11, V15-MP-04, V15-MP-05, V15-MP-06, V15-MP-07, V15-mp-02, V15-mp-03 | All booker-specific pitfalls |

### Secondary (MEDIUM confidence)

- `tests/shell-render.test.tsx` — verified no layout-shift tests exist (test is a TooltipProvider regression guard only); no E2E or Playwright tests found in project
- `tests/` directory scan — 28 test files; none test booker layout, viewport widths, or form column visibility

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read all relevant source files directly
- Architecture (flatten approach): HIGH — verified both current file structure and all state/prop flow
- Turnstile lifecycle constraint: HIGH — read booking-form.tsx fully; Turnstile mounts on component mount with no delay option
- Embed isolation: HIGH — embed renders `<BookingShell>` directly; `lg:` breakpoint provides automatic protection at typical iframe widths
- Selected-slot persistence: HIGH — styling is purely prop-comparison, not tied to form mount
- Claude's discretion items (headers, animation, re-pick): MEDIUM — recommendations based on stated CONTEXT.md constraints, no external verification needed

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable codebase, no fast-moving dependencies)
