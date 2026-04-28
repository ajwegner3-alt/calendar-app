---
phase: 10
plan: 04
type: execute
name: "gmail-smtp-quota-cap-and-alert"
wave: 2
depends_on: ["10-01"]
files_modified:
  - "lib/email-sender/quota-guard.ts"
  - "lib/email-sender/quota-guard.test.ts"
  - "supabase/migrations/20260428120003_phase10_email_send_log.sql"
  - "lib/email-sender/index.ts"
  - "FUTURE_DIRECTIONS.md"
autonomous: true
must_haves:
  truths:
    - "Daily transactional-email volume is capped at SIGNUP_DAILY_EMAIL_CAP (default 200) per Postgres counter"
    - "When daily count crosses 80% of cap, a one-time-per-day warning is logged via console.error tagged GMAIL_SMTP_QUOTA_APPROACHING"
    - "When daily count crosses cap, sends fail-CLOSED returning a typed QuotaExceededError"
    - "Signup-specific emails (verification, welcome) check this guard BEFORE calling the email-sender; bookings/reminders bypass to keep core flow alive"
    - "v1.2 follow-up to migrate to Resend or Postmark is documented in FUTURE_DIRECTIONS.md"
  artifacts:
    - path: "lib/email-sender/quota-guard.ts"
      provides: "checkAndConsumeQuota(category) and getDailySendCount() helpers backed by email_send_log table"
      exports: ["checkAndConsumeQuota", "getDailySendCount", "QuotaExceededError", "SIGNUP_DAILY_EMAIL_CAP"]
    - path: "supabase/migrations/20260428120003_phase10_email_send_log.sql"
      provides: "email_send_log table (id, sent_at, category) with RLS deny-all for authenticated; service-role only access"
      contains: "create table.*email_send_log"
  key_links:
    - from: "app/(auth)/app/signup/actions.ts + lib/onboarding/welcome-email.ts (signup-side call sites)"
      to: "lib/email-sender/quota-guard.ts"
      via: "await checkAndConsumeQuota('signup-verify' | 'signup-welcome') BEFORE invoking sendEmail() from @/lib/email-sender"
      pattern: "checkAndConsumeQuota"
  requirements:
    - "ARCH DECISION #2 — Gmail SMTP quota plan: Cap signups at 200/day + log warning at 80% + fail-closed at 100%"
    - "Mitigates P-A12 (highest under-mitigated v1.1 risk per PITFALLS.md)"
---

## Objective

Commit Architectural Decision #2 (Gmail SMTP quota plan): cap daily transactional-email volume at 200/day with an 80%-threshold warning, fail-closed at 100%. Uses a Postgres counter table (`email_send_log`), not in-memory state, so multi-instance Vercel deploys share the count. Signup verification + welcome emails consume the quota; booking/reminder emails bypass it (those existed in v1.0 and have their own retry semantics — protecting them protects the core booker flow). Document Resend/Postmark migration as v1.2 follow-up.

## Context

### Architectural Decision #2 — COMMITTED: Cap + alert (free-tier hybrid)

**Why this option (vs. immediate Resend migration):**
- User preference (CLAUDE.md): "Prefer free-tier tools and services whenever possible" + "Prefer custom-built tools over n8n workflows."
- Adding a Postgres-backed counter is a 1-day change; migrating to Resend/Postmark is a multi-day vendor onboarding (account, domain auth, DKIM, SPF, env-var swap, code refactor across all email surfaces).
- Gmail's actual quota per PITFALLS.md P-A12 is "~500/day" — capping at 200/day (40% of cap) leaves headroom for Andrew's existing booking + reminder volume, with linear scaling capacity for growth.
- 200/day at $0/month buys time to gauge actual signup volume before paying for Postmark or Resend at $10-20/month.

**Tradeoffs accepted:**
- Hard-cap at 200 means a signup spike (e.g., HN front page) blocks new signups for the rest of the day. Acceptable for v1.1 because (a) it's an outage of new-signups not existing-users, (b) the alternative (uncapped) risks Gmail account suspension which would brick ALL email including bookings.
- Counter is best-effort sliding window (per-day calendar boundary, not 24h sliding) — simple and good enough.

**Documented v1.2 backlog:** Migrate to Resend (~$10/mo for 5k emails). FUTURE_DIRECTIONS.md gets an entry in 10-09's FUTURE_DIRECTIONS update OR can be added now as part of this plan.

