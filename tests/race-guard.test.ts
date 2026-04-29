// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import {
  adminClient,
  getOrCreateTestAccount,
  getOrCreateTestEventType,
} from "./helpers/supabase";

describe("bookings race guard (FOUND-04)", () => {
  let accountId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    accountId = await getOrCreateTestAccount();
    eventTypeId = await getOrCreateTestEventType(accountId);
  });

  it("only one of N parallel inserts for the same (event_type_id, start_at) succeeds", async () => {
    const admin = adminClient();
    const startAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    const endAt = new Date(Date.parse(startAt) + 30 * 60_000).toISOString();

    // Clean slate for this slot
    await admin
      .from("bookings")
      .delete()
      .eq("event_type_id", eventTypeId)
      .eq("start_at", startAt);

    const N = 10;
    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) =>
        admin
          .from("bookings")
          .insert({
            account_id: accountId,
            event_type_id: eventTypeId,
            start_at: startAt,
            end_at: endAt,
            booker_name: `Booker ${i}`,
            booker_email: `race-${i}@test.local`,
            booker_timezone: "America/Chicago",
            status: "confirmed",
            cancel_token_hash: `test-cancel-${i}`,
            reschedule_token_hash: `test-resched-${i}`,
          })
          .select("id")
          .single(),
      ),
    );

    // Note: supabase-js resolves the Promise even on DB error; check the inner error.
    const succeeded = results.filter(
      (r) => r.status === "fulfilled" && !r.value.error,
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && r.value.error),
    );

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(N - 1);

    // Cleanup
    await admin
      .from("bookings")
      .delete()
      .eq("event_type_id", eventTypeId)
      .eq("start_at", startAt);
  });
});

// ============================================================================
// CAP-06: pg-driver race test (Phase 11).
// Tests DB-level uniqueness guarantee bypassing Supavisor pooler. Skip-guarded
// when SUPABASE_DIRECT_URL is absent so CI does not fail on missing env.
//
// Fixture-helper path: Fallback B (inline admin-client INSERT for event_types).
// Rationale: getOrCreateTestEventType() is a get-or-create returning the same
// row on repeated calls — cannot be used to create two distinct event_types
// with different max_bookings_per_slot values. Inline INSERT with unique slugs
// per test + explicit max_bookings_per_slot ensures correct capacity under race.
// Account creation still uses getOrCreateTestAccount() as in the existing test.
// ============================================================================

import { pgDirectClient, hasDirectUrl } from "./helpers/pg-direct";

const skipIfNoDirectUrl = !hasDirectUrl();

