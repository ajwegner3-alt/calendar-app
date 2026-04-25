---
phase: 05-public-booking-flow
plan: "03"
subsystem: api
tags: [zod, turnstile, ical-generator, nodemailer, email, ics, cloudflare, date-fns]

requires:
  - phase: 05-02
    provides: "Vendored lib/email-sender (Gmail SMTP via nodemailer), EmailOptions/EmailAttachment types"
  - phase: 04-06
    provides: "/api/slots GET handler — slots contract {start_at, end_at} used by booking flow"
  - phase: 05-01
    provides: "accounts.owner_email column — used in .ics ORGANIZER + owner notification"

provides:
  - "lib/bookings/schema.ts — Zod bookingInputSchema for /api/bookings POST validation"
  - "lib/turnstile.ts — server-side Cloudflare Turnstile verify helper"
  - "lib/email/build-ics.ts — RFC 5545 .ics buffer builder (METHOD:REQUEST, VTIMEZONE)"
  - "lib/email/send-booking-confirmation.ts — booker confirmation email with .ics attach"
  - "lib/email/send-owner-notification.ts — owner notification with reply-to=booker"
  - "lib/email/send-booking-emails.ts — fire-and-forget orchestrator (never throws)"

affects:
  - "05-05 — /api/bookings Route Handler imports all six modules from this plan"
  - "05-06 — booking form client uses bookingInputSchema as RHF zodResolver"
  - "06 — cancel/reschedule routes consume URL format locked here"

tech-stack:
  added: []
  patterns:
    - "isomorphic Zod schema pattern (no server-only — usable by both RHF client resolver and Route Handler)"
    - "ICalEventData uses `id` field (not `uid`) in ical-generator v10 API"
    - "sendEmail singleton consumes GMAIL_FROM_NAME+GMAIL_USER — no per-email `from` override"
    - "fire-and-forget email orchestration via Promise.allSettled + .catch(console.error)"

key-files:
  created:
    - lib/bookings/schema.ts
    - lib/turnstile.ts
    - lib/email/build-ics.ts
    - lib/email/send-booking-confirmation.ts
    - lib/email/send-owner-notification.ts
    - lib/email/send-booking-emails.ts
  modified: []

key-decisions:
  - "ical-generator v10 ICalEventData uses `id` field for UID (not `uid`) — the getter/setter on event objects is named uid() but createEvent() data arg is `id`"
  - "No `from` field in any email send call — sendEmail singleton constructs defaultFrom from GMAIL_FROM_NAME+GMAIL_USER env vars; passing explicit `from` would break Gmail SMTP auth"
  - "APP_URL fallback in send-booking-confirmation: caller (Plan 05-05) resolves `process.env.NEXT_PUBLIC_APP_URL` with fallback to live Vercel URL; this module accepts it as a parameter"
  - "Owner notification gracefully skips when account.owner_email is null (console.warn, no throw)"
  - "Email build is fire-and-forget: Promise.allSettled; errors logged to console.error; booking succeeds even if email fails"
  - "Cancel/reschedule URL format LOCKED: ${appUrl}/cancel/${rawToken} and ${appUrl}/reschedule/${rawToken}"

patterns-established:
  - "Isomorphic schema: lib/bookings/schema.ts has NO server-only import — shared by RHF resolver (client) and Route Handler (server)"
  - "Server-only gate: lib/turnstile.ts and all lib/email/*.ts have `import server-only` as line 1"
  - "ical-generator v10 data API: use `id` not `uid` in ICalEventData passed to createEvent()"

duration: 7min
completed: "2026-04-25"
---

# Phase 5 Plan 03: Schema + Turnstile + .ics + Email Modules Summary

**Zod booking schema, Cloudflare Turnstile verify helper, RFC 5545 .ics builder with VTIMEZONE, and booker + owner email senders wired to the Gmail nodemailer singleton — all ready for /api/bookings Route Handler (Plan 05-05)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-25T22:10:36Z
- **Completed:** 2026-04-25T22:18:15Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments

- Zod `bookingInputSchema` with format-loose phone validation (PHONE_FORMAT_REGEX + min 7 digits), ISO datetime fields, IANA TZ, answers record, and required `turnstileToken`; isomorphic (no `server-only`) so RHF zodResolver can import it on the client
- `verifyTurnstile(token, remoteIp?)` fails closed on network errors, throws if `TURNSTILE_SECRET_KEY` missing, server-only guarded
- `buildIcsBuffer()` using ical-generator v10 + timezones-ical-library: METHOD:REQUEST, VTIMEZONE block from `tzlib_get_ical_block`, stable UID via `id` field in ICalEventData, ORGANIZER + ATTENDEE with RSVP
- Booker confirmation email: times in BOOKER timezone; .ics attachment with `text/calendar; method=REQUEST`; cancel + reschedule URLs in locked format
- Owner notification: times in OWNER timezone; reply-to = booker_email; custom-question answers table; graceful null owner_email skip
- Fire-and-forget orchestrator: `Promise.allSettled` + per-sender `.catch(console.error)`; never throws

