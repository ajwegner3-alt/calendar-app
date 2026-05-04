# Phase 29: Audience Rebrand - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace "trade contractors" framing with a "service businesses" audience across owner-facing copy (`auth-hero.tsx` defaults + callsites) and developer-facing docs (`README.md`, `FUTURE_DIRECTIONS.md`). Booker-facing surfaces (public booking form, slot picker, embed widget, the 6 transactional emails) stay brand-neutral — the contractor's brand shows there, not NSI product copy. This is a **stale-copy cleanup**, not an active marketing repositioning; the goal is to stop reading too narrow on paper, not to actively widen reach.

</domain>

<decisions>
## Implementation Decisions

### Audience phrasing
- Canonical replacement is **"service businesses"** (not "service-based businesses" — tighter, drops the hyphenated modifier).
- Phrase consistency across surfaces is **Claude's discretion** — surfaces may phrase the surrounding copy differently as long as the audience term itself stays consistent.
- Tone is stale-copy cleanup, not repositioning — copy should not oversell a "bigger tent" or signal active outreach to new verticals.

### auth-hero.tsx scope
- Swap audience word in subtext default (line 21) and tighten the feature list while in there (Claude's discretion on what to trim — keep it punchy).
- **Drop the audience phrase from line 42 tagline** — change `Built for trade contractors, by NSI in Omaha.` → `Built by NSI in Omaha.` Subtext above carries audience messaging; tagline doesn't need to repeat it.
- **Headline only in scope if it names the audience** — if the rendered headline contains "trade contractors" or contractor-specific framing, swap it; otherwise leave it untouched.
- **Update defaults AND grep all callsites** — Phase 29 ends only when grep returns 0 matches in `app/` callsites that pass `trade contractors` (or related audience strings) to `<AuthHero>`. Defaults-only is insufficient.
- No broader hero polish (layout, color, structure) — that would be its own phase.

### README.md
- Replace opening line with **audience-led structure** (audience is the lead, not the hook), but **remove competitor reference** — drop the "Calendly-style" comparison. Something shaped like: `Multi-tenant booking tool for service businesses.`
- **Drop the "(plumbers, HVAC, roofers, electricians)" parenthetical entirely** — "service businesses" is self-explanatory; specific verticals are no longer called out in README.

### FUTURE_DIRECTIONS.md depth
- **Full audience scrub** — touch every audience-referencing token, not just literal `trade contractor`. In scope: `trade contractor`, audience-context `contractor(s)`, `contractor use case`, etc.
- **Edit historical prose to current audience** — even decision-record / past-tense content gets rewritten for consistency. The document is forward-looking by name; consistency wins over historical fidelity.
- Out of scope: phrases like "the contractor's brand" that describe the booker-facing pattern (where the customer's own brand surfaces in emails/widgets). Those describe the owner's brand-neutral booker experience, not the audience.

### booking-form.tsx:138 (deviation note)
- Andrew opted to **re-evaluate** the LD-07 lock that originally placed `booking-form.tsx:138`'s inert developer comment out of scope. The dev comment is **now in scope** — if it's an audience reference, scrub it as part of the full pass.
- **Planner: document this as a deliberate deviation from LD-07** in PLAN.md so the lock-override is auditable.

### Grep gate
- **Gate definition deferred to planning** — Claude picks the canonical grep gate at plan time based on the chosen full-scrub depth. The roadmap default (`grep -rn "trade contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md = 0`) is too narrow given the full-audience-scrub decision; planner should likely include `contractor` audience-context matches and may need an allowlist for legitimate `contractor's brand` booker-prose references.

### Verification
- **No live smoke required.** Grep-clean is sufficient close for this phase. Copy-only change; no behavior to eyeball. Departs from the v1.4 "deploy-and-eyeball" default for this phase only.

### Claude's Discretion
- Exact wording of the new auth-hero subtext (audience swap + feature-list trim).
- Whether to keep, tighten, or restructure the README opening sentence (as long as it's audience-led and contains no competitor name).
- The canonical grep gate definition (locked in PLAN.md, not CONTEXT.md).
- Allowlist construction for legitimate `contractor's brand` booker-prose references that should NOT trigger the gate.
- Whether any specific FUTURE_DIRECTIONS edits read better as a structural rewrite vs a token swap.

</decisions>

<specifics>
## Specific Ideas

- "We shouldn't refer to another service directly" — **no competitor name in README** (drop "Calendly-style"). General principle: keep marketing copy non-comparative.
- Tone preference: stale-copy cleanup, not repositioning. Don't oversell the audience widening.
- Audience term should be tight: "service businesses" beats "service-based businesses".

</specifics>

<deferred>
## Deferred Ideas

- **Hero refresh / restructure** — any non-audience polish to `auth-hero.tsx` (layout, headline rewrite when it doesn't name the audience, visual treatment) is its own phase.
- **Live smoke checkpoint** — explicitly skipped here; grep-clean is the close. If a future phase touches auth-hero copy non-trivially, smoke can return.

</deferred>

---

*Phase: 29-audience-rebrand*
*Context gathered: 2026-05-04*
