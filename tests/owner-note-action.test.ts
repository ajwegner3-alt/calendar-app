// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

import { saveOwnerNoteCore } from "@/app/(shell)/app/bookings/[id]/_lib/owner-note-action";

/**
 * Plan 08-07 owner-note Server Action tests.
 *
 * Exercises `saveOwnerNoteCore` (the inner authorization + write logic)
 * directly with structural mock clients. This mirrors the Phase 6 cancel
 * test pattern (STATE.md line 178): tests bypass the Server Action wrapper
 * because cookies() / next/cache require a Next.js request scope that
 * vitest doesn't provide.
 *
 * Coverage:
 *   1. No owner accounts → "Booking not found."
 *   2. Booking belongs to a different account → "Booking not found." (no UUID leak)
 *   3. Booking does not exist → "Booking not found."
 *   4. Happy path → admin UPDATE called with the right note, returns ok.
 *   5. Empty string → admin UPDATE writes owner_note: null.
 *   6. Length cap → 6000-char note is truncated to 5000 before UPDATE.
 */

const BOOKING_ID = "11111111-1111-1111-1111-111111111111";
const ACCOUNT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ACCOUNT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

/**
 * Build a structural-mock RLS client. The Supabase chain we exercise is:
 *   rpc("current_owner_account_ids")
 *   from("bookings").select(...).eq(...).maybeSingle()
 */
function makeRlsClient(opts: {
  rpcResult: { data: unknown };
  bookingResult: { data: { id: string; account_id: string } | null };
}) {
  return {
    rpc: vi.fn(async () => opts.rpcResult),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => opts.bookingResult),
        })),
      })),
    })),
  };
}

/**
 * Build a structural-mock admin client. The chain we exercise is:
 *   from("bookings").update({ owner_note }).eq("id", bookingId)
 *
 * Returns the spy on update() so tests can assert exactly what was written.
 */
function makeAdminClient(opts: { updateError?: { message: string } | null } = {}) {
  const updateSpy = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: opts.updateError ?? null })),
  }));
  const client = {
    from: vi.fn(() => ({
      update: updateSpy,
    })),
  };
  return { client, updateSpy };
}

describe("saveOwnerNoteCore — two-stage owner authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies when caller has no owner accounts", async () => {
    const rls = makeRlsClient({
      rpcResult: { data: [] },
      bookingResult: { data: null },
    });
    const { client: admin, updateSpy } = makeAdminClient();

    const result = await saveOwnerNoteCore(
      { bookingId: BOOKING_ID, note: "hello" },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: false, error: "Booking not found." });
    // Critical: NO admin write happened — authorization failed before write.
    expect(updateSpy).not.toHaveBeenCalled();
    // Booking lookup should also have been skipped (RPC denial is a hard stop).
    expect(rls.from).not.toHaveBeenCalled();
  });

  it("denies when booking belongs to a different account (no UUID leak)", async () => {
    // Caller owns ACCOUNT_A; booking is owned by ACCOUNT_B. The RLS-scoped
    // SELECT should normally return null in production (RLS filters it out)
    // but defense-in-depth: the ownership check rejects even if RLS were
    // somehow permissive.
    const rls = makeRlsClient({
      rpcResult: { data: [ACCOUNT_A] },
      bookingResult: { data: { id: BOOKING_ID, account_id: ACCOUNT_B } },
    });
    const { client: admin, updateSpy } = makeAdminClient();

    const result = await saveOwnerNoteCore(
      { bookingId: BOOKING_ID, note: "hello" },
      { rlsClient: rls, adminClient: admin },
    );

    // SAME error string as the "not found" case — no UUID-existence leakage.
    expect(result).toEqual({ ok: false, error: "Booking not found." });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("denies when booking does not exist", async () => {
    const rls = makeRlsClient({
      rpcResult: { data: [ACCOUNT_A] },
      bookingResult: { data: null },
    });
    const { client: admin, updateSpy } = makeAdminClient();

    const result = await saveOwnerNoteCore(
      { bookingId: BOOKING_ID, note: "hello" },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: false, error: "Booking not found." });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("writes the note when caller owns the booking (happy path)", async () => {
    const rls = makeRlsClient({
      rpcResult: { data: [ACCOUNT_A] },
      bookingResult: { data: { id: BOOKING_ID, account_id: ACCOUNT_A } },
    });
    const { client: admin, updateSpy } = makeAdminClient();

    const result = await saveOwnerNoteCore(
      { bookingId: BOOKING_ID, note: "Call back at 2pm" },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: true });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith({ owner_note: "Call back at 2pm" });
    // And the admin client targeted the bookings table.
    expect(admin.from).toHaveBeenCalledWith("bookings");
  });

  it("normalizes empty string to NULL (clears the note)", async () => {
    const rls = makeRlsClient({
      rpcResult: { data: [ACCOUNT_A] },
      bookingResult: { data: { id: BOOKING_ID, account_id: ACCOUNT_A } },
    });
    const { client: admin, updateSpy } = makeAdminClient();

    const result = await saveOwnerNoteCore(
      { bookingId: BOOKING_ID, note: "" },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: true });
    expect(updateSpy).toHaveBeenCalledWith({ owner_note: null });
  });

  it("caps length at 5000 chars before writing", async () => {
    const rls = makeRlsClient({
      rpcResult: { data: [ACCOUNT_A] },
      bookingResult: { data: { id: BOOKING_ID, account_id: ACCOUNT_A } },
    });
    const { client: admin, updateSpy } = makeAdminClient();

    const huge = "x".repeat(6000);
    const result = await saveOwnerNoteCore(
      { bookingId: BOOKING_ID, note: huge },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: true });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const writtenNote = (updateSpy.mock.calls[0][0] as { owner_note: string })
      .owner_note;
    expect(writtenNote.length).toBe(5000);
    expect(writtenNote).toBe("x".repeat(5000));
  });

  it("returns 'Save failed.' when admin UPDATE errors", async () => {
    const rls = makeRlsClient({
      rpcResult: { data: [ACCOUNT_A] },
      bookingResult: { data: { id: BOOKING_ID, account_id: ACCOUNT_A } },
    });
    const { client: admin } = makeAdminClient({
      updateError: { message: "DB exploded" },
    });

    const result = await saveOwnerNoteCore(
      { bookingId: BOOKING_ID, note: "hi" },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: false, error: "Save failed." });
  });
});
