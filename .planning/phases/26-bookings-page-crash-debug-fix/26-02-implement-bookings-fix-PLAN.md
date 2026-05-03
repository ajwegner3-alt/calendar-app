---
phase: 26-bookings-page-crash-debug-fix
plan: 02
type: execute
wave: 2
depends_on:
  - "26-01"
files_modified:
  # Exact files determined by 26-DIAGNOSIS.md "Proposed Fix Shape". Most likely candidates:
  - app/(shell)/app/bookings/_lib/queries.ts
  - app/(shell)/app/bookings/_components/bookings-table.tsx
  - tests/query-bookings.test.ts
autonomous: true

must_haves:
  truths:
    - "The exact site named in 26-DIAGNOSIS.md 'Proposed Fix Shape' has been modified (and only that site, plus any consumers required by a type signature change)."
    - "ONE regression test exists that, with the fix reverted, fails on the diagnosed shape; with the fix in place, passes."
    - "All existing tests still pass (vitest suite green)."
    - "TypeScript build is clean (`npx tsc --noEmit` zero errors); production build succeeds (`npm run build`)."
    - "A grep audit of `!inner` join sites has been performed; risky-but-not-broken sites are documented in the Plan 02 SUMMARY (NOT fixed)."
    - "The fix is pushed to `main`; Vercel deploy succeeds (status: Ready) on the production deployment."
  artifacts:
    - path: ".planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md"
      provides: "Locked fix shape that this plan implements"
      contains: "Proposed Fix Shape"
    - path: "tests/query-bookings.test.ts"
      provides: "Regression test matching the diagnosed crash shape"
      contains: "describe"
  key_links:
    - from: "26-DIAGNOSIS.md Proposed Fix Shape"
      to: "actual code change"
      via: "implemented at named file:line"
      pattern: "diff matches Proposed Fix Shape exactly"
    - from: "regression test"
      to: "diagnosed mechanism"
      via: "test reproduces the bad input shape and asserts no throw / correct output"
      pattern: "test fails when fix is reverted"
---

<objective>
Implement the surgical fix at the site confirmed in `26-DIAGNOSIS.md`. Add ONE targeted regression test. Run a grep audit on adjacent `!inner` consumers (document risk, do not fix). Push to main and confirm Vercel deploy.

Purpose: Close the bookings-page crash for all production accounts via the minimum change that demonstrably resolves the diagnosed mechanism.

Output: One source-code change at the named site (with caller updates if a type signature widens), one regression test, one Vercel-deployed commit (or 2-3 commits if a refactor warrants splitting). Plus an audit note in this plan's SUMMARY.

**Hard constraints (CONTEXT + V14-MP-04):**
- NO speculative null guards on `bookings-table.tsx:108` or anywhere else "to be safe." Lines that are already optional-chained stay optional-chained; lines that aren't and aren't named in the diagnosis stay un-touched.
- NO `?? []` or `?? { name: "", duration_minutes: 0 }` defensive belts at the helper layer. If the type allows null, surface it through the type system and let consumers handle it. If a row must be excluded, FILTER it (drop the row), don't synthesize a fake one.
- The grep audit is for DOCUMENTATION only. Do NOT "while we're here" fix sites that aren't actually broken (CONTEXT: "Document risks in SUMMARY but do NOT fix sites that aren't actually broken").
- If `26-DIAGNOSIS.md` "Proposed Fix Shape" calls for DDL or RLS changes (Candidate D path), CONTEXT permits it BUT requires flagging the escalation in SUMMARY before applying. Use `npx supabase db query --linked -f <file>` apply path (NOT `supabase db push --linked` — broken in this repo per STATE.md).
- If the root cause lives in a helper whose return type is inherently bug-prone, CONTEXT directs: refactor the signature so the bug class becomes impossible at the type level, update all callers in the same commit.
- Single safety net at the page-component boundary (e.g., a minimal `error.tsx` for `app/(shell)/app/bookings/`) is acceptable IF it preserves a useful failure mode (loud `console.error`, no swallowed stack, no raw stack to contractor users). Add it only if the fix shape calls for it; do not add it reflexively.
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
@.planning/research/PITFALLS.md

# Suspect files (exact set determined by DIAGNOSIS Proposed Fix Shape)
@app/(shell)/app/bookings/_lib/queries.ts
@app/(shell)/app/bookings/_components/bookings-table.tsx
@app/(shell)/app/bookings/page.tsx

