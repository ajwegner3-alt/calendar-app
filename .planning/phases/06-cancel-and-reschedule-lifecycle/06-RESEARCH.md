# Phase 6: Cancel + Reschedule Lifecycle - Research

**Researched:** 2026-04-25
**Domain:** Tokenized cancel/reschedule flows, atomic Postgres state transitions, ical-generator METHOD:CANCEL, Vercel hobby-tier rate limiting
**Confidence:** HIGH (all claims verified against actual codebase files, ical-generator source in node_modules, and direct schema inspection)

---

## Summary

Phase 6 adds the cancel and reschedule lifecycle to an already-complete booking infrastructure. All the foundational pieces are in place: SHA-256 token hashing in `lib/bookings/tokens.ts`, the `bookings.cancel_token_hash` and `bookings.reschedule_token_hash` columns with lookup indexes, the `booking_events` audit table, `buildIcsBuffer()` which already supports METHOD swapping, and the `SlotPicker` component with well-defined props.

The key implementation challenge is the **atomic reschedule UPDATE**: it must change `start_at`/`end_at`, replace both token hashes, AND naturally trigger the `bookings_no_double_book` partial unique index — all in one `UPDATE` with no pre-flight. The existing `booking_status` enum already has `rescheduled` and `cancelled` values. The `booking_actor` enum already has `booker` and `owner`. The `booking_event_kind` enum already has `cancelled` and `rescheduled`. No schema column additions are required for Phase 6.

For rate limiting, the recommendation is a **Postgres-backed counter table** over Upstash Redis. The project has no Redis dependency, Upstash requires a new account/dependency, and in-memory rate limiting is per-Vercel-instance (breaks under any meaningful load). A lightweight `rate_limit_events` table in Postgres incurs one extra query per token-route hit — acceptable at the traffic volume of a single-owner scheduling app on hobby tier.

**Primary recommendation:** Single `UPDATE ... WHERE status='confirmed' AND start_at > now() AND cancel_token_hash=$hash` pattern for cancel; same `WHERE` clause for reschedule but also setting the new slot fields and rotating token hashes. Both operations are atomic at the DB level via Postgres row locking. Postgres-backed sliding-window rate limit. No new npm dependencies.

---

## Standard Stack

### Core (all already installed — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ical-generator` | ^10.2.0 | Build .ics for METHOD:CANCEL and METHOD:REQUEST | Already used in Phase 5; source confirms `ICalCalendarMethod.CANCEL` exists |
| `timezones-ical-library` | ^2.1.3 | VTIMEZONE block for cancellation .ics | Already wired in `buildIcsBuffer()` |
| `@supabase/supabase-js` | ^2.103.1 | DB queries; service-role for public token routes | Established pattern |
| `date-fns` + `@date-fns/tz` | ^4.1.0 + ^1.4.1 | Time formatting in booker/owner TZ for emails | Established pattern |
| shadcn `AlertDialog` | installed | Owner-cancel confirmation modal | `components/ui/alert-dialog.tsx` confirmed present |
| shadcn `Textarea` | installed | Optional cancel reason textarea | `components/ui/textarea.tsx` confirmed present |

### No New Dependencies Required
The full Phase 6 feature set uses only installed libraries. Verified via `package.json`:
- No Upstash (`@upstash/ratelimit`, `@upstash/redis`) — not installed, not needed
- No additional email library — `lib/email-sender` Gmail provider already handles attachments
- `SlotPicker` is a local component, not a library

---

## Schema Delta

**No new columns needed on `bookings` table.** The Phase 1 migration already has:

```sql
-- already in 20260419120000_initial_schema.sql
cancel_token_hash     text not null
reschedule_token_hash text not null
cancelled_at          timestamptz           -- set on cancel
cancelled_by          text                  -- 'booker' | 'owner'
status                booking_status not null default 'confirmed'
-- booking_status enum: confirmed, cancelled, rescheduled
-- booking_actor enum: booker, owner, system (on booking_events)
-- booking_event_kind enum: created, cancelled, rescheduled, reminder_sent

-- Token lookup indexes already created:
create index bookings_cancel_token_idx on bookings(cancel_token_hash);
create index bookings_reschedule_token_idx on bookings(reschedule_token_hash);
```

**New migration required: rate limit table**

```sql
-- New migration for Phase 6 rate limiting (Postgres-backed)
create table if not exists rate_limit_events (
  id         bigserial primary key,
  key        text not null,           -- e.g. 'cancel:203.0.113.1'
  occurred_at timestamptz not null default now()
);
create index rate_limit_events_key_occurred_idx
  on rate_limit_events(key, occurred_at);
-- TTL cleanup: Phase 8 can add a pg_cron sweep; for now rows accumulate slowly.
-- At 10 req/5min max per IP, growth is bounded.
```

