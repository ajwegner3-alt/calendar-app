# Feature Landscape: v1.5 Buffer Fix + Audience Rebrand + Booker Redesign

**Domain:** Multi-tenant Calendly-style booking tool — service-based businesses
**Researched:** 2026-05-03
**Confidence:** HIGH for buffer behavior (leading-tool patterns confirmed, codebase inspected)
           HIGH for rebrand surface map (derived directly from codebase surfaces)
           MEDIUM for 3-column layout patterns (Cal.com open-source confirmed; Calendly/Acuity
                  primary-source layout details limited by auth walls on help docs)

---

## State of the Codebase Entering v1.5

### Buffer (what exists today)

- `accounts.buffer_minutes` — account-wide, applies symmetrically to ALL event types on the account
- `event_types.buffer_before_minutes` and `event_types.buffer_after_minutes` — columns exist in
  the initial schema (v1.0, `20260419120000_initial_schema.sql`, both `int not null default 0`),
  but `computeSlots` in `lib/slots.ts` only reads `account.buffer_minutes`. These columns are
  live in production, all zeroed, and unused.
- `slotConflictsWithBookings` in `lib/slots.ts:203` applies the buffer symmetrically: extends the
  candidate slot by `buffer_minutes` on each side before checking overlap.
- The NSI production account has `buffer_minutes = 15`, which causes adjacent slots after any
  booking (on any event type) to be hidden for 15 minutes.
- v1.5 goal: replace account-wide `buffer_minutes` with per-event-type `post_buffer_minutes`
  (mapped from existing `buffer_after_minutes`), drop `accounts.buffer_minutes` via CP-03 two-step.

### Booker layout (what exists today)

`booking-shell.tsx` renders a single `rounded-2xl` card with:
```
grid gap-8 p-6 lg:grid-cols-[1fr_320px]
```
- LEFT column: `<SlotPicker>` — itself a 2-col sub-grid `lg:grid-cols-2` with calendar on the
  left and time list on the right
- RIGHT column (320px fixed): `<BookingForm>` — revealed only when `selectedSlot !== null`;
  before pick, a single-line prompt "Pick a time on the left to continue." renders

This is effectively a 3-panel layout at lg: breakpoints: calendar / times / form — but the
form RIGHT column exists at all sizes (no layout shift when slot is picked). The issue Andrew
flagged is "calendar floated right, text chaotic" on the existing 2-column approach. The v1.5
redesign explicitly names a **3-column** desktop layout: calendar LEFT, times MIDDLE, form RIGHT.

### Rebrand (what exists today)

Product is branded as "trade contractors" across owner-facing copy and several internal
identifiers (`tradeContractor*`, `contractor*` function/variable names). The rebrand to
"service-based businesses" is a copy + identifier change, NOT a visual system change.

---

## Table Stakes for v1.5

Features that must ship for the 3 headline objectives to feel complete.

### Feature 1: Per-Event-Type Post-Event Buffer

