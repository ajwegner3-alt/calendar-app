---
phase: 15-backgroundglow-header-pill-owner-shell-re-skin
plan: 02
subsystem: [owner-shell, branding-cleanup]
tags: [tailwind, shadcn, sidebar, oklch, glass-aesthetic, vercel]

# Dependency graph
requires:
  - phase: 14-01
    provides: Inter weight 800 + --color-primary #3B82F6 token in @theme
  - phase: 15-01
    provides: BackgroundGlow + Header components, lib/brand.ts WORDMARK constant
provides:
  - Re-skinned owner shell with BackgroundGlow ambient glow + fixed glass Header pill
  - Glass-treatment AppSidebar (bg-white/80 backdrop-blur-sm, no per-account chrome)
  - :root --primary set to NSI blue oklch (regression fix; Button/Switch/Calendar dot now blue)
  - 14 owner-page card class strings standardized to rounded-lg + border-gray-200 + shadow-sm
  - HDR-02 spec refinement: pill offset past sidebar on desktop via md:left-[var(--sidebar-width)]
affects:
  - "app/(shell)/*"
  - owner shell layout
  - all owner-page cards
  - primary color cascade
  - "Phase 16 (auth re-skin) — pattern reference"
  - "Phase 17 (public surfaces) — PublicHeader will mirror Header pattern (no sidebar offset needed)"
  - "Phase 18 (branding editor) — sidebar_color column now unused, ready for DROP in Phase 21"

# Tech tracking
tech-stack:
  added: []
  removed:
    - resolveChromeColors usage in shell layout
    - getBrandingForAccount usage in shell layout
    - GradientBackdrop usage in shell layout (component file retained for other consumers)
    - sidebarColor/sidebarTextColor props on AppSidebar
    - --primary CSS-var override wrapper on shell
  patterns:
    - "Glass shell aesthetic (bg-white/80 + backdrop-blur-sm on Sidebar)"
    - "Card uniform class string: rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    - "BackgroundGlow + Header as shell-level components inside SidebarInset"
    - "Fixed shell-overlay components offset past sidebar on desktop via md:left-[var(--sidebar-width)] (auto-tracks shadcn collapsed/expanded state)"
    - "Single-source --primary cascade: shadcn components consume :root --primary directly; no per-account override"

key-files:
  created: []
  modified:
    - app/globals.css
    - app/(shell)/layout.tsx
    - components/app-sidebar.tsx
    - app/(shell)/app/_components/home-calendar.tsx
    - app/(shell)/app/page.tsx
    - app/(shell)/app/event-types/_components/event-types-table.tsx
    - app/(shell)/app/bookings/_components/bookings-table.tsx
    - app/(shell)/app/bookings/[id]/page.tsx
    - app/(shell)/app/settings/profile/page.tsx
    - app/(shell)/app/settings/profile/email/page.tsx
    - app/_components/header.tsx  # follow-up fix-up (sidebar offset)

key-decisions:
  - ":root --primary set to oklch(0.606 0.195 264.5) — oklch equivalent of #3B82F6"
  - "accounts SELECT trimmed to .select(\"id\") — slug was NOT referenced outside SELECT in shell layout"
  - "Mid-plan regression gate (Task 4): tsc --noEmit and npm run build BOTH passed cleanly before Task 5"
  - "HDR-02 refined post-deploy: pill offset past sidebar on desktop via md:left-[var(--sidebar-width)] (additive one-line fix; mobile unchanged)"

patterns-established:
  - "Glass shell aesthetic: bg-white/80 backdrop-blur-sm on Sidebar + bg-gray-50 on SidebarInset + BackgroundGlow ambient layer"
  - "Card uniform: rounded-lg border border-gray-200 bg-white p-6 shadow-sm with per-card text-center / overflow-hidden / space-y-* preserved"
  - "Sidebar-offset pattern for fixed shell-overlay components: md:left-[var(--sidebar-width)] auto-tracks shadcn collapsed/expanded state"
  - "Single-source --primary: no per-account chrome wrapper; shadcn Button/Switch/Calendar inherit :root --primary directly"

