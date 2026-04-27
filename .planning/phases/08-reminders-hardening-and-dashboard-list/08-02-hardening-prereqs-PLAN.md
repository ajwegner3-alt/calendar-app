---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-02"
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - eslint.config.mjs
  - app/api/bookings/route.ts
  - app/api/cancel/route.ts
  - app/api/reschedule/route.ts
  - app/(shell)/app/bookings/[id]/_lib/owner-cancel-action.ts
autonomous: true

must_haves:
  truths:
    - "use-debounce package is installed (required by 08-07 owner-note autosave)"
    - "npm run lint completes without the pre-existing circular-JSON error"
    - "All fire-and-forget email send calls use after() from next/server (not raw void promises)"
    - "Existing tests still pass after the after() migration"
  artifacts:
    - path: "package.json"
      provides: "use-debounce dependency"
      contains: "use-debounce"
    - path: "eslint.config.mjs"
      provides: "ESLint flat config replacing legacy .eslintrc"
      contains: "export default"
    - path: "app/api/bookings/route.ts"
      provides: "Booking creation route with after() fire-and-forget pattern"
      contains: "import.*after.*from.*next/server"
  key_links:
    - from: "app/api/bookings/route.ts"
      to: "next/server after()"
      via: "after(() => sendBookingEmails(...))"
      pattern: "after\\(\\s*(async)?\\s*\\(\\s*\\)\\s*=>"
    - from: "package.json"
      to: "use-debounce"
      via: "dependencies entry"
      pattern: "\"use-debounce\""
---

<objective>
Resolve three cross-cutting hardening prerequisites that unblock later Phase 8 plans and clear STATE.md backlog items: install `use-debounce` (08-07 dep), migrate ESLint to flat config (clears pre-existing lint error from Phase 1), and replace `void promise` fire-and-forget patterns with `after()` from `next/server`.

Purpose: These three small concerns share the property of being independent, low-risk, and Wave-1-eligible — none of them touches the new Phase 8 schema columns. Bundling them avoids spawning three trivial plans and gets all three off the backlog before Wave 2 starts.

