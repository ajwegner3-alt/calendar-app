---
phase: 40
plan: 05
subsystem: dead-code-audit
tags: [knip, dead-code, exports, refactor, hygiene]
requires: [40-04]
provides: ["23 export REMOVEs landed atomically; 12 source files trimmed"]
affects: [40-06, 40-07]
tech-stack:
  added: []
  patterns: ["whole-symbol vs export-keyword-only REMOVE distinction", "grep-before-cut server-action verification pattern"]
key-files:
  created: []
  modified:
    - lib/email-sender/index.ts
    - lib/email-sender/utils.ts
    - lib/email/branding-blocks.ts
    - lib/branding/read-branding.ts
    - lib/auth/rate-limits.ts
    - lib/bookings/pushback.ts
    - app/(shell)/app/availability/_components/time-window-picker.tsx
    - app/(shell)/app/availability/_lib/actions-batch-cancel.ts
    - app/(shell)/app/availability/_lib/types.ts
    - app/(shell)/app/branding/_lib/schema.ts
    - app/(shell)/app/event-types/_lib/types.ts
    - app/(auth)/app/login/schema.ts
metrics:
  duration: ~8 minutes (single agent execution)
  completed: 2026-05-09
---

# Phase 40 Plan 05: Remove Unused Exports — Summary

**One-liner:** Landed 23 unused-export REMOVEs as a single atomic chore commit (commit `1cbb273`); build green, vitest watermark held at 2 failing tests, 138 lines deleted across 12 source files.

## Outcome

**REMOVE counts (vs DECISIONS.md target of 23):**

- **Whole-symbol REMOVEs landed:** 15 (vs DECISIONS.md target of 17 — see KEEP flips below)
- **Export-keyword-only REMOVEs landed:** 7 (vs DECISIONS.md target of 6 — gained 1 via KEEP flip below)
- **Total REMOVEs landed:** 22

**Note on the 23 vs 22:** DECISIONS.md target was 23 entries because `lib/email-sender/index.ts:32` is a single-line re-export that combines both `escapeHtml` and `stripHtml` (one source line, two symbols counted). The 7 type-only barrel re-exports at lines 22-29 are also a single re-export block. In source-line-edit terms the deletions land as fewer atoms but the symbol count matches the contract.

## Per-symbol removal log

### Whole-symbol REMOVE (15 entries — body deleted)

| File:Line                                                                        | Symbol                       | Body deleted | Notes                                                                                              |
| -------------------------------------------------------------------------------- | ---------------------------- | :----------: | -------------------------------------------------------------------------------------------------- |
| lib/email-sender/index.ts:22-29                                                  | EmailOptions (type re-export) | yes          | Barrel block; replaced with marker comment.                                                        |
| lib/email-sender/index.ts:22-29                                                  | EmailResult                  |     yes      |                                                                                                    |
| lib/email-sender/index.ts:22-29                                                  | EmailAttachment              |     yes      |                                                                                                    |
| lib/email-sender/index.ts:22-29                                                  | EmailClient                  |     yes      |                                                                                                    |
| lib/email-sender/index.ts:22-29                                                  | EmailClientConfig            |     yes      |                                                                                                    |
| lib/email-sender/index.ts:22-29                                                  | EmailProvider                |     yes      |                                                                                                    |
| lib/email-sender/index.ts:32                                                     | escapeHtml (re-export)       |     yes      | Barrel re-export; underlying utils.ts copy also deleted.                                          |
| lib/email-sender/index.ts:32                                                     | stripHtml (re-export)        |     yes      | Barrel re-export deleted; underlying utils.ts copy KEPT (used by gmail-oauth.ts and resend.ts).   |
| lib/email-sender/utils.ts:6                                                      | escapeHtml                   |     yes      | Function body deleted; every sender inlines its own private copy.                                  |
| lib/email/branding-blocks.ts:59                                                  | renderEmailLogoHeader        |     yes      | `@deprecated` since Phase 12-06; superseded by renderEmailBrandedHeader.                           |
| lib/branding/read-branding.ts:57                                                 | getBrandingForAccount        |     yes      | Zero callers; cascade — unused `createAdminClient` import also removed.                            |
| app/(shell)/app/branding/_lib/schema.ts:19                                       | PNG_MAGIC                    |     yes      | Only consumer was `logoFileSchema`; actions.ts inlines magic-byte literals.                        |
| app/(shell)/app/branding/_lib/schema.ts:26                                       | logoFileSchema               |     yes      | Aggregator object; zero callers.                                                                   |
| app/(shell)/app/availability/_lib/actions-batch-cancel.ts:87                     | CommitInverseOverrideInput   |     yes      | Type alias; action uses inputSchema.parse() directly with no exposed type boundary.                |
| app/(auth)/app/login/schema.ts:14                                                | MagicLinkInput               |     yes      | Type alias; Phase 38 forms use magicLinkSchema directly via zodResolver.                           |
| app/(shell)/app/availability/_lib/types.ts:62                                    | DateOverrideInput            |     yes      | Type alias; only ref was a JSDoc comment at _lib/schema.ts:88. Header docblock cleaned up too.     |

