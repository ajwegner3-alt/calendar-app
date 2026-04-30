# Phase 14: Typography + CSS Token Foundations - Research

**Researched:** 2026-04-30
**Domain:** next/font, Tailwind v4 @theme, CSS specificity
**Confidence:** HIGH

---

## Summary

Phase 14 touches exactly two files (`app/layout.tsx` and `app/globals.css`) to establish font loading and CSS variable foundations that all downstream phases depend on. The scope is narrow and additive — no components are modified, no routes change.

The lead-scoring reference implementation (`lead-scoring-with-tools/website-analysis-tools/app/layout.tsx` and `app/globals.css`) is the authoritative pattern for this codebase. It was built by the same developer and uses the identical stack. All code examples below are drawn directly from that verified reference.

The one genuine decision required before planning is MP-07 (how to handle `tracking-tight` on `<html>`). Based on codebase inspection, **Approach A is correct**: replace `tracking-tight` on `<html>` with no letter-spacing class, then control tracking entirely via `body` and `h1-h3` CSS rules.

**Primary recommendation:** Implement TYPO-01 through TYPO-07 in a single commit to two files. No package installs required. All patterns are directly verified against the reference implementation and official Next.js 16.2.4 docs.

---

## Standard Stack

No new packages. All capabilities exist.

### Core
| Tool | Version | Purpose | Status |
|------|---------|---------|--------|
| `next/font/google` | Built into Next.js 16.2.4 | Font loading + CSS variable injection | Already in use for Inter |
| Tailwind CSS | 4.2.0 | @theme inline for font-stack tokens | Already in use |

### No Installations Needed

```bash
# Nothing to install. next/font/google is built into Next.js.
```

---

## Architecture Patterns

### Files Modified (Two Files Only)

```
app/
├── layout.tsx        # Add Roboto_Mono import + constructor; expand Inter weight array; update <html> className
└── globals.css       # Add --font-mono to @theme inline; add body/h1-h3 letter-spacing rules; update --color-primary + --color-sidebar-primary
```

No other files are touched in this phase.

---

## Research Answers (Six Questions)

### Q1: MP-07 Resolution — Approach A or B?

**Recommendation: Approach A. Remove `tracking-tight` from `<html>`. Replace with nothing.**

**Rationale from codebase inspection:**

The grep shows 17+ component files already have explicit `tracking-tight` on individual `<h1>`, `<h2>`, `<h3>` elements via `className="... tracking-tight ..."`. These component-level classes are more specific than `<html>` and will continue to render correctly regardless of what is on `<html>`.

Under Approach B (keep `tracking-tight` on `<html>`): The `body { letter-spacing: -0.017em }` rule in globals.css would win over `<html>`'s `tracking-tight: -0.025em` for body text — correct. The `h1, h2, h3 { letter-spacing: -0.037em }` rule would win for heading elements targeted by that selector — correct. BUT component-level `tracking-tight` classes on `<h1>` elements (17+ instances found) generate `-0.025rem` (rem-based, Tailwind default) which would **override** the `-0.037em` globals.css rule on a specificity tie, because Tailwind utility classes and plain CSS element selectors have equal specificity (both are single-class vs single-element). The Tailwind utility class wins due to **source order** in the compiled output (utilities come after element selectors in Tailwind v4's layer output).

Under Approach A (remove `tracking-tight` from `<html>`): The globals.css `body` and `h1-h3` rules establish the baseline. Component-level `tracking-tight` classes on headings remain intentional design decisions (the auth pages and dashboard use them explicitly). The distinction is clean: globals.css = document-level baseline; component classes = intentional overrides.

**The lead-scoring reference confirms Approach A:** `layout.tsx` has `tracking-[-0.017em]` on `<body>` as a Tailwind arbitrary value (not `tracking-tight` on `<html>`), and `globals.css` has `letter-spacing: -0.017em` on `body` and `-0.037em` on `h1, h2, h3`.

**LOCKED DECISION: Remove `tracking-tight` from `<html>` className in `app/layout.tsx`. Do not replace it with any letter-spacing class. Letter-spacing is governed entirely by globals.css rules.**

