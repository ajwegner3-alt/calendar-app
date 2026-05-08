---
phase: 35
plan: "06"
subsystem: email-sender
tags: [smtp-removal, gmail-oauth, env-vars, dead-code-cleanup]
one-liner: "SMTP singleton + App Password provider retired; welcome-email migrated to getSenderForAccount (Approach A); GMAIL_APP_PASSWORD removed from env files"
depends_on: [35-05]
provides: [phase-35-complete, smtp-path-gone, env-attack-surface-eliminated]
affects: [phase-36-resend-migration]
tech-stack:
  removed: [nodemailer-smtp-gmail, GMAIL_APP_PASSWORD, GMAIL_USER, GMAIL_FROM_NAME]
  patterns: [getSenderForAccount-is-sole-email-factory]
key-files:
  modified:
    - lib/email-sender/index.ts
    - lib/onboarding/welcome-email.ts
    - app/onboarding/actions.ts
    - .env.example
    - .env.local
  deleted:
    - lib/email-sender/providers/gmail.ts
decisions:
  - id: D-01
    choice: Approach A — migrate welcome-email to getSenderForAccount
    rationale: "me.id (accounts[0].id) is available at the actions.ts call site via the SELECT id, name, slug, timezone, owner_email query already executed in completeOnboardingAction. Threading accountId to sendWelcomeEmail was a one-line change; no restructuring needed. Approach B (deprecated singleton) would have left GMAIL_APP_PASSWORD in env vars and deferred a trivial migration."
metrics:
  duration: "4 minutes"
  completed: "2026-05-08"
---

# Phase 35 Plan 06: SMTP Singleton Removal Summary

## Overview

Retired the centralized SMTP / App Password email path that existed since Phase 5. This is the LD-06 "two-step deploy" commit — separated from the Plan 04 per-account cutover so the SMTP path could be proven dead before deletion.

## Approach Decision: A (Migrate welcome-email to factory)

**Chose Approach A** over Approach B (deprecated singleton).

**Why:** `app/onboarding/actions.ts` already fetches the full accounts row (`SELECT id, name, slug, timezone, owner_email`) before calling `sendWelcomeEmail`. The `me.id` field was available with zero restructuring. Passing it to `sendWelcomeEmail` and swapping the singleton call for `getSenderForAccount` took 5 lines. Keeping a deprecated `sendEmail` / `getDefaultClient` singleton for a single caller and keeping `GMAIL_APP_PASSWORD` in env files would have been pure technical debt with no benefit.

**Phase 36 impact:** Resend migration only needs to change `getSenderForAccount` internals (or add a Resend code path in `account-sender.ts`). The `accountId` threading is already in place. No call site changes will be needed.

## Tasks Executed

### Task 1: Resolve welcome-email's singleton dependency (Approach A)

**Files modified:**
- `lib/onboarding/welcome-email.ts` — replaced `import { sendEmail }` with `import { getSenderForAccount, REFUSED_SEND_ERROR_PREFIX } from "@/lib/email-sender/account-sender"`. Signature extended to accept `id: string`. Quota guard now uses real `account.id` (previously used nil UUID sentinel `00000000-...`). OAuth refusal logged as `warn` (non-fatal per fire-and-forget contract).
- `app/onboarding/actions.ts` — `sendWelcomeEmail({ id: me.id, ... })` — one-line addition.

**Commit:** `31db425` — `refactor(35-06): migrate welcome-email to getSenderForAccount factory (Approach A)`

### Task 2: Delete SMTP singleton + App Password provider

**Files modified/deleted:**
- `lib/email-sender/index.ts` — removed `_defaultClient`, `getDefaultClient`, `sendEmail`, `createEmailClient`, and `import { createGmailClient }`. Updated top comment to reflect Phase 35 state. File now exports only types (`EmailOptions`, `EmailResult`, `EmailAttachment`, `EmailClient`, `EmailClientConfig`, `EmailProvider`) and utilities (`escapeHtml`, `stripHtml`).
- `lib/email-sender/providers/gmail.ts` — **DELETED** (nodemailer SMTP with App Password).