Output: Updated package.json, working `npm run lint`, and three API routes + one Server Action using `after()` instead of `void promise`.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-RESEARCH.md
@app/api/bookings/route.ts
@app/api/cancel/route.ts
@app/api/reschedule/route.ts
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install use-debounce and migrate ESLint to flat config</name>
  <files>package.json, package-lock.json, eslint.config.mjs, .eslintrc.json (delete if present)</files>
  <action>
    Step A — install use-debounce:
    ```bash
    npm install use-debounce
    ```
    Verify it appears in `package.json` dependencies (NOT devDependencies; it's used in client component).

    Step B — migrate ESLint to flat config:

    The project has a pre-existing circular-JSON error in `npm run lint` (STATE.md backlog line 236). Root cause: legacy `.eslintrc.*` config under ESLint v9 + flat-config requirement.

    1. Identify current ESLint config: look for `.eslintrc.json`, `.eslintrc.js`, or `eslint.config.*`. Read whatever exists.
    2. Create `eslint.config.mjs` (flat config) at project root:
       ```javascript
       import { FlatCompat } from "@eslint/eslintrc";
       import { fileURLToPath } from "node:url";
       import path from "node:path";

       const __filename = fileURLToPath(import.meta.url);
       const __dirname = path.dirname(__filename);

       const compat = new FlatCompat({
         baseDirectory: __dirname,
       });

       const eslintConfig = [
         ...compat.extends("next/core-web-vitals", "next/typescript"),
         {
           ignores: [
             ".next/**",
             "node_modules/**",
             "supabase/migrations/**",
             ".planning/**",
             ".playwright-mcp/**",
             "tmp/**",
           ],
         },
       ];

       export default eslintConfig;
       ```
    3. Delete legacy config: `git rm .eslintrc.json` (or whichever legacy file existed).
    4. Run `npm run lint`. Confirm:
       - No "circular structure converted to JSON" error.
       - Either zero violations OR a clear, actionable list of violations.
       - If real violations surface in production code, fix them. If they're in `.next/` or generated files, expand the `ignores` array.

    Why FlatCompat: `eslint-config-next` 16.x still ships as a legacy config. FlatCompat is the official Next.js recommendation for bridging until next/core-web-vitals ships native flat config.

    Do NOT install `@eslint/eslintrc` separately if it's already pulled in by eslint-config-next; check `npm ls @eslint/eslintrc` first. If missing, `npm install -D @eslint/eslintrc`.

    Commit:
    ```bash
    git add package.json package-lock.json eslint.config.mjs
    git rm .eslintrc.json 2>/dev/null || true
    git commit -m "chore(08-02): install use-debounce + migrate ESLint to flat config"
    ```
  </action>
  <verify>
    `npm ls use-debounce` shows the package installed.
    `npm run lint` completes with exit code 0 (or non-zero with a normal violation list — NOT a stack trace mentioning "circular structure converted to JSON").
    `cat eslint.config.mjs` shows valid flat config.
    Legacy `.eslintrc.*` no longer present (`ls .eslintrc* 2>/dev/null` returns empty).
  </verify>
  <done>
    use-debounce installed as a runtime dep. ESLint flat config in place. `npm run lint` no longer crashes with circular-JSON; either passes or returns a normal violation list.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate fire-and-forget email patterns to after() from next/server</name>
  <files>app/api/bookings/route.ts, app/api/cancel/route.ts, app/api/reschedule/route.ts, app/(shell)/app/bookings/[id]/_lib/owner-cancel-action.ts</files>
  <action>
    Replace `void someEmailPromise(...)` patterns with `after(() => someEmailPromise(...))` from `next/server`. RESEARCH.md Pattern 4 documents this is stable in Next.js 15.1+ and this project is 16.2.4.

    For each of the four files:

    1. Read the file.
    2. Locate every `void send...(...)` or `void sendBookingEmails(...)` or similar fire-and-forget call after the response is constructed.
    3. Add at top of file (if not already present):
       ```typescript
       import { after } from "next/server";
       ```
    4. Replace each `void emailFn(args);` with:
       ```typescript
       after(async () => {
         await emailFn(args);
       });
       ```
       OR the simpler form if the function returns a promise:
       ```typescript
       after(() => emailFn(args));
       ```
    5. Keep the response statement BELOW the `after()` call. `after()` schedules work to run AFTER the response is flushed; calling order matters for clarity but execution semantics are correct as long as `after()` is called before the function returns.

    Specific files (search the codebase for actual occurrences — these are the four flagged in STATE.md backlog line 237):

    - `app/api/bookings/route.ts` — likely has `void sendBookingEmails(...)` after success path. Replace with `after(() => sendBookingEmails(...))`.
    - `app/api/cancel/route.ts` — has fire-and-forget cancel email. Replace.
    - `app/api/reschedule/route.ts` — has fire-and-forget reschedule email. Replace.
    - `app/(shell)/app/bookings/[id]/_lib/owner-cancel-action.ts` (or whatever the Phase 6 owner cancel Server Action filename actually is — search for `cancelBookingAsOwner` definition). Server Actions also support `after()` from `next/server`. Replace any `void`-style fire-and-forget there.

    NOTE on Server Actions: `after()` IS supported in Server Actions per Next.js 15.1+ docs. If the lookup finds the cancel action lives at a different path, update files_modified frontmatter accordingly in SUMMARY.

    NOTE on runtime: All four files run on Node.js runtime (NOT edge). `after()` is fully supported. Do not change runtime declarations.

    DO NOT touch any email sender library code (`lib/email/*.ts`). The fix is at the call sites only.

    DO NOT introduce `@vercel/functions` `waitUntil` — RESEARCH chose `after()` as the canonical pattern (research §State of the Art).

    After edits, run vitest to confirm no regressions:
    ```bash
    npm test
    ```
    Existing email-mocked tests (bookings-api.test.ts, cancel-reschedule-api.test.ts) must still pass. If they fail because they expected `void` exec timing, update test mocks to await any pending `after()` calls — but the cleaner fix is usually that tests already use mocked promises that resolve synchronously, in which case no test change is needed.

    Commit:
    ```bash
    git add app/api/bookings/route.ts app/api/cancel/route.ts app/api/reschedule/route.ts app/\(shell\)/app/bookings/\[id\]/_lib/*.ts
    git commit -m "refactor(08-02): replace void-promise fire-and-forget with next/server after()"
    ```
  </action>
  <verify>
    `grep -n "void send" app/api/bookings/route.ts app/api/cancel/route.ts app/api/reschedule/route.ts` returns no matches.
    `grep -n "after(" app/api/bookings/route.ts app/api/cancel/route.ts app/api/reschedule/route.ts` shows at least one match per file.
    `grep -n "from \"next/server\"" app/api/bookings/route.ts | grep "after"` shows the import.
    `npm test` exits with code 0 — no regression in email tests.
  </verify>
  <done>
    All four files use `after()` from `next/server` instead of `void promise`. Existing test suite still green. STATE.md backlog item "waitUntil/after migration" is closed.
  </done>
</task>

</tasks>

<verification>
1. `npm ls use-debounce` shows installed.
2. `npm run lint` no longer crashes with circular-JSON; returns 0 or normal violations only.
3. `grep -rn "void send" app/api/` returns nothing.
4. `grep -rn "after(" app/api/bookings/route.ts app/api/cancel/route.ts app/api/reschedule/route.ts` returns 3+ matches across the three files.
5. `npm test` — full suite green (current 80/80 baseline).
</verification>

<success_criteria>
- use-debounce in package.json runtime dependencies.
- ESLint flat config in place; `npm run lint` runs without crashing.
- Four files using `after()` from `next/server` instead of `void promise`.
- All existing 80 tests still pass.
- Three commits pushed (or one squashed commit covering all changes).
</success_criteria>

<output>
After completion, create `.planning/phases/08-reminders-hardening-and-dashboard-list/08-02-SUMMARY.md` documenting:
- ESLint config migration approach (FlatCompat vs native — depends on what next-config-next supports)
- Any lint violations surfaced and how resolved
- Exact list of fire-and-forget call sites migrated (file + function called)
- Test count before/after (should be same — 80/80 expected)
</output>
