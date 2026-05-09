# Phase 39: BOOKER Polish - Research

**Researched:** 2026-05-08
**Domain:** Public booker UI — animation, skeleton, Turnstile lifecycle lock, CLS
**Confidence:** HIGH (all findings from direct codebase inspection + installed package inspection)

---

## Summary

Phase 39 is a pure UI polish pass on `booking-shell.tsx` — the single client component that owns the three-column booker layout (calendar | slot list | form column). No new libraries are needed: `tw-animate-css` v1.4.0 is already installed and imported in `globals.css`, and the shadcn `Skeleton` primitive already exists at `components/ui/skeleton.tsx`.

The critical pre-existing issue the planner must address first: `BookingForm` currently carries `key={selectedSlot.start_at}` (line 258 of `booking-shell.tsx`), which forces React to unmount and remount the form — including the Turnstile widget — on every slot re-pick. This violates both the V15-MP-05 Turnstile lifecycle lock AND the Phase 39 field-value-persistence guarantee. Removing that `key` prop is the single most important change in this phase.

The rest of the work follows naturally: replace the bare `<div>Pick a time on the left to continue</div>` placeholder with a proper `BookingFormSkeleton` component, add an `animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out` entry animation to the form column wrapper on first mount, and wrap both in a `@media (prefers-reduced-motion: reduce)` CSS override that removes the animation. Mobile behavior uses the existing stacked grid (no `lg:` prefix on col 3) and the skeleton occupies the same grid cell at all viewport widths.

**Primary recommendation:** Remove `key={selectedSlot.start_at}` from `BookingForm`, add a `BookingFormSkeleton` component using the existing `Skeleton` primitive, apply `tw-animate-css` entry classes to the form wrapper div, and use `@media (prefers-reduced-motion: reduce)` in `globals.css` to nullify the animation. No new npm installs required.

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tw-animate-css` | 1.4.0 | CSS-first enter/exit animation utilities for Tailwind v4 | Already in `globals.css` via `@import "tw-animate-css"` |
| shadcn `Skeleton` | via shadcn | Shape-only loading placeholder | Already at `components/ui/skeleton.tsx`, already used in `app/(shell)` loading skeletons |
| Tailwind CSS | 4.2.2 | Utility classes including `motion-reduce:` variant | Core framework |
| React 19 | 19.2.5 | Component mounting lifecycle | Core framework |

### No New Libraries Needed

Everything required exists. Do not add Framer Motion, `react-spring`, or any other animation library. The project has no Framer Motion and uses pure CSS/Tailwind for all animations.

---

## Architecture Patterns

### File Structure: Where Changes Land

```
app/[account]/[event-slug]/_components/
├── booking-shell.tsx          ← PRIMARY file — all layout changes here
├── booking-form.tsx           ← key prop removal only; form itself untouched
├── booking-form-skeleton.tsx  ← NEW file — the skeleton placeholder component
└── slot-picker.tsx            ← NOT used by booking-shell; ignore for this phase
```

**Important:** `slot-picker.tsx` exists but is a dead file — `booking-shell.tsx` has fully inlined the calendar + slot list logic and does NOT import `SlotPicker`. Do not edit `slot-picker.tsx`.

**Important:** `app/globals.css` will need a `@media (prefers-reduced-motion: reduce)` rule if the animation is applied via a custom CSS class rather than Tailwind's `motion-reduce:` variant. See Reduced-Motion section below.

### Pattern 1: Current Conditional Mount (as-is)

```tsx
// booking-shell.tsx lines 255-270 (current code)
<div>
  {selectedSlot ? (
    <BookingForm
      key={selectedSlot.start_at}   // ← PROBLEM: forces remount on re-pick
      accountSlug={account.slug}
      eventType={eventType}
      selectedSlot={selectedSlot}
      bookerTimezone={bookerTz}
      onRaceLoss={handleRaceLoss}
    />
  ) : (
    <div className="text-sm text-muted-foreground">
      Pick a time on the left to continue.
    </div>
  )}
