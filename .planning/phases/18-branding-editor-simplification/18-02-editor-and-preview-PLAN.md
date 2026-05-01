---
phase: 18-branding-editor-simplification
plan: 02
type: execute
wave: 2
depends_on: ["18-01"]
files_modified:
  - app/(shell)/app/branding/_components/branding-editor.tsx
  - app/(shell)/app/branding/_components/mini-preview-card.tsx
  - app/(shell)/app/branding/_lib/actions.ts
autonomous: true

must_haves:
  truths:
    - "BrandingEditor surfaces exactly two controls: LogoUploader (first) and brand_primary ColorPickerInput (second). The three deprecated pickers (sidebar_color, background_color, background_shade ShadePicker) are removed from the JSX."
    - "BrandingEditor layout: left column = controls, right column stacks MiniPreviewCard ABOVE PreviewIframe (per CONTEXT.md lock)"
    - "Color picker block has a 'Reset to NSI blue (#3B82F6)' button next to or below the picker that sets primaryColor state to '#3B82F6' (note: NOT the same as DEFAULT_BRAND_PRIMARY '#0A2540' — this is the NSI blue brand lock per CONTEXT.md)"
    - "Color picker block shows an inline contrast warning when relativeLuminance(primaryColor) > 0.85 with copy: 'This color may be hard to read on white backgrounds.' Save remains allowed (informational only)."
    - "MiniPreviewCard rebuilt as faux PUBLIC booking page: bg-gray-50 base + brand_primary blob (blur-[60px] opacity-40 inline style — JIT lock per MP-04) + white card (bg-white rounded-xl border border-gray-200 p-4 shadow-sm) + faux 3-button slot picker (one selected with brand_primary inline style) + tiny 'Powered by NSI' text-[10px] text-gray-400 + faux pill at top showing logo or initial circle"
    - "MiniPreviewCard accepts new props {brandPrimary, logoUrl, accountName} (or equivalent) — old props {sidebarColor, pageColor, primaryColor} are gone"
    - "saveBrandingAction is DELETED from app/(shell)/app/branding/_lib/actions.ts (per RESEARCH.md Q2 — no callers remain after editor rewrite). Imports of backgroundColorSchema, backgroundShadeSchema, sidebarColorSchema, and BackgroundShade type are removed from actions.ts."
    - "savePrimaryColorAction (line 95-116) UNCHANGED — ColorPickerInput's default showSaveButton mode wires the color save"
    - "uploadLogoAction + deleteLogoAction UNCHANGED"
    - "PreviewIframe (preview-iframe.tsx) is verified as untouched — BRAND-21 is verify-only"
    - "tsc --noEmit passes with ZERO errors (Wave 1's deferred branding-editor.tsx errors are now resolved; pre-existing tests/branding-gradient.test.ts breakage stays — Phase 20 deletes)"
    - "npm run build (Vercel) succeeds"
    - "Pre-existing broken test tests/branding-gradient.test.ts is left alone (Phase 20 deletes — STATE.md:123)"
  artifacts:
    - path: "app/(shell)/app/branding/_components/branding-editor.tsx"
      provides: "Simplified 2-control editor with new layout (controls left / MiniPreviewCard above PreviewIframe right)"
      contains: "LogoUploader"
      min_lines: 60
    - path: "app/(shell)/app/branding/_components/mini-preview-card.tsx"
      provides: "Faux public booking page preview at miniature scale"
      contains: "rounded-xl"
      min_lines: 40
    - path: "app/(shell)/app/branding/_lib/actions.ts"
      provides: "uploadLogoAction + savePrimaryColorAction + deleteLogoAction (saveBrandingAction deleted)"
      contains: "savePrimaryColorAction"
  key_links:
    - from: "BrandingEditor"
      to: "MiniPreviewCard"
      via: "primaryColor + logoUrl + accountName props"
      pattern: "<MiniPreviewCard"
    - from: "BrandingEditor"
      to: "PreviewIframe"
      via: "previewColor={primaryColor} previewLogo={logoUrl} (UNCHANGED — BRAND-21)"
      pattern: "<PreviewIframe"
    - from: "BrandingEditor"
      to: "relativeLuminance"
      via: "import from @/lib/branding/contrast — gates the contrast warning at threshold 0.85"
      pattern: "relativeLuminance"
    - from: "ColorPickerInput (default showSaveButton=true)"
      to: "savePrimaryColorAction"
      via: "internal save button + revalidatePath"
      pattern: "savePrimaryColorAction"
    - from: "MiniPreviewCard blob"
      to: "brand_primary hex"
      via: "inline style={{ background: linear-gradient(to top right, ${brandPrimary}, transparent) }} (JIT lock — MP-04)"
      pattern: "linear-gradient\\(to top right, \\$\\{"
    - from: "MiniPreviewCard selected slot"
      to: "brand_primary hex"
      via: "inline style={{ backgroundColor: brandPrimary }} (JIT lock — MP-04)"
      pattern: "backgroundColor: brandPrimary"
