---
phase: 45-login-ux-polish-and-gmail-quota-raise
plan: "45-01"
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/email-sender/quota-guard.ts
  - tests/quota-guard.test.ts
autonomous: true
must_haves:
  truths:
    - "Gmail daily quota cap is 400 (raised from 200)"
    - "80% warning threshold is 320 (derived from 400 × 0.8, NOT a separate constant)"
    - "All existing quota-guard tests pass against the new 400 cap"
    - "Header comment block reflects the new 400 cap and 40% framing math"
  artifacts:
    - path: "lib/email-sender/quota-guard.ts"
      provides: "SIGNUP_DAILY_EMAIL_CAP = 400 (single-constant raise from 200)"
      contains: "SIGNUP_DAILY_EMAIL_CAP = 400"
    - path: "tests/quota-guard.test.ts"
      provides: "Test fixtures migrated proportionally (160→320, 170→340, 200→400)"
      contains: "320/400"
  key_links:
    - from: "lib/email-sender/quota-guard.ts"
      to: "all email-send callers"
      via: "SIGNUP_DAILY_EMAIL_CAP export"
      pattern: "SIGNUP_DAILY_EMAIL_CAP\\s*=\\s*400"
    - from: "WARN_THRESHOLD_PCT (line 19)"
      to: "warn-log gate (line 118)"
      via: "SIGNUP_DAILY_EMAIL_CAP * WARN_THRESHOLD_PCT (auto-derives 320)"
      pattern: "SIGNUP_DAILY_EMAIL_CAP \\* WARN_THRESHOLD_PCT"
---

<objective>
Raise the Gmail per-account daily transactional send cap from 200/day to 400/day (EMAIL-35) via a single constant change in `lib/email-sender/quota-guard.ts`. The 80% warn threshold (currently 160) auto-derives to 320 because it is computed as `SIGNUP_DAILY_EMAIL_CAP * WARN_THRESHOLD_PCT` at the call site, not stored as its own constant.

Purpose: Headroom for higher booking + reminder volume per account before any Resend migration pressure. CONTEXT.md locks this as a single-constant change — no per-caller branching, no new logic, no new logging.

Output: One-line source change + header-comment refresh + proportional test-fixture migration. All existing quota-guard tests pass.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/45-login-ux-polish-and-gmail-quota-raise/45-CONTEXT.md
@.planning/phases/45-login-ux-polish-and-gmail-quota-raise/45-RESEARCH.md