</div>
```

### Pattern 2: Target State (after Phase 39)

```tsx
// Phase 39 target
<div>
  {selectedSlot ? (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out motion-reduce:animate-none">
      <BookingForm
        // key prop REMOVED — no remount on re-pick
        accountSlug={account.slug}
        eventType={eventType}
        selectedSlot={selectedSlot}
        bookerTimezone={bookerTz}
        onRaceLoss={handleRaceLoss}
      />
    </div>
  ) : (
    <BookingFormSkeleton />
  )}
</div>
```

**Notes on the wrapper div:**
- The `animate-in` wrapper is a new div — do NOT put animation classes directly on `BookingForm` (that component doesn't control its own entry).
- `slide-in-from-bottom-2` translates Y from `2 * 4px = 8px` downward — but `tw-animate-css` uses `--tw-enter-translate-y`. The `slide-in-from-bottom-*` utility sets `--tw-enter-translate-y` to a positive value (moves from below). For an "upward rise" (form rises up into place), use `slide-in-from-bottom-2` which is the correct semantic: element slides in from 8px below its final position.
- `motion-reduce:animate-none` is a Tailwind v4 variant that suppresses all animation when `prefers-reduced-motion: reduce` matches. Verify this variant works with `tw-animate-css`'s `animate-in` class (see Pitfalls section).

### Pattern 3: BookingFormSkeleton Component

The skeleton should live in a new file `booking-form-skeleton.tsx` in the same `_components/` folder.

Reference: `app/(shell)/app/availability/loading.tsx` shows the established pattern for using `Skeleton` in this codebase:

```tsx
// availability/loading.tsx — reference pattern
import { Skeleton } from "@/components/ui/skeleton";
// Skeleton renders: <div data-slot="skeleton" className="animate-pulse rounded-md bg-muted {className}" />
```

The `Skeleton` component uses `animate-pulse` (Tailwind core). Per the CONTEXT.md decision, static (no-pulse) is preferred because pulse reads as "system is loading" — we are waiting on user input, not loading. The planner must decide: override the pulse in `BookingFormSkeleton` by not using the `Skeleton` component directly but instead rendering static divs with the same `rounded-md bg-muted` classes, OR accept the pulse but wrap in `motion-reduce:` to kill it for RM users.

**Recommended approach:** Use the `Skeleton` component (established pattern) but wrap all `Skeleton` instances inside `BookingFormSkeleton` in a `[&_.animate-pulse]:animate-none` parent div, OR pass a className override. This keeps the visual rhythm while supporting the "lean static" CONTEXT.md recommendation. Alternatively, create static-only block divs with `bg-muted rounded-md` — simpler and aligns with CONTEXT.md.

### Pattern 4: The V15-MP-05 Fix (key prop removal)

The current `key={selectedSlot.start_at}` was added to "force RHF reset on slot change" (per comment in code). After removing it:

1. React will NOT remount `BookingForm` when `selectedSlot` changes — the component stays alive.
2. The `selectedSlot` prop passed to `BookingForm` will update in-place — React re-renders the component with the new prop.
3. RHF field values (name, email, phone, answers) persist because `useForm` state lives inside the component instance and is not reset by prop changes.
4. The Turnstile widget stays mounted; its token remains valid.
5. The displayed slot label inside the form will update because `props.selectedSlot` changes — as long as `BookingForm` renders it (currently it uses `props.selectedSlot.start_at` in the submit body, but does NOT display the selected slot time visually in the current code — so there is nothing to "update").

**Verification of no visible slot label in form:** Reading `booking-form.tsx` — the form renders Name, Email, Phone, custom questions, Turnstile, and a submit button. There is NO rendered display of `selectedSlot.start_at` or time label in the form UI. Therefore removing `key` has zero visible UI regression — the only change is that field values now persist.

### Pattern 5: CLS = 0.0 Guarantee

The current grid defines col 3 as `320px` fixed: `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]`. This means col 3 is always 320px wide on desktop regardless of content.

**Mobile:** On mobile (`< lg` breakpoint), the grid has no `lg:` prefix columns, so it collapses to a single column stack. The `<div>` wrapping the form column takes full width. Currently it renders either `BookingForm` or the plain text placeholder. After Phase 39, it will render either the animated form or `BookingFormSkeleton`.

For CLS = 0.0, the skeleton must approximate the form's height so the document height does not change when the form mounts. On desktop the 320px column width is fixed, so only height matters. The form height is determined by: name field + email field + phone field + [custom questions] + Turnstile widget + submit button.

Since custom questions are variable, exact height matching is not possible for all event types. The skeleton should represent the standard-question form (3 fields + Turnstile + button) with enough blocks to approximate the most common height. The transition from skeleton to form inside the same grid cell ensures zero width shift; height shift is the only risk.

The animation itself (`transform`/`opacity` only, no `height`/`width`) does not cause layout shift per the Success Criteria.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS enter animation | Custom `@keyframes` in globals.css | `tw-animate-css` `animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out` | Already installed, Tailwind-idiomatic, tree-shaken |
| Skeleton placeholder | Custom CSS pulsing div | `components/ui/skeleton.tsx` (`Skeleton`) | Established project pattern, matches shadcn conventions |
| Reduced-motion detection | JS `matchMedia` hook | CSS `@media (prefers-reduced-motion: reduce)` or Tailwind `motion-reduce:` variant | Pure CSS is sufficient; no component unmount needed |
| Form state persistence | Copying RHF values before unmount | Remove `key` prop so component never unmounts | Simplest correct solution |

---

## Common Pitfalls

### Pitfall 1: key={selectedSlot.start_at} Silently Breaks Everything
**What goes wrong:** Keeping `key={selectedSlot.start_at}` means React destroys and recreates `BookingForm` on every slot re-pick. The Turnstile widget re-initializes (losing the validated token), field values reset to empty, and the "mount once" Turnstile lifecycle lock from V15-MP-05 is violated.
**Why it happens:** The key prop was originally added to reset RHF state on slot change (preventing stale slot data in submitted forms). It is now in direct conflict with Phase 39's field-persistence guarantee.
**How to avoid:** Remove `key={selectedSlot.start_at}` from `<BookingForm>`. RHF does not reset on prop changes — only on explicit `form.reset()` calls or remount. The slot change is reflected in `props.selectedSlot` passed to the component; the form reads this at submit time.
**Warning signs:** React DevTools shows `BookingForm` disappearing and reappearing in the component tree when a user clicks a different slot. Turnstile widget flashes/reloads on re-pick.

### Pitfall 2: animation-duration Syntax in Tailwind v4
**What goes wrong:** Using `duration-220` in Tailwind v4 — Tailwind's `duration-*` utilities in v4 expect named scale values (`duration-200`, `duration-300`) or arbitrary values (`duration-[220ms]`). `duration-220` is NOT a valid scale value.
**How to avoid:** Use `duration-[220ms]` (arbitrary value bracket syntax) for exact 220ms duration. `duration-200` is close (200ms) and may be acceptable given the 200-250ms target range.

### Pitfall 3: motion-reduce: Variant vs. @media in globals.css
**What goes wrong:** `tw-animate-css` provides `animate-in` as a CSS utility. Tailwind v4's `motion-reduce:` variant applies `@media (prefers-reduced-motion: reduce)` rules. However, `animate-none` may not fully cancel a `tw-animate-css` `animate-in` if the `--tw-animation-duration` CSS custom property is still set.
**How to avoid:** Test `motion-reduce:animate-none` in the browser with OS reduced-motion enabled. If it does not fully cancel the animation, add an explicit override in `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-in {
    animation: none !important;
  }
}
```
This is a safe fallback. The `Skeleton` primitive's `animate-pulse` also needs a reduced-motion override: `motion-reduce:animate-none` on each `<Skeleton>` instance, or a global rule `.animate-pulse { @media (prefers-reduced-motion: reduce) { animation: none; } }`.

### Pitfall 4: EmbedShell Uses BookingShell
**What goes wrong:** `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` imports and renders `<BookingShell>` directly. Any changes to `booking-shell.tsx` automatically apply to the embedded widget surface.
**Why it matters:** The `EmbedHeightReporter` measures `document.scrollHeight` and reports it to the parent iframe. If the skeleton is taller than the placeholder text, the iframe will resize on first paint. If the form is taller than the skeleton, the iframe will resize again on slot pick.
**How to avoid:** Embed is out of scope for Phase 39. Accept that embed behavior changes alongside the public booker. Do NOT add embed-specific conditional logic to `BookingShell`. The skeleton height matching (Pitfall 5) reduces iframe resize frequency on embed as a side effect.

### Pitfall 5: Skeleton Height Mismatch Causing CLS on Mobile
**What goes wrong:** On mobile (stacked layout), if `BookingFormSkeleton` is shorter than `BookingForm`, the page will reflow when the form mounts, causing CLS > 0.
**How to avoid:** Build the skeleton to approximate the minimum form height (3 standard fields + Turnstile approximation + button). The Turnstile widget itself is ~65px tall. Budget: name label + input (~56px) + email label + input (~56px) + phone label + input (~56px) + Turnstile (~65px) + button (~40px) + gaps = ~330px. The skeleton should be at least this tall. Use `space-y-4` to match the form's `space-y-4` gap.

### Pitfall 6: Slot Label in Form Not Updated on Re-pick
**What goes wrong:** If `BookingForm` displayed the slot time label visually, removing `key` would leave a stale label on re-pick. Developers might re-add `key` to fix visual staleness.
**Why it's a non-issue here:** The current `booking-form.tsx` does NOT render `selectedSlot.start_at` or any time label in the form body. The slot data is only used at submit time (`props.selectedSlot.start_at`, `props.selectedSlot.end_at`). Therefore removing `key` causes zero visual regression. Confirm this remains true — do not add a visible slot label in this phase.

### Pitfall 7: tw-animate-css animate-in Only Fires on Mount
**What goes wrong:** `tw-animate-css` `animate-in` triggers the CSS `enter` keyframe once when the element first appears in the DOM. It does NOT re-trigger if the element's classes change or if parent state updates.
**Why this is correct behavior:** We WANT the animation to fire only on first mount (first slot pick). Re-picks should NOT re-animate (per CONTEXT.md decision). This is naturally handled by keeping `BookingForm` mounted — the animation wrapper div stays in the DOM and does not re-run the animation.
**If you need the animation to re-fire:** Do NOT use `key` on the animation wrapper div (same Turnstile problem). Instead, toggle a CSS class using React state — but per CONTEXT.md no re-animation is desired.

---

## Code Examples

### Entry Animation (Tailwind + tw-animate-css)

```tsx
// Source: tw-animate-css README + globals.css @import "tw-animate-css"
// The wrapper div animates in; BookingForm stays mounted across re-picks.
<div className="animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out motion-reduce:animate-none">
  <BookingForm
    // NO key prop
    accountSlug={account.slug}
    eventType={eventType}
    selectedSlot={selectedSlot}
    bookerTimezone={bookerTz}
    onRaceLoss={handleRaceLoss}
  />
