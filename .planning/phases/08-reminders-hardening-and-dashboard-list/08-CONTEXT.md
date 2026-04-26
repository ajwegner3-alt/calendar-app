# Phase 8: Reminders + Hardening + Dashboard Bookings List - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Three converging deliverables:

1. **Reminders cron** — `/api/cron/send-reminders` runs hourly via Vercel Cron, claims each booking starting in the next 24h via compare-and-set UPDATE on `reminder_sent_at`, and sends exactly-once. Bookings created inside the 24h window get an immediate reminder at creation time. Branded same as confirmation.

2. **Hardening** — verified SPF/DKIM/DMARC DNS for the sending domain (mail-tester score >= 9/10); `/api/bookings` per-IP rate limiting; automated RLS test matrix proving a second seeded tenant cannot read or write the first tenant's data via anon, user-scoped, or unscoped queries.

3. **Dashboard bookings list + detail** — `/app/bookings` lists upcoming bookings by default with filters (status, date range, event type, search); `/app/bookings/[id]` (URL already locked from Phase 6) is the detail surface with cancel + owner notes + history.

Out of scope (deferred):
- SMS reminders, push notifications, in-app reminders
- Booker self-serve check-in / arrival confirmation
- Stripe / payment integration
- Per-event-type custom reminder schedules (e.g., 1h before, 1 week before)
- Booker-facing reschedule request approval flow

</domain>

<decisions>
## Implementation Decisions

### Reminder email — recipients
- **Booker only** in v1. Owner uses dashboard list to see what's coming up; no owner reminder email.
- Owner-side daily digest is deferred to v2.

### Reminder email — content
The reminder includes:
- Full booking details (date, time, duration, event name)
- Cancel + Reschedule links (same tokenized URLs from confirmation, still valid until appointment passes)
- Booker's custom-question answers (echoed back so booker can prep)
- Event location/address (driving directions style; requires new schema field — see Scope Additions below)

### Reminder email — per-account content toggles (NEW capability — flagged for planner)
- The owner can toggle on/off what's included in their account's reminder emails. Trade contractors vary: some want a clean "see you tomorrow at 2pm" reminder, others want full details echoed back.
- Initial toggle set: include/exclude custom-answers, include/exclude location, include/exclude cancel-reschedule links. Lives in account settings UI.
- Schema: new boolean columns on `accounts` (e.g., `reminder_include_custom_answers`, `reminder_include_location`, `reminder_include_lifecycle_links`). Default values: all true (matches Phase 5/6 behavior).

### Reminder email — tone and styling
- **Same as confirmation** — branded (logo header + brand H1 + Powered by NSI footer). Same email-template machinery from Plan 07-07.

### Reminder email — subject line
- **`Reminder: {event_name} tomorrow at {time_local}`** (e.g., `Reminder: 30-minute consultation tomorrow at 2:00 PM CT`).
- Time formatted in booker's submitted timezone, same convention as confirmation/cancel/reschedule senders.

### Bookings list — layout
- **Compact table**, one row per booking. Mirrors Phase 3 event-types list pattern.

### Bookings list — default columns
1. **Booker** — name on top line, email beneath (stacked).
2. **Phone** — high-value for trade contractors (calls, site visits).
3. **Event type + duration** — combined column.
4. **Start time + status badge** — combined column with TZ shown.

### Bookings list — status visualization
- **Badge color only.** confirmed=green, cancelled=red, rescheduled=amber. Row text and styling stay standard regardless of status. No row dimming, no strikethrough.

### Bookings list — custom-question answers in list
- **Hidden from list view.** Surfaced only in the detail view. Keeps the list dense and scannable.

### Bookings list — default view
- **Upcoming only** (`start_at >= now()`). Past bookings reachable via filters.

### Bookings list — filters
All four:
- **Status** — confirmed / cancelled / rescheduled / all.
- **Date range** — calendar from/to picker.
- **Event type** — multi-select.
- **Search** — free-text against booker name + email.

### Bookings list — default sort
- **Soonest upcoming first** (`start_at ASC`). Tomorrow's bookings at top.

### Bookings list — pagination
- **25 per page**, numbered pagination at the bottom. Predictable, bookmarkable, low complexity for v1 single-tenant volume.

### Bookings detail — surface
- **Separate page at `/app/bookings/[id]`** (URL already locked in Phase 6 STATE.md as the owner cancel surface). Phase 8 builds out the full detail view; Phase 6 cancel button stays where it is.

