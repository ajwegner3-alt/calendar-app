---
phase: 06-cancel-and-reschedule-lifecycle
plan: 02
type: execute
wave: 2
depends_on: ["06-01"]
files_modified:
  - lib/email/build-ics.ts
  - lib/email/send-cancel-emails.ts
  - lib/email/send-reschedule-emails.ts
  - lib/rate-limit.ts
autonomous: true

must_haves:
  truths:
    - "buildIcsBuffer() accepts optional method?: ICalCalendarMethod (default REQUEST) and optional sequence?: number (default 0) — extending the existing function instead of creating a parallel one (Open Question A: EXTEND, avoids duplicating VTIMEZONE setup)"
    - "buildIcsBuffer() with method=ICalCalendarMethod.CANCEL also sets event.status(ICalEventStatus.CANCELLED) — RESEARCH §Pattern 6 (calendar clients use both METHOD:CANCEL and STATUS:CANCELLED to identify and remove the event)"
    - "buildIcsBuffer() calls .sequence(opts.sequence ?? 0) explicitly — ical-generator v10 defaults to 0 and does NOT auto-increment (RESEARCH Pitfall 2: verified in node_modules/ical-generator/src/event.ts)"
    - "Phase 5 callers continue to work unchanged — both new params are optional with backward-compatible defaults (sequence=0, method=REQUEST). Plan 05-03's send-booking-confirmation.ts is NOT edited."
    - "sendCancelEmails(args) sends BOTH booker + owner cancellation emails regardless of who triggered (CONTEXT decision: cancellation symmetric notification)"
    - "sendCancelEmails uses fire-and-forget Promise.allSettled pattern (mirrors lib/email/send-booking-emails.ts; Phase 5 lock)"
    - "Booker cancellation email subject: 'Booking cancelled: [event name]'; body confirms cancellation, shows former date/time in BOOKER timezone, includes 'Book again' CTA → ${appUrl}/[account-slug]/[event-slug] (CONTEXT decision: re-book CTA on cancel)"
    - "Owner cancellation email subject: 'Booking cancelled: [booker name] — [event] on [date]'; body shows booker details + cancellation reason as a prominent callout when reason is non-empty (CONTEXT decision: omit reason row entirely when empty, no 'Reason: (none)' empty cell)"
    - "Owner-cancel branch: when actor='owner', booker cancellation email copy is APOLOGETIC + includes re-book link (CONTEXT decision: 'Owner had to cancel your appointment for [time]. We apologize for the inconvenience. Book another time: [link].')"
    - "Both cancellation emails attach METHOD:CANCEL .ics built via buildIcsBuffer({ method: ICalCalendarMethod.CANCEL, sequence: 1, uid: booking.id, ... }) — same UID as original booking, sequence=1 (RFC 5546: increment on update)"
    - "Cancellation .ics attachment contentType: 'text/calendar; method=CANCEL' (mirrors Phase 5 'method=REQUEST' pattern)"
    - "sendRescheduleEmails(args) sends ONE 'rescheduled' email per party (booker + owner). Subject pattern: 'Booking rescheduled: [event name]' (CONTEXT decision)"
    - "Reschedule email body shows OLD time → NEW time clearly, both in recipient's timezone (booker email uses booker_timezone; owner email uses account.timezone)"
    - "Reschedule .ics is METHOD:REQUEST with same UID as original booking + sequence=1 + the NEW startAt/endAt (RESEARCH §Pattern 7: calendar apps update existing event in place — no orphan events)"
    - "Reschedule .ics contentType: 'text/calendar; method=REQUEST' (same as original confirmation)"
    - "Both new email senders DO NOT pass explicit `from` field — sendEmail singleton constructs defaultFrom from GMAIL_USER (Phase 5 lock; passing from breaks Gmail SMTP auth)"
    - "Both new senders use HTML email templates that escape user-supplied strings via the same escapeHtml() pattern as send-booking-confirmation.ts (XSS defense)"
    - "lib/rate-limit.ts exports checkRateLimit(key, maxRequests, windowMs) returning { allowed: boolean; retryAfterSeconds: number; current: number } — RESEARCH §Pattern 5"
    - "checkRateLimit counts rate_limit_events rows WHERE key=? AND occurred_at >= now() - windowMs; if count >= maxRequests, returns { allowed: false, retryAfterSeconds: ceil(windowMs/1000) } and DOES NOT insert"
    - "checkRateLimit, when allowed, INSERTs a new event row {key, occurred_at: now()} BEFORE returning — caller pattern is single call per request"
    - "checkRateLimit uses createAdminClient() (service-role) — Plan 06-01 confirmed RLS NOT enabled on rate_limit_events; admin client only"
    - "lib/rate-limit.ts file starts with `import 'server-only'` line 1 (admin-client gate; Phase 5 lock)"
    - "DEFAULT_TOKEN_RATE_LIMIT exported constant: { maxRequests: 10, windowMs: 5 * 60 * 1000 } — matches CONTEXT decision threshold (10 req / IP / 5 min)"
  artifacts:
    - path: "lib/email/build-ics.ts"
      provides: "Extended iCalendar builder with optional method + sequence params"
      contains: "method\\?: ICalCalendarMethod"
      exports: ["buildIcsBuffer", "BuildIcsOptions"]
      min_lines: 90
    - path: "lib/email/send-cancel-emails.ts"
      provides: "Fire-and-forget cancellation notification orchestrator (booker + owner)"
      contains: "sendCancelEmails"
      exports: ["sendCancelEmails", "SendCancelEmailsArgs"]
      min_lines: 180
    - path: "lib/email/send-reschedule-emails.ts"
      provides: "Fire-and-forget reschedule notification orchestrator (booker + owner)"
      contains: "sendRescheduleEmails"
      exports: ["sendRescheduleEmails", "SendRescheduleEmailsArgs"]
      min_lines: 200
    - path: "lib/rate-limit.ts"
      provides: "Postgres-backed sliding-window rate limiter"
      contains: "checkRateLimit"
      exports: ["checkRateLimit", "DEFAULT_TOKEN_RATE_LIMIT"]
      min_lines: 60
  key_links:
    - from: "lib/email/build-ics.ts"
      to: "ical-generator ICalCalendarMethod + ICalEventStatus"
      via: "import { ICalCalendarMethod, ICalEventStatus } from 'ical-generator'"
      pattern: "ICalEventStatus.CANCELLED"
    - from: "lib/email/send-cancel-emails.ts"
      to: "lib/email/build-ics.ts"
      via: "buildIcsBuffer({ method: ICalCalendarMethod.CANCEL, sequence: 1, ... })"
      pattern: "method:.*CANCEL"
    - from: "lib/email/send-cancel-emails.ts"
      to: "lib/email-sender"
      via: "sendEmail({ to, subject, html, attachments }) — no explicit from"
      pattern: "sendEmail"
    - from: "lib/email/send-reschedule-emails.ts"
      to: "lib/email/build-ics.ts"
      via: "buildIcsBuffer({ method: ICalCalendarMethod.REQUEST, sequence: 1, ... }) (same UID as original)"
      pattern: "sequence:.*1"
    - from: "lib/rate-limit.ts"
      to: "rate_limit_events table (Plan 06-01)"
      via: "createAdminClient().from('rate_limit_events').select(count).insert({key})"
      pattern: "rate_limit_events"
