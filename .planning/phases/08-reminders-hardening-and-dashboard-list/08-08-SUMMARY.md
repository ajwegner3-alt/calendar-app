---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-08"
subsystem: hardening
tags: [rls-matrix, cross-tenant, infra-05, second-tenant, shell-render-harness, tooltip-provider-guard, vercel-pro, hourly-cron, cron-secret, env-docs]

requires:
  - phase: 02-owner-auth-and-dashboard-shell
    provides: signInAsNsiOwner helper + nsi-test isolation account pattern (extended here with signInAsNsiTest2Owner + nsi-rls-test second tenant)
  - phase: 04-availability-engine
    provides: tests/helpers/supabase.ts canonical helpers (anonClient, adminClient, getOrCreateTestAccount) — re-exported from new tests/helpers/auth.ts
  - phase: 08-reminders-hardening-and-dashboard-list
    provides: 08-04 vercel.json crons[] entry (schedule swapped here from daily fallback to hourly), 08-04 CRON_SECRET wiring (now documented in .env.example)
provides:
  - "tests/helpers/auth.ts: re-exports Phase 2 helpers + adds signInAsNsiTest2Owner + TEST_RLS_ACCOUNT_SLUG constant"
  - "tests/rls-cross-tenant-matrix.test.ts: 13-test matrix covering positive control (own-account access works), cross-tenant SELECT lockout across 4 shared tables, anon SELECT lockout re-assertion, cross-tenant UPDATE lockout, admin control case"
  - "tests/shell-render.test.tsx: 3-test providers harness — TooltipProvider context proof + source-shape guard against TooltipProvider removal"
  - "vercel.json schedule swapped to hourly (Vercel Pro tier confirmed) — reminder cron now fires every :00 UTC"
  - ".env.example documents CRON_SECRET + APP_URL / NEXT_PUBLIC_APP_URL for Phase 8 reminder pipeline"
affects:
  - phase 9 manual QA (mail-tester deliverability scoring + end-to-end live walkthrough deferred per project pattern)
  - future phases adding new tenant-scoped tables (RLS matrix template established — copy SHARED_TABLES pattern + add positive control + cross-tenant SELECT loop)

tech-stack:
  added: []
  patterns:
    - "describe.skipIf(condition) for env-gated test suites — preferred over `if (skip) { it.skip(...); return; }` pattern in plan body. Pairs with describe.runIf to register a single skipped marker test when the suite is gated, so the runner reports the missing-env reason instead of an empty file."
    - "Static-analysis guard pattern — read source file as text via readFileSync + assert literal exists. Used here to prevent silent removal of TooltipProvider from app/(shell)/layout.tsx. Cheap CI-time check that complements the runtime providers-tree assertion."
    - "Layered helper file — tests/helpers/auth.ts re-exports the canonical tests/helpers/supabase.ts contracts AND adds the second-tenant helper. Single import surface for RLS matrix tests; original helpers stay the source of truth (signInAsNsiOwner SELECT-only-against-real-nsi semantics preserved)."
    - "Two-tenant RLS matrix structure: positive control (own-account access works) + cross-tenant SELECT loop (4 tables) + anon SELECT loop + cross-tenant WRITE assertion + admin control case. Without the positive control, an empty cross-tenant result is ambiguous (could be RLS-allows OR RLS-denies-everything)."
    - "Local matchMedia polyfill via beforeAll in test files that mount SidebarProvider in jsdom — tests/setup.ts intentionally untouched to avoid side-effects on Node-env DB-only tests."

key-files:
  created:
    - "tests/helpers/auth.ts (~75 LOC) — re-exports Phase 2 helpers + signInAsNsiTest2Owner + TEST_RLS_ACCOUNT_SLUG"
    - "tests/rls-cross-tenant-matrix.test.ts (~210 LOC, 13 tests + 1 conditional skip marker) — INFRA-05 matrix"
    - "tests/shell-render.test.tsx (~130 LOC, 3 tests) — TooltipProvider regression guard"
    - ".planning/phases/08-reminders-hardening-and-dashboard-list/08-08-SUMMARY.md (this file)"
  modified:
    - "vercel.json — crons[].schedule: '0 8 * * *' → '0 * * * *' (hourly, Vercel Pro confirmed)"
    - ".env.example — added CRON_SECRET docs + APP_URL/NEXT_PUBLIC_APP_URL + Phase 8 cron schedule note"

