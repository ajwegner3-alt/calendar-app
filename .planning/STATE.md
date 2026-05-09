# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-09 — **v1.7 SHIPPED.** All 7 phases (34-40) and 32 plans complete; 30 of 30 requirements shipped; archived to `.planning/milestones/v1.7-ROADMAP.md` + `.planning/milestones/v1.7-REQUIREMENTS.md`. Git tag `v1.7` created. Project is between milestones; next step is `/gsd:new-milestone` to define v1.8 scope.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-09 after v1.7 milestone completion)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** Between milestones — v1.7 closed; next step `/gsd:new-milestone` for v1.8 definition.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** between milestones (v1.7 closed)
**Phase:** n/a — no active phase
**Plan:** not started
**Status:** Ready to plan v1.8
**Last activity:** 2026-05-09 — v1.7 milestone close commit + tag.

Project status: ████████ v1.7 closed (7/7 phases shipped). Awaiting v1.8 scope definition.

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
v1.8 [ ]                              (Phases 41+, plans TBD — milestone goals undefined)
```

**Total shipped:** 7 milestones archived (v1.0–v1.7), 40 phases completed, 170 plans, ~692 commits

## Accumulated Context

### Patterns established in v1.7 (summary)

Full Key Decisions table lives in PROJECT.md. Headline patterns from v1.7:

- **5xx-only formError gate for enumeration-safe Supabase actions** (Phase 38) — direct cause of the four-way enumeration-safety ambiguity invariant; reusable for any passwordless/OTP-style endpoint.
- **Direct-Google OAuth replaces Supabase `linkIdentity` for token capture** (Phase 35 deviation, commit `ab02a23`) — reusable for any future provider-token-capture flow.
- **Gmail REST API (not SMTP+OAuth2) for `gmail.send`-scoped sends** (Phase 35 deviation, commit `cb82b6f`) — when scope is endpoint-specific, never use a generic relay layer that silently swallows scope mismatches.
- **AES-256-GCM at rest for refresh tokens with lazy env-var read** (Phase 34) — pattern reused across Phase 35 `fetchGoogleAccessToken`, Phase 36 `createResendClient`, Phase 37 `requestUpgradeAction`.
- **`getSenderForAccount` factory routing fail-closed contract** (Phase 35) — factory never throws; every error path returns a `refusedSender`; activation is one SQL UPDATE per account.
- **`isRefusedSend(error)` dual-prefix helper** (Phase 36) — single source of truth for refused-send detection across providers.
- **`@public` JSDoc tag for knip suppression** (Phase 40) — knip 6.x officially-supported locality-preserving suppression; preferred over global `ignore` array entries because the tag lives at the suppression site.
- **Four-way enumeration-safety ambiguity invariant** (Phase 38) — unknown email + our rate-limit + Supabase's internal cooldown + genuine send all return byte-identical UI; preserved by the 5xx-only formError gate.
- **Knip CI gate as PR-level dead-code regression gate** (Phase 40, commit `d94ca07`) — repo's first GitHub Actions workflow; future workflows should follow node-20-strict-install shape.
- **7th consecutive yolo-mode milestone close with no formal audit** — Plan 40-08 final manual QA served as audit-equivalent; deploy-and-eyeball is canonically the operating model.

### Patterns established / locked through v1.6

See PROJECT.md Key Decisions for full table. Key ones still relevant:

- Refuse-send fail-closed across all 7 senders (Phase 31, v1.6)
- Vitest `resolve.alias` array/regex exact-match (LD-14, v1.6)
- Two-step deploy protocol CP-03 strangler-fig (used in v1.7 Phase 35 SMTP retirement)
- `slot-picker.tsx` kept on disk per Plan 30-01 Rule 4 + DECISIONS.md ignore list
- Deploy-and-eyeball as canonical production gate (now 7 consecutive milestones)

### Open tech debt (carried into v1.8)

- **PREREQ-03 (Resend live activation)** — Phase 36/37 framework shipped; Andrew creates Resend account, verifies NSI domain DNS via Namecheap, adds `RESEND_API_KEY` to Vercel; live activation is one SQL UPDATE per account.
- **Lockfile regeneration under Node 20** — knip CI gate dormant until `package-lock.json` regenerated from a Node 20 / npm 10 environment to satisfy `npm ci` strict-install.
- **Vercel env-var cleanup** — delete inert `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` (Preview + Production); no redeploy needed.
- **`slot-picker.tsx` on disk** — Plan 30-01 Rule 4; resolve when reschedule UI is itself redesigned.
- **Pre-existing test fixture failures** — `tests/bookings-api.test.ts` + `tests/slots-api.test.ts` fail on date-sensitive fixtures (test expects Monday 9-17 window seeded data; actual run-time may be a Friday). Watermark formally corrected to "2" during Plan 40-03.
- **Pre-existing working-tree drift** — `.planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md`, `.planning/phases/23-public-booking-fixes/23-VERIFICATION.md`, `.planning/phases/33-day-level-pushback-cascade/33-CONTEXT.md` — pre-existing, not addressed during v1.7.

## Session Continuity

**Last session:** 2026-05-09 — v1.7 milestone close. Created `.planning/milestones/v1.7-ROADMAP.md` and `.planning/milestones/v1.7-REQUIREMENTS.md`; deleted `.planning/REQUIREMENTS.md`; collapsed Phases 34-40 inline detail in `.planning/ROADMAP.md` to a `<details>` summary; updated `.planning/MILESTONES.md` with v1.7 entry; updated `.planning/PROJECT.md` (Validated section + Key Decisions table + Current State + What This Is + Core Value); rewrote this STATE.md as between-milestones reset. Commit + git tag `v1.7` created.

**Stopped at:** v1.7 milestone close commit + tag.

**Resume file:** None. Project is between milestones.

## ▶ Next session — start here

**v1.7 SHIPPED. Ready to plan v1.8.**

### Recommended next command

`/gsd:new-milestone` — questioning → research → requirements → roadmap for v1.8 scope definition.

`/clear` first → fresh context window.

### v1.8 candidate scope (carryover backlog from v1.7 + earlier)

- **PREREQ-03 + Resend live activation** — flip `accounts.email_provider='resend'` for upgraded accounts (Andrew bills customer above Resend cost)
- **Lockfile regeneration** — make CI knip gate green
- **Resend abuse hard cap + bounce handling** — deferred from Phase 36
- **EMAIL-34** — per-account custom Resend domain (currently shared NSI domain)
- **AUTH-31** — Microsoft OAuth signup
- **AUTH-32** — SAML/SSO (enterprise)
- **CAL-SYNC-01/02** — Google Calendar read/write sync (extends `gmail.send` → full Workspace integration)
- **BRAND-22** — NSI logo asset (currently text-only "Powered by North Star Integrations")
- **BOOKER-10** — page-transition animations between event-types index and event-page

Live-use feedback on the new auth + email cap-hit upgrade flows will drive v1.8 scope.

## Files of record

- `.planning/PROJECT.md` — vision, requirements, key decisions, evolution log
- `.planning/ROADMAP.md` — milestone summary + Phase progress table
- `.planning/MILESTONES.md` — chronological history of shipped milestones
- `.planning/STATE.md` — this file
- `.planning/milestones/v1.7-ROADMAP.md` — v1.7 archive (full phase details)
- `.planning/milestones/v1.7-REQUIREMENTS.md` — v1.7 requirements archive
- `.planning/phases/35-per-account-gmail-oauth-send/35-DEVIATION-DIRECT-OAUTH.md` — canonical v1.7 architectural-pivot post-mortem (linkIdentity → direct-OAuth + SMTP → REST API)
