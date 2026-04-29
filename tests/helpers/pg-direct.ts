/**
 * Direct Postgres connection helper for race tests (CAP-06).
 *
 * WHY THIS EXISTS: Supabase application traffic routes through Supavisor
 * (transaction-mode pooler on port 6543). Under high concurrency, Supavisor
 * may serialize requests BEFORE they reach Postgres — masking races at the
 * application layer. CAP-06 requires testing the DB-level guarantee in
 * isolation from the pooler.
 *
 * USAGE: ONLY in tests/. Never import in app/ or lib/.
 *
 * SETUP: Set SUPABASE_DIRECT_URL in .env.local. Get the value from
 *   Supabase Dashboard → Project Settings → Database → Direct connection.
 *   Format: postgresql://postgres.{ref}:{pwd}@db.{ref}.supabase.co:5432/postgres
 */

import postgres from "postgres";

export function pgDirectClient(maxConnections = 20) {
  const url = process.env.SUPABASE_DIRECT_URL;
  if (!url) {
    throw new Error(
      "SUPABASE_DIRECT_URL missing. Set it in .env.local from Supabase Dashboard → Project Settings → Database → Direct connection.",
    );
  }
  return postgres(url, {
    max: maxConnections,
    idle_timeout: 5,
    connect_timeout: 10,
  });
}

export function hasDirectUrl(): boolean {
  return Boolean(process.env.SUPABASE_DIRECT_URL);
}
