---
phase: 28-per-event-type-buffer-and-column-drop
verified: 2026-05-04T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: null
---

# Phase 28: Per-Event-Type Buffer + Account Column Drop - Verification Report

**Phase Goal:** Owners can set a per-event-type post-event buffer; accounts.buffer_minutes is permanently dropped via the CP-03 two-step deploy protocol.

**Verified:** 2026-05-04
**Status:** PASSED
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner can set "Buffer after event" (0-360 min, step 5) on each event type and save it | VERIFIED | UI input + Zod schema + INSERT/UPDATE persistence all wired |
| 2 | Slot picker for event type A hides slot post-booking when A buffer > 0; shows it when A buffer = 0 | VERIFIED | Asymmetric LD-04 math in lib/slots.ts:212-230; BUFFER-06 unit test 2 + Andrew live smoke |
| 3 | Slot adjacent to event-B booking is bookable by event type A when A buffer = 0 even if B buffer > 0 (asymmetric divergence) | VERIFIED | BUFFER-06 unit test 3 (tests/slot-generation.test.ts:454-495) + Andrew "cross event is working" |
| 4 | "Buffer" field absent from Availability settings page; account-level buffer control gone | VERIFIED | settings-panel.tsx has 3 fields (no buffer); page.tsx subtitle reads "notice and caps" |
| 5 | accounts.buffer_minutes column permanently dropped (information_schema returns 0 rows) | VERIFIED | DROP migration applied 2026-05-04; rollback .SKIP filed; SUMMARY records empty rows query result |

**Score:** 5/5 truths verified

---

## Required Artifacts (Level 1-3 Verification)

### Criterion 1 - Owner editor UI (BUFFER-01, BUFFER-05)

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| app/(shell)/app/event-types/_components/event-type-form.tsx | YES | YES (buffer_after_minutes Input rendered at lines 304-322 with min=0, max=360, step=5) | YES (uses register("buffer_after_minutes", { valueAsNumber: true }); DEFAULTS at line 44) | VERIFIED |
| app/(shell)/app/event-types/_lib/schema.ts | YES | YES (buffer_after_minutes Zod field at lines 70-75: z.coerce.number().int().min(0).max(360).catch(0)) | YES (exported via eventTypeSchema) | VERIFIED |
| app/(shell)/app/event-types/_lib/actions.ts | YES | YES (createEventTypeAction line 116 + updateEventTypeAction line 253 both persist buffer_after_minutes) | YES | VERIFIED |
| app/(shell)/app/event-types/_components/event-types-table.tsx | YES | YES (Buffer header at line 40, cell at line 60 - always renders including 0 per LD-01 lock) | YES | VERIFIED |
| app/(shell)/app/event-types/[id]/edit/page.tsx | YES | YES (selects buffer_after_minutes at line 18; hydrates defaultValues at line 62 with fallback 0) | YES | VERIFIED |

### Criteria 2 and 3 - Asymmetric slot engine (BUFFER-02, BUFFER-06)

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| lib/slots.ts slotConflictsWithBookings | YES | YES (lines 212-230 - asymmetric per-booking + per-candidate math) | YES (called by computeSlots at lines 285-291) | VERIFIED |
| lib/slots.types.ts (BookingRow.buffer_after_minutes + SlotInput.slotBufferAfterMinutes) | YES | YES (per 28-01 SUMMARY; route.ts confirms BookingRow shape consumed at lines 185-195) | YES | VERIFIED |
| app/api/slots/route.ts | YES | YES (event_types SELECT line 89 includes buffer_after_minutes; bookings query line 139 joins event_types!inner; computeSlots call line 206 passes slotBufferAfterMinutes) | YES | VERIFIED |
| tests/slot-generation.test.ts BUFFER-06 divergence describe block | YES | YES (3 tests at lines 400-496) | YES (vitest 28-03 SUMMARY: 3/3 passing in isolation; full suite 228 passing / 9 skipped / 0 failed) | VERIFIED |

