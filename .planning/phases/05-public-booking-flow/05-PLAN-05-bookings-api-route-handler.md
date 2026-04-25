---
phase: 05-public-booking-flow
plan: 05
type: execute
wave: 3
depends_on: ["05-01", "05-02", "05-03"]
files_modified:
  - app/api/bookings/route.ts
  - lib/bookings/tokens.ts
autonomous: true

must_haves:
  truths:
    - "POST /api/bookings is a Route Handler (NOT a Server Action) — Server Actions cannot return 409 (RESEARCH Pitfall 1, locked)"
    - "Validates body via bookingInputSchema (Plan 05-03); returns 400 + {error, fieldErrors} on Zod failure with Cache-Control: no-store header"
    - "Verifies Turnstile token BEFORE any DB write; returns 403 + {error: 'Bot check failed.'} on failure"
    - "Resolves account + event_type with createAdminClient(); returns 404 if event_type missing/inactive/soft-deleted"
    - "Generates raw cancel + reschedule tokens (crypto.randomUUID()); SHA-256 hashes both; stores hashes in cancel_token_hash + reschedule_token_hash; raw tokens passed to email senders only"
    - "INSERT booking row; on Postgres error 23505 (bookings_no_double_book unique violation) returns 409 + {error: 'That time was just booked. Pick a new time below.'} (CONTEXT decision #5 copy)"
    - "On 23505, response body includes a slug-friendly error code (e.g. {error, code: 'SLOT_TAKEN'}) so the client can distinguish race-loser from generic validation"
    - "On successful insert, fires sendBookingEmails(...) WITHOUT await (CONTEXT lock — fire-and-forget); returns 201 + {bookingId, redirectTo: '/[account]/[event-slug]/confirmed/[booking-id]'}"
    - "All responses include Cache-Control: no-store header"
    - "Route uses createAdminClient() (service-role) — same rationale as /api/slots (public, anon callers, RLS would block)"
    - "lib/bookings/tokens.ts exports generateBookingTokens() returning {rawCancel, rawReschedule, hashCancel, hashReschedule}; uses Web Crypto API (crypto.subtle.digest) for SHA-256 (Edge-runtime compatible) — NOT Node-only crypto.createHash"
    - "Booking row insert sets account_id, event_type_id, start_at, end_at, booker_name, booker_email, booker_phone (nullable column tolerates empty string OR null — schema requires non-empty so always populated), booker_timezone, answers (jsonb), cancel_token_hash, reschedule_token_hash, status='confirmed'"
    - "Optional defense: cross-check that the requested {start_at, end_at} matches a slot currently returned by computeSlots() — DEFERRED to Plan 05-08 integration test as a verification gate; the DB-level partial unique index is the authoritative race-safe gate, so the route does NOT need an additional pre-flight slot check (would only add latency without changing correctness)"
  artifacts:
    - path: "app/api/bookings/route.ts"
      provides: "POST /api/bookings — race-safe insert + 409 + Turnstile verify + fire-forget emails"
      contains: "POST\\|computeSlots\\|insertError.code"
      exports: ["POST", "dynamic"]
      min_lines: 130
    - path: "lib/bookings/tokens.ts"
      provides: "Token generation + SHA-256 hashing helpers"
      contains: "generateBookingTokens"
      exports: ["generateBookingTokens", "hashToken"]
      min_lines: 25
  key_links:
    - from: "app/api/bookings/route.ts"
      to: "lib/bookings/schema.ts (bookingInputSchema)"
      via: "import { bookingInputSchema } from '@/lib/bookings/schema'"
      pattern: "bookingInputSchema"
    - from: "app/api/bookings/route.ts"
      to: "lib/turnstile.ts"
      via: "verifyTurnstile(token, ip)"
      pattern: "verifyTurnstile"
    - from: "app/api/bookings/route.ts"
      to: "lib/email/send-booking-emails.ts"
      via: "void sendBookingEmails({...}) — fire-and-forget"
      pattern: "void sendBookingEmails"
    - from: "app/api/bookings/route.ts"
      to: "Postgres bookings_no_double_book partial unique index"
      via: "INSERT into bookings catches error.code === '23505' → 409"
      pattern: "23505"
    - from: "app/api/bookings/route.ts"
      to: "lib/bookings/tokens.ts"
      via: "generateBookingTokens()"
      pattern: "generateBookingTokens"
