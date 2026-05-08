# FUTURE_DIRECTIONS.md

## How to Use This File

This file is a briefing for future Claude Code sessions opening this repo. Read it after `CLAUDE.md`. It records known limitations, deferred items, and technical debt as of v1 sign-off (Phase 9, 2026-04-27).

Audience: future Claude Code sessions. NOT a human-readable changelog. NOT marketing copy. Bullets are fact statements with source citations (file path, line number, commit SHA, or `.planning/` artifact path).

- **Repository:** https://github.com/ajwegner3-alt/calendar-app
- **Production:** https://calendar-app-xi-smoky.vercel.app
- **Last Phase 9 code commit (Plan 09-01):** `61b276f` (lint cleanup) — last commit that touched runtime source. Plan 09-02 + Plan 09-03 are docs-only.
- **Plan 09-02 closure commit:** `d64a417` (CHECKLIST DEFERRED markings + scope-cut closure)
- **Phase 9 sign-off commit:** _populated when sign-off lands; see §6 Commit Reference_
- **Test status at sign-off:** 131 passing + 1 skipped = 132 total (16 test files; `npm test` 2026-04-27)

**v2 reference (per Phase 9 CONTEXT lock):** v2 = "multi-tenant signup + onboarding flow; out of scope for v1." No further architectural detail in this file.

**Source-of-truth chain for v1.1 backlog:** `.planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md` Deferrals section is the canonical row-level enumeration; this file consolidates and cross-references back.

---

## 1. Known Limitations