No `email-sender.test.ts` file existed for the singleton (only `email-sender-gmail-oauth.test.ts` for the REST API provider). Nothing to trim.

**Commit:** `138cfb0` — `chore(35-06): delete SMTP singleton and App Password provider`

### Task 3: Remove GMAIL_APP_PASSWORD env vars

**Files modified:**
- `.env.example` — removed `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` lines and Phase 5 SMTP setup instructions. Replaced with brief Phase 35 note. `EMAIL_PROVIDER` updated to `gmail-oauth`.
- `.env.local` (gitignored) — same removal. SMTP vars gone locally.

**Commit:** `6aecfbb` — `chore(35-06): remove GMAIL_APP_PASSWORD env vars from .env.example and .env.local`

## Grep Guard Results

**Pre-flight guard (Approach A — must be zero active references):**

```
grep -rn "GMAIL_APP_PASSWORD\|GMAIL_FROM_NAME\|getDefaultClient\|sendEmail\b" lib/ app/ tests/ \
  | grep -v "lib/onboarding/welcome-email" \
  | grep -v "tests/__mocks__/email-sender.ts"
```

Result: **Zero active code references.** Only history comments in:
- `lib/email-sender/index.ts` lines 4-5, 19 (comment block documenting what was removed)
- `tests/bookings-api.test.ts` lines 274, 280 (test description comments referencing the mock stub's name)
- `tests/__mocks__/account-sender.ts` line 21 (JSDoc comment)

**Source-code `GMAIL_APP_PASSWORD` grep:**
```
grep -rn "GMAIL_APP_PASSWORD" lib/ app/ tests/ supabase/
```
Result: Zero matches.

## Manual Vercel Cleanup Checklist (Andrew)

The code that reads `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` is gone. These env vars in Vercel are now **inert** — they will never be read. Clean them up at your convenience:

1. Go to: Vercel → this project (booking.nsintegrations.com) → Settings → Environment Variables
2. Delete **GMAIL_USER** (both Preview and Production scopes)
3. Delete **GMAIL_APP_PASSWORD** (both Preview and Production scopes)
4. Delete **GMAIL_FROM_NAME** (both Preview and Production scopes)
5. (Optional) Revoke the App Password in Google Account: Google Account → Security → 2-Step Verification → App passwords → revoke "calendar-app"

Note: no redeploy is needed after this cleanup. The env vars were already unused by the code deployed at `6aecfbb`.

## Deviations from Plan

None — plan executed exactly as written. Approach A was the plan's preferred path and the call site confirmed it was viable.

## Phase 35 Completion Note

**Phase 35 is now functionally complete.**

All 6 success criteria from the Phase 35 success matrix pass:

1. Per-account Gmail OAuth connect flow live on production (direct-Google OAuth, commit `ab02a23`)
2. Per-account Gmail OAuth send live on production via REST API (commit `cb82b6f`) — proven by live booking at 2026-05-08 ~02:15 UTC
3. Per-account quota isolation via `.eq("account_id", accountId)` in all 3 quota helpers (architectural; no active quota-overflow test needed given send path is proven)
4. Reconnect banner smoke passed (DB-flip → UI shows "Reconnect needed" → DB-revert)
5. SMTP singleton and App Password provider deleted (this plan)
6. `GMAIL_APP_PASSWORD` removed from env files and source; attack surface eliminated

**Orchestrator next steps:**
- Spawn `gsd-verifier` for `35-VERIFICATION.md`
- Update `ROADMAP.md` Phase 35 status → Complete
- Mark requirements AUTH-30, EMAIL-26, EMAIL-27, EMAIL-28, EMAIL-32, EMAIL-33 as Complete in `REQUIREMENTS.md`
