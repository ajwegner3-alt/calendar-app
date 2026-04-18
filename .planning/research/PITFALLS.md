# Domain Pitfalls: Multi-Tenant Calendly-Style Booking Tool

**Domain:** Multi-tenant booking / scheduling SaaS (Next.js + Supabase + Resend, embeddable widget, trade-contractor quote bookings)
**Researched:** 2026-04-18
**Overall confidence:** MEDIUM-HIGH (domain pitfalls are well-established; specific Supabase/Vercel/Resend behaviors verified from training data — flag LOW-confidence items below for validation against current docs during the phase that implements them)

---

## Reading Guide

Each pitfall includes:
- **What goes wrong** — the failure mode
- **Why it happens** — root cause
- **Consequences** — observable damage
- **Warning signs** — how to detect early
- **Prevention** — actionable mitigation
- **Phase** — where on the roadmap this should be addressed

"Phase" labels are suggestions, not prescriptive. They map to typical booking-tool phase structure: `Foundation` (schema + RLS), `Availability Engine`, `Booking Flow`, `Widget/Embed`, `Notifications`, `Cancel/Reschedule`, `Hardening`, `Manual QA`.

---

## Critical Pitfalls

Mistakes that cause rewrites, lost revenue, or data leaks. Address proactively, not reactively.

---

### C1. Double-Booking via Read-Then-Write Race Condition

**What goes wrong:** Two bookers hit the same slot within milliseconds. Both requests read "slot is free," both insert a booking. Result: two confirmed bookings for the same time.

**Why it happens:** The naive implementation is:
1. `SELECT` bookings overlapping [start, end]
2. If none → `INSERT` new booking

Between step 1 and step 2, another request can also pass step 1. No database-level exclusion.

**Consequences:**
- Homeowner shows up to a contractor's house at the same time as another booking
- Trust damage for NSI's end clients (the contractors)
- Manual reconciliation, apologetic emails, refunds if money involved

**Warning signs:**
- Any code path that does "check availability then create booking" in separate queries
- Absence of a `UNIQUE` constraint or `EXCLUDE` constraint on `bookings`
- No transaction wrapping availability check + insert
- Load tests with two concurrent requests for the same slot both succeed

**Prevention:**
- **Primary:** Use a PostgreSQL `EXCLUDE USING gist` constraint with `tstzrange` and `&&` (overlaps) operator, scoped by `event_type_id` (and `owner_id` if owner-level conflict matters). Requires `btree_gist` extension. On conflict, the second INSERT fails atomically.
  ```sql
  ALTER TABLE bookings ADD CONSTRAINT no_overlap
    EXCLUDE USING gist (
      event_type_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    ) WHERE (status = 'confirmed');
  ```
- **Secondary:** Wrap the booking creation in a `SECURITY DEFINER` Postgres function that performs the insert and returns a typed error on overlap — the edge layer then returns a clean 409.
- Never rely on application-level locking for this. Serverless = multiple concurrent warm instances; in-memory locks are useless.
- Test with `k6` or a simple `Promise.all` of 20 concurrent POSTs against one slot — exactly one must succeed.

**Phase:** `Foundation` (constraint in initial schema) + `Booking Flow` (error handling for 409).

---

### C2. Timezone Confusion — Storing Local Time Instead of UTC

**What goes wrong:** Developer stores booking time as "10:00" + "America/Chicago" in two columns, or worse, stores a naive timestamp and assumes the server timezone. DST transitions then shift bookings by an hour, or times rendered to the booker differ from the `.ics` file.

**Why it happens:** JavaScript's `Date` and Postgres `timestamp` (without tz) both silently coerce timezones. Developers reach for familiar "HH:MM" strings. The booker's browser, the server, the database, and the owner's timezone rarely align.

