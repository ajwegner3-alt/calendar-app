# Requirements: Calendar App v1.2 — NSI Brand Lock-Down + UI Overhaul

**Defined:** 2026-04-30
**Core Value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Milestone goal:** Establish a unified North Star Integrations visual language across the entire owner-facing app (`/app/*`, `/auth/*`, `/onboarding/*`, etc.) while keeping the public booking surfaces (`/[account]`, `/[account]/[event-slug]`, `/embed/...`) and the 6 transactional emails as the only places where each contractor's `brand_primary` color applies. Re-skin every surface to the lead-scoring tool's "Simple Light" aesthetic (`bg-gray-50` + blue-blot `BackgroundGlow` + glass header pill + Inter + "NorthStar" wordmark on owner side).

**Two open questions resolved at scoping:**
- `brand_accent` column → **DROPPED**. v1.2 ships `brand_primary` only. Lead-scoring uses one color; one color is the right UX for trade contractors.
- `BrandedPage` evolution → **REPLACED with new `PublicShell`** component. Clean break retires `GradientBackdrop` + `NSIGradientBackdrop` complexity in one move.

**Branding rule (locked):**

| Surface | Whose colors |
|---|---|
| Owner app (`/app/*`, `/auth/*`, `/onboarding/*`, `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account-deleted`) | NSI ONLY (`#3B82F6` blue + gray-50) |
| Public booking page (`/[account]`, `/[account]/[event-slug]`, `/[account]/[event-slug]/confirmed/[id]`, `/cancel/[token]`, `/reschedule/[token]`) | Customer (`brand_primary`) |
| Embed widget (`/embed/[account]/[event-slug]`) | Customer (`brand_primary`) |
| 6 transactional emails | Customer (`brand_primary`) |

---

## v1.2 Requirements

Requirements for v1.2 release. Each maps to roadmap phases (see Traceability below).

### Typography & CSS Token Foundations

Foundational changes that enable all subsequent visual work. Additive only — no breaking changes.

- [x] **TYPO-01**: `app/layout.tsx` loads Inter with weights `["400","500","600","700","800"]` (current load is weight 400 only; the `font-extrabold` "NorthStar" wordmark requires 800)
- [x] **TYPO-02**: `app/layout.tsx` loads Roboto Mono via `next/font/google` and exposes `--font-roboto-mono` CSS variable
- [x] **TYPO-03**: `globals.css @theme inline` declares `--font-mono: var(--font-roboto-mono), ui-monospace, monospace`
- [x] **TYPO-04**: `globals.css` body `letter-spacing: -0.017em` (em-based, replaces Tailwind `tracking-tight` which is rem-based)
- [x] **TYPO-05**: `globals.css` `h1, h2, h3 { letter-spacing: -0.037em }`
- [x] **TYPO-06**: `globals.css @theme` `--color-primary` set to `#3B82F6` (was `#0A2540` navy)
- [x] **TYPO-07**: `globals.css @theme` `--color-sidebar-primary` set to `#3B82F6` (sidebar active-state color)

### BackgroundGlow Component

Replicated from lead-scoring `app/components/BackgroundGlow.tsx`, parameterized for dual-surface use (NSI on owner, customer-tinted on public). Single source-of-truth.

- [ ] **GLOW-01**: New component at `app/_components/background-glow.tsx` replicating the lead-scoring two-blob layout (`w-80 h-80 rounded-full blur-[160px]`, `opacity-{0.4,0.35}`, positioned right of center top + mid-page)
- [ ] **GLOW-02**: Component accepts optional `color?: string` prop; defaults to `#3B82F6` (NSI blue) when unset
- [ ] **GLOW-03**: Component uses `position: absolute` (NOT `fixed` like lead-scoring) — required for embed iframe height correctness + `SidebarInset overflow-hidden` containment
- [ ] **GLOW-04**: Component renders as `pointer-events-none aria-hidden="true"` overlay so it never intercepts clicks
- [ ] **GLOW-05**: Component is a Server Component (no client state, no hooks)

### Header Pill Component

Single component, two variants. Replaces the deleted `FloatingHeaderPill` (Phase 12.5-02) and replaces the v1.1 `AuthHero`-internal "Powered by NSI" pill at the page-level.

