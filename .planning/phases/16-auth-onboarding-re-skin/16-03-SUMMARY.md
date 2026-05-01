---
phase: 16
plan: 03
subsystem: auth-ui
tags: [auth, re-skin, header-pill, background-glow, account-deleted, short-auth-pages]
requires: ["16-01"]
provides:
  - "5 short auth pages re-skinned onto unified NSI shell"
  - "account-deleted page upgraded from bare → full NSI shell with styled Button"
  - "AUTH-13 (header pill) satisfied across all short auth surfaces"
  - "AUTH-14 (account-deleted re-skin) satisfied"
  - "AUTH-16 (rounded-xl card surface) satisfied"
affects: ["16-04 onboarding re-skin", "future auth flow additions"]
tech-stack:
  added: []
  patterns:
    - "Shared single-column auth shell: bg-gray-50 + BackgroundGlow + Header(variant='auth') + max-w-md card with rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    - "Server Component shell wrapping conditional client-island content (e.g., reset-password's hasSession ternary inside the same card)"
    - "<Button asChild><Link>...</Link></Button> for styled navigation buttons (replaces bare anchor pattern)"
key-files:
  created: []
  modified:
    - "app/(auth)/app/forgot-password/page.tsx"
    - "app/(auth)/app/verify-email/page.tsx"
    - "app/auth/reset-password/page.tsx"
    - "app/auth/auth-error/page.tsx"
    - "app/account-deleted/page.tsx"
decisions:
  - "Used rounded-xl (12px) on auth card surfaces per RESEARCH.md section 7 (AUTH-16 governs auth surfaces; Phase 15's rounded-lg lock applied only to owner shell cards)"
  - "Did not pass rightLabel to Header — wordmark-only default per CONTEXT.md is correct for short auth pages"
  - "Shell wraps the conditional on reset-password (not the other way around) — same card contains either ResetPasswordForm or expired-link fallback"
  - "Used <Button asChild> on account-deleted to get NSI-blue styled Button while preserving Next.js Link navigation (replaces bare text-blue-600 underline anchor per AUTH-14)"
metrics:
  duration: "~1 session"
  completed: "2026-04-30"
---

# Phase 16 Plan 03: Short Auth Pages Re-skin Summary

Re-skinned 5 single-column auth pages (forgot-password, verify-email, reset-password, auth-error, account-deleted) onto the unified NSI shell pattern: gray-50 page background + BackgroundGlow ambient backdrop + glass Header pill + centered white card (rounded-xl, max-w-md). All Server Component functional logic (auth checks, searchParams parsing, Server Action prop bindings) preserved verbatim on the 4 functional pages. account-deleted upgraded from a bare unstyled page into a fully NSI-themed surface with a styled Button replacing the bare anchor link.

## Files Modified (5)

| File | Change |
| ---- | ------ |
| `app/(auth)/app/forgot-password/page.tsx` | Wrapped existing `<ForgotPasswordForm />` invocation in shared shell |
| `app/(auth)/app/verify-email/page.tsx` | Wrapped existing `<ResendVerificationButton action={resendVerification} initialEmail={email} />` and body copy in shared shell; preserved `await searchParams` + email extraction |
| `app/auth/reset-password/page.tsx` | Wrapped `createClient()` + `getClaims()` + `hasSession` ternary (ResetPasswordForm OR expired-link fallback) inside shared shell card |
| `app/auth/auth-error/page.tsx` | Wrapped existing headline/body derivation + `<ResendVerificationButton>` in shared shell; preserved `searchParams.reason`, `searchParams.email`, `isExpired` |
| `app/account-deleted/page.tsx` | Full re-skin from bare → NSI shell. Added Header, BackgroundGlow, styled `<Button asChild><Link>` replacing bare `<a className="text-blue-600 underline">`. Preserved existing body copy verbatim. |

## Shared Shell Template Applied

```tsx
<div className="relative min-h-screen overflow-hidden bg-gray-50">
  <BackgroundGlow />
  <Header variant="auth" />
  <main className="relative z-10 mx-auto w-full max-w-md px-4 pt-20 md:pt-24 pb-12">
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      {/* page-specific content */}
    </div>
  </main>
</div>
```

## account-deleted: Bare → Full NSI Shell

**Before:** Bare page with no styling, no Header, no glow, no card wrapper. Used a bare `<a className="text-blue-600 underline">` for the back-to-login link.

**After:**
- Full shared shell (Header pill + BackgroundGlow + bg-gray-50 + rounded-xl card)
- `<Button asChild>` wrapping `<Link href="/app/login">Back to log in</Link>` — uses NSI-blue `--primary` token
- "Account deleted" heading and existing body copy preserved verbatim
- AUTH-14 fully satisfied

## Functional Preservation (4 functional pages)

All Server Component logic preserved byte-for-byte:
- **forgot-password:** `<ForgotPasswordForm />` client island invocation intact
- **verify-email:** `await searchParams`, `email` extraction, `<ResendVerificationButton action={resendVerification} initialEmail={email} />` with both props bound
- **reset-password:** `createClient()`, `getClaims()`, `hasSession` branching — both branches render inside the same shell card
- **auth-error:** `await searchParams`, `reason`/`email` parsing, `isExpired` computation, headline/body derivation, ResendVerificationButton invocation

Zero `lg:grid-cols-2` (split-panel) and zero `NSIGradientBackdrop` references remain across the 5 files.

## Visual + Functional Gate

**Approved by Andrew on live Vercel preview — 2026-04-30**

Verified on live preview URL across all 5 surfaces:
1. `/app/forgot-password` — bg-gray-50 page, blue glow, glass pill at top, white rounded-xl card; form submission flow works
2. `/app/verify-email?email=test@example.com` — same shell visuals; resend button functional with cooldown
3. `/auth/reset-password` (logged out) — same shell visuals; expired-link fallback renders correctly inside card
4. `/auth/auth-error?reason=otp_expired` — same shell visuals; headline + body + resend form present
5. `/account-deleted` — same shell visuals; styled Button (not bare anchor) navigates to /app/login

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | `95fc26d` | refactor(16-03): re-skin 4 functional short auth pages onto NSI shell |
| 2 | `a765f2a` | refactor(16-03): re-skin account-deleted page from bare to full NSI shell |

## Requirements Satisfied

- **AUTH-13 (remainder):** Header pill now renders at top of all 5 short auth pages — completes pill coverage across all 7 auth surfaces (combined with 16-02's login/signup work)
- **AUTH-14:** account-deleted page has full NSI shell — Header + BackgroundGlow + styled Button + rounded-xl card wrapper
- **AUTH-15 (functional preservation):** Zero functional regressions on the 4 functional pages — all Server Component logic, searchParams parsing, Server Action prop bindings preserved verbatim
- **AUTH-16:** All 5 page-level cards use `rounded-xl border border-gray-200 bg-white p-6 shadow-sm` (12px corner radius per AUTH-16 spec for auth surfaces)
- **Roadmap success criterion #2:** Header pill now appears at top of ALL 7 auth pages (5 here + login/signup from 16-02)

ONBOARD-13/14/15 are not in scope for this plan — those are addressed in 16-04 (onboarding re-skin).

## Deviations from Plan

None — plan executed exactly as written. Both auto tasks completed cleanly; visual + functional gate approved on first review.

## Next Phase Readiness

- Combined with 16-02 (login/signup) and 16-04 (onboarding), this completes the full Phase 16 auth + onboarding visual unification
- No blockers introduced
- Pattern (shared shell + preserved client islands) is now established for any future auth surface additions
