---
phase: 10-multi-user-signup-and-onboarding
verified: 2026-04-28T23:50:00Z
status: human_needed
score: 19/19 requirements verified (code complete); 6 items require human activation
human_verification:
  - test: P-A8 pre-flight + email confirm toggle
    expected: Andrew email_confirmed_at IS NOT NULL; toggle ON; redirect URLs whitelisted; email templates updated; Andrew can log in post-toggle
    why_human: Supabase Dashboard toggle and email template edits require browser access to Supabase UI
  - test: Signup E2E - new user can register and receive confirmation email
    expected: Confirmation email arrives; link routes through /auth/confirm?token_hash=...&type=signup; lands on /onboarding
    why_human: Requires email confirm toggle ON plus a live email inbox
  - test: Password reset E2E - forgot password + reset flow
    expected: Reset email arrives; link routes through /auth/confirm?type=recovery; new password accepted; redirect to /app/login?reset=success
    why_human: Requires email confirm toggle ON and live email inbox
  - test: Profile settings and soft delete UI walkthrough
    expected: Display name + slug + password updates persist; delete-account type-to-confirm works; /account-deleted shown; public booking page returns 404
    why_human: Visual and flow verification; soft delete DB state requires Supabase Dashboard to inspect deleted_at column
  - test: Email change E2E - request and confirm new address
    expected: Generic success returned; confirmation email at NEW address; /auth/confirm?type=email_change routes correctly; accounts.owner_email updates via trigger; 4th attempt in 1hr blocked
    why_human: Requires email confirm toggle ON, live email inbox, and Supabase Dashboard to verify trigger propagation
  - test: N=3 RLS matrix test - create 3rd test user and run full suite
    expected: 3rd Supabase auth user created; accounts row seeded; TEST_OWNER_3_EMAIL/PASSWORD in .env.test.local; all ~28-30 cases pass with no skips
    why_human: Supabase Dashboard user creation and local env var setup required
---
# Phase 10: Multi-User Signup and Onboarding - Verification Report

**Phase Goal:** Any visitor can sign up, confirm their email, complete onboarding, and land on a working dashboard -- while the existing NSI account continues to work unchanged.
**Verified:** 2026-04-28T23:50:00Z
**Status:** human_needed
**Score:** 19/19 requirements have shipping code; 6 items require human activation before milestone QA sign-off
**Re-verification:** No -- initial verification

---

## Goal Achievement

All 19 requirements (AUTH-05..11, ONBOARD-01..09, ACCT-01..03) have complete, wired, substantive code in the repository. The phase goal is code-complete. Six items are gated on manual Supabase Dashboard actions and live-inbox E2E tests; these are documented in MILESTONE_V1_1_DEFERRED_CHECKS.md and are expected human_needed items, not code gaps.

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Reserved slugs block sign-up collisions with app routes | VERIFIED | lib/reserved-slugs.ts (29 lines, 10 entries); isReservedSlug() imported by 4 consumers |
| 2 | /auth/confirm closes v1.0 /auth/callback 404 blocker | VERIFIED | app/auth/confirm/route.ts (61 lines); verifyOtp GET handler; recovery type hard-routes to /auth/reset-password |
| 3 | Signup with rate limit, quota guard, P-A1 enumeration prevention | VERIFIED | app/(auth)/app/signup/actions.ts (114 lines); checkAuthRateLimit + checkAndConsumeQuota + always redirects /verify-email |
| 4 | Password reset flow (forgot + reset) with P-A1 | VERIFIED | forgot-password/actions.ts + auth/reset-password/actions.ts; both use P-A1 pattern |
| 5 | Gmail SMTP quota cap (200/day) with alert on breach | VERIFIED | lib/email-sender/quota-guard.ts (81 lines); SIGNUP_DAILY_EMAIL_CAP=200; QuotaExceededError; checkAndConsumeQuota |
| 6 | Onboarding wizard: slug picker with reserved/taken/suggestions | VERIFIED | app/onboarding/step-1-account/account-form.tsx (226 lines); debounced /api/check-slug; slug_is_taken RPC |
| 7 | Onboarding wizard: timezone auto-detection | VERIFIED | step-2-timezone/timezone-form.tsx; Intl.DateTimeFormat().resolvedOptions().timeZone |
| 8 | Onboarding wizard: default event type + availability seeded on complete | VERIFIED | app/onboarding/actions.ts completeOnboardingAction (237 lines); INSERTs 5 availability_rules + 1 event_types; sets onboarding_complete=true |
| 9 | Welcome email sent on onboarding completion | VERIFIED | lib/onboarding/welcome-email.ts (85 lines); quota-guarded; called from completeOnboardingAction |
| 10 | accounts RLS (owner-only row access) + provisioning trigger | VERIFIED | migration 120002: accounts_owner_insert + accounts_owner_update policies + provision_account_for_new_user SECURITY DEFINER trigger |
| 11 | Profile: display name + slug update, password change | VERIFIED | app/(shell)/app/settings/profile/actions.ts; updateDisplayNameAction + updateSlugAction (catches 23505) + changePasswordAction |
| 12 | Soft delete with public route filtering | VERIFIED | softDeleteAccountAction sets deleted_at; load-account-listing.ts + load-event-type.ts both filter .is(deleted_at, null) |
| 13 | Email change with trigger sync of accounts.owner_email | VERIFIED | migration 120005 (sync_account_email_on_auth_update SECURITY DEFINER trigger); app/(shell)/app/settings/profile/email/actions.ts |
| 14 | Onboarding checklist on dashboard (7-day window, dismissible) | VERIFIED | components/onboarding-checklist.tsx (208 lines); app/(shell)/app/page.tsx lazy-loads counts; dismissChecklistAction server action |
| 15 | N=2 RLS cross-tenant matrix test | VERIFIED | tests/rls-cross-tenant-matrix.test.ts; N=2 suite runs; 148 passing + 24 skipping (N=3 guard awaiting user provisioning) |

