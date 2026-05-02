---
phase: 20-dead-code-test-cleanup
verified: 2026-05-01T21:25:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 20: Dead Code + Test Cleanup Verification Report

**Phase Goal:** All component files, utility functions, and test files serving the deprecated theming system are deleted. Zero application call sites remain for chromeTintToCss, GradientBackdrop, NSIGradientBackdrop, ShadePicker, or shadeToGradient. Codebase-wide grep confirms zero stale references before Phase 21 DROP migration.
**Verified:** 2026-05-01T21:25:00Z
**Status:** PASSED
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Test count regression: vitest passes with correct drop | VERIFIED | 222 passing, 4 skipped, 0 failing, 26 test files |
| 2 | Symbol grep zero: no live imports/JSX for deprecated symbols | VERIFIED | 3 hits total, all JSDoc comments; zero live imports |
| 3 | tsc --noEmit: no new errors after deletions | VERIFIED | All errors are pre-existing tests/ baseline (TS7006/TS2305); zero errors in lib/, app/, components/ |
| 4 | lib/branding/ directory: only contrast.ts, read-branding.ts, types.ts | VERIFIED | Exactly 3 files confirmed; chrome-tint.ts deleted |
| 5 | Phase 21 CP-01 precondition: zero non-comment hits for deprecated column names | VERIFIED | 5 grep hits in 2 files; all JSDoc/inline comments; zero runtime reads |

**Score:** 5/5 truths verified

---

## Required Artifacts

### Deletions (must be MISSING)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| tests/branding-chrome-tint.test.ts | DELETED | DELETED | Confirmed absent; 27 chrome-tint tests removed |
| tests/branding-gradient.test.ts | DELETED | DELETED | Confirmed absent; 8 gradient tests removed (already broken-on-import since Phase 17) |
| tests/branding-schema.test.ts | DELETED | DELETED | Confirmed absent; 17 deprecated-schema tests removed |
| lib/branding/chrome-tint.ts | DELETED | DELETED | Confirmed absent; sole file exporting chromeTintToCss, chromeTintTextColor, resolveChromeColors |
| app/(shell)/app/branding/_components/shade-picker.tsx | DELETED | DELETED | Confirmed absent; ShadePicker component removed |
| app/_components/gradient-backdrop.tsx | MISSING (pre-Phase-20) | MISSING-CONFIRMED | NO-OP; already deleted in Phase 17 |
| components/nsi-gradient-backdrop.tsx | MISSING (pre-Phase-20) | MISSING-CONFIRMED | NO-OP; already deleted in Phase 17 |
| lib/branding/gradient.ts | MISSING (pre-Phase-20) | MISSING-CONFIRMED | NO-OP; already deleted in Phase 17 |
| app/(shell)/_components/floating-header-pill.tsx | MISSING (pre-Phase-20) | MISSING-CONFIRMED | NO-OP; already deleted in Phase 12.5 |
| app/(shell)/app/branding/_components/intensity-picker.tsx | MISSING (pre-Phase-20) | MISSING-CONFIRMED | NO-OP; already deleted in Phase 12.6 |

### Modifications (must be correct)

| Artifact | Expected State | Status | Details |
|----------|---------------|--------|---------|
| lib/branding/types.ts | Exactly 3 fields: logoUrl, primaryColor, textColor. No BackgroundShade or ChromeTintIntensity. | VERIFIED | 14 lines; interface has 3 fields only; both type aliases absent |
| lib/branding/read-branding.ts | brandingFromRow accepts only { logo_url, brand_primary } | VERIFIED | Signature lines 27-30 confirmed 2-param shape; no deprecated params |
| app/(shell)/app/branding/_lib/schema.ts | Only primaryColorSchema, MAX_LOGO_BYTES, PNG_MAGIC, logoFileSchema remain | VERIFIED | 31 lines; all 5 deprecated schema exports removed; ChromeTintIntensity import removed |
| app/[account]/[event-slug]/_lib/types.ts | AccountSummary: no background_color or background_shade | VERIFIED | Type has 7 fields; deprecated columns absent |
| app/[account]/_lib/types.ts | AccountListingData.account: no background_color or background_shade | VERIFIED | Type has 7 fields; deprecated columns absent |
| app/[account]/[event-slug]/_lib/load-event-type.ts | SELECT does not query deprecated columns | VERIFIED | Line 27 SELECT: id, slug, name, timezone, owner_email, logo_url, brand_primary only |
| app/[account]/_lib/load-account-listing.ts | SELECT does not query deprecated columns | VERIFIED | Line 23 SELECT: id, slug, name, timezone, owner_email, logo_url, brand_primary only |
| tests/send-reminder-for-booking.test.ts | No background_color: null in makeAccountRow() | VERIFIED | Zero grep hits for background_color in this file |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Any .ts/.tsx (non-migration) | chromeTintToCss, chromeTintTextColor, resolveChromeColors | import | SEVERED | Zero import hits; source file deleted |
| Any .ts/.tsx | GradientBackdrop, NSIGradientBackdrop, ShadePicker, shadeToGradient | import/JSX | SEVERED | Files already deleted; zero live references |
| Any .ts/.tsx (non-migration) | sidebar_color, background_color, background_shade, chrome_tint_intensity | .select() or field read | SEVERED | All grep hits are JSDoc/inline comments |
| Branding interface consumers | backgroundColor, backgroundShade, chromeTintIntensity, sidebarColor | field access | SEVERED | Fields removed from interface; type aliases removed |

