---
phase: 23-public-booking-fixes
verified: 2026-05-02T20:00:00Z
status: human_needed
score: 4/4 must-haves verified (structural)
human_verification:
  - test: "Mobile calendar centering (<768px)"
    expected: "The slot-picker calendar widget on /[account]/[event-slug] appears horizontally centered within the booking card with no left or right bias at a narrow mobile viewport"
    why_human: "mx-auto on a w-fit element is structurally correct. Live render needed to confirm no ancestor overflow-hidden or card padding causes unexpected grid-cell narrowing."
  - test: "Desktop timezone hint placement (>=1024px)"
    expected: "On a wide desktop viewport the Times shown in [tz] label renders as a full-width header above the two-column calendar+slot grid with no visual overlap of the calendar widget"
    why_human: "React fragment with the p element hoisted before the grid div is confirmed in source. Visual confirmation requires a live render to rule out inherited max-width constraints."
  - test: "/[account] listing page loads and displays event-type cards"
    expected: "Visiting /nsi shows ListingHero with logo/name, then one card per active event type with name, duration badge, and Book CTA; clicking a card navigates to /[account]/[event-slug]"
    why_human: "Component wiring and data loader are structurally verified but rendering requires a live Supabase connection with real account data."
  - test: "Event-type card routes to existing slot-picker (no v1.2 regression)"
    expected: "Clicking a card on /[account] opens the slot-picker; the slot list, capacity badges, empty-state messages, and loading state all render correctly"
    why_human: "Conditional ladder and capacity badge rendering confirmed structurally preserved. Requires live navigation to confirm no rendering regression."
---
# Phase 23: Public Booking Fixes -- Verification Report

**Phase Goal:** The public-facing booker experience renders correctly across viewports and provides a discoverable entry point at the account root -- no off-center calendars, no overlapping helper text, and no dead-end landing page when a booker hits /[account] without knowing the event slug.

**Verified:** 2026-05-02T20:00:00Z
**Status:** human_needed -- all structural checks pass; 4 items need live viewport/browser verification
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Mobile (<768px) calendar is horizontally centered within the booking card | VERIFIED (structural) | className includes mx-auto at slot-picker.tsx:143; shared components/ui/calendar.tsx untouched (w-fit root preserved) |
| 2 | Desktop (>=1024px) timezone hint renders full-width above the grid, not overlapping the calendar column | VERIFIED (structural) | Fragment root at slot-picker.tsx:121; timezone p element at line 122 is first child before div.grid at line 125 |
| 3 | /[account] renders a landing page listing every public event type as a selectable card with logo, name, duration, and CTA routing to /[account]/[event-slug] | VERIFIED (structural) | app/[account]/page.tsx fully wired: ListingHero (logo+name), EventTypeCard (name+duration badge+Book CTA, whole-card Link), AccountEmptyState (no 404 for real accounts); data loader applies is_active=true, deleted_at IS NULL, order created_at ASC |
| 4 | Clicking event-type card reaches existing slot-picker with no regression to v1.2 booking flow | VERIFIED (structural) | Conditional ladder intact (loading then fetchError then not selectedDate then empty then slots), capacity badges (remaining_capacity), isCompletelyEmpty early return all preserved at slot-picker.tsx:97-196 |

