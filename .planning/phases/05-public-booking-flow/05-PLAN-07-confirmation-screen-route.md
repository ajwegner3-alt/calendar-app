---
phase: 05-public-booking-flow
plan: 07
type: execute
wave: 4
depends_on: ["05-04", "05-05"]
files_modified:
  - app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx
  - app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts
autonomous: true

must_haves:
  truths:
    - "Public route /[account]/[event-slug]/confirmed/[booking-id] is reachable without auth and is bookmarkable + refresh-safe (CONTEXT decision #6 — overrides RESEARCH Pattern 8)"
    - "Server Component uses createAdminClient() (service-role) to read the booking row keyed by booking-id; same public-route rationale as Plans 05-04/05-05"
    - "RLS-anon-read tradeoff resolved: route uses service-role read keyed by booking.id (UUID v4, 122 bits entropy = effectively unguessable). Defense-in-depth: route ALSO verifies the booking belongs to the (account_slug, event_slug) pair from the URL — cross-tenant or wrong-event access calls notFound(). No magic-token URL param needed; UUID-as-soft-auth is acceptable for a confirmation surface that intentionally shows only the date/time/owner-name/email-stub (no booker PII beyond what's in their email already)."
    - "Loader resolves: booking-id → booking row (status='confirmed'); booking.account_id → account; booking.event_type_id → event_type; verifies account.slug === URL account AND event_type.slug === URL event-slug; if any mismatch → notFound()"
    - "If status != 'confirmed' (e.g. cancelled — Phase 6) → renders a friendly 'This booking has been cancelled' state instead of confirmation; FUTURE-PROOFS for Phase 6 cancel flow without changing the URL"
    - "Confirmation screen renders (CONTEXT decision #7): event_type.name; date/time formatted in BOOKER timezone (booking.booker_timezone); owner display name (account.name); 'Confirmation sent to {booker_email} with calendar invite.'; NO Add-to-Calendar deeplinks"
    - "No raw cancel/reschedule tokens are exposed on this route — they live only in the email"
    - "generateMetadata returns title 'Booking confirmed — {event_type.name}' and a robots: 'noindex, nofollow' directive (a per-booking page should never show in search results)"
    - "404 path: nonexistent booking-id, mismatched account/event slug, or cross-tenant access all hit notFound()"
  artifacts:
    - path: "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx"
      provides: "Confirmation screen Server Component"
      contains: "createAdminClient\\|notFound\\|booker_timezone"
      exports: ["default", "generateMetadata"]
      min_lines: 70
    - path: "app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts"
      provides: "Server-only loader: booking + account + event_type, with cross-tenant verification"
      contains: "loadConfirmedBooking"
      exports: ["loadConfirmedBooking"]
      min_lines: 50
  key_links:
    - from: "page.tsx"
      to: "_lib/load-confirmed-booking.ts"
      via: "loadConfirmedBooking({accountSlug, eventSlug, bookingId})"
      pattern: "loadConfirmedBooking"
    - from: "_lib/load-confirmed-booking.ts"
      to: "lib/supabase/admin.ts"
      via: "createAdminClient() — service-role read keyed by booking.id"
      pattern: "createAdminClient"
    - from: "BookingForm 201 success (Plan 05-06)"
      to: "this route"
      via: "router.push(`/${account.slug}/${event_slug}/confirmed/${bookingId}`)"
      pattern: "/confirmed/"
---

