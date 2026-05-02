# Phase 23: Public Booking Fixes - Research

**Researched:** 2026-05-02
**Domain:** Next.js App Router public surfaces, React Day Picker, Tailwind CSS layout
**Confidence:** HIGH

## Summary

Phase 23 touches three specific bugs on two existing public-surface routes. Research involved direct codebase inspection of every component, data-loading function, and layout structure involved.

The critical finding: **PUB-15 (`/[account]` index) is substantially already built.** `app/[account]/page.tsx` exists with `PublicShell`, `ListingHero`, `EventTypeCard`, and `AccountEmptyState` components — all wired correctly. The data loader (`loadAccountListing`) is complete and applies the correct visibility filter (`is_active = true`, `deleted_at IS NULL`, `created_at ASC`). The title currently reads `"[Account Name] — Book a time"` instead of the locked `"Book with [Account Name]"` — that is the only PUB-15 gap to close.

For PUB-13 (mobile calendar centering): The `Calendar` shadcn/ui component applies `w-fit` to its root via `classNames.root`. In `SlotPicker`, the `<Calendar>` renders inside a `grid gap-6 lg:grid-cols-2` container. On mobile (single column), the `w-fit` calendar shrinks to its content width and left-aligns within the grid cell — producing the observed off-center appearance. Fix: add `mx-auto` to the `<Calendar className>` prop in `slot-picker.tsx`.

For PUB-14 (desktop layout overlap): `BookingShell` wraps the slot-picker inside `lg:grid-cols-[1fr_320px]` (left=slot-picker, right=booking form). Inside `SlotPicker`, the timezone hint `<p>` and "Pick a date" copy `<p>` are both inside the right `<div>` (the slot-list column). On desktop the calendar occupies the left column and the slot-list occupies the right — these elements are NOT overlapping the calendar in the current DOM structure. The actual visual problem is the timezone hint appearing inline above slot buttons inside the right panel (tight, cramped) rather than spanning both columns as a clear header. Fix: move the timezone hint `<p>` above the `grid` wrapper in `SlotPicker`, spanning full width at the top of the slot-picker section.

**Primary recommendation:** PUB-15 needs only a metadata title fix. PUB-13 needs one `mx-auto` class addition. PUB-14 needs the timezone hint hoisted above the grid and the instruction text (`"Pick a date to see available times."`) left in the right column or removed — confirm visually after the hoist.

## Standard Stack

No new packages. Phase uses only the existing stack.

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Next.js (App Router) | Current | RSC page routing, `generateMetadata`, `notFound()` | All pages are RSC + `"use client"` islands |
| react-day-picker | v9 (DayPicker) | Calendar widget inside `SlotPicker` | Wrapped by `components/ui/calendar.tsx` |
| Tailwind CSS | Current | All layout classes | JIT pitfall lock MP-04: runtime hex via inline style only |
| Supabase (admin client) | Current | Server-side data fetch in `loadAccountListing` | Service-role bypasses RLS |

### Relevant Internal Modules
| Module | Path | Purpose |
|--------|------|---------|
| `PublicShell` | `app/_components/public-shell.tsx` | Page shell: glow + header pill + footer. Wraps all public pages. |
| `Header` | `app/_components/header.tsx` | Multi-variant glass pill. `variant="public"` renders logo+name. |
| `loadAccountListing` | `app/[account]/_lib/load-account-listing.ts` | RSC data loader for `/[account]` |
| `EventTypeCard` | `app/[account]/_components/event-type-card.tsx` | Whole-card `<Link>` to `/[account]/[event-slug]` |
| `ListingHero` | `app/[account]/_components/listing-hero.tsx` | Account logo + name hero section |
| `AccountEmptyState` | `app/[account]/_components/empty-state.tsx` | Empty-state card when no event types |
| `SlotPicker` | `app/[account]/[event-slug]/_components/slot-picker.tsx` | Calendar + slot list (PUB-13/PUB-14 live here) |
| `BookingShell` | `app/[account]/[event-slug]/_components/booking-shell.tsx` | Client container wrapping SlotPicker + BookingForm |

