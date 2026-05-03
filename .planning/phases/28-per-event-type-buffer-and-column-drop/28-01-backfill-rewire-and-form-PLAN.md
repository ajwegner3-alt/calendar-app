---
phase: 28-per-event-type-buffer-and-column-drop
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/<TS>_v15_backfill_buffer_after_minutes.sql
  - lib/slots.types.ts
  - lib/slots.ts
  - app/api/slots/route.ts
  - app/(shell)/app/event-types/_lib/schema.ts
  - app/(shell)/app/event-types/_lib/types.ts
  - app/(shell)/app/event-types/_lib/actions.ts
  - app/(shell)/app/event-types/_components/event-type-form.tsx
  - app/(shell)/app/event-types/_components/event-types-table.tsx
  - app/(shell)/app/event-types/page.tsx
  - app/(shell)/app/event-types/[id]/edit/page.tsx
  - tests/slot-generation.test.ts
autonomous: true

must_haves:
  truths:
    - "Production event_types rows are backfilled with their account's buffer_minutes (verified via SELECT DISTINCT before code deploys)"
    - "Slot engine reads buffer per booking from event_types.buffer_after_minutes (not accounts.buffer_minutes)"
    - "Asymmetric buffer math is wired: existing booking's post-buffer extends BEFORE candidate slot; candidate slot's own buffer extends AFTER itself"
    - "Owner sees a 'Buffer after event' number input (min=0, max=360, step=5) directly after the Duration field on the event-type editor and can save it"
    - "Event-types list table shows a Buffer column with the per-event value (including 0)"
    - "tests/slot-generation.test.ts is green with the new asymmetric API and BUFFER-06 divergence cases"
    - "tsc --noEmit is clean after rewire (AccountSettings no longer carries buffer_minutes; BookingRow carries buffer_after_minutes)"
    - "Vercel deploy of this plan succeeds and Andrew can mark drain-window start"
  artifacts:
    - path: "supabase/migrations/<TS>_v15_backfill_buffer_after_minutes.sql"
      provides: "Idempotent UPDATE event_types SET buffer_after_minutes = accounts.buffer_minutes guarded by WHERE buffer_after_minutes = 0"
      contains: "BEGIN"
    - path: "lib/slots.types.ts"
      provides: "AccountSettings without buffer_minutes; BookingRow with buffer_after_minutes; SlotInput with slotBufferAfterMinutes"
      contains: "buffer_after_minutes"
    - path: "lib/slots.ts"
      provides: "slotConflictsWithBookings with asymmetric per-booking + per-slot buffer math"
      contains: "buffer_after_minutes"
    - path: "app/api/slots/route.ts"
      provides: "event_types SELECT includes buffer_after_minutes; bookings query joins event_types!inner(buffer_after_minutes); accounts SELECT excludes buffer_minutes"
      contains: "event_types!inner(buffer_after_minutes)"
    - path: "app/(shell)/app/event-types/_components/event-type-form.tsx"
      provides: "Number input for buffer_after_minutes positioned after duration_minutes"
      contains: "buffer_after_minutes"
    - path: "app/(shell)/app/event-types/_components/event-types-table.tsx"
      provides: "Buffer column rendered for every row including 0"
      contains: "Buffer"
    - path: "tests/slot-generation.test.ts"
      provides: "BUFFER-06 divergence test block with three asymmetric cases"
      contains: "per-event-type buffer divergence"
  key_links:
    - from: "app/api/slots/route.ts bookings query"
      to: "lib/slots.ts slotConflictsWithBookings"
      via: "BookingRow.buffer_after_minutes populated from event_types!inner join"
      pattern: "event_types!inner\\(buffer_after_minutes\\)"
    - from: "app/api/slots/route.ts computeSlots call"
      to: "lib/slots.ts computeSlots"
      via: "SlotInput.slotBufferAfterMinutes populated from eventType.buffer_after_minutes"
      pattern: "slotBufferAfterMinutes"
    - from: "app/(shell)/app/event-types/_components/event-type-form.tsx"
      to: "app/(shell)/app/event-types/_lib/actions.ts"
      via: "buffer_after_minutes carried through Zod parse + INSERT/UPDATE payloads"
      pattern: "buffer_after_minutes:\\s*parsed\\.data\\.buffer_after_minutes"
---

<objective>
Wire the existing `event_types.buffer_after_minutes` column end-to-end: backfill production data from `accounts.buffer_minutes`, rewrite `slotConflictsWithBookings` to use asymmetric per-booking + per-slot buffer math, expose the field in the event-type editor and list table, and ship the code deploy that begins the CP-03 drain window. After this plan ships, the slot engine no longer reads `accounts.buffer_minutes` anywhere.

Purpose: Per-event-type buffers replace the one-size-fits-all account buffer. Existing nsi behavior is preserved by the backfill (any non-zero `accounts.buffer_minutes` is copied to all of that account's event types).

Output: Backfill migration applied to production; code deploy live on Vercel; Andrew can timestamp drain-window start for Plan 28-02.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/28-per-event-type-buffer-and-column-drop/28-CONTEXT.md
@.planning/phases/28-per-event-type-buffer-and-column-drop/28-RESEARCH.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md

# Source files for the rewire (read before editing)
@lib/slots.ts
@lib/slots.types.ts
@app/api/slots/route.ts
@app/(shell)/app/event-types/_lib/schema.ts
@app/(shell)/app/event-types/_lib/types.ts
@app/(shell)/app/event-types/_lib/actions.ts
@app/(shell)/app/event-types/_components/event-type-form.tsx
@app/(shell)/app/event-types/_components/event-types-table.tsx
@app/(shell)/app/event-types/page.tsx
@app/(shell)/app/event-types/[id]/edit/page.tsx
@tests/slot-generation.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author + apply backfill migration with pre-flight gate</name>
  <files>supabase/migrations/&lt;TS&gt;_v15_backfill_buffer_after_minutes.sql</files>
  <action>
Step 1 — Pre-flight gate (HARD BLOCKER from STATE.md). Run:
```bash
echo "SELECT id, slug, buffer_after_minutes FROM event_types WHERE buffer_after_minutes <> 0;" | npx supabase db query --linked
```
This MUST return zero rows. If non-zero rows exist, STOP — do not proceed. Report the rows to the user and abort the plan. (Per CONTEXT: "Pre-flight gate ... must return 0 rows before backfill runs.")

Step 2 — Capture current account buffer values for the SUMMARY:
```bash
echo "SELECT slug, buffer_minutes FROM accounts;" | npx supabase db query --linked
```
Record output (especially nsi's value) so the post-backfill verification has an expected outcome.

Step 3 — Create the migration file. Use a UTC timestamp `YYYYMMDDHHMMSS` matching the convention of existing files in `supabase/migrations/`. Filename: `supabase/migrations/<TS>_v15_backfill_buffer_after_minutes.sql`. Body (idempotent, scoped to all rows including soft-deleted, per RESEARCH 'Backfill Scope Filter' recommendation):

```sql
BEGIN;
  DO $$ BEGIN RAISE NOTICE 'v1.5 Phase 28 backfill: event_types.buffer_after_minutes from accounts.buffer_minutes'; END $$;

  UPDATE event_types et
  SET buffer_after_minutes = a.buffer_minutes
  FROM accounts a
  WHERE et.account_id = a.id
    AND et.buffer_after_minutes = 0;
COMMIT;
```

Notes:
- Idempotency guard `et.buffer_after_minutes = 0` ensures re-runs are no-ops (CONTEXT LD-03).
- No `deleted_at` filter (RESEARCH "Backfill Scope Filter": apply to all rows so restored archives inherit correct buffer).
- Do NOT add `post_buffer_minutes` anywhere. LD-01 locks the column name as `buffer_after_minutes`.

Step 4 — Apply via the only working path (`supabase db push --linked` is broken in this repo per STACK.md):
```bash
echo | npx supabase db query --linked -f supabase/migrations/<TS>_v15_backfill_buffer_after_minutes.sql
```

Step 5 — Verify:
```bash
echo "SELECT DISTINCT buffer_after_minutes FROM event_types ORDER BY 1;" | npx supabase db query --linked
```
Expected: `0` (and any non-zero values that match the `accounts.buffer_minutes` distribution captured in Step 2). If nsi had `buffer_minutes = 15`, you should see `0` and `15`. If all accounts had `buffer_minutes = 0`, the result is `0` only — that is also correct.

Step 6 — Commit the migration file:
```bash
git add supabase/migrations/<TS>_v15_backfill_buffer_after_minutes.sql
git commit -m "feat(28-01): backfill event_types.buffer_after_minutes from accounts.buffer_minutes"
```
  </action>
  <verify>
- Pre-flight SELECT returned 0 rows BEFORE the UPDATE ran
- `SELECT DISTINCT buffer_after_minutes FROM event_types` returns expected value set (matches `accounts.buffer_minutes` distribution captured in Step 2)
- Migration file exists at `supabase/migrations/<TS>_v15_backfill_buffer_after_minutes.sql` with `BEGIN/COMMIT` and idempotency guard
- Re-running the migration is a no-op (no rows updated second time)
- Commit landed on local branch
  </verify>
  <done>
Production `event_types.buffer_after_minutes` reflects each row's account-level `buffer_minutes`. The DB is now ready for the code deploy that reads this column.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewire slot engine + types + route handler for asymmetric per-booking buffer</name>
  <files>
lib/slots.types.ts
lib/slots.ts
app/api/slots/route.ts
tests/slot-generation.test.ts
  </files>
  <action>
This task changes the slot-engine type contract, applies the asymmetric buffer math, rewires the route handler, and updates the test fixture so `tsc --noEmit` and `vitest run tests/slot-generation.test.ts` are both green. Pitfall V15-CP-04 is in scope: the test fixture MUST be updated synchronously with the type change.

ASYMMETRIC SEMANTICS (LD-04 — read carefully, getting this backwards produces wrong availability):
- Existing booking's `buffer_after_minutes` extends the blocked window BEFORE the candidate slot starts (existing booking needs its own post-event buffer respected)
- Candidate slot's own `buffer_after_minutes` extends the blocked window AFTER the candidate slot ends (candidate slot's own post-event buffer crowds out the next booking)
- Translated to the conflict check: `bufferedStart = slotStart - existingBooking.buffer_after_minutes`, `bufferedEnd = slotEnd + candidateSlot.buffer_after_minutes`

Step 1 — Edit `lib/slots.types.ts`:
- In `interface AccountSettings`: REMOVE `buffer_minutes: number;` line (do not make it optional — V15-CP-04 says full removal so type drift is caught at compile time).
- In `interface BookingRow`: ADD `buffer_after_minutes: number;` field after `end_at`.
- In `interface SlotInput` (find it in the same file): ADD `slotBufferAfterMinutes: number;` field. Place it logically near `durationMinutes` (the candidate event type's duration) since it is also a per-event-type input.

Step 2 — Edit `lib/slots.ts`:
- Locate `slotConflictsWithBookings` (currently around line 203-218). Change signature from `(slotStartUtc, slotEndUtc, bufferMinutes, bookings)` to `(slotStartUtc, slotEndUtc, slotBufferAfterMinutes, bookings)`. Rewrite the body to apply ASYMMETRIC buffer math per booking:
```typescript
function slotConflictsWithBookings(
  slotStartUtc: Date,
  slotEndUtc: Date,
  slotBufferAfterMinutes: number,
  bookings: SlotInput["bookings"],
): boolean {
  for (const b of bookings) {
    // Existing booking's post-buffer pushes the candidate slot's allowed start backward
    const bufferedStart = addMinutes(slotStartUtc, -b.buffer_after_minutes);
    // Candidate slot's own post-buffer pushes its allowed end forward
    const bufferedEnd = addMinutes(slotEndUtc, slotBufferAfterMinutes);
    const bStart = new Date(b.start_at);
    const bEnd = new Date(b.end_at);
    if (isBefore(bufferedStart, bEnd) && isBefore(bStart, bufferedEnd)) {
      return true;
    }
  }
  return false;
}
```
- Locate the call site (currently around line 274-278) inside `computeSlots`. Change the third argument from `account.buffer_minutes` to `input.slotBufferAfterMinutes`.

Step 3 — Edit `app/api/slots/route.ts`:
- Line ~89 (event_types SELECT): ADD `buffer_after_minutes` to the comma-separated select string, keeping existing fields. Result column list: `id, account_id, duration_minutes, buffer_after_minutes, max_bookings_per_slot, show_remaining_capacity`.
- Line ~121 (accounts SELECT): REMOVE `buffer_minutes,` from the select string. Result: `timezone, min_notice_hours, max_advance_days, daily_cap`.
- Line ~137 (bookings query): change `.select("start_at, end_at")` to `.select("start_at, end_at, event_types!inner(buffer_after_minutes)")`. The `!inner` join ensures every booking row carries its event type's buffer (and excludes any orphan rows, which is the same semantic as before).
- Line ~158-164 (`AccountSettings` construction): REMOVE the `buffer_minutes` field from the object literal (the type no longer has it).
- Line ~176-179 (`BookingRow[]` mapping): change to:
```typescript
const bookings: BookingRow[] = (bookingsRes.data ?? []).map((b) => ({
  start_at: b.start_at,
  end_at: b.end_at,
  buffer_after_minutes:
    (b.event_types as { buffer_after_minutes: number } | null)
      ?.buffer_after_minutes ?? 0,
}));
```
- Line ~182-194 (computeSlots call): ADD `slotBufferAfterMinutes: eventType.buffer_after_minutes,` to the argument object.

Step 4 — Edit `tests/slot-generation.test.ts`:
- Line ~32 (`baseAccount`): REMOVE `buffer_minutes: 0,`.
- Lines ~213-229 (existing buffer test): rewrite to use the new asymmetric API. The test currently passes a 15-minute buffer via account settings; rewrite it to pass `slotBufferAfterMinutes: 15` on the SlotInput AND set `buffer_after_minutes: 0` on each existing `BookingRow`. The assertion (slot at 10:30 still blocked) should still hold because the candidate slot's 15-min post-buffer extends its own end into the existing booking. Update the test comment to describe asymmetric semantics.
- ADD a new `describe` block at the end of the file titled `"computeSlots — per-event-type buffer divergence (BUFFER-06)"` with three tests, exactly as specified in 28-RESEARCH.md "Code Examples" (BUFFER-06 three-case test):
  1. Event type buffer=0 — adjacent slot IS available after a booking with buffer=0
  2. Existing booking buffer=15 — adjacent slot NOT available regardless of candidate's buffer
  3. Divergence: candidate buffer=0 vs candidate buffer=15 yield same result when the existing booking has buffer=15 (because the EXISTING booking determines blocking from the back-side); but candidate buffer=0 with existing booking buffer=0 makes the slot available
- The `input()` helper at line ~43-61 needs `slotBufferAfterMinutes` plumbed into `SlotInput`. Default it to `0` if the helper takes a partial arg, so existing tests continue to pass without modification.

Step 5 — Verify locally before committing:
```bash
npx tsc --noEmit
npx vitest run tests/slot-generation.test.ts
```
Both must be green. Fix any compile errors caused by other callers of `AccountSettings` or `BookingRow` that this rewire surfaces (search with `grep -rn "buffer_minutes" lib/ app/api/`). At this point only the availability panel files (Plan 28-02 scope) should still reference `buffer_minutes` — that is expected and intentional during the drain window.

Step 6 — Commit:
```bash
git add lib/slots.types.ts lib/slots.ts app/api/slots/route.ts tests/slot-generation.test.ts
git commit -m "feat(28-01): rewire slot engine for per-event-type buffer (asymmetric)"
```
  </action>
  <verify>
- `npx tsc --noEmit` exits 0
- `npx vitest run tests/slot-generation.test.ts` passes (existing test rewritten + 3 new BUFFER-06 divergence tests green)
- `grep -n "buffer_minutes" lib/slots.ts lib/slots.types.ts app/api/slots/route.ts` returns 0 matches (only `buffer_after_minutes` remains in these files)
- `grep -n "post_buffer_minutes" .` returns 0 matches anywhere (LD-01 enforcement)
- Asymmetric math review: search for `bufferedStart` and confirm it subtracts `b.buffer_after_minutes` (existing booking's), and `bufferedEnd` adds `slotBufferAfterMinutes` (candidate's)
  </verify>
  <done>
The slot engine reads buffer per booking from `event_types.buffer_after_minutes` and per candidate from `eventType.buffer_after_minutes`. Asymmetric semantics are wired and unit-tested. `accounts.buffer_minutes` is no longer read anywhere in `lib/` or `app/api/`. Tests are green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add buffer field to event-type form, schema, actions, list table, and deploy</name>
  <files>
app/(shell)/app/event-types/_lib/schema.ts
app/(shell)/app/event-types/_lib/types.ts
app/(shell)/app/event-types/_lib/actions.ts
app/(shell)/app/event-types/_components/event-type-form.tsx
app/(shell)/app/event-types/_components/event-types-table.tsx
app/(shell)/app/event-types/page.tsx
app/(shell)/app/event-types/[id]/edit/page.tsx
  </files>
  <action>
This task wires the owner-facing UI: Zod field, form input, default values, table column, and INSERT/UPDATE payloads. After this commit, you will git-push to deploy 28-01 — that begins the drain window for Plan 28-02.

Step 1 — Edit `app/(shell)/app/event-types/_lib/schema.ts`:
ADD to `eventTypeSchema` object (after `duration_minutes`, before `max_bookings_per_slot`):
```typescript
buffer_after_minutes: z.coerce
  .number()
  .int()
  .min(0, "Buffer cannot be negative.")
  .max(360, "Buffer cannot exceed 360 minutes (6 hours).")
  .catch(0),
```
The `.catch(0)` makes empty input or NaN coerce to 0 silently (CONTEXT: "Treat empty string as 0. Forgiving — do not block save with a 'required' error.").

Step 2 — Edit `app/(shell)/app/event-types/_lib/types.ts`:
- Find `EventTypeListItem` type. ADD `buffer_after_minutes: number;` to it. (`EventTypeRow` already has the field per RESEARCH line 44 — verify it before assuming.)

Step 3 — Edit `app/(shell)/app/event-types/_lib/actions.ts`:
- In `createEventTypeAction` (around line 110-124, the INSERT payload): ADD `buffer_after_minutes: parsed.data.buffer_after_minutes,` to the inserted object.
- In `updateEventTypeAction` (around line 244-259, the UPDATE payload): ADD `buffer_after_minutes: parsed.data.buffer_after_minutes,` to the updated object.

Step 4 — Edit `app/(shell)/app/event-types/_components/event-type-form.tsx`:
- DEFAULTS object (around line 39-52): ADD `buffer_after_minutes: 0,`.
- Add a new `<div className="grid gap-2">` block IMMEDIATELY AFTER the `duration_minutes` block (RESEARCH line 281-297 marks the position) and BEFORE `max_bookings_per_slot`. Use this exact JSX (RESEARCH "Buffer field in event-type form"):
```tsx
{/* Buffer after event */}
<div className="grid gap-2">
  <Label htmlFor="buffer_after_minutes">Buffer after event (minutes)</Label>
  <Input
    id="buffer_after_minutes"
    type="number"
    min={0}
    max={360}
    step={5}
    inputMode="numeric"
    className="max-w-[160px]"
    {...register("buffer_after_minutes", { valueAsNumber: true })}
  />
  {errors.buffer_after_minutes && (
    <p className="text-sm text-destructive">{errors.buffer_after_minutes.message}</p>
  )}
  <p className="text-sm text-muted-foreground">
    Blocks additional time after this event type ends, preventing back-to-back bookings.
  </p>
</div>
```
The `Label`, `Input`, `register`, and error display patterns must match the existing `duration_minutes` block exactly — copy its style for visual consistency. CONTEXT requires plain number input (no slider/stepper buttons/preset dropdown), label `Buffer after event`, and one help-text line.

Step 5 — Edit `app/(shell)/app/event-types/[id]/edit/page.tsx`:
- In the `defaultValues` object (around line 57-69): ADD `buffer_after_minutes: eventType.buffer_after_minutes ?? 0,`. The SELECT at line 17-19 already fetches this field per RESEARCH — verify before assuming.

Step 6 — Edit `app/(shell)/app/event-types/page.tsx`:
- Find the SELECT string (around line 46-48). ADD `buffer_after_minutes` to the comma-separated columns. After the change, the SELECT should include: `id, name, slug, duration_minutes, buffer_after_minutes, is_active, deleted_at, created_at`.

Step 7 — Edit `app/(shell)/app/event-types/_components/event-types-table.tsx`:
- ADD a new "Buffer" column to the table. Place it after the Duration column to mirror the editor pairing. Render value as `{row.buffer_after_minutes} min` for every row (CONTEXT: "Always show the buffer value for every event type ... Never hide it for zero values."). Match the visual style of the Duration column.
- Update any header `<th>` row to include `Buffer`.

Step 8 — Verify locally:
```bash
npx tsc --noEmit
npm run lint     # if a lint script exists; otherwise skip
npx vitest run   # full suite — confirm nothing else broke
```
All must be green. The availability panel files still reference `buffer_minutes` — that is expected (Plan 28-02 cleans those up after the drain).

Step 9 — Commit, push, and capture deploy timestamp:
```bash
git add app/\(shell\)/app/event-types/
git commit -m "feat(28-01): expose buffer_after_minutes in event-type editor + list"
git push origin main
```
Then watch the Vercel deploy log (the user can confirm via their Vercel dashboard). When the deploy is `Ready`, record the UTC timestamp — that is `T0` for the 30-minute drain. Save this timestamp into the SUMMARY at plan completion (Plan 28-02 reads it to verify the drain).

Step 10 — Live smoke check (Claude only — Andrew's full UAT is in Plan 28-03):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<production-url>/api/slots?account=nsi&event_type=<a-known-slug>&from=<today>&to=<today>
```
Expected: `200`. If the route 500s, the rewire has a regression — diagnose immediately (most likely: a callsite of `AccountSettings.buffer_minutes` outside the files in Tasks 1-3 was missed; grep `buffer_minutes` across `app/` and `lib/` to find).
  </action>
  <verify>
- `npx tsc --noEmit` exits 0
- Full `vitest` suite green
- Vercel deploy succeeded (status `Ready`); deploy timestamp captured for SUMMARY
- `curl /api/slots` against production returns 200
- Manual page load of `/app/event-types` shows the Buffer column for every row
- Manual page load of an event-type editor shows the Buffer-after-event field directly after Duration
- `grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"` shows ONLY availability panel files (`app/(shell)/app/availability/...`) — no other matches. This is expected during the drain window; Plan 28-02 will clean those up.
- `grep -rn "post_buffer_minutes" .` returns 0 matches (LD-01 enforcement)
  </verify>
  <done>
Owner can set per-event-type buffer in the editor, see it in the list table, and the slot engine respects it. Production deploy is live; drain window is timestamped and underway. Plan 28-02 may NOT begin until ≥30 minutes have elapsed since deploy timestamp.
  </done>
</task>

</tasks>

<verification>
After all three tasks, run the full phase-level verification suite:

```bash
# Type & test gates
npx tsc --noEmit
npx vitest run

# Code-side buffer reads — only availability panel files should remain
grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"
# Expected matches: ONLY app/(shell)/app/availability/_lib/{types,schema,queries,actions}.ts,
#                   app/(shell)/app/availability/_components/settings-panel.tsx,
#                   app/(shell)/app/availability/page.tsx
# Any match outside availability/ = regression — fix before declaring 28-01 complete.

# Locked column name enforcement
grep -rn "post_buffer_minutes" . --include="*.ts" --include="*.tsx" --include="*.sql"
# Expected: 0 matches everywhere

# DB state
echo "SELECT DISTINCT buffer_after_minutes FROM event_types ORDER BY 1;" | npx supabase db query --linked
# Expected: 0 plus any non-zero values that match accounts.buffer_minutes distribution

# Production smoke
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-url>/api/slots?account=nsi&event_type=<slug>&from=<today>&to=<today>
# Expected: 200
```

The drain timestamp T0 is the moment the Vercel deploy goes Ready in Step 9 of Task 3. Plan 28-02 begins no earlier than T0 + 30 minutes.
</verification>

<success_criteria>
1. Backfill migration applied; `SELECT DISTINCT buffer_after_minutes FROM event_types` matches the `accounts.buffer_minutes` distribution captured pre-flight.
2. `lib/slots.ts`, `lib/slots.types.ts`, and `app/api/slots/route.ts` no longer reference `buffer_minutes`. Asymmetric math wired per LD-04.
3. Vitest green including 3 new BUFFER-06 divergence tests.
4. Owner sees a "Buffer after event" number input on the event-type editor with min=0, max=360, step=5, positioned directly after Duration.
5. Event-types list table shows a Buffer column for every row including 0.
6. Vercel deploy is live; drain timestamp T0 captured in SUMMARY for Plan 28-02 to gate against.
7. `grep -rn "buffer_minutes" app/ lib/` shows only availability panel files (Plan 28-02 scope).
8. `grep -rn "post_buffer_minutes" .` returns 0 matches.
</success_criteria>

<output>
After completion, create `.planning/phases/28-per-event-type-buffer-and-column-drop/28-01-SUMMARY.md` with:
- Drain timestamp T0 (UTC, Vercel deploy Ready time) — REQUIRED for Plan 28-02
- Captured `accounts.buffer_minutes` distribution from pre-flight Step 2
- Migration file timestamp (filename)
- Confirmation of all three task verify gates
- Any deviations from the plan with rationale
</output>
