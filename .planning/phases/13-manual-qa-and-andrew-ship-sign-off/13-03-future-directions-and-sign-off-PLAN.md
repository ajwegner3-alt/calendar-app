---
phase: 13-manual-qa-and-andrew-ship-sign-off
plan: "13-03"
type: execute
wave: 3
depends_on: ["13-02"]
files_modified:
  - FUTURE_DIRECTIONS.md
  - .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md
autonomous: false

must_haves:
  truths:
    - "QA-15 satisfied: FUTURE_DIRECTIONS.md at the repo root is UPDATED IN PLACE (not re-created) with a new `## 8. v1.1 Phase 13 — Marathon QA + Carry-overs` section appended after existing §7. v1.0 §1–§7 content is preserved verbatim. Existing §1 Known Limitations / §3 Future Improvements / §4 Technical Debt receive incremental v1.1-flagged bullets only where new facts emerged from marathon QA"
    - "FUTURE_DIRECTIONS.md updates honor the existing audience invariant (§How to Use This File): future Claude Code sessions, NOT humans, NOT marketing. Bullets are fact statements with `Source:` citations (file path + line OR commit SHA OR `13-CHECKLIST.md` row reference). No marketing language. v2 reference stays NAME + BOUNDARY only — no architectural detail, no capabilities outline (per existing CONTEXT.md / 09-03 lock)"
    - "Every DEFERRED row from `13-CHECKLIST.md` (QA-09..QA-13 + the QA-12 12-cell sub-table + 3 email cells + Deferred-Check-Replays section) is propagated as a bullet in FUTURE_DIRECTIONS.md §8 with verbatim Andrew reason citation"
    - "Every FAIL row from `13-CHECKLIST.md` that was NOT closed via quick-patch loop during 13-02 is propagated as a bullet in FUTURE_DIRECTIONS.md §1 Known Limitations (or §4 Technical Debt if root cause is debt) with `Source: 13-CHECKLIST.md row [QA-NN]` citation. FAIL rows that WERE quick-patched are propagated as bullets in §6 Commit Reference (the patch SHA is recorded)"
    - "Re-deferred scope items (EMAIL-08 SPF/DKIM/DMARC + mail-tester; QA-01..QA-06 v1.0 marathon items already deferred to v1.2) are explicitly listed as v1.2 backlog bullets in FUTURE_DIRECTIONS.md §8 — sourced from ROADMAP scope-NOT-in-Phase-13 lock, NOT from 13-CHECKLIST.md (since they were never exercised)"
    - "v1.2 backlog items already captured in `STATE.md` Session Continuity (hourly cron flip after Vercel Pro upgrade; rate_limit_events test DB cleanup; DROP accounts.chrome_tint_intensity post v1.1; remove chromeTintToCss compat export; live cross-client email QA Outlook desktop / Apple Mail iOS / Yahoo) are appended to FUTURE_DIRECTIONS.md §8 with `Source: STATE.md Session Continuity` citation"
    - "Test artifact cleanup decision is RECORDED in `13-CHECKLIST.md` Test Artifacts Created section AND in FUTURE_DIRECTIONS.md §8: Andrew chose KEEP (for v1.2 regression) or DELETE (immediate soft-delete via Profile Danger Zone / SQL) or SOFT-DELETE-DEFERRED (mark for v1.2 cleanup cron). Per RESEARCH.md Open Question 1 + Pitfall 6: capture decision but execute it ONLY AFTER QA-14 sign-off so any live re-test during Andrew's review doesn't lose state"
    - "QA-14 satisfied: Andrew's explicit verbatim 'ship v1.1' (or equivalent — 'approved', 'sign off', 'ship it') is captured in `13-CHECKLIST.md` § Sign-off section with: ISO timestamp + timezone, Andrew's actual phrasing in quotes, the sign-off commit SHA referenced (populated post-commit), and an explicit confirmation checkbox that Andrew reviewed both 13-CHECKLIST.md AND FUTURE_DIRECTIONS.md §8 before signing off"
    - "Milestone close-out: `STATE.md` updated to mark Phase 13 = ✓ COMPLETE with sign-off date + sign-off commit SHA. v1.1 marked SHIPPED. Session Continuity carried-concerns list is reconciled (items closed in marathon get crossed off; items deferred to v1.2 get migrated to a `## v1.2 backlog` section). `ROADMAP.md` Phase 13 status updated to COMPLETE"
    - "All 4 sections mandated by Andrew's global CLAUDE.md (Known Limitations / Assumptions & Constraints / Future Improvements / Technical Debt) are present in FUTURE_DIRECTIONS.md after this plan's update — they already exist as §1–§4 from v1.0 sign-off. The Phase 13 update is INCREMENTAL: append new bullets to §1, §3, §4 where Phase 13 surfaced new facts; §2 likely unchanged"
    - "FUTURE_DIRECTIONS.md is committed AND pushed BEFORE Andrew's sign-off is captured (Pitfall: FUTURE_DIRECTIONS.md drift if not committed before the sign-off git tag). Sign-off entry then references the prior commit SHA in §6 Commit Reference"
  artifacts:
    - path: "FUTURE_DIRECTIONS.md"
      provides: "Briefing document for future Claude Code sessions — v1.1 sign-off carry-overs appended"
      contains: "## 8. v1.1 Phase 13"
    - path: ".planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md"
      provides: "Final Sign-off section with Andrew's verbatim phrasing + timestamp + commit SHA + cleanup decision"
      contains: "ship v1.1"
    - path: ".planning/STATE.md"
      provides: "Phase 13 marked COMPLETE; v1.1 marked SHIPPED; Session Continuity carried-concerns reconciled into v1.2 backlog"
      contains: "Phase 13"
    - path: ".planning/ROADMAP.md"
      provides: "Phase 13 status updated to COMPLETE"
      contains: "Phase 13"
  key_links:
    - from: "FUTURE_DIRECTIONS.md (each new §8 bullet)"
      to: "Source row in 13-CHECKLIST.md OR commit SHA OR STATE.md Session Continuity line"
      via: "Inline `Source:` citation per existing audience invariant"
      pattern: "Source:"
    - from: "FUTURE_DIRECTIONS.md"
      to: "Future Claude Code sessions"
      via: "Repo-root .md read after CLAUDE.md per Andrew's global CLAUDE.md instructions"
      pattern: "How to Use This File"
    - from: "13-CHECKLIST.md § Sign-off entry"
      to: "Phase 13 sign-off git commit"
      via: "Sign-off commit SHA recorded in checklist after `docs(13): Andrew sign-off — v1.1 shipped` is committed + pushed"
      pattern: "Sign-off commit"
    - from: "STATE.md v1.2 backlog section"
      to: "FUTURE_DIRECTIONS.md §8 v1.2 backlog bullets"
      via: "Mirror enumeration — every v1.2 backlog line in STATE.md must have a corresponding bullet in §8 (or be explicitly retired)"
      pattern: "v1.2"
---

<objective>
Author the v1.1 update to FUTURE_DIRECTIONS.md (QA-15), capture Andrew's explicit ship sign-off (QA-14), and close out the v1.1 milestone in project tracking artifacts (STATE.md, ROADMAP.md, MILESTONE_V1_1_DEFERRED_CHECKS.md).