**Installation:** None required.

## Architecture Patterns

### App Router RSC + Client Islands
- Public pages (`app/[account]/page.tsx`, `app/[account]/[event-slug]/page.tsx`) are RSC
- Data fetching happens in `_lib/` files with `import "server-only"` guard
- Client components (`BookingShell`, `SlotPicker`, `BookingForm`) are marked `"use client"`
- `generateMetadata` is an async function at the page level, co-located with the page component

### PublicShell Composition
```tsx
// Pattern for ALL public pages — already in use on both /[account] and /[account]/[event-slug]
<PublicShell branding={branding} accountName={data.account.name}>
  {/* page content */}
</PublicShell>
```
`PublicShell` handles: `bg-gray-50` base, `<BackgroundGlow>`, `Header variant="public"`, CSS vars (`--brand-primary`, `--primary`, `--brand-text`, `--primary-foreground`), `<PoweredByNsi>` footer.

### Data Loading Pattern
```ts
// Source: app/[account]/_lib/load-account-listing.ts (verified)
// Service-role admin client bypasses RLS on unauthenticated routes
const supabase = createAdminClient();
// Visibility filter: is_active=true, deleted_at IS NULL, order by created_at ASC
const { data: events } = await supabase
  .from("event_types")
  .select("id, slug, name, description, duration_minutes")
  .eq("account_id", account.id)
  .eq("is_active", true)
  .is("deleted_at", null)
  .order("created_at", { ascending: true });
```

### notFound() Usage
```ts
// Source: app/[account]/page.tsx (verified)
import { notFound } from "next/navigation";
const data = await loadAccountListing(account);
if (!data) notFound(); // triggers Next.js default 404
```

### generateMetadata Pattern
```ts
// Source: app/[account]/page.tsx (verified)
export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { account } = await params;
  const data = await loadAccountListing(account);
  if (!data) return { title: "Page not found" };
  return {
    title: `Book with ${data.account.name}`, // ← PUB-15 fix: change from "[Name] — Book a time"
  };
}
```

### Card Pattern (from `EventTypeCard`)
```tsx
// Source: app/[account]/_components/event-type-card.tsx (verified)
// Whole card is a Link — CONTEXT lock
<Link
  href={`/${accountSlug}/${event.slug}`}
  className="block rounded-lg border bg-card p-6 hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-2"
>
```
Card chrome: `rounded-lg border bg-card p-6 hover:shadow-md transition-shadow`. Duration badge uses `brand_primary` via inline `style` (MP-04 compliant). CTA button uses `brand_primary` via inline `style`.

### Grid Layout for Event Cards
```tsx
// Source: app/[account]/page.tsx (verified)
<div className="grid gap-4 md:grid-cols-2">
  {data.eventTypes.map((event) => (
    <EventTypeCard key={event.id} ... />
  ))}
</div>
```
2-column at `md:` breakpoint, 1-column mobile. Max width `max-w-5xl` on the page wrapper.

