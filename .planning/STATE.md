# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-28 — Plan 11-02 complete. Capacity columns migration applied to prod: max_bookings_per_slot (integer NOT NULL DEFAULT 1, CHECK >= 1) + show_remaining_capacity (boolean NOT NULL DEFAULT false) added to event_types. All 4 existing rows defaulted safely. 9 booking-API tests still green.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-27 after v1.0 milestone)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.1 Phase 11 — Booking Capacity + Double-Booking Fix (Wave 1 complete; Wave 2 gate-opened 2026-04-28).

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Milestone:** v1.1 IN PROGRESS (started 2026-04-27).
**Phase:** Phase 11 — Booking Capacity + Double-Booking Fix.
**Last completed plan:** 11-02 (capacity-columns-migration) — 2026-04-28.
**Status:** Phase 11 IN PROGRESS. Wave 1 complete; Wave 2 executing (Plans 11-02 done; 11-03 through 11-05 pending). Phase 10 code-complete with 6 manual checks deferred to milestone-end QA.
**Last activity:** 2026-04-28 — Plan 11-02 complete. Capacity columns applied to prod via locked workaround. All 3 verify queries passed (2 columns, CHECK constraint, 4 rows defaulted). 9 bookings-api tests green.

**Progress (across both v1.0 and v1.1):** [██████████░░] 10 / 13 phases code-complete (v1.0 SHIPPED 2026-04-27; Phase 10 code-complete 2026-04-28 — milestone-end QA pending)

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
Phase 11 [~] Booking Capacity + Double-Booking Fix   (Wave 1 complete 2026-04-28; Wave 2 in progress)
  11-01 [✓] cap-01-root-cause-investigation           (Complete 2026-04-28 — verdict (c), gate PROCEED)
  11-02 [✓] capacity-columns-migration                (Complete 2026-04-28 — max_bookings_per_slot + show_remaining_capacity live on prod)
