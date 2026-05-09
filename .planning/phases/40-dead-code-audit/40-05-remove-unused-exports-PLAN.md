---
phase: 40-dead-code-audit
plan: 05
type: execute
wave: 5
depends_on: ["40-04"]
files_modified:
  - (TBD - sourced from 40-KNIP-DECISIONS.md "Unused Exports (Plan 05 target)" list)
autonomous: true

must_haves:
  truths:
    - "Every unused export listed under '### Unused Exports (Plan 05 target)' in 40-KNIP-DECISIONS.md is removed"
    - "Server actions referenced by `<form action={...}>` are NOT touched (verified by per-export grep before deletion)"
    - "`next build` exits 0 after removal"
    - "`vitest run` failing-test count remains <=1"
    - "Single chore commit `chore(40): remove unused exports` lands the change atomically"
  artifacts:
    - path: ".planning/phases/40-dead-code-audit/40-05-SUMMARY.md"
      provides: "Per-symbol removal record"
  key_links:
    - from: "40-KNIP-DECISIONS.md REMOVE list (Plan 05 target)"
      to: "export-keyword removals + dead body deletion"
      via: "surgical edit per export"
      pattern: "chore\\(40\\): remove unused exports"
---

<objective>
Surgically remove every unused export listed under "### Unused Exports (Plan 05 target)" in `40-KNIP-DECISIONS.md` — the third commit in the four-batch removal sequence. Larger blast radius than Plans 03/04 because removing an export often makes the underlying function/const/type body trivially deletable.

Purpose: Trim the public API surface area of every module to only what's actually consumed.
Output: Single `chore(40): remove unused exports` commit; build + test gate green.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md
@.planning/phases/40-dead-code-audit/40-CONTEXT.md
@.planning/phases/40-dead-code-audit/40-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Per-export verification grep + surgical removal</name>
  <files>(TBD - per 40-KNIP-DECISIONS.md Plan 05 target list)</files>
  <action>
Read `40-KNIP-DECISIONS.md` and enumerate every entry under "### Unused Exports (Plan 05 target)".

If empty, skip to summary.

**Critical pre-flight per RESEARCH.md Common Pitfalls + landmine inventory** — for each unused export, run the appropriate grep before deletion:

1. **For exports in `_lib/actions.ts` or `actions.ts` files** (server actions): grep the export name across `*-form.tsx`, `*-button.tsx`, `_components/*.tsx` siblings AND across the entire `app/` tree. Server actions are passed by reference to `<form action={fooAction}>` — the import MUST appear somewhere if used. If grep returns ANY hit, STOP and surface to Andrew (this is the kind of false-positive the methodology guards against).

2. **For named exports in lib/ or components/**: `grep -rn "{symbol}" --include="*.ts" --include="*.tsx"` — confirm zero non-self hits.

3. **For type exports**: grep for the type name in JSDoc `@type` annotations, type-only imports (`import type { X }`), generic constraints (`<T extends X>`), and re-exports.

4. **For enum members flagged as unused**: confirm no string-keyed access (`MyEnum["foo"]`) or numeric index access elsewhere.

If the grep is clean for an export, proceed with surgical removal:

- If the symbol is ONLY used by its own module after removing the `export`, delete the entire definition (function, const, type, etc.) — leaving private helpers behind that nothing uses is just creating fresh dead code for next phase.
- If the symbol IS used internally within the same file, just remove the `export` keyword (now a private declaration).
- For barrel files (`index.ts` re-exports), remove just the re-export line.

Use the Edit tool for line-level changes. Run `npx tsc --noEmit` after every ~5 removals to catch cascading type errors early — easier than debugging at the end.

**Cascade rule:** After deleting an export's body, if its imports become unused, do NOT chase them in this plan. Plan 06 (unused files) and re-running knip will surface those naturally. Stay strictly in scope.
  </action>
  <verify>
- `git diff` shows ONLY the planned removals (modified files match the DECISIONS.md target list).
- `npx tsc --noEmit` exits 0.
- For every server-action-file removal, the pre-flight grep verification result is documented inline (in the eventual SUMMARY).
  </verify>
  <done>
Every unused export removed; type-check clean.
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
git commit -m "chore(40): remove unused exports

Removed per 40-KNIP-DECISIONS.md:
- {file}:{line} {symbol}
- ...

Audit log: .planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md"
```

Step 2 — Run the build + test gate AFTER the commit:

1. `npm run build` — MUST exit 0.
2. `npx vitest run` — failing count MUST be <=1.

Step 3 — Outcome:

- **If green:** push immediately. Verify Vercel deploy green. Continue to Plan 06.

- **If red:** `git revert HEAD --no-edit` to undo the commit cleanly (preserves history per CONTEXT.md). Edit `40-KNIP-DECISIONS.md` to flip the offending export(s) to KEEP with rationale `"build/test failure: {error}"`. Granularity: try to identify the single offending export rather than reverting the whole batch (a failing tsc error usually names the symbol). If unable to bisect, flip the entire commit's batch to KEEP and surface to Andrew. Re-run knip if needed to confirm the reduced scope, then re-attempt the batch from Task 1 with the trimmed REMOVE list (a fresh commit). Document the revert + KEEP flip in DECISIONS.md.
  </action>
  <verify>
- `git log -1 --oneline` shows the chore commit.
- Vercel deploy green.
- `npx knip` shows the unused-exports category at the locked target (REMOVE list addressed; KEEP residue may remain).
  </verify>
  <done>
Atomic chore commit landed. Plan 06 can proceed.
  </done>
</task>

</tasks>

<verification>
- Single `chore(40): remove unused exports` commit on `main`.
- Pre-flight grep documented for every server-action removal.
- `next build` + `vitest run` watermark held.
- DECISIONS.md updated for any flips.
</verification>

<success_criteria>
- Surgical export removals (with body cleanup where the symbol becomes orphaned).
- Server actions in `_lib/actions.ts` files verified by sibling-grep before any removal.
- Build + test gate green.
- Atomic commit.
</success_criteria>

<output>
After completion, create `.planning/phases/40-dead-code-audit/40-05-SUMMARY.md` with:
- Per-symbol removal log (file:line, symbol, body-also-deleted yes/no)
- Pre-flight grep results for every server-action-file removal
- Any KEEP flips
- Vercel deploy confirmation
</output>
