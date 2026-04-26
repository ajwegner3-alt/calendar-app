---
phase: 07-widget-and-branding
plan: 06
subsystem: ui
tags: [branding, css-vars, next-js, supabase, react, tailwind]

# Dependency graph
requires:
  - phase: 07-01
    provides: "lib/branding/contrast.ts (pickTextColor, DEFAULT_BRAND_PRIMARY); AccountSummary type with logo_url + brand_primary; loadEventTypeForBookingPage SELECT extended"
  - phase: 06
    provides: "cancel/reschedule token resolvers (resolve-cancel-token.ts, resolve-reschedule-token.ts); confirmation loader (load-confirmed-booking.ts)"
provides:
  - "app/_components/branded-page.tsx — shared server component wrapper: injects --brand-primary + --brand-text CSS vars, renders optional logo header"
  - "Four public surfaces fully branded: booking page, confirmation page, cancel page, reschedule page"
  - "CSS-var consumption pattern locked (--brand-primary + --brand-text) consistent across embed (07-03) and hosted surfaces"
  - "Inline-style fallback pattern: var(--brand-primary, #0A2540) makes child components safe outside BrandedPage"
  - "All three Phase 6 loaders additively extended: logo_url + brand_primary in returned account shape"
affects:
  - "07-07 (email branding): same logo_url + brand_primary already in account row; email senders read directly"
  - "Phase 9 (manual QA): all four surfaces available for visual smoke on live Vercel"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BrandedPage server wrapper: CSS var injection via inline style on root div; cascades to all child components"
    - "Inline-style fallback: var(--brand-primary, #0A2540) in child button inline styles for out-of-context safety"
    - "Additive loader widening: only SELECT fields added; no existing fields removed or renamed"
    - "Standard <img> (not next/image) for Supabase Storage logos to avoid remotePatterns configuration"

key-files:
  created:
    - app/_components/branded-page.tsx
  modified:
    - app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts
    - app/cancel/[token]/_lib/resolve-cancel-token.ts
    - app/reschedule/[token]/_lib/resolve-reschedule-token.ts
    - app/[account]/[event-slug]/page.tsx
    - app/[account]/[event-slug]/_components/booking-shell.tsx
    - app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx
    - app/cancel/[token]/page.tsx
    - app/reschedule/[token]/page.tsx

key-decisions:
  - "CSS var names --brand-primary + --brand-text match Plan 07-03 EmbedShell exactly — single naming convention across embed and hosted surfaces"
  - "Standard <img> over next/image for logos (Supabase Storage is cross-domain; remotePatterns overhead not justified)"
  - "Inline fallback colors (var(--brand-primary, #0A2540)) in child button styles so components work safely outside BrandedPage"
  - "Only PRIMARY CTAs recolored per surface; secondary buttons (Cancel, Back) retain neutral shadcn styling"
  - "Loader extensions are additive only — no removed fields, no shape renames; Phase 5/6 callers unaffected"

patterns-established:
  - "BrandedPage wrap pattern: import + wrap outer JSX, pass logoUrl/primaryColor/accountName from loader data"
  - "CTA brand-color inline style: { background: 'var(--brand-primary, #0A2540)', color: 'var(--brand-text, #ffffff)' }"
  - "Loader widening: add logo_url, brand_primary to accounts SELECT join; update return type; no other changes"

# Metrics
duration: continuation (Tasks 1-3 committed prior session; Task 4 human-verify approved 2026-04-26)
completed: 2026-04-26
---

# Phase 7 Plan 06: Apply Branding to Page Surfaces Summary

**BrandedPage wrapper + four public surfaces branded via --brand-primary/--brand-text CSS vars; logo_url and brand_primary additively added to three Phase 6 loaders; live-verified on Vercel 2026-04-26**

## Performance

- **Duration:** Multi-session (Tasks 1-3 committed; Task 4 checkpoint resolved 2026-04-26)
- **Started:** 2026-04-26
- **Completed:** 2026-04-26
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint)
- **Files modified:** 9

## Accomplishments

- Created `app/_components/branded-page.tsx` — reusable server component that injects CSS vars and renders an optional top-centered logo header; consumed by all four public surfaces
- Extended three Phase 6 loaders additively (load-confirmed-booking, resolve-cancel-token, resolve-reschedule-token) to return `logo_url` and `brand_primary`; no Phase 5/6 callers broken (80/80 tests green)
- Wrapped all four public pages with BrandedPage and applied brand-color inline styles to primary CTAs; live-verified on Vercel with `nsi.brand_primary = #FF6B6B` + actual uploaded logo

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BrandedPage shared wrapper** - `5067416` (feat)
2. **Task 2: Extend loaders for confirmed/cancel/reschedule** - `2d394d7` (feat)
3. **Task 3: Wrap four pages with BrandedPage + recolor CTAs** - `edec5c5` (feat)
4. **Task 4: Human-verify checkpoint** - Approved 2026-04-26 (no commit — checkpoint resolved by Andrew)

**Plan metadata:** (committed as part of this continuation)

## Files Created/Modified