</div>
```

**How tw-animate-css `animate-in` works:**
- `animate-in` applies the `enter` CSS animation (keyframe from `--tw-enter-opacity`/`--tw-enter-translate-y` to defaults).
- `fade-in` sets `--tw-enter-opacity: 0` (starts transparent).
- `slide-in-from-bottom-2` sets `--tw-enter-translate-y` to `2 * spacing = 8px` (starts 8px below final position).
- `duration-[220ms]` sets `animation-duration` to 220ms.
- `ease-out` sets `animation-timing-function: ease-out`.
- `motion-reduce:animate-none` disables the animation under `prefers-reduced-motion: reduce`.

### Skeleton Component (new file)

```tsx
// app/[account]/[event-slug]/_components/booking-form-skeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

export function BookingFormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {/* Name field */}
      <div className="space-y-1">
        <Skeleton className="h-4 w-16 motion-reduce:animate-none" />
        <Skeleton className="h-9 w-full motion-reduce:animate-none" />
      </div>
      {/* Email field */}
      <div className="space-y-1">
        <Skeleton className="h-4 w-12 motion-reduce:animate-none" />
        <Skeleton className="h-9 w-full motion-reduce:animate-none" />
      </div>
      {/* Phone field */}
      <div className="space-y-1">
        <Skeleton className="h-4 w-14 motion-reduce:animate-none" />
        <Skeleton className="h-9 w-full motion-reduce:animate-none" />
      </div>
      {/* Turnstile placeholder */}
      <Skeleton className="h-[65px] w-[300px] motion-reduce:animate-none" />
      {/* Submit button */}
      <Skeleton className="h-9 w-full motion-reduce:animate-none" />
      {/* Helper copy */}
      <p className="text-xs text-center text-muted-foreground">
        Pick a time to continue
      </p>
    </div>
  );
}
```

**Decision notes:**
- `aria-hidden="true"` because the skeleton is decorative — screen readers should not announce skeleton blocks.
- `motion-reduce:animate-none` on each `Skeleton` disables the `animate-pulse` under reduced motion.
- Helper copy "Pick a time to continue" placed below the skeleton blocks so it reads naturally.
- Turnstile widget is 300x65px (standard Cloudflare size) — matching this prevents height jump when Turnstile mounts.

### Reduced-Motion CSS Fallback (globals.css addition)

```css
/* If Tailwind motion-reduce: variant is insufficient to cancel tw-animate-css */
@media (prefers-reduced-motion: reduce) {
  .animate-in,
  .animate-out {
    animation: none !important;
    transition: none !important;
  }
}
```

Add this to `app/globals.css` AFTER the `@import "tw-animate-css"` line. This is a belt-and-suspenders fallback.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| CSS custom `@keyframes` | `tw-animate-css` utilities | Already the repo standard via `globals.css` |
| Framer Motion | Pure CSS / tw-animate-css | Not installed; don't add |
| `tailwindcss-animate` (v3 plugin) | `tw-animate-css` (v4 CSS-first) | `tw-animate-css` is the v4 replacement |

**tw-animate-css v2.0.0 warning:** The package README warns that v2.0.0 will include breaking changes. The project uses v1.4.0. Do not upgrade during this phase.

---

## Files the Planner Should Expect to Touch

1. **`app/[account]/[event-slug]/_components/booking-shell.tsx`** — Remove `key={selectedSlot.start_at}`, replace placeholder `<div>` with `<BookingFormSkeleton />`, add animation wrapper div around `<BookingForm>`.
2. **`app/[account]/[event-slug]/_components/booking-form-skeleton.tsx`** — NEW FILE. The skeleton placeholder component.
3. **`app/globals.css`** — Optional: add `@media (prefers-reduced-motion: reduce)` CSS override if `motion-reduce:animate-none` Tailwind variant is insufficient.

Files NOT touched:
- `booking-form.tsx` — No changes needed (key prop is on the call site, not inside the component).
- `slot-picker.tsx` — Dead file, not used.
- `embed-shell.tsx` — Out of scope for this phase.
- All backend files, API routes, schema files.

---

## Verification Mechanics

Per CONTEXT.md, verification is manual QA (no automated test required for this phase).

**CLS = 0.0:**
1. Open Chrome DevTools > Performance tab.
2. Start recording, pick a time slot on `/{account}/{event-slug}`, wait for animation.
3. Stop recording. In the "Experience" lane, verify CLS = 0.000.
4. Alternative: Lighthouse "Performance" audit shows CLS = 0.

**React DevTools — BookingForm absent before pick:**
1. Install React Developer Tools Chrome extension.
2. Open the booker page before picking any slot.
3. In Components tree, search "BookingForm" — should NOT appear.
4. Pick a slot — "BookingForm" should now appear.
5. Pick a DIFFERENT slot — "BookingForm" should REMAIN in the tree at the same position (no unmount/remount). Field values (name, email) you typed should still be in the inputs.

**Reduced-motion:**
1. macOS: System Preferences > Accessibility > Display > Reduce Motion.
2. Windows: Settings > Ease of Access > Display > Show animations (off).
3. With reduced-motion on, pick a slot — form should appear instantly, no fade/rise animation.
4. The skeleton's blocks should be static (no pulse).

**Turnstile token staleness:**
1. Pick slot A. Wait for Turnstile to solve.
2. Pick slot B. Confirm Turnstile widget does NOT reload/re-challenge (stays solved or auto-resets gracefully).
3. Submit with slot B selected. Confirm booking succeeds without "bot check failed" error.

---

## Open Questions

1. **`motion-reduce:animate-none` and tw-animate-css compatibility**
   - What we know: Tailwind v4 has `motion-reduce:` variant. `tw-animate-css` defines animation via CSS custom properties. `animate-none` should override the `animation` shorthand.
   - What's unclear: Whether `animate-none` completely nullifies `tw-animate-css`'s CSS-property-based animation under all browsers.
   - Recommendation: Test manually in Chrome with OS reduced-motion enabled. If `motion-reduce:animate-none` doesn't work, add the `globals.css` `@media` fallback (Pattern 3 above).

2. **Skeleton height precision on event types with custom questions**
   - What we know: Custom questions render additional form fields below the 3 standard fields.
   - What's unclear: CLS impact when a skeleton sized for 3 fields is replaced by a form with 5+ fields.
   - Recommendation: The skeleton does not need to match variable question heights exactly. CLS is measured only on the initial load — the skeleton is shown from page paint, and the form replaces it after user interaction (not on load). CLS accumulates during load, not during interaction. Therefore post-interaction reflow does NOT count toward CLS. This is a non-issue for CLS = 0.0.

3. **Is `slot-picker.tsx` intentionally dead or a bug?**
   - What we know: `slot-picker.tsx` exports `SlotPicker` and `Slot`. `booking-shell.tsx` does NOT import `SlotPicker` — it inlined the logic. Only `Slot` type is imported from `slot-picker.tsx` (line 8 of `booking-shell.tsx`).
   - What's unclear: Whether `slot-picker.tsx` is meant to be used in the future or is permanently superseded.
   - Recommendation: Ignore for this phase. Import `Slot` from `slot-picker.tsx` as before.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection: `app/[account]/[event-slug]/_components/booking-shell.tsx` — current layout, conditional mount, key prop
- Direct inspection: `app/[account]/[event-slug]/_components/booking-form.tsx` — Turnstile integration, form fields
- Direct inspection: `components/ui/skeleton.tsx` — Skeleton primitive
- Direct inspection: `app/globals.css` — `@import "tw-animate-css"` confirmed
- Direct inspection: `package.json` — `tw-animate-css: ^1.4.0`, no Framer Motion
- Direct inspection: `node_modules/tw-animate-css/README.md` — `animate-in`, `fade-in`, `slide-in-from-bottom-*`, `duration-*` API
- Direct inspection: `node_modules/tw-animate-css/dist/tw-animate.css` — CSS custom property implementation of `enter` keyframe

### Secondary (MEDIUM confidence)
- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — confirms `EmbedShell` renders `<BookingShell>`, so booking-shell changes automatically affect embed

---

## Metadata

**Confidence breakdown:**
- Key prop problem: HIGH — confirmed by direct code read (line 258 booking-shell.tsx)
- tw-animate-css API: HIGH — confirmed from README and CSS source
- Skeleton primitive: HIGH — confirmed from components/ui/skeleton.tsx
- motion-reduce: compatibility: MEDIUM — Tailwind v4 variant exists but tw-animate-css interaction not tested in this environment
- CLS impact of skeleton height mismatch: HIGH (non-issue for post-interaction reflow, see Open Questions #2)

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (stable codebase; no external service changes expected)
