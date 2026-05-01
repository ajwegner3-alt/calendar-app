---
phase: 18-branding-editor-simplification
plan: 02
subsystem: branding
tags: [typescript, react, nextjs, branding, ui, refactor]

# Dependency graph
requires:
  - phase: 18-01-types-and-reader
    provides: "BrandingState with 5 fields (no deprecated chrome fields)"
  - phase: 17-public-surfaces-and-embed
    provides: "PublicShell visual grammar (gray-50 + blob + glass pill + white card + Powered-by-NSI) mirrored by MiniPreviewCard"
provides:
  - "BrandingEditor collapsed to 2 controls: LogoUploader + brand_primary ColorPickerInput"
  - "MiniPreviewCard rebuilt as faux public booking page preview (BRAND-17)"
  - "saveBrandingAction deleted — zero server write paths for 4 deprecated fields (BRAND-18)"
  - "Contrast warning (relativeLuminance > 0.85) + Reset to NSI blue (#3B82F6) button"
  - "tsc clean (only pre-existing tests/ baseline); npm run build clean"
affects:
  - "Phase 19 (email layer — no branding-editor dependency)"
  - "Phase 20 (CLEAN-07 deletes shade-picker.tsx file; CLEAN-04..06 deletes branding-gradient test)"
  - "Phase 21 (schema DROP — background_shade ENUM drop)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MP-04 JIT lock enforced: all runtime hex flows through inline style={{}} — never bg-[${color}] Tailwind dynamic classes"
    - "Atomic commit boundary (MP-03): prop interface change in MiniPreviewCard + BrandingEditor import-site update + saveBrandingAction deletion committed together"
    - "Contrast warning pattern: relativeLuminance > 0.85 threshold matches PublicShell resolveGlowColor — single source of truth in contrast.ts"
    - "Defensive try/catch around relativeLuminance mirrors public-shell.tsx:33-39 — bad hex mid-typing never crashes the editor"

key-files:
  created: []
  modified:
    - app/(shell)/app/branding/_components/branding-editor.tsx
    - app/(shell)/app/branding/_components/mini-preview-card.tsx
    - app/(shell)/app/branding/_lib/actions.ts

key-decisions:
  - "BRAND-18 intent resolved as deletion (not signature simplification): saveBrandingAction deleted entirely — zero remaining callers after editor rewrite, deletion prevents future regressions"
  - "MiniPreviewCard prop interface: {brandPrimary, logoUrl, accountName} — old {sidebarColor, pageColor, primaryColor} gone"
  - "accountName source: state.accountSlug (slug as display initial source; Wave 3 visual-gate may refine if needed)"
  - "NSI_BLUE constant = #3B82F6 in editor; DEFAULT_BRAND_PRIMARY = #0A2540 in read-branding.ts — both values kept separate"
  - "Selected slot index: middle (10:00) — center-of-attention principle draws eye to brand color"
  - "No dynamic-hex Tailwind classes anywhere in MiniPreviewCard or BrandingEditor (MP-04)"
  - "shade-picker.tsx stays on disk — Phase 20 CLEAN-07 deletes; Wave 2 just removes import/usage"

patterns-established:
  - "MiniPreviewCard as faux-public-page pattern: gray-50 base + brand_primary inline-style blob (blur 60px) + glass pill (logo or initial circle) + white rounded-xl card + 3-button slot picker (middle selected) + Powered-by footer"
  - "Reset button pattern: Button variant=outline size=sm that calls setState(NSI_BLUE) — one-click escape hatch"
  - "Contrast warning pattern: inline relativeLuminance check with try/catch, amber-600 text, informational only"

# Metrics
duration: 15min
completed: 2026-05-01
---

# Phase 18 Plan 02: Editor and Preview Summary

