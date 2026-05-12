---
phase: 46-andrew-ship-sign-off
plan: "46-05"
type: execute
wave: 4
depends_on: ["46-04"]
files_modified:
  - .planning/STATE.md
autonomous: false
must_haves:
  truths:
    - "All Phase 46 archival artifacts (46-VERIFICATION.md status=passed, FUTURE_DIRECTIONS.md v1.8 section, milestones/v1.8-ROADMAP.md, ROADMAP.md collapsed) are committed before `git tag -a v1.8.0` is created"
    - "The v1.8.0 tag is an ANNOTATED tag (matching v1.0..v1.7 pattern) — `git cat-file -t v1.8.0` returns `tag` not `commit`"
    - "The tag is placed on the final archival commit (the one that lands all 46-04 outputs + 46-VERIFICATION.md passed flip + STATE.md update)"
    - "STATE.md is updated to reflect v1.8 SHIPPED + Phase 46 completed + the v1.8.0 tag SHA"
    - "Tag message follows the v1.0..v1.7 annotated-tag body convention (summary line + multi-line accomplishments + `See .planning/MILESTONES.md for full details.` footer)"
  artifacts:
    - path: ".planning/STATE.md"
      provides: "Final v1.8 SHIPPED status with Phase 46 completion details and tag reference"
      contains: "v1.8 SHIPPED"
  key_links:
    - from: "git tag v1.8.0"
      to: "Final Phase 46 archival commit"
      via: "`git tag -a v1.8.0 -m '<annotated message>'`"
      pattern: "v1.8.0"
    - from: ".planning/STATE.md"
      to: "v1.8 milestone completion record"
      via: "STATE.md narrative update at top"
      pattern: "v1.8 SHIPPED|v1.8.0"
---

<objective>
Final ship step: commit all Phase 46 archival artifacts, flip 46-VERIFICATION.md `status: passed` if not already done, update STATE.md to reflect v1.8 shipped, then create the annotated `v1.8.0` git tag on the resulting commit. Andrew may prefer to run the tag command himself — this plan surfaces that as a checkpoint.

Purpose: An annotated tag is the irreversible ship signal. It must sit on a commit that contains EVERY archival artifact. Once tagged + pushed, v1.8 is shipped.

Output: A commit (or 1-2 commits) landing all archival changes, an annotated v1.8.0 tag on the head of that work, and a STATE.md update.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/46-andrew-ship-sign-off/46-CONTEXT.md
@.planning/phases/46-andrew-ship-sign-off/46-RESEARCH.md
@.planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md
@.planning/phases/46-andrew-ship-sign-off/46-04-SUMMARY.md

@FUTURE_DIRECTIONS.md
@.planning/milestones/v1.8-ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update STATE.md to reflect v1.8 shipped + Phase 46 completed</name>
  <files>.planning/STATE.md</files>
  <action>
Read STATE.md. Update the top of the file:

- `Last updated:` → current ISO date.
- The lead paragraph (currently "Phase 45 SHIPPED. v1.8 code-complete; only Phase 46 ... remains") → flip to "Phase 46 SHIPPED. **v1.8 milestone SHIPPED** on <signoff_at YYYY-MM-DD>. Andrew live-verified all 14 ROADMAP QA scenarios + Phase 44/45 deferred items against the nsi account on the production deployment in Stripe test mode. schema_migrations repaired for Phases 36/37/41. v1.8.0 annotated git tag created. v1.9 milestone planning unblocked."

In the "Current Position" block:
- Milestone: v1.8 → mark `✅ SHIPPED`
- Phase: 46 of 46 → mark `✅ SHIPPED`
- Remove "Phase 46 is the only remaining phase before v1.8 ships."

In the "v1.8 Phase Map" block:
- Phase 46 line → flip from `THIS PHASE` to `✅ Shipped (Andrew ship sign-off — 14 ROADMAP scenarios + rolled-up Phase 44/45 deferred items all PASS; schema_migrations repaired)`

In the "Open blockers" block:
- PREREQ-C → mark `✅ Completed during Phase 46 UAT`
- Dormant schema_migrations → mark `✅ Repaired in Phase 46-01`

Append (or update) a STATE history footer entry capturing this transition: `<date> — Phase 46 SHIPPED. v1.8 milestone closed. <one-line summary>. Tag: v1.8.0 (<sha-when-known>).`

DO NOT rewrite unrelated STATE.md sections (Locked Decisions, nsi UUID, prior milestone history).
  </action>
  <verify>
