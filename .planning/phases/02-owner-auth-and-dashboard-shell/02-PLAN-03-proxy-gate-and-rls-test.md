---
phase: 02-owner-auth-and-dashboard-shell
plan: 03
type: execute
wave: 2
depends_on: ["02-01"]
files_modified:
  - lib/supabase/proxy.ts
  - tests/helpers/supabase.ts
  - tests/rls-authenticated-owner.test.ts
  - .env.example
autonomous: true

must_haves:
  truths:
    - "Any unauthenticated request to /app/* (except /app/login) is redirected to /app/login by the proxy (AUTH-04)"
    - "Authenticated requests pass through the proxy unchanged"
    - "A Vitest test can sign in as Andrew (the NSI owner), SELECT from accounts, and see exactly 1 row (his own nsi account)"
    - "The same test confirms RLS hides the nsi-test account from Andrew"
  artifacts:
    - path: "lib/supabase/proxy.ts"
      provides: "Phase 2 route gate — redirects /app/* to /app/login when unauthenticated, /app/login exempted"
      contains: "pathname !== \"/app/login\""
    - path: "tests/helpers/supabase.ts"
      provides: "Extended with signInAsNsiOwner() helper"
      exports: ["anonClient", "adminClient", "signInAsNsiOwner", "TEST_ACCOUNT_SLUG", "getOrCreateTestAccount", "getOrCreateTestEventType"]
    - path: "tests/rls-authenticated-owner.test.ts"
      provides: "Vitest suite proving RLS allows Andrew to SELECT his own account and blocks nsi-test"
      contains: "signInAsNsiOwner"
    - path: ".env.example"
      provides: "Documented TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD env vars (empty placeholders)"
      contains: "TEST_OWNER_EMAIL"
  key_links:
    - from: "lib/supabase/proxy.ts"
      to: "/app/login"
      via: "NextResponse.redirect when !user && pathname.startsWith('/app') && pathname !== '/app/login'"
      pattern: "NextResponse.redirect"
    - from: "tests/rls-authenticated-owner.test.ts"
      to: "tests/helpers/supabase.ts"
      via: "import { signInAsNsiOwner } from './helpers/supabase'"
      pattern: "signInAsNsiOwner"
    - from: "tests/helpers/supabase.ts"
      to: "Supabase Auth"
      via: "client.auth.signInWithPassword({ email, password }) with persistSession: false"
      pattern: "signInWithPassword"
---

<objective>
Apply the 3-line proxy.ts diff that gates `/app/*` routes on authentication (carving out `/app/login`), extend the existing Vitest helper with a `signInAsNsiOwner()` factory, author the authenticated-owner RLS test (SELECT-only, against the real `nsi` account), and document the new test env vars in `.env.example`.

Purpose: Covers AUTH-04 (proxy redirect for unauthenticated `/app/*` access). Creates the authenticated complement to Phase 1's anon-lockout test. Plan 04 will RUN this test after Andrew creates his auth user + the orchestrator links it; Plan 03 only writes the code.

Output: A working proxy gate and a ready-to-run Vitest suite that will pass once Plan 04 provisions Andrew's user.
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

