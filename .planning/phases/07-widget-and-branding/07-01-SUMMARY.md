---
phase: 07-widget-and-branding
plan: 01
subsystem: ui
tags: [branding, wcag, contrast, supabase, tailwind, server-only, typescript]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: accounts table with logo_url + brand_primary columns (initial schema)
  - phase: 02-owner-auth-and-dashboard-shell
    provides: NSI navy #0A2540 as DEFAULT_BRAND_PRIMARY (Phase 2 Tailwind @theme lock)
  - phase: 05-public-booking-flow-and-email
    provides: AccountSummary type + loadEventTypeForBookingPage loader (extended in this plan)
provides:
  - lib/branding/contrast.ts — WCAG relativeLuminance + pickTextColor helpers
  - lib/branding/types.ts — Branding interface shared across all surfaces
  - lib/branding/read-branding.ts — server-only branding read helper (getBrandingForAccount + brandingFromRow)
  - AccountSummary extended with logo_url + brand_primary fields
  - RESERVED_SLUGS includes "embed" (guard for Phase 7 /embed/* route)
affects:
  - 07-02-proxy-csp-and-headers (embed route needs CSP gate)
  - 07-03-embed-route-and-height-reporter (embed page imports brandingFromRow)
  - 07-04-branding-editor (saves to logo_url + brand_primary via admin client)
  - 07-06-apply-branding-to-page-surfaces (uses AccountSummary.brand_primary + pickTextColor)
  - 07-07-apply-branding-to-emails (uses getBrandingForAccount in email senders)
  - 07-08-account-index-route (new /[account] loader needs same RESERVED_SLUGS + branding)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WCAG contrast helper with 0.04045 sRGB linearization threshold (not 0.03928)"
    - "server-only guard as line 1 of lib/branding/read-branding.ts (mirrors lib/supabase/admin.ts)"
    - "brandingFromRow vs getBrandingForAccount split: zero-cost path for callers with row, async path for ID-only callers"
    - "Fail-open branding: missing or errored DB row returns all-defaults (logoUrl null, primaryColor #0A2540, textColor white)"

key-files:
  created:
    - lib/branding/contrast.ts
    - lib/branding/types.ts
    - lib/branding/read-branding.ts
    - tests/branding-contrast.test.ts
  modified:
    - app/[account]/[event-slug]/_lib/types.ts
    - app/[account]/[event-slug]/_lib/load-event-type.ts

key-decisions:
  - "DEFAULT_BRAND_PRIMARY = '#0A2540' (NSI navy, Phase 2 @theme lock)"
  - "0.04045 sRGB linearization threshold (IEC standard, not 0.03928)"
  - "brandingFromRow() for callers with accounts row; getBrandingForAccount() for ID-only callers"
  - "RESERVED_SLUGS adds 'embed' — belt-and-suspenders for /embed/* top-level route"
  - "AccountSummary extension is additive only — existing Phase 5/6 callers unchanged"
  - "getBrandingForAccount fails open on DB error — caller never throws"

patterns-established:
  - "Pattern: lib/branding/ is the single source for all branding logic (§Pattern 6 from RESEARCH.md)"
  - "Pattern: import 'server-only' as line 1 for any module using createAdminClient()"

# Metrics
duration: 3min
completed: 2026-04-26
---

# Phase 7 Plan 01: Branding Lib and Read Helper Summary

**WCAG contrast helper + server-only branding read helper + AccountSummary extended with logo_url/brand_primary + "embed" added to RESERVED_SLUGS — shared foundation for all Phase 7 surfaces**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-26T13:51:44Z
- **Completed:** 2026-04-26T13:55:12Z
- **Tasks:** 3/3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Built WCAG-correct `pickTextColor(bgHex)` using the 0.04045 sRGB linearization threshold (not 0.03928); backed by 9 Vitest cases covering NSI navy, NSI orange, boundary gray, and malformed input
- Created server-only `getBrandingForAccount(accountId)` (async, ID-only callers) and `brandingFromRow(row)` (sync, for callers that already have the accounts row) — eliminates redundant DB round-trips on the booking page and embed route
- Extended `AccountSummary` with `logo_url` and `brand_primary` fields additively; updated `loadEventTypeForBookingPage` SELECT and return object; all 75 tests pass (66 prior + 9 new)
- Added `"embed"` to `RESERVED_SLUGS` — prevents future `/[account]=embed` slug collision with the Phase 7 `/embed/*` top-level route

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/branding/contrast.ts + types.ts + Vitest unit tests** - `7c67fbc` (feat)
2. **Task 2: Create lib/branding/read-branding.ts (server-only helper)** - `45c629b` (feat)
3. **Task 3: Extend AccountSummary + load-event-type SELECT + RESERVED_SLUGS adds "embed"** - `461c81d` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `lib/branding/contrast.ts` — `relativeLuminance(hex)` + `pickTextColor(bgHex)` per W3C spec; defensive guard for malformed input
- `lib/branding/types.ts` — `Branding` interface: `{ logoUrl, primaryColor, textColor }`
- `lib/branding/read-branding.ts` — server-only; `DEFAULT_BRAND_PRIMARY`, `getBrandingForAccount(accountId)`, `brandingFromRow(row)`
- `tests/branding-contrast.test.ts` — 9 Vitest cases for contrast helper
- `app/[account]/[event-slug]/_lib/types.ts` — `AccountSummary` extended with `logo_url` + `brand_primary` (additive)
- `app/[account]/[event-slug]/_lib/load-event-type.ts` — SELECT updated; return object passes new fields through; RESERVED_SLUGS includes "embed"

## Decisions Made

- **DEFAULT_BRAND_PRIMARY = "#0A2540"** — NSI navy from Phase 2 Tailwind `@theme` `--color-primary` lock. All default Branding objects use this when the DB column is null.
- **0.04045 threshold** — IEC standard is more precise than the W3C wiki's 0.03928. Difference is negligible for 8-bit values; use the correct one.
- **Two-function split: brandingFromRow vs getBrandingForAccount** — booking page and embed page already load the full accounts row; passing through `brandingFromRow()` is zero extra cost. Email senders and embed page receive only `accountId`; they use `getBrandingForAccount()` which does a targeted DB read.
- **Fail-open on DB error** — `getBrandingForAccount` catches all errors and returns all-defaults Branding. The booking experience must not break because of a branding query failure.
- **AccountSummary extension is additive** — `logo_url` and `brand_primary` added at the END of the interface. Existing Phase 5/6 callers (`BookingShell`, `page.tsx`, `confirmed/page.tsx`) do not pass or read these fields — TypeScript structural typing means they compile correctly without touching them.

## Public API Surface (for downstream plans)

```typescript
// lib/branding/contrast.ts
export function relativeLuminance(hex: string): number;
export function pickTextColor(bgHex: string): "#ffffff" | "#000000";

// lib/branding/types.ts
export interface Branding {
  logoUrl: string | null;
  primaryColor: string;           // always valid #RRGGBB, defaults to #0A2540
  textColor: "#ffffff" | "#000000";
}

// lib/branding/read-branding.ts  (server-only)
export const DEFAULT_BRAND_PRIMARY = "#0A2540";
export function brandingFromRow(row: { logo_url: string | null; brand_primary: string | null }): Branding;
export async function getBrandingForAccount(accountId: string): Promise<Branding>;

// app/[account]/[event-slug]/_lib/types.ts
export interface AccountSummary {
  // ... existing fields ...
  logo_url: string | null;     // Phase 7 addition
  brand_primary: string | null; // Phase 7 addition
}
```

**Consumer guidance:**
- **07-03 embed route, 07-06 booking surfaces:** `brandingFromRow(account)` — account row already in hand from loader
- **07-07 emails:** `getBrandingForAccount(account.id)` — email senders may only have accountId
- **07-08 /[account] index:** use same `brandingFromRow()` pattern; add "embed" to its own reserved slug guard
- **07-04 branding editor:** reads/writes `accounts.logo_url` + `accounts.brand_primary` directly via admin client

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in test files (`tests/bookings-api.test.ts`, `tests/cancel-reschedule-api.test.ts`) are from Phase 5/6 mock aliases and are unrelated to this plan. They existed before execution and the Vitest suite still runs all 75 tests successfully.

## User Setup Required

None — no external service configuration required. The `accounts` table already has `logo_url` and `brand_primary` columns from the Phase 1 schema (no migration needed).

## Next Phase Readiness

- `lib/branding/` foundation is fully built and tested — all Phase 7 plans may import from it
- `AccountSummary` carries branding fields — booking page and embed page can read them without any additional DB queries
- RESERVED_SLUGS protects against `/[account]=embed` collision before the `/embed/*` route is introduced in Plan 07-03
- Ready for Plan 07-02 (proxy CSP headers) — that plan is already partially committed based on git log; no blockers from 07-01

---
*Phase: 07-widget-and-branding*
*Completed: 2026-04-26*
