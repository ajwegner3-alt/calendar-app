---
phase: 36-resend-backend-for-upgraded-accounts
verified: 2026-05-08T00:00:00Z
status: passed
score: 13/13 must-haves verified
gaps: []
human_verification:
  - test: Live Resend send after PREREQ-03 completion
    expected: Email arrives via Resend; Resend dashboard HTTP 200; email_send_log row has provider=resend
    why_human: Requires PREREQ-03 (Resend account + NSI domain DNS + Vercel RESEND_API_KEY) - deferred per ROADMAP; not a gap
---

# Phase 36: Resend Backend for Upgraded Accounts - Verification Report

**Phase Goal:** A Resend HTTP client backed by NSI verified domain is wired into the sender factory so that any account with email_provider=resend routes all sends through Resend, bypassing the 200/day Gmail cap entirely while still logging to email_send_log for analytics.

**Verified:** 2026-05-08
**Status:** PASSED (framework-readiness)
**Re-verification:** No - initial verification
**Scope note:** Framework-only ship. PREREQ-03 is deferred. All code paths verified wired.

---

## Observable Truths - 13/13 Verified

### Plan 36-01 Truths

**Truth 1 - accounts.email_provider column**: VERIFIED
- Evidence: supabase/migrations/20260507120000_phase36_resend_provider.sql lines 19-21

**Truth 2 - accounts.resend_status column**: VERIFIED
- Evidence: migration lines 27-29

**Truth 3 - email_send_log.provider column**: VERIFIED
- Evidence: migration lines 34-38

**Truth 4 - EmailProvider TypeScript union = "gmail" | "resend"**: VERIFIED
- Evidence: lib/email-sender/types.ts line 46

### Plan 36-02 Truths

**Truth 5 - createResendClient HTTP provider**: VERIFIED
- Evidence: providers/resend.ts line 10 (RESEND_ENDPOINT), line 46 (lazy RESEND_API_KEY read inside send()), lines 84-91 (fetch POST with Authorization Bearer)

**Truth 6 - Never-throws error contract**: VERIFIED
- Evidence: resend.ts lines 93-113; resend-provider.test.ts 9 cases (HTTP 422, 429, 500, ECONNREFUSED)

**Truth 7 - Snake_case field mapping (reply_to, content_type)**: VERIFIED
- Evidence: resend.ts line 61 (reply_to), line 79 (content_type); tests #7 and #8

**Truth 8 - RESEND_REFUSED_SEND_ERROR_PREFIX constant exported**: VERIFIED
- Evidence: resend.ts line 8; re-exported from account-sender.ts lines 8-17; mirrored in mock line 41; test #9 asserts exact value

**Truth 9 - Vitest mock infrastructure**: VERIFIED
- Evidence: vitest.config.ts lines 69-71 (exact-regex alias); tests/__mocks__/resend-provider.ts 33 lines; account-sender mock exports both constants

### Plan 36-03 Truths

**Truth 10 - getSenderForAccount routing on email_provider**: VERIFIED
- Evidence: account-sender.ts lines 107-111 (SELECT), 131 (branch), 147 (call), 200 (Gmail fallback); test #10

**Truth 11 - Suspended account fast-refusal without OAuth lookup**: VERIFIED
- Evidence: account-sender.ts lines 134-140 (before OAuth SELECT at line 155); test #11

**Truth 12 - Resend wins over present account_oauth_credentials row**: VERIFIED
- Evidence: Resend branch returns at lines 131-152 before credential SELECT at line 155; test #12

**Truth 13 - checkAndConsumeQuota bypass + provider tagging**: VERIFIED
- Evidence: quota-guard.ts lines 105-109 (accounts SELECT), 111 (provider derivation), 113 (Gmail-only cap gate), 135 (tagged insert)

**Truth 14 - Orchestrator dual-prefix fix (OQ-2)**: VERIFIED
- Evidence: send-booking-emails.ts line 10 (import isRefusedSend), line 92 (call); REFUSED_SEND_ERROR_PREFIX not imported in file

**Truth 15 - Soft 5000/day abuse warn-log**: VERIFIED
- Evidence: account-sender.ts lines 57-73 (warnIfResendAbuseThresholdCrossed); line 144 (void call - fire-and-forget)

**Truth 16 - FUTURE_DIRECTIONS.md activation guide**: VERIFIED
- Evidence: line 303 (PREREQ-03), line 314 (RESEND_API_KEY), lines 327/336/344 (SQL snippets)
---

## Required Artifacts

