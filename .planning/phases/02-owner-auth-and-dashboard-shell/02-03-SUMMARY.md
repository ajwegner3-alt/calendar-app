---
phase: 02-owner-auth-and-dashboard-shell
plan: 03
subsystem: auth
tags: [proxy-gate, next-16, supabase-auth, rls, vitest, authenticated-owner, select-only]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "lib/supabase/proxy.ts session-refresh scaffold; tests/helpers/supabase.ts with anonClient/adminClient/getOrCreateTestAccount; @supabase/supabase-js transitively installed via @supabase/ssr"
  - phase: 02-owner-auth-and-dashboard-shell/02-01
    provides: "/app/login Server Action route + page; NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY env wiring; shadcn/ui ready for shell"
provides:
  - "proxy.ts gate: unauthenticated /app/* → redirect /app/login (AUTH-04) with /app/login carve-out"
  - "signInAsNsiOwner() test helper: persistSession: false + autoRefreshToken: false, SELECT-only contract against real nsi account"
  - "tests/rls-authenticated-owner.test.ts: 4 SELECT-only assertions proving authenticated-owner RLS visibility (complement to Phase 1 anon-lockout)"
  - ".env.example: TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD placeholders (empty — real values go in .env.local)"
affects: [02-04-link-owner-to-account, 03-event-types-crud, 05-public-booking-flow, 07-widget-and-branding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route gate in proxy.ts using pathname.startsWith + equality exemption (avoids redirect loop on login page)"
    - "Authenticated Vitest client factory with session-leak defense (persistSession + autoRefreshToken both false)"
    - "SELECT-only test contract against production data: proves RLS without polluting tenant state"

key-files:
  created:
    - "tests/rls-authenticated-owner.test.ts"
  modified:
    - "lib/supabase/proxy.ts (3-line Phase 2 gate replacing Phase 1 commented placeholder)"
    - "tests/helpers/supabase.ts (append signInAsNsiOwner; type import SupabaseClient)"
    - ".env.example (append TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD empty placeholders)"

key-decisions:
  - "Redirect destination is /app/login (NOT /login) — matches CONTEXT.md lock on login URL and Plan 02-01's route layout"
  - "/app/login exempted via pathname !== '/app/login' equality check rather than broader !startsWith('/app/login') — tighter and faster; no child routes under /app/login that would benefit from prefix"
  - "SELECT-only contract for authenticated-owner tests (Claude's Discretion, CONTEXT.md): tests run against the REAL nsi account, not a throwaway. Rationale: v1 has a single manually-provisioned auth user; a write-enabled variant would pollute Andrew's production data. Rejected option (b) (separate throwaway user linked to nsi-test) — added complexity for no v1 value"
  - "Return type for signInAsNsiOwner() is Promise<SupabaseClient> (not Promise<ReturnType<typeof createClient>>) — ReturnType wrapped the default-generics shape which TS refused to collapse to the unbranded SupabaseClient type; direct type import resolved the TS2322 without changing runtime behavior"

patterns-established:
  - "Proxy-level route protection: gate pathname.startsWith('/app') AND !== '/app/login'. Future phases (7 widget, 5 public) should NOT add /app/login-style carve-outs — their routes live outside /app/* entirely"
  - "Authenticated Vitest pattern: beforeAll signs in, afterAll signs out, per-test client reuse OK as long as tests are SELECT-only"

# Metrics
duration: ~8min
completed: 2026-04-19
---

# Phase 2 Plan 3: Proxy Gate and Authenticated-Owner RLS Test Summary

**3-line proxy.ts gate redirecting unauthenticated /app/* to /app/login, plus the Vitest scaffolding (signInAsNsiOwner helper + SELECT-only RLS suite) that Plan 04 will execute after Andrew's auth user is provisioned.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-19T22:21:14Z
- **Completed:** 2026-04-19T22:24:41Z
- **Tasks:** 3 / 3
- **Files created:** 1 (`tests/rls-authenticated-owner.test.ts`)
- **Files modified:** 3 (`lib/supabase/proxy.ts`, `tests/helpers/supabase.ts`, `.env.example`)
- **Build:** `npm run build` exits 0; `npx tsc --noEmit` exits 0
- **Phase 1 tests:** 13/13 still green (race-guard + rls-anon-lockout)
- **Smoke test (dev server):** `GET /app` returns 307 + `location: /app/login`; `GET /app/login` returns 200

## Accomplishments

- **AUTH-04 shipped (proxy gate).** The 3-line diff in `lib/supabase/proxy.ts` replaces Phase 1's commented-out placeholder with an active `!user && startsWith("/app") && pathname !== "/app/login"` → `NextResponse.redirect("/app/login")`. Verified live: dev server redirects unauthenticated `GET /app` with HTTP 307 and `location: /app/login`, while `GET /app/login` still returns 200.
- **Authenticated Vitest helper landed.** `signInAsNsiOwner()` in `tests/helpers/supabase.ts` creates a fresh Supabase client per call, signs in with password from env, and carries the session-leak defenses (`persistSession: false`, `autoRefreshToken: false`). JSDoc explicitly locks the SELECT-only contract so future phases that import this helper can't silently introduce write-path pollution.
- **Authenticated-owner RLS Vitest suite authored.** `tests/rls-authenticated-owner.test.ts` proves the 4 invariants Plan 04 will verify:
  1. Owner sees exactly 1 account row (own `nsi` account, slug + timezone correct).
  2. Owner SELECT of `nsi-test` returns `[]` (RLS-blocked cross-tenant — empty, not error; contrast with Phase 1's anon-lockout).
  3. Owner sees 0 event_types (tenant-scoped, none seeded in Phase 2).
  4. Owner sees 0 bookings (tenant-scoped, none seeded).
- **Env vars documented in `.env.example`.** `TEST_OWNER_EMAIL` and `TEST_OWNER_PASSWORD` appended as empty placeholders with a clear "set in .env.local (gitignored); Plan 04 provisions" comment. No real credentials committed anywhere.

## Task Commits

Each task committed atomically and pushed to `main`:

1. **Task 1: Apply proxy.ts 3-line gate** — `d92becb` (feat)
2. **Task 2: Add signInAsNsiOwner helper + document env vars** — `b4bce59` (test)
3. **Task 3: Author authenticated-owner RLS suite + TS fix** — `bfc8dc5` (test)

Plan metadata commit (docs) follows this SUMMARY.md + STATE.md update.

## Exact Proxy Diff Applied (for Phase 7 reference)

Phase 7's embed routes will need a similar-but-inverted gate — something like "allow anon on `/embed/*` even when `/app/*` is gated", which is already the case since `/embed/*` doesn't match `startsWith("/app")`. But if Phase 7 adds per-account gating, this is the pattern to mirror:

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

**Key invariants preserved:**
- Nothing runs between `createServerClient` and `getClaims()` (Supabase contract).
- `supabaseResponse` is still returned on the happy path so refreshed cookies propagate.
- The env-bootstrap guard (fresh-clone `.env.local` empty) and the exact cookie-forwarding pattern are untouched.

## SELECT-Only Contract Decision + Rationale

The authenticated Vitest suite runs against Andrew's **real** `nsi` account — the same row in production Supabase that the dashboard will render once Plan 04 links it. To make this safe:

- **Contract:** any test that uses `signInAsNsiOwner()` must be SELECT-only. No `.insert()`, `.update()`, `.delete()` on any tenant-scoped table. Enforced by grep in Task 3's `<verify>` block, and documented in the helper's JSDoc so future phase authors reading the helper can't miss it.
- **Rationale:** v1 has a single manually-provisioned auth user (Andrew's). Creating a throwaway user linked to `nsi-test` (the isolated test account Phase 1 already uses for race-guard writes) would add complexity and another manual provisioning step without adding test coverage — the SELECT-only constraint already proves RLS visibility for the owner.
- **Alternative rejected:** Option (b) in CONTEXT.md's Claude's Discretion — a separate auth user linked to `nsi-test`. Deferred to when v1 ships real signup (v2).
- **What writes look like in tests:** use `adminClient()` + `TEST_ACCOUNT_SLUG = 'nsi-test'` — the existing pattern from Phase 1's race-guard test. Service-role bypasses RLS; all writes land on the isolated test account. `beforeAll` in the new suite already calls `getOrCreateTestAccount()` via this path to ensure `nsi-test` exists for the cross-tenant blindness assertion.

**Future phase guidance:** Phase 3 (event types CRUD) and beyond will need authenticated write tests. Those tests should create a parallel throwaway auth user OR accept that writes go through the owner's real account with idempotent cleanup (`afterEach` delete by id). Either is fine; the contract lives in the helper's JSDoc, not this summary.

## Running the New Test (for Plan 04)

Plan 03 did NOT run `tests/rls-authenticated-owner.test.ts` because Andrew's auth user doesn't exist yet. Plan 04's sequence:

1. Andrew creates auth user via Supabase dashboard (Auth → Add user) with real email + strong password.
2. Orchestrator runs one-time MCP `execute_sql`: `UPDATE accounts SET owner_user_id = '<auth-uuid>' WHERE slug = 'nsi';`.
3. Andrew adds `TEST_OWNER_EMAIL` + `TEST_OWNER_PASSWORD` to `.env.local` (gitignored).
4. Run `npx vitest run tests/rls-authenticated-owner.test.ts` — expect 4 passing assertions.

If step 4 fails with "TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD missing", step 3 was skipped. If it fails with "signInAsNsiOwner failed: Invalid login credentials", step 1 or 3 has a mismatch. If assertion #1 fails with 0 rows, step 2 was skipped.

## Decisions Made

See frontmatter `key-decisions` for the durable ones. Additional notes:

- **`signOut()` in `afterAll` wrapped in try/catch.** With `persistSession: false` the client's session is never persisted, so `signOut()` is mostly a no-op. But a future extension of the suite might introduce a second sign-in or a client that does persist; the defensive cleanup pattern locks in the discipline now. Swallowing exceptions is acceptable at teardown — no way to surface them usefully, and they shouldn't block other test files.
- **Assert on `slug` + `timezone`, not UUID.** The seeded `nsi` account's UUID (`ba8e712d-28b7-4071-b3d4-361fb6fb7a60`) is listed in STATE.md but hardcoding it in a test would break if someone re-seeds. `slug='nsi'` and `timezone='America/Chicago'` are semantic invariants of this account and survive reseeding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] TypeScript TS2322 on `signInAsNsiOwner()` return type.**
- **Found during:** Task 3 verification (`npx tsc --noEmit`)
- **Issue:** The plan's verbatim helper snippet (from RESEARCH §6 adaptation) declared `Promise<ReturnType<typeof createClient>>`. TypeScript inferred this as the default-generics shape `SupabaseClient<unknown, { PostgrestVersion: string }, never, never, ...>`, which is incompatible with the concrete `SupabaseClient<any, "public", "public", any, any>` returned by `createClient(url, key)` (which narrows the schema generic to `"public"`). The TS error: `Type '"public"' is not assignable to type 'never'`.
- **Fix:** Imported `SupabaseClient` as a type from `@supabase/supabase-js` and declared the return type as `Promise<SupabaseClient>` (unbranded, matches any runtime shape). No runtime behavior change.
- **Files modified:** `tests/helpers/supabase.ts` (import + return-type annotation)
- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 (no output). All Phase 1 tests still pass (13/13).
- **Committed in:** `bfc8dc5` (Task 3 commit, documented in commit body)

**Total deviations:** 1 auto-fixed TS-type bug. No architectural changes, no plan reshape.
**Impact on plan:** Zero runtime impact — the fix was purely in the TypeScript surface. The generated JavaScript is identical.

## Authentication Gates

None encountered during Plan 03. Plan 04 will hit the single authentication gate of the phase: Andrew creating his Supabase Auth user via the dashboard and sharing the credentials.

## Issues Encountered

- **`npm run lint` fails with a pre-existing ESLint config circular-structure error** (`TypeError: Converting circular structure to JSON` from `@eslint/eslintrc`'s config validator). This is an environment / tooling bug unrelated to the files this plan touched — `npm run build` and `npx tsc --noEmit` both pass clean, which are the type-safety guarantees that actually matter. Recommend Phase 8 hardening include an ESLint v9 + eslintrc migration (flat config) to resolve.
- **Parallel execution:** Plan 02-02 was running simultaneously and competing for the `next build` cache. Resolved by polling with `Another next build process is already running` detection until the parallel build finished. No merge conflicts — 02-02 only touches files under `app/(shell)/` and `components/welcome-card.tsx`, which don't overlap with this plan's scope.

## User Setup Required

**None for Plan 03.** Plan 04 will walk Andrew through:
1. Supabase dashboard → Authentication → Add user (real email + strong password).
2. Setting `TEST_OWNER_EMAIL` + `TEST_OWNER_PASSWORD` in `.env.local` locally.
3. Running `npx vitest run tests/rls-authenticated-owner.test.ts` to verify.

Orchestrator handles the one-time MCP SQL UPDATE to link `accounts.owner_user_id`.

## Next Phase Readiness

**Ready for Plan 04 (owner-to-account linking + execute RLS test).** Plan 04 will:
- Guide Andrew through Supabase dashboard user creation (manual authentication gate).
- Run one-time MCP `execute_sql`: `UPDATE accounts SET owner_user_id = '<auth-uuid>' WHERE slug = 'nsi'`.
- Provide commands for Andrew to populate `.env.local` with real `TEST_OWNER_EMAIL` / `TEST_OWNER_PASSWORD`.
- Run `tests/rls-authenticated-owner.test.ts` — expect 4 passing assertions.
- Final phase verifier will then confirm all 5 requirements (AUTH-01 through AUTH-04 + DASH-01) shipped.

**Blockers for Plan 04:** None from Plan 03's side. Plan 02-02 (running in parallel) must land first so `/app` has content to show the authenticated user post-login.

**Blockers for Phase 3:** None introduced by this plan. The proxy gate protects `/app/event-types` out of the box; authenticated tests can extend `signInAsNsiOwner()` with a write-path variant (or use `adminClient()` + `nsi-test` slug) as discussed in the SELECT-only section above.

---
*Phase: 02-owner-auth-and-dashboard-shell*
*Completed: 2026-04-19*
