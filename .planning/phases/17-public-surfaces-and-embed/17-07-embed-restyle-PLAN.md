---
phase: 17-public-surfaces-and-embed
plan: 07
type: execute
wave: 3
depends_on: ["17-01"]
files_modified:
  - app/embed/[account]/[event-slug]/_components/embed-shell.tsx
autonomous: true

must_haves:
  truths:
    - "Embed widget renders bg-gray-50 background (not bg-white)"
    - "Embed sets its own --primary CSS var from brand_primary (CP-05) so SlotPicker bg-primary class shows customer color"
    - "Embed renders PoweredByNsi footer inside the iframe (per CONTEXT.md decision: footer always renders)"
    - "Embed gradient is driven by brand_primary directly (no background_color/background_shade refs)"
  artifacts:
    - path: "app/embed/[account]/[event-slug]/_components/embed-shell.tsx"
      provides: "Restyled embed shell with --primary override + bg-gray-50 + footer"
      contains: "--primary"
  key_links:
    - from: "app/embed/[account]/[event-slug]/_components/embed-shell.tsx"
      to: "(SlotPicker inside BookingShell)"
      via: "--primary CSS var on EmbedShell root drives bg-primary class"
      pattern: "\"--primary\""
    - from: "app/embed/[account]/[event-slug]/_components/embed-shell.tsx"
      to: "app/_components/powered-by-nsi.tsx"
      via: "import + render at end of shell content"
      pattern: "PoweredByNsi"
---

