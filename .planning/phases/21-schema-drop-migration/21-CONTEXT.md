# Phase 21: Schema DROP Migration - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Permanently drop 4 deprecated `accounts` columns (`sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity`) and any associated Postgres ENUM types via the v1.2-locked two-step deploy protocol (code-stop-reading deploy ✓ already shipped via Phase 20 atomic commit `8ec82d5`; mandatory ≥30-min Vercel function drain; then DROP migration SQL). Then update `FUTURE_DIRECTIONS.md` §8.4 to close the v1.2 backlog items.

Phase 20 satisfied the CP-01 grep-zero precondition (verified by Phase 20 verifier 5/5 must-haves). Phase 21 is the LAST phase of v1.2 and ships the milestone.

</domain>

<decisions>
## Implementation Decisions

### Migration mechanics & ENUM coverage
- **SQL authoring:** `npx supabase migration new drop_deprecated_branding_columns` — generate a timestamped migration file in `supabase/migrations/` so the change is version-tracked alongside prior migrations.
- **Idempotency:** Use `DROP COLUMN IF EXISTS` and `DROP TYPE IF EXISTS` guards on every drop. The migration must run safely even if a column or type was previously removed (e.g., when re-running on a staging branch).
- **ENUM discovery:** Pre-flight `\dT` query (via Supabase MCP `execute_sql` against `pg_type` / `information_schema`) during research/planning to enumerate which deprecated columns were actually created as ENUMs. Migration only emits `DROP TYPE` for types that exist. Both `background_shade` and `chrome_tint_intensity` are candidates per ROADMAP.md MP-05.
- **Apply method:** `npx supabase db push --linked` against the linked production project. Standard repo flow; no dashboard SQL editor unless `db push` fails.
- **Transaction wrapping:** Explicit `BEGIN; ... COMMIT;` block around all DROPs (4 columns + up to 2 ENUM types). Atomic — either everything drops or nothing does. Postgres DDL is transactional; this is a defense-in-depth lock against partial state.

### 30-min drain protocol
- **Enforcement:** Phase 21 plan has `autonomous: false` with a checkpoint task between the pre-flight gates and the DROP migration. Agent halts after pre-flight, reports the drain start time (UTC + local), and resumes only when Andrew types `drained` (after ≥30 min wall-clock).
- **Mid-drain push handling:** **Restart the timer.** Any push to `main` during the drain window resets the 30-min clock — the new code might still be reading deprecated columns until grep-verified again. Conservative; protects against accidental regression.
- **Wait activity:** Andrew is free during the drain. The checkpoint mechanism returns control; Andrew can step away. No active Vercel log monitoring required (Phase 20 verifier already confirmed code is read-clean).

### Smoke test scope
- **Depth:** Full booking + email + correct color verification on production. Andrew submits a real booking on `https://calendar-app-xi-smoky.vercel.app/nsi/<event-slug>`, confirms the confirmation email arrives in his inbox, and verifies the header band renders `#3B82F6` (NSI blue-500 from `brand_primary`). This matches ROADMAP.md success criterion 5.
- **Account coverage:** Single account (NSI) is sufficient — the DROP is schema-wide; if NSI works, account-specific differentiation already proved itself in Phase 17/18/19 verifications.
- **Failure response:** **Halt + diagnose, then forward-fix.** On smoke failure, the plan stops. No automatic rollback. The columns are gone after a successful DROP, so any "fix" is a forward code change, not a re-add (unless the diagnosis specifically calls for re-adding — see Rollback below).
- **Completion gate:** Phase 21 closes immediately after the smoke test passes. No 24-hour soak. Matches the v1.2 cadence (every prior v1.2 phase closed same-day after Andrew approval).

### Rollback posture
- **Posture:** Forward-only. No pre-emptive Supabase PITR backup or pre-DROP `accounts_backup` table snapshot. The transactional `BEGIN/COMMIT` wrapper ensures Postgres rolls itself back if any DROP statement fails mid-transaction. Phase 20's grep-zero precondition + the 30-min drain make code-side regression highly unlikely.
- **Re-add migration as deferred artifact:** Plan includes authoring (but NOT running) a templated re-add migration file at `supabase/migrations/<timestamp>_readd_deprecated_branding.sql.SKIP` — covers re-adding all 4 columns + 2 ENUM types in their original shape. The `.SKIP` extension keeps it inert (Supabase migration runner ignores non-`.sql` files). Renamed/run only if smoke fails AND diagnosis determines the columns are needed for recovery.

### Claude's Discretion
- Exact SQL syntax for the DROP statements (column order, comment block format) — Claude follows existing `supabase/migrations/` conventions discovered during research.
- Migration filename timestamp format (Supabase CLI generates this automatically).
- The `\dT` pre-flight discovery query phrasing — Claude writes the most direct `pg_type` / `information_schema.columns` JOIN.
- Smoke test event-slug selection (any active NSI event type works; Claude picks the one most likely to surface end-to-end issues).
- Whether to delete the test booking after smoke or leave it as evidence (Claude decides based on whether the booking would be visible to real users).
- Phase 21 SUMMARY structure — follows the v1.2 atomic-phase template (Phase 19 / 20 precedent).

</decisions>

<specifics>
## Specific Ideas

- **Reference precedent:** Phase 19 atomic commit `0130415` and Phase 20 atomic commit `8ec82d5` are the immediate templates for "single atomic commit, no intermediate broken state" — but Phase 21 inherently splits into TWO commits (the migration file commit + the SUMMARY/state commit) because the DROP must run between them. The "atomic" property here is the DROP transaction itself, not the git history.
- **Two-step deploy locked from milestone scoping:** This phase exists *because* of the v1.2 lock #6 ("DROP migration = two-step deploy"). The 30-min drain is non-negotiable per CP-03; if a hotfix mid-drain forces a restart, accept the delay rather than skip the wait.
- **Phase 21 is the v1.2 milestone closer.** After smoke passes, the next command is `/gsd:complete-milestone` (or `/gsd:audit-milestone` first if Andrew wants the full audit pass). FUTURE_DIRECTIONS.md §8.4 update is part of *this* phase, not the milestone-complete phase.
- **Pre-flight gates fold in CP-01 from Phase 20:** The Phase 20 verifier already ran the grep-zero check, but Phase 21 must re-run it as its own pre-flight (defense-in-depth — code may have changed in the gap between Phase 20 ship and Phase 21 execution).

</specifics>

<deferred>
## Deferred Ideas

- 24-hour production soak before milestone closure — Andrew chose immediate close; if v1.3 ever introduces a riskier migration, revisit the soak pattern.
- Multi-account smoke test (NSI + magenta + emerald) — kept as Phase 13 / v1.3 manual-QA territory if a future migration touches per-account schema.
- Pre-emptive Supabase PITR backup workflow — useful for higher-risk migrations (e.g., a future schema rename); document in v1.3+ runbook if needed.
- Active Vercel log monitoring during drain — overkill for Phase 21; revisit for any future migration that touches the booking write path.

</deferred>

---

*Phase: 21-schema-drop-migration*
*Context gathered: 2026-05-01*
