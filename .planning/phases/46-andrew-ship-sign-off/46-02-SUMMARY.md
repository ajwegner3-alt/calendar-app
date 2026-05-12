---
phase: 46-andrew-ship-sign-off
plan: "46-02"
subsystem: testing
tags: [uat, stripe, supabase, gmail, auth, verification]

requires:
  - phase: 46-andrew-ship-sign-off/46-RESEARCH.md
    provides: SQL stubs A..H for state-flip scenarios, Stripe trigger methods, frontmatter pattern
  - phase: 44-customer-portal-billing-polish-stripe-emails
    provides: Portal end-to-end cancel, trial-will-end email, payment-failed email (3 deferred items)
  - phase: 45-login-ux-polish-and-gmail-quota-raise
    provides: OAuth-below-Card visual, 3-fail nudge, Gmail 400-cap (4 deferred items)
provides:
  - "46-VERIFICATION.md: single linear v1.8 UAT checklist (760 lines) ready for 46-03 live execution"
affects: ["46-03-andrew-live-uat-execution", "46-04-v18-archival-documents", "46-05-v18-tag-and-signoff"]

tech-stack:
  added: []
  patterns:
    - "PREREQ-C hard block as first checklist section before any UAT scenario runs"
    - "Inline SQL stubs per scenario — no external reference required during live UAT"
    - "Phase 44 + 45 deferred items interleaved by domain, not appended as a separate section"

key-files:
  created:
    - ".planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md"
  modified: []

key-decisions:
  - "Score denominator is 28: 14 ROADMAP QA + 3 Phase 44 deferred + 4 Phase 45 deferred + 7 supporting scenarios"
  - "stripe_customer_id read SQL is the very first scenario SQL (appears immediately after PREREQ-C, before any state-flip)"
  - "All SQL stubs inlined verbatim from RESEARCH.md §2 stubs A..H — no re-derivation during live UAT"
  - "Group 3 (Portal) contains the Phase 44 deferred cancel end-to-end scenario (3.2)"
  - "Group 7 (Login UX) contains all four Phase 45 deferred items (7.1..7.4)"
  - "Final Restoration SQL and Sign-Off section placed at end before Post-Sign-Off instructions"

patterns-established:
  - "Phase 43 frontmatter pattern mirrored: phase, verified, status=in_progress, score, signoff_by, signoff_at, post_signoff_corrections, human_verification_results"

duration: ~15min
completed: 2026-05-12
---

# Phase 46 Plan 02: UAT Checklist Authoring Summary

**Single linear v1.8 ship sign-off UAT checklist authored as `46-VERIFICATION.md` (760 lines, 34 PASS/FAIL checkboxes, 9 scenario groups) with PREREQ-C hard block first, all SQL stubs inlined from RESEARCH.md §2, and Phase 44/45 deferred items interleaved by domain**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-12
- **Completed:** 2026-05-12
- **Tasks:** 1 (doc-only plan)
- **Files modified:** 1 (created)

## Accomplishments

- Authored `46-VERIFICATION.md` — the single audit trail for v1.8 sign-off, covering all 28 UAT scenarios
- PREREQ-C (Stripe Customer Portal Dashboard config) placed as the first section — hard block before any scenario runs
- All state-flip SQL stubs from RESEARCH.md §2 (stubs A..H) inlined verbatim per scenario — Claude can paste directly into MCP `execute_sql` during live UAT without re-derivation
- Phase 44 deferred items (Portal cancel end-to-end, trial-will-end email, payment-failed email) and Phase 45 deferred items (OAuth-below-Card on login+signup, 3-fail nudge, Gmail 400-cap) interleaved by domain into the corresponding scenario groups

## Task Commits

1. **Task 1: Write 46-VERIFICATION.md** - `7ae9517` (docs)

**Plan metadata:** (this commit, see below)

## Files Created/Modified

- `.planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md` — 760-line UAT checklist: frontmatter (Phase 43 pattern), intro, PREREQ-C block, Setup SQL (stripe_customer_id read), 9 scenario groups, Final Restoration SQL, Sign-Off section, Post-Sign-Off action pointer to 46-04 and 46-05

## Decisions Made

- Score denominator set to 28 (14 ROADMAP QA + 3 Phase 44 deferred + 4 Phase 45 deferred + 7 supporting scenarios including webhook idempotency, static invariants, and restoration).
- `stripe_customer_id` read SQL placed immediately after PREREQ-C (before any other scenario SQL) per RESEARCH.md §9 Open Question 2 — Andrew needs the `cus_XXXXX` value for Stripe Dashboard lookups in email UAT scenarios.
- Phase 44 deferred cancel scenario placed in Group 3 (Customer Portal) at Scenario 3.2, between "Portal opens" (3.1) and "Reactivation" (3.3) — logical domain flow.
- Phase 45 deferred items consolidated in Group 7 (Login UX) as Scenarios 7.1..7.4.
- Scenario 5.4 (trialing overrides plan_tier) explicitly added to validate LD-19 (trialing checked FIRST in `requireWidgetTier`) — covers the widget-gate ordering invariant.

## Deviations from Plan

None — plan executed exactly as written. The plan's action section specified the exact content and structure; this summary confirms faithful execution. The only authoring judgment calls were:
- Scenario 3.4 (plan-switching visibility) positioned AFTER Scenario 3.3 (reactivation) to maintain a natural Portal flow (cancel → reactivate → verify plans visible)
- Scenario 5.4 explicitly tests LD-19 branch order (trialing checked first in `requireWidgetTier`)

Both are within Claude's Discretion per CONTEXT.md.

## Issues Encountered

None.

## Verification Evidence

```
wc -l 46-VERIFICATION.md   → 760 lines (≥ 200 required)
PREREQ-C                   → line 26 (first actionable section)
stripe_customer_id SQL     → line 46 (first scenario SQL)
UPDATE accounts count      → 20 state-flip stubs
PASS|FAIL checkbox count   → 34
```

## Next Phase Readiness

- `46-VERIFICATION.md` is complete and self-contained. Plan 46-03 (Andrew live UAT execution) can drive Andrew through it without any further authoring.
- Andrew must complete PREREQ-C (Stripe Customer Portal config) before any scenario runs — this is the only external gate remaining before UAT begins.
- Claude will run all MCP `execute_sql` SQL flips during 46-03 on Andrew's request.

---
*Phase: 46-andrew-ship-sign-off*
*Completed: 2026-05-12*
