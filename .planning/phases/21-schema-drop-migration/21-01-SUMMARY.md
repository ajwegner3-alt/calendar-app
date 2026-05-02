---
phase: 21-schema-drop-migration
plan: 01
subsystem: database
tags: [supabase, migration, schema, drop, branding, v12-close]

# Dependency graph
requires:
  - phase: 20-dead-code-test-cleanup
    provides: "Zero runtime reads of the 4 deprecated columns; CP-01 grep-zero satisfied"
  - phase: 19-email-layer-simplification
    provides: "Email layer no longer references background_shade / chrome_tint_intensity"
provides:
  - "4 deprecated accounts columns permanently dropped from production Postgres (sidebar_color, background_color, background_shade, chrome_tint_intensity)"
  - "2 ENUM types (background_shade, chrome_tint_intensity) permanently dropped"
  - "v1.2 milestone schema-cleanup closed; ready for /gsd:complete-milestone"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step deploy + 30-min drain protocol (CP-03) — first production application of the v1.2-locked workflow"
    - "Held local commit during drain to avoid timer reset; pushed only after migration apply success"
    - "db query --linked -f workaround for projects with orphan migration timestamps in remote tracking table (PROJECT.md §200 lock)"

key-files:
  created:
    - "supabase/migrations/20260502034300_v12_drop_deprecated_branding_columns.sql"
    - "supabase/migrations/20260502034301_readd_deprecated_branding.sql.SKIP"
    - ".planning/phases/21-schema-drop-migration/21-01-SUMMARY.md"
  modified:
    - "FUTURE_DIRECTIONS.md"

key-decisions:
  - "Apply method: db query --linked -f (CONTEXT.md error corrected at planning; PROJECT.md §200 lock honored)"
  - "DB-04 satisfied via IF EXISTS + BEGIN/COMMIT + DO $$ RAISE NOTICE header (grep precondition cannot be expressed in SQL)"
  - "Re-add .SKIP authored, NOT applied (forward-only rollback posture per locked decision #6)"
  - "Smoke booking deleted post-confirmation to keep Andrew's bookings dashboard clean (locked decision #11)"
  - "FUTURE_DIRECTIONS.md §8.4 two old bullets replaced with single strikethrough closure bullet (today 2026-05-02)"

patterns-established:
  - "v1.2 schema-DROP runbook: CP-01 grep gate + tsc + pg_type pre-flight → >= 30-min drain checkpoint → atomic BEGIN/COMMIT migration via db query -f → 3-query post-verification → real production smoke test → cleanup"

# Metrics
duration: ~16h (spread across 2026-05-01 to 2026-05-02; ~45 min active execution; remainder was mandatory 30-min drain + overnight smoke test window)
completed: 2026-05-02
---

# Phase 21 Plan 01: Schema DROP Migration Summary

**Permanently dropped 4 deprecated `accounts` columns (sidebar_color, background_color, background_shade, chrome_tint_intensity) + 2 ENUM types via atomic BEGIN/COMMIT migration applied through the locked db query --linked workaround; production smoke test passed confirming end-to-end booking flow intact.**

## Performance

- **Duration:** ~16 hours wall-clock (2026-05-01 22:22 CDT to 2026-05-02 ~09:00 CDT); ~45 min active execution; remainder was mandatory 30-min drain + overnight checkpoint
- **Started:** 2026-05-01T22:22:46-05:00 (final main push = drain reference point; migration authored shortly before)
- **Completed:** 2026-05-02T14:09:48+00:00 (smoke booking created = smoke test complete; cleanup + SUMMARY = ~14:30 UTC)
- **Tasks:** 6 (Tasks 1-5 by prior executor; Task 6 by continuation executor)
- **Files modified:** 4 (2 new migration files + FUTURE_DIRECTIONS.md + this SUMMARY)

## Accomplishments

- All 3 pre-flight gates PASSED: CP-01 grep (2 comment-only files only), tsc clean, pg_type confirmed both ENUMs present
- Authored atomic DROP migration (4 columns + 2 ENUM types in BEGIN/COMMIT block) and inert .SKIP rollback artifact
- Satisfied the ≥30-min CP-03 drain: drain start 2026-05-01T22:22:46-05:00 (Phase 20 `bc2a341` push), drain end confirmed morning of 2026-05-02 — no mid-drain push, >>30 min elapsed
- Applied migration via `db query --linked -f`; 3-query post-verification all clean (0 rows for negative checks, `\d accounts` shows positive surface)
- Production smoke test PASSED: booking on `https://calendar-app-xi-smoky.vercel.app/nsi/30-minute-consultation`, confirmation email received, header band `#0A2540` matched `accounts.brand_primary`
- Smoke booking deleted (id `7c2fbde1-78c6-4aa0-8d91-309984ecc5a7`, RETURNING confirmed)
- FUTURE_DIRECTIONS.md §8.4 two old backlog bullets replaced with single strikethrough closure entry

