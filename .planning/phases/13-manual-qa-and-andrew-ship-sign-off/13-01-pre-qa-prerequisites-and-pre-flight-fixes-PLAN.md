---
phase: 13-manual-qa-and-andrew-ship-sign-off
plan: "13-01"
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
  - public/nsi-mark.png
  - .env.test.local
autonomous: false

user_setup:
  - service: nsi-brand-mark
    why: "Phase 12.6 deferred item #8 — final NSI brand mark image must replace the 32x32 solid-navy placeholder at public/nsi-mark.png before QA-12 surface 4 (email header band) can render real brand identity. This is the only HARD prerequisite identified in MILESTONE_V1_1_DEFERRED_CHECKS.md as still pending after the 2026-04-29 Phase 12.6 deploy approval."
    env_vars: []
    dashboard_config:
      - task: "Provide the final NSI brand mark image file (PNG, ideally 64x64 or 128x128 for retina, ≤10KB). Andrew may have this from existing NSI brand collateral. Save to public/nsi-mark.png in the calendar-app repo (overwrites the placeholder). Commit + push so Vercel picks it up before QA-12."
        location: "Local repo: C:/Users/andre/OneDrive - Creighton University/Desktop/Claude-Code-Projects/tools-made-by-claude-for-claude/calendar-app/public/nsi-mark.png"
  - service: supabase-email-confirm-toggle
    why: "Phase 10 Plan 10-05 P-A8 deferred 5-step sequence MUST run before QA-09 (signup → email-verify E2E). The sequence is order-dependent and creates lockout risk if step 1 (pre-flight SQL) is skipped."
    env_vars: []
    dashboard_config:
      - task: "Andrew runs the ordered 5-step procedure described in Task 3 of this plan. Steps 2-4 are exclusively Supabase Dashboard actions; Step 1 SQL can be run via CLI or Dashboard SQL Editor. See Task 3 <how-to-verify> for full procedure."
        location: "Supabase Dashboard (https://supabase.com/dashboard/project/mogfnutxrrbtvnaupoun) → Authentication"
  - service: supabase-test-user-3
    why: "Phase 10 Plan 10-09 deferred — Test User 3 creation is REQUIRED for QA-10 (multi-tenant walkthrough as 2nd owner is Test User 2; Test User 3 enables Account C in QA-12 third branded smoke + N=3 RLS matrix test parity)."
    env_vars:
      - name: TEST_OWNER_3_EMAIL
        source: "User-chosen value: nsi-rls-test-3@andrewwegner.example (committed to .env.test.local in Step 3 of Task 4)"
      - name: TEST_OWNER_3_PASSWORD
        source: "Strong password chosen during Supabase Dashboard user creation; Andrew records and pastes into .env.test.local"
    dashboard_config:
      - task: "Andrew completes the 4-step Test User 3 provisioning procedure in Task 4 of this plan: (1) create user in Supabase Dashboard with auto-confirm ON; (2) seed accounts row via SQL Editor; (3) write password to local .env.test.local; (4) optional Vercel env var add for CI parity."
        location: "Supabase Dashboard → Authentication → Users + SQL Editor"

must_haves:
  truths:
    - "All 6 pre-flight items confirmed done before Plan 13-02 marathon begins (NSI mark swap, production deploy current, email-confirm toggle ON with Andrew login still working, Test User 3 created with accounts row INSERTed, 3 distinct branding profiles applied, capacity=3 test event live)"
    - "13-CHECKLIST.md exists at .planning/phases/13-manual-qa-and-andrew-ship-sign-off/ with all QA-09..QA-15 rows + 3-account × 4-surface QA-12 sub-table + Deferred-Check-Replays section + Test-Artifacts section + Sign-off section"
    - "Andrew's NSI account has email_confirmed_at NOT NULL in auth.users (verified via SQL Editor SELECT) BEFORE the email-confirm toggle is flipped — lockout safety net per RESEARCH.md Pitfall 1"
    - "All 4 Supabase email templates use {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=... pattern (NOT legacy {{ .ConfirmationURL }}); Andrew login still works post-toggle (verified by signing in to /app/login as ajwegner3@gmail.com)"
    - "Test User 3 (nsi-rls-test-3@andrewwegner.example) exists in auth.users with auto-confirm ON AND has matching accounts row with slug='nsi-rls-test-3', name='NSI RLS Test 3', timezone='America/Chicago', onboarding_complete=true"
    - "3 branded accounts (nsi / nsi-rls-test / nsi-rls-test-3) have distinct (brand_primary, background_color, background_shade, sidebar_color) tuples per RESEARCH.md QA-12 Item 3 table — verified by SELECT on accounts WHERE slug IN (...)"
    - "Capacity=3 'Capacity Test' event_type live at https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/capacity-test with at least one bookable slot in the next 7 days"
    - "Production deploy commit SHA matches local origin/main HEAD; smoke curls return 200 on /nsi and /[account]/[event-slug] route shapes"
  artifacts:
    - path: ".planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md"
      provides: "Live session-of-record artifact for Phase 13 marathon QA + sign-off"
      contains: "Marathon Criteria"
    - path: "public/nsi-mark.png"
      provides: "Final NSI brand mark for email Powered-by-NSI footer (was placeholder pre-13-01)"
      contains: "PNG"
    - path: ".env.test.local"
      provides: "TEST_OWNER_3_EMAIL + TEST_OWNER_3_PASSWORD for N=3 RLS matrix test parity + QA-10 Test User 3 login"
      contains: "TEST_OWNER_3_EMAIL"
  key_links:
    - from: "auth.users (Andrew's row)"
      to: "Email-confirm toggle ON state"
      via: "Step 1 pre-flight SQL sets email_confirmed_at NOT NULL BEFORE Step 2 toggle flip — required to prevent lockout"
      pattern: "email_confirmed_at IS NOT NULL"
    - from: "auth.users (new Test User 3 row)"
      to: "accounts (matching row with slug='nsi-rls-test-3')"
      via: "Manual INSERT in SQL Editor (10-03 provisioning trigger creates a stub; UPSERT or DELETE-then-INSERT flow per Task 4 Step 2)"
      pattern: "INSERT INTO accounts"
    - from: "accounts.sidebar_color, .background_color, .background_shade, .brand_primary on the 3 test slugs"
      to: "QA-12 dashboard + public + embed + email surface rendering"
      via: "Direct UPDATE via Supabase SQL Editor in Task 5 (3 accounts × 4 columns each)"
      pattern: "UPDATE accounts SET .* WHERE slug IN"
    - from: "vercel.json deploy state"
      to: "Live commit SHA on calendar-app-xi-smoky.vercel.app"
      via: "Vercel auto-deploy on push to origin/main"
      pattern: "git log origin/main -1 --format=%H"
