// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

import { saveReminderTogglesCore } from "@/app/(shell)/app/settings/reminders/_lib/actions";

/**
 * Plan 08-05 reminder-toggles Server Action tests.
 *
 * Exercises `saveReminderTogglesCore` (the inner authorization + write logic)
 * directly with structural mock clients. Mirrors the Plan 08-07 owner-note
 * test pattern (which mirrors the Phase 6 cancel-test pattern from STATE.md
 * line 178): tests bypass the Server Action wrapper because cookies() /
 * next/cache require a Next request scope vitest doesn't provide.
 *
 * Coverage:
 *   1. Unauthenticated → "Unauthorized"
 *   2. Wrong account → "Forbidden"
 *   3. Unknown toggle key → "Unknown toggle key"
 *   4. Happy path for each of the three toggle keys → admin UPDATE called
 *      with the correct DB column + value, returns ok.
 *   5. Admin write error → "Save failed"
 */

const ACCOUNT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ACCOUNT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Build a structural-mock RLS client. The chain we exercise is:
 *   auth.getUser()
 *   rpc("current_owner_account_ids")
 */
function makeRlsClient(opts: {
  user: { id: string } | null;
  ownerAccountIds: string[];
}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.user } })),
    },
    rpc: vi.fn(async () => ({ data: opts.ownerAccountIds })),
  };
}

/**
 * Build a structural-mock admin client. The chain we exercise is:
 *   from("accounts").update({ [column]: value }).eq("id", accountId)
 *
 * Returns spies so tests can assert what was written + on which row.
 */
function makeAdminClient(opts: { updateError?: { message: string } | null } = {}) {
  const eqSpy = vi.fn(async () => ({ error: opts.updateError ?? null }));
  const updateSpy = vi.fn(() => ({ eq: eqSpy }));
  const fromSpy = vi.fn(() => ({ update: updateSpy }));
  return {
    client: { from: fromSpy },
    fromSpy,
    updateSpy,
    eqSpy,
  };
}

describe("saveReminderTogglesCore — two-stage owner authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns Unauthorized when caller is not signed in", async () => {
    const rls = makeRlsClient({ user: null, ownerAccountIds: [] });
    const { client: admin, updateSpy } = makeAdminClient();

    const result = await saveReminderTogglesCore(
      { accountId: ACCOUNT_A, key: "custom_answers", value: true },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    // Must NOT have attempted to write.
    expect(updateSpy).not.toHaveBeenCalled();
    // Must NOT have looked up ownership (short-circuit on auth).
    expect(rls.rpc).not.toHaveBeenCalled();
  });

  it("returns Forbidden when accountId belongs to a different owner", async () => {
    const rls = makeRlsClient({
      user: { id: USER_ID },
      ownerAccountIds: [ACCOUNT_A], // caller owns A...
    });
    const { client: admin, updateSpy } = makeAdminClient();

    const result = await saveReminderTogglesCore(
      { accountId: ACCOUNT_B, key: "location", value: false }, // ...but tries to mutate B
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("returns Forbidden when caller has no owner accounts at all", async () => {
    const rls = makeRlsClient({
      user: { id: USER_ID },
      ownerAccountIds: [],
    });
    const { client: admin, updateSpy } = makeAdminClient();

    const result = await saveReminderTogglesCore(
      { accountId: ACCOUNT_A, key: "lifecycle_links", value: true },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects an unknown toggle key without writing", async () => {
    const rls = makeRlsClient({
      user: { id: USER_ID },
      ownerAccountIds: [ACCOUNT_A],
    });
    const { client: admin, updateSpy } = makeAdminClient();

    const result = await saveReminderTogglesCore(
      // Cast through unknown — production callers can only pass the union, but
      // tests need to prove the defensive branch exists in case JS callers slip.
      {
        accountId: ACCOUNT_A,
        key: "nope" as unknown as "custom_answers",
        value: true,
      },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: false, error: "Unknown toggle key" });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it.each([
    { key: "custom_answers", column: "reminder_include_custom_answers", value: true },
    { key: "custom_answers", column: "reminder_include_custom_answers", value: false },
    { key: "location", column: "reminder_include_location", value: true },
    { key: "location", column: "reminder_include_location", value: false },
    { key: "lifecycle_links", column: "reminder_include_lifecycle_links", value: true },
    { key: "lifecycle_links", column: "reminder_include_lifecycle_links", value: false },
  ] as const)(
    "happy path: $key=$value writes accounts.$column",
    async ({ key, column, value }) => {
      const rls = makeRlsClient({
        user: { id: USER_ID },
        ownerAccountIds: [ACCOUNT_A],
      });
      const { client: admin, fromSpy, updateSpy, eqSpy } = makeAdminClient();

      const result = await saveReminderTogglesCore(
        { accountId: ACCOUNT_A, key, value },
        { rlsClient: rls, adminClient: admin },
      );

      expect(result).toEqual({ ok: true });
      expect(fromSpy).toHaveBeenCalledWith("accounts");
      expect(updateSpy).toHaveBeenCalledTimes(1);
      // Exact column-name mapping is the regression guard this whole test
      // file exists to enforce.
      expect(updateSpy).toHaveBeenCalledWith({ [column]: value });
      expect(eqSpy).toHaveBeenCalledWith("id", ACCOUNT_A);
    },
  );

  it("returns Save failed when the admin UPDATE errors", async () => {
    const rls = makeRlsClient({
      user: { id: USER_ID },
      ownerAccountIds: [ACCOUNT_A],
    });
    const { client: admin } = makeAdminClient({
      updateError: { message: "connection reset" },
    });

    const result = await saveReminderTogglesCore(
      { accountId: ACCOUNT_A, key: "custom_answers", value: true },
      { rlsClient: rls, adminClient: admin },
    );

    expect(result).toEqual({ ok: false, error: "Save failed" });
  });
});
