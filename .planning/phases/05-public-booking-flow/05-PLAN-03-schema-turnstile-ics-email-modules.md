---
phase: 05-public-booking-flow
plan: 03
type: execute
wave: 2
depends_on: ["05-01", "05-02"]
files_modified:
  - lib/bookings/schema.ts
  - lib/turnstile.ts
  - lib/email/build-ics.ts
  - lib/email/send-booking-confirmation.ts
  - lib/email/send-owner-notification.ts
  - lib/email/send-booking-emails.ts
autonomous: true

must_haves:
  truths:
    - "lib/bookings/schema.ts exports bookingInputSchema (Zod) accepting: eventTypeId(uuid), startAt(ISO datetime), endAt(ISO datetime), bookerName(1..200), bookerEmail(email), bookerPhone(min 7 chars + format-loose regex), bookerTimezone(IANA string min 1), answers(record string→string), turnstileToken(min 1)"
    - "Schema validates Turnstile token presence (string min 1); empty/missing rejected at parse"
    - "Schema validates phone format-loose: allows digits + spaces + dashes + parens + plus, min 7 chars (per CONTEXT decision #3)"
    - "lib/turnstile.ts exports verifyTurnstile(token) calling Cloudflare siteverify; returns boolean; uses TURNSTILE_SECRET_KEY env var; throws if env missing"
    - "lib/email/build-ics.ts exports buildIcsBuffer(opts) using ical-generator + timezones-ical-library; sets METHOD:REQUEST, stable UID = booking.id, VTIMEZONE block from timezones-ical-library"
    - "lib/email/send-booking-confirmation.ts exports sendBookingConfirmation({booking, eventType, account, ownerEmail}) — sends HTML email with .ics attachment to booker; subject 'Booking confirmed: [event] on [date]'; from-name 'Andrew @ NSI'; includes cancel + reschedule URLs (Phase 6 routes 404 until then but URL format is locked here)"
    - "lib/email/send-owner-notification.ts exports sendOwnerNotification({booking, eventType, account, ownerEmail}) — sends HTML email to ownerEmail; subject 'New booking: [name] — [event] on [date]'; reply-to = booker_email; body includes full custom-question answers"
    - "lib/email/send-booking-emails.ts exports sendBookingEmails(args) — fire-and-forget orchestrator; calls both senders; catches per-email errors and console.error()s but never throws (Pitfall: booking succeeds even if email fails)"
    - "All times in emails formatted in BOOKER timezone using @date-fns/tz (CONTEXT decision #7) — confirmation screen + email date strings honor booker_timezone; .ics ORGANIZER + ATTENDEE intact"
    - "All email modules import sendEmail from @/lib/email-sender (vendored Plan 05-02), not directly from a Resend SDK"
    - "Cancel/reschedule URLs in email follow format: ${APP_URL}/cancel/${rawToken} and ${APP_URL}/reschedule/${rawToken} — Phase 6 routes consume these tokens; format LOCKED here per CONTEXT decision #10"
  artifacts:
    - path: "lib/bookings/schema.ts"
      provides: "Zod schema for /api/bookings input"
      contains: "bookingInputSchema"
      exports: ["bookingInputSchema", "BookingInput"]
      min_lines: 25
    - path: "lib/turnstile.ts"
      provides: "Server-side Turnstile verification helper"
      contains: "verifyTurnstile"
      exports: ["verifyTurnstile"]
      min_lines: 20
    - path: "lib/email/build-ics.ts"
      provides: "ical-generator wrapper returning Buffer"
      contains: "buildIcsBuffer"
      exports: ["buildIcsBuffer"]
      min_lines: 30
    - path: "lib/email/send-booking-confirmation.ts"
      provides: "Booker confirmation email with .ics attachment"
      contains: "sendBookingConfirmation"
      exports: ["sendBookingConfirmation"]
      min_lines: 40
    - path: "lib/email/send-owner-notification.ts"
      provides: "Owner notification email with reply-to=booker"
      contains: "sendOwnerNotification"
      exports: ["sendOwnerNotification"]
      min_lines: 30
    - path: "lib/email/send-booking-emails.ts"
      provides: "Fire-and-forget orchestrator"
      contains: "sendBookingEmails"
      exports: ["sendBookingEmails"]
      min_lines: 20
  key_links:
    - from: "lib/email/build-ics.ts"
      to: "ical-generator + timezones-ical-library"
      via: "ical().method(REQUEST).timezone({generator: tzlib_get_ical_block})"
      pattern: "ICalCalendarMethod.REQUEST"
    - from: "lib/email/send-booking-confirmation.ts"
      to: "lib/email-sender"
      via: "sendEmail({to, subject, html, attachments: [{filename: 'invite.ics', content: icsBuffer, contentType: 'text/calendar; method=REQUEST'}]})"
      pattern: "text/calendar; method=REQUEST"
    - from: "lib/email/send-booking-emails.ts"
      to: "Both per-email senders"
      via: "void sendBookingConfirmation(...).catch(console.error); void sendOwnerNotification(...).catch(console.error)"
      pattern: "\\.catch"
