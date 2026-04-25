# Phase 3: Event Types CRUD - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Owner-only dashboard surface where Andrew defines and manages the "things people book." A single tenant (Andrew's `nsi` account) operates this UI; signup/multi-tenant onboarding is deferred to v2. Operations covered: create, edit, soft-delete, restore, toggle active/inactive, and add/remove/reorder custom intake questions per event type.

Public-facing surfaces (booking pages, slot pickers, embed widgets) are out of scope — they consume event types but live in Phases 5-7. The Availability Engine (Phase 4) is also separate; this phase only stores event-type metadata, not availability rules. Soft-delete preserves historical bookings; the row stays in DB but disappears from the default dashboard view.

</domain>

<decisions>
## Implementation Decisions

### List view + row actions

- **Layout: Table.** Calendly/Cal.com-style dense rows with columns. Andrew likely has 5-10 event types; a table is more scannable than a card grid for that scale.
- **Default columns:** Name, Duration, Slug, Status, Actions (kebab). Description preview, custom-question count, and timestamps are *not* shown in the row — they appear on the detail/edit page only.
- **Row actions live behind a kebab menu (`⋯`)** at the end of each row. Standard Notion/Linear pattern. Avoids visual clutter from inline action buttons.
- **Inactive event types are visually distinguished by BOTH a greyed/muted row AND an explicit `Inactive` status badge.** Belt-and-suspenders for clarity; greyed alone misses screen-reader cues, badge alone is too subtle.
- **Status column shows three states visually:** `Active` (default badge), `Inactive` (muted badge + greyed row), and `Archived` (only visible when "Show archived" filter is on; strikethrough or distinct badge).

### Create / edit form flow

- **Dedicated routes, not modal/drawer:** `/app/event-types/new` and `/app/event-types/[id]/edit`. URLs are bookmarkable. Custom-questions section needs vertical room; modal would feel cramped.
- **Slug auto-generates LIVE as Andrew types the name field.** Standard slugify rules: lowercase, replace spaces and special chars with `-`, collapse repeated dashes, trim. If Andrew manually edits the slug, auto-gen stops — he's taken control of that field for the rest of the session.
- **Slug remains editable after create, but a yellow inline warning appears when editing an already-saved event type's slug:** "Changing the slug breaks any existing booking links shared with this event type." Andrew owns the call.
- **Live URL preview is rendered below the slug field** as Andrew types. Format: `yoursite.com/nsi/[slug]` using a hardcoded Phase-3 placeholder domain. Phase 7 swaps `yoursite.com` for the per-account branded domain — trivial migration. Don't bind to the current Vercel deploy URL.
- **Save button submits everything together** (event-type fields + custom questions). Single round-trip; single commit boundary in DB.

### Custom questions UX

- **Question types supported in v1: Standard set** — short text, long text (textarea), yes/no, single-select dropdown. Covers the trade-contractor intake use case (urgency / property type / issue description / preferred-window). Multi-select, file upload, number, and phone-formatted text are deferred to v2.
- **Single-select questions** require Andrew to define the option list inline within the question row. Each question can have an unbounded list of options; we'll cap at something like 20 to keep the form manageable but won't surface that limit aggressively.
- **Custom questions live as an INLINE section within the same event-type create/edit form.** "Custom Questions" subheader below the main fields. Single Save button submits both event-type fields and questions atomically. No tabs, no separate sub-route.
- **Reorder via up/down arrows + remove button per row.** No drag-and-drop in v1 (avoids dnd-kit dependency, simpler on touch). Each question row: `[ ↑ ] [ ↓ ] [ Required toggle ] [ × ]` plus the question fields.
- **Required toggle: per-question switch, default = optional.** New questions start as optional; Andrew opts into required when it matters. Less aggressive default; fewer half-filled bookings only matters for the questions Andrew explicitly cares about.
- **Storage:** persisted as a single `custom_questions` jsonb column on the `event_types` table (already in Phase-1 schema). Each entry: `{ id, label, type, required, options? }`. Order is array index.

