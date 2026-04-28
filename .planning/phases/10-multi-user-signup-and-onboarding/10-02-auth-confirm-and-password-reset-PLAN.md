---
phase: 10
plan: 02
type: execute
name: "auth-confirm-and-password-reset"
wave: 2
depends_on: ["10-01"]
files_modified:
  - "app/auth/confirm/route.ts"
  - "app/(auth)/app/forgot-password/page.tsx"
  - "app/(auth)/app/forgot-password/forgot-password-form.tsx"
  - "app/(auth)/app/forgot-password/actions.ts"
  - "app/(auth)/app/forgot-password/schema.ts"
  - "app/auth/reset-password/page.tsx"
  - "app/auth/reset-password/reset-password-form.tsx"
  - "app/auth/reset-password/actions.ts"
  - "app/auth/reset-password/schema.ts"
  - "app/auth/auth-error/page.tsx"
  - "app/(auth)/app/verify-email/page.tsx"
  - "app/(auth)/app/verify-email/resend-verification-button.tsx"
  - "app/(auth)/app/verify-email/actions.ts"
autonomous: true
must_haves:
  truths:
    - "A signup confirmation link routes through /auth/confirm and lands the user authenticated on /app (or /onboarding if no accounts row)"
    - "A password-reset link from email routes through /auth/confirm with type=recovery and lands on /auth/reset-password with an active session"
    - "An expired or invalid token-hash routes to /auth/auth-error with a Resend Verification CTA"
    - "User can request a password reset at /forgot-password with generic 'If an account exists...' messaging"
    - "User can set a new password at /auth/reset-password (only reachable while authenticated via recovery flow)"
    - "Verify-email page shows 'Check your inbox at {email}' with a resend button (rate-limited 1/min, 5/hour)"
  artifacts:
    - path: "app/auth/confirm/route.ts"
      provides: "GET handler that calls supabase.auth.verifyOtp({ type, token_hash }) and redirects on success/failure"
      exports: ["GET"]
    - path: "app/(auth)/app/forgot-password/page.tsx"
      provides: "Form to request password reset email (does not leak email existence)"
    - path: "app/auth/reset-password/page.tsx"
      provides: "New-password form, only reachable post-recovery-verifyOtp"
    - path: "app/(auth)/app/verify-email/page.tsx"
      provides: "Post-signup waiting page with resend button"
    - path: "app/auth/auth-error/page.tsx"
      provides: "Generic auth error page with resend-verification CTA"
  key_links:
    - from: "app/auth/confirm/route.ts"
      to: "supabase.auth.verifyOtp"
      via: "type + token_hash from query string (GET handler)"
      pattern: "verifyOtp\\(\\{\\s*type"
    - from: "app/(auth)/app/forgot-password/actions.ts"
      to: "supabase.auth.resetPasswordForEmail"
      via: "Server Action; redirects to /auth/confirm via emailRedirectTo"
    - from: "app/(auth)/app/verify-email/actions.ts"
      to: "rate_limit_events table"
      via: "checkRateLimit('resend-verify:{ip}|{email}', 5, 60min) and ('resend-verify:{ip}|{email}', 1, 60s)"
  requirements:
    - "AUTH-08 (/auth/confirm verifyOtp pattern — signup, recovery, future magic-link/email-change)"
    - "AUTH-09 (/forgot-password + /auth/reset-password)"
    - "Closes v1.0 BLOCKER: /auth/callback 404"
---

## Objective

Build the canonical `/auth/confirm` Route Handler using the modern `verifyOtp({ type, token_hash })` pattern (NOT the legacy `exchangeCodeForSession`). Wire `/forgot-password` and `/auth/reset-password` flows through it. Add a `/auth/verify-email` waiting page with a rate-limited resend button. Add a `/auth/auth-error` page for expired/invalid tokens. This plan closes the v1.0 BLOCKER (the missing `/auth/callback`) and provides the auth foundation that 10-05 (signup) and 10-08 (email-change) consume.

## Context