---

<objective>
Build the `POST /api/bookings` Route Handler that ties together the Wave 2 modules (schema, Turnstile, .ics, email senders) and the existing race-safe DB constraint into the booking submission endpoint.

Purpose: BOOK-05 (race-safe 409 with clean error UI) + BOOK-07 (Turnstile invisible-mode bot protection) + EMAIL-01..04 (emails fire on insert success). The DB-level partial unique index `bookings_no_double_book` (FOUND-04, Phase 1) is the authoritative anti-double-book guard — this route surfaces it as 409 and otherwise gets out of the way.

Output: `app/api/bookings/route.ts` and `lib/bookings/tokens.ts`. Build + lint clean. No tests in this plan — Plan 05-08 covers integration testing.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-public-booking-flow/05-CONTEXT.md
@.planning/phases/05-public-booking-flow/05-RESEARCH.md
@.planning/phases/05-public-booking-flow/05-01-SUMMARY.md
@.planning/phases/05-public-booking-flow/05-02-SUMMARY.md
@.planning/phases/05-public-booking-flow/05-03-SUMMARY.md

# Wave 2 modules this route consumes
@lib/bookings/schema.ts
@lib/turnstile.ts
@lib/email/send-booking-emails.ts

# Reference: race-guard test from Phase 1 confirms 23505 path
@tests/race-guard.test.ts

# Reference: identical service-role public-route pattern from /api/slots
@app/api/slots/route.ts

# Reference: existing schema (bookings table, partial unique index)
@supabase/migrations/20260419120000_initial_schema.sql

# Reference: server-only admin client
@lib/supabase/admin.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Token generation + SHA-256 hash helpers</name>
  <files>lib/bookings/tokens.ts</files>
  <action>
```typescript
import "server-only";

/**
 * Generates raw cancel + reschedule tokens and their SHA-256 hashes.
 *
 * Storage rule (LIFE-03): bookings.cancel_token_hash + reschedule_token_hash
 * are TEXT NOT NULL. We INSERT the hex-encoded SHA-256 hash; the raw token
 * lives only in the booker's confirmation email. Phase 6 cancel/reschedule
 * routes hash the token from the URL and look up by hash.
 *
 * Web Crypto API used (crypto.subtle.digest) so this module is Edge-runtime
 * compatible. crypto.randomUUID() is Web Crypto's CSPRNG (RFC 4122 v4) —
 * 122 bits of entropy, sufficient for token use.
 */

export async function hashToken(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = encoder.encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  // Hex encode
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface BookingTokens {
  rawCancel: string;
  rawReschedule: string;
  hashCancel: string;
  hashReschedule: string;
}

export async function generateBookingTokens(): Promise<BookingTokens> {
  const rawCancel = crypto.randomUUID();
  const rawReschedule = crypto.randomUUID();
  const [hashCancel, hashReschedule] = await Promise.all([
    hashToken(rawCancel),
    hashToken(rawReschedule),
  ]);
  return { rawCancel, rawReschedule, hashCancel, hashReschedule };
}
```

DO NOT:
- Do NOT use Node `crypto.createHash("sha256")` — fails on Edge runtime. Web Crypto (`crypto.subtle.digest`) works on both Node 20+ and Edge.
- Do NOT add a salt or HMAC. Tokens are random secrets distributed via email; SHA-256(token) is sufficient unless we move to a bcrypt/argon2 scheme (deferred — Phase 8 hardening).
- Do NOT base64 the hash (hex matches Phase 1 schema convention; Phase 6 lookup hashes URL token to hex too).
- Do NOT rely on `crypto.randomUUID()` returning a particular format — UUID v4 with dashes; ~36 chars. Phase 6 URL routes can decode any printable string.
  </action>
  <verify>
