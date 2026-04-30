# Roadmap: Calendar App (NSI Booking Tool)

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- ✅ **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (34 plans, including decimal Phases 12.5 + 12.6) — shipped 2026-04-30. Full archive: [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md).
- 🚧 **v1.2 NSI Brand Lock-Down + UI Overhaul** — Phases 14-21 (in progress, started 2026-04-30).

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-9) — SHIPPED 2026-04-27</summary>

See [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md) for full phase details.

- [x] Phase 1: Foundation — completed 2026-04-19
- [x] Phase 2: Owner Auth + Dashboard Shell — completed 2026-04-24
- [x] Phase 3: Event Types CRUD — completed 2026-04-24
- [x] Phase 4: Availability Engine — completed 2026-04-25
- [x] Phase 5: Public Booking Flow + Email + .ics — completed 2026-04-25
- [x] Phase 6: Cancel + Reschedule Lifecycle — completed 2026-04-25
- [x] Phase 7: Widget + Branding — completed 2026-04-26
- [x] Phase 8: Reminders + Hardening + Dashboard List — completed 2026-04-27
- [x] Phase 9: Manual QA & Verification — completed 2026-04-27 ("ship v1")

</details>

<details>
<summary>✅ v1.1 Multi-User + Capacity + Branded UI (Phases 10-13) — SHIPPED 2026-04-30</summary>

See [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md) for full phase details.

- [x] Phase 10: Multi-User Signup + Onboarding (9 plans) — code complete 2026-04-28
- [x] Phase 11: Booking Capacity + Double-Booking Root-Cause Fix (8 plans) — code complete 2026-04-29
- [x] Phase 12: Branded UI Overhaul (5 Surfaces) (7 plans) — code complete 2026-04-29
- [x] Phase 12.5: Per-Account Heavy Chrome Theming (INSERTED) (4 plans) — code complete 2026-04-29 (deprecated in code by 12.6; DB columns retained)
- [x] Phase 12.6: Direct Per-Account Color Controls (INSERTED) (3 plans) — code complete 2026-04-29 (Andrew live Vercel approval)
- [x] Phase 13: Manual QA + Andrew Ship Sign-Off (3 plans) — closed 2026-04-30 (Plan 13-01 complete; 13-02 + 13-03 closed-by-waiver; QA-09..13 deferred to v1.3)

</details>

### 🚧 v1.2 NSI Brand Lock-Down + UI Overhaul (Phases 14-21)

**Milestone Goal:** Establish a unified North Star Integrations visual language across the entire owner-facing app (`bg-gray-50` + blue-blot `BackgroundGlow` + glass header pill + Inter + "NorthStar" wordmark). Public booking surfaces and the 6 transactional emails remain the only places where each contractor's `brand_primary` applies. Strip all per-account theming from the owner shell. Clean up deprecated branding columns from the DB.

**Branding rule (locked):**

| Surface | Whose colors |
|---|---|
| Owner app (`/app/*`, `/auth/*`, `/onboarding/*`, and named auth pages) | NSI ONLY (`#3B82F6` + gray-50) |
| Public booking pages + embed | Customer (`brand_primary`) |
| Transactional emails | Customer (`brand_primary`) |

**Locked decisions (every phase plan must restate these 6 locks in its preamble):**
1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]` dynamic Tailwind
2. Email strategy: solid-color-only table band — no CSS gradients, no VML in email HTML
3. CSP: lives only in `proxy.ts`, never `next.config.ts`
4. Two-stage owner auth: RLS pre-check before service-role mutation
5. `background_shade` ENUM type must be dropped alongside the column in the DROP migration
6. DROP migration = two-step deploy (code-stop-reading deploy, wait 30 min, then DROP SQL)

---

#### Phase 14: Typography + CSS Token Foundations

**Goal:** The app's font stack, CSS color tokens, and letter-spacing rules match the lead-scoring "Simple Light" reference. All downstream phases can assume Inter weights 400-800, Roboto Mono, and `--color-primary: #3B82F6` are in place.