- `head -30 .planning/STATE.md` shows "Phase 46 SHIPPED" + "v1.8 milestone SHIPPED" + current date.
- `grep -n "v1.8" .planning/STATE.md` shows the milestone marked ✅ SHIPPED in at least 2 places (lead paragraph + Phase Map).
- LD-01..LD-20 and the nsi UUID line are untouched.
  </verify>
  <done>
STATE.md is the source of truth for "v1.8 is shipped, v1.9 is next."
  </done>
</task>

<task type="auto">
  <name>Task 2: Stage and commit all Phase 46 archival artifacts</name>
  <files>
    .planning/STATE.md,
    .planning/ROADMAP.md,
    .planning/milestones/v1.8-ROADMAP.md,
    FUTURE_DIRECTIONS.md,
    .planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md,
    .planning/phases/46-andrew-ship-sign-off/46-01-SUMMARY.md,
    .planning/phases/46-andrew-ship-sign-off/46-02-SUMMARY.md,
    .planning/phases/46-andrew-ship-sign-off/46-03-SUMMARY.md,
    .planning/phases/46-andrew-ship-sign-off/46-04-SUMMARY.md
  </files>
  <action>
Run `git status` first to confirm what's pending. Expect to see:
- Modified: `.planning/STATE.md`, `.planning/ROADMAP.md`, `FUTURE_DIRECTIONS.md`, `.planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md`
- New: `.planning/milestones/v1.8-ROADMAP.md`, `.planning/phases/46-andrew-ship-sign-off/46-{01,02,03,04}-SUMMARY.md`, all Phase 46 PLAN.md files (if not committed during planning)
- Possibly: any pre-existing modified files from before Phase 46 (e.g., the `.planning/phases/02/02-VERIFICATION.md` / `23/23-VERIFICATION.md` / `33/33-CONTEXT.md` modifications shown in git status at planning time — DO NOT include these in the Phase 46 commit unless they relate to v1.8)

Stage only Phase 46 + archival files explicitly by name (no `git add -A` or `git add .`):

```bash
git add .planning/STATE.md
git add .planning/ROADMAP.md
git add FUTURE_DIRECTIONS.md
git add .planning/milestones/v1.8-ROADMAP.md
git add .planning/phases/46-andrew-ship-sign-off/
```

Commit with a message capturing v1.8 closure:

```bash
git commit -m "$(cat <<'EOF'
docs(46): v1.8 milestone SHIPPED — Phase 46 sign-off complete

Phase 46: Andrew Ship Sign-Off
- 46-01: schema_migrations repaired for Phases 36/37/41
- 46-02: 46-VERIFICATION.md authored (linear UAT checklist)
- 46-03: Andrew live-verified 14 ROADMAP QA scenarios + Phase 44/45 deferred items on production against nsi in Stripe test mode (100% PASS)
- 46-04: FUTURE_DIRECTIONS.md v1.8 delta appended; milestones/v1.8-ROADMAP.md archive created; ROADMAP.md v1.8 collapsed to one-liner
- 46-05: STATE.md updated; v1.8.0 annotated tag follows on this commit

v1.8 closes: Phases 41-46 + inserted 42.5 + 42.6 (32 plans across 8 phases).
EOF
)"
```

Record the resulting commit SHA — it is the tag target for Task 3.
  </action>
  <verify>
- `git log -1 --format=%H` returns the new commit SHA.
- `git log -1` body matches the message above.
- `git status` is clean for Phase 46 files (any pre-existing `.planning/phases/02|23|33` modifications remain unstaged — those are separate).
  </verify>
  <done>
All archival artifacts are landed on a single commit ready to tag.
  </done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Task 3: Decide whether Claude or Andrew creates the v1.8.0 annotated tag</name>
  <decision>
The v1.8.0 git tag is the irreversible ship signal. Andrew may want to run the command himself, or authorize Claude to run it.
  </decision>
  <context>
All v1.0..v1.7 tags are annotated (verified in RESEARCH.md §5). The tag must:
- Be annotated (`-a` flag).
- Carry the multi-line accomplishments body matching the v1.0..v1.7 convention.
- Land on the commit from Task 2.
- Be pushed to origin so GitHub shows the release.
  </context>
  <options>
    <option id="claude-tags">
      <name>Claude creates + pushes the tag</name>
      <pros>One-step ship; no context handoff; consistent commit + tag timing.</pros>
      <cons>Andrew loses the ceremonial moment; if tag message has a typo it requires `git tag -d v1.8.0 && git push --delete origin v1.8.0` to fix.</cons>
    </option>
    <option id="andrew-tags">
      <name>Claude drafts the exact command; Andrew runs it</name>
      <pros>Andrew owns the irreversible step; he reviews the tag body before it lands; matches the "manual handoff" convention from CLAUDE.md.</pros>
      <cons>Andrew has to copy-paste a HEREDOC across a session boundary.</cons>
    </option>
  </options>
  <resume-signal>
