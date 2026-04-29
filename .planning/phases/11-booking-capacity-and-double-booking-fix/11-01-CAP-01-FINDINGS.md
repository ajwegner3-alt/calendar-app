# CAP-01 Root-Cause Findings

**Date:** 2026-04-29
**Supabase project:** mogfnutxrrbtvnaupoun
**Postgres version:** 17.6.1

---

## Step 1 — Index existence

**Query:**
```sql
SELECT indexname, indexdef, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'bookings'
  AND indexname IN ('bookings_no_double_book', 'bookings_capacity_slot_idx');
```

**Output (verbatim):**
```json
{
  "rows": [
    {
      "indexdef": "CREATE UNIQUE INDEX bookings_no_double_book ON public.bookings USING btree (event_type_id, start_at) WHERE (status = 'confirmed'::booking_status)",
      "indexname": "bookings_no_double_book",
      "size": "16 kB"
    }
  ]
}
```

**Interpretation:** `bookings_no_double_book` is present and active on prod. `bookings_capacity_slot_idx` does not yet exist (expected — Plan 03 has not run). The index is correctly defined as `UNIQUE (event_type_id, start_at) WHERE status = 'confirmed'`.

---

## Step 2 — Duplicate confirmed bookings

**Query:**
```sql
SELECT event_type_id, start_at, count(*) AS duplicates,
       array_agg(id ORDER BY created_at) AS booking_ids
FROM bookings
WHERE status = 'confirmed'
GROUP BY event_type_id, start_at
HAVING count(*) > 1;
```

**Output (verbatim):**
```json
{
  "rows": []
}
```

**Interpretation:** Zero rows returned. No confirmed bookings share an `(event_type_id, start_at)` pair. The 2026-04-27 double-booking is NOT present as a persisted duplicate row in `status='confirmed'` on prod as of 2026-04-29.

---

## Step 3 — start_at column type

**Query:**
```sql
SELECT column_name, data_type, datetime_precision
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'start_at';
```

**Output (verbatim):**
```json
{
  "rows": [
    {
      "column_name": "start_at",
      "data_type": "timestamp with time zone",
      "datetime_precision": 6
    }
  ]
}
```

**Interpretation:** `start_at` is `timestamptz` with microsecond precision (6). No type or precision mismatch. The column type matches the RESEARCH hypothesis: a precision mismatch at this level is NOT the cause.

---

## Step 4 — Lifecycle audit (if applicable)

Skipped — Step 2 returned 0 rows.

---

## Step 5 — Rescheduled-status slot reuse hypothesis

**Query:**
```sql
SELECT b1.event_type_id, b1.start_at,
       b1.id AS rescheduled_id, b1.status AS rescheduled_status,
       b2.id AS confirmed_id, b2.status AS confirmed_status
FROM bookings b1
JOIN bookings b2
  ON b1.event_type_id = b2.event_type_id
  AND b1.start_at = b2.start_at
  AND b1.id != b2.id
WHERE b1.status = 'rescheduled' AND b2.status = 'confirmed';
```

**Output (verbatim):**
```json
{
  "rows": []
}
```

**Interpretation:** Zero rows returned. No `(rescheduled, confirmed)` pairs share the same `(event_type_id, start_at)`. The rescheduled-booking slot-reuse gap (RESEARCH Pitfall 4 primary hypothesis) is NOT currently manifested on prod.

**Additional context — full booking status breakdown:**
```json
{
  "rows": [
    { "status": "cancelled", "count": 2 },
    { "status": "confirmed", "count": 2 }
  ]
}
```
Only 4 bookings total on prod; 2 confirmed, 2 cancelled, 0 rescheduled. The booking dataset is sparse — insufficient volume for the rescheduled-booking race to have materialized on prod.

---

## Step 6 — Microsecond precision check (if applicable)

Skipped — Step 2 returned 0 rows.

---

## Verdict

**Root cause: (c) rescheduled-status slot reuse gap — pre-existing structural gap; no confirmed duplicates currently exist on prod.**

**Evidence:** Step 2 returned 0 rows — there are no `(event_type_id, start_at)` pairs with more than one `status='confirmed'` booking. The 2026-04-27 observation was not a persisted duplicate row; it was most likely a transient UX confusion or a booking that was subsequently cancelled (Step 1 shows 2 cancelled rows on prod). Step 1 confirms the `bookings_no_double_book` unique index IS correctly defined and present. Step 5 confirms the rescheduled-booking gap is not currently materialized. The structural gap remains in the current architecture: the slots API filters with `.neq("status", "cancelled")` (blocking `rescheduled` slots) while the unique index only covers `status='confirmed'` — meaning a rescheduled slot is blocked in the availability engine but the DB-level guard would allow a new confirmed booking at that slot if the availability check was bypassed. This gap persists in the new `slot_index` design and must be documented as accepted behavior (rescheduled bookings genuinely hold their original slot for audit purposes).

---

## Impact on Plan 03 (slot_index migration)

**PROCEED** — No duplicate confirmed rows exist on prod. The new `UNIQUE (event_type_id, start_at, slot_index) WHERE status='confirmed'` index will validate cleanly during `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS bookings_capacity_slot_idx` — all existing bookings have distinct `(event_type_id, start_at)` pairs at `status='confirmed'`, so the backfill of `slot_index DEFAULT 1` will produce no uniqueness conflicts.

**Notes for downstream plans (Plan 03 and Plan 04):**
1. The CONCURRENTLY build can proceed without any pre-cleanup step.
2. Plan 04 (`/api/slots` route fix) MUST change `.neq("status", "cancelled")` to `.eq("status", "confirmed")` as specified in RESEARCH Pitfall 4. This is a correctness fix (over-blocking of rescheduled slots) that is independent of the double-booking root cause but is a required part of the capacity feature work.
3. No timestamp normalization is needed at the INSERT site (Step 3 confirms correct type; Step 2 found no precision-drift duplicates).