## Task Commits

This plan used a 2-commit structure:

1. **Tasks 1-2:** Pre-flight gates + migration authoring — `ca1f357` feat(21): author DROP migration + inert rollback artifact
2. **Tasks 3-6:** Drain + apply + smoke + cleanup + SUMMARY + §8.4 — `docs(21): close v1.2 schema cleanup — DROP migration applied + smoke passed` (this commit)

Tasks 3 and 5 were `checkpoint:human-action` and `checkpoint:human-verify` respectively — no commits. Tasks 4 and 6 piggybacked on the above two commits.

## Pre-flight Gate Outputs

### Gate A — CP-01 grep re-verification (DB-01)

```
git grep -l "sidebar_color\|background_color\|background_shade\|chrome_tint_intensity" -- "*.ts" "*.tsx" ":!supabase/migrations/*"
```

Output: exactly 2 files:
- `app/(shell)/layout.tsx`
- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx`

Per-file line grep confirmed all hits are comment lines (JSDoc / inline comments). No runtime reads. Gate A: **PASSED**.

### Gate B — TypeScript compile (DB-02)

```
npx tsc --noEmit
```

Exit code 0. Only pre-existing `TS7006`/`TS2305` baseline errors in `tests/` directory (out of scope per CONTEXT.md — same baseline as Phase 20 close). Gate B: **PASSED**.

### Gate C — ENUM existence verification

```
SELECT typname FROM pg_type WHERE typname IN ('background_shade','chrome_tint_intensity') ORDER BY typname;
```

Output: 2 rows (`background_shade`, `chrome_tint_intensity`). Both ENUMs confirmed present in DB before migration. Gate C: **PASSED**.

## Drain Log

- **Drain reference point:** Phase 20 final push `bc2a341` on `2026-05-01T22:22:46-05:00` (UTC: `2026-05-02T03:22:46+00:00`)
- **Task 2 commit `ca1f357` held LOCAL** during drain — not pushed until after Task 4 apply success, to avoid resetting the timer
- **Drain end:** Andrew typed `drained` on morning of 2026-05-02; wall-clock elapsed >>30 minutes (overnight)
- **Mid-drain push:** None confirmed. `git log origin/main --since="<drain-start>"` showed no new commits before migration apply
- **CP-03 compliance:** SATISFIED

## Migration Apply Log

```
npx supabase db query --linked -f supabase/migrations/20260502034300_v12_drop_deprecated_branding_columns.sql
```

CLI output (captured by prior executor Task 4):
- NOTICE: `Phase 21 DROP migration starting: 4 columns + 2 ENUM types`
- Transaction committed successfully — no errors

## Post-Migration Verification Queries

### Query 1 — Verify columns are gone

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='accounts'
  AND column_name IN ('sidebar_color','background_color','background_shade','chrome_tint_intensity');
```

Result: `rows: []` — **0 rows. PASSED.**

### Query 2 — Verify ENUM types are gone

```sql
SELECT typname FROM pg_type
WHERE typname IN ('background_shade','chrome_tint_intensity');
```

Result: `rows: []` — **0 rows. PASSED.**

### Query 3 — Positive surface check

```
\d accounts
```

Result: column list contains `brand_primary`, `logo_url`; none of the 4 dropped column names present. **PASSED.**

## Smoke Test Record

| Field | Value |
|---|---|
| Booking URL | `https://calendar-app-xi-smoky.vercel.app/nsi/30-minute-consultation` |
| Event slug | `30-minute-consultation` |
| Booking date | 2026-05-02 |
| Booking start_at | `2026-05-06 14:00:00+00` (scheduled slot) |
| Booker email | `ajwegner3@gmail.com` |
| Created at (UTC) | `2026-05-02 14:09:48.886265+00` |
| NSI `brand_primary` | `#0A2540` (dark navy — Andrew confirmed live) |
| Observed header band color | `#0A2540` — matched `accounts.brand_primary` |
| Booking page render | No 500 errors |
| Confirmation email | Arrived in inbox; header band rendered correctly |
| **Verdict** | **PASSED** |

## Smoke Booking Cleanup

```sql
DELETE FROM bookings WHERE id = '7c2fbde1-78c6-4aa0-8d91-309984ecc5a7'
RETURNING id, booker_email, created_at;
```

RETURNING result: 1 row deleted — `id: 7c2fbde1-78c6-4aa0-8d91-309984ecc5a7`, `booker_email: ajwegner3@gmail.com`, `created_at: 2026-05-02 14:09:48.886265+00`. Bookings dashboard clean.

## §8.4 Closure