---

<objective>
Build the four shared utility modules Phase 6 needs before any business logic or routes can be wired:

1. Extend `buildIcsBuffer()` to support METHOD:CANCEL and a manually-set SEQUENCE field (Open Question A resolved: EXTEND the existing function — avoids duplicating ~30 lines of VTIMEZONE setup; Phase 5 callers stay unchanged thanks to optional params with backward-compatible defaults).
2. Create `sendCancelEmails()` — fire-and-forget orchestrator that emails BOTH booker and owner with a METHOD:CANCEL .ics on every cancellation regardless of actor (CONTEXT lock).
3. Create `sendRescheduleEmails()` — fire-and-forget orchestrator that emails BOTH parties a "rescheduled" notification with a METHOD:REQUEST .ics (same UID, SEQUENCE=1, new times).
4. Create `lib/rate-limit.ts` — Postgres-backed sliding-window rate limiter using the `rate_limit_events` table from Plan 06-01.

Purpose: EMAIL-06 + EMAIL-07 (booker + owner cancellation/reschedule notifications); LIFE-04 (rate-limit cancel endpoint); foundation for Plans 06-03 (shared cancel/reschedule functions) and 06-04 (public token routes).

Output: 4 files; 1 file extended (build-ics.ts); 3 files created (send-cancel-emails.ts, send-reschedule-emails.ts, lib/rate-limit.ts). No business logic — these are pure utility modules. `npm run build` + `npm run lint` exit 0.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-CONTEXT.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-RESEARCH.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-01-SUMMARY.md

# The function we're extending (Phase 5 lock — must not break)
@lib/email/build-ics.ts

# Pattern reference: existing fire-and-forget orchestrator (mirror this exact shape)
@lib/email/send-booking-emails.ts

# Pattern reference: existing email sender (HTML template, escapeHtml, sendEmail call shape)
@lib/email/send-booking-confirmation.ts

# Service-role client (rate-limit + cancel/reschedule shared funcs use this)
@lib/supabase/admin.ts

# Phase 5 owner notification (callout block + table layout pattern to mirror)
@lib/email/send-owner-notification.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend buildIcsBuffer with optional method + sequence params</name>
  <files>lib/email/build-ics.ts</files>
  <action>
