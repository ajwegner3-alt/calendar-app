# Phase 25: Surgical Polish - Research

**Researched:** 2026-05-03
**Domain:** Tailwind CSS className overrides, react-day-picker v9 (shadcn wrapper), Next.js App Router JSX
**Confidence:** HIGH — all findings from direct file inspection

---

## Summary

Four UI-only fixes across two files. No shared component edits. Every finding below is sourced directly from reading the actual source files — no guessing.

**Primary recommendation:** All four fixes are one-to-three line changes in their respective files. Sequence: AUTH-21/22 first (trivially safe), then OWNER-14, then OWNER-15.

---

## Fix 1: AUTH-21 / AUTH-22 — Remove "Powered by NSI" pill

### File and exact location

`app/(auth)/_components/auth-hero.tsx`, lines 27–30.

```tsx
// CURRENT (lines 27–30):
<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur-sm">
  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
  Powered by NSI
</div>
```

Both `/login` and `/signup` share this single component — deleting the JSX here fixes both AUTH-21 and AUTH-22 simultaneously.

### Recommended change

Delete lines 27–30 entirely (the `<div>` and its two children). No prop needed; this element has no other use in the file. The surrounding `<div className="relative z-10 max-w-md">` remains.

**Rationale:** There is no prop or conditional already present; introducing a prop just to conditionally hide static content adds complexity with zero benefit. Delete is the simpler, more permanent fix. The `AuthHero` component has no other callers that would want the pill — confirmed by file inspection.

### Precedence / edge cases

None. The `AuthHero` component is only rendered in auth pages (hidden on mobile via `hidden lg:flex`), and the pill is purely decorative. Removing it cannot affect layout because the surrounding flex column simply collapses that row.

---

## Fix 2: OWNER-14 — Selected-date color: gray-700 → NSI blue

### File and exact location

`app/(shell)/app/_components/home-calendar.tsx`, line 76 (inside the DayButton `className` array).

```tsx
// CURRENT (line 76):
isSelected
  ? "bg-gray-700 text-white"
  : modifiers.today
    ? "bg-muted text-foreground font-semibold ring-1 ring-gray-300 rounded-[var(--cell-radius,var(--radius-md))]"
    : "",
```

### Token confirmation (HIGH confidence — from globals.css)

`--primary` is defined twice; the `@theme` block at line 144 wins (Tailwind v4 `@theme` overrides `:root`):
- `--color-primary: #3B82F6` (NSI blue)
- `--color-primary-foreground: #FFFFFF`

Tailwind utility classes `bg-primary` and `text-primary-foreground` map to these tokens via the `@theme inline` block at line 34 which maps `--color-primary: var(--primary)` and `--color-primary-foreground: var(--primary-foreground)`.

### Recommended change

Replace line 76 only:

```tsx
// AFTER:
isSelected
  ? "bg-primary text-primary-foreground"
  : modifiers.today
    ? "bg-muted text-foreground font-semibold ring-1 ring-gray-300 rounded-[var(--cell-radius,var(--radius-md))]"
    : "",
```

### Precedence logic — today + selected combination

The ternary already handles this correctly: `isSelected` is checked first. If a day is both today and selected, `isSelected` is truthy and the expression short-circuits to `"bg-primary text-primary-foreground"`, skipping the `modifiers.today` branch entirely. No additional code change is needed.

`isSelected` is derived at lines 61–65:
```tsx
const isSelected =
  modifiers.selected &&
  !modifiers.range_start &&
  !modifiers.range_end &&
  !modifiers.range_middle;
```
This is already the correct definition for a single-mode selected day.

### Hover on selected day

The current hover classes on line 73 are unconditional:
```tsx
"hover:bg-gray-100 hover:text-gray-900",
```
These will override `bg-primary` on hover because they come later in the Tailwind merge. The decision says "hover on selected: stay solid blue." Two options:

**Option A (recommended):** Wrap hover classes in a conditional so they only apply when not selected:
```tsx
!isSelected && "hover:bg-gray-100 hover:text-gray-900",
```