| Artifact | Lines | Status |
|----------|-------|--------|
| supabase/migrations/20260507120000_phase36_resend_provider.sql | 38 | VERIFIED - 2x ALTER TABLE accounts + 1x ALTER TABLE email_send_log |
| lib/email-sender/types.ts | 70 | VERIFIED - EmailProvider union includes resend at line 46 |
| lib/email-sender/providers/resend.ts | 117 | VERIFIED - createResendClient + RESEND_REFUSED_SEND_ERROR_PREFIX exported; no stubs |
| tests/resend-provider.test.ts | 206 | VERIFIED - 9 test cases; mocked fetch; no real API calls |
| tests/__mocks__/account-sender.ts | 69 | VERIFIED - RESEND_REFUSED_SEND_ERROR_PREFIX (line 41) + isRefusedSend (lines 45-51) |
| tests/__mocks__/resend-provider.ts | 33 | VERIFIED - createResendClient stub pushes to __mockSendCalls |
| vitest.config.ts | 83 | VERIFIED - exact-regex alias for providers/resend at lines 69-71 |
| lib/email-sender/account-sender.ts | 204 | VERIFIED - routing + exports + abuse helper; no stubs |
| lib/email-sender/quota-guard.ts | 172 | VERIFIED - email_provider SELECT + cap bypass + tagged insert |
| lib/email/send-booking-emails.ts | 135 | VERIFIED - isRefusedSend imported line 10 and called line 92 |
| FUTURE_DIRECTIONS.md | 300+ | VERIFIED - PREREQ-03 + RESEND_API_KEY + activation SQL |
| tests/account-sender.test.ts Phase 36 ext. | 430+ | VERIFIED - tests #10-#14 all present |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| account-sender.ts | accounts.email_provider/resend_status/name | .select() lines 107-111 extended | WIRED |
| account-sender.ts | createResendClient (providers/resend.ts) | import lines 7-9; branch line 131; call line 147 | WIRED |
| account-sender.ts | warnIfResendAbuseThresholdCrossed | void call line 144; dynamic import of quota-guard | WIRED |
| quota-guard.ts | accounts.email_provider | maybeSingle SELECT lines 105-109 | WIRED |
| quota-guard.ts | email_send_log insert with provider tag | insert({category, account_id, provider}) line 135 | WIRED |
| send-booking-emails.ts | isRefusedSend helper | import line 10; call line 92 | WIRED |
| providers/resend.ts | https://api.resend.com/emails | fetch POST lines 84-91 | WIRED |
| providers/resend.ts | process.env.RESEND_API_KEY | lazy read line 46 inside send() body | WIRED |

---

## Anti-Patterns Scan

No blockers or stubs found in Phase 36 implementation files.

- No TODO/FIXME/HACK/placeholder patterns in implementation files.
- No empty returns or no-op handlers; every error path returns a structured EmailResult.
- warnIfResendAbuseThresholdCrossed uses void (fire-and-forget) by intentional CONTEXT design.
- send-booking-emails.ts: REFUSED_SEND_ERROR_PREFIX not imported; OQ-2 fix is complete.
- tests/__mocks__/resend-provider.ts is an intentional Vitest mock; isolated from real-module unit tests.

---

## Human Verification Required

### 1. Live Resend Send Path (Deferred per ROADMAP framework-only decision)

**Test:** After PREREQ-03 completion, flip a test account (UPDATE accounts SET email_provider = resend WHERE slug = nsi-test) and make a booking. Verify email arrives with correct From display name and bookings@nsintegrations.com. Check Resend dashboard for HTTP 200. Confirm .ics renders as inline RSVP in Gmail.

**Expected:** Resend dashboard shows the send. Booker inbox receives confirmation with .ics. email_send_log row has provider=resend.

**Why human:** Requires live Resend account, verified NSI domain DNS in Namecheap, and RESEND_API_KEY deployed in Vercel - all PREREQ-03 items explicitly deferred per ROADMAP. Not a gap; all code paths confirmed wired.

Full activation checklist in FUTURE_DIRECTIONS.md at the Phase 36 section.

---

## Summary

Phase 36 achieves its framework-readiness goal completely. All 13 plan-level must-haves pass.

**Plan 36-01 (Schema + Types):** Migration at timestamp 20260507120000 adds accounts.email_provider (CHECK gmail/resend, DEFAULT gmail), accounts.resend_status (CHECK active/suspended, DEFAULT active), and email_send_log.provider (DEFAULT gmail). EmailProvider union extended to include resend.

**Plan 36-02 (Resend Provider):** createResendClient is 117 lines, complete, never-throws, using raw fetch. RESEND_API_KEY is lazy-read inside send() for Vitest isolation. Snake_case mapping (reply_to, content_type) verified by tests #7 and #8. All 9 unit tests pass against mocked fetch. Vitest alias and stub in place.

**Plan 36-03 (Factory Routing + Orchestrator Fix):** getSenderForAccount branches on email_provider before OAuth lookup - Resend wins over present credentials, suspension refuses without credential table access. checkAndConsumeQuota bypasses 200/day cap for Resend and tags email_send_log rows - zero leaf-caller changes (OQ-1). send-booking-emails.ts uses isRefusedSend for both refusal types (OQ-2). Tests #10-#14 all present. FUTURE_DIRECTIONS.md has complete activation checklist.

Activation when ready: complete PREREQ-03, add RESEND_API_KEY to Vercel, one SQL UPDATE per customer. No code changes, no redeploy.

---

_Verified: 2026-05-08_
_Verifier: Claude (gsd-verifier)_
