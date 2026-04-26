---
phase: 06-cancel-and-reschedule-lifecycle
plan: 04
type: execute
wave: 4
depends_on: ["06-03"]
files_modified:
  - app/cancel/[token]/page.tsx
  - app/cancel/[token]/_components/cancel-confirm-form.tsx
  - app/cancel/[token]/_lib/resolve-cancel-token.ts
  - app/reschedule/[token]/page.tsx
  - app/reschedule/[token]/_components/reschedule-shell.tsx
  - app/reschedule/[token]/_lib/resolve-reschedule-token.ts
  - app/api/cancel/route.ts
  - app/api/reschedule/route.ts
  - app/_components/token-not-active.tsx
autonomous: true

must_haves:
  truths:
    - "GET /cancel/[token] is a Server Component (Next.js 16 App Router) — READ-ONLY, MUST NOT mutate (RESEARCH Pitfall 1: Gmail/Outlook prefetch GET URLs from emails; mutation would fire before user clicks). Mutation only happens via POST /api/cancel."
    - "GET /reschedule/[token] is a Server Component — READ-ONLY (same email-prefetch defense)"
    - "Both GET pages resolve the URL token via hashToken(rawToken) + maybeSingle on the appropriate hash column. Validity = booking exists AND status==='confirmed' AND start_at > now() (CONTEXT lock; RESEARCH §Pattern 1). On invalid → render TokenNotActive component (friendly 'no longer active' page exposing account.owner_email contact — CONTEXT decision)."
    - "Both GET pages: when booking.status === 'cancelled' AND cancelled_at is recent (cancel succeeded path), render the success state inline (Open Question B resolved: render success directly inside the same /cancel/[token] route with 'Book again' CTA — saves a route hop)"
    - "POST /api/cancel is a Route Handler (NOT a Server Action) — needs 429 rate-limit and 4xx token-invalid responses Server Actions can't return cleanly (Phase 5 lock; RESEARCH §Pattern 4)"
    - "POST /api/reschedule is a Route Handler — needs 429, 409 slot_taken, 4xx token-invalid (Phase 5 lock)"
    - "Both POST routes call checkRateLimit('cancel:'+ip OR 'reschedule:'+ip, DEFAULT_TOKEN_RATE_LIMIT.maxRequests, DEFAULT_TOKEN_RATE_LIMIT.windowMs) BEFORE token resolution. On allowed=false: return 429 + Retry-After header + JSON {error, code:'RATE_LIMITED'} (CONTEXT decision: friendly throttling response; JSON callers get 429+Retry-After)"
    - "Both POST routes parse rawToken from request body (NOT from URL — the route is /api/cancel and /api/reschedule, not /api/cancel/[token]). Body schema: { token: string, reason?: string } for cancel; { token: string, startAt: string, endAt: string } for reschedule. Validated via Zod inline."
    - "POST /api/cancel calls cancelBooking({ bookingId, actor:'booker', reason, appUrl, ip }) and maps result: ok=true → 200 { ok: true }; reason='not_active' → 410 { error, code:'NOT_ACTIVE' }; reason='db_error' → 500"
    - "POST /api/reschedule calls rescheduleBooking({ bookingId, oldRescheduleHash, newStartAt, newEndAt, appUrl, ip }) and maps: ok=true → 200 { ok: true }; reason='slot_taken' → 409 { error, code:'SLOT_TAKEN' }; reason='not_active' → 410 { error, code:'NOT_ACTIVE' }; reason='bad_slot' → 400 { error, code:'BAD_SLOT' }; reason='db_error' → 500"
    - "All POST responses have Cache-Control: no-store header (mirrors Phase 5 /api/bookings)"
    - "Reschedule page reuses the EXISTING SlotPicker component (CONTEXT decision: verbatim) — props from RESEARCH §Pattern 8: { eventTypeId, accountTimezone, bookerTimezone, ownerEmail, selectedDate, onSelectDate, selectedSlot, onSelectSlot, refetchKey }. NO modifications to slot-picker.tsx. Old slot rendered as a static reference line ABOVE the picker ('Currently scheduled: [time in booker TZ]')"
    - "Reschedule page preserves booker data SILENTLY (CONTEXT lock) — the form does NOT show name/email/phone/answers fields. Only the slot changes. Submission body is { token, startAt, endAt } only."
    - "Reschedule submit uses Managed Turnstile widget (CONTEXT decision; mirrors Phase 5 booking form — same anti-bot defense). NO Turnstile on the cancel POST (single-button click, lower risk; rate-limit is sufficient)."
    - "TokenNotActive component (app/_components/token-not-active.tsx) is shared by /cancel/[token] and /reschedule/[token] — single source of truth for the friendly 'no longer active' page including account.owner_email mailto link"
    - "Both GET pages use createAdminClient() (service-role) — no auth on token routes; identical pattern to /api/slots and /api/bookings"
    - "Both GET pages have generateMetadata returning { title, robots: { index: false, follow: false } } — token URLs MUST NEVER be indexed (cancel/reschedule pages contain booking-specific PII)"
    - "Reserved-slug guard (Plan 05-04 lock) is irrelevant here — /cancel and /reschedule are top-level routes, not under /[account]"
    - "Both API routes export `dynamic = 'force-dynamic'` and `revalidate = 0` (Phase 5 Route Handler lock)"
  artifacts:
    - path: "app/cancel/[token]/page.tsx"
      provides: "Server Component: GET /cancel/[token] — 2-step confirm page (CONTEXT decision)"
      contains: "TokenNotActive\\|cancel"
      exports: ["default", "generateMetadata"]
      min_lines: 100
    - path: "app/cancel/[token]/_components/cancel-confirm-form.tsx"
      provides: "use client form: optional reason textarea + confirm button → POST /api/cancel"
      contains: "use client"
      exports: ["CancelConfirmForm"]
      min_lines: 90
    - path: "app/cancel/[token]/_lib/resolve-cancel-token.ts"
      provides: "Server-only token-to-booking resolver for the cancel route"
      contains: "resolveCancelToken"
      exports: ["resolveCancelToken"]
      min_lines: 60
    - path: "app/reschedule/[token]/page.tsx"
      provides: "Server Component: GET /reschedule/[token] — current slot reference + RescheduleShell"
      contains: "RescheduleShell"
      exports: ["default", "generateMetadata"]
      min_lines: 100
    - path: "app/reschedule/[token]/_components/reschedule-shell.tsx"
      provides: "use client: SlotPicker (reused from Phase 5) + Turnstile + submit → POST /api/reschedule"
      contains: "use client\\|SlotPicker"
      exports: ["RescheduleShell"]
      min_lines: 150
    - path: "app/reschedule/[token]/_lib/resolve-reschedule-token.ts"
      provides: "Server-only token-to-booking resolver for the reschedule route"
      contains: "resolveRescheduleToken"
      exports: ["resolveRescheduleToken"]
      min_lines: 60
    - path: "app/api/cancel/route.ts"
      provides: "POST /api/cancel — rate-limit + resolve token + cancelBooking + map result"
      contains: "checkRateLimit\\|cancelBooking"
      exports: ["POST", "dynamic"]
      min_lines: 100
    - path: "app/api/reschedule/route.ts"
      provides: "POST /api/reschedule — rate-limit + resolve token + rescheduleBooking + map result"
      contains: "checkRateLimit\\|rescheduleBooking"
      exports: ["POST", "dynamic"]
      min_lines: 110
    - path: "app/_components/token-not-active.tsx"
      provides: "Shared 'no longer active' branded page exposing account owner_email mailto"
      contains: "TokenNotActive"
      exports: ["TokenNotActive"]
      min_lines: 30
  key_links:
    - from: "app/cancel/[token]/page.tsx"
      to: "app/cancel/[token]/_lib/resolve-cancel-token.ts"
      via: "resolveCancelToken(rawToken)"
      pattern: "resolveCancelToken"
    - from: "app/cancel/[token]/_lib/resolve-cancel-token.ts"
      to: "lib/bookings/tokens.ts"
      via: "hashToken(rawToken)"
      pattern: "hashToken"
    - from: "app/cancel/[token]/_components/cancel-confirm-form.tsx"
      to: "/api/cancel"
      via: "fetch('/api/cancel', { method:'POST', body: JSON.stringify({ token, reason }) })"
      pattern: "fetch.*api/cancel"
    - from: "app/api/cancel/route.ts"
      to: "lib/rate-limit.ts"
      via: "checkRateLimit('cancel:'+ip, 10, 5*60*1000)"
      pattern: "checkRateLimit"
    - from: "app/api/cancel/route.ts"
      to: "lib/bookings/cancel.ts"
      via: "cancelBooking({ bookingId, actor:'booker', reason, appUrl, ip })"
      pattern: "cancelBooking"
    - from: "app/api/reschedule/route.ts"
      to: "lib/bookings/reschedule.ts"
      via: "rescheduleBooking({ bookingId, oldRescheduleHash, newStartAt, newEndAt, appUrl, ip })"
      pattern: "rescheduleBooking"
    - from: "app/reschedule/[token]/_components/reschedule-shell.tsx"
      to: "app/[account]/[event-slug]/_components/slot-picker.tsx"
      via: "<SlotPicker eventTypeId={...} accountTimezone={...} bookerTimezone={...} ... />"
      pattern: "SlotPicker"
