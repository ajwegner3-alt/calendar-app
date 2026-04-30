# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-30 — **v1.2 milestone started.** Scope locked via `/gsd:new-milestone`: NSI Brand Lock-Down + UI Overhaul. Owner side becomes NSI-only (gray-50 + blue-blot backdrop + "NorthStar" wordmark + `--primary = #3B82F6`); public booking page + embed + emails keep per-account `brand_primary` driving the same layout pattern. Branding editor simplifies to logo + brand_primary + brand_accent. Schema cleanup at end (DROP `sidebar_color` / `background_color` / `background_shade` / `chrome_tint_intensity` + remove `chromeTintToCss` compat export). v1.1 marathon QA + Resend + Vercel Pro RE-deferred to v1.3. Next: research → requirements → roadmap.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-30 for v1.2 scoping)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.2 — NSI Brand Lock-Down + UI Overhaul. Reference UI: `C:\Users\andre\OneDrive - Creighton University\Desktop\Claude-Code-Projects\lead-scoring-with-tools\website-analysis-tools\` (`app/components/BackgroundGlow.tsx`, `app/components/Header.tsx`, `app/dashboard/layout.tsx`, `app/globals.css`). Underlying design system: `C:\Users\andre\OneDrive - Creighton University\Desktop\Claude-Code-Projects\website-creation\.claude\skills\tailwind-landing-page\SKILL.md` (Cruip "Simple Light").

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Milestone:** v1.2 — NSI Brand Lock-Down + UI Overhaul (started 2026-04-30; not yet planned).
**Phase:** Not started — defining requirements.
**Plan:** —
**Status:** Scoping. Research → requirements → roadmap pending.
**Last activity:** 2026-04-30 — `/gsd:new-milestone` answered: owner=NSI / public=customer locked, sidebar IA preserved, branding simplified to logo + brand_primary + brand_accent, schema cleanup inside v1.2, marathon QA → v1.3.

## v1.2 Visual Locks (frozen at scoping)

These are NOT proposals — they are committed before research begins. Research and planning must respect them.

- **Owner side `--primary`** = `#3B82F6` (Tailwind `blue-500`) always. Phase 12.6's `(shell)` layout `--primary` override (currently sourced from `chrome.primaryColor`) is REMOVED. Phase 12.6's `AppSidebar` `sidebar_color` style override is REMOVED. All shadcn primary buttons / switches / focus rings / active indicators on owner side show NSI blue.
- **Owner side background** = `bg-gray-50` (`#F9FAFB`) + `BackgroundGlow` component (replicating lead-scoring `app/components/BackgroundGlow.tsx`) with NSI blue blots fixed.
- **Owner side header** = glass pill `bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl`, "NorthStar" wordmark (gray-900 + blue-500 split, `font-extrabold tracking-[-0.04em]`). Replaces the plain mobile-only `SidebarTrigger` hamburger that 12.5-02 left in place.
- **Owner side sidebar IA** preserved from Phase 12 — Home / Event Types / Availability / Bookings / Branding / Settings. NO IA change. Visual re-skin only.
- **Public booking page + embed** = same gray-50 + blob-glow + glass-pill layout, BUT blob tint = customer `brand_primary`, pill = customer logo + name (NOT "NorthStar"), "Powered by NSI" footer mark visible to bookers. Single visual language, two color sources.
- **Branding editor** simplified to **logo + brand_primary + brand_accent** (2 colors). `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` columns + their pickers + their preview wiring are DEPRECATED. Schema DROP migration is the last phase of v1.2.
- **Email header band** uses `brand_primary` directly. The Phase 12.6 `sidebar_color → brand_primary → DEFAULT` priority chain is collapsed. `EmailBranding.sidebarColor` field removed from interface; `chromeTintIntensity` and `backgroundColor` fields also removed (left in for compat through v1.1, deletable in v1.2).
- **Carry-overs** — UI overhaul ONLY for v1.2. Marathon QA (QA-09..QA-13), Resend migration, Vercel Pro hourly cron flip, live cross-client email QA, all auth additions (OAuth / magic-link), and the rest of `FUTURE_DIRECTIONS.md` §8.4 are RE-deferred to v1.3.

