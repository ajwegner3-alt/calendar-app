---
phase: 06-cancel-and-reschedule-lifecycle
plan: 05
subsystem: ui
tags: [nextjs, supabase, server-actions, alert-dialog, rls, cancel, shadcn, typescript]

# Dependency graph
requires:
  - phase: 06-03
    provides: cancelBooking(args) shared atomic function; CancelBookingResult discriminated union
  - phase: 06-02
    provides: sendCancelEmails with actor='owner' apologetic + re-book-link branch; EMAIL-07 empty-reason omission
  - phase: 01-foundation
    provides: RLS policies on bookings restricting SELECT to authenticated owner's account_id
  - phase: 05-public-booking-flow
    provides: bookings table schema including cancelled_at, cancelled_by, cancel_token_hash columns
provides:
  - /app/bookings/[id] route: Server Component owner-facing booking detail page with status-branched render
  - CancelButton client component: AlertDialog + Textarea reason, invokes cancelBookingAsOwner Server Action
  - cancelBookingAsOwner(bookingId, reason?): owner-side Server Action; RLS pre-check then delegate to shared cancelBooking()
affects:
  - 06-06-integration-tests-and-manual-qa (must test owner cancel path via Server Action)
  - Phase 8 bookings list (will link rows to /app/bookings/[id])

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-stage authorization: RLS-scoped pre-check (Phase 1 policies) → delegate to shared service-role function (Plan 06-03)"
    - "Server Action owns revalidatePath; client owns router.refresh() for instantaneous UI swap"
    - "e.preventDefault() on AlertDialogAction onClick prevents premature dialog close before Server Action resolves"
    - "Reason normalization: empty/whitespace → undefined before Server Action delegate (Plan 06-02 EMAIL-07 lock)"
    - "appUrl resolved from NEXT_PUBLIC_APP_URL ?? https://NEXT_PUBLIC_VERCEL_URL ?? localhost:3000 in Server Action (no req.nextUrl)"
    - "Defensive Array.isArray normalization for supabase-js join shape variance (Phase 5 + Phase 6 established pattern)"

key-files:
  created:
    - app/(shell)/app/bookings/[id]/_lib/actions.ts
    - app/(shell)/app/bookings/[id]/page.tsx
    - app/(shell)/app/bookings/[id]/_components/cancel-button.tsx
  modified: []

key-decisions:
  - "cancelBookingAsOwner does NOT inline any DB mutation — 100% delegates to lib/bookings/cancel.ts (single source of truth)"
  - "RLS pre-check returns { error: 'Booking not found.' } for both missing AND foreign-account rows (no 403 vs 404 distinction — prevents UUID leakage)"
  - "No optimistic UI — Server Action + revalidatePath drives state; client calls router.refresh() after success/not_active to trigger cancelled-state banner"
  - "CancelButton only mounts when status==='confirmed' AND start_at > now() — no destructive control on already-cancelled or already-past bookings"
  - "Open Question B confirmed resolved: detail page at /app/bookings/[id]; bookings list (Phase 8) will link rows here"
  - "AlertDialogDescription keeps text inline (no asChild div wrapper) — shadcn AlertDialogDescription in this project doesn't expose asChild prop"

patterns-established:
  - "Pattern: Two-stage owner authorization — RLS pre-check gate + service-role delegate. Prevents any logged-in owner from cancelling another account's booking via UUID guessing."
  - "Pattern: Server Action appUrl resolution — read from NEXT_PUBLIC_APP_URL ?? `https://${NEXT_PUBLIC_VERCEL_URL}` ?? localhost:3000 (Server Actions can't access req.nextUrl)"
  - "Pattern: AlertDialog confirm flow — e.preventDefault on AlertDialogAction, useTransition, manual setOpen(false) after resolution"

# Metrics
duration: 5min
completed: 2026-04-26
---

# Phase 6 Plan 05: Owner Bookings Detail and Cancel Summary

**Owner-side booking detail page at `/app/bookings/[id]` with status-branched render (confirmed/cancelled/past) and AlertDialog cancel control that delegates to shared `cancelBooking()` via a two-stage RLS-pre-check + service-role Server Action**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-26T01:57:30Z
- **Completed:** 2026-04-26T02:03:00Z
- **Tasks:** 2
- **Files modified:** 3 created

