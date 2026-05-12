---
phase: 46-andrew-ship-sign-off
plan: "46-03"
type: execute
wave: 2
depends_on: ["46-01", "46-02"]
files_modified:
  - .planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md
autonomous: false
must_haves:
  truths:
    - "PREREQ-C is confirmed complete by Andrew before any UAT scenario runs"
    - "Every scenario in 46-VERIFICATION.md is exercised and marked PASS or FAIL"
    - "Every state-flip SQL stub is executed via Supabase MCP execute_sql by Claude on Andrew's request (not run by Andrew manually)"
    - "Final restoration SQL is run after all scenarios complete, leaving nsi in clean trialing state with plan_tier='widget'"
    - "Any FAIL triggers a 46-NN integer sub-plan (not a decimal phase) and ship is blocked until that sub-plan green + scenario re-run"
    - "On 100% PASS, 46-VERIFICATION.md frontmatter is updated: status='passed', verified=<ISO>, score=N/N, signoff_by=Andrew, signoff_at=<date>, human_verification_results=[per-scenario PASS records]"
  artifacts:
    - path: ".planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md"
      provides: "Completed UAT artifact with all checkboxes resolved and frontmatter updated"
      contains: "status: passed"
  key_links:
    - from: "Andrew's browser actions on production"
      to: "Live Stripe + Supabase state of nsi account"
      via: "Each scenario's defined action steps"
      pattern: "PASS|FAIL"
    - from: "Claude MCP SQL flips"
      to: "Supabase production DB"
      via: "mcp__claude_ai_Supabase__execute_sql"
      pattern: "execute_sql"
---

<objective>
Drive Andrew through the linear UAT checklist in 46-VERIFICATION.md. Claude executes all SQL state-flips via Supabase MCP between scenarios; Andrew performs all browser/Stripe Dashboard/Gmail-inbox actions. On 100% PASS, Claude updates the file's frontmatter to `status: passed` and signals readiness for plans 46-04 + 46-05.

Purpose: This is the human-driven plan. It cannot be autonomous — every scenario requires Andrew's authenticated session, his eyes on the UI, or his Gmail inbox. Claude's job here is to be the SQL operator + checklist tracker.

Output: A fully checked 46-VERIFICATION.md with `status: passed` (assuming 100% PASS), or one or more 46-NN sub-plan files if any scenario FAILs.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/46-andrew-ship-sign-off/46-CONTEXT.md
@.planning/phases/46-andrew-ship-sign-off/46-RESEARCH.md
@.planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md
@.planning/phases/46-andrew-ship-sign-off/46-01-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: PREREQ-C hard block — Andrew confirms Stripe Customer Portal config</name>
  <what-built>
46-VERIFICATION.md exists with the PREREQ-C block at the top. Claude has not run any SQL yet.
  </what-built>
  <how-to-verify>
Andrew:
1. Open Stripe Dashboard → Settings → Billing → Customer portal.
2. Confirm cancel-at-period-end is ENABLED.
3. Confirm Plan switching is ENABLED with all 4 Prices visible (Basic-Monthly, Basic-Annual, Widget-Monthly, Widget-Annual).
4. Confirm Payment method updates is ENABLED.
5. Confirm Invoice history is ENABLED.
6. Edit 46-VERIFICATION.md and check all four PREREQ-C boxes.

Then return to this session.
  </how-to-verify>
  <resume-signal>
Reply "PREREQ-C complete" (or describe any blockers in the Stripe config UI).
  </resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Run all 9 scenario groups top-to-bottom from 46-VERIFICATION.md</name>
  <what-built>
46-VERIFICATION.md drives the session. Claude has the file open and is ready to:
- Run the "Read nsi Stripe Customer ID" SELECT first and report `cus_XXXXX` to Andrew.
- Run each state-flip SQL via Supabase MCP `execute_sql` between scenarios when Andrew is ready.
- Verify post-flip DB state via SELECT after Stripe-driven scenarios (checkout, portal cancel, plan switch).
- Mark each scenario PASS or FAIL in the file based on Andrew's verbal report.
- Open a 46-NN sub-plan file immediately if any scenario FAILs and pause Phase 46.
  </what-built>
  <how-to-verify>
This task is the entire UAT session. Andrew works through 46-VERIFICATION.md groups 1-9 in order. For each scenario:

1. Andrew tells Claude which scenario he is about to run.
2. Claude runs any required setup SQL via MCP `execute_sql` and reports result.
3. Andrew performs the browser/Stripe/inbox action.
4. Andrew reports PASS or FAIL with a one-line note.
5. Claude edits 46-VERIFICATION.md to check the matching box and write the note.
6. Claude runs any post-scenario verification SELECT and confirms DB state matches expected.
7. Claude runs any cleanup SQL (e.g., reset `cancel_at_period_end`) per the scenario's stub.

