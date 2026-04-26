---
phase: 07-widget-and-branding
plan: 08
subsystem: ui
tags: [next.js, server-component, supabase, branding, tailwind, wcag, typescript]

# Dependency graph
requires:
  - phase: 07-01-branding-lib-and-read-helper
    provides: pickTextColor + RESERVED_SLUGS pattern + admin client pattern
  - phase: 07-06-apply-branding-to-page-surfaces
    provides: BrandedPage shared wrapper (created in that plan)
  - phase: 05-public-booking-flow-and-email
    provides: /[account]/[event-slug] route that cards link to
provides:
  - app/[account]/page.tsx — public account index: card grid of active event types
  - app/[account]/_lib/load-account-listing.ts — server-only loader with reserved-slug guard + admin client
  - app/[account]/_lib/types.ts — AccountListingData + EventTypeCardData interfaces
  - app/[account]/_components/event-type-card.tsx — brand-styled card with whole-card Link
  - app/[account]/_components/empty-state.tsx — friendly empty state with optional owner_email
affects:
  - 07-09-embed-snippet-dialog (no overlap; this plan complete)
  - 08-reminders-hardening (no action needed; /[account] complete)
  - 09-manual-qa (verify /nsi renders cards; /embed 404s; /fake-account 404s)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RESERVED_SLUGS duplicated in load-account-listing.ts (independent from load-event-type.ts); manual sync required"
    - "Empty eventTypes returns success not null — empty-state is the render branch, never a 404"
    - "Whole-card-is-a-Link pattern: outer <Link> wraps all card content (no nested <a>)"
    - "Description truncation at 120 chars with trimEnd() + ellipsis (CONTEXT lock)"
    - "Brand color applied via inline CSSProperties: badge + CTA use effectiveColor ?? #0A2540"

key-files:
  created:
    - app/[account]/page.tsx
    - app/[account]/_lib/types.ts
    - app/[account]/_lib/load-account-listing.ts
    - app/[account]/_components/event-type-card.tsx
    - app/[account]/_components/empty-state.tsx
  modified: []

key-decisions:
  - "RESERVED_SLUGS intentionally duplicated (not imported from load-event-type.ts) — independent loaders, bounded coupling risk"
  - "loadAccountListing fails soft on events query error: returns account with empty events vs throwing"
  - "Card is a Server Component (no use client) — no client interactivity, whole-card Link via next/link"
  - "generateMetadata calls loadAccountListing independently (acceptable double call; Next.js caches RSC data)"
  - "Empty state never 404s on real account — notFound() only on reserved slug or missing account row"

patterns-established:
  - "Pattern: /[account] and /[account]/[event-slug] coexist via Next.js depth scoping (no conflict)"
  - "Pattern: Service-role admin client required for all unauthenticated public routes (RLS returns 0 rows for anon)"

# Metrics
duration: 12min
completed: 2026-04-26
---

# Phase 7 Plan 08: Account Index Route Summary

**Public `/[account]` index page with 2-column responsive card grid of active event types, brand-colored badges/CTAs via BrandedPage wrap, and owner_email empty state — RESERVED_SLUGS guard mirrors load-event-type.ts**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-26T14:50:00Z
- **Completed:** 2026-04-26T15:02:00Z
- **Tasks:** 3/3
- **Files modified:** 5 created (loader, types, card, empty-state, page)

## Accomplishments

- Built `loadAccountListing(slug)` with service-role admin client, RESERVED_SLUGS guard (includes "embed"), fail-soft on events query error, empty-events returns success (not null — caller renders empty state)
- Created `EventTypeCard` Server Component: whole-card `<Link>` to `/${account}/${event.slug}`, description truncated at 120 chars, brand-colored duration badge + Book CTA via `pickTextColor` contrast helper
- Created `AccountEmptyState` with `ownerEmail` branch: mailto link when present; graceful fallback text when null
- Wired `app/[account]/page.tsx`: `notFound()` on reserved/missing slugs, `BrandedPage` wrap for logo + CSS vars, 2-col responsive grid, `generateMetadata` with dynamic title
- Build confirmed: `/[account]` route registered as dynamic alongside existing `/[account]/[event-slug]` (Next.js depth scoping, no conflict); 80/80 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Loader + types + reserved-slug guard** — committed by concurrent 07-05 run as `2796c55`
2. **Task 2: Card + empty-state components** — `413131c` (feat)
3. **Task 3: Wire app/[account]/page.tsx** — `d84c5ee` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `app/[account]/_lib/types.ts` — `AccountListingData` + `EventTypeCardData` interfaces
- `app/[account]/_lib/load-account-listing.ts` — server-only; `loadAccountListing(slug)` with admin client + RESERVED_SLUGS guard
- `app/[account]/_components/event-type-card.tsx` — Server Component; whole-card Link; 120-char truncation; brand-colored badge + CTA
- `app/[account]/_components/empty-state.tsx` — friendly empty state; optional `ownerEmail` mailto branch
- `app/[account]/page.tsx` — Account index: BrandedPage wrap, card grid, empty state, generateMetadata

## Decisions Made

- **RESERVED_SLUGS intentionally duplicated** — `load-account-listing.ts` and `load-event-type.ts` each own their own `Set`. Not exported/shared because these are independent public-route loaders; accidental coupling would mean a change to one affects the other. Known cost: must manually keep both in sync. Any future v2 multi-tenant onboarding MUST update BOTH sets.
- **Empty events returns `{ account, eventTypes: [] }` not `null`** — caller renders `AccountEmptyState`; CONTEXT lock says "empty state never 404s — always useful."
- **Fail-soft on events DB error** — `console.error` + return account with empty events. Prevents 404'ing on transient DB blips. Logging retained for observability.
- **No `generateStaticParams`** — accounts are dynamic/multi-tenant; ISR not needed for v1.
- **`generateMetadata` re-calls loader** — acceptable double call; Next.js caches RSC fetch calls within a single render pass.

## Deviations from Plan

### Context Note

Task 1 files (`types.ts` and `load-account-listing.ts`) were committed as part of the concurrent 07-05 plan run (commit `2796c55`). The files match the plan spec exactly — the 07-05 executor pre-created them as a dependency resolution. This plan verified the existing files before proceeding to Tasks 2 and 3.

### Auto-fixed Issues

None beyond the above context note. Plan executed exactly as specified for Tasks 2 and 3.

---

**Total deviations:** 0 auto-fixes required
**Impact on plan:** No scope creep; plan executed as designed.

## Issues Encountered

None. The `_lib/` files were already committed by a concurrent 07-05 run; content matched the plan spec. Build clean; 80/80 tests pass (up from 75 — 5 new tests added by 07-05 widget.js test suite).

## User Setup Required

None — no external service configuration required. Branding columns (`logo_url`, `brand_primary`) are populated by Plan 07-04 branding editor; this plan only reads them.

## Next Phase Readiness

- `/[account]` route is fully wired and build-verified
- Route coexistence with `/[account]/[event-slug]` confirmed (depth scoping works in Next.js 16)
- Reserved slugs guard in place — `/embed`, `/app`, `/api`, `/auth`, `/_next` all 404
- BrandedPage integration tested (existing component from 07-06 concurrent run)
- **Forward implication:** Any future v2 multi-tenant slug onboarding MUST update BOTH `RESERVED_SLUGS` sets (in `load-event-type.ts` AND `load-account-listing.ts`)
- Ready for Plan 07-09 (embed snippet dialog) — no blockers from this plan

---
*Phase: 07-widget-and-branding*
*Completed: 2026-04-26*
