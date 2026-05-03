---
phase: 26-bookings-page-crash-debug-fix
subsystem: debugging
tags: [nextjs, rsc, server-components, bookings, crash-fix, regression-test, vitest]

# Dependency graph
requires:
  - phase: 08-bookings
    provides: bookings-table.tsx where the RSC boundary violation was introduced (commit 52ea36d)

provides:
  - Root cause confirmed: RSC boundary violation at bookings-table.tsx:93 (digest 2914592434)
  - Surgical fix: onClick deleted from tel: anchor — 1-line change
  - Regression test: tests/bookings-table-rsc-boundary.test.ts (static source scan)
  - Cross-account verification: 4 live shapes passed, 3 waived (no production data)
  - Phase SUMMARY consolidating diagnosis + fix + verification

affects:
  - Phase 27 (deferred fragility sites: unguarded TZDate at bookings-table.tsx:37, normalization undefined at queries.ts:92-94, unguarded throw at queries.ts:86)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grep-first diagnosis: search for onClick in RSC files before reading full component"
    - "Static source-text regression test for RSC boundary constraints: read file as text, regex-assert no function prop in RSC-unsafe element block"

key-files:
  created:
    - .planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md
    - tests/bookings-table-rsc-boundary.test.ts
  modified:
    - app/(shell)/app/bookings/_components/bookings-table.tsx

key-decisions:
  - "RSC boundary violation confirmed as root cause — NOT Candidates A-E (data-layer hypotheses from RESEARCH.md)"
  - "Fix is 1-line deletion of onClick prop only — no other files need modification"
  - "Test shape: Option 1 (static text scan) — zero new dependencies, catches exactly this regression class"
  - "Deferred fragilities (TZDate, normalization undefined, throw guard) intentionally not fixed — strict-fix bias per V14-MP-04"
  - "Cross-account verification: 4 shapes live-verified; 3 shapes waived (Q2/Q3/Q4 returned 0 production rows)"

patterns-established:
  - "RSC Server Component constraint test: read source as fs text, assert absence of function prop in target HTML element block"
  - "Shape-based verification matrix: enumerate account × data-shape combinations; auto-waive shapes with no production data"

# Metrics
duration: ~3 sessions (diagnose → fix → verify)
completed: 2026-05-03
---

# Phase 26: Bookings Page Crash Debug + Fix — Phase Summary

**RSC boundary violation at `bookings-table.tsx:93` diagnosed and fixed: deleted `onClick` from Server Component `<a href="tel:">` element that Next.js could not serialize across the Server→Client boundary (digest 2914592434); fix verified live across 4 production account shapes.**

## Root Cause

`bookings-table.tsx` is a Server Component (no `"use client"` directive). It rendered:

