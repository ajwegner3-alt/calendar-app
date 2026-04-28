# Architecture Research — v1.1

**Domain:** Multi-tenant Calendly-style booking tool (Next.js 16 + Supabase)
**Researched:** 2026-04-27
**Confidence:** HIGH for items grounded in shipped v1.0 code; MEDIUM where v1.1 introduces new Postgres / email-rendering / @supabase/ssr patterns (verified against current Supabase + Postgres docs).

> **This document supersedes the v1.0 ARCHITECTURE.md research file for the v1.1 feature areas (multi-user signup, capacity, branded UI overhaul). v1.0 patterns are NOT being re-designed.** See "Existing architecture preserved" below for the inviolable invariants v1.1 must integrate around.

---

## Existing architecture preserved (v1.0 invariants — DO NOT redesign)

These patterns are load-bearing across the shipped codebase and v1.1 integrates around them rather than replacing them.

| Invariant | Owner file(s) | v1.1 integration rule |
|---|---|---|
| **CSP / `X-Frame-Options` exclusivity** | `proxy.ts` | New routes (`/signup`, `/auth/confirm`, `/onboarding`, `/app/home`) inherit the non-embed branch (`frame-ancestors 'self'`). Touch nothing in `proxy.ts` except adding the auth-gate exception list. |
| **Service-role gate** | `lib/supabase/admin.ts` (line 1: `import "server-only"`) | Capacity trigger error mapping happens server-side; signup confirmation route uses RLS-scoped `createClient`, NOT `createAdminClient`. Account auto-provisioning is the ONE new place that may need service-role (slug uniqueness check + INSERT under RLS gap — see §A.5). |
| **Two-stage owner authorization** | `cancelBookingAsOwner`, branding actions, `saveReminderTogglesCore` | Onboarding wizard's Server Actions follow the same pattern: RLS-scoped check → service-role mutation only when RLS doesn't permit. |
| **Direct-call Server Action contract** | All form actions (event-types, branding, availability) | New onboarding/signup forms accept structured TS objects. NEXT_REDIRECT re-throw in form catch handler. |
| **POST `/api/bookings` is a Route Handler** | `app/api/bookings/route.ts` | Capacity 23P01 / custom RAISE maps to the same 409 + `code: "SLOT_TAKEN"` branch the race-loser banner UX already handles. |
| **Race-safety at the DB layer** | `bookings_no_double_book` partial unique index | v1.1 REPLACES this constraint with a capacity-aware mechanism (§B). The replacement must be at the DB layer — application-level pre-check is insufficient. |
| **`timestamptz` everywhere + `TZDate` for wall-clock** | `lib/slots.ts`, `lib/email-sender/**` | Capacity does not change time semantics. Default availability provisioning constructs windows via `TZDate(y, m-1, d, hh, mm, 0, TZ)` exactly like Phase 4. |
| **`@supabase/ssr` cookie-based session via `proxy.ts`** | `lib/supabase/proxy.ts` (`updateSession`) | Auth callback / confirm route MUST use the same pattern (`createServerClient` with cookies adapter). Do not introduce a parallel auth client. |
| **`current_owner_account_ids()` RPC** | `supabase/migrations/20260419120001_rls_policies.sql` line 10 | Already user-scoped (`where owner_user_id = auth.uid()`). NO change required for multi-user — by construction, each authenticated user sees only their own account(s). v1.1 simply has more rows in `accounts`. |
| **`RESERVED_SLUGS`** (currently duplicated 2 places) | `app/[account]/[event-slug]/_lib/load-event-type.ts:9`, `app/[account]/_lib/load-account-listing.ts:8` | Phase 10 MUST consolidate to `lib/reserved-slugs.ts` BEFORE the slug-picker is wired (slug-picker is the third consumer that would otherwise drift). |
| **Postgres-backed rate limiting** | `rate_limit_events` + `lib/rate-limit.ts` | `/api/auth/signup` (or whichever route handles signup form POST if not Supabase-direct) MUST be rate-limited (signup spam vector). New key prefix: `signup:`. |

---