---

<objective>
Build the pure-ish modules consumed by the `/api/bookings` Route Handler (Plan 05-05): the Zod input schema, the Turnstile verify helper, the .ics buffer builder, and the two email senders + orchestrator. These are file-isolated from the booking page UI, so they can run in Wave 2 in parallel with the page shell (Plan 05-04).

Purpose: EMAIL-01..04 + BOOK-07. The booking submission flow stitches these together — Plan 05-05 is a thin shell that validates input, verifies the bot check, hashes tokens, inserts the booking, then fires emails. Building each module as a discrete, testable unit keeps the route handler small and lets the Wave 4 integration test mock just what it needs.

Output: Six files under `lib/bookings/` and `lib/email/`. All modules pass `npm run build` + `npm run lint`. No tests in this plan — Wave 4 covers integration testing.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-public-booking-flow/05-CONTEXT.md
@.planning/phases/05-public-booking-flow/05-RESEARCH.md
@.planning/phases/05-public-booking-flow/05-01-SUMMARY.md
@.planning/phases/05-public-booking-flow/05-02-SUMMARY.md

# Vendored email-sender (Plan 05-02 output)
@lib/email-sender/types.ts
@lib/email-sender/index.ts

# date-fns + @date-fns/tz patterns from Phase 4 (TZDate gotchas locked)
@lib/slots.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Zod schema + Turnstile verify helper</name>
  <files>lib/bookings/schema.ts, lib/turnstile.ts</files>
  <action>
**`lib/bookings/schema.ts`:**

```typescript
import { z } from "zod";

// Phone: format-loose per CONTEXT decision #3.
// Allow digits + spaces + dashes + parens + leading +; min 7 chars after stripping
// non-digits to catch obviously-too-short numbers without rejecting international formats.
const PHONE_FORMAT_REGEX = /^[\d\s\-+()\.]+$/;
const phoneSchema = z
  .string()
  .min(1, "Phone is required.")
  .refine((v) => PHONE_FORMAT_REGEX.test(v), {
    message: "Phone may only contain digits, spaces, dashes, parens, plus, and dots.",
  })
  .refine((v) => v.replace(/\D/g, "").length >= 7, {
    message: "Phone must contain at least 7 digits.",
  });

export const bookingInputSchema = z.object({
  eventTypeId: z.string().uuid(),
  startAt: z.string().datetime(), // ISO UTC string with Z
  endAt: z.string().datetime(),
  bookerName: z.string().min(1).max(200),
  bookerEmail: z.string().email().max(254),
  bookerPhone: phoneSchema,
  bookerTimezone: z.string().min(1).max(64), // IANA — value comes from Intl.DateTimeFormat
  answers: z.record(z.string(), z.string()), // key = question label or id, value = answer
  turnstileToken: z.string().min(1, "Turnstile token is required."),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;
```

**`lib/turnstile.ts`:**

