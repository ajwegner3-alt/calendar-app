# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-02 — **v1.2 MILESTONE ARCHIVED.** All 8 phases (14-21) shipped; archives created at `.planning/milestones/v1.2-ROADMAP.md` + `.planning/milestones/v1.2-REQUIREMENTS.md`. ROADMAP.md collapsed to one-line summary; REQUIREMENTS.md deleted (fresh one needed for v1.3 via `/gsd:new-milestone`). Git tagged `v1.2`. Total project state: 23 phases shipped, 108 plans, 448 commits, 21,871 LOC TS/TSX runtime, 222 passing tests.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-02 for v1.2 close-out)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** Awaiting v1.3 scoping. Backlog defined in `PROJECT.md` "Current Milestone: v1.3" section + `FUTURE_DIRECTIONS.md` §8 (third-deferral marathon QA + Resend migration + Vercel Pro hourly cron flip + live cross-client email QA + OAuth/magic-link/hard-delete cron/soft-delete grace/slug 301/onboarding analytics/timing-oracle hardening + final NSI mark image swap).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.2 — SHIPPED 2026-05-02 (archived).
**Phase:** None active.
**Plan:** None active.
**Status:** Awaiting `/gsd:new-milestone` to formalize v1.3 scope (questioning → research → requirements → roadmap).
**Last activity:** 2026-05-02 — `/gsd:complete-milestone` archived v1.2 (ROADMAP collapsed, REQUIREMENTS deleted, MILESTONES.md updated, PROJECT.md evolved, git tagged `v1.2`).

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [ ] Marathon QA + Infrastructure (TBD — awaiting /gsd:new-milestone)
```

## Performance Metrics

**v1.2 velocity (final):**
- 8 phases (14-21), 22 plans, ~80 tasks, 91 commits over 3 days (2026-04-30 → 2026-05-02)
- First net-deletion milestone: NET -792 lines runtime (910 inserted, 1,702 deleted across 74 files excluding `.planning/`)
- Final LOC: 21,871 TS/TSX in runtime tree (down from 29,450 at v1.1 close)
- Final test suite: 222 passing + 4 skipped (24 test files; -3 deleted in Phase 20)

**v1.1 reference velocity:** 6 phases (10-13 incl. 12.5/12.6), 34 plans, 135 commits, 3 days. 33,817 lines inserted + 2,153 deleted (additive milestone).

**v1.0 reference velocity:** 9 phases, 52 plans, 222 commits, 10 days. 85,014 lines inserted total. First-milestone scaffolding cost.

## Accumulated Context

### Architectural patterns established (carried into v1.3)

(See `PROJECT.md` "Context" → "Architectural patterns established" + "v1.1 architectural patterns added" + "v1.2 architectural patterns added" for the canonical record.)

**v1.2 highlights worth keeping in mind for v1.3:**
- Two-step DROP deploy protocol (CP-03) is locked. Any future column DROP follows the same: code-stop-reading deploy → 30-min drain → DROP SQL.
- `db query --linked -f` is the canonical migration apply method. `db push` remains broken in this repo per PROJECT.md §200.
- `Header` component is multi-variant (`'owner' | 'auth' | 'public'`). Reusable for any future no-sidebar surface.
- Owner shell is NSI-locked. Per-account chrome theming WILL NOT return on owner side. Public surfaces keep customer `brand_primary`.
- Visual gates run on live Vercel preview. Andrew's deploy-and-eyeball is the de-facto production gate (third-time pattern across v1.0/v1.1/v1.2).

### v1.2 ship-time invariants (still true post-archive)

- `accounts` schema: `id, slug, name, owner_email, logo_url, brand_primary, timezone, onboarding_complete` + standard timestamps. **Deprecated columns (`sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity`) PERMANENTLY DROPPED** as of `20260502034300_v12_drop_deprecated_branding_columns.sql`. Re-add `.SKIP` rollback artifact exists at `20260502034301_readd_deprecated_branding.sql.SKIP` (NOT applied).
- `Branding` interface canonical shape: `{ logoUrl, primaryColor, textColor }` (3 fields).
- `EmailBranding` interface canonical shape: `{ name, logo_url, brand_primary }` (3 fields).
- Email-layer `DEFAULT_BRAND_PRIMARY = "#3B82F6"` (NSI blue-500); web-layer `DEFAULT_BRAND_PRIMARY = "#0A2540"` (legacy null-fallback). Different purposes; do NOT unify.
- NSI account `brand_primary` = `#0A2540` (dark navy; below 0.85 luminance threshold; no PublicShell glow fallback).
- Pre-flight QA artifacts on prod (KEPT for v1.3 marathon): Test User 3, capacity-test event_type, 3 distinct branding profiles (navy/magenta/emerald-null).

### Active blockers / open items

- **Marathon QA carryover (third deferral):** QA-09..QA-13 + ~21 per-phase manual checks accumulated through v1.1+v1.2. v1.3 should either commit time-boxed marathon execution upfront OR formally adopt deploy-and-eyeball as the canonical production gate.
- **Infrastructure migrations awaiting v1.3:** Resend migration (closes EMAIL-08), Vercel Pro upgrade + hourly cron flip, live cross-client email QA.
- **Tech debt baseline:** ~22 pre-existing tsc errors in `tests/` (TS7006/TS2305) — out of scope for v1.0/v1.1/v1.2. v1.3 should clean up.
- **Cosmetic:** `app/embed/[account]/[event-slug]/_lib/types.ts AccountSummary` retains `background_color` + `background_shade` fields (cosmetic; columns dropped from DB; not load-bearing).

## Session Continuity

**Last session:** 2026-05-02 — `/gsd:complete-milestone 1.2`.
**Stopped at:** v1.2 archived. ROADMAP.md collapsed; REQUIREMENTS.md deleted; MILESTONES.md prepended; PROJECT.md evolved; STATE.md reset; git tagged `v1.2`.
**Resume:** `/gsd:new-milestone` (start v1.3 scoping — questioning → research → requirements → roadmap). Backlog already defined in `PROJECT.md` "Current Milestone: v1.3" section + `FUTURE_DIRECTIONS.md` §8.

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-05-02)
- `.planning/ROADMAP.md` — collapsed milestone summaries (v1.0/v1.1/v1.2 archived)
- `.planning/MILESTONES.md` — full ship records (v1.0/v1.1/v1.2)
- `.planning/STATE.md` — this file
- `.planning/milestones/v1.2-ROADMAP.md` — full v1.2 phase detail archive
- `.planning/milestones/v1.2-REQUIREMENTS.md` — v1.2 requirements archive (95/95 complete)
- `FUTURE_DIRECTIONS.md` — v1.3 backlog enumeration