```bash
ls "lib/bookings/tokens.ts"

grep -q "generateBookingTokens" "lib/bookings/tokens.ts" && echo "generator exported"
grep -q "hashToken" "lib/bookings/tokens.ts" && echo "hash exported"
grep -q "crypto.subtle.digest" "lib/bookings/tokens.ts" && echo "Web Crypto used"
head -2 "lib/bookings/tokens.ts" | grep -q 'import "server-only"' && echo "server-only ok"

# Smoke: hash deterministic
node --input-type=module -e "
import('./lib/bookings/tokens.ts').then(async m => {
  const h1 = await m.hashToken('test');
  const h2 = await m.hashToken('test');
  if (h1 !== h2) throw new Error('non-deterministic');
  if (h1.length !== 64) throw new Error('not hex sha256');
  const t = await m.generateBookingTokens();
  if (!t.rawCancel || !t.hashCancel || t.rawCancel === t.rawReschedule) throw new Error('tokens busted');
  console.log('ok');
}).catch(e => { console.error(e); process.exit(1); });
"
# (May need ts-node/tsx for direct .ts import — fallback: rely on integration test in Plan 05-08)
```
  </verify>
  <done>
`lib/bookings/tokens.ts` exports `hashToken(raw)` and `generateBookingTokens()`. Uses Web Crypto API. `import "server-only"` line 1.

Commit: `feat(05-05): add booking token generator + SHA-256 hash helpers`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: POST /api/bookings Route Handler</name>
  <files>app/api/bookings/route.ts</files>
  <action>