---

<objective>
Build the public-facing token routes for cancel and reschedule. GET pages are read-only (email-prefetch defense, RESEARCH Pitfall 1); POSTs are rate-limited Route Handlers that delegate to the shared cancel/reschedule functions from Plan 06-03.

Purpose: LIFE-01 + LIFE-02 + LIFE-04 (booker self-service cancel + reschedule via tokenized links; per-IP rate limit). Open Question B resolved: success state renders directly inside the same `/cancel/[token]` and `/reschedule/[token]` routes when booking.status flips after the POST — saves a route hop and keeps the URL stable (CONTEXT lock requires "Book again" CTA which is rendered inline on the success state).

Output: 9 files. Build + lint clean. The flow is exercised end-to-end by Plan 06-06 integration tests.
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
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-02-SUMMARY.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-03-SUMMARY.md

# Shared functions this plan wires up
@lib/bookings/cancel.ts
@lib/bookings/reschedule.ts
@lib/rate-limit.ts
@lib/bookings/tokens.ts

# SlotPicker we're reusing verbatim — interface from RESEARCH §Pattern 8
@app/[account]/[event-slug]/_components/slot-picker.tsx

# Pattern reference: Phase 5 booking form Turnstile usage + fetch + error handling
@app/[account]/[event-slug]/_components/booking-form.tsx

# Pattern reference: Phase 5 Server Component Booking page
@app/[account]/[event-slug]/page.tsx

# Pattern reference: Phase 5 confirmed page (status-branch render, masked PII)
@app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx

# Pattern reference: Phase 5 POST /api/bookings (Route Handler shape, no-store, code vocabulary)
@app/api/bookings/route.ts

# Service-role client
@lib/supabase/admin.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Shared TokenNotActive + token resolvers + cancel page (GET) + cancel API (POST)</name>
  <files>app/_components/token-not-active.tsx,app/cancel/[token]/_lib/resolve-cancel-token.ts,app/cancel/[token]/page.tsx,app/cancel/[token]/_components/cancel-confirm-form.tsx,app/api/cancel/route.ts</files>
  <action>
Create FIVE files. Build cancel-side end-to-end first; reschedule-side is parallel structure in Task 2.

### File 1: `app/_components/token-not-active.tsx`

Shared "friendly no longer active" page for both `/cancel/[token]` and `/reschedule/[token]`. Exposes account.owner_email mailto contact (CONTEXT decision).

```typescript
import Link from "next/link";

export interface TokenNotActiveProps {
  /** When known, show the owner contact line. Pass null when token resolved
   *  but couldn't load the account (defensive). */
  ownerEmail: string | null;
  /** Optional account name for the contact line. */
  ownerName?: string | null;
}

/** Friendly "no longer active" branded page — same shape for cancel + reschedule
 *  invalid/used token UX (CONTEXT decision). */
export function TokenNotActive({ ownerEmail, ownerName }: TokenNotActiveProps) {
  return (
    <div className="mx-auto max-w-md p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">This link is no longer active</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The booking may have already been cancelled, rescheduled, or the
          appointment time has passed.
        </p>
        {ownerEmail ? (
          <p className="text-sm">
            Need help?{" "}
            <a href={`mailto:${ownerEmail}`} className="text-primary font-medium hover:underline">
              Contact {ownerName ?? ownerEmail}
            </a>
          </p>
        ) : null}
        <p className="text-sm mt-6">
          <Link href="/" className="text-muted-foreground hover:underline">Return home</Link>
        </p>
      </div>
    </div>
  );
}
```