- `app/_components/branded-page.tsx` — Shared server wrapper: injects `--brand-primary` + `--brand-text` CSS vars via inline style on root div; renders optional `<img>` logo header when `logoUrl` is non-null; `pickTextColor()` auto-picks readable text color
- `app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts` — Added `logo_url, brand_primary` to accounts join SELECT; updated return type
- `app/cancel/[token]/_lib/resolve-cancel-token.ts` — Added `logo_url, brand_primary` to accounts SELECT; updated return shape
- `app/reschedule/[token]/_lib/resolve-reschedule-token.ts` — Added `logo_url, brand_primary` to accounts SELECT; updated return shape
- `app/[account]/[event-slug]/page.tsx` — Wrapped with BrandedPage; passes `data.account.logo_url` + `data.account.brand_primary`
- `app/[account]/[event-slug]/_components/booking-shell.tsx` — Primary "Book this slot" CTA recolored with brand-color inline style
- `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` — Wrapped with BrandedPage; success circle recolored via `color-mix(in srgb, var(--brand-primary) 15%, transparent)`
- `app/cancel/[token]/page.tsx` — Wrapped with BrandedPage; "Cancel booking" and "Book again" CTAs recolored
- `app/reschedule/[token]/page.tsx` — Wrapped with BrandedPage; "Confirm new time" CTA recolored

## BrandedPage Component Contract

```tsx
interface BrandedPageProps {
  logoUrl: string | null;       // null → no logo header rendered
  primaryColor: string | null;  // null → falls back to #0A2540 (NSI navy)
  accountName: string;          // Used in <img alt> text
  children: ReactNode;
  logoMaxWidth?: number;        // Default 120px
}
```

**CSS vars injected on root div:**
- `--brand-primary`: effective color (primaryColor ?? "#0A2540")
- `--brand-text`: WCAG-picked readable contrast color (white or black) via `pickTextColor()`

**Child component consumption pattern (LOCKED):**
```tsx
style={{
  background: "var(--brand-primary, #0A2540)",
  color: "var(--brand-text, #ffffff)",
}}
```
The fallback values (`, #0A2540` / `, #ffffff`) ensure components are safe when rendered outside a BrandedPage parent.

## CSS Var Convention (Cross-Surface Lock)

`--brand-primary` and `--brand-text` are the canonical CSS var names across ALL surfaces:

| Surface | Source |
|---------|--------|
| `/embed/[account]/[event-slug]` | Plan 07-03 EmbedShell |
| `/[account]/[event-slug]` (booking page) | Plan 07-06 BrandedPage |
| `/[account]/[event-slug]/confirmed/[id]` | Plan 07-06 BrandedPage |
| `/cancel/[token]` | Plan 07-06 BrandedPage |
| `/reschedule/[token]` | Plan 07-06 BrandedPage |

Any future public surface adding per-account branding MUST use `--brand-primary` + `--brand-text` via BrandedPage (or EmbedShell for embed context) — no new var names.

## Loader Extensions (Additive)

All three loaders were extended by adding `logo_url` and `brand_primary` to the accounts SELECT join. No existing fields were removed or renamed. Phase 5 and Phase 6 callers are unaffected (backward-compatible shape widening).

| Loader | Fields Added |
|--------|-------------|
| `load-confirmed-booking.ts` | `logo_url`, `brand_primary` |
| `resolve-cancel-token.ts` | `logo_url`, `brand_primary` |
| `resolve-reschedule-token.ts` | `logo_url`, `brand_primary` |

Note: `/[account]/[event-slug]` booking page loader (`load-event-type.ts`) was already extended in Plan 07-01 — no change needed here.

## Specific CTAs Recolored Per Surface

| Surface | Button Recolored |
|---------|-----------------|
| Booking page | "Book this slot" submit button in BookingShell |
| Confirmation page | Success ✓ circle (bg + text color via color-mix) |
| Cancel page | "Cancel booking" button; "Book again" link |
| Reschedule page | "Confirm new time" button in RescheduleShell |

Secondary buttons (Back, secondary Cancel links) intentionally left with neutral shadcn styling.

## Forward Contract for Plan 07-07 (Emails)

Plan 07-07 (email branding) reads `accounts.logo_url` and `accounts.brand_primary` directly from the account row — the same fields extended in this plan. No additional loader changes needed for emails. The `?v=` cache-bust in `logo_url` (added by Plan 07-04 upload action) is preserved as-is in all email `<img src>` attributes per the Plan 07-04 lock.

## Live Verification

**Date:** 2026-04-26
**Account:** `nsi` (brand_primary = `#FF6B6B`, logo uploaded via Plan 07-04 branding editor)
**Outcome:** Andrew confirmed "I see the branding elements now. It is working."
**Note:** Initial verification attempt showed no branding — root cause was 15 uncommitted commits not yet pushed to `origin/main`. After the manual push, Vercel redeployed and branding rendered correctly on the public booking page.

## Deviations from Plan

None — plan executed exactly as written. All four surfaces wrapped; loaders extended; CTAs recolored; fallback verified.

## Issues Encountered

**Push-before-verify gap (process issue, not code issue):** Wave 3 parallel executors committed Tasks 1-3 but did not auto-push to `origin/main`. When Andrew visited the live Vercel URL for the human-verify checkpoint, 15 commits (across multiple plans) had accumulated locally but not deployed. The orchestrator manually pushed all 15 commits; Vercel redeployed, and branding rendered correctly.

**Process lock added to STATE.md:** Push commits to `origin/main` IMMEDIATELY when a checkpoint involves live Vercel verification.

## Next Phase Readiness

- Plan 07-07 (apply branding to emails): `logo_url` + `brand_primary` already in all account rows and all relevant loaders; `lib/email/branding-blocks.ts` already complete; ready
- Plan 07-09 (embed snippet dialog): BrandedPage and EmbedShell both complete; CSS var convention locked; ready
- Phase 9 (manual QA): all four public surfaces branded; BRAND-03 requirement satisfied

---
*Phase: 07-widget-and-branding*
*Completed: 2026-04-26*
