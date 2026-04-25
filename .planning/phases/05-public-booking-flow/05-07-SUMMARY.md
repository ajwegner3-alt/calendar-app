---
phase: 05-public-booking-flow
plan: "07"
subsystem: ui
tags: [next.js, supabase, date-fns, server-component, public-route, confirmation]

# Dependency graph
requires:
  - phase: 05-public-booking-flow
    provides: "bookings table with id UUID, start_at, end_at, booker_email, booker_name, booker_timezone, status; createAdminClient(); accounts.owner_email; cancel_token_hash/reschedule_token_hash"
  - phase: 05-public-booking-flow
    plan: "05-05"
    provides: "POST /api/bookings returns redirectTo = /${accountSlug}/${eventSlug}/confirmed/${bookingId}"
  - phase: 05-public-booking-flow
    plan: "05-04"
    provides: "Public booking page shell, _lib/types.ts, loadEventTypeForBookingPage pattern"
  - phase: 04-availability-engine
    plan: "04-01"
    provides: "date-fns v4 + @date-fns/tz v1 TZDate + format pattern"

provides:
  - "Dedicated confirmation route at /[account]/[event-slug]/confirmed/[booking-id]"
  - "Server Component page with generateMetadata (noindex), status-branch rendering, masked-email copy"
  - "server-only loader with UUID regex pre-flight, cross-tenant defense-in-depth, parallel account + event_type fetch"

affects:
  - "Phase 6 (cancel/reschedule): status branch in page.tsx already handles cancelled/rescheduled gracefully — Phase 6 does NOT need to touch this route"
  - "Phase 9 (manual QA): live test — book via form, verify redirect lands on confirmed page with correct date/time in booker TZ, masked email"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UUID regex pre-flight before DB query — fast-reject invalid booking-id without a DB round-trip"
    - "Parallel Promise.all for independent joins (account + event_type) after initial booking fetch"
    - "maskEmail() algorithm: full local part + first-char + stars for domain-name + full TLD"
    - "Cross-tenant defense-in-depth: URL slugs verified against DB-resolved values after service-role fetch"
    - "export async function generateMetadata only (no module-level export const metadata) — Next.js 16 disallows both"

key-files:
  created:
    - "app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts"
    - "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx"
  modified: []

key-decisions:
  - "DEDICATED route (not stateful step in BookingShell) — CONTEXT decision #6 explicitly overrides RESEARCH Pattern 8"
  - "Service-role read keyed by booking.id UUID (122 bits entropy ≈ unguessable) — RLS blocks anon reads on bookings"
  - "Cross-tenant defense-in-depth: URL account-slug AND event-slug verified against booking's actual parents after fetch"
  - "Email masking algorithm: show full local part + first-letter-and-stars domain + full TLD (e.g. andrew@e***.com)"
  - "Status branch: confirmed → happy-path card; any other status → friendly 'no longer active' fallback (future-proofs Phase 6)"
  - "is_active + deleted_at filter on event_type: archived event types' old confirmations 404 (acceptable v1 behavior)"
  - "generateMetadata only (removed module-level metadata export) — build failure with both; generateMetadata is the right pattern for dynamic titles"
  - "No client components — confirmation surface is fully static (no user interaction after page load)"

patterns-established:
  - "Confirmation route: server-only loader + Server Component page, no client islands"
  - "maskEmail(email: string): string — reusable pattern for any PII display surface"

# Metrics
duration: 8min
completed: 2026-04-25
---

# Phase 5 Plan 07: Confirmation Screen Route Summary

**Bookmarkable confirmation route at /[account]/[event-slug]/confirmed/[booking-id] — service-role UUID lookup with cross-tenant slug verification, date/time in booker TZ via TZDate, and masked-email copy matching CONTEXT decision #7**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-25T22:32:21Z
- **Completed:** 2026-04-25T22:40:30Z
- **Tasks:** 1
- **Files created:** 2

## Accomplishments

- Server-only loader with UUID regex pre-flight, parallel account + event_type fetch, and defense-in-depth slug verification (cross-tenant access returns notFound())
- Server Component page renders booking details in BOOKER timezone, masks email (local@d***.tld format), branches on status (confirmed → card; other → friendly fallback)
- generateMetadata sets `robots: { index: false, follow: false }` — per-booking pages never indexed
- `npm run build` exits 0; route appears as `ƒ /[account]/[event-slug]/confirmed/[booking-id]` in build output
- Pushed to main; Vercel auto-deploy triggered

## Task Commits

1. **Task 1: Confirmation loader + page** — `2320777` (feat)

**Plan metadata:** (to follow in this commit)

## Files Created/Modified

- `app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts` — server-only loader: UUID regex, service-role fetch, cross-tenant verification, is_active/deleted_at filter
- `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` — Server Component: generateMetadata, TZDate formatting, maskEmail, status branch, CONTEXT decision #7 copy

## Decisions Made

### RLS-anon-read tradeoff resolution