# Existing test pattern reference
@tests/load-month-bookings.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement the surgical fix per 26-DIAGNOSIS.md Proposed Fix Shape</name>
  <files>
    Determined by `26-DIAGNOSIS.md` → "Proposed Fix Shape". Most likely subset (single fix site + at most its consumers if a type widens):
    - app/(shell)/app/bookings/_lib/queries.ts
    - app/(shell)/app/bookings/_components/bookings-table.tsx
    (If Candidate D / data-fix path: also a one-off SQL file in supabase/ scratch space, not a migration unless explicitly justified in DIAGNOSIS.)
  </files>
  <action>
    Re-read `26-DIAGNOSIS.md` first. The "Proposed Fix Shape" section names exactly what to change.

    **Procedure:**

    1. Open `26-DIAGNOSIS.md` and copy the "Proposed Fix Shape" line(s) into working memory.
    2. Open the named file at the named line. Sanity-check the current code matches what DIAGNOSIS describes — if file has drifted since diagnosis (unlikely but possible), pause and re-confirm with Andrew.
    3. Implement the change as described. Common shapes (apply the one named in DIAGNOSIS):

       **Shape B-fix (normalization yields undefined):**
       In `app/(shell)/app/bookings/_lib/queries.ts`:
       - Update `BookingRow` type: change `event_types: { id: string; name: string; duration_minutes: number }` to `event_types: { id: string; name: string; duration_minutes: number } | null`.
       - In the normalization map (lines 91-99), keep the array-or-object normalization, but stop casting `et` to non-null. After mapping, FILTER OUT rows where `et` is `undefined` or `null`:
         ```ts
         const rows = (data ?? [])
           .map((row) => {
             const et = Array.isArray(row.event_types) ? row.event_types[0] : row.event_types;
             return { ...row, event_types: et ?? null };
           })
           .filter((row) => row.event_types !== null) as BookingRow[];
         ```
         (Or, if DIAGNOSIS says null-fill is correct: keep the row and use `event_types: null`. Pick whichever DIAGNOSIS named.)
       - If the type widens to `... | null`, audit ALL consumers in the same commit. Confirmed consumers (from RESEARCH §"Render Path"): `bookings-table.tsx:66-67` (already uses `?.`, no change needed) and the count returned to pagination (also no change). If any other consumer accesses `event_types.<x>` without `?.`, fix it here.

       **Shape C-fix (formatBookerStart RangeError):**
       In `app/(shell)/app/bookings/_components/bookings-table.tsx:33-39`:
       - Wrap the TZDate construction in a try/catch that returns a sentinel like `"—"` (em dash) on RangeError:
         ```ts
         function formatBookerStart(row: BookingRow): string {
           try {
             const z = new TZDate(new Date(row.start_at), row.booker_timezone || "UTC");
             return format(z, "MMM d, yyyy 'at' h:mm a (zzz)");
           } catch (err) {
             console.error("[bookings-table] formatBookerStart failed", { id: row.id, tz: row.booker_timezone, err });
             return "—";
           }
         }
         ```
         The `|| "UTC"` covers empty-string; the try/catch covers genuinely-invalid IANA strings AND bad `start_at`. The `console.error` preserves the loud-failure bias (CONTEXT) while the `"—"` cell preserves the rest-of-row render (useful failure mode).

       **Shape D-fix (RLS / data drift):**
       - If DIAGNOSIS names specific drifted booking IDs: write a one-off SQL UPDATE script at `supabase/scripts/26-data-fix-cross-account-bookings.sql` (NOT a migration) to repair the rows. Andrew runs it via SQL Editor or `npx supabase db query --linked -f supabase/scripts/26-data-fix-cross-account-bookings.sql`.
       - Flag the escalation in this plan's SUMMARY: "DDL/data fix applied at <date>; recommend Phase 27 add CHECK constraint preventing future drift."
       - Even if data is repaired, a code defense at the helper boundary is still valuable; pair it with the Shape B-fix filter to prevent recurrence.

       **Shape A-fix (PostgREST error throw):**
       - The fix depends on the specific PostgREST message. If it's RLS-related from Candidate D, see Shape D. If it's schema-cache, the fix may be ops-only (regenerate types via `npx supabase gen types typescript --local`); document in SUMMARY and skip code change.

       **Other shape:** Follow exactly what DIAGNOSIS says. Do not improvise.

    4. Run `npx tsc --noEmit` to confirm TypeScript build is clean. Fix any new type errors that surface (these usually indicate a missed consumer when widening a type).
    5. Run `npm run lint` if the project has it; fix any new warnings/errors introduced by the change.
    6. Commit with message:
       ```
       fix(26-02): <one-line summary matching DIAGNOSIS mechanism>

       Root cause: <one-line from DIAGNOSIS Mechanism>
       Fix: <one-line description of change>
       Refs: 26-DIAGNOSIS.md
       ```
       Example: `fix(26-02): filter rls-excluded event_types rows from bookings query`
  </action>
  <verify>
    `npx tsc --noEmit` exits 0. `npm run build` succeeds locally (or at minimum `npx next build` if that's the project command). The change made exactly matches the DIAGNOSIS Proposed Fix Shape — no extra "while we're here" defensive guards, no edits to files not named in DIAGNOSIS or required by a type widening. `git diff HEAD~1` shows a focused, reviewable diff.
  </verify>
  <done>
    Single commit on `main` (or working branch ready to merge) implementing the named fix. TypeScript clean. No speculative changes outside DIAGNOSIS scope.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add ONE targeted regression test matching the diagnosed shape</name>
  <files>tests/query-bookings.test.ts</files>
  <action>
    Per CONTEXT: "Add ONE targeted regression test that would have caught this specific crash. No broader test sweep."

    1. Re-read `tests/load-month-bookings.test.ts` for the canonical pattern (vitest + `@vitest-environment node` + `vi.mock("@/lib/supabase/server", ...)` + structural mock of the supabase client chain).

    2. Create `tests/query-bookings.test.ts` with a single `describe` block targeting the diagnosed shape. Test content depends on which Shape was fixed:

       **For Shape B-fix:**
       Test that `queryBookings` correctly handles a fixture where one row's `event_types` is `[]` (empty array, RLS-excluded join). Assert: result does NOT include the bad row, OR includes it with `event_types: null` (matching whichever the fix chose). Assert no throw. Example structure:

       ```ts
       /** @vitest-environment node */
       import { describe, expect, it, vi, beforeEach } from "vitest";

       const mockGetClaims = vi.fn();
       const mockFrom = vi.fn();

       vi.mock("@/lib/supabase/server", () => ({
         createClient: vi.fn(async () => ({
           auth: { getClaims: mockGetClaims },
           from: mockFrom,
         })),
       }));

       describe("queryBookings — RLS-excluded event_types row handling", () => {
         beforeEach(() => {
           mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-uuid" } } });
         });

         it("filters out rows whose event_types join returned an empty array", async () => {
           // Build a supabase chain that returns three rows:
           //   - row A: event_types = [{ id, name, duration_minutes }]   (good)
           //   - row B: event_types = []                                 (RLS-excluded — was crashing)
           //   - row C: event_types = { id, name, duration_minutes }    (good, single object shape)
           // Construct the mock chain matching queries.ts:42-83 exactly.
           // Import { queryBookings } from "@/app/(shell)/app/bookings/_lib/queries";
           // Call queryBookings(...).
           // Assert: result.rows has 2 entries (A and C), B is dropped.
           // Assert: no throw.
         });
       });
       ```

       Fill in the actual mock chain to match queries.ts request shape. If the chain is awkward to mock structurally, mirror the helper functions used in `tests/load-month-bookings.test.ts:16-40`.

       **For Shape C-fix:**
       Test that `formatBookerStart` (export it from `bookings-table.tsx` if not already exported, OR test indirectly through the table render in a smoke test) returns `"—"` when given a row with `booker_timezone = ""`, AND when given an invalid IANA string like `"Not/A/Zone"`. Assert no throw.

       **For Shape D-fix or other:** Match the bad data shape with a fixture; assert the helper returns the expected normalized output without throwing.

    3. Confirm the test FAILS without the fix:
       - `git stash` (set aside the fix from Task 1).
       - Run `npx vitest run tests/query-bookings.test.ts`. The test MUST fail (the whole point of a regression test).
       - `git stash pop` (restore the fix).
       - Run again. The test MUST pass.

    4. Run the full vitest suite: `npx vitest run`. All 222+ existing tests still pass; new test passes; total count is 223+ passing.

    5. Commit:
       ```
       test(26-02): add regression test for <diagnosed shape>

       Refs: 26-DIAGNOSIS.md
       ```
  </action>
  <verify>
    `npx vitest run tests/query-bookings.test.ts` passes. With the fix from Task 1 reverted via `git stash`, the same test FAILS (proving it would have caught the crash). After `git stash pop`, full suite `npx vitest run` reports all tests pass with one new passing test. Commit lands on the same branch as Task 1.
  </verify>
  <done>
    `tests/query-bookings.test.ts` exists, has at least one passing test that demonstrably catches the diagnosed regression, and the full test suite is green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Grep audit of !inner consumers + push to main + confirm Vercel deploy</name>
  <files>
    No source files modified. Audit findings recorded in `26-02-SUMMARY.md` (created at end of plan).
    Push triggers Vercel deploy of files modified in Tasks 1+2.
  </files>
  <action>
    **Part A — Grep audit (documentation only, NO fixes):**

    1. Run a grep for `!inner` across the runtime source tree:
       ```
       grep -rn "!inner" app/ lib/ --include="*.ts" --include="*.tsx"
       ```
       Or use the Grep tool with pattern `!inner`, glob `**/*.{ts,tsx}`.

    2. For each hit, briefly classify (1 line each in the SUMMARY audit table):
       - **OK** — already normalized + null-safe consumers; no risk class identified
       - **DOCUMENT-RISK** — uses the same pattern but a different consumer access pattern; if root cause B/D, this may be vulnerable; flag for future hardening
       - **FIXED** — site fixed in this phase

    3. Cross-reference the table in `26-RESEARCH.md` §"Grep Audit" (lines 132-144). Most sites should match the prior audit. Note any new sites that have appeared since research date.

    4. Specifically inspect (per RESEARCH "Recommendation"):
       - `app/(shell)/app/_lib/load-month-bookings.ts:62` — uses `?.name ?? ""`, no normalization. Document as DOCUMENT-RISK if a future caller accesses `account_id` (currently doesn't).
       - `app/(shell)/app/_lib/regenerate-reschedule-token.ts:55` — inline access, single-row. LOW risk per RESEARCH; document as such.

    5. Do NOT modify any of these sites. CONTEXT: "Document risks in SUMMARY but do NOT fix sites that aren't actually broken."

    **Part B — Push to main, trigger Vercel deploy:**

    6. `git status` to confirm clean working tree (only the Tasks 1+2 commits ahead of origin).
    7. `git push origin main` (or current branch + merge if Andrew prefers — STATE.md confirms direct-to-main is the default for this repo per "All testing is done live; push to GitHub immediately to deploy").
    8. Watch the Vercel deploy. From a terminal:
       ```
       npx vercel --token "$VERCEL_TOKEN" inspect <latest-deployment-url> 2>/dev/null
       ```
       Or, if Vercel CLI is not configured, ask Andrew to confirm Vercel dashboard shows the deployment status as "Ready" (green) within ~3 minutes of push.
    9. If deploy FAILS (build error caught only on Vercel, not local): read the Vercel build log, fix the issue, push again. Do not proceed to Plan 03 with a failed deploy.

    **Part C — Write Plan 02 SUMMARY:**

    10. Create `.planning/phases/26-bookings-page-crash-debug-fix/26-02-SUMMARY.md` with:
        - Recap of fix (link to 26-DIAGNOSIS.md, do not duplicate)
        - List of commits (hashes + messages)
        - **Audit table** of `!inner` sites with classification (OK / DOCUMENT-RISK / FIXED)
        - **Deferred items** for Phase 26 final SUMMARY (Plan 03 will consolidate):
          * Sites flagged DOCUMENT-RISK in audit
          * Any DDL escalations (if Shape D-fix applied)
          * Any error.tsx boundary considerations deferred
        - Vercel deploy URL + status timestamp
  </action>
  <verify>
    1. Grep audit table appears in `26-02-SUMMARY.md` covering every `!inner` site found.
    2. `git log origin/main..HEAD` returns empty (push succeeded).
    3. Vercel deploy status is "Ready" for the commit at HEAD on production.
    4. Visiting the deploy URL `/app/bookings` no longer crashes for the failing account from DIAGNOSIS (smoke test only — formal verification across all 7 shapes happens in Plan 03).
  </verify>
  <done>
    Audit documented (not fixed); push complete; Vercel deploy Ready; smoke test on the original failing account passes (page renders, no 500). Plan 03 ready to start.
  </done>
</task>

</tasks>

<verification>
- [ ] Fix matches `26-DIAGNOSIS.md` Proposed Fix Shape exactly (no scope creep, no speculative guards).
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` (or `npx next build`) succeeds.
- [ ] `npx vitest run` passes — 223+ tests, including the one new regression test.
- [ ] Regression test demonstrably FAILS with fix reverted, PASSES with fix applied.
- [ ] Grep audit recorded in 26-02-SUMMARY.md; no fixes applied to sites not named in DIAGNOSIS.
- [ ] `git push origin main` succeeded; Vercel deploy status = Ready.
- [ ] Smoke test: original failing account renders `/app/bookings` on production.
- [ ] V14-MP-04 honored: no speculative null guards added; only the named site changed.
- [ ] Deferred findings (audit risks, possible DDL escalations) listed in 26-02-SUMMARY.md for Plan 03 consolidation.
</verification>

<success_criteria>
- Code fix lands on production matching DIAGNOSIS.
- Regression test exists that would have caught this specific crash.
- Vercel deploy succeeded.
- Smoke test on the failing account passes.
- Audit findings documented for Plan 03 SUMMARY consolidation.
</success_criteria>

<output>
After completion, create `.planning/phases/26-bookings-page-crash-debug-fix/26-02-SUMMARY.md` containing:
- Fix recap (1-2 sentences, link to DIAGNOSIS.md)
- Commit list (hashes + messages from Tasks 1, 2, and Task 3 if any rebuild commits)
- Files modified (exact paths)
- Grep audit table (file:line | classification | rationale)
- Deferred items for Phase 26 final SUMMARY in Plan 03
- Vercel deploy URL + status + timestamp
- Smoke test result for the originally-failing account
</output>