## v1.1 system overview (delta from v1.0)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Public surfaces (no auth)                                                  │
│  ┌────────────────┐ ┌──────────────────┐ ┌───────────────┐ ┌─────────────┐ │
│  │ /[account]/*   │ │ /embed/[acct]/*  │ │ /signup  NEW  │ │ /login      │ │
│  │ /cancel/[t]    │ │ /widget.js       │ │ /auth/confirm │ │ /forgot-pw  │ │
│  │ /reschedule/[t]│ │                  │ │   NEW         │ │   NEW       │ │
│  └────────────────┘ └──────────────────┘ └───────────────┘ └─────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼  (proxy.ts gates /app/*; auth-public allowlist)
┌────────────────────────────────────────────────────────────────────────────┐
│  Owner shell (/app/* — auth required)                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Sidebar IA (v1.1):                                                    │  │
│  │   Home (NEW — monthly calendar)                                       │  │
│  │   Event Types                                                         │  │
│  │   Availability                                                        │  │
│  │   Branding (extended: bg color + shade)                               │  │
│  │   Bookings                                                            │  │
│  │   ── Settings ──                                                      │  │
│  │   Reminder Settings                                                   │  │
│  │   Profile (NEW — email, password, account slug, default TZ)          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ /onboarding (NEW — first-login wizard, OUTSIDE shell)                 │  │
│  │   Step 1: Account name + slug picker                                  │  │
│  │   Step 2: Default availability (9-5 Mon-Fri local TZ)                 │  │
│  │   Step 3: First event type (Quote Consultation, 30 min)               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Postgres (Supabase) — schema delta                                         │
│  accounts          : + background_color text, + background_shade text       │
│  event_types       : + max_bookings_per_slot int NOT NULL DEFAULT 1         │
│                       CHECK (max_bookings_per_slot >= 1)                    │
│  bookings          : (no schema change — capacity enforced by trigger)      │
│  Indexes           : DROP bookings_no_double_book                           │
│                      CREATE bookings_capacity_trigger (BEFORE INSERT)       │
│                      CREATE INDEX bookings_capacity_count_idx ON            │
│                          bookings(event_type_id, start_at) WHERE            │
│                          status='confirmed'                                  │
│  Functions         : + enforce_booking_capacity() trigger fn                 │
│                      + (optional) provision_account_for_user(user_id, slug)  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## A. Multi-user signup + onboarding architecture

### A.1 — Signup flow data path: **RECOMMENDED = Option (ii) Server Action after `/auth/confirm`**

**Decision:** Pure Server-Action provisioning in `/onboarding`. NO Postgres trigger on `auth.users`.

**Three options were considered:**

| Option | Pros | Cons |
|---|---|---|
| **(i) `auth.users` trigger** | Atomic, can't miss | Cannot collect slug-picker UX input at confirm time; `auth` schema is Supabase-managed (security definer functions on it are fragile); slug uniqueness check inside trigger requires advisory lock to be race-safe; failure inside trigger blocks email confirm with cryptic error |
| **(ii) Server Action after `/auth/confirm` redirect** ✅ | Slug-picker UX runs in `/onboarding` page; explicit error handling; can resume on partial failure (refresh `/onboarding` → re-runs idempotently); no `auth` schema coupling | If user closes tab post-confirm, they have an `auth.users` row but no `accounts` row — `/app/*` proxy needs to handle this state by redirecting to `/onboarding` |
| **(iii) Hybrid (trigger creates placeholder, action UPDATEs)** | Atomicity + UX | Two sources of truth for "account row exists"; slug-uniqueness migration of placeholder → real slug still needs the same advisory-lock pattern; double the surface area to test |

**Rationale for (ii):** v1.0 already established the "RLS-scoped pre-check → service-role mutation" pattern. The unlinked-user state is already handled (`/app/page.tsx` line 32 redirects to `/app/unlinked` when `current_owner_account_ids()` returns empty). v1.1 changes that redirect target from `/app/unlinked` → `/onboarding`. The wizard runs `provisionAccount()` Server Action which:

1. Re-checks `current_owner_account_ids()` (idempotency: if already provisioned, redirect to `/app`).
2. Validates slug against `RESERVED_SLUGS` + the `accounts.slug` unique constraint.
3. Uses `createAdminClient()` (service-role) for the INSERT because `accounts` has NO insert RLS policy in v1.0 (`migrations/20260419120001_rls_policies.sql` line 30: "No insert/delete policy for accounts in Phase 1 — service role handles seeding"). v1.1 either:
   - **(a)** Adds an INSERT RLS policy `with check (owner_user_id = auth.uid())` so the action can use the RLS-scoped client, OR
   - **(b)** Keeps the no-INSERT-policy invariant and uses `createAdminClient()` for the provision step only.

   **Recommend (a)** — adds a real RLS rule that's auditable in the cross-tenant matrix test, and avoids spreading service-role usage to a 4th call site.
4. Inserts default availability rules (`availability_rules` rows for Mon-Fri 540-1020 minutes, `account_id = new`).
5. Optionally inserts a default event type (`Quote Consultation`, 30 min) — debatable; could be deferred to step 3 of the wizard with the user's choice.

**Downstream consumers of "account row created" event:**
- `/app/page.tsx` linkage check (already handles 0-account case)
- Email "Welcome to NSI Booking" (NEW v1.1 — Phase 10)
- `current_owner_account_ids()` RPC (no change needed)

### A.2 — Onboarding wizard route structure: **`/onboarding/*` OUTSIDE the shell**

The shell layout (`app/(shell)/layout.tsx`) assumes a provisioned account — the sidebar links to `/app/event-types`, `/app/availability`, etc. Rendering the wizard inside the shell would either show empty/broken sidebar links or require the sidebar to know about a "pre-provisioned" state.

**Recommended structure:**

```
app/
  onboarding/
    layout.tsx                       # Lightweight chrome: logo + step indicator
    page.tsx                         # Step 1: account name + slug picker
    availability/page.tsx            # Step 2: confirm/edit default 9-5 Mon-Fri
    first-event-type/page.tsx        # Step 3: optional first event type
    _lib/
      actions.ts                     # provisionAccount + setDefaultAvailability + createFirstEventType
      schema.ts                      # Zod schemas
      reserved-slugs-client.ts       # slug-picker live-validation (re-exports from lib/reserved-slugs.ts)
    _components/
      step-indicator.tsx
      slug-picker.tsx                # Debounced uniqueness check via /api/onboarding/check-slug
```

`/app/page.tsx` redirect rule changes:
```
linkedCount === 0 → redirect("/onboarding")  // was redirect("/app/unlinked")
```

`/app/unlinked` page can stay as a fallback for orphan auth.users rows that bypassed the wizard, but the canonical path is `/onboarding`.

**proxy.ts impact:** `/onboarding/*` is auth-required (not public — user must be confirmed). Add to the proxy gate alongside `/app/*` but with a SECOND condition: redirect to `/onboarding` when authenticated user has 0 accounts and is on `/app/*`. Simpler alternative: keep proxy.ts unchanged (`/app/*` only), and let the per-page `current_owner_account_ids()` check redirect into `/onboarding`. **Recommend the simpler alternative** — adding multi-level redirects to proxy.ts is a footgun (proxy.ts already runs on every request, including `_next/data` prefetches).

### A.3 — `/auth/confirm` route: canonical `verifyOtp` pattern handling BOTH signup AND password reset

**Recommended file:** `app/auth/confirm/route.ts` (NOT `/auth/callback` — that's the OAuth name, and Supabase docs as of 2026 standardize on `/auth/confirm` for the email-OTP flow. The v1.0 backlog item "callback 404" can use either name; `/confirm` matches current Supabase template defaults).

**Note on names:** Supabase's OLDER docs used `/auth/callback` with `exchangeCodeForSession(code)`. Current docs use `/auth/confirm` with `verifyOtp({ type, token_hash })`. `verifyOtp` is the path that handles BOTH `type=signup` (email confirmation) AND `type=recovery` (password reset) AND `type=invite` (future v1.2 invite flow), making it strictly more flexible. v1.1 should adopt the verifyOtp path.

**Skeleton:**

```typescript
// app/auth/confirm/route.ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";  // default

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/app/login?error=invalid_link", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(new URL("/app/login?error=expired_link", request.url));
  }

  // Success: signup + invite → /onboarding (provision flow); recovery → /app/reset-password
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/app/reset-password", request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}
```

**Email template configuration (Supabase Dashboard → Auth → Email Templates):**
- Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding`
- Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/app/reset-password`
- Invite user (v1.2): `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/onboarding`

**proxy.ts:** `/auth/confirm` is public. Already covered by the matcher (only `/app/*` is gated). Verify by reading line 48 of `lib/supabase/proxy.ts` — gate condition is `pathname.startsWith("/app")`. ✅

**Downstream consumers:** Add `/forgot-password` page (form posts email to `supabase.auth.resetPasswordForEmail({ email, redirectTo: ${appUrl}/auth/confirm?next=/app/reset-password })`) and `/app/reset-password` page (form for new password, calls `supabase.auth.updateUser({ password })` after the recovery session is set by `verifyOtp`).

### A.4 — `current_owner_account_ids()` RPC: NO CHANGE

Function is already user-scoped. Zero changes for v1.1. This is a HIGH-confidence claim — verified by reading line 16-18 of `supabase/migrations/20260419120001_rls_policies.sql`:

```sql
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from accounts where owner_user_id = auth.uid();
$$;
```

Each authenticated user sees only the accounts where they are owner. With many users, the function returns the right rows for each user by construction.

### A.5 — RLS policies: spot the leak vectors

| Table | Current policy | v1.1 multi-user concern |
|---|---|---|
| `accounts` | SELECT/UPDATE `using (owner_user_id = auth.uid())` | **GAP:** No INSERT policy. Onboarding flow needs one. **Recommend:** `create policy "users insert own account" on accounts for insert to authenticated with check (owner_user_id = auth.uid())`. |
| `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events` | All scoped via `account_id in (select current_owner_account_ids())` | **No change.** Cross-tenant matrix test (Plan 08-08) already validates the isolation; with N owners instead of 1, the same RPC returns the right N×M projection. |
| `storage.objects` (branding bucket) | Path-prefixed by `account_id`, scoped via `current_owner_account_ids()` | **No change.** New onboarding step "upload logo" can run in Step 4 (optional); same branding bucket, same path scheme. |

**One subtle gap to flag:** `accounts.slug` unique constraint is a TABLE-level unique (`accounts_slug_key`). v1.0 did NOT need a partial unique index because there's no soft-delete on `accounts`. v1.1 should answer: "what happens if a user is deleted?" — `accounts.owner_user_id` is `references auth.users(id) on delete set null`, so the slug stays reserved forever (orphan account). For v1.1 this is acceptable (account deletion is OUT OF SCOPE per A.8). For v1.2, consider adding `deleted_at timestamptz` + partial unique on `(slug) WHERE deleted_at IS NULL` to mirror the event-types pattern.

### A.6 — Slug picker validation flow + `RESERVED_SLUGS` consolidation

**Single source of truth:** `lib/reserved-slugs.ts`

```typescript
// lib/reserved-slugs.ts (NEW v1.1)
// Single source of truth — replaces duplication in
//   app/[account]/[event-slug]/_lib/load-event-type.ts:9
//   app/[account]/_lib/load-account-listing.ts:8
// New v1.1 consumer: app/onboarding/_lib/actions.ts (slug picker validation)

export const RESERVED_SLUGS = new Set([
  "app",
  "api",
  "_next",
  "auth",
  "embed",
  // v1.1 additions:
  "signup",
  "login",
  "onboarding",
  "forgot-password",
  "reset-password",
  "widget.js",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
```

**Validation order in `provisionAccount` Server Action:**
1. Zod-validate slug shape: `/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/` (DNS-label-safe; matches v1.0 event-type slug rule).
2. `if (isReservedSlug(slug)) return { fieldErrors: { slug: ["This name is reserved."] } }`.
3. Pre-flight uniqueness check (`select id from accounts where slug = $1`) — UX feedback before submit, not race-safe.
4. INSERT with `account_id`, `owner_user_id = auth.uid()`, `slug`. On `error.code === "23505"` (unique violation on `accounts_slug_key`) → return `{ fieldErrors: { slug: ["That URL is taken."] } }`. **THIS is the authoritative race gate** — the unique constraint, not the pre-check.

**Confirm: does an `accounts.slug` unique index exist?** Yes — `unique not null` declared inline in `migrations/20260419120000_initial_schema.sql:16` (`slug text unique not null`). HIGH confidence.

**Confirm: partial unique-on-active needed?** NO for v1.1 (no soft-delete on accounts). Flag for v1.2.

**Live slug-picker UX:** `/api/onboarding/check-slug?slug=...` Route Handler returns `{ available: boolean, reserved: boolean }`. Debounce client-side via `use-debounce` (already installed). Service-role admin client (slug check is read-only, doesn't leak any data — only `count(*)` on a single column).

### A.7 — Default availability provisioning: TZ inferred from browser at signup

**Data path:**

```
/signup form (client component)
    │
    │  On submit, before calling supabase.auth.signUp():
    │  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    │
    │  Pass tz in the user metadata:
    │  supabase.auth.signUp({
    │    email, password,
    │    options: { data: { intended_timezone: tz } }
    │  })
    │
    ▼
auth.users row (raw_user_meta_data JSONB contains intended_timezone)
    │
    │  User confirms email → /auth/confirm → /onboarding
    │
    ▼
provisionAccount Server Action:
    1. Read auth.users via supabase.auth.getUser() → user_metadata.intended_timezone
    2. Fall back to "America/Chicago" if missing or invalid (validate against
       Intl.supportedValuesOf("timeZone") — Node 20 supports this)
    3. INSERT accounts row with timezone = resolved TZ
    4. INSERT default availability_rules: 5 rows for day_of_week 1-5,
       start_minute=540 (9:00), end_minute=1020 (17:00)
       (NOTE: 0=Sunday in our schema; Mon-Fri = 1-5)
    5. INSERT account settings defaults: buffer_minutes=0, min_notice_hours=24,
       max_advance_days=60, daily_cap=null
       (mirrors NSI seed values from migration 20260425120000)
```

**Why a Step 2 wizard page even exists:** the user can confirm/edit before the page commits the rules. If they accept defaults, the wizard just moves to step 3. The 9-5 Mon-Fri values are an opinionated default for trade contractors.

### A.8 — Account deletion / soft-delete: OUT OF SCOPE for v1.1

**Confirmed out of scope.** v1.1 has no UI for account deletion. Owner who wants to leave can email Andrew (manual cleanup via Supabase SQL Editor). Future v1.2 should add `accounts.deleted_at` + partial unique on slug + cascading soft-delete on event_types/bookings.

**Minimum-viable safety net for v1.1:** a Supabase SQL query template Andrew can run for manual deletion:
```sql
-- v1.1 manual account deletion (run as admin):
update accounts set owner_user_id = null where id = $1;  -- orphan the slug
delete from auth.users where id = (select owner_user_id from ... where ...);
-- bookings + event_types cascade-delete via FK on accounts? NO — accounts
-- has no soft-delete; this is destructive. Confirm with Andrew before running.
```

Document this in `FUTURE_DIRECTIONS.md` v1.1 entry, NOT in production code.

---

## B. Capacity-aware booking architecture

### B.1 — Schema: `max_bookings_per_slot` on `event_types` (NOT `bookings`)

**Confirmed correct location.** Capacity is a property of the event type (a "Discovery Call" has capacity 3; a "Site Visit" has capacity 1). It is NOT a property of any individual booking. Putting it on `bookings` would either denormalize it (every row carries the same value) or require it to be settable per-row (which is a different feature).

**Migration:**

```sql
-- supabase/migrations/[ts]_add_event_type_capacity.sql
alter table event_types
  add column max_bookings_per_slot int not null default 1
    check (max_bookings_per_slot >= 1);

comment on column event_types.max_bookings_per_slot is
  'Maximum concurrent confirmed bookings allowed for any single time slot of this event type. Default 1 = exclusive booking (matches v1.0 semantics). Owner-toggleable in /app/event-types form.';
```

**Default = 1:** Every existing v1.0 row backfills with 1, preserving existing behavior. This is also the type-default for new event types — owners opt into N-per-slot.

### B.2 — Replace `bookings_no_double_book`: **RECOMMENDED = BEFORE INSERT trigger + transaction-scoped advisory lock**

**Three patterns considered:**

| Pattern | Race-safe? | Verdict |
|---|---|---|
| **(i) EXCLUDE constraint** | Yes, but Postgres EXCLUDE cannot reference another table's column (no `event_types.max_bookings_per_slot` lookup inside the constraint expression). Could only enforce a hardcoded N. | ❌ Rejected. |
| **(ii) BEFORE INSERT trigger with naïve `SELECT count(*)`** | **NO — races under READ COMMITTED.** Two concurrent inserts both see count=2, both pass `<3`, both commit. (Verified against Postgres docs + Cybertec article: triggers run inside the inserting transaction's snapshot, NOT against committed-after-snapshot rows.) | ❌ Rejected. |
| **(iii) BEFORE INSERT trigger + `pg_advisory_xact_lock(event_type_id, slot_epoch)` BEFORE the count** | Yes. Advisory lock serializes ALL concurrent inserts for the same `(event_type_id, start_at)` pair; lock auto-released at txn commit/rollback. Other slots are unaffected (different lock keys). Performance: O(1) per insert; contention only when actually racing for the same slot. | ✅ **RECOMMENDED.** |
| **(iv) Application-level SELECT-COUNT-then-INSERT** | NO — gap between check and INSERT. Even with optimistic concurrency, you'd need a serializable transaction + retry loop. More moving parts than (iii). | ❌ Rejected. |

**Recommended trigger:**

```sql
-- supabase/migrations/[ts]_capacity_trigger.sql

-- Drop the v1.0 partial unique index — it enforces N=1 for ALL event types.
drop index if exists bookings_no_double_book;

-- Replacement: a partial covering index for fast count() inside the trigger.
create index if not exists bookings_capacity_count_idx
  on bookings(event_type_id, start_at)
  where status = 'confirmed';

-- Capacity enforcement function.
create or replace function enforce_booking_capacity()
returns trigger
language plpgsql
as $$
declare
  cap int;
  current_count int;
  lock_key1 bigint;
  lock_key2 bigint;
begin
  -- Only enforce on confirmed inserts. Cancelled/rescheduled rows should
  -- not re-trigger the count (cancelled rows are excluded by the index).
  if new.status <> 'confirmed' then
    return new;
  end if;

  -- Compute a deterministic lock key from (event_type_id, start_at). Use the
  -- two-bigint variant so we have 128 bits of key space; collisions across
  -- unrelated event_types are statistically irrelevant.
  -- hashtext returns int4; cast to bigint then combine.
  lock_key1 := hashtextextended(new.event_type_id::text, 0);
  lock_key2 := hashtextextended(new.start_at::text, 0);

  -- Transaction-scoped: released at COMMIT or ROLLBACK. Serializes all
  -- concurrent inserts for the same (event_type, slot) pair.
  perform pg_advisory_xact_lock(lock_key1, lock_key2);

  -- Look up capacity for this event type.
  select max_bookings_per_slot into cap
    from event_types
   where id = new.event_type_id;

  if cap is null then
    raise exception 'Unknown event_type_id %', new.event_type_id
      using errcode = '23503';  -- foreign_key_violation
  end if;

  -- Count confirmed bookings already at this slot.
  -- After acquiring the advisory lock, this count is authoritative because
  -- any concurrent inserter for the same slot is blocked behind us.
  select count(*) into current_count
    from bookings
   where event_type_id = new.event_type_id
     and start_at = new.start_at
     and status = 'confirmed';

  if current_count >= cap then
    raise exception 'Slot is at capacity'
      using errcode = '23P01';  -- triggered_action_exception (custom-mapped to 409)
  end if;

  return new;
end;
$$;

create trigger trg_enforce_booking_capacity
  before insert on bookings
  for each row
  execute function enforce_booking_capacity();
```

**Race-safety justification (HIGH confidence):**
1. `pg_advisory_xact_lock(k1, k2)` acquires an exclusive lock keyed on the (event_type_id, start_at) hash pair, holding it until txn end (Postgres docs, "13.3.5 Advisory Locks").
2. Any concurrent INSERT for the SAME slot will block at the `perform pg_advisory_xact_lock(...)` line until the first txn commits or rolls back.
3. After the lock is acquired, the `count(*)` is taken in a snapshot that includes the prior committed transaction (READ COMMITTED re-reads on each statement). Even better: PG evaluates trigger statements in the latest committed snapshot, NOT the txn-start snapshot.
4. If first txn commits a new row → second txn's count sees it → second txn raises 23P01.
5. If first txn rolls back → second txn's count does NOT see the rolled-back row → second txn proceeds.

**Why NOT `select ... for update` on the event_types row:** that would block ALL bookings for that event type while one is in flight, even for different slots. Advisory lock keyed on `(event_type_id, start_at)` only blocks SAME-slot races.

### B.3 — Migration strategy: drop old index + create new index + create trigger atomically

**Lock impact:** `DROP INDEX` on `bookings_no_double_book` takes an `ACCESS EXCLUSIVE` lock briefly (it's a partial unique on a partial set; small index → fast). `CREATE INDEX` (replacement covering index) can be done `CONCURRENTLY` to avoid blocking writes — **but** `CREATE TRIGGER` takes ACCESS EXCLUSIVE on the table.

**Recommended order (single migration file, transactional except for the CONCURRENTLY index):**

```sql
-- File 1 (CONCURRENT — runs outside a transaction):
create index concurrently if not exists bookings_capacity_count_idx
  on bookings(event_type_id, start_at)
  where status = 'confirmed';

-- File 2 (transactional):
begin;
  drop index if exists bookings_no_double_book;
  create or replace function enforce_booking_capacity() returns trigger ... ;
  create trigger trg_enforce_booking_capacity ... ;
  alter table event_types
    add column max_bookings_per_slot int not null default 1
      check (max_bookings_per_slot >= 1);
commit;
```

**Risk window:** between `DROP INDEX` and `CREATE TRIGGER` (microseconds, single-statement transaction). Vercel preview traffic during the deploy could in theory race-double-book, but:
- The migration is applied via `supabase db query --linked -f` (LOCKED workaround), one-shot.
- Production traffic for NSI's account is single-digit bookings/day.
- The trigger creation is in the same transaction as the drop, so the window is sub-millisecond.

**Acceptable.** Document the deploy order: migrate FIRST, then deploy app code that exposes `max_bookings_per_slot` UI.

**Migration drift workaround:** continue using `npx supabase db query --linked -f <file>` per the v1.0 lock. Or use Supabase MCP `apply_migration` if available in the agent's environment.

### B.4 — `/api/slots` change: capacity-aware availability

**Current behavior (`app/api/slots/route.ts` + `lib/slots.ts`):** `slotConflictsWithBookings()` returns true if ANY booking exists at the slot. This treats every slot as 1-capacity.

**v1.1 change:** the slot is "available" if `confirmed_count_for_this_slot < event_type.max_bookings_per_slot`.

**Two implementation options:**

| Option | Pros | Cons |
|---|---|---|
| **(a) Pass capacity into `computeSlots`, count bookings per-slot in JS** | Pure function stays pure; existing test suite easy to extend | Allocates per-slot state; slightly more memory for long ranges |
| **(b) New SQL view that pre-aggregates `confirmed_count` per slot** | DB does the heavy lift | Couples slot-engine to DB schema; harder to test in isolation; v1.0 explicitly chose pure-fn engine over SQL aggregation |

**Recommend (a) — keep the pure-function engine.**

**Sketch:**

```typescript
// lib/slots.ts — slotConflictsWithBookings becomes slotIsAtCapacity:

function slotConfirmedCount(
  slotStartUtc: Date,
  bookings: SlotInput["bookings"],
): number {
  // Bookings are already filtered to status != 'cancelled' by the caller.
  // Count exact-start matches (capacity is per-slot, not per-overlap).
  const slotStartMs = slotStartUtc.getTime();
  let n = 0;
  for (const b of bookings) {
    if (new Date(b.start_at).getTime() === slotStartMs) n += 1;
  }
  return n;
}

// In computeSlots():
//   const cap = input.maxBookingsPerSlot;  // NEW input field
//   if (slotConfirmedCount(slotStartUtc, bookings) >= cap) continue;
//
// BUFFER OVERLAP: keep the existing slotConflictsWithBookings call — buffers
// still apply (a 30-min buffer means no slot starts within 30 minutes of an
// existing booking's edges, regardless of capacity). Capacity governs
// EXACT-START matches; buffer governs adjacent-slot exclusion.
```

**`/api/slots/route.ts` change:** add `max_bookings_per_slot` to the event_types SELECT; pass into `computeSlots`. One-line schema bump.

**Subtle correctness nuance:** with capacity=3 and a 30-min buffer, can two bookings exist at 10:00 AND a third at 10:30? The buffer says no (10:30 is within 30 min of 10:00). Capacity does NOT override buffer — buffer is "no nearby slot is offered for booking", capacity is "this exact slot has N seats". The combination is: at-most-N bookings at the EXACT slot start, AND no neighbor-buffer overlap. The existing `slotConflictsWithBookings` enforces the second; the new count enforces the first. Both apply.

### B.5 — `/api/bookings` change: 23P01 → 409 SLOT_TAKEN (already wired)

`app/api/bookings/route.ts` line 205-216 already handles `error.code === "23505"` → 409 with code SLOT_TAKEN. v1.1 adds a sibling branch:

```typescript
if (insertError) {
  if (insertError.code === "23505" || insertError.code === "23P01") {
    // 23505 = unique_violation (legacy v1.0 partial unique — won't fire post-migration)
    // 23P01 = triggered_action_exception (v1.1 capacity trigger)
    return NextResponse.json(
      { error: "That time was just booked. Pick a new time below.", code: "SLOT_TAKEN" },
      { status: 409, headers: NO_STORE },
    );
  }
  // ... existing 500 path
}
```

The existing race-loser banner UX (`RaceLoserBanner` component, `refetchKey` bump, form-value preservation) works UNCHANGED. The Vitest race test in `tests/bookings-api.integration.test.ts` will need updating — the assertion was "1 success + 1 with code 23505". Now the failed insert raises with code 23P01 (custom from RAISE EXCEPTION USING ERRCODE). Both are mapped to 409 + SLOT_TAKEN.

### B.6 — Test matrix additions

```
tests/bookings-api.integration.test.ts (extend):

  describe("capacity enforcement", () => {
    test("capacity=3, 5 concurrent inserts → exactly 3 succeed, 2 fail with 409", ...);
    test("capacity=1 (default), 2 concurrent → 1 wins (regression of v1.0)", ...);
    test("capacity=2, 3rd insert at same slot fails with 23P01 → 409 SLOT_TAKEN", ...);
    test("cancelled booking frees a capacity seat for new booker", ...);
  });
```

The existing `signInAsNsiOwner` Vitest helper + the partial covering index `bookings_capacity_count_idx` make these fast (no full table scan).

---

## C. Branded UI overhaul architecture

### C.1 — Per-account theme tokens schema: **two columns**, NOT JSONB

| Option | Pros | Cons |
|---|---|---|
| `branding_tokens jsonb` | Easy to extend later | No type-safety; can't add CHECK constraints; harder to query in RLS-scoped views; loose contract spreads into TS types as `any`-prone |
| Separate columns `background_color text` + `background_shade text` ✅ | Type-safe; CHECK constraints (e.g., `background_color ~ '^#[0-9a-f]{6}$'`); explicit downstream consumer list | Migration per addition |

**Recommend: separate columns.** v1.1 adds exactly two new columns; the shape is known. JSONB is appropriate when shape is unknown (custom_questions on event_types is rightly JSONB because each owner defines their own questions).

```sql
alter table accounts
  add column if not exists background_color text,
  add column if not exists background_shade text
    check (background_shade in ('subtle', 'medium', 'vivid'));

comment on column accounts.background_color is
  'Hex color string for gradient base (e.g., #F0F9FF). Null = use brand_primary as base.';
comment on column accounts.background_shade is
  'Gradient intensity: subtle | medium | vivid. Maps to opacity / second-color-step in the page background <style> block.';
```

**Why `background_shade` is text-enum, not int:** owner-facing UI is a 3-button choice; text values are self-documenting in the DB. CHECK constraint enforces enumeration.

**Downstream consumers of these new columns (every place the data flows must be updated):**

1. `lib/branding/read.ts` (whatever loader builds `BrandedPage` props) — extend to include `backgroundColor`, `backgroundShade`.
2. `app/_components/branded-page.tsx` — accept new props; emit gradient inline `<style>`.
3. `app/(shell)/app/branding/_lib/load-branding.ts:31` — add columns to SELECT.
4. `app/(shell)/app/branding/_lib/types.ts` (BrandingState interface) — add fields.
5. `app/(shell)/app/branding/_components/branding-editor.tsx` — UI for picker + shade buttons.
6. `app/(shell)/app/branding/_lib/actions.ts` — Server Action accepts new fields.
7. `lib/email/branding-blocks.ts` — extend with gradient header block (see C.6).
8. All email senders importing `EmailBranding` interface (cancel/reschedule/reminder/confirmation/owner) — extend interface, callers pass new fields.
9. `app/[account]/[event-slug]/_lib/load-event-type.ts:30` — extend `accounts` SELECT.
10. `app/[account]/_lib/load-account-listing.ts` — extend SELECT.
11. `app/embed/[account]/[event-slug]/_lib/...` — extend SELECT.
12. RLS matrix test — verify second tenant cannot read first tenant's bg color (already covered by column-level RLS; new columns inherit existing accounts policy).
13. Render-harness test (Plan 08-08) — re-verify shell layout renders with gradient props.

### C.2 — CSS-vars bridge to gradient: inline `<style>` block + Tailwind v4 arbitrary values

The v1.0 pattern (line 45-48 of `app/_components/branded-page.tsx`) sets CSS vars via inline `style` attribute, then Tailwind classes reference them with `bg-[var(--brand-primary)]`. This pattern extends cleanly to gradients.

**v1.1 pattern:**

```tsx
// app/_components/branded-page.tsx (extended)
const style: CSSProperties = {
  ["--brand-primary" as never]: effective,
  ["--brand-text" as never]: textColor,
  ["--brand-bg-base" as never]: backgroundColor ?? "#FAFAFA",  // gray-50 fallback
  ["--brand-bg-shade" as never]: shadeToOpacity(backgroundShade), // "0.4" | "0.6" | "0.85"
};

return (
  <div
    style={style}
    className="min-h-screen bg-[linear-gradient(135deg,_var(--brand-bg-base)_0%,_color-mix(in_srgb,_var(--brand-bg-base)_calc(var(--brand-bg-shade)*100%),_white)_100%)]"
  >
    ...
  </div>
);
```

`color-mix()` is supported in all evergreen browsers (Chrome 111+, Safari 16.2+, Firefox 113+). For broader support OR cleaner syntax, fall back to a per-page inline `<style>` block:

```tsx
// Alternative: pure inline <style> for the gradient (works in any browser).
<style dangerouslySetInnerHTML={{ __html: `
  .v11-bg-${accountId} {
    background: linear-gradient(135deg, ${baseColor} 0%, ${mixWithWhite(baseColor, shadeOpacity)} 100%);
  }
`}} />
<div className={`v11-bg-${accountId} min-h-screen`}>...</div>
```

**Recommend: the `color-mix()` + Tailwind arbitrary value approach for the dashboard surfaces (modern browsers; owner audience).** Recommend the **inline `<style>` block approach for `/embed/*`** (third-party embed environments may include older browsers).

### C.3 — Tailwind v4 dynamic class problem: confirmed solved by inline CSS vars

Tailwind v4 purges classes at build time. Per-account dynamic colors CANNOT be in class strings (e.g., `bg-${color}` would not survive purge). The v1.0 pattern (CSS vars set via inline `style`, referenced via `bg-[var(--brand-primary)]` arbitrary values) sidesteps this entirely — the arbitrary-value class `bg-[var(--brand-primary)]` IS in the class string at build time, but the actual color is determined at render time by the CSS var. This pattern extends to gradients via `bg-[linear-gradient(...,_var(--brand-bg-base),...)]`.

**Confirmed extends to gradients.** The same arbitrary-value mechanism works for `linear-gradient(...)` expressions because Tailwind v4 emits arbitrary-value classes verbatim into the CSS bundle.

**Caveat:** Tailwind's JIT may not recognize the underscore-as-space convention inside complex `linear-gradient()`. Verify on first usage — fallback is to use plain `style={{ background: "linear-gradient(...)" }}` which always works.

### C.4 — Sidebar IA refactor: add Home + Profile, group Reminders + Profile under Settings

```
Sidebar IA (v1.1):

  ┌─────────────────────────┐
  │ NSI                     │  ← header (logo)
  ├─────────────────────────┤
  │ • Home (NEW)            │  ← lucide:Home, route /app/home
  │ • Event Types           │
  │ • Availability          │
  │ • Branding              │
  │ • Bookings              │
  ├─ Settings ──────────────┤  ← group label (already exists in v1.0)
  │ • Reminder Settings     │  ← already exists, route /app/settings/reminders
  │ • Profile (NEW)         │  ← lucide:UserCog, route /app/settings/profile
  ├─────────────────────────┤
  │ user@email.com          │
  │ • Log out               │
  └─────────────────────────┘
```

**Modified file:** `components/app-sidebar.tsx` lines 26-39 (NAV_ITEMS + SETTINGS_NAV_ITEMS). Add Home as the first NAV_ITEMS entry; add Profile as the second SETTINGS_NAV_ITEMS entry.

**New routes (Phase 12):**
- `app/(shell)/app/home/page.tsx` (Home — monthly calendar)
- `app/(shell)/app/settings/profile/page.tsx` (Profile — email, password change, account slug RO, default TZ)

### C.5 — Home tab (monthly calendar): Server Component shell + Client interaction

**Pattern:**

```
app/(shell)/app/home/
  page.tsx                       Server Component
                                 - Loads bookings for current viewable month
                                 - RLS-scoped client (createClient from @/lib/supabase/server)
                                 - Passes serialized bookings to <HomeCalendar />
  _components/
    home-calendar.tsx            "use client"
                                 - react-day-picker@9 (already installed, used in date-overrides)
                                 - DayContent slot renders booking-count badge
                                 - onDayClick → opens shadcn <Sheet> drawer
    day-bookings-drawer.tsx      "use client"
                                 - Sheet from "@/components/ui/sheet"
                                 - Lists day's bookings with click → /app/bookings/[id]
  _lib/
    load-month-bookings.ts       "import 'server-only'"
                                 - SELECT id, start_at, end_at, booker_name, status, event_type_id
                                   FROM bookings WHERE account_id = ? AND start_at BETWEEN ? AND ?
                                 - Group by local-date in account TZ (use TZDate)
```

**Why Server Component shell:** monthly view is RLS-scoped (owner-only); SSR avoids the auth handshake delay. Client component handles interaction (day-click → drawer), no fetch needed because data is already passed in.

**`react-day-picker@9` v.s. shadcn Calendar:** v1.0 already uses `react-day-picker@9` for the date-overrides UI (`app/(shell)/app/availability/_components/date-overrides-calendar.tsx` per the migration history). Reuse the same library.

### C.6 — Email branding overhaul: gradient header with VML fallback for Outlook

**Email-client gradient compatibility (caniemail.com checked, MEDIUM confidence — verify per-template smoke is part of Phase 12):**

| Client | `linear-gradient()` in CSS | VML `<v:rect>` fill |
|---|---|---|
| Gmail (web/mobile) | ✅ inline `style="background: linear-gradient(...)"` works | n/a |
| Apple Mail (macOS/iOS) | ✅ | n/a |
| Outlook desktop (Windows, mso-rendered) | ❌ Ignores `background:` gradients | ✅ Uses `<v:rect fill="gradient" .../>` |
| Outlook web (outlook.com) | ✅ | n/a |
| Outlook iOS/Android | ✅ (uses WebKit) | n/a |
| Yahoo Mail | ✅ | n/a |

**Recommended "safe gradient" pattern in `lib/email/branding-blocks.ts`:**

```typescript
// NEW v1.1 export
export function renderEmailHeroHeader(branding: EmailBranding & {
  background_color: string | null;
  background_shade: 'subtle' | 'medium' | 'vivid' | null;
}): string {
  const base = branding.background_color ?? "#F0F9FF";  // sky-50 default
  const lighter = mixWithWhite(base, shadeToOpacity(branding.background_shade));
  const gradient = `linear-gradient(135deg, ${base} 0%, ${lighter} 100%)`;

  // Outlook desktop fallback uses VML conditional comments
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding: 0; background: ${base};">
          <!--[if mso]>
          <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false"
                  style="width:600px;height:120px;">
            <v:fill type="gradient" color="${base}" color2="${lighter}" angle="135"/>
            <v:textbox inset="0,0,0,0">
          <![endif]-->
          <div style="background: ${gradient}; padding: 32px 16px; text-align: center;">
            ${branding.logo_url ? `<img src="${branding.logo_url}" alt="${escapeHtml(branding.name)} logo" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto;border:0;" />` : ''}
          </div>
          <!--[if mso]>
            </v:textbox>
          </v:rect>
          <![endif]-->
        </td>
      </tr>
    </table>`;
}
```

**Solid-color fallback:** the `<td style="background: ${base}">` outside the gradient `<div>` ensures clients that ignore both the gradient AND the VML still see the base color. No "broken email" state.

**Per-template branding smoke (FUTURE_DIRECTIONS.md item):** 6 surfaces × 4 clients = 24-cell matrix. Phase 12 should generate the rendered HTML via the `render-harness` (Plan 08-08) and visual-inspect a representative subset.

### C.7 — Embed dialog widening: `max-w-4xl` or `max-w-5xl`, NOT a shadcn size variant

**shadcn v4 Dialog has no built-in size variant.** Confirmed by reading `app/(shell)/app/event-types/_components/embed-code-dialog.tsx:33` — current value is `max-w-3xl` via `className` override on `<DialogContent>`.

**Recommended fix:** change to `max-w-5xl` (or `max-w-[1024px]` for explicit) to give the side-by-side `EmbedTabs` + iframe preview more room. Optionally, swap the inner `grid md:grid-cols-2` to `grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` so the iframe doesn't blow out on narrow content.

**One-line change:** `app/(shell)/app/event-types/_components/embed-code-dialog.tsx:33`. No new pattern, no shadcn upgrade needed.

### C.8 — Build order suggestion: **Phase 10 → 11 → 12 → 13 (CONFIRMED)**

| Phase | What | Why this order |
|---|---|---|
| **10. Multi-user signup** | First, because: (a) prerequisite `/auth/confirm` route fix is also a v1.0 BLOCKER for password-reset; (b) `RESERVED_SLUGS` consolidation in Phase 10 unblocks slug-picker AND simplifies Phase 12 Profile page; (c) Phase 11 capacity migration touches `event_types` schema — easier to land BEFORE the multi-user data-volume increases |
| **11. Capacity** | Second, because: (a) the prod double-booking bug exists TODAY and any new signups inherit the exposure; (b) capacity is a small, contained DB migration; (c) `/api/slots` + `/api/bookings` changes are well-scoped and the existing race-test infrastructure extends naturally |
| **12. Branded UI overhaul** | Third, because: (a) IA refactor needs the multi-user data shape (Profile page exists for users to manage themselves); (b) Home tab calendar reads bookings — capacity-aware empty/full visual cues might be valuable; (c) UI overhaul is the LARGEST surface, low-risk to land last, highest visual delta to QA |
| **13. Manual QA + sign-off** | Always last (CLAUDE.md mandate) |

**One alternative considered:** Phase 11 BEFORE Phase 10 (capacity-first because it's the prod bug). REJECTED because:
- Phase 10 unblocks the auth-callback v1.0 backlog item that Andrew has flagged.
- Andrew explicitly named multi-user as most urgent (PROJECT.md line 49).
- Phase 11 is mechanical; Phase 10 has more research surface (auth flows, RLS adjustments, onboarding UX) and benefits from going first while the team is fresh.

**Internal Phase 10 build order (suggested):**
1. `RESERVED_SLUGS` consolidation → `lib/reserved-slugs.ts` (3 callers updated).
2. `/auth/confirm` route + `/forgot-password` + `/app/reset-password` (fixes v1.0 callback 404 BLOCKER).
3. `accounts` INSERT RLS policy migration.
4. `/signup` page + Supabase email-template configuration in Dashboard.
5. `/onboarding` wizard (Step 1: account/slug → Step 2: availability → Step 3: first event type).
6. `provisionAccount` + `setDefaultAvailability` + `createFirstEventType` Server Actions.
7. `/app/page.tsx` redirect change (0 accounts → `/onboarding` instead of `/app/unlinked`).
8. RLS cross-tenant matrix test extension (multi-owner scenario).

**Internal Phase 11 build order:**
1. Migration: `max_bookings_per_slot` column on `event_types`.
2. Migration: drop `bookings_no_double_book`; create `bookings_capacity_count_idx` CONCURRENTLY; create `enforce_booking_capacity()` function + trigger.
3. `lib/slots.ts` capacity-aware `slotConfirmedCount` + `computeSlots` extension.
4. `/api/slots` route handler — pass `max_bookings_per_slot` into engine.
5. `/api/bookings` route — add 23P01 to the 409 SLOT_TAKEN branch.
6. `/app/event-types` form — capacity input field.
7. Vitest race tests (capacity=3/5, capacity=1 regression).

**Internal Phase 12 build order:**
1. `accounts` schema migration: `background_color`, `background_shade` columns.
2. Sidebar IA refactor (`components/app-sidebar.tsx`) — add Home + Profile.
3. `BrandingEditor` extension — color picker + shade buttons.
4. `BrandedPage` wrapper — gradient inline `<style>` injection.
5. `/app/home` Home tab — Server Component shell + react-day-picker calendar + Sheet drawer.
6. `/app/settings/profile` page — email RO, password change, account slug RO + edit.
7. `lib/email/branding-blocks.ts` — `renderEmailHeroHeader` with VML fallback.
8. Apply gradient header to all 6 email surfaces (booker confirm/cancel/reschedule + reminder + owner notification + reminder).
9. `embed-code-dialog.tsx` — `max-w-5xl` widen.
10. `/[account]` index + `/[account]/[event-slug]` + `/embed/*` — apply gradient backgrounds.

---

## Cross-cutting concerns

### Schema change → downstream consumer enumeration

| Schema change | Downstream consumers (every file that must update) |
|---|---|
| `event_types.max_bookings_per_slot` | `lib/slots.ts`, `lib/slots.types.ts`, `app/api/slots/route.ts`, `app/api/bookings/route.ts` (capacity error mapping; technically no SELECT needed but worth verifying), `app/(shell)/app/event-types/_lib/schema.ts` (Zod), `app/(shell)/app/event-types/_lib/actions.ts` (create/update), `app/(shell)/app/event-types/_components/event-type-form.tsx` (UI input), Vitest fixtures. |
| `accounts.background_color` + `background_shade` | `app/_components/branded-page.tsx`, `lib/email/branding-blocks.ts`, all email senders, `app/(shell)/app/branding/_lib/load-branding.ts`, `app/(shell)/app/branding/_lib/types.ts`, `app/(shell)/app/branding/_lib/actions.ts`, `app/(shell)/app/branding/_components/branding-editor.tsx`, `app/[account]/[event-slug]/_lib/load-event-type.ts`, `app/[account]/_lib/load-account-listing.ts`, `app/embed/[account]/[event-slug]/_lib/**`, RLS matrix test, render-harness test. |
| `accounts` INSERT RLS policy | `supabase/migrations/[ts]_accounts_insert_policy.sql`, `tests/rls-cross-tenant-matrix.test.ts` (extend), `app/onboarding/_lib/actions.ts` (can use RLS-scoped client). |
| `bookings_no_double_book` DROP + `enforce_booking_capacity` trigger | `tests/bookings-api.integration.test.ts` (race assertions), `tests/race-condition.test.ts` (whatever the v1.0 race test file is named), Phase 11 SUMMARY documentation. |

### Architectural blockers surfaced (early — flag for planners)

1. **`/auth/callback` 404 — v1.0 BLOCKER for password-reset, prerequisite for signup.** Phase 10 MUST land `/auth/confirm` route as Task 2 (after `RESERVED_SLUGS` consolidation). Already noted in PROJECT.md line 87.
2. **`accounts` has NO INSERT RLS policy.** v1.1 onboarding either adds one (recommended) or uses service-role admin client (4th call site, less reviewable). Surface this in Phase 10 plan-01.
3. **`bookings_no_double_book` partial unique index will be DROPPED.** Any prod traffic during the migration window has a sub-millisecond exposure. Document deploy order in Phase 11 plan-01.
4. **`accounts.slug` has no partial-unique-on-active.** Currently fine (no soft-delete); when v1.2 adds account deletion, the slug will need a partial unique index like event_types. Document in FUTURE_DIRECTIONS.md.
5. **`@supabase/ssr` PASSWORD_RECOVERY event handling** requires version `>= 0.4.1`. `package.json` shows `^0.10.2` ✅ — no upgrade needed.
6. **`pg_advisory_xact_lock` not available in Supabase Edge functions.** Confirmed available in regular Postgres 17.6.1 (the deployed version) — function is built-in, not a separate extension. HIGH confidence.
7. **Gmail SMTP throughput limit** (500 emails/day for personal Gmail). At 5+ accounts each with reminders, the daily volume could approach this. Not a v1.1 BLOCKER but a v1.2 trigger to revisit Resend/SendGrid. Document.
8. **Vercel Cron + multi-tenant scaling.** Reminder cron at `0 * * * *` scans all confirmed bookings — already scoped via existing index. Multi-tenant is fine at this scale (100s of bookings/hour processable in <1s). Flag for v1.2.

### Migration drift workaround (LOCKED — apply to all v1.1 migrations)

Per v1.0 lock: `npx supabase db push --linked` is broken (3 orphan timestamps in remote tracking table). Use ONE of:
- `npx supabase db query --linked -f supabase/migrations/<file>.sql`
- Supabase MCP `apply_migration` tool when available in the agent environment.

CLI-versioned migration files MUST still be committed under `supabase/migrations/` for portability. Document this in every Phase 10/11/12 plan that contains a migration task.

---

## Anti-patterns to avoid (v1.1-specific)

### Anti-pattern 1: provisioning `accounts` row inside an `auth.users` trigger

**What people do:** add `create trigger on_auth_user_created after insert on auth.users execute procedure provision_account()`.

**Why it's wrong:** trips the slug-picker UX (slug is unknown at signup); fragile coupling to Supabase-managed `auth` schema; failures inside the trigger surface as cryptic email-confirm errors.

**Do this instead:** Server Action in `/onboarding`. The orphan-user state (auth.users row, no accounts row) is handled by `/app/page.tsx` redirecting to `/onboarding` on `currentOwnerAccountIds.length === 0`.

### Anti-pattern 2: capacity counting via `select count(*)` without a lock

**What people do:** `before insert on bookings` trigger that does `select count(*) from bookings ...; if count >= cap raise`.

**Why it's wrong:** READ COMMITTED snapshot races. Two concurrent inserts can both see count=2, both pass `<3`, both commit → 4 confirmed bookings at capacity 3.

**Do this instead:** acquire `pg_advisory_xact_lock(event_type_id_hash, start_at_hash)` at the top of the trigger function. Auto-released at txn end. Serializes ONLY same-slot races, not all bookings.

### Anti-pattern 3: dynamic Tailwind class strings for per-account colors

**What people do:** `bg-${account.brandPrimary.replace('#','')}` or `bg-[${color}]` with the variable interpolated at render.

**Why it's wrong:** Tailwind v4 purges classes at build time. The class isn't in the bundle; runtime reference fails silently.

**Do this instead:** inline CSS vars + arbitrary-value Tailwind class. `style={{ "--brand-primary": color }} className="bg-[var(--brand-primary)]"`. The arbitrary-value class IS in the bundle; the var is resolved at render time.

### Anti-pattern 4: gradient backgrounds in transactional emails without VML fallback

**What people do:** `<div style="background: linear-gradient(...)">` in the email template.

**Why it's wrong:** Outlook desktop on Windows ignores CSS gradient. ~25% of business email clients render a gradient-less, broken-looking header.

**Do this instead:** the dual-track pattern in C.6 — solid color on the outer `<td>`, CSS gradient on the inner `<div>`, VML `<v:rect>` fill in MSO conditional comments.

### Anti-pattern 5: storing branding tokens as JSONB

**What people do:** `accounts.branding_tokens jsonb default '{}'`.

**Why it's wrong:** v1.1 has a known shape (background_color + background_shade). JSONB loses type-safety, blocks CHECK constraints, requires any-typed reads in TS.

**Do this instead:** typed columns with CHECK constraints. JSONB is for unknown-shape (custom_questions on event_types is correctly JSONB).

---

## Sources

- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — verifyOtp pattern for `/auth/confirm` route handling signup + recovery + invite types.
- [PKCE flow | Supabase Docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow) — PKCE is the default flow for `@supabase/ssr` ≥ 0.4.1.
- [Triggers to enforce constraints (Cybertec)](https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/) — confirms naïve count-in-trigger races under READ COMMITTED.
- [PostgreSQL 18 docs §13.3.5 Explicit Locking — Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html) — `pg_advisory_xact_lock` semantics.
- [Using PostgreSQL advisory locks to control concurrency (Kostolansky)](https://www.kostolansky.sk/posts/postgresql-advisory-locks/) — practical patterns for capacity-style constraints.
- v1.0 shipped code (HIGH confidence inputs):
  - `proxy.ts` lines 12-25 — CSP/XFO ownership rule
  - `lib/supabase/proxy.ts` lines 19-58 — `@supabase/ssr` cookie pattern
  - `app/api/bookings/route.ts` lines 178-216 — 23505 → 409 SLOT_TAKEN branch
  - `app/api/slots/route.ts` lines 86-145 — slot computation contract
  - `lib/slots.ts` lines 186-202 — buffer-overlap function (extension point for capacity)
  - `supabase/migrations/20260419120000_initial_schema.sql` line 16 — `accounts.slug unique not null`
  - `supabase/migrations/20260419120001_rls_policies.sql` lines 9-30 — `current_owner_account_ids()` + accounts policies (no INSERT)
  - `app/_components/branded-page.tsx` lines 45-69 — CSS-vars pattern (extension point for gradient)
  - `lib/email/branding-blocks.ts` — email-block extension surface
  - `components/app-sidebar.tsx` lines 26-39 — sidebar IA extension surface
- v1.0 backlog (`FUTURE_DIRECTIONS.md`, `STATE.md`) — `/auth/callback` 404 + `RESERVED_SLUGS` duplication + migration drift workaround.

---

*Architecture research for: v1.1 — multi-user signup + capacity + branded UI overhaul*
*Researched: 2026-04-27*