**Consequences:**
- Bookings appear at wrong time after DST (spring forward / fall back). Classic: a Nov 5 booking made in October shifts by 1 hour.
- `.ics` file shows 10:00 AM, email shows 11:00 AM, web UI shows 9:00 AM
- Owner misses appointments
- Worst case: a booking inside the "skipped hour" on spring-forward (2:00–3:00 AM doesn't exist in US/Central on the second Sunday of March)

**Warning signs:**
- Any column typed `timestamp` instead of `timestamptz`
- Code using `new Date('2026-03-08T02:30')` without explicit zone
- Using `toLocaleString()` on server without specifying timezone
- Missing IANA timezone string on `users`/`event_types` table (storing "CST" or "-06:00" instead of `America/Chicago`)

**Prevention:**
- Store ALL timestamps as `timestamptz` in Postgres (UTC internally).
- Store the owner's availability using IANA zones (`America/Chicago`, not "CST"). Store on the `event_type` or `user` level.
- Use `date-fns-tz` or `Temporal` (if stable) for conversion. Never use raw `Date` arithmetic for DST-sensitive calculations.
- Generate availability slots by starting in the owner's zone, iterating in wall-clock time, and converting each slot to UTC.
- Skip slots that don't exist (spring forward) or are ambiguous (fall back) — or explicitly handle the ambiguity.
- Always show the booker their detected zone + allow override. Show the owner's time zone for context in confirmation emails.
- In `.ics`, always emit `DTSTART` with `TZID=` and include a `VTIMEZONE` block, OR use UTC with `Z` suffix. Never emit floating time.
- **Test:** pick dates straddling US/EU DST transitions (March 8 2026, Nov 1 2026 for US; March 29 2026 for EU) and verify correctness in unit tests.

**Phase:** `Foundation` (schema) + `Availability Engine` (generation logic) + `Notifications` (.ics).

---

### C3. Service Role Key Leak / Misuse in Public Endpoints

**What goes wrong:** Developer uses the Supabase service-role key in a public API route (e.g., the booking endpoint called by the embed widget). Service role bypasses RLS entirely. A crafted request can then read or write any tenant's data.

**Why it happens:** RLS for anonymous bookers is hard to write correctly. "Just use service role" is the path of least resistance. Or the key ends up in a client bundle because an env var wasn't prefixed correctly.

**Consequences:**
- Cross-tenant data leak (Contractor A's bookings readable by Contractor B or anyone)
- Write access to any row in the database
- Potential GDPR/CCPA incident (PII exposure)
- Unrecoverable trust damage

**Warning signs:**
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` — this prefix ships the key to the browser. Never.
- `createClient(url, SERVICE_ROLE_KEY)` in any route that accepts unauthenticated input
- No RLS policies defined on public-facing tables (default deny not enabled)
- `GRANT ALL` to `anon` role

**Prevention:**
- Service-role key lives ONLY in server-only env vars (no `NEXT_PUBLIC_` prefix) and is used ONLY by trusted server code: cron jobs, admin operations, the confirm-booking RPC if strictly needed.
- Public booking endpoint should use the `anon` key + explicit RLS policies, OR call a `SECURITY DEFINER` function with tight input validation.
- Enable RLS on every table: `ALTER TABLE foo ENABLE ROW LEVEL SECURITY;`. Verify by trying to select from each table as the `anon` role with no policy — must return 0 rows.
- Policies should be scoped by `tenant_id` / `owner_id` joined to the authenticated user's claim (`auth.uid()`), OR for anonymous booking endpoints, by the public slug / event_type id passed in the request AND further constrained by a server-signed token if sensitive.
- Separate "public event_type lookup" (read-only, very narrow columns: name, duration, availability) from "owner dashboard" (authenticated, full row).
- Audit all routes before launch: grep for `SERVICE_ROLE`, `service_role`, `supabaseAdmin`. Each usage must be documented and justified.

**Phase:** `Foundation` (RLS from day one) + `Hardening` (audit pass).

---

### C4. RLS Policy That Looks Right But Isn't Multi-Tenant Safe

**What goes wrong:** RLS policy uses `USING (true)` for public reads, or uses `auth.uid()` but the booker is anonymous, so effectively allows all reads. Or the policy on a join table references only one side of the join.

**Why it happens:** Writing correct RLS for mixed public/authenticated access is genuinely hard. Developers test with their own account and everything "works."

**Consequences:**
- Tenant B can list tenant A's bookings by guessing/iterating IDs
- Anonymous booker can read event_types they shouldn't see (e.g., internal-only ones)
- Enumeration attack exposes customer PII (names, emails, phone numbers from past bookings)

**Warning signs:**
- `USING (true)` on any table with tenant data
- Policies that don't reference `tenant_id`/`owner_id`
- `SELECT *` exposed via PostgREST — returns columns you didn't intend to publish
- No tests using two different tenant accounts

**Prevention:**
- Every tenant-scoped table MUST have `tenant_id` (or equivalent) as a foreign key and every policy MUST filter on it.
- Public read policies should expose ONLY the minimum columns. Use Postgres views (`CREATE VIEW public_event_types AS SELECT slug, name, duration ...`) rather than exposing raw tables.
- For "booker can read the event_type they're booking" — use a policy like `USING (is_public = true AND deleted_at IS NULL)` and keep private types flagged.
- For "booker can read their own booking to confirm/cancel" — require a signed token (HMAC of booking_id + secret), verified server-side, and return via an RPC, not via direct table select.
- Write automated RLS tests: create tenant A, tenant B, and anonymous contexts. For each table, assert allowed/denied access matrix.
- Use Supabase's `pgTAP` or a simple integration test suite that runs on every deploy.

**Phase:** `Foundation` (policy design) + `Hardening` (RLS test matrix).

---

### C5. Email Deliverability — SPF/DKIM/DMARC Misconfiguration with Resend

**What goes wrong:** Launched without verifying the sending domain, or verified only SPF. Booking confirmation emails land in spam. Homeowner never sees the appointment. Contractor thinks the tool doesn't work.

**Why it happens:** Deliverability is invisible until it breaks. Resend does the easy parts (DKIM), but DMARC, MAIL FROM alignment, and warm-up are often skipped.

**Consequences:**
- 20–60% of confirmation emails go to spam
- `.ics` attachments flagged as suspicious
- Domain reputation damaged (hard to recover)
- Contractors churn because "the booking system doesn't email"

**Warning signs:**
- Using Resend's default `onboarding@resend.dev` in production
- No `DMARC` record on the sending domain
- `MAIL FROM` domain differs from `From:` domain (alignment fails)
- Emails with only plain-text or only HTML (no multipart)
- Sending from a fresh domain with no warm-up

**Prevention:**
- Before first production send, verify domain in Resend. Add all DNS records Resend provides:
  - **SPF:** `TXT @ "v=spf1 include:_spf.resend.com -all"` (or softfail `~all` if other senders exist)
  - **DKIM:** CNAME records Resend auto-generates
  - **Return-Path / MAIL FROM:** the CNAME Resend provides for `send.yourdomain.com` so envelope-from aligns with From:
  - **DMARC:** Start with `p=none; rua=mailto:dmarc@yourdomain.com` to gather reports, graduate to `p=quarantine` once aligned.
- Validate with `mail-tester.com` (free, aim for 10/10) and Google Postmaster Tools.
- For NSI's trade-contractor use case: send FROM a dedicated subdomain like `bookings.nsi-tools.com` to preserve the main domain reputation.
- Use plain-text + HTML multipart. Include List-Unsubscribe header for anything that isn't strictly transactional.
- Keep `.ics` attachment under 100KB, with `Content-Type: text/calendar; method=REQUEST; charset=UTF-8; name="invite.ics"`.
- **Warm up:** if the domain is new, send small batches first (< 50/day), increase gradually.
- Log every send with Resend's message ID. Use their webhooks to capture bounces/complaints and suppress those addresses.

**LOW-confidence item (validate during Notifications phase):** Exact Resend DNS record format may have changed — pull fresh from the Resend dashboard at setup time.

**Phase:** `Notifications` (setup before first send) + `Manual QA` (verify with multiple inboxes: Gmail, Outlook, Yahoo, iCloud).

---

### C6. Cron Job Duplicate Reminders (Lack of Idempotency)

**What goes wrong:** Vercel cron fires the 24h-reminder job. The function is slow, times out, Vercel retries. Now two reminders go out. Or the cron fires twice in overlapping windows and sends the same reminder two days in a row.

**Why it happens:** Cron jobs are assumed to fire "exactly once at this time." They don't. Vercel cron is at-least-once. Time windows can overlap. Function timeouts cause retries.

**Consequences:**
- Booker annoyed by duplicate emails (deliverability hit — spam complaints)
- Contractor looks unprofessional
- Resend free-tier quota burned twice as fast
- If timer triggers anything with side effects (SMS, payment capture), duplicate charges

**Warning signs:**
- No `reminder_sent_at` column on bookings
- Cron function queries `WHERE starts_at BETWEEN now() + 23h AND now() + 25h` with no dedupe
- Function logs show retries on the same booking_id
- Function duration near Vercel's free-tier 10s limit (60s on hobby for cron, 10s for default — verify)

**Prevention:**
- Add `reminder_24h_sent_at timestamptz` column on `bookings`. Update it inside the same transaction that sends the email — but sends fail silently if the DB write comes first, so use the order: `UPDATE ... SET reminder_24h_sent_at = now() WHERE reminder_24h_sent_at IS NULL RETURNING *`. If zero rows returned, skip — someone else got it.
- Query pattern: `WHERE starts_at BETWEEN now() + 23h AND now() + 25h AND reminder_24h_sent_at IS NULL AND status = 'confirmed'`
- Use `SELECT ... FOR UPDATE SKIP LOCKED` if processing in batches to prevent two cron runs from racing the same row.
- Make the cron itself idempotent — rerunning it should produce zero new sends if everything was already sent.
- Log every send attempt with booking_id, timestamp, Resend message ID. Alert on duplicates in monitoring.
- **LOW-confidence:** Vercel cron on Hobby tier historically was limited (1/day) — verify current limits at phase implementation. If limited, consider Supabase `pg_cron` as alternative.

**Phase:** `Notifications` / reminder subsystem.

---

### C7. Cron Missing Runs — Bookings Made Inside the Reminder Window

**What goes wrong:** Cron runs daily at 9am. A booking is created at 10am for tomorrow at 9:30am (23.5 hours away). The 9am cron already ran; the next cron is tomorrow 9am — but by then, the booking is only 30 minutes away. Reminder never sent, or sent too late.

**Why it happens:** Daily cron assumes all bookings exist at cron time. New bookings created mid-window slip through.

**Consequences:** Homeowner no-shows because no reminder arrived.

**Warning signs:**
- Cron runs less frequently than the reminder window
- Reminder job doesn't re-scan for newly-created bookings inside the window

**Prevention:**
- Run the reminder cron at least every hour (or every 15 min) and use the `reminder_24h_sent_at IS NULL` gate from C6 to prevent duplicates.
- Alternative: when a booking is created, compute the "reminder fire time" and enqueue it directly (Supabase `pg_cron` with a scheduled job per booking, or a lightweight queue). More complex but avoids polling entirely.
- For trade contractors specifically, consider an immediate "24h reminder" guard: if a booking is created <24h ahead, send the reminder right away on the creation path and mark `reminder_24h_sent_at = now()`.

**Phase:** `Notifications`.

---

### C8. Embed Widget Iframe Height / Responsive Sizing

**What goes wrong:** Widget embedded via iframe with fixed height. Content is taller on mobile, gets scrollbars or cut off. Or user selects a date and the calendar expands but the iframe doesn't, so they can't see the submit button.

**Why it happens:** iframes don't auto-size to content. Cross-origin iframes can't be measured from the parent. Developers pick a "reasonable" height that breaks on real sites.

**Consequences:**
- Booking form unusable on contractor sites — especially mobile (60%+ of homeowner traffic)
- Lost bookings (no conversion)
- Contractor uninstalls the widget

**Warning signs:**
- `<iframe ... height="600">` in the embed snippet
- No `postMessage` communication between widget and parent
- No CSS media queries in widget

**Prevention:**
- Widget posts its measured height via `window.parent.postMessage({ type: 'calendar-app:resize', height })` on every content change (ResizeObserver on the root element).
- Parent embed snippet attaches a `message` listener, validates `event.origin`, and sets `iframe.style.height = data.height + 'px'`.
- Document the snippet clearly. Provide a one-line script tag version that handles this automatically:
  ```html
  <script src="https://your-domain.com/embed.js" data-slug="contractor-abc"></script>
  ```
- Always validate `event.origin` against an allowlist (your own domain) to prevent message spoofing.
- Test embed at 320px, 768px, 1024px, 1440px widths on a real third-party page (not just your own staging).
- Consider also offering a native JS/React embed (renders inline, no iframe) for power users — avoids iframe height issues entirely.

**Phase:** `Widget/Embed`.

---

### C9. Embed Widget CSP / X-Frame-Options / Cross-Origin Blocking

**What goes wrong:** Contractor's website has strict Content Security Policy (`frame-src 'self'`) or the widget domain sets `X-Frame-Options: DENY`. Iframe won't load at all. Or cookies inside the iframe get blocked by SameSite defaults.

**Why it happens:** Default Next.js deployments on Vercel often have `X-Frame-Options: SAMEORIGIN`, blocking cross-origin embedding. Browsers increasingly block third-party cookies.

**Consequences:**
- Widget silently fails on some contractor sites (blank iframe)
- Session/CSRF tokens don't persist inside the iframe
- No error message — contractor thinks product is broken

**Warning signs:**
- `X-Frame-Options: SAMEORIGIN` or `DENY` in response headers on widget URLs
- `Content-Security-Policy` with `frame-ancestors 'self'`
- Widget relies on cookies (instead of localStorage or stateless tokens)
- No CORS configuration on API endpoints called from widget origin

**Prevention:**
- For the widget route (e.g., `/embed/[slug]`), explicitly set:
  - Remove `X-Frame-Options` (or set to `ALLOWALL` — deprecated, better to omit)
  - Set `Content-Security-Policy: frame-ancestors *;` on the embed route (or a specific allowlist if tenants register their embed domains)
- Configure in `next.config.js` with per-path header overrides.
- Design the widget to be stateless or use `localStorage` / URL tokens rather than cookies. If cookies are required, set `SameSite=None; Secure` and be aware some browsers block third-party cookies entirely.
- API endpoints called by the widget must set CORS headers: `Access-Control-Allow-Origin: *` (or allowlist per tenant) and handle `OPTIONS` preflight.
- Provide a "self-hosted" script embed alternative that runs in the contractor's origin and avoids cross-origin issues entirely.
- Test with at least one contractor site that uses a restrictive CSP (e.g., a WordPress site with Wordfence).

**Phase:** `Widget/Embed`.

---

### C10. Email Token for Cancel/Reschedule — Guessable or Long-Lived

**What goes wrong:** Cancel URL uses the booking UUID directly (`/cancel/550e8400-...`) or a short random token. Or the token never expires. Attacker can scrape tokens from email gateways/logs, or enumerate UUIDs, and cancel/reschedule other people's bookings.

**Why it happens:** Developers assume UUIDs are unguessable (they are, by chance, but they show up in logs and are sometimes leaked). Or they generate a short `nanoid` without proper entropy. Or they never set an expiry.

**Consequences:**
- Malicious cancel of competitor's bookings
- PII exposure via cancel page (which might show booking details)
- Spam/harassment of contractors

**Warning signs:**
- Cancel URL contains only the booking ID
- Token has < 128 bits of entropy
- No expiry on token
- Token stored unhashed in the database

**Prevention:**
- Generate an HMAC-signed token: `base64url(booking_id + expiry) + hmac(secret, booking_id + expiry)`. Secret lives in env var, never in DB.
- Alternative: random 256-bit token stored hashed (SHA-256) in DB, verified by hash comparison.
- Expiry: until booking start time + a small buffer (e.g., `starts_at + 1h`). Reschedule tokens become invalid after the booking has happened.
- Rate limit the cancel endpoint (e.g., 10 req/min per IP) to prevent enumeration.
- Log all cancel/reschedule events with IP, user agent, and booking ID for audit.
- Cancel page should NOT display booking details until the token is validated. Never echo back PII on a bad token.
- Send a post-cancel confirmation email — if someone cancels maliciously, the legitimate booker learns about it.

**Phase:** `Cancel/Reschedule`.

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or UX problems but won't sink the product.

---

### M1. Slot Flicker / Stale Availability

**What goes wrong:** Booker sees "10:00 AM available" → clicks → sees "slot no longer available." Bad UX. Worse: booker sees a slot appear, then disappear, then reappear as other requests resolve.

**Why it happens:** Availability is computed on the server and cached aggressively, or polled too slowly, or client-side state isn't invalidated after a failed booking attempt.

**Warning signs:** User complaints about "flickering" slots. Slots available via API but disappearing mid-flow.

**Prevention:**
- Fetch availability with a short cache (30–60s max) and revalidate when the user picks a date.
- On 409-conflict booking attempt, refetch availability and show a clear "that slot was just taken, here are updated options" message.
- Use optimistic UI carefully — mark the slot as "claiming..." on click, not "booked," until server confirms.
- Don't over-cache at the CDN layer for availability endpoints.
- For trade contractors with low booking volume (1–20/day), flicker is rare; for higher-volume tenants later, add short-TTL Redis cache or Supabase realtime subscriptions.

**Phase:** `Availability Engine` / `Booking Flow`.

---

### M2. Buffer / Travel-Time Omissions for Trade-Contractors

**What goes wrong:** Contractor gets back-to-back bookings with no drive time between. 10:00 quote in North Omaha, 11:00 quote in Bellevue → impossible. Or no buffer after a job for notes.

**Why it happens:** Generic Calendly-style tools assume in-office meetings. Trade contractors drive.

**Warning signs:**
- No "buffer before" / "buffer after" setting on event types
- Slot generator ignores existing booking durations when proposing next slot
- No "daily max bookings" cap

**Prevention:**
- Add per-event-type settings: `buffer_before_minutes`, `buffer_after_minutes`, `min_notice_hours` (min time between booking and appointment), `max_per_day`.
- Slot generation subtracts buffers from both sides when checking conflicts.
- For NSI use case specifically: offer a simple "travel buffer" preset (e.g., 30 min) since trade contractors may not think in terms of calendar buffers.
- Defer advanced features (location-aware travel time via Google Maps) to v2.

**Phase:** `Availability Engine`.

---

### M3. Homeowner Phone Number Not Collected / Validated

**What goes wrong:** Contractor needs to call the homeowner to confirm or ask questions. Booking form only collected email. Or phone collected but not validated — "555-1234" won't dial.

**Why it happens:** Default Calendly clones copy the "email only" field list.

**Warning signs:** Contractor feedback: "I can't reach the customer." No phone field in booking form.

**Prevention:**
- Require phone for trade-contractor use case (configurable per event_type).
- Use `libphonenumber-js` for validation and formatting to E.164.
- Don't SMS-verify in MVP (cost + complexity); just validate format.
- Display phone prominently in the contractor's confirmation email + dashboard.

**Phase:** `Booking Flow`.

---

### M4. No Rate Limiting on Public Booking Endpoint

**What goes wrong:** Bot floods the booking endpoint with fake bookings. Either fills legitimate slots (denial of service for real homeowners) or burns Resend quota sending confirmation emails to fake addresses.

**Why it happens:** "It's just an MVP, we'll add rate limiting later."

**Warning signs:** Spike in bookings from one IP. Resend quota unexpectedly exhausted. Slot inventory full but no real customers.

**Prevention:**
- Rate limit per IP (e.g., 5 bookings/hour, 20/day) using Vercel Edge Middleware + Upstash Redis (free tier) or Supabase table with TTL.
- Add a hCaptcha/Cloudflare Turnstile challenge on the booking form (invisible mode, only escalate on suspicion). Free tier available.
- Email verification step (optional): send a "click to confirm your booking" link rather than auto-confirming — reduces junk but adds UX friction. Skip for MVP, consider if abuse appears.
- Keep confirmation email lean (no attachments) until verified if abuse becomes an issue.

**Phase:** `Hardening`.

---

### M5. Long Booking Window Enables "Spam Forever" Bookings

**What goes wrong:** Default booking window is 60+ days out. Bad actors book slots 6 months ahead to block competitors. Or contractors don't want to commit that far out.

**Warning signs:** No `max_days_ahead` setting. Complaints about bookings far in the future.

**Prevention:**
- Configurable per event type: `min_notice_hours` (default 2h for trades) and `max_days_ahead` (default 30).
- Reject bookings outside the window at the DB level via a CHECK constraint or RPC validation.

**Phase:** `Availability Engine`.

---

### M6. Owner Timezone Changes Without Re-computing Availability

**What goes wrong:** Contractor travels, changes their timezone in settings. All future bookings now shift in wall-clock time, confusing both contractor and already-booked customers.

**Warning signs:** No audit log of timezone changes. No "recompute" logic on timezone update.

**Prevention:**
- Store the owner's timezone per-availability-rule, not per-user, so future rules can use a new zone without disturbing past bookings.
- On timezone change, show a warning: "Existing bookings will remain at their confirmed UTC time. Your availability calendar will shift." Don't retroactively change booked appointments.
- Test: flip owner timezone with existing bookings, verify the `.ics` and email text still match the booker's confirmed time.

**Phase:** `Foundation` / `Availability Engine`.

---

### M7. `.ics` File Non-Compliance

**What goes wrong:** `.ics` file doesn't parse in Outlook, doesn't show in Gmail, or shows wrong time in Apple Calendar. Every client is finicky.

**Warning signs:** Customer reports "I added it to my calendar but it's not there" or "wrong time."

**Prevention:**
- Use a well-tested library (`ics` npm package or `ical-generator`) rather than hand-rolling the string.
- Include mandatory fields: `UID` (stable, unique per booking — use booking id + domain), `DTSTAMP`, `DTSTART`, `DTEND`, `SUMMARY`, `ORGANIZER`, `ATTENDEE`.
- For updates/cancellations, increment `SEQUENCE` and use `METHOD:REQUEST` / `METHOD:CANCEL`. Without this, Outlook won't update.
- Use UTC with `Z` suffix for `DTSTART`/`DTEND` to sidestep VTIMEZONE complexity, unless you need recurring events.
- Test with: Gmail web, Gmail iOS, Apple Mail iOS, Outlook Desktop, Outlook Web. These are the big four.

**Phase:** `Notifications`.

---

### M8. Event Type Slug Collisions / Enumeration

**What goes wrong:** Two tenants both want slug "quote". Or tenant's public URL `/book/johns-plumbing/quote` can be enumerated to find other tenants' event types.

**Warning signs:** No uniqueness constraint on `(tenant_id, slug)`. Global slug instead of tenant-scoped.

**Prevention:**
- Slugs are unique per tenant: `UNIQUE (tenant_id, slug)`, not globally unique.
- URL structure: `/book/:tenant_slug/:event_slug` — both required.
- Tenant slug chosen at onboarding, validated against a reserved list (`admin`, `api`, `www`, `embed`, etc.).
- `robots.txt` disallows `/book/*` to discourage search engine enumeration.

**Phase:** `Foundation`.

---

### M9. Vercel Free-Tier Limits Hit Mid-Launch

**What goes wrong:** Launch week, traffic spikes, hit Vercel free-tier limits (function invocations, bandwidth, build minutes). Site goes dark.

**Warning signs:** No monitoring of Vercel usage. Single project absorbing all tenants.

**Prevention:**
- Monitor Vercel usage dashboard weekly.
- Use Edge Functions (cheaper + faster) for availability reads.
- Cache public GETs aggressively with `Cache-Control` + stale-while-revalidate.
- Keep cron minimal — batched queries, not one query per booking.
- Plan the Pro upgrade point ($20/mo) before launch; it's not worth a free-tier outage.

**Phase:** `Hardening` / `Manual QA`.

---

### M10. Supabase Connection Pool Exhaustion

**What goes wrong:** Serverless functions create new Supabase connections per invocation. Under load, you exhaust Postgres's max connections. Requests hang or fail with "too many connections."

**Warning signs:** Random 500s under load. DB logs show connection errors. Using `supabase-js` directly from serverless without pooling.

**Prevention:**
- Use Supabase's transaction-mode connection pooler (PgBouncer) for serverless — the `?pgbouncer=true` URL or the dedicated pooler port (6543).
- Avoid long-running queries from serverless functions.
- For realtime / long-lived connections, use Supabase's realtime API, not direct Postgres connections.

**Phase:** `Foundation` / `Hardening`.

---

## Minor Pitfalls

Annoyances that are fixable post-launch.

---

### m1. No Confirmation Page After Booking

Booker submits form, page spins, nothing happens or shows a raw JSON. **Prevention:** Dedicated confirmation page with booking details, "Add to Calendar" buttons, and cancel link. Phase: `Booking Flow`.

### m2. "Add to Calendar" Buttons Pointing to Wrong URLs

Google Calendar links use `action=TEMPLATE` URL params; Outlook uses different query structure. Easy to get wrong. **Prevention:** Use a library (`add-to-calendar-button`) or test each provider's URL format.

### m3. Missing Favicon / Basic Branding

Widget looks like "yet another Next.js starter." **Prevention:** Branded favicon, OG tags, basic theme colors configurable per tenant.

### m4. No Copy-Paste-Friendly Booking Details

Contractor can't easily copy customer name/phone/address from confirmation email. **Prevention:** Plain-text version of email with details on their own lines.

### m5. Missing Localization for Booker Language

All text in English even when booker is Spanish-speaking. For Omaha trade contractors, non-English speakers are a real customer segment. **Prevention:** Defer to v2 — acknowledge as a limitation in `FUTURE_DIRECTIONS.md`.

### m6. No Loading States / Skeleton UI

Widget feels slow on first load because availability is fetched post-hydration. **Prevention:** Skeleton placeholder for date picker and slot list. Phase: `Widget/Embed`.

### m7. Calendar UI Doesn't Handle "Fully Booked" Days Visibly

Booker clicks a date with zero slots and sees empty list with no explanation. **Prevention:** Pre-compute which dates have ANY availability and gray out the rest.

### m8. No Resend Bounce/Complaint Webhook Handling

Bounced emails aren't flagged; keep sending to dead addresses, hurts deliverability. **Prevention:** Wire Resend webhooks → suppression list table → skip future sends.

### m9. Contractor Onboarding Has No Timezone Prompt

Contractor ends up with UTC timezone by default and bookings look wrong to them. **Prevention:** Detect from browser on signup; require confirmation.

### m10. No Robots / SEO Awareness on Booking Pages

Public booking pages get indexed; stale bookings show in Google results. **Prevention:** `noindex` on individual booking confirmation pages; `index` on the main `/book/:tenant` landing page only if desired.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| `Foundation` (schema + RLS) | C1, C3, C4, M8, M10 | Use `timestamptz`, `EXCLUDE` constraint, RLS-on-by-default, connection pooler. Write RLS test matrix before building features. |
| `Availability Engine` | C2, M1, M2, M5, M6 | Use IANA zones + `date-fns-tz`. Test DST boundaries. Include buffer + notice settings from day one — retrofit is painful. |
| `Booking Flow` | C1, M1, M3 | 409-conflict handling + refetch. Require phone. Don't rely on client-side optimistic state for slot status. |
| `Widget/Embed` | C8, C9, m6 | postMessage height, allow `frame-ancestors`, test on real third-party sites with strict CSP. |
| `Notifications` (email + .ics) | C5, M7, m8 | Set up SPF/DKIM/DMARC before first production send. Test `.ics` in all major clients. Wire Resend bounce webhook. |
| `Cron / Reminders` | C6, C7 | `reminder_24h_sent_at` gate, run more often than the window, handle late-window creates. |
| `Cancel/Reschedule` | C10 | HMAC-signed tokens with expiry. Rate-limit endpoint. Post-cancel confirmation email. |
| `Hardening` | C3, C4, M4, M9, M10 | Audit service-role usage. Run RLS matrix. Add rate limits + Turnstile. Monitor Vercel usage. Confirm connection pooler. |
| `Manual QA` | C5, M7, m8 | Test every email in Gmail/Outlook/Yahoo/iCloud. Test widget on real WordPress + Squarespace + Wix sites. Load-test the booking endpoint for concurrent slot claims. DST transition dry-run. |

---

## Trade-Contractor-Specific Notes

Pitfalls that matter extra for the NSI target customer (plumbers, HVAC, roofers, electricians) taking homeowner quote bookings:

1. **Phone is more important than email.** Contractors prefer calls; homeowners often provide fake/typo emails. Validate phone; make it required.
2. **Travel buffers matter more than "meeting" buffers.** See M2.
3. **Same-day bookings are common.** A burst pipe doesn't wait 48 hours. `min_notice_hours` default should be 2–4h, not 24h.
4. **Address is critical.** Capture street address for the job location; validate format (not necessarily deliverability).
5. **Emergency vs. quote distinction.** Trade contractors often have multiple event types: "Free Quote (30 min)", "Emergency Visit (first available)". Support this via multiple event_types per tenant.
6. **Homeowners use mobile.** The widget MUST work on a phone browser — especially on contractor sites built in Wix/Squarespace/WordPress where the embed might be in a narrow column.
7. **Spam bookings from competitors happen in trades.** See M4. Turnstile is worth the integration effort.
8. **No-shows are costly.** Missed appointments waste contractor fuel + time. The 24h reminder (C6/C7) is directly revenue-protecting.
9. **Contractors are non-technical.** The onboarding must guide them through timezone, availability hours, and embed snippet setup. Assume they've never seen an iframe.
10. **Free-tier constraints are real for NSI's customers too.** Design contractor dashboard to be lean — no unnecessary features — to maximize uptime within Vercel/Supabase free tiers until revenue justifies upgrade.

---

## Sources & Confidence

Most pitfalls here are derived from Claude's training on public engineering postmortems, Supabase/Vercel/Resend docs, and general booking-system literature. Specific items flagged below need fresh verification during the phase that implements them:

| Claim | Confidence | Notes |
|---|---|---|
| PostgreSQL `EXCLUDE USING gist` with `tstzrange` | HIGH | Well-established Postgres feature, stable for years |
| Timezone/DST pitfalls and IANA zone usage | HIGH | Universal across booking systems |
| Supabase RLS + service-role separation | HIGH | Core Supabase security model |
| SPF/DKIM/DMARC general guidance | HIGH | Email standards, stable |
| Resend-specific DNS record format | LOW | Verify in Resend dashboard at setup |
| Vercel cron tier limits (Hobby 1/day vs. every-minute) | LOW | Verify current Vercel pricing page before committing to cron-heavy design |
| Vercel function timeout (10s default / 60s cron) | LOW | Verify current limits |
| Supabase pooler URL / port 6543 | MEDIUM | Historically stable but worth re-verifying |
| hCaptcha / Turnstile free tiers available | MEDIUM | Verify current pricing |
| `add-to-calendar-button` library recommendation | MEDIUM | Library exists; version/maintenance status should be verified when used |

**Gaps to address in later phase-specific research:**
- Exact Resend webhook event schema (for bounce/complaint handling)
- Current Vercel cron minimum interval on Hobby tier
- Current Supabase free-tier connection limit
- Whether Turnstile or hCaptcha has better Next.js 14+ integration in 2026
- Best-in-class `.ics` library actively maintained as of 2026
