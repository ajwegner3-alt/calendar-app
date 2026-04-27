# Phase 9: Manual QA & Verification - Research

**Researched:** 2026-04-27
**Domain:** Manual verification, email deliverability, iCalendar clients, embed testing, code hygiene
**Confidence:** HIGH (all findings are codebase-verified or from established STATE.md locks)

---

## What This Phase Is

Phase 9 is a marathon verification session, not a feature-building session. All code shipped in Phases 1-8 is already deployed to production (`calendar-app-xi-smoky.vercel.app`). The work here is: confirm it works end-to-end on real systems with real email clients, fix anything that fails inline, document what was found, and have Andrew explicitly sign off.

The output artifacts are `09-CHECKLIST.md` (live log maintained by Claude during the session), `FUTURE_DIRECTIONS.md` (committed to repo root), and Andrew's sign-off. There are two in-scope code changes: (1) spam-folder copy line added to confirmation and reminder emails, and (2) lint/void cleanup of 19 ESLint violations + 2 `void` audit-row patterns. Everything else is verify-and-report.

The biggest sequencing constraint is that Criterion #1 (embed) is gated on Andrew spinning up a Squarespace 14-day trial BEFORE the session starts. If that prereq is not done, embed testing blocks until it is. All other criteria can run without it.

---

## Codebase Landmarks

All file paths verified against the live repo.

### Spam-folder copy line (the only in-scope content edit)

**File 1:** `lib/email/send-booking-confirmation.ts`
- Insert the copy line at **line 122**, just before the `<hr>` separator. The current structure ends the main body at line 121 (`</p>` closing "Need to make a change?" block), then hits the `<hr>` at line 122.
- Exact insertion point: after the closing `</p>` at line 121, before the `<hr style="border: none; ..."/>` at line 122.
- The file has no plain-text (`text:`) alternative — only `html`. The spam-folder line should go in the HTML body only.

**File 2:** `lib/email/send-reminder-booker.ts`
- The reminder sender uses a `segments[]` array. The spam-folder copy goes into a new segment pushed after the lifecycle-links block (line ~180) and before the `<hr>` footer segment.
- This file already sends a `text` plain-text alternative (line 189: `const text = stripHtml(html)`) — the plain-text version will auto-derive from the HTML strip.
- Exact insertion point: between the lifecycle-links `segments.push(...)` block (ending around line 171) and the footer `<hr>` `segments.push(...)` (around line 175).

**Recommended copy:** `<p style="margin: 0 0 16px 0; font-size: 13px; color: #888;">If you don't see this email, check your spam or junk folder and mark it as "Not Spam."</p>`

### Lint cleanup targets

**19 violations from Plan 08-02 (verified in 08-02-SUMMARY.md):**

Errors (8 total):
- `react-hooks/set-state-in-effect` × 6: `app/[account]/[event-slug]/_components/booking-shell.tsx`, `app/[account]/[event-slug]/_components/slot-picker.tsx`, `app/reschedule/[token]/_components/reschedule-shell.tsx`, `hooks/use-mobile.ts`
- `react-hooks/refs` × 1: `app/[account]/[event-slug]/_components/booking-form.tsx` (turnstileRef.current?.reset() inside effect)
- `react-hooks/incompatible-library` × 1: likely react-hook-form interaction

Warnings (11 total):
- `@typescript-eslint/no-unused-vars` × 8: underscore-prefixed args in test mocks
- `react-hooks/exhaustive-deps` "unused disable" × 2: stale eslint-disable comments
- Misc × 1

**Fix approach (from STATE.md line 274):**
1. Add `argsIgnorePattern: "^_"` to `@typescript-eslint/no-unused-vars` rule in `eslint.config.mjs` — clears 8 warnings.
2. Remove 2 stale `// eslint-disable-next-line react-hooks/exhaustive-deps` comments.
3. Refactor `use-mobile.ts` `set-state-in-effect` with `useSyncExternalStore` pattern.
4. Refactor booking-shell/slot-picker/reschedule-shell `set-state-in-effect` hits with lazy initial state or event-handler patterns.
5. Fix `turnstileRef` refs error in `booking-form.tsx`.
6. Investigate `react-hooks/incompatible-library` error.

### Audit-row void cleanup targets

**File 1:** `lib/bookings/cancel.ts` lines 191-205 — `void supabase.from('booking_events').insert(...).then(...)`
**File 2:** `lib/bookings/reschedule.ts` lines 211-226 — `void supabase.from('booking_events').insert(...).then(...)`

Fix: wrap each in `after(() => supabase.from('booking_events').insert(...).then(...))` — same pattern as the email sends. Both functions are only called from request-scoped callers (cancel.ts from `/api/cancel` Route Handler + `cancelBookingAsOwner` Server Action; reschedule.ts from `/api/reschedule` Route Handler), so `after()` is safe.

### Apple Mail code-review targets

**`lib/email/build-ics.ts`** — confirmed present. The file uses `ical-generator` + `timezones-ical-library`. Key patterns to review:

**`lib/email/branding-blocks.ts`** — confirmed present. Uses `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` system font stack (fine), table-based layout (fine), inline styles only (fine).

**`lib/email/send-booking-confirmation.ts`** — confirmed present.
**`lib/email/send-reminder-booker.ts`** — confirmed present.

---

## Recommended Sequencing

The marathon session should run in this order. Rationale: start with code-changes-that-produce-emails first (so emails are ready to test), then do the email testing, then move to embed (which has the longest manual setup dependency), then close with housekeeping and sign-off.

### Block A: Pre-flight (before any verification)
1. Confirm all 5 prereqs are done (CRON_SECRET in Vercel, Squarespace trial site exists, booker alias confirmed, test event type `qa-test` created, mail-tester.com address generation tested).
2. Make the 2 in-scope code changes — spam-folder copy line (confirmation + reminder) — and push to production. These changes must be live before mail-tester runs.
3. Make lint + void cleanup changes — push to production. These are pure code health, unblock a clean `npm run lint` exit.
4. Apple Mail code review (can be done by Claude while Andrew works on prereqs — reading files, no Andrew action needed until the findings are logged).

### Block B: Core email + .ics verification (Criteria #2, #3)
5. Book a `qa-test` slot using `ajwegner3+booker@gmail.com` — this triggers the confirmation email. Open in Gmail web, Gmail iOS, Outlook web, Outlook desktop. Verify .ics opens on each, invite appears on calendar, title/time/timezone/organizer correct.
6. Cancel the booking via the cancel link in the email — verify METHOD:CANCEL .ics is received, event is removed from calendar in each client.
7. Book another `qa-test` slot, then reschedule via the reschedule link — verify METHOD:REQUEST + SEQUENCE:1 .ics updates the calendar event in-place in each client.
8. Run mail-tester.com for the confirmation email (get fresh address, book a new slot with that address, retrieve score).
9. Book a `qa-test` slot ~24h out, wait for reminder (or manually trigger cron), run mail-tester.com for the reminder email.

### Block C: DST transition test (Criterion #4)
10. Create a booking spanning the March 8 / Nov 1 DST transition (see per-criterion how-to below). Verify times in confirmation email and .ics show correct local times for owner (America/Chicago) and booker (different timezone).

### Block D: Embed verification (Criterion #1) — requires prereq Squarespace site
11. Paste the script snippet into the hidden `/booking-test` page on the Squarespace trial.
12. Confirm widget renders (skeleton → booking flow), complete a full end-to-end booking, verify no JS errors in host console, confirm confirmation email arrives.
13. Test multi-mount (two `<div data-nsi-calendar>` divs) and idempotency (duplicate script tag).

### Block E: Responsive layout (Criterion #5)
14. Open hosted booking page + embedded widget at 320px, 768px, 1024px breakpoints (Chrome DevTools device toolbar). Verify no overflow, no collapsed content, buttons tap-reachable.

### Block F: Multi-tenant isolation (Criterion #6)
15. Log in as `andrewjameswegner@gmail.com` at `/app/login`. Verify dashboard shows zero of Andrew's bookings/event types/availability/branding. Log back out.

### Block G: Phase 8 dashboard walkthrough (part of sign-off, no numbered criterion)
16. Execute the 9-item Phase 8 dashboard sweep: bookings list filters/pagination/sort, booking detail page (answers, owner-note autosave, history timeline, action bar), reminder settings toggles, event-type location field, reminder email in inbox, cron dashboard in Vercel, rate-limit light smoke, sidebar entries, existing booking/cancel/reschedule flows.

### Block H: FUTURE_DIRECTIONS.md + sign-off (Criteria #7, #8)
17. Write and commit `FUTURE_DIRECTIONS.md` to repo root.
18. Andrew reviews the `09-CHECKLIST.md` and explicitly signs off.

---

## Apple Mail Code-Review Checklist

The following patterns are known to render poorly or differently in Apple Mail (Mac + iOS). Claude should grep and review these in `lib/email/` during Block A. No Andrew action needed for the code review step itself — only the findings need to be logged to `FUTURE_DIRECTIONS.md`.

### HTML email patterns to grep for

```
# These are SAFE (already present in the codebase, confirmed compatible):
- Table-based layout with border-collapse (confirmed in all senders)
- Inline styles only (confirmed — no <style> blocks, no external CSS)
- System font stack: -apple-system, BlinkMacSystemFont (confirmed in all senders)
- max-width: 560px on wrapper div (confirmed)

# CHECK THESE:
grep -rn "position:absolute\|position: absolute" lib/email/
grep -rn "display:flex\|display: flex" lib/email/
grep -rn "background-image\|linear-gradient" lib/email/
grep -rn "var(--\|CSS variable" lib/email/
grep -rn "@font-face\|font-face" lib/email/
grep -rn "border-radius" lib/email/
```

**Known findings from code review (HIGH confidence, verified):**

- `border-radius: 6px` on branded buttons in `branding-blocks.ts` (renderBrandedButton, line 70) — Apple Mail 16+ supports border-radius on `<a>` elements; older Apple Mail may square the corners. Low risk.
- `animation:nsiPulse` in the skeleton loader CSS injected by `widget.js` — irrelevant for emails (this is the embed widget script, not email).
- `linear-gradient` skeleton in `widget.js` — same, not email.
- `background:linear-gradient(...)` and `@keyframes nsiPulse` in `widget.js` only — NOT in any email template. Email templates are clean.
- No `position:absolute`, no `display:flex`, no CSS variables, no web fonts in any email template. All confirmed by reading the source files.
- **NSI_MARK_URL=null** in `branding-blocks.ts` line 44 — the "Powered by NSI" footer is text-only (no `<img>`). This is intentional; no broken image risk.
- `.ics` uses `timezones-ical-library` for VTIMEZONE block — this is the correct pattern. The library provides RFC 5545-compliant VTIMEZONE. Apple Mail reads VTIMEZONE for timezone resolution.
- PRODID: `ical-generator` auto-inserts PRODID (`-//sebbo.net//ical-generator//EN`). Present.
- METHOD: Set correctly (`METHOD:REQUEST` on confirmation/reschedule, `METHOD:CANCEL` on cancel).
- SEQUENCE: Default 0 on confirmation, explicitly set to 1 on cancel/reschedule.
- CRLF line endings: `ical-generator` handles CRLF automatically.
- Line folding (75-octet): `ical-generator` handles this automatically.
- UID stability: Uses `booking.id` (Postgres UUID) — stable across updates.

**Patterns to flag in FUTURE_DIRECTIONS.md under "Untested email clients":**