---

<objective>
Wave 2 of Phase 18 — atomic UI commit covering BrandingEditor rewrite + MiniPreviewCard rebuild + saveBrandingAction deletion. MP-03 lock: these three files MUST commit together because MiniPreviewCard's prop interface changes (old `{sidebarColor, pageColor, primaryColor}` → new `{brandPrimary, logoUrl, accountName}`) and BrandingEditor's import-site change must move atomically. saveBrandingAction goes with them because the editor stops calling it.

Purpose: Closes BRAND-13, BRAND-14, BRAND-15, BRAND-16, BRAND-17, BRAND-18 (and verifies BRAND-21). The `/app/branding` page collapses to two controls (logo + brand_primary). MiniPreviewCard becomes a faux PUBLIC booking page preview (gray-50 + brand_primary blob + white card + 3-button slot picker + tiny Powered-by-NSI + faux pill) using Phase 17 PublicShell visual grammar at miniature scale.

Output: simplified `/app/branding` page that looks like a public booking page preview when you change the color. tsc clean. Vercel build clean. No deploy in this plan — Wave 3 visual-gate plan handles deploy + Andrew eyeball.
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
@.planning/phases/18-branding-editor-simplification/18-CONTEXT.md
@.planning/phases/18-branding-editor-simplification/18-RESEARCH.md
@.planning/phases/18-branding-editor-simplification/18-01-types-and-reader-SUMMARY.md

# Files to read before editing:
@app/(shell)/app/branding/_components/branding-editor.tsx
@app/(shell)/app/branding/_components/mini-preview-card.tsx
@app/(shell)/app/branding/_lib/actions.ts
@app/(shell)/app/branding/_lib/load-branding.ts
@app/(shell)/app/branding/_components/color-picker-input.tsx
@app/(shell)/app/branding/_components/logo-uploader.tsx
@app/(shell)/app/branding/_components/preview-iframe.tsx

# Phase 17 visual-grammar references (mirror at miniature scale):
@app/_components/public-shell.tsx
@app/_components/background-glow.tsx
@app/_components/header.tsx
@app/_components/powered-by-nsi.tsx
@app/embed/[account]/[event-slug]/_components/embed-shell.tsx

# Contrast helper (single source of truth for 0.85 threshold):
@lib/branding/contrast.ts
</context>

<preamble>
## v1.2 Visual Locks (mandatory restate)
1. **JIT pitfall (MP-04 — load-bearing for this plan):** runtime hex via `style={{ ... }}` only — never `bg-[${color}]`. The MiniPreviewCard blob and selected-slot button MUST use inline style.
2. Email strategy: solid-color-only table band (Phase 19, not this phase).
3. CSP: lives only in `proxy.ts` (not relevant here).
4. Two-stage owner auth: RLS pre-check before service-role mutation (already in place; not changed).
5. `background_shade` ENUM type drops in Phase 21 (not relevant here).
6. DROP migration is two-step deploy (Phase 21).

## Phase 18 Locked Decisions (do NOT revisit)
- **Two controls only.** LogoUploader (first) + brand_primary ColorPickerInput (second). The 3 deprecated pickers (sidebar, page background, ShadePicker) are GONE from the JSX. The `shade-picker.tsx` component FILE stays on disk — Phase 20 (CLEAN-07) deletes it. Just remove the import + usage.
- **Layout:** controls left column / MiniPreviewCard above PreviewIframe in right column. Logo first, then color picker.
- **MiniPreviewCard composition (CONTEXT.md lock):**
  - `bg-gray-50` base
  - Blob in `brand_primary` (`blur-[60px] opacity-40` inline style — JIT lock)
  - White card: `bg-white rounded-xl border border-gray-200 p-4 shadow-sm` centered
  - Faux 3-button slot picker (one selected with `brand_primary` inline style)
  - Tiny "Powered by NSI" `text-[10px] text-gray-400` at card bottom
  - Faux pill at top showing logo (or initial circle if no logo)