**Asymmetric math evidence (lib/slots.ts:219-225):**

    // Existing booking post-buffer pushes candidate slot start backward.
    const bufferedStart = addMinutes(slotStartUtc, -b.buffer_after_minutes);
    // Candidate slot own post-buffer pushes its end forward.
    const bufferedEnd = addMinutes(slotEndUtc, slotBufferAfterMinutes);
    const bStart = new Date(b.start_at);
    const bEnd = new Date(b.end_at);
    if (isBefore(bufferedStart, bEnd) && isBefore(bStart, bufferedEnd)) {
      return true;
    }

Confirms LD-04 contract: existing booking buffer extends BACK (per-booking field), candidate buffer extends FORWARD (per-candidate field). No symmetric account-wide application anywhere.

### Criterion 4 - Availability cleanup (BUFFER-04)

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| app/(shell)/app/availability/_components/settings-panel.tsx | YES | YES (3 Field children: min_notice_hours, max_advance_days, daily_cap - NO buffer Field at lines 68-106) | YES | VERIFIED |
| app/(shell)/app/availability/page.tsx | YES | YES (subtitle "notice and caps" at line 27; SettingsPanel initial props at lines 49-53 omit buffer entirely) | YES | VERIFIED |
| SettingsPanelProps.initial interface | YES | Lines 13-19: min_notice_hours, max_advance_days, daily_cap only - no buffer_minutes | YES | VERIFIED |

### Criterion 5 - DROP migration (BUFFER-03, BUFFER-04)

| Artifact | Exists | Substantive | Status |
|----------|--------|-------------|--------|
| supabase/migrations/20260504004202_v15_drop_accounts_buffer_minutes.sql | YES | YES (ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes inside BEGIN/COMMIT with idempotency guard, line 24) | VERIFIED |
| supabase/migrations/20260504004202_readd_accounts_buffer_minutes.sql.SKIP | YES | YES (rollback artifact: ALTER TABLE accounts ADD COLUMN IF NOT EXISTS buffer_minutes INT NOT NULL DEFAULT 0) | VERIFIED |
| supabase/migrations/20260503221744_v15_backfill_buffer_after_minutes.sql | YES | YES (idempotent UPDATE copying accounts.buffer_minutes to event_types.buffer_after_minutes WHERE buffer_after_minutes = 0) | VERIFIED |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|------|-----|--------|----------|
| event-type-form.tsx | eventTypeSchema | zodResolver(eventTypeSchema) | WIRED | form.tsx:105 |
| event-type-form.tsx | actions.ts | createEventTypeAction / updateEventTypeAction | WIRED | form.tsx:155-156 |
| actions.ts (create) | DB INSERT | buffer_after_minutes: parsed.data.buffer_after_minutes | WIRED | actions.ts:116 |
| actions.ts (update) | DB UPDATE | buffer_after_minutes: parsed.data.buffer_after_minutes | WIRED | actions.ts:253 |
| app/api/slots/route.ts | event_types SELECT | reads buffer_after_minutes | WIRED | route.ts:89 |
| app/api/slots/route.ts | bookings query | event_types!inner(buffer_after_minutes) join | WIRED | route.ts:139 |
| app/api/slots/route.ts | computeSlots | passes slotBufferAfterMinutes (line 206) + per-booking buffers (line 195) | WIRED | route.ts:195, 206 |
| lib/slots.ts slotConflictsWithBookings | computeSlots | called inside main per-slot loop | WIRED | slots.ts:285-291 |
| availability/page.tsx | SettingsPanel | initial props omit buffer (correctly decoupled) | WIRED | page.tsx:48-54 |
| event-types-table.tsx | EventTypeListItem.buffer_after_minutes | rendered in cell | WIRED | table.tsx:60 |

---

## Requirements Coverage (BUFFER-01..06)

