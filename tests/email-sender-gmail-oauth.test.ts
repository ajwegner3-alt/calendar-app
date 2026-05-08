/**
 * Unit tests for createGmailOAuthClient (lib/email-sender/providers/gmail-oauth.ts).
 *
 * The provider posts to Gmail's REST API (gmail.users.messages.send) — global
 * fetch is mocked so no real HTTP request is made. Tests verify: provider
 * identity, From enforcement, raw message structure, base64url encoding,
 * array-to recipients, error handling.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createGmailOAuthClient } from "@/lib/email-sender/providers/gmail-oauth";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

/** Decode the base64url 'raw' field back to RFC-822 source. */
function decodeRaw(body: string): string {
  const json = JSON.parse(body) as { raw: string };
  const b64 = json.raw.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

describe("createGmailOAuthClient", () => {
  it("returns an object with provider: 'gmail' and a send function", () => {
    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    expect(client.provider).toBe("gmail");
    expect(typeof client.send).toBe("function");
  });

  it("posts to Gmail REST endpoint with bearer access token", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: "msg-id-123" }), { status: 200 }),
    );

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    const result = await client.send({
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg-id-123");
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    );
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer ya29.test");
  });

  it("encodes the raw message with From = 'user <user@example.com>' when no fromName", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: "x" }), { status: 200 }),
    );

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    await client.send({
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    const rfc822 = decodeRaw(mockFetch.mock.calls[0][1].body);
    expect(rfc822).toContain("From: user@example.com <user@example.com>");
  });

  it("uses fromName in From header when provided", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: "x" }), { status: 200 }),
    );

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
      fromName: "NSI",
    });

    await client.send({
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    const rfc822 = decodeRaw(mockFetch.mock.calls[0][1].body);
    expect(rfc822).toContain("From: NSI <user@example.com>");
  });

  it("ignores options.from — enforces authenticated address (Pitfall 6)", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: "x" }), { status: 200 }),
    );

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    await client.send({
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
      from: "spoof@evil.com",
    });

    const rfc822 = decodeRaw(mockFetch.mock.calls[0][1].body);
    expect(rfc822).toContain("From: user@example.com <user@example.com>");
    expect(rfc822).not.toContain("spoof@evil.com");
  });

  it("returns { success: false, error } when Gmail returns 4xx — does not throw", async () => {
    mockFetch.mockResolvedValue(
      new Response("invalid_grant", { status: 401 }),
    );

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    const result = await client.send({
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("gmail_api_401");
    expect(result.error).toContain("invalid_grant");
  });

  it("returns { success: false, error } when fetch rejects — does not throw", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    const result = await client.send({
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("network down");
  });

  it("joins array 'to' recipients with ', '", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: "x" }), { status: 200 }),
    );

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    await client.send({
      to: ["a@example.com", "b@example.com"],
      subject: "Test",
      html: "<p>Hello</p>",
    });

    const rfc822 = decodeRaw(mockFetch.mock.calls[0][1].body);
    expect(rfc822).toContain("To: a@example.com, b@example.com");
  });
});
