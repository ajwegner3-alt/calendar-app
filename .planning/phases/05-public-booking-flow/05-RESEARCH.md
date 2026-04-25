# Phase 5: Public Booking Flow + Confirmation Email + .ics — Research

**Researched:** 2026-04-25
**Domain:** Public Next.js booking page, iCalendar generation, transactional email with attachments, Cloudflare Turnstile
**Confidence:** HIGH (all critical claims verified via official docs, GitHub source, or direct file inspection)

---

## Summary

Phase 5 spans four technical domains: (1) a public booking page, (2) a Route Handler for booking submission, (3) iCalendar (.ics) generation with proper VTIMEZONE support, and (4) transactional email via the existing `@nsi/email-sender` tool. Each domain has a clear established pattern; no hand-rolling is needed.

The single most important architectural decision this research surfaces is that **the booking POST must be a Route Handler at `/api/bookings`, not a Server Action**. Server Actions in Next.js 16 cannot return custom HTTP status codes — they always return 200 on success and 500 on error (confirmed via GitHub Discussions #49302, December 2025). A 409 conflict response for the double-book race condition is only achievable through a Route Handler.

For `.ics` generation, `ical-generator` v10 (current: v10.2.0, April 2026) paired with `timezones-ical-library` is the standard stack. It supports `METHOD:REQUEST`, `ORGANIZER`, `ATTENDEE`, and real VTIMEZONE blocks. The `@nsi/email-sender` package was found and inspected: it accepts attachments as `{ filename: string; content: Buffer | string; contentType?: string }` objects.

The public booking page reads event type data and slots via `createAdminClient()` (service-role) because RLS has no anon-select policy — this is already the established project pattern (identical to `/api/slots`). The Turnstile token is verified server-side inside the `/api/bookings` Route Handler before any DB write.

**Primary recommendation:** Route Handler at `/api/bookings` (POST). Public Server Component at `/[account]/[event-slug]` using `createAdminClient()` for initial data load. `ical-generator` + `timezones-ical-library` for .ics. `@nsi/email-sender` for email with the attachment API documented below.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ical-generator` | ^10.2.0 | Generate RFC 5545 iCalendar strings | Fully typed TS, supports METHOD:REQUEST, ORGANIZER, ATTENDEE, VTIMEZONE via generator callback |
| `timezones-ical-library` | latest | VTIMEZONE block generator for ical-generator | Provides `tzlib_get_ical_block(tz)` — the exact API ical-generator's `timezone.generator` expects |
| `@marsidev/react-turnstile` | ^1.5.0 (March 2026) | Cloudflare Turnstile React widget | SSR-ready, ref API for token retrieval, `"use client"` component |

### Already Installed (no new installs needed)
| Library | Version | Purpose |
|---------|---------|---------|
| `react-day-picker` | ^9.14.0 | Date picker for slot selection (already in package.json) |
| `react-hook-form` | ^7.72.1 | Booking form (established Phase 3 pattern) |
| `zod` | ^4.3.6 | Schema validation for booking input |
| `@supabase/ssr` | ^0.10.2 | Server client creation |
| `date-fns` + `@date-fns/tz` | ^4.1.0 + ^1.4.1 | Slot time formatting in booker TZ |
| `sonner` | ^2.0.7 | Toast notifications (already mounted in root layout) |

### Not Installed — Must Add
| Library | Install Command | Needed For |
|---------|----------------|-----------|
| `ical-generator` | `npm install ical-generator` | .ics generation |
| `timezones-ical-library` | `npm install timezones-ical-library` | VTIMEZONE blocks |
| `@marsidev/react-turnstile` | `npm install @marsidev/react-turnstile` | Turnstile widget |

### @nsi/email-sender Status
**NOT in `node_modules/@nsi/`** — not yet linked/installed in calendar-app. The source package lives at:
```
../email-sender/   (sibling of calendar-app directory)
```
Must be installed via one of:
- `npm install ../email-sender` (local relative install — adds `"@nsi/email-sender": "file:../email-sender"` to package.json)
- Or copy/inline the relevant send function and types directly into the project under `lib/email/`

The attachment API shape is documented in the Code Examples section below.

### Installation (new dependencies only)
```bash
npm install ical-generator timezones-ical-library @marsidev/react-turnstile
npm install ../email-sender
```

---

## Architecture Patterns

### Recommended Project Structure
```
app/
├── [account]/
│   └── [event-slug]/
│       ├── page.tsx             # Server Component — loads event type, no auth
│       ├── _components/
│       │   ├── booking-shell.tsx       # "use client" — manages step state
│       │   ├── slot-picker.tsx         # "use client" — calendar + time list
│       │   ├── booking-form.tsx        # "use client" — RHF form + Turnstile
│       │   └── confirmation-screen.tsx # "use client" — success state
│       └── _lib/
│           └── types.ts         # Shared public-page types
├── api/
│   └── bookings/
│       └── route.ts             # POST /api/bookings — Route Handler

lib/
├── email/
│   ├── build-ics.ts             # ical-generator wrapper → returns Buffer
│   ├── send-booking-confirmation.ts   # booker email
│   └── send-owner-notification.ts    # owner email
└── supabase/
    └── admin.ts                 # (existing) — used by /api/bookings
```

### Pattern 1: Public Route — No Auth, Service-Role Read

The `/[account]/[event-slug]` page is outside the `/app` proxy gate. The proxy gate only intercepts `pathname.startsWith("/app")` (see `proxy.ts`). No middleware changes are needed — the route is already publicly reachable.

For reading event type data without an auth session, use `createAdminClient()` directly in the Server Component. This is the **identical pattern already used by `/api/slots`** (search `app/api/slots/route.ts` lines 84-105 for the reference implementation).

```typescript
// Source: established pattern from app/api/slots/route.ts
// app/[account]/[event-slug]/page.tsx
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ account: string; "event-slug": string }>;
}) {
  const { account, "event-slug": eventSlug } = await params;
  const supabase = createAdminClient();

  // Resolve account by slug
  const { data: accountRow } = await supabase
    .from("accounts")
    .select("id, name, timezone")
    .eq("slug", account)
    .maybeSingle();

  if (!accountRow) notFound();

  // Load event type (active only)
  const { data: eventType } = await supabase
    .from("event_types")
    .select("id, name, description, duration_minutes, custom_questions")
    .eq("account_id", accountRow.id)
    .eq("slug", eventSlug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!eventType) notFound();

  return <BookingShell accountRow={accountRow} eventType={eventType} />;
}
```

**Why service-role, not anon:** The RLS migration (`20260419120001_rls_policies.sql`, line 61) explicitly states: "CRITICAL: anon role has NO policies on these tables, so RLS fully blocks anon." An anon client would return 0 rows silently.

### Pattern 2: Route Handler for Booking POST

Use a Route Handler at `app/api/bookings/route.ts`. Server Actions cannot return 409 status codes (Next.js architectural limitation, confirmed December 2025). The Route Handler pattern mirrors the existing `/api/slots/route.ts`.

Flow:
1. Parse + validate request body with Zod
2. Verify Turnstile token against Cloudflare siteverify
3. Look up account + event type with `createAdminClient()`
4. Insert booking row; catch Postgres `23505` unique_violation → return 409
5. Fire emails asynchronously (do NOT await — keeps response fast)
6. Return 201 with booking confirmation data

```typescript
// Source: Route Handler pattern, mirrors app/api/slots/route.ts
// app/api/bookings/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookingInputSchema } from "@/lib/bookings/schema";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendBookingEmails } from "@/lib/email/send-booking-emails";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers: NO_STORE });
  }

  const parsed = bookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400, headers: NO_STORE }
    );
  }

  // Verify Turnstile before touching DB
  const turnstileOk = await verifyTurnstile(parsed.data.turnstileToken);
  if (!turnstileOk) {
    return NextResponse.json({ error: "Bot check failed. Please try again." }, { status: 403, headers: NO_STORE });
  }

  const supabase = createAdminClient();

  // Insert booking
  const { data: booking, error: insertError } = await supabase
    .from("bookings")
    .insert({ ...bookingRow })
    .select("id, start_at, end_at")
    .single();

  if (insertError) {
    // 23505 = unique_violation on bookings_no_double_book index
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "This slot was just booked. Please choose another time." },
        { status: 409, headers: NO_STORE }
      );
    }
    return NextResponse.json({ error: "Booking failed." }, { status: 500, headers: NO_STORE });
  }

  // Fire emails — do NOT await; response returns immediately
  void sendBookingEmails({ booking, eventType, accountRow, answers: parsed.data.answers });

  return NextResponse.json({ bookingId: booking.id }, { status: 201, headers: NO_STORE });
}
```

### Pattern 3: Turnstile Verification Helper

```typescript
// Source: Cloudflare official docs https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// lib/turnstile.ts
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY not set");

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });

  const data = await res.json() as { success: boolean };
  return data.success === true;
}
```

### Pattern 4: .ics Generation with VTIMEZONE

```typescript
// Source: ical-generator v10 README + timezones-ical-library README
// lib/email/build-ics.ts
import ical, { ICalCalendarMethod } from "ical-generator";
import { tzlib_get_ical_block } from "timezones-ical-library";

