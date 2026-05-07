---
phase: 35-per-account-gmail-oauth-send
plan: "03"
subsystem: email
tags: [gmail-oauth, supabase-admin, token-exchange, nodemailer, vitest, account-sender-factory]

# Dependency graph
requires:
  - phase: 35-per-account-gmail-oauth-send
    provides: fetchGoogleAccessToken (Plan 02), createGmailOAuthClient (Plan 02), per-account quota-guard signatures (Plan 01)
  - phase: 34-google-oauth-signup-and-credential-capture
    provides: account_oauth_credentials table with refresh_token_encrypted + status columns, decryptToken (lib/oauth/encrypt.ts)
provides:
  - getSenderForAccount(accountId) in lib/email-sender/account-sender.ts — per-account Gmail OAuth sender factory
  - REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused" — stable error prefix exported for Plan 04 callers
  - Full test suite (9 branches) in tests/account-sender.test.ts
affects:
  - 35-04 (cutover — all 7 email send paths replace sendEmail() with getSenderForAccount(accountId).then(s => s.send(...)))

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getSenderForAccount is fail-closed: every error path returns a refused sender, never throws"
    - "REFUSED_SEND_ERROR_PREFIX constant exported as stable contract for caller branching (Plan 04 will match on it)"
    - "invalid_grant is the only branch that writes to account_oauth_credentials; all other failures are silent-refuse only"
    - "No token caching in factory — Vercel serverless functions do not share memory, access tokens are 1h"

key-files:
  created:
    - lib/email-sender/account-sender.ts
    - tests/account-sender.test.ts

key-decisions:
  - "owner_email as Gmail From address (not a display name override) — factory passes config.user to createGmailOAuthClient which enforces it as From"
  - "No fromName injected — defaults to email address itself; account-name display is a future layer"
  - "invalid_grant only: needs_reconnect written by factory, all other token errors are refused-only (no DB write)"

patterns-established:
  - "getSenderForAccount fail-closed pattern: every branch returns EmailClient (real or refused); callers branch on result.success only"

# Metrics
duration: 2min
completed: 2026-05-07
---

# Phase 35 Plan 03: Account Sender Factory Summary

**getSenderForAccount(accountId) factory composing decrypt + Google token exchange + nodemailer OAuth2, fail-closed with invalid_grant DB side-effect; 9-branch test suite with chainable Supabase mock**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-07T01:47:51Z
- **Completed:** 2026-05-07T01:49:46Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- Created `lib/email-sender/account-sender.ts` — the central per-account OAuth sender factory that all 7 transactional email paths will call in Plan 04
- Factory is fully fail-closed: every error path (missing account, missing credential, needs_reconnect, decrypt failure, invalid_grant, other token error) returns a refused sender whose `.send()` resolves `{ success: false, error: "oauth_send_refused: ..." }` — never throws
- `invalid_grant` branch is the sole DB side-effect writer: it updates `account_oauth_credentials.status = 'needs_reconnect'` via admin (service-role) client, then returns refused sender — fulfilling AUTH-30 automatic revocation flagging
- 9-branch vitest suite in `tests/account-sender.test.ts` covering all factory paths; chainable Supabase mock handles both SELECT chains and the UPDATE side-effect; all 9 tests pass with zero real network or DB calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement getSenderForAccount factory** - `3e1ba69` (feat)
2. **Task 2: Test factory branches with mocked Supabase + token exchange** - `8993ab4` (test)

**Plan metadata:** (this docs commit)

## Files Created/Modified

- `lib/email-sender/account-sender.ts` — exports `getSenderForAccount(accountId): Promise<EmailClient>` and `REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused"`; 111 lines
- `tests/account-sender.test.ts` — 9 vitest tests; custom chainable Supabase mock with select/update support; 300 lines

## Decisions Made

- Used `account.owner_email` as the Gmail `user` (and therefore enforced From address) — `createGmailOAuthClient` already locks From = config.user, so the factory simply passes `owner_email` through
- Did not inject `fromName` — defaults to the email address itself; display name can be layered later if needed (no plan specifies it)
- Only `invalid_grant` triggers a DB write; all other token exchange failures (network_error, etc.) are refused silently without touching the DB — matches the research pattern that only authoritative Google revocation should flip the reconnect flag

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — this is a server-side factory. The required env vars (`GMAIL_TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, Supabase service role key) are pre-existing PREREQs documented in STATE.md.

## Next Phase Readiness

- `getSenderForAccount` is ready for Plan 04 consumption — importable from `@/lib/email-sender/account-sender`
- Plan 04 will replace all 7 `sendEmail()` calls with `await getSenderForAccount(accountId).then(s => s.send(...))`
- Callers branch on `result.success`; on false they can check `result.error?.startsWith(REFUSED_SEND_ERROR_PREFIX)` to distinguish OAuth refusal from other send errors
- No blockers from this plan

---
*Phase: 35-per-account-gmail-oauth-send*
*Completed: 2026-05-07*
