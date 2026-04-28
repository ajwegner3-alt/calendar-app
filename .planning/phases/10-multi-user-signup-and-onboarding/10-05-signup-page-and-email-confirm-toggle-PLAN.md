---
phase: 10
plan: 05
type: execute
name: "signup-page-and-email-confirm-toggle"
wave: 3
depends_on: ["10-02", "10-03", "10-04"]
files_modified:
  - "app/(auth)/app/signup/page.tsx"
  - "app/(auth)/app/signup/signup-form.tsx"
  - "app/(auth)/app/signup/actions.ts"
  - "app/(auth)/app/signup/schema.ts"
  - "app/(auth)/app/login/actions.ts"
  - "app/(auth)/app/login/login-form.tsx"
  - "app/(auth)/app/forgot-password/actions.ts"
  - "app/auth/reset-password/actions.ts"
  - "lib/auth/rate-limits.ts"
  - "scripts/phase10-pre-flight-andrew-email-confirmed.sql"
  - "scripts/README.md"
autonomous: false
must_haves:
  truths:
    - "P-A8 pre-flight executed: Andrew's auth.users row has email_confirmed_at IS NOT NULL BEFORE the email-confirm toggle is flipped"
    - "Supabase email-confirm toggle is ON; Allowed-Redirects whitelist includes prod + Vercel preview wildcard pattern"
    - "/signup form accepts email + password only (no display_name/slug/timezone) per CONTEXT.md"
    - "Signup form returns generic 'If your email is registered, you'll receive a verification link' regardless of whether email is registered (P-A1)"
    - "Successful signup redirects to /app/verify-email?email={email}"
    - "Signup, login, password-reset endpoints rate-limited per IP via existing rate_limit_events table (signup 5/hr per IP, login 10/5min per IP, reset 3/hr per IP+email)"
    - "Welcome email sends post-wizard-completion (the actual welcome send is in 10-06; this plan defines the helper)"
  artifacts:
    - path: "app/(auth)/app/signup/actions.ts"
      provides: "signUpAction Server Action with rate-limit + Turnstile + quota guard + Supabase signUp"
      exports: ["signUpAction"]
    - path: "lib/auth/rate-limits.ts"
      provides: "Centralized AUTH rate-limit thresholds and helper for /api/auth/* + auth Server Actions"
      exports: ["AUTH_RATE_LIMITS", "checkAuthRateLimit"]
    - path: "scripts/phase10-pre-flight-andrew-email-confirmed.sql"
      provides: "P-A8 pre-flight SQL — verify and conditionally backfill email_confirmed_at for Andrew"
  key_links:
    - from: "app/(auth)/app/signup/actions.ts"
      to: "lib/email-sender/quota-guard.ts (checkAndConsumeQuota('signup-verify'))"
      via: "called BEFORE supabase.auth.signUp() to fail-closed at cap"
    - from: "app/(auth)/app/signup/actions.ts"
      to: "supabase.auth.signUp({ email, password, options.emailRedirectTo: ${origin}/auth/confirm?next=/onboarding })"
      via: "redirectTo points to the Plan 10-02 /auth/confirm handler"
    - from: "All /api/auth/* + auth actions"
      to: "lib/rate-limit.ts (Postgres rate_limit_events)"
      via: "checkAuthRateLimit helper from lib/auth/rate-limits.ts"
  requirements:
    - "AUTH-05 (public /signup creates auth.users row, email + password only)"
    - "AUTH-06 (email-enumeration-safe — generic messaging)"
    - "AUTH-07 (hard email-verify gate)"
    - "AUTH-10 (Andrew continues to log in post-toggle — P-A8 pre-flight)"
    - "AUTH-11 (rate limits on /api/auth/*)"
    - "ONBOARD-08 (welcome email helper defined; wizard in 10-06 calls it)"
---

## Objective

Ship the public `/signup` page (email + password only). Run the P-A8 pre-flight on Andrew's `email_confirmed_at` BEFORE flipping the Supabase email-confirm toggle (Andrew lockout prevention). Centralize auth rate-limit thresholds and apply them to signup, login, and password-reset paths. Wire the quota guard from 10-04 into the signup Server Action.

This plan is **autonomous: false** — it requires Andrew to perform 3 manual Supabase Dashboard tasks (run pre-flight SQL, flip email-confirm toggle, configure Allowed-Redirects). The pre-flight task is structured as a CHECKPOINT.

## Context

