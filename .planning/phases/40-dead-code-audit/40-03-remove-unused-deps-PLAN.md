---
phase: 40-dead-code-audit
plan: 03
type: execute
wave: 3
depends_on: ["40-02"]
files_modified:
  - package.json
  - package-lock.json
autonomous: true

must_haves:
  truths:
    - "Every package listed under '### Unused Dependencies (Plan 03 target)' in 40-KNIP-DECISIONS.md is removed from package.json"
    - "`npm install` regenerates package-lock.json cleanly with no errors"
    - "`next build` exits 0 after removal"
    - "`vitest run` failing-test count is <=1 (the pre-existing tests/bookings-api.test.ts watermark)"
    - "Single chore commit `chore(40): remove unused dependencies` lands the change atomically"
  artifacts:
    - path: "package.json"
      provides: "Trimmed dependencies list"
    - path: "package-lock.json"
      provides: "Regenerated lockfile"
  key_links:
    - from: "40-KNIP-DECISIONS.md REMOVE list (Plan 03 target)"
      to: "package.json removed entries"
      via: "1:1 deletion"
      pattern: "chore\\(40\\): remove unused dependencies"
---

<objective>
Surgically remove every dependency listed in `40-KNIP-DECISIONS.md` under "### Unused Dependencies (Plan 03 target)" — first commit in the four-batch removal sequence (smallest blast radius first per RESEARCH.md commit-order).

Purpose: Trim package.json to what the codebase actually uses, validated by build + tests, in one atomic commit.
Output: Single `chore(40): remove unused dependencies` commit; clean build + test gate.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md
@.planning/phases/40-dead-code-audit/40-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify each REMOVE-listed dep one more time, then run npm uninstall</name>
  <files>package.json, package-lock.json</files>
  <action>
Read `40-KNIP-DECISIONS.md` and enumerate every package under "### Unused Dependencies (Plan 03 target)".

If the list is empty (`_None._`), skip to the verification gate (no commit needed; document this in the summary).

For each listed package, perform a final pre-flight grep (RESEARCH.md Pitfall 5):
- `grep -rn "from ['\"]<pkg>" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs"`
- `grep -rn "require(['\"]<pkg>" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs"`
- `grep -l "<pkg>" *.config.* eslint.config.mjs vitest.config.ts next.config.ts postcss.config.* tailwind.config.* package.json vercel.json`

If ANY hit returns a real consumer (not a comment, not the package.json self-reference), STOP. This is a discrepancy with the locked decision — fail loud, surface to Andrew with the grep output, and let him decide whether to flip the item to KEEP (per CONTEXT.md failure-recovery: edit DECISIONS.md, do not silently keep).

If all greps clean, run `npm uninstall {pkg1} {pkg2} ... {pkgN}` (single npm invocation removes them all in one lockfile pass — cleaner than per-package).

Verify package.json no longer lists any of the removed names; verify package-lock.json regenerated.
  </action>
  <verify>
- `grep -E "\"({pkg1}|{pkg2}|...)\"" package.json` returns 0 matches.
- `npm ls` exits 0 (no broken dependency tree).
- `git diff package.json` shows ONLY removed lines from the deps + devDeps blocks (no other modifications).
  </verify>
  <done>
package.json + package-lock.json reflect the trimmed dep list. No source files modified yet.
  </done>
</task>

<task type="auto">
  <name>Task 2: Build + test gate, then commit atomically</name>
  <files>(no file changes; commit only)</files>
  <action>
Run the build + test gate per CONTEXT.md "Commit cadence":

1. `npm run build` (Next.js production build) — MUST exit 0.
2. `npx vitest run` — failing-test count MUST be <=1 (the pre-existing `tests/bookings-api.test.ts` fixture-mismatch watermark per STATE.md "Open tech debt").

If build fails: read the error, identify which removed dep was actually consumed (likely a config-file-only consumer that the seeding pass missed). `git checkout package.json package-lock.json` to discard the removal, edit `40-KNIP-DECISIONS.md` to flip the offending package from REMOVE to KEEP with rationale `"build failure on uninstall: {error message}"`, then re-run from Task 1 with the trimmed REMOVE list.

If vitest failures > 1: same recovery — identify the regression-causing dep, flip to KEEP in DECISIONS.md, re-attempt.

If build+test gate green: commit atomically.

```bash
git add package.json package-lock.json
git commit -m "chore(40): remove unused dependencies

Removed per 40-KNIP-DECISIONS.md:
- {pkg1}
- {pkg2}
- ...

Audit log: .planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md
Build + vitest gate: PASS"
```

Push immediately per global rule "All testing is done live. Once a section or update is complete, push to GitHub immediately to deploy."

Confirm Vercel deploy succeeds (check deployment URL or the Vercel dashboard; if Vercel CLI is available, `vercel ls` to see latest deploy status).
  </action>
  <verify>
- `git log -1 --oneline` shows the chore commit.
- `npm run build` exits 0.
- `npx vitest run` failing count <=1.
- Vercel deploy succeeded (production build green on remote).
  </verify>
  <done>
Atomic chore commit landed. Build + vitest gate green. Production deploy verified. Plan 04 can proceed.
  </done>
</task>

</tasks>

<verification>
- Single `chore(40): remove unused dependencies` commit on `main`.
- `next build` and `vitest run` watermark held.
- 40-KNIP-DECISIONS.md updated if any items were flipped during recovery.
</verification>

<success_criteria>
- Removal is surgical (only deps, nothing else).
- Build + test gate green.
- Atomic commit with audit-log reference in message body.
</success_criteria>

<output>
After completion, create `.planning/phases/40-dead-code-audit/40-03-SUMMARY.md` with:
- List of packages removed
- Any flips back to KEEP (with reason)
- Build time delta if measurable
- Confirmation Vercel deploy is green
</output>