```typescript
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
 * IMPORTANT: Tokens are single-use (RESEARCH Pitfall 5). On any failure
 * (validation error, 409, etc.), the form must call turnstileRef.current?.reset()
 * before allowing re-submission.
 */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error("TURNSTILE_SECRET_KEY not set in environment.");
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
      // Timeout via AbortController if needed; Cloudflare typically responds <500ms.
    });
  } catch {
    // Network error — fail closed.
    return false;
  }

  if (!res.ok) return false;

  const data = (await res.json()) as CloudflareSiteverifyResponse;
  return data.success === true;
}
```

DO NOT:
- Do NOT validate IANA TZ strings against an exhaustive list. `Intl.DateTimeFormat()` produces canonical names; trusting the browser's value is acceptable for v1. Adding a list adds maintenance overhead and gates Phase 5 on no real benefit.
- Do NOT validate that startAt/endAt are in the future or that endAt > startAt at the schema layer. Slot generation already gates this; the booking POST will additionally cross-check that the slot is in the active /api/slots response. Schema-level future-date checks add brittleness against TZ edge cases.
- Do NOT use `libphonenumber-js` (CONTEXT decision #3 deferred this).
- Do NOT add `import "server-only"` to `lib/bookings/schema.ts` — the schema is also used by the form (RHF resolver) on the client. `bookingInputSchema` should remain isomorphic.
- Do NOT add `import "server-only"` to `lib/turnstile.ts` — wait, DO add it; secrets touched. (Inverted of the schema rule above; fix: `lib/turnstile.ts` IS server-only because it touches `TURNSTILE_SECRET_KEY`.)
  </action>
  <verify>
```bash
ls "lib/bookings/schema.ts" "lib/turnstile.ts"

# Schema exports
grep -q "export const bookingInputSchema" "lib/bookings/schema.ts" && echo "schema exported"
grep -q "turnstileToken" "lib/bookings/schema.ts" && echo "turnstileToken validated"
grep -q "phoneSchema\|PHONE_FORMAT_REGEX" "lib/bookings/schema.ts" && echo "phone validation present"

# Turnstile helper
grep -q "verifyTurnstile" "lib/turnstile.ts" && echo "verify exported"
grep -q "siteverify" "lib/turnstile.ts" && echo "Cloudflare endpoint used"
head -2 "lib/turnstile.ts" | grep -q 'import "server-only"' && echo "server-only ok"

# Schema is NOT server-only (must be client-importable for RHF resolver)
head -2 "lib/bookings/schema.ts" | grep -q 'import "server-only"' && echo "ERROR: schema must not be server-only" && exit 1
echo "schema is isomorphic ok"

npm run build
npm run lint
```
  </verify>
  <done>
Both files compile. `lib/bookings/schema.ts` exports `bookingInputSchema` + `BookingInput` type, validates phone format-loose with min 7 digits, requires non-empty turnstileToken. `lib/turnstile.ts` exports `verifyTurnstile(token, remoteIp?)`, fails closed on network errors, uses `TURNSTILE_SECRET_KEY` env. `npm run build` + `npm run lint` exit 0.

Commit: `feat(05-03): add booking Zod schema + Turnstile verify helper`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: .ics builder + email senders + fire-and-forget orchestrator</name>
  <files>lib/email/build-ics.ts, lib/email/send-booking-confirmation.ts, lib/email/send-owner-notification.ts, lib/email/send-booking-emails.ts</files>
  <action>
**`lib/email/build-ics.ts`:**

```typescript
import "server-only";
import ical, { ICalCalendarMethod } from "ical-generator";
import { tzlib_get_ical_block } from "timezones-ical-library";

export interface BuildIcsOptions {
  uid: string;          // booking.id (UUID) — stable; matches Phase 6 reschedule UPDATE
  summary: string;      // event_type.name
  description?: string; // event_type.description (free text); empty/null OK
  startAt: Date;        // UTC Date from DB timestamptz
  endAt: Date;
  timezone: string;     // IANA — account.timezone (event owner's TZ)
  organizerName: string;
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName: string;
}

/**
 * Build an RFC 5545 .ics buffer using ical-generator + timezones-ical-library.
 *
 * Critical correctness invariants (RESEARCH Pitfalls 2 + 3 + 4):
 *   - METHOD:REQUEST → Gmail/Outlook show inline "Add to Calendar" card
 *   - VTIMEZONE block via timezones-ical-library generator → no floating times
 *   - Stable UID == booking.id → Phase 6 reschedule can UPDATE the same event
 */
export function buildIcsBuffer(opts: BuildIcsOptions): Buffer {
  const cal = ical({ name: opts.summary });
  cal.method(ICalCalendarMethod.REQUEST);

  // VTIMEZONE block (generator returns array; first entry is the requested zone).
  cal.timezone({
    name: opts.timezone,
    generator: (tz) => tzlib_get_ical_block(tz)[0],
  });

  cal
    .createEvent({
      uid: opts.uid,
      summary: opts.summary,
      description: opts.description,
      start: opts.startAt,
      end: opts.endAt,
      timezone: opts.timezone,
      organizer: { name: opts.organizerName, email: opts.organizerEmail },
    })
    .createAttendee({
      email: opts.attendeeEmail,
      name: opts.attendeeName,
      rsvp: true,
    });

  return Buffer.from(cal.toString(), "utf-8");
}
```

**`lib/email/send-booking-confirmation.ts`:**

```typescript
import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { sendEmail } from "@/lib/email-sender";
import { buildIcsBuffer } from "@/lib/email/build-ics";

interface SendArgs {
  booking: {
    id: string;
    start_at: string; // ISO UTC
    end_at: string;
    booker_name: string;
    booker_email: string;
    booker_timezone: string; // IANA
  };
  eventType: { name: string; description: string | null; duration_minutes: number };
  account: { name: string; timezone: string; owner_email: string | null; slug: string };
  rawCancelToken: string;
  rawRescheduleToken: string;
  appUrl: string; // process.env.NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_VERCEL_URL fallback
}

export async function sendBookingConfirmation(args: SendArgs): Promise<void> {
  const { booking, eventType, account, rawCancelToken, rawRescheduleToken, appUrl } = args;

  const startTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const dateLine = format(startTz, "EEEE, MMMM d, yyyy");          // "Tuesday, June 16, 2026"
  const timeLine = format(startTz, "h:mm a (z)");                   // "10:00 AM (CDT)"
  const subjectDate = format(startTz, "MMM d, yyyy");

  const cancelUrl = `${appUrl}/cancel/${rawCancelToken}`;
  const rescheduleUrl = `${appUrl}/reschedule/${rawRescheduleToken}`;

  // Plain HTML — Phase 7 will templatize with branding. Keep table-based layout
  // for email-client compatibility.
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">You're booked.</h1>
      <p>Hi ${escapeHtml(booking.booker_name)},</p>
      <p>Your appointment with ${escapeHtml(account.name)} is confirmed.</p>
      <table style="border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 4px 16px 4px 0; color:#555;">What:</td><td>${escapeHtml(eventType.name)}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color:#555;">When:</td><td>${dateLine}<br/>${timeLine}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color:#555;">Duration:</td><td>${eventType.duration_minutes} minutes</td></tr>
      </table>
      <p>A calendar invite (.ics) is attached — open it to add to your calendar.</p>
      <p style="margin-top: 24px; font-size: 14px; color: #555;">
        Need to make a change?<br/>
        <a href="${rescheduleUrl}">Reschedule</a> &nbsp;·&nbsp; <a href="${cancelUrl}">Cancel</a>
      </p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 32px 0 16px;"/>
      <p style="font-size: 12px; color: #888;">${escapeHtml(account.name)}${account.owner_email ? " · " + escapeHtml(account.owner_email) : ""}</p>
    </div>`;

  // .ics requires owner_email. If null (shouldn't happen post Plan 05-01 seed but
  // handle defensively), fall back to a no-reply placeholder; Gmail still renders
  // the invite.
  const organizerEmail = account.owner_email ?? "noreply@nsi.tools";
  const icsBuffer = buildIcsBuffer({
    uid: booking.id,
    summary: eventType.name,
    description: eventType.description ?? undefined,
    startAt: new Date(booking.start_at),
    endAt: new Date(booking.end_at),
    timezone: account.timezone, // owner's TZ — .ics shows event in owner's local; client adapts
    organizerName: account.name,
    organizerEmail,
    attendeeEmail: booking.booker_email,
    attendeeName: booking.booker_name,
  });

  await sendEmail({
    from: { name: "Andrew @ NSI", email: process.env.RESEND_FROM_EMAIL! },
    to: booking.booker_email,
    subject: `Booking confirmed: ${eventType.name} on ${subjectDate}`,
    html,
    attachments: [
      {
        filename: "invite.ics",
        content: icsBuffer,
        contentType: "text/calendar; method=REQUEST",
      },
    ],
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

**`lib/email/send-owner-notification.ts`:**

```typescript
import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { sendEmail } from "@/lib/email-sender";

interface OwnerArgs {
  booking: {
    id: string;
    start_at: string;
    booker_name: string;
    booker_email: string;
    booker_phone: string | null;
    booker_timezone: string;
    answers: Record<string, string>;
  };
  eventType: { name: string };
  account: { name: string; timezone: string; owner_email: string | null };
}

export async function sendOwnerNotification(args: OwnerArgs): Promise<void> {
  const { booking, eventType, account } = args;
  if (!account.owner_email) {
    console.warn("[owner-notification] account.owner_email is null — skipping owner email");
    return;
  }

  const startOwnerTz = new TZDate(new Date(booking.start_at), account.timezone);
  const dateLine = format(startOwnerTz, "EEEE, MMMM d, yyyy");
  const timeLine = format(startOwnerTz, "h:mm a (z)");
  const subjectDate = format(startOwnerTz, "MMM d, yyyy");

  const answersHtml = Object.entries(booking.answers)
    .map(
      ([k, v]) =>
        `<tr><td style="padding: 4px 16px 4px 0; color:#555;">${escapeHtml(k)}:</td><td>${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">New booking</h1>
      <table style="border-collapse: collapse;">
        <tr><td style="padding: 4px 16px 4px 0; color:#555;">Event:</td><td>${escapeHtml(eventType.name)}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color:#555;">When:</td><td>${dateLine}<br/>${timeLine}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color:#555;">Booker:</td><td>${escapeHtml(booking.booker_name)}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color:#555;">Email:</td><td><a href="mailto:${escapeHtml(booking.booker_email)}">${escapeHtml(booking.booker_email)}</a></td></tr>
        ${booking.booker_phone ? `<tr><td style="padding: 4px 16px 4px 0; color:#555;">Phone:</td><td>${escapeHtml(booking.booker_phone)}</td></tr>` : ""}
        <tr><td style="padding: 4px 16px 4px 0; color:#555;">Booker TZ:</td><td>${escapeHtml(booking.booker_timezone)}</td></tr>
      </table>
      ${answersHtml ? `<h2 style="font-size: 16px; margin-top: 24px;">Answers</h2><table style="border-collapse: collapse;">${answersHtml}</table>` : ""}
    </div>`;

  await sendEmail({
    from: { name: "NSI Booking", email: process.env.RESEND_FROM_EMAIL! },
    to: account.owner_email,
    replyTo: booking.booker_email, // owner can hit Reply directly to email booker
    subject: `New booking: ${booking.booker_name} — ${eventType.name} on ${subjectDate}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

**`lib/email/send-booking-emails.ts`:**

```typescript
import "server-only";
import {
  sendBookingConfirmation,
} from "@/lib/email/send-booking-confirmation";
import {
  sendOwnerNotification,
} from "@/lib/email/send-owner-notification";

type Args = Parameters<typeof sendBookingConfirmation>[0] & {
  ownerArgs: Parameters<typeof sendOwnerNotification>[0];
};

/**
 * Fire-and-forget orchestrator. Called from /api/bookings AFTER the booking
 * row is committed. Errors are logged but never thrown — the response to the
 * booker has already returned 201 by the time these emails fly. Email failures
 * MUST NOT roll back the booking.
 *
 * Caller pattern: `void sendBookingEmails({...args, ownerArgs});`
 */
export async function sendBookingEmails(args: Args): Promise<void> {
  const { ownerArgs, ...confirmationArgs } = args;
  const tasks: Array<Promise<void>> = [
    sendBookingConfirmation(confirmationArgs).catch((err) => {
      console.error("[booking-emails] confirmation failed:", err);
    }),
    sendOwnerNotification(ownerArgs).catch((err) => {
      console.error("[booking-emails] owner notification failed:", err);
    }),
  ];
  await Promise.allSettled(tasks);
}
```

If the vendored `sendEmail` shape doesn't accept `from` / `replyTo` exactly as written above, adapt to whatever Plan 05-02's `lib/email-sender/types.ts` declares (look at `EmailInput` interface). The key fields needed are `to`, `subject`, `html`, `attachments`, `replyTo` (or `reply_to`), and `from`. If `from` is configured globally via env in the vendored module, omit per-call `from` overrides and rely on `RESEND_FROM_EMAIL`.

DO NOT:
- Do NOT `await sendBookingEmails()` from the Route Handler. CONTEXT + RESEARCH Pitfall — fire-and-forget. Caller uses `void sendBookingEmails(...)`.
- Do NOT generate a fresh UUID for `.ics` UID. Use `booking.id`. Phase 6 reschedule depends on stable UID to UPDATE the calendar event in attendees' clients.
- Do NOT use `application/octet-stream` for the .ics content type — Pitfall 4 — must be `text/calendar; method=REQUEST`.
- Do NOT use `string`-content for the attachment if `Buffer` works. Resend treats string as base64 unless explicit; Buffer is safer.
- Do NOT include the cancel/reschedule URLs as PLAINTEXT in addition to HTML anchors. Some email clients double-render; one HTML anchor each is enough.
- Do NOT inject branded logos / per-account colors. Phase 7 owns branding — keep emails plain HTML for now.
- Do NOT format times in the OWNER email using booker_timezone. Owner email shows owner-tz times (CONTEXT implies owner-perspective). The .ics in the booker email is owner-tz; calendar clients adapt to attendee local automatically.
- Do NOT attach the .ics to the OWNER notification email. Only the booker confirmation gets the invite (RFC 5545 ATTENDEE record is the booker, not the owner). Owner adds it via their own Calendly-style account if needed.
  </action>
  <verify>
```bash
ls "lib/email/build-ics.ts" "lib/email/send-booking-confirmation.ts" "lib/email/send-owner-notification.ts" "lib/email/send-booking-emails.ts"

# server-only on every email module
for f in lib/email/build-ics.ts lib/email/send-booking-confirmation.ts lib/email/send-owner-notification.ts lib/email/send-booking-emails.ts; do
  head -2 "$f" | grep -q 'import "server-only"' || { echo "MISSING server-only in $f"; exit 1; }
done
echo "all email modules server-only ok"

# Stable UID
grep -q "uid: opts.uid\|uid: booking.id" "lib/email/build-ics.ts" && echo "stable UID ok"

# METHOD:REQUEST + VTIMEZONE
grep -q "ICalCalendarMethod.REQUEST" "lib/email/build-ics.ts" && echo "method REQUEST ok"
grep -q "tzlib_get_ical_block" "lib/email/build-ics.ts" && echo "VTIMEZONE generator ok"

# Content type
grep -q "text/calendar; method=REQUEST" "lib/email/send-booking-confirmation.ts" && echo "ics content-type ok"

# Reply-to on owner email
grep -q "replyTo\|reply_to" "lib/email/send-owner-notification.ts" && echo "reply-to ok"

# Fire-and-forget pattern
grep -q "Promise.allSettled\|\\.catch" "lib/email/send-booking-emails.ts" && echo "errors swallowed ok"

# Cancel + reschedule URLs follow APP_URL convention
grep -q "/cancel/" "lib/email/send-booking-confirmation.ts" && grep -q "/reschedule/" "lib/email/send-booking-confirmation.ts" && echo "URLs ok"

npm run build
npm run lint
```
  </verify>
  <done>
Four files created. `.ics` uses stable UID = `booking.id`, METHOD:REQUEST, VTIMEZONE block from `timezones-ical-library`. Booker email subject/from/cancel+reschedule URLs match CONTEXT decisions #8 + #10. Owner email uses reply-to=booker (decision #9). Orchestrator catches per-email errors and never throws. `npm run build` + `npm run lint` exit 0.

Commit: `feat(05-03): add .ics builder + booker/owner email senders`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# All 6 files in place
ls "lib/bookings/schema.ts" "lib/turnstile.ts" "lib/email/build-ics.ts" "lib/email/send-booking-confirmation.ts" "lib/email/send-owner-notification.ts" "lib/email/send-booking-emails.ts"

# Build + lint clean
npm run build
npm run lint

# Spot-check the .ics builder produces a buffer with required RFC 5545 markers
node --input-type=module -e "
import('./lib/email/build-ics.ts').then(m => {
  const buf = m.buildIcsBuffer({
    uid: 'test-uid',
    summary: 'Test Event',
    startAt: new Date('2026-06-15T14:00:00Z'),
    endAt: new Date('2026-06-15T14:30:00Z'),
    timezone: 'America/Chicago',
    organizerName: 'NSI',
    organizerEmail: 'noreply@nsi.tools',
    attendeeEmail: 'test@example.com',
    attendeeName: 'Test User',
  });
  const s = buf.toString();
  console.log(s.includes('METHOD:REQUEST') ? 'METHOD ok' : 'MISSING METHOD');
  console.log(s.includes('BEGIN:VTIMEZONE') ? 'VTIMEZONE ok' : 'MISSING VTIMEZONE');
  console.log(s.includes('UID:test-uid') ? 'UID ok' : 'MISSING UID');
}).catch(e => { console.error(e); process.exit(1); });
"
# Note: if running .ts directly fails, transpile first or skip — Wave 4 integration test will catch this
```
</verification>

<success_criteria>
- [ ] `lib/bookings/schema.ts` exports `bookingInputSchema` + `BookingInput`; phone format-loose; turnstileToken non-empty; isomorphic (no `import "server-only"`)
- [ ] `lib/turnstile.ts` exports `verifyTurnstile(token, remoteIp?)`; throws if env missing; fails closed on network errors; `import "server-only"` on line 1
- [ ] `lib/email/build-ics.ts` uses ical-generator + timezones-ical-library; METHOD:REQUEST; VTIMEZONE generator; UID = booking.id (caller passes); `import "server-only"`
- [ ] `lib/email/send-booking-confirmation.ts` sends via `@/lib/email-sender`; subject = `Booking confirmed: [event] on [date]`; from-name = "Andrew @ NSI"; HTML body with cancel + reschedule URLs; `.ics` attachment with content-type `text/calendar; method=REQUEST`; `import "server-only"`
- [ ] `lib/email/send-owner-notification.ts` sends to `account.owner_email`; subject = `New booking: [name] — [event] on [date]`; reply-to = booker_email; body lists custom-question answers; gracefully skips when `owner_email` null; `import "server-only"`
- [ ] `lib/email/send-booking-emails.ts` orchestrator never throws; uses `Promise.allSettled`; logs errors to console; `import "server-only"`
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/05-public-booking-flow/05-03-SUMMARY.md` documenting:
- Final shape of `bookingInputSchema` (each field + validators)
- Phone validation regex chosen + min-digits rule
- The `EmailInput`/`EmailAttachment` shape from the vendored `lib/email-sender/types.ts` — how the email senders adapted to it (especially `from` / `replyTo` keys)
- The .ics output snippet (first 30 lines) for record
- Cancel + reschedule URL format LOCKED here (Phase 6 routes consume): `${APP_URL}/cancel/${rawToken}` + `${APP_URL}/reschedule/${rawToken}`
- The graceful-skip behavior when `owner_email` is null
- Locked decision: emails are fire-and-forget; booking succeeds even if email send fails
</output>
