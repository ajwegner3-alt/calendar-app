// @vitest-environment node
/**
 * Phase 8 Plan 08-08 — RLS cross-tenant isolation matrix (closes INFRA-05).
 *
 * Two real Supabase auth users (Andrew → `nsi`, second user → `nsi-rls-test`)
 * exercise SELECT + UPDATE across the four tenant-scoped tables that hold
 * data (`accounts`, `event_types`, `bookings`, `booking_events`).
 *
 * Coverage:
 *   - Positive control: nsi-rls-test owner CAN see their own seeded data.
 *     (Without this, "test2 sees no nsi rows" is ambiguous — could mean RLS
 *     denies everything for that user.)
 *   - Cross-tenant SELECT: nsi cannot see test2's seeded event_type;
 *     test2 cannot see nsi's rows on the four shared tables.
 *   - Anon SELECT lockout: covered by rls-anon-lockout.test.ts; re-asserted
 *     here for matrix completeness.
 *   - Cross-tenant WRITE lockout: test2 cannot UPDATE nsi's bookings (RLS
 *     filters the WHERE → 0 rows affected; row stays unmodified).
 *   - Admin control case: service-role client SEES both tenants (proves
 *     admin bypass works as expected — sanity ground truth).
 *
 * If TEST_OWNER_2_* env vars are not set (e.g., CI without secrets), the
 * suite is skipped gracefully with an informative message — does not fail.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  signInAsNsiOwner,
  signInAsNsiTest2Owner,
  anonClient,
  adminClient,
  TEST_RLS_ACCOUNT_SLUG,
} from "./helpers/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

// Tables enforcing tenant scoping. `availability_rules` and `date_overrides`
// are also RLS-scoped but the matrix focuses on the data Andrew interacts
// with daily (and the four named in INFRA-05).
const SHARED_TABLES = [
  "bookings",
  "booking_events",
  "event_types",
  "accounts",
] as const;

const skipIfNoSecondUser =
  !process.env.TEST_OWNER_2_EMAIL || !process.env.TEST_OWNER_2_PASSWORD;

describe.skipIf(skipIfNoSecondUser)(
  "RLS cross-tenant isolation matrix (Phase 8 INFRA-05)",
  () => {
    let nsiClient: SupabaseClient;
    let test2Client: SupabaseClient;
    let test2EventTypeId: string;
    let test2AccountId: string;

    beforeAll(async () => {
      nsiClient = await signInAsNsiOwner();
      test2Client = await signInAsNsiTest2Owner();

      // Seed nsi-rls-test with at least one row so the positive control can
      // assert "owner CAN see own data" — distinguishing RLS-allows-own from
      // RLS-denies-everything.
      const admin = adminClient();

      // The nsi-rls-test account row is created in Task 1 prereq B.
      const { data: acct, error: acctErr } = await admin
        .from("accounts")
        .select("id")
        .eq("slug", TEST_RLS_ACCOUNT_SLUG)
        .maybeSingle();
      if (acctErr) {
        throw new Error(`Lookup nsi-rls-test account failed: ${acctErr.message}`);
      }
      if (!acct) {
        throw new Error(
          `nsi-rls-test account not found. Run Task 1 prereq B SQL to ` +
            `INSERT the account row linking owner_user_id to the second auth user.`,
        );
      }
      test2AccountId = acct.id;

      // Idempotent seed: insert event_type if not already present.
      const { data: existing } = await admin
        .from("event_types")
        .select("id")
        .eq("account_id", test2AccountId)
        .eq("slug", "rls-isolation-fixture")
        .maybeSingle();

      if (existing) {
        test2EventTypeId = existing.id;
      } else {
        const { data: inserted, error: insertErr } = await admin
          .from("event_types")
          .insert({
            account_id: test2AccountId,
            name: "RLS isolation fixture",
            slug: "rls-isolation-fixture",
            duration_minutes: 30,
            is_active: true,
          })
          .select("id")
          .single();
        if (insertErr || !inserted) {
          throw new Error(
            `Failed to seed nsi-rls-test event_type: ${insertErr?.message}`,
          );
        }
        test2EventTypeId = inserted.id;
      }
    });

    // ---------------------------------------------------------------------
    // Positive control — proves RLS ALLOWS own-account access.
    // Without this, an empty cross-tenant result is ambiguous.
    // ---------------------------------------------------------------------
    it("nsi-rls-test owner CAN see their own seeded event_type (positive control)", async () => {
      const { data, error } = await test2Client
        .from("event_types")
        .select("id")
        .eq("id", test2EventTypeId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(test2EventTypeId);
    });

    it("nsi-rls-test owner CAN see their own account row (positive control)", async () => {
      const { data, error } = await test2Client
        .from("accounts")
        .select("id, slug");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].slug).toBe(TEST_RLS_ACCOUNT_SLUG);
      expect(data?.[0].id).toBe(test2AccountId);
    });

    // ---------------------------------------------------------------------
    // Cross-tenant SELECT isolation.
    // ---------------------------------------------------------------------
    it("nsi owner CANNOT see nsi-rls-test's seeded event_type (cross-tenant SELECT)", async () => {
      const { data, error } = await nsiClient
        .from("event_types")
        .select("id")
        .eq("id", test2EventTypeId)
        .maybeSingle();
      // RLS filters the row from the result set → null data, no error.
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    // ---------------------------------------------------------------------
    // Anon SELECT lockout — full matrix re-assertion (also covered by
    // rls-anon-lockout.test.ts; included here for matrix completeness).
    // ---------------------------------------------------------------------
    for (const table of SHARED_TABLES) {
      it(`anon client cannot SELECT ${table} (returns []) `, async () => {
        const client = anonClient();
        const { data, error } = await client.from(table).select("id").limit(5);
        if (!error) {
          expect(data ?? []).toEqual([]);
        } else {
          expect(error).toBeTruthy();
        }
      });
    }

    // ---------------------------------------------------------------------
    // Cross-tenant SELECT lockout — the core matrix.
    // For each shared table: gather nsi-owned ids via nsi client, gather
    // test2-visible ids via test2 client, assert zero overlap.
    // ---------------------------------------------------------------------
    for (const table of SHARED_TABLES) {
      it(`nsi-rls-test owner cannot see nsi's ${table} rows (cross-tenant SELECT)`, async () => {
        const test2Result = await test2Client
          .from(table)
          .select("id")
          .limit(50);
        const nsiResult = await nsiClient.from(table).select("id").limit(50);

        const nsiIds = new Set((nsiResult.data ?? []).map((r) => r.id));
        for (const row of test2Result.data ?? []) {
          expect(
            nsiIds.has(row.id),
            `cross-tenant leak in ${table}: id ${row.id} appears in BOTH nsi and nsi-rls-test result sets`,
          ).toBe(false);
        }
      });
    }

    // ---------------------------------------------------------------------
    // Cross-tenant WRITE lockout — test2 attempts to UPDATE one of nsi's
    // bookings. RLS denies via 0-row WHERE semantics; the row stays intact.
    // ---------------------------------------------------------------------
    it("nsi-rls-test owner cannot UPDATE nsi's bookings (RLS rejects via 0 rows updated)", async () => {
      const admin = adminClient();
      const { data: nsiBooking } = await admin
        .from("bookings")
        .select("id, owner_note")
        .limit(1)
        .maybeSingle();

      if (!nsiBooking) {
        // Soft-skip: no nsi bookings to attack — informative warning,
        // does not fail. (Andrew's `nsi` account may have no bookings yet.)
        console.warn(
          "[rls-matrix] No nsi booking exists; cross-tenant UPDATE test soft-skipped.",
        );
        return;
      }

      const originalNote = nsiBooking.owner_note;
      const attackNote = `RLS attack ${Date.now()}`;

      const { data: updateResult } = await test2Client
        .from("bookings")
        .update({ owner_note: attackNote })
        .eq("id", nsiBooking.id)
        .select("id");

      // RLS denies via "WHERE matched 0 rows" semantics — data is [] or null.
      expect((updateResult ?? []).length).toBe(0);

      // Verify nsi's booking was NOT modified by re-reading via admin.
      const { data: stillIntact } = await admin
        .from("bookings")
        .select("owner_note")
        .eq("id", nsiBooking.id)
        .maybeSingle();
      expect(stillIntact?.owner_note ?? null).toBe(originalNote ?? null);
    });

    // ---------------------------------------------------------------------
    // Admin (service-role) control case — bypass works as expected.
    // Without this, an admin bug could hide RLS bugs on either side.
    // ---------------------------------------------------------------------
    it("admin client CAN see both tenants' accounts (control case — admin bypass)", async () => {
      const admin = adminClient();
      const { data, error } = await admin
        .from("accounts")
        .select("id, slug")
        .limit(50);
      expect(error).toBeNull();
      const slugs = (data ?? []).map((r) => r.slug);
      expect(slugs).toContain("nsi");
      expect(slugs).toContain(TEST_RLS_ACCOUNT_SLUG);
    });
  },
);

// When skipped, register a single skipped test so the runner reports the
// reason instead of an empty file.
describe.runIf(skipIfNoSecondUser)(
  "RLS cross-tenant isolation matrix (Phase 8 INFRA-05)",
  () => {
    it.skip("requires TEST_OWNER_2_EMAIL/TEST_OWNER_2_PASSWORD — see .env.example", () => {});
  },
);
