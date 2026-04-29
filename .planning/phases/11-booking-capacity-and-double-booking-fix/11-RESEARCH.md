# Phase 11: Booking Capacity + Double-Booking Root-Cause Fix — Research

**Researched:** 2026-04-28
**Domain:** Postgres concurrent booking capacity enforcement; race-safe N-per-slot patterns; Supabase Supavisor pooler compatibility; pg-driver test harness
**Confidence:** HIGH for local-code findings (read from source); HIGH for advisory-lock pooler verdict (verified from multiple authoritative sources); MEDIUM for slot_index pattern details (cross-referenced from code + PITFALLS.md + pgbouncer docs)

---

## Summary

Phase 11 has three interleaved concerns: (1) reproduce and root-cause the 2026-04-27 prod double-booking before designing a replacement; (2) replace `bookings_no_double_book` partial unique index with a race-safe N-per-slot mechanism; (3) expose `max_bookings_per_slot` in the event-type form and slot/booking API.

**On the root cause:** The `race-guard.test.ts` file uses `adminClient()` which is the supabase-js `@supabase/supabase-js` HTTP client, NOT a `pg`-driver direct connection. Supabase-js's `Promise.allSettled` sends 10 parallel HTTP requests to Supabase's REST API (PostgREST), which in turn connects to the DB via Supavisor (transaction mode, port 6543). HTTP serialization at the PostgREST layer means some requests may be serialized before reaching Postgres — so the v1.0 test does NOT fully prove race-safety at the Postgres level. The 2026-04-27 double-booking likely occurred because the partial-unique-index `bookings_no_double_book` IS correctly defined but the real double-booking was caused by the cancel/reschedule lifecycle: a cancelled booking sets `status='cancelled'` which removes it from the partial index, freeing the slot — if the code path re-sets status to 'confirmed' without going through the normal INSERT path, the index cannot fire. Alternatively: the incident may be a `status != 'confirmed'` gap in the `/api/bookings` bookings query for the slot-availability check in `computeSlots`, allowing a slot to appear available while a concurrent INSERT is in-flight.

**On pattern choice:** PITFALLS.md P-B1 recommends Pattern #1 (slot_index + extended unique index) and ARCHITECTURE.md B.2 recommends Pattern #2 (advisory-lock trigger). These are not fully consistent. This research resolves the conflict with evidence from the actual code, Supavisor behavior, and Postgres semantics. **The verdict is: use Option B (slot_index + extended unique index) — it is the only pattern that preserves an atomic DB-level uniqueness guarantee, works identically under all connection modes (pooled, direct, test, prod), requires zero new Postgres functions, and has the simplest migration path.**

**On pooler compatibility:** `pg_advisory_xact_lock` (transaction-scoped) IS safe under Supavisor transaction-mode pooling. Session-level `pg_advisory_lock` is NOT. However, the advisory-lock trigger pattern (Option A) introduces a SECURITY DEFINER function, adds hash-collision risk, and critically requires the trigger to execute atomically within the same DB transaction as the INSERT — which is true for a BEFORE INSERT trigger, but the surrounding infrastructure (PostgREST, supabase-js) does NOT guarantee that the INSERT statement and the advisory lock acquisition happen in a single explicit transaction. PostgREST wraps each request in one transaction by default, so for simple INSERTs it works, but the mechanism is opaque to the application layer.

**On the test harness:** CAP-06 requires testing at the `pg`-driver layer. This requires adding `postgres` (postgres.js) as a dev dependency and using its direct-connection string (port 5432, bypassing Supavisor). The current `race-guard.test.ts` does NOT satisfy CAP-06 — it must be extended.

**Primary recommendation:** Use Option B (slot_index + extended partial unique index). The migration is two steps: add `slot_index smallint NOT NULL DEFAULT 1`; replace `bookings_no_double_book` with `UNIQUE (event_type_id, start_at, slot_index) WHERE status='confirmed'`. The INSERT handler retries `slot_index = 1..N` on `23505`, returning 409 after `max_bookings_per_slot` exhausted.

---

## Standard Stack

The established tools for this phase — no new runtime dependencies needed except one dev dep for the race test harness.

### Core
| Library / Feature | Version | Purpose | Why Standard |
|---|---|---|---|
| Postgres partial unique index | Postgres 17.6.1 (prod) | Atomic N-per-slot capacity guard | Same mechanism as v1.0; no trigger required; works under all pooler modes |
| `@supabase/supabase-js` | ^2.103.1 (installed) | Application-layer booking INSERT with retry | Already used throughout; supabase-js wraps PostgREST |
| Supavisor transaction mode | Supabase managed | Default connection pooler for app traffic | All app traffic (PostgREST, supabase-js) routes through Supavisor on port 6543 |
| Direct Postgres connection (port 5432) | Supabase project `mogfnutxrrbtvnaupoun` | pg-driver test harness only | Bypasses Supavisor for true concurrent-connection race testing |

### Supporting (new — test harness only)
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `postgres` (postgres.js) | ^3.x | pg-driver direct connection for CAP-06 race test | ONLY in `tests/` — never in app code |

### Alternatives Considered
| Instead of | Could Use | Why Rejected |
|---|---|---|
| Option B (slot_index + unique index) | Option A (advisory-lock BEFORE INSERT trigger) | Advisory lock requires SECURITY DEFINER function; hash collision risk; less transparent under pooler; no atomic uniqueness guarantee if lock is missed; adds DB function surface; PITFALLS.md warns against it for this use case when v1.0 invariant can be extended |
| `postgres` npm package | `pg` npm package | `postgres.js` is the Supabase-recommended package for direct Postgres queries (Supabase docs reference it explicitly); tagged template literal API is cleaner for test harness |

**Installation (dev-only):**
```bash
npm install --save-dev postgres
```
No new runtime production dependency. `postgres` is test-only.

---

## Architecture Patterns

### Recommended Project Structure (Phase 11 changes)

```
supabase/migrations/
├── [ts]_phase11_capacity_column.sql       # Migration A: add max_bookings_per_slot + show_remaining_capacity columns
├── [ts]_phase11_slot_index_and_index.sql  # Migration B: add slot_index column + replace unique index (two-file approach per P-B2)

app/api/bookings/route.ts                  # Add slot_index retry loop; distinguish 23505 → SLOT_TAKEN vs SLOT_CAPACITY_REACHED
app/api/slots/route.ts                     # Pass max_bookings_per_slot + confirmed_count to computeSlots; return remaining_capacity
lib/slots.ts                               # Add slotConfirmedCount(); capacity-aware slot exclusion
lib/slots.types.ts                         # Add maxBookingsPerSlot, showRemainingCapacity to input types

app/(shell)/app/event-types/_lib/schema.ts         # Add max_bookings_per_slot: z.coerce.number().int().min(1).default(1)
                                                    # Add show_remaining_capacity: z.coerce.boolean().default(false)
app/(shell)/app/event-types/_lib/actions.ts        # Pass new fields to upsert
app/(shell)/app/event-types/_components/event-type-form.tsx  # Add capacity number input + toggle (CAP-03 + CAP-08)

tests/race-guard.test.ts                   # Extend: add pg-driver concurrent test (CAP-06 compliance)
tests/helpers/pg-direct.ts                 # New helper: postgres.js direct connection for race tests
```

### Pattern 1: slot_index Extended Unique Index (the replacement for bookings_no_double_book)

**What:** Add `slot_index smallint NOT NULL DEFAULT 1` to `bookings`. Replace the single `UNIQUE (event_type_id, start_at) WHERE status='confirmed'` with `UNIQUE (event_type_id, start_at, slot_index) WHERE status='confirmed'`. The INSERT handler attempts `slot_index=1`; on `23505` retries `slot_index=2..N`; if all N slots are taken, returns 409 with code `SLOT_CAPACITY_REACHED`.

**When to use:** Always — this is the chosen mechanism for Phase 11.

**Why it's race-safe:** Postgres unique index enforcement is atomic at the storage layer, identical to a PRIMARY KEY. No transaction isolation level matters; the second INSERT to the same `(event_type_id, start_at, slot_index=1)` raises `23505` unconditionally. This is provably stronger than any trigger-based count guard.

**Example (Migration B — the index swap, single transaction):**
```sql
-- supabase/migrations/[ts]_phase11_slot_index_and_index.sql
-- Run via: npx supabase db query --linked -f <file>
-- NOTE: CREATE UNIQUE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Use two-statement approach: CONCURRENTLY first (outside txn), then DROP old + trigger in txn.

-- Step 1 (run standalone, not in BEGIN/COMMIT):
create unique index concurrently if not exists bookings_capacity_slot_idx
  on bookings(event_type_id, start_at, slot_index)
  where status = 'confirmed';

-- Step 2 (run in a separate file or after step 1 completes, in one transaction):
begin;
  -- Drop the v1.0 single-capacity constraint atomically with the new one being live.
  drop index if exists bookings_no_double_book;
commit;
-- The new index is already live from Step 1; DROP is sub-millisecond.
```

**Example (INSERT handler in `/api/bookings/route.ts` — retry loop):**
```typescript
// Source: derived from actual route.ts lines 182-222 + PITFALLS.md P-B1 Pattern #1

const MAX_RETRIES = maxBookingsPerSlot; // fetched from event_types row (CAP-02)

let booking = null;
let insertError = null;

for (let slotIndex = 1; slotIndex <= MAX_RETRIES; slotIndex++) {
  const result = await supabase
    .from("bookings")
    .insert({
      // ...all existing fields...
      slot_index: slotIndex,
      status: "confirmed",
    })
    .select("id, start_at, end_at, booker_name, booker_email, booker_phone, booker_timezone, answers")
    .single();

  if (!result.error) {
    booking = result.data;
    insertError = null;
    break;
  }

  insertError = result.error;

  if (result.error.code !== "23505") {
    // Non-capacity error: propagate immediately
    break;
  }
  // 23505 = that slot_index was taken; try next
}

if (!booking) {
  if (insertError?.code === "23505") {
    // All slot_indexes 1..N were taken = capacity fully reached
    const code = maxBookingsPerSlot === 1 ? "SLOT_TAKEN" : "SLOT_CAPACITY_REACHED";
    return NextResponse.json(
      { error: "That time is fully booked. Please choose a different time.", code },
      { status: 409, headers: NO_STORE },
    );
  }
  // Other error
  return NextResponse.json(
    { error: "Booking failed. Please try again.", code: "INTERNAL" },
    { status: 500, headers: NO_STORE },
  );
}
```

### Pattern 2: pg-Driver Race Test (CAP-06 compliance)

**What:** Use `postgres` (postgres.js) with a direct connection (port 5432, bypassing Supavisor) to fire N truly concurrent INSERT statements against the same `(event_type_id, start_at)`. This tests the DB-level guarantee in isolation from HTTP serialization.

**Why direct connection:** Supavisor transaction-mode serializes connections at the pooler level. Concurrent supabase-js requests may be queued before reaching Postgres, meaning the race is suppressed by the pooler infrastructure. The `pg`-driver test must use port 5432 (direct) to put genuine concurrent load on Postgres.

**Example (tests/helpers/pg-direct.ts):**
```typescript
// Source: Supabase docs (postgres.js), derived pattern for test harness
// @vitest-environment node

import postgres from "postgres";

/** Direct Postgres connection, bypassing Supavisor.
 *  Uses SUPABASE_DIRECT_URL (port 5432) from .env.local.
 *  ONLY for race tests — never import in app code. */
export function pgDirectClient() {
  const url = process.env.SUPABASE_DIRECT_URL;
  if (!url) throw new Error("SUPABASE_DIRECT_URL missing from .env.local");
  return postgres(url, { max: 20 }); // allow N concurrent connections
}
```

**Example (race test extension in tests/race-guard.test.ts — new describe block):**
```typescript
// @vitest-environment node
import { pgDirectClient } from "./helpers/pg-direct";

describe("bookings race guard — pg-driver layer (CAP-06)", () => {
  it("capacity=3, 10 concurrent pg inserts → exactly 3 succeed", async () => {
    const sql = pgDirectClient();
    // Set up event type with max_bookings_per_slot=3 (CAP-02 column)
    // Fire 10 concurrent INSERTs attempting slot_index 1, each INSERT in a separate connection
    const startAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    const N = 10;
    const CAPACITY = 3;

    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => {
        const slotIndex = (i % CAPACITY) + 1; // distribute across 1..3
        return sql`
          INSERT INTO bookings (account_id, event_type_id, start_at, end_at,
            booker_name, booker_email, booker_timezone, status,
            cancel_token_hash, reschedule_token_hash, slot_index)
          VALUES (${accountId}, ${eventTypeId}, ${startAt}, ${endAt},
            ${"PG Booker " + i}, ${"pg-race-" + i + "@test.local"}, ${"America/Chicago"},
            ${"confirmed"}, ${"pg-cancel-" + i}, ${"pg-resched-" + i}, ${(i % CAPACITY) + 1})
          RETURNING id
        `;
      })
    );

    const succeeded = results.filter(r => r.status === "fulfilled");
    expect(succeeded.length).toBe(CAPACITY);
    expect(results.length - succeeded.length).toBe(N - CAPACITY);

    await sql.end();
  });
});
```

**Note on slot_index assignment in tests:** The test fires 10 concurrent INSERTs. For a fair race test, all 10 should attempt `slot_index=1` first (not pre-distributed). The real application handler retries in serial loops (slot_index=1, then 2, then 3). The pg-driver test should mirror this: each concurrent worker runs a retry loop internally.

### CAP-01: Root-Cause Investigation Procedure

**What to reproduce:** The 2026-04-27 prod double-booking. The system uses a partial unique index `bookings_no_double_book` which SHOULD prevent two confirmed rows at the same `(event_type_id, start_at)`. Yet a double-booking was observed.

**Diagnostic procedure (run against prod Supabase, in order):**

**Step 1 — Confirm the index still exists:**
```sql
-- Run in Supabase SQL Editor (project mogfnutxrrbtvnaupoun):
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bookings'
  AND indexname = 'bookings_no_double_book';
```
Expected: one row with `UNIQUE (event_type_id, start_at) WHERE (status = 'confirmed')`.
If missing: the index was somehow dropped — this IS the root cause.

**Step 2 — Check for any confirmed rows sharing (event_type_id, start_at):**
```sql
SELECT event_type_id, start_at, count(*) as n
FROM bookings
WHERE status = 'confirmed'
GROUP BY event_type_id, start_at
HAVING count(*) > 1;
```
Expected: zero rows.
If rows exist: the index DID NOT fire. Investigate Step 3.

**Step 3 — Check for any rows where the index COULD NOT have fired (type mismatch, timestamp precision):**
```sql
-- Are any start_at values stored with different precision that could bypass the index?
SELECT DISTINCT pg_typeof(start_at) FROM bookings LIMIT 1;
-- Expected: timestamp with time zone
```

**Step 4 — Review cancel/reschedule code paths that might re-insert with status='confirmed':**
The cancellation path sets `status='cancelled'`; rescheduling creates a new booking with `status='confirmed'` AND sets the old booking to `status='rescheduled'`. A NEW booking INSERT still goes through the unique index check. However: if a reschedule creates a new booking and the old booking's status update to 'rescheduled' lags (e.g., partial update due to error), you could have TWO rows with `status='confirmed'` at different times — not the same slot.

```sql
-- Check if the double-booking involved cancel/reschedule lifecycle:
SELECT b.id, b.event_type_id, b.start_at, b.status, b.created_at,
       be.event_type as audit_event, be.occurred_at
FROM bookings b
LEFT JOIN booking_events be ON be.booking_id = b.id
WHERE b.event_type_id = '<the event type id>'
  AND b.start_at = '<the double-booked slot>'
ORDER BY b.created_at, be.occurred_at;
```

**Step 5 — Check if the double-booking could be explained by a rescheduled booking that was counted as confirmed in the availability check but not in the insert guard:**

The current `computeSlots` in `lib/slots.ts` and `/api/slots/route.ts` (line 139) fetches bookings with `.neq("status", "cancelled")` — this means BOTH `confirmed` AND `rescheduled` bookings block slots. But the unique index only covers `status='confirmed'`. A `rescheduled` booking at a slot blocks the slot in the availability engine (preventing further bookings for that slot) but does NOT prevent an INSERT with `status='confirmed'` at that slot — because the index condition is `WHERE status='confirmed'`.

**This is the root cause hypothesis:** If a 'rescheduled' booking exists at a slot (old booking from a rescheduled appointment), and a new visitor books that same slot, the `/api/slots` endpoint correctly shows the slot as unavailable (`.neq("status", "cancelled")` catches it). BUT: if the slot-availability check was bypassed or the booking was submitted via the service-role admin client (which bypasses RLS) without going through `/api/slots`, the INSERT would succeed — because the unique index only blocks `status='confirmed'`, not `status='rescheduled'`.

**Alternatively:** The double-booking could be explained by a race where the availability check ran, found the slot empty, then a concurrent INSERT succeeded before this INSERT. With the unique index in place and status='confirmed', this should have raised 23505. The only way two `confirmed` rows at the same `(event_type_id, start_at)` can coexist is if the index did NOT exist at insert time (migration gap) OR if one row was inserted with a different `start_at` value (timestamp precision / timezone difference).

**Step 6 — Check for timestamp precision or timezone mismatch:**
```sql
-- Are both double-booked rows at exactly the same timestamptz?
SELECT id, start_at::text, start_at AT TIME ZONE 'UTC' as utc_time, status
FROM bookings
WHERE event_type_id = '<id>'
  AND date_trunc('hour', start_at) = date_trunc('hour', '<the slot>'::timestamptz)
ORDER BY start_at;
```
If `start_at` values differ by any amount (even microseconds), the unique index would NOT fire — they're considered different values.

**Document findings in Phase 11 SUMMARY before designing the replacement.** If the root cause is (a) index missing — the slot_index replacement closes it; (b) timestamp precision mismatch — fix the INSERT to normalize `start_at` before writing; (c) rescheduled-booking gap — the new mechanism (slot_index + confirmed-only index) has the same gap; document as accepted behavior since rescheduled bookings genuinely occupy the old slot.

### Pattern 3: Atomic Migration Strategy (P-B2 prevention)

**Two-migration forward-compatible rollout (per P-B2 in PITFALLS.md):**

**Migration A — add columns only, no index changes:**
```sql
-- supabase/migrations/[ts]_phase11_capacity_column.sql
ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS max_bookings_per_slot integer NOT NULL DEFAULT 1
    CHECK (max_bookings_per_slot >= 1);

ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS show_remaining_capacity boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN event_types.max_bookings_per_slot IS
  'Maximum confirmed bookings per slot. Default 1 = exclusive (v1.0 semantics). Owner-toggleable.';

COMMENT ON COLUMN event_types.show_remaining_capacity IS
  'When true, /api/slots returns remaining_capacity and the booker UI shows X spots left.';
```

**Migration B — add slot_index, create new index CONCURRENTLY, drop old index:**
```sql
-- supabase/migrations/[ts]_phase11_slot_index.sql  (Part 1 — run first, standalone)
-- Adds slot_index column (backfill DEFAULT=1 for all existing rows)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS slot_index smallint NOT NULL DEFAULT 1;

-- Create new index CONCURRENTLY (non-blocking; can run while prod takes writes)
-- NOTE: CONCURRENTLY cannot be inside BEGIN/COMMIT
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS bookings_capacity_slot_idx
  ON bookings(event_type_id, start_at, slot_index)
  WHERE status = 'confirmed';
```

```sql
-- supabase/migrations/[ts]_phase11_drop_old_index.sql  (Part 2 — run after Part 1 completes)
-- At this point both old + new indexes exist; window = zero for concurrent double-booking
BEGIN;
  DROP INDEX IF EXISTS bookings_no_double_book;
COMMIT;
```

**Deploy order:**
1. Apply Migration A → deploy code that reads `max_bookings_per_slot` (still relies on `bookings_no_double_book` for single-capacity enforcement).
2. Apply Migration B Part 1 (CONCURRENTLY) → both indexes coexist; zero production downtime.
3. Apply Migration B Part 2 (DROP old index) → old index gone; new index already live.
4. Deploy code that writes `slot_index` in the INSERT retry loop.

### Anti-Patterns to Avoid

- **Naïve BEFORE INSERT trigger with `SELECT count(*) ... < cap`:** Races under READ COMMITTED. Two concurrent inserts both see count=N-1, both pass, both commit → N+1 rows. This is EXACTLY what caused (or could have caused) the 2026-04-27 incident if any trigger was added. Do NOT add this.
- **Advisory-lock trigger (Option A) without verifying Supavisor context:** While `pg_advisory_xact_lock` IS safe under transaction-mode pooling (it releases at txn end), the trigger approach requires a SECURITY DEFINER function, adds hash-collision risk, and provides weaker guarantees than a unique index. Option B is strictly superior for this use case.
- **Running `CREATE UNIQUE INDEX CONCURRENTLY` inside a transaction:** Postgres forbids this. Always run CONCURRENTLY outside any explicit transaction block.
- **Dropping `bookings_no_double_book` without the replacement index already live:** Creates a capacity-exposure window. Use the two-step migration (CONCURRENTLY first, DROP second).
- **Using supabase-js HTTP layer for the CAP-06 race test:** Supavisor may serialize HTTP requests before reaching Postgres. The pg-driver direct connection (port 5432) is required to generate genuine Postgres-level concurrent load.

---

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Atomic N-per-slot capacity enforcement | Custom trigger with count-check | Postgres UNIQUE constraint on `(event_type_id, start_at, slot_index) WHERE status='confirmed'` | Unique constraint enforcement is atomic at the storage layer; no isolation level can race it |
| pg-driver concurrent test | Custom HTTP load generator | `postgres` (postgres.js) + `Promise.allSettled` with direct connection URL | postgres.js is Supabase-recommended; clean tagged-template API; minimal setup |
| Hash keys for advisory lock | Custom hash function | `hashtext()` (built-in Postgres function) | Deterministic, fast, built-in; no extension required |
| Remaining-capacity computation | SQL aggregate per slot | In-memory count in the pure `computeSlots()` function (see lib/slots.ts pattern) | `computeSlots` is already a pure function receiving all bookings; counting per-slot in JS maintains testability and avoids coupling to DB schema |

**Key insight:** Postgres unique indexes are the strongest available atomic guarantee. Any trigger, advisory lock, or application-level CAS is weaker or more complex. Extend the v1.0 invariant rather than replace it.

---

## Common Pitfalls

### Pitfall 1: Concurrent supabase-js test passes but pg-driver test fails
**What goes wrong:** `Promise.allSettled` with 10 supabase-js clients appears to show correct behavior (1 success, 9 failures) but actually Supavisor serialized the connections before they hit Postgres. The unique index appears to work, but the test provides false confidence.
**Why it happens:** Supavisor transaction mode assigns one server connection per transaction. Under high concurrency, requests queue at the pooler level. The "race" never reaches Postgres simultaneously.
**How to avoid:** CAP-06 explicitly requires pg-driver layer. Use `SUPABASE_DIRECT_URL` (port 5432) with postgres.js for the race test. Add to `.env.local` during Phase 11.
**Warning signs:** Race test passes even when the unique index is temporarily dropped.

### Pitfall 2: `CREATE UNIQUE INDEX CONCURRENTLY` inside a transaction
**What goes wrong:** `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`.
**Why it happens:** `CONCURRENTLY` is specifically designed to run outside a transaction so it can observe multiple snapshots while building the index.
**How to avoid:** Run the CONCURRENTLY statement in a standalone SQL file applied via `npx supabase db query --linked -f`. Never wrap it in `BEGIN/COMMIT`.
**Warning signs:** Migration file wraps ALL statements in one BEGIN/COMMIT block.

### Pitfall 3: slot_index DEFAULT=1 backfill conflicts with existing confirmed bookings
**What goes wrong:** Existing bookings all get `slot_index=1`. When the new unique index `(event_type_id, start_at, slot_index) WHERE status='confirmed'` is created, any slot that already has TWO confirmed bookings (i.e., the double-booking that CAP-01 is investigating) will fail index creation.
**Why it happens:** `CREATE UNIQUE INDEX` (with or without CONCURRENTLY) validates uniqueness across ALL existing rows.
**How to avoid:** Run CAP-01 root-cause investigation FIRST. If any duplicate `(event_type_id, start_at, status='confirmed')` pairs exist, clean them up before creating the new index. The CAP-01 diagnostic queries (Step 2) reveal this.
**Warning signs:** `CREATE INDEX CONCURRENTLY` completes but `pg_indexes` shows `indisvalid=false`.

### Pitfall 4: `/api/slots` confirmed_count vs. confirmed bookings scope
**What goes wrong:** The current `/api/slots/route.ts` (line 139) fetches bookings with `.neq("status", "cancelled")` — this blocks slots occupied by BOTH `confirmed` AND `rescheduled` bookings. The capacity check in `computeSlots` should count only `confirmed` bookings against `max_bookings_per_slot`, not `rescheduled` ones.
**Why it matters:** A rescheduled booking at a slot means the OLD slot is freed; the booking is kept in 'rescheduled' status for audit purposes but the slot SHOULD become available again (this is the cancel/reschedule contract). The current `.neq("status", "cancelled")` is OVER-blocking: it prevents booking a slot that has a 'rescheduled' row even though the slot is conceptually freed.
**How to avoid:** Change the bookings query in `/api/slots` to filter `status = 'confirmed'` only (not `neq('cancelled')`). This is both the correct semantic AND aligns with how the unique index works.
**Warning signs:** Slots with only `rescheduled` bookings appear unavailable in the API response.

### Pitfall 5: CAP-07 error code distinction requires fetching max_bookings_per_slot early
**What goes wrong:** To distinguish `SLOT_TAKEN` (capacity=1 exhausted) from `SLOT_CAPACITY_REACHED` (capacity>1 exhausted), the 409 handler needs to know what the capacity setting was for this event type. But this data must be fetched BEFORE the retry loop, not deduced from which error occurred.
**Why it happens:** After exhausting all `slot_index` retries, the only data available is the final `23505` error. The code must keep `maxBookingsPerSlot` in scope from the event-type query (step 5 of the existing route handler).
**How to avoid:** Add `max_bookings_per_slot` to the `event_types` SELECT at line ~143 of `route.ts`. After the retry loop fails, check `if (maxBookingsPerSlot === 1)` → `SLOT_TAKEN`, else → `SLOT_CAPACITY_REACHED`.

### Pitfall 6: CAP-09 confirmation modal — detecting "capacity decrease with future overbooked bookings"
**What goes wrong:** The event-type form Server Action needs to detect whether decreasing `max_bookings_per_slot` from N to M (M < N) would leave existing FUTURE confirmed bookings exceeding the new cap at some slot.
**Why it matters:** If 3 people are booked for a slot and the owner drops capacity to 1, the existing 3 bookings aren't cancelled automatically — but future availability would be wrong (slot appears fully booked at all 3 seats, but the cap is now 1).
**How to avoid:** Before saving a reduced capacity, run:
```sql
SELECT event_type_id, start_at, count(*) as cnt
FROM bookings
WHERE event_type_id = $1
  AND status = 'confirmed'
  AND start_at > now()
GROUP BY event_type_id, start_at
HAVING count(*) > $2  -- $2 = new capacity
LIMIT 1;
```
If this returns rows, the form action should return a warning rather than saving immediately, triggering the confirmation modal on the client.
**Warning signs:** Capacity decrease completes without checking for existing overbooked future slots.

---

## Code Examples

Verified patterns from official sources and local codebase:

### CAP-01: Prod Diagnostic Query — Check Index Existence
```sql
-- Verify bookings_no_double_book index is still live on prod:
SELECT indexname, indexdef, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'bookings'
  AND indexname IN ('bookings_no_double_book', 'bookings_capacity_slot_idx');
```

### CAP-01: Prod Diagnostic Query — Find Duplicate Confirmed Bookings
```sql
-- Check if any (event_type_id, start_at) pair has more than 1 confirmed booking:
SELECT event_type_id, start_at, count(*) AS duplicates,
       array_agg(id ORDER BY created_at) AS booking_ids
FROM bookings
WHERE status = 'confirmed'
GROUP BY event_type_id, start_at
HAVING count(*) > 1;
```

### Migration A — Add capacity columns to event_types
```sql
-- Source: ARCHITECTURE.md §B.1, adapted for two-migration strategy
ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS max_bookings_per_slot integer NOT NULL DEFAULT 1
    CHECK (max_bookings_per_slot >= 1);

ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS show_remaining_capacity boolean NOT NULL DEFAULT false;
```

### Migration B — slot_index column + new unique index (CONCURRENTLY, run outside BEGIN)
```sql
-- Source: PITFALLS.md P-B1 Pattern #1 + P-B2 prevention
-- Run as standalone SQL, NOT wrapped in BEGIN/COMMIT
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS slot_index smallint NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS bookings_capacity_slot_idx
  ON bookings(event_type_id, start_at, slot_index)
  WHERE status = 'confirmed';
```

### Migration B Part 2 — Drop old index (transactional, after CONCURRENTLY completes)
```sql
-- Verify new index is valid before dropping old one:
SELECT indisvalid FROM pg_index
WHERE indexrelid = 'bookings_capacity_slot_idx'::regclass;
-- Only run DROP if indisvalid=true

BEGIN;
  DROP INDEX IF EXISTS bookings_no_double_book;
COMMIT;
```

### `/api/slots` — capacity-aware slot exclusion (lib/slots.ts extension)
```typescript
// Source: derived from lib/slots.ts pattern + ARCHITECTURE.md §B.4

// In SlotInput type (lib/slots.types.ts), add:
//   maxBookingsPerSlot: number;  // from event_types.max_bookings_per_slot
//   showRemainingCapacity?: boolean;

// New helper (lib/slots.ts):
function slotConfirmedCount(slotStartUtc: Date, bookings: BookingRow[]): number {
  // bookings already filtered to status='confirmed' by the caller
  const slotMs = slotStartUtc.getTime();
  let n = 0;
  for (const b of bookings) {
    if (new Date(b.start_at).getTime() === slotMs) n++;
  }
  return n;
}

// In computeSlots() inner loop, replace the current slotConflictsWithBookings check:
// OLD: if (slotConflictsWithBookings(slotStartUtc, slotEndUtc, bookings)) continue;
// NEW:
const confirmedCount = slotConfirmedCount(slotStartUtc, bookings);
if (confirmedCount >= maxBookingsPerSlot) continue;

// Buffer check stays: slotConflictsWithBookings (for buffer exclusion) still applies
// independently of capacity. Both must pass for a slot to be available.

// If showRemainingCapacity=true, include remainingCapacity in the slot output:
// { start_at, end_at, remaining_capacity: maxBookingsPerSlot - confirmedCount }
```

### `/api/slots` — pass max_bookings_per_slot into engine
```typescript
// Source: app/api/slots/route.ts lines 88-90 (current event_types SELECT)
// Change:
//   .select("id, account_id, duration_minutes")
// To:
//   .select("id, account_id, duration_minutes, max_bookings_per_slot, show_remaining_capacity")
// And change bookings filter:
//   .neq("status", "cancelled")      // CURRENT — blocks rescheduled too
// To:
//   .eq("status", "confirmed")       // CORRECT — only confirmed bookings consume capacity
```

### Event-type form — capacity input (CAP-03)
```typescript
// Source: app/(shell)/app/event-types/_components/event-type-form.tsx
// Add to the form JSX (after duration_minutes input):
<div className="space-y-2">
  <Label htmlFor="max_bookings_per_slot">
    Max bookings per slot
  </Label>
  <Input
    id="max_bookings_per_slot"
    type="number"
    min={1}
    step={1}
    {...register("max_bookings_per_slot", { valueAsNumber: true })}
  />
  {errors.max_bookings_per_slot && (
    <p className="text-sm text-destructive">{errors.max_bookings_per_slot.message}</p>
  )}
  <p className="text-sm text-muted-foreground">
    Default 1 = exclusive booking (one person per time slot).
  </p>
</div>
```

### Event-type schema — capacity fields (Zod)
```typescript
// Source: app/(shell)/app/event-types/_lib/schema.ts
// Add to eventTypeSchema:
max_bookings_per_slot: z.coerce
  .number()
  .int("Capacity must be a whole number.")
  .min(1, "Capacity must be at least 1.")
  .max(50, "Capacity cannot exceed 50.")
  .default(1),
show_remaining_capacity: z.coerce.boolean().default(false),
```

---

## Test-Harness Verdict (CAP-06 Critical Finding)

**The current `tests/race-guard.test.ts` uses `adminClient()` from `tests/helpers/supabase.ts`.**

`adminClient()` creates a `@supabase/supabase-js` client (line 11-17 of `helpers/supabase.ts`). This client sends HTTP requests to the PostgREST API endpoint (`https://mogfnutxrrbtvnaupoun.supabase.co`). PostgREST itself connects to Postgres via Supavisor on port 6543 (transaction mode). HTTP-layer concurrent requests MAY be queued at Supavisor or PostgREST before reaching Postgres.

**Verdict: The existing `race-guard.test.ts` is at the supabase-js HTTP layer, NOT the pg-driver layer. It does NOT satisfy CAP-06.**

**Required for CAP-06:**
1. Add `postgres` as a dev dependency: `npm install --save-dev postgres`
2. Add `SUPABASE_DIRECT_URL` to `.env.local` (Supabase Dashboard → Project Settings → Database → Direct connection URL, port 5432)
3. Create `tests/helpers/pg-direct.ts` using `postgres(url, { max: 20 })`
4. Add a new `describe` block to `race-guard.test.ts` using the direct connection

The existing supabase-js test SHOULD be kept as a regression check (it verifies end-to-end behavior including the HTTP + PostgREST + Supavisor path). CAP-06 adds a SECOND test at the pure Postgres layer.

---

## Pooler-Mode Verdict

**Question:** Is `pg_advisory_xact_lock` safe in Supabase's transaction pooling mode (Supavisor)?

**Verdict: YES — `pg_advisory_xact_lock` is safe in Supavisor transaction mode.**

**Reasoning:**
- Supabase uses Supavisor (formerly PgBouncer) in transaction mode on port 6543 for application traffic.
- In transaction mode, a server connection is assigned to a client for the duration of ONE transaction. When the transaction ends, the connection is returned to the pool.
- `pg_advisory_xact_lock` holds its lock ONLY until the current transaction ends (commit or rollback). It is then automatically released. Since the lock lifetime is bounded to exactly one transaction, and transaction-mode pooling assigns exactly one server connection per transaction, the lock is always released before the connection is returned to the pool.
- This is in contrast to session-level `pg_advisory_lock`, which is listed as incompatible with transaction mode in the official PgBouncer feature docs (lock holds beyond the transaction lifetime, but the server connection is reassigned — another client gets the connection and may acquire the same lock).

**Sources:**
- PgBouncer official feature docs: session-level advisory locks listed as "NEVER" in transaction mode; transaction-scoped locks not listed as incompatible.
- JP Camara blog (pgbouncer-is-useful.html): "Advisory locks do have a transaction-based companion [...] you can use it as a replacement for certain scenarios [...] automatically unlocks on commit or rollback [...] works reliably with PgBouncer's transaction mode."
- Postgres official docs (functions-admin.html): `pg_advisory_xact_lock` "held until the current transaction ends; there is no provision for manual release."

**BUT: this research recommends Option B (slot_index), not Option A (advisory lock trigger), for separate reasons:**
- Option B (slot_index + unique index) provides a stronger atomicity guarantee (storage-level, not lock-level).
- Option A requires a SECURITY DEFINER function, adding code surface and audit complexity.
- Option B has zero hash-collision risk.
- Option B's migration is mechanically simpler and verifiable by inspecting `pg_indexes`.

