---
phase: 40-dead-code-audit
plan: 09
type: execute
wave: 9
depends_on: ["40-08"]
files_modified:
  - .planning/milestones/v1.7-ROADMAP.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
autonomous: false

must_haves:
  truths:
    - "v1.7 milestone archived to .planning/milestones/v1.7-ROADMAP.md (mirrors v1.0-v1.6 archive pattern)"
    - "Top-level ROADMAP.md updated: v1.7 row marked shipped with date; Phases 34-40 collapsed under <details> like prior milestones"
    - "STATE.md updated: current milestone is v1.8 (or 'between milestones'); Phase 40 marked complete"
    - "v1.7 is archived to `.planning/milestones/v1.7-ROADMAP.md` (via `/gsd:complete-milestone` or manual reconciliation if the command fails)"
  artifacts:
    - path: ".planning/milestones/v1.7-ROADMAP.md"
      provides: "Archived v1.7 phase-by-phase record"
    - path: ".planning/ROADMAP.md"
      provides: "Top-level roadmap with v1.7 collapsed"
    - path: ".planning/STATE.md"
      provides: "Updated current-state record"
  key_links:
    - from: ".planning/ROADMAP.md v1.7 row"
      to: ".planning/milestones/v1.7-ROADMAP.md"
      via: "markdown link"
      pattern: "milestones/v1.7-ROADMAP.md"
---

<objective>
Run `/gsd:complete-milestone` to archive v1.7 (Phases 34-40) into `.planning/milestones/v1.7-ROADMAP.md`, update the top-level `ROADMAP.md` to mark v1.7 shipped + collapse Phases 34-40 under `<details>`, and update `STATE.md` to reflect the new current state. Mirrors the v1.0-v1.6 milestone-close pattern documented in STATE.md.

Purpose: Close v1.7 cleanly so the next milestone (v1.8 or rest period) starts with a clean slate.
Output: v1.7 archived; ROADMAP + STATE updated; commits pushed.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/40-dead-code-audit/40-V17-FINAL-QA.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew runs /gsd:complete-milestone</name>
  <what-built>
v1.7 is fully shipped and verified:
- Phases 34-40 all complete (40 includes the dead-code audit + final QA)
- 40-V17-FINAL-QA.md shows all PASS on production
- knip CI gate live on main
- All four removal commits landed (deps, dup-exports, unused-exports, unused-files)
  </what-built>
  <how-to-verify>
1. Confirm `40-V17-FINAL-QA.md` shows PROCEED checked + Andrew sign-off (Plan 08 output).
2. Confirm all four `chore(40):` commits exist on main: `git log --oneline | grep "chore(40):"`.
3. Run `/gsd:complete-milestone` (the GSD command performs the archive + ROADMAP/STATE update automatically).
4. Review the proposed archive content + ROADMAP/STATE diffs that the command surfaces.
5. Approve the changes when satisfied.
6. Type `milestone closed` to continue (or describe issues if the command surfaces something unexpected).
  </how-to-verify>
  <resume-signal>Type "milestone closed" or describe issues</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Verify archive integrity and final commit</name>
  <files>(read-only verification of files written by /gsd:complete-milestone)</files>
  <action>
After Andrew's "milestone closed" signal, verify the milestone command produced the expected artifacts:

1. `.planning/milestones/v1.7-ROADMAP.md` exists and contains Phases 34-40 sections (the format matches v1.0-v1.6 archives — read one of those for reference if uncertain).

2. `.planning/ROADMAP.md` was updated:
   - Top-level "Milestones" list shows v1.7 with a checkmark + ship date
   - The "Phases" section for Phases 34-40 is collapsed under `<details>` with link to the archive
   - Format mirrors the v1.6 collapse done previously

3. `.planning/STATE.md` was updated:
   - "Current Position" now shows v1.8 (or "between milestones" / "ready to start v1.8")
   - Phase 40 marked COMPLETE
   - "Next session — start here" updated with the next-milestone routing

4. If `/gsd:complete-milestone` did NOT produce these updates automatically (because the command's behavior may be solo-developer-tuned and not handle every edge case), do them manually following the v1.6 close pattern (cross-reference `milestones/v1.6-ROADMAP.md` and the diff between recent ROADMAP commits).

5. If everything is correct, no further commit is needed (the GSD command commits its own changes). Run `git log --oneline -5` and confirm the milestone-close commit is on top.

If any artifact is missing or malformed: surface to Andrew with the specific gap, do the manual edit, commit with message:

```
chore(40-09): finalize v1.7 milestone archive

Manual reconciliation after /gsd:complete-milestone:
- {what was missing}
- {what was added}
```
  </action>
  <verify>
- `ls .planning/milestones/v1.7-ROADMAP.md` succeeds.
- `grep -c "v1.7" .planning/ROADMAP.md` shows the milestone listed under shipped milestones (✅).
- `grep -c "v1.8\|Phase 41" .planning/STATE.md` confirms forward-looking state (or "ready to start v1.8" / "between milestones" language).
- `git log --oneline -5` includes the milestone-close commit.
  </verify>
  <done>
v1.7 archived. STATE updated. Phase 40 complete. Project ready for v1.8 planning or a rest period.
  </done>
</task>

</tasks>

<verification>
- v1.7-ROADMAP.md archive exists.
- Top-level ROADMAP shows v1.7 shipped (✅) + Phases 34-40 collapsed.
- STATE.md updated.
- All commits on main; pushed; deploy still green.
</verification>

<success_criteria>
- v1.7 milestone archived following v1.0-v1.6 pattern.
- Phase 40 marked complete.
- STATE.md reflects current position (post-v1.7).
</success_criteria>

<output>
After completion, create `.planning/phases/40-dead-code-audit/40-09-SUMMARY.md` with:
- Confirmation /gsd:complete-milestone ran successfully
- Links to archived v1.7-ROADMAP.md
- Final v1.7 stats (phases shipped, plans completed, commits, days from start to close)
- Phase 40 close-out note
</output>