### Bookings detail — content
- Booking core (event, date, time, duration, status badge).
- Full booker contact (name; email as `mailto:`; phone as `tel:`).
- All custom-question answers (full set, no truncation).
- Booking history timeline from `booking_events` table (created → rescheduled → cancelled, with timestamps).

### Bookings detail — actions
- **Top-right action bar.** Primary Cancel button (already shipped Phase 6) + kebab menu for less common actions (currently empty in v1; placeholder for future "send manual reminder", "copy booking link", etc.).

### Bookings detail — owner-side notes (NEW capability — flagged for planner)
- Free-text owner note field that autosaves on blur or after a debounce window.
- Booker never sees this; private to owner.
- Schema: new `bookings.owner_note text` column (nullable).
- UI: textarea below booking core, with subtle "Saved" indicator.

### Hardening — rate limit response shape
- Plain `429 Too Many Requests` JSON response with `Retry-After` header. No friendly countdown UI on the booking page in v1 — just the existing race-loser-style banner copy adapted for "too many attempts, please wait a moment". (Claude's Discretion below.)

### Cron behavior
- Vercel Cron hits `/api/cron/send-reminders` hourly authenticated by `CRON_SECRET`.
- Idempotent claim: `UPDATE bookings SET reminder_sent_at = now() WHERE id = ? AND reminder_sent_at IS NULL` — exactly-once even on double-fire.
- Bookings created inside the 24h window send reminder immediately at booking creation (fire-and-forget pattern matches Phase 5 confirmation/owner emails). Locked from ROADMAP success criterion #2.

### Claude's Discretion
- Exact debounce duration for owner-note autosave (suggest 800ms after last keystroke).
- Exact rate-limit thresholds for `/api/bookings` (research will land production-safe defaults).
- Visual layout of booking history timeline (vertical timeline vs simple bulleted list).
- Saved-indicator for owner notes (toast vs inline checkmark vs subtle text change).
- Mail-tester domain configuration is operational (DNS via Namecheap) — Claude will write the manual-checklist plan, Andrew executes the dashboard steps.
- RLS audit test matrix structure (Vitest scaffolding mirroring Phase 1 anon-client test, expanded to user-scoped client and unscoped queries).

</decisions>

<specifics>
## Specific Ideas

- "I want to be able to toggle on/off what they want in app. For example, some people will want to answer questions and others won't want their customers to ask questions" — drove the per-account reminder content toggle decision.
- Compact table preview chosen over the wider card layout — Andrew prefers high density / Phase 3 consistency.
- Phone is a first-class column (not buried in detail view) — reflects NSI's call-and-site-visit business model.

</specifics>

<scope_additions>
## Scope Additions Beyond ROADMAP (planner should size)

These three decisions added new capabilities. The planner should evaluate whether each fits in Phase 8 or warrants splitting into its own plan / deferring:

1. **Per-account reminder content toggles** — adds 3+ boolean columns on `accounts`, plus a new "Reminder settings" panel in the dashboard. Likely a single dedicated plan inside Phase 8.

2. **Event type location/address** — adds a new `event_types.location text` column (or similar) and editor UI in `/app/event-types/[id]/edit`. Used by reminder email template. Could be its own small plan or rolled into the reminder-content plan.

3. **Owner notes on bookings** — adds `bookings.owner_note text` column + autosave UI on detail page. Small but cuts across schema + UI. Likely rolled into the bookings-list-and-detail plan.

If any of these stretches Phase 8 too far, planner can defer the address field (phone/email-only NSI bookings are already useful) — but the reminder toggles and owner notes were called out as personally important by Andrew.

</scope_additions>

<deferred>
## Deferred Ideas

- SMS reminders — separate phase or v2.
- Owner daily-digest reminder email — v2.
- Booker self-serve check-in / arrival confirmation — v2.
- Per-event-type custom reminder schedules (e.g., 1h vs 24h vs 1 week) — v2.
- Friendly rate-limit countdown UI on the booking page — v2 polish; v1 ships plain 429.
- Bookings export (CSV / iCal feed) — v2.
- Multi-event-type rate-limit policies — v2 if abuse patterns emerge.

</deferred>

---

*Phase: 08-reminders-hardening-and-dashboard-list*
*Context gathered: 2026-04-26*
