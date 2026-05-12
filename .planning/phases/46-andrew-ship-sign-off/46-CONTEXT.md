# Phase 46: Andrew Ship Sign-Off - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Live end-to-end UAT of v1.8 (Stripe paywall, multi-tier checkout, widget gating, Customer Portal, login UX polish, Gmail quota raise) against the production deployment in Stripe test mode, plus FUTURE_DIRECTIONS.md update, plus dormant `schema_migrations` repair, plus v1.8 ROADMAP archive + git tag. No new feature code; any code change in Phase 46 is a fix-on-failure sub-plan triggered by UAT.

Rolls up:
- 14-scenario ROADMAP checklist (Phase 46 SC + full QA checklist)
- Phase 44 deferred items: Portal end-to-end cancel, trial-will-end email delivery, payment-failed email delivery
- Phase 45 deferred items: OAuth-below-Card visual on /app/login + /app/signup, 3-fail nudge end-to-end with real Supabase 400s, Gmail quota 400/day under load

</domain>

<decisions>
## Implementation Decisions

### UAT structure & sequencing
- **Single linear checklist** — one ordered list of scenarios in 46-VERIFICATION.md, top-to-bottom in one session (with pauses for PREREQ-C, see below)
- **nsi grandfathered account only** — exercise UAT against the existing trialing `nsi` test account; no fresh signup creation. (Note: trigger-path verification for new signups was already exercised in Phase 41 SC-1..4 and Phase 42.5 SC-1..6; not re-run here.)
- **State flips via Supabase MCP** — use `apply_migration` / `execute_sql` to flip `subscription_status`, `cancel_at_period_end`, `trial_ends_at`, `plan_tier` directly between scenarios. Mirrors Phase 43 UAT pattern. Exception: Phase 44 Stripe lifecycle scenarios use real Stripe-triggered events (see Email UAT below).
- **All 4 checkout paths exercised live** — Basic-Monthly, Basic-Annual, Widget-Monthly, Widget-Annual each end-to-end with Stripe test card. Confirms tier×interval resolution end-to-end despite Phase 42.5 SC-5a/5b already proving 2 of the 4 in test mode.
- **Deferred items interleaved by domain** — Phase 44 email items appear in the Portal/email section; Phase 45 login UX items appear in the login section. One coherent flow, not a separate "deferred" appendix.

### PREREQ-C handling
- **Hard block** — Phase 46 UAT cannot begin until Andrew completes Customer Portal Dashboard config in Stripe (plan-switching enabled across all 4 Prices on the single Product). Andrew is the gatekeeper; Claude cannot complete this step.
- This means the first action in Phase 46 is a PREREQ-C checklist surfaced to Andrew, not a scenario run.

### Email UAT (Phase 44 deferred)
- **Real Stripe trigger + inbox check** for both trial-will-end and payment-failed scenarios. Trigger via Stripe CLI or Dashboard against the nsi account; verify email lands in Andrew's owner inbox (Gmail provider for nsi).
- Server-log inspection is NOT required separately — inbox arrival proves the V18-CP-12 inner try/catch did not swallow a real error.

### Login UX UAT (Phase 45 deferred)
- **All three live-tested:**
  1. Visual confirm OAuth button position on both `/app/login` and `/app/signup` (must be BELOW the email/password Card with divider)
  2. Type 3 wrong passwords against real Supabase against the nsi credentials → confirm inline magic-link nudge appears; click it → confirm tab switches and email is pre-filled
  3. Confirm Gmail quota delivers 400/day under load — exercised by attempting send #401 through the booking flow and confirming `RefusedSend` with quota-exhausted reason. (Full 400-send burn is impractical against a live account; the threshold transition at 400→401 is the meaningful check.)

### Sign-off mechanics
- **Inline checklist in 46-VERIFICATION.md** — per-scenario ✅/❌ checkboxes with one-line note each. Mirrors Phase 43/45 pattern. Single artifact.
- **100% pass required** — every scenario in the ROADMAP checklist + all rolled-up deferred items must pass. No "polish defects allowed" tolerance. Any fail blocks ship.
- **Failure handling: fix in Phase 46 sub-plans** — open 46-01, 46-02 etc. as needed for each fix. Phase 46 grows organically. v1.8 not shipped until all sub-plans green and re-run scenario passes. (NOT decimal phases — 46.1/46.2 reserved for true scope expansion.)
- **Ship signal: git tag v1.8.0 + ROADMAP update** — Andrew issues explicit approval → Claude tags `v1.8.0` → ROADMAP.md v1.8 milestone marked ✅ shipped → ROADMAP archived to `milestones/v1.8-ROADMAP.md`.