### Anti-Patterns to Avoid
- **Dynamic Tailwind JIT classes with runtime hex:** `bg-[${color}]` is forbidden (MP-04 lock). Use inline `style={{ background: color }}`.
- **Fetching with RLS on public routes:** Public routes use `createAdminClient()` (service-role), not the cookie-based client. RLS would silently return 0 rows for unauthenticated access.
- **404 on real accounts with zero event types:** `loadAccountListing` returns `{ account, eventTypes: [] }`, not `null`, when events array is empty. Caller renders `<AccountEmptyState>`, not `notFound()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Account data loading | Custom Supabase query in page | `loadAccountListing()` already exists | Already filters, maps, handles errors |
| Event type visibility filtering | Custom filter logic | Already in `loadAccountListing` (`is_active=true`, `deleted_at IS NULL`) | Correct filter is already live |
| Empty state | Inline JSX | `<AccountEmptyState>` already exists | Correct copy, correct email-link pattern |
| Hero header | New component | `<ListingHero>` already exists | Logo/initial fallback, brand_primary tint |
| Calendar widget | Custom date picker | `components/ui/calendar.tsx` (react-day-picker DayPicker wrapper) | Already styled, already used in SlotPicker |
| Card chrome | New CSS patterns | Re-use `rounded-lg border bg-card p-6 hover:shadow-md transition-shadow` from EventTypeCard | Matches existing aesthetic |

**Key insight:** The main PUB-15 work is already done. The phase involves inspection and small corrections, not construction.

## Common Pitfalls

### Pitfall 1: PUB-15 title format mismatch
**What goes wrong:** Current `generateMetadata` returns `"${data.account.name} — Book a time"`. The CONTEXT lock specifies `"Book with [Account Name]"`.
**How to fix:** Change one string in `app/[account]/page.tsx` `generateMetadata`.
**Warning signs:** Browser tab shows old format after deploy.

### Pitfall 2: PUB-13 — Calendar `w-fit` and mobile alignment
**What goes wrong:** `components/ui/calendar.tsx` applies `classNames.root = "w-fit ..."`. On mobile (single-column grid), the calendar collapses to content width and left-aligns, creating visible right-side whitespace.
**Root cause:** `w-fit` in the shadcn calendar root. This is intentional for desktop but breaks centering on mobile.
**How to fix:** Pass `className="mx-auto rounded-md border"` to `<Calendar>` in `slot-picker.tsx` (line 139). The `mx-auto` centers the `w-fit` element within its grid cell.
**Warning signs:** On Chrome DevTools mobile viewport, calendar visually hugs the left edge.

### Pitfall 3: PUB-14 — Timezone hint placement
**What goes wrong:** In `SlotPicker`, the timezone hint `<p className="text-xs text-muted-foreground mb-3">Times shown in {bookerTimezone}</p>` is inside the right-side `<div>` (slot list column), rendered above the loading/slot buttons. On desktop the two-column grid (`lg:grid-cols-2`) positions the calendar left and the slot-list right — so the hint appears in the right column only. On narrower desktop widths or when both columns are visible side-by-side, this looks misplaced relative to the full-width calendar row above.
**How to fix:** Hoist the timezone hint `<p>` to appear ABOVE the `<div className="grid gap-6 lg:grid-cols-2">` wrapper. It then spans full width and reads as a page-level label rather than a slot-column label.
**Warning signs:** After moving, verify on both mobile (hint should appear between calendar and slot list) and desktop (hint should appear above the two-column grid).

### Pitfall 4: Editing shadcn `calendar.tsx` for centering
**What goes wrong:** Directly modifying `classNames.root` in `components/ui/calendar.tsx` would affect ALL calendar usages across the app.
**How to fix:** Pass `className` prop to the `<Calendar>` instance in `slot-picker.tsx` — this merges with the component default via `cn()`. Only that instance is affected.

### Pitfall 5: Re-running `loadAccountListing` twice (metadata + page)
**What goes wrong:** Next.js calls `generateMetadata` and the page component independently. `loadAccountListing` is called twice per request.
**Status:** This is already the existing pattern in both pages. Next.js deduplicates fetches within a render cycle via React's cache. No action needed — document for awareness.

## Code Examples

### PUB-15: Title fix (only change needed)
```ts
// File: app/[account]/page.tsx
// Source: verified current code (line 25)
// Change from:
title: `${data.account.name} — Book a time`,
// Change to:
title: `Book with ${data.account.name}`,
```

### PUB-13: Calendar centering fix
```tsx
// File: app/[account]/[event-slug]/_components/slot-picker.tsx
// Source: verified current code (line 139)
// Change from:
<Calendar
  mode="single"
  ...
  className="rounded-md border"
/>
// Change to:
<Calendar
  mode="single"
  ...
  className="mx-auto rounded-md border"
/>
```

### PUB-14: Timezone hint hoist
```tsx
// File: app/[account]/[event-slug]/_components/slot-picker.tsx
// Source: verified current structure