## Tasks

<task id="1" type="auto">
  <description>
    Create `supabase/migrations/20260428120003_phase10_email_send_log.sql`:

    ```sql
    -- Phase 10: per-day email-send counter table for Gmail SMTP quota guard.
    -- Service-role-only access (no RLS policies → authenticated/anon get nothing).

    create table if not exists email_send_log (
      id bigserial primary key,
      sent_at timestamptz not null default now(),
      category text not null check (category in (
        'signup-verify',
        'signup-welcome',
        'password-reset',
        'email-change',
        -- bookings/reminders intentionally NOT listed; they bypass the guard.
        'other'
      ))
    );

    -- Index for daily-count queries.
    create index email_send_log_sent_at_idx on email_send_log (sent_at desc);

    -- RLS on (deny-all to authenticated/anon — service role bypasses RLS).
    alter table email_send_log enable row level security;

    -- Optional: a daily-cleanup helper (run manually or via future cron).
    -- Rows older than 30 days are not needed for the daily counter.
    -- (Not adding cron now — manual cleanup acceptable in v1.1.)
    ```

    Apply: `npx supabase db query --linked -f supabase/migrations/20260428120003_phase10_email_send_log.sql`.
  </description>
  <files>supabase/migrations/20260428120003_phase10_email_send_log.sql (new)</files>
  <verification>
    Apply migration; `npx supabase db query --linked -c "select count(*) from email_send_log;"` returns 0.
    `npx supabase db query --linked -c "select rowsecurity from pg_tables where tablename='email_send_log';"` returns t.
  </verification>
</task>

<task id="2" type="auto">
  <description>
    Create `lib/email-sender/quota-guard.ts`:

    ```ts
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
      constructor(public count: number, public cap: number) {
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
    ```

    Plus `lib/email-sender/quota-guard.test.ts` — 4 vitest cases:
    1. Below threshold: returns silently, inserts row.
    2. At 80%: logs warning, inserts row.
    3. At cap: throws QuotaExceededError, does NOT insert.
    4. DB error on count: fails OPEN (returns 0, allows send).

    Use existing test setup from `tests/helpers/auth.ts` for admin client wiring; mock the email_send_log table via Supabase test fixtures or use a transaction rollback pattern if helpers exist. If no clean fixture pattern: use `vi.mock("@/lib/supabase/admin", ...)` with stubbed methods.
  </description>
  <files>
    lib/email-sender/quota-guard.ts (new)
    lib/email-sender/quota-guard.test.ts (new)
  </files>
  <verification>
    `npx tsc --noEmit` clean.
    `npm test -- lib/email-sender/quota-guard.test.ts` — all 4 cases pass.
    `npx eslint lib/email-sender/quota-guard.ts` clean.
  </verification>
</task>