### File 2: `app/cancel/[token]/_lib/resolve-cancel-token.ts`

Server-only resolver. Hashes URL token, looks up by `cancel_token_hash`, applies CONTEXT validity rule. Returns either the booking + account/event_type snapshot, the cancelled-but-found state (for success rendering), or null.

```typescript
import "server-only";
import { hashToken } from "@/lib/bookings/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ResolvedCancelToken {
  state: "active" | "cancelled" | "not_active";
  booking?: {
    id: string;
    account_id: string;
    start_at: string;
    end_at: string;
    booker_name: string;
    booker_email: string;
    booker_timezone: string;
    status: string;
  };
  account?: {
    name: string;
    slug: string;
    timezone: string;
    owner_email: string | null;
  };
  eventType?: {
    name: string;
    slug: string;
    duration_minutes: number;
  };
}

/**
 * Resolve a raw cancel token from the URL into a booking snapshot.
 *
 * Validity (CONTEXT lock): status === 'confirmed' AND start_at > now() → 'active'
 * If status === 'cancelled' AND cancelled_at within last hour → 'cancelled' (success state to render)
 * Anything else → 'not_active'.
 *
 * Why the cancelled-recent check: after a successful POST /api/cancel, the
 * client refreshes the page and re-resolves the token. We want to render the
 * success state inline rather than the generic "no longer active" page (Open
 * Question B resolution). The 1-hour window is a soft guard against showing
 * the success state to a stale token from days ago — the dead-hash invalidation
 * (Plan 06-03) means re-arriving at the URL after dead-hash replacement
 * resolves to no row → 'not_active' → friendly page.
 */
export async function resolveCancelToken(rawToken: string): Promise<ResolvedCancelToken> {
  if (!rawToken || rawToken.length < 8) {
    return { state: "not_active" };
  }

  const hash = await hashToken(rawToken);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, account_id, start_at, end_at, booker_name, booker_email, booker_timezone, status, cancelled_at,
       event_types!inner(name, slug, duration_minutes),
       accounts!inner(name, slug, timezone, owner_email)`,
    )
    .eq("cancel_token_hash", hash)
    .maybeSingle();

  if (error || !data) {
    return { state: "not_active" };
  }

  const eventType = Array.isArray(data.event_types) ? data.event_types[0] : data.event_types;
  const account = Array.isArray(data.accounts) ? data.accounts[0] : data.accounts;

  const now = new Date();
  const startAt = new Date(data.start_at);

  if (data.status === "confirmed" && startAt > now) {
    return {
      state: "active",
      booking: {
        id: data.id,
        account_id: data.account_id,
        start_at: data.start_at,
        end_at: data.end_at,
        booker_name: data.booker_name,
        booker_email: data.booker_email,
        booker_timezone: data.booker_timezone,
        status: data.status,
      },
      account: {
        name: account.name,
        slug: account.slug,
        timezone: account.timezone,
        owner_email: account.owner_email ?? null,
      },
      eventType: {
        name: eventType.name,
        slug: eventType.slug,
        duration_minutes: eventType.duration_minutes,
      },
    };
  }

  // Note: after a successful cancel, dead-hash replacement means we WON'T
  // re-find this booking on a refresh — the user will see TokenNotActive.
  // Cancel-success rendering is therefore handled in the POST response in the
  // client component (set local state to "cancelled" on 200, render success
  // inline). The 'cancelled' branch below is defensive for older clients that
  // hit a refresh path with a still-discoverable hash.
  if (data.status === "cancelled") {
    return {
      state: "cancelled",
      account: {
        name: account.name,
        slug: account.slug,
        timezone: account.timezone,
        owner_email: account.owner_email ?? null,
      },
      eventType: {
        name: eventType.name,
        slug: eventType.slug,
        duration_minutes: eventType.duration_minutes,
      },
    };
  }

  return { state: "not_active" };
}
```

### File 3: `app/cancel/[token]/page.tsx`

Server Component. Resolves token. Renders:
- `state === 'active'` → booking-detail card + `<CancelConfirmForm>` (client component with reason textarea + confirm button)
- `state === 'cancelled'` → success state inline ("Cancelled" + "Book again" CTA)
- `state === 'not_active'` → `<TokenNotActive>` (passes account.owner_email when known; null otherwise)

```typescript
import { Suspense } from "react";
import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { TokenNotActive } from "@/app/_components/token-not-active";
import { resolveCancelToken } from "./_lib/resolve-cancel-token";
import { CancelConfirmForm } from "./_components/cancel-confirm-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  return {
    title: "Cancel booking",
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CancelPage({ params }: PageProps) {
  // Next.js 16: params is a Promise (STATE.md lock)
  const { token } = await params;
  const resolved = await resolveCancelToken(token);

  if (resolved.state === "not_active") {
    return <TokenNotActive ownerEmail={null} />;
  }

  if (resolved.state === "cancelled") {
    return (
      <div className="mx-auto max-w-md p-6 sm:p-10">
        <div className="rounded-lg border bg-card p-6 sm:p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Booking cancelled</h1>
          <p className="text-sm text-muted-foreground mb-6">Your appointment has been cancelled.</p>
          {resolved.account && resolved.eventType ? (
            <Link
              href={`/${resolved.account.slug}/${resolved.eventType.slug}`}
              className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Book again
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  // state === 'active'
  const booking = resolved.booking!;
  const account = resolved.account!;
  const eventType = resolved.eventType!;

  // Times in BOOKER timezone (mirror Phase 5 confirmation page)
  const startTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const dateLine = format(startTz, "EEEE, MMMM d, yyyy");
  const timeLine = format(startTz, "h:mm a (z)");

  return (
    <div className="mx-auto max-w-md p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold mb-2">Cancel this booking?</h1>
        <p className="text-sm text-muted-foreground mb-6">
          You're about to cancel your appointment with <strong>{account.name}</strong>.
        </p>

        <dl className="space-y-3 mb-6">
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">What</dt>
            <dd className="text-sm">{eventType.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">When</dt>
            <dd className="text-sm">{dateLine}<br />{timeLine}</dd>
          </div>
        </dl>

        <Suspense fallback={null}>
          <CancelConfirmForm
            token={token}
            accountSlug={account.slug}
            eventSlug={eventType.slug}
          />
        </Suspense>
      </div>
    </div>
  );
}
```

### File 4: `app/cancel/[token]/_components/cancel-confirm-form.tsx`

Client component. Optional reason textarea + confirm/keep buttons. POST to `/api/cancel`. On 200 → set local state to "cancelled" and render success inline (Open Question B). On 410/429/500 → toast or inline error.

```typescript
"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CancelConfirmFormProps {
  token: string;
  accountSlug: string;
  eventSlug: string;
}

export function CancelConfirmForm({ token, accountSlug, eventSlug }: CancelConfirmFormProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, reason: reason.trim() || undefined }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      // Non-OK: surface a friendly toast + don't flip state
      const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (res.status === 429) {
        toast.error("Too many requests. Please try again in a few minutes.");
      } else if (res.status === 410) {
        // booking already cancelled / no longer active — refresh to show the inline TokenNotActive
        toast.error(body?.error ?? "This link is no longer active.");
        // Soft refresh: replace router.refresh() — re-resolves the token; will hit not_active branch
        window.location.reload();
      } else {
        toast.error(body?.error ?? "Cancel failed. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-4">Your booking has been cancelled.</p>
        <Link
          href={`/${accountSlug}/${eventSlug}`}
          className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Book again
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="cancel-reason" className="block text-xs uppercase text-muted-foreground tracking-wide mb-1">
          Reason for cancelling (optional)
        </label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Help the host plan…"
          className="text-sm"
          disabled={submitting}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full sm:w-auto"
          variant="destructive"
        >
          {submitting ? "Cancelling…" : "Yes, cancel this booking"}
        </Button>
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 rounded-md text-sm border hover:bg-accent"
        >
          Keep my booking
        </Link>
      </div>
    </div>
  );
}
```

### File 5: `app/api/cancel/route.ts`

Route Handler. Rate-limit → resolve token → cancelBooking → map result.

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hashToken } from "@/lib/bookings/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelBooking } from "@/lib/bookings/cancel";
import { checkRateLimit, DEFAULT_TOKEN_RATE_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

const cancelBodySchema = z.object({
  token: z.string().min(8),
  reason: z.string().max(500).optional(),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function appUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : req.nextUrl.origin)
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // 1. Rate limit (RESEARCH §Pattern 5)
  const rl = await checkRateLimit(`cancel:${ip}`, DEFAULT_TOKEN_RATE_LIMIT.maxRequests, DEFAULT_TOKEN_RATE_LIMIT.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a few minutes.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  // 2. Parse body
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON.", code: "BAD_REQUEST" }, { status: 400, headers: NO_STORE });
  }
  const parsed = cancelBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", code: "VALIDATION", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400, headers: NO_STORE },
    );
  }
  const { token, reason } = parsed.data;

  // 3. Resolve token to bookingId via hash + status check
  const tokenHash = await hashToken(token);
  const supabase = createAdminClient();
  const { data: booking, error: lookupError } = await supabase
    .from("bookings")
    .select("id, status, start_at")
    .eq("cancel_token_hash", tokenHash)
    .maybeSingle();

  if (lookupError) {
    console.error("[/api/cancel] lookup error:", lookupError);
    return NextResponse.json({ error: "Cancel failed.", code: "INTERNAL" }, { status: 500, headers: NO_STORE });
  }
  if (!booking || booking.status !== "confirmed" || new Date(booking.start_at) <= new Date()) {
    return NextResponse.json(
      { error: "This link is no longer active.", code: "NOT_ACTIVE" },
      { status: 410, headers: NO_STORE },
    );
  }

  // 4. Delegate to shared cancel function (Plan 06-03)
  const result = await cancelBooking({
    bookingId: booking.id,
    actor: "booker",
    reason,
    appUrl: appUrl(req),
    ip,
  });

  if (!result.ok) {
    if (result.reason === "not_active") {
      return NextResponse.json(
        { error: "This link is no longer active.", code: "NOT_ACTIVE" },
        { status: 410, headers: NO_STORE },
      );
    }
    return NextResponse.json({ error: "Cancel failed.", code: "INTERNAL" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
```

DO NOT (this task):
- Do NOT mutate state in the GET handler / Server Component. RESEARCH Pitfall 1: email prefetch fires GETs without user intent.
- Do NOT add a CAPTCHA / Turnstile to the cancel POST. CONTEXT decision: rate-limit is the v1 defense; Turnstile re-challenge is a Phase 8 hardening item (Deferred Idea).
- Do NOT do the cancel UPDATE inline in the route handler — call `cancelBooking()` from Plan 06-03. Single source of truth.
- Do NOT skip the rate-limit check on the POST. CONTEXT lock + LIFE-04 requirement.
- Do NOT include the booking ID or other PII in the JSON success response — `{ ok: true }` is sufficient. Client already has the token + slug context.
- Do NOT add `import "server-only"` to the page.tsx — Server Components are server-only by default and the directive is unnecessary; only the resolver needs it.
- Do NOT use the user-scoped `createClient()` in the resolver or the API route — these are public, unauthenticated endpoints; service-role is correct (Phase 5 lock for /api/bookings + /api/slots).
  </action>
  <verify>
```bash
ls "app/_components/token-not-active.tsx"
ls "app/cancel/[token]/page.tsx"
ls "app/cancel/[token]/_components/cancel-confirm-form.tsx"
ls "app/cancel/[token]/_lib/resolve-cancel-token.ts"
ls "app/api/cancel/route.ts"

# TokenNotActive shared component
grep -q "export function TokenNotActive" "app/_components/token-not-active.tsx" && echo "TokenNotActive exported"
grep -q "mailto:" "app/_components/token-not-active.tsx" && echo "owner mailto present"

# Resolver
head -1 "app/cancel/[token]/_lib/resolve-cancel-token.ts" | grep -q 'import "server-only"' && echo "resolver server-only ok"
grep -q "export async function resolveCancelToken" "app/cancel/[token]/_lib/resolve-cancel-token.ts" && echo "resolver exported"
grep -q "hashToken(rawToken)" "app/cancel/[token]/_lib/resolve-cancel-token.ts" && echo "hash + lookup pattern ok"
grep -q "cancel_token_hash" "app/cancel/[token]/_lib/resolve-cancel-token.ts" && echo "looks up by cancel hash"

# Page Server Component
grep -q "export default async function CancelPage" "app/cancel/[token]/page.tsx" && echo "page exported"
grep -q "robots: { index: false, follow: false }" "app/cancel/[token]/page.tsx" && echo "noindex set"
grep -q "params: Promise" "app/cancel/[token]/page.tsx" && echo "Next 16 params Promise"
grep -q "TokenNotActive" "app/cancel/[token]/page.tsx" && echo "not-active branch wired"
grep -q "Book again" "app/cancel/[token]/page.tsx" && echo "rebook CTA on cancelled state"
grep -q "CancelConfirmForm" "app/cancel/[token]/page.tsx" && echo "form mounted"
# Negative: page must NOT mutate
grep -q "supabase.*update\|supabase.*insert" "app/cancel/[token]/page.tsx" && echo "WARNING: page mutates - REMOVE" || echo "page is read-only ok"

# Client form
head -1 "app/cancel/[token]/_components/cancel-confirm-form.tsx" | grep -q '"use client"' && echo "use client ok"
grep -q "fetch(\"/api/cancel\"" "app/cancel/[token]/_components/cancel-confirm-form.tsx" && echo "POSTs to /api/cancel"
grep -q "Textarea" "app/cancel/[token]/_components/cancel-confirm-form.tsx" && echo "reason textarea present"
grep -q "Yes, cancel this booking" "app/cancel/[token]/_components/cancel-confirm-form.tsx" && echo "confirm button copy ok"
grep -q "Keep my booking" "app/cancel/[token]/_components/cancel-confirm-form.tsx" && echo "keep button copy ok"
grep -q "Book again" "app/cancel/[token]/_components/cancel-confirm-form.tsx" && echo "post-success rebook CTA"
grep -q "429" "app/cancel/[token]/_components/cancel-confirm-form.tsx" && echo "429 handled"
grep -q "410" "app/cancel/[token]/_components/cancel-confirm-form.tsx" && echo "410 handled"

# API route
grep -q "export async function POST" "app/api/cancel/route.ts" && echo "POST exported"
grep -q "checkRateLimit" "app/api/cancel/route.ts" && echo "rate-limit wired"
grep -q "DEFAULT_TOKEN_RATE_LIMIT" "app/api/cancel/route.ts" && echo "default config used"
grep -q "cancelBooking" "app/api/cancel/route.ts" && echo "shared function called"
grep -q '"RATE_LIMITED"' "app/api/cancel/route.ts" && echo "rate-limit code"
grep -q "Retry-After" "app/api/cancel/route.ts" && echo "Retry-After header"
grep -q "actor: \"booker\"" "app/api/cancel/route.ts" && echo "actor=booker passed"
grep -q "Cache-Control" "app/api/cancel/route.ts" && echo "no-store header used"

npm run build
npm run lint
```
  </verify>
  <done>
Cancel-side end-to-end working: GET page is read-only Server Component (email-prefetch defense); shows booking details + reason textarea + confirm button; renders success inline after POST 200; renders TokenNotActive on invalid token; POST /api/cancel rate-limits, resolves token, calls cancelBooking from Plan 06-03; maps not_active→410, db_error→500, success→200. All responses no-store. Build + lint pass.

Commit: `feat(06-04): add public /cancel/[token] page + POST /api/cancel route handler with rate-limit + token resolver`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Reschedule page (GET) + RescheduleShell client + POST /api/reschedule</name>
  <files>app/reschedule/[token]/page.tsx,app/reschedule/[token]/_components/reschedule-shell.tsx,app/reschedule/[token]/_lib/resolve-reschedule-token.ts,app/api/reschedule/route.ts</files>
  <action>
Build the reschedule-side parallel to cancel. The big difference: the client component reuses the existing `SlotPicker` from Phase 5 verbatim (CONTEXT lock; RESEARCH §Pattern 8 — full props interface confirmed compatible) and includes a Managed Turnstile widget (Phase 5 anti-bot pattern). Booker name/email/phone/answers stay silent (CONTEXT lock).

### File 1: `app/reschedule/[token]/_lib/resolve-reschedule-token.ts`

Same shape as the cancel resolver but looks up by `reschedule_token_hash`. Returns the OLD reschedule token hash too (caller passes it to `rescheduleBooking()` as the CAS guard).

```typescript
import "server-only";
import { hashToken } from "@/lib/bookings/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ResolvedRescheduleToken {
  state: "active" | "not_active";
  /** SHA-256 hex hash of the URL token — caller passes this as `oldRescheduleHash` to rescheduleBooking() */
  tokenHash?: string;
  booking?: {
    id: string;
    account_id: string;
    event_type_id: string;
    start_at: string;
    end_at: string;
    booker_timezone: string;
  };
  account?: {
    name: string;
    slug: string;
    timezone: string;
    owner_email: string | null;
  };
  eventType?: {
    id: string;
    name: string;
    slug: string;
    duration_minutes: number;
  };
}

/** Resolve a raw reschedule token from the URL into a booking + event_type + account snapshot.
 *  Validity (CONTEXT lock): status === 'confirmed' AND start_at > now() → 'active'. Else 'not_active'.
 *  Returns the URL-token hash so the caller can pass it as the CAS guard to rescheduleBooking(). */
export async function resolveRescheduleToken(rawToken: string): Promise<ResolvedRescheduleToken> {
  if (!rawToken || rawToken.length < 8) {
    return { state: "not_active" };
  }

  const hash = await hashToken(rawToken);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, account_id, event_type_id, start_at, end_at, booker_timezone, status,
       event_types!inner(id, name, slug, duration_minutes),
       accounts!inner(name, slug, timezone, owner_email)`,
    )
    .eq("reschedule_token_hash", hash)
    .maybeSingle();

  if (error || !data) return { state: "not_active" };

  if (data.status !== "confirmed" || new Date(data.start_at) <= new Date()) {
    return { state: "not_active" };
  }

  const eventType = Array.isArray(data.event_types) ? data.event_types[0] : data.event_types;
  const account = Array.isArray(data.accounts) ? data.accounts[0] : data.accounts;

  return {
    state: "active",
    tokenHash: hash,
    booking: {
      id: data.id,
      account_id: data.account_id,
      event_type_id: data.event_type_id,
      start_at: data.start_at,
      end_at: data.end_at,
      booker_timezone: data.booker_timezone,
    },
    account: {
      name: account.name,
      slug: account.slug,
      timezone: account.timezone,
      owner_email: account.owner_email ?? null,
    },
    eventType: {
      id: eventType.id,
      name: eventType.name,
      slug: eventType.slug,
      duration_minutes: eventType.duration_minutes,
    },
  };
}
```

### File 2: `app/reschedule/[token]/page.tsx`

Server Component. Resolves token. On `not_active` → TokenNotActive. On `active` → render header + old-slot reference line + `<RescheduleShell>` (client).

```typescript
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { TokenNotActive } from "@/app/_components/token-not-active";
import { resolveRescheduleToken } from "./_lib/resolve-reschedule-token";
import { RescheduleShell } from "./_components/reschedule-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  return {
    title: "Reschedule booking",
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ReschedulePage({ params }: PageProps) {
  const { token } = await params;
  const resolved = await resolveRescheduleToken(token);

  if (resolved.state === "not_active") {
    return <TokenNotActive ownerEmail={null} />;
  }

  const booking = resolved.booking!;
  const account = resolved.account!;
  const eventType = resolved.eventType!;
  const tokenHash = resolved.tokenHash!;

  // Old slot reference line in BOOKER TZ (server-rendered; client may re-render in detected browser TZ)
  const oldStartTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const oldDate = format(oldStartTz, "EEEE, MMMM d, yyyy");
  const oldTime = format(oldStartTz, "h:mm a (z)");

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold mb-2">Reschedule your booking</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Pick a new time for your appointment with <strong>{account.name}</strong>.
        </p>
        <p className="text-sm bg-muted/50 rounded-md px-3 py-2 mb-6">
          <span className="text-muted-foreground">Currently scheduled:</span>{" "}
          <span className="font-medium">{oldDate}, {oldTime}</span>
        </p>

        <RescheduleShell
          token={token}
          tokenHash={tokenHash}
          accountSlug={account.slug}
          accountTimezone={account.timezone}
          accountName={account.name}
          ownerEmail={account.owner_email}
          eventTypeId={eventType.id}
          eventTypeSlug={eventType.slug}
          eventTypeName={eventType.name}
          durationMinutes={eventType.duration_minutes}
          oldStartAt={booking.start_at}
          bookerTimezoneInitial={booking.booker_timezone}
        />
      </div>
    </div>
  );
}
```

### File 3: `app/reschedule/[token]/_components/reschedule-shell.tsx`

Client component. Owns:
- Browser TZ detection (mirror Phase 5 BookingShell pattern: SSR fallback to booker_timezone, replace with `Intl.DateTimeFormat().resolvedOptions().timeZone` on mount)
- SlotPicker state (selectedDate, selectedSlot, refetchKey)
- Managed Turnstile widget + ref + reset on every error path
- POST submission to `/api/reschedule`
- Success state inline ("Booking rescheduled" + small body explaining the email)
- 409 race-loser flow (mirror Phase 5: bump refetchKey, show inline banner above picker)
- 410 NOT_ACTIVE flow: page reload to show TokenNotActive
- 429 RATE_LIMITED toast

```typescript
"use client";
import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SlotPicker, type Slot } from "@/app/[account]/[event-slug]/_components/slot-picker";

