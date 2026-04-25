import "server-only";

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface CloudflareSiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns true if the token validates against the configured secret.
 *
 * Fails closed: network errors return false (booking POST should return 403).
 *
 * IMPORTANT: Tokens are single-use (RESEARCH Pitfall 5). On any failure
 * (validation error, 409, etc.), the form must call turnstileRef.current?.reset()
 * before allowing re-submission.
 *
 * @param token   - Turnstile response token from the client widget
 * @param remoteIp - Optional visitor IP; passed as `remoteip` for extra validation
 */
export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "[turnstile] TURNSTILE_SECRET_KEY is not set in environment.",
    );
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
  } catch {
    // Network error — fail closed so bots can't slip through on infra issues.
    console.error("[turnstile] Network error contacting Cloudflare siteverify");
    return false;
  }

  if (!res.ok) {
    console.error(
      `[turnstile] Cloudflare siteverify returned HTTP ${res.status}`,
    );
    return false;
  }

  const data = (await res.json()) as CloudflareSiteverifyResponse;

  if (!data.success && data["error-codes"]?.length) {
    console.warn("[turnstile] Validation failed:", data["error-codes"]);
  }

  return data.success === true;
}
