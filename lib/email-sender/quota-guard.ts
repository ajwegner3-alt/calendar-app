import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily cap on Gmail SMTP transactional sends. 200/day = 40% of Gmail's
 * ~500/day soft limit, leaving headroom for booking + reminder volume.
 * v1.2 will migrate to Resend (~$10/mo for 5k emails); see FUTURE_DIRECTIONS.md.
 */
export const SIGNUP_DAILY_EMAIL_CAP = 200;
const WARN_THRESHOLD_PCT = 0.8;

export type EmailCategory =
  | "signup-verify"
  | "signup-welcome"
  | "password-reset"
  | "email-change"
  | "other";

export class QuotaExceededError extends Error {
  constructor(
    public count: number,
    public cap: number,
  ) {
    super(`Daily email quota exceeded: ${count}/${cap}`);
    this.name = "QuotaExceededError";
  }
}

/**
 * Returns the count of email_send_log rows in the current calendar day (UTC).
 * Day boundary: UTC midnight. Acceptable approximation; no DST edge cases.
 */
export async function getDailySendCount(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("email_send_log")
    .select("*", { count: "exact", head: true })
    .gte("sent_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());
  if (error) {
    // Fail OPEN on DB error (mirrors lib/rate-limit.ts pattern). Better to
    // send a duplicate signup email than to brick signup on a transient DB hiccup.
    console.error("[quota-guard] getDailySendCount failed; allowing send", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Check the cap, log the send if allowed, throw if at cap.
 * Caller pattern:
 *   try { await checkAndConsumeQuota("signup-verify"); await sendEmail(...); }
 *   catch (e) { if (e instanceof QuotaExceededError) ...handle... else throw; }
 *
 * 80% threshold logs a tagged warning ONCE PER DAY (best-effort de-dup via
 * a tiny in-memory set keyed by UTC-day; for multi-instance Vercel deploys
 * this could log 2-3x per day total, which is acceptable signal-to-noise).
 */
const warnedDays = new Set<string>();

export async function checkAndConsumeQuota(category: EmailCategory): Promise<void> {
  const count = await getDailySendCount();
  if (count >= SIGNUP_DAILY_EMAIL_CAP) {
    throw new QuotaExceededError(count, SIGNUP_DAILY_EMAIL_CAP);
  }
  if (count >= SIGNUP_DAILY_EMAIL_CAP * WARN_THRESHOLD_PCT) {
    const today = new Date().toISOString().slice(0, 10);
    if (!warnedDays.has(today)) {
      warnedDays.add(today);
      console.error(
        `[GMAIL_SMTP_QUOTA_APPROACHING] ${count}/${SIGNUP_DAILY_EMAIL_CAP} sent today. Consider Resend migration.`,
      );
    }
  }
  // Log the send.
  const admin = createAdminClient();
  const { error } = await admin.from("email_send_log").insert({ category });
  if (error) {
    console.error("[quota-guard] insert failed; send proceeds anyway", error);
  }
}
