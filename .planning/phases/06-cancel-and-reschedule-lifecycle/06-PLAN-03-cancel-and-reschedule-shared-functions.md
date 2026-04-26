---
phase: 06-cancel-and-reschedule-lifecycle
plan: 03
type: execute
wave: 3
depends_on: ["06-02"]
files_modified:
  - lib/bookings/cancel.ts
  - lib/bookings/reschedule.ts
autonomous: true

must_haves:
  truths:
    - "lib/bookings/cancel.ts exports cancelBooking(args) — single shared function called by BOTH the public token route (Plan 06-04) AND the owner Server Action (Plan 06-05). One code path, one source of truth."
    - "cancelBooking uses createAdminClient() — same service-role pattern as /api/bookings (Phase 5). Owner-side caller still verifies ownership via RLS BEFORE calling this function (Plan 06-05); cancelBooking itself trusts its bookingId arg."
    - "Atomic cancel UPDATE (RESEARCH §Pattern 2) — single UPDATE sets status='cancelled', cancelled_at=now(), cancelled_by=actor, AND replaces BOTH cancel_token_hash + reschedule_token_hash with dead hashes (RESEARCH Pitfall 4: NOT NULL columns can't be cleared; replace with hashToken(crypto.randomUUID()) — a hash no email contains)"
    - "UPDATE WHERE clause: .eq('id', bookingId).eq('status', 'confirmed').gt('start_at', now()) — CAS-style guard. If no rows match, returns { ok: false, reason: 'not_active' } (PGRST116 from supabase-js .single()). Maps to friendly 'no longer active' page (CONTEXT decision)."
    - "Token validity check (CONTEXT lock): status === 'confirmed' AND start_at > now(). The .gt('start_at', now()) clause + .eq('status', 'confirmed') in the UPDATE WHERE enforces this atomically (RESEARCH §Pattern 1)."
    - "After successful UPDATE, fires sendCancelEmails fire-and-forget: void sendCancelEmails({...}) — Phase 5 lock pattern. Email failure must not roll back the cancel."
    - "After successful UPDATE, writes booking_events audit row with event_type='cancelled', actor (booker|owner), metadata={ reason, ip } — fire-and-forget (Open Question C resolved: audit via booking_events with metadata jsonb carrying reason+ip; failure logged but never blocks the response)"
    - "Returns discriminated result: { ok: true; booking } on success | { ok: false; reason: 'not_active' | 'db_error'; error?: string } on failure"
    - "lib/bookings/reschedule.ts exports rescheduleBooking(args) — single shared function for public reschedule route (Plan 06-04)"
    - "Atomic reschedule UPDATE (RESEARCH §Pattern 3) — single UPDATE sets new start_at + end_at + cancel_token_hash + reschedule_token_hash (rotated to FRESH tokens generated via generateBookingTokens()). Status STAYS 'confirmed' (RESEARCH §Pattern 3 commentary: 'rescheduled' enum value is for booking_events.event_type, NOT bookings.status — booking remains confirmed at new slot so the new tokens are valid)."
    - "Reschedule UPDATE WHERE clause: .eq('id', bookingId).eq('status', 'confirmed').eq('reschedule_token_hash', oldRescheduleHash).gt('start_at', now()) — DOUBLE CAS guard (status + token hash) prevents lost updates if same token is used twice concurrently (RESEARCH §Pattern 3 + Pitfall 6)"
    - "Reschedule UPDATE catches Postgres error 23505 (bookings_no_double_book) and returns { ok: false, reason: 'slot_taken' } — RESEARCH Pitfall 5: the partial unique index fires on UPDATE as well as INSERT"
    - "Reschedule UPDATE returning PGRST116 (no rows matched) returns { ok: false, reason: 'not_active' } — same friendly 'no longer active' page (CAS failed: token already rotated/booking already cancelled)"
    - "After successful UPDATE, fires sendRescheduleEmails fire-and-forget with the FRESH raw cancel + reschedule tokens — booker email contains links keyed to the new tokens"
    - "After successful UPDATE, writes booking_events audit row with event_type='rescheduled', actor='booker', metadata={ old_start_at, new_start_at, ip }"
    - "rescheduleBooking validates the requested new slot satisfies basic invariants — durationMs(new) === durationMs(old) (caller is supposed to send slot from /api/slots which uses event_type.duration_minutes); newStartAt > now() (can't reschedule into the past). On invariant fail returns { ok: false, reason: 'bad_slot', error: '...' } BEFORE the UPDATE."
    - "Both files start with `import 'server-only'` line 1 (admin client gate)"
    - "Neither function does pre-flight slot lookup (Phase 5 lock: DB partial unique index is the authoritative race-safe gate)"
  artifacts:
    - path: "lib/bookings/cancel.ts"
      provides: "Shared cancel function — one UPDATE, dead-hash invalidation, fire-and-forget emails + audit"
      contains: "cancelBooking"
      exports: ["cancelBooking", "CancelBookingArgs", "CancelBookingResult"]
      min_lines: 130
    - path: "lib/bookings/reschedule.ts"
      provides: "Shared reschedule function — atomic UPDATE with double-CAS guard + token rotation + 23505 catch"
      contains: "rescheduleBooking"
      exports: ["rescheduleBooking", "RescheduleBookingArgs", "RescheduleBookingResult"]
      min_lines: 160
  key_links:
    - from: "lib/bookings/cancel.ts"
      to: "Postgres bookings table"
      via: "UPDATE bookings SET status='cancelled', cancel_token_hash=<deadHash>, reschedule_token_hash=<deadHash> WHERE id=? AND status='confirmed' AND start_at > now()"
      pattern: "status: \"cancelled\""
    - from: "lib/bookings/cancel.ts"
      to: "lib/bookings/tokens.ts"
      via: "hashToken(crypto.randomUUID()) → dead hash for token invalidation (RESEARCH Pitfall 4)"
      pattern: "hashToken\\(crypto.randomUUID"
    - from: "lib/bookings/cancel.ts"
      to: "lib/email/send-cancel-emails.ts"
      via: "void sendCancelEmails({...}) — fire-and-forget after UPDATE"
      pattern: "void sendCancelEmails"
    - from: "lib/bookings/cancel.ts"
      to: "booking_events table"
      via: "INSERT { booking_id, account_id, event_type:'cancelled', actor, metadata:{ reason, ip } }"
      pattern: "booking_events"
    - from: "lib/bookings/reschedule.ts"
      to: "Postgres bookings table"
      via: "UPDATE bookings SET start_at, end_at, cancel_token_hash, reschedule_token_hash WHERE id=? AND status='confirmed' AND reschedule_token_hash=? AND start_at > now()"
      pattern: "reschedule_token_hash"
    - from: "lib/bookings/reschedule.ts"
      to: "bookings_no_double_book partial unique index"
      via: "catch error.code === '23505' → reason: 'slot_taken'"
      pattern: "23505"
    - from: "lib/bookings/reschedule.ts"
      to: "lib/bookings/tokens.ts"
      via: "generateBookingTokens() — FRESH raw + hash pair for the new slot"
      pattern: "generateBookingTokens"
    - from: "lib/bookings/reschedule.ts"
      to: "lib/email/send-reschedule-emails.ts"
      via: "void sendRescheduleEmails({ rawCancelToken, rawRescheduleToken, oldStartAt, oldEndAt, ... })"
      pattern: "void sendRescheduleEmails"
