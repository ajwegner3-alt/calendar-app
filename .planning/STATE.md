# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-27 — v1.1 ROADMAP created. Phases 10-13 structured: (10) Multi-User Signup + Onboarding, (11) Booking Capacity + Double-Booking Root-Cause Fix, (12) Branded UI Overhaul (5 Surfaces), (13) Manual QA + Andrew Ship Sign-Off. All 53 v1.1 requirements mapped, zero unmapped. Ready to plan Phase 10.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-27 after v1.0 milestone)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.1 Phase 10 — Multi-User Signup + Onboarding (most urgent per Andrew 2026-04-27).

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Milestone:** v1.1 IN PROGRESS (started 2026-04-27).
**Phase:** Phase 10 — Multi-User Signup + Onboarding.
**Status:** Not started — Ready to plan (`/gsd:plan-phase 10`).
**Last activity:** 2026-04-27 — v1.1 ROADMAP.md authored with Phases 10-13. 53 requirements mapped, zero unmapped. Phase 11 flagged for `/gsd:research-phase` (advisory-lock vs slot_index decision); Phases 10 + 12 have decisions-required-during-planning (auto-provisioning pattern, Gmail SMTP quota plan, P-A8 pre-flight; email gradient strategy, visual regression scope).

**Progress (across both v1.0 and v1.1):** [█████████░░░░] 9 / 13 phases complete (v1.0 SHIPPED 2026-04-27)

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
Phase 10 [ ] Multi-User Signup + Onboarding          (Not started — ready to plan)
Phase 11 [ ] Booking Capacity + Double-Booking Fix   (Not started)
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
- **`RESERVED_SLUGS` duplicated across 2 files** in v1.0 — Phase 10 consolidates to `lib/reserved-slugs.ts` FIRST (slug picker is 3rd consumer; consolidation now avoids drift).
- **Supabase project + ref locked** — `mogfnutxrrbtvnaupoun`, region West US 2, Postgres 17.6.1.
- **Seeded NSI account** — `slug=nsi`, `id=ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_email=ajwegner3@gmail.com`, `owner_user_id=1a8c687f-73fd-4085-934f-592891f51784`. ⚠ Phase 10 P-A8: pre-flight UPDATE on `email_confirmed_at` if null BEFORE flipping email-confirm toggle.
- **v1.1 scope-cut 2026-04-27** — multi-user signup + capacity bug + branding overhaul; marathon QA RE-deferred to v1.2.
- **Multi-user signup ships free in v1.1 (no Stripe / billing).**
- **Branding tokens grow** — `accounts.background_color` + `accounts.background_shade` (none/subtle/bold) added in Phase 12.

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
- **`RESERVED_SLUGS` deduplication** — folds into Phase 10 (ONBOARD-05; build-order step 1).
- **`/auth/callback` 404** — folds into Phase 10 as `/auth/confirm` Route Handler (verifyOtp pattern; closes v1.0 BLOCKER).
- **`react-hooks/incompatible-library` warning** on `event-type-form.tsx:99` — v1.2 tech debt.
- **Pre-existing `tsc --noEmit` test-mock alias errors** — v1.2 tech debt.
- **Supabase service-role key still legacy JWT** — v1.2 (waiting on Supabase rollout).
- **`generateMetadata` double-load on public booking page** — v1.2 tech debt.
- **Reminder retry/resend UI** on `/app/bookings/[id]` — v1.2 backlog.
- **`qa-test` dedicated event type** — v1.2 backlog.
- **Plan 08-05/06/07 wave-2 git-index race** — v1.2 ops note (serialize commits or per-agent worktrees in future YOLO multi-wave runs).

### Active Blockers / Decisions Required Before Planning

- **Phase 10 — three decisions to surface during plan-phase:**
  1. Account auto-provisioning pattern: Postgres `on auth.users` trigger vs. Server Action after `/auth/confirm`.
  2. Gmail SMTP quota plan (P-A12 highest under-mitigated v1.1 risk).
  3. P-A8 pre-flight UPDATE on Andrew's `email_confirmed_at` BEFORE flipping email-confirm toggle.
- **Phase 11 — `/gsd:research-phase` flagged**: advisory-lock-trigger vs. slot_index pattern; verify v1.0 race test layer (supabase-js vs pg-driver); root-cause prod double-booking before designing replacement.
- **Phase 12 — two decisions during plan-phase**: email gradient strategy (solid-only vs VML fallback); minimum-viable Playwright suite scope (~1 day cheap insurance vs accept Andrew-eyes-only QA in Phase 13).

---

## Session Continuity

**Last session:** 2026-04-27 — v1.1 milestone scope confirmed → research synthesized → REQUIREMENTS.md authored (53 reqs) → ROADMAP.md authored (Phases 10-13).

**Stopped at:** v1.1 ROADMAP committed-ready. Phase 10 ready to plan.

**Resume:** `/gsd:plan-phase 10` (or `/gsd:research-phase` first if planner wants the architectural decisions explored independently before plan breakdown).

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
