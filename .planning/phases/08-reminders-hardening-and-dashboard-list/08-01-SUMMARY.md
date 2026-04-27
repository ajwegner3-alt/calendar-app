---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-01"
subsystem: schema
tags: [supabase, migration, postgres, reminders, hardening, dashboard]
requires:
  - "01 (initial schema — accounts, event_types, bookings tables)"
  - "06 (rate_limit_events migration; this plan's timestamp slots immediately after)"
provides:
  - "accounts.reminder_include_custom_answers / reminder_include_location / reminder_include_lifecycle_links (boolean NOT NULL DEFAULT true)"
  - "event_types.location (text, nullable)"
  - "bookings.owner_note (text, nullable)"
affects:
  - "08-04 reminder cron + immediate send (reads accounts toggles, event_types.location)"
  - "08-05 reminder settings + event location UI (writes accounts toggles, event_types.location)"
  - "08-07 bookings detail extension (reads/writes bookings.owner_note)"
tech-stack:
  added: []
  patterns:
    - "additive idempotent migration (ADD COLUMN IF NOT EXISTS) — safe to re-apply"
    - "boolean toggles default true to preserve existing Phase 5/6 email behavior on backfill"
key-files:
  created:
    - "supabase/migrations/20260427120001_phase8_schema_additions.sql"
  modified: []
decisions:
  - "Migration timestamp 20260427120001 (one second after rate_limit_events) sorts after every Phase 1-7 migration without colliding"
  - "All three reminder toggles default true so existing nsi row matches today's confirmation-email behavior immediately (no UI step required to keep current behavior)"
  - "event_types.location and bookings.owner_note are nullable text — NULL means 'not set'. No defaults; downstream consumers handle null gracefully"
  - "No indexes added — none of the new columns are filter predicates in v1 (location renders in email body, owner_note read on detail page, toggles join via existing FK)"
  - "RLS untouched — Phase 1 policies on accounts/event_types/bookings cover the new columns by inheritance"
  - "supabase db push --linked failed with 'Remote migration versions not found in local migrations directory' (same drift issue from Phase 3); fell back to `supabase db query --linked -f` per the locked Plan 03-01 / 05-01 / 06-01 pattern. Same Management API path; fully equivalent."
  - "No generated TypeScript types file exists in the repo (lib/supabase/ contains admin/client/proxy/server only). Type regeneration step skipped per plan instructions."
metrics:
  duration: "~5 minutes"
  completed: "2026-04-26"
---

# Phase 08 Plan 01: Schema Additions Summary

**One-liner:** Three additive ALTER TABLE statements add per-account reminder content toggles, per-event-type location, and per-booking owner notes to the live DB so Wave 2 plans can compile and integrate.

## What was built

Single additive migration applied to the live Supabase project (`mogfnutxrrbtvnaupoun`):

- `accounts.reminder_include_custom_answers boolean NOT NULL DEFAULT true`
- `accounts.reminder_include_location boolean NOT NULL DEFAULT true`
- `accounts.reminder_include_lifecycle_links boolean NOT NULL DEFAULT true`
- `event_types.location text NULL`
- `bookings.owner_note text NULL`

Each column has a `COMMENT ON COLUMN` that documents its purpose for future plan authors.

## Migration details

**File:** `supabase/migrations/20260427120001_phase8_schema_additions.sql`

**Timestamp rationale:** `20260427120001` is exactly one second after the prior migration (`20260427120000_rate_limit_events.sql` from Plan 06-01). This guarantees lexical sort order matches application order, which is what Supabase's migration tooling and CI both rely on. Picking the next-second slot also keeps the YYYYMMDDhhmmss convention used everywhere else in this repo.

**Idempotency:** Every column uses `ADD COLUMN IF NOT EXISTS`. Re-applying the migration is a no-op — important because `supabase db query --linked -f` does not consult the supabase_migrations.schema_migrations tracking table (it just executes the SQL directly).

## Live DB verification

`information_schema.columns` query against the linked remote DB returned exactly 5 rows:

| table_name  | column_name                       | data_type | column_default | is_nullable |
|-------------|-----------------------------------|-----------|----------------|-------------|
| accounts    | reminder_include_custom_answers   | boolean   | true           | NO          |
| accounts    | reminder_include_lifecycle_links  | boolean   | true           | NO          |
| accounts    | reminder_include_location         | boolean   | true           | NO          |
| bookings    | owner_note                        | text      | (null)         | YES         |
| event_types | location                          | text      | (null)         | YES         |

Existing-row backfill confirmed against both seeded accounts (`nsi` and `nsi-test`):

```
slug      | reminder_include_custom_answers | reminder_include_location | reminder_include_lifecycle_links
----------+---------------------------------+---------------------------+----------------------------------
nsi-test  | true                            | true                      | true
nsi       | true                            | true                      | true
```

Both rows adopted the `DEFAULT true` automatically — no UI step required to preserve Phase 5/6 confirmation-email behavior.

## Generated types regeneration

**Outcome:** Skipped.

The plan instructed to regenerate `lib/supabase/database.types.ts` if it existed. It does not exist in this repo — `lib/supabase/` contains only `admin.ts`, `client.ts`, `proxy.ts`, `server.ts`. Phase 1-7 used inline TypeScript types per call site (no central generated types file). Wave 2 plans that need typed access to the new columns can either continue the inline-type pattern or introduce a generated types file as part of their own scope.

## Caveats & deviations

### Deviation: `supabase db push --linked` failed; used db query fallback (Rule 3 — blocking issue, auto-fixed)

`npx supabase db push --linked` returned:

```
Remote migration versions not found in local migrations directory.
Make sure your local git repo is up-to-date. If the error persists, try repairing the migration history table:
supabase migration repair --status reverted 20251223162516 20260419144234 20260419144302
```

This is the same drift between the Supabase migrations history table and our local `supabase/migrations/` folder that Plans 03-01, 05-01, and 06-01 all hit. The locked workaround (per STATE.md Plan 03-01 + 05-01 + 06-01 decisions) is to bypass `db push` and apply the SQL directly via `supabase db query --linked -f <file>`. Same Management API; same outcome.

Used:

```bash
npx supabase db query --linked -f supabase/migrations/20260427120001_phase8_schema_additions.sql
```

Output: `{"boundary": "...", "rows": []}` — empty rows is the expected result for ALTER statements (no SELECT output). Verified post-apply via `information_schema.columns` (table above).

**Tracking note:** This is now the fourth migration that needed the fallback. The repair command suggested by Supabase CLI is intentionally NOT run (would need to verify the three orphan timestamps are truly safe to mark reverted; not in scope for a schema-additions plan). Phase 8 hardening could add a "fix migrations drift" task if the friction continues.

No other deviations.

## Authentication gates

None. Supabase CLI was already linked from prior phases; no auth prompt encountered.

## Test status

`npm test` — **80 passed (80)** across 9 test files. No regressions introduced (additive columns cannot break existing reads/writes that don't reference them).

## Commits

- `aa6ac14` — `feat(08-01): add phase 8 schema columns (reminder toggles + location + owner_note)`

## Forward contracts (locks for downstream plans)

- **08-04 reminder cron** — Selects from `accounts` MUST include the three new boolean toggles when joining to bookings. Reading `accounts.reminder_include_*` returns `true` for any pre-Phase-8 account row, which means Phase 5/6 behavior is preserved by default.
- **08-04 reminder cron** — Selects from `event_types` MUST include `location`. Treat `null` as "no location set" → omit the location block from the reminder email regardless of the per-account toggle.
- **08-05 settings UI** — Writes to `accounts.reminder_include_*` MUST send `true`/`false`, never `null` (column is NOT NULL). The UI default for an unset checkbox is `true`.
- **08-05 settings UI** — Writes to `event_types.location` should normalize empty string to `null` (consistent with how the rest of the codebase treats blank text fields; e.g. Plan 04-04's daily_cap pattern).
- **08-07 bookings detail extension** — Reads from `bookings` MUST include `owner_note`; writes set the column directly. Empty string → `null` at the action boundary (same convention).

## Next phase readiness

Ready to start Wave 2 plans (08-04, 08-05, 08-07) in parallel. No blockers for downstream work.
