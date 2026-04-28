---
phase: 10
plan: 04
name: "gmail-smtp-quota-cap-and-alert"
subsystem: "email-infrastructure"
tags: ["email", "quota", "gmail-smtp", "rate-limiting", "postgres", "vitest"]

dependency-graph:
  requires: ["10-01 (reserved-slugs consolidation for project baseline)"]
  provides: ["email_send_log table", "quota-guard.ts exports", "QUOTA GUARD CONTRACT documented"]
  affects: ["10-05 (signup-verify call site)", "10-06 (welcome-email call site)", "10-08 (email-change call site)"]

tech-stack:
  added: []
  patterns: ["Postgres-backed counter (mirrors rate-limit.ts pattern)", "fail-open on DB error", "in-memory per-day dedup for warning log"]

key-files:
  created:
    - supabase/migrations/20260428120003_phase10_email_send_log.sql
    - lib/email-sender/quota-guard.ts
    - tests/quota-guard.test.ts
  modified:
    - lib/email-sender/index.ts
    - FUTURE_DIRECTIONS.md

decisions:
  - id: "ARCH-D2"
    summary: "Cap signup-side emails at 200/day via email_send_log Postgres counter"
    rationale: "Free-tier; 200/day = 40% of Gmail ~500/day soft limit; avoids account suspension risk"

metrics:
  duration: "~4 minutes"
  completed: "2026-04-28"
  tasks-completed: 3
  tests-added: 4
  tests-total: 135
---

# Phase 10 Plan 04: Gmail SMTP Quota Cap and Alert Summary

**One-liner:** Postgres-backed 200/day email quota guard with 80%-threshold warning and fail-closed-at-cap, using `email_send_log` table and `checkAndConsumeQuota()` helper.

## What Was Built

Architectural Decision #2 (Gmail SMTP quota plan) is now committed code. Three deliverables:

1. **`supabase/migrations/20260428120003_phase10_email_send_log.sql`** — `email_send_log` table with `id bigserial`, `sent_at timestamptz`, `category text CHECK(...)`. Index on `sent_at desc` for daily-count queries. RLS enabled with zero policies (deny-all to authenticated/anon; service-role bypasses). Applied to linked Supabase project.

2. **`lib/email-sender/quota-guard.ts`** — Four named exports:
   - `SIGNUP_DAILY_EMAIL_CAP = 200`
   - `QuotaExceededError` (typed error with `count` + `cap` fields)
   - `getDailySendCount()` — counts rows since UTC midnight; fails OPEN on DB error
   - `checkAndConsumeQuota(category)` — checks cap, logs 80% warning (once/day, in-memory dedup), inserts row, throws `QuotaExceededError` at cap

3. **`lib/email-sender/index.ts`** — JSDoc "QUOTA GUARD CONTRACT" comment on `sendEmail()`. Comment-only; no behavior change. Documents that signup-side callers must `checkAndConsumeQuota()` before calling; booking/reminder paths bypass intentionally.

4. **`FUTURE_DIRECTIONS.md`** — New entry in §3 Future Improvements: Gmail SMTP → Resend/Postmark migration as v1.2 follow-up (references quota-guard.ts, P-A12, EMAIL-08).

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cap value | 200/day | 40% of Gmail ~500/day soft limit; leaves headroom for booking/reminder volume |
| Guard placement | Call-site (not inside `sendEmail()`) | `sendEmail()` is shared by booking/reminder paths that MUST bypass; call-site guard avoids touching all v1.0 callers |
| Fail-open on DB error | Yes | Mirrors `lib/rate-limit.ts`; transient DB error should not brick signup |
| 80% warning dedup | In-memory Set keyed by UTC-day | Multi-instance Vercel could log 2-3x/day total; acceptable signal-to-noise |
| Booking/reminder bypass | Yes | These are v1.0 surfaces with their own retry semantics; protecting them IS the cap's purpose |

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create email_send_log migration | `064ef3a` | `supabase/migrations/20260428120003_phase10_email_send_log.sql` |
| 2 | Create quota-guard.ts + tests | `77d1ee4` | `lib/email-sender/quota-guard.ts`, `tests/quota-guard.test.ts` |
| 3 | JSDoc + FUTURE_DIRECTIONS entry | `f53f475` | `lib/email-sender/index.ts`, `FUTURE_DIRECTIONS.md` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file placed in `tests/` instead of `lib/email-sender/`**

- **Found during:** Task 2
- **Issue:** `vitest.config.ts` `include` pattern is `["tests/**/*.test.ts", "tests/**/*.test.tsx"]` — files in `lib/` are not scanned. Placing `quota-guard.test.ts` in `lib/email-sender/` would make it invisible to the runner.
- **Fix:** Placed test at `tests/quota-guard.test.ts`. Used relative import (`../lib/email-sender/quota-guard`) to bypass the `@/lib/email-sender` → mock alias in vitest.config.ts (that alias maps the exact path to the email mock, not sub-paths like `/quota-guard`).
- **Files modified:** `tests/quota-guard.test.ts` (created in correct location)
- **Commit:** `77d1ee4`

## Verification Results

- [x] `email_send_log` exists: `select count(*) from email_send_log` returns 0
- [x] RLS enabled: `select rowsecurity from pg_tables where tablename='email_send_log'` returns `true`
- [x] `quota-guard.ts` exports all 4 named exports
- [x] All 4 unit tests pass (`npx vitest run tests/quota-guard.test.ts`)
- [x] `git grep "QUOTA GUARD CONTRACT" lib/email-sender/index.ts` — 1 match
- [x] `git grep "Gmail SMTP" FUTURE_DIRECTIONS.md` — 2 matches (1 pre-existing in §2 + 1 new in §3)
- [x] `git grep "checkAndConsumeQuota" -- lib/email/` — 0 matches (booking/reminder paths not guarded)
- [x] `npx tsc --noEmit` — no new errors (pre-existing test-mock alias errors unchanged)
- [x] `npm test` — 135 passing + 1 skipped = 136 total (was 131 + 1 = 132; +4 new quota tests)

## Next Phase Readiness

Plans 10-05, 10-06, and 10-08 can now wire `checkAndConsumeQuota()` into their respective call sites:
- **10-05 Task 3:** `app/(auth)/app/signup/actions.ts` — `checkAndConsumeQuota('signup-verify')` before `supabase.auth.signUp()`
- **10-06 Task 3:** `lib/onboarding/welcome-email.ts` — `checkAndConsumeQuota('signup-welcome')` before `sendEmail()`
- **10-08 Task 2:** email-change Server Action — `checkAndConsumeQuota('email-change')` before send

No blockers for downstream plans. The guard is available as `@/lib/email-sender/quota-guard` (import directly from the file path, not from `@/lib/email-sender` which is the mock alias in vitest).
