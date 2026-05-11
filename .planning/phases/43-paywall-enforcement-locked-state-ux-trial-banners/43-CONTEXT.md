# Phase 43: Paywall Enforcement + Locked-State UX + Trial Banners - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce subscription gating on `/app/*` via middleware extension (inside the existing `pathname.startsWith('/app')` branch in `lib/supabase/proxy.ts`), surface trial countdown / urgency / past-due state via banners on `/app/*`, and shape the locked-state experience on `/app/billing` for owners whose subscription is neither `trialing` nor `active`. The public booker (`/[account]/*`) and embed (`/embed/*`) routes are structurally exempt — LD-07 booker-neutrality is mandatory and verified pre-merge.

Tier is irrelevant to the paywall gate — paywall is tier-agnostic per the v1.8 milestone goal. Widget gating (Phase 42.6) and Customer Portal (Phase 44) are separate phases; this phase does NOT touch them.

</domain>

<decisions>
## Implementation Decisions

### Trial banner UX

- **Not dismissible.** Banner is always visible on every `/app/*` page during the 14-day trial — no X button, no localStorage persistence. Owner cannot hide trial countdown.
- **Countdown format:** `"Trial ends in N days"` — whole-day precision only. Day 0 = `"Trial ends today"`. Do NOT include the explicit `trial_ends_at` date.
- **Two tiers of treatment:**
  - **Neutral** (N > 3): plain informational tone.
  - **Urgency** (N ≤ 3): visually distinct (color and/or copy intensification) per BILL-17.

### Claude's Discretion

The following are intentionally left to Claude during planning/implementation — Andrew explicitly delegated each:

- **Banner placement** — top sticky vs inline below header. Pick whichever fits the existing app shell architecture best (Phase 12/12.6 brand work, Phase 15 header pill).
- **Neutral banner CTA placement** — inline link in copy vs separate button on the right. Pick based on visual balance.
- **Urgency banner visual treatment** — color (amber vs red vs brand), icon usage, banner size/height differential. Use the NSI palette established in Phase 12/12.6.
- **Urgency banner CTA** — prominent button vs same-as-neutral pattern.
- **Urgency banner copy** — final wording; the requirement (BILL-17) is "tone/urgency shift," not a locked string.
- **Past-due banner tone** — reassuring (acknowledge Stripe auto-retry) vs action-prompting (push to update card). Pick whichever matches the actual past-due retry window UX (~3 weeks dunning) and NSI brand voice.
- **Past-due banner CTA** — link to `/app/billing` vs informational only. The Customer Portal CTA itself lives in Phase 44; Phase 43 does NOT add a Portal button. A simple link to `/app/billing` is acceptable as a placeholder.
- **Past-due + trial collision** — verify during research whether a `trialing` account can also be `past_due` per Stripe's state machine. Most likely impossible (past_due only after active billing has failed), so probably no design needed. If it IS possible, past-due wins (signals real problem).
- **Locked-state shell** — full shell with header+nav (where nav links bounce back to `/app/billing`) vs stripped shell (header only, no nav). Pick based on existing shell composition.
- **Logout button on locked-state page** — assumed YES (owners must always be able to leave). Verify the existing header includes logout and that it remains accessible to locked accounts. If not, surface it.
- **Deep-link return-URL preservation** — recommend NOT preserving (`/app/event-types` → `/app/billing` with no return query). After unlock, owner navigates manually. Adds complexity for marginal benefit; only revisit if Andrew flags missing during QA.
- **Locked-state copy gating** — show "Everything is waiting for you! Head over to payments to get set up." ONLY when `subscription_status` ∉ `{trialing, active}`. Trialing/active owners visiting `/app/billing` see just the 3-card grid (already shipped in Phase 42.5), not the locked-state headline.
- **Exact final wording** for the neutral trial banner. BILL-16 gives the direction ("Trial ends in N days. Head over to payments to get set up.") but is explicitly "final wording in plan."

### Hard constraints (do not relitigate)

- **LD-07 booker-neutrality:** Paywall lives EXCLUSIVELY inside the existing `pathname.startsWith('/app')` branch in `lib/supabase/proxy.ts`. `/[account]/*` and `/embed/*` MUST NOT be touched. Verification gate is mandatory pre-merge (V18-CP-05).
- **LD-08 past-due retains access:** `past_due` accounts hit no redirect, just a banner. They reach `/app/dashboard` and every other `/app/*` page normally.
- **`/app/billing` exemption from redirect:** Locked accounts MUST be able to reach `/app/billing` (otherwise the redirect loops). Middleware must check `pathname !== '/app/billing'` before redirecting.
- **Webhook exemption (carried from Phase 41):** `/api/stripe/webhook` MUST remain exempt from the paywall middleware auth gate — Stripe servers, not authenticated users, invoke it. This is plumbing, not new work, but the Phase 43 middleware changes must not break it.
- **Existing-account grandfather:** Andrew's `nsi` test account + the 5 v1.7 grandfathered accounts have `subscription_status = 'trialing'` from Phase 41 migration. They MUST NOT be locked out on Phase 43 deploy day. V18-CP-06 check is mandatory.
- **Status set for lockout:** `subscription_status` NOT IN (`'trialing'`, `'active'`) → redirect. Concretely that means `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`, plus anything else Stripe surfaces that isn't trialing/active. `past_due` is explicitly NOT in this set (LD-08).

</decisions>

<specifics>
## Specific Ideas

- The neutral banner copy direction from BILL-16 ("Trial ends in N days. Head over to payments to get set up.") is a starting point, not a locked string. Adapt wording to match the final visual layout (e.g., inline-link vs button-CTA).
- The locked-state copy ("Everything is waiting for you! Head over to payments to get set up.") IS Andrew's spec per BILL-19 — keep that wording verbatim above the 3-card grid in the locked-only branch.
- Brand palette and shell components are already established in Phases 12, 12.6, 14, 15 — reuse them. Don't invent new tokens for this phase.
- `/app/billing` already has the 3-card TierGrid from Phase 42.5 — Phase 43 only ADDS a conditional locked-state headline above it. Don't refactor the cards.

</specifics>

<deferred>
## Deferred Ideas

- **Customer Portal "Manage payment" CTA in past-due banner** — belongs in Phase 44 (Customer Portal + Billing Polish). Phase 43 past-due banner uses generic copy/link only.
- **Return-URL preservation on locked redirect** — explicitly NOT in scope. If Andrew finds it missing during QA, can be added as a follow-up phase or v1.8 polish.
- **Trial-extension flow** (admin manually grants +N days) — not in scope; no requirement covers it.
- **In-app upsell from Basic → Widget for current customers** — separate from paywall enforcement; would be a feature flag UI phase.

</deferred>

---

*Phase: 43-paywall-enforcement-locked-state-ux-trial-banners*
*Context gathered: 2026-05-11*
