# Roadmap: Calendar App (NSI Booking Tool)

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- ✅ **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (34 plans, including decimal Phases 12.5 + 12.6) — shipped 2026-04-30. Full archive: [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md).
- ✅ **v1.2 NSI Brand Lock-Down + UI Overhaul** — Phases 14-21 (22 plans across 8 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md).
- ✅ **v1.3 Bug Fixes + Polish** — Phases 22-24 (6 plans across 3 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md).
- ✅ **v1.4 Slot Correctness + Polish** — Phases 25-27 (8 plans across 3 phases) — shipped 2026-05-03. Full archive: [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md).
- ✅ **v1.5 Buffer Fix + Audience Rebrand + Booker Redesign** — Phases 28-30 (6 plans across 3 phases) — shipped 2026-05-05. Full archive: [`milestones/v1.5-ROADMAP.md`](./milestones/v1.5-ROADMAP.md).
- ✅ **v1.6 Day-of-Disruption Tools** — Phases 31-33 (10 plans, 3 phases) — shipped 2026-05-06. Full archive: [`milestones/v1.6-ROADMAP.md`](./milestones/v1.6-ROADMAP.md).
- ✅ **v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code** — Phases 34-40 (32 plans across 7 phases) — shipped 2026-05-09. Full archive: [`milestones/v1.7-ROADMAP.md`](./milestones/v1.7-ROADMAP.md).
- ✅ **v1.8 Stripe Paywall + Login UX Polish** — Phases 41-46 + 42.5 + 42.6 (32 plans across 8 phases) — shipped 2026-05-16 (billing parked behind BILLING_ENABLED kill-switch). Full archive: [`milestones/v1.8-ROADMAP.md`](./milestones/v1.8-ROADMAP.md).

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

<details>
<summary>✅ v1.2 NSI Brand Lock-Down + UI Overhaul (Phases 14-21) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md) for full phase details.

- [x] Phase 14: Typography + CSS Token Foundations (1 plan) — completed 2026-04-30
- [x] Phase 15: BackgroundGlow + Header Pill + Owner Shell Re-Skin (2 plans) — completed 2026-04-30
- [x] Phase 16: Auth + Onboarding Re-Skin (4 plans) — completed 2026-04-30
- [x] Phase 17: Public Surfaces + Embed (9 plans) — completed 2026-04-30
- [x] Phase 18: Branding Editor Simplification (3 plans) — completed 2026-05-01
- [x] Phase 19: Email Layer Simplification (1 plan) — completed 2026-05-01
- [x] Phase 20: Dead Code + Test Cleanup (1 plan) — completed 2026-05-01
- [x] Phase 21: Schema DROP Migration (1 plan) — completed 2026-05-02

</details>

<details>
<summary>✅ v1.3 Bug Fixes + Polish (Phases 22-24) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md) for full phase details.

- [x] Phase 22: Auth Fixes (2 plans) — completed 2026-05-02
- [x] Phase 23: Public Booking Fixes (2 plans) — completed 2026-05-02
- [x] Phase 24: Owner UI Polish (2 plans) — completed 2026-05-02 (Andrew live deploy approved)

</details>

<details>
<summary>✅ v1.4 Slot Correctness + Polish (Phases 25-27) — SHIPPED 2026-05-03</summary>

See [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md) for full phase details.

- [x] Phase 25: Surgical Polish (2 plans) — completed 2026-05-03 (AUTH-21, AUTH-22, OWNER-14, OWNER-15)
- [x] Phase 26: Bookings Page Crash Debug + Fix (3 plans) — completed 2026-05-03 (BOOK-01, BOOK-02; root cause RSC boundary violation)
- [x] Phase 27: Slot Correctness DB-Layer Enforcement (3 plans) — completed 2026-05-03 (SLOT-01..05; EXCLUDE constraint live; Andrew smoke approved)

</details>

<details>
<summary>✅ v1.5 Buffer Fix + Audience Rebrand + Booker Redesign (Phases 28-30) — SHIPPED 2026-05-05</summary>

See [`milestones/v1.5-ROADMAP.md`](./milestones/v1.5-ROADMAP.md) for full phase details.

- [x] Phase 28: Per-Event-Type Buffer + Account Column Drop (3 plans) — completed 2026-05-04 (BUFFER-01..06 shipped; CP-03 DROP completed with drain waiver)
- [x] Phase 29: Audience Rebrand (1 plan) — completed 2026-05-04 (BRAND-01..03 shipped; canonical grep gate clean)
- [x] Phase 30: Public Booker 3-Column Desktop Layout (2 plans) — completed 2026-05-05 (BOOKER-01..05 shipped; Andrew live-verified at 1024/1280/1440 + mobile)