**`booking_events` audit table (Phase 1, no migration needed):**

```sql
-- Existing columns in booking_events:
-- id, booking_id, account_id, event_type (booking_event_kind), occurred_at, actor (booking_actor), metadata (jsonb)
-- Phase 6 uses metadata to carry: { reason, ip, old_start_at, new_start_at }
```

**Summary:** One new migration (rate_limit_events table). No alterations to `bookings`.

---

## Architecture Patterns

### Recommended Route Structure
```
app/
├── cancel/
│   └── [token]/
│       └── page.tsx          # GET: show booking details + confirm button (2-step)
├── reschedule/
│   └── [token]/
│       └── page.tsx          # GET: show current slot + SlotPicker
├── api/
│   └── cancel/
│       └── route.ts          # POST: validate token + cancel atomically
│   └── reschedule/
│       └── route.ts          # POST: validate token + atomic slot swap + token rotation

lib/
├── bookings/
│   ├── tokens.ts             # existing: hashToken, generateBookingTokens
│   ├── cancel.ts             # NEW: cancelBooking() shared function
│   └── reschedule.ts         # NEW: rescheduleBooking() shared function
├── email/
│   ├── send-cancel-emails.ts # NEW: booker + owner cancel notification
│   └── send-reschedule-emails.ts # NEW: booker + owner reschedule notification
├── rate-limit/
│   └── index.ts              # NEW: checkRateLimit(key, maxReqs, windowMs)
```

### Pattern 1: Token Validation (shared by cancel + reschedule)

The canonical lookup uses `hashToken()` from the existing `lib/bookings/tokens.ts`:

```typescript
// Source: lib/bookings/tokens.ts (Phase 5, verified)
import { hashToken } from "@/lib/bookings/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

async function resolveTokenBooking(rawToken: string) {
  const hash = await hashToken(rawToken);
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, account_id, event_type_id, start_at, end_at, booker_name, booker_email, booker_timezone, status, cancel_token_hash, reschedule_token_hash")
    .eq("cancel_token_hash", hash)   // or reschedule_token_hash for reschedule route
    .maybeSingle();

  // Token validity = status === 'confirmed' AND start_at > now()
  if (!booking) return null;
  if (booking.status !== "confirmed") return null;
  if (new Date(booking.start_at) <= new Date()) return null;

  return booking;
}
```

**Key point:** The validity check `start_at > now()` is evaluated in application code after the DB row is fetched, not in the WHERE clause. This avoids a race where the row exists but `start_at` just passed while the query was in flight. The application check is correct — if start_at <= now() now, the token is dead.

Alternative (also acceptable): add `gt("start_at", new Date().toISOString())` to the Supabase query. Either approach is correct; the application-level check is slightly more explicit.

### Pattern 2: Atomic Cancel

Cancel is a single UPDATE that sets status, cancelled_at, cancelled_by, AND clears both token hashes:

```typescript
// Source: derived from Phase 1 schema + Phase 5 route handler patterns
const { data, error } = await supabase
  .from("bookings")
  .update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancelled_by: actor,          // 'booker' | 'owner'
    // Rotate tokens to null to invalidate them immediately
    // (Phase 1 schema: cancel_token_hash text NOT NULL — cannot set null)
    // Use a dead hash instead: hash of a random UUID that no email ever contains
    cancel_token_hash: await hashToken(crypto.randomUUID()),
    reschedule_token_hash: await hashToken(crypto.randomUUID()),
  })
  .eq("id", bookingId)
  .eq("status", "confirmed")           // CAS guard — only cancel confirmed bookings
  .gt("start_at", new Date().toISOString())  // extra guard: past bookings stay as-is
  .select("id")
  .single();

// If error or !data: token was valid when we checked but race — another cancel beat us
// Return a "no longer active" page (same as invalid token UX)
```

**Important:** `cancel_token_hash` is `text NOT NULL` in Phase 1 schema — cannot be set to null. The strategy is to replace with a dead hash (SHA-256 of a new random UUID that appears in no email). This permanently invalidates the token without changing the column type.

### Pattern 3: Atomic Reschedule (Token Rotation + Slot Swap)

Reschedule is a single UPDATE that changes the slot, rotates both token hashes, and sets status to `rescheduled` then back to... wait — the status enum. Let's verify.

The `booking_status` enum has: `confirmed`, `cancelled`, `rescheduled`. Per the CONTEXT.md decision, after a reschedule the booking should remain bookable, which means status stays `confirmed` but the old slot is now available. However, the enum has `rescheduled` as a value.

**Decision (confirmed from CONTEXT.md):** Token validity is `status === 'confirmed' AND start_at > now()`. After reschedule, the booking must remain `confirmed` (new slot) for the new tokens to be valid. So the UPDATE keeps `status = 'confirmed'` — the `rescheduled` enum value is not used as the final state. The `rescheduled` booking_event_kind is written to `booking_events` to capture the history.

