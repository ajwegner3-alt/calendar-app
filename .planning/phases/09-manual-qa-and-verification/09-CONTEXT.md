# Phase 9: Manual QA & Verification - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Andrew personally verifies that v1 works end-to-end on real systems (live embed site, real email clients, multi-device, multi-tenant) and signs off that v1 is shippable. Closes EMBED-07 + QA-01..08. Outputs: `09-CHECKLIST.md` (verification log), `FUTURE_DIRECTIONS.md` (committed to repo root), and Andrew's explicit ship sign-off.

This phase **does not ship new features** — it executes the verification of features already shipped in Phases 1-8. Any bug uncovered during QA is fixed inline (fix-as-you-go) but no new capabilities are added.

</domain>

<decisions>
## Implementation Decisions

### Verification structure & pacing
- **Marathon session** — push through all criteria in one sitting (estimated 2-4 hours)
- **Tracking artifact:** `09-CHECKLIST.md` maintained by Claude — pass/fail per item with notes and timestamps
- **Granularity:** Criterion-level (8 items from ROADMAP success criteria), not sub-item level
- **Driver:** Claude proposes the next item to verify with how-to instructions; Andrew executes and reports back; Claude updates the checklist

### Failure handling & pass bar
- **Strict pass bar by default** — all 8 criteria must pass to ship v1
- **Override allowed** — Andrew can call "defer this to v1.1" on any individual issue at the time it's surfaced; deferred items go into `FUTURE_DIRECTIONS.md`
- **Fix-as-you-go on failures** — when a check fails, pause QA, drop into a quick patch plan, ship the fix, re-verify, then continue
- **Test event type:** Create a dedicated `qa-test` event type (or similar slug) on the `nsi` account specifically for QA bookings. Hide/archive after Phase 9 closeout
- **Booker identity for tests:** Use Gmail "+aliasing" — `ajwegner3+booker@gmail.com`, `+booker2`, `+spam-test`, etc. — so all test bookings route to Andrew's primary inbox without polluting real contacts

