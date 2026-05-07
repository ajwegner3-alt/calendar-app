/**
 * Unit tests for createGmailOAuthClient (lib/email-sender/providers/gmail-oauth.ts).
 *
 * nodemailer.createTransport is mocked so no real SMTP connection is made.
 * Tests verify: provider identity, From enforcement (spoofing blocked),
 * sendMail call arguments, array-to recipients, and error handling.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import nodemailer from "nodemailer";
import { createGmailOAuthClient } from "@/lib/email-sender/providers/gmail-oauth";

// Hoist the mock sendMail spy so we can control it per test.
const mockSendMail = vi.fn();

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

describe("createGmailOAuthClient", () => {
  beforeEach(() => {
    mockSendMail.mockReset();
  });

  it("returns an object with provider: 'gmail' and a send function", () => {
    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    expect(client.provider).toBe("gmail");
    expect(typeof client.send).toBe("function");
  });

  it("calls sendMail with from = 'user@example.com <user@example.com>' when no fromName", async () => {
    mockSendMail.mockResolvedValue({ messageId: "<test-id@example.com>" });

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    await client.send({
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(mockSendMail).toHaveBeenCalledOnce();
    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.from).toBe("user@example.com <user@example.com>");
  });

  it("uses fromName in From header when provided", async () => {
    mockSendMail.mockResolvedValue({ messageId: "<test-id@example.com>" });

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

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.from).toBe("NSI <user@example.com>");
  });

  it("ignores options.from — enforces authenticated address (Pitfall 6)", async () => {
    mockSendMail.mockResolvedValue({ messageId: "<test-id@example.com>" });

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    await client.send({
      to: "recipient@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
      from: "spoof@evil.com", // Should be ignored
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    // The enforced from must be the authenticated user, not the caller-supplied from.
    expect(callArgs.from).toBe("user@example.com <user@example.com>");
    expect(callArgs.from).not.toContain("spoof@evil.com");
  });

  it("returns { success: false, error } when sendMail rejects — does not throw", async () => {
    mockSendMail.mockRejectedValue(new Error("SMTP auth failed"));

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
    expect(result.error).toBe("SMTP auth failed");
  });

  it("joins array 'to' recipients with ', '", async () => {
    mockSendMail.mockResolvedValue({ messageId: "<test-id@example.com>" });

    const client = createGmailOAuthClient({
      user: "user@example.com",
      accessToken: "ya29.test",
    });

    await client.send({
      to: ["a@example.com", "b@example.com"],
      subject: "Test",
      html: "<p>Hello</p>",
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe("a@example.com, b@example.com");
  });
});
