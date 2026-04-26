---
phase: 06-cancel-and-reschedule-lifecycle
plan: 05
type: execute
wave: 4
depends_on: ["06-03"]
files_modified:
  - app/(shell)/app/bookings/[id]/page.tsx
  - app/(shell)/app/bookings/[id]/_components/cancel-button.tsx
  - app/(shell)/app/bookings/[id]/_lib/actions.ts
autonomous: true

must_haves:
  truths:
    - "(LOCKED — CONTEXT) Owner cancel control lives ONLY on the bookings DETAIL page (/app/bookings/[id]). The bookings LIST page is Phase 8 (DASH-02..04). Phase 6 owns this surface NOW because owner cancel needs somewhere to live (Open Question B resolution from 06-RESEARCH)."
    - "(LOCKED — CONTEXT) Cancel UI uses shadcn AlertDialog (existing primitive, mirrors event-types delete-confirm-dialog.tsx pattern from Plan 03-04) + optional reason Textarea (component already in components/ui/textarea.tsx — the same one Plan 06-04's CancelConfirmForm uses)."
    - "(RESEARCH — Pattern) app/(shell)/app/bookings/[id]/page.tsx is a Server Component. Booking is fetched via createClient() from @/lib/supabase/server (RLS-scoped — same pattern as event-types/[id]/edit/page.tsx from Phase 3). RLS policies from Phase 1 already restrict bookings to the owner's account_id; if the booking belongs to a different account, the SELECT returns zero rows → notFound() → 404."
    - "(RESEARCH — Pitfall) Next.js 16 params is a Promise — `params: Promise<{ id: string }>` then `const { id } = await params;` (Phase 3 lock; mirrors event-types/[id]/edit/page.tsx)."
    - "Detail page renders booking metadata in a clean read-only card: event type name, status badge, scheduled time (account.timezone primary, booker_timezone secondary), booker name + email + phone, custom-question answers (key/value list), createdAt. Status badge reuses the established muted/destructive variant pattern from event-types status-badge.tsx."
    - "When booking.status === 'cancelled', the page renders a read-only banner ('This booking was cancelled on [date] by [actor].') and DOES NOT render <CancelButton> at all (no destructive control on an already-cancelled booking). The cancellation row is read from booking.cancelled_at + booking.cancelled_by which Plan 06-03 sets atomically."
    - "When booking.status === 'confirmed' AND booking.start_at > now(), the page renders <CancelButton> below the details card. Past-but-confirmed appointments show a muted 'This appointment has already passed' banner instead of the cancel button (no UX value cancelling the past)."
    - "<CancelButton> is a 'use client' component (shadcn AlertDialog needs client state). Props: { bookingId, eventTypeName, scheduledLine }. State: { open, submitting, reason }. On confirm: invokes the cancelBookingAsOwner Server Action via direct await (NOT useFormState — single-shot action with toast feedback)."
    - "Server Action cancelBookingAsOwner(bookingId, reason?) lives at app/(shell)/app/bookings/[id]/_lib/actions.ts and starts with `'use server'`. Returns { ok: true } | { error: string }. NO direct DB mutation — delegates to shared cancelBooking() from lib/bookings/cancel.ts (Plan 06-03) with actor:'owner'."
    - "Server Action MUST verify ownership BEFORE delegating to cancelBooking(). Pattern: await supabase.from('bookings').select('id').eq('id', bookingId).maybeSingle() against the RLS-scoped server client; null → return { error: 'Booking not found.' }. cancelBooking() trusts its bookingId arg (Plan 06-03 contract), so this auth check is mandatory."
    - "Server Action passes appUrl resolved from process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL ?? 'http://localhost:3000' (no req.nextUrl in a Server Action), and ip:null (owner-cancel from authenticated dashboard does not capture IP for forensics — same audit-row schema, just nullable ip per Plan 06-03 contract)."
    - "Server Action passes reason via cancelBooking({ actor:'owner', reason }) — when reason is empty string OR whitespace-only, normalize to undefined BEFORE the call (matches Plan 06-02 EMAIL-07: empty reason omits the row entirely from the booker email; non-empty reason renders as a callout)."
    - "(LOCKED — CONTEXT) Owner-cancel email to booker is APOLOGETIC + includes re-book link + METHOD:CANCEL .ics. This is already wired by the actor='owner' parameter in cancelBooking() (Plan 06-03 + Plan 06-02 send-cancel-emails.ts) — this plan does NOT touch email templates."
    - "After successful cancel: action calls revalidatePath(`/app/bookings/${bookingId}`) so the next render shows the cancelled state. Client component flips the AlertDialog closed and shows a toast.success('Booking cancelled. Both parties have been notified.'). NO optimistic UI — let the Server Action finish, let revalidatePath refresh, let the cancelled-state branch re-render naturally (CONTEXT lock: 'Server Action calls shared cancelBooking() with actor:'owner' and propagates reason; optimistic UI not used — let server action redirect/refresh')."
    - "If cancelBooking() returns { ok: false, reason: 'not_active' }: action returns { error: 'This booking is no longer active. It may have already been cancelled.' }; client toast.error()s and calls router.refresh() to re-fetch the row (will now show the cancelled-state read-only banner)."
    - "If cancelBooking() returns { ok: false, reason: 'db_error' }: action returns { error: 'Cancel failed. Please try again.' }; client toast.error()s; AlertDialog stays open so owner can retry."
    - "(NEGATIVE LOCK) This plan does NOT modify lib/bookings/cancel.ts. Single source of truth — same shared function used by /api/cancel (Plan 06-04 booker path) and this Server Action (owner path), distinguished only by the actor field."
    - "(NEGATIVE LOCK) This plan does NOT add a bookings list page. /app/bookings/page.tsx (placeholder) stays untouched. The detail page is reached via direct URL (e.g. from a Phase 8 list row, or a forward link from a Phase 7 owner notification email — currently the only entrypoint is direct URL bookmarking by Andrew during QA)."
  artifacts:
    - path: "app/(shell)/app/bookings/[id]/page.tsx"
      provides: "Server Component owner-facing booking detail page with status-branched render + cancel surface"
      contains: "createClient\\|notFound\\|CancelButton"
      exports: ["default"]
      min_lines: 110
    - path: "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx"
      provides: "Client component: AlertDialog + reason Textarea + confirm flow that invokes the Server Action"
      contains: "use client\\|AlertDialog\\|Textarea\\|cancelBookingAsOwner"
      exports: ["CancelButton"]
      min_lines: 110
    - path: "app/(shell)/app/bookings/[id]/_lib/actions.ts"
      provides: "Server Action cancelBookingAsOwner — RLS auth + delegates to shared cancelBooking() with actor:'owner'"
      contains: "use server\\|cancelBookingAsOwner\\|cancelBooking\\|actor: \"owner\""
      exports: ["cancelBookingAsOwner"]
      min_lines: 70
  key_links:
    - from: "app/(shell)/app/bookings/[id]/page.tsx"
      to: "lib/supabase/server.ts (RLS-scoped createClient)"
      via: "const supabase = await createClient(); supabase.from('bookings').select(...).eq('id', id).maybeSingle()"
      pattern: "createClient.*server"
    - from: "app/(shell)/app/bookings/[id]/page.tsx"
      to: "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx"
      via: "<CancelButton bookingId={...} eventTypeName={...} scheduledLine={...} /> mounted only when status==='confirmed' AND start_at > now()"
      pattern: "CancelButton"
    - from: "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx"
      to: "app/(shell)/app/bookings/[id]/_lib/actions.ts"
      via: "await cancelBookingAsOwner(bookingId, reason)"
      pattern: "cancelBookingAsOwner"
    - from: "app/(shell)/app/bookings/[id]/_lib/actions.ts"
      to: "lib/bookings/cancel.ts (Plan 06-03 shared function)"
      via: "await cancelBooking({ bookingId, actor: 'owner', reason, appUrl, ip: null })"
      pattern: "cancelBooking\\(\\{[^}]*actor: \"owner\""
    - from: "app/(shell)/app/bookings/[id]/_lib/actions.ts"
      to: "lib/supabase/server.ts (RLS auth check before delegate)"
      via: "supabase.from('bookings').select('id').eq('id', bookingId).maybeSingle() — null result short-circuits with { error }"
      pattern: "maybeSingle"