<objective>
Restyle the embed widget shell (`EmbedShell`) to adopt the NSI visual language: change background from `bg-white` to `bg-gray-50`, simplify the gradient to be driven by `brand_primary` directly (drop `background_color`/`background_shade` references — those columns are deprecated by EMBED-09), add a `--primary` CSS-var override (CP-05: CSS vars don't cross iframe boundaries, so embed must set its own), and render `PoweredByNsi` footer inside the iframe.

Purpose: The embed runs inside contractor websites' iframes. Without its own `--primary` override, the slot picker's `bg-primary` selected state would render in NSI blue (default `:root` color) instead of the customer's brand color — a major visual regression. EMBED-08..11 fix this and bring the embed into visual parity with the public booking pages.

Output: A restyled `EmbedShell` where the slot picker selected state shows customer color, the background is gray-50, and the NSI footer attribution renders inside every embed.
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

# Files this plan modifies / reads
@app/embed/[account]/[event-slug]/_components/embed-shell.tsx
@app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx
@lib/branding/contrast.ts
</context>

<preamble>
## v1.2 Visual Locks
1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]`
2-6. (See REQUIREMENTS.md preamble)

## Phase 17 Guardrails
- **CP-05 — embed CSS var ownership:** CSS variables do NOT cross iframe document boundaries. PublicShell's `--primary` override on the parent page does NOT propagate into the embed iframe. EMBED-10 explicitly requires the embed to set its OWN `--primary` on its own root element. This is why we keep the inline `style` pattern here even though we decommissioned the same pattern on the owner shell in Phase 15.
- **CP-07 — accent token unaffected:** SlotPicker's `.day-has-slots` dot uses `var(--color-accent)` (orange). Setting `--primary` does NOT touch that.
- **MP-04 — JIT lock:** All runtime hex flows through inline `style={{ "--primary": brandColor }}` — never Tailwind dynamic classes.
- **EMBED-11 — height reporter unchanged:** `EmbedHeightReporter` observes `document.documentElement.scrollHeight` via ResizeObserver. Adding `PoweredByNsi` will increase the height; the reporter handles this automatically. Do NOT modify the reporter.
- **EmbedShell stays minimal:** No glass Header pill (would crowd the small iframe canvas). No BackgroundGlow (the existing single-circle gradient is already correctly tuned for small iframes per the file's existing comment). Chrome density per CONTEXT.md "slot picker + footer minimum" recommendation.

## Requirement coverage
- EMBED-08: bg-white → bg-gray-50 (Task 1)
- EMBED-09: drop background_color/background_shade refs (Task 1)
- EMBED-10: --primary override (Task 1)
- EMBED-11: height reporter unchanged (verified, no code change)
- PUB-04 footer: rendered inside embed (Task 1)
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Restyle EmbedShell — bg-gray-50 + --primary override + PoweredByNsi + drop deprecated columns</name>
  <files>app/embed/[account]/[event-slug]/_components/embed-shell.tsx</files>
  <action>
Open `app/embed/[account]/[event-slug]/_components/embed-shell.tsx`. The current implementation reads `account.background_color` and `account.background_shade` to drive the gradient, sets only `--brand-primary` and `--brand-text` CSS vars, and uses `bg-white` as the root background.

**Edit plan:**

1. Add import for `PoweredByNsi`:
```typescript
import { PoweredByNsi } from "@/app/_components/powered-by-nsi";
```

2. **Remove deprecated column reads.** Delete these lines:
```typescript
const backdropColor = account.background_color ?? effectiveColor;
const shade = (account.background_shade ?? "subtle") as "none" | "subtle" | "bold";
```

3. **Update `cssVars` to include `--primary` and `--primary-foreground` overrides** (EMBED-10):

```typescript
const cssVars: CSSProperties = {
  ["--brand-primary" as never]: effectiveColor,
  ["--brand-text" as never]: textColor,
  // EMBED-10 (CP-05): CSS vars do not cross iframe boundaries — embed must set
  // its own --primary so SlotPicker's bg-primary class renders in customer color
  // (otherwise it inherits NSI blue from globals.css :root). --primary-foreground
  // ensures the selected-slot text contrasts correctly on arbitrary brand colors.
  ["--primary" as never]: effectiveColor,
  ["--primary-foreground" as never]: textColor,
  // Pitfall 4 (embed): NEVER min-height: 100vh — EmbedHeightReporter loop risk.
  minHeight: "auto",
};
```

4. **Update root JSX:** Change `bg-white` → `bg-gray-50`. Replace the conditional gradient blocks (the `shade !== "none"` and `shade === "none"` branches) with a single, unconditional gradient driven by `effectiveColor`:

Current root return:
```typescript
return (
  <div style={cssVars} className="relative overflow-hidden bg-white">
    {shade !== "none" && (
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 -z-10">
        <div
          className="h-80 w-80 rounded-full"
          style={{
            backgroundImage: `linear-gradient(to top right, ${backdropColor}, transparent)`,
            opacity: shade === "subtle" ? 0.25 : 0.5,
            filter: `blur(${shade === "subtle" ? 200 : 160}px)`,
          }}
        />
      </div>
    )}
    {shade === "none" && (
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundColor: `color-mix(in oklch, ${backdropColor} 4%, white)`,
        }}
      />
    )}

    {effectiveLogo && (
      <header className="flex justify-center pt-6 px-4">
        ...
      </header>
    )}

    <BookingShell account={account} eventType={eventType} />

    <EmbedHeightReporter />
  </div>
);
```

Replace with:

```typescript
return (
  <div style={cssVars} className="relative overflow-hidden bg-gray-50">
    {/*
      Phase 17 (EMBED-09): single-circle gradient driven by brand_primary directly.
      Removed background_color/background_shade reads (deprecated columns dropped
      in Phase 21 schema migration). Single gradient profile (always rendered) with
      opacity 0.40 + blur 160px to match BackgroundGlow blob 1 ambiance.

      Why single-circle (not BackgroundGlow's 2-blob pattern): embed iframes are
      typically 300-500px tall — 2nd blob (positioned at top:420px) would never be
      visible. Single circle is the correct visual scale for the smaller canvas.
      Phase 7 lock: NEVER Tailwind dynamic classes for runtime hex — inline style only.
    */}
    <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 -z-10">
      <div
        className="h-80 w-80 rounded-full opacity-40"
        style={{
          backgroundImage: `linear-gradient(to top right, ${effectiveColor}, transparent)`,
          filter: "blur(160px)",
        }}
      />
    </div>

    {effectiveLogo && (
      <header className="flex justify-center pt-6 px-4 relative z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={effectiveLogo}
          alt={`${account.name} logo`}
          style={{
            maxWidth: 120,
            maxHeight: 60,
            height: "auto",
            width: "auto",
          }}
        />
      </header>
    )}

    <div className="relative z-10">
      <BookingShell account={account} eventType={eventType} />
    </div>

    <PoweredByNsi />

    <EmbedHeightReporter />
  </div>
);
```

**Changes:**
- `bg-white` → `bg-gray-50` (EMBED-08).
- Conditional shade-driven gradient → single unconditional gradient using `effectiveColor` directly (EMBED-09).
- Opacity locked at `0.40`, blur at `160px` (matching BackgroundGlow blob 1 intensity per CONTEXT.md "same intensity as owner shell").
- Added `relative z-10` wrappers around `<header>` (logo) and around `BookingShell` so they stack above the absolutely-positioned gradient circle (which lives at `-z-10`).
- Added `<PoweredByNsi />` AFTER `<BookingShell>`, BEFORE `<EmbedHeightReporter />`. The reporter must remain the last element so `documentElement.scrollHeight` measurement includes the footer height.
- Removed the `shade === "none"` color-mix flat-tint branch — `bg-gray-50` (Tailwind class) provides the base color now; we don't need a CSS color-mix fallback.

**TypeScript / interface impact:** The `AccountSummary` type used by EmbedShell (from `_lib/types.ts`) includes `background_color` and `background_shade` fields. After this task, EmbedShell no longer reads them. Those fields will be dropped at the type level in Phase 21 (schema migration); for Phase 17 they remain on the type but are unused by EmbedShell. This is acceptable — the columns still exist in the database until Phase 21.

**DO NOT:**
- Add `BackgroundGlow` (different visual pattern; the existing single-circle is correct for embed canvas size).
- Add `Header` glass pill (would crowd the iframe; CONTEXT.md grants discretion to omit).
- Modify `EmbedHeightReporter` (RESEARCH.md Q8: ResizeObserver handles the new height automatically).
- Modify `BookingShell` props.
- Touch the `previewColor` / `previewLogo` override pattern (still needed by branding editor live preview per BRAND-21).
- Remove `--brand-primary` and `--brand-text` (still consumed by `BookingForm` submit button per RESEARCH.md Q7).
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "bg-white" app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — zero matches.
Run `grep -n "bg-gray-50" app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — must match.
Run `grep -n "background_color\\|background_shade" app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — zero matches (EMBED-09).
Run `grep -n "\"--primary\"" app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — must match (EMBED-10).
Run `grep -n "PoweredByNsi" app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — must match.
Run `grep -n "EmbedHeightReporter" app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — must still match (unchanged).
  </verify>
  <done>EmbedShell uses `bg-gray-50`, sets `--primary` and `--primary-foreground` CSS vars, drives gradient from `effectiveColor` directly (no deprecated column reads), renders PoweredByNsi inside the iframe before EmbedHeightReporter. TypeScript clean. SlotPicker `bg-primary` selected state will inherit customer brand color.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zero errors.
