---
phase: 05-public-booking-flow
plan: 04
type: execute
wave: 2
depends_on: ["05-01"]
files_modified:
  - app/[account]/[event-slug]/page.tsx
  - app/[account]/[event-slug]/_lib/types.ts
  - app/[account]/[event-slug]/_lib/load-event-type.ts
  - app/[account]/[event-slug]/not-found.tsx
autonomous: true

must_haves:
  truths:
    - "Public route /[account]/[event-slug] reachable WITHOUT auth (BOOK-01) — proxy.ts already only gates /app, no proxy changes"
    - "Page is a Server Component using createAdminClient() (no anon RLS would block reads — locked Phase 4 pattern reused)"
    - "Reserved slug guard: if account === 'app' || 'api' || '_next' || 'auth', call notFound() before any DB query (RESEARCH Pitfall 6)"
    - "Loads accounts row by slug — { id, name, timezone, owner_email } — calls notFound() if missing"
    - "Loads event_types row by (account_id, slug) filtered .eq('is_active', true).is('deleted_at', null) — { id, name, description, duration_minutes, custom_questions } — calls notFound() if missing"
    - "Server Component renders the page shell: header (event name + duration + owner name + 'Times shown in [TZ]' line that hydrates to booker TZ on client), then a <BookingShell> client component receives accountRow + eventType as serializable props"
    - "Empty-state copy is server-rendered as fallback if BookingShell receives no slots (Plan 05-06 wires this); shell defines the friendly empty-state pattern with mailto:[owner_email] link (CONTEXT decision #2)"
    - "not-found.tsx renders a friendly 'Page not found' message — no leaking of slug, no SEO meta hint that the route would have existed"
    - "Page metadata: title = `[event_type.name] — [account.name]`, description = event_type.description (truncated to ~160 chars) — basic OG/SEO surface; favicon defaults to root"
  artifacts:
    - path: "app/[account]/[event-slug]/page.tsx"
      provides: "Public booking page Server Component"
      contains: "BookingShell\\|createAdminClient"
      exports: ["default", "generateMetadata"]
      min_lines: 70
    - path: "app/[account]/[event-slug]/_lib/types.ts"
      provides: "Shared types passed from Server Component to client"
      contains: "BookingPageData"
      exports: ["BookingPageData", "AccountSummary", "EventTypeSummary"]
      min_lines: 20
    - path: "app/[account]/[event-slug]/_lib/load-event-type.ts"
      provides: "Loader function: resolves account by slug, then event_type, returns null if either missing"
      contains: "loadEventTypeForBookingPage"
      exports: ["loadEventTypeForBookingPage"]
      min_lines: 40
    - path: "app/[account]/[event-slug]/not-found.tsx"
      provides: "404 fallback for missing account or event-type"
      contains: "notFound\\|Page not found"
      min_lines: 10
  key_links:
    - from: "app/[account]/[event-slug]/page.tsx"
      to: "lib/supabase/admin.ts"
      via: "createAdminClient() — service-role, RLS-bypass for public read"
      pattern: "createAdminClient"
    - from: "app/[account]/[event-slug]/page.tsx"
      to: "_lib/load-event-type.ts"
      via: "import { loadEventTypeForBookingPage }"
      pattern: "loadEventTypeForBookingPage"
    - from: "app/[account]/[event-slug]/page.tsx"
      to: "_components/booking-shell.tsx (Plan 05-06)"
      via: "<BookingShell account={...} eventType={...} />"
      pattern: "BookingShell"
---

<objective>
Build the Server Component shell for the public booking page at `/[account]/[event-slug]`. Resolve the account by slug, then the event-type by (account_id, slug), filter inactive + soft-deleted, render a header + a `<BookingShell>` client component slot that Plan 05-06 will fill with the calendar + slot picker + form.

Purpose: BOOK-01 (public, no-auth route exists). BOOK-02/03 partially (TZ display + calendar shown), but live UI behavior depends on Plan 05-06 client components. Reserved-slug guard (`Pitfall 6`) lives here. The page renders even if no slots are available — empty-state messaging is owned by `BookingShell` once Plan 05-06 ships.

Output: One Server Component (`page.tsx`), one not-found fallback, one shared-types module, and one server-only loader. The page builds with no client components imported yet (Plan 05-06 fills the import). Until Plan 05-06 ships, render a placeholder body so the route 200s for visual smoke.
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

# Reference: identical service-role public-page pattern (Phase 4)
@app/api/slots/route.ts
@lib/supabase/admin.ts

# Phase 3 event_types schema reference for custom_questions
@app/(shell)/app/event-types/_lib/schema.ts
@supabase/migrations/20260424120000_event_types_soft_delete.sql

