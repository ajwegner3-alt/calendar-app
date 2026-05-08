---
phase: 37-upgrade-flow-and-cap-hit-ui
plan: 02
subsystem: server-action, email
tags: [resend, server-action, vitest, supabase, rate-limit, email]

# Dependency graph
requires:
  - phase: 37-01
    provides: accounts.last_upgrade_request_at timestamptz column (migration on disk)
  - phase: 36-resend-backend-for-upgraded-accounts
    provides: createResendClient + EmailClient type in lib/email-sender/providers/resend.ts
provides:
  - requestUpgradeCore(args, deps) — testable inner function with injected clients
  - requestUpgradeAction(args) — public Server Action for Plan 03 form
  - RequestUpgradeArgs, RequestUpgradeResult, RequestUpgradeDeps types
  - 9-branch Vitest unit test suite for requestUpgradeCore
affects:
  - 37-03 (settings upgrade page — imports requestUpgradeAction, reads last_upgrade_request_at for locked-out countdown)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Core/wrapper split for Server Actions with injected deps (reminders pattern extended to include resendClient)"
    - "LD-05 direct createResendClient() call bypasses getSenderForAccount() + quota guard for bootstrap use-cases"
    - "send-then-write DB ordering: timestamp update only after Resend .send() returns success"
    - "Dynamic revalidatePath import in wrapper so core function never requires next/cache scope"
    - "invocationCallOrder assertion in Vitest to enforce send-before-update source ordering at test time"

key-files:
  created:
    - app/(shell)/app/settings/upgrade/_lib/actions.ts
    - tests/upgrade-action.test.ts
  modified: []

key-decisions:
  - "Core/wrapper split chosen over the profile ActionResult pattern — no per-field validation needed; the only field is an optional textarea, making ok/error shape sufficient"
  - "createResendClient() is the send path (not getSenderForAccount()) — this is the LD-05 bootstrap that makes UPGRADE-03 work at the cap-hit moment when the per-account quota guard would refuse the send"
  - "Recipient hardcoded to ajwegner3@gmail.com (not env-var-gated) per CONTEXT decision"
  - "Reply-To prefers claims.email from getClaims(), falls back to account.owner_email — claims email preferred as it reflects the user's current auth email"
  - "DB write to last_upgrade_request_at happens AFTER Resend .send() returns success (Pitfall 4) — send failure leaves timestamp unchanged so user can retry"
  - "Auth + account read via RLS client; timestamp UPDATE via admin client — matches reminders pattern"

patterns-established:
  - "requestUpgradeCore pattern: three injected clients (rlsClient, adminClient, resendClient) enable structural mocking without module interception"
  - "invocationCallOrder Vitest assertion: sendMock.mock.invocationCallOrder[0] < updateMock.mock.invocationCallOrder[0] proves temporal ordering across async calls"

# Metrics
duration: 15min
completed: 2026-05-08
---

# Phase 37 Plan 02: Request-Upgrade-Action Summary

**requestUpgradeCore + requestUpgradeAction server action via direct createResendClient() (LD-05 quota bypass) with 9-branch Vitest unit test suite**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-08T19:32:50Z
- **Completed:** 2026-05-08T19:47:00Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments

- Implemented `requestUpgradeCore(args, deps)` with full auth-to-DB-write pipeline in strict send-before-update order
- Implemented `requestUpgradeAction(args)` wrapper that constructs real clients and delegates to core, with dynamic `revalidatePath` import
- All 9 test branches pass; send-before-update ordering verified via `invocationCallOrder` assertion
- No new packages installed — all infrastructure (createResendClient, createAdminClient, createClient) already on disk from Phases 35-36

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement requestUpgradeCore + requestUpgradeAction** - `c897170` (feat)
2. **Task 2: Vitest unit tests for requestUpgradeCore** - `6e884e0` (test)

**Plan metadata:** (docs commit — forthcoming)

## Files Created/Modified

- `app/(shell)/app/settings/upgrade/_lib/actions.ts` — requestUpgradeCore + requestUpgradeAction + RequestUpgradeArgs/Result/Deps types + local escapeHtml helper
- `tests/upgrade-action.test.ts` — 9 Vitest unit tests for requestUpgradeCore covering all branches

## Decisions Made

**Core/wrapper split over ActionResult shape:** The upgrade action has a single optional textarea (no per-field validation needed). The reminders `{ ok: true } | { ok: false; error: string }` shape is simpler and sufficient. No zod schema created.

**createResendClient() as the send path (LD-05 bootstrap):** `getSenderForAccount(accountId)` was explicitly NOT used. That path routes through `checkAndConsumeQuota()` in `quota-guard.ts`, which would return a refused sender when the account is at the 200/day Gmail cap — exactly the moment this feature must work. Calling `createResendClient()` directly bypasses the quota guard entirely. This is the same principle (LD-05) that motivates the whole Phase 37 design.

**send-then-write DB ordering:** `last_upgrade_request_at` is written to the database only AFTER `deps.resendClient.send()` returns `{ success: true }`. A Resend failure leaves the column null (or unchanged), allowing the user to retry immediately. The alternative (write-before-send) would lock the user out for 24h with no email sent to Andrew.

**Dynamic revalidatePath import in wrapper:** `const { revalidatePath } = await import("next/cache")` is inside the wrapper function body only. This means `requestUpgradeCore` never touches `next/cache`, so Vitest can call it directly without a Next.js request scope. The pattern follows the RESEARCH.md guidance exactly.

**HTML escaping in email body:** A local `escapeHtml(s)` helper replaces `&`, `<`, `>`, `"`, `'` in user-supplied content (business name, message). Not a hard security boundary (email sent to Andrew only), but correct hygiene. Test #1 assertion was updated to expect `&#39;` for the apostrophe in the test message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion adjusted for escapeHtml apostrophe encoding**

- **Found during:** Task 2 (Vitest test run)
- **Issue:** Test #1 asserted `sendArgs.html.toContain("We're hitting the cap most days...")` but `escapeHtml()` correctly encodes the apostrophe as `&#39;` in the email HTML body.
- **Fix:** Updated assertion to `toContain("We&#39;re hitting the cap most days...")` — this is correct behavior, not a bug in the action. The plan's test script used a literal apostrophe in the contain check without accounting for HTML escaping.
- **Files modified:** `tests/upgrade-action.test.ts`
- **Verification:** All 9 tests pass after adjustment.
- **Committed in:** `6e884e0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test assertion correctness)
**Impact on plan:** Minor assertion fix; no behavior change in the action itself. Plan executed correctly — the escapeHtml helper is specified in the plan and was implemented as written.

## Issues Encountered

None beyond the test assertion fix above.

## User Setup Required

None — no external service configuration required for this plan. The `RESEND_API_KEY` env var is already required by Phase 36; no new env vars introduced here.

## Next Phase Readiness

- `requestUpgradeAction` is ready for Plan 03 (settings upgrade page at `/app/settings/upgrade`)
- Plan 03 imports `requestUpgradeAction` from this file as the form's submit handler
- Plan 03 reads `last_upgrade_request_at` from the account row (same column written by this action) for server-rendered locked-out countdown
- No blockers — all dependencies on disk and tested

---
*Phase: 37-upgrade-flow-and-cap-hit-ui*
*Completed: 2026-05-08*