**BrandingEditor collapsed to 2 controls (logo + brand_primary), MiniPreviewCard rebuilt as faux public booking page (gray-50 + brand_primary blob + white card + 3-slot picker + Powered-by-NSI + faux pill), saveBrandingAction deleted — tsc and build clean, both Wave 1+2 commits pushed**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-01T23:10:00Z
- **Completed:** 2026-05-01T23:25:00Z
- **Tasks:** 3 (committed atomically as 1 code commit per MP-03 lock)
- **Files modified:** 3

## Accomplishments

- `branding-editor.tsx`: rewritten from 163 lines to 122 lines — 3 deprecated picker blocks removed, layout restructured (controls left / MiniPreviewCard above PreviewIframe right), Reset to NSI blue button + relativeLuminance > 0.85 contrast warning added
- `mini-preview-card.tsx`: rewritten from 66 lines to 105 lines — faux public booking page composition replaces faux-dashboard composition; new prop interface {brandPrimary, logoUrl, accountName}; MP-04 JIT lock enforced throughout
- `actions.ts`: saveBrandingAction (lines 136-202) deleted; backgroundColorSchema/backgroundShadeSchema/sidebarColorSchema imports removed; BackgroundShade type import removed; 3 remaining actions (uploadLogoAction, savePrimaryColorAction, deleteLogoAction) unchanged

## Task Commits

All 3 tasks committed atomically per MP-03 lock (prop interface change must land with import-site change):

1. **Tasks 1+2+3 (atomic):** `ccf61e0` — `feat(18-02): collapse branding editor to 2 controls + rebuild MiniPreviewCard`

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `app/(shell)/app/branding/_components/branding-editor.tsx` — 163 → 122 lines: 2 controls only, new layout, reset button, contrast warning
- `app/(shell)/app/branding/_components/mini-preview-card.tsx` — 66 → 105 lines: faux public booking page, new prop interface
- `app/(shell)/app/branding/_lib/actions.ts` — 202 → 127 lines: saveBrandingAction deleted + deprecated imports dropped

## File Deltas

| File | Before | After | Delta |
|---|---|---|---|
| branding-editor.tsx | 163 lines | 122 lines | -41 |
| mini-preview-card.tsx | 66 lines | 105 lines | +39 |
| actions.ts | 202 lines | 127 lines | -75 |
| **Net** | **431 lines** | **354 lines** | **-77** |

## MiniPreviewCard Composition Checklist

- [x] `bg-gray-50` base (outer wrapper)
- [x] Brand-primary blob: `linear-gradient(to top right, ${brandPrimary}, transparent)` with `blur(60px) opacity-40` via inline style (MP-04 JIT lock)
- [x] Glass pill at top: `bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm rounded-full` with logo or initial circle
- [x] Initial circle: `style={{ backgroundColor: brandPrimary }}` (MP-04 JIT lock)
- [x] White card: `rounded-xl border border-gray-200 bg-white p-4 shadow-sm`
- [x] 3-button slot picker: 9:00 (unselected) / 10:00 (selected with `style={{ backgroundColor: brandPrimary }}`) / 11:00 (unselected)
- [x] "Powered by North Star Integrations" `text-[10px] text-gray-400` at card bottom
- [x] All faux buttons: `tabIndex={-1} aria-hidden` (not interactive controls)
- [x] No `<BackgroundGlow>` import (full-viewport 2-blob pattern wrong at miniature scale)
- [x] No `<PoweredByNsi>` import (full-size component too large for mini card)
- [x] No dynamic-hex Tailwind classes anywhere

## Contrast Warning + Reset Button

- [x] Reset button: `<Button variant="outline" size="sm" onClick={() => setPrimaryColor(NSI_BLUE)}>Reset to NSI blue (#3B82F6)</Button>`
- [x] Contrast warning: `relativeLuminance(primaryColor) > 0.85` with defensive try/catch; copy: "This color may be hard to read on white backgrounds."; color: `text-amber-600`; Save remains enabled (informational only)
- [x] Threshold 0.85 matches Phase 17 PublicShell `resolveGlowColor` (single source of truth)