Reply "claude-tags" (Claude runs `git tag -a` and `git push origin v1.8.0`) or "andrew-tags" (Claude prints the exact command for Andrew to paste).
  </resume-signal>
</task>

<task type="auto">
  <name>Task 4: Create + push the v1.8.0 annotated tag (or print command for Andrew)</name>
  <files>(none — git operation)</files>
  <action>
Use this exact annotated-tag command. The HEREDOC keeps single-quoted to avoid PowerShell/bash interpolation.

```bash
git tag -a v1.8.0 -m "$(cat <<'EOF'
v1.8 Stripe Paywall + Login UX Polish

Delivered: Full Stripe paywall (3-tier: Basic, Widget, Branding consult),
multi-tier Checkout + Customer Portal, widget feature gating, paywall enforcement
with locked-state UX + trial banners, Stripe-triggered transactional emails
(trial-ending + payment-failed), login UX polish (OAuth-below-Card, password-first
tab, 3-fail magic-link nudge, AUTH-29 enumeration-safety hardening), and Gmail
quota raise to 400/day.

Key accomplishments:
- Stripe SDK (stripe@22.1.1, apiVersion 2026-04-22.dahlia) with 6-event webhook + idempotency
- 4-SKU pricing (Basic-Monthly/Annual, Widget-Monthly/Annual) via single Product + Branding consult CTA
- Customer Portal cancel-at-period-end + plan-switching across all 4 Prices
- Paywall middleware in lib/supabase/proxy.ts gating /app/* only; /{account}/* structurally exempt
- Widget gating via plan_tier='widget' | subscription_status='trialing' helper on /embed/* + owner embed-code page
- past_due as non-blocking banner; trialing + active as the only allowed paywall states
- AUTH-29 four-way enumeration safety locked by test suite; AUTH-35 password-default tab
- 3-fail counter advances on credentials-only (AUTH-38); magic-link nudge pre-fills email
- Gmail quota raised 200→400/day with 80% threshold auto-deriving to 320
- schema_migrations repaired for Phases 36/37/41

See .planning/MILESTONES.md for full details.
EOF
)"

git push origin v1.8.0
```

**Branch selection (option "claude-tags"):** Run both commands as shown.

**Branch selection (option "andrew-tags"):** Print both commands to the chat verbatim, instruct Andrew to paste into a terminal at the repo root, and wait for his confirmation that the tag was created + pushed. Then Claude verifies remotely:

```bash
git fetch --tags
git cat-file -t v1.8.0
# Must return: tag (not commit)
```

After tag exists locally + remote:
- Verify tag points at the Task 2 commit SHA: `git rev-list -n 1 v1.8.0` matches.
- Verify annotated: `git cat-file -t v1.8.0` returns `tag`.

If Andrew prefers a different tag-message edit, regenerate with his amendments before pushing.
  </action>
  <verify>
- `git tag -l v1.8.0` returns `v1.8.0`.
- `git cat-file -t v1.8.0` returns `tag` (annotated, not lightweight).
- `git rev-list -n 1 v1.8.0` matches the Task 2 commit SHA.
- `git ls-remote origin refs/tags/v1.8.0` returns the tag (proves push succeeded).
  </verify>
  <done>
v1.8.0 is annotated, on the right commit, and pushed to origin. v1.8 is officially shipped.
  </done>
</task>

</tasks>

<verification>
- The annotated tag exists on the archival commit.
- STATE.md reflects v1.8 SHIPPED with the tag SHA.
- ROADMAP.md, FUTURE_DIRECTIONS.md, and milestones/v1.8-ROADMAP.md are all in their final committed state.
- 46-VERIFICATION.md status is `passed`.
- The pre-existing unrelated modifications (.planning/phases/02|23|33) are NOT included in any Phase 46 commit.
</verification>

<success_criteria>
1. `git tag -l v1.8.0` returns the tag.
2. `git cat-file -t v1.8.0` returns `tag` (annotated).
3. `git ls-remote origin refs/tags/v1.8.0` confirms remote push.
4. STATE.md and all archival files are committed.
5. Phase 46 is COMPLETE; v1.8 is SHIPPED.
</success_criteria>

<output>
After completion, create `.planning/phases/46-andrew-ship-sign-off/46-05-SUMMARY.md` per the GSD summary template noting: archival commit SHA, tag SHA, push confirmation, and final v1.8 milestone closure.
</output>
