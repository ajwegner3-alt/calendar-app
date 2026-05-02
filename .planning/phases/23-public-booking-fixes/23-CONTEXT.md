# Phase 23: Public Booking Fixes - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The public-facing booker experience renders correctly across viewports (mobile calendar centered, desktop slot-picker layout uncluttered) AND a discoverable account-root landing page at `/[account]` lists every public event type for that account as selectable cards. Scope is limited to existing surfaces `/[account]/[event-slug]` (PUB-13 + PUB-14 fixes) and one new surface `/[account]` (PUB-15). No schema changes. No new packages. No changes to the booking flow itself once the booker clicks through to a slot picker.

</domain>

<decisions>
## Implementation Decisions

### Card content & layout (PUB-15)
- **Whole card is clickable** — the entire card acts as a `<Link>` to `/[account]/[event-slug]`. No separate "Book" button required; the card itself is the affordance. Card should have a clear hover state (subtle lift / background shift) to signal interactivity.
- **Card chrome matches existing PublicShell card style** — re-use whatever rounded/shadow/border pattern v1.2 PublicShell already established. Don't invent a new card aesthetic for this page.
- **Card content (Claude's discretion):** pick a clean minimal set — at minimum event-type name + duration; add description only if `event_types.description` exists and is populated. Use account `brand_primary` only if it's already part of the existing card pattern.
- **Layout shape (Claude's discretion):** pick whatever matches the PublicShell aesthetic — most likely a responsive grid (2-3 columns at desktop, 1 column on mobile) or auto-fill `minmax` grid. Avoid single-column stacked list unless the existing PublicShell pattern dictates it.

### Account-index header (PUB-15)
- **Header content:** centered account logo + account name above the cards. No tagline, no welcome line.
- **Wrapper:** re-use the existing **PublicShell** (same one wrapping `/[account]/[event-slug]`) so the index page is visually identical in glow / header pill / footer chrome. Per v1.2 architectural pattern, pass `variant="public"` to the multi-variant `Header` component (STATE.md, Phase 22 carryover note).
- **Browser title:** `Book with [Account Name]` — action-oriented, tells the booker what the page is for.
- **No additional account meta in header** — no timezone line, no contact link. Keep it lean. Timezone is shown per-event-type on the slot-picker page already.

### Filtering & ordering (PUB-15)
- **Sort order:** oldest first by `created_at ASC`. Stable, predictable for repeat bookers.
- **Empty state (account exists but has zero matching event types):** render PublicShell + account header as normal, then a centered "No bookings available right now — check back soon" message in place of cards. Do NOT 404 a real account just because it has no bookable event types.
- **Visibility filter (Claude's discretion):** read the schema and apply the most sensible filter — almost certainly active + not-hidden / not-archived event types. If a `public` flag exists on `event_types`, respect it; otherwise treat all active event types as bookable.
- **Bad slug handling (Claude's discretion):** for `/[account]` where the account slug doesn't exist, default to standard Next.js `notFound()` (Next default 404 page) unless there's a strong reason to brand a custom 404. Keep it simple.

### Slot-picker layout fix (PUB-14)
All tactical CSS/layout calls delegated to Claude:
- **Timezone hint placement (Claude's discretion):** likely "above the calendar, full-width" but pick whatever reads cleanest once the DOM is inspected. Could also be a left/right sidebar treatment if that matches the existing slot-picker columns.
- **"Pick a date to see available times:" copy (Claude's discretion):** keep, tighten, or remove based on what reads cleanest in the new layout. No emotional attachment to the current copy.
- **Mobile parity (Claude's discretion):** verify on both viewports during implementation and apply the layout fix to whichever scope is needed. PUB-14 is reported as a desktop bug; if mobile is already clean, leave it.

### Mobile calendar centering (PUB-13)
- **Approach (Claude's discretion):** inspect the DOM and pick the least invasive fix — either center within existing card padding OR tighten card padding so the calendar fills available width. No preference on which.

### Claude's Discretion
- All visibility/filter logic for which event types appear (tied to schema reading)
- Bad-slug 404 styling
- Slot-picker layout reorganization specifics (timezone hint placement, instruction copy, mobile parity)
- Mobile calendar centering technique
- Card content beyond name+duration (description only if schema supports it)
- Card grid breakpoints / minmax sizing
- Hover state styling on clickable cards
- Empty-state copy exact wording (gist locked: "no bookings available, check back")

</decisions>

<specifics>
## Specific Ideas

- The `/[account]` page should feel like the same product as the slot-picker page — consistent glow, header, card aesthetic. PublicShell carries the brand identity; the index page just plugs into it.
- This is a v1.3 polish milestone, not a redesign — match what already exists, don't reinvent.

</specifics>

<deferred>
## Deferred Ideas

- Manual sort field for event-type cards (drag-to-reorder via a `sort_order` column on `event_types`) — would require schema work; v1.3 has no schema changes by design. Add to v1.4 backlog if Andrew wants it.
- Search / filter on `/[account]` (e.g., for accounts with 20+ event types) — new capability, not in scope.
- Per-event description editing UI (so cards can show a tagline) — separate from this phase. If `event_types.description` already exists, PUB-15 can surface it; if not, no new field is added here.
- Custom branded 404 for unknown account slugs — deferred unless Claude finds an existing pattern to reuse.

</deferred>

---

*Phase: 23-public-booking-fixes*
*Context gathered: 2026-05-02*