---

<objective>
Build the two pure business-logic modules that own the atomic state transitions for cancel and reschedule. These are called by BOTH the public token routes (Plan 06-04) and the owner Server Action (Plan 06-05) — single source of truth for the UPDATE + audit + email pipeline.

Purpose: LIFE-01 + LIFE-02 + LIFE-03 + LIFE-05 (cancel/reschedule lifecycle correctness, token invalidation on state change, owner cancel from dashboard). RESEARCH §Pattern 2 (atomic cancel) and §Pattern 3 (atomic reschedule + token rotation).

Output: 2 files. No HTTP handling, no UI, no rate limiting (callers handle those). Pure DB UPDATE + emails + audit log. `npm run build` + `npm run lint` exit 0.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-CONTEXT.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-RESEARCH.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-02-SUMMARY.md

# The token helper that already exists
@lib/bookings/tokens.ts

# The email orchestrators we built in Plan 06-02
@lib/email/send-cancel-emails.ts
@lib/email/send-reschedule-emails.ts

# Pattern reference: Phase 5 atomic INSERT with 23505 catch
@app/api/bookings/route.ts

# Schema reference: bookings columns + booking_events table + booking_status enum
@supabase/migrations/20260419120000_initial_schema.sql

# Service-role client
@lib/supabase/admin.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: lib/bookings/cancel.ts — shared atomic cancel function</name>
  <files>lib/bookings/cancel.ts</files>
  <action>
Create the shared cancel function. Single atomic UPDATE with dead-hash token invalidation (RESEARCH Pitfall 4). Fire-and-forget emails + audit log.

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/bookings/tokens";
import { sendCancelEmails } from "@/lib/email/send-cancel-emails";

