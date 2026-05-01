---
phase: 18-branding-editor-simplification
plan: 03
type: execute
wave: 3
depends_on: ["18-01", "18-02"]
files_modified: []
autonomous: false

must_haves:
  truths:
    - "/app/branding deployed to Vercel preview shows exactly TWO controls (LogoUploader + brand_primary ColorPickerInput); 3 deprecated pickers gone from UI"
    - "MiniPreviewCard renders the faux public booking page composition: gray-50 base + brand_primary blob + white card + 3 slot buttons w/ middle selected + Powered-by-NSI + faux pill"
    - "Changing brand_primary in the picker updates MiniPreviewCard instantly (every keystroke) AND updates PreviewIframe on color save (re-key triggers iframe remount)"
    - "Reset to NSI blue (#3B82F6) button works — clicking it sets the color picker back to #3B82F6 and updates both previews"
    - "Contrast warning fires for high-luminance colors (e.g., #FFFF00 yellow, #00FFFF cyan) and does NOT fire for medium/dark colors (NSI blue #3B82F6, magenta #EC4899, navy #0A2540). Save remains enabled in both cases."
    - "PreviewIframe renders the actual /embed/[account]/[event-slug] page with the new color reflected via ?previewColor= (BRAND-21 verification)"
    - "Owner shell (/app), auth pages (/login), and public booking pages (/nsi, /nsi-rls-test) all unchanged from Phase 17 baseline (zero regression)"
  artifacts:
    - path: "(deployed Vercel preview URL)"
      provides: "Live preview of simplified /app/branding editor + faux public-page MiniPreviewCard"
      contains: "(visual confirmation)"
  key_links:
    - from: "Andrew (visual reviewer)"
      to: "https://calendar-app-xi-smoky.vercel.app/app/branding"
      via: "browser eyeball test (logged in as owner)"
      pattern: "(human verification)"
    - from: "Andrew"
      to: "https://calendar-app-xi-smoky.vercel.app/nsi-rls-test"
      via: "no-regression visual check on Phase 17 surfaces"
      pattern: "(human verification)"
---

<objective>
Final visual gate (MN-01): deploy Phase 18 to Vercel preview and visually verify the simplified branding editor + new faux-public-page MiniPreviewCard. Mirror pattern from Phase 17-09 visual-gate plan.

Purpose: ROADMAP Phase 18 success criteria 1, 2, 3 require Andrew's eyeball confirmation on a live preview. The MiniPreviewCard rebuild (BRAND-17) is a visual rebuild — its scale, blob saturation, card padding, and slot-button density can only be validated on the deployed page. Pitfall MN-01 explicitly calls for deploy-and-eyeball.

Output: Andrew approves all 8 gates or returns specific issues for fix-up commits.
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
@.planning/phases/18-branding-editor-simplification/18-02-editor-and-preview-SUMMARY.md
</context>

<preamble>
## v1.2 Visual Locks (mandatory restate)
1-6. (See REQUIREMENTS.md preamble)

## Phase 18 Visual Gate Scope (MN-01)
Mirrors the Phase 17-09 visual-gate pattern:
- Push to GitHub → triggers Vercel preview deploy
- Andrew visits the deployed `/app/branding` editor
- Verifies 8 gates covering simplified editor, MiniPreviewCard composition, live update, reset button, contrast warning, PreviewIframe BRAND-21, and no-regression on Phase 15/16/17 surfaces

