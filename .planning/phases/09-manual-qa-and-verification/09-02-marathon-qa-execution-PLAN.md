---
phase: 09-manual-qa-and-verification
plan: "09-02"
type: execute
wave: 2
depends_on: ["09-01"]
files_modified:
  - .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
autonomous: false

must_haves:
  truths:
    - "Criterion #1 verified: widget embedded on Squarespace test page; end-to-end booking completed; zero JS errors in host console; multi-mount + idempotency tests pass"
    - "Criterion #2 verified: .ics opens correctly across Gmail web, Gmail iOS, Outlook web, Outlook desktop with correct title/time/timezone/organizer; cancel removes event; reschedule updates in-place. Apple Mail code review findings logged"
    - "Criterion #3 verified: mail-tester.com >= 9/10 for confirmation AND reminder emails (one retry allowed; sub-9 documented in checklist + FUTURE_DIRECTIONS.md)"
    - "Criterion #4 verified: timezone correctness — booker in different TZ than owner sees correct local times in email + .ics; or November 1 2026 DST-spanning booking succeeds"
    - "Criterion #5 verified: hosted booking page + embed render correctly at 320px / 768px / 1024px"
    - "Criterion #6 verified: manual login as andrewjameswegner@gmail.com (nsi-rls-test owner) shows ZERO of Andrew's bookings/event-types/availability/branding"
    - "Phase 8 9-item dashboard walkthrough complete; each sub-criterion logged PASS/FAIL/DEFERRED"
    - "09-CHECKLIST.md updated with PASS/FAIL/DEFERRED + timestamps + notes per criterion"
    - "Any failures fixed inline (or explicitly deferred per Andrew); fix commits shipped + re-verified before continuing"
  artifacts:
    - path: ".planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md"
      provides: "Filled-in checklist with all 8 criteria + Phase 8 sub-criteria marked"
      contains: "PASS"
  key_links:
    - from: "Squarespace /booking-test page"
      to: "calendar-app-xi-smoky.vercel.app/embed/nsi/qa-test"
      via: "widget.js iframe injection + postMessage height protocol"
      pattern: "data-nsi-calendar"
    - from: "qa-test booking confirmation email"
      to: "Each tested mail client's calendar"
      via: ".ics attachment with METHOD:REQUEST"
      pattern: "METHOD:REQUEST"
---

<objective>
Execute the marathon QA verification of all 8 ROADMAP success criteria for Phase 9. This is a human-driven session: Claude proposes the next item to verify with how-to instructions, Andrew executes and reports back, Claude updates the checklist. Failures trigger fix-as-you-go (quick patch → ship → re-verify → continue) with Andrew's call on deferrals.

Purpose: Prove the v1 build works end-to-end on real systems with real email clients before Andrew signs off. This is the gate between "code complete" and "shippable v1."

Output: A fully populated 09-CHECKLIST.md with PASS/FAIL/DEFERRED per criterion, timestamps, and notes. Apple Mail code-review findings logged. Any inline-fixed bugs committed + deployed. Set the stage for Plan 09-03 (FUTURE_DIRECTIONS.md authoring) and final sign-off.
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

# Source files for Apple Mail code review
@lib/email/send-booking-confirmation.ts
@lib/email/send-reminder-booker.ts
@lib/email/build-ics.ts
@lib/email/branding-blocks.ts
@lib/email/send-cancel-emails.ts
@lib/email/send-reschedule-emails.ts
</context>

<execution_pattern>
Each task below is one criterion verification. The pattern PER CRITERION is:

1. **Claude action:** Propose the verification approach (the "how-to-verify" details below). Identify any setup the user needs (URLs to open, accounts to log in to). Update 09-CHECKLIST.md to mark the criterion as "in progress" with start timestamp.
2. **Andrew action:** Execute the steps and report back PASS / FAIL / DEFERRED with notes.
3. **Claude action:** Update 09-CHECKLIST.md with the result, end timestamp, and any notes/screenshots/error messages Andrew shared.
4. **On FAIL:** Pause this plan, drop into a quick patch (read affected file → fix → commit → push → wait for Vercel deploy → ask Andrew to re-test the SAME criterion). DO NOT proceed to the next criterion until the current one is PASS or explicitly DEFERRED.
5. **On DEFERRED:** Capture the reason in checklist Notes column AND queue for Plan 09-03 FUTURE_DIRECTIONS.md.

Sequencing follows RESEARCH.md Recommended Sequencing (Block A → H). Critical: Task 2 (Reminder mail-tester) requires Andrew to BOOK A SLOT ~23h OUT AT SESSION START — do this in Task 1 setup so the cron tick can fire before the session ends.
</execution_pattern>

<tasks>

<task type="auto">
  <name>Task 1 (Claude action, no checkpoint): Apple Mail code review + log findings</name>
  <files>
    .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
    (read-only: lib/email/, lib/email/build-ics.ts, lib/email/branding-blocks.ts, all email senders)
  </files>
  <action>
    Per CONTEXT.md decision: Apple Mail not testable (no device access). Claude does a code-level review of email patterns known to render poorly in Apple Mail. RESEARCH.md Apple Mail Code-Review Checklist provides the verified known findings — most are already cleared (table-based layout, inline styles, system font stack confirmed compatible).

    Steps:
    1. Grep `lib/email/` for: `position:absolute`, `display:flex`, `linear-gradient`, `var(--`, `@font-face`, `border-radius`. Most should be absent (confirmed in RESEARCH.md). Border-radius is present on `<a>` button elements in `branding-blocks.ts:70` — note as low-risk cosmetic in older Apple Mail.
    2. Read `lib/email/build-ics.ts` — confirm PRODID auto-inserted (ical-generator default), VTIMEZONE block via timezones-ical-library, METHOD set per scenario (REQUEST/CANCEL), SEQUENCE 0 on initial / 1 on reschedule+cancel, UID stable (booking.id UUID), CRLF + line folding handled by library.
    3. Confirm ORGANIZER email in .ics matches the SMTP From address (both should be account.owner_email = Andrew's Gmail). Critical for METHOD:CANCEL auto-removal in Apple Mail.
    4. Note: NSI_MARK_URL=null in `branding-blocks.ts:44` means "Powered by NSI" footer is text-only (no broken-image risk).

    Log findings into 09-CHECKLIST.md "Apple Mail code review findings" section with verdict + supporting evidence. The findings will be lifted into FUTURE_DIRECTIONS.md §5 by Plan 09-03.

    No Andrew action needed for this task. Run it concurrently with Andrew getting set up for Task 2 if helpful.
  </action>
  <verify>
    09-CHECKLIST.md "Apple Mail code review findings" section is filled in with at least 5 fact-bullets (HTML patterns, .ics PRODID, .ics METHOD/SEQUENCE/UID, ORGANIZER match, NSI mark text-only).
  </verify>
  <done>
    Apple Mail code review complete; findings logged for Plan 09-03 to lift into FUTURE_DIRECTIONS.md.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Criterion #3 — Reminder mail-tester (BOOK FIRST, score later)</name>
  <what-built>
    Per RESEARCH.md Open Question 2: the reminder cron fires hourly at the top of the hour, and only sends to bookings <24h out with reminder_sent_at IS NULL. To verify the reminder email's mail-tester score, Andrew must book the test slot at the START of the session so the cron has time to fire before the session ends.
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES:**

    Steps for Andrew:
    1. Open https://www.mail-tester.com — copy the fresh disposable address (valid 10 minutes).
    2. **WITHIN 5 MINUTES** of copying it: Visit https://calendar-app-xi-smoky.vercel.app/nsi/qa-test. Pick a date/time approximately 22-23 hours from now (just inside the <24h reminder window). Fill the form with the mail-tester address as the booker email + any name + any phone + dummy answers. Submit.
    3. Confirm booking succeeds (confirmation page renders).
    4. Note the booking time (e.g., "booked for 2026-04-28 14:30 CDT") and the time the booking was created (so we can predict when the next cron tick will fire and send the reminder).
    5. **The mail-tester score for the REMINDER will be retrieved later** in Task 6, after the cron fires.

    **In parallel right now:** while waiting for the reminder cron, Andrew should ALSO send a confirmation email to a SECOND mail-tester address (Task 6 below covers this) — both scores get evaluated in Task 6.

    Capture in checklist: booking time, booker email used (mail-tester address), expected reminder send time (next cron tick after `start_at - 24h`).
  </how-to-verify>
  <resume-signal>Type "booked for reminder mail-tester at &lt;booking_time&gt;, mail-tester address: &lt;address&gt;" or report any failure</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Criterion #2 — .ics correctness across Gmail/Outlook clients</name>
  <what-built>
    Booking confirmation, cancel, and reschedule emails each ship a .ics attachment. Per CONTEXT.md "exhaustive": accept invite + verify on calendar + then cancel/reschedule via email link triggers proper update.
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md Per-Criterion #2):**

    **Phase A — Confirmation .ics:**
    1. Book a qa-test slot using `ajwegner3+booker2@gmail.com` via https://calendar-app-xi-smoky.vercel.app/nsi/qa-test. Pick any time at least 1h out (avoid the reminder window for THIS booking — Task 2 owns the reminder test).
    2. Open the resulting confirmation email in EACH of these clients:
       - Gmail web (https://mail.google.com)
       - Gmail iOS (mobile app)
       - Outlook web (https://outlook.live.com — sign in with any Microsoft account)
       - Outlook desktop (Windows desktop client)
    3. In each client: click the inline calendar card (Gmail) or "Accept" (Outlook). Verify the event appears on the calendar with:
       - Title = "QA Test" (or whatever the event type name is)
       - Date/time = correct in the client's local timezone
       - Organizer = ajwegner3@gmail.com (or NSI account name)

    **Phase B — Cancel .ics:**
    4. In ANY client: click the "Cancel booking" link in the confirmation email. Confirm cancel on the resulting page.
    5. Open the cancellation email in each of the 4 clients. Click the calendar card / "Remove from calendar" button.
    6. Verify the event is REMOVED from each calendar (METHOD:CANCEL auto-removal).

    **Phase C — Reschedule .ics:**
    7. Book ANOTHER qa-test slot (use ajwegner3+booker3@gmail.com so Phase A's email doesn't pollute).
    8. Click "Reschedule" link in confirmation email. Pick a different time. Confirm.
    9. Open the reschedule email in each client. Verify the calendar event is UPDATED IN-PLACE (same event, new time — NOT a duplicate). This tests METHOD:REQUEST + SEQUENCE:1.

    **PASS criteria:** All 4 clients show correct event creation on confirmation, removal on cancel, and in-place update on reschedule.

    **Likely partial pass:** Outlook desktop on Windows may handle SEQUENCE differently than web. Note any client-specific quirks in the checklist.
  </how-to-verify>
  <resume-signal>Type "criterion 2 PASS" or "criterion 2 FAIL: &lt;client&gt; — &lt;detail&gt;" or "criterion 2 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Criterion #4 — Timezone correctness (DST decision: cross-timezone booking)</name>
  <what-built>
    Per RESEARCH.md Open Question 1 + CONTEXT.md Claude's discretion: March 8 2026 DST is past; instead of waiting for November 1 2026, verify timezone correctness via a CROSS-TIMEZONE booking. This covers the timezone math (the actual concern) without requiring a future date. The automated DST tests in `lib/slots.test.ts` (Plan 04-02) already prove DST math is correct at the algorithm level; this manual check is the email + .ics verification.

    **DECISION (resolved by planner):** Use cross-timezone test (booker in America/New_York, owner in America/Chicago). NOT November 1 2026 (too far out, and date-overrides may not exist). Document this decision in the checklist.
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES:**

    1. Open https://calendar-app-xi-smoky.vercel.app/nsi/qa-test in a fresh browser window.
    2. **Override timezone to America/New_York** via Chrome DevTools: F12 → 3-dot menu → More tools → Sensors → Location → "Other..." → set Timezone ID to America/New_York. Reload the page.
    3. The booking page should detect the new TZ and show slots in Eastern time. Pick a slot (e.g., "10:00 AM EDT").
    4. Submit the booking with `ajwegner3+nyc@gmail.com`.
    5. Open the confirmation email in Gmail web. Verify:
       - Email body shows the time in EDT (Eastern, e.g., "10:00 AM EDT" or "10:00 AM Eastern Time")
       - Email body does NOT show the owner's CDT time as the primary
    6. Click the .ics attachment to add to Google Calendar (which is set to whatever timezone the Gmail account uses — likely CDT since this is Andrew's Gmail).
    7. Verify the event on the calendar shows the EQUIVALENT local time in CDT (e.g., 9:00 AM CDT = 10:00 AM EDT).
    8. Open the .ics file directly in a text editor (download the attachment). Verify:
       - DTSTART has TZID=America/Chicago (owner timezone — VTIMEZONE source of truth)
       - VTIMEZONE block exists with correct DST rules
       - No floating times (no DTSTART without TZID or Z suffix)

    **PASS criteria:** Email times match booker's submitted timezone (EDT); .ics correctly converts via VTIMEZONE; calendar adds the event at the correct local time.

    Reset DevTools sensor timezone to "No override" when done.
  </how-to-verify>
  <resume-signal>Type "criterion 4 PASS" or "criterion 4 FAIL: &lt;detail&gt;" or "criterion 4 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Criterion #1 — Embed live test on Squarespace (after prereq site is set up)</name>
  <what-built>
    The widget.js script + `<div data-nsi-calendar="...">` snippet, when pasted into a third-party https:// page, must inject a working iframe that auto-resizes via postMessage. Tests: render, full booking flow, no JS errors, multi-mount, idempotency.
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md Per-Criterion #1):**

    **Phase A — Get the snippet:**
    1. In the calendar app: Dashboard → Event Types → kebab menu on the qa-test row → "Get embed code" (or similar). Copy the Script tab snippet:
       ```html
       <div data-nsi-calendar="nsi/qa-test"></div>
       <script src="https://calendar-app-xi-smoky.vercel.app/widget.js" defer></script>
       ```

    **Phase B — Paste into Squarespace:**
    2. Log in to Squarespace trial. Navigate to the hidden /booking-test page.
    3. Edit the page. Add a "Code" block (NOT "Embed" — Code block accepts raw HTML/JS).
    4. Paste the snippet. Save the block. Save/publish the page.

    **Phase C — Verify on the live URL:**
    5. Open the published URL in a fresh tab (e.g., https://your-trial.squarespace.com/booking-test). NOT in the Squarespace editor preview (Pitfall 2 from RESEARCH.md).
    6. Open browser DevTools (F12) → Console tab.
    7. Verify:
       - Skeleton appears, then booking flow renders inside iframe
       - Zero JS errors in host console
       - Iframe auto-resizes to content height (no scroll-within-iframe)
    8. Complete a full booking: pick date/time, fill form, submit. Use `ajwegner3+embed@gmail.com`.
    9. Verify confirmation page renders inside iframe + confirmation email arrives.

    **Phase D — Multi-mount + idempotency:**
    10. Edit the page again. Add a SECOND `<div data-nsi-calendar="nsi/qa-test"></div>` BEFORE the script tag (or after — script handles all divs on the page).
    11. Save + reload published page. Verify BOTH widgets render independently.
    12. Edit again. Duplicate the `<script src="...widget.js" defer></script>` tag. Save + reload. Verify only ONE widget per div renders (no double-init via the `window.__nsiWidgetLoaded` guard).

    **PASS criteria:** All 4 phases work; zero JS errors; full booking succeeds.
  </how-to-verify>
  <resume-signal>Type "criterion 1 PASS" or "criterion 1 FAIL: &lt;phase&gt;: &lt;detail&gt;" or "criterion 1 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 6: Criterion #3 — mail-tester scoring (confirmation + reminder)</name>
  <what-built>
    Two mail-tester runs: confirmation email (book NOW with fresh address) + reminder email (Task 2 already booked the slot; cron will have fired by now or fires soon).
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md Per-Criterion #3):**

    **Confirmation email mail-tester:**
    1. Open https://www.mail-tester.com — get a fresh disposable address.
    2. Within 5 minutes: book a qa-test slot at https://calendar-app-xi-smoky.vercel.app/nsi/qa-test using the mail-tester address.
    3. Wait 30-60 seconds. Click "Then check your score" on mail-tester.com.
    4. Record the score. **PASS:** >= 9/10. **FAIL:** < 9/10 — note the specific deductions (SPF / DKIM / DMARC / content / no plain-text).
    5. **One retry allowed** (per CONTEXT.md): if < 9/10, get a fresh address, book again, retest. Same retry policy applies.

    **Reminder email mail-tester:**
    6. Check inbox for the booking made in Task 2. The reminder email should arrive within an hour of `start_at - 24h`. If `start_at` was ~22-23h from Task 2 timestamp, reminder should already have fired (CRON fires at top of hour with CAS guard).
    7. If reminder has NOT yet arrived: check Vercel Cron dashboard for green ticks. If cron fired but no email arrived, the issue is in the send path — investigate logs. If cron has not fired yet, wait OR manually trigger via:
       ```
       curl -H "Authorization: Bearer $CRON_SECRET" https://calendar-app-xi-smoky.vercel.app/api/cron/send-reminders
       ```
    8. Forward the reminder email to a fresh mail-tester address (mail-tester accepts forwards). Wait + check score.
    9. Same PASS bar (>= 9/10) + retry policy.

    **Sub-9 handling:** If either email scores < 9/10 after retry, log the specific deductions in checklist Notes column. Do NOT block ship (per CONTEXT.md: "clients will be actively looking for booking emails — even modest deliverability is workable"). The deductions go into FUTURE_DIRECTIONS.md as "Untested deliverability follow-up."
  </how-to-verify>
  <resume-signal>Type "criterion 3 PASS: confirmation N/10, reminder M/10" or "criterion 3 partial: &lt;detail&gt;" or "criterion 3 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 7: Criterion #5 — Responsive 320 / 768 / 1024</name>
  <what-built>
    Hosted booking page (`/nsi/qa-test`) AND embed page (`/embed/nsi/qa-test`) AND embedded widget on Squarespace must render correctly at all 3 breakpoints with no overflow, tappable buttons, readable form inputs.
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md Per-Criterion #5):**

    1. Open Chrome. Visit https://calendar-app-xi-smoky.vercel.app/nsi/qa-test.
    2. F12 → Toggle Device Toolbar (Ctrl+Shift+M). Set viewport width to **320px**. Scroll through:
       - Form inputs visible + full-width
       - Buttons tap-reachable (>= 44px height target)
       - No horizontal overflow
       - Time slot grid wraps cleanly
    3. Repeat at **768px** and **1024px**.
    4. Visit https://calendar-app-xi-smoky.vercel.app/embed/nsi/qa-test (the iframe content directly). Repeat at all 3 breakpoints.
    5. Visit the Squarespace test page (set up in Task 5). Test the embedded widget at all 3 breakpoints. Verify the iframe auto-resize via postMessage adjusts the iframe height correctly at each breakpoint.

    **PASS criteria:** All 3 surfaces (hosted, embed direct, embed-on-Squarespace) render cleanly at all 3 breakpoints. No horizontal scroll. No clipped text. No buttons smaller than ~44px tap target.
  </how-to-verify>
  <resume-signal>Type "criterion 5 PASS" or "criterion 5 FAIL: &lt;breakpoint&gt; &lt;surface&gt;: &lt;detail&gt;" or "criterion 5 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 8: Criterion #6 — Multi-tenant UI isolation (manual probe)</name>
  <what-built>
    Per CONTEXT.md: trust the automated RLS matrix test (Plan 08-08) for programmatic isolation. This task is the UX-layer confirmation: log in as the second seeded test owner and verify dashboard surfaces NONE of Andrew's account data.
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md Per-Criterion #6):**

    1. Open a FRESH browser (or incognito window) to ensure no session leakage from Andrew's primary login.
    2. Visit https://calendar-app-xi-smoky.vercel.app/app/login.
    3. Sign in as `andrewjameswegner@gmail.com` with the password from `.env.local` `TEST_OWNER_2_PASSWORD` (the second seeded user, account slug `nsi-rls-test`).
    4. After login, dashboard should render. Inspect each surface:
       - **Dashboard / Bookings list** (`/app/bookings`): should be EMPTY or show only `nsi-rls-test` bookings. Zero of Andrew's `nsi` bookings.
       - **Event Types** (`/app/event-types`): zero of `nsi`'s event types (no qa-test, no Andrew's real types).
       - **Availability** (`/app/availability`): shows `nsi-rls-test` rules only (likely defaults).
       - **Branding** (`/app/branding`): shows `nsi-rls-test` branding (likely defaults — no NSI logo, no NSI navy color).
       - **Settings → Reminder Settings** (`/app/settings/reminders`): shows `nsi-rls-test` toggles (likely default true).
    5. Log out via the user menu. Confirm session cleared (visiting `/app/bookings` after logout redirects to `/app/login`).

    **PASS criteria:** All 5 surfaces show ZERO leakage of Andrew's nsi account data.
  </how-to-verify>
  <resume-signal>Type "criterion 6 PASS" or "criterion 6 FAIL: &lt;surface&gt;: &lt;leak detail&gt;" or "criterion 6 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 9: Phase 8 dashboard 9-item walkthrough (sub-criteria, evidence-collection for #1-#6)</name>
  <what-built>
    Per STATE.md line 283 and Plan 08-08 deferred items: a 9-item sweep of Phase 8 dashboard surfaces. Most are quick PASS/FAIL checks; one (rate-limit live verification) requires deliberate abuse.
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (run as Andrew, log each in checklist):**

    1. **Bookings list filters/pagination/sort** — `/app/bookings` → toggle status filters (upcoming / all / confirmed / cancelled / rescheduled), date-range filters, event-type multi-select, search box. Verify URL updates + results match.
    2. **Booking detail page** — click a booking. Verify: custom-question answers render; owner-note textarea autosaves with "Saved" pill; history timeline shows created/cancelled/rescheduled/reminder-sent events with correct timestamps; action bar has Cancel button + kebab.
    3. **Reminder settings toggles** — `/app/settings/reminders` → flip each of 3 toggles. Verify Sonner toast + state persists on reload.
    4. **Event-type Location field persistence** — `/app/event-types/[id]/edit` (any existing event type) → set location to "123 Main St" → save → reload → confirm value persists. Set to empty → save → confirm null behavior (block omitted in next reminder email).
    5. **Reminder email branding + toggles** — verify the reminder email from Task 2 (or trigger a fresh one) renders with: NSI logo at top (if logo_url set; otherwise no img), brand-colored H1 + CTA, "Powered by NSI" text footer, conditional blocks (location / answers / lifecycle links) match the toggles set in step 3.
    6. **Vercel Cron dashboard** — Vercel Dashboard → calendar-app project → Settings → Crons. Verify the `/api/cron/send-reminders` cron has fired recently with green status (200 OK).
    7. **Rate-limit smoke (3 endpoints, light)** — open DevTools Network tab. Hit each endpoint rapidly:
       - `/api/bookings`: 21 POSTs in <5min → 21st returns 429 + Retry-After
       - `/api/cancel`: 11 POSTs in <5min from same IP → 11th returns 429
       - `/api/reschedule`: 11 POSTs in <5min from same IP → 11th returns 429
       Use a quick fetch loop in the DevTools Console; payloads can be intentionally invalid (Zod fails first) — the rate limiter increments BEFORE Zod per Plan 08-03 STATE.md line 234. Cleanup: nothing to clean (rate_limit_events expire naturally).
    8. **Sidebar entries** — verify sidebar shows: Bookings, Event Types, Availability, Branding (top group) + Settings → Reminder Settings (settings group). All clickable + routes correctly.
    9. **Branding editor file-rejection** (per STATE.md line 278): upload (a) a real JPG → expect toast "PNG only"; (b) a PNG > 2 MB → expect toast "File too large"; (c) a JPEG renamed to `.png` (spoofed MIME) → expect toast "PNG only" (magic-byte check catches it).

    Each sub-item is a checklist row; PASS or FAIL per row. Failures get fix-as-you-go OR deferred.
  </how-to-verify>
  <resume-signal>Type "phase 8 walkthrough done: &lt;N&gt;/9 PASS, FAILs: &lt;list&gt;" or "all 9 PASS"</resume-signal>
</task>

<task type="auto">
  <name>Task 10: Final 09-CHECKLIST.md update + handoff to Plan 09-03</name>
  <files>
    .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
  </files>
  <action>
    Aggregate all session results into 09-CHECKLIST.md:
    - Set status (PASS / FAIL / DEFERRED) on each of the 8 ROADMAP criteria
    - Set status on each of the 9 Phase 8 sub-criteria
    - Confirm Apple Mail code review findings logged (from Task 1)
    - Populate the "Deferrals to v1.1" section with any items downgraded by Andrew
    - Capture the session end timestamp

    Plan 09-03 will read this file to populate FUTURE_DIRECTIONS.md.

    DO NOT collect Andrew's sign-off here — sign-off is Plan 09-03 Task 3 (after FUTURE_DIRECTIONS.md is committed).

    If ANY of criteria 1-6 are FAIL (not deferred), STOP and signal CHECKPOINT REACHED — sign-off cannot proceed until those are resolved or explicitly deferred.
  </action>
  <verify>
    09-CHECKLIST.md has every row populated for criteria #1-#6 + 9 sub-criteria + Apple Mail findings + deferrals section.
    Section #7 (FUTURE_DIRECTIONS.md) and #8 (sign-off) remain pending — these are Plan 09-03's responsibility.
  </verify>
  <done>
    09-CHECKLIST.md is the source of truth for the marathon session. Plan 09-03 can begin.
  </done>
</task>

</tasks>

<verification>
- All 6 marathon criteria (#1-#6) marked PASS or DEFERRED in 09-CHECKLIST.md
- Apple Mail code review findings logged
- Phase 8 9-item walkthrough complete; results in checklist
- Any inline fixes during the session are committed + deployed + retested
- 09-CHECKLIST.md ready for Plan 09-03 to populate FUTURE_DIRECTIONS.md from it
</verification>

<success_criteria>
- All Plan 09-02 must_haves satisfied
- Andrew has explicit visibility into every PASS/FAIL/DEFERRED outcome via the checklist
- No surprise blockers remain for Plan 09-03 sign-off
</success_criteria>

<output>
After completion, create `.planning/phases/09-manual-qa-and-verification/09-02-SUMMARY.md` summarizing the marathon session: total criteria, pass count, fail count, deferral count, time elapsed, fix-as-you-go commits if any.
</output>
