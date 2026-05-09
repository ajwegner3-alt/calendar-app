# Phase 39: BOOKER Polish - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

After a slot is picked on the public booker, the booking-form column animates in smoothly; before any slot is picked, that column shows a shape-only skeleton placeholder (no false loading spinner, no empty white space). The animation respects OS `prefers-reduced-motion`. Layout shift (CLS) stays at 0.0. The V15-MP-05 Turnstile lifecycle lock is preserved — `BookingForm` is absent from the DOM until a slot is picked, and the Turnstile token does not stale on slot re-pick.

In scope: skeleton component, entry animation, re-pick interaction, reduced-motion fallback, mobile behavior — all on the existing public booker `/{accountSlug}/{eventSlug}` route.

Out of scope: backend changes, slot-picking logic itself, form field set, Turnstile widget integration changes, embed widget changes (any embed-only polish belongs in its own phase).

</domain>

<decisions>
## Implementation Decisions

### Animation choreography
- **Direction: fade + slight upward rise.** Form column enters with `opacity 0 → 1` plus a subtle ~8px upward `translateY`. No slide-from-side, no scale.
- Easing curve: **Claude's Discretion** (suggested default: `cubic-bezier(0.16, 1, 0.3, 1)` ease-out-expo, but standard `ease-out` is acceptable).
- Exact duration inside the 200-250ms band: **Claude's Discretion** (suggested default: 220ms).
- Internal field stagger: **Claude's Discretion** — strong recommendation to animate the form as a single unit (no per-field stagger) because stagger inside a 200-250ms window tends to feel jittery; revisit only if the unified version feels flat.

### Skeleton design
- Shape literalness (mirror real form vs abstract blocks vs hybrid): **Claude's Discretion** — recommendation: hybrid (right number of blocks + right vertical rhythm to guarantee zero CLS, without pixel-mirroring every input).
- Motion on the skeleton itself (pulse/shimmer vs static): **Claude's Discretion** — flag the semantic risk: we are NOT loading, we are waiting on user input. A pulse/shimmer reads as "system is doing work", which is misleading. Lean static unless a strong reason emerges.
- Helper copy ("Pick a time to continue") inside the skeleton: **Claude's Discretion**.
- Mobile behavior (skeleton visible below calendar vs hidden until pick): **Claude's Discretion** — recommendation: same skeleton stacked below the calendar so the form-column footprint is reserved on first paint, eliminating CLS when the form arrives.

### Re-pick behavior
- Re-animation on slot change after form is already showing: **Claude's Discretion** — strong recommendation: NO re-animation; just update the in-form slot label. Reasoning: re-animation typically requires unmount/remount, which would break V15-MP-05 (Turnstile widget re-initializes, token stales, user re-solves). If any visual feedback is wanted, restrict it to a brief flash/pulse on the slot-label text only — never on the form container.
- Deselect (un-pick a slot to return to skeleton): **Honor whatever the booker does today.** Do NOT introduce a new deselect path in this phase; if no deselect exists, leave it absent.
- First-pick transition (skeleton → form): **Claude's Discretion** within the 200-250ms ceiling — recommendation: crossfade (skeleton `opacity 1 → 0` and form `opacity 0 → 1` simultaneously, both occupying the same grid cell).
- **LOCKED — Field-value persistence on re-pick: YES.** When a user has typed name/email/notes and then picks a different slot, every entered value persists. Only the displayed slot label changes. Treat this as an inviolable UX guarantee — it is the primary reason re-animation must not re-mount the form.

### Reduced-motion fallback
- First-pick under reduced-motion: **Claude's Discretion** — recommendation: instant swap (skeleton vanishes the same frame the form appears, no transition). Matches Success Criteria #3 verbatim.
- Skeleton motion under reduced-motion: **Claude's Discretion** — strict default: any pulse/shimmer is disabled when `prefers-reduced-motion: reduce` matches.
- Re-pick under reduced-motion: **Claude's Discretion** — should mirror whatever the non-reduced-motion re-pick does (which is "no re-animation" per the recommendation above), so likely no special case is needed.
- Detection method: **Claude's Discretion** — recommendation: pure CSS `@media (prefers-reduced-motion: reduce)` whenever sufficient; only reach for JS `matchMedia` if the design needs to swap component identity (e.g. drop the skeleton component entirely under RM), which the recommended designs above do not require.

### Claude's Discretion (summary)
The following are explicitly delegated to the planner/builder:
- Easing curve, exact duration, field stagger
- Skeleton literalness, motion, helper copy, mobile behavior
- Re-pick visual feedback choice and first-pick transition style
- All reduced-motion implementation specifics within the success criteria

</decisions>

<specifics>
## Specific Ideas

- The Turnstile lifecycle lock from V15-MP-05 is the single hardest constraint. Any approach that re-mounts `BookingForm` on slot change is wrong. The animation approach must be compatible with mounting once on first slot pick and never unmounting again.
- "Pure UI, zero backend" — no schema changes, no server actions, no email/auth touch. If research surfaces a need to change anything outside `app/(booker)/...` or its components, escalate before planning.
- Success Criteria #1 demands `transform`/`opacity` only — no animating `width`/`height`/`top`/`left`/`margin`/`padding`. The skeleton-to-form transition must use the same grid cell so geometry never changes.
- Success Criteria #4 must be verifiable: React DevTools should show `BookingForm` absent before pick, present and stable across re-picks.

</specifics>

<deferred>
## Deferred Ideas

- **Slot deselect with a return-to-skeleton transition** — not added in this phase per scope guardrail; if a future need emerges, design as its own polish phase including the Turnstile teardown semantics.
- **Embed-widget animation parity** — any animation work specifically for the embedded widget surface belongs in a separate phase if not naturally covered by the same component.
- **Field-level micro-interactions** (per-field focus ring polish, error-state animation) — out of scope for this phase, which is strictly about the column-level skeleton-to-form reveal.

</deferred>

---

*Phase: 39-booker-polish*
*Context gathered: 2026-05-08*
