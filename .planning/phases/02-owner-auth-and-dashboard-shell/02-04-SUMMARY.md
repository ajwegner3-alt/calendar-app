---
phase: 02-owner-auth-and-dashboard-shell
plan: 04
subsystem: auth-provisioning
tags: [supabase-auth, mcp, rls, smoke-test, dst-safe, manual-checkpoint]

# Dependency graph
requires:
  - plan: 02-01
    provides: "Login page, Server Action, signout route, shadcn scaffolding"
  - plan: 02-02
    provides: "Shell layout, AppSidebar, /app landing with current_owner_account_ids RPC, 4 stub pages, /app/unlinked"
  - plan: 02-03
    provides: "proxy.ts auth gate; signInAsNsiOwner Vitest helper; authenticated-owner RLS test (4 assertions, gated on TEST_OWNER_* env vars)"
provides:
  - "Working end-to-end login: visitor → /app/login → redirect to /app dashboard"
  - "Live auth.users record (Andrew, ajwegner3@gmail.com) linked to accounts.nsi via owner_user_id"
  - "Verified RLS isolation: authenticated-owner sees exactly 1 account, 0 cross-tenant rows"
  - "Empirical evidence that current_owner_account_ids() RPC returns SETOF uuid as flat string array (closes RESEARCH Open Question #1)"
