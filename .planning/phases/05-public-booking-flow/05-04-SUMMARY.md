---
phase: 05-public-booking-flow
plan: 04
subsystem: ui
tags: [nextjs, server-component, supabase, admin-client, dynamic-route, booking, public]

# Dependency graph
requires:
  - phase: 05-public-booking-flow/01
    provides: accounts.owner_email column (used in loader select + empty-state mailto link)
  - phase: 04-availability-engine/06
    provides: createAdminClient() public-page pattern established in /api/slots
  - phase: 03-event-types-crud/01
    provides: event_types schema with is_active, deleted_at, custom_questions columns
provides:
  - Public route /[account]/[event-slug] — Server Component shell, 200 for valid pairs, 404 otherwise
  - Reserved-slug guard (app/api/_next/auth) locked in load-event-type.ts RESERVED_SLUGS Set
  - BookingPageData interface + AccountSummary + EventTypeSummary (Wave 2 → Wave 3 prop contract)
  - loadEventTypeForBookingPage() service-role loader (account by slug, event_type by account_id+slug)
  - not-found.tsx friendly 404 fallback
  - PLAN-05-06-REPLACE-IMPORT-START/END + PLAN-05-06-REPLACE-INLINE-START/END patch markers
affects:
  - 05-public-booking-flow/05-06 (BookingShell client component; consumes AccountSummary + EventTypeSummary props)
  - 05-public-booking-flow/05-05 (confirmation screen at /confirmed route — will need similar loader)
  - 07-widget-and-branding (embed iframe may share the same [account]/[event-slug] route with a layout variant)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component + service-role admin client for public-facing routes (identical to /api/slots Pattern 1)"
    - "Inline stub function with PLAN-XX-YY-REPLACE-START/END comment markers for future wave patch (same as Plan 04-04 → 04-05)"
    - "Next.js 16 async params: const { account, 'event-slug': eventSlug } = await params"
    - "Reserved-slug guard in loader (not in page): RESERVED_SLUGS.has(accountSlug) → return null → notFound()"

key-files:
  created:
    - app/[account]/[event-slug]/page.tsx
    - app/[account]/[event-slug]/_lib/types.ts
    - app/[account]/[event-slug]/_lib/load-event-type.ts
    - app/[account]/[event-slug]/not-found.tsx
  modified: []

key-decisions:
  - "Reserved slug list locked: ['app', 'api', '_next', 'auth'] — Phase 7 may add 'embed' if /embed/[account]/[slug] route introduced"
  - "Page does NOT prefetch slots — client (BookingShell, Plan 05-06) owns the /api/slots request after browser TZ detection"
  - "generateMetadata: title = [event] — [account], description = event_type.description[:160] or fallback copy"
  - "Inline BookingShell stub (not a separate file) — keeps route 200-able in Wave 2; Plan 05-06 deletes stub + adds real import"
  - "No layout.tsx under [account]/[event-slug] — default root layout sufficient; Phase 7 adds a layout segment if branding inheritance needed"
  - "No dynamic = 'force-dynamic' export — dynamic route segments + admin client = auto-dynamic; explicit export adds nothing"

patterns-established:
  - "Loader returns null for ALL 404 cases (reserved slug, missing account, missing/inactive/deleted event_type) — page calls notFound() on null"
  - "PLAN-05-06-REPLACE-IMPORT-START/END marks the import comment block; PLAN-05-06-REPLACE-INLINE-START/END marks the inline stub"

# Metrics
duration: 3min
completed: 2026-04-25
---

# Phase 5 Plan 04: Public Booking Page Server Component Shell — Summary

**Server Component shell at `/[account]/[event-slug]` with service-role loader, reserved-slug guard, generateMetadata, and PLAN-05-06 patch markers for the Wave 3 BookingShell swap**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-25T22:10:35Z
- **Completed:** 2026-04-25T22:13:21Z
- **Tasks:** 2 / 2
- **Files modified:** 4 created

## Accomplishments

- Created `_lib/types.ts` with `AccountSummary`, `EventTypeSummary`, `BookingPageData` — JSON-serializable interfaces for Server→Client prop boundary
- Created `_lib/load-event-type.ts` — service-role loader with `RESERVED_SLUGS` guard, filters `is_active=true AND deleted_at IS NULL`, returns null on any miss
- Created `not-found.tsx` — friendly 404 fallback (no slug leak, no "route would have existed" hint)
- Created `page.tsx` — Server Component with `generateMetadata`, async params destructure, `notFound()` on null data, header block, inline `BookingShell` stub with patch markers
- `npm run build` exits 0; route appears as `ƒ /[account]/[event-slug]` (Dynamic) in build output

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types + loader** - `bad6b2a` (feat)
2. **Task 2: Server Component page + metadata** - `a608f9e` (feat)

## Files Created/Modified

