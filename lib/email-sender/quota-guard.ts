import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily cap on Gmail transactional sends per account. 450/day = 90% of Gmail's
 * ~500/day soft limit, leaving a 50-msg buffer for booking + reminder volume.
 *
 * As of Phase 35 (EMAIL-27), the cap is per-account: each account has its own
 * independent 450/day limit. Account A exhausting its quota does NOT affect
 * Account B. Signup-side paths (welcome email) currently pass the new account's
 * id post-creation; pre-account signup-verify/password-reset pass null and
 * remain on a global fallback until Phase 36 (Resend migration).
 *
 * Phase 36: Resend accounts bypass the 450/day cap entirely. The cap only
 * applies to Gmail (email_provider='gmail' or missing account row). Resend
 * accounts still log each send via email_send_log with provider='resend'.
 *
 * Phase 45 (EMAIL-35): per-account cap raised to 450/day (PROJECT.md target —
 * 50-msg buffer below Google's 500/day free-Gmail ceiling). Phase 46-03 UAT
 * found the initial 45-01 implementation shipped at 400; corrected to 450
 * per PROJECT.md spec.
 */
export const SIGNUP_DAILY_EMAIL_CAP = 450;
const WARN_THRESHOLD_PCT = 0.8;

export type EmailCategory =
  | "signup-verify"
  | "signup-welcome"
  | "password-reset"
  | "email-change"
  | "other"
  // Phase 31 (EMAIL-21): booking-side paths now go through the guard
  | "booking-confirmation"
  | "owner-notification"
  | "reminder"
  | "cancel-booker"
  | "cancel-owner"
  | "reschedule-booker"
  | "reschedule-owner";

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
 * Returns the count of email_send_log rows for the given account in the current
 * calendar day (UTC). Day boundary: UTC midnight.
 *
 * Phase 35 (EMAIL-27): filter is now per-account so each account's daily
 * limit is independent. Pass the account's UUID; legacy rows without account_id
 * are excluded from the per-account count (they pre-date Phase 35).
 */
export async function getDailySendCount(accountId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("email_send_log")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId)
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
 *   try { await checkAndConsumeQuota("signup-verify", accountId); await sender.send(...); }
 *   catch (e) { if (e instanceof QuotaExceededError) ...handle... else throw; }
 *
 * Phase 36 (OQ-1): internally reads accounts.email_provider to decide whether
 * to enforce the per-account Gmail cap. Resend accounts bypass the cap but still
 * insert an email_send_log row with provider='resend'. Centralizing here means
 * none of the 7 leaf callers need to change.
 *
 * The signup-side nil-UUID sentinel ('00000000-0000-0000-0000-000000000000')
 * won't match any accounts row; maybeSingle() returns null and we fall through
 * to the Gmail path (cap enforced) — exactly right for system-level sends like
 * welcome and signup-verify.
 *
 * 80% threshold logs a tagged warning ONCE PER ACCOUNT PER DAY (best-effort
 * de-dup via a tiny in-memory set keyed by UTC-day + account; for multi-instance
 * Vercel deploys this could log 2-3x per day total, which is acceptable).
 */
const warnedDays = new Set<string>();

export async function checkAndConsumeQuota(
  category: EmailCategory,
  accountId: string,
): Promise<void> {
  const admin = createAdminClient();

  // Phase 36: read email_provider so we know whether to enforce the
  // per-account Gmail cap. Resend accounts bypass the cap entirely (CONTEXT
  // decision — they have NSI's verified domain and a separate volume model).
  // The signup-side nil-UUID sentinel ('00000000-...') won't match any row
  // here; the maybeSingle() returns null and we fall through to the Gmail
  // path (cap enforced) — which is exactly what we want for system-level
  // sends like welcome and signup-verify.
  const { data: acct } = await admin
    .from("accounts")
    .select("email_provider")
    .eq("id", accountId)
    .maybeSingle();

  const provider: "gmail" | "resend" = acct?.email_provider === "resend" ? "resend" : "gmail";

  if (provider === "gmail") {
    const count = await getDailySendCount(accountId);
    if (count >= SIGNUP_DAILY_EMAIL_CAP) {
      throw new QuotaExceededError(count, SIGNUP_DAILY_EMAIL_CAP);
    }
    if (count >= SIGNUP_DAILY_EMAIL_CAP * WARN_THRESHOLD_PCT) {
      const today = new Date().toISOString().slice(0, 10);
      const warnKey = `${today}:${accountId}`;
      if (!warnedDays.has(warnKey)) {
        warnedDays.add(warnKey);
        console.error(
          `[GMAIL_SMTP_QUOTA_APPROACHING] account=${accountId} ${count}/${SIGNUP_DAILY_EMAIL_CAP} sent today. Consider Resend migration.`,
        );
      }
    }
  }
  // For provider==='resend', no cap check — abuse threshold is enforced
  // by warnIfResendAbuseThresholdCrossed() inside getSenderForAccount.

  // Log the send with the correct provider tag.
  const { error } = await admin
    .from("email_send_log")
    .insert({ category, account_id: accountId, provider });
  if (error) {
    console.error("[quota-guard] insert failed; send proceeds anyway", error);
  }
}

/**
 * Phase 31 (EMAIL-21): batch pre-flight helper.
 * Returns the count of sends remaining today for the given account, clamped to >= 0.
 * Consumed by Phase 32 (auto-cancel batch) and Phase 33 (pushback batch) pre-flight checks.
 *
 * Phase 35 (EMAIL-27): now per-account — each account has its own independent limit.
 */
export async function getRemainingDailyQuota(accountId: string): Promise<number> {
  const count = await getDailySendCount(accountId);
  return Math.max(0, SIGNUP_DAILY_EMAIL_CAP - count);
}

/**
 * Phase 31 (EMAIL-25): PII-free structured refusal log.
 * Required fields per requirement: code, account_id, sender_type, count, cap.
 * Do NOT add booker_email / booker_name / booker_phone / ip / answers.
 * Pass null for account_id only when truly unknown (e.g., signup paths pre-account).
 */
export function logQuotaRefusal(params: {
  account_id: string | null;
  sender_type: EmailCategory;
  count: number;
  cap: number;
}): void {
  console.error("[EMAIL_QUOTA_EXCEEDED]", {
    code: "EMAIL_QUOTA_EXCEEDED",
    account_id: params.account_id,
    sender_type: params.sender_type,
    count: params.count,
    cap: params.cap,
  });
}
