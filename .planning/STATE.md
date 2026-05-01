# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-30 — **Phase 17 complete (9/9 plans, 24/24 must-haves verified).** All 5 public booking surfaces + embed widget re-skinned with NSI visual language driven by customer `brand_primary`. PublicShell replaces BrandedPage; PoweredByNsi footer renders on every public page and inside every embed iframe. 4 legacy files deleted (BrandedPage, GradientBackdrop, NSIGradientBackdrop, lib/branding/gradient.ts) — 233 lines removed. Andrew approved 10/10 visual gates on live Vercel preview.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-30 for v1.2 scoping)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.2 — NSI Brand Lock-Down + UI Overhaul. Reference UI: `lead-scoring-with-tools/website-analysis-tools/` (BackgroundGlow, Header, dashboard layout, globals.css).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.2 — NSI Brand Lock-Down + UI Overhaul (started 2026-04-30)
**Phase:** Phase 17 — Public Surfaces + Embed — **COMPLETE (9/9 plans)**
**Plan:** 17-09 of 9 — complete; full phase verified 24/24 must-haves passed
**Status:** Phase 17 complete. Ready to plan Phase 18 (Branding Editor Simplification).
**Last activity:** 2026-04-30 — Phase 17 executed via `/gsd:execute-phase 17`. Wave 1 (17-01 foundation atoms) + Wave 2 (17-02 PublicShell) → Wave 3 (5 parallel plans: 17-03 listing, 17-04 booking+confirmed, 17-05 token flows, 17-06 edge pages, 17-07 embed restyle) → Wave 4 (17-08 deletions + mini-preview bridge) → Wave 5 (17-09 visual gate). Andrew approved all 10 gates 2026-04-30 on https://calendar-app-xi-smoky.vercel.app/. Verifier confirmed 24/24 must-haves passed. 233 lines of legacy chrome (BrandedPage + 3 gradient files) deleted; codebase now single-pattern (BackgroundGlow + PublicShell).

**v1.2 Phase Progress:**

```
Phase 14 [X] Typography + CSS Token Foundations  (14-01 complete — TYPO-01..07 shipped)
Phase 15 [X] BackgroundGlow + Header Pill + Owner Shell Re-Skin  (15-01 + 15-02 complete; live + approved)
Phase 16 [X] Auth + Onboarding Re-Skin  (16-01..04 complete; 24/24 must-haves verified; live + approved)
Phase 17 [X] Public Surfaces + Embed  (17-01..09 complete; 24/24 must-haves verified; live + approved; 233 lines legacy chrome deleted)
Phase 18 [ ] Branding Editor Simplification
Phase 19 [ ] Email Layer Simplification
Phase 20 [ ] Dead Code + Test Cleanup
Phase 21 [ ] Schema DROP Migration
```

Progress: [█████░░░░░] 50% (4 / 8 phases complete)

## Performance Metrics

**v1.2 velocity:**
- Phase 14 — 25 min, 2 files, 7 requirements (TYPO-01..07). Additive only.
- Phase 15 Plan 15-01 — ~30 min execution + visual-gate iteration on live Vercel preview, 3 new files (lib/brand.ts, background-glow.tsx, header.tsx), 9 requirements (GLOW-01..05, HDR-01..04, HDR-07, MN-02). Additive only.
- Phase 15 Plan 15-02 — ~12 min task execution + checkpoint deploy + 1 post-eyeball fix-up commit, 10 source files modified + 1 fix-up (header.tsx), 11 requirements (OWNER-01..11). Net deletions in shell layout (chrome decommissioned).
- Phase 16 Plan 16-01 — ~5 min, 1 file modified (header.tsx), additive API extension only. No call-site changes; tsc clean for non-test files; zero owner-shell regression.
- Phase 16 Plan 16-02 — ~3 min execution + Vercel deploy + visual gate, 3 files modified (auth-hero.tsx, login/page.tsx, signup/page.tsx). Single-page mobile glow approach landed.
- Phase 16 Plan 16-03 — ~3 min execution + Vercel deploy + visual+functional gate, 5 files modified (forgot-password, verify-email, reset-password, auth-error, account-deleted). account-deleted upgraded from bare anchor to styled NSI Button.
- Phase 16 Plan 16-04 — ~2 min execution + Vercel deploy + visual+E2E gate, 4 files modified (layout + 3 step pages). Layout-level h1 dropped (CONTEXT.md discretion default — pill + Setup label + per-step h2 carry context).
- Phase 17 — ~50 min total wall clock for 9 plans across 5 waves. Wave 1 (17-01 atoms ~8 min) → Wave 2 (17-02 PublicShell ~5 min) → Wave 3 (5 plans parallel: 17-03 ~8 min, 17-04 ~10 min, 17-05 ~2 min, 17-06 ~5 min, 17-07 ~8 min — completed in ~10 min wall clock parallel) → Wave 4 (17-08 deletions ~3 min) → Wave 5 (17-09 single Vercel deploy + 10-gate eyeball, no fix-ups). 18 requirements (PUB-01..12, HDR-05..06, EMBED-08..11). Net deletions: 4 files, 233 lines of legacy chrome.

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

