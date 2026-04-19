import { createClient } from "@supabase/supabase-js";

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