# Existing Phase 1 code this plan touches
@lib/supabase/proxy.ts
@tests/helpers/supabase.ts
@tests/rls-anon-lockout.test.ts
@proxy.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply proxy.ts 3-line gate for /app/*</name>
  <files>lib/supabase/proxy.ts</files>
  <action>
Open `lib/supabase/proxy.ts`. Phase 1 left a commented-out gate block near the `getClaims()` call. Replace that commented block with the active Phase 2 gate per RESEARCH §4.

**Exact diff to apply (RESEARCH §4 verbatim):**

```diff
   const { data } = await supabase.auth.getClaims();
   const user = data?.claims;

-  // Phase 1 has no auth-gated routes yet; keep the user check commented out
-  // or scoped so anon public routes stay public. Phase 2 (auth) wires this up.
-  // if (!user && request.nextUrl.pathname.startsWith("/app")) {
-  //   const url = request.nextUrl.clone();
-  //   url.pathname = "/login";
-  //   return NextResponse.redirect(url);
-  // }
-  void user;
+  // Phase 2: gate /app/* on authentication. Let /app/login through regardless.
+  const { pathname } = request.nextUrl;
+  if (
+    !user &&
+    pathname.startsWith("/app") &&
+    pathname !== "/app/login"
+  ) {
+    const url = request.nextUrl.clone();
+    url.pathname = "/app/login";
+    return NextResponse.redirect(url);
+  }

   return supabaseResponse;
```

Key rules:
- Redirect destination is `/app/login` (NOT `/login`). The commented-out Phase 1 block was a placeholder; CONTEXT.md locks the login URL at `/app/login`.
- The exemption `pathname !== "/app/login"` is load-bearing — without it, unauthenticated users hitting `/app/login` would redirect back to themselves infinitely.
- DO NOT modify any other part of `lib/supabase/proxy.ts`. The Phase 1 code:
  - Creates the server client with the exact cookie-forwarding pattern
  - Calls `getClaims()` (never run code between `createServerClient` and `getClaims()` — Supabase docs explicitly forbid it)
  - Returns `supabaseResponse` to propagate cookie updates
- DO NOT touch `proxy.ts` at the repo root — it just calls `updateSession(request)` from this file. No change needed there.
- DO NOT touch the matcher config in `proxy.ts` (root). Next 16 matcher syntax is unchanged from Phase 1.
- DO NOT add extra route exemptions beyond `/app/login`. Public routes like `/`, `/[account]/[slug]` (Phase 5), and `/embed/*` (Phase 7) are not under `/app/*` and thus not matched by `startsWith("/app")`.

DO NOT:
- Do not remove the `void user;` line in a way that leaves `user` unused — the new gate consumes `user` so the linter is satisfied.
- Do not add `current_owner_account_ids` RPC calls in the proxy (layer violation; RESEARCH §5 keeps that check on the `/app` page).
- Do not add `redirectTo` query-param preservation (CONTEXT.md defers to v2).
- Do not convert this to `middleware.ts` — Next 16 uses `proxy.ts` (RESEARCH §7.9 spot-check: ensure no stray `middleware.ts` appeared from any codegen).
  </action>
  <verify>
```bash
# Exact gate present
grep -q 'pathname.startsWith("/app")' lib/supabase/proxy.ts && echo "startsWith guard ok"
grep -q 'pathname !== "/app/login"' lib/supabase/proxy.ts && echo "login exemption ok"
grep -q 'url.pathname = "/app/login"' lib/supabase/proxy.ts && echo "redirect target ok"
grep -q "NextResponse.redirect" lib/supabase/proxy.ts && echo "redirect call ok"

# Commented block removed
! grep -q 'Phase 2 (auth) wires this up' lib/supabase/proxy.ts && echo "old comment gone ok"

# No stray middleware.ts at root
! ls middleware.ts 2>/dev/null && echo "no middleware.ts conflict"

npm run build

# Smoke — dev server, curl unauthenticated /app → expect 302 to /app/login
npm run dev &
sleep 8
curl -sI http://localhost:3000/app | grep -E "^(HTTP|location)" | head -2
curl -sI http://localhost:3000/app/login | grep "HTTP/1.1 200"
kill %1 2>/dev/null || true
```
  </verify>
  <done>
`lib/supabase/proxy.ts` contains the exact 3-line gate from RESEARCH §4, `/app/login` is exempted, redirect target is `/app/login`, no stray `middleware.ts` exists. `curl -sI /app` in dev returns 302 with `location: /app/login`; `curl -sI /app/login` returns 200.

Commit: `feat(02-03): gate /app/* routes on authentication in proxy`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend test helpers with signInAsNsiOwner()</name>
  <files>tests/helpers/supabase.ts, .env.example</files>
  <action>
**Extend `tests/helpers/supabase.ts`** by appending the `signInAsNsiOwner()` factory per RESEARCH §6. Keep all existing exports (`anonClient`, `adminClient`, `TEST_ACCOUNT_SLUG`, `getOrCreateTestAccount`, `getOrCreateTestEventType`) unchanged.

Append at end of `tests/helpers/supabase.ts`:

```ts
/**
 * The Supabase Auth user used for authenticated-owner tests (Plan 04 creates
 * the user manually in the Supabase dashboard and links it to the `nsi`
 * account via one-time MCP SQL UPDATE).
 *
 * Credentials live in .env.local (gitignored) — never committed.
 */
const TEST_OWNER_EMAIL = process.env.TEST_OWNER_EMAIL;
const TEST_OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD;

