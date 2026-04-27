---
phase: 09-manual-qa-and-verification
plan: "09-01"
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
  - lib/email/send-booking-confirmation.ts
  - lib/email/send-reminder-booker.ts
  - lib/bookings/cancel.ts
  - lib/bookings/reschedule.ts
  - eslint.config.mjs
  - hooks/use-mobile.ts
  - app/[account]/[event-slug]/_components/booking-shell.tsx
  - app/[account]/[event-slug]/_components/slot-picker.tsx
  - app/[account]/[event-slug]/_components/booking-form.tsx
  - app/reschedule/[token]/_components/reschedule-shell.tsx
autonomous: false

user_setup:
  - service: squarespace-trial
    why: "EMBED-07 / Criterion #1 requires a real https:// host page to paste the embed snippet into; Andrew has no live client site available"
    env_vars: []
    dashboard_config:
      - task: "Sign up for Squarespace 14-day free trial (https://www.squarespace.com/free-trial). Use any starter template. Create a hidden test page at slug /booking-test (Pages → Add Page → Not Linked section so it's unlinked from main nav). Leave it blank — the embed snippet will be pasted in Plan 09-02."
        location: "https://www.squarespace.com (free trial; no DNS work needed; uses *.squarespace.com subdomain)"
  - service: vercel-cron-secret
    why: "INFRA-02 / Criterion #3 reminder mail-tester requires CRON_SECRET in Vercel Production env so the hourly cron actually fires"
    env_vars:
      - name: CRON_SECRET
        source: ".env.local has the value already; copy verbatim into Vercel"
    dashboard_config:
      - task: "Vercel Project → Settings → Environment Variables → Add CRON_SECRET (Production + Preview scopes) with the same value as .env.local. Then trigger a redeploy (Deployments → latest → Redeploy) so the env var takes effect. Verify Crons tab in Vercel Dashboard shows the next scheduled invocation; ideally wait for one tick to fire green (200 OK) before starting Plan 09-02."
        location: "Vercel Dashboard → calendar-app project → Settings → Environment Variables; then Settings → Crons"
  - service: gmail-aliasing-confirm
    why: "All test bookings route to ajwegner3@gmail.com via + aliasing; need to confirm the alias actually delivers"
    env_vars: []
    dashboard_config:
      - task: "Send a probe email to ajwegner3+booker@gmail.com from any other address (or use a +alias send-to-self). Confirm it arrives in the ajwegner3@gmail.com inbox. If it does not arrive within 2 minutes, troubleshoot before starting Plan 09-02."
        location: "Any email client"
  - service: qa-test-event-type
    why: "All Phase 9 bookings route through a dedicated qa-test event type to avoid polluting real NSI event types"
    env_vars: []
    dashboard_config:
      - task: "Log in to https://calendar-app-xi-smoky.vercel.app/app/login as ajwegner3@gmail.com. Navigate to Event Types → New. Create one with name = 'QA Test', slug = 'qa-test', duration = 30 min, description = 'Phase 9 verification only — archive after sign-off'. Set availability to allow at least the next 7 days (or use the existing global rules). Confirm the public page renders at /nsi/qa-test."
        location: "https://calendar-app-xi-smoky.vercel.app/app/event-types"
  - service: mail-tester-warm-up
    why: "Each mail-tester.com address is valid for 10 minutes; confirm the workflow before relying on it under time pressure"
    env_vars: []
    dashboard_config:
      - task: "Open https://www.mail-tester.com once. Verify a fresh disposable address generates (e.g., test-xyz123@mail-tester.com). Do NOT send a test email yet — Plan 09-02 will use a fresh address at the actual send time. This confirms the site works in Andrew's network."
        location: "https://www.mail-tester.com"

