// @vitest-environment node
/**
 * Plan 35-03 — account-sender.ts unit tests.
 *
 * Tests getSenderForAccount(accountId) — the per-account Gmail OAuth sender factory.
 * Mocks:
 *   - @/lib/supabase/admin (createAdminClient) — no real DB calls
 *   - @/lib/oauth/google (fetchGoogleAccessToken) — no real HTTP calls
 *   - @/lib/oauth/encrypt (decryptToken) — no real crypto (avoids needing GMAIL_TOKEN_ENCRYPTION_KEY)
 *
 * 9 test cases covering all branches:
 *   1. Happy path — returns an EmailClient with provider:"gmail"
 *   2. No account row — refused with "no account row"
 *   3. Account missing owner_email — refused with "missing owner_email"
 *   4. No credential row — refused with "no credential"
 *   5. Credential status needs_reconnect — refused, fetchGoogleAccessToken NOT called
 *   6. Decrypt throws — refused with "decrypt failed", fetchGoogleAccessToken NOT called
 *   7. invalid_grant from Google — refused, DB update to needs_reconnect fires
 *   8. Other token exchange failure — refused, NO needs_reconnect update
 *   9. REFUSED_SEND_ERROR_PREFIX exported constant value
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock state — closures allow per-test control via setters below.
// ---------------------------------------------------------------------------

type AccountRow = { owner_user_id: string; owner_email: string | null } | null;
type CredRow = { refresh_token_encrypted: string; status: string } | null;

let _accountResult: { data: AccountRow; error: object | null } = {
  data: { owner_user_id: "user-abc", owner_email: "owner@example.com" },
  error: null,
};
let _credResult: { data: CredRow; error: object | null } = {
  data: { refresh_token_encrypted: "iv:tag:cipher", status: "active" },
  error: null,
};

// Track update calls for invalid_grant side-effect assertions
const _updateCalls: Array<{ table: string; payload: object; filters: Array<[string, unknown]> }> = [];

function resetMocks() {
  _accountResult = {
    data: { owner_user_id: "user-abc", owner_email: "owner@example.com" },
    error: null,
  };
  _credResult = {
    data: { refresh_token_encrypted: "iv:tag:cipher", status: "active" },
    error: null,
  };
  _updateCalls.length = 0;
}

// ---------------------------------------------------------------------------
// Chainable Supabase mock factory.
//
// Handles two SELECT chains:
//   .from("accounts").select(...).eq(...).maybeSingle()
//   .from("account_oauth_credentials").select(...).eq(...).eq(...).maybeSingle()
//
// And one UPDATE chain:
//   .from("account_oauth_credentials").update({...}).eq(...).eq(...)
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    return {
      from: (table: string) => {
        // SELECT path
        const selectChain = (result: { data: unknown; error: object | null }) => {
          const eqFilters: Array<[string, unknown]> = [];
          const chain: {
            eq: (col: string, val: unknown) => typeof chain;
            maybeSingle: () => Promise<{ data: unknown; error: object | null }>;
          } = {
            eq: (col: string, val: unknown) => {
              eqFilters.push([col, val]);
              return chain;
            },
            maybeSingle: () => Promise.resolve(result),
          };
          return chain;
        };

        // UPDATE path — returns a chainable that records the call
        const updateChain = (payload: object) => {
          const eqFilters: Array<[string, unknown]> = [];
          const chain: {
            eq: (col: string, val: unknown) => typeof chain;
          } & Promise<{ error: null }> = Object.assign(
            Promise.resolve({ error: null }),
            {
              eq: (col: string, val: unknown) => {
                eqFilters.push([col, val]);
                _updateCalls.push({ table, payload, filters: eqFilters });
                return chain;
              },
            }
          );
          return chain;
        };

        return {
          select: (_cols: string) => {
            const result =
              table === "accounts" ? _accountResult : _credResult;
            return selectChain(result);
          },
          update: (payload: object) => updateChain(payload),
        };
      },
    };
  },
}));

// ---------------------------------------------------------------------------
// Mock fetchGoogleAccessToken — per-test control via mockFetchToken
// ---------------------------------------------------------------------------
const mockFetchToken = vi.fn();
vi.mock("@/lib/oauth/google", () => ({
  fetchGoogleAccessToken: (...args: unknown[]) => mockFetchToken(...args),
}));

// ---------------------------------------------------------------------------
// Mock decryptToken — per-test control via mockDecrypt
// ---------------------------------------------------------------------------
const mockDecrypt = vi.fn();
vi.mock("@/lib/oauth/encrypt", () => ({
  decryptToken: (...args: unknown[]) => mockDecrypt(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------
import {
  getSenderForAccount,
  REFUSED_SEND_ERROR_PREFIX,
} from "../lib/email-sender/account-sender";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setAccountResult(data: AccountRow, error: object | null = null) {
  _accountResult = { data, error };
}
function setCredResult(data: CredRow, error: object | null = null) {
  _credResult = { data, error };
}

const REFUSED_PREFIX_REGEX = new RegExp(`^${REFUSED_SEND_ERROR_PREFIX}:`);
const SEND_OPTS = {
  to: "booker@example.com",
  subject: "Test",
  html: "<p>Hello</p>",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("getSenderForAccount", () => {
  beforeEach(() => {
    resetMocks();
    mockDecrypt.mockReset();
    mockFetchToken.mockReset();

    // Default happy-path for sub-mocks
    mockDecrypt.mockReturnValue("refresh-token-plaintext");
    mockFetchToken.mockResolvedValue({ accessToken: "ya29.test-access-token" });
  });

  it("[#1] happy path — returns EmailClient with provider 'gmail'", async () => {
    const sender = await getSenderForAccount("account-1");

    // provider is "gmail" (from createGmailOAuthClient which returns provider:'gmail')
    expect(sender.provider).toBe("gmail");

    // send() should succeed structurally (nodemailer is NOT mocked here — it will
    // try to connect). We only need to verify that the factory returned a real
    // EmailClient, not a refused sender. Calling send() with the real nodemailer
    // would hit the network; just assert provider identity and send is a function.
    expect(typeof sender.send).toBe("function");

    // Verify the mocks were called as expected
    expect(mockDecrypt).toHaveBeenCalledWith("iv:tag:cipher");
    expect(mockFetchToken).toHaveBeenCalledWith("refresh-token-plaintext");
  });

  it("[#2] no account row — refused with 'no account row'", async () => {
    setAccountResult(null);

    const sender = await getSenderForAccount("account-missing");
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(REFUSED_PREFIX_REGEX);
    expect(result.error).toContain("no account row");

    // fetchGoogleAccessToken should NOT have been called
    expect(mockFetchToken).not.toHaveBeenCalled();
  });

  it("[#3] account missing owner_email — refused with 'missing owner_email'", async () => {
    setAccountResult({ owner_user_id: "user-abc", owner_email: null });

    const sender = await getSenderForAccount("account-no-email");
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(REFUSED_PREFIX_REGEX);
    expect(result.error).toContain("missing owner_email");

    expect(mockFetchToken).not.toHaveBeenCalled();
  });

  it("[#4] no credential row — refused with 'no credential'", async () => {
    setCredResult(null);

    const sender = await getSenderForAccount("account-no-cred");
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(REFUSED_PREFIX_REGEX);
    expect(result.error).toContain("no credential");

    expect(mockFetchToken).not.toHaveBeenCalled();
  });

  it("[#5] credential status needs_reconnect — refused, fetchGoogleAccessToken NOT called", async () => {
    setCredResult({ refresh_token_encrypted: "iv:tag:cipher", status: "needs_reconnect" });

    const sender = await getSenderForAccount("account-revoked");
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(REFUSED_PREFIX_REGEX);
    expect(result.error).toContain("needs_reconnect");

    // Token exchange must NOT be attempted when credential is already flagged
    expect(mockFetchToken).not.toHaveBeenCalled();
  });

  it("[#6] decryptToken throws — refused with 'decrypt failed', fetchGoogleAccessToken NOT called", async () => {
    mockDecrypt.mockImplementation(() => {
      throw new Error("GCM auth tag mismatch");
    });

    const sender = await getSenderForAccount("account-bad-crypt");
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(REFUSED_PREFIX_REGEX);
    expect(result.error).toContain("decrypt failed");

    expect(mockFetchToken).not.toHaveBeenCalled();
  });

  it("[#7] invalid_grant from Google — refused AND account_oauth_credentials updated to needs_reconnect", async () => {
    mockFetchToken.mockResolvedValue({ error: "invalid_grant" });

    const sender = await getSenderForAccount("account-revoked-grant");
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(REFUSED_PREFIX_REGEX);
    expect(result.error).toContain("invalid_grant");

    // Side-effect: the factory must have called update({ status: "needs_reconnect" })
    // against account_oauth_credentials
    const needsReconnectUpdates = _updateCalls.filter(
      (c) =>
        c.table === "account_oauth_credentials" &&
        (c.payload as { status?: string }).status === "needs_reconnect"
    );
    expect(needsReconnectUpdates.length).toBeGreaterThanOrEqual(1);
  });

  it("[#8] other token exchange failure — refused, NO needs_reconnect update written", async () => {
    mockFetchToken.mockResolvedValue({ error: "network_error" });

    const sender = await getSenderForAccount("account-network-fail");
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(REFUSED_PREFIX_REGEX);
    expect(result.error).toContain("token exchange failed: network_error");

    // needs_reconnect should NOT be written for non-invalid_grant errors
    const needsReconnectUpdates = _updateCalls.filter(
      (c) =>
        c.table === "account_oauth_credentials" &&
        (c.payload as { status?: string }).status === "needs_reconnect"
    );
    expect(needsReconnectUpdates).toHaveLength(0);
  });

  it("[#9] REFUSED_SEND_ERROR_PREFIX is exported and equals 'oauth_send_refused'", () => {
    expect(REFUSED_SEND_ERROR_PREFIX).toBe("oauth_send_refused");
  });
});
