---
phase: 46-andrew-ship-sign-off
plan: "46-04"
subsystem: project-docs
tags: [archival, roadmap, milestone, future-directions, v1.8]
requires: ["46-01", "46-02", "46-03"]
provides:
  - "FUTURE_DIRECTIONS.md v1.8 delta section"
  - ".planning/milestones/v1.8-ROADMAP.md full milestone archive"
  - ".planning/ROADMAP.md v1.8 collapsed one-liner"
affects: ["46-05"]
key-files:
  created:
    - .planning/milestones/v1.8-ROADMAP.md
  modified:
    - FUTURE_DIRECTIONS.md
    - .planning/ROADMAP.md
completed: 2026-05-16
duration: single-session
---

# Phase 46 Plan 04: v1.8 Archival Documents Summary

**One-liner:** Produced the three durable v1.8 ship artifacts — FUTURE_DIRECTIONS.md v1.8 delta, the `milestones/v1.8-ROADMAP.md` full archive, and the collapsed ROADMAP.md v1.8 one-liner — corrected for the 2026-05-15 billing-park scope change and the 2026-05-16 Phase 36/37 email-outage migration fix.

## What Was Done

### Task 1 — FUTURE_DIRECTIONS.md v1.8 delta appended
Appended a new `## v1.8 Stripe Paywall + Login UX Polish — Delta` section after the last existing section (`## Phase 36: Resend Backend — Activation Steps`). No prior section renumbered or rewritten. Shipped date set to 2026-05-16. The section captures the billing-park callout block, 5 Known Limitations (paywall parked, Branding consult-only, BILL-24 partial, PREREQ-03 DNS, Stripe API pin), and 3 Technical Debt items including the production email-outage post-mortem.

### Task 2 — `.planning/milestones/v1.8-ROADMAP.md` created
New 291-line archive mirroring the v1.7-ROADMAP.md structure: top-level `# Milestone v1.8` heading, `**Status:** ✅ SHIPPED 2026-05-16`, `**Phases:** 41-46 + 42.5 + 42.6 (8 phases)`, `**Total Plans:** 32`, an Overview (with the billing-park paragraph + Phase 46 test-mode-UAT close note), all 8 `### Phase N:` blocks copied from ROADMAP.md, and a Milestone Summary.

### Task 3 — ROADMAP.md v1.8 collapsed
Flipped the in-progress `🚧 v1.8` milestone marker (plus its `⏸️ BILLING PARKED` sub-bullet) to a single `✅` completed one-liner linking to the archive. Deleted the entire expanded v1.8 `<details>` body (all `### Phase 41`..`### Phase 46` blocks + the milestone intro + PREREQ blocks + Tier model block). Added a new top-most footer line dated 2026-05-16, moved the prior 2026-05-12 footer below it, and updated the Cumulative Stats block (8 milestones, 48 phases, 202 plans).

## Plan-Count Tally

Re-tallied from the ROADMAP.md v1.8 phase blocks before writing:

| Phase | Plans |
|-------|-------|
| 41 | 4 |
| 42 | 4 |
| 42.5 | 6 |
| 42.6 | 3 |
| 43 | 2 |
| 44 | 5 |
| 45 | 3 |
| 46 | 5 |
| **Total** | **32** |

Confirmed: **32 plans across 8 phases**.

## Deviations from Plan

The plan file (`46-04-...PLAN.md`) was written before two scope changes. Andrew supplied corrected instructions; the following deviations from the plan-as-written were applied intentionally per those instructions:

1. **Billing-park correction (2026-05-15 scope change).** The plan's FUTURE_DIRECTIONS.md template had 4 Known Limitations and a `schema_migrations RESOLVED in Phase 46-01` Technical Debt item. Corrected to 5 Known Limitations (added "Stripe paywall parked (BILLING_ENABLED=false)" as item 1) and replaced the Phase 46-01 Technical Debt narrative — see deviation 2. The milestone archive Overview gained a billing-park paragraph; the ROADMAP one-liner notes "billing parked behind BILLING_ENABLED kill-switch."

2. **Phase 36/37 email-outage migration fix (2026-05-16).** The plan's Technical Debt section claimed `schema_migrations` was fully resolved in Phase 46-01. In reality 46-01 SKIPPED the Phase 36/37 migrations, and the Phase 36 application code shipped expecting `accounts.email_provider`/`resend_status` columns — silently dropping all booking-confirmation emails for ~1 week. The 2026-05-16 fix applied both migrations via Supabase MCP `apply_migration` and reconciled `schema_migrations`. FUTURE_DIRECTIONS.md Technical Debt now documents the outage post-mortem and records `schema_migrations` as consistent as of 2026-05-16. The ROADMAP footer and milestone archive both note this fix.

3. **Shipped date.** Plan said to read `signoff_at` from 46-VERIFICATION.md frontmatter; corrected instructions fixed the shipped date to **2026-05-16**.

4. **Total Plans = 32, not 30.** The plan frontmatter `must_haves` listed 30; the plan body itself flagged 32 as the re-tally target. Verified 32 by re-tallying the ROADMAP phase blocks.

5. **5 Stripe live-mode UAT scenarios rescoped N/A.** The plan assumed 46-04 ran after live-mode UAT completed. After the billing-park decision there is no live-mode UAT — the 5 deferred scenarios (Portal cancel, reactivation, plan-switch, trial-ending email, payment-failed email) are recorded as N/A throughout the archival docs.

No source code was touched.

## Files Written

- `FUTURE_DIRECTIONS.md` — v1.8 delta section appended (modified)
- `.planning/milestones/v1.8-ROADMAP.md` — full v1.8 milestone archive (created, 291 lines)
- `.planning/ROADMAP.md` — v1.8 collapsed to one-liner; footer + stats updated (modified)

## Verification

- `grep "### Phase 4[123456]"` on ROADMAP.md → **0 matches** (all v1.8 phase blocks collapsed).
- `grep "🚧"` on ROADMAP.md → **0 matches** (no in-progress markers remain).
- `v1.8 Stripe Paywall` appears once in ROADMAP.md (the collapsed milestone bullet).
- v1.8-ROADMAP.md: 291 lines, 8 `### Phase` blocks, all with non-empty Goal/Plans content.
- FUTURE_DIRECTIONS.md: `## v1.8 Stripe Paywall` section present at end; no prior content disturbed.

## Next

Plan 46-05 commits the archival artifacts, updates STATE.md, and creates + pushes the annotated `v1.8.0` git tag.
