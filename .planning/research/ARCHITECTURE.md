# ARCHITECTURE.md — v1.4 Slot Correctness + Polish

**Project:** Calendar App v1.4
**Researched:** 2026-05-02
**Mode:** Architecture / Feasibility
**Overall confidence:** HIGH (all findings sourced from direct codebase inspection)

> **NOTE ON CROSS-AGENT DISAGREEMENT:** This architecture research recommends Option B (BEFORE INSERT/UPDATE trigger) and rejects Option A (EXCLUDE USING gist). The parallel STACK.md research found that the simple form `EXCLUDE USING gist (account_id WITH =, during WITH &&)` DOES compile and behave correctly in production Postgres 17.6.1 — but Stack's tested form does NOT address the group-booking capacity coexistence requirement (it would block same-event-type group bookings, since `max_bookings_per_slot > 1` allows multiple confirmed rows at the same `(event_type_id, start_at)`).
>
> An EXCLUDE form that DOES preserve group capacity is theoretically possible using btree_gist's `<>` operator class on `event_type_id`:
>
> ```sql
> EXCLUDE USING gist (
>   account_id    WITH =,
>   event_type_id WITH <>,
>   during        WITH &&
> ) WHERE (status = 'confirmed');
> ```
>
> This means: two rows conflict iff same account AND different event_type AND overlapping ranges. The synthesizer should test this form against Postgres 17.6.1 to confirm it compiles and that the semantics match. If it works, Option A becomes viable and is preferable to Option B (declarative > imperative; smaller migration; no PL/pgSQL function to maintain). If `WITH <>` is rejected by gist, Option B stands.

---

## Critical Discovery: Reschedule is a Single UPDATE, Not INSERT+Mark-Old

Before the mechanism analysis: `lib/bookings/reschedule.ts` does a **single `UPDATE`** that moves `start_at`/`end_at` in-place on the confirmed row. Status stays `'confirmed'` throughout. There is no `INSERT` + status change to `'rescheduled'`. The `booking_events` table gets a `event_type: 'rescheduled'` audit entry, but `bookings.status` never becomes `'rescheduled'` on reschedule — it stays `'confirmed'` with new coordinates and fresh token hashes.

This is the most important piece of context for constraint design. The partial-index predicate `WHERE status='confirmed'` fires continuously on a rescheduled booking — there is no status transition that briefly "frees" a slot. The UPDATE moves the row's `(start_at, end_at)` while it stays in the `status='confirmed'` index.

---

## 1. Primary Recommendation: Option B — BEFORE INSERT/UPDATE Trigger

**Primary approach (pending synthesizer reconciliation with Option A `WITH <>` variant): PostgreSQL `BEFORE INSERT OR UPDATE` trigger function.**

```sql
CREATE OR REPLACE FUNCTION check_cross_event_type_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Only enforce on confirmed rows. Cancellations and status-only updates pass freely.
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Check for confirmed bookings on the SAME account, DIFFERENT event type,
  -- whose time range overlaps the incoming row's range.
  IF EXISTS (
    SELECT 1
    FROM bookings
    WHERE account_id = NEW.account_id
      AND event_type_id <> NEW.event_type_id
      AND status = 'confirmed'
      AND start_at < NEW.end_at      -- their start is before our end
      AND end_at > NEW.start_at      -- their end is after our start
      -- Exclude the row being updated (reschedule moves the same row to a new slot)
      AND id <> NEW.id
    LIMIT 1
  )
  THEN
    RAISE EXCEPTION 'cross_event_type_conflict'
      USING ERRCODE = 'P0001',
            DETAIL = 'A confirmed booking on this account overlaps the requested slot.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_cross_event_type_conflict
  BEFORE INSERT OR UPDATE OF start_at, end_at, status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_cross_event_type_overlap();
```

**Why Option B over the others (as originally analyzed):**

