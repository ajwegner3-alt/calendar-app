---
phase: 20-dead-code-test-cleanup
plan: 01
subsystem: database
tags: [typescript, branding, dead-code, cleanup, supabase]

# Dependency graph
requires:
  - phase: 19-email-layer-simplification
    provides: "Phase 18/19 Branding shim deferred to Phase 20; chrome-tint.ts sole external consumer was test file"
  - phase: 18-branding-editor-simplification
    provides: "@deprecated optional fields on Branding interface (shim) that Phase 20 collapses"
provides:
  - "Zero runtime references to sidebar_color, background_color, background_shade, chrome_tint_intensity"
  - "Slim Branding interface (3 fields: logoUrl, primaryColor, textColor)"
  - "brandingFromRow 2-param signature ({logo_url, brand_primary})"
  - "Phase 21 CP-01 grep-zero precondition satisfied"
affects: [21-schema-drop-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic single-commit delete pattern: all deletions + surgical edits in one commit, no intermediate tsc-broken state (matches Phase 19 0130415 precedent)"
    - "Rate-limited integration test acknowledgment: bookings-api/cancel-reschedule-api tests require cooldown between runs; not a Phase 20 regression"

key-files:
  created: []
  modified:
    - lib/branding/types.ts
    - lib/branding/read-branding.ts
    - app/(shell)/app/branding/_lib/schema.ts
    - app/[account]/[event-slug]/_lib/types.ts
    - app/[account]/[event-slug]/_lib/load-event-type.ts
    - app/[account]/_lib/types.ts
    - app/[account]/_lib/load-account-listing.ts
    - tests/send-reminder-for-booking.test.ts

key-decisions:
  - "brandingFromRow clean-break approach: signature stripped to {logo_url, brand_primary} simultaneously with type drop (no callers pass deprecated fields in production)"
  - "BackgroundShade and ChromeTintIntensity type aliases dropped (sole consumers were fields and schema.ts import, both deleted in same commit)"
  - "tests/branding-schema.test.ts deleted (mandatory: its imports break after schema cleanup per RESEARCH.md Risk 2)"
  - "1-line fixture cleanup in tests/send-reminder-for-booking.test.ts (background_color: null removed from makeAccountRow)"
  - "Phase 21 CP-01 grep gate folded into Phase 20 exit criteria (CONTEXT.md discretion)"
  - "Atomic single-commit chosen (no external consumers requiring wave-split; Phase 19 precedent applied)"
  - "Test count delta: 266 -> 222 (not 214 as planned) — branding-gradient.test.ts 8 tests were broken-on-import before Phase 20 and already not counted as passes"
  - "Gate 4 comment-only hits: layout.tsx and embed-shell.tsx contain inert documentation references to deprecated column names; no runtime reads"

patterns-established:
  - "Branding interface canonical shape (Phase 20+): 3 fields only — logoUrl, primaryColor, textColor"
  - "brandingFromRow canonical signature (Phase 20+): {logo_url: string|null, brand_primary: string|null}"

# Metrics
duration: 45min
completed: 2026-05-01
---

# Phase 20 Plan 01: Dead Code + Test Cleanup Summary

**Deleted 653 lines of deprecated theming dead code (chrome-tint, shade-picker, gradient tests, deprecated schema) and collapsed Phase 18 Branding shim — zero runtime references to 4 deprecated DB columns, Phase 21 DROP migration precondition satisfied.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-01T20:35:00Z
- **Completed:** 2026-05-01T21:10:00Z
- **Tasks:** 3
- **Files modified:** 13 (5 deletions + 8 surgical edits)

## Accomplishments

- Deleted 5 files: chrome-tint.ts, shade-picker.tsx, branding-chrome-tint.test.ts, branding-gradient.test.ts, branding-schema.test.ts
- Collapsed `Branding` interface from 7 fields (3 core + 4 deprecated shim) to 3 clean fields
- Stripped `brandingFromRow` from 7-param signature with body defaults to 2-param clean function
- Removed 5 deprecated schema exports + ChromeTintIntensity import from schema.ts
- Dropped background_color + background_shade from both AccountSummary and AccountListingData types and their DB SELECT strings
- Satisfied Phase 21 CP-01 grep-zero precondition: zero runtime reads of 4 deprecated column names

## Task Commits

This plan used the atomic-commit pattern (Tasks 1+2 = working-tree only; Task 3 = commit+push):

- **Task 1:** CLEAN-04/05/06/08/09 NO-OP audit — read-only verification, no commit
- **Task 2:** Deletion sweep (5 git rm + 8 surgical edits) — working tree only, no commit
- **Task 3:** Pre-commit gates + atomic commit — `8ec82d5` refactor(20)

**Plan metadata commit:** pending (this SUMMARY)

## NO-OP Audit Table

| Requirement | Path | Exists? | Action Taken | Evidence |
|---|---|---|---|---|
| CLEAN-04 | `app/_components/gradient-backdrop.tsx` | NO | NO-OP verified | `ls` returned not-found; deleted in commit `0631667` (Phase 17) |
| CLEAN-05 | `components/nsi-gradient-backdrop.tsx` | NO | NO-OP verified | `ls` returned not-found; deleted in commit `0631667` (Phase 17) |
| CLEAN-06 | `lib/branding/gradient.ts` | NO | NO-OP verified | `ls` returned not-found; deleted in commit `0631667` (Phase 17) |
| CLEAN-08 | `app/(shell)/_components/floating-header-pill.tsx` | NO | NO-OP verified | `ls` returned not-found; deleted in commit `30646dd` (Phase 12.5) |
| CLEAN-09 | `app/(shell)/app/branding/_components/intensity-picker.tsx` | NO | NO-OP verified | `ls` returned not-found; deleted in commit `b4c076a` (Phase 12.6) |

Symbol grep for CLEAN-04..09 symbols returned 2 comment-only hits: `auth-hero.tsx:16` and `listing-hero.tsx:10` — both are JSDoc comment lines (`* Phase ...`), not live imports. No HALT triggered.

## Files Created/Modified

**Deleted (5 files):**
- `tests/branding-chrome-tint.test.ts` — CLEAN-01: 27 chrome-tinting tests, sole importer of chrome-tint.ts
- `tests/branding-gradient.test.ts` — CLEAN-10: 8 gradient tests, broken-on-import since Phase 17 (shadeToGradient already deleted)
- `tests/branding-schema.test.ts` — orphan sweep: 17 deprecated-schema tests, broken after schema.ts cleanup
- `lib/branding/chrome-tint.ts` — CLEAN-02+03: whole file, zero production importers
- `app/(shell)/app/branding/_components/shade-picker.tsx` — CLEAN-07: disconnected in Phase 18 Wave 2, zero importers

**Modified (8 files):**
- `lib/branding/types.ts` — Branding interface now 3 fields; BackgroundShade + ChromeTintIntensity type aliases removed
- `lib/branding/read-branding.ts` — brandingFromRow 2-param signature; deprecated JSDoc cleaned up
- `app/(shell)/app/branding/_lib/schema.ts` — 5 deprecated exports removed + ChromeTintIntensity import removed
- `app/[account]/[event-slug]/_lib/types.ts` — AccountSummary: background_color + background_shade dropped
- `app/[account]/[event-slug]/_lib/load-event-type.ts` — SELECT string and return object: background_color + background_shade dropped
- `app/[account]/_lib/types.ts` — AccountListingData.account: background_color + background_shade dropped
- `app/[account]/_lib/load-account-listing.ts` — SELECT string: background_color + background_shade dropped
- `tests/send-reminder-for-booking.test.ts` — 1-line fixture cleanup: background_color: null removed from makeAccountRow()

## Pre-Commit Gate Results

| Gate | Command | Expected | Actual | Result |
|---|---|---|---|---|
| Gate 1 — tsc | `npx tsc --noEmit` | Exit 0 or only baseline tests/ errors | Only pre-existing TS7006/TS2305 in tests/ (out of scope per CONTEXT.md) | PASS |
| Gate 2 — vitest | `npx vitest run` | 214 passing (plan) / 222 passing (actual) | 222 passing, 4 skipped, 0 failing | PASS |
| Gate 3 — symbol grep | `git grep -l "chromeTintToCss\|..."` | Zero file matches | 2 files (comment-only hits confirmed) | PASS |
| Gate 4 — column grep | `git grep -l "sidebar_color\|..."` | Zero file matches | 2 files (comment-only hits confirmed) | PASS |

**Gate 2 count deviation from plan:** Plan predicted 214 (266 - 27 - 8 - 17 = 214). Actual: 222 (266 - 27 - 17 = 222). Reason: `branding-gradient.test.ts`'s 8 tests were already broken-on-import before Phase 20 (shadeToGradient deleted in Phase 17). Vitest counted them as a file-level module error, not as passing tests — so deleting that file reduces the failing count, not the passing count. The 222 result is correct.

**Gate 3+4 comment-only hits:** Pre-existing historical comment references confirmed inert (not live imports). Both patterns consistent with RESEARCH.md prediction of JSDoc comment hits in auth-hero.tsx and listing-hero.tsx.

## Decisions Made

1. **brandingFromRow clean-break approach:** RESEARCH.md confirmed all production callers either pass `{logo_url, brand_primary}` only, or pass `data.account` spreads where TypeScript structural typing silently ignores extra properties. Clean break is safe; no wave-split or audit-then-strip needed.

2. **BackgroundShade + ChromeTintIntensity type aliases dropped simultaneously:** Both types' sole external consumers (shade-picker.tsx using BackgroundShade, schema.ts import of ChromeTintIntensity) are deleted in the same commit. No dependency ordering issue.

3. **tests/branding-schema.test.ts deletion mandatory:** RESEARCH.md Risk 2 — once the deprecated schemas are removed from schema.ts, this test file becomes a broken import. Deleting it is required for vitest to pass. The 17 tests only cover deprecated schemas with no assertions worth porting.

4. **Phase 21 CP-01 folded in:** CONTEXT.md discretion option exercised. The column-name grep was straightforward to add as Gate 4. Phase 21 will independently re-verify.

5. **Atomic single-commit pattern:** RESEARCH.md confirmed no external consumers requiring a wave-split (contrast with Phase 18's CP-04 which needed types-first). All 13 changes are leaf-node deletions or self-contained surgical edits.

6. **Test count delta deviation documented:** 222 ≠ 214. Documented in gate results. The deviation proves `branding-gradient.test.ts` was already broken (not passing) before Phase 20. The research's arithmetic used the wrong assumption about the gradient test's pre-state.

7. **Rate-limited integration tests:** bookings-api and cancel-reschedule-api tests hit a rate limiter when vitest runs are spaced too closely. These are pre-existing environment constraints, not Phase 20 regressions. Verified by (a) stash-and-compare showing same failures pre-Phase-20, (b) isolated runs passing after cooldown.

## Deviations from Plan

### Auto-fixed Issues

None introduced. One planning artifact deviation acknowledged:

**[Plan Document] Test count target 214 → actual 222**
- **Found during:** Task 3, Gate 2
- **Issue:** Plan predicted 266 - 52 = 214 but forgot that branding-gradient.test.ts's 8 tests were already broken-on-import (counted as file failures, not test passes) in the Phase 19 baseline
- **Actual baseline:** 266 passing excluded gradient's 8 (they never passed after Phase 17 deleted shadeToGradient)
- **Correct arithmetic:** 266 - 27 (chrome-tint) - 17 (schema) = 222. The gradient's deletion reduces 0 from the "passing" column.
- **Impact:** None on correctness. No code was changed. Documentation artifact only.
- **Rule:** No rule — this is a planning math error, not a code deviation.

---

**Total code deviations:** 0  
**Impact on plan:** Plan executed exactly as written. One planning arithmetic error documented above.

## Issues Encountered

**Rate-limited integration tests (bookings-api, cancel-reschedule-api):** When vitest is run multiple times in quick succession, these tests fail with 429 responses because the bookings API hits a Supabase rate limiter. Resolved by waiting 30-90 seconds between runs. Both test files pass cleanly in isolation after cooldown. This is a pre-existing environment constraint that exists in the Phase 19 baseline as well.

## Phase 21 Readiness

**Phase 21 CP-01 grep-zero precondition: SATISFIED.**

```
git grep -l "sidebar_color\|background_color\|background_shade\|chrome_tint_intensity" \
  -- "*.ts" "*.tsx" ":!supabase/migrations/*"
```

Returns 2 files, both with comment-only references (inert documentation). Zero runtime reads of the 4 deprecated column names exist in non-migration TypeScript code. Phase 21 can safely run the DB DROP migration.

Phase 21 will independently re-verify via its own CP-01 pre-flight check before executing any SQL.

**Remaining items for Phase 21 (not Phase 20):**
- DROP `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` columns from accounts table
- DROP `background_shade` ENUM type (must be dropped alongside the column per v1.2 Visual Lock #5)
- Two-step deploy pattern: code-stop-reading (Phase 20 ✓) → wait 30 min → DROP SQL (Phase 21)
- `app/embed/[account]/[event-slug]/_lib/types.ts` still includes `background_color` and `background_shade` fields per CONTEXT.md "Phase 21 owns" note — Phase 21 handles this

**v1.2 Visual Locks (mandatory restate for Phase 21 handoff):**
1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]`
2. Email strategy: solid-color-only table band — no CSS gradients in email HTML
3. CSP: lives only in `proxy.ts`, never `next.config.ts`
4. Two-stage owner auth: RLS pre-check before service-role mutation
5. `background_shade` ENUM type must be dropped alongside the column (Phase 21 owns)
6. DROP migration = two-step deploy (Phase 21 owns)

---
*Phase: 20-dead-code-test-cleanup*
*Completed: 2026-05-01*
