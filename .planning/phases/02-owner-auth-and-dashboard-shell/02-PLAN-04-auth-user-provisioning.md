---
phase: 02-owner-auth-and-dashboard-shell
plan: 04
type: execute
wave: 3
depends_on: ["02-01", "02-02", "02-03"]
files_modified:
  - .env.local
autonomous: false
user_setup:
  - service: supabase-auth
    why: "Phase 2 requires a real Supabase Auth user (Andrew's) to be created manually + linked to the existing `nsi` account. No public signup UI in v1; one-time provisioning."
    env_vars:
      - name: TEST_OWNER_EMAIL
        source: "Whatever email address Andrew uses when creating the Supabase Auth user in step 1"
      - name: TEST_OWNER_PASSWORD
        source: "Whatever strong password Andrew sets in step 1"
    dashboard_config:
      - task: "Disable 'Confirm email'"
        location: "Supabase Dashboard -> Authentication -> Sign In / Up -> Email provider -> toggle OFF 'Confirm email'"
      - task: "Create owner user"
        location: "Supabase Dashboard -> Authentication -> Users -> Add user (email + password, skip email confirmation)"

must_haves:
  truths:
    - "Andrew's Supabase Auth user exists with a known email + password (AUTH-01 end-to-end precondition)"
    - "accounts.owner_user_id for slug='nsi' equals Andrew's auth.users.id (RLS linkage; dashboard unlocks)"
    - "Vitest authenticated-owner RLS suite passes (AUTH-01/AUTH-04 + RLS proof)"
    - "Full end-to-end smoke passes: /app/* redirects to /app/login when logged out, login succeeds, /app renders welcome card, refresh keeps session, logout returns to /app/login (AUTH-01 through AUTH-04, DASH-01)"
    - "The actual runtime shape of supabase.rpc('current_owner_account_ids') is observed end-to-end and documented in SUMMARY.md (closes RESEARCH Open Question #1 with evidence)"
  artifacts:
    - path: ".env.local"
      provides: "Real TEST_OWNER_EMAIL + TEST_OWNER_PASSWORD for Vitest helper (gitignored, NEVER committed)"
      contains: "TEST_OWNER_EMAIL="
  key_links:
    - from: "auth.users row (Andrew's UUID)"
      to: "accounts.owner_user_id for slug='nsi'"
      via: "One-time MCP execute_sql UPDATE run by orchestrator"
      pattern: "UPDATE accounts SET owner_user_id"
    - from: "tests/rls-authenticated-owner.test.ts"
      to: "Real Supabase Auth user (Andrew)"
      via: "signInAsNsiOwner reads TEST_OWNER_EMAIL/PASSWORD from .env.local"
      pattern: "signInWithPassword"
---

<objective>
Complete Phase 2 by provisioning Andrew's Supabase Auth user, linking it to the existing `nsi` account, running the authenticated-owner RLS test, and performing the end-to-end smoke of the full login flow. This is the only non-autonomous plan in Phase 2 — it has a single human checkpoint where Andrew does three things in the Supabase dashboard that Claude literally cannot do.

Purpose: Converts the UI + auth surfaces from Plans 01-03 into a working, verified, end-to-end login flow. Without this plan, the login code compiles and the UI renders but no user can actually log in. Also closes RESEARCH Open Question #1 (RPC return-shape evidence — MAJOR 7 from plan checker) by capturing the observed shape during the first authenticated end-to-end hit.

Output: A verified, documented, live-tested Phase 2 deliverable — Andrew can log in at https://calendar-app-xi-smoky.vercel.app/app/login (or dev equivalent), land on the dashboard, navigate, refresh, and log out.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-owner-auth-and-dashboard-shell/02-CONTEXT.md
@.planning/phases/02-owner-auth-and-dashboard-shell/02-RESEARCH.md

# Plans 01-03 artifacts this plan verifies
@app/(auth)/app/login/actions.ts
@app/(shell)/layout.tsx
@lib/supabase/proxy.ts
@tests/rls-authenticated-owner.test.ts
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew provisions auth user + disables email confirmation + reports UUID</name>
  <what-built>
Plans 01-03 shipped the complete login surface (page, form, Server Action, Route Handler, proxy gate, shell layout, test harness). None of it works end-to-end until a real Supabase Auth user exists and is linked to the `nsi` account row.

This is a one-time Dashboard-only provisioning step. There is no Supabase CLI command or API that both (a) creates a user without email confirmation and (b) does so without exposing the service role key to Claude in a way that would then require gitignored secret rotation. Andrew owns the Supabase project; Andrew does this manually.
  </what-built>
  <how-to-verify>