interface BuildIcsOptions {
  uid: string;           // stable — use booking.id (uuid)
  summary: string;       // event type name
  description?: string;
  startAt: Date;         // UTC Date from DB timestamptz
  endAt: Date;
  timezone: string;      // IANA — use account.timezone (event owner's TZ)
  organizerName: string;
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName: string;
}

export function buildIcsBuffer(opts: BuildIcsOptions): Buffer {
  const cal = ical({ name: opts.summary });
  cal.method(ICalCalendarMethod.REQUEST);

  // Attach VTIMEZONE block — required for Gmail to interpret times correctly
  cal.timezone({
    name: opts.timezone,
    generator: (tz) => tzlib_get_ical_block(tz)[0],
  });

  cal.createEvent({
    uid: opts.uid,
    summary: opts.summary,
    description: opts.description,
    start: opts.startAt,
    end: opts.endAt,
    timezone: opts.timezone,
    organizer: { name: opts.organizerName, email: opts.organizerEmail },
  }).createAttendee({
    email: opts.attendeeEmail,
    name: opts.attendeeName,
    rsvp: true,
  });

  return Buffer.from(cal.toString(), "utf-8");
}
```

### Pattern 5: @nsi/email-sender Attachment Shape

The `@nsi/email-sender` package (inspected at `../email-sender/src/types.ts` and `providers/resend.ts`) accepts attachments as:

```typescript
// Source: ../email-sender/src/types.ts (direct file inspection)
interface EmailAttachment {
  filename: string;           // "invite.ics"
  content: Buffer | string;   // Buffer preferred; string treated as base64
  contentType?: string;       // "text/calendar; method=REQUEST"
}
```

The Resend provider maps this to `{ filename, content: Buffer, contentType }`. Pass the `Buffer` from `buildIcsBuffer()` directly — no base64 encoding needed.

```typescript
// Source: ../email-sender/src/index.ts (direct file inspection)
// Usage pattern for booking confirmation with .ics attachment:
import { sendEmail } from "@nsi/email-sender";
// OR if not npm-linked:
import { sendEmail } from "@/lib/email/sender"; // copy of the sendEmail wrapper