### Live-system test plan
- **Embed test site = Phase 9 prereq** — Andrew does not have a live Squarespace or WordPress site available yet. Must spin one up before the embed verification can run. Recommended: Squarespace 14-day free trial (no DNS work needed; uses Squarespace subdomain) — fastest path. WordPress.com free tier is the alternative if Squarespace trial is unavailable.
- **Embed placement:** Dedicated hidden test page (e.g., `/booking-test`, unlinked from main nav). Safe to leave in place after QA. Do NOT replace any live "Book a call" button on a real client-facing page.
- **Multi-tenant probe (Criterion #6):** Manual UI login as the 2nd test user (`andrewjameswegner@gmail.com`) at `/app/login`. Verify dashboard shows zero of Andrew's bookings, event types, availability, and branding. Trust the automated RLS matrix test (Phase 8) to cover programmatic isolation; this manual probe is the UX-layer confirmation.
- **Deploy target:** Production (`calendar-app-xi-smoky.vercel.app`) — tests what real end users will see. No preview-deploy intermediary.

### FUTURE_DIRECTIONS.md
- **Length:** Standard 3-5 pages
- **Audience:** Future Claude Code sessions (NOT human engineers, NOT operators). Structure it like CLAUDE.md — scannable, decision-dense, no marketing fluff. Use clear section headers, fact-statement bullets, and cite source files/commits where applicable so a future Claude session can verify claims against the live codebase
- **Source material:** Pull from all three:
  1. STATE.md "Carried Concerns" / backlog items
  2. Each phase SUMMARY's "Deferred to Phase 9" or equivalent section
  3. The 19 ESLint violations from Plan 08-02 (categorized: 6× react-hooks/set-state-in-effect, 1× react-hooks/refs, 1× react-hooks/incompatible-library, 8× @typescript-eslint/no-unused-vars, 2× react-hooks/exhaustive-deps, 1× misc)
- **v2 hint depth:** Just name v2 ("multi-tenant signup + onboarding flow; out of scope for v1") — do not outline capabilities or architectural hooks
- **Standard sections:** Known Limitations, Assumptions & Constraints, Future Improvements, Technical Debt — per CLAUDE.md spec

### Email client coverage
- **Available clients (test all four):** Gmail web (browser), Gmail iOS, Outlook web (outlook.live.com), Outlook desktop
- **Apple Mail (Mac + iOS): NOT available for testing** — deferred to user reports, BUT before deferring, Claude does a code-level review of `lib/email/`, `.ics` generation in `lib/email/build-ics.ts`, and `lib/email/branding-blocks.ts` to flag any patterns known to render poorly in Apple Mail (e.g., unsupported CSS, malformed VTIMEZONE, missing PRODID). Findings logged in `FUTURE_DIRECTIONS.md` under "Untested email clients."
- **`.ics` test rigor:** Exhaustive — accept invite + verify it appears on calendar with correct title/time/timezone/organizer + then cancel/reschedule via the email link triggers proper update on the calendar
- **`mail-tester.com` policy:** One retry attempt. If still <9/10 after retry, log the specific failures in `FUTURE_DIRECTIONS.md` as a deliverability item to revisit. Do NOT block ship on score alone — clients will be actively looking for booking emails, so even modest deliverability is workable
- **Fix-as-you-go content tweak (triggered during deliverability QA):** Add a "Check your spam folder just in case the email landed there" line to confirmation and reminder email templates. Small copy change to `lib/email/send-booking-confirmation.ts` and `lib/email/send-reminder-booker.ts` (or wherever the templates live). This is captured here so it lands as part of the Phase 9 deliverability check rather than a separate plan

### Claude's Discretion
- Exact `09-CHECKLIST.md` format and structure
- Order of QA items within the marathon session (Claude can sequence for momentum — e.g., quick wins first to build confidence, save the embed test for after the prereq site is ready)
- Specific phrasing for "how to verify" instructions per item
- `FUTURE_DIRECTIONS.md` exact section structure and bullet wording (within the constraints above)
- Whether the Apple Mail code-review writeup is its own checklist item or a sub-section of the email rendering item

</decisions>

<specifics>
## Specific Ideas

- **Checklist file is the system of record during QA** — not the conversation. If Andrew has to pause and resume, the checklist tells the next session exactly where things stand
- **"Strict + override" pattern** — default to strict pass bar; Andrew can verbally downgrade any single item to "deferred to v1.1" at the time it surfaces. This avoids the failure mode of either (a) shipping with hidden known issues or (b) blocking ship on cosmetic stuff
- **Spam-folder copy line is the only content change scoped into Phase 9** — everything else is verify-or-fix on existing features. If other content tweaks come up, defer to v1.1 with a note unless Andrew explicitly approves the addition
- **`FUTURE_DIRECTIONS.md` is a Claude Code briefing document** — when a future session opens this repo, this file should be the second thing it reads after CLAUDE.md. Treat it as a CLAUDE-readable context file, not a human-readable changelog

</specifics>

<deferred>
## Deferred Ideas

- **Embed verification on a real client-facing site** — Phase 9 uses a hidden test page on a Squarespace trial. Real-world placement on actual NSI client sites comes after v1 ships, when those clients sign on
- **Apple Mail live testing** — deferred to user reports. If Andrew or a client has Apple Mail access later, run the .ics + email rendering checks then. Claude's code review during Phase 9 is the v1 stand-in
- **Comprehensive accessibility audit (a11y)** — not on the v1 verification list per ROADMAP. Note in FUTURE_DIRECTIONS.md as a v1.x item
- **Performance / Lighthouse scoring on the booking page** — not a Phase 9 criterion. Note in FUTURE_DIRECTIONS.md if any obvious perf issues surface during QA, but no formal benchmark required
- **Production cron observation across multiple hourly ticks** — Phase 9 verifies the first tick succeeds (logs in Vercel Cron dashboard show 200 OK + reminder email delivered). Sustained reliability monitoring is post-ship operational work, not v1 sign-off
- **Squarespace + WordPress dual-platform verification** — Phase 9 only requires ONE platform. The other goes into FUTURE_DIRECTIONS.md as untested-but-supported

</deferred>

<prereqs>
## Pre-QA Prerequisites (Andrew action items before Phase 9 execution)

These must be done before the marathon QA session can run end-to-end. Capture in the planner's first task or as a checkpoint:

1. **Spin up an embed test site** — Squarespace 14-day free trial (recommended) OR WordPress.com free tier. Use the platform's free subdomain (no DNS work needed)
2. **Create a hidden test page** on the chosen platform — e.g., `/booking-test`, unlinked from main nav, ready to receive the embed snippet
3. **Verify production environment is fully provisioned:**
   - `CRON_SECRET` in Vercel env vars (Production + Preview) — already done by Andrew
   - Vercel Cron has fired at least once (check Vercel Dashboard → Crons tab for green status)
   - Latest production deploy includes Phase 8 commits through `4f32c08`
4. **Set up a 2nd booker email** — confirm Gmail `+aliasing` works (`ajwegner3+booker@gmail.com` should route to your inbox); test by sending yourself a probe email
5. **Open mail-tester.com once** to confirm the disposable address generation works (10-minute window per address; need a fresh one for each retry)

</prereqs>

---

*Phase: 09-manual-qa-and-verification*
*Context gathered: 2026-04-27*