- `app/[account]/[event-slug]/_lib/types.ts` — `AccountSummary`, `EventTypeSummary`, `CustomQuestion`, `BookingPageData` interfaces
- `app/[account]/[event-slug]/_lib/load-event-type.ts` — `loadEventTypeForBookingPage()` with `server-only`, admin client, reserved-slug guard, active+non-deleted filter
- `app/[account]/[event-slug]/not-found.tsx` — friendly 404 (no leakage of slug existence)
- `app/[account]/[event-slug]/page.tsx` — `default` + `generateMetadata` exports; inline `BookingShell` stub; patch markers

## Decisions Made

- **Reserved-slug list:** `["app", "api", "_next", "auth"]` — enforced in loader, not in proxy.ts. Guard lives in `load-event-type.ts` so it fires for both `page.tsx` and `generateMetadata`. Phase 7 may extend the list with `"embed"` if a `/embed/[account]/[slug]` route is added.

- **Client owns slot fetch:** Page does NOT prefetch slots server-side. `BookingShell` (Plan 05-06) calls `/api/slots` after detecting browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Prefetching server-side would use the server's timezone, returning wrong slot times. This is a correctness constraint, not a performance tradeoff.

- **generateMetadata double-loads:** `generateMetadata` and `BookingPage` both call `loadEventTypeForBookingPage()`. Next.js 16 does not deduplicate these by default (no React cache wrapper on the loader). Two DB round-trips per render. Acceptable for v1; Phase 8 can add `import { cache } from 'react'` wrapper if needed.

- **Inline stub vs separate file:** `BookingShell` stub is defined inline in `page.tsx` (not as a separate `_components/booking-shell-stub.tsx`). Simplifies Plan 05-06 patch: delete function + add import. Separate file would require Plan 05-06 to delete a file AND modify page.tsx anyway.

- **No `@ts-expect-error`:** Build revealed TypeScript can resolve the inline `BookingShell` function from within the same file — no type error to suppress. Removed the directive (Rule 1 auto-fix: unused directive causes build failure).

## Wave 2 → Wave 3 Prop Contract (LOCKED)

Plan 05-06 MUST accept these exact props on `BookingShell`:

```typescript
interface BookingShellProps {
  account: AccountSummary;   // { id, slug, name, timezone, owner_email }
  eventType: EventTypeSummary; // { id, slug, name, description, duration_minutes, custom_questions }
}
```

Both types are exported from `app/[account]/[event-slug]/_lib/types.ts`.

## Patch Markers for Plan 05-06

File: `app/[account]/[event-slug]/page.tsx`

| Marker | Lines | Action |
|--------|-------|--------|
| `PLAN-05-06-REPLACE-IMPORT-START` | 68 | Replace JSX comment block with: `import { BookingShell } from "./_components/booking-shell";` |
| `PLAN-05-06-REPLACE-IMPORT-END` | 70 | (end of import marker block) |
| `PLAN-05-06-REPLACE-INLINE-START` | 77 | Delete from this line... |
| `PLAN-05-06-REPLACE-INLINE-END` | 106 | ...to this line (inclusive). Deletes the stub `function BookingShell(...)` |

Plan 05-06 procedure:
1. Create `app/[account]/[event-slug]/_components/booking-shell.tsx` (export `BookingShell`)
2. Replace lines 68–70 (import marker block) with the real import
3. Delete lines 77–106 (inline stub)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `@ts-expect-error` directive**

- **Found during:** Task 2 (npm run build)
- **Issue:** Plan's code snippet included `{/* @ts-expect-error — BookingShell ships in Plan 05-06; stub defined below until then */}` above the `<BookingShell />` JSX. TypeScript resolves the inline stub function defined later in the same file, so no type error exists — the directive caused a build error (`Unused '@ts-expect-error' directive`).
- **Fix:** Removed the `@ts-expect-error` comment line from `page.tsx`.
- **Files modified:** `app/[account]/[event-slug]/page.tsx`
- **Verification:** `npm run build` exits 0 after removal.
- **Committed in:** `a608f9e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — build error from unused directive)
**Impact on plan:** Minimal; directive was a copy-paste artifact from plan snippet. No scope creep.

## Issues Encountered

- **Pre-existing `npm run lint` failure:** ESLint circular-JSON error (`Converting circular structure to JSON`) has been documented in STATE.md since Phase 1 as a Phase 8 backlog item. Not introduced by this plan. Build exits 0; lint is not a blocker.

## User Setup Required

None — public route, no new environment variables or service configuration required.

## Next Phase Readiness

- **Plan 05-05 (confirmation screen):** Route shell exists; confirmation screen lives at `/[account]/[event-slug]/confirmed` (or state-driven within `BookingShell`). Plan 05-05 can import types from `_lib/types.ts`.
- **Plan 05-06 (BookingShell client component):** Prop contract locked. Patch markers in place. Plan 05-06 creates `_components/booking-shell.tsx`, swaps the import, deletes the stub.
- No blockers.

---
*Phase: 05-public-booking-flow*
*Completed: 2026-04-25*