RLS migration 20260419120001 blocks all anon reads on `bookings`. The service-role client (`createAdminClient()`) bypasses RLS. Authorization instead comes from the URL structure itself: `booking.id` is a UUID v4 (122 bits entropy — effectively unguessable by brute force). Defense-in-depth on top: after fetching the row, the URL `account` slug and `event-slug` are compared against the booking's actual parent slugs. Any mismatch returns `null` → `notFound()`. This prevents a valid booking ID from being browsable via a wrong-tenant URL.

The confirmation surface shows only what's already in the booker's email: event name, date/time, owner name, and a masked email stub. No booker phone, custom answers, or full email. The UUID-as-soft-auth tradeoff is acceptable at this PII exposure level.

### Why no client components

The confirmation screen has no user-interactive elements after page load. Everything needed (booking details, formatted date/time, masked email) is available server-side. A pure Server Component avoids hydration overhead and keeps the bundle slim.

### Email masking algorithm

`maskEmail("andrew@example.com")` → `"andrew@e***.com"`

Algorithm:
1. Split on last `@` → `local` = `"andrew"`, `domain` = `"example.com"`
2. Split domain on last `.` → `domainName` = `"example"`, `tld` = `".com"`
3. Replace domainName with `first_char + "*" * max(2, len-1)` → `"e***"`
4. Reassemble: `${local}@${maskedDomain}${tld}`

The local part is shown in full (the booker's own name/identifier — they know it). The domain-name is the most anonymizing part to replace. TLD shown in full for readability.

### Status-branch handling (Phase 6 future-proofing)

The loader returns the booking row regardless of status (confirmed, cancelled, rescheduled, or any other). The page checks `booking.status === "confirmed"` and renders two distinct states:

- `isConfirmed = true`: happy-path confirmation card (event, when, duration, with, masked email note)
- `isConfirmed = false`: friendly "This booking is no longer active. Check your email for the latest details." message

Phase 6 cancel/reschedule flows may flip `status` to `"cancelled"` or `"rescheduled"` without this route breaking. The URL remains stable and returns a graceful response.

### is_active / deleted_at filter on event_type

If an event type is soft-deleted or deactivated after a booking was made, revisiting the confirmation URL will 404. Per CONTEXT decision (plan constraint #4), this is acceptable v1 behavior: the booker has all details in their email. This is a privacy consideration — archived event types' bookings should not be browsable on the public surface.

### generateMetadata only (no module-level export const metadata)

Initial implementation exported both `export const metadata` (module-level) and `export async function generateMetadata`. Next.js 16 build failed with:

> "metadata" and "generateMetadata" cannot be exported at the same time, please keep one of them.

Resolved by removing the static `metadata` export. `generateMetadata` is the correct pattern for dynamic titles (it reads `eventType.name` from the DB). The `robots: { index: false, follow: false }` directive is included in every `generateMetadata` return path including the 404 fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed conflicting module-level `export const metadata`**

- **Found during:** Task 1 (npm run build)
- **Issue:** Page exported both `export const metadata` and `export async function generateMetadata`. Next.js 16 Turbopack build error: "cannot be exported at the same time."
- **Fix:** Removed the static `export const metadata = { robots: ... }`. The `robots` directive is now returned from every branch of `generateMetadata` (found title + fallback 404 title).
- **Files modified:** `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx`
- **Verification:** `npm run build` exits 0; route appears in build output as dynamic (`ƒ`)
- **Committed in:** 2320777

---

**Total deviations:** 1 auto-fixed (Rule 1 — build-time bug)
**Impact on plan:** Single-line removal. No functional change; noindex still applied on every code path.

## Issues Encountered

- Pre-existing ESLint circular-JSON error (`npm run lint` exits 2) is a known infrastructure issue tracked in STATE.md since Phase 1 ("Phase 8 backlog: ESLint flat-config migration"). Does not affect this plan's deliverables. Build passes cleanly.

## User Setup Required

None — no external service configuration required. Route is fully server-rendered using existing env vars (Supabase service role key, already configured).

## Next Phase Readiness

- **Phase 5 complete:** Booking flow is end-to-end. Visitor lands on `/[account]/[event-slug]` → picks slot → fills form → POST /api/bookings → redirect → confirmation screen at `/[account]/[event-slug]/confirmed/[booking-id]`.
- **Phase 6 readiness:** `cancel_token_hash` and `reschedule_token_hash` exist in `bookings` table (Plan 05-01). Raw tokens are in the booker's email (Plan 05-03). Phase 6 only needs to wire `/cancel/:rawToken` and `/reschedule/:rawToken` route handlers. The confirmation page status-branch already handles the post-cancel UX gracefully.
- **Phase 9 manual QA:** End-to-end booking flow needs live test — book via the public form, verify redirect to `/confirmed/[id]`, check date/time in booker TZ, confirm masked email, confirm noindex in page source, confirm cross-tenant 404.

---
*Phase: 05-public-booking-flow*
*Completed: 2026-04-25*