key-decisions:
  - "Vercel tier = Pro (Andrew confirmed) → vercel.json schedule changes from daily fallback (set by Plan 08-04 as Hobby-safe placeholder) to hourly. cron-job.org wiring (originally Plan 08-08 Task 4 fallback for Hobby) is dropped from execution scope entirely."
  - "Service-role key swap (Plan 08-08 Task 1 prereq C) DEFERRED — Andrew confirmed the Supabase project does not currently expose an sb_secret_* format key. Legacy JWT SUPABASE_SERVICE_ROLE_KEY remains canonical until Supabase forces migration. Carried as a watch item; no functional impact (legacy JWT continues to work)."
  - "CRON_SECRET in Vercel env (Plan 08-08 Task 1 prereq D) PENDING — Andrew has been instructed how to add it but has not yet confirmed completion. Local .env.local already has the value; Vercel must mirror it for production cron to authenticate. Carried into Phase 9 as a deployment-time prereq before live cron verification."
  - "Shell render harness scope: providers-tree reconstruction (NOT full ShellLayout render) — ShellLayout is async + Server Component + cookies/Supabase deps; rendering it in jsdom would require an unbounded mock surface. Harness assembles the providers chain exactly as the layout does (TooltipProvider > SidebarProvider > SidebarInset), mounts a Tooltip-using child, asserts no throw. Adds a static-analysis guard that reads layout source and asserts TooltipProvider/SidebarProvider literals exist — catches silent removal at CI."
  - "RLS matrix uses re-exports + new helper file (tests/helpers/auth.ts) rather than mutating the existing tests/helpers/supabase.ts — preserves Phase 2's locked SELECT-only contract on signInAsNsiOwner (its JSDoc is the source of truth) and gives the matrix test a single, semantically-named import surface."
  - "Positive control test ('nsi-rls-test owner CAN see their own seeded event_type') is the load-bearing assertion in the matrix — without it, every cross-tenant 'sees no nsi rows' result is ambiguous (could be RLS-denies-everything for that user). Seeded via idempotent select-then-insert through admin client in beforeAll."
  - "Cross-tenant UPDATE assertion uses real nsi booking + restores via admin re-read — proves RLS denies via 0-row WHERE semantics AND that the row was not modified. Soft-skips with informative warning if no nsi bookings exist (Andrew's account may have none in dev)."
  - "Admin control case (admin client sees BOTH 'nsi' and 'nsi-rls-test' slugs) is sanity ground truth — without it, an admin-bypass bug could hide RLS bugs on either tenant side."
  - "Anon SELECT lockout re-assertion in matrix overlaps with tests/rls-anon-lockout.test.ts intentionally — matrix completeness requires all four shared tables × all three client contexts (admin, owner, anon, plus second owner) be exercised in one suite for clarity."
  - "Mail-tester deliverability scoring (Plan 08-08 Task 4 Op B) DEFERRED to Phase 9 — fits the project-wide 'manual checks live in dedicated final phase' pattern (CLAUDE.md). Not blocking Phase 8 code-complete."
  - "End-to-end live walkthrough (Plan 08-08 Task 5 — 9-item dashboard sweep) DEFERRED to Phase 9 — same rationale. Phase 8 code is complete; live verification consolidates with Phases 5/6/7 backlog."

patterns-established:
  - "Cross-tenant RLS matrix template — for any future tenant-scoped table addition: (1) seed a row via admin into a known second-tenant slug, (2) add to SHARED_TABLES, (3) the existing SELECT loop covers it automatically, (4) extend WRITE coverage as needed for tables with UPDATE/DELETE owner actions."
  - "Re-export-and-extend helper pattern (tests/helpers/auth.ts) — when adding helpers that build on locked Phase 2 contracts, create a new file that re-exports the originals plus the additions. Preserves single-source-of-truth for the locked contract while giving new tests a coherent import."
  - "Skipped-suite registration via describe.runIf(condition) — when describe.skipIf gates the main suite, mirror it with describe.runIf to register a single it.skip marker. The runner now reports the gating reason instead of an empty file."