# Proxy gate (no changes; just to confirm /app-only)
@proxy.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Shared types + loader</name>
  <files>app/[account]/[event-slug]/_lib/types.ts, app/[account]/[event-slug]/_lib/load-event-type.ts, app/[account]/[event-slug]/not-found.tsx</files>
  <action>
**`_lib/types.ts`:**

```typescript
// Shared types between the Server Component (page.tsx) and the client shell.
// Must be JSON-serializable — Server -> Client prop boundary.

export interface AccountSummary {
  id: string;
  slug: string;
  name: string;
  timezone: string;        // IANA — owner's TZ
  owner_email: string | null;
}

export interface CustomQuestion {
  id?: string;
  label: string;
  type: "short_text" | "long_text" | "select" | "radio" | string; // permissive — Phase 3 owns the enum
  required: boolean;
  options?: string[];
}

export interface EventTypeSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  custom_questions: CustomQuestion[];
}

export interface BookingPageData {
  account: AccountSummary;
  eventType: EventTypeSummary;
}
```

**`_lib/load-event-type.ts`:**

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingPageData, CustomQuestion } from "./types";

const RESERVED_SLUGS = new Set(["app", "api", "_next", "auth"]);

/**
 * Loads account + event_type for the public booking page.
 *
 * - Service-role client (RLS would silently return 0 rows for anon).
 *   Same rationale as /api/slots: route is public, no auth session.
 * - Returns null if account-slug is reserved, account row missing, or
 *   event_type missing/inactive/soft-deleted.
 */
export async function loadEventTypeForBookingPage(
  accountSlug: string,
  eventSlug: string,
): Promise<BookingPageData | null> {
  if (RESERVED_SLUGS.has(accountSlug)) return null;

  const supabase = createAdminClient();

  // 1. Account
  const { data: accountRow, error: accountError } = await supabase
    .from("accounts")
    .select("id, slug, name, timezone, owner_email")
    .eq("slug", accountSlug)
    .maybeSingle();

  if (accountError || !accountRow) return null;

  // 2. Event type — active + not soft-deleted
  const { data: eventTypeRow, error: etError } = await supabase
    .from("event_types")
    .select("id, slug, name, description, duration_minutes, custom_questions")
    .eq("account_id", accountRow.id)
    .eq("slug", eventSlug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (etError || !eventTypeRow) return null;

  // custom_questions is jsonb — coerce defensively
  const customQuestions: CustomQuestion[] = Array.isArray(
    eventTypeRow.custom_questions,
  )
    ? (eventTypeRow.custom_questions as CustomQuestion[])
    : [];

  return {
    account: {
      id: accountRow.id,
      slug: accountRow.slug,
      name: accountRow.name,
      timezone: accountRow.timezone,
      owner_email: accountRow.owner_email,
    },
    eventType: {
      id: eventTypeRow.id,
      slug: eventTypeRow.slug,
      name: eventTypeRow.name,
      description: eventTypeRow.description,
      duration_minutes: eventTypeRow.duration_minutes,
      custom_questions: customQuestions,
    },
  };
}
```

**`not-found.tsx`:**

```typescript
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-muted-foreground">
        The booking page you&apos;re looking for doesn&apos;t exist or is no longer active.
      </p>
    </main>
  );
}
```

DO NOT:
- Do NOT auth-gate this route in `proxy.ts`. CONTEXT says public; STATE.md confirms proxy gate is `/app/*`-only.
- Do NOT use the cookie-based `createClient()` from `lib/supabase/server.ts`. Anon caller has no cookies, RLS blocks reads, page silently 404s. Use admin client (matches /api/slots pattern).
- Do NOT include `account.owner_email` in the URL or in client-rendered HTML beyond the empty-state mailto: link. Treat email as semi-private (not load-bearing PII for v1, but no need to splash in `<title>` or OG description).
- Do NOT add ISR / revalidate. Booking pages are dynamic by nature — slot data is request-time, and `force-dynamic` is on /api/slots. Don't accidentally cache the page-level shell either; rely on Next 16 default per-request rendering for dynamic routes.
- Do NOT pre-fetch slots in the Server Component. The client `BookingShell` (Plan 05-06) fetches /api/slots after browser TZ detection — keeps server data minimal and avoids double-fetch.
  </action>
  <verify>
```bash
ls "app/[account]/[event-slug]/_lib/types.ts" "app/[account]/[event-slug]/_lib/load-event-type.ts" "app/[account]/[event-slug]/not-found.tsx"

# server-only on loader
head -2 "app/[account]/[event-slug]/_lib/load-event-type.ts" | grep -q 'import "server-only"' && echo "server-only ok"

# Reserved slug set
grep -q "RESERVED_SLUGS" "app/[account]/[event-slug]/_lib/load-event-type.ts" && echo "reserved slugs guard ok"

# Filters present
grep -q '.eq("is_active", true)' "app/[account]/[event-slug]/_lib/load-event-type.ts" && echo "is_active filter ok"
grep -q '.is("deleted_at", null)' "app/[account]/[event-slug]/_lib/load-event-type.ts" && echo "soft-delete filter ok"

# Admin client used
grep -q "createAdminClient" "app/[account]/[event-slug]/_lib/load-event-type.ts" && echo "admin client ok"

# Type exports
grep -q "BookingPageData" "app/[account]/[event-slug]/_lib/types.ts" && echo "data type exported"
```
  </verify>
  <done>
Three files exist. Loader uses admin client; reserved-slug set includes `app`/`api`/`_next`/`auth`; filters by `is_active` + `deleted_at IS NULL`; returns null on any miss. not-found.tsx renders a friendly fallback. Types are JSON-serializable for Server→Client prop crossing.

Commit: `feat(05-04): add booking-page loader + types + not-found`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Server Component page + metadata</name>
  <files>app/[account]/[event-slug]/page.tsx</files>
  <action>
```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadEventTypeForBookingPage } from "./_lib/load-event-type";

interface RouteParams {
  account: string;
  "event-slug": string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { account, "event-slug": eventSlug } = await params;
  const data = await loadEventTypeForBookingPage(account, eventSlug);
  if (!data) {
    return { title: "Page not found" };
  }
  return {
    title: `${data.eventType.name} — ${data.account.name}`,
    description: data.eventType.description?.slice(0, 160) ?? `Book a time with ${data.account.name}.`,
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { account, "event-slug": eventSlug } = await params;
  const data = await loadEventTypeForBookingPage(account, eventSlug);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">{data.account.name}</p>
        <h1 className="text-2xl font-semibold mt-1">{data.eventType.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.eventType.duration_minutes} min
          {data.eventType.description ? ` · ${data.eventType.description}` : ""}
        </p>
      </header>

      {/*
        BookingShell is a "use client" component (Plan 05-06). It owns:
          - browser TZ detection (Intl.DateTimeFormat().resolvedOptions().timeZone)
          - "Times shown in [TZ]" line above slot list
          - calendar + slot picker, fetching /api/slots
          - booking form with Turnstile
          - 409 race-loser banner + Turnstile reset on error
          - empty-state w/ mailto:[owner_email] link
        Server Component passes the loaded data as serializable props.
      */}
      {/* @ts-expect-error — BookingShell ships in Plan 05-06; placeholder until then */}
      <BookingShell account={data.account} eventType={data.eventType} />
    </main>
  );
}