---

## Symbol Grep Detail

Deprecated symbol grep (chromeTintToCss, chromeTintTextColor, resolveChromeColors, GradientBackdrop, NSIGradientBackdrop, IntensityPicker, FloatingHeaderPill, ShadePicker, shadeToGradient, chromeTintIntensity):

- app/(auth)/_components/auth-hero.tsx:16 -- JSDoc comment: Phase 16-02 historical reference to NSIGradientBackdrop
- app/[account]/_components/listing-hero.tsx:10 -- JSDoc comment: Phase 17 historical reference to GradientBackdrop
- tests/email-branded-header.test.ts:4 -- JSDoc comment: Phase 19 note about field removal

Verdict: 0 live hits. All 3 are historical documentation comments. CLEAN.

Deprecated column name grep (sidebar_color, background_color, background_shade, chrome_tint_intensity, excluding migrations):

- app/(shell)/layout.tsx:38-39 -- Inline comment block documenting Phase 15 column cleanup
- app/embed/[account]/[event-slug]/_components/embed-shell.tsx:28-29 -- JSDoc noting Phase 21 will DROP columns
- app/embed/[account]/[event-slug]/_components/embed-shell.tsx:69 -- JSX block comment noting deprecated reads removed

Verdict: 0 live hits. All 5 grep matches are comments. CLEAN.

---

## Test Count Analysis

| Metric | Value |
|--------|-------|
| Pre-Phase-20 baseline | 266 passing |
| Phase 20 plan target | 214 (planning arithmetic error) |
| Phase 20 actual result | 222 passing |
| Correct arithmetic | 266 - 27 (chrome-tint) - 17 (schema) = 222 |
| Gradient delta | 0 from passing column (those 8 were already broken-on-import since Phase 17) |
| Test files | 26 of 26 passing |
| Skipped | 4 (pre-existing multi-tenant provisioning) |
| Failing | 0 |

The 222 vs 214 deviation is correctly documented in SUMMARY. The gradient test deletion reduced the failing count (not the passing count) because shadeToGradient was already deleted in Phase 17.

Rate-limited integration tests (bookings-api, cancel-reschedule-api): both test suites PASS in this run. The 429 flakiness noted in SUMMARY is a pre-existing environment constraint, not a Phase 20 regression.

---

## tsc Analysis

All tsc --noEmit errors are pre-existing baseline in tests/ directory:
- TS2305: missing mock exports
- TS7006: implicit any in test callback parameters
- TS2352/TS2493 in owner-note-action.test.ts

Per CONTEXT.md these tests/ errors are explicitly out of scope for Phase 20.
Zero errors in lib/, app/, or components/ -- production codebase is type-clean after Phase 20 deletions.

---

## Anti-Patterns Found

None. No blocker, warning, or informational anti-patterns found in any modified or surviving file.

---

## Human Verification Required

None. Phase 20 is a pure delete + structural edit phase with no visual surfaces changed.
Per CONTEXT.md: no Andrew live-eyeball gate required.
Phase 21 booking flow smoke test doubles as Phase 20 safety net.

---

## Phase 21 Preconditions

All Phase 21 CP-01 preconditions satisfied:

1. Zero runtime reads of sidebar_color, background_color, background_shade, chrome_tint_intensity in non-migration TypeScript - CONFIRMED
2. Branding interface is 3-field clean (logoUrl, primaryColor, textColor) - CONFIRMED
3. brandingFromRow 2-param signature ({logo_url, brand_primary}) - CONFIRMED
4. AccountSummary has no background_color or background_shade fields - CONFIRMED
5. AccountListingData.account has no background_color or background_shade fields - CONFIRMED
6. DB loaders do not SELECT deprecated columns - CONFIRMED

Phase 21 may proceed to run the DROP migration.

---

_Verified: 2026-05-01T21:25:00Z_
_Verifier: Claude (gsd-verifier)_