export interface CancelBookingArgs {
  /** UUID of the booking to cancel. Caller is responsible for any prior auth
   *  (e.g. owner Server Action verifies booking belongs to logged-in account
   *  via RLS BEFORE invoking this function). */
  bookingId: string;
  /** Who triggered the cancel — controls the apologetic-vs-confirmation tone in
   *  the booker email and the actor field on the audit row. */
  actor: "booker" | "owner";
  /** Optional cancellation reason text. Surfaced in the OPPOSITE party's email
   *  (booker reason → owner email; owner reason → booker email) when non-empty.
   *  Stored on the audit row regardless. */
  reason?: string;
  /** Caller-resolved app URL for the "Book again" CTA in the booker email.
   *  Typical caller pattern: process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin */
  appUrl: string;
  /** Optional client IP for the audit row (forensics for rate-limit / abuse).
   *  Public token routes pass it; owner Server Action may pass null. */
  ip?: string | null;
}

export type CancelBookingResult =
  | {
      ok: true;
      booking: {
        id: string;
        account_id: string;
        start_at: string;
        end_at: string;
        booker_name: string;
        booker_email: string;
        booker_timezone: string;
      };
    }
  | {
      ok: false;
      /** 'not_active': booking is already cancelled, already rescheduled past, or start_at is past now().
       *               Maps to the friendly "no longer active" page in the public route.
       *  'db_error':  unexpected DB error (logged server-side); maps to 500 in routes. */
      reason: "not_active" | "db_error";
      error?: string;
    };

/**
 * Atomically cancel a confirmed booking.
 *
 * Single UPDATE with CAS-style WHERE clause (RESEARCH §Pattern 2):
 *   - status='cancelled', cancelled_at=now(), cancelled_by=actor
 *   - cancel_token_hash + reschedule_token_hash replaced with dead hashes
 *     (RESEARCH Pitfall 4: NOT NULL columns can't be cleared; a hash of a fresh
 *      crypto.randomUUID() is unreachable from any email and so functionally
 *      invalidates both tokens permanently)
 *   - WHERE id=? AND status='confirmed' AND start_at > now() — token validity
 *     check (CONTEXT lock) embedded in the UPDATE itself, no TOCTOU race
 *
 * If 0 rows match → PGRST116 from .single() → result.reason='not_active'.
 *
 * After UPDATE: fire-and-forget sendCancelEmails (BOTH parties; CONTEXT lock)
 * + booking_events audit row insert. Email/audit failure must NOT block or
 * roll back the cancel — the row is already updated.
 *
 * Caller is responsible for:
 *   - Authorization (owner Server Action: verify RLS scope; public token route:
 *     verify the URL token hashes to a valid booking BEFORE calling this).
 *   - HTTP response shape (Server Action returns void/{error}; route handler
 *     returns NextResponse).
 *   - Rate limiting (public route only).
 */
