---
phase: 40-dead-code-audit
plan: 02
type: execute
wave: 2
depends_on: ["40-01"]
files_modified:
  - .planning/phases/40-dead-code-audit/40-KNIP-REPORT.md
  - .planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md
autonomous: false

must_haves:
  truths:
    - "Andrew has filled in every Decision cell in 40-KNIP-REPORT.md with REMOVE, KEEP, or INVESTIGATE"
    - "Every INVESTIGATE item has been deep-dived in-phase by Claude and converted to a final REMOVE or KEEP — phase 40 ships with zero unresolved INVESTIGATE items"
    - "40-KNIP-DECISIONS.md exists with per-category REMOVE list and KEEP list (plus rationale for each KEEP)"
  artifacts:
    - path: ".planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md"
      provides: "Final per-category REMOVE/KEEP audit log; locks the deletion scope for Plans 03-06"
      contains: "## Final REMOVE list"
  key_links:
    - from: "40-KNIP-DECISIONS.md REMOVE lists"
      to: "Plans 03-06 deletion targets"
      via: "category-keyed enumeration"
      pattern: "## Final REMOVE list"
---

<objective>
Read back Andrew's REMOVE/KEEP/INVESTIGATE decisions from `40-KNIP-REPORT.md`, deep-dive every INVESTIGATE item in-phase (never deferred), get Andrew's final call on those, and produce `40-KNIP-DECISIONS.md` — the locked deletion scope that Plans 03-06 execute against.

Purpose: Translate human review into a machine-readable contract for the four removal plans.
Output: 40-KNIP-DECISIONS.md committed; zero unresolved INVESTIGATE items.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-dead-code-audit/40-CONTEXT.md
@.planning/phases/40-dead-code-audit/40-KNIP-REPORT.md
@.planning/phases/40-dead-code-audit/40-01-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew reviews 40-KNIP-REPORT.md and fills in every Decision cell</name>
  <what-built>
The baseline report at `.planning/phases/40-dead-code-audit/40-KNIP-REPORT.md` with pre-seeded REMOVE/KEEP/INVESTIGATE recommendations for every finding (Plan 01 output).
  </what-built>
  <how-to-verify>
1. Open `.planning/phases/40-dead-code-audit/40-KNIP-REPORT.md` in your editor.
2. For every row in every section, replace the `_____` placeholder in the **Decision** column with one of `REMOVE`, `KEEP`, or `INVESTIGATE`.
3. The pre-seeded recommendation is Claude's best guess — override anywhere you disagree.
4. Save the file. (No commit yet — Claude will commit after the read-back + investigations.)
5. Type `decisions saved` (or describe issues) when done.
  </how-to-verify>
  <resume-signal>Type "decisions saved" or describe blockers</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Deep-dive every INVESTIGATE item and surface findings to Andrew</name>
  <files>(read-only investigation; updates 40-KNIP-REPORT.md only to flip INVESTIGATE → REMOVE/KEEP after Andrew re-decides)</files>
  <action>
Re-read `40-KNIP-REPORT.md` and enumerate every row with `INVESTIGATE` in the Decision cell. For each one, perform a focused investigation following the methodology from RESEARCH.md §"Pre-seeded recommendation methodology" but go deeper than the seeding pass:

For unused **files**:
- `git log --oneline --follow -- <file>` — full history; was it ever referenced and then orphaned?
- `grep -rn "<basename-without-ext>"` across `app/`, `lib/`, `tests/`, `*.config.*`, `package.json`, `vercel.json`, `supabase/seed.sql` — any string-literal hits at all?
- Check if it's a dynamic-import target: grep for `import("./<path>")` or `import("@/<path>")` patterns.
- Check if it's a route file Knip's plugin missed (e.g., a non-canonical route convention).
- Check if it's referenced by a test fixture or a comment that explains intent.

For unused **exports**:
- Grep export name across all files (case-sensitive).
- For `_lib/actions.ts` exports: grep across `*-form.tsx`, `*-button.tsx`, `_components/*.tsx` siblings — server actions are passed by reference to `<form action={...}>`, so the import must exist somewhere.
- For type exports: grep for the type name in JSDoc / type-only imports / generic constraints.

For unused **dependencies**:
- `grep -rn "from ['\"]<pkg>"` and `grep -rn "require(['\"]<pkg>"` across the whole repo.
- `grep -l "<pkg>" *.config.* eslint.config.mjs vitest.config.ts next.config.ts postcss.config.mjs tailwind.config.* package.json` — check config files specifically (RESEARCH.md Pitfall 5).
- For Supabase / dotenv / postgres / supabase CLI: check `package.json` scripts and `.github/workflows/` (will be empty pre-Plan 07).

For duplicate **exports**:
- For each duplicate, grep where each export site is consumed. The "duplicate" verdict means knip found two definitions for the same symbol — find which is the canonical one.

Append findings inline to `40-KNIP-REPORT.md` under each INVESTIGATE row in a child sub-row called "Investigation:" with a 2-3 line summary of what you found and a NEW recommendation (still REMOVE / KEEP — never re-INVESTIGATE).