Edit `lib/email/build-ics.ts` to accept two new optional fields on `BuildIcsOptions`:
- `method?: ICalCalendarMethod` — defaults to `ICalCalendarMethod.REQUEST` (Phase 5 behavior preserved)
- `sequence?: number` — defaults to `0` (ical-generator's library default; matches Phase 5 .ics output exactly)

When `method === ICalCalendarMethod.CANCEL`, also set the event status to `ICalEventStatus.CANCELLED` (RESEARCH §Pattern 6: calendar clients use both METHOD:CANCEL and STATUS:CANCELLED to identify cancelled events).

Always call `.sequence(opts.sequence ?? 0)` on the event — explicit pass-through is required because ical-generator v10 does NOT auto-increment between createEvent calls (RESEARCH Pitfall 2: verified in `node_modules/ical-generator/src/event.ts`).

The full updated file (replace contents):

```typescript
import "server-only";
import ical, { ICalCalendarMethod, ICalEventStatus } from "ical-generator";
import { tzlib_get_ical_block } from "timezones-ical-library";

export interface BuildIcsOptions {
  /** Stable identifier — MUST equal booking.id (Postgres UUID).
   *  Phase 6 reschedule sends the same UID with SEQUENCE:1 to update the
   *  existing calendar event. Phase 6 cancel sends the same UID with
   *  METHOD:CANCEL + STATUS:CANCELLED to remove it. Never pass crypto.randomUUID() here. */
  uid: string;
  /** Event title — typically event_type.name */
  summary: string;
  /** Optional plain-text description (event_type.description or null/undefined) */
  description?: string;
  /** Booking start time as UTC Date from DB timestamptz */
  startAt: Date;
  /** Booking end time as UTC Date from DB timestamptz */
  endAt: Date;
  /** IANA timezone for the owner's locale, e.g. "America/Chicago".
   *  The VTIMEZONE block uses this zone so calendar clients localize naturally.
   *  Booker confirmation email formats times in BOOKER timezone separately. */
  timezone: string;
  /** Display name for ORGANIZER field (account.name) */
  organizerName: string;
  /** Email for ORGANIZER field (account.owner_email) */
  organizerEmail: string;
  /** Booker email — added as ATTENDEE with RSVP=TRUE */
  attendeeEmail: string;
  /** Booker display name */
  attendeeName: string;
  /** iCalendar METHOD field. Defaults to REQUEST (Phase 5 confirmation + Phase 6 reschedule).
   *  Use CANCEL for Phase 6 cancellation .ics — calendar clients then remove the event
   *  matched by UID. */
  method?: ICalCalendarMethod;
  /** SEQUENCE field. Defaults to 0 (matches Phase 5 confirmation behavior).
   *  Phase 6 reschedule + cancel MUST pass 1 — RFC 5546 requires SEQUENCE to
   *  increment on update. ical-generator v10 does NOT auto-increment between
   *  createEvent() calls (verified in node_modules/ical-generator/src/event.ts). */
  sequence?: number;
}

/**
 * Build an RFC 5545 iCalendar buffer.
 *
 * Phase 5 default behavior (METHOD:REQUEST, SEQUENCE:0) is preserved when the
 * new optional params are omitted — backward-compatible extension.
 *
 * Phase 6 use cases:
 *   - Cancellation .ics: { method: ICalCalendarMethod.CANCEL, sequence: 1 }
 *     → also sets event STATUS:CANCELLED so calendar clients remove the event.
 *   - Reschedule .ics: { method: ICalCalendarMethod.REQUEST, sequence: 1, ...new times }
 *     → calendar clients UPDATE the existing event (same UID).
 *
 * Correctness invariants (RESEARCH Pitfalls 2, 3, 4):
 *   - METHOD:REQUEST/CANCEL  → Gmail/Outlook show inline calendar card / removal hint
 *   - VTIMEZONE block         → no floating times; calendar clients localize correctly
 *   - UID == booking.id       → Phase 6 reschedule + cancel target the same event
 *   - SEQUENCE:1 on updates   → calendar clients accept the modification
 *   - STATUS:CANCELLED on CANCEL → belt-and-suspenders for non-iTIP clients
 *
 * ical-generator handles CRLF line endings, 75-octet line folding, and UTC
 * DTSTAMP automatically — do NOT hand-roll these (RFC 5545 trap).
 */
export function buildIcsBuffer(opts: BuildIcsOptions): Buffer {
  const cal = ical({ name: opts.summary });

  const method = opts.method ?? ICalCalendarMethod.REQUEST;
  cal.method(method);

  // VTIMEZONE block via timezones-ical-library generator.
  // tzlib_get_ical_block(tz) returns an array; [0] is the requested zone block.
  // This must be set BEFORE createEvent() to ensure correct VTIMEZONE embedding.
  cal.timezone({
    name: opts.timezone,
    generator: (tz) => tzlib_get_ical_block(tz)[0],
  });

  const event = cal.createEvent({
    id:          opts.uid,    // ICalEventData field name is `id`, not `uid`
    summary:     opts.summary,
    description: opts.description,
    start:       opts.startAt,
    end:         opts.endAt,
    timezone:    opts.timezone,
    organizer: {
      name:  opts.organizerName,
      email: opts.organizerEmail,
    },
  });

  // SEQUENCE: explicit pass-through — library defaults to 0 and does NOT auto-increment
  // between createEvent calls (RESEARCH Pitfall 2: verified in node_modules/ical-generator/src/event.ts).
  event.sequence(opts.sequence ?? 0);

  // STATUS:CANCELLED on cancellation .ics — paired with METHOD:CANCEL for max
  // calendar client compatibility (RESEARCH §Pattern 6).
  if (method === ICalCalendarMethod.CANCEL) {
    event.status(ICalEventStatus.CANCELLED);
  }

  event.createAttendee({
    email: opts.attendeeEmail,
    name:  opts.attendeeName,
    rsvp:  true,
  });

  return Buffer.from(cal.toString(), "utf-8");
}
```

DO NOT:
- Do NOT remove or reorder existing fields on `BuildIcsOptions` — Plan 05-03's `send-booking-confirmation.ts` calls this function with the existing field order. Adding new optional fields at the END is safe; reordering is not.
- Do NOT make `method` or `sequence` required — Phase 5 callers will break.
- Do NOT default `sequence` to 1 — Phase 5 confirmation .ics is SEQUENCE:0 (library default behavior); changing the default would orphan existing calendar imports.
- Do NOT add a separate `buildCancelIcsBuffer()` function — Open Question A resolved as EXTEND. A separate function would duplicate ~30 lines of VTIMEZONE setup with zero added clarity.
- Do NOT call `.sequence()` only when `opts.sequence !== undefined` — always call it with `(opts.sequence ?? 0)`. The library defaults sequence to 0 internally too, so this is a no-op for Phase 5 but a defensive guarantee that the SEQUENCE field is always set explicitly.
- Do NOT set `event.status(ICalEventStatus.CONFIRMED)` for the REQUEST path — calendar clients infer confirmed status from the absence of STATUS or from STATUS:CONFIRMED, but ical-generator's default is to omit STATUS for REQUEST events. Mirror Phase 5 (no status set on REQUEST path).
  </action>
  <verify>
```bash
ls "lib/email/build-ics.ts"

# New optional params present
grep -q "method\?: ICalCalendarMethod" "lib/email/build-ics.ts" && echo "method param ok"
grep -q "sequence\?: number" "lib/email/build-ics.ts" && echo "sequence param ok"

# Backward-compatible defaults present
grep -q "opts.method ?? ICalCalendarMethod.REQUEST" "lib/email/build-ics.ts" && echo "method default REQUEST"
grep -q "opts.sequence ?? 0" "lib/email/build-ics.ts" && echo "sequence default 0"

# Cancel branch: STATUS:CANCELLED set
grep -q "ICalEventStatus.CANCELLED" "lib/email/build-ics.ts" && echo "STATUS:CANCELLED branch present"
grep -q "method === ICalCalendarMethod.CANCEL" "lib/email/build-ics.ts" && echo "cancel branch guarded correctly"

# ICalEventStatus is imported alongside ICalCalendarMethod
grep -q "import ical, { ICalCalendarMethod, ICalEventStatus }" "lib/email/build-ics.ts" && echo "imports ok"

# Phase 5 callers must continue to compile
grep -rn "buildIcsBuffer" lib/ app/ tests/ 2>/dev/null | grep -v build-ics.ts | head -5

npm run build
npm run lint
```
  </verify>
  <done>
`lib/email/build-ics.ts` accepts new optional `method` + `sequence` params with backward-compatible defaults. `ICalEventStatus.CANCELLED` is imported and set on the event when `method === CANCEL`. Phase 5's `send-booking-confirmation.ts` continues to compile and produce identical .ics output. `npm run build` + `npm run lint` exit 0.

Commit: `feat(06-02): extend buildIcsBuffer with optional method + sequence for Phase 6 cancel/reschedule .ics`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create lib/rate-limit.ts (Postgres-backed sliding window)</name>
  <files>lib/rate-limit.ts</files>
  <action>
Create the rate limiter module. Single exported function `checkRateLimit` + a default config constant. Uses the `rate_limit_events` table from Plan 06-01 via `createAdminClient()` (service-role; Plan 06-01 confirmed RLS not enabled).

```typescript
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
```

DO NOT:
- Do NOT use `process.memoryUsage()` or any in-memory store. RESEARCH Pitfall 7 + §Rate-Limit Storage Backend Decision: in-memory state is per-Vercel-instance and breaks under any meaningful load.
- Do NOT add Upstash Redis — not installed; CONTEXT explicitly delegates the choice to research; research recommends Postgres.
- Do NOT fail CLOSED on DB errors. A transient Supabase hiccup that locks every cancel/reschedule attempt is worse than a single missed enumeration check. Log + allow.
- Do NOT add a `key UNIQUE` constraint at the schema level (Plan 06-01 already declines this — concurrent inserts at the same millisecond from the same IP must both record).
- Do NOT include a `userId` or `accountId` arg. The whole point is per-IP throttling for unauthenticated public endpoints.
- Do NOT call `Date.now()` inside the SELECT query (e.g. via Supabase's filter helpers). Compute `windowStart` once at the start of the function so the window is consistent across the count and (potentially) future ops in the same call.
- Do NOT use `import type` for `createAdminClient` — it's a runtime import (we call the function).
  </action>
  <verify>
```bash
ls "lib/rate-limit.ts"

# server-only line 1
head -1 "lib/rate-limit.ts" | grep -q 'import "server-only"' && echo "server-only ok"

# Exports present
grep -q "export async function checkRateLimit" "lib/rate-limit.ts" && echo "checkRateLimit exported"
grep -q "export const DEFAULT_TOKEN_RATE_LIMIT" "lib/rate-limit.ts" && echo "default config exported"
grep -q "maxRequests: 10" "lib/rate-limit.ts" && echo "10 req threshold ok"
grep -q "5 \* 60 \* 1000" "lib/rate-limit.ts" && echo "5-min window ok"

# Service-role usage
grep -q "createAdminClient" "lib/rate-limit.ts" && echo "admin client used"
grep -q "rate_limit_events" "lib/rate-limit.ts" && echo "table referenced"

# Sliding-window count + insert pattern
grep -q "count: \"exact\", head: true" "lib/rate-limit.ts" && echo "count query ok"
grep -q "\.gte(\"occurred_at\"" "lib/rate-limit.ts" && echo "window filter ok"
grep -q "\.insert({ key })" "lib/rate-limit.ts" && echo "insert pattern ok"

npm run build
npm run lint
```
  </verify>
  <done>
`lib/rate-limit.ts` exists; exports `checkRateLimit(key, maxRequests, windowMs)` and `DEFAULT_TOKEN_RATE_LIMIT = { maxRequests: 10, windowMs: 5*60*1000 }`. Uses `createAdminClient()` against `rate_limit_events`. Fails open on DB error. `import "server-only"` line 1. Build + lint pass.

Commit: `feat(06-02): add Postgres-backed sliding-window rate limiter (lib/rate-limit.ts)`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create cancel + reschedule email senders (both senders + their orchestrators in one file each)</name>
  <files>lib/email/send-cancel-emails.ts,lib/email/send-reschedule-emails.ts</files>
  <action>
Create TWO files. Each file exports ONE orchestrator function that internally sends BOTH the booker email and the owner email via `Promise.allSettled` — same shape as the existing `lib/email/send-booking-emails.ts` orchestrator (Phase 5 lock).

Pattern reference: `lib/email/send-booking-confirmation.ts` (HTML template, escapeHtml, sendEmail call shape, .ics attachment). DO NOT pass an explicit `from` field — `sendEmail` singleton constructs `defaultFrom` from `GMAIL_USER` (Phase 5 lock; passing `from` breaks Gmail SMTP auth).

### File 1: `lib/email/send-cancel-emails.ts`

```typescript
import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ICalCalendarMethod } from "ical-generator";
import { sendEmail } from "@/lib/email-sender";
import { buildIcsBuffer } from "@/lib/email/build-ics";

interface BookingRecord {
  id: string;
  start_at: string;        // ISO UTC
  end_at: string;          // ISO UTC
  booker_name: string;
  booker_email: string;
  booker_phone: string | null;
  booker_timezone: string; // IANA
  answers: Record<string, string>;
}

interface EventTypeRecord {
  name: string;
  description: string | null;
  duration_minutes: number;
  slug: string;            // for "Book again" CTA URL
}

interface AccountRecord {
  name: string;
  slug: string;            // for "Book again" CTA URL
  timezone: string;        // IANA — used for owner email times + .ics ORGANIZER tz
  owner_email: string | null;
}

export interface SendCancelEmailsArgs {
  booking: BookingRecord;
  eventType: EventTypeRecord;
  account: AccountRecord;
  /** Who triggered the cancel — controls booker email tone (CONTEXT decision). */
  actor: "booker" | "owner";
  /** Optional cancellation reason text. When non-empty:
   *    - actor='booker': surfaced PROMINENTLY in owner notification (callout block)
   *    - actor='owner':  surfaced PROMINENTLY in booker apology email
   *  Empty/undefined → omit the row entirely (NO "Reason: (none)" empty cells).
   */
  reason?: string;
  /** Base URL for "Book again" CTA. Caller resolves NEXT_PUBLIC_APP_URL. */
  appUrl: string;
}

/**
 * Fire-and-forget orchestrator for cancellation emails (CONTEXT lock: BOTH parties
 * always notified regardless of who triggered).
 *
 * MUST NOT throw — caller pattern is `void sendCancelEmails(...)` after the DB
 * cancel UPDATE succeeds. Errors are caught per-sender and logged.
 *
 * Subject patterns (CONTEXT decisions):
 *   - Booker: "Booking cancelled: [event name]"
 *   - Owner:  "Booking cancelled: [booker name] — [event] on [date]"
 *
 * Both emails include METHOD:CANCEL .ics (same UID as original booking, SEQUENCE:1)
 * so any calendar that imported the original event removes it.
 */
export async function sendCancelEmails(args: SendCancelEmailsArgs): Promise<void> {
  const tasks: Array<Promise<void>> = [
    sendBookerCancelEmail(args).catch((err: unknown) => {
      console.error("[cancel-emails] booker notification failed:", err);
    }),
    sendOwnerCancelEmail(args).catch((err: unknown) => {
      console.error("[cancel-emails] owner notification failed:", err);
    }),
  ];
  await Promise.allSettled(tasks);
}

async function sendBookerCancelEmail(args: SendCancelEmailsArgs): Promise<void> {
  const { booking, eventType, account, actor, reason, appUrl } = args;

  // Times rendered in BOOKER timezone (mirrors Phase 5 confirmation pattern)
  const startTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const dateLine = format(startTz, "EEEE, MMMM d, yyyy");
  const timeLine = format(startTz, "h:mm a (z)");

  const rebookUrl = `${appUrl}/${account.slug}/${eventType.slug}`;

  // Apology copy when owner cancelled (CONTEXT lock); confirmation copy when booker cancelled
  const intro = actor === "owner"
    ? `<p style="margin: 0 0 8px 0;">Hi ${escapeHtml(booking.booker_name)},</p>
       <p style="margin: 0 0 24px 0;"><strong>${escapeHtml(account.name)}</strong> had to cancel your appointment for ${dateLine} at ${timeLine}. We apologize for the inconvenience.</p>`
    : `<p style="margin: 0 0 8px 0;">Hi ${escapeHtml(booking.booker_name)},</p>
       <p style="margin: 0 0 24px 0;">Your appointment with <strong>${escapeHtml(account.name)}</strong> has been cancelled.</p>`;

  // Owner-cancel reason callout (only when reason is non-empty)
  const reasonBlock =
    actor === "owner" && reason && reason.trim().length > 0
      ? `<div style="background: #fff7ed; border-left: 3px solid #F97316; padding: 12px 16px; margin: 0 0 24px 0; border-radius: 4px;">
           <p style="margin: 0; font-size: 13px; color: #555;">Reason from ${escapeHtml(account.name)}:</p>
           <p style="margin: 4px 0 0 0; font-size: 14px;">${escapeHtml(reason)}</p>
         </div>`
      : "";

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">Appointment cancelled</h1>
  ${intro}
  ${reasonBlock}

  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">What:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Was scheduled for:</td>
      <td style="padding: 6px 0; vertical-align: top;">${dateLine}<br/>${timeLine}</td>
    </tr>
  </table>

  <p style="margin: 0 0 32px 0; font-size: 14px;">
    Need to book another time?
    <a href="${rebookUrl}" style="color: #0A2540; font-weight: 600;">Book again</a>
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 16px 0;"/>
  <p style="margin: 0; font-size: 12px; color: #888;">
    ${escapeHtml(account.name)}${account.owner_email ? " &nbsp;·&nbsp; " + escapeHtml(account.owner_email) : ""}
  </p>
</div>`;

  const organizerEmail = account.owner_email ?? "noreply@nsi.tools";

  // METHOD:CANCEL .ics with SEQUENCE:1 — same UID as original booking
  const icsBuffer = buildIcsBuffer({
    uid:           booking.id,
    summary:       eventType.name,
    description:   eventType.description ?? undefined,
    startAt:       new Date(booking.start_at),
    endAt:         new Date(booking.end_at),
    timezone:      account.timezone,
    organizerName: account.name,
    organizerEmail,
    attendeeEmail: booking.booker_email,
    attendeeName:  booking.booker_name,
    method:        ICalCalendarMethod.CANCEL,
    sequence:      1,
  });

  await sendEmail({
    to:      booking.booker_email,
    subject: `Booking cancelled: ${eventType.name}`,
    html,
    attachments: [
      {
        filename:    "cancelled.ics",
        content:     icsBuffer,
        contentType: "text/calendar; method=CANCEL",
      },
    ],
  });
}

async function sendOwnerCancelEmail(args: SendCancelEmailsArgs): Promise<void> {
  const { booking, eventType, account, actor, reason } = args;

  if (!account.owner_email) {
    // No owner email seeded → silently skip (Phase 5 pattern; email-sender doesn't crash)
    return;
  }

  // Times in OWNER (account) timezone
  const startTz  = new TZDate(new Date(booking.start_at), account.timezone);
  const dateLine = format(startTz, "EEEE, MMMM d, yyyy");
  const timeLine = format(startTz, "h:mm a (z)");
  const subjectDate = format(startTz, "MMM d, yyyy");

  // Booker-cancel reason callout (only when reason is non-empty)
  const reasonBlock =
    actor === "booker" && reason && reason.trim().length > 0
      ? `<div style="background: #fff7ed; border-left: 3px solid #F97316; padding: 12px 16px; margin: 0 0 24px 0; border-radius: 4px;">
           <p style="margin: 0; font-size: 13px; color: #555;">Reason from ${escapeHtml(booking.booker_name)}:</p>
           <p style="margin: 4px 0 0 0; font-size: 14px;">${escapeHtml(reason)}</p>
         </div>`
      : "";

  const triggeredBy = actor === "booker"
    ? `<strong>${escapeHtml(booking.booker_name)}</strong> cancelled their booking.`
    : `You cancelled this booking.`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">Booking cancelled</h1>
  <p style="margin: 0 0 24px 0;">${triggeredBy}</p>
  ${reasonBlock}

  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Event:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Was scheduled for:</td>
      <td style="padding: 6px 0; vertical-align: top;">${dateLine}<br/>${timeLine}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Booker:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(booking.booker_name)}<br/>${escapeHtml(booking.booker_email)}${booking.booker_phone ? "<br/>" + escapeHtml(booking.booker_phone) : ""}</td>
    </tr>
  </table>

  <p style="margin: 0; font-size: 12px; color: #888;">Booking ID: ${booking.id}</p>
</div>`;

  const organizerEmail = account.owner_email;

  const icsBuffer = buildIcsBuffer({
    uid:           booking.id,
    summary:       eventType.name,
    description:   eventType.description ?? undefined,
    startAt:       new Date(booking.start_at),
    endAt:         new Date(booking.end_at),
    timezone:      account.timezone,
    organizerName: account.name,
    organizerEmail,
    attendeeEmail: booking.booker_email,
    attendeeName:  booking.booker_name,
    method:        ICalCalendarMethod.CANCEL,
    sequence:      1,
  });

  await sendEmail({
    to:      account.owner_email,
    subject: `Booking cancelled: ${booking.booker_name} — ${eventType.name} on ${subjectDate}`,
    html,
    attachments: [
      {
        filename:    "cancelled.ics",
        content:     icsBuffer,
        contentType: "text/calendar; method=CANCEL",
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

### File 2: `lib/email/send-reschedule-emails.ts`

```typescript
import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ICalCalendarMethod } from "ical-generator";
import { sendEmail } from "@/lib/email-sender";
import { buildIcsBuffer } from "@/lib/email/build-ics";