export async function cancelBooking(args: CancelBookingArgs): Promise<CancelBookingResult> {
  const { bookingId, actor, reason, appUrl, ip } = args;
  const supabase = createAdminClient();

  // ── 1. Need event_type + account context for the email senders BEFORE the
  //       UPDATE (so we don't have to refetch after invalidating tokens). ─────
  // We can fetch this in parallel with no risk because the UPDATE is the
  // serialization point — even if status flipped between fetch and UPDATE,
  // the UPDATE's WHERE clause guards against it.
  const { data: pre, error: preError } = await supabase
    .from("bookings")
    .select(
      `id, account_id, event_type_id, start_at, end_at, booker_name, booker_email, booker_phone, booker_timezone, answers,
       event_types!inner(name, description, duration_minutes, slug),
       accounts!inner(name, slug, timezone, owner_email)`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (preError) {
    console.error("[cancel] pre-fetch error:", preError);
    return { ok: false, reason: "db_error", error: preError.message };
  }
  if (!pre) {
    return { ok: false, reason: "not_active" };
  }

  // ── 2. Generate dead hashes for token invalidation ─────────────────────────
  const deadCancel = await hashToken(crypto.randomUUID());
  const deadReschedule = await hashToken(crypto.randomUUID());

  // ── 3. Atomic cancel UPDATE with CAS guards ────────────────────────────────
  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: actor,
      cancel_token_hash: deadCancel,
      reschedule_token_hash: deadReschedule,
    })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .gt("start_at", new Date().toISOString())
    .select("id")
    .single();

  if (updateError) {
    if (updateError.code === "PGRST116") {
      // 0 rows matched — booking is no longer in 'confirmed' OR start_at passed
      return { ok: false, reason: "not_active" };
    }
    console.error("[cancel] update error:", updateError);
    return { ok: false, reason: "db_error", error: updateError.message };
  }
  if (!updated) {
    return { ok: false, reason: "not_active" };
  }

  // ── 4. Fire-and-forget cancellation emails (BOTH parties; CONTEXT lock) ───
  // Use the pre-fetched booking + event_type + account snapshot — these are the
  // values at the moment the cancel succeeded. Email failure must not block.
  // supabase-js returns nested join objects either as a single row or as
  // arrays depending on the join cardinality; force shape via array index.
  // event_types and accounts are 1:1 from the perspective of bookings.
  const eventType = Array.isArray(pre.event_types) ? pre.event_types[0] : pre.event_types;
  const account = Array.isArray(pre.accounts) ? pre.accounts[0] : pre.accounts;

  void sendCancelEmails({
    booking: {
      id: pre.id,
      start_at: pre.start_at,
      end_at: pre.end_at,
      booker_name: pre.booker_name,
      booker_email: pre.booker_email,
      booker_phone: pre.booker_phone ?? null,
      booker_timezone: pre.booker_timezone,
      answers: (pre.answers ?? {}) as Record<string, string>,
    },
    eventType: {
      name: eventType.name,
      description: eventType.description ?? null,
      duration_minutes: eventType.duration_minutes,
      slug: eventType.slug,
    },
    account: {
      name: account.name,
      slug: account.slug,
      timezone: account.timezone,
      owner_email: account.owner_email ?? null,
    },
    actor,
    reason,
    appUrl,
  });

  // ── 5. Fire-and-forget audit row (Open Question C resolution) ──────────────
  // booking_events.event_type='cancelled', actor=booker|owner, metadata jsonb
  // carries the cancellation reason + ip for forensics. Failure logged.
  void supabase
    .from("booking_events")
    .insert({
      booking_id: pre.id,
      account_id: pre.account_id,
      event_type: "cancelled",
      actor,
      metadata: {
        reason: reason ?? null,
        ip: ip ?? null,
      },
    })
    .then(({ error }) => {
      if (error) console.error("[cancel] audit insert error:", error);
    });

  return {
    ok: true,
    booking: {
      id: pre.id,
      account_id: pre.account_id,
      start_at: pre.start_at,
      end_at: pre.end_at,
      booker_name: pre.booker_name,
      booker_email: pre.booker_email,
      booker_timezone: pre.booker_timezone,
    },
  };
}
```

DO NOT:
- Do NOT skip the dead-hash replacement and try `cancel_token_hash: null` — RESEARCH Pitfall 4: the column is `text NOT NULL`. NULL would raise a Postgres NOT NULL violation.
- Do NOT use a transaction wrapper. supabase-js has no transaction API; the single UPDATE is atomic. The audit + email writes are fire-and-forget AFTER the UPDATE.
- Do NOT `await sendCancelEmails(...)` — fire-and-forget is locked. Email failure must not affect the cancel result.
- Do NOT `await supabase.from('booking_events').insert(...)` — same reason. Use `.then()` for the error log.
- Do NOT include the booking row's old token hashes in the response. They're irrelevant to the caller and the new hashes are dead.
- Do NOT add a `now()` call inside the SELECT — the freshness check belongs in the UPDATE WHERE only. The pre-fetch SELECT can return a row that's about to be invalid; the UPDATE guards against that.
- Do NOT pre-fetch `event_types` or `accounts` separately — use the supabase-js `!inner` join in one query for round-trip efficiency.
- Do NOT remove the supabase-js join shape normalization (`Array.isArray ? [0] : `). The relationship cardinality detection in supabase-js varies by foreign key direction and PostgREST version; defensive normalization is the established Phase 5 pattern.
- Do NOT call cancelBooking from a Server Action without first verifying ownership via the RLS-scoped client (Plan 06-05 owns this pattern). cancelBooking trusts its bookingId arg.
  </action>
  <verify>
```bash
ls "lib/bookings/cancel.ts"

head -1 "lib/bookings/cancel.ts" | grep -q 'import "server-only"' && echo "server-only ok"

# Exports
grep -q "export async function cancelBooking" "lib/bookings/cancel.ts" && echo "cancelBooking exported"
grep -q "CancelBookingArgs" "lib/bookings/cancel.ts" && echo "args type exported"
grep -q "CancelBookingResult" "lib/bookings/cancel.ts" && echo "result type exported"

# Atomic UPDATE shape
grep -q '"cancelled"' "lib/bookings/cancel.ts" && echo "status cancelled"
grep -q "cancelled_at:" "lib/bookings/cancel.ts" && echo "cancelled_at set"
grep -q "cancelled_by: actor" "lib/bookings/cancel.ts" && echo "cancelled_by set"