---

<objective>
Build the owner-side cancel surface: a server-rendered booking detail page at `/app/bookings/[id]` plus a client-side AlertDialog + reason form that fires a Server Action which delegates to the shared `cancelBooking()` from Plan 06-03.

Purpose: LIFE-05 (owner can cancel any booking from the dashboard). This is the OTHER caller of `cancelBooking()` (the first caller, Plan 06-04, is the public token route). Same shared function, different actor — the apologetic-vs-confirmation booker email branch already lives behind the `actor` parameter (Plan 06-02 `send-cancel-emails.ts`), so this plan does NOT touch email code.

Output: 3 new files in `app/(shell)/app/bookings/[id]/`. No modifications to `lib/bookings/cancel.ts`, no modifications to email templates, no bookings list page (Phase 8 owns that — Open Question B resolution).
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

# The shared function this Server Action delegates to (LOCKED — single source of truth)
@lib/bookings/cancel.ts

# RLS-scoped server client used by the page + the action's auth check
@lib/supabase/server.ts

# Pattern reference: Server Component dashboard page that fetches via RLS + notFound()s on miss
@app/(shell)/app/event-types/[id]/edit/page.tsx

# Pattern reference: shadcn AlertDialog + destructive action (Plan 03-04 lock for this aesthetic)
@app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx

# Pattern reference: Server Action contract shape (return-shape, redirect handling, RLS-account resolution)
@app/(shell)/app/event-types/_lib/actions.ts

# Pattern reference: confirmed page renders booking time in account.timezone + booker.timezone
@app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx

# UI primitives we wire up
@components/ui/alert-dialog.tsx
@components/ui/textarea.tsx
@components/ui/button.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Server Action cancelBookingAsOwner — RLS auth + delegate to shared cancelBooking()</name>
  <files>app/(shell)/app/bookings/[id]/_lib/actions.ts</files>
  <action>
Create the Server Action file. This is the OWNER half of the dual-caller pattern locked by Plan 06-03 (the BOOKER half is `app/api/cancel/route.ts` from Plan 06-04). Same shared function, different actor field, different auth gate.

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cancelBooking } from "@/lib/bookings/cancel";

/**
 * Server Action result shape — narrow discriminated union.
 *
 * - `{ ok: true }`  — booking was cancelled. Caller flips the dialog closed and toasts success.
 *                      revalidatePath(...) inside the action ensures the next render shows the
 *                      cancelled-state read-only banner (no optimistic UI per CONTEXT lock).
 * - `{ error }`     — anything that prevented the cancel. Caller toasts the message; the dialog
 *                      stays open so the owner can retry or cancel out.
 */
export type CancelBookingAsOwnerResult = { ok: true } | { error: string };

/**
 * OWNER-SIDE cancel.
 *
 * Two-step pipeline (RLS auth → shared function delegate). The shared cancelBooking()
 * (Plan 06-03) is a service-role module that trusts its bookingId arg — meaning IT
 * does no ownership check. We MUST do the ownership check here before delegating,
 * otherwise any logged-in owner could cancel any other account's booking by guessing
 * a UUID.
 *
 * The RLS policies on `bookings` (Phase 1) restrict SELECT to the authenticated owner's
 * account, so a missing row at the auth-check step means "not yours OR doesn't exist" —
 * either way we return a benign "Booking not found." (we do NOT distinguish 404 from 403
 * to avoid leaking other-account UUIDs).
 *
 * On success we delegate to cancelBooking({ actor: 'owner', reason, ip: null, appUrl }):
 *  - actor: 'owner' selects the apologetic + re-book-link booker email branch (Plan 06-02)
 *  - ip: null because Server Actions don't have request headers; audit row tolerates null
 *  - appUrl: from env (NEXT_PUBLIC_APP_URL ?? VERCEL_URL ?? localhost) — Server Actions
 *           can't reach req.nextUrl so we read env directly
 *  - reason: normalized — empty string or whitespace-only becomes undefined so the
 *           booker email omits the reason row entirely (Plan 06-02 EMAIL-07 lock)
 */