<objective>
Build the dedicated confirmation route at `/[account]/[event-slug]/confirmed/[booking-id]` that the booking flow redirects to after a successful POST. The route is bookmarkable + refresh-safe (CONTEXT decision #6 explicitly overrides RESEARCH Pattern 8 stateful-replacement).

Purpose: BOOK-06 (booker is shown a confirmation screen with booking details after a successful booking). Solves the RLS-anon-read problem the research flagged: use service-role read keyed by `booking.id` UUID, with defense-in-depth tenant + event verification against the URL slugs. UUID-as-soft-authorization is acceptable here because the page exposes ONLY the data already in the booker's email (date/time/owner-name + a "confirmation sent to your-email-stub" note) — no booker PII surface beyond the email they own.

Output: A Server Component page + a server-only loader. No client components needed (static confirmation surface). After this plan ships, the booking flow is end-to-end: visitor → page → form → POST → redirect → confirmation screen.
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
@.planning/phases/05-public-booking-flow/05-04-SUMMARY.md
@.planning/phases/05-public-booking-flow/05-05-SUMMARY.md

# Booking row schema
@supabase/migrations/20260419120000_initial_schema.sql

# Reuse loader patterns from Plan 05-04
@app/[account]/[event-slug]/_lib/load-event-type.ts
@app/[account]/[event-slug]/_lib/types.ts

# Service-role client (already gated server-only)
@lib/supabase/admin.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Confirmation loader + page</name>
  <files>app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts, app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx</files>
  <action>
**`_lib/load-confirmed-booking.ts`:**

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConfirmedBookingData {
  booking: {
    id: string;
    start_at: string;
    end_at: string;
    booker_email: string;
    booker_name: string;
    booker_timezone: string;
    status: "confirmed" | "cancelled" | "rescheduled" | string;
  };
  account: {
    name: string;
    timezone: string;
  };
  eventType: {
    name: string;
    duration_minutes: number;
  };
}

/**
 * Loads a booking + its parent account + event_type, verifying the URL
 * (account-slug, event-slug) matches the booking's actual parents.
 *
 * Authorization model:
 *   - Lookup is keyed by booking.id (UUID v4 — 122 bits entropy).
 *   - Cross-tenant or wrong-event access (URL slug doesn't match booking)
 *     returns null → page calls notFound().
 *   - Status != 'confirmed' returns the row anyway; the page renders a
 *     'this booking is no longer active' state. This future-proofs Phase 6
 *     cancel/reschedule flows without churning this route.
 *
 * Service-role client used because RLS blocks all anon reads on bookings
 * (RLS migration 20260419120001 line 61).
 */
export async function loadConfirmedBooking(args: {
  accountSlug: string;
  eventSlug: string;
  bookingId: string;
}): Promise<ConfirmedBookingData | null> {
  if (!UUID_REGEX.test(args.bookingId)) return null;

  const supabase = createAdminClient();

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      "id, account_id, event_type_id, start_at, end_at, booker_email, booker_name, booker_timezone, status",
    )
    .eq("id", args.bookingId)
    .maybeSingle();

  if (bookingErr || !booking) return null;

  const [accountRes, eventTypeRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("slug, name, timezone")
      .eq("id", booking.account_id)
      .single(),
    supabase
      .from("event_types")
      .select("slug, name, duration_minutes")
      .eq("id", booking.event_type_id)
      .single(),
  ]);

  if (accountRes.error || !accountRes.data) return null;
  if (eventTypeRes.error || !eventTypeRes.data) return null;

  // Defense-in-depth: URL slugs must match booking's actual parents.
  // Without this check, somebody who learns a booking ID could view it via any
  // URL pattern, leaking tenant info via /other-tenant/.../confirmed/ID.
  if (accountRes.data.slug !== args.accountSlug) return null;
  if (eventTypeRes.data.slug !== args.eventSlug) return null;

  return {
    booking: {
      id: booking.id,
      start_at: booking.start_at,
      end_at: booking.end_at,
      booker_email: booking.booker_email,
      booker_name: booking.booker_name,
      booker_timezone: booking.booker_timezone,
      status: booking.status,
    },
    account: {
      name: accountRes.data.name,
      timezone: accountRes.data.timezone,
    },
    eventType: {
      name: eventTypeRes.data.name,
      duration_minutes: eventTypeRes.data.duration_minutes,
    },
  };
}
```

**`page.tsx`:**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { loadConfirmedBooking } from "./_lib/load-confirmed-booking";

interface RouteParams {
  account: string;
  "event-slug": string;
  "booking-id": string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { account, "event-slug": eventSlug, "booking-id": bookingId } = await params;
  const data = await loadConfirmedBooking({
    accountSlug: account,
    eventSlug,
    bookingId,
  });
  if (!data) {
    return { title: "Page not found", robots: { index: false, follow: false } };
  }
  return {
    title: `Booking confirmed — ${data.eventType.name}`,
    robots: { index: false, follow: false }, // never index per-booking confirmation pages
  };
}

export default async function ConfirmedBookingPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { account, "event-slug": eventSlug, "booking-id": bookingId } = await params;
  const data = await loadConfirmedBooking({
    accountSlug: account,
    eventSlug,
    bookingId,
  });
  if (!data) notFound();

  const { booking, account: acct, eventType } = data;
  const isActive = booking.status === "confirmed";

  // Format date/time in BOOKER's timezone (CONTEXT decision #7).
  const startInBookerTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const dateLine = format(startInBookerTz, "EEEE, MMMM d, yyyy");
  const timeLine = format(startInBookerTz, "h:mm a (z)");

  // Mask booker email lightly: show local part + first letter of domain.
  // The booker already knows their own email — this is just to avoid splashing
  // it in clear text on a URL anyone could share.
  const maskedEmail = maskEmail(booking.booker_email);

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      {isActive ? (
        <>
          <header className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              {/* simple checkmark glyph */}
              <span aria-hidden>✓</span>
            </div>
            <h1 className="text-2xl font-semibold">You&apos;re booked.</h1>
          </header>
          <section className="rounded-lg border p-6 space-y-3 text-sm">
            <Row label="Event">{eventType.name}</Row>
            <Row label="When">
              <div>{dateLine}</div>
              <div className="text-muted-foreground">{timeLine}</div>
            </Row>
            <Row label="Duration">{eventType.duration_minutes} min</Row>
            <Row label="With">{acct.name}</Row>
          </section>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Confirmation sent to <strong>{maskedEmail}</strong> with calendar invite.
          </p>
        </>
      ) : (
        <section className="rounded-lg border p-8 text-center text-sm">
          <h1 className="text-xl font-semibold mb-2">This booking is no longer active.</h1>
          <p className="text-muted-foreground">
            Status: {booking.status}. Check your email for the latest details.
          </p>
        </section>
      )}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 items-baseline">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function maskEmail(email: string): string {
  // 'andrew@example.com' -> 'andrew@e***.com'
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const [domainName, ...tldParts] = domain.split(".");
  if (!domainName) return email;
  const maskedDomain = domainName[0] + "*".repeat(Math.max(2, domainName.length - 1));
  return `${local}@${maskedDomain}${tldParts.length ? "." + tldParts.join(".") : ""}`;
}
```