describe.skipIf(skipIfNoDirectUrl)(
  "bookings race guard — pg-driver layer (CAP-06)",
  () => {
    let accountId: string;

    beforeAll(async () => {
      // Reuse the stable test account (nsi-test) via the existing helper.
      accountId = await getOrCreateTestAccount();
    });

    it(
      "capacity=3, 10 concurrent pg-driver INSERTs → exactly 3 succeed",
      async () => {
        const sql = pgDirectClient(20);
        const admin = adminClient();

        try {
          const N = 10;
          const CAPACITY = 3;

          // Inline INSERT for event_type with EXPLICIT max_bookings_per_slot.
          // IMPORTANT: DB DEFAULT is 1 — must always be explicit for capacity=3 test.
          const slug = `test-race-cap3-${Date.now()}`;
          const { data: etData, error: etError } = await admin
            .from("event_types")
            .insert({
              account_id: accountId,
              slug,
              name: "Test Race Cap3",
              duration_minutes: 30,
              max_bookings_per_slot: CAPACITY,
            })
            .select("id")
            .single();
          if (etError || !etData) {
            throw new Error(
              `event_type INSERT failed: ${etError?.message ?? "no data"}`,
            );
          }
          const eventTypeId: string = etData.id;

          try {
            const startAt = new Date(Date.now() + 7 * 24 * 3600_000);
            const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

            // Each worker runs the SAME retry loop as the application (slot_index 1..CAPACITY).
            // The worker fires its INSERTs sequentially (slot_index=1, then 2, then 3) but
            // ALL 10 workers run concurrently. Workers that exhaust all 3 slot_indexes return null.
            const tryBook = async (workerId: number): Promise<string | null> => {
              for (let slotIndex = 1; slotIndex <= CAPACITY; slotIndex++) {
                try {
                  const rows = await sql`
                    INSERT INTO bookings (
                      account_id, event_type_id, start_at, end_at,
                      booker_name, booker_email, booker_timezone,
                      status, cancel_token_hash, reschedule_token_hash, slot_index
                    ) VALUES (
                      ${accountId}::uuid, ${eventTypeId}::uuid, ${startAt}, ${endAt},
                      ${"PG Worker " + workerId}, ${`pg-race-${workerId}@test.local`}, ${"America/Chicago"},
                      ${"confirmed"}, ${`pg-cancel-${workerId}-${slotIndex}`}, ${`pg-resched-${workerId}-${slotIndex}`}, ${slotIndex}
                    )
                    RETURNING id
                  `;
                  return rows[0].id as string; // success at this slot_index
                } catch (err: unknown) {
                  const code = (err as { code?: string })?.code;
                  if (code !== "23505") throw err; // non-capacity error: bubble up
                  // 23505: try next slot_index
                }
              }
              return null; // all CAPACITY slot_indexes exhausted
            };

            const results = await Promise.allSettled(
              Array.from({ length: N }, (_, i) => tryBook(i)),
            );

            const succeeded = results.filter(
              (r) => r.status === "fulfilled" && r.value !== null,
            );
            const exhausted = results.filter(
              (r) => r.status === "fulfilled" && r.value === null,
            );
            const errored = results.filter((r) => r.status === "rejected");

            expect(errored.length, "no unexpected errors").toBe(0);
            expect(succeeded.length, "exactly CAPACITY succeed").toBe(CAPACITY);
            expect(
              exhausted.length,
              "remaining return capacity-exhausted",
            ).toBe(N - CAPACITY);
          } finally {
            // Cleanup bookings then event_type
            await admin
              .from("bookings")
              .delete()
              .eq("event_type_id", eventTypeId);
            await admin.from("event_types").delete().eq("id", eventTypeId);
          }
        } finally {
          await sql.end({ timeout: 5 });
        }
      },
      30_000,
    ); // 30s timeout — concurrent connection setup can be slow

    it(
      "capacity=1, 5 concurrent pg-driver INSERTs → exactly 1 succeeds (regression for v1.0 invariant)",
      async () => {
        const sql = pgDirectClient(10);
        const admin = adminClient();

        try {
          const N = 5;
          const CAPACITY = 1;

          // Inline INSERT for event_type with EXPLICIT max_bookings_per_slot.
          // Still explicit even though CAPACITY=1 matches the DB default — do not rely on default.
          const slug = `test-race-cap1-${Date.now()}`;
          const { data: etData, error: etError } = await admin
            .from("event_types")
            .insert({
              account_id: accountId,
              slug,
              name: "Test Race Cap1",
              duration_minutes: 30,
              max_bookings_per_slot: CAPACITY,
            })
            .select("id")
            .single();
          if (etError || !etData) {
            throw new Error(
              `event_type INSERT failed: ${etError?.message ?? "no data"}`,
            );
          }
          const eventTypeId: string = etData.id;

          try {
            const startAt = new Date(Date.now() + 7 * 24 * 3600_000);
            const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

            const tryBook = async (workerId: number): Promise<string | null> => {
              for (let slotIndex = 1; slotIndex <= CAPACITY; slotIndex++) {
                try {
                  const rows = await sql`
                    INSERT INTO bookings (
                      account_id, event_type_id, start_at, end_at,
                      booker_name, booker_email, booker_timezone,
                      status, cancel_token_hash, reschedule_token_hash, slot_index
                    ) VALUES (
                      ${accountId}::uuid, ${eventTypeId}::uuid, ${startAt}, ${endAt},
                      ${"PG Cap1 " + workerId}, ${`pg-cap1-${workerId}@test.local`}, ${"America/Chicago"},
                      ${"confirmed"}, ${`pg-cap1-cancel-${workerId}`}, ${`pg-cap1-resched-${workerId}`}, ${slotIndex}
                    )
                    RETURNING id
                  `;
                  return rows[0].id as string;
                } catch (err: unknown) {
                  const code = (err as { code?: string })?.code;
                  if (code !== "23505") throw err;
                }
              }
              return null;
            };

            const results = await Promise.allSettled(
              Array.from({ length: N }, (_, i) => tryBook(i)),
            );

            const succeeded = results.filter(
              (r) => r.status === "fulfilled" && r.value !== null,
            );
            expect(succeeded.length, "exactly 1 succeeds for capacity=1").toBe(
              CAPACITY,
            );
          } finally {
            // Cleanup bookings then event_type
            await admin
              .from("bookings")
              .delete()
              .eq("event_type_id", eventTypeId);
            await admin.from("event_types").delete().eq("id", eventTypeId);
          }
        } finally {
          await sql.end({ timeout: 5 });
        }
      },
      30_000,
    );
  },
);