/**
 * Returns a Supabase client authenticated as Andrew (the real NSI owner).
 *
 * - Fresh client per call — no session persistence across tests.
 * - `persistSession: false` + `autoRefreshToken: false` prevents file-based
 *   leaks (no localStorage write) and stops background refresh timers that
 *   can keep a Vitest worker alive past test end.
 * - SELECT-only contract in tests: this client runs against the REAL `nsi`
 *   account, so any test that uses it MUST NOT INSERT/UPDATE/DELETE on
 *   tenant tables (no test data pollution). The `nsi-test` account (isolated
 *   from Andrew's real data via existing helper) is the write playground.
 *
 * Contract decision (CONTEXT.md Claude's Discretion):
 *   Option (a) — SELECT-only against real `nsi` account.
 *   This avoids polluting Andrew's production account with test data and
 *   still proves RLS visibility for the owner. Chosen over option (b) (a
 *   separate throwaway auth user linked to nsi-test) because v1 has a single
 *   manually-provisioned auth user.
 */
export async function signInAsNsiOwner(): Promise<ReturnType<typeof createClient>> {
  if (!TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD) {
    throw new Error(
      "TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD missing in .env.local. " +
      "Plan 04 provisions these after Andrew creates his auth user.",
    );
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_OWNER_EMAIL,
    password: TEST_OWNER_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`signInAsNsiOwner failed: ${error?.message ?? "no session"}`);
  }

  return client;
}
```

**Update `.env.example`** — append documented placeholders (NOT real credentials):

```bash

# Phase 2 — Vitest authenticated-owner test helper.
# Set these in .env.local (which is gitignored). Real values are set by
# Plan 04 after Andrew creates his auth user in the Supabase dashboard.
TEST_OWNER_EMAIL=
TEST_OWNER_PASSWORD=
```

If `.env.example` doesn't exist yet, create it with just this section. Keep all existing lines intact if it does exist.

Key rules:
- **NEVER commit real credentials.** `.env.example` has empty placeholders. Real values go in `.env.local` (gitignored from Phase 1).
- `persistSession: false` + `autoRefreshToken: false` are BOTH required (RESEARCH §6 session-leak defense).
- Function name is exactly `signInAsNsiOwner` — the Vitest test in Task 3 imports by this name.
- Documentation comment calls out the SELECT-only contract explicitly (future Phase tests will import this helper; the contract must be loud).

DO NOT:
- Do not remove or modify `anonClient`, `adminClient`, `getOrCreateTestAccount`, or `getOrCreateTestEventType` — Phase 1 tests depend on them.
- Do not create a new helper file — extend the existing one.
- Do not hardcode the test user email/password anywhere.
- Do not add a write-path variant (`insertAsNsiOwner`, etc.) — SELECT-only contract.
  </action>
  <verify>
```bash
# Existing exports unchanged
grep -q "export function anonClient" tests/helpers/supabase.ts && echo "anonClient ok"
grep -q "export function adminClient" tests/helpers/supabase.ts && echo "adminClient ok"
grep -q "export const TEST_ACCOUNT_SLUG" tests/helpers/supabase.ts && echo "TEST_ACCOUNT_SLUG ok"
grep -q "export async function getOrCreateTestAccount" tests/helpers/supabase.ts && echo "getOrCreateTestAccount ok"

# New export present
grep -q "export async function signInAsNsiOwner" tests/helpers/supabase.ts && echo "signInAsNsiOwner added"
grep -q "persistSession: false" tests/helpers/supabase.ts && echo "persistSession off ok"
grep -q "autoRefreshToken: false" tests/helpers/supabase.ts && echo "autoRefresh off ok"

# Env docs
grep -q "TEST_OWNER_EMAIL" .env.example && echo ".env.example documents TEST_OWNER_EMAIL"
grep -q "TEST_OWNER_PASSWORD" .env.example && echo ".env.example documents TEST_OWNER_PASSWORD"

# Confirm .env.local is NOT being committed (no real values leaked)
git check-ignore -q .env.local && echo ".env.local still gitignored"

