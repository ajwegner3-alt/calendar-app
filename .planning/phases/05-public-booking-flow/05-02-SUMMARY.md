---
phase: 05-public-booking-flow
plan: 02
subsystem: infra
tags: [email, resend, ical, turnstile, vendor, server-only]

# Dependency graph
requires:
  - phase: 05-01
    provides: accounts.owner_email seeded (needed by email notifications downstream)
provides:
  - lib/email-sender vendored module (sendEmail, createEmailClient, types, utils)
  - ical-generator + timezones-ical-library npm deps (for .ics attachment in 05-03+)
  - @marsidev/react-turnstile npm dep (for bot protection in booking form 05-04+)
  - resend npm dep (Resend SDK peer dep)
  - .env.example documented with TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL
affects: [05-03, 05-04, 05-05, 06-01, 08-01]

# Tech tracking
tech-stack:
  added:
    - resend ^6.12.2 (Resend SDK — transactional email)
    - ical-generator ^10.2.0 (calendar .ics attachment generation)
    - timezones-ical-library ^2.1.3 (timezone-aware ical support)
    - "@marsidev/react-turnstile ^1.5.0 (Cloudflare Turnstile React component)"
  patterns:
    - "Vendor pattern: copy sibling lib into lib/<name>/ rather than npm install ../path (Vercel incompatible)"
    - "server-only guard on lib/email-sender/index.ts (mirrors lib/supabase/admin.ts)"

key-files:
  created:
    - lib/email-sender/index.ts
    - lib/email-sender/types.ts
    - lib/email-sender/providers/resend.ts
    - lib/email-sender/utils.ts
  modified:
    - package.json
    - package-lock.json
    - .env.example

key-decisions:
  - "Vendored utils.ts (not in plan spec): providers/resend.ts imports stripHtml from ../utils — must be included in minimal set"
  - "Lint pre-existing failure: ESLint 9 + eslint-config-next circular JSON on Node v24 — not introduced by this plan; build exits 0"

patterns-established:
  - "Vendor pattern: lib/<tool>/ copies sibling src files + adds import 'server-only' + surgically removes out-of-scope providers"
  - "Gmail removed: createGmailClient import + dispatch branch deleted from vendored index.ts (Phase 5 Resend-only)"

# Metrics
duration: ~15min
completed: 2026-04-25
---

# Phase 5 Plan 02: Vendor Email Sender + Deps Summary

**Vendored @nsi/email-sender into lib/email-sender/ (4 files, Resend-only, server-only gated) and installed ical-generator, timezones-ical-library, @marsidev/react-turnstile, resend**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-25T21:14:55Z
- **Completed:** 2026-04-25T21:30:00Z (estimated)
- **Tasks:** 1/2 complete (Task 2 is checkpoint — awaiting Andrew)
- **Files modified:** 7

## Accomplishments

- Vendored @nsi/email-sender from sibling into lib/email-sender/ with server-only gate
- Surgically removed gmail provider + templates from vendored index.ts (Resend-only scope)
- Included utils.ts (not in plan spec) — required by providers/resend.ts for stripHtml
- Installed 4 npm deps: ical-generator, timezones-ical-library, @marsidev/react-turnstile, resend
- Documented 4 new env vars in .env.example with test key instructions for local dev
- npm run build exits 0; lint failure is pre-existing Node v24/ESLint 9 tooling conflict

## Task Commits

1. **Task 1: Vendor @nsi/email-sender + install ical/turnstile/resend deps** - `6efa13f` (feat)
2. **Task 2: Andrew sets Turnstile + Resend env vars** — PENDING CHECKPOINT

## Files Created/Modified

- `lib/email-sender/index.ts` — sendEmail() entry point with server-only guard; gmail removed
- `lib/email-sender/types.ts` — EmailInput, EmailAttachment, EmailResult, EmailClient types
- `lib/email-sender/providers/resend.ts` — Resend SDK provider implementation
- `lib/email-sender/utils.ts` — escapeHtml + stripHtml utilities (peer dep of resend provider)
- `package.json` — 4 new dependencies added
- `package-lock.json` — lockfile updated
- `.env.example` — 4 new env var blocks documented with test keys + Cloudflare/Resend instructions

## Sibling Files Copied

| Source (email-sender/src/) | Destination (lib/email-sender/) | Modification |
|---|---|---|
| index.ts | index.ts | Added `import "server-only"` line 1; removed gmail import + branch; removed template imports/exports |
| types.ts | types.ts | Verbatim copy + vendor header |
| providers/resend.ts | providers/resend.ts | Verbatim copy + vendor header |
| utils.ts | utils.ts | Verbatim copy + vendor header (deviation: required by resend.ts) |

**NOT copied:** providers/gmail.ts, templates/ directory

## Decisions Made

- utils.ts included in minimal vendor set (plan said "check index.ts imports" — resend.ts imports stripHtml from utils)
- Gmail dispatch branch deleted entirely (not just commented out) — cleaner code, easier to diff if re-sync needed
- Resend version ^6.12.2 installed (sibling pinned ^4.0.0 — latest stable used; API compatible)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vendored utils.ts alongside the 3 specified files**

- **Found during:** Task 1 (reading providers/resend.ts)
- **Issue:** providers/resend.ts imports `stripHtml` from `../utils` — without utils.ts the build would fail
- **Fix:** Copied utils.ts from sibling into lib/email-sender/utils.ts as part of minimal vendor set
- **Files modified:** lib/email-sender/utils.ts (new)
- **Verification:** npm run build exits 0
- **Committed in:** 6efa13f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking — missing required vendor file)
**Impact on plan:** Essential for build to pass. No scope creep — utils.ts is a pure utility, no external deps.

## Issues Encountered

- **ESLint circular JSON error (pre-existing):** `npm run lint` exits 2 with a circular structure JSON error in `@eslint/eslintrc`. Root cause: ESLint 9 + eslint-config-next + Node v24 tooling conflict. Confirmed pre-existing by git stash verification. Build (`npm run build`) exits 0. This is tracked as pre-existing technical debt.

## User Setup Required

**Task 2 is a blocking checkpoint.** Andrew must complete before Phase 5 downstream plans (05-03+) can proceed:

1. Create Cloudflare Turnstile site (Invisible widget, domains: calendar-app-xi-smoky.vercel.app + localhost)
2. Copy Site key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and Secret key → `TURNSTILE_SECRET_KEY`
3. Create Resend API key → `RESEND_API_KEY`; set `RESEND_FROM_EMAIL=onboarding@resend.dev`
4. Populate `.env.local` with all 4 keys
5. Add same 4 keys to Vercel Production (+ Preview) environment variables
6. Trigger redeploy on Vercel

## Next Phase Readiness

- lib/email-sender is ready to import via `@/lib/email-sender` in Phase 5 booking route
- ical-generator and timezones-ical-library ready for .ics attachment builder (05-03)
- @marsidev/react-turnstile ready for booking form component (05-04)
- **BLOCKED:** Downstream plans must NOT ship until Andrew completes Task 2 checkpoint and env vars are set in both local + Vercel Production

---
*Phase: 05-public-booking-flow*
*Completed: 2026-04-25 (partial — Task 2 checkpoint pending)*
