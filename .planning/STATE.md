# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-03 — **Phase 27 COMPLETE.** All 3 plans done. EXCLUDE constraint live in production, 23P01 → 409 mapped end-to-end, 6-test pinning suite green, Andrew smoke approved on production `nsi` account. Phase 27 is shippable; ready for verifier sign-off.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-02 after v1.4 milestone start)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.4 Slot Correctness + Polish — Phases 25, 26, 27 all COMPLETE. Phase 27 sealed the contractor-can't-be-in-two-places-at-once invariant at the DB layer + mapped to 409 in the app + pinned by 6 tests + Andrew sign-off on production. v1.4 milestone close imminent (pending verifier).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.4 Slot Correctness + Polish (active — final verifier pending).
**Phase:** 27 — COMPLETE.
**Plan:** 03 of 03 — COMPLETE. Tests + production smoke approved by Andrew.
**Status:** All 3 Phase 27 plans complete. EXCLUDE constraint `bookings_no_account_cross_event_overlap` live in prod; 23P01 → 409 CROSS_EVENT_CONFLICT (POST /api/bookings) and 23P01 → slot_taken (reschedule.ts) mappings live in code; 6-test pinning suite at `tests/cross-event-overlap.test.ts` green (225 + 9 locally without DIRECT_URL; ≥230 + 4 with DIRECT_URL set). Andrew live-verified cross-event collision rejection on production `nsi` account; Phase B (curl) Turnstile-blocked but acceptable per plan. Buffer-vs-bug clarification resolved as pre-existing v1.0 `accounts.buffer_minutes = 15` (`lib/slots.ts:203`), unmodified by Phase 27. Phase 27 ready for verifier.
**Last activity:** 2026-05-03 — Plan 27-03 complete. Commit `7b3ffc8` (test file) + `b3088a8` (plan metadata).

