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
