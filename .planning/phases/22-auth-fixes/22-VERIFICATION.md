---
phase: 22-auth-fixes
verified: 2026-05-02T14:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 22: Auth Fixes — Verification Report

**Phase Goal:** Owner authentication surfaces work as intended — signup is reachable from login, the split-panel layout matches the intended Cruip direction, and authenticated sessions persist long enough that Andrew isn't re-prompted to log in during a normal week of use.

**Verified:** 2026-05-02
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | From `/login`, clicking "Sign up" navigates to `/signup` without redirect loop (AUTH-18) | VERIFIED | `publicAuthPaths` array at proxy.ts:58–63 includes `/app/signup`; `!publicAuthPaths.includes(pathname)` guard at line 68 |
| 2 | `/login` renders informational pane LEFT, form RIGHT at desktop widths (AUTH-19) | VERIFIED | `<AuthHero>` is first child at login/page.tsx:31; `<main>` is second child at line 33; `lg:grid-cols-2` wrapper at line 29 |
| 3 | After login, owner can close browser, reopen next day, and stay authenticated (AUTH-20 — manual) | VERIFIED (via direct evidence) | Cookie `sb-*-auth-token` Expires 2027-06-06 (~400 days); Supabase dashboard timebox=0 / inactivity=0 — captured in 22-02-SUMMARY.md |
| 4 | 30-day TTL applies on next login/rotation; no `cookieOptions.maxAge` override shortening sessions (AUTH-20 — code) | VERIFIED | `setAll(cookiesToSet, headers)` at proxy.ts:27; `Object.entries(headers ?? {}).forEach` at lines 40–42; `grep -rn "cookieOptions"` across lib/, app/, middleware.ts returns zero matches |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/supabase/proxy.ts` | publicAuthPaths allow-list (AUTH-18) + setAll headers forwarding (AUTH-20) | VERIFIED | Lines 58–63: four-path array; lines 27, 40–42: setAll signature and header forwarding; 77 lines total, no stubs |
| `app/(auth)/app/login/page.tsx` | AuthHero LEFT, form RIGHT in lg:grid-cols-2 (AUTH-19) | VERIFIED | Line 31: `<AuthHero>` first child; line 33: `<main>` second child; 49 lines, no stubs |
| `app/(auth)/_components/auth-hero.tsx` | Component with `hidden lg:flex` breakpoint controlling desktop-only display | VERIFIED | Line 24: `className="relative hidden overflow-hidden bg-gray-50 lg:flex lg:flex-col..."` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `publicAuthPaths` array | redirect guard | `!publicAuthPaths.includes(pathname)` at proxy.ts:68 | WIRED | Exact-match check prevents unauthenticated visitors to `/app/signup`, `/app/forgot-password`, `/app/verify-email` from being redirected |
| `setAll(cookiesToSet, headers)` | `supabaseResponse.headers` | `Object.entries(headers ?? {}).forEach` at proxy.ts:40–42 | WIRED | Cache-control headers from @supabase/ssr@0.10.2 forwarded to response; null-safe with `?? {}` |
| `<AuthHero>` (first child) | `lg:grid-cols-2` grid | JSX order in login/page.tsx:29–45 | WIRED | AuthHero occupies column 1 (left); main occupies column 2 (right) at lg+ breakpoints |
| Andrew's cookie inspection | AUTH-20 manual gate | 22-02-SUMMARY.md "Manual Verification Results" | WIRED | Supabase dashboard values + cookie expiry date documented; matches STATE.md "deploy-and-eyeball" as canonical v1.3 gate |

---

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| AUTH-18: publicAuthPaths allow-list with four routes | SATISFIED | proxy.ts:58–63: `/app/login`, `/app/signup`, `/app/forgot-password`, `/app/verify-email` |
| AUTH-19: login split-panel hero LEFT, form RIGHT | SATISFIED | login/page.tsx:31 (AuthHero first), line 33 (main second), lg:grid-cols-2 at line 29 |
| AUTH-20: session persistence ≥ 30 days | SATISFIED | 400-day cookie (2027-06-06), no hosted timebox/inactivity override, no maxAge override in code |

---

## Anti-Patterns Found

None. Grep for `cookieOptions` across lib/, app/, and middleware.ts returns zero matches. No TODO/FIXME/placeholder patterns in the two modified files. No stub returns or empty handlers.

---

## Automated Check Results

| Check | Result | Notes |
|-------|--------|-------|
| `grep -rn "cookieOptions" lib/ app/ middleware.ts` | PASS — zero matches | No maxAge override exists anywhere in the tree |
| `npx tsc --noEmit` | PASS — zero new errors | Pre-existing DEBT-02 errors in `tests/` only (TS7006/TS2305 — baseline, not new) |
| `npm run build` | PASS — all 29 static/dynamic routes compile | Build completes with zero error lines; `✓ Generating static pages (29/29)` |
| `npm test` | PASS — 222 passing, 4 skipped (26 files) | Identical to v1.2 baseline; no new failures |

---

## Doc-vs-Code Discrepancy (Not a Code Fail)

**ROADMAP success criterion #2** states the split-panel layout should trigger at "≥ 768px" (md: breakpoint). The actual code uses `lg:` (1024px).

This is intentional and documented in both 22-01-PLAN.md (decision `AUTH-19-lg-breakpoint`) and 22-01-SUMMARY.md:

> "ROADMAP says ≥768px but CONTEXT.md anchors to existing v1.2 auth skin which uses lg:. AuthHero is `hidden lg:flex` — changing breakpoint would be a v1.2 regression, not a fix."

Evidence in auth-hero.tsx line 24: `className="relative hidden overflow-hidden bg-gray-50 lg:flex lg:flex-col..."`. The component has been `lg:` since v1.2; changing to `md:` was explicitly rejected in the research phase.

**Action for ROADMAP editor:** Update criterion #2 to read "≥ 1024px (lg:)" to match the implemented and intentionally preserved breakpoint. This is a doc correction, not a code change.

---

## Success Criterion #3: Weekly Observational Gate

ROADMAP criterion #3 ("close browser, reopen next day, navigate to /app, stay authenticated") is an observational truth that cannot be verified structurally. It is superseded by direct evidence:

- Cookie `sb-*-auth-token` expires 2027-06-06 — approximately 400 days from the date of Andrew's inspection (2026-05-02).
- Supabase hosted dashboard Auth → Sessions: timebox = 0 (disabled), inactivity_timeout = 0 (disabled).
- No `cookieOptions.maxAge` override anywhere in `lib/`, `app/`, or `middleware.ts`.

With a 400-day cookie and no hosted or code-side TTL reduction, a 7-day persistence window is structurally guaranteed barring a Supabase outage or the user manually clearing cookies. The ROADMAP's 30-day target is met by a factor of 13x.

An observational follow-up (criterion #3 as written) is logged in 22-02-SUMMARY.md as an open item for the next week of normal use. That follow-up does not block Phase 22 closure.

---

## Gaps Summary

No gaps. All four must-haves are verified in the codebase. All automated checks pass at baseline or better. Andrew's manual verification results are captured in 22-02-SUMMARY.md and satisfy the deploy-and-eyeball gate per STATE.md.

---

_Verified: 2026-05-02T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