The pooler verdict is documented here for completeness. If Option A were chosen, it would be safe. But Option B is chosen.

**Confidence: HIGH** — verified against PgBouncer official docs + JP Camara blog + Postgres official docs.

---

## State of the Art

| Old Approach | Current Approach (2025/2026) | Impact |
|---|---|---|
| Session-level advisory locks for capacity | Transaction-level `pg_advisory_xact_lock` for tx-pooling compat | Session locks no longer viable with Supavisor tx mode |
| Capacity in application-layer CAS pattern | DB-level unique constraint (slot_index approach) | Unique index is atomic; no MVCC snapshot races |
| `pg` (node-postgres) for direct Postgres queries | `postgres.js` (postgres) for tagged-template SQL | Supabase recommends postgres.js; cleaner API; same functionality |
| Single-capacity partial unique index (v1.0) | N-capacity slot_index partial unique index (v1.1) | Backward compatible: N=1 behaves identically to v1.0 |

**Note:** Supabase migrated from PgBouncer to Supavisor in 2023-2024. Both use the same transaction-mode semantics for advisory locks. The `pg_advisory_xact_lock` safety property applies to both.

---

## Open Questions

1. **CAP-01 root cause: is the index still present on prod?**
   - What we know: the migration `20260419120000_initial_schema.sql` created `bookings_no_double_book`. No subsequent migration has dropped it.
   - What's unclear: whether the Supabase remote tracking table (orphaned migration timestamps) caused any drift in which migrations were applied vs. what's recorded.
   - Recommendation: Run the Step 1 diagnostic query against prod FIRST, before any Phase 11 migration work.

2. **CAP-06 test: does the existing test race at the Postgres level or only at Supavisor?**
   - What we know: `adminClient()` uses supabase-js (HTTP). PostgREST uses Supavisor on port 6543.
   - What's unclear: whether Supavisor's internal queuing serializes the 10 concurrent requests or allows genuine concurrent Postgres transactions.
   - Recommendation: Add `SUPABASE_DIRECT_URL` and the postgres.js race test to conclusively answer this per CAP-06.

3. **slot_index backfill: does prod have any existing confirmed duplicates?**
   - What we know: P-B1 and PITFALLS.md flag the 2026-04-27 incident.
   - What's unclear: whether `bookings` currently has any rows violating the NEW index's uniqueness on `(event_type_id, start_at, slot_index=1) WHERE confirmed`.
   - Recommendation: Run Step 2 diagnostic query. If duplicates exist, resolve them (cancel one) before creating the new index.

---

## Sources

### Primary (HIGH confidence)
- `/tests/race-guard.test.ts` (read directly): uses supabase-js adminClient, NOT pg driver
- `/tests/helpers/supabase.ts` (read directly): `adminClient()` is `@supabase/supabase-js` HTTP client
- `/supabase/migrations/20260419120000_initial_schema.sql` (read directly): `bookings_no_double_book` partial unique index definition
- `/app/api/bookings/route.ts` (read directly): current 23505 → 409 SLOT_TAKEN handler; no slot_index
- `/app/api/slots/route.ts` (read directly): `.neq("status", "cancelled")` booking filter (not status-specific)
- `.planning/research/ARCHITECTURE.md` §B.2 (read directly): Option A advisory-lock trigger recommendation with full SQL skeleton
- `.planning/research/PITFALLS.md` §P-B1, §P-B2 (read directly): Option B slot_index recommendation + migration safety
- PgBouncer official feature docs (WebFetch): session advisory locks = NEVER in tx mode; transaction-level not listed
- JP Camara blog (WebFetch pgbouncer-is-useful.html): `pg_advisory_xact_lock` safe in tx mode, confirmed
- Postgres official docs (WebFetch functions-admin.html): `pg_advisory_xact_lock` releases at txn end
- Supabase connecting-to-postgres docs (WebFetch): Supavisor tx mode on port 6543; direct on port 5432

### Secondary (MEDIUM confidence)
- WebSearch: pg_advisory_xact_lock + Supavisor compatibility (multiple sources agree: xact lock is safe in tx mode)
- Supabase postgres.js docs (WebFetch): postgres.js is the recommended direct-query client
- `.planning/research/PITFALLS.md` §P-B2: two-migration forward-compatible rollout strategy

### Tertiary (LOW confidence)
- Hypothesis that the 2026-04-27 double-booking was caused by the rescheduled-booking slot reuse gap (unverified against prod data — requires CAP-01 diagnostic queries to confirm)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing (supabase-js) or official Supabase-recommended (postgres.js)
- Architecture (slot_index mechanism): HIGH — verified against actual migration code + PITFALLS.md + Postgres uniqueness semantics
- Pooler verdict: HIGH — verified against PgBouncer official docs + Postgres official docs + multiple blog sources
- Test-harness verdict: HIGH — read actual test file; client library identified definitively
- CAP-01 root-cause procedure: MEDIUM — diagnostic queries are correct, but actual root cause on prod is not confirmed until queries are run
- CAP-09 modal: HIGH — standard SQL pattern; implementation is straightforward

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable domain; Postgres/Supavisor/supabase-js APIs don't change frequently)
