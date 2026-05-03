---
phase: 28-per-event-type-buffer-and-column-drop
plan: 03
type: execute
wave: 3
depends_on: ["28-02"]
files_modified:
  - tests/slot-generation.test.ts
autonomous: false

must_haves:
  truths:
    - "BUFFER-06 divergence tests are green (3 cases covering candidate buffer=0/15 and existing-booking buffer=0/15 combinations)"
    - "Full vitest suite is green after 28-01+28-02 ship — no regressions in slots-api, cross-event-overlap, or other test files"
    - "Andrew live-verifies on the nsi production account that setting an event type's buffer to 15 hides adjacent slots after a confirmed booking, and setting it to 0 makes them available"
    - "Andrew live-verifies cross-event-type divergence: booking on event-A with buffer=15 blocks event-B's adjacent slot only via the existing booking's buffer, and event-B with buffer=0 still does not extend its own forward block"
    - "No `accounts.buffer_minutes` reference remains in code, tests, or database"
  artifacts:
    - path: "tests/slot-generation.test.ts"
      provides: "BUFFER-06 divergence test block — 3 cases verified green; existing buffer test rewritten for asymmetric API"
      contains: "per-event-type buffer divergence"
  key_links:
    - from: "tests/slot-generation.test.ts BUFFER-06 block"
      to: "lib/slots.ts slotConflictsWithBookings"
      via: "Asymmetric per-booking + per-slot buffer math under unit test"
      pattern: "buffer_after_minutes"
    - from: "Andrew live verification on nsi"
      to: "production slot picker behavior"
      via: "BUFFER-06 smoke checkpoint — divergence visible in browser"
      pattern: "browser DOM"
---

<objective>
Confirm Phase 28 is correct in production: vitest suite (including BUFFER-06 divergence tests) is fully green after the DROP, and Andrew live-verifies on the `nsi` production account that per-event-type buffer behavior matches expectations end-to-end. This is the BUFFER-06 smoke checkpoint that gates the phase as DONE.

Purpose: Plans 28-01 and 28-02 individually verified their own slices but did not verify the system end-to-end on production data. Plan 28-03 closes that gap with a programmatic test sweep plus a human visual confirmation.

Output: Vitest green, Andrew-approved smoke proof; phase ready to mark shipped.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/28-per-event-type-buffer-and-column-drop/28-CONTEXT.md
@.planning/phases/28-per-event-type-buffer-and-column-drop/28-RESEARCH.md
@.planning/phases/28-per-event-type-buffer-and-column-drop/28-01-SUMMARY.md
@.planning/phases/28-per-event-type-buffer-and-column-drop/28-02-SUMMARY.md
@tests/slot-generation.test.ts
@tests/slots-api.test.ts
@tests/cross-event-overlap.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify BUFFER-06 divergence tests + full suite are green post-DROP</name>
  <files>tests/slot-generation.test.ts</files>
  <action>
Plan 28-01 already added the BUFFER-06 divergence describe block. This task verifies the tests are intact, behave correctly post-DROP, and adds any case found missing. Plan 28-02 dropped the column, which can incidentally surface latent bugs (e.g., a test that read `buffer_minutes` from a fixture).

Step 1 — Run the BUFFER-06 block in isolation:
```bash
npx vitest run tests/slot-generation.test.ts -t "per-event-type buffer divergence"
```
Expected: 3 tests pass.

