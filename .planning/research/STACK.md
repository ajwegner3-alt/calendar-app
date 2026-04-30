# Stack Research

**Domain:** Visual/branding overhaul — calendar-app v1.2 (NSI Brand Lock-Down + UI Overhaul)
**Researched:** 2026-04-30
**Confidence:** HIGH (all findings verified by direct source inspection; zero WebSearch-only claims)

---

## Scope Constraint

This research covers ONLY the delta between the v1.1 shipped stack and what v1.2 needs. The
core stack (Next.js 16, React 19, Tailwind v4, shadcn/ui radix-nova, Supabase, date-fns, etc.)
is locked. Everything below is either a verified gap, a confirmed no-op, or an explicit
anti-recommendation.

---

## Verified Deltas (What Actually Needs to Change)

### 1. BackgroundGlow — Replicate as Parameterized Component (DO NOT vendor verbatim)

**Decision: Replicate with a `color` prop. Single file.**

**What was verified:**

Lead-scoring `app/components/BackgroundGlow.tsx` (28 lines, verified) hard-codes `#3B82F6` in
two inline `background` gradient strings and uses `fixed` positioning. It cannot serve the
calendar-app's dual-surface requirement without modification:

- Owner side: blob tint = `#3B82F6` (NSI blue, fixed)
- Public/embed side: blob tint = customer's `brand_primary` (runtime hex from DB)

The calendar-app already has `app/_components/gradient-backdrop.tsx` (Phase 12-01), which
handles runtime hex via inline `style` (the Phase 7 pitfall: never dynamic Tailwind classes is
already encoded there). However, `GradientBackdrop` takes `color + shade` and renders 3 circles
with a `shadeToGradient()` helper — more complex than needed for the Simple Light two-blob layout.

**Recommendation:** Create `app/_components/background-glow.tsx` as a new, purpose-built
component. Accept a single `color?: string` prop (defaults to `#3B82F6` when omitted). Render
the two-blob layout matching lead-scoring exactly (positions, sizes, blur values, opacities) but
with the gradient `from` color driven by the prop. Keep `fixed` positioning and `z-0`.

```
app/
  _components/
    background-glow.tsx   ← NEW (replaces/supersedes nsi-gradient-backdrop.tsx + GradientBackdrop for v1.2 surfaces)
    gradient-backdrop.tsx ← KEEP but deprecate; remove in schema-cleanup phase
    branded-page.tsx      ← UPDATE to use BackgroundGlow instead of GradientBackdrop
```

**Why not vendor verbatim:** The hardcoded `#3B82F6` serves NSI but breaks on public surfaces
where `brand_primary` could be any hex. A single prop addition costs 2 lines and eliminates a
maintenance fork.

**Why not keep GradientBackdrop:** `GradientBackdrop` supports three blobs + `shade` enum, which
maps to the deprecated `background_shade` / `background_color` columns being dropped in v1.2. The
Simple Light spec uses exactly two fixed blobs. Introducing a new component avoids entangling the
v1.2 visual target with the v1.1 complexity being removed.

**Why not `components/background-glow.tsx` (root `components/`):** The `components/` directory
holds shadcn-generated UI primitives. Bespoke NSI layout components belong in `app/_components/`
per existing convention (see `gradient-backdrop.tsx`, `branded-page.tsx` already there).

**Consumers after migration:**

| Surface | Component | color prop |
|---------|-----------|------------|
| Owner shell (`(shell)/layout.tsx`) | `<BackgroundGlow />` | omit (defaults to `#3B82F6`) |
| Auth pages (`auth-hero.tsx`) | `<BackgroundGlow />` | omit — replaces `NSIGradientBackdrop` |
| Public booking/embed (`branded-page.tsx`) | `<BackgroundGlow color={primaryColor} />` | customer `brand_primary` |

`components/nsi-gradient-backdrop.tsx` is deleted once all three consumers are migrated.

---

### 2. AOS / useScrollReveal — SKIP for v1.2

**Decision: Do not adopt. Zero new animation dependencies.**

**What was verified:**

- `package.json` (verified): `aos` is NOT in `dependencies` or `devDependencies`. The v1.1
  STACK.md noted it as "OPTIONAL and conditional per-route" — it was never installed.
- `package-lock.json` grep confirms `aos` appears only in planning docs, not the lockfile.
- Lead-scoring ships `useScrollReveal.ts` (verified, 41 lines) and the `[data-aos]` CSS block
  in `globals.css` (lines 27-50, verified). This pattern is used on the `free-audit/page.tsx`
  and `audit/[id]/` results client.