const result = await sendEmail({
  to: bookerEmail,
  subject: `Confirmed: ${eventTypeName}`,
  html: confirmationHtml,
  attachments: [{
    filename: "invite.ics",
    content: icsBuffer,           // Buffer from buildIcsBuffer()
    contentType: "text/calendar; method=REQUEST",
  }],
});
```

The package auto-detects the provider from `process.env.EMAIL_PROVIDER` (default: `"resend"`). Required env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

### Pattern 6: Turnstile Client Component

```typescript
// Source: @marsidev/react-turnstile v1.5.0 docs
// "use client"
import { useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export function BookingForm({ onSubmit }: BookingFormProps) {
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleSubmit = async (data: BookingFormValues) => {
    const token = turnstileRef.current?.getResponse();
    if (!token) {
      toast.error("Please complete the bot check.");
      return;
    }
    // Include token in POST body to /api/bookings
    await submitBooking({ ...data, turnstileToken: token });
  };

  return (
    <form onSubmit={rhfHandleSubmit(handleSubmit)}>
      {/* ... form fields ... */}
      <Turnstile
        ref={turnstileRef}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
      />
      <Button type="submit">Book</Button>
    </form>
  );
}
```

**Dev/test keys:**
- Site key (always passes challenge): `1x00000000000000000000AA`
- Secret key (always passes verify): `1x0000000000000000000000000000000AA`
- Secret key (always fails verify): `2x0000000000000000000000000000000AA`

### Pattern 7: Browser Timezone Detection

```typescript
// "use client" — MUST be client-only; SSR returns undefined
const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
// e.g. "America/Chicago"
```

Use this on mount in a `useEffect` or pass as a default value inside the client component. Do NOT call it in a Server Component — it will return the server's timezone, not the browser's.

For v1 (Phase 5), display detected timezone as a read-only label: "Times shown in America/Chicago". A "change timezone" affordance is deferred — it adds significant UI complexity and is not in scope.

### Pattern 8: Confirmation Screen Routing

After a successful POST to `/api/bookings`, navigate to a separate confirmation route: `/[account]/[event-slug]/confirmed?bookingId=XXX` (or render as a stateful replacement within the same page component). The stateful replacement approach (swap `BookingShell` step to "confirmed") is simpler and avoids a new route file for Phase 5. The confirmation screen shows booking details (date, time, location, booker name) and a note that a confirmation email has been sent.

**Do NOT** route to a separate `/confirmed/[booking-id]` page for Phase 5 — the booking row does not yet have a public-accessible read policy (RLS blocks anon reads on bookings). Phase 6 will add cancel/reschedule tokens and their own read surface.

### Anti-Patterns to Avoid

- **Server Action for booking POST:** Cannot return 409. Use Route Handler.
- **Floating times in .ics (no VTIMEZONE):** Gmail renders them in server UTC, not attendee local time. Always use `timezones-ical-library`.
- **Regenerating UID per email:** ICS UID must be stable (use `booking.id`). Re-sending the same UID with `SEQUENCE: 0` allows calendar clients to match updates. Generating a new UUID on every send creates duplicate events.
- **Awaiting email sends in the Route Handler:** Email delivery adds 200-800ms. Fire and forget: `void sendBookingEmails(...)`. If the email fails, the booking is still confirmed.
- **Calling `Intl.DateTimeFormat().resolvedOptions().timeZone` in a Server Component:** Returns server TZ, not user's. Must be `"use client"`.
- **Using anon Supabase client for public booking page reads:** RLS blocks all anon reads. Use `createAdminClient()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iCalendar RFC 5545 string generation | Custom string concatenation | `ical-generator` | CRLF endings, 75-octet line folding, DTSTAMP UTC format, VTIMEZONE structure — each is a spec trap |
| VTIMEZONE blocks | Custom IANA tz-to-vtimezone converter | `timezones-ical-library` | Uses vzic-compiled zone data; stays current with IANA DB updates |
| Bot protection | Custom honeypot or challenge | Cloudflare Turnstile | Free, invisible-by-default, token is verified server-side; re-implementing is week of work |
| Calendar date picker | Custom calendar grid | `react-day-picker` (already installed v9.14.0) | Already in project, accessible, supports disabling dates |
| Email sending | Direct Resend SDK call | `@nsi/email-sender` | Project standard; already wraps Resend; `sendEmail()` is one function call |

**Key insight:** The iCalendar spec has three invisible correctness requirements that `ical-generator` handles automatically: (1) `\r\n` line endings (not `\n`), (2) line folding at exactly 75 octets with CRLF+space continuation, and (3) `DTSTAMP` always in UTC with `Z` suffix. Custom string builders routinely fail at least one of these, causing silent rejection in Outlook or Google Calendar.

---

## Common Pitfalls

### Pitfall 1: Server Action Cannot Return 409
**What goes wrong:** Developer uses a Server Action for the booking POST and tries to return a 409 — the response always comes back as HTTP 200 regardless of what you return. The client cannot distinguish "slot taken" from "success".
**Why it happens:** Next.js architectural constraint confirmed December 2025 (GitHub Discussions #49302).
**How to avoid:** Use Route Handler at `app/api/bookings/route.ts`. Return `NextResponse.json({ error: "..." }, { status: 409 })`.
**Warning signs:** If you're writing `"use server"` at the top of the booking submission function, stop.

### Pitfall 2: Floating .ics Times (Missing VTIMEZONE)
**What goes wrong:** Gmail displays the event at wrong local time. Outlook silently adjusts to UTC. Apple Calendar shows UTC time labeled as local.
**Why it happens:** Without a `VTIMEZONE` component, RFC 5545 times are "floating" — no timezone context. Each client interprets them differently.
**How to avoid:** Always call `cal.timezone({ name: ianaTz, generator: (tz) => tzlib_get_ical_block(tz)[0] })` before creating events. Set `timezone` on the event itself too.
**Warning signs:** `.ics` output has no `BEGIN:VTIMEZONE` block.

### Pitfall 3: Non-Stable UID in .ics
**What goes wrong:** Every confirmation email creates a new duplicate event in the booker's calendar. Phase 6 reschedule cannot update the existing event (wrong UID).
**Why it happens:** Using `crypto.randomUUID()` at send time rather than deriving UID from booking ID.
**How to avoid:** Set `uid: booking.id` (the Postgres UUID). This is globally unique and stable. RFC 7986 recommends plain UUIDs; the old `uuid@domain` format is discouraged for privacy reasons.

### Pitfall 4: ICS Content-Type for Email Clients
**What goes wrong:** Gmail shows .ics as a plain attachment, not an inline "Add to Calendar" card.
**Why it happens:** Content-Type must be `text/calendar; method=REQUEST` (not `application/octet-stream`).
**How to avoid:** Pass `contentType: "text/calendar; method=REQUEST"` in the `EmailAttachment` object. The `@nsi/email-sender` Resend provider passes this through to Resend's API.
**Warning signs:** Booker sees a download link for "invite.ics" but no calendar card in Gmail.

### Pitfall 5: Turnstile Token Single-Use
**What goes wrong:** If the booking POST fails validation and the user fixes errors and retries, the Turnstile token is already spent. Cloudflare returns `timeout-or-duplicate`.
**Why it happens:** Each token is one-time-use (Cloudflare docs confirmed).
**How to avoid:** On form submission failure (any error, including validation), call `turnstileRef.current?.reset()` to force a fresh challenge before re-submission. Show user a brief "Refreshing security check..." message.

### Pitfall 6: Route Slug Collision with "app"
**What goes wrong:** An account with slug `"app"` would conflict with the `/app/*` proxy-gated routes.
**Why it happens:** Next.js dynamic `[account]` segment matches any string including `"app"`.
**How to avoid:** Add a reserved-slug check when creating accounts. During the Phase 5 booking page load, if `account === "app"` return `notFound()` immediately. A small reserved list: `["app", "api", "_next", "auth"]`.
**Warning signs:** Visiting `/app/anything` stops hitting the owner dashboard.

### Pitfall 7: Race-Loser 409 UX
**What goes wrong:** User sees a generic error and stares at a stale slot picker showing the just-taken slot as available.
**Why it happens:** The slot list was fetched when the page loaded; it's client-cached.
**How to avoid:** On 409 response: (1) show Sonner toast "That slot was just taken — pick another time", (2) re-fetch `/api/slots` for the selected date range, (3) scroll/focus the slot picker. The Sonner `<Toaster />` is already mounted in root layout — fire directly.

---

## Code Examples

### Complete .ics Build + Email Send
```typescript
// Source: ical-generator v10.2.0 README, @nsi/email-sender types.ts (direct inspection)
import ical, { ICalCalendarMethod } from "ical-generator";
import { tzlib_get_ical_block } from "timezones-ical-library";
import { sendEmail } from "@nsi/email-sender"; // or @/lib/email/sender if local copy

export async function sendBookingConfirmation({
  booking,
  eventType,
  accountName,
  accountTimezone,
  ownerEmail,
}: SendConfirmationArgs) {
  // Build .ics
  const cal = ical({ name: eventType.name });
  cal.method(ICalCalendarMethod.REQUEST);
  cal.timezone({
    name: accountTimezone,
    generator: (tz) => tzlib_get_ical_block(tz)[0],
  });
  cal.createEvent({
    uid: booking.id,                    // stable; matches booking row UUID
    summary: eventType.name,
    description: eventType.description ?? undefined,
    start: new Date(booking.start_at),  // Date from UTC timestamptz string
    end: new Date(booking.end_at),
    timezone: accountTimezone,
    organizer: { name: accountName, email: ownerEmail },
  }).createAttendee({
    email: booking.booker_email,
    name: booking.booker_name,
    rsvp: true,
  });

  const icsBuffer = Buffer.from(cal.toString(), "utf-8");

  // Send booker confirmation
  await sendEmail({
    to: booking.booker_email,
    subject: `Confirmed: ${eventType.name}`,
    html: buildConfirmationHtml({ booking, eventType, accountName }),
    attachments: [{
      filename: "invite.ics",
      content: icsBuffer,
      contentType: "text/calendar; method=REQUEST",
    }],
  });
}
```

### Booking Zod Schema
```typescript
// lib/bookings/schema.ts
import { z } from "zod";

export const bookingInputSchema = z.object({
  eventTypeId: z.string().uuid(),
  startAt: z.string().datetime(),          // ISO UTC string
  endAt: z.string().datetime(),
  bookerName: z.string().min(1).max(200),
  bookerEmail: z.string().email(),
  bookerPhone: z.string().min(1).max(50),
  bookerTimezone: z.string().min(1),       // IANA, from Intl.DateTimeFormat
  answers: z.record(z.string()),           // key = question label, value = answer
  turnstileToken: z.string().min(1),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;
```

### DB Insert with Race-Safe 409
```typescript
// Source: Supabase JS docs + Postgres error code 23505
const { data: booking, error } = await supabase
  .from("bookings")
  .insert({
    account_id: accountId,
    event_type_id: input.eventTypeId,
    start_at: input.startAt,
    end_at: input.endAt,
    booker_name: input.bookerName,
    booker_email: input.bookerEmail,
    booker_phone: input.bookerPhone,
    booker_timezone: input.bookerTimezone,
    answers: input.answers,
    cancel_token_hash: await hashToken(crypto.randomUUID()),
    reschedule_token_hash: await hashToken(crypto.randomUUID()),
    status: "confirmed",
  })
  .select("id, start_at, end_at, booker_name, booker_email")
  .single();

if (error?.code === "23505") {
  // bookings_no_double_book partial unique index violation
  return NextResponse.json(
    { error: "This slot was just booked by someone else. Please pick another time." },
    { status: 409, headers: NO_STORE }
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ics` npm package (floating times) | `ical-generator` + `timezones-ical-library` | ical-generator v2+ (2021), timezones lib added later | Real VTIMEZONE support; cross-client compatibility |
| `moment-timezone` for TZ in .ics | `timezones-ical-library` native | 2022+ | No moment dependency; tree-shakeable |
| `.ics` UID: `timestamp@domain.com` | Plain UUID (RFC 7986 §5.3) | RFC 7986 (2016), widely adopted now | No domain/user info leakage |
| Server Action for all mutations | Route Handler for HTTP-status-dependent endpoints | Next.js App Router v13+ (limitation) | Must use Route Handler for 409 |
| Google reCAPTCHA | Cloudflare Turnstile | 2022+ | No privacy-invasive tracking; invisible by default |

**Deprecated/outdated:**
- `ics` (adamgibbons): Floating times only or UTC; no native VTIMEZONE generation. Do not use.
- `node-ical-toolkit`: Last updated 2019, unmaintained. Do not use.
- `METHOD:REQUEST` via `@` addr-spec UID format: RFC 7986 explicitly discourages.

---

## Open Questions

### OQ-1: @nsi/email-sender npm-link setup
**What we know:** Package found at `../email-sender/` (sibling dir). The `sendEmail()` function and attachment API are fully documented above. It is NOT currently installed in `calendar-app/node_modules/@nsi/`.
**What's unclear:** Whether `npm install ../email-sender` works cleanly with Vercel build pipeline (Vercel does not have access to sibling directories on the file system).
**Recommendation:** For Vercel deployment, either: (a) publish `@nsi/email-sender` to npm (private or public), (b) copy `src/` files into `calendar-app/lib/email-sender/` as a local module and import directly, or (c) inline `sendEmail()` calls directly using the Resend SDK. Option (b) is fastest for Phase 5 — copy the three files (`types.ts`, `providers/resend.ts`, `index.ts`) into `lib/email-sender/` and import from there. Andrew should confirm preferred approach before planning begins.

### OQ-2: Owner Email Address for "From" and Notification
**What we know:** The `accounts` table has no `owner_email` column — the owner email lives in `auth.users`. The `current_owner_account_ids()` RPC does not expose the email.
**What's unclear:** How to get the owner's email for the owner notification email and for the .ics `ORGANIZER` field, given the public `/api/bookings` route uses service-role and has no auth session.
**Recommendation:** Either (a) add an `owner_email` column to `accounts` populated at signup, or (b) perform a service-role lookup on `auth.users` using the `owner_user_id` from the accounts row. Option (b) is doable with `createAdminClient()` + `supabase.auth.admin.getUserById(owner_user_id)`. Document which approach is preferred — the planner needs to know before writing the DB migration task.

### OQ-3: Reserved Slug List
**What we know:** Dynamic route `[account]` catches everything including `"app"`, `"api"`, `"_next"`.
**Recommendation:** Add a small reserved-slug check in the booking page `notFound()` guard. A migration-level constraint on `accounts.slug` can enforce this at DB level. Planner should include a task for this.

---

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `../email-sender/src/types.ts`, `../email-sender/src/providers/resend.ts`, `../email-sender/src/index.ts`
- Direct file inspection: `calendar-app/supabase/migrations/20260419120001_rls_policies.sql` — RLS anon block confirmed
- Direct file inspection: `calendar-app/app/api/slots/route.ts` — service-role public page pattern
- Direct file inspection: `calendar-app/supabase/migrations/20260419120000_initial_schema.sql` — bookings table schema, partial unique index
- `ical-generator` GitHub README (fetched April 2026): `METHOD:REQUEST`, `VTIMEZONE` generator, `ORGANIZER`/`ATTENDEE` API
- `timezones-ical-library` GitHub README (fetched April 2026): `tzlib_get_ical_block()` function signature
- Cloudflare Turnstile docs (fetched April 2026): `https://developers.cloudflare.com/turnstile/get-started/server-side-validation/` — siteverify endpoint, request/response format
- `@marsidev/react-turnstile` GitHub (fetched April 2026): v1.5.0, ref API, test keys
- GitHub Discussions #49302 (fetched April 2026): Server Actions cannot return custom HTTP status codes — confirmed December 2025

### Secondary (MEDIUM confidence)
- WebSearch + calen.events blog: CRLF/line-folding pitfalls, Gmail `text/calendar; method=REQUEST` content-type
- WebSearch: RFC 7986 §5.3 plain UUID for ICS UID (confirmed by iCalendar.org source link)
- Cloudflare test keys (verified against official `developers.cloudflare.com/turnstile/troubleshooting/testing/`)

### Tertiary (LOW confidence — not used for prescriptive recommendations)
- WebSearch snippets on Cal.com confirmation routing (not verified against source)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all library versions verified against GitHub/npm (April 2026)
- @nsi/email-sender API: HIGH — source code read directly from file system
- Architecture (Route Handler pattern): HIGH — confirmed Server Action cannot return 409 via GitHub Discussion
- .ics generation: HIGH — ical-generator README fetched; timezones-ical-library README fetched
- Turnstile integration: HIGH — official Cloudflare docs fetched
- RLS/Supabase access: HIGH — migration SQL read directly; matches existing /api/slots pattern
- Browser TZ detection: HIGH — `Intl.DateTimeFormat().resolvedOptions().timeZone` is Web API standard
- Confirmation screen approach: MEDIUM — based on project pattern analysis, not external verification

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable libraries; Cloudflare docs and ical-generator may release minor updates)
