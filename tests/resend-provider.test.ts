// @vitest-environment node
/**
 * Plan 36-02 — resend.ts unit tests.
 *
 * Tests createResendClient(config).send(opts) — the Resend HTTP provider.
 * Mocks: globalThis.fetch (no real Resend API calls).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  createResendClient,
  RESEND_REFUSED_SEND_ERROR_PREFIX,
} from "../lib/email-sender/providers/resend";

const CONFIG = {
  fromName: "Acme Plumbing",
  fromAddress: "bookings@nsintegrations.com",
  replyToAddress: "owner@acmeplumbing.com",
};

const SEND_OPTS = {
  to: "booker@example.com",
  subject: "Your booking is confirmed",
  html: "<p>See you Tuesday at 10am.</p>",
};

const PREFIX_REGEX = new RegExp(`^${RESEND_REFUSED_SEND_ERROR_PREFIX}:`);

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key_abc";
  mockFetch.mockReset();
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("createResendClient", () => {
  it("[#1] happy path — returns success with messageId from Resend response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }),
    });

    const sender = createResendClient(CONFIG);
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("49a3999c-0ce1-4ea6-ab68-afcd6dc2e794");
    expect(sender.provider).toBe("resend");

    // Verify endpoint + headers
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer re_test_key_abc",
      "Content-Type": "application/json",
    });

    // Verify body shape (snake_case mapping — RESEARCH §Pitfall 1)
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.from).toBe("Acme Plumbing <bookings@nsintegrations.com>");
    expect(body.to).toBe("booker@example.com");
    expect(body.subject).toBe("Your booking is confirmed");
    expect(body.html).toBe("<p>See you Tuesday at 10am.</p>");
    // text auto-derived from html via stripHtml
    expect(typeof body.text).toBe("string");
    // reply_to falls back to config.replyToAddress when options.replyTo absent
    expect(body.reply_to).toBe("owner@acmeplumbing.com");
  });

  it("[#2] missing RESEND_API_KEY — refused with prefix", async () => {
    delete process.env.RESEND_API_KEY;

    const sender = createResendClient(CONFIG);
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(PREFIX_REGEX);
    expect(result.error).toContain("missing RESEND_API_KEY");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("[#3] HTTP 422 validation_error — refused with prefix and Resend message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        name: "validation_error",
        statusCode: 422,
        message: "Invalid `to` field.",
      }),
    });

    const sender = createResendClient(CONFIG);
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(PREFIX_REGEX);
    expect(result.error).toContain("422");
    expect(result.error).toContain("Invalid `to` field.");
  });

  it("[#4] HTTP 429 rate_limit_exceeded — refused with prefix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        name: "rate_limit_exceeded",
        statusCode: 429,
        message: "Too many requests.",
      }),
    });

    const sender = createResendClient(CONFIG);
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(PREFIX_REGEX);
    expect(result.error).toContain("429");
  });

  it("[#5] HTTP 500 server error — refused with prefix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        name: "internal_server_error",
        statusCode: 500,
        message: "Resend infra issue.",
      }),
    });

    const sender = createResendClient(CONFIG);
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(PREFIX_REGEX);
    expect(result.error).toContain("500");
  });

  it("[#6] fetch throws (network error) — refused with prefix, never throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const sender = createResendClient(CONFIG);
    const result = await sender.send(SEND_OPTS);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(PREFIX_REGEX);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("[#7] options.replyTo overrides config.replyToAddress", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg-7" }),
    });

    const sender = createResendClient(CONFIG);
    await sender.send({ ...SEND_OPTS, replyTo: "custom-reply@example.com" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.reply_to).toBe("custom-reply@example.com");
  });

  it("[#8] attachment contentType maps to snake_case content_type with base64 buffer", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg-8" }),
    });

    const icsBuffer = Buffer.from("BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR", "utf8");
    const sender = createResendClient(CONFIG);
    await sender.send({
      ...SEND_OPTS,
      attachments: [
        {
          filename: "invite.ics",
          content: icsBuffer,
          contentType: "text/calendar; method=REQUEST",
        },
      ],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].filename).toBe("invite.ics");
    expect(body.attachments[0].content_type).toBe("text/calendar; method=REQUEST");
    // Buffer → base64 string
    expect(body.attachments[0].content).toBe(icsBuffer.toString("base64"));
    // No camelCase contentType field leaked
    expect(body.attachments[0].contentType).toBeUndefined();
  });

  it("[#9] RESEND_REFUSED_SEND_ERROR_PREFIX exported equals 'resend_send_refused'", () => {
    expect(RESEND_REFUSED_SEND_ERROR_PREFIX).toBe("resend_send_refused");
  });
});
