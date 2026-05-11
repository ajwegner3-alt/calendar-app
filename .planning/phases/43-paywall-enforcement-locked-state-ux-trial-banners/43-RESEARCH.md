# Phase 43: Paywall Enforcement + Locked-State UX + Trial Banners - Research

**Researched:** 2026-05-11
**Domain:** Next.js App Router middleware extension, subscription-gated UX, Stripe state machine
**Confidence:** HIGH (all claims verified from in-tree codebase + official Stripe docs)

---

## Summary

All groundwork for Phase 43 is already in place. The Phase 41 migration added `subscription_status` and `trial_ends_at` to `accounts`, set all existing accounts to `trialing`, and the Phase 42.5 billing page already renders `LockedView` for non-trialing/non-active accounts. Phase 43's job is to wire up three things:

1. **Middleware gate** — add a subscription check inside the existing `/app` auth branch in `lib/supabase/proxy.ts` (the file the Next.js edge function actually runs).
2. **Global banner** — insert a server-rendered trial/past-due strip into the `(shell)` layout at `app/(shell)/layout.tsx` above `<main>`.
3. **Locked-state billing page confirmation** — the `LockedView` component already exists and renders the BILL-19 copy; Phase 43 merely has to verify it's correctly reachable under the new redirect flow.

**Primary recommendation:** Keep all new code server-rendered where possible. The middleware extension requires a single additional Supabase query. The banner is pure server JSX (no client component needed). Do not introduce client-side subscription checks — the server is the only safe authority.

---

## Standard Stack

All libraries are already installed. No new dependencies needed.

### Core (already in project)
| Library | Purpose | Where Used |
|---------|---------|------------|
| `@supabase/ssr` + `createServerClient` | Session + DB read inside edge/server | `lib/supabase/proxy.ts`, `lib/supabase/server.ts` |
| `next/server` `NextResponse`, `NextRequest` | Redirect mechanics in middleware | `lib/supabase/proxy.ts` |
| `next/navigation` `redirect()` | Server component redirect | `app/(shell)/layout.tsx`, billing page |
| Tailwind CSS utility classes | Banner styling | everywhere |
| shadcn `Card` | Existing billing-state components | `billing-state-views.tsx` |

**Installation:** None. Zero new packages.

---

## Architecture Patterns

### The Middleware Entry Point Is `proxy.ts` (NOT `middleware.ts`)

The file `middleware.ts` does not exist in the project root. The actual Next.js middleware entry point is:

**`proxy.ts`** (project root) — exports `proxy` function and `config` with matcher.

It delegates to `lib/supabase/proxy.ts` (`updateSession`) for auth, then adds CSP/X-Frame-Options logic. The matcher is:

```typescript
// proxy.ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

This matcher includes `/api/stripe/webhook`. However, the webhook route does not use Supabase auth (it uses raw `req.text()` + Stripe signature verification) so it has no session to corrupt. The `updateSession` call in proxy.ts will simply find no auth cookies on a Stripe-originating request and proceed without side effects. The subscription gate added in Phase 43 will check `pathname.startsWith('/app')` which `/api/stripe/webhook` does NOT match — so the webhook is structurally safe with no extra work required.

### Middleware Extension Point in `lib/supabase/proxy.ts`

Current structure of `updateSession`:

```
1. Env var guard (return early if not configured)
2. createServerClient (cookie plumbing)
3. supabase.auth.getClaims() → user
4. [EXISTING] if (!user && pathname.startsWith("/app") && !publicAuthPaths.includes(pathname))
      → redirect to /app/login
5. return supabaseResponse
```

**Insert the subscription gate between steps 4 and 5.** The insertion reads:

```
4a. [NEW] if (user && pathname.startsWith("/app") && !publicAuthPaths.includes(pathname) && pathname !== "/app/billing")
       → fetch accounts.subscription_status
       → if status not in { trialing, active, past_due } → redirect to /app/billing
```

Key constraints:
- Must be guarded by `user &&` (unauthenticated requests already redirected to /app/login above; the account query would fail with no user).
- Must exclude `/app/billing` from redirect target check (loop prevention — BILL-20 hard constraint).
- Must use the same `supabase` client already constructed in the function (no second client).
- `past_due` must NOT be in the redirect set (LD-08 invariant).
- `publicAuthPaths` (`/app/login`, `/app/signup`, `/app/forgot-password`, `/app/verify-email`) are already excluded from the auth gate and will also be excluded from the subscription gate naturally via the `pathname.startsWith('/app')` + `!publicAuthPaths.includes(pathname)` pattern already present.

**The accounts row is NOT already fetched in `lib/supabase/proxy.ts`.** The current proxy only calls `supabase.auth.getClaims()`. The subscription gate will add exactly one new query.

**Query to add (single column, single row, no join):**

```typescript
const { data: accountRow } = await supabase
  .from("accounts")
  .select("subscription_status")
  .is("deleted_at", null)
  .maybeSingle();
