# Phase 7: Widget + Branding - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-account branding (logo + primary color) flows into the public booking page, the embeddable widget, the confirmation/cancel/reschedule screens, and transactional emails. A chromeless `/embed/[account]/[event-slug]` route exists with `Content-Security-Policy: frame-ancestors *` (and no `X-Frame-Options`). A static `widget.js` injects an auto-resizing iframe via the `nsi-booking:height` postMessage protocol on third-party host pages. The dashboard surfaces copy-paste embed snippets per event type. `/[account]` lists active event types with links to their per-event booking pages.

Out of scope: live verification on a real Squarespace/WordPress site (`EMBED-07` deferred to Phase 9), reminders/cron, dashboard bookings list, RLS audit, rate limit on `/api/bookings`.

</domain>

<decisions>
## Implementation Decisions

### Branding controls
- **Logo:** PNG or SVG, max 2 MB, stored in Supabase Storage (private bucket, signed-URL or public-read for `/embed` + email rendering — research call).
- **Primary color:** free hex input (`#RRGGBB` validation) **plus** native `<input type="color">`. Owner has full flexibility; no curated palette.
- **Branding scope (where it applies):** all four surfaces — public booking page `/[account]/[event-slug]`, embed `/embed/[account]/[event-slug]`, confirmation + cancel + reschedule screens, and all transactional emails (confirmation/cancel/reschedule).
- **Save UX:** live mini-preview of the booking page side-by-side with the editor. Logo/color changes update the preview iframe immediately before the owner saves.

### Embed snippet UX
- **Location:** inline on each event-type row in `/app/event-types`. Kebab menu → "Get embed code" opens a dialog. (No separate sidebar Embed page; no combined branding+embed surface.)
- **Snippet display:** Tabs — default tab "Script (recommended)" shows the `<script src="…/widget.js">` + `<div data-nsi-calendar="…">` snippet; second tab "iframe fallback" shows the raw `<iframe src="/embed/…">` snippet.
- **Copy feedback:** belt-and-suspenders — button text swaps to "Copied!" for 2 seconds AND a Sonner toast fires. Matches Phase 3 toast convention.
- **Live preview:** small iframe of `/embed/[account]/[event-slug]` rendered alongside the snippets in the dialog so the owner sees exactly what visitors see.

### Widget runtime behavior
- **Loading state:** skeleton with placeholder shapes mirroring the calendar grid + form fields. No spinner-only state.
- **Error fallback:** if the iframe fails to load or the postMessage handshake times out, render an inline message in the host page: "Booking unavailable in embed — [open booking page]" with a link to the hosted `/[account]/[event-slug]` URL. Graceful, recoverable.
- **Multiple widgets per page:** each `<div data-nsi-calendar="…">` mounts independently. `widget.js` scans all matching elements; each gets its own iframe and its own postMessage channel keyed by element id (or generated id if missing).
- **Responsive:** iframe width = 100% of host container. Height is set dynamically from `nsi-booking:height` messages. No fixed minimum, no owner-configured min-height.

### /[account] index page
- **Layout:** card grid (2-column responsive) of active event types. Each card links to `/[account]/[event-slug]`.
- **Card metadata:** name, duration, description (truncated to ~120 chars), duration badge styled with the account's primary color, explicit "Book" CTA button. Whole card is clickable.
- **Empty state:** friendly message + owner contact line — "No bookings available right now — reach out at <owner_email>." If `owner_email` is null, render the message without the contact line.

### Transactional email branding
- **Logo:** rendered in email header, top-centered, max ~120px width. Applied across confirmation, cancel, and reschedule emails.
- **Primary color usage:** CTA buttons (cancel + reschedule links) **and** heading text (H1/H2) both use the primary color.
- **Footer:** "Powered by NSI" line with a small logo. (Not white-label in v1.)

### Claude's Discretion
- Storage bucket structure (e.g., `branding/{account_id}/logo.{ext}`) and signed-URL vs public-read decision.
- Exact card grid breakpoints, spacing, and typography on `/[account]`.
- Skeleton shape geometry and shimmer animation.
- postMessage origin validation strategy in `widget.js` (research output will inform).
- How `widget.js` is served (Vercel static asset, cache headers, versioning).
- Hex color contrast/WCAG fallback when the chosen primary color produces unreadable button text — pick a sensible auto-text-color (white vs black) based on luminance.
- Where in the dashboard the branding editor lives (likely `/app/branding` — already a stub from Phase 2).
- Email template structure (inline-styled HTML; `escapeHtml` already established Phase 6).

</decisions>

<specifics>
## Specific Ideas

- "Tabs: 'Script (recommended)' / 'iframe fallback'" — the recommended tab label explicitly says "(recommended)" so owners know which to copy.
- Multiple widgets on one page should "just work" — no special owner config required.
- Empty `/[account]` page should never 404; always be useful (contact link beats a dead end).
- "Powered by NSI" footer is in for v1 — white-label is a future enhancement, not now.

</specifics>

<deferred>
## Deferred Ideas

- **Curated color palette presets** — discussed and rejected for v1; free hex is fine for single-tenant.
- **Owner-controlled `data-nsi-min-height`** — defer; auto-resize is sufficient.
- **Static screenshot mock** for embed preview — rejected in favor of live iframe.
- **Auto-retry on widget load failure** — defer; inline error + hosted-page link is adequate first pass.
- **Branded hero header on /[account]** — defer; card grid alone for v1.
- **White-label (no "Powered by NSI" footer)** — future enhancement, not v1.
- **Live verification on Squarespace/WordPress (EMBED-07)** — deferred to Phase 9 (Manual QA) per ROADMAP.

</deferred>

---

*Phase: 07-widget-and-branding*
*Context gathered: 2026-04-25*
