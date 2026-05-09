---
phase: 38-magic-link-login
verified: 2026-05-08T00:00:00Z
status: passed
score: 19/19 must-haves verified
re_verification: false
requirements_satisfied:
  - AUTH-24
  - AUTH-28
  - AUTH-29
---

# Phase 38: Magic-Link Login - Verification Report

**Phase Goal (ROADMAP):** An existing account holder can request a passwordless login email from the /app/login card; the flow is rate-limited, enumeration-safe, and uses Supabase signInWithOtp - no new route required.

**Verified:** 2026-05-08
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### ROADMAP Phase 38 Success Criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can enter email + request magic-link without leaving /app/login (no separate route) | VERIFIED | login-form.tsx adds Tabs (Password / Magic link) inside the existing Card; MagicLinkTabContent swaps in-place to MagicLinkSuccess on success. No redirect() in requestMagicLinkAction. No new route file under app/(auth)/app/login/magic-link/. |
| 2 | Known + unknown emails return identical status + body | VERIFIED | requestMagicLinkAction (actions.ts L127-183) always returns success for both: rate-limit miss returns success; 4xx (incl. unknown-email 400) is swallowed and falls through to success; only >=500 returns formError. Live test B passed (no new auth.users row for fake email; identical UI). |
| 3 | More than 5 requests / hour / (IP, email) silently throttled, same success-shape | VERIFIED | checkAuthRateLimit(magicLink, IP_EMAIL_KEY) with magicLink max=5 windowMs=3_600_000 (rate-limits.ts L20). On throttle: return success (actions.ts L148). Live test C confirmed via rate_limit_events 5/5 hits + identical UI on every submit. |

### Plan-Level Must-Haves (Truths)

#### Plan 38-01 (Backend)

| Truth | Status | Evidence |
| --- | --- | --- |
| requestMagicLinkAction validates email via Zod, rejects malformed input with fieldErrors | VERIFIED | actions.ts L132-135: magicLinkSchema.safeParse({ email }); on parse failure returns fieldErrors. |
| Calls signInWithOtp with shouldCreateUser:false and emailRedirectTo /auth/confirm?next=/app | VERIFIED | actions.ts L156-162. |
| ALWAYS returns success for known and unknown emails | VERIFIED | actions.ts L173-182: 4xx error logged + swallowed; falls through to return success at L182. Only 5xx returns formError. |
| ALWAYS returns success on rate-limit | VERIFIED | actions.ts L147-149: if (!rl.allowed) return success. |
| 5/hour per (IP+email) rate limit enforced via checkAuthRateLimit with magicLink key | VERIFIED | actions.ts L146 + rate-limits.ts L20 (magicLink: max=5, windowMs=60*60*1000). |
| REQUIREMENTS AUTH-28 reads 5/hour per (IP+email) pair with silent-throttle wording | VERIFIED | REQUIREMENTS.md L17 exact match; 3/hour per IP returns zero matches. |

**Plan 01 artifacts:**

| Path | Provides | Status |
| --- | --- | --- |
| app/(auth)/app/login/actions.ts | requestMagicLinkAction server action + MagicLinkState export | VERIFIED (L106-110, L127) |
| app/(auth)/app/login/schema.ts | magicLinkSchema (email-only Zod) | VERIFIED (L10-14) |
| lib/auth/rate-limits.ts | magicLink entry in AUTH_RATE_LIMITS (5/hour) | VERIFIED (L20) |

**Plan 01 key links:**

| From | To | Via | Status |
| --- | --- | --- | --- |
| actions.ts | rate-limits.ts | checkAuthRateLimit(magicLink, IP_EMAIL_KEY) | VERIFIED (actions.ts L146) |
| actions.ts | supabase.auth.signInWithOtp | shouldCreateUser:false + emailRedirectTo | VERIFIED (actions.ts L156-162) |

#### Plan 38-02 (UI)

