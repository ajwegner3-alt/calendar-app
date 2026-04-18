import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 *
 * RULES:
 *   - Import this ONLY from server code (Route Handlers, Server Actions, Server Components,
 *     API routes, cron endpoints, Vitest files marked // @vitest-environment node).
 *   - NEVER import from a "use client" file, Client Component, or any module that's
 *     part of the client bundle. The `import "server-only"` above throws at bundle
 *     time if this is attempted.
 *   - Bypasses RLS. Every query here is as if Postgres-superuser — scope by account_id
 *     manually in every query. No exceptions.
 *   - Do NOT cache / memoize into a module-level singleton. Supabase's Fluid compute
 *     guidance is to create a new client per invocation. Same rule as server.ts.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL — " +
        "admin client unavailable. Check .env.local / Vercel env.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