# Dead-hash invalidation (RESEARCH Pitfall 4)
grep -q "hashToken(crypto.randomUUID" "lib/bookings/cancel.ts" && echo "dead hash pattern ok"
grep -q "deadCancel" "lib/bookings/cancel.ts" && echo "dead cancel hash"
grep -q "deadReschedule" "lib/bookings/cancel.ts" && echo "dead reschedule hash"

# CAS guards in UPDATE
grep -q '\.eq("status", "confirmed")' "lib/bookings/cancel.ts" && echo "status CAS"
grep -q '\.gt("start_at"' "lib/bookings/cancel.ts" && echo "start_at CAS"

# PGRST116 → not_active mapping
grep -q "PGRST116" "lib/bookings/cancel.ts" && echo "PGRST116 handled"
grep -q '"not_active"' "lib/bookings/cancel.ts" && echo "not_active reason"

# Fire-and-forget email + audit
grep -q "void sendCancelEmails" "lib/bookings/cancel.ts" && echo "fire-and-forget email"
grep -q "booking_events" "lib/bookings/cancel.ts" && echo "audit log target"
grep -q '"cancelled"' "lib/bookings/cancel.ts" && echo "event_type cancelled"

npm run build
npm run lint
```
  </verify>
  <done>
`lib/bookings/cancel.ts` exists; exports `cancelBooking(args)` with single UPDATE, dead-hash invalidation, CAS guards, PGRST116→not_active mapping, fire-and-forget cancel emails (BOTH parties via Plan 06-02 orchestrator), and fire-and-forget booking_events audit row. `import "server-only"` line 1. Build + lint pass.

Commit: `feat(06-03): add lib/bookings/cancel.ts shared atomic cancel function with dead-hash token invalidation`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: lib/bookings/reschedule.ts — shared atomic reschedule function</name>
  <files>lib/bookings/reschedule.ts</files>
  <action>
Create the shared reschedule function. Single atomic UPDATE with double CAS guard (status + old reschedule token hash). Catches Postgres 23505 from `bookings_no_double_book`. Fire-and-forget emails + audit.

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBookingTokens, hashToken } from "@/lib/bookings/tokens";
import { sendRescheduleEmails } from "@/lib/email/send-reschedule-emails";

export interface RescheduleBookingArgs {
  /** UUID of the booking to reschedule. Caller (Plan 06-04 public route) hashes
   *  the URL token and looks up by reschedule_token_hash BEFORE calling this. */
  bookingId: string;
  /** The CURRENT (pre-rotation) reschedule token hash — embedded in the UPDATE
   *  WHERE clause as a CAS guard so concurrent requests using the same token
   *  cannot both succeed (RESEARCH Pitfall 6). The caller already hashed the
   *  URL token to look up the booking; pass that hash here. */
  oldRescheduleHash: string;
  /** New slot start (ISO UTC) — typically from the SlotPicker submission */
  newStartAt: string;
  /** New slot end (ISO UTC) — must equal newStartAt + duration_minutes */
  newEndAt: string;
  /** Caller-resolved app URL for cancel/reschedule links in the new email */
  appUrl: string;
  /** Optional client IP for the audit row */
  ip?: string | null;
}

export type RescheduleBookingResult =
  | {
      ok: true;
      booking: {
        id: string;
        account_id: string;
        start_at: string;
        end_at: string;
        booker_name: string;
        booker_email: string;
        booker_timezone: string;
      };
    }
  | {
      ok: false;
      /** 'not_active': CAS failed — token already rotated, booking already cancelled, or start_at passed.
       *                Maps to friendly "no longer active" page.
       *  'slot_taken': bookings_no_double_book partial unique index violation (23505) — RESEARCH Pitfall 5.
       *                Maps to "that time was just booked, pick another" UX (mirror Phase 5 SLOT_TAKEN).
       *  'bad_slot':   newStartAt is in the past, or newEndAt <= newStartAt — invariant violation BEFORE UPDATE.
       *  'db_error':   unexpected DB error. */
      reason: "not_active" | "slot_taken" | "bad_slot" | "db_error";
      error?: string;
    };

/**
 * Atomically reschedule a confirmed booking to a new slot, rotating both
 * cancel + reschedule tokens (RESEARCH §Pattern 3).
 *
 * Single UPDATE:
 *   - SET start_at, end_at, cancel_token_hash, reschedule_token_hash
 *   - Status STAYS 'confirmed' (RESEARCH §Pattern 3 commentary: 'rescheduled'
 *     enum value is for booking_events.event_type only; bookings.status remains
 *     'confirmed' so the new tokens are valid)
 *   - WHERE id=? AND status='confirmed' AND reschedule_token_hash=oldHash
 *     AND start_at > now() — DOUBLE CAS guard (status + old token hash)
 *
 * Three failure modes:
 *   - 0 rows matched (PGRST116) → 'not_active' (token already rotated/used)
 *   - Postgres 23505 → 'slot_taken' (target slot is already booked)
 *   - Other DB error → 'db_error'
 *
 * After successful UPDATE: fire-and-forget sendRescheduleEmails (BOTH parties)
 * with the FRESH raw cancel + reschedule tokens + the OLD start/end (for the
 * "Was → New" body), and a fire-and-forget booking_events audit row.
 */
export async function rescheduleBooking(
  args: RescheduleBookingArgs,
): Promise<RescheduleBookingResult> {
  const { bookingId, oldRescheduleHash, newStartAt, newEndAt, appUrl, ip } = args;

  // ── 0. Invariant checks BEFORE UPDATE ──────────────────────────────────────
  const newStartDate = new Date(newStartAt);
  const newEndDate = new Date(newEndAt);
  if (Number.isNaN(newStartDate.getTime()) || Number.isNaN(newEndDate.getTime())) {
    return { ok: false, reason: "bad_slot", error: "Invalid date format." };
  }
  if (newStartDate <= new Date()) {
    return { ok: false, reason: "bad_slot", error: "New slot must be in the future." };
  }
  if (newEndDate <= newStartDate) {
    return { ok: false, reason: "bad_slot", error: "End time must be after start time." };
  }

  const supabase = createAdminClient();

  // ── 1. Pre-fetch booking + event_type + account for the email senders ──────
  // (Same join pattern as cancel.ts — 1 round-trip.)
  const { data: pre, error: preError } = await supabase
    .from("bookings")
    .select(
      `id, account_id, event_type_id, start_at, end_at, booker_name, booker_email, booker_timezone,
       event_types!inner(name, description, duration_minutes, slug),
       accounts!inner(name, slug, timezone, owner_email)`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (preError) {
    console.error("[reschedule] pre-fetch error:", preError);
    return { ok: false, reason: "db_error", error: preError.message };
  }
  if (!pre) {
    return { ok: false, reason: "not_active" };
  }

  // Capture OLD slot for the email body BEFORE the UPDATE rotates them away.
  const oldStartAt = pre.start_at;
  const oldEndAt = pre.end_at;

  // ── 2. Generate fresh cancel + reschedule tokens for the new slot ──────────
  const fresh = await generateBookingTokens();

  // ── 3. Atomic reschedule UPDATE with double CAS guard ──────────────────────
  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({
      start_at: newStartAt,
      end_at: newEndAt,
      cancel_token_hash: fresh.hashCancel,
      reschedule_token_hash: fresh.hashReschedule,
      // status stays 'confirmed' — see RESEARCH §Pattern 3 commentary
    })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .eq("reschedule_token_hash", oldRescheduleHash) // CAS guard: only the original token holder wins (RESEARCH Pitfall 6)
    .gt("start_at", new Date().toISOString())
    .select("id, start_at, end_at")
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      // bookings_no_double_book fired — target slot is taken (RESEARCH Pitfall 5)
      return { ok: false, reason: "slot_taken" };
    }
    if (updateError.code === "PGRST116") {
      // 0 rows matched — CAS failed (token already rotated, booking already
      // cancelled, or start_at passed during the call)
      return { ok: false, reason: "not_active" };
    }
    console.error("[reschedule] update error:", updateError);
    return { ok: false, reason: "db_error", error: updateError.message };
  }
  if (!updated) {
    return { ok: false, reason: "not_active" };
  }

  // ── 4. Fire-and-forget reschedule emails ──────────────────────────────────
  const eventType = Array.isArray(pre.event_types) ? pre.event_types[0] : pre.event_types;
  const account = Array.isArray(pre.accounts) ? pre.accounts[0] : pre.accounts;

  void sendRescheduleEmails({
    booking: {
      id: pre.id,
      start_at: updated.start_at,    // NEW start (post-rotation)
      end_at: updated.end_at,        // NEW end
      booker_name: pre.booker_name,
      booker_email: pre.booker_email,
      booker_timezone: pre.booker_timezone,
    },
    eventType: {
      name: eventType.name,
      description: eventType.description ?? null,
      duration_minutes: eventType.duration_minutes,
    },
    account: {
      name: account.name,
      slug: account.slug,
      timezone: account.timezone,
      owner_email: account.owner_email ?? null,
    },
    oldStartAt,
    oldEndAt,
    rawCancelToken: fresh.rawCancel,
    rawRescheduleToken: fresh.rawReschedule,
    appUrl,
  });

  // ── 5. Fire-and-forget audit row ──────────────────────────────────────────
  void supabase
    .from("booking_events")
    .insert({
      booking_id: pre.id,
      account_id: pre.account_id,
      event_type: "rescheduled",
      actor: "booker", // public reschedule path is booker-initiated only in v1
      metadata: {
        old_start_at: oldStartAt,
        new_start_at: updated.start_at,
        ip: ip ?? null,
      },
    })
    .then(({ error }) => {
      if (error) console.error("[reschedule] audit insert error:", error);
    });

  return {
    ok: true,
    booking: {
      id: pre.id,
      account_id: pre.account_id,
      start_at: updated.start_at,
      end_at: updated.end_at,
      booker_name: pre.booker_name,
      booker_email: pre.booker_email,
      booker_timezone: pre.booker_timezone,
    },
  };
}
```

