import "server-only";

/**
 * Generates raw cancel + reschedule tokens and their SHA-256 hashes.
 *
 * Storage rule (LIFE-03): bookings.cancel_token_hash + reschedule_token_hash
 * are TEXT NOT NULL. We INSERT the hex-encoded SHA-256 hash; the raw token
 * lives only in the booker's confirmation email. Phase 6 cancel/reschedule
 * routes hash the token from the URL and look up by hash.
 *
 * Web Crypto API used (crypto.subtle.digest) so this module is Edge-runtime
 * compatible. crypto.randomUUID() is Web Crypto's CSPRNG (RFC 4122 v4) —
 * 122 bits of entropy, sufficient for token use.
 *
 * DO NOT use Node crypto.createHash("sha256") — fails on Edge runtime.
 * DO NOT base64-encode the hash — hex matches Phase 1 schema convention.
 * Phase 6 cancel/reschedule lookup routes hash the URL token to hex and
 * compare; no salt/HMAC needed (tokens are random secrets, not passwords).
 */

export async function hashToken(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = encoder.encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  // Hex-encode the 32-byte (256-bit) digest
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface BookingTokens {
  rawCancel: string;
  rawReschedule: string;
  hashCancel: string;
  hashReschedule: string;
}

/**
 * Generate raw cancel + reschedule token pair and their SHA-256 hashes.
 *
 * Returns:
 *   rawCancel / rawReschedule — pass ONLY to sendBookingEmails(); NEVER to HTTP response body
 *   hashCancel / hashReschedule — INSERT into bookings.cancel_token_hash / reschedule_token_hash
 */
export async function generateBookingTokens(): Promise<BookingTokens> {
  const rawCancel = crypto.randomUUID();
  const rawReschedule = crypto.randomUUID();
  const [hashCancel, hashReschedule] = await Promise.all([
    hashToken(rawCancel),
    hashToken(rawReschedule),
  ]);
  return { rawCancel, rawReschedule, hashCancel, hashReschedule };
}
