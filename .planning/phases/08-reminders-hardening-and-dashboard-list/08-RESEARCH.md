# Phase 8: Reminders + Hardening + Dashboard Bookings List - Research

**Researched:** 2026-04-26
**Domain:** Vercel Cron, email deliverability, rate limiting, shadcn table, autosave UX, RLS testing
**Confidence:** HIGH (most findings verified against official docs or live codebase)

---

## Summary

Phase 8 has three converging workstreams: a reminders cron, production hardening, and a dashboard bookings list. Research uncovered one critical blocker and several important codebase facts that reshape planning.

**Critical blocker — Vercel Hobby plan forbids hourly cron:** Official Vercel docs confirm hobby accounts are hard-limited to once-per-day cron invocations. The expression `0 * * * *` will fail deployment with an explicit error message. The recommended free-tier workaround is cron-job.org (free, up to 60 invocations/hour, verified Feb 2026 via community article) pointing at `/api/cron/send-reminders` with a custom `Authorization: Bearer ${CRON_SECRET}` header. Supabase pg_cron is available as an alternative that calls `net.http_post()` to the same endpoint. The plan must choose one.

**Email provider is Gmail SMTP, not Resend:** Phase 5 vendored `@nsi/email-sender` and the executed code uses `nodemailer` Gmail SMTP with Andrew's `ajwegner3@gmail.com` App Password. All three confirmation, cancel, and reschedule email senders send from this address. The phase context references "RESEND_FROM_EMAIL" and "nsintegrations.com" but that reflects the original Phase 5 plan — the actual deployed system uses Gmail. SPF/DKIM/DMARC hardening therefore targets Gmail's existing authentication infrastructure, not a Resend sending domain. Gmail already signs outbound with DKIM and publishes SPF for `gmail.com`. The domain `nsintegrations.com` has no role in email sending in the current build. Mail-tester score is constrained by Gmail's infrastructure rather than Andrew's DNS.

**Rate limiter already exists and must be reused:** `lib/rate-limit.ts` is a Postgres-backed sliding-window limiter using the `rate_limit_events` table. The `/api/cancel` route already uses it at `10 req / IP / 5-minute window`. Phase 8 applies the same pattern to `/api/bookings` — same library, same response shape, different key prefix (`bookings:${ip}`).

**Primary recommendation:** Use cron-job.org (free, zero new dependencies) as the hourly scheduler for the reminder cron. Reuse the existing Postgres rate-limiter for `/api/bookings`. Build the bookings table with shadcn's `<Table>` + URL searchParams (no TanStack Table — row count is too small to justify the dependency).

---

## Standard Stack

### Core (Phase 8 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn `<Table>` | already installed | Bookings list UI | Already used in event-types; no new dep |
| `next/server` `after()` | Next.js 16.2.4 (stable) | Fire-and-forget email send after cron response | Built into Next.js 15.1+; replaces `void promise` pattern |
| `use-debounce` | NOT installed | Owner-note autosave debounce | Must install — not yet in package.json |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cron-job.org | N/A (external service) | Hourly HTTP scheduler (free tier workaround) | Vercel Hobby — primary cron driver |
| Supabase pg_cron + pg_net | available on free tier | Alternative cron scheduler | Fallback if cron-job.org is unacceptable |
| `@tanstack/react-table` | NOT installed | Table with complex filter/sort/paginate | Do NOT install — overkill for 25-row dashboard at this scale |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cron-job.org | Upgrade to Vercel Pro ($20/mo) | Cleanest solution but costs $240/yr for a single hourly cron |
| cron-job.org | Supabase pg_cron + pg_net | Pure SQL approach; eliminates external service dependency; slightly more complex setup |
| shadcn Table + URL state | TanStack Table | TanStack adds 50KB bundle; unnecessary for 25-row paginated table with 4 static filters |
| hand-rolled debounce | `use-debounce` package | Package is 3KB, battle-tested with React 19, has `useDebouncedCallback` with `maxWait` option |

