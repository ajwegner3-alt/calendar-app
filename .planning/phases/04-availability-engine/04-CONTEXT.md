# Phase 4: Availability Engine - Context

**Gathered:** 2026-04-24
**Status:** Ready for research

<domain>
## Phase Boundary

Owner-facing dashboard surface where Andrew defines WHEN people can book, plus a server-side computation API (`/api/slots`) that derives the bookable UTC slot list for any event type + date range. Two surfaces:

1. **Dashboard editor** at `/app/availability` — weekly recurring rules, per-date overrides, and four global knobs (buffer, min-notice, max-advance, daily cap).
2. **Slot computation API** at `/api/slots` — given `event_type_id` + a date range, returns the UTC slot list with all rules applied: subtract existing bookings, apply pre/post buffers, honor min-notice + max-advance, enforce daily cap, and stay correct across DST transitions.

**Account-wide scope (AVAIL-07):** Availability rules apply to ALL of Andrew's event types. Per-event-type schedules are deferred to v2. The slot endpoint takes an event type only to read its `duration_minutes`; the rules themselves are read from the account.

Out of scope: the public booking page that consumes `/api/slots` (Phase 5), team availability or shared calendars (out of v1), Google/Outlook calendar sync (out of v1), per-event-type schedule overrides (v2).

</domain>

<decisions>
## Implementation Decisions

### Weekly availability editor

- **Layout: Per-weekday rows (Calendly-style).** Seven rows, one per weekday, each with the day name, an Open/Closed toggle, and the time-window pickers stacked vertically.
- **Multiple windows per day: unlimited via add-row button** — soft UI cap around 5 visible rows for sanity, no hard backend limit.
- **"Copy from →" menu per row.** Each weekday row has a small dropdown letting Andrew copy another day's windows over (replaces current windows for that day). Useful for the common "Mon-Thu identical" pattern.
- **Closed day: explicit Open/Closed toggle per weekday.** Switching to Closed hides the time pickers and clearly says "Closed." Belt-and-suspenders clarity over the implicit "no windows = closed" pattern. Schema can store the toggle state independently (or derive it; researcher to confirm).

### Per-date overrides

- **Entry point: BOTH calendar picker AND list view.** Calendar markers (red dot for blocked dates, blue dot for custom-hours dates) show overrides at-a-glance; click marker to view/edit. List below the calendar shows all overrides as cards (date, type badge, summary) for management/sorting.
- **Override types: BOTH "Block this day" AND "Replace rules for this day"** (matches AVAIL-02 verbatim). Block = no slots that day. Replace = use these custom windows for this date (overrides the weekly rule for that one date).
- **Override always wins, even on closed weekdays.** Adding a "Replace rules" override on a normally-closed Sunday OPENS that Sunday for the override's windows. This makes the system fully expressive (Andrew can take a one-off Sunday booking without flipping the weekly toggle).
- **Override editing flow:** click date → modal opens with two tabs/sections (Block / Custom hours). Custom hours uses the same time-window pickers as the weekly editor.

### Global settings (buffers, min-notice, max-advance, daily cap)

- **Location: bottom of the Availability page (one-stop).** Weekly editor on top, overrides in the middle, settings panel at the bottom. Single page for everything availability-related. Not a separate route.
- **Input style: plain `<input type="number">` + unit label** (e.g., "Buffer (minutes)", "Min notice (hours)", "Max advance (days)", "Daily cap (bookings/day, leave empty for none)"). Familiar, fastest to build, no surprises. Matches Calendly's settings pattern.
- **Defaults shipped (seed values, all customizable):**
  - **Buffer:** 0 minutes
  - **Min notice:** 24 hours
  - **Max advance:** 14 days
  - **Daily cap:** none (null/unset)
- **Daily cap is nullable.** Empty input = no cap. When set, it's an integer count of confirmed bookings per local-date.
- **All settings live on the `accounts` table** (account-wide per AVAIL-07). Researcher to confirm which columns already exist on the Phase-1 schema vs need a migration.

### Slot generation behavior

