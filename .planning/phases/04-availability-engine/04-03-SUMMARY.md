---
phase: 04-availability-engine
plan: "03"
subsystem: api
tags: [zod, supabase, server-actions, react-hook-form, typescript, availability]

# Dependency graph
requires:
  - phase: 04-01
    provides: accounts table with buffer_minutes/min_notice_hours/max_advance_days/daily_cap columns + CHECK constraints; date-fns v4 + @date-fns/tz installed
  - phase: 03-03
    provides: direct-call Server Action contract, RPC pattern for current_owner_account_ids, no-try/catch action pattern, revalidatePath convention

provides:
  - "app/(shell)/app/availability/_lib/types.ts — AvailabilityState, DayOfWeek, TimeWindow, AccountSettingsRow, AvailabilityRuleRow, DateOverrideRow, DateOverrideInput"
  - "app/(shell)/app/availability/_lib/schema.ts — weeklyRulesSchema, dateOverrideSchema, accountSettingsSchema + inferred input types"
  - "app/(shell)/app/availability/_lib/queries.ts — loadAvailabilityState() server-only data loader"
  - "app/(shell)/app/availability/_lib/actions.ts — saveAccountSettingsAction, saveWeeklyRulesAction, upsertDateOverrideAction, deleteDateOverrideAction"

affects:
  - "04-04 (weekly editor + settings panel UI — consumes all 4 modules)"
  - "04-05 (overrides UI — consumes loadAvailabilityState + upsertDateOverrideAction + deleteDateOverrideAction)"
  - "04-06 (slots API — consumes AccountSettingsRow type shape)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AvailabilityActionState discriminated error type: { fieldErrors?, formError? } (mirrors Phase 3 EventTypeState)"
    - "Delete-then-insert replace semantics for weekly rules (per-weekday atomic replace)"
    - "Delete-all-for-date-first mutual exclusion for date overrides (RESEARCH Pitfall 5)"
    - "Zod discriminatedUnion for block/custom_hours override shape"
    - "findOverlap helper: sort-then-check, adjacent touching allowed, overlaps rejected with HH:MM error"
    - "REVALIDATE constant for single revalidatePath path string"

key-files:
  created:
    - "app/(shell)/app/availability/_lib/types.ts"
    - "app/(shell)/app/availability/_lib/schema.ts"
    - "app/(shell)/app/availability/_lib/queries.ts"
    - "app/(shell)/app/availability/_lib/actions.ts"
  modified: []

key-decisions:
  - "No transaction wrapper for delete+insert pairs: supabase-js has no explicit tx API; single-weekday scope means worst-case is a day showing Closed until retry; acceptable for v1 single-tenant"
  - "Empty windows array = closed weekday: presence/absence of rows IS the open/closed state per CONTEXT lock; no separate is_open column"
  - "REVALIDATE constant for revalidatePath path: prevents drift across 4 actions that all revalidate the same path"
  - "loadAvailabilityState returns null (not throw) on unlinked user: page.tsx handles redirect/unlinked-state UI gracefully"
  - "daily_cap schema: accepts number|null|'empty string'|undefined, coerces '' -> null for empty <input type=number> UX"
  - "Override mutual exclusion enforced in action layer (not DB): delete ALL rows for override_date first regardless of type being saved, then insert new shape"

patterns-established:
  - "Direct-call action contract: actions accept structured TS objects (WeeklyRulesInput, DateOverrideFormInput, AccountSettingsInput), NOT FormData. Plans 04-04 + 04-05 call await saveWeeklyRulesAction({...}) from RHF onSubmit."
  - "Window overlap: sort by start_minute, check end_minute > next.start_minute. Touching (end == next.start) is NOT overlap. HH:MM error names the conflicting pair."
  - "server-only import on line 1 of queries.ts prevents accidental client bundling of the data loader"

# Metrics
duration: 4min
completed: 2026-04-25
---

# Phase 4 Plan 03: Data Layer and Server Actions Summary

**Zod schemas with HH:MM overlap validation + RLS-scoped Server Actions for availability settings, weekly rule replace, and date override mutual exclusion**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-25T17:43:05Z
- **Completed:** 2026-04-25T17:47:xx Z
- **Tasks:** 3
- **Files modified:** 4 created

## Accomplishments

- Full data layer for the availability surface in 4 modules under `_lib/`
- Zod overlap validator: sort-by-start, check end > next.start, friendly HH:MM error ("Time windows overlap: 09:00–12:00 and 11:00–14:00.") — used in both weeklyRulesSchema and the custom_hours branch of dateOverrideSchema
- loadAvailabilityState(): server-only, 3 parallel queries (account + rules + overrides), pre-sorted for UI consumption
- 4 Server Actions implementing all AVAIL-01 through AVAIL-06 mutations, all RLS-scoped, all revalidating /app/availability on success

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types + Zod schemas** - `3777a3e` (feat)
2. **Task 2: loadAvailabilityState data loader** - `ff11a1a` (feat)
3. **Task 3: All four Server Actions** - `7be960a` (feat)

## Files Created/Modified

- `app/(shell)/app/availability/_lib/types.ts` — DayOfWeek (0-6 literal union), TimeWindow, AccountSettingsRow, AvailabilityRuleRow, DateOverrideRow, DateOverrideInput (discriminated union), AvailabilityState
- `app/(shell)/app/availability/_lib/schema.ts` — timeWindowSchema, weeklyRulesSchema (per-day windows array with overlap superRefine), dateOverrideSchema (block/custom_hours discriminated union), accountSettingsSchema (4 fields with migration CHECK bounds), WeeklyRulesInput / DateOverrideFormInput / AccountSettingsInput types
- `app/(shell)/app/availability/_lib/queries.ts` — loadAvailabilityState() server-only loader; resolves account_id via current_owner_account_ids RPC; 3 parallel SELECTs via Promise.all; returns null on unlinked user
- `app/(shell)/app/availability/_lib/actions.ts` — saveAccountSettingsAction, saveWeeklyRulesAction, upsertDateOverrideAction, deleteDateOverrideAction; AvailabilityActionState type

## Decisions Made

**1. No transaction wrapper for delete+insert:**
supabase-js does not expose explicit transaction control. The delete+insert pair for weekly rules and date overrides is scoped to a single weekday or single date — worst case on partial failure is the weekday/date shows as Closed until the user retries. Acceptable for v1 single-tenant. If this causes issues at scale, a Postgres function (RPC) could wrap the pair in a transaction.

**2. Empty windows array = "Closed weekday":**
CONTEXT lock: presence/absence of rows IS the open/closed state. No separate `is_open` column. saveWeeklyRulesAction with empty windows = delete-only. UI toggle to Closed calls saveWeeklyRulesAction({ day_of_week, windows: [] }).

**3. Override mutual exclusion in action layer:**
upsertDateOverrideAction always deletes ALL rows for (account_id, override_date) FIRST, regardless of the incoming type. This is the only reliable way to prevent the mixed is_closed+windows state (RESEARCH Pitfall 5). The DB schema allows both shapes to coexist; the action layer is the enforcement point.

**4. Boundary contracts for consuming plans:**
- `WeeklyRulesInput` = `{ day_of_week: DayOfWeek; windows: TimeWindow[] }` — empty windows array is valid (Closed)
- `DateOverrideFormInput` = `{ type: "block"; override_date: string; note?: string } | { type: "custom_hours"; override_date: string; windows: TimeWindow[]; note?: string }`
- `AccountSettingsInput` = `{ buffer_minutes: number; min_notice_hours: number; max_advance_days: number; daily_cap: number | null }`
- `AvailabilityActionState` = `{ fieldErrors?: Record<string, string[]>; formError?: string }`

## Deviations from Plan

None — plan executed exactly as written.

Minor implementation note: the plan's verify script checked for the literal `revalidatePath("/app/availability")` in the file; the implementation uses a `const REVALIDATE = "/app/availability"` constant and calls `revalidatePath(REVALIDATE)` — identical runtime behavior, stricter anti-drift pattern. Not a functional deviation.

## Issues Encountered

**Slot-generation test failures (pre-existing, not regressions):** `npm test` shows 10 failures in `tests/slot-generation.test.ts` — all from `computeSlots` returning `[]`. These are from Plan 04-02 (running in parallel, Wave 2). The 3 auth/RLS test files (22 tests) all pass. No new failures introduced by this plan.

## Next Phase Readiness

Plans 04-04 (weekly editor + settings panel) and 04-05 (overrides UI) can now import all 4 modules. The action contract is:

```typescript
// From Plan 04-04 weekday form's onSubmit:
const result = await saveWeeklyRulesAction({ day_of_week: 1, windows: [...] });

// From Plan 04-04 settings form's onSubmit:
const result = await saveAccountSettingsAction({ buffer_minutes: 15, ... });

// From Plan 04-05 override form's onSubmit:
const result = await upsertDateOverrideAction({ type: "block", override_date: "2026-07-04" });

// From Plan 04-05 override delete button:
const result = await deleteDateOverrideAction("2026-07-04");
```

All actions return `AvailabilityActionState` — check `result.formError` and `result.fieldErrors` for errors; `{}` (no keys) = success. Call `router.refresh()` after success to re-fetch the Server Component (Phase 3 lock: required after non-redirecting actions).

---
*Phase: 04-availability-engine*
*Completed: 2026-04-25*