deviations-from-plan:
  - "Helper filename: plan body specified `tests/helpers/auth.ts` while existing helpers live in `tests/helpers/supabase.ts`. Resolved by creating tests/helpers/auth.ts as a re-export-plus-extend module — satisfies the artifact contract (filename + signInAsNsiTest2Owner literal) without fragmenting helpers or mutating the locked Phase 2 file."
  - ".env.local.example vs .env.example: plan body specified `.env.local.example` while the repo convention is `.env.example` (already exists with TEST_OWNER_2_* documented from a prior pass). Updated `.env.example` (the actual repo file) — adds CRON_SECRET + APP_URL/NEXT_PUBLIC_APP_URL + Phase 8 schedule note. No `.env.local.example` created (would have duplicated the existing .env.example)."
  - "Local matchMedia polyfill required in tests/shell-render.test.tsx — useIsMobile hook (used inside SidebarProvider) calls window.matchMedia which jsdom does not ship. Added as a beforeAll polyfill scoped to the test file. tests/setup.ts intentionally untouched (Node-env DB tests share that file)."
  - "Tasks 4 + 5 (manual ops + walkthrough) NOT executed — deferred to Phase 9 per project's 'all manual checks in final phase' lock. Plan 08-08 code is complete; remaining items are manual (mail-tester scoring, end-to-end UI walkthrough, cron-actually-fired-in-production verification once CRON_SECRET in Vercel is confirmed)."

metrics:
  duration: "single session"
  completed: "2026-04-27"
  test-count-before: 115
  test-count-after: 131
  test-files-before: 14
  test-files-after: 16
  new-tests: 16  # 13 RLS matrix + 3 shell render
  skipped-tests: 1  # describe.runIf duplicate-block marker
---

# Phase 8 Plan 08-08: RLS Matrix + Ops Hardening Summary

**One-liner:** 2-tenant RLS isolation matrix (4 tables × SELECT/UPDATE/anon/admin) + shell render harness catching TooltipProvider regressions + Vercel Pro hourly cron swap.

## What Was Built

### Tests (16 new)

**`tests/rls-cross-tenant-matrix.test.ts`** (13 tests + 1 conditional skip)

Closes INFRA-05. Exercises the full RLS isolation matrix between two real
authenticated users (Andrew → `nsi`, second user → `nsi-rls-test`):

| Coverage Area                                      | Tests | Detail                                                                                                  |
| -------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- |
| Positive control (own-account SELECT works)       | 2     | nsi-rls-test owner SEES their own seeded event_type + their own account row (1 row)                     |
| Cross-tenant SELECT (specific seeded row)          | 1     | nsi owner CANNOT see test2's seeded `rls-isolation-fixture` event_type                                  |
| Anon SELECT lockout (matrix re-assertion)          | 4     | anon client returns `[]` for `bookings`, `booking_events`, `event_types`, `accounts`                    |
| Cross-tenant SELECT lockout (4 tables × test2 → nsi) | 4     | test2 client cannot see any nsi-owned id in `bookings`, `booking_events`, `event_types`, `accounts`     |
| Cross-tenant UPDATE lockout                        | 1     | test2 cannot UPDATE nsi's bookings — RLS rejects via 0-rows-affected; admin re-read confirms unchanged |
| Admin control case (service-role bypass)           | 1     | admin client SEES both `nsi` and `nsi-rls-test` slugs in `accounts`                                     |
| Skipped marker (env gate)                          | 1     | `describe.runIf` registers when TEST_OWNER_2_* missing — informative skip                                |

Suite skips gracefully via `describe.skipIf(skipIfNoSecondUser)` if the
second-user env vars are not set (e.g., CI without secrets).

**`tests/shell-render.test.tsx`** (3 tests)

