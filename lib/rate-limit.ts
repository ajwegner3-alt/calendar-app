import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Default rate-limit config for Phase 6 public token routes (LIFE-04).
 *
 * 10 requests / IP / 5-minute sliding window — CONTEXT decision threshold.
 * Catches enumeration attempts; tolerates a real booker retrying on flaky network.
 *
 * Phase 8 hardening (INFRA-01) may tighten or relax these per-route. For now,
 * /cancel/* and /reschedule/* both consume this default.
 */
export const DEFAULT_TOKEN_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 5 * 60 * 1000, // 5 minutes
} as const;

export interface RateLimitResult {
  /** True if the request is within the window allowance and should proceed. */
  allowed: boolean;
  /** Seconds the caller should wait before retrying. Always present even when allowed (= 0). */
  retryAfterSeconds: number;
  /** Current count of events in the window (for logging / debugging). */
  current: number;
}

/**
 * Postgres-backed sliding-window rate limiter (RESEARCH §Pattern 5 + §Rate-Limit
 * Storage Backend Decision).
 *
 * Algorithm:
 *   1. SELECT count(*) FROM rate_limit_events WHERE key = ? AND occurred_at >= now() - windowMs
 *   2. If count >= maxRequests → return { allowed: false, retryAfterSeconds: ceil(windowMs/1000) }
 *      (DOES NOT insert — exhausted)
 *   3. Otherwise INSERT { key, occurred_at: now() } and return { allowed: true, retryAfterSeconds: 0 }
 *
 * Concurrency note: count-then-insert has a small race window where two
 * concurrent requests at count == maxRequests-1 both see "allowed" and both
 * insert. Acceptable for the single-owner abuse-prevention threshold; not
 * cryptographic enforcement (RESEARCH §Rate-Limit Storage Backend Decision).
 *
 * Fails OPEN on DB error — better to allow a token request through than to
 * lock out a legitimate booker due to a transient DB hiccup.
 *
 * @param key — typically `${routeName}:${ip}`, e.g. "cancel:203.0.113.1"
 * @param maxRequests — usually DEFAULT_TOKEN_RATE_LIMIT.maxRequests (10)
 * @param windowMs — usually DEFAULT_TOKEN_RATE_LIMIT.windowMs (5 minutes)
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  // Count requests in window
  const { count, error: countError } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .gte("occurred_at", windowStart);

  if (countError) {
    // Fail OPEN on DB error — better to allow a token request through than to
    // lock out a legitimate booker because of a transient DB hiccup. The DB
    // error is logged for forensics. RESEARCH does not lock this; reasonable
    // hardening tradeoff for a personal scheduling app.
    console.error("[rate-limit] count query failed; failing open:", countError);
    return { allowed: true, retryAfterSeconds: 0, current: 0 };
  }

  const current = count ?? 0;

  if (current >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
      current,
    };
  }

  // Record this request — fire-and-await (insert must succeed before we say
  // allowed, otherwise the next request gets a stale count). Insert error
  // does NOT block the request (the user is honest; we just lose a counter
  // tick).
  const { error: insertError } = await supabase
    .from("rate_limit_events")
    .insert({ key });

  if (insertError) {
    console.error("[rate-limit] insert failed (non-fatal):", insertError);
  }

  return { allowed: true, retryAfterSeconds: 0, current: current + 1 };
}
