# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-09 — **v1.8 IN FLIGHT.** Started same day as v1.7 close. Scope locked: Stripe paywall (14-day free trial → owner-app lockout, single plan monthly+annual) + login UX polish (Google button reorder, password-first tabs, 3-fail in-memory magic-link nudge) + magic-link inline helper line (AUTH-29 enumeration-safety invariant preserved) + Gmail per-account quota 200 → 450/day. Currently in research phase.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-09 with v1.8 Current Milestone section)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.8 — Stripe Paywall + Login UX Polish (research phase).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.8 Stripe Paywall + Login UX Polish
**Phase:** Not started (research → requirements → roadmap pending)
**Plan:** —
**Status:** Researching domain (4 parallel researchers spawning)
**Last activity:** 2026-05-09 — v1.8 questioning complete; scope locked across 5 themes; research phase started.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [X] Day-of-Disruption Tools      (Phases 31-33, 10 plans, 53 commits, shipped 2026-05-06 — ~2 days)
v1.7 [X] Auth + Email + Polish + Debt (Phases 34-40, 32 plans, 129 commits, shipped 2026-05-09 — 3 days)
v1.8 [ ] Stripe Paywall + Login UX    (Phases 41+, plans TBD — researching)
```

**Total shipped:** 7 milestones archived (v1.0–v1.7), 40 phases completed, 170 plans, ~692 commits

## v1.8 Locked Scope (5 themes)

1. **Login button reorder** — Google OAuth button moved BELOW password form on `/app/login` and `/app/signup`.
2. **Password-first tabs + 3-fail magic-link nudge** — Password tab is default; per-session in-memory counter; after 3 failed password attempts inline prompt offers magic-link. Counter resets on tab close.
3. **Per-account Gmail quota 200 → 450/day** — Single constant change in `lib/email-sender/quota-guard.ts`. 50-msg buffer below Google's 500/day free-Gmail limit.
4. **Magic-link inline helper line** — Adds "Make sure you're using the email you signed up with" (or similar) under email field on magic-link tab. Identical wording for all users — AUTH-29 four-way enumeration-safety ambiguity invariant preserved.
5. **Stripe paywall (dominant theme)** — 14-day free trial from signup → owner-app lockout. Single plan with monthly + annual billing toggle. Locks `/app/*` only (public booker `/[account]/*` keeps working regardless). Global "Head over to payments to get set up" banner during trial + after lockout. `/app/billing` is the only unlocked owner-app surface when locked.

## Carryover backlog NOT in v1.8 scope (intentional defer)

- PREREQ-03 Resend live activation (Andrew action; flip flag whenever Resend domain DNS verified)
- Lockfile regeneration under Node 20 (knip CI gate stays dormant)
- Vercel env-var cleanup of inert GMAIL_* keys (Andrew action; no redeploy needed)
- Resend abuse hard cap + bounce handling (defer until usage justifies)
- BRAND-22 NSI logo asset
- BOOKER-10 page-transition animations
- AUTH-31 Microsoft OAuth, AUTH-32 SAML/SSO
- CAL-SYNC-01/02 Google Calendar sync
- EMAIL-34 per-account custom Resend domain

## Accumulated Context

### Patterns established in v1.7 (still relevant for v1.8)

- **AUTH-29 four-way enumeration-safety ambiguity invariant** — 5xx-only formError gate preserves byte-identical UI across (unknown email, our 5/hr bucket, Supabase ~60s cooldown, genuine send). v1.8 magic-link inline helper MUST preserve this invariant; same wording for everyone.
- **5xx-only formError gate for enumeration-safe Supabase actions** — reusable pattern for any passwordless/OTP-style endpoint.
- **AES-256-GCM at rest pattern** (`lib/oauth/encrypt.ts`) — reusable for Stripe-related secrets if any need encrypted storage server-side (likely not — Stripe customer ID is the public reference).
- **`getSenderForAccount` factory routing fail-closed contract** — factory never throws; every error path returns `refusedSender`. Stripe webhook → email flows should reuse this pattern.
- **`isRefusedSend(error)` dual-prefix helper** — single source of truth across providers.
- **Knip CI gate as PR-level dead-code regression gate** — repo's first GitHub Actions workflow; future Stripe-related workflows should follow node-20-strict-install shape.
- **7th consecutive yolo-mode milestone close with no formal audit** — deploy-and-eyeball is canonically the operating model.

### Patterns established / locked through v1.6 (still relevant)

- Refuse-send fail-closed across all 7 senders (Phase 31, v1.6) — Stripe webhook-driven emails (e.g., trial-ending, payment-failed) must thread account_id through the same `getSenderForAccount` factory.
- Two-step deploy protocol CP-03 strangler-fig — applies for any Stripe schema changes that retire columns.
- Vitest `resolve.alias` array/regex exact-match (LD-14, v1.6) — new Stripe lib paths each get their own alias entry.
- `slot-picker.tsx` kept on disk per Plan 30-01 Rule 4 + DECISIONS.md ignore list.
- Deploy-and-eyeball as canonical production gate (now 7 consecutive milestones).

### Known v1.8 sensitive surfaces

- **AUTH-29 invariant** — magic-link inline helper must NOT differentiate wording per user. The whole point of v1.7 Phase 38 work.
- **Public booker neutrality (LD-07)** — Stripe paywall must NOT bleed into `/[account]/*` surfaces. Bookers don't see billing state, account branding stays clean.
- **V15-MP-05 Turnstile lifecycle lock** — preserve through any login form refactor.
- **Quota guard centralization (Phase 36 OQ-1)** — quota raise is one constant; do NOT scatter per-caller branches.

### Open tech debt (carried into v1.8 unchanged)

- PREREQ-03 (Resend live activation) — framework shipped; live activation gated on DNS.
- Lockfile regeneration under Node 20 — knip CI gate dormant.
- Vercel env-var cleanup — delete inert `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME`.
- `slot-picker.tsx` on disk — Plan 30-01 Rule 4.
- Pre-existing test fixture failures — `tests/bookings-api.test.ts` + `tests/slots-api.test.ts` date-sensitive fixtures.
- Pre-existing working-tree drift — three pre-existing modified files (Phase 02/23/33 docs) — not addressed during v1.7, carry forward.

## Session Continuity

**Last session:** 2026-05-09 — v1.7 milestone closed in morning; v1.8 questioning + scope-lock + research kickoff in afternoon. Locked 5-theme scope (Login reorder + password-first 3-fail nudge + Gmail quota 200→450 + magic-link inline helper preserving AUTH-29 + Stripe paywall full-scope with 14-day trial / single plan monthly+annual / owner-app-only lockout). Updated PROJECT.md Current State + Current Milestone sections; rewrote this STATE.md.

**Stopped at:** Research kickoff — about to spawn 4 parallel gsd-project-researcher agents (Stack, Features, Architecture, Pitfalls) under sonnet (balanced profile).

**Resume file:** None — research is in progress; if interrupted, re-spawn researchers via the `/gsd:new-milestone` flow.

## ▶ Next session — start here

If interrupted before research synthesizer runs: re-spawn 4 researchers focused on Stripe SaaS paywall integration with existing Supabase auth + accounts schema, login UX patterns, and pitfalls. Then synthesizer to SUMMARY.md, then requirements, then roadmap.

If interrupted after roadmap: `/gsd:plan-phase [N]` for first v1.8 phase.

## Files of record

- `.planning/PROJECT.md` — vision, requirements, key decisions, evolution log
- `.planning/ROADMAP.md` — milestone summary + Phase progress table
- `.planning/MILESTONES.md` — chronological history of shipped milestones
- `.planning/STATE.md` — this file
- `.planning/research/` — v1.8 research outputs (will be regenerated; v1.7's SUMMARY.md remains for reference)
- `.planning/milestones/v1.7-ROADMAP.md` — v1.7 archive (full phase details)
- `.planning/milestones/v1.7-REQUIREMENTS.md` — v1.7 requirements archive