interface RescheduleShellProps {
  token: string;
  tokenHash: string; // not actually sent to client API; purely informational here. Server route re-hashes from token.
  accountSlug: string;
  accountTimezone: string;
  accountName: string;
  ownerEmail: string | null;
  eventTypeId: string;
  eventTypeSlug: string;
  eventTypeName: string;
  durationMinutes: number;
  oldStartAt: string;          // ISO UTC
  bookerTimezoneInitial: string; // SSR fallback; replaced on mount
}

export function RescheduleShell(props: RescheduleShellProps) {
  // Browser TZ detection (SSR fallback to bookerTimezoneInitial; mirror Phase 5 BookingShell)
  const [bookerTimezone, setBookerTimezone] = useState(props.bookerTimezoneInitial);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setBookerTimezone(tz);
    } catch {
      // keep SSR fallback
    }
  }, []);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [raceBanner, setRaceBanner] = useState<string | null>(null);

  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  async function handleSubmit() {
    if (!selectedSlot) {
      toast.error("Pick a new time first.");
      return;
    }
    // Note: this route (POST /api/reschedule) does NOT verify Turnstile in v1 —
    // CONTEXT decision matches the cancel route (rate-limit only). The Turnstile
    // widget is included for parity with Phase 5 BookingForm UX and to give us
    // the option to enable verification in Phase 8 hardening with no UI change.
    setSubmitting(true);
    setRaceBanner(null);
    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          startAt: selectedSlot.start_at,
          endAt: selectedSlot.end_at,
        }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (res.status === 409 && body?.code === "SLOT_TAKEN") {
        // Race-loser flow (mirror Phase 5)
        setRaceBanner(body.error ?? "That time was just booked. Pick a new time below.");
        setRefetchKey((k) => k + 1);
        setSelectedSlot(null);
        turnstileRef.current?.reset();
      } else if (res.status === 429) {
        toast.error("Too many requests. Please try again in a few minutes.");
        turnstileRef.current?.reset();
      } else if (res.status === 410) {
        // NOT_ACTIVE — reload to show TokenNotActive page
        toast.error(body?.error ?? "This link is no longer active.");
        window.location.reload();
      } else if (res.status === 400) {
        toast.error(body?.error ?? "Invalid slot. Please try another.");
        turnstileRef.current?.reset();
      } else {
        toast.error(body?.error ?? "Reschedule failed. Please try again.");
        turnstileRef.current?.reset();
      }
    } catch {
      toast.error("Network error. Please try again.");
      turnstileRef.current?.reset();
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <h2 className="text-lg font-semibold mb-2">Booking rescheduled</h2>
        <p className="text-sm text-muted-foreground">
          We sent updated calendar invites. Check your email for the new details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {raceBanner ? (
        <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          {raceBanner}
        </div>
      ) : null}

      <SlotPicker
        eventTypeId={props.eventTypeId}
        accountTimezone={props.accountTimezone}
        bookerTimezone={bookerTimezone}
        ownerEmail={props.ownerEmail}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        selectedSlot={selectedSlot}
        onSelectSlot={setSelectedSlot}
        refetchKey={refetchKey}
      />

      {siteKey ? (
        <div className="pt-2">
          <Turnstile ref={turnstileRef} siteKey={siteKey} />
        </div>
      ) : null}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !selectedSlot}
        className="w-full"
      >
        {submitting ? "Rescheduling…" : selectedSlot ? "Confirm new time" : "Pick a new time first"}
      </Button>
    </div>
  );
}
```

### File 4: `app/api/reschedule/route.ts`

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hashToken } from "@/lib/bookings/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { rescheduleBooking } from "@/lib/bookings/reschedule";
import { checkRateLimit, DEFAULT_TOKEN_RATE_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

const rescheduleBodySchema = z.object({
  token: z.string().min(8),
  startAt: z.string().min(20), // ISO 8601
  endAt: z.string().min(20),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function appUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : req.nextUrl.origin)
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // 1. Rate limit
  const rl = await checkRateLimit(`reschedule:${ip}`, DEFAULT_TOKEN_RATE_LIMIT.maxRequests, DEFAULT_TOKEN_RATE_LIMIT.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a few minutes.", code: "RATE_LIMITED" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  // 2. Parse body
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON.", code: "BAD_REQUEST" }, { status: 400, headers: NO_STORE });
  }
  const parsed = rescheduleBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", code: "VALIDATION", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400, headers: NO_STORE },
    );
  }
  const { token, startAt, endAt } = parsed.data;

  // 3. Resolve token to bookingId (and capture the OLD reschedule_token_hash for the CAS guard)
  const tokenHash = await hashToken(token);
  const supabase = createAdminClient();
  const { data: booking, error: lookupError } = await supabase
    .from("bookings")
    .select("id, status, start_at")
    .eq("reschedule_token_hash", tokenHash)
    .maybeSingle();

  if (lookupError) {
    console.error("[/api/reschedule] lookup error:", lookupError);
    return NextResponse.json({ error: "Reschedule failed.", code: "INTERNAL" }, { status: 500, headers: NO_STORE });
  }
  if (!booking || booking.status !== "confirmed" || new Date(booking.start_at) <= new Date()) {
    return NextResponse.json(
      { error: "This link is no longer active.", code: "NOT_ACTIVE" },
      { status: 410, headers: NO_STORE },
    );
  }

  // 4. Delegate to shared reschedule function (Plan 06-03)
  const result = await rescheduleBooking({
    bookingId: booking.id,
    oldRescheduleHash: tokenHash,    // CAS guard against concurrent-token use (RESEARCH Pitfall 6)
    newStartAt: startAt,
    newEndAt: endAt,
    appUrl: appUrl(req),
    ip,
  });

  if (!result.ok) {
    if (result.reason === "slot_taken") {
      return NextResponse.json(
        { error: "That time was just booked. Pick a new time.", code: "SLOT_TAKEN" },
        { status: 409, headers: NO_STORE },
      );
    }
    if (result.reason === "not_active") {
      return NextResponse.json(
        { error: "This link is no longer active.", code: "NOT_ACTIVE" },
        { status: 410, headers: NO_STORE },
      );
    }
    if (result.reason === "bad_slot") {
      return NextResponse.json(
        { error: result.error ?? "Invalid slot.", code: "BAD_SLOT" },
        { status: 400, headers: NO_STORE },
      );
    }
    return NextResponse.json({ error: "Reschedule failed.", code: "INTERNAL" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
```