- Apple Mail on older macOS (pre-Ventura) does not always auto-remove events on METHOD:CANCEL if the ORGANIZER email does not match the sender's "From" address. Our ORGANIZER is `account.owner_email` (Andrew's Gmail), and `From` is also constructed from `GMAIL_USER` (Andrew's Gmail). These should match — no issue expected, but untested.
- Apple Mail iOS 16+ parses METHOD:REQUEST + SEQUENCE:1 for in-place updates. Older iOS may create a duplicate event instead of updating. Flag as "test when access is available."
- `border-radius` on `<a>` button elements: Apple Mail 16+ renders correctly; Apple Mail 13-15 may render as square. Low cosmetic impact.

---

## Per-Criterion How-To

### Criterion #1: Embed on live site, end-to-end booking, no JS errors

**Prerequisites:** Squarespace 14-day trial created, hidden `/booking-test` page exists.

**Squarespace embed install steps:**
1. Log in to Squarespace trial dashboard.
2. Navigate to Pages → your hidden page (`/booking-test`).
3. Click Edit on the page.
4. Add a new block. In the block picker, choose "Code" (or "Code Block" in Squarespace 7.1) — NOT "Embed." The Code block accepts raw HTML/JS.
5. In the Code block editor, paste the Script snippet from the app's embed dialog (Dashboard → Event Types → Row menu → "Get embed code" → Script tab). The snippet looks like:
   ```html
   <div data-nsi-calendar="nsi/qa-test"></div>
   <script src="https://calendar-app-xi-smoky.vercel.app/widget.js" defer></script>
   ```
6. Save the block. The snippet goes in the **page body**, not the header.
7. Preview the page (or publish it — Squarespace trial pages are on a Squarespace subdomain, which is https://, so `frame-ancestors *` will match it).
8. Open the page, open browser DevTools Console. Verify no JS errors. Verify the skeleton appears, then the booking flow loads.
9. Complete a booking: pick a date/time, fill out the form, submit. Verify no JS errors throughout. Verify the confirmation page appears inside the iframe. Verify a confirmation email arrives at `ajwegner3+booker@gmail.com`.

**CSP note:** `frame-ancestors *` in `proxy.ts` matches all https:// origins including `*.squarespace.com`. The embed will work. It will NOT work on `file://` local files — do not test from a local HTML file.

**Multi-mount test:** Add a second `<div data-nsi-calendar="nsi/qa-test">` to the page (before saving, while the Code block is open). Both should render independently. The `window.__nsiWidgetLoaded` guard prevents double-loading the script; each div gets its own `initWidget()` invocation.

**Idempotency test:** Add a duplicate `<script src="/widget.js" defer></script>` tag. The `if (window.__nsiWidgetLoaded) return;` guard at the top of the IIFE prevents double-initialization. Only one widget per div should render.

### Criterion #2: .ics correctness across clients

**How to test:**
1. Book a `qa-test` slot using `ajwegner3+booker@gmail.com` (or `+booker2`) via `calendar-app-xi-smoky.vercel.app/nsi/qa-test`.
2. Open the confirmation email in each client: Gmail web, Gmail iOS, Outlook web, Outlook desktop.
3. In each client, open the attached `invite.ics`. Verify the calendar event is created with:
   - Title = the event type name (e.g., "qa-test")
   - Date/time = correct in the client's local timezone (calendar client auto-converts from the owner's `America/Chicago` VTIMEZONE)
   - Organizer = account name + owner_email (Andrew's Gmail)
4. Cancel the booking via the cancel link in the email.
5. In each client, open the attached `cancelled.ics`. Verify the event is removed from the calendar.
6. Book another slot. Reschedule it via the reschedule link.
7. In each client, open the attached `invite.ics` from the reschedule email. Verify the existing calendar event is updated in-place (same event, new time — not a duplicate).

**iTIP expected behavior per client:**
- Gmail web: Shows inline "Add to Calendar / Remove from Calendar" card when `contentType: "text/calendar; method=REQUEST"` / `"text/calendar; method=CANCEL"`. Clicking the card adds/removes the event from Google Calendar.
- Gmail iOS: Same inline card behavior.
- Outlook web (outlook.live.com): Shows "Accept / Decline / Tentative" buttons for METHOD:REQUEST; shows removal prompt for METHOD:CANCEL.
- Outlook desktop: Same as Outlook web. METHOD:REQUEST + SEQUENCE:1 updates the existing meeting in-place.
- Known behavior: METHOD:CANCEL auto-removes event in Gmail and Outlook when the ORGANIZER email matches the sender. Our setup has ORGANIZER = `account.owner_email` = Andrew's Gmail = the SMTP `From` address — these match.
- SEQUENCE:1 on reschedule: Gmail and Outlook accept the update in-place when UID matches and SEQUENCE increments. If SEQUENCE were 0 again (not the case here — code explicitly passes `sequence: 1`), some clients would reject the update.

### Criterion #3: mail-tester.com 9/10+

**Exact workflow for confirmation email:**
1. Go to mail-tester.com. A fresh disposable address is displayed (e.g., `test-xyz123@mail-tester.com`). The address is valid for 10 minutes.
2. Use the mail-tester.com address as the booker email. Book a `qa-test` slot via `calendar-app-xi-smoky.vercel.app/nsi/qa-test` with the mail-tester.com address in the "email" field. Use `ajwegner3+spamtest@gmail.com` is NOT used here — the mail-tester address IS the booker email.
3. Wait ~30-60 seconds for the email to arrive at mail-tester.com's server.
4. Click "Then check your score" on mail-tester.com.
5. If score is < 9/10: note the specific failures. If SPF/DKIM/DMARC items fail, those are deliverability infrastructure issues. If content scoring items fail, note them. One retry allowed: get a fresh mail-tester.com address and repeat.
6. If still < 9/10 after retry: log to FUTURE_DIRECTIONS.md, do NOT block ship.

**Exact workflow for reminder email:**
1. Book a `qa-test` slot approximately 22-23 hours from now (within the `<24h` reminder window) using a fresh mail-tester.com address.
2. Wait for the hourly Vercel Cron to fire (cron fires at `0 * * * *` UTC — top of each hour). The cron picks up bookings with `start_at < now() + 24h` and `reminder_sent_at IS NULL`.
3. Alternatively: if Andrew needs to test sooner, manually trigger the cron by visiting `https://calendar-app-xi-smoky.vercel.app/api/cron/reminders` with the `Authorization: Bearer {CRON_SECRET}` header (use a tool like curl or the Vercel Cron dashboard "Trigger" button once CRON_SECRET is confirmed in Vercel env).
4. Retrieve score on mail-tester.com. Same pass bar and retry policy.

**Score breakdown to care about:**
- SPF/DKIM/DMARC (highest impact): These test the Gmail SMTP sending domain's authentication. If these fail, it's a configuration issue with the Gmail account or Vercel env vars, not a code issue.
- Content score: Things like HTML:text ratio, missing unsubscribe link, spam-trigger words. The spam-folder copy line added in Block A helps here.
- The `text` plain-text alternative in the reminder email (`lib/email/send-reminder-booker.ts` line 189) already addresses the "no plain text" content deduction. The confirmation email lacks a plain-text alternative — this is a known FUTURE_DIRECTIONS item.

### Criterion #4: DST transition booking

**How to create a DST-spanning booking:**
The next observable DST event is spring-forward in the US: March 8, 2026 at 2:00 AM local time (America/Chicago), when clocks jump to 3:00 AM.

To test this with the live availability engine:
1. The `qa-test` event type is already on the `nsi` account (timezone: `America/Chicago`). 
2. You cannot book a slot in the past (the availability engine rejects `start_at > now()`). Since today is 2026-04-27, March 8 2026 is already past.
3. For the next DST transition: November 1, 2026 at 2:00 AM (America/Chicago), clocks fall back to 1:00 AM.
4. To test: create availability for the `qa-test` event type that includes a Sunday around November 1, 2026. Book a slot on November 1, 2026 at 1:30 AM CDT (which becomes 1:30 AM CST after fallback — ambiguous hour).

**Alternative approach (practical for the marathon session):**
Rather than waiting for a future DST date or creating past bookings, verify DST timezone handling by:
1. Setting the booker timezone to a different timezone (e.g., `America/New_York`, which is UTC-5 in winter) and booking a normal slot.
2. Verify the confirmation email and .ics show the correct local time in both owner's timezone (CDT/CST) and booker's timezone (EDT/EST).
3. Verify that the `.ics` VTIMEZONE block uses `America/Chicago` (owner timezone) and that the calendar client correctly adapts the displayed time for the booker.

**What to verify:**
- Email body shows times in BOOKER timezone (CDT/CDT — whatever timezone was submitted in the booking form)
- `.ics` DTSTART/DTEND uses the VTIMEZONE block corresponding to `America/Chicago`
- No floating times (no DTSTART without TZID or Z suffix)
- After adding the event to Google Calendar (in the booker's timezone), the time shows the correct local time

### Criterion #5: Responsive layout at 320px / 768px / 1024px

**How to test:**
1. Open Chrome. Visit `calendar-app-xi-smoky.vercel.app/nsi/qa-test` (hosted booking page).
2. Open DevTools → Toggle Device Toolbar (Ctrl+Shift+M / Cmd+Shift+M).
3. Set viewport to 320px width. Scroll through the page. Check: form inputs visible and full-width, buttons tappable (minimum 44px height), no horizontal overflow, time slot grid wraps cleanly.
4. Repeat at 768px and 1024px.
5. Return to the Squarespace page (once embed is set up in Block D). Test the embedded widget at the same breakpoints. The iframe auto-resizes via postMessage; verify the iframe height adjusts correctly on each breakpoint.
6. Also test the embed page directly at `calendar-app-xi-smoky.vercel.app/embed/nsi/qa-test` — this is the actual content inside the iframe.

### Criterion #6: Multi-tenant isolation

**How to test:**
1. Open a fresh browser (or incognito/private window to avoid session leakage).
2. Visit `calendar-app-xi-smoky.vercel.app/app/login`.
3. Sign in as `andrewjameswegner@gmail.com` (the second seeded test user, account slug `nsi-rls-test`).
4. Check Dashboard (bookings list): should be empty or show only bookings on the `nsi-rls-test` account. Zero bookings from the `nsi` account should appear.
5. Check Event Types: should show only event types on `nsi-rls-test`. None of Andrew's `nsi` event types should appear.
6. Check Settings/Availability: should show `nsi-rls-test` availability only.
7. Check Settings/Branding: should show `nsi-rls-test` branding (probably defaults — no logo, default colors). No `nsi` logo or colors should leak through.
8. Log out. Confirm the session is terminated.

**Note:** The automated RLS matrix test (`tests/rls-cross-tenant-matrix.test.ts`, 13 tests) already covers programmatic isolation. This manual check is the UX-layer confirmation that the application UI correctly scopes all queries to the logged-in user's account.

### Criterion #7: FUTURE_DIRECTIONS.md committed to repo root

**Content sources (from CONTEXT.md decision):**
1. STATE.md "Carried Concerns" section (lines 260-299 verified)
2. Each phase SUMMARY's deferred/backlog sections (all major items already aggregated in STATE.md)
3. The 19 ESLint violations from 08-02 (once fixed in Block A, note what was fixed and what remains if any)

**Target file:** `FUTURE_DIRECTIONS.md` in the repo root (`/`), not in `.planning/`.

### Criterion #8: Andrew's sign-off

Andrew reviews `09-CHECKLIST.md` at session end and says the words. Claude updates the checklist with a `SIGNED OFF` entry and timestamps it.

---

## Backlog Item → Criterion Mapping

| STATE.md Backlog Item | Maps to Criterion | How |
|---|---|---|
| Lint cleanup (19 violations, 08-02) | Pre-flight code change | Fix before session; verify `npm run lint` exits 0 |
| Audit-row `void` cleanup in cancel.ts + reschedule.ts | Pre-flight code change | Fix before session; migrate to `after()` |
| `.ics` iTIP CANCEL/REQUEST+SEQUENCE behavior across clients | Criterion #2 (.ics correctness) | Part of the cancel + reschedule .ics tests |
| Rate-limit live verification across 3 routes | Phase 8 walkthrough (Block G) | Light smoke: hit each rate-limited endpoint rapidly, confirm 429 + Retry-After in DevTools |
| Branding editor file-rejection edge cases (Plan 07-04 steps 8-10) | Phase 8 walkthrough (Block G) | 3 test uploads: JPG rejected, >2MB rejected, spoofed MIME caught |
| Per-email-type smoke (6 templates) | Criterion #2 (.ics correctness) + Phase 8 walkthrough | All 6 email types triggered; check rendering in each client |
| Production CRON_SECRET in Vercel env | Pre-flight prereq | Must be done before session; gating for Criterion #3 reminder mail-tester |
| Reminder mail-tester live verification | Criterion #3 (mail-tester 9/10+) | Second mail-tester run for the reminder email |
| End-to-end Phase 8 dashboard walkthrough (9 items) | Phase 8 walkthrough (Block G) | Combined with the other manual QA into the marathon session |
| Spam-folder copy line | Pre-flight code change | Add to confirmation + reminder templates before testing |
| Apple Mail code review | Apple Mail section | Claude reviews code; findings go to FUTURE_DIRECTIONS.md |
| Embed live test on Squarespace | Criterion #1 (widget embed) | Full Block D |

---

## FUTURE_DIRECTIONS.md Outline

Per CONTEXT.md: 3-5 pages, audience = future Claude Code sessions, Claude-readable briefing. Structure like CLAUDE.md. Use clear section headers, fact-statement bullets, cite source files/commits.

**Recommended section structure:**

```
# FUTURE_DIRECTIONS.md

## How to Use This File
One paragraph: this file is a briefing for future Claude Code sessions opening this repo.
Read this after CLAUDE.md. It contains known limitations, deferred items, and technical
debt as of v1 sign-off (Phase 9, 2026-04-27).

## 1. Known Limitations
- Apple Mail email rendering and .ics behavior: untested (deferred — no device access during Phase 9)
  - Source: CONTEXT.md Phase 9 Apple Mail decision
  - .ics VTIMEZONE via timezones-ical-library: correct implementation, untested in client
  - Button border-radius (6px in branding-blocks.ts:70): renders correctly in Mail 16+; may square in 13-15
  - METHOD:CANCEL auto-remove: should work (ORGANIZER = From); untested
- Hosted booking page lacks plain-text email alternative for confirmation email
  - Source: lib/email/send-booking-confirmation.ts (no `text:` field in sendEmail call)
  - Reminder email already has plain-text alternative (send-reminder-booker.ts:189)
  - Risk: minor spam score deduction on mail-tester
- WordPress embed testing: only Squarespace tested in Phase 9
  - Source: CONTEXT.md Deferred section
  - Expected to work (same CSP + postMessage protocol); unverified
- `/auth/callback` route 404s: blocks password reset for end users
  - Source: STATE.md v2 backlog
- Supabase service-role key format: legacy JWT SUPABASE_SERVICE_ROLE_KEY still in use
  - Supabase has not rolled out sb_secret_* format for this project (confirmed 2026-04-27)
  - No functional impact; watch for Supabase changelog
- [Any mail-tester failures below 9/10 should be listed here]

## 2. Assumptions & Constraints
- Single-owner per account: v1 has no team/multi-user model within an account
- Gmail SMTP for transactional delivery: using owner's personal Gmail via GMAIL_USER/GMAIL_FROM_NAME
  - Not suitable for high volume; fine for v1 contractor use case
- Vercel Pro tier required: hourly cron (vercel.json schedule: "0 * * * *") only works on Pro
  - Hobby tier would need cron-job.org as external driver (research done in Plan 08-04; dropped when Pro confirmed)
- Booker timezone: submitted at booking time, not verified or corrected — booker owns their clock
- RESERVED_SLUGS duplicated in two files (lib/... + load-account-listing.ts)
  - Source: STATE.md locked decision
  - Any new reserved slug must be added to BOTH files manually
- Migration drift workaround: `npx supabase db push --linked` fails; use `npx supabase db query --linked -f <file>`
  - Source: STATE.md locked decision (orphan timestamps in schema_migrations)

## 3. Future Improvements
- v2: Multi-tenant signup + onboarding flow (out of scope for v1)
- Reminder retry/resend UI: Phase 9 deferred (reminder_sent_at not clearable to prevent retry spam)
  - Source: STATE.md line 284
  - Suggestion: "Resend reminder" action on booking detail page (/app/bookings/[id])
- Plain-text email alternative for confirmation email (send-booking-confirmation.ts)
  - Low effort: add stripHtml() import + text: field to sendEmail call
- NSI mark/logo in "Powered by NSI" email footer
  - Source: branding-blocks.ts line 44 — NSI_MARK_URL=null
  - Unblocked when /public/nsi-mark.png is added to repo
- Apple Mail live testing (Phase 9 deferred): test .ics rendering, METHOD:CANCEL removal, METHOD:REQUEST update
- WordPress embed live test (Phase 9 deferred): paste Script snippet into WordPress page, verify full flow
- Comprehensive a11y audit (ROADMAP deferred): WCAG 2.1 AA compliance check on booking flow + dashboard
- Performance / Lighthouse audit (ROADMAP deferred): no formal benchmark done in v1
- Production cron observation across multiple hourly ticks: Phase 9 verifies first tick; sustained monitoring is post-ship ops work

## 4. Technical Debt
- 19 ESLint violations surfaced by Plan 08-02 (8 errors + 11 warnings)
  - Source: .planning/phases/08-reminders-hardening-and-dashboard-list/08-02-SUMMARY.md
  - Status: [fixed in Phase 9 Block A / partially fixed / deferred — fill in at closeout]
  - Remaining errors: [list any not fixed]
  - Recommended fix path in 08-02-SUMMARY.md §Lint Violations
- Audit-row `void supabase.from('booking_events').insert(...).then(...)` in cancel.ts + reschedule.ts
  - Source: STATE.md line 275, Plan 08-02 decision
  - Status: [fixed in Phase 9 Block A / deferred — fill in at closeout]
  - Fix: wrap in after() — same pattern as email sends; callers are request-scoped
- RESERVED_SLUGS duplication (see Assumptions above)
- Migration drift: three orphan timestamp rows in supabase_migrations.schema_migrations
  - Workaround documented; cleanup would require Supabase support intervention or manual table edit
- Booker-timezone display in bookings list (dashboard) shows booker's timezone, not owner's
  - This is CORRECT and intentional (STATE.md line 250); but may confuse future developers — document inline

## 5. Untested Email Clients
- Apple Mail (Mac + iOS): not tested in Phase 9 (no device access)
  - Code review performed during Phase 9 — findings:
    - HTML: table-based layout, inline styles only, system font stack — should render correctly
    - .ics: PRODID present, VTIMEZONE via timezones-ical-library, METHOD:REQUEST/CANCEL, SEQUENCE correct
    - Known risk: border-radius on <a> buttons may render as square in Apple Mail <16
    - Known risk: METHOD:CANCEL ORGANIZER matching not verified in Apple Mail
  - Recommendation: test with a device when available; test script is in Phase 9 Criterion #2
- Proton Mail / Fastmail / Yahoo Mail: not tested; likely work for HTML (no unusual CSS); .ics behavior unknown

## Commit Reference
Phase 9 sign-off: [commit hash after FUTURE_DIRECTIONS.md is committed]
Last code-complete commit: 487036a (Phase 9 context docs)
All tests green: 131 passing + 1 skipped as of Phase 8 completion
```

---

## Pitfalls

### Pitfall 1: mail-tester.com 10-minute window
Each mail-tester.com address is valid for only 10 minutes. If the booking email takes longer than 10 minutes to arrive (unlikely with Gmail SMTP, but possible), the address expires and the score is lost. Have the booking form pre-filled so Andrew can submit it within 2-3 minutes of copying the mail-tester address.

### Pitfall 2: Squarespace trial CSP on preview vs. published
Squarespace's in-editor preview may run the page in an iframe itself. Test on the actual published (or preview in a new tab) URL, not inside the Squarespace editor. The URL should be `https://<your-site>.squarespace.com/booking-test` — a real https:// origin.

### Pitfall 3: DST test booking dates are in the past
March 8, 2026 (US spring-forward) has already passed as of 2026-04-27. The availability engine rejects past bookings. Use November 1, 2026 (US fall-back) instead. The `qa-test` event type must have availability set for that date (a Sunday). Andrew may need to set availability rules or date overrides for that specific date if weekly rules don't cover it.

### Pitfall 4: Reminder email mail-tester requires correct CRON_SECRET in Vercel
If `CRON_SECRET` is not in Vercel's Production env vars, the cron route returns 401 and no reminder fires. Confirm the prereq before scheduling the reminder mail-tester test. The cron fires at `0 * * * *` UTC — Andrew must book the test slot within the correct window relative to the cron tick.

### Pitfall 5: Second test account must already exist in Supabase
The multi-tenant isolation test (Criterion #6) requires that `andrewjameswegner@gmail.com` has an existing account row (`nsi-rls-test`) in Supabase. This was provisioned during Phase 8 (Plan 08-08, `signInAsNsiTest2Owner` helper). If the account does not exist, the login will fail or succeed with no dashboard data. Verify by logging in first before trying to test isolation.

### Pitfall 6: Push all code changes to production before testing emails
The spam-folder copy line and lint/void fixes must be deployed to `calendar-app-xi-smoky.vercel.app` before the email testing in Block B. Vercel auto-deploys on push to `main` — confirm the deployment succeeded (green check on Vercel dashboard) before proceeding.

### Pitfall 7: lint fix for `react-hooks/set-state-in-effect` in `hooks/use-mobile.ts`
This file is a shadcn-generated file. The fix approach is `useSyncExternalStore` — replacing the `useEffect` + `useState` pattern with the synchronous store subscription API. The shadcn source should NOT be modified blindly; the `useSyncExternalStore` refactor is a known pattern for matchMedia-based hooks. If the fix is complex, defer it to FUTURE_DIRECTIONS.md technical debt and disable the rule for that file with a comment noting the shadcn origin.

### Pitfall 8: Rate-limit live verification causes real rate-limit events in Supabase
The light rate-limit smoke test in Block G inserts rows into `rate_limit_events`. These will eventually expire (or can be manually deleted). Do not mistake test-induced rate-limit events for production abuse signals.

### Pitfall 9: `09-CHECKLIST.md` is the session state file
If Andrew needs to pause mid-session and resume later, the checklist is the source of truth for where things stand. Each item should be clearly marked PASS / FAIL / DEFERRED with timestamps. Do not rely on the conversation history if resuming in a new session.

---

## Open Questions for the Planner

1. **DST test date selection:** The March 8, 2026 DST date cited in the ROADMAP success criteria is already past. The planner should confirm with Andrew whether to use November 1, 2026 (next US DST transition) or to instead treat the DST criterion as a timezone-difference verification (two bookings, different timezones, verify local times in email/ics are correct — not necessarily spanning a transition moment). The simplest practical approach is the latter: book a slot, set booker timezone to `America/New_York`, verify email shows the correct time in Eastern time. This covers the timezone math without requiring a future date.

2. **Reminder mail-tester timing:** The reminder window is `start_at < now() + 24h` and `reminder_sent_at IS NULL`. To trigger a reminder send, Andrew must book a slot that is at most 24 hours away AND wait for the next cron tick at the top of the hour. During a 2-4 hour marathon session, this means booking the slot at the START of the session (Block A), then running the mail-tester check at the END (Block B). The planner should sequence this explicitly: "Book qa-test slot ~23h from now as first action; come back to retrieve the mail-tester score near the end of the session."

3. **Lint errors in shadcn-generated files:** `hooks/use-mobile.ts` is a shadcn scaffold. The planner must decide whether to fix the `set-state-in-effect` error there (requires `useSyncExternalStore` refactor) or to add a `// eslint-disable` comment with a note citing its shadcn origin. The correct fix is `useSyncExternalStore` but the planner should scope the complexity.

4. **`react-hooks/incompatible-library` error investigation:** This error is not fully characterized in the codebase research. The planner should include a task to run `npm run lint` and read the full error output to determine which file/library interaction it is before fixing.

5. **FUTURE_DIRECTIONS.md technical debt section:** The lint/void items are in-scope for Phase 9 Block A fix. The planner must decide at closeout time whether to note them as "fixed" or "deferred" in the tech debt section. The research cannot resolve this in advance — it depends on whether the fixes succeed without scope creep.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct reads: `lib/email/send-booking-confirmation.ts`, `lib/email/send-reminder-booker.ts`, `lib/email/build-ics.ts`, `lib/email/branding-blocks.ts`, `lib/email/send-cancel-emails.ts`, `lib/email/send-reschedule-emails.ts`, `lib/bookings/cancel.ts`, `lib/bookings/reschedule.ts`, `app/widget.js/route.ts`, `proxy.ts`
- `.planning/STATE.md` lines 200-299 (carried concerns + backlog)
- `.planning/phases/08-reminders-hardening-and-dashboard-list/08-02-SUMMARY.md` (ESLint violation breakdown)
- `.planning/phases/08-reminders-hardening-and-dashboard-list/08-08-SUMMARY.md` (deferred items, cron, RLS matrix)
- `.planning/phases/09-manual-qa-and-verification/09-CONTEXT.md` (locked decisions)
- `.planning/phases/07-widget-and-branding/07-09-SUMMARY.md` (embed snippet format, CSP confirmed)

### Notes on confidence
- Squarespace UI navigation steps: MEDIUM confidence — based on established knowledge of Squarespace 7.1 block editor. The "Code" block path is correct for 7.1; Squarespace 7.0 may use a different path. If Andrew's trial is on 7.0, the block type name may differ.
- mail-tester.com workflow: HIGH confidence — the 10-minute window and score categories are well-established behavior, consistent with the automated test comments in `send-reminder-booker.ts` (line 188 references "mail-tester EMAIL-08").
- iTIP client behavior: HIGH confidence for Gmail web + Outlook; MEDIUM confidence for exact UX wording (button labels may have changed in recent client updates).

---

## Metadata

**Confidence breakdown:**
- Codebase landmarks: HIGH — all file paths verified by direct read
- Sequencing: HIGH — derived from locked CONTEXT.md decisions + codebase dependencies
- Apple Mail code review: HIGH — verified against actual source files, no speculation
- Per-criterion how-to: HIGH for steps based on codebase; MEDIUM for Squarespace UI navigation
- FUTURE_DIRECTIONS.md outline: HIGH — derived from STATE.md backlog + CONTEXT.md locked constraints

**Research date:** 2026-04-27
**Valid until:** Phase 9 execution (single session; no expiry concern)
