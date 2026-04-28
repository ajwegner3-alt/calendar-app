# Technology Stack — v1.1

**Project:** calendar-app (multi-tenant Calendly-style booking tool)
**Milestone:** v1.1 — multi-user signup + capacity-aware booking + branded UI overhaul
**Researched:** 2026-04-27
**Overall confidence:** MEDIUM-HIGH (versions MEDIUM; integration patterns HIGH)
**Supersedes:** the v1.0 STACK.md doc-set for these three feature areas only — v1.0 stack remains the foundation.

> **Scope note.** This file ONLY documents stack additions/changes for v1.1's three new capability areas. The full v1.0 stack (Next 16, React 19, Supabase, `@supabase/ssr`, date-fns v4 + `@date-fns/tz`, Tailwind v4 + shadcn v4, vendored `@nsi/email-sender`, Cloudflare Turnstile, `ical-generator@10`, Vitest + RHF + Zod, etc.) is locked. Cross-references back to v1.0 patterns appear inline.
>
> **Version verification note.** Versions below are taken from `package.json` (current installed) where possible, plus 2026-04 WebSearch for libraries not yet installed. Bash `npm view` was unavailable in this research session — version pins flagged MEDIUM should be re-verified with `npm view <pkg> version` at install time before locking. *Library choice* is HIGH confidence; *version number* is MEDIUM where flagged.

---

## A. Multi-User Signup + Onboarding (Phase 10)

### A.1 Recommended additions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/ssr` | ^0.10.2 (already installed) | Cookie-based session, **plus** the `auth/confirm` route handler — works unchanged with Next 16 App Router and React 19 | Already shipped in v1.0; v1.1 adds new routes built on the same client. **Confidence: HIGH** (current install). The `0.10` line added cache-header pass-through on token refresh — relevant for Next 16's aggressive caching. |
| `@supabase/supabase-js` | ^2.103.1 (already installed) | Auth method calls (`signUp`, `signInWithPassword`, `verifyOtp`, `resend`, `resetPasswordForEmail`) | Already shipped. v1.1 reuses; no upgrade required. **Confidence: HIGH.** |
| Postgres trigger (no new dependency) | n/a | Auto-provision `accounts` row + default `availability_rules` on `auth.users` insert | See A.3 — recommended over Server Action approach. **Confidence: HIGH.** |
| `lib/reserved-slugs.ts` (new internal module) | n/a | Single export of `RESERVED_SLUGS` — fixes the v1.0 dup-across-2-files debt | The v1.1 slug picker is the THIRD consumer; deduping is now a hard prerequisite. **Confidence: HIGH.** |

### A.2 Canonical `@supabase/ssr` + Next 16 signup flow with email confirmation

**Decision: use the `auth/confirm` token-hash pattern, NOT the legacy `auth/callback` exchange-code-for-session pattern.**