# Metrics
duration: ~12min (task execution) + checkpoint/fix-up
completed: 2026-04-30
---

# Phase 15 Plan 02: Owner Shell Re-Skin Summary

**Re-skinned `/app/*` shell to NSI brand: gray-50 base, ambient BackgroundGlow, fixed glass Header pill (sidebar-offset on desktop), glass translucent sidebar, uniform card classes, single-source NSI blue primary — Phase 12.6 chrome fully decommissioned.**

## Performance

- **Duration:** ~12 min (Tasks 1-6 commit timestamps 18:10:39 → 18:15:25) + checkpoint deploy + post-eyeball fix-up commit at 18:22:28
- **Started:** 2026-04-30 (Task 1 commit b400564 at 18:10:39 -0500)
- **Completed:** 2026-04-30 (post-checkpoint fix 698e9fb at 18:22:28 -0500; Andrew approval received this session)
- **Tasks:** 8 (7 auto + 1 human-verify checkpoint)
- **Files modified:** 10 source files + 1 fix-up (header.tsx)

## Accomplishments

- Phase 12.6 chrome fully decommissioned in shell layout (`--primary` wrapper, `GradientBackdrop`, `resolveChromeColors`, `getBrandingForAccount`, `chrome.pageColor` inline style, mobile-only `SidebarTrigger` div all removed in one pass)
- `:root --primary` regression fix landed in same deploy as wrapper removal — Button/Switch/Calendar dot now render NSI blue, not near-black
- Glass aesthetic shipped: `bg-white/80 backdrop-blur-sm` sidebar + `bg-gray-50` SidebarInset + ambient BackgroundGlow visible behind sidebar
- 14 card class strings standardized across 9 files (5 in Task 5 batch A, 9 in Task 6 batch B); destructive/danger variants intentionally preserved
- HDR-02 sidebar-offset refinement: post-deploy eyeball revealed full-width fixed pill blocked sidebar nav clicks on desktop; one-line `md:left-[var(--sidebar-width)]` addition resolves while leaving mobile (`left-0`) unchanged

## Task Commits

Each task committed atomically (8 total commits this session for Plan 15-02):

1. **Task 1: globals.css :root --primary regression fix** — `b400564` (fix)
2. **Task 2: (shell)/layout.tsx re-skin** — `bd2afff` (feat)
3. **Task 3: AppSidebar prop strip + glass treatment** — `28bb7fe` (refactor)
4. **Task 4: HomeCalendar dot color + mid-plan TS gate** — `c96fc35` (fix)
5. **Task 5: Card standardization batch A (3 files)** — `17de407` (refactor)
6. **Task 6: Card standardization batch B (3 files)** — `81ce2de` (refactor)
7. **Task 7: Commit + push (rolled into Tasks 1-6 individually + initial push trigger)** — implicit; no standalone commit, push happened after Task 6
8. **Task 8 follow-up fix: Header sidebar offset** — `698e9fb` (fix)

**Plan metadata:** _(this commit — `docs(15-02): complete owner-shell-reskin plan`)_

## Files Created/Modified

