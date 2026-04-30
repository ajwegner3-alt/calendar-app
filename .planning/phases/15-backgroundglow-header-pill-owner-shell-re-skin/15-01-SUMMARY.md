---
phase: 15-backgroundglow-header-pill-owner-shell-re-skin
plan: 01
subsystem: ui
tags: [react, tailwind, server-component, client-component, sidebar, branding, jit-pitfall]

# Dependency graph
requires:
  - phase: 14-typography-and-css-tokens
    provides: Inter font weight 800 (font-extrabold), --font-sans wiring on <html>, #3B82F6 in @theme as --color-blue-500 (consumed by header.tsx text-blue-500 class)
provides:
  - app/_components/background-glow.tsx (Server Component, GLOW-01..05)
  - app/_components/header.tsx (Client Component, HDR-01..04, HDR-07)
  - lib/brand.ts (WORDMARK constant, MN-02 single source of truth)
affects:
  - 15-02-owner-shell-reskin (consumes all three artifacts; wires BackgroundGlow + Header into (shell)/layout.tsx, removes legacy chrome)
  - 16-auth-onboarding-reskin (will reuse WORDMARK and likely BackgroundGlow)
  - 17-public-surfaces-and-embed (will introduce PublicHeader sibling consuming WORDMARK)

# Tech tracking
tech-stack:
  added: []  # No new libraries — pure Tailwind + React
  patterns:
    - "Server Component for static visual chrome (no interactivity → no 'use client')"
    - "Client Component only when route-aware (usePathname) or shadcn client primitives required (SidebarTrigger)"
    - "Brand display strings centralized in lib/brand.ts (MN-02), not duplicated as inline JSX strings"
    - "Reference UI offsets ADAPTED for sidebar-constrained containing block, not copied verbatim — confirmed via live visual gate"

key-files:
  created:
    - lib/brand.ts
    - app/_components/background-glow.tsx
    - app/_components/header.tsx
  modified: []  # Plan 15-01 produces zero layout-level changes by design. The temp wip(6823d39) edit to (shell)/layout.tsx was reverted in 630f978.

key-decisions:
  - "BackgroundGlow blob left-offsets adapted to calc(50% + 100px) and calc(50% + 0px) — further reduction from the plan's spec values (200px/100px) was required during the visual gate to render visibly inside SidebarInset (~1024px wide on a 1280px screen)."
  - "Visual gate validated against live Vercel preview at commit 6823d39 (not local dev) — user confirmation: 'Blue glow is visible. Looks pretty centered on the page.'"
  - "Temp wip commit (6823d39) and its revert (630f978) both stay in git history. The wip commit is the only point where the offsets could be validated against real containing-block geometry; reverting it preserves Plan 15-01's contract that no existing files are modified."
  - "HDR-08 supersession honored: NO LogoutButton inside header pill. Right slot holds context label only. LogoutButton stays in AppSidebar's <SidebarFooter> (Plan 15-02 preserves placement)."
  - "Header.tsx is single-purpose (owner-shell only). No variant='owner' prop. Public surface gets a separate PublicHeader in Phase 17 per RESEARCH.md Open Question 3."

patterns-established:
  - "Static-visual chrome → Server Component (background-glow.tsx pattern). Future ambient-visual components (gradient overlays, decorative SVGs) should follow this — no 'use client' unless interactivity is required."
  - "Route-aware UI chrome → Client Component using usePathname (header.tsx pattern). Avoid passing pathname as prop from a Server parent — keep the boundary at the chrome component itself."
  - "Brand display strings live in lib/brand.ts as a const object with named segments (prefix/suffix/full). Future brand additions (taglines, footer copy) should extend this module rather than introducing new constants files."
  - "Reference-UI adaptation rule: when porting visual-effect offsets from a source codebase with different containing-block geometry (full viewport vs. constrained), VALIDATE on the actual deployment target via a temp render → revert flow. Do not assume offsets transfer."

# Metrics
duration: ~30min execution + visual-gate iteration on Vercel preview (longer wall-clock due to deploy round-trips)
completed: 2026-04-30
---

# Phase 15 Plan 01: BackgroundGlow + Header Pill Components Summary

**Three new artifacts shipped — BackgroundGlow Server Component (with adapted blob offsets validated on live Vercel preview), Header client pill with NorthStar wordmark, and lib/brand.ts WORDMARK constant — all unwired pending Plan 15-02 layout integration.**

## Performance

- **Duration:** ~30 min execution time (longer wall-clock due to live-preview visual-gate iteration)
- **Started:** 2026-04-30 (Phase 14 completion handoff)
- **Completed:** 2026-04-30
- **Tasks:** 3 (Task 1 brand.ts, Task 2 background-glow.tsx with visual gate, Task 3 header.tsx)
- **Files created:** 3
- **Files modified at end-state:** 0 (the wip→revert pair on (shell)/layout.tsx nets to zero)

## Accomplishments