</details>

<details>
<summary>✅ v1.6 Day-of-Disruption Tools (Phases 31-33) — SHIPPED 2026-05-06</summary>

See [`milestones/v1.6-ROADMAP.md`](./milestones/v1.6-ROADMAP.md) for full phase details.

- [x] Phase 31: Email Hard Cap Guard (3 plans) — completed 2026-05-05 (Andrew live verification approved)
- [x] Phase 32: Inverse Date Overrides (3 plans) — completed 2026-05-05 (Andrew live verification approved 8/8 scenarios)
- [x] Phase 33: Day-Level Pushback Cascade (4 plans) — completed 2026-05-06 (Andrew live-verified all 8 scenarios; PUSH-10 gap closed by orchestrator commit `2aa9177`; verifier re-passed)

</details>

<details>
<summary>✅ v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code (Phases 34-40) — SHIPPED 2026-05-09</summary>

See [`milestones/v1.7-ROADMAP.md`](./milestones/v1.7-ROADMAP.md) for full phase details.

- [x] Phase 34: Google OAuth Signup + Credential Capture (4 plans) — completed 2026-05-06
- [x] Phase 35: Per-Account Gmail OAuth Send (7 plans) — completed 2026-05-08 (with linkIdentity→direct-OAuth + SMTP→REST API pivots; see 35-DEVIATION-DIRECT-OAUTH.md)
- [x] Phase 36: Resend Backend for Upgraded Accounts (3 plans) — framework completed 2026-05-08 (live activation gated on PREREQ-03)
- [x] Phase 37: Upgrade Flow + In-App Cap-Hit UI (3 plans) — framework completed 2026-05-08 (live Resend delivery gated on PREREQ-03)
- [x] Phase 38: Magic-Link Login (3 plans) — completed 2026-05-08 (Andrew live-verified A/B/C/D)
- [x] Phase 39: BOOKER Polish (3 plans) — completed 2026-05-08 (Andrew live-verified animation + skeleton + reduced-motion + V15-MP-05 lock)
- [x] Phase 40: Dead-Code Audit (9 plans) — completed 2026-05-09 (knip 6.12.1; 1 file + 3 deps + 22 exports removed; CI gate landed; final QA all PASS)

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v1.0 | 52 / 52 | ✅ Shipped | 2026-04-27 |
| 10-13 | v1.1 | 34 / 34 | ✅ Shipped | 2026-04-30 |
| 14-21 | v1.2 | 22 / 22 | ✅ Shipped | 2026-05-02 |
| 22-24 | v1.3 | 6 / 6 | ✅ Shipped | 2026-05-02 |
| 25-27 | v1.4 | 8 / 8 | ✅ Shipped | 2026-05-03 |
| 28-30 | v1.5 | 6 / 6 | ✅ Shipped | 2026-05-05 |
| 31-33 | v1.6 | 10 / 10 | ✅ Shipped | 2026-05-06 |
| 34 | v1.7 | 4 / 4 | ✅ Code complete — connect path superseded by Phase 35 direct-OAuth (commit `ab02a23`); signup path still uses original `/auth/google-callback` | 2026-05-06 |
| 35 | v1.7 | 7 / 7 | ✅ Shipped — verifier 5/5 PASS; SMTP singleton + `GMAIL_APP_PASSWORD` removed (commits `31db425`, `138cfb0`, `6aecfbb`). See `35-DEVIATION-DIRECT-OAUTH.md` for architecture pivots. | 2026-05-08 |
| 36 | v1.7 | 3 / 3 | ✅ Framework shipped — verifier 13/13 PASS; live activation requires PREREQ-03 (Resend domain DNS) per FUTURE_DIRECTIONS.md | 2026-05-08 |
| 37 | v1.7 | 3 / 3 | ✅ Framework shipped — verifier 4/4 PASS; live Resend delivery requires PREREQ-03 (same gate as Phase 36) | 2026-05-08 |
| 38 | v1.7 | 3 / 3 | ✅ Shipped — verifier 19/19 PASS; Andrew live-verified A/B/C/D against production (`booking.nsintegrations.com`); two non-blocking deviations captured (Site URL fix, Supabase inner-cooldown observation) | 2026-05-08 |
| 39 | v1.7 | 3 / 3 | ✅ Shipped — verifier 4/4 PASS; Andrew live-verified all three checkpoints (key-prop removal, skeleton, animation+reduced-motion) on production | 2026-05-08 |
| 40 | v1.7 | 9 / 9 | ✅ Shipped — knip 6.12.1; 27 REMOVE / 53 KEEP; 4 atomic chore commits (deps `14fb48c`, dups n/a, exports `1cbb273`, files `2a1b665`); CI gate `d94ca07`; final QA all PASS `c42529d` | 2026-05-09 |
| 41 | v1.8 | 4 / 4 | ✅ Shipped — verifier passed; SC-1..4 verified live; SC-5 deferred to Phase 42.5 first-checkout natural exercise; Andrew sign-off received | 2026-05-10 |
| 42 | v1.8 | 3 / 4 | ⚠ Plumbing code-complete (42-01/02/03 shipped, 15 commits); UI superseded by 42.5; 42-04 UAT replaced by 42.5 UAT | 2026-05-10 (partial) |
| 42.5 | v1.8 | 6 / 6 | ✅ Shipped — verifier 6/6 SC + 3/3 gates PASS; Andrew UAT sign-off; closes BILL-09 (full) + BILL-10b + BILL-25; Phase 41 SC-5 carry-over closed | 2026-05-10 |
| 42.6 | v1.8 | 3 / 3 | ✅ Shipped — verifier 5/5 SC + 3/3 gates PASS (static); Andrew live walkthrough sign-off; closes BILL-26 + BILL-27 | 2026-05-11 |
| 43 | v1.8 | 2 / 2 | ✅ Shipped — verifier 9/9 SC + 4/4 gates PASS (static); Andrew live-verified all 7 scenarios; 2 post-merge fixes (banner positioning, sidebar nav) + 1 production migration applied during UAT (`plan_tier` column — fixed booker outage) | 2026-05-11 |
| 44 | v1.8 | 5 / 5 | ✅ Code-complete — verifier 4/4 SC + 2/2 gates static PASS; BILL-21/22/23 Complete; BILL-24 Partial (2/4 — `account-locked` + `welcome-to-paid` deferred per CONTEXT.md); live UAT (Portal end-to-end + email delivery) deferred to Phase 46 (requires PREREQ-C) | 2026-05-11 |
| 45 | v1.8 | 3 / 3 | ✅ Shipped — verifier 6/6 SC + 3/3 gates PASS (static); 39/39 tests across 4 suites green; closes AUTH-33..39 + EMAIL-35; live UAT (visual confirmation of OAuth-below-Card on both routes + 3-fail nudge end-to-end) deferred to Phase 46 | 2026-05-12 |
| 46 | v1.8 | 3 / 5 | ⚠ Test-mode UAT partial 2026-05-12 — 46-01 (`2116c79`) + 46-02 (`7ae9517`/`bb16dc8`) + 46-03 test-mode portion (`375f147`); 22 PASS + 5 DEFERRED to live-mode UAT + 1 N/A. 46-04 + 46-05 PAUSED until live UAT completes. Mid-UAT corrections pushed: `ac8e263` (33-commit stale-prod push of Phase 44/45/46), `d8267ac` (Gmail quota 400→450 per PROJECT.md spec) | 2026-05-12 (partial) |