**Phase queue:**
- ~~Phase 25: Surgical Polish (AUTH-21, AUTH-22, OWNER-14, OWNER-15)~~ — COMPLETE 2026-05-03
- ~~Phase 26: Bookings Page Crash Debug + Fix (BOOK-01, BOOK-02)~~ — COMPLETE 2026-05-03
- ~~Phase 27: Slot Correctness DB-Layer Enforcement (SLOT-01..05)~~ — COMPLETE 2026-05-03 (3 plans, 7 tasks, 9 task-commits + 3 metadata commits)

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 11 plans, ~50 commits — Phase 27 sealed 2026-05-03; verifier pending)
```

## Performance Metrics

**Phase 27 velocity (final):**
- 3 plans, 7 tasks, ~45 min total (27-01 ~10min + 27-02 ~10min + 27-03 ~25min including Andrew smoke)
- 4 files created (3 SQL migrations + 1 test file), 3 files modified (route.ts, reschedule.ts, booking-form.tsx)
- 1 production schema change: `btree_gist` extension + `bookings.during` generated column + `bookings_no_account_cross_event_overlap` EXCLUDE constraint
- Test suite: 224 + 4 → 225 + 9 (without DIRECT_URL) / ≥230 + 4 (with DIRECT_URL)

**v1.3 velocity (final):**
- 3 phases (22-24), 6 plans, ~9 tasks, 34 commits over ~10 hours
- NET +200 LOC runtime; 22,071 LOC TS/TSX at sign-off
- Test suite: 222 passing + 4 skipped (baseline preserved from v1.2)

**Reference velocities:** v1.2: 8 phases, 22 plans, 91 commits, 3 days. v1.1: 6 phases, 34 plans, 135 commits, 3 days. v1.0: 9 phases, 52 plans, 222 commits, 10 days.

## Accumulated Context

### Key decisions carried into v1.4 (Phase 27 sealed)

- **EXCLUDE constraint mechanism locked AND APPLIED** — `EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status = 'confirmed')` with `btree_gist` and a generated `during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED` column. Live in production; verified via `pg_constraint` and `information_schema.columns`.
- **Pre-flight diagnostic was a hard gate AND PASSED** — V14-CP-06 — bookings_total = 6, 0 cross-event overlap rows on diagnostic run; single-step ADD CONSTRAINT applied.
- **23P01 error mapping LIVE in two files** — `app/api/bookings/route.ts` (in-loop branch BEFORE `code !== 23505` guard; post-loop branch BEFORE 23505 → CROSS_EVENT_CONFLICT 409) and `lib/bookings/reschedule.ts` (23P01 → existing `'slot_taken'` reason, reuses `/api/reschedule` 409 SLOT_TAKEN unchanged). V14-MP-01 + V14-MP-02 satisfied.
- **Per-instance className override pattern** — extends v1.3 Phases 23/24 invariant. Shared `components/ui/calendar.tsx` and `globals.css --color-accent` UNTOUCHED. Phase 25 used instance-level overrides only.
- **Migration apply path locked** — `echo | npx supabase db query --linked -f <file>`. `supabase db push --linked` is broken in this repo.
- **RSC boundary violations are a real failure class** — function props on intrinsic HTML elements in Server Components crash before render with digest. Use static structural tests to prevent regression (see `tests/bookings-table-rsc-boundary.test.ts` and now `tests/cross-event-overlap.test.ts` Test 6 patterns).
- **Buffer semantics are pre-existing v1.0 and out of scope for Phase 27** — `accounts.buffer_minutes` (account-scoped) controls the slot picker's pre-filter at `lib/slots.ts:203` (`slotConflictsWithBookings`). The `nsi` production account has `buffer_minutes = 15`, which is why adjacent slots get hidden in the UI. The DB constraint correctly allows `[)` adjacency at the constraint level (Test 3 pins this); the picker pre-hides slots due to buffer. Andrew chose option (a) — keep buffer behavior as-is.

### Active blockers

None. Phase 27 is shippable. Awaiting verifier sign-off to close v1.4 milestone.

### Decisions from Plan 27-03

- **6 tests is the CONTEXT-locked minimum** — each pins one specific behavior or regression-guard (cross-event block, group-booking regression, adjacent non-collision, cancelled-doesn't-block, reschedule cross-event, retry-loop-break). Order matches plan's pin list.
- **Test 6 (retry-loop-break) implemented as static-text scan** — Phase 26 precedent. Avoids Turnstile / dev-server dependency. Placed OUTSIDE the `describe.skipIf` so it runs in CI without `SUPABASE_DIRECT_URL`.
- **Inline `createEventType` / `cleanupEventType` helpers per-test-file** — `tests/helpers/supabase.ts:getOrCreateTestEventType` is too narrow (returns same row); Phase 27 needs distinct event types per test, so helpers are scoped to this test file.
- **All pg-direct tests use try/finally cleanup with `sql.end({ timeout: 5 })`** — orphan rows in the test account would corrupt subsequent runs.
- **Andrew chose option (a) on buffer-vs-bug clarification** — 10:30 slot hidden was `buffer_minutes = 15` on the `nsi` account (`lib/slots.ts:203`), NOT a Phase 27 regression. No code change. The DB constraint correctly allows `[)` adjacency (Test 3 pins this).
- **Phase B (raw curl) Turnstile-blocked but acceptable per plan** — plan's `<resume-signal>` explicitly allowed `partial: A passed, B blocked by Turnstile`. The 6-test suite + Phase A UI confirmation together prove the constraint + 409 mapping end-to-end.

### Decisions from Plan 27-02

- **23P01 in-loop branch placed BEFORE the `code !== 23505` check** in `app/api/bookings/route.ts`. Order matters: placing it after would let the generic-error guard `break` the loop before the 23P01 detector ran, losing the distinct CROSS_EVENT_CONFLICT path.
- **23P01 post-loop branch placed BEFORE the existing 23505 branch** in the `if (!booking)` block. Ensures the 23P01 path returns its distinct 409 body instead of falling through to the capacity-coded responses.
- **`lib/bookings/reschedule.ts` maps 23P01 → existing `'slot_taken'` reason** (NOT a new reason). Avoids parallel changes in `app/api/reschedule/route.ts` and tests for behavior the booker can't distinguish from a same-event-type race. CONTEXT-locked.
- **`app/api/reschedule/route.ts` deliberately UNTOUCHED.** Inspected; existing `result.reason === 'slot_taken'` → 409 SLOT_TAKEN mapping is reused as-is for the 23P01-derived path.
- **CROSS_EVENT_CONFLICT message string locked:** `"That time is no longer available. Please choose a different time."` Identical to the booking-form's defensive-fallback wording for max consistency. NO event-type leak, NO contractor-other-appointment hint. CONTEXT-locked.
- **Observability log fields locked:** route.ts logs `{ code, account_id, event_type_id }`; reschedule.ts logs `{ code, booking_id }`. NO PII (booker_email, booker_name, booker_phone, ip).
- **No string-match against constraint name** — `bookings_no_account_cross_event_overlap` is the only EXCLUDE constraint on `bookings`, so any 23P01 from this table implies it. Keeps app code loosely coupled to the DB-side name.

### Decisions from Plan 27-01

- **Pre-flight diagnostic returned 0 overlap rows on a 6-row bookings table.** V14-CP-06 hard gate satisfied without manual data resolution.
- **Single-step ADD CONSTRAINT chosen** (bookings_total = 6 << 10k threshold). NOT VALID + VALIDATE CONSTRAINT branch deleted from file for unambiguity. Documented in migration header.
- **Constraint applied to production:** `bookings_no_account_cross_event_overlap` with `EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE ((status = 'confirmed'::booking_status))`. Verified via `pg_constraint`.
- **Generated column live:** `during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)'::text)) STORED`. Verified via `information_schema.columns`. Half-open `[)` confirmed (V14-CP-02).
- **Rollback file written and ready** but does NOT drop `btree_gist` extension (harmless to keep, may be reused, dropping can fail on dependents).
- **Constraint name `bookings_no_account_cross_event_overlap`** is the literal sentinel Plan 27-02's error mapper will use.

