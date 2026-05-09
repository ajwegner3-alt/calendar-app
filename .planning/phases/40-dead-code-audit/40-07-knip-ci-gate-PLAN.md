---
phase: 40-dead-code-audit
plan: 07
type: execute
wave: 7
depends_on: ["40-06"]
files_modified:
  - .github/workflows/knip.yml
autonomous: true

must_haves:
  truths:
    - "GitHub Actions workflow file `.github/workflows/knip.yml` exists and triggers on PRs to main + pushes to main"
    - "Workflow runs `npm run knip:ci` and fails the job on non-zero exit"
    - "When the workflow runs against the current main branch, it passes (because `npx knip` is exit 0 after Plan 06)"
    - "Future PRs introducing dead code will fail this gate at review time"
  artifacts:
    - path: ".github/workflows/knip.yml"
      provides: "CI PR gate for dead-code analysis"
      contains: "npm run knip:ci"
  key_links:
    - from: ".github/workflows/knip.yml"
      to: "package.json `knip:ci` script"
      via: "`run: npm run knip:ci`"
      pattern: "knip:ci"
---

<objective>
Add the GitHub Actions workflow that gates PRs on `npx knip` exit code. Lands AFTER all removals (Plans 03-06) so the workflow passes from the moment it merges — adding it before removals would block every PR.

Purpose: Prevent dead-code regressions in future PRs without manual review.
Output: `.github/workflows/knip.yml` committed; workflow passes on the current main.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-dead-code-audit/40-RESEARCH.md
@package.json
@knip.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create .github/workflows/knip.yml</name>
  <files>.github/workflows/knip.yml</files>
  <action>
Per RESEARCH.md "CI gate recommendation," the `.github/` directory does NOT exist in the repo — create it from scratch.

Create `.github/workflows/knip.yml` with the verified content from RESEARCH.md:

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

Notes:
- `node-version: '20'` matches `package.json` `engines.node` per RESEARCH.md.
- `cache: 'npm'` enables built-in lockfile-keyed cache.
- `npm ci` matches Vercel's strict-install behavior (uses package-lock.json verbatim, fails on drift).
- `knip:ci` script was added to package.json in Plan 01 (`knip --no-progress --reporter compact`); the non-zero exit on issues is what fails the workflow.

Do NOT add `working-directory`, matrix builds, or extra steps. Single job, single check, fast feedback.

Verify locally before committing that `npm run knip:ci` exits 0 (the gate would pass on this commit if it ran):

```bash
npm run knip:ci
echo "exit code: $?"
```

If it exits non-zero, do NOT commit the workflow yet — investigate residue. There may be export-level KEEP items that need to be promoted to ignored, OR a new finding crept in. Surface to Andrew, edit knip.json if needed, then proceed once `knip:ci` is green.
  </action>
  <verify>
- `.github/workflows/knip.yml` exists at the repo root.
- File is valid YAML (`npx js-yaml .github/workflows/knip.yml > /dev/null` exits 0; or `cat | python -c "import yaml,sys; yaml.safe_load(sys.stdin)"`).
- `npm run knip:ci && echo OK` prints `OK`.
  </verify>
  <done>
Workflow file in place; locally validated.
  </done>
</task>

<task type="auto">
  <name>Task 2: Commit and verify gate runs against the open branch</name>
  <files>(no file changes; commit + push only)</files>
  <action>
Commit:

```bash
git add .github/workflows/knip.yml
git commit -m "chore(40): add knip CI gate

Workflow runs on every PR to main + pushes to main.
Fails on non-zero npx knip exit (any new dead code blocks PR merge).

Lands after Plans 40-03 through 40-06 removals so current main passes the gate from day one."
```

Push to GitHub. The workflow will trigger on the push to main.

Use `gh run list --workflow=knip.yml --limit=1` to find the run. Use `gh run view {run-id}` to confirm it succeeded.

If the GitHub-hosted run fails despite `npm run knip:ci` passing locally:
- Likely cause: lockfile drift between local and CI (`npm ci` installs strict). Check the workflow logs.
- Or: an environment-only difference (e.g., a config file referencing a path that exists locally but not in CI's checkout — unlikely with `actions/checkout@v4`).

Surface any failure to Andrew with the run logs.

If green, the CI gate is live. Future PRs that add dead code will fail this check at review time.
  </action>
  <verify>
- `git log -1 --oneline` shows the chore commit.
- `gh run list --workflow=knip.yml --limit=1` shows status `completed` and conclusion `success`.
  </verify>
  <done>
CI gate live and green on main. Plan 08 (final QA) can proceed.
  </done>
</task>

</tasks>

<verification>
- `.github/workflows/knip.yml` committed.
- First workflow run on main is green.
- Future contributor experience: PR with new dead code → workflow fails → red check on PR → cannot merge until cleaned up.
</verification>

<success_criteria>
- Workflow file in correct location with correct triggers.
- Runs on main and passes.
- Single chore commit.
</success_criteria>

<output>
After completion, create `.planning/phases/40-dead-code-audit/40-07-SUMMARY.md` with:
- Workflow file content (or link)
- First-run conclusion
- Note on any export-level residue handling needed before workflow could pass
</output>
