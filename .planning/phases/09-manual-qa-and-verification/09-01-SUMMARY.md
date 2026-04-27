---
phase: 09-manual-qa-and-verification
plan: "09-01"
subsystem: testing
tags: [eslint, react-hooks, set-state-in-effect, after, deliverability, cron, lint-cleanup, useSyncExternalStore]

# Dependency graph
requires:
  - phase: 08-reminders-hardening-and-dashboard-list
    provides: "Vercel Cron hourly schedule (vercel.json), CRON_SECRET wiring, reminder email pipeline, audit-row insert call sites in cancel/reschedule"
provides:
  - "Spam-folder copy line in confirmation + reminder emails (deliverability nudge)"
  - "after()-wrapped audit-row inserts in cancel.ts + reschedule.ts (zero `void supabase` patterns left)"
  - "Lint baseline cleared: 9 errors + 11 warnings → 1 documented warning"
  - "useSyncExternalStore refactor of hooks/use-mobile.ts (canonical matchMedia pattern)"
  - "ESLint argsIgnorePattern: ^_ honors underscore-prefixed unused vars"
  - "09-CHECKLIST.md scaffold with 8 ROADMAP criteria + 9 Phase 8 sub-criteria + deferrals section"
affects:
  - "09-02 marathon QA (consumes the cleaned baseline + uses CHECKLIST as session-of-record)"
  - "09-03 future-directions and sign-off (consumes the deferrals captured here)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncExternalStore for matchMedia subscriptions (replaces useState + useEffect addEventListener)"
    - "after(async () => { ... }) for fire-and-forget Postgres writes (typed AfterCallback<void>)"
    - "Targeted // eslint-disable-next-line react-hooks/set-state-in-effect with intent comment for canonical async-fetch + dialog-reseed + browser-API-detection patterns"

key-files:
  created:
    - .planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md
    - .planning/phases/09-manual-qa-and-verification/09-01-SUMMARY.md
  modified:
    - lib/email/send-booking-confirmation.ts
    - lib/email/send-reminder-booker.ts
    - lib/bookings/cancel.ts
    - lib/bookings/reschedule.ts
    - eslint.config.mjs
    - hooks/use-mobile.ts
    - app/(shell)/app/availability/_components/override-modal.tsx
    - app/(shell)/app/bookings/[id]/_components/owner-note.tsx
    - app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx
    - app/(shell)/app/event-types/_components/event-type-form.tsx
    - app/(shell)/app/event-types/_components/event-types-table.tsx
    - app/(shell)/app/event-types/_components/restore-collision-dialog.tsx
    - app/[account]/[event-slug]/_components/booking-form.tsx
    - app/[account]/[event-slug]/_components/booking-shell.tsx
    - app/[account]/[event-slug]/_components/slot-picker.tsx
    - app/reschedule/[token]/_components/reschedule-shell.tsx
    - tests/bookings-api.test.ts
    - tests/cancel-reschedule-api.test.ts

key-decisions:
  - "Squarespace/Wix prereq DROPPED — Plan 09-02 substitutes 'embed on Andrew's own Next.js site' for Criterion #1; Squarespace/Wix verification deferred to FUTURE_DIRECTIONS.md"
  - "qa-test event type SKIPPED — Plan 09-02 reuses existing NSI event types instead"
  - "Cron-fired-in-production verification DEFERRED to Plan 09-02 mail-tester step (Vercel Crons UI tab not surfacing schedule, but vercel.json deployed)"
  - "useSyncExternalStore (Option A) chosen for hooks/use-mobile.ts (clean refactor, ~15 LOC)"
  - "Targeted eslint-disable with intent comments preferred over wholesale rule disable for legitimate set-state-in-effect patterns (dialog reseed, async fetch, matchMedia detection)"
  - "react-hooks/incompatible-library warning at event-type-form.tsx:99 deferred — needs useWatch refactor; no runtime impact, informational only"

patterns-established:
  - "Deliverability-nudge segment (`<p>spam or junk folder...</p>`) inserted before footer hr in both transactional emails, no toggle gate"
  - "after() audit-row inserts: async () => { const { error } = await ...; if (error) console.error(); } shape for proper AfterCallback<void> typing"
  - "ESLint config additive override: pure rule-tweaking block placed before ignores block in flat-config array"

# Metrics
duration: ~75min
completed: 2026-04-27
---

# Phase 9 Plan 09-01: Pre-QA Prerequisites and Pre-flight Fixes Summary

**Cleared the lint baseline (9 errors + 11 warnings → 1 documented warning), wrapped audit-row inserts in after(), shipped a spam-folder deliverability nudge into both transactional emails, and scaffolded the marathon QA checklist — all while honoring the user's pre-flight scope reductions (Squarespace + qa-test event type dropped/skipped).**

## Performance

- **Duration:** ~75 min (Tasks 2-6 only; Task 1 was a human-action prereq)
- **Started:** 2026-04-27T17:55:00Z (Task 2 begin)
- **Completed:** 2026-04-27T23:08:08Z (after final verification)
- **Tasks:** 5 of 6 (Task 1 was human-action — Andrew confirmed prereq state outside Claude)
- **Files modified:** 16 source files + 1 new checklist + 1 new summary

## Accomplishments

- **Spam-folder deliverability nudge** added to both confirmation and reminder emails, identical inline-styled copy line, no toggle gate (rendered for all recipients).
- **Audit-row `after()` migration** completed in `lib/bookings/cancel.ts` (lines 191-205) and `lib/bookings/reschedule.ts` (lines 211-226). Zero remaining `void supabase` patterns in those files. The migration revealed a tsc type mismatch (`PromiseLike<void>` vs `AfterCallback<void>`) — folded the fix into Task 4.
- **Lint baseline cleared** from 20 problems (9 errors + 11 warnings) down to 1 documented warning. Highlights:
  - Refactored `hooks/use-mobile.ts` from `useState + useEffect(matchMedia)` to `useSyncExternalStore` (canonical pattern, ~25 LOC including JSDoc).
  - Removed `Date.now()` impure call during render in `owner-note.tsx` — derived state from `savedAt !== null` since the existing setTimeout already enforces the 2s ceiling.
  - Added `argsIgnorePattern: "^_"` to ESLint config — clears 6 underscore-prefixed unused-var warnings without touching test files.
  - Removed 2 stale `eslint-disable-next-line react-hooks/exhaustive-deps` directives.
  - Targeted `eslint-disable-next-line react-hooks/set-state-in-effect` with intent comments on 6 legitimate patterns (browser-TZ detection, dialog re-seed on open, canonical async-fetch effect).
  - Removed dead `Resolver` type import in event-type-form.tsx.
  - Renamed unused `showArchived` prop in event-types-table.tsx to `_showArchived` (preserved API contract, silenced lint).
  - Cleared 2 test-only unused-var warnings (renamed `count` → `_count`, dropped unused `BookingFixture` type import).
- **09-CHECKLIST.md scaffold** created with 8 ROADMAP criteria + 9 Phase 8 sub-criteria + Apple Mail findings placeholder + Deferrals section pre-seeded with 5 carry-forward items.
- All commits pushed to `origin/main`; Vercel auto-deployed and root + `/nsi` + `/app/login` all return 200.

## Task Commits

Each task was committed atomically:

1. **Task 1: Andrew completes 5 Pre-QA prerequisites** — _no commit (human-action checkpoint)_
2. **Task 2: Add spam-folder copy line** — `8146af8` (feat)
3. **Task 3: Migrate audit-row void → after()** — `3d84607` (refactor) — note: tsc type fix folded into commit `61b276f` since it was discovered during Task 4 verification.
4. **Task 4: Lint cleanup** — `61b276f` (chore) — 16 files; spans the lint config, hooks/use-mobile refactor, 6 set-state-in-effect targeted disables, the tsc fix for after()-callback signature, and the 2 test-file cleanups.
5. **Task 5: 09-CHECKLIST.md scaffold** — `63c45b0` (docs)
6. **Task 6: Push + verify deploy** — _no commit (push + smoke verification only)_; pushed all 4 prior commits to origin/main; Vercel deployed; root, `/nsi`, `/app/login` all 200.

**Plan metadata commit:** _pending — this SUMMARY.md + STATE.md update will commit together as `docs(09-01): complete pre-qa-prerequisites-and-pre-flight-fixes plan`._

## Files Created/Modified

**Created:**
- `.planning/phases/09-manual-qa-and-verification/09-CHECKLIST.md` — Phase 9 marathon QA session-of-record artifact, ready for Plan 09-02 to fill inline.
- `.planning/phases/09-manual-qa-and-verification/09-01-SUMMARY.md` — this file.

**Modified (production code):**
- `lib/email/send-booking-confirmation.ts` — inserted spam-folder copy line before footer `<hr>`.
- `lib/email/send-reminder-booker.ts` — pushed new spam-folder segment between lifecycle-links and footer.
- `lib/bookings/cancel.ts` — wrapped audit-row insert in `after(async () => { ... })`; rewrote callback shape to satisfy `AfterCallback<void>` typing.
- `lib/bookings/reschedule.ts` — same as cancel.ts.
- `eslint.config.mjs` — added `@typescript-eslint/no-unused-vars` rule override with `argsIgnorePattern: "^_"` (and varsIgnorePattern, caughtErrorsIgnorePattern, destructuredArrayIgnorePattern for parity).
- `hooks/use-mobile.ts` — full refactor to `useSyncExternalStore` (subscribe + getSnapshot + getServerSnapshot).
- `app/(shell)/app/availability/_components/override-modal.tsx` — targeted disable on dialog re-seed effect's first setState; intent comment.
- `app/(shell)/app/bookings/[id]/_components/owner-note.tsx` — removed `Date.now()` during render; `showSaved = savedAt !== null` (timer already enforces 2s window).
- `app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx` — targeted disable on dialog re-seed effect.
- `app/(shell)/app/event-types/_components/event-type-form.tsx` — removed unused `Resolver` type import.
- `app/(shell)/app/event-types/_components/event-types-table.tsx` — renamed unused `showArchived` prop to `_showArchived` with intent comment.
- `app/(shell)/app/event-types/_components/restore-collision-dialog.tsx` — targeted disable on dialog re-seed effect.
- `app/[account]/[event-slug]/_components/booking-form.tsx` — targeted `react-hooks/refs` disable on `form.handleSubmit(...)` line; intent comment.
- `app/[account]/[event-slug]/_components/booking-shell.tsx` — replaced stale exhaustive-deps disable with targeted set-state-in-effect disable + intent comment for browser-TZ detection.
- `app/[account]/[event-slug]/_components/slot-picker.tsx` — replaced stale exhaustive-deps disable with targeted set-state-in-effect disable + intent comment for canonical async-fetch effect.
- `app/reschedule/[token]/_components/reschedule-shell.tsx` — added targeted set-state-in-effect disable + intent comment for browser-TZ detection.

**Modified (tests):**
- `tests/bookings-api.test.ts` — renamed unused `count` destructure to `_count`.
- `tests/cancel-reschedule-api.test.ts` — removed unused `BookingFixture` type import.

## Decisions Made

1. **Squarespace/Wix prereq DROPPED (Andrew's call).** Phase 9 will not exercise the embed on Squarespace or Wix this round. Plan 09-02 substitutes "embed on Andrew's own Next.js site" for Criterion #1. Squarespace/Wix verification deferred to FUTURE_DIRECTIONS.md (Plan 09-03 will surface).
2. **`qa-test` event type SKIPPED (Andrew's call).** Plan 09-02 will reuse existing NSI event types for QA bookings. Booking flow has been exercised end-to-end in prior phases.
3. **Cron-fired verification DEFERRED to Plan 09-02 mail-tester step.** Andrew confirmed `CRON_SECRET` is set in Vercel Production, and `vercel.json` (commit `d8f729d`) defines the hourly schedule, but the Vercel Crons UI tab is empty. Functional proof is "did the reminder arrive" — Plan 09-02 owns it. Fix-as-you-go if it doesn't.
4. **`useSyncExternalStore` (Option A) chosen for `hooks/use-mobile.ts`.** Cleaner than targeted disable; canonical React 19+ pattern for matchMedia; ~25 LOC including JSDoc. Server snapshot returns `false` (desktop-first SSR).
5. **Targeted `eslint-disable-next-line` with intent comments** preferred over wholesale rule-disable for the 6 legitimate set-state-in-effect patterns (browser-TZ detection on mount, dialog re-seed on open, canonical async-fetch with `cancelled` flag). All 6 sites have explanatory comments naming the external system being synchronized.
6. **`react-hooks/incompatible-library` warning at `event-type-form.tsx:99` DEFERRED.** React Compiler informs that react-hook-form's `watch()` returns a function that cannot be safely memoized. Informational only — no runtime impact. Proper fix is a `useWatch({ name: "name" })` refactor in EventTypeForm. Carried into 09-CHECKLIST.md and (will be carried into) FUTURE_DIRECTIONS.md.
7. **Pre-existing tsc test-mock alias errors NOT fixed in this plan.** Tests import `__mockSendCalls`, `__resetMockSendCalls`, `__setTurnstileResult` from `@/lib/email-sender` and `@/lib/turnstile`, which are aliased in `vitest.config.ts` only — `tsc --noEmit` doesn't see the alias. Tests run green. Fix would require either adding tsconfig path mapping or splitting mocks into separately-importable modules. Pre-dates Plan 09-01; deferred.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tsc TypeError on after() audit-row callbacks (PromiseLike vs Promise)**
- **Found during:** Task 4 lint cleanup — ran `npx tsc --noEmit` to confirm clean baseline; surfaced 2 errors in `lib/bookings/cancel.ts:195` and `lib/bookings/reschedule.ts:213`.
- **Issue:** Task 3 (`3d84607`) wrapped the audit-row insert as `after(() => supabase.from(...).insert(...).then(...))`. The `.then()` chain returns `PromiseLike<void>`, but `after()` expects `AfterCallback<void>` (i.e., `void | Promise<void>` — needs a real Promise with `catch` and `finally` and `Symbol.toStringTag`). supabase-js's PostgrestBuilder is thenable but not a real Promise.
- **Fix:** Rewrote both callbacks as `after(async () => { const { error } = await supabase...insert(...); if (error) console.error(...); })`. Awaiting the builder returns the real Promise the type expects.
- **Files modified:** `lib/bookings/cancel.ts`, `lib/bookings/reschedule.ts`.
- **Verification:** `npx tsc --noEmit` now reports zero errors outside `tests/*` (pre-existing alias issues, not in scope). `npm test` still 131 passing.
- **Committed in:** `61b276f` (folded into Task 4 commit since it was discovered during Task 4 verification — keeps related fixes together; Task 3 commit `3d84607` retains the original semantic-level migration; this is the type-shape follow-up).

---

**Total deviations:** 1 auto-fixed (1 bug — tsc type mismatch surfaced during cross-check)
**Impact on plan:** Necessary correctness fix. No scope creep.

## Issues Encountered

- **`/nsi/qa-test` returns 404** during Task 6 smoke-test — expected because Andrew skipped that prereq. Substitute smoke confirmation: root (`/`), `/nsi`, and `/app/login` all return 200 after the push, confirming Vercel deployed the new commits successfully. Plan 09-02 will reuse an existing NSI event type for the booking flow; the smoke-test for that specific page will be Andrew's responsibility during the marathon (matches the prereq skip).

## Apple Mail / FUTURE_DIRECTIONS surface items collected so far

- Squarespace + Wix embed verification (deferred from Criterion #1 substitution).
- Cron-fired-in-production proof (deferred from Plan 09-01 prereq #2; Plan 09-02 mail-tester step will surface; if reminder doesn't arrive, becomes a fix-as-you-go item or a v1.1 deferral).
- `qa-test` dedicated event-type creation (deferred — could be re-introduced in v1.1 for cleaner regression-test isolation).
- `event-type-form.tsx` `react-hooks/incompatible-library` warning — RHF `watch()` not memoizable; needs `useWatch({ name })` refactor.
- Pre-existing tsc test-mock alias errors (`__mockSendCalls`, `__resetMockSendCalls`, `__setTurnstileResult` not visible to tsc) — fix needs tsconfig path mapping or mock-module split.
- Apple Mail no-device-access — Plan 09-02 will perform code-review-only verification of `lib/email/`, `lib/email/build-ics.ts`, `lib/email/branding-blocks.ts` and surface findings here for FUTURE_DIRECTIONS.md §5.

## User Setup Required

None remaining for Plan 09-01. Andrew completed prereqs (with substitutions noted above) prior to Task 2 starting.

## Next Phase Readiness

**Ready for Plan 09-02 marathon QA:**
- Spam-folder copy line is live in production confirmation + reminder emails.
- Lint baseline is clean (1 documented warning only).
- Audit-row inserts use `after()` — no orphaned writes if a serverless worker exits before the response flush.
- 09-CHECKLIST.md is in place as the session-of-record artifact.
- Vercel deployed and serving the new commits.

**Carry-forward into Plan 09-02:**
- Use existing NSI event types instead of `/nsi/qa-test` (skip the qa-test slug).
- Substitute "embed on Andrew's own Next.js site" for Criterion #1 (no Squarespace/Wix this round).
- Confirm cron actually fired during the mail-tester step.
- Code-review Apple Mail compatibility (no device available); record findings in CHECKLIST.md.

**Carry-forward into Plan 09-03 FUTURE_DIRECTIONS.md:**
- All 6 items in the Deferrals section of 09-CHECKLIST.md.

---
*Phase: 09-manual-qa-and-verification*
*Completed: 2026-04-27*