---

<objective>
Bring the production environment + planning workspace to a known-good state so Plan 13-02's marathon QA can run start-to-finish without mid-session blockers. This plan replays every pre-flight item identified in `MILESTONE_V1_1_DEFERRED_CHECKS.md` Phase 10/12.6 entries that is required before QA-09..QA-13 can execute, plus scaffolds the session-of-record `13-CHECKLIST.md`.

Purpose: Phase 13 is the v1.1 ship gate. The pre-flight items have been deferred deliberately since Phase 10 (P-A8 Andrew-lockout risk if Step 1 SQL is skipped before Step 2 toggle flip). Front-loading them here means a Step-1 failure surfaces in 13-01 — not in the middle of QA-09. This plan also creates the 3 branded accounts + capacity test event that QA-11 and QA-12 depend on, and verifies the Vercel production deploy is current with the NSI mark swap landed.

Output: Production environment configured for end-to-end QA. Andrew can sign in. Test User 3 can sign in. Three test accounts have visually distinct branding. A capacity=3 event is live. The checklist artifact is ready to fill.

**Task-count note:** This plan has 8 tasks (mirrors Phase 9 Plan 09-01 which had 6 tasks at criterion-grain). Tasks 1, 3, 4 are blocking human-action checkpoints; Tasks 2, 5, 6, 7, 8 are autonomous. Plan is `autonomous: false` because of the 3 human-action gates.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md
@.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-RESEARCH.md
@.planning/phases/09-manual-qa-and-verification/09-01-pre-qa-prerequisites-and-pre-flight-fixes-PLAN.md

# Pre-flight SQL file
@scripts/phase10-pre-flight-andrew-email-confirmed.sql

# RLS test helper context (Test User 3 reads from .env.test.local pattern)
@tests/helpers/auth.ts
@tests/rls-cross-tenant-matrix.test.ts
</context>

<execution_pattern>
This plan combines human-action checkpoints (Tasks 1, 3, 4) with autonomous Claude steps (Tasks 2, 5, 6, 7, 8).

