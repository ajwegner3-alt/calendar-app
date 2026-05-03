# Domain Pitfalls — v1.4: Cross-Event-Type Slot Correctness + Surgical Polish

**Domain:** Booking system — DB-layer cross-event-type exclusion constraint + 4 surgical items
**Researched:** 2026-05-02
**Covers:** Phases 25 (surgical), 26 (debug), 27 (architectural DB constraint)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or silent correctness failures.

---

### V14-CP-01: EXCLUDE constraint requires `btree_gist`; missing extension silently fails

**What goes wrong:** `CREATE EXTENSION IF NOT EXISTS btree_gist` is omitted from the migration. The `EXCLUDE USING gist` clause on a UUID equality operand (`account_id WITH =`) requires `btree_gist` because UUID is a btree type and gist cannot natively handle it. Without the extension, `CREATE TABLE ... EXCLUDE` raises `ERROR: data type uuid has no default operator class for access method "gist"`, blocking constraint creation entirely.

**Detection:** `grep -r "btree_gist" supabase/migrations/` — if absent from the migration that introduces the EXCLUDE constraint, the deploy will fail. Also check `SELECT * FROM pg_extension WHERE extname = 'btree_gist';` in Supabase SQL Editor before running the migration.

**Prevention (Phase 27):** Add `CREATE EXTENSION IF NOT EXISTS btree_gist;` as the first statement in the migration file, before the `ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE` statement. Supabase enables most extensions via the dashboard or SQL Editor; this one is not enabled by default on new projects.

**Owner:** Phase 27

---

### V14-CP-02: Wrong range bound turns adjacent slots into false conflicts

**What goes wrong:** An EXCLUDE constraint using `tstzrange` for time overlap uses `&&` (overlap operator). If bounds are `[)` (inclusive start, exclusive end) this is correct: 9:00-9:30 and 9:30-10:00 have no overlap because `[09:00,09:30)` and `[09:30,10:00)` do not share a point. But if anyone writes bounds as `[]` (both inclusive) or uses `tstzrange(start_at, end_at, '[]')`, then 9:00-9:30 and 9:30-10:00 DO overlap at 9:30 — adjacent slots falsely collide and back-to-back appointments become impossible.

**Detection:** Grep the migration for `tstzrange`. Verify the third argument is `'[)'`. Test: insert two confirmed bookings in adjacent slots (09:00-09:30 and 09:30-10:00) for the same `account_id` but different `event_type_id`. Both must succeed. If the second raises `23P01`, the bounds are wrong.

**Prevention (Phase 27):** Always use `tstzrange(start_at, end_at, '[)')`. This is the standard half-open interval; all calendar systems use it for this reason. Write it explicitly — do not rely on the default (which is also `[)` in Postgres but is better made explicit in code review).

**Owner:** Phase 27

---

### V14-CP-03: Missing `WHERE status = 'confirmed'` predicate blocks cancelled rows permanently

**What goes wrong:** An EXCLUDE constraint without a `WHERE` predicate applies to all rows regardless of status. A cancelled booking at 10:00 then permanently blocks that slot for the same account — no new booking can ever land there, even after cancellation. This is the same category of bug that the existing `bookings_capacity_slot_idx` partial index avoids (it scopes to `status = 'confirmed'`).

**Detection:** After adding the constraint, cancel a booking and attempt to re-book the same slot for a different event type on the same account. If the re-book is rejected with `23P01`, the predicate is missing.

**Prevention (Phase 27):** The EXCLUDE constraint must be declared as a partial constraint: `EXCLUDE USING gist (...) WHERE (status = 'confirmed')`. Postgres supports partial exclusion constraints via the `WHERE` clause, identical to partial indexes.

**Owner:** Phase 27

---

### V14-CP-04: Group-booking event types — EXCLUDE predicate must allow same-event-type capacity stacking

