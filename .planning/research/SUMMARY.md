# Research Summary: calendar-app v1.4
# Slot Correctness + Polish

**Synthesized:** 2026-05-02
**Research files:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Milestone:** v1.4 -- 5 items / 11 requirements
**Phase numbering continues from:** 25 (v1.3 ended at Phase 24)

---

## Executive Summary

v1.4 closes the only remaining safety gap in the booking system: a confirmed booking for Event Type A does not block a concurrent POST to Event Type B at the same time on the same account. The display layer has been account-scoped since v1.1 (route.ts:138 queries all confirmed bookings for the account regardless of event type); the INSERT layer has never been. Three research agents independently identify the same fix: an EXCLUDE USING gist constraint with btree_gist extension, a stored-generated during tstzrange column, and a partial predicate WHERE (status = confirmed). A fourth path (BEFORE INSERT/UPDATE trigger, Option B) is documented in ARCHITECTURE.md as an alternative but is demoted to fallback only. STACK.md verified the exact constraint DDL against production Postgres 17.6.1 and confirmed all four behavioral edge cases (overlap blocked, adjacent allowed, different account allowed, non-confirmed status allowed). PITFALLS.md independently derived and confirmed the event_type_id WITH <> operator requirement to preserve group-booking capacity coexistence. All mechanism decisions are locked.

The constraint design is settled; the execution risk is operational, not architectural. Two hazards dominate: (1) the pre-flight diagnostic SQL must return zero rows before the migration runs -- the reported duplicate booking is exactly the class of violation that aborts VALIDATE CONSTRAINT -- and (2) error code 23P01 (exclusion_violation) must be explicitly caught in both app/api/bookings/route.ts:212-249 and lib/bookings/reschedule.ts, or the DB enforcement surfaces as a confusing 500 instead of a user-recoverable 409. The four polish items (AUTH-21/22, OWNER-14, OWNER-15, BOOK-01/02) carry low risk and are independent of the constraint work; they can proceed in parallel.

---

## Key Findings

### From STACK.md

- **Constraint mechanism locked (live-verified):** EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status = confirmed) with btree_gist v1.7 compiles and behaves correctly on Postgres 17.6.1. All four behavioral cases verified by direct execution against production.
- **Generated column required:** during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, half-open)) STORED must be added before the constraint. Function-based expression in EXCLUDE rejected -- Postgres requires a stored column reference, not an inline expression.
- **btree_gist is not installed by default:** pg_available_extensions shows v1.7 available but installed_version: null. CREATE EXTENSION IF NOT EXISTS btree_gist must be the first statement in the migration.
- **Error code 23P01:** PostgREST surfaces Postgres SQLSTATE directly as .error.code on the Supabase JS client. 23P01 is distinct from 23505 and is NOT suppressed by ON CONFLICT DO NOTHING.
- **Migration apply path locked:** echo | npx supabase db query --linked -f <file> -- identical to the existing workaround. EXCLUDE constraints run inside a normal transaction; no CONCURRENTLY path needed.
- **Zero new npm packages.** Existing @supabase/supabase-js + postgres (direct) stack covers everything.
- **Retry loop must not increment slot_index on 23P01:** A different slot_index changes the bookings_capacity_slot_idx tuple but the time range stays the same -- the EXCLUDE constraint fires again. Break immediately and return 409 CONTRACTOR_BUSY.

---

### From FEATURES.md

- **Core invariant:** One contractor = one slot at a time, across ALL event types. Display layer enforces this; INSERT layer does not. v1.4 closes the gap.
- **Group-booking capacity must coexist:** max_bookings_per_slot > 1 (same event type, different slot_index) must continue to work. The event_type_id WITH <> operator allows same-event-type overlap while blocking cross-event-type overlap -- exact semantics required.
- **Reschedule semantics confirmed:** lib/bookings/reschedule.ts does a single in-place UPDATE (status stays confirmed, coordinates change). The EXCLUDE constraint handles UPDATE-in-place correctly without special carveouts.
- **Buffer is account-scoped and read-time only:** end_at stores raw booking end; buffer applied only in slotConflictsWithBookings. v1.4 does not change buffer logic.
- **BOOK-01/02 must ship in this milestone:** /app/bookings is crashing in production. Independent of the DB constraint work.
- **Surgical polish items are zero data-layer risk:** AUTH-21/22 (auth-hero.tsx:27-31), OWNER-14 (home-calendar.tsx DayButton bg-gray-700 to bg-primary), OWNER-15 (DayButton --cell-size CSS property override). Per-instance className changes only; components/ui/calendar.tsx and globals.css --color-accent must not be touched.