**Score:** 4/4 structural truths verified. Human viewport confirmation pending per project pattern.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| app/[account]/page.tsx | generateMetadata returning title in locked format | VERIFIED | Line 25: title string matches CONTEXT lock exactly; old Book a time string has zero matches |
| app/[account]/[event-slug]/_components/slot-picker.tsx | mx-auto on Calendar + timezone hint hoisted as fragment first-child | VERIFIED | Line 143: className includes mx-auto; Lines 121-125: fragment opens with timezone p before grid div |
| app/[account]/_components/event-type-card.tsx | Whole-card Link to /[account]/[event-slug] + duration badge + Book CTA | VERIFIED | Line 45: Link wraps entire card; line 51: duration badge; line 60: Book CTA |
| app/[account]/_components/listing-hero.tsx | Logo or initial-circle fallback + account name | VERIFIED | Lines 29-41: conditional logo img with brand-colored initial fallback; h1 with accountName |
| app/[account]/_components/empty-state.tsx | Empty state (not 404) when no active events | VERIFIED | Renders No bookings available right now with optional owner email; no notFound() call |
| app/[account]/_lib/load-account-listing.ts | is_active=true, deleted_at IS NULL, order created_at ASC | VERIFIED | Lines 35-37: exact filter chain confirmed |
| components/ui/calendar.tsx | NOT modified in phase 23 | VERIFIED | git log shows only phase-4 initial add commit; git diff HEAD yields 0 lines |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| page.tsx generateMetadata() | Browser title on /[account] | Next.js App Router metadata API | VERIFIED | Title string at line 25 matches CONTEXT lock; old pattern absent |
| Calendar instance in slot-picker.tsx | mx-auto centering within grid cell | className prop merged via shadcn cn() | VERIFIED | mx-auto present; shared calendar.tsx w-fit root unchanged |
| Timezone p element in slot-picker.tsx | Full-width DOM position above grid | JSX fragment: p as sibling-before grid div | VERIFIED | Main return at line 120 opens fragment at line 121; p at 122; grid div at 125 |
| EventTypeCard in page.tsx | /[account]/[event-slug] route | Link href wrapping whole card | VERIFIED | href using accountSlug and event.slug at event-type-card.tsx:46 |
| loadAccountListing | Supabase event_types filtered correctly | .eq(is_active true).is(deleted_at null) | VERIFIED | load-account-listing.ts:35-37 |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| PUB-13 -- mobile calendar centered | VERIFIED (structural) | mx-auto added to Calendar instance; shared component untouched; visual check deferred |
| PUB-14 -- desktop timezone hint not overlapping calendar | VERIFIED (structural) | Timezone p hoisted above grid via React fragment; visual check deferred |
| PUB-15 -- /[account] landing page with event-type cards | VERIFIED (structural) | Full stack confirmed: data loader, cards, routing, empty state, generateMetadata title all correct |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | -- | -- | -- | -- |

No TODO/FIXME/placeholder/stub patterns detected in either modified file. No empty handlers. No return null stubs in phase-23 surfaces.

---

### Human Verification Required

#### 1. Mobile Calendar Centering (PUB-13, Success Criterion 1)

**Test:** Open /[account]/[event-slug] on a real device or browser devtools mobile viewport narrower than 768px (e.g., iPhone SE at 375px).
**Expected:** The calendar widget appears horizontally centered in the booking card -- no leftward drift, equal spacing on both sides.
**Why human:** mx-auto centers a w-fit element within its block container. Structurally correct. Live render needed to confirm no ancestor overflow-hidden, max-content width, or card padding causes the grid cell to be narrower than expected.

#### 2. Desktop Timezone Hint Placement (PUB-14, Success Criterion 2)

**Test:** Open /[account]/[event-slug] in a browser at 1024px or wider.
**Expected:** Times shown in [TZ] appears as a single full-width text line above the two-column calendar+slot area -- not squeezed into the right column, not overlapping the calendar widget.
**Why human:** Fragment root structure confirmed in source. Visual confirmation that the hint reads as a page-level header requires an actual render.

#### 3. Account Index Listing Page (PUB-15 -- functional, Success Criterion 3)

**Test:** Visit /nsi (or your account slug) in a browser.
**Expected:** Page loads with ListingHero (logo or initial circle + account name), followed by one card per active event type. Each card shows event name, duration badge, and Book CTA. Clicking any card navigates to /nsi/[event-slug].
**Why human:** Full data path (Supabase admin client to accounts to event_types) requires a live DB connection with real data.

#### 4. Slot-Picker No-Regression Check (Success Criterion 4)

**Test:** From the account index, click through to a specific event type. On the slot-picker page: (a) confirm Times shown in [TZ] appears above the calendar; (b) before selecting a date confirm Pick a date to see available times. appears in the right/lower column; (c) select a date with available slots and confirm the slot list appears; (d) if a capacity-limited event type exists, confirm the N spots left badge renders on the slot button.
**Expected:** All four states function correctly with no layout regression.
**Why human:** Requires live slot data from Supabase and actual interaction with the calendar and slot list components.

---

### Gaps Summary

No structural gaps found. All four must-have truths are satisfied by the codebase:

- app/[account]/page.tsx generateMetadata title exactly matches the CONTEXT lock; old string absent.
- Calendar className includes mx-auto; components/ui/calendar.tsx is untouched.
- Timezone hint is a React fragment first-child above the grid wrapper, appearing exactly once in the file.
- isCompletelyEmpty early return, loading/error/empty/slots conditional ladder, and capacity badge rendering are all preserved -- no v1.2 regression introduced.

The only items preventing a passed verdict are the four human viewport verifications above, which are explicitly deferred to the deploy-and-eyeball gate per the project pattern documented in both PLAN files.

---

_Verified: 2026-05-02T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