```typescript
// Source: derived from Phase 1 schema + Phase 5 token patterns
const { rawCancel, rawReschedule, hashCancel, hashReschedule } =
  await generateBookingTokens();

const { data, error } = await supabase
  .from("bookings")
  .update({
    start_at: newStartAt,
    end_at: newEndAt,
    // Rotate tokens atomically in the same UPDATE
    cancel_token_hash: hashCancel,
    reschedule_token_hash: hashReschedule,
    // status stays 'confirmed' — new slot is the new confirmed booking
  })
  .eq("id", bookingId)
  .eq("status", "confirmed")           // CAS guard
  .eq("reschedule_token_hash", oldHash) // extra CAS: only if our token is still current
  .gt("start_at", new Date().toISOString()) // guard: old slot not in the past
  .select("id, start_at, end_at, booker_name, booker_email, booker_timezone, answers")
  .single();

// Postgres 23505 on bookings_no_double_book: new slot already taken → 409 to user
// Returns null data without 23505: race on cancel/reschedule → "no longer active" page
```

**Why the double CAS guard works:** Supabase's `.eq("reschedule_token_hash", oldHash)` combined with `.eq("status", "confirmed")` means only the original token holder can complete the reschedule. If someone else already rescheduled or cancelled, `data` is null and we show the "no longer active" page.

**Conflict detection (Postgres 23505):** The existing `bookings_no_double_book` partial unique index `ON (event_type_id, start_at) WHERE status='confirmed'` fires on the UPDATE if the new slot is already taken by another confirmed booking for the same event type. Catch `insertError.code === "23505"` (same code for UPDATE conflicts on unique indexes) and surface as a slot-taken message to the booker.

### Pattern 4: Email-Prefetch Defense (2-Step Cancel)

The cancel flow is 2-step to defend against Gmail/Outlook prefetching GET links:

```
GET /cancel/[token]  → display booking details + "Cancel this booking?" button
POST /api/cancel     → body: { token } → actual cancellation
```

In Next.js 15 App Router:
- `app/cancel/[token]/page.tsx` is a Server Component. It validates the token (read-only) and renders the confirm UI. It does NOT mutate.
- The confirm button submits a form to `POST /api/cancel` (Route Handler, NOT a Server Action — same rationale as `/api/bookings`: Route Handlers return proper HTTP status codes; Server Actions cannot return 409 or 429).

**Note on Server Actions vs Route Handlers for mutations:** The owner-cancel path (dashboard button) CAN use a Server Action because the owner is authenticated, and no 409 race-loser experience is needed (owner just sees a toast error). The public booker-facing cancel/reschedule must be Route Handlers to enable: rate-limit 429 response, slot-taken 409 response, and full control over response shape.

### Pattern 5: Postgres Rate Limiting

Sliding-window counter in Postgres:

```typescript
// lib/rate-limit/index.ts
import { createAdminClient } from "@/lib/supabase/admin";

export async function checkRateLimit(
  key: string,          // e.g. "cancel:1.2.3.4"
  maxRequests: number,  // 10
  windowMs: number      // 5 * 60 * 1000
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const supabase = createAdminClient();
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  // Count requests in window
  const { count } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .gte("occurred_at", windowStart);

  if ((count ?? 0) >= maxRequests) {
    return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  // Record this request
  await supabase.from("rate_limit_events").insert({ key });

  return { allowed: true, retryAfterSeconds: 0 };
}
```

### Pattern 6: METHOD:CANCEL .ics in ical-generator v10

Verified directly in `node_modules/ical-generator/src/calendar.ts`:

```typescript
// ICalCalendarMethod enum values (verified from source):
// REQUEST, PUBLISH, REPLY, ADD, CANCEL, REFRESH, COUNTER, DECLINECOUNTER

// For METHOD:CANCEL .ics:
import ical, { ICalCalendarMethod, ICalEventStatus } from "ical-generator";
import { tzlib_get_ical_block } from "timezones-ical-library";

function buildCancelIcsBuffer(opts: {
  uid: string;       // MUST be booking.id — same UID as original
  summary: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  organizerName: string;
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName: string;
  sequence: number;  // RFC 5546: must increment on updates; use 1 for cancel
}): Buffer {
  const cal = ical({ name: opts.summary });
  cal.method(ICalCalendarMethod.CANCEL);
  cal.timezone({
    name: opts.timezone,
    generator: (tz) => tzlib_get_ical_block(tz)[0],
  });
  cal.createEvent({
    id:       opts.uid,        // same UID as booking — triggers cancel in calendar app
    summary:  opts.summary,
    start:    opts.startAt,
    end:      opts.endAt,
    timezone: opts.timezone,
    status:   ICalEventStatus.CANCELLED,
    organizer: { name: opts.organizerName, email: opts.organizerEmail },
  })
  .sequence(opts.sequence)    // SEQUENCE field setter — does NOT auto-increment
  .createAttendee({
    email: opts.attendeeEmail,
    name:  opts.attendeeName,
    rsvp:  true,
  });

  return Buffer.from(cal.toString(), "utf-8");
}
```

