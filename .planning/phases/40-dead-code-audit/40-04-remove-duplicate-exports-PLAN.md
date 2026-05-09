---
phase: 40-dead-code-audit
plan: 04
type: execute
wave: 4
depends_on: ["40-03"]
files_modified:
  - (TBD - sourced from 40-KNIP-DECISIONS.md "Duplicate Exports (Plan 04 target)" list)
autonomous: true

must_haves:
  truths:
    - "Every duplicate export listed under '### Duplicate Exports (Plan 04 target)' in 40-KNIP-DECISIONS.md is removed"
    - "`next build` exits 0 after removal"
    - "`vitest run` failing-test count remains <=1 (watermark held)"
    - "Single chore commit `chore(40): remove duplicate exports` lands the change atomically"
  artifacts:
    - path: ".planning/phases/40-dead-code-audit/40-04-SUMMARY.md"
      provides: "Per-symbol removal record"
  key_links:
    - from: "40-KNIP-DECISIONS.md REMOVE list (Plan 04 target)"
      to: "single-line export deletions"
      via: "1:1 surgical edit"
      pattern: "chore\\(40\\): remove duplicate exports"
---

<objective>
Surgically remove every duplicate export listed under "### Duplicate Exports (Plan 04 target)" in `40-KNIP-DECISIONS.md` — the second commit in the four-batch removal sequence (low-risk: single-line deletions on barrel re-exports).

Purpose: Eliminate redundant re-exports without touching the canonical export sites.
Output: Single `chore(40): remove duplicate exports` commit; build + test gate green.
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
  <name>Task 1: Verify each duplicate export site, then surgically remove</name>
  <files>(TBD - per 40-KNIP-DECISIONS.md Plan 04 target list)</files>
  <action>
Read `40-KNIP-DECISIONS.md` and enumerate every entry under "### Duplicate Exports (Plan 04 target)". If empty, skip to summary.

For each entry (`{file}:{line}` — `{symbol}`):

1. Read the file at the specified line. Confirm the line IS an export of `{symbol}` (re-export from a barrel, or a duplicate `export` keyword on a re-declared name). Per RESEARCH.md Pitfall 4, knip considers it a duplicate when both `import { X } from "./a"` and `import { X } from "./b"` resolve to the same symbol.

2. Pre-flight grep: `grep -rn "from.*['\"]<file-path-without-ext>" --include="*.ts" --include="*.tsx"` to find consumers of THIS specific re-export site. If any consumer imports `{symbol}` from THIS file (not the canonical sibling), the duplicate is actually live for that consumer — STOP and surface to Andrew with the grep output. Either flip to KEEP in DECISIONS.md OR rewrite the consumer to import from the canonical site (Andrew's call).

3. If grep clean (no consumers of this duplicate site): use the Edit tool to remove the duplicate export line. If the removal leaves an empty barrel file or an empty `export {}` block, leave the file structurally valid — do not delete the file (that's Plan 06's job; this plan is line-level only).

4. After all duplicates removed, run `npx tsc --noEmit` to catch any type-level breakage.
  </action>
  <verify>
- `git diff` shows only line removals (no additions, no whitespace-only changes elsewhere).
- `npx tsc --noEmit` exits 0.
- Modified files still parse (no orphaned `,` or `;` from the removal).
  </verify>
  <done>
Every duplicate export site removed; type-check clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Commit atomically, then run build + test gate</name>
  <files>(no file changes; commit only)</files>
  <action>
Per CONTEXT.md "Commit cadence" — commit FIRST (the commit is the batch boundary), then run the gate, then recover via `git revert` if red.

Step 1 — Commit the removals atomically:

```bash
git add {modified files}
git commit -m "chore(40): remove duplicate exports

Removed per 40-KNIP-DECISIONS.md:
- {file}:{line} {symbol}
- ...

Audit log: .planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md"
```

Step 2 — Run the build + test gate AFTER the commit:

1. `npm run build` — MUST exit 0.
2. `npx vitest run` — failing count MUST be <=1.

Step 3 — Outcome:

- **If green:** push immediately. Verify Vercel deploy green. Continue to Plan 05.

- **If red:** `git revert HEAD --no-edit` to undo the commit cleanly (preserves history per CONTEXT.md). Edit `40-KNIP-DECISIONS.md` to flip the offending entry from Plan 04 REMOVE list to KEEP list with rationale `"build/test failure: {error}"`. Re-run knip if needed to confirm the reduced scope, then re-attempt the batch from Task 1 with the trimmed REMOVE list (a fresh commit). Document the revert + KEEP flip in DECISIONS.md.
  </action>
  <verify>
- `git log -1 --oneline` shows the chore commit.
- Vercel deploy green.
- `npx knip` shows the duplicate-exports category trending toward zero (KEEP residue is expected).
  </verify>
  <done>
Atomic chore commit landed. Plan 05 can proceed.
  </done>
</task>

</tasks>

<verification>
- Single `chore(40): remove duplicate exports` commit on `main`.
- `next build` and `vitest run` watermark held.
- DECISIONS.md updated if any flips occurred.
</verification>

<success_criteria>
- Surgical line-level removals only.
- Build + test gate green.
- Atomic commit.
</success_criteria>

<output>
After completion, create `.planning/phases/40-dead-code-audit/40-04-SUMMARY.md` listing:
- Each duplicate export removed (file:line symbol)
- Any KEEP flips
- Files touched
- Confirmation Vercel deploy green
</output>