must_haves:
  truths:
    - "All 5 Pre-QA prerequisites confirmed done before marathon QA begins (Squarespace site, Vercel CRON_SECRET, Gmail aliasing, qa-test event type, mail-tester warm-up)"
    - "09-CHECKLIST.md exists and lists all 8 ROADMAP success criteria with PASS/FAIL/DEFERRED slots + timestamp + notes columns"
    - "Both confirmation and reminder emails contain a 'check your spam folder' copy line in their HTML body"
    - "Audit-row void supabase.from('booking_events').insert(...) patterns in lib/bookings/cancel.ts and lib/bookings/reschedule.ts are migrated to after()"
    - "npm run lint exits with zero errors after the cleanup; remaining warnings (if any) are documented in CHECKLIST.md for FUTURE_DIRECTIONS.md"
    - "All code changes pushed to origin/main and deployed to calendar-app-xi-smoky.vercel.app (Vercel deploy showing green)"
  artifacts:
    - path: ".planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md"
      provides: "Live session-of-record artifact for the marathon QA — pass/fail per criterion + timestamps"
      contains: "Criterion 1"
    - path: "lib/email/send-booking-confirmation.ts"
      provides: "Spam-folder copy line inserted before line 122 <hr>"
      contains: "spam or junk folder"
    - path: "lib/email/send-reminder-booker.ts"
      provides: "Spam-folder copy line inserted as a new segment between lifecycle-links and footer"
      contains: "spam or junk folder"
    - path: "lib/bookings/cancel.ts"
      provides: "Audit-row insert wrapped in after()"
      contains: "after(()"
    - path: "lib/bookings/reschedule.ts"
      provides: "Audit-row insert wrapped in after()"
      contains: "after(()"
  key_links:
    - from: "Vercel CRON_SECRET env var"
      to: "/api/cron/send-reminders"
      via: "Authorization: Bearer header on hourly cron invocation"
      pattern: "Bearer ${CRON_SECRET}"
    - from: "lib/email/send-booking-confirmation.ts spam-folder line"
      to: "Resulting HTML email body"
      via: "String literal embedded in the renderEmail HTML template"
      pattern: "check your spam"
---

<objective>
Run all pre-QA prerequisites to completion AND apply the only in-scope Phase 9 code changes (spam-folder copy line, audit-row after() migration, lint cleanup) BEFORE the marathon QA session opens. This plan is the gate that unblocks Plan 09-02; nothing in 09-02 can proceed until this finishes cleanly.

Purpose: The marathon QA session is time-boxed and human-driven. Doing the prereqs and code edits up front means Plan 09-02 can run start-to-finish without context switches into "fix this thing first." It also means the deployed code under test in Plan 09-02 already includes the spam-folder copy line + cleaned-up code health.

Output: A populated 09-CHECKLIST.md file ready for Plan 09-02 to fill in, two email template files with the spam-folder line, two booking lib files with after()-wrapped audit rows, a clean `npm run lint` exit, and a green Vercel deploy.

**Task-count note:** This plan has 6 tasks but Tasks 1 (human checkpoint) and 6 (deploy verification) are low-context human/deploy operations; effective autonomous Claude work = Tasks 2-5 (4 tasks).
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
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-02-SUMMARY.md