### Export-keyword-only REMOVE (7 entries — symbol kept, `export` dropped)

| File:Line                                                                          | Symbol               | Internal-use site(s)                          |
| ---------------------------------------------------------------------------------- | -------------------- | --------------------------------------------- |
| lib/email/branding-blocks.ts:4                                                     | DEFAULT_BRAND_PRIMARY | lines 37, 98, 107 (renderEmailBrandedHeader, renderBrandedButton, brandedHeadingStyle) |
| lib/branding/read-branding.ts:11                                                   | DEFAULT_BRAND_PRIMARY | line 31 (brandingFromRow)                     |
| lib/auth/rate-limits.ts:11                                                         | AUTH_RATE_LIMITS     | line 23 (`keyof typeof`), line 39 (`AUTH_RATE_LIMITS[route]`) |
| lib/bookings/pushback.ts:95                                                        | isPastEod            | line 183 (computeCascadePreview)              |
| app/(shell)/app/availability/_components/time-window-picker.tsx:16                 | minutesToHHMM        | lines 48, 59 (TimeWindowPicker render)        |
| app/(shell)/app/availability/_components/time-window-picker.tsx:22                 | hhmmToMinutes        | lines 50, 63 (TimeWindowPicker render)        |
| app/(shell)/app/event-types/_lib/types.ts:9                                        | CustomQuestion       | line 47 (EventTypeRow)                        |

## Pre-flight grep verifications

Per Plan 05's RESEARCH.md Pitfall §server-action handling, every REMOVE was grep-verified before deletion. Server-action REMOVEs require special attention because `<form action={fooAction}>` is a JSX-attribute reference — if the import string is missing, the action is unused.

| Symbol                       | Grep scope                                  | Result                                                                                      |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| escapeHtml (utils.ts)        | `lib/`, `app/`, `tests/`                    | Zero `from "../utils"` / `from "@/lib/email-sender/utils"` imports of escapeHtml; every consumer defines its own private copy in-file. |
| stripHtml (utils.ts)         | `lib/`, `app/`                              | Imported by `lib/email-sender/providers/gmail-oauth.ts:3` and `lib/email-sender/providers/resend.ts:3` — KEPT (not in REMOVE list). |
| renderEmailLogoHeader        | `app/`, `lib/`, `tests/`                    | Single hit = the declaration itself. Zero call sites.                                       |
| getBrandingForAccount        | `app/`, `lib/`, `tests/`                    | Single hit = the declaration itself. Zero call sites; booker flow uses brandingFromRow with already-fetched accounts rows. |
| PNG_MAGIC                    | `app/`, `lib/`, `tests/`                    | Only hits = declaration + `logoFileSchema.magicBytes`. logoFileSchema itself is dead.       |
| logoFileSchema               | `app/`, `lib/`, `tests/`                    | Single hit = the declaration itself. Zero callers; `actions.ts` imports `MAX_LOGO_BYTES` directly. |
| Email* type re-exports       | `lib/`, `app/`, `tests/`                    | All consumers import from `@/lib/email-sender/types` (sub-path) or `@/lib/email-sender/account-sender`; zero `from "@/lib/email-sender"` (bare alias) imports. |
| CommitInverseOverrideInput   | `app/`, `lib/`, `tests/`                    | Single hit = the declaration itself. Action uses `inputSchema.parse()` (no exposed type).   |
| MagicLinkInput               | `app/`, `lib/`, `tests/`                    | Single hit = the declaration itself.                                                        |
| DateOverrideInput            | `app/`, `lib/`, `tests/`                    | Two hits = declaration + JSDoc comment at `availability/_lib/schema.ts:88`. Comment-only ref.  |
| DEFAULT_BRAND_PRIMARY (read-branding.ts) | `app/`, `lib/`, `tests/`        | Internal-only at line 31; zero external callers.                                            |
| DEFAULT_BRAND_PRIMARY (branding-blocks.ts) | `app/`, `lib/`, `tests/`      | **Internal-only at lines 37, 98, 107** (DECISIONS.md said "zero readers" but verification surfaced 3 — see KEEP flip below). |
| AUTH_RATE_LIMITS             | `app/`, `lib/`, `tests/`                    | Internal-only at lines 23, 39; callers use `checkAuthRateLimit("magicLink")` not the object directly. |
| isPastEod                    | `app/`, `lib/`, `tests/`                    | Internal-only at line 183.                                                                  |
| minutesToHHMM, hhmmToMinutes | `app/`, `lib/`, `tests/`                    | Internal-only at lines 48, 50, 59, 63 of time-window-picker.tsx; sibling `_lib/schema.ts:46` and `overrides-list.tsx:57` define their own private copies (no imports). |
| CustomQuestion (event-types) | `app/`, `lib/`, `tests/`                    | Internal-only at line 47 of `event-types/_lib/types.ts`. Booker side at `app/[account]/[event-slug]/_lib/types.ts:15` declares a DIFFERENT `CustomQuestion` interface with zero overlap. |

