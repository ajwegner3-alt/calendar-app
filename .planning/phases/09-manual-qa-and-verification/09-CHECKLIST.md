# Phase 9 Manual QA Checklist

**Session start:** 2026-04-27T23:16:12Z (Plan 09-02 begin)
**Driver:** Andrew (executor) + Claude (proposer / scribe)
**Pass bar:** Strict by default. Any item may be downgraded to "deferred to v1.1" by Andrew at the time of surface — captured in the Notes column and propagated to FUTURE_DIRECTIONS.md.

---

## Pre-flight (Plan 09-01 artifacts)

- [x] All 5 prereqs confirmed done (1 substituted, 1 deferred):
  - **Squarespace 14-day trial** — DROPPED. Andrew is not testing on Squarespace/Wix in this phase. Substitution: Plan 09-02 will embed live on Andrew's own Next.js site instead. Squarespace/Wix verification deferred to FUTURE_DIRECTIONS.md.
  - **CRON_SECRET in Vercel Production env** — confirmed set; vercel.json hourly cron deployed (commit `d8f729d`). Vercel Crons UI tab is empty for Andrew but the schedule is live. Cron-fired-in-production verification deferred to Plan 09-02 mail-tester step (fix-as-you-go if reminder doesn't arrive).
  - **Gmail aliasing** — confirmed; previously tested.
  - **qa-test event type** — SKIPPED. Andrew will reuse existing event types for QA bookings (booking flow already exercised end-to-end). Plan 09-02 should reference an existing event type instead of `/nsi/qa-test`.
  - **mail-tester warm-up** — confirmed.
- [x] Spam-folder copy line live in production confirmation email (commit: `8146af8`)
- [x] Spam-folder copy line live in production reminder email (commit: `8146af8`)
- [x] Audit-row after() migration in cancel.ts + reschedule.ts (commit: `3d84607`; tsc fix folded into `61b276f`)
- [x] Lint cleanup completed; npm run lint exits with 1 documented warning (commit: `61b276f`; deferred items: see "Deferrals to v1.1" below)

---

## Marathon Criteria (Plan 09-02)

| #   | Criterion                                                                                                                                                                                                                                                          | Status | Timestamp | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | --------- | ----- |
| 1   | Embed live on Andrew's Next.js site, end-to-end booking, no JS errors (Squarespace/Wix deferred to FUTURE_DIRECTIONS.md per Plan 09-01 prereq substitution)                                                                                                        | __     | __        | __    |
| 2   | .ics opens correctly in Gmail web/iOS, Outlook web/desktop (cancel + reschedule lifecycle) + Apple Mail code review findings — record as "PASS (Apple Mail: code-review-only, deferred)" not unqualified PASS, per CONTEXT.md no-device-access deferral            | __     | __        | __    |
| 3   | mail-tester.com >= 9/10 for confirmation AND reminder                                                                                                                                                                                                              | __     | __        | __    |
| 4   | DST/timezone correctness verified — Notes column MUST record (a) Andrew's substitution-approval signal verbatim if applicable and (b) the substitute method used (e.g., "cross-timezone NY/Chicago"); if not substituted, record actual method used                | __     | __        | __    |
| 5   | Responsive at 320 / 768 / 1024 (hosted + embed)                                                                                                                                                                                                                    | __     | __        | __    |
| 6   | Multi-tenant UI isolation (manual login as 2nd test user)                                                                                                                                                                                                          | __     | __        | __    |
| 7   | FUTURE_DIRECTIONS.md committed to repo root (Plan 09-03)                                                                                                                                                                                                           | __     | __        | __    |
| 8   | Andrew explicit ship sign-off                                                                                                                                                                                                                                      | __     | __        | __    |

### Criterion #2 — per-template body branding smoke (6 transactional emails)

Per CONTEXT.md / Plan 09-02 Task 3 Phase D. Each row evaluates one rendered email body for: logo (centered top, or absent if `logo_url` null), brand-colored H1 (or NSI navy fallback), brand-colored CTA buttons, "Powered by NSI" text-link footer, and (for booker confirmation only) the spam-folder copy line.

| #   | Surface (recipient × email type)             | Status | Timestamp | Notes |
| --- | -------------------------------------------- | ------ | --------- | ----- |
| 2a  | Booker — confirmation (with .ics)            | __     | __        | __    |
| 2b  | Owner  — confirmation notification           | __     | __        | __    |
| 2c  | Booker — cancellation (with cancelled.ics)   | __     | __        | __    |
| 2d  | Owner  — cancellation notification           | __     | __        | __    |
| 2e  | Booker — reschedule (with .ics SEQUENCE:1)   | __     | __        | __    |
| 2f  | Owner  — reschedule notification             | __     | __        | __    |

---

## Phase 8 dashboard walkthrough (sub-criteria, part of #1-#6 evidence collection)

- [ ] Bookings list filters / pagination / sort
- [ ] Booking detail page (answers + owner-note autosave + history timeline + action bar)
- [ ] Reminder settings toggles
- [ ] Event-type Location field persistence
- [ ] Reminder email arrives in inbox with correct branding + toggles
- [ ] Vercel Cron dashboard shows green ticks (cron-fired-in-production verification — gates whether the next reminder actually arrived; deferred from Plan 09-01 prereqs)
- [ ] Rate-limit smoke test (3 endpoints): /api/bookings, /api/cancel, /api/reschedule each return 429 + Retry-After when hit rapidly
- [ ] Sidebar Settings group renders Reminder Settings entry
- [ ] Branding editor file-rejection edge cases (JPG / >2MB / spoofed MIME)

---

## Apple Mail code review findings (logged here, propagated to FUTURE_DIRECTIONS.md §5)

**Reviewed:** 2026-04-27 (Plan 09-02 Task 1)
**Scope:** `lib/email/build-ics.ts`, `lib/email/branding-blocks.ts`, `lib/email/send-booking-confirmation.ts`, `lib/email/send-owner-notification.ts`, `lib/email/send-cancel-emails.ts`, `lib/email/send-reschedule-emails.ts`, `lib/email/send-reminder-booker.ts`.

**Verdict:** LIKELY PASS in Apple Mail (Mac + iOS). No high-risk patterns found. One low-risk cosmetic note documented below. Live verification still deferred per CONTEXT.md no-device-access constraint.

**Findings (fact-bullets):**

1. **HTML email patterns — clean for Apple Mail.** Grepped `lib/email/` for known-bad patterns: `position:absolute`, `display:flex`, `linear-gradient`, `var(--`, `@font-face`. **All absent.** Email layout uses inline-styled `<table role="presentation">` (Outlook/Apple Mail safe), inline `style="..."` only, system font stack `-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif` (native to Apple Mail).
2. **`border-radius: 6px` is present** on CTA `<a>` button elements in `lib/email/branding-blocks.ts:70` and on the cancel-reason callout `<div>` in `lib/email/send-cancel-emails.ts:111` and `:205`. **Low-risk cosmetic in older Apple Mail (pre-macOS 10.13 / iOS 11):** the property is silently ignored, buttons render with square corners. Modern Apple Mail (macOS 10.13+ / iOS 11+) supports `border-radius` natively. No layout breakage on older clients — corners are just square. Acceptable v1.
3. **`.ics` PRODID auto-inserted by ical-generator** (`lib/email/build-ics.ts:65` `ical({ name: opts.summary })`). The library default PRODID is `-//sebbo.net//ical-generator//EN` — RFC 5545 compliant. Apple Mail / Calendar.app reads PRODID; absence would be flagged as malformed.
4. **`.ics` METHOD set per scenario** — `REQUEST` for confirmation + reschedule (`build-ics.ts:67-68`), `CANCEL` for cancellation (`build-ics.ts:97-99`, paired with `STATUS:CANCELLED`). Apple Mail / Calendar.app honors `METHOD:CANCEL` to auto-remove events matched by UID — critical for Phase 6 cancel flow rendering correctly in Apple Mail.
5. **`.ics` SEQUENCE explicit** — `event.sequence(opts.sequence ?? 0)` on every invocation (`build-ics.ts:93`). SEQUENCE:0 on initial confirmation, SEQUENCE:1 on reschedule + cancel. Apple Mail rejects updates without SEQUENCE increment (RFC 5546 Pitfall 2 from Plan 06-02 RESEARCH).
6. **`.ics` UID stable** = `booking.id` (Postgres UUID v4). Reschedule + cancel send the same UID, enabling Apple Mail / Calendar.app to update or remove the existing event in place.
7. **VTIMEZONE block embedded** via `tzlib_get_ical_block(tz)[0]` from `timezones-ical-library` (`build-ics.ts:73-76`), set BEFORE `createEvent()` per the comment on line 72. Apple Mail strictly requires VTIMEZONE for non-floating times — confirmed present.
8. **CRLF + 75-octet line folding handled by ical-generator** (per `build-ics.ts` line 61 comment). Hand-rolled `.ics` strings fail RFC 5545 line-folding rules in Apple Mail; using the library is correct.
9. **ORGANIZER email = `account.owner_email`** = `ajwegner3@gmail.com` (NSI seed). SMTP From = `Andrew @ NSI <ajwegner3@gmail.com>` via `lib/email-sender/providers/gmail.ts:17` (`${fromName} <${user}>`). **ORGANIZER email matches SMTP From.** This is critical for Apple Mail's `METHOD:CANCEL` auto-removal (Apple Mail will refuse to remove an event whose ORGANIZER does not match the sender of the CANCEL message).
10. **NSI mark image is null** in `lib/email/branding-blocks.ts:44` (`const NSI_MARK_URL: string | null = null`). The footer renders text-only "Powered by **North Star Integrations**" — no `<img>` tag, no broken-image risk. Apple Mail (especially iOS) is the strictest about broken-image rendering; text-only footer is the safe choice.
11. **Logo header gracefully omitted when `logo_url` is null** — `renderEmailLogoHeader` returns `""` (`branding-blocks.ts:20`). No empty `<table>`, no broken `<img>`. Apple Mail renders cleanly whether or not Andrew's nsi account has a logo set.

**Carry-forward to FUTURE_DIRECTIONS.md §5 (Plan 09-03):**

- Live Apple Mail testing remains untested (no device access). All known-risk patterns reviewed clean except border-radius on older Apple Mail (cosmetic only). Recommend a v1.x verification pass when device access becomes available.
- If a future Apple Mail user reports broken cancel auto-removal: first thing to check is ORGANIZER email vs SMTP From alignment (currently both = `ajwegner3@gmail.com`). If Andrew's email config changes, that alignment must be preserved.

---

## Deferrals to v1.1

These were captured during Plan 09-01 (pre-flight) and are carried forward for Plan 09-03's FUTURE_DIRECTIONS.md:

1. **Squarespace / Wix embed verification** — deferred per user request. Plan 09-02 substitutes "embed on Andrew's own Next.js site" for Criterion #1. Squarespace + Wix paid-trial sign-up + verification will be a v1.1 task.
2. **Cron-fired-in-production verification** — Vercel Crons UI tab is not surfacing the hourly schedule for Andrew, but the deployed `vercel.json` (commit `d8f729d`) defines `0 * * * *`. Functional proof deferred to Plan 09-02 mail-tester step (if the reminder doesn't arrive, fix-as-you-go).
3. **`qa-test` event type** — skipped per user direction. Plan 09-02 will reuse existing NSI event types for QA bookings.
4. **`react-hooks/incompatible-library` warning at `event-type-form.tsx:99`** — React Compiler informs that react-hook-form's `watch()` returns a function that cannot be memoized. Informational only (no runtime impact). Proper fix is a `useWatch({ name: "name" })` refactor in EventTypeForm. Carried into FUTURE_DIRECTIONS.md as a code-health item.
5. **Pre-existing `tsc --noEmit` mock-alias errors in tests/** — `__setTurnstileResult`, `__mockSendCalls`, `__resetMockSendCalls` are aliased only in `vitest.config.ts`, not in `tsconfig.json`. Tests run green; tsc emits errors. Pre-dates Plan 09-01. Carried into FUTURE_DIRECTIONS.md.

_Any criterion downgraded by Andrew during the Plan 09-02 marathon will be appended below._

---

## Sign-off

- [ ] Andrew reviewed all entries above
- [ ] Andrew explicit verbal sign-off ("ship v1")
- **Sign-off timestamp:** __
