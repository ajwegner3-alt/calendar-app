---
phase: 09-manual-qa-and-verification
plan: "09-03"
type: execute
wave: 3
depends_on: ["09-02"]
files_modified:
  - FUTURE_DIRECTIONS.md
  - .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
autonomous: false

must_haves:
  truths:
    - "FUTURE_DIRECTIONS.md exists at repo root (NOT in .planning/) — committed to main and pushed to origin"
    - "FUTURE_DIRECTIONS.md is structured for future Claude Code sessions (audience = Claude, NOT human engineers / NOT marketing) — fact-statement bullets, source citations, scannable headers like CLAUDE.md"
    - "FUTURE_DIRECTIONS.md has all required sections per Task 1 action: How to Use This File, Known Limitations, Assumptions & Constraints, Future Improvements, Technical Debt (5 required) + Untested Email Clients (required when Apple Mail code-review findings present, which they will be) + Commit Reference appendix"
    - "All 11 STATE.md Phase 9 backlog items are accounted for in FUTURE_DIRECTIONS.md (either as fixed or as deferred)"
    - "All deferrals captured during Plan 09-02 are propagated into FUTURE_DIRECTIONS.md"
    - "Apple Mail code-review findings from Plan 09-02 Task 1 lifted into FUTURE_DIRECTIONS.md §Untested Email Clients"
    - "v2 reference is JUST a name + boundary statement — no architectural detail, no capabilities outline (per CONTEXT.md decision)"
    - "Andrew's explicit ship sign-off is captured in 09-CHECKLIST.md with timestamp"
  artifacts:
    - path: "FUTURE_DIRECTIONS.md"
      provides: "Briefing document for future Claude Code sessions opening this repo"
      contains: "Known Limitations"
    - path: ".planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md"
      provides: "Final sign-off entry with timestamp"
      contains: "SIGNED OFF"
  key_links:
    - from: "FUTURE_DIRECTIONS.md"
      to: "Future Claude Code sessions"
      via: "Repo-root .md file read after CLAUDE.md per Andrew's instructions"
      pattern: "How to Use This File"
    - from: "Each Limitation/Assumption/Improvement/Debt bullet"
      to: "Source file or commit hash"
      via: "Inline citation (file path + line number OR commit SHA)"
      pattern: "Source:"
---

<objective>
Author and commit FUTURE_DIRECTIONS.md to the repo root, capturing all known limitations, assumptions, future improvements, and technical debt as of v1 sign-off. Then collect Andrew's explicit ship sign-off — closing Phase 9 and v1.

Purpose: When a future Claude Code session opens this repo (whether to add features, fix bugs, or onboard a new operator), FUTURE_DIRECTIONS.md is the second file read after CLAUDE.md. It tells that future Claude what was deliberately NOT done, why, and where to look for source material. Without it, future sessions waste context re-discovering decisions that were already made.

