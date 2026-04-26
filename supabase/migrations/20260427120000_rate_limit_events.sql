-- 20260427120000_rate_limit_events.sql
--
-- Phase 6 (Cancel + Reschedule Lifecycle) — adds Postgres-backed sliding-window
-- rate limit storage for the public token routes (/cancel/*, /reschedule/*).
--
-- Why Postgres instead of Upstash Redis or in-memory (RESEARCH §Rate-Limit Storage Backend Decision):
--   - In-memory: per-Lambda-instance state, fails under any meaningful load.
--   - Upstash: requires new account + env vars + external service for very low
--     traffic on a single-owner scheduling app.
--   - Postgres: zero new dependencies, consistent across all Vercel instances,
--     adds ~1 DB round-trip per token-route hit (acceptable on these low-frequency
--     endpoints), uses the same admin client pattern already established.
--
-- Cleanup: rows accumulate slowly (10 req / IP / 5 min hard cap → ~120 rows/hour
-- absolute worst case per attacker). Phase 8 hardening can add a pg_cron sweep
-- (DELETE FROM rate_limit_events WHERE occurred_at < now() - interval '1 day').
--
-- RLS: intentionally NOT enabled. The only callers are server-only modules using
-- createAdminClient() (service-role bypasses RLS). anon/authed clients never read
-- or write this table directly.

create table if not exists rate_limit_events (
  id          bigserial primary key,
  key         text        not null,            -- e.g. 'cancel:203.0.113.1' or 'reschedule:203.0.113.1'
  occurred_at timestamptz not null default now()
);

-- Composite index supports the sliding-window count query:
--   SELECT count(*) FROM rate_limit_events WHERE key = ? AND occurred_at >= ?
create index if not exists rate_limit_events_key_occurred_idx
  on rate_limit_events(key, occurred_at);
