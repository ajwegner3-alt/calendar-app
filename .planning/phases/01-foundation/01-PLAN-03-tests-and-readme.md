---
phase: 01-foundation
plan: 03
type: execute
wave: 3
depends_on: ["01-PLAN-01", "01-PLAN-02"]
files_modified:
  - package.json
  - package-lock.json
  - vitest.config.ts
  - tests/setup.ts
  - tests/helpers/supabase.ts
  - tests/race-guard.test.ts
  - tests/rls-anon-lockout.test.ts
  - README.md
  - .gitignore
autonomous: false

must_haves:
  truths:
    - "`npm test` runs both Vitest test files to completion with exit code 0"
    - "`tests/race-guard.test.ts` inserts 10 parallel confirmed bookings on the same (event_type_id, start_at) and asserts exactly 1 fulfilled + 9 rejected with unique-constraint violations"
    - "`tests/rls-anon-lockout.test.ts` attempts SELECT and INSERT on all 6 tables via anon client and asserts all SELECTs return empty arrays and all INSERTs return errors"
    - "README documents cloning, installing, linking Supabase, pushing migrations, seeding, running dev, running tests, and deploying — end to end"
    - "Final commit pushes to main and Vercel production deploy succeeds"
  artifacts:
    - path: "vitest.config.ts"
      provides: "Vitest config with vite-tsconfig-paths + @vitejs/plugin-react, 15s timeout"
      contains: "tsconfigPaths"
    - path: "tests/setup.ts"
      provides: "dotenv loader for .env.local test env"
    - path: "tests/helpers/supabase.ts"
      provides: "anonClient(), adminClient(), getOrCreateTestAccount(), getOrCreateTestEventType(), TEST_ACCOUNT_SLUG='nsi-test'"
      exports: ["anonClient", "adminClient", "getOrCreateTestAccount", "getOrCreateTestEventType", "TEST_ACCOUNT_SLUG"]
    - path: "tests/race-guard.test.ts"
      provides: "FOUND-04 verification test - N=10 parallel confirmed inserts"
      contains: "Promise.allSettled"
    - path: "tests/rls-anon-lockout.test.ts"
      provides: "FOUND-05 verification test - anon locked out of all 6 tables"
      contains: "anonClient"
    - path: "README.md"
      provides: "Full getting-started guide"
      min_lines: 30
  key_links:
    - from: "tests/race-guard.test.ts"
      to: "partial unique index bookings_no_double_book"
      via: "Promise.allSettled with 10 parallel inserts - unique constraint rejects 9"
      pattern: "Promise.allSettled"
    - from: "tests/rls-anon-lockout.test.ts"
      to: "RLS policies (no anon grants)"
      via: "anonClient().from(table).select() returns empty / insert returns error for all 6 tables"
      pattern: "anonClient"
    - from: "tests/helpers/supabase.ts"
      to: ".env.local"
      via: "process.env.NEXT_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY + SERVICE_ROLE_KEY loaded via tests/setup.ts"
      pattern: "process.env.NEXT_PUBLIC_SUPABASE"
---

<objective>
Install the Vitest test harness, write the two required Phase-1 tests that prove the DB-level guarantees (race guard + RLS anon lockout), expand the README into a complete getting-started guide, and land a final Vercel deploy that proves everything ships together. After this plan, Phase 1 is DONE.

Purpose: The race-guard and RLS tests are the evidence that FOUND-04 and FOUND-05 actually work at the DB layer (not just claimed in SQL). Downstream phases — especially Phase 4 DST tests and Phase 8 RLS matrix — plug into this test harness, so getting it right once saves rework later. The README completion is the last piece that lets Andrew (or a future Claude) re-create the dev environment from scratch.

Output: Two passing Vitest tests, a full README, a final commit on main, and a final Vercel production deploy. Phase 1 success criteria 1-5 from ROADMAP.md are all satisfied.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md

# Prior plans in this phase
@.planning/phases/01-foundation/01-PLAN-01-SUMMARY.md
@.planning/phases/01-foundation/01-PLAN-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Vitest, wire config + helpers, write race-guard + RLS tests</name>
  <files>package.json, vitest.config.ts, tests/setup.ts, tests/helpers/supabase.ts, tests/race-guard.test.ts, tests/rls-anon-lockout.test.ts, .gitignore</files>
  <action>