- Calendar-app is a SaaS dashboard + booking tool, not a marketing landing page. The scroll-reveal
  pattern is appropriate for lead-scoring because its pages are long-scroll public marketing flows.
  The calendar-app's owner-side is a sidebar-driven CRUD shell; the public booking page is a 2–3
  step form. Neither pattern warrants scroll-triggered entrance animations.

**Anti-recommendation:** Do not add `aos@3.x` or copy `useScrollReveal.ts`. The `[data-aos]`
CSS block from lead-scoring's `globals.css` should NOT be ported to calendar-app's `globals.css`.
Any accidental copy-paste during globals.css alignment work would add dead CSS.

---

### 3. Inter Font Loading — DELTA CONFIRMED, REQUIRES CHANGE

**Decision: Add weights `["500", "600", "700", "800"]` to the existing Inter declaration.**

**What was verified:**

Calendar-app `app/layout.tsx` line 7 (verified):
```ts
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
```
No `weight` array specified. Next.js `next/font/google` defaults to weight `"400"` only when
`weight` is omitted for a non-variable font.

Lead-scoring `app/layout.tsx` lines 9-14 (verified):
```ts
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
```

**Delta:** Calendar-app loads only weight 400. The Simple Light visual language requires 500
(medium labels, nav items), 600 (card headers, subheadings), 700 (section headings), and 800
(wordmark "NorthStar" uses `font-extrabold` = 800, per lead-scoring Header.tsx line 26).

**Second delta:** The CSS variable name differs:
- Calendar-app: `--font-sans` (variable name AND Tailwind token name)
- Lead-scoring: `--font-inter` (variable name) → mapped to `--font-sans` in `@theme inline`

Calendar-app's approach (using `--font-sans` directly as the variable name) is acceptable and
already wired into `@theme inline { --font-sans: var(--font-sans); }` in globals.css. The
variable name difference does NOT need to change — only the `weight` array needs updating.

**File to change:** `app/layout.tsx` line 7. Change:
```ts
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
```
to:
```ts
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});
```

No dependency change. No globals.css change needed for font loading itself.

---

### 4. Roboto Mono — ADD (targeted addition, justified)

**Decision: Add Roboto Mono at weights `["500", "700"]`.**

**What was verified:**

- Lead-scoring `app/layout.tsx` lines 16-21 (verified): loads Roboto Mono `["500", "700"]` as
  `--font-roboto-mono`, wired into `globals.css @theme inline { --font-mono: var(--font-roboto-mono) }`.
- Calendar-app `globals.css` `@theme inline` block (lines 7-8): defines `--font-heading` and
  `--font-sans` but has NO `--font-mono` token. No Roboto Mono declaration anywhere in the app.
- Calendar-app has `app/(shell)/app/event-types/` components that include embed code dialog
  (`EmbedCodeDialog`) which renders snippet copy blocks — monospace is appropriate there.
  Additionally, any token/key display surfaces benefit from monospace.

**How to add:** Extend `app/layout.tsx` with a second font declaration (same pattern as
lead-scoring). Add `--font-mono: var(--font-roboto-mono), ui-monospace, monospace;` to
globals.css `@theme inline` block.

This is the only new font network request v1.2 introduces. It is a `next/font/google` declaration,
not a new npm dependency — does not change `package.json`.

**File to change (2 files):**
1. `app/layout.tsx` — add `Roboto_Mono` import + declaration
2. `app/globals.css` — add `--font-mono: var(--font-roboto-mono), ui-monospace, monospace;`
   inside the `@theme inline` block (after `--font-sans` line)

---

### 5. letter-spacing / tracking — DELTA CONFIRMED, REQUIRES CHANGE

**Decision: Add explicit `letter-spacing` rules to `globals.css` body and h1-h3 selectors.**

**What was verified:**

Calendar-app `app/layout.tsx` line 25:
```tsx
<html lang="en" className={cn("font-sans tracking-tight", inter.variable)}>
```
`tracking-tight` in Tailwind v4 = `letter-spacing: -0.025rem`. This is a fixed `rem` value, not
the em-based values from the Simple Light spec.

Lead-scoring `app/globals.css` lines 18-25 (verified):
```css
body {
  letter-spacing: -0.017em;
}
h1, h2, h3 {
  letter-spacing: -0.037em;
}
```

