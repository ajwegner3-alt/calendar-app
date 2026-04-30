# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-30 — **v1.1 SHIPPED.** Phase 13 closed via Andrew marathon waiver: verbatim "consider everything good. close out the milestone." Plans 13-02 + 13-03 closed-by-waiver (no marathon executed); QA-09..QA-13 = DEFERRED-V1.2 (5 items); QA-14 + QA-15 = Complete. FUTURE_DIRECTIONS.md §8 appended with marathon waiver record + carry-overs. Plan 13-01 pre-flight artifacts (Test User 3, capacity-test event, 3 branding profiles) KEPT on prod for v1.2 marathon. Next: `/gsd:complete-milestone` to archive v1.1.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-27 after v1.0 milestone)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.1 SHIPPED 2026-04-30. Phase 13 closed via marathon waiver. Next milestone: v1.2 (carry over 5 marathon items + per-phase manual deferrals + Resend migration + Vercel Pro hourly cron + Phase 12.5 chrome_tint_intensity column DROP + chromeTintToCss compat removal + final NSI mark swap + live cross-client email QA).

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Milestone:** v1.1 SHIPPED 2026-04-30 (started 2026-04-27).
**Phase:** Phase 13 CLOSED 2026-04-30 (marathon waived).
**Last completed plan:** 13-03 (future-directions-and-sign-off; closed by Andrew marathon waiver) — 2026-04-30. Plan 13-02 sibling: closed-by-waiver same date.
**Status:** v1.1 milestone COMPLETE. Ready for `/gsd:complete-milestone` archive + v1.2 kickoff.
**Last activity:** 2026-04-30 — Andrew verbatim "consider everything good. close out the milestone." Phase 13 closed via marathon waiver: 13-CHECKLIST sign-off populated, FUTURE_DIRECTIONS §8 appended, ROADMAP + REQUIREMENTS marked, 13-02 + 13-03 SUMMARY files written, all changes bundled in close-out commit.

**Progress (across both v1.0 and v1.1):** [████████████░] Phase 12 COMPLETE (all 7 plans done); Phase 12.5 COMPLETE (all 4 plans done); Phase 12.6 COMPLETE (all 3 plans done — 12.6-01/02/03); Phase 13 pending milestone-end QA (v1.0 SHIPPED 2026-04-27; Phase 10 code-complete 2026-04-28; Phase 11 code-complete 2026-04-29; Phase 12 code-complete 2026-04-29; Phase 12.5 code-complete 2026-04-29; Phase 12.6 code-complete 2026-04-30)

```
v1.0 — SHIPPED 2026-04-27
Phase 1  [✓] Foundation                              (verified 2026-04-19)
Phase 2  [✓] Owner Auth + Dashboard Shell            (verified 2026-04-24)
Phase 3  [✓] Event Types CRUD                        (verified 2026-04-24)
Phase 4  [✓] Availability Engine                     (verified 2026-04-25)
Phase 5  [✓] Public Booking Flow + Email + .ics      (Complete 2026-04-25)
Phase 6  [✓] Cancel + Reschedule Lifecycle           (Complete 2026-04-25)
Phase 7  [✓] Widget + Branding                       (Complete 2026-04-26)
Phase 8  [✓] Reminders + Hardening + Dashboard List  (Complete 2026-04-27)
Phase 9  [✓] Manual QA & Verification                (Complete 2026-04-27 — "ship v1")

v1.1 — IN PROGRESS (started 2026-04-27)
Phase 10 [✓~] Multi-User Signup + Onboarding         (auto complete 2026-04-28; 3 deferred QA items)
  10-01 [✓] reserved-slugs-consolidation             (Complete 2026-04-28)
  10-02 [✓] auth-confirm-and-password-reset          (Complete 2026-04-28)
  10-03 [✓] accounts-rls-and-provisioning-trigger    (Complete 2026-04-28)
  10-04 [✓] gmail-smtp-quota-cap-and-alert           (Complete 2026-04-28)
  10-05 [✓*] signup-page-and-email-confirm-toggle    (auto done 2026-04-28; P-A8 checkpoint deferred)
  10-06 [✓] onboarding-wizard-and-provisioning       (Complete 2026-04-28 — resumed execution)
  10-07 [✓] profile-settings-and-soft-delete         (Complete 2026-04-28)
  10-08 [✓] email-change-with-reverification         (Complete 2026-04-28)
  10-09 [✓*] rls-matrix-extension-and-checklist      (auto done 2026-04-28; Task 1 + browser QA deferred)
Phase 11 [✓] Booking Capacity + Double-Booking Fix   (COMPLETE 2026-04-29 — all 8 plans done)
  11-01 [✓] cap-01-root-cause-investigation           (Complete 2026-04-28 — verdict (c), gate PROCEED)
  11-02 [✓] capacity-columns-migration                (Complete 2026-04-28 — max_bookings_per_slot + show_remaining_capacity live on prod)
  11-03 [✓] slot-index-migration                      (Complete 2026-04-28 — bookings.slot_index live; bookings_capacity_slot_idx replaces bookings_no_double_book; smoke 23505 confirmed)
  11-04 [✓] bookings-api-capacity-retry               (Complete 2026-04-29 — slot_index retry loop + CAP-07 SLOT_TAKEN/SLOT_CAPACITY_REACHED live; 148 tests passing)
  11-05 [✓] slots-api-capacity-aware                  (Complete 2026-04-29 — Pitfall 4 closed (.eq("status","confirmed")); CAP-04 slot exclusion + CAP-08 remaining_capacity opt-in; 148 tests passing)
  11-06 [✓] pg-driver-race-test                       (Complete 2026-04-29 — CAP-06 pg-driver race test; postgres.js devDep; pg-direct helper; skip-guarded; 148 tests + 26 skipped)
  11-07 [✓] event-type-form-capacity                  (Complete 2026-04-29 — CAP-03 input + CAP-08 toggle + CAP-09 modal; in-JS group-by; fail-closed; 148 tests + 26 skipped)
  11-08 [✓] booker-ui-capacity                        (Complete 2026-04-29 — CAP-08 'X spots left' badge + CAP-07 409 branching on body.code; RaceLoserBanner message prop; 148 tests + 26 skipped)
Phase 12 [✓] Branded UI Overhaul (6 Surfaces)        (COMPLETE 2026-04-29 — all 7 plans done)
  12-01 [✓] branding-tokens-foundation               (Complete 2026-04-29 — background_color + background_shade columns; GradientBackdrop/NSIGradientBackdrop primitives; BrandedPage extended; /app/branding editor wired; 173 tests + 26 skipped)
  12-02 [✓] auth-pages-restyle                       (Complete 2026-04-29 — AuthHero component; 6 auth pages (login/signup/forgot-password/verify-email/reset-password/auth-error) Cruip split-panel; NSIGradientBackdrop in hero; all auth logic preserved; UI-12 satisfied)
  12-03 [✓] dashboard-chrome                         (Complete 2026-04-29 — Inter font + gray-50 + Cruip glass header pill + GradientBackdrop in shell layout + flat sidebar IA (Home/Event Types/Availability/Bookings/Branding/Settings accordion); 184 tests + 26 skipped)
  12-04a [✓] home-tab-server-and-calendar            (Complete 2026-04-29 — loadMonthBookings + regenerateRescheduleTokenAction + sendReminderForBookingAction + HomeCalendar capped-dot DayButton + OnboardingBanner + page.tsx refactor; WelcomeCard removed; 208 tests + 26 skipped)
  12-04b [✓] home-tab-day-detail-sheet               (Complete 2026-04-29 — DayDetailRow 4 actions + 3 AlertDialogs; DayDetailSheet shadcn Sheet; HomeDashboard state container; page.tsx timezone wire-up; 17 new tests; 225 passing + 26 skipped)
  12-05 [✓] public-surfaces-restyle                  (Complete 2026-04-29 — ListingHero + /[account] hero card; BookingShell py-12 md:py-20 + max-w-3xl card; embed single-circle gradient Pitfall-10-safe; EmbedCodeDialog sm:max-w-2xl; all public BrandedPage callers pass backgroundColor/backgroundShade; UI-09/10/11/13 satisfied)
  12-06 [✓] email-restyle                            (Complete 2026-04-29 — renderEmailBrandedHeader solid-color band + NSI mark PNG + plain-text alts on booker senders; all 6 senders migrated; EMAIL-09/10/11/12 closed; 191 tests + 26 skipped)
Phase 12.5 [✓] Per-Account Chrome Theming            (COMPLETE 2026-04-29 — all 4 plans done)
  12.5-01 [✓] foundation                             (Complete 2026-04-29 — chrome_tint_intensity enum + col; ChromeTintIntensity + chromeTintToCss; 240 tests + 26 skipped)
  12.5-02 [✓] dashboard-chrome                       (Complete 2026-04-29 — FloatingHeaderPill deleted; sidebar + page tinted via color-mix inline styles; WCAG --sidebar-foreground var override; plain SidebarTrigger hamburger md:hidden; 240 tests + 26 skipped)
  12.5-03 [✓] branding-editor                        (Complete 2026-04-29 — IntensityPicker (None/Subtle/Full); chrome-aware MiniPreviewCard (faux-sidebar + faux-page + white faux-card); chromeTintIntensity BrandingState + saveBrandingAction round-trip; 240 tests + 26 skipped)
  12.5-04 [✓] email-tokens                           (Complete 2026-04-29 — EmailBranding.chromeTintIntensity; intensity-aware renderEmailBrandedHeader; all 6 senders wired; 240 tests + 26 skipped)
Phase 12.6 [~] Direct Per-Account Color Controls     (Wave 1 COMPLETE 2026-04-30; Wave 2 next)
  12.6-01 [✓] foundation                             (Complete 2026-04-30 — accounts.sidebar_color prod column; Branding.sidebarColor; resolveChromeColors() ResolvedChromeColors; chromeTintToCss compat kept; 252 tests + 26 skipped)
  12.6-02 [✓] dashboard-chrome-and-editor            (Complete 2026-04-30 — shell --primary CSS var; AppSidebar direct hex; 3 pickers; 3-color MiniPreviewCard; IntensityPicker deleted; sidebar_color DB write; 255 tests + 26 skipped)
  12.6-03 [✓] email-tokens                           (Complete 2026-04-30 — EmailBranding.sidebarColor; EMAIL-14 sidebarColor→brand_primary→DEFAULT chain; all 6 senders + 4 callers wired; 255 tests + 26 skipped)
Phase 13 [✓~] Manual QA + Andrew Ship Sign-Off       (CLOSED 2026-04-30 — marathon waived by Andrew; QA-09..13 → v1.2)
  13-01 [✓] pre-qa-prerequisites-and-pre-flight-fixes (Complete 2026-04-29 — email-confirm toggle ON; Test User 3 wired; 3 branded accounts; capacity=3 event live; 13-CHECKLIST scaffolded; NSI mark deferred to v1.2; deploy SHA ed81ac7; 277 tests + 4 skipped)
  13-02 [✓~] marathon-qa-execution                    (Closed-by-waiver 2026-04-30 — Andrew verbatim "consider everything good"; QA-09..QA-13 = DEFERRED-V1.2; no marathon executed)
  13-03 [✓] future-directions-and-sign-off            (Complete 2026-04-30 — FUTURE_DIRECTIONS.md §8 appended; QA-14 + QA-15 satisfied; KEEP cleanup decision recorded)
```