- `lib/brand.ts` ships the `WORDMARK` const (`prefix: "North"`, `suffix: "Star"`, `full: "NorthStar"`) — MN-02 single source of truth for v1.2 + future phases.
- `app/_components/background-glow.tsx` is a Server Component (no `'use client'`) with two-blob blue glow, `position: absolute` (CP-06), optional `color?: string` prop defaulting to `#3B82F6`, runtime hex injected only via `style={{}}` template strings (MP-04 JIT pitfall avoided).
- `app/_components/header.tsx` is a client component rendering the fixed glass pill (`max-w-[1152px]`, `h-14`, `rounded-2xl`, `bg-white/90 backdrop-blur-sm`), gray-900 "North" + blue-500 "Star" wordmark linking to `/app`, mobile-only `SidebarTrigger` inside the pill at `md:hidden`, and a route-aware context label.
- All static checks (tsc, grep, head) passed. Visual gate passed on live Vercel preview.

## Task Commits

Atomic commits, with one wip + revert pair around the visual gate:

1. **Task 1: Create lib/brand.ts** — `7c7efd4` (feat)
2. **Task 2 (wip): Visual gate temp render** — `6823d39` (wip — intentionally throwaway, see Honest Note below)
3. **Task 2 (revert): Undo visual-gate edit** — `630f978` (revert)
4. **Task 3: Create app/_components/header.tsx** — `ed60109` (feat)

**Plan metadata commit:** Forthcoming `docs(15-01): complete backgroundglow-header-components plan` (PLAN.md grep target updates + this SUMMARY.md).

The actual artifact commit for `background-glow.tsx` lives inside `6823d39` (the wip) — the file was added there, the revert (`630f978`) removed only the layout.tsx import + JSX, leaving `background-glow.tsx` intact in the tree.

## Files Created

- `lib/brand.ts` — Single-export module: `WORDMARK = { prefix, suffix, full } as const`. Consumed by `header.tsx`. Future consumers in Phase 16 (auth shell) and Phase 17 (public header) will import from the same module.
- `app/_components/background-glow.tsx` — Server Component rendering two blurred blue blobs as ambient backdrop. Outer wrapper: `pointer-events-none absolute inset-0 overflow-hidden aria-hidden="true"`. Both blobs: `w-80 h-80 rounded-full blur-[160px]`, opacities `0.4` and `0.35`, gradients `linear-gradient(to top right, ${color}, transparent)` and `linear-gradient(to top right, ${color}, #111827)`. Final left-offsets `calc(50% + 100px)` and `calc(50% + 0px)` (see Decisions).
- `app/_components/header.tsx` — Client Component (`'use client'` for `usePathname` + `SidebarTrigger`). Renders the glass pill with verbatim HDR-01/HDR-02 class strings from the reference UI. NO LogoutButton (HDR-08 supersession).

## Decisions Made

### 1. Final blob offsets: calc(50% + 100px) and calc(50% + 0px) — adapted further from plan spec

**Plan spec:** `calc(50% + 200px)` (top blob) / `calc(50% + 100px)` (lower blob).

**Reference UI:** `calc(50% + 580px)` / `calc(50% + 380px)` — assumes full-viewport containing block.

**Final shipped:** `calc(50% + 100px)` / `calc(50% + 0px)` — reduced an additional `-100px` from the plan spec during the visual-gate iteration on live Vercel preview.

**Why:** Our `SidebarInset` is ~1024px wide on a 1280px desktop (sidebar consumes ~256px of the 1280px viewport, then `SidebarInset` has internal padding). The plan's `200px/100px` offsets pushed the top blob too far right — partially clipped by the inset's `overflow-hidden`. Reducing to `100px/0px` centered both blobs visibly inside the main content area. User confirmed on live preview: "Blue glow is visible. Looks pretty centered on the page."

The plan's `<verify>` block was retroactively updated (in this same plan-metadata commit) to grep for the final offsets, keeping the plan honest about what was actually built. The narrative explanation lines (preamble + done block + success criteria) retain the plan's original `200px/100px` spec values plus the "or smaller if visual gate required further reduction" caveat that was already in the plan.

### 2. Visual gate ran on live Vercel preview, not local dev

The plan's verify block describes a `npm run dev` + browser eyeball flow. In practice the gate ran on the Vercel preview deployment of commit `6823d39`. This is functionally equivalent (same Next.js build, same Tailwind compile, same containing-block geometry) and matches the project rule "All testing is done live" from the global CLAUDE.md.

### 3. wip commit + revert pair preserved in history

`6823d39` is a wip commit ("temp visual gate render") that adds `<BackgroundGlow />` to `(shell)/layout.tsx`. `630f978` reverts ONLY the layout.tsx changes from that commit, leaving `background-glow.tsx` intact (which is the real artifact). Both commits stay in history rather than being squashed because:

1. The visual-gate evidence is the wip commit's deployment URL — squashing would erase the audit trail.
2. The revert is itself a meaningful event: it documents the moment Plan 15-01's "no existing files modified" contract was restored.