- **Contrast warning:** when `relativeLuminance(brand_primary) > 0.85`. Threshold matches PublicShell `resolveGlowColor` exactly (single source of truth). Copy: "This color may be hard to read on white backgrounds." Informational only — Save remains enabled.
- **Reset to NSI blue (#3B82F6)** button. ONE-CLICK escape hatch. Note: `#3B82F6` is the NSI blue brand color (Phase 14 `--color-primary`); it is NOT the same as `DEFAULT_BRAND_PRIMARY = "#0A2540"` (the legacy fallback used by `brandingFromRow` for accounts with null `brand_primary`). Do NOT change `DEFAULT_BRAND_PRIMARY`.
- **Q2 resolution: DELETE `saveBrandingAction`** entirely. `ColorPickerInput` (default `showSaveButton=true` mode) already wires `savePrimaryColorAction` directly via its internal "Save color" button. Logo save is handled by `LogoUploader` (calls `uploadLogoAction` / `deleteLogoAction`). No remaining caller for `saveBrandingAction` after editor rewrite.
- **Q3 resolution:** No live-update rewiring. `MiniPreviewCard` is already reactive via parent state (every keystroke updates props). `PreviewIframe` already re-keys on `previewColor` change (`preview-iframe.tsx:59`). No debounce. Both update on every keystroke.
- **Q4 resolution:** No color picker presets. Default `ColorPickerInput` behavior unchanged (existing `showSwatches` defaults to `false`).
- **Q5 resolution:** Page intro copy unchanged (`page.tsx` left alone).
- **Q6 resolution:** No unsaved-changes guard.
- **PreviewIframe is verify-only (BRAND-21):** Read it during this plan to confirm `?previewColor=` plumbing is intact, but do NOT modify it. The iframe still re-keys on `previewColor` change because of the existing `key={iframeSrc}` at line 59.
- **Pre-existing broken test:** `tests/branding-gradient.test.ts` (broken since Phase 17-08, per STATE.md:123). Phase 18 leaves alone — Phase 20 deletes. tsc gate accommodates this baseline.

## Atomic commit boundary
This plan ships ONE commit covering BrandingEditor + MiniPreviewCard + actions.ts. MP-03 lock: prop interface change in MiniPreviewCard MUST land in same commit as BrandingEditor import-site update. saveBrandingAction deletion goes with them because the editor stops calling it.

## Requirement coverage (this plan)
- BRAND-13: 3 deprecated pickers removed from JSX (sidebar_color ColorPickerInput, background_color ColorPickerInput, ShadePicker)
- BRAND-14: LogoUploader + brand_primary ColorPickerInput retained; label updated to "Booking page primary color"; description: "Used for the background glow, CTAs, and slot selection on your public booking pages."
- BRAND-15: IntensityPicker confirmed already deleted (Phase 12.6-02). Verify with grep — no JSX changes needed (already gone).
- BRAND-16: ShadePicker import + usage removed from BrandingEditor (the file itself stays — Phase 20 CLEAN-07 deletes)
- BRAND-17: MiniPreviewCard rebuilt as faux public booking page preview
- BRAND-18: saveBrandingAction deleted (signature simplification by elimination — color save handled by savePrimaryColorAction; logo save unchanged)
- BRAND-21: PreviewIframe verified intact (no edits)
- (BRAND-19, BRAND-20 closed in Wave 1.)

## Wave 1 hand-off
- `BrandingState` is now `{accountId, accountSlug, logoUrl, primaryColor, firstActiveEventSlug}` ONLY.
- `loadBrandingForOwner` SELECT is `"id, slug, logo_url, brand_primary"`.
- `Branding` interface in `lib/branding/types.ts` keeps deprecated optional shim fields (Option B) — Phase 18 UI doesn't read them.
- tsc errors at start of Wave 2: `branding-editor.tsx` (state.backgroundColor / state.backgroundShade / state.sidebarColor / saveBrandingAction-related references). Wave 2 resolves all of them.
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Rebuild MiniPreviewCard as faux public booking page preview</name>
  <files>app/(shell)/app/branding/_components/mini-preview-card.tsx</files>
  <action>
Full rewrite of `app/(shell)/app/branding/_components/mini-preview-card.tsx` (66 lines becomes ~70-90 lines). The new file is a CLIENT component (`"use client"`) that renders a faux PUBLIC booking page in miniature.

**New props interface:**

```ts
interface MiniPreviewCardProps {
  brandPrimary: string;        // Required hex (parent always passes a value — fallback handled by parent state default)
  logoUrl: string | null;      // From state.logoUrl
  accountName: string;         // From state.accountSlug or hardcoded "Preview" if not available — see action below
}
```

**Parent passes:** `brandPrimary={primaryColor}` (the live editor state — defaults to `state.primaryColor ?? "#3B82F6"` per Task 2), `logoUrl={logoUrl}` (live editor state), `accountName={state.accountSlug ?? "Preview"}` (or just hardcode `"Preview"` if Claude prefers — discretion call per CONTEXT.md "pill content (logo only vs logo + name vs co-branded)" lock).

**Visual composition (mirror Phase 17 PublicShell at miniature scale):**

```tsx
"use client";

interface MiniPreviewCardProps {
  brandPrimary: string;
  logoUrl: string | null;
  accountName: string;
}

/**
 * Faux PUBLIC booking page preview. Mirrors Phase 17 PublicShell visual
 * grammar (gray-50 base + brand_primary blob + glass pill + white card +
 * Powered-by-NSI footer) at miniature scale so owners see what their
 * brand_primary will produce on the real public booking page BEFORE saving.
 *
 * Phase 18 BRAND-17: replaces the Phase 12.6 faux-dashboard preview.
 * MP-04 JIT lock: runtime hex flows through inline style only — never
 * Tailwind classes.
 *
 * Props are reactive to parent state — every keystroke updates the preview.
 */
export function MiniPreviewCard({ brandPrimary, logoUrl, accountName }: MiniPreviewCardProps) {
  const initial = (accountName.charAt(0) || "P").toUpperCase();

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">Preview</p>

      {/* Faux public page: bg-gray-50 + blob + glass pill + white card + footer */}
      <div className="relative h-56 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {/* Brand-primary blob — inline style for JIT lock (MP-04) */}
        <div
          aria-hidden
          className="absolute h-32 w-32 rounded-full opacity-40"
          style={{
            top: "-16px",
            left: "calc(50% + 30px)",
            transform: "translateX(-50%)",
            background: `linear-gradient(to top right, ${brandPrimary}, transparent)`,
            filter: "blur(60px)",
          }}
        />

        {/* Faux glass pill at top — logo or initial circle */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 backdrop-blur-sm border border-gray-200 shadow-sm">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-4 w-auto" style={{ maxHeight: 16, maxWidth: 60 }} />
          ) : (
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold text-white"
              style={{ backgroundColor: brandPrimary }}
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
        </div>

        {/* Faux white card — slot picker preview */}
        <div className="absolute inset-x-4 top-12 bottom-4 flex flex-col">
          <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {/* Faux event title strip */}
            <div className="mb-3 space-y-1">
              <div className="h-2 w-2/3 rounded-full bg-gray-200" />
              <div className="h-1.5 w-1/3 rounded-full bg-gray-100" />
            </div>

            {/* Faux 3-button slot picker — middle button selected with brand_primary */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="h-6 rounded border border-gray-200 bg-white text-[10px] text-gray-600"
              >
                9:00
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="h-6 rounded text-[10px] font-medium text-white"
                style={{ backgroundColor: brandPrimary }}
              >
                10:00
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="h-6 rounded border border-gray-200 bg-white text-[10px] text-gray-600"
              >
                11:00
              </button>
            </div>

            {/* Powered-by-NSI footer at card bottom */}
            <div className="mt-3 text-center text-[10px] text-gray-400">
              Powered by North Star Integrations
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Key implementation notes:**
- The blob uses `linear-gradient(to top right, ${brandPrimary}, transparent)` — same recipe as Phase 17's `BackgroundGlow` (`background-glow.tsx:18-25`) and `EmbedShell`'s single-circle (`embed-shell.tsx:78-86`). At miniature scale we use `blur(60px)` per CONTEXT.md lock (smaller than the 160px on full-size shells).
- The selected slot button (middle) uses `style={{ backgroundColor: brandPrimary }}` for the JIT lock. White text is hard-coded for visual simplicity at this scale (the contrast warning at the parent level catches near-white brand_primary cases). Do NOT reach for `pickTextColor` here — informational preview at small scale doesn't need WCAG-perfect contrast.
- The faux glass pill mirrors `header.tsx:42-80` (Phase 17 public variant) at miniature scale: logo if present, else initial circle in `brand_primary`.
- The whole card sits in a `relative h-56 overflow-hidden rounded-lg border` outer that contains the blob and the inner card. Height is fixed at `h-56` (224px) for layout stability — the parent column dictates width.
- Buttons are `tabIndex={-1} aria-hidden` because they're a visual preview, not interactive controls.
- Use `// eslint-disable-next-line @next/next/no-img-element` for the logo `<img>` (consistent with `header.tsx`'s use of plain `<img>`). The Next.js `<Image>` component is overkill for a 16px-tall preview thumbnail.

**Discretion calls (Claude makes during write):**
- Slot button time labels: 9:00 / 10:00 / 11:00 picked here. Plausible alternative: dashes ("--:--"). Times are more recognizable as a slot picker.
- Selected slot index: middle (index 1). Center-of-attention principle — visual draw to the brand color.
- Card header content: 2 faux gray bars (event title + duration) above the slot grid. Informative without being noisy.
- Pill content: logo if uploaded, else initial circle. No account name text in the pill at this scale (real PublicShell pill includes name on right, but at miniature scale the name would be illegible — drop it).

**Avoid:**
- Do NOT import `<PoweredByNsi />` — at full size it's too large for the mini card. Just mirror the visual ("Powered by North Star Integrations" as `text-[10px] text-gray-400`).
- Do NOT use `<BackgroundGlow />` — its 2-blob composition is calibrated for full viewport. We render ONE small blob inline.
- Do NOT use Tailwind dynamic-hex classes (`bg-[${brandPrimary}]`) — JIT lock.
  </action>
  <verify>
1. Read the rewritten file and visually confirm:
   - `"use client"` directive at top
   - New props interface with 3 fields: `brandPrimary`, `logoUrl`, `accountName`
   - Outer wrapper: `bg-gray-50` with `relative` + `overflow-hidden`
   - Blob uses inline `style={{ background: \`linear-gradient(...)\`, filter: "blur(60px)" }}`
   - White card uses `rounded-xl border border-gray-200 bg-white p-4 shadow-sm`
   - 3 faux slot buttons with middle selected via inline `style={{ backgroundColor: brandPrimary }}`
   - "Powered by North Star Integrations" text at `text-[10px] text-gray-400`
   - Faux pill at top with logo OR initial circle (initial circle uses inline `style={{ backgroundColor: brandPrimary }}`)
2. Grep for JIT-lock compliance:
   ```bash
   grep -n "bg-\[" app/\(shell\)/app/branding/_components/mini-preview-card.tsx
   ```
   Expect: ZERO hits for dynamic-hex Tailwind (only static utility classes like `bg-gray-50`, `bg-white`, `bg-white/80`, `bg-gray-100`, `bg-gray-200` are allowed — those are static).
3. Grep for inline-style usage on runtime hex:
   ```bash
   grep -n "brandPrimary\|backgroundColor: brandPrimary\|brandPrimary," app/\(shell\)/app/branding/_components/mini-preview-card.tsx
   ```
   Expect: brandPrimary used in style attributes (blob `background`, initial circle `backgroundColor`, selected slot `backgroundColor`).
4. Confirm no `<BackgroundGlow>` or `<PoweredByNsi>` imports.
  </verify>
  <done>
- File rewritten with new prop interface
- Faux public booking page composition matches CONTEXT.md spec exactly
- All runtime hex flows through inline `style={{}}` — JIT lock honored
- No dynamic-hex Tailwind classes
- No `<BackgroundGlow>` / `<PoweredByNsi>` imports
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite BrandingEditor (2 controls + new layout + reset button + contrast warning)</name>
  <files>app/(shell)/app/branding/_components/branding-editor.tsx</files>
  <action>
Full rewrite of `app/(shell)/app/branding/_components/branding-editor.tsx` (163 lines becomes ~80-110 lines). Strip 3 deprecated picker blocks; restructure layout; add reset button + contrast warning.

**Imports to KEEP:**
- `"use client"` directive
- `useState` from `"react"` (for `primaryColor` and `logoUrl` state)
- `Button` from `@/components/ui/button` (for the Reset button)
- `BrandingState` type from `../_lib/load-branding`
- `LogoUploader` from `./logo-uploader`
- `ColorPickerInput` from `./color-picker-input`
- `MiniPreviewCard` from `./mini-preview-card`
- `PreviewIframe` from `./preview-iframe`
- `relativeLuminance` from `@/lib/branding/contrast` (NEW — for the contrast warning)

**Imports to DROP:**
- `useTransition` (was used for `handleSaveBackground` — gone)
- `toast` from `"sonner"` (was used for `handleSaveBackground` — gone; ColorPickerInput's internal save still uses toast)
- `BackgroundShade` type (no longer surfaced in editor)
- `ShadePicker` (no longer rendered)
- `saveBrandingAction` (deleted in Task 3)

**New file structure:**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { relativeLuminance } from "@/lib/branding/contrast";
import type { BrandingState } from "../_lib/load-branding";
import { LogoUploader } from "./logo-uploader";
import { ColorPickerInput } from "./color-picker-input";
import { MiniPreviewCard } from "./mini-preview-card";
import { PreviewIframe } from "./preview-iframe";

interface BrandingEditorProps {
  state: BrandingState;
}

const NSI_BLUE = "#3B82F6";
const LUMINANCE_NEAR_WHITE_THRESHOLD = 0.85; // Matches Phase 17 PublicShell resolveGlowColor — single source of truth

/**
 * Phase 18 (BRAND-13..21): collapsed to two controls — logo + brand_primary.
 *
 * Layout: controls left column / MiniPreviewCard above PreviewIframe right column.
 * Order in left column: logo first, then color picker (identity before style).
 *
 * Color save: ColorPickerInput's default showSaveButton=true mode wires
 * savePrimaryColorAction directly. No top-level handler needed.
 *
 * Logo save: LogoUploader wires uploadLogoAction / deleteLogoAction directly.
 *
 * MP-04 JIT lock honored throughout — runtime hex flows via inline style only
 * (see MiniPreviewCard implementation).
 */
export function BrandingEditor({ state }: BrandingEditorProps) {
  const [primaryColor, setPrimaryColor] = useState(state.primaryColor ?? NSI_BLUE);
  const [logoUrl, setLogoUrl] = useState<string | null>(state.logoUrl);

  // Contrast warning: matches Phase 17 PublicShell luminance > 0.85 fallback threshold.
  // Defensive try/catch — bad hex never crashes the editor (mirrors public-shell.tsx).
  let isNearWhite = false;
  try {
    isNearWhite = relativeLuminance(primaryColor) > LUMINANCE_NEAR_WHITE_THRESHOLD;
  } catch {
    isNearWhite = false;
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* LEFT COLUMN — controls */}
      <section className="space-y-8">
        {/* Logo first */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Logo</h2>
          <p className="text-sm text-muted-foreground">
            Upload a PNG logo (max 2 MB). It will appear in your booking page header and emails.
          </p>
          <LogoUploader
            currentLogoUrl={logoUrl}
            onUpload={(url) => setLogoUrl(url)}
            onDelete={() => setLogoUrl(null)}
          />
        </div>

        {/* Brand primary color second */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Booking page primary color</h2>
          <p className="text-sm text-muted-foreground">
            Used for the background glow, CTAs, and slot selection on your public booking pages.
          </p>
          <ColorPickerInput value={primaryColor} onChange={setPrimaryColor} />

          {/* Reset to NSI blue escape hatch */}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrimaryColor(NSI_BLUE)}
            >
              Reset to NSI blue ({NSI_BLUE})
            </Button>
          </div>

          {/* Contrast warning — informational only, save still allowed */}
          {isNearWhite ? (
            <p className="text-sm text-amber-600">
              This color may be hard to read on white backgrounds.
            </p>
          ) : null}
        </div>
      </section>

      {/* RIGHT COLUMN — MiniPreviewCard above PreviewIframe */}
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Mini preview</h2>
          <p className="text-sm text-muted-foreground">
            Updates instantly as you change logo or color — before you save.
          </p>
          <MiniPreviewCard
            brandPrimary={primaryColor}
            logoUrl={logoUrl}
            accountName={state.accountSlug}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-medium">Live booking page</h2>
          <p className="text-sm text-muted-foreground">
            Real embed widget — updates after you save the color.
          </p>
          <PreviewIframe
            accountSlug={state.accountSlug}
            firstActiveEventSlug={state.firstActiveEventSlug}
            previewColor={primaryColor}
            previewLogo={logoUrl}
          />
        </div>
      </section>
    </div>
  );
}
```

**Key implementation notes:**
- `NSI_BLUE = "#3B82F6"` is the brand reset target per CONTEXT.md. Note: the parent fallback for missing `state.primaryColor` is also `NSI_BLUE` (per the v1.2 lock that stripped legacy `#0A2540` chrome). This is INTENTIONAL — Wave 1 left `DEFAULT_BRAND_PRIMARY = "#0A2540"` in `read-branding.ts` for legacy data integrity, but the editor's UX default for NEW accounts is NSI blue. If `state.primaryColor` is null, the editor displays NSI blue and prompts the user to either keep it or change it.
- Reset button: `<Button variant="outline" size="sm" onClick={() => setPrimaryColor(NSI_BLUE)}>` — clears any custom color back to NSI blue. The `ColorPickerInput`'s internal `useState`/`localText` sync at `color-picker-input.tsx:64-74` propagates the change correctly (Pitfall 5 from RESEARCH.md — already handled by existing pattern).
- Contrast warning: `relativeLuminance(primaryColor) > 0.85` matches PublicShell's `resolveGlowColor` threshold exactly (`public-shell.tsx:33-39`). Copy: "This color may be hard to read on white backgrounds." Color: `text-amber-600` (Tailwind warning yellow). Save remains enabled — informational ONLY.
- Defensive `try/catch` around `relativeLuminance` mirrors `public-shell.tsx:33-39` — bad hex strings (mid-typing) don't crash the editor.
- The `accountName={state.accountSlug}` pass uses the account slug as the human-readable initial source. If Andrew prefers a different label, that's a Wave 3 visual-gate fix-up.
- PreviewIframe call site is **byte-for-byte identical** to the existing one (BRAND-21 verify-only contract): `accountSlug`, `firstActiveEventSlug`, `previewColor={primaryColor}`, `previewLogo={logoUrl}`. The `?previewColor=` plumbing in `preview-iframe.tsx:49-55` is unchanged — re-keys the iframe on every color change.

**Verify after edit that the following are GONE from the file:**
- `useTransition` import
- `toast` import
- `BackgroundShade` import
- `ShadePicker` import + JSX usage
- `saveBrandingAction` import + call
- `handleSaveBackground` function
- `backgroundColor`, `backgroundShade`, `sidebarColor` state hooks
- "Sidebar color" `<h2>` block + ColorPickerInput
- "Page background" `<h2>` block + ColorPickerInput
- "Background shade" `<h2>` block + ShadePicker
- "Save background" `<Button>`
- The OLD `<MiniPreviewCard sidebarColor={...} pageColor={...} primaryColor={...} />` props
  </action>
  <verify>
1. Read the rewritten file. Confirm:
   - Imports include `relativeLuminance` from `@/lib/branding/contrast`
   - Imports do NOT include: `useTransition`, `toast`, `BackgroundShade`, `ShadePicker`, `saveBrandingAction`
   - Two `<h2>` headings in left column ("Logo" + "Booking page primary color") — no third
   - `<MiniPreviewCard brandPrimary={primaryColor} logoUrl={logoUrl} accountName={state.accountSlug} />` (new prop names)
   - Reset button with `onClick={() => setPrimaryColor(NSI_BLUE)}` and label including `#3B82F6`
   - Contrast warning conditional on `isNearWhite` with the exact copy: "This color may be hard to read on white backgrounds."
   - PreviewIframe call site unchanged (4 props: accountSlug, firstActiveEventSlug, previewColor, previewLogo)
   - Right column `<section>` stacks MiniPreviewCard ABOVE PreviewIframe

2. Run typecheck:
   ```bash
   npx tsc --noEmit 2>&1 | tee /tmp/tsc-wave2-task2.log | grep -E "branding-editor" | head -20
   ```
   Expect: zero errors in `branding-editor.tsx` (Wave 1's deferred errors now resolved). Errors may still appear in `actions.ts` until Task 3 — that's fine for THIS task's gate.

3. Grep for forbidden references:
   ```bash
   grep -nE "ShadePicker|saveBrandingAction|state\.backgroundColor|state\.backgroundShade|state\.sidebarColor|handleSaveBackground" app/\(shell\)/app/branding/_components/branding-editor.tsx
   ```
   Expect: zero hits.

4. Grep for required new behavior:
   ```bash
   grep -nE "relativeLuminance|0\.85|NSI_BLUE|#3B82F6|This color may be hard" app/\(shell\)/app/branding/_components/branding-editor.tsx
   ```
   Expect: presence of all five.
  </verify>
  <done>
- BrandingEditor file rewritten with 2 controls only
- Layout: controls left / MiniPreviewCard above PreviewIframe right
- Logo first, color picker second
- Reset to NSI blue button present
- Contrast warning gated on `relativeLuminance > 0.85`
- 3 deprecated picker blocks removed
- saveBrandingAction call removed (Task 3 will delete the action itself)
  </done>
</task>

<task type="auto">
  <name>Task 3: Delete saveBrandingAction + drop unused schema imports from actions.ts</name>
  <files>app/(shell)/app/branding/_lib/actions.ts</files>
  <action>
Edit `app/(shell)/app/branding/_lib/actions.ts`:

1. **Drop the unused imports** at lines 5-12:
   - Remove from the import block: `backgroundColorSchema`, `backgroundShadeSchema`, `sidebarColorSchema`
   - Keep: `primaryColorSchema`, `MAX_LOGO_BYTES`
   - Resulting import:
     ```ts
     import { primaryColorSchema, MAX_LOGO_BYTES } from "./schema";
     ```
2. **Drop the BackgroundShade type import** at line 12:
   ```ts
   import type { BackgroundShade } from "@/lib/branding/types";
   ```
   REMOVE this entire line. No longer needed.
3. **Delete `saveBrandingAction`** (lines 136-202 in current file — the entire JSDoc block + function body):
   - Starts at the JSDoc comment `/**\n * Phase 12.6: persist background_color, background_shade, ...`
   - Ends at the closing `}` of the function body
   - DELETE the whole block. Per RESEARCH.md Q2, no callers exist outside `branding-editor.tsx` (which Task 2 just removed the call from).
4. **Keep UNCHANGED:**
   - `getOwnerAccountIdOrThrow` helper (lines 26-32)
   - `uploadLogoAction` (lines 34-93)
   - `savePrimaryColorAction` (lines 95-116) — this is the action `ColorPickerInput` calls in its default `showSaveButton=true` mode (`color-picker-input.tsx:106-124`).
   - `deleteLogoAction` (lines 118-134)
   - `ActionResult<T>` type (lines 14-19)

**Schema file (`app/(shell)/app/branding/_lib/schema.ts`):** Do NOT delete or modify. Per RESEARCH.md, `tests/branding-schema.test.ts` imports `backgroundColorSchema`, `backgroundShadeSchema`, `brandingBackgroundSchema` from this file — keeping them avoids breaking that test (Phase 20 deletes the file). Just make sure `actions.ts` no longer imports them.
  </action>
  <verify>
1. Read the edited `actions.ts`. Confirm:
   - Import line: `import { primaryColorSchema, MAX_LOGO_BYTES } from "./schema";` (no other schema imports)
   - No `import type { BackgroundShade }` line
   - No `saveBrandingAction` function or its JSDoc
   - `uploadLogoAction`, `savePrimaryColorAction`, `deleteLogoAction` all PRESENT and unchanged
2. Grep verification:
   ```bash
   grep -nE "saveBrandingAction|backgroundColorSchema|backgroundShadeSchema|sidebarColorSchema|BackgroundShade" app/\(shell\)/app/branding/_lib/actions.ts
   ```
   Expect: zero hits.
3. Grep across the entire app for `saveBrandingAction` to confirm no orphan callers:
   ```bash
   grep -rn "saveBrandingAction" app/ lib/ tests/ 2>/dev/null
   ```
   Expect: zero hits.
4. Run final typecheck across the whole project:
   ```bash
   npx tsc --noEmit 2>&1 | tee /tmp/tsc-wave2-final.log | head -50
   ```
   Expect: ONLY pre-existing baseline errors (`tests/branding-gradient.test.ts` per STATE.md:123). Zero errors elsewhere.
5. Run build (this is the Wave 2 final gate before Wave 3 deploy):
   ```bash
   npm run build 2>&1 | tee /tmp/build-wave2.log | tail -30
   ```
   Expect: build succeeds.
6. Verify `preview-iframe.tsx` was NOT modified (BRAND-21 verify-only):
   ```bash
   git diff app/\(shell\)/app/branding/_components/preview-iframe.tsx
   ```
   Expect: empty diff (no changes).
  </verify>
  <done>
- `saveBrandingAction` deleted from `actions.ts`
- `backgroundColorSchema`, `backgroundShadeSchema`, `sidebarColorSchema` imports removed
- `BackgroundShade` type import removed
- `uploadLogoAction`, `savePrimaryColorAction`, `deleteLogoAction` unchanged
- Zero `saveBrandingAction` references anywhere in the repo
- `tsc --noEmit` clean (only pre-existing `branding-gradient.test.ts` baseline)
- `npm run build` succeeds
- `preview-iframe.tsx` confirmed unmodified (BRAND-21)
  </done>
</task>

</tasks>

<verification>
**Wave 2 atomic gate (all 3 files commit together):**

1. `npx tsc --noEmit` produces ONLY pre-existing baseline errors (`tests/branding-gradient.test.ts` per STATE.md:123). Zero NEW errors in any file.
2. `npm run build` succeeds (Vercel-equivalent).
3. Grep verification:
   ```bash
   # No editor-side or action-side references to the dropped fields
   grep -rnE "saveBrandingAction|state\.backgroundColor|state\.backgroundShade|state\.sidebarColor" app/\(shell\)/app/branding/
   # Expect: zero hits

   # ShadePicker no longer imported (file still on disk for Phase 20 to delete)
   grep -rn "ShadePicker" app/\(shell\)/app/branding/_components/branding-editor.tsx
   # Expect: zero hits (the file shade-picker.tsx still exists but is no longer imported)

   # JIT-lock compliance in MiniPreviewCard
   grep -n "bg-\[" app/\(shell\)/app/branding/_components/mini-preview-card.tsx
   # Expect: zero hits (no dynamic-hex Tailwind classes)
   ```
4. PreviewIframe is unmodified:
   ```bash
   git diff app/\(shell\)/app/branding/_components/preview-iframe.tsx
   # Expect: empty diff
   ```
5. Atomic commit boundary: ALL THREE FILES (`branding-editor.tsx`, `mini-preview-card.tsx`, `actions.ts`) staged and committed in ONE commit. MP-03 lock — never an intermediate commit with mismatched prop interface.
6. **No Vercel deploy in this plan.** Wave 3 visual-gate plan deploys + Andrew eyeballs.
</verification>

<success_criteria>
1. `app/(shell)/app/branding/_components/branding-editor.tsx` rewritten — 2 controls only, new layout, reset button, contrast warning.
2. `app/(shell)/app/branding/_components/mini-preview-card.tsx` rewritten — faux public booking page composition (CONTEXT.md spec exactly).
3. `app/(shell)/app/branding/_lib/actions.ts` shrunk — `saveBrandingAction` deleted; deprecated schema + type imports dropped.
4. tsc clean (baseline only); build clean.
5. ShadePicker file (`shade-picker.tsx`) untouched on disk (Phase 20 territory). Grep confirms no imports remaining.
6. PreviewIframe untouched (BRAND-21 verify-only).
7. **Single atomic git commit** covering the 3 modified files. Suggested message:
   ```
   feat(18-02): collapse branding editor to 2 controls + rebuild MiniPreviewCard

   - Strip sidebar_color, background_color, ShadePicker from BrandingEditor JSX
   - Logo first, brand_primary color picker second (controls left column)
   - MiniPreviewCard above PreviewIframe in right column
   - Reset to NSI blue (#3B82F6) button + relativeLuminance > 0.85 contrast warning
   - MiniPreviewCard rebuilt as faux public booking page (gray-50 + brand_primary blob + white card + 3-button slot picker + Powered-by-NSI + faux pill)
   - Delete saveBrandingAction (no callers); drop deprecated schema + BackgroundShade imports
   - PreviewIframe untouched (BRAND-21 verify-only)

   Closes BRAND-13, BRAND-14, BRAND-15, BRAND-16, BRAND-17, BRAND-18, BRAND-21.
   ```
</success_criteria>

<output>
After completion, create `.planning/phases/18-branding-editor-simplification/18-02-editor-and-preview-SUMMARY.md` capturing:
- File deltas (lines before/after for each of the 3 files)
- Confirm 2 controls only on `/app/branding`; layout matches CONTEXT.md
- MiniPreviewCard composition checklist (gray-50 / blob / white card / 3 buttons w/ middle selected / Powered-by / pill)
- Contrast warning + Reset button present
- saveBrandingAction deleted; no callers anywhere in repo
- tsc + build state at end of wave
- Discretion calls made (slot labels, selected slot index, pill content, accountName source)
- Hand-off to Wave 3: ready for Vercel deploy + Andrew eyeball
</output>
