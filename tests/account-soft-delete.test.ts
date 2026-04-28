// @vitest-environment node
/**
 * Plan 10-07 — Account soft-delete invariant (ACCT-03).
 *
 * Verifies that soft-deleted accounts (deleted_at IS NOT NULL) return null
 * from both public-surface data-access helpers:
 *   - loadAccountListing (used by /[account]/ listing page)
 *   - loadEventTypeForBookingPage (used by /[account]/[event-slug] AND
 *     /embed/[account]/[event-slug] — shared loader)
 *
 * Uses the service-role admin client to:
 *   1. Create a throwaway test account with a unique slug.
 *   2. Confirm the helpers return data while deleted_at IS NULL.
 *   3. Set deleted_at = now() via UPDATE.
 *   4. Confirm helpers return null (triggering notFound() on the pages).
 *   5. Restore deleted_at = null to avoid test pollution.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "./helpers/supabase";
import { loadAccountListing } from "@/app/[account]/_lib/load-account-listing";
import { loadEventTypeForBookingPage } from "@/app/[account]/[event-slug]/_lib/load-event-type";

const SOFT_DELETE_TEST_SLUG = "soft-delete-test-acct";
const SOFT_DELETE_EVENT_SLUG = "soft-delete-test-event";

describe("Account soft-delete invariant (ACCT-03, Plan 10-07)", () => {
  let testAccountId: string;
  let testEventTypeId: string;

  beforeAll(async () => {
    const admin = adminClient();

    // Clean up any leftover state from a previous failed run
    const { data: existing } = await admin
      .from("accounts")
      .select("id")
      .eq("slug", SOFT_DELETE_TEST_SLUG)
      .maybeSingle();

    if (existing) {
      // Restore in case deleted_at was left set from a previous run
      await admin
        .from("accounts")
        .update({ deleted_at: null })
        .eq("id", existing.id);
      // Also ensure event type exists
      testAccountId = existing.id;
    } else {
      // Create the test account
      const { data: newAccount, error: acctErr } = await admin
        .from("accounts")
        .insert({
          slug: SOFT_DELETE_TEST_SLUG,
          name: "Soft Delete Test Account",
          timezone: "America/Chicago",
        })
        .select("id")
        .single();

      if (acctErr || !newAccount) {
        throw new Error(`Failed to create test account: ${acctErr?.message}`);
      }
      testAccountId = newAccount.id;
    }

    // Ensure a test event type exists for this account
    const { data: existingEt } = await admin
      .from("event_types")
      .select("id")
      .eq("account_id", testAccountId)
      .eq("slug", SOFT_DELETE_EVENT_SLUG)
      .maybeSingle();

    if (existingEt) {
      testEventTypeId = existingEt.id;
    } else {
      const { data: newEt, error: etErr } = await admin
        .from("event_types")
        .insert({
          account_id: testAccountId,
          slug: SOFT_DELETE_EVENT_SLUG,
          name: "Soft Delete Test Event",
          duration_minutes: 30,
          is_active: true,
        })
        .select("id")
        .single();

      if (etErr || !newEt) {
        throw new Error(`Failed to create test event type: ${etErr?.message}`);
      }
      testEventTypeId = newEt.id;
    }

    // Ensure both are not soft-deleted before running tests
    await admin
      .from("accounts")
      .update({ deleted_at: null })
      .eq("id", testAccountId);
  });

  afterAll(async () => {
    // Restore deleted_at = null to leave test data clean for next run
    const admin = adminClient();
    await admin
      .from("accounts")
      .update({ deleted_at: null })
      .eq("id", testAccountId);
  });

  it("positive control: loadAccountListing returns data when deleted_at IS NULL", async () => {
    const result = await loadAccountListing(SOFT_DELETE_TEST_SLUG);
    expect(result).not.toBeNull();
    expect(result?.account.slug).toBe(SOFT_DELETE_TEST_SLUG);
  });

  it("positive control: loadEventTypeForBookingPage returns data when deleted_at IS NULL", async () => {
    const result = await loadEventTypeForBookingPage(
      SOFT_DELETE_TEST_SLUG,
      SOFT_DELETE_EVENT_SLUG,
    );
    expect(result).not.toBeNull();
    expect(result?.account.slug).toBe(SOFT_DELETE_TEST_SLUG);
    expect(result?.eventType.slug).toBe(SOFT_DELETE_EVENT_SLUG);
  });

  describe("after setting deleted_at = now()", () => {
    beforeAll(async () => {
      const admin = adminClient();
      const { error } = await admin
        .from("accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", testAccountId);

      if (error) {
        throw new Error(`Failed to soft-delete test account: ${error.message}`);
      }
    });

    it("loadAccountListing returns null (404) for soft-deleted account", async () => {
      const result = await loadAccountListing(SOFT_DELETE_TEST_SLUG);
      expect(result).toBeNull();
    });

    it("loadEventTypeForBookingPage returns null (404) for soft-deleted account", async () => {
      const result = await loadEventTypeForBookingPage(
        SOFT_DELETE_TEST_SLUG,
        SOFT_DELETE_EVENT_SLUG,
      );
      expect(result).toBeNull();
    });
  });

  describe("after restoring deleted_at = null", () => {
    beforeAll(async () => {
      const admin = adminClient();
      await admin
        .from("accounts")
        .update({ deleted_at: null })
        .eq("id", testAccountId);
    });

    it("loadAccountListing returns data again after deletion reversed", async () => {
      const result = await loadAccountListing(SOFT_DELETE_TEST_SLUG);
      expect(result).not.toBeNull();
    });

    it("loadEventTypeForBookingPage returns data again after deletion reversed", async () => {
      const result = await loadEventTypeForBookingPage(
        SOFT_DELETE_TEST_SLUG,
        SOFT_DELETE_EVENT_SLUG,
      );
      expect(result).not.toBeNull();
    });
  });
});