## Accumulated Context (carried forward from v1.0 + v1.1)

### Load-bearing decisions for v1.2 planning

(Full historical decision log in `.planning/PROJECT.md` Key Decisions table and `.planning/milestones/v1.0-ROADMAP.md` + `.planning/milestones/v1.1-ROADMAP.md` Milestone Summaries. The following are the load-bearing decisions for v1.2 planning.)

- **v1.1 SHIPPED 2026-04-30 with marathon waiver.** Phase 13 marathon (QA-09..QA-13) re-deferred per Andrew. Pre-flight artifacts (Test User 3, capacity-test event, 3 branding profiles) KEPT on prod for v1.3 marathon execution. v1.2 should NOT consume those artifacts.
- **Inter font + tracking-tight + bg-gray-50 base shipped in Phase 12-03.** Already matches lead-scoring `globals.css`. v1.2 doesn't need to re-add — verify and extend.
- **`FloatingHeaderPill` deleted in Phase 12.5-02** (only mobile `SidebarTrigger` hamburger remains at `top-3 left-3 z-20 md:hidden`). v1.2 brings back a full `Header` component matching lead-scoring's pattern (fixed top-2 md:top-6, NorthStar wordmark, NOT mobile-only).
- **Phase 12.6 `--primary` CSS var override pattern** — currently shell layout wraps `<div style={{ "--primary": chrome.primaryColor, "--primary-foreground": chrome.primaryTextColor ?? undefined }}>`. v1.2 REMOVES this entirely on owner side. Public surfaces (`/[account]`, `/embed`) need to gain it (currently NOT in scope per Phase 12.6 lock).
- **Phase 12.6 `AppSidebar` direct hex pattern** — props `sidebarColor + sidebarTextColor` applied as `style={{ backgroundColor: sidebarColor ?? undefined }}`; `--sidebar-foreground` CSS var override. v1.2 REMOVES the prop-driven coloring entirely on owner side. AppSidebar locks to default shadcn `--sidebar` background; only the v1.2 visual re-skin (rounded edges, spacing, typography) applies.
- **`saveBrandingAction` signature** currently takes `{ backgroundColor, backgroundShade, chromeTintIntensity, sidebarColor }`. v1.2 simplifies to `{ logoUrl, brandPrimary, brandAccent }`. The `BrandingState` interface, `brandingFromRow`, `getBrandingForAccount` all need corresponding shrinks.
- **`MiniPreviewCard`** — currently rebuilt as 3-color preview (sidebarColor + pageColor + primaryColor) per Phase 12.6-02. v1.2 rebuilds AGAIN as a faux public-booking-page preview (gray-50 base + blob in brandPrimary + white card + accent on slot picker). Owner-side preview is unnecessary because owner is NSI-locked.
- **Email branding interface** — currently `EmailBranding { brand_primary, sidebarColor, chromeTintIntensity, backgroundColor, ... }`. v1.2 collapses to `{ logoUrl, brandPrimary, brandAccent, accountName }`. All 6 senders + 4 route/cron callers update accordingly.
- **`BackgroundGlow` reference component** at `C:\Users\andre\...\lead-scoring-with-tools\website-analysis-tools\app\components\BackgroundGlow.tsx` — fixed-position blue-blot pattern. v1.2 vendors or replicates this. Needs a `color` prop to support customer-tinted version on public surfaces.
- **`v1.1` `GradientBackdrop` and `NSIGradientBackdrop` (Phase 12-01)** — likely superseded by v1.2 `BackgroundGlow`. Phase plan should decide: replace entirely, or keep as fallback inside `BrandedPage`.
- **All v1.0 + v1.1 architectural patterns preserved** — race-safety at DB layer, service-role gate, per-route CSP via `proxy.ts`, direct-call Server Action contract, two-stage owner authorization, Postgres-backed rate limiting, token-based public lifecycle routes, reminder cron claim-once via CAS, vendor over npm-link, SECURITY DEFINER provisioning trigger, `/auth/confirm` with `verifyOtp`, race-safe N-per-slot via slot_index extended unique index, CONCURRENTLY index migration via shell pipe.