**Installation (new deps only):**
```bash
npm install use-debounce
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 8 additions)

```
app/
├── api/
│   └── cron/
│       └── send-reminders/
│           └── route.ts            # GET handler; CRON_SECRET auth
├── (shell)/app/
│   ├── bookings/
│   │   ├── page.tsx                # Server Component; reads searchParams
│   │   ├── _components/
│   │   │   ├── bookings-table.tsx  # Client table (shadcn Table)
│   │   │   ├── bookings-filters.tsx # Client filter controls
│   │   │   └── bookings-pagination.tsx
│   │   └── [id]/
│   │       ├── page.tsx            # already exists (Phase 6); extend
│   │       ├── _components/
│   │       │   ├── cancel-button.tsx # already shipped (Phase 6)
│   │       │   ├── owner-note.tsx    # NEW: autosave textarea
│   │       │   └── booking-history.tsx # NEW: events timeline
│   │       └── _lib/
│   │           └── actions.ts      # Server Actions: saveOwnerNote
│   └── settings/
│       └── reminders/
│           └── page.tsx            # NEW: reminder content toggles panel
lib/
└── email/
    └── send-reminder-booker.ts     # NEW: mirrors send-booking-confirmation.ts
supabase/migrations/
└── 20260427XXXXXX_phase8_schema.sql # owner_note + reminder toggles + location
```

### Pattern 1: Vercel Cron Auth via `CRON_SECRET` (OFFICIAL PATTERN)

**What:** Vercel injects `CRON_SECRET` env var value as `Authorization: Bearer <secret>` on every cron invocation. Route handler validates it before doing any work.

**When to use:** Every cron route. Must be the FIRST check.

```typescript
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
// app/api/cron/send-reminders/route.ts
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ... reminder logic
  return Response.json({ ok: true });
}
```

**vercel.json for daily fallback (Hobby plan constraint):**
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

Note: On Hobby, Vercel fires this once daily. The actual hourly driver is cron-job.org. Having both is not harmful — the compare-and-set UPDATE on `reminder_sent_at` makes the handler fully idempotent regardless of invocation frequency.

### Pattern 2: cron-job.org HTTP Call to CRON_SECRET endpoint

**What:** cron-job.org sends an HTTP GET to `https://calendar-app-xi-smoky.vercel.app/api/cron/send-reminders` with `Authorization: Bearer <CRON_SECRET>` header, every hour.

**Setup:** Manual. Andrew creates a free account at cron-job.org, sets schedule to `0 * * * *`, adds custom header `Authorization: Bearer <value-from-Vercel-env>`.

**Why this is the right workaround:** cron-job.org is free, has up to 60 invocations/hour, 30-second timeout (sufficient for our cron), and is the documented community approach for Vercel Hobby users (verified February 2026 community article).

### Pattern 3: Idempotent Compare-and-Set Reminder Claim

**What:** The cron fetches bookings starting within 24h with `reminder_sent_at IS NULL`, then for each uses a conditional UPDATE before sending email. Prevents double-sends on cron re-invocation.

```typescript
// Claim step — must happen BEFORE email send
const { data, error } = await supabase
  .from('bookings')
  .update({ reminder_sent_at: new Date().toISOString() })
  .eq('id', bookingId)
  .is('reminder_sent_at', null)  // compare-and-set condition
  .select('id')
  .maybeSingle();

// If data is null: another invocation already claimed this booking — skip
if (!data) return; // already handled

// Safe to send email now
await sendReminderBooker({ booking, eventType, account, appUrl });
```

The existing `bookings_reminder_scan_idx` partial index on `(start_at) WHERE status='confirmed' AND reminder_sent_at IS NULL` makes the initial scan efficient.

### Pattern 4: `after()` for Fire-and-Forget Email (PREFERRED over `void promise`)

**What:** `next/server`'s `after()` is stable in Next.js 15.1+ (this project is 16.2.4). It extends the serverless function lifetime after the response is sent, preventing cold-stop truncation of promises.

**When to use:** Reminder cron handler after returning the JSON response. Also apply to the booking creation route's `void sendBookingEmails(...)` pattern — replace with `after()`.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/after
import { after } from 'next/server';