```typescript
/**
 * POST /api/bookings — race-safe public booking creation.
 *
 * Flow:
 *   1. Parse + validate body via bookingInputSchema (Zod).
 *   2. Verify Cloudflare Turnstile token server-side BEFORE any DB hit.
 *   3. Resolve account + event_type with service-role client.
 *   4. Generate raw + hashed cancel/reschedule tokens.
 *   5. INSERT booking row. Postgres 23505 on bookings_no_double_book → 409.
 *   6. Fire emails (booker confirmation + owner notification) — fire and forget.
 *   7. Return 201 with bookingId + suggested redirect path.
 *
 * Caching: NEVER. dynamic="force-dynamic" + Cache-Control: no-store on every response.
 *
 * Service-role rationale: identical to /api/slots — endpoint is hit by
 * unauthenticated booking-page visitors with no session cookie; RLS would
 * silently block all reads + writes for anon. Inputs are Zod-validated before
 * any query; reads are scoped to the resolved account_id.
 */

import { NextResponse, type NextRequest } from "next/server";

import { bookingInputSchema } from "@/lib/bookings/schema";
import { generateBookingTokens } from "@/lib/bookings/tokens";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendBookingEmails } from "@/lib/email/send-booking-emails";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

function appUrl(req: NextRequest): string {
  // Prefer explicit env (set in Vercel); fall back to request origin for local dev.
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    req.nextUrl.origin
  );
}

export async function POST(req: NextRequest) {
  // ── 1. Parse + validate body ────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Invalid JSON.", code: "BAD_REQUEST" },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = bookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        code: "VALIDATION",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: NO_STORE },
    );
  }
  const input = parsed.data;

  // ── 2. Turnstile verify (before any DB hit) ─────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const turnstileOk = await verifyTurnstile(input.turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json(
      { error: "Bot check failed. Please refresh and try again.", code: "TURNSTILE" },
      { status: 403, headers: NO_STORE },
    );
  }

  // ── 3. Resolve event_type → account ─────────────────────────────────────
  const supabase = createAdminClient();

  const { data: eventType, error: etError } = await supabase
    .from("event_types")
    .select("id, account_id, name, description, duration_minutes, custom_questions")
    .eq("id", input.eventTypeId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (etError || !eventType) {
    return NextResponse.json(
      { error: "Event type not found.", code: "NOT_FOUND" },
      { status: 404, headers: NO_STORE },
    );
  }

  const { data: account, error: acctError } = await supabase
    .from("accounts")
    .select("id, slug, name, timezone, owner_email")
    .eq("id", eventType.account_id)
    .single();

  if (acctError || !account) {
    return NextResponse.json(
      { error: "Account not found.", code: "NOT_FOUND" },
      { status: 404, headers: NO_STORE },
    );
  }

  // ── 4. Generate tokens ──────────────────────────────────────────────────
  const tokens = await generateBookingTokens();

  // ── 5. Insert booking row ───────────────────────────────────────────────
  // The partial unique index `bookings_no_double_book ON (event_type_id, start_at)
  // WHERE status='confirmed'` is the race-safe guarantee. On collision Postgres
  // raises 23505 (unique_violation) and supabase-js surfaces it as error.code.
  const { data: booking, error: insertError } = await supabase
    .from("bookings")
    .insert({
      account_id: account.id,
      event_type_id: input.eventTypeId,
      start_at: input.startAt,
      end_at: input.endAt,
      booker_name: input.bookerName,
      booker_email: input.bookerEmail,
      booker_phone: input.bookerPhone,
      booker_timezone: input.bookerTimezone,
      answers: input.answers,
      cancel_token_hash: tokens.hashCancel,
      reschedule_token_hash: tokens.hashReschedule,
      status: "confirmed",
    })
    .select(
      "id, start_at, end_at, booker_name, booker_email, booker_phone, booker_timezone, answers",
    )
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        {
          error: "That time was just booked. Pick a new time below.",
          code: "SLOT_TAKEN",
        },
        { status: 409, headers: NO_STORE },
      );
    }
    console.error("[/api/bookings] insert error:", insertError);
    return NextResponse.json(
      { error: "Booking failed. Please try again.", code: "INTERNAL" },
      { status: 500, headers: NO_STORE },
    );
  }

  // ── 6. Fire emails — DO NOT AWAIT ───────────────────────────────────────
  // Email failures must not roll back the booking. Caller pattern locked
  // by Plan 05-03 orchestrator: Promise.allSettled internally + console.error.
  void sendBookingEmails({
    booking: {
      id: booking.id,
      start_at: booking.start_at,
      end_at: booking.end_at,
      booker_name: booking.booker_name,
      booker_email: booking.booker_email,
      booker_timezone: booking.booker_timezone,
    },
    eventType: {
      name: eventType.name,
      description: eventType.description,
      duration_minutes: eventType.duration_minutes,
    },
    account: {
      name: account.name,
      timezone: account.timezone,
      owner_email: account.owner_email,
      slug: account.slug,
    },
    rawCancelToken: tokens.rawCancel,
    rawRescheduleToken: tokens.rawReschedule,
    appUrl: appUrl(req),
    ownerArgs: {
      booking: {
        id: booking.id,
        start_at: booking.start_at,
        booker_name: booking.booker_name,
        booker_email: booking.booker_email,
        booker_phone: booking.booker_phone,
        booker_timezone: booking.booker_timezone,
        answers: (booking.answers ?? {}) as Record<string, string>,
      },
      eventType: { name: eventType.name },
      account: {
        name: account.name,
        timezone: account.timezone,
        owner_email: account.owner_email,
      },
    },
  });

  // ── 7. Respond 201 ───────────────────────────────────────────────────────
  return NextResponse.json(
    {
      bookingId: booking.id,
      redirectTo: `/${account.slug}/${input.eventTypeId ? eventType.id /* placeholder */ : ""}`, // see note below
    },
    { status: 201, headers: NO_STORE },
  );
}
```

**Note on the `redirectTo` field:** the confirmation route lives at `/[account]/[event-slug]/confirmed/[booking-id]`. The eventType slug is what the URL needs (not the eventType.id). Adjust the response to:

```typescript
return NextResponse.json(
  {
    bookingId: booking.id,
    // Phase 5 confirmation route: /[account]/[event-slug]/confirmed/[booking-id]
    redirectTo: `/${account.slug}/${eventTypeSlug}/confirmed/${booking.id}`,
  },
  { status: 201, headers: NO_STORE },
);
```

This requires loading `event_types.slug` in the SELECT in step 3. Update the .select() to include `slug`:

```typescript
.select("id, account_id, slug, name, description, duration_minutes, custom_questions")
```

And capture as `const eventTypeSlug = eventType.slug;` near the top after the lookup.

**Headers note:** If `headers: NO_STORE` syntax is wrong for `NextResponse.json()` in Next 16 (it's `{ headers: HeadersInit }`), match the established pattern from `/api/slots/route.ts` exactly — that file is on disk and works.

DO NOT:
- Do NOT make this a Server Action. RESEARCH Pitfall 1 — Server Actions cannot return 409. Locked.
- Do NOT cache. `force-dynamic` + `no-store` on every response. Caching a POST endpoint is nonsense, but Next can sometimes optimize incorrectly without explicit signals.
- Do NOT await `sendBookingEmails`. Fire-and-forget is locked.
- Do NOT include the raw cancel/reschedule tokens in the response body. They go in the email only. Plan 05-08 integration test verifies absence.
- Do NOT pre-flight by calling computeSlots() to validate the requested {start_at, end_at} is in the slots list. The DB-level partial unique index is the authoritative guard. Pre-flight adds latency without fixing correctness — race window between pre-flight check and INSERT still exists.
- Do NOT add CORS headers — the booking page (Plan 05-04 + 05-06) is same-origin. Phase 7 embed widget loads inside iframe at /embed/* and POSTs same-origin too.
- Do NOT include the booker_phone field as null when empty. Schema (Plan 05-03) requires non-empty phone (CONTEXT decision #3); always provide a value.
- Do NOT rate-limit in this plan — Phase 8 hardening adds rate limits via INFRA-01.
  </action>
  <verify>
```bash
ls "app/api/bookings/route.ts"

