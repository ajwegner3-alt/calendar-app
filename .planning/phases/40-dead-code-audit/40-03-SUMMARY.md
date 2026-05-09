---
phase: 40-dead-code-audit
plan: 03
subsystem: build-system
tags: [dead-code, dependencies, npm, knip, cleanup]
requires: [40-01, 40-02]
provides:
  - "Trimmed dependency surface (3 unused packages removed)"
  - "Clean atomic chore commit at 14fb48c"
  - "Push to origin/main triggers Vercel deploy of leaner build"
affects: [40-04, 40-05, 40-06, 40-07]
tech-stack:
  removed:
    - "nodemailer (^8.0.6) — last consumer retired in Phase 35-06 SMTP cutover"
    - "@eslint/eslintrc (^3) — flat-config migration in Phase 08-02 retired FlatCompat"
    - "@types/nodemailer (^8.0.0) — companion typings to nodemailer"
  patterns: []
key-files:
  modified:
    - "package.json — three lines removed from deps + devDeps"
    - "package-lock.json — regenerated; 2 packages removed from tree"
decisions:
  - "Watermark correction logged: pre-existing failing-test count is 2, not 1. Both `tests/bookings-api.test.ts` and `tests/slots-api.test.ts` fail on the pre-commit (6b1c3b0) state; `slots-api.test.ts` failure was previously uncaught/unrecorded. Dep removal does not cause either failure (verified by re-running same two test files against pre-commit state)."
metrics:
  duration: ~5 minutes
  completed: 2026-05-08
---

# Phase 40 Plan 03: Remove Unused Dependencies — Summary

**One-liner:** Removed three Phase-35-orphaned dependencies (`nodemailer`, `@eslint/eslintrc`, `@types/nodemailer`) in a single atomic `chore(40)` commit; build green, no flips, no test regression caused.

---

## Packages removed

All three packages from `40-KNIP-DECISIONS.md` "Unused Dependencies (Plan 03 target)" section were removed in a single `npm uninstall` call:

| Package | Type | Version pin | Rationale |
|---|---|---|---|
| `nodemailer` | dependency | `^8.0.6` | Phase 35-06 retired SMTP/App-Password path. Zero `from "nodemailer"` / `require("nodemailer")` imports across `*.{ts,tsx,js,mjs}` source. Surviving mentions are stale comments only (`lib/email/send-reminder-booker.ts:205`, `lib/email-sender/index.ts:5`, `lib/email-sender/providers/gmail-oauth.ts:22`, `tests/account-sender.test.ts:222,224`, `tests/__mocks__/email-sender.ts:7,13`). |
| `@eslint/eslintrc` | devDependency | `^3` | Phase 08-02 migrated to native flat config (FlatCompat removed). Only mention in source is a stale comment in `eslint.config.mjs:9`. Active flat config uses direct imports from `eslint-config-next`. |
| `@types/nodemailer` | devDependency | `^8.0.0` | Companion typings to `nodemailer`; removed in same commit. Zero source-file references. |

`npm uninstall` reported `removed 2 packages, audited 834 packages` (the third was a transitive that other deps still hold).

## Flips back to KEEP

**None.** All three packages cleared pre-flight grep checks (no source imports, no config-file consumers other than self-references in `package.json`/`package-lock.json`) and the post-commit build/test gate did not surface any breakage attributable to their removal.

## Pre-flight grep results (RESEARCH.md Pitfall 5)

For each package, three greps run before uninstall:

```
grep -rn "from ['\"]<pkg>"     --include="*.{ts,tsx,js,mjs}"   → 0 matches all three
grep -rn "require\(['\"]<pkg>" --include="*.{ts,tsx,js,mjs}"   → 0 matches all three
grep -l "<pkg>" *.config.* eslint.config.mjs vitest.config.ts
       next.config.ts postcss.config.* tailwind.config.*
       package.json vercel.json                                → only stale comment in eslint.config.mjs
                                                                  + package.json self-reference
                                                                  (no actionable consumers)
```

The single `eslint.config.mjs:9` hit on `@eslint/eslintrc` is in a code comment explaining *why* `FlatCompat` was removed in Phase 08-02 — not a runtime/build dependency. Comment left intact (Phase 40 scope is package-level removal, not source-comment cleanup).

## Build + test gate

| Gate | Result | Detail |
|---|---|---|
| `npm run build` (next build) | PASS, exit 0 | Duration ~20s. All 39 routes built, including 4 prerendered static pages and middleware proxy. No type errors, no module-resolution errors. |
| `npx vitest run` | 2 failures | Test Files: 2 failed / 40 passed (42 total). Tests: 2 failed / 353 passed / 9 skipped (364 total). Failures: `tests/bookings-api.test.ts > (a) 201 returns bookingId...` (pre-existing per STATE.md watermark) AND `tests/slots-api.test.ts > returns flat slots array...` (pre-existing but NOT documented in plan pre-state — this plan upgrades the watermark from 1 to 2). |
| `npm ls` | exit 0 | Dependency tree integrity preserved. |
| `git push origin main` | success | `b00b112..14fb48c  main -> main`. Vercel auto-deploy triggered. |