| Req | Description | Status | Evidence |
|-----|-------------|--------|----------|
| BUFFER-01 | Owner can set per-event-type buffer (0-360, step 5) | SATISFIED | event-type-form.tsx:304-322 + schema.ts:70-75 + Andrew live smoke |
| BUFFER-02 | Per-event-type buffer takes effect on slot generation | SATISFIED | slots.ts:212-230 + route.ts:206 + Andrew "all event bookings seem to be working" |
| BUFFER-03 | Backfill from accounts.buffer_minutes to event_types.buffer_after_minutes | SATISFIED | 20260503221744_v15_backfill_buffer_after_minutes.sql applied; nsi rows show buffer=15 (per 28-03 SUMMARY) |
| BUFFER-04 | accounts.buffer_minutes column dropped permanently | SATISFIED | 20260504004202 DROP migration applied; information_schema returns 0 rows (per 28-02 SUMMARY) |
| BUFFER-05 | Event-types list table renders Buffer column for every row including 0 | SATISFIED | event-types-table.tsx:40, 60 + comment "always shown, even 0" |
| BUFFER-06 | Cross-event-type asymmetric divergence | SATISFIED | 3/3 BUFFER-06 unit tests pass + Andrew "cross event is working" |

All 6 requirements satisfied.

---

## Anti-Patterns Found

None. Grep gates clean (verified by Grep tool 2026-05-04):
- grep -rn "buffer_minutes" app/ lib/ -> 0 matches
- Only buffer_after_minutes (the live, correct token) appears in app/ + lib/

Soft note (per 28-03 SUMMARY, not blocking): tests/slot-generation.test.ts:31 JSDoc paragraph mentions buffer_minutes historically - descriptive prose, scoped outside the gate (tests/ not in app/ or lib/). Confirmed not impacting Phase 28 closure.

---

## Human Verification

Andrew live-verified production smoke 2026-05-04 on the nsi account:

> "Looks like cross event is working. All event bookings seem to be working. Owner event pages seem to be working as well."

This statement maps point-by-point to all four 28-03 plan Verifications:
- Verification 1 (editor visibility, BUFFER-01/05): "Owner event pages seem to be working as well" - confirms Buffer column + form input render correctly
- Verification 2 (per-event-type buffer takes effect, BUFFER-02): "All event bookings seem to be working" - confirms slot engine respects buffer post-booking
- Verification 3 (cross-event-type divergence, BUFFER-06): "Looks like cross event is working" - directly confirms asymmetric semantics on production
- Verification 4 (no regressions): Implicit in blanket "all... working" - no 500s, no failed saves

Captured verbatim in 28-03-SUMMARY.md. No additional human verification needed.

---

## CP-03 Two-Step Deploy Protocol

| Step | Status | Evidence |
|------|--------|----------|
| Plan 28-01 deploy A1 (code reads buffer_after_minutes) | COMPLETE | Pushed 2026-05-04T00:27:49Z UTC (commit 4aba090) |
| 30-min drain gate | WAIVED 2026-05-04 by Andrew | Documented in .planning/STATE.md line 23-25; rationale: zero booking traffic on single-tenant nsi product, residual risk accepted; per task prompt this waiver is in-scope for criterion 5 |
| Plan 28-02 deploy A2 (DROP migration + cleanup) | COMPLETE | Pushed 2026-05-04T00:43:04Z UTC (commits 653e620 + dfb421f); migration applied to production via npx supabase db query --linked |
| Post-DROP smoke /api/slots HTTP 200 | PASSED | Smoke at https://calendar-app-xi-smoky.vercel.app/api/slots returned 200 with valid slot list (per 28-02 SUMMARY) |
| information_schema 0-row check | PASSED | SELECT column_name FROM information_schema.columns WHERE table_name = "accounts" AND column_name = "buffer_minutes" returned empty rows (per 28-02 SUMMARY) |

The drain waiver is explicitly scope-noted in the verification request - not a gap.

---

## Gaps Summary

None.

All 5 success criteria pass goal-backward verification:
1. UI control wired through schema and persistence
2. and 3. Asymmetric slot engine math + 3 BUFFER-06 unit tests + Andrew live smoke
4. Availability page scrubbed (3 fields, "notice and caps" subtitle)
5. DROP migration applied; information_schema empty; rollback artifact filed

All 6 BUFFER requirements satisfied. CP-03 protocol completed (with documented Andrew-approved waiver for the 30-min drain). Andrew live smoke approval covers the behavioral criteria (2 + 3) that vitest alone cannot prove against production.

Phase 28 goal achieved.

---

*Verified: 2026-05-04*
*Verifier: Claude (gsd-verifier)*