### FUTURE_DIRECTIONS.md
- **v1.8 delta only** — append v1.8 section to existing FUTURE_DIRECTIONS.md (or create if missing). Do NOT rewrite prior milestone sections. Keeps doc tight; preserves history.
- **Known limitations to capture (4 categories required):**
  1. **Branding tier non-Stripe path** — consult-only via `NSI_BRANDING_BOOKING_URL`; no in-app upgrade flow, no `plan_tier='branding'`; future build-out post-v1.8
  2. **BILL-24 partial (2/4 emails)** — `account-locked` + `welcome-to-paid` deferred per Phase 44 CONTEXT scope narrowing; documented as known gap
  3. **PREREQ-03 Resend domain DNS activation** — Phase 36/37 framework shipped but live activation gated on DNS; carry forward unchanged
  4. **Stripe API version pin (LD-01)** — `stripe@22.1.1` + `apiVersion: '2026-04-22.dahlia'` pinned forever; document rationale + revisit trigger (when SDK forces upgrade)

### Migration sync repair
- **Repair in Phase 46** — add a sub-plan that registers the dormant `schema_migrations` entries for phases 36/37/41 (and any others discovered during pre-tag audit) so `supabase db push --linked` cannot re-run + fail on column-already-exists. Cleans tech debt before v1.8 archive.
- Risk: mis-registering breaks future migrations. Mitigation: dry-run via MCP `execute_sql` SELECT against `schema_migrations` first; only INSERT entries that match columns actually present in production.

### v1.8 archive
- **`milestones/v1.8-ROADMAP.md`** — copy v1.8 phase details from ROADMAP.md into the new archive file; collapse ROADMAP.md v1.8 section to a one-line summary mirroring v1.0..v1.7 entries. No separate `v1.8-SIGNOFF.md`; the 46-VERIFICATION.md inline checklist is the audit trail.

### Claude's Discretion
- Exact wording / ordering within the single linear checklist (as long as it covers all SC + rolled-up items)
- Format of MCP-flip SQL stubs surfaced to Andrew (one-liner per scenario vs. grouped script)
- VERIFICATION.md frontmatter exact field shape (mirror Phase 43/45 conventions)
- Stripe CLI invocations for email-trigger events (specific event-fixture choice)
- Whether to include grep regressions for LD-01..LD-20 invariants in the final checklist as static-evidence cross-references

</decisions>

<specifics>
## Specific Ideas

- Mirror Phase 43 UAT pattern: Supabase MCP state flips while Andrew is logged in on production. He approved that flow ("approved" 2026-05-11 on Phase 42.6, plus full live walkthrough on Phase 43).
- Mirror Phase 45 VERIFICATION.md frontmatter conventions (status, signoff_by, signoff_at).
- The PREREQ-C hard block should surface as the FIRST item of Phase 46 to Andrew — explicit checklist before anything else runs.
- Stripe test mode card numbers: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0341` triggers `payment_failed` on subscription attempt (canonical Stripe test cards).
- Gmail 400/day cap UAT: rather than burn 400 real sends, confirm the threshold transition by manipulating `email_send_log` count via MCP to 399 → next send succeeds, then 400 → next send refused with quota-exhausted reason.

</specifics>

<deferred>
## Deferred Ideas

- **CHANGELOG.md + customer announcement** — considered as part of ship signal; deferred. Andrew can compose externally if/when NSI has customers needing notification. Not a v1.8 blocker.
- **Fresh-signup-driven UAT coverage** — covered already by Phase 41 SC-1..4 and Phase 42.5 SC-1..6; not re-run in Phase 46. If a future regression suggests trigger drift, open a v1.9 phase.
- **Branding tier in-app upgrade flow** — explicit v1.9+ feature; captured in FUTURE_DIRECTIONS.md only.
- **v1.9 placeholder phase for migration tech debt** — superseded by in-phase repair decision; no v1.9 placeholder needed.

</deferred>

---

*Phase: 46-andrew-ship-sign-off*
*Context gathered: 2026-05-12*
