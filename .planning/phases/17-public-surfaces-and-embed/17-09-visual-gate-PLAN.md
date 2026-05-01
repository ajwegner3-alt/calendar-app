---
phase: 17-public-surfaces-and-embed
plan: 09
type: execute
wave: 5
depends_on: ["17-08"]
files_modified: []
autonomous: false

must_haves:
  truths:
    - "Public booking page (/nsi) renders with NSI blue glow + glass pill + Powered by North Star Integrations footer"
    - "Public booking page (/nsi-rls-test) renders with magenta glow — confirming brand_primary drives BackgroundGlow color"
    - "Embed widget (/embed/nsi/[event-slug]) selected slot is NSI blue"
    - "Embed widget (/embed/nsi-rls-test/[event-slug]) selected slot is magenta — confirming embed --primary override works (CP-05)"
    - "Owner shell (/app) and auth pages (/login) render unchanged from Phase 15/16 baseline (zero regression)"
  artifacts:
    - path: "(deployed Vercel preview URL)"
      provides: "Live preview of all 5 public surfaces + embed restyle"
      contains: "(visual confirmation)"
  key_links:
    - from: "Andrew (visual reviewer)"
      to: "https://calendar-app-xi-smoky.vercel.app/{account-slug}"
      via: "browser eyeball test with multiple branded test accounts"
      pattern: "(human verification)"
---

<objective>
Final visual gate (MN-01): deploy Phase 17 to Vercel preview and visually verify the new public-surface visual language with multiple branded test accounts. This is the canonical "no regression" checkpoint that has been the project pattern since Phase 15.

Purpose: REQUIREMENTS.md Phase 17 success criteria require Andrew's eyeball confirmation of the visual change on a live preview. Test accounts span the brand-color spectrum (NSI blue, magenta, emerald, navy) to catch any color-specific edge cases (e.g., near-white fallback trigger, contrast issues, blob clipping at the no-sidebar containing block).

Output: Confirmed visual sign-off on the live preview. Andrew approves all gates or returns specific issues for fix-up commits.
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
</context>

<preamble>
## v1.2 Visual Locks
1-6. (See REQUIREMENTS.md preamble)

## Phase 17 Visual Gate Scope (MN-01)
Per Phase 15 reference-UI adaptation rule (STATE.md): "Visual-effect offsets ported from a different containing-block geometry MUST be validated on the actual deployment target via temp render → revert flow. Do not assume offsets transfer."

The BackgroundGlow blob offsets (`calc(50% + 100px)` top, `calc(50% + 0px)` lower) were validated in Phase 15-01 against the OWNER shell's sidebar-offset containing block. The PUBLIC pages have no sidebar — the containing block is the full viewport. This gate is the chance to confirm the offsets translate correctly to the no-sidebar geometry.

**Likely outcome:** Offsets translate fine (the lower blob is centered horizontally, the top blob is offset right of center — both make sense in either geometry). But this gate is non-negotiable per Phase 15's rule.