DO NOT:
- Do NOT show the booker's full email, phone, name, or custom-question answers on this page. The page is keyed by a UUID; while UUID v4 is unguessable, anyone with the URL could see the data. Booker info is in the email already; the confirmation page need only confirm "yes, you booked X with Y at Z". Mask the email; omit phone + answers.
- Do NOT show cancel or reschedule tokens or links on this screen. CONTEXT decision #7: ".ics is in email; NO Add-to-Calendar deeplinks". Cancel/reschedule links live only in the email so the act of clicking them carries possession-of-email as a soft auth signal.
- Do NOT use a cookie-scoped supabase client. Anon callers + RLS = silent 0 rows. Service-role required (same rationale as /api/slots, /api/bookings, and /[account]/[event-slug]).
- Do NOT throw on `status !== 'confirmed'`. Phase 6 cancel/reschedule may flip status; render a friendly fallback so this URL never breaks for the booker.
- Do NOT add a "Manage booking" link on this screen — Phase 6 owns that surface; keeping the screen static for v1.
- Do NOT use ISR / static generation. Per-booking pages are dynamic; the route is naturally per-request via the booking-id param. No `force-dynamic` directive needed.
- Do NOT generateStaticParams() — there are no static params; per-booking IDs only exist after a POST.
  </action>
  <verify>