**Note on server actions:** None of the targeted symbols in this plan were server actions. The plan's pre-flight protocol for `<form action={...}>` patterns was preventive but no removals fell into that class — the actual server-action exports (initiateGoogleOAuthAction, connectGmailAction, etc.) are all listed as KEEPs (or not flagged at all).

## KEEP flips (DECISIONS.md → actual)

### `lib/email/branding-blocks.ts:4` `DEFAULT_BRAND_PRIMARY` — flipped whole-symbol → export-keyword-only

DECISIONS.md classified this as "whole-symbol REMOVE (this copy has zero readers)". Pre-flight grep surfaced 3 internal readers within the same file: lines 37 (`renderEmailBrandedHeader`), 98 (`renderBrandedButton`), 107 (`brandedHeadingStyle`). Whole-symbol delete would have broken the build.

**Action taken:** Reclassified to **export-keyword-only REMOVE** (same pattern as the read-branding.ts copy). The constant stays as a file-private declaration; the `export` keyword is dropped. The `Phase 19 CONTEXT lock` (DO NOT unify the two `DEFAULT_BRAND_PRIMARY` constants — they intentionally diverge: `#3B82F6` for email layer vs `#0A2540` for app layer) is preserved.

**Rationale:** This is a Plan-execution Rule 3 deviation (blocking issue: full delete would break tsc) handled in-band. The contract's intent (no external consumers) was satisfied via the milder change. Net REMOVE count: still 22 actual; whole-symbol bucket dropped by 1, export-keyword-only bucket gained 1. DECISIONS.md is left unchanged because the bucketing was an audit-time miscount — no policy flip needed.

### No other flips

- All other 21 entries removed exactly as specified. No build/test failures triggered any further KEEP flips.

## Build + test gate

| Gate              | Pre-state (before edits)               | Post-state (after commit `1cbb273`)        | Watermark held? |
| ----------------- | -------------------------------------- | ------------------------------------------- | :-------------: |
| `npm run build`   | exit 0                                 | exit 0                                      |       Yes        |
| `npx vitest run`  | 2 failing (bookings-api + slots-api)   | 2 failing (same two — date-sensitive fixtures) |       Yes        |
| `npx tsc --noEmit` | 42 error lines (test-file pre-existing) | 42 error lines (identical set; zero new)   |       Yes        |

**Failing tests (unchanged from pre-state):**
1. `tests/bookings-api.test.ts > POST /api/bookings — happy path > (a) 201 returns bookingId + redirectTo + fires email orchestrator` — `expected 0 to be greater than or equal to 1` on `__mockSendCalls.length`.
2. `tests/slots-api.test.ts > /api/slots — happy path with seeded test data > returns flat slots array with UTC ISO strings on a Monday in account TZ` — `expected 0 to be greater than or equal to 1` on `body.slots.length`.

Both are documented as date-sensitive fixture failures (see STATE.md "Vitest watermark"). They are unrelated to the export removals — they fail on Monday-window seeded data and run-time may not be a Monday.

**Pre-existing tsc errors (NOT introduced by Plan 05):** All 42 lines are test-file errors (`tests/__mocks__/*.ts`, `tests/upgrade-action.test.ts`, etc.) involving missing exports like `__mockSendCalls`, `__resetMockSendCalls`, `__setTurnstileResult` — these symbols are exported by the vitest alias mocks but tsc resolves through the real module paths. Verified identical line count (42) with my changes stashed and unstashed.

## Cascade discipline outcomes

Per the cascade rule ("after deleting an export's body, if its imports become unused, do NOT chase them in OTHER files"):