**Locked decisions (CONTEXT.md):**
- Form fields: email + password ONLY. Display name, slug, timezone, first event type are wizard.
- Generic messaging: "If your email is registered, you'll receive a verification link..."
- Password policy: 8-char minimum (Claude's Discretion).
- Post-submit destination: `/app/verify-email?email={email}` (page from 10-02).

**Locked decisions (STATE.md / CONTEXT.md):**
- Signup → trigger creates accounts STUB row → wizard updates it (10-03 + 10-06).
- Multi-user signup ships free (no Stripe).

**Andrew's identifiers (P-A8 pre-flight):**
- email: `ajwegner3@gmail.com`
- user_id: `1a8c687f-73fd-4085-934f-592891f51784`
- accounts.id: `ba8e712d-28b7-4071-b3d4-361fb6fb7a60`

## Tasks

<task id="1" type="checkpoint:human-action" gate="blocking">
  <name>P-A8 pre-flight: verify Andrew's email_confirmed_at + flip Supabase email-confirm toggle</name>
  <description>
    **Pre-condition (must be true before starting this checkpoint):** Plans 10-02, 10-03, and 10-04 must be deployed to Vercel production. The `/auth/confirm` route (10-02) must exist live, the accounts trigger and onboarding columns (10-03) must be applied to production Supabase, and the email_send_log table + quota guard (10-04) must be applied. **Verify by hitting `https://<prod-domain>/auth/confirm?token_hash=test&type=signup` and confirming a 4xx response (NOT 404).** A 404 means the route isn't deployed yet — STOP and wait until 10-02 is in production before flipping any Supabase Dashboard settings. Flipping the email-confirm toggle while `/auth/confirm` 404s would break Andrew's next login attempt and break verification links for any signup that races the deploy.

    Three manual Supabase Dashboard / SQL Editor steps. Order matters — run in sequence.

    **Pre-flight SQL file:** `scripts/phase10-pre-flight-andrew-email-confirmed.sql` (created in this task by Claude before the human action):
    ```sql
    -- Phase 10 P-A8 pre-flight: ensure Andrew's auth user is email-confirmed
    -- BEFORE flipping the Supabase email-confirm toggle. If email_confirmed_at
    -- is NULL after the toggle flip, Andrew gets locked out of production.

    -- Step A: SELECT — observe current state.
    select id, email, email_confirmed_at, created_at
    from auth.users
    where email = 'ajwegner3@gmail.com';

    -- Expected: email_confirmed_at is NOT NULL (v1.0 created via auth.admin.createUser({ email_confirm: true })).

    -- Step B (CONDITIONAL): if Step A returned NULL email_confirmed_at, run:
    -- update auth.users
    -- set email_confirmed_at = now()
    -- where email = 'ajwegner3@gmail.com';
    -- (Commented out by default. Uncomment ONLY if Step A showed null.)

    -- Step C: Re-SELECT to confirm.
    select email, email_confirmed_at
    from auth.users
    where email = 'ajwegner3@gmail.com';

    -- Expected: email_confirmed_at is now NOT NULL.
    ```

    **Manual checklist for Andrew:**
    1. Run the pre-flight SQL via Supabase Studio SQL Editor or `npx supabase db query --linked -f scripts/phase10-pre-flight-andrew-email-confirmed.sql`. Confirm `email_confirmed_at` is NOT NULL. If it IS null, uncomment Step B's UPDATE, re-run, then re-run Step C to verify.
    2. **Supabase Dashboard → Authentication → Sign In / Up settings → "Enable email confirmations"**: turn ON.
    3. **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**: ensure the following are listed:
       - `http://localhost:3000/auth/confirm` (dev)
       - `https://calendar-app-andrew-wegners-projects.vercel.app/auth/confirm` (or whatever the production Vercel URL is)
       - `https://calendar-app-*.vercel.app/auth/confirm` (Vercel preview wildcard — confirm Supabase accepts wildcards in this field; if not, enumerate the active preview URLs)
       - Plus the same paths with `?next=/onboarding` should not be needed (Supabase matches on the base path — verify in dashboard docs).
    4. **Supabase Dashboard → Authentication → Email Templates → "Confirm signup"** template: change the action URL from the default `{{ .ConfirmationURL }}` (which uses the legacy /auth/callback flow) to the modern token-hash flow:
       - Set the **Action URL** to: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding`
       - Same change for **"Reset Password"**: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
       - Same change for **"Magic Link"** and **"Confirm Email Change"**: use respective types `magiclink` and `email_change`.
    5. After all 4 steps, log in to /app/login as Andrew (production URL) — confirm login still works post-toggle.

    **Resume signal:** "P-A8 verified" + Andrew confirms login still works.
  </description>
  <files>scripts/phase10-pre-flight-andrew-email-confirmed.sql (Claude creates this file)</files>
  <verification>
    Andrew confirms in chat: (a) Step A SELECT returned non-null email_confirmed_at, (b) email-confirm toggle is ON in Supabase Dashboard, (c) Allowed-Redirects whitelist includes the 3 entries above, (d) email-templates updated to /auth/confirm + token_hash + type pattern, (e) Andrew can still log in to /app/login.
  </verification>
</task>

<task id="2" type="auto">
  <description>
    Centralize auth rate-limit thresholds + helper.

    Create `lib/auth/rate-limits.ts`:
    ```ts
    import "server-only";
    import { checkRateLimit } from "@/lib/rate-limit";

    /**
     * Per-route auth rate limits (per CONTEXT.md Claude's Discretion).
     * All counts are per IP (or per IP+email where indicated).
     * Re-uses the v1.0 rate_limit_events Postgres table.
     */
    export const AUTH_RATE_LIMITS = {
      signup:        { max: 5,  windowMs: 60 * 60 * 1000 },          // 5 / hour / IP
      login:         { max: 10, windowMs: 5  * 60 * 1000 },          // 10 / 5 min / IP
      forgotPassword:{ max: 3,  windowMs: 60 * 60 * 1000 },          // 3 / hour / (IP+email)
      resetPassword: { max: 5,  windowMs: 60 * 60 * 1000 },          // 5 / hour / IP
      resendVerify:  { max: 5,  windowMs: 60 * 60 * 1000 },          // 5 / hour / (IP+email); plus 1/min in 10-02
      emailChange:   { max: 3,  windowMs: 60 * 60 * 1000 },          // 3 / hour / `${ip}:${uid}`
                                                                     // (uid is fine — user is authenticated; keying on uid prevents
                                                                     //  cross-device bypass while tolerating shared IPs e.g. office NAT)
    } as const;

    type AuthRouteKey = keyof typeof AUTH_RATE_LIMITS;

    export async function checkAuthRateLimit(
      route: AuthRouteKey,
      identifier: string, // ip or `${ip}:${email}` per route
    ) {
      const cfg = AUTH_RATE_LIMITS[route];
      return checkRateLimit(`auth:${route}:${identifier}`, cfg.max, cfg.windowMs);
    }
    ```

    Then update existing `app/(auth)/app/login/actions.ts` to call `await checkAuthRateLimit("login", ip)` BEFORE `signInWithPassword`. The IP comes from the request headers (use `headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"` — there should already be a v1.0 helper at `lib/utils.ts` or similar; if not, inline the helper here).

    Apply the same pattern to:
    - `app/(auth)/app/forgot-password/actions.ts` (created in 10-02): use `checkAuthRateLimit("forgotPassword", \`${ip}:${email}\`)`.
    - `app/auth/reset-password/actions.ts` (created in 10-02): use `checkAuthRateLimit("resetPassword", ip)`.

    NB: 10-02 already added per-action rate limits inline; this task replaces those with calls to the centralized helper. Net effect: rate limit thresholds become editable in ONE file.
  </description>
  <files>
    lib/auth/rate-limits.ts (new)
    app/(auth)/app/login/actions.ts (modify — add rate-limit call)
    app/(auth)/app/forgot-password/actions.ts (modify — replace inline rate limit with helper call)
    app/auth/reset-password/actions.ts (modify — add helper call)
  </files>
  <verification>
    `npx tsc --noEmit` clean.
    **Login burst test (does NOT depend on Task 1's email-confirm toggle being flipped — the login rate limit is purely a wrapper around `signInWithPassword` and works against any account regardless of the toggle):** 11 login attempts within 5 min from same IP → 11th returns rate-limit message. Run this verification AS SOON as the rate-limit helper is wired into `app/(auth)/app/login/actions.ts`; do not wait for Andrew to complete the P-A8 checkpoint.
    Signup burst test (does require Task 3 — signup endpoint must exist): 6 signup attempts within 1 hour from same IP → 6th returns rate-limit message.
    `npm test` passes.
  </verification>
</task>

<task id="3" type="auto">
  <description>
    Build `/signup` page + Server Action.

    **Path:** `/app/signup` (lives in `(auth)/app/signup/`, mirrors login route group structure).

    Files:
    - `app/(auth)/app/signup/schema.ts`:
      ```ts
      import { z } from "zod";
      export const signupSchema = z.object({
        email: z.string().email().max(254),
        password: z.string().min(8).max(72),
      });
      export type SignupInput = z.infer<typeof signupSchema>;
      ```
    - `app/(auth)/app/signup/actions.ts` — Server Action `signUpAction(prev, formData)`:
      ```ts
      "use server";
      import { headers } from "next/headers";
      import { redirect } from "next/navigation";
      import { createClient } from "@/lib/supabase/server";
      import { checkAuthRateLimit } from "@/lib/auth/rate-limits";
      import { checkAndConsumeQuota, QuotaExceededError } from "@/lib/email-sender/quota-guard";
      import { signupSchema } from "./schema";

      export type SignupState = {
        fieldErrors?: { email?: string[]; password?: string[] };
        formError?: string;
        // For the inline post-submit notice:
        successMessage?: string;
        successEmail?: string;
      };

      export async function signUpAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
        const parsed = signupSchema.safeParse({
          email: formData.get("email"),
          password: formData.get("password"),
        });
        if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

        const h = await headers();
        const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        const origin = h.get("origin") ?? h.get("referer")?.replace(/\/[^/]*$/, "") ?? "";

        // 1. Rate limit per IP.
        const rl = await checkAuthRateLimit("signup", ip);
        if (!rl.allowed) {
          return { formError: "Too many signup attempts. Please wait an hour and try again." };
        }

        // 2. Gmail SMTP quota guard. Fail-closed at cap.
        try {
          await checkAndConsumeQuota("signup-verify");
        } catch (e) {
          if (e instanceof QuotaExceededError) {
            return { formError: "Signup is temporarily unavailable. Please try again tomorrow." };
          }
          // Unexpected — log and continue (fail-open per quota-guard contract).
        }

        // 3. Supabase signup. emailRedirectTo points to /auth/confirm with next=/onboarding.
        const supabase = await createClient();
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${origin}/auth/confirm?next=/onboarding` },
        });

        // 4. Generic response — never distinguish "already registered" from "new user" (P-A1).
        if (error) {
          // Specific handling for cap/abuse signals from Supabase Auth itself.
          if (error.status === 429) {
            return { formError: "Too many attempts. Please wait and try again." };
          }
          // For "User already registered" or any other duplicate-signal error,
          // log server-side but return the SAME success message. Constant-time delay
          // is a future improvement (P-A1 prevention notes).
          console.error("[signup] Supabase signUp error (returning generic to client):", error);
        }

        // 5. Redirect to verify-email page.
        redirect(`/app/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
      }
      ```
    - `app/(auth)/app/signup/signup-form.tsx` — `'use client'` RHF + useActionState component. Email + password fields. Inline form-level error display. "Already have an account? Log in" link to `/app/login`. "Forgot password? Reset it" link to `/app/forgot-password`.
    - `app/(auth)/app/signup/page.tsx` — Server Component shell that renders `<SignupForm />`. Phase 12 owns the visual restyle (UI-12).

    Additionally: update `app/(auth)/app/login/login-form.tsx` to add a "Don't have an account? Sign up" link to `/app/signup`.
  </description>
  <files>
    app/(auth)/app/signup/schema.ts (new)
    app/(auth)/app/signup/actions.ts (new)
    app/(auth)/app/signup/signup-form.tsx (new)
    app/(auth)/app/signup/page.tsx (new)
    app/(auth)/app/login/login-form.tsx (modify — add signup link)
  </files>
  <verification>
    Visit `/app/signup` — form renders.
    Submit valid new email + 8+ char password → redirected to `/app/verify-email?email=...`.
    Submit Andrew's email — same redirect (no leak; check server log shows the duplicate-signal error).
    Submit 6 times in an hour → 6th returns rate-limit message.
    `npx tsc --noEmit` clean.
    `npm test` passes.
  </verification>
</task>

## Verification Criteria

- Pre-flight task confirmed by Andrew (P-A8 closed).
- `/app/signup`, `/app/login`, `/app/forgot-password`, `/auth/reset-password`, `/auth/confirm`, `/app/verify-email` all functional with rate limits applied.
- `lib/auth/rate-limits.ts` is the single source of truth for AUTH thresholds.
- Signup → email arrives → click link → `/auth/confirm` → redirected to `/onboarding` (Plan 10-06 catches it). For now (10-06 not built yet), the redirect goes to `/onboarding` which 404s — that's expected; 10-06 ships next.
- `npx tsc --noEmit` clean. `npm test` passes.

## must_haves

- **AUTH-05** — public `/signup` creates `auth.users` row.
- **AUTH-06** — email-enumeration-safe (generic messaging on duplicate).
- **AUTH-07** — hard email-verify gate (Supabase toggle ON).
- **AUTH-10** — Andrew continues to log in (P-A8 pre-flight executed BEFORE toggle flip).
- **AUTH-11** — rate limits on /api/auth/* equivalents (login, signup, forgot-password, reset-password, resend-verify).
- **ONBOARD-08 (helper)** — quota-guarded welcome email helper available; actual welcome send is in 10-06 wizard completion.
