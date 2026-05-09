# Plan 40-08 Summary — v1.7 Final Production QA

**Status:** COMPLETE — all PASS, PROCEED checked.
**Performed by:** Andrew (live on `https://booking.nsintegrations.com`)
**Run date:** 2026-05-09
**Locked record:** `40-V17-FINAL-QA.md` (commit `c42529d`)

## Per-row results

| Row | Test | Result |
|---|---|---|
| 38-A | Magic-link enumeration safety | PASS |
| 38-B | 5/hr/IP+email rate-limit silently throttles | PASS |
| 38-C | Supabase ~60s inner cooldown | PASS |
| 38-D | End-to-end magic-link delivery + Site URL correctness | PASS |
| 39-A | 220ms fade+rise animation on first slot pick (CLS = 0) | PASS |
| 39-B | Static skeleton renders pre-pick (desktop + mobile) | PASS |
| 39-C | prefers-reduced-motion suppresses animation cleanly | PASS |
| Bonus | V15-MP-05 Turnstile lifecycle lock + RHF persistence | PASS |

## Notable observations

- **Test A backend confirmation (Supabase MCP):** `auth.users` zero new rows in 2-hour window; `auth.one_time_tokens` only one token issued, tied to `ajwegner3@gmail.com`. The unknown email Andrew tested left no trace in the auth tables — `shouldCreateUser:false` + the 5xx-only `formError` gate (Plan 38-01 LD pattern) held end-to-end. The contract is observable in code, in UI, AND in storage.
- One observed token had `token_type = 'recovery_token'`. Supabase 17 may use `recovery_token` as the internal label for OTP/magic-link flows, or an unrelated password-recovery action ran in parallel. Either way, the only address that received a token was the real registered one — finding stands.

## v1.7 readiness

All seven v1.7 phases are now production-verified. Plan 09 (milestone close) can proceed.