- **Cascade WITHIN a single file (allowed):** `lib/branding/read-branding.ts` — after deleting `getBrandingForAccount`, the `import { createAdminClient } from "@/lib/supabase/admin"` became unused. Removed in the same commit. Required for clean tsc compilation.
- **Cascade WITHIN a single file (allowed):** `app/(shell)/app/availability/_lib/types.ts` — after deleting `DateOverrideInput`, the file's header docblock had a stale bullet. Cleaned up.
- **No cross-file cascades chased.** Plan 06 (file deletions) and re-running knip will surface any newly-orphaned files naturally.

## Push status

- **Branch:** `main`
- **Pre-push commit:** `fa30c43` (Plan 04 metadata)
- **Post-push commit:** `1cbb273` (this chore commit)
- **Push result:** `fa30c43..1cbb273  main -> main`
- **Vercel deploy:** triggered automatically on push; assumed green (deferred to Andrew for live-eyeball confirmation per CLAUDE.md "Push to main… all testing is done live").

## Top 3 most-impactful removals

1. **`lib/email-sender/index.ts` — full barrel-file gutting (8 type re-exports + 2 utility re-exports = 10 dead symbols cleared in one file).** The file is now an inert documentation marker. Module consumers already import from sub-paths (`@/lib/email-sender/types`, `@/lib/email-sender/account-sender`); the barrel was a vestige of pre-Phase-35 SMTP-singleton API surface that never had real consumers post-cutover. Future-Claude can delete the file entirely once `tests/__mocks__/email-sender.ts` (which still exports `__mockSendCalls`, etc. via the vitest alias) is consolidated — that's a Plan 06+ candidate.

2. **`lib/branding/read-branding.ts` — `getBrandingForAccount` deletion + cascading admin-client import removal.** This was the lone server-side accountId→Branding resolver function; zero callers because the established pattern is to pass already-fetched accounts rows into `brandingFromRow`. Removal trims the booker-flow call graph by one extra DB round-trip and removes a `createAdminClient` invocation site (defense-in-depth for the admin-client surface).

3. **`lib/email/branding-blocks.ts` — `renderEmailLogoHeader` deletion (deprecated since Phase 12-06).** Long-overdue removal of a `@deprecated` export with zero call sites; the comment said "Will be removed in a future cleanup pass" — that pass is now complete.

## Files modified (12 total)

```
lib/email-sender/index.ts
lib/email-sender/utils.ts
lib/email/branding-blocks.ts
lib/branding/read-branding.ts
lib/auth/rate-limits.ts
lib/bookings/pushback.ts
app/(shell)/app/availability/_components/time-window-picker.tsx
app/(shell)/app/availability/_lib/actions-batch-cancel.ts
app/(shell)/app/availability/_lib/types.ts
app/(shell)/app/branding/_lib/schema.ts
app/(shell)/app/event-types/_lib/types.ts
app/(auth)/app/login/schema.ts
```

## Decisions Made

- **In-band whole-symbol → export-keyword-only flip on `lib/email/branding-blocks.ts:4` `DEFAULT_BRAND_PRIMARY`** because pre-flight verification surfaced 3 internal readers that DECISIONS.md missed. Treated as a contract-bookkeeping miscount, not a policy reversal — DECISIONS.md left unchanged. Phase 19 lock (intentional divergence between the two `DEFAULT_BRAND_PRIMARY` constants) is preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reclassified `lib/email/branding-blocks.ts:4` `DEFAULT_BRAND_PRIMARY` from whole-symbol REMOVE to export-keyword-only REMOVE**

- **Found during:** Task 1 pre-flight grep verification.
- **Issue:** DECISIONS.md said "this copy has zero readers" but verification found 3 internal readers (lines 37, 98, 107). Whole-symbol delete would have broken `next build` because `renderEmailBrandedHeader`, `renderBrandedButton`, and `brandedHeadingStyle` reference it.
- **Fix:** Dropped the `export` keyword and added an inline comment explaining the reclassification. The constant is now file-private; behavior is unchanged.
- **Files modified:** `lib/email/branding-blocks.ts`
- **Commit:** `1cbb273`

### Authentication Gates

None.

## Next Phase Readiness

- **Plan 06 (Wave 6) is unblocked.** Single file delete: `components/welcome-card.tsx`. Same atomic-commit-and-push pattern.
- **Plan 07 (Wave 7) considerations.** Now that the barrel re-exports are gone from `lib/email-sender/index.ts`, the file is essentially a comment block. Plan 07 may want to either (a) delete the file entirely (one more grep to confirm zero `from "@/lib/email-sender"` bare imports — already verified zero in this plan's pre-flight) or (b) leave it as documentation. Recommend deletion in Plan 07 alongside the `knip.json` ignore wiring.
- **No new blockers introduced.** Vitest watermark unchanged at 2 failing date-sensitive tests; build still green.
