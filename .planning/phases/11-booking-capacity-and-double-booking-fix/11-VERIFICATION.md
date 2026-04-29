---
phase: 11-booking-capacity-and-double-booking-fix
verified: 2026-04-29T21:40:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: Visit a booking page for an event type with show_remaining_capacity=true and max_bookings_per_slot > 1.
    expected: Slot buttons display X spots left or 1 spot left.
    why_human: Conditional rendering requires a live app serving a real API response with remaining_capacity.
  - test: Trigger a 409 SLOT_CAPACITY_REACHED and a 409 SLOT_TAKEN. Compare banner messages.
    expected: SLOT_CAPACITY_REACHED shows That time is fully booked. SLOT_TAKEN shows That time was just taken by another booker.
    why_human: Exercising both 409 codes requires a live race scenario or mock server.
  - test: Set SUPABASE_DIRECT_URL in .env.local. Re-run npm run test. Confirm CAP-06 describe un-skips.
    expected: All 148 existing tests pass. capacity=3/N=10 exactly 3 successes. capacity=1/N=5 exactly 1 success.
    why_human: SUPABASE_DIRECT_URL not set; hasDirectUrl() returns false; CAP-06 block is skip-guarded.
  - test: In event-type edit form reduce max_bookings_per_slot below confirmed booking count at a future slot. Click Save.
    expected: AlertDialog appears with affected slot count. Clicking Reduce capacity anyway saves successfully.
    why_human: Over-cap pre-check and AlertDialog flow require a live Supabase session with real booking rows.
---
# Phase 11: Booking Capacity + Double-Booking Fix -- Verification Report

**Phase Goal:** An owner can configure max_bookings_per_slot per event type (default 1, preserving v1.0 behavior) and trust that concurrent submissions cannot exceed that cap.

**Verified:** 2026-04-29T21:40:00Z
**Status:** human_needed (all automated checks pass; 4 items require live-app or env-var confirmation)
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 2026-04-27 prod double-booking root-caused and documented before replacement mechanism shipped | VERIFIED | 11-01-CAP-01-FINDINGS.md: 6-step query investigation; verdict (c) rescheduled-status slot reuse structural gap; zero confirmed duplicates on prod; Andrew approved 2026-04-28 |
| 2 | Owner can set max_bookings_per_slot (number input default 1 CHECK >= 1) + show_remaining_capacity toggle; over-cap decrease shows confirmation modal | VERIFIED | event-type-form.tsx lines 293-336; actions.ts lines 197-241 (CAP-09 pre-check); lines 409-443 (AlertDialog) |
| 3 | Concurrent race: at capacity=N, M > N submissions produce exactly N successes and M-N 409 responses; pg-driver test exists skip-guarded on SUPABASE_DIRECT_URL; v1.0 regression passes | VERIFIED | tests/race-guard.test.ts lines 91-281 (CAP-06 describe + skipIf guard); v1.0 test lines 9-72 passes (148 passing confirmed) |
| 4 | /api/slots excludes slot when confirmed_count >= max_bookings_per_slot; uses .eq(status confirmed); /api/bookings 409 distinguishes SLOT_TAKEN from SLOT_CAPACITY_REACHED | VERIFIED | lib/slots.ts lines 186-193 (slotConfirmedCount) + 285-286 (cap exclusion); app/api/slots/route.ts line 143; app/api/bookings/route.ts lines 256-258 |
| 5 | Booker UI shows X spots left when show_remaining_capacity=true; 409 message branches on body.code | VERIFIED (code-level) | slot-picker.tsx lines 180-184 (badge with typeof guard); booking-form.tsx lines 129-137 (code-branched messages); HUMAN NEEDED for visual |