---

### From ARCHITECTURE.md

> **Cross-agent disagreement resolved:** ARCHITECTURE.md initially recommended Option B (BEFORE INSERT/UPDATE trigger) and flagged Option A (WITH <> EXCLUDE form) as needing synthesizer verification. STACK.md live-verified the constraint DDL; PITFALLS.md independently derived the full event_type_id WITH <> form with correct semantics. **Option A is the locked primary mechanism. Option B is fallback only.**

- **Option A preferable over Option B:** No PL/pgSQL function to maintain, no AND id <> NEW.id reschedule carveout required, standard declarative Postgres DDL.
- **Reschedule UPDATE-in-place is constraint-safe:** Postgres EXCLUDE evaluates NEW vs. all other rows atomically; old coordinates are replaced in-place with no transient double-presence.
- **Pre-flight diagnostic SQL provided:** Self-join on bookings to find existing confirmed cross-event-type overlaps. Must return zero rows before constraint creation.
- **Phase 27 internal sequencing:** Pre-flight diagnostic -> extension + column + constraint (single migration file) -> 23P01 error mapping in route.ts and reschedule.ts -> new tests.
- **Bookings crash debug starting point:** queryBookings() _lib/queries.ts:85 -> event_types!inner join normalization -> null/undefined event_types access in bookings-table.tsx:66. Check Vercel server logs first.
- **OWNER-15 correct fix:** Override --cell-size CSS custom property on the Calendar instance. Do NOT add overflow-x-auto to the Calendar root (creates horizontal scroll, wrong UX for a date picker).

---

### From PITFALLS.md

- **V14-CP-01 -- btree_gist missing blocks deploy:** First statement in migration must be CREATE EXTENSION IF NOT EXISTS btree_gist. Without it, EXCLUDE USING gist on UUID raises an error and the migration aborts entirely.
- **V14-CP-02 -- Wrong range bound causes false conflicts:** Use half-open interval [) (inclusive start, exclusive end). Fully-closed [] makes adjacent slots collide. Regression test: 09:00-09:30 and 09:30-10:00, different event types, same account -- both must succeed.
- **V14-CP-04 -- Naive EXCLUDE breaks group booking:** The event_type_id WITH <> operator is mandatory. Without it, same-event-type group bookings (slot_index 1, 2, 3) are blocked. Regression test required.
- **V14-CP-06 -- Pre-flight is a hard gate:** Existing overlapping confirmed bookings abort VALIDATE CONSTRAINT. Run the diagnostic SQL before ANY migration SQL.
- **V14-MP-01 -- 23P01 falls into 500 branch:** route.ts:243 only branches on 23505. Add explicit 23P01 branch before 23505 check; break immediately; return 409 CROSS_EVENT_CONFLICT.
- **V14-MP-02 -- Reschedule route also needs 23P01:** Add 23P01 -> slot_taken branch in reschedule.ts:149.
- **V14-mp-02 -- Auth pill location is auth-hero.tsx:27-31:** NOT in header.tsx or a layout file. Remove only the pill div; do not modify the Header variant=auth shared else-branch.

---

## Locked Decisions

All major decisions are locked. No open questions require Andrew input before planning.