**Note on `hashToken` import:** the import is included for symmetry with `cancel.ts`, but `rescheduleBooking` doesn't actually use `hashToken` directly (only `generateBookingTokens()` which returns pre-hashed values). If `npm run lint` flags the unused import, remove `hashToken` from the import line — keep `generateBookingTokens` only.

DO NOT:
- Do NOT set `status: 'rescheduled'` on the bookings row. RESEARCH §Pattern 3 commentary + CONTEXT lock: status stays 'confirmed' so the new (rotated) tokens are valid. The `'rescheduled'` enum value is for the audit row's `event_type` field only.
- Do NOT skip the `eq("reschedule_token_hash", oldRescheduleHash)` CAS guard. RESEARCH Pitfall 6: without it, two concurrent requests using the same token can both succeed and rotate to different new tokens — the second succeeds with tokens the second requester doesn't know.
- Do NOT pre-flight by calling `/api/slots` or `computeSlots()`. The DB partial unique index is the authoritative race gate. RESEARCH Pitfall 5 confirms the index fires on UPDATE just like INSERT — the 23505 catch is the correct surface.
- Do NOT validate `newEndAt - newStartAt === duration_minutes * 60_000` on the server. The caller (Plan 06-04 reschedule POST) sends a slot from `/api/slots`, which is computed against `event_type.duration_minutes`. A mismatch is a client bug, not a public-surface concern. Adding the check here would force every test to construct exact end times.
- Do NOT `await` the email send or audit insert.
- Do NOT use the OLD reschedule token to look up the booking — the caller already did that and passes the bookingId + oldRescheduleHash. cancelBooking trusts its args; rescheduleBooking trusts its args.
- Do NOT remove the supabase-js join-shape normalization (`Array.isArray ? [0] : `).
  </action>
  <verify>