// BEFORE (inside the right <div>):
return (
  <div className="grid gap-6 lg:grid-cols-2">
    <Calendar ... />
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Times shown in {props.bookerTimezone}
      </p>
      {/* slot list ... */}
    </div>
  </div>
);

// AFTER (hint above the grid, spanning full width):
return (
  <>
    <p className="text-xs text-muted-foreground mb-3">
      Times shown in {props.bookerTimezone}
    </p>
    <div className="grid gap-6 lg:grid-cols-2">
      <Calendar ... />
      <div>
        {/* slot list only — no timezone hint here */}
      </div>
    </div>
  </>
);
```

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `/[account]` returned bare landing state | `/[account]/page.tsx` fully implemented with PublicShell, cards, hero, empty state | Already built as of this research |
| `brand_primary` in Tailwind JIT | Runtime hex via inline `style={}` only (MP-04 lock) | Locked — never regress |

**Deprecated/outdated:**
- `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` columns: permanently dropped (Phase 21 migration). Do not reference.
- `Branding` interface has exactly 3 fields: `{ logoUrl, primaryColor, textColor }`. No additional fields.

## Open Questions

1. **"Pick a date to see available times." copy (PUB-14)**
   - What we know: It appears in the right column slot-list area. After moving timezone hint above the grid, this copy will be the first thing in the right column on desktop, which may read cleanly.
   - What's unclear: Whether to keep, tighten ("Pick a date"), or remove it entirely. The CONTEXT delegates this to Claude's discretion.
   - Recommendation: Keep "Pick a date to see available times." as-is; it provides guidance when no date is selected. Verify visually at both viewports.

2. **`focus:ring-2 focus:ring-offset-2` on EventTypeCard — focus color**
   - What we know: `EventTypeCard` has `focus:ring-2 focus:ring-offset-2` without a `focus:ring-[color]`. This will use the default Tailwind ring color (blue), which may clash with non-blue brand primaries.
   - What's unclear: Whether this is a pre-existing accepted tradeoff.
   - Recommendation: Do not change in this phase — out of scope per CONTEXT.md, no branding fix required.

## Sources

### Primary (HIGH confidence)
All findings below are from direct source file inspection of the live codebase.

- `app/[account]/page.tsx` — PUB-15 page implementation, generateMetadata, grid layout
- `app/[account]/_lib/load-account-listing.ts` — visibility filter, sort order, empty-state handling
- `app/[account]/_lib/types.ts` — `AccountListingData`, `EventTypeCardData` interfaces
- `app/[account]/_components/event-type-card.tsx` — card chrome, brand color usage
- `app/[account]/_components/listing-hero.tsx` — hero structure, logo/initial fallback
- `app/[account]/_components/empty-state.tsx` — empty state copy and email link
- `app/[account]/[event-slug]/page.tsx` — slot-picker page, PublicShell usage pattern
- `app/[account]/[event-slug]/_components/booking-shell.tsx` — outer grid (`lg:grid-cols-[1fr_320px]`), inner layout
- `app/[account]/[event-slug]/_components/slot-picker.tsx` — timezone hint placement, "Pick a date" copy, Calendar usage
- `app/_components/public-shell.tsx` — PublicShell composition, CSS vars, glow
- `app/_components/header.tsx` — `variant="public"` implementation
- `components/ui/calendar.tsx` — `classNames.root = "w-fit ..."` (source of PUB-13)

### Secondary (MEDIUM confidence)
- None needed — all research was direct codebase inspection.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- PUB-15 status (already built): HIGH — files read directly
- PUB-13 root cause (`w-fit`): HIGH — class visible in calendar.tsx line 47
- PUB-14 root cause (hint in wrong column): HIGH — DOM structure read directly from slot-picker.tsx
- `event_types` schema columns used: HIGH — verified via select() call in load-account-listing.ts
- Visibility filter logic: HIGH — `is_active=true`, `deleted_at IS NULL` confirmed in loader
- Test suite scope: HIGH — Vitest only, no Playwright, no snapshot tests for public booking surface

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (stable codebase, no external dependencies changed)
