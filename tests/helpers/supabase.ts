import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** The stable test account slug; separate from Andrew's production `nsi` account. */
export const TEST_ACCOUNT_SLUG = "nsi-test";

export async function getOrCreateTestAccount() {
  const admin = adminClient();
  const { data: existing } = await admin
    .from("accounts")
    .select("id")
    .eq("slug", TEST_ACCOUNT_SLUG)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin
    .from("accounts")
    .insert({
      slug: TEST_ACCOUNT_SLUG,
      name: "NSI Test",
      timezone: "America/Chicago",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

export async function getOrCreateTestEventType(accountId: string) {
  const admin = adminClient();
  const { data: existing } = await admin
    .from("event_types")
    .select("id")
    .eq("account_id", accountId)
    .eq("slug", "test-race")
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin
    .from("event_types")
    .insert({
      account_id: accountId,
      slug: "test-race",
      name: "Test Race",
      duration_minutes: 30,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

/**
 * The Supabase Auth user used for authenticated-owner tests (Plan 04 creates
 * the user manually in the Supabase dashboard and links it to the `nsi`
 * account via one-time MCP SQL UPDATE).
 *
 * Credentials live in .env.local (gitignored) — never committed.
 */
const TEST_OWNER_EMAIL = process.env.TEST_OWNER_EMAIL;
const TEST_OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD;

/**
 * Returns a Supabase client authenticated as Andrew (the real NSI owner).
 *
 * - Fresh client per call — no session persistence across tests.
 * - `persistSession: false` + `autoRefreshToken: false` prevents file-based
 *   leaks (no localStorage write) and stops background refresh timers that
 *   can keep a Vitest worker alive past test end.
 * - SELECT-only contract in tests: this client runs against the REAL `nsi`
 *   account, so any test that uses it MUST NOT INSERT/UPDATE/DELETE on
 *   tenant tables (no test data pollution). The `nsi-test` account (isolated
 *   from Andrew's real data via existing helper) is the write playground.
 *
 * Contract decision (CONTEXT.md Claude's Discretion):
 *   Option (a) — SELECT-only against real `nsi` account.
 *   This avoids polluting Andrew's production account with test data and
 *   still proves RLS visibility for the owner. Chosen over option (b) (a
 *   separate throwaway auth user linked to nsi-test) because v1 has a single
 *   manually-provisioned auth user.
 */
export async function signInAsNsiOwner(): Promise<SupabaseClient> {
  if (!TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD) {
    throw new Error(
      "TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD missing in .env.local. " +
      "Plan 04 provisions these after Andrew creates his auth user.",
    );
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_OWNER_EMAIL,
    password: TEST_OWNER_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`signInAsNsiOwner failed: ${error?.message ?? "no session"}`);
  }

  return client;
}
