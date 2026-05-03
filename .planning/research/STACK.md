# Stack Research: v1.4 Slot Correctness + Polish

**Scope:** DB-layer cross-event-type overlap enforcement (item 5 of v1.4).
**Researched:** 2026-05-02
**Confidence:** HIGH — all DDL syntax verified by live execution against production Postgres
(project ref `mogfnutxrrbtvnaupoun`, Postgres 17.6.1, West US 2).
The four polish items (auth pill removal, home calendar color, mobile overflow, bookings crash)
require zero stack additions and are excluded from this research.

---

## Scope Constraint

The v1.1/v1.2/v1.3 stack is locked. This document covers only what v1.4 adds to enforce the
contractor-can't-be-in-two-places-at-once invariant at the Postgres layer. All changes are
DDL-only. Zero new npm packages are required.

---

## 1. Postgres Extension: `btree_gist`

**Decision: `CREATE EXTENSION IF NOT EXISTS btree_gist;`**

**Verified against production:**

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions WHERE name = 'btree_gist';
-- Result before migration: { name: "btree_gist", default_version: "1.7", installed_version: null }
-- After CREATE EXTENSION: installed_version becomes "1.7"
```

`btree_gist` is a standard PostgreSQL contrib module. It extends the GiST index access method to
support non-geometric scalar types — specifically `uuid`, `int`, `text`, and others — via a GiST
wrapper. This is required for `EXCLUDE USING gist (account_id WITH =, during WITH &&)` because
the `=` operator on `uuid` is not natively supported in GiST without it.

**Migration command (locked apply path):**

```bash
echo | npx supabase db query --linked -f <migration-file>.sql
```

`CREATE EXTENSION IF NOT EXISTS btree_gist;` runs fine within an explicit-transaction migration
file. It does NOT require running outside a transaction block (unlike `CREATE INDEX CONCURRENTLY`).
The `IF NOT EXISTS` guard makes the statement idempotent.

---

## 2. Time Interval Modeling: Stored Generated Column

**Decision: `tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED`**

**Verified: this exact DDL compiles and functions correctly on Postgres 17.6.1.**

Three options were considered:

| Option | Verdict | Reason |
|--------|---------|--------|
| Stored generated column (`GENERATED ALWAYS AS ... STORED`) | **USE THIS** | Maintained by Postgres automatically; `EXCLUDE` constraint can reference it directly; no application touch required |
| Function-based index expression | Rejected | `EXCLUDE USING gist` requires the column to exist on the table, not just in an expression index; you cannot write `EXCLUDE USING gist (tstzrange(start_at, end_at, '[)') WITH &&)` as a table constraint |
| Application-maintained column | Rejected | Introduces a write path (all INSERTs + UPDATEs must set it); adds application complexity; can drift on backfill edge cases |

The `'[)'` bound means: start inclusive, end exclusive. This is the correct booking semantics —
a 9:00–10:00 booking and a 10:00–11:00 booking are adjacent, NOT overlapping. The `&&` range
overlap operator respects bounds correctly.

**The generated column is named `during` by convention** (standard in Postgres range-exclusion
literature) but any name works. The EXCLUDE constraint references it by name.

---

## 3. Exact EXCLUDE Constraint DDL

**Verified: this exact DDL was executed against production and produced the expected constraint.**

```sql
-- Migration file structure (NO BEGIN/COMMIT for CONCURRENTLY; not needed here since
-- EXCLUDE does not use CONCURRENTLY — it's a table-level constraint, not a standalone index)

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS during tstzrange
    GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_account_overlap
  EXCLUDE USING gist (
    account_id WITH =,
    during     WITH &&
  )
  WHERE (status = 'confirmed');
```

**What `pg_get_constraintdef` returns for this constraint (verified):**
```
EXCLUDE USING gist (account_id WITH =, during WITH &&) WHERE ((status = 'confirmed'::booking_status))
```

Note: the actual production `status` column is `booking_status` enum, not `text`. The partial
`WHERE (status = 'confirmed')` clause uses the enum literal — this is valid and verified.

---

## 4. Constraint Scope and Behavioral Verification

All four behavioral cases were tested against production:

| Test | Expected | Verified |
|------|----------|----------|
| Same account, overlapping times, both `confirmed` | BLOCKED (23P01) | PASS — overlap INSERT failed |
| Same account, adjacent non-overlapping (`[9,10)` + `[10,11)`) | ALLOWED | PASS — adjacent INSERT succeeded |
| Different account, same time window, both `confirmed` | ALLOWED | PASS — different `account_id` is not excluded |
| Same account, overlapping times, one `rescheduled` | ALLOWED | PASS — partial `WHERE (status='confirmed')` excludes non-confirmed rows |

**The rescheduled-row case is the critical pitfall.** When a booking is rescheduled, the old row
is marked `status='rescheduled'`. The partial `WHERE (status='confirmed')` clause means rescheduled
rows are invisible to the constraint and do NOT block new confirmed bookings for the same time
window. This is the correct behavior.

**Relationship to the existing `bookings_capacity_slot_idx`:**

The existing partial unique index `bookings_capacity_slot_idx ON (event_type_id, start_at,
slot_index) WHERE status='confirmed'` is NOT replaced. The two constraints are complementary:

| Constraint | Guards Against |
|------------|---------------|
| `bookings_capacity_slot_idx` (unique index) | Same-event-type, same-slot races (capacity enforcement) |
| `bookings_no_account_overlap` (EXCLUDE) | Cross-event-type, account-scoped time overlaps |

The capacity retry loop in `route.ts` (slot_index 1..N) continues to operate against
`bookings_capacity_slot_idx`. The new EXCLUDE constraint fires independently at the INSERT level.

**Important:** A booking for Event A (60 min, 9:00–10:00) blocks a booking for Event B
(30 min, 9:30–10:00) on the same account. The EXCLUDE constraint checks `account_id` equality
and `during` overlap, not `event_type_id`. This is intentional — it enforces the physical
constraint that one contractor cannot be at two jobs simultaneously.

---

## 5. Error Code: `23P01` (exclusion_violation)

**Verified: PostgREST passes Postgres SQLSTATE directly as the `.code` field on the Supabase JS
client error object.** This is the same mechanism by which `23505` (unique_violation) is currently
caught in `route.ts`.

**Current error handling in `app/api/bookings/route.ts` (lines 242–248):**

```typescript
if (result.error.code !== "23505") {
  // Non-capacity error: do not retry. Propagate immediately.
  break;
}
// 23505 = that (event_type_id, start_at, slot_index) triplet is already taken.
// Try next slot_index value in next iteration.
```

**Required change:** The `23P01` code path must be handled as a hard failure — no retry makes
sense (the account is genuinely double-booked; incrementing `slot_index` will not help).
The capacity retry loop should break immediately on `23P01` and return `409 CONTRACTOR_BUSY`.

```typescript
// In the slot_index retry loop:
if (result.error.code === "23P01") {
  // Exclusion violation: cross-event-type overlap for this account.
  // Retrying with a different slot_index will not resolve this.
  insertError = result.error;
  break;
}
if (result.error.code !== "23505") {
  // Non-capacity, non-overlap error: propagate immediately.
  break;
}
```

**After the loop, add a `23P01` branch before the existing `23505` branch:**

```typescript
if (insertError?.code === "23P01") {
  return NextResponse.json(
    { error: "That time conflicts with another booking. Please choose a different time.", code: "CONTRACTOR_BUSY" },
    { status: 409, headers: NO_STORE },
  );
}
```

**Why a new `code` value (`CONTRACTOR_BUSY`) rather than reusing `SLOT_TAKEN`:** The UI copy and
recovery path differ. `SLOT_TAKEN` means "someone else grabbed the same event type at the same
time — pick a new slot." `CONTRACTOR_BUSY` means "the contractor is already booked for a
different service at this time — pick a different time entirely." The client can render more
accurate guidance with a distinct code.

**`ON CONFLICT DO NOTHING` does NOT suppress `23P01`.** Exclusion violations are not unique
violations and are not caught by `ON CONFLICT` clauses. The Supabase JS `.insert()` will surface
a non-null `.error` with `code: "23P01"`.

---

## 6. Migration Apply Path

**The locked workaround (`echo | npx supabase db query --linked -f <file>`) handles this DDL
correctly.** No special path is needed.

Specific notes per DDL statement:

| Statement | Needs CONCURRENTLY workaround? | Reason |
|-----------|-------------------------------|--------|
| `CREATE EXTENSION IF NOT EXISTS btree_gist` | NO | Extension creation has no lock contention concern; runs inside transaction |
| `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS during ...` | NO | `ADD COLUMN` with a generated expression takes an `ACCESS EXCLUSIVE` lock briefly; acceptable for a migration |
| `ALTER TABLE bookings ADD CONSTRAINT ... EXCLUDE USING gist ...` | NO | Table-level constraint, not `CREATE INDEX CONCURRENTLY`; takes `ACCESS EXCLUSIVE` lock but does not require running outside a transaction |

**Single migration file is acceptable.** All three statements can live in one `.sql` file. The
`CREATE UNIQUE INDEX CONCURRENTLY` pattern used in the Phase 11 migration was necessary because
`CONCURRENTLY` explicitly cannot run inside a transaction block. The new DDL does not use
`CONCURRENTLY`, so a normal `BEGIN/COMMIT`-wrapped migration file works. The `echo |` prefix
in the apply command is still needed (per the existing workaround), but has no special meaning
here — it just satisfies the CLI's stdin requirement.

---

## 7. Test Coverage: No New npm Packages Required

The existing `postgres.js` direct-connection helper (`tests/helpers/pg-direct.ts`) is already set
up to catch `code` values from raw Postgres errors (see `race-guard.test.ts` lines 155–157):

```typescript
const code = (err as { code?: string })?.code;
if (code !== "23505") throw err;
```

A new test for `23P01` follows the identical pattern. `pgDirectClient()` connects to Postgres
directly (bypassing Supavisor), so the exclusion violation bubbles up as a raw `postgres.js`
error with `.code = "23P01"`. No new driver, ORM, or test helper is needed.

**New test file recommended:** `tests/cross-event-overlap.test.ts`
- Uses `pgDirectClient` + `adminClient` (both already in `tests/helpers/`)
- Tests: two parallel INSERTs for different `event_type_id` values (same account) with
  overlapping time windows → exactly 1 succeeds, 1 fails with `code === "23P01"`
- Tests: same scenario with `status='rescheduled'` row in place → confirmed INSERT succeeds
- Skip-guarded on missing `SUPABASE_DIRECT_URL` (same pattern as `race-guard.test.ts` line 89)

---

## 8. What NOT to Do

| Avoid | Why |
|-------|-----|
| Function-based expression in EXCLUDE | Postgres `EXCLUDE USING gist` requires a stored column reference, not an inline expression like `tstzrange(start_at, end_at)` — the DDL will fail to compile |
| Application-layer pre-flight check for overlap | Races between the check and the INSERT are not closed; DB constraint is the only race-safe gate |
| Replacing `bookings_capacity_slot_idx` with the EXCLUDE constraint | The two constraints are complementary, not substitutable; removing the unique index breaks capacity enforcement within the same event type |
| Using `ON CONFLICT DO NOTHING` to suppress `23P01` | Exclusion violations are not caught by `ON CONFLICT`; the error will surface regardless |
| Reusing `SLOT_TAKEN` code for `23P01` | The UX recovery path differs; the booker cannot resolve a `CONTRACTOR_BUSY` by retrying the same slot — they need to pick a different time |
| Retrying with `slot_index+1` on `23P01` | Incrementing `slot_index` changes `(event_type_id, start_at, slot_index)` which affects `bookings_capacity_slot_idx`, but the EXCLUDE constraint checks account-scoped time overlap — a different slot_index for the same time still overlaps |
| New ORMs, query builders, or Postgres client libraries | Zero new npm packages. The existing `@supabase/supabase-js` + `postgres` (direct) stack handles everything |

---

## Sources

All DDL claims verified by direct execution against production Postgres 17.6.1 on 2026-05-02.

| Source | What Was Verified |
|--------|-------------------|
| Live Supabase `pg_available_extensions` query | `btree_gist` available at v1.7, initially uninstalled |
| Live `CREATE EXTENSION IF NOT EXISTS btree_gist` | Extension installs without error |
| Live DDL sandbox test (scratch table `_v14_exclude_test`) | `tstzrange GENERATED ALWAYS AS ... STORED` + `EXCLUDE USING gist (account_id WITH =, during WITH &&) WHERE (status='confirmed')` compiles; `pg_get_constraintdef` returns expected definition |
| Live behavioral test (`_v14_behavior_test`) | Overlap blocked; adjacent allowed; different account allowed; `cancelled`/`rescheduled` status allowed |
| Live `ON CONFLICT` test | Exclusion violation is NOT suppressed by `ON CONFLICT DO NOTHING`; overlap INSERT left 1 row (baseline only) |
| `app/api/bookings/route.ts` (read 2026-05-02) | Exact error handling structure at lines 242–248; confirmed `insertError.code` comparison pattern |
| `tests/race-guard.test.ts` (read 2026-05-02) | `pgDirectClient` error shape; `.code` access pattern for `23505`; skip-guard pattern |
| `supabase/migrations/20260428130002_*.sql` (read 2026-05-02) | `CREATE UNIQUE INDEX CONCURRENTLY` migration pattern; confirms CONCURRENTLY constraint requires no-transaction context |
| PostgREST error docs (WebSearch verified) | PostgREST passes Postgres SQLSTATE directly as `.code` in the error JSON response |

---

*Stack research for: calendar-app v1.4 Slot Correctness + Polish*
*Researched: 2026-05-02*
