---
phase: 26-bookings-page-crash-debug-fix
plan: 03
type: execute
wave: 3
depends_on:
  - "26-02"
files_modified:
  - .planning/phases/26-bookings-page-crash-debug-fix/26-SUMMARY.md
  - .planning/STATE.md
  - .planning/ROADMAP.md
autonomous: false

must_haves:
  truths:
    - "All three seeded accounts (NSI, nsi-rls-test, nsi-rls-test-3) render `/app/bookings` cleanly on production — Andrew live-verifies each."
    - "Empty-bookings shape renders the empty state without crash on production."
    - "Cancelled-only shape renders without crash on both default and `cancelled` filters on production."
    - "Many-bookings shape (>50 bookings) renders page 1 cleanly with pagination on production."
    - "Mixed-event-types shape with at least one soft-deleted event_type renders cleanly with `(deleted event type)` fallback label."
    - "Phase 26 SUMMARY.md exists, consolidates Plans 01+02, lists all deferred audit findings, names which Phase covers each."
    - "STATE.md updated to mark Phase 26 complete; ROADMAP.md plan checkbox checked."
  artifacts:
    - path: ".planning/phases/26-bookings-page-crash-debug-fix/26-SUMMARY.md"
      provides: "Final phase summary consolidating Plans 01+02"
      contains:
        - "Root cause"
        - "Fix applied"
        - "Verification matrix"
        - "Deferred findings"
    - path: ".planning/STATE.md"
      provides: "Updated with Phase 26 complete + Phase 27 next"
      contains: "Phase 26 complete"
    - path: ".planning/ROADMAP.md"
      provides: "Plan 26-XX checkboxes flipped to [x]; phase status updated"
  key_links:
    - from: "Andrew live verification"
      to: "production deployment from Plan 02"
      via: "browser visits to /app/bookings as each test account"
      pattern: "no 500, no client-side crash, expected content visible"
    - from: "26-SUMMARY.md"
      to: "ROADMAP.md Phase 26 entry"
      via: "Plans checkbox flip + status timestamp"
      pattern: "\\[x\\] 26-..."
---

<objective>
Live-verify the Plan 02 fix across all required account shapes on production. Andrew confirms each shape in chat. Write the consolidated phase SUMMARY. Update STATE.md and ROADMAP.md to mark Phase 26 complete.

Purpose: Honors CONTEXT verification breadth — fix must be account-agnostic, not just "works for nsi." Three seeded accounts + four shape-coverage scenarios (empty, cancelled-only, many, mixed-with-soft-deleted) all confirmed before phase ships.

Output: Live-verified production behavior across 7 shapes; phase SUMMARY; updated planning docs.