| Decision | Resolution | Source(s) |
|---|---|---|
| Constraint mechanism (PRIMARY) | EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status=confirmed) | STACK.md (live verification) + PITFALLS.md (independent derivation) -- overrides ARCHITECTURE.md Option B |
| Constraint mechanism (FALLBACK) | Option B: BEFORE INSERT/UPDATE trigger | ARCHITECTURE.md |
| btree_gist version | v1.7, available in production, not installed by default | STACK.md |
| Range column | during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, half-open [))) STORED | STACK.md |
| Range bounds | half-open [) -- inclusive start, exclusive end | STACK.md + PITFALLS.md CP-02 |
| Error code surfaced | 23P01 via PostgREST .error.code, NOT caught by ON CONFLICT | STACK.md |
| App error mapping (new bookings) | 23P01 -> break retry loop -> 409 CROSS_EVENT_CONFLICT / CONTRACTOR_BUSY | STACK.md + PITFALLS.md MP-01 |
| App error mapping (reschedule) | 23P01 -> slot_taken in reschedule.ts:149 | PITFALLS.md MP-02 + ARCHITECTURE.md |
| Migration apply path | echo | npx supabase db query --linked -f <file> (single file, all 3 statements) | STACK.md |
| Retry loop behavior on 23P01 | Break immediately; do not increment slot_index | STACK.md |
| Group-booking coexistence | event_type_id WITH <> in EXCLUDE; bookings_capacity_slot_idx unchanged | FEATURES.md + PITFALLS.md CP-04 |
| Reschedule semantics | UPDATE-in-place; EXCLUDE handles natively; no id <> NEW.id carveout needed | ARCHITECTURE.md |
| OWNER-15 fix | Override --cell-size on instance; no overflow-x-auto | ARCHITECTURE.md + PITFALLS.md mp-01 |
| OWNER-14 fix | Replace bg-gray-700 with bg-primary in DayButton isSelected branch | FEATURES.md + PITFALLS.md mp-03 |
| AUTH-21/22 fix location | auth-hero.tsx:27-31 pill div only; header.tsx untouched | ARCHITECTURE.md + PITFALLS.md mp-02 |
| Phase numbering | Phase 25, 26, 27 | Context (v1.3 ended at Phase 24) |
| v1.3 invariants | Do NOT touch components/ui/calendar.tsx, globals.css --color-accent, shared shadcn components | FEATURES.md + PITFALLS.md |

---

## Unanimous Findings (Locks for Roadmapper)

All four research agents agree on these without qualification:

- Zero new npm packages for v1.4
- Pre-flight diagnostic SQL must return zero rows before any migration is applied -- hard gate, not suggestion
- bookings_capacity_slot_idx is NOT replaced or modified; the new EXCLUDE constraint is additive
- WHERE (status = confirmed) partial predicate is required on the EXCLUDE constraint
- Phase 27 internal sequence is fixed: pre-flight -> migration -> error mapping -> tests
- Phase 25 (surgical polish) and Phase 26 (crash debug) are parallel-safe with each other and independent of Phase 27
- Per-instance className overrides only for Phase 25; no shared component modifications
- New pg-driver tests must use the skipIfNoDirectUrl guard pattern from race-guard.test.ts
- Buffer logic is account-scoped and read-time only; v1.4 does not change it
- Option B (trigger) is fallback only; Option A (EXCLUDE) is primary

---

## Implications for Roadmap

### Suggested Phase Structure (3 phases: 25, 26, 27)

---

**Phase 25 -- Surgical Polish (AUTH-21/22, OWNER-14, OWNER-15)**

- **Rationale:** Pure UI fixes with no data-layer dependencies. All three items are per-instance className changes in auth-hero.tsx and home-calendar.tsx. Zero migration risk. Parallel-safe with Phase 26.
- **Delivers:** Auth pages without NSI pill branding; home calendar selected-day in NSI blue; home calendar renders without overflow at 375px.
- **Pitfalls to avoid:** V14-mp-01 (no overflow-x-auto), V14-mp-02 (auth-hero.tsx:27-31 only), V14-mp-03 (bg-primary token, not hex)
- **Research flag:** NONE -- all fix locations precisely identified

---

**Phase 26 -- Bookings Page Crash Debug (BOOK-01/02)**

- **Rationale:** Production page actively broken. Independent of all constraint work. Diagnosis-first: Vercel server logs -> reproduce in SQL Editor -> fix confirmed root cause only.
- **Delivers:** /app/bookings loads without crashing; event_types join edge case handled.
- **Pitfalls to avoid:** V14-MP-04 (diagnostic-first; no speculative null guards before root cause confirmed)
- **Research flag:** LOW -- debug path well-defined; root cause narrowed to event_types join normalization or RLS artifact in _lib/queries.ts:85-92

---

**Phase 27 -- Slot Correctness (SLOT-01..05)**

