/**
 * No-op stub for the `server-only` package in Vitest environments.
 *
 * The real `server-only` package throws unconditionally in plain Node (not
 * Next.js server) contexts. Route handlers that transitively import it (e.g.
 * via lib/supabase/admin.ts) would fail to load in Vitest without this alias.
 *
 * The compile-time bundle safety guarantee is irrelevant in a Vitest test
 * runner — the check that matters (preventing client-bundle inclusion) is done
 * by Next.js at build time, not by Vitest. This stub replaces the throw with
 * a no-op so the import resolves cleanly.
 *
 * Aliased in vitest.config.ts: resolve.alias["server-only"] → this file.
 */
export {};