**Hard constraints:**
- Andrew's live confirmation is the verification. Claude cannot self-verify production behavior; this plan is intentionally `autonomous: false`.
- If ANY shape crashes during verification, this plan does NOT close. Instead: gather logs (mini-Plan-01), then either (a) loop back to revise Plan 02's fix, or (b) raise a follow-up phase if scope materially expands. CONTEXT: "Production-live verification only."
- Do NOT advance the roadmap to Phase 27 until SUMMARY is written and Andrew has signed off on every required shape.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/26-bookings-page-crash-debug-fix/26-CONTEXT.md
@.planning/phases/26-bookings-page-crash-debug-fix/26-RESEARCH.md
@.planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md
@.planning/phases/26-bookings-page-crash-debug-fix/26-01-SUMMARY.md
@.planning/phases/26-bookings-page-crash-debug-fix/26-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pre-verification — confirm seeded account shapes exist; if missing, surface to Andrew</name>
  <files>
    No code modified. Output: a checklist file or in-chat checklist of which shapes already have data and which need seeding.
  </files>
  <action>
    Per RESEARCH §"Open Questions" #3: it's unclear whether all seven verification shapes already exist in production data. Confirm before asking Andrew to verify.

    1. Hand Andrew the SQL one-liners from `26-RESEARCH.md` §"Seeded Account Shapes" → "SQL one-liner to find each shape" (lines 165-186). Andrew runs them in Supabase SQL Editor (admin client) and pastes results. The four queries:

       - Empty-bookings accounts (count = 0)
       - Cancelled-only accounts (all bookings status='cancelled')
       - Many-booking accounts (count > 50)
       - Bookings with soft-deleted event_types

    2. From results, build a verification matrix in chat:

       | Shape | Account / row count | Ready? |
       |---|---|---|
       | NSI prod | slug=nsi | ✅ exists |
       | nsi-rls-test | slug=nsi-rls-test | ✅ exists |
       | nsi-rls-test-3 | slug=nsi-rls-test-3 | ✅ exists |
       | Empty bookings | <slug from query 1> | ✅ / ⚠️ need seed |
       | Cancelled-only | <slug from query 2> | ✅ / ⚠️ need seed |
       | Many bookings (>50) | <slug from query 3> | ✅ / ⚠️ need seed |
       | Mixed soft-deleted | <booking ids from query 4> | ✅ / ⚠️ need seed |

    3. If a shape has no candidate account: ask Andrew whether to (a) seed it (Andrew creates a test booking via the public flow, or runs an admin INSERT), or (b) waive that shape with explicit rationale recorded in SUMMARY (e.g., "no production account currently has >50 bookings; many-bookings shape covered by load-month-bookings.test.ts and existing pagination test").

    4. Record the matrix in `26-SUMMARY.md` (initial draft — final version written in Task 3). The matrix is the verification ground truth.

    Stop condition: every required shape has either (a) a real account to verify against, or (b) an explicit waiver with rationale signed off by Andrew.
  </action>
  <verify>
    Verification matrix is recorded (in chat or in `26-SUMMARY.md` draft) listing all 7 shapes with: account/condition + Ready or Waived (with rationale).
  </verify>
  <done>
    Andrew has paste-confirmed the SQL results and Claude has classified each shape as Ready, Seeded-by-Andrew, or Waived. No shape is in unknown state.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew live-verifies all required shapes on production /app/bookings</name>
  <what-built>
    Plan 02's fix is deployed to production (confirmed Vercel "Ready" in Plan 02 Task 3). The verification matrix from Task 1 names every shape to check.
  </what-built>
  <how-to-verify>
    For each row in the verification matrix from Task 1, Andrew performs the following on the LIVE production URL:

    **Shape 1 — NSI prod (slug=nsi):**
    1. Sign in as Andrew's NSI owner account.
    2. Visit `<prod-url>/app/bookings`.
    3. Expect: page renders. Booking rows display with date/time, event-type name, status, booker name. No 500 page. No client console error.
    4. Apply the `cancelled` filter (or any filter that produces a non-empty result set). Confirm no crash.
    5. Click into one booking detail row. Confirm `/app/bookings/<id>` also renders (sibling page using same pattern).

    **Shape 2 — nsi-rls-test:**
    1. Sign in as the nsi-rls-test owner (TEST_OWNER_2_*).
    2. Visit `<prod-url>/app/bookings`. Expect render OR empty state, no crash.

    **Shape 3 — nsi-rls-test-3:**
    1. Sign in as the nsi-rls-test-3 owner (TEST_OWNER_3_*).
    2. Visit `<prod-url>/app/bookings`. Expect render OR empty state, no crash.

    **Shape 4 — Empty bookings:**
    Either same as Shape 2/3 if either is empty, or seeded account from Task 1.
    1. Sign in as that account; visit `<prod-url>/app/bookings`.
    2. Expect: explicit "No bookings yet" empty-state card (per `bookings-table.tsx:42-50`). No crash.

    **Shape 5 — Cancelled-only:**
    Either an account where all bookings are cancelled, or apply a filter that simulates this:
    1. Visit `<prod-url>/app/bookings?status=cancelled` against an account whose only bookings are cancelled.
    2. Default `upcoming` filter → expect empty state.
    3. `cancelled` filter → expect rows. No crash on either.

    **Shape 6 — Many bookings (>50):**
    On the candidate account from Task 1:
    1. Visit `<prod-url>/app/bookings`. Expect: page 1 of N renders with pagination control showing multiple pages.
    2. Click to page 2 (`?page=2`). Expect: renders page 2, no crash.
    3. (Waive if no candidate exists per Task 1.)

    **Shape 7 — Mixed event types incl. soft-deleted:**
    Using Task 1's identified booking IDs whose `event_type.deleted_at IS NOT NULL`:
    1. Sign in as the relevant account; visit `<prod-url>/app/bookings`.
    2. Confirm: the row(s) referencing the soft-deleted event type render with `(deleted event type)` as the event-type name (per `bookings-table.tsx:66` fallback). No crash.

    **Pass criteria for the whole task:** every required shape (or waived shape) renders without 500, without client console error, and with the expected content shape (rows / empty state / pagination).

    **Andrew reports per-shape:** for each of the 7 rows above, type "shape N: pass" or "shape N: FAIL — <description>". Or batch: paste a checklist with results.

    **If any shape fails:**
    - Capture the new failure logs (same procedure as Plan 01 Task 1).
    - Decide with Andrew: (a) revise Plan 02's fix in this same phase (do not advance to Plan 03 SUMMARY), or (b) close Phase 26 partially and open a follow-up phase if scope materially expands.
    - The phase is NOT considered done until every required shape passes or is explicitly waived.
  </how-to-verify>
  <resume-signal>
    Type "all shapes pass" once every required shape is verified (or explicitly waived). For partial: type "shape N FAIL: <details>" and Claude will diagnose without closing the phase.
  </resume-signal>