## Watermark correction (deviation Rule 1)

The plan's `<must_haves.truths>` and pre-state both stated the failing-test watermark was "1 (the pre-existing `tests/bookings-api.test.ts` fixture-mismatch)". After this plan's vitest run came back at **2 failures**, I:

1. Restored `package.json` + `package-lock.json` to the pre-commit (`6b1c3b0`) state via `git checkout 6b1c3b0 -- package.json package-lock.json && npm install`.
2. Re-ran `npx vitest run tests/slots-api.test.ts tests/bookings-api.test.ts` against that restored state.
3. **Both tests failed identically** — same `expected 0 to be greater than or equal to 1` assertion shape.
4. Restored `package.json` + `package-lock.json` to commit `14fb48c` state.

**Verdict:** The dep removal does not cause either failure. Both are pre-existing test fixtures whose seeded data evaluated against a date that was a Friday (2026-05-08), not the test's intended Monday window. The actual phase-40 watermark is 2 failing tests, not 1. Documented here for Plans 04-06 to use as the corrected watermark.

This is a Rule 1 (auto-document) deviation, not a Rule 4 (architectural escalation): no decision is required, and reverting the dep removal would not fix the failures.

## Build time delta

Not measurable from this plan alone (no baseline `next build` timing was captured in Plan 40-01). For reference, this plan's `next build` ran in ~20 seconds. Plan 07 (CI gate) is the natural place to add a baseline-build-time entry to STATE.md.

## Vercel deploy verification

Push to `main` succeeded (`b00b112..14fb48c`). Per STATE.md "Production cutover risk now mitigated" note, the production deployment continues to serve the existing nsi-account Gmail-connected booking flow. Removing `nodemailer` does NOT affect the live email path — Phase 35-06 retired the nodemailer SMTP code, and current sends use the Gmail REST API + Resend HTTP provider (Phase 36).

**Vercel CLI was not available in this session,** so deploy-status verification is deferred to Andrew (per the plan's stated fallback: "if Vercel CLI is available, `vercel ls` to see latest deploy status; otherwise note that the push was successful and Andrew should monitor"). Andrew can verify via `vercel ls` locally, the Vercel dashboard, or simply by visiting any production URL and confirming the booking flow still works.

## Commits

| Hash | Message | Files |
|---|---|---|
| `14fb48c` | `chore(40): remove unused dependencies` | `package.json`, `package-lock.json` |

## Deviations from Plan

**1. [Rule 1 — Documentation] Watermark correction from 1 → 2 pre-existing failing tests.**

- **Found during:** Task 2 build/test gate.
- **Issue:** Plan pre-state documented the watermark as "1 failing test (`tests/bookings-api.test.ts`)". Post-removal vitest reported 2 failures. To distinguish "removal caused new failure" from "watermark was wrong", I temporarily restored `package.json` + `package-lock.json` to pre-commit state and re-ran both failing test files — both still failed identically.
- **Fix:** No code change. This SUMMARY documents the corrected watermark (2 failing tests) so Plans 40-04 through 40-06 use the right baseline. The dep removal is preserved (it did not cause either failure).
- **Files modified:** None (post-restoration `git checkout HEAD -- package.json package-lock.json` returned working tree to `14fb48c` state).
- **Commit:** N/A (analysis-only; no code change required).

## Authentication Gates

None — this plan is fully autonomous, zero CLI/API auth required beyond `git push` (already authenticated).

## Plan-spec compliance

- [x] Pre-flight grep run for each of 3 packages (RESEARCH.md Pitfall 5 satisfied).
- [x] No real consumer hits surfaced — all three packages safe to remove.
- [x] Single `npm uninstall nodemailer @eslint/eslintrc @types/nodemailer` invocation.
- [x] `package.json` post-state has zero matches for the three removed names (`grep -E "\"(nodemailer|@eslint/eslintrc|@types/nodemailer)\"" package.json` exit code 1).
- [x] `npm ls` exits 0.
- [x] `git diff package.json` shows ONLY removed lines (3 deletions: 1 from deps, 2 from devDeps). No other modifications.
- [x] Atomic commit message follows format: `chore(40): remove unused dependencies` + bulleted package list + audit-log reference.
- [x] `npm run build` exits 0 (~20s).
- [x] Pushed to `origin/main` per global "All testing is done live" rule.
- [x] Three pre-existing-drift VERIFICATION/CONTEXT files (`02-VERIFICATION.md`, `23-VERIFICATION.md`, `33-CONTEXT.md`) NOT touched.

## Plan 04 readiness

Plan 04 (duplicate exports) is empty per `40-KNIP-DECISIONS.md` ("Duplicate Exports (Plan 04 target)" → "_None._"). It will auto-skip with a documentation-only commit. **Plan 05 (unused exports — 23 REMOVE items across whole-symbol and export-keyword-only categories) is the next substantive batch.**