<task id="3" type="auto">
  <description>
    Wire the quota guard into the signup-side call sites that route through the email-sender.

    **RESOLVED ENTRY POINT (verified via Grep on 2026-04-28):** the project's email-sender entry point is the vendored package at `lib/email-sender/index.ts`, which exports a `sendEmail(options: EmailOptions)` function. ALL `lib/email/send-*.ts` modules (send-booking-confirmation, send-cancel-emails, send-reschedule-emails, send-owner-notification, send-reminder-booker) import from `@/lib/email-sender`. There is NO `lib/email/send.ts` and NO `sendTransactionalEmail` symbol — those names were placeholders. The real symbol is `sendEmail` and the real path is `@/lib/email-sender`.

    **Architecture decision: gate at CALL SITE, not inside `sendEmail()`.** Reason: `sendEmail()` is shared by booking + reminder paths which MUST bypass the quota guard. Adding a category parameter to `sendEmail()` and routing the guard inside would either (a) require touching every existing v1.0 caller to add a category, or (b) create a default-bypass that's easy to mis-set. Instead, the signup-side callers (signup Server Action, welcome-email helper, future password-reset welcome-back, etc.) call `checkAndConsumeQuota('signup-verify' | 'signup-welcome' | 'password-reset' | 'email-change')` BEFORE calling `sendEmail()`. Booking/reminder paths call `sendEmail()` directly with no guard.

    **Files this task touches:**
    1. `lib/email-sender/index.ts` — add a brief JSDoc comment on the exported `sendEmail()` documenting the call-site-guard contract:
       ```ts
       /**
        * Send an email via the configured provider (Gmail SMTP in v1.x).
        *
        * QUOTA GUARD CONTRACT (Phase 10): signup-side callers (signup, welcome,
        * password-reset, email-change) MUST call `checkAndConsumeQuota(category)`
        * from `@/lib/email-sender/quota-guard` BEFORE calling sendEmail(). Booking
        * and reminder paths bypass the guard intentionally — they have their own
        * retry semantics and protecting them is the design goal of the cap.
        */
       export async function sendEmail(options: EmailOptions): Promise<EmailResult> { ... }
       ```
       NO behavior change — comment-only addition. This documents the contract so future readers don't accidentally route booking emails through the guard or skip it on signup-side.

    2. `FUTURE_DIRECTIONS.md` (repo root) — add an entry under "Future Improvements":
       ```
       - **Gmail SMTP → Resend/Postmark migration.** Phase 10 ships a 200/day cap +
         80%-threshold warning + fail-closed-at-cap to mitigate P-A12. v1.2 should
         migrate to Resend ($10/mo for 5k transactional emails) for higher headroom
         and proper SPF/DKIM/DMARC posture (closes EMAIL-08 v1.2 backlog item).
       ```

    **Actual call-site wiring lives in the consumer plans, not here:**
    - Plan 10-05 Task 3 wires the guard into `app/(auth)/app/signup/actions.ts` (BEFORE `supabase.auth.signUp()` — that's how we gate the Supabase-fired verification email; we can't intercept Supabase's send, but we can refuse to even request it).
    - Plan 10-06 Task 3 wires the guard into `lib/onboarding/welcome-email.ts` (BEFORE `sendEmail()` for the welcome message).
    - Plan 10-08 Task 2 wires the guard into the email-change Server Action.

    **Bypass categories (do NOT call checkAndConsumeQuota):** booking confirmation, booking cancellation, booking reschedule, booking reminder, owner notifications. These are existing v1.0 surfaces (`lib/email/send-booking-confirmation.ts`, `send-cancel-emails.ts`, `send-reschedule-emails.ts`, `send-reminder-booker.ts`, `send-owner-notification.ts`) with their own retry/SLA semantics; protecting them from new-signup spikes is the entire point of the cap.

    Note: the Supabase verification email itself is sent by Supabase Auth's SMTP integration (configured in 10-05 to use the project's Gmail SMTP via App Password). The quota-guard cannot intercept that send — but it CAN gate the application-side `signUp()` call BEFORE Supabase fires the email. That is the pattern in 10-05's Server Action.
  </description>
  <files>
    lib/email-sender/index.ts (modify — add JSDoc contract comment on sendEmail)
    FUTURE_DIRECTIONS.md (modify — add Resend migration entry)
  </files>
  <verification>
    `git grep "checkAndConsumeQuota" -- lib/email-sender/` should match the declaration in `lib/email-sender/quota-guard.ts` and the test file `lib/email-sender/quota-guard.test.ts`. (Call sites are in 10-05/10-06/10-08 plans — verify after those plans execute.)
    `git grep "QUOTA GUARD CONTRACT" lib/email-sender/index.ts` returns 1 match (the JSDoc was added).
    `git grep "checkAndConsumeQuota" -- lib/email/` should return ZERO matches (booking/reminder paths are NOT guarded).
    `git grep "Gmail SMTP → Resend" FUTURE_DIRECTIONS.md` returns 1 match.
    `npm test` passes (no regressions — the comment-only edit to index.ts shouldn't break anything).
    `npx tsc --noEmit` clean.
  </verification>
</task>

## Verification Criteria

- `email_send_log` table exists with RLS enabled.
- `lib/email-sender/quota-guard.ts` exports `checkAndConsumeQuota`, `getDailySendCount`, `QuotaExceededError`, `SIGNUP_DAILY_EMAIL_CAP`.
- 4 unit tests pass (below threshold / at warn / at cap / DB error).
- Quota guard is wired into signup verification + welcome email paths only — NOT booking/reminder.
- FUTURE_DIRECTIONS.md has the Resend migration entry.

## must_haves

- **Architectural Decision #2 committed: Cap at 200/day + 80% warning + fail-closed-at-cap.**
- Mitigates P-A12 (Gmail SMTP quota exhaustion — highest under-mitigated v1.1 risk).
- v1.2 Resend migration documented in FUTURE_DIRECTIONS.md.