export async function GET(request: NextRequest) {
  // ... auth check + query claimed bookings ...

  after(async () => {
    for (const booking of claimedBookings) {
      await sendReminderBooker(/* ... */);
    }
  });

  return Response.json({ ok: true, claimed: claimedBookings.length });
}
```

**Important:** `after()` in Route Handlers CAN access `cookies()` and `headers()` if needed. Runtime: Node.js (not edge). Compatible with the existing booking route's runtime.

### Pattern 5: URL searchParams for Bookings List Filters

**What:** Filter state lives in URL query params. Server Component reads `searchParams` prop (must await in Next.js 16). Client filter controls use `router.replace()` to update URL, triggering re-fetch of the Server Component.

**When to use:** All filter/sort/pagination state on the bookings list page.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/page
// app/(shell)/app/bookings/page.tsx
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    from?: string;
    to?: string;
    event_type?: string | string[];
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams; // Next.js 16: must await
  const page = Number(params.page ?? '1');
  const status = params.status ?? 'upcoming';
  // ... query with .gte/.lte/.ilike based on params
}
```

### Pattern 6: Owner-Note Autosave with `useDebouncedCallback`

**What:** Textarea onChange → debounced callback → Server Action call → inline "Saved" indicator.

```typescript
// Source: https://www.npmjs.com/package/use-debounce (v10.x)
import { useDebouncedCallback } from 'use-debounce';

export function OwnerNote({ bookingId, initialNote }: Props) {
  const [saved, setSaved] = useState(false);

  const save = useDebouncedCallback(async (value: string) => {
    await saveOwnerNoteAction(bookingId, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, 800); // 800ms — Claude's Discretion decision

  return (
    <div>
      <textarea
        defaultValue={initialNote ?? ''}
        onChange={(e) => { setSaved(false); save(e.target.value); }}
        onBlur={(e) => { save.flush(); }} // flush on blur, no orphan saves
        className="..."
      />
      {saved && <span className="text-xs text-muted-foreground">Saved</span>}
    </div>
  );
}
```

