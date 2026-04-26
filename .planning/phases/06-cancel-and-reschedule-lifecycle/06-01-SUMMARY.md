---
phase: 06-cancel-and-reschedule-lifecycle
plan: 01
subsystem: database
tags: [postgres, supabase, migration, rate-limiting, sql]

# Dependency graph
requires:
  - phase: 05-public-booking-flow
    provides: cancel/reschedule token columns + indexes already provisioned on bookings; admin client pattern established
  - phase: 01-foundation
    provides: initial_schema with bookings, booking_events, enums; supabase link to mogfnutxrrbtvnaupoun
provides:
  - rate_limit_events table in remote Supabase calendar project (id bigserial PK, key text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now())
  - Composite index rate_limit_events_key_occurred_idx ON (key, occurred_at) for sliding-window count queries
affects:
  - plan 06-02 (lib/rate-limit.ts will SELECT count + INSERT against this table via createAdminClient())
  - plan 06-03 onwards (all cancel/reschedule public routes use rate limit)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postgres-backed sliding-window rate limit table (key text + occurred_at timestamptz, count-then-insert pattern)"
    - "Idempotent DDL migration: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS"
    - "No RLS on rate_limit_events: service-role admin client only, anon/authed clients never touch it"
    - "supabase db query --linked 'SQL...' (positional arg) for inline SQL verification — --execute flag not supported in this CLI version"

key-files:
  created:
    - supabase/migrations/20260427120000_rate_limit_events.sql
  modified: []

key-decisions:
  - "Postgres over Upstash Redis: zero new deps/accounts; consistent across Vercel instances; acceptable ~1 extra DB round-trip on low-frequency token endpoints; Supabase free tier handles volume easily"
  - "No RLS on rate_limit_events: only createAdminClient() (service-role) callers; anon/authed clients never read or write this table"
  - "No expires_at column: window length lives in application code (lib/rate-limit.ts, Plan 06-02); same table supports any window length without migration"
  - "No UNIQUE constraint on (key, occurred_at): concurrent requests at same millisecond must each be recorded as separate counter events"
  - "Dead-hash strategy for token invalidation (NOT this plan, but confirmed in RESEARCH): cancel_token_hash is NOT NULL so nulling is blocked; replace with hashToken(randomUUID()) dead hash"

patterns-established:
  - "supabase db query --linked 'SQL' (positional inline arg) is the correct CLI syntax for ad-hoc verification queries; --execute flag does not exist in this CLI version"

# Metrics
duration: 2min
completed: 2026-04-26
---

# Phase 6 Plan 01: Rate-Limit Migration Summary

**`rate_limit_events` table live on remote Supabase calendar project — Postgres-backed sliding-window rate limit storage for public cancel/reschedule token routes, zero new dependencies**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-26T01:37:08Z
- **Completed:** 2026-04-26T01:38:26Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created `supabase/migrations/20260427120000_rate_limit_events.sql` with idempotent DDL: table + composite index with full rationale comment block citing RESEARCH §Rate-Limit Storage Backend Decision
- Applied migration to remote `calendar` Supabase project (ref `mogfnutxrrbtvnaupoun`) via `npx supabase db query --linked -f <file>`; table exists, empty, both indexes confirmed via live DB query
- Confirmed that `bookings` table needs ZERO changes (Phase 1 already provisioned `cancel_token_hash`, `reschedule_token_hash`, `cancelled_at`, `cancelled_by`, and lookup indexes `bookings_cancel_token_idx` + `bookings_reschedule_token_idx`)
- Confirmed that `booking_events` table needs ZERO changes (Phase 1 enums `booking_event_kind` + `booking_actor` + `metadata jsonb` cover all Phase 6 audit needs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create rate_limit_events migration file** - `26a9030` (feat)
2. **Task 2: Apply migration to remote Supabase** - no commit (DB-only operation; no new files)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/20260427120000_rate_limit_events.sql` — Idempotent DDL for `rate_limit_events` table + composite index; header comment cites RESEARCH §Rate-Limit Storage Backend Decision rationale (Postgres vs Upstash Redis vs in-memory)

## Decisions Made

- **Postgres-backed rate limiting confirmed:** RESEARCH §Rate-Limit Storage Backend Decision verdict applied — zero new npm deps, no new external accounts, consistent across all Vercel Lambda instances, acceptable ~1 extra DB round-trip per token-route hit on a single-owner low-traffic app.
- **No RLS intentionally:** Only `createAdminClient()` (service-role) callers access this table; anon/authed clients never interact with it. Adding RLS would require a policy carve-out and add zero security value.
- **No `expires_at` column:** Window length (5-min sliding window, 10 req/IP cap) lives entirely in `lib/rate-limit.ts` application code (Plan 06-02). Same table can serve any window length without schema changes.
- **`supabase db query --linked` positional arg syntax confirmed:** The `--execute` flag does not exist in the project's Supabase CLI version. Inline SQL must be passed as a positional argument: `npx supabase db query --linked 'SELECT ...'`. Recorded for all future ad-hoc DB verification commands in Phase 6.

## Deviations from Plan

None — plan executed exactly as written.

The Task 2 verify block in the plan used `--execute "SELECT ..."` syntax which is not supported. This is a minor documentation discrepancy in the plan (not a code change); the equivalent query ran correctly as a positional argument.

## Issues Encountered

- `npx supabase db query --linked --execute "SQL"` failed with "unknown flag: --execute". Resolved immediately by using the positional argument form: `npx supabase db query --linked "SQL"`. No impact on outcome; both forms produce identical results.

## User Setup Required

None — migration applied automatically via `npx supabase db query --linked -f`. No Vercel env vars added. No dashboard action required.

## Next Phase Readiness

- `rate_limit_events` table is live and empty on the remote Supabase calendar project
- Plan 06-02 can immediately implement `lib/rate-limit.ts` with:
  - `createAdminClient().from('rate_limit_events').select('id', { count: 'exact', head: true }).eq('key', key).gte('occurred_at', windowStart)` for count
  - `createAdminClient().from('rate_limit_events').insert({ key })` to record a request
  - Window: 10 requests / IP / 5-minute sliding window (CONTEXT.md decision)
- No blockers for Plans 06-02 through 06-06

---
*Phase: 06-cancel-and-reschedule-lifecycle*
*Completed: 2026-04-26*