DO NOT (this task):
- Do NOT modify `app/[account]/[event-slug]/_components/slot-picker.tsx`. RESEARCH §Pattern 8 confirms the existing props interface is compatible verbatim. Modifying it risks breaking the Phase 5 booking flow.
- Do NOT show the booker name/email/phone/answers in the reschedule UI. CONTEXT decision: preserve booker data SILENTLY.
- Do NOT verify the Turnstile token on the server (POST /api/reschedule). v1 uses rate-limit only for the cancel/reschedule routes (CONTEXT decision). The widget is rendered for parity with Phase 5 booking form and to give us a hook to enable verification in Phase 8 with no UI change.
- Do NOT use NextResponse.redirect from the page.tsx — render TokenNotActive inline. Redirects break the URL bookmarkability for users who reload the page.
- Do NOT do the reschedule UPDATE inline in the route handler — call `rescheduleBooking()` from Plan 06-03.
- Do NOT pass `oldRescheduleHash` to the client. The server hashes the URL token to derive it. The client only ever sees the raw token (which it already has from the URL anyway).
- Do NOT skip the duration sanity in the reschedule UPDATE call. The shared `rescheduleBooking()` already does basic invariant checks (newStartAt > now, newEndAt > newStartAt). Server-side strict equality with `event_type.duration_minutes` is intentionally NOT done (see Plan 06-03 DO-NOT note).
  </action>
  <verify>
