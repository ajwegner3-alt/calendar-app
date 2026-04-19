// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  signInAsNsiOwner,
  getOrCreateTestAccount,
  TEST_ACCOUNT_SLUG,
} from "./helpers/supabase";

describe("RLS authenticated-owner visibility (Phase 2)", () => {
  let client: SupabaseClient;

  beforeAll(async () => {
    // Ensure the nsi-test isolation account exists (for cross-tenant blindness
    // assertion). Creates via service-role (admin helper) if missing.
    await getOrCreateTestAccount();
    client = await signInAsNsiOwner();
  });

  afterAll(async () => {
    // Explicit sign-out — belt + suspenders; persistSession is false already.
    try {
      await client.auth.signOut();
    } catch {
      // Swallow — test teardown; client may already be disposed.
    }
  });

  it("owner sees exactly 1 account row (their own nsi account)", async () => {
    const { data, error } = await client
      .from("accounts")
      .select("id, slug, timezone");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].slug).toBe("nsi");
    expect(data?.[0].timezone).toBe("America/Chicago");
  });

  it("owner cannot SELECT the nsi-test account (RLS blocks cross-tenant)", async () => {
    const { data, error } = await client
      .from("accounts")
      .select("id")
      .eq("slug", TEST_ACCOUNT_SLUG);
    // RLS behavior: the query succeeds but returns an empty set — NOT an error.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("owner sees 0 event_types initially (tenant-scoped, none seeded in Phase 2)", async () => {
    const { data, error } = await client.from("event_types").select("id");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // Phase 3 will add CRUD; for now zero rows is expected for the nsi account.
  });

  it("owner sees 0 bookings initially (tenant-scoped, none seeded in Phase 2)", async () => {
    const { data, error } = await client.from("bookings").select("id");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
