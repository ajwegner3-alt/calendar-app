// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { adminClient } from "@/tests/helpers/supabase";
import { POST } from "@/app/api/bookings/route";
import { __setTurnstileResult } from "@/lib/turnstile"; // resolved to mock via vitest.config.ts alias
import { __resetMockSendCalls } from "@/lib/email-sender"; // resolved to mock via alias

/**
 * Plan 08-03 / INFRA-04 — POST /api/bookings IP-based rate limit.
 *
 * Mirrors the Phase 6 sliding-window rate-limit pattern proved in
 * tests/cancel-reschedule-api.test.ts (Scenario 7). Threshold is 20 req /
 * IP / 5-min window (vs Phase 6's 10/5min for cancel/reschedule — booking flow
 * is higher-frequency legitimate traffic; RESEARCH §Pattern 7).
 *
 * Strategy: each request is sent with a body that passes Zod validation but
 * fails the Turnstile gate (mock set to false). The route order is:
 *   1. Parse JSON → 2. Zod validate → 3. Rate-limit (insert) → 4. Turnstile (403) → ...
 * So each request increments the `rate_limit_events` counter for `bookings:${ip}`
 * and short-circuits at Turnstile WITHOUT touching event_types, accounts, or
 * bookings tables. This isolates the rate-limit guard cleanly.
 *
 * After 20 such calls, the 21st returns 429 RATE_LIMITED + Retry-After. A
 * 21st call from a DIFFERENT IP succeeds past the rate-limit gate (proving
 * per-IP keying).
 *
 * Cleanup: rate_limit_events rows are deleted in afterAll by their key
 * (the same pattern Plan 06 uses).
 */

const usedRateLimitKeys: string[] = [];

/**
 * Build a NextRequest matching the route's expected shape. Pass an `ip` arg
 * to set x-forwarded-for so the rate-limit key is deterministic per test.
 * (Matches the buildRequest helper in tests/cancel-reschedule-api.test.ts.)
 */
function buildRequest(body: unknown, ip: string): NextRequest {
  return new NextRequest("https://example.com/api/bookings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/**
 * Generate a Zod-valid booking body. We don't care about slot validity here —
 * Turnstile (mocked to false) short-circuits BEFORE the event_type lookup, so
 * eventTypeId can be a syntactically-valid UUID that doesn't exist in DB.
 */
function validBody(): Record<string, unknown> {
  const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // ~30 days out
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    // Syntactically valid UUID v4 — does NOT need to exist in DB because
    // the Turnstile gate (mock = false) short-circuits BEFORE the event_type
    // lookup. Uses random-ish values so Zod's strict UUID format check passes.
    eventTypeId: "11111111-2222-4333-8444-555555555555",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    bookerName: "Rate Limit Test",
    bookerEmail: "rl-test@example.com",
    bookerPhone: "555-987-6543",
    bookerTimezone: "America/Chicago",
    answers: {},
    turnstileToken: "mock-token-vitest",
  };
}

afterAll(async () => {
  const admin = adminClient();
  if (usedRateLimitKeys.length) {
    await admin.from("rate_limit_events").delete().in("key", usedRateLimitKeys);
  }
});

beforeEach(() => {
  // Force Turnstile to FAIL so each call short-circuits at the Turnstile gate
  // (after the rate-limit increment). This keeps the test cheap — no DB
  // event_type resolution, no booking inserts.
  __setTurnstileResult(false);
  __resetMockSendCalls();
});

// Suppress expected route error logs from the route handler
const origError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (msg.includes("[/api/bookings]") || msg.includes("[rate-limit]")) {
      return;
    }
    origError(...args);
  };
});
afterAll(() => {
  console.error = origError;
});

describe("POST /api/bookings — IP rate limit (sliding window, 20/5min)", () => {
  it(
    "[#1] allowed under threshold: 20 successive calls from same IP do NOT trigger 429",
    async () => {
      const ip = "10.8.3.1";
      usedRateLimitKeys.push(`bookings:${ip}`);

      // 20 calls — all should pass the rate-limit gate (and fail Turnstile → 403)
      for (let i = 0; i < 20; i++) {
        const res = await POST(buildRequest(validBody(), ip));
        // The first 20 must NOT be rate-limited. Expected status: 403 TURNSTILE
        // (Turnstile mock returns false), proving the request reached AND passed
        // the rate-limit guard before short-circuiting at the Turnstile gate.
        expect(res.status).not.toBe(429);
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.code).toBe("TURNSTILE");
      }
    },
    30_000,
  );

  it(
    "[#2] blocked at 21st call: same IP returns 429 + RATE_LIMITED + positive Retry-After",
    async () => {
      const ip = "10.8.3.2";
      usedRateLimitKeys.push(`bookings:${ip}`);

      // First 20 calls — fill the window (each fails Turnstile → 403, but
      // rate-limit increment fires BEFORE Turnstile so the counter ticks up)
      for (let i = 0; i < 20; i++) {
        const res = await POST(buildRequest(validBody(), ip));
        // Sanity: none of the first 20 should 429
        expect(res.status).not.toBe(429);
      }

      // 21st call — must trip the rate limit
      const res = await POST(buildRequest(validBody(), ip));
      expect(res.status).toBe(429);

      const body = await res.json();
      expect(body.code).toBe("RATE_LIMITED");
      expect(body.error).toMatch(/too many requests/i);

      const retryAfter = res.headers.get("Retry-After");
      expect(retryAfter).toBeTruthy();
      expect(Number(retryAfter)).toBeGreaterThan(0);

      // Cache-Control: no-store on 429 (matches every other route response shape)
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    },
    30_000,
  );

  it(
    "[#3] different IP not affected: a fresh IP is NOT 429ed even after another IP exhausted its quota",
    async () => {
      const ipExhausted = "10.8.3.3";
      const ipFresh = "10.8.3.4";
      usedRateLimitKeys.push(`bookings:${ipExhausted}`);
      usedRateLimitKeys.push(`bookings:${ipFresh}`);

      // Exhaust ipExhausted (20 calls fill the window; 21st would 429)
      for (let i = 0; i < 20; i++) {
        const res = await POST(buildRequest(validBody(), ipExhausted));
        expect(res.status).not.toBe(429);
      }

      // 21st call from ipExhausted MUST be 429 (proves window is full)
      const blocked = await POST(buildRequest(validBody(), ipExhausted));
      expect(blocked.status).toBe(429);

      // Same instant — a DIFFERENT IP makes a fresh call. Must NOT be 429.
      // This proves the rate-limit key is per-IP, not global.
      const fresh = await POST(buildRequest(validBody(), ipFresh));
      expect(fresh.status).not.toBe(429);
      expect(fresh.status).toBe(403); // still fails Turnstile, but past the rate-limit gate
      const body = await fresh.json();
      expect(body.code).toBe("TURNSTILE");
    },
    30_000,
  );
});