# Source files to be edited
@lib/email/send-booking-confirmation.ts
@lib/email/send-reminder-booker.ts
@lib/bookings/cancel.ts
@lib/bookings/reschedule.ts
@eslint.config.mjs
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew completes 5 Pre-QA prerequisites</name>
  <what-needed>
    The marathon QA session in Plan 09-02 cannot start until all 5 prereqs are confirmed done. Claude cannot do these — each requires Andrew to interact with an external dashboard, sign up for a service, or click in a browser.
  </what-needed>
  <how-to-verify>
    Andrew confirms each of the 5 items below by typing "done: <item>" or describes any blocker.

    1. **Squarespace 14-day free trial site** — signed up; hidden /booking-test page exists (unlinked from main nav); ready to receive embed snippet. Capture the live URL (e.g., https://example-trial.squarespace.com/booking-test).
    2. **CRON_SECRET in Vercel Production env** — added (Production + Preview scopes); same value as .env.local; redeploy triggered; Vercel Crons tab shows next scheduled run. Ideally wait for one cron tick to fire 200 OK before continuing.
    3. **Gmail + aliasing confirmed** — sent a probe email to ajwegner3+booker@gmail.com; confirmed delivery to ajwegner3@gmail.com.
    4. **qa-test event type created** — exists at https://calendar-app-xi-smoky.vercel.app/nsi/qa-test; renders the public booking page with at least one bookable slot in the next 7 days.
    5. **mail-tester.com warm-up** — opened the site once; confirmed a fresh disposable address generates.

    Andrew can also verbally OK any prereq that's "good enough" (e.g., the cron tick may not have fired yet — that's fine if CRON_SECRET is in env).
  </how-to-verify>
  <resume-signal>Type "prereqs done" (or list which are not, with a plan to address)</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Add spam-folder copy line to confirmation + reminder emails</name>
  <files>
    lib/email/send-booking-confirmation.ts
    lib/email/send-reminder-booker.ts
  </files>
  <action>
    The only in-scope CONTENT edit for Phase 9 (per CONTEXT.md decision: "Fix-as-you-go content tweak triggered during deliverability QA").

    **File 1: `lib/email/send-booking-confirmation.ts`**

    Per RESEARCH.md verification: insert the line at line 122, just BEFORE the existing `<hr>` separator. The current structure ends the main body at line 121 (`</p>` closing "Need to make a change?" block), then hits the `<hr>` at line 122.

    Insert this exact line at the appropriate position:
    ```html
    <p style="margin: 0 0 16px 0; font-size: 13px; color: #888;">If you don't see this email, check your spam or junk folder and mark it as "Not Spam."</p>
    ```

    **File 2: `lib/email/send-reminder-booker.ts`**

    Per RESEARCH.md: this file uses a `segments[]` array. Push a NEW segment AFTER the lifecycle-links block (around line 171) and BEFORE the `<hr>` footer segment (around line 175). The plain-text version auto-derives via `stripHtml(html)` at line 189 — no separate text edit needed.

    Insert via:
    ```typescript
    segments.push(`<p style="margin: 0 0 16px 0; font-size: 13px; color: #888;">If you don't see this email, check your spam or junk folder and mark it as "Not Spam."</p>`);
    ```
    (or equivalent template-literal form matching the existing segments code style — read the file first to match style exactly.)

    DO NOT modify any other content, layout, or imports. The line uses inline styles only (matches existing email template conventions). It is rendered for ALL recipients (no toggle gate) — this is intentional: it's a generic deliverability nudge.
  </action>
  <verify>
    Read each file after edit. Grep for "spam or junk folder" in both files — must appear exactly once in each.
    Run `npm test` — existing email content tests (`tests/reminder-email-content.test.ts`) should still pass; new line should not break the "every href is https/path" or "subject not spammy" assertions.
  </verify>
  <done>
    Both files contain the new line in the correct position; tests still green; no other changes to either file.
  </done>
</task>

<task type="auto">
  <name>Task 3: Migrate audit-row void patterns to after() in cancel.ts + reschedule.ts</name>
  <files>
    lib/bookings/cancel.ts
    lib/bookings/reschedule.ts
  </files>
  <action>
    Per STATE.md line 275 ("Phase 9 backlog: audit-row void cleanup") and RESEARCH.md verified line numbers:

    **File 1: `lib/bookings/cancel.ts` lines 191-205** — currently `void supabase.from('booking_events').insert(...).then(...)`. Wrap in `after(() => supabase.from('booking_events').insert(...).then(...))`. Import `after` from `next/server` if not already imported (Plan 08-02 may have already added it for sendCancelEmails; verify by reading the file's imports first).

    **File 2: `lib/bookings/reschedule.ts` lines 211-226** — same pattern. Wrap the `void supabase.from('booking_events').insert(...).then(...)` block in `after(() => ...)`.

    Per STATE.md line 229 ("`after()` IS safe in `lib/bookings/*.ts`"): both functions are only called from request-scoped callers (cancelBooking → /api/cancel + cancelBookingAsOwner Server Action; rescheduleBooking → /api/reschedule). Safe to use after() in shared lib code.

    The Vitest after() shim in tests/setup.ts (STATE.md line 230) already handles test invocations — no test file changes needed.
  </action>
  <verify>
    Grep `void supabase` in lib/bookings/ — should return zero matches in cancel.ts and reschedule.ts.
    Grep `after(()` in both files — must appear at least once in each.
    Run `npm test` — all 131+ tests still pass; cancel-reschedule integration tests still green.
  </verify>
  <done>
    Both audit-row inserts wrapped in after(); no remaining `void supabase` patterns; tests green.
  </done>
</task>

<task type="auto">
  <name>Task 4: Run npm run lint and clear the 19 violations from Plan 08-02</name>
  <files>
    eslint.config.mjs
    hooks/use-mobile.ts
    app/[account]/[event-slug]/_components/booking-shell.tsx
    app/[account]/[event-slug]/_components/slot-picker.tsx
    app/[account]/[event-slug]/_components/booking-form.tsx
    app/reschedule/[token]/_components/reschedule-shell.tsx
  </files>
  <action>
    Per STATE.md line 274 + RESEARCH.md fix approach:

    **Step 1 — Run baseline:** `npm run lint` to capture current state. Specifically capture the full text of the `react-hooks/incompatible-library` error (RESEARCH Open Question 4 — not yet characterized). If the error refers to a file we don't expect to fix in this plan, log it in 09-CHECKLIST.md as deferred and DO NOT block this plan on it.

    **Step 2 — Clear 8 unused-vars warnings:** In `eslint.config.mjs`, add `argsIgnorePattern: "^_"` to the `@typescript-eslint/no-unused-vars` rule config. This clears the 8 underscore-prefixed test mock arg warnings without touching the test files themselves.

    **Step 3 — Clear 2 stale exhaustive-deps disable comments:** Grep for `// eslint-disable-next-line react-hooks/exhaustive-deps` across the codebase. The 2 flagged as "unused disable" by lint output should be removed (the rule no longer triggers there; the comment is dead).

    **Step 4 — Refactor 4 set-state-in-effect violations in booking-shell + slot-picker + reschedule-shell:** These are likely "derived state" patterns where useState + useEffect-syncing should be replaced with derived values OR `useState` initializer functions. Read each file's flagged useEffect, choose the minimal correct pattern (often just removing the useEffect and computing during render, or hoisting state to a key on the parent so child remount handles re-derivation).

    **Step 5 — Decide use-mobile.ts approach (Open Question 3 from RESEARCH.md):** This file is shadcn-generated. Two options:
    - **Option A (preferred):** Refactor with `useSyncExternalStore` (the correct pattern for matchMedia hooks). Read the existing `useIsMobile` hook; replace `useState` + `useEffect(addEventListener)` with `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`. This is ~15-20 lines of code total.
    - **Option B (fallback if Option A balloons):** Add `// eslint-disable-next-line react-hooks/set-state-in-effect` with a comment `// shadcn-generated; useSyncExternalStore refactor deferred — see FUTURE_DIRECTIONS.md`. Then log the deferral in 09-CHECKLIST.md so Plan 09-03's tech-debt section captures it.

    Default to Option A. Drop to Option B only if the refactor takes more than 15 minutes or breaks SidebarProvider tests.

    **Step 6 — Fix turnstileRef refs error in booking-form.tsx:** The error is `react-hooks/refs` for `turnstileRef.current?.reset()` inside a useEffect. Fix: move the `reset()` call out of the effect into an event handler (e.g., the form's onSubmit error path) — refs should not be read/written during render, but they CAN be read/written in event handlers. If unclear, read the surrounding code to understand when reset() needs to fire and place it accordingly.

    **Step 7 — Investigate react-hooks/incompatible-library:** Per RESEARCH Open Question 4. Run `npm run lint` again after Steps 2-6 are done. If this error persists, read the full lint output (file + line + library name). Common cause: react-hook-form interaction in booking-form.tsx (RESEARCH.md guess). Fix per the rule's documentation, OR add a targeted `// eslint-disable` with a comment + log in 09-CHECKLIST.md as a tech-debt item.

    **Final:** Run `npm run lint` — should exit 0 (or with only documented deferrals). Run `npm test` — must still be 131+ passing.
  </action>
  <verify>
    `npm run lint` exits 0 OR exits with only items explicitly documented as deferred in 09-CHECKLIST.md.
    `npm test` shows no regressions.
    `npx tsc --noEmit` is clean.
  </verify>
  <done>
    All 19 violations either resolved or explicitly deferred with inline comments + checklist entries. The codebase has a clean lint baseline going into the marathon QA.
  </done>
</task>

<task type="auto">
  <name>Task 5: Create 09-CHECKLIST.md scaffold</name>
  <files>
    .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
  </files>
  <action>
    Create the system-of-record artifact for the marathon QA session. Per CONTEXT.md: "Granularity: Criterion-level (8 items from ROADMAP success criteria), not sub-item level." Per CONTEXT.md decisions: pass bar is strict by default; Andrew can call "defer to v1.1" on any item at the time it surfaces.

    Structure (Markdown, exact format Claude's discretion per CONTEXT.md):

    ```markdown
    # Phase 9 Manual QA Checklist

    **Session start:** [TIMESTAMP — fill at start of Plan 09-02]
    **Driver:** Andrew (executor) + Claude (proposer / scribe)
    **Pass bar:** Strict by default. Any item may be downgraded to "deferred to v1.1" by Andrew at the time of surface — captured in the Notes column and propagated to FUTURE_DIRECTIONS.md.

    ## Pre-flight (Plan 09-01 artifacts)

    - [ ] All 5 prereqs confirmed done (Squarespace trial, Vercel CRON_SECRET, Gmail alias, qa-test event type, mail-tester warm-up)
    - [ ] Spam-folder copy line live in production confirmation email (commit: ___)
    - [ ] Spam-folder copy line live in production reminder email (commit: ___)
    - [ ] Audit-row after() migration in cancel.ts + reschedule.ts (commit: ___)
    - [ ] Lint cleanup completed; npm run lint exits 0 (commit: ___; deferred items: ___)

    ## Marathon Criteria (Plan 09-02)

    | # | Criterion | Status | Timestamp | Notes |
    |---|-----------|--------|-----------|-------|
    | 1 | Embed live on Squarespace, end-to-end booking, no JS errors | __ | __ | __ |
    | 2 | .ics opens correctly in Gmail web/iOS, Outlook web/desktop (cancel + reschedule lifecycle) + Apple Mail code review findings — record as "PASS (Apple Mail: code-review-only, deferred)" not unqualified PASS, per CONTEXT.md no-device-access deferral | __ | __ | __ |
    | 3 | mail-tester.com >= 9/10 for confirmation AND reminder | __ | __ | __ |
    | 4 | DST/timezone correctness verified — Notes column MUST record (a) Andrew's substitution-approval signal verbatim if applicable and (b) the substitute method used (e.g., "cross-timezone NY/Chicago"); if not substituted, record actual method used | __ | __ | __ |
    | 5 | Responsive at 320 / 768 / 1024 (hosted + embed) | __ | __ | __ |
    | 6 | Multi-tenant UI isolation (manual login as 2nd test user) | __ | __ | __ |
    | 7 | FUTURE_DIRECTIONS.md committed to repo root (Plan 09-03) | __ | __ | __ |
    | 8 | Andrew explicit ship sign-off | __ | __ | __ |

    ## Phase 8 dashboard walkthrough (sub-criteria, part of #1-#6 evidence collection)

    - [ ] Bookings list filters / pagination / sort
    - [ ] Booking detail page (answers + owner-note autosave + history timeline + action bar)
    - [ ] Reminder settings toggles
    - [ ] Event-type Location field persistence
    - [ ] Reminder email arrives in inbox with correct branding + toggles
    - [ ] Vercel Cron dashboard shows green ticks
    - [ ] Rate-limit smoke test (3 endpoints): /api/bookings, /api/cancel, /api/reschedule each return 429 + Retry-After when hit rapidly
    - [ ] Sidebar Settings group renders Reminder Settings entry
    - [ ] Branding editor file-rejection edge cases (JPG / >2MB / spoofed MIME)

    ## Apple Mail code review findings (logged here, propagated to FUTURE_DIRECTIONS.md §5)

    *Filled in by Plan 09-02 — code review of lib/email/, lib/email/build-ics.ts, lib/email/branding-blocks.ts*

    ## Deferrals to v1.1

    *Any criterion downgraded by Andrew during the session — captured here with reason*

    ## Sign-off

    - [ ] Andrew reviewed all entries above
    - [ ] Andrew explicit verbal sign-off ("ship v1")
    - **Sign-off timestamp:** __
    ```

    Adjust column widths and section ordering as needed for readability. The checklist is a living document — Plan 09-02 will update it inline as criteria are verified.
  </action>
  <verify>
    File exists at .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md.
    Contains the 8 ROADMAP success criteria as table rows.
    Contains the 9 Phase 8 dashboard walkthrough sub-criteria.
    Contains placeholder sections for Apple Mail findings, deferrals, and sign-off.
  </verify>
  <done>
    Checklist scaffold is in place and ready for Plan 09-02 to fill in.
  </done>
</task>

<task type="auto">
  <name>Task 6: Push all Plan 09-01 changes to origin/main and confirm Vercel deploy is green</name>
  <files>
    (no file changes — git + verification)
  </files>
  <action>
    Per STATE.md line 222 "PROCESS LOCK: Push to origin/main before live Vercel checkpoints":

    1. `git status` — verify all expected files are staged/committed.
    2. Atomic commits per task (Task 2 spam-folder, Task 3 after() migration, Task 4 lint cleanup, Task 5 checklist scaffold) — follow the project's atomic-commit convention. If any tasks were already committed during execution, skip; otherwise commit now.
    3. `git push origin main`.
    4. Wait for Vercel deploy to finish — check Vercel dashboard (https://vercel.com → calendar-app project → Deployments). Latest deploy must show green check.
    5. Smoke-confirm the live site loads — visit https://calendar-app-xi-smoky.vercel.app/nsi/qa-test, confirm the public booking page renders.
  </action>
  <verify>
    `git status` shows clean working tree.
    `git log origin/main` includes the 4 task commits (or fewer atomic commits if naturally combined).
    Vercel deploy is green.
    https://calendar-app-xi-smoky.vercel.app/nsi/qa-test responds 200.
  </verify>
  <done>
    All Plan 09-01 code changes are live in production. Plan 09-02 can begin.
  </done>
</task>

</tasks>

<verification>
- All 5 prereqs confirmed done by Andrew
- Spam-folder copy line in both email templates (committed + deployed)
- Audit-row patterns migrated to after() in cancel.ts + reschedule.ts (committed + deployed)
- npm run lint exits 0 (or has only documented deferrals)
- 09-CHECKLIST.md scaffolded with 8 criteria + Phase 8 sub-criteria + deferral section
- All commits pushed to origin/main; Vercel deploy green
- npm test still 131+ passing
</verification>

<success_criteria>
- All Plan 09-01 must_haves satisfied
- Plan 09-02 has no remaining blockers
- Code under test in Plan 09-02 includes the spam-folder copy line and lint cleanup
</success_criteria>

<output>
After completion, create `.planning/phases/09-manual-qa-and-verification/09-01-SUMMARY.md` summarizing prereqs confirmed, code edits applied, lint outcome, and any deferrals captured for FUTURE_DIRECTIONS.md.
</output>