## Test Data Required
- Owner login credentials (Andrew's existing account)
- At least one test account with brand_primary set to NSI blue (`nsi`) — for sanity check
- At least one test account with brand_primary set to a non-blue color (`nsi-rls-test` magenta) — for color-swap verification
- For BRAND-21 PreviewIframe verification: at least one active event_type on the test account so the embed has a target slug

## Requirement coverage (this plan)
- MN-01 (visual gate, deploy + eyeball): covered
- All Phase 18 success criteria from ROADMAP.md verified
- BRAND-21 (PreviewIframe `?previewColor=` plumbing) verified live
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Deploy Phase 18 to Vercel preview + record preview URL</name>
  <files></files>
  <action>
Phase 18 changes (Wave 1 + Wave 2 commits) are in the local working tree. Push to GitHub to trigger Vercel preview deployment.

```bash
# Confirm both atomic commits are present
git log --oneline -5
# Expect to see (top-down):
#   feat(18-02): collapse branding editor to 2 controls + rebuild MiniPreviewCard
#   refactor(18-01): shrink Branding type + reader + editor loader (BRAND-19, BRAND-20)
#   docs(18): create phase plan
#   docs(18): capture phase context
#   ...

# Push to trigger Vercel deploy
git push
```

Then wait for Vercel deploy to complete. The base preview URL pattern per STATE.md is `https://calendar-app-xi-smoky.vercel.app/`.

Confirm the build succeeded:
- Check Vercel dashboard for green build status.
- Visit the preview URL — confirm 200 OK.

```bash
curl -I https://calendar-app-xi-smoky.vercel.app/app/branding
# Expect HTTP 200 (will be 307/redirect if not authenticated — that's also healthy)

curl -I https://calendar-app-xi-smoky.vercel.app/nsi
# Expect HTTP 200 (Phase 17 surface — confirm no regression)
```

Record the deployed preview URL for the checkpoint task.
  </action>
  <verify>
1. `git log -1` shows the Phase 18 Wave 2 commit at HEAD.
2. `git log --oneline -3` shows BOTH 18-01 and 18-02 commits.
3. Vercel dashboard shows the deploy as successful (green).
4. `curl -I https://calendar-app-xi-smoky.vercel.app/app/branding` returns HTTP 200 or 307 (redirect to login is healthy).
5. `curl -I https://calendar-app-xi-smoky.vercel.app/nsi` returns HTTP 200 (Phase 17 surface unchanged).
  </verify>
  <done>Phase 18 commits pushed to GitHub; Vercel preview deploy succeeded; preview URL is live.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Phase 18 simplified the `/app/branding` editor to two controls (logo + brand_primary). The 3 deprecated pickers (sidebar color, page background, background shade) are gone from the UI and from server-side write paths. MiniPreviewCard rebuilt as a faux PUBLIC booking page preview using Phase 17 PublicShell visual grammar at miniature scale (gray-50 + brand_primary blob + white card + 3-button slot picker w/ middle selected + tiny Powered-by-NSI + faux pill). PreviewIframe plumbing unchanged. tsc + build clean.
  </what-built>
  <how-to-verify>
**Open multiple browser tabs to the deployed preview URL. Verify each gate below.**

### Gate 1 — Simplified `/app/branding` editor surface (BRAND-13, BRAND-14)
1. Log in as owner. Visit `https://calendar-app-xi-smoky.vercel.app/app/branding`
2. Confirm the LEFT COLUMN shows EXACTLY:
   - [ ] **"Logo"** heading + LogoUploader (drag-and-drop or file picker)
   - [ ] **"Booking page primary color"** heading + ColorPickerInput + Reset button + (optional) contrast warning
3. Confirm the LEFT COLUMN does NOT show:
   - [ ] No "Sidebar color" picker
   - [ ] No "Page background" picker
   - [ ] No "Background shade" picker (ShadePicker 3-button toggle)
   - [ ] No "Save background" button
4. Color picker description reads exactly: "Used for the background glow, CTAs, and slot selection on your public booking pages." (BRAND-14)

### Gate 2 — MiniPreviewCard composition (BRAND-17)
1. Still on `/app/branding`, look at the RIGHT COLUMN top section ("Mini preview" heading)
2. Confirm the MiniPreviewCard shows:
   - [ ] `bg-gray-50` outer (light gray, NOT pure white)
   - [ ] A colored blob in the current `brand_primary` color, top-center (visible but not dominating)
   - [ ] A faux glass pill at the top (logo if you have one uploaded, OR an initial circle in `brand_primary` with the first letter of your account name)
   - [ ] A white card centered (`rounded-xl border border-gray-200 bg-white shadow-sm`)
   - [ ] 3 faux slot buttons in a row inside the card — the MIDDLE one filled with the current `brand_primary` color, the other two outlined/white
   - [ ] Tiny "Powered by North Star Integrations" text at the bottom of the card (`text-[10px] text-gray-400` — small + light gray)

### Gate 3 — Live update on color change
1. Click the color picker (or paste a hex like `#EC4899` magenta into the text input)
2. Confirm:
   - [ ] MiniPreviewCard blob color updates INSTANTLY as you type/click
   - [ ] MiniPreviewCard middle slot button color updates INSTANTLY
   - [ ] MiniPreviewCard initial-circle pill (if no logo) color updates INSTANTLY
3. Click "Save color" inside ColorPickerInput
4. Confirm:
   - [ ] Toast appears: "Color saved" (or similar — exact copy from existing `savePrimaryColorAction` flow)
   - [ ] PreviewIframe (right column bottom — "Live booking page" heading) re-keys and shows the new color in the actual embed widget (slot picker selected state matches the new brand_primary)

### Gate 4 — Reset to NSI blue button
1. Set the color picker to a custom color (e.g., magenta `#EC4899`)
2. Click the "Reset to NSI blue (#3B82F6)" button
3. Confirm:
   - [ ] ColorPickerInput text input shows `#3B82F6`
   - [ ] Native color swatch updates to NSI blue
   - [ ] MiniPreviewCard blob + selected slot button update to NSI blue instantly
4. Click "Save color" to persist the reset

### Gate 5 — Contrast warning behavior
1. Type or paste a near-white color: `#FFFF00` (yellow) or `#FFFFFF` (white) into ColorPickerInput
2. Confirm:
   - [ ] Warning text appears: "This color may be hard to read on white backgrounds." (text in `text-amber-600` warning color)
   - [ ] Save button is STILL enabled (informational only — not a blocker)
3. Now type a medium/dark color: `#3B82F6` (NSI blue) or `#0A2540` (NSI navy) or `#EC4899` (magenta)
4. Confirm:
   - [ ] Warning is GONE for these colors

### Gate 6 — PreviewIframe BRAND-21 verification
1. Set the color picker to `#10B981` (emerald)
2. Click "Save color"
3. Confirm:
   - [ ] PreviewIframe (right column, "Live booking page") reloads
   - [ ] The actual embed widget renders with EMERALD-tinted glow + EMERALD-selected slot when you click on a time slot
4. View the iframe URL in browser DevTools → confirm `?previewColor=%2310B981` (URL-encoded) is present in the src
5. Change to a different color → confirm the iframe reloads (new key, new src)

### Gate 7 — Layout sanity (CONTEXT.md lock)
1. On desktop viewport (`md+`), confirm:
   - [ ] Two-column layout — controls LEFT, previews RIGHT
   - [ ] In RIGHT column: MiniPreviewCard sits ABOVE PreviewIframe (stacked, not side-by-side)
2. On mobile viewport (`< md`), confirm:
   - [ ] Single column — controls first, then previews
   - [ ] No horizontal scrollbar; nothing is clipped

### Gate 8 — No-regression on Phase 15/16/17 surfaces
1. Visit `https://calendar-app-xi-smoky.vercel.app/app` (owner dashboard)
   - [ ] Owner shell (sidebar + glass pill + glow + gray-50) UNCHANGED from Phase 15/17 baseline
2. Visit `https://calendar-app-xi-smoky.vercel.app/login`
   - [ ] Auth shell UNCHANGED from Phase 16 baseline
3. Visit `https://calendar-app-xi-smoky.vercel.app/nsi`
   - [ ] Public booking page UNCHANGED from Phase 17 baseline (NSI blue glow + glass pill + Powered-by-NSI footer)
4. Visit `https://calendar-app-xi-smoky.vercel.app/nsi-rls-test`
   - [ ] Public booking page UNCHANGED — magenta glow + magenta pill initial + footer
5. Visit `https://calendar-app-xi-smoky.vercel.app/embed/nsi/[any-event-slug]` (or use existing embed test URL)
   - [ ] Embed widget UNCHANGED — NSI blue selected slot + footer inside iframe (Phase 17 CP-05 still holds)

### Reporting issues
If ANY gate fails, describe the issue precisely (which gate, what was wrong, screenshot if possible). I will create a fix-up commit and re-deploy. Do NOT approve until ALL 8 gates pass.

### Common fix-up paths (heads-up for what may surface)
- **MiniPreviewCard scale wrong** (blob too dim / too bright / card padding off / slot buttons cramped): adjust `h-56` height, `h-32 w-32` blob size, or `gap-1.5` between buttons in `mini-preview-card.tsx`.
- **Pill content unclear at miniature scale**: Claude's discretion call on `accountName` source — may need to drop name or use logo only.
- **Reset button placement looks off**: tweak parent `<div>` margin/padding in `branding-editor.tsx`.
- **Contrast warning copy needs adjustment**: edit the literal string in `branding-editor.tsx`.
- **`accountName` unwieldy** (e.g., shows full slug like "nsi-rls-test"): consider truncating to first letter only for the pill, or hardcoding "Preview" instead.
  </how-to-verify>
  <resume-signal>Type "approved" if all 8 gates pass. Otherwise describe the failing gate(s) precisely so a fix-up commit can be made.</resume-signal>
</task>

</tasks>

<verification>
This plan is verified by Andrew's "approved" response on the visual gate. Once approved:
1. Phase 18 success criteria 1, 2, 3 from ROADMAP.md are confirmed (UI 2 controls only, MiniPreviewCard faux public page, brand_primary save updates PreviewIframe).
2. Success criterion 4 (tsc clean) was already verified at end of Wave 2 — re-confirmed by passing Vercel build in Task 1.
3. Success criterion 5 (deploy succeeds) confirmed by Task 1.
4. All 9 BRAND-13..21 requirements visually validated on prod-like preview.
5. No-regression confirmed for owner shell + auth + Phase 17 public surfaces + embed.
</verification>

<success_criteria>
1. Phase 18 deployed to Vercel preview successfully.
2. All 8 visual gates approved by Andrew.
3. STATE.md, ROADMAP.md, REQUIREMENTS.md updated to mark Phase 18 complete (handled by execute-phase orchestrator phase-completion bundle, not in this plan).
</success_criteria>

<output>
After Andrew approves, create `.planning/phases/18-branding-editor-simplification/18-03-visual-gate-SUMMARY.md` capturing:
- Preview URL deployed
- Date of Andrew's approval
- Any fix-up commits made between deploy and approval (with brief description of each)
- Confirm 8/8 gates passed
- Locked decisions surfaced during gate (e.g., final accountName source choice, slot label text, selected slot index — confirm what shipped vs what was planned)
- Phase 18 ready for marking complete in ROADMAP.md
</output>