| Attribute | Specification |
|-----------|--------------|
| Column | `event_types.buffer_after_minutes` (already exists, currently 0 everywhere) |
| Migration | Backfill `buffer_after_minutes` from `accounts.buffer_minutes` on all event types; then DROP `accounts.buffer_minutes` via two-step CP-03 drain protocol |
| Slot engine | `computeSlots` reads `event_types.buffer_after_minutes` instead of `account.buffer_minutes`; extends candidate slot END only (post-buffer, not symmetric) |
| Owner UI location | Event type editor — "Advanced" or "Scheduling" section (mirrors leading tools: Calendly "Limits and buffers", Cal.com "Limits" tab, Acuity "Appointment types → Edit → Block off time after") |
| UI copy | "Buffer after event" (matches leading-tool convention; "After" is standard; avoid "cool-down" or "padding" which are Acuity-specific) |
| Units | Minutes only (all leading tools use minutes; no hours/minutes split needed in this range) |
| Default | 0 (no buffer — clean default; leading tools all default to 0) |
| Min | 0 (no buffer) |
| Max | 360 (6 hours — matches Calendly's range; sufficient for any service vertical) |
| Input type | `<input type="number" min="0" max="360" step="5">` — stepping by 5 matches common usage (0, 5, 10, 15, 30, 60) |
| Validation | Zod: `z.coerce.number().int().min(0).max(360)` |
| Buffer visibility to booker | NO — buffer is an owner-only scheduling constraint; it is never displayed in the booker UI. Available slots simply exclude the buffered window. This matches all leading tools: Calendly, Cal.com, Acuity, SavvyCal all hide buffer from invitees. |
| Buffer affects displayed end time | NO — `end_at` stored in DB remains `start_at + duration_minutes` (the raw booking window). Buffer applies only at slot-generation time in `computeSlots`. Changing this would require a data migration and break the reschedule slot-freeing invariant. Anti-feature: do NOT store buffer in end_at. |
| Buffer semantics | POST-event only. The v1.5 scope is `buffer_after_minutes`. `buffer_before_minutes` is also in the schema but is NOT wired up in v1.5 (pre-event buffer is a v1.6+ feature, see Anti-Features). |
| Cross-event-type interaction | With the account-wide buffer gone, buffers now apply per-event-type. A 15-min buffer on "Consultation" will hide slots adjacent to a Consultation booking, but a "Phone Call" event type with 0 buffer can be booked adjacent to a "Consultation" if the constraint allows it. The Phase 27 EXCLUDE constraint (`event_type_id WITH <>`, `during WITH &&`) only blocks actual time-overlap, not buffer-extended overlap — this is correct and intentional. |

### Feature 2: Audience Rebrand — Surface Map

Surfaces that need copy changes (owner-facing, not seen by booker customers):

| Surface | What Changes | What to Change To |
|---------|-------------|-------------------|
| `/signup` page hero text | "for trade contractors" copy | "for service-based businesses" or generic ("Schedule smarter") |
| `/onboarding` wizard step 1-3 | Any "contractor" framing in headers/subtext | "your business", "your services", neutral |
| Owner dashboard (`/app/home`) tagline or welcome text | Any "contractor" framing | Generic or "service business" framing |
| Event type editor placeholders/labels | Any "job", "job site", "contractor" placeholder copy | Generic: "service", "appointment", "session" |
| Settings pages (`/app/settings/*`) | Any "contractor" framing | Generic |
| Marketing/README/FUTURE_DIRECTIONS.md | "trade contractors" in description | "service-based businesses" |
| Internal identifiers (TypeScript) | `tradeContractor*`, `contractor*` variable/function names | `serviceBusiness*`, `serviceAccount*` (or generic if single-word is cleaner) |

Surfaces that must NOT get audience copy (booker-facing — no audience language):

| Surface | Why Untouched |
|---------|--------------|
| `/[account]/[event-slug]` booking page | Booker sees the contractor's brand, not NSI product copy |
| `/[account]` account index | Same — booker-facing |
| `/embed/[account]/[event-slug]` widget | Same — embedded in client websites |
| Confirmation, reminder, cancel, reschedule emails | Booker-facing; NSI footer mark is already generic |
| `confirmed/[booking-id]` page | Booker-facing |

Does onboarding need to ASK what kind of business? NO — this is explicitly an anti-feature
for v1.5. The onboarding wizard should stay generic (no industry dropdown). Reasons:
1. Adding a segmentation question requires storing the answer, wiring analytics, and acting on
   it to change the product behavior — none of which is in v1.5 scope.
2. Generic copy ("your business", "your services") covers all verticals without a question.
3. Calendly itself does NOT ask industry during signup — it asks for role/use case but keeps
   the product UI identical regardless of answer.
4. Industry segmentation is a v2+ growth/analytics feature, not a v1.5 copy change.

### Feature 3: 3-Column Booker Layout (Desktop)

**Pattern provenance:**
- **Acuity Scheduling (confirmed MEDIUM):** "Monthly template displays a calendar on the LEFT,
  with the times for the selected day on the RIGHT." — 2-column. Form appears AFTER date+time
  selection (sequential steps, not simultaneous columns).
- **Cal.com (confirmed HIGH):** Three view modes: MONTH_VIEW, WEEK_VIEW, COLUMN_VIEW.
  COLUMN_VIEW is weeks displayed as date columns (days with available slots only), NOT a
  calendar+times+form 3-column. Cal.com's booker enters a `selecting_date` state, then
  `selecting_time`, then shows the form — sequential, not simultaneous. The "3-column" framing
  in v1.5 is NSI's own design, not a direct copy of Cal.com.
- **Calendly (confirmed MEDIUM):** Current redesign shows monthly calendar + daily slots on ONE
  page ("choosing a day and time happens on the same page"). The form appears as a separate
  step/page. Still 2-phase, not simultaneous-column.
- **SavvyCal:** Calendar + time slots together; form as separate step.

**Conclusion:** No leading tool ships a simultaneous calendar+times+form 3-column layout as
default. The NSI v1.5 design is a genuine UX advancement — show the form column immediately
(even empty/prompt state) to eliminate the layout shift users experience when picking a slot.

**Recommended desktop layout (1024px+):**

```
+--------------------------------------------------+
| Header: account name · event name · duration     |
+--------------------------------------------------+
|                                                  |
|  CARD (max-w-5xl, rounded-2xl, border, bg-white) |
|  +--------------+------------+------------------+|
|  | CALENDAR     | TIMES      | FORM             ||
|  | col 1        | col 2      | col 3            ||
|  |              |            |                  ||
|  | shadcn       | Slot list: | Before pick:     ||
|  | Calendar     | 9:00 AM    | "Pick a time on  ||
|  | component    | 9:30 AM    |  the left to     ||
|  |              | 10:00 AM   |  continue."      ||
|  | ~280px       | ~160px     | After pick:      ||
|  |              |            | [Name field]     ||
|  |              |            | [Email field]    ||
|  |              |            | [Phone field]    ||
|  |              |            | [Custom Qs]      ||
|  |              |            | [Confirm button] ||
|  +--------------+------------+------------------+|
|                                                  |
+--------------------------------------------------+

Timezone hint: "Times shown in America/Chicago"
(full-width sibling ABOVE the card, per PUB-14 pattern)
```

**Column widths at key breakpoints:**

| Breakpoint | Total card | Calendar | Times | Form |
|------------|-----------|---------|-------|------|
| lg (1024px) | max-w-4xl (~896px) | ~280px (auto) | ~160px (fixed) | 1fr (remaining ~400px) |
| xl (1280px) | max-w-5xl (~1024px) | ~280px (auto) | ~180px (fixed) | 1fr (remaining ~500px) |

Tailwind implementation: `grid lg:grid-cols-[auto_180px_1fr]`
- Column 1 (calendar): `auto` — shadcn Calendar has intrinsic width (~280px); let it size naturally
- Column 2 (times): fixed `180px` — enough for "10:30 AM" + "2 spots left" badge
- Column 3 (form): `1fr` — fills remaining space; form content is fluid

**Mobile collapse order (stack vertically):**
```
1. Calendar (full width)
2. Time slots (full width, appears after date pick)
3. Form (full width, appears after slot pick)
```
No horizontal layout at mobile. Below `lg:` (1024px), the grid collapses to a single column
and items stack in DOM order: calendar → times → form. This matches the Cal.com mobile pattern
(progressive disclosure top-to-bottom) and preserves the current `justify-self-center` fix for
the calendar on mobile.

**Form-on-pick reveal: in-place with reserved space (NO layout shift):**

Recommended approach: **Reserve the form column with a "Pick a time" prompt.** The form column
is ALWAYS rendered in the DOM (a `<div>` with the full column width exists before slot pick).
Before pick, it shows a placeholder text ("Pick a time on the left to continue."). After pick,
`selectedSlot` becomes non-null and the `<BookingForm>` replaces the placeholder text **in-place**.

This is the "no layout shift" implementation: the column width is locked by the grid template
regardless of form content. The calendar and time columns do NOT reflow when the form appears.

Rationale for in-place over modal: the booking flow is a contained card, not a full page.
A modal would overlay the calendar/times the booker just used, breaking spatial context.
Animated slide-in (CSS translate from right) is acceptable as an enhancement but not required
for v1.5 — basic in-place swap is the table-stakes behavior.

**Empty state for form column before slot pick:**
Text only: "Pick a time on the left to continue." (current behavior from `booking-shell.tsx:102`)
This is correct. Do NOT add a skeleton loader here — a skeleton implies content is loading;
the form is not loading, it simply requires a slot selection to populate. A skeleton would
be misleading UX.

Do NOT add a timezone re-selector in the form column. The timezone hint lives above the card
as a full-width sibling (PUB-14 pattern, already shipped in v1.3). Duplicating it in the form
column creates confusion about which selector is authoritative.

Do NOT render Turnstile (bot-protection widget) before slot pick. Current behavior: Turnstile
renders inside `<BookingForm>`, which only mounts after `selectedSlot !== null`. This is correct
— rendering Turnstile before slot pick wastes bot-protection tokens and clutters the empty
form column. Preserve this behavior.

---

## Differentiators (v1.6+, Do Not Build in v1.5)

Features that would add competitive value but are out of scope for this milestone.

| Feature | Value Proposition | Why Defer |
|---------|------------------|-----------|
| Pre-event buffer (`buffer_before_minutes`) | Prep time before appointment; useful for consultants who need to review notes | Schema column exists (`event_types.buffer_before_minutes`); wiring requires `computeSlots` changes similar to post-buffer but is a separate feature. No user request yet. |
| Industry onboarding segmentation | Ask business type at signup, use to pre-populate event type templates | Requires schema column, analytics wiring, conditional UI. v1.5 scope is copy-only rebrand, not behavioral segmentation. |
| Animated form slide-in | CSS translate-x transition when form column content appears | Visual polish only; adds CSS complexity; no correctness benefit. Worth adding in a polish pass. |
| Buffer display for owner | Show "15 min buffer" badge on event type card in the owner list | Informational UI; low priority until owners actively request it. |
| Timezone auto-detection confirmation | "We detected America/Chicago — is that right?" dialog | Current behavior (silent detection + "Times shown in X" text) is sufficient. Modal adds friction. |
| Multiple reminder emails (24h + 1h) | Two reminders instead of one | Explicitly carried in PROJECT.md out-of-scope list. |
| Per-event-type availability schedules | Different availability windows for different event types | Explicitly out of scope for all v1.x per PROJECT.md. |

---

## Anti-Features (Explicitly NOT Building)

Features to deliberately skip. Listing rationale prevents scope creep.

| Anti-Feature | Why Not Build |
|---|---|
| Buffer affects displayed end-time in booker UI | `end_at` stores the raw booking window (`start_at + duration_minutes`). Displaying a buffer-extended end time to bookers would require either changing what `end_at` means (breaking the reschedule invariant and Phase 27 EXCLUDE constraint semantics) or computing a display-only extended end. No leading tool shows buffer to invitees — it is purely an owner scheduling aid. |
| Pre-event buffer (`buffer_before_minutes`) in v1.5 | The v1.5 scope is explicitly post-event buffer only. Pre-buffer complicates the migration (how much of `accounts.buffer_minutes` is "before" vs "after"?) and has no user request. The `buffer_before_minutes` column exists in the schema at 0 for all rows — leave it at 0 for now. |
| Industry/business-type question in onboarding | Adds schema, UX, and analytics requirements not in scope. Generic copy covers all verticals. |
| Minimum scheduling notice in the buffer UI section | `min_notice_hours` (account-level) already handles minimum notice. Exposing it in the event-type editor is a separate feature. Do not combine with post-buffer to avoid confusion between "how soon can someone book" and "how long after an event is blocked." |
| Timezone re-selector in form column | Timezone hint already lives above the card (PUB-14). Duplicating it inside the form column would create two competing selectors with unclear precedence. |
| Captcha/Turnstile visible before slot pick | Current behavior correctly renders Turnstile only inside `<BookingForm>` (after slot pick). Changing this would burn bot-protection tokens on users who may not complete the form. |
| Skeleton loader in empty form column | A skeleton implies loading state. The form column before slot pick is not loading anything — it is waiting for user input. A skeleton would be misleading. Use a plain text prompt instead. |
| Layout shift on slot pick | The 3-column grid must reserve column 3 space at all times. Revealing the form by adding a column (which shifts columns 1 and 2 left) or inserting a DOM node that pushes content down violates the "no layout shift" requirement. |
| Owner-facing "service type" badge or tag system | No design request, no user feedback. Premature categorization. |
| Audience copy on booker-facing surfaces | The rebrand is OWNER-FACING only. Booking pages, embed widget, and transactional emails must stay brand-neutral (contractor's brand, not NSI product copy). |

---

## Feature Dependencies

```
[Buffer migration: backfill event_types.buffer_after_minutes from accounts.buffer_minutes]
    └──required before──> [DROP accounts.buffer_minutes (CP-03 two-step)]
    └──required before──> [Update computeSlots to read event_types.buffer_after_minutes]
    └──required before──> [Update /api/slots route to pass event_types.buffer_after_minutes]
    └──required before──> [Add buffer_after_minutes UI to event type editor]

[3-column grid template change in booking-shell.tsx]
    └──required before──> [Form column in-place reveal (already works, just add reserved space)]
    └──does NOT affect──> [SlotPicker internals]
    └──does NOT affect──> [BookingForm internals]

[Rebrand copy changes]
    └──independent of buffer work]
    └──independent of layout work]
    └──touches same event-type editor as buffer UI → can batch]
```

---

## Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|-----------|---------------------|----------|
| Per-event-type post-event buffer | HIGH (NSI production account has buffer_minutes=15; rebrand opens to verticals with varying buffer needs) | MEDIUM (migration + computeSlots + /api/slots route + event-type editor UI + tests) | P1 |
| Drop accounts.buffer_minutes (CP-03) | MEDIUM (schema cleanup; prerequisite for correctness of per-event buffer) | LOW (follows migration; uses proven two-step drain protocol) | P1 |
| Owner copy rebrand (contractors → service-based businesses) | MEDIUM (unlocks new customer segments; prevents awkward positioning) | LOW (copy-only across ~6-8 surfaces; no schema/API changes) | P1 |
| Internal identifier rename | LOW (developer hygiene; no user-visible impact) | LOW (TypeScript rename refactor; no behavior change) | P2 |
| 3-column grid layout (booking-shell.tsx) | HIGH (Andrew specifically flagged current layout as "chaotic") | LOW (CSS grid template change; existing form reveal logic unchanged) | P1 |
| Form column reserved space (no layout shift) | MEDIUM (polish; prevents jarring reflow) | LOW (already reserved in current implementation — verify and lock) | P1 |
| Mobile stacking order (calendar → times → form) | HIGH (mobile is primary surface for service business customers) | LOW (DOM order already correct; verify no CSS reorder) | P1 |

---

## Competitor Feature Analysis

### Post-Event Buffer

| Behavior | Calendly | Cal.com | Acuity Scheduling | SavvyCal | NSI v1.5 |
|----------|---------|---------|------------------|---------|---------|
| Scope | Per event type | Per event type ("Limits" tab) | Per appointment type | Per link (global or per-link) | Per event type |
| UI section | "Limits and buffers" under "More options" | "Limits" tab in event editor | "Appointment types → Edit → Block off time after/before" | "Availability" section | Event type editor "Scheduling" or "Advanced" section |
| UI label | "Buffer time" (before/after) | Not confirmed (documented as buffer_before/buffer_after in API) | "Padding" (block off time before/after) | "Buffer Before" / "Buffer After" | "Buffer after event" |
| Units | Minutes | Minutes | Minutes | Minutes | Minutes |
| Default | 0 | 0 | 0 | 0 | 0 (backfilled from accounts.buffer_minutes) |
| Max | Not officially documented (360 reported in community) | Not confirmed | Not confirmed | Not confirmed | 360 (matches reported Calendly ceiling) |
| Booker visibility | No | No | No | No | No |
| End-time displayed | Raw end time only | Raw end time only | Raw end time only | Raw end time only | Raw end time only (buffer never in end_at) |

### Booker Layout

| Pattern | Calendly | Cal.com | Acuity (Monthly) | NSI v1.5 |
|---------|---------|---------|-----------------|---------|
| Desktop layout | Single page: calendar + daily slots together; form as separate step | MONTH_VIEW (sequential); COLUMN_VIEW = columns of days, not 3-panel | Calendar LEFT + times RIGHT (2-column); form as sequential step | 3-column: calendar LEFT + times MIDDLE + form RIGHT (simultaneous) |
| Form reveal | New page/step after slot pick | New step after slot pick | Sequential step | In-place, no layout shift |
| Mobile | Stacked, calendar-first | Stacked | Stacked | Stacked: calendar → times → form |
| Empty form state | N/A (form not shown until after slot) | N/A | N/A | Plain text: "Pick a time to continue." |

---

## Sources

- Cal.com Booker Atom docs: https://cal.com/docs/platform/atoms/booker (HIGH — official docs)
- Cal.com v3.0 announcement: https://cal.com/blog/v-3-0 (MEDIUM — official blog)
- Cal.com event settings guide: https://cal.com/blog/a-guide-to-cal-com-s-event-settings-and-features (MEDIUM — official blog, "Limits" tab confirmed)
- Calendly buffer help: https://calendly.com/help/how-to-use-buffers (MEDIUM — official help, section name "Limits and buffers" confirmed, units = minutes)
- Acuity buffer help: https://help.acuityscheduling.com/hc/en-us/articles/16676926857101 (LOW — 403 on direct fetch; confirmed via WebSearch summary: "Block off time before or after", per-appointment-type, minutes)
- Acuity layout: search result quote "Monthly template displays a calendar on the left, with the times for the selected day on the right" (MEDIUM — sourced from SavvyCal's Acuity guide)
- Calendly redesign layout: https://calendly.com/blog/new-scheduling-page-ui (MEDIUM — "choosing a day and time happens on the same page"; form is a separate step)
- SavvyCal buffer: https://docs.savvycal.com/article/26-configuring-buffers (MEDIUM — "Buffer Before" / "Buffer After" per-link; minute units confirmed)
- Codebase direct inspection: `lib/slots.ts`, `booking-shell.tsx`, `slot-picker.tsx`, `supabase/migrations/20260419120000_initial_schema.sql`, `supabase/migrations/20260425120000_account_availability_settings.sql` (HIGH — direct inspection, no inference)

---

*Feature research for: calendar-app v1.5 Buffer Fix + Audience Rebrand + Booker Redesign*
*Researched: 2026-05-03*
