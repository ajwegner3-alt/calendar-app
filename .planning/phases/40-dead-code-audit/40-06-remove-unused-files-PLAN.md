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
    - "After deletion + final knip.json sync (plus per-symbol `knip-ignore-line` comments or `ignoreExportsUsedInFile` entries for KEEP-listed exports), `npx knip` exits 0 across ALL categories — file/dep/export KEEP residue is fully resolved in Plan 06; Plan 07 inherits a clean tree"
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
  <name>Task 2: Sync knip.json with locked KEEP list, commit atomically, then run build + test gate</name>
  <files>knip.json</files>
  <action>
**Framing note:** Additions to `knip.json` `ignore` / `ignoreDependencies` / `ignoreExportsUsedInFile` in this task are **post-review residue** from Andrew's KEEP decisions, NOT preemptive ignores. CONTEXT.md's preemptive-ignore restriction (slot-picker + tests/__mocks__ + helpers only) does not apply at this stage — Claude's discretion clause covers post-review sync.

Read the "## Final KEEP list" section of `40-KNIP-DECISIONS.md` and update `knip.json` so **all three categories of KEEP residue are fully resolved before this plan ends** (so `npx knip` exits 0 and Plan 07's CI gate can land):

1. **KEEP-listed files** → add to the `"ignore"` array (preserving the existing `app/[account]/[event-slug]/_components/slot-picker.tsx` entry).

2. **KEEP-listed dependencies** → add to `"ignoreDependencies"` (create the array if it doesn't exist).

3. **KEEP-listed exports** → resolve fully here (do NOT defer to Plan 07). Pick per-residue size:
   - **Option A — per-symbol `// knip-ignore-line` comment** at the export site. Best when there are only a handful of KEEP-listed exports (≤5) and they're spread across different files; the comment lives next to the symbol, so future-Claude sees the rationale in context.
   - **Option B — `ignoreExportsUsedInFile: true`** per file in `knip.json` (use the file-keyed object form: `"ignoreExportsUsedInFile": { "path/to/file.ts": true }`). Best when many KEEP exports cluster in a few files (e.g., a barrel or a util module with several intentionally-public-but-unused-yet symbols). One config edit covers the file.
   - Document the chosen mechanism per export in `40-KNIP-DECISIONS.md` (extend the "Final KEEP list → Exports" entries with `(suppressed via: knip-ignore-line)` or `(suppressed via: ignoreExportsUsedInFile in knip.json)`).

After updating knip.json (and any in-source `knip-ignore-line` comments), run `npx knip` and confirm **exit code 0** across ALL categories. This is a hard requirement — Plan 07's CI gate cannot land if `npx knip` is non-zero at the end of Plan 06.

If `npx knip` still reports issues:
- If it's an export-level KEEP residue not yet suppressed: keep iterating on Option A / Option B until clean. Do NOT punt to Plan 07.
- If it's a NEW finding (not in DECISIONS.md): means a previous plan missed something OR removing a file orphaned an export elsewhere. Investigate, surface to Andrew, decide whether to extend this commit's deletion list or flip the new finding to KEEP (then re-suppress per the same Option A/B mechanism).

Step 1 — Commit atomically (deletions from Task 1 + knip.json sync + any in-source knip-ignore-line comments):

```bash
git add -A {deleted files paths} knip.json {files-with-knip-ignore-line-comments}
git commit -m "chore(40): remove unused files

Removed per 40-KNIP-DECISIONS.md:
- {path1}
- {path2}
- ...

Synced knip.json ignore / ignoreDependencies / ignoreExportsUsedInFile with locked KEEP residue.
Per-symbol knip-ignore-line comments added where applicable (see DECISIONS.md).
SQL migrations untouched (supabase/migrations/** excluded from project glob).

Audit log: .planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md"
```

Step 2 — Run the build + test gate AFTER the commit (per CONTEXT.md "Commit cadence"):

1. `npm run build` — MUST exit 0.
2. `npx vitest run` — failing count MUST be <=1.
3. `npx knip` — MUST exit 0 (no residual issues; this is the gate Plan 07 inherits).

Step 3 — Outcome:

- **If green:** push immediately. Verify Vercel deploy green. Plan 07 (CI gate) can proceed.

- **If red:** `git revert HEAD --no-edit` to undo the commit cleanly (preserves history per CONTEXT.md). Edit `40-KNIP-DECISIONS.md` to flip the offending file(s) to KEEP with rationale `"build/test failure: {error}"`. Update knip.json (and source comments) accordingly so the new KEEP item is suppressed under the same Option A / Option B framework. Re-attempt the batch from Task 1 with the trimmed REMOVE list (a fresh commit). Document the revert + KEEP flip in DECISIONS.md.
  </action>
  <verify>
- `npx knip` exits 0 across ALL categories (file, dep, AND export KEEP residue fully resolved in this plan — no residue punted to Plan 07).
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
- `npx knip` exits 0 (zero issues across all categories — KEEP residue suppressed via knip.json + optional per-symbol comments).
- All four removal commits exist on `main` (`git log --oneline | grep "chore(40):"` shows: deps, duplicate exports, unused exports, unused files).
</verification>

<success_criteria>
- File deletions surgical and staged via `git rm`.
- knip.json synced with KEEP residue.
- `npx knip` exit 0 across all categories (KEEP residue fully resolved in this plan).
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
