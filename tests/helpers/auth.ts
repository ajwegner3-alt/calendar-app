/**
 * Phase 8 Plan 08-08 — Auth helpers for the RLS cross-tenant isolation matrix.
 *
 * Re-exports the canonical Phase 2 helpers from `./supabase` and adds a
 * second authenticated owner (`signInAsNsiTest2Owner`) for two-tenant RLS
 * proofs. Centralizing here means:
 *   - One file to import from RLS matrix tests (reads top-down).
 *   - The Phase 2 contract on `signInAsNsiOwner` is preserved (the original
 *     helper in `supabase.ts` stays the source of truth for SELECT-only-
 *     against-real-nsi semantics — see its JSDoc).
 *   - Future RLS / multi-tenant test additions get a single import surface.
 *
 * The second user (`TEST_OWNER_2_*`) is provisioned manually in the Supabase
 * dashboard (Plan 08-08 Task 1 prereq B). The corresponding `nsi-rls-test`
 * account row is inserted via SQL Editor so RLS lookups by owner_user_id
 * succeed.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export {
  signInAsNsiOwner,
  anonClient,
  adminClient,
  TEST_ACCOUNT_SLUG,
  getOrCreateTestAccount,
} from "./supabase";

/** Slug of the second-tenant account used by the RLS matrix. */
export const TEST_RLS_ACCOUNT_SLUG = "nsi-rls-test";

const TEST_OWNER_2_EMAIL = process.env.TEST_OWNER_2_EMAIL;
const TEST_OWNER_2_PASSWORD = process.env.TEST_OWNER_2_PASSWORD;

/**
 * Returns a Supabase client authenticated as the `nsi-rls-test` account
 * owner — the SECOND tenant used by the cross-tenant RLS matrix.
 *
 * - Fresh client per call (no session persistence — same pattern as
 *   `signInAsNsiOwner`).
 * - This client may write to its OWN account (`nsi-rls-test`) — it is not
 *   subject to the SELECT-only restriction that protects the real `nsi`
 *   account from test data pollution.
 * - The caller is responsible for cleaning up rows it inserts (idempotent
 *   seed pattern in the matrix test handles this via "select-then-insert").
 *
 * Throws with an actionable message if env vars are unset, so a CI run
 * without secrets surfaces the missing prerequisite cleanly instead of an
 * opaque auth failure.
 */
export async function signInAsNsiTest2Owner(): Promise<SupabaseClient> {
  if (!TEST_OWNER_2_EMAIL || !TEST_OWNER_2_PASSWORD) {
    throw new Error(
      "TEST_OWNER_2_EMAIL / TEST_OWNER_2_PASSWORD missing in .env.local. " +
        "Plan 08-08 Task 1 prereq B provisions these after the second " +
        "auth user is created in the Supabase dashboard.",
    );
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_OWNER_2_EMAIL,
    password: TEST_OWNER_2_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(
      `signInAsNsiTest2Owner failed: ${error?.message ?? "no session"}`,
    );
  }

  return client;
}
