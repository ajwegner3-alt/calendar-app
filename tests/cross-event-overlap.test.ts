// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import {
  adminClient,
  getOrCreateTestAccount,
} from "./helpers/supabase";
import { pgDirectClient, hasDirectUrl } from "./helpers/pg-direct";
import { rescheduleBooking } from "@/lib/bookings/reschedule";

const skipIfNoDirectUrl = !hasDirectUrl();

/**
 * Phase 27: EXCLUDE constraint behavior + application-layer 23P01 mapping.
 *
 * Constraint: bookings_no_account_cross_event_overlap
 *   EXCLUDE USING gist (
 *     account_id     WITH =,
 *     event_type_id  WITH <>,
 *     during         WITH &&
 *   ) WHERE (status = 'confirmed')
 *
 * These tests pin:
 *   1. Cross-event block (SLOT-01)
 *   2. Group-booking regression — same-event-type capacity coexistence (SLOT-02, V14-CP-04)
 *   3. Adjacent-slot non-collision (V14-CP-02 half-open '[)')
 *   4. Cancelled-doesn't-block (V14-CP-03 partial WHERE predicate)
 *   5. Reschedule cross-event collision (SLOT-03, V14-MP-02)
 *   6. Retry-loop-break — route.ts 23P01 BREAKS without incrementing slot_index (V14-MP-01)
 *
 * Skip-guarded with describe.skipIf(skipIfNoDirectUrl) per V14-MP-05 so CI
 * passes cleanly when SUPABASE_DIRECT_URL is unset.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline helpers (scoped to this file). getOrCreateTestEventType returns the
// same row on repeated calls and cannot create distinct event types — these
// tests need 2+ event types with controlled capacities.
// ─────────────────────────────────────────────────────────────────────────────

async function createEventType(
  admin: ReturnType<typeof adminClient>,
  accountId: string,
  slugSuffix: string,
  maxBookingsPerSlot = 1,
) {
  const slug = `test-x-${slugSuffix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const { data, error } = await admin
    .from("event_types")
    .insert({
      account_id: accountId,
      slug,
      name: `Test ${slugSuffix}`,
      duration_minutes: 30,
      max_bookings_per_slot: maxBookingsPerSlot,
    })
    .select("id, slug")
    .single();
  if (error || !data)
    throw new Error(`event_type insert failed: ${error?.message ?? "no data"}`);
  return { id: data.id as string, slug: data.slug as string };
}

async function cleanupEventType(
  admin: ReturnType<typeof adminClient>,
  eventTypeId: string,
) {
  await admin.from("bookings").delete().eq("event_type_id", eventTypeId);
  await admin.from("event_types").delete().eq("id", eventTypeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// pg-direct describe block (Tests 1-5). Skipped when SUPABASE_DIRECT_URL unset.
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoDirectUrl)(
  "Phase 27: EXCLUDE constraint cross-event overlap",
  () => {
    let accountId: string;

    beforeAll(async () => {
      accountId = await getOrCreateTestAccount();
    });

    // ─── Test 1: Cross-event block (SLOT-01) ─────────────────────────────────
    it(
      "blocks cross-event-type overlap on same account (23P01)",
      async () => {
        const sql = pgDirectClient(5);
        const admin = adminClient();
        const eventA = await createEventType(admin, accountId, "evA");
        const eventB = await createEventType(admin, accountId, "evB");
        try {
          const t0 = new Date(Date.now() + 14 * 24 * 3600_000);
          const aStart = new Date(t0);
          const aEnd = new Date(t0.getTime() + 30 * 60_000);
          const bStart = new Date(t0.getTime() + 15 * 60_000); // 15 min into A
          const bEnd = new Date(t0.getTime() + 45 * 60_000);

          // First insert succeeds.
          const aRows = await sql`
            INSERT INTO bookings (
              account_id, event_type_id, start_at, end_at,
              booker_name, booker_email, booker_timezone,
              status, cancel_token_hash, reschedule_token_hash, slot_index
            ) VALUES (
              ${accountId}::uuid, ${eventA.id}::uuid, ${aStart}, ${aEnd},
              ${"X1 A"}, ${"x1-a@test.local"}, ${"America/Chicago"},
              ${"confirmed"}, ${"x1-c-a"}, ${"x1-r-a"}, ${1}
            )
            RETURNING id
          `;
          expect(aRows.length).toBe(1);

          // Second insert collides → 23P01.
          let caught: { code?: string } | null = null;
          try {
            await sql`
              INSERT INTO bookings (
                account_id, event_type_id, start_at, end_at,
                booker_name, booker_email, booker_timezone,
                status, cancel_token_hash, reschedule_token_hash, slot_index
              ) VALUES (
                ${accountId}::uuid, ${eventB.id}::uuid, ${bStart}, ${bEnd},
                ${"X1 B"}, ${"x1-b@test.local"}, ${"America/Chicago"},
                ${"confirmed"}, ${"x1-c-b"}, ${"x1-r-b"}, ${1}
              )
            `;
          } catch (err: unknown) {
            caught = err as { code?: string };
          }
          expect(caught?.code).toBe("23P01");
        } finally {
          await cleanupEventType(admin, eventA.id);
          await cleanupEventType(admin, eventB.id);
          await sql.end({ timeout: 5 });
        }
      },
      30_000,
    );

    // ─── Test 2: Group-booking regression (SLOT-02, V14-CP-04) ───────────────
    // Same event_type, capacity=3, three confirmed bookings at the same slot
    // with slot_index 1, 2, 3 must ALL succeed. The EXCLUDE constraint uses
    // `event_type_id WITH <>`, so same-event_type rows are NOT exclusion peers.
    it(
      "preserves group-booking capacity coexistence on same event type (no 23P01)",
      async () => {
        const sql = pgDirectClient(5);
        const admin = adminClient();
        const eventC = await createEventType(admin, accountId, "evC", 3);
        try {
          const t0 = new Date(Date.now() + 14 * 24 * 3600_000 + 60 * 60_000); // +1h to avoid collision with test 1
          const startAt = new Date(t0);
          const endAt = new Date(t0.getTime() + 30 * 60_000);

          let successes = 0;
          let errors = 0;
          for (let slotIndex = 1; slotIndex <= 3; slotIndex++) {
            try {
              const rows = await sql`
                INSERT INTO bookings (
                  account_id, event_type_id, start_at, end_at,
                  booker_name, booker_email, booker_timezone,
                  status, cancel_token_hash, reschedule_token_hash, slot_index
                ) VALUES (
                  ${accountId}::uuid, ${eventC.id}::uuid, ${startAt}, ${endAt},
                  ${"X2 G" + slotIndex}, ${`x2-g${slotIndex}@test.local`}, ${"America/Chicago"},
                  ${"confirmed"}, ${`x2-c-${slotIndex}`}, ${`x2-r-${slotIndex}`}, ${slotIndex}
                )
                RETURNING id
              `;
              if (rows.length === 1) successes++;
            } catch {
              errors++;
            }
          }

          expect(successes, "all 3 same-event-type capacity slots succeed").toBe(
            3,
          );
          expect(errors, "no errors when overlap is within same event type").toBe(
            0,
          );
        } finally {
          await cleanupEventType(admin, eventC.id);
          await sql.end({ timeout: 5 });
        }
      },
      30_000,
    );

    // ─── Test 3: Adjacent-slot non-collision (V14-CP-02) ─────────────────────
    // tstzrange uses '[)' half-open bound. A booking ending at 9:30 does NOT
    // overlap a booking starting at 9:30 — so cross-event-type adjacent slots
    // must coexist. This pins the bound choice; if the migration is ever
    // changed to '[]' the assertion fires.
    it(
      "permits adjacent (non-overlapping) cross-event slots — half-open '[)' bound",
      async () => {
        const sql = pgDirectClient(5);
        const admin = adminClient();
        const eventD = await createEventType(admin, accountId, "evD");
        const eventE = await createEventType(admin, accountId, "evE");
        try {
          const t0 = new Date(Date.now() + 14 * 24 * 3600_000 + 2 * 60 * 60_000); // +2h
          const aStart = new Date(t0);
          const aEnd = new Date(t0.getTime() + 30 * 60_000);
          const bStart = new Date(t0.getTime() + 30 * 60_000); // adjacent — same instant as aEnd
          const bEnd = new Date(t0.getTime() + 60 * 60_000);

          const aRows = await sql`
            INSERT INTO bookings (
              account_id, event_type_id, start_at, end_at,
              booker_name, booker_email, booker_timezone,
              status, cancel_token_hash, reschedule_token_hash, slot_index
            ) VALUES (
              ${accountId}::uuid, ${eventD.id}::uuid, ${aStart}, ${aEnd},
              ${"X3 D"}, ${"x3-d@test.local"}, ${"America/Chicago"},
              ${"confirmed"}, ${"x3-c-d"}, ${"x3-r-d"}, ${1}
            )
            RETURNING id
          `;
          expect(aRows.length).toBe(1);

          // Adjacent insert MUST succeed.
          const bRows = await sql`
            INSERT INTO bookings (
              account_id, event_type_id, start_at, end_at,
              booker_name, booker_email, booker_timezone,
              status, cancel_token_hash, reschedule_token_hash, slot_index
            ) VALUES (
              ${accountId}::uuid, ${eventE.id}::uuid, ${bStart}, ${bEnd},
              ${"X3 E"}, ${"x3-e@test.local"}, ${"America/Chicago"},
              ${"confirmed"}, ${"x3-c-e"}, ${"x3-r-e"}, ${1}
            )
            RETURNING id
          `;
          expect(bRows.length, "adjacent slot inserts cleanly").toBe(1);
        } finally {
          await cleanupEventType(admin, eventD.id);
          await cleanupEventType(admin, eventE.id);
          await sql.end({ timeout: 5 });
        }
      },
      30_000,
    );

    // ─── Test 4: Cancelled-doesn't-block (V14-CP-03) ─────────────────────────
    // The constraint has `WHERE (status = 'confirmed')`. Cancelled rows are
    // outside the partial predicate and must NOT block confirmed inserts.
    // Then promoting the cancelled row to confirmed (via UPDATE) must fire
    // 23P01, proving the constraint is enforced on UPDATE too.
    it(
      "does not block when overlapping row is cancelled; UPDATE-to-confirmed re-fires constraint",
      async () => {
        const sql = pgDirectClient(5);
        const admin = adminClient();
        const eventF = await createEventType(admin, accountId, "evF");
        const eventG = await createEventType(admin, accountId, "evG");
        try {
          const t0 = new Date(Date.now() + 14 * 24 * 3600_000 + 3 * 60 * 60_000); // +3h
          const startAt = new Date(t0);
          const endAt = new Date(t0.getTime() + 30 * 60_000);

          // Cancelled booking on F.
          const fRows = await sql`
            INSERT INTO bookings (
              account_id, event_type_id, start_at, end_at,
              booker_name, booker_email, booker_timezone,
              status, cancel_token_hash, reschedule_token_hash, slot_index
            ) VALUES (
              ${accountId}::uuid, ${eventF.id}::uuid, ${startAt}, ${endAt},
              ${"X4 F"}, ${"x4-f@test.local"}, ${"America/Chicago"},
              ${"cancelled"}, ${"x4-c-f"}, ${"x4-r-f"}, ${1}
            )
            RETURNING id
          `;
          expect(fRows.length).toBe(1);
          const fId = fRows[0].id as string;

          // Confirmed booking on G at the same instant — must succeed.
          const gRows = await sql`
            INSERT INTO bookings (
              account_id, event_type_id, start_at, end_at,
              booker_name, booker_email, booker_timezone,
              status, cancel_token_hash, reschedule_token_hash, slot_index
            ) VALUES (
              ${accountId}::uuid, ${eventG.id}::uuid, ${startAt}, ${endAt},
              ${"X4 G"}, ${"x4-g@test.local"}, ${"America/Chicago"},
              ${"confirmed"}, ${"x4-c-g"}, ${"x4-r-g"}, ${1}
            )
            RETURNING id
          `;
          expect(gRows.length, "confirmed insert succeeds despite cancelled overlap").toBe(1);

          // Now promote F from cancelled → confirmed. With G already confirmed,
          // this UPDATE must raise 23P01.
          let caught: { code?: string } | null = null;
          try {
            await sql`
              UPDATE bookings
                 SET status = ${"confirmed"}
               WHERE id = ${fId}::uuid
            `;
          } catch (err: unknown) {
            caught = err as { code?: string };
          }
          expect(
            caught?.code,
            "UPDATE-to-confirmed on overlapping cancelled row fires 23P01",
          ).toBe("23P01");
        } finally {
          await cleanupEventType(admin, eventF.id);
          await cleanupEventType(admin, eventG.id);
          await sql.end({ timeout: 5 });
        }
      },
      30_000,
    );

    // ─── Test 5: Reschedule cross-event collision (SLOT-03, V14-MP-02) ───────
    // Calls the real rescheduleBooking() function. Two event types (H, I);
    // confirmed booking on each at non-overlapping times. Reschedule the I
    // booking INTO an overlap with the H booking → result.reason === 'slot_taken'.
    // Then reschedule it to a clean slot → result.ok === true.
    it(
      "rescheduleBooking maps cross-event 23P01 → reason 'slot_taken'; happy path still ok",
      async () => {
        const sql = pgDirectClient(5);
        const admin = adminClient();
        const eventH = await createEventType(admin, accountId, "evH");
        const eventI = await createEventType(admin, accountId, "evI");
        try {
          const t0 = new Date(Date.now() + 14 * 24 * 3600_000 + 4 * 60 * 60_000); // +4h
          const hStart = new Date(t0);
          const hEnd = new Date(t0.getTime() + 30 * 60_000);
          const iStart = new Date(t0.getTime() + 60 * 60_000); // +1h after H, no overlap
          const iEnd = new Date(t0.getTime() + 90 * 60_000);

          // Insert H booking.
          await sql`
            INSERT INTO bookings (
              account_id, event_type_id, start_at, end_at,
              booker_name, booker_email, booker_timezone,
              status, cancel_token_hash, reschedule_token_hash, slot_index
            ) VALUES (
              ${accountId}::uuid, ${eventH.id}::uuid, ${hStart}, ${hEnd},
              ${"X5 H"}, ${"x5-h@test.local"}, ${"America/Chicago"},
              ${"confirmed"}, ${"x5-c-h"}, ${"x5-r-h"}, ${1}
            )
          `;

          // Insert I booking with a known reschedule_token_hash so we can
          // pass it to rescheduleBooking() as oldRescheduleHash.
          const iRescheduleHash = `x5-r-i-${Date.now()}`;
          const iRows = await sql`
            INSERT INTO bookings (
              account_id, event_type_id, start_at, end_at,
              booker_name, booker_email, booker_timezone,
              status, cancel_token_hash, reschedule_token_hash, slot_index
            ) VALUES (
              ${accountId}::uuid, ${eventI.id}::uuid, ${iStart}, ${iEnd},
              ${"X5 I"}, ${"x5-i@test.local"}, ${"America/Chicago"},
              ${"confirmed"}, ${`x5-c-i-${Date.now()}`}, ${iRescheduleHash}, ${1}
            )
            RETURNING id
          `;
          expect(iRows.length).toBe(1);
          const iId = iRows[0].id as string;

          // Attempt to reschedule I into the H slot — must fire 23P01 inside
          // rescheduleBooking and surface as reason 'slot_taken'.
          const collidingStart = new Date(t0.getTime() + 15 * 60_000); // overlaps H
          const collidingEnd = new Date(t0.getTime() + 45 * 60_000);

          const collidingResult = await rescheduleBooking({
            bookingId: iId,
            oldRescheduleHash: iRescheduleHash,
            newStartAt: collidingStart.toISOString(),
            newEndAt: collidingEnd.toISOString(),
            appUrl: "https://example.test",
          });
          expect(collidingResult.ok).toBe(false);
          if (!collidingResult.ok) {
            expect(collidingResult.reason).toBe("slot_taken");
          }

          // Now reschedule I to a clean (non-conflicting) slot. The first
          // reschedule failed BEFORE the UPDATE landed, so the row still has
          // its original reschedule_token_hash and oldRescheduleHash is still
          // valid. The clean slot is +5h from t0 — well clear of H.
          const cleanStart = new Date(t0.getTime() + 5 * 60 * 60_000);
          const cleanEnd = new Date(t0.getTime() + 5 * 60 * 60_000 + 30 * 60_000);
          const cleanResult = await rescheduleBooking({
            bookingId: iId,
            oldRescheduleHash: iRescheduleHash,
            newStartAt: cleanStart.toISOString(),
            newEndAt: cleanEnd.toISOString(),
            appUrl: "https://example.test",
          });
          expect(cleanResult.ok, "happy-path reschedule still works").toBe(true);
        } finally {
          await cleanupEventType(admin, eventH.id);
          await cleanupEventType(admin, eventI.id);
          await sql.end({ timeout: 5 });
        }
      },
      30_000,
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 (route.ts retry-loop-break invariant) lives OUTSIDE the skipIf block.
// It is a static-text scan — no DB, no SUPABASE_DIRECT_URL — and runs in CI.
// Mirrors the bookings-table-rsc-boundary.test.ts (Phase 26) precedent for
// structural regression guards.
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 27: route.ts retry-loop-break invariant (V14-MP-01)", () => {
  it("retry loop in app/api/bookings/route.ts BREAKS on 23P01 without incrementing slot_index (V14-MP-01)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("app/api/bookings/route.ts", "utf8");

    // Assert the 23P01 branch exists and is positioned BEFORE the 23505 retry guard.
    const idx23P01 = src.indexOf('code === "23P01"');
    const idx23505 = src.indexOf('code !== "23505"');
    expect(idx23P01, "23P01 branch must exist").toBeGreaterThan(-1);
    expect(idx23505, "23505 retry guard must exist").toBeGreaterThan(-1);
    expect(
      idx23P01,
      "23P01 branch must come BEFORE the 23505 retry guard",
    ).toBeLessThan(idx23505);

    // Assert the 23P01 block is followed by a `break;` statement (not `continue;`
    // and not a slot_index increment) within the next 500 chars.
    const after23P01 = src.slice(idx23P01, idx23P01 + 500);
    expect(after23P01).toMatch(/break;/);
    expect(after23P01).not.toMatch(/slot_?[Ii]ndex\s*[+]+/);
    expect(after23P01).not.toMatch(/slot_?[Ii]ndex\s*=\s*slot_?[Ii]ndex\s*\+/);
    expect(after23P01).not.toMatch(/continue;/);
  });
});