- [ ] **HDR-01**: New component at `app/_components/header.tsx` rendering glass pill `max-w-[1152px] mx-auto h-14 px-4 rounded-2xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]`
- [ ] **HDR-02**: Pill positioned `fixed top-2 md:top-6 left-0 right-0 z-30 px-4`
- [ ] **HDR-03**: Owner variant: "NorthStar" wordmark with `text-lg font-extrabold tracking-[-0.04em]`, `text-gray-900` "North" + `text-blue-500` "Star"
- [ ] **HDR-04**: Owner variant: optional right-side context label `text-[13px] font-medium text-gray-500` (e.g. "Dashboard", "Setup", "Your Results"); driven by prop or `usePathname()` mapping
- [ ] **HDR-05**: Public variant: customer logo `<img>` (max-height 40px) + `accounts.name` text wordmark on left side
- [ ] **HDR-06**: Public variant: when `logo_url` is null, render account initial in a `brand_primary`-tinted circle as logo fallback
- [ ] **HDR-07**: Owner variant on shell pages: integrates mobile `SidebarTrigger` (hamburger) inside the pill at `md:hidden`
- [ ] **HDR-08**: Owner variant on shell pages: integrates `LogoutButton` on right side (replacing v1.1 sidebar-footer logout placement is OUT of scope; Logout stays where it is)

### Owner Shell Re-Skin

`(shell)/layout.tsx` + `AppSidebar` strip every per-account theming hook landed in Phase 12.6. Sidebar IA preserved (Home / Event Types / Availability / Bookings / Branding / Settings).

- [ ] **OWNER-01**: `app/(shell)/layout.tsx` removes the `<div style={{ "--primary": chrome.primaryColor, "--primary-foreground": chrome.primaryTextColor }}>` wrapper entirely
- [ ] **OWNER-02**: `AppSidebar` component drops `sidebarColor` + `sidebarTextColor` props (sidebar locks to default shadcn `--sidebar` background; no inline `style` on `<Sidebar>` root)
- [ ] **OWNER-03**: `(shell)/layout.tsx` removes `backgroundColor: chrome.pageColor` inline style from `<SidebarInset>`
- [ ] **OWNER-04**: `(shell)/layout.tsx` removes `<GradientBackdrop>` import + render; replaces with `<BackgroundGlow />` (no color prop = NSI blue)
- [ ] **OWNER-05**: `(shell)/layout.tsx` replaces the `fixed top-3 left-3 z-20 md:hidden` mobile-only `SidebarTrigger` div with full `<Header variant="owner" />` rendered at root layout level (visible on desktop and mobile)
- [ ] **OWNER-06**: `(shell)/layout.tsx` `<SidebarInset>` content padding updated to `pt-20 md:pt-24 pb-12` (clear the new fixed header pill)
- [ ] **OWNER-07**: `(shell)/layout.tsx` `<SidebarInset>` background = class-driven `bg-gray-50` (no inline style)
- [ ] **OWNER-08**: All shadcn primary-color consumers on owner side (Button, Switch, focus rings, Calendar DayButton selected state, Calendar booking-dot fill) inherit NSI blue from the global `--color-primary` token automatically — verify via codebase grep no stale `var(--brand-primary, ...)` fallbacks remain on owner side
- [ ] **OWNER-09**: `HomeCalendar` DayButton dot color simplified from `var(--brand-primary, hsl(var(--primary)))` to `hsl(var(--primary))` (single source)
- [ ] **OWNER-10**: All owner-page card classes standardized to `rounded-xl border border-gray-200 bg-white p-6 shadow-sm` (currently mixed: some `rounded-lg`, some `rounded-xl`, some `bg-card`). Affected: `app/(shell)/app/page.tsx` (Home calendar card), `event-types-table.tsx`, `availability/*`, `bookings/page.tsx`, `bookings/[id]/page.tsx`, `settings/profile/*`, `settings/reminders/*`, `app/unlinked/page.tsx`
- [ ] **OWNER-11**: `(shell)/layout.tsx` `accounts` row SELECT trimmed to remove `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` columns (those reads are dead after OWNER-01..04)

### Auth Pages Re-Skin

7 auth pages: login, signup, forgot-password, reset-password, verify-email, auth-error, account-deleted. Split-panel layout preserved; visual wrapper swapped.