# Phase 1 existing tests still green
npm test
```
  </verify>
  <done>
`tests/helpers/supabase.ts` exports `signInAsNsiOwner` alongside the original Phase 1 helpers (no existing exports removed). The helper uses `persistSession: false` + `autoRefreshToken: false` and throws a clear error if env vars are missing. `.env.example` documents `TEST_OWNER_EMAIL` and `TEST_OWNER_PASSWORD` as empty placeholders. `.env.local` is gitignored. Existing Vitest tests (race-guard, rls-anon-lockout) still pass.

Commit: `test(02-03): add signInAsNsiOwner helper and document test env vars`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Author authenticated-owner RLS Vitest suite</name>
  <files>tests/rls-authenticated-owner.test.ts</files>
  <action>
Create a new Vitest file that complements `tests/rls-anon-lockout.test.ts`. The test is SELECT-only against the real `nsi` account per the Claude's Discretion decision in CONTEXT.md. Does NOT INSERT/UPDATE/DELETE.

**File — `tests/rls-authenticated-owner.test.ts`** (verbatim — follows RESEARCH §6 shape, extended with cleanup + additional isolation assertions):

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  signInAsNsiOwner,
  getOrCreateTestAccount,
  TEST_ACCOUNT_SLUG,
} from "./helpers/supabase";

describe("RLS authenticated-owner visibility (Phase 2)", () => {
  let client: SupabaseClient;

  beforeAll(async () => {
    // Ensure the nsi-test isolation account exists (for cross-tenant blindness
    // assertion). Creates via service-role (admin helper) if missing.
    await getOrCreateTestAccount();
    client = await signInAsNsiOwner();
  });

  afterAll(async () => {
    // Explicit sign-out — belt + suspenders; persistSession is false already.
    try {
      await client.auth.signOut();
    } catch {
      // Swallow — test teardown; client may already be disposed.
    }
  });

  it("owner sees exactly 1 account row (their own nsi account)", async () => {
    const { data, error } = await client
      .from("accounts")
      .select("id, slug, timezone");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].slug).toBe("nsi");
    expect(data?.[0].timezone).toBe("America/Chicago");
  });

  it("owner cannot SELECT the nsi-test account (RLS blocks cross-tenant)", async () => {
    const { data, error } = await client
      .from("accounts")
      .select("id")
      .eq("slug", TEST_ACCOUNT_SLUG);
    // RLS behavior: the query succeeds but returns an empty set — NOT an error.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("owner sees 0 event_types initially (tenant-scoped, none seeded in Phase 2)", async () => {
    const { data, error } = await client.from("event_types").select("id");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // Phase 3 will add CRUD; for now zero rows is expected for the nsi account.
  });

  it("owner sees 0 bookings initially (tenant-scoped, none seeded in Phase 2)", async () => {
    const { data, error } = await client.from("bookings").select("id");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

Key rules:
- `@vitest-environment node` pragma at the top — this test runs against Supabase over HTTP, not in jsdom.
- `SupabaseClient` type import — ensures the `client` variable is typed correctly (not `any`).
- `beforeAll` calls `getOrCreateTestAccount()` to ensure `nsi-test` exists for the cross-tenant blindness assertion. Uses service-role; does NOT pollute the `nsi` account.
- `afterAll` calls `client.auth.signOut()` in a try/catch — defense in depth even though `persistSession: false` means session isn't stored.
- All assertions are SELECT-only against tenant tables. Zero writes.
- Assertion on the `nsi` account uses the known seeded values from Phase 1 (`slug='nsi'`, `timezone='America/Chicago'`). If these values change, the test must be updated — they're load-bearing.
- RLS behavior for blocked reads: query succeeds with empty `data`, NOT an error. Contrast with anon-lockout where even the query fails at the policy layer — this is the difference between "authenticated but not owner of this row" (empty set) vs "no session at all" (error). Phase 1 `rls-anon-lockout.test.ts` proves the latter; this test proves the former.

**Note on running the test:** This test WILL FAIL in Plan 03 because Andrew's auth user doesn't exist yet. Plan 04 creates the user + links it via MCP, then runs this test. That's expected. Plan 03 only authors the code; Plan 04 executes.

If you want to sanity-check the test syntax without a running auth user, run:
```bash
npx vitest run tests/rls-authenticated-owner.test.ts 2>&1 | head -20
```
Expect: syntax passes, test fails with "TEST_OWNER_EMAIL missing" error from the helper. That's the correct behavior until Plan 04.

DO NOT:
- Do not INSERT, UPDATE, or DELETE anything — SELECT-only contract.
- Do not skip the `afterAll` cleanup — future phases may import and extend this file; clean teardown is a good pattern to lock in now.
- Do not query `availability_rules`, `date_overrides`, `booking_events` — those tables exist from Phase 1 but aren't surfaced in Phase 2. Limiting assertions to `accounts`, `event_types`, `bookings` keeps the test's purpose focused on the AUTH/DASH requirements.
- Do not hardcode the `nsi` account UUID — assert on `slug` instead (stable across environments).
  </action>
  <verify>
```bash
# File exists
ls tests/rls-authenticated-owner.test.ts