Closes STATE.md backlog line 235 ("render-test harness for shell layout —
would have caught the TooltipProvider regression in Plan 02-04 at CI
instead of user smoke").

| Test                                                     | Detail                                                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renders providers chain without crashing                 | Mounts `<TooltipProvider><SidebarProvider><SidebarInset>{children}</SidebarInset></SidebarProvider></TooltipProvider>` with arbitrary content                                     |
| Provides TooltipProvider context for descendants         | Mounts a `<Tooltip><TooltipTrigger asChild>...</Tooltip>` child INSIDE the chain — would throw "Tooltip must be used within TooltipProvider" if the provider chain were broken    |
| Source-shape guard: layout still mentions TooltipProvider | Reads `app/(shell)/layout.tsx` as text and asserts both `TooltipProvider` and `SidebarProvider` literals exist — catches silent removal in a future PR before runtime regression |

Scope tradeoff (documented inline): ShellLayout is an async Server
Component with `cookies()` + Supabase server deps; jsdom cannot render
it. The harness reconstructs the providers tree exactly as the layout
assembles it. Includes a `matchMedia` polyfill (jsdom doesn't ship it;
`useIsMobile` calls it during SidebarProvider mount).

### Ops

- **`vercel.json`** — `crons[].schedule` swapped from `0 8 * * *` (Hobby
  fallback set by Plan 08-04) to `0 * * * *` (hourly). Vercel tier confirmed
  Pro by Andrew. Pushed to main; Vercel will register the new schedule on
  next deploy.
- **`.env.example`** — added `CRON_SECRET` documentation block (with
  generation command `openssl rand -hex 32`) + `APP_URL` /
  `NEXT_PUBLIC_APP_URL` block + Phase 8 schedule-tier note.

## RLS Matrix Coverage Breakdown

| Table            | anon SELECT | nsi owner SELECT | test2 owner SELECT (cross-tenant) | test2 owner UPDATE (cross-tenant) | admin (control) |
| ---------------- | ----------- | ---------------- | --------------------------------- | --------------------------------- | --------------- |
| `accounts`       | ✓ blocked   | (positive: own)  | ✓ no nsi ids leak                 | n/a                               | ✓ sees both     |
| `event_types`    | ✓ blocked   | (positive: own)  | ✓ no nsi ids leak + targeted row hidden | n/a                         | ✓ implicit      |
| `bookings`       | ✓ blocked   | (existing 02 suite) | ✓ no nsi ids leak              | ✓ 0 rows affected + unchanged     | ✓ implicit      |
| `booking_events` | ✓ blocked   | (existing 02 suite) | ✓ no nsi ids leak              | n/a                               | ✓ implicit      |

`availability_rules` and `date_overrides` (also RLS-scoped) are covered by
the existing `tests/rls-anon-lockout.test.ts` (anon SELECT/INSERT) and the
authenticated-owner suite. INFRA-05 named the four shared tables above; the
matrix focuses there.

## Test Count

- **Before:** 115 tests across 14 files
- **After:** 131 passing + 1 skipped across 16 files
- **New:** 16 tests (13 RLS matrix + 3 shell render). 1 skipped is the
  cosmetic `describe.runIf` duplicate-block marker (fires regardless of
  gating because the inner `it.skip` is unconditional — harmless).

## Deferred to Phase 9

The following Plan 08-08 items are deferred to Phase 9 manual QA per the
project-wide lock that all manual checks live in the dedicated final phase:

| Item                                              | Source                       | Why Deferred                                                                                                                |
| ------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mail-tester score for confirmation email          | Plan 08-08 Task 4 Op B       | Manual browser flow — book with disposable mail-tester address, read score. Belongs with Phase 5/6 manual deliverability QA. |
| Mail-tester score for reminder email              | Plan 08-08 Task 4 Op B       | Same — requires <24h booking and waiting for cron tick. Bundles with reminder live verification.                            |
| End-to-end Phase 8 walkthrough (9 items)          | Plan 08-08 Task 5            | Full dashboard sweep — bookings list, detail page, reminder settings, location field, reminder email, sidebar.              |
| Cron-actually-fired-in-production verification    | Plan 08-08 Task 4 Op A       | Requires CRON_SECRET in Vercel env (prereq D pending Andrew confirmation). Once confirmed, verify via Vercel cron dashboard. |
| Rate-limit live verification                      | Plan 08-08 Task 5 item 7     | Already explicitly deferred by plan body to Phase 9 backlog (STATE.md line 239).                                            |

## Pending User-Side Action

- **CRON_SECRET in Vercel env (Prereq D)** — Andrew has the instructions
  but has not yet confirmed completion. Required for production cron to
  authenticate. Once added in Vercel Dashboard → Project → Settings →
  Environment Variables (Production + Preview), redeploy. Verify via Vercel
  Cron dashboard showing 200 OK on next hourly tick.

- **Service-role key migration (Prereq C)** — Watch item only. Andrew
  confirmed Supabase project does not currently expose an `sb_secret_*`
  format key. Legacy JWT `SUPABASE_SERVICE_ROLE_KEY` remains canonical
  until Supabase rolls out the new format for this project or forces
  migration. No functional impact.

## Commits

- `19f5c46` — `feat(08-08): rls cross-tenant matrix + auth helper + env docs`
- `7839406` — `feat(08-08): shell render harness (TooltipProvider regression guard)`
- `d8f729d` — `chore(08-08): switch reminder cron to hourly (Vercel Pro tier confirmed)`
- (this commit) — `docs(08-08): complete rls-matrix-and-ops-hardening plan`
