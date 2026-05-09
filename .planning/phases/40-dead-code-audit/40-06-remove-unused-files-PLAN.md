---
phase: 40-dead-code-audit
plan: 06
type: execute
wave: 6
depends_on: ["40-05"]
files_modified:
  - (TBD - sourced from 40-KNIP-DECISIONS.md "Unused Files (Plan 06 target)" list)
  - knip.json
autonomous: true

must_haves:
  truths:
    - "Every file listed under '### Unused Files (Plan 06 target)' in 40-KNIP-DECISIONS.md is deleted"
    - "SQL migration files in supabase/migrations/ are NOT touched"
    - "After deletion + final knip.json sync, `npx knip` reports zero issues in target categories (modulo the locked KEEP list which is now in knip.json `ignore` / `ignoreDependencies`)"
    - "`next build` exits 0 after removal"
    - "`vitest run` failing-test count remains <=1"
    - "Single chore commit `chore(40): remove unused files` lands the deletions atomically; knip.json sync may be a separate prep commit if needed"
  artifacts:
    - path: ".planning/phases/40-dead-code-audit/40-06-SUMMARY.md"
      provides: "Per-file removal record"
    - path: "knip.json"
      provides: "Final ignore list synced with KEEP residue"
  key_links:
    - from: "40-KNIP-DECISIONS.md REMOVE list (Plan 06 target)"
      to: "git rm of file paths"
      via: "1:1 deletion"
      pattern: "chore\\(40\\): remove unused files"
    - from: "40-KNIP-DECISIONS.md KEEP list"
      to: "knip.json ignore / ignoreDependencies"
      via: "post-removal sync"
      pattern: "knip.json"
---

<objective>
Surgically delete every file listed under "### Unused Files (Plan 06 target)" in `40-KNIP-DECISIONS.md` — the fourth and final commit in the removal sequence (biggest blast radius last). Then sync `knip.json` so its `ignore` / `ignoreDependencies` list matches the locked KEEP residue from DECISIONS.md, so `npx knip` reports zero issues — Plan 07's CI gate will pass.

Purpose: Trim the file count to only what's used; lock in `knip.json` as the standing source of truth for "knip-clean."
Output: Files deleted, knip.json updated, single (or two-step: delete + sync) chore commit, build + test gate green, `npx knip` exit 0.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md
@.planning/phases/40-dead-code-audit/40-CONTEXT.md
@.planning/phases/40-dead-code-audit/40-RESEARCH.md
@knip.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete every Plan 06 REMOVE-listed file with final pre-flight grep</name>
  <files>(TBD - per 40-KNIP-DECISIONS.md Plan 06 target list)</files>
  <action>
Read `40-KNIP-DECISIONS.md` and enumerate every entry under "### Unused Files (Plan 06 target)". If empty, skip to Task 2.

For each path, perform a final cross-codebase grep to catch anything previous plans missed:

- `grep -rn "<basename-without-ext>" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md"` (include configs, package.json, vercel.json — RESEARCH.md landmine inventory).
- For files under `app/`: confirm the route path (the directory structure) is also covered by the deletion. If only some files in a route directory are flagged unused, you may be removing partial route functionality — STOP and surface.
- For files under `lib/email-sender/providers/`: confirm no `getSenderForAccount` branch keys it (search for the file's basename in `account-sender.ts`).

**SQL migration safety check (CONTEXT.md success criterion #3, "always excluded"):** verify NO file path under `supabase/migrations/` appears in the REMOVE list. The `project` glob in knip.json already excludes `supabase/**` so this should never happen, but verify defensively. If any does, STOP — this is a config bug.

If grep clean, delete the file with `git rm <path>`. Use `git rm` (not `rm`) so the deletion is staged. For directories that become empty after removing all their files, `git rm` handles cleanup automatically; verify with `git status`.

Run `npx tsc --noEmit` after the batch to catch any orphan imports.
  </action>
  <verify>
- Every Plan-06 REMOVE-listed file is staged for deletion (`git status` shows them as `deleted`).
- `git diff --cached --name-only --diff-filter=D | grep -E "supabase/migrations/"` returns empty (no SQL touched).
- `npx tsc --noEmit` exits 0.
- No partial route-directory deletions (if a directory is in the REMOVE list, all its non-special files should be too).
  </verify>
  <done>
File deletions staged; type-check clean; SQL migrations untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Sync knip.json with locked KEEP list, then build+test gate, then commit</name>
  <files>knip.json</files>
  <action>
Read the "## Final KEEP list" section of `40-KNIP-DECISIONS.md` and update `knip.json` so:

- Every KEEP-listed **file** is in the `"ignore"` array (preserving the existing `app/[account]/[event-slug]/_components/slot-picker.tsx` entry).
- Every KEEP-listed **dependency** is added to `"ignoreDependencies"` (create the array if it doesn't exist).
- KEEP-listed **exports** can stay flagged by knip (they are exports, not files; usual approach is to leave them and accept the residue, OR add `"ignoreExportsUsedInFile"` if appropriate — Andrew's call). Default: leave them as residue and document in DECISIONS.md why the CI gate is allowed to flag them (it won't, because if Plan 07's CI command is `knip --no-progress --reporter compact` and exit code is what we gate on, ANY remaining issue fails CI). To handle this cleanly: if there ARE KEEP-listed exports, add a `"ignoreExportsUsedInFile"` block or add explicit per-symbol comments in source AND surface to Andrew during Plan 07 setup. For now in Plan 06, mirror the file/dep KEEP entries into knip.json and leave export-level KEEP residue for Plan 07 to address.

After updating knip.json, run `npx knip` and confirm exit code 0 (zero issues across all categories).

If `npx knip` STILL reports issues:
- If it's an export-level KEEP residue: that's a Plan 07 concern. Note in summary; Plan 07 will adjust knip.json or migrate the export to a different ignore mechanism.
- If it's a NEW finding (not in DECISIONS.md): means a previous plan missed something OR removing a file orphaned an export elsewhere. Investigate, surface to Andrew, decide whether to extend this commit's deletion list or flip the new finding to KEEP.

Build + test gate (per CONTEXT.md):
1. `npm run build` — MUST exit 0.
2. `npx vitest run` — failing count MUST be <=1.

Failure recovery: `git checkout -- {files}` (or `git restore --staged --worktree {files}` for staged deletions), edit DECISIONS.md to flip offending file to KEEP with rationale, re-attempt.

If gate green, commit atomically:

```bash
git add -A {deleted files paths} knip.json
git commit -m "chore(40): remove unused files

Removed per 40-KNIP-DECISIONS.md:
- {path1}
- {path2}
- ...

Synced knip.json ignore list with locked KEEP residue.
SQL migrations untouched (supabase/migrations/** excluded from project glob).

Audit log: .planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md
Build + vitest gate: PASS
npx knip: zero issues in target categories"
```

Push immediately. Verify Vercel deploy green.
  </action>
  <verify>
- `npx knip` exits 0 (or has only the export-level KEEP residue documented for Plan 07 handling).
- `git log -1 --oneline` shows the chore commit.
- `git diff HEAD~1 -- supabase/migrations/` shows zero changes.
- Vercel deploy green.
- `slot-picker.tsx` still exists at `app/[account]/[event-slug]/_components/slot-picker.tsx`.
  </verify>
  <done>
All four removal commits landed (40-03 through 40-06). Codebase is knip-clean (or has documented KEEP-residue for Plan 07 to finalize). Plan 07 (CI gate) can proceed.
  </done>
</task>

</tasks>

<verification>
- Single `chore(40): remove unused files` commit covering deletions + knip.json sync.
- `next build` + `vitest run` watermark held.
- SQL migrations verified untouched.
- `npx knip` reports zero issues (or only documented residue).
- All four removal commits exist on `main` (`git log --oneline | grep "chore(40):"` shows: deps, duplicate exports, unused exports, unused files).
</verification>

<success_criteria>
- File deletions surgical and staged via `git rm`.
- knip.json synced with KEEP residue.
- `npx knip` exit 0 (or documented exception).
- Atomic commit.
- Build + test gate green.
</success_criteria>

<output>
After completion, create `.planning/phases/40-dead-code-audit/40-06-SUMMARY.md` with:
- List of files deleted
- knip.json diff (entries added to `ignore` / `ignoreDependencies`)
- Confirmation `npx knip` exits 0 (or specific residue documented)
- Confirmation Vercel deploy green
- Total impact (file count delta from start of Phase 40)
</output>