## Cumulative Stats

- **Total milestones shipped:** 8 (v1.0 → v1.8)
- **Total phases shipped:** 48 (Phases 1-9 + 10/11/12/12.5/12.6/13 + 14-21 + 22-24 + 25-27 + 28-30 + 31-33 + 34-40 + 41-46/42.5/42.6)
- **Total plans shipped:** 202 (52 + 34 + 22 + 6 + 8 + 6 + 10 + 32 + 32)
- **v1.8 shipped 2026-05-16:** Phases 41-46 + 42.5 + 42.6 (32 plans across 8 phases). Stripe paywall built + deployed then parked behind the `BILLING_ENABLED` kill-switch (2026-05-15 scope change — app offered free); login UX polish + Gmail quota raise (450/day) remain live. Full archive: [`milestones/v1.8-ROADMAP.md`](./milestones/v1.8-ROADMAP.md).

---

*Roadmap last updated: 2026-05-16 — Phase 46 SHIPPED. v1.8 milestone ✅ closed. v1.8 (Stripe Paywall + Login UX Polish) ships with 32 plans across 8 phases (41-46 + 42.5 + 42.6). Billing parked 2026-05-15 — the full Stripe paywall was built, shipped, and deployed but is gated behind the `BILLING_ENABLED=false` kill-switch in `lib/stripe/billing-flag.ts` (app offered free; code preserved, feature dormant). Phase 46 closed the milestone via test-mode UAT (18 live PASS + 4 PASS-by-static-evidence); the 5 Stripe live-mode UAT scenarios were rescoped N/A after the billing-park decision. Separately on 2026-05-16, the Phase 36/37 email-outage migration fix landed: the Phase 36/37 migrations — skipped by Plan 46-01's migration repair — were applied to production via Supabase MCP `apply_migration`, resolving a ~1-week booking-confirmation email outage (`getSenderForAccount` had been selecting `accounts.email_provider`/`resend_status` columns that did not exist in production); `schema_migrations` reconciled so every repo migration file is now registered. v1.8 archival documents written (FUTURE_DIRECTIONS.md v1.8 delta appended, `milestones/v1.8-ROADMAP.md` full archive created, this ROADMAP collapsed). v1.8.0 git tag annotated and pushed by plan 46-05.*

