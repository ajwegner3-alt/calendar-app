---
phase: 40-dead-code-audit
plan: 07
subsystem: infra
tags: [knip, github-actions, ci, dead-code, regression-prevention]

# Dependency graph
requires:
  - phase: 40-dead-code-audit
    provides: "Plan 06 final removals — knip exit 0 across all four categories on main"
provides:
  - ".github/workflows/knip.yml CI gate (PR + push to main triggers)"
  - "Day-one-passing dead-code regression check"
affects: [all-future-phases, contributor-PR-flow]

# Tech tracking
tech-stack:
  added: ["GitHub Actions workflow infrastructure (.github/ first appearance in repo)"]
  patterns:
    - "node-version '20' in CI pinned to package.json engines.node"
    - "actions/setup-node@v4 cache:'npm' for lockfile-keyed install caching"
    - "npm ci (strict-install) matches Vercel deploy posture — surfaces lockfile drift early"

key-files:
  created:
    - ".github/workflows/knip.yml"
  modified: []

key-decisions:
  - "Single job, single check, no matrix — fast feedback over coverage"
  - "Use npm ci (strict) not npm install — matches Vercel deploy semantics; surfaces lockfile drift as a fail-fast signal"

patterns-established:
  - "Knip CI gate: dedicated workflow runs `npm run knip:ci` on PR-to-main + push-to-main; non-zero exit blocks merge"
  - "First .github/ workflow in repo — establishes location for future Actions (e.g. type-check, vitest, build) if desired"

# Metrics
duration: ~10min
completed: 2026-05-09
---

# Phase 40 Plan 07: Knip CI Gate Summary

**GitHub Actions workflow `.github/workflows/knip.yml` gates dead-code regressions on every PR + push to main; first run failed on pre-existing lockfile drift (NOT a Plan 07 artifact) — surfaced for Andrew.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-09T03:30Z (approx)
- **Completed:** 2026-05-09T03:34Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- `.github/workflows/knip.yml` created and committed (`d94ca07`) — repo's first GitHub Actions workflow.
- Workflow content matches RESEARCH.md exactly: triggers on `pull_request` to main + `push` to main; runs `actions/checkout@v4` → `actions/setup-node@v4` (node-version 20, cache npm) → `npm ci` → `npm run knip:ci`.
- YAML validated with `npx js-yaml` before commit.
- Pushed to `origin/main` (`58af105..d94ca07`).
- First workflow run **uncovered pre-existing lockfile drift** — see "Issues Encountered" below.

## Task Commits

1. **Task 1: Create `.github/workflows/knip.yml`** — file created and validated locally; verified `npm run knip:ci` exits 0 before commit.
2. **Task 2: Commit + push + verify CI run** — committed as `d94ca07` (chore), pushed to `origin/main`.

**Plan metadata:** `<this commit>` (docs)

## Files Created/Modified

- `.github/workflows/knip.yml` (created, 19 lines) — CI gate definition

## Workflow file content (inline)

```yaml
name: knip

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  knip:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run knip:ci
```

## Decisions Made
- None new — workflow content fully prescribed by Plan + RESEARCH.md.

## Deviations from Plan

None. Plan executed exactly as written. Workflow file created with verbatim content from RESEARCH.md / PLAN.md `<action>` block.

## Issues Encountered

### First CI run failed on `npm ci` step due to lockfile drift (pre-existing, NOT Plan 07's fault)

**Run ID:** `25590549332`
**Run URL:** https://github.com/ajwegner3-alt/calendar-app/actions/runs/25590549332
**Conclusion:** failure (at `Run npm ci` step)

**Error from CI logs:**
```
npm error `npm ci` can only install packages when your package.json and
package-lock.json or npm-shrinkwrap.json are in sync. Please update your
lock file with `npm install` before continuing.

npm error Missing: @emnapi/runtime@1.10.0 from lock file
npm error Missing: @emnapi/core@1.10.0 from lock file
npm error Missing: @emnapi/core@1.9.2 from lock file
npm error Missing: @emnapi/runtime@1.9.2 from lock file
npm error Missing: typescript@5.9.3 from lock file
```

