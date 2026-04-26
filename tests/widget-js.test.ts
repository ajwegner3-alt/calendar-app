// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Use explicit relative path — `@/app/widget.js/route` would be misinterpreted
// as a `.js` file extension import by TypeScript module resolution, so we
// reference the .ts file directly via relative path from tests/.
// (Plan 07-05 lock: if TS resolution complains about the dot, use relative path)
import { GET } from "../app/widget.js/route";

/**
 * Integration tests for GET /widget.js (Plan 07-05).
 *
 * Approach: import the GET handler directly and invoke it with a real NextRequest.
 * No dev server needed — pure in-process, no network, no DB.
 *
 * vi.stubEnv + afterEach vi.unstubAllEnvs are the correct pattern for
 * per-test env var isolation in Vitest (no beforeAll/afterAll needed here).
 *
 * Test coverage:
 *   1. Status 200 + correct Content-Type + correct Cache-Control
 *   2. BASE_URL injected from NEXT_PUBLIC_APP_URL
 *   3. BASE_URL falls back to request.nextUrl.origin when env is unset/empty
 *   4. Trailing slash stripped from BASE_URL
 *   5. Script body contains all key invariants (smoke regex tests)
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /widget.js", () => {
  it("returns 200 with correct Content-Type and Cache-Control headers", async () => {
    const request = new NextRequest("http://localhost:3000/widget.js");
    const response = await GET(request);

    expect(response.status).toBe(200);

    const contentType = response.headers.get("Content-Type");
    expect(contentType).toMatch(/^application\/javascript/);

    const cacheControl = response.headers.get("Cache-Control");
    expect(cacheControl).toBe("public, max-age=3600, s-maxage=86400");
  });

  it("injects BASE_URL from NEXT_PUBLIC_APP_URL env var", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prod.example.com");

    const request = new NextRequest("http://localhost:3000/widget.js");
    const response = await GET(request);
    const text = await response.text();

    // JSON.stringify produces a quoted string literal in the IIFE body
    expect(text).toContain('BASE_URL = "https://prod.example.com"');
  });

  it("falls back to request origin when NEXT_PUBLIC_APP_URL is unset", async () => {
    // Ensure env var is cleared
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    const request = new NextRequest("http://localhost:9999/widget.js");
    const response = await GET(request);
    const text = await response.text();

    expect(text).toContain('BASE_URL = "http://localhost:9999"');
  });

  it("strips trailing slash from NEXT_PUBLIC_APP_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com/");

    const request = new NextRequest("http://localhost:3000/widget.js");
    const response = await GET(request);
    const text = await response.text();

    // Must NOT contain trailing slash after the hostname
    expect(text).toContain('BASE_URL = "https://example.com"');
    expect(text).not.toContain('BASE_URL = "https://example.com/"');
  });

  it("script body contains all key invariants", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://test.example.com");

    const request = new NextRequest("http://localhost:3000/widget.js");
    const response = await GET(request);
    const text = await response.text();

    // Idempotency guard (Pitfall 3)
    expect(text).toContain("window.__nsiWidgetLoaded");

    // Mount-point selector
    expect(text).toContain("data-nsi-calendar");

    // postMessage protocol type filter (Plan 07-03 lock)
    expect(text).toContain("nsi-booking:height");

    // Source validation (Plan 07-03 lock): must be exact form from plan
    expect(text).toContain("evt.source !== iframe.contentWindow");

    // 5-second handshake timeout
    expect(text).toContain("HANDSHAKE_TIMEOUT_MS = 5000");

    // iframe src path prefix (Plan 07-03 lock: iframe.src = BASE_URL + /embed/...)
    expect(text).toContain("/embed/");
  });
});
