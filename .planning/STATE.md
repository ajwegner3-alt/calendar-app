# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-03 — **v1.5 milestone started.** Scope locked via questioning: 3 headline objectives (BUFFER-01 + audience rebrand + 3-column booker). Research phase spawning.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-03 after v1.5 milestone start)

**Core value:** A visitor lands on a service-based business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.5 — Buffer Fix + Audience Rebrand + Booker Redesign. Defining requirements (research → requirements → roadmap).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.5 (started 2026-05-03).
**Phase:** Not started (defining requirements).
**Plan:** —
**Status:** Researching domain ecosystem for v1.5 features.
**Last activity:** 2026-05-03 — Milestone v1.5 started; scope locked; research spawning.

**Phase queue:**
- Phases 28+ to be derived during roadmap creation.

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
```

## Performance Metrics

**v1.4 velocity (final):**
- 3 phases (25-27), 8 plans, ~17 tasks, 50 commits over ~2 days
- Test suite: 225 passing + 9 skipped (without DIRECT_URL) / ≥230 + 4 (with DIRECT_URL set)
- 1 production schema change: `btree_gist` extension + `bookings.during` generated column + `bookings_no_account_cross_event_overlap` EXCLUDE constraint
- 11/11 requirements shipped (100%)

**Reference velocities:** v1.3: 3 phases, 6 plans, 34 commits, 1 day (same-day). v1.2: 8 phases, 22 plans, 91 commits, 3 days. v1.1: 6 phases, 34 plans, 135 commits, 3 days. v1.0: 9 phases, 52 plans, 222 commits, 10 days.

## Accumulated Context

### Patterns established in v1.4 (carried forward)

- **EXCLUDE constraint with partial WHERE for "this combination must be unique under predicate" invariants** — `bookings_no_account_cross_event_overlap` is the canonical example. Pattern: `btree_gist` + generated `tstzrange [)` column + `EXCLUDE USING gist (... WITH =, ... WITH <>, ... WITH &&) WHERE (...)`. Reusable for any future cross-row uniqueness invariant scoped by partial predicate.
- **Pre-flight diagnostic hard gate (V14-CP-06) for VALIDATE-CONSTRAINT-aborting DDL** — read-only diagnostic SQL runs BEFORE migration; non-zero result rows STOP the workflow and surface to user for manual data resolution; never auto-cancel programmatically. Pattern: pre-flight → checkpoint:human-verify → migrate.
- **23P01 retry-loop-break ordering (V14-MP-01)** — any new error code that's independent of the retry condition must `break` BEFORE the retry guard, with no increment of the retry counter. Pinned by static-text scan test.
- **Reuse-existing-reason mapping for indistinguishable error classes (V14-MP-02)** — when a new error path maps to the same user-visible outcome as an existing reason, reuse the existing reason in the lib layer to avoid parallel updates downstream (route handler, client UI, copy).
- **PII-free observability logs on user-data paths** — log lines on new error branches include only structural identifiers (`code`, `account_id`, `event_type_id`, `booking_id`); never PII.
- **Static-text scan tests for control-flow invariants** — read source as fs text + regex-assert structural property. Zero new dependencies. Place OUTSIDE `describe.skipIf` so they run in CI without `SUPABASE_DIRECT_URL`. Examples: Phase 26 RSC boundary test, Phase 27 retry-loop-break test.
- **`describe.skipIf(skipIfNoDirectUrl)` for pg-driver tests (V14-MP-05)** — pg-driver tests skip cleanly in CI; mirrors `tests/race-guard.test.ts` precedent. All cleanup in `try/finally` with `sql.end({ timeout: 5 })`.
- **Per-instance className override pattern preserved through Phase 25** — extends Phase 23/24 invariant. Shared `components/ui/calendar.tsx` and `globals.css --color-accent` UNTOUCHED. v1.5 should preserve this invariant unless a deliberate redesign is in scope.

### Active blockers

None. v1.4 shipped clean. Awaiting v1.5 milestone definition.

### Buffer-vs-bug clarification (v1.4 carry-forward to v1.5)

`accounts.buffer_minutes` is account-scoped and pre-existing v1.0 behavior. It causes `lib/slots.ts:203 slotConflictsWithBookings` to pre-hide adjacent slots for ANY same-account booking (regardless of event type). The `nsi` production account has `buffer_minutes = 15`; this surfaces during smoke testing as adjacent slots being hidden after a same-account booking. The DB constraint correctly allows `[)` adjacency at the constraint level (Phase 27 Test 3 pins this); the picker pre-hides slots earlier due to buffer. Andrew chose option (a) keep buffer behavior at v1.4 close. **BUFFER-01 candidate**: event-type-scoped buffer (apply buffer within same event type only, allow cross-event-type adjacency). Surface this in v1.5 scoping if Andrew prefers cross-event-type adjacency without losing buffer between same-event-type bookings.

### Deferred fragilities (v1.4 carry-forward to v1.5)

From Phase 26 audit:
- Unguarded `TZDate` at `bookings-table.tsx:37` (Candidate C)
- Normalization `undefined` at `queries.ts:92-94` (Candidate B)
- Unguarded throw at `queries.ts:86` (Candidate A)
- `!inner` audit DOCUMENT-RISK at `load-month-bookings.ts:47` (optional-chain only; safe for current callers; flag if future callers access `event_types.account_id` without `?.`)

All safe today; deliberately not fixed during Phase 26 strict-fix bias (V14-MP-04). Available for a future polish pass.

### Carryover backlog (deferred to v1.5+)

Marathon QA (QA-09..QA-13 — formally deploy-and-eyeball model after 4 consecutive deferrals), Resend migration (INFRA-01), Vercel Pro upgrade (INFRA-02), OAuth signup (AUTH-23), magic-link login (AUTH-24), brand asset replacement (BRAND-22), 7 tech-debt items (DEBT-01..07), Phase 26 deferred fragilities (3 sites), BUFFER-01 candidate from Phase 27 smoke.

## Session Continuity

**Last session:** 2026-05-03 — Closed v1.4 milestone. Archived Phase 25-27 spec to `.planning/milestones/v1.4-ROADMAP.md`. Archived requirements to `.planning/milestones/v1.4-REQUIREMENTS.md`. Cleared `.planning/REQUIREMENTS.md` (fresh for v1.5). Updated `.planning/MILESTONES.md` (new entry prepended). Updated `.planning/PROJECT.md` (Active → Validated for 11 v1.4 requirements; Key Decisions table extended with 9 v1.4 entries; Last Updated footer). Collapsed `.planning/ROADMAP.md` (v1.4 details replaced by one-line summary + archive link). Created git tag `v1.4`.

**Stopped at:** Between milestones. v1.5 not yet scoped.

**Resume:** Run `/gsd:new-milestone` to start v1.5 (questioning → research → requirements → roadmap). Live-use feedback during the v1.4 → v1.5 interval will likely drive headline scope.

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-05-03 after v1.4 close; 5 Validated milestone blocks; Key Decisions table reflects v1.0–v1.4 outcomes)
- `.planning/ROADMAP.md` — phase index (collapsed v1.0–v1.4 each as one-line summary + archive link; no active phase)
- `.planning/MILESTONES.md` — historical record (v1.4 prepended at top; v1.3 retained below)
- `.planning/STATE.md` — this file
- `.planning/milestones/v1.4-ROADMAP.md` — full v1.4 phase detail archive (Phases 25-27)
- `.planning/milestones/v1.4-REQUIREMENTS.md` — full v1.4 requirements archive (11/11 shipped)
- `.planning/milestones/v1.3-*.md` — v1.3 archive (carried over)
- `.planning/milestones/v1.2-*.md` — v1.2 archive (carried over)
- `.planning/milestones/v1.1-*.md` — v1.1 archive (carried over)
- `.planning/milestones/v1.0-*.md` — v1.0 archive (carried over)
- `.planning/research/SUMMARY.md` — v1.4 research mechanism decisions (will be superseded when v1.5 research runs)
- `.planning/research/PITFALLS.md` — V14-CP-01..07, V14-MP-01..06, V14-mp-01..03 (v1.4 pitfalls; archived for reference)