**Option A — simple form `(account_id WITH =, during WITH &&)` rejected:** This form blocks ALL overlapping confirmed rows on an account, including same-event-type group bookings (`max_bookings_per_slot > 1`). Breaks v1.1 capacity contract.

**Option A — `WITH <>` variant (open question):** `EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status='confirmed')` semantically expresses the exact invariant. Requires verification that btree_gist provides the `<>` operator class for UUID and that gist accepts this multi-column form. If valid, this is preferable to Option B (declarative DDL, no PL/pgSQL function). Synthesizer should test this against the production Postgres before locking the implementation choice.

**Option C (application-layer SELECT FOR UPDATE) — rejected as primary.** Wrapping the INSERT in a `SERIALIZABLE` transaction through the Supabase JS client is possible but `supabase-js` does not expose `BEGIN`/`COMMIT` natively — you'd need `rpc()` calls to a stored procedure or raw SQL via `supabase.rpc('begin')`. More critically, the retry loop in `route.ts:212-249` uses the Supabase Postgrest client, not a pg-driver transaction. Making the check atomic with the INSERT across that abstraction boundary is fragile. A direct POST that bypasses the app entirely would bypass the check. The trigger is the correct place for invariants that must hold regardless of call path. Reject as primary.

**Option D (hybrid) — partially adopted.** The trigger (or EXCLUDE constraint) IS the DB safety net. The application layer already returns `409 SLOT_TAKEN` on `23505`. For v1.4, the application route should also map the new error code (`P0001` for trigger, `23P01` for EXCLUDE) to a friendly `409` response with code `CROSS_EVENT_CONFLICT`. This is not application-layer enforcement — it's clean UX on top of the DB guarantee. The hybrid is: DB enforcement, route handler for user-facing error mapping.

---

## 2. Group-Booking Capacity Coexistence

The trigger explicitly skips checking within the same `event_type_id` (`AND event_type_id <> NEW.event_type_id`). The existing `bookings_capacity_slot_idx` unique index handles same-event-type enforcement via the `slot_index` retry loop. The two mechanisms are orthogonal:

- `bookings_capacity_slot_idx` ON `(event_type_id, start_at, slot_index) WHERE status='confirmed'` — enforces group capacity within a type. The `slot_index` retry loop in `route.ts:212-249` exhausts slots 1..N and surfaces `SLOT_CAPACITY_REACHED` on `23505`.
- `bookings_cross_event_type_conflict` (trigger or EXCLUDE) — enforces account-scoped non-overlap across types. Returns `P0001` (trigger) or `23P01` (EXCLUDE) on cross-type collision.

The trigger fires on every INSERT and on UPDATE of `start_at`/`end_at`/`status`. When the slot_index retry loop attempts insert at slot_index=2, the trigger will re-check cross-event-type overlap — this is correct and desired, since a different slot_index does not change the time range.

**One edge case:** a group-capacity event type (e.g., `max_bookings_per_slot=3`) would be blocked from taking a slot that overlaps a confirmed booking from a *different* event type on the same account. This is the intended behavior — contractor is busy regardless of which event type absorbed the original booking.

---

## 3. Reschedule Path Coexistence

Because reschedule is a single `UPDATE` (not INSERT + status change), the trigger behavior is:

- `BEFORE UPDATE OF start_at, end_at, status` fires when `rescheduleBooking()` calls `.update({ start_at: newStartAt, end_at: newEndAt, ... })`.
- `NEW.id = OLD.id` (same row), so the `AND id <> NEW.id` exclusion in the trigger correctly skips the current row when scanning for conflicts. A booking being rescheduled does not conflict with its own current position.
- The CAS guard (`WHERE reschedule_token_hash = oldHash`) means only one concurrent reschedule for a given booking can win. If two rescheduled bookings race to the same target slot, the cross-event-type trigger fires for the second to land if they are on different event types; same-event-type reschedule races are handled by the existing `bookings_capacity_slot_idx` + `23505` path (the `UPDATE` moves into a unique-index slot already occupied, producing 23505).
- The `reschedule.ts` error handler already maps `23505` to `slot_taken`. Map `P0001` / `23P01` to `slot_taken` as well (the UX message "That time was just booked. Pick a new time." is appropriate for both cases).