Then surface to Andrew:
> "INVESTIGATE deep-dive complete. {N} items investigated. Findings written to 40-KNIP-REPORT.md inline. Please re-review and flip each INVESTIGATE row to either REMOVE or KEEP. Reply 'investigations decided' when done."

WAIT for Andrew's response. He edits the file again, replacing INVESTIGATE with REMOVE or KEEP based on your findings. After his "investigations decided" signal, re-read the file and confirm zero INVESTIGATE rows remain. If any do, return to Andrew with the offending row and re-prompt.
  </action>
  <verify>
- After Andrew's "investigations decided" reply: `grep -c "| INVESTIGATE |" .planning/phases/40-dead-code-audit/40-KNIP-REPORT.md` returns 0 (matches only pipe-delimited table cells, so the preamble word does not false-positive). What matters is no Decision cell still says INVESTIGATE.
- Every former INVESTIGATE row has a Claude "Investigation:" sub-row with a concrete finding.
  </verify>
  <done>
All INVESTIGATE items resolved to REMOVE or KEEP. Report file is the locked source of truth for Plan 03+ execution.
  </done>
</task>

<task type="auto">
  <name>Task 3: Produce 40-KNIP-DECISIONS.md as the machine-readable deletion contract</name>
  <files>.planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md</files>
  <action>
Read the now-finalized `40-KNIP-REPORT.md` and produce `40-KNIP-DECISIONS.md` with the following structure:

```markdown
# Phase 40: Knip Decisions Log

**Locked:** {date}
**Source:** 40-KNIP-REPORT.md (post-Andrew-review)

## Final REMOVE list

### Unused Dependencies (Plan 03 target)
- `{pkg-name}` — {1-line rationale from report}
- ...

### Duplicate Exports (Plan 04 target)
- `{file}:{line}` — `{symbol}` — {rationale}
- ...

### Unused Exports (Plan 05 target)
- `{file}:{line}` — `{symbol}` — {rationale}
- ...

### Unused Files (Plan 06 target)
- `{path}` — {rationale}
- ...

## Final KEEP list

(Items knip flagged that Andrew chose to keep. The CI gate (Plan 07) will fail on these unless we add them to `knip.json` `ignore` or `ignoreDependencies`. This list IS the contract for what `knip.json` ignores after Plan 06.)

### Files
- `{path}` — KEEP because: {rationale}
- ...

### Dependencies
- `{pkg-name}` — KEEP because: {rationale}
- ...

### Exports
- `{file}:{line}` `{symbol}` — KEEP because: {rationale}
- ...

## Items flipped INVESTIGATE → KEEP

(Items where Claude's investigation surfaced something the initial seeding missed. Documents WHY the static analysis was wrong so future-Claude doesn't re-flag.)

- `{path}` — Initial recommendation: REMOVE. Investigation found: {what}. Final: KEEP.
- ...

## Recovery protocol

If `next build` or `vitest run` fails after a category commit during Plans 03-06:
1. `git revert <failing-commit>` (preserves history; do NOT amend or force-push).
2. Edit this file: move the offending item from REMOVE list to KEEP list with rationale "{commit-sha} caused regression: {symptom}".
3. Continue with remaining batches.
```

Counts at the top of the file: `**Total REMOVE: N (deps: X, dup-exports: Y, unused-exports: Z, unused-files: W)** | **Total KEEP: M**`.

Commit message: `chore(40-02): lock dead-code decisions log` (single commit covering this file + the final state of 40-KNIP-REPORT.md).
  </action>
  <verify>
- `40-KNIP-DECISIONS.md` exists with all four REMOVE sub-lists (one per category — even if a sub-list is empty, write `_None._` rather than omitting the header).
- KEEP list includes `slot-picker.tsx` only if knip flagged it despite the ignore (it should NOT have).
- Total counts in the header match the sum of items in the lists.
- File is committed alongside the final 40-KNIP-REPORT.md.
  </verify>
  <done>
Plans 03-06 can execute by enumerating their respective sub-list in the REMOVE section. KEEP list is the source-of-truth for what `knip.json` will need to suppress at the end of Plan 06 so the CI gate (Plan 07) passes.
  </done>
</task>

</tasks>

<verification>
- Andrew has signed off on every finding (zero INVESTIGATE remaining).
- 40-KNIP-DECISIONS.md is machine-parseable (consistent bullet format per sub-list).
- Recovery protocol is documented in-file (not relying on memory across plan boundaries).
</verification>

<success_criteria>
- Every finding has a final REMOVE or KEEP decision.
- INVESTIGATE deep-dives written inline in the report.
- DECISIONS.md is the locked contract for Plans 03-06.
</success_criteria>

<output>
After completion, create `.planning/phases/40-dead-code-audit/40-02-SUMMARY.md` summarizing:
- Total findings reviewed
- Breakdown: REMOVE counts per category, KEEP counts, INVESTIGATE-resolved counts
- Notable KEEP rationales (e.g., "X kept because dynamic SSR usage" — feeds into Plan 07 ignore decisions)
</output>