*Prior: 2026-05-12 — Phase 46 TEST-MODE UAT PARTIAL. Plans 46-01 + 46-02 + 46-03 (test-mode portion) shipped this session. 22 of 28 scenarios PASS (18 live confirmed + 4 PASS-by-static-evidence) + 5 DEFERRED to live-mode UAT + 1 N/A (V15-MP-05 Turnstile invariant — login form never had Turnstile; scenario authoring error in Plan 46-02). Andrew elected mid-UAT to defer Stripe-dependent scenarios (3.2 Portal cancel-at-period-end, 3.3 reactivation, 3.4 plan-switching, 6.1 trial_will_end email, 6.2 payment_failed email, 7.4 Gmail quota end-to-end) to live mode rather than continue with test-mode test-clock setup. Three major regressions surfaced and resolved DURING UAT: (1) **PREREQ-B/D regression** — 9 Vercel env vars missing (4 Stripe Price IDs + 4 cents + branding URL); Andrew added all 9; (2) **PREREQ-G regression** — webhook endpoint subscribed to only 3 of 7 Phase 41 events; Andrew added the missing 4 (checkout.session.completed, customer.subscription.updated, customer.subscription.trial_will_end, invoice.payment_failed); (3) **Stale production** — origin/main was 33 commits behind HEAD (Phases 44/45/46 had never been pushed); push `8bef313..ac8e263` brought StatusCard + Portal route + login UX polish + Gmail quota fix to production for the first time. One mid-UAT code correction: **Gmail per-account daily cap 400 → 450 per PROJECT.md spec** (commit `d8267ac`; Phase 45-01 had shipped 400 by mistake; 2 test suites + quota-guard.ts updated; 28/28 tests green at corrected cap). LD-21 added: 450 cap locked. LD-22 added: live-mode webhook endpoint must subscribe to all 7 v1.8 events (separate from test-mode registry). nsi restored to clean trialing+widget state post-UAT (`stripe_customer_id=cus_UVR7kpncyAoDBp` + `stripe_subscription_id=sub_1TWQoHJ7PLcBbY73y738n3Ht` preserved for live-mode continuation). Next: Andrew completes live-mode prereq stack (live Product/4 Prices/secret/webhook secret/Portal config/100%-off promo), runs Plan 46-03 live-mode tail for 6 deferred scenarios, then 46-04 (archival) + 46-05 (v1.8.0 tag) close out v1.8. Memory handoff at `.planning/memory/v1.8-live-mode-uat-handoff.md`.*

*Prior: 2026-05-12 — Phase 45 SHIPPED. Verifier 6/6 SC + 3/3 gates PASS (static); 39/39 tests across 4 suites green (quota-guard 7/7, email-quota-refuse 21/21, login-form-auth-29 4/4, login-form-counter 7/7). Closes AUTH-33..AUTH-39 + EMAIL-35 (8 requirements). Plan commits: `048255f` + `2043a0b` + `268d9aa` (45-01 quota raise); `fbae4b3` + `d104ab4` (45-02 signup OAuth reorder); `78d60f6` + `054866b` + `74a9978` (45-03 login UX polish). One orchestrator correction during wave: `4e37b28` (sibling-plan collateral — `tests/email-quota-refuse.test.ts` had hardcoded fixtures derived from old 200 cap; migrated proportionally to 400). All 5 locked AUTH invariants enforced (AUTH-29 byte-identical helper, AUTH-35 password-default tab, AUTH-37 zero-storage, errorKind credentials-only gating, counter cap at 3). Live visual UAT (OAuth-below-Card on both routes + 3-fail nudge + Gmail quota at 400) deferred to Phase 46. Next: Phase 46 (Andrew Ship Sign-Off — final v1.8 milestone gate covering live Stripe + email + login UX UAT).*