1. **Install test deps** (versions from RESEARCH.md Section 1):
   ```bash
   npm install -D vitest@^4.1.4 @vitejs/plugin-react@^6.0.1 jsdom@^29.0.2 \
     @testing-library/react@^16.3.2 @testing-library/dom@latest \
     @testing-library/jest-dom@^6.9.1 vite-tsconfig-paths@^6.1.1 dotenv
   ```
   `dotenv` is needed for `tests/setup.ts` to load `.env.local` into `process.env`.

2. **Add scripts to `package.json`**:
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "test:ui": "vitest --ui"
     }
   }
   ```
   (Keep existing `dev`, `build`, `start`, `lint` scripts intact.)

3. **Create `vitest.config.ts`** at project root, verbatim from RESEARCH.md Section 6:
   ```ts
   import { defineConfig } from "vitest/config";
   import react from "@vitejs/plugin-react";
   import tsconfigPaths from "vite-tsconfig-paths";

   export default defineConfig({
     plugins: [tsconfigPaths(), react()],
     test: {
       environment: "jsdom",
       setupFiles: ["./tests/setup.ts"],
       include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
       testTimeout: 15_000,
     },
   });
   ```

4. **Create `tests/setup.ts`**:
   ```ts
   import { config } from "dotenv";
   config({ path: ".env.local" });
   config({ path: ".env.test.local", override: true });
   ```

5. **Create `tests/helpers/supabase.ts`** verbatim from RESEARCH.md Section 6:
   - `anonClient()` uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `persistSession: false`.
   - `adminClient()` uses `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `persistSession: false, autoRefreshToken: false`.
   - `TEST_ACCOUNT_SLUG = "nsi-test"` (DIFFERENT from Andrew's real `nsi` slug — tests never touch the production seed row).
   - `getOrCreateTestAccount()` returns the test account id, creating it via admin client if missing.
   - `getOrCreateTestEventType(accountId)` returns a test event-type id (slug `test-race`, 30-minute duration).

6. **Create `tests/race-guard.test.ts`** verbatim from RESEARCH.md Section 6:
   - First line: `// @vitest-environment node` (overrides the jsdom default — DB-only test, no DOM needed).
   - `beforeAll` sets up `accountId` + `eventTypeId` via the helpers.
   - Test body: picks a unique `startAt` in the future, deletes any prior booking at that slot, fires N=10 parallel inserts via `Promise.allSettled`, asserts exactly 1 succeeded and 9 failed with errors, then cleans up.
   - Critical assertions:
     ```ts
     expect(succeeded.length).toBe(1);
     expect(failed.length).toBe(N - 1);
     ```
   - Note the "supabase-js resolves the Promise even on DB error" comment — the test checks `r.value.error` inside `fulfilled` results, not just `rejected`.

7. **Create `tests/rls-anon-lockout.test.ts`** verbatim from RESEARCH.md Section 6:
   - First line: `// @vitest-environment node`.
   - `TABLES` const = the six tables: `accounts, event_types, availability_rules, date_overrides, bookings, booking_events`.
   - For each table, two `it` blocks:
     - SELECT: either `data === []` OR `error` is truthy.
     - INSERT with empty body: `error` MUST be truthy.
   - Acceptance for both outcomes on SELECT is intentional — supabase-js returns `data:[]` under some RLS shapes and errors under others; both are "anon blocked."

8. **Confirm `.gitignore`** excludes `.env.local`, `.env.test.local`, `node_modules/`. Add any missing entries.

9. **Run the tests**:
   ```bash
   npm test
   ```
   Expected: both test files run, all assertions pass, exit code 0.

   If the race test fails with `succeeded.length === 0` (all rejected), investigate: the unique index may not exist (re-check Plan 02 migration), or the admin client is failing to insert for a non-index reason (check `r.value.error` on the first failed result).

   If the RLS test fails with `data` having rows on a SELECT, investigate: a policy is accidentally granting anon access (re-check Plan 02 RLS migration — should be ZERO policies `to anon`).

10. **Commit**:
    ```bash
    git add package.json package-lock.json vitest.config.ts tests/ .gitignore
    git commit -m "test(01): add race-guard + RLS anon-lockout Vitest suite"
    git push
    ```

DO NOT do in this task:
- Write tests for anything beyond FOUND-04 and FOUND-05 (DST, booking flow, etc. are later phases).
- Install Playwright.
- Create a separate test Supabase project.
- Touch `.env.local` values.
  </action>
  <verify>
1. `test -f vitest.config.ts` AND `test -f tests/setup.ts` AND `test -f tests/helpers/supabase.ts`.
2. `test -f tests/race-guard.test.ts` AND `test -f tests/rls-anon-lockout.test.ts`.
3. `grep -q '"test": "vitest run"' package.json`.
4. `grep -q "Promise.allSettled" tests/race-guard.test.ts`.
5. `grep -q "anonClient" tests/rls-anon-lockout.test.ts`.
6. `npm test` exits with code 0. Output shows:
   - `bookings race guard (FOUND-04)` -> 1 passed
   - `RLS anon lockout (FOUND-05)` -> 12 passed (6 SELECTs + 6 INSERTs)
7. Re-running `npm test` passes again (idempotent — race test cleans up its own slot, RLS test doesn't insert).
8. Git push succeeded; Vercel auto-deploy passed.
  </verify>
  <done>
Vitest is installed and configured. Two test files prove the DB-level guarantees at the heart of Phase 1: (a) the partial unique index on bookings rejects all but one of N parallel confirmed-status inserts for the same slot (FOUND-04), and (b) the anon Supabase client cannot SELECT or INSERT against any of the six tables (FOUND-05). Test run is fully reproducible via `npm test` against the remote Supabase project. Committed to main; Vercel auto-deploy green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Write full README + final deploy verification</name>
  <files>README.md</files>
  <action>
1. **Expand `README.md`** to include all of the following sections (markdown, clean headings, no emojis):

   **# calendar-app**
   One-paragraph description: multi-tenant Calendly-style booking tool for trade contractors. Points at the Vercel production URL from Plan 01.

   **## Tech stack**
   Bulleted list — Next.js 16 (App Router), React 19, TypeScript 6, @supabase/ssr 0.10, Tailwind CSS v4, Vitest 4. Link to relevant docs is optional.

   **## Getting started**
   Numbered steps covering local dev from zero:
   1. **Prereqs**: Node >= 20.9, npm, git, a Supabase account, a Vercel account.
   2. **Clone**: `git clone <repo-url> && cd calendar-app`
   3. **Install**: `npm install`
   4. **Env vars**: `cp .env.example .env.local`, then populate three keys (point at Supabase Dashboard -> Project Settings -> API for where to get `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
   5. **Link Supabase CLI** (one-time): `npx supabase login`, then `npx supabase link --project-ref <REF>` (pass the project ref from the dashboard URL).
   6. **Apply migrations**: `npx supabase db push`
   7. **Seed**: `npx supabase db seed` (or `psql $URL -f supabase/seed.sql`)
   8. **Run dev server**: `npm run dev` -> http://localhost:3000
   9. **Run tests**: `npm test`

   **## Deploying**
   Short section: "Push to `main` -> Vercel auto-deploys. Env vars live in the Vercel dashboard (Project Settings -> Environment Variables), NOT in a committed `.env.production`."

   **## Project structure**
   Brief tree showing `app/`, `lib/supabase/{client,server,proxy,admin}.ts`, `proxy.ts`, `supabase/{config.toml,migrations/,seed.sql}`, `tests/`. One-line comments on what each contains.

   **## Security notes**
   Short list:
   - `SUPABASE_SERVICE_ROLE_KEY` NEVER prefixed `NEXT_PUBLIC_`
   - `lib/supabase/admin.ts` gated by `import "server-only"` — import only from server code
   - RLS enabled on every table; anon role has no direct table access
   - DB-level race guard via partial unique index on `bookings(event_type_id, start_at) WHERE status='confirmed'`

   **## Phase status**
   One line pointing at `.planning/ROADMAP.md` for the full phase breakdown. Note Phase 1 (Foundation) is complete; Phase 2 (Auth) is next.

2. **Commit + push**:
   ```bash
   git add README.md
   git commit -m "docs(01): complete Phase 1 README with full getting-started"
   git push
   ```

3. **Verify final production deploy**:
   - Wait ~60 seconds for Vercel to rebuild.
   - `curl -sSf -o /dev/null -w "%{http_code}\n" <VERCEL_URL>` -> 200.
   - `curl -sSf <VERCEL_URL> | grep calendar-app` -> matches.
   - Open Vercel dashboard -> Deployments tab -> confirm latest deploy is in "Ready" state.

4. **Final local sanity**: `npm run dev` -> curl localhost:3000 -> 200 -> kill dev server. `npm test` -> exit 0. `npm run build` -> success.

DO NOT do in this task:
- Add env-var values to the README (point at `.env.example` instead).
- Add extensive architecture docs (planning docs already cover that).
- Add CI/CD config (GitHub Actions etc. — not in Phase 1 scope).
- Write a CONTRIBUTING.md.
  </action>
  <verify>
1. `wc -l README.md` shows at least 30 lines.
2. `grep -q "Getting started" README.md` AND `grep -q "supabase db push" README.md` AND `grep -q "npm test" README.md`.
3. `grep -q "server-only" README.md` AND `grep -q "RLS" README.md` AND `grep -q "bookings_no_double_book\|partial unique" README.md`.
4. `grep -q "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" README.md` (correct env name).
5. Final Vercel deploy returns HTTP 200 AND Vercel dashboard shows latest deploy in "Ready" state.
6. `npm test` still passes (full harness stable).
7. `npm run build` still succeeds locally.
  </verify>
  <done>
README covers cloning, installing, env setup, Supabase linking + push + seed, dev, tests, and deploying — a cold-start developer can run the project from the README alone. Phase 1 is fully shipped: live Vercel URL, public GitHub repo, six tables with RLS + race guard, seeded `nsi` account, passing race-guard + RLS tests, and a complete README. All five ROADMAP Phase 1 success criteria are satisfied.
  </done>
</task>

</tasks>

<verification>
Goal-backward check against ROADMAP.md Phase 1 success criteria:

1. **"Visiting the deployed Vercel URL returns a working Next.js page connected to the Supabase `calendar` project"**
   - `curl -sSf <VERCEL_URL>` returns HTTP 200 with `calendar-app` in body.
   - `.env.local` + Vercel env vars point at the same `calendar` project.

2. **"All 6 tables exist with `timestamptz` + IANA TZ strings on `accounts` and `bookings`"**
   - Verified by the SQL block in Plan 02's `<verification>`.

3. **"Two parallel INSERTs on the same `(event_type_id, start_at)` with `status='confirmed'` produce exactly one success + one violation"**
   - `tests/race-guard.test.ts` runs N=10 (stronger than N=2) and passes.

4. **"Anon Supabase client cannot read or write any table; service-role gated by `server-only`"**
   - `tests/rls-anon-lockout.test.ts` passes on all six tables (SELECT + INSERT).
   - `head -1 lib/supabase/admin.ts` == `import "server-only";`.

5. **"Andrew's account row exists with `timezone = 'America/Chicago'`"**
   - `select timezone from accounts where slug='nsi';` returns `America/Chicago`.

If all five checks pass and the final Vercel deploy is green, Phase 1 is complete.
</verification>

<success_criteria>
- `npm test` exits 0 with race-guard + RLS tests passing (13 assertions total: 1 race + 12 RLS).
- README covers clone, install, env, Supabase link, push, seed, dev, test, deploy.
- Final Vercel production deploy is green.
- All five ROADMAP Phase 1 success criteria verifiable via the commands in `<verification>`.
- No Playwright, no pg_cron, no Phase 2+ scope bleed.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-PLAN-03-SUMMARY.md` capturing:
- `npm test` output (condensed — the two suite-level pass lines + total assertion count)
- Final Vercel URL + deploy ID / hash
- Confirmation of each of the 5 ROADMAP success criteria with evidence (one line each)
- Any deviations from RESEARCH.md (should be none; flag if any)
- Explicit "Phase 1 complete, ready for Phase 2" status line
</output>