export async function cancelBookingAsOwner(
  bookingId: string,
  reason?: string,
): Promise<CancelBookingAsOwnerResult> {
  // ── 1. RLS-scoped ownership check ───────────────────────────────────────
  // Phase 1 RLS policies restrict bookings SELECT to the authenticated owner's
  // account_id. If this returns null, the booking either doesn't exist OR belongs
  // to a different account — both map to "not found" from the owner's POV.
  const supabase = await createClient();
  const { data: existing, error: lookupError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (lookupError) {
    console.error("[cancelBookingAsOwner] lookup error:", lookupError);
    return { error: "Cancel failed. Please try again." };
  }
  if (!existing) {
    return { error: "Booking not found." };
  }

  // ── 2. Normalize reason ─────────────────────────────────────────────────
  const trimmedReason = reason?.trim();
  const normalizedReason = trimmedReason && trimmedReason.length > 0 ? trimmedReason : undefined;

  // ── 3. Resolve appUrl (no req in a Server Action) ───────────────────────
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000");

  // ── 4. Delegate to shared cancelBooking() — single source of truth ──────
  // This is the SAME function that /api/cancel (Plan 06-04) calls. The only
  // difference between the booker path and the owner path is the `actor` field
  // (and that the booker path also passes a captured IP). All email + audit +
  // dead-hash invalidation logic lives in cancelBooking(); we do NOT duplicate it.
  const result = await cancelBooking({
    bookingId,
    actor: "owner",
    reason: normalizedReason,
    appUrl,
    ip: null,
  });

  if (!result.ok) {
    if (result.reason === "not_active") {
      return { error: "This booking is no longer active. It may have already been cancelled." };
    }
    // db_error and any other unexpected failure
    return { error: "Cancel failed. Please try again." };
  }

  // ── 5. Refresh the detail page so the cancelled-state branch renders ────
  revalidatePath(`/app/bookings/${bookingId}`);

  return { ok: true };
}
```

DO NOT (this task):
- Do NOT inline the cancel UPDATE — call `cancelBooking()` from `lib/bookings/cancel.ts`. Plan 06-03 is the single source of truth.
- Do NOT skip the RLS-scoped pre-check. `cancelBooking()` uses the service-role client which bypasses RLS; without the pre-check, any owner can cancel any account's booking by sending a known-but-foreign bookingId.
- Do NOT pass `actor: 'booker'` — this is the OWNER surface. The actor field controls the booker email branch (apologetic vs confirmation copy) and the audit row's `actor` column.
- Do NOT distinguish 403 from 404 in the error message. Returning "Booking belongs to another account" leaks the existence of foreign UUIDs.
- Do NOT pass an empty-string reason to `cancelBooking()` — normalize empty/whitespace to undefined so the booker email omits the reason callout entirely (Plan 06-02 EMAIL-07 lock: "omit the row entirely when empty, no 'Reason: (none)' empty cell").
- Do NOT use redirect() after success — the AlertDialog is on the same page; revalidatePath() refreshes the server data and the cancelled-state branch handles the new render.
- Do NOT add try/catch around the whole action body. supabase-js + cancelBooking() return discriminated results; uncaught throws are programmer errors that should surface in logs, not be swallowed silently.
- Do NOT pass an IP captured from anywhere — Server Actions have no request headers. The Plan 06-03 audit-row schema explicitly allows ip:null for the owner path.
  </action>
  <verify>
```bash
ls "app/(shell)/app/bookings/[id]/_lib/actions.ts"

# 'use server' directive
head -1 "app/(shell)/app/bookings/[id]/_lib/actions.ts" | grep -q '"use server"' && echo "use server ok"

# Exports
grep -q "export async function cancelBookingAsOwner" "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "action exported"

# RLS auth-gate uses server client (NOT admin)
grep -q 'from "@/lib/supabase/server"' "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "RLS-scoped client imported"
grep -q "maybeSingle" "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "auth pre-check ok"

# Delegates to shared cancelBooking() (NOT inline DB call)
grep -q 'from "@/lib/bookings/cancel"' "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "shared function imported"
grep -q "await cancelBooking" "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "shared function called"
grep -q 'actor: "owner"' "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "actor=owner passed"
grep -q "ip: null" "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "ip:null (Server Action contract)"

# Negative: must NOT do its own UPDATE
grep -qE "supabase\.from.*update|supabase\.from\(.bookings.\)\.update" "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "WARNING: action mutates directly - REMOVE" || echo "no inline mutation ok"

# Reason normalization
grep -q "normalizedReason" "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "reason normalization present"

# revalidatePath used (not redirect)
grep -q "revalidatePath" "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "revalidatePath used"

# not_active branch handled
grep -q '"not_active"' "app/(shell)/app/bookings/[id]/_lib/actions.ts" && echo "not_active branch present"

npm run build
npm run lint
```
  </verify>
  <done>
`app/(shell)/app/bookings/[id]/_lib/actions.ts` exists; starts with `"use server"`; exports `cancelBookingAsOwner(bookingId, reason?)` returning `{ ok: true } | { error: string }`. Does an RLS-scoped pre-check via `lib/supabase/server` createClient, normalizes reason (empty/whitespace → undefined), resolves appUrl from env, then delegates to `cancelBooking()` from `lib/bookings/cancel.ts` with `actor: 'owner'` and `ip: null`. Maps `not_active` → friendly error, success → revalidatePath + `{ ok: true }`. NO inline DB mutation. Build + lint pass.

Commit: `feat(06-05): add cancelBookingAsOwner Server Action that RLS-checks then delegates to shared cancelBooking()`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Booking detail page (Server Component) + CancelButton (client AlertDialog)</name>
  <files>app/(shell)/app/bookings/[id]/page.tsx, app/(shell)/app/bookings/[id]/_components/cancel-button.tsx</files>
  <action>
Build TWO files: the Server Component detail page that fetches via RLS-scoped client and status-branches the render, plus the client AlertDialog button that mounts the cancel form.

### File 1: `app/(shell)/app/bookings/[id]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { CancelButton } from "./_components/cancel-button";

// Next.js 16 lock (Phase 1 + Phase 3): params is a Promise — must be awaited.
export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // RLS-scoped fetch. Phase 1 policies restrict bookings SELECT to the
  // authenticated owner's account_id; foreign rows return zero results → 404.
  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `id, account_id, event_type_id, start_at, end_at, status,
       booker_name, booker_email, booker_phone, booker_timezone, answers,
       cancelled_at, cancelled_by, created_at,
       event_types!inner(name, slug, duration_minutes),
       accounts!inner(name, slug, timezone)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !booking) {
    notFound();
  }

  // Defensive normalization — supabase-js join cardinality varies by FK direction
  // (Phase 5 + Phase 6 plans 06-03/06-04 lock this defensive shape). event_types
  // and accounts are 1:1 from bookings' perspective.
  const eventType = Array.isArray(booking.event_types) ? booking.event_types[0] : booking.event_types;
  const account = Array.isArray(booking.accounts) ? booking.accounts[0] : booking.accounts;

  // Render scheduled time in BOTH zones — owner-primary (account.timezone) on
  // top, booker-secondary below. Mirrors the Phase 5 confirmed page pattern but
  // inverts primary/secondary because this is the owner surface.
  const startAccountTz = new TZDate(new Date(booking.start_at), account.timezone);
  const startBookerTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const dateLineAccount = format(startAccountTz, "EEEE, MMMM d, yyyy");
  const timeLineAccount = format(startAccountTz, "h:mm a (z)");
  const timeLineBooker = format(startBookerTz, "h:mm a (z)");
  const scheduledLine = `${dateLineAccount}, ${timeLineAccount}`;

  const isConfirmed = booking.status === "confirmed";
  const isCancelled = booking.status === "cancelled";
  const isPast = new Date(booking.start_at) <= new Date();
  const canCancel = isConfirmed && !isPast;

  // Cancellation banner copy (only shown when cancelled)
  const cancelledAtLine =
    isCancelled && booking.cancelled_at
      ? format(new TZDate(new Date(booking.cancelled_at), account.timezone), "MMM d, yyyy 'at' h:mm a (z)")
      : null;
  const cancelledByLine =
    booking.cancelled_by === "owner"
      ? "by you"
      : booking.cancelled_by === "booker"
        ? "by the booker"
        : booking.cancelled_by === "system"
          ? "by the system"
          : "";

  // Custom-question answers as a key/value list — the answers JSONB is
  // shaped { [questionLabel]: stringAnswer } per Phase 5 schema.
  const answers = (booking.answers ?? {}) as Record<string, string>;
  const answerEntries = Object.entries(answers).filter(([, v]) => typeof v === "string" && v.length > 0);

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{eventType.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{scheduledLine}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Booker time: {timeLineBooker}
          </p>
        </div>
        <Badge variant={isCancelled ? "destructive" : isConfirmed ? "default" : "secondary"}>
          {booking.status}
        </Badge>
      </header>

      {isCancelled ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">This booking was cancelled.</p>
          {cancelledAtLine ? (
            <p className="text-muted-foreground mt-1">
              Cancelled on {cancelledAtLine}{cancelledByLine ? ` ${cancelledByLine}` : ""}.
            </p>
          ) : null}
        </div>
      ) : null}

      {isConfirmed && isPast ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This appointment has already passed.
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Booker</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">Name</dt>
            <dd className="mt-0.5">{booking.booker_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">Email</dt>
            <dd className="mt-0.5">
              <a href={`mailto:${booking.booker_email}`} className="hover:underline">
                {booking.booker_email}
              </a>
            </dd>
          </div>
          {booking.booker_phone ? (
            <div>
              <dt className="text-xs uppercase text-muted-foreground tracking-wide">Phone</dt>
              <dd className="mt-0.5">{booking.booker_phone}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">Timezone</dt>
            <dd className="mt-0.5">{booking.booker_timezone}</dd>
          </div>
        </dl>

        {answerEntries.length > 0 ? (
          <>
            <h3 className="text-sm font-semibold mt-6 mb-2">Custom answers</h3>
            <dl className="space-y-2 text-sm">
              {answerEntries.map(([q, a]) => (
                <div key={q}>
                  <dt className="text-xs uppercase text-muted-foreground tracking-wide">{q}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{a}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </section>

      {canCancel ? (
        <div className="flex justify-end">
          <CancelButton
            bookingId={booking.id}
            eventTypeName={eventType.name}
            scheduledLine={scheduledLine}
          />
        </div>
      ) : null}
    </div>
  );
}
```

### File 2: `app/(shell)/app/bookings/[id]/_components/cancel-button.tsx`

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelBookingAsOwner } from "../_lib/actions";

