// @vitest-environment node

/**
 * Tests for lib/oauth/encrypt.ts
 *
 * Uses a deterministic 64-hex-char test key via process.env — never hardcoded
 * in production paths. Key is set in beforeAll and cleaned up in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { encryptToken, decryptToken } from "@/lib/oauth/encrypt";

// Deterministic 32-byte test key (64 hex chars) — safe for tests only
const TEST_KEY = "0".repeat(64); // 32 zero bytes in hex

let savedKey: string | undefined;

beforeAll(() => {
  savedKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  if (savedKey === undefined) {
    delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  } else {
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = savedKey;
  }
});

describe("encryptToken / decryptToken", () => {
  // Test 1: Roundtrip
  it("roundtrip: decryptToken(encryptToken(x)) === x for a realistic refresh token", () => {
    const original = "a-realistic-google-refresh-token-1//04abcdef1234";
    const encrypted = encryptToken(original);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  // Test 2: Unique IV per call
  it("each call to encryptToken produces a unique ciphertext (fresh IV)", () => {
    const payload = "x";
    const enc1 = encryptToken(payload);
    const enc2 = encryptToken(payload);
    expect(enc1).not.toBe(enc2);
  });

  // Test 3: Tamper detection
  it("decryptToken throws when the ciphertext segment is tampered", () => {
    const encrypted = encryptToken("sensitive-token-data");
    // Format: iv:authTag:ciphertext — mutate one hex char in the ciphertext segment
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    const [iv, authTag, ciphertext] = parts;
    // Flip the last hex nibble of the ciphertext
    const lastChar = ciphertext.slice(-1);
    const tamperedChar = lastChar === "a" ? "b" : "a";
    const tamperedCiphertext = ciphertext.slice(0, -1) + tamperedChar;
    const tampered = [iv, authTag, tamperedCiphertext].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });

  // Test 4: Missing key
  describe("missing/invalid GMAIL_TOKEN_ENCRYPTION_KEY", () => {
    let keySnapshot: string | undefined;

    beforeEach(() => {
      keySnapshot = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    });

    afterEach(() => {
      if (keySnapshot === undefined) {
        delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
      } else {
        process.env.GMAIL_TOKEN_ENCRYPTION_KEY = keySnapshot;
      }
    });

    it("encryptToken throws /not set/ when GMAIL_TOKEN_ENCRYPTION_KEY is missing", () => {
      delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
      expect(() => encryptToken("x")).toThrow(/not set/);
    });

    // Test 5: Wrong key length
    it("encryptToken throws /32-byte/ when key is not 64 hex chars", () => {
      process.env.GMAIL_TOKEN_ENCRYPTION_KEY = "abc";
      expect(() => encryptToken("x")).toThrow(/32-byte/);
    });
  });
});
