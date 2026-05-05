---
phase: 30-public-booker-3-column-layout
verified: 2026-05-05T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 30: Public Booker 3-Column Layout Verification Report

**Phase Goal:** The public booking card displays a true 3-column layout at desktop widths (calendar LEFT, times MIDDLE, form RIGHT) with no layout shift on slot pick; mobile stacks vertically in the correct interaction order.

**Verified:** 2026-05-05
**Status:** passed (5/5 must-haves)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | At 1024 / 1280 / 1440px, booking card renders 3 distinct columns with no horizontal overflow | VERIFIED | `booking-shell.tsx:180` — `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]` with `gap-6 p-6` inside `max-w-4xl` section wrapper |
| 2 | Form column reserves 320px and shows prompt before slot pick; BookingForm replaces in-place after pick (zero layout shift) | VERIFIED | `booking-shell.tsx:255-270` — fixed `320px` track + conditional `<div>` placeholder ("Pick a time on the left to continue.") vs. `<BookingForm>` mount with `key={selectedSlot.start_at}` for RHF reset |
| 3 | Mobile (< 1024px) stacks vertically: calendar → times → form | VERIFIED | `booking-shell.tsx:180` — single `lg:grid-cols-...` rule; below `lg:` falls through to default block flow (natural document-order stack: calendar at line 182, times at line 202, form at line 255). No `hidden lg:grid` branch exists (grep confirmed). |
| 4 | Embed widget at 320–600px iframe widths renders single-column vertical stack | VERIFIED (inferred-correct) | `embed-shell.tsx:107` re-uses `<BookingShell>` (imported from `@/app/[account]/[event-slug]/_components/booking-shell`) verbatim. The same `lg:` breakpoint logic in `booking-shell.tsx:180` governs mobile/iframe behavior — single-column stacking at < 1024px is structurally guaranteed by the same code that satisfies #3. No embed-specific layout branch in `embed-shell.tsx` (lines 65-115) or `embed/[account]/[event-slug]/page.tsx` (lines 36-72). |
| 5 | Andrew live-verified at 1024 / 1280 / 1440 + mobile real device | VERIFIED | `30-02-SUMMARY.md:69` — Andrew quote on record: > "Everything looks good" — blanket approval covering all 7 mandatory checks (A–G) on production deploy SHA `8b45c50` at 2026-05-05. Per Plan 28-03 precedent, single-phrase blanket approval is acceptable when the checkpoint message enumerates the exact scope being approved. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/[account]/[event-slug]/_components/booking-shell.tsx` | 3-col grid template, form placeholder, conditional BookingForm mount, slot highlight, RHF reset key | VERIFIED | 279 lines, fully substantive. All 5 hooks present (lines 28-49), 3-col grid at line 180, form placeholder at lines 255-270, selected-slot highlight at line 222 (`isSelected = selectedSlot?.start_at === s.start_at`), `key={selectedSlot.start_at}` at line 258. |
| Section wrapper `max-w-4xl` (BOOKER-02 bumped width) | `max-w-4xl` not `max-w-3xl` | VERIFIED | `booking-shell.tsx:150` — `<section className="mx-auto max-w-4xl px-6 pb-12 md:pb-20">`. Hero header retains `max-w-3xl` (line 138) intentionally — bumped width is scoped to booking section only. |
| `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` | Untouched; inherits same component | VERIFIED | Imports `<BookingShell>` from `@/app/[account]/[event-slug]/_components/booking-shell` (line 4) and renders it unchanged at line 107. No layout overrides; CSS-var injection only (lines 52-63) for brand color theming. |
| `30-01-SUMMARY.md` | Plan 30-01 closure summary | VERIFIED | Exists, 15,704 bytes, dated 2026-05-03. |
| `30-02-SUMMARY.md` | Live-verify smoke summary with Andrew quote | VERIFIED | Exists; Andrew verbatim quote at line 69; BOOKER-01..05 mapping table at lines 75-83. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `booking-shell.tsx` (slot click) | `selectedSlot` state | `handleSelectSlot` | WIRED | Line 227: `onClick={() => handleSelectSlot(s)}` → line 126 setter |
| `selectedSlot` | conditional render | ternary at line 256 | WIRED | `{selectedSlot ? <BookingForm .../> : <div>placeholder</div>}` |
| `BookingForm` | RHF reset on re-pick | `key={selectedSlot.start_at}` | WIRED | Line 258 — slot change forces unmount/remount, resetting RHF + Turnstile lifecycle |
| `EmbedShell` | `BookingShell` | direct import + render | WIRED | `embed-shell.tsx:4, 107` — single shared component, no layout fork |

---

### Anti-Patterns Found

None blocking. Notes:
- `booking-shell.tsx` contains intentional `eslint-disable-next-line react-hooks/set-state-in-effect` comments at lines 36 and 74 — both documented as canonical synchronization-with-external-system patterns (browser TZ detection via `Intl.DateTimeFormat`, async fetch-effect for `/api/slots`). Not stubs.
- Pre-existing working-tree drift in `02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` was deliberately preserved unstaged (per 30-01 / 30-02 hygiene). Out-of-scope for Phase 30 verification.

---

### Human Verification Status

Andrew already live-verified on 2026-05-05 (production deploy SHA `8b45c50`). No further human verification required for Phase 30 closure.

**Andrew quote on record (`30-02-SUMMARY.md:69`):**
> "Everything looks good"

This single phrase is Andrew's blanket approval covering all 7 mandatory checks (A–G) at the three required desktop viewports (1024 / 1280 / 1440) plus mobile real-device. The checkpoint message Andrew was responding to enumerated the exact scope viewport-by-viewport and check-by-check, so "Everything looks good" inherits that enumeration as a complete sweep. Per Plan 28-03 precedent, free-text approval is acceptable when the words map unambiguously back to the plan's Verifications.

---

### Inferred-Correct Note (Must-Have #4 — Embed)

Andrew did NOT explicitly run Check H (embed iframe at 320–600px). However:
1. `embed-shell.tsx:107` renders `<BookingShell>` verbatim — no embed-specific layout fork exists.
2. The 3-col grid is gated on `lg:` (= 1024px+) in `booking-shell.tsx:180` — the SAME breakpoint that controls the desktop/mobile boundary verified in must-have #3.
3. Embed iframes at 320–600px sit well below `lg:`, so the natural-stack mobile codepath (already verified by Andrew on real mobile device per Check G) governs embed rendering.
4. No embed-specific Tailwind class or branch overrides this anywhere in `embed/[account]/[event-slug]/`.

Therefore single-column iframe behavior is **structurally guaranteed by the same code** that satisfies must-have #3. Treated as inferred-correct. No 30-03 gap plan needed.

---

## Final Verdict

**Status: PASSED (5/5)**

All five must-haves verify against the codebase + Andrew quote-on-record. The 3-column grid, fixed form-column reservation, conditional placeholder/BookingForm mount, RHF reset key, max-w-4xl section sizing, and natural mobile stacking all live in `booking-shell.tsx`. The embed surface inherits the booker via direct component reuse with no layout fork. Andrew's blanket approval on production at 1024 / 1280 / 1440 + mobile real-device closes BOOKER-05 cleanly.

Phase 30 goal achieved. v1.5 milestone (Phases 28–30, 6/6 plans) shipped.

---

_Verified: 2026-05-05_
_Verifier: Claude (gsd-verifier)_