```bash
ls "lib/bookings/reschedule.ts"

head -1 "lib/bookings/reschedule.ts" | grep -q 'import "server-only"' && echo "server-only ok"

# Exports
grep -q "export async function rescheduleBooking" "lib/bookings/reschedule.ts" && echo "rescheduleBooking exported"
grep -q "RescheduleBookingArgs" "lib/bookings/reschedule.ts" && echo "args type exported"
grep -q "RescheduleBookingResult" "lib/bookings/reschedule.ts" && echo "result type exported"

# Status stays confirmed (NOT changed to rescheduled)
grep -q "// status stays 'confirmed'" "lib/bookings/reschedule.ts" && echo "status invariant comment ok"
# Negative check: no `status: "rescheduled"` in the UPDATE call
grep -q 'status: "rescheduled"' "lib/bookings/reschedule.ts" && echo "WARNING: status set to rescheduled - REMOVE" || echo "status NOT set to rescheduled - ok"

# Double CAS guard
grep -q '\.eq("status", "confirmed")' "lib/bookings/reschedule.ts" && echo "status CAS"
grep -q '\.eq("reschedule_token_hash", oldRescheduleHash)' "lib/bookings/reschedule.ts" && echo "token hash CAS (RESEARCH Pitfall 6)"
grep -q '\.gt("start_at"' "lib/bookings/reschedule.ts" && echo "start_at guard"

# Token rotation
grep -q "generateBookingTokens" "lib/bookings/reschedule.ts" && echo "fresh tokens generated"
grep -q "fresh.hashCancel" "lib/bookings/reschedule.ts" && echo "new cancel hash"
grep -q "fresh.hashReschedule" "lib/bookings/reschedule.ts" && echo "new reschedule hash"

# 23505 catch
grep -q '"23505"' "lib/bookings/reschedule.ts" && echo "23505 caught (RESEARCH Pitfall 5)"
grep -q '"slot_taken"' "lib/bookings/reschedule.ts" && echo "slot_taken reason"

# PGRST116 → not_active
grep -q "PGRST116" "lib/bookings/reschedule.ts" && echo "PGRST116 handled"

# Fire-and-forget email + audit
grep -q "void sendRescheduleEmails" "lib/bookings/reschedule.ts" && echo "fire-and-forget email"
grep -q '"rescheduled"' "lib/bookings/reschedule.ts" && echo "audit event_type rescheduled"

npm run build
npm run lint
```
  </verify>
  <done>