**Saved indicator recommendation (Claude's Discretion):** Inline `text-xs text-muted-foreground "Saved"` text that fades after 2 seconds. Lighter than toast (no import overhead), more visible than a checkmark for text-heavy editors. Do NOT use Sonner toast — note saves are frequent micro-events, not user-initiated confirmations.

### Pattern 7: Existing Rate Limiter Reuse for `/api/bookings`

**What:** `lib/rate-limit.ts` already exists with `checkRateLimit(key, max, windowMs)`. Use the same function with key prefix `bookings:${ip}`.

**Recommended thresholds for `/api/bookings`:**

The cancel/reschedule route uses `10 req / IP / 5-minute window`. The booking route sees more legitimate traffic (visit → slot check → submit may produce 2-3 calls), so a slightly more permissive window is appropriate:

- **Recommendation:** `20 requests / IP / 5-minute window` for `/api/bookings`

Rationale: A real booker cycle is ~3 POST attempts max (initial try + slot race retry + network retry). 20/5min blocks automation while tolerating real users. The `rate_limit_events` table already exists and is indexed for this query pattern.

```typescript
// app/api/bookings/route.ts — add BEFORE Turnstile check
const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
  ?? req.headers.get("x-real-ip")
  ?? "unknown";

const rl = await checkRateLimit(`bookings:${ip}`, 20, 5 * 60 * 1000);
if (!rl.allowed) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly.", code: "RATE_LIMITED" },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) } },
  );
}
```

### Anti-Patterns to Avoid

- **TanStack Table for 25-row list:** Overkill. Hand-rolled shadcn `<Table>` + URL searchParams is simpler and already proven in this codebase (event-types table pattern).
- **Nested `after()` within a non-cron route without understanding cold-stop:** `void promise` in `/api/bookings` may be truncated on serverless cold stop. Replace with `after()` which is guaranteed to complete before function teardown.
- **Passing hourly cron expression to Vercel Hobby:** `0 * * * *` WILL fail deployment. Always pair with once-daily fallback expression in vercel.json.
- **Setting `reminder_sent_at` AFTER email send:** If email send fails, the booking would be permanently marked as sent. Claim FIRST (UPDATE), then send. If send fails, log and leave `reminder_sent_at` set (prevents retry spam — acceptable for low-volume v1).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce callback | `useEffect` + `useRef` timer cleanup | `useDebouncedCallback` from `use-debounce` | Edge cases: React StrictMode double-invoke, unmount cleanup, maxWait, flush-on-blur |
| Rate limiting in `/api/bookings` | New rate limit table or in-memory map | Existing `checkRateLimit()` in `lib/rate-limit.ts` | Already battle-tested in Phase 6; same `rate_limit_events` table |
| Cron authentication | Custom header parsing logic | `CRON_SECRET` pattern from Vercel docs | Official; Vercel injects this automatically for cron invocations |
| Email template for reminder | Brand new HTML | Extend `send-booking-confirmation.ts` pattern | All branding blocks (`renderEmailLogoHeader`, `brandedHeadingStyle`, `renderBrandedButton`, `renderEmailFooter`) already exist in `lib/email/branding-blocks.ts` |

---

## Common Pitfalls

### Pitfall 1: Vercel Hobby Cron Granularity
**What goes wrong:** Developer writes `0 * * * *` (hourly) in vercel.json. Deployment fails with: "Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day."
**Why it happens:** Vercel Hobby hard-caps cron at once-per-day per official docs (verified 2026-04-26).
**How to avoid:** Use `0 8 * * *` (daily at 8 AM UTC) in vercel.json for the Hobby fallback. Drive hourly invocations via cron-job.org as the primary scheduler.
**Warning signs:** Build error on deploy mentioning cron frequency.

### Pitfall 2: Email Provider is Gmail, Not Resend
**What goes wrong:** Planning treats this as a Resend integration. Developer adds `RESEND_API_KEY`, configures Resend domain DNS, references `RESEND_FROM_EMAIL`.
**Why it happens:** Phase 5 STATE.md line 58 says "Resend" but the executed code uses Gmail SMTP (`GMAIL_USER`, `GMAIL_APP_PASSWORD`). The Resend provider was stripped during Phase 5 execution. The actual sending identity is `ajwegner3@gmail.com`.
**How to avoid:** The reminder email sender must use the same Gmail singleton pattern as `send-booking-confirmation.ts`. Do not add Resend deps. SPF/DKIM for outbound mail is handled by Google's infrastructure for `gmail.com`.
**Impact on hardening:** The mail-tester deliverability check will show Google's DKIM signature (pass) and SPF for `gmail.com` (pass). The "sending domain" is `gmail.com`, not `nsintegrations.com`. There is no DNS configuration Andrew can do on `nsintegrations.com` that affects Gmail-originated mail. The DMARC check in the phase context is N/A for the current Gmail SMTP implementation. Mail-tester score will be dominated by email content quality, not DNS hardening.

### Pitfall 3: Double-Send on Cron Retry
**What goes wrong:** Cron fires twice within a minute (Vercel idempotency warning + cron-job.org retry). Both invocations scan and find the same unclaimed booking, both send reminder emails.
**Why it happens:** Race between scan query and UPDATE commit.
**How to avoid:** Use compare-and-set UPDATE pattern (Pattern 3 above). The UPDATE with `.is('reminder_sent_at', null)` as WHERE condition is atomic at the Postgres row level. Only one invocation will see `data !== null` — the other will get an empty result and skip.

### Pitfall 4: `searchParams` Not Awaited in Next.js 16
**What goes wrong:** `const { status } = searchParams` (no await) works in dev but throws in production or causes type errors.
**Why it happens:** Next.js 16 (like 15) made `searchParams` in page components a Promise.
**How to avoid:** `const params = await searchParams;` at the top of every page component that reads filters. This is already the established pattern in this codebase (event-types page uses `await searchParams`).

### Pitfall 5: `use-debounce` Not Yet Installed
**What goes wrong:** Owner-note textarea import fails at build.
**Why it happens:** `use-debounce` is not in `package.json` (confirmed by grep).
**How to avoid:** First task in the owner-note plan must `npm install use-debounce`.

### Pitfall 6: RLS Test Second Auth User
**What goes wrong:** Phase 8 RLS matrix needs a second authenticated tenant to prove cross-tenant isolation. There is only one provisioned auth user (Andrew, linked to `nsi`). Creating a second auth user in Supabase requires dashboard action.
**Why it happens:** The existing `nsi-test` account exists as a schema row but has `owner_user_id = NULL`. No auth user is linked to it.
**How to avoid:** Two options:
  - (a) Use `adminClient()` (service-role) to simulate unscoped queries against `nsi-test` data — proves admin bypass works as expected, does not prove RLS cross-tenant isolation for authenticated users.
  - (b) Create a second auth user in Supabase dashboard, link to `nsi-test` account, add `TEST_OWNER_2_EMAIL` + `TEST_OWNER_2_PASSWORD` to `.env.local`. Proves full isolation matrix.
  
  Option (b) is the correct approach for the full matrix. Andrew must create the second auth user manually — flag as a manual step in the plan.

### Pitfall 7: `booking_events` History Not Written for All Lifecycle Events
**What goes wrong:** Booking history timeline on the detail page shows an empty list even for bookings that have been cancelled or rescheduled.
**Why it happens:** `booking_events` rows are written by the Phase 6 cancel/reschedule logic, but the initial `created` event may or may not have been written.
**How to avoid:** Query `booking_events` where `booking_id = id` ordered by `occurred_at` ASC. If the table has no `created` row, synthesize it from `bookings.created_at` on the client. The reminder cron should write a `reminder_sent` event to `booking_events` when it successfully claims a booking.

---

## Code Examples

### Reminder Email Sender — File Shape

```typescript
// Source: mirrors lib/email/send-booking-confirmation.ts (Phase 5)
// lib/email/send-reminder-booker.ts

import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { sendEmail } from "@/lib/email-sender";
import {
  renderEmailLogoHeader,
  renderEmailFooter,
  renderBrandedButton,
  brandedHeadingStyle,
} from "./branding-blocks";

interface ReminderArgs {
  booking: {
    id: string;
    start_at: string;
    booker_name: string;
    booker_email: string;
    booker_timezone: string;
    answers: Record<string, string>;
  };
  eventType: {
    name: string;
    duration_minutes: number;
    location: string | null;     // new field from Phase 8 schema
  };
  account: {
    name: string;
    logo_url: string | null;
    brand_primary: string | null;
    // per-account toggle flags (new Phase 8 columns)
    reminder_include_custom_answers: boolean;
    reminder_include_location: boolean;
    reminder_include_lifecycle_links: boolean;
  };
  rawCancelToken: string;
  rawRescheduleToken: string;
  appUrl: string;
}

export async function sendReminderBooker(args: ReminderArgs): Promise<void> {
  // Subject: "Reminder: {event_name} tomorrow at {time_local}"
  // Time formatted in booker timezone — same convention as confirmation
  const startTz = new TZDate(new Date(args.booking.start_at), args.booking.booker_timezone);
  const timeLine = format(startTz, "h:mm a (z)");
  // ... build HTML with conditional blocks based on toggle flags
}
```

### Rate Limit on `/api/bookings` — Insertion Point

```typescript
// Source: existing lib/rate-limit.ts + app/api/cancel/route.ts pattern
// Insert BEFORE Turnstile check in app/api/bookings/route.ts

const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
  ?? req.headers.get("x-real-ip")
  ?? "unknown";

const rl = await checkRateLimit(`bookings:${ip}`, 20, 5 * 60 * 1000);
if (!rl.allowed) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly.", code: "RATE_LIMITED" },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) } },
  );
}
```

### Cron Scan Query — Upcoming 24h Window

```typescript
// Source: schema research — bookings_reminder_scan_idx covers this query
const windowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const now = new Date().toISOString();

const { data: candidates } = await supabase
  .from("bookings")
  .select(`
    id, start_at, end_at, booker_name, booker_email, booker_timezone,
    answers, cancel_token_hash, reschedule_token_hash,
    event_types!inner(name, duration_minutes, location),
    accounts!inner(
      name, slug, logo_url, brand_primary,
      reminder_include_custom_answers,
      reminder_include_location,
      reminder_include_lifecycle_links
    )
  `)
  .eq("status", "confirmed")
  .is("reminder_sent_at", null)
  .gte("start_at", now)
  .lte("start_at", windowEnd);
```

### RLS Test Matrix Structure

```typescript
// Source: extends tests/rls-anon-lockout.test.ts + tests/rls-authenticated-owner.test.ts patterns

describe("RLS cross-tenant isolation matrix (Phase 8)", () => {
  // Setup: nsi-test-2 account with separate auth user
  // Andrew's account has test booking data; nsi-test-2 owner should see nothing

  const clients = {
    anon: anonClient,
    nsiOwner: () => signInAsNsiOwner(),        // existing helper
    nsiTest2Owner: () => signInAsNsiTest2Owner(), // new helper
    admin: adminClient,
  } as const;

  const tables = ["bookings", "booking_events", "event_types", "accounts"] as const;

  for (const table of tables) {
    it(`nsi-test-2 owner cannot SELECT nsi account ${table}`, async () => {
      const client = await clients.nsiTest2Owner();
      const { data } = await client.from(table).select("id").limit(5);
      // RLS: returns [] not error
      expect(data).toEqual([]);
    });
  }
});
```

### Bookings List Page — Server Component with URL Filters

```typescript
// Source: mirrors app/(shell)/app/event-types/page.tsx pattern (Phase 3)
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    from?: string;
    to?: string;
    event_type?: string | string[];
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const PAGE_SIZE = 25;
  const page = Math.max(1, Number(params.page ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("bookings")
    .select("id, start_at, status, booker_name, booker_email, booker_phone, event_types!inner(name, duration_minutes)", { count: "exact" })
    .order("start_at", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  // Default: upcoming only
  if (!params.status || params.status === "upcoming") {
    query = query.gte("start_at", new Date().toISOString());
  } else if (params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.from) query = query.gte("start_at", params.from);
  if (params.to) query = query.lte("start_at", params.to);
  if (params.q) {
    query = query.or(`booker_name.ilike.%${params.q}%,booker_email.ilike.%${params.q}%`);
  }

  const { data, count } = await query;
  // ... render <BookingsTable rows={data} /> + <BookingsPagination total={count} page={page} />
}
```

---

## Schema Additions (Phase 8)

All three scope additions require migrations. Summary for planner:

### accounts table additions
```sql
-- Per-account reminder content toggles
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS reminder_include_custom_answers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_include_location boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_include_lifecycle_links boolean NOT NULL DEFAULT true;
```

### event_types table addition
```sql
-- Location/address for reminder email + event display
ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS location text;
```

### bookings table addition
```sql
-- Owner-private notes
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS owner_note text;
```

---

## Deliverability / Hardening Findings

### Current Email Provider: Gmail SMTP

**Finding (HIGH confidence):** The app sends all transactional email via `nodemailer` using Andrew's `ajwegner3@gmail.com` Gmail account with an App Password. This is confirmed by `lib/email-sender/providers/gmail.ts`, the vitest mock comment, and `.env.local`.

**Impact on Phase 8 hardening:** The "sending domain" is `gmail.com`, not `nsintegrations.com`. Google handles SPF/DKIM for all outbound Gmail SMTP traffic automatically. Andrew cannot configure SPF/DKIM/DMARC for a Gmail-originated message on his own DNS — those records live under `google.com`/`gmail.com`.

**Mail-tester score reachable:** When sending a test email via the Gmail SMTP path, mail-tester will show:
- SPF: PASS (Google's SPF record for gmail.com)
- DKIM: PASS (Google signs all outbound Gmail SMTP)
- DMARC: likely PASS for gmail.com (p=none by default for personal Gmail)
- Content score: depends on email HTML quality (inline styles, text alternative, no spam triggers)

**Score ≥ 9/10 is achievable** without any DNS changes to nsintegrations.com. The HTML emails already use inline styles (confirmed in confirmation sender) and `stripHtml()` generates the plain-text alternative automatically.

**What CAN affect score:**
- Spam trigger words in email content (avoid "FREE!", "URGENT", excessive caps)
- Missing or broken links
- Image-to-text ratio (reminder email is mostly text — good)
- HTML structure quality (existing emails use table-based layout — appropriate)

**DNS hardening for nsintegrations.com:** Out of scope for Phase 8 given current Gmail provider. If/when the email provider migrates to Resend (nsintegrations.com sending domain), DNS hardening becomes relevant. The planner should scope Phase 8 hardening as: (a) run mail-tester against confirmation email and remediate any content-side issues, and (b) document the Resend migration path as a future item.

**Bulk-sender requirements (Gmail/Yahoo 2024):** Threshold is 5,000 messages/day. NSI is a single-owner scheduling app sending < 100 emails/day. These requirements do not apply.

### Rate Limit for `/api/bookings`

- **Recommended threshold:** 20 requests / IP / 5-minute window
- **Rationale:** Phase 6 used 10/5min for cancel/reschedule (low-frequency token routes). Booking is higher-frequency legitimate traffic (slot check + submit = 2+ calls per session). 20/5min blocks bot enumeration while tolerating real users.
- **Implementation:** Reuse `checkRateLimit()` from `lib/rate-limit.ts` with key `bookings:${ip}`. Zero new dependencies.
- **Response shape:** `429 { error, code: "RATE_LIMITED" }` + `Retry-After` header. Already established in cancel route.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `void promise` for fire-and-forget | `after()` from `next/server` | Next.js 15.1 (stable) | Guarantees background work completes before serverless cold-stop |
| `@vercel/functions` `waitUntil` | `after()` (built-in) | Next.js 15.1 | `@vercel/functions` still valid but `after()` is preferred for Next.js App Router |
| TanStack Table for all data tables | shadcn Table + URL state (simple tables) | Ongoing | Right-size the tool — TanStack only justified at large scale or complex client interactions |
| Vercel Cron (Hobby assumed hourly) | cron-job.org (free) + Vercel daily fallback | Vercel policy | Hobby is once-per-day; use external scheduler for hourly |

**Deprecated/outdated:**
- `void sendBookingEmails(...)` pattern in `/api/bookings`: Still works but should be replaced with `after()` during Phase 8 hardening for reliability on serverless cold-stop.

---

## Open Questions

1. **Vercel plan tier**
   - What we know: Hobby plan restricts cron to once-per-day. The live project is deployed at `calendar-app-xi-smoky.vercel.app`.
   - What's unclear: Whether Andrew's Vercel account is Hobby or Pro. If Pro, `0 * * * *` in vercel.json works natively and cron-job.org is unnecessary.
   - Recommendation: Planner should write the plan assuming Hobby (safer) with a note that if Andrew is on Pro, the cron-job.org manual step can be skipped and vercel.json schedule changes to `0 * * * *`.

2. **Second auth user for RLS matrix**
   - What we know: The full cross-tenant RLS test requires a second Supabase auth user linked to `nsi-test` account. No such user exists.
   - What's unclear: Andrew's preference — create a second real auth user, or scope the test to anon + admin-client patterns only.
   - Recommendation: Include manual step "Create nsi-test-2 auth user in Supabase dashboard" in the RLS plan. Add `TEST_OWNER_2_EMAIL` / `TEST_OWNER_2_PASSWORD` to `.env.local` pattern.

3. **Reminder email: raw cancel/reschedule tokens**
   - What we know: The confirmation email stores raw tokens in the email body. These tokens are valid until the appointment passes. The reminder should include the same cancel/reschedule links.
   - What's unclear: The raw tokens are NOT stored in the DB (only hashes are). To include them in a reminder sent hours/days later, the reminder cron must either: (a) re-use the hash tokens by checking validity, (b) generate new raw tokens and update the DB hashes, or (c) send cancel/reschedule links that go through a lookup-by-hash path that returns the token somehow.
   - Recommendation: Option (c) is wrong. Option (b) is overkill. The correct approach is: the reminder links use the DASHBOARD cancel path (`/app/bookings/[id]`) rather than the booker-facing `/cancel/[rawToken]` path — OR — implement a "raw token from confirmation" retrieval. **Actually:** re-reading the confirmation email pattern, the raw token was sent only in the email. The reminder should send its OWN fresh tokens: generate new raw cancel/reschedule tokens at reminder send time, update `cancel_token_hash` and `reschedule_token_hash` in the DB. This replaces the confirmation-email tokens with the reminder-email tokens. Simple, stateless.
   - Flag for planner: This requires the cron to do a DB UPDATE (new tokens) before sending. Add to cron task scope.

4. **`waitUntil` / `after()` adoption in existing booking route**
   - What we know: The backlog item in STATE.md flags `waitUntil()` adoption for Phase 8. `after()` from `next/server` is the current recommended approach (stable in Next.js 16).
   - Recommendation: Replace `void sendBookingEmails(...)` in `/api/bookings/route.ts` with `after(() => sendBookingEmails(...))` as a hardening sub-task.

---

## Sources

### Primary (HIGH confidence)
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby plan once-per-day limit, table with Hobby/Pro/Enterprise comparison
- [Vercel Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — CRON_SECRET auth pattern, `Authorization: Bearer` header, vercel.json schema
- [Next.js `after()` API Reference](https://nextjs.org/docs/app/api-reference/functions/after) — stable in v15.1, import from `next/server`, Route Handler support, platform support table
- [Supabase Cron Quickstart](https://supabase.com/docs/guides/cron/quickstart) — `net.http_post()` SQL syntax, `0 * * * *` hourly pattern
- Live codebase: `lib/rate-limit.ts`, `lib/email-sender/providers/gmail.ts`, `lib/email/branding-blocks.ts`, `.env.local`, `supabase/migrations/*.sql`

### Secondary (MEDIUM confidence)
- [cron-job.org FAQ](https://cron-job.org/en/faq/) — Free tier: up to 60/hour, 30s timeout, custom headers supported
- [Medium: Vercel Hobby hourly cron workaround (Feb 2026)](https://nancy-chauhan.medium.com/my-0-vercel-app-needed-an-hourly-cron-thats-a-pro-feature-here-s-how-i-kept-it-free-fa83d898763a) — cron-job.org + `after()` approach verified as working Feb 2026
- [shadcn Data Table docs](https://www.shadcn.io/ui/data-table) — requires `@tanstack/react-table` install; confirmed TanStack Table is the shadcn-blessed approach for complex tables
- [Gmail/Yahoo bulk sender requirements](https://resend.com/blog/gmail-and-yahoo-bulk-sending-requirements-for-2024) — 5,000/day threshold; transactional email excluded from unsubscribe requirement

### Tertiary (LOW confidence)
- WebSearch findings on Resend DNS records: Not applicable — current provider is Gmail, not Resend
- WebSearch findings on mail-tester.com scoring breakdown: No authoritative breakdown found; rely on empirical test

---

## Metadata

**Confidence breakdown:**
- Cron strategy (Vercel Hobby limit): HIGH — official Vercel docs, explicit table
- cron-job.org as workaround: MEDIUM — official FAQ + Feb 2026 community article, consistent findings
- Email provider is Gmail (not Resend): HIGH — confirmed in live code + .env.local
- Rate limit reuse: HIGH — live codebase read, exact function signature confirmed
- Schema additions: HIGH — live schema read, migration files reviewed
- Indexes already exist: HIGH — confirmed `bookings_account_start_idx` and `bookings_reminder_scan_idx` in initial migration
- `after()` adoption: HIGH — official Next.js docs, stable since 15.1, this project is 16.2.4
- `use-debounce` not installed: HIGH — package.json grepped, not present
- `@tanstack/react-table` not installed: HIGH — package.json grepped, not present
- Mail-tester ≥9/10 achievable via Gmail: MEDIUM — logical inference from Google handling DKIM/SPF; no live test conducted

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (Vercel pricing stable; cron-job.org free tier stable; email provider locked by .env.local)