Per the [official Supabase guide](https://supabase.com/docs/guides/auth/server-side/nextjs) (which the search confirmed was updated within the last day of this research), the modern `@supabase/ssr` pattern for email-confirmation flows is:

1. **Configure the email template** in Supabase Dashboard → Authentication → Email Templates → "Confirm signup":
   ```
   Change `{{ .ConfirmationURL }}` →  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app/welcome`
   ```
2. **Build a Route Handler at `app/auth/confirm/route.ts`:**
   ```ts
   import { type EmailOtpType } from "@supabase/supabase-js";
   import { type NextRequest } from "next/server";
   import { redirect } from "next/navigation";
   import { createClient } from "@/lib/supabase/server"; // existing v1.0 SSR client

   export async function GET(request: NextRequest) {
     const { searchParams } = new URL(request.url);
     const token_hash = searchParams.get("token_hash");
     const type = searchParams.get("type") as EmailOtpType | null;
     const next = searchParams.get("next") ?? "/app";

     if (token_hash && type) {
       const supabase = await createClient(); // Next 16 async cookies
       const { error } = await supabase.auth.verifyOtp({ type, token_hash });
       if (!error) redirect(next);
     }
     redirect("/auth/auth-error");
   }
   ```

**Why this pattern (and not `auth/callback` with `exchangeCodeForSession`)?**
- The `token_hash` flow is the current canonical Supabase pattern for **all** email-bourne types: signup confirm, password recovery, magic link, email change. One route handles all four.
- The `exchangeCodeForSession` pattern (the v1.0 BLOCKER which 404s) was the OAuth/PKCE pattern. If/when v1.1+ adds Google OAuth signup, add a SECOND route at `app/auth/callback/route.ts` for OAuth specifically. Don't conflate them.
- Confidence: **HIGH** — confirmed against the live Supabase docs page in this research session.

**Concrete v1.1 routes to ship in Phase 10:**

| Route | Purpose | Method |
|-------|---------|--------|
| `app/signup/page.tsx` | Public signup form (email/password) | calls `supabase.auth.signUp({...})` from Server Action |
| `app/login/page.tsx` | Existing (v1.0); minor copy update | unchanged |
| `app/auth/confirm/route.ts` | **Token-hash verifier (canonical)** | GET — handles signup, recovery, email_change, invite |
| `app/auth/auth-error/page.tsx` | Friendly fallback when token invalid/expired | static |
| `app/forgot-password/page.tsx` | Calls `resetPasswordForEmail(email, { redirectTo: "/auth/confirm?next=/account/update-password" })` | Server Action |
| `app/account/update-password/page.tsx` | Set new password (only reachable post-recovery via verified session) | Server Action calling `supabase.auth.updateUser({ password })` |
| `app/onboarding/welcome/page.tsx` | First-login wizard step 1 (slug picker) | RHF + Server Action |
| `app/onboarding/availability/page.tsx` | First-login wizard step 2 (default hours) | RHF + Server Action |

**Email-confirmation toggle:** Andrew must re-enable email-confirmation in Supabase Dashboard → Authentication → Settings → "Confirm email" BEFORE Phase 10 first deploy. Document this in Phase 10 prereqs.

### A.3 Account auto-provisioning: Postgres trigger (recommended) vs Server Action

**Decision: Postgres trigger fired on `auth.users` insert.**

| Approach | Verdict | Reasoning |
|----------|---------|-----------|
| **Postgres trigger** (`on auth.users insert → public.handle_new_user()`) | **CHOSEN** | Atomic with the user creation. Cannot drift if Server Action redirect fails / user closes tab during onboarding. Standard Supabase pattern, in their own docs. Survives partial failures (verification email goes out before /onboarding ever loads → trigger has already run; user can resume from any device). Plays well with v1.0's two-stage owner-auth pattern (the trigger establishes the `accounts.id ↔ auth.users.id` link that `getOwnerAccountIdOrThrow()` reads). |
| Server Action after `/auth/confirm` redirect | Avoid | Race window: user verifies → JS fails / tab closes / redirect target 404s → orphan auth.users row with no accounts record. Dashboards then crash on the two-stage pattern. Recoverable but ugly support burden. |
| Webhook to `/api/auth-hooks/new-user` | Avoid for v1.1 | Adds Vercel-cold-start latency to signup flow + requires HMAC verification. Postgres trigger gives same outcome with lower complexity. Reconsider in v1.2 if trigger logic needs to call external services. |

**Trigger sketch (Phase 10 will refine):**

```sql
-- Default availability inserted into v1.0's existing account_availability_settings + availability_rules tables.
-- Default rules: M-F 9am-5pm in account TZ; weekends closed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_default_slug text;
begin
  -- Generate a placeholder slug from email local-part (user picks final slug in onboarding wizard).
  v_default_slug := 'pending-' || substring(new.id::text from 1 for 8);

  insert into public.accounts (
    owner_user_id,
    owner_email,
    name,
    slug,
    timezone,
    onboarding_complete  -- new column, default false
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    v_default_slug,
    'America/Chicago',  -- placeholder; user picks in onboarding
    false
  )
  returning id into v_account_id;

  -- Default Mon-Fri 9-5 weekly availability
  insert into public.availability_rules (account_id, weekday, start_time, end_time)
  select v_account_id, weekday, '09:00'::time, '17:00'::time
  from generate_series(1, 5) as weekday;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Critical migration constraint.** `onboarding_complete boolean default false` and a NULLABLE `slug` (or "pending-" placeholder pattern) are required because the trigger fires BEFORE the user picks their real slug. The slug-picker Server Action in `/onboarding/welcome` UPDATEs the row with the chosen slug + flips `onboarding_complete=true`.

Apply via `npx supabase db query --linked -f <migration>` per locked workaround.

Confidence: **HIGH.**

### A.4 Slug picker UX + validation

**RESERVED_SLUGS dedup (CRITICAL v1.1 prereq).** v1.0 has the set duplicated in 2 files. Phase 10 MUST extract to a single module before adding the slug picker as the 3rd consumer:

```ts
// lib/reserved-slugs.ts (NEW; replaces inline duplicates in load-event-type.ts + load-account-listing.ts)
export const RESERVED_SLUGS = new Set([
  "app", "api", "_next", "auth", "embed",
  // v1.1 additions for new auth surface:
  "signup", "login", "logout", "forgot-password", "account",
  "onboarding", "billing",  // billing is forward-compat for v1.2
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
```

Update both v1.0 callers + the new slug-picker Server Action to import from this module. `tsc --noEmit` should fail if any file still has a hand-coded RESERVED_SLUGS literal — add a regex grep test in `tests/reserved-slugs-singleton.test.ts`.

**Validation rules for the slug picker (Server Action):**

```ts
import { z } from "zod";
import { isReservedSlug } from "@/lib/reserved-slugs";

const slugSchema = z
  .string()
  .min(3, "Slug must be at least 3 characters")
  .max(40, "Slug must be 40 characters or fewer")
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, numbers, and dashes only")
  .refine((s) => !isReservedSlug(s), "This slug is reserved")
  .refine(async (s) => {
    // Service-role check: no other ACTIVE account has this slug.
    // accounts row is soft-deletable in v1.0 schema, so filter to status='active'.
    const { data } = await admin.from("accounts").select("id").eq("slug", s).eq("status", "active").maybeSingle();
    return !data;
  }, "Slug is taken");
```

Use **`use-debounce@10.1.1` (already installed v1.0)** for the typeahead "checking..." UX. RHF's `mode: "onChange"` + 300ms debounce + Server Action availability probe.

Confidence: **HIGH** — Zod async refine is standard; v1.0 already uses it.

### A.5 First-login wizard

**Decision: pure RHF + Server Actions + simple step-state in URL — NO state-machine library.**

| Approach | Verdict | Reasoning |
|----------|---------|-----------|
| **RHF per-step, route-segment-based wizard** (`/onboarding/welcome` → `/onboarding/availability` → `/app`) | **CHOSEN** | Server-side checkpoint per step (DB write); state survives reload/back-button; no client state machine to debug. Each segment is a Server Component shell + RHF client island. v1.0 already has this pattern (event-type-form, branding editor). |
| `xstate` + `@xstate/react` | Avoid for v1.1 | Overkill for 2-3 steps. Adds ~12 KB gzip. Reconsider when wizard hits 5+ steps with conditional branches. |
| shadcn Stepper component | shadcn v4 ships no official `<Stepper>` (verified Apr 2026). | Build a 30-line `<StepIndicator step={1} of={3} />` from radix-ui primitives if visual stepper is wanted. Or just a `<Progress />` bar (shadcn ships this — already part of radix-nova). |
| Radix Tabs | Avoid for wizard | Tabs are for parallel views, not sequential steps. Mis-semantic for screen readers. |

**Routing pattern:**
```
app/onboarding/
  layout.tsx           // shared chrome; reads onboarding_complete; redirects to /app if already done
  welcome/page.tsx     // step 1 — slug picker + display name
  availability/page.tsx // step 2 — timezone + default hours
  done/page.tsx        // brief success → redirect /app
```

The `layout.tsx` enforces the wizard sequence by reading `accounts.onboarding_complete` + `accounts.slug` (still "pending-..."?) from the v1.0 RLS-scoped client. No client state needed.

Confidence: **HIGH.**

### A.6 Password reset flow

Currently broken because `/auth/callback` 404s. v1.1 fixes by:

1. `/forgot-password` Server Action calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${siteUrl}/auth/confirm?next=/account/update-password\` })`.
2. User clicks email link → `/auth/confirm` Route Handler verifies the recovery token via `verifyOtp({ type: "recovery", token_hash })` → redirects to `/account/update-password` with a verified session.
3. `/account/update-password` is a server-rendered form that calls `supabase.auth.updateUser({ password })` from a Server Action.

This pattern reuses the **same** `/auth/confirm` route as signup — no separate `/auth/callback` is needed. Confidence: **HIGH.**

---

## B. Capacity-Aware Booking (Phase 11)

### B.1 Recommended additions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Postgres trigger function (no new dependency) | n/a | Capacity enforcement: replaces partial unique index | Partial unique index can't express "max N rows per slot" — it can only express "max 1." Trigger is the only viable Postgres-native pattern that handles N>=1 atomically. **Confidence: HIGH.** |
| `event_types.max_bookings_per_slot int not null default 1` | n/a | Per-event-type capacity setting | Owner-toggleable; default preserves v1.0 single-capacity behavior (no migration of existing rows needed beyond the column add). |
| Vitest race-test (no new dependency) | n/a | Concurrency proof: capacity=N → exactly N succeed under K parallel inserts | Mirrors v1.0's existing race test (`bookings.race.test.ts`) which proved the partial unique index. |

### B.2 Capacity DB pattern: trigger function (recommended) vs alternatives

**Decision: trigger function with an explicit count + `serializable` isolation OR `for update` row-locking.**

The v1.0 partial unique index `bookings_no_double_book on (event_type_id, start_at) where status='confirmed'` enforces 1-per-slot at the index level. It **cannot** extend to N-per-slot. Three alternatives evaluated:

| Pattern | Verdict | Why |
|---------|---------|-----|
| **`before insert` trigger that counts existing confirmed bookings + raises if would exceed `event_types.max_bookings_per_slot`** | **CHOSEN** | Postgres-native; runs in same txn as the insert; works with any client (route handler, Server Action, future webhook); no app-layer race window. Locks via `select ... for update` on `event_types` row to serialize counts. |
| `EXCLUDE` constraint with `gist` + range overlap | Avoid | EXCLUDE constraints enforce "no two rows match" — they don't natively express "no MORE than N rows match." Would need a synthetic "slot number" column populated client-side, which leaks the race back to app layer. |
| Application-layer count + insert | Avoid | Race window between count and insert; the very bug v1.0 architecture rejects (RESEARCH Pitfall 1). |
| Materialized view + check constraint | Avoid | MV refresh is async — cannot enforce on insert. |
| Postgres advisory lock around bookings.insert (`pg_advisory_xact_lock(event_type_id, start_at_unix)`) | Acceptable fallback | Works but couples lock semantics across all callers; trigger is more declarative. |

**Trigger sketch (Phase 11 will refine):**

```sql
-- Step 1: extend event_types with capacity
alter table event_types
  add column max_bookings_per_slot int not null default 1
  check (max_bookings_per_slot >= 1 and max_bookings_per_slot <= 100);

-- Step 2: trigger function
create or replace function enforce_booking_capacity()
returns trigger
language plpgsql
as $$
declare
  v_capacity int;
  v_current_count int;
begin
  -- Only check on confirmed inserts (cancelled/pending don't consume capacity)
  if new.status <> 'confirmed' then
    return new;
  end if;

  -- Lock the event_types row to serialize concurrent inserts hitting the same slot.
  -- This is the single point of race-safety; Postgres MVCC + row lock guarantees
  -- count + insert see a consistent snapshot per concurrent transaction.
  select max_bookings_per_slot into v_capacity
  from event_types
  where id = new.event_type_id
  for update;

  if v_capacity is null then
    raise exception 'event_type % not found', new.event_type_id;
  end if;

  select count(*) into v_current_count
  from bookings
  where event_type_id = new.event_type_id
    and start_at = new.start_at
    and status = 'confirmed'
    and id <> new.id;

  if v_current_count >= v_capacity then
    -- SQLSTATE 23505 mirrors the partial-unique-index error code v1.0 already
    -- handles in /api/bookings (turns into HTTP 409). Re-using it means
    -- existing race-loser UX needs no changes.
    raise exception 'capacity exceeded for event_type % at %', new.event_type_id, new.start_at
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger bookings_capacity_check
  before insert on bookings
  for each row execute function enforce_booking_capacity();
```

**Migration path: drop the partial unique index, replace with trigger.**

```sql
-- Step 3: drop the v1.0 single-capacity index
drop index if exists bookings_no_double_book;

-- (The trigger above already enforces the same invariant for capacity=1 rows,
-- so no functional regression for existing event types.)
```

⚠️ **CRITICAL deploy ordering** — drop the index in the SAME migration as the trigger creation. A window where neither is active = double-booking exposure for new accounts. Apply via `supabase db query --linked -f` (locked workaround).

Confidence: **HIGH.** Pattern is the canonical "row-locked count-then-insert" Postgres trigger; it's what reservation systems do when capacity > 1.

### B.3 Race test pattern (Vitest)

Mirror v1.0's existing race test. Pseudo-code:

```ts
// tests/bookings/capacity-race.test.ts
it("capacity=3 + 10 concurrent submits → exactly 3 succeed", async () => {
  // Arrange: an event_type with max_bookings_per_slot = 3 in a fresh test schema
  const eventType = await seed.eventType({ max_bookings_per_slot: 3 });
  const slot = "2026-06-01T15:00:00Z";

  // Act: fire 10 concurrent inserts via Promise.allSettled — important to use
  // separate supabase clients (or raw pg pool connections) so they hit different
  // backend connections and actually race.
  const promises = Array.from({ length: 10 }, () =>
    insertBookingDirect({ event_type_id: eventType.id, start_at: slot })
  );
  const results = await Promise.allSettled(promises);

  // Assert
  const succeeded = results.filter(r => r.status === "fulfilled");
  const failed = results.filter(r => r.status === "rejected");
  expect(succeeded).toHaveLength(3);
  expect(failed).toHaveLength(7);
  // All failures should carry the 23505 code path (mirrors v1.0 race-loser flow).
  failed.forEach(r => {
    expect((r as PromiseRejectedResult).reason.code).toBe("23505");
  });

  // DB state should reflect exactly 3 confirmed
  const { count } = await admin
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("event_type_id", eventType.id)
    .eq("start_at", slot)
    .eq("status", "confirmed");
  expect(count).toBe(3);
});
```

Run multiple iterations (`describe.each([3, 5, 10])`) and clean up with `truncate ... cascade` between cases. Confidence: **HIGH.**

### B.4 Slot API + booking API integration

The /api/slots endpoint already returns "remaining capacity" implicitly (a slot is "available" if not fully booked). With capacity > 1:

```ts
// lib/availability/compute-slots.ts (modify existing v1.0 module)
// For each candidate slot, return remaining capacity:
//   const remaining = max_bookings_per_slot - confirmed_count_at(slot);
//   slot.available = remaining > 0;
//   slot.remaining = remaining;  // optional: expose to UI for "2 spots left" copy
```

The /api/bookings 409 handler in v1.0 (race-loser inline-banner UX) keeps its exact behavior — the trigger raises 23505 just like the unique index did. Confidence: **HIGH.**

---

## C. Branded UI Overhaul (Phase 12)

### C.1 Recommended additions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Inter font via `next/font/google` | n/a (Next 16 built-in) | Primary typography per Cruip Simple Light | Zero runtime cost; SSR-friendly; preload + display-swap built in. **Confidence: HIGH.** |
| `aos` | ^3.0.0-beta.6 | Scroll-trigger animations on dashboard surfaces | Skill spec'd lib. **Optional** — can ship surfaces without scroll animations and add per-page later. **Confidence: MEDIUM** (verify version + Next 16 hydration story before locking; AOS uses `IntersectionObserver` and assumes a browser env, so client-only `'use client'` boundary required). |
| `react-day-picker` | ^9.14.0 (already installed) | Monthly calendar view on Home tab — extend, don't replace | Already installed for date-overrides. v9 supports `numberOfMonths`, `fixedWeeks`, custom day cells via `components.Day` — sufficient for click-day → drawer pattern. **Confidence: HIGH** (verified per daypicker.dev docs in this research session). |
| `radix-ui` Dialog/Sheet | ^1.4.3 (already installed) | Day-detail drawer on Home tab; embed-snippet dialog widening | Already installed. shadcn v4 Dialog has no built-in size variants — width is overridden via Tailwind class on `<DialogContent>`. **Confidence: HIGH.** |
| `accounts.background_color text` + `accounts.background_shade text` | n/a | Per-account gradient tokens | See C.3 for data-model recommendation. **Confidence: HIGH.** |

**Anti-recommendation: do NOT add `@fullcalendar/react`** (~150 KB gzipped, brings its own CSS layer that fights Tailwind v4, weak SSR story). react-day-picker v9 + a custom `components.Day` cell that renders a booking-count badge is 1/10 the bundle size and stays in the v1.0 dependency graph.

### C.2 Bridging per-account dynamic colors with Tailwind v4 static classes

**The problem.** Tailwind v4 generates CSS classes at build time from source-scanned class strings. Per-account `brand_primary` / `background_color` are runtime DB values. Tailwind cannot generate `bg-[#FF5733]` for a hex it has never seen.

**Solution (already proven in v1.0): inline CSS variables on a wrapping element + `var(--brand-primary)` in inline `style` props.** This pattern is in production at `app/_components/branded-page.tsx`. v1.1 extends the same pattern with two new variables.

**v1.1 BrandedPage extension:**

```tsx
// app/_components/branded-page.tsx (extension of v1.0)
const style: CSSProperties = {
  ["--brand-primary" as never]: effective,
  ["--brand-text" as never]: textColor,
  // NEW v1.1 vars:
  ["--brand-bg" as never]: backgroundColor ?? "#F9FAFB",       // Tailwind gray-50 default
  ["--brand-bg-shade" as never]: shadeToOpacity(shade),         // 0..1 for gradient stop
  // Pre-computed gradient string (avoids inline expression in JSX):
  ["--brand-bg-gradient" as never]:
    `linear-gradient(135deg, ${backgroundColor ?? "#F9FAFB"} 0%, ` +
    `color-mix(in oklab, ${backgroundColor ?? "#F9FAFB"} ${100 - shadePct}%, ${effective} ${shadePct}%) 100%)`,
};
```

Then in components, consume via `style={{ background: "var(--brand-bg-gradient)" }}`. This works because:
1. The CSS variable is set on a parent DOM node at render time.
2. Inline `style` does not require Tailwind compilation.
3. `color-mix(in oklab, ...)` is supported by every browser since 2023; produces perceptually-uniform gradients (better than naive RGB interpolation, which yields muddy mid-tones).

**Helper module to add (new):**
```ts
// lib/branding/gradient.ts
export type BackgroundShade = "subtle" | "medium" | "strong";

const SHADE_PERCENT: Record<BackgroundShade, number> = {
  subtle: 8,   // 8% mix toward primary
  medium: 18,
  strong: 32,
};

export function shadePct(shade: BackgroundShade | null): number {
  return SHADE_PERCENT[shade ?? "subtle"];
}

export function brandGradient(bgColor: string | null, primary: string | null, shade: BackgroundShade | null): string {
  const bg = bgColor ?? "#F9FAFB";
  const accent = primary ?? "#0A2540";
  const pct = shadePct(shade);
  return `linear-gradient(135deg, ${bg} 0%, color-mix(in oklab, ${bg} ${100 - pct}%, ${accent} ${pct}%) 100%)`;
}
```

Confidence: **HIGH** — extension of an already-shipped v1.0 pattern.

### C.3 Per-account branding data model: enum vs numeric vs named scale

**Decision: enum (`subtle` | `medium` | `strong`) stored as Postgres `text` with a CHECK constraint.**

| Model | Verdict | Why |
|-------|---------|-----|
| **Enum text: `subtle` / `medium` / `strong`** | **CHOSEN** | Self-documenting in DB queries; UI is a 3-button radio (Andrew already loves this UX in shadcn radio-group); easier to extend (add `none` later for flat-color accounts); locks the design surface — owners can't pick "73%" and produce ugly results. |
| Numeric 0-100 | Avoid | Slider UX is fiddly on mobile; values 5/15/25/50 produce wildly different aesthetics → support burden. Andrew flagged Cruip Simple Light as the target — a 3-step ladder matches its "clean by default" feel. |
| Named scale (`light`, `medium`, `bold`, `vivid`) | Avoid | More options = more bad-looking accounts. 3 is the sweet spot. |
| Postgres native `enum` type | Avoid | Postgres enums are PITA to alter (add value requires `alter type`). Text + check constraint is more flexible. |

**Migration:**

```sql
alter table accounts
  add column background_color text check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  add column background_shade text check (background_shade in ('subtle', 'medium', 'strong'));
-- Both nullable; null = use defaults (gray-50 + subtle).
```

Existing rows get NULL for both → fall back to gray-50 base + subtle gradient (Cruip default look). No data backfill needed.

Confidence: **HIGH.**

### C.4 Monthly calendar view for Home tab — extend `react-day-picker` (NOT new lib)

**Decision: react-day-picker v9 with `numberOfMonths={1}`, `fixedWeeks`, custom `components.Day` cell, and a separate `<Sheet>` (drawer) for day detail.**

```tsx
// app/(shell)/app/page.tsx (Home tab — new for v1.1)
"use client";
import { DayPicker } from "react-day-picker";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export function HomeCalendar({ bookingsByDate }: Props) {
  const [openDate, setOpenDate] = useState<Date | null>(null);

  return (
    <>
      <DayPicker
        mode="single"
        fixedWeeks
        showOutsideDays
        onSelect={(d) => d && setOpenDate(d)}
        components={{
          Day: (props) => {
            const dateKey = format(props.date, "yyyy-MM-dd");
            const count = bookingsByDate[dateKey]?.length ?? 0;
            return (
              <button onClick={() => setOpenDate(props.date)} className="...">
                <span>{props.date.getDate()}</span>
                {count > 0 && <Badge variant="secondary">{count}</Badge>}
              </button>
            );
          },
        }}
      />
      <Sheet open={!!openDate} onOpenChange={(o) => !o && setOpenDate(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {openDate && <DayBookingsList date={openDate} bookings={bookingsByDate[format(openDate, "yyyy-MM-dd")] ?? []} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
```

Confidence: **HIGH** — verified pattern against react-day-picker v9 docs.

**Anti-recommendations:**
- ❌ `@fullcalendar/react` — bundle bloat + CSS conflict; see C.1.
- ❌ Custom date grid hand-rolled with `date-fns` + CSS Grid — would work but is ~200 LOC of date math we'd have to test (DST, weeks-spanning-months) when v1.0 already pays for `react-day-picker` and has tests for it.
- ❌ shadcn `<Calendar>` (which wraps day-picker) for the dashboard — `<Calendar>` is built for date-pickers (single-date pick UX). The Home tab wants a viewing-grid UX with badges. Use `react-day-picker` directly for the Home tab; keep shadcn `<Calendar>` for date-overrides + booking-page (where v1.0 uses it).

### C.5 Embed snippet dialog widening — shadcn v4 Dialog pattern

**There are no built-in size variants in shadcn v4 Dialog.** Width is overridden via Tailwind class on `<DialogContent>`:

```tsx
<DialogContent className="sm:max-w-2xl">  {/* up from default sm:max-w-lg */}
  <DialogHeader>
    <DialogTitle>Embed snippet</DialogTitle>
  </DialogHeader>
  <pre className="overflow-x-auto whitespace-pre-wrap text-xs ...">
    {snippet}
  </pre>
  <DialogFooter>
    <Button onClick={copy}>Copy</Button>
  </DialogFooter>
</DialogContent>
```

For v1.1's embed-snippet dialog (currently overlapping content per FUTURE_DIRECTIONS.md), recommended widths: `sm:max-w-2xl` (~672px) for the script tag; `sm:max-w-3xl` (~768px) if also showing the iframe-only fallback snippet. Confidence: **HIGH.**

If Andrew finds himself needing variants in 3+ places, extract a `cva` (class-variance-authority — already installed) variant config into `components/ui/dialog.tsx` once. Don't pre-extract for one consumer.

### C.6 Email branding: gradient compatibility (Apple Mail / Gmail / Outlook)

**Decision: keep solid colors in emails. Skip CSS gradient backgrounds in v1.1 emails.**

[Can I email — linear-gradient()](https://www.caniemail.com/features/css-linear-gradient/) confirms (verified in this research session):
- ✅ Apple Mail (Mac + iOS): full support
- ⚠️ Gmail: partial support (rewrites + breaks on Android Gmail per [hteumeuleu/email-bugs#135](https://github.com/hteumeuleu/email-bugs/issues/135))
- ❌ Outlook (desktop, web, mobile): zero support
- ❌ Yahoo Mail: zero support

For an audience that includes contractors' customers (likely heavy Outlook usage in trades sales pipelines), shipping `linear-gradient` in email = visible "ugly fallback" in 30-50% of inboxes.

**Recommended pattern.** The existing `lib/email/branding-blocks.ts` solid-color pattern extends naturally:

```ts
// branded heading uses solid primary color (existing)
return `color:${color};font-size:22px;font-weight:600;margin:0 0 16px 0;`;

// For v1.1, if Andrew wants a "header band," use solid color matching brand_primary,
// NOT a gradient. Apple Mail rendering parity with Gmail/Outlook = pick the lowest
// common denominator at render time.
```

If a gradient is non-negotiable later (v1.2+), the [Maizzle gradient pattern](https://maizzle.com/guides/gradients) using VML fallback for Outlook is the standard escape hatch — don't reinvent. For v1.1, **explicit decision: solid colors only in emails; gradients live in web surfaces only.**

Document in Phase 12 plan as a constraint. Confidence: **HIGH.**

### C.7 Inter font integration

```tsx
// app/layout.tsx (modify existing root layout)
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
      <body className="bg-gray-50 font-inter tracking-tight text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

Update `app/globals.css` `@theme` block to include:
```css
@theme {
  --font-sans: var(--font-inter), -apple-system, BlinkMacSystemFont, ...;
  --font-inter: var(--font-inter);
}
```

Confidence: **HIGH** — Next 16 next/font is unchanged from Next 15.

---

## Cumulative Installation (delta from v1.0)

```bash
# v1.0 packages already installed — no upgrade required for v1.1.

# OPTIONAL v1.1 addition (only if AOS scroll animations are scoped into Phase 12):
npm install aos @types/aos

# Verify versions before locking:
npm view aos version
npm view @types/aos version
npm view @supabase/ssr version  # confirm 0.10.x line still current
npm view react-day-picker version  # confirm 9.x still current
```

**Zero new packages for Phases 10 + 11.** All needed primitives (`@supabase/ssr`, supabase-js, RHF, Zod, radix-ui, react-day-picker, sonner) are installed v1.0.

**Phase 12 may add 1 dep (`aos`) IF scroll animations are scoped in.** Even then, AOS is conditionally usable per-route — pages without scroll animations import nothing.

---

## Alternatives Considered

| Decision Point | Recommended | Alternative | Why Not Alternative |
|----------------|-------------|-------------|---------------------|
| Auth flow (signup confirm + reset) | Single `/auth/confirm` token-hash route | Separate `/auth/callback` exchange-code route per flow | Modern Supabase guidance is unified token-hash; legacy callback only needed for OAuth (deferred to v1.2) |
| Account auto-provision | Postgres trigger | Server Action after redirect | Trigger is atomic with auth.users insert; no orphan-row failure mode |
| Wizard state | Route-segment per step + RHF + Server Action checkpoint | xstate or other client state machine | Overkill for 2-3 steps; URL-driven step state survives reload |
| Capacity enforcement | Trigger + row-locked count | EXCLUDE constraint, advisory lock, app-layer check | Trigger is the only declarative Postgres-native pattern that handles N>=1 atomically |
| Capacity column type | `int not null default 1 check (...)` | Postgres native enum | Easier to extend; integers are clearer than enum for "N spots" semantics |
| Monthly calendar | react-day-picker v9 (already installed) | @fullcalendar/react | Bundle bloat (~10x); CSS conflicts with Tailwind v4 |
| Background-shade data model | Enum text (`subtle`/`medium`/`strong`) | Numeric 0-100 slider | Constrains to 3 good-looking outcomes; matches Cruip "clean by default" |
| Dialog sizing | Tailwind class override per usage | cva variant config | Premature abstraction for 1-2 consumers; revisit at 3+ |
| Email gradients | Solid colors only | Linear-gradient + VML fallback | 30-50% of inboxes (Outlook) get ugly fallback; not worth complexity for v1.1 |
| Scroll animations | AOS (optional) | Framer Motion | Framer is for component-level transitions; AOS is purpose-built for scroll-trigger; smaller bundle |

---

## What NOT to Add

| Library / Pattern | Why Avoid | Use Instead |
|-------------------|-----------|-------------|
| `@fullcalendar/react` | ~150 KB gzipped; CSS layer conflicts with Tailwind v4; weak SSR | `react-day-picker@9` (already installed) with custom Day cell |
| `xstate` for the onboarding wizard | Overkill for 2-3 sequential steps; debugging surface > value | Route-segment-per-step + RHF + Server Action DB checkpoints |
| Postgres `enum` type for `background_shade` | Hard to alter (`alter type` ceremony); migration drift risk | `text` with CHECK constraint |
| EXCLUDE constraint for capacity | Cannot express "max N rows" — only "no two match"; would require synthetic slot-number column | Trigger function with row lock |
| Application-layer capacity check before insert | Race window between SELECT and INSERT (the bug we're fixing) | DB-layer trigger |
| `linear-gradient` in email templates | Outlook (any version) renders fallback; Yahoo same | Solid `accounts.brand_primary` color band |
| Separate `auth/callback` route for non-OAuth | Two routes doing similar work; the v1.0 404'd `/auth/callback` was scaffolded for the wrong flow | Single `/auth/confirm` token-hash route |
| Server Action–only account auto-provisioning | Race window between auth.users insert and Server Action execution | Postgres `on auth.users insert` trigger |
| Hand-coded `RESERVED_SLUGS` literal in slug-picker (3rd dup) | Compounds the v1.0 dup debt | Extract to `lib/reserved-slugs.ts` BEFORE adding the picker |
| `@supabase/auth-ui-react` for signup form | Maintenance mode; per-account branding doesn't compose cleanly | Custom RHF + Zod form (matches v1.0 booker form pattern) |
| `aos` baked into root layout | Hydration mismatch risk in Next 16; bundle penalty for routes that don't need it | Per-page `'use client'` import only on surfaces that animate |
| New `<Stepper>` component lib | shadcn v4 ships none; no clear winner; 30 LOC custom is fine | Custom step indicator from radix + Progress |
| Storing slug as nullable on accounts | RLS policies + UNIQUE constraint complexity | "pending-{uuid8}" placeholder set by trigger; UPDATE'd by onboarding wizard |

---

## Stack Patterns by Variant

**If a Phase 10 prereq slips and email-confirmation can't be enabled in Supabase yet:**
- Ship `/auth/confirm` route anyway (it tolerates an unverified email path)
- Set Supabase email-confirmation to "off" but route the signup→app flow through the wizard regardless
- This decouples auth-config readiness from code readiness

**If Phase 11 capacity work runs into trigger-cascade complexity (e.g., reschedule path also needs the check):**
- The same `enforce_booking_capacity()` trigger fires on UPDATE if the constraint trigger is widened to `before insert or update`
- Add `or update of status, start_at, event_type_id` if cancel-then-confirm cycles need protection

**If Phase 12 is scope-cut and Andrew wants to ship multi-user signup before the rebrand:**
- BrandedPage extension in C.2 is independent of the visual overhaul — ship the data model + helpers in Phase 10 alongside slug picker
- The 5-surface visual overhaul can split into Phase 12a (booking page + `/[account]` index — public surfaces) and 12b (dashboard + emails + embed dialog — owner-facing) if needed

---

## Version Compatibility Notes

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@supabase/ssr@0.10.2` | Next 16.2.4 + React 19.2.5 | Verified in v1.0 production |
| `react-day-picker@9.14.0` | date-fns@4.1.0 | v9 dropped `date-fns@2` peer; v9.14 supports v4 |
| `aos@3.x` | Next 16 (any) | Must wrap in `'use client'`; uses `IntersectionObserver` |
| Postgres trigger function | supabase-js@2.103+ | Service-role and RLS-scoped clients both surface 23505 → /api/bookings 409 path unchanged |
| Inter via `next/font/google` | Tailwind v4 | Requires `--font-inter` registered in `@theme` block to use `font-inter` utility |

---

## Confidence Summary

| Area | Confidence | Notes |
|------|------------|-------|
| `/auth/confirm` token-hash flow | HIGH | Verified against live Supabase docs in this research session |
| Postgres trigger for account auto-provision | HIGH | Standard Supabase pattern; in their own docs |
| RESERVED_SLUGS dedup module | HIGH | Trivial refactor; extends 2 existing imports |
| Zod async refine for slug uniqueness | HIGH | v1.0 already uses this pattern |
| RHF + route-segment wizard (no state machine) | HIGH | v1.0 has 3+ examples of this shape |
| Postgres trigger for capacity enforcement | HIGH | Canonical "row-locked count-then-insert" pattern |
| Capacity migration (drop index + create trigger in same tx) | HIGH | Required deploy ordering documented |
| Race-test pattern for capacity | HIGH | Mirrors v1.0's existing race test |
| BrandedPage CSS-var extension | HIGH | Already-shipped pattern in v1.0 |
| `color-mix(in oklab, ...)` for gradients | HIGH | Browser support ≥2023 |
| Background shade enum data model | HIGH | Subjective UX call but defensible |
| react-day-picker v9 monthly view | HIGH | Verified per daypicker.dev docs in this session |
| shadcn v4 Dialog width override | HIGH | Confirmed pattern; no built-in variants |
| Email gradient = avoid | HIGH | caniemail.com confirms Outlook zero support |
| Inter via next/font/google | HIGH | Standard Next pattern; unchanged in v16 |
| `aos` library version + Next 16 hydration | MEDIUM | Verify before locking; client-only boundary required |
| Exact pinned versions | MEDIUM | `npm view` was unavailable this session — re-verify at install |

---

## Sources / Verification Path

Verified in this research session (2026-04-27):

1. **Supabase Auth `auth/confirm` token-hash pattern:** [Setting up Server-Side Auth for Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) (search confirmed page updated within last day)
2. **`@supabase/ssr` 0.10 cache-header behavior:** confirmed via search of [Supabase changelog discussions](https://github.com/orgs/supabase/discussions/28069)
3. **`verifyOtp` types + token_hash:** [JavaScript: Verify and log in through OTP — Supabase Docs](https://supabase.com/docs/reference/javascript/auth-verifyotp)
4. **react-day-picker v9 monthly grid props:** [Grid and Months — React DayPicker](https://daypicker.dev/docs/grid-and-months)
5. **shadcn v4 Dialog (no size variants):** [How do I change Dialog Modal width? — shadcn-ui/ui Issue #1870](https://github.com/shadcn-ui/ui/issues/1870), [feat: Add responsive width control — Issue #6538](https://github.com/shadcn-ui/ui/issues/6538)
6. **Email gradient compatibility:** [Can I email — linear-gradient()](https://www.caniemail.com/features/css-linear-gradient/), [Maizzle gradients guide](https://maizzle.com/guides/gradients), [hteumeuleu/email-bugs #135 (Gmail Android rewrite)](https://github.com/hteumeuleu/email-bugs/issues/135)
7. **Postgres EXCLUDE constraint limits:** [PostgreSQL Documentation — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [Exclusion Constraints in Postgres — Java Jedi (Medium)](https://java-jedi.medium.com/exclusion-constraints-b2cbd62b637a)
8. **Cruip "Simple Light" design system:** `C:/Users/andre/OneDrive - Creighton University/Desktop/Claude-Code-Projects/website-creation/.claude/skills/tailwind-landing-page/SKILL.md` (read full file in this session)

Re-verify before locking versions:
```bash
npm view @supabase/ssr version
npm view react-day-picker version
npm view aos version       # if scope includes scroll animations
npm view @types/aos version
```

Cross-references back to v1.0 stack:
- v1.0 `lib/supabase/admin.ts` line 1 `import "server-only"` — locked pattern; A.3 trigger does NOT need this (lives in Postgres)
- v1.0 `proxy.ts` exclusive CSP/X-Frame-Options ownership — unchanged for v1.1
- v1.0 BrandedPage at `app/_components/branded-page.tsx` — extended in C.2
- v1.0 partial unique index `bookings_no_double_book` — DROPPED in B.2; trigger replaces
- v1.0 `RESERVED_SLUGS` in 2 files — consolidated into `lib/reserved-slugs.ts` in A.4 BEFORE Phase 10 builds slug picker
- v1.0 Migration drift workaround (`supabase db query --linked -f`) — applies to all v1.1 schema changes
- v1.0 shadcn v4 `radix-ui` monorepo package — unchanged; Sheet/Dialog already available

---
*Stack research for: v1.1 milestone (multi-user signup + capacity-aware booking + branded UI overhaul)*
*Researched: 2026-04-27*
*Supersedes the v1.0 STACK.md for these three feature areas only.*