`lib/bookings/reschedule.ts` exists; exports `rescheduleBooking(args)`. Single UPDATE rotates both token hashes + new slot times. Status STAYS 'confirmed' (commented invariant). Double CAS guard (status + old reschedule_token_hash). Catches 23505→slot_taken, PGRST116→not_active. Fresh raw tokens passed to `void sendRescheduleEmails(...)` along with old start/end. Audit row written fire-and-forget with old/new ISO timestamps. `import "server-only"` line 1. Build + lint pass.

Commit: `feat(06-03): add lib/bookings/reschedule.ts atomic reschedule with double-CAS guard + 23505 catch`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
ls "lib/bookings/cancel.ts" "lib/bookings/reschedule.ts"
npm run build
npm run lint
```
</verification>

<rollback>
Delete both files. No other module imports them yet (Plan 06-04 is the first consumer; Plan 06-05 the second). Migration + Plan 06-02 utilities remain intact and reusable.
</rollback>

<success_criteria>
- [ ] `lib/bookings/cancel.ts` exports `cancelBooking(args)` returning discriminated `CancelBookingResult`
- [ ] Cancel UPDATE replaces BOTH token hashes with `hashToken(crypto.randomUUID())` (RESEARCH Pitfall 4: dead-hash invalidation; columns are NOT NULL)
- [ ] Cancel UPDATE WHERE has `id + status='confirmed' + start_at > now()` (CAS guard for token validity)
- [ ] Cancel maps PGRST116 → `reason: 'not_active'`
- [ ] Cancel fires `void sendCancelEmails(...)` with snapshot of booking + event_type + account
- [ ] Cancel writes `booking_events` audit row with `event_type='cancelled'`, `actor`, `metadata={ reason, ip }`
- [ ] `lib/bookings/reschedule.ts` exports `rescheduleBooking(args)` returning discriminated `RescheduleBookingResult`
- [ ] Reschedule UPDATE WHERE has `id + status='confirmed' + reschedule_token_hash=oldHash + start_at > now()` (DOUBLE CAS guard)
- [ ] Reschedule UPDATE rotates BOTH token hashes via `generateBookingTokens()`
- [ ] Reschedule does NOT set `status='rescheduled'` on bookings row (status stays 'confirmed' for new-token validity)
- [ ] Reschedule maps Postgres 23505 → `reason: 'slot_taken'` (RESEARCH Pitfall 5: index fires on UPDATE)
- [ ] Reschedule maps PGRST116 → `reason: 'not_active'`
- [ ] Reschedule fires `void sendRescheduleEmails(...)` with FRESH raw tokens + OLD start/end + new times
- [ ] Reschedule writes `booking_events` audit row with `event_type='rescheduled'`, `actor='booker'`, `metadata={ old_start_at, new_start_at, ip }`
- [ ] Both files have `import "server-only"` line 1
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/06-cancel-and-reschedule-lifecycle/06-03-SUMMARY.md` documenting:
- cancelBooking(args) contract: { bookingId, actor, reason?, appUrl, ip? } → { ok: true, booking } | { ok: false, reason, error? }
- rescheduleBooking(args) contract: { bookingId, oldRescheduleHash, newStartAt, newEndAt, appUrl, ip? } → { ok: true, booking } | { ok: false, reason: 'not_active'|'slot_taken'|'bad_slot'|'db_error', error? }
- Atomic UPDATE pattern (single CAS-guarded UPDATE; no transactions)
- Dead-hash invalidation strategy (cancel: BOTH hashes replaced with hashToken(randomUUID()); reschedule: BOTH rotated to FRESH tokens)
- Status invariant: bookings.status stays 'confirmed' after reschedule (booking_events.event_type carries the 'rescheduled' marker)
- Forward locks for Plan 06-04 (public token routes):
  - POST /api/cancel: rate-limit → resolve token via hashToken+lookup → cancelBooking({ bookingId, actor:'booker', reason, appUrl, ip })
  - POST /api/reschedule: rate-limit → resolve token via hashToken+lookup → rescheduleBooking({ bookingId, oldRescheduleHash, newStartAt, newEndAt, appUrl, ip })
- Forward locks for Plan 06-05 (owner cancel Server Action): RLS-scoped client verifies booking ownership → cancelBooking({ bookingId, actor:'owner', reason, appUrl, ip:null })
</output>