@lib/email-sender/quota-guard.ts
@tests/quota-guard.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Raise SIGNUP_DAILY_EMAIL_CAP to 400 and refresh header comment</name>
  <files>lib/email-sender/quota-guard.ts</files>
  <action>
    Make a TWO-PART edit to `lib/email-sender/quota-guard.ts`:

    Part A — Constant change (line 18):
    - Change `export const SIGNUP_DAILY_EMAIL_CAP = 200;` to `export const SIGNUP_DAILY_EMAIL_CAP = 400;`.
    - Do NOT touch `WARN_THRESHOLD_PCT = 0.8` on line 19 — the 320 warn threshold is auto-derived at lines 118 and 124 from `SIGNUP_DAILY_EMAIL_CAP * WARN_THRESHOLD_PCT` and `SIGNUP_DAILY_EMAIL_CAP` respectively.
    - Do NOT introduce any new constant. Do NOT add per-caller branching. Do NOT add logging.

    Part B — Header docblock refresh (lines 4-17):
    The existing docblock says "200/day = 40% of Gmail's ~500/day soft limit" and references "200/day cap" in two places. Rewrite the docblock to:
    1. State the new cap: "400/day = 80% of Gmail's ~500/day soft limit, leaving headroom for booking + reminder volume."
    2. Replace BOTH occurrences of "200/day" with "400/day" in the Phase 35 + Phase 36 paragraphs.
    3. Preserve all existing structural points (per-account scope from Phase 35, Resend bypass from Phase 36, email_provider gate). Do NOT remove or reorder these.
    4. Add a one-line marker at the end of the docblock: "Phase 45 (EMAIL-35): cap raised from 200 → 400."

    Constraints (RESEARCH P10 — Quota-guard header comment drift):
    - The docblock MUST reflect the new cap. Stale comments are a planning gate failure.
    - Do NOT touch any other comment in the file (the inline comments at lines 96-104 and 129-130 stay verbatim).
    - Do NOT touch any function body except the literal `200` → `400` on line 18.

    Self-check before completing:
    - `grep -n "200" lib/email-sender/quota-guard.ts` — should return ZERO matches related to the cap (some unrelated 200s like HTTP status codes do not exist in this file; the only `200` was line 18 + the two header mentions).
    - `grep -n "400" lib/email-sender/quota-guard.ts` — should show line 18 plus the header mentions.
  </action>
  <verify>
    Run these commands sequentially:
    1. `npm run typecheck` — must pass (zero new errors).
    2. `grep -n "SIGNUP_DAILY_EMAIL_CAP\s*=\s*400" lib/email-sender/quota-guard.ts` — must match exactly once on line 18.
    3. `grep -n "200" lib/email-sender/quota-guard.ts` — must return zero matches (no stale 200 anywhere in this file).
    4. `grep -n "Phase 45" lib/email-sender/quota-guard.ts` — must match at least once in the header docblock.
  </verify>
  <done>
    Line 18 reads `export const SIGNUP_DAILY_EMAIL_CAP = 400;`. The header docblock (lines 4-17 area) references 400/day in every cap-related sentence, contains a Phase 45 (EMAIL-35) marker, and contains zero "200" literals. WARN_THRESHOLD_PCT remains `0.8` on line 19. No other lines in the file are modified.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate test fixtures proportionally (200→400, 160→320, 170→340)</name>
  <files>tests/quota-guard.test.ts</files>
  <action>
    Walk every numeric literal in `tests/quota-guard.test.ts` and migrate proportionally so the tests exercise the new 400 cap. Map:
    - `200` (cap reference) → `400`
    - `160` (80% warn threshold) → `320`
    - `170` (85% post-threshold sample) → `340`
    - `100` (50% below-threshold sample, line 127) → `200`  (keep proportional: was cap/2, stay at cap/2)
    - `50`  (nil-UUID Gmail-path well-below sample, line 316) → `100` (also cap/4 → cap/4)
    - `500` (Resend bypass overshoot, lines 267, 289) → `1000` (preserve "well above cap" intent; doubling matches the cap doubling)

    Specific lines to update (LET RESEARCH P11 GUIDE — walk EVERY literal, do not skip any):
    - Line 21 docblock: "count >= 200" → "count >= 400"
    - Line 126 comment: "count = 100, cap = 200, threshold = 160" → "count = 200, cap = 400, threshold = 320"
    - Line 127 `setCountResult(100)` → `setCountResult(200)`
    - Line 139 comment: "count = 160 = 80% of 200" → "count = 320 = 80% of 400"
    - Line 140 `setCountResult(160)` → `setCountResult(320)`
    - Line 148 `expect(...).toContain("160/200")` → `expect(...).toContain("320/400")`
    - Line 152 comment: "count = 200 = cap" → "count = 400 = cap"
    - Line 153 `setCountResult(200)` → `setCountResult(400)`
    - Line 180 inline `Promise.resolve({ count: 200, error: null })` (inside test #3 doMock) → `count: 400`
    - Line 183 inline `Promise.resolve({ count: 200, error: null })` (inside test #3 doMock) → `count: 400`
    - Line 201 `expect(err.count).toBe(200)` → `expect(err.count).toBe(400)`
    - Line 203 `expect(err.message).toContain("200/200")` → `expect(err.message).toContain("400/400")`
    - Line 226 `setCountResult(170)` → `setCountResult(340)`
    - Line 236 `expect(...).toContain("170/200")` → `expect(...).toContain("340/400")`
    - Line 267 `setCountResult(500)` → `setCountResult(1000)` (Resend bypass test — keep "way above cap" semantics)
    - Line 289 inline `Promise.resolve({ count: 500, error: null })` → `count: 1000`
    - Line 301 comment "count (500) >> cap (200)" → "count (1000) >> cap (400)"
    - Line 316 `setCountResult(50)` → `setCountResult(100)`
    - Line 317 comment "count 50 is well below the 200 cap" → "count 100 is well below the 400 cap"

    Constraints (RESEARCH P11 — Test fixture drift):
    - Do NOT change test names, test descriptions (`it(...)`), or assertion structures.
    - Do NOT change the mock builder, the `setCountResult` / `setEmailProvider` helpers, or any imports.
    - Do NOT add new tests. Do NOT remove any tests. This is fixture migration, not logic change.
    - The TEST_ACCOUNT_ID constant is unrelated to the cap and stays as-is.

    Self-check before completing:
    - `grep -nE "(^| )200([^0-9]|$)" tests/quota-guard.test.ts` — should return at most stale matches for the TEST_ACCOUNT_ID (`00000000-0000-0000-0000-000000000001`) or matched substrings within UUIDs; NO matches for `setCountResult(200)`, `count: 200`, `200/200`, `200`-as-cap, or `cap = 200`. Visually confirm any residual matches are inside UUID strings only.
    - `grep -n "160" tests/quota-guard.test.ts` — zero matches.
    - `grep -n "170" tests/quota-guard.test.ts` — zero matches.
    - `grep -nE "(320|340|400)" tests/quota-guard.test.ts` — multiple matches across the file.
  </action>
  <verify>
    1. `npm test -- quota-guard` — all 7 test cases (#1, #2, #3, #4, #5, #6, #7) must pass green.
    2. `npm run typecheck` — must pass.
    3. `grep -nE "(setCountResult\(200\)|count: 200|\"200/200\")" tests/quota-guard.test.ts` — zero matches.
    4. `grep -nE "(setCountResult\(160\)|setCountResult\(170\))" tests/quota-guard.test.ts` — zero matches.
  </verify>
  <done>
    `npm test -- quota-guard` shows 7/7 tests passing. All numeric cap-related literals in the test file have been migrated proportionally to match the new 400 cap. No test names, structures, or mock helpers were modified.
  </done>
</task>

</tasks>

<verification>
Final phase-level checks for plan 45-01:
- `npm test -- quota-guard` passes 7/7.
- `npm run typecheck` passes.
- `npm run lint` passes (or no new violations introduced in the two files touched).
- `grep -n "= 400" lib/email-sender/quota-guard.ts` shows the new cap.
- `grep -c "200" lib/email-sender/quota-guard.ts` returns 0.
- `git diff --stat` shows ONLY `lib/email-sender/quota-guard.ts` and `tests/quota-guard.test.ts` changed. No other file in the repo is touched.

AUTH-29 / login-form / signup-form NOT touched by this plan — verified by `git diff --name-only` showing only the two quota-guard files.
</verification>

<success_criteria>
- SC6: `lib/email-sender/quota-guard.ts` daily quota constant is 400; 80% warning threshold is 320; single constant update, no per-caller branching. ✓
- Verifiable: `grep "SIGNUP_DAILY_EMAIL_CAP = 400" lib/email-sender/quota-guard.ts` exits 0 AND `grep "WARN_THRESHOLD_PCT = 0.8" lib/email-sender/quota-guard.ts` exits 0 AND `npm test -- quota-guard` passes.
- No regression: All 7 existing quota-guard test cases (including Phase 35 + Phase 36 additions) pass against the new fixtures.
- No scope creep: No source file outside `lib/email-sender/quota-guard.ts` and `tests/quota-guard.test.ts` is modified.
</success_criteria>

<output>
After completion, create `.planning/phases/45-login-ux-polish-and-gmail-quota-raise/45-01-SUMMARY.md` using the standard summary template. Include:
- One-line outcome ("Gmail per-account daily cap raised 200 → 400; tests migrated; zero callers changed").
- Files modified (the 2 above).
- Confirmation that AUTH-29 / login-form / signup-form were NOT touched.
- Test result line (7/7 passing).
</output>
</content>
