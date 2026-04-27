---
phase: 09-manual-qa-and-verification
plan: "09-03"
subsystem: testing
tags: [future-directions, sign-off, v1-ship, documentation, briefing, ship-v1]

# Dependency graph
requires:
  - phase: 09-manual-qa-and-verification
    provides: "Plan 09-01 pre-flight artifacts (lint baseline cleared, after()-wrapped audit-row inserts, spam-folder copy, 09-CHECKLIST.md scaffold) + Plan 09-02 closure artifacts (Apple Mail code-review LIKELY PASS verdict + 11 fact-bullets + consolidated v1.1 backlog in 09-CHECKLIST.md Deferrals section)"
provides:
  - "FUTURE_DIRECTIONS.md authored and committed to repo root (commit 5f9e725) — 213-line briefing for future Claude Code sessions: 6 required sections (How to Use This File / Known Limitations / Assumptions & Constraints / Future Improvements / Technical Debt / Commit Reference) + Untested Email Clients section + Commit Reference appendix"
  - "Andrew explicit ship sign-off captured: verbatim 'ship v1' on 2026-04-27"
  - "09-CHECKLIST.md fully closed: rows #7 + #8 PASS, sign-off section ticked, timestamp recorded"
  - "Phase 9 closed; v1.0 milestone shipped"
affects:
  - "v1.1 / next-milestone planning (consumes the 12 deferred items in FUTURE_DIRECTIONS.md as the canonical v1.1 backlog)"
  - "Future Claude Code sessions opening this repo (FUTURE_DIRECTIONS.md is the second file read after CLAUDE.md per the 'How to Use This File' contract)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FUTURE_DIRECTIONS.md as the canonical Claude-Code-session briefing artifact at repo root: fact-statement bullets, source citations (file path / line number / commit SHA / .planning/ artifact path), no marketing language, no v2 architectural detail (name + boundary statement only)"
    - "Sign-off as a first-class checklist outcome: PASS row with verbatim quote + timestamp + sign-off commit reference closes the loop without requiring a separate sign-off artifact"

key-files:
  created:
    - FUTURE_DIRECTIONS.md
    - .planning/phases/09-manual-qa-and-verification/09-03-SUMMARY.md
  modified:
    - .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
    - .planning/STATE.md

key-decisions:
  - "v1.0 milestone shipped 2026-04-27 with Andrew's explicit verbatim sign-off 'ship v1'. Plan 09-02 marathon QA scope-cut (6 marathon criteria + 9 Phase 8 dashboard sub-criteria + 6-row branding sub-table = ~21 items) deferred to v1.1, all captured in FUTURE_DIRECTIONS.md with citations back to 09-CHECKLIST.md."
  - "FUTURE_DIRECTIONS.md is structured for future Claude Code sessions (audience = Claude, not human engineers / not marketing). v2 reference is name + boundary statement only ('multi-tenant signup + onboarding flow; out of scope for v1') per CONTEXT.md lock — no architectural detail."
  - "Apple Mail code-review findings (11 fact-bullets) lifted from 09-CHECKLIST.md into FUTURE_DIRECTIONS.md §5 Untested Email Clients as authoritative v1 partial evidence for Criterion #2."

patterns-established:
  - "Repo-root briefing artifact (FUTURE_DIRECTIONS.md) as the second file future Claude Code sessions read after CLAUDE.md — explicit 'How to Use This File' header anchors the contract."
  - "Backlog-item disposition mapping: every item in STATE.md 'Carried Concerns / Todos' AND every item in 09-CHECKLIST.md 'Deferrals to v1.1' has a §-anchored line in FUTURE_DIRECTIONS.md classifying it as either resolved-with-commit or deferred-to-§N."

# Metrics
duration: ~30min (FUTURE_DIRECTIONS.md authoring + sign-off + final commit)
completed: 2026-04-27
---

# Phase 9 Plan 09-03: Future Directions and Sign-off Summary

**Authored FUTURE_DIRECTIONS.md (213-line briefing for future Claude Code sessions) at repo root, captured Andrew's verbatim "ship v1" sign-off in 09-CHECKLIST.md, and closed Phase 9 — v1.0 milestone shipped.**

