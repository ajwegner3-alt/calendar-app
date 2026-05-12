---
phase: 45-login-ux-polish-and-gmail-quota-raise
plan: "45-03"
subsystem: auth
tags: [login, react, useActionState, radix-tabs, vitest, testing-library, AUTH-29, AUTH-33, AUTH-35, AUTH-36, AUTH-37, AUTH-38, AUTH-39]

# Dependency graph
requires:
  - phase: 18-magic-link-auth-and-enumeration-safety
    provides: AUTH-29 four-way enumeration-safety contract for requestMagicLinkAction (4xx swallowed; 5xx-only formError; success returned in all non-5xx outcomes)
  - phase: 34-google-oauth-login
    provides: GoogleOAuthButton + initiateGoogleOAuthAction; pre-existing OAuth-FIRST layout that this plan inverts to OAuth-BELOW
  - phase: 38-login-magic-link-tab
    provides: Tabs(Password|Magic-link) layout inside CardContent; MagicLinkTabContent owning useActionState(requestMagicLinkAction); MagicLinkSuccess takeover view
provides:
  - Controlled Tabs with Password as the v1.8 default-tab invariant lock
  - LoginState.errorKind discriminant ('credentials' | 'rateLimit' | 'server') for client-side gating
  - Session-scoped 3-fail counter (zero browser-storage persistence)
  - Inline magic-link nudge under password field after 3 consecutive credentials rejections — one-click tab switch + email pre-fill
  - AUTH-29 byte-identical helper line under magic-link email field
  - 11 new Vitest cases (4 AUTH-29 + 7 counter) locking the contracts above
affects:
  - phase: 46-andrew-ship-sign-off
    needs: live UAT of OAuth-below-Card layout, default-tab lock, 3-fail nudge UX, helper line copy
  - any-future-phase-touching: app/(auth)/app/login/* must respect the 5 locked invariants enumerated below

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled Radix Tabs with state at parent component scope so cross-tab values (failCount, prefillEmail) survive Tabs default-unmount of inactive content"
    - "errorKind discriminant on useActionState return values, with useEffect([state]) gating client side-effects on specific error classes"
    - "Test mocks of useActionState actions MUST use mockImplementation (not mockResolvedValue) so each call returns a fresh object — React's setState bails on Object.is and the state update would be suppressed"
    - "Radix-in-jsdom polyfills (hasPointerCapture / releasePointerCapture / setPointerCapture / scrollIntoView / matchMedia) for Tabs activation in tests"

key-files:
  created:
    - tests/login-form-auth-29.test.tsx
    - tests/login-form-counter.test.tsx
  modified:
    - app/(auth)/app/login/login-form.tsx
    - app/(auth)/app/login/actions.ts

key-decisions:
  - "Helper-line copy: 'We'll email you a one-time sign-in link. Open it on this device to log in.' — Claude's discretion within the CONTEXT.md 'generic, expectation-setting instruction' guidance; tone matches Phase 38 helper convention; zero state hint preserves AUTH-29."
  - "Nudge copy: 'Trouble signing in? Email me a sign-in link instead.' — recovery-framed per CONTEXT.md lock with Claude-discretion final-copy authority."
  - "Counter is plain useState at LoginForm top level (not useRef) so the nudge re-renders when failCount crosses 3. Reset is automatic on unmount via the success-path redirect."
  - "errorKind union is closed ('credentials' | 'rateLimit' | 'server') with NO 'validation' branch — Zod-failure return path intentionally omits errorKind because validation errors should never advance the counter (RESEARCH P3)."
  - "MagicLinkTabContent is remounted on tab switch (Radix default unmount of inactive TabsContent), so prefillEmail must live in LoginForm and is consumed via Input defaultValue on each mount of MagicLinkTabContent."

patterns-established:
  - "Lockfile-grade invariant comments: each AUTH-XX gate gets a JSDoc / inline comment naming the invariant and the test file that locks it, so future edits can find the regression-detector quickly."
  - "Test-side mockImplementation pattern for useActionState mocks (recorded in counter test for future tests of action-driven state)."

# Metrics
duration: 22min
completed: 2026-05-12
---

# Phase 45 Plan 45-03: Login UX Polish Summary

**Login UX polish: OAuth below Card, controlled Tabs default to password, 3-fail magic-link nudge with email pre-fill, AUTH-29 byte-identical helper line.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-05-12T00:47:31Z
- **Completed:** 2026-05-12T01:09:59Z
- **Tasks:** 2 (executed in plan order; Task 1 carried the highest-risk AUTH-29 sub-step first per the plan's risk ordering)
- **Files modified:** 4 (2 source + 2 new tests)

## Accomplishments

- AUTH-33 Google OAuth + 'or' divider repositioned BELOW the email/password Card (Card is now the primary CTA).
- AUTH-35 v1.8 invariant lock: Tabs converted from `defaultValue="password"` to controlled `value={activeTab} / onValueChange` initialized to `"password"`. Default-tab choice is now an explicit code-level lock.
- AUTH-36 inline magic-link nudge surfaces after 3 consecutive HTTP-400 credentials rejections, with one-click tab switch and email pre-fill from the password tab.
- AUTH-37 zero-storage guarantee: counter is in-memory `useState` only — no `localStorage`, no `sessionStorage`. Locked at runtime by a `Storage.prototype.setItem` spy in counter test #7.
- AUTH-38 errorKind discriminant: `LoginState.errorKind: 'credentials' | 'rateLimit' | 'server'` lets the client gate the counter on credentials-only. Counter does NOT advance on 429 (rateLimit), 5xx (server), or network errors.
- AUTH-39 / AUTH-29 helper line: static `<p data-testid="magic-link-helper">` under the magic-link email field with byte-identical literal copy and zero state-dependent attributes — preserves the v1.7 four-way enumeration-safety invariant.

## Task Commits

Each task was committed atomically (per `task_commit_protocol`):

1. **Task 1: errorKind discriminant + AUTH-29 byte-identical helper line** — `78d60f6` (feat)
2. **Task 2: OAuth-below-Card, controlled Tabs, 3-fail nudge, email pre-fill** — `054866b` (feat)

**Plan metadata:** to be added by post-execution commit.

## Files Created/Modified

- `app/(auth)/app/login/actions.ts` — Added `errorKind` to `LoginState`; emit it in the rate-limit branch and the Supabase-error branch (with status-based gating). Zod-failure branch intentionally omits it.
- `app/(auth)/app/login/login-form.tsx` — Controlled Tabs (default `"password"`); `failCount` + `prefillEmail` useState at LoginForm top level; useEffect that increments counter on `state.errorKind === "credentials"` with `Math.min(n + 1, 3)` cap; inline nudge JSX with `type="button"` action; `MagicLinkTabContent` accepts `prefillEmail` prop and wires it to the email Input as `defaultValue`; OAuth + divider moved below `</Card>`.
- `tests/login-form-auth-29.test.tsx` — 4 cases lock the AUTH-29 byte-identical helper invariant (initial render copy, copy stability after typing, helper absence in MagicLinkSuccess view, no state-dependent attributes).
- `tests/login-form-counter.test.tsx` — 7 cases lock the counter contract (no-show before submission, no-advance on rateLimit, no-advance on server, advance + show on credentials at 3, click switches tab + pre-fills email, counter survives tab switching, zero storage writes).

## Out of Scope (Confirmed NOT Touched)

- `lib/email-sender/quota-guard.ts` — owned by sibling plan 45-01.
- `app/(auth)/app/signup/signup-form.tsx` — owned by sibling plan 45-02.
- `app/(auth)/app/login/actions.ts::requestMagicLinkAction` — pre-existing AUTH-29 implementation, NOT modified (the byte-identical guarantee at the action layer is a v1.7 lock).
- Any Supabase backend code path (signInWithPassword, signInWithOtp, signInWithOAuth all unchanged — only the LoginState type added the discriminant).

## Five Locked Invariants — Re-verified

1. **AUTH-29 four-way enumeration safety** — helper `<p>` is a literal string with zero state references; no aria-live; className is a literal constant; element is absent in MagicLinkSuccess. Locked by `tests/login-form-auth-29.test.tsx` (4/4 green).
2. **AUTH-35 default-tab lock** — `useState<"password" | "magic-link">("password")` is the only controlled-Tabs initialization in the file (verified by grep — exactly one match).
3. **AUTH-37 zero-storage** — zero `localStorage`/`sessionStorage` references in `login-form.tsx` and `actions.ts` (verified by grep). Locked at runtime by a `Storage.prototype.setItem` spy in counter test #7.
4. **errorKind gating** — counter advances ONLY on `state.errorKind === "credentials"`. Locked by counter tests #2 (rateLimit) and #3 (server) which both submit 5 times and assert nudge never appears.
5. **Counter cap at 3** — `setFailCount((n) => Math.min(n + 1, 3))` (verified by grep — exactly one match) prevents unbounded increment.

## Verification Results

- **Build:** `npm run build` — Compiled successfully in 6.4s.
- **Lint:** `npm run lint` — 31 problems / 21 errors / 10 warnings (1 fewer than pre-execution baseline of 32 / 21 / 11; no new errors introduced; the unavoidable `react-hooks/set-state-in-effect` lint at the counter useEffect is suppressed inline with a justification comment, matching the same pre-existing pattern in `magic-link-success.tsx` line 42).
- **Typecheck:** `npx tsc --noEmit` — zero errors in the four files touched by this plan (pre-existing TS errors in unrelated test files are not regressions).
- **Plan-specific tests:** `npm test -- login-form` — 11/11 green (4 AUTH-29 + 7 counter).
- **Full suite:** `npm test` — 374 passed / 9 skipped / 4 pre-existing failures (NOT caused by this plan):
  - `tests/bookings-api.test.ts` — date-sensitive fixture failures (documented pre-existing tech debt; called out in execution prompt).
  - `tests/cancel-reschedule-api.test.ts` — token/race tests dependent on remote DB state (pre-existing tech debt; same character as bookings-api).
  - `tests/email-quota-refuse.test.ts` — caused by sibling plan 45-01 raising `SIGNUP_DAILY_EMAIL_CAP` from 200 to 400 (commit `048255f`); these test fixtures encode the old 200 cap and need to be updated by 45-01's owner. NOT a regression from 45-03.
- **All 10 hard regex checks from the plan's `<verification>` block:** PASS.

## Decisions Made

- **Test mock pattern (`mockImplementation` vs `mockResolvedValue`):** Discovered during test development that `mockResolvedValue({...})` returns the SAME object reference each call, and React's `setState` short-circuits via `Object.is` — so the counter useEffect would only fire ONCE despite three submits. Switched to `mockImplementation(async () => ({...}))` which constructs a fresh object per call, matching the production server-action behavior. Documented in test file as a forward-looking convention.
- **`react-hooks/set-state-in-effect` lint exception:** The counter's `useEffect → setFailCount(prev => Math.min(prev + 1, 3))` is the canonical pattern for "react to a fresh useActionState result with a derived cumulative value" — the failCount cannot be derived from `state` alone (we need to increment, not replace). Added an inline `eslint-disable-next-line` with a justification comment. The codebase already establishes this exception in `magic-link-success.tsx` line 42, so this is a precedent-preserving choice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Radix-in-jsdom event polyfills to test files**
- **Found during:** Task 1 sub-step C (writing AUTH-29 test) — the initial test failed because `fireEvent.click` on a Radix `TabsTrigger` did not switch tabs in jsdom.
- **Issue:** Radix UI calls `Element.prototype.hasPointerCapture` (and `releasePointerCapture` / `setPointerCapture` / `scrollIntoView`) inside its tab activation code path. jsdom does not implement any of these methods — the call throws and tab activation never completes.
- **Fix:** Added `beforeAll` polyfills (no-op functions) to BOTH new test files for these methods plus `window.matchMedia` (used by `useIsMobile` deeper in the providers tree). Mirrors the polyfill approach already used in `tests/shell-render.test.tsx` for the same family of jsdom gaps.
- **Files modified:** `tests/login-form-auth-29.test.tsx`, `tests/login-form-counter.test.tsx`.
- **Verification:** All 11 cases pass after polyfills added; without polyfills, all tab-switch-dependent cases fail.
- **Committed in:** `78d60f6` (auth-29 polyfills) + `054866b` (counter polyfills).

**2. [Rule 1 - Bug] Test mock pattern bug found and fixed during counter test development**
- **Found during:** Task 2 sub-step F (writing counter test).
- **Issue:** `mockLoginAction.mockResolvedValue({ formError: ..., errorKind: "credentials" })` returns the SAME object reference on every call. React's setState bails out via `Object.is(prev, next)` when the reference is identical, so the counter useEffect — which depends on `[state]` — only fires ONCE despite three submits, and the nudge never appears. The 3 negative-path tests passed by coincidence (they assert the nudge does NOT appear, which is also true under the buggy mock pattern).
- **Fix:** Replaced `mockResolvedValue({...})` with `mockImplementation(async () => ({...}))` in all four credentials-using tests. This forces a fresh object per call, matching the production server-action's `return { formError, errorKind }` constructor pattern.
- **Files modified:** `tests/login-form-counter.test.tsx`.
- **Verification:** All 7 counter tests pass; documented inline as a forward-looking convention.
- **Committed in:** `054866b`.

**3. [Rule 3 - Blocking] `submitPasswordForm` test helper rewritten to bypass transient submit-button label**
- **Found during:** Task 2 sub-step F.
- **Issue:** The plan's suggested approach of `screen.getByRole("button", { name: /sign in/i })` collided with `useActionState`'s pending state — when the submit button is in `Signing in…` state, the regex `/sign in/i` doesn't match, and the test failed to find the button on the second iteration.
- **Fix:** Rewrote helper to query inputs by ID, find the closest `<form>`, and call `fireEvent.submit(form)` directly. This bypasses the button label entirely and is robust to the pending state.
- **Files modified:** `tests/login-form-counter.test.tsx`.
- **Verification:** All 7 counter tests pass.
- **Committed in:** `054866b`.

---

**Total deviations:** 3 auto-fixed (1 blocking-jsdom-polyfill, 1 test-mock bug, 1 blocking-button-label). All occurred in the new test files; none altered the source-code contracts defined by the plan.
**Impact on plan:** All deviations were necessary to make the test contracts executable in jsdom + Vitest. Zero scope creep into source code. The five locked invariants are preserved exactly as specified.

## Issues Encountered

- **`npm run typecheck` script does not exist.** Used `npx tsc --noEmit` instead (project script list shows only `lint`, `test`, `build`, `dev`, `start`, `knip:*`). Reported zero errors in the 4 files touched by this plan.
- **Pre-existing test failures in unrelated suites** were observed during the full-suite run; explicitly enumerated above and confirmed not caused by this plan.

## User Setup Required

None. This plan is purely client-side UX polish + a discriminant on a server-action return type. No environment variables, no dashboard config, no database changes.

## Next Phase Readiness

- All Phase 45 sibling plans now code-complete (45-01 + 45-02 + 45-03).
- Ready for Phase 45 verifier pass and rollover to Phase 46 (Andrew's ship sign-off — live UAT of v1.8 milestone).
- Phase 46 will need to live-UAT the OAuth-below-Card layout, the default-tab lock, the 3-fail nudge UX, and the helper-line copy on `/app/login`.

---
*Phase: 45-login-ux-polish-and-gmail-quota-raise*
*Completed: 2026-05-12*