- [ ] **AUTH-12**: `AuthHero` aside (right column) renders `<BackgroundGlow />` (no color prop = NSI blue) replacing `<NSIGradientBackdrop>`
- [ ] **AUTH-13**: All auth pages render `<Header variant="owner" />` at the top spanning both columns of the split-panel
- [ ] **AUTH-14**: `account-deleted/page.tsx` (currently bare) gains `<Header variant="owner" />` + `<BackgroundGlow />` + content card `bg-white rounded-xl border border-gray-200 p-6 shadow-sm max-w-md mx-auto`; "Back to log in" link replaced with `<Button>` styled component (NSI blue, not bare `text-blue-600 underline`)
- [ ] **AUTH-15**: All 7 auth pages preserve their existing functional flow verbatim — `getClaims()` redirect logic, `searchParams` parsing, Server Action bindings, all hidden form inputs, all client-island state. Visual layer ONLY may change.
- [ ] **AUTH-16**: All 7 auth-page form-card containers use `rounded-xl border border-gray-200 bg-white p-6 shadow-sm` (verify shadcn `Card` token defaults match or override explicitly)
- [ ] **AUTH-17**: `NSIGradientBackdrop` component file (`components/nsi-gradient-backdrop.tsx`) deleted in cleanup phase (after all auth pages migrate to `BackgroundGlow`)

### Onboarding Wizard Re-Skin

3 wizard steps under `/onboarding/*`. Same shell pattern as auth (no sidebar, dedicated layout).

- [ ] **ONBOARD-10**: `app/onboarding/layout.tsx` background changes from `bg-white` to `bg-gray-50`
- [ ] **ONBOARD-11**: `app/onboarding/layout.tsx` renders `<BackgroundGlow />` (NSI blue) + `<Header variant="owner" />` with context label "Setup"
- [ ] **ONBOARD-12**: Onboarding layout content padding = `pt-20 md:pt-24 pb-12` (clear header pill)
- [ ] **ONBOARD-13**: 3-step progress bar active segment color updated from `bg-blue-600` to `bg-blue-500` (NSI canonical)
- [ ] **ONBOARD-14**: Each step's form card adopts `bg-white rounded-xl border border-gray-200 p-6 shadow-sm` pattern
- [ ] **ONBOARD-15**: All 3 step pages preserve form encapsulation + Server Action bindings + redirect flow verbatim. Visual layer ONLY may change.

### Public Surfaces — `PublicShell` + Re-Skin

New `PublicShell` component replaces `BrandedPage` across all 5 public surface wrappers. `--primary = brand_primary` CSS var override gained on public side (the inverse of OWNER-01).

- [ ] **PUB-01**: New component at `app/_components/public-shell.tsx` (Server Component) accepting `branding: Branding` and `children`
- [ ] **PUB-02**: `PublicShell` wraps content with `bg-gray-50` base, `<BackgroundGlow color={branding.brand_primary ?? '#3B82F6'} />`, `<Header variant="public" branding={branding} />`, `<main pt-20 md:pt-24>{children}</main>`, `<PoweredByNsi />` footer
- [ ] **PUB-03**: `PublicShell` applies `<div style={{ "--primary": branding.brand_primary, "--primary-foreground": pickTextColor(branding.brand_primary) }}>` wrapper around `{children}` (the Phase 12.6 pattern, but on public side now)
- [ ] **PUB-04**: New component `<PoweredByNsi />` at `app/_components/powered-by-nsi.tsx` rendering `<footer class="py-8 text-center"><p class="text-xs text-gray-400">Powered by <a href="https://nsintegrations.com" class="hover:text-gray-600 transition-colors">North Star Integrations</a></p></footer>` — text-only, no image (NSI mark deferred to v1.3 when final asset ships)
- [ ] **PUB-05**: `app/[account]/page.tsx` migrates from `<BrandedPage>` to `<PublicShell>`. `ListingHero` inner `GradientBackdrop` removed (redundant with global `BackgroundGlow`). Hero card pattern `rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm`.
- [ ] **PUB-06**: `app/[account]/[event-slug]/page.tsx` migrates from `<BrandedPage>` to `<PublicShell>`. `BookingShell` slot-picker card kept as-is; selected-slot `bg-primary text-primary-foreground border-primary` inherits customer color via `--primary` override automatically.
- [ ] **PUB-07**: `app/[account]/[event-slug]/confirmed/[id]/page.tsx` migrates from `<BrandedPage>` to `<PublicShell>`. Card classes updated to `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm`.
- [ ] **PUB-08**: `app/cancel/[token]/page.tsx` migrates from `<BrandedPage>` to `<PublicShell>`. Card classes standardized.
- [ ] **PUB-09**: `app/reschedule/[token]/page.tsx` migrates from `<BrandedPage>` to `<PublicShell>`. Card classes standardized.
- [ ] **PUB-10**: `app/[account]/[event-slug]/not-found.tsx` adopts `bg-gray-50` body + centered card pattern (no customer branding context — account not resolved). No `<PublicShell>` wrapper here (no branding available); use simpler `bg-gray-50` shell.
- [ ] **PUB-11**: `TokenNotActive` component (used by cancel + reschedule when token is expired) wraps in matching gray-50 + centered card pattern
- [ ] **PUB-12**: `BrandedPage` + `GradientBackdrop` + `NSIGradientBackdrop` + `lib/branding/gradient.ts` (`shadeToGradient` helper) all deleted in cleanup phase (after all 5 public callers migrate)