interface BookingRecord {
  id: string;
  start_at: string;          // NEW start (post-reschedule, ISO UTC)
  end_at: string;            // NEW end   (post-reschedule, ISO UTC)
  booker_name: string;
  booker_email: string;
  booker_timezone: string;   // IANA
}

interface EventTypeRecord {
  name: string;
  description: string | null;
  duration_minutes: number;
}

interface AccountRecord {
  name: string;
  slug: string;
  timezone: string;          // IANA
  owner_email: string | null;
}

export interface SendRescheduleEmailsArgs {
  booking: BookingRecord;
  eventType: EventTypeRecord;
  account: AccountRecord;
  /** PREVIOUS slot — rendered as "Was: [old time]" in both emails (CONTEXT decision: show OLD → NEW) */
  oldStartAt: string;        // ISO UTC
  oldEndAt: string;          // ISO UTC
  /** Fresh raw cancel token for the NEW booking — Phase 6 token rotation;
   *  goes into the booker email's cancel link */
  rawCancelToken: string;
  /** Fresh raw reschedule token for the NEW booking */
  rawRescheduleToken: string;
  /** Base URL for cancel/reschedule links. Caller resolves NEXT_PUBLIC_APP_URL. */
  appUrl: string;
}

/**
 * Fire-and-forget orchestrator for reschedule emails (CONTEXT lock: ONE
 * "rescheduled" email per party — booker + owner).
 *
 * MUST NOT throw — caller pattern is `void sendRescheduleEmails(...)` after the
 * atomic reschedule UPDATE succeeds. Errors caught per-sender and logged.
 *
 * Subject pattern (CONTEXT decision): "Booking rescheduled: [event name]"
 *
 * Both emails attach METHOD:REQUEST .ics with SAME UID as original booking +
 * SEQUENCE:1 + NEW startAt/endAt — calendar clients UPDATE the existing event
 * in place (RESEARCH §Pattern 7: no orphan events).
 */
