---
phase: 04-availability-engine
plan: 01
subsystem: database
tags: [date-fns, react-day-picker, shadcn, supabase, migration, availability]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Initial schema including accounts table
  - phase: 03-event-types-crud
    provides: Migration convention (YYYYMMDDHHMMSS_name.sql, IF NOT EXISTS pattern)
provides:
  - date-fns@4.1.0 and @date-fns/tz@1.4.1 runtime deps installed
  - react-day-picker@9.14.0 via shadcn calendar primitive
  - components/ui/calendar.tsx (shadcn DayPicker wrapper)
  - app/globals.css day-blocked / day-custom CSS dot markers
  - supabase/migrations/20260425120000_account_availability_settings.sql applied live
  - accounts.buffer_minutes, accounts.min_notice_hours, accounts.max_advance_days, accounts.daily_cap columns on live DB
affects:
  - 04-02 (slot engine reads buffer_minutes, min_notice_hours, max_advance_days, daily_cap)
  - 04-05 (overrides UI uses Calendar component + day-blocked/day-custom CSS)

# Tech tracking
tech-stack:
  added:
    - date-fns@4.1.0 (runtime)
    - "@date-fns/tz@1.4.1 (runtime)"
    - react-day-picker@9.14.0 (runtime, via shadcn calendar)
  patterns:
    - "TZDate + tz() from @date-fns/tz for all timezone-aware date ops; formatInTimeZone NOT available (Pitfall 1)"
    - "shadcn CLI (v4.5.0) installs calendar component with react-day-picker as transitive dep"
    - "Date-marker CSS uses ::after pseudo-elements on .day-blocked / .day-custom; Plan 04-05 references by exact class name via modifiersClassNames prop"

key-files:
  created:
    - components/ui/calendar.tsx
    - supabase/migrations/20260425120000_account_availability_settings.sql
  modified:
    - package.json
    - package-lock.json
    - app/globals.css

key-decisions:
  - "date-fns ^4.1.0 + @date-fns/tz ^1.4.1 as runtime deps (NOT devDeps); both needed at runtime in /api/slots and lib/slots.ts"
  - "formatInTimeZone does NOT exist in @date-fns/tz; confirmed absent at install time (sanity guard for RESEARCH Pitfall 1)"
  - "shadcn CLI v4.5.0 used (upgraded from 4.4.0 in Phase 3); react-day-picker@9.14.0 installed as transitive dep"
  - "daily_cap nullable by design (NULL = no cap); CHECK allows NULL or >0, blocks 0 and negatives"
  - "Migration applied via supabase db query --linked -f (MCP apply_migration not needed; CLI fallback sufficient)"

patterns-established:
  - "date-fns/tz sanity check pattern: verify TZDate=function, tz=function, formatInTimeZone=undefined after install"
  - "Migration negative-test pattern: attempt an invalid write and confirm 23514 check_violation"

# Metrics
duration: 3min
completed: 2026-04-25
---

# Phase 4 Plan 01: Deps and Accounts Migration Summary

**date-fns v4 + @date-fns/tz v1 installed, shadcn Calendar component landed, and accounts table extended with 4 availability-settings columns (buffer_minutes, min_notice_hours, max_advance_days, daily_cap) verified live on Supabase**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-25T17:36:35Z
- **Completed:** 2026-04-25T17:40:10Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Installed date-fns@4.1.0 and @date-fns/tz@1.4.1 as runtime dependencies; all sanity checks pass (TZDate=function, tz=function, formatInTimeZone=undefined — RESEARCH Pitfall 1 guard confirmed)
- Installed shadcn Calendar component via CLI v4.5.0 (react-day-picker@9.14.0 as transitive dep); appended .day-blocked/.day-custom ::after dot marker CSS to globals.css
- Applied migration adding 4 availability-settings columns to accounts table; verified on live Supabase — nsi row reads (0, 24, 14, NULL); negative CHECK test (SET daily_cap=0) fails with 23514

## Task Commits

Each task was committed atomically:

1. **Task 1: Install date-fns + @date-fns/tz** - `4aaea6e` (feat)
2. **Task 2: Add shadcn calendar component and date-marker CSS** - `9759b8d` (feat)
3. **Task 3: Author + apply accounts settings migration** - `35b0656` (feat)

## Files Created/Modified

