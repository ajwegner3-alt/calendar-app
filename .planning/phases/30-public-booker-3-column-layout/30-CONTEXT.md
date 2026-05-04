# Phase 30: Public Booker 3-Column Desktop Layout - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the public booking card so calendar, time slots, and booking form sit side-by-side at desktop widths (≥1024px) on a single seamless card. Mobile (<1024px) stacks vertically as calendar → times → form. Form column reveal must produce zero layout shift. Embed widget inherits single-column behavior automatically via the `lg:` breakpoint.

This phase is purely a CSS grid restructure of `booking-shell.tsx` and `slot-picker.tsx`. New booker capabilities (guest fields, custom questions, calendar UX changes, timezone picker, post-submit redesign) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Selected-slot affordance
- **After a time is picked, the chosen slot stays visibly highlighted in the middle (times) column** while the form is mounted in column 3. The booker should always see "this is the time I'm booking" without glancing back at the calendar.
- The selected-state styling already exists on `slot-picker.tsx`; this phase preserves it across the form-reveal transition (no auto-deselect on form mount).

### Column visual treatment
- **Seamless single card — no internal dividers, no per-column background tints.** The 3 columns share one card surface; whitespace and alignment do the work of separation.
- No vertical borders between col 1↔2 or col 2↔3.
- No tinted form column.

### Timezone picker
- **Out of scope.** The "Times shown in [timezone]" hint is display-only; clicking it does NOT open a tz picker. A timezone re-selector is its own future feature, not part of this phase.

### Post-submit / confirmation flow
- **Out of scope.** The 3-column layout never sees the success state — submit routes to the existing `/[account]/[event-slug]/confirmed/[booking-id]` page. Do not modify confirmation/submit handling.

### Claude's Discretion
The following are explicitly delegated to Claude during planning/implementation:

- **Form-column empty-state treatment** — plain text vs. icon+text vs. headline+sub; exact prompt copy (current production text "Pick a time on the left to continue." is acceptable but not locked); vertical alignment within the column. Constraint: must be a placeholder div, NOT a mounted `<BookingForm>` (V15-MP-05 Turnstile lifecycle lock).
- **Timezone hint placement** — full-width banner above the 3-col grid (V15-MP-04 preference) vs. top-of-middle-column header (STACK.md spec). Pick whichever reads cleanest at desktop breakpoint; mobile placement at Claude's discretion. Hint text is display-only.
- **Form column header on slot pick** — whether to show a "Booking [time], [date]" header above the form fields, time-only header, or no header at all.
- **Re-pick behavior** — whether clicking a different time after the form mounts keeps form state, resets it, or surfaces an explicit "Change time" link. Pick the lowest-friction option that doesn't risk stale data.
- **Prompt → form transition** — instant swap vs. brief fade/slide. Any animation must be in-place (no layout shift).
- **Card chrome** — keep current rounded corners / shadow / `max-w-4xl` padding, or bump padding for 3-column breathing room.
- **Mobile vertical gap** — match desktop column gap, or tighten on mobile.
- **Per-column headings** — none vs. small "Date" / "Time" / "Your details" labels above each column.

</decisions>

<specifics>
## Specific Ideas

- The selected-slot highlighted state is the spatial anchor for the booker — it must persist while the form is visible. This drove the "stay highlighted" lock.
- The card should feel like one surface with three regions, not three boxes glued together. This drove the "seamless, no dividers" lock.

</specifics>

<deferred>
## Deferred Ideas

- **Timezone re-selector / tz picker** — booker-side timezone change UI. Out of scope for v1.5; future phase if booker confusion shows up in support traffic.
- **Post-submit redesign in the 3-col layout** — keeping the booker on the same card after submit (instead of redirecting to `/confirmed/[id]`). Future consideration; not v1.5.

</deferred>

---

*Phase: 30-public-booker-3-column-layout*
*Context gathered: 2026-05-04*