The OLD `start_at`/`end_at` slot is freed implicitly: the UPDATE replaces the row's time range, so it no longer occupies the old slot in the trigger's scan. No special "old slot release" logic is needed.

**EXCLUDE-form note:** Postgres EXCLUDE constraints inherently handle the "self" case correctly when the row is being UPDATEd in place — the constraint checks NEW vs. all other rows, not NEW vs. OLD. So the `id <> NEW.id` carveout in the trigger version isn't needed in the EXCLUDE form.

---

## 4. Cancel Path Coexistence

Cancel does `UPDATE status = 'cancelled'`. The trigger's first guard is:

```sql
IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
```

A cancel UPDATE sets `NEW.status = 'cancelled'`, so the trigger returns immediately without checking for overlaps. The cancelled row drops out of the `WHERE status='confirmed'` scan in both the trigger and `bookings_capacity_slot_idx`. The slot is freed on cancel. No special handling needed.

EXCLUDE-form note: same outcome via `WHERE (status = 'confirmed')` clause on the constraint.

---

## 5. Migration Apply Pattern

The trigger function and trigger creation do NOT require `CONCURRENTLY` — they are not index builds. They can run in a normal transaction. The existing Supabase CLI locked pattern (`db query --linked -f` wraps in implicit transaction) IS safe for trigger DDL.

**EXCLUDE-form caveat:** Adding an EXCLUDE constraint that uses gist takes an `ACCESS EXCLUSIVE` lock during creation and CANNOT be added concurrently. On the production `bookings` table this should be fast (small table; <10K rows expected at v1.4 scope), but Stack research should confirm. If the constraint creation locks the table for >2 seconds, consider creating it via `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID` first then `VALIDATE CONSTRAINT` later (only safe if pre-flight diagnostic confirms zero existing violations).

Migration file approach (trigger version):

```sql
-- supabase/migrations/20260502XXXXXX_v14_cross_event_type_conflict_trigger.sql
-- Standard transactional DDL — no CONCURRENTLY needed.

CREATE OR REPLACE FUNCTION check_cross_event_type_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$ ... $$;

CREATE TRIGGER bookings_cross_event_type_conflict
  BEFORE INSERT OR UPDATE OF start_at, end_at, status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_cross_event_type_overlap();
```

Apply via the locked workaround:

```bash
npx supabase db query --linked -f supabase/migrations/20260502XXXXXX_v14_cross_event_type_conflict_trigger.sql
```

The `-f` flag wraps in an implicit transaction which is fine for trigger DDL (unlike CONCURRENTLY index builds, which need the shell-pipe `echo | npx supabase db query --linked < file.sql` workaround). The `-f` path is the standard apply method here.

---

## 6. Pre-Flight Diagnostic SQL

Run this before adding the trigger to detect existing cross-event-type overlaps on confirmed bookings. If any rows are returned, they must be resolved (cancel one, or verify they are data artifacts from testing) before the trigger is safe to create.

```sql
-- Pre-flight: find existing confirmed cross-event-type overlaps on the same account.
-- Returns pairs of conflicting bookings. Expected result: 0 rows on a clean prod DB.
SELECT
  a.id          AS booking_a,
  a.event_type_id AS et_a,
  a.start_at    AS start_a,
  a.end_at      AS end_a,
  b.id          AS booking_b,
  b.event_type_id AS et_b,
  b.start_at    AS start_b,
  b.end_at      AS end_b,
  a.account_id
FROM bookings a
JOIN bookings b
  ON  a.account_id   = b.account_id
  AND a.event_type_id <> b.event_type_id
  AND a.status       = 'confirmed'
  AND b.status       = 'confirmed'
  AND a.start_at     < b.end_at
  AND a.end_at       > b.start_at
  AND a.id           < b.id   -- deduplicate pairs
ORDER BY a.account_id, a.start_at;
```