2. `grep -n "background_color" app/embed/` — only matches in `_lib/types.ts` (acceptable: type definition stays until Phase 21 DROP).
3. `grep -n "background_shade" app/embed/` — only matches in `_lib/types.ts` (same).
4. `EmbedHeightReporter` source unchanged.
5. `BookingShell` source unchanged.
</verification>

<success_criteria>
1. `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` uses `bg-gray-50` (not `bg-white`).
2. `cssVars` includes both `--primary` and `--primary-foreground` overrides.
3. Gradient circle uses `effectiveColor` directly (no `backdropColor` from `background_color`).
4. No conditional based on `shade` value (single unconditional gradient).
5. `PoweredByNsi` rendered inside the iframe, before `EmbedHeightReporter`.
6. `--brand-primary` and `--brand-text` CSS vars still set (for BookingForm consumers).
7. `npx tsc --noEmit` passes.
</success_criteria>

<output>
After completion, create `.planning/phases/17-public-surfaces-and-embed/17-07-embed-restyle-SUMMARY.md`. Document:
- Final cssVars structure (both --brand-primary AND --primary, with foregrounds)
- Decision to keep single-circle gradient (not BackgroundGlow) per iframe-canvas reasoning
- Decision to render PoweredByNsi inside embed (per CONTEXT.md lock)
- Note that EmbedHeightReporter handles the new height automatically (no code change)
</output>