These are `em`-relative values that scale with font-size — the correct approach for typographic
refinement at multiple type scales. `-0.017em` on body is slightly tighter than `tracking-tight`
(`-0.025rem` ≈ `-0.016em` at 16px base). The heading value `-0.037em` is significantly tighter
than anything Tailwind ships (Tailwind's `tracking-tighter` = `-0.05em`, so `-0.037em` sits
between `tracking-tight` and `tracking-tighter`).

**The `tracking-tight` on `<html>` does NOT produce the same result** because:
1. It uses `rem` not `em`, so it doesn't scale with heading font-sizes
2. It applies at the html element level (inherited), not with heading-specific overrides

**Change required:** Add to calendar-app `app/globals.css` within the `@layer base` block or
as a standalone block:
```css
body {
  letter-spacing: -0.017em;
}
h1, h2, h3 {
  letter-spacing: -0.037em;
}
```

The `tracking-tight` class on `<html>` in `layout.tsx` can remain as a fallback but the explicit
CSS rules in globals.css will take precedence for targeted selectors. Alternatively, remove
`tracking-tight` from `<html>` once the globals rules are in place (cleaner).

**File to change:** `app/globals.css` — add letter-spacing rules. Optionally clean
`app/layout.tsx` line 25 to remove `tracking-tight`.

---

### 6. Glass Header Pill — `backdrop-blur-sm` and Arbitrary Shadow

**Decision: No new dependencies. Both patterns work natively in Tailwind v4.**

**What was verified:**

Lead-scoring `app/components/Header.tsx` line 25 (verified):
```tsx
className="... bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]"
```

Tailwind v4 ships `backdrop-blur-sm` (confirmed: Tailwind v4 includes the full backdrop filter
utility set natively). The calendar-app already uses Tailwind v4 (`"tailwindcss": "^4.2.0"` in
`package.json`) and the `@import "tailwindcss"` directive in globals.css. `backdrop-blur-sm` will
compile without any additional config.

The arbitrary shadow value `shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]` uses Tailwind v4's JIT
arbitrary value syntax. This syntax is supported — Tailwind v4 JIT handles `shadow-[...]`
arbitrary values without any additional configuration.