## Performance

- **Duration:** ~30 min (FUTURE_DIRECTIONS.md authoring → commit/push → sign-off capture → final commit)
- **Started:** 2026-04-27 (post Plan 09-02 closure)
- **Completed:** 2026-04-27 (this SUMMARY + STATE update + atomic commit)
- **Tasks executed:** 3 of 3 (all completed)
- **Files modified:** 1 created at repo root + 2 modified in `.planning/` + 1 SUMMARY created

## Accomplishments

- **FUTURE_DIRECTIONS.md authored and committed at repo root** (commit `5f9e725`). 213 lines. All 6 required sections present with exact headers from Plan 09-03 specification:
  1. **How to Use This File** — anchors the contract: "second file read after CLAUDE.md"; lists repo URL, production URL, last code commit (`61b276f`), Plan 09-02 closure commit (`d64a417`), test status (131 passing + 1 skipped); calls out v2 boundary statement ("multi-tenant signup + onboarding flow; out of scope for v1") and source-of-truth chain to `.planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md` Deferrals section.
  2. **Known Limitations** — Apple Mail not live-tested (code-review LIKELY PASS); Squarespace/Wix/WordPress embed not live-tested; live email-client validation across Gmail/Outlook deferred; per-template branding smoke (6 surfaces) deferred; mail-tester scoring deferred; DST/TZ live booking deferred; responsive testing deferred; multi-tenant UI walkthrough deferred; Phase 8 dashboard 9-item walkthrough deferred; confirmation email lacks plain-text alternative; `/auth/callback` route 404; Supabase service-role legacy JWT format.
  3. **Assumptions & Constraints** — single-owner per account; Gmail SMTP for transactional delivery; Vercel Pro tier required for hourly cron; booker timezone is owned by booker; RESERVED_SLUGS duplicated across two files; migration drift workaround (`supabase db query --linked -f`).
  4. **Future Improvements** — v2 (multi-tenant signup + onboarding, name only); reminder retry/resend UI; plain-text email alternative; NSI mark/logo in email footer; Apple Mail live testing; WordPress embed live test; comprehensive a11y audit; Lighthouse / performance audit; production cron observation across multiple hourly ticks.
  5. **Technical Debt / Untested Email Clients** — 19 ESLint violations resolution status (18 fixed in Plan 09-01 commit `61b276f`, 1 deferred — `react-hooks/incompatible-library` at event-type-form.tsx:99 needs useWatch refactor); audit-row `void` cleanup FIXED in Plan 09-01 commit `3d84607` + tsc fix in `61b276f`; RESERVED_SLUGS duplication; migration drift workaround; booker-timezone display intent; wave-2 git-index race; Apple Mail code-review findings (11 fact-bullets lifted from 09-CHECKLIST.md): HTML patterns clean (no position:absolute / display:flex / linear-gradient / CSS vars / @font-face), inline-styled `<table role="presentation">` layout, system font stack, ical-generator default PRODID (RFC 5545 compliant), per-scenario METHOD (REQUEST/CANCEL), explicit SEQUENCE on every invocation, stable UID = booking.id, VTIMEZONE block embedded, CRLF + 75-octet line folding handled by ical-generator, ORGANIZER email = SMTP From (critical for METHOD:CANCEL auto-removal), NSI mark = null (text-only footer, no broken-image risk), logo header gracefully omitted when logo_url null. One low-risk cosmetic note: `border-radius: 6px` on CTA buttons silently ignored on pre-macOS 10.13 / pre-iOS 11 Apple Mail (square corners, no layout breakage — acceptable v1).
  6. **Commit Reference** — Phase 9 sign-off commit, last Phase 8 commit, test count at sign-off, production URL, test fixture URL.

- **Andrew's verbatim ship sign-off captured:** "ship v1" on 2026-04-27. Recorded in 09-CHECKLIST.md Sign-off section: both checkboxes ticked; Marathon Criteria rows #7 (FUTURE_DIRECTIONS.md committed) + #8 (Andrew explicit ship sign-off) marked PASS with timestamp.

