---
phase: 40-dead-code-audit
plan: 08
type: execute
wave: 8
depends_on: ["40-07"]
files_modified:
  - .planning/phases/40-dead-code-audit/40-V17-FINAL-QA.md
autonomous: false

must_haves:
  truths:
    - "Phase 38 A-D regressions all PASS on production (booking.nsintegrations.com)"
    - "Phase 39 A-C regressions all PASS on production"
    - "V15-MP-05 Turnstile lifecycle lock holds in regression test (BookingForm absent pre-pick, persists across same-date re-pick)"
    - "Magic-link enumeration safety holds (unknown-email vs. real-email response identical)"
    - "5/hr/IP+email rate-limit silently throttles (no 4xx error surfaced)"
    - "220ms fade+rise animation observed on first slot pick; CLS = 0"
    - "Static skeleton renders pre-pick on desktop AND mobile (no false loading spinner)"
    - "prefers-reduced-motion suppresses animation cleanly"
    - "All results captured in 40-V17-FINAL-QA.md with PASS / FAIL per item + Andrew's observations"
  artifacts:
    - path: ".planning/phases/40-dead-code-audit/40-V17-FINAL-QA.md"
      provides: "v1.7 milestone ship-gate evidence"
      contains: "Phase 38 A-D + Phase 39 A-C"
  key_links:
    - from: "40-V17-FINAL-QA.md"
      to: "Phase 38 + Phase 39 success criteria"
      via: "regression re-run on production"
      pattern: "PASS|FAIL"
---

<objective>
Re-run the Phase 38 A-D + Phase 39 A-C regression checks on production (`booking.nsintegrations.com`) AFTER the dead-code removals land. This is the v1.7 milestone ship-gate per CONTEXT.md "Final v1.7 QA scope (after removals land)" — not a separate phase, but the final check before milestone close.

Purpose: Confirm Plans 03-07 did not regress any production behavior shipped earlier in v1.7.
Output: `40-V17-FINAL-QA.md` with PASS/FAIL per regression item + Andrew sign-off.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/40-dead-code-audit/40-CONTEXT.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold the QA tracking document</name>
  <files>.planning/phases/40-dead-code-audit/40-V17-FINAL-QA.md</files>
  <action>
Create `.planning/phases/40-dead-code-audit/40-V17-FINAL-QA.md` with the following structure (do NOT fill in results yet — Andrew populates them in Task 2):

```markdown
# Phase 40: Final v1.7 Production QA

**Production URL:** https://booking.nsintegrations.com
**Run date:** _____ (Andrew fills)
**Performed by:** Andrew
**Pre-flight:** All Plans 40-03 through 40-07 deployed to production

---

## Phase 38: Magic-Link Auth Regressions

### A. Magic-link enumeration safety
**What to test:** Submit magic-link form on `/app/login` with (1) a real registered email and (2) a never-registered email. Both must produce identical UI (success message), no error surfaced for unknown email.
**Expected:** Identical responses — neither reveals account existence.
**Result:** _____ (PASS / FAIL)
**Notes:** _____

### B. 5/hr/IP+email rate-limit silently throttles
**What to test:** Submit magic-link form 6+ times with the same email within an hour. The 6th+ attempt must return success UI silently (no 429 error surfaced).
**Expected:** No surfaced error; bucket exhausts internally; user sees identical success.
**Result:** _____ (PASS / FAIL)
**Notes:** _____

### C. Supabase ~60s inner cooldown
**What to test:** Submit magic-link 2-3 times within 60s. Note delivery: only 1-2 emails actually arrive due to Supabase's per-email cooldown. UI is still success.
**Expected:** Feature, not bug. Strengthens enumeration-safety contract.
**Result:** _____ (PASS / FAIL)
**Notes:** _____

### D. End-to-end magic-link delivery + Site URL correctness
**What to test:** Submit magic-link with a real email, click the link in the delivered email. Confirm CTA link points to `https://booking.nsintegrations.com` (NOT localhost). Confirm sign-in completes and lands on the post-auth page.
**Expected:** CTA URL is the production domain; clicking it logs the user in.
**Result:** _____ (PASS / FAIL)
**Notes:** _____

---

## Phase 39: BOOKER Polish Regressions

### A. 220ms fade+rise animation on first slot pick (CLS = 0)
**What to test:** On a public event page (e.g., `https://booking.nsintegrations.com/nsi/<slug>`), pick a date, then pick a time slot. The booking form column should fade in + rise ~220ms. Open Chrome DevTools Performance panel and verify CLS = 0.0 during the animation.
**Expected:** Smooth animation; CLS = 0.
**Result:** _____ (PASS / FAIL)
**Notes:** _____

### B. Static skeleton renders pre-pick (desktop + mobile)
**What to test:** Land on the public event page. Pick a date but NO time slot yet. Confirm the form column shows the static `BookingFormSkeleton` (8 shape-only `bg-muted` blocks) — NOT a loading spinner, NOT empty white space, NOT pulsing animation. Test both desktop (>=1024px) and mobile (<768px).
**Expected:** Static placeholder visible on both viewports.
**Result:** _____ (PASS / FAIL)
**Notes:** _____

### C. prefers-reduced-motion suppresses animation cleanly
**What to test:** Enable OS reduced-motion (Windows: Settings → Accessibility → Visual effects → Animation effects OFF; macOS: System Settings → Accessibility → Display → Reduce Motion). Reload the page, pick a slot. The form should appear immediately with NO animation.
**Expected:** Form shows instantly when motion is reduced; no transition.
**Result:** _____ (PASS / FAIL)
**Notes:** _____

### Bonus regression: V15-MP-05 Turnstile lifecycle lock + RHF persistence
**What to test:** On a slot-picked form, type in name + email, then pick a DIFFERENT slot on the same date. Form should NOT remount (typed values persist, Turnstile token persists). Then change the DATE — form SHOULD unmount (this is by design for V15-MP-05).
**Expected:** Same-date re-pick: persists. Date change: unmounts.
**Result:** _____ (PASS / FAIL)
**Notes:** _____

---

## Sign-off

- [ ] All Phase 38 A-D rows PASS
- [ ] All Phase 39 A-C rows PASS (+ bonus V15-MP-05 regression)
- [ ] Andrew: _____ (signature / date)

---

## Decision

- [ ] PROCEED — All regressions PASS. v1.7 ready to close (Plan 09: `/gsd:complete-milestone`).
- [ ] BLOCK — One or more regressions FAIL. Investigation required before milestone close. (Failure → spawn a gap-closure phase or revert offending commit.)
```

Commit the scaffold:

```bash
git add .planning/phases/40-dead-code-audit/40-V17-FINAL-QA.md
git commit -m "chore(40-08): scaffold v1.7 final-QA tracking doc"
```
  </action>
  <verify>
- `40-V17-FINAL-QA.md` exists with all sections (Phase 38 A-D, Phase 39 A-C, V15-MP-05 bonus, Sign-off, Decision).
- Every result cell is `_____` (placeholder).
- File committed.
  </verify>
  <done>
QA scaffold ready for Andrew to fill in.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Andrew runs the QA on production and fills in results</name>
  <what-built>
The QA scaffold at `.planning/phases/40-dead-code-audit/40-V17-FINAL-QA.md` covering Phase 38 A-D + Phase 39 A-C + V15-MP-05 bonus regression.
  </what-built>
  <how-to-verify>
1. Open `https://booking.nsintegrations.com` in a fresh browser session (incognito recommended for clean state).
2. Walk through each test in `40-V17-FINAL-QA.md` in order. For each:
   - Read "What to test"
   - Perform the action
   - Compare against "Expected"
   - Mark `Result: PASS` or `Result: FAIL`
   - Add observations to `Notes` if anything noteworthy (especially for FAIL — describe what you saw vs. what was expected)
3. After all rows complete:
   - Check the "All Phase 38 A-D rows PASS" / "All Phase 39 A-C rows PASS" boxes if applicable
   - Add your signature + date
   - Check `PROCEED` if everything PASS, or `BLOCK` with notes on failures
4. Save the file.
5. If everything PASS: type `qa passed` to continue to Plan 09 (milestone close).
6. If anything FAIL: type `qa failed` and describe the failure(s); decide together with Claude whether to revert the offending commit, spawn a gap-closure plan, or accept-with-known-issue.
  </how-to-verify>
  <resume-signal>Type "qa passed" or "qa failed: {description}"</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Commit final QA results and prepare for milestone close</name>
  <files>.planning/phases/40-dead-code-audit/40-V17-FINAL-QA.md</files>
  <action>
After Andrew's "qa passed" signal:

1. Re-read `40-V17-FINAL-QA.md` and confirm:
   - Every Result cell is `PASS` (or has documented FAIL with explicit Andrew acceptance — but in that case the user should have signaled "qa failed" not "qa passed").
   - Sign-off section has Andrew's signature + date.
   - PROCEED is checked.

2. Commit:

```bash
git add .planning/phases/40-dead-code-audit/40-V17-FINAL-QA.md
git commit -m "docs(40-08): v1.7 final QA results — all PASS

Phase 38 A-D regressions: PASS
Phase 39 A-C regressions: PASS
V15-MP-05 Turnstile lifecycle + RHF persistence: PASS

Production: booking.nsintegrations.com
Performed by: Andrew
v1.7 ready for milestone close (Plan 09)."
```

3. Push.

If "qa failed" was signaled: STOP. Do NOT commit a "passed" message. Surface the failure(s) to Andrew, decide on remediation (revert / gap closure / known-issue waiver), and update the plan file accordingly. Plan 09 cannot run until v1.7 is actually green.
  </action>
  <verify>
- Commit landed with all-PASS message body.
- `40-V17-FINAL-QA.md` is the locked record of the v1.7 ship gate.
  </verify>
  <done>
v1.7 production QA green; Plan 09 (milestone close) can proceed.
  </done>
</task>

</tasks>

<verification>
- All Phase 38 A-D rows PASS.
- All Phase 39 A-C rows PASS.
- V15-MP-05 bonus regression PASS.
- File committed.
</verification>

<success_criteria>
- 40-V17-FINAL-QA.md fully populated with PASS results.
- Andrew sign-off captured.
- v1.7 cleared for milestone close.
</success_criteria>

<output>
After completion, create `.planning/phases/40-dead-code-audit/40-08-SUMMARY.md` summarizing:
- Each row's pass/fail
- Any observations from Andrew worth capturing for future phases
- Confirmation v1.7 is ready for `/gsd:complete-milestone`
</output>