Perform these steps in the Supabase dashboard for project `Calendar` (ref `mogfnutxrrbtvnaupoun`):

**Step 1 — Disable email confirmation (one-time setting):**
1. Go to https://supabase.com/dashboard/project/mogfnutxrrbtvnaupoun/auth/providers
2. Click the "Email" provider to expand it.
3. Toggle OFF "Confirm email" (so newly-created users can log in immediately without clicking a verification link).
4. Click **Save**.

**Step 2 — Create the owner user:**
1. Go to https://supabase.com/dashboard/project/mogfnutxrrbtvnaupoun/auth/users
2. Click **Add user** → **Create new user**.
3. Enter:
   - Email: (your real email — the one you'll log in with)
   - Password: (a strong password; save it in your password manager)
4. Check **Auto Confirm User** (so you skip email verification for this user).
5. Click **Create user**.
6. After creation, click the user row to open it. Copy the **UUID** shown at the top (e.g., `abcd1234-5678-...`).

**Step 3 — Report back:**
Paste the following into chat, replacing bracketed values:

```
User created.
UUID: [paste-uuid-here]
Email: [paste-email-here]
```

(Do NOT paste the password into chat. Save it in your password manager — you'll add it to `.env.local` in Task 2.)

**Step 4 — Orchestrator action (after Andrew reports):**
The orchestrator (not Claude's executor) will run this MCP command to link the user to the `nsi` account:

```sql
UPDATE accounts
SET owner_user_id = '<ANDREW-UUID-FROM-STEP-3>'
WHERE slug = 'nsi';
```

Expected: "1 row affected". After this runs, Andrew's auth identity is linked to the `nsi` tenant and RLS policies (from Phase 1's `current_owner_account_ids()` function) will grant him visibility on his own data.

**Verification after the checkpoint resumes:**
```sql
-- Orchestrator runs this after the UPDATE to confirm linkage
SELECT id, slug, owner_user_id, timezone FROM accounts WHERE slug = 'nsi';
-- Expect: owner_user_id = <ANDREW-UUID>, timezone = 'America/Chicago'
```
  </how-to-verify>
  <resume-signal>Paste "User created. UUID: [uuid]  Email: [email]" into chat. The orchestrator will run the MCP UPDATE and confirm "1 row affected" before the executor resumes with Task 2.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Write credentials to .env.local and run authenticated-owner RLS test</name>
  <files>.env.local</files>
  <action>
**Step 1 — Add test credentials to `.env.local`** (NOT committed — `.env.local` is gitignored from Phase 1).

Ask Andrew to append the following two lines to `.env.local`, replacing bracketed values with the email + password he used in Task 1:

```bash
# Phase 2 — Vitest authenticated-owner test helper.
TEST_OWNER_EMAIL=<andrew-email-from-task-1>
TEST_OWNER_PASSWORD=<andrew-password-from-task-1>
```

Before continuing, confirm the variables are both present AND non-empty (MAJOR 6 from plan checker — bare `TEST_OWNER_EMAIL=` with an empty value used to silently pass the old verification):
```bash
grep -qE "^TEST_OWNER_EMAIL=.+" .env.local || { echo "TEST_OWNER_EMAIL empty"; exit 1; }
grep -qE "^TEST_OWNER_PASSWORD=.+" .env.local || { echo "TEST_OWNER_PASSWORD empty"; exit 1; }
git check-ignore -q .env.local && echo ".env.local is gitignored — safe"
```

If `.env.local` is NOT gitignored, STOP and fix `.gitignore` before continuing (should already be gitignored from Phase 1; this is a sanity check).

**Step 2 — Run the authenticated-owner RLS test:**

```bash
npm test -- tests/rls-authenticated-owner.test.ts
```

Expected output: 4 passing tests.

1. "owner sees exactly 1 account row (their own nsi account)"
2. "owner cannot SELECT the nsi-test account (RLS blocks cross-tenant)"
3. "owner sees 0 event_types initially"
4. "owner sees 0 bookings initially"

**Failure modes:**

| Symptom | Likely cause | Fix |
|---|---|---|
| "signInAsNsiOwner failed: Invalid login credentials" | Password typo in `.env.local`, OR user wasn't created with Auto Confirm | Re-check `.env.local`; if still failing, check that the user's `email_confirmed_at` is set in the Supabase dashboard. If null, Auto Confirm was unchecked — manually confirm via dashboard's "Confirm user" action |
| `accounts).toHaveLength(1)` received 0 | The MCP UPDATE in Task 1 didn't link `owner_user_id` | Orchestrator re-runs: `UPDATE accounts SET owner_user_id = '<uuid>' WHERE slug = 'nsi';` — verify with SELECT |
| `accounts).toHaveLength(1)` received 2 | The nsi-test account is also showing up (RLS policy gap) | This is a real bug — RLS policy on `accounts` isn't scoping to `current_owner_account_ids()`. Investigate `supabase/migrations/` policies before continuing |
| "TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD missing" | `.env.local` not loaded by Vitest | Check `vitest.config.ts` — Phase 1 set this up with dotenv; confirm `dotenv/config` import is present |

**Step 3 — Run the full Vitest suite to confirm no regressions:**

```bash
npm test
```

Expected: all tests green (race-guard + rls-anon-lockout + rls-authenticated-owner).

Also run lint + build as a final sanity check:

```bash
npm run lint
npm run build
```

DO NOT:
- Do not commit `.env.local`. Ever.
- Do not echo the password to chat or to stdout during execution.
- Do not modify the RLS test to "make it pass" — if it fails, the failure is legitimate (see failure modes table).
  </action>
  <verify>
```bash
# MAJOR 6 — value-present (not just key-present) assertions
grep -qE "^TEST_OWNER_EMAIL=.+" .env.local || { echo "TEST_OWNER_EMAIL empty"; exit 1; }
grep -qE "^TEST_OWNER_PASSWORD=.+" .env.local || { echo "TEST_OWNER_PASSWORD empty"; exit 1; }
echo "env vars present and non-empty"

# .env.local not staged / not tracked
git check-ignore -q .env.local && echo ".env.local still gitignored"
git ls-files | grep -q "^.env.local$" && echo "LEAK — .env.local tracked" || echo ".env.local not tracked"

# The authenticated-owner test now passes
npm test -- tests/rls-authenticated-owner.test.ts

# Full suite green
npm test

# Build + lint clean
npm run build
npm run lint
```
  </verify>
  <done>
`.env.local` contains `TEST_OWNER_EMAIL` and `TEST_OWNER_PASSWORD` with real, NON-EMPTY values (value-present grep, not just key-present — per plan-checker MAJOR 6). `.env.local` is gitignored and not tracked. `npm test -- tests/rls-authenticated-owner.test.ts` shows 4 passing tests. `npm test` (full suite) is green. `npm run lint` and `npm run build` exit 0. No commit from this task (env updates are local-only).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: End-to-end smoke test the full login flow + capture RPC shape evidence</name>
  <what-built>
The complete Phase 2 deliverable: login page, Server Action auth, dashboard shell with sidebar, 4 nav stubs, welcome card, unlinked error page, logout, and proxy redirect gate. Andrew's auth user is now created + linked; all infrastructure is in place.

This checkpoint does two jobs:
1. Verify the user experience matches what CONTEXT.md locked in.
2. Close RESEARCH Open Question #1 with evidence — capture the observed runtime shape of `supabase.rpc("current_owner_account_ids")` during the first real authenticated hit to `/app` (plan-checker MAJOR 7).
  </what-built>
  <how-to-verify>

**Step 0 — Add transient console.log for RPC shape evidence (plan-checker MAJOR 7).**

Before starting the smoke, edit `app/(shell)/app/page.tsx`. Immediately after the `supabase.rpc("current_owner_account_ids")` call, add ONE line:

```ts
const { data, error } = await supabase.rpc("current_owner_account_ids");
console.log("[RPC shape]", data);  // transient — removed in same commit
```

This log is INTENTIONALLY TRANSIENT. It gets removed in the same commit that ships the removal (see Step 13). Do not ship it to prod.

**Option A (preferred) — Production smoke on Vercel:**

Wait for Vercel auto-deploy to finish (it runs on every push to `main`; Plans 01-03 pushed multiple times, so the latest should be live). Check the deploy status:

```bash
# Or just open Vercel dashboard
echo "Visit: https://vercel.com/<your-team>/calendar-app/deployments"
```

Then test at https://calendar-app-xi-smoky.vercel.app. Tail logs with `vercel logs --follow` OR read from the Vercel dashboard's Runtime Logs tab during the `/app` visit in step 5 below.

**Option B — Local dev smoke:**

```bash
npm run dev
# Visit http://localhost:3000 in a browser
# The "[RPC shape]" log will print in the `npm run dev` terminal.
```

**Run through this checklist (both environments should behave identically):**

1. **Unauthenticated protection (AUTH-04):**
   - [ ] Visit `/app` while logged out → redirects to `/app/login` (check URL bar)
   - [ ] Visit `/app/event-types` while logged out → redirects to `/app/login`
   - [ ] Visit `/app/login` while logged out → page loads (HTTP 200)

2. **Login page UX (AUTH-01):**
   - [ ] Centered card visible with NSI branding at the top
   - [ ] Email and Password inputs present
   - [ ] "Sign in" button visible
   - [ ] Browser password manager offers to fill saved credentials (autoComplete working)

3. **Invalid credentials (AUTH-01 error path):**
   - [ ] Submit with a wrong password → inline banner "Invalid email or password." appears above the form
   - [ ] Banner is generic — does NOT distinguish wrong email from wrong password

4. **Client-side validation:**
   - [ ] Submit with empty email → inline "Enter a valid email address." appears under the email field
   - [ ] Submit with empty password → inline "Password is required." appears under the password field

5. **Valid login (AUTH-01 happy path) + RPC shape capture:**
   - [ ] Enter correct email + password → button disables, spinner shows
   - [ ] Redirects to `/app`
   - [ ] Welcome card renders: "Welcome to NSI Bookings" with 3 callouts (Event Types, Availability, Branding)
   - [ ] **In the `npm run dev` terminal (or Vercel Runtime Logs), locate the `[RPC shape]` log line emitted during this `/app` render. Copy it verbatim.**
   - [ ] Paste into a scratch note for Step 13's SUMMARY entry. Expected shapes:
     - If raw UUID array: `[RPC shape] ['ba8e712d-...']`
     - If wrapped objects: `[RPC shape] [{ current_owner_account_ids: 'ba8e712d-...' }]`
     - Anything else: record verbatim and flag.

6. **Dashboard shell (DASH-01):**
   - [ ] Fixed left sidebar visible with 4 nav items (Event Types, Availability, Branding, Bookings)
   - [ ] NSI branding at top of sidebar
   - [ ] Email address shown at bottom of sidebar
   - [ ] "Log out" button visible at bottom of sidebar

7. **Navigation:**
   - [ ] Click "Event Types" → URL becomes `/app/event-types`, page shows "Event Types" heading + "Coming in Phase 3"
   - [ ] Click "Availability" → URL becomes `/app/availability`, page shows "Availability" + "Coming in Phase 4"
   - [ ] Click "Branding" → URL becomes `/app/branding`, page shows "Branding" + "Coming in Phase 7"
   - [ ] Click "Bookings" → URL becomes `/app/bookings`, page shows "Bookings" + "Coming in Phase 8"
   - [ ] Active nav item is visually highlighted in the sidebar

8. **Mobile responsiveness:**
   - [ ] Resize browser below 768px width → sidebar collapses, hamburger icon appears in top bar
   - [ ] Click hamburger → sidebar slides in as an overlay (offcanvas)
   - [ ] Click outside → sidebar closes

9. **Session persistence (AUTH-03):**
   - [ ] Hard-refresh the page (Ctrl+F5 / Cmd+Shift+R) → still logged in, no bounce to login
   - [ ] Close browser tab, open new tab to `/app` → still logged in

10. **Already-logged-in bounce:**
    - [ ] While logged in, manually navigate to `/app/login` → auto-redirects to `/app`

11. **Logout (AUTH-02):**
    - [ ] Click "Log out" in sidebar footer → redirects to `/app/login`
    - [ ] Now visit `/app` → redirects back to `/app/login` (session fully cleared)

12. **Unlinked user handling (edge case — SKIP if no easy way to test):**
    - To test: create a second test user in Supabase dashboard WITHOUT running the MCP UPDATE for them.
    - Log in as that user → should redirect to `/app/unlinked` showing "Account not linked" card with Log out button.
    - This is a nice-to-have; skip if provisioning a second test user is annoying. The unit path (empty RPC result → redirect) is covered by code review + can be manually probed later.

13. **Remove the transient console.log + record shape in SUMMARY (plan-checker MAJOR 7):**
    - [ ] Open `app/(shell)/app/page.tsx` and remove the `console.log("[RPC shape]", data);` line added in Step 0.
    - [ ] Run `npm run build` — should exit 0.
    - [ ] Commit and push: `chore(02-04): remove transient RPC-shape debug log`
    - [ ] In `.planning/phases/02-owner-auth-and-dashboard-shell/02-04-SUMMARY.md`, add a section "RPC shape evidence" with the verbatim log line you captured in Step 5.
    - [ ] If the shape was WRAPPED (`[{ current_owner_account_ids: 'uuid' }, ...]`), add a follow-up note to SUMMARY: "Phase 3 MUST change the length check in `app/(shell)/app/page.tsx` from `data.length === 0` to `data.filter(r => r.current_owner_account_ids).length === 0` before Phase 3 starts querying tenant data. File a todo in STATE.md." This is the load-bearing reason the log exists — evidence, not assumption.
    - [ ] If the shape was raw UUID strings (`['uuid', ...]`), no follow-up action needed — the existing length check is correct. Still record the evidence in SUMMARY.

**Expected result:** All 11 required checks pass (12 is optional). Step 5's RPC shape line captured + pasted into SUMMARY. Step 13's console.log removal committed. Phase 2 is done.

**If anything fails:** Note the specific failure in chat; the orchestrator will either file a gap or iterate on the relevant plan (01/02/03). Do NOT mark Phase 2 complete with any failed check.
  </how-to-verify>
  <resume-signal>Type "approved — all checks pass, RPC shape: [paste log line]" OR list any failures as "failed check: {N}: {description}".</resume-signal>
</task>

</tasks>

<verification>
After Tasks 1-3 all pass:

```bash
# Final state check
npm test             # all green including rls-authenticated-owner
npm run build        # exit 0
npm run lint         # exit 0
git status           # clean working tree (plans + code committed)

# Confirm transient console.log was removed (plan-checker MAJOR 7)
! grep -q 'RPC shape' "app/(shell)/app/page.tsx" && echo "transient log removed"

# Confirm Andrew's user is linked at the DB layer (orchestrator verifies via MCP)
# SELECT owner_user_id FROM accounts WHERE slug = 'nsi'; -- expect UUID, not NULL
```
</verification>

<success_criteria>
- [ ] Andrew's Supabase Auth user exists (confirmed by successful `signInWithPassword` in the Vitest test)
- [ ] `accounts.owner_user_id` for `slug='nsi'` equals Andrew's auth UUID (confirmed by `linkedCount === 1` on the `/app` page load)
- [ ] "Confirm email" is OFF in Supabase Auth settings (so Andrew could log in immediately without a verification link)
- [ ] `.env.local` contains `TEST_OWNER_EMAIL` + `TEST_OWNER_PASSWORD` with real, NON-EMPTY values (value-present grep — plan-checker MAJOR 6); file is gitignored and not tracked
- [ ] `tests/rls-authenticated-owner.test.ts` — all 4 assertions pass
- [ ] Full Vitest suite green (race-guard + rls-anon-lockout + rls-authenticated-owner)
- [ ] End-to-end smoke (Task 3) — 11 required checks pass
- [ ] RPC shape evidence captured: the `[RPC shape]` log line observed during the first authenticated `/app` hit is recorded verbatim in `02-04-SUMMARY.md` (plan-checker MAJOR 7 closure)
- [ ] The transient `console.log("[RPC shape]", data)` has been REMOVED from `app/(shell)/app/page.tsx` and that removal is committed
- [ ] If the RPC shape was wrapped objects, a follow-up todo is filed in STATE.md noting the length-check change required in Phase 3
- [ ] No secrets committed to git history (double-check: `git log --all --full-history -- '.env.local'` returns nothing)
- [ ] Phase 2 requirements AUTH-01, AUTH-02, AUTH-03, AUTH-04, DASH-01 all observably satisfied
</success_criteria>

<output>
After completion, create `.planning/phases/02-owner-auth-and-dashboard-shell/02-04-SUMMARY.md` documenting:
- Andrew's auth UUID (for reference in future phases when linking additional users)
- Confirmation the MCP UPDATE succeeded (timestamp + row-affected count)
- Smoke-test checklist results (N/11 passed, any notes)
- **RPC shape evidence** (plan-checker MAJOR 7): paste the verbatim `[RPC shape]` log line captured during the first authenticated `/app` hit. Classify it as raw UUID array or wrapped objects. If wrapped, link to the follow-up todo in STATE.md flagging the Phase 3 length-check change.
- Confirmation that the transient `console.log` was removed from `app/(shell)/app/page.tsx` in a follow-up commit (hash + timestamp).
- Final Phase 2 status: ready for `/gsd:verify-phase 2` + close-out
- Carry-forward notes for Phase 3 (event types CRUD): Andrew's authenticated session is the RLS context; all Phase 3 dashboard routes can assume `current_owner_account_ids()` returns `[nsi.id]` for Andrew (shape confirmed above)
</output>
</output>