**Depends on:** Nothing (first v1.2 phase). Additive only — zero breaking changes.

**Requirements:** TYPO-01, TYPO-02, TYPO-03, TYPO-04, TYPO-05, TYPO-06, TYPO-07

**Pitfalls addressed:** MP-07 (`tracking-tight` / em-based letter-spacing conflict), MP-08 (Inter weight 800 required for wordmark)

**Success Criteria** (what must be TRUE after deploy + Andrew eyeball):
1. The "NorthStar" wordmark (introduced in Phase 15) will render at `font-extrabold` weight — confirmed by Chrome DevTools Network tab showing an `inter-latin-800` font file fetched on `/login` or any owner page.
2. Any `<code>` block or monospace element (e.g., EmbedCodeDialog snippet) renders in Roboto Mono, not the browser default monospace.
3. `h1` elements on owner pages (e.g., `/app/event-types` heading) compute `letter-spacing: -0.037em` in Chrome DevTools Computed styles.
4. Body text on owner pages computes `letter-spacing: -0.017em` (em-based, not Tailwind `tracking-tight` rem value of `-0.025rem`).
5. All shadcn primary `Button` components and `Switch` active states on owner pages render in `#3B82F6` (Tailwind blue-500) — no more Phase 12.6 navy `#0A2540`. Verified by opening `/app` dashboard and inspecting a primary button.

**Plans:** 1 plan

Plans:
- [x] 14-01: Font loading + globals.css CSS token update — completed 2026-04-30

---

#### Phase 15: BackgroundGlow + Header Pill + Owner Shell Re-Skin

**Goal:** Every owner-facing page under `/app/*` presents the NSI visual identity: blue-blot ambiance backdrop, glass "NorthStar" pill fixed at top, gray-50 base, and zero per-account color overrides. Phase 12.6's `--primary` wrapper div and `AppSidebar` `sidebarColor` prop are gone.

**Depends on:** Phase 14 (Inter weight 800 required for the `font-extrabold` "NorthStar" wordmark; `--color-primary: #3B82F6` must be in `@theme` before removing the runtime override)

**Requirements:** GLOW-01, GLOW-02, GLOW-03, GLOW-04, GLOW-05, HDR-01, HDR-02, HDR-03, HDR-04, HDR-07, HDR-08, OWNER-01, OWNER-02, OWNER-03, OWNER-04, OWNER-05, OWNER-06, OWNER-07, OWNER-08, OWNER-09, OWNER-10, OWNER-11

**Note on HDR-05, HDR-06:** HDR-05 and HDR-06 (public header customer branding) ship in Phase 17. HDR-08 (LogoutButton remains in sidebar footer per v1.2 Out of Scope) is included in Phase 15 scope as a verification step.

**Pitfalls addressed:** CP-06 (BackgroundGlow `absolute` not `fixed`; verify blobs visible behind sidebar), MP-01 (`resolveChromeColors` + `GradientBackdrop` fully removed from shell layout), MP-02 (`--sidebar-foreground` visual check on Vercel), MP-04 (JIT lock for runtime hex), MN-01 (deploy + Andrew eyeball checkpoint), MN-02 (wordmark constant in `lib/brand.ts`)

**Success Criteria** (what must be TRUE after deploy + Andrew eyeball):
1. Opening `/app` (dashboard) shows the blue-blot ambiance glow in the background behind the sidebar and main content area — no clipping at the sidebar boundary, no white/gray blank background.
2. A fixed glass pill with "North**Star**" wordmark (gray-900 "North" + blue-500 "Star", `font-extrabold`) appears at top of every `/app/*` page on both desktop and mobile viewports, replacing the old mobile-only hamburger.
3. All owner-page primary `Button` and `Switch` components render in `#3B82F6` (NSI blue-500) — confirmed by toggling a Switch on `/app/availability` and inspecting color, with no per-account override in play.
4. The `/app/branding` page (and all other `/app/*` pages) no longer show any per-account `sidebar_color` tinting on the sidebar background — sidebar is the default shadcn `--sidebar` white/light regardless of which account's branding is stored.
5. Deploy succeeds; Vercel build log shows zero TypeScript errors; `vitest` test suite count is unchanged (no tests broken by shell re-skin).

