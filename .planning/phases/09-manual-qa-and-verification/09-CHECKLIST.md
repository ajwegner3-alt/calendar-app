# Phase 9 Manual QA Checklist

**Session start:** _[TIMESTAMP — fill at start of Plan 09-02]_
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

_Filled in by Plan 09-02 — code review of `lib/email/`, `lib/email/build-ics.ts`, `lib/email/branding-blocks.ts`._

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