### Reference UI components (v1.2 visual targets — VERIFIED 2026-04-30)

- `lead-scoring-with-tools/website-analysis-tools/app/components/BackgroundGlow.tsx` (28 lines) — fixed `inset-0 z-0 pointer-events-none overflow-hidden`, two `w-80 h-80 rounded-full opacity-{0.4,0.35} blur-[160px]` divs, gradients `linear-gradient(to top right, #3B82F6, transparent)` and `#3B82F6 → #111827`.
- `.../app/components/Header.tsx` (39 lines) — `fixed top-2 md:top-6 left-0 right-0 z-30 px-4`; pill `max-w-[1152px] h-14 px-4 rounded-2xl flex items-center justify-between bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]`; "NorthStar" wordmark `text-lg font-extrabold tracking-[-0.04em]` with `text-gray-900` + `text-blue-500` split; right-side `text-[13px] font-medium text-gray-500` context label (e.g. "Free Website Audit", "Your Results", "Dashboard").
- `.../app/dashboard/layout.tsx` (40 lines) — `min-h-screen bg-gray-50 pt-20 md:pt-24` shell; sub-header `bg-white/80 backdrop-blur-sm border-b border-gray-200` with title + LogoutButton; `<TabBar />`; content `max-w-7xl mx-auto px-4 py-6`. **NOTE:** v1.2 calendar-app KEEPS its sidebar IA (per scoping), so this layout pattern is a reference for visual language, NOT a structural copy.
- `.../app/dashboard/components/TabBar.tsx` (48 lines) — `bg-white border-b border-gray-200`, horizontal tabs `whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors`, active = `border-blue-500 text-blue-600`, inactive = `border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300`. **NOTE:** v1.2 owner side does not adopt TabBar — sidebar IA preserved. The active-state pattern (border-l-2 or bg-blue-50 equivalent) may inspire sidebar nav active treatment.
- `.../app/globals.css` (50 lines) — `@import "tailwindcss"`; `@theme inline` sets `--color-background: #F9FAFB`, `--color-foreground: #111827`, `--font-sans: var(--font-inter)`, `--font-mono: var(--font-roboto-mono)`; `body { background: #F9FAFB; color: #1F2937; line-height: 1.5; letter-spacing: -0.017em; overflow-x: hidden; min-height: 100vh; }`; `h1, h2, h3 { letter-spacing: -0.037em; }`; AOS scroll-reveal CSS pattern.
- `.../app/free-audit/page.tsx` — concrete usage example: `min-h-screen bg-gray-50` body, `pt-20 md:pt-24 pb-12` main, `max-w-2xl mx-auto px-4` content, white cards `bg-white rounded-xl border border-gray-200 p-{4,6} shadow-sm`, primary CTA `bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl px-6 py-3 min-h-[44px]`, error cards same pattern with `text-red-500` icon.

### Skills directory (v1.2 design references — VERIFIED 2026-04-30)