**Plans:** 2 plans

Plans:
- [x] 15-01: BackgroundGlow + Header pill components + lib/brand.ts wordmark constant — completed 2026-04-30
- [x] 15-02: (shell)/layout.tsx re-skin + AppSidebar prop strip + globals.css --primary fix + 14-card OWNER-10 standardization + Vercel deploy + Andrew eyeball — completed 2026-04-30

---

#### Phase 16: Auth + Onboarding Re-Skin

**Goal:** All 7 auth pages and the 3-step onboarding wizard present the NSI visual language — `BackgroundGlow` (NSI blue), glass header pill with "NorthStar" wordmark, gray-50 backgrounds, and white card containers — matching the owner shell established in Phase 15.

**Depends on:** Phase 15 (`BackgroundGlow` and `Header` components exist)

**Requirements:** AUTH-12, AUTH-13, AUTH-14, AUTH-15, AUTH-16, AUTH-17, ONBOARD-10, ONBOARD-11, ONBOARD-12, ONBOARD-13, ONBOARD-14, ONBOARD-15

**Pitfalls addressed:** MP-04 (JIT lock), MN-01 (deploy + eyeball), AUTH-15/ONBOARD-15 functional flow preservation — visual-layer-only constraint

**Success Criteria** (what must be TRUE after deploy + Andrew eyeball):
1. Visiting `/login` shows the split-panel layout with the blue-blot glow on the right column replacing `NSIGradientBackdrop` — the glow is visible and matches the owner shell ambiance, not the old dark navy gradient.
2. The glass "NorthStar" pill appears at the top of `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/error`, and `/account-deleted` — spanning both columns of the split-panel.
3. Visiting `/onboarding` (step 1) shows `bg-gray-50` background + blue-blot glow + "NorthStar" pill + "Setup" context label. Progress bar active segment is `bg-blue-500` (not `bg-blue-600`).
4. All existing auth functional flows work without regression: submit the login form, confirm it redirects to `/app`; submit `/forgot-password` with a test email, confirm the "check your email" state is reached. No form breakage.
5. Deploy succeeds with zero TypeScript errors; test suite unchanged.

**Plans:** TBD

Plans:
- [ ] 16-01: Auth pages re-skin (7 pages + NSIGradientBackdrop removal)
- [ ] 16-02: Onboarding wizard re-skin (3 steps)

---

#### Phase 17: Public Surfaces + Embed

**Goal:** All 5 public booking surfaces and the embed widget present the new visual language with customer `brand_primary` driving the `BackgroundGlow` tint and a customer-branded glass pill. `PublicShell` replaces `BrandedPage`. Bookers see "Powered by North Star Integrations" footer on every public page.

**Depends on:** Phase 15 (`BackgroundGlow` exists for `PublicShell` to use; Phase 15 also established the `Header` component pattern that `PublicHeader` will mirror)

**Requirements:** PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06, PUB-07, PUB-08, PUB-09, PUB-10, PUB-11, PUB-12, HDR-05, HDR-06, EMBED-08, EMBED-09, EMBED-10, EMBED-11

**Pitfalls addressed:** CP-05 (embed iframe gets its own `--primary` override — CSS vars do not cross iframe boundaries), CP-07 (`.day-has-slots` dot is `var(--color-accent)` — do NOT wire to `--primary`), MP-04 (JIT lock for `brand_primary` hex), MP-09 (`GradientBackdrop` deleted after all consumers migrate), MP-10 (second blob gradient terminus = `transparent`, not `#111827`, for public-side `BackgroundGlow`), MN-01 (deploy + eyeball with emerald + magenta + navy test accounts on prod)