---

## 7. Test Architecture

The existing `tests/race-guard.test.ts` structure is the correct template. v1.4 needs three additions:

**Test A — unit: cross-event-type INSERT blocked**

Same structure as the existing `"only one of N parallel inserts"` test, but use two event types on the same account with the same time range on different event types. Expect the second INSERT to fail with a `P0001` error (or `23P01` for EXCLUDE form).

```typescript
// tests/cross-event-type-conflict.test.ts
it("cross-event-type INSERT on same account and overlapping slot is rejected", async () => {
  // Insert event_type A booking (confirmed)
  // Attempt INSERT of event_type B booking at same time on same account
  // Expect error.code === 'P0001' (trigger) OR '23P01' (EXCLUDE)
});
```

**Test B — pg-driver concurrent: two HTTP-equivalent INSERTs racing across event types**

Mirroring `CAP-06` but with two distinct event types. Race 10 workers where half target event_type_A and half target event_type_B at the same slot on the same account. Expect exactly 1 total success (the first arrival), 9 failures.

**Test C — integration: UX error message**

Mock/stub the route handler response. Verify that when `bookingApi` receives a 409 with `code: 'CROSS_EVENT_CONFLICT'`, the booking form renders a user-facing message. The exact message should be consistent with `SLOT_TAKEN` copy: "That time is no longer available." File: `tests/bookings-api.test.ts` or a new `tests/cross-event-conflict-ux.test.ts`.

---

## 8. Slot DISPLAY Layer — No Changes Needed

`app/api/slots/route.ts:135-148` already queries `account_id`-scoped confirmed bookings (the v1.1 Pitfall-4 fix). The display layer is account-wide and correct. The DB enforcement adds a layer that closes the gap the display already correctly represents. No changes to `slots/route.ts`.

---

## 9. Surgical Items — Integration Notes

**AUTH-21/22 ("Powered by NSI" element)**

The element is in `app/(auth)/_components/auth-hero.tsx:27-31` — it's a pill `div` inside `AuthHero`, which renders only on `lg:` breakpoints (the hero panel). It does NOT live in `Header` or `(auth)/layout.tsx`. There is no `(auth)/layout.tsx` — auth pages are individual page files (`app/(auth)/app/login/page.tsx`, etc.) that each import `<Header variant="auth" />` and `<AuthHero>` directly. The "Powered by NSI" element removal needs to happen in `auth-hero.tsx:27-31`.

**OWNER-14 — per-instance `className` override on `home-calendar.tsx` DayButton**

The DayButton is defined inline inside the `components` prop of `<Calendar>` in `app/(shell)/app/_components/home-calendar.tsx:56-116`. It does not accept a `className` prop from outside — it constructs its own class string at line 72. To change selected-state to NSI blue, modify the className construction directly: replace `bg-gray-700` (current de-orange selected) with `bg-primary text-primary-foreground` (which is NSI blue post-v1.2 owner-side `--primary` lock). The Phase 23/24 invariant of NOT touching `components/ui/calendar.tsx` is preserved.

**OWNER-15 — mobile width strategy for DayButton**

Three candidate sites in the same DayButton at `home-calendar.tsx:72`:
- The existing `min-w-[var(--cell-size,theme(spacing.9))]` is already present — this is what causes overflow on narrow mobile. Reduce the fallback (e.g., `min-w-0` or `min-w-[var(--cell-size,theme(spacing.7))]`) OR
- Add `overflow-hidden` to the button element itself to clip content that exceeds cell width, OR
- Add `overflow-x-auto` on the containing Card (in `home-dashboard.tsx`) so the calendar can scroll rather than overflow.

The right approach depends on desired UX. `overflow-hidden` on DayButton clips dots but prevents layout break. `overflow-x-auto` on the Card allows horizontal scroll. Reducing `--cell-size` fallback is the cleanest structural fix.

**BOOK-01/02 — bookings page crash, debug start point**