export async function sendRescheduleEmails(args: SendRescheduleEmailsArgs): Promise<void> {
  const tasks: Array<Promise<void>> = [
    sendBookerRescheduleEmail(args).catch((err: unknown) => {
      console.error("[reschedule-emails] booker notification failed:", err);
    }),
    sendOwnerRescheduleEmail(args).catch((err: unknown) => {
      console.error("[reschedule-emails] owner notification failed:", err);
    }),
  ];
  await Promise.allSettled(tasks);
}

async function sendBookerRescheduleEmail(args: SendRescheduleEmailsArgs): Promise<void> {
  const { booking, eventType, account, oldStartAt, oldEndAt, rawCancelToken, rawRescheduleToken, appUrl } = args;

  // Booker-tz formatting for both old and new
  const oldTz = new TZDate(new Date(oldStartAt), booking.booker_timezone);
  const newTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);

  const oldDate = format(oldTz, "EEEE, MMMM d, yyyy");
  const oldTime = format(oldTz, "h:mm a (z)");
  const newDate = format(newTz, "EEEE, MMMM d, yyyy");
  const newTime = format(newTz, "h:mm a (z)");

  const cancelUrl     = `${appUrl}/cancel/${rawCancelToken}`;
  const rescheduleUrl = `${appUrl}/reschedule/${rawRescheduleToken}`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">Your appointment was rescheduled</h1>
  <p style="margin: 0 0 8px 0;">Hi ${escapeHtml(booking.booker_name)},</p>
  <p style="margin: 0 0 24px 0;">Your appointment with <strong>${escapeHtml(account.name)}</strong> has been moved.</p>

  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">What:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #999; white-space: nowrap; vertical-align: top;"><s>Was:</s></td>
      <td style="padding: 6px 0; vertical-align: top; color: #999;"><s>${oldDate}<br/>${oldTime}</s></td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;"><strong>New time:</strong></td>
      <td style="padding: 6px 0; vertical-align: top;"><strong>${newDate}<br/>${newTime}</strong></td>
    </tr>
  </table>

  <p style="margin: 0 0 24px 0; color: #555; font-size: 14px;">
    An updated calendar invite (.ics) is attached — open it to update your calendar.
  </p>

  <p style="margin: 0 0 32px 0; font-size: 14px; color: #555;">
    Need to make another change?<br/>
    <a href="${rescheduleUrl}" style="color: #0A2540;">Reschedule</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="${cancelUrl}" style="color: #0A2540;">Cancel</a>
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 16px 0;"/>
  <p style="margin: 0; font-size: 12px; color: #888;">
    ${escapeHtml(account.name)}${account.owner_email ? " &nbsp;·&nbsp; " + escapeHtml(account.owner_email) : ""}
  </p>