**Score:** 5/5 truths verified at code level; 4 items require live-app confirmation.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| supabase/migrations/20260428130001_phase11_capacity_columns.sql | max_bookings_per_slot NOT NULL DEFAULT 1 CHECK >= 1; show_remaining_capacity NOT NULL DEFAULT false | VERIFIED | Lines 5-10: exact column definitions with CHECK constraint |
| supabase/migrations/20260428130002_phase11_slot_index_and_concurrent_index.sql | bookings.slot_index smallint NOT NULL DEFAULT 1; CREATE UNIQUE INDEX CONCURRENTLY bookings_capacity_slot_idx | VERIFIED | Lines 8-21: column + CONCURRENTLY index creation |
| supabase/migrations/20260428130003_phase11_drop_old_double_book_index.sql | DROP INDEX bookings_no_double_book with defensive guard verifying new index is live and valid | VERIFIED | Lines 9-20: validates bookings_capacity_slot_idx indisvalid=true before dropping |
| app/api/bookings/route.ts | slot_index retry loop 1..N; 23505 triggers retry; 409 codes SLOT_TAKEN / SLOT_CAPACITY_REACHED | VERIFIED | Lines 212-265: for loop + 23505 retry + branching at line 257; slot_index: slotIndex at line 228 |
| app/api/slots/route.ts | .eq(status confirmed) Pitfall-4 fix; passes maxBookingsPerSlot + showRemainingCapacity to computeSlots | VERIFIED | Line 143: .eq(status confirmed); lines 192-194: capacity args passed |
| lib/slots.ts | slotConfirmedCount function; CAP-04 exclusion when count >= cap; CAP-08 remaining_capacity output | VERIFIED | Lines 186-193 (slotConfirmedCount); lines 285-296 (exclusion + optional field) |
| lib/slots.types.ts | SlotInput.maxBookingsPerSlot: number; SlotInput.showRemainingCapacity?: boolean; Slot.remaining_capacity?: number | VERIFIED | Lines 78, 84, 96 respectively |
| app/(shell)/app/event-types/_components/event-type-form.tsx | max_bookings_per_slot number input; show_remaining_capacity Switch; AlertDialog for over-cap confirm | VERIFIED | Lines 293-336 (inputs); lines 409-443 (AlertDialog) |
| app/(shell)/app/event-types/_lib/actions.ts | CAP-09 over-cap pre-check using JS Map group-by; return warning capacity_decrease_overflow + details | VERIFIED | Lines 197-241: full check; return at line 236 |
| app/[account]/[event-slug]/_components/slot-picker.tsx | Slot.remaining_capacity?: number; badge rendered conditionally with typeof guard | VERIFIED | Lines 11-12 (interface field); lines 180-184 (badge JSX) |
| app/[account]/[event-slug]/_components/booking-form.tsx | 409 handler reads body.code; branches SLOT_CAPACITY_REACHED vs SLOT_TAKEN; defensive fallback | VERIFIED | Lines 122-143: reads body409.code; distinct messages for both codes |
| tests/race-guard.test.ts | CAP-06 describe with pg-driver tests; skipIf(hasDirectUrl()); capacity=3 N=10; capacity=1 N=5 regression | VERIFIED | Lines 86-281: import pgDirectClient; guard at line 89; two it() blocks |
| tests/helpers/pg-direct.ts | pgDirectClient(maxConnections); hasDirectUrl(); uses postgres package | VERIFIED | Lines 19-35: both exports; postgres import at line 17 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| event-type-form.tsx | updateEventTypeAction | onSubmit action call | WIRED | Lines 148-152: action called; lines 157-160: warning response checked |
| event-type-form.tsx | AlertDialog modal | overcapWarning state | WIRED | Lines 68-73: state; lines 158-160: set on warning; lines 409-442: open condition |
| handleOvercapConfirm | updateEventTypeAction | confirmCapacityDecrease=true bypass | WIRED | Lines 186-215: re-submit with bypass flag |
| actions.ts CAP-09 | bookings table | supabase SELECT + Map group-by | WIRED | Lines 208-229: SELECT confirmed future bookings + Map group-by logic |
| app/api/slots/route.ts | computeSlots in lib/slots.ts | maxBookingsPerSlot + showRemainingCapacity args | WIRED | Lines 192-194: explicit arg pass |
| computeSlots | slotConfirmedCount | called per-slot inside window loop | WIRED | Line 285: called; line 286: compared to maxBookingsPerSlot |
| booking-form.tsx | /api/bookings | fetch POST in onSubmit | WIRED | Lines 97-106: fetch call; lines 122-143: 409 branch reads code |
| slot-picker.tsx | /api/slots | fetch in useEffect | WIRED | Lines 60-64: fetch call; lines 65-69: response parsed into slots state |
| tests/race-guard.test.ts | tests/helpers/pg-direct.ts | import pgDirectClient + hasDirectUrl | WIRED | Line 87: named import |

