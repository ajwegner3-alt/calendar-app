# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-30 — **Phase 15 complete (2/2 plans).** Owner shell re-skin is live on Vercel; Andrew approved at https://calendar-app-xi-smoky.vercel.app/. HDR-02 spec refined with sidebar-width offset.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-30 for v1.2 scoping)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.2 — NSI Brand Lock-Down + UI Overhaul. Reference UI: `lead-scoring-with-tools/website-analysis-tools/` (BackgroundGlow, Header, dashboard layout, globals.css).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.2 — NSI Brand Lock-Down + UI Overhaul (started 2026-04-30)
**Phase:** Phase 15 — BackgroundGlow + Header Pill + Owner Shell Re-Skin — **COMPLETE (2/2 plans)**
**Plan:** 15-02 of 2 — complete; Andrew approved live deploy
**Status:** Phase 15 complete. Ready to plan Phase 16 (Auth + Onboarding Re-Skin).
**Last activity:** 2026-04-30 — Phase 15 complete via `/gsd:execute-phase 15`. Andrew approved live deploy at https://calendar-app-xi-smoky.vercel.app/. HDR-02 refined with `md:left-[var(--sidebar-width)]` offset (commit 698e9fb) after live-eyeball revealed pill overlapping sidebar nav on desktop. SUMMARY.md written (commit f912670).

**v1.2 Phase Progress:**

```
Phase 14 [X] Typography + CSS Token Foundations  (14-01 complete — TYPO-01..07 shipped)
Phase 15 [X] BackgroundGlow + Header Pill + Owner Shell Re-Skin  (15-01 + 15-02 complete; live + approved)
Phase 16 [ ] Auth + Onboarding Re-Skin
Phase 17 [ ] Public Surfaces + Embed
Phase 18 [ ] Branding Editor Simplification
Phase 19 [ ] Email Layer Simplification
Phase 20 [ ] Dead Code + Test Cleanup
Phase 21 [ ] Schema DROP Migration
```

Progress: [██░░░░░░░░] 25% (2 / 8 phases complete)

## Performance Metrics

**v1.2 velocity:**
- Phase 14 — 25 min, 2 files, 7 requirements (TYPO-01..07). Additive only.
- Phase 15 Plan 15-01 — ~30 min execution + visual-gate iteration on live Vercel preview, 3 new files (lib/brand.ts, background-glow.tsx, header.tsx), 9 requirements (GLOW-01..05, HDR-01..04, HDR-07, MN-02). Additive only.
- Phase 15 Plan 15-02 — ~12 min task execution + checkpoint deploy + 1 post-eyeball fix-up commit, 10 source files modified + 1 fix-up (header.tsx), 11 requirements (OWNER-01..11). Net deletions in shell layout (chrome decommissioned).

**v1.1 reference velocity (for calibration):**
- 34 plans across 6 phases (Phases 10-13 incl. 12.5 + 12.6)
- 3 days from kickoff to sign-off

## Accumulated Context

### v1.2 Visual Locks (frozen at scoping — repeat in every phase plan preamble)