| File | Requirement(s) addressed |
|------|--------------------------|
| `app/globals.css` | OWNER-08 — `:root --primary` set to `oklch(0.606 0.195 264.5)` |
| `app/(shell)/layout.tsx` | OWNER-01 (chrome wrapper removed), OWNER-03 (`chrome.pageColor` inline style removed), OWNER-04 (`GradientBackdrop` import + render removed; `BackgroundGlow` added), OWNER-05 (mobile-only SidebarTrigger div removed; trigger now in Header pill), OWNER-06 (`pt-20 md:pt-24 pb-12 relative z-10` on `<main>`), OWNER-07 (`bg-gray-50` on SidebarInset), OWNER-11 (accounts SELECT trimmed) |
| `components/app-sidebar.tsx` | OWNER-02 — `sidebarColor`/`sidebarTextColor` props removed; `bg-white/80 backdrop-blur-sm` glass treatment added; SidebarFooter (email + LogoutButton) preserved per HDR-08 |
| `app/(shell)/app/_components/home-calendar.tsx` | OWNER-09 — DayButton dot uses `hsl(var(--primary))` directly (no `var(--brand-primary)` fallback) |
| `app/(shell)/app/page.tsx` | OWNER-10 — 2 card class strings standardized |
| `app/(shell)/app/event-types/_components/event-types-table.tsx` | OWNER-10 — 1 card (table wrapper) standardized |
| `app/(shell)/app/bookings/_components/bookings-table.tsx` | OWNER-10 — 2 card class strings (empty state + table wrapper) standardized |
| `app/(shell)/app/bookings/[id]/page.tsx` | OWNER-10 — 4 card class strings standardized; destructive cancellation banner intentionally preserved |
| `app/(shell)/app/settings/profile/page.tsx` | OWNER-10 — 4 card class strings standardized |
| `app/(shell)/app/settings/profile/email/page.tsx` | OWNER-10 — 1 card class string standardized |
| `app/_components/header.tsx` _(fix-up)_ | HDR-02 refinement — `md:left-[var(--sidebar-width)]` added so pill starts at sidebar's right edge on desktop; mobile unchanged |

## Decisions Made

### `:root --primary` regression fix value
- Chose `oklch(0.606 0.195 264.5)` — the closest oklch to `#3B82F6` (NSI blue-500), per RESEARCH.md "Open Question 1"
- Rationale: shadcn tokens are oklch-format; mixing color formats in `:root` triggers Tailwind v4 warnings
- Verified live: Switch active state, primary Button, HomeCalendar dot all render NSI blue post-deploy

### Accounts SELECT trim
- Applied deterministic grep procedure from Task 2 action block
- Outcome: `slug` was NOT referenced outside the `.select("...")` string in `(shell)/layout.tsx`
- Trim: `.select("id")` (slug DROPPED)
- Verified post-edit: shell layout reads `.select("id")` on line 42; no `account.slug` or `.slug` reference remains in the file

### Mid-plan regression gate (Task 4)
- Both `npx tsc --noEmit` and `npm run build` passed cleanly after Tasks 1-4 completed
- No fixes were required before proceeding to Task 5
- Critical-path TypeScript surface (shell layout import changes, AppSidebar prop contract change, HomeCalendar CSS-string change) was locked in before mechanical card edits began

### Vercel deploy approval
- Deploy URL: **https://calendar-app-xi-smoky.vercel.app/**
- Approved by Andrew this session: 2026-04-30
- Approval covered: glow visible behind sidebar (SC-1), pill on every owner page desktop+mobile (SC-2), NSI blue Switch/Button (SC-3), uniform sidebar regardless of account branding (SC-4), Vercel build green with zero TS errors (SC-5)

### Mobile sidebar z-index
- **Not directly tested by Andrew this session.**
- Current configuration: pill is `fixed ... z-30`; shadcn Sheet (mobile drawer) uses default shadcn z-index for overlay/content
- Status: untested in this session — documented for future revisit if a mobile-drawer regression surfaces (e.g., pill peeking through awkwardly when drawer is open)
- No change made; deferred unless real-world report indicates need

## Deviations from Plan

### Refinement (post-deploy eyeball)

**1. [HDR-02 spec refinement] Header pill overlapped sidebar on desktop, blocking sidebar nav clicks**