---

### Q2: next/font for Roboto Mono — Exact Pattern

**Confidence: HIGH** — Source: Next.js 16.2.4 official docs + verified reference implementation.

Roboto Mono is a variable font on Google Fonts (confirmed: 1 variable axis, wght 100–700). Because it is a variable font, `weight` is optional. However, the reference implementation explicitly specifies `weight: ["500", "700"]` — use this as the model since the calendar-app only needs Roboto Mono for the wordmark (weight 700) and potentially code blocks (weight 500).

**Exact constructor for calendar-app:**

```typescript
// Source: Next.js official docs + lead-scoring reference implementation
import { Inter, Roboto_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto-mono",
  display: "swap",
});
```

**Key notes:**
- Import name uses underscore: `Roboto_Mono` (Next.js docs: "Use an underscore for font names with multiple words")
- `variable: "--font-roboto-mono"` exposes the CSS variable used by TYPO-03
- `display: "swap"` is the standard for all next/font declarations
- Weight `"400"` added to the calendar-app constructor (reference uses 500/700 only; calendar-app may render code blocks in regular weight)
- The existing `inter` constructor keeps `variable: "--font-sans"` (already correct; do not change to `--font-inter`)

**Updated `<html>` className:**

```tsx
// Remove tracking-tight (Approach A); keep both variable classes
<html lang="en" className={cn("font-sans", inter.variable, robotoMono.variable)}>
```

Both CSS variables must be in the `className` for the browser to scope them to the document root.

---

### Q3: Tailwind v4 @theme inline Syntax for --font-mono

**Confidence: HIGH** — Source: Next.js 16.2.4 official docs (verified exact syntax).

The official Next.js + Tailwind v4 pattern (from `nextjs.org/docs/app/api-reference/components/font`, Tailwind CSS section):

```css
/* In globals.css, inside the existing @theme inline block */
@theme inline {
  --font-sans: var(--font-sans);          /* already present */
  --font-mono: var(--font-roboto-mono);   /* ADD THIS LINE */
  /* ... existing entries ... */
}
```

**Why `@theme inline` (not `@theme`):** The `--font-roboto-mono` CSS variable is injected by Next.js onto the `<html>` element at document scope. Using `@theme inline` tells Tailwind to resolve `var(--font-roboto-mono)` at the point of use rather than at the `:root` level — this prevents fallback to the browser default when the variable reference is resolved in a parent context. This matches the existing pattern in the codebase for `--font-sans`.

**Does `--font-mono` auto-apply to `<code>` elements?**

No. Declaring `--font-mono` in `@theme inline` creates the `font-mono` Tailwind utility class but does NOT automatically apply it to `<code>`, `<pre>`, or `<kbd>` elements. To make `<code>` elements render in Roboto Mono, add an explicit rule to globals.css:

```css
/* In globals.css @layer base or as a plain rule */
code, pre, kbd {
  font-family: var(--font-mono);
}
```

TYPO-03 requires `--font-mono: var(--font-roboto-mono), ui-monospace, monospace`. The fallback stack should be included in the `@theme inline` declaration:

```css
@theme inline {
  --font-mono: var(--font-roboto-mono), ui-monospace, monospace;
}
```

---

### Q4: Verification Without Phase 15 Components

Phase 15 (NorthStar wordmark) does not exist yet. The success criteria reference it. Here is the substitute verification approach for each criterion:

**Criterion 1: font-extrabold renders Inter weight 800**

Add a temporary test element to any existing owner-facing page (e.g., `app/(shell)/app/page.tsx`) before deploying:

```tsx
{/* TEMP: Phase 14 verification — remove after confirming */}
<span className="font-extrabold text-2xl">NorthStar</span>
```

Open the Vercel preview. In Chrome DevTools Network tab, filter for "font" and look for a file matching `inter-latin-ext-800` or `inter-latin-800`. If no 800 file appears and only a variable font file loads, the variable font covers all weights — that is acceptable. If no font file loads at all for extrabold and the text appears with browser font synthesis (slightly blurry, irregular weight), the weight array is not working.

