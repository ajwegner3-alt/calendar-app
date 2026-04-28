# v1.1 Deferred Manual Checks

Per Andrew 2026-04-28: all manual / human-action checkpoints during Phase 10–13 execution are **deferred to milestone end** (Phase 13 manual QA). Execute-phase orchestrator skips the Supabase Dashboard / live-verification gates and continues forward; this file captures the queued actions so they can be replayed in one batch before v1.1 ship.

**Order matters when replaying** — items are listed in the order they were generated during execution. Some items have prerequisites (e.g., must deploy code before running pre-flight SQL).

---

## Phase 10 — Plan 10-05 — P-A8 Pre-flight + Supabase Dashboard Config

**Source:** `.planning/phases/10-multi-user-signup-and-onboarding/10-05-signup-page-and-email-confirm-toggle-PLAN.md` Task 1 (autonomous=false).
**Pre-flight SQL file:** `scripts/phase10-pre-flight-andrew-email-confirmed.sql`
**Pre-condition:** Phase 10 commits must be deployed to Vercel production. Verify via:
```
curl -i "https://<prod>/auth/confirm?token_hash=test&type=signup"
# Expect 4xx, NOT 404. 404 = code not deployed; STOP.
```

**Five steps to execute (in order):**

1. **Run the pre-flight SQL** in Supabase SQL Editor (or `npx supabase db query --linked -f scripts/phase10-pre-flight-andrew-email-confirmed.sql`):
   ```sql
   select id, email, email_confirmed_at, created_at
   from auth.users
   where email = 'ajwegner3@gmail.com';
   ```
   - Expected: `email_confirmed_at` is NOT NULL.
   - If NULL: uncomment the conditional UPDATE in the SQL file, run it, then re-SELECT to verify.

2. **Enable email confirmations.** Supabase Dashboard → Authentication → Sign In / Up → "Enable email confirmations" → ON.

3. **Whitelist redirect URLs.** Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Add:
   - `http://localhost:3000/auth/confirm`
   - `https://<vercel-prod-domain>/auth/confirm`
   - `https://calendar-app-*.vercel.app/auth/confirm` (verify Supabase accepts the wildcard; otherwise enumerate active preview URLs)

4. **Update email templates** (Authentication → Email Templates). Replace legacy `{{ .ConfirmationURL }}` with token-hash pattern:
   - **Confirm signup:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding`
   - **Reset Password:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
   - **Magic Link:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
   - **Confirm Email Change:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`

5. **Verify Andrew's login still works.** Log in at production `/app/login` as `ajwegner3@gmail.com` post-toggle. Should reach `/app` successfully (he has an existing accounts row with `onboarding_complete=true` per 10-03).

**Why deferred:** The toggle flip itself is the manual gate that creates lockout risk. As long as the toggle stays OFF, Andrew cannot be locked out. Other Phase 10 plans (signup, wizard, profile settings) ship code that EXPECTS the toggle to be ON, but they will not be exercised in production until milestone-end QA — at which point Andrew runs all five steps in one sitting.

**Light-weight verification during Phase 10 execution:** later phases that depend on email-confirm being ON (signup E2E test, etc.) will be marked as deferred-to-milestone-end where they hit this dependency.

---

## (Add additional deferred checks here as later plans emit them)

---

*Last updated: 2026-04-28 — created during /gsd:execute-phase 10 wave 3.*