# Route exports
grep -q "export async function POST" "app/api/bookings/route.ts" && echo "POST exported"
grep -q 'export const dynamic = "force-dynamic"' "app/api/bookings/route.ts" && echo "dynamic ok"

# Wave 2 wiring
grep -q "bookingInputSchema" "app/api/bookings/route.ts" && echo "schema wired"
grep -q "verifyTurnstile" "app/api/bookings/route.ts" && echo "turnstile wired"
grep -q "generateBookingTokens" "app/api/bookings/route.ts" && echo "tokens wired"
grep -q "sendBookingEmails" "app/api/bookings/route.ts" && echo "emails wired"
grep -q "void sendBookingEmails" "app/api/bookings/route.ts" && echo "fire-and-forget pattern ok"

# Race-safe handling
grep -q '"23505"' "app/api/bookings/route.ts" && echo "23505 catch ok"
grep -q '"SLOT_TAKEN"' "app/api/bookings/route.ts" && echo "code SLOT_TAKEN ok"
grep -q '"That time was just booked' "app/api/bookings/route.ts" && echo "user-facing message matches CONTEXT decision #5"

# Confirmation redirect path
grep -q "confirmed/" "app/api/bookings/route.ts" && echo "redirect path ok"

# Service-role
grep -q "createAdminClient" "app/api/bookings/route.ts" && echo "admin client ok"

# No-store on every response (sample check)
grep -c "NO_STORE" "app/api/bookings/route.ts" | awk '$1 >= 5 { print "no-store applied broadly" }'

# No raw tokens in 201 response
grep -q "rawCancel" "app/api/bookings/route.ts"
# This MAY be present in the var name, but should NOT appear inside the 201 response body block.
# Manually inspect: the only place rawCancelToken/rawRescheduleToken appears is inside the
# void sendBookingEmails({...}) block. Plan 05-08 integration test re-verifies.