1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]`
2. Email strategy: solid-color-only table band — no CSS gradients in email HTML
3. CSP: lives only in `proxy.ts`, never `next.config.ts`
4. Two-stage owner auth: RLS pre-check before service-role mutation
5. `background_shade` ENUM type must be dropped alongside the column
6. DROP migration = two-step deploy (code-stop-reading, wait 30 min, then DROP SQL)

### Key v1.2 Scoping Decisions (resolved before research)

- `brand_accent` → DROPPED. v1.2 ships `brand_primary` only. Requirements reflect this.
- `BrandedPage` → REPLACED with new `PublicShell` component. Clean break.
- Marathon QA (QA-09..QA-13) + Resend + Vercel Pro → RE-deferred to v1.3.
- Auth additions (OAuth, magic-link, etc.) → RE-deferred to v1.3.

### Phase 14 Decisions (locked — inform Phase 15+)

- **MP-07 Approach A:** `tracking-tight` removed from `<html>`. Letter-spacing now solely from `globals.css` em-based rules. Component-level `tracking-tight` on 17+ headings intentionally overrides the baseline.
- **`@theme inline` vs plain `@theme`:** Font tokens go in `@theme inline` (runtime resolution for next/font CSS vars). Brand hex tokens go in plain `@theme`.
- **Explicit element-selector rule required:** `@theme inline --font-mono` declaration alone does NOT wire raw `<code>` elements — the `code, pre, kbd { font-family: var(--font-mono) }` rule is load-bearing.
- **Multi-font next/font pattern:** All font `.variable` props MUST appear on `<html>` className. If `robotoMono.variable` is missing, `var(--font-roboto-mono)` is never injected, `var(--font-mono)` silently falls back to `ui-monospace`.

### Phase 15 Decisions (locked — inform Plan 16+ and beyond)

- **HDR-02 sidebar-width offset (refinement, post-deploy):** Fixed shell-overlay components rendered above shadcn `SidebarInset` MUST offset past the sidebar on desktop via `md:left-[var(--sidebar-width)]`. shadcn's `SidebarProvider` exposes this CSS var (default 16rem; auto-switches to `--sidebar-width-icon` when collapsed), so the offset auto-tracks expanded/icon states. Mobile (`left-0`) unchanged because the sidebar is off-canvas. **This refinement applies to owner shell only.** Phase 17's `PublicHeader` runs over surfaces with NO sidebar — moot. Phase 16's auth pages also have no sidebar — moot.
- **`:root --primary` value:** `oklch(0.606 0.195 264.5)` — the closest oklch to `#3B82F6` (NSI blue-500). Used directly in `app/globals.css :root` block; consumed by all shadcn primary components (Button, Switch active state, Calendar selected day). Mixing color formats in `:root` would trigger Tailwind v4 warnings, hence oklch and not hex.
- **Final BackgroundGlow blob offsets:** `calc(50% + 100px)` (top blob) and `calc(50% + 0px)` (lower blob). Adapted from reference UI's 580/380 (full-viewport) and reduced from plan spec's 200/100 during 15-01 visual-gate iteration. Validated on live Vercel preview at commit 6823d39, then re-confirmed in 15-02 deploy. **If a future phase wires BackgroundGlow into a different containing block (e.g., no sidebar), re-run a visual gate.**
- **Reference-UI adaptation rule:** Visual-effect offsets ported from a different containing-block geometry MUST be validated on the actual deployment target via temp render → revert flow. Do not assume offsets transfer.
- **Brand display strings centralized in `lib/brand.ts`:** Phase 16 (auth shell) and Phase 17 (public header) MUST import `WORDMARK` from `@/lib/brand` rather than duplicating "North"/"Star" strings.
- **HDR-08 supersession honored:** NO LogoutButton inside the Header pill in any phase. LogoutButton stays in `AppSidebar`'s `<SidebarFooter>`. Header right slot holds context label only.
- **Header is single-purpose (owner only):** Phase 17 introduces a separate `PublicHeader` rather than adding a `variant` prop.
- **Visual gates run on live Vercel preview, not local dev** (matches "all testing is done live" project rule). wip commits used for visual gates are reverted in a follow-up commit; both stay in history.
- **Glass shell aesthetic locked:** `bg-white/80 backdrop-blur-sm` on Sidebar + `bg-gray-50` on SidebarInset + ambient BackgroundGlow visible through both. Phase 16 auth shell should mirror this aesthetic on its own non-sidebar layout.
- **Card uniform class string locked:** `rounded-lg border border-gray-200 bg-white p-6 shadow-sm` (with per-card `text-center` / `overflow-hidden` / `space-y-3` / `space-y-4` modifiers preserved). Destructive/danger variants (`border-destructive/30`, `border-destructive/40`) intentionally retained as visually distinct.
- **Single-source `--primary` cascade:** No per-account chrome wrapper; shadcn Button/Switch/Calendar inherit `:root --primary` directly. The Phase 12.6 `style={{ "--primary": ... }}` wrapper pattern is decommissioned and must NOT return.
- **Accounts SELECT trim outcome (Plan 15-02 OWNER-11):** `slug` was NOT referenced outside `.select(...)` in `(shell)/layout.tsx`, so the deterministic grep procedure resolved to `.select("id")` (slug DROPPED). Other layouts/components that reference `account.slug` are unaffected.

### Pending Todos

- None for Phase 15. Maintenance backlog (out of v1.2 scope): clean up pre-existing tsc errors in `tests/` directory (~20 errors in test files, all `TS7006`/`TS2305`).

### Active Blockers

None. Phase 15 complete; ready to plan Phase 16 (Auth + Onboarding Re-Skin).

## Session Continuity

**Last session:** 2026-04-30 — Phase 15 execute via `/gsd:execute-phase 15`.
**Stopped at:** Phase 15 complete. Plan 15-02 SUMMARY.md written (commit f912670). HDR-02 refined with sidebar-width offset (commit 698e9fb) after live-deploy eyeball. Andrew approved live deploy at https://calendar-app-xi-smoky.vercel.app/.
**Resume:** `/gsd:plan-phase 16` (Auth + Onboarding Re-Skin).

**Files of record:**
- `.planning/PROJECT.md` — what + why (v1.2 scoping current)
- `.planning/ROADMAP.md` — v1.2 Phases 14-21
- `.planning/REQUIREMENTS.md` — 92 v1.2 requirements, traceability populated
- `.planning/STATE.md` — this file
- `.planning/research/SUMMARY.md` — synthesizer output (8-phase recommendation)
- `.planning/research/ARCHITECTURE.md` — migration map + build order
- `.planning/research/PITFALLS.md` — critical pitfalls + phase mappings
