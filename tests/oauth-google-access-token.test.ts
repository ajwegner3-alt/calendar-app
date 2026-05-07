/**
 * Unit tests for fetchGoogleAccessToken (lib/oauth/google.ts).
 *
 * All tests mock global.fetch — no real Google endpoint is called.
 * Env vars GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set/unset in beforeEach
 * to match the lazy-read pattern (per Phase 34 Plan 02 STATE.md pattern).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchGoogleAccessToken } from "@/lib/oauth/google";

// Helper: create a minimal Response-like mock that json() resolves to `body`.
function makeFetchResponse(body: object, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("fetchGoogleAccessToken", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Set valid env vars by default; individual tests may delete them.
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  });

  afterEach(() => {
    // Restore env and fetch after each test.
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns { error: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set' } when env vars are missing", async () => {
    // Remove the vars set in beforeEach.
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const result = await fetchGoogleAccessToken("any-refresh-token");

    expect(result).toEqual({
      error: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set",
    });
  });

  it("returns { accessToken } on a successful exchange", async () => {
    global.fetch = vi.fn().mockReturnValue(
      makeFetchResponse({ access_token: "ya29.test" })
    );

    const result = await fetchGoogleAccessToken("valid-refresh-token");

    expect(result).toEqual({ accessToken: "ya29.test" });
    expect(global.fetch).toHaveBeenCalledOnce();
    // Verify it posts to the correct endpoint.
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
  });

  it("returns { error: 'invalid_grant' } when Google returns invalid_grant", async () => {
    global.fetch = vi.fn().mockReturnValue(
      makeFetchResponse({ error: "invalid_grant" })
    );

    const result = await fetchGoogleAccessToken("revoked-refresh-token");

    expect(result).toEqual({ error: "invalid_grant" });
  });

  it("returns { error: 'network_error' } when fetch rejects", async () => {
    global.fetch = vi.fn().mockReturnValue(
      Promise.reject(new Error("ECONNREFUSED"))
    );

    const result = await fetchGoogleAccessToken("any-refresh-token");

    expect(result).toEqual({ error: "network_error" });
  });
});