</div>`;

  const organizerEmail = account.owner_email ?? "noreply@nsi.tools";

  const icsBuffer = buildIcsBuffer({
    uid:           booking.id,                     // SAME UID as original — calendar updates in place
    summary:       eventType.name,
    description:   eventType.description ?? undefined,
    startAt:       new Date(booking.start_at),    // NEW start
    endAt:         new Date(booking.end_at),      // NEW end
    timezone:      account.timezone,
    organizerName: account.name,
    organizerEmail,
    attendeeEmail: booking.booker_email,
    attendeeName:  booking.booker_name,
    method:        ICalCalendarMethod.REQUEST,
    sequence:      1,                              // RFC 5546: increment on update
  });

  await sendEmail({
    to:      booking.booker_email,
    subject: `Booking rescheduled: ${eventType.name}`,
    html,
    attachments: [
      {
        filename:    "invite.ics",
        content:     icsBuffer,
        contentType: "text/calendar; method=REQUEST",
      },
    ],
  });
}

async function sendOwnerRescheduleEmail(args: SendRescheduleEmailsArgs): Promise<void> {
  const { booking, eventType, account, oldStartAt } = args;

  if (!account.owner_email) {
    return; // no owner email seeded — skip
  }

  // Owner-tz formatting
  const oldTz = new TZDate(new Date(oldStartAt), account.timezone);
  const newTz = new TZDate(new Date(booking.start_at), account.timezone);

  const oldDate = format(oldTz, "EEEE, MMMM d, yyyy");
  const oldTime = format(oldTz, "h:mm a (z)");
  const newDate = format(newTz, "EEEE, MMMM d, yyyy");
  const newTime = format(newTz, "h:mm a (z)");
  const subjectDate = format(newTz, "MMM d, yyyy");

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">Booking rescheduled</h1>
  <p style="margin: 0 0 24px 0;"><strong>${escapeHtml(booking.booker_name)}</strong> rescheduled their booking.</p>

  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Event:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #999; white-space: nowrap; vertical-align: top;"><s>Was:</s></td>
      <td style="padding: 6px 0; vertical-align: top; color: #999;"><s>${oldDate}<br/>${oldTime}</s></td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;"><strong>New time:</strong></td>
      <td style="padding: 6px 0; vertical-align: top;"><strong>${newDate}<br/>${newTime}</strong></td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Booker:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(booking.booker_name)}<br/>${escapeHtml(booking.booker_email)}</td>
    </tr>
  </table>

  <p style="margin: 0; font-size: 12px; color: #888;">Booking ID: ${booking.id}</p>
</div>`;

  const organizerEmail = account.owner_email;

  const icsBuffer = buildIcsBuffer({
    uid:           booking.id,
    summary:       eventType.name,
    description:   eventType.description ?? undefined,
    startAt:       new Date(booking.start_at),
    endAt:         new Date(booking.end_at),
    timezone:      account.timezone,
    organizerName: account.name,
    organizerEmail,
    attendeeEmail: booking.booker_email,
    attendeeName:  booking.booker_name,
    method:        ICalCalendarMethod.REQUEST,
    sequence:      1,
  });

  await sendEmail({
    to:      account.owner_email,
    subject: `Booking rescheduled: ${booking.booker_name} — ${eventType.name} on ${subjectDate}`,
    html,
    attachments: [
      {
        filename:    "invite.ics",
        content:     icsBuffer,
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

DO NOT (both files):
- Do NOT pass an explicit `from` field to `sendEmail`. The Gmail-only sendEmail singleton constructs `defaultFrom` from `GMAIL_USER` (Phase 5 lock). Passing `from` breaks Gmail SMTP authentication.
- Do NOT use Phase 5's `sendBookingConfirmation` or `sendOwnerNotification` directly — the templates differ (cancellation vs confirmation copy; reschedule "Was → New" layout). Phase 5 senders stay untouched.
- Do NOT `await sendCancelEmails(...)` or `await sendRescheduleEmails(...)` from caller code — callers use `void sendCancelEmails(...)` (fire-and-forget). The orchestrators themselves use `await Promise.allSettled(...)` internally because they're already in a non-blocking context.
- Do NOT include the cancellation reason in the BOOKER cancel email when actor='booker' (the booker provided the reason — they don't need to see it back). The reason callout only renders for the OPPOSITE party of the trigger.
- Do NOT format owner-side email times in booker timezone — owner sees their own (account.timezone). Mirrors Phase 5 owner notification pattern.
- Do NOT add custom `replyTo` headers in cancel/reschedule emails. Phase 5's owner notification uses `replyTo: bookerEmail` for the new-booking case where the owner needs to coordinate; lifecycle notifications are informational and don't need it.
- Do NOT use the .ics filename `invite.ics` for cancellations — use `cancelled.ics` so an attachment download in a non-iTIP client makes the situation obvious. Reschedule .ics keeps `invite.ics` (it's still an invite, just updated).
- Do NOT change the .ics CONTENT-TYPE between `text/calendar; method=REQUEST` and `text/calendar; method=CANCEL` casing — these MUST match the literal METHOD set on the ical block (uppercase `REQUEST`/`CANCEL`).
  </action>
  <verify>
```bash
ls "lib/email/send-cancel-emails.ts"
ls "lib/email/send-reschedule-emails.ts"

# Cancel email file checks
head -1 "lib/email/send-cancel-emails.ts" | grep -q 'import "server-only"' && echo "cancel server-only ok"
grep -q "export async function sendCancelEmails" "lib/email/send-cancel-emails.ts" && echo "cancel orchestrator exported"
grep -q "ICalCalendarMethod.CANCEL" "lib/email/send-cancel-emails.ts" && echo "method CANCEL used"
grep -q "sequence:.*1" "lib/email/send-cancel-emails.ts" && echo "sequence:1 set"
grep -q "method=CANCEL" "lib/email/send-cancel-emails.ts" && echo "contentType method=CANCEL"
grep -q "Promise.allSettled" "lib/email/send-cancel-emails.ts" && echo "fire-and-forget ok"
grep -q "Book again" "lib/email/send-cancel-emails.ts" && echo "rebook CTA present"
grep -q "apologize" "lib/email/send-cancel-emails.ts" && echo "apology copy (owner-cancel branch) present"
# Verify NO explicit from
grep -q "from:" "lib/email/send-cancel-emails.ts" && echo "WARNING: explicit from field found - REMOVE" || echo "no explicit from - ok"

# Reschedule email file checks
head -1 "lib/email/send-reschedule-emails.ts" | grep -q 'import "server-only"' && echo "reschedule server-only ok"
grep -q "export async function sendRescheduleEmails" "lib/email/send-reschedule-emails.ts" && echo "reschedule orchestrator exported"
grep -q "ICalCalendarMethod.REQUEST" "lib/email/send-reschedule-emails.ts" && echo "method REQUEST used"
grep -q "sequence:.*1" "lib/email/send-reschedule-emails.ts" && echo "sequence:1 set"
grep -q "uid:.*booking.id" "lib/email/send-reschedule-emails.ts" && echo "same UID as original"
grep -q "Booking rescheduled:" "lib/email/send-reschedule-emails.ts" && echo "subject pattern ok"
grep -q "oldStartAt" "lib/email/send-reschedule-emails.ts" && echo "old time displayed"
grep -q "Promise.allSettled" "lib/email/send-reschedule-emails.ts" && echo "fire-and-forget ok"

npm run build
npm run lint
```
  </verify>
  <done>
Both files created. `sendCancelEmails` sends BOTH parties with METHOD:CANCEL .ics + SEQUENCE:1 + same UID. Owner-cancel branch in booker email is apologetic + includes Book-again link. Reason callout renders only for the opposite party of the trigger and only when reason non-empty. `sendRescheduleEmails` sends BOTH parties with METHOD:REQUEST .ics + SEQUENCE:1 + same UID + new times; body shows OLD → NEW. Both use `Promise.allSettled` internally; both `import "server-only"` line 1; both omit explicit `from` field. Build + lint pass.

Commit: `feat(06-02): add cancel + reschedule email senders (METHOD:CANCEL .ics + OLD→NEW reschedule layout)`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
ls "lib/email/build-ics.ts" "lib/email/send-cancel-emails.ts" "lib/email/send-reschedule-emails.ts" "lib/rate-limit.ts"
npm run build
npm run lint
```
</verification>

<rollback>
- buildIcsBuffer extension: revert `lib/email/build-ics.ts` to the Phase 5 version. Phase 5 callers will continue to work (no caller currently passes `method` or `sequence` so removing the params is safe).
- send-cancel-emails.ts / send-reschedule-emails.ts: simply delete the files. No other code imports them yet (Plan 06-03 is the first consumer).
- lib/rate-limit.ts: delete the file. No other code imports it yet (Plan 06-04 is the first consumer).
- The `rate_limit_events` table from Plan 06-01 is independent — leave it.
</rollback>

<success_criteria>
- [ ] `lib/email/build-ics.ts` accepts optional `method` + `sequence` with backward-compatible defaults; sets `STATUS:CANCELLED` when method=CANCEL; calls `.sequence()` explicitly
- [ ] Phase 5 `send-booking-confirmation.ts` continues to compile and produce identical .ics output
- [ ] `lib/email/send-cancel-emails.ts` exports `sendCancelEmails(args)`; sends BOTH parties; METHOD:CANCEL .ics + SEQUENCE:1 + same UID; reason callout only when non-empty
- [ ] Owner-cancel branch in booker email is apologetic + includes "Book again" CTA
- [ ] `lib/email/send-reschedule-emails.ts` exports `sendRescheduleEmails(args)`; sends BOTH parties; METHOD:REQUEST .ics + SEQUENCE:1 + same UID + new times; body shows OLD → NEW
- [ ] Both new senders use `Promise.allSettled` (fire-and-forget pattern from Phase 5)
- [ ] Both new senders omit explicit `from` field (Phase 5 Gmail SMTP auth lock)
- [ ] `lib/rate-limit.ts` exports `checkRateLimit(key, max, windowMs)` + `DEFAULT_TOKEN_RATE_LIMIT = { maxRequests: 10, windowMs: 5*60*1000 }`
- [ ] `lib/rate-limit.ts` uses `createAdminClient()` against `rate_limit_events`; fails open on DB error
- [ ] All four files have `import "server-only"` line 1
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (3 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/06-cancel-and-reschedule-lifecycle/06-02-SUMMARY.md` documenting:
- buildIcsBuffer extension contract: new optional `method` + `sequence` params; STATUS:CANCELLED branch on CANCEL
- Backward-compatibility proof: Phase 5 send-booking-confirmation.ts unchanged
- sendCancelEmails contract: { booking, eventType, account, actor, reason?, appUrl } → fire-and-forget BOTH parties; METHOD:CANCEL .ics; reason callout only for opposite party + non-empty
- sendRescheduleEmails contract: { booking, eventType, account, oldStartAt, oldEndAt, rawCancelToken, rawRescheduleToken, appUrl } → fire-and-forget BOTH parties; METHOD:REQUEST .ics same UID + SEQUENCE:1
- Forward locks for Plan 06-03: lib/bookings/cancel.ts will call `void sendCancelEmails(...)`; lib/bookings/reschedule.ts will call `void sendRescheduleEmails(...)`
- checkRateLimit contract: count + insert via createAdminClient against rate_limit_events; fails open on DB error
- Forward locks for Plan 06-04: public token route handlers call `checkRateLimit("cancel:" + ip, ...DEFAULT_TOKEN_RATE_LIMIT)` BEFORE token resolution
</output>
