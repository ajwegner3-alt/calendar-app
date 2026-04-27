---
phase: 09-manual-qa-and-verification
plan: "09-02"
subsystem: testing
tags: [marathon-qa, scope-cut, apple-mail, code-review, ics, deferral, v1.1-backlog]

# Dependency graph
requires:
  - phase: 09-manual-qa-and-verification
    provides: "Plan 09-01 pre-flight artifacts: lint baseline cleared, after()-wrapped audit-row inserts, spam-folder copy in confirmation + reminder emails, 09-CHECKLIST.md scaffold"
provides:
  - "Apple Mail code-review-only verification: LIKELY PASS verdict + 11 fact-bullets recorded in 09-CHECKLIST.md (commit 3d5fb31, Plan 09-02 Task 1)"
  - "Deliberate scope-cut decision recorded: remaining marathon QA criteria (1-6 + Phase 8 9-item walkthrough) DEFERRED to v1.1 by project owner discretion on 2026-04-27"
  - "Consolidated v1.1 backlog enumeration in 09-CHECKLIST.md Deferrals section, ready for FUTURE_DIRECTIONS.md (Plan 09-03) to consume"
affects:
  - "09-03 future-directions and sign-off (consumes the consolidated v1.1 backlog from this plan; FUTURE_DIRECTIONS.md authorship)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Marathon-QA partial-completion pattern: when verification scope is cut by project owner mid-plan, preserve all evidence collected (Apple Mail code-review fact-bullets stand as Criterion #2 partial), mark unverified criteria DEFERRED with explicit project-owner-approved reason, and surface consolidated v1.1 backlog with source citations rather than discarding the work the plan attempted"

key-files:
  created:
    - .planning/phases/09-manual-qa-and-verification/09-02-SUMMARY.md
  modified:
    - .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
    - .planning/STATE.md

key-decisions:
  - "Plan 09-02 marathon QA was scoped out by project owner on 2026-04-27. Apple Mail code review (Task 1) was the only verification work executed. All other criteria deferred to v1.1. FUTURE_DIRECTIONS.md (Plan 09-03) becomes the authoritative record of unverified items. This is NOT a failure mode — explicit project-owner discretion on remaining QA scope."
  - "Apple Mail code-review verdict (LIKELY PASS, 11 fact-bullets in 09-CHECKLIST.md) is preserved as the only marathon-QA evidence; Criterion #2 status records 'DEFERRED (Apple Mail code-review-only complete; live email-client testing deferred to v1.1)' rather than an unqualified DEFERRED."
  - "All Phase 8 dashboard 9 sub-criteria DEFERRED. Underlying functionality is covered by automated test suites (131/132 green, RLS matrix, rate-limit integration tests, reminder content-quality test, shell render harness). What's deferred is the live human walkthrough — not the algorithmic correctness."

patterns-established:
  - "Project-owner discretion as a first-class checklist outcome: explicit DEFERRED + reason + timestamp is a clean, recoverable closure pattern that preserves audit trail without overstating completeness."
  - "Source-of-truth citations from SUMMARY → CHECKLIST → FUTURE_DIRECTIONS.md form a stable carry-forward chain — Plan 09-03 can consume Plan 09-02's deferrals without re-investigating original criteria definitions."

# Metrics
duration: ~25min (Task 1 Apple Mail code-review + scope-cut closure)
completed: 2026-04-27
---

# Phase 9 Plan 09-02: Marathon QA Execution Summary