</task>

<task type="auto">
  <name>Task 3: Write phase SUMMARY, update STATE.md and ROADMAP.md, commit planning docs</name>
  <files>
    - .planning/phases/26-bookings-page-crash-debug-fix/26-SUMMARY.md
    - .planning/phases/26-bookings-page-crash-debug-fix/26-03-SUMMARY.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
  </files>
  <action>
    1. Create `.planning/phases/26-bookings-page-crash-debug-fix/26-SUMMARY.md` (the consolidated phase summary). Sections:

       ```markdown
       ---
       phase: 26-bookings-page-crash-debug-fix
       milestone: v1.4
       completed: <YYYY-MM-DD>
       requirements_satisfied: [BOOK-01, BOOK-02]
       affects: [bookings-page-render-path, queries-helper-typing]
       subsystem: bookings-list
       requires: []
       tech-stack:
         added: []
         changed: []
       ---

       # Phase 26 — Bookings Page Crash Debug + Fix

       ## Root Cause
       <One-paragraph from 26-DIAGNOSIS.md (do NOT duplicate full DIAGNOSIS — link it).>

       ## Fix Applied
       <Files modified, what changed, commit hashes from Plan 02.>

       ## Verification Matrix
       <Final 7-row table from Task 2 with pass/waive results.>

       ## Deferred Findings (out of scope, document only)
       From 26-02-SUMMARY.md grep audit:
       - <site>: <classification + rationale>
       - ...
       Recommended follow-up: <Phase 27? new phase? leave indefinite?>

       ## Files of Record
       - 26-CONTEXT.md (locked decisions)
       - 26-RESEARCH.md (candidate enumeration)
       - 26-DIAGNOSIS.md (locked root cause)
       - 26-01-SUMMARY.md (diagnosis recap)
       - 26-02-SUMMARY.md (fix + audit + deploy)
       - 26-03-SUMMARY.md (verification + this consolidation)

       ## Stats
       - Plans: 3 (01 diagnose, 02 fix, 03 verify)
       - Commits: <count from `git log` since phase start>
       - Files modified: <list>
       - Tests added: 1 (tests/query-bookings.test.ts)
       - Time-to-diagnose: <Plan 01 timing>
       - Time-to-fix-and-deploy: <Plan 02 timing>
       - Time-to-verify: <Plan 03 timing>
       ```

    2. Create `26-03-SUMMARY.md` (this plan's local summary, distinct from the phase consolidation). Brief — it just records: "verification matrix completed, all shapes pass, phase SUMMARY consolidated." Link to `26-SUMMARY.md`.

    3. Update `.planning/STATE.md`:
       - Change "Phase 26 next" / "Phase 25 complete" entries to "Phase 26 complete; Phase 27 next."
       - Update "Last updated" timestamp.
       - Update "Current Position" → Milestone v1.4 → Phase 27.
       - Update "Phase queue" — strike Phase 26 line.
       - Append a brief entry under "Accumulated Context → Key decisions carried into v1.4" if the fix's mechanism reveals a project-wide pattern (e.g., "supabase-js !inner returns [] under RLS exclusion — confirmed; use null-filter, not type-cast").

    4. Update `.planning/ROADMAP.md`:
       - Phase 26 section: change `**Plans:** TBD (estimated 1-2 plans)` to `**Plans:** 3 plans`.
       - Replace the bullet `- [ ] 26-01: Diagnose crash...` with three checked entries:
         ```
         Plans:
         - [x] 26-01-PLAN.md — Diagnose `/app/bookings` crash via Vercel logs + SQL Editor (BOOK-01) — completed <date>
         - [x] 26-02-PLAN.md — Implement surgical fix at confirmed site + regression test + deploy (BOOK-01) — completed <date>
         - [x] 26-03-PLAN.md — Verify across 3 seeded accounts + 4 shapes on production (BOOK-02) — completed <date>
         ```
       - Update the "Progress" table: Phase 26 row → `3 / 3` and `✅ Complete` and the completion date.
       - Update "Cumulative Stats" if applicable (total phases shipped count).
       - Update the bottom-of-file timestamp comment.

    5. Commit:
       ```
       docs(26): complete bookings-crash-debug phase

       - Plans: 3 (diagnose → fix → verify)
       - Root cause: <one-line>
       - Fix: <one-line>
       - Verified: 7 shapes on production
       - Andrew sign-off: <date>
       ```
       Files staged: `git add .planning/phases/26-bookings-page-crash-debug-fix/ .planning/STATE.md .planning/ROADMAP.md`

       Use HEREDOC for the commit message body if multi-line, per the project's git conventions.

    6. Push to main: `git push origin main` (planning docs commit; no Vercel impact since `.planning/` is not in the deploy path, but pushing keeps remote in sync).
  </action>
  <verify>
    1. `26-SUMMARY.md` exists with all required sections; root cause and verification matrix are filled in (not stubs).
    2. `STATE.md` reflects Phase 26 complete + Phase 27 next.
    3. `ROADMAP.md` Phase 26 entry shows `[x]` for all three plans, `3 / 3 ✅ Complete` in the Progress table.
    4. `git log -1` shows the docs(26) commit; `git push` succeeded.
    5. No source code modified in this task — planning-doc only.
  </verify>
  <done>
    Phase 26 fully closed: Andrew-verified across all required shapes, SUMMARY consolidated, STATE+ROADMAP updated to advance to Phase 27. The phase is in the "shipped" column.
  </done>
</task>

</tasks>

<verification>
- [ ] All 7 required shapes (3 seeded accounts + empty + cancelled-only + many + mixed-soft-deleted) verified on production OR explicitly waived with rationale.
- [ ] Andrew has typed "all shapes pass" (or equivalent) in chat for Task 2.
- [ ] `26-SUMMARY.md` exists, links to DIAGNOSIS, lists root cause + fix + verification matrix + deferred findings.
- [ ] `STATE.md` updated to mark Phase 26 complete, Phase 27 next.
- [ ] `ROADMAP.md` Phase 26 plans all checked; Progress table shows complete.
- [ ] Planning-doc commit pushed to origin/main.
- [ ] No source code modified in Plan 03 (verification + docs only).
</verification>

<success_criteria>
- BOOK-01 satisfied: `/app/bookings` renders for the seeded NSI account on production.
- BOOK-02 satisfied: `/app/bookings` renders for all three seeded test accounts on production.
- Phase fully documented with reproducible diagnosis + fix + verification trail.
- Roadmap and state advance to Phase 27.
</success_criteria>

<output>
Phase 26 closes with two summary files:
- `26-03-SUMMARY.md` — this plan's local summary (verification + planning-doc updates)
- `26-SUMMARY.md` — the consolidated phase summary (used as input by future phases via the frontmatter dependency-graph protocol)

Both committed to git in Task 3's single commit.
</output>