**What goes wrong:** A naive EXCLUDE constraint on `(account_id, tstzrange(start_at, end_at, '[)'))` with `&&` blocks ALL overlapping rows for the same account — including same-event-type group bookings where `slot_index` 1, 2, 3 are intentionally all at the same time. This destroys the v1.1 capacity feature entirely.

**The mechanism:** EXCLUDE constraints fire on any two rows that satisfy the predicate and whose excluded columns overlap. Two rows with the same `account_id` and overlapping time ranges will violate the constraint regardless of `event_type_id` or `slot_index`.

**Correct approach:** The EXCLUDE predicate must include `event_type_id WITH <>` (using the `<>` operator, requiring `btree_gist`). The constraint reads: "for this `account_id`, no two rows with DIFFERENT `event_type_id` values may have overlapping time ranges." Two rows with the SAME `event_type_id` are allowed to overlap (they are group-booking slots, distinguished by `slot_index`). The exact form is:

```sql
CONSTRAINT bookings_cross_event_no_overlap
EXCLUDE USING gist (
  account_id    WITH =,
  event_type_id WITH <>,
  tstzrange(start_at, end_at, '[)') WITH &&
)
WHERE (status = 'confirmed')
```

Note: `WITH <>` on an exclusion constraint means "exclude pairs where this column is DIFFERENT" — which is the opposite of the usual `WITH =`. This is the correct semantics for cross-event-type conflict detection while permitting same-event-type overlap.

**Detection:** After adding the constraint, attempt to insert two confirmed bookings at the same time, same account, same `event_type_id` but different `slot_index` (simulating capacity=2 group booking). Both must succeed. If the second fails with `23P01`, the predicate is wrong.

**Prevention (Phase 27):** Use the exact SQL above. Verify with a group-booking regression test that mirrors `race-guard.test.ts` CAP-06 structure.

**Owner:** Phase 27

---

### V14-CP-05: EXCLUDE constraint creation locks the table and CANNOT be added concurrently

**What goes wrong:** Unlike `CREATE INDEX CONCURRENTLY`, there is no `ADD CONSTRAINT ... EXCLUDE ... CONCURRENTLY` in any Postgres version including 17.6.1. `ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE` takes a full `ACCESS EXCLUSIVE` lock for the duration of constraint creation and validation. On a table with many rows, this blocks all reads and writes.

**Detection:** Verify by checking Postgres 17 docs: `CREATE INDEX CONCURRENTLY` exists; `ADD CONSTRAINT EXCLUDE CONCURRENTLY` does not. Check `SELECT count(*) FROM bookings;` in prod before applying — if large, schedule during low-traffic window.

**Prevention (Phase 27):** Use the two-step `NOT VALID` + `VALIDATE CONSTRAINT` approach:

```sql
-- Step 1: add WITHOUT validating existing rows (does not scan table; minimal lock)
ALTER TABLE bookings ADD CONSTRAINT bookings_cross_event_no_overlap
  EXCLUDE USING gist (
    account_id    WITH =,
    event_type_id WITH <>,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status = 'confirmed') NOT VALID;

-- Step 2: validate (scans table; only takes ShareUpdateExclusiveLock — reads allowed, writes proceed)
ALTER TABLE bookings VALIDATE CONSTRAINT bookings_cross_event_no_overlap;
```

New INSERTs are enforced immediately after Step 1. Step 2 can run in a separate migration or maintenance window and does not block writes.

**Owner:** Phase 27

---

### V14-CP-06: Existing cross-event overlapping bookings reject constraint validation — pre-flight required

**What goes wrong:** Andrew's reported duplicate booking is exactly the class of row that will cause `VALIDATE CONSTRAINT` to fail. If two confirmed bookings for different event types overlap on the same account, Postgres aborts with `ERROR: conflicting key value violates exclusion constraint`. The migration cannot complete until existing violations are resolved.

**Required pre-flight diagnostic (run in Supabase SQL Editor before any migration):**