**Honest note:** Anyone reading `git log -- app/(shell)/layout.tsx` will see two commits cancel out. That is by design.

### 4. HDR-08 supersession (locked in CONTEXT.md, honored here)

NO LogoutButton inside the header pill. `header.tsx`'s right slot holds the optional `getContextLabel(pathname)` text only. LogoutButton remains in `AppSidebar`'s `<SidebarFooter>` (untouched in Plan 15-01; preserved in Plan 15-02).

### 5. No `variant` prop on Header

Owner-shell only. Public surface gets a separate `PublicHeader` in Phase 17 per RESEARCH.md Open Question 3. Adding a variant prop now would be premature parameterization.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reduced blob offsets beyond plan spec to fix clipping**

- **Found during:** Task 2 (visual gate iteration on live Vercel preview)
- **Issue:** Plan-spec offsets (`calc(50% + 200px)` / `calc(50% + 100px)`) caused the top blob to render partially clipped by `SidebarInset`'s `overflow-hidden` on the live preview. The plan itself anticipated this with a "if clipping or invisibility occurs, adjust by -50px increments" instruction in the visual-gate steps.
- **Fix:** Reduced both offsets by an additional `-100px` to land at `calc(50% + 100px)` / `calc(50% + 0px)`. Verified visually on live preview.
- **Files modified:** `app/_components/background-glow.tsx` (within the wip commit `6823d39`)
- **Verification:** User confirmation on live preview: "Blue glow is visible. Looks pretty centered on the page."
- **Committed in:** `6823d39`

**2. [Rule 3 - Blocking] Updated plan grep targets to match final offsets**

- **Found during:** Plan-completion verification (Task 2 done state)
- **Issue:** After the offset reduction, the plan's `<verify>` block grep targets (`grep -n "calc(50% + 200px)" → must return one hit`) no longer matched the shipped artifact. Running the plan's verify block as-written would falsely report failure.
- **Fix:** Updated lines 195-197 of `15-01-PLAN.md` to grep for the final values (`100px` / `0px`) and added `200px` to the must-be-zero union. Narrative lines (preamble, done block, success criteria) retain the original spec values plus their existing "or smaller if visual gate required further reduction" caveat.
- **Files modified:** `.planning/phases/15-backgroundglow-header-pill-owner-shell-re-skin/15-01-PLAN.md`
- **Verification:** All updated grep commands run and produce expected hit counts against `background-glow.tsx`.
- **Committed in:** Plan-metadata commit (this SUMMARY.md's accompanying commit)

---

**Total deviations:** 2 auto-fixed (1 visual offset adjustment per plan's own iteration loop, 1 spec-vs-reality reconciliation)
**Impact on plan:** Both deviations were anticipated by the plan ("further reduction" caveat) or are routine spec-keeping. No scope creep.

## Issues Encountered

- **Pre-existing tsc errors in `tests/` directory.** `npx tsc --noEmit` reports ~20 errors in `tests/cancel-reschedule-api.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-cron.test.ts`, `tests/reminder-email-content.test.ts` — all `TS7006: implicitly has 'any' type` on callback parameters and `TS2305: no exported member __mockSendCalls`. These are pre-existing baseline noise, not caused by Plan 15-01 work. Verified by running `npx tsc --noEmit 2>&1 | grep -E "(background-glow|header|brand)"` which returns empty. None of the three artifacts produced any tsc errors. Recommend a future maintenance plan to clean up `tests/` typing — out of scope for v1.2.

- **User observation: "longer pages have no blue glow at the bottom."** This is BY DESIGN per locked decision CP-06. `BackgroundGlow` uses `position: absolute` and is anchored to the top of `SidebarInset`. As content scrolls past the ~700px-tall glow region, the lower viewport shows the page background only. Not a bug. Documented here for traceability — Plan 15-02 will not change this behavior.

## User Setup Required

None — no external service configuration required. Plan 15-01 produces source-only artifacts.

## Next Phase Readiness

**Ready for Plan 15-02 (Owner Shell Re-Skin).** All three artifacts exist, type-check clean, and are unwired. Plan 15-02's job:

1. Import `Header` and `BackgroundGlow` in `app/(shell)/layout.tsx`.
2. Render them in the correct DOM order (BackgroundGlow as first child of SidebarInset, Header outside SidebarInset at the layout root).
3. Remove the legacy `<div className="fixed top-3 left-3 z-20 md:hidden"><SidebarTrigger /></div>` block (now redundant — SidebarTrigger lives inside Header pill).
4. Remove `GradientBackdrop` once the new chrome is in place (or run them side-by-side initially per Plan 15-02's own staging strategy).
5. Strip unused props from `AppSidebar` (LogoutButton stays in SidebarFooter — that's not changed).

**No blockers.** Phase 14 typography tokens are wired (Inter weight 800 = `font-extrabold`, `--color-blue-500 = #3B82F6`). Phase 15 component foundations are now complete.

---
*Phase: 15-backgroundglow-header-pill-owner-shell-re-skin*
*Completed: 2026-04-30*