- **Found during:** Task 8 checkpoint (Andrew live-deploy eyeball)
- **Issue:** The original Plan 15-01 / Plan 15-02 spec for HDR-02 was `fixed top-2 md:top-6 left-0 right-0 z-30 px-4`. With `left-0` on desktop, the pill spanned the full viewport width including over the sidebar's vertical band. Even though the pill is short, its z-30 layer intercepted clicks on Availability and other sidebar nav items in that band.
- **Fix:** Added `md:left-[var(--sidebar-width)]` to the pill's outer wrapper. shadcn's `SidebarProvider` exposes `--sidebar-width` (default `16rem`; switches to `--sidebar-width-icon` when collapsed), so the offset auto-tracks both expanded/icon states. Mobile (`left-0`) unchanged — sidebar is off-canvas there, no overlap risk.
- **Files modified:** `app/_components/header.tsx` (one line)
- **Verification:** Andrew re-eyeballed live deploy, confirmed sidebar nav is clickable; pill renders correctly above main content area, not over the sidebar.
- **Committed in:** `698e9fb` (`fix(15-02): offset Header pill past sidebar on desktop`)
- **Future-phase implication:** This is a refinement to the HDR-02 spec for owner-shell use only. Phase 17 introduces a separate `PublicHeader` for public surfaces — public surfaces have NO sidebar, so the offset pattern is moot for that phase. If any future phase wires a fixed shell-overlay component over a shadcn sidebar, use the same `md:left-[var(--sidebar-width)]` pattern.
- **Scope:** Additive one-line change. Does NOT alter HDR-01 (pill inner classes), HDR-03 (wordmark), HDR-04 (context label), or HDR-07 (mobile trigger placement). Does NOT change any other tasked behavior.

---

**Total deviations:** 1 refinement (post-deploy spec adjustment, additive)
**Impact on plan:** Refinement caught at the human-verify gate exactly as designed. No scope creep. HDR-02 spec is updated for owner-shell context; public-shell use is unaffected.

## Issues Encountered

- Desktop overlap of Header pill over sidebar — caught at Task 8 checkpoint (eyeball gate worked as intended). Resolved with the one-line `md:left-[var(--sidebar-width)]` addition (commit `698e9fb`). All other Task 8 verification steps passed on first attempt.

## Success Criteria Status (post-Andrew-approval)

All 5 ROADMAP Phase 15 Success Criteria — TRUE per Andrew's eyeball on live deploy:

1. **Glow visible behind sidebar** — TRUE. Blue blots visible behind sidebar + main content on `/app`; no clipping.
2. **Glass pill on every owner page (desktop + mobile)** — TRUE. Wordmark renders on every `/app/*` page; mobile hamburger inside pill works; desktop pill no longer overlaps sidebar (post-fix).
3. **NSI blue primary color** — TRUE. Switch active state, primary Button, and HomeCalendar dot all render NSI blue (`#3B82F6`).
4. **No per-account sidebar tinting** — TRUE. Sidebar is uniform `bg-white/80 backdrop-blur-sm` regardless of stored account branding.
5. **Build + test hygiene** — TRUE. Vercel build "Ready" with zero TS errors; vitest count unchanged from pre-Phase-15 baseline.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Owner shell re-skin complete and approved on live deploy.
- Pattern bank established for downstream phases:
  - Phase 16 (Auth + Onboarding Re-Skin): use the same gray-50 + BackgroundGlow + glass aesthetic; auth pages have NO sidebar so no `md:left-[var(--sidebar-width)]` offset needed.
  - Phase 17 (Public Surfaces): introduce separate `PublicHeader` (decided Phase 15-01); use `WORDMARK` from `lib/brand.ts`. No sidebar offset needed.
  - Phase 18 (Branding Editor): `sidebar_color` column is now visually unused; safe to remove from the editor UI; column DROP scheduled for Phase 21.
- No active blockers. Ready to plan Phase 16.

---
*Phase: 15-backgroundglow-header-pill-owner-shell-re-skin*
*Plan: 02*
*Completed: 2026-04-30*
