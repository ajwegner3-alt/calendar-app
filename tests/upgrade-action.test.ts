// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requestUpgradeCore,
  type RequestUpgradeArgs,
  type RequestUpgradeDeps,
} from "@/app/(shell)/app/settings/upgrade/_lib/actions";

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function buildRlsClient(opts: {
  claims?: { sub?: string; email?: string } | null;
  account?: {
    id: string;
    name: string;
    owner_email: string | null;
    last_upgrade_request_at: string | null;
  } | null;
}) {
  return {
    auth: {
      getClaims: vi.fn(async () => ({
        data: opts.claims === null
          ? { claims: null }
          : { claims: opts.claims ?? { sub: "user-1", email: "owner@example.com" } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        is: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: opts.account ?? null, error: null })),
        })),
      })),
    })),
  } as unknown as RequestUpgradeDeps["rlsClient"];
}

function buildAdminClient(opts: { updateError?: unknown } = {}) {
  const updateMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: opts.updateError ?? null })),
  }));
  return {
    client: {
      from: vi.fn(() => ({ update: updateMock })),
    } as unknown as RequestUpgradeDeps["adminClient"],
    updateMock,
  };
}

function buildResendClient(opts: {
  send?: { success: boolean; messageId?: string; error?: string };
} = {}) {
  const sendMock = vi.fn(async () =>
    opts.send ?? { success: true, messageId: "msg-test-1" },
  );
  return {
    client: {
      provider: "resend" as const,
      send: sendMock,
    } as RequestUpgradeDeps["resendClient"],
    sendMock,
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ACCOUNT_OK = {
  id: "acc-1",
  name: "Acme Plumbing",
  owner_email: "owner@example.com",
  last_upgrade_request_at: null,
};

const ARGS_NO_MESSAGE: RequestUpgradeArgs = { message: "" };
const ARGS_WITH_MESSAGE: RequestUpgradeArgs = {
  message: "We're hitting the cap most days, please bump us.",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requestUpgradeCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Happy path — sends Resend email and writes timestamp
  it("happy path: sends email and writes timestamp, send happens before update", async () => {
    const rlsClient = buildRlsClient({ account: ACCOUNT_OK });
    const { client: adminClient, updateMock } = buildAdminClient();
    const { client: resendClient, sendMock } = buildResendClient();

    const result = await requestUpgradeCore(ARGS_WITH_MESSAGE, {
      rlsClient,
      adminClient,
      resendClient,
    });

    expect(result).toEqual({ ok: true });

    // Assert to is the hardcoded recipient
    const sendArgs = sendMock.mock.calls[0][0];
    expect(sendArgs.to).toBe("ajwegner3@gmail.com");

    // Assert subject uses accounts.name
    expect(sendArgs.subject).toBe("Upgrade request — Acme Plumbing");

    // Assert Reply-To uses claims email
    expect(sendArgs.replyTo).toBe("owner@example.com");

    // Assert HTML contains the message text and business name.
    // The message goes through escapeHtml() so the apostrophe becomes &#39;.
    expect(sendArgs.html).toContain("We&#39;re hitting the cap most days, please bump us.");
    expect(sendArgs.html).toContain("Acme Plumbing");

    // Assert updateMock was called once (timestamp written)
    expect(updateMock).toHaveBeenCalledTimes(1);

    // Assert send happened BEFORE update (source-order / invocation-order check)
    expect(sendMock.mock.invocationCallOrder[0]).toBeLessThan(
      updateMock.mock.invocationCallOrder[0],
    );
  });

  // Test 2: Empty message — body shows "(no message provided)"
  it("empty message: body shows (no message provided)", async () => {
    const rlsClient = buildRlsClient({ account: ACCOUNT_OK });
    const { client: adminClient } = buildAdminClient();
    const { client: resendClient, sendMock } = buildResendClient();

    await requestUpgradeCore(ARGS_NO_MESSAGE, {
      rlsClient,
      adminClient,
      resendClient,
    });

    const sendArgs = sendMock.mock.calls[0][0];
    expect(sendArgs.html).toContain("(no message provided)");
  });

  // Test 3: 24h block — within window returns ok:false and does not send
  it("24h block: within window returns ok:false and does not send or update", async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const rlsClient = buildRlsClient({
      account: { ...ACCOUNT_OK, last_upgrade_request_at: oneHourAgo },
    });
    const { client: adminClient, updateMock } = buildAdminClient();
    const { client: resendClient, sendMock } = buildResendClient();

    const result = await requestUpgradeCore(ARGS_WITH_MESSAGE, {
      rlsClient,
      adminClient,
      resendClient,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Already requested in the last 24 hours/);
    }
    expect(sendMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  // Test 4: 24h boundary — exactly 24h + 1s ago is allowed (sends)
  it("24h boundary: exactly 24h+1s ago is allowed and sends", async () => {
    const justOver24hAgo = new Date(
      Date.now() - (24 * 60 * 60 * 1000 + 1000),
    ).toISOString();
    const rlsClient = buildRlsClient({
      account: { ...ACCOUNT_OK, last_upgrade_request_at: justOver24hAgo },
    });
    const { client: adminClient } = buildAdminClient();
    const { client: resendClient, sendMock } = buildResendClient();

    const result = await requestUpgradeCore(ARGS_WITH_MESSAGE, {
      rlsClient,
      adminClient,
      resendClient,
    });

    expect(result).toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  // Test 5: Resend failure — DB write skipped, user-facing error surfaced
  it("Resend failure: DB write skipped and user-facing error returned", async () => {
    const rlsClient = buildRlsClient({ account: ACCOUNT_OK });
    const { client: adminClient, updateMock } = buildAdminClient();
    const { client: resendClient } = buildResendClient({
      send: { success: false, error: "resend_send_refused: 422 domain_not_found" },
    });

    const result = await requestUpgradeCore(ARGS_WITH_MESSAGE, {
      rlsClient,
      adminClient,
      resendClient,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // User-facing string — NOT the raw Resend error
      expect(result.error).toBe(
        "Could not send the upgrade request right now. Please try again in a moment.",
      );
    }
    // Timestamp must NOT be written if send failed
    expect(updateMock).not.toHaveBeenCalled();
  });

  // Test 6: No claims — returns "Not signed in." and never reads account
  it("no claims: returns Not signed in without reading account", async () => {
    const rlsClient = buildRlsClient({ claims: null });
    const { client: adminClient, updateMock } = buildAdminClient();
    const { client: resendClient, sendMock } = buildResendClient();

    const result = await requestUpgradeCore(ARGS_WITH_MESSAGE, {
      rlsClient,
      adminClient,
      resendClient,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Not signed in/);
    }
    expect(sendMock).not.toHaveBeenCalled();
    // from() mock on rlsClient should NOT have been called (short-circuit on auth)
    expect((rlsClient as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  // Test 7: Account not found — returns error, no send
  it("account not found: returns Account not found without sending", async () => {
    const rlsClient = buildRlsClient({ account: null });
    const { client: adminClient } = buildAdminClient();
    const { client: resendClient, sendMock } = buildResendClient();

    const result = await requestUpgradeCore(ARGS_WITH_MESSAGE, {
      rlsClient,
      adminClient,
      resendClient,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Account not found/);
    }
    expect(sendMock).not.toHaveBeenCalled();
  });

  // Test 8: Sequential double-submit — second call sees the just-written timestamp and is rejected
  it("sequential double-submit: second call is rejected, sendMock called exactly once", async () => {
    // Stateful: holds the timestamp captured from the first successful update
    let capturedTimestamp: string | null = null;

    // Stateful admin client — update mock captures the timestamp it was called with
    const updateEqMock = vi.fn(async () => {
      return { error: null };
    });
    const updateMock = vi.fn((payload: { last_upgrade_request_at: string }) => {
      capturedTimestamp = payload.last_upgrade_request_at;
      return { eq: updateEqMock };
    });
    const adminClient = {
      from: vi.fn(() => ({ update: updateMock })),
    } as unknown as RequestUpgradeDeps["adminClient"];

    // Stateful RLS client — returns the captured timestamp on each call after first write
    const buildStatefulRlsClient = () => ({
      auth: {
        getClaims: vi.fn(async () => ({
          data: { claims: { sub: "user-1", email: "owner@example.com" } },
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                ...ACCOUNT_OK,
                last_upgrade_request_at: capturedTimestamp,
              },
              error: null,
            })),
          })),
        })),
      })),
    }) as unknown as RequestUpgradeDeps["rlsClient"];

    const { client: resendClient, sendMock } = buildResendClient();

    // First call: no timestamp yet → should succeed and capture the timestamp
    const firstResult = await requestUpgradeCore(ARGS_WITH_MESSAGE, {
      rlsClient: buildStatefulRlsClient(),
      adminClient,
      resendClient,
    });
    expect(firstResult).toEqual({ ok: true });
    expect(capturedTimestamp).not.toBeNull();

    // Second call: rlsClient now returns the captured timestamp → should be rejected
    const secondResult = await requestUpgradeCore(ARGS_WITH_MESSAGE, {
      rlsClient: buildStatefulRlsClient(),
      adminClient,
      resendClient,
    });
    expect(secondResult.ok).toBe(false);
    if (!secondResult.ok) {
      expect(secondResult.error).toMatch(/Already requested in the last 24 hours/);
    }

    // sendMock called exactly ONCE across both invocations
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  // Test 9: Reply-To falls back to account.owner_email when claims.email is missing
  it("reply-to fallback: uses account.owner_email when claims.email is missing", async () => {
    const rlsClient = buildRlsClient({
      claims: { sub: "user-1" }, // no email in claims
      account: { ...ACCOUNT_OK, owner_email: "fallback@example.com" },
    });
    const { client: adminClient } = buildAdminClient();
    const { client: resendClient, sendMock } = buildResendClient();

    const result = await requestUpgradeCore(ARGS_WITH_MESSAGE, {
      rlsClient,
      adminClient,
      resendClient,
    });

    expect(result).toEqual({ ok: true });
    const sendArgs = sendMock.mock.calls[0][0];
    expect(sendArgs.replyTo).toBe("fallback@example.com");
  });
});