FUTURE_DIRECTIONS.md §8.4 updated: two pre-existing backlog bullets (DROP `chrome_tint_intensity` column, remove `chromeTintToCss` compat export) replaced with single strikethrough closure entry:

> ~~**DROP `accounts.chrome_tint_intensity` column** + companion ENUM type, plus DROP `accounts.sidebar_color`, `accounts.background_color`, `accounts.background_shade` (column + ENUM type). Plus removal of `lib/branding/chrome-tint.ts` and `chromeTintToCss` compat export.~~ **CLOSED v1.2 Phase 21** (2026-05-02). Phase 20 commit `8ec82d5` removed the runtime reads + dead code; Phase 21 migration `20260502034300_v12_drop_deprecated_branding_columns.sql` permanently dropped the 4 columns + 2 ENUM types.

## Files Created/Modified

**Created (3 files):**
- `supabase/migrations/20260502034300_v12_drop_deprecated_branding_columns.sql` — Atomic DROP migration: 4 columns + 2 ENUM types in single BEGIN/COMMIT; IF EXISTS guards everywhere; applied via `db query --linked -f`
- `supabase/migrations/20260502034301_readd_deprecated_branding.sql.SKIP` — Inert rollback artifact; `.SKIP` extension excludes from migration runner; recreates 4 columns + 2 ENUMs in original Phase 12/12.5/12.6 shape if ever needed
- `.planning/phases/21-schema-drop-migration/21-01-SUMMARY.md` — This file

**Modified (1 file):**
- `FUTURE_DIRECTIONS.md` — §8.4: two old backlog bullets replaced with single strikethrough closure entry

## Decisions Made

1. **Apply method `db query --linked -f` (not `db push`):** PROJECT.md §200 lock — `db push` is broken in this repo due to orphan timestamps in remote migration tracking table. The locked workaround is `db query --linked -f <file>`.

2. **DB-04 defensive check in pre-flight, not in SQL:** CP-01 grep is a filesystem operation that cannot be expressed in Postgres SQL. Defensive intent satisfied by: (a) `IF EXISTS` guards on every DROP, (b) `BEGIN/COMMIT` atomicity, (c) `DO $$ RAISE NOTICE` header for log clarity, (d) Task 1 pre-flight gates run before any SQL.

3. **Rollback artifact .SKIP approach (forward-only posture):** `.SKIP` extension means Supabase migration runner never auto-applies the rollback file. To activate: rename to `.sql`, apply manually. This keeps the rollback instructions on disk without risking accidental application.

4. **Smoke booking deleted:** Leaving a test booking in Andrew's production account clutters the `/app/bookings` dashboard. Narrow DELETE scoped by `id` (confirmed via prior SELECT) — exactly 1 row deleted.

5. **FUTURE_DIRECTIONS.md §8.4 strikethrough pattern:** Strikethrough bullet preserves the source-attribution audit trail (what was planned, why it was deferred) while reflecting v1.2 closure. Same pattern used for other completed items in FUTURE_DIRECTIONS.md.

## Deviations from Plan

None — plan executed exactly as written across Tasks 1-6. The two-step structure (prior executor Tasks 1-5, continuation executor Task 6) worked cleanly: `ca1f357` commit was already present on origin/main when Task 6 began, and the smoke test details were passed verbatim through the checkpoint context.

## Issues Encountered

None. All gates passed, migration applied cleanly, smoke test passed on first attempt, booking DELETE returned exactly 1 row.

## v1.2 Milestone Readiness

**Phase 21 COMPLETE. v1.2 milestone ready for close-out.**

Schema cleanup fully executed:
- Phase 20: zero runtime reads + dead code deleted (commit `8ec82d5`)
- Phase 21: 4 columns + 2 ENUM types permanently dropped from production Postgres

All 8 `must_haves.truths` satisfied:
1. Pre-flight grep returns only 2 comment-only files (DB-01) — PASS
2. tsc --noEmit exits 0 (DB-02) — PASS
3. >= 30 minutes drain elapsed (DB-03) — PASS (>>30 min, overnight)
4. Migration applied; accounts table no longer has the 4 dropped columns (DB-05..DB-08, DB-10) — PASS
5. Both ENUM types removed from pg_type (DB-07, DB-08, DB-10) — PASS
6. Production booking on NSI succeeds, no 500 errors (DB-10) — PASS
7. Confirmation email arrived with correct header band color `#0A2540` (DB-10) — PASS
8. FUTURE_DIRECTIONS.md §8.4 closed out (DB-11) — PASS

**Operator next step:** `/gsd:audit-milestone` (full v1.2 audit pass) OR `/gsd:complete-milestone` (skip audit, archive directly). Andrew chooses.

---
*Phase: 21-schema-drop-migration*
*Completed: 2026-05-02*