Output: A committed FUTURE_DIRECTIONS.md file. A signed-off 09-CHECKLIST.md. v1 ready to ship.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-manual-qa-and-verification/09-CONTEXT.md
@.planning/phases/09-manual-qa-and-verification/09-RESEARCH.md
@.planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
@.planning/phases/09-manual-qa-and-verification/09-01-SUMMARY.md
@.planning/phases/09-manual-qa-and-verification/09-02-SUMMARY.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author FUTURE_DIRECTIONS.md from STATE.md backlog + 09-CHECKLIST.md + phase SUMMARYs</name>
  <files>
    FUTURE_DIRECTIONS.md
  </files>
  <action>
    Per CONTEXT.md decision + RESEARCH.md outline:
    - Length: 3-5 pages
    - Audience: future Claude Code sessions (NOT human engineers, NOT operators, NOT marketing)
    - Style: scannable like CLAUDE.md — clear section headers, fact-statement bullets, cite source files/commits where applicable
    - v2 hint: name only ("multi-tenant signup + onboarding flow; out of scope for v1") — no capabilities outline

    **Source material to mine:**
    1. STATE.md "Carried Concerns" (lines 260-299) — 11 Phase 9 backlog items + carried decisions
    2. Each phase SUMMARY's deferred sections (Phases 1-8 — 09-01-SUMMARY.md and 09-02-SUMMARY.md for Phase 9 outcomes)
    3. 19 ESLint violations from Plan 08-02 (post-Plan 09-01 status: how many fixed, how many deferred)
    4. 09-CHECKLIST.md — every DEFERRED item from the marathon QA + Apple Mail code review findings + any sub-9 mail-tester scores + any deferrals from the 9-item dashboard walkthrough
    5. 09-CONTEXT.md "Deferred Ideas" section (Squarespace+WordPress dual platform, Apple Mail live testing, comprehensive a11y, Lighthouse, sustained cron observation)

    **Required structure (use exactly these section headers):**

    ```markdown
    # FUTURE_DIRECTIONS.md

    ## How to Use This File

    This file is a briefing for future Claude Code sessions opening this repo. Read it after CLAUDE.md. It contains known limitations, deferred items, and technical debt as of v1 sign-off (Phase 9, [DATE]).

    Audience: future Claude Code sessions. NOT a human-readable changelog. NOT marketing copy. Bullets are fact statements with source citations (file path, line number, or commit SHA).

    Repository: https://github.com/ajwegner3-alt/calendar-app
    Production: https://calendar-app-xi-smoky.vercel.app
    Last code-complete commit: [SHA from 09-02 final commit]
    Phase 9 sign-off commit: [this commit's SHA after FUTURE_DIRECTIONS.md lands]
    Test status: [N] passing + [M] skipped (as of v1 sign-off)

    ## 1. Known Limitations

    [Bulleted list. Each item: one fact + Source: <citation>. Cover at minimum:]

    - Apple Mail (Mac + iOS): not tested in Phase 9 (no device access). Code review performed; findings in §6.
    - Confirmation email lacks plain-text alternative
      - Source: lib/email/send-booking-confirmation.ts (no `text:` field in sendEmail call)
      - Reminder email already has plain-text alternative (send-reminder-booker.ts:189)
      - Risk: minor mail-tester deduction
    - WordPress embed: only Squarespace tested in Phase 9
      - Source: 09-CONTEXT.md Deferred section
      - CSP `frame-ancestors *` matches all https:// origins; expected to work; unverified
    - `/auth/callback` route 404s: blocks Supabase password-reset / magic-link flows for end users
      - Source: STATE.md v2 backlog
      - Workaround: owners reset password via Supabase dashboard
    - Supabase service-role key format: legacy JWT SUPABASE_SERVICE_ROLE_KEY still in use
      - Source: STATE.md line 262 (Plan 08-08 prereq C)
      - sb_secret_* format not rolled out for this project as of 2026-04-27
      - Watch Supabase changelog
    - [List any mail-tester scores < 9/10 from Plan 09-02 here, if applicable]
    - [List any criteria DEFERRED from Plan 09-02 here]

    ## 2. Assumptions & Constraints

    - Single-owner per account: v1 has no team/multi-user model within an account
    - Gmail SMTP for transactional delivery via owner's personal Gmail (GMAIL_USER / GMAIL_FROM_NAME)
      - Not suitable for high volume; fine for v1 contractor use case
    - Vercel Pro tier required: hourly cron (vercel.json `0 * * * *`) only works on Pro
      - Source: STATE.md line 258 (Plan 08-08 confirmed Pro)
      - Hobby fallback (cron-job.org) was researched + dropped
    - Booker timezone is submitted at booking time, not verified or corrected
      - Source: Phase 4/5 locked decisions
      - Booker owns their clock display
    - RESERVED_SLUGS duplicated across two files
      - Source: STATE.md line 207-211, both lib/<file>.ts and load-account-listing.ts
      - Any new reserved slug must be added to BOTH files manually
    - Migration drift workaround: `npx supabase db push --linked` fails
      - Source: STATE.md line 224
      - Use `npx supabase db query --linked -f <file>` instead
      - Three orphan timestamps in supabase_migrations.schema_migrations on remote DB

    ## 3. Future Improvements

    - **v2: multi-tenant signup + onboarding flow** (out of scope for v1) [no further detail per CONTEXT.md]
    - Reminder retry/resend UI
      - Source: STATE.md line 284 (Plan 08-04 carried)
      - Suggestion: "Resend reminder" action on /app/bookings/[id]
      - Note: do NOT clear reminder_sent_at on send failure (would cause retry spam — RESEARCH Pitfall 4)
    - Plain-text email alternative for confirmation email
      - Source: §1 Known Limitations
      - Low effort: add stripHtml() import + text: field to sendEmail call in send-booking-confirmation.ts
    - NSI mark/logo in "Powered by NSI" email footer
      - Source: branding-blocks.ts line 44 (NSI_MARK_URL=null)
      - Add /public/nsi-mark.png to repo, set NSI_MARK_URL constant
    - Apple Mail live testing (deferred from Phase 9)
    - WordPress embed live test (deferred from Phase 9)
    - Comprehensive a11y audit
      - Source: ROADMAP.md deferred
      - WCAG 2.1 AA on booking flow + dashboard
    - Performance / Lighthouse audit (no formal benchmark in v1)
    - Production cron observation across multiple hourly ticks
      - Source: 09-CONTEXT.md Deferred section
      - Phase 9 verifies first tick fires; sustained monitoring is post-ship ops

    ## 4. Technical Debt

    [Capture lint cleanup outcome from Plan 09-01:]

    - 19 ESLint violations surfaced by Plan 08-02 — Phase 9 outcome:
      - Source: .planning/phases/08-reminders-hardening-and-dashboard-list/08-02-SUMMARY.md
      - Status: [X fixed in Plan 09-01 Task 4 / Y deferred — populate from 09-01-SUMMARY.md]
      - Remaining: [list any not fixed, with reason]
      - **`hooks/use-mobile.ts` decision** (RESEARCH Open Question 3): [populate which Option taken — A: useSyncExternalStore refactor / B: eslint-disable + comment]
      - **`react-hooks/incompatible-library`** (RESEARCH Open Question 4): [populate the file/library identified by lint output + how it was handled]
    - Audit-row `void` cleanup in cancel.ts + reschedule.ts
      - Status: FIXED in Plan 09-01 Task 3 (commit: [SHA])
    - RESERVED_SLUGS duplication (see §2 Assumptions)
    - Migration drift workaround (see §2 Assumptions)
    - Booker-timezone display in bookings list shows booker's timezone, not owner's
      - Source: STATE.md line 250
      - This is INTENTIONAL (matches confirmation/reminder email convention) but may confuse future developers — document inline if a comment is added
    - Plan 08-05 / 08-06 / 08-07 wave-2 git-index race
      - Source: STATE.md line 247, 306-309
      - Future YOLO multi-wave runs should serialize commits or use per-plan worktrees

    ## 5. Untested Email Clients

    [Lift Apple Mail code-review findings from 09-CHECKLIST.md Task 1 here. Cover:]

    - Apple Mail (Mac + iOS): not tested in Phase 9 (no device access)
    - Code-review findings (HIGH confidence, verified against source files):
      - HTML: table-based layout, inline styles only, system font stack — should render correctly
      - .ics: PRODID present (ical-generator default), VTIMEZONE via timezones-ical-library, METHOD:REQUEST/CANCEL set per scenario, SEQUENCE 0/1 correct, UID stable (booking.id UUID)
      - ORGANIZER email = account.owner_email = SMTP From address (matches; required for METHOD:CANCEL auto-removal)
      - "Powered by NSI" footer is text-only (NSI_MARK_URL=null) — no broken-image risk
      - Cosmetic risk: `border-radius: 6px` on `<a>` button elements may render square in Apple Mail < v16 (branding-blocks.ts:70)
    - Recommendation: live-test with a device when access is available; test script in .planning/phases/09-manual-qa-and-verification/09-RESEARCH.md Per-Criterion #2
    - Proton Mail / Fastmail / Yahoo Mail: not tested; likely work for HTML (no unusual CSS); .ics behavior unknown

    ## 6. Commit Reference

    - Phase 9 sign-off: [this commit's SHA after add + commit]
    - Last Phase 8 commit: 487036a (docs: capture phase context)
    - Tests green at sign-off: [N passing + M skipped]
    - Production URL: https://calendar-app-xi-smoky.vercel.app
    - Test fixture URL: https://calendar-app-xi-smoky.vercel.app/nsi/qa-test (qa-test event type)
    ```

    Replace [bracketed] placeholders with actual values from 09-01-SUMMARY.md and 09-02-SUMMARY.md.

    Length target: 3-5 pages. Compress aggressively where possible. NO marketing language ("powerful", "robust", "seamless"). NO mention of features that aren't built. Each bullet should pass the test "would a future Claude session need to know this to make a good decision?"
  </action>
  <verify>
    File exists at /FUTURE_DIRECTIONS.md (repo root, NOT .planning/).
    All 6 sections present with exact headers.
    Each bullet is a fact statement. Each non-trivial bullet has a Source: citation.
    No section is empty.
    No bullet uses marketing language ("seamless", "powerful", "best-in-class", etc.)
    v2 mention is one line, no architectural detail.
    Markdown lints clean (preview renders correctly).

    **Backlog cross-check (Claude-executed, BLOCKING — must complete before "done"):**
    Cross-check all 11 STATE.md Phase 9 backlog items (`### Carried Concerns / Todos` lines) against the FUTURE_DIRECTIONS.md document. Each MUST appear in the file as either "fixed in 09-01 (commit SHA)" OR "deferred — see §X."

    The 11 items (verbatim from STATE.md / revision_context):
    1. Lint cleanup (19 violations from 08-02)
    2. Audit-row `void` cleanup (cancel.ts/reschedule.ts after() migration)
    3. .ics iTIP CANCEL/REQUEST+SEQUENCE behavior
    4. Rate-limit live verification (3 routes)
    5. Branding editor file-rejection edge cases
    6. Per-email-type smoke (6 templates)
    7. Production CRON_SECRET in Vercel env
    8. Reminder mail-tester live verification
    9. Phase 8 dashboard walkthrough (9 items)
    10. Reminder retry/resend UI (v2 deferral)
    11. Live Squarespace/WordPress embed test (EMBED-07)

    Produce a 11-row mapping table inline in this <verify> output (not in FUTURE_DIRECTIONS.md itself — this is QA-time evidence) showing item → disposition (fixed-in-09-01 with SHA / verified-in-09-02 / deferred-§N-of-FUTURE_DIRECTIONS). If any item lacks a disposition, FUTURE_DIRECTIONS.md is incomplete — return to <action> and add the missing entry.
  </verify>
  <done>
    FUTURE_DIRECTIONS.md is publication-ready.
  </done>
