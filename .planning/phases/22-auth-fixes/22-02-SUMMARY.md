---
phase: 22-auth-fixes
plan: 02
subsystem: auth
tags: [supabase, ssr, cookies, session, proxy, cache-headers, auth-token]

# Dependency graph
requires:
  - phase: 22-auth-fixes
    plan: 01
    provides: proxy.ts redirect gate + login layout fix (AUTH-18, AUTH-19)
provides:
  - proxy.ts setAll callback forwarding cache-control headers from @supabase/ssr@0.10.2
  - Manual verification that session TTL is 400 days (no override shortening it)
  - Documentation that Supabase hosted dashboard has no timebox or inactivity_timeout
affects:
  - 22-auth-fixes (phase close)
  - v1.4 AUTH-20 observational follow-up (week-of-use confirmation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "setAll(cookiesToSet, headers) — @supabase/ssr@0.10.2 SetAllCookies second arg forwarded to supabaseResponse.headers"
    - "No cookieOptions.maxAge override — rely on @supabase/ssr default (400 days)"

key-files:
  created:
    - .planning/phases/22-auth-fixes/22-02-SUMMARY.md
  modified:
    - lib/supabase/proxy.ts

key-decisions:
  - "Do NOT add cookieOptions.maxAge — @supabase/ssr@0.10.2 already sets 400-day default; any override would actively shorten sessions"
  - "Forward headers in setAll via Object.entries(headers ?? {}) with null-safety for backward compat with older @supabase/ssr pins"
  - "Clock-advance test (Step 3) skipped as optional — 400-day cookie + zero dashboard timebox/inactivity is sufficient evidence"
  - "ROADMAP success criterion #3 tracked observationally over next week of normal use (not blocking plan close)"

patterns-established:
  - "setAll headers forwarding: always forward the second arg of SetAllCookies onto supabaseResponse.headers to prevent CDN cache poisoning during token rotation"

# Metrics
duration: checkpoint-gated (Task 1 automated; Task 2 manual verification)
completed: 2026-05-02
---

# Phase 22 Plan 02: Session Persistence Verification Summary

**proxy.ts setAll patched to forward cache-control headers from @supabase/ssr@0.10.2; live Vercel inspection confirms 400-day auth cookie with no hosted dashboard override shortening sessions**

## Performance

- **Duration:** Checkpoint-gated (Task 1 automated; verification via Andrew's manual checklist)
- **Started:** 2026-05-02
- **Completed:** 2026-05-02
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1 (lib/supabase/proxy.ts)

## Accomplishments

- Patched `lib/supabase/proxy.ts` `setAll` callback to accept `(cookiesToSet, headers)` and forward cache-control headers onto `supabaseResponse.headers`, preventing CDN cache poisoning during refresh-token rotation
- Confirmed Supabase hosted dashboard Auth → Sessions has NO timebox and NO inactivity_timeout override (both set to 0 / unset) — no hosted-side setting shortening sessions
- Confirmed live Vercel deploy cookie `sb-*-auth-token` expires `2027-06-06T18:52:07.451Z` (~400 days from 2026-05-02), matching `@supabase/ssr@0.10.2`'s `DEFAULT_COOKIE_OPTIONS.maxAge` with no shorter override
- Established anti-regression note: NO `cookieOptions.maxAge` override was added (would have actively shortened Andrew's sessions)

## Task Commits

1. **Task 1: Patch proxy.ts setAll to forward cache headers** — `662229a` (fix)
2. **Task 2: Manual verification checkpoint** — human-verify (no code commit; results captured in this SUMMARY)

**Plan metadata:** `[see final commit]` (docs: complete plan)

## Files Created/Modified

- `lib/supabase/proxy.ts` — setAll callback signature updated to `(cookiesToSet, headers)`; added `Object.entries(headers ?? {}).forEach` block forwarding cache-control headers onto `supabaseResponse.headers`
- `.planning/phases/22-auth-fixes/22-02-SUMMARY.md` — this file

## Decisions Made

1. **No `cookieOptions.maxAge` override added.** Research confirmed `@supabase/ssr@0.10.2` hardcodes `DEFAULT_COOKIE_OPTIONS.maxAge = 34560000` (400 days). Adding a shorter override would have been an anti-fix — actively worsening the re-login problem. The correct action was to leave TTL untouched and verify no external override was in effect.

2. **Null-safety `headers ?? {}`** kept in `Object.entries(headers ?? {})` for backward compatibility with older `@supabase/ssr` pins that pass `undefined` as the second arg.

3. **Clock-advance test (Step 3) skipped.** Marked optional in the plan. The combination of (a) 400-day cookie with no shorter override and (b) zero hosted timebox/inactivity is sufficient evidence that sessions persist far beyond the 30-day ROADMAP target. Step 4 observational confirmation continues over the next week of normal use.

4. **Deploy-and-eyeball canonical gate.** Per STATE.md, Andrew's live Vercel inspection of the cookie is the production gate for v1.3. No marathon QA phase.

## Manual Verification Results (Andrew, 2026-05-02)

**Step 1 — Supabase Dashboard Auth → Sessions:**
- Session timebox: **0** (unset / disabled)
- Inactivity timeout: **0** (unset / disabled)
- Result: No hosted-side override shortening sessions. ✓

**Step 2 — DevTools cookie inspection (live Vercel deploy):**
- Cookie name: `sb-*-auth-token`
- Expires: **2027-06-06T18:52:07.451Z** (~400 days from 2026-05-02)
- Confirms `@supabase/ssr@0.10.2`'s default `maxAge` in effect with no shorter override. ✓

**Step 3 — Clock-advance refresh test:**
- **Skipped** (optional per plan). 400-day cookie + zero dashboard timebox/inactivity supersedes the need for this step.

## Plan Must-Haves Coverage

| Must-Have | Status | Evidence |
|-----------|--------|----------|
| Cookie Max-Age ≈ 400 days | ✓ Verified | Expires 2027-06-06 (400 days) |
| Supabase dashboard no problematic timebox/inactivity | ✓ Verified | Both 0 / unset |
| Clock-advance simulation | ⏸ Skipped (optional) | Superseded by direct evidence above |
| proxy.ts setAll accepts (cookiesToSet, headers) and forwards cache headers | ✓ Complete | 662229a |

## Deviations from Plan

None — plan executed exactly as written. Task 1 applied the patch; Task 2 checkpoint returned Andrew's verification results. Step 3 was marked optional and was skipped per plan guidance.

## Issues Encountered

None.

## Open Follow-Ups

- **ROADMAP success criterion #3 observational follow-up:** "Close browser, reopen next day, hit /app, stay authenticated" — tracked over Andrew's next week of normal use. If re-login prompts surface, capture timestamp, browser, last successful auth time, and any DevTools console errors, then re-open AUTH-20 in v1.4.
- No blockers for Phase 22 close or Phase 23 start.

## Next Phase Readiness

Phase 22 (Auth Fixes) is complete:
- 22-01: AUTH-18 middleware allow-list + AUTH-19 login column swap ✓
- 22-02: AUTH-20 proxy.ts setAll patch + session persistence verification ✓

Phase 23 (Public Booking Fixes) is next: mobile calendar centering, desktop slot-picker layout collision fix, account-index event-type cards page (PUB-13, PUB-14, PUB-15).

---
*Phase: 22-auth-fixes*
*Completed: 2026-05-02*