- **All 11 STATE.md Phase 9 backlog items accounted for in FUTURE_DIRECTIONS.md:**
  1. Lint cleanup (19 violations from 08-02) → §4 Technical Debt as RESOLVED in Plan 09-01 commit `61b276f` (18 fixed; 1 deferred — `react-hooks/incompatible-library`).
  2. Audit-row `void` cleanup → §4 Technical Debt as RESOLVED in Plan 09-01 commits `3d84607` + `61b276f`.
  3. .ics iTIP CANCEL/REQUEST+SEQUENCE behavior → §5 Untested Email Clients (Apple Mail code-review LIKELY PASS) + §1 Known Limitations (Gmail/Outlook live deferred).
  4. Rate-limit live verification → §1 Known Limitations (deferred; integration test coverage cited).
  5. Branding editor file-rejection edge cases → §1 Known Limitations (deferred; server-side validation already committed and unit-tested).
  6. Per-email-type smoke (6 templates) → §1 Known Limitations / §5 Untested Email Clients (Apple Mail code-review covers underlying patterns; live render deferred).
  7. Production CRON_SECRET in Vercel env → resolved (Plan 09-01 prereq); §4 Technical Debt notes Vercel Crons UI tab empty (cron-fired functional proof deferred).
  8. Reminder mail-tester live verification → §1 Known Limitations (deferred; automated content-quality test cited).
  9. Phase 8 dashboard walkthrough (9 items) → §1 Known Limitations (DEFERRED with full enumeration).
  10. Reminder retry/resend UI → §3 Future Improvements (v1.1+ feature).
  11. Live Squarespace/WordPress embed test (EMBED-07) → §1 Known Limitations (DEFERRED; CSP opaque-origin spec quirk documented).

- **All 12 v1.1 deferrals from 09-CHECKLIST.md propagated** (5 Plan 09-01 carry-forwards + 7 Plan 09-02 scope-cut items): Squarespace/Wix verification, cron-fired-in-production proof, qa-test event type, EventTypeForm useWatch refactor, tsc test-mock alias errors, Marathon Criteria #1 embed, Criterion #2 live email-client testing, Criterion #2 per-template branding sub-table 2a–2f, Criterion #3 mail-tester scoring, Criterion #4 DST/TZ live booking, Criterion #5 responsive testing, Criterion #6 multi-tenant UI walkthrough, Phase 8 dashboard 9-item walkthrough.

- **Apple Mail code-review findings (11 fact-bullets) lifted into FUTURE_DIRECTIONS.md §5** preserving the LIKELY PASS verdict from Plan 09-02 Task 1 commit `3d5fb31` as authoritative v1 partial evidence for Criterion #2 — verbatim per the carry-forward chain locked by Plan 09-02.

## Task Commits

Each task was committed atomically per the plan structure:

1. **Task 1: Author FUTURE_DIRECTIONS.md** — `5f9e725` (docs) — 213-line briefing at repo root.
2. **Task 2: Commit + push** — `5f9e725` (same commit; push to origin/main confirmed; Vercel auto-deploy green — pure-docs change, no runtime impact).
3. **Task 3: Andrew explicit ship sign-off** — captured in this run's atomic commit (09-CHECKLIST.md row updates + Sign-off section ticks + 09-03-SUMMARY.md + STATE.md).

**Plan metadata commit:** This SUMMARY + STATE update + 09-CHECKLIST.md edits will commit together as `docs(09): Andrew sign-off — v1 shipped`.

## Files Created/Modified

**Created:**
- `FUTURE_DIRECTIONS.md` (repo root) — 213-line briefing for future Claude Code sessions; committed in `5f9e725`.
- `.planning/phases/09-manual-qa-and-verification/09-03-SUMMARY.md` — this file.

**Modified:**
- `.planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md` — Marathon Criteria rows #7 + #8 set to PASS with 2026-04-27 timestamps; Sign-off section: both checkboxes ticked, timestamp recorded, sign-off commit placeholder noted; "v1 SHIPPED" capstone added.
- `.planning/STATE.md` — Current Position updated to Phase 9 COMPLETE / v1.0 SHIPPED; Last activity rewritten to capture sign-off "ship v1" 2026-04-27; Progress block: Phase 9 marked complete; Performance Metrics: phases complete = 9 / 9; Key Decisions: v1.0 milestone shipped entry added.

## Decisions Made

1. **v1.0 milestone shipped 2026-04-27 with Andrew's explicit verbatim sign-off "ship v1".** Plan 09-02 marathon QA scope-cut (6 criteria + 9 Phase 8 sub-criteria + 6-row branding sub-table = ~21 items) deferred to v1.1, all captured in FUTURE_DIRECTIONS.md with citations to 09-CHECKLIST.md. v1 ships on extensive automated coverage (131/132 tests green: RLS cross-tenant matrix, reminder content-quality test, rate-limit integration tests, shell render harness) + Phase 7 live verification (2026-04-26) + Phase 8 code-complete (2026-04-27) + Apple Mail code-review LIKELY PASS (Plan 09-02 Task 1, commit `3d5fb31`).

2. **FUTURE_DIRECTIONS.md audience = future Claude Code sessions** (not human engineers, not marketing, not operators). Style: scannable like CLAUDE.md, clear section headers, fact-statement bullets, source citations (file path / line number / commit SHA / `.planning/` artifact path). v2 reference is name-only — boundary statement ("multi-tenant signup + onboarding flow; out of scope for v1") per CONTEXT.md lock — no architectural detail and no capabilities outline.

3. **Apple Mail code-review findings preserved as authoritative v1 partial evidence for Criterion #2.** Lifted intact (all 11 fact-bullets) from 09-CHECKLIST.md "Apple Mail code review findings" section into FUTURE_DIRECTIONS.md §5 Untested Email Clients. Live Apple Mail testing remains a v1.x verification pass when device access becomes available.

## Deviations from Plan

None — plan executed exactly as written. The FUTURE_DIRECTIONS.md content followed the required-section spec verbatim; the cross-check produced a clean 11-row mapping table; the sign-off capture proceeded without checkpoint friction.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** Plan 09-03 executed cleanly across all 3 tasks (1 author / 2 commit / 3 sign-off). FUTURE_DIRECTIONS.md is publication-ready and consumed by the source-of-truth chain (CHECKLIST → SUMMARY → FUTURE_DIRECTIONS.md).

## Issues Encountered

None.

## User Setup Required

None — Plan 09-03 is documentation-only authorship + sign-off capture. No code, env, or external service configuration changed.

## Next Phase Readiness

**Phase 9 COMPLETE; v1.0 milestone SHIPPED.**

- All 9 phases verified or signed off:
  - Phases 1–7 verified live across 2026-04-19 → 2026-04-26.
  - Phase 8 code-complete 2026-04-27 (deferred dashboard walkthrough → v1.1 per Plan 09-02 scope-cut).
  - Phase 9 closed 2026-04-27 with Andrew's "ship v1" sign-off.

- v1.1 backlog is canonically enumerated in `FUTURE_DIRECTIONS.md` at repo root (12 deferrals + 11 STATE.md backlog dispositions). Future planning sessions consume FUTURE_DIRECTIONS.md as the next-milestone source-of-truth.

- Test status at sign-off: 131 passing + 1 skipped = 132 total (16 test files; `npm test` 2026-04-27).
- Production URL: https://calendar-app-xi-smoky.vercel.app — auto-deploy green on `5f9e725`.

**Blockers:** None.

**Watch-items / observability for the v1 → v1.1 window:**
- Vercel Crons UI tab is currently not surfacing the `0 * * * *` schedule for Andrew despite `vercel.json` (commit `d8f729d`) deploying it. Functional cron-fired proof deferred to a future "did the reminder arrive" mail-tester probe.
- If a future Apple Mail user reports broken cancel auto-removal, first thing to check is ORGANIZER email vs SMTP From alignment (currently both = `ajwegner3@gmail.com`).
- Supabase has not rolled out the new `sb_secret_*` service-role key format for this project; legacy JWT remains canonical. Watch Supabase changelog.

---
*Phase: 09-manual-qa-and-verification*
*Completed: 2026-04-27*
*v1.0 milestone shipped (Andrew sign-off "ship v1")*