**v1.1 SHIPPED 2026-04-30** — 34 plans executed across Phases 10/11/12/12.5/12.6/13; 62/67 requirements complete; 5 marathon items + per-phase manual deferrals carried to v1.2 per `FUTURE_DIRECTIONS.md` §8.

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 13 / 13 (v1.0 + v1.1) |
| Phases complete | 9 / 13 (v1.0 SHIPPED) |
| Plans complete (v1.0) | 52 / 52 |
| Plans planned (v1.1) | TBD (estimates: P10 ~7-9, P11 ~3-4, P12 ~5-7, P13 ~2-3) |
| v1.0 requirements complete | 66 / 73 (90.4%) — 7 deferred to v1.2 backlog |
| v1.1 requirements mapped | 53 / 53 (100%) |
| v1.1 requirements complete | 28 / 53 (Phase 10: 19; Phase 11: 9) |
| Files created/modified (v1.0) | 344 |
| Lines inserted (v1.0) | 85,014 |
| TS/TSX runtime LOC (v1.0 ship) | 20,417 |
| Commits (v1.0) | 222 (`e068ab8` → `3f83461`) |
| Tests (v1.0 ship) | 131 passing + 1 skipped (16 test files) |

## Accumulated Context

### Key Decisions (carried forward to v1.1+)

(Full historical decision log in `.planning/PROJECT.md` Key Decisions table and `.planning/milestones/v1.0-ROADMAP.md` Milestone Summary. The following are the load-bearing decisions for v1.1 planning.)