- **Step size: match the event-type duration.** A 30-min event type generates slots at every 30-min boundary inside an availability window (9:00, 9:30, 10:00...). A 60-min event type generates hourly slots. Most intuitive — "a 30-min event happens every 30 minutes." No per-event-type configurable step in v1.
- **`/api/slots` response shape: Claude's Discretion** — recommend a flat array of `{start_at, end_at}` UTC ISO strings (conventional REST, easier to cache, leaves grouping for the consumer). Phase 5 booking UI groups by date itself.
- **Daily cap behavior in the API: Claude's Discretion** — recommend returning empty for the day (no slots when cap reached). Cleanest UX: a fully-booked day looks identical to a cap-reached day from the booker's perspective. If Phase 5 needs to distinguish for messaging, revisit then.
- **First-visit empty state on dashboard:** empty editor (all weekdays Closed by default) + a clear top banner: "You haven't set availability yet — bookings cannot be made until you do." Forces deliberate setup. No pre-seeded "Mon-Fri 9-5" defaults — Andrew opts in explicitly so a default-hours mistake never goes live.
- **Empty `/api/slots` consumer behavior (Phase 5 contract):** when slots return `[]` for the requested range, Phase 5's booking page renders a friendly "No times available right now" message with a fallback contact info block (NSI phone/email). This is established Phase 4 intent; final UX implementation lives in Phase 5.

### Claude's Discretion

- Slot computation algorithm internals — generate-then-filter vs interval-merge approach. Researcher will recommend; planner picks based on test ergonomics and DST safety (date-fns/tz v4 idioms drive this).
- DST handling specifics — algorithm must produce correct counts across March 8 2026 (spring-forward) and Nov 1 2026 (fall-back) per AVAIL-09, but the implementation choice (UTC-first vs local-first computation) is mine.
- `/api/slots` exact response envelope (recommend flat array; if Phase 5 prefers grouped, revisit).
- Daily-cap behavior in API (recommend empty array on cap-reached, no flag).
- Calendar picker library/component (likely a shadcn `Calendar` component or `react-day-picker`; researcher to confirm Phase 2's installed primitives).
- Time-window picker UX (HH:MM dropdowns vs free-text time input vs `<input type="time">`).
- Form-validation timing for overlapping windows ("9-12, 11-2" should error or merge?).
- Loading skeleton for the Availability page.
- Toast/inline error patterns for save (reuse Phase 3 sonner setup).
- Whether the daily cap counts cancelled bookings (recommend NO — only confirmed; align with Phase 3's `.neq("status", "cancelled")` pattern in DeleteConfirmDialog).

</decisions>

<specifics>
## Specific Ideas

- **Calendly is the reference point for the weekly editor layout** — Andrew is familiar with the per-weekday-row pattern from competitor research.
- **Notion/Linear pattern for the per-row "Copy from →" menu** — small dropdown trigger, simple action list.
- **Calendar with markers for the overrides view** — think "Google Calendar with colored dots" rather than a full event-block visualization. Goal is at-a-glance scanning, not editing in the calendar itself.
- **Defaults are shipping seeds, not constants.** Andrew (and any future v2 tenant) customizes them all from the Availability settings panel. The defaults exist so the system isn't broken on first use.
- **Override always wins is a deliberate symmetry choice.** The mental model becomes "weekly rules are the baseline; any date override replaces it for that date" — no edge cases about whether overrides can promote a closed day.
- **Don't bind the dashboard URL to live booking** — the `/api/slots` endpoint is the integration point for Phase 5; the dashboard editor only writes to the `accounts` + `availability_rules` + `date_overrides` tables. Phase 5 reads from `/api/slots`, not directly from the rules tables.

</specifics>

<deferred>
## Deferred Ideas

- **Per-event-type schedule overrides** — AVAIL-07 explicitly defers this to v2. Account-wide rules only in v1.
- **Team availability / shared calendars** — out of v1 scope (Andrew is the only owner).
- **Google Calendar / Outlook sync** — STATE.md decision: Supabase is sole source of truth for v1.
- **Per-event-type slot interval (independent of duration)** — would require schema migration. Defer to v2 if real customers need oddly-spaced slots (e.g., 45-min events on 30-min boundaries).
- **`cap_reached` flag in API response** — defer; revisit only if Phase 5 booking UI needs to render greyed-out "limit reached" slots distinctly from "no availability".
- **Pre-seeded default weekly rules** (Mon-Fri 9-5) — explicitly deferred. First-visit empty state forces deliberate setup.
- **Drag-to-paint or click-to-toggle on a calendar grid** — defer to v2 polish if the row-based editor feels clunky in real use.
- **Bulk override import / CSV** — out of v1 scope.
- **Per-event-type buffer / min-notice overrides** — coupled to per-event-type schedule deferral; v2.

</deferred>

---

*Phase: 04-availability-engine*
*Context gathered: 2026-04-24*