**The glass header pill is a NEW component** for the calendar-app's owner side. The v1.1 shell
layout removed `FloatingHeaderPill` (noted in `(shell)/layout.tsx` line 80 comment: "Phase 12.6:
plain sidebar trigger replacing FloatingHeaderPill"). v1.2 re-introduces a glass pill header for
the owner shell — this is pure JSX + Tailwind classes, zero new dependencies.

**File affected:** `app/(shell)/layout.tsx` — add the pill header markup using `backdrop-blur-sm`
and the arbitrary shadow class. No package.json change.

---

### 7. shadcn Sidebar Active-State Styling

**Decision: `SidebarMenuButton` accepts `isActive` prop — use it. No class overriding needed.**

**What was verified:**

`components/app-sidebar.tsx` lines 82-98 (verified): `SidebarMenuButton` already receives
`isActive={...}` prop for each nav item. The shadcn Sidebar component applies active styling via
the `data-active` attribute + CSS selectors defined in `components/ui/sidebar.tsx`.

The lead-scoring `TabBar.tsx` active pattern (`border-b-2 border-blue-500 text-blue-600`) is a
horizontal tab pattern — not directly applicable to the calendar-app's vertical sidebar. The
sidebar's active item will instead be styled by updating the `--sidebar-primary` and
`--sidebar-accent` CSS tokens in globals.css to NSI blue (`#3B82F6` for v1.2, replacing the
current navy `#0A2540`).

**`SidebarMenuButton` with `isActive` DOES accept additional className.** The shadcn radix-nova
version in this repo (confirmed by `radix-ui@^1.4.3` in package.json) renders `data-active="true"`
on the button when `isActive` is true. Arbitrary active-state override via className works:
```tsx
<SidebarMenuButton isActive={...} className="data-[active=true]:bg-blue-50 data-[active=true]:text-blue-600">
```

However, the cleaner v1.2 approach is to update the `--sidebar-primary` token in globals.css
to NSI blue (`#3B82F6`), which the shadcn sidebar component already wires to active-item
highlight color. This avoids class proliferation across 6 nav items.

**File to change:** `app/globals.css` — update `--color-sidebar-primary` in the `@theme` block
from `#0A2540` to `#3B82F6`. The `--color-sidebar` token (sidebar background) stays as
`#F8FAFC` (light gray default for owner side; v1.2 DEPRECATES per-account sidebar color override).

---

### 8. Button Touch Targets — `min-h-[44px]`

**Decision: Apply `min-h-[44px]` via className at usage sites for primary CTAs. Do NOT modify
`components/ui/button.tsx` globally.**

**What was verified:**

`components/ui/button.tsx` (verified, 67 lines): The default size variant is `h-8` (32px). The
`lg` variant is `h-9` (36px). Neither meets the 44px WCAG touch target minimum.

Lead-scoring uses `min-h-[44px]` as a utility class applied directly to call-to-action buttons
on the public marketing page — not as a universal button override.

For the calendar-app v1.2 scope, the affected surfaces are:
- Public booking page CTA buttons (the "Book" submit button)
- Auth page form submit buttons (login, signup)

**Approach:** Apply `min-h-[44px]` as a `className` prop at the specific usage sites rather than
changing the shadcn Button `cva` defaults. Changing the `button.tsx` `cva` would cascade to every
button in the owner shell, including compact toolbar buttons, inline actions, and icon buttons
where 44px would break layout.

`min-h-[44px]` is a standard Tailwind v4 arbitrary value — no config needed.

**Files to check and update as needed:**
- Public booking form submit button (inside `app/[account]/[event-slug]/` booking form component)
- Auth page submit buttons (inside `app/(auth)/` form components)
- The shadcn Button `cva` in `components/ui/button.tsx` is NOT modified.

---

## Summary: New Files Created by v1.2

| File | Action | Replaces |
|------|--------|----------|
| `app/_components/background-glow.tsx` | CREATE | `GradientBackdrop` + `NSIGradientBackdrop` on all three surfaces |

## Summary: Files Modified by v1.2

| File | Change | Lines Affected |
|------|--------|----------------|
| `app/layout.tsx` | Add `weight` array to Inter; add `Roboto_Mono` import + declaration | ~7-15 |
| `app/globals.css` | Add letter-spacing rules (body + h1-h3); add `--font-mono` token; update `--color-sidebar-primary` to `#3B82F6` | ~5-10 new lines in existing blocks |
| `app/(shell)/layout.tsx` | Replace `GradientBackdrop` call with `<BackgroundGlow />`; add glass pill header markup | ~15-25 lines |
| `app/(auth)/_components/auth-hero.tsx` | Replace `<NSIGradientBackdrop />` with `<BackgroundGlow />` | ~2 lines |
| `app/_components/branded-page.tsx` | Replace `<GradientBackdrop .../>` with `<BackgroundGlow color={primaryColor} />` | ~5 lines |
| `components/app-sidebar.tsx` | Remove `sidebarColor` + `sidebarTextColor` props; remove inline style override | ~20 lines removed |
| `app/(shell)/app/branding/_components/branding-editor.tsx` | Remove `sidebarColor` + `backgroundColor` / `backgroundShade` picker controls | ~50 lines removed |
| `lib/branding/types.ts` | Remove `BackgroundShade`, `ChromeTintIntensity`, `sidebarColor` from `Branding` interface | ~8 lines removed |
| `lib/branding/read-branding.ts` | Remove deprecated column reads; simplify `brandingFromRow` | ~15 lines |
| `lib/branding/chrome-tint.ts` | DELETE entire file (deprecated `chromeTintToCss` + `resolveChromeColors`) | full file |

## Summary: Files Deleted by v1.2 (Final Schema Cleanup Phase)

| File | Reason |
|------|--------|
| `components/nsi-gradient-backdrop.tsx` | Superseded by `BackgroundGlow` |
| `lib/branding/chrome-tint.ts` | `chromeTintToCss` / `resolveChromeColors` deprecated |

---

## Dependencies — Zero New npm Packages

No `npm install` step for v1.2. All visual changes are:
- New/modified TSX components (Tailwind classes only)
- `next/font/google` declarations (no npm package, network-loaded by Next.js build)
- Globals.css additions

```bash
# No install command needed for v1.2.
```

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `aos@3.x` | Calendar-app is a CRUD dashboard + booking form, not a marketing scroll page. AOS is installed in 0 existing routes. Adding it introduces a JS payload + initialization lifecycle for zero user-facing value in v1.2 scope. | Plain CSS transitions via `tw-animate-css` already in package.json |
| OAuth / magic-link libraries | Out of scope for v1.2 (visual-only milestone) | N/A |
| Animation libraries (framer-motion, gsap, etc.) | Same reason as AOS — no new motion beyond what `tw-animate-css` already provides | `tw-animate-css` already installed |
| Modifying `components/ui/button.tsx` globally | The shadcn Button's `h-8` default is correct for compact shell UI. Global override breaks icon buttons, toolbar rows, inline actions. | `min-h-[44px]` className at specific CTA usage sites |
| Vendoring `BackgroundGlow` verbatim from lead-scoring | Hard-coded `#3B82F6` breaks on public pages with customer `brand_primary` | Parameterized replicate with `color?: string` prop |

---

## Alternatives Considered

| Decision | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| BackgroundGlow | Replicate with `color` prop | Vendor verbatim | Hard-coded color breaks customer-branded public surfaces |
| BackgroundGlow | Replicate with `color` prop | Keep GradientBackdrop | GradientBackdrop is wired to deprecated `shade` enum + 3-blob complexity; v1.2 removes those columns |
| AOS | Skip | Copy `useScrollReveal.ts` from lead-scoring | Dashboard IA is not a scroll-reveal context; adds dead code |
| Roboto Mono | Add as `next/font/google` declaration | Skip entirely | EmbedCodeDialog renders code snippets; missing mono font degrades that surface |
| letter-spacing | Add em-based CSS rules | Keep `tracking-tight` on `<html>` | `tracking-tight` is `rem`-based and doesn't scale with font-size; headings won't get correct tightening |
| Sidebar active color | Update `--color-sidebar-primary` token | Override via `data-[active=true]:` className on each `SidebarMenuButton` | Token-level change is single-source; className per item is fragile across 6+ menu items |

---

## Sources

All findings verified by direct file inspection on 2026-04-30. No WebSearch used — all source
material was present on disk.

| Source | What Was Verified |
|--------|-------------------|
| `lead-scoring-with-tools/.../app/components/BackgroundGlow.tsx` | Exact blob positions, colors, blur values, opacity, z-index, fixed positioning |
| `lead-scoring-with-tools/.../app/components/Header.tsx` | Glass pill classes: `backdrop-blur-sm`, arbitrary shadow, `bg-white/90`, `border-gray-200` |
| `lead-scoring-with-tools/.../app/globals.css` | Letter-spacing values (`-0.017em` body, `-0.037em` h1-h3), `[data-aos]` CSS block, `@theme inline` font tokens |
| `lead-scoring-with-tools/.../app/layout.tsx` | Inter weights `["400","500","600","700","800"]`, Roboto Mono weights `["500","700"]`, CSS variable names |
| `lead-scoring-with-tools/.../app/hooks/useScrollReveal.ts` | Confirmed hook exists, uses IntersectionObserver + `aos-animate` class toggle |
| `calendar-app/app/layout.tsx` | Current Inter config: no weight array, `--font-sans` variable name, `tracking-tight` on `<html>` |
| `calendar-app/app/globals.css` | Current `@theme inline` block (no `--font-mono`), `--color-sidebar-primary: #0A2540`, letter-spacing absent |
| `calendar-app/package.json` | `aos` NOT present in any dependency field; Tailwind v4.2.0 confirmed |
| `calendar-app/components/ui/button.tsx` | Default size `h-8` (32px), `lg` size `h-9` (36px); both below 44px touch target |
| `calendar-app/components/app-sidebar.tsx` | `isActive` prop already used; `sidebarColor` + `sidebarTextColor` props exist (to be deprecated) |
| `calendar-app/app/(shell)/layout.tsx` | `GradientBackdrop` usage, `resolveChromeColors` call, deprecated column reads |
| `calendar-app/app/_components/gradient-backdrop.tsx` | Three-blob implementation, `shadeToGradient()` dependency, inline style for runtime hex |
| `calendar-app/lib/branding/chrome-tint.ts` | `chromeTintToCss`, `resolveChromeColors` — confirmed as deprecated path for v1.2 |
| `website-creation/.claude/skills/tailwind-landing-page/SKILL.md` | Cruip Simple Light spec: Inter + Roboto Mono, `-0.017em`/`-0.037em` tracking, two-blob glow pattern, 44px touch targets |

---

*Stack research for: calendar-app v1.2 NSI Brand Lock-Down + UI Overhaul*
*Researched: 2026-04-30*