**Score:** 15/15 truths verified (code level); 6 human activation items pending
---

## Required Artifacts

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| lib/reserved-slugs.ts | Reserved slug set + isReservedSlug() | YES | 29 lines, 10 entries | 4 importers | VERIFIED |
| app/auth/confirm/route.ts | verifyOtp GET handler (all OTP types) | YES | 61 lines | Linked from Supabase email templates | VERIFIED |
| app/(auth)/app/signup/actions.ts | Signup Server Action (rate limit + quota + P-A1) | YES | 114 lines | Imported by signup form | VERIFIED |
| app/(auth)/app/forgot-password/actions.ts | P-A1 password reset request | YES | Rate limit + quota guard | Imported by forgot-password form | VERIFIED |
| app/auth/reset-password/actions.ts | Password update Server Action | YES | Session guard + updateUser | Imported by reset form | VERIFIED |
| lib/auth/rate-limits.ts | AUTH_RATE_LIMITS (6 routes) + checkAuthRateLimit | YES | 41 lines | Imported by 5+ Server Actions | VERIFIED |
| lib/email-sender/quota-guard.ts | checkAndConsumeQuota + QuotaExceededError | YES | 81 lines | Imported by signup, welcome-email, email-change actions | VERIFIED |
| supabase/migrations/20260428120001 | onboarding_complete, deleted_at columns | YES | Substantive DDL | Applied to production | VERIFIED |
| supabase/migrations/20260428120002 | accounts RLS policies + provisioning trigger | YES | SECURITY DEFINER trigger + RLS policies | Applied to production | VERIFIED |
| supabase/migrations/20260428120003 | email_send_log table + RLS | YES | Substantive DDL | Used by quota-guard | VERIFIED |
| supabase/migrations/20260428120004 | slug_is_taken SECURITY DEFINER RPC | YES | Substantive DDL | Called by /api/check-slug | VERIFIED |
| supabase/migrations/20260428120005 | sync_account_email_on_auth_update trigger | YES | SECURITY DEFINER AFTER UPDATE trigger | Applied to production | VERIFIED |
| app/onboarding/ (pages + actions + schema) | 3-step wizard | YES | 237 lines in actions.ts | Redirected from dashboard when !onboarding_complete | VERIFIED |
| lib/slug-suggestions.ts | suggestSlugAlternatives() | YES | 37 lines, 3 strategies | Called by /api/check-slug | VERIFIED |
| app/api/check-slug/route.ts | Slug availability API | YES | 67 lines, auth-gated | Called by account-form.tsx debounce | VERIFIED |
| lib/onboarding/welcome-email.ts | HTML+text welcome email, quota-guarded | YES | 85 lines | Called from completeOnboardingAction | VERIFIED |
| app/(shell)/app/settings/profile/ | Profile settings pages (name + slug + password + delete) | YES | Multiple substantive files | Linked from dashboard nav | VERIFIED |
| app/(shell)/app/settings/profile/email/ | Email change page + rate-limited action | YES | actions.ts rate-limited + quota-guarded | Linked from profile page (active link) | VERIFIED |
| components/onboarding-checklist.tsx | 7-day dismissible checklist (3 items) | YES | 208 lines | Rendered in app/(shell)/app/page.tsx | VERIFIED |
| app/(shell)/app/onboarding-checklist-actions.ts | dismissChecklistAction Server Action | YES | Writes onboarding_checklist_dismissed_at | Imported by checklist component | VERIFIED |
| tests/rls-cross-tenant-matrix.test.ts | N=2 RLS matrix (N=3 skips gracefully) | YES | 148 passing + 24 skipping | Runs in vitest suite | VERIFIED |
| tests/account-soft-delete.test.ts | Soft delete invariant (6 tests) | YES | Substantive test file | Runs in vitest suite | VERIFIED |
---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| account-form.tsx | /api/check-slug | 300ms debounced fetch | WIRED |
| /api/check-slug | slug_is_taken RPC | supabase.rpc() | WIRED |
| /api/check-slug | isReservedSlug() | lib/reserved-slugs.ts import | WIRED |
| signUpAction | checkAuthRateLimit | lib/auth/rate-limits.ts import | WIRED |
| signUpAction | checkAndConsumeQuota | lib/email-sender/quota-guard.ts import | WIRED |
| completeOnboardingAction | sendWelcomeEmail | lib/onboarding/welcome-email.ts import | WIRED |
| completeOnboardingAction | availability_rules INSERT | supabase.from(availability_rules).insert() | WIRED |
| completeOnboardingAction | event_types INSERT | supabase.from(event_types).insert() | WIRED |
| app/(shell)/app/page.tsx | OnboardingChecklist | components/onboarding-checklist.tsx import | WIRED |
| app/(shell)/app/page.tsx | /onboarding redirect | !account.onboarding_complete guard at line 43 | WIRED |
| OnboardingChecklist | dismissChecklistAction | onboarding-checklist-actions.ts import | WIRED |
| softDeleteAccountAction | deleted_at filter | load-account-listing.ts + load-event-type.ts .is(deleted_at, null) | WIRED |
| requestEmailChangeAction | rate limit ip:uid | checkAuthRateLimit(emailChange) | WIRED |
| requestEmailChangeAction | checkAndConsumeQuota | quota-guard import | WIRED |
| auth.users INSERT | provision_account_for_new_user | SECURITY DEFINER trigger (migration 120002) | WIRED |
| auth.users UPDATE email | sync_account_email_on_auth_update | SECURITY DEFINER trigger (migration 120005) | WIRED |
| updateSlugAction | isReservedSlug() | lib/reserved-slugs.ts import in profile/actions.ts | WIRED |
---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| AUTH-05 | Reserved slug list prevents app route collisions | VERIFIED | lib/reserved-slugs.ts (10 entries); 4 consumers |
| AUTH-06 | /auth/confirm closes /auth/callback 404 blocker | VERIFIED | app/auth/confirm/route.ts (61 lines, verifyOtp) |
| AUTH-07 | Signup page with email confirm + P-A1 enumeration prevention | VERIFIED (code) / HUMAN-NEEDED (toggle activation) | actions.ts complete; Supabase toggle deferred to 10-05 manual gate |
| AUTH-08 | Gmail SMTP quota cap 200/day with alert | VERIFIED | quota-guard.ts (81 lines); SIGNUP_DAILY_EMAIL_CAP=200 |
| AUTH-09 | Forgot password + reset E2E with P-A1 | VERIFIED (code) / HUMAN-NEEDED (live email test) | Both Server Actions complete; E2E deferred |
| AUTH-10 | Email confirm toggle OFF by default, ON via manual gate | VERIFIED (code) / HUMAN-NEEDED (toggle flip) | Deferred to milestone-end per MILESTONE_V1_1_DEFERRED_CHECKS.md |
| AUTH-11 | Resend verification email rate limit | VERIFIED | AUTH_RATE_LIMITS.resendVerify (5/hr) in rate-limits.ts |
| ONBOARD-01 | accounts RLS (owner-only SELECT/UPDATE) | VERIFIED | migration 120002 accounts_owner_insert + accounts_owner_update policies |
| ONBOARD-02 | Provisioning trigger creates stub row on auth.users INSERT | VERIFIED | provision_account_for_new_user SECURITY DEFINER trigger (migration 120002) |
| ONBOARD-03 | Onboarding wizard step 1: slug picker with reserved/taken/suggestions | VERIFIED | account-form.tsx (226 lines); /api/check-slug; slug_is_taken RPC |
| ONBOARD-04 | Onboarding wizard step 2: timezone auto-detection | VERIFIED | step-2-timezone/timezone-form.tsx; Intl.DateTimeFormat |
| ONBOARD-05 | Onboarding wizard step 3: default event type seeded on complete | VERIFIED | completeOnboardingAction (237 lines); INSERTs availability_rules + event_types |
| ONBOARD-06 | Welcome email on onboarding completion | VERIFIED | welcome-email.ts (85 lines); called from completeOnboardingAction |
| ONBOARD-07 | Dashboard redirects to /onboarding when onboarding_complete=false | VERIFIED | app/(shell)/app/page.tsx guard at line 43 |
| ONBOARD-08 | Onboarding checklist (7-day, 3 items, dismissible) | VERIFIED (code) / HUMAN-NEEDED (browser walkthrough) | onboarding-checklist.tsx (208 lines); browser test deferred |
| ONBOARD-09 | dismissChecklistAction writes onboarding_checklist_dismissed_at | VERIFIED (code) / HUMAN-NEEDED (browser walkthrough) | onboarding-checklist-actions.ts wired; browser confirm deferred |
| ACCT-01 | Profile settings: display name + slug update + password change | VERIFIED (code) / HUMAN-NEEDED (UI walkthrough) | profile/actions.ts all 3 actions complete |
| ACCT-02 | Soft delete with public route filtering | VERIFIED | softDeleteAccountAction + both public loaders filter deleted_at |
| ACCT-03 | Email change with re-verification + trigger sync | VERIFIED (code) / HUMAN-NEEDED (live E2E) | email/actions.ts + migration 120005; E2E deferred |
---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| app/onboarding/step-1-account/account-form.tsx | ~180 | Hardcoded calendar.andrewwegner.dev URL prefix in booking link preview | INFO | Display-only; does not affect routing or data logic |

