# Architecture Patterns

**Domain:** Multi-tenant Calendly-style booking tool (Next.js + Supabase)
**Researched:** 2026-04-18
**Overall confidence:** MEDIUM-HIGH (patterns are well-established; synthesis from training data — external verification via Context7/WebSearch was unavailable during this research pass, so a light validation check on Supabase RLS syntax and Next.js App Router route handler conventions is recommended before code is written)

---

## Recommended Architecture

### High-level topology

```
                           ┌──────────────────────────────────────────┐
                           │   Browser (booker)                       │
                           │   - Widget iframe OR hosted booking page │
                           │   - Detects timezone via Intl API        │
                           └───────────────┬──────────────────────────┘
                                           │ HTTPS (public, no auth)
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Next.js app on Vercel                                                   │
│                                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────┐  │
│  │ Public routes        │  │ Owner dashboard       │  │ API routes     │  │
│  │ /[account]/[slug]    │  │ /app/* (auth-gated)   │  │ /api/*         │  │
│  │ /embed/[account]/... │  │                       │  │                │  │
│  │ /cancel/[token]      │  │                       │  │                │  │
│  │ /reschedule/[token]  │  │                       │  │                │  │
│  └──────────┬───────────┘  └───────────┬──────────┘  └────────┬───────┘  │
│             │                          │                      │          │
│             └──────────────┬───────────┴──────────────────────┘          │
│                            │                                             │
│             ┌──────────────┴──────────────┐                              │
│             │ Server-side data layer      │                              │
│             │ - @supabase/ssr client      │                              │
│             │ - Service-role client       │                              │
│             │   (server-only, bypasses    │                              │
│             │    RLS for token flows,     │                              │
│             │    cron, public booking)    │                              │
│             └──────────────┬──────────────┘                              │
│                            │                                             │
│  ┌─────────────────────────┴─────────────────────────┐                   │
│  │ Vercel Cron endpoint: /api/cron/send-reminders    │                   │
│  │ (protected by CRON_SECRET header)                 │                   │
│  └───────────────────────────────────────────────────┘                   │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
           ┌─────────────────────────────────────────┐
           │  Supabase                               │
           │  - Postgres (RLS enabled on all tables) │
           │  - Auth (owners only, email/password)   │
           │  - Storage (logo uploads)               │
           │  - pg_cron (optional alt. to Vercel)    │
           └──────────────────┬──────────────────────┘
                              │
                              ▼
                   ┌─────────────────────────┐
                   │ @nsi/email-sender       │
                   │ (Resend, .ics support)  │
                   └─────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Owner dashboard** (`/app/*`) | Authenticated UI for managing event types, availability, bookings, branding. Server Components read via RLS-scoped Supabase client. | Supabase (authenticated user JWT) |
| **Public booking page** (`/[account]/[event-slug]`) | Unauthenticated. Renders branded page, fetches available slots, accepts booking form. | `/api/slots`, `/api/bookings` |
| **Embed widget** (`/embed/[account]/[event-slug]`) | Same as booking page, minimal chrome, designed for iframe. Posts height messages to parent. | `/api/slots`, `/api/bookings` |
| **Embed loader script** (`/embed.js` served as static) | Small JS snippet clients drop in via `<script>` tag. Creates iframe, listens for postMessage height updates. | Parent page DOM + iframe |
| **Slot availability API** (`/api/slots`) | Computes free slots for (account, event type, date range) given availability rules + existing bookings. Runs with service-role key; validates account slug publicly. | Supabase (read) |
| **Booking creation API** (`/api/bookings`) | Validates payload, re-checks slot availability (race-condition-safe), persists booking, fires confirmation email. | Supabase (insert), `@nsi/email-sender` |
| **Cancel/reschedule API** (`/api/bookings/cancel/[token]`, `/api/bookings/reschedule/[token]`) | Resolves tokenized link, validates, mutates booking, sends update email. | Supabase, email sender |
| **Reminder cron** (`/api/cron/send-reminders`) | Runs hourly. Finds bookings 24h out that haven't had `reminder_sent_at` set. Sends email. Marks sent atomically. | Supabase (service-role), email sender |
| **Auth layer** (Supabase Auth) | Email/password for owners only. Bookers never authenticate. | — |

**Boundary rules:**
- Everything under `/app/*` requires an authenticated Supabase session; enforce in middleware.
- Public routes (`/[account]/*`, `/embed/*`, `/cancel/*`, `/reschedule/*`) must never require login.
- Any server-side code that needs to bypass RLS (public slot lookups, token flows, cron) uses the **service-role client** and must be kept server-only (never imported into a Client Component).

### Data Flow: Booking Creation (end-to-end)

```
1. Browser loads /[account]/[event-slug]
   - Server Component fetches account (by slug) + event type (by slug)
     using anon/service key; only public fields returned.
   - Returns HTML with: account branding, event metadata, booker-TZ-detected
     date picker.

2. Browser detects timezone via Intl.DateTimeFormat().resolvedOptions().timeZone
   → stores in React state (e.g., "America/Chicago").

3. Browser calls GET /api/slots?account=...&event=...&from=...&to=...&tz=...
   - Server reads availability_rules + date_overrides + existing bookings
     (all with service-role client; account_id gates the query).
   - Generates candidate slots in the OWNER'S timezone
     (UTC math, but display/granularity aligned to owner TZ).
   - Subtracts any overlapping bookings.
   - Converts slot start times to ISO UTC in the response; client renders
     them in booker's local TZ.

4. Booker selects a slot → fills form (name, email, phone, custom fields).

5. Browser POSTs /api/bookings with:
     { account_id, event_type_id, slot_start_utc, booker_name,
       booker_email, booker_phone, booker_timezone, answers:{...} }

6. Server handler:
   a. Re-fetch event type + availability (authoritative check).
   b. Re-compute whether slot_start_utc is still free (guards against
      two bookers racing for the same slot).
   c. Generate cancel_token + reschedule_token (crypto.randomUUID() +
      HMAC; see "Tokenized link pattern").
   d. INSERT into bookings with unique constraint
      UNIQUE (event_type_id, slot_start_utc) to enforce no double-book
      at the DB level. If insert fails on conflict → return 409.
   e. Generate .ics file in memory.
   f. Call @nsi/email-sender.send({ to: booker, attachments:[ics], ... })
      for confirmation.
   g. Call @nsi/email-sender.send({ to: owner, ... }) for owner notification.
   h. Return booking_id + human-readable confirmation details.

7. Browser shows confirmation state. If in iframe, posts height update.
```

**Critical invariant:** Step 6d's unique constraint is the source of truth for "no double-booking." Application-level slot checks are an optimization to return clean errors, but the DB constraint is what actually prevents it.

---

## Data Model

All times stored as `TIMESTAMPTZ` (UTC under the hood). Timezone identifiers stored as IANA strings (`"America/Chicago"`, `"Europe/London"`).

### Table: `accounts`

The tenant. Everything else belongs to an account.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `slug` | `text` UNIQUE | URL-safe tenant identifier (`nsi`, `plumber-bob`) |
| `name` | `text` | Display name |
| `owner_user_id` | `uuid` FK → `auth.users` | The Supabase Auth user who owns this account |
| `timezone` | `text` NOT NULL | IANA tz, e.g., `"America/Chicago"`. Owner's TZ. |
| `logo_url` | `text` | From Supabase Storage |
| `brand_primary` | `text` | Hex color |
| `brand_accent` | `text` | Hex color |
| `created_at` | `timestamptz` | |

**Indexes:** `UNIQUE(slug)`, `INDEX(owner_user_id)`.

*(v1 supports one owner per account. If team seats become a thing later, add an `account_members` join table — do not change this column.)*

### Table: `event_types`

A bookable thing ("15-min discovery call"). Many per account.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `account_id` | `uuid` FK → `accounts` ON DELETE CASCADE | |
| `slug` | `text` | URL slug within account (e.g., `discovery`); UNIQUE per account |
| `name` | `text` | Display name |
| `description` | `text` | Markdown/plain |
| `duration_minutes` | `int` NOT NULL | 15, 30, 60, etc. |
| `buffer_before_minutes` | `int` default 0 | |
| `buffer_after_minutes` | `int` default 0 | |
| `min_notice_minutes` | `int` default 60 | Earliest bookable is now + this |
| `max_advance_days` | `int` default 60 | Latest bookable is today + this |
| `custom_questions` | `jsonb` default `'[]'` | `[{id, label, type, required}]` |
| `is_active` | `boolean` default true | Soft hide from public |
| `created_at` | `timestamptz` | |

**Indexes:** `UNIQUE(account_id, slug)`, `INDEX(account_id)`.

### Table: `availability_rules`

Weekly recurring availability. Account-wide in v1 (per-type deferred).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `account_id` | `uuid` FK → `accounts` ON DELETE CASCADE | |
| `day_of_week` | `smallint` NOT NULL | 0=Sun … 6=Sat |
| `start_minute` | `smallint` NOT NULL | Minutes since midnight (0–1439) in the account's TZ |
| `end_minute` | `smallint` NOT NULL | Exclusive end |
| `created_at` | `timestamptz` | |

**Indexes:** `INDEX(account_id, day_of_week)`.

**Why store minute-of-day rather than `TIME`?** Arithmetic is simpler and avoids TZ conversion ambiguity; interpretation is always "minute-of-day in the account's timezone." Many Calendly-style OSS projects use this pattern.

### Table: `date_overrides`

Per-date overrides. Can be "closed all day" (no rows for that date after clearing) or "different hours."

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `account_id` | `uuid` FK → `accounts` | |
| `override_date` | `date` NOT NULL | In account's TZ |
| `is_closed` | `boolean` default false | If true, no slots that day regardless of rules |
| `start_minute` | `smallint` NULL | NULL when `is_closed = true` |
| `end_minute` | `smallint` NULL | |
| `note` | `text` | Optional owner-facing label (e.g., "Thanksgiving") |
| `created_at` | `timestamptz` | |

**Indexes:** `UNIQUE(account_id, override_date, start_minute)`, `INDEX(account_id, override_date)`.

*(UNIQUE with start_minute allows multiple override windows in a single day if needed later, while preventing exact duplicates.)*

### Table: `bookings`

The core record.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `account_id` | `uuid` FK → `accounts` | Denormalized for RLS perf and analytics |
| `event_type_id` | `uuid` FK → `event_types` ON DELETE RESTRICT | |
| `start_at` | `timestamptz` NOT NULL | UTC |
| `end_at` | `timestamptz` NOT NULL | UTC (start_at + duration + buffers baked into availability window) |
| `booker_name` | `text` NOT NULL | |
| `booker_email` | `citext` NOT NULL | case-insensitive |
| `booker_phone` | `text` | |
| `booker_timezone` | `text` NOT NULL | Captured at booking time |
| `answers` | `jsonb` default `'{}'` | Keyed by custom_question.id |
| `status` | `text` NOT NULL default `'confirmed'` | `'confirmed' \| 'cancelled' \| 'rescheduled'` |
| `cancel_token_hash` | `text` NOT NULL | SHA-256 of token; never store raw token |
| `reschedule_token_hash` | `text` NOT NULL | Same pattern |
| `reminder_sent_at` | `timestamptz` NULL | Set when 24h reminder sent |
| `cancelled_at` | `timestamptz` NULL | |
| `cancelled_by` | `text` NULL | `'booker' \| 'owner'` |
| `created_at` | `timestamptz` default `now()` | |

**Indexes:**
- `UNIQUE(event_type_id, start_at) WHERE status = 'confirmed'` — **partial unique index** is the anti-double-booking guard. Cancelled rows don't block future bookings at the same slot.
- `INDEX(account_id, start_at)` — owner dashboard "upcoming bookings" queries.
- `INDEX(start_at) WHERE status = 'confirmed' AND reminder_sent_at IS NULL` — partial index for cron reminder scans (stays tiny).
- `INDEX(cancel_token_hash)`, `INDEX(reschedule_token_hash)` — O(1) token lookup.

### Table: `booking_events` (optional, recommended)

Append-only audit log (who cancelled, when, why). Simplifies debugging user complaints.

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `booking_id` | `uuid` FK |
| `event_type` | `text` (`'created'`, `'cancelled'`, `'rescheduled'`, `'reminder_sent'`) |
| `payload` | `jsonb` |
| `created_at` | `timestamptz` |

### Relationship diagram

```
accounts (1) ──< event_types (N)
accounts (1) ──< availability_rules (N)
accounts (1) ──< date_overrides (N)
accounts (1) ──< bookings (N)
event_types (1) ──< bookings (N)
bookings (1) ──< booking_events (N)
auth.users (1) ──< accounts (1)   -- v1 only, via owner_user_id
```

---

## Multi-tenant Isolation: RLS Policies

**Principle:** RLS is the backstop. Application code should still scope queries explicitly by `account_id`, but RLS ensures that even a bug can't leak data across tenants.

Enable RLS on every table:

```sql
alter table accounts enable row level security;
alter table event_types enable row level security;
alter table availability_rules enable row level security;
alter table date_overrides enable row level security;
alter table bookings enable row level security;
alter table booking_events enable row level security;
```

### Pattern A — Owner access (authenticated)

Authenticated owners can only see/modify rows in accounts they own.

```sql
-- Helper function: returns the account_ids the current user owns.
create or replace function public.current_owner_account_ids()
returns setof uuid
language sql stable security definer as $$
  select id from accounts where owner_user_id = auth.uid();
$$;

-- accounts: owner can see their own account
create policy "owners read own account"
  on accounts for select
  using (owner_user_id = auth.uid());

create policy "owners update own account"
  on accounts for update
  using (owner_user_id = auth.uid());

-- event_types: owner full access to their account's rows
create policy "owners manage event_types"
  on event_types for all
  using (account_id in (select current_owner_account_ids()))
  with check (account_id in (select current_owner_account_ids()));

-- Same shape for availability_rules, date_overrides, bookings, booking_events.
```

### Pattern B — Public read (anon) for published booking pages

The booker is **not logged in**. Two options:

**Option 1 (recommended): Don't expose tables to anon at all. Route public reads through API handlers using the service-role key.**

This is cleaner because:
- Slot computation needs to read availability + existing bookings anyway.
- You don't want `anon` able to enumerate `accounts`, `bookings`, or anyone's email.
- The API layer can do rate limiting and payload filtering.

Leave RLS fully restrictive for `anon`; let server routes use `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)`.

**Option 2 (only if you want a thin server):** Narrow `anon` select policies, e.g.,

```sql
create policy "anon read public event_types"
  on event_types for select
  to anon
  using (is_active = true);
```

But this exposes *all* event types to anyone who knows the table name via the REST API. Not recommended for this project — **stick with Option 1**.

### Pattern C — Bookings are *never* readable by anon

Even with tokens, cancel/reschedule flows should hit API routes that look up by `cancel_token_hash`/`reschedule_token_hash` using the service-role key, then return only the specific booking. RLS stays closed for anon.

### Service-role key handling

- Store `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars (server-only — never `NEXT_PUBLIC_`).
- Wrap in a single module (`lib/supabase/admin.ts`) that throws if imported into a Client Component.
- Use only in Route Handlers, Server Actions, and cron endpoints.

---

## Timezone Handling

### Storage

- **Database:** all instants stored as `TIMESTAMPTZ` (UTC).
- **Account TZ:** IANA string on `accounts.timezone`.
- **Booker TZ:** IANA string on `bookings.booker_timezone` (captured at booking).
- **Availability rules / date overrides:** stored as minute-of-day + date, interpreted in the **account's** timezone.

### Conversion points

```
Owner-facing (dashboard):
    TIMESTAMPTZ (UTC) ──[formatInTimeZone(account.timezone)]──> displayed times

Booker-facing (public page):
    availability_rules (account TZ, minute-of-day)
      │
      ▼
    Expanded to candidate slots as ZonedDateTime in account TZ
      │
      ▼
    Converted to UTC for comparison with existing bookings' start_at
      │
      ▼
    Returned to client as ISO UTC strings
      │
      ▼
    Client formats via Intl.DateTimeFormat in booker's browser TZ
```

**Library recommendation:** `date-fns-tz` (lightweight, tree-shakeable) or `@js-temporal/polyfill` (the future standard, heavier). For v1, `date-fns-tz` is fine and well-proven.

**Critical rule:** Never do date math in local time. Always: parse → convert to UTC → operate → convert to display TZ. The one exception is "day-of-week for availability_rules" — that must use the account's TZ (because 9am Monday in Chicago is a *different* UTC instant than 9am Monday in Berlin).

### DST edge cases to test

- US DST transition in March (spring forward): 2am–3am doesn't exist. Rule "9–5 on Sundays" must still work on that day.
- US DST transition in November (fall back): 1am–2am happens twice. No slots should be double-generated.
- Booker and owner in different DST regions (e.g., US vs. Europe shift on different weekends).
- Booker chooses a slot just before their own DST transition — the displayed time stays stable.

---

## Embed Architecture

### Two public surfaces

1. **Hosted booking page:** `https://app.com/[account-slug]/[event-slug]` — full page, shareable link.
2. **Embed page:** `https://app.com/embed/[account-slug]/[event-slug]` — same logic, chromeless layout, designed to be iframed.

### Script-tag embed pattern

Customer drops this on their site:

```html
<div data-nsi-booking="nsi/discovery"></div>
<script async src="https://app.com/embed.js"></script>
```

`embed.js` (served as a static asset):

```js
(function () {
  document.querySelectorAll('[data-nsi-booking]').forEach((host) => {
    const [account, slug] = host.dataset.nsiBooking.split('/');
    const iframe = document.createElement('iframe');
    iframe.src = `https://app.com/embed/${account}/${slug}`;
    iframe.style.cssText = 'width:100%;border:0;display:block';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('allow', 'clipboard-write');
    host.appendChild(iframe);

    window.addEventListener('message', (e) => {
      if (e.source !== iframe.contentWindow) return;
      if (e.data?.type === 'nsi-booking:height' && typeof e.data.height === 'number') {
        iframe.style.height = e.data.height + 'px';
      }
    });
  });
})();
```

### Inside the embed page (iframe)

```ts
useEffect(() => {
  const send = () => {
    parent.postMessage(
      { type: 'nsi-booking:height', height: document.documentElement.scrollHeight },
      '*'
    );
  };
  const ro = new ResizeObserver(send);
  ro.observe(document.documentElement);
  send();
  return () => ro.disconnect();
}, []);
```

### Cross-origin considerations

- **CSP:** Set `frame-ancestors *` (or a whitelist later) on `/embed/*` only. Everything else keeps `frame-ancestors 'self'`. In Next.js this is done per-route via `headers()` in `next.config.js` with source-matched rules, or via middleware.
- **`X-Frame-Options`:** Do not set (it conflicts with permissive `frame-ancestors`).
- **Cookies:** The embed page must work **without third-party cookies** (Safari + Chrome 3p-cookie phaseout). Since bookers don't authenticate, and slot/booking APIs identify by payload (not session), this is fine — but double-check that no analytics/auth cookie is required to load `/embed/*`.
- **postMessage origin validation:** Parent script uses `e.source !== iframe.contentWindow` check (more reliable than origin allowlist when embeds live on many customer domains). The child posts to `*` because it cannot know the parent origin in advance.
- **Height messaging contract:** Use a namespaced `type` (`nsi-booking:height`) to avoid collisions with other scripts.

---

## Cron / Reminder Dispatch

### Recommendation: **Vercel Cron**, not pg_cron

**Why Vercel Cron wins for v1:**
- Runs in the same Next.js app — no separate deploy or SQL-function layer.
- Easy to send email via `@nsi/email-sender` (it's already a JS module).
- Trivial to log, debug, and test locally.
- Free on Hobby tier (within published limits) — fits the budget constraint.

**When pg_cron would be better:**
- If reminder sending had to happen even when the Vercel app was down (it doesn't).
- If the logic were pure SQL (it's not — emailing is an HTTP call).

### Endpoint pattern

`app/api/cron/send-reminders/route.ts`:

```ts
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: due } = await supabase
    .from('bookings')
    .select('*, event_types(*), accounts(*)')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('start_at', new Date(Date.now() + 23 * 3600_000).toISOString())
    .lte('start_at', new Date(Date.now() + 25 * 3600_000).toISOString());

  for (const booking of due ?? []) {
    // CAS: only send if reminder_sent_at is still null.
    const { data: claimed } = await supabase
      .from('bookings')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', booking.id)
      .is('reminder_sent_at', null)
      .select()
      .single();

    if (!claimed) continue; // another worker got it

    try {
      await emailSender.send({ /* reminder template */ });
    } catch (err) {
      // Roll back the claim so next tick retries.
      await supabase.from('bookings').update({ reminder_sent_at: null }).eq('id', booking.id);
      console.error('reminder send failed', booking.id, err);
    }
  }

  return Response.json({ processed: due?.length ?? 0 });
}
```

### `vercel.json` schedule

```json
{
  "crons": [
    { "path": "/api/cron/send-reminders", "schedule": "0 * * * *" }
  ]
}
```

Hourly gives a ±1h window around "24 hours before." Acceptable for v1 per out-of-scope "configurable reminder timing."

### Why the claim-then-send pattern

- The `UPDATE … WHERE reminder_sent_at IS NULL … RETURNING` is an atomic compare-and-set. Two overlapping cron executions (e.g., due to Vercel retries) can't double-send.
- If the email fails, we revert the claim so the next run retries. The alternative (send-then-mark) risks double-sends on crashes.

---

## Tokenized Cancel/Reschedule Links

### Goals

1. Booker can cancel/reschedule without logging in.
2. Links should not be enumerable or guessable.
3. Token exposure in a forwarded email shouldn't compromise *other* bookings.
4. Old tokens should stop working after the booking is done/cancelled.

### Pattern

1. At booking creation:
   ```ts
   const rawCancelToken = crypto.randomUUID() + crypto.randomUUID(); // 256 bits entropy
   const cancelTokenHash = await sha256(rawCancelToken);
   // Save cancelTokenHash to DB; send rawCancelToken in the email only.
   ```
2. Email links:
   ```
   https://app.com/cancel/{rawCancelToken}
   https://app.com/reschedule/{rawCancelToken}
   ```
3. Route handler:
   ```ts
   const hash = await sha256(params.token);
   const { data: booking } = await admin
     .from('bookings')
     .select('*')
     .eq('cancel_token_hash', hash)
     .eq('status', 'confirmed') // expired once cancelled
     .gt('start_at', new Date().toISOString()) // expired once appointment passed
     .maybeSingle();
   if (!booking) return notFound();
   ```

### Why hash on the server side

- If the DB is leaked, tokens can't be reused (they're hashed).
- Without hashing, anyone with DB read access could cancel arbitrary bookings.

### Rate limiting

- Even unguessable tokens benefit from rate limiting to prevent abuse of the cancel endpoint. Use Vercel's built-in edge middleware or Upstash Redis (free tier) keyed by IP. MEDIUM priority for v1.

### Reschedule flow specifics

- Reschedule page loads the booking (via token), shows the slot picker again, submits to `/api/bookings/reschedule/[token]`.
- Server validates token + new slot, transactionally: mark old booking `status='rescheduled'`, insert new booking with new tokens, fire update email. The `UNIQUE (event_type_id, start_at) WHERE status='confirmed'` partial index is crucial here so the rescheduled-out slot frees up.

---

## Patterns to Follow

### Pattern 1: Thin API, thick DB invariants

**What:** Rely on Postgres unique constraints, CHECKs, and RLS for correctness. Use app code for UX (clean errors, batching).
**When:** Anywhere correctness matters more than flexibility (no-double-book, multi-tenant isolation).
**Example:** The partial unique index on `(event_type_id, start_at) WHERE status='confirmed'` makes race conditions impossible even if the API layer has a bug.

### Pattern 2: Server Components for dashboards, Client Components for interactivity

**What:** Owner dashboard reads (event type list, bookings list) are Server Components using the SSR Supabase client. Forms and the slot picker are Client Components.
**When:** Prefer server rendering unless the UI needs real-time interactivity.
**Why:** Simpler auth, less JS shipped, RLS enforced via the user's JWT.

### Pattern 3: Service-role client as a single guarded module

```ts
// lib/supabase/admin.ts
import 'server-only'; // throws at bundle time if imported into client
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
```

**When:** Any server code needing to read/write without the user's JWT (public slot lookups, token flows, cron).

### Pattern 4: `account_id` denormalized on every table

Even though `bookings.event_type_id` lets you derive `account_id`, store it directly. This makes RLS policies simpler (`account_id in (...)`) and keeps tenant-scoped queries fast.

### Pattern 5: One Next.js app, route-based separation

- `/[account]/*` and `/embed/*` — public, unauth
- `/app/*` — authed owner dashboard, middleware-gated
- `/api/*` — mixed; each handler decides

Don't over-engineer into microservices. Vercel + Supabase gives you separation at the platform layer.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing local times without timezones

**What:** `VARCHAR` or naive `TIMESTAMP` for `bookings.start_at`, or "we'll convert in the app."
**Why bad:** Every DST transition silently corrupts data. "9am" is ambiguous forever.
**Instead:** `TIMESTAMPTZ` always. Store the TZ separately for display only.

### Anti-Pattern 2: Checking availability in app code only

**What:** "We'll just query existing bookings before inserting."
**Why bad:** Two simultaneous requests both see the slot as free, both insert, you've double-booked.
**Instead:** Partial unique index at the DB level. App check is for clean UX, not correctness.

### Anti-Pattern 3: Exposing tables directly to anon for public booking

**What:** Loosen RLS so the booking page can query Supabase from the browser.
**Why bad:** Leaks tenant metadata, emails of prior bookers, full bookings table.
**Instead:** Route all public reads through server API handlers with service-role key and scoped responses.

### Anti-Pattern 4: Generating calendar slots on the client

**What:** Ship availability rules to the browser and expand to slots in JS.
**Why bad:** Booker sees slots their clock agrees with, but owner's DST or date-override state is stale; slot computation diverges from source of truth.
**Instead:** `/api/slots` computes on the server; client just renders.

### Anti-Pattern 5: Using pg_cron to send emails

**What:** `pg_cron` job calls an HTTP service or uses `pg_net` to hit Resend.
**Why bad:** Fragile (no retry semantics, logs in psql, hard to test), harder to keep in sync with email-sender library changes.
**Instead:** Vercel Cron hitting a Next.js route that uses the same email-sender everything else uses.

### Anti-Pattern 6: Storing raw cancel/reschedule tokens

**What:** `bookings.cancel_token TEXT` stored as-is.
**Why bad:** A DB leak becomes a "cancel everyone's bookings" exploit.
**Instead:** Store SHA-256 hash; compare by hashing the incoming token.

### Anti-Pattern 7: Letting the owner ID equal the account ID

**What:** Skipping `accounts` as a distinct table, making bookings belong directly to `auth.users.id`.
**Why bad:** "Add team seats later" becomes a painful migration; branding + slug don't have a natural home.
**Instead:** `accounts` as the tenant unit from day one, even with a single owner.

---

## Scalability Considerations

Scope of this tool is small (trade contractors, a handful of bookings per day). But worth knowing when each concern bites.

| Concern | At 1 account / 10 bookings/day | At 100 accounts / 1k bookings/day | At 10k accounts / 100k bookings/day |
|---------|--------------------------------|------------------------------------|--------------------------------------|
| Slot computation | Fine on every request | Cache per (account, event, date) for a few minutes | Pre-compute slot matrix; invalidate on write |
| Reminder cron | Hourly scan fine, tiny result set | Still fine with the partial index | Shard by hash(account_id) across cron runs |
| RLS policy cost | Negligible | Negligible | Re-audit — may need to drop `current_owner_account_ids()` in favor of inline subquery for planner hints |
| Email volume | Free Resend tier (3k/mo) | Paid Resend tier | Multi-provider failover |
| Vercel serverless limits | N/A | N/A | Move cron to Inngest or QStash |
| DB size | MB | GB | Consider partitioning `bookings` by month |

For v1 scope, nothing here requires attention beyond the indexes already specified.

---

## Suggested Build Order

Dependencies inform phase order. Each item below builds on all prior ones.

1. **Foundation: Next.js app + Supabase project wiring**
   - Next.js App Router scaffold, Tailwind, `@supabase/ssr` helpers.
   - Env vars, middleware skeleton, TS strict mode.
   - *Blocks everything.*

2. **Schema + RLS migrations**
   - Create all six tables (`accounts`, `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events`).
   - RLS policies for owners.
   - Seed Andrew's account row manually (no signup UI in v1).
   - *Blocks: every feature below.*

3. **Owner auth + dashboard shell**
   - Supabase Auth email/password.
   - `/app/*` middleware guard.
   - Empty dashboard with nav.
   - *Blocks: event type mgmt, availability mgmt, bookings list.*

4. **Event types CRUD**
   - Create/edit/delete event types in dashboard.
   - *Blocks: public booking page (need an event type to book).*

5. **Availability mgmt UI**
   - Weekly recurring rules editor.
   - Date overrides editor.
   - *Blocks: slot computation.*

6. **Slot computation API (`/api/slots`)**
   - Pure function that combines availability_rules + date_overrides + existing bookings + event_type params → list of free UTC slots.
   - Unit-test heavily with DST-transition fixtures.
   - *Blocks: public booking page, embed.*

7. **Public hosted booking page**
   - `/[account]/[event-slug]` route, branding applied.
   - Slot picker consuming `/api/slots`.
   - Booking form with custom questions.
   - `/api/bookings` handler with unique-constraint race protection.
   - Integrates `@nsi/email-sender` for booker confirmation + owner notification + .ics attachment.
   - *Blocks: embed widget (same logic, different shell), cancel/reschedule.*

8. **Cancel/reschedule flows**
   - Token generation at booking time (already in step 7).
   - `/cancel/[token]`, `/reschedule/[token]` routes.
   - Email updates on cancel/reschedule.
   - *Blocks: nothing; independent after step 7.*

9. **Bookings dashboard (owner side)**
   - List upcoming + past bookings.
   - Owner cancel action.
   - *Blocks: nothing.*

10. **Branding: logo + colors**
    - Supabase Storage bucket for logos.
    - Account settings page.
    - Apply to public pages + embed.
    - *Blocks: nothing, but worth doing before widget — it's the deliverable's value prop.*

11. **Embed widget**
    - `/embed/[account]/[event-slug]` route (chromeless variant of step 7 page).
    - `/embed.js` static loader script.
    - CSP header overrides for `/embed/*`.
    - PostMessage height protocol.
    - *Blocks: nothing.*

12. **Reminder cron**
    - Vercel Cron config.
    - `/api/cron/send-reminders` with CAS claim pattern.
    - *Blocks: nothing; independent once bookings table + email-sender exist.*

13. **Manual QA phase**
    - Per `CLAUDE.md` — explicit final phase. Test widget embed on a real Squarespace / WordPress site. Verify .ics file imports correctly in Gmail, Outlook, Apple Calendar. DST sanity pass.

**Dependency graph (critical path):**
```
1 → 2 → 3 → 4 ──┐
        │       ├→ 6 → 7 → 8
        └── 5 ──┘       │
                        ├→ 9
                        ├→ 10
                        ├→ 11
                        └→ 12
                              ↓
                             13 (QA)
```

Steps 8–12 can be parallelized or reordered after step 7 without blocking.

---

## Confidence & Sources

| Area | Confidence | Basis |
|------|------------|-------|
| Multi-tenant `account_id` + RLS pattern | HIGH | Well-established Supabase idiom; documented extensively in Supabase docs and used by every SaaS template |
| Partial unique index for no-double-book | HIGH | Standard Postgres pattern |
| `TIMESTAMPTZ` + IANA TZ strings | HIGH | Canonical Postgres + IANA guidance |
| `pg_cron` vs Vercel Cron recommendation | MEDIUM-HIGH | Reasoning holds; verify Vercel Hobby cron limits before shipping |
| Embed iframe + postMessage height protocol | HIGH | Same pattern used by Calendly, HubSpot, Intercom |
| Third-party cookie constraints on embed | HIGH | Well-documented browser behavior (Safari ITP, Chrome 3pc phaseout) |
| Tokenized cancel links with SHA-256 hash | HIGH | Standard security pattern for passwordless links |
| Next.js App Router conventions | MEDIUM | Verify exact `@supabase/ssr` API against current docs before implementation (API has evolved) |
| `date-fns-tz` recommendation | MEDIUM | Solid as of training cutoff; check that Temporal hasn't landed natively yet |

**External verification was unavailable during this research pass** (WebSearch / Context7 not accessible). Before writing code in each phase, do a quick Context7 check on: `@supabase/ssr`, `@supabase/supabase-js` latest client shape, Next.js 15+ route handler signatures, and `date-fns-tz` current API. The architecture above doesn't depend on those specifics, but the implementation code will.

---

*Last updated: 2026-04-18*