## Test accounts (must verify all)
- `nsi` — NSI blue (#3B82F6) — sanity check (matches default fallback)
- `nsi-rls-test` — magenta — high-contrast verification of brand_primary driving glow
- emerald test account (whichever was set up in earlier phases) — green-spectrum verification
- navy test account (whichever was set up in earlier phases) — dark-color verification (NEAR the threshold for the luminance fallback)

If any of the 4 test accounts is missing, Andrew creates a new account with the missing color via owner branding editor BEFORE this gate runs.

## Requirement coverage
- MN-01 (visual gate, multiple branded test accounts): covered
- All Phase 17 success criteria from ROADMAP.md verified
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Deploy Phase 17 to Vercel preview + record preview URL</name>
  <files></files>
  <action>
Phase 17 changes are in the local working tree. Push to GitHub to trigger Vercel preview deployment.

```bash
git add .
git status
# Confirm only Phase 17 files (Plans 17-01..08 outputs + their summaries) are staged.
# If unrelated files appear, abort and investigate.

git commit -m "feat(17): public surfaces + embed re-skin

Phase 17 complete (Plans 17-01..08):
- BackgroundGlow MP-10 fix (blob 2 terminus → transparent)
- New PoweredByNsi footer + Header public variant
- New PublicShell (replaces BrandedPage)
- 5 public surfaces migrated to PublicShell
- not-found + TokenNotActive re-skinned with bg-gray-50
- EmbedShell restyled (bg-gray-50 + --primary override + footer)
- mini-preview-card migrated; BrandedPage + GradientBackdrop + NSIGradientBackdrop + lib/branding/gradient.ts deleted

Closes PUB-01..12, HDR-05..06, EMBED-08..11."

git push
```

Then wait for Vercel deploy to complete. Check status:

```bash
# Use the Vercel CLI if available, or visit the Vercel dashboard.
# Preview URL pattern: https://calendar-app-xi-smoky.vercel.app/{path}
```

Record the deployed preview URL. The base URL pattern for this project per STATE.md is `https://calendar-app-xi-smoky.vercel.app/`. Confirm the build succeeded:
- Check Vercel dashboard for green build status.
- Visit the preview URL — confirm it returns 200 OK on root.
  </action>
  <verify>
1. `git log -1` shows the Phase 17 commit at HEAD.
2. Vercel dashboard shows the deploy as successful (green).
3. `curl -I https://calendar-app-xi-smoky.vercel.app/nsi` returns HTTP 200.
4. `curl -I https://calendar-app-xi-smoky.vercel.app/embed/nsi/[any-event-slug]` returns HTTP 200.
  </verify>
  <done>Phase 17 commit pushed to GitHub; Vercel preview deploy succeeded; preview URL is live.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Phase 17 public-surface re-skin deployed to live Vercel preview. All 5 public booking surfaces and the embed widget now use the new NSI visual language with customer brand_primary driving the BackgroundGlow tint. PublicShell replaces BrandedPage. PoweredByNsi footer renders on every public page and inside every embed.
  </what-built>
  <how-to-verify>
**Open multiple browser tabs to the deployed preview URL. Verify each gate below.**

### Gate 1 — NSI account public landing page
1. Visit `https://calendar-app-xi-smoky.vercel.app/nsi`
2. Confirm:
   - [ ] Background is `bg-gray-50` (light gray, NOT pure white)
   - [ ] BackgroundGlow blue blobs visible behind the hero card
   - [ ] Glass pill at top: NSI logo (or initial circle if no logo) on left, "North Star Integrations" account name on right
   - [ ] Hero card uses `rounded-2xl` curve with subtle shadow
   - [ ] Bottom of page shows "Powered by [North Star Integrations](https://nsintegrations.com)" footer in light gray text
   - [ ] No double-gradient on hero (ListingHero's inner gradient was removed)

### Gate 2 — Magenta account public landing page (color verification)
1. Visit `https://calendar-app-xi-smoky.vercel.app/nsi-rls-test`
2. Confirm:
   - [ ] BackgroundGlow blobs are MAGENTA-tinted (not blue) — confirming brand_primary drives BackgroundGlow color
   - [ ] Header pill account name still readable (white glass treatment with gray-700 text)
   - [ ] No "dark smear" anywhere on the page (MP-10 fix verification)

### Gate 3 — Emerald + Navy accounts (color spectrum coverage)
1. Visit the emerald-branded test account's public page
2. Confirm: green-tinted glow renders cleanly
3. Visit the navy-branded test account's public page
4. Confirm: dark-blue glow renders cleanly (this is the case CLOSEST to the near-white luminance fallback threshold — should still render with brand color, not fallback to NSI blue)

### Gate 4 — Booking page (slot picker color check)
1. Visit `https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/[any-active-event-slug]`
2. Click on an available slot
3. Confirm:
   - [ ] Selected slot background is MAGENTA (customer brand_primary)
   - [ ] Selected slot text contrasts (white or black per WCAG)
   - [ ] Calendar dot for "day-has-slots" is still ORANGE (CP-07: --color-accent unchanged)
   - [ ] BookingForm submit button (after filling form) is MAGENTA

### Gate 5 — Confirmation page
1. Complete a test booking on `nsi-rls-test`
2. Land on confirmation page
3. Confirm:
   - [ ] PublicShell visible (gray-50 + magenta glow + glass pill + footer)
   - [ ] Confirmation card uses `rounded-xl border border-gray-200 bg-white shadow-sm`
   - [ ] Checkmark icon background uses `color-mix(magenta 15%, transparent)` (light magenta tint)
   - [ ] Checkmark color is MAGENTA
   - [ ] "Powered by North Star Integrations" footer renders below content

### Gate 6 — Cancel + Reschedule token flows
1. Open a confirmation email from a recent test booking
2. Click the cancel link → loads cancel page
3. Confirm:
   - [ ] PublicShell visible (gray-50 + customer glow + glass pill + footer)
   - [ ] Card uses v1.2 lock
   - [ ] "Cancel" button works functionally (don't actually cancel — just verify visual)
4. Click the reschedule link → loads reschedule page
5. Confirm: same visual checks as cancel page

### Gate 7 — TokenNotActive (expired link state)
1. Visit a stale cancel or reschedule URL (or wait for natural expiry)
2. Confirm:
   - [ ] bg-gray-50 outer + centered card with v1.2 lock
   - [ ] No glass pill, no glow, no footer (intentionally minimal per PUB-11)

### Gate 8 — Not-found page
1. Visit `https://calendar-app-xi-smoky.vercel.app/nsi/this-event-does-not-exist`
2. Confirm:
   - [ ] bg-gray-50 outer + centered card with v1.2 lock
   - [ ] "Page not found" heading + body text

### Gate 9 — Embed widget (CP-05 verification)
1. Visit `https://calendar-app-xi-smoky.vercel.app/embed/nsi-rls-test/[any-event-slug]` directly (the iframe URL itself)
2. Confirm:
   - [ ] Background is `bg-gray-50` (NOT bg-white)
   - [ ] Single magenta gradient circle visible at top
   - [ ] Slot picker selected state is MAGENTA (not NSI blue) — this is the CP-05 verification
   - [ ] "Powered by North Star Integrations" footer renders inside iframe (CONTEXT.md lock)
3. Visit `https://calendar-app-xi-smoky.vercel.app/embed/nsi/[any-event-slug]`
4. Confirm: same as above but with NSI BLUE selected slot

### Gate 10 — Owner shell + auth no-regression
1. Visit `https://calendar-app-xi-smoky.vercel.app/app` (after login)
2. Confirm:
   - [ ] Owner shell (sidebar + glass pill + glow + gray-50) UNCHANGED from Phase 15
   - [ ] No deletions broke anything
3. Visit `https://calendar-app-xi-smoky.vercel.app/login`
4. Confirm: auth shell unchanged from Phase 16

### Reporting issues
If ANY gate fails, describe the issue precisely (which gate, what was wrong, screenshot if possible). I will create a fix-up commit and re-deploy. Do not approve until ALL 10 gates pass.
  </how-to-verify>
  <resume-signal>Type "approved" if all 10 gates pass. Otherwise describe the failing gate(s) precisely so a fix-up commit can be made.</resume-signal>
</task>

</tasks>

<verification>
This plan is verified by Andrew's "approved" response on the visual gate. Once approved:
1. Phase 17 success criteria from ROADMAP.md (all 5 gates) are confirmed.
2. All 18 requirements (PUB-01..12, HDR-05..06, EMBED-08..11) are visually validated on prod-like preview.
3. No-regression confirmed for owner shell + auth.
</verification>

<success_criteria>
1. Phase 17 deployed to Vercel preview successfully.
2. All 10 visual gates approved by Andrew.
3. STATE.md, ROADMAP.md, REQUIREMENTS.md updated to mark Phase 17 complete (handled in phase-completion commit by execute-phase orchestrator, not here).
</success_criteria>

<output>
After Andrew approves, create `.planning/phases/17-public-surfaces-and-embed/17-09-visual-gate-SUMMARY.md` capturing:
- Preview URL deployed
- Date of Andrew's approval
- Any fix-up commits made between deploy and approval (with brief description of each)
- Confirm 10/10 gates passed
- Phase 17 ready for marking complete in ROADMAP.md
</output>