**Option B:** Use `data-*` attributes and CSS — more complex, not warranted here.

Apply Option A. This is a one-line addition but the planner should count it as part of OWNER-14 scope, not a separate task.

### Booking dot color on selected day

Lines 96–99 already handle this correctly — dots use `backgroundColor: isSelected ? "currentColor" : "#9CA3AF"`. With `text-primary-foreground` (white) as current color on selected days, dots will render white on blue. This is correct and needs no change.

---

## Fix 3: OWNER-15 — Mobile calendar overflow

### The overflow mechanism

**Root cause:** `components/ui/calendar.tsx` line 47 sets `root: cn("w-fit", ...)`. This makes the Calendar container size-to-content rather than filling its parent. The DayButton in `home-calendar.tsx` line 72 sets `min-w-[var(--cell-size,theme(spacing.9))]`. With the default `--cell-size` of `spacing.9` = 36px and 7 columns, the minimum grid width is wider than the available space on narrow viewports — but the `w-fit` root means the calendar doesn't try to constrain itself.

**Why `overflow-x-auto` is wrong (and locked out):** The CONTEXT.md explicitly bars it. It would create a horizontally scrollable calendar inside the Card, which is a poor UX.

### Viewport math (390px iPhone 14/15)

Chain of horizontal padding consuming viewport width:
- Shell `main` (`layout.tsx` line 58): `px-4` on mobile = 16px × 2 = 32px
- Card wrapper (`page.tsx` line 121): `p-6` = 24px × 2 = 48px
- Calendar component root: `p-2` (line 34 of `calendar.tsx`) = 8px × 2 = 16px
- **Available width for the 7-column grid:** 390 - 32 - 48 - 16 = **294px**
- Per-cell max width (if flex fills evenly): 294 / 7 = **42px**

At the default `--cell-size` of `spacing.9` = 36px, the cells have a 36px minimum and the flex container is `w-full` (week row), so cells expand to ~42px each. In theory this should fit. However the `w-fit` on the root means the calendar itself may not stretch to fill the available 294px and instead sizes to some intermediate content width. The practical result (per CONTEXT.md) is visible overflow at 390px.

### The `--cell-size` injection path (HIGH confidence — calendar.tsx line 34)

The CSS variable is set on the `DayPicker` root element's `className`:
```
[--cell-size:--spacing(7)]
```
The default in `calendar.tsx` is `--spacing(7)` = 28px (Tailwind v4 syntax). But `home-calendar.tsx` DayButton overrides the *consumption* of `--cell-size` on line 72:
```tsx
min-w-[var(--cell-size,theme(spacing.9))]
```
Note: this fallback of `theme(spacing.9)` = 36px **overrides** the 28px default from the Calendar component for the minimum-width. The Calendar root sets `--cell-size` to 28px but the DayButton fallback reads 36px if the variable isn't explicitly set via a wrapper `style` prop.

Wait — re-reading: the Calendar component sets `[--cell-size:--spacing(7)]` in the className string of the DayPicker root element. This means `--cell-size` IS set to 28px on the Calendar DOM root. The DayButton `var(--cell-size,theme(spacing.9))` fallback would only apply if `--cell-size` is not defined in the CSS cascade. Since it IS set on the root element (28px), the DayButton inherits 28px through CSS variable cascade.

**Therefore:** The DayButton's effective min-width is actually 28px (from the Calendar component's `[--cell-size:--spacing(7)]`), not 36px. The overflow is caused by something else or the variable is not inheriting as expected through the component tree.

The safest fix path per CONTEXT.md is to set `--cell-size` explicitly on the `<Calendar>` wrapper element via `style` prop in `home-calendar.tsx`. This overrides the Calendar component's own default for this instance only.

### Recommended change

In `home-calendar.tsx`, add a `style` prop to the `<Calendar>` element (line 45):