</task>

<task type="auto">
  <name>Task 2: Commit FUTURE_DIRECTIONS.md and push to origin/main</name>
  <files>
    FUTURE_DIRECTIONS.md
  </files>
  <action>
    1. `git add FUTURE_DIRECTIONS.md`
    2. `git commit -m "docs(09): FUTURE_DIRECTIONS.md for v1 sign-off"`
    3. `git push origin main`
    4. Capture the commit SHA for use in Task 3 (sign-off entry references it).
    5. Confirm Vercel auto-deploy is green (the file is repo-root .md; doesn't affect runtime, but the deploy should still pass).
  </action>
  <verify>
    `git log --oneline | head -5` shows the new commit at top of main.
    Vercel deploy is green.
  </verify>
  <done>
    FUTURE_DIRECTIONS.md is in production repo. Closes Criterion #7.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Andrew explicit ship sign-off (Criterion #8)</name>
  <what-needed>
    Per ROADMAP success criterion #8: "Andrew explicitly signs off that the tool works for his own NSI bookings." This is the final gate. Andrew reviews 09-CHECKLIST.md (which is now fully populated by Plan 09-02 + the FUTURE_DIRECTIONS.md commit from Task 2) and explicitly says ship.

    What Claude has prepared for Andrew to review:
    - 09-CHECKLIST.md with all 8 criteria status + sub-criteria + Apple Mail findings + deferrals
    - FUTURE_DIRECTIONS.md committed at repo root
    - Any Plan 09-01 / 09-02 inline-fix commits live in production
    - Test suite: [N passing + M skipped]
  </what-needed>
  <how-to-verify>
    Andrew reviews 09-CHECKLIST.md and FUTURE_DIRECTIONS.md. Specifically:

    1. Confirms every criterion in 09-CHECKLIST.md is either PASS or explicitly DEFERRED with a reason captured.
    2. Confirms qualified-PASS rows are recorded with their qualifier (e.g., Criterion #2 must read "PASS (Apple Mail: code-review-only, deferred)" — never an unqualified PASS — per the locked CONTEXT.md no-device-access deferral). If Criterion #4 was substituted (cross-timezone in lieu of named DST dates), the row must record both Andrew's substitution-approval signal and the substitute method used.
    3. Confirms FUTURE_DIRECTIONS.md accurately captures the deferrals and known limitations Andrew is aware of (no surprises).
    4. Says the words: "ship v1" (or equivalent — "approved", "sign off", "ship it").

    On verbal sign-off:
    - Claude appends a final entry to 09-CHECKLIST.md:
      ```
      ## Sign-off

      - [x] Andrew reviewed 09-CHECKLIST.md and FUTURE_DIRECTIONS.md
      - [x] Andrew explicit verbal sign-off: "ship v1" (or actual phrasing)
      - **Sign-off timestamp:** YYYY-MM-DD HH:MM TZ
      - **Sign-off commit:** [SHA of the commit that adds this sign-off entry]
      ```
    - Claude commits the updated checklist with message `docs(09): Andrew sign-off — v1 shipped`.
    - Claude pushes to origin/main.
    - v1 is officially shipped.

    On any FAIL that Andrew is NOT willing to defer:
    - This becomes a quick-patch loop: Claude fixes → ships → Andrew re-verifies → returns here.
    - Sign-off does NOT proceed until Andrew is satisfied.
  </how-to-verify>
  <resume-signal>Type "ship v1" (or equivalent) — OR list the items still blocking sign-off</resume-signal>
</task>

</tasks>

<verification>
- FUTURE_DIRECTIONS.md exists at repo root with all 6 sections
- All STATE.md Phase 9 backlog items addressed (fixed status / deferred status)
- All Plan 09-02 deferrals captured
- Apple Mail code-review findings logged in §5
- v2 reference is name-only
- Andrew's sign-off entry committed to 09-CHECKLIST.md
- All commits pushed to origin/main
- Vercel deploy green
</verification>

<success_criteria>
- All Plan 09-03 must_haves satisfied
- ROADMAP success criteria #7 (FUTURE_DIRECTIONS.md committed) and #8 (sign-off) are PASS in 09-CHECKLIST.md
- v1 is officially shipped
- Future Claude Code sessions opening this repo will read CLAUDE.md, then FUTURE_DIRECTIONS.md, then proceed
</success_criteria>

<output>
After completion, create `.planning/phases/09-manual-qa-and-verification/09-03-SUMMARY.md` summarizing FUTURE_DIRECTIONS.md authoring + sign-off + final state of v1 (test count, deploy status, any open watch-items). Then update `.planning/STATE.md` to mark Phase 9 complete and v1 shipped.
</output>