**Locked decisions:**
- AUTH-08 specifies `verifyOtp` pattern, not `exchangeCodeForSession` (SUMMARY.md §Architecture #2; PITFALLS.md P-A4).
- CONTEXT.md: dedicated `/auth/verify-email` page (not just a toast) with resend button.
- CONTEXT.md (Claude's Discretion): expired/invalid token UX = dedicated error page + resend action. Resend rate limit = 1/min + 5/hour per email+IP.
- CONTEXT.md: generic "If your email is registered..." messaging on `/forgot-password` submit (mirrors P-A1 enumeration prevention).

**v1.0 patterns to reuse:**
- `lib/supabase/server.ts` — `createClient()` (async; awaits cookies()).
- `lib/rate-limit.ts` — `checkRateLimit(key, maxRequests, windowMs)` (Postgres-backed, fails OPEN).
- `app/(auth)/app/login/actions.ts` — Server Action shape for the auth route group.
- `app/(auth)/app/login/login-form.tsx` — RHF + useActionState pattern.

**Supabase pattern (verifyOtp):**
```ts
// app/auth/confirm/route.ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/auth/auth-error?reason=missing_params", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/auth-error?reason=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  // For type=recovery, server-side guidance is to redirect to a password update page
  // even if `next` is set (recovery sessions are scoped to password update only).
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/auth/reset-password", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
```

The `next` query parameter lets us route signup-confirm to `/app` (which Plan 10-07 will redirect to `/onboarding` if no accounts row exists). For `recovery`, force the redirect to `/auth/reset-password` regardless of `next`.

## Tasks

<task id="1" type="auto">
  <description>
    Create `app/auth/confirm/route.ts` Route Handler implementing the verifyOtp pattern above. Handle:
    - Missing `token_hash` or `type` → redirect to `/auth/auth-error?reason=missing_params`.
    - verifyOtp error → redirect to `/auth/auth-error?reason={error.message}` (URL-encoded).
    - `type === "recovery"` → redirect to `/auth/reset-password` (override `next`).
    - Otherwise → redirect to `next` (default `/app`).

    Create `app/auth/auth-error/page.tsx` — a Server Component that reads the `reason` query param, renders a friendly headline ("That link didn't work" / "That link has expired"), and embeds a "Resend verification email" form (delegates to the existing resend Server Action from Task 4 — see below). Until 10-05 ships /signup, the resend form can pre-fill from a query param `?email=...` if present; otherwise show a small email input.

    Both files must NOT import from `lib/supabase/admin.ts` — the GET handler uses the RLS-scoped `createClient()` only.
  </description>
  <files>
    app/auth/confirm/route.ts (new)
    app/auth/auth-error/page.tsx (new)
  </files>
  <verification>
    `npx tsc --noEmit` clean.
    Manual: `curl -i "http://localhost:3000/auth/confirm"` returns 307 to `/auth/auth-error?reason=missing_params`.
    Visit `/auth/auth-error?reason=otp_expired` — page renders with the friendly headline and a resend form.
  </verification>
</task>

<task id="2" type="auto">
  <description>
    Build `/forgot-password` page + Server Action.

    Files:
    - `app/(auth)/app/forgot-password/schema.ts` — Zod schema: `email: z.string().email()`.
    - `app/(auth)/app/forgot-password/actions.ts` — Server Action `requestPasswordReset(prev, formData)`:
      - Zod validate.
      - Rate limit: `checkRateLimit('forgot-password:' + ip, 3, 60 * 60 * 1000)` (3/hour per IP). If !allowed → return `{ formError: "Too many attempts. Please wait." }`.
      - Call `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${origin}/auth/confirm?next=/auth/reset-password\` })`.
      - **Always** return `{ success: true, message: "If an account exists for that email, we've sent a reset link." }` regardless of whether the email is registered (P-A1 enumeration prevention).
      - DO NOT throw on Supabase errors that would leak existence; log them server-side and still return the generic success message.
    - `app/(auth)/app/forgot-password/forgot-password-form.tsx` — `'use client'` RHF + useActionState component. After submit, render the generic success message inline (no redirect).
    - `app/(auth)/app/forgot-password/page.tsx` — Server Component shell that renders the form. Add a "Back to login" link.

    Note: file lives in the existing `(auth)/app/` route group so it inherits the auth-layout (no shell, no sidebar). The path served is `/app/forgot-password`. UI-12 (Phase 12) restyles all auth pages — Phase 10 ships unstyled-but-functional.
  </description>
  <files>
    app/(auth)/app/forgot-password/schema.ts (new)
    app/(auth)/app/forgot-password/actions.ts (new)
    app/(auth)/app/forgot-password/forgot-password-form.tsx (new)
    app/(auth)/app/forgot-password/page.tsx (new)
  </files>
  <verification>
    Visit `/app/forgot-password` — form renders.
    Submit with random@example.com — get generic success message; check Supabase Auth logs to confirm resetPasswordForEmail was called.
    Burst 4 requests within an hour from same IP → 4th returns "Too many attempts" message.
  </verification>
</task>

<task id="3" type="auto">
  <description>
    Build `/auth/reset-password` page + Server Action.

    Files:
    - `app/auth/reset-password/schema.ts` — `password: z.string().min(8)`. (Password policy decision per CONTEXT.md Claude's Discretion: 8-char minimum, no character-class requirements; Supabase enforces basics.)
    - `app/auth/reset-password/actions.ts` — Server Action `resetPasswordAction(prev, formData)`:
      - Zod validate.
      - `const supabase = await createClient(); const { data: claims } = await supabase.auth.getClaims();` — if no session, return `{ formError: "Reset link expired. Request a new one." }`. The `/auth/confirm` recovery flow established the session before redirecting here; absence of session means user got here without going through the email link.
      - `await supabase.auth.updateUser({ password })` — surface `error.message` as formError on failure.
      - On success: `revalidatePath("/", "layout"); redirect("/app/login?reset=success");`.
    - `app/auth/reset-password/reset-password-form.tsx` — `'use client'` RHF + useActionState. Two fields: `password`, `confirmPassword` (Zod refine to match).
    - `app/auth/reset-password/page.tsx` — Server Component. Pre-check session via `getClaims()`; if no session, render an "Expired link" placeholder with a "Request a new reset email" link to `/app/forgot-password` instead of the form.

    Lives at `/auth/reset-password` (NOT in the (auth) route group) because the verifyOtp recovery handler in 10-02 Task 1 forwards here. The path is what Supabase email templates link to.

    Update `app/(auth)/app/login/page.tsx` (or its form) to read `?reset=success` and surface a "Password updated. Please log in." inline notice (additive — keep existing behavior).
  </description>
  <files>
    app/auth/reset-password/schema.ts (new)
    app/auth/reset-password/actions.ts (new)
    app/auth/reset-password/reset-password-form.tsx (new)
    app/auth/reset-password/page.tsx (new)
    app/(auth)/app/login/login-form.tsx (read-only ?reset=success notice; additive)
  </files>
  <verification>
    `npx tsc --noEmit` clean.
    Manual end-to-end (after 10-05 wires Supabase email templates): /forgot-password → check email → click link → /auth/confirm → /auth/reset-password (form visible) → submit → /app/login?reset=success (success banner visible).
    Visit `/auth/reset-password` directly with no session → "Expired link" view.
  </verification>
</task>

<task id="4" type="auto">
  <description>
    Build `/auth/verify-email` page + resend Server Action.

    Files:
    - `app/(auth)/app/verify-email/page.tsx` — Server Component. Reads `?email={email}` query param. Renders: "Check your inbox at {email} — click the link to continue." Includes the resend button (Client Component below) and a "Use a different email" link to `/signup` (will resolve in 10-05).
    - `app/(auth)/app/verify-email/actions.ts` — Server Action `resendVerification(prev, formData)`:
      - Zod validate `email`.
      - **Two rate limits, both must allow** (CONTEXT.md Claude's Discretion):
        - `checkRateLimit('resend-verify-min:' + email + ':' + ip, 1, 60 * 1000)` (1/min)
        - `checkRateLimit('resend-verify-hour:' + email + ':' + ip, 5, 60 * 60 * 1000)` (5/hour)
      - If either denies → return `{ formError: "Please wait before requesting another verification email." }`.
      - Call `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: \`${origin}/auth/confirm?next=/app\` } })`.
      - Generic success: `{ success: true, message: "Verification email sent. Check your inbox." }` regardless of outcome (P-A1).
    - `app/(auth)/app/verify-email/resend-verification-button.tsx` — `'use client'` button using useActionState. Disabled state for 60s after click (frontend-side echo of the per-min rate limit).

    The same Server Action is reused by `/auth/auth-error` (Task 1) so users hitting an expired token can recover from the same surface.
  </description>
  <files>
    app/(auth)/app/verify-email/page.tsx (new)
    app/(auth)/app/verify-email/actions.ts (new)
    app/(auth)/app/verify-email/resend-verification-button.tsx (new)
  </files>
  <verification>
    Visit `/app/verify-email?email=test@example.com` — page renders with email shown and resend button.
    Click resend twice within 60s → 2nd click returns rate-limit message.
    `npm test` passes (no regressions; new tests not required at this stage — covered by 10-09 matrix tests + Phase 13 manual QA).
    `npx tsc --noEmit` clean.
  </verification>
</task>

## Verification Criteria

- All 4 routes exist and load without errors: `/auth/confirm`, `/auth/auth-error`, `/app/forgot-password`, `/auth/reset-password`, `/app/verify-email`.
- `npx tsc --noEmit` clean.
- `npm run lint` clean.
- Existing v1.0 tests continue to pass (`npm test`).
- `git grep "exchangeCodeForSession"` returns ZERO matches in `app/auth/` — only verifyOtp is used.
- Manual smoke: forgot-password flow end-to-end works against the dev Supabase instance (the email template config in 10-05 unlocks signup-confirm; recovery flow can be tested NOW because Supabase resetPasswordForEmail uses default templates that point at `redirectTo`).

## must_haves

- AUTH-08 — `/auth/confirm` Route Handler with `verifyOtp` pattern handling signup, password recovery, and prepared for magic-link/email-change types.
- AUTH-09 — `/forgot-password` + `/auth/reset-password` flow.
- Closes v1.0 BLOCKER: `/auth/callback` 404 (now `/auth/confirm` is the canonical handler).
