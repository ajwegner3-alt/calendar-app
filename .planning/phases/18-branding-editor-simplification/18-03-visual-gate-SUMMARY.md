---
phase: 18-branding-editor-simplification
plan: 03
subsystem: branding
tags: [visual-gate, deploy, andrew-eyeball, no-code-changes]

# Dependency graph
requires:
  - phase: 18-01-types-and-reader
    provides: "BrandingState/Branding/reader simplified — Wave 1 type surface"
  - phase: 18-02-editor-and-preview
    provides: "Simplified 2-control BrandingEditor + faux-public-page MiniPreviewCard + saveBrandingAction deletion"
provides:
  - "Andrew approval (8/8 visual gates) on live Vercel preview"
  - "Phase 18 ROADMAP success criteria 1, 2, 3 confirmed live"
affects:
  - "Phase 19 (email layer — no visual dependency, but BRAND-17 visual grammar mirrors it)"
  - "Phase 20 (cleanup can proceed — Phase 18 surfaces validated)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visual gate runs on live Vercel preview (matches v1.2 'all testing is done live' lock)"
    - "MN-01 visual-gate pattern mirrors Phase 17-09 (deploy + 8-gate eyeball)"

key-files:
  created: []
  modified: []

key-decisions:
  - issue: "Plan Gate 8 referenced /login as the auth route URL"
    resolution: "Actual route is /app/login (route group `(auth)/app/login/page.tsx`); orchestrator surfaced the correction in the checkpoint presentation. No code change needed — plan text correction only."
    why: "Phase 16 placed login under the `(auth)` route group with `/app/login` URL; the Phase 18 plan author wrote /login from memory. Caught by curl probe before Andrew eyeball."
  - issue: "Single-deploy visual gate (no fix-up commits required)"
    resolution: "Andrew approved 8/8 gates on the deploy from Wave 2 push (commit 3fe1298). No re-deploy needed."
    why: "Wave 2 implementation matched the plan's component scaffolds verbatim — MiniPreviewCard scale, blob saturation, slot button density, and reset-button placement all landed correctly on first preview."

# Verification
verification:
  build: "Vercel build green on commit 3fe1298 (Wave 2 push). curl checks: /app/branding 307→/app/login (auth-gated), /app/login 200, /nsi 200, /nsi-rls-test 200."
  visual_gates_passed: 8
  visual_gates_total: 8
  gate_results:
    - gate: 1
      name: "Simplified /app/branding editor surface (BRAND-13, BRAND-14)"
      passed: true
    - gate: 2
      name: "MiniPreviewCard composition (BRAND-17)"
      passed: true
    - gate: 3
      name: "Live update on color change (MiniPreviewCard instant + PreviewIframe re-key on save)"
      passed: true
    - gate: 4
      name: "Reset to NSI blue (#3B82F6) button"
      passed: true
    - gate: 5
      name: "Contrast warning at relativeLuminance > 0.85 (informational, save still enabled)"
      passed: true
    - gate: 6
      name: "PreviewIframe BRAND-21 verification (?previewColor= plumbing intact)"
      passed: true
    - gate: 7
      name: "Layout sanity (controls left / MiniPreviewCard above PreviewIframe right; mobile single col)"
      passed: true
    - gate: 8
      name: "No-regression on Phase 15/16/17 surfaces (/app, /app/login, /nsi, /nsi-rls-test, /embed/nsi)"
      passed: true

# Approval
approved_by: "Andrew (live Vercel preview)"
approved_on: "2026-05-01"
approved_url: "https://calendar-app-xi-smoky.vercel.app/"

# Phase 18 completion
phase_18_status: "Ready for verifier — 9 BRAND-13..21 requirements visually validated, no fix-up commits required, owner shell + auth + Phase 17 public surfaces + embed all confirmed regression-free."
---

# 18-03 Visual Gate — Summary

## What Was Built

Nothing new (this plan has `files_modified: []`). The visual gate plan is a deploy-and-eyeball gate that validates Wave 1 + Wave 2 against the live Vercel preview.

## What Was Verified

Andrew opened `https://calendar-app-xi-smoky.vercel.app/app/branding` and walked the 8-gate checklist on the deploy from commit `3fe1298` (Wave 2 push). All 8 gates passed without a single fix-up commit.

### Highlights
- **2-control editor confirmed** — sidebar/page-bg/shade pickers gone from JSX (BRAND-13, BRAND-14, BRAND-15, BRAND-16)
- **MiniPreviewCard renders the faux public booking page** at miniature scale — gray-50 + brand_primary blob + glass pill + white rounded-xl card + 3-button slot row (middle selected) + Powered-by-NSI (BRAND-17)
- **Live update on every keystroke** — MiniPreviewCard reacts to color picker changes instantly; PreviewIframe re-keys on Save and renders the actual embed with the new color
- **Reset to NSI blue (#3B82F6) works** — distinct from `DEFAULT_BRAND_PRIMARY = "#0A2540"` (legacy null-fallback) per CONTEXT.md lock
- **Contrast warning fires for high-luminance hex** (`#FFFF00` yellow) and stays silent for medium/dark hex (`#3B82F6`, `#0A2540`, `#EC4899`); Save remains enabled either way
- **PreviewIframe BRAND-21 plumbing intact** — `?previewColor=` URL-encoded query param drives the live embed
- **No regression** on `/app` owner shell (Phase 15/16/17), `/app/login` auth shell (Phase 16), `/nsi` + `/nsi-rls-test` public booking pages (Phase 17), or `/embed/nsi/[event-slug]` embed iframe (Phase 17 CP-05 dual-var contract)

## Plan Text Correction Surfaced

Gate 8 in `18-03-visual-gate-PLAN.md` listed `/login` as the auth route URL. The actual route is `/app/login` (route group `(auth)/app/login/page.tsx`). Caught by orchestrator curl probe before Andrew's eyeball; corrected inline in the checkpoint presentation. Plan text was not amended (cosmetic — no behavior impact, no future executor will re-run this plan).

## Hand-Off

Phase 18 is ready for the orchestrator's `verify_phase_goal` step (gsd-verifier spawn). All 9 BRAND-13..21 requirements expected to verify clean against the codebase.
