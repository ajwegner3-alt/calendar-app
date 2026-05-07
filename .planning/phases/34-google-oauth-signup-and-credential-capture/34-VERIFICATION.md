---
phase: 34-google-oauth-signup-and-credential-capture
verified: 2026-05-06T23:50:23Z
status: human_needed
score: 5/5 must-haves verified (all static checks pass; runtime items flagged for human verification)
re_verification: false
human_verification:
  - test: Sign up with Google combined consent screen and onboarding landing
    expected: Single Google consent screen includes gmail.send; after approval user lands at /onboarding
    why_human: OAuth consent screen can only be confirmed by live browser flow
  - test: Gmail.send denied does not block account creation
    expected: Account still created; user lands at /onboarding/connect-gmail with skip link; no error state
    why_human: Requires live Google consent interaction to deny a specific scope
  - test: Existing email/password user connects Gmail from settings
    expected: OAuth flow runs; settings shows Connected status; no duplicate user
    why_human: linkIdentity requires a live authenticated session and Google redirect round-trip
  - test: Owner disconnects Gmail from settings
    expected: Page shows Not connected; Google token revoked; credential row deleted
    why_human: Revocation is a real HTTP call requiring a live credential row
---

# Phase 34: Google OAuth Signup and Credential Capture Verification Report

**Phase Goal:** Users can sign up with Google (combined gmail.send consent), existing accounts can connect or disconnect Gmail, and all OAuth tokens are stored encrypted.
**Verified:** 2026-05-06T23:50:23Z
**Status:** human_needed (all static checks pass; OAuth flows require live browser verification)
**Re-verification:** No

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can sign up with Google with combined gmail.send scope on a single consent screen | PASS (static) + HUMAN (runtime) | signup/actions.ts:139 scopes include gmail.send; access_type=offline, prompt=consent set; GoogleOAuthButton present above Card in signup-form.tsx |
| 2 | Denying gmail.send creates the account and shows a skippable Connect Gmail step | PASS (static) + HUMAN (runtime) | google-callback/route.ts:35-39 handles ?error=access_denied without block; route.ts:129 routes ?gmail_skipped=1; onboarding/page.tsx:10-14 redirects to /onboarding/connect-gmail; skip link in connect-gmail-card.tsx |
| 3 | Existing email/password user can connect Gmail from settings, shown as Connected | PASS (static) + HUMAN (runtime) | settings/gmail/_lib/actions.ts:19 uses linkIdentity (not signInWithOAuth); settings page reads credential row; supabase/config.toml:174 has enable_manual_linking = true |
| 4 | Owner can disconnect Gmail; page shows not-connected status; credential revoked | PASS (static) + HUMAN (runtime) | disconnectGmailAction calls revokeGoogleRefreshToken (line 54) then admin.from(...).delete() (lines 60-64); gmail-status-panel.tsx renders never_connected and needs_reconnect states |
| 5 | Refresh tokens never appear in plaintext; table stores only refresh_token_encrypted | PASS | Migration line 22: refresh_token_encrypted text not null; no plaintext column; grep for console.*refresh_token returns 0 lines; encryptToken called before upsert at route.ts:79 |

**Score: 5/5 must-haves verified**

---
## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql | VERIFIED | Table, index, RLS enabled, credentials_select_own SELECT-only policy; no INSERT/UPDATE/DELETE RLS policies by design |
| lib/oauth/encrypt.ts | VERIFIED | AES-256-GCM, encryptToken/decryptToken with 12-byte random IV; server-only guard; key validation throws on missing or wrong-length key |
| lib/oauth/google.ts | VERIFIED | fetchGoogleGrantedScopes, revokeGoogleRefreshToken, hasGmailSendScope all implemented; server-only guard |
| components/google-oauth-button.tsx | VERIFIED | White bg (#FFFFFF), border #747775, official 4-color G SVG with fillRule evenodd, Roboto font, isPending swaps label to Redirecting |
| tests/oauth-encrypt.test.ts | VERIFIED + TESTS PASS | 5/5 tests pass: roundtrip, unique IV, tamper detection, missing key, wrong key length |
| app/auth/google-callback/route.ts | VERIFIED | PKCE via exchangeCodeForSession; fetchGoogleGrantedScopes called; encryptToken before upsert; admin upsert with onConflict; routes to /onboarding?gmail_skipped=1 on denied scope; routes to /app?google_linked=1 for existing users |
| app/(auth)/app/signup/actions.ts | VERIFIED | initiateGoogleOAuthAction uses signInWithOAuth with combined scopes, access_type=offline, prompt=consent |
| app/(auth)/app/login/actions.ts | VERIFIED | Same initiateGoogleOAuthAction pattern mirrored for login page |
| app/(auth)/app/signup/signup-form.tsx | VERIFIED | GoogleOAuthButton above Card, or divider, Google errors via Suspense-wrapped GoogleErrorAlerts |
| app/(auth)/app/login/login-form.tsx | VERIFIED | Same pattern as signup-form; GoogleButton first, divider, Card below |
| app/(shell)/app/settings/gmail/page.tsx | VERIFIED | Reads credential status via RLS SELECT; reads Google identity email; passes 3-state status to GmailStatusPanel |
| app/(shell)/app/settings/gmail/_lib/actions.ts | VERIFIED | connectGmailAction uses linkIdentity; disconnectGmailAction calls revokeGoogleRefreshToken + admin .delete(); admin client for all credential writes |
| app/(shell)/app/settings/gmail/_components/gmail-status-panel.tsx | VERIFIED | Renders connected, never_connected, needs_reconnect states; Connect button uses connectGmailAction |
| app/(shell)/app/settings/gmail/_components/disconnect-gmail-dialog.tsx | VERIFIED | Locked title Disconnect Gmail?; locked body You won't be able to send emails until you reconnect. via &apos; |
| app/(shell)/app/_components/google-link-toast.tsx | VERIFIED | Fires on ?google_linked=1; exact copy with U+2014 em-dash confirmed (Python ord 0x2014); strips param via router.replace |
| app/(shell)/app/page.tsx | VERIFIED | Renders GoogleLinkToast inside Suspense at lines 7 and 92-94 |
| components/app-sidebar.tsx | VERIFIED | Gmail link at href=/app/settings/gmail in sidebar at line 121 |
| app/onboarding/page.tsx | VERIFIED | ?gmail_skipped=1 branch redirects to /onboarding/connect-gmail at line 13 |
| app/onboarding/connect-gmail/page.tsx | VERIFIED | Auth-guarded; renders ConnectGmailCard |
| app/onboarding/connect-gmail/_components/connect-gmail-card.tsx | VERIFIED | Reuses connectGmailAction from settings lib (import at line 4); skip link to /onboarding; optional framing |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| signup-form.tsx | initiateGoogleOAuthAction | form action | WIRED | actions.ts:135 using signInWithOAuth with combined scopes |
| google-callback/route.ts | encryptToken | import + call | WIRED | route.ts:4,79 token encrypted before any DB write |
| google-callback/route.ts | account_oauth_credentials | admin upsert | WIRED | route.ts:82-94 upsert with conflict resolution on user_id,provider |
| settings/gmail/_lib/actions.ts | linkIdentity | Supabase client | WIRED | actions.ts:19 not signInWithOAuth |
| disconnectGmailAction | revokeGoogleRefreshToken | import + await | WIRED | actions.ts:8,54 |
| disconnectGmailAction | admin.delete() | admin client | WIRED | actions.ts:60-64 |
| onboarding/connect-gmail | connectGmailAction | import from settings lib | WIRED | connect-gmail-card.tsx:4,17 |
| app/page.tsx | GoogleLinkToast | import + render in Suspense | WIRED | app/page.tsx:7,92-94 |

---

## Critical Security Checks

| Check | Result | Evidence |
|-------|--------|----------|
| Refresh token never logged in callback route | PASS | grep returns 0 lines; catch block at route.ts:102 logs only err object not the token variable |
| Refresh token never logged in disconnect action | PASS | grep returns 0 lines; actions.ts:55 logs only err |
| refresh_token_encrypted column (not plaintext) | PASS | Migration line 22: refresh_token_encrypted text not null; no refresh_token plaintext column exists |
| RLS: SELECT-only, no INSERT/UPDATE/DELETE policies | PASS | Migration lines 42-46: only credentials_select_own for SELECT; write policies intentionally absent |
| enable_manual_linking = true in supabase config | PASS | supabase/config.toml:174 |

---

## Locked Copy Verification

| Copy Item | Status | Evidence |
|-----------|--------|----------|
| Dialog title: Disconnect Gmail? | PASS | disconnect-gmail-dialog.tsx:35 exact match |
| Dialog body: You won't be able to send emails until you reconnect. | PASS | disconnect-gmail-dialog.tsx:37 via &apos;; full sentence matches |
| Toast copy: Your account is now connected to Google — you can sign in either way. | PASS | google-link-toast.tsx:21; U+2014 em-dash confirmed (Python ord 0x2014) |

---
## Build and Test Results

| Check | Result |
|-------|--------|
| npx vitest run tests/oauth-encrypt.test.ts | PASS: 5/5 tests in 370ms |
| npm run build | PASS: TypeScript clean, 42 routes compiled including /app/settings/gmail and /onboarding/connect-gmail, no errors |
| Pre-existing failing test (tests/bookings-api.test.ts) | Excluded per instructions: fixture-mismatch unrelated to Phase 34 |

---

## Anti-Patterns

No blocker anti-patterns found. All Phase 34 files are substantive implementations with no TODOs, no placeholder returns, and no empty handlers.

---

## Human Verification Required

All four items below require a live browser session and cannot be verified statically. These are EXPECTED for OAuth work, not gaps. Deploy to Vercel and run through these scenarios before closing Phase 34.

### 1. Combined scope consent screen (Must-have 1)

**Test:** Open /app/signup in a fresh incognito window. Click Sign up with Google.
**Expected:** Google consent screen appears requesting openid, email, profile AND gmail.send in a single screen. After approving, land at /onboarding (step 1).
**Why human:** Google OAuth consent UI and scope aggregation are controlled server-side by Google.

### 2. Gmail.send denied graceful fallback (Must-have 2)

**Test:** Click Sign up with Google and when the consent screen appears, click Deny or decline the Gmail scope.
**Expected:** Account is still created (not an error page). User lands at /onboarding/connect-gmail with the Connect Gmail (optional) card and a Skip for now link. No blocked or error state. Clicking skip proceeds to step-1-account.
**Why human:** Scope denial requires live interaction with Google consent UI.

### 3. Existing user connects Gmail from settings (Must-have 3)

**Test:** Log in with an email/password account at /app/login. Navigate to Settings > Gmail. Click Connect Gmail.
**Expected:** OAuth flow runs, returns to /app/settings/gmail showing Connected (green dot) with Gmail address. No second user account created. Supabase auth.identities has both email and google entries for the same user.
**Why human:** Identity linking requires a live Supabase session and Google redirect.

### 4. Disconnect Gmail (Must-have 4)

**Test:** From Settings > Gmail (while connected), click Disconnect. Confirm in the dialog.
**Expected:** Page refreshes showing Not connected (gray dot). Token revocation POST sent to Google revoke endpoint. The account_oauth_credentials row is gone (verify in Supabase Studio).
**Why human:** Requires a live connected credential row; revocation is a real HTTP call to Google.

---

## Gaps Summary

No gaps. All must-haves are structurally complete from static inspection. The human_needed status reflects the inherent requirement to run live OAuth browser tests before declaring Phase 34 production-ready. This is expected for OAuth phases and is not a code deficiency.

---

_Verified: 2026-05-06T23:50:23Z_
_Verifier: Claude (gsd-verifier)_