**Apple Mail code-review (LIKELY PASS, 11 fact-bullets) was the only marathon-QA verification work executed before Andrew elected to defer the remaining marathon criteria (#1, #2 live, #3, #4, #5, #6) and Phase 8's 9-item dashboard walkthrough to v1.1; consolidated v1.1 backlog ready for FUTURE_DIRECTIONS.md (Plan 09-03) to consume.**

## Performance

- **Duration:** ~25 min (Task 1 Apple Mail code review + scope-cut closure work)
- **Started:** 2026-04-27T23:16:12Z (Plan 09-02 begin per CHECKLIST header)
- **Completed:** 2026-04-27 (this SUMMARY + STATE update)
- **Tasks executed:** 1 of 10 (Task 1 only — Apple Mail code review)
- **Tasks deferred:** 9 of 10 (Tasks 2–10: reminder mail-tester probe, Criterion #1 embed, Criterion #2 live + per-template branding, Criterion #3 mail-tester scoring, Criterion #4 DST/TZ, Criterion #5 responsive, Criterion #6 multi-tenant UI, Phase 8 dashboard walkthrough)
- **Files modified:** 1 (`.planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md`) + 1 created (this SUMMARY) + 1 STATE update

## Accomplishments

- **Apple Mail code-review LIKELY PASS verdict** recorded in `.planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md` (Plan 09-02 Task 1, commit `3d5fb31`). Reviewed 7 email-related source files: `lib/email/build-ics.ts`, `lib/email/branding-blocks.ts`, `lib/email/send-booking-confirmation.ts`, `lib/email/send-owner-notification.ts`, `lib/email/send-cancel-emails.ts`, `lib/email/send-reschedule-emails.ts`, `lib/email/send-reminder-booker.ts`. 11 fact-bullets collected covering: Apple Mail-safe HTML patterns (no `position:absolute`, no `display:flex`, no `linear-gradient`, no CSS vars, no `@font-face`); inline-styled `<table role="presentation">` layout; system font stack; ical-generator default PRODID (RFC 5545 compliant); per-scenario METHOD (REQUEST/CANCEL); explicit SEQUENCE on every invocation; stable UID = `booking.id`; VTIMEZONE block embedded; CRLF + 75-octet line folding handled by ical-generator; ORGANIZER email matches SMTP From (critical for Apple Mail's METHOD:CANCEL auto-removal); NSI mark image is null (text-only footer — no broken-image risk); logo header gracefully omitted when `logo_url` is null. **One low-risk cosmetic note documented:** `border-radius: 6px` on CTA buttons + cancel-reason callout silently ignored on pre-macOS 10.13 / pre-iOS 11 Apple Mail (square corners, no layout breakage — acceptable v1).
- **Plan 09-02 scope-cut cleanly recorded** — Andrew's verbatim instruction (_"Close out everything and move to future directions. Everything we need right now is fine. Other problems are more pressing and will be addressed in the next milestone."_) captured in 09-CHECKLIST.md "Plan 09-02 wholesale scope-cut (2026-04-27)" entry. Marathon Criteria #1, #2, #3, #4, #5, #6 all marked DEFERRED with timestamp + reason. Criterion #2 specifically marked "DEFERRED (Apple Mail code-review-only complete; live email-client testing deferred to v1.1)" preserving the partial evidence. 6-row per-template branding smoke sub-table (2a–2f) marked DEFERRED. Phase 8 dashboard 9-item walkthrough marked DEFERRED. Criteria #7 + #8 left PENDING (Plan 09-03 work).
- **v1.1 backlog consolidated into 09-CHECKLIST.md** — Deferrals section now lists 12 line items (the 5 pre-existing Plan 09-01 carry-forward items plus 7 new Plan 09-02 scope-cut items) with source-of-truth citations pointing back to the rows of the marathon-criteria table, the per-template sub-table, the Phase 8 walkthrough section, the Plan 09-02 scope-cut entry, and the Apple Mail code-review findings. FUTURE_DIRECTIONS.md (Plan 09-03) consumes this directly.

## Task Commits

Each task that produced code/docs changes was committed atomically:

1. **Task 1: Apple Mail code review** — `3d5fb31` (docs) — 11 fact-bullets logged in 09-CHECKLIST.md "Apple Mail code review findings" section. Verdict: LIKELY PASS. One low-risk cosmetic note: `border-radius: 6px` silently ignored on pre-macOS 10.13 / pre-iOS 11 Apple Mail (acceptable v1).
2. **Tasks 2–10: not executed** — paused at Task 2 checkpoint (reminder mail-tester probe booking); subsequent scope-cut decision converted these into v1.1 deferrals rather than execution. No commits.
3. **Plan 09-02 closure (this SUMMARY + STATE):** `8686ae1` (docs — CHECKLIST DEFERRED markings + consolidated v1.1 backlog entry); next commit will carry SUMMARY.md + STATE.md as `docs(09-02): complete marathon-qa-execution plan (deferred to v1.1)`.

## Files Created/Modified

**Created:**
- `.planning/phases/09-manual-qa-and-verification/09-02-SUMMARY.md` — this file.

**Modified:**
- `.planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md` — Marathon Criteria table rows #1–#6 set to DEFERRED; per-template smoke sub-table rows 2a–2f set to DEFERRED; Phase 8 dashboard 9-item walkthrough section all 9 lines annotated DEFERRED; Deferrals section appended with "Plan 09-02 wholesale scope-cut (2026-04-27)" consolidated entry including verbatim Andrew quote + 7-item v1.1 backlog enumeration + source-of-truth citations. Apple Mail code review findings section KEPT INTACT (the only marathon-QA evidence collected before the scope-cut). Criteria #7 + #8 left PENDING (Plan 09-03 work). Pre-flight section (Plan 09-01 artifacts) untouched.
- `.planning/STATE.md` — Current Position updated to reflect Plan 09-02 closure (deferred-to-v1.1 outcome); Last activity rewritten to capture Andrew's scope-cut decision; Key Decisions gains explicit Plan 09-02 scope-cut entry; Session Continuity "Stopped at" rewritten.

## Decisions Made

1. **Plan 09-02 marathon QA scoped out by project owner on 2026-04-27.** Andrew's verbatim direction: _"Close out everything and move to future directions. Everything we need right now is fine. Other problems are more pressing and will be addressed in the next milestone."_ Apple Mail code review (Task 1) was the only verification work executed. All other criteria deferred to v1.1. FUTURE_DIRECTIONS.md (Plan 09-03) becomes the authoritative record of unverified items. **This is NOT a failure mode** — explicit project-owner discretion on remaining QA scope. v1 ships on what's verified (extensive automated test coverage at 131/132 green, RLS cross-tenant matrix, reminder content-quality test, rate-limit integration tests, shell render harness, Phase 7 live verification 2026-04-26, Phase 8 code-complete 2026-04-27, Apple Mail code-review LIKELY PASS).
2. **Criterion #2 status records partial evidence preservation.** Rather than blanket-DEFERRED, Criterion #2 status reads "DEFERRED (Apple Mail code-review-only complete; live email-client testing deferred to v1.1)". The Apple Mail LIKELY PASS verdict + 11 fact-bullets logged in 09-CHECKLIST.md Apple Mail Findings section remain authoritative; what's deferred is live Gmail/Outlook .ics validation + the 6-row per-template per-surface branding smoke (2a–2f).
3. **Phase 8 dashboard walkthrough deferral does not invalidate Phase 8 code-completion.** Phase 8 was code-complete 2026-04-27 (commit 7839406 + d8f729d). Automated test coverage includes: bookings list page (DASH-02 + DASH-03), booking detail page with owner-note autosave (DASH-04, `tests/owner-note-action.test.ts` 7 cases), reminder settings core (`tests/reminder-toggles-actions.test.ts`), reminder cron route (`tests/reminder-cron.test.ts` 8 cases), reminder content quality (`tests/reminder-email-content.test.ts` 6 cases), rate-limit smoke (`tests/bookings-rate-limit.test.ts` + `tests/cancel-reschedule-api.test.ts` Scenario 7), RLS cross-tenant matrix (`tests/rls-cross-tenant-matrix.test.ts` 16 cases), shell render harness (`tests/shell-render.test.tsx` providers tree + static-analysis source-shape guard). What's deferred is the human-driven dashboard walkthrough — not the algorithmic or isolation correctness.

## Deviations from Plan

### Plan-level deviation (project-owner discretion, not a deviation rule)

The plan as written required all 8 marathon criteria to be verified PASS/FAIL/DEFERRED individually. After Task 1 completed (Apple Mail code review LIKELY PASS) and before Task 2 began (reminder mail-tester probe booking checkpoint), Andrew elected to defer the remaining work to v1.1. This is **not** an auto-fixed bug, missing critical functionality, or blocking issue (Rules 1–3) and **not** an architectural decision requiring agent-side checkpointing (Rule 4) — it is **explicit project-owner discretion** to scope-cut the plan after partial execution.

**Closure pattern applied:** Preserve all evidence collected (Apple Mail fact-bullets stand as Criterion #2 partial), mark unverified criteria DEFERRED with explicit project-owner-approved reason + timestamp, and surface consolidated v1.1 backlog with source citations into FUTURE_DIRECTIONS.md (Plan 09-03). No code regressions, no broken work — just a deliberate stop.

---

**Total deviations:** 0 auto-fixed. 1 plan-level scope-cut by project owner (closure pattern documented above).

**Impact on plan:** Plan executes 1 of 10 tasks; remaining 9 deferred to v1.1 backlog rather than abandoned. All evidence collected before scope-cut is preserved as authoritative partial coverage. Carry-forward chain (CHECKLIST → SUMMARY → FUTURE_DIRECTIONS.md) is clean.

## Issues Encountered

None. The Apple Mail code review found one low-risk cosmetic note (`border-radius: 6px` silently ignored on pre-macOS 10.13 / pre-iOS 11 Apple Mail — square corners, no layout breakage — acceptable v1) which is captured as fact-bullet #2 in the Apple Mail findings section of 09-CHECKLIST.md.

## User Setup Required

None — this is a documentation-only closure plan. No code, env, or external service configuration changed.

## Next Phase Readiness

**Ready for Plan 09-03 (FUTURE_DIRECTIONS.md authorship + sign-off):**

- 09-CHECKLIST.md is the consolidated source-of-truth for v1.1 backlog. Plan 09-03's FUTURE_DIRECTIONS.md MUST capture all of:
  1. **Marathon Criteria #1** — Embed end-to-end booking on Andrew's Next.js site (also covers Plan 09-01's already-deferred Squarespace/Wix verification).
  2. **Marathon Criteria #2 (live email-client portion)** — .ics live-client validation across Gmail web/iOS, Outlook web/desktop. Apple Mail code-review (LIKELY PASS, 11 fact-bullets) stands as v1 partial; live testing across all clients is v1.1.
  3. **Marathon Criteria #2 (per-template branding sub-table 2a–2f)** — 6 surfaces (booker × owner × confirm/cancel/reschedule).
  4. **Marathon Criteria #3** — mail-tester.com >= 9/10 for confirmation AND reminder. Folds in the Plan 09-01 deferral #2 (cron-fired-in-production functional proof).
  5. **Marathon Criteria #4** — DST/timezone correctness via cross-timezone or November 1 2026 DST-spanning live booking. Algorithmic correctness covered by `tests/availability/compute-slots*.test.ts`; live human end-to-end with real email confirmation is what carries forward.
  6. **Marathon Criteria #5** — Responsive at 320 / 768 / 1024 (hosted + embed).
  7. **Marathon Criteria #6** — Multi-tenant UI isolation walkthrough. Backend RLS isolation covered by `tests/rls-cross-tenant-matrix.test.ts`; live UI-layer login walkthrough is what carries forward.
  8. **Phase 8 dashboard walkthrough (9 sub-criteria)** — bookings list filters/pagination/sort; booking detail page (answers + owner-note autosave + history timeline + action bar); reminder settings toggles; event-type Location field persistence; reminder email arrives in inbox with branding + toggles; Vercel Cron dashboard green ticks; rate-limit live smoke (3 endpoints); sidebar Settings group renders Reminder Settings entry; branding editor file-rejection edge cases (JPG / >2MB / spoofed MIME).
  9. **Carry-forward of Plan 09-01 deferrals** — already in 09-CHECKLIST.md Deferrals section items 1–5; Plan 09-03 FUTURE_DIRECTIONS.md should consolidate alongside Plan 09-02 deferrals.
  10. **Apple Mail v1.x verification pass** — when device access becomes available; if a future Apple Mail user reports broken cancel auto-removal, first thing to check is ORGANIZER email vs SMTP From alignment (currently both = `ajwegner3@gmail.com`).

**Carry-forward into Plan 09-03 FUTURE_DIRECTIONS.md authorship:**
- All 12 items in 09-CHECKLIST.md Deferrals section (5 from Plan 09-01 + 7 from Plan 09-02 scope-cut).
- Apple Mail code review findings section in 09-CHECKLIST.md (preserved intact; Plan 09-03's FUTURE_DIRECTIONS.md §5 "Apple Mail compatibility" can cite directly).

**Blockers:** None — Plan 09-03 is documentation-only authorship + final commit + Andrew sign-off.

---
*Phase: 09-manual-qa-and-verification*
*Completed: 2026-04-27*