### Decisions from Phase 26 (26-01 + 26-02 + 26-03)

- **RSC boundary violation confirmed as root cause** — `bookings-table.tsx:93` had `onClick` on a Server Component `<a>` element. Fix: 1-line deletion. Not Candidates A-E (data-layer hypotheses). Deployed to Vercel 2026-05-03.
- **Regression test: Option 1 (static text scan)** — reads source file as fs text, regex-asserts no `onClick=` in tel: anchor block. Zero new dependencies. Fails if onClick re-introduced; updates required if component converts to "use client".
- **Deferred fragilities for Phase 27** — unguarded `TZDate` at `bookings-table.tsx:37` (Candidate C), normalization `undefined` at `queries.ts:92-94` (Candidate B), unguarded throw at `queries.ts:86` (Candidate A). All safe today; flagged for future hardening. (Phase 27 did NOT touch these — they remain deferred for a future polish pass.)
- **!inner audit DOCUMENT-RISK** — `load-month-bookings.ts:47` uses optional-chain only (no normalization); safe for current callers. Flag if future callers access `event_types.account_id` without `?.`.
- **Cross-account verification: shape-waiver protocol** — shapes with 0 production rows are waived with documented rationale, not silently skipped. 4 live shapes passed; 3 waived (Shapes 5/6/7: cancelled-only, >50 bookings, soft-deleted event_type).

## Session Continuity

**Last session:** 2026-05-03 — Completed Plan 27-03 (tests + production smoke). Andrew smoke approved on production `nsi` account; buffer-vs-bug clarification resolved (option (a)). Phase 27 SUMMARY + Phase rollup SUMMARY written and committed.

**Stopped at:** Phase 27 — COMPLETE. All 3 plans sealed. Ready for verifier sign-off.

**Resume:** v1.4 milestone close. Run the verifier (or whatever orchestrator step closes the milestone). All Phase 27 success criteria met:
- SC #1 (booker 409 not 500): MET
- SC #2 (group-booking capacity preserved): MET
- SC #3 (reschedule 409 not 500): MET
- SC #4 (Andrew live-verifies cross-event collision returns 4xx): MET via Phase A UI
- SC #5 (pg-driver tests pass with DIRECT_URL, skip cleanly without): MET

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-05-02 after v1.4 milestone start)
- `.planning/ROADMAP.md` — v1.0-v1.3 collapsed; v1.4 Phases 25-27 defined (orchestrator updates on phase close)
- `.planning/REQUIREMENTS.md` — 11 v1.4 requirements; traceability table filled (orchestrator updates on phase close)
- `.planning/STATE.md` — this file
- `.planning/research/SUMMARY.md` — all mechanism decisions locked; phase structure confirmed
- `.planning/research/PITFALLS.md` — V14-CP-01..07, V14-MP-01..06, V14-mp-01..03
- `.planning/phases/26-bookings-page-crash-debug-fix/26-SUMMARY.md` — full Phase 26 phase summary
- `.planning/phases/27-slot-correctness-db-layer-enforcement/27-SUMMARY.md` — full Phase 27 phase rollup (3 plans, SLOT-01..05 status, smoke runbook)
- `.planning/phases/27-slot-correctness-db-layer-enforcement/27-03-SUMMARY.md` — final plan summary (6 tests + Andrew smoke + buffer clarification)