**Success Criteria** (what must be TRUE after deploy + Andrew eyeball):
1. Visiting the NSI public booking page (`/nsi`) shows the blue-blot glow backdrop + a glass pill with the NSI logo (or account initial if no logo) + "North Star Integrations" account name + "Powered by North Star Integrations" text footer at the bottom.
2. Visiting the booking page for the magenta test account (nsi-rls-test) shows a magenta-tinted blob glow — confirming `brand_primary` drives `BackgroundGlow color` prop on public surfaces.
3. The embed widget (`/embed/nsi/[event-slug]`) shows `bg-gray-50` background; slot picker selected state shows NSI blue (confirming the embed's own `--primary` override is set independently from the host page).
4. Visiting `/embed/nsi-rls-test/[event-slug]` shows the slot picker selected state in magenta — confirming the embed's `--primary` override uses `brand_primary`, not NSI blue.
5. `BrandedPage` + `GradientBackdrop` components are confirmed deleted — a codebase grep for `BrandedPage` returns zero hits in non-migration files.

**Plans:** TBD

Plans:
- [ ] 17-01: PublicShell + PoweredByNsi + PublicHeader components (PUB-01..04, HDR-05, HDR-06)
- [ ] 17-02: 5 public surface migrations + embed update (PUB-05..12, EMBED-08..11)

---

#### Phase 18: Branding Editor Simplification

**Goal:** The `/app/branding` editor collapses to two controls — logo upload and `brand_primary` color picker. The three deprecated pickers (`sidebar_color`, `background_color`, `background_shade`) are removed from the UI and all server-side write paths. `MiniPreviewCard` is rebuilt as a faux public booking page preview (gray-50 + blob in `brand_primary` + white card + slot buttons).

**Depends on:** Phase 17 (`PublicShell` exists so the `MiniPreviewCard` can faithfully replicate the new public page pattern; `PreviewIframe` still points to `/embed/[account]/[event-slug]` which now uses the new visual language)

**Requirements:** BRAND-13, BRAND-14, BRAND-15, BRAND-16, BRAND-17, BRAND-18, BRAND-19, BRAND-20, BRAND-21

**Pitfalls addressed:** CP-04 (`Branding` interface + `brandingFromRow` shrunk together — update `types.ts` first to surface TypeScript errors), MP-03 (`MiniPreviewCard` and `BrandingEditor` updated in same commit wave), MP-04 (JIT lock for `brand_primary` preview blob), MN-01 (deploy + eyeball: confirm faux preview renders correctly)

**Success Criteria** (what must be TRUE after deploy + Andrew eyeball):
1. The `/app/branding` page shows exactly two editable controls: the logo uploader and the "Booking page primary color" (`brand_primary`) color picker. The sidebar color, page background, and background shade pickers are gone from the UI.
2. The `MiniPreviewCard` preview shows a faux public booking page: gray-50 background, a color blob in the current `brand_primary` selection, a white card with faux slot buttons (one selected in `brand_primary` color), and a "Powered by NSI" text mark.
3. Changing the `brand_primary` color picker and saving updates the live `PreviewIframe` on the right column to reflect the new color on the actual embed page.
4. `tsc --noEmit` passes with zero errors — `Branding` interface, `BrandingState`, `saveBrandingAction` signature, and `brandingFromRow` are all consistent on the simplified field set.
5. Deploy succeeds; test suite unchanged.

**Plans:** TBD

Plans:
- [ ] 18-01: Branding editor + MiniPreviewCard rebuild + saveBrandingAction simplification

---

#### Phase 19: Email Layer Simplification

**Goal:** The `EmailBranding` interface collapses to `{ name, logo_url, brand_primary }`. The `sidebarColor → brand_primary → DEFAULT` priority chain in `renderEmailBrandedHeader` simplifies to `brand_primary → DEFAULT`. All 6 senders and 4 route/cron callers are updated atomically in a single deploy. Email footer removes the `nsi-mark.png` `<img>` tag and renders text-only "Powered by North Star Integrations".

**Depends on:** Phase 14 (CSS token foundations ensure `brand_primary` is the sole color source); can be worked in parallel with Phases 15-18 if scheduling allows, but placed here for sequential deploy clarity.

**Requirements:** EMAIL-15, EMAIL-16, EMAIL-17, EMAIL-18, EMAIL-19, EMAIL-20

**Pitfalls addressed:** CP-01 (pre-flight requirement: `sidebar_color`, `background_color`, `chrome_tint_intensity` removed from all 4 route/cron SELECT clauses — these are the callers that feed email senders), CP-02 (`EmailBranding` interface change atomic across all 10 files in one deploy), MN-03 (email test fixtures updated for simplified interface), MN-05 (email footer text-only, not image-only)

**Success Criteria** (what must be TRUE after deploy + Andrew eyeball):
1. A test booking created on prod (NSI account) sends a confirmation email — the branded header band shows `#3B82F6` (NSI blue-500, from `brand_primary`) rather than the old navy `#0A2540` that the `sidebar_color` priority chain used to inject.
2. The confirmation email footer reads "Powered by North Star Integrations" as text — no broken image icon where `nsi-mark.png` used to render.
3. `tsc --noEmit` passes with zero errors — `EmailBranding` interface has no `sidebarColor`, `backgroundColor`, or `chromeTintIntensity` fields.
4. `vitest` passes with no unexpected test failures — `email-branded-header.test.ts` fixtures no longer include deprecated fields (or test is updated to use the simplified interface).
5. Deploy succeeds; the 6 email sender files and 4 route/cron callers all compile cleanly.

**Plans:** TBD

Plans:
- [ ] 19-01: EmailBranding interface collapse + all 6 senders + 4 route/cron callers (atomic)

---

#### Phase 20: Dead Code + Test Cleanup

**Goal:** All component files, utility functions, and test files that served the deprecated theming system (Phase 12.5 chrome tinting, Phase 12.6 gradient backdrop, `background_shade` shade picker) are deleted. Zero application call sites remain for `chromeTintToCss`, `GradientBackdrop`, `NSIGradientBackdrop`, `ShadePicker`, or `shadeToGradient`. Codebase-wide grep confirms zero stale references before Phase 21's DROP migration can run.

**Depends on:** Phases 15, 16, 17, 18, 19 (all consumers must have migrated away from deleted code before files can be deleted)

**Requirements:** CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05, CLEAN-06, CLEAN-07, CLEAN-08, CLEAN-09, CLEAN-10

**Pitfalls addressed:** MP-06 (test file `branding-chrome-tint.test.ts` deleted BEFORE `chrome-tint.ts` function bodies — test is the only external importer), MP-09 (gradient-backdrop.tsx deletion after all public consumers migrated in Phase 17)

**Success Criteria** (what must be TRUE after deploy + Andrew eyeball):
1. `vitest` run completes; test count drops by exactly the number of tests that were in `tests/branding-chrome-tint.test.ts` (expected deletion, not a regression). No other test failures.
2. Codebase grep for `GradientBackdrop`, `NSIGradientBackdrop`, `IntensityPicker`, `FloatingHeaderPill`, `ShadePicker`, `chromeTintToCss`, `chromeTintTextColor`, `resolveChromeColors`, `shadeToGradient` returns zero hits across all non-migration `.ts/.tsx` files.
3. `tsc --noEmit` passes with zero errors after all deletions — no dangling imports.
4. `lib/branding/` directory contains only `contrast.ts`, `read-branding.ts`, `types.ts` (and optionally `chrome-tint.ts` is fully deleted if `resolveChromeColors` is also removed). No dead files remain.
5. Deploy succeeds; Vercel build confirms zero compilation errors in the cleaned codebase.

**Plans:** TBD

Plans:
- [ ] 20-01: Test deletion + function deletion + component file deletions + stale-reference grep verification

---

#### Phase 21: Schema DROP Migration

**Goal:** The four deprecated `accounts` columns (`sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity`) and their associated Postgres ENUM types are permanently dropped via a two-step deploy protocol. `FUTURE_DIRECTIONS.md` §8.4 is updated to close the v1.2 backlog items.

**Depends on:** Phases 19 AND 20 (all column reads removed from runtime code and tests; `tsc --noEmit` clean; grep confirms zero runtime references). This phase MUST be the last phase of v1.2.

**Two-step deploy protocol (non-negotiable per CP-03):**
1. Deploy 1 = the code from Phases 14-20 already deployed (code stops reading deprecated columns)
2. Wait minimum 30 minutes for stale Vercel function instances to drain
3. Deploy 2 = apply the DROP migration SQL only

**Requirements:** DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09, DB-10, DB-11

**Pitfalls addressed:** CP-01 (pre-flight grep gate — zero hits for all 4 column names in runtime code before DROP runs), CP-03 (30-min mandatory drain window between code deploy and DROP SQL), MP-05 (`background_shade` ENUM type dropped alongside the column; `chrome_tint_intensity` ENUM also dropped if created as one)

**Success Criteria** (what must be TRUE after migration + smoke test):
1. Pre-flight grep passes: codebase-wide search for `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` returns zero hits in non-migration `.ts/.tsx` files (DB-01).
2. `tsc --noEmit` passes cleanly — `Branding` + `EmailBranding` interfaces have no reference to dropped column names (DB-02).
3. The 30-minute drain window after the final code deploy is observed before the DROP migration SQL runs (DB-03).
4. After running the migration via `npx supabase db query --linked -f <migration.sql>`: `\d accounts` in Supabase SQL editor shows no `sidebar_color`, `background_color`, `background_shade`, or `chrome_tint_intensity` columns; `\dT` shows no `background_shade` or `chrome_tint_intensity` ENUM types (DB-10).
5. Production booking flow smoke test passes: Andrew submits a test booking on `https://calendar-app-xi-smoky.vercel.app/nsi/[event-slug]`, receives a confirmation email with the correct `brand_primary` color header band — no 500 errors on the booking route (DB-10).

**Plans:** TBD

Plans:
- [ ] 21-01: Pre-flight verification + DROP migration SQL + post-migration smoke test + FUTURE_DIRECTIONS.md update

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v1.0 | 52 / 52 | ✅ Shipped | 2026-04-27 |
| 10-13 | v1.1 | 34 / 34 | ✅ Shipped | 2026-04-30 |
| 14 — Typography + CSS Token Foundations | v1.2 | 1 / 1 | ✅ Complete | 2026-04-30 |
| 15 — BackgroundGlow + Header Pill + Owner Shell Re-Skin | v1.2 | 2 / 2 | ✅ Complete | 2026-04-30 |
| 16 — Auth + Onboarding Re-Skin | v1.2 | 0 / TBD | Not started | - |
| 17 — Public Surfaces + Embed | v1.2 | 0 / TBD | Not started | - |
| 18 — Branding Editor Simplification | v1.2 | 0 / TBD | Not started | - |
| 19 — Email Layer Simplification | v1.2 | 0 / TBD | Not started | - |
| 20 — Dead Code + Test Cleanup | v1.2 | 0 / TBD | Not started | - |
| 21 — Schema DROP Migration | v1.2 | 0 / TBD | Not started | - |

## Cumulative Stats

- **Total phases shipped:** 15 (Phases 1-9 + Phases 10/11/12/12.5/12.6/13)
- **Total plans shipped:** 86 (52 + 34)
- **Total commits:** 357 (222 v1.0 + 135 v1.1)
- **Lines of code at v1.1 ship:** 29,450 LOC TS/TSX in runtime tree
- **Test suite at v1.1 ship:** 277 passing + 4 skipped (26 test files)

---

*Roadmap last updated: 2026-04-30 — Phase 15 complete (2/2 plans, all 22 GLOW/HDR/OWNER requirements verified, Andrew approved live deploy). Next: `/gsd:plan-phase 16`.*