## saveBrandingAction Deletion

- [x] Function body (lines 136-202) deleted from actions.ts
- [x] backgroundColorSchema import removed from actions.ts
- [x] backgroundShadeSchema import removed from actions.ts
- [x] sidebarColorSchema import removed from actions.ts
- [x] `import type { BackgroundShade }` line removed from actions.ts
- [x] Zero `saveBrandingAction` references anywhere in repo (grep confirmed)
- [x] uploadLogoAction, savePrimaryColorAction, deleteLogoAction all UNCHANGED

## Discretion Calls Made

1. **Slot time labels:** 9:00 / 10:00 / 11:00 (vs. dashes) — times are more recognizable as a slot picker
2. **Selected slot index:** middle (10:00, index 1) — center-of-attention principle draws the eye to brand color
3. **Pill content:** logo if uploaded, else initial circle (no account name text in pill) — name would be illegible at miniature scale
4. **accountName source:** `state.accountSlug` — slug as display initial source; Wave 3 visual gate may refine if needed
5. **Faux event title strip:** 2 gray skeleton bars above slot grid — informative without being noisy

## tsc Gate Result

**ZERO errors in application code.** All errors in output are pre-existing test file baseline:
- `tests/branding-gradient.test.ts`: TS2307 `Cannot find module '@/lib/branding/gradient'` (Phase 17-08 baseline, Phase 20 deletes)
- `tests/bookings-api.test.ts`, `tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-cron.test.ts`, `tests/reminder-email-content.test.ts`: TS2305 missing mock exports + TS7006 implicit any (pre-existing maintenance backlog, STATE.md:123)

Wave 1's 3 deferred errors (`branding-editor.tsx` state.backgroundColor / state.backgroundShade / state.sidebarColor) now resolved.

## npm run build Result

Build succeeded. `/app/branding` rendered as `ƒ` (dynamic server-rendered) — expected. All routes listed clean.

## Decisions Made

- **BRAND-18 deletion vs. simplification:** Deleted `saveBrandingAction` entirely rather than emptying its signature. Rationale: zero remaining callers after editor rewrite; an empty function would be dead code that could confuse future developers; deletion achieves the intent (no write path for deprecated fields) more cleanly. Per plan preamble "BRAND-18 intent reconciliation."
- **Atomic commit boundary honored (MP-03):** All 3 files (branding-editor.tsx + mini-preview-card.tsx + actions.ts) committed together in one commit. Prop interface change in MiniPreviewCard and import-site change in BrandingEditor must be atomic.
- **shade-picker.tsx left on disk:** Phase 20 CLEAN-07 owns deletion. Wave 2 only removes import + JSX usage from branding-editor.tsx.
- **PreviewIframe untouched (BRAND-21):** Verified via `git diff` — empty diff. The `key={iframeSrc}` re-key behavior at preview-iframe.tsx:59 is intact.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed per spec. No bugs found, no blocking issues, no architectural changes.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. No DB changes in this wave.

## Next Phase Readiness

**Hand-off to Wave 3 (visual-gate plan, if planned):**
- Wave 1 (64164aa) + Wave 2 (ccf61e0) both pushed to `main` via `git push origin main`
- `npm run build` green — Vercel deploy should succeed
- `/app/branding` now shows 2 controls (logo + brand_primary) with MiniPreviewCard above PreviewIframe in right column
- Andrew should eyeball: faux public booking page preview in MiniPreviewCard; contrast warning fires on near-white colors; Reset button resets to #3B82F6; logo or initial circle in faux glass pill
- No regressions to public booking pages, embed, or auth surfaces (no changes outside the branding editor)

**Remaining Phase 18 work:** Phase 18 is 2/2 plans complete. Phase 19 (email layer simplification) is next.

---
*Phase: 18-branding-editor-simplification*
*Completed: 2026-05-01*