```

No `.eq("owner_user_id", user.sub)` is needed because RLS on `accounts` already scopes to the authenticated user's row. `maybeSingle()` returns null if no row (unlinked owner) — treat null as "not locked" since `/app/unlinked` handles that state separately.

**Redirect mechanics (existing pattern to copy):**

```typescript
const url = request.nextUrl.clone();
url.pathname = "/app/billing";
return NextResponse.redirect(url);
```

This is identical to the existing `/app/login` redirect at line 70-72 of `lib/supabase/proxy.ts`.

### App Shell Layout — Banner Insertion Point

File: `app/(shell)/layout.tsx`

The shell layout is a **Server Component** that already fetches the account row (currently `select("id")` only). It renders:

```
<TooltipProvider>
  <SidebarProvider>
    <AppSidebar email={email} />
    <SidebarInset className="relative overflow-hidden bg-gray-50">
      <BackgroundGlow />
      <Header />
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6 md:pt-24 pb-12">
        {children}
      </main>
    </SidebarInset>
  </SidebarProvider>
</TooltipProvider>
```

**Banner insertion:** Place a `<SubscriptionBanner>` component immediately after `<Header />` and before `<main>`. This means the banner sits between the fixed glass pill and the page content area.

**What the layout already fetches:** Only `select("id")`. To support the banner, the layout's query must be expanded to include `subscription_status` and `trial_ends_at`. This is a single query change (`select("id, subscription_status, trial_ends_at")`).

**Server component — no "use client" needed.** The banner is display-only: no state, no interactions (no dismiss button per CONTEXT decisions). Pure server JSX.

**Layout already handles the unlinked case:** If no account row, it redirects to `/app/unlinked` — the banner only renders when an account row exists.

### Locked-State Shell Decision

The existing shell provides full sidebar + header + logout. For locked accounts, this is the right choice (CONTEXT.md discretion item resolved):

- The sidebar nav items (Home, Event Types, etc.) will link to pages that redirect back to `/app/billing` via middleware — this is acceptable. No nav suppression needed.
- The `LogOut` button lives in `AppSidebar`'s `<SidebarFooter>` as a form POST to `/auth/signout` — it will remain accessible to locked accounts.
- Conclusion: **keep full shell** for locked state. No stripped shell needed.

### /app/billing Locked-State: Already Implemented

The `LockedView` component in `billing-state-views.tsx` already renders the BILL-19 copy verbatim:

```
"Everything is waiting for you!"  (CardTitle)
"Head over to payments to get set up."  (CardContent)
```

The billing page (`app/(shell)/app/billing/page.tsx`) already:
- Derives state from `subscription_status`
- Renders `<LockedView />` for canceled/unpaid/incomplete/incomplete_expired states
- Renders `<TierGrid>` below LockedView for the re-subscribe path

Phase 43 does NOT need to add the locked-state copy — it's already there. Phase 43 only needs to ensure the middleware redirects locked accounts to this page, and the billing page is exempt from that redirect (already the hard constraint).

### Trial Day Count Math — Existing Implementation to Reuse

The billing page already has a verified implementation:

```typescript
// Source: app/(shell)/app/billing/page.tsx
function deriveTrialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(
    0,
    Math.ceil(
      (new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000,
    ),
  );
}
```

**Reuse this exact function** in the banner component. It returns:
- `null` if `trial_ends_at` is null (edge case: grandfathered account with null trial date)
- `0` if trial has expired but status is still `trialing` (brief webhook lag window)
- `N` (whole days, ceiling) otherwise

**Timezone considerations:** `Date.now()` is UTC milliseconds; `new Date(trialEndsAt).getTime()` parses the Postgres `TIMESTAMPTZ` as UTC. Both are UTC — no timezone conversion needed. The ceiling rounding means "Trial ends in 1 day" when 1 second remains (whole-day precision per CONTEXT decision).

**Day 0 handling:** CONTEXT decision says Day 0 = "Trial ends today". The function returns 0 when `Math.ceil(delta/86400000)` rounds to 0. The banner component must branch on `daysLeft === 0`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trial day count | Custom date logic | `deriveTrialDaysLeft()` from billing page | Already verified, handles null + 0 edge cases |
| Supabase client in middleware | New createClient | Existing `supabase` from `updateSession` scope | Avoids double client initialization |
| Redirect response | New NextResponse.next() | `request.nextUrl.clone()` + `NextResponse.redirect()` | Matches existing auth-redirect pattern; a new `NextResponse.next()` discards cookie mutations |
| Banner dismiss state | localStorage, cookie | Nothing — banner is not dismissible | CONTEXT decision: always visible |
| Subscription status from client | API call | Server component prop drill from layout | Server is authoritative; client bundles must not expose status |

---

## Common Pitfalls

### Pitfall 1: Creating a new NextResponse inside the subscription gate

**What goes wrong:** If the subscription gate returns `NextResponse.redirect()` constructed from a fresh `new NextResponse.next({ request })`, the Supabase auth cookie mutations from `setAll()` earlier in `updateSession` are discarded. Owners get randomly logged out.

**How to avoid:** The redirect should be returned early before `supabaseResponse` is used. `NextResponse.redirect()` does not need to carry auth cookies — the owner is being redirected, not served content. The pattern is correct as-is in the existing auth redirect.

**Correct pattern:**
```typescript
const url = request.nextUrl.clone();
url.pathname = "/app/billing";
return NextResponse.redirect(url);
```

### Pitfall 2: Including `/app/billing` in the lock redirect scope

**What goes wrong:** If the `pathname !== "/app/billing"` check is missing, locked accounts hitting `/app/billing` redirect to `/app/billing` infinitely.

**How to avoid:** The exemption condition must be explicit:
```typescript
if (
  user &&
  pathname.startsWith("/app") &&
  !publicAuthPaths.includes(pathname) &&
  pathname !== "/app/billing"
)
```

### Pitfall 3: Including `past_due` in the locked set

**What goes wrong:** LD-08 explicitly requires `past_due` retains access. If `past_due` triggers a redirect, Andrew's V18-CP-07 verification gate fails.

**How to avoid:** The allowed set is `{ 'trialing', 'active', 'past_due' }`. Only redirect when status is outside this set. Code should read:

```typescript
const ALLOWED_STATUSES = ['trialing', 'active', 'past_due'];
if (accountRow && !ALLOWED_STATUSES.includes(accountRow.subscription_status)) {
  // redirect
}
```

Treat `accountRow === null` (unlinked owner) as allowed — `/app/unlinked` handles it.

### Pitfall 4: Expanding the shell layout query without an alias

**What goes wrong:** The layout currently selects `id` only. Adding `subscription_status, trial_ends_at` changes the return type. TypeScript will infer the new type correctly from the Supabase codegen, but if the codegen is stale, it may use `any`.

**How to avoid:** After changing the select, verify the TypeScript type includes the new columns before writing the banner prop types.

### Pitfall 5: Banner in a client component causing a waterfall

**What goes wrong:** Making the banner a `"use client"` component means it can't directly read server data — it would need a separate fetch or context passing.

**How to avoid:** The banner is pure display (no interactions, no dismiss). Keep it a server component receiving props from the layout. The layout already reads the account row server-side.

### Pitfall 6: Webhook route broken by subscription gate

**What goes wrong:** A naive implementation could accidentally check subscription on `/api/stripe/webhook`.

**Why it won't happen with the correct pattern:** The gate is inside `pathname.startsWith('/app')`. `/api/stripe/webhook` starts with `/api`, not `/app`. The gate will not execute. No extra exemption needed.

---

## Code Examples

### Middleware Extension (verified pattern, insert in `lib/supabase/proxy.ts`)

```typescript
// Source: extends existing pattern in lib/supabase/proxy.ts lines 58-73
// Insert immediately after the existing auth redirect block (after line 73),
// before `return supabaseResponse`.

