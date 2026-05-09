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

## Cumulative Stats

- **Total milestones shipped:** 7 (v1.0 → v1.7)
- **Total phases shipped:** 40 (Phases 1-9 + 10/11/12/12.5/12.6/13 + 14-21 + 22-24 + 25-27 + 28-30 + 31-33 + 34-40)
- **Total plans shipped:** 170 (52 + 34 + 22 + 6 + 8 + 6 + 10 + 32)
- **Total commits:** ~692 (222 v1.0 + 135 v1.1 + 91 v1.2 + 34 v1.3 + 50 v1.4 + 31 v1.5 + 53 v1.6 + 129 v1.7)

---

*Roadmap last updated: 2026-05-09 — v1.7 SHIPPED 2026-05-09 — 7 phases, 32 plans, 129 commits across 3 days. Headline: opened multi-tenant signup with Google OAuth (combined gmail.send consent), retired the centralized Gmail SMTP singleton in favor of per-account Gmail REST API send, magic-link login with enumeration-safe + 4-way-ambiguous response shape, Resend HTTP provider framework for upgraded accounts (live activation gated on PREREQ-03), 220ms fade+rise booker animation with prefers-reduced-motion respect + V15-MP-05 Turnstile lifecycle preserved, and dead-code audit removing 1 file + 3 deps + 22 exports + ~202 LOC under per-item Andrew sign-off (substituted by yolo-mode delegated trust this milestone). Two architectural pivots shipped to production during Phase 35: direct-Google-OAuth replaces Supabase linkIdentity for Gmail-connect (commit ab02a23) because linkIdentity silently dropped provider_refresh_token under several conditions; Gmail provider switched from nodemailer SMTP+OAuth2 to Gmail REST API (commit cb82b6f) because the gmail.send scope only authorizes the REST endpoint while SMTP relay needs the much broader https://mail.google.com/ scope. 7th consecutive deploy-and-eyeball release with no formal milestone audit (yolo mode); deploy-and-eyeball is canonically the operating model. Carryover into next milestone: PREREQ-03 (Resend domain DNS), lockfile regeneration under Node 20 to make CI green.*