- **Rationale:** Headline item; highest risk due to DB migration. All mechanism decisions locked -- execution is the remaining work. No dependency on Phase 25 or 26.
- **Internal sequence (hard order):**
  1. Run pre-flight diagnostic SQL (zero rows required before proceeding)
  2. Apply single migration: CREATE EXTENSION IF NOT EXISTS btree_gist -> ADD COLUMN during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, half-open)) STORED -> ADD CONSTRAINT bookings_no_account_cross_event_overlap EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status = confirmed)
  3. Add 23P01 branch in app/api/bookings/route.ts before the 23505 branch; break retry loop; return 409 CROSS_EVENT_CONFLICT
  4. Add 23P01 -> slot_taken branch in lib/bookings/reschedule.ts
  5. Write tests/cross-event-overlap.test.ts: basic block, group-booking regression, adjacent-slot non-collision
- **Delivers:** DB-layer account-scoped overlap enforcement; cross-event concurrent bookings rejected at INSERT; reschedule to conflicting slot returns 409; full test coverage.
- **Pitfalls to avoid:** V14-CP-01 through V14-CP-07, V14-MP-01, V14-MP-02, V14-MP-05 (see PITFALLS.md)
- **Research flag:** NONE -- DDL live-verified; error codes confirmed; test pattern in race-guard.test.ts

---

**Cross-Phase Notes**

- Phase 25 and Phase 26 are **parallel-safe**: assign to separate sub-tasks or run in either order.
- Phase 27 is **independent of both**: does not depend on polish or crash fix landing first.
- If Phase 26 root cause is schema-related (unlikely), re-evaluate before running Phase 27 migration.
- The Looks Done But Isnt checklist in PITFALLS.md (10 items) is the Phase 27 acceptance gate.

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Constraint DDL | HIGH | Live-verified against production Postgres 17.6.1; all behavioral cases confirmed |
| Group-booking coexistence | HIGH | PITFALLS.md and FEATURES.md agree; event_type_id WITH <> semantics verified |
| Reschedule coexistence | HIGH | ARCHITECTURE.md confirmed UPDATE-in-place via direct code inspection |
| Error mapping | HIGH | Error codes confirmed; exact line numbers in route.ts identified |
| Migration apply path | HIGH | Established pattern from existing migrations |
| BOOK-01/02 root cause | MEDIUM | Narrowed to event_types join; exact cause requires Vercel log inspection |
| Phase 25 fix locations | HIGH | Exact file + line identified for all three items |
| Test architecture | HIGH | race-guard.test.ts template established; pattern is copy-adapt |

**Overall confidence: HIGH**

**Gaps to address during execution (not blockers for planning):**

1. Pre-flight diagnostic may reveal existing violations -- operational step, not a design uncertainty.
2. BOOK-01/02 exact stack trace not yet read -- Phase 26 starts with Vercel log inspection.
3. If table size warrants it, NOT VALID + VALIDATE CONSTRAINT two-step may be used (V14-CP-05) -- constraint definition is unchanged either way.

---

## Sources

Research files synthesized:
- .planning/research/STACK.md -- live DDL verification, error codes, migration pattern
- .planning/research/FEATURES.md -- behavioral invariants, coexistence requirements, fix locations
- .planning/research/ARCHITECTURE.md -- component boundaries, reschedule mechanics, phase ordering
- .planning/research/PITFALLS.md -- critical/moderate/minor pitfalls, acceptance checklist

Codebase references (read during research):
- app/api/bookings/route.ts:212-249 -- INSERT retry loop and error handling
- lib/bookings/reschedule.ts -- UPDATE-in-place reschedule mechanism
- lib/slots.ts:203-219 -- account-scoped slot conflict detection (display layer)
- app/api/slots/route.ts:138-143 -- confirmed bookings query (account-scoped)
- tests/race-guard.test.ts -- pg-driver test template and skip-guard pattern
- supabase/migrations/20260428130002_phase11_*.sql -- CONCURRENTLY migration pattern
- app/(shell)/app/_components/home-calendar.tsx -- DayButton className structure
- app/(auth)/_components/auth-hero.tsx -- NSI pill element location
- _lib/queries.ts:85-92 -- queryBookings join and normalization