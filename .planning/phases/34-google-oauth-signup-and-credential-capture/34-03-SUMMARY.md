---
phase: 34-google-oauth-signup-and-credential-capture
plan: 03
subsystem: auth
tags: [google-oauth, pkce, refresh-token, aes-256-gcm, supabase-oauth, server-action, next-auth]

# Dependency graph
requires:
  - phase: 34-01
    provides: account_oauth_credentials table + unique constraint user_id,provider + SELECT-only RLS (admin writes required)
  - phase: 34-02
    provides: encryptToken (AES-256-GCM), fetchGoogleGrantedScopes, hasGmailSendScope, GoogleOAuthButton
provides:
  - initiateGoogleOAuthAction (server action in both signup and login actions.ts files)
  - /auth/google-callback GET handler (PKCE exchange + token capture + routing)
  - GoogleOAuthButton rendered FIRST on /app/signup and /app/login above email/password card
  - Encrypted refresh token persisted to account_oauth_credentials via admin client
  - ?google_error=init_failed + ?google_error=access_denied alert surfaces on both forms
affects:
  - 34-04 (settings/shell — /app?google_linked=1 banner UI; gmail_skipped onboarding step)
  - 35 (Phase 35 reads refresh_token_encrypted from account_oauth_credentials via decryptToken)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server action form pattern: <form action={serverAction}><GoogleOAuthButton type='submit'> — no client JS needed for OAuth initiation"
    - "useSearchParams isolation: extracted into inner component wrapped in <Suspense fallback={null}> — required by Next.js 16 for static page prerender"
    - "Partial-grant detection via tokeninfo endpoint (authoritative) — not heuristic scope string inspection"
    - "Admin-client-only upsert for OAuth credentials — SSR client has no INSERT/UPDATE policy"

key-files:
  created:
    - app/auth/google-callback/route.ts
  modified:
    - app/(auth)/app/signup/actions.ts
    - app/(auth)/app/login/actions.ts
    - app/(auth)/app/signup/signup-form.tsx
    - app/(auth)/app/login/login-form.tsx

key-decisions:
  - "useSearchParams isolated in GoogleErrorAlerts inner component wrapped in <Suspense> — required by Next.js 16; otherwise prerender fails with CSR bailout error"
  - "Callback does NOT persist credentials when gmail.send denied — partial token would be useless and misleading; user must reconnect with full scope via Plan 04 settings flow"
  - "access_denied redirect goes to /app/signup (not /app/login) — matches the primary OAuth entry point; login page also detects ?google_error=access_denied via its own Suspense alerts"
  - "onConflict: 'user_id,provider' — exact match for the unique constraint added in Plan 01"

patterns-established:
  - "useSearchParams-in-Suspense pattern: any client component using useSearchParams must isolate that hook in a child component wrapped in <Suspense fallback={null}>"
  - "Server-action OAuth init pattern: <form action={initiateGoogleOAuthAction}><Button type='submit'> — clean progressive enhancement, no useTransition needed"

# Metrics
duration: 4min
completed: 2026-05-06
---

# Phase 34 Plan 03: OAuth Front Door Summary

**Google OAuth button wired to PKCE flow on both /app/signup and /app/login; callback handler captures one-shot provider_refresh_token, encrypts with AES-256-GCM, and upserts into account_oauth_credentials; partial gmail.send grant detection via Google tokeninfo endpoint**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-06T23:34:45Z
- **Completed:** 2026-05-06T23:38:37Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `initiateGoogleOAuthAction` appended to both `signup/actions.ts` and `login/actions.ts` — combined scope string `"email profile https://www.googleapis.com/auth/gmail.send"`, `access_type: offline`, `prompt: consent`
- Branded `GoogleOAuthButton` renders FIRST (above email/password) on both `/app/signup` and `/app/login`, with "or" divider and inline alerts for `?google_error=init_failed` / `?google_error=access_denied`
- `/auth/google-callback` GET handler: PKCE exchange, tokeninfo scope check, AES-256-GCM encryption, admin-client upsert, routing (new user → /onboarding, existing → /app?google_linked=1, denied → /app/signup?google_error=access_denied)

## Callback URL

**IMPORTANT — must be registered before production OAuth works:**

- Production: `https://{your-domain}/auth/google-callback`
- Preview branches: `https://*-{vercel-team}.vercel.app/auth/google-callback` (wildcard)

Add both to:
1. Google Cloud Console → OAuth 2.0 Client → Authorized Redirect URIs
2. Supabase Dashboard → Authentication → URL Configuration → Additional Redirect URLs

## Combined Scope String

```
"email profile https://www.googleapis.com/auth/gmail.send"
```

Single space-delimited string — NOT an array. Supabase passes verbatim to Google.

## DB Verification Query

After a successful signup with gmail.send granted:

```sql
-- Confirm row exists and blob format is iv:authTag:ciphertext (all hex)
SELECT
  user_id,
  provider,
  status,
  granted_scopes,
  length(refresh_token_encrypted) AS token_len,
  refresh_token_encrypted ~ '^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$' AS is_hex_blob_format
FROM account_oauth_credentials
WHERE provider = 'google'
LIMIT 5;
```

Expected: `is_hex_blob_format = true`, `token_len` ~200–250 chars.

## Task Commits

1. **Task 1: Add initiateGoogleOAuthAction to signup+login** — `e3a7dfb` (feat)
2. **Task 2: Add branded Google button above email/password forms** — `c816e8c` (feat)
3. **Task 3: Add /auth/google-callback handler with encrypted token capture** — `66f47f0` (feat)

## Files Created/Modified

- `app/auth/google-callback/route.ts` — GET handler: PKCE exchange, scope detection, token encrypt+upsert, routing
- `app/(auth)/app/signup/actions.ts` — `initiateGoogleOAuthAction` appended (combined scope, offline+consent params)
- `app/(auth)/app/login/actions.ts` — `initiateGoogleOAuthAction` appended (same impl, failure redirect to /app/login)
- `app/(auth)/app/signup/signup-form.tsx` — GoogleOAuthButton FIRST + divider + google error alerts
- `app/(auth)/app/login/login-form.tsx` — GoogleOAuthButton FIRST + divider + google error alerts

## Decisions Made

- **useSearchParams wrapped in Suspense:** Next.js 16 requires `useSearchParams()` calls to be inside a `<Suspense>` boundary for static-page prerender. Extracted `GoogleErrorAlerts` inner component (used in both forms) to isolate the hook. Without this, build fails with "useSearchParams() should be wrapped in a suspense boundary."

- **Do not persist credential when gmail.send denied:** If a user declines the gmail.send scope, no refresh token is stored. Storing a partial token with no Gmail capability would be misleading and cause confusing failures in Phase 35. The user is sent to `/onboarding?gmail_skipped=1` and Plan 04's settings flow handles reconnect.

- **access_denied always redirects to /app/signup:** The OAuth flow is primarily initiated from the signup page; access_denied means the user cancelled the Google consent screen. Both signup and login forms detect `?google_error=access_denied` and show a friendly alert. This is correct UX regardless of which page initiated the flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Suspense boundary for useSearchParams**

- **Found during:** Task 2 (form components) — discovered during `npm run build`
- **Issue:** Next.js 16 build fails with "useSearchParams() should be wrapped in a suspense boundary at page /app/signup" when `useSearchParams` is used directly in the form component body. This causes static prerender to bail out.
- **Fix:** Extracted `GoogleErrorAlerts` inner component in both `signup-form.tsx` and `login-form.tsx` that isolates the `useSearchParams()` call. Wrapped it in `<Suspense fallback={null}>` in the parent form component. This resolves the prerender error while keeping the alert rendering correct at runtime.
- **Files modified:** `app/(auth)/app/signup/signup-form.tsx`, `app/(auth)/app/login/login-form.tsx`
- **Verification:** `npm run build` succeeds; `/app/signup` and `/app/login` appear in build output as `○ (Static)` and `ƒ (Dynamic)` respectively.
- **Committed in:** `c816e8c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — Next.js useSearchParams Suspense requirement)
**Impact on plan:** Required for successful production build. No scope creep.

## Issues Encountered

None beyond the Suspense boundary deviation above (diagnosed and fixed inline).

## Notes for Plan 04

- `/app?google_linked=1` redirect is already wired in the callback handler. **The banner/toast UI that reads this param is NOT yet implemented** — Plan 04 owns the shell-level display of the google_linked banner.
- `?google_error=access_denied` is already handled by the signup/login form alerts wired in this plan. Plan 04 does NOT need to re-handle it.
- `/onboarding?gmail_skipped=1` param signals Plan 04's optional "Connect Gmail" step in onboarding. Plan 04 reads this param to conditionally surface the reconnect CTA.

## Next Phase Readiness

- OAuth front door complete. All three entry points wired:
  1. User clicks "Sign up with Google" → Google consent screen → `/auth/google-callback` → `/onboarding`
  2. User clicks "Sign in with Google" (existing account) → Google consent screen → `/auth/google-callback` → `/app?google_linked=1`
  3. User denies gmail.send → `/auth/google-callback` → `/onboarding?gmail_skipped=1`
- PREREQ-01 (Google Cloud Console), PREREQ-02 (Supabase provider toggle), PREREQ-04 (Vercel env vars) must be complete before live testing — these are external setup steps, not code blockers.
- `npm run build` passes. Ready to deploy and test once PREREQs are satisfied.

---
*Phase: 34-google-oauth-signup-and-credential-capture*
*Completed: 2026-05-06*
