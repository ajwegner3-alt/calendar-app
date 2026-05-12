---
phase: 45-login-ux-polish-and-gmail-quota-raise
verified: 2026-05-12T01:19:21Z
status: passed
score: 6/6 must-haves verified
---

# Phase 45: Login UX Polish & Gmail Quota Raise — Verification Report

**Phase Goal:** Login and signup forms have Google OAuth below the primary form (not above); the password tab is the default; three consecutive failed password attempts surface an inline magic-link nudge; the magic-link tab shows a uniform helper line for all users; Gmail send quota raises to 400/day.

**Verified:** 2026-05-12T01:19:21Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Google OAuth button renders below the email/password Card on `/app/login` | VERIFIED | `</Card>` at line 245, `Sign in with Google` at line 259 of `login-form.tsx` |
| 2 | Google OAuth button renders below the email/password Card on `/app/signup` | VERIFIED | `</Card>` at line 163, `Sign up with Google` at line 177 of `signup-form.tsx` |
| 3 | `/app/login` opens with Password tab as default | VERIFIED | `useState<"password" \| "magic-link">("password")` literal at line 89 of `login-form.tsx` |
| 4 | After 3 consecutive credential rejections, an inline magic-link nudge appears and clicking it switches tabs + pre-fills email | VERIFIED | `failCount >= 3` gate (L204), `data-testid="magic-link-nudge"` (L207), `setActiveTab("magic-link")` + `setPrefillEmail(getValues("email") ?? "")` in onClick (L213-214) |
| 5 | Counter resets on success/tab close, doesn't advance on rate-limit/server errors, doesn't persist in storage | VERIFIED | useEffect gates on `state.errorKind === "credentials"` (L131); zero `localStorage`/`sessionStorage` references in `login-form.tsx` or `actions.ts`; tests/login-form-counter.test.tsx case #7 spies on `Storage.prototype.setItem` |
| 6 | Magic-link helper line is byte-identical regardless of email status (AUTH-29 enumeration safety) | VERIFIED | `data-testid="magic-link-helper"` static `<p>` (L320-322) with literal text only, no state-dependent attributes; tests/login-form-auth-29.test.tsx (4/4) locks invariant |
| 7 | Gmail daily quota = 400 (raised from 200), 80% warn threshold derives 320, single-constant change | VERIFIED | `SIGNUP_DAILY_EMAIL_CAP = 400` (L20), `WARN_THRESHOLD_PCT = 0.8` (L21), zero hardcoded `200` references in quota-guard.ts |

**Score:** 7/7 truths verified (mapped to the 6 success criteria; SC-1 split for the two routes)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `app/(auth)/app/login/login-form.tsx` | Controlled Tabs + counter + nudge + helper | VERIFIED | 329 lines, all required elements present |
| `app/(auth)/app/signup/signup-form.tsx` | Card-first DOM order, OAuth below | VERIFIED | 181 lines, OAuth form rendered after Card + divider |
| `app/(auth)/app/login/actions.ts` | `errorKind` discriminant in LoginState | VERIFIED | `errorKind?: "credentials" \| "rateLimit" \| "server"` (L18); branching on `error.status` (L63-66) |
| `lib/email-sender/quota-guard.ts` | 400 cap, 0.8 warn threshold | VERIFIED | Constants present and consumed; 80% threshold computed via multiplication |
| `tests/login-form-auth-29.test.tsx` | AUTH-29 invariant lock | VERIFIED | Exists; 4/4 tests passing |
| `tests/login-form-counter.test.tsx` | 3-fail counter behavior including no-storage spy | VERIFIED | Exists; 7/7 tests passing |
| `tests/quota-guard.test.ts` | Quota constants | VERIFIED | Exists; 7/7 tests passing |
| `tests/email-quota-refuse.test.ts` | Refuse path coverage | VERIFIED | Exists; 21/21 tests passing |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `loginAction` (server) | `LoginForm` (client) | `errorKind` discriminant on `LoginState` | WIRED | Server emits `errorKind`; client useEffect (L130-135) gates on `state.errorKind === "credentials"` |
| Counter useState | Nudge render | `failCount >= 3` conditional | WIRED | L204 conditional renders nudge with onClick wired to `setActiveTab` + `setPrefillEmail` |
| Nudge onClick | `MagicLinkTabContent` | Controlled Tabs + `prefillEmail` prop | WIRED | `setActiveTab("magic-link")` flips Radix Tabs; `prefillEmail` flows through to `defaultValue={prefillEmail}` (L313) |
| `LoginForm` top-level state | Counter survival across tab switches | State lives ABOVE Tabs (not inside TabsContent) | WIRED | `failCount` is in LoginForm scope (L97), survives Radix unmount of inactive TabsContent (V15-MP-05 reframed) |
| Nudge button | Form submit | `type="button"` (NOT default `type="submit"`) | WIRED | L211 `type="button"` prevents accidental password form submission (RESEARCH critical lock) |
| `quota-guard.ts` constants | All 7 leaf callers | `SIGNUP_DAILY_EMAIL_CAP` import | WIRED | Single source of truth; no per-caller branching |

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| AUTH-33 (Login OAuth below Card) | SATISFIED | login-form.tsx line order verified |
| AUTH-34 (Signup OAuth below Card) | SATISFIED | signup-form.tsx line order verified |
| AUTH-35 (Password tab default) | SATISFIED | useState initialized to `"password"` |
| AUTH-36 (Magic-link nudge UX) | SATISFIED | Nudge element + clickable button + email pre-fill bridge |
| AUTH-37 (Counter no-persistence) | SATISFIED | Zero storage references; counter test #7 spy lock |
| AUTH-38 (Counter advances on credentials only) | SATISFIED | useEffect gated on `errorKind === "credentials"`; counter test #2 (rateLimit) + #3 (server) prove non-advancement |
| AUTH-39 (Magic-link helper uniform) | SATISFIED | Static helper text; AUTH-29 test 4/4 |
| EMAIL-35 (Gmail cap → 400) | SATISFIED | Constant raised; quota-guard test 7/7; email-quota-refuse 21/21 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | — | — | — | No blocker, warning, or info anti-patterns introduced. The eslint-disable on L132 of login-form.tsx is documented and endorsed by RESEARCH P4. |

### Gates Status

- AUTH-29 four-way invariant: tests/login-form-auth-29.test.tsx exists, 4/4 pass; helper element verified static
- V15-MP-05 reframed (Tabs no-remount): counter state hoisted above Tabs; counter test case #6 locks survival across tab switches
- 3-fail counter rejection-only: counter test cases #2 (rateLimit) + #3 (server) confirm counter does not advance

### Test Results

| Suite | Expected | Actual | Status |
| --- | --- | --- | --- |
| `tests/quota-guard.test.ts` | 7/7 | 7/7 | PASS |
| `tests/email-quota-refuse.test.ts` | 21/21 | 21/21 | PASS |
| `tests/login-form-auth-29.test.tsx` | 4/4 | 4/4 | PASS |
| `tests/login-form-counter.test.tsx` | 7/7 | 7/7 | PASS |
| **Combined** | **39/39** | **39/39** | **PASS** |

### Build & Type Check

- `npx tsc --noEmit`: All errors limited to `tests/__mocks__/*.ts` and `tests/*.ts` fixture noise (pre-existing tech debt per STATE.md). Zero new errors in source files (`app/`, `lib/`, `components/`).
- `npm run build`: Compiled successfully in 6.4s. Both `/app/login` (ƒ) and `/app/signup` (○) routes present in route manifest. 35/35 static pages generated.

### Human Verification Required

None for this verification step. Live visual UAT is owned by Phase 46 (Andrew ship sign-off) per the phase boundary.

### Gaps Summary

No gaps. All 6 success criteria, all 8 requirements, both verification gates, and all 4 test suites pass. The phase goal is fully achieved at the static-evidence level. Andrew's Phase 46 sign-off remains the final shipping gate for live visual confirmation.

---

_Verified: 2026-05-12T01:19:21Z_
_Verifier: Claude (gsd-verifier)_