### Soft-delete + active/inactive UX

- **Active toggle is reachable from BOTH the row's kebab menu AND the edit form.**
  - Kebab menu: "Make inactive" / "Make active" as a one-click action (no confirmation — it's reversible).
  - Edit form: Switch component near the top of the form.
- **Soft-deleted (archived) event types are hidden by default.** A "Show archived" filter toggle on the list page reveals them; archived rows render with strikethrough or an "Archived" badge in the Status column.
- **Restore IS supported from the UI.** Archived rows have a "Restore" action in the kebab menu. Restored event types come back as `Inactive` (Andrew opts back into Active when ready) — preserves the safety of "deleted = invisible to the public" until he explicitly republishes.
- **Restore + slug collision:** if a new event type has taken the archived's slug between delete and restore, the restore prompt asks Andrew to pick a new slug for the restored event type. Otherwise restore is direct.
- **Delete confirmation pattern depends on whether the event type has bookings:**
  - **Zero bookings:** simple "Are you sure?" modal with confirm button.
  - **Has bookings:** modal asks Andrew to type the event type's *name* to confirm — prevents accidental destruction of historical data. Standard GitHub/Stripe pattern.
- **No hard-delete in v1.** Soft-delete is the terminal state from UX; underlying row stays in DB for booking-history referential integrity. Hard-delete (DB-level) is a manual operation if ever needed.

### Claude's Discretion

- Exact form-validation timing (RHF mode: defaults to `onBlur` like Plan 02-01, but can switch to `onChange` for the slug field if collision feedback is more responsive that way).
- Slug uniqueness check pattern: client-side optimistic check vs server-only (likely server-only via the existing `accounts`-scoped unique index — researcher will confirm).
- Empty state for the list page (no event types yet) — friendly CTA pointing to `/app/event-types/new`. Copy and illustration are Claude's call.
- Toast/notification pattern after save/delete/restore (likely `sonner` or shadcn's `toast` — Claude picks during planning).
- Loading skeleton for the list page (full skeleton vs `Loading...` text).
- Error handling on save (toast vs inline form error vs both).
- Whether the kebab menu uses `DropdownMenu` from shadcn or a custom popover.
- Pagination/virtualization on the list page — almost certainly not needed for 5-10 event types; skip unless Andrew has 50+.

</decisions>

<specifics>
## Specific Ideas

- **"Calendly/Cal.com style"** — list view layout pattern is the reference point. Andrew will be familiar with that mental model from Phase 2 research.
- **Notion/Linear kebab pattern** — row actions follow that convention.
- **GitHub/Stripe destructive confirmation** — type-the-name pattern is the reference for delete-with-bookings.
- **Standard slugify rules** — lowercase, alphanumeric + dashes, collapse repeated dashes. Same pattern as Cal.com, Notion's slug fields, etc.
- **Phase-7 forward-compatibility:** the URL preview must work with a placeholder domain that Phase 7 can swap atomically. Hardcode `yoursite.com` for now; do NOT use the live Vercel URL.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-select question type, file upload, number, phone-formatted text** — defer to v2 question-types phase or revisit if real intake forms need them.
- **Hard-delete from the UI** — defer; soft-delete is the terminal state for v1.
- **Drag-and-drop reorder for custom questions** — defer to v2 polish phase if up/down arrows feel clunky in real use.
- **Bulk operations** (select multiple event types, delete/archive in batch) — defer; not in v1 scope, low value at 5-10 event types.
- **Duplicate event type action** — interesting but not in EVENT-01..06 requirements; defer to v2 productivity phase if Andrew asks for it.
- **Per-event-type analytics or booking counts on the list** — Phase 8 surfaces booking data; v1 list view stays metadata-only.
- **Per-event-type custom branding** — Phase 7 owns branding; v1 uses account-level branding only.
- **Rich-text description editor** — v1 uses plain textarea for description. Markdown / WYSIWYG defers to v2 content phase.

</deferred>

---

*Phase: 03-event-types-crud*
*Context gathered: 2026-04-24*