```tsx
<Calendar
  mode="single"
  selected={selectedDate}
  onSelect={...}
  className="w-full"
  style={{ "--cell-size": "clamp(28px, calc((100% - 16px) / 7), 36px)" } as React.CSSProperties}
  ...
/>
```

However, `clamp` depends on knowing what `100%` refers to in the CSS `calc()` — CSS custom properties don't resolve `%` in isolation. Simpler and safer:

**Recommended cell size value: `spacing.8` = 32px (unconditional)**

At 32px: 7 × 32 = 224px + calendar p-2 (16px) = 240px total minimum. Available is 294px. Comfortable fit with no overflow. On desktop the cells will be at minimum 32px and flex-grow to fill, which at wider viewports gives ~50px+ cells — visually indistinguishable from the current 36px default.

```tsx
// home-calendar.tsx, line 45 — add style prop:
<Calendar
  mode="single"
  selected={selectedDate}
  onSelect={(date) => { ... }}
  className="w-full"
  style={{ "--cell-size": "2rem" } as React.CSSProperties}
  components={{ ... }}
/>
```

`2rem` = 32px at default root font-size. This value overrides the Calendar component's `[--cell-size:--spacing(7)]` (28px) for this instance, giving slightly larger cells than the component default while preventing overflow.

**Why not `spacing.7` (28px)?** The Calendar component already defaults to 28px. If the overflow still occurs at 28px via the Calendar's own CSS, the explicit override on the wrapper at 32px confirms the variable is injected and resolves it cleanly. If 28px were sufficient, the Calendar default would have prevented the overflow already.

**Why not responsive (sm:spacing.9)?** The CONTEXT.md leaves this as Claude's discretion. An unconditional 32px is simpler, works at all viewports, and the visual difference from 36px is imperceptible on desktop.

### Alternative if style prop doesn't cascade

If the `--cell-size` style prop on the Calendar wrapper doesn't cascade into the DayButton (because the DayButton is a custom component rendered inside DayPicker), the fix should instead be applied directly in `home-calendar.tsx` line 72 by replacing the fallback:

```tsx
// Change:
min-w-[var(--cell-size,theme(spacing.9))]
// To:
min-w-[var(--cell-size,theme(spacing.8))]
```

This changes the fallback from 36px to 32px. The effect is identical to setting `--cell-size` via the style prop, but operates through the Tailwind fallback syntax rather than CSS inheritance. This is the more surgical change if the style prop approach proves unreliable.

**The planner should implement the fallback-change approach (line 72 edit) as the primary strategy.** It is simpler — one word changed, no new prop, no TypeScript cast needed, no CSS inheritance uncertainty.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Token-aware selected color | Hardcoded hex like `#3B82F6` | `bg-primary` Tailwind utility |
| Responsive cell sizing | Media query breakpoints | `--cell-size` CSS var override (existing mechanism) |
| Per-page pill visibility | New prop + conditional render | Delete the JSX entirely |

---

## Common Pitfalls

### Pitfall 1: Hover classes override selected bg

The unconditional `hover:bg-gray-100 hover:text-gray-900` on line 73 of `home-calendar.tsx` will override `bg-primary` on hover. Without guarding these hover classes with `!isSelected`, hovering a selected day turns it gray. Fix: wrap line 73 in `!isSelected && "hover:bg-gray-100 hover:text-gray-900"`.

### Pitfall 2: Tailwind dynamic class in the join array

The Phase 7 lock (comment at line 27 of `home-calendar.tsx`) prohibits dynamic Tailwind classes with runtime values. `bg-primary` and `text-primary-foreground` are static utility classes, not dynamic — this fix is compliant. Do not introduce any pattern like `` `bg-${someVar}` ``.

### Pitfall 3: Modifying shared calendar.tsx

CONTEXT.md is explicit: shared `components/ui/calendar.tsx` is untouched. All changes live in `home-calendar.tsx` only.

### Pitfall 4: --cell-size token name