```tsx
<a href={`tel:${row.booker_phone}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
```

Next.js's RSC payload serializer (`stringify`) cannot serialize the `onClick` function prop across the Server→Client boundary. It throws **digest `2914592434`** before any HTML reaches the browser.

**Trigger condition:** At least one booking with a non-null `booker_phone` returned by `queryBookings`. Accounts with zero non-null phone bookings would have seen the page render, masking the bug during early development.

**Regression timeline:** The `onClick` was present since `52ea36d feat(08-06): bookings table with status badges and row links` (2026-04-26). The bookings list page has never successfully rendered for accounts with phone-bearing bookings.

**Original 5 research candidates (A–E) were all data-layer hypotheses.** All invalidated by the Vercel log evidence. The actual root cause is UI-tree (RSC boundary), not data-layer.

## Fix Applied

**File:** `app/(shell)/app/bookings/_components/bookings-table.tsx`  
**Line:** 93  
**Change:** Deleted `onClick={(e) => e.stopPropagation()}`  
**Commit:** `8e3116b`

The `stopPropagation` intent was defensive noise, not functional necessity. The `<a href="tel:...">` nests inside a `<Link>`, but native browser behavior already handles this correctly — clicking a child `<a>` does not trigger the parent `<Link>`'s navigation because the browser follows the innermost anchor's `href`.

**Regression test added:** `tests/bookings-table-rsc-boundary.test.ts` (`359f4f1`) — reads `bookings-table.tsx` as `fs.readFileSync` text, regex-isolates the `<a href="tel:...">` block, asserts no `onClick=` within it. Verified: FAILS when onClick is re-introduced, PASSES with fix. Zero new dependencies.

## Verification Matrix

**Date:** 2026-05-03  
**Verified by:** Andrew (live production browser)

| Shape | Account | Data condition | Expected | Result |
|-------|---------|----------------|----------|--------|
| 1 | NSI (`nsi`) | Real bookings with non-null phones | Page renders, booking list visible | PASS |
| 2 | nsi-rls-test | Empty account (no bookings) | Page renders, empty state | PASS |
| 3 | nsi-rls-test-3 | Empty account (no bookings) | Page renders, empty state | PASS |
| 4 | NSI + `?status=cancelled` | Filter: cancelled bookings | Page renders with filter applied | PASS |
| 5 | — | Account with ONLY cancelled bookings | — | WAIVED — 0 production rows |
| 6 | — | Account with >50 bookings (pagination) | — | WAIVED — 0 production rows |
| 7 | — | Account with soft-deleted event_type | — | WAIVED — 0 production rows |

Shapes 5–7 waived because Q2/Q3/Q4 returned 0 rows in production SQL queries. No data exists to exercise those shapes; they are not relevant risks given the current database state.

**Andrew sign-off:** "Everything looks good." — 2026-05-03

## Deferred Findings

These fragility sites were observed during diagnosis and intentionally not fixed per strict-fix bias (V14-MP-04). They are NOT causes of the current crash.

1. **Candidate C — unguarded `TZDate` at `bookings-table.tsx:37`**  
   `new TZDate(new Date(row.start_at), row.booker_timezone)` will throw `RangeError` if `booker_timezone` is null, empty, or invalid IANA identifier. Currently safe in production (all live bookings have valid timezones). Live crash risk for any future booking with a bad timezone. Flag for Phase 27.

2. **Candidate B — normalization yields `undefined` at `queries.ts:92-94`**  
   If `event_types` join returns `[]`, normalization produces `undefined`. Downstream uses `?.` optional chaining so safe today. Future consumers must not assume non-null. Flag for Phase 27 housekeeping.

3. **Candidate A — `if (error) throw error` at `queries.ts:86`**  
   Unguarded Supabase error rethrow; no try/catch at `page.tsx:46` (`Promise.all`). A PostgREST error produces an unhandled rejection → generic 500. Not the current crash; flag for Phase 27.

4. **DOCUMENT-RISK — `load-month-bookings.ts:47`**  
   `event_types!inner` join with optional-chain only (no normalization). Safe for current callers. Track if future callers access `event_types.account_id` without `?.`.

## Files of Record

| File | Role |
|------|------|
| `.planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md` | Full crash diagnosis: mechanism, reproduction, fix shape, deferred findings |
| `app/(shell)/app/bookings/_components/bookings-table.tsx` | Source of the fix (onClick deleted at line 93) |
| `tests/bookings-table-rsc-boundary.test.ts` | Regression test (static text scan, Option 1) |
| `.planning/phases/26-bookings-page-crash-debug-fix/26-02-SUMMARY.md` | !inner grep audit table (11 join sites audited) |

## Phase Stats

| Metric | Value |
|--------|-------|
| Plans | 3 (diagnose → fix → verify) |
| Tasks | ~9 across 3 plans |
| Source commits | 4 (`ed7eb22`, `8cbfca9`, `8e3116b`, `359f4f1`) |
| Files changed (source) | 2 (`bookings-table.tsx`, `tests/bookings-table-rsc-boundary.test.ts`) |
| Net LOC delta | −1 source line (onClick deleted); +35 test lines |
| Test suite at close | 224 passing + 4 skipped (up from 222 baseline) |
| Build time (Vercel) | 54s — Ready |
| Phase duration | 2026-05-03 (single day) |

---
*Phase: 26-bookings-page-crash-debug-fix*
*Completed: 2026-05-03*
*Andrew sign-off: 2026-05-03*