Step 2 — Read the existing BUFFER-06 block in `tests/slot-generation.test.ts`. Confirm the three cases cover:
1. Candidate event type with buffer=0 + existing booking with buffer=0 → adjacent slot IS available.
2. Candidate event type with any buffer + existing booking with buffer=15 → adjacent slot NOT available (existing booking's post-buffer dominates).
3. Divergence assertion: changing the candidate's buffer (0 vs 15) does NOT change blocking when the existing booking's buffer is fixed at 15 — proves the asymmetric semantics (existing booking's buffer is what blocks the front of the candidate slot, not the candidate's own buffer).

If any of those three cases is missing or wrong, ADD or FIX it using the templates in `28-RESEARCH.md` "Code Examples" section. The reference test snippet there is the source of truth.

Step 3 — Run the full vitest suite:
```bash
npx vitest run
```
Expected: full green. The pre-28 baseline was 225 passing + 9 skipped without `SUPABASE_DIRECT_URL`. Post-28 expectation: at least 228 passing (+3 BUFFER-06 cases) + 9 skipped, OR if `SUPABASE_DIRECT_URL` is set in the environment, ≥232 + 4. Any failures here are regressions caused by 28-02; investigate immediately.

Step 4 — Run pg-driver tests if `SUPABASE_DIRECT_URL` is set:
```bash
npx vitest run tests/cross-event-overlap.test.ts
```
This file uses real DB. After the DROP, it must still pass. If `accounts.buffer_minutes` was referenced in the test fixture (it should NOT be — RESEARCH confirmed), this is where it surfaces.

Step 5 — Confirm code-side hygiene one more time:
```bash
grep -rn "buffer_minutes" app/ lib/ tests/ --include="*.ts" --include="*.tsx"
grep -rn "post_buffer_minutes" . --include="*.ts" --include="*.tsx" --include="*.sql"
```
First grep: only `buffer_after_minutes` matches expected (the substring `buffer_minutes` won't appear in isolation because every instance was renamed). Second grep: 0 matches.

Step 6 — If any test was added/edited, commit:
```bash
git add tests/slot-generation.test.ts
git commit -m "test(28-03): finalize BUFFER-06 divergence cases post-DROP"
git push origin main
```
If no edits were needed (all tests already green from 28-01), skip the commit and proceed to Task 2.
  </action>
  <verify>
- `npx vitest run -t "per-event-type buffer divergence"` shows 3 passing tests
- `npx vitest run` (full suite) is green; total passing count ≥ pre-Phase-28 baseline + 3
- `grep -rn "post_buffer_minutes" .` returns 0 matches
- `grep -rn "buffer_minutes" tests/` shows only `buffer_after_minutes` matches (no bare `buffer_minutes`)
  </verify>
  <done>
Vitest is green and the BUFFER-06 divergence is provably correct in code. Ready for the production smoke checkpoint.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Per-event-type buffer is fully wired: backfill applied, slot engine using asymmetric math, event-type editor exposes the field, list table shows it, account-wide buffer is gone from code and DB, and unit tests prove BUFFER-06 divergence. Andrew now confirms behavior on the live `nsi` account.
  </what-built>
  <how-to-verify>
**Setup (one-time):** Sign in to the production app as the `nsi` account owner. Open two browser tabs:
- Tab A: `https://<prod-url>/app/event-types` (owner-side editor)
- Tab B: `https://<prod-url>/nsi/<some-event-slug>` (public booker for the same event type)

**Verification 1 — Editor exposes buffer correctly (BUFFER-01, BUFFER-05)**
1. In Tab A, open any event type's editor.
2. Confirm a "Buffer after event" number input appears DIRECTLY AFTER the Duration field, with `min=0`, `max=360`, `step=5` and a help line below it.
3. Confirm the event-types list (Tab A index) shows a "Buffer" column for every row, including rows where the value is 0 (must show literal `0 min`, not blank).
4. Open `https://<prod-url>/app/availability`. Confirm there is NO Buffer field anywhere on the page. Confirm the page subtitle reads "...customize notice and caps" (not "buffers, notice, and caps").

**Verification 2 — Per-event-type buffer takes effect (BUFFER-02)**
1. In Tab A, set `event-type-A` buffer to **15** and save.
2. Use the dashboard to manually create or simulate a confirmed booking on `event-type-A` at, say, today 10:00–10:30 local. (Simplest: book it yourself via Tab B.)
3. Reload Tab B for `event-type-A`. Confirm the 10:30 slot is HIDDEN (existing booking's 15-min post-buffer extends to 10:45 → next free slot starts at 10:45 or later, not 10:30).
4. Set `event-type-A` buffer back to **0** and save.
5. Reload Tab B. Confirm the 10:30 slot is now VISIBLE again.

**Verification 3 — Cross-event-type divergence (BUFFER-06 smoke)**
1. Create or pick `event-type-B` on the same `nsi` account. Set its buffer to **0**.
2. With the booking from Verification 2 still in place on `event-type-A` (buffer=15 at the time of booking), open Tab B for `event-type-B`. Confirm the 10:30 slot is HIDDEN (the existing booking's stored buffer-after value blocks across event types — asymmetric semantics in action).
3. Now create a fresh booking on `event-type-B` (buffer=0) at, say, 14:00–14:30 today. Reload Tab B for `event-type-A`. Confirm the 14:30 slot IS VISIBLE (the existing event-B booking's 0-min buffer does not extend; event-A's own buffer is 0 too).

**Verification 4 — Layout / no regressions**
1. Confirm the public booker page on Tab B still loads cleanly (no 500s, no blank-screen).
2. Confirm the event-type editor saves changes successfully (button click, success toast or redirect).

**If anything fails:** Describe the failure precisely (which step, which event type, expected vs. actual). Plan 28-03 will spawn a gap-closure plan.
  </how-to-verify>
  <resume-signal>Type "buffer smoke approved" to mark Phase 28 complete, or describe failures (which Verification step + observed vs. expected behavior).</resume-signal>
</task>

</tasks>

<verification>
Final phase-level verification (already covered piecewise — restated for SUMMARY):

```bash
# Tests
npx vitest run

# Code state
grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"     # 0 matches
grep -rn "post_buffer_minutes" . --include="*.ts" --include="*.tsx" --include="*.sql"  # 0 matches

# DB state
echo "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'buffer_minutes';" | npx supabase db query --linked
# 0 rows

echo "SELECT slug, buffer_after_minutes FROM event_types ORDER BY 1;" | npx supabase db query --linked
# Each row shows its per-event buffer
```
</verification>

<success_criteria>
1. BUFFER-06 divergence tests (3 cases) green in `tests/slot-generation.test.ts`.
2. Full vitest suite green; counts at or above pre-Phase-28 baseline + 3.
3. Andrew live-verifies all four production checks on `nsi` and types "buffer smoke approved".
4. All five ROADMAP Phase 28 success criteria satisfied (owner editor field, asymmetric blocking, cross-event-type divergence, no buffer field on availability, column dropped).
5. All six BUFFER-XX requirements (BUFFER-01 through BUFFER-06) marked shipped in REQUIREMENTS.md traceability.
</success_criteria>

<output>
After completion, create `.planning/phases/28-per-event-type-buffer-and-column-drop/28-03-SUMMARY.md` with:
- Vitest result counts (passing / skipped / failed) — full suite and BUFFER-06 block
- Andrew approval timestamp and any failure notes from the live verification
- Final production-state confirmations (DB column gone, code grep clean, owner UI verified)
- Phase 28 marked complete in the SUMMARY
</output>