Phase 12 [ ] Branded UI Overhaul (5 Surfaces)        (Not started)
Phase 13 [ ] Manual QA + Andrew Ship Sign-Off        (Not started)
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 13 / 13 (v1.0 + v1.1) |
| Phases complete | 9 / 13 (v1.0 SHIPPED) |
| Plans complete (v1.0) | 52 / 52 |
| Plans planned (v1.1) | TBD (estimates: P10 ~7-9, P11 ~3-4, P12 ~5-7, P13 ~2-3) |
| v1.0 requirements complete | 66 / 73 (90.4%) — 7 deferred to v1.2 backlog |
| v1.1 requirements mapped | 53 / 53 (100%) |
| v1.1 requirements complete | 0 / 53 (Phase 10 ready to plan) |
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
- **Branding tokens grow** — `accounts.background_color` + `accounts.background_shade` (none/subtle/bold) added in Phase 12.
- **`/app/settings/profile` ships with 4 sections** (Plan 10-07, 2026-04-28) — Display Name (writes `accounts.name`, labeled "Display Name" in UI), Slug (UNIQUE constraint 23505 for collision), Password change (transient cookie-less Supabase client for current-password challenge), and Danger Zone soft-delete (type-slug-to-confirm). Email read-only with "Change email" link placeholder for 10-08.
- **Soft-delete pattern: `accounts.deleted_at = now()` + signOut + redirect `/account-deleted`** (Plan 10-07, 2026-04-28) — `softDeleteAccountAction` server-side slug confirmation guard. `auth.users` row kept intact per ACCT-02. Post-delete re-login lands on `/app/unlinked` (UX hole, v1.1 acceptable, Phase 13 QA note).
- **ACCT-03 deleted_at filter live on all public surfaces** (Plan 10-07, 2026-04-28) — `.is('deleted_at', null)` added to `loadAccountListing` + `loadEventTypeForBookingPage`. Embed surface inherits filter via shared loader import (no direct edit). 6-test coverage in `tests/account-soft-delete.test.ts`. 141 tests passing.
- **Email-change trigger + route shipped** (Plan 10-08, 2026-04-28) — `sync_account_email_on_auth_update` SECURITY DEFINER trigger on `auth.users AFTER UPDATE OF email` propagates to `accounts.owner_email`. `/app/settings/profile/email` route with `requestEmailChangeAction` Server Action: rate-limited 3/hr per `${ip}:${uid}` (authenticated flow, uid available), quota-guarded (`email-change` category), P-A1 generic response (never leaks "email already in use"). `emailRedirectTo` points to `${origin}/auth/confirm?next=/app/settings/profile`. E2E deferred to milestone-end QA per `MILESTONE_V1_1_DEFERRED_CHECKS.md`. 148 tests passing.
- **CAP-01 root-cause: verdict (c) rescheduled-status slot reuse gap** (Plan 11-01, 2026-04-28) — 6-step diagnostic against prod confirmed zero duplicate confirmed bookings. `bookings_no_double_book` unique index is present and correct. The structural gap (rescheduled status does not trigger the unique index guard, so a bypassed availability check could double-book a rescheduled slot) is accepted behavior — rescheduled bookings hold their original slot for audit purposes. Plan 03 (slot_index migration) gate = PROCEED. Plan 05 must change `.neq("status","cancelled")` → `.eq("status","confirmed")` per Pitfall 4.
- **Capacity columns live on prod event_types** (Plan 11-02, 2026-04-28) — `max_bookings_per_slot integer NOT NULL DEFAULT 1 CHECK (>= 1)` + `show_remaining_capacity boolean NOT NULL DEFAULT false` added via locked workaround. All 4 existing rows defaulted to v1.0-safe values. No upper-bound CHECK on max_bookings_per_slot (Zod Plan-07 layer enforces <=50; DB keeps flexibility). Plans 04, 05, 07 can now read/write these columns without further schema work. 9 bookings-api tests still green.
- **RLS matrix extended to N=3 tenants** (Plan 10-09, 2026-04-28) — `tests/rls-cross-tenant-matrix.test.ts` now has a second `describe.skipIf(skipIfNoThreeUsers)` suite with 24 new cases (positive control, anon lockout, cross-tenant SELECT in 8 table×direction combos, UPDATE deny in 2 directions, admin sees-all-3). `tests/helpers/auth.ts` exports `signInAsNsiTest3Owner()` + `TEST_RLS_3_ACCOUNT_SLUG`. Third test user provisioning deferred to milestone-end QA (see MILESTONE_V1_1_DEFERRED_CHECKS.md). 148 passing + 24 skipped.
- **OnboardingChecklist component shipped** (Plan 10-09, 2026-04-28) — `components/onboarding-checklist.tsx` (`'use client'`): 7-day post-onboarding dismissible card with 3 items (Set availability, Customize event type, Share link + copy button). Visibility gate: `onboarding_complete=true` + `dismissed_at=null` + `created_at+7d>now()`. `app/(shell)/app/onboarding-checklist-actions.ts` exports `dismissChecklistAction` (RLS-scoped UPDATE). `/app` dashboard loads checklist above WelcomeCard with lazy count loading (2 parallel queries only when window open). Browser QA deferred to milestone-end QA.
- **3-step /onboarding wizard shipped** (Plan 10-06, 2026-04-28) — `/onboarding/step-1-account` (name+slug), `/onboarding/step-2-timezone` (auto-detect), `/onboarding/step-3-event-type` (required, pre-filled "Consultation"/30min). Step 3 atomically: INSERT 5 Mon-Fri 9-5 availability_rules + INSERT event_types + UPDATE accounts onboarding_complete=true. Welcome email fire-and-forget after. /app now redirects to /onboarding when onboarding_complete=false.
- **slug_is_taken() SECURITY DEFINER RPC** (Plan 10-06, 2026-04-28) — Bypasses RLS (wizard user can only SELECT own row). Used by /api/check-slug route handler (auth-gated, reserved short-circuit, fail-open on DB error). 300ms debounced in step-1 account-form.tsx.
- **sendWelcomeEmail uses accounts.name column** (Plan 10-06, 2026-04-28) — Interface `{ owner_email, name, slug }` matches 10-03 schema deviation. UI label is "Display Name" / "Business name"; DB column is `name`. 148 tests passing.

### Pending Todos

None tracked in `.planning/todos/pending/` for v1.1 yet. v1.0 carry-overs are tracked in `FUTURE_DIRECTIONS.md` at repo root.

### Open Carried Concerns (v1.1 backlog — see `FUTURE_DIRECTIONS.md`)

These concerns are NOT blockers for v1.1 ship; some fold into v1.1 phases as noted, others remain in v1.2 backlog.

- **EMBED-07 + QA-01..QA-06 + EMAIL-08 (8 deferred requirements)** — RE-deferred to v1.2 per Andrew 2026-04-27. NOT in Phase 13 scope.
- **Phase 8 dashboard 9-item human walkthrough** — partially absorbed by Phase 12 visual sweep + Phase 13 multi-tenant walkthrough; remainder stays in v1.2 backlog.
- **Cron-fired-in-production functional proof** — v1.2 backlog (Phase 13 does not include).
- **Apple Mail live device verification** — v1.2 backlog (Phase 13 does not include).
- **Per-template branding 6-row smoke** — folds into Phase 12 (EMAIL-12).
- **Plain-text alternative on confirmation email** — folds into Phase 12 (EMAIL-10).
- **NSI mark image in email footer** — folds into Phase 12 (EMAIL-11).
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

**Last session:** 2026-04-28 — Plan 11-02 complete. Capacity columns migration applied to prod. All verify queries passed. 9 bookings-api tests green.

**Stopped at:** Plan 11-02 complete. Wave 2 Plan 11-02 done.

**Resume:** Execute Plan 11-03 (slot_index migration — CONCURRENTLY index build) in Wave 2.

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