- **v1.0 SHIPPED 2026-04-27 with Andrew's verbatim sign-off "ship v1".** Marathon QA scope-cut to v1.1 (then RE-deferred to v1.2 by project-owner discretion 2026-04-27). v1 ships on extensive automated coverage (131/132 green) + Phase 7 live verification + Phase 8 code-complete + Apple Mail code-review LIKELY PASS.
- **Multi-tenant from day one, single tenant in production** — schema supports many accounts; only Andrew's account seeded; signup UI deferred from v1.0 → v1.1 (Phase 10 active).
- **DB-level race-safe via `bookings_no_double_book` partial unique index** — authoritative double-book guard at v1.0. Will be REPLACED in Phase 11 with N-per-slot mechanism (advisory-lock trigger or slot_index — planner research-phase decides).
- **`timestamptz` everywhere + IANA TZ + `date-fns v4 + @date-fns/tz`** — no raw `Date` math; `TZDate(y, m-1, d, hh, mm, 0, TZ)` constructor for wall-clock window endpoints. Locked.
- **Service-role gate** — `lib/supabase/admin.ts` line 1 `import "server-only"`. Locked for any future service-role module (signup provisioning will use this if Server Action pattern picked).
- **CSP/X-Frame-Options ownership rule** — `proxy.ts` is the EXCLUSIVE owner; `next.config.ts` only sets the global SAMEORIGIN default. Never set X-Frame-Options in `next.config.ts` again.
- **Vendor `@nsi/email-sender` (NOT `npm install ../email-sender`)** — Vercel build cannot resolve sibling-relative `file:../` paths. Pattern locked.
- **Email = Gmail SMTP via owner's personal Gmail** (post-Resend pivot in Phase 5). ⚠ Phase 10 must commit on a quota plan (P-A12 highest under-mitigated v1.1 risk: cap signups / migrate to Resend / wire alert).
- **Vercel Pro tier required for hourly cron** — `vercel.json` `crons[].schedule = "0 * * * *"` does not deploy on Hobby.
- **Direct-call Server Action contract for forms** — actions accept structured TS objects (NOT FormData) when forms have nested arrays/discriminated unions.
- **Two-stage owner authorization** — RLS-scoped pre-check before service-role mutation. Pattern locked.
- **POST `/api/bookings` is a Route Handler (NOT Server Action)** — Server Actions cannot return 409.
- **Token rotation on every reminder send** invalidates original confirmation tokens — accepted side-effect.
- **Reminder retry on send failure = NONE by design** (RESEARCH Pitfall 4).
- **Postgres-backed rate limiting** — single `rate_limit_events` table; `checkRateLimit` fails OPEN on DB error. AUTH-11 reuses this table for `/api/auth/*` endpoints.
- **Migration drift workaround LOCKED** — `npx supabase db query --linked -f <migration.sql>` (CLI `db push` fails with orphan tracking-table timestamps).
- **`RESERVED_SLUGS` consolidated to `lib/reserved-slugs.ts`** (Plan 10-01, 2026-04-28) — `ReadonlySet<string>` with v1.0 entries + Phase 10 additions (signup, onboarding, login, forgot-password, settings). Both v1.0 consumers migrated. `isReservedSlug()` helper available. ONBOARD-05 consolidation portion COMPLETE.
- **`/auth/callback` 404 BLOCKER CLOSED** (Plan 10-02, 2026-04-28) — `app/auth/confirm/route.ts` is the canonical handler using `verifyOtp({ type, token_hash })` pattern (NOT `exchangeCodeForSession`). Handles signup, recovery, magiclink, email_change. Recovery type hard-overrides `next` param → always `/auth/reset-password`. Plans 10-05 and 10-08 route through this handler.
- **Forgot-password + reset-password flows live** (Plan 10-02, 2026-04-28) — `/app/forgot-password` with P-A1 generic success; `/auth/reset-password` with 8-char password min, getClaims() session guard, expired-link fallback. Both pages unstyled-but-functional; Phase 12 restyles.
- **Verify-email page live** (Plan 10-02, 2026-04-28) — `/app/verify-email` with resend button rate-limited 1/min + 5/hour per email+IP. `resendVerification` Server Action shared by auth-error page. Plan 10-05 redirects here after signup.
- **ARCH DECISION #1 COMMITTED in code** (Plan 10-03, 2026-04-28) — Postgres SECURITY DEFINER trigger `provision_account_on_signup` creates stub accounts row (`slug=null, name=null, onboarding_complete=false`) on every `auth.users` INSERT. Wizard (10-06) UPDATEs stub. Live in production. Andrew's NSI row has `onboarding_complete=true`.
- **ARCH DECISION #2 COMMITTED in code** (Plan 10-04, 2026-04-28) — Gmail SMTP quota plan: Cap signup-side emails at 200/day via `email_send_log` Postgres counter. 80% threshold logs `[GMAIL_SMTP_QUOTA_APPROACHING]` once/day. Fail-closed at cap (throws `QuotaExceededError`). Booking/reminder paths bypass guard. `checkAndConsumeQuota()` in `lib/email-sender/quota-guard.ts`. v1.2: migrate to Resend. Note for future callers: import from `@/lib/email-sender/quota-guard` (NOT from `@/lib/email-sender` — that path is the vitest mock alias).
- **accounts.slug + accounts.name are now nullable** (Plan 10-03, 2026-04-28) — both had NOT NULL dropped to support stub rows. CHECK constraints enforce `(col IS NOT NULL) OR (onboarding_complete = false)` — values required before wizard can mark complete.
- **accounts onboarding columns live** (Plan 10-03, 2026-04-28) — `onboarding_complete BOOLEAN NOT NULL DEFAULT false`, `onboarding_step INTEGER NOT NULL DEFAULT 1 CHECK (1..3)`, `onboarding_checklist_dismissed_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ`, `accounts_slug_active_idx` partial index (where deleted_at is null).
- **accounts RLS: INSERT + UPDATE policies added** (Plan 10-03, 2026-04-28) — `accounts_owner_insert` (INSERT, authenticated, auth.uid()=owner_user_id) and `accounts_owner_update` (UPDATE, same check) now live alongside v1.0 SELECT + UPDATE policies.
- **Supabase project + ref locked** — `mogfnutxrrbtvnaupoun`, region West US 2, Postgres 17.6.1.
- **Seeded NSI account** — `slug=nsi`, `id=ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_email=ajwegner3@gmail.com`, `owner_user_id=1a8c687f-73fd-4085-934f-592891f51784`. ⚠ Phase 10 P-A8: pre-flight UPDATE on `email_confirmed_at` if null BEFORE flipping email-confirm toggle.
- **v1.1 scope-cut 2026-04-27** — multi-user signup + capacity bug + branding overhaul; marathon QA RE-deferred to v1.2.
- **Multi-user signup ships free in v1.1 (no Stripe / billing).**
- **Branding tokens live on prod** (Plan 12-01, 2026-04-29) — `accounts.background_color` (nullable hex text, CHECK constraint) + `accounts.background_shade` (enum none/subtle/bold, NOT NULL DEFAULT 'subtle'). Migration 20260429120000_phase12_branding_columns.sql applied. NSI row: (null, 'subtle').
- **GradientBackdrop canonical primitive** (Plan 12-01, 2026-04-29) — `app/_components/gradient-backdrop.tsx` ('use client'). Cruip-pattern: 3 absolutely-positioned blur-circle divs. shade=none → flat color-mix tint. All runtime hex via inline style (Phase 7 JIT pitfall). Consumer must place inside `relative overflow-hidden`.
- **NSIGradientBackdrop for auth surfaces** (Plan 12-01, 2026-04-29) — `components/nsi-gradient-backdrop.tsx`. Fixed tokens: color=#0A2540, shade=subtle. Auth pages have no account context; use NSI brand always.
- **BrandedPage extended with gradient backdrop** (Plan 12-01, 2026-04-29) — New optional props `backgroundColor?`, `backgroundShade?` (both default-safe). Renders GradientBackdrop as first child. Exposes `--brand-bg-color` + `--brand-bg-shade` CSS vars. Root wrapper now has `relative overflow-hidden`. Existing 5 callers unbroken.
- **shadeToGradient pure helper** (Plan 12-01, 2026-04-29) — `lib/branding/gradient.ts`. No React, no DOM. shade=none: flatTint=color-mix(in oklch, ${color} 4%, white), circles=[]. subtle: opacity=0.25, blurPx=200. bold: opacity=0.5, blurPx=160. gray-50 (#F8FAFC) fallback when color=null. 8 unit tests.
- **saveBrandingAction treats empty string as null** (Plan 12-01, 2026-04-29) — defensive coercion before Zod validation so clearing background color in UI correctly persists DB null.
- **Wave 2/3 consumer pattern locked** (Plan 12-01, 2026-04-29) — Public surfaces: pass `branding.backgroundColor + branding.backgroundShade` to `<BrandedPage>`. Dashboard chrome: pass to `<GradientBackdrop>` directly. Auth pages: use `<NSIGradientBackdrop>` directly.
- **Public surfaces branding tokens live** (Plan 12-05, 2026-04-29) — `AccountSummary` extended with `background_color` + `background_shade`; `loadEventTypeForBookingPage` + `loadAccountListing` both SELECT and return these fields. All public BrandedPage callers pass `backgroundColor`/`backgroundShade`. UI-09/10/11/13 satisfied.
- **ListingHero inner gradient pattern** (Plan 12-05, 2026-04-29) — `/[account]` hero card has its own `GradientBackdrop` (inner spotlight) separate from page-level `BrandedPage` backdrop. Color fallback chain: `backgroundColor ?? brandPrimary ?? null`.
- **Embed single-circle gradient pattern** (Plan 12-05, 2026-04-29) — Embed iframes use inline single-circle (not 3-circle GradientBackdrop) at `-top-32` inside `relative overflow-hidden`. Pitfall 10 safe: EmbedHeightReporter measures `documentElement.scrollHeight` correctly.
- **Footer accents deferred** (Plan 12-05, 2026-04-29) — Page-level BrandedPage backdrop extends down naturally; explicit footer accent layer omitted. v1.2 enhancement candidate if Andrew wants it.
- **EmbedCodeDialog sm:max-w-2xl** (Plan 12-05, 2026-04-29) — Changed from `max-w-3xl` to `sm:max-w-2xl`. UI-09 satisfied.
- **Auth pages adopt Cruip split-panel with AuthHero** (Plan 12-02, 2026-04-29) — `AuthHero` server component at `app/(auth)/_components/auth-hero.tsx`: NSIGradientBackdrop in aside, "Powered by NSI" pill, headline/subtext overrides. 6 pages restyled (login, signup, forgot-password, verify-email, reset-password, auth-error) — all getClaims redirects, searchParams, Server Action bindings preserved verbatim. Import path: `@/app/(auth)/_components/auth-hero` (valid from both route group and app/auth/ paths). UI-12 satisfied for auth surface.
- **Dashboard chrome shipped — Inter + glass pill + flat sidebar IA** (Plan 12-03, 2026-04-29) — Geist swapped for Inter (next/font/google, `--font-sans`, `display: swap`, `tracking-tight` on `<html>`). `--background: oklch(0.985 0.002 247)` (gray-50) + `--sidebar-width-mobile: 100vw` added to `@theme`. `FloatingHeaderPill` at `app/(shell)/_components/floating-header-pill.tsx` — Cruip glass pill, `fixed top-2 z-30 w-full md:top-6`, hamburger via `SidebarTrigger`. `(shell)/layout.tsx` fetches account row inline + calls `getBrandingForAccount(account.id)` + renders `<GradientBackdrop>` + `<FloatingHeaderPill>`. `app-sidebar.tsx` rebuilt: single flat group, 6 items in exact order (Home/Event Types/Availability/Bookings/Branding/Settings), Settings is inline accordion via `useState` (defaults open on `/app/settings/*`). Sidebar footer (email + logout) preserved. `main` gets `pt-20 md:pt-28` to clear pill. 184 tests passing + 26 skipped.
- **Settings accordion is local useState only** (Plan 12-03, 2026-04-29) — No cookie persistence; collapses on navigation per CONTEXT.md lock. v1.2 follow-up: add `sidebar_settings_open` cookie if Andrew requests persistence.
- **`getBrandingForAccount` is the correct branding helper name** (Plan 12-03, 2026-04-29) — Plan docs incorrectly referenced `readBrandingForAccount`; actual export from `lib/branding/read-branding.ts` is `getBrandingForAccount`. Both `brandingFromRow` (row already in memory) and `getBrandingForAccount` (accountId only) are the canonical helpers. Future plans should use these names.
- **`/app/settings/profile` ships with 4 sections** (Plan 10-07, 2026-04-28) — Display Name (writes `accounts.name`, labeled "Display Name" in UI), Slug (UNIQUE constraint 23505 for collision), Password change (transient cookie-less Supabase client for current-password challenge), and Danger Zone soft-delete (type-slug-to-confirm). Email read-only with "Change email" link placeholder for 10-08.
- **Soft-delete pattern: `accounts.deleted_at = now()` + signOut + redirect `/account-deleted`** (Plan 10-07, 2026-04-28) — `softDeleteAccountAction` server-side slug confirmation guard. `auth.users` row kept intact per ACCT-02. Post-delete re-login lands on `/app/unlinked` (UX hole, v1.1 acceptable, Phase 13 QA note).
- **ACCT-03 deleted_at filter live on all public surfaces** (Plan 10-07, 2026-04-28) — `.is('deleted_at', null)` added to `loadAccountListing` + `loadEventTypeForBookingPage`. Embed surface inherits filter via shared loader import (no direct edit). 6-test coverage in `tests/account-soft-delete.test.ts`. 141 tests passing.
- **Email-change trigger + route shipped** (Plan 10-08, 2026-04-28) — `sync_account_email_on_auth_update` SECURITY DEFINER trigger on `auth.users AFTER UPDATE OF email` propagates to `accounts.owner_email`. `/app/settings/profile/email` route with `requestEmailChangeAction` Server Action: rate-limited 3/hr per `${ip}:${uid}` (authenticated flow, uid available), quota-guarded (`email-change` category), P-A1 generic response (never leaks "email already in use"). `emailRedirectTo` points to `${origin}/auth/confirm?next=/app/settings/profile`. E2E deferred to milestone-end QA per `MILESTONE_V1_1_DEFERRED_CHECKS.md`. 148 tests passing.
- **slot_index column + bookings_capacity_slot_idx live on prod** (Plan 11-03, 2026-04-28) — `bookings.slot_index smallint NOT NULL DEFAULT 1` added; `CREATE UNIQUE INDEX CONCURRENTLY bookings_capacity_slot_idx ON bookings(event_type_id, start_at, slot_index) WHERE status='confirmed'` built and validated (indisvalid=true, indisready=true). `bookings_no_double_book` v1.0 single-capacity index dropped via defensive DO $$ transaction. Smoke 23505 confirmed. CLI CONCURRENTLY apply workaround: pipe standalone statement via `echo | npx supabase db query --linked` (CLI -f path wraps in implicit transaction, blocking CONCURRENTLY). Plans 04 + 06 can now exercise N-per-slot mechanism.
- **CAP-07 SLOT_TAKEN/SLOT_CAPACITY_REACHED distinguishing live** (Plan 11-04, 2026-04-29) — POST /api/bookings now reads `max_bookings_per_slot` from event_types SELECT. INSERT retry loop: slot_index=1..N on Postgres 23505; fail fast on non-23505. After exhaustion: 409 `code=SLOT_TAKEN` (capacity=1) or `code=SLOT_CAPACITY_REACHED` (capacity>1). Booker UI can switch on `code` field uniformly. Backward-compatible: v1.0 capacity=1 path returns SLOT_TAKEN with original copy. 148 tests passing + 24 skipped.
- **CAP-01 root-cause: verdict (c) rescheduled-status slot reuse gap** (Plan 11-01, 2026-04-28) — 6-step diagnostic against prod confirmed zero duplicate confirmed bookings. `bookings_no_double_book` unique index is present and correct. The structural gap (rescheduled status does not trigger the unique index guard, so a bypassed availability check could double-book a rescheduled slot) is accepted behavior — rescheduled bookings hold their original slot for audit purposes. Plan 03 (slot_index migration) gate = PROCEED. Plan 05 must change `.neq("status","cancelled")` → `.eq("status","confirmed")` per Pitfall 4.
- **CAP-03 + CAP-08 + CAP-09 owner UI live** (Plan 11-07, 2026-04-29) — `eventTypeSchema` extended: `max_bookings_per_slot` (z.coerce, int, 1-50, default 1), `show_remaining_capacity` (z.coerce bool, default false), `confirmCapacityDecrease` optional bypass flag (default false). `EventTypeRow` type includes both capacity columns. `updateEventTypeAction` CAP-09 pre-check: fires on capacity decrease without confirm flag; fetches confirmed future bookings from `bookings`; groups by `start_at` in JS (supabase-js lacks GROUP BY/HAVING; data volume is small); returns `{ warning: "capacity_decrease_overflow", details: { newCap, currentCap, affectedSlots, maxAffected } }` when any slot exceeds new cap; fail-closed on DB error. Both create + update actions now persist capacity fields. Form: number input (min=1, max=50, valueAsNumber) + Controller+Switch toggle + AlertDialog confirmation modal. `confirmCapacityDecrease=true` re-submission bypasses CAP-09 and saves. Manual smoke deferred to Phase 13.
- **CAP-08 + CAP-07 booker UI live** (Plan 11-08, 2026-04-29) — `Slot.remaining_capacity?: number` added to Slot interface in `slot-picker.tsx`; conditional "X spots left" badge (text-xs text-muted-foreground, pluralized). `booking-form.tsx` 409 handler reads body.code: `SLOT_CAPACITY_REACHED` → "fully booked" message; `SLOT_TAKEN` → "just taken" message; defensive fallback to body.error. `RaceLoserBanner` accepts optional `message?` prop (v1.0 copy is fallback). Phase 12 will restyle; no branded colors added here. 148 tests passing.
- **CAP-06 pg-driver race test live** (Plan 11-06, 2026-04-29) — `tests/helpers/pg-direct.ts` exports `pgDirectClient(maxConnections)` + `hasDirectUrl()` for direct Postgres connection (port 5432, bypassing Supavisor). `postgres@3.4.9` installed as devDependency (NOT dependency). `tests/race-guard.test.ts` new `describe.skipIf(!hasDirectUrl())` block: capacity=3/N=10 + capacity=1/N=5 tests. Fixture path: Fallback B (inline admin-client INSERT with explicit `max_bookings_per_slot`). Skip-guard: CI-safe when `SUPABASE_DIRECT_URL` absent; runs against prod when set. SUPABASE_DIRECT_URL documented in `.env.example`; setup deferred to Andrew. 148 tests + 26 skipped.
- **Pitfall 4 CLOSED + CAP-04 + CAP-08 backend live** (Plan 11-05, 2026-04-29) — `/api/slots` bookings query changed from `.neq("status","cancelled")` to `.eq("status","confirmed")`; rescheduled bookings no longer over-block freed slots. `slotConfirmedCount()` helper added to `lib/slots.ts`; `computeSlots()` inner loop skips slots where `confirmedCount >= maxBookingsPerSlot`. `remaining_capacity` field optionally included per slot when `show_remaining_capacity=true`. Semantically aligned with `bookings_capacity_slot_idx` (WHERE status='confirmed'). v1.0 behavior fully preserved (capacity=1 + show_remaining_capacity=false defaults). `cancel-reschedule-api.test.ts` required zero semantic updates. 148 tests passing.
- **Capacity columns live on prod event_types** (Plan 11-02, 2026-04-28) — `max_bookings_per_slot integer NOT NULL DEFAULT 1 CHECK (>= 1)` + `show_remaining_capacity boolean NOT NULL DEFAULT false` added via locked workaround. All 4 existing rows defaulted to v1.0-safe values. No upper-bound CHECK on max_bookings_per_slot (Zod Plan-07 layer enforces <=50; DB keeps flexibility). Plans 04, 05, 07 can now read/write these columns without further schema work. 9 bookings-api tests still green.
- **RLS matrix extended to N=3 tenants** (Plan 10-09, 2026-04-28) — `tests/rls-cross-tenant-matrix.test.ts` now has a second `describe.skipIf(skipIfNoThreeUsers)` suite with 24 new cases (positive control, anon lockout, cross-tenant SELECT in 8 table×direction combos, UPDATE deny in 2 directions, admin sees-all-3). `tests/helpers/auth.ts` exports `signInAsNsiTest3Owner()` + `TEST_RLS_3_ACCOUNT_SLUG`. Third test user provisioning deferred to milestone-end QA (see MILESTONE_V1_1_DEFERRED_CHECKS.md). 148 passing + 24 skipped.
- **OnboardingChecklist component shipped** (Plan 10-09, 2026-04-28) — `components/onboarding-checklist.tsx` (`'use client'`): 7-day post-onboarding dismissible card with 3 items (Set availability, Customize event type, Share link + copy button). Visibility gate: `onboarding_complete=true` + `dismissed_at=null` + `created_at+7d>now()`. `app/(shell)/app/onboarding-checklist-actions.ts` exports `dismissChecklistAction` (RLS-scoped UPDATE). `/app` dashboard loads checklist above WelcomeCard with lazy count loading (2 parallel queries only when window open). Browser QA deferred to milestone-end QA.
- **3-step /onboarding wizard shipped** (Plan 10-06, 2026-04-28) — `/onboarding/step-1-account` (name+slug), `/onboarding/step-2-timezone` (auto-detect), `/onboarding/step-3-event-type` (required, pre-filled "Consultation"/30min). Step 3 atomically: INSERT 5 Mon-Fri 9-5 availability_rules + INSERT event_types + UPDATE accounts onboarding_complete=true. Welcome email fire-and-forget after. /app now redirects to /onboarding when onboarding_complete=false.
- **slug_is_taken() SECURITY DEFINER RPC** (Plan 10-06, 2026-04-28) — Bypasses RLS (wizard user can only SELECT own row). Used by /api/check-slug route handler (auth-gated, reserved short-circuit, fail-open on DB error). 300ms debounced in step-1 account-form.tsx.
- **sendWelcomeEmail uses accounts.name column** (Plan 10-06, 2026-04-28) — Interface `{ owner_email, name, slug }` matches 10-03 schema deviation. UI label is "Display Name" / "Business name"; DB column is `name`. 148 tests passing.
- **renderEmailBrandedHeader solid-color-only pattern** (Plan 12-06, 2026-04-29) — New canonical header for all 6 transactional senders. CONTEXT lock: no VML, no CSS gradients. bgcolor= table attribute (Outlook-safe). Color resolution: `branding.backgroundColor ?? branding.brand_primary ?? DEFAULT_BRAND_PRIMARY (#0A2540)`. Auto-contrast text via pickTextColor (WCAG). Logo img when logo_url set; account-name span fallback when null.
- **EmailBranding.backgroundColor field** (Plan 12-06, 2026-04-29) — All 6 AccountRecord interfaces now have `background_color?: string | null`. Callers pass `backgroundColor: account.background_color ?? null` in branding object. Aligns with Plan 12-01 Branding type.
- **Plain-text alts on all booker-facing senders** (Plan 12-06, 2026-04-29) — `text: stripHtml(html)` in sendEmail() options for confirmation, cancel-booker, reschedule-booker. Reminder had it since Phase 8. Owner-facing senders skip plain-text alt per CONTEXT discretion. EMAIL-10 extended beyond minimum.
- **stripHtml shared from branding-blocks.ts** (Plan 12-06, 2026-04-29) — Moved from private function in send-reminder-booker.ts to shared export in branding-blocks.ts. All 6 booker-facing senders import from there.
- **chrome_tint_intensity enum column live on prod** (Plan 12.5-01, 2026-04-29) — `accounts.chrome_tint_intensity` enum ('none'|'subtle'|'full') NOT NULL DEFAULT 'subtle'. All existing accounts defaulted to 'subtle'. BRAND-08 satisfied. Migration: 20260429180000_phase12_5_chrome_tint_intensity.sql.
- **ChromeTintIntensity type + chromeTintToCss helper locked** (Plan 12.5-01, 2026-04-29) — `ChromeTintIntensity = "none" | "subtle" | "full"` exported from `lib/branding/types.ts`. `Branding.chromeTintIntensity` field added; `brandingFromRow` + `getBrandingForAccount` read it with 'subtle' fallback. `chromeTintToCss(color, intensity, surface)` in `lib/branding/chrome-tint.ts`: returns `color-mix(in oklch, ${color} N%, white)` with LOCKED table — sidebar full=14% subtle=6%, page full=8% subtle=3%. Returns null for intensity='none' or color=null (consumer uses CSS class default). Cards always white. Wave 2 consumers must import from this helper, never fork the table.
- **chromeTintTextColor conservative WCAG proxy** (Plan 12.5-01, 2026-04-29) — `chromeTintTextColor(color, intensity, surface)` calls `pickTextColor(originalColor)` (not the tinted color). Conservative: a dark navy brand color returns white text even though the tinted surface may be light. Documented trade-off; acceptable for v1.1. Wave 2 can refine if needed.
- **FloatingHeaderPill deleted; plain SidebarTrigger hamburger pattern** (Plan 12.5-02, 2026-04-29) — `app/(shell)/_components/floating-header-pill.tsx` deleted (single importer confirmed). Replaced by `<div className="fixed top-3 left-3 z-20 md:hidden"><SidebarTrigger /></div>` in shell layout. `main` padding reduced from `pt-20 md:pt-28` → `pt-6 md:pt-8`. accounts SELECT trimmed (removed name + logo_url).
- **Sidebar chrome tinting via --sidebar-foreground CSS var override** (Plan 12.5-02, 2026-04-29) — `AppSidebar` now accepts `backgroundColor: string | null` + `chromeTintIntensity: ChromeTintIntensity`. `sidebarBgTint` applied to `<Sidebar>` root via `style={{ backgroundColor: ... }}`. WCAG text flip: `--sidebar-foreground` CSS variable overridden on the Sidebar root via `style` cast; propagates to all nav buttons via shadcn CSS var chain. No per-item inline styles needed.
- **Page bg tinting on SidebarInset** (Plan 12.5-02, 2026-04-29) — `pageBgTint = chromeTintToCss(branding.backgroundColor, branding.chromeTintIntensity, "page")` computed in shell layout; applied via `style={{ backgroundColor: pageBgTint ?? undefined }}` on `<SidebarInset>`. When null, `bg-background` (gray-50) applies — Phase 12 regression-safe baseline preserved.
- **IntensityPicker component + chrome-aware MiniPreviewCard pattern** (Plan 12.5-03, 2026-04-29) — `IntensityPicker` at `app/(shell)/app/branding/_components/intensity-picker.tsx`: 3-button (None/Subtle/Full) toggle matching ShadePicker styling. `MiniPreviewCard` REPLACED: no longer gradient-only; now faux-dashboard layout with faux-sidebar strip (tinted via `chromeTintToCss("sidebar")`), faux-page-bg (tinted via `chromeTintToCss("page")`), `GradientBackdrop` composited inside page area, white faux-card (card-stays-white invariant). All runtime colors via inline `style` only (Phase 7 pitfall).
- **saveBrandingAction signature extended to require chromeTintIntensity** (Plan 12.5-03, 2026-04-29) — `saveBrandingAction({ backgroundColor, backgroundShade, chromeTintIntensity })` now writes all 3 fields in a single UPDATE. `chromeTintIntensitySchema = z.enum(["none","subtle","full"]).default("subtle")` validates. `BrandingState.chromeTintIntensity: ChromeTintIntensity` loaded from DB with VALID_INTENSITIES guard + 'subtle' fallback. MiniPreviewCard moved to "Chrome intensity" section so it renders below IntensityPicker (semantically correct).
- **pickTextColor / contrast.ts no changes needed** (Plan 12.5-01, 2026-04-29) — Already extracted to `lib/branding/contrast.ts` in Plan 12-01. BRAND-09 DRY requirement satisfied. chrome-tint.ts imports pickTextColor directly. No relocation required.
- **EMAIL-13: intensity-aware email header band** (Plan 12.5-04, 2026-04-29) — `EmailBranding.chromeTintIntensity?: "none"|"subtle"|"full"` added (optional, defaults to 'subtle'). `renderEmailBrandedHeader`: intensity='none' uses brand_primary (matches UI "no tint" chrome); 'subtle'|'full' use backgroundColor. Email clients can't render color-mix(); both use direct hex. All 6 senders wire `chrome_tint_intensity` from account row. Route callers (api/bookings, cron/send-reminders, shell actions, lib/bookings/cancel, lib/bookings/reschedule) SELECT this column. EMAIL-13 forward-lock: zero email_* branding override fields anywhere.
- **cancel.ts + reschedule.ts were missing background_color** (Plan 12.5-04, 2026-04-29 deviation) — The cancel and reschedule email callers (lib/bookings/cancel.ts, lib/bookings/reschedule.ts) never had background_color in their accounts JOIN SELECT or account objects, meaning cancel/reschedule emails always used brand_primary (not background_color) for the header band. Fixed in this plan alongside chrome_tint_intensity wiring. Both columns now SELECT'ed and passed through.
- **NSI mark PNG + NSI_MARK_URL live** (Plan 12-06, 2026-04-29) — `public/nsi-mark.png` committed (32x32 solid-navy placeholder; Andrew to swap with brand asset before Phase 13 QA). `NSI_MARK_URL` = `${NEXT_PUBLIC_APP_URL}/nsi-mark.png`; null in test env (NEXT_PUBLIC_APP_URL unset) so no broken-image test assertions.
- **Live cross-client email QA deferred** (Plan 12-06, 2026-04-29) — Outlook desktop, Apple Mail iOS, Yahoo Mail rendering deferred to Phase 13 QA / v1.2 per CONTEXT.md lock and existing EMAIL-08 / QA-01..06 backlog.
- **DayDetailSheet drawer + HomeDashboard shipped** (Plan 12-04b, 2026-04-29) — `HomeDashboard` owns open/selectedDate/selectedBookings state; `DayDetailSheet` renders shadcn Sheet (side=right, w-full sm:max-w-md) with `DayDetailRow` list or empty-state branch. All 4 row actions (View/Cancel/Copy-reschedule-link/Send-reminder) with AlertDialog confirmations. Clipboard fallback: if `navigator.clipboard.writeText` throws, shows `<input readOnly>` with the URL. Phase 12 ROADMAP must_have #2 fully satisfied. 17 new tests; 225 passing + 26 skipped.
- **HomeDashboard pattern: state container separate from display components** (Plan 12-04b, 2026-04-29) — `HomeCalendar` is pure display; `DayDetailSheet` is pure presentation; `HomeDashboard` owns coordination state. This pattern should be used for future calendar-adjacent interactivity.
- **SheetDescription as empty-state text source** (Plan 12-04b, 2026-04-29) — When bookings=[], `SheetDescription` renders "No bookings on this day." and the body is an empty spacer `<div>`. Avoids duplicate text nodes that break RTL `getByText` queries.
- **loadMonthBookings canonical query** (Plan 12-04a, 2026-04-29) — server-only, inline auth pattern (getClaims + accounts SELECT), status='confirmed' filter, startOfMonth..endOfMonth range. Returns `MonthBooking[]` with `event_type: { name }` shape. UTC date bucketing for day grouping (v1.2: upgrade to account IANA TZ via TZDate).
- **regenerateRescheduleTokenAction token rotation** (Plan 12-04a, 2026-04-29) — Mints single fresh reschedule token via `crypto.randomUUID() + hashToken()` (NOT `generateBookingTokens()` — that overshoots by minting both tokens). Returns rawToken to caller. Old emailed link invalidated. 12-04b AlertDialog warns owner before invocation.
- **sendReminderForBookingAction rotates BOTH tokens** (Plan 12-04a, 2026-04-29) — Matches Phase 8 cron pattern exactly. Owner-initiated reminder invalidates booker's existing cancel + reschedule email links. Accepted side effect per project pattern. Ships alongside `cancelBookingAsOwner` in `app/(shell)/app/bookings/[id]/_lib/actions.ts`.
- **HomeCalendar capped-dot DayButton** (Plan 12-04a, 2026-04-29) — Custom DayButton via `Calendar.components.DayButton` override. 1-3 dots + "+N" overflow. Dot color: `var(--brand-primary, hsl(var(--primary)))` inline style (Phase 7 pitfall locked). `onDayClick(date, dayBookings)` prop exposed for 12-04b drawer.
- **WelcomeCard removed from /app** (Plan 12-04a, 2026-04-29) — Replaced by HomeCalendar + month header. v1.2 candidate if Andrew wants a welcome message. Flagged for revisit.
- **vi.hoisted() pattern confirmed** (Plan 12-04a, 2026-04-29) — vitest hoists vi.mock() factories to top of file; variables declared after mock calls trigger TDZ errors. Use vi.hoisted() to declare mock spies before vi.mock() factory functions. Applied in both regenerate-reschedule-token and send-reminder-for-booking tests.
- **accounts.sidebar_color column live on prod** (Plan 12.6-01, 2026-04-30) — `sidebar_color text nullable` with hex CHECK constraint (`'^#[0-9a-f]{6}$'`). ADDITIVE only; chrome_tint_intensity, background_shade, background_color unchanged. Null = shadcn --sidebar default. BRAND-10 satisfied.
- **Branding.sidebarColor field live** (Plan 12.6-01, 2026-04-30) — `sidebarColor: string | null` added to Branding interface. `brandingFromRow` + `getBrandingForAccount` both read and map `sidebar_color`. chromeTintIntensity kept for backward compat — Wave 2 consumers use resolveChromeColors instead.
- **resolveChromeColors(branding) canonical helper** (Plan 12.6-01, 2026-04-30) — `resolveChromeColors(branding: Branding): ResolvedChromeColors` exported from `lib/branding/chrome-tint.ts`. Returns `{ pageColor, sidebarColor, primaryColor, sidebarTextColor, primaryTextColor }` — each surface is a direct hex string or null (null = CSS default, consumer uses inline style with `?? undefined` so CSS class default applies). Priority chains: pageColor=backgroundColor, sidebarColor=sidebarColor, primaryColor=primaryColor (always set via DEFAULT_BRAND_PRIMARY fallback). WCAG: sidebarTextColor=pickTextColor(sidebarColor) when set; primaryTextColor=pickTextColor(primaryColor) always set.
- **chromeTintToCss preserved as live compat export** (Plan 12.6-01, 2026-04-30) — `chromeTintToCss` and `chromeTintTextColor` kept as full original functions in `lib/branding/chrome-tint.ts`. Shell layout + app-sidebar still call these in their 12.5 implementations; 12.6-02 will replace those call sites with `resolveChromeColors`.
- **EMAIL-14: sidebarColor → brand_primary → DEFAULT email header band chain** (Plan 12.6-03, 2026-04-30) — `renderEmailBrandedHeader` now uses `branding.sidebarColor ?? branding.brand_primary ?? DEFAULT_BRAND_PRIMARY`. Mirrors the dashboard sidebar visual: sidebar_color is the primary source. Email clients cannot render color-mix(); both sidebarColor and brand_primary are direct hex — correct for all clients. `chromeTintIntensity` and `backgroundColor` fields kept in `EmailBranding` interface for backward compat (optional, unused by resolver). All 6 senders wire `sidebarColor: account.sidebar_color ?? null`. All 4 route/cron callers SELECT `sidebar_color` from accounts.
- **Phase 12.6 COMPLETE** (2026-04-30) — All 3 plans done: 12.6-01 (foundation + prod column), 12.6-02 (dashboard chrome + editor), 12.6-03 (email tokens). Phase 13 Manual QA is the next milestone gate.
- **--primary CSS var override pattern** (Plan 12.6-02, 2026-04-30) — Shell layout wraps entire shell in `<div style={{ "--primary": chrome.primaryColor, "--primary-foreground": chrome.primaryTextColor ?? undefined } as React.CSSProperties}>`. Raw hex is a valid CSS <color> value; shadcn var(--primary) consumers inherit automatically. No oklch conversion needed. Override is unconditional (DEFAULT_BRAND_PRIMARY fallback ensures always-a-string).
- **AppSidebar direct hex pattern** (Plan 12.6-02, 2026-04-30) — Props changed from `backgroundColor + chromeTintIntensity` to `sidebarColor + sidebarTextColor`. Applied as `backgroundColor: sidebarColor ?? undefined` (null = CSS default). `--sidebar-foreground` CSS var override pattern preserved from 12.5-02 — only source changed (direct hex vs color-mix).
- **saveBrandingAction signature updated** (Plan 12.6-02, 2026-04-30) — `chromeTintIntensity` param replaced with `sidebarColor: string | null`. DB UPDATE now writes `sidebar_color` instead of `chrome_tint_intensity`. `chromeTintIntensitySchema` kept as exported constant in schema.ts for backward compat; removed from `brandingBackgroundSchema`.
- **IntensityPicker fully deleted** (Plan 12.6-02, 2026-04-30) — `intensity-picker.tsx` deleted; import removed from branding-editor.tsx; `chromeTintIntensity` removed from BrandingState and editor state. Zero remaining references in branding scope.
- **MiniPreviewCard rebuilt as 3-color preview** (Plan 12.6-02, 2026-04-30) — Props: `sidebarColor`, `pageColor`, `primaryColor`, `shade`. Faux-sidebar uses sidebarColor (null = hsl(var(--sidebar))). Faux-page area uses pageColor (null = undefined). Faux-button + faux-switch use primaryColor (null = hsl(var(--primary))). GradientBackdrop receives `pageColor` (not old `color`) for continuity.

### Pending Todos

None tracked in `.planning/todos/pending/` for v1.1 yet. v1.0 carry-overs are tracked in `FUTURE_DIRECTIONS.md` at repo root.

### Open Carried Concerns (v1.1 backlog — see `FUTURE_DIRECTIONS.md`)

These concerns are NOT blockers for v1.1 ship; some fold into v1.1 phases as noted, others remain in v1.2 backlog.

- **EMBED-07 + QA-01..QA-06 + EMAIL-08 (8 deferred requirements)** — RE-deferred to v1.2 per Andrew 2026-04-27. NOT in Phase 13 scope.
- **Phase 8 dashboard 9-item human walkthrough** — partially absorbed by Phase 12 visual sweep + Phase 13 multi-tenant walkthrough; remainder stays in v1.2 backlog.
- **Cron-fired-in-production functional proof** — v1.2 backlog (Phase 13 does not include).
- **Apple Mail live device verification** — v1.2 backlog (Phase 13 does not include).
- **Per-template branding 6-row smoke** — RESOLVED in Plan 12-06 (2026-04-29). EMAIL-12 closed at code level; live inbox verification deferred to Phase 13 QA.
- **Plain-text alternative on confirmation email** — RESOLVED in Plan 12-06 (2026-04-29). EMAIL-10 extended to booker cancel + reschedule as well.
- **NSI mark image in email footer** — RESOLVED in Plan 12-06 (2026-04-29). Placeholder PNG committed at public/nsi-mark.png; Andrew to swap brand asset before Phase 13.
- **`RESERVED_SLUGS` deduplication** — RESOLVED in Plan 10-01 (2026-04-28). `lib/reserved-slugs.ts` is the single source of truth.
- **`/auth/callback` 404** — RESOLVED in Plan 10-02 (2026-04-28). `/auth/confirm` Route Handler live with verifyOtp pattern. v1.0 BLOCKER closed.
- **`react-hooks/incompatible-library` warning** on `event-type-form.tsx:99` — v1.2 tech debt.
- **Pre-existing `tsc --noEmit` test-mock alias errors** — v1.2 tech debt.
- **Supabase service-role key still legacy JWT** — v1.2 (waiting on Supabase rollout).
- **`generateMetadata` double-load on public booking page** — v1.2 tech debt.
- **Reminder retry/resend UI** on `/app/bookings/[id]` — v1.2 backlog.
- **`qa-test` dedicated event type** — v1.2 backlog.
- **Plan 08-05/06/07 wave-2 git-index race** — v1.2 ops note (serialize commits or per-agent worktrees in future YOLO multi-wave runs).

### Active Blockers / Decisions Required Before Planning

- **Phase 10 — decisions status:**
  1. ~~Account auto-provisioning pattern~~ — RESOLVED (Plan 10-03): Postgres trigger committed in production.
  2. ~~Gmail SMTP quota plan (P-A12 highest under-mitigated v1.1 risk)~~ — RESOLVED (Plan 10-04): 200/day cap + 80% warning + fail-closed committed in production.
  3. P-A8 pre-flight UPDATE on Andrew's `email_confirmed_at` BEFORE flipping email-confirm toggle — handled in Plan 10-02 (parallel wave).
- **Phase 11 — Wave 1 COMPLETE (2026-04-28):** CAP-01 verdict (c) rescheduled-status slot reuse gap; 0 duplicate confirmed rows on prod; Plan 03 PROCEED (CONCURRENTLY index build clean); no prod data modified. Structural gap (rescheduled holds slot for audit) is accepted behavior documented in FINDINGS.md. Plan 05 `.neq("status","cancelled")` → `.eq("status","confirmed")` fix confirmed still in scope (Pitfall 4 capacity-accuracy fix).
- **Phase 12 — two decisions during plan-phase**: email gradient strategy (solid-only vs VML fallback); minimum-viable Playwright suite scope (~1 day cheap insurance vs accept Andrew-eyes-only QA in Phase 13).

---

## Session Continuity

**Last session:** 2026-04-30 — Phases 12, 12.5, 12.6 all CODE-COMPLETE + Andrew live-approved 12.6 deploy on Vercel. ROADMAP / STATE / REQUIREMENTS / MILESTONE_V1_1_DEFERRED_CHECKS updated in one batch close-out. 255 passing + 26 skipped. 21 manual items deferred to Phase 13.

**Stopped at:** 3-phase code-complete close-out. Phase 13 (Manual QA + Andrew Ship Sign-Off) is up next. Andrew's NSI mark image swap is the only hard prerequisite identified in deferred checks.

**Resume:** Run `/gsd:plan-phase 13` (recommend `/clear` first for fresh context). Phase 13 plans the end-to-end QA walkthrough: signup → onboarding → first booking E2E (QA-09); 2nd-test-owner multi-tenant UI isolation (QA-10); capacity=3 race E2E (QA-11); 3-account branded smoke incl. all 3 per-account color controls (QA-12); embed dialog 320/768/1024 (QA-13); "ship v1.1" sign-off (QA-14); FUTURE_DIRECTIONS.md update (QA-15).

**v1.2 backlog items captured during v1.1**:
- Hourly cron (currently `0 13 * * *` on Hobby tier; flip to `0 * * * *` after Vercel Pro upgrade)
- Cleanup `rate_limit_events` test DB accumulation (4 transient bookings-api.test.ts failures)
- Replace `/public/nsi-mark.png` placeholder with final NSI brand mark
- DROP deprecated `accounts.chrome_tint_intensity` column (Phase 12.5 leftover; safe to remove after one v1.1 release window)
- `chromeTintToCss` compat export removal (Phase 12.5 leftover; only Phase 12.5 tests still import it)
- Live cross-client email QA (Outlook desktop, Apple Mail iOS, Yahoo) — deferred since v1.0

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-04-27)
- `.planning/MILESTONES.md` — v1.0 entry (created 2026-04-27)
- `.planning/REQUIREMENTS.md` — v1.1 (53 mapped, 0 unmapped)
- `.planning/ROADMAP.md` — v1.0 collapsed + v1.1 Phases 10-13 (this update)
- `.planning/milestones/v1.0-ROADMAP.md` — full v1.0 phase archive
- `.planning/milestones/v1.0-REQUIREMENTS.md` — full v1.0 requirements archive
- `.planning/research/SUMMARY.md` — v1.1 research synthesis (2026-04-27)
- `.planning/research/STACK.md` / `FEATURES.md` / `ARCHITECTURE.md` / `PITFALLS.md` — v1.1 detail
- `.planning/phases/01-foundation/` through `09-manual-qa-and-verification/` — v1.0 execution history
- `.planning/config.json` — depth=standard, mode=yolo, parallelization=true
- `FUTURE_DIRECTIONS.md` (repo root) — canonical v1.1 carry-over backlog
