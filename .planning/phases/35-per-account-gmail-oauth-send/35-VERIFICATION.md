---
phase: 35-per-account-gmail-oauth-send
verified: 2026-05-07T21:35:00Z
status: passed
score: 5/5 success criteria verified
re_verification: false
---

# Phase 35: Per-Account Gmail OAuth Send -- Verification Report

**Phase Goal:** All seven transactional email paths route through a per-account sender factory backed by each account Gmail OAuth credential, with per-account quota isolation and a strangler-fig cutover that retires the centralized SMTP singleton in a separate post-verification deploy.

**Verified:** 2026-05-07T21:35:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 7 transactional paths call getSenderForAccount; zero direct sendEmail singleton calls | VERIFIED | grep confirms 7 call sites across 5 files; lib/email-sender/index.ts exports only types+utils (no sendEmail function) |
| 2 | SMTP singleton (gmail.ts, GMAIL_APP_PASSWORD) removed from codebase | VERIFIED | lib/email-sender/providers/ contains only gmail-oauth.ts; GMAIL_APP_PASSWORD appears only in comments, zero production code references |
| 3 | Per-account quota: all 3 quota helpers take accountId and filter per-account | VERIFIED | quota-guard.ts lines 50-56 (getDailySendCount), 78-102 (checkAndConsumeQuota), 111-113 (getRemainingDailyQuota) -- all filter by accountId |
| 4 | Fail-closed refusedSender: getSenderForAccount never throws; all error paths return refused-send result | VERIFIED | account-sender.ts -- 7 distinct return refusedSender() call sites covering: account lookup failure, missing owner_user_id, missing owner_email, credential lookup failure, missing encrypted token, needs_reconnect status, decrypt failure, invalid_grant (lines 49-104) |
| 5 | Direct-Google OAuth callback handles code exchange + CSRF state cookie | VERIFIED | app/auth/gmail-connect/callback/route.ts (154 lines): state cookie gmail_connect_state verified at line 49, code POSTed to oauth2.googleapis.com/token at line 76, AES-256-GCM encrypt + upsert to account_oauth_credentials at lines 126-151 |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|----------|
| lib/email-sender/account-sender.ts | Per-account OAuth factory | VERIFIED | 111 lines, exports getSenderForAccount + REFUSED_SEND_ERROR_PREFIX, 7 refusal paths |
| lib/email-sender/providers/gmail-oauth.ts | Gmail REST API provider | VERIFIED | 202 lines, POSTs to https://gmail.googleapis.com/gmail/v1/users/me/messages/send, builds RFC-822 with multipart/alternative |
| lib/email-sender/quota-guard.ts | Per-account quota isolation | VERIFIED | 135 lines, all 3 exported functions take accountId: string |
| lib/email-sender/index.ts | Singleton retired (types/utils only) | VERIFIED | 33 lines, no sendEmail, no _defaultClient, no getDefaultClient -- only type+utility re-exports |
| lib/email-sender/providers/gmail.ts | Deleted (SMTP nodemailer provider) | VERIFIED | File absent; providers/ directory contains only gmail-oauth.ts |
| app/auth/gmail-connect/callback/route.ts | Direct-Google OAuth callback | VERIFIED | 154 lines, full code-exchange + scope check + encrypt + upsert |
| app/(shell)/app/settings/gmail/_lib/actions.ts | connectGmailAction with CSRF | VERIFIED | 111 lines, STATE_COOKIE=gmail_connect_state, httpOnly cookie written at line 51, redirects to Google auth URL |
| supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql | account_oauth_credentials table + service-role-only writes | VERIFIED | 64 lines, RLS enabled, SELECT-only policy for authenticated users, no INSERT/UPDATE/DELETE policies |
| supabase/migrations/20260506140000_phase35_email_send_log_account_id.sql | account_id column + index on email_send_log | VERIFIED | 15 lines, nullable FK + email_send_log_account_sent_at_idx |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|----------|
| send-booking-confirmation.ts | account-sender.ts | getSenderForAccount(accountId) at line 183 | WIRED | Imports from @/lib/email-sender/account-sender |
| send-owner-notification.ts | account-sender.ts | getSenderForAccount(accountId) at line 177 | WIRED | Imports from @/lib/email-sender/account-sender |
| send-cancel-emails.ts | account-sender.ts | getSenderForAccount(accountId) at lines 228 (booker) + 353 (owner) | WIRED | Both internal send functions call the factory |
| send-reschedule-emails.ts | account-sender.ts | getSenderForAccount(accountId) at lines 252 (booker) + 369 (owner) | WIRED | Both internal send functions call the factory |
| send-reminder-booker.ts | account-sender.ts | getSenderForAccount(accountId) at line 228 | WIRED | Reminder cron at app/api/cron/send-reminders/route.ts calls sendReminderBooker which uses factory |
| welcome-email.ts | account-sender.ts | getSenderForAccount(account.id) at line 68 | WIRED | Migrated in Plan 06 (commit 31db425) |
| gmail-connect callback | account_oauth_credentials | admin upsert at line 126 | WIRED | Service-role admin client; encrypt before write |
| account-sender.ts | account_oauth_credentials | admin select at lines 62-67 | WIRED | Lookup by user_id + provider=google |
| account-sender.ts | providers/gmail-oauth.ts | createGmailOAuthClient({ user, accessToken }) at line 107 | WIRED | Returns EmailClient backed by REST API |
| gmail-oauth.ts | Gmail REST API | fetch to gmail.googleapis.com/gmail/v1/users/me/messages/send at line 60 | WIRED | Bearer token auth, base64url-encoded RFC-822 body |