The query path is: `bookings/page.tsx:46` calls `queryBookings()` → `_lib/queries.ts:85` runs the Supabase query → `bookings-table.tsx:66` maps `row.event_types?.name`. The crash is most likely one of:

1. `queryBookings()` throws (line 85: `if (error) throw error`) — check server logs first. An RLS policy change, deleted column, or schema drift would surface here.
2. `row.event_types` is `null` despite `!inner` join — possible if a booking references a soft-deleted event type and RLS excludes it from the join result. `event_types!inner` should exclude those rows from the result set, but if the event type was hard-deleted (no `deleted_at`) the join returns null. The `??` guard at `bookings-table.tsx:66` handles null name but not a null `event_types` object. Add a null guard: the duration access at line 108 (`row.event_types?.duration_minutes`) needs guarding. Check whether `BookingRow.event_types` type allows `null` — it currently doesn't in the type definition at `queries.ts:30` (typed as required object). If the DB returns null, TypeScript won't catch it but the runtime will crash. Start: server logs → then add `console.log(rows)` before `<BookingsTable rows={rows} />` → then add null guards on `event_types` access.

---

## 10. Phase Ordering Recommendation

**Phase 25 (Surgical Polish — parallel-safe):** AUTH-21/22 (`auth-hero.tsx` element removal), OWNER-14 (DayButton selected-state className), OWNER-15 (mobile width). These are UI-only, no DB changes, no inter-dependencies. Can run in parallel or sequential.

**Phase 26 (Bookings Page Debug — independent):** BOOK-01/02 is a crash investigation with no DB schema dependency. It is NOT a blocker for slot-correctness work. Run parallel to Phase 25 or immediately after. The fix is likely a null guard or RLS/join artifact.

**Phase 27 (Slot Correctness — DB layer):** Pre-flight diagnostic SQL first, then DB enforcement migration (trigger or EXCLUDE per synthesizer reconciliation), then route-handler error-code mapping (`P0001`/`23P01` → `CROSS_EVENT_CONFLICT` in `route.ts` and `reschedule.ts`), then new tests. This phase has a hard dependency on Phase 26 completion only if the bookings page crash turns out to be caused by the same schema issue (unlikely — they are unrelated subsystems). Treat as independent.

**Dependency chain:**
- Phase 25 → Phase 26 → Phase 27 is a safe default ordering but 25 and 26 can swap or run in parallel.
- Phase 27 has one strict internal sequencing: pre-flight SQL → DB enforcement migration → error mapping → tests.
- Phase 27 does NOT depend on Phase 25 or 26.

**Slot_index mechanism relationship:** The new DB enforcement AUGMENTS the existing `bookings_capacity_slot_idx` index. They coexist without conflict. The trigger fires first (BEFORE); if it raises, the INSERT never reaches the unique index. EXCLUDE constraint fires at constraint-check time (after row construction, before commit). Either way, the retry loop in `route.ts:212-249` is unchanged — it only retries on `23505` from the index, not on `P0001`/`23P01` from the new enforcement.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Reschedule mechanism (UPDATE not INSERT) | HIGH | Direct code inspection of `lib/bookings/reschedule.ts` |
| Trigger approach viability | HIGH | Standard Postgres pattern; explicit predicate handles all coexistence requirements |
| EXCLUDE simple-form rejection | HIGH | Postgres EXCLUDE semantics mean `(account_id WITH =, during WITH &&)` blocks group bookings |
| EXCLUDE `WITH <>` variant viability | MEDIUM | Theoretically valid; needs synthesizer to verify against Postgres 17.6.1 + btree_gist 1.7 |
| Migration apply pattern | HIGH | Established in existing migration files and codebase comments |
| Auth-hero element location | HIGH | Direct file inspection |
| Bookings page crash root cause | MEDIUM | Speculative without seeing actual error message; debug path is concrete |
| DayButton className threading | HIGH | Pattern established in Phase 23/24 per milestone context |
