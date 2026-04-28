import "server-only";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Per-route auth rate limits (per CONTEXT.md Claude's Discretion).
 * All counts are per IP (or per IP+email where indicated).
 * Re-uses the v1.0 rate_limit_events Postgres table via lib/rate-limit.ts.
 *
 * To adjust a threshold: edit this file only — all auth actions delegate here.
 */
export const AUTH_RATE_LIMITS = {
  signup: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour / IP
  login: { max: 10, windowMs: 5 * 60 * 1000 }, // 10 / 5 min / IP
  forgotPassword: { max: 3, windowMs: 60 * 60 * 1000 }, // 3 / hour / (IP+email)
  resetPassword: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour / IP
  resendVerify: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour / (IP+email); 1/min applied separately in 10-02
  emailChange: { max: 3, windowMs: 60 * 60 * 1000 }, // 3 / hour / `${ip}:${uid}`
  // uid is fine here — user is authenticated; keying on uid prevents cross-device
  // bypass while tolerating shared IPs (e.g. office NAT).
} as const;

type AuthRouteKey = keyof typeof AUTH_RATE_LIMITS;

/**
 * Thin wrapper around lib/rate-limit.ts checkRateLimit.
 *
 * @param route      - Auth route key (see AUTH_RATE_LIMITS above).
 * @param identifier - Typically ip, or `${ip}:${email}` / `${ip}:${uid}` per route.
 *
 * @example
 *   const rl = await checkAuthRateLimit("login", ip);
 *   if (!rl.allowed) return { formError: "Too many attempts." };
 */
export async function checkAuthRateLimit(
  route: AuthRouteKey,
  identifier: string,
) {
  const cfg = AUTH_RATE_LIMITS[route];
  return checkRateLimit(`auth:${route}:${identifier}`, cfg.max, cfg.windowMs);
}
