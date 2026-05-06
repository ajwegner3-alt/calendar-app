import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

/**
 * Lazily reads and validates the AES-256-GCM key from the environment.
 * Throws early if the key is missing or the wrong length — never silently
 * encrypts with a bad key.
 */
function getKey(): Buffer {
  const KEY_HEX = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!KEY_HEX) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY env var not set");
  }
  const key = Buffer.from(KEY_HEX, "hex");
  if (key.length !== 32) {
    throw new Error(
      "GMAIL_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)"
    );
  }
  return key;
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * Returns a colon-delimited string: `iv:authTag:ciphertext` (all hex-encoded).
 * Each call generates a fresh 12-byte random IV — safe for single-key reuse.
 *
 * Storage format: `iv:authTag:ciphertext`
 *   - iv       — 12 bytes (24 hex chars), 96-bit GCM recommended nonce
 *   - authTag  — 16 bytes (32 hex chars), GCM authentication tag
 *   - ciphertext — variable length
 *
 * Typical total length for a Google refresh token: ~200–250 chars.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypts a token encrypted by `encryptToken`.
 *
 * Throws if:
 * - The stored format does not split into exactly 3 colon-delimited parts.
 * - The GCM authentication tag does not match (ciphertext was tampered with).
 * - GMAIL_TOKEN_ENCRYPTION_KEY is missing or not 32 bytes.
 */
export function decryptToken(stored: string): string {
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted token format — expected iv:authTag:ciphertext"
    );
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGO, key, iv);
  // setAuthTag MUST be called before decipher.final() — GCM verifies integrity here
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Dev helper: generates a cryptographically-random 32-byte hex key.
 * Print once and store in .env.local as GMAIL_TOKEN_ENCRYPTION_KEY.
 *
 * Usage: `node -e "const { generateKey } = require('./lib/oauth/encrypt'); console.log(generateKey())"`
 */
export function generateKey(): string {
  return randomBytes(32).toString("hex");
}