Sequencing rationale:
- Task 1 (NSI mark) must complete BEFORE Task 8 push so Vercel deploy contains the final asset before QA-12 surface 4 inbox checks render any production email.
- Task 2 (deploy verify) confirms ALL prior code (Phase 12.6 + earlier) is in production before Task 3 toggles email-confirm — toggling on stale code is a regression risk.
- Task 3 (email-confirm 5-step) MUST run before QA-09 in 13-02; Step 1 SQL MUST run before Step 2 toggle to prevent Andrew lockout.
- Task 4 (Test User 3) can run any time after Task 3 (Step 1 of Task 4 uses "Auto-confirm email: ON" which works regardless of toggle state, but the documented order in MILESTONE_V1_1_DEFERRED_CHECKS.md is Item 1 → Item 2).
- Task 5 (3 branded accounts SQL) requires Task 4 done so all 3 slugs exist before the UPDATE batch runs.
- Task 6 (capacity event) runs as Test User 2 — independent of Task 4 but recommended after so the QA-11 event isn't owned by Andrew's NSI account (keeps QA-12 brand-A clean).
- Task 7 (checklist scaffold) is pure file-write; can run any time but most useful at the end after all environment state is real.
- Task 8 (push + Vercel verify) is the final gate; Vercel deploy must be green BEFORE 13-02 starts.
</execution_pattern>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew swaps NSI mark image at /public/nsi-mark.png (Phase 12.6 deferred #8)</name>
  <what-needed>
    Per `MILESTONE_V1_1_DEFERRED_CHECKS.md` Phase 12.6 item #8 (the only Phase 12.6 deferred check still pending after the 2026-04-29 Andrew live-approval session) and STATE.md line 179: `public/nsi-mark.png` currently contains a 32x32 solid-navy placeholder. The final NSI brand mark image must replace it BEFORE Phase 13 QA-12 surface 4 (email header inbox check) so Andrew's confidence on "this is the real brand identity in production" is honest.

    Claude cannot procure the asset (it's an offline brand collateral file). This is one of the rare valid `checkpoint:human-action` cases.
  </what-needed>
  <how-to-verify>
    Andrew completes:

    1. Locate the final NSI brand mark image (PNG, ideally 64x64 or 128x128 for retina display, ≤10KB). If only a larger source exists, downscale to 128x128 transparent-background PNG before placing.
    2. Save the file to `C:/Users/andre/OneDrive - Creighton University/Desktop/Claude-Code-Projects/tools-made-by-claude-for-claude/calendar-app/public/nsi-mark.png` (overwrites the placeholder; same filename so no code change needed).
    3. Verify locally: open `public/nsi-mark.png` in any image viewer; confirm it's the real brand mark, not the solid-navy placeholder. Run:
       ```
       ls -la public/nsi-mark.png
       ```
       File should be > 1KB (placeholder is ~280 bytes; final mark should be 2-10KB).
    4. Do NOT commit yet — Task 8 batches the commit + push at end of plan.

    On any blocker (no asset available, image won't downscale, etc.): tell Claude. The fallback is to flag the placeholder issue in the checklist Notes column for QA-12 surface 4 and accept "DEFERRED — placeholder still in production at sign-off; final asset to ship in v1.1.1 patch" — but this is sub-optimal per RESEARCH.md Pitfall 8.
  </how-to-verify>
  <resume-signal>Type "nsi mark swapped" (or "blocker: &lt;detail&gt;" with explanation if asset unavailable)</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Verify production deploy is current (commit SHA + smoke curls)</name>
  <files>
    (no file changes — verification only)
  </files>
  <action>
    Per RESEARCH.md "Pre-Flight Inventory" Item 6 + Pitfall 2 (browser cache / stale deploy can mask QA failures): confirm the live Vercel deploy is serving the latest origin/main commit BEFORE Task 3's email-confirm toggle goes ON.

    Steps:

    1. Capture local origin/main HEAD SHA:
       ```
       git fetch origin main
       LOCAL_SHA=$(git log origin/main -1 --format=%H)
       echo "Local origin/main HEAD: $LOCAL_SHA"
       ```
       Per STATE.md line 240, this should be `2dc5ae1` (Plan 12.6-03 close-out commit) or its successor as of Phase 13 start.

    2. Smoke-confirm the live site responds on key route shapes (these confirm the deployed code includes the routes Phase 12 + 12.6 added):
       ```
       curl -i https://calendar-app-xi-smoky.vercel.app/nsi
       # Expect: 200 OK; renders the /[account] listing page (Plan 12-05 ListingHero)

       curl -i "https://calendar-app-xi-smoky.vercel.app/auth/confirm?token_hash=test&type=signup"
       # Expect: 4xx (bad token), NOT 404. 404 means /auth/confirm route not deployed.

       curl -I https://calendar-app-xi-smoky.vercel.app/nsi-mark.png
       # Expect: 200 OK; Content-Length should match the file size from Task 1 (note: this curl
       # WILL still show the placeholder until Task 8 push lands. Just confirm 200 reachability here.)

       curl -i https://calendar-app-xi-smoky.vercel.app/app/branding
       # Expect: 307 redirect to /app/login (auth-gated route — confirms /app/branding deployed)
       ```

    3. Capture the Vercel deployment status. Either via the dashboard (https://vercel.com → calendar-app project → Deployments) OR via:
       ```
       npx vercel ls --token=$VERCEL_TOKEN 2>/dev/null | head -5
       ```
       (if Andrew doesn't have VERCEL_TOKEN handy, dashboard inspection is fine).
       Record the commit SHA of the latest READY deployment. It MUST equal `$LOCAL_SHA` from Step 1. If they differ, STOP — investigate why a newer commit hasn't deployed (likely a build failure on Vercel; check the Deployments tab for any FAILED status).

    4. Hard-cache-clear note for Andrew (record in 13-CHECKLIST.md Pre-flight section): "If you've been browsing production tabs during Phase 12.6, hit Ctrl+Shift+R on each tab BEFORE starting QA-12 to defeat client-side cache. RESEARCH.md Pitfall 5."

    DO NOT proceed to Task 3 if Step 3 SHA mismatch is unresolved — toggling email-confirm on stale code is a regression risk per Pitfall 2.
  </action>
  <verify>
    `git log origin/main -1 --format=%H` matches the SHA of the latest READY Vercel deployment.
    All 4 smoke curls return their expected status codes (200 / 4xx / 200 / 307).
    13-CHECKLIST.md Pre-flight Item 6 row records the local SHA (filled in Task 7 once checklist is scaffolded; capture in scratch for now).
  </verify>
  <done>
    Production is confirmed serving the same code that origin/main tip points to. No stale-deploy risk for Task 3.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Andrew runs Phase 10 Plan 10-05 deferred 5-step sequence (email-confirm toggle ON)</name>
  <what-needed>
    Per `MILESTONE_V1_1_DEFERRED_CHECKS.md` Phase 10 / Plan 10-05: enabling email-confirm in production requires 5 ordered steps. Step 1 (pre-flight SQL setting Andrew's `email_confirmed_at NOT NULL`) is a lockout safety net — flipping the toggle (Step 2) before Step 1 will lock Andrew out of his own production NSI account because his existing row predates the toggle and may not have a confirmed-at timestamp.

    Claude cannot perform Steps 2, 3, 4 (Supabase Dashboard UI actions). Step 1 SQL CAN be run via `npx supabase db query --linked -f scripts/phase10-pre-flight-andrew-email-confirmed.sql` but Andrew's input is required to confirm execution + paste back the SELECT result.

    This is the highest-risk pre-flight item. The procedure must complete cleanly before QA-09 (which exercises the new fresh-signup flow) can run.
  </what-needed>
  <how-to-verify>
    Andrew completes the 5 steps below in order. After each step, type the indicated confirmation phrase (or report any blocker). Do NOT skip ahead.

    **STEP 1 — Run pre-flight SQL (lockout safety net):**

    Open Supabase Dashboard → SQL Editor (https://supabase.com/dashboard/project/mogfnutxrrbtvnaupoun/sql) and run:
    ```sql
    SELECT id, email, email_confirmed_at, created_at
    FROM auth.users
    WHERE email = 'ajwegner3@gmail.com';
    ```

    Or run from CLI:
    ```
    npx supabase db query --linked -f scripts/phase10-pre-flight-andrew-email-confirmed.sql
    ```

    Verify: `email_confirmed_at` column shows a NOT NULL timestamp. If the row shows NULL, open `scripts/phase10-pre-flight-andrew-email-confirmed.sql`, uncomment the conditional UPDATE block at the bottom, run it, then re-SELECT to confirm.

    Confirmation phrase: "step 1 done: email_confirmed_at = &lt;value&gt;"

    **STEP 2 — Flip the email-confirm toggle ON:**

    Supabase Dashboard → Authentication → Sign In / Up tab → "Enable email confirmations" → toggle ON. Save.

    Confirmation phrase: "step 2 done: email-confirm toggle ON"

    **STEP 3 — Whitelist auth-confirm redirect URLs:**

    Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Add (one per line):
    - `http://localhost:3000/auth/confirm`
    - `https://calendar-app-xi-smoky.vercel.app/auth/confirm`
    - `https://calendar-app-*.vercel.app/auth/confirm` (try wildcard; if Supabase rejects, enumerate the 1-2 active preview URLs Andrew has open)

    Save.

    Confirmation phrase: "step 3 done: redirect URLs whitelisted"

    **STEP 4 — Replace ALL FOUR email templates:**

    Supabase Dashboard → Authentication → Email Templates. For each of the four templates below, replace the `{{ .ConfirmationURL }}` link with the token-hash pattern:

    - **Confirm signup template:** href = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding`
    - **Reset Password template:** href = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
    - **Magic Link template:** href = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
    - **Confirm Email Change template:** href = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`

    Save each template after edit. {{ .SiteURL }} resolves to the production hostname Supabase has configured (verify in URL Configuration); the token-hash pattern routes to the canonical `/auth/confirm` Route Handler shipped in Plan 10-02.

    Confirmation phrase: "step 4 done: all 4 templates updated"

    **STEP 5 — Verify Andrew's login still works:**

    Open https://calendar-app-xi-smoky.vercel.app/app/login in a fresh browser tab. Sign in as `ajwegner3@gmail.com` with the existing password. Should reach `/app` dashboard successfully (Andrew's row already has `email_confirmed_at` from Step 1, AND `onboarding_complete=true` from Plan 10-03 trigger context, so no email-confirm prompt and no onboarding-wizard redirect).

    If sign-in fails with "Email not confirmed": Step 1 didn't take. Re-run Step 1 with the conditional UPDATE uncommented. If sign-in fails with any other error: STOP and escalate as blocker; do NOT proceed to Task 4.

    Confirmation phrase: "step 5 done: andrew login works (reached /app)"

    Per RESEARCH.md Pitfall 1, the `<resume-signal>` for this checkpoint requires the Step 1 SELECT result to be confirmed before allowing Steps 2-5 to proceed.
  </how-to-verify>
  <resume-signal>Type "5-step sequence done: andrew login confirmed" (or report which step blocked: e.g. "step 4 blocker: Supabase rejected wildcard redirect URL")</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4: Andrew creates Test User 3 + accounts row + writes credentials to .env.test.local</name>
  <what-needed>
    Per `MILESTONE_V1_1_DEFERRED_CHECKS.md` Phase 10 / Plan 10-09: Test User 3 (`nsi-rls-test-3@andrewwegner.example`) is required for QA-10 (multi-tenant walkthrough — though QA-10 primarily uses Test User 2, having Test User 3 enables Account C in QA-12 third branded smoke and unblocks the N=3 RLS matrix test). Per STATE.md line 159, the cross-tenant matrix test code already exists with `describe.skipIf(skipIfNoThreeUsers)` guarding 24 N=3 cases that activate when this user provisioning completes.

    Steps require Supabase Dashboard auth + SQL Editor + local file edit; Claude cannot do these for Andrew.
  </what-needed>
  <how-to-verify>
    Andrew completes the 4 steps in order. Per RESEARCH.md Pitfall 7 (intentional auto-confirm-email: ON), this user is for RLS / branding testing only, not for re-exercising the signup-flow path — that path is exercised separately by QA-09's throwaway signup.

    **STEP 1 — Create the user in Supabase Dashboard:**

    Supabase Dashboard → Authentication → Users → "Add user" → "Create new user":
    - Email: `nsi-rls-test-3@andrewwegner.example`
    - Password: pick a strong password (record it for Step 3 — copy to a paste buffer)
    - **Auto-confirm email: ON** (intentional; matches Phase 10 Plan 10-09 procedure)

    After creation, click on the new user row and note the UUID (visible in the user details panel; format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

    Confirmation phrase: "step 1 done: user created, uuid = &lt;UUID&gt;"

    **STEP 2 — Seed accounts row in SQL Editor:**

    The Plan 10-03 provisioning trigger MAY have auto-created a stub accounts row (slug=null, name=null, onboarding_complete=false). Check first:

    ```sql
    SELECT id, slug, name, onboarding_complete
    FROM accounts
    WHERE owner_user_id = '&lt;UUID_FROM_STEP_1&gt;';
    ```

    **If a stub row exists** (onboarding_complete=false), DELETE it first:
    ```sql
    DELETE FROM accounts
    WHERE owner_user_id = '&lt;UUID_FROM_STEP_1&gt;'
      AND onboarding_complete = false;
    ```

    Then INSERT the proper row (works whether the SELECT was empty or after the DELETE):
    ```sql
    INSERT INTO accounts (
      owner_user_id,
      owner_email,
      slug,
      name,
      timezone,
      onboarding_complete
    ) VALUES (
      '&lt;UUID_FROM_STEP_1&gt;',
      'nsi-rls-test-3@andrewwegner.example',
      'nsi-rls-test-3',
      'NSI RLS Test 3',
      'America/Chicago',
      true
    );
    ```

    NOTE: column is `name` NOT `display_name` — per the Plan 10-03 schema deviation (STATE.md line 124). Using the wrong column will throw a column-not-found error.

    Verify:
    ```sql
    SELECT slug, owner_email, name, onboarding_complete
    FROM accounts
    WHERE slug = 'nsi-rls-test-3';
    ```
    Expect: 1 row, `slug='nsi-rls-test-3'`, `name='NSI RLS Test 3'`, `onboarding_complete=true`.

    Confirmation phrase: "step 2 done: accounts row inserted, slug=nsi-rls-test-3"

    **STEP 3 — Write credentials to local .env.test.local:**

    Open `.env.test.local` in the calendar-app repo (create file if it doesn't exist; it's gitignored). Append:
    ```
    TEST_OWNER_3_EMAIL=nsi-rls-test-3@andrewwegner.example
    TEST_OWNER_3_PASSWORD=&lt;PASSWORD_FROM_STEP_1&gt;
    ```

    These are read by `tests/helpers/auth.ts` `signInAsNsiTest3Owner()` per STATE.md line 159 + Plan 10-09 SUMMARY.

    Confirmation phrase: "step 3 done: credentials in .env.test.local"

    **STEP 4 — (Optional) Add to Vercel env vars for CI parity:**

    Vercel Dashboard → calendar-app project → Settings → Environment Variables. Add:
    - `TEST_OWNER_3_EMAIL` = `nsi-rls-test-3@andrewwegner.example` (Production + Preview scope)
    - `TEST_OWNER_3_PASSWORD` = `&lt;PASSWORD&gt;` (Production + Preview scope)

    Per Plan 10-09 SUMMARY: tests use `describe.skipIf(!hasThreeUsers)` so omitting CI is acceptable — tests skip silently in CI but run locally on Andrew's machine. This step is OPTIONAL; skip if Andrew prefers to run tests locally only.

    Confirmation phrase: "step 4 done: vercel env vars added" OR "step 4 skipped: local-only"

    **VERIFICATION (post-Step-4):**

    Run locally:
    ```
    npx supabase db query --linked -c "SELECT slug, owner_email, name FROM accounts WHERE slug = 'nsi-rls-test-3';"
    npm test -- tests/rls-cross-tenant-matrix.test.ts
    ```
    Expect: SQL returns 1 row; matrix test shows ~28-30 cases passing (24 new N=3 cases UN-skip).

    On any failure: capture the error and report. Common failures:
    - "duplicate key value violates unique constraint accounts_slug_key" — slug 'nsi-rls-test-3' already taken (from a prior failed attempt); DELETE the existing row first or pick a different slug.
    - "column 'display_name' does not exist" — wrong column name; use `name` NOT `display_name` (Plan 10-03 deviation).
  </how-to-verify>
  <resume-signal>Type "test user 3 done: credentials in .env.test.local, matrix test &lt;N&gt;/&lt;M&gt; passing" (or list any blocker)</resume-signal>
</task>

<task type="auto">
  <name>Task 5: Apply 3 distinct branding profiles to nsi / nsi-rls-test / nsi-rls-test-3 (QA-12 setup)</name>
  <files>
    (no local file changes — Supabase SQL Editor UPDATEs only; data only)
  </files>
  <action>
    Per RESEARCH.md "Pre-Flight Inventory" Item 3 + RESEARCH.md QA-12 Surface coverage matrix: configure 3 visually distinct branding profiles on the 3 test accounts so QA-12 can verify per-account color isolation across dashboard / public booking page / embed / email surfaces.

    The combos are chosen for maximum coverage:
    - **Account A (nsi)** — navy full-strength 3-color combo: tests Phase 12.6 deferred item #1 (full-strength 3-color combo).
    - **Account B (nsi-rls-test)** — magenta + bold gradient: tests Phase 12.6 deferred items #3 + #4 (button accent + switch on-state).
    - **Account C (nsi-rls-test-3)** — emerald primary only, null page bg + null sidebar: tests Phase 12.6 deferred item #2 (null/clear regression path) and the resolveChromeColors fallback chain to shadcn defaults.

    **Steps for Claude (autonomous via Supabase MCP `apply_migration` if available, OR by emitting the SQL for Andrew to paste):**

    Apply the 3 UPDATE statements via Supabase SQL Editor (or via `npx supabase db query --linked -c "..."` if Andrew prefers CLI):

    ```sql
    -- Account A (NSI): navy full-strength 3-color combo
    UPDATE accounts
    SET brand_primary='#0A2540',
        background_color='#F8FAFC',
        background_shade='subtle',
        sidebar_color='#0A2540'
    WHERE slug='nsi';

    -- Account B (Test User 2 = nsi-rls-test): magenta + pink-50 + bold
    UPDATE accounts
    SET brand_primary='#EC4899',
        background_color='#FDF2F8',
        background_shade='bold',
        sidebar_color='#EC4899'
    WHERE slug='nsi-rls-test';

    -- Account C (Test User 3 = nsi-rls-test-3): emerald primary only; null/clear regression
    UPDATE accounts
    SET brand_primary='#22C55E',
        background_color=NULL,
        background_shade='none',
        sidebar_color=NULL
    WHERE slug='nsi-rls-test-3';
    ```

    Verify the 3 rows have distinct values:
    ```sql
    SELECT slug, brand_primary, background_color, background_shade, sidebar_color
    FROM accounts
    WHERE slug IN ('nsi','nsi-rls-test','nsi-rls-test-3')
    ORDER BY slug;
    ```

    Expect 3 rows with the values above. If `nsi` row already has a different `brand_primary` Andrew has set in prior testing (likely; Phase 12.6 live-approval session may have left other values), capture the original tuple in 13-CHECKLIST.md "Test Artifacts Created" section so Task 9 of Plan 13-03 can restore it post-sign-off if Andrew prefers.

    DO NOT touch `chrome_tint_intensity` — that column is deprecated post-Phase 12.6 and persists only for backward compat (see STATE.md line 245 v1.2 backlog).
  </action>
  <verify>
    Verify SELECT returns exactly 3 rows with distinct (brand_primary, background_color, background_shade, sidebar_color) tuples per the table above.
    Spot-check: `accounts.slug='nsi-rls-test-3'.background_color IS NULL` AND `accounts.slug='nsi-rls-test-3'.sidebar_color IS NULL` (the null/clear regression path).
    Spot-check: `accounts.slug='nsi'.sidebar_color = '#0A2540'` (matches brand_primary; full navy combo).
  </verify>
  <done>
    Three accounts have distinct branding ready for QA-12 surface walkthrough.
  </done>
</task>

<task type="auto">
  <name>Task 6: Create capacity=3 'Capacity Test' event_type owned by Test User 2 (QA-11 setup)</name>
  <files>
    (no local file changes — production data setup via UI flow)
  </files>
  <action>
    Per RESEARCH.md "Pre-Flight Inventory" Item 4 + Phase 11 Plan 11-07 deferred check #4: a `max_bookings_per_slot=3, show_remaining_capacity=true` event_type must be live before QA-11 can exercise the capacity end-to-end (3 bookings succeed; 4th hits SLOT_CAPACITY_REACHED).

    **Owner choice:** Test User 2 (`nsi-rls-test`) — per RESEARCH.md rationale: keeps the capacity-test event off Andrew's primary NSI account, which preserves QA-12 Account A clean (Andrew's NSI may have other event types Andrew uses; we don't want capacity test bookings cluttering NSI's bookings list during QA-12 walkthrough).

    **Procedure (Claude cannot do this — requires logged-in browser session as Test User 2):**

    This is technically a checkpoint, but the substance is small (one form fill); piggy-backing into "auto" with embedded human-action steps Andrew completes inline. Andrew clicks-through; Claude verifies via curl after.

    Andrew steps:

    1. Open a fresh browser window (incognito recommended, OR log out of Andrew's NSI session first).
    2. Visit `https://calendar-app-xi-smoky.vercel.app/app/login`. Sign in as `andrewjameswegner@gmail.com` with `TEST_OWNER_2_PASSWORD` from `.env.local`.
    3. Navigate to `/app/event-types/new`.
    4. Fill the form:
       - **Name:** "Capacity Test"
       - **Slug:** "capacity-test"
       - **Duration (minutes):** 30
       - **Description:** "Phase 13 QA-11 verification — capacity=3 race test"
       - **Max bookings per slot:** 3
       - **Show remaining capacity to bookers:** ON (toggle ON; this exercises Phase 11 CAP-08 "X spots left" badge during QA-11 step 3)
       - **Availability:** use the global default rules (already configured during Test User 2 onboarding — no changes needed)
    5. Save the event type.

    Claude verifies (no need to wait for Andrew between this and Task 7 if running in parallel-friendly mode — this verification can be retried):

    ```
    curl -i https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/capacity-test
    # Expect: 200 OK; renders the public booking page with at least one bookable slot in the next 7 days
    ```

    If 404: event type wasn't saved successfully or slug differs. Andrew re-checks `/app/event-types` for the row and reports the actual slug.

    If 200 but no slots visible: Test User 2's availability_rules table is empty for the next 7 days — this is unexpected (defaults from onboarding should cover Mon-Fri 9-5). Andrew checks `/app/availability` and adds at least Mon-Fri 9 AM - 5 PM rules if the page is empty.
  </action>
  <verify>
    `curl -i https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/capacity-test` returns 200.
    Page contains visible time slots for at least the next 7 days (visual confirmation by Andrew).
    SQL spot-check (optional): `SELECT name, slug, max_bookings_per_slot, show_remaining_capacity FROM event_types WHERE slug='capacity-test'` shows `(name='Capacity Test', slug='capacity-test', max_bookings_per_slot=3, show_remaining_capacity=true)`.
  </verify>
  <done>
    Capacity=3 event type live; QA-11 can target https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/capacity-test.
  </done>
</task>

<task type="auto">
  <name>Task 7: Scaffold 13-CHECKLIST.md system-of-record artifact</name>
  <files>
    .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
  </files>
  <action>
    Per RESEARCH.md "Code Examples" §Checklist Scaffold (lines 614-686): create the live session-of-record file. Plans 13-02 and 13-03 fill it in.

    Drop the following content verbatim into `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md`:

    ```markdown
    # Phase 13 Manual QA Checklist

    **Session start:** [TIMESTAMP — fill at start of Plan 13-02]
    **Driver:** Andrew (executor) + Claude (proposer / scribe)
    **Pass bar:** Strict by default. Any QA item may be downgraded to "deferred to v1.2" by Andrew at the time of surface — captured in the Notes column and propagated to FUTURE_DIRECTIONS.md §8.

    ## Pre-flight (Plan 13-01 artifacts)

    - [ ] Item 0: NSI mark asset swap done (Phase 12.6 deferred #8) — commit: ___
    - [ ] Item 1: Phase 10 Plan 10-05 5-step sequence complete (email-confirm toggle ON; Andrew login still works) — completed: ___
    - [ ] Item 2: Test User 3 created in auth.users + accounts row INSERTed (Phase 10 Plan 10-09) — uuid: ___
    - [ ] Item 3: 3 distinct branding profiles applied to nsi / nsi-rls-test / nsi-rls-test-3 — verified: ___
    - [ ] Item 4: capacity=3 "Capacity Test" event type live on `/nsi-rls-test/capacity-test` — confirmed: ___
    - [ ] Item 5: 13-CHECKLIST.md scaffolded (this file)
    - [ ] Item 6: Production deploy current — commit SHA: ___

    ## Marathon Criteria (Plan 13-02)

    | # | Criterion | Status | Timestamp | Notes |
    |---|-----------|--------|-----------|-------|
    | QA-09 | Signup → email-verify → onboarding wizard → first booking E2E | __ | __ | __ |
    | QA-10 | Multi-tenant UI isolation (login as Test User 2, ZERO of Andrew's data on 7 surfaces) | __ | __ | __ |
    | QA-11 | Capacity=3 E2E (3 succeed, 4th SLOT_CAPACITY_REACHED) | __ | __ | __ |
    | QA-12 | 3-account branded smoke × 4 surfaces (12 spot-checks + 3 emails = 15 total) | __ | __ | __ |
    | QA-13 | EmbedCodeDialog at 320 / 768 / 1024 (no horizontal overflow) | __ | __ | __ |

    ## QA-12 Sub-table (3 accounts × 4 surfaces + 3 emails)

    | Account | Dashboard | Public booking | Embed | Email header band |
    |---------|-----------|----------------|-------|-------------------|
    | A — nsi (navy combo: brand_primary=#0A2540, bg=#F8FAFC, shade=subtle, sidebar=#0A2540) | __ | __ | __ | __ |
    | B — nsi-rls-test (magenta combo: brand_primary=#EC4899, bg=#FDF2F8, shade=bold, sidebar=#EC4899) | __ | __ | __ | __ |
    | C — nsi-rls-test-3 (null combo: brand_primary=#22C55E, bg=null, shade=none, sidebar=null) | __ | __ | __ | __ |

    ## Deferred Check Replays (from MILESTONE_V1_1_DEFERRED_CHECKS.md)

    | Source phase / item | Replay outcome | Notes |
    |---------------------|----------------|-------|
    | Phase 10 / 10-05 (5-step) | __ | Item 1 above (Plan 13-01 Task 3) |
    | Phase 10 / 10-08 email-change E2E | __ | OPPORTUNISTIC — log if exercised; else defer to v1.2 |
    | Phase 10 / 10-09 Test User 3 | __ | Item 2 above (Plan 13-01 Task 4) |
    | Phase 11 / 11-08 capacity badge ('X spots left') | __ | Folds into QA-11 step 3 |
    | Phase 11 / 11-08 409 message branching (SLOT_CAPACITY_REACHED) | __ | Folds into QA-11 step 4 |
    | Phase 11 / 11-06 pg-driver race test (CAP-06) | __ | OPTIONAL — requires SUPABASE_DIRECT_URL |
    | Phase 11 / 11-07 CAP-09 over-cap modal | __ | OPPORTUNISTIC — log if exercised |
    | Phase 12 / item #1 Inter font load | __ | Phase 9 captured; not retrying |
    | Phase 12 / item #2 bg-gray-50 render | __ | Folds into QA-12 surface 1 (Account C) |
    | Phase 12 / item #3 Gradient backdrop sweep | __ | Folds into QA-12 (3 shades across 3 accounts) |
    | Phase 12 / item #4 Live branding editor update | __ | Folds into QA-12 surface 1 step 3 |
    | Phase 12 / item #5 Home tab calendar + Sheet drawer | __ | OPPORTUNISTIC during QA-09 |
    | Phase 12 / item #6 Auth pages split-panel responsive | __ | OPPORTUNISTIC during QA-09 signup form |
    | Phase 12 / item #7 Email branded header in real inbox | __ | Folds into QA-12 surface 4 |
    | Phase 12 / item #8 NSI mark image swap | __ | Item 0 above (Plan 13-01 Task 1) |
    | Phase 12 / item #9 EmbedCodeDialog viewports | __ | Equals QA-13 |
    | Phase 12 / item #10 Phase 11 regression under branded chrome | __ | Folds into QA-11 + QA-12 surface 1 |
    | Phase 12.5 / item #1 chrome_tint_intensity column unaffected | __ | Implicit via QA-12 not erroring |
    | Phase 12.5 / item #2 FloatingHeaderPill removal regression | __ | OPPORTUNISTIC — confirm during QA-12 surface 1 |
    | Phase 12.5 / item #3 Mobile hamburger trigger | __ | OPPORTUNISTIC during QA-13 at 320px |
    | Phase 12.6 / items #1-#7 | LIVE-VERIFIED 2026-04-29 (Andrew approval) | No retry needed |

    ## Test Artifacts Created During Marathon

    *Capture every test signup, test booking, test event_type for cleanup post-sign-off (per RESEARCH.md Pitfall 3)*

    - QA-09 throwaway signup user: ___ (email: ajwegner3+phase13signup@gmail.com; slug: ___; uuid: ___)
    - QA-09 first-booking booker email: ajwegner3+phase13booker@gmail.com; booking id: ___
    - QA-11 bookings: 3 confirmed bookings on capacity-test event_type — booker emails: cap1/cap2/cap3 + the 4th rejected attempt
    - QA-12 trigger bookings: 3 brandtest bookings (one per Account A/B/C); booker emails: ajwegner3+brandtest-{a,b,c}@gmail.com
    - Pre-13-01 NSI branding values (if Andrew wants to restore post-sign-off): ___

    ## Deferrals to v1.2

    *Any criterion downgraded by Andrew during the session — captured here with reason. Each row is propagated to FUTURE_DIRECTIONS.md §8 by Plan 13-03.*

    | Item | Reason | Recommended v1.2 action |
    |------|--------|-------------------------|
    | (filled during 13-02) | | |

    ## Sign-off

    - [ ] Andrew reviewed 13-CHECKLIST.md and FUTURE_DIRECTIONS.md §8
    - [ ] Andrew explicit verbal sign-off ("ship v1.1")
    - **Sign-off timestamp:** __
    - **Sign-off commit:** __
    ```

    Adjust column widths and section ordering as needed for readability. Plan 13-02 will fill in PASS/FAIL per row.
  </action>
  <verify>
    File exists at `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md`.
    Contains the QA-09..QA-13 marathon criteria as table rows.
    Contains 3-account × 4-surface QA-12 sub-table with the exact branding tuples from Task 5.
    Contains Deferred Check Replays section enumerating all 21 items from MILESTONE_V1_1_DEFERRED_CHECKS.md (10-05, 10-08, 10-09, 4× P11, 10× P12, 3× P12.5, 8× P12.6 — note P12.6 #1-#7 marked already-verified).
    Contains Test Artifacts Created section.
    Contains Sign-off section placeholder.
  </verify>
  <done>
    Checklist scaffold ready for Plan 13-02 to populate.
  </done>
</task>

<task type="auto">
  <name>Task 8: Push pre-flight commits to origin/main + confirm Vercel deploy green</name>
  <files>
    (no new file changes — git + verification)
  </files>
  <action>
    Per STATE.md "PROCESS LOCK: Push to origin/main before live Vercel checkpoints" + RESEARCH.md "Pre-Flight Inventory" Item 6: ensure all Plan 13-01 commits are live on production before Plan 13-02 starts.

    Steps:

    1. `git status` — verify the expected files are staged/committed:
       - `public/nsi-mark.png` (binary swap from Task 1; will show as "modified")
       - `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md` (new file from Task 7)
       - `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-01-PLAN.md` (this plan; should be already committed by the orchestrator that ran /gsd:plan-phase, but verify)

       Note: `.env.test.local` is gitignored (correctly — contains TEST_OWNER_3_PASSWORD); should NOT appear in git status.

    2. Commit the NSI mark swap separately from the checklist (atomic-commit hygiene per project convention):

       ```
       git add public/nsi-mark.png
       git commit -m "feat(13-01): swap NSI mark placeholder with final brand asset

       - Closes Phase 12.6 deferred check #8
       - Required for Phase 13 QA-12 surface 4 (email header band) to render real brand identity
       - Source: MILESTONE_V1_1_DEFERRED_CHECKS.md Phase 12.6 final note"
       ```

       Then stage the checklist:

       ```
       git add .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
       git commit -m "docs(13-01): scaffold 13-CHECKLIST.md session-of-record

       - QA-09..QA-13 marathon criteria table
       - QA-12 3-account × 4-surface sub-table
       - Deferred Check Replay matrix (21 items inventoried from MILESTONE_V1_1_DEFERRED_CHECKS.md)
       - Sign-off + Test Artifacts placeholder sections"
       ```

    3. `git push origin main`.

    4. Wait for Vercel deploy:
       ```
       npx vercel ls --token=$VERCEL_TOKEN 2>/dev/null | head -3
       ```
       (or check the Vercel dashboard at https://vercel.com → calendar-app project → Deployments).

       The latest deployment must show status READY. Capture the SHA — it should equal `git log origin/main -1 --format=%H`.

    5. Smoke-confirm the NSI mark swap is live:
       ```
       curl -I https://calendar-app-xi-smoky.vercel.app/nsi-mark.png
       ```
       Expect 200 OK + `Content-Length` greater than the placeholder (>1KB; likely 2-10KB if Andrew supplied a real asset). If `Content-Length` matches the placeholder bytes (~280), the deploy hasn't picked up the new image yet — wait 30s and retry. Vercel CDN propagation can be 1-2 min for binary assets.

    6. Update 13-CHECKLIST.md Pre-flight Item 6 row with the deployment SHA captured. Re-commit with:
       ```
       git commit -am "docs(13-01): record pre-flight deployment SHA in checklist"
       git push origin main
       ```
       (Optional; only if SHA recording materially helps Plan 13-02 traceability. If skipping, leave the placeholder for Plan 13-02 to fill.)
  </action>
  <verify>
    `git log origin/main --oneline | head -5` shows the new commits at top.
    Vercel deploy is green for the latest commit.
    `curl -I https://calendar-app-xi-smoky.vercel.app/nsi-mark.png` returns 200 + Content-Length > placeholder size.
    `curl -i https://calendar-app-xi-smoky.vercel.app/auth/confirm?token_hash=test&type=signup` returns 4xx (NOT 404) confirming auth-confirm route deployed.
  </verify>
  <done>
    All Plan 13-01 changes live in production. Plan 13-02 has zero pre-flight blockers.
  </done>
</task>

</tasks>

<verification>
- All 6 pre-flight items confirmed done (Items 0-5 in 13-CHECKLIST.md ticked)
- Andrew's `email_confirmed_at` NOT NULL in auth.users (verified post-Step-1 SQL)
- Email-confirm toggle ON; Andrew's login still works (verified post-Step-5)
- Test User 3 exists with credentials in `.env.test.local`; matrix test ~28-30 cases pass
- 3 branded accounts have distinct (brand_primary, background_color, background_shade, sidebar_color) tuples per Task 5 table
- Capacity=3 event type live at `https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/capacity-test`
- 13-CHECKLIST.md scaffolded with QA-09..QA-13 + 3-account QA-12 sub-table + Deferred Replays matrix + Test Artifacts + Sign-off sections
- Production deploy SHA matches `git log origin/main -1 --format=%H`; NSI mark swap verified live (Content-Length > placeholder)
- All Plan 13-01 commits pushed to origin/main; Vercel deploy green
- npm test still 255 passing + 26 skipped (unchanged — this plan ships zero runtime code)
</verification>

<success_criteria>
- All Plan 13-01 must_haves satisfied
- Plan 13-02 has zero remaining pre-flight blockers
- Andrew can sign in. Test User 2 can sign in. Test User 3 can sign in.
- 3 branded accounts visually differentiated; capacity event ready; checklist staged
- No regressions: production deploy still serves the same Phase 12.6-complete code, with NSI mark + test data added
</success_criteria>

<output>
After completion, create `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-01-SUMMARY.md` summarizing: pre-flight items confirmed, NSI mark swap commit SHA, email-confirm toggle outcome (login confirmed), Test User 3 uuid, 3-account branding values applied, capacity event slug confirmed, checklist scaffold path, Vercel deploy SHA, and any issues / deferrals captured for Plan 13-03 FUTURE_DIRECTIONS.md.
</output>

<pitfalls>
- **Pitfall 1 (RESEARCH.md): Email-confirm toggle flipped before pre-flight SQL → Andrew locked out.** Step 1 of Task 3 MUST run before Step 2. The `<resume-signal>` for Task 3 explicitly chains the steps; do not let Andrew skip ahead. Mitigation: re-run Step 1 with the conditional UPDATE uncommented if Andrew is locked out post-Step-2.
- **Pitfall 2 (RESEARCH.md): Marathon QA runs before deploy is current → false negatives.** Task 2 verifies SHA equality; Task 8 verifies post-push deploy. Plan 13-02 will Ctrl+Shift+R at every QA surface. Do not start 13-02 if any verification step in Task 2 or Task 8 fails.
- **Pitfall 7 (RESEARCH.md): Test User 3 auto-confirm bypasses signup-flow.** Intentional. QA-09 covers the signup-flow path with a fresh throwaway user. Test User 3 is for RLS / branding testing only.
- **Pitfall 8 (RESEARCH.md): NSI mark swap deferred → emails ship with placeholder during QA.** Task 1 is the HARD blocking checkpoint; do not let Andrew defer this. If asset truly unavailable, log "DEFERRED — placeholder still in production at sign-off; final asset to ship in v1.1.1 patch" in checklist Notes for QA-12 surface 4 and accept the qualified PASS, but escalate this concern in 13-03 FUTURE_DIRECTIONS.md as a top-line v1.2 priority.
- **`name` NOT `display_name` schema gotcha (Plan 10-09 / STATE.md line 124):** Task 4 Step 2 SQL uses `name`. The DB column is `name`. UI label says "Display Name". Using `display_name` will throw a column-not-found error.
- **Migration drift workaround (STATE.md line 117):** If any SQL fails with "Remote migration versions not found", use `npx supabase db query --linked -c "..."` (NOT `db push`).
</pitfalls>