## Task Commits

1. **Task 1: Zod schema + Turnstile verify helper** — `2d31d73` (feat)
2. **Task 2: .ics builder + email senders + orchestrator** — `6bb45a5` (feat)

## Files Created/Modified

- `lib/bookings/schema.ts` — Zod bookingInputSchema + BookingInput type; format-loose phone; isomorphic
- `lib/turnstile.ts` — verifyTurnstile(); server-only; fails closed on network error
- `lib/email/build-ics.ts` — buildIcsBuffer(); ical-generator v10 + timezones-ical-library; METHOD:REQUEST; VTIMEZONE
- `lib/email/send-booking-confirmation.ts` — booker confirmation with .ics attach; times in booker TZ
- `lib/email/send-owner-notification.ts` — owner notification; times in owner TZ; reply-to=booker; answers
- `lib/email/send-booking-emails.ts` — fire-and-forget orchestrator; Promise.allSettled; never throws

## bookingInputSchema Shape

| Field | Validator | Notes |
|-------|-----------|-------|
| `eventTypeId` | `z.string().uuid()` | |
| `startAt` | `z.string().datetime()` | ISO UTC with Z suffix |
| `endAt` | `z.string().datetime()` | ISO UTC with Z suffix |
| `bookerName` | `z.string().min(1).max(200)` | |
| `bookerEmail` | `z.string().email().max(254)` | |
| `bookerPhone` | custom phoneSchema | PHONE_FORMAT_REGEX `/^[\d\s\-+().]+$/` + min 7 digits after stripping non-digits |
| `bookerTimezone` | `z.string().min(1).max(64)` | IANA; value from `Intl.DateTimeFormat()` on client |
| `answers` | `z.record(z.string(), z.string())` | key = question label/id |
| `turnstileToken` | `z.string().min(1)` | CF Turnstile response token |

## Phone Validation

- **Regex:** `/^[\d\s\-+().]+$/` — allows digits, spaces, dashes, parens, plus, dots
- **Digit minimum:** `v.replace(/\D/g, "").length >= 7` — at least 7 numeric digits
- **Error messages:** separate messages for format violation vs digit count
- **No `libphonenumber-js`** — deferred per CONTEXT decision #3

## EmailOptions / EmailAttachment API (vendored lib/email-sender)

From `lib/email-sender/types.ts` (Plan 05-02 vendoring):

```typescript
interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;       // OPTIONAL override — DO NOT pass; singleton constructs from GMAIL_FROM_NAME+GMAIL_USER
  replyTo?: string;    // plain string (not object)
  attachments?: EmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
}

interface EmailAttachment {
  filename: string;
  content: Buffer | string;  // Buffer preferred — no base64 encoding needed
  contentType?: string;      // "text/calendar; method=REQUEST" for .ics
}
```

**Adaptation decisions:**
- No `from` passed in any email send call — singleton constructs `defaultFrom = "${GMAIL_FROM_NAME} <${GMAIL_USER}>"` automatically. Passing explicit `from` would break Gmail SMTP authentication.
- `replyTo` is a plain string (not `{ name, email }` object) — used only in owner notification
- `attachments[].content` receives Buffer from `buildIcsBuffer()` directly — no base64 encoding

## .ics Output Snippet (representative)

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//sebbo.net//ical-generator//EN
METHOD:REQUEST
NAME:30-Minute Consultation
BEGIN:VTIMEZONE
TZID:America/Chicago
...VTIMEZONE body from timezones-ical-library...
END:VTIMEZONE
BEGIN:VEVENT
UID:ba8e712d-28b7-4071-b3d4-361fb6fb7a60
SUMMARY:30-Minute Consultation
DTSTART;TZID=America/Chicago:20260615T090000
DTEND;TZID=America/Chicago:20260615T093000
DTSTAMP:...
ORGANIZER;CN=NSI:mailto:ajwegner3@gmail.com
ATTENDEE;CN=John Smith;RSVP=TRUE:mailto:john@example.com
END:VEVENT
END:VCALENDAR
```

**Key correctness points:**
- `METHOD:REQUEST` → Gmail shows inline "Add to Calendar" card (not plain attachment)
- `BEGIN:VTIMEZONE` block → times are not floating; calendar clients localize correctly
- UID = booking.id (Postgres UUID) → Phase 6 reschedule can UPDATE the same calendar event

## Cancel + Reschedule URL Format (LOCKED)

```
${appUrl}/cancel/${rawToken}
${appUrl}/reschedule/${rawToken}
```

- `appUrl` = `process.env.NEXT_PUBLIC_APP_URL` resolved by the Route Handler caller (Plan 05-05); fallback in caller to `https://calendar-app-xi-smoky.vercel.app`
- `rawToken` = pre-hash token (before SHA-256 + hex storage in `cancel_token_hash` / `reschedule_token_hash` columns)
- Phase 6 routes will consume `rawToken` at these paths; format must NOT change