### Phase 16 Decisions (locked — inform Plans 16-02/03/04)

- **Header `variant` prop is canonical for no-sidebar surfaces.** REQUIREMENTS.md AUTH-13's literal wording (`<Header variant="owner" />` for auth) is corrected: auth/onboarding pages use `variant="auth"`. Owner-shell continues to use the default. This is per RESEARCH.md section 3 — using `variant="owner"` on auth would either crash (no `SidebarProvider` for `SidebarTrigger`) or place the pill incorrectly (sidebar offset on no-sidebar pages).
- **`SidebarTrigger` import retained at top of header.tsx** (not conditionally imported). Tree-shaking handles the dead branch when `variant="auth"`. Do not refactor to dynamic import — adds runtime cost for zero benefit.
- **`rightLabel` prop precedes pathname-derived label.** When `rightLabel` is provided, `getContextLabel(pathname)` is bypassed entirely. Onboarding (`<Header variant="auth" rightLabel="Setup" />`) uses this for static "Setup" label across all 3 steps.
- **Owner default behavior preserved byte-for-byte.** No call sites updated in Plan 16-01 — Plans 16-02/03/04 introduce the new variant at consumer surfaces.
- **Auth/onboarding card class is `rounded-xl` (NOT `rounded-lg`).** Phase 15 owner-shell cards use `rounded-lg` (8px); Phase 16 auth/onboarding cards use `rounded-xl` (12px) — slightly more rounded by intentional design distinction. Verified against `border border-gray-200 bg-white p-6 shadow-sm` for the rest of the class.
- **Mobile glow on split-panel auth pages:** `/login` and `/signup` wrap each page in `relative min-h-screen overflow-hidden bg-gray-50` with `lg:hidden` `<BackgroundGlow />` for mobile-only ambient glow. Form column uses `bg-white/0` on mobile (glow visible) → `lg:bg-white` on desktop (solid white split-panel). Phase 17 `PublicShell` may want to mirror this if any public surface goes split-panel.
- **`account-deleted` upgraded:** Previously bare-bones page with `<a className="text-blue-600 underline">`. Now uses full NSI shell + styled `<Button asChild><Link>` for "Back to log in". Treat as the canonical pattern for any future bare-bones auth landing page.
- **Onboarding layout-level h1 dropped:** CONTEXT.md discretion default chose to remove "Set up your booking page" h1 since pill + "Setup" rightLabel + "Step X of 3" subtext + per-step h2 carry context. Restoreable in one line if Andrew wants it back.

### Phase 17 Decisions (locked — inform Phase 18+)