| Truth | Status | Evidence |
| --- | --- | --- |
| /app/login renders Password / Magic-link tabs with Password as default | VERIFIED | login-form.tsx L125 Tabs defaultValue=password; L127-128 both TabsTrigger present. |
| Google OAuth button stays at top, ABOVE divider, ABOVE tabs | VERIFIED | login-form.tsx L105-117: Google form + divider precede Card (L120) which contains the Tabs. Phase-34 layout preserved. |
| Submit replaces form area inline - no navigation away | VERIFIED | MagicLinkTabContent L221-223 returns MagicLinkSuccess when magicState.success && submittedEmail; no redirect()/Link/router.push in this path. |
| Success state renders EXACT copy: If an account exists for that email, we sent a login link. Check your inbox. | VERIFIED | magic-link-success.tsx L66 verbatim. |
| Success state communicates 15-minute link expiry | VERIFIED | magic-link-success.tsx L68-70: The link expires in 15 minutes. |
| Resend button has 30-second countdown disabled state | VERIFIED | magic-link-success.tsx L38 useState(30), L46-52 interval, L80 Resend in Ns label, L54 isDisabled gate. |
| Each tab has its own form; Password tab unchanged behavior using loginAction | VERIFIED | login-form.tsx L132 (Password form using loginAction) + L226 (magic-link form). Two distinct forms. loginAction unchanged. |
| Both email inputs use distinct ids email-password / email-magic with matching Label htmlFor | VERIFIED | login-form.tsx L147+149 and L240+242. |
| 5xx errors render destructive Alert in magic-link tab; 4xx still renders success state | VERIFIED | MagicLinkTabContent L234-238 surfaces magicState.formError as destructive Alert; action only sets formError on >=500. |

**Plan 02 artifacts:**

| Path | Provides | Status |
| --- | --- | --- |
| app/(auth)/app/login/login-form.tsx | Tabs Password / Magic-link, password tab unchanged, magic-link tab + success hand-off | VERIFIED |
| app/(auth)/app/login/magic-link-success.tsx | MagicLinkSuccess named export with 30s resend countdown + exact copy | VERIFIED |
| app/(auth)/app/login/page.tsx | Subtitle reflects both auth options | VERIFIED (L40: Sign in with your email and password or a magic link.) |

**Plan 02 key links:**

| From | To | Via | Status |
| --- | --- | --- | --- |
| login-form.tsx | requestMagicLinkAction | useActionState(requestMagicLinkAction, ...) | VERIFIED (L213-216) |
| login-form.tsx | components/ui/tabs.tsx | import Tabs/TabsList/TabsTrigger/TabsContent | VERIFIED (L15) |
| magic-link-success.tsx | requestMagicLinkAction (resend) | useActionState | VERIFIED (L34-37) |

#### Plan 38-03 (Live wiring)

| Truth | Status | Evidence |
| --- | --- | --- |
| Local supabase/config.toml otp_expiry = 900 | VERIFIED | config.toml L232: otp_expiry = 900. Single occurrence. |
| Hosted Supabase Magic Link template subject = Your NSI login link | VERIFIED (live) | 38-03-SUMMARY.md Deviations + Live verification - Andrew confirmed configured + verified. Test A: email arrived with subject Your NSI login link. |
| Hosted Supabase Magic Link body uses PKCE TokenHash URL pattern (NOT default ConfirmationURL) | VERIFIED (live) | 38-03-SUMMARY.md Step 1 dashboard config + Test A click-through landed on /app authenticated. |
| Hosted Supabase OTP expiry = 900 | VERIFIED (live) | 38-03-SUMMARY.md Step 2 confirmed by Andrew. |
| Live preview/production E2E happy-path passes | VERIFIED (live) | Test A (after Site URL fix to production). |
| Live preview/production E2E enumeration safety passes | VERIFIED (live) | Test B - direct SQL query confirmed no new auth.users row for fake email; identical UI. |
| Live preview/production E2E silent rate-limit passes | VERIFIED (live) | Test C - 5/5 hits in rate_limit_events, identical UI on every submit. Supabase inner ~60s OTP cooldown reduced delivered emails to 2/5 (strengthens enumeration safety; non-blocking observation in SUMMARY Deviations). |