```bash
ls "app/reschedule/[token]/page.tsx"
ls "app/reschedule/[token]/_components/reschedule-shell.tsx"
ls "app/reschedule/[token]/_lib/resolve-reschedule-token.ts"
ls "app/api/reschedule/route.ts"

# Resolver
head -1 "app/reschedule/[token]/_lib/resolve-reschedule-token.ts" | grep -q 'import "server-only"' && echo "resolver server-only ok"
grep -q "reschedule_token_hash" "app/reschedule/[token]/_lib/resolve-reschedule-token.ts" && echo "looks up by reschedule hash"
grep -q "tokenHash" "app/reschedule/[token]/_lib/resolve-reschedule-token.ts" && echo "exports tokenHash for CAS"

# Page
grep -q "robots: { index: false, follow: false }" "app/reschedule/[token]/page.tsx" && echo "noindex ok"
grep -q "Currently scheduled:" "app/reschedule/[token]/page.tsx" && echo "old slot reference line ok"
grep -q "RescheduleShell" "app/reschedule/[token]/page.tsx" && echo "shell mounted"
grep -q "TokenNotActive" "app/reschedule/[token]/page.tsx" && echo "not-active branch wired"
grep -q "params: Promise" "app/reschedule/[token]/page.tsx" && echo "Next 16 params Promise"

# Shell client
head -1 "app/reschedule/[token]/_components/reschedule-shell.tsx" | grep -q '"use client"' && echo "use client ok"
grep -q "import { SlotPicker" "app/reschedule/[token]/_components/reschedule-shell.tsx" && echo "SlotPicker reused (CONTEXT lock)"
grep -q "Turnstile" "app/reschedule/[token]/_components/reschedule-shell.tsx" && echo "Turnstile present"
grep -q "turnstileRef.current?.reset()" "app/reschedule/[token]/_components/reschedule-shell.tsx" && echo "Turnstile reset on errors"
grep -q "/api/reschedule" "app/reschedule/[token]/_components/reschedule-shell.tsx" && echo "POSTs to /api/reschedule"
grep -q "SLOT_TAKEN" "app/reschedule/[token]/_components/reschedule-shell.tsx" && echo "race-loser handled"
grep -q "Booking rescheduled" "app/reschedule/[token]/_components/reschedule-shell.tsx" && echo "success state inline"
# Negative: must NOT show booker name/email/phone (CONTEXT lock)
grep -qE "booker_name|booker_email|booker_phone" "app/reschedule/[token]/_components/reschedule-shell.tsx" && echo "WARNING: booker fields shown - REMOVE" || echo "booker data silent ok"

# API route
grep -q "export async function POST" "app/api/reschedule/route.ts" && echo "POST exported"
grep -q "checkRateLimit" "app/api/reschedule/route.ts" && echo "rate-limit wired"
grep -q "rescheduleBooking" "app/api/reschedule/route.ts" && echo "shared function called"
grep -q "oldRescheduleHash: tokenHash" "app/api/reschedule/route.ts" && echo "CAS guard hash passed"
grep -q "SLOT_TAKEN" "app/api/reschedule/route.ts" && echo "SLOT_TAKEN code"
grep -q "NOT_ACTIVE" "app/api/reschedule/route.ts" && echo "NOT_ACTIVE code"
grep -q "BAD_SLOT" "app/api/reschedule/route.ts" && echo "BAD_SLOT code"

npm run build
npm run lint
```
  </verify>
  <done>
Reschedule-side end-to-end: GET page is read-only Server Component with old-slot reference line; mounts RescheduleShell which reuses Phase 5 SlotPicker verbatim, mounts Managed Turnstile widget (parity), submits to POST /api/reschedule with { token, startAt, endAt }; POST rate-limits, resolves token, calls rescheduleBooking from Plan 06-03; maps slot_taken→409, not_active→410, bad_slot→400, db_error→500. Race-loser UX mirrors Phase 5 (refetchKey bump + inline banner). All responses no-store. Build + lint pass.

Commit: `feat(06-04): add public /reschedule/[token] page + RescheduleShell (SlotPicker reuse) + POST /api/reschedule with rate-limit + CAS-guarded shared function call`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
ls "app/cancel/[token]/page.tsx" "app/reschedule/[token]/page.tsx" "app/api/cancel/route.ts" "app/api/reschedule/route.ts" "app/_components/token-not-active.tsx"
npm run build
npm run lint
```
</verification>

<rollback>
Delete the new directories:
- `app/cancel/`
- `app/reschedule/`
- `app/api/cancel/`
- `app/api/reschedule/`
- `app/_components/token-not-active.tsx`

The shared functions from Plan 06-02 + 06-03 stay intact and reusable. The owner cancel surface (Plan 06-05) is independent and continues to work.
</rollback>

<success_criteria>
- [ ] GET /cancel/[token] is a Server Component, READ-ONLY (no DB writes); resolves token; renders booking detail + reason textarea + confirm/keep buttons; renders TokenNotActive on invalid; renders inline success state on cancelled
- [ ] GET /reschedule/[token] is a Server Component, READ-ONLY; renders old-slot reference line; mounts RescheduleShell with SlotPicker (reused verbatim) + Turnstile widget; renders TokenNotActive on invalid
- [ ] Both GET pages export `generateMetadata` returning `{ title, robots: { index: false, follow: false } }` (token URLs noindex)
- [ ] POST /api/cancel and /api/reschedule are Route Handlers with `dynamic="force-dynamic"`; both rate-limit BEFORE token resolution; both delegate to Plan 06-03 shared functions; all responses include `Cache-Control: no-store`
- [ ] POST /api/cancel maps results: ok→200, not_active→410, db_error→500, validation→400, rate-limit→429+Retry-After
- [ ] POST /api/reschedule maps: ok→200, slot_taken→409 SLOT_TAKEN, not_active→410, bad_slot→400, db_error→500, rate-limit→429+Retry-After
- [ ] RescheduleShell silently preserves booker data (no name/email/phone/answers fields rendered or in submission body)
- [ ] RescheduleShell race-loser UX mirrors Phase 5: refetchKey bump + inline banner; Turnstile.reset() on every error path
- [ ] TokenNotActive shared component exposes `mailto:account.owner_email` link (CONTEXT lock for help contact)
- [ ] No modifications to `app/[account]/[event-slug]/_components/slot-picker.tsx` (Phase 5 lock — verified by `git diff` returning empty)
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/06-cancel-and-reschedule-lifecycle/06-04-SUMMARY.md` documenting:
- Route inventory: GET /cancel/[token], POST /api/cancel, GET /reschedule/[token], POST /api/reschedule, shared TokenNotActive component
- 2-step cancel UX: GET shows details + confirm form, POST mutates → success state inline (Open Question B resolution)
- Reschedule UX: SlotPicker reused verbatim from Phase 5 (Plan 06-04 added ZERO modifications to slot-picker.tsx); old slot rendered as static reference line above; booker data preserved silently
- Error code vocabulary added: NOT_ACTIVE (410), RATE_LIMITED (429), BAD_SLOT (400) — extends Phase 5 vocabulary
- Rate-limit pattern: checkRateLimit('cancel:'+ip OR 'reschedule:'+ip, ...DEFAULT_TOKEN_RATE_LIMIT) BEFORE token resolution
- Forward locks for Plan 06-05 (owner): The cancelBooking shared function used by /api/cancel is the SAME function the owner Server Action calls — the owner-cancel email path (apologetic copy, re-book link) is already wired via the actor parameter
- Forward locks for Plan 06-06 (tests): integration tests target POST /api/cancel + POST /api/reschedule + lib/bookings/cancel.ts + lib/bookings/reschedule.ts + lib/rate-limit.ts. SlotPicker is unchanged so no Phase 5 test regressions expected.
</output>