- `package.json` - Added date-fns@^4.1.0, @date-fns/tz@^1.4.1, react-day-picker (via shadcn CLI)
- `package-lock.json` - Lockfile updated for new deps
- `components/ui/calendar.tsx` - shadcn DayPicker wrapper (created by CLI v4.5.0)
- `app/globals.css` - Appended .day-blocked and .day-custom ::after dot marker rules
- `supabase/migrations/20260425120000_account_availability_settings.sql` - Idempotent ALTER TABLE adding 4 columns with CHECK constraints and COMMENT docs

## Installed Versions (resolved from npm ls)

| Package | Resolved Version |
|---------|-----------------|
| date-fns | 4.1.0 |
| @date-fns/tz | 1.4.1 |
| react-day-picker | 9.14.0 |
| shadcn CLI | 4.5.0 (upgraded from 4.4.0 in Phase 3) |

## Migration Details

- **File:** `supabase/migrations/20260425120000_account_availability_settings.sql`
- **Applied via:** `supabase db query --linked -f` (CLI fallback; supabase db query --linked confirmed equivalent to MCP)
- **Migration name:** `account_availability_settings`
- **Timestamp:** `20260425120000` (next slot after Phase 3's `20260424120000`)

## Confirmed accounts Column Shape

From `information_schema.columns` WHERE table_name = 'accounts' AND column_name IN (...):

| column_name | data_type | is_nullable | column_default |
|-------------|-----------|-------------|----------------|
| buffer_minutes | integer | NO | 0 |
| daily_cap | integer | YES | null |
| max_advance_days | integer | NO | 14 |
| min_notice_hours | integer | NO | 24 |

## Confirmed nsi Row Defaults

From `SELECT slug, buffer_minutes, min_notice_hours, max_advance_days, daily_cap FROM accounts WHERE slug = 'nsi'`:

| slug | buffer_minutes | min_notice_hours | max_advance_days | daily_cap |
|------|----------------|-----------------|-----------------|-----------|
| nsi | 0 | 24 | 14 | null |

Matches documented CONTEXT.md defaults exactly.

## Negative CHECK Test Result

`UPDATE accounts SET daily_cap = 0 WHERE slug = 'nsi'` failed with:

```
ERROR 23514: new row for relation "accounts" violates check constraint "accounts_daily_cap_check"
```

CHECK constraint is enforced correctly. (daily_cap=0 blocked; NULL and >0 allowed.)

## Decisions Made

- **date-fns/tz sanity guard at install time** — Node require() smoke verifying `formatInTimeZone === undefined` prevents the RESEARCH Pitfall 1 failure mode from silently appearing if someone installs the wrong package. Confirmed false immediately after install.
- **shadcn CLI v4.5.0** — The CLI auto-upgraded from 4.4.0 (Phase 3) to 4.5.0. No breaking changes; component output is identical. STATE.md "shadcn v4 uses radix-ui monorepo package" decision still holds (radix-ui deduped by npm).
- **Migration applied via `supabase db query --linked -f`** — The Supabase MCP `apply_migration` tool was not needed; the CLI fallback worked on first attempt. The migration file is committed under `supabase/migrations/` for portability per Phase 1/3 convention.

## Deviations from Plan

None — plan executed exactly as written. All tasks completed in sequence with all verification checks passing.

## Issues Encountered

- **`npm run lint` pre-existing error** — ESLint circular-JSON error is a known carry-forward from Phase 1 (documented in STATE.md "Phase 8 backlog: ESLint flat-config migration"). Not introduced by this plan; `npm run build` and `npm test` both pass cleanly.

## User Setup Required

None — no external service configuration required. Migration applied automatically via supabase CLI.

## Next Phase Readiness

- date-fns + @date-fns/tz ready for import in Plan 04-02 slot engine (lib/slots.ts)
- Calendar component at components/ui/calendar.tsx ready for Plan 04-05 overrides UI
- .day-blocked/.day-custom CSS classes registered for Plan 04-05 modifiersClassNames usage
- accounts table has all 4 settings columns; Plan 04-02 computeSlots can read buffer_minutes, min_notice_hours, max_advance_days, daily_cap from the nsi account row
- 17/17 Vitest tests green; no regression introduced

---
*Phase: 04-availability-engine*
*Completed: 2026-04-25*