- **Header is multi-variant after all** (correction to Phase 15 lock): Phase 17 added `variant="public"` rather than introducing a separate `PublicHeader` component. The `'owner' | 'auth' | 'public'` union is now canonical. Public branch carries `branding?: Branding` + `accountName?: string` props for the customer logo/initial pill; reads no pathname.
- **PublicShell sets BOTH `--brand-primary` AND `--primary`** (with their `-foreground` counterparts) on a wrapper div around children. Required because the codebase has both consumer patterns active simultaneously: `BookingForm` submit button reads `var(--brand-primary, #0A2540)` from Phase 12.6 era; `SlotPicker` selected state uses Tailwind `bg-primary` which reads `--primary`. Setting only one leaves the other unbranded. Phase 18 BrandingEditor preview can rely on this dual-var contract.
- **PublicShell luminance fallback threshold = 0.85.** When `relativeLuminance(brand_primary) > 0.85`, glow color falls back to NSI blue `#3B82F6` so the glow remains visible against `bg-gray-50`. Defensive `try/catch` ensures bad hex strings never crash the shell.
- **CP-05 — embed CSS-var ownership confirmed live:** CSS variables do NOT cross iframe document boundaries. EmbedShell sets its OWN `--primary` + `--primary-foreground` independently from PublicShell. This is the single most important Phase 17 invariant — verified by Andrew on live preview (NSI blue selected slot on `/embed/nsi`, magenta on `/embed/nsi-rls-test`). The Phase 12.6 `style={{ "--primary": ... }}` wrapper pattern that was decommissioned for the OWNER shell IS REQUIRED for the embed; both can be true.
- **MP-10 — BackgroundGlow blob 2 terminus is `transparent`, not `#111827`:** Phase 15 owner shell got away with the dark navy terminus because the sidebar masked it. On `bg-gray-50` with arbitrary `brand_primary` (magenta, emerald), the dark terminus produced visible "smear" in test renders. Both blobs now terminate at `transparent`. Re-tested in Wave 5; clean across all 4 test account colors.
- **BackgroundGlow blob offsets translate cleanly to no-sidebar containing block:** `calc(50% + 100px)` (top) and `calc(50% + 0px)` (lower) work correctly on full-viewport public pages without re-tuning. Phase 15's reference-UI adaptation rule satisfied via Wave 5 visual gate; no offset adjustments needed.
- **Public hero card uses `rounded-2xl`** (not `rounded-xl` like other v1.2 cards). PUB-05 spec choice — more pronounced curve for the marquee element. Other public cards (confirmation, cancel, reschedule, edge) keep `rounded-xl` v1.2 lock.
- **Edge pages (not-found, TokenNotActive) intentionally do NOT use PublicShell:** No `Branding` is available before account context resolves. Plain `min-h-screen bg-gray-50` + centered `rounded-xl` card per PUB-10/PUB-11. No glass pill, no glow, no PoweredByNsi footer. Treat as canonical pattern for any future pre-account error state.
- **EmbedShell stays single-circle gradient (NOT BackgroundGlow):** Iframe canvas (300-500px tall) is too small for BackgroundGlow's 2-blob pattern — second blob would never be visible. EmbedShell's existing single-circle pattern at `opacity-40 + blur(160px)` matches BackgroundGlow blob 1 ambiance and is the correct visual scale.
- **PoweredByNsi renders inside the embed iframe** (not just on host pages). CONTEXT.md lock — every public-side surface gets the attribution. EmbedHeightReporter handles the new height automatically via ResizeObserver; no reporter code change needed.
- **mini-preview-card.tsx is a Phase 17 bridge edit only:** GradientBackdrop dependency removed to unblock deletion; Phase 18 will fully rebuild this component as a faux public booking page preview per BRAND-17. The current implementation is intentionally minimal.
- **Stale Phase 5 markers (`PLAN-05-06-REPLACE-INLINE-*`) removed during 17-04 migration:** They served no current purpose and were a tidy-up consistent with the migration. No future phase should encounter them.

### Pending Todos

- Maintenance backlog (out of v1.2 scope): clean up pre-existing tsc errors in `tests/` directory (~20 errors, all `TS7006`/`TS2305`).
- `tests/branding-gradient.test.ts` imports the deleted `shadeToGradient` from `lib/branding/gradient.ts` (Phase 17 deleted) — Phase 20 (CLEAN-04..06) will delete this test file.
- `AccountSummary` type in `app/embed/[account]/[event-slug]/_lib/types.ts` still includes `background_color` and `background_shade` fields (no longer read by EmbedShell). Removed when columns drop in Phase 21.

### Active Blockers

None. Phase 17 complete; ready to plan Phase 18 (Branding Editor Simplification).

## Session Continuity

**Last session:** 2026-04-30 — Phase 17 execute via `/gsd:execute-phase 17`.
**Stopped at:** Phase 17 complete (9/9 plans). All 10 visual gates approved on live preview by Andrew. Verifier: 24/24 must-haves passed across all plans. ROADMAP/STATE/REQUIREMENTS updated; phase completion bundled in single commit.
**Resume:** `/gsd:plan-phase 18` (Branding Editor Simplification — depends on PublicShell which now exists; rebuilds MiniPreviewCard as faux public page preview, simplifies BrandingEditor to logo + brand_primary picker only, drops sidebar_color/background_color/background_shade pickers from UI and server-side write paths).

**Files of record:**
- `.planning/PROJECT.md` — what + why (v1.2 scoping current)
- `.planning/ROADMAP.md` — v1.2 Phases 14-21
- `.planning/REQUIREMENTS.md` — 92 v1.2 requirements, traceability populated
- `.planning/STATE.md` — this file
- `.planning/research/SUMMARY.md` — synthesizer output (8-phase recommendation)
- `.planning/research/ARCHITECTURE.md` — migration map + build order
- `.planning/research/PITFALLS.md` — critical pitfalls + phase mappings