// Until Plan 05-06 ships BookingShell, render a placeholder so the route 200s
// during Wave 2 verification. Plan 05-06 will replace this stub with the real
// import. Keep the export name stable so the page.tsx body is unchanged when
// the swap happens.
function BookingShell(props: {
  account: { name: string; owner_email: string | null };
  eventType: { name: string };
}) {
  return (
    <section className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
      Booking interface loads here (Plan 05-06).
      {props.account.owner_email ? (
        <p className="mt-2">
          Or email{" "}
          <a className="underline" href={`mailto:${props.account.owner_email}`}>
            {props.account.owner_email}
          </a>{" "}
          to book directly.
        </p>
      ) : null}
    </section>
  );
}
```

When Plan 05-06 ships, that plan deletes the inline `BookingShell` stub function and replaces it with `import { BookingShell } from "./_components/booking-shell"`. The `@ts-expect-error` line gets removed at the same time. Keep the comment markers below intact so Plan 05-06 patches cleanly:

Before the import: `// PLAN-05-06-REPLACE-IMPORT-START` ... `// PLAN-05-06-REPLACE-IMPORT-END`
Around the inline function: `// PLAN-05-06-REPLACE-INLINE-START` ... `// PLAN-05-06-REPLACE-INLINE-END`

Add those markers around the relevant blocks so Plan 05-06 has unambiguous patch points.

DO NOT:
- Do NOT add a layout.tsx under this segment. Default root layout is fine; if Phase 7 needs branding inheritance, a layout segment can be added then.
- Do NOT prefetch slots, availability, or bookings server-side. Slot data is client-driven (request /api/slots after TZ detection). Server-side prefetch couples the page to TZ assumptions.
- Do NOT include analytics/page-view tracking in this plan — Phase 8 hardening territory.
- Do NOT export `dynamic = "force-dynamic"` from this page. It's a dynamic route by virtue of `[account]/[event-slug]` segments + service-role client (cookies not used; auto-skipped from prerendering). Forcing dynamic adds nothing.
  </action>
  <verify>