const SUBSCRIPTION_ALLOWED = ['trialing', 'active', 'past_due'] as const;

if (
  user &&
  pathname.startsWith('/app') &&
  !publicAuthPaths.includes(pathname) &&
  pathname !== '/app/billing'
) {
  const { data: accountRow } = await supabase
    .from('accounts')
    .select('subscription_status')
    .is('deleted_at', null)
    .maybeSingle();

  const status = accountRow?.subscription_status;
  if (status && !SUBSCRIPTION_ALLOWED.includes(status as typeof SUBSCRIPTION_ALLOWED[number])) {
    const url = request.nextUrl.clone();
    url.pathname = '/app/billing';
    return NextResponse.redirect(url);
  }
}
```

### Shell Layout Query Expansion

```typescript
// Source: extend app/(shell)/layout.tsx line 43
// Change:
.select("id")
// To:
.select("id, subscription_status, trial_ends_at")
```

### Banner Component (server component, no "use client")

```typescript
// New file: app/(shell)/app/_components/subscription-banner.tsx
// Props flow from layout.tsx → banner; no client state needed.

interface SubscriptionBannerProps {
  subscriptionStatus: string;
  trialEndsAt: string | null;
}

function deriveTrialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
}

export function SubscriptionBanner({ subscriptionStatus, trialEndsAt }: SubscriptionBannerProps) {
  if (subscriptionStatus === 'active') return null;

  if (subscriptionStatus === 'trialing') {
    const daysLeft = deriveTrialDaysLeft(trialEndsAt);
    const isUrgent = daysLeft !== null && daysLeft <= 3;
    // neutral: blue/informational palette
    // urgent: amber palette (≤3 days) per CONTEXT discretion
    // ...
  }

  if (subscriptionStatus === 'past_due') {
    // non-blocking warning banner
    // ...
  }

  return null; // locked accounts are redirected by middleware; no banner needed
}
```

### Verified Day-Count Logic (copy from billing page)

```typescript
// Source: app/(shell)/app/billing/page.tsx (deriveTrialDaysLeft)
// Returns null (no trial_ends_at), 0 (expired), or N whole days remaining.
function deriveTrialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000),
  );
}
```

---

## NSI Brand Palette and Banner Conventions

From `app/globals.css` `@theme` block (HIGH confidence — source of truth):

| Token | Value | Use |
|-------|-------|-----|
| `--color-primary` | `#3B82F6` (blue-500) | Primary brand blue, header wordmark suffix |
| `--color-accent` | `#F97316` (orange-500) | Accent; slot dots on public calendar |
| `--destructive` | oklch(0.577 0.245 27.325) | Error/destructive red |

