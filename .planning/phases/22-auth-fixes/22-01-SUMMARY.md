---
phase: 22-auth-fixes
plan: 01
subsystem: middleware-auth
tags: [middleware, auth, routing, login, layout]
one-liner: "Widen middleware publicAuthPaths allow-list (AUTH-18) + swap login page AuthHero LEFT/form RIGHT (AUTH-19)"

dependency-graph:
  requires: []
  provides:
    - "Unauthenticated /app/signup, /app/forgot-password, /app/verify-email reachable without redirect"
    - "Login page desktop layout: AuthHero LEFT, form RIGHT"
  affects:
    - "22-02 (session TTL fix) — proxy.ts is the same file; keep allow-list intact"

tech-stack:
  added: []
  patterns:
    - "publicAuthPaths exact-match array for middleware exemptions (prefer .includes() over !== chaining)"

key-files:
  created: []
  modified:
    - lib/supabase/proxy.ts
    - app/(auth)/app/login/page.tsx

decisions:
  - id: AUTH-18-exact-match
    choice: "Use exact-match publicAuthPaths.includes(pathname) instead of pathname.startsWith()"
    rationale: "Prevents accidental future exemptions for routes that share a prefix (e.g., /app/signupthing)"
  - id: AUTH-19-lg-breakpoint
    choice: "Preserve lg: (1024px) breakpoint — do NOT change to md: (768px)"
    rationale: "ROADMAP says ≥768px but CONTEXT.md anchors to existing v1.2 auth skin which uses lg:. AuthHero is hidden lg:flex — changing breakpoint would be a v1.2 regression, not a fix."

metrics:
  duration: "~4 minutes"
  completed: "2026-05-02"
  tasks: 2/2
  commits: 2
---

# Phase 22 Plan 01: AUTH-18 Middleware Allow-List + AUTH-19 Login Column Swap Summary

Two surgical file edits, ~10 lines of changes total, fixing a broken signup-navigation flow and correcting the login page desktop split-panel layout.

## What Was Done

### Task 1 — AUTH-18: Widen middleware unauthenticated-route allow-list

**File:** `lib/supabase/proxy.ts`

Replaced the single-route exemption (`pathname !== "/app/login"`) with a `publicAuthPaths` array allowing four exact routes:

```ts
const publicAuthPaths = [
  "/app/login",
  "/app/signup",
  "/app/forgot-password",
  "/app/verify-email",
];
if (!user && pathname.startsWith("/app") && !publicAuthPaths.includes(pathname)) {
  // redirect to /app/login
}
```

**Root cause of AUTH-18:** The "Sign up" link on `/app/login` had a correct `href="/app/signup"` via Next.js `<Link>`, but the middleware intercepted unauthenticated visits to `/app/signup` and bounced them back to `/app/login` — an infinite loop visible to the user as the link "not working."

**Why these four paths:** `/app/login` (existing), `/app/signup` (AUTH-18 fix), `/app/forgot-password` (same class — no session when password forgotten), `/app/verify-email` (email confirm deep-links land here before a session exists).

**Commit:** `d564546`

---

### Task 2 — AUTH-19: Swap login page columns

**File:** `app/(auth)/app/login/page.tsx`

Moved `<AuthHero>` from second child to first child inside the `lg:grid-cols-2` div, and `<main>` from first to second. Updated inline comments to reflect new positions. No class changes.

Before: form LEFT / hero RIGHT
After: hero LEFT / form RIGHT

Mobile is unaffected — `AuthHero` is `hidden lg:flex` (defined in `app/(auth)/_components/auth-hero.tsx` line 24), so below 1024px it is absent from the DOM regardless of JSX order. The `lg:hidden` `<BackgroundGlow />` and outer wrapper remain unchanged.

**Commit:** `c972c8e`

---

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass — only pre-existing DEBT-02 errors in `tests/` (TS7006/TS2305), none in modified files |
| `npm run build` | Pass — all routes compile, no new errors |
| `npm run lint` | Pass — zero new errors in `lib/supabase/proxy.ts` or `app/(auth)/app/login/page.tsx` |
| `npm test` | Pass — 222 passing, 4 skipped (identical to v1.2 baseline, 26 test files) |
| Browser smoke (incognito) | Deferred to Andrew — dev server not started in this environment; visual gate is deploy-and-eyeball per project convention |

**Browser smoke items for Andrew to confirm on live deploy:**
1. Incognito visit to `/app/signup` renders signup form (not redirect to `/app/login`)
2. Incognito visit to `/app/forgot-password` renders forgot-password form
3. Incognito visit to `/app/verify-email` renders verify-email page
4. Incognito visit to `/app` (or any protected route) still redirects to `/app/login`
5. Clicking "Sign up" on `/app/login` navigates to `/app/signup` and renders form
6. Desktop (>=1024px): `/app/login` shows NSI hero pane on LEFT, email/password form on RIGHT
7. Mobile (<1024px): `/app/login` shows form-only with mobile BackgroundGlow — no AuthHero visible

---

## Known Doc-vs-Code Discrepancy (preserved, not a regression)

ROADMAP success criterion #2 states "≥ 768px" for the split-panel layout. The existing v1.2 auth skin uses `lg:` (1024px breakpoint). Per CONTEXT.md ("anchored to existing v1.2 auth skin") and RESEARCH.md ("preserve the existing `lg:` breakpoint"), this plan kept `lg:`. Changing to `md:` would have been a v1.2 regression. The discrepancy is in the ROADMAP doc, not in the code. Verifier should evaluate at 1024px+, not 768px+.

---

## Reciprocal Link Confirmation

The "Already have an account? Log in" link on `/app/signup` was confirmed present in `app/(auth)/app/signup/signup-form.tsx` (research phase). No work was done here — it was already correct.

---

## Deviations from Plan

None — plan executed exactly as written. Both edits were the exact lines specified in the plan's `<action>` blocks. No bugs discovered, no blocking issues, no architectural changes needed.

---

## Next Phase Readiness

- Plan 22-02 (session TTL fix) modifies `lib/supabase/proxy.ts`. The `publicAuthPaths` array added in Task 1 must be preserved — 22-02 targets the `setAll` cookies callback (separate section of the file).
- Both fixes are independent of Phase 23 (Public Booking Fixes) and Phase 24 (Owner UI Polish).
