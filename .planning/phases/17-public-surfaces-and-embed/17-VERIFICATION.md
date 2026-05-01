---
phase: 17-public-surfaces-and-embed
verified: 2026-04-30T00:00:00Z
status: passed
score: 24/24 must-haves verified
gaps: []
human_verification:
  - test: Visit public pages on live Vercel preview
    status: APPROVED -- Andrew confirmed 2026-04-30 10/10 gates passed
---

# Phase 17: Public Surfaces + Embed Verification Report

**Phase Goal:** All 5 public booking surfaces and the embed widget present the new visual language with customer brand_primary driving the BackgroundGlow tint and a customer-branded glass pill. PublicShell replaces BrandedPage. Bookers see Powered by North Star Integrations footer on every public page.

**Verified:** 2026-04-30
**Status:** PASSED
**Re-verification:** No -- initial verification

---

## Goal Achievement
### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | BackgroundGlow blob 2 terminus is transparent (MP-10 fix) | VERIFIED | background-glow.tsx line 33: both blobs use linear-gradient(to top right color transparent); #111827 zero occurrences in code |
| 2 | PoweredByNsi exports a Server Component footer linking to https://nsintegrations.com | VERIFIED | powered-by-nsi.tsx: named export no use client anchor href=https://nsintegrations.com text Powered by North Star Integrations |
| 3 | Header supports variant=public with branding prop rendering logo + account name pill | VERIFIED | header.tsx:20-26: variant union includes public; branding/accountName props; guard at line 42 renders separate JSX; owner/auth branch unchanged |
| 4 | PublicShell wraps children with bg-gray-50 + BackgroundGlow + public Header + PoweredByNsi footer | VERIFIED | public-shell.tsx:56-68: outer div bg-gray-50; BackgroundGlow; Header(public); cssVars wrapper around main; PoweredByNsi after main |
| 5 | PublicShell sets both --brand-primary AND --primary CSS vars plus foreground counterparts | VERIFIED | public-shell.tsx:49-54: cssVars sets --brand-primary --brand-text --primary --primary-foreground to branding values |
| 6 | Glow color falls back to NSI blue (#3B82F6) when brand_primary luminance above 0.85 | VERIFIED | public-shell.tsx:33-39: resolveGlowColor() calls relativeLuminance() from lib/branding/contrast.ts; returns #3B82F6 if luminance exceeds 0.85 |
| 7 | /[account] renders PublicShell wrapping listing hero + event-type cards | VERIFIED | app/[account]/page.tsx:3,42,69: imports PublicShell; calls brandingFromRow(data.account); returns PublicShell wrapper |
| 8 | ListingHero no longer renders inner GradientBackdrop (PUB-05) | VERIFIED | listing-hero.tsx: zero GradientBackdrop imports; props reduced to accountName/logoUrl/brandPrimary; rounded-2xl card |
| 9 | /[account]/[event-slug] booking page renders BookingShell inside PublicShell | VERIFIED | app/[account]/[event-slug]/page.tsx:5,43-46: PublicShell wrapping BookingShell; zero BrandedPage |
| 10 | confirmed/[id] wraps BOTH confirmed and not-confirmed branches in PublicShell | VERIFIED | confirmed/page.tsx lines 116 and 132: two separate PublicShell returns |
| 11 | Confirmation card uses rounded-xl + border-gray-200 + bg-white + p-6 sm:p-8 + shadow-sm (PUB-07) | VERIFIED | confirmed/page.tsx:118,152: both branches use v1.2 card class string |
| 12 | /cancel/[token] cancelled + active branches wrapped in PublicShell | VERIFIED | cancel/[token]/page.tsx:40,78: two PublicShell returns; not_active branch returns TokenNotActive unchanged |
| 13 | /reschedule/[token] active branch wrapped in PublicShell | VERIFIED | reschedule/[token]/page.tsx:46-74: PublicShell wraps RescheduleShell; not_active returns TokenNotActive |
| 14 | Token resolver partial account objects work with brandingFromRow | VERIFIED | Both cancel and reschedule call brandingFromRow with 2-field partial object (logo_url + brand_primary) |
| 15 | not-found.tsx uses bg-gray-50 + v1.2 centered card (PUB-10) | VERIFIED | not-found.tsx:3-14: outer div min-h-screen bg-gray-50; v1.2 card; zero PublicShell |
| 16 | TokenNotActive uses bg-gray-50 + v1.2 card shell (PUB-11) | VERIFIED | token-not-active.tsx:18-40: min-h-screen bg-gray-50 + main + v1.2 card; zero PublicShell |
| 17 | EmbedShell uses bg-gray-50 (not bg-white) | VERIFIED | embed-shell.tsx:66: className includes bg-gray-50; zero bg-white occurrences in source |
| 18 | EmbedShell sets its own --primary CSS var (CP-05) | VERIFIED | embed-shell.tsx:59: --primary mapped to effectiveColor in cssVars; comment explains iframe boundary reason |
| 19 | EmbedShell renders PoweredByNsi footer inside iframe | VERIFIED | embed-shell.tsx:11,111: imports PoweredByNsi; renders after BookingShell before EmbedHeightReporter |
| 20 | EmbedShell gradient driven by brand_primary directly (no background_color/background_shade reads) | VERIFIED | embed-shell.tsx:81: gradient uses effectiveColor directly; no backdropColor or shade variable in source |
| 21 | mini-preview-card.tsx no longer imports GradientBackdrop | VERIFIED | mini-preview-card.tsx: zero GradientBackdrop import; shade prop absent; caller branding-editor.tsx:132-136 passes only sidebarColor/pageColor/primaryColor |
| 22 | BrandedPage component file deleted | VERIFIED | app/_components/branded-page.tsx does not exist; zero import statements for BrandedPage in any .ts/.tsx source |
| 23 | GradientBackdrop + NSIGradientBackdrop + lib/branding/gradient.ts deleted | VERIFIED | All three files absent; zero import statements in app/ source; only comment-only references remain |
| 24 | Visual gate: Andrew approved all 10 gates 2026-04-30 | VERIFIED | 17-09-visual-gate-SUMMARY.md: approved 2026-04-30 10/10 gates passed no fix-up commits required |

**Score:** 24/24 truths verified
---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| app/_components/background-glow.tsx | VERIFIED | Both blob gradients terminate at transparent; #111827 zero occurrences |
| app/_components/powered-by-nsi.tsx | VERIFIED | Named Server Component; 22 lines; no use client; links https://nsintegrations.com |
| app/_components/header.tsx | VERIFIED | variant union includes public; branding/accountName props; guard line 42; WORDMARK intact |
| app/_components/public-shell.tsx | VERIFIED | Server Component 69 lines; exports PublicShell; dual CSS var; BackgroundGlow + Header + PoweredByNsi |
| app/[account]/page.tsx | VERIFIED | PublicShell import + render; brandingFromRow call; zero BrandedPage |
| app/[account]/_components/listing-hero.tsx | VERIFIED | Zero GradientBackdrop; props reduced; rounded-2xl card |
| app/[account]/[event-slug]/page.tsx | VERIFIED | PublicShell wrapping BookingShell; zero BrandedPage |
| app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx | VERIFIED | Two PublicShell renders; v1.2 card; checkmark var preserved |
| app/cancel/[token]/page.tsx | VERIFIED | Two PublicShell renders; not_active preserved; v1.2 cards |
| app/reschedule/[token]/page.tsx | VERIFIED | PublicShell on active branch; not_active preserved; v1.2 card |
| app/[account]/[event-slug]/not-found.tsx | VERIFIED | min-h-screen bg-gray-50; v1.2 card; zero PublicShell per PUB-10 |
| app/_components/token-not-active.tsx | VERIFIED | min-h-screen bg-gray-50 + main; v1.2 card; zero PublicShell per PUB-11 |
| app/embed/.../embed-shell.tsx | VERIFIED | bg-gray-50; --primary set; PoweredByNsi before EmbedHeightReporter; single-circle gradient |
| app/(shell)/app/branding/_components/mini-preview-card.tsx | VERIFIED | No GradientBackdrop import; no shade prop; caller passes 3 props only |
| app/_components/branded-page.tsx | DELETED -- VERIFIED | File does not exist; zero import references in source |
| app/_components/gradient-backdrop.tsx | DELETED -- VERIFIED | File does not exist; zero import references in source |
| components/nsi-gradient-backdrop.tsx | DELETED -- VERIFIED | File does not exist; zero import references in source |
| lib/branding/gradient.ts | DELETED -- VERIFIED | File does not exist; shadeToGradient only in tests/ per STATE.md backlog |
---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| public-shell.tsx | background-glow.tsx | import BackgroundGlow; render with color=glowColor | WIRED |
| public-shell.tsx | header.tsx | import Header; render variant=public branding accountName | WIRED |
| public-shell.tsx | powered-by-nsi.tsx | import PoweredByNsi; render after main | WIRED |
| public-shell.tsx | lib/branding/contrast.ts | import relativeLuminance; used in resolveGlowColor | WIRED |
| header.tsx | lib/branding/types.ts | import type Branding at line 7 | WIRED |
| app/[account]/page.tsx | public-shell.tsx | brandingFromRow drives PublicShell wrapper | WIRED |
| app/[account]/[event-slug]/page.tsx | public-shell.tsx | brandingFromRow drives PublicShell wrapper | WIRED |
| confirmed/[booking-id]/page.tsx | public-shell.tsx | Two PublicShell renders; brandingFromRow partial call | WIRED |
| cancel/[token]/page.tsx | public-shell.tsx | Two PublicShell renders; brandingFromRow partial calls | WIRED |
| reschedule/[token]/page.tsx | public-shell.tsx | One PublicShell render; brandingFromRow partial call | WIRED |
| embed-shell.tsx | powered-by-nsi.tsx | import PoweredByNsi; render after BookingShell | WIRED |
| embed-shell.tsx | SlotPicker via --primary | --primary mapped to effectiveColor in cssVars on root div | WIRED |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| tests/branding-gradient.test.ts | Imports deleted lib/branding/gradient.ts | INFO | Pre-existing test backlog per STATE.md; not a Phase 17 regression |

No blocker or warning anti-patterns found in Phase 17 production source files.
---

### Human Verification Status

The 10-gate visual review was completed by Andrew on 2026-04-30 per 17-09-visual-gate-SUMMARY.md.

| Gate | Description | Result |
|------|-------------|--------|
| 1 | NSI public landing -- gray-50 + blue glow + glass pill + footer | PASSED |
| 2 | Magenta public landing -- magenta glow confirming brand_primary drives BackgroundGlow | PASSED |
| 3 | Emerald + navy color spectrum coverage | PASSED |
| 4 | Booking slot picker -- magenta selected orange day dot CP-07 | PASSED |
| 5 | Confirmation page -- magenta checkmark v1.2 card | PASSED |
| 6 | Cancel + Reschedule token flows -- PublicShell | PASSED |
| 7 | TokenNotActive -- minimal bg-gray-50 PUB-11 | PASSED |
| 8 | Not-found page -- bg-gray-50 + centered card | PASSED |
| 9 | Embed -- bg-gray-50 + customer-color slot CP-05 + footer inside iframe | PASSED |
| 10 | Owner shell + auth no-regression | PASSED |

---

### Gaps Summary

None. All 24 must-haves verified against source code. All 4 deletion targets confirmed absent. All 5 public page routes confirmed wired to PublicShell. EmbedShell confirmed restyled with --primary override. Visual gate approved by Andrew 10/10.

**Goal-backward verdict:** YES -- a fresh user landing on a customer public booking page will experience the v1.2 visual language. Evidence chain: app/[account]/page.tsx routes through PublicShell (bg-gray-50 + BackgroundGlow(glowColor) + Header(variant=public) + dual CSS vars + PoweredByNsi). The same PublicShell pattern covers booking confirmation cancel and reschedule. EmbedShell independently sets --primary per CP-05. BrandedPage and GradientBackdrop are fully deleted with zero live import references remaining.

---

_Verified: 2026-04-30_
_Verifier: Claude (gsd-verifier)_