No blocker or warning anti-patterns found. The hardcoded URL is informational only.

---

## Human Verification Required

All items below are in .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md for batch execution at Phase 13 QA.

### 1. P-A8 Pre-flight + Email Confirm Toggle

**Test:** Run scripts/phase10-pre-flight-andrew-email-confirmed.sql; verify Andrew email_confirmed_at IS NOT NULL; flip Enable email confirmations to ON in Supabase Dashboard; whitelist redirect URLs; update email templates to token-hash pattern; log in as Andrew to confirm no lockout.
**Expected:** All 5 steps complete; Andrew can reach /app dashboard.
**Why human:** Supabase Dashboard toggle and template edits require browser access to Supabase UI.

### 2. Signup E2E -- New User Registration

**Test:** Navigate to /app/signup; register with a fresh email address; check inbox for confirmation; click link; land on /onboarding; complete wizard.
**Expected:** Each step completes without errors; wizard completion lands on /app dashboard with checklist visible.
**Why human:** Requires email confirm toggle ON plus a live email inbox.

### 3. Password Reset E2E

**Test:** Log out; navigate to /app/forgot-password; submit email; click link in inbox; reset password; confirm redirect to /app/login?reset=success.
**Expected:** Full flow completes; old password no longer works.
**Why human:** Requires email confirm toggle ON plus a live email inbox.