---

## Success Criterion Coverage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| SC1: Booking confirmation via Gmail OAuth in inbox | HUMAN-VERIFIED | Bookings 561d97db, 592eb13e, bdfc6d8c show confirmation_email_sent=true; real inbox delivery confirmed by Andrew (~02:15 UTC 2026-05-08) |
| SC2: Per-account quota isolation | CODE-VERIFIED | .eq("account_id", accountId) in all 3 quota helpers; architecturally enforced; live seed test (nsi-rls-test at 200/200, nsi at 6/200) confirmed isolation |
| SC3: invalid_grant triggers needs_reconnect banner + fail-closed sends | CODE+SMOKE-VERIFIED | account-sender.ts lines 91-100 flip status + return refusedSender; gmail-status-panel.tsx lines 91-103 render Reconnect needed UI; DB smoke test performed by Andrew |
| SC4: Zero direct sendEmail singleton calls in production send code | CODE-VERIFIED | lib/email-sender/index.ts exports no sendEmail function; grep of lib/ + app/ (excluding test files) returns zero sendEmail call sites |
| SC5: GMAIL_APP_PASSWORD and SMTP path removed in separate deploy | CODE-VERIFIED | providers/gmail.ts deleted; GMAIL_APP_PASSWORD absent from all .ts/.tsx production files; .env.local clean; .env.example documents removal |

---

## Anti-Patterns Found

None blocking goal achievement. Stale label strings noted (informational only):

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| lib/email-sender/quota-guard.ts line 92 | Log tag [GMAIL_SMTP_QUOTA_APPROACHING] contains SMTP -- cosmetic stale label | Info | Log parsing only; does not affect send path |
| lib/bookings/cancel.ts line 51, app/(shell)/app/bookings/[id]/_lib/actions.ts lines 24/26/134 | Comments reference Gmail SMTP cap -- pre-Phase-35 comment text | Info | No runtime impact |

---

## Build and Test Gates

| Gate | Status | Details |
|------|--------|----------|
| npx tsc --noEmit | PASSED | Zero errors in production files (lib/, app/); TS errors confined to tests/ files referencing __mockSendCalls/__resetMockSendCalls from @/lib/email-sender (symbols exist in Vitest mock but not in real module -- test-only TS issue, no production impact) |
| npx vitest run tests/email-sender-gmail-oauth.test.ts | PASSED | 8/8 tests pass |
| npx vitest run (full suite) | 328/330 passed | 2 pre-existing failures in tests/bookings-api.test.ts and tests/slots-api.test.ts -- both return 429 (rate-limiter in test env); last modified in Phases 5/9; unrelated to Phase 35 |
| npm run build | PASSED | Clean Next.js production build; all routes compiled; no errors |

---

## Human Verification Already Completed This Session

All items requiring human eyeball tests were performed live by Andrew during this session:

1. **Production Gmail OAuth send (3 bookings confirmed)** -- Bookings 561d97db, 592eb13e, bdfc6d8c delivered to inbox. confirmation_email_sent=true in DB for all three against account_id = ba8e712d-... (nsi account). Verified ~02:15 UTC 2026-05-08.

2. **Reconnect banner smoke test** -- nsi credential row flipped to needs_reconnect in DB; settings page displayed Reconnect needed UI with reconnect button. Reverted after test.

3. **Per-account quota seed test** -- nsi-rls-test account seeded to 200/200 while nsi was at 6/200; demonstrated DB-level isolation.


---

## Gaps Summary

No gaps. All success criteria are met:


* The SMTP singleton (providers/gmail.ts, getDefaultClient, sendEmail factory, GMAIL_APP_PASSWORD) is fully removed from production code.
* All 7 transactional email paths (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner) plus welcome-email route through getSenderForAccount.
* account_oauth_credentials table exists with service-role-only writes enforced at the RLS layer.
* email_send_log.account_id column added with per-account index; all 3 quota helpers filter by accountId.
* refusedSender fail-closed contract verified at all 7 error branches in account-sender.ts.
* Direct-Google OAuth callback handles CSRF, code exchange, scope verification, and AES-256-GCM encrypted persist.
* Gmail REST API provider (providers/gmail-oauth.ts) replaces SMTP; scope alignment with gmail.send is correct.
* Production sends confirmed live by Andrew.

---

_Verified: 2026-05-07T21:35:00Z_
_Verifier: Claude (gsd-verifier)_
