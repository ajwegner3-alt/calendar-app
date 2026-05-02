# Phase 24: Owner UI Polish - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Two surgical owner-side dashboard fixes:
1. **OWNER-12** — Strip the orange (`#F97316`) accent from the `/app/home` monthly calendar day-grid across every state (default / hover / today / selected / has-bookings). Replace with a neutral, brand-compliant treatment.
2. **OWNER-13** — Add a copyable booking-link field at the top of `/app/event-types/[id]/edit` showing the real per-event public URL (`https://<host>/<account-slug>/<event-slug>`) with a copy button and visual confirmation.

Out of scope: any other owner-side polish, new dashboard tabs, additional copy/share affordances, schema changes, or shared `components/ui/calendar.tsx` edits.

</domain>

<decisions>
## Implementation Decisions

### OWNER-12 — Calendar color treatment

- **All grey, no brand color in the calendar.** Today / selected / has-bookings indicators all use shades of grey (no NSI navy fill, no NSI blue accent). Calendar should fade into the dashboard chrome rather than draw attention.
- **Has-bookings indicator: small dot under the day number.** The day-button cell stays neutral; a small grey dot appears below the date number to indicate bookings exist on that day. Subtle, doesn't compete with today/selected states.
- **Today indicator: Claude's discretion.** Keep some minimal affordance so the owner can still locate the current date at a glance (e.g., bold weight, subtle ring, or muted background) — pick whichever reads cleanest in the existing owner shell.

### OWNER-12 — Scope of CSS / component edits

- **Do NOT edit shared `components/ui/calendar.tsx`.** Mirrors the Phase 23 invariant: shared shadcn calendar stays untouched so the public booker calendar (Phase 23) and any future calendar surfaces are not affected.
- Make changes via:
  - Per-instance className overrides on the home-tab `<Calendar>` usage and/or its day-button modifiers, AND/OR
  - Targeted `globals.css` edits to the `--color-accent` token (or the home-calendar-specific selectors) — but only after a quick grep confirms the blast radius is acceptable.
- The orange `--color-accent: #F97316` line in `globals.css` is the prime suspect; verify whether other owner surfaces depend on it before swapping it project-wide vs scoping to the home calendar only.

### OWNER-13 — Booking-link field placement

- **Replace the existing `UrlPreview` component, don't duplicate it.** The current placeholder card under the slug field (`yoursite.com/nsi/[slug]`) is removed; a single real, copyable booking-link field lives at the top of the edit form. One source of truth, no stale "yoursite.com" placeholder lingering on the page.
- Field renders **above** the existing `<header>` (or as the first form section) so the owner sees it immediately on landing.

### OWNER-13 — Booking-link field style

- **Code-block style + copy button** (visual continuity with the current `UrlPreview` look — monospace text in a muted/dashed card with the copy button right-aligned).
- Live-updates as the owner edits the slug field below — the URL reflects current form state in real time, matching the existing `UrlPreview` behavior. (Implication: the field reads the slug input value, not the saved DB value.)

### OWNER-13 — Host & account-slug sources

- **Host:** Claude's discretion. Pick whichever is simplest and produces the URL Andrew would actually send to bookers (likely `window.location.origin` for client-rendered live-update with no env-var dependency, OR `NEXT_PUBLIC_APP_URL` if simpler given form structure — researcher/planner choose).
- **Account slug:** Claude's discretion. Likely fetched server-side in `edit/page.tsx` alongside the existing `event_types` query and passed into `EventTypeForm` as a prop. Researcher should confirm the cleanest threading path given how the form is currently composed.

### OWNER-13 — Copy confirmation

- **Icon flip (copy → check) for ~1.5s.** Inline morph — copy icon becomes a checkmark for ~1.5 seconds, then reverts. No toast pollution. Modern pattern (GitHub, Vercel).
- **Clipboard-failure handling: Claude's discretion.** Modern Chrome/Safari over HTTPS rarely fails. Pick the simplest fallback (e.g., select the URL text so manual `Ctrl+C` works, with or without a brief error message).

### Claude's Discretion (locked items)

- Today-indicator visual treatment (so long as no orange and no NSI brand fill).
- Exact grey shade(s) used for has-bookings dot, today, selected — pick from existing Tailwind/CSS-token grey scale.
- Host source for the URL (`window.location.origin` vs `NEXT_PUBLIC_APP_URL`).
- Account-slug threading mechanism into the form.
- Clipboard-failure fallback pattern.
- Whether the existing `UrlPreview` file is deleted outright or repurposed as the new top-of-form component.

</decisions>

<specifics>
## Specific Ideas

- "All grey, no brand color in the calendar" — the calendar should visually recede into the dashboard chrome rather than compete with brand-colored elements elsewhere on the surface.
- "Replace UrlPreview, don't duplicate" — the placeholder under the slug field has been a v1.0-era stub showing fake values (`yoursite.com/nsi/...`); OWNER-13 is the real version.
- "Live-update as the owner types" — matches the existing UrlPreview UX so this isn't a behavior regression for owners who've trained on the placeholder.
- Visual continuity with the existing UrlPreview card style means owners migrating from the old placeholder to the new field don't feel a UI jolt — same dashed muted card, same monospace, just real values + copy.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Andrew did not raise any new owner-side capabilities during this discussion.)

</deferred>

---

*Phase: 24-owner-ui-polish*
*Context gathered: 2026-05-02*