Remove the `<span>` after verification. Do not ship it.

**Criterion 2: `<code>` blocks render in Roboto Mono**

Several existing pages have inline code elements. Check `app/(shell)/app/branding/` or create a one-line temp addition. In DevTools Elements panel, inspect a `<code>` element and confirm computed `font-family` includes "Roboto Mono".

**Criterion 3: h1 letter-spacing: -0.037em**

Any existing `<h1>` element on the live preview. DevTools → Elements → Computed → letter-spacing. Value should show as a pixel equivalent of `-0.037em` relative to the computed font-size.

**Criterion 4: Body letter-spacing: -0.017em**

Body element in DevTools → Computed → letter-spacing.

**Criterion 5: shadcn primary Buttons render in #3B82F6**

The existing dashboard has primary buttons. After TYPO-06 changes `--color-primary` in the non-`inline` `@theme` block, all shadcn components using `bg-primary` will render in `#3B82F6`. Visual check: any primary button should be blue-500, not navy `#0A2540`.

---

### Q5: Order of Operations — One or Split?

**Recommendation: Single commit, two files.**

Rationale: TYPO-01 through TYPO-07 touch only `app/layout.tsx` and `app/globals.css`. They are logically coupled (the `--font-roboto-mono` variable declared in layout.tsx is immediately referenced in the globals.css `@theme inline` block). Splitting them across commits creates a state where the CSS references a variable that hasn't been injected yet — this is safe (CSS gracefully degrades on undefined variables) but creates a confusing intermediate deploy state.

A single-commit, two-file wave is clean, verifiable in one Vercel preview, and matches the scope the TYPO-01..07 requirements describe.

**Execution order within the single commit:**

1. `app/layout.tsx`: Add `Roboto_Mono` import; expand `Inter` weight array; add `robotoMono` constructor; add `robotoMono.variable` to `<html>` className; remove `tracking-tight` from `<html>` className.
2. `app/globals.css`: Add `--font-mono` to `@theme inline` block; add `code, pre, kbd { font-family: var(--font-mono); }` rule; add `body { letter-spacing: -0.017em; }` rule; add `h1, h2, h3 { letter-spacing: -0.037em; }` rule; update `--color-primary` from `#0A2540` to `#3B82F6` in the `@theme` block; update `--color-sidebar-primary` from `#0A2540` to `#3B82F6` in the `@theme` block.

---

### Q6: Risks in Existing globals.css

**Risk 1: Two separate `@theme` blocks — confirm which is which. (HIGH CONFIDENCE)**

The current `globals.css` has two distinct `@theme` blocks:
- `@theme inline` (line 7): Tailwind variable-to-token mappings. `--font-mono` goes here.
- `@theme` (line 131): NSI brand overrides (hardcoded hex values). `--color-primary` and `--color-sidebar-primary` changes go here (TYPO-06, TYPO-07).

Do NOT put `--font-mono` in the non-`inline` `@theme` block, and do NOT put `--color-primary` in the `@theme inline` block. The distinction matters: `@theme inline` generates utilities that resolve variables at use time; the plain `@theme` block injects design tokens as CSS custom properties.

**Risk 2: `@layer base` html rule duplicates font-sans. (LOW severity, no action needed.)**

`globals.css` lines 127-129 has `html { @apply font-sans; }` in `@layer base`. This is redundant with `font-sans` on the `<html>` className in `layout.tsx` but causes no conflict. Leave it alone.

**Risk 3: `--color-primary` change will affect `.day-custom::after` dot. (KNOWN, pre-documented.)**

`globals.css` line 176: `.day-custom::after { background: hsl(var(--primary)); }`. When `--color-primary` changes from navy `#0A2540` to blue-500 `#3B82F6`, this dot changes from navy to blue. This is **intentional** per the v1.2 spec. Confirm the dot is still visible (blue-500 on white is high contrast — fine). Do not change this rule.

**Risk 4: `--color-sidebar-ring` is currently `#0A2540` (via `:root --sidebar-ring`). (LOW severity.)**

