---
phase: 17-public-surfaces-and-embed
plan: 02
type: execute
wave: 2
depends_on: ["17-01"]
files_modified:
  - app/_components/public-shell.tsx
autonomous: true

must_haves:
  truths:
    - "PublicShell wraps children with bg-gray-50 base, customer-tinted BackgroundGlow, public Header pill, PoweredByNsi footer"
    - "PublicShell sets BOTH --brand-primary AND --primary CSS vars (with -foreground counterparts) so existing public components (BookingForm using --brand-primary) and slot picker (using bg-primary) both inherit customer color"
    - "Glow color falls back to NSI blue when brand_primary luminance > 0.85 (near-white) so glow is always visible"
  artifacts:
    - path: "app/_components/public-shell.tsx"
      provides: "Public surface shell — composes BackgroundGlow + Header(public) + PoweredByNsi + CSS-var wrapper"
      exports: ["PublicShell"]
      min_lines: 30
  key_links:
    - from: "app/_components/public-shell.tsx"
      to: "app/_components/background-glow.tsx"
      via: "import + render with color={glowColor}"
      pattern: "BackgroundGlow color="
    - from: "app/_components/public-shell.tsx"
      to: "app/_components/header.tsx"
      via: "import + render with variant='public'"
      pattern: "Header variant=\"public\""
    - from: "app/_components/public-shell.tsx"
      to: "app/_components/powered-by-nsi.tsx"
      via: "import + render at end of shell"
      pattern: "PoweredByNsi"
    - from: "app/_components/public-shell.tsx"
      to: "lib/branding/contrast.ts"
      via: "import pickTextColor + relativeLuminance for glow fallback"
      pattern: "relativeLuminance"
---

<objective>
Compose the foundation atoms (Plan 17-01: BackgroundGlow fix, PoweredByNsi, Header public variant) into the `PublicShell` Server Component that all 5 public booking surfaces will adopt.

Purpose: PublicShell is the single replacement for `BrandedPage` across the public side. It owns the public visual language (gray-50 + customer-tinted glow + glass pill + NSI footer) and the dual CSS-var wrapper (`--brand-primary` for BookingForm; `--primary` for slot picker). Without this shell, page migrations in Wave 3 cannot proceed.

Output: A single Server Component file ready for consumption by Wave 3 page migrations.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/17-public-surfaces-and-embed/17-CONTEXT.md
@.planning/phases/17-public-surfaces-and-embed/17-RESEARCH.md
@.planning/phases/17-public-surfaces-and-embed/17-01-foundation-atoms-SUMMARY.md

# Files this plan reads
@lib/branding/types.ts
@lib/branding/contrast.ts
@app/_components/background-glow.tsx
@app/_components/header.tsx
@app/_components/powered-by-nsi.tsx
</context>

<preamble>
## v1.2 Visual Locks (repeat in every phase plan)
1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]`
2. Email strategy: solid-color-only table band — no CSS gradients in email HTML
3. CSP: lives only in `proxy.ts`, never `next.config.ts`
4. Two-stage owner auth: RLS pre-check before service-role mutation
5. `background_shade` ENUM type must be dropped alongside the column
6. DROP migration = two-step deploy

## Phase 17 Guardrails
- **CP-05:** Embed iframe gets its OWN `--primary` override (handled in Plan 17-07). PublicShell handles host pages only.
- **CP-07:** `.day-has-slots` dot is `var(--color-accent)` — DO NOT touch. Setting `--primary` here does not affect the calendar dot color.
- **MP-04:** All runtime hex via inline `style={{...}}`. No Tailwind dynamic classes.
- **CSS var dual-pattern (RESEARCH.md Pitfall 1):** PublicShell MUST set BOTH `--brand-primary` (for BookingForm submit button: line 248 of `booking-form.tsx`) AND `--primary` (for SlotPicker `bg-primary` class). Setting only one leaves the other unbranded. REQUIREMENTS.md PUB-03 mentions only `--primary` — this plan deliberately sets both because the codebase has both patterns active simultaneously.
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Create PublicShell Server Component composing all public-surface chrome</name>
  <files>app/_components/public-shell.tsx</files>
  <action>
Create new file `app/_components/public-shell.tsx`. Server Component (no `'use client'`).

```typescript
// app/_components/public-shell.tsx
// Phase 17 (PUB-01, PUB-02, PUB-03): Public-surface shell. Replaces BrandedPage.
//
// Composition:
//   - bg-gray-50 base (NSI surface color)
//   - <BackgroundGlow color={brand_primary or NSI-blue fallback} />
//   - <Header variant="public" branding={branding} accountName={accountName} />
//   - CSS-var wrapper exposing BOTH --brand-primary (for BookingForm inline styles)
//     AND --primary (for slot picker bg-primary class). See RESEARCH.md Pitfall 1.
//   - <PoweredByNsi /> footer (PUB-04 attribution; renders on every public surface).
//
// Glow fallback: when brand_primary is near-white (luminance > 0.85), substitute
// NSI blue so the glow is always visible. Uses relativeLuminance() from contrast.ts.
//
// MP-04 lock: All runtime hex flows through inline style attribute, not Tailwind classes.

