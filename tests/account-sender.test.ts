// @vitest-environment node
/**
 * Plan 35-03 — account-sender.ts unit tests.
 * Plan 36-03 — extended with Phase 36 Resend routing tests (#10–#14).
 *
 * Tests getSenderForAccount(accountId) — the per-account email sender factory.
 * Mocks:
 *   - @/lib/supabase/admin (createAdminClient) — no real DB calls
 *   - @/lib/oauth/google (fetchGoogleAccessToken) — no real HTTP calls
 *   - @/lib/oauth/encrypt (decryptToken) — no real crypto (avoids needing GMAIL_TOKEN_ENCRYPTION_KEY)
 *
 * 9 original test cases (Gmail OAuth path):
 *   1. Happy path — returns an EmailClient with provider:"gmail"
 *   2. No account row — refused with "no account row"
 *   3. Account missing owner_email — refused with "missing owner_email"
 *   4. No credential row — refused with "no credential"
 *   5. Credential status needs_reconnect — refused, fetchGoogleAccessToken NOT called
 *   6. Decrypt throws — refused with "decrypt failed", fetchGoogleAccessToken NOT called
 *   7. invalid_grant from Google — refused, DB update to needs_reconnect fires
 *   8. Other token exchange failure — refused, NO needs_reconnect update
 *   9. REFUSED_SEND_ERROR_PREFIX exported constant value
 *
 * 5 Phase 36 test cases (Resend routing):
 *   10. email_provider='resend' happy path — provider:'resend', fetchGoogleAccessToken NOT called
 *   11. email_provider='resend' + resend_status='suspended' — refused with resend_send_refused: account_suspended
 *   12. email_provider='resend' wins over present account_oauth_credentials row
 *   13. isRefusedSend helper covers both prefixes
 *   14. RESEND_REFUSED_SEND_ERROR_PREFIX re-exported from account-sender
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock state — closures allow per-test control via setters below.
// ---------------------------------------------------------------------------

type AccountRow = {
  owner_user_id: string;
  owner_email: string | null;
  email_provider?: string;
  resend_status?: string | null;
  name?: string | null;
} | null;
type CredRow = { refresh_token_encrypted: string; status: string } | null;

let _accountResult: { data: AccountRow; error: object | null } = {
  data: {
    owner_user_id: "user-abc",
    owner_email: "owner@example.com",
    email_provider: "gmail",
    resend_status: null,
    name: "Acme Corp",
  },
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
    data: {
      owner_user_id: "user-abc",
      owner_email: "owner@example.com",
      email_provider: "gmail",
      resend_status: null,
      name: "Acme Corp",
    },
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
// Handles SELECT chains:
//   .from("accounts").select(...).eq(...).maybeSingle()
//   .from("account_oauth_credentials").select(...).eq(...).eq(...).maybeSingle()
//   .from("email_send_log").select(...).eq(...).gte(...)   [for warnIfResendAbuseThresholdCrossed]
//
// And one UPDATE chain:
//   .from("account_oauth_credentials").update({...}).eq(...).eq(...)
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    return {
      from: (table: string) => {
        // email_send_log — used by getDailySendCount inside warnIfResendAbuseThresholdCrossed
        // Return count=0 (below abuse threshold) so tests stay focused on routing logic.
        if (table === "email_send_log") {
          return {
            select: (_cols: string, _opts?: object) => ({
              eq: (_col: string, _val: unknown) => ({
                gte: (_col2: string, _val2: unknown) =>
                  Promise.resolve({ count: 0, error: null }),
              }),
            }),
            insert: (_row: object) => Promise.resolve({ error: null }),
          };
        }

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
  RESEND_REFUSED_SEND_ERROR_PREFIX,
  isRefusedSend,
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
const RESEND_REFUSED_PREFIX_REGEX = new RegExp(`^${RESEND_REFUSED_SEND_ERROR_PREFIX}:`);
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

  // ---------------------------------------------------------------------------
  // Phase 36: Resend routing
  // ---------------------------------------------------------------------------

  it("[#10] email_provider='resend' happy path — provider:'resend', fetchGoogleAccessToken NOT called", async () => {
    setAccountResult({
      owner_user_id: "user-resend",
      owner_email: "owner@acmeplumbing.com",
      email_provider: "resend",
      resend_status: "active",
      name: "Acme Plumbing",
    });

    const sender = await getSenderForAccount("account-resend");

    // Factory must return a Resend-backed client
    expect(sender.provider).toBe("resend");
    expect(typeof sender.send).toBe("function");

    // Gmail OAuth path must NOT have been touched
    expect(mockFetchToken).not.toHaveBeenCalled();
    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it("[#11] email_provider='resend' + resend_status='suspended' — refused with resend_send_refused: account_suspended", async () => {
    setAccountResult({
      owner_user_id: "user-suspended",
      owner_email: "owner@suspended.com",
      email_provider: "resend",
      resend_status: "suspended",
      name: "Suspended Co",
    });
    // account_oauth_credentials has an active credential — Resend branch should
    // intercept BEFORE the credentials lookup
    setCredResult({ refresh_token_encrypted: "iv:tag:cipher", status: "active" });

    const sender = await getSenderForAccount("account-suspended");
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(RESEND_REFUSED_PREFIX_REGEX);
    expect(result.error).toContain("account_suspended");

    // Gmail path must NOT have been touched
    expect(mockFetchToken).not.toHaveBeenCalled();
    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it("[#12] email_provider='resend' wins over present account_oauth_credentials row", async () => {
    setAccountResult({
      owner_user_id: "user-both",
      owner_email: "owner@both.com",
      email_provider: "resend",
      resend_status: "active",
      name: "Both Connected Co",
    });
    // Active Gmail credential present — Resend should still win
    setCredResult({ refresh_token_encrypted: "iv:tag:cipher", status: "active" });

    const sender = await getSenderForAccount("account-both");

    // Resend wins
    expect(sender.provider).toBe("resend");

    // Gmail credential path NOT consulted
    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(mockFetchToken).not.toHaveBeenCalled();
  });

  it("[#13] isRefusedSend helper covers both prefixes", () => {
    // OAuth prefix
    expect(isRefusedSend("oauth_send_refused: no credential")).toBe(true);
    // Resend prefix
    expect(isRefusedSend("resend_send_refused: 422 domain_not_found")).toBe(true);
    // Unrelated error — must NOT match
    expect(isRefusedSend("some_other_error: uh oh")).toBe(false);
    // Undefined — must NOT match
    expect(isRefusedSend(undefined)).toBe(false);
    // Empty string — must NOT match
    expect(isRefusedSend("")).toBe(false);
  });

  it("[#14] RESEND_REFUSED_SEND_ERROR_PREFIX re-exported from account-sender equals 'resend_send_refused'", () => {
    expect(RESEND_REFUSED_SEND_ERROR_PREFIX).toBe("resend_send_refused");
  });
});