Special handling:
- **Scenario 6.1/6.2 (Email UAT):** Use Stripe Dashboard test clock approach per RESEARCH.md §1 (NOT `stripe trigger` CLI — synthetic customer issue). Andrew creates the simulation; Claude does NOT need to run SQL during this scenario.
- **Scenario 7.4 (Gmail quota):** Claude runs the bulk INSERT and the bump-to-400 INSERT and the cleanup DELETE in three separate execute_sql calls, in the order specified by the scenario.
- **Scenario 8.1 (webhook idempotency):** Claude runs the COUNT SELECT after Andrew triggers the resend in Stripe Dashboard.

After the last scenario group (Group 9), Claude runs the Final Restoration SQL from 46-VERIFICATION.md to leave nsi in a clean trialing state with `plan_tier='widget'`.

**Failure handling (any scenario FAILs):**
1. Claude marks the scenario as `- [x] FAIL — <one-line root cause>` in 46-VERIFICATION.md.
2. Claude opens a new file `.planning/phases/46-andrew-ship-sign-off/46-NN-<slug>-PLAN.md` (NN = next available integer, e.g., 46-04 if no other failures, or 46-05/46-06 if 46-04 is the archival plan — coordinate numbering: archival plan stays 46-04 only if no failures intervene; failure sub-plans take the next integer AFTER the planned 46-04/46-05).
   - **Numbering rule:** If a failure occurs before 46-04 runs, name the failure sub-plan 46-04 and shift archival/tag plans to 46-05/46-06. If a failure occurs AFTER 46-04 runs (archival done) but before 46-05 (tag), name the failure sub-plan 46-05 and shift the tag plan to 46-06. The integer rule from CONTEXT.md is: failure sub-plans are integer-suffixed (no decimals), inserted in numerical order.
3. The sub-plan must include: the failing scenario name, root cause hypothesis, target files to change, verification command, and a "re-run scenario X.Y" task.
4. After the sub-plan ships green, re-run the failed scenario and update 46-VERIFICATION.md to PASS.
5. Do NOT proceed to plan 46-04 (FUTURE_DIRECTIONS + archive) until every scenario is PASS.
  </how-to-verify>
  <resume-signal>
Reply "All scenarios PASS — sign off" (Claude flips frontmatter to `status: passed` and signals plan 46-04 ready), or "FAIL on scenario X.Y — open sub-plan" (Claude opens the failure sub-plan and pauses).
  </resume-signal>
</task>

<task type="auto">
  <name>Task 3: Update 46-VERIFICATION.md frontmatter on PASS</name>
  <files>.planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md</files>
  <action>
Only run this task after Andrew confirms 100% PASS at the end of Task 2.

Edit the frontmatter:
- `verified:` set to current ISO timestamp (UTC, e.g., `2026-05-12T20:30:00Z`).
- `status:` flip from `in_progress` to `passed`.
- `score:` update to actual `N/N scenarios passed` count (count of `- [x] PASS` checkboxes in body, including all Phase 44/45 deferred items).
- `signoff_by:` already `Andrew`; leave.
- `signoff_at:` set to today's date (YYYY-MM-DD).
- `post_signoff_corrections:` leave `[]` unless a 46-NN sub-plan ran during UAT — in which case list each: `- commit: <sha>\n  fix: <one-line>`.
- `human_verification_results:` populate as an array of per-scenario records:
  ```yaml
  human_verification_results:
    - test: "Scenario 1.1: Trial flow + 14-day counter"
      result: "PASS"
    - test: "Scenario 1.2: Urgent trial banner"
      result: "PASS"
    # ... one entry per scenario, mirroring the body checklist
  ```
  Pull the test name verbatim from each `### Scenario X.Y: <name>` header. The `result` field is `PASS` or `FAIL - <one-line>` (matching the inline result line).
  </action>
  <verify>
- `head -25 .planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md` shows `status: passed`, ISO timestamp, score `N/N`, signoff_at populated, and a populated `human_verification_results` array.
- The body of the file has zero `- [ ]` unchecked boxes remaining in scenario sections (PREREQ-C through Sign-Off).
  </verify>
  <done>
46-VERIFICATION.md is the audit-grade sign-off artifact. Plans 46-04 + 46-05 can now run.
  </done>
</task>

</tasks>

<verification>
- PREREQ-C confirmed before any other action.
- Every scenario in 46-VERIFICATION.md was exercised by Andrew (no scenario skipped).
- Final restoration SQL was run (nsi is back to clean trialing + widget tier).
- If any FAIL occurred, a 46-NN sub-plan was opened and Phase 46 paused until it shipped green.
- On 100% PASS, frontmatter status is `passed` and the file is committed.
</verification>

<success_criteria>
1. 46-VERIFICATION.md has every scenario checkbox resolved (PASS or FAIL).
2. Frontmatter status is `passed` (assuming 100% PASS path).
3. nsi account is in clean `trialing` state with `plan_tier='widget'` post-UAT.
4. Plans 46-04 + 46-05 are unblocked.
</success_criteria>

<output>
After completion, create `.planning/phases/46-andrew-ship-sign-off/46-03-SUMMARY.md` per the GSD summary template summarizing: scenarios run, PASS count, any sub-plans opened and their disposition, and any production state changes (e.g., 46-01 migration repair already applied; UAT left nsi in clean trialing state).
</output>