import type { CSSProperties, ReactNode } from "react";
import type { Branding } from "@/lib/branding/types";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { Header } from "@/app/_components/header";
import { PoweredByNsi } from "@/app/_components/powered-by-nsi";
import { relativeLuminance } from "@/lib/branding/contrast";

interface PublicShellProps {
  branding: Branding;
  /** Account display name for the Header pill right slot. */
  accountName: string;
  children: ReactNode;
}

/** Glow fallback: if brand_primary is too light to be visible on bg-gray-50, fall
 *  back to NSI blue. Threshold 0.85 ≈ #D0D0D0 — anything lighter substitutes. */
function resolveGlowColor(primaryColor: string): string {
  try {
    return relativeLuminance(primaryColor) > 0.85 ? "#3B82F6" : primaryColor;
  } catch {
    return "#3B82F6";
  }
}

export function PublicShell({ branding, accountName, children }: PublicShellProps) {
  const glowColor = resolveGlowColor(branding.primaryColor);
  // branding.textColor is pre-computed (#ffffff or #000000) by brandingFromRow().
  const foreground = branding.textColor;

  // Dual CSS vars: --brand-primary for existing BookingForm inline styles,
  // --primary for SlotPicker's `bg-primary` Tailwind class. Both must be set
  // because the codebase has both patterns in active use (RESEARCH.md Pitfall 1).
  const cssVars: CSSProperties = {
    ["--brand-primary" as never]: branding.primaryColor,
    ["--brand-text" as never]: foreground,
    ["--primary" as never]: branding.primaryColor,
    ["--primary-foreground" as never]: foreground,
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      <BackgroundGlow color={glowColor} />
      <Header variant="public" branding={branding} accountName={accountName} />
      <div style={cssVars}>
        <main className="pt-20 md:pt-24 pb-12">
          {children}
        </main>
      </div>
      <PoweredByNsi />
    </div>
  );
}
```

**Decisions locked:**
- `branding: Branding` (not raw account row) — callers must call `brandingFromRow(account)` first. This matches REQUIREMENTS.md PUB-01 wording.
- `accountName: string` is a separate prop (not on Branding) because account name is not a branding field; it's needed for the Header pill right slot.
- Glow luminance threshold = `0.85`. Picked per RESEARCH.md Q10 recommendation. CONTEXT.md grants Claude's discretion here.
- `pb-12` on main matches owner shell pattern (Phase 15 OWNER-06).
- `try/catch` around `relativeLuminance` is defensive — `pickTextColor` and `relativeLuminance` already handle malformed input per `lib/branding/contrast.ts`, but the try/catch ensures the shell never crashes on a bad hex string.

**DO NOT:**
- Render PoweredByNsi inside `<main>` — REQUIREMENTS.md PUB-02 places it after main.
- Add `<div style={cssVars}>` around BackgroundGlow or Header — those don't need brand vars; only `{children}` does.
- Override `--color-accent` — CP-07 reminder: `.day-has-slots` dot uses `--color-accent` (orange), do not touch.
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "export function PublicShell" app/_components/public-shell.tsx` — must match.
Run `grep -n "use client" app/_components/public-shell.tsx` — must return zero (Server Component).
Run `grep -n -- "--brand-primary" app/_components/public-shell.tsx` — must match (dual CSS var pattern).
Run `grep -n -- "--primary" app/_components/public-shell.tsx` — must match.
Run `grep -n "PoweredByNsi" app/_components/public-shell.tsx` — must match.
Run `grep -n "BackgroundGlow color=" app/_components/public-shell.tsx` — must match.
Run `grep -n "Header variant=\"public\"" app/_components/public-shell.tsx` — must match.
  </verify>
  <done>File exists; exports `PublicShell({ branding, accountName, children })` as Server Component; composes BackgroundGlow (with luminance fallback), Header (public variant), CSS-var wrapper around children, and PoweredByNsi footer in the documented order. TypeScript clean.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zero errors.
2. `grep -rn "PublicShell" app/` — only the definition (no consumers yet; consumers land in Wave 3).
3. Mentally trace render order: outer div (relative + bg-gray-50) → BackgroundGlow (absolute, behind content) → Header (fixed, above content) → CSS-var wrapper → main(pt-20 + children) → PoweredByNsi (in flow, after main).
</verification>

<success_criteria>
1. `app/_components/public-shell.tsx` exists as a Server Component.
2. Exports `PublicShell` named export accepting `{ branding: Branding, accountName: string, children: ReactNode }`.
3. Sets `--brand-primary`, `--brand-text`, `--primary`, `--primary-foreground` on a wrapper div around `{children}`.
4. Renders BackgroundGlow with luminance-fallback color (NSI blue when brand_primary too light).
5. Renders Header with `variant="public"`, `branding`, and `accountName` props.
6. Renders PoweredByNsi after main content.
7. `npx tsc --noEmit` passes.
</success_criteria>

<output>
After completion, create `.planning/phases/17-public-surfaces-and-embed/17-02-public-shell-SUMMARY.md` documenting:
- Final API signature (especially the accountName prop addition vs REQUIREMENTS.md wording)
- Dual CSS var decision (note both --brand-primary and --primary are set; explain why)
- Luminance threshold choice (0.85)
- Note that this enables Plans 17-03..06 page migrations in Wave 3
</output>