## Accomplishments
- Owner booking detail route `/app/bookings/[id]` — Server Component with RLS-scoped fetch, notFound() on foreign/missing, status-branched UI (cancelled banner with actor/date, confirmed-past muted banner, confirmed-future CancelButton)
- `cancelBookingAsOwner` Server Action with two-stage authorization (RLS pre-check prevents foreign UUID cancellation, then delegates 100% to shared `cancelBooking()` from Plan 06-03 with `actor: 'owner'`)
- CancelButton client AlertDialog with optional reason Textarea, useTransition, preventDefault-on-confirm, and correct error-branch handling (success: close+refresh; not_active: close+refresh; other: dialog stays open)

## Task Commits

Each task was committed atomically:

1. **Task 1: Server Action cancelBookingAsOwner** - `364351e` (feat)
2. **Task 2: Booking detail page + CancelButton** - `4338be3` (feat)

**Plan metadata:** (pending — docs commit below)

## Files Created/Modified
- `app/(shell)/app/bookings/[id]/_lib/actions.ts` - Server Action: RLS-scoped pre-check + normalize reason + delegate to cancelBooking(actor:'owner', ip:null)
- `app/(shell)/app/bookings/[id]/page.tsx` - Server Component: RLS fetch, notFound, status branches, event type name + dual-TZ time + booker block + custom answers
- `app/(shell)/app/bookings/[id]/_components/cancel-button.tsx` - Client component: AlertDialog + Textarea + useTransition confirm flow

## Decisions Made
- **Two-stage auth, not single-stage:** `cancelBookingAsOwner` does the RLS pre-check itself before delegating to `cancelBooking()` (which uses the service-role client that bypasses RLS). This is the required pattern — `cancelBooking()` intentionally trusts its bookingId arg; the caller is responsible for ownership verification (documented in Plan 06-03).
- **No 403/404 distinction:** Both "booking doesn't exist" and "booking belongs to another account" return `{ error: 'Booking not found.' }` — prevents leaking the existence of foreign UUIDs to a logged-in but wrong-account owner.
- **Reason normalization before delegate:** `reason?.trim()` → undefined if empty/whitespace before passing to `cancelBooking()`. This ensures the booker email omits the reason callout row entirely when no reason was provided (Plan 06-02 EMAIL-07 lock).
- **appUrl from env:** `NEXT_PUBLIC_APP_URL ?? https://${NEXT_PUBLIC_VERCEL_URL} ?? localhost:3000` — Server Actions don't have access to `req.nextUrl`; this is the correct pattern for the owner dashboard path.
- **AlertDialogDescription no asChild:** The shadcn AlertDialogDescription in this project is a thin Radix wrapper without asChild support. Used inline text instead of the `<div>` wrapper shown in the plan template.

## Deviations from Plan

None — plan executed exactly as written. The single minor adaptation (AlertDialogDescription text inline vs. asChild div) is cosmetically equivalent and doesn't affect behavior.

## Issues Encountered

Build appeared to fail on first run due to a stale Turbopack `.next/build-lock` file from the previous build process (not related to this plan's changes). Cleared the lock file and re-ran `npm run build` — passed cleanly with `/app/bookings/[id]` appearing in the route table.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-05 complete. Owner can navigate to `/app/bookings/<uuid>` and cancel confirmed-future bookings from the dashboard.
- Plan 06-06 (integration tests + manual QA) is unblocked.
- Forward locks for Plan 06-06:
  - Integration test "Owner cancel" MUST exercise the Server Action path and assert booker email contains apologetic copy + re-book link + reason callout when non-empty (and omits reason row when empty/whitespace-only)
  - Manual QA must include the owner-cancel flow from `/app/bookings/[id]`
- Phase 8 bookings list will link rows to this detail page — the URL contract (`/app/bookings/[id]`) is now locked.

---
*Phase: 06-cancel-and-reschedule-lifecycle*
*Completed: 2026-04-26*