**SEQUENCE field (verified from source):** `ical-generator` v10 defaults `sequence` to `0` for new events. It does NOT auto-increment. RFC 5546 requires SEQUENCE to increment for each update. For Phase 6:
- Original booking .ics (Phase 5): `SEQUENCE:0` (library default)
- Cancellation .ics: set `.sequence(1)` manually
- Reschedule .ics (METHOD:REQUEST with same UID): set `.sequence(1)` manually

Pass `sequence: 1` explicitly for all Phase 6 .ics files.

**`ICalEventStatus.CANCELLED`:** Confirmed in `node_modules/ical-generator/src/event.ts`: `CANCELLED = 'CANCELLED'`. Set this on the event for METHOD:CANCEL .ics. Calendar clients that support iTIP use both the METHOD:CANCEL and STATUS:CANCELLED to identify and remove the event.

### Pattern 7: Reschedule .ics (METHOD:REQUEST, same UID)

For reschedule notification emails, the .ics is METHOD:REQUEST (existing `buildIcsBuffer` function) with:
- Same `uid` (booking.id) — calendar apps update the existing event in place
- `sequence: 1` — increment tells calendar apps this is an update
- New `startAt`/`endAt` — the new slot times

This means `buildIcsBuffer()` from Phase 5 can be reused verbatim, just passing `sequence: 1`. However, the current `BuildIcsOptions` interface does not expose a `sequence` field. The planner must add `sequence?: number` to `BuildIcsOptions` and pass it through to `cal.createEvent(...).sequence(opts.sequence ?? 0)`.

### Pattern 8: SlotPicker Reuse for Reschedule

The `SlotPicker` component has this props interface (verified from source):

```typescript
interface SlotPickerProps {
  eventTypeId: string;
  accountTimezone: string;
  bookerTimezone: string;
  ownerEmail: string | null;
  selectedDate: string | null;
  onSelectDate: (d: string | null) => void;
  selectedSlot: Slot | null;
  onSelectSlot: (s: Slot | null) => void;
  refetchKey: number;
}
```

The reschedule page must manage all of this state client-side. It needs `eventTypeId` from the booking row, `accountTimezone` from the account row. It does NOT need modification — the component works as-is for the reschedule context.

The "Currently scheduled: [old time]" reference line is rendered ABOVE the SlotPicker (server-side, static text from the booking's current start_at).

**Important:** The `SlotPicker` fetches `/api/slots` which uses availability rules (existing Phase 4 logic). The old slot is excluded from results because `computeSlots` filters out booked slots via the DB partial unique index. When the reschedule UPDATE succeeds, the old slot becomes available again (the confirmed booking moved). This is correct behavior with no special handling needed.

### Pattern 9: Owner Cancel via Server Action

The owner-side cancel is dashboard-only (authenticated). It can use a Server Action:

```typescript
// app/(shell)/app/bookings/[id]/_lib/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelBooking } from "@/lib/bookings/cancel";  // shared function

export async function cancelBookingAction(
  bookingId: string,
  reason?: string,
): Promise<{ error?: string }> {
  // Verify authenticated owner owns this booking (via RLS client)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Owner-scope: verify booking belongs to owner's account
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, account_id")
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .single(); // RLS policy "owners manage bookings" scopes to their account

  if (!booking) return { error: "Booking not found or already cancelled." };

  // Use admin client for the actual cancel (same shared function as public path)
  const result = await cancelBooking({
    bookingId,
    actor: "owner",
    reason,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  });

  if (!result.ok) return { error: result.error };

  revalidatePath(`/app/bookings/${bookingId}`);
  return {};
}
```

The `cancelBooking()` shared function handles the UPDATE + emails + audit log. Both the public token route and the owner action call the same function.

### Pattern 10: booking_events Audit Logging

Every cancel and reschedule writes a row to `booking_events`:

```typescript
// Audit log for cancel
await supabase.from("booking_events").insert({
  booking_id: bookingId,
  account_id: accountId,
  event_type: "cancelled",           // booking_event_kind enum value
  actor: actor,                      // booking_actor enum: 'booker' | 'owner'
  metadata: {
    reason: reason ?? null,          // optional cancel reason text
    ip: ip ?? null,                  // IP for rate-limit forensics
  },
});

// Audit log for reschedule
await supabase.from("booking_events").insert({
  booking_id: bookingId,
  account_id: accountId,
  event_type: "rescheduled",
  actor: "booker",
  metadata: {
    old_start_at: oldStartAt,        // ISO string of previous slot
    new_start_at: newStartAt,        // ISO string of new slot
    ip: ip ?? null,
  },
});
```

The `booking_events` INSERT must run after the main UPDATE succeeds. It can run as a separate query (not a transaction) — audit log failure should be logged but not block the cancel/reschedule response. Use the same fire-and-forget pattern as emails: `void insertAuditEvent(...)`.

### Anti-Patterns to Avoid

- **Pre-flight + mutate (two-step):** Checking token validity first, then separately cancelling — creates a TOCTOU race. Always embed the validity conditions in the UPDATE's WHERE clause.
- **Setting `status = 'rescheduled'` as final state:** The `rescheduled` enum value exists but after a reschedule the booking must be `confirmed` (new slot) for the new tokens to be valid. `rescheduled` status would cause the new token links to fail the validity check.
- **Using `crypto.createHash("sha256")` for token hashing:** Phase 5 established Web Crypto API (`crypto.subtle.digest`) as the standard — Edge-runtime compatible. Do NOT switch to Node's `createHash`.
- **Server Actions for public cancel/reschedule routes:** Public routes need rate-limit 429 and 409 slot-taken responses. Server Actions cannot return custom HTTP status codes.
- **In-memory rate limiting:** State is per-Vercel-instance and lost on cold starts. Unacceptable even at hobby tier since Vercel can spin up multiple instances.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 token hashing | Custom crypto implementation | `hashToken()` from `lib/bookings/tokens.ts` | Already exists, Web Crypto compatible, tested |
| Token generation | Custom UUID or random generator | `generateBookingTokens()` from `lib/bookings/tokens.ts` | Already exists, returns both raw + hash |
| iCalendar .ics building | Custom RFC 5545 string builder | `buildIcsBuffer()` + extend for SEQUENCE + METHOD:CANCEL | Already exists; RFC 5545 CRLF/folding/timezone are traps |
| Email sending | Custom SMTP wrapper | `sendEmail()` from `lib/email-sender` | Already exists; handles attachments, error recovery |
| AlertDialog modal | Custom modal/confirm UI | `components/ui/alert-dialog.tsx` | Already installed + used in event-types delete (Phase 3) |
| Slot picking | Custom date/time picker | `SlotPicker` from `app/[account]/[event-slug]/_components/slot-picker.tsx` | Already wired to `/api/slots`, handles TZ detection, 0 modifications needed |

---

## Common Pitfalls

### Pitfall 1: Email Client Prefetch Kills Single-Step Cancel
**What goes wrong:** Gmail and Outlook fetch URLs from emails before the user clicks them (link prefetch, spam filtering, security scanners). A GET to `/cancel/[token]` that immediately cancels would fire before the user ever opens the email.
**Why it happens:** Standard behavior in major email clients.
**How to avoid:** GET on `/cancel/[token]` is read-only (show booking details + confirm button). Only POST to `/api/cancel` triggers the mutation. Next.js App Router Server Components handle GET naturally; the mutation must be a form POST or fetch to a Route Handler.
**Warning signs:** If you see "bookings cancelled without booker intent" in production — this is the cause.

### Pitfall 2: SEQUENCE Field Is Not Auto-Incremented
**What goes wrong:** Sending a reschedule/cancel .ics with `SEQUENCE:0` (library default) when the original booking already used SEQUENCE:0. Calendar clients may ignore the update and show stale data.
**Why it happens:** `ical-generator` v10 defaults `sequence` to 0 on every new `createEvent()`. It does NOT auto-increment between calls. Verified in `node_modules/ical-generator/src/event.ts` line 204: `sequence: 0`.
**How to avoid:** Always call `.sequence(1)` on the event for Phase 6 .ics. Pass `sequence: number` through `BuildIcsOptions`. For Phase 6 all updates are revision 1 (one step from the original booking).
**Warning signs:** "Rescheduled event still shows old time in Google Calendar" — missing SEQUENCE increment.

### Pitfall 3: UPDATE Returns No Rows (Silent No-Op) on Race
**What goes wrong:** A cancel or reschedule UPDATE with a WHERE guard (status='confirmed', token_hash=X) matches no rows because another operation already ran — but Supabase returns no error, just `data: null`.
**Why it happens:** Supabase's `.single()` on an UPDATE that matches no rows returns `{error: {code: "PGRST116"}}` ("Results contain 0 rows"). Without `.single()`, data is simply null/empty array with no error.
**How to avoid:** Use `.single()` on the UPDATE select so PGRST116 (no rows matched) is distinguishable from a real error. Map no-rows-matched to the "no longer active" page, not a 500.

### Pitfall 4: cancel_token_hash NOT NULL — Cannot Clear to Null
**What goes wrong:** Setting `cancel_token_hash = null` to invalidate the token after use fails because the column has NOT NULL constraint.
**Why it happens:** Phase 1 schema defined both token hash columns as `text not null`.
**How to avoid:** Replace with a dead hash: `await hashToken(crypto.randomUUID())`. A random UUID is never sent in any email, so this hash can never be presented at a token endpoint. Effectively invalidates the token without nulling the column.

### Pitfall 5: bookings_no_double_book Fires on UPDATE
**What goes wrong:** A reschedule UPDATE setting a new `start_at` on an event_type that already has a `confirmed` booking at that time raises Postgres error `23505` — same as on INSERT.
**Why it happens:** The partial unique index `ON (event_type_id, start_at) WHERE status='confirmed'` applies to UPDATE operations as well as INSERT.
**How to avoid:** Catch `error.code === "23505"` in the reschedule route handler and return a slot-taken response (409), then show the SlotPicker again with a "that slot was just taken" banner. Identical to the Phase 5 race-loser UX.

### Pitfall 6: Reschedule token in WHERE + CAS on old hash
**What goes wrong:** Between the token validation read and the UPDATE, another request using the same reschedule token arrives and both succeed — each rotating to different new tokens. The second one now has a booking with tokens the second requester doesn't know about.
**Why it happens:** No CAS guard on the UPDATE. Read-modify-write without guarding.
**How to avoid:** Include `eq("reschedule_token_hash", oldHash)` in the UPDATE's WHERE clause. The first UPDATE matches and rotates. The second UPDATE finds the hash already changed → returns no rows → "no longer active" page.

### Pitfall 7: In-Memory Rate Limiting on Vercel Hobby
**What goes wrong:** Per-instance in-memory rate limiting fails under any load because Vercel spawns multiple Lambda instances and each has its own counter. IP that hits instance A fills A's counter; instance B sees 0 requests from that IP.
**Why it happens:** Serverless functions have no shared memory across instances.
**How to avoid:** Use the Postgres `rate_limit_events` table approach. Adds ~one DB round-trip per request to the token endpoints (acceptable — these are not high-frequency routes).

---

## Rate-Limit Storage Backend Decision

### Option A: Upstash Redis
**Pros:** Redis is purpose-built for counters; atomic INCRBY + EXPIRE; sub-millisecond; no table pollution.
**Cons:**
- Requires a new external dependency (`@upstash/ratelimit`, `@upstash/redis`).
- Requires an Upstash account + environment variables (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
- Upstash free tier: 10,000 commands/day. At 10 req/5min, this is consumed by ~1,000 token endpoint hits/day — fine for a single-owner app.
- However: adds a new external service to manage, monitor, and credential-rotate.

### Option B: In-Memory
**Rejected outright.** Per-Vercel-instance state. Fails as soon as >1 Lambda instance is running. Provides no real protection.

### Option C: Postgres-Backed (RECOMMENDED)
**Pros:**
- Zero new dependencies or accounts.
- Consistent across all Vercel instances (single DB).
- Supabase free tier handles the load easily (these endpoints get very low traffic on a single-owner app).
- Same admin client pattern already established.
- Simple cleanup: rows are tiny; accumulated rows for 10 req/5min = ~120 rows/hour max.

**Cons:**
- Adds ~1 extra DB round-trip per token endpoint hit (count + insert).
- Not atomic (count-then-insert has a small race window where >10 requests could sneak through concurrently). For a 10-req/5min threshold on a personal scheduling app, this is acceptable — the goal is abuse prevention, not cryptographic enforcement.

**Verdict: Use Postgres.** Andrew is on Vercel hobby tier with no existing Redis. Adding Upstash for this use case adds operational overhead disproportionate to the problem (single-owner app, low traffic). The Postgres approach is simpler, cheaper, and uses established project patterns.

---

## Code Examples

### Canonical Token Lookup (both cancel + reschedule)
```typescript
// Source: lib/bookings/tokens.ts (Phase 5, verified)
const hash = await hashToken(rawTokenFromUrl);
const { data: booking } = await supabase
  .from("bookings")
  .select("id, account_id, event_type_id, start_at, end_at, booker_name, booker_email, booker_timezone, status")
  .eq("cancel_token_hash", hash)   // or reschedule_token_hash
  .maybeSingle();

// Validity check (CONTEXT.md decision: status='confirmed' AND start_at > now())
const isValid =
  booking &&
  booking.status === "confirmed" &&
  new Date(booking.start_at) > new Date();
```

### Atomic Cancel UPDATE with Dead-Hash Invalidation
```typescript
// Source: derived from Phase 1 schema + Phase 5 patterns
const deadCancel = await hashToken(crypto.randomUUID());
const deadReschedule = await hashToken(crypto.randomUUID());

const { data, error } = await supabase
  .from("bookings")
  .update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancelled_by: actor,
    cancel_token_hash: deadCancel,
    reschedule_token_hash: deadReschedule,
  })
  .eq("id", bookingId)
  .eq("status", "confirmed")
  .gt("start_at", new Date().toISOString())
  .select("id, start_at, end_at, booker_name, booker_email, booker_timezone, answers")
  .single();

// error?.code === "PGRST116" → no rows matched → already cancelled/rescheduled
```

### Atomic Reschedule UPDATE with Token Rotation
```typescript
// Source: derived from Phase 1 schema + Phase 5 token patterns
const { rawCancel, rawReschedule, hashCancel, hashReschedule } =
  await generateBookingTokens();

const { data, error } = await supabase
  .from("bookings")
  .update({
    start_at: newStartAt,
    end_at: newEndAt,
    cancel_token_hash: hashCancel,
    reschedule_token_hash: hashReschedule,
    // status stays 'confirmed'
  })
  .eq("id", bookingId)
  .eq("status", "confirmed")
  .eq("reschedule_token_hash", oldRescheduleHash)   // CAS guard
  .gt("start_at", new Date().toISOString())
  .select("id, start_at, end_at, booker_name, booker_email, booker_timezone, answers")
  .single();

// error?.code === "23505" → new slot taken → 409 slot-taken
// error?.code === "PGRST116" → CAS failed → "no longer active"
// data exists → success; rawCancel + rawReschedule go to email only
```

### METHOD:CANCEL .ics
```typescript
// Source: verified against node_modules/ical-generator/src/calendar.ts + event.ts
import ical, { ICalCalendarMethod, ICalEventStatus } from "ical-generator";
import { tzlib_get_ical_block } from "timezones-ical-library";

const cal = ical({ name: eventTypeName });
cal.method(ICalCalendarMethod.CANCEL);   // ICalCalendarMethod.CANCEL = 'CANCEL' (confirmed)
cal.timezone({
  name: timezone,
  generator: (tz) => tzlib_get_ical_block(tz)[0],
});
cal
  .createEvent({
    id:       bookingId,                      // MUST equal original booking.id
    summary:  eventTypeName,
    start:    new Date(startAt),
    end:      new Date(endAt),
    timezone: timezone,
    status:   ICalEventStatus.CANCELLED,      // ICalEventStatus.CANCELLED confirmed in source
    organizer: { name: ownerName, email: ownerEmail },
  })
  .sequence(1)                                // MUST set manually — library defaults to 0
  .createAttendee({ email: bookerEmail, name: bookerName, rsvp: true });

const buffer = Buffer.from(cal.toString(), "utf-8");
// Attach with contentType: "text/calendar; method=CANCEL"
```

### AlertDialog Pattern for Owner Cancel (from Phase 3 delete-confirm-dialog.tsx)
```typescript
// Source: app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx (verified)
// The owner cancel modal follows the same structure:
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTransition } from "react";

// Pattern: open/onOpenChange controlled externally; useTransition for async action
const [isPending, startTransition] = useTransition();

function handleConfirm() {
  startTransition(async () => {
    const result = await cancelBookingAction(bookingId, reason || undefined);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Booking cancelled.");
      onOpenChange(false);
      router.refresh();
    }
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MD5 or base64 token storage | SHA-256 hex in DB; raw only in email | Phase 5 (2026-04-25) | Established; Phase 6 must follow same pattern |
| Server Actions for mutations | Route Handlers for public mutations with custom status codes | Phase 5 (established) | Public cancel/reschedule must be Route Handlers |
| `crypto.createHash("sha256")` (Node-only) | `crypto.subtle.digest("SHA-256", ...)` (Web Crypto) | Phase 5 (established) | Maintain; Edge-runtime compatible |
| METHOD:PUBLISH .ics (no calendar update) | METHOD:REQUEST same UID for reschedule | Phase 5 (established) | Reschedule reuses this; cancel needs METHOD:CANCEL |

---

## Open Questions

1. **Should `build-ics.ts` be extended or a new `build-cancel-ics.ts` be created?**
   - What we know: `buildIcsBuffer()` always sets `METHOD:REQUEST`. Adding METHOD as a parameter and `sequence` as a parameter would make it handle both cases.
   - What's unclear: Whether the planner prefers extending vs a separate function for clarity.
   - Recommendation: Extend `buildIcsBuffer()` — add optional `method?: ICalCalendarMethod` (default `REQUEST`) and optional `sequence?: number` (default 0). Minimal diff; avoids duplicating VTIMEZONE setup.

2. **Cancel + reschedule success screens: reuse confirmed route shell or own routes?**
   - What we know: Phase 5's `confirmed/[booking-id]` page already handles `status !== 'confirmed'` with a graceful fallback. After a cancel, the booking ID is still valid but status is `cancelled`.
   - Recommendation: New routes at `/cancel/[token]/success` and `/reschedule/[token]/success` (or redirect to the confirmed page with the booking ID after success). The confirmed page renders "no longer active" after cancel which is close to what we want. However, the CONTEXT.md decision requires a "Book again" CTA on cancel-success — the confirmed page doesn't have that. Use dedicated success routes for cleaner separation.

3. **Supabase RLS for the new booking detail dashboard route**
   - What we know: Phase 8 owns the bookings list page. Phase 6 needs a bookings detail page at `/app/bookings/[id]` for the owner cancel button. The detail route is owner-authenticated, so the standard `createClient()` (RLS-scoped) is correct for reading the booking.
   - The booking detail page does NOT exist yet — it must be created in Phase 6.

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260419120000_initial_schema.sql` — full bookings table schema, all column names, enum values, indexes, booking_events table
- `supabase/migrations/20260419120001_rls_policies.sql` — RLS policies, confirmed no anon policies on bookings
- `lib/bookings/tokens.ts` — hashToken, generateBookingTokens, Web Crypto API usage
- `lib/email/build-ics.ts` — BuildIcsOptions interface, buildIcsBuffer(), existing METHOD:REQUEST pattern, UID=booking.id convention
- `lib/email/send-booking-confirmation.ts` — rawCancelToken + rawRescheduleToken usage, URL format `${appUrl}/cancel/${rawToken}`
- `lib/email/send-booking-emails.ts` — fire-and-forget pattern, Promise.allSettled
- `lib/email-sender/index.ts` + `types.ts` — sendEmail() API, EmailOptions interface including attachments
- `app/[account]/[event-slug]/_components/slot-picker.tsx` — SlotPickerProps interface (all props), no modification needed
- `app/[account]/[event-slug]/_components/booking-shell.tsx` — how SlotPicker is orchestrated, state management pattern
- `app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx` — AlertDialog pattern for owner modal
- `app/(shell)/app/event-types/_lib/actions.ts` — Server Action pattern, useTransition integration, RLS client for owner auth
- `components/ui/alert-dialog.tsx` — AlertDialog component confirmed installed
- `components/ui/textarea.tsx` — Textarea confirmed installed
- `app/api/bookings/route.ts` — Route Handler pattern, 23505 handling, NO_STORE headers, service-role pattern
- `node_modules/ical-generator/src/calendar.ts` — ICalCalendarMethod enum (confirmed CANCEL='CANCEL')
- `node_modules/ical-generator/src/event.ts` — sequence field (default 0, manual setter only), ICalEventStatus.CANCELLED confirmed
- `.planning/phases/01-foundation/01-PLAN-02-schema-migrations.md` — booking_status enum exactly 3 values confirmed
- `.planning/phases/05-public-booking-flow/05-PLAN-05-bookings-api-route-handler.md` — 23505 pattern, fire-and-forget pattern, PGRST116 not mentioned (Phase 6 must handle)
- `.planning/phases/05-public-booking-flow/05-VERIFICATION.md` — 54/54 tests passing, confirmed architecture

### Secondary (MEDIUM confidence)
- RFC 5546 §3.2.2 — SEQUENCE must increment on updates (standard iCalendar scheduling rule; library defaults to 0; must set manually)
- Gmail/Outlook link prefetch behavior — well-documented industry knowledge; 2-step confirm is the standard defense

---

## Metadata

**Confidence breakdown:**
- Schema delta: HIGH — verified directly against migration files; no new bookings columns needed
- Token lookup + validation: HIGH — hashToken exists and is tested; lookup-by-hash pattern established
- Atomic cancel UPDATE: HIGH — derived directly from Phase 5 23505 pattern + Phase 1 schema
- Atomic reschedule UPDATE: HIGH — same; 23505 fires on UPDATE as well as INSERT (Postgres behavior)
- Token invalidation (dead hash): HIGH — NOT NULL constraint confirmed from schema; dead hash strategy is the only option
- ical-generator METHOD:CANCEL: HIGH — verified against source in node_modules
- SEQUENCE field handling: HIGH — verified: defaults 0, not auto-incremented, must call `.sequence(1)` manually
- SlotPicker reuse: HIGH — full props interface verified from source
- AlertDialog pattern: HIGH — existing usage in Phase 3 delete dialog verified
- Rate-limit backend recommendation: MEDIUM — Postgres approach is architecturally sound but practical load behavior at hobby tier not tested; Upstash remains a valid alternative if the DB round-trip latency proves problematic

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable libraries, slow-moving domain)