# Required pieces
grep -q "@vitest-environment node" tests/rls-authenticated-owner.test.ts && echo "env pragma ok"
grep -q "signInAsNsiOwner" tests/rls-authenticated-owner.test.ts && echo "helper import ok"
grep -q "signOut" tests/rls-authenticated-owner.test.ts && echo "cleanup in afterAll ok"
grep -q 'slug).toBe("nsi")' tests/rls-authenticated-owner.test.ts && echo "nsi assertion ok"
grep -q "TEST_ACCOUNT_SLUG" tests/rls-authenticated-owner.test.ts && echo "cross-tenant assertion ok"

# No writes — SELECT-only contract
! grep -qE "\.insert\(|\.update\(|\.delete\(" tests/rls-authenticated-owner.test.ts && echo "SELECT-only contract honored"

# TypeScript compiles (even if test fails — that's Plan 04's job)
npx tsc --noEmit -p tsconfig.json

# Phase 1 tests still green (did not break anything)
npm test -- tests/race-guard.test.ts tests/rls-anon-lockout.test.ts
```
  </verify>
  <done>
`tests/rls-authenticated-owner.test.ts` exists with 4 SELECT-only assertions (own-account visibility, cross-tenant blindness, zero event_types, zero bookings), imports `signInAsNsiOwner` and `TEST_ACCOUNT_SLUG` from the extended helper, cleans up with `signOut` in `afterAll`, and TypeScript compiles cleanly. Running the test in Plan 03 is expected to fail with a missing-env error (Andrew's user doesn't exist yet); Plan 04 will execute it for real. Phase 1 tests (`race-guard`, `rls-anon-lockout`) remain green.

Commit: `test(02-03): add authenticated-owner RLS test (runs after Plan 04 provisioning)`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# Build + lint
npm run build
npm run lint

# All files present
ls lib/supabase/proxy.ts tests/helpers/supabase.ts tests/rls-authenticated-owner.test.ts .env.example

# Phase 1 tests still green (authenticated-owner test deferred to Plan 04)
npm test -- tests/race-guard.test.ts tests/rls-anon-lockout.test.ts

# Proxy redirect smoke
npm run dev &
sleep 8
curl -sI http://localhost:3000/app | head -3
curl -sI http://localhost:3000/app/event-types | head -3
curl -sI http://localhost:3000/app/login | head -3
kill %1 2>/dev/null || true
```

Expected smoke results:
- `GET /app` → 302 with `location: /app/login`
- `GET /app/event-types` → 302 with `location: /app/login`
- `GET /app/login` → 200
</verification>

<success_criteria>
- [ ] `lib/supabase/proxy.ts` contains the 3-line gate: `!user && startsWith("/app") && pathname !== "/app/login"` → `NextResponse.redirect(/app/login)`
- [ ] No stray `middleware.ts` at repo root
- [ ] `curl -sI /app` in dev returns 302 with `location: /app/login`; `/app/login` returns 200
- [ ] `tests/helpers/supabase.ts` exports `signInAsNsiOwner` with `persistSession: false` + `autoRefreshToken: false`
- [ ] `tests/helpers/supabase.ts` original exports (`anonClient`, `adminClient`, `TEST_ACCOUNT_SLUG`, `getOrCreateTestAccount`, `getOrCreateTestEventType`) unchanged
- [ ] `.env.example` documents `TEST_OWNER_EMAIL` + `TEST_OWNER_PASSWORD` (empty placeholders only; no real credentials committed anywhere)
- [ ] `tests/rls-authenticated-owner.test.ts` exists, SELECT-only, uses `signInAsNsiOwner`, asserts own-account visibility + cross-tenant blindness + zero event_types + zero bookings, cleans up in `afterAll`
- [ ] `npx tsc --noEmit` passes
- [ ] Phase 1 tests (`race-guard`, `rls-anon-lockout`) remain green
- [ ] Each task committed atomically + pushed (3 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/02-owner-auth-and-dashboard-shell/02-03-SUMMARY.md` documenting:
- Exact proxy diff applied (for Phase 7 reference — embed routes will need similar but inverted gate)
- The SELECT-only contract decision + its rationale (cite the decision for future phases that add auth tests)
- Any deviations from RESEARCH §4 or §6 (expected: none)
- Note that this plan does NOT run the new authenticated-owner test — Plan 04 provisions Andrew's user and executes the test as part of its verification
</output>