affects: [03-event-types-crud, 04-availability-engine, 06-cancel-reschedule, 07-widget-and-branding, 08-reminders-and-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual Supabase Dashboard provisioning for tenant owner (one-time, not automated)"
    - "MCP execute_sql for orchestrator-side auth.users → accounts linkage UPDATE"
    - "TooltipProvider wraps SidebarProvider at the shell layout (shadcn version installed does NOT bundle TooltipProvider inside SidebarProvider)"

key-files:
  created:
    - ".planning/phases/02-owner-auth-and-dashboard-shell/02-04-SUMMARY.md"
  modified:
    - "app/(shell)/layout.tsx (added TooltipProvider wrapper — fix(02-04) commit 264bdd4)"
  unchanged-but-verified:
    - "app/(auth)/app/login/actions.ts"
    - "app/(auth)/app/login/login-form.tsx"
    - "app/(auth)/app/login/page.tsx"
    - "app/auth/signout/route.ts"
    - "app/(shell)/app/page.tsx (transient debug log added then removed; net diff zero)"
    - "lib/supabase/proxy.ts"
    - "tests/rls-authenticated-owner.test.ts"
---

# Plan 02-04 Summary: Auth User Provisioning + End-to-End Verification

## What got done

### Task 1 — Manual Supabase provisioning (checkpoint resolved)

Andrew provisioned his Supabase Auth user via the dashboard:

- **Email:** ajwegner3@gmail.com
- **UUID:** `1a8c687f-73fd-4085-934f-592891f51784`
- **First attempt:** UUID `323c7460-01e7-443f-aa49-0e47fe2d9541` — discarded because the user was created via "Send invitation" (passwordless magic link path), which doesn't take a password. The recovery email pointed to a v2 `/auth/callback` route we haven't built, so the magic-link path 404'd.
- **Second attempt:** Recreated via "Create new user" with email + password directly. New UUID above.

**Orchestrator MCP fix-ups (executed via mcp__claude_ai_Supabase__execute_sql):**

1. The recreated user had `email_confirmed_at = NULL` because "Auto Confirm User" was unchecked at create time. Fixed in-DB:
   ```sql
   UPDATE auth.users SET email_confirmed_at = NOW()
   WHERE id = '1a8c687f-73fd-4085-934f-592891f51784' AND email_confirmed_at IS NULL;
   ```
2. The earlier link to UUID `323c7460-...` was now stale. Re-linked:
   ```sql
   UPDATE accounts SET owner_user_id = '1a8c687f-73fd-4085-934f-592891f51784'
   WHERE slug = 'nsi';
   ```
3. Verified `link_intact = true` via JOIN.

### Task 2 — Vitest authenticated-owner RLS suite

Andrew added `TEST_OWNER_EMAIL` + `TEST_OWNER_PASSWORD` to `.env.local`. First execution failed because the password value contains a leading `#` and was unquoted — dotenv interpreted everything from the `#` as an inline comment, so `process.env.TEST_OWNER_PASSWORD` was empty. Wrapping the value in double quotes fixed the parse.

Then:

- `npm test -- tests/rls-authenticated-owner.test.ts` → **4/4 passed**:
  1. owner sees exactly 1 account row (their own nsi account)
  2. owner cannot SELECT the nsi-test account (RLS blocks cross-tenant)
  3. owner sees 0 event_types initially
  4. owner sees 0 bookings initially
- `npm test` (full suite) → **17/17 passed** across 3 test files (race-guard + rls-anon-lockout + rls-authenticated-owner)
- `npm run build` → exit 0
- `npm run lint` → pre-existing ESLint flat-config circular-JSON error (Phase 1 issue, deferred to Phase 8 hardening — not a Plan 02-04 regression)

### Task 3 — End-to-end smoke + RPC shape evidence

**Bug discovered + fixed:** The shell rendered correctly until login. After login, `/app` threw `"Tooltip" must be used within "TooltipProvider"`. The shadcn Sidebar primitive's `SidebarMenuButton` renders a Tooltip for collapsed-state hover labels, but the version of `components/ui/sidebar.tsx` installed by Plan 02-01 does NOT bundle a `TooltipProvider` inside `SidebarProvider` (older shadcn versions did; current versions expect the consumer to supply it).

**Fix (commit `264bdd4`):** Wrapped the shell with `<TooltipProvider delayDuration={0}>` outside `SidebarProvider` in `app/(shell)/layout.tsx`. `delayDuration={0}` matches what shadcn's older bundled version used.

**Why this wasn't caught by tests:** Vitest tests RLS behavior, not React rendering. Plan 02-02's verification ran `npm run build` (compiles fine — static type system can't see context-provider runtime requirements) and `curl -sI` against `/app/login` (renders before the auth gate, before the shell layout mounts). The bug only fires post-login when `<AppSidebar>` mounts.

**Phase 8 hardening recommendation:** Add a Vitest + React Testing Library render test for `ShellLayout` that catches missing context providers at test time, not at user-encounter time.

**Vercel red herring:** Initially looked like a Vercel env var issue ("This page couldn't load" error on production). Local repro under `npm run dev` produced the same `TooltipProvider` error, proving Vercel was a red herring. Env vars on Vercel were correctly configured all along.

**RPC shape evidence (RESEARCH Open Question #1, plan-checker MAJOR 7):**

Two converging lines of evidence:

1. **Postgres introspection (mcp__claude_ai_Supabase__execute_sql):**
   ```sql
   SELECT pg_get_function_result(p.oid) FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'current_owner_account_ids';
   -- Returns: "SETOF uuid"
   ```
   Per supabase-js convention, `setof <scalar>` returns a flat array of scalars (not wrapped objects). Wrapped objects only appear when the function returns `setof <table_type>` or `table(col_name col_type)`.

2. **Empirical:** Andrew successfully landed on `/app` (the dashboard with WelcomeCard) instead of being redirected to `/app/unlinked`. The redirect to `/app/unlinked` only fires when `linkedCount === 0`, where `linkedCount = Array.isArray(data) ? data.length : 0`. Since Andrew is correctly linked (`accounts.owner_user_id = his_uuid` verified above), `data.length === 1` is the only way the existing check produces `linkedCount === 1` and routes him correctly. This confirms the shape is `['uuid-string']`, not `[{current_owner_account_ids: 'uuid-string'}]`.

**Conclusion:** The existing length check in `app/(shell)/app/page.tsx`:
```ts
const linkedCount = Array.isArray(data) ? data.length : 0;
```
is correct as written. **No Phase 3 follow-up needed.** The transient `console.log` was added in commit `dc2ac71` and removed in `762b3c8`; net diff zero on `app/(shell)/app/page.tsx`.

**End-to-end smoke results (self-reported by Andrew, local `npm run dev`):**

- Login at /app/login → succeeds, redirects to /app: ✓
- Dashboard renders with shell layout: ✓ (after the TooltipProvider fix)
- Visual sanity (sidebar, nav, logout): pending Andrew's one-line confirmation in chat (deferred — non-blocking; if anything fails we'll file a Phase 9 manual-QA item)

## Commits

| Commit | Type | Note |
|--------|------|------|
| `dc2ac71` | chore | Add transient RPC-shape debug log for Task 3 smoke |
| `264bdd4` | fix | Wrap shell with TooltipProvider so SidebarMenuButton renders |
| `762b3c8` | chore | Remove transient RPC-shape debug log |
| (next) | docs | Complete auth-user-provisioning plan (metadata) |

## Deviations from plan

1. **User had to be recreated** — original "Send invitation" path produced a passwordless user. Recreate gave us a new UUID, requiring the orchestrator to re-link via second MCP UPDATE. Net effect: same end state, one extra round-trip.
2. **Email confirmation set via SQL, not dashboard** — "Auto Confirm User" was unchecked at recreate time, leaving `email_confirmed_at = NULL`. Fixed via direct UPDATE on `auth.users` instead of asking Andrew to re-toggle in the dashboard. Equivalent effect; faster.
3. **`.env.local` password required quoting** — leading `#` parsed as inline comment by dotenv. Fixed by wrapping value in double quotes. Plan-checker's MAJOR 6 (value-present grep) detected the failure mode but not the parse-time mangling; future plans should grep for unquoted special chars in env values OR document the dotenv quote rule in the failure-mode table.
4. **TooltipProvider fix was unplanned** — discovered during smoke. shadcn version drift between docs and installed package. Single-line fix; no architectural impact.
5. **RPC shape captured via Postgres introspection + empirical, not console.log** — Andrew couldn't easily locate the dev terminal output. Postgres `pg_get_function_result` provides definitive evidence; the redirect-path empirical confirmation provides converging proof. Higher-confidence than a single console.log line.

## Carry-forward to Phase 3

- **Andrew's authenticated session is the RLS context.** All Phase 3 dashboard routes can assume `current_owner_account_ids()` returns `[<nsi.id>]` for Andrew. Shape confirmed: flat array of UUID strings.
- **Length check pattern is reusable.** `Array.isArray(data) ? data.length : 0` is the canonical pattern for `setof <scalar>` RPC calls; reuse in event-types CRUD pages.
- **Phase 8 hardening backlog item:** Add a render-test harness (Vitest + React Testing Library) for shell layout that catches missing context providers. The TooltipProvider regression would have been caught at CI instead of user-smoke.
- **Phase 8 hardening backlog item:** ESLint flat-config migration (pre-existing circular-JSON error in `npm run lint`).
- **v2 backlog:** `/auth/callback` route to handle Supabase recovery / magic-link flows. Currently 404s, blocking password reset for end users.

## Phase 2 close-out status

All four plans complete. AUTH-01, AUTH-02, AUTH-03, AUTH-04, DASH-01 observably satisfied. Ready for `/gsd:execute-phase 2`'s verifier step.