---

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| CAP-01 Root-cause + document 2026-04-27 double-booking before new mechanism ships | SATISFIED | 11-01-CAP-01-FINDINGS.md complete; verdict (c); prod approval 2026-04-28 |
| CAP-02 Add max_bookings_per_slot NOT NULL DEFAULT 1 CHECK >= 1 and show_remaining_capacity | SATISFIED | Migration 20260428130001 lines 5-10 |
| CAP-03 Owner can set max_bookings_per_slot from event-type form (number input default 1) | SATISFIED | event-type-form.tsx lines 293-311; schema.ts lines 85-94 |
| CAP-04 /api/slots excludes slot once confirmed_count >= max_bookings_per_slot | SATISFIED | lib/slots.ts lines 285-286; app/api/slots/route.ts lines 192-194 |
| CAP-05 /api/bookings slot_index retry loop 1..N; non-23505 fail fast | SATISFIED | app/api/bookings/route.ts lines 212-248 |
| CAP-06 pg-driver race test skip-guarded on SUPABASE_DIRECT_URL; capacity=3 + capacity=1 regression; postgres in devDependencies only | SATISFIED (code level) | tests/race-guard.test.ts lines 91-281; tests/helpers/pg-direct.ts; devDependencies confirmed |
| CAP-07 409 code distinguishes SLOT_TAKEN (cap=1) from SLOT_CAPACITY_REACHED (cap>1); booker UI branches on code | SATISFIED | API: app/api/bookings/route.ts lines 256-258; UI: booking-form.tsx lines 129-137 |
| CAP-08 /api/slots returns remaining_capacity when show_remaining_capacity=true; booker slot button shows X spots left | SATISFIED (code level) | lib/slots.ts lines 289-295; slot-picker.tsx lines 180-184; HUMAN for visual |
| CAP-09 Capacity decrease with over-cap future bookings shows confirmation modal | SATISFIED (code level) | actions.ts lines 197-241; event-type-form.tsx AlertDialog; HUMAN for live flow |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| app/api/bookings/route.ts | 12 | Stale JSDoc comment references bookings_no_double_book (old index) in file header; operational code at line 228 correctly uses slot_index | Info | Documentation only. No runtime impact. Old index dropped by migration 03. |

No blocker or warning anti-patterns found.

---

## Design Notes (Deliberate Choices, Not Gaps)

**CAP-09 over-cap detection uses JS group-by, not Postgres GROUP BY/HAVING.** supabase-js does not expose GROUP BY/HAVING in its query builder. The action fetches confirmed future bookings for the event type and groups by start_at using a JavaScript Map. Deliberate design choice documented in actions.ts lines 194-196. Not a gap.

**CAP-06 pg-driver test is skip-guarded on SUPABASE_DIRECT_URL.** env var not set in current environment; describe.skipIf prevents CI failure. Setting the env var and running the test is Phase 13 manual QA scope. Test code fully implemented and verified structurally. Not a gap.

**CAP-01 verdict: no prod data modified.** The 2026-04-27 observation was not a persisted duplicate (Step 2 returned 0 rows). Verdict (c): rescheduled-status slot reuse structural gap. Pitfall 4 fix closes this going forward. No prod data was touched.

---

## Human Verification Required

### 1. Remaining-capacity badge on booking page

**Test:** Visit a booking page for an event type with show_remaining_capacity = true and max_bookings_per_slot > 1. Navigate to a date with available slots.
**Expected:** Each slot button displays X spots left or 1 spot left alongside the time.
**Why human:** Conditional rendering of remaining_capacity badge requires a live app serving a real API response with the field present.

### 2. 409 message branching (SLOT_CAPACITY_REACHED vs SLOT_TAKEN)

**Test:** Trigger (a) a capacity>1 slot fully booked then attempt the N+1th booking; (b) a capacity=1 slot taken simultaneously.
**Expected:** (a) Banner: That time is fully booked. Please choose a different time. (b) Banner: That time was just taken by another booker. Please choose a different time.
**Why human:** Exercising both 409 codes requires a live app or mock server returning controlled responses.

### 3. pg-driver race test execution (SUPABASE_DIRECT_URL)

**Test:** Set SUPABASE_DIRECT_URL in .env.local (Supabase Dashboard -> Project Settings -> Database -> Direct connection). Run npm run test.
**Expected:** CAP-06 describe un-skips; capacity=3/N=10 -> exactly 3 succeed; capacity=1/N=5 -> exactly 1 succeeds. All 148 existing tests continue to pass.
**Why human:** SUPABASE_DIRECT_URL not set; hasDirectUrl() returns false; CAP-06 block currently skipped.

### 4. CAP-09 over-cap confirmation modal (live flow)

**Test:** In the event-type edit form reduce max_bookings_per_slot to below the confirmed booking count at an existing future slot. Click Save.
**Expected:** AlertDialog appears showing affected slot count and worst-case booking count. Clicking Reduce capacity anyway saves successfully.
**Why human:** Over-cap pre-check queries Supabase with a real session and real booking rows; AlertDialog state machine requires a live browser.

---

## Summary

All 5 observable truths verified at the structural level. All 13 required artifacts exist, are substantive, and are wired correctly. All 9 requirements (CAP-01 through CAP-09) are satisfied at the code level. No blocking or warning anti-patterns. No implementation gaps.

Test suite baseline confirmed: 148 passing | 26 skipped (npm run test executed during verification).

Status is human_needed because 4 items require live-app or env-var conditions to exercise. These are expected deferred items (Phase 13 manual QA scope), not implementation gaps.

---

_Verified: 2026-04-29T21:40:00Z_
_Verifier: Claude (gsd-verifier)_
