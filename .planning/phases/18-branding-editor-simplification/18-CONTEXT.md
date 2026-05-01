# Phase 18: Branding Editor Simplification - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The `/app/branding` editor collapses to two controls — `LogoUploader` and `brand_primary` `ColorPickerInput`. The three deprecated pickers (`sidebar_color`, `background_color`, `background_shade`) are removed from the UI and from all server-side write paths (`saveBrandingAction`, `BrandingState`, `Branding` interface, `brandingFromRow`, accounts SELECT). `MiniPreviewCard` is rebuilt from a faux dashboard preview into a faux **public booking page** preview using the Phase 17 `PublicShell` visual language (gray-50 + brand_primary blob + white card + faux slot picker + Powered-by-NSI footer + faux pill). `PreviewIframe` plumbing (the `?previewColor=` query param feeding the real embed) is verified intact, not redesigned.

Out of scope: deleting the picker component files (`shade-picker.tsx` etc.) — that lives in Phase 20 (CLEAN-07/08/09). Out of scope: dropping the underlying DB columns — Phase 21. Out of scope: email layer — Phase 19.

</domain>

<decisions>
## Implementation Decisions

### Preview composition (page layout)

- **Keep both MiniPreviewCard and PreviewIframe.** MiniPreviewCard for instant brand_primary feedback while user iterates; PreviewIframe shows the real embed with the actual customer event slugs.
- **Desktop layout: controls left column, previews stacked right column.** MiniPreviewCard sits above PreviewIframe in the right column.
- **Control order in left column: logo uploader first, then brand_primary color picker.** Identity before style — natural mental model.
- Mobile layout (single column) and live-update wiring (whether MiniPreviewCard updates on change vs PreviewIframe waits for save) are at Claude's discretion in planning.

### Color picker UX

- **Inline contrast warning when `relativeLuminance(brand_primary) > 0.85`.** Reuse the same 0.85 threshold Phase 17 PublicShell uses for its glow fallback. Warning is informational only — the user can still click Save. Recommended copy: "This color may be hard to read on white backgrounds." Phase 17's defensive luminance fallback already protects the public page glow visually.
- **"Reset to NSI blue (#3B82F6)" button** next to the color picker. One-click revert escape hatch.
- Preset color swatches and hex input field validation behavior are at Claude's discretion (default: leave existing `ColorPickerInput` behavior unchanged unless presets clearly improve UX).

### Save flow

- **Match existing `saveBrandingAction` success/failure feedback.** Don't redesign toast/inline behavior. Phase 18 stays focused on stripping pickers and rebuilding the preview, not redesigning save UX.
- Unsaved-changes navigation guard is at Claude's discretion (default: match existing behavior — do not add a new `beforeunload` listener).

### MiniPreviewCard composition (Claude's discretion)

The faux public booking page preview should mirror Phase 17 `PublicShell` visual language at miniature scale:
- `bg-gray-50` base
- Blob in `brand_primary` (`blur-[60px] opacity-40` inline style — runtime hex via `style={{}}` per JIT lock)
- White card `bg-white rounded-xl border border-gray-200 p-4 shadow-sm` centered
- Faux slot picker (3 buttons, one selected with `bg-primary` driven by `brand_primary` inline style)
- Tiny "Powered by NSI" `text-[10px] text-gray-400` at card bottom
- Faux pill at top showing logo (or initial circle if no logo)

Specific decisions left to Claude: pill content (logo only vs logo + name vs co-branded), slot button label text (times vs dashes vs "Slot"), which slot is selected (first/middle), whether the card includes faux event title/duration above the slots. Pick whatever best previews how `brand_primary` affects the real public page.

### Claude's Discretion

- All 4 MiniPreviewCard composition micro-decisions (pill content, slot labels, selected-slot index, card header content)
- Mobile layout order
- Live-update wiring (MiniPreviewCard reactive vs PreviewIframe `?previewColor=` reactive)
- Color picker presets (whether to add, which palette)
- Hex input validation tightening
- Page intro/header copy (minimal h1 only vs h1 + description vs h1 + NSI-brand-lock explainer)
- Unsaved-changes guard

</decisions>

<specifics>
## Specific Ideas

- **Phase 17 PublicShell is the reference**: MiniPreviewCard should look like a tiny, faithful version of what a real public booking page looks like after Phase 17. Same visual grammar (glow + glass pill + white card + Powered-by-NSI), just shrunk.
- **"Reset to NSI blue" hex value is `#3B82F6`** — the NSI blue-500 token already in `:root` as `--color-primary`. Reuse, don't redefine.
- **Contrast warning threshold = 0.85 luminance** — match Phase 17 PublicShell's existing fallback threshold. Single source of truth so the warning fires exactly when the public page would visually fall back.

</specifics>

<deferred>
## Deferred Ideas

- **Color picker presets curated for trade contractors** — interesting but not requested; Claude has discretion. If added in Phase 18, keep palette small (5-8 swatches max). If not added, can be a v1.3+ enhancement.
- **`beforeunload` unsaved-changes guard** — out of Phase 18 scope unless Claude judges existing behavior is bad enough to fix in passing.
- **PreviewIframe redesign** — explicitly out of scope. BRAND-21 is a verification-only task: confirm `?previewColor=` query param still drives the new `PublicShell` correctly. No redesign.

</deferred>

---

*Phase: 18-branding-editor-simplification*
*Context gathered: 2026-05-01*