**Existing banner precedent** — `UnsentConfirmationsBanner` in `app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx`:

```
className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
```

This is the only existing banner primitive in the codebase. It uses Tailwind amber classes (not CSS custom properties).

**Recommendation for banner variants:**

| State | Color | Rationale |
|-------|-------|-----------|
| Trial neutral (>3 days) | `bg-blue-50 border-blue-200 text-blue-900` | Informational, matches brand primary blue |
| Trial urgent (≤3 days) | `bg-amber-50 border-amber-300 text-amber-900` | Matches existing `UnsentConfirmationsBanner` precedent; amber = warning without alarm |
| Past-due | `bg-amber-50 border-amber-300 text-amber-900` | Same as existing banner; non-blocking warning tone matches dunning cycle (~3 weeks Stripe auto-retry window) |

The header is a **fixed glass pill** (`fixed top-2 md:top-6`) with `z-30`. `<main>` has `pt-20 sm:px-6 md:pt-24`. The banner should live **inside `<SidebarInset>`** between `<Header />` and `<main>`, positioned with `relative` (not fixed) so it shifts content down naturally. This avoids z-index conflicts with the fixed header.

---

## Stripe State Machine: past_due + trialing Collision

**Conclusion: Impossible. No design needed.**

**Verified from official Stripe docs** (https://docs.stripe.com/billing/subscriptions/overview):

- `trialing` → `active` (trial ends, payment succeeds) OR `trialing` → `past_due` (trial ends, payment fails on first charge) OR `trialing` → `paused` (trial ends, no payment method)
- `past_due` can only be reached from `active` when a renewal invoice fails
- A subscription that is `trialing` has never been billed; `past_due` requires at least one prior successful billing cycle

Therefore `past_due` and `trialing` are mutually exclusive. The CONTEXT.md discretion note "if it IS possible, past-due wins" is a dead branch — implementation does not need a collision handler.

---

## Existing-Account Grandfather Verification

From `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql`:

```sql
UPDATE public.accounts
SET
  trial_ends_at = NOW() + INTERVAL '14 days',
  subscription_status = 'trialing'
WHERE stripe_customer_id IS NULL;
```

This ran at Phase 41 deploy time. All accounts that existed before Phase 41 (including Andrew's `nsi` account and the 5 v1.7 grandfathered accounts) have:
- `subscription_status = 'trialing'`
- `trial_ends_at` = ~2026-05-24 (deploy date + 14 days)

`trialing` is in the ALLOWED_STATUSES set — these accounts will NOT be locked out by Phase 43.

**Verification query for V18-CP-06:**
```sql
SELECT slug, subscription_status, trial_ends_at
FROM accounts
WHERE stripe_customer_id IS NULL
ORDER BY created_at;
```
All rows should show `subscription_status = 'trialing'` with a future `trial_ends_at`.

---

## Webhook Exemption: Confirmed Safe

The middleware matcher in `proxy.ts`:
```
"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
```

This matches `/api/stripe/webhook`. However the subscription gate in `lib/supabase/proxy.ts` only fires when `pathname.startsWith('/app')`. `/api/stripe/webhook` starts with `/api` — the gate will not execute. No exemption code needed beyond what already exists.

Additionally, `updateSession` calls `supabase.auth.getClaims()` which reads JWT from cookies. Stripe's webhook requests carry no cookies, so `user` will be `null`. Even if somehow the path check were wrong, `user && pathname.startsWith('/app')` would be false for the webhook.

---

## Open Questions

1. **Urgency banner exact copy**
   - What we know: CONTEXT.md says "tone/urgency shift" + "Trial ends in N days" direction
   - What's unclear: Final wording for 0-day and 1-day edge cases in the banner (vs. billing page `TrialingHeader` which uses "1 day left in your trial" / "N days left in your trial")
   - Recommendation: Use "Trial ends today" (daysLeft === 0), "Trial ends tomorrow" (daysLeft === 1), "Trial ends in N days" (daysLeft > 1). Differentiate from billing page copy to avoid user confusion between the two surfaces.

2. **Past-due banner copy**
   - What we know: CONTEXT.md defers to Claude; Customer Portal CTA is out of scope (Phase 44)
   - Recommendation: "Your payment is past due. Update your billing information to keep your account active." with an inline link to `/app/billing`. Reassuring tone acknowledges Stripe's auto-retry without panic.

3. **Banner position relative to header pill**
   - What we know: Header is `fixed top-2 md:top-6 z-30`; `<main>` has `pt-20 md:pt-24`
   - Recommendation: Place banner as a non-fixed div inside `<SidebarInset>` immediately after `<Header />`. Since `<main>` has `pt-20 md:pt-24` (offset for fixed header), a non-fixed banner between `<Header />` and `<main>` will insert between the header bottom and the content top. The banner should use `absolute top-[56px] md:top-[88px]` or be placed inside `<main>` as the first child with `mb-4`. The second option (inside `<main>` as first child of each page) would require touching every page; the layout insertion is cleaner.
   - Actual recommendation: Place between `<Header />` and `<main>` but still inside `<SidebarInset>`. Use `pt-14 md:pt-[88px]` wrapper or just let the main's existing `pt-20/pt-24` absorb the banner height. Inspect the live shell to confirm spacing before finalizing.

---

## Sources

### Primary (HIGH confidence)
- In-tree: `lib/supabase/proxy.ts` — complete middleware implementation, session flow
- In-tree: `proxy.ts` (root) — middleware entry point, matcher config, confirmed NOT `middleware.ts`
- In-tree: `app/(shell)/layout.tsx` — shell layout, account query, component tree
- In-tree: `app/(shell)/app/billing/page.tsx` — state derivation, `deriveTrialDaysLeft` implementation, locked-state render
- In-tree: `app/(shell)/app/billing/_components/billing-state-views.tsx` — `LockedView` copy verified
- In-tree: `app/globals.css` — NSI brand palette, CSS custom properties
- In-tree: `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql` — grandfather backfill confirmed
- In-tree: `components/app-sidebar.tsx` — logout button confirmed in SidebarFooter

### Secondary (MEDIUM confidence)
- In-tree: `app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx` — amber banner pattern
- In-tree: `app/(shell)/app/_components/header.tsx` — fixed header z-index and position classes

### Primary external (HIGH confidence)
- https://docs.stripe.com/billing/subscriptions/overview — Stripe status state machine; confirmed `past_due` + `trialing` are mutually exclusive

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all in-tree, no new deps
- Middleware extension point: HIGH — code read directly
- Architecture (shell layout): HIGH — code read directly
- Banner placement: MEDIUM — needs live inspection to confirm pixel-perfect spacing
- Stripe state machine: HIGH — verified from official docs
- Trial day count math: HIGH — existing implementation in-tree, copy verbatim
- Pitfalls: HIGH — derived from reading actual code paths

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable stack; 30-day window)
