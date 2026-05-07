---
phase: 35-per-account-gmail-oauth-send
plan: "02"
subsystem: email
tags: [nodemailer, oauth2, gmail, google-token-exchange, vitest, email-sender]

# Dependency graph
requires:
  - phase: 34-google-oauth-signup-and-credential-capture
    provides: lib/oauth/google.ts with fetchGoogleGrantedScopes/revokeGoogleRefreshToken, lazy env-var read pattern
provides:
  - fetchGoogleAccessToken(refreshToken) in lib/oauth/google.ts — exchanges refresh token for 1h access token via Google token endpoint
  - TokenResult interface in lib/oauth/google.ts
  - createGmailOAuthClient(config) in lib/email-sender/providers/gmail-oauth.ts — nodemailer OAuth2 SMTP factory
  - GmailOAuthConfig interface in lib/email-sender/providers/gmail-oauth.ts
affects:
  - 35-03 (account-sender factory — Plan 03 composes fetchGoogleAccessToken + createGmailOAuthClient into getSenderForAccount)
  - 35-04 (cutover — all 7 send paths will call getSenderForAccount which depends on these utilities)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fetchGoogleAccessToken lazy env-var read (GOOGLE_CLIENT_ID/SECRET inside function body, not module top level)"
    - "Gmail OAuth2 SMTP via explicit host smtp.gmail.com:465/secure (not service:'gmail') per nodemailer Pitfall 5"
    - "Enforced From header in createGmailOAuthClient — callers cannot spoof (options.from ignored, always uses config.user)"

key-files:
  created:
    - lib/email-sender/providers/gmail-oauth.ts
    - tests/oauth-google-access-token.test.ts
    - tests/email-sender-gmail-oauth.test.ts
  modified:
    - lib/oauth/google.ts

key-decisions:
  - "Explicit host/port/secure form for nodemailer (smtp.gmail.com:465) instead of service:'gmail' — follows Research Pitfall 5"
  - "From header always enforced from config.user; callers cannot pass options.from to override — follows Research Pitfall 6"
  - "No vitest alias change needed — existing /^@\/lib\/email-sender$/ regex is exact-match only; sub-paths including providers/gmail-oauth pass through naturally"

patterns-established:
  - "fetchGoogleAccessToken: never throws; returns { error } on all failure paths including missing env vars and network errors"
  - "createGmailOAuthClient: From header is owned by the factory, not the caller — spoofing blocked at construction"

# Metrics
duration: 2min
completed: 2026-05-07
---

# Phase 35 Plan 02: Google Token Exchange and OAuth Provider Summary

**fetchGoogleAccessToken (POST /token exchange) added to lib/oauth/google.ts; createGmailOAuthClient (nodemailer OAuth2 SMTP, enforced From) created in lib/email-sender/providers/gmail-oauth.ts — 10 new tests, 0 regressions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-07T01:40:42Z
- **Completed:** 2026-05-07T01:43:08Z
- **Tasks:** 2
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments

- Extended `lib/oauth/google.ts` with `fetchGoogleAccessToken` and `TokenResult` — lazy env-var reads, never-throws contract, returns `{ error: "invalid_grant" }` for revoked tokens
- Created `lib/email-sender/providers/gmail-oauth.ts` with `createGmailOAuthClient` — uses explicit `smtp.gmail.com:465/secure` form (Research Pitfall 5), always enforces `From = config.user` (Research Pitfall 6)
- 4 unit tests for `fetchGoogleAccessToken` (missing env, success, invalid_grant, network error) — all green
- 6 unit tests for `createGmailOAuthClient` (provider identity, from enforcement, fromName, spoof block, error handling, array recipients) — all green
- Confirmed no vitest alias change needed for `providers/gmail-oauth` sub-path (existing exact-match regex doesn't intercept it)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fetchGoogleAccessToken to lib/oauth/google.ts** - `e2360cf` (feat)
2. **Task 2: Create gmail-oauth nodemailer provider + tests** - `828039d` (feat)

**Plan metadata:** (pending this docs commit)

## Files Created/Modified

- `lib/oauth/google.ts` — appended `TokenResult` interface and `fetchGoogleAccessToken` function; existing `fetchGoogleGrantedScopes`, `revokeGoogleRefreshToken`, `hasGmailSendScope` unchanged
- `lib/email-sender/providers/gmail-oauth.ts` — new file; exports `GmailOAuthConfig` and `createGmailOAuthClient`
- `tests/oauth-google-access-token.test.ts` — new file; 4 tests for fetchGoogleAccessToken
- `tests/email-sender-gmail-oauth.test.ts` — new file; 6 tests for createGmailOAuthClient

## Decisions Made

- Used `{ host: "smtp.gmail.com", port: 465, secure: true }` explicit form instead of `service: "gmail"` — follows Research §Pitfall 5 (some nodemailer versions require explicit form when `type: "OAuth2"`)
- `enforcedFrom` is computed from `config.user` at factory creation time and used unconditionally in `sendMail`; `options.from` in the `send()` call is ignored — follows Research §Pitfall 6 and plan must-haves
- No vitest alias update needed — existing `find: /^@\/lib\/email-sender$/` regex is exact-match only; `@/lib/email-sender/providers/gmail-oauth` is a sub-path that bypasses the alias and resolves via tsconfigPaths naturally

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for this plan. Note: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set as Vercel env vars (PREREQ-04) before `fetchGoogleAccessToken` can exchange tokens at runtime. This is a pre-existing PREREQ documented in STATE.md.

## Next Phase Readiness

- `fetchGoogleAccessToken` and `createGmailOAuthClient` are ready for Plan 03 consumption
- Plan 03 will compose these into `getSenderForAccount(accountId)` — the factory reads `account_oauth_credentials`, decrypts the refresh token, calls `fetchGoogleAccessToken`, then calls `createGmailOAuthClient`
- No blockers from this plan; Plan 35-01 (quota-guard per-account migration) is the other Wave 2 parallel plan and is already committed

---
*Phase: 35-per-account-gmail-oauth-send*
*Completed: 2026-05-07*