```bash
ls "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx" "app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts"

# server-only on loader
head -2 "app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts" | grep -q 'import "server-only"' && echo "server-only ok"

# Tenant verification
grep -q "accountRes.data.slug !== args.accountSlug" "app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts" && echo "tenant slug verified"
grep -q "eventTypeRes.data.slug !== args.eventSlug" "app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts" && echo "event slug verified"

# Admin client + booker_timezone formatting
grep -q "createAdminClient" "app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts" && echo "admin client ok"
grep -q "booker_timezone" "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx" && echo "TZ formatting ok"

# Email masked, no full PII shown
grep -q "maskEmail" "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx" && echo "email masking ok"

# noindex
grep -q "robots" "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx" && echo "noindex ok"

# Status fallback
grep -q "isActive" "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx" && echo "status fallback ok"

npm run build
npm run lint
```
  </verify>
  <done>
Two files exist. Loader uses service-role admin client, verifies URL slugs match booking's actual parents (defense-in-depth against ID guessing for cross-tenant access). Page renders confirmation in BOOKER timezone, masks email, shows "Confirmation sent to ... with calendar invite." copy (no Add-to-Calendar buttons, no full PII). Cancelled/rescheduled status renders friendly fallback. `noindex` metadata. `npm run build` + `npm run lint` exit 0.

Commit: `feat(05-07): add confirmation screen route /[account]/[event-slug]/confirmed/[booking-id]`. Push.

Final smoke (after Vercel deploy + a successful booking via the form):
```bash
# Take the redirectTo from a 201 response of /api/bookings, navigate to it, verify:
#   - Page renders 200
#   - Date/time in booker TZ
#   - Email masked
#   - View page source: <meta name="robots" content="noindex, nofollow">
#   - Visit a different account-slug or event-slug with the same booking-id → 404
```
  </done>
</task>

</tasks>

<verification>
```bash
ls "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx" "app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts"
npm run build
npm run lint
```
</verification>

<success_criteria>
- [ ] Route `/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` exists; renders 200 for valid combo; 404 for any mismatch
- [ ] Loader uses `createAdminClient()` (service-role); rationale: RLS blocks anon reads on bookings (locked from migration line 61)
- [ ] Loader verifies URL `accountSlug` matches `bookings.account.slug` AND URL `eventSlug` matches `bookings.event_type.slug` (cross-tenant defense-in-depth)
- [ ] UUID regex validates `booking-id` param before any DB query
- [ ] Date/time formatted in `booking.booker_timezone` (NOT account.timezone) — CONTEXT decision #7
- [ ] Booker email masked on screen; phone + custom-question answers NOT shown
- [ ] Page text matches CONTEXT decision #7: event name, date/time in booker TZ, owner name, "Confirmation sent to [masked email] with calendar invite."
- [ ] No Add-to-Calendar deeplinks (CONTEXT decision #7 lock)
- [ ] No cancel/reschedule URLs on this page (those live in the email only)
- [ ] `generateMetadata` sets `robots: { index: false, follow: false }`
- [ ] Status != 'confirmed' renders friendly "no longer active" fallback
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Single commit, pushed
</success_criteria>

<output>
After completion, create `.planning/phases/05-public-booking-flow/05-07-SUMMARY.md` documenting:
- The RLS-anon-read tradeoff resolution (UUID-as-soft-auth + tenant verification + service-role)
- Why no client components (static surface)
- The exact email masking algorithm chosen
- The status-fallback behavior (future-proofs Phase 6)
- Confirmed: no PII beyond what's in the booker's own email is shown
- Locked URL pattern: `/[account]/[event-slug]/confirmed/[booking-id]` (consumed by Plan 05-05's redirectTo response)
</output>