npm run build
npm run lint
```
  </verify>
  <done>
`app/api/bookings/route.ts` exists, exports `POST` + `dynamic="force-dynamic"`. Validates body via Zod, verifies Turnstile, resolves event_type + account via service-role, generates tokens, inserts booking, catches 23505 → 409 with `code: "SLOT_TAKEN"` + the locked CONTEXT message, fires emails fire-and-forget, returns 201 with `bookingId` + `redirectTo: /[account]/[event-slug]/confirmed/[booking-id]`. All responses include `Cache-Control: no-store`. Service-role + reasoning documented in JSDoc. `npm run build` + `npm run lint` exit 0.

Commit: `feat(05-05): add POST /api/bookings race-safe handler with 409 + Turnstile + emails`. Push.

Final smoke (after Vercel deploy + Andrew sets env vars + dev keys for Turnstile):
```bash
# Test with Turnstile dev keys (always-pass) by:
#   - Set NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA in .env.local for dev
#   - Set TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA in .env.local for dev
#   - Get a token by visiting any page that mounts <Turnstile siteKey=test/> in dev mode
# Then:
curl -i -X POST https://calendar-app-xi-smoky.vercel.app/api/bookings \
  -H "content-type: application/json" \
  -d '{"eventTypeId":"<uuid>","startAt":"2026-06-15T14:00:00.000Z","endAt":"2026-06-15T14:30:00.000Z","bookerName":"Test","bookerEmail":"test@example.com","bookerPhone":"5551234567","bookerTimezone":"America/Chicago","answers":{},"turnstileToken":"<token>"}'
# Expected: 201 + {bookingId, redirectTo}
# Repeat IMMEDIATELY same payload → expected 409 + {error, code: "SLOT_TAKEN"}
```
  </done>
</task>

</tasks>

<verification>
```bash
ls "app/api/bookings/route.ts" "lib/bookings/tokens.ts"
npm run build
npm run lint
```
</verification>

<success_criteria>
- [ ] `app/api/bookings/route.ts` exports `POST` + `dynamic="force-dynamic"` + `revalidate = 0`
- [ ] `lib/bookings/tokens.ts` exports `generateBookingTokens()` + `hashToken()`; uses Web Crypto API (Edge-compatible)
- [ ] Body validated via `bookingInputSchema`; 400 on Zod fail with `fieldErrors`
- [ ] Turnstile verified BEFORE any DB query; 403 on fail
- [ ] event_type filtered by `is_active=true` AND `deleted_at IS NULL`; 404 on miss
- [ ] account looked up by `eventType.account_id`; 404 on miss
- [ ] Tokens generated; raw tokens passed only to email senders; hashes inserted into `cancel_token_hash` + `reschedule_token_hash`
- [ ] Booking insert error 23505 → 409 + `code: "SLOT_TAKEN"` + locked CONTEXT message ("That time was just booked. Pick a new time below.")
- [ ] On success: `void sendBookingEmails(...)` (fire-and-forget); 201 returned with `{bookingId, redirectTo: "/[account]/[event-slug]/confirmed/[booking-id]"}`
- [ ] All responses include `Cache-Control: no-store` header
- [ ] Uses `createAdminClient()` (service-role); rationale documented in JSDoc
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/05-public-booking-flow/05-05-SUMMARY.md` documenting:
- Final response shape: 201 → `{bookingId, redirectTo}`; 4xx/5xx → `{error, code, fieldErrors?}`
- The exact `redirectTo` format: `/${account.slug}/${eventType.slug}/confirmed/${booking.id}`
- The 23505 → 409 path with locked CONTEXT message
- Confirmation that email send is fire-and-forget (no `await`)
- Decision: no pre-flight slot validity check (DB index is authoritative)
- Web Crypto API usage rationale (Edge-runtime compatibility for future migration)
- The locked decision: rate-limiting deferred to Phase 8 (INFRA-01)
</output>