interface CancelButtonProps {
  bookingId: string;
  eventTypeName: string;
  /** Pre-formatted "Day, Mon DD, YYYY, h:mm a (z)" line for the dialog body */
  scheduledLine: string;
}

/**
 * Owner-side cancel control.
 *
 * UX (CONTEXT lock + delete-confirm-dialog.tsx pattern from Plan 03-04):
 *   - Trigger button is destructive variant
 *   - AlertDialog asks the owner to confirm
 *   - Optional reason Textarea — when non-empty, surfaces as a callout in the
 *     booker's apologetic cancellation email (Plan 06-02 EMAIL-07)
 *   - On confirm: invokes Server Action, await result, toast success/error
 *   - On success: dialog closes, router.refresh() ensures the cancelled-state
 *     read-only banner appears (the action also calls revalidatePath, but
 *     refresh() makes the UI swap feel instantaneous)
 *   - NO optimistic UI (CONTEXT lock — let the Server Action drive the state)
 */
export function CancelButton({ bookingId, eventTypeName, scheduledLine }: CancelButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await cancelBookingAsOwner(bookingId, reason);
      if ("ok" in result && result.ok) {
        setOpen(false);
        setReason("");
        toast.success("Booking cancelled. Both parties have been notified.");
        router.refresh();
        return;
      }
      // Error path: keep dialog open so owner can retry or close manually
      const message = "error" in result ? result.error : "Cancel failed. Please try again.";
      toast.error(message);
      // If the booking is no longer active, refresh so the cancelled-state
      // banner can render — but ALSO close the dialog (no point keeping it open
      // when there's nothing to cancel anymore).
      if ("error" in result && result.error.toLowerCase().includes("no longer active")) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Cancel booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You're about to cancel <strong>{eventTypeName}</strong> on{" "}
                <strong>{scheduledLine}</strong>.
              </p>
              <p className="text-xs">
                The booker will receive an apologetic cancellation email with a
                link to book again. The calendar invite will be removed.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="owner-cancel-reason" className="text-xs uppercase text-muted-foreground tracking-wide">
            Reason for cancelling (optional)
          </Label>
          <Textarea
            id="owner-cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Conflict came up — happy to reschedule when you're ready."
            className="text-sm"
            disabled={isPending}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">
            If filled, this will be shown in the booker's email.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // prevent default close — we close manually after action resolves
              handleConfirm();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Cancelling…" : "Yes, cancel booking"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

DO NOT (this task):
- Do NOT mutate state in the page.tsx Server Component. The page is read-only; mutation only happens via the Server Action invoked from the client AlertDialog.
- Do NOT use `createAdminClient()` in page.tsx — RLS scoping is the security boundary. Foreign-account bookings MUST 404 via empty SELECT, not via a manual account_id check (RLS does that automatically and atomically).
- Do NOT mount `<CancelButton>` when `status === 'cancelled'` OR `start_at <= now()`. The destructive control is confusing on an already-cancelled or already-past booking. The page renders the appropriate banner instead.
- Do NOT call `cancelBookingAsOwner` directly from `page.tsx` — Server Actions invoked from Server Components must be wrapped in a `<form>` or routed through a client component. We use the client component path.
- Do NOT skip `e.preventDefault()` on the AlertDialogAction onClick. The default behavior closes the dialog immediately, which would unmount the component before the await completes — losing the toast feedback and breaking the loading state.
- Do NOT pass `reason` raw to the action without passing it through `useState`. The Textarea is a controlled input.
- Do NOT add a separate "Reschedule" button. Owner reschedule on behalf of the booker is in CONTEXT Deferred Ideas — out of scope for v1.
- Do NOT modify the bookings list page (`app/(shell)/app/bookings/page.tsx`). It stays as the Phase 8 placeholder. Phase 8 will add the list AND link rows to this detail page.
- Do NOT modify `lib/bookings/cancel.ts`. The shared function contract from Plan 06-03 is already correct for the owner path (the `actor` parameter is the only difference between booker and owner callers).
  </action>
  <verify>
```bash
ls "app/(shell)/app/bookings/[id]/page.tsx"
ls "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx"

# Page Server Component
grep -q "export default async function BookingDetailPage" "app/(shell)/app/bookings/[id]/page.tsx" && echo "page exported"
grep -q "params: Promise" "app/(shell)/app/bookings/[id]/page.tsx" && echo "Next 16 params Promise ok"
grep -q 'from "@/lib/supabase/server"' "app/(shell)/app/bookings/[id]/page.tsx" && echo "RLS-scoped client used (NOT admin)"
grep -q "notFound" "app/(shell)/app/bookings/[id]/page.tsx" && echo "notFound on miss"

# Negative: page must NOT use the admin client
grep -q "createAdminClient" "app/(shell)/app/bookings/[id]/page.tsx" && echo "WARNING: page uses admin client - REMOVE" || echo "no admin client in page ok"

# Status branching
grep -q "isCancelled" "app/(shell)/app/bookings/[id]/page.tsx" && echo "cancelled branch present"
grep -q "canCancel" "app/(shell)/app/bookings/[id]/page.tsx" && echo "canCancel guard present"
grep -q "This booking was cancelled" "app/(shell)/app/bookings/[id]/page.tsx" && echo "cancelled banner copy ok"
grep -q "already passed" "app/(shell)/app/bookings/[id]/page.tsx" && echo "past banner copy ok"

# CancelButton mounted only when canCancel is true
grep -q "canCancel ?" "app/(shell)/app/bookings/[id]/page.tsx" && echo "CancelButton mounted conditionally"
grep -q "<CancelButton" "app/(shell)/app/bookings/[id]/page.tsx" && echo "CancelButton referenced"

# Booker block + custom answers
grep -q "booker_name" "app/(shell)/app/bookings/[id]/page.tsx" && echo "booker name rendered"
grep -q "answerEntries" "app/(shell)/app/bookings/[id]/page.tsx" && echo "custom answers rendered"

# CancelButton client component
head -1 "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" | grep -q '"use client"' && echo "use client ok"
grep -q "AlertDialog" "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" && echo "AlertDialog used (CONTEXT lock)"
grep -q "Textarea" "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" && echo "Textarea used (CONTEXT lock)"
grep -q "cancelBookingAsOwner" "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" && echo "Server Action invoked"
grep -q "router.refresh" "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" && echo "router.refresh used (no optimistic UI)"
grep -q "e.preventDefault" "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" && echo "preventDefault on action click"
grep -q "Yes, cancel booking" "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" && echo "confirm copy ok"
grep -q "Keep booking" "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" && echo "cancel-out copy ok"
grep -q "apologetic" "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" && echo "apologetic copy hint present"
grep -q "no longer active" "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx" && echo "not_active error path handled"

npm run build
npm run lint
```
  </verify>
  <done>
Owner cancel surface end-to-end working:
- `app/(shell)/app/bookings/[id]/page.tsx` is a Server Component using the RLS-scoped server client; renders booking details + status badge; status-branches to (a) confirmed-future → CancelButton, (b) confirmed-past → muted banner, (c) cancelled → destructive banner with cancelled_at + cancelled_by line.
- `app/(shell)/app/bookings/[id]/_components/cancel-button.tsx` is a 'use client' component using shadcn AlertDialog + Textarea; invokes `cancelBookingAsOwner()` Server Action; on success closes dialog + toast.success + router.refresh; on `not_active` error closes + refresh; on other errors keeps open.
- NO modifications to `lib/bookings/cancel.ts`, `lib/email/send-cancel-emails.ts`, or `app/(shell)/app/bookings/page.tsx`.
- Build + lint pass.

Commit: `feat(06-05): add owner booking detail page + AlertDialog cancel control wired to shared cancelBooking()`. Push.

Smoke (after local dev or Vercel deploy):
```bash
# Sign in as Andrew, navigate to /app/bookings/<some-real-confirmed-future-booking-id>
# - Verify details render correctly (event type, time in account TZ, booker name/email/phone, custom answers)
# - Click "Cancel booking" → AlertDialog opens
# - Type a reason like "Conflict came up — happy to reschedule"
# - Click "Yes, cancel booking" → toast success + page refreshes to the cancelled state banner
# - Verify booker email arrived with apologetic copy + reason callout + Book again link + .ics that removes the calendar event
# - Repeat WITHOUT a reason → verify booker email omits the reason callout entirely
# - Try to navigate to /app/bookings/<a-foreign-or-bogus-uuid> → 404
```
  </done>
</task>

</tasks>

<verification>
```bash
ls "app/(shell)/app/bookings/[id]/page.tsx"
ls "app/(shell)/app/bookings/[id]/_components/cancel-button.tsx"
ls "app/(shell)/app/bookings/[id]/_lib/actions.ts"
npm run build
npm run lint
```
</verification>

<rollback>
Delete the new directory:
- `app/(shell)/app/bookings/[id]/`

The placeholder list page (`app/(shell)/app/bookings/page.tsx`) is untouched. The shared `cancelBooking()` function (Plan 06-03) and the public token routes (Plan 06-04) are untouched and continue to work. Booker-side cancel via email link is unaffected.
</rollback>

<success_criteria>
- [ ] `app/(shell)/app/bookings/[id]/page.tsx` is a Server Component; uses `createClient()` from `@/lib/supabase/server` (NOT admin); awaits `params: Promise<{ id }>`; calls `notFound()` on missing/foreign booking
- [ ] Page status-branches: `cancelled` → destructive banner with cancelled_at + cancelled_by line; `confirmed && start_at > now()` → mounts `<CancelButton>`; `confirmed && past` → muted "already passed" banner
- [ ] Page renders event type name, status badge, scheduled time in account.timezone (primary) and booker.timezone (secondary), booker name/email/phone/timezone, and custom-question answers as a key/value list
- [ ] `app/(shell)/app/bookings/[id]/_components/cancel-button.tsx` starts with `"use client"`; uses shadcn AlertDialog + Textarea; reason is a controlled input
- [ ] CancelButton invokes the `cancelBookingAsOwner` Server Action via `useTransition`; preventDefault on the action onClick
- [ ] On success: dialog closes, toast.success(), router.refresh() — NO optimistic UI
- [ ] On `not_active` error: dialog closes + refresh (cancelled banner now renders); on other errors: dialog stays open for retry
- [ ] `app/(shell)/app/bookings/[id]/_lib/actions.ts` starts with `"use server"`; exports `cancelBookingAsOwner(bookingId, reason?)` returning `{ ok: true } | { error: string }`
- [ ] Server Action does an RLS-scoped pre-check via `createClient()` from `@/lib/supabase/server`; null result → `{ error: "Booking not found." }` (no foreign-UUID leak)
- [ ] Server Action delegates to `cancelBooking()` from `lib/bookings/cancel.ts` with `actor: "owner"`, `reason: normalizedReason`, `ip: null`, and an env-derived `appUrl`
- [ ] Reason normalization: empty string OR whitespace-only → undefined (so booker email omits reason row per Plan 06-02 EMAIL-07 lock)
- [ ] On success: action calls `revalidatePath(`/app/bookings/${bookingId}`)` then returns `{ ok: true }`
- [ ] NO modifications to `lib/bookings/cancel.ts`, `lib/email/send-cancel-emails.ts`, or `app/(shell)/app/bookings/page.tsx`
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/06-cancel-and-reschedule-lifecycle/06-05-SUMMARY.md` documenting:
- Route added: `/app/bookings/[id]` (Server Component dashboard detail page) — owner-only via the existing (shell) auth-gated layout
- Server Action contract: `cancelBookingAsOwner(bookingId, reason?) → { ok: true } | { error: string }`
- Two-stage authorization: RLS-scoped pre-check (Phase 1 policies) → delegate to shared `cancelBooking()` (Plan 06-03 service-role)
- Single-source-of-truth confirmation: `lib/bookings/cancel.ts` is the ONLY place where booking cancellation happens. Both `/api/cancel` (booker, Plan 06-04) and this Server Action (owner, Plan 06-05) call it. The `actor` parameter is the only behavioral fork.
- Email branching is fully delegated: actor='owner' triggers the apologetic + re-book-link booker email branch (Plan 06-02 send-cancel-emails.ts); reason normalization (empty → undefined) means empty reason omits the booker email row entirely
- UX decisions implemented: shadcn AlertDialog (Plan 03-04 aesthetic), optional Textarea reason, NO optimistic UI (revalidatePath + router.refresh handle the swap to cancelled-state banner)
- Open Question B confirmed resolved: detail page lives at `/app/bookings/[id]`; bookings list page (Phase 8) will link to this page
- Forward locks for Plan 06-06 (tests):
  - Integration test "Owner cancel" (test #8) MUST exercise the Server Action path AND assert the booker email body contains the apologetic copy + re-book link + reason callout when reason is non-empty (and omits the reason row when empty/whitespace-only)
  - Manual QA must include the owner-cancel flow from `/app/bookings/[id]`
</output>
</content>
</invoke>