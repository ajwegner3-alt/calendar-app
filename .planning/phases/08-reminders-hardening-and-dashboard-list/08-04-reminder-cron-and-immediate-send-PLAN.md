---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-04"
type: execute
wave: 2
depends_on: ["08-01", "08-02", "08-03"]
files_modified:
  - lib/email/send-reminder-booker.ts
  - lib/booking-tokens.ts
  - app/api/cron/send-reminders/route.ts
  - app/api/bookings/route.ts
  - vercel.json
  - tests/reminder-cron.test.ts
  - tests/__mocks__/email-sender.ts
autonomous: true

must_haves:
  truths:
    - "Hitting GET /api/cron/send-reminders without Bearer CRON_SECRET returns 401"
    - "With valid auth, the route claims every confirmed booking starting in next 24h with reminder_sent_at IS NULL via compare-and-set UPDATE"
    - "Each claimed booking receives exactly one reminder email, even if cron fires twice in rapid succession"
    - "Reminder email subject is 'Reminder: {event_name} tomorrow at {time_local}' formatted in booker timezone"
    - "Reminder email content respects per-account toggles (custom_answers, location, lifecycle_links)"
    - "Booker receives reminder email with working cancel and reschedule links that resolve to the existing /cancel/[token] and /reschedule/[token] flows"
    - "Bookings created inside the 24h window get an immediate reminder fire-and-forget at booking creation (no wait for next cron tick)"
    - "vercel.json declares /api/cron/send-reminders with daily schedule (Hobby fallback)"
    - "Branding (logo, brand H1, branded button, NSI footer) matches Phase 7 confirmation email"
  artifacts:
    - path: "lib/email/send-reminder-booker.ts"
      provides: "Reminder email sender mirroring send-booking-confirmation.ts shape"
      exports: ["sendReminderBooker"]
    - path: "lib/booking-tokens.ts"
      provides: "Shared token helpers (generateRawToken + hashToken) used by cron route and bookings route"
      exports: ["generateRawToken", "hashToken"]
    - path: "app/api/cron/send-reminders/route.ts"
      provides: "GET handler with CRON_SECRET auth + compare-and-set claim + after() email send"
      exports: ["GET"]
    - path: "vercel.json"
      provides: "Cron declaration (Hobby-safe daily fallback)"
      contains: "/api/cron/send-reminders"
    - path: "tests/reminder-cron.test.ts"
      provides: "Vitest coverage for auth, claim, double-fire idempotency, toggles"
  key_links:
    - from: "app/api/cron/send-reminders/route.ts"
      to: "lib/email/send-reminder-booker.ts"
      via: "after(() => sendReminderBooker(...))"
      pattern: "sendReminderBooker"
    - from: "app/api/cron/send-reminders/route.ts"
      to: "Supabase bookings table"
      via: "UPDATE ... WHERE id = ? AND reminder_sent_at IS NULL"
      pattern: "reminder_sent_at"
    - from: "app/api/cron/send-reminders/route.ts"
      to: "lib/booking-tokens.ts"
      via: "import { generateRawToken, hashToken } from '@/lib/booking-tokens'"
      pattern: "from.*booking-tokens"
    - from: "app/api/bookings/route.ts"
      to: "lib/email/send-reminder-booker.ts"
      via: "after(() => sendReminderBooker(...)) when start_at < now()+24h"
      pattern: "sendReminderBooker"
    - from: "app/api/bookings/route.ts"
      to: "lib/booking-tokens.ts"
      via: "import { generateRawToken, hashToken } from '@/lib/booking-tokens'"
      pattern: "from.*booking-tokens"
---

<objective>
Build the reminders pipeline end-to-end: a new email sender, a cron-authenticated route, an immediate-send hook in the booking creation route, and a Hobby-safe vercel.json cron declaration. Closes EMAIL-05, INFRA-01, INFRA-02, INFRA-03.

Purpose: This is the critical Phase 8 deliverable. Reminders are the difference between a calendar tool and a usable scheduling product for trade contractors. The cron must be exactly-once even on double-fire (RESEARCH.md Pitfall 3) and must rotate cancel/reschedule tokens because confirmation tokens were not stored after Phase 5 send (RESEARCH.md Open Question 3).

Output: One sender, one cron route, one shared token-helper module, one updated booking route, one vercel.json, one integration test, and an updated email mock.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-CONTEXT.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-RESEARCH.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-01-SUMMARY.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-02-SUMMARY.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-03-SUMMARY.md
@lib/email/send-booking-confirmation.ts
@lib/email/branding-blocks.ts
@lib/email/send-cancel-emails.ts
@app/api/bookings/route.ts
</context>

**DEPENDENCY NOTE:** Plan 08-03 also modifies `app/api/bookings/route.ts` (adding rate-limit guard). This plan MUST run after 08-03 so that this plan's edits build on top of the rate-limit guard rather than overwriting it. Both 08-03 and 08-04 are in different waves now (08-03 = wave 1, 08-04 = wave 2 due to depends_on 08-01/08-02/08-03), so wave-based execution sequencing already enforces this.

<tasks>

<task type="auto">
  <name>Task 1: Build sendReminderBooker email sender + extract shared token helpers</name>
  <files>lib/email/send-reminder-booker.ts, lib/booking-tokens.ts, tests/__mocks__/email-sender.ts</files>
  <action>
    Step A — extract shared token helpers to `lib/booking-tokens.ts` (used by both cron route and bookings route — single source of truth):

    ```typescript
    // lib/booking-tokens.ts
    import "server-only";
    import crypto from "node:crypto";

    /**
     * Generate a fresh raw token. 32 random bytes -> base64url.
     * Matches the format used in Phase 5/6 email lifecycle links.
     */
    export function generateRawToken(): string {
      return crypto.randomBytes(32).toString("base64url");
    }

    /**
     * SHA-256 hash a raw token for DB storage.
     * Storage column convention: cancel_token_hash, reschedule_token_hash (Phase 5 schema).
     */
    export function hashToken(raw: string): string {
      return crypto.createHash("sha256").update(raw).digest("hex");
    }
    ```

    Step B — build `lib/email/send-reminder-booker.ts`. Mirror the shape of `lib/email/send-booking-confirmation.ts` (Phase 5) and `lib/email/send-cancel-emails.ts` (Phase 6). Reuse all branding helpers from `lib/email/branding-blocks.ts`.

    File: `lib/email/send-reminder-booker.ts`

    ```typescript
    import "server-only";
    import { TZDate } from "@date-fns/tz";
    import { format } from "date-fns";
    import { sendEmail } from "@/lib/email-sender"; // existing Phase 5 singleton
    import {
      renderEmailLogoHeader,
      renderEmailFooter,
      renderBrandedButton,
      brandedHeadingStyle,
      // include any other helpers used by send-booking-confirmation.ts for visual parity
    } from "./branding-blocks";

    export interface SendReminderBookerArgs {
      booking: {
        id: string;
        start_at: string;            // ISO timestamp (UTC from DB)
        end_at: string;
        booker_name: string;
        booker_email: string;
        booker_timezone: string;     // IANA TZ from booker
        answers: Record<string, string> | null;
      };
      eventType: {
        name: string;
        duration_minutes: number;
        location: string | null;     // NEW Phase 8 column
      };
      account: {
        slug: string;
        name: string;
        logo_url: string | null;
        brand_primary: string | null;
        owner_email?: string | null;
        // NEW Phase 8 toggle columns
        reminder_include_custom_answers: boolean;
        reminder_include_location: boolean;
        reminder_include_lifecycle_links: boolean;
      };
      rawCancelToken: string;        // freshly generated by cron / immediate-send caller
      rawRescheduleToken: string;    // freshly generated by cron / immediate-send caller
      appUrl: string;                // process.env.APP_URL or NEXT_PUBLIC_APP_URL — match what confirmation uses
    }

    export async function sendReminderBooker(args: SendReminderBookerArgs): Promise<void> {
      const startTz = new TZDate(new Date(args.booking.start_at), args.booking.booker_timezone);
      const dateLine = format(startTz, "EEEE, MMMM d, yyyy");
      const timeLine = format(startTz, "h:mm a (z)");

      // Subject (CONTEXT.md decision)
      const subject = `Reminder: ${args.eventType.name} tomorrow at ${timeLine}`;

      // Build HTML body — sections are conditional on account toggles
      const sections: string[] = [];

      sections.push(renderEmailLogoHeader(args.account));
      sections.push(`<h1 style="${brandedHeadingStyle(args.account)}">See you tomorrow</h1>`);
      sections.push(`<p>Hi ${escapeHtml(args.booking.booker_name)},</p>`);
      sections.push(`<p>This is a friendly reminder of your upcoming <strong>${escapeHtml(args.eventType.name)}</strong>.</p>`);

      // Core booking details (always shown)
      sections.push(`
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;">
          <tr><td><strong>When:</strong></td><td>${dateLine} at ${timeLine}</td></tr>
          <tr><td><strong>Duration:</strong></td><td>${args.eventType.duration_minutes} minutes</td></tr>
        </table>
      `);

      // Location (toggle-gated)
      if (args.account.reminder_include_location && args.eventType.location) {
        sections.push(`
          <p><strong>Location:</strong><br>${escapeHtml(args.eventType.location).replace(/\n/g, '<br>')}</p>
        `);
      }

      // Custom answers (toggle-gated)
      if (args.account.reminder_include_custom_answers && args.booking.answers && Object.keys(args.booking.answers).length > 0) {
        const rows = Object.entries(args.booking.answers)
          .map(([q, a]) => `<tr><td style="padding-right:12px;"><strong>${escapeHtml(q)}</strong></td><td>${escapeHtml(String(a))}</td></tr>`)
          .join("");
        sections.push(`
          <p><strong>Your answers:</strong></p>
          <table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>
        `);
      }

      // Cancel + Reschedule links (toggle-gated)
      if (args.account.reminder_include_lifecycle_links) {
        const cancelUrl = `${args.appUrl}/cancel/${args.rawCancelToken}`;
        const rescheduleUrl = `${args.appUrl}/reschedule/${args.rawRescheduleToken}`;
        sections.push(`
          <p style="margin-top:24px;">
            ${renderBrandedButton(args.account, rescheduleUrl, "Reschedule")}
            &nbsp;
            <a href="${cancelUrl}" style="color:#888; text-decoration:underline;">Cancel</a>
          </p>
        `);
      }

      sections.push(renderEmailFooter(args.account));

      const html = sections.join("\n");
      const text = stripHtml(html); // existing helper from Phase 5

      await sendEmail({
        to: args.booking.booker_email,
        subject,
        html,
        text,
      });
    }

    // Reuse existing escapeHtml / stripHtml helpers if exported from branding-blocks or a shared util;
    // otherwise import them from wherever send-booking-confirmation.ts gets them.
    ```

    Critical implementation notes:
    - Read `lib/email/send-booking-confirmation.ts` first to get the EXACT helper imports, exact `renderBrandedButton` signature, exact `sendEmail` call shape, exact `stripHtml`/`escapeHtml` source. Do NOT invent. Match Phase 5/7 conventions verbatim.
    - Subject MUST be exactly `Reminder: {event_name} tomorrow at {time_local}` (CONTEXT.md locked).
    - All three toggle blocks MUST be conditional. If a toggle is false, the corresponding block is omitted entirely.
    - Time formatting MUST use the booker's submitted timezone (TZDate + format), matching the convention used in confirmation/cancel/reschedule senders.
    - Branding: identical visual structure to Phase 7 confirmation email — logo header, brand H1, branded button, NSI-attribution footer. The reminder is the SAME visual frame with different content.

    Step C — content-quality test (Warning 9 — automated content guard for EMAIL-08):

    Add a small Vitest unit test (in the same file or a new `tests/reminder-email-content.test.ts`) that:
    1. Calls `sendReminderBooker(...)` with a mocked `sendEmail` that captures `{html, text, subject}`.
    2. Asserts on the captured HTML:
       - Every `href="..."` value is either `https://...` or starts with `/` (no `href="undefined"` or `href=""`).
       - Has a non-empty `text` plain-text alternative.
       - When `account.logo_url` is set, the rendered HTML contains an `<img>` tag with that exact URL (logo wired correctly).
       - Subject does NOT contain three or more consecutive uppercase words (no "REMINDER: BOOK YOUR" style spam).
    3. Runs against three fixture configurations: all toggles on, all toggles off, mixed.

    This is a content-quality automated guard since mail-tester score (CONTEXT.md decision: Gmail SMTP handles SPF/DKIM, content is the main remaining variable). The full mail-tester score is still part of 08-08 manual checkpoint, but this test catches obvious content regressions in CI.

    Step D — update email-sender mock:

    Update `tests/__mocks__/email-sender.ts` (or wherever the email mock lives) to include a `sendReminderBooker` named export that records its args, mirroring how `sendBookingEmails` is mocked in the Phase 5 tests.
  </action>
  <verify>
    `cat lib/booking-tokens.ts | head -10` shows `import "server-only"` at top.
    `grep -n "generateRawToken\|hashToken" lib/booking-tokens.ts` shows both exports.
    `cat lib/email/send-reminder-booker.ts | head -10` shows `import "server-only"` at top.
    `grep -n "Reminder:" lib/email/send-reminder-booker.ts` shows the subject template.
    `grep -n "reminder_include_" lib/email/send-reminder-booker.ts` shows three toggle checks.
    `grep -n "renderEmailLogoHeader\|renderEmailFooter\|renderBrandedButton" lib/email/send-reminder-booker.ts` shows all three branding helpers used.
    Type-check: `npx tsc --noEmit` passes.
    Content-quality test passes: `npm test -- reminder-email-content` (or whatever filename you use).
  </verify>
  <done>
    `sendReminderBooker(args)` is callable from cron route + booking creation route. Output email visually matches Phase 7 confirmation. All three toggles correctly omit content when false. Content-quality automated test guards against broken hrefs / missing text alt / missing logo / spammy subject. Shared token helpers live in `lib/booking-tokens.ts`. Mock is updated for downstream tests.
  </done>
</task>

<task type="auto">
  <name>Task 2: Cron route with auth, claim, after()-driven email send + token rotation</name>
  <files>app/api/cron/send-reminders/route.ts, vercel.json</files>
  <action>
    Create `app/api/cron/send-reminders/route.ts` (GET handler, Node.js runtime).

    ```typescript
    import { after, type NextRequest } from "next/server";
    import { createAdminClient } from "@/lib/supabase/admin"; // adjust path to actual admin-client factory
    import { generateRawToken, hashToken } from "@/lib/booking-tokens";
    import { sendReminderBooker } from "@/lib/email/send-reminder-booker";

    const NO_STORE = { "Cache-Control": "no-store, no-transform" } as const;

    export const runtime = "nodejs";

    export async function GET(request: NextRequest) {
      // 1. Auth check — Vercel Cron OR cron-job.org both send Authorization: Bearer <CRON_SECRET>
      const authHeader = request.headers.get("authorization");
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return new Response("Unauthorized", { status: 401, headers: NO_STORE });
      }

      const supabase = createAdminClient();
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // 2. Scan candidates (uses bookings_reminder_scan_idx — already exists)
      const { data: candidates, error: scanErr } = await supabase
        .from("bookings")
        .select(`
          id, start_at, end_at, booker_name, booker_email, booker_timezone, answers,
          event_types!inner(name, duration_minutes, location),
          accounts!inner(
            slug, name, logo_url, brand_primary, owner_email,
            reminder_include_custom_answers,
            reminder_include_location,
            reminder_include_lifecycle_links
          )
        `)
        .eq("status", "confirmed")
        .is("reminder_sent_at", null)
        .gte("start_at", now.toISOString())
        .lte("start_at", windowEnd.toISOString());

      if (scanErr) {
        console.error("[cron/send-reminders] scan error", scanErr);
        return Response.json({ ok: false, error: "scan_failed" }, { status: 500, headers: NO_STORE });
      }

      const claimed: typeof candidates = [];
      const tokensByBookingId = new Map<string, { rawCancel: string; rawReschedule: string }>();

      // 3. Compare-and-set claim per row + rotate tokens (RESEARCH Pattern 3 + Open Q 3)
      for (const c of candidates ?? []) {
        const rawCancel = generateRawToken();
        const rawReschedule = generateRawToken();
        const cancelHash = hashToken(rawCancel);
        const rescheduleHash = hashToken(rawReschedule);

        // Atomic claim: UPDATE only if reminder_sent_at IS NULL.
        // Also rotate token hashes in the SAME UPDATE so the email links work.
        const { data: claimedRow, error: claimErr } = await supabase
          .from("bookings")
          .update({
            reminder_sent_at: new Date().toISOString(),
            cancel_token_hash: cancelHash,
            reschedule_token_hash: rescheduleHash,
          })
          .eq("id", c.id)
          .is("reminder_sent_at", null)  // compare-and-set guard
          .select("id")
          .maybeSingle();

        if (claimErr) {
          console.error("[cron/send-reminders] claim error", { bookingId: c.id, err: claimErr });
          continue;
        }
        if (!claimedRow) continue; // another invocation already claimed — skip silently

        claimed.push(c);
        tokensByBookingId.set(c.id, { rawCancel, rawReschedule });

        // Optional: log to booking_events (RESEARCH Pitfall 7) — same admin client
        await supabase.from("booking_events").insert({
          booking_id: c.id,
          event_type: "reminder_sent",
          occurred_at: new Date().toISOString(),
          metadata: null,
        });
      }

      // 4. Fire-and-forget email send AFTER response is flushed (RESEARCH Pattern 4)
      after(async () => {
        const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
        for (const c of claimed) {
          const tokens = tokensByBookingId.get(c.id)!;
          try {
            await sendReminderBooker({
              booking: {
                id: c.id,
                start_at: c.start_at,
                end_at: c.end_at,
                booker_name: c.booker_name,
                booker_email: c.booker_email,
                booker_timezone: c.booker_timezone,
                answers: c.answers,
              },
              eventType: {
                name: c.event_types.name,
                duration_minutes: c.event_types.duration_minutes,
                location: c.event_types.location,
              },
              account: {
                slug: c.accounts.slug,
                name: c.accounts.name,
                logo_url: c.accounts.logo_url,
                brand_primary: c.accounts.brand_primary,
                owner_email: c.accounts.owner_email,
                reminder_include_custom_answers: c.accounts.reminder_include_custom_answers,
                reminder_include_location: c.accounts.reminder_include_location,
                reminder_include_lifecycle_links: c.accounts.reminder_include_lifecycle_links,
              },
              rawCancelToken: tokens.rawCancel,
              rawRescheduleToken: tokens.rawReschedule,
              appUrl,
            });
          } catch (err) {
            console.error("[cron/send-reminders] send error", { bookingId: c.id, err });
            // RESEARCH Pitfall 4 anti-pattern note: do NOT clear reminder_sent_at on failure.
            // Acceptable for low-volume v1 (prevents retry spam).
          }
        }
      });

      return Response.json(
        { ok: true, scanned: candidates?.length ?? 0, claimed: claimed.length },
        { headers: NO_STORE },
      );
    }
    ```

    Critical points:
    - `runtime = "nodejs"` — required for `after()` and crypto.
    - Auth check is the FIRST line of work; reject with 401 + Cache-Control: no-store on any miss.
    - Compare-and-set UPDATE is the SAME query that rotates the token hashes. This is intentional — atomic claim + token rotation in one trip prevents the case where claim succeeds but token-rotation fails leaving links unusable.
    - Token rotation: cron generates fresh `rawCancel` + `rawReschedule`, stores SHA-256 hashes via UPDATE, and includes raw tokens in the email body. This intentionally invalidates the original confirmation-email tokens — RESEARCH Open Q 3 chose this approach (simple, stateless).
    - `booking_events` insert with type `reminder_sent` (RESEARCH Pitfall 7) — use the existing column name from the Phase 6 booking_events schema; if column is named `kind` or `type` instead of `event_type`, match the existing convention. Read `supabase/migrations/20260419120000_initial_schema.sql` for the booking_events column definition.
    - Use the admin client (service-role) — RLS on bookings would block a system-level cron from reading other accounts' bookings.
    - Token helpers `generateRawToken` and `hashToken` come from `lib/booking-tokens.ts` (Task 1). Do NOT redefine them inline here.

    Then create / update `vercel.json` at project root:

    ```json
    {
      "$schema": "https://openapi.vercel.sh/vercel.json",
      "crons": [
        {
          "path": "/api/cron/send-reminders",
          "schedule": "0 8 * * *"
        }
      ]
    }
    ```

    Hobby-tier reasoning (RESEARCH §Pattern 1, Pitfall 1): on Hobby plan, only daily schedules deploy successfully. Daily fallback ensures cron fires at minimum once a day. Hourly invocations come from cron-job.org (configured in Plan 08-08 manual checkpoint). The `compare-and-set` claim makes the handler fully idempotent — invoking via Vercel daily AND cron-job.org hourly is safe and produces the same exactly-once outcome.

    If Andrew is on Pro tier (08-08 will confirm), the schedule can later change to `0 * * * *` (hourly). Plan 08-08 documents the swap.
  </action>
  <verify>
    `ls app/api/cron/send-reminders/route.ts` exists.
    `ls vercel.json` exists with `/api/cron/send-reminders` referenced.
    `grep -n "Bearer.*CRON_SECRET\|cronSecret" app/api/cron/send-reminders/route.ts` shows auth.
    `grep -n "reminder_sent_at.*IS NULL\|.is(.reminder_sent_at., null)" app/api/cron/send-reminders/route.ts` shows compare-and-set.
    `grep -n "after(" app/api/cron/send-reminders/route.ts` shows after().
    `grep -n "cancel_token_hash\|reschedule_token_hash" app/api/cron/send-reminders/route.ts` shows token rotation.
    `grep -n "from.*booking-tokens" app/api/cron/send-reminders/route.ts` shows shared helper import.
    `npx tsc --noEmit` passes.
  </verify>
  <done>
    Cron route exists with auth + scan + compare-and-set claim + token rotation + after() send. vercel.json declares daily schedule. Calling without Bearer returns 401; calling with valid Bearer returns 200 with `{ok: true, scanned, claimed}`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Immediate-send hook in /api/bookings + integration tests</name>
  <files>app/api/bookings/route.ts, tests/reminder-cron.test.ts</files>
  <action>
    Step A — immediate-send hook (INFRA-03):

    In `app/api/bookings/route.ts`, after the booking is successfully created and confirmation emails are scheduled (the existing `after(() => sendBookingEmails(...))` from 08-02), add a second `after()` block that fires the reminder email immediately IF the booking starts within the next 24 hours.

    IMPORTANT precondition: Plan 08-03 must already have run (it's now an explicit dependency in this plan's frontmatter), so `app/api/bookings/route.ts` already has the rate-limit guard inserted at the top of the POST handler. The immediate-send hook is added LATER in the function body, after the booking has been successfully committed. Preserve the rate-limit guard from 08-03 — do NOT remove or relocate it.

    ```typescript
    // At top of file:
    import { generateRawToken, hashToken } from "@/lib/booking-tokens";
    import { sendReminderBooker } from "@/lib/email/send-reminder-booker";

    // After booking is committed and after(() => sendBookingEmails(...)) is scheduled:

    const startMs = new Date(booking.start_at).getTime();
    const horizonMs = Date.now() + 24 * 60 * 60 * 1000;

    if (startMs <= horizonMs) {
      // Generate fresh tokens (using shared helpers from lib/booking-tokens.ts)
      const rawCancel = generateRawToken();
      const rawReschedule = generateRawToken();
      const cancelHash = hashToken(rawCancel);
      const rescheduleHash = hashToken(rawReschedule);

      // Atomic claim + token rotation (same pattern as cron — prevents future cron from re-sending)
      const { data: claimed } = await supabase
        .from("bookings")
        .update({
          reminder_sent_at: new Date().toISOString(),
          cancel_token_hash: cancelHash,
          reschedule_token_hash: rescheduleHash,
        })
        .eq("id", booking.id)
        .is("reminder_sent_at", null)
        .select("id")
        .maybeSingle();

      if (claimed) {
        // Optional: log booking_events (same as cron)
        await supabase.from("booking_events").insert({
          booking_id: booking.id,
          event_type: "reminder_sent",
          occurred_at: new Date().toISOString(),
        });

        after(async () => {
          // Re-fetch enriched booking data with account toggles + event_type location
          const { data: enriched } = await supabase
            .from("bookings")
            .select(`
              id, start_at, end_at, booker_name, booker_email, booker_timezone, answers,
              event_types!inner(name, duration_minutes, location),
              accounts!inner(slug, name, logo_url, brand_primary, owner_email,
                reminder_include_custom_answers, reminder_include_location, reminder_include_lifecycle_links)
            `)
            .eq("id", booking.id)
            .single();
          if (!enriched) return;

          await sendReminderBooker({
            booking: { /* from enriched */ },
            eventType: { /* from enriched.event_types */ },
            account: { /* from enriched.accounts */ },
            rawCancelToken: rawCancel,
            rawRescheduleToken: rawReschedule,
            appUrl: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "",
          });
        });
      }
    }
    ```

    Critical:
    - This runs ONLY if `start_at` is within 24h of now (INFRA-03 wording).
    - Compare-and-set claim ensures the next cron tick won't re-send for the same booking.
    - Token rotation here ALSO invalidates the just-sent confirmation email's lifecycle links. Acceptable trade-off: same-day bookings rarely need to use the confirmation-email token because the reminder arrives within seconds with newer links. This matches RESEARCH Open Q 3 design choice.
    - Token helpers come from `lib/booking-tokens.ts` (created in Task 1). Do NOT duplicate inline.
    - Rate-limit guard from 08-03 stays untouched at the top of the POST handler.

    Step B — integration test `tests/reminder-cron.test.ts`:

    Cover these cases (mirror existing test patterns in `tests/cancel-reschedule-api.test.ts`):

    1. **Auth**: GET without Bearer → 401. GET with wrong Bearer → 401. GET with correct Bearer → 200.
    2. **Scan + claim**: Seeded booking with `reminder_sent_at=null` and `start_at` 12h from now → after request, `reminder_sent_at` is non-null in DB (mocked).
    3. **Idempotency**: Two rapid invocations → only one row is claimed (second invocation sees claimed=0 because compare-and-set fails).
    4. **Window boundary**: Booking with `start_at` 25h from now is NOT claimed.
    5. **Past booking**: Booking with `start_at` in the past is NOT claimed.
    6. **Status filter**: Cancelled booking is NOT claimed even within window.
    7. **Toggle behavior**: `sendReminderBooker` is called with `account.reminder_include_location: false` when the seeded account has that toggle off — proves the cron passes toggles through (the email-rendering logic itself is covered by the sender's tests if any, or trusted via code review).
    8. **Token rotation**: After successful claim, the booking's `cancel_token_hash` and `reschedule_token_hash` differ from their pre-cron values.

    Use the existing supabase admin-client mock in `tests/__mocks__/`. Use `tests/setup.ts` env (CRON_SECRET should be set in the test env or stubbed).

    Run: `npm test -- reminder-cron`. All 8 cases pass.

    Commit:
    ```bash
    git add lib/email/send-reminder-booker.ts \
      lib/booking-tokens.ts \
      app/api/cron/send-reminders/route.ts \
      app/api/bookings/route.ts \
      vercel.json \
      tests/reminder-cron.test.ts \
      tests/__mocks__/email-sender.ts
    git commit -m "feat(08-04): reminders cron + immediate-send hook + sender + vercel.json"
    ```
  </action>
  <verify>
    `npm test -- reminder-cron` — all 8 cases pass.
    `grep -n "after(" app/api/bookings/route.ts` shows TWO after() blocks (sendBookingEmails from 08-02 + reminder block).
    `grep -n "horizonMs\|24 \* 60" app/api/bookings/route.ts` shows the 24h check.
    `grep -n "from.*booking-tokens" app/api/bookings/route.ts` shows shared helper import.
    `grep -n "checkRateLimit\|RATE_LIMITED" app/api/bookings/route.ts` confirms 08-03's rate-limit guard is still present (not accidentally removed).
    `npm run build` succeeds.
    `npm test` full suite green.
  </verify>
  <done>
    Bookings created within 24h get an immediate reminder. Future-cron does not double-send because immediate-send claim populated `reminder_sent_at`. Integration tests cover auth, claim, idempotency, window, status, toggles, token rotation. Rate-limit guard from 08-03 preserved.
  </done>
</task>

</tasks>

<verification>
1. `curl -i https://localhost:3000/api/cron/send-reminders` returns 401 (no Bearer).
2. `curl -i -H "Authorization: Bearer $CRON_SECRET" https://localhost:3000/api/cron/send-reminders` returns 200 + JSON with scanned/claimed counts.
3. Calling the cron twice in succession claims the same booking only once (DB check).
4. `vercel.json` declares the cron path.
5. `npm test` full suite green; new `reminder-cron` test passes.
6. `npm run build` succeeds.
7. Rate-limit guard from 08-03 still in place at top of POST /api/bookings handler.
</verification>

<success_criteria>
- INFRA-01: Cron route claims via compare-and-set; double-fire safe.
- INFRA-02: Bearer CRON_SECRET enforced on every invocation.
- INFRA-03: Bookings inside 24h window get an immediate reminder.
- EMAIL-05: Booker receives reminder ~24h before appointment with branded styling, conditional toggle blocks, and working cancel/reschedule links.
- vercel.json daily fallback in place; ready for cron-job.org hourly driver in Plan 08-08.
- Content-quality automated test guards reminder email HTML in CI (broken hrefs, missing text alt, missing logo, spammy subject).
</success_criteria>

<output>
After completion, create `.planning/phases/08-reminders-hardening-and-dashboard-list/08-04-SUMMARY.md` documenting:
- Token-rotation strategy chosen and side effect on confirmation-email tokens
- Confirmation that `lib/booking-tokens.ts` was extracted as shared helper module
- Integration test count and what cases are covered
- Content-quality test outcomes (which assertions passed/failed)
- Vercel.json schedule chosen and Hobby-tier rationale
- Any deviations from RESEARCH.md patterns

---

## Phase 8 Wave Layout (current as of this revision)

| Wave | Plans | Notes |
|------|-------|-------|
| 1 | 08-01, 08-02, 08-03 | All independent (no depends_on) — run in parallel |
| 2 | 08-04, 08-05, 08-06, 08-07 | All depend on Wave 1 plans; 08-04 also depends on 08-03 (shared file: app/api/bookings/route.ts) |
| 3 | 08-08 | Depends on 08-04 (cron exists before ops checkpoints) |

08-04's added `08-03` dependency does NOT change wave assignment (08-03 is wave 1; max-of-deps + 1 = 2, same as before).
</output>