```bash
ls "app/[account]/[event-slug]/page.tsx"

# default + generateMetadata exports
grep -q "export default async function" "app/[account]/[event-slug]/page.tsx" && echo "page exported"
grep -q "export async function generateMetadata" "app/[account]/[event-slug]/page.tsx" && echo "metadata exported"

# Reserved-slug guard reachable through loader (already covered by Task 1)
grep -q "loadEventTypeForBookingPage" "app/[account]/[event-slug]/page.tsx" && echo "loader wired"
grep -q "notFound" "app/[account]/[event-slug]/page.tsx" && echo "notFound wired"

# Patch markers for Plan 05-06
grep -q "PLAN-05-06-REPLACE-IMPORT-START" "app/[account]/[event-slug]/page.tsx" && echo "import marker"
grep -q "PLAN-05-06-REPLACE-INLINE-START" "app/[account]/[event-slug]/page.tsx" && echo "inline marker"

# Build
npm run build
npm run lint

# Local smoke (optional — requires npm run dev in another terminal)
# Visit http://localhost:3000/nsi/<some-active-slug> — should see header + placeholder
# Visit http://localhost:3000/app/page.tsx-ish path won't be hit (proxy redirects),
# but visiting http://localhost:3000/api/foo would be a different concern.
# Reserved-slug test: http://localhost:3000/app/anything → already proxy-redirected to login,
# so the reserved-slug guard fires only on truly external slugs that don't collide with proxy.
```
  </verify>
  <done>
`app/[account]/[event-slug]/page.tsx` exists with `default` + `generateMetadata` async exports. Calls `loadEventTypeForBookingPage()`, calls `notFound()` on null. Renders header (account name + event name + duration) + a placeholder `<BookingShell>` (Plan 05-06 swaps to real import via patch markers). `npm run build` + `npm run lint` exit 0.

Commit: `feat(05-04): add public booking page server component shell`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# All 4 files in place
ls "app/[account]/[event-slug]/page.tsx" "app/[account]/[event-slug]/_lib/types.ts" "app/[account]/[event-slug]/_lib/load-event-type.ts" "app/[account]/[event-slug]/not-found.tsx"

# Build + lint clean
npm run build
npm run lint

# Live smoke (after Vercel deploy)
# curl -s -o /dev/null -w "%{http_code}\n" "https://calendar-app-xi-smoky.vercel.app/nsi/<active-slug>"
# Expected: 200 with page HTML containing event name + placeholder text
# curl -s -o /dev/null -w "%{http_code}\n" "https://calendar-app-xi-smoky.vercel.app/nsi/no-such-event"
# Expected: 404
# curl -s -o /dev/null -w "%{http_code}\n" "https://calendar-app-xi-smoky.vercel.app/app/anything-or-other"
# Expected: 307 (proxy redirect to login) — confirms reserved-slug never hits the loader
```
</verification>

<success_criteria>
- [ ] `app/[account]/[event-slug]/page.tsx` exists; renders 200 for valid (account, event) pair; renders 404 for unknown
- [ ] Reserved slug guard returns null from loader for `app`/`api`/`_next`/`auth` (delegated through `loadEventTypeForBookingPage`)
- [ ] Loader uses `createAdminClient()` (NOT cookie-scoped); filters event_type by `is_active=true` AND `deleted_at IS NULL`
- [ ] `generateMetadata` returns title `[event] — [account]` and description from event_type.description (truncated)
- [ ] Patch markers in page.tsx for Plan 05-06 swap (`PLAN-05-06-REPLACE-IMPORT-START/END`, `PLAN-05-06-REPLACE-INLINE-START/END`)
- [ ] not-found.tsx renders friendly message
- [ ] Empty-state placeholder (until Plan 05-06) shows mailto:[owner_email] link when present (CONTEXT decision #2 pattern stub)
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/05-public-booking-flow/05-04-SUMMARY.md` documenting:
- The reserved-slug list locked here: `["app", "api", "_next", "auth"]` — Phase 7 may add `embed` if a future `/embed/[account]/[slug]` route is added
- The exact prop shape passed to `BookingShell` (locked Wave 2 → Wave 3 contract; Plan 05-06 must consume identical shape)
- The patch markers for Plan 05-06 (file + line numbers)
- Decision: page does NOT prefetch slots; client owns the /api/slots request
- generateMetadata behavior + truncation
</output>