`C:\Users\andre\OneDrive - Creighton University\Desktop\Claude-Code-Projects\website-creation\.claude\skills\`:
- `tailwind-landing-page/SKILL.md` — Cruip "Simple Light" design system (already used in v1.1)
- `different-styles/SKILL.md` — broader style catalog
- `artifacts-builder/SKILL.md` — component-construction patterns
- `hero-section-contractor/`, `hero-section-medspa/`, `roofing-template/` — vertical-specific landing patterns

Subagents working on v1.2 should consult these before generating any component code.

### Pending Todos

None tracked in `.planning/todos/pending/` for v1.2 yet.

### Open Carried Concerns (v1.3 backlog — see `FUTURE_DIRECTIONS.md` §8.4)

Tracked but explicitly NOT in v1.2 scope:

- v1.1 marathon QA execution + ~21 per-phase manual checks
- v1.0 marathon RE-deferred items (EMBED-07, EMAIL-08, QA-01..QA-06)
- Resend migration / Vercel Pro hourly cron flip / live cross-client email QA
- OAuth / magic-link / hard-delete cron / soft-delete grace / slug 301 redirect / onboarding analytics / timing-oracle hardening
- `rate_limit_events` test DB cleanup
- `react-hooks/incompatible-library` warning on `event-type-form.tsx:99`
- Pre-existing `tsc --noEmit` test-mock alias errors
- Supabase service-role key still legacy JWT
- `generateMetadata` double-load on public booking page

### Active Blockers / Decisions Required Before Planning

- **What does `brand_accent` actually control on the booking page?** Open question. Research must answer: secondary CTA color? Slot-picker selected-state border? Hover-state ring? Or is it redundant with `brand_primary` (lead-scoring uses only `blue-500`)? If redundant, drop the column from the plan and ship `brand_primary`-only.
- **Vendor or replicate `BackgroundGlow`?** Decision in research: copy file into `calendar-app/app/_components/` (single owner-side import + customer-color-prop variant for public) OR add a npm-publishable shared component package (overkill for v1.2). Probably copy-into-tree.
- **Does `BrandedPage` survive?** Currently the wrapper for public surfaces. v1.2 may merge `BrandedPage` + `BackgroundGlow` + glass header pill into a single `PublicShell` component, retiring the v1.1 `GradientBackdrop` / `NSIGradientBackdrop` primitives. Research/plan-phase decides.
- **Schema migration ordering** — DROP columns at end (last phase) is locked, but research must enumerate every column reader/writer and confirm migration order doesn't break in-flight requests. Phase 12.6 `chromeTintToCss` compat export is the trickiest: still imported by Phase 12.5 tests. Tests must be deleted before column DROP.

---

## Session Continuity

**Last session:** 2026-04-30 — `/gsd:new-milestone` answered scoping questions for v1.2. PROJECT.md updated with new Current Milestone section. STATE.md (this file) reset for v1.2. v1.1 research files archived to `.planning/milestones/v1.1-research/`. Next step: spawn 4 parallel research agents.

**Stopped at:** Pre-research. Ready to display RESEARCHING banner and spawn 4 `gsd-project-researcher` agents (Stack / Features / Architecture / Pitfalls) + synthesizer.

**Resume:** Continue current `/gsd:new-milestone` execution from Phase 7 (Research Decision = "Research first") onward.

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-04-30 for v1.2)
- `.planning/MILESTONES.md` — v1.0 + v1.1 entries
- `.planning/REQUIREMENTS.md` — TBD (will be created post-research)
- `.planning/ROADMAP.md` — v1.0 + v1.1 collapsed (will be extended for v1.2)
- `.planning/milestones/v1.0-ROADMAP.md` / `v1.0-REQUIREMENTS.md` — v1.0 archive
- `.planning/milestones/v1.1-ROADMAP.md` / `v1.1-REQUIREMENTS.md` — v1.1 archive
- `.planning/milestones/v1.1-research/` — v1.1 research archive (STACK / FEATURES / ARCHITECTURE / PITFALLS / SUMMARY)
- `.planning/research/` — v1.2 research (TBD; will be populated by 4 parallel researcher agents next)
- `.planning/config.json` — depth=standard, mode=yolo, parallelization=true, model_profile=balanced
- `FUTURE_DIRECTIONS.md` (repo root) — v1.0 + v1.1 carry-over backlog (read §8.4 for v1.3 candidates)