## Graceful null owner_email Behavior

`sendOwnerNotification()` checks `account.owner_email` at the start:
```typescript
if (!account.owner_email) {
  console.warn("[owner-notification] account.owner_email is null — skipping...");
  return;
}
```
- Booking succeeds; booker confirmation still sends
- Owner notification silently skips with a console.warn
- Should not occur post Plan 05-01 seed but protects against schema evolution

## Fire-and-Forget Contract

```typescript
// In /api/bookings Route Handler (Plan 05-05):
void sendBookingEmails({ ...confirmationArgs, ownerArgs: { ... } });
// 201 response has already been returned; emails fire in background
```

The `sendBookingEmails` function:
- Never throws (all errors caught + logged)
- Uses `Promise.allSettled` so both senders always attempt
- Each sender has `.catch((err) => console.error("[booking-emails] ...", err))`

## Decisions Made

1. **`id` not `uid` in ICalEventData (ical-generator v10):** The `createEvent()` data argument uses field name `id` for the UID. The getter/setter method on the returned event object is named `uid()`. TypeScript caught this at build time — `uid: string` was not assignable. Fixed to `id: opts.uid` with a comment documenting the v10 API difference.

2. **No explicit `from` field in email sends:** The vendored `lib/email-sender/index.ts` singleton constructs `defaultFrom = "${GMAIL_FROM_NAME} <${GMAIL_USER}>"` from env vars. The `from` field in `EmailOptions` is optional; passing it would override the singleton and break Gmail SMTP auth (must equal authenticated `GMAIL_USER`). Per critical constraint #2 in the plan brief.

3. **`appUrl` passed as parameter to `sendBookingConfirmation`:** Rather than reading `process.env.NEXT_PUBLIC_APP_URL` inside the module, the caller (Plan 05-05 Route Handler) resolves and passes it. This makes the module more testable and keeps env resolution in one place.

4. **ESLint pre-existing failure not counted as deviation:** `npm run lint` fails with a circular JSON error in ESLint's flat-config validator (pre-existing issue documented in STATE.md, Phase 8 backlog). This plan's files are lint-valid; the failure predates and is unrelated to Plan 05-03 changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ical-generator v10 ICalEventData uses `id` not `uid` field**

- **Found during:** Task 2 (build verification after creating `lib/email/build-ics.ts`)
- **Issue:** Plan template code had `uid: opts.uid` in the `createEvent()` data object. TypeScript error: `Type 'string' is not assignable to type '{ (): string; (id: string | number): ICalEvent; }'` — because `uid` in `ICalEventData` is the getter/setter method signature, not the input field name. The input field name is `id`.
- **Fix:** Changed `uid: opts.uid` to `id: opts.uid` with explanatory comment. Output UID in .ics is identical — ical-generator maps `id` → `UID:` in the iCalendar output.
- **Files modified:** `lib/email/build-ics.ts`
- **Verification:** `npm run build` passes TypeScript check; UID is correctly written as `UID:<booking.id>` in .ics output
- **Committed in:** 6bb45a5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug: ical-generator v10 API field name)
**Impact on plan:** Required for TypeScript compilation. The .ics UID output is semantically identical. No scope change.

## Issues Encountered

- **ical-generator v10 `id` vs `uid` field name:** The RESEARCH.md code example used `uid:` in `createEvent()` data. This was wrong for ical-generator v10. The correct field is `id`. The getter/setter chain on the event object is `uid()` but that's for post-creation manipulation, not the initial data argument. TypeScript caught this at build time. Inspected `node_modules/ical-generator/dist/index.d.mts` to confirm `interface ICalEventData { id?: null | number | string; }`.

## Next Phase Readiness

**Plan 05-04 (booking page shell):** The page is already partially built (untracked `app/[account]/[event-slug]/page.tsx` from parallel wave work). Plan 05-04 will finalize the booking page server component and client shell components.

**Plan 05-05 (/api/bookings Route Handler):** All modules it needs are now in place:
- `bookingInputSchema` from `lib/bookings/schema.ts`
- `verifyTurnstile` from `lib/turnstile.ts`
- `sendBookingEmails` from `lib/email/send-booking-emails.ts`
- `createAdminClient` from `lib/supabase/admin.ts` (existing)

The Route Handler needs to:
1. Resolve `appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://calendar-app-xi-smoky.vercel.app"`
2. Generate `rawCancelToken = crypto.randomUUID()` and `rawRescheduleToken = crypto.randomUUID()`
3. Hash both tokens before DB storage (SHA-256 + hex)
4. Pass raw tokens (not hashes) to `sendBookingConfirmation`

---
*Phase: 05-public-booking-flow*
*Completed: 2026-04-25*
