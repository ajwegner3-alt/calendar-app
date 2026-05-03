# Phase 27: Slot Correctness (DB-Layer Enforcement) - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the contractor-can't-be-in-two-places-at-once invariant at the database layer. Add an account-scoped EXCLUDE constraint that rejects overlapping confirmed bookings across different event types, plus the application-layer error mapping (Postgres `23P01` → HTTP 409 `CROSS_EVENT_CONFLICT`) and tests proving constraint + mapping behave correctly.

DDL, error code, internal task sequence, and pitfalls are LOCKED by research (see ROADMAP.md Phase 27 + `.planning/research/PITFALLS.md` V14-CP-01..07, V14-MP-01..02, V14-MP-05). This phase clarifies the surrounding work: booker UX, test depth, plan structure, smoke runbook, migration safety posture, and observability.

</domain>

<decisions>
## Implementation Decisions

### Booker-facing 409 UX

- **Mirror existing `slot_taken` flow** — same client-side handling, same auto-refresh-and-retry behavior. No new UI surface.
- **Generic message wording** — booker sees an "unavailable" / "just taken" style message. Do NOT hint that the contractor has another appointment or reference event types. Booker has no concept of event types and the leak would feel wrong.
- **Recovery path** — whatever `slot_taken` does today, do the same for `CROSS_EVENT_CONFLICT`. Exact wording, refresh behavior, and inline-vs-toast presentation are Claude's discretion during planning.

### Test coverage

Roadmap baseline (3 tests): cross-event block, group-booking regression, adjacent-slot non-collision.

Add (3 more — required):

- **Cancelled-bookings-don't-block test** — proves the partial `WHERE (status = 'confirmed')` predicate works. Regression guard against future migrations dropping the WHERE clause.
- **Reschedule cross-event collision test** — distinct from the route.ts test. Covers the `lib/bookings/reschedule.ts:149` path (V14-MP-02) on its own. Two code paths catch 23P01 → two tests.
- **Retry-loop-break test** — explicitly asserts that 23P01 in `app/api/bookings/route.ts` BREAKS the retry loop and does NOT increment `slot_index` (V14-MP-01). Prevents future refactors from re-introducing infinite retries.

**Minimum test count: 6.** Claude may add more during planning if gaps emerge.

### Migration safety posture

- **Row-count-gated migration choice** — plan reads production `bookings` row count first. Threshold: `<10k rows` → single-step `ADD CONSTRAINT`; `≥10k` → `NOT VALID` + separate `VALIDATE CONSTRAINT`. Plan documents the actual count and the chosen path.
- **Pre-flight diagnostic is a HARD GATE** (V14-CP-06): default protocol if it returns non-zero rows is HALT + surface offending rows for Andrew's manual review. Do NOT auto-cancel bookings programmatically. Plan picks exact halt UX.
- **Rollback plan** — Claude's discretion in plan-phase. Default: ship explicit `DROP CONSTRAINT` / `DROP COLUMN` reverse-SQL snippet alongside the forward migration so partial-state recovery is one paste away.

### Observability

- **Log 23P01 occurrences** — distinct log signal so we can monitor real cross-event collisions in production. Lightweight (Vercel server logs, no Sentry). Exact log shape (level, fields, identifiers) is Claude's discretion during planning. Default: `console.error` with `code`, `account_id`, `event_type_id` — no PII.

### Plan breakdown + smoke runbook

- **Plan count and split** — Claude's discretion (2 or 3 plans). Roadmap drafted 2; if pre-flight or smoke materially expand, split to 3.
- **Production smoke method** — Claude's discretion. Plan-phase produces the runbook. Should give Andrew a step-by-step that confirms 4xx with `CROSS_EVENT_CONFLICT` code on a real overlap attempt.
- **Smoke cleanup** — Claude's discretion. Default: prefer running smoke against an existing seeded test account (`nsi-rls-test` or `nsi-rls-test-3`) so cleanup is unnecessary; provide a fallback SQL/cancel snippet if smoke must run on a live account.

### Claude's Discretion

- Exact wording of the 409 message string (constraint: generic, no event-type leak).
- Inline vs toast vs modal presentation of the 409 in the booker widget.
- Whether to write tests at pg-driver level (race-guard pattern), API-integration level, or both.
- Plan split (2 vs 3) and where to cut between migration / error mapping / tests / smoke.
- Pre-flight halt UX (Andrew already knows the default is "halt + surface rows").
- Rollback SQL exact form.
- Log shape for 23P01 events.
- Production smoke runbook format and chosen account.

</decisions>

<specifics>
## Specific Ideas

- **Pattern reference: `tests/race-guard.test.ts`** — V14-MP-05 already mandates the `describe.skipIf(skipIfNoDirectUrl)` pattern for any pg-driver tests. Use this idiom verbatim for new constraint-level tests.
- **Pattern reference: `slot_taken` in `lib/bookings/reschedule.ts`** — existing 409 mapping precedent. New `CROSS_EVENT_CONFLICT` mapping should sit beside it (V14-MP-02 calls out line 149).
- **Pattern reference: existing 23505 retry loop in `app/api/bookings/route.ts`** — new 23P01 branch goes BEFORE the 23505 branch and breaks the loop without incrementing `slot_index` (V14-MP-01).
- **Smoke posture** — Andrew prefers manual UI verification on real production with a real test account over synthetic curl-only flows (per Phase 26 sign-off pattern). Plan should produce a runbook he can execute step-by-step.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Phase boundary (DB-layer cross-event overlap enforcement + error mapping + tests + smoke) was respected throughout.

Note: deferred fragilities from Phase 26 (`bookings-table.tsx:37` unguarded `TZDate`, `queries.ts:92-94` normalization `undefined`, `queries.ts:86` unguarded throw, `load-month-bookings.ts:47` !inner audit) remain on the future-hardening list but are NOT in scope for Phase 27. They are tracked in `.planning/STATE.md` "Decisions from Phase 26".

</deferred>

---

*Phase: 27-slot-correctness-db-layer-enforcement*
*Context gathered: 2026-05-03*
