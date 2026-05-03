---
phase: 25-surgical-polish
verified: 2026-05-03T14:30:00Z
status: human_needed
score: 4/4 automated must-haves verified
gaps: []
human_verification:
  - test: Visit /login at desktop 1280px+. Confirm no Powered by NSI pill or badge anywhere on the page.
    expected: Only the glass Header wordmark is visible. No inline NSI attribution element exists.
    why_human: Pill absence requires visual DOM inspection; grep confirms JSX is gone from auth-hero.tsx but cannot rule out injection via layout wrappers.
  - test: Visit /signup. Same pill-absence check.
    expected: No NSI attribution pill anywhere on /signup.
    why_human: Same reason as /login.
  - test: On /app, click any unselected date on HomeCalendar. Confirm selected cell is NSI blue. Hover an unselected cell and confirm gray-100 tint. Hover selected cell and confirm blue holds.
    expected: Selected cell solid NSI blue + white text. Hover unselected shows gray-100 tint. Hover selected holds blue.
    why_human: bg-primary resolves via CSS token at runtime; browser render needed to confirm theme chain and hover guard.
  - test: Open /app at 375px-wide mobile viewport. Confirm HomeCalendar fits inside Card with no horizontal scrollbar.
    expected: All 7 columns visible within card width. No overflow.
    why_human: spacing.8 fallback confirmed in source but rendered layout requires real browser at target width.
---

# Phase 25: Surgical Polish - Verification Report

**Phase Goal:** Ship four UI-only fixes that improve auth and owner-home surfaces without touching shared components or the database.
**Verified:** 2026-05-03T14:30:00Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | /login and /signup show no Powered by NSI pill element | VERIFIED | auth-hero.tsx has 0 JSX references to PoweredByNsi, pill div, or badge. No import of powered-by-nsi.tsx in auth route tree. Confirmed by direct read and grep. |
| 2 | Selected date on owner home calendar shows NSI blue (bg-primary) | VERIFIED | home-calendar.tsx line 76: isSelected triggers bg-primary text-primary-foreground. bg-gray-700 and text-white are absent (grep confirmed). |
| 3 | Hover on unselected date shows bg-gray-100; hover does not override selected state | VERIFIED | home-calendar.tsx line 73: !isSelected guard present. Evaluates to false on selected cells, filtered by .filter(Boolean), so hover class is suppressed. |
| 4 | Home calendar grid fits inside Card at 375px with no overflow | VERIFIED | home-calendar.tsx line 72: min-w-[var(--cell-size,theme(spacing.8))] confirmed. theme(spacing.9) absent (grep confirmed). |
| 5 | Shared invariant files are unmodified | VERIFIED | git log confirms no phase-25 commits on powered-by-nsi.tsx, calendar.tsx, globals.css, or header.tsx. --color-accent: #F97316 present at globals.css line 148. |

**Score:** 5/5 truths pass automated verification

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| app/(auth)/_components/auth-hero.tsx | BackgroundGlow + headline + bullets; no pill div | VERIFIED | 48 lines. BackgroundGlow imported and rendered. Headline, subtext, 3 bullets present. Zero pill/PoweredByNsi JSX. |
| app/(shell)/app/_components/home-calendar.tsx | bg-primary selected, hover guard, spacing.8 min-w | VERIFIED | Line 72: min-w fallback theme(spacing.8). Line 73: !isSelected hover guard. Line 76: bg-primary text-primary-foreground. |
| app/_components/powered-by-nsi.tsx | Unmodified booking-page footer | VERIFIED | Last git touch: e4fa1ec (phase 17). No phase-25 commits. Content matches phase-17 original. |
| components/ui/calendar.tsx | Unmodified shared calendar | VERIFIED | Last git touch predates phase 25. Content matches shadcn/phase-12 baseline. --cell-size CSS var present. |
| app/globals.css | --color-accent: #F97316 unchanged | VERIFIED | Line 148: --color-accent: #F97316 confirmed. No phase-25 commits on file. |
| app/_components/header.tsx | Unmodified | VERIFIED | Last git touch: 71092fb (phase 17). No phase-25 commits. Auth variant renders wordmark only. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| auth-hero.tsx | No pill render | Direct JSX absence | VERIFIED | Component contains no PoweredByNsi import or pill div. Confirmed by full file read. |
| home-calendar.tsx DayButton | bg-primary token | Tailwind class in className array | VERIFIED | isSelected path applies bg-primary text-primary-foreground at lines 75-76. Resolves via globals.css --color-primary: #3B82F6. |
| home-calendar.tsx DayButton | hover guard | !isSelected expression | VERIFIED | Line 73: guard evaluates to false when cell is selected; .filter(Boolean) drops it from the class string. Hover class suppressed on selected cells. |
| home-calendar.tsx DayButton | 32px min-width fallback | CSS var with theme() | VERIFIED | var(--cell-size,theme(spacing.8)) falls back to 32px if --cell-size is unset by parent. |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| AUTH-21 - No NSI pill on /login | SATISFIED | auth-hero.tsx pill div deleted; no other pill source in login page tree |
| AUTH-22 - No NSI pill on /signup | SATISFIED | Same auth-hero.tsx used by signup; pill absent |
| OWNER-14 - NSI blue selected state + hover guard | SATISFIED | bg-primary text-primary-foreground + !isSelected guard confirmed in source |
| OWNER-15 - Mobile calendar no horizontal overflow | SATISFIED (automated); needs live confirmation | theme(spacing.8) fallback confirmed in source; rendered layout needs browser check |

### Anti-Patterns Found

None. No TODO/FIXME/placeholder/stub patterns found in modified files.

### Human Verification Required

All four automated must-haves pass source-code verification. The following live-browser checks are required to fully close the phase.

#### 1. Pill Absence on /login

**Test:** Open /login in a browser at 1280px+ width. Inspect the full page for any Powered by NSI or North Star Integrations attribution element outside the Header wordmark.
**Expected:** No pill, badge, or attribution text exists anywhere on the page.
**Why human:** Programmatic verification confirms the JSX is absent from auth-hero.tsx. A browser check confirms no layout wrapper or shell has re-introduced it.

#### 2. Pill Absence on /signup

**Test:** Open /signup in a browser. Same visual inspection as /login.
**Expected:** No NSI attribution pill anywhere on the page.
**Why human:** Same reason as /login.

#### 3. Owner Home Calendar Selected Color and Hover Guard

**Test:** Navigate to /app. Click any non-today date on the HomeCalendar. Observe the selected cell background color. Then hover a different unselected date. Then hover back over the selected date.
**Expected:** Selected cell shows solid NSI blue background with white text. Hovering an unselected cell shows subtle light-gray tint. Hovering the selected cell holds blue with no gray override.
**Why human:** bg-primary is a CSS token that resolves at runtime. Visual confirmation ensures the theme chain resolves to #3B82F6 and not a fallback. Hover guard functional check requires real browser event handling.

#### 4. Mobile Calendar Overflow Check at 375px

**Test:** Open /app with browser DevTools at 375px-wide viewport (iPhone SE emulation). Scroll to the HomeCalendar inside its Card. Check for horizontal scrollbars or cells clipping outside the card boundary.
**Expected:** All 7 calendar columns fit within the card width. No horizontal scroll. No overflow.
**Why human:** The CSS var fallback theme(spacing.8) is confirmed in source, but whether it resolves correctly against the full cascade at this breakpoint requires a real browser render.

### Gaps Summary

No gaps found. All source-code checks pass. Phase is blocked only on the live-browser human verification checks above.

---

_Verified: 2026-05-03T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