The `@theme` block sets `--color-sidebar-ring: #0A2540` indirectly via `@theme inline { --color-sidebar-ring: var(--sidebar-ring) }` → `:root { --sidebar-ring: oklch(0.708 0 0) }` (gray). The NSI-specific `@theme` block does not override `sidebar-ring`. The Phase 14 requirements do not specify `sidebar-ring` — leave it alone.

**Risk 5: Body `letter-spacing` rule placement. (MEDIUM confidence, confirmed pattern.)**

The new `body { letter-spacing: -0.017em; }` rule should be placed **outside** the `@layer base` block — as a top-level rule, matching the lead-scoring reference. The existing `@layer base` has `body { @apply bg-background text-foreground; }`. Do not merge the letter-spacing into the `@layer base` body rule — adding it there would work but the reference pattern keeps them separate.

Alternatively, adding it to the `@layer base` body block is functionally equivalent. Either is safe; for consistency with the reference, place it as a standalone rule.

**Risk 6: `h1, h2, h3` letter-spacing conflicts with component `tracking-tight` utilities. (ADDRESSED by Approach A, but nuance remains.)**

After removing `tracking-tight` from `<html>`, the globals.css rule `h1, h2, h3 { letter-spacing: -0.037em }` establishes `-0.037em` as the element-selector baseline. Component-level `tracking-tight` (found in 12+ files on `<h1>`, `<h2>` etc.) generates a Tailwind utility class. In Tailwind v4, utility classes are emitted in `@layer utilities` which has higher cascade priority than bare element selectors. This means component-level `tracking-tight` on headings will **override** the globals.css rule.

**This is correct behavior, not a bug.** The auth pages and dashboard headings explicitly want `tracking-tight` and will continue to get it. The globals.css rule serves as a fallback for headings that do NOT have an explicit tracking class — which describes the lead-scoring reference where headings have no utility class.

**Action for planner:** No special handling required. The cascade interaction is intentional.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font subsetting/self-hosting | Custom @font-face rules | `next/font/google` | next/font handles subsetting, preloading, fallback metrics, and self-hosting automatically |
| Font CSS variable injection | Manual `:root { --font-roboto-mono: ... }` | `variable: "--font-roboto-mono"` in constructor | next/font injects the variable scoped to the document root via the className mechanism |

---

## Common Pitfalls

### Pitfall 1: Roboto_Mono import spelling
**What goes wrong:** Importing `Roboto Mono` (with space) or `RobotoMono` (no underscore) causes a Next.js build error.
**How to avoid:** Use `Roboto_Mono` exactly — underscore between words, documented in official Next.js font docs.

### Pitfall 2: Forgetting `robotoMono.variable` in `<html>` className
**What goes wrong:** The `--font-roboto-mono` CSS variable is never injected into the DOM. The `@theme inline { --font-mono: var(--font-roboto-mono) }` declaration silently falls back to `ui-monospace`. Code blocks render in the system monospace font, not Roboto Mono. No build error, no warning.
**How to avoid:** The `<html>` className must include both `inter.variable` AND `robotoMono.variable`.

### Pitfall 3: Placing --font-mono in the wrong @theme block
**What goes wrong:** Adding `--font-mono` to the non-`inline` `@theme` block (the NSI brand block at line 131) injects it as a raw CSS custom property rather than an inlined utility reference. The `font-mono` utility class will not resolve correctly.
**How to avoid:** `--font-mono` goes in `@theme inline`. `--color-primary` changes go in the non-`inline` `@theme` block. The two blocks serve different purposes.

### Pitfall 4: MP-08 — Inter variable font masks missing weight 800 (from PITFALLS.md)
**What goes wrong:** Inter is a variable font. Without an explicit `weight` array, next/font loads the variable font file which technically covers all weights. However, if the build uses a static subset for any reason (e.g., specific subset configuration), weight 800 may not be available. Visual result: `font-extrabold` renders with browser synthesis.
**How to avoid:** Explicitly set `weight: ["400", "500", "600", "700", "800"]`. Verify via Chrome DevTools Network tab (look for inter-latin-800 file). The reference implementation explicitly sets this array.