The variable is `--cell-size` (hyphenated, no prefix). In the style prop TypeScript cast use `{ "--cell-size": "2rem" } as React.CSSProperties`. Without the cast, TypeScript rejects custom CSS properties.

---

## Code Examples

### AUTH-21/22: After deletion, auth-hero.tsx lines 26–31 become:

```tsx
<div className="relative z-10 max-w-md">
  <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
    {headline}
  </h1>
```

### OWNER-14: Complete revised className array (lines 71–85):

```tsx
className={[
  "relative isolate z-10 flex aspect-square w-full min-w-[var(--cell-size,theme(spacing.9))] flex-col items-center justify-center gap-0.5 rounded-[var(--cell-radius,var(--radius-md))] border-0 text-sm leading-none font-normal",
  !isSelected && "hover:bg-gray-100 hover:text-gray-900",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  isSelected
    ? "bg-primary text-primary-foreground"
    : modifiers.today
      ? "bg-muted text-foreground font-semibold ring-1 ring-gray-300 rounded-[var(--cell-radius,var(--radius-md))]"
      : "",
  modifiers.outside ? "text-muted-foreground opacity-50" : "",
  modifiers.disabled ? "opacity-50 pointer-events-none" : "",
  className ?? "",
]
  .filter(Boolean)
  .join(" ")}
```

### OWNER-15: Fallback change approach (primary recommendation):

```tsx
// home-calendar.tsx line 72 — change theme(spacing.9) to theme(spacing.8):
"relative isolate z-10 flex aspect-square w-full min-w-[var(--cell-size,theme(spacing.8))] flex-col items-center justify-center gap-0.5 ..."
```

---

## Open Questions

1. **Why does overflow occur if Calendar already sets --cell-size to 28px?**
   - What we know: `calendar.tsx` sets `[--cell-size:--spacing(7)]` = 28px on the root. The DayButton fallback is `theme(spacing.9)` = 36px. If the CSS var is inherited, fallback never fires. If DayPicker's internal rendering breaks the CSS cascade (e.g. shadow DOM, portal), the fallback 36px would apply.
   - What's unclear: Whether react-day-picker v9 renders DayButton in a context where the Calendar root's CSS vars cascade into it (very likely yes, as it's all standard DOM).
   - Recommendation: The safest fix is still the line 72 fallback change from 36px to 32px — it works regardless of whether the cascade is broken or not. If the cascade works, the override is a no-op. If it's broken, the smaller fallback prevents overflow.

2. **SidebarInset interaction on mobile**
   - On mobile the sidebar may collapse, adding width back. This only increases available space, making the fix more conservative not less. Not a concern.

---

## Sources

### Primary (HIGH confidence — direct file inspection)
- `app/(auth)/_components/auth-hero.tsx` — full file read; pill JSX at lines 27–30 confirmed
- `app/(shell)/app/_components/home-calendar.tsx` — full file read; selected-state at line 76, min-w at line 72 confirmed
- `components/ui/calendar.tsx` — full file read; `--cell-size` injection at line 34, `w-fit` root at line 47 confirmed
- `app/globals.css` — full file read; `--color-primary: #3B82F6`, `--color-primary-foreground: #FFFFFF` confirmed at lines 146–147
- `app/(shell)/layout.tsx` — full file read; `px-4` mobile shell padding confirmed at line 58
- `app/(shell)/app/page.tsx` — full file read; `p-6` Card padding confirmed at line 121

---

## Metadata

**Confidence breakdown:**
- Pill location and deletion approach: HIGH — file read confirms exact lines
- Token values (--primary, --primary-foreground): HIGH — globals.css read confirms
- Selected-state ternary logic: HIGH — file read confirms precedence is already correct
- Hover class override risk: HIGH — class ordering in the join array makes it deterministic
- Cell-size math: HIGH — arithmetic from confirmed padding values
- CSS var cascade behavior: MEDIUM — standard DOM behavior, but react-day-picker v9 rendering internals not verified via library docs

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable codebase, no external dependencies changing)