*Prior: 2026-05-11 — Phase 44 code-complete. Verifier 4/4 SC + 2/2 gates static PASS; status `human_needed` (3 live-Stripe UAT items deferred to Phase 46 as ROADMAP designed). BILL-21/22/23 Complete; BILL-24 Partial (2/4 — trial-ending + payment-failed shipped; account-locked + welcome-to-paid deferred per 44-00-PLANNER-NOTES.md). Plan commits across Wave 1 (`894119b`, `d2f54aa`, `6ad405e`, `cf4c723`, `c91b8de`, `9049389`, `8bbf027`) + Wave 2 (`ddcc316`, `1163a84`, `442767a`, `70e0f1a`, `4b793b1`, `421bcbd`, `8681ef9`, `673d1e1`). Production migration applied via MCP (`phase44_cancel_at_period_end`). Next: Phase 45 (Login UX Polish + Gmail Quota Raise — fully independent) unblocked. Phase 46 owns live Stripe + email UAT.*

*Prior: 2026-05-11 — Phase 43 SHIPPED. Verifier 9/9 SC + 4/4 gates PASS (static); Andrew live-verified all 7 scenarios on production. Closes BILL-12..BILL-20. Two post-merge fixes during UAT: `fb909f9` (banner positioning — moved inside `<main>` to clear fixed Header) + `b9fa84e` (Billing entry added to sidebar nav, top-level CreditCard icon — Phase 42.5 had shipped `/app/billing` without a nav entry). One production database fix applied during UAT: `phase42_5_plan_tier` migration (Phase 42.5-01 column was never registered in `schema_migrations` and never reached production — public booker `/[account]/[event-slug]` was returning 404 to all customers because shared loader selects `plan_tier`. Outage resolved by MCP `apply_migration`). Plan commits: `d559305`, `1fbbaab` (43-01); `fd59b7d`, `3ca0868`, `e1f35c2` (43-02). Next: Phase 44 (Customer Portal + Billing Polish + Stripe Emails) unblocked, plus Phase 45 (Login UX Polish) which is fully independent and can develop in parallel.*

*Prior: 2026-05-11 — Phase 42.6 SHIPPED. Verifier 5/5 SC + 3/3 gates PASS (static); Andrew live walkthrough sign-off. Closes BILL-26 (`/embed/*` route gated by `plan_tier`) + BILL-27 (owner embed-code dialog gated by `plan_tier`). 12 atomic commits across Wave 1 (`61b65ba`, `a4fbe27`) + Wave 2 (`57a8bce`, `596bd56`, `82502d4`, `eac0e41`, `6e826c8`, `0a1b647`, `3b8df3f`, `734d31a`). Next: Phase 43 (Paywall Enforcement + Locked-State UX + Trial Banners) unblocked.*

*Prior: 2026-05-10 — Phase 42.5 SHIPPED. Verifier 6/6 SC + 3/3 gates PASS; Andrew UAT sign-off received. Closes BILL-09 (full), BILL-10b (new — `accounts.plan_tier` column + webhook write), BILL-25 (new — Branding consult CTA via `NSI_BRANDING_BOOKING_URL`). Phase 41 SC-5 carry-over OFFICIALLY CLOSED — Tests 5a (Basic-Monthly) + 5b (Widget-Annual) each independently proved a real Stripe trigger lands all 4 billing columns. Commits: `e890334` (42.5-01 schema), `6238b3e`+`185b2d0`+`637bbf2` (42.5-02 prices), `39054a8`+`9c8e42b` (42.5-03 checkout), `1d9aac3`+`0a1ae5d` (42.5-04 webhook), `74e1d91`+`a7db58c`+`53646eb` (42.5-05 TierGrid UI), `5e493b1`+`8178344` (42.5-06 UAT). Next: Phase 42.6 (Widget Feature Gating — BILL-26 + BILL-27) unblocked. Phase 43 (Paywall Enforcement) also unblocked and can develop in parallel.*