**Pre-flight check on this commit was clean:**
- Local `npm run knip:ci` exit code: **0** (verified before commit)
- Workflow YAML: valid (verified via `npx js-yaml`)

**Root cause:** Local environment (Node v24.12.0 / npm 11.6.2) resolves transitive deps differently from CI environment (Node v20.20.2 / npm 10.8.2). The lockfile that worked on local + Vercel does not satisfy `npm ci`'s strict-install check on Node 20 + npm 10. This drift pre-existed Plan 07 — every prior phase shipped to Vercel via `npm install` semantics (or a different Vercel install mode), so the strict check never ran in CI.

**What I tried:**
- `npm install --package-lock-only` from local (Node 24 / npm 11) — added 6 nested transitive entries for `@tailwindcss/oxide-wasm32-wasi/node_modules/@emnapi/*` at version `1.8.1`, but did NOT add the specific versions CI is asking for (`1.10.0` / `1.9.2`). Reverted (`git checkout package-lock.json`) since this would not fix the CI failure and would only add local-side noise.
- Considered: regenerating the lockfile from a Node 20 + npm 10.8.2 environment to match CI exactly. Skipped per CLAUDE.md guidance — this is Andrew's call (involves modifying the lockfile beyond Plan 07 scope; could introduce subtle dep-version shifts that affect Vercel).

**What this means:**
- The workflow file itself is correct and lands as specified by the Plan.
- The CI gate is **live but currently red** on main — not because knip found dead code, but because the strict `npm ci` step itself fails before knip ever runs.
- Future PRs will all fail this check until the lockfile is regenerated under Node 20 / npm 10.

**Suggested fix (Andrew to decide):**
Run from a Node 20 environment to regenerate the lockfile to match CI:
```bash
# in a Node 20 / npm 10.8.2 shell (e.g., nvm use 20)
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "chore: regenerate package-lock.json under Node 20 to match CI strict install"
git push origin main
```
Alternative: switch the CI workflow's `npm ci` to `npm install` (relaxes the gate but loses the install-time drift safety net Vercel relies on).

This issue is **out of scope for Plan 07**. The workflow file is correct; the lockfile drift is a separate pre-existing latent bug Plan 07 surfaced. Recommend Andrew tackle it as a one-off chore commit before Plan 08 (final QA), so the Phase 40 close-out has a green CI badge.

## User Setup Required

None for the workflow itself — once committed, GitHub Actions runs automatically.

**Manual follow-up (recommended):** Regenerate `package-lock.json` under Node 20 / npm 10 to make the new gate green (see "Issues Encountered" above). Steps:
1. Switch local Node to 20.x (e.g. `nvm use 20` if installed, or use a Node 20 Docker image).
2. `rm package-lock.json && rm -rf node_modules`
3. `npm install`
4. `git add package-lock.json`
5. `git commit -m "chore: regenerate lockfile for Node 20 strict CI install"`
6. `git push origin main`
7. Watch the next workflow run — should be green.

## Next Phase Readiness

- **Plan 08 (v1.7 final manual QA) is unblocked** — Plan 08 is a checkpoint plan (manual QA pass), independent of CI gate state. The lockfile-drift fix can be folded into the same QA pass or handled as a separate chore before final v1.7 close-out.
- **Phase 40 dead-code audit is functionally complete** — all removals (Plans 03-06) landed, knip is exit-0 on main, the regression-prevention gate is in place. Whether the gate is green or red on its own first run does not change the fact that the code is dead-code-free; it only flags an orthogonal lockfile sync issue.
- **Concern to flag:** Until the lockfile is regenerated, every subsequent PR opened against `main` will show this same red knip check. Andrew should regenerate before any further development if PR-status visibility matters.

---
*Phase: 40-dead-code-audit*
*Completed: 2026-05-09*
