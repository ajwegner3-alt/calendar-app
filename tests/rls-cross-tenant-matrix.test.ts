// @vitest-environment node
/**
 * Phase 8 Plan 08-08 — RLS cross-tenant isolation matrix (closes INFRA-05).
 * Extended in Phase 10 Plan 10-09 to N=3 tenants (Andrew + nsi-rls-test + nsi-rls-test-3).
 *
 * Three real Supabase auth users (Andrew → `nsi`, second user → `nsi-rls-test`,
 * third user → `nsi-rls-test-3`) exercise SELECT + UPDATE across the four
 * tenant-scoped tables that hold data (`accounts`, `event_types`, `bookings`,
 * `booking_events`).
 *
 * Coverage:
 *   - Positive controls: each owner CAN see their own seeded data.
 *     (Without this, "tenant X sees no tenant Y rows" is ambiguous.)
 *   - Cross-tenant SELECT: each tenant cannot see any other tenant's rows on
 *     the four shared tables.
 *   - Anon SELECT lockout: re-asserted here for matrix completeness.
 *     (Also covered by rls-anon-lockout.test.ts.)
 *   - Cross-tenant WRITE lockout: each tenant cannot UPDATE another's bookings
 *     (RLS filters the WHERE → 0 rows affected; row stays unmodified).
 *   - Admin control case: service-role client SEES all tenants (proves
 *     admin bypass works — sanity ground truth).
 *
 * Skip behaviour:
 *   - The N=2 suite (nsi + nsi-rls-test) skips when TEST_OWNER_2_* are absent.
 *   - The N=3 suite (adds nsi-rls-test-3) skips when TEST_OWNER_2_* OR
 *     TEST_OWNER_3_* are absent. Both sets of env vars are required because the
 *     N=3 cases assert isolation between ALL three pairs.
 *
 * Provisioning notes:
 *   - TEST_OWNER_2_*: Plan 08-08 Task 1 prereq B.
 *   - TEST_OWNER_3_*: Plan 10-09 Task 1 (deferred to milestone-end QA per
 *     Andrew 2026-04-28). See .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  signInAsNsiOwner,
  signInAsNsiTest2Owner,
  signInAsNsiTest3Owner,
  anonClient,
  adminClient,
  TEST_RLS_ACCOUNT_SLUG,
  TEST_RLS_3_ACCOUNT_SLUG,
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

// ---------------------------------------------------------------------------
// Skip guards
// ---------------------------------------------------------------------------

const skipIfNoSecondUser =
  !process.env.TEST_OWNER_2_EMAIL || !process.env.TEST_OWNER_2_PASSWORD;

const skipIfNoThreeUsers =
  !process.env.TEST_OWNER_2_EMAIL ||
  !process.env.TEST_OWNER_2_PASSWORD ||
  !process.env.TEST_OWNER_3_EMAIL ||
  !process.env.TEST_OWNER_3_PASSWORD;

// ===========================================================================
// N=2 SUITE — Phase 8 INFRA-05 (unchanged from original)
// ===========================================================================

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

    // -------------------------------------------------------------------------
    // Positive control — proves RLS ALLOWS own-account access.
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // Cross-tenant SELECT isolation.
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // Anon SELECT lockout — full matrix re-assertion.
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // Cross-tenant SELECT lockout — the core N=2 matrix.
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // Cross-tenant WRITE lockout.
    // -------------------------------------------------------------------------
    it("nsi-rls-test owner cannot UPDATE nsi's bookings (RLS rejects via 0 rows updated)", async () => {
      const admin = adminClient();
      const { data: nsiBooking } = await admin
        .from("bookings")
        .select("id, owner_note")
        .limit(1)
        .maybeSingle();

      if (!nsiBooking) {
        // Soft-skip: no nsi bookings to attack — informative warning,
        // does not fail.
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

    // -------------------------------------------------------------------------
    // Admin (service-role) control case.
    // -------------------------------------------------------------------------
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

// When N=2 skipped, register a placeholder so runner reports reason.
describe.runIf(skipIfNoSecondUser)(
  "RLS cross-tenant isolation matrix (Phase 8 INFRA-05)",
  () => {
    it.skip("requires TEST_OWNER_2_EMAIL/TEST_OWNER_2_PASSWORD — see .env.example", () => {});
  },
);

// ===========================================================================
// N=3 SUITE — Phase 10 Plan 10-09 extension
// ===========================================================================

describe.skipIf(skipIfNoThreeUsers)(
  "RLS cross-tenant isolation matrix — N=3 extension (Phase 10 10-09)",
  () => {
    let nsiClient: SupabaseClient;
    let test2Client: SupabaseClient;
    let test3Client: SupabaseClient;

    let test3EventTypeId: string;
    let test3AccountId: string;

    beforeAll(async () => {
      nsiClient = await signInAsNsiOwner();
      test2Client = await signInAsNsiTest2Owner();
      test3Client = await signInAsNsiTest3Owner();

      const admin = adminClient();

      // Resolve the nsi-rls-test-3 account row (seeded in Task 1 prereq).
      const { data: acct3, error: acctErr3 } = await admin
        .from("accounts")
        .select("id")
        .eq("slug", TEST_RLS_3_ACCOUNT_SLUG)
        .maybeSingle();
      if (acctErr3) {
        throw new Error(
          `Lookup nsi-rls-test-3 account failed: ${acctErr3.message}`,
        );
      }
      if (!acct3) {
        throw new Error(
          `nsi-rls-test-3 account not found. Complete Plan 10-09 Task 1 ` +
            `(see .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md) to INSERT the row.`,
        );
      }
      test3AccountId = acct3.id;

      // Idempotent seed: insert event_type for test3 if not already present.
      const { data: existing3 } = await admin
        .from("event_types")
        .select("id")
        .eq("account_id", test3AccountId)
        .eq("slug", "rls-isolation-fixture-3")
        .maybeSingle();

      if (existing3) {
        test3EventTypeId = existing3.id;
      } else {
        const { data: inserted3, error: insertErr3 } = await admin
          .from("event_types")
          .insert({
            account_id: test3AccountId,
            name: "RLS isolation fixture 3",
            slug: "rls-isolation-fixture-3",
            duration_minutes: 30,
            is_active: true,
          })
          .select("id")
          .single();
        if (insertErr3 || !inserted3) {
          throw new Error(
            `Failed to seed nsi-rls-test-3 event_type: ${insertErr3?.message}`,
          );
        }
        test3EventTypeId = inserted3.id;
      }
    });

    // -------------------------------------------------------------------------
    // Positive control for test3.
    // -------------------------------------------------------------------------
    it("nsi-rls-test-3 owner CAN see their own seeded event_type (positive control)", async () => {
      const { data, error } = await test3Client
        .from("event_types")
        .select("id")
        .eq("id", test3EventTypeId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(test3EventTypeId);
    });

    it("nsi-rls-test-3 owner CAN see their own account row (positive control)", async () => {
      const { data, error } = await test3Client
        .from("accounts")
        .select("id, slug");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].slug).toBe(TEST_RLS_3_ACCOUNT_SLUG);
      expect(data?.[0].id).toBe(test3AccountId);
    });

    // -------------------------------------------------------------------------
    // Anon lockout for test3-seeded event_type.
    // -------------------------------------------------------------------------
    it("anon client cannot SELECT test3's seeded event_type (anon lockout)", async () => {
      const client = anonClient();
      const { data, error } = await client
        .from("event_types")
        .select("id")
        .eq("id", test3EventTypeId)
        .maybeSingle();
      if (!error) {
        expect(data).toBeNull();
      } else {
        expect(error).toBeTruthy();
      }
    });

    // -------------------------------------------------------------------------
    // Cross-tenant SELECT: test3 ↔ nsi (both directions, per SHARED_TABLES).
    // -------------------------------------------------------------------------
    for (const table of SHARED_TABLES) {
      it(`nsi-rls-test-3 cannot see nsi's ${table} rows (cross-tenant SELECT test3→nsi)`, async () => {
        const test3Result = await test3Client
          .from(table)
          .select("id")
          .limit(50);
        const nsiResult = await nsiClient.from(table).select("id").limit(50);

        const nsiIds = new Set((nsiResult.data ?? []).map((r) => r.id));
        for (const row of test3Result.data ?? []) {
          expect(
            nsiIds.has(row.id),
            `cross-tenant leak in ${table}: test3 can see nsi id ${row.id}`,
          ).toBe(false);
        }
      });
    }

    for (const table of SHARED_TABLES) {
      it(`nsi cannot see nsi-rls-test-3's ${table} rows (cross-tenant SELECT nsi→test3)`, async () => {
        const nsiResult = await nsiClient.from(table).select("id").limit(50);
        const test3Result = await test3Client
          .from(table)
          .select("id")
          .limit(50);

        const test3Ids = new Set((test3Result.data ?? []).map((r) => r.id));
        for (const row of nsiResult.data ?? []) {
          expect(
            test3Ids.has(row.id),
            `cross-tenant leak in ${table}: nsi can see test3 id ${row.id}`,
          ).toBe(false);
        }
      });
    }

    // -------------------------------------------------------------------------
    // Cross-tenant SELECT: test3 ↔ test2 (both directions, per SHARED_TABLES).
    // -------------------------------------------------------------------------
    for (const table of SHARED_TABLES) {
      it(`nsi-rls-test-3 cannot see nsi-rls-test's ${table} rows (cross-tenant SELECT test3→test2)`, async () => {
        const test3Result = await test3Client
          .from(table)
          .select("id")
          .limit(50);
        const test2Result = await test2Client
          .from(table)
          .select("id")
          .limit(50);

        const test2Ids = new Set((test2Result.data ?? []).map((r) => r.id));
        for (const row of test3Result.data ?? []) {
          expect(
            test2Ids.has(row.id),
            `cross-tenant leak in ${table}: test3 can see test2 id ${row.id}`,
          ).toBe(false);
        }
      });
    }

    for (const table of SHARED_TABLES) {
      it(`nsi-rls-test cannot see nsi-rls-test-3's ${table} rows (cross-tenant SELECT test2→test3)`, async () => {
        const test2Result = await test2Client
          .from(table)
          .select("id")
          .limit(50);
        const test3Result = await test3Client
          .from(table)
          .select("id")
          .limit(50);

        const test3Ids = new Set((test3Result.data ?? []).map((r) => r.id));
        for (const row of test2Result.data ?? []) {
          expect(
            test3Ids.has(row.id),
            `cross-tenant leak in ${table}: test2 can see test3 id ${row.id}`,
          ).toBe(false);
        }
      });
    }

    // -------------------------------------------------------------------------
    // Cross-tenant WRITE lockout for test3.
    // -------------------------------------------------------------------------
    it("nsi-rls-test-3 cannot UPDATE nsi's bookings (RLS rejects via 0 rows updated)", async () => {
      const admin = adminClient();
      const { data: nsiBooking } = await admin
        .from("bookings")
        .select("id, owner_note")
        .limit(1)
        .maybeSingle();

      if (!nsiBooking) {
        console.warn(
          "[rls-matrix-n3] No nsi booking exists; test3→nsi UPDATE test soft-skipped.",
        );
        return;
      }

      const originalNote = nsiBooking.owner_note;
      const attackNote = `RLS attack from test3 ${Date.now()}`;

      const { data: updateResult } = await test3Client
        .from("bookings")
        .update({ owner_note: attackNote })
        .eq("id", nsiBooking.id)
        .select("id");

      expect((updateResult ?? []).length).toBe(0);

      const { data: stillIntact } = await admin
        .from("bookings")
        .select("owner_note")
        .eq("id", nsiBooking.id)
        .maybeSingle();
      expect(stillIntact?.owner_note ?? null).toBe(originalNote ?? null);
    });

    it("nsi-rls-test-3 cannot UPDATE nsi-rls-test's seeded event_type (RLS rejects via 0 rows)", async () => {
      // Find the test2 fixture event type via admin.
      const admin = adminClient();
      const { data: test2Et } = await admin
        .from("event_types")
        .select("id, name")
        .eq("slug", "rls-isolation-fixture")
        .maybeSingle();

      if (!test2Et) {
        console.warn(
          "[rls-matrix-n3] nsi-rls-test fixture event_type not found; test3→test2 UPDATE test soft-skipped.",
        );
        return;
      }

      const attackName = `RLS attack from test3 ${Date.now()}`;

      const { data: updateResult } = await test3Client
        .from("event_types")
        .update({ name: attackName })
        .eq("id", test2Et.id)
        .select("id");

      expect((updateResult ?? []).length).toBe(0);

      // Verify the row is intact.
      const { data: stillIntact } = await admin
        .from("event_types")
        .select("name")
        .eq("id", test2Et.id)
        .maybeSingle();
      expect(stillIntact?.name).toBe(test2Et.name);
    });

    // -------------------------------------------------------------------------
    // Admin control: all three tenants visible.
    // -------------------------------------------------------------------------
    it("admin client CAN see all three tenants' accounts (N=3 control case)", async () => {
      const admin = adminClient();
      const { data, error } = await admin
        .from("accounts")
        .select("id, slug")
        .limit(50);
      expect(error).toBeNull();
      const slugs = (data ?? []).map((r) => r.slug);
      expect(slugs).toContain("nsi");
      expect(slugs).toContain(TEST_RLS_ACCOUNT_SLUG);
      expect(slugs).toContain(TEST_RLS_3_ACCOUNT_SLUG);
    });
  },
);

// When N=3 skipped, register a placeholder so runner reports reason.
describe.runIf(skipIfNoThreeUsers)(
  "RLS cross-tenant isolation matrix — N=3 extension (Phase 10 10-09)",
  () => {
    it.skip(
      "requires TEST_OWNER_2_* AND TEST_OWNER_3_* — see .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md for provisioning steps",
      () => {},
    );
  },
);