```sql
SELECT
  a.id AS booking_a,
  b.id AS booking_b,
  a.account_id,
  a.event_type_id AS et_a,
  b.event_type_id AS et_b,
  a.start_at AS start_a,
  b.start_at AS start_b
FROM bookings a
JOIN bookings b ON
  a.account_id = b.account_id
  AND a.event_type_id <> b.event_type_id
  AND a.id < b.id
  AND tstzrange(a.start_at, a.end_at, '[)') &&
      tstzrange(b.start_at, b.end_at, '[)')
WHERE a.status = 'confirmed'
  AND b.status = 'confirmed';
```

If this returns rows, resolve each pair (cancel the duplicate, determine which booking is authoritative) before applying any migration. Do not skip this step.

**Detection:** Run the query above. Zero rows = proceed. Any rows = stop, resolve, re-run.

**Prevention (Phase 27):** Pre-flight diagnostic is a hard gate — treat it as Phase 27 Step 0. The migration plan must list it before any SQL execution. This also serves as the root-cause confirmation for the reported double-booking.

**Owner:** Phase 27

---

### V14-CP-07: Reschedule path — INSERT-before-UPDATE transaction order fires constraint on transient overlap

**What goes wrong:** The current `lib/bookings/reschedule.ts` does a single in-place `UPDATE` — it moves `start_at`/`end_at`, keeps `status = 'confirmed'`, rotates tokens. The EXCLUDE constraint handles this correctly because Postgres evaluates the constraint after the row is modified; there is no transient state where the old and new rows both exist.

The risk materializes if any future code path (admin reschedule, owner-initiated reschedule, import) uses an INSERT + UPDATE pattern (new row inserted, old row cancelled). If the NEW row is inserted as `status = 'confirmed'` while the OLD row is still `status = 'confirmed'` at the same time, both rows are briefly in scope for the constraint and it may fire incorrectly depending on time ranges.

**Safe order for INSERT + UPDATE pattern (if ever introduced):** Always `UPDATE ... SET status = 'rescheduled' WHERE id = old_id` BEFORE the `INSERT` of the new row — inside a single transaction. The old row exits the constraint's scope before the new row enters.

**Detection:** `grep -rn "INSERT.*bookings\|bookings.*INSERT" app/ lib/` — audit any INSERT that is not the main `/api/bookings` handler. The current `reschedule.ts` is UPDATE-only (safe). Audit if this pattern changes.

**Prevention (Phase 27 + ongoing):** Add a JSDoc invariant to `reschedule.ts` and any future admin-reschedule function: "If using INSERT + UPDATE, UPDATE the old row's status to 'rescheduled' before inserting the replacement. Constraint fires on INSERT; old row must be out of scope first."

**Owner:** Phase 27 (document); ongoing for any future admin-reschedule feature

---

## Moderate Pitfalls

Mistakes that cause wrong behavior, 500 errors, or confusing UX — fixable without schema changes.

---

### V14-MP-01: Error code `23P01` falls into the generic 500 branch in `route.ts`

**What goes wrong:** The booking INSERT loop in `app/api/bookings/route.ts:243` only branches on `code === "23505"`. The new EXCLUDE constraint raises Postgres error `23P01` (exclusion_violation), not `23505`. Code `23P01` hits the `else` branch at line 267-272, logs the error, and returns `500 INTERNAL` with `code: "INTERNAL"`. The booker sees "Booking failed. Please try again." with no actionable guidance.

**Detection:** `grep -n "23505\|23P01" app/api/bookings/route.ts` — if `23P01` is absent, the handler is incomplete.

**Prevention (Phase 27):** Add an explicit branch in the INSERT loop for `23P01`. Because this is NOT a capacity-slot retry case (cross-event conflict is not resolved by trying a different `slot_index`), break out of the retry loop immediately and return 409:

```typescript
if (result.error.code === "23P01") {
  return NextResponse.json(
    {
      error: "That time conflicts with another appointment. Pick a new time.",
      code: "CROSS_EVENT_CONFLICT",
    },
    { status: 409, headers: NO_STORE },
  );
}
```

