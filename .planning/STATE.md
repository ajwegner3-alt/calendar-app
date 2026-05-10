# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-10 — **Plan 41-01 complete.** stripe@22.1.1 installed; lib/stripe/client.ts singleton created.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-09 with v1.8 Current Milestone section)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.8 — Stripe Paywall + Login UX Polish. Phase 41 in progress (Plan 01 complete).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.8 Stripe Paywall + Login UX Polish
**Phase:** 41 of 46 — in progress
**Plan:** 01 of N — complete
**Status:** Plan 41-01 complete — stripe@22.1.1 installed, lib/stripe/client.ts created
**Last activity:** 2026-05-10 — Executed Plan 41-01: stripe SDK install + client singleton.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9,   52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans,  91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24,  6 plans,  34 commits, shipped 2026-05-02)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27,  8 plans,  50 commits, shipped 2026-05-03)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30,  6 plans,  31 commits, shipped 2026-05-05)
v1.6 [X] Day-of-Disruption Tools      (Phases 31-33, 10 plans,  53 commits, shipped 2026-05-06)
v1.7 [X] Auth + Email + Polish + Debt (Phases 34-40, 32 plans, 129 commits, shipped 2026-05-09)
v1.8 [ ] Stripe Paywall + Login UX    (Phases 41-46, plans TBD — roadmap created 2026-05-10)
```

**Total shipped:** 7 milestones archived (v1.0–v1.7), 40 phases completed, 170 plans, ~692 commits

## v1.8 Phase Map

| Phase | Name | Requirements | Key Gate |
|-------|------|--------------|----------|
| 41 | Stripe SDK + Schema + Webhook Skeleton | BILL-01..08 | PREREQ-A + PREREQ-D (test keys); PREREQ-F after deploy |
| 42 | Checkout Flow + Plan Selection | BILL-09..11 | PREREQ-B (Price IDs) + PREREQ-E (pricing) |
| 43 | Paywall Enforcement + Locked-State UX + Trial Banners | BILL-12..20 | Phase 42 must ship first; LD-07 verification mandatory |
| 44 | Customer Portal + Billing Polish + Stripe Emails | BILL-21..24 | PREREQ-C (Portal config); can develop parallel to 43 |
| 45 | Login UX Polish + Gmail Quota Raise | AUTH-33..39 + EMAIL-35 | Fully independent of 41-44 |
| 46 | Andrew Ship Sign-Off | (sign-off) | All of 41-45 complete |

## Accumulated Context

### Locked Decisions (must not be reopened in phase plans)

- **LD-01** stripe@22.1.1; `apiVersion: '2026-04-22.dahlia'`; pin forever
- **LD-02** No `@stripe/stripe-js`; hosted Checkout only; zero client-side Stripe code
- **LD-03** Customer Portal handles cancel/update-payment/invoices/plan-switch; no custom equivalents
- **LD-04** Paywall gate allows `trialing` and `active` only; locked = all other statuses
- **LD-05** Webhook idempotency via `stripe_webhook_events (stripe_event_id PRIMARY KEY)` + `ON CONFLICT DO NOTHING`
- **LD-06** Webhook MUST `await req.text()` before `constructEvent()` — never `req.json()` first
- **LD-07** Paywall middleware extends `lib/supabase/proxy.ts` inside existing `pathname.startsWith('/app')` branch; `/[account]/*` structurally exempt
- **LD-08** `past_due` = banner only, NOT lockout; only `unpaid`/`canceled`/trial-expired → redirect
- **LD-09** Existing v1.7 accounts: `trial_ends_at = NOW() + INTERVAL '14 days'` at deploy (NOT `created_at + 14 days`)
- **LD-10** Checkout return lag-window uses polling; webhook is canonical source of truth; no optimistic update
- **LD-11** Stripe-triggered emails route through `getSenderForAccount(accountId)`; Stripe receipts complement for dollar-amount emails
- **LD-12** AUTH-29 four-way enumeration-safety invariant preserved; magic-link helper identical wording for all users

### Carried patterns from v1.7

- `getSenderForAccount` factory fail-closed contract — Stripe webhook email dispatch uses same pattern
- `isRefusedSend(error)` dual-prefix helper — reuse for billing email error handling
- 5xx-only formError gate for enumeration-safe actions — preserved in magic-link helper (Phase 45)
- Knip CI gate is active — RESOLVED for lib/stripe: tsconfigPaths() + tsconfig @/* -> ./* covers @/lib/stripe/* generically (no explicit alias needed)

### Open tech debt (carried unchanged)

- PREREQ-03 (Resend live activation) — framework shipped; live activation gated on DNS
- Lockfile regeneration under Node 20 — knip CI gate dormant
- Vercel env-var cleanup — delete inert `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME`
- `slot-picker.tsx` on disk — Plan 30-01 Rule 4
- Pre-existing test fixture failures — `tests/bookings-api.test.ts` + `tests/slots-api.test.ts` date-sensitive
- Pre-existing working-tree drift — three pre-existing modified files (Phase 02/23/33 docs)

### Blockers

- Phase 41 deploy blocked on: PREREQ-A (Stripe account) + PREREQ-D (env vars in Vercel)
- Phase 42 blocked on: PREREQ-B (Price IDs) + PREREQ-E (pricing decision)
- Phase 44 blocked on: PREREQ-C (Customer Portal config in Stripe dashboard)
- Phase 41 live webhook test blocked on: PREREQ-F (webhook endpoint registration after Phase 41 deploy)

## Session Continuity

**Last session:** 2026-05-10 — Executed Plan 41-01 (stripe SDK + client singleton). 2 tasks, 3 files, 4 min.

**Stopped at:** Plan 41-01 complete. Next: Plan 41-02 (database schema migration).

**Resume file:** None — next action is execute Plan 41-02.

## Files of record

- `.planning/PROJECT.md` — vision, requirements, key decisions, evolution log
- `.planning/ROADMAP.md` — milestone summary + Phase progress table (v1.8 phases 41-46 now appended)
- `.planning/REQUIREMENTS.md` — v1.8 requirements with traceability
- `.planning/STATE.md` — this file
- `.planning/research/` — v1.8 research outputs (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- `.planning/milestones/v1.7-ROADMAP.md` — v1.7 archive