### 4. Profile Settings and Soft Delete UI Walkthrough

**Test:** Log in; navigate to /app/settings/profile; update display name; change slug; change password; test delete-account type-to-confirm dialog.
**Expected:** Each save persists; after delete user lands on /account-deleted and cannot log in; public booking page returns 404.
**Why human:** Visual confirmation and DB state verification (deleted_at column) require browser and Supabase Dashboard.

### 5. Email Change E2E

**Test:** Log in; navigate to /app/settings/profile/email; submit new address; check NEW inbox for confirmation; click link; verify accounts.owner_email updated in Supabase Dashboard; attempt 4th request within 1 hour to confirm rate limit.
**Expected:** Full flow completes; trigger propagation visible in Supabase Dashboard; 4th attempt blocked.
**Why human:** Requires email confirm toggle ON, live email inbox, and Supabase Dashboard to verify trigger.

### 6. N=3 RLS Cross-Tenant Matrix Test

**Test:** Create 3rd Supabase auth user (nsi-rls-test-3@andrewwegner.example); seed matching accounts row; add TEST_OWNER_3_EMAIL/PASSWORD to .env.test.local; run npm test -- tests/rls-cross-tenant-matrix.test.ts.
**Expected:** All ~28-30 cases pass with no skips.
**Why human:** Supabase Dashboard user creation and local env var setup required.

---

## Deferred Items Reference

All deferred manual checks are in .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md. Replay order matters:

1. Phase 10-05: P-A8 pre-flight + email confirm toggle + Supabase URL config + email templates
2. Phase 10-08: Email-change E2E verification (depends on 10-05 toggle being ON)
3. Phase 10-09 Task 1: Create 3rd RLS test user + run N=3 matrix locally
4. Phase 10-09 browser: Onboarding checklist visible post-wizard + dismiss persists

---

## Summary

Phase 10 is code-complete. All 19 requirements have substantive, wired implementations committed to the repository. The 6 human_verification items are expected activation gates (Supabase Dashboard toggle, live email E2E flows, RLS test user provisioning) that were deferred to milestone-end QA by design. No code gaps, no stubs, no blocker anti-patterns.

Phase 11 (Booking Capacity + Double-Booking Fix) can start immediately.

---

*Verified: 2026-04-28T23:50:00Z*
*Verifier: Claude (gsd-verifier)*