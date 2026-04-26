---
phase: 06-cancel-and-reschedule-lifecycle
plan: 03
subsystem: api
tags: [supabase, typescript, cancel, reschedule, tokens, cas-guard, booking-events, audit-log]

# Dependency graph
requires:
  - phase: 06-02
    provides: sendCancelEmails + sendRescheduleEmails email orchestrators; buildIcsBuffer METHOD:CANCEL/REQUEST extension
  - phase: 05-public-booking-flow
    provides: bookings table schema, cancel_token_hash/reschedule_token_hash columns, bookings_no_double_book partial index, tokens.ts generateBookingTokens/hashToken helpers
provides:
  - cancelBooking(args): CancelBookingResult — shared atomic cancel for public token route (06-04) + owner Server Action (06-05)
  - rescheduleBooking(args): RescheduleBookingResult — shared atomic reschedule for public token route (06-04)
affects:
  - 06-04-public-token-routes
  - 06-05-owner-bookings-detail-and-cancel

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CAS-guarded atomic UPDATE (single UPDATE with WHERE clause = serialization point, no transactions)
    - Dead-hash token invalidation (cancel: hashToken(randomUUID()) for both hashes; NOT NULL columns can't be cleared)
    - Double CAS guard for reschedule (status + reschedule_token_hash in WHERE clause)
    - Array.isArray normalization for supabase-js join shape variance
    - Fire-and-forget audit pattern (void + .then({error}) for booking_events inserts)

key-files:
  created:
    - lib/bookings/cancel.ts
    - lib/bookings/reschedule.ts
  modified: []

key-decisions:
  - "cancelBooking trusts bookingId arg — caller (owner Server Action) must verify ownership via RLS before invoking"
  - "Dead-hash invalidation: hashToken(crypto.randomUUID()) replaces both token columns after cancel (NOT NULL constraint prevents null)"
  - "Reschedule keeps status='confirmed' — 'rescheduled' enum value is for booking_events.event_type only, not bookings.status"
  - "Double CAS guard on reschedule: both status='confirmed' AND reschedule_token_hash=oldHash prevent concurrent same-token success"
  - "Pre-fetch booking+event_types+accounts in one !inner join round-trip before UPDATE; snapshot used for email after UPDATE succeeds"
  - "eslint circular structure error is pre-existing tooling bug (FlatCompat + next/core-web-vitals in ESLint 9); npm run build TypeScript passes clean"

patterns-established:
  - "Pattern: Single CAS-guarded UPDATE is the serialization point — no transactions needed, no TOCTOU"
  - "Pattern: Pre-fetch snapshot before UPDATE, use snapshot for fire-and-forget emails after UPDATE (avoids re-fetch on already-mutated row)"
  - "Pattern: Fire-and-forget void + .then({error}=>log) for all side effects that must not block or roll back the primary state change"

# Metrics
duration: 4min
completed: 2026-04-26
---

# Phase 6 Plan 03: Cancel and Reschedule Shared Functions Summary

**Atomic cancel + reschedule business-logic modules using CAS-guarded single UPDATEs, dead-hash token invalidation, and double CAS guard — shared by both public token routes (06-04) and owner Server Action (06-05)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-26T01:49:29Z
- **Completed:** 2026-04-26T01:53:46Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- `cancelBooking(args)`: single atomic UPDATE with dead-hash invalidation (hashToken(randomUUID()) for both NOT NULL token columns), CAS WHERE (status='confirmed' AND start_at > now()), PGRST116 → not_active, fire-and-forget sendCancelEmails + booking_events audit row
- `rescheduleBooking(args)`: single atomic UPDATE with double CAS guard (status + reschedule_token_hash + start_at > now()), fresh token rotation via generateBookingTokens(), catches 23505 → slot_taken (RESEARCH Pitfall 5: partial unique index fires on UPDATE), PGRST116 → not_active, pre-flight bad_slot invariants, fire-and-forget sendRescheduleEmails with OLD start/end + fresh raw tokens + booking_events audit row
- Both files: `import "server-only"` line 1, createAdminClient() service-role, Array.isArray normalization for supabase-js join shape variance, caller-owns-auth pattern

## Function Contracts

### cancelBooking

```typescript
// Input
interface CancelBookingArgs {
  bookingId: string;           // UUID; caller verifies auth before passing
  actor: "booker" | "owner";   // controls email tone + audit actor field
  reason?: string;             // surfaced in OPPOSITE party's email; stored in audit
  appUrl: string;              // for "Book again" CTA in booker email
  ip?: string | null;          // for audit row forensics
}

// Output (discriminated union)
type CancelBookingResult =
  | { ok: true; booking: { id, account_id, start_at, end_at, booker_name, booker_email, booker_timezone } }
  | { ok: false; reason: "not_active" | "db_error"; error?: string }
```

Failure semantics:
- `not_active`: booking already cancelled OR start_at already past (CAS WHERE returned 0 rows / PGRST116) OR booking not found
- `db_error`: unexpected Postgres error (logged server-side)

### rescheduleBooking

```typescript
// Input
interface RescheduleBookingArgs {
  bookingId: string;           // UUID; caller resolved via reschedule_token_hash lookup
  oldRescheduleHash: string;   // current hash for double CAS guard (caller already has it from token lookup)
  newStartAt: string;          // ISO UTC new slot start
  newEndAt: string;            // ISO UTC new slot end
  appUrl: string;              // for cancel/reschedule links in new email
  ip?: string | null;
}

// Output (discriminated union)
type RescheduleBookingResult =
  | { ok: true; booking: { id, account_id, start_at, end_at, booker_name, booker_email, booker_timezone } }
  | { ok: false; reason: "not_active" | "slot_taken" | "bad_slot" | "db_error"; error?: string }
```

Failure semantics:
- `bad_slot`: newStartAt in past, newEndAt <= newStartAt, or invalid ISO format (pre-flight, before any DB call)
- `not_active`: CAS failed — token already rotated, booking cancelled, or start_at passed (PGRST116)
- `slot_taken`: bookings_no_double_book partial unique index violation (Postgres 23505) — target slot taken in race window
- `db_error`: unexpected Postgres error

## Atomic UPDATE Patterns

### Cancel (RESEARCH §Pattern 2)

```sql
UPDATE bookings
SET status='cancelled',
    cancelled_at=now(),
    cancelled_by=$actor,
    cancel_token_hash=$deadHash1,       -- hashToken(randomUUID())
    reschedule_token_hash=$deadHash2    -- hashToken(randomUUID())
WHERE id=$bookingId
  AND status='confirmed'
  AND start_at > now()
RETURNING id
```

Dead-hash rationale (RESEARCH Pitfall 4): `cancel_token_hash` and `reschedule_token_hash` are `TEXT NOT NULL`. Setting to NULL raises a Postgres NOT NULL violation. A SHA-256 hash of a fresh `crypto.randomUUID()` is unreachable from any email and functionally invalidates both tokens permanently.

### Reschedule (RESEARCH §Pattern 3)

```sql
UPDATE bookings
SET start_at=$newStartAt,
    end_at=$newEndAt,
    cancel_token_hash=$freshHashCancel,
    reschedule_token_hash=$freshHashReschedule
    -- status STAYS 'confirmed'
WHERE id=$bookingId
  AND status='confirmed'
  AND reschedule_token_hash=$oldRescheduleHash   -- double CAS (RESEARCH Pitfall 6)
  AND start_at > now()
RETURNING id, start_at, end_at
```

Status invariant: `bookings.status` stays `'confirmed'` after reschedule so the new (rotated) tokens are valid for future cancel/reschedule operations. The `'rescheduled'` value in the `booking_event_kind` enum is ONLY used in `booking_events.event_type` — it marks the audit event, not the booking status.

## Task Commits

1. **Task 1: lib/bookings/cancel.ts** — `47a8b13` (feat)
2. **Task 2: lib/bookings/reschedule.ts** — `13359d3` (feat)

## Files Created

- `lib/bookings/cancel.ts` — Shared atomic cancel function: dead-hash invalidation, CAS guard, PGRST116→not_active, fire-and-forget sendCancelEmails + booking_events audit
- `lib/bookings/reschedule.ts` — Shared atomic reschedule function: double CAS guard, 23505→slot_taken, token rotation, pre-flight invariants, fire-and-forget sendRescheduleEmails + booking_events audit

## Decisions Made

- **cancelBooking trusts bookingId** — owner Server Action (06-05) must verify booking ownership via RLS-scoped client BEFORE calling this; cancelBooking itself does no auth check.
- **Dead-hash invalidation strategy** — `hashToken(crypto.randomUUID())` for both token columns on cancel. The hash of a random UUID that was never stored anywhere is unreachable from any email link, permanently invalidating both tokens without violating NOT NULL.
- **Status stays 'confirmed' after reschedule** — the `'rescheduled'` booking_event_kind enum value is for the audit row only. Keeping status 'confirmed' ensures new tokens are valid for subsequent cancel/reschedule operations.
- **Double CAS guard on reschedule** — `eq("reschedule_token_hash", oldRescheduleHash)` in the UPDATE WHERE prevents two concurrent requests with the same token from both succeeding. Without it, the second succeeds with tokens the second requester doesn't know.
- **Pre-fetch snapshot before UPDATE** — booking + event_types!inner + accounts!inner joined in one round-trip before the UPDATE. After the UPDATE succeeds (tokens are now dead/rotated), the pre-fetch snapshot is used for email construction — avoids re-fetching a row whose tokens have been invalidated.
- **No hashToken import in reschedule.ts** — only `generateBookingTokens()` is called (which returns pre-hashed values internally). `hashToken` is not directly used, so it is not imported (avoids unused-import lint flag).

## Deviations from Plan

None — plan executed exactly as written. No unexpected issues or unplanned work.

## Issues Encountered

**Pre-existing ESLint tooling failure:** `npm run lint` exits non-zero with "Converting circular structure to JSON" error inside `@eslint/eslintrc` when validating `next/core-web-vitals` config (FlatCompat + ESLint 9 incompatibility). Confirmed pre-existing by verifying the same failure occurs on the unmodified codebase (prior commit). `npm run build` (TypeScript compilation + Next.js build) passes cleanly for all new files.

## Forward Locks for Plan 06-04 (Public Token Routes)

```
POST /api/cancel:
  1. Rate-limit via lib/rate-limit.ts (LIFE-07)
  2. Extract rawToken from URL/body → hashToken(rawToken) → hash
  3. Lookup: supabase.from("bookings").select(...).eq("cancel_token_hash", hash).maybeSingle()
  4. If !booking → respond 410 (no-longer-active page redirect)
  5. cancelBooking({ bookingId: booking.id, actor: "booker", reason, appUrl, ip })
  6. Switch on result: ok → redirect to confirmation; not_active → 410; db_error → 500

POST /api/reschedule:
  1. Rate-limit via lib/rate-limit.ts
  2. Extract rawToken from URL/body → hashToken(rawToken) → hash (= oldRescheduleHash)
  3. Lookup: supabase.from("bookings").select(...).eq("reschedule_token_hash", hash).maybeSingle()
  4. If !booking → 410
  5. rescheduleBooking({ bookingId: booking.id, oldRescheduleHash: hash, newStartAt, newEndAt, appUrl, ip })
  6. Switch on result: ok → redirect; not_active → 410; slot_taken → 409; bad_slot → 400; db_error → 500
```

## Forward Locks for Plan 06-05 (Owner Cancel Server Action)

```
Server Action cancelBookingAction(bookingId, reason):
  1. getServerSession() → verify logged-in owner
  2. RLS-scoped client: verify booking.account_id === session.account_id (ownership check)
  3. cancelBooking({ bookingId, actor: "owner", reason, appUrl: process.env.NEXT_PUBLIC_APP_URL, ip: null })
  4. Switch on result: ok → revalidatePath + return; not_active → return { error: "..." }; db_error → throw
```

## Next Phase Readiness

Plan 06-04 (public token routes) can be built immediately:
- `cancelBooking` and `rescheduleBooking` are complete with correct discriminated-union return types
- Token lookup pattern: hash URL token → query by hash → pass bookingId + oldRescheduleHash to function
- Rate limiter (lib/rate-limit.ts) already exists from Plan 06-01
- All error reason codes map to defined HTTP responses (410/409/400/500)

Plan 06-05 (owner Server Action) can be built in parallel:
- `cancelBooking` with `actor: "owner"` is the only call needed
- Ownership verification pattern via RLS-scoped client is the caller's responsibility (documented above)

---
*Phase: 06-cancel-and-reschedule-lifecycle*
*Completed: 2026-04-26*