**Plan 03 artifacts:**

| Path | Provides | Status |
| --- | --- | --- |
| supabase/config.toml | otp_expiry = 900 in [auth.email] block | VERIFIED (L232) |

**Plan 03 key links:**

| From | To | Via | Status |
| --- | --- | --- | --- |
| supabase/config.toml [auth.email] otp_expiry | Hosted Supabase Auth Settings -> OTP expiry | Manual sync via dashboard | VERIFIED (live; Andrew confirmed configured) |

### Requirements Coverage

| Requirement | Maps to | Status | Evidence |
| --- | --- | --- | --- |
| AUTH-24: User can request passwordless login email from /app/login (no separate route) | Phase 38 | SATISFIED | Plan 02 truths + ROADMAP SC#1 verified. No /app/login/magic-link/ route file exists. |
| AUTH-28: Magic-link requests rate-limited via rate_limit_events (5/hour per (IP+email) pair, silent on throttle) | Phase 38 | SATISFIED | rate-limits.ts L20 + actions.ts L146-149 + live test C. REQUIREMENTS wording reconciled. |
| AUTH-29: Identical HTTP response body for known and unknown emails | Phase 38 | SATISFIED | actions.ts swallow path (L173-182) + live test B (DevTools network parity confirmed). |

REQUIREMENTS.md L111, L115, L116 map AUTH-24, AUTH-28, AUTH-29 to Phase 38 (status currently Pending - orchestrator will flip to Complete on this verification pass).

### Anti-Patterns Scan

| File | Finding | Severity |
| --- | --- | --- |
| actions.ts requestMagicLinkAction | Two console.error calls (L170, L175-178) - intentional server-side logging for 5xx and swallowed-4xx (RESEARCH Pattern 1 enumeration safety). Not stub patterns. | Info - expected |
| magic-link-success.tsx | No TODO/FIXME/placeholder. Real useActionState + interval-driven cooldown. | Clean |
| login-form.tsx | No TODO/FIXME/placeholder. Tabs wired to real action; onSubmit captures email without preventing default (form still POSTs). | Clean |

No blocker anti-patterns found.

### Human Verification Required

None remaining - Andrew already executed all five sub-tests of Plan 38-03 Task 3 against production (https://booking.nsintegrations.com):

- A. Happy-path: PASS (after Site URL fix to production)
- B. Enumeration safety: PASS (direct SQL - no new auth.users row for fake email)
- C. Silent rate-limit: PASS for AUTH-29 contract (rate_limit_events 5/5 hits, identical UI; Supabase inner ~60s cooldown reduced delivered emails to 2/5, which strengthens enumeration safety)
- D. Tabs reset: PASS (Radix unmount-resets-state working)

Captured deviations in 38-03-SUMMARY.md:
1. Site URL config drift (production fix applied) - surfaced because Phase 38 is the first phase to ship a hosted email template that interpolates SiteURL. Future phases introducing SiteURL-templated emails should include Site URL verification in their checklist.
2. Supabase inner OTP cooldown observation - non-blocking; reinforces enumeration safety.

### Gaps Summary

No gaps. All 19 must-haves across the three plans are observable in the codebase or in the live verification record. ROADMAP success criteria 1-3 are observably true. AUTH-24, AUTH-28, AUTH-29 are SATISFIED and ready for the orchestrator to mark Complete in REQUIREMENTS.md and flip Phase 38 to SHIPPED in ROADMAP/STATE.

---

_Verified: 2026-05-08_
_Verifier: Claude (gsd-verifier)_
