# Feature Landscape: v1.4 Slot Correctness + Polish

**Domain:** Solo-contractor Calendly-style booking tool
**Researched:** 2026-05-02
**Confidence:** HIGH — findings derived entirely from direct inspection of the existing codebase
(slots.ts, route.ts, bookings route, DB migrations) plus first-principles reasoning about
the single-host, single-slot-at-a-time invariant. No speculative industry survey needed —
the correct behavior is already implied by what the DISPLAY layer does correctly.

---

## The Core Invariant (Non-Negotiable)

**One contractor = one slot at a time, across ALL event types.**

The display layer already enforces this. `route.ts:138` queries `bookings WHERE account_id = ? AND status = 'confirmed'` — completely event-type-agnostic. `slotConflictsWithBookings` in `lib/slots.ts:203-219` then applies buffer-extended overlap math against that full account-wide set.

The gap is at INSERT: `bookings_capacity_slot_idx` is scoped to `(event_type_id, start_at, slot_index)`. A concurrent or hand-crafted POST to `/api/bookings` for a DIFFERENT event type at the same instant bypasses this index entirely and succeeds. The DB has no account-scoped constraint preventing it.

---

## Expected User-Visible Behaviors (Confirming Andrew's Mental Model)

### Busy-Time Overlap (Q1)

A 60-min booking exists at 09:00–10:00.

| Slot | Expected result | Why |
|------|----------------|-----|
| 09:00 on ANY event type | Unavailable | Exact overlap with existing booking |
| 09:30 on a 30-min event type | Unavailable | Slot 09:30–10:00 overlaps [09:00, 10:00) |
| 10:00 on ANY event type | Available | No overlap after previous booking ends |

This matches `slotConflictsWithBookings` logic exactly. The display layer is already correct.
The INSERT layer must enforce the same rule at the DB level.

### Buffer Handling Across Event Types (Q2)

Buffer time in this codebase is an **account-level setting** (`accounts.buffer_minutes`), not per-event-type. This is the simplest correct design for a solo contractor. The buffer is applied symmetrically at display time: a candidate slot's buffered interval `[start - buffer, end + buffer)` must not overlap any existing booking's `[start, end)`.

The hypothesis that "buffer is stored in `end_at`" is INCORRECT for this codebase. `end_at` always stores the raw booking end (`start_at + duration_minutes`). Buffer is applied only at read-time in `slotConflictsWithBookings`. This is the right design — it avoids storing derived data, and a buffer setting change retroactively adjusts all future slot availability without a data migration.

Cross-event-type buffer behavior therefore works as follows:
- If account buffer = 15 min and a 60-min booking ends at 10:00, then the next available slot on ANY event type is 10:15, not 10:00.
- Buffer is symmetric: a slot starting at 08:50 would also be blocked (buffered start 08:35 < booking end 10:00, buffered end 09:50 > booking start 09:00 — overlap).

This is already correct in the display layer. v1.4 does not need to change buffer logic.

### Group Booking / N-Per-Slot Capacity (Q3)

N-per-slot capacity (`max_bookings_per_slot`) applies **per event type, per exact start_at**. The index `bookings_capacity_slot_idx ON (event_type_id, start_at, slot_index) WHERE status='confirmed'` enforces this.

Across event types, concurrent bookings at the same start_at are currently allowed at the DB layer — this is the bug v1.4 closes. Whether concurrent cross-event-type bookings "should" be allowed by design is NOT a nuanced question for a solo trade contractor: the contractor cannot be in two places. The invariant is always "one human, one slot."

The N-per-slot capacity feature (group bookings on the SAME event type — e.g., a 4-person crew training slot) is a LEGITIMATE, explicitly-built feature that v1.4 must preserve. The fix must close the cross-event-type gap WITHOUT breaking same-event-type multi-capacity bookings.

### Reschedule Slot-Freeing (Q4)

When a booking is rescheduled:
1. The OLD booking row gets `status='rescheduled'` (not deleted).
2. A NEW confirmed booking row is inserted at the new time.
3. The OLD slot is freed because `bookings_capacity_slot_idx` is `WHERE status='confirmed'` — rescheduled rows are excluded.
4. `route.ts:143` filters to `.eq("status", "confirmed")` — so the display layer also excludes rescheduled rows from its conflict set.

This is the v1.1 Pitfall 4 fix (code comment at `route.ts:139-143`) and it is correct. v1.4 must not regress this behavior.

**Reschedule edge cases:**

| Scenario | Expected behavior |
|----------|------------------|
| Reschedule within same event type | Old row → `rescheduled`, new confirmed row inserted. Race-safe via `bookings_capacity_slot_idx` on the new slot. |
| Reschedule across event types (currently impossible in UI but theoretically: booker has token for event A, reschedules to time that conflicts with event B booking) | New INSERT must check account-wide busy time. Currently not enforced at DB layer — same gap as v1.4 is closing. |
| Race: two bookers try to book the freed slot simultaneously after a reschedule | The account-scoped constraint (what v1.4 adds) handles this — first INSERT wins, second gets 409. |
| Self-reschedule: booker reschedules to the same time they currently have | Not prevented explicitly, but harmless — the old row is marked rescheduled, new row takes the slot. The token is rotated so the old link expires. |

### Date Override + Existing Bookings (Q5)

This is an admin-mental-model question, not a v1.4 build item. The expected behavior established by how the system already works:

- **Creating a `is_closed=true` date override does NOT cancel or auto-modify existing confirmed bookings.** The override only affects slot availability for NEW bookings (display layer reads overrides to block new slots on that day).
- Existing bookings on that day remain confirmed and will still trigger reminders and appear in the owner's booking list.
- The contractor is responsible for manually cancelling any bookings that conflict with a date override they create.

This is the correct design for a contractor tool: the override is a "stop taking new bookings" signal, not a "delete everything" signal. Auto-cancellation on override creation would be destructive and require compensating emails to bookers — out of scope for all v1.x.

---

## Table Stakes (v1.4 Must Deliver)

These are the behaviors v1.4 MUST deliver. Missing any of these means the contractor-busy-time invariant is still unenforceable.

| Feature | What It Is | Why Non-Negotiable |
|---------|-----------|-------------------|
| Account-scoped DB constraint at INSERT | A partial unique index or exclusion constraint on `(account_id, start_at)` scoped to `status='confirmed'`, OR a pre-INSERT check inside a Postgres function/transaction that verifies no overlapping confirmed booking exists for the account before committing | Without this, a race condition or stale-cache POST to a different event type can double-book the contractor |
| Cross-event-type conflict returns 409 | `/api/bookings` must return 409 SLOT_TAKEN when the new slot overlaps any confirmed booking on the account, regardless of `event_type_id` | The display layer already refuses to show the slot; the INSERT layer must refuse it too |
| N-per-slot capacity preserved | The fix must not break `bookings_capacity_slot_idx ON (event_type_id, start_at, slot_index)` — same-event-type group bookings must still work | Group bookings are a shipped, tested feature (v1.1) |
| Reschedule slot-freeing preserved | The `status='confirmed'` filter must remain the sole gate for both the display layer and the new INSERT constraint | v1.1 Pitfall 4 fix must not regress |
| Bookings page crash resolved (BOOK-01/02) | `/app/bookings` must not crash on load. Root cause is in the `queryBookings` query or downstream component null-handling — requires fix before v1.4 ships | Page is already deployed and crashing in production |

### Surgical Polish Items (Table Stakes — Low Effort)

These touch isolated components with no data-layer risk:

| Item | Component | What to Fix |
|------|-----------|------------|
| AUTH-21/22: Remove auth-pill branding element | `app/_components/header.tsx` `variant="auth"` path + any `PoweredByNsi` rendering on `/login` and `/signup` pages | The `variant="auth"` branch (line 83-86 in header.tsx) already omits SidebarTrigger and sidebar offset. Verify no stray `PoweredByNsi` component renders on auth pages — the current login page reads clean (no PoweredByNsi call visible) but signup must be checked. |
| OWNER-14: Calendar selected-day color | `app/(shell)/app/_components/home-calendar.tsx` DayButton | Selected-state uses `bg-gray-700` (line 76). The v1.3 visual contract specifies NSI blue (`bg-primary` = `#3B82F6`). One-line change. |
| OWNER-15: Mobile calendar overflow | Same `HomeCalendar` DayButton + parent Card layout at 375px | `min-w-[var(--cell-size,theme(spacing.9))]` on DayButton (line 72) sets each cell to at least 36px. A 7-column grid at 375px = 7 × 36 = 252px minimum; calendar padding likely pushes past viewport. Fix is to reduce `--cell-size` on mobile or let cells shrink (`min-w-0` with `w-full` percentage). Inspect and adjust. |

---

## Differentiators (Nice to Have — Defer Post-v1.4)

These would improve the product but are not required to close the invariant gap:

| Feature | Value | Why Defer |
|---------|-------|-----------|
| "Conflict detected" UX banner on booking page | Shows the booker a friendly "This time is no longer available" message inline without a full page reload when the 409 fires | The 409 already surfaces an error; a polished inline banner improves UX but the correctness is there without it |
| Per-event-type buffer asymmetry | Let event type A have 15-min buffer and event type B have 0-min buffer | Currently buffer is account-scoped. Per-event buffer requires storing buffer on the event type (columns exist: `buffer_before_minutes`, `buffer_after_minutes` in the initial schema, but `computeSlots` only reads `account.buffer_minutes`). Wiring this correctly across the cross-event-type constraint is non-trivial and has no user request yet |
| Admin "conflict warning" on date override creation | When creating a `is_closed` override on a day with existing bookings, show a count of affected bookings | Helpful UX but no functional gap — bookings remain valid, contractor just needs to manually handle them |
| Booking-level overlap visualization in admin calendar | Dot indicators that distinguish "this day has multiple event types booked" | Enhancement to home calendar; no correctness impact |

---

## Anti-Features (NOT Building in v1.4, With Rationale)

| Anti-Feature | Why Not |
|---|---|
| Multi-host scheduling (two contractors sharing one account) | The entire data model assumes one contractor per account (`account_id` is the scope for availability, bookings, and the busy-time invariant). Adding multi-host would require host-scoped availability tables, per-host conflict checking, and host assignment at booking time. This is Calendly Teams territory — out of scope for a solo-contractor tool by design. |
| Round-robin event types | Round-robin distributes bookings across multiple hosts. There is only one host per account. Feature is meaningless and architecturally contradicted by the single-host model. |
| Resource booking (room/equipment shared across event types) | Resources require a separate resource table, resource-availability join logic, and resource conflict checking independent of contractor availability. No trade contractor in the target market (plumbing, HVAC, roofing, electrical) is booking shared rooms — they are booking the contractor's time. |
| Cross-calendar working-hours conflict detection | This would require OAuth integration with Google/Outlook Calendar to detect external busy time. Significant scope, external dependency, and overkill for a solo contractor who controls their own availability settings manually. The availability rules + date overrides model is the right abstraction for this market. |
| Automatic booking cancellation on date override | Auto-cancellation is destructive: it would require sending cancellation emails, freeing slots, and potentially triggering refund workflows. For a solo contractor who creates a date override ("I'm closed Thursday"), existing bookings on Thursday need a human decision. Auto-cancel removes agency and creates support liability. |
| Per-event-type capacity across event types (e.g., "phone consult + in-person can overlap") | Allowing concurrent bookings across event types by design would require a per-event-type "requires exclusive slot" flag and corresponding constraint logic. The invariant for this product is always exclusive: the contractor cannot be in two places. If a future event type truly does not require the contractor's presence, that is a product redesign, not a configuration option. |

---

## Feature Dependencies for Roadmap

```
Account-scoped INSERT constraint (DB migration)
    └── blocks → cross-event-type 409 response in /api/bookings
    └── must preserve → bookings_capacity_slot_idx (N-per-slot, per event type)
    └── must preserve → status='confirmed' filter (reschedule slot-freeing)

BOOK-01/02 crash fix
    └── independent of DB constraint work
    └── must ship in same milestone (page is broken in production)

Surgical polish (AUTH-21/22, OWNER-14, OWNER-15)
    └── independent of each other and of DB constraint work
    └── zero data-layer risk — UI-only changes
```

---

## MVP Recommendation for v1.4

**Phase 1 — DB constraint (highest risk, do first):**
Add account-scoped busy-time enforcement at the INSERT layer. The constraint must:
1. Block any new confirmed booking whose `[start_at, end_at)` interval overlaps any existing confirmed booking with the same `account_id`, regardless of `event_type_id`.
2. Coexist with `bookings_capacity_slot_idx` (event-type-scoped, slot-index-based).
3. Use `status='confirmed'` filter consistently.

**Phase 2 — Bookings page crash (BOOK-01/02):**
Fix `/app/bookings` before shipping. If Phase 1 is the constraint work, Phase 2 should be a fast-follow or parallel track.

**Phase 3 — Surgical polish (AUTH-21/22, OWNER-14, OWNER-15):**
Three isolated UI fixes. Bundle together as a single phase since they share no dependencies.

**Defer to post-v1.4:**
Per-event-type buffer, conflict UX banner, admin override warning.

---

*Researched: 2026-05-02*
*Confidence: HIGH — all behavioral claims derived from direct codebase inspection*
*Codebase refs: lib/slots.ts:203-219, app/api/slots/route.ts:138-143, app/api/bookings/route.ts:188-249,*
*supabase/migrations/20260428130002_phase11_slot_index_and_concurrent_index.sql,*
*supabase/migrations/20260419120000_initial_schema.sql (bookings table + indexes)*
