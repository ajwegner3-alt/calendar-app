---
phase: 12-branded-ui-overhaul
verified: 2026-04-29T17:00:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: Inter font renders on all pages
    expected: All body/heading text uses Inter not system-ui fallback
    why_human: Font render requires browser/DevTools inspection
  - test: bg-gray-50 base renders on dashboard shell
    expected: Background appears as approximately gray-50 (#F8FAFC)
    why_human: OKLCH approximation render requires browser
  - test: Gradient blur-circle decorations appear on all 5 surfaces with correct shade behavior
    expected: shade=none is flat tint; shade=subtle has soft circles; shade=bold has stronger circles
    why_human: GradientBackdrop renders inline styles; visual correctness requires browser
  - test: Live gradient preview in /app/branding updates as owner changes settings
    expected: MiniPreviewCard updates immediately before save; public pages show new gradient after save
    why_human: Client-side React state requires browser interaction
  - test: Home tab calendar shows booking dots and clicking opens Sheet drawer with 4 actions
    expected: Dots on booking days; click opens Sheet with View/Cancel/Copy-link/Send-reminder per row
    why_human: UI interaction and Sheet animation require browser
  - test: Auth pages render split-panel with NSI hero on lg+ viewports only
    expected: lg+: two-column split; sm: form only with no hero visible
    why_human: Responsive layout requires browser viewport resizing
  - test: Email branded header renders with solid color band (no gradient) across all 6 templates
    expected: Solid header band showing account color; no gradient CSS; no VML comments
    why_human: Email client rendering requires inbox test (Gmail, Apple Mail, Outlook)
  - test: NSI mark image visible and correct in email footer
    expected: /nsi-mark.png appears as NSI mark in footer; current file is placeholder needing replacement
    why_human: Image content requires visual inspection
  - test: Embed snippet dialog (sm:max-w-2xl) looks appropriately wide with live preview iframe
    expected: Dialog wider than standard alert; code tabs and live preview side-by-side on md+
    why_human: Visual proportions require browser
  - test: Phase 11 regression -- RaceLoserBanner and capacity badge still functional
    expected: Race-loser banner appears on taken slot; capacity badge shows remaining spots
    why_human: Race condition requires concurrent browser sessions; capacity badge needs configured event type
---

# Phase 12: Branded UI Overhaul Verification Report

**Phase Goal:** Every owner-facing and public-facing surface ships the Cruip "Simple Light" aesthetic -- Inter font, gray-50 base, gradient accents derived from per-account background_color + background_shade tokens -- with sidebar IA refactored so Settings is reachable and a new Home tab showing a monthly calendar with day-detail drawer.

**Verified:** 2026-04-29T17:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard: Inter font + bg-gray-50 + floating glass header pill + sidebar IA (Home/Event Types/Availability/Bookings/Branding/Settings accordion) | VERIFIED | app/layout.tsx loads Inter via next/font/google as --font-sans; globals.css @theme sets --background: oklch(0.985 0.002 247) approx gray-50; FloatingHeaderPill has backdrop-blur-sm + gradient hairline border, mounted in shell layout; AppSidebar has all 5 flat nav items plus Settings inline accordion with Reminders/Profile sub-items, defaults open on /app/settings/* |
| 2 | /app Home tab: monthly calendar (react-day-picker@9) with booking dots + shadcn Sheet drawer (View/Cancel/Copy-link/Send-reminder per booking) | VERIFIED | home-calendar.tsx wraps shadcn Calendar (react-day-picker ^9.14.0) with custom DayButton rendering 1-3 dots + count overflow; home-dashboard.tsx owns Sheet open/selectedDate/selectedBookings state; day-detail-row.tsx implements all 4 actions with real Server Actions (cancelBookingAsOwner, regenerateRescheduleTokenAction, sendReminderForBookingAction); /app/page.tsx calls loadMonthBookings and renders HomeDashboard with accountTimezone |
| 3 | Owner can pick background_color + background_shade (none/subtle/bold) on /app/branding with live preview; gradient appears across all surfaces | VERIFIED | branding-editor.tsx has ColorPickerInput + ShadePicker with live MiniPreviewCard; saveBrandingAction writes both cols to DB with Zod validation; shadeToGradient() handles all 3 shade values; shade=none -> flat color-mix tint; getBrandingForAccount() reads cols for dashboard shell; all public surface loaders read and pass background tokens |
| 4 | Public booking page, embed, /[account] index, auth pages: Cruip restyle with py-12/md:py-20 + max-w-3xl + gradient backgrounds; embed dialog sm:max-w-2xl | VERIFIED | BookingShell: header max-w-3xl pt-12 pb-8 md:pt-20 md:pb-12, slot section max-w-3xl; BrandedPage wraps booking page with GradientBackdrop; EmbedShell single-circle gradient (iframe-safe); /[account] ListingHero with inner GradientBackdrop; EmbedCodeDialog: sm:max-w-2xl on DialogContent; auth pages: grid min-h-screen lg:grid-cols-2 + py-12 md:py-20, AuthHero with NSIGradientBackdrop on lg+ only |
| 5 | All 6 emails: branded solid-color header (no VML); booker-facing include plain-text alt; footer has NSI mark image | VERIFIED | renderEmailBrandedHeader() called in all 6 senders; color: backgroundColor ?? brand_primary ?? #0A2540; no gradient CSS; stripHtml() plain-text alt on booker-confirm, booker-cancel, booker-reschedule, reminder; owner emails intentionally have no text: field (correct per 6-row matrix); renderEmailFooter() in all 6 senders with conditional NSI_MARK_URL img; /public/nsi-mark.png exists |

**Score: 5/5 truths verified**

---

## Test Baseline Confirmation

| Metric | Actual | Claimed |
|--------|--------|---------|
| Passing tests | 225 | 225 |
| Skipped tests | 26 | 26 |
| Test files | 28 | 28 |

Confirmed by running: npx vitest run -- 28 files, 225 passed, 26 skipped (251 total), duration 21.74s.

## TypeScript Status

Production code (app/, lib/, components/): **clean** -- npx tsc --noEmit reports zero errors outside tests/ directory.

Test-file errors are pre-existing v1.2 tech debt (STATE.md): vitest module-mock alias exports and implicit any in test callbacks. These do NOT affect production type safety.

---

## Requirements Coverage

| Requirement | Status |
|-------------|--------|
| BRAND-05 (background_color text nullable with hex CHECK constraint) | SATISFIED |
| BRAND-06 (background_shade enum NOT NULL DEFAULT subtle) | SATISFIED |
| BRAND-07 (brandingFromRow reads Phase 12 columns with fallback chain) | SATISFIED |
| UI-01 (Inter font globally via next/font/google with --font-sans variable) | SATISFIED |
| UI-02 (gray-50 base -- oklch(0.985 0.002 247) in @theme) | SATISFIED |
| UI-03 (floating glass header pill with backdrop-blur-sm and gradient hairline border) | SATISFIED |
| UI-04 (GradientBackdrop with 3-shade logic and inline-only styles) | SATISFIED |
| UI-05 (sidebar IA: Home/ET/Avail/Bookings/Branding/Settings accordion) | SATISFIED |
| UI-06 (/app route serves as Home tab with calendar) | SATISFIED |
| UI-07 (react-day-picker@9 calendar wrapped in shadcn Calendar) | SATISFIED |
| UI-08 (booking dot modifiers -- byDay Map, custom DayButton, dot + overflow count) | SATISFIED |
| UI-09 (embed snippet dialog widened to sm:max-w-2xl on DialogContent) | SATISFIED |
| UI-10 (max-w-3xl slot picker + py-12/md:py-20 Cruip rhythm) | SATISFIED |
| UI-11 (day-detail Sheet drawer -- side=right, formatted date, empty-state branch) | SATISFIED |
| UI-12 (day-detail row: View/Cancel/Copy-link/Send-reminder with real Server Actions) | SATISFIED |
| UI-13 (auth pages: split-panel lg:grid-cols-2, NSIGradientBackdrop on hero) | SATISFIED |
| EMAIL-09 (branded solid-color header on all 6 email templates) | SATISFIED |
| EMAIL-10 (plain-text alt on booker confirm; extended to all 3 booker-facing + reminder) | SATISFIED |
| EMAIL-11 (NSI mark image in renderEmailFooter; /public/nsi-mark.png present) | SATISFIED (placeholder asset) |
| EMAIL-12 (6-row HTML snapshot matrix test -- all 6 rows + bonus reminder pass) | SATISFIED |

**Coverage: 20/20 requirements satisfied**

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| lib/email/branding-blocks.ts line 78 | Comment: placeholder PNG at /public/nsi-mark.png | Info | File exists but is placeholder. Replace with final NSI brand mark before Phase 13 QA sign-off. No functional blocking. |
| lib/email/branding-blocks.ts line 52 | @deprecated renderEmailLogoHeader() retained one release cycle | Info | Not called by any Phase 12 sender. Phase 13 cleanup only. |
| app/(shell)/_components/floating-header-pill.tsx line 35 | Empty right slot -- future avatar dropdown deferred to v1.2 | Info | Intentional deferral per PLAN. Not a stub blocking goal achievement. |

No blockers found.

---

## Phase 11 Regression Check

| Phase 11 Item | Status | Evidence |
|---------------|--------|----------|
| RaceLoserBanner | NOT REGRESSED | booking-shell.tsx imports and renders RaceLoserBanner with full handleRaceLoss callback wired |
| Capacity badge (show_remaining_capacity) | NOT REGRESSED | slot-picker.tsx conditional render on line 180; event-type-form.tsx owner toggle line 314; migration 20260428130001 intact |
| Branding tokens on /[account] | NOT REGRESSED | load-account-listing.ts selects background_color + background_shade; /[account]/page.tsx passes both to BrandedPage and ListingHero |

---

## Human Verification Checklist (Phase 13 QA Inputs)

### 1. Inter Font Load
**Test:** Open /app/login, /app, /[any-account] in Chrome DevTools -> Network tab -> filter font -> verify inter-latin woff2 requests load successfully.
**Expected:** Inter loads from Google Fonts CDN; body text uses Inter not system-ui fallback.
**Why human:** Next font optimization and actual browser font rendering cannot be verified programmatically.

### 2. bg-gray-50 Dashboard Base
**Test:** Open /app (dashboard) and inspect the main content area background color using DevTools eyedropper.
**Expected:** Background is approximately #F8FAFC (Tailwind gray-50), not pure white #FFFFFF.
**Why human:** OKLCH oklch(0.985 0.002 247) is the specified value; actual rendered hex color requires DevTools.

### 3. Gradient Backdrop -- 5 Surfaces x 3 Shade Values
**Test:** In /app/branding set background color to #2563EB. Toggle shade to none/subtle/bold and save each. Check: /app dashboard, /[account] listing, /[account]/[event-slug] booking page, /embed/[account]/[event-slug], and MiniPreviewCard.
**Expected:** none=very faint blue tint (no circles). subtle=soft blurred blue circles. bold=stronger circles. Colors consistent with #2563EB.
**Why human:** Inline CSS blur circles and OKLCH color rendering require visual inspection.

### 4. Live Branding Editor Update
**Test:** In /app/branding, change background_color swatch WITHOUT clicking Save. Observe MiniPreviewCard. Then click Save background and navigate to /[account].
**Expected:** MiniPreviewCard updates immediately before save. Public pages show updated gradient after save.
**Why human:** Client-side React state propagation to GradientBackdrop requires browser interaction.

### 5. Home Tab Calendar + Day-Detail Drawer
**Test:** Navigate to /app. Find a day with confirmed bookings and click it.
**Expected:** Days with bookings show 1-3 small dots (plus +N if more than 3). Clicking opens right-side Sheet with formatted date heading, booking count, and one row per booking with View/Cancel/Copy-reschedule-link/Send-reminder buttons.
**Why human:** Calendar interaction and Sheet open/close animation require browser.

### 6. Auth Pages Split-Panel Responsive
**Test:** Open /app/login, /app/signup, /app/forgot-password, /auth/reset-password at viewport >= 1024px and < 768px.
**Expected:** lg+: two-column grid (form left on white, NSI hero right with gradient backdrop). sm: form only (hero hidden).
**Why human:** Responsive breakpoint behavior requires browser viewport resizing.

### 7. Email Branded Header -- Inbox Render
**Test:** Create a real booking on the live site. Check both booker inbox and owner inbox.
**Expected:** Solid-color header band (account background_color or brand_primary or NSI navy). Logo or account name centered. NSI mark footer link. No gradient CSS artifacts.
**Why human:** Email client rendering (Gmail, Apple Mail, Outlook) varies from raw HTML source.

### 8. NSI Mark Image Quality
**Test:** Open a transactional email -> right-click the NSI mark -> open image in new tab.
**Expected:** NSI logo/mark is visible and recognizable as the brand mark. IMPORTANT: /public/nsi-mark.png is documented as a placeholder -- Andrew must confirm replacement with final NSI brand mark before Phase 13 sign-off.
**Why human:** Image content requires visual inspection.

### 9. Embed Dialog Width + Live Preview
**Test:** Navigate to /app/event-types -> click the embed icon for any event type -> observe dialog on a desktop-width viewport.
**Expected:** Dialog is noticeably wider than a standard alert dialog (sm:max-w-2xl). Left side shows code snippet tabs (Script/iFrame). Right side shows live embed preview iframe.
**Why human:** sm:max-w-2xl visual proportions and iframe load require browser.

### 10. Phase 11 Regression -- Race Loser + Capacity Badge
**Test:** Part A: Book same slot concurrently in two browser tabs. Part B: Enable show_remaining_capacity on an event type and view the public booking page.
**Expected:** Part A: Second tab shows race-loser banner and slot picker refreshes with updated availability. Part B: Slot picker shows a remaining capacity badge on eligible slots.
**Why human:** Race condition requires concurrent sessions; capacity badge requires DB-configured event type.

---

## Gaps Summary

No code-level gaps found. All 5 must-haves are verified against the actual codebase. All 20 requirements are satisfied.

The 10 human verification items above are genuine browser/email-client checks that cannot be verified from source code inspection. These items become the Phase 13 manual QA checklist.

**Pre-Phase-13 action required:** Replace /public/nsi-mark.png placeholder with the final NSI brand mark image. The renderEmailFooter() code is correctly wired -- only the asset needs updating.

**Scope note:** The /cancel/[token] and /reschedule/[token] pages use BrandedPage without passing background_color/background_shade (defaulting to shade=subtle, gray-50 tint). This is consistent with Plan 05 scope and is not a gap against the phase must_haves.

---

_Verified: 2026-04-29T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