- **Apple Mail (Mac + iOS) live-tested = NO.** Code review only (Plan 09-02 Task 1, commit `3d5fb31`). Verdict: LIKELY PASS. 11 fact-bullets recorded; see §5 Untested Email Clients.
- **Squarespace + Wix + WordPress embed live-tested = NO.** Phase 9 dropped Squarespace/Wix prereq (Plan 09-01 substitution). Embed on Andrew's own Next.js site was the substitute, but Plan 09-02 marathon QA was scope-cut before that ran live either. Embed code-paths are unit/integration covered (`tests/` widget + iframe smoke), not live-validated on a third-party host.
  - Source: `09-CHECKLIST.md` Deferrals row #1; STATE.md line 268 (`Phase 9 backlog: live Squarespace/WordPress embed test`).
  - CSP `frame-ancestors *` per CSP spec does NOT match opaque origins (file://, about:blank). Local embed testing must use `npx serve` (http://localhost:*); production verification must be a real https:// page.
- **Live email-client validation across Gmail web/iOS, Outlook web/desktop = DEFERRED.** Plan 09-02 Criterion #2 was scope-cut. Per-template branding smoke (6 surfaces: booker × owner × confirm/cancel/reschedule, sub-rows 2a–2f) DEFERRED.
  - Source: `09-CHECKLIST.md` Marathon Criteria row #2 + sub-table 2a–2f.
- **Confirmation email lacks plain-text alternative.**
  - Source: `lib/email/send-booking-confirmation.ts` (no `text:` field on the `sendEmail()` call). Reminder email has it (`lib/email/send-reminder-booker.ts:194` `const text = stripHtml(html);` → passed as `text` on line 202).
  - Risk: minor mail-tester deduction; not blocking.
- **mail-tester.com >= 9/10 score for confirmation AND reminder = UNVERIFIED.** Plan 09-02 Criterion #3 scope-cut.
  - Source: `09-CHECKLIST.md` Marathon Criteria row #3.
- **DST / cross-timezone live booking E2E = UNVERIFIED.** Algorithmic correctness covered by `tests/availability/compute-slots*.test.ts` (DST spring-forward + fall-back cases). Live human end-to-end with real email confirmation deferred.
  - Source: `09-CHECKLIST.md` Marathon Criteria row #4.
- **Responsive 320 / 768 / 1024 (hosted + embed) = UNVERIFIED live.** Plan 09-02 Criterion #5 scope-cut. Tailwind responsive utilities are present in source; no live multi-viewport human verification.
  - Source: `09-CHECKLIST.md` Marathon Criteria row #5.
- **Multi-tenant UI isolation walkthrough (login as 2nd test user) = UNVERIFIED live.** Backend RLS isolation is covered by `tests/rls-cross-tenant-matrix.test.ts` (Plan 08-08, 16 cases across 4 tables × 4 client contexts). Live UI-layer login walkthrough deferred.
  - Source: `09-CHECKLIST.md` Marathon Criteria row #6.
- **Phase 8 dashboard 9-item walkthrough = UNVERIFIED live.** Underlying functionality covered by automated tests; human walkthrough deferred. 9 items: bookings list filters/pagination/sort, booking detail page (answers + owner-note autosave + history timeline + action bar), reminder settings toggles, event-type Location field persistence, reminder email branding + toggles in inbox, Vercel Cron dashboard green ticks, rate-limit live smoke (3 endpoints), sidebar Settings group renders Reminder Settings entry, branding editor file-rejection edge cases (JPG / >2 MB / spoofed MIME).
  - Source: `09-CHECKLIST.md` Phase 8 dashboard walkthrough section (9 checkboxes, all DEFERRED 2026-04-27).
- **Vercel Crons UI tab is empty for Andrew** despite `vercel.json` (commit `d8f729d`) defining `0 * * * *` hourly schedule and `CRON_SECRET` set in Production env. Functional proof "did the reminder arrive" was deferred to mail-tester step which was itself scope-cut.
  - Source: `09-CHECKLIST.md` Pre-flight section + Deferrals row #2.
- **`/auth/callback` route 404s.** Blocks Supabase password-reset / magic-link flows for end users.
  - Source: STATE.md "v2 backlog: `/auth/callback` route" line.
  - Workaround: owners reset password via Supabase dashboard.
- **Supabase service-role key format = legacy JWT.** `SUPABASE_SERVICE_ROLE_KEY` still in use. `sb_secret_*` format not rolled out for this project as of 2026-04-27.
  - Source: STATE.md "Tidy up legacy JWT" Carried Concerns line; Plan 08-08 prereq C.
  - Action: watch Supabase changelog; revisit when new format is available for this project.
- **Pre-existing `tsc --noEmit` test-mock alias errors.** `__mockSendCalls`, `__resetMockSendCalls`, `__setTurnstileResult` imports from `@/lib/email-sender` and `@/lib/turnstile` are aliased only in `vitest.config.ts`; `tsconfig.json` doesn't see the alias.
  - Source: `09-CHECKLIST.md` Deferrals row #5 (Plan 09-01 surface).
  - Tests run green. `tsc` emits errors. Pre-dates Plan 09-01.
- **Apple Mail border-radius cosmetic.** `border-radius: 6px` on CTA `<a>` button (`lib/email/branding-blocks.ts:70`) and on cancel-reason callout `<div>` (`lib/email/send-cancel-emails.ts:111` and `:205`) is silently ignored on pre-macOS 10.13 / pre-iOS 11 Apple Mail. Square corners; no layout breakage. Acceptable v1.
  - Source: `09-CHECKLIST.md` Apple Mail findings #2.

---

## 2. Assumptions & Constraints

- **Single-owner per account.** v1 has no team / multi-user model within an account. v2 spec is multi-tenant signup + onboarding (no detail here per CONTEXT.md lock).
- **Gmail SMTP for transactional delivery via owner's personal Gmail** (`GMAIL_USER` / `GMAIL_FROM_NAME` env vars; `lib/email-sender/providers/gmail.ts`). Not suitable for high volume; fine for v1 service-business use case.
- **Vercel Pro tier required.** `vercel.json` `crons[].schedule = "0 * * * *"` (hourly) only deploys on Pro. Hobby tier deploys at most daily; cron-job.org fallback was researched and dropped.
  - Source: STATE.md Plan 08-08 confirmation; Plan 08-04 daily-fallback note.
- **Booker timezone is submitted at booking time, not verified.** `Intl.DateTimeFormat().resolvedOptions().timeZone` on mount; server trusts it. Booker owns their clock display.
  - Source: STATE.md "Browser TZ SSR safety" (Plan 05-06) line.
- **`RESERVED_SLUGS` duplicated across two files.** `app/[account]/[event-slug]/_lib/load-event-type.ts` AND `app/[account]/_lib/load-account-listing.ts`. Set is `["app", "api", "_next", "auth", "embed"]`. Any new reserved slug MUST be added to BOTH files.
  - Source: STATE.md "RESERVED_SLUGS duplicated" Plan 07-08 line.
- **Migration drift workaround.** `npx supabase db push --linked` fails with "Remote migration versions not found" because of three orphan timestamps in remote `supabase_migrations.schema_migrations` (20251223162516, 20260419144234, 20260419144302). Locked workaround: `npx supabase db query --linked -f <migration-file>`. Same Management API path; bypasses the tracking table.
  - Source: STATE.md "Migration drift workaround LOCKED" Plan 08-01 line.
- **Apply migrations via Supabase MCP `apply_migration` tool when available; CLI fallback otherwise.** CLI-versioned files committed under `supabase/migrations/` for portability; live remote tracked via Management API.
- **Public booking endpoints (`/api/slots`, `/api/bookings`, `/api/cancel`, `/api/reschedule`) use service-role admin client.** RLS-scoped client returns 0 rows for anonymous callers; bypass is required. Inputs always validated (UUID + date regex + Zod) before any DB query. `import "server-only"` on `lib/supabase/admin.ts` line 1 prevents client-bundle leakage.
  - Source: STATE.md Plan 04-06 + Plan 05-05 lines.
- **Cancel/reschedule rate limiting at 10/5min/IP; bookings rate limit at 20/5min/IP.** Same `rate_limit_events` table; per-route key prefix (`cancel:`, `reschedule:`, `bookings:`).
  - Source: STATE.md "POST /api/bookings rate-limited" Plan 08-03 line.
- **Token rotation on every reminder send invalidates the original confirmation tokens.** Each cron tick (and immediate-send hook) generates fresh raw cancel + reschedule tokens, hashes them, and writes them in the same UPDATE that claims `reminder_sent_at`. Original confirmation-email lifecycle links stop working as soon as the reminder ships. Stale tokens hit the friendly "no longer active" page.
  - Source: STATE.md "Token rotation invalidates original confirmation tokens" Plan 08-04 line.
- **Reminder retry on send failure = NONE by design.** RESEARCH Pitfall 4: clearing `reminder_sent_at` on send failure would cause retry spam. v1 accepts at-most-once delivery per booking; failed sends produce no reminder.
  - Source: STATE.md Plan 08-04 line.
- **Default account branding fallback = NSI navy `#0A2540`.** `DEFAULT_BRAND_PRIMARY` in `lib/branding/contrast.ts`. Applied when `accounts.brand_primary` IS NULL.
  - Source: STATE.md "DEFAULT_BRAND_PRIMARY" Plan 07-01 line.
- **`X-Frame-Options` header is owned exclusively by `proxy.ts`.** NEVER set in `next.config.ts` — Next.js merges static headers AFTER middleware, silently overwriting `proxy.ts`'s `response.headers.delete("X-Frame-Options")` on `/embed/*` routes. Confirmed in production 2026-04-26.
  - Source: STATE.md "X-Frame-Options ownership rule (Phase 7 LOCKED)" line.
- **Logo upload PNG-only in v1.** SVG can embed `<script>` tags and is an XSS surface; deferred to v2 with sanitization. 2 MB cap; magic-byte server check catches spoofed MIME.
  - Source: STATE.md "PNG-only in v1 for logo upload" Plan 07-04 line.
- **`accounts.logo_url` cache-busted with `?v=${Date.now()}`** at upload time. Downstream consumers (booking page, email senders) MUST pass the URL through unchanged — stripping the query param breaks Gmail's image-proxy invalidation.
  - Source: STATE.md "Cache-bust via ?v=" Plan 07-04 line.
- **Supabase project + ref locked.** `mogfnutxrrbtvnaupoun`, region West US 2, Postgres 17.6.1. `supabase link --project-ref mogfnutxrrbtvnaupoun` already established; `supabase db query --linked` works without re-link.
- **Seeded account.** `slug=nsi`, `id=ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_email=ajwegner3@gmail.com`, `owner_user_id=1a8c687f-73fd-4085-934f-592891f51784`.

---

## 3. Future Improvements

- **Gmail SMTP → Resend/Postmark migration.** Phase 10 ships a 200/day cap + 80%-threshold warning + fail-closed-at-cap (`lib/email-sender/quota-guard.ts`) to mitigate P-A12. v1.2 should migrate to Resend ($10/mo for 5k transactional emails) for higher headroom and proper SPF/DKIM/DMARC posture (closes EMAIL-08 v1.2 backlog item).
- **v2: multi-tenant signup + onboarding flow** (out of scope for v1; per CONTEXT.md no further detail).
- **Reminder retry/resend UI.** "Resend reminder" action on `/app/bookings/[id]` detail page (08-07 surfaces the page already). Critical caveat: do NOT clear `reminder_sent_at` automatically on send failure — would cause retry spam (RESEARCH Pitfall 4). Manual one-shot resend is the safe shape.
  - Source: STATE.md "Phase 9 backlog: reminder retry/resend UI" line.
- **Plain-text email alternative for confirmation email.** Add `stripHtml()` import + `text: stripHtml(html)` to the `sendEmail()` call in `lib/email/send-booking-confirmation.ts`. Mirrors the existing pattern in `lib/email/send-reminder-booker.ts:192-202`.
  - Source: §1 Known Limitations.
  - Low-risk; small commit.
- **NSI mark / logo image in "Powered by NSI" email footer.** Currently text-only because `NSI_MARK_URL = null` (`lib/email/branding-blocks.ts:44`). Add `/public/nsi-mark.png` to repo, set `NSI_MARK_URL = ${appUrl}/nsi-mark.png` (per inline TODO at `branding-blocks.ts:35-41`).
  - Source: STATE.md "NSI_MARK_URL=null in v1" Plan 07-07 line.
- **Apple Mail live testing pass.** When device access becomes available. Run the full `.ics` round-trip (accept invite → calendar event → cancel via email link → calendar removes event) on macOS Mail + iOS Mail. If a future Apple Mail user reports broken cancel auto-removal, first thing to check is ORGANIZER email vs SMTP From alignment (currently both = `ajwegner3@gmail.com`).
  - Source: §5 below + `09-CHECKLIST.md` Apple Mail findings #9.
- **Live email-client validation pass (Gmail web/iOS, Outlook web/desktop).** Per-template branding smoke across 6 surfaces (rows 2a–2f from `09-CHECKLIST.md`).
  - Source: `09-CHECKLIST.md` Marathon Criteria row #2 + sub-table 2a–2f.
- **Live Squarespace + Wix + WordPress embed test.** Real https:// hosted page (not file:// — `frame-ancestors *` doesn't match opaque origins). Verify: (1) widget.js injects iframe + auto-resizes via postMessage; (2) full booking completes; (3) multi-mount independence; (4) duplicate `<script>` idempotency.
  - Source: STATE.md Plan 07-09 deferred line; `09-CHECKLIST.md` Deferrals row #1.
- **mail-tester.com pass.** Confirmation AND reminder ≥9/10. CONTEXT.md policy: one retry attempt; if still <9/10, log specific failures here as deliverability item.
  - Source: `09-CHECKLIST.md` Marathon Criteria row #3.
- **DST / cross-timezone live E2E.** Cross-timezone booking (NY booker × Chicago account) OR November 1 2026 fall-back DST-spanning slot, with real email confirmation rendered.
  - Source: `09-CHECKLIST.md` Marathon Criteria row #4.
- **Responsive 320 / 768 / 1024 live multi-viewport pass** on hosted booking page AND embed.
  - Source: `09-CHECKLIST.md` Marathon Criteria row #5.
- **Multi-tenant UI isolation walkthrough.** Manual login as the 2nd test user; confirm dashboard shows zero of Andrew's bookings/event-types/availability/branding.
  - Source: `09-CHECKLIST.md` Marathon Criteria row #6.
- **Phase 8 dashboard human walkthrough.** 9 items enumerated in `09-CHECKLIST.md` Phase 8 section.
- **Comprehensive a11y audit.** WCAG 2.1 AA on booking flow + dashboard. Not a v1 ROADMAP criterion.
  - Source: 09-CONTEXT.md Deferred Ideas.
- **Performance / Lighthouse audit on booking page.** Not a v1 criterion; no formal benchmark required.
  - Source: 09-CONTEXT.md Deferred Ideas.
- **Production cron observation across multiple hourly ticks.** v1 verifies first-tick fires (and even that was deferred). Sustained multi-day reliability monitoring is post-ship operational work.
  - Source: 09-CONTEXT.md Deferred Ideas.
- **`qa-test` dedicated event type.** Plan 09-01 prereq #4 was skipped per Andrew's direction ("reuse existing event types for QA bookings"). Cleaner regression-test isolation could be re-introduced in v1.1 by creating a dedicated `qa-test` event type with separate availability profile.
  - Source: STATE.md "v1.1 backlog (Plan 09-01 deferral): qa-test event type" line.
- **Cron-fired-in-production functional proof.** Vercel Crons UI tab not surfacing the schedule for Andrew despite `vercel.json` deployed. Verify with a real reminder arrival (mail-tester or seeded booking <24h out) when picking this up.
  - Source: `09-CHECKLIST.md` Pre-flight + Deferrals row #2.

---

## 4. Technical Debt

- **19 ESLint violations from Plan 08-02 — current status: 1 documented warning remaining.**
  - Source: `.planning/phases/08-reminders-hardening-and-dashboard-list/08-02-SUMMARY.md` (original 19 enumerated); `.planning/phases/09-manual-qa-and-verification/09-01-SUMMARY.md` (cleanup outcome).
  - **Status:** 9 errors + 11 warnings → 1 documented warning. Cleared in Plan 09-01 commit `61b276f`.
  - **Remaining:** `react-hooks/incompatible-library` warning at `app/(shell)/app/event-types/_components/event-type-form.tsx:99` — RHF `watch("name")` returns a non-memoizable function; React Compiler skips memoization on this component. Informational only; no runtime impact.
  - **Fix path:** replace `watch("name")` with `useWatch({ control: form.control, name: "name" })` — stable subscription the compiler can reason about.
  - **`hooks/use-mobile.ts` decision (RESEARCH Open Question 3):** Option A taken — full refactor to `useSyncExternalStore` (subscribe + getSnapshot + getServerSnapshot). Server snapshot returns `false` (desktop-first SSR). Canonical React 19+ matchMedia pattern.
    - Source: 09-01-SUMMARY.md Decision #4.
  - **`react-hooks/incompatible-library` (RESEARCH Open Question 4):** identified library is `react-hook-form`'s `watch()` function. Handled as DEFERRED (warning kept; refactor pending).
    - Source: 09-01-SUMMARY.md Decision #6.
- **Audit-row `void` cleanup in `lib/bookings/cancel.ts` + `lib/bookings/reschedule.ts`.** Status: FIXED in Plan 09-01 (commit `3d84607` + tsc fix folded into `61b276f`). Both `void supabase.from('booking_events').insert(...)` patterns now wrapped as `after(async () => { const { error } = await supabase...insert(...); if (error) console.error(...); })`. Async-callback shape required to satisfy `AfterCallback<void>` typing. Zero `void supabase` patterns left in those files.
  - Source: STATE.md "Phase 9 backlog: audit-row `void` cleanup" line; 09-01-SUMMARY.md Task 3.
- **Pre-existing `tsc --noEmit` test-mock alias errors.** Imports of `__mockSendCalls`, `__resetMockSendCalls`, `__setTurnstileResult` from `@/lib/email-sender` and `@/lib/turnstile` are aliased only in `vitest.config.ts`. Tests run green; tsc fails. Pre-dates Plan 09-01.
  - Fix options: (a) add tsconfig path mapping; (b) split mocks into separately-importable modules with proper TS exports.
  - Source: `09-CHECKLIST.md` Deferrals row #5.
- **`RESERVED_SLUGS` duplication.** Two files own copies of the set; must be hand-synced. See §2 Assumptions & Constraints.
- **Migration drift workaround.** `supabase db push --linked` fails; `db query --linked -f` is the locked alternative. See §2 Assumptions & Constraints.
- **Booker-timezone display in bookings list shows booker's timezone, not owner's.** INTENTIONAL per Plan 08-06 lock (matches confirmation/reminder email convention — owner sees the same time the booker sees). May confuse future developers; document inline if a comment is added.
  - Source: STATE.md "Booker-timezone display extends to list view" Plan 08-06 line.
- **Plan 08-05 / 08-06 / 08-07 wave-2 git-index race.** Despite explicit `git add` of named paths, parallel agents' `git add` ran between staging and commit, sweeping in untracked files from sibling plans. No worktree corruption; both works tested green; commit-attribution mixed.
  - Source: STATE.md "Wave-2 git-index race surfaced" Plan 08-05 line; 08-05-SUMMARY.md / 08-06-SUMMARY.md / 08-07-SUMMARY.md deviations.
  - Future YOLO multi-wave runs: serialize commits across agents, OR teach agents to verify staging matches expectation right before commit (`git diff --cached --name-only` assertion), OR use per-plan git worktrees.
- **`generateMetadata` double-load on public booking page.** Both `generateMetadata` and `BookingPage` call `loadEventTypeForBookingPage()` (two DB round-trips per request). Acceptable for v1; future optimization could wrap in `import { cache } from 'react'`.
  - Source: STATE.md "generateMetadata double-load" Plan 05-04 line.
- **Two-stage owner-auth pattern repeated across actions.** `getOwnerAccountIdOrThrow()` in branding actions, `cancelBookingAsOwner` in Phase 6, `saveReminderTogglesCore` in Phase 8. Pattern is locked; could be extracted into a shared `requireOwnerOf(accountId)` helper if reuse expands further.
  - Source: STATE.md Plan 07-04 + Plan 08-05 lines.
- **No transaction wrapper for delete+insert pairs in availability date-overrides action.** supabase-js has no explicit tx API. Worst case (delete ok, insert fails): day shows Closed until retry. Acceptable for v1 single-tenant. Fix path: Postgres RPC wrapping the pair.
  - Source: STATE.md "No transaction wrapper for delete+insert pairs" Plan 04-03 line.

---

## 5. Untested Email Clients

**Apple Mail (Mac + iOS) live-tested = NO.** No device access. Code-review-only verification was performed in Plan 09-02 Task 1 (commit `3d5fb31`) against `lib/email/build-ics.ts`, `lib/email/branding-blocks.ts`, `lib/email/send-booking-confirmation.ts`, `lib/email/send-owner-notification.ts`, `lib/email/send-cancel-emails.ts`, `lib/email/send-reschedule-emails.ts`, `lib/email/send-reminder-booker.ts`. Verdict: **LIKELY PASS**. One low-risk cosmetic note documented.

**Findings (lifted from `09-CHECKLIST.md` Apple Mail code review findings; full text preserved):**

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
11. **Logo header gracefully omitted when `logo_url` is null** — `renderEmailLogoHeader` returns `""` (`branding-blocks.ts:20`). No empty `<table>`, no broken `<img>`. Apple Mail renders cleanly whether or not the account has a logo set.

**Recommendation:** live-test with a device when access becomes available. If a future Apple Mail user reports broken cancel auto-removal, first thing to check is ORGANIZER email vs SMTP From alignment. If Andrew's email config changes, that alignment must be preserved.

**Other untested clients (no live verification):**

- **Gmail web** — code-paths covered by automated content-quality test (`tests/reminder-email-content.test.ts`); live render unverified.
- **Gmail iOS** — code-paths covered by same; live render unverified.
- **Outlook web (outlook.live.com)** — code-paths covered; live render unverified.
- **Outlook desktop** — code-paths covered; live render unverified.
- **Proton Mail / Fastmail / Yahoo Mail** — not tested; HTML likely renders (no unusual CSS); `.ics` behavior unknown.

Source: `09-CHECKLIST.md` Apple Mail code review findings section + Marathon Criteria row #2.

---

## 6. Commit Reference

- **v1 sign-off commit:** _populated by Plan 09-03 Task 3 sign-off entry_
- **Plan 09-03 FUTURE_DIRECTIONS.md commit:** _this commit's SHA after add + commit_
- **Plan 09-02 closure commit:** `d64a417` (docs: complete marathon-qa-execution plan, deferred to v1.1)
- **Plan 09-02 CHECKLIST scope-cut commit:** `8686ae1` (docs: mark remaining marathon QA criteria deferred to v1.1)
- **Plan 09-02 Apple Mail code review commit:** `3d5fb31` (docs: apple mail code review findings + sub-table scaffold)
- **Plan 09-01 closure commit:** `f0e640d` (docs: complete pre-qa-prerequisites-and-pre-flight-fixes plan)
- **Plan 09-01 last runtime-source commit:** `61b276f` (chore: clear lint baseline ahead of Phase 9 marathon QA)
- **Phase 8 final commit:** `4f32c08` (docs: complete reminders-hardening-and-dashboard-list phase)
- **Tests green at sign-off:** 131 passing + 1 skipped = 132 total (16 test files; `npm test` 2026-04-27)
- **Production URL:** https://calendar-app-xi-smoky.vercel.app
- **GitHub:** https://github.com/ajwegner3-alt/calendar-app (main branch; auto-deploys to Vercel)
- **Supabase project ref:** `mogfnutxrrbtvnaupoun`
- **Seeded NSI account:** slug=`nsi`, id=`ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone=`America/Chicago`, owner_email=`ajwegner3@gmail.com`

---

---

## 7. v1.1 Phase 10 — Multi-User Signup + Onboarding (Carry-overs)

*Added 2026-04-28, Plan 10-09. Items deferred from Phase 10 scope to v1.2 backlog.*

- **Gmail SMTP → Resend/Postmark migration.** Phase 10 capped signup-side emails at 200/day via `lib/email-sender/quota-guard.ts` with 80%-threshold warning + fail-closed-at-cap. v1.2 should migrate to Resend (~$10/mo for 5k emails) for higher headroom and proper SPF/DKIM/DMARC posture (also closes EMAIL-08 v1.2 backlog item). Booking/reminder paths bypass the quota guard and would need a separate migration strategy.

- **OAuth signup (Google / GitHub).** Deferred per Phase 10 CONTEXT.md — v1.1 ships email+password only. Supabase supports Google + GitHub OAuth providers; the `auth/confirm` route handler already handles the `magiclink` type. Adding OAuth would require: Supabase Dashboard provider config, a new "Sign in with Google" button on the login/signup pages, and ensuring the provisioning trigger fires on OAuth-created users.

- **Magic-link / passwordless login.** Deferred per CONTEXT.md. The 10-02 `auth/confirm` route handler already supports `type=magiclink`. Enabling it requires a Supabase Dashboard toggle + UI surface.

- **Slug 301 redirect for old slugs after change.** In v1.1 (Plan 10-07), changing a slug produces a 404 for the old URL. v1.2 could store `previous_slug` and serve a 301 from `app/[account]/page.tsx`. Revisit if owners report broken-link complaints after promoting their booking page.

- **Soft-delete reversibility / "restore on login within N days".** Plan 10-07 chose immediate-no-undo: `accounts.deleted_at = now()` + signOut + redirect to `/account-deleted`. Post-delete re-login lands on `/app/unlinked` (documented UX hole). v1.2 could offer a grace period where re-login triggers an account restore prompt.

- **Hard-delete cron purge.** v1.1 ships soft-delete only; `auth.users` rows are preserved indefinitely. v1.2 cron should purge `auth.users` + `accounts` rows where `deleted_at < now() - interval '30 days'`. Requires a SECURITY DEFINER function since `auth.users` is not directly writable via RLS policies.

- **Pick-from-templates first event type.** Plan 10-06 ships a single pre-filled "Consultation / 30 min" default in the wizard. v1.2 could offer 3–4 template cards (Consultation, Discovery Call, Site Visit, etc.) for owners to choose from. Revisit if onboarding analytics show users bouncing at wizard step 3.

- **Onboarding analytics.** Phase 10 captures no metrics on wizard step progression or checklist dismissal rates. Add a `booking_events`-style event log (or use Supabase Realtime + a lightweight `onboarding_events` table) to track step transitions, drop-off points, and checklist item completion for v1.2 data-driven improvements.

- **Constant-time delay on signup + forgot-password forms.** P-A1 prevention recommends ~500ms artificial delay regardless of outcome to defeat timing oracles (attacker learns whether an email is registered by response time). v1.1 ships rate limiting + generic messaging (`P-A1` pattern), which is sufficient table-stakes. Add a `setTimeout(resolve, 500)` wrapper to `signUpAction` + `requestPasswordResetAction` for stronger posture in v1.2.

- **RLS matrix N=3 test user provisioning.** Plan 10-09 extended the cross-tenant matrix test to N=3 tenants in code, but the third test user (`nsi-rls-test-3@andrewwegner.example`) and its `accounts` row are deferred to milestone-end QA (see `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md`). Until provisioned, the 24 new N=3 test cases skip gracefully.

---

## 8. v1.1 Phase 13 — Marathon QA Waiver + Carry-overs

**Sign-off context:** Andrew explicit verbatim 2026-04-30: "consider everything good. close out the milestone." Marathon QA-09..QA-13 was waived at milestone close. v1.1 ships on code-level verifier passes (Phase 10–12.6) + Andrew's live Vercel approval of Phase 12.6 (2026-04-29) + extensive automated coverage (255 tests + 26 skipped at last green run, 277 + 4 skipped after Plan 13-01 N=3 activation).

**Source:** `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md` Sign-off section.

### 8.1 v1.1 Marathon Items DEFERRED to v1.2 (waived at sign-off)

All five marathon criteria are recorded as DEFERRED-V1.2, not silently skipped, not falsely passed.

- **QA-09 (signup → email-verify → onboarding wizard → first booking E2E) — DEFERRED-V1.2.** Code-level verifier passed Phase 10 (9/9 plans, 19/19 requirements) 2026-04-28. Live human walkthrough not exercised. Source: `13-CHECKLIST.md` Marathon Criteria row QA-09.
- **QA-10 (multi-tenant UI isolation walkthrough as Test User 2) — DEFERRED-V1.2.** Backend RLS isolation: `tests/rls-cross-tenant-matrix.test.ts` 24 N=3 cases activated 2026-04-29 (Plan 13-01) — green. UI-layer human walkthrough not exercised. Source: `13-CHECKLIST.md` Marathon Criteria row QA-10.
- **QA-11 (capacity=3 E2E across 3 sessions; 4th rejected) — DEFERRED-V1.2.** Code-level: Phase 11 verifier passed 8/8 plans 2026-04-29. CAP-06 pg-driver race test (`tests/race-guard.test.ts`) skip-guarded; will run when `SUPABASE_DIRECT_URL` is set. Live 3-session human race not exercised. Source: `13-CHECKLIST.md` Marathon Criteria row QA-11.
- **QA-12 (3-account branded smoke × 4 surfaces × 3 emails = 15 cells) — DEFERRED-V1.2.** Phase 12.6 single-account live verification done by Andrew on Vercel 2026-04-29. 3-account A/B/C cross-render not exercised. Branding profiles seeded on prod by Plan 13-01 — available for v1.2 marathon. Source: `13-CHECKLIST.md` QA-12 Sub-table (15 cells).
- **QA-13 (EmbedCodeDialog at 320 / 768 / 1024 viewports) — DEFERRED-V1.2.** Code-level: Plan 12-05 locked EmbedCodeDialog to `sm:max-w-2xl` (commit `2dc5ae1`). Multi-viewport human resize not exercised. Source: `13-CHECKLIST.md` Marathon Criteria row QA-13.

### 8.2 Per-phase Manual Checks Carried Forward (from `MILESTONE_V1_1_DEFERRED_CHECKS.md`)

The 21 per-phase deferred manual checks accumulated through Phases 10/11/12/12.5/12.6 are NOT rolled up here individually — `MILESTONE_V1_1_DEFERRED_CHECKS.md` remains the canonical row-level enumeration. v1.2 marathon should consume that file directly. Items folded by code into automated coverage (e.g., Phase 12.6 items #1–#7 LIVE-VERIFIED 2026-04-29 by Andrew) are explicitly excluded.

- Phase 10: 6 manual checks deferred (Source: `MILESTONE_V1_1_DEFERRED_CHECKS.md`)
- Phase 11: 4 manual checks deferred (Source: `MILESTONE_V1_1_DEFERRED_CHECKS.md`)
- Phase 12: 10 manual checks deferred — Phase 12.6 items #1–#7 LIVE-VERIFIED so excluded; remaining 10 deferred (Source: `MILESTONE_V1_1_DEFERRED_CHECKS.md`)
- Phase 12.5: 3 manual checks deferred (Source: `MILESTONE_V1_1_DEFERRED_CHECKS.md`)
- Phase 12.6: 8 manual checks — items #1–#7 LIVE-VERIFIED 2026-04-29; item #8 (NSI mark swap) explicitly DEFERRED-V1.2 (Source: `13-CHECKLIST.md` Item 0)

### 8.3 v1.0 Re-Deferred Items (already in v1.2 backlog from §1, RE-confirmed at v1.1 close)

- **EMBED-07** — Live Squarespace/Wix/WordPress embed test (Source: §1, RE-confirmed by ROADMAP scope-NOT-in-Phase-13 lock).
- **EMAIL-08** — SPF/DKIM/DMARC + mail-tester ≥ 9/10 (Source: §1, RE-confirmed by ROADMAP scope-NOT-in-Phase-13 lock).
- **QA-01..QA-06** — v1.0 marathon QA criteria (live email-client cross-test, mail-tester scoring, DST live E2E, responsive multi-viewport pass, multi-tenant UI walkthrough). v1.1 QA-10 partially covers the multi-tenant walkthrough at code level; live UI walkthrough still deferred. Source: §1, RE-confirmed by ROADMAP scope-NOT-in-Phase-13 lock.

### 8.4 v1.2 Backlog Items Captured During v1.1

Source for each: `.planning/STATE.md` Session Continuity (2026-04-30) + plan SUMMARYs.

- **Hourly cron flip after Vercel Pro upgrade.** v1.1 ships with `0 13 * * *` daily on Hobby tier; flip `vercel.json` to `0 * * * *` after Vercel Pro upgrade. Source: `STATE.md` Session Continuity.
- **`rate_limit_events` test DB cleanup.** 4 transient bookings-api.test.ts failures observed when the table accumulates between runs; truncate or scope-by-test. Source: `STATE.md` Session Continuity.
- **Replace `public/nsi-mark.png` placeholder with final NSI brand mark.** Current placeholder is 105 bytes solid-navy committed by Plan 12-06. Affects email header band footer rendering on all transactional emails. Andrew explicit skip 2026-04-29 ("isn't really all that important"). Expected ≤10KB PNG, 64-128px square, transparent background. Source: `13-CHECKLIST.md` Item 0 + Pre-flight section.
- ~~**DROP `accounts.chrome_tint_intensity` column** + companion ENUM type, plus DROP `accounts.sidebar_color`, `accounts.background_color`, `accounts.background_shade` (column + ENUM type). Plus removal of `lib/branding/chrome-tint.ts` and `chromeTintToCss` compat export.~~ **CLOSED v1.2 Phase 21** (2026-05-02). Phase 20 commit `8ec82d5` removed the runtime reads + dead code; Phase 21 migration `20260502034300_v12_drop_deprecated_branding_columns.sql` permanently dropped the 4 columns + 2 ENUM types.
- **Live cross-client email QA — Outlook desktop, Apple Mail iOS, Yahoo.** Deferred since v1.0; QA-12 surface 4 (email header band cross-render) was the v1.1 attempt and is itself deferred. Source: `STATE.md` Session Continuity + §1 + §5.
- **Pre-13-01 NSI branding restoration (optional).** Plan 13-01 overwrote NSI's branding to `(navy / #F8FAFC / subtle / navy / null)` for QA-12 visual contrast. Pre-13-01 values captured in `13-CHECKLIST.md` Test Artifacts Created section: `(brand_primary='#5ABF6E', background_color='#FFFFFF', background_shade='subtle', sidebar_color='#10B981', chrome_tint_intensity='subtle')`. Andrew did not request restoration at close-out — KEEP for now; revisit if NSI marketing materials reference the green palette.
- **Cleanup of pre-flight test artifacts (Test User 3 + capacity-test event_type + branding profiles).** KEEP decision recorded at close-out — useful for v1.2 marathon execution. Revisit if Test User 3's seeded availability_rules cause cron / reminder confusion. Source: `13-CHECKLIST.md` Test Artifacts Created section.

### 8.5 Phase 13 Commit Reference

- Phase 13 plan-creation commit: `e0e8e9a` (`docs(13): commit phase 13 plan documents (13-01, 13-02, 13-03)`)
- Phase 13 research commit: `d898503` (`docs(13): research phase domain`)
- Plan 13-01 close-out: `cc641eb` (`docs(13-01): complete plan — SUMMARY, STATE update, CHECKLIST item-6 SHA`)
- Phase 13 + v1.1 milestone close commit: _populated post-commit; reference the commit that bundles ROADMAP + STATE + REQUIREMENTS + 13-CHECKLIST sign-off + this §8 update + 13-02-SUMMARY + 13-03-SUMMARY_

---

*v1 sign-off: Phase 9 Plan 09-03, 2026-04-27. v1.1 sign-off: Phase 13 marathon waiver + close-out, 2026-04-30 ("consider everything good. close out the milestone"). Future Claude Code sessions: read this file after CLAUDE.md, then proceed.*

---

## Phase 36: Resend Backend — Activation Steps (Deferred from Phase 36)

Phase 36 shipped the **framework only** on 2026-05-08. The provider, factory routing, quota bypass, abuse warning, and dual-prefix orchestrator fix are all in place and unit-tested. To activate Resend for a real customer, the following steps are required:

### PREREQ-03 — Resend account + NSI domain DNS

1. Create a Resend account (free tier sufficient for verification; Pro tier ~$20/month for production volume).
2. In Resend dashboard → Domains → Add `nsintegrations.com`.
3. Resend will provide DNS records — add them in Namecheap DNS:
   - **SPF**: TXT record (Resend value)
   - **DKIM**: 3 CNAME records (Resend values)
   - **DMARC** (recommended): TXT record `v=DMARC1; p=none; rua=mailto:...`
4. Wait for Resend dashboard to show "Verified" for SPF + DKIM (typically minutes; can take up to 24h).
5. From Resend dashboard → API Keys → Create API Key (production scope).

### Vercel env var — RESEND_API_KEY

1. Vercel → Project → Settings → Environment Variables.
2. Add `RESEND_API_KEY` for both **Preview** and **Production** with the value from step 5 above.
3. Redeploy (or trigger a new deploy for the change to take effect).

### First-customer live integration test

Before flipping a real customer to Resend, validate the path end-to-end:

1. Pick a test account in Supabase (e.g. `nsi-test`).
2. Run in Supabase SQL editor:
   ```sql
   UPDATE accounts SET email_provider = 'resend' WHERE slug = 'nsi-test';
   ```
3. Make a test booking against `https://booking.nsintegrations.com/nsi-test/...`.
4. Verify in Resend dashboard → Logs that the send appears with HTTP 200.
5. Verify the booker inbox: email arrives with display name matching the account's `name` field and `bookings@nsintegrations.com` in the envelope.
6. Verify Gmail renders the `.ics` attachment as an inline RSVP card (Yes/Maybe/No buttons). If it does NOT, the `content_type: "text/calendar; method=REQUEST"` field is the lever — see RESEARCH §4 for the downgrade path.
7. Reply to the email — confirm the reply goes to the account owner's address (via `Reply-To`), not to NSI.
8. After confirming success, decide whether to keep the test account on Resend or flip back:
   ```sql
   UPDATE accounts SET email_provider = 'gmail' WHERE slug = 'nsi-test';
   ```

### Customer activation flow

Once the live integration test passes, real customer activation is a one-line SQL update:

```sql
UPDATE accounts SET email_provider = 'resend' WHERE id = '...';
```

No code change, no redeploy. The factory routes immediately on the next send.

### Suspension lever

To suspend a Resend account (abuse, unpaid customer) without forcing them back to Gmail:

```sql
UPDATE accounts SET resend_status = 'suspended' WHERE id = '...';
```

All sends from that account refuse with `resend_send_refused: account_suspended` until you flip `resend_status` back to `'active'`.
