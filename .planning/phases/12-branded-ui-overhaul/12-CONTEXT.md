# Phase 12: Branded UI Overhaul (5 Surfaces) - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply the Cruip "Simple Light" aesthetic across all 5 surfaces (dashboard, public booking page, embed widget, transactional emails, auth pages), introduce per-account `background_color` + `background_shade` branding tokens, refactor the dashboard sidebar IA so Settings is reachable, and add a new Home tab with a monthly calendar + day-detail drawer. Scope is visual + IA only — no new booking/auth/capacity capabilities.

</domain>

<decisions>
## Implementation Decisions

### Home tab — monthly calendar
- Day modifiers render **dots per booking, capped** (e.g., 1-3 dots under day number, then "+N" indicator). Communicates volume without becoming noisy.
- Calendar uses `react-day-picker@9` per success criteria (locked).

### Home tab — day-detail drawer
- Drawer opens via shadcn `Sheet` (locked).
- Each booking row exposes **all four** actions:
  - **View** — link to existing `/app/bookings/[id]` detail page
  - **Cancel inline** — trigger cancellation flow from within the drawer (with confirmation step)
  - **Copy reschedule link** — copy booker-facing reschedule URL to clipboard
  - **Send reminder now** — manually re-trigger the reminder email

### Sidebar IA
- Settings group uses **inline accordion expansion** — clicking Settings expands Reminders + Profile beneath it in the sidebar; click again to collapse. No flyout, no auto-route-driven expansion.
- Mobile / narrow viewports: **hamburger → full-screen drawer**. Sidebar hidden by default; tap hamburger to open as full overlay.

### Branding tokens — color picker
- **Presets + custom hex.** Show curated swatch palette aligned to Cruip aesthetic, but allow free hex entry for owners who want custom branding.

### Branding tokens — shade preview
- **Inline mini-preview card** on `/app/branding`. Single mockup card on the branding page that renders the gradient blur-circles live as the owner adjusts shade. Owner navigates to actual surfaces (dashboard, public, etc.) to verify in context.

### Branding tokens — gradient surface scope
- Gradient blur-circle decorative backgrounds render on **all 5 surfaces**: dashboard, public booking page, embed widget, `/[account]` landing card, and auth pages.
- Auth-page gradient uses NSI tokens (see Auth section below), not the visiting-account's tokens.

### Branding tokens — `background_shade='none'` behavior
- Claude's discretion. Recommend defaulting to **flat solid `background_color` tint** (no blur-circles) so the color choice still has a visible effect; revisit if it looks off against Cruip's gray-50 baseline during planning/implementation.

### Email branding strategy
- **Solid-color-only headers** — use the account's `background_color` as a flat solid header bar. No CSS gradients, no VML fallback, no pre-rendered gradient images. Outlook desktop + Yahoo render perfectly. Aligns with STACK.md pick.
- **Identical header treatment across all 6 transactional emails** (booker confirm, owner notify, booker cancel, owner cancel, booker reschedule, owner reschedule). Consistency over status semantics.
- **NSI mark in footer bottom-center** with subtle "Powered by NSI" wordmark on every send. Light NSI brand presence on every email regardless of account.

### Email — plain-text alternative scope
- Claude's discretion. Success criteria only locks plain-text alt for booker confirmation (EMAIL-10). Recommend extending to all booker-facing emails (confirm + cancel + reschedule) if effort is small; minimum bar is booker confirmation only.

### Auth pages — tone
- **Marketing-y with NSI brand.** Cruip-style hero with NSI gradient, headline, value-prop copy alongside the form. Auth pages double as a soft sales surface for NSI.
- Applies to `/login`, `/signup`, `/auth/reset-password`, `/forgot-password`, `/verify-email`, `/auth/auth-error`.

### Auth pages — branding tokens source
- **NSI tokens (fixed).** Pre-signup users have no account context, so auth pages always render NSI's brand colors regardless of which account they're trying to access. Consistent NSI identity across the auth flow.

### Public booking page — gradient density
- **Hero + footer accents.** Strong gradient blur-circles in hero area, subtle accents at footer, slot-picker section in clean white/gray-50. Anchors the brand without distracting from the booking task.

### Embed widget — restyle scope
- **Full restyle, gradient included.** Embed renders the same gradient blur-circles as the public page so brand identity carries through inside the iframe. Embed snippet dialog widens to `sm:max-w-2xl` per success criteria (locked).

### Visual regression QA — Phase 12 prerequisite
- Claude's discretion. Recommend pulling a **minimum-viable Playwright suite** forward (~1 day, 5 critical screenshots × 3 viewports) as cheap insurance — Phase 12 is the largest visual surface in project history. If Plan-phase analysis shows the work is materially larger than ~1 day, fall back to manual-QA-only and document the trade-off.

### Claude's Discretion
- `background_shade='none'` exact behavior (flat tint vs. neutral gray-50)
- Plain-text alternative scope beyond booker confirmation
- Visual-regression Playwright suite scope (build vs. defer)
- Swatch palette curation (which 8-12 colors)
- Custom hex validation rules (contrast checks, WCAG warnings)
- Cruip-specific spacing tokens, typography weights, exact gradient blur radii
- Empty-calendar state copy on Home tab
- Default landing tab when owner hits `/app` (Home vs. Bookings vs. Event Types)
- Loading skeletons + error states across all surfaces
- Owner-email vs. booker-email visual distinguishability within the "identical header" constraint

</decisions>

<specifics>
## Specific Ideas

- Cruip "Simple Light" aesthetic — Inter typography, gray-50 base, gradient accents, floating glass header pill, generous `py-12 md:py-20` section rhythm, `max-w-3xl` slot picker (locked in success criteria).
- Day modifiers should feel like a Linear/Notion "activity dot" pattern — visible at a glance without dominating the calendar grid.
- Auth pages should sell NSI lightly — visiting visitors who land on `/login` or `/signup` are a soft top-of-funnel for NSI's broader trade-contractor consultancy.
- NSI footer mark on emails is intentional brand presence on every transactional send (not a Calendly-style "Powered by" growth loop).
- Embed widget keeping its gradient is a deliberate choice over host-site-fit — owners who pick branded gradients want them visible inside their site's embed.

</specifics>

<deferred>
## Deferred Ideas

- Per-template status-semantic email coloring (cancel = muted, reschedule = badge) — rejected in favor of identical headers; revisit in v1.2 if owners ask for clearer status legibility in inbox previews.
- Live across-surface preview tabs on `/app/branding` — rejected in favor of inline mini-preview card; revisit if owners report they're surprised by how branding renders on surfaces they didn't preview.
- Bottom-tab-bar mobile nav and collapsed icon-rail sidebar — rejected in favor of hamburger → drawer; revisit if mobile usage data suggests a more app-like pattern is warranted.
- Booker vs. owner email branding split — rejected; owner inbox stays as branded as booker inbox in v1.1.
- Color-intensity heatmap for calendar day modifiers — rejected; volume is communicated by capped dots instead.
- Pre-rendered gradient PNG headers in emails (per-account image generation) — rejected for v1.1; if visual parity becomes a problem, VML fallback is the next step before image generation.

</deferred>

---

*Phase: 12-branded-ui-overhaul*
*Context gathered: 2026-04-29*