Purpose: When a future Claude Code session opens this repo to work on v1.2 (or to debug a v1.1 production issue), FUTURE_DIRECTIONS.md is the second file read after CLAUDE.md. It must reflect what v1.1 marathon QA actually found — every PASS qualifier, every DEFERRED reason, every test artifact left in production, every re-deferred scope item — so that future Claude does not waste context re-discovering what Phase 13 already learned. Without this update, the file would still claim v1.0 sign-off as the latest state, hiding all 5 v1.1 capability phases (10, 11, 12, 12.5, 12.6) plus the marathon QA outcome.

Output: A committed + pushed FUTURE_DIRECTIONS.md with §8 appended; a committed + pushed 13-CHECKLIST.md with § Sign-off populated; STATE.md / ROADMAP.md / MILESTONE_V1_1_DEFERRED_CHECKS.md updated to reflect v1.1 SHIPPED. v1.1 is officially closed.

**Task-count note:** This plan has 5 tasks (mirrors Phase 9 Plan 09-03 pattern of: read inventory → author → commit → sign-off → close-out). Tasks 1, 2, 5 are autonomous (Claude reads, writes, commits, pushes). Task 3 is `checkpoint:human-action` (Andrew's verbatim sign-off — non-automatable, no CLI exists for "Andrew says ship it"). Task 4 is autonomous (post-sign-off close-out). Plan is `autonomous: false` because Task 3 is human-required and gates Tasks 4–5.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md
@.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-RESEARCH.md
@.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
@.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-01-SUMMARY.md
@.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-02-SUMMARY.md
@.planning/phases/09-manual-qa-and-verification/09-03-future-directions-and-sign-off-PLAN.md
@FUTURE_DIRECTIONS.md
@CLAUDE.md
</context>

<pitfalls>
The following pitfalls are mirrored from `13-RESEARCH.md` and Phase 9 Plan 09-03 — every Task below has explicit defenses against them:

### Pitfall A: Signing off before all FAIL or DEFERRED items are reconciled
**What goes wrong:** Andrew says "ship it" while a 13-CHECKLIST.md row is still in an ambiguous state (not PASS, not DEFERRED, not FAILED-AND-PATCHED).
**Defense:** Task 1 produces a 100%-coverage table where every QA-09..QA-13 row + every QA-12 sub-cell has a definitive disposition (PASS / DEFERRED-with-reason / FAILED-AND-PATCHED-with-SHA). Task 3 `<how-to-verify>` requires Andrew to confirm this coverage explicitly before saying "ship v1.1".

### Pitfall B: FUTURE_DIRECTIONS.md drift if committed AFTER sign-off
**What goes wrong:** Andrew signs off; THEN FUTURE_DIRECTIONS.md gets committed; the sign-off `commit_sha` referenced in 13-CHECKLIST.md does NOT actually contain the v1.1 §8 update — future Claude reading at that SHA sees v1.0 state.
**Defense:** Strict ordering: Task 1 → Task 2 (commit + push FUTURE_DIRECTIONS.md FIRST) → Task 3 (Andrew sign-off, capturing the ALREADY-LANDED §8 commit's SHA in 13-CHECKLIST.md § Sign-off `Sign-off commit:` field) → Task 4 (commit + push the populated checklist). The §8 commit and the sign-off commit are two distinct commits; both are referenced in §6 Commit Reference of FUTURE_DIRECTIONS.md (the second SHA gets retroactively appended in Task 4 if needed).

### Pitfall C: FUTURE_DIRECTIONS.md REWRITTEN instead of UPDATED, losing v1.0 §1–§7 content
**What goes wrong:** Claude treats FUTURE_DIRECTIONS.md as a new file; existing v1.0 entries (§1–§7) get clobbered. Future Claude opens repo and sees v1.1 state but loses all v1.0 institutional memory.
**Defense:** Task 1 explicit `<action>` directive: READ existing FUTURE_DIRECTIONS.md (242 lines) END TO END FIRST. Use Edit tool / append-only patches. NEW v1.1 content lives in a NEW `## 8. v1.1 Phase 13` section appended after §7. Incremental v1.1 facts in §1, §3, §4 are appended as NEW bullets WITH `(v1.1)` parenthetical labels — existing v1.0 bullets are NOT touched. Verify by post-write `wc -l` count: must be GREATER than the pre-edit 242 lines.

### Pitfall D: v1.2/v2 capabilities leak into FUTURE_DIRECTIONS.md
**What goes wrong:** Claude documents v1.2 architecture or feature shape in §8 (e.g., "v1.2 should add real-time presence using Supabase Realtime channels with..."). This violates the v2 boundary lock from Phase 9 CONTEXT and creates roadmap drift.
**Defense:** Task 1 `<action>` rule: v1.2/v2 backlog bullets are NAME + BOUNDARY ONLY. Allowed shape: "Hourly cron flip after Vercel Pro upgrade — currently `0 13 * * *` daily on Hobby. (v1.2 backlog.)" NOT allowed shape: "v1.2 will introduce a multi-region cron orchestration layer using..." If a bullet describes HOW v1.2 will solve something, REJECT it; reduce to just the outcome name.

### Pitfall E: Test artifacts cleaned up DURING the sign-off review (RESEARCH.md Pitfall 6 carry-over)
**What goes wrong:** Andrew, while reviewing 13-CHECKLIST.md, opens the dashboard and cancels the QA-11 capacity-test bookings to "tidy up." Subsequent QA re-tests during the review (e.g., he wants to re-confirm QA-12 surface 4 email rendering) fail because the test event_type is now in a different state.
**Defense:** Task 3 `<resume-signal>` instructions DO NOT include cleanup. Task 4 (post-sign-off close-out) is the FIRST place cleanup may occur, and even there it is gated on Andrew's explicit cleanup-decision (KEEP / DELETE / SOFT-DELETE-DEFERRED) recorded in Task 3. The cleanup execution itself is NOT part of Phase 13 — it's documented as either complete-now or v1.2 cron candidate.

### Pitfall F: STATE.md / ROADMAP.md / MILESTONES status not synchronized → future planner confusion
**What goes wrong:** STATE.md says Phase 13 ✓ but ROADMAP.md still shows Phase 13 IN PROGRESS, or vice versa. Future `/gsd:plan-phase` for v1.2 reads conflicting state.
**Defense:** Task 4 is a single batched update that touches STATE.md, ROADMAP.md, and MILESTONE_V1_1_DEFERRED_CHECKS.md (marking the deferred-checks file as REPLAYED + closed) in one commit. Final verification: `grep -i "phase 13" .planning/STATE.md .planning/ROADMAP.md` — both must say COMPLETE / SHIPPED.
</pitfalls>

<tasks>

<task type="auto">
  <name>Task 1: Read carry-over inventory + author FUTURE_DIRECTIONS.md §8 + incremental updates to §1/§3/§4</name>
  <files>
    FUTURE_DIRECTIONS.md
  </files>
  <action>
    **Step 1 — Read sources end-to-end (in order). Do NOT skim.**

    1. `FUTURE_DIRECTIONS.md` (existing 242-line file at repo root) — to understand audience invariant from §How to Use This File, the §6 Commit Reference shape, the §7 v1.1 Phase 10 carry-over precedent (which is the structural template for §8), and the v2 name+boundary lock. Note line count for post-write verification.
    2. `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md` — every PASS / FAIL / DEFERRED row, every QA-12 sub-table cell, every Deferred-Check-Replays outcome, every Test Artifact captured. This is the primary inventory.
    3. `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-02-SUMMARY.md` — the marathon execution narrative; cross-check that SUMMARY's deferrals match CHECKLIST deferrals.
    4. `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-01-SUMMARY.md` — pre-flight outcome (Test User 3 provisioning, branding profiles applied, NSI mark swap, etc.). 13-01 results that need carry-over (e.g., if NSI mark wasn't swapped and emails shipped with placeholder, that's a §1 Known Limitation).
    5. `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md` — full deferred-check inventory (21 items across Phases 10/11/12/12.5/12.6). Cross-reference against the Deferred-Check-Replays section of 13-CHECKLIST.md to identify ANY item that was NOT replayed during marathon — those become §8 bullets.
    6. `.planning/STATE.md` Session Continuity carried-concerns + v1.2 backlog list — every item already flagged for v1.2 must appear in §8 v1.2 backlog list (mirror enumeration).
    7. `.planning/ROADMAP.md` Phase 13 section "Scope NOT in Phase 13" lock — EMAIL-08, QA-01..QA-06 must be listed as re-deferred to v1.2 in §8.
    8. `.planning/REQUIREMENTS.md` lines containing QA-14, QA-15 verbatim — to confirm exact wording for `<verify>` block of this task.
    9. `CLAUDE.md` (repo root) — to re-confirm the 4 mandated FUTURE_DIRECTIONS sections (Known Limitations / Assumptions & Constraints / Future Improvements / Technical Debt). All 4 already exist as §1–§4 in the existing file.

    **Step 2 — Build a 100%-coverage carry-over table (Claude scratch; not written to file).**

    For each of the following, decide disposition:

    | Source | Disposition |
    |--------|-------------|
    | Each QA-09..QA-13 row in 13-CHECKLIST.md | PASS / FAIL-quick-patched (note SHA) / DEFERRED (note reason) |
    | Each of the 12 cells in QA-12 surface × account sub-table | PASS / DEFERRED |
    | Each of the 3 email cells in QA-12 sub-table | PASS / DEFERRED |
    | Each row in 13-CHECKLIST.md Deferred-Check-Replays section (10 source items from MILESTONE_V1_1_DEFERRED_CHECKS.md) | REPLAYED-PASS / REPLAYED-DEFERRED / NOT-REPLAYED-LOG-AS-V1.2 |
    | Each row in 13-CHECKLIST.md Test Artifacts Created section | KEEP / DELETE / SOFT-DELETE-DEFERRED (Andrew's decision recorded — see Task 3 captures this if not already in checklist) |
    | Each line in STATE.md v1.2 backlog | MIGRATE-TO-§8-V1.2-BACKLOG (always) |
    | Each item in ROADMAP.md "Scope NOT in Phase 13" (EMAIL-08, QA-01..QA-06) | LIST-AS-RE-DEFERRED-V1.2 (always) |

    Every PASS row is a ship-confidence data point and goes into Task 2's commit message; PASS rows do NOT need a §8 bullet (file would bloat). Every non-PASS row MUST become a bullet in §8 OR §1 OR §4.

    **Step 3 — Write the file (append-only; do NOT clobber existing content).**

    Open `FUTURE_DIRECTIONS.md` with the Read tool first (mandatory before Edit). Then use Edit tool to apply the following changes:

    **Change 1 — Update §How to Use This File header line(s)** to reflect that v1.1 sign-off has occurred:

    Change the line `**Test status at sign-off:** 131 passing + 1 skipped = 132 total (16 test files; npm test 2026-04-27)` to ALSO include the v1.1 sign-off line below it (do NOT delete the v1.0 line):
    ```
    **Test status at v1.0 sign-off:** 131 passing + 1 skipped = 132 total (npm test 2026-04-27)
    **Test status at v1.1 sign-off:** [populate from 13-02-SUMMARY.md or a fresh `npm test` run if SUMMARY doesn't have it] (npm test [DATE])
    ```
    Update the Source-of-truth chain line: APPEND `; v1.1 row-level enumeration: 13-CHECKLIST.md`.

    **Change 2 — Append v1.1 bullets to §1 Known Limitations** (only if marathon surfaced new ones).

    For each FAIL-not-quick-patched row from 13-CHECKLIST.md AND each DEFERRED row that represents a true product limitation (NOT a testing-artifact deferral), append a bullet to §1 in the form:
    ```
    - **[short label] (v1.1).** [fact statement].
      - Source: `13-CHECKLIST.md` row [QA-NN] OR `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-02-SUMMARY.md`
      - Reason deferred: [verbatim Andrew note from checklist]
    ```
    Existing v1.0 bullets are NOT touched. The `(v1.1)` parenthetical is the diff marker.

    **Change 3 — Append v1.1 bullets to §3 Future Improvements** (always — at minimum, the STATE.md v1.2 backlog items + RESEARCH.md re-deferred items).

    Append the following bullets (de-duplicate against any v1.0 entries already present):
    ```
    - **Hourly cron flip after Vercel Pro upgrade (v1.1.x → v1.2).** v1.1 ships `0 13 * * *` daily on Hobby tier; flip to `0 * * * *` after Pro upgrade.
      - Source: STATE.md Session Continuity v1.2 backlog list.
    - **`rate_limit_events` test DB cleanup (v1.2).** 4 transient `bookings-api.test.ts` failures attributable to test DB rate-limit residue.
      - Source: STATE.md Session Continuity v1.2 backlog list.
    - **DROP `accounts.chrome_tint_intensity` after v1.1 release window (v1.2).** Phase 12.5 leftover column; safe to drop once no rollback path is needed.
      - Source: STATE.md Session Continuity Phase 12.5 line.
    - **Remove `chromeTintToCss` compat export (v1.2).** Only Phase 12.5 tests still import it.
      - Source: STATE.md Session Continuity Phase 12.5 line.
    - **Live cross-client email QA: Outlook desktop, Apple Mail iOS, Yahoo (v1.2).** Re-deferred from v1.0 + v1.1.
      - Source: STATE.md Session Continuity v1.2 backlog list; existing §1 / §5 entries.
    - **EMAIL-08 SPF/DKIM/DMARC + mail-tester (v1.2).** Re-deferred from Phase 13 ROADMAP scope-NOT-in-Phase-13.
      - Source: ROADMAP.md Phase 13 Scope NOT in Phase 13 lock.
    - **QA-01..QA-06 v1.0 marathon items (v1.2).** Re-deferred. Includes: live email-client validation across Gmail/Outlook (QA-01..02), mail-tester ≥9/10 (QA-03), DST cross-timezone live E2E (QA-04), responsive 320/768/1024 hosted+embed (QA-05), multi-tenant UI walkthrough (QA-06).
      - Source: ROADMAP.md Phase 13 Scope NOT in Phase 13 lock + existing §3 v1.0 entries (already partially captured; ensure not duplicated).
    ```
    For each bullet, **respect Pitfall D**: name + boundary only. NO architectural prescription.

    **Change 4 — Append v1.1 bullets to §4 Technical Debt** (only if marathon surfaced new debt).

    For each FAIL-quick-patched row in 13-CHECKLIST.md, append a bullet to §4:
    ```
    - **[short label] (v1.1, FIXED in marathon).** [fact statement of what was wrong + what fix shipped].
      - Source: commit `[SHA from 13-CHECKLIST.md]`; `13-CHECKLIST.md` row [QA-NN]
    ```
    If marathon found NO new technical debt (clean PASS run), append a single line: `*(No new technical debt surfaced in v1.1 Phase 13 marathon.)*`

    **Change 5 — Append §6 Commit Reference v1.1 entries.**

    Append (do NOT replace v1.0 entries):
    ```
    - **v1.1 sign-off commit:** _populated by Plan 13-03 Task 4_
    - **Plan 13-03 FUTURE_DIRECTIONS.md commit:** _this commit's SHA after add + commit_
    - **Plan 13-02 closure commit:** [SHA from 13-02-SUMMARY.md]
    - **Plan 13-01 closure commit:** [SHA from 13-01-SUMMARY.md]
    - **Phase 12.6 final commit (last v1.1 runtime-source):** `2dc5ae1` (per gitStatus at Phase 13 start) OR successor if 13-02 quick-patches landed.
    - **Tests green at v1.1 sign-off:** [N passing + M skipped] (`npm test` [DATE])
    ```

    **Change 6 — Append the v1.1 Phase 13 carry-over section AFTER §7, BEFORE the trailing `*v1 sign-off:` line.**

    Use the skeleton from `13-RESEARCH.md` "FUTURE_DIRECTIONS.md §8 Skeleton" verbatim as the structural template. Required content:

    ```markdown
    ---

    ## 8. v1.1 Phase 13 — Marathon QA + Carry-overs

    *Added [DATE], Plan 13-03. Items deferred from Phase 13 marathon QA to v1.2 backlog.*

    ### 8.1 Marathon QA outcomes (QA-09..QA-13)

    [For each QA-NN row that was NOT a clean PASS: one bullet with verbatim Andrew reason + Source citation. Format:]
    - **QA-NN [name] — DEFERRED.** [verbatim Andrew note]
      - Source: `13-CHECKLIST.md` row QA-NN.
      - Recommended v1.2 action: [if obvious from context, else "TBD"].

    [For QA-12 specifically, also enumerate any sub-cell deferrals:]
    - **QA-12 sub-cell — Account [A/B/C] × Surface [1/2/3/4] DEFERRED.** [reason]
      - Source: `13-CHECKLIST.md` QA-12 sub-table.

    ### 8.2 Phase 10/11/12/12.5/12.6 deferred-check replay outcomes

    [For each row in 13-CHECKLIST.md Deferred-Check-Replays that was NOT-REPLAYED-LOG-AS-V1.2: one bullet:]
    - **[Source phase / item] — NOT replayed during marathon.**
      - Source: `13-CHECKLIST.md` Deferred-Check-Replays row; `MILESTONE_V1_1_DEFERRED_CHECKS.md` [section].
      - Reason: [from checklist].
      - Recommended v1.2 action: [if known].

    ### 8.3 Test artifacts persisting in production

    [Andrew's cleanup decision recorded in Task 3 dictates the wording here:]
    - **[KEEP] [DELETE] [SOFT-DELETE-DEFERRED] decision: [Andrew's choice].**
      - Throwaway QA-09 signup user: [email/slug] (auth.users id [UUID]; accounts row [slug]).
      - QA-11 capacity-test bookings: [count] bookings on event_type [id] with booker emails [list].
      - QA-12 brandtest bookings: [count] bookings across 3 accounts.
      - Cleanup procedure (if KEEP or SOFT-DELETE-DEFERRED): documented for v1.2 cleanup cron candidacy. Soft-delete via Profile Danger Zone OR direct SQL DELETE on bookings WHERE booker_email LIKE '%phase13%' OR '%cap[1-3]%' OR '%brandtest%'.
      - Source: `13-CHECKLIST.md` Test Artifacts Created section + § Sign-off cleanup decision row.

    ### 8.4 v1.2 backlog items captured during v1.1

    *(Mirror enumeration of STATE.md v1.2 backlog list. Each bullet is name + boundary only — Pitfall D.)*

    - Hourly cron flip after Vercel Pro upgrade. (Currently `0 13 * * *` daily on Hobby.)
    - `rate_limit_events` test DB cleanup (4 transient bookings-api.test.ts failures).
    - DROP `accounts.chrome_tint_intensity` after v1.1 release window.
    - Remove `chromeTintToCss` compat export.
    - Live cross-client email QA: Outlook desktop, Apple Mail iOS, Yahoo. (Already in §3; cross-listed here as v1.2 explicit.)
    - EMAIL-08 SPF/DKIM/DMARC + mail-tester. (Re-deferred per ROADMAP scope-NOT-in-Phase-13.)
    - QA-01..QA-06 v1.0 marathon items. (Re-deferred per ROADMAP scope-NOT-in-Phase-13.)
    - Hard-delete cron purge. (From v1.0 §3; cross-listed here for v1.2 prioritization since v1.1 added more soft-deleted rows.)
    ```

    Replace `[DATE]` with the actual date (`date +%Y-%m-%d`).

    **Style invariants** (audit before declaring done):
    - Every non-trivial bullet has a `Source:` citation (file path + line OR commit SHA OR `13-CHECKLIST.md` row reference).
    - No marketing language anywhere (`seamless`, `robust`, `best-in-class`, `powerful`, etc.) — grep the new content for these strings before saving.
    - v2/v1.2 references stay name+boundary only — NO architectural detail, NO capabilities outline.
    - Existing v1.0 §1–§7 content is byte-for-byte preserved (verify by line-count delta: new file should be GREATER than 242 lines).
  </action>
  <verify>
    1. `wc -l FUTURE_DIRECTIONS.md` returns a count GREATER than the pre-edit baseline (was 242 lines per gitStatus context). New content was APPENDED, not replaced.
    2. `grep -c "^## " FUTURE_DIRECTIONS.md` returns >= 8 (the file now has at least 8 top-level sections — original 7 + new §8). Section headers are stable.
    3. `grep -E "(seamless|robust|best-in-class|powerful|amazing|cutting-edge)" FUTURE_DIRECTIONS.md` returns ZERO matches. No marketing language slipped in.
    4. `grep -A1 "## 8\." FUTURE_DIRECTIONS.md` shows the new §8 section with the dated `*Added [DATE]...*` line.
    5. `grep "^- " FUTURE_DIRECTIONS.md | grep -v "Source:" | wc -l` — count of non-source bullets. Should equal count of `Source:` references roughly 1:1 (each fact bullet has a source). Manual spot-check that no NEW bullet (introduced in this task) is missing a `Source:`.
    6. **Backlog cross-check (Claude-executed, BLOCKING):** Build a side-by-side coverage table in `<verify>` output showing:
       | Source row | Where in FUTURE_DIRECTIONS.md |
       |------------|-------------------------------|
       | Every QA-NN DEFERRED in 13-CHECKLIST.md | §8.1 bullet OR §1 bullet |
       | Every NOT-REPLAYED row in Deferred-Check-Replays | §8.2 bullet |
       | Every line in STATE.md v1.2 backlog | §8.4 OR §3 bullet |
       | Every Test Artifact row | §8.3 disposition recorded |
       | EMAIL-08 / QA-01..QA-06 | §8.4 |
       Any row WITHOUT a destination → return to `<action>` and add the missing entry.
    7. `git diff FUTURE_DIRECTIONS.md` shows ONLY additions (no `-` deletions on existing v1.0 content lines, except the §How to Use This File "Test status at sign-off" line which is renamed to "Test status at v1.0 sign-off" + a new "v1.1 sign-off" line added).
    8. The file is NOT yet committed (Task 2 commits).
  </verify>
  <done>
    FUTURE_DIRECTIONS.md is on disk (uncommitted), v1.0 §1–§7 preserved, new §8 + incremental v1.1 bullets in §1/§3/§4/§6 added, every carry-over has a destination, no marketing language, no v1.2 architecture leak.
  </done>
</task>

<task type="auto">
  <name>Task 2: Commit + push FUTURE_DIRECTIONS.md to origin/main BEFORE sign-off (closes QA-15 alone)</name>
  <files>
    FUTURE_DIRECTIONS.md
  </files>
  <action>
    Strict ordering — Pitfall B defense. The §8 commit MUST land BEFORE Andrew's sign-off entry references it.

    1. `git status` — confirm only `FUTURE_DIRECTIONS.md` is staged-modifiable (no stray edits to other files).
    2. `git add FUTURE_DIRECTIONS.md`.
    3. Commit using HEREDOC pattern per CLAUDE.md global instructions:
       ```
       git commit -m "$(cat <<'EOF'
       docs(13): FUTURE_DIRECTIONS.md update for v1.1 sign-off

       Append §8 v1.1 Phase 13 — Marathon QA + Carry-overs.
       Incremental v1.1 bullets in §1 Known Limitations / §3 Future Improvements /
       §4 Technical Debt / §6 Commit Reference. v1.0 §1–§7 preserved verbatim.

       Closes QA-15 (FUTURE_DIRECTIONS.md updated with v1.1 carry-overs).

       Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
       EOF
       )"
       ```
    4. `git push origin main`.
    5. Capture the commit SHA: `git log -1 --format=%H`. Hold this SHA in memory — it gets backfilled into FUTURE_DIRECTIONS.md §6 Commit Reference (via the placeholder `_this commit's SHA after add + commit_` in Change 5 above) — but DO NOT do that backfill yet; it would create a "chicken-and-egg" amend cycle. The placeholder is acceptable for the sign-off commit; if Andrew demands the actual SHA in §6 before signing off, do an in-place Edit + amend in a follow-up patch within Task 4 (post-sign-off).
    6. Confirm Vercel auto-deploy starts (it's a docs-only change but Vercel still rebuilds; deploy must go GREEN before Task 3 — otherwise a deploy regression could hide IN the §8 commit and we'd be signing off blind).
       ```
       # Wait for Vercel deploy
       npx vercel ls calendar-app --json 2>/dev/null | head -20
       # Or: open Vercel Dashboard → Deployments → wait for latest to read "Ready"
       ```
       If Vercel deploy fails or times out (>5 min for a docs-only change is suspect): pause and investigate before proceeding to Task 3.
  </action>
  <verify>
    1. `git log --oneline -1` shows the new commit at HEAD with subject `docs(13): FUTURE_DIRECTIONS.md update for v1.1 sign-off`.
    2. `git log origin/main -1 --format=%H` matches local HEAD — push succeeded.
    3. Vercel dashboard shows latest deploy = GREEN (Ready state). The commit SHA on Vercel matches `git log -1 --format=%H`.
    4. `curl -I https://calendar-app-xi-smoky.vercel.app/` returns 200 — production responding. (FUTURE_DIRECTIONS.md is repo-root markdown, doesn't affect runtime, but smoke-check that deploy didn't break anything.)
    5. The captured SHA is held in memory for Task 3 reference (Andrew's sign-off § Sign-off entry references this SHA).
  </verify>
  <done>
    FUTURE_DIRECTIONS.md §8 is in production repo and Vercel deploy is GREEN. QA-15 is closed (FUTURE_DIRECTIONS.md updated with v1.1 carry-overs). Sign-off can now safely reference this commit.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Andrew explicit verbatim "ship v1.1" sign-off + test artifact cleanup decision (closes QA-14)</name>
  <what-needed>
    Per ROADMAP QA-14: "Andrew's explicit ship sign-off captured in `13-CHECKLIST.md` (Phase 13 echo of QA-08 from v1.0). Verbatim phrasing — 'ship v1.1' or equivalent — recorded with timestamp + commit SHA reference."

    What Claude has prepared for Andrew to review BEFORE sign-off:
    - `13-CHECKLIST.md` fully populated by 13-02 marathon: every QA-09..QA-13 row has PASS / FAIL-quick-patched / DEFERRED with reason; QA-12 12-cell sub-table populated; Deferred-Check-Replays section populated; Test Artifacts Created section listing every test row that exists in production.
    - `FUTURE_DIRECTIONS.md` §8 committed in Task 2 (SHA: [from Task 2 step 5]) — every DEFERRED in checklist propagated as a §8.1 bullet; every NOT-REPLAYED in deferred-checks propagated as §8.2 bullet; v1.2 backlog enumerated in §8.4.
    - Test suite: [N passing + M skipped] (`npm test` [DATE] — capture from Task 1 read of 13-02-SUMMARY.md or run fresh).
    - Production deploy: GREEN at SHA [Task 2 captured SHA].

    What Andrew needs to do:
    1. Read 13-CHECKLIST.md end-to-end. Confirm every row has a definitive disposition (no ambiguous blanks).
    2. Read FUTURE_DIRECTIONS.md §8 (and skim §1 / §3 / §4 v1.1 additions). Confirm no surprises — everything Andrew is aware of as deferred is captured; nothing is overstated.
    3. Decide test artifact cleanup posture: KEEP (preserve for v1.2 regression) / DELETE (immediate cleanup post-sign-off) / SOFT-DELETE-DEFERRED (mark for future v1.2 cron candidate).
    4. Say the words "ship v1.1" (or equivalent — "approved", "sign off", "ship it", "let's ship it").
  </what-needed>
  <how-to-verify>
    **CLAUDE PROPOSES (sign-off review session):**

    Andrew, please review the following in order:

    **Step 1 — Open `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md`.**

    Confirm:
    - [ ] Every row in "Marathon Criteria" table (QA-09..QA-13) has Status = PASS or DEFERRED (with reason in Notes) or FAILED-AND-PATCHED (with patch SHA in Notes).
    - [ ] Every cell in "QA-12 Sub-table" (3 accounts × 4 surfaces = 12 cells, plus 3 email cells = 15 total) has a definitive value (not blank, not `__`).
    - [ ] "Deferred Check Replays" section: every row has an outcome (REPLAYED-PASS / REPLAYED-DEFERRED / NOT-REPLAYED-LOGGED-V1.2).
    - [ ] "Test Artifacts Created" section: every test row that exists in production is enumerated (throwaway signup user, capacity-test bookings, brandtest bookings).
    - [ ] No qualified-PASS row reads as unqualified PASS. (Pitfall A defense — e.g., if QA-10 was marked PASS only after Andrew confirmed 6 of 7 surfaces and the 7th was DEFERRED, the row should read "PASS (6/7 surfaces; reminders surface DEFERRED — see Notes)" — never bare "PASS".)

    **Step 2 — Open `FUTURE_DIRECTIONS.md` (repo root).**

    Confirm:
    - [ ] §8 exists and is dated today.
    - [ ] §8.1 captures every DEFERRED row from the checklist verbatim.
    - [ ] §8.3 will record Andrew's cleanup decision (placeholder; populated below in Step 3).
    - [ ] §8.4 v1.2 backlog list looks correct — name+boundary only, no architectural prescription.
    - [ ] §1 / §3 / §4 retain v1.0 bullets unchanged; new bullets are tagged `(v1.1)`.
    - [ ] §6 Commit Reference references the Task 2 commit SHA: [INSERT SHA HERE during session].

    **Step 3 — Test artifact cleanup decision.**

    Andrew, choose ONE for the test artifacts left by marathon QA (throwaway signup, ~6+ test bookings):
    - **A) KEEP** — preserve all test data in production. Useful for v1.2 regression checks but slowly grows production data noise. FUTURE_DIRECTIONS.md §8.3 records this as "KEEP — to be cleaned up by v1.2 hard-delete cron candidate."
    - **B) DELETE** — immediate cleanup AFTER sign-off via Profile Danger Zone soft-delete + SQL DELETE for bookings. Cleanest production state. Adds Task 4.5 (sub-task) to execute the cleanup. Downside: if a v1.1 production issue surfaces in next 30 days that requires the test data, it's gone.
    - **C) SOFT-DELETE-DEFERRED** — mark all test rows with `deleted_at = now()` post-sign-off (use existing soft-delete path), but do NOT hard-delete. v1.2 hard-delete cron will purge eventually. Hybrid posture; recommended default.

    Andrew states verbatim: `cleanup decision: [A | B | C]`.

    **Step 4 — Sign-off statement.**

    Andrew states verbatim: `ship v1.1` (or equivalent — "approved", "sign off", "ship it", "let's ship it").

    **CLAUDE ON RECEIVING SIGN-OFF:**

    Append the following to `13-CHECKLIST.md` § Sign-off section (replace the placeholder block):

    ```markdown
    ## Sign-off

    - [x] Andrew reviewed `13-CHECKLIST.md` end-to-end (all 5 marathon criteria + 15 sub-cells + Deferred-Check-Replays + Test Artifacts Created).
    - [x] Andrew reviewed `FUTURE_DIRECTIONS.md` §8 (and §1 / §3 / §4 v1.1 additions).
    - [x] Test artifact cleanup decision: **[A KEEP | B DELETE | C SOFT-DELETE-DEFERRED]** — [verbatim Andrew rationale if provided, else "no rationale stated"].
    - [x] Andrew explicit verbal sign-off: "[verbatim Andrew phrasing — e.g., 'ship v1.1']"
    - **Sign-off timestamp:** YYYY-MM-DD HH:MM CT (record current `date -Iseconds` ISO-8601 + Andrew's local timezone label "America/Chicago" → "CT")
    - **Sign-off commit:** `[populated post-commit in Task 4 step 3]`
    - **FUTURE_DIRECTIONS.md §8 commit:** `[Task 2 captured SHA]`
    ```

    DO NOT commit yet — Task 4 is the commit step. Hold the populated checklist on disk; Task 4 commits + pushes + backfills the sign-off SHA.

    **ON FAIL** (Andrew not willing to sign off): drop into a quick-patch loop (read affected file → fix → commit → push → wait for Vercel deploy → ask Andrew to re-verify the SAME blocker). Sign-off does NOT proceed until Andrew is satisfied. If the blocker is a FUTURE_DIRECTIONS.md content gap (§8 missing a deferral, etc.), edit FUTURE_DIRECTIONS.md, commit + push under message `docs(13): FUTURE_DIRECTIONS.md §8 amendment per Andrew review`, then return here.
  </how-to-verify>
  <resume-signal>
    Type EITHER:
    - `cleanup decision: [A | B | C]` AND `ship v1.1` (or equivalent verbatim phrasing — "approved", "sign off", "ship it", "let's ship it") — to proceed to Task 4 final close-out.
    - OR list the specific items still blocking sign-off (e.g., "blocker: §8.2 missing replay for Phase 11 11-06") so Claude can quick-patch and return to this checkpoint.
  </resume-signal>
</task>

<task type="auto">
  <name>Task 4: Commit signed-off 13-CHECKLIST.md + propagate cleanup decision into FUTURE_DIRECTIONS.md §8.3 + close-out STATE.md / ROADMAP.md / MILESTONE_V1_1_DEFERRED_CHECKS.md</name>
  <files>
    .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
    FUTURE_DIRECTIONS.md
    .planning/STATE.md
    .planning/ROADMAP.md
    .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md
  </files>
  <action>
    **Step 1 — Backfill cleanup decision into FUTURE_DIRECTIONS.md §8.3.**

    Use Edit tool to replace the §8.3 KEEP/DELETE/SOFT-DELETE-DEFERRED placeholder line with Andrew's actual choice from Task 3, including the rationale (if stated) and the test row enumeration from `13-CHECKLIST.md` Test Artifacts Created section. Example output:
    ```markdown
    ### 8.3 Test artifacts persisting in production

    - **Cleanup decision: SOFT-DELETE-DEFERRED.** [Andrew rationale if stated]
      - Throwaway QA-09 signup user: ajwegner3+phase13signup@gmail.com (auth.users id [UUID]; accounts row slug=phase13-test).
      - QA-11 capacity-test bookings: 3 bookings on event_type [id] (booker emails: ajwegner3+cap1@gmail.com, ajwegner3+cap2@gmail.com, ajwegner3+cap3@gmail.com).
      - QA-12 brandtest bookings: 3 bookings across nsi / nsi-rls-test / nsi-rls-test-3 (booker emails: ajwegner3+brandtest-{a,b,c}@gmail.com).
      - Cleanup procedure: post-sign-off Andrew runs Profile Danger Zone soft-delete on the throwaway signup user. Bookings remain associated with their event_types and are eligible for v1.2 hard-delete cron purge. SQL fallback: `UPDATE bookings SET status='cancelled', cancelled_at=now() WHERE booker_email LIKE '%phase13%' OR booker_email LIKE 'ajwegner3+cap%' OR booker_email LIKE 'ajwegner3+brandtest%';`
      - Source: `13-CHECKLIST.md` Test Artifacts Created section + § Sign-off cleanup decision row.
    ```

    **Step 2 — Update STATE.md to mark Phase 13 COMPLETE + v1.1 SHIPPED.**

    Locate STATE.md "Current Phase / Position" line (the field that says where the project is in the roadmap). Update to reflect Phase 13 = ✓ COMPLETE.
    Locate STATE.md "Session Continuity" or equivalent — append a v1.1 sign-off entry:
    ```markdown
    ## v1.1 Sign-Off (2026-04-29 [or actual sign-off date])

    - Phase 13 marathon QA + Andrew sign-off COMPLETE.
    - Sign-off commit: [populated below in Step 3].
    - FUTURE_DIRECTIONS.md §8 commit: [Task 2 captured SHA].
    - Test status: [N passing + M skipped] (`npm test` [DATE]).
    - Production deploy: GREEN at SHA [Task 2 captured SHA + sign-off SHA succession].
    - Cleanup decision: [A KEEP | B DELETE | C SOFT-DELETE-DEFERRED] (executed [post-sign-off | as part of Task 4 / per Andrew | TBD]).
    ```
    Reconcile carried-concerns: any concern that was resolved by Phase 13 marathon (e.g., "Phase 12.6 NSI mark swap pending" if Andrew confirmed it landed in 13-01) gets crossed off / removed; any remaining concern gets migrated under a new `## v1.2 Backlog` header — mirror the §8.4 enumeration.

    **Step 3 — Update ROADMAP.md Phase 13 section header to COMPLETE.**

    Find `### Phase 13:` (or equivalent header). Append `— ✓ COMPLETE 2026-04-29 (sign-off commit [TBD])` to the header line. Do NOT modify Phase 13 plan list, scope, or success criteria — they are historical record. Just flip the status indicator.

    **Step 4 — Update MILESTONE_V1_1_DEFERRED_CHECKS.md to REPLAYED.**

    Read the file's existing top-matter (per gitStatus: 290-line file with 21 deferred items). Append a closing block at the bottom:
    ```markdown
    ---

    ## v1.1 REPLAY COMPLETE — 2026-04-29 (sign-off commit [TBD])

    All 21 deferred manual checks have been replayed during Phase 13 marathon QA OR explicitly logged as v1.2 carry-overs. Authoritative outcome record: `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md` Deferred-Check-Replays section. v1.1 carry-overs to v1.2: `FUTURE_DIRECTIONS.md` §8.

    This file is now historical record only. Future sessions reading this file should also read `13-CHECKLIST.md` and `FUTURE_DIRECTIONS.md` §8 for current status.
    ```

    **Step 5 — Stage + commit + push (single batched commit).**

    ```bash
    git status  # confirm exact files changed: 13-CHECKLIST.md, FUTURE_DIRECTIONS.md, STATE.md, ROADMAP.md, MILESTONE_V1_1_DEFERRED_CHECKS.md
    git add \
      .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md \
      FUTURE_DIRECTIONS.md \
      .planning/STATE.md \
      .planning/ROADMAP.md \
      .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md
    ```

    Commit using HEREDOC pattern (CLAUDE.md global instructions):
    ```
    git commit -m "$(cat <<'EOF'
    docs(13): Andrew sign-off — v1.1 shipped

    Closes QA-14 (Andrew explicit verbatim ship sign-off) and Phase 13.

    - 13-CHECKLIST.md § Sign-off populated with Andrew verbatim phrasing,
      ISO timestamp, cleanup decision, and FUTURE_DIRECTIONS.md §8 commit reference.
    - FUTURE_DIRECTIONS.md §8.3 cleanup decision backfilled.
    - STATE.md: Phase 13 ✓ COMPLETE; v1.1 SHIPPED; carried-concerns reconciled
      into v1.2 backlog.
    - ROADMAP.md: Phase 13 status flipped to COMPLETE.
    - MILESTONE_V1_1_DEFERRED_CHECKS.md: REPLAY COMPLETE block appended;
      file now historical record.

    v1.1 is officially shipped.

    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
    EOF
    )"
    git push origin main
    ```

    **Step 6 — Backfill the sign-off commit SHA into 13-CHECKLIST.md and STATE.md and ROADMAP.md and MILESTONE_V1_1_DEFERRED_CHECKS.md.**

    Capture: `SIGN_OFF_SHA=$(git log -1 --format=%H)`.

    Use Edit tool on each of the 4 files to replace `[TBD]` / `[populated below in Step 3]` / `[populated post-commit in Task 4 step 3]` placeholders with `$SIGN_OFF_SHA`. Then a SECOND commit:
    ```
    git add \
      .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md \
      .planning/STATE.md \
      .planning/ROADMAP.md \
      .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md
    git commit -m "$(cat <<'EOF'
    docs(13): backfill sign-off commit SHA references

    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
    EOF
    )"
    git push origin main
    ```

    **Step 7 — Optional: archive a v1.1 milestone roadmap snapshot.**

    Per Phase 9 v1.0 precedent (if `.planning/milestones/v1.0-ROADMAP.md` exists in the repo), mirror the pattern:
    ```bash
    mkdir -p .planning/milestones
    if [ -f .planning/milestones/v1.0-ROADMAP.md ]; then
      cp .planning/ROADMAP.md .planning/milestones/v1.1-ROADMAP.md
      git add .planning/milestones/v1.1-ROADMAP.md
      git commit -m "docs(13): archive v1.1-ROADMAP.md snapshot at sign-off"
      git push origin main
    else
      echo "No v1.0-ROADMAP.md milestone archive precedent — skipping v1.1 archive (per RESEARCH.md optional task)."
    fi
    ```
    This is conditionally optional; do NOT fail the task if the precedent doesn't exist.
  </action>
  <verify>
    1. `grep "Sign-off commit:" .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md` returns a line with a real 40-char SHA (not `[TBD]`).
    2. `grep "Phase 13" .planning/STATE.md` shows COMPLETE / SHIPPED markers.
    3. `grep "Phase 13" .planning/ROADMAP.md` shows COMPLETE marker on the phase header line.
    4. `grep "REPLAY COMPLETE" .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md` returns the v1.1 closing block.
    5. `grep "Cleanup decision:" FUTURE_DIRECTIONS.md` returns Andrew's chosen letter (KEEP / DELETE / SOFT-DELETE-DEFERRED) — NO `[A KEEP | B DELETE | C SOFT-DELETE-DEFERRED]` placeholder remains.
    6. `git log --oneline | head -5` shows both Task 4 commits at the top of main (`docs(13): Andrew sign-off — v1.1 shipped` and `docs(13): backfill sign-off commit SHA references`).
    7. `git log origin/main -1 --format=%H` matches local HEAD — push succeeded.
    8. Vercel deploy GREEN (docs-only changes; should pass instantly).
    9. **Final consistency check:** `grep -c "Phase 13" .planning/ROADMAP.md .planning/STATE.md` — both files mention Phase 13 in COMPLETE state. NO file says "Phase 13 IN PROGRESS" or "Phase 13 PENDING" anywhere (Pitfall F defense).
  </verify>
  <done>
    13-CHECKLIST.md § Sign-off is committed with real sign-off SHA. STATE.md / ROADMAP.md / MILESTONE_V1_1_DEFERRED_CHECKS.md reflect v1.1 SHIPPED. FUTURE_DIRECTIONS.md §8.3 has Andrew's cleanup decision recorded. All consistent. v1.1 is officially closed.
  </done>
</task>

<task type="auto">
  <name>Task 5: Final smoke + 13-03-SUMMARY.md authoring + Phase 13 close-out artifact</name>
  <files>
    .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-03-SUMMARY.md
  </files>
  <action>
    **Step 1 — Smoke production one final time.**

    ```bash
    curl -I https://calendar-app-xi-smoky.vercel.app/  # 200
    curl -I https://calendar-app-xi-smoky.vercel.app/nsi  # 200 (account page)
    curl -I https://calendar-app-xi-smoky.vercel.app/app/login  # 200 (login)
    ```
    All three must return 200. If any returns non-200, this is a v1.1-shipped production regression and Andrew must be notified immediately — do NOT fail the task silently. Open a `BLOCKER: post-sign-off production smoke regression` notice in 13-03-SUMMARY.md AND 13-CHECKLIST.md.

    **Step 2 — Run the test suite one final time.**

    ```bash
    npm test 2>&1 | tail -20
    ```
    Capture: total passing, total skipped, total failing. Compare against expected baseline from 13-02-SUMMARY.md. If regressions appeared post-sign-off, log in 13-03-SUMMARY.md but do NOT block (sign-off has occurred; failures here become a v1.1.x patch consideration).

    **Step 3 — Author 13-03-SUMMARY.md.**

    Use the standard SUMMARY template (mirrors the structure used by prior phase summaries in `.planning/phases/*/`). Required sections:
    - Frontmatter: phase, plan: "13-03", tasks_completed, tasks_deferred, deviations (if any), affects (other phases this plan touches via STATE.md / ROADMAP.md), tech-stack (added: [], removed: []), commit_sha (the sign-off SHA).
    - **Outcome:** v1.1 SHIPPED. Andrew sign-off captured at [timestamp]. Cleanup decision: [A/B/C].
    - **What changed:**
      - FUTURE_DIRECTIONS.md updated: +§8 (Phase 13 carry-overs), incremental v1.1 bullets in §1/§3/§4/§6.
      - 13-CHECKLIST.md § Sign-off populated.
      - STATE.md: Phase 13 ✓; v1.1 SHIPPED; v1.2 backlog migrated.
      - ROADMAP.md: Phase 13 status COMPLETE.
      - MILESTONE_V1_1_DEFERRED_CHECKS.md: REPLAY COMPLETE block appended.
    - **What is now true** (from must_haves.truths): tick off each one.
    - **Carry-overs to v1.2:** mirror §8.4 enumeration (name only).
    - **Test artifacts left in production:** mirror §8.3 disposition.
    - **Production status:** Vercel GREEN at SHA [sign-off SHA]; final smoke 200 on /, /nsi, /app/login; tests [N passing + M skipped].
    - **Phase 13 commit chain:** list all Phase 13 commits in chronological order (13-01 closure, 13-02 closure, FUTURE_DIRECTIONS.md update, sign-off, SHA backfill, optional v1.1-ROADMAP archive).
    - **Recommended next steps:** "v1.1 is shipped. Future sessions: read CLAUDE.md → FUTURE_DIRECTIONS.md (now contains v1.0 + v1.1 carry-overs) → STATE.md → ROADMAP.md before proposing v1.2 work."

    **Step 4 — Commit + push 13-03-SUMMARY.md.**

    ```bash
    git add .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-03-SUMMARY.md
    git commit -m "$(cat <<'EOF'
    docs(13-03): complete future-directions-and-sign-off plan

    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
    EOF
    )"
    git push origin main
    ```
  </action>
  <verify>
    1. `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-03-SUMMARY.md` exists.
    2. SUMMARY frontmatter `commit_sha:` matches the Task 4 sign-off SHA.
    3. SUMMARY's "What is now true" section ticks off ALL must_haves.truths bullets from this plan's frontmatter.
    4. `git log --oneline | head -10` shows the Phase 13 commit chain ending with this SUMMARY commit.
    5. `git log origin/main -1 --format=%H` matches local HEAD — push succeeded.
    6. Vercel deploy GREEN.
    7. Production smoke (/, /nsi, /app/login) all 200.
  </verify>
  <done>
    Phase 13 is fully closed: SUMMARY exists, all artifacts committed + pushed, Vercel GREEN, production smoke clean. v1.1 ship is documented end-to-end.
  </done>
</task>

</tasks>

<verification>
- FUTURE_DIRECTIONS.md exists at repo root with §1–§8 (v1.0 §1–§7 byte-for-byte preserved; new §8 v1.1 Phase 13 appended; incremental v1.1 bullets in §1/§3/§4/§6).
- 13-CHECKLIST.md § Sign-off section populated with Andrew verbatim phrasing, ISO timestamp, cleanup decision, sign-off commit SHA, FUTURE_DIRECTIONS.md §8 commit SHA.
- STATE.md: Phase 13 ✓ COMPLETE; v1.1 SHIPPED; carried-concerns reconciled into v1.2 backlog.
- ROADMAP.md: Phase 13 header flipped to COMPLETE with sign-off date + commit SHA.
- MILESTONE_V1_1_DEFERRED_CHECKS.md: REPLAY COMPLETE block appended; file is now historical.
- Every QA-09..QA-13 DEFERRED row from 13-CHECKLIST.md is propagated to FUTURE_DIRECTIONS.md §8.1 with verbatim Andrew reason.
- Every NOT-REPLAYED row from Deferred-Check-Replays is propagated to §8.2.
- Every Test Artifact has a disposition recorded in §8.3.
- v1.2 backlog (STATE.md + RESEARCH.md re-deferred items + ROADMAP scope-NOT-in-Phase-13 items) is enumerated in §8.4 — name + boundary only.
- All commits pushed to origin/main; Vercel deploy GREEN.
- Production smoke (/, /nsi, /app/login) returns 200 on all three.
- 13-03-SUMMARY.md exists with full Phase 13 commit chain.
</verification>

<success_criteria>
- All Plan 13-03 must_haves.truths satisfied (cross-checked in 13-03-SUMMARY.md).
- ROADMAP success criteria QA-14 (Andrew sign-off) and QA-15 (FUTURE_DIRECTIONS.md updated) are PASS in 13-CHECKLIST.md.
- v1.1 is officially shipped.
- Future Claude Code sessions opening this repo will read CLAUDE.md, then FUTURE_DIRECTIONS.md (which now reflects v1.0 + v1.1 state correctly), then proceed to v1.2 planning with accurate state.
- All 6 files modified by this plan (FUTURE_DIRECTIONS.md, 13-CHECKLIST.md, STATE.md, ROADMAP.md, MILESTONE_V1_1_DEFERRED_CHECKS.md, 13-03-SUMMARY.md) are committed + pushed; Vercel deploy GREEN.
</success_criteria>

<output>
After completion, the file `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-03-SUMMARY.md` will exist (created in Task 5) and document the Phase 13 close-out + v1.1 ship.
</output>