### Embed Widget Update

Chromeless variant of public surfaces. Gains `--primary = brand_primary` override; no glass pill (chromeless), no `<PoweredByNsi />` (would crop in iframe + interfere with height reporting).

- [ ] **EMBED-08**: `app/embed/[account]/[event-slug]/page.tsx` `EmbedShell` background changes from `bg-white` to `bg-gray-50` (visual continuity with public page)
- [ ] **EMBED-09**: `EmbedShell` retains single-circle gradient pattern (correct for small iframe canvas) BUT removes references to `background_color` and `background_shade` (deprecated columns); fallback chain simplifies to `brand_primary ?? '#0A2540'`
- [ ] **EMBED-10**: `EmbedShell` applies its OWN inline `--primary = brand_primary` style override (CSS variables don't cross iframe document boundaries — embed cannot inherit from parent doc)
- [ ] **EMBED-11**: `EmbedHeightReporter` postMessage protocol unchanged; verify `documentElement.scrollHeight` measurement still correct after `bg-gray-50` + `BackgroundGlow`-style ancestor changes

### Branding Editor Simplification

`/app/branding` collapses to 2 controls (logo + brand_primary). 3 deprecated pickers removed. `MiniPreviewCard` rebuilt as faux public booking page.

- [x] **BRAND-13**: `BrandingEditor` removes the "Sidebar color" picker, "Page background" picker, and "Background shade" picker
- [x] **BRAND-14**: `BrandingEditor` retains: `LogoUploader` + "Brand Primary Color" (`ColorPickerInput` for `brand_primary`). Label updated to "Booking page primary color"; description: "Used for the background glow, CTAs, and slot selection on your public booking pages."
- [x] **BRAND-15**: `IntensityPicker` component file (already deleted in Phase 12.6-02 — verify it's gone) confirmed removed
- [x] **BRAND-16**: `ShadePicker` component (Phase 12-01) removed from page (deleted in cleanup phase)
- [x] **BRAND-17**: `MiniPreviewCard` rebuilt: faux PUBLIC booking page (was faux dashboard in Phase 12.6). `bg-gray-50` base + blob in `brand_primary` (`blur-[60px] opacity-40` inline style) + white card `bg-white rounded-xl border border-gray-200 p-4 shadow-sm` centered + faux slot picker (3 buttons, one selected with `bg-primary` driven by `brand_primary` inline style) + tiny "Powered by NSI" `text-[10px] text-gray-400` at card bottom + faux pill at top showing logo or initial circle
- [x] **BRAND-18**: `saveBrandingAction` signature simplified from `{ backgroundColor, backgroundShade, chromeTintIntensity, sidebarColor }` to `{ logoUrl, brandPrimary }` (or whatever the existing signature is — strip the deprecated fields)
- [x] **BRAND-19**: `BrandingState` interface in editor + `Branding` type (in `lib/branding/types.ts`) drop `backgroundColor`, `backgroundShade`, `chromeTintIntensity`, `sidebarColor` fields
- [x] **BRAND-20**: `getBrandingForAccount` + `brandingFromRow` in `lib/branding/read-branding.ts` drop deprecated field reads from accounts row SELECT and return type
- [x] **BRAND-21**: `PreviewIframe` (live preview) plumbing unchanged; verify `?previewColor=` query param still drives the new `PublicShell` correctly

### Email Layer Simplification

`EmailBranding` interface collapses. Color priority chain `sidebarColor → brand_primary → DEFAULT` simplifies to `brand_primary → DEFAULT`. All 6 senders + 4 route/cron callers updated atomically.

- [ ] **EMAIL-15**: `EmailBranding` interface in `lib/email/branding-blocks.ts` (or wherever defined) collapses to `{ name: string; logo_url: string | null; brand_primary: string | null }` — remove `backgroundColor`, `sidebarColor`, `chromeTintIntensity` fields
- [ ] **EMAIL-16**: `renderEmailBrandedHeader` color resolution simplified to `branding.brand_primary ?? DEFAULT_BRAND_PRIMARY` (single fallback). Header band visual unchanged (still solid-color `<table>` band, still no VML, still no CSS gradients)
- [ ] **EMAIL-17**: All 6 transactional senders updated to construct + pass slim `EmailBranding`: `send-booking-confirmation.ts`, `send-booking-emails.ts`, `send-cancel-emails.ts`, `send-reschedule-emails.ts`, `send-reminder-booker.ts`, `send-owner-notification.ts`
- [ ] **EMAIL-18**: All 4 route/cron callers updated to SELECT only the columns the new `EmailBranding` needs: `app/api/bookings/route.ts`, `app/api/cron/send-reminders/route.ts`, `lib/bookings/cancel.ts`, `lib/bookings/reschedule.ts`
- [ ] **EMAIL-19**: `renderEmailFooter` removes the `nsi-mark.png` `<img>` tag and the `NSI_MARK_URL` conditional; renders text-only "Powered by North Star Integrations" footer
- [ ] **EMAIL-20**: Plain-text alternatives on booker-facing senders preserved (Phase 12-06 shipped these on confirmation + cancel-booker + reschedule-booker)

### Dead Code Cleanup

Concentrated deletion phase. All deletes happen AFTER consumers migrate (Phases 2-6). Tests deleted before functions.

- [ ] **CLEAN-01**: Delete `tests/branding-chrome-tint.test.ts` (the only `chromeTintToCss` consumer)
- [ ] **CLEAN-02**: Delete `chromeTintToCss` + `chromeTintTextColor` exports from `lib/branding/chrome-tint.ts` (function bodies + exports)
- [ ] **CLEAN-03**: Delete `lib/branding/chrome-tint.ts` entirely if no remaining exports (`resolveChromeColors` is also removed since OWNER-01..04 strip its 2 call sites)
- [ ] **CLEAN-04**: Delete `app/_components/gradient-backdrop.tsx` (`GradientBackdrop` component; superseded by `BackgroundGlow`)
- [ ] **CLEAN-05**: Delete `components/nsi-gradient-backdrop.tsx` (`NSIGradientBackdrop` component; superseded by `BackgroundGlow`)
- [ ] **CLEAN-06**: Delete `lib/branding/gradient.ts` (`shadeToGradient` helper; no remaining consumers after PUB-12 + EMBED-09)
- [ ] **CLEAN-07**: Delete `app/(shell)/app/branding/_components/shade-picker.tsx` (component removed from page in BRAND-16)
- [ ] **CLEAN-08**: Delete `app/(shell)/_components/floating-header-pill.tsx` (already deleted in Phase 12.5-02 per STATE.md — VERIFY it's gone, log NO-OP if confirmed)
- [ ] **CLEAN-09**: Delete `app/(shell)/app/branding/_components/intensity-picker.tsx` (already deleted in Phase 12.6-02 per STATE.md — VERIFY it's gone, log NO-OP if confirmed)
- [ ] **CLEAN-10**: Codebase-wide grep for stale references to deleted components (`GradientBackdrop`, `NSIGradientBackdrop`, `IntensityPicker`, `FloatingHeaderPill`, `ShadePicker`, `chromeTintToCss`, `chromeTintTextColor`, `resolveChromeColors`, `shadeToGradient`) — zero matches expected before next phase

### Schema DROP Migration

The LAST phase of v1.2. Two-step deploy protocol non-negotiable. All deprecated columns + ENUM type dropped in one migration.

- [ ] **DB-01**: Pre-flight grep verifies zero application code reads `accounts.sidebar_color`, `accounts.background_color`, `accounts.background_shade`, `accounts.chrome_tint_intensity` (CLEAN-10 + previous phases must be deployed)
- [ ] **DB-02**: TypeScript `tsc --noEmit` clean — no compile errors after `Branding` + `EmailBranding` interfaces shrunk
- [ ] **DB-03**: Code-stop-reading deploy completes; wait minimum 30 minutes for stale Vercel function instances to drain (Pitfall CP-01 mitigation)
- [ ] **DB-04**: New migration file `supabase/migrations/<timestamp>_v12_drop_deprecated_branding_columns.sql` with defensive `DO $$ BEGIN ... END $$;` transaction pattern (Phase 11-03 reference)
- [ ] **DB-05**: Migration drops `accounts.sidebar_color` column
- [ ] **DB-06**: Migration drops `accounts.background_color` column
- [ ] **DB-07**: Migration drops `accounts.background_shade` column AND drops the `background_shade` Postgres ENUM type (`DROP TYPE background_shade`)
- [ ] **DB-08**: Migration drops `accounts.chrome_tint_intensity` column AND drops the `chrome_tint_intensity` Postgres ENUM type (if it was created as one — verify migration history; Phase 12.5-01 created it as enum)
- [ ] **DB-09**: Migration applied via locked workaround `npx supabase db query --linked -f <migration.sql>`
- [ ] **DB-10**: Post-migration verification: `\d accounts` confirms columns dropped; `\dT` confirms ENUM types dropped; production booking flow smoke test passes (one test booking submitted + confirmation received)
- [ ] **DB-11**: `FUTURE_DIRECTIONS.md` §8.4 updated to remove the "DROP `accounts.chrome_tint_intensity`" + "Remove `chromeTintToCss` compat export" v1.2 backlog items (now resolved)

---

## Out of Scope (v1.2)

Explicitly excluded. Documented to prevent scope creep mid-milestone.

| Feature | Reason |
|---------|--------|
| `brand_accent` column + picker | Resolved at scoping. One color is correct UX for trade contractors; lead-scoring uses single accent color. Adding then dropping a column is unnecessary thrash. |
| NSI mark image (`nsi-mark.png`) in emails or web | Placeholder asset is 105 bytes solid-navy — not production-ready. Defer to v1.3 when final NSI brand asset exists. Web + email both ship text-only "Powered by North Star Integrations" footer. |
| "Powered by NSI" mark inside the embed iframe | Would be cropped + interfere with height reporting. Mark belongs on host pages only. |
| Sidebar IA changes (adding/removing/reordering items) | IA locked at scoping. Visual re-skin only. Home / Event Types / Availability / Bookings / Branding / Settings stays. |
| New functional capabilities | v1.2 is visual-only. No new routes, no new data models beyond schema cleanup. |
| Dark mode | No requirement; significant added complexity. |
| AOS scroll-reveal animations | Lead-scoring uses them on its marketing landing page; calendar-app dashboards are short single-screen flows — AOS adds no value. |
| Multiple booking page themes / theme picker | v1.x uses single unified visual language. Customer controls only blob color (`brand_primary`). |
| Per-event-type branding | Account-level branding only for v1.x. |
| Per-account theme picker for owner side | Owner side is NSI-locked. The Phase 12.6 per-account `--primary` override on owner shell is REMOVED. |
| Custom CSS white-label | Out of scope for all v1.x per PROJECT.md. |
| Server-side logo resize/optimization | Defer to v1.3 if Andrew finds logo rendering inconsistent. CSS-driven sizing handles range of inputs. |
| `Header` pill `LogoutButton` integration | Logout stays in sidebar footer. No move to header pill in v1.2. |
| Visual regression suite (Playwright) | Andrew's QA pattern is deploy + Vercel-eyeball. v1.2 ships on automated test coverage + manual visual check; no Playwright. |
| Marathon QA (QA-09..QA-13 from v1.1) | RE-deferred to v1.3 per scoping. Pre-flight artifacts kept on prod. |
| Resend migration / Vercel Pro hourly cron flip | RE-deferred to v1.3. UI overhaul ONLY for v1.2. |
| Live cross-client email QA (Outlook desktop, Apple Mail iOS, Yahoo) | RE-deferred to v1.3. v1.2 ships unchanged email rendering pattern (solid-color band still). |
| OAuth / magic-link / hard-delete cron / soft-delete grace / slug 301 / onboarding analytics / timing-oracle hardening | All RE-deferred to v1.3. |
| `react-hooks/incompatible-library` warning fix | v1.0 carry-over; not a v1.2 visual concern. |
| `tsc --noEmit` test-mock alias errors fix | v1.0 carry-over. |
| Supabase service-role key rotation (legacy JWT → `sb_secret_*`) | Waiting on Supabase rollout; not v1.2 work. |
| `generateMetadata` double-load on public booking page | v1.0 carry-over; no relation to visual overhaul. |
| `rate_limit_events` test DB cleanup | v1.1 carry-over; tests-only, no production impact. |

---

## Future Requirements (v1.3+)

Tracked but not in v1.2 roadmap. See `FUTURE_DIRECTIONS.md` §8 for canonical enumeration.

### Marathon QA (carried since v1.1)

- **QA-09**: Signup E2E (production)
- **QA-10**: Multi-tenant UI walkthrough (3 accounts)
- **QA-11**: Capacity=3 race E2E
- **QA-12**: 3-account branded smoke (visual)
- **QA-13**: EmbedCodeDialog at 320/768/1024 viewports

### Infrastructure (carried since v1.1)

- **INFRA-01**: Resend migration (replaces Gmail SMTP, ~$10/mo for 5k emails, closes EMAIL-08)
- **INFRA-02**: Vercel Pro upgrade + flip cron from `0 13 * * *` daily to `0 * * * *` hourly
- **INFRA-03**: Live cross-client email QA (Outlook desktop, Apple Mail iOS, Yahoo)

### Auth additions (carried since v1.1)

- **AUTH-V13-01**: OAuth signup (Google / GitHub) — `/auth/confirm` already supports magiclink type
- **AUTH-V13-02**: Magic-link / passwordless login — same handler ready
- **AUTH-V13-03**: Hard-delete cron purge (v1.1 ships soft-delete only)
- **AUTH-V13-04**: Soft-delete grace period (account restore on re-login within N days)
- **AUTH-V13-05**: Slug 301 redirect for old slugs after change
- **AUTH-V13-06**: Onboarding analytics event log
- **AUTH-V13-07**: Constant-time delay on signup + forgot-password forms (P-A1 timing-oracle hardening)

### NSI mark + brand asset (carried since v1.0)

- **BRAND-V13-01**: Final NSI mark image swap (`public/nsi-mark.png` placeholder)
- **BRAND-V13-02**: Add NSI mark image to "Powered by NSI" footer on web + emails (currently text-only per EMAIL-19 + PUB-04)

---

## Traceability

Populated by roadmapper 2026-04-30.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TYPO-01 | Phase 14 | Complete |
| TYPO-02 | Phase 14 | Complete |
| TYPO-03 | Phase 14 | Complete |
| TYPO-04 | Phase 14 | Complete |
| TYPO-05 | Phase 14 | Complete |
| TYPO-06 | Phase 14 | Complete |
| TYPO-07 | Phase 14 | Complete |
| GLOW-01 | Phase 15 | Complete |
| GLOW-02 | Phase 15 | Complete |
| GLOW-03 | Phase 15 | Complete |
| GLOW-04 | Phase 15 | Complete |
| GLOW-05 | Phase 15 | Complete |
| HDR-01 | Phase 15 | Complete |
| HDR-02 | Phase 15 | Complete |
| HDR-03 | Phase 15 | Complete |
| HDR-04 | Phase 15 | Complete |
| HDR-05 | Phase 17 | Complete |
| HDR-06 | Phase 17 | Complete |
| HDR-07 | Phase 15 | Complete |
| HDR-08 | Phase 15 | Complete |
| OWNER-01 | Phase 15 | Complete |
| OWNER-02 | Phase 15 | Complete |
| OWNER-03 | Phase 15 | Complete |
| OWNER-04 | Phase 15 | Complete |
| OWNER-05 | Phase 15 | Complete |
| OWNER-06 | Phase 15 | Complete |
| OWNER-07 | Phase 15 | Complete |
| OWNER-08 | Phase 15 | Complete |
| OWNER-09 | Phase 15 | Complete |
| OWNER-10 | Phase 15 | Complete |
| OWNER-11 | Phase 15 | Complete |
| AUTH-12 | Phase 16 | Complete |
| AUTH-13 | Phase 16 | Complete |
| AUTH-14 | Phase 16 | Complete |
| AUTH-15 | Phase 16 | Complete |
| AUTH-16 | Phase 16 | Complete |
| AUTH-17 | Phase 16 | Complete |
| ONBOARD-10 | Phase 16 | Complete |
| ONBOARD-11 | Phase 16 | Complete |
| ONBOARD-12 | Phase 16 | Complete |
| ONBOARD-13 | Phase 16 | Complete |
| ONBOARD-14 | Phase 16 | Complete |
| ONBOARD-15 | Phase 16 | Complete |
| PUB-01 | Phase 17 | Complete |
| PUB-02 | Phase 17 | Complete |
| PUB-03 | Phase 17 | Complete |
| PUB-04 | Phase 17 | Complete |
| PUB-05 | Phase 17 | Complete |
| PUB-06 | Phase 17 | Complete |
| PUB-07 | Phase 17 | Complete |
| PUB-08 | Phase 17 | Complete |
| PUB-09 | Phase 17 | Complete |
| PUB-10 | Phase 17 | Complete |
| PUB-11 | Phase 17 | Complete |
| PUB-12 | Phase 17 | Complete |
| EMBED-08 | Phase 17 | Complete |
| EMBED-09 | Phase 17 | Complete |
| EMBED-10 | Phase 17 | Complete |
| EMBED-11 | Phase 17 | Complete |
| BRAND-13 | Phase 18 | Complete |
| BRAND-14 | Phase 18 | Complete |
| BRAND-15 | Phase 18 | Complete |
| BRAND-16 | Phase 18 | Complete |
| BRAND-17 | Phase 18 | Complete |
| BRAND-18 | Phase 18 | Complete |
| BRAND-19 | Phase 18 | Complete |
| BRAND-20 | Phase 18 | Complete |
| BRAND-21 | Phase 18 | Complete |
| EMAIL-15 | Phase 19 | Pending |
| EMAIL-16 | Phase 19 | Pending |
| EMAIL-17 | Phase 19 | Pending |
| EMAIL-18 | Phase 19 | Pending |
| EMAIL-19 | Phase 19 | Pending |
| EMAIL-20 | Phase 19 | Pending |
| CLEAN-01 | Phase 20 | Pending |
| CLEAN-02 | Phase 20 | Pending |
| CLEAN-03 | Phase 20 | Pending |
| CLEAN-04 | Phase 20 | Pending |
| CLEAN-05 | Phase 20 | Pending |
| CLEAN-06 | Phase 20 | Pending |
| CLEAN-07 | Phase 20 | Pending |
| CLEAN-08 | Phase 20 | Pending |
| CLEAN-09 | Phase 20 | Pending |
| CLEAN-10 | Phase 20 | Pending |
| DB-01 | Phase 21 | Pending |
| DB-02 | Phase 21 | Pending |
| DB-03 | Phase 21 | Pending |
| DB-04 | Phase 21 | Pending |
| DB-05 | Phase 21 | Pending |
| DB-06 | Phase 21 | Pending |
| DB-07 | Phase 21 | Pending |
| DB-08 | Phase 21 | Pending |
| DB-09 | Phase 21 | Pending |
| DB-10 | Phase 21 | Pending |
| DB-11 | Phase 21 | Pending |

**Coverage:**
- v1.2 requirements: 95 total
- Mapped to phases: 95 / 95 ✓
- Unmapped: 0 ✓

**Phase distribution:**
- Phase 14 — Typography + CSS Token Foundations: 7 requirements (TYPO-01..07)
- Phase 15 — BackgroundGlow + Header Pill + Owner Shell Re-Skin: 22 requirements (GLOW-01..05, HDR-01..04, HDR-07, HDR-08, OWNER-01..11)
- Phase 16 — Auth + Onboarding Re-Skin: 12 requirements (AUTH-12..17, ONBOARD-10..15)
- Phase 17 — Public Surfaces + Embed: 18 requirements (PUB-01..12, HDR-05..06, EMBED-08..11)
- Phase 18 — Branding Editor Simplification: 9 requirements (BRAND-13..21)
- Phase 19 — Email Layer Simplification: 6 requirements (EMAIL-15..20)
- Phase 20 — Dead Code + Test Cleanup: 10 requirements (CLEAN-01..10)
- Phase 21 — Schema DROP Migration: 11 requirements (DB-01..11)

---

*Requirements defined: 2026-04-30 for v1.2 milestone (NSI Brand Lock-Down + UI Overhaul)*
*Open questions resolved at scoping: brand_accent → DROP; BrandedPage → REPLACE with PublicShell*
*Traceability populated: 2026-04-30 by gsd-roadmapper (92/92 requirements mapped)*
*Last updated: 2026-04-30 after roadmap creation*
