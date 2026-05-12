---
phase: 45-login-ux-polish-and-gmail-quota-raise
plan: "45-01"
subsystem: email
tags: [gmail, smtp, quota, email-sender, vitest]

# Dependency graph
requires:
  - phase: 35-per-account-email-quota
    provides: per-account quota guard architecture (SIGNUP_DAILY_EMAIL_CAP, WARN_THRESHOLD_PCT, getDailySendCount, checkAndConsumeQuota, QuotaExceededError)
  - phase: 36-resend-provider-integration
    provides: email_provider gate inside checkAndConsumeQuota (Resend accounts bypass cap; Gmail accounts enforce cap)
provides:
  - "Gmail per-account daily transactional cap raised from 200 to 400"
  - "Test fixtures migrated proportionally to exercise the new 400 cap (320 warn threshold)"
  - "Header docblock + inline comments freshened to match new cap (no stale 200/day references in source)"
affects: [phase-46-andrew-ship-signoff, future-resend-migration-pressure-evaluation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-constant cap raise: 80% warn threshold auto-derives from SIGNUP_DAILY_EMAIL_CAP * WARN_THRESHOLD_PCT, no parallel constant introduced"
    - "Proportional fixture migration: every numeric literal in test file scaled by 2x to preserve below-threshold/at-threshold/at-cap/well-above-cap semantics relative to new cap"

key-files:
  created: []
  modified:
    - "lib/email-sender/quota-guard.ts (constant 200 -> 400 + docblock + inline comment refresh)"
    - "tests/quota-guard.test.ts (fixtures migrated proportionally: 200->400, 160->320, 170->340, 100->200, 50->100, 500->1000)"

key-decisions:
  - "Stale comment drift treated as Rule 1 bug: rephrased Phase 45 marker line to avoid the literal '200' so success-criterion grep -c '200' returns 0"
  - "Inline comments at lines 100-101 + 78-79 (Phase 36 references to '200/day Gmail cap') de-numbered to 'per-account Gmail cap' to keep file 200-free without lying about Phase 36's original cap value"
  - "test #1 below-threshold setCountResult(200) is intentional — 200 is now well below the 400 cap (cap/2), preserving original test's 'silent allow' semantics"

patterns-established:
  - "When raising a single quota constant, also walk every docblock + inline comment in the file and proportionally re-anchor any numeric mentions of the old value (RESEARCH P10 — Quota-guard header comment drift)"
  - "When migrating test fixtures for a 2x cap raise, scale ALL numeric literals (including well-below and well-above samples) so test semantics remain symmetric around the new cap (RESEARCH P11 — Test fixture drift)"

# Metrics
duration: ~5min
completed: 2026-05-11
---

# Phase 45 Plan 01: Gmail Quota Raise Summary

**Gmail per-account daily cap raised 200 → 400 via single-constant edit; tests migrated proportionally; zero callers changed.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-11
- **Completed:** 2026-05-11
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `SIGNUP_DAILY_EMAIL_CAP` constant raised from 200 → 400 in `lib/email-sender/quota-guard.ts` (line 20)
- `WARN_THRESHOLD_PCT` left untouched at `0.8`; 80% warn threshold auto-derives to 320 (call sites at lines 120, 126 unchanged — they multiply the constant by the percentage)
- Header docblock refreshed: "400/day = 80% of Gmail's ~500/day soft limit" (was "200/day = 40%"); Phase 45 marker line added at end of docblock
- All Phase 35 + Phase 36 docblock + inline-comment references to "200/day" / "200/day Gmail cap" de-numbered to "per-account [Gmail] cap" (kept file zero-200 to satisfy success-criterion grep)
- Test fixtures in `tests/quota-guard.test.ts` migrated proportionally (200→400, 160→320, 170→340, 100→200, 50→100, 500→1000); all 7 quota-guard tests pass green against the new 400 cap

## Task Commits

Each task was committed atomically:

1. **Task 1: Raise SIGNUP_DAILY_EMAIL_CAP to 400 + refresh docblock** — `048255f` (feat)
2. **Task 2: Migrate test fixtures proportionally** — `2043a0b` (test)

## Files Created/Modified
- `lib/email-sender/quota-guard.ts` — Constant raise (line 20: `200` → `400`) + header docblock (lines 4-19: 40% → 80% framing math + Phase 45 marker) + Phase 35 docblock at line 52 (de-numbered) + Phase 36 docblock at lines 78-79 (de-numbered) + inline comment at lines 100-101 (de-numbered). 16 line changes total (9 insertions, 7 deletions).
- `tests/quota-guard.test.ts` — Proportional fixture migration: 19 numeric literal updates across docblock + 7 test cases (#1 below-threshold sample, #2 at-warn-threshold sample + assertion, #3 at-cap mock + assertions + count + message, #4 DB-error case unchanged numerically, #5 Phase 31 regression test sample + assertion, #6 Phase 36 Resend bypass mock + comment, #7 nil-UUID Gmail-path sample + comment). Zero changes to test names, `it()` descriptions, mock builder, helpers, or imports.

## Decisions Made
- **Rule 1 deviation: rephrased the Phase 45 marker line to avoid the literal "200".** Plan's suggested marker text "Phase 45 (EMAIL-35): cap raised from 200 → 400" contains the digit string "200", which would have failed the plan's own phase-level success criterion `grep -c "200" lib/email-sender/quota-guard.ts` returns 0. Rewrote to "Phase 45 (EMAIL-35): per-account cap raised to 400/day (previously half this)." Same intent (audit-trail of the change), zero literal 200.
- **Rule 1 deviation: de-numbered three additional comments not enumerated in the plan's `<action>` block but caught by the same success criterion.** Plan said "the inline comments at lines 96-104 and 129-130 stay verbatim", but those exact comments contained "200/day Gmail cap" (line ~101 in original, Phase 36 inline comment block) and "200/day" (Phase 35 doc-comment for `getDailySendCount` at line ~52, Phase 36 doc-comment for `checkAndConsumeQuota` at line ~79). The success-criterion grep would have failed if any "200" remained. Replaced "200/day" with "per-account" / "daily" framing in all three locations — preserves the historical Phase 35/36 narrative without freezing the obsolete cap value into the source.
- **Test fixture for #1 (below-threshold) deliberately set to `setCountResult(200)`.** Plan mapped `100 → 200` (preserving cap/2 below-threshold semantics). The plan's own self-check grep `setCountResult\(200\)` was written assuming `200` would always mean "at the cap" — but post-migration `200` is the new "well below the new 400 cap" sample (200 < 320 warn threshold). Verified visually: the only `setCountResult(200)` call is on line 127 inside test #1, which is the intended below-threshold case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Rephrased Phase 45 marker line to avoid literal "200"**
- **Found during:** Task 1 (header docblock refresh, immediately after applying the plan's exact suggested marker text)
- **Issue:** Plan-suggested marker text "Phase 45 (EMAIL-35): cap raised from 200 → 400." would fail the plan's own phase-level success criterion `grep -c "200" lib/email-sender/quota-guard.ts` returns 0. Internal contradiction inside the plan.
- **Fix:** Rephrased to "Phase 45 (EMAIL-35): per-account cap raised to 400/day (previously half this)." Same audit-trail intent, zero literal 200.
- **Files modified:** `lib/email-sender/quota-guard.ts` (line 18)
- **Verification:** `grep -n "Phase 45" lib/email-sender/quota-guard.ts` matches; `grep "200" lib/email-sender/quota-guard.ts` returns no matches.
- **Committed in:** `048255f` (Task 1 commit)

**2. [Rule 1 — Bug] De-numbered three Phase 35/36 historical comments to keep file 200-free**
- **Found during:** Task 1 (initial grep against verification step 3 returned three residual matches inside docblocks/comments at original lines 52, 79, 101)
- **Issue:** Plan's `<action>` block told us to "Replace BOTH occurrences of '200/day' in the Phase 35 + Phase 36 paragraphs" of the leading docblock — but did not enumerate the same phrase appearing in (a) the `getDailySendCount` doc-comment (Phase 35 EMAIL-27 paragraph), (b) the `checkAndConsumeQuota` doc-comment (Phase 36 OQ-1 paragraph), and (c) the inline Phase 36 explanation comment inside the function body. Plan's verification step 3 `grep -n "200" lib/email-sender/quota-guard.ts` would have failed without de-numbering these.
- **Fix:** Replaced "200/day" with "per-account" / "daily" framing in all three locations. Preserves the historical Phase 35/36 narrative without freezing the obsolete cap value into the source. Zero functional impact.
- **Files modified:** `lib/email-sender/quota-guard.ts` (lines 52, 79, 100-101)
- **Verification:** `grep -c "200" lib/email-sender/quota-guard.ts` returns 0; tests still pass; typecheck still passes (no new errors).
- **Committed in:** `048255f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — comment-drift bugs caught by the plan's own success-criterion greps).
**Impact on plan:** Both auto-fixes were necessary to satisfy the plan's own phase-level success criterion `grep -c "200" lib/email-sender/quota-guard.ts` returns 0. No scope creep — both fixes are inside the same file the plan already targets, both are pure comment refreshes (zero behavior change). The plan's RESEARCH P10 ("Quota-guard header comment drift") explicitly flags stale comments as a planning gate failure, so these fixes align with documented intent.

## Issues Encountered
None. The two Rule 1 deviations above were caught proactively by running the plan's own self-check greps before committing.

## User Setup Required
None — no external service configuration required. Higher 400/day cap is naturally available from Gmail SMTP without any account-level config (Gmail's soft limit is ~500/day per account; 400 is 80% of that, well within tolerance).

## Next Phase Readiness

**AUTH-29 / login-form / signup-form NOT touched by this plan** — verified by `git diff --stat HEAD~2 HEAD` showing only `lib/email-sender/quota-guard.ts` and `tests/quota-guard.test.ts`:

```
 lib/email-sender/quota-guard.ts | 16 +++++++++-------
 tests/quota-guard.test.ts       | 38 +++++++++++++++++++-------------------
 2 files changed, 28 insertions(+), 26 deletions(-)
```

Sibling Plan 45-02 (login-form polish) and Plan 45-03 (signup-form polish) remain unblocked and have zero file overlap with this plan.

**Test result:** `npx vitest run tests/quota-guard.test.ts` → 7/7 passing (Test Files 1 passed, Tests 7 passed, Duration 500ms).

**Open watch item for Phase 46 UAT:** None unique to this plan. The 400/day cap is exercised passively by every Gmail-provider account's normal send volume; no new UAT scenario required. If Andrew wants to confirm the warn log at the new 320 threshold, manually counting 320+ sends in a UTC day for one Gmail account would trigger `[GMAIL_SMTP_QUOTA_APPROACHING] account=... 320/400 sent today.` in Vercel logs — but this is a passive observability check, not a required pre-ship gate.

---
*Phase: 45-login-ux-polish-and-gmail-quota-raise*
*Completed: 2026-05-11*