This branch must appear before the `23505` retry logic in the loop body.

**Owner:** Phase 27

---

### V14-MP-02: Reschedule route also needs `23P01` handling in `reschedule.ts`

**What goes wrong:** `lib/bookings/reschedule.ts:149` catches `updateError.code === "23505"` and maps it to `slot_taken`. The EXCLUDE constraint also fires `23P01` on UPDATE when a reschedule moves a booking to a time occupied by a different event type. `23P01` falls through to the `db_error` branch, which returns a generic 500 from `/api/reschedule`.

**Detection:** `grep -n "23505\|23P01" lib/bookings/reschedule.ts` — `23P01` should be present.

**Prevention (Phase 27):** Add a `23P01` branch in `reschedule.ts` that returns `{ ok: false, reason: "slot_taken" }` (reuse the existing reason variant — from the booker's perspective, the new time is unavailable regardless of which constraint fired). The route handler already maps `slot_taken` to a 409 with a friendly message.

**Owner:** Phase 27

---

### V14-MP-03: Stale browser slot cache — `CROSS_EVENT_CONFLICT` must be a user-recoverable 409

**What goes wrong:** Booker fetches available slots at T=0. A different event type books the same time at T=0+N seconds. Booker submits. Without V14-MP-01, this is a 500. With V14-MP-01, it is a 409 `CROSS_EVENT_CONFLICT`. But if the booking form's 409 handler only branches on `code === "SLOT_TAKEN"`, the new code is silently treated as an unhandled error — form may reset or show a generic failure state, losing the booker's entered data.

**Detection:** Audit the booking form submission handler for 409 response processing. Verify `CROSS_EVENT_CONFLICT` is handled identically to `SLOT_TAKEN` — inline banner, preserved form values, prompt to pick a new time.

**Prevention (Phase 27):** Extend the client-side 409 handler to match `CROSS_EVENT_CONFLICT` with copy: "That time is no longer available — please select a different time." The form values (name, email, phone, answers) must be preserved. This is the v1.0/v1.1 inline-banner pattern applied to the new error code.

**Owner:** Phase 27

---

### V14-MP-04: Bookings page crash (BOOK-01/02) — diagnostic-first, not assumption-first

**What goes wrong:** Jumping to a fix before identifying the crash source wastes a phase. The `queryBookings` function in `_lib/queries.ts` uses `createClient()` (RLS-scoped session client), joins `event_types!inner`, and `BookingRow.booker_phone` is `string | null` with conditional rendering already guarded in `bookings-table.tsx:89` and `[id]/page.tsx:205`. The null-phone path is already safe.

**Most likely root cause based on code reading:** The `event_types!inner` normalization at `queries.ts:92` (`Array.isArray(row.event_types) ? row.event_types[0] : row.event_types`) returns `undefined` if PostgREST returns an empty array (which happens when the join produces no match — e.g., soft-deleted event type where RLS or the join condition excludes the row). Accessing `et.name` on `undefined` crashes. Secondary candidate: RLS policy blocking the join for a specific account state.

**Detection (Phase 26):** Check Vercel function logs for the exact stack frame. Run the bookings query directly in Supabase SQL Editor substituting the owner's `auth.uid()`. If zero rows return but bookings exist, RLS is the culprit. If rows return but `event_types` is null/empty on some rows, the join normalization needs a null guard.

**Prevention (Phase 26):** Diagnostic-first protocol: (1) read server logs, (2) reproduce in SQL Editor, (3) fix the confirmed root cause only. Do not add speculative null guards before confirming root cause — they hide bugs instead of fixing them.

**Owner:** Phase 26

---

### V14-MP-05: New pg-driver tests must use the `SUPABASE_DIRECT_URL` skip-guard pattern

**What goes wrong:** A new test file for the EXCLUDE constraint that calls `pgDirectClient()` directly will fail in Vercel CI with `SUPABASE_DIRECT_URL missing from .env.local`, causing an uncaught error rather than a clean skip. The existing `race-guard.test.ts` avoids this with `describe.skipIf(skipIfNoDirectUrl)` at lines 89-91.

**Detection:** `grep -n "hasDirectUrl\|skipIfNoDirectUrl" tests/race-guard.test.ts` — the pattern is established. Any new pg-driver test must replicate it verbatim.

**Prevention (Phase 27):** New test describe blocks using `pgDirectClient()` must begin with:

```typescript
const skipIfNoDirectUrl = !hasDirectUrl();
describe.skipIf(skipIfNoDirectUrl)("...", () => { ... });
```

Import `{ pgDirectClient, hasDirectUrl }` from `./helpers/pg-direct`. Never call `pgDirectClient()` outside a `skipIf`-guarded describe block.

**Owner:** Phase 27

---

### V14-MP-06: `rate_limit_events` cleanup gap — pg-driver tests may exacerbate carryover DEBT-01

**What goes wrong:** Carryover debt DEBT-01 from v1.3 is an incomplete `rate_limit_events` table cleanup in the test suite. Adding more pg-driver tests that create bookings may compound isolation failures if any test path touches rate-limit records. The existing `race-guard.test.ts` cleanup only deletes `bookings` and `event_types`.

**Detection:** New Phase 27 tests that use direct pg-driver INSERTs bypass the application layer entirely and do NOT trigger rate-limit middleware — this path is safe for now. Risk materializes only if application-layer HTTP calls are added to Phase 27 tests.

**Prevention (Phase 27):** New tests must use direct pg-driver INSERTs (not HTTP calls to `/api/bookings`) to avoid touching rate-limit records. This is a known risk, not a v1.4 fix item.

**Owner:** Phase 27 (awareness only; fix is out of scope)

---

## Minor Pitfalls

Mistakes that are visually wrong but cause no data loss.

---

### V14-mp-01: Mobile calendar overflow — do NOT add `overflow-x-auto` to the Calendar root

**What goes wrong:** Wrapping the `Calendar` component in `overflow-x-auto` creates a horizontally scrollable box inside the card. Users rarely expect horizontal scroll inside a calendar widget — the result is a broken-feeling UX on mobile where only part of the calendar is visible and the user must scroll sideways to see weekend columns.

**Detection:** Inspect `home-calendar.tsx` — if `overflow-x-auto` appears anywhere in the className chain, it is wrong. The shared `components/ui/calendar.tsx` exposes `--cell-size` as a CSS custom property (`[--cell-size:--spacing(7)]` = 28px). The correct fix is overriding this property to a smaller value on the instance.

**Prevention (Phase 25):** Apply a `style` override on the `<Calendar>` instance in `home-calendar.tsx` to reduce cell size at mobile breakpoints, or use a smaller container padding via `className`. Do not modify `components/ui/calendar.tsx` (v1.3 invariant: shared shadcn component is untouchable). Example: `style={{ "--cell-size": "var(--spacing-6)" } as React.CSSProperties}` as a starting point.

**Owner:** Phase 25

---

### V14-mp-02: Auth pill removal — `Header variant="auth"` IS the pill; no dedicated component exists

**What goes wrong:** Searching for `AuthPill` or `auth-pill` finds nothing — the auth header is `<Header variant="auth" />` from `app/_components/header.tsx`. The NSI wordmark renders for both `variant="owner"` and `variant="auth"` (lines 88-106 of `header.tsx`, shared `else` branch). Deleting a nonexistent component or patching the wrong variant removes the owner dashboard header.

**Scope boundary confirmed by code reading:**
- Auth pages using `<Header variant="auth" />`: `login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `verify-email/page.tsx`, `auth-error/page.tsx`, `account-deleted/page.tsx`, `onboarding/layout.tsx`
- `PoweredByNsi` is in `PublicShell` and `EmbedShell` only — NOT on auth pages, must remain untouched

**Detection (before touching):** Read each auth page file listed above to confirm `<Header variant="auth" />` usage. Do NOT assume a layout file handles it centrally without verifying.

**Prevention (Phase 25):** Remove `<Header variant="auth" />` from each auth page (or add `variant="none"` that renders `null`). Do not modify the owner variant. Do not touch `powered-by-nsi.tsx` or any public-surface layout.

**Owner:** Phase 25

---

### V14-mp-03: Calendar selected color — do NOT use a hardcoded hex; use `bg-primary`

**What goes wrong:** The current `home-calendar.tsx` uses `"bg-gray-700"` for the selected DayButton. If changed to a hardcoded hex (e.g., `"#1E40AF"`) to reach NSI blue, this violates the spirit of MP-04 for static values and orphans the color from the theme token system. If the brand color changes post-v1.2, the calendar cell is missed.

**Detection:** `grep -n "isSelected\|bg-gray-700\|bg-blue\|#[0-9A-Fa-f]" app/**/home-calendar.tsx` — any static hex in a className string is wrong. Inline styles are correct for runtime-computed values (MP-04); for static brand colors, a Tailwind token is correct.

**Prevention (Phase 25):** Change `"bg-gray-700"` to `"bg-primary"` in the `isSelected` className branch of `home-calendar.tsx`. `--primary` is already NSI blue post-v1.2 CSS token. Zero new variables, zero new files, zero touches to `globals.css` or `components/ui/calendar.tsx`.

**Owner:** Phase 25

---

## Phase-Specific Summary

| Phase | Pitfall IDs | Risk Level | Notes |
|-------|-------------|------------|-------|
| 25 (surgical) | V14-mp-01, V14-mp-02, V14-mp-03 | Low | Visual fixes only; follow invariants strictly |
| 26 (debug) | V14-MP-04 | Medium | Server logs first; resist premature fix |
| 27 (architectural) | V14-CP-01 through V14-CP-07, V14-MP-01 through V14-MP-06 | High | Pre-flight diagnostic is a hard gate before any migration SQL |

---

## "Looks Done But Isn't" Checklist

Run this checklist before marking Phase 27 complete:

- [ ] **Extension present:** `SELECT extname FROM pg_extension WHERE extname = 'btree_gist'` returns a row
- [ ] **Constraint exists and is valid:** `SELECT conname, convalidated FROM pg_constraint WHERE conname = 'bookings_cross_event_no_overlap'` returns one row with `convalidated = true`
- [ ] **Adjacent-slot test passes:** Two confirmed bookings for DIFFERENT event types at 09:00-09:30 and 09:30-10:00 on the same account both succeed (no false collision on touching bounds)
- [ ] **Same-event-type group booking still works:** Two confirmed bookings for the SAME event type at the same time on the same account (different `slot_index`) both succeed (capacity feature not broken)
- [ ] **Cross-event conflict is rejected:** Two confirmed bookings for DIFFERENT event types at an overlapping time on the same account: second INSERT raises `23P01` (constraint fires correctly)
- [ ] **Cancelled rows are ignored:** Cancel one booking from the cross-event overlap; attempt to book the same slot with a different event type — must succeed (`WHERE status = 'confirmed'` predicate working)
- [ ] **`23P01` returns 409, not 500:** Submit a booking via the public form for a slot blocked by a different event type — API returns `{"code":"CROSS_EVENT_CONFLICT"}` at HTTP 409, NOT 500
- [ ] **Reschedule to a blocked slot returns 409:** Reschedule a booking to a time occupied by a different event type — `/api/reschedule` returns 409 (not 500)
- [ ] **Pre-flight query ran and returned zero rows** before the migration was applied (V14-CP-06)
- [ ] **New pg-driver tests use `skipIfNoDirectUrl` guard** and CI passes without `SUPABASE_DIRECT_URL` set
- [ ] **Phase 25 visual items:** `bg-primary` on selected day (not `bg-gray-700`, not hardcoded hex), no `overflow-x-auto` on calendar, auth pill removed from auth pages only, public `PoweredByNsi` footer unchanged
