# Phase 32: Inverse Date Overrides - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the date-override editor's "enter available times" mode with "enter unavailable windows." Owners can add multiple unavailable windows on a single date or toggle the entire day off. The slot engine (`lib/slots.ts`) recomputes available slots as (account-wide weekly hours) MINUS (the date's unavailable windows), preserving the existing buffer + EXCLUDE GIST + capacity index invariants. Existing confirmed bookings overlapping a newly-created unavailable window are surfaced in a warning preview, gated by a Phase 31 quota pre-flight (EMAIL-23), and on commit are run through the existing cancel lifecycle (audit row, .ics CANCEL, booker rebook-CTA email, owner notification).

Out of scope: recurring unavailability patterns, auto-suggested windows, day-level pushback (Phase 33), and any change to the booker-side calendar UI.

</domain>

<decisions>
## Implementation Decisions

### Locked constraints (from ROADMAP / project standards)

- **LD-07 booker-neutrality lock** — The auto-cancel booker email must stay audience-neutral on booker-facing surfaces (no NSI brand, no owner identity leakage in copy or CTA target).
- **v1.5 invariants preserved** — Buffer-after-minutes still applied to remaining available windows after MINUS computation; EXCLUDE GIST cross-event-type constraint still binding; partial-unique capacity index still binding; race-safety unchanged.
- **EMAIL-23 quota gate is hard** — When the auto-cancel batch's projected email count would exceed remaining daily quota (from Phase 31's `getRemainingDailyQuota()`), the commit button must be disabled. No silent overflow, no partial-batch fallback unless explicitly designed and surfaced.
- **CP-03 two-step DROP protocol applies** — If the migration drops or repurposes a column on `date_overrides`, follow the established two-step pattern (add new, dual-write/dual-read window, then drop). Avoid breaking-change single-migration column drops.
- **Pre-flight hard-gate (V14-CP-06)** — Apply before any VALIDATE-CONSTRAINT-aborting DDL on `date_overrides`.

### Legacy `date_overrides` data

- **Production data exists** in the `date_overrides` table (confirmed by Andrew). The researcher must inspect actual row contents and shape before the planner finalizes a migration strategy. Migration is NOT safe to design blind.
- The chosen migration approach (auto-invert, treat-as-full-day-block, drop+notify, or hybrid) is Claude's discretion *after* inspection — not before.

### Claude's Discretion

The following areas are explicitly delegated to Claude (researcher + planner) — Andrew has not pre-committed to any specific UX or implementation pattern:

- **Editor UI shape** — How owners add a new unavailable window (button-reveals-row vs always-visible-empty vs drag-on-timeline). Default to the simplest pattern matching existing dashboard conventions.
- **Time picker style** — Native vs stepped dropdown vs native+step. Match whatever the existing weekly-hours editor already uses.
- **"Block entire day" toggle placement** — Top-of-editor vs inline-near-Save vs header-chip. Pick the placement that signals it as a mode switch, not a window.
- **Toggle-on behavior with existing windows** — Hide+preserve vs confirm+wipe vs hard-wipe. Default toward the safer-feeling option (likely hide+preserve so owners can experiment without losing work).
- **Affected-bookings preview shape** — Modal-on-Save vs inline-live vs side-panel. Match dashboard conventions.
- **Per-booking info density** — Match `/app/bookings` list density (likely name + start/end + event-type label).
- **Sort order for affected bookings** — Chronological vs grouped-by-window vs grouped-by-event. Pick the clearest visual mapping of "this window will cancel these bookings."
- **Quota-exceeded UX** — Match the Phase 31 manual-reminder/quota-error pattern (likely disabled commit button + clear inline "X needed, Y remaining today" message). Partial-batch splitting is discouraged unless cheap to design.
- **Booker-facing email tone** — Match existing v1.5 cancel-email tone (brand-neutral per LD-07, warm but factual).
- **Owner-supplied reason field** — Optional. If included, parity with Phase 33's planned reason field is a plus but not required for this phase.
- **Rebook CTA wording + destination** — Match existing booker-facing email CTA conventions; deep-link to the same event-type calendar if cheap.
- **Owner notification on auto-cancel** — Single batch summary preferred over N-per-booking to conserve quota; "no email" is acceptable since the owner initiated the batch.
- **Schema migration shape** — Add-new-cols-keep-old (CP-03 two-step) vs new-table-entirely. Pick after inspecting production data.

</decisions>

<specifics>
## Specific Ideas

- **Inspect `date_overrides` production data BEFORE designing the migration.** Andrew confirmed real rows exist; auto-inverting old "available windows" semantics could produce wildly wrong unavailability if rows are sparse. The researcher's first task in this phase should be a read-only inspection of row count, column shape, and sample contents.
- **Re-use Phase 31 surfaces.** The unsent-confirmations dashboard banner pattern (Plan 31-03), the `getRemainingDailyQuota()` helper (Plan 31-01), and the inline quota-error UX (Plan 31-03) are all available and should be the visual + behavioral references for the EMAIL-23 quota gate in this phase.
- **Re-use existing cancel lifecycle.** AVAIL-06 explicitly delegates to the existing single-cancel path (`booking_events` audit row, status update, .ics CANCEL, booker email, owner notification). Don't build a parallel batch-cancel path — call the existing per-booking lifecycle inside a transactional batch with quota pre-flight at the front.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Recurring unavailability patterns and auto-suggested windows were not raised but would be future-phase candidates if needed.

</deferred>

---

*Phase: 32-inverse-date-overrides*
*Context gathered: 2026-05-05*