### Pitfall 5: `--color-primary` is in `@theme` not `:root`
**What goes wrong:** Attempting to update `--primary` in the `:root` block (lines 57-58: `--primary: oklch(0.205 0 0)`) instead of in the `@theme` block. The `@theme` block at line 131 overrides the `:root` value for `--color-primary`. The correct location is the `@theme` block.
**How to avoid:** The existing `@theme` block already has `--color-primary: #0A2540` — change that value to `#3B82F6`. Do not touch the `--primary` oklch value in `:root`.

---

## Code Examples

### layout.tsx — Final State

```typescript
// Source: Verified against Next.js 16.2.4 official docs + lead-scoring reference
import type { Metadata } from "next";
import "./globals.css";
import { Inter, Roboto_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto-mono",
  display: "swap",
});

// ... metadata unchanged ...

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, robotoMono.variable)}>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

Key change from current: `tracking-tight` removed from `<html>` className; `Roboto_Mono` added; Inter `weight` array added.

### globals.css — Additions

```css
/* 1. In the existing @theme inline block — ADD after --font-sans line */
@theme inline {
    --font-sans: var(--font-sans);
    --font-mono: var(--font-roboto-mono), ui-monospace, monospace;  /* ADD */
    /* ... rest of existing entries unchanged ... */
}

/* 2. NEW top-level rules — add after the @layer base block */
body {
  letter-spacing: -0.017em;
}

h1, h2, h3 {
  letter-spacing: -0.037em;
}

code, pre, kbd {
  font-family: var(--font-mono);
}

/* 3. In the existing @theme block — change two values */
@theme {
  --color-primary: #3B82F6;           /* was #0A2540 */
  --color-primary-foreground: #FFFFFF;
  /* ... */
  --color-sidebar-primary: #3B82F6;   /* was #0A2540 */
  /* ... rest unchanged ... */
}
```

---

## State of the Art

| Old Approach | Current Approach | Applies Here |
|--------------|------------------|--------------|
| `tailwind.config.js` fontFamily extend | `@theme inline` in CSS | Yes — Tailwind v4 style |
| `@font-face` manual declarations | `next/font/google` constructor | Yes — next/font style |
| `weight: "variable"` string | Omit weight OR explicit array | Array preferred for static subset safety |

---

## Open Questions

None that block planning. All research questions are resolved.

One low-priority nuance: Roboto Mono's variable font file covers weights 100-700 via a single variable font file. Specifying `weight: ["400", "500", "700"]` in the constructor tells next/font which static subset files to prepare as fallback. For a variable font, next/font will still load the variable font file first — the weight array primarily affects preloading and static fallback behavior. This is safe either way.

---

## Sources

### Primary (HIGH confidence)
- Next.js 16.2.4 official docs — `nextjs.org/docs/app/api-reference/components/font` — weight parameter, variable option, multiple fonts, Tailwind v4 integration pattern
- `lead-scoring-with-tools/website-analysis-tools/app/layout.tsx` — verified Inter + Roboto_Mono constructor pattern in production NSI codebase
- `lead-scoring-with-tools/website-analysis-tools/app/globals.css` — verified `@theme inline --font-mono` declaration, `body` and `h1-h3` letter-spacing rules
- Tailwind CSS official docs — `tailwindcss.com/docs/font-family` — `@theme inline` vs `@theme` distinction, `--font-mono` utility behavior
- `app/layout.tsx` (calendar-app, read 2026-04-30) — current state confirmed
- `app/globals.css` (calendar-app, read 2026-04-30) — current state confirmed, two `@theme` blocks mapped

### Secondary (MEDIUM confidence)
- WebSearch: Roboto Mono confirmed as variable font on Google Fonts — weight array optional but explicitly specifying weights is standard practice in the reference codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all patterns verified against official docs and reference implementation
- Architecture: HIGH — exact code verified from reference + codebase reads
- Pitfalls: HIGH — grounded in actual codebase inspection (grep confirms 17+ tracking-tight instances)

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable APIs; next/font and Tailwind v4 @theme are stable)
