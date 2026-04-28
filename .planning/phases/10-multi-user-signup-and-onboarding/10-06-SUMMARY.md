---
phase: 10
plan: "06"
subsystem: onboarding
tags: [wizard, onboarding, slug-picker, availability-rules, event-types, welcome-email, rpc]

dependency-graph:
  requires:
    - "10-01: reserved-slugs module (RESERVED_SLUGS + isReservedSlug())"
    - "10-03: accounts stub trigger + onboarding_complete/onboarding_step columns"
    - "10-04: quota-guard.ts (checkAndConsumeQuota, QuotaExceededError)"
    - "10-05: /app/signup page (creates the user that hits this wizard)"
  provides:
    - "3-step onboarding wizard at /onboarding (account name+slug, timezone, event type)"
    - "slug_is_taken() SECURITY DEFINER RPC for cross-tenant collision check"
    - "/api/check-slug route handler (auth-gated, reserved short-circuit, fail-open)"
    - "lib/slug-suggestions.ts + 7-test suite"
    - "lib/onboarding/welcome-email.ts (quota-guarded, fire-and-forget)"
    - "/app page.tsx redirects new users to /onboarding"
  affects:
    - "10-07: profile settings (slug-form.tsx references same slug validation pattern)"
    - "10-09: RLS matrix extension (wizard actions use RLS-scoped client)"
    - "Phase 12: wizard UI restyling"

tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER RPC for cross-tenant read bypass (slug_is_taken)"
    - "Fail-open on RPC error (DB hiccup → optimistic UI, DB constraint is safety net)"
    - "300ms debounced fetch for real-time availability feedback"
    - "Fire-and-forget welcome email (no await, .catch() only)"
    - "Sequential INSERT rollback (availability_rules deleted if event_types INSERT fails)"

key-files:
  created:
    - "app/onboarding/layout.tsx"
    - "app/onboarding/page.tsx"
    - "app/onboarding/schema.ts"
    - "app/onboarding/actions.ts"
    - "app/onboarding/step-1-account/page.tsx"
    - "app/onboarding/step-1-account/account-form.tsx"
    - "app/onboarding/step-2-timezone/page.tsx"
    - "app/onboarding/step-2-timezone/timezone-form.tsx"
    - "app/onboarding/step-3-event-type/page.tsx"
    - "app/onboarding/step-3-event-type/event-type-form.tsx"
    - "lib/slug-suggestions.ts"
    - "tests/slug-suggestions.test.ts"
    - "app/api/check-slug/route.ts"
    - "supabase/migrations/20260428120004_phase10_slug_is_taken_fn.sql"
    - "lib/onboarding/welcome-email.ts"
  modified:
    - "app/(shell)/app/page.tsx"

decisions:
  - id: "10-06-D1"
    summary: "slug_is_taken() SECURITY DEFINER bypasses RLS for cross-tenant check"
    rationale: "Wizard user's RLS SELECT policy only shows own row; plain SELECT WHERE slug=? would give false 'available' for other tenants"
  - id: "10-06-D2"
    summary: "Fail-open on slug_is_taken RPC error"
    rationale: "DB hiccup at check-slug should not block wizard; accounts.slug unique constraint is the authoritative safety net at completeOnboardingAction"
  - id: "10-06-D3"
    summary: "Welcome email fire-and-forget (no await)"
    rationale: "Wizard completion (accounts UPDATE, availability_rules, event_types) must not be gated on email delivery; non-fatal by design"
  - id: "10-06-D4"
    summary: "Sequential INSERT rollback in completeOnboardingAction"
    rationale: "No Postgres transaction via supabase-js; if event_types INSERT fails, DELETE the just-inserted availability_rules to avoid orphaned rows on retry"
  - id: "10-06-D5"
    summary: "Test file moved from lib/ to tests/ to match vitest include pattern"
    rationale: "vitest.config.ts include: ['tests/**/*.test.ts']; lib/slug-suggestions.test.ts was in wrong directory and would never run"

metrics:
  duration: "~45 min (resumed execution; prior executor hit usage limit)"
  completed: "2026-04-28"
---

# Phase 10 Plan 06: Onboarding Wizard and Provisioning Summary

**One-liner:** 3-step /onboarding wizard (name+slug, timezone, event type) with live slug availability via SECURITY DEFINER RPC, 5 default Mon-Fri availability rules, and quota-guarded welcome email on completion.

## Execution Notes

This plan was executed as a **resumed execution** — a prior agent hit the usage limit after writing all Task 1 files to disk. The 10-07 parallel agent committed those files as part of `a329e72 feat(10-07)` before this agent ran. This agent:

1. Verified all on-disk Task 1 files were correct (uses `name` column throughout, not `display_name` per 10-03 schema deviation)
2. Identified test file was in wrong directory (`lib/` vs required `tests/`)
3. Completed Task 2: migration + /api/check-slug + moved+fixed test import
4. Completed Task 3: welcome-email.ts + app/page.tsx redirect

## Tasks Completed

| Task | Description | Commits | Key Files |
|------|-------------|---------|-----------|
| 1 | Wizard route group + layout + steps + actions | `a329e72` (committed by 10-07 parallel) | app/onboarding/** |
| 2a | slug-suggestions helper + tests | `9cbf5dc` | lib/slug-suggestions.ts, tests/slug-suggestions.test.ts |
| 2b | /api/check-slug route + slug_is_taken migration | `8f1dea0` | app/api/check-slug/route.ts, supabase/migrations/...slug_is_taken_fn.sql |
| 2c | Slug picker UI wired into step-1 | `a329e72` (included in Task 1 commit) | app/onboarding/step-1-account/account-form.tsx |
| 3a | welcome-email.ts | `8c002be` | lib/onboarding/welcome-email.ts |
| 3b | /app redirect to /onboarding for new users | `9d4cb1d` | app/(shell)/app/page.tsx |

## Verification Results

- `slug_is_taken('nsi')` → `true` (seeded NSI account detected)
- `slug_is_taken('does-not-exist')` → `false`
- `npm test`: 148 passed | 1 skipped (19 test files) — up from 135 baseline
- `npx tsc --noEmit`: no new errors in 10-06 files (pre-existing test-mock alias errors are v1.2 tech debt per STATE.md)

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cross-tenant slug check | SECURITY DEFINER RPC `slug_is_taken()` | RLS blocks direct SELECT on other tenants' rows |
| RPC error behavior | Fail-open (return available:true) | DB hiccup should not block wizard; unique constraint is safety net |
| Welcome email | Fire-and-forget (no await, .catch only) | Non-fatal by design; wizard completion must not depend on email delivery |
| event_types INSERT failure | DELETE availability_rules, return error | No supabase-js transaction; rollback manually to allow clean retry |
| event_types slug | kebab(user-supplied name) | Per-account unique constraint is `(account_id, slug)`; different tenants can both have "consultation" |
| Test file location | `tests/slug-suggestions.test.ts` | vitest include pattern is `tests/**/*.test.ts`; `lib/` is outside scope |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file in wrong directory**

- **Found during:** Task 2a execution
- **Issue:** `lib/slug-suggestions.test.ts` was created by prior agent in `lib/` directory, outside vitest include pattern `tests/**/*.test.ts`; `npm test` would never find it
- **Fix:** Copied to `tests/slug-suggestions.test.ts`; updated import from `./slug-suggestions` to `@/lib/slug-suggestions`; removed misplaced `lib/slug-suggestions.test.ts`
- **Files modified:** tests/slug-suggestions.test.ts (new), lib/slug-suggestions.test.ts (removed)
- **Commit:** `9cbf5dc`

**2. [Parallel agent commit] Task 1 committed by 10-07 agent**

- **Context:** The 10-07 parallel agent (which ran profile-settings) also committed all the onboarding wizard files in `a329e72` (including account-form.tsx with slug picker UI wired). This was not a bug but a git race condition — both agents had the same files untracked.
- **Outcome:** All Task 1 + 2c content was committed correctly. This executor verified the content before proceeding.

### Plan Text vs. Actual Implementation

- Plan used `display_name` in the welcome-email interface example. Implemented as `name` to match `accounts.name` column (10-03 schema deviation) and to match what `completeOnboardingAction` actually passes.

## Deferred to Milestone-End QA

Per Andrew 2026-04-28 decision, all browser walkthroughs are deferred to milestone-end QA tracked in `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md`:

- Manual: log in as new user → land on /onboarding/step-1-account
- Manual: type "Acme HVAC" → slug auto-fills "acme-hvac"
- Manual: type "app" → "This URL is reserved" messaging
- Manual: type "nsi" → "Taken — try nsi-2, nsi-{email-prefix}, nsi-bookings" with clickable suggestions
- Manual: complete wizard → land on /app dashboard
- Manual: abandon at step 2 → log back in → resume at step-2-timezone
- Manual: log in as Andrew → /app loads (not redirected to /onboarding, onboarding_complete=true)
- Manual: welcome email received after wizard completion

## Next Phase Readiness

10-07 (profile settings + soft delete) was already committed in `a329e72`. Plans 10-08 and 10-09 are next.
