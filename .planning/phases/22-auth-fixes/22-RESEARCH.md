# Phase 22: Auth Fixes - Research

**Researched:** 2026-05-02
**Domain:** Next.js App Router auth surfaces + Supabase SSR session config
**Confidence:** HIGH (all findings verified from source code or official documentation)

---

## Summary

Phase 22 involves three surgical fixes to the `/login` and `/signup` surfaces plus a Supabase session TTL
configuration task. All findings below are derived from direct file inspection of the working codebase and
official Supabase/SSR package documentation.

**AUTH-18 root cause confirmed:** The "Sign up" link in `login-form.tsx` uses `href="/app/signup"` (correct
URL) with Next.js `<Link>`. The bug is NOT a bad href or wrong component — it is the middleware gate in
`lib/supabase/proxy.ts`, which redirects all unauthenticated `/app/*` requests back to `/app/login` but
only exempts `/app/login` from that rule. `/app/signup` is not in the allow-list and gets intercepted.

**AUTH-19 layout:** The current JSX in `login/page.tsx` renders form-column first, `<AuthHero />` second,
inside a `lg:grid-cols-2` grid. Swapping the two JSX children is the entire fix. The `AuthHero` component
is already `hidden` on mobile (`hidden lg:flex`), so mobile layout is unaffected by the swap.

**AUTH-20 session TTL:** The installed `@supabase/ssr@0.10.2` defaults cookie `maxAge` to 400 days
(hardcoded in `DEFAULT_COOKIE_OPTIONS`). The real culprit for re-login prompts is NOT the cookie expiry but
the Supabase project's dashboard Auth settings. The correct fix is a single Supabase Dashboard change:
ensure no `[auth.sessions]` timebox or inactivity_timeout is set (or set inactivity_timeout to >= 30 days).
The `config.toml` has `[auth.sessions]` entirely commented out, which on the Supabase free plan means the
hosted project uses whatever defaults the Supabase service applies — refresh tokens rotate but never expire
by default, so sessions should already be persistent. The most likely source of Andrew's re-prompts is the
Supabase dashboard project settings overriding the local config.

**Primary recommendation:** Three-file change set: (1) add `/app/signup` to the middleware allow-list in
`lib/supabase/proxy.ts`; (2) swap JSX column order in `app/(auth)/app/login/page.tsx`; (3) add reciprocal
"Log in" link to `signup-form.tsx`; (4) verify Supabase dashboard Auth settings for any session timebox.

---

## AUTH-18: "Sign up" Link Root Cause

### Confirmed Root Cause

File: `app/(auth)/app/login/login-form.tsx`, lines 96–103

```tsx
<p className="text-center text-sm text-muted-foreground">
  Don&apos;t have an account?{" "}
  <Link
    href="/app/signup"            // <-- href is CORRECT
    className="underline underline-offset-4 hover:text-foreground"
  >
    Sign up
  </Link>
</p>
```

The href `/app/signup` is correct — the route is `app/(auth)/app/signup/page.tsx`, which Next.js App Router
serves at `/app/signup`. The `<Link>` component is correct. The **bug is in the middleware.**

File: `lib/supabase/proxy.ts`, lines 47–56

```ts
const { pathname } = request.nextUrl;
if (
  !user &&
  pathname.startsWith("/app") &&
  pathname !== "/app/login"        // <-- only /app/login is exempted
) {
  const url = request.nextUrl.clone();
  url.pathname = "/app/login";
  return NextResponse.redirect(url);
}
```

Any unauthenticated request to `/app/signup`, `/app/forgot-password`, or `/app/verify-email` will be
redirected to `/app/login`. All three of these are public auth routes that must be exempted.

### Confirmed Fix

Add `/app/signup`, `/app/forgot-password`, and `/app/verify-email` to the middleware allow-list. The minimal
single-purpose fix for AUTH-18 is adding `/app/signup`; including the other two is correct hygiene.

```ts
// Proposed condition in lib/supabase/proxy.ts:
const publicAuthPaths = ["/app/login", "/app/signup", "/app/forgot-password", "/app/verify-email"];
if (!user && pathname.startsWith("/app") && !publicAuthPaths.includes(pathname)) {
```

**Confidence: HIGH** — source code directly inspected, middleware logic confirmed.

---

## AUTH-19: Login Layout Column Swap

### Current Structure

File: `app/(auth)/app/login/page.tsx`, lines 29–46

```tsx
<div className="relative grid min-h-screen lg:grid-cols-2">
  {/* LEFT column — form (WRONG per AUTH-19) */}
  <main className="flex flex-col items-center justify-center bg-white/0 px-6 pt-20 pb-12
                   md:pt-24 md:pb-20 lg:bg-white lg:px-12">
    <div className="w-full max-w-sm">
      <header className="mb-8">...</header>
      <LoginForm resetSuccess={reset === "success"} />
    </div>
  </main>
  {/* RIGHT column — hero (WRONG per AUTH-19) */}
  <AuthHero headline="Welcome back to your bookings" />
</div>
```

`AuthHero` is currently in the second (RIGHT) grid cell. AUTH-19 requires it on the LEFT.

### Required Fix

Swap the two JSX children — `<AuthHero>` moves to first position, `<main>` moves to second:

```tsx
<div className="relative grid min-h-screen lg:grid-cols-2">
  {/* LEFT: NSI hero */}
  <AuthHero headline="Welcome back to your bookings" />
  {/* RIGHT: form column */}
  <main className="flex flex-col items-center justify-center bg-white/0 px-6 pt-20 pb-12
                   md:pt-24 md:pb-20 lg:bg-white lg:px-12">
    ...
  </main>
</div>
```

### Mobile Behavior

`AuthHero` is rendered `hidden lg:flex` (see `auth-hero.tsx` line 24):
```tsx
<aside className="relative hidden overflow-hidden bg-gray-50 lg:flex ...">
```
It is completely absent from the DOM below `lg` breakpoint. Swapping JSX order has **zero effect on mobile**.
Mobile layout remains: Header pill → BackgroundGlow → form — unchanged.

### Breakpoint in Use

The split-panel activates at `lg` (1024px), not `md` (768px). The CONTEXT.md and ROADMAP.md say `≥768px`
in places but the actual code uses `lg:grid-cols-2`. The `lg` breakpoint is the truth. The ROADMAP success
criterion says `≥768px` — this is a minor discrepancy in documentation, not code. The fix targets `lg:`.

### Desktop Split Ratio (Claude's Discretion)

Current: `lg:grid-cols-2` = equal 50/50 split. Recommendation: **keep 50/50**. The `AuthHero` content
(headline + 3 bullet points) fills a half-column naturally. Asymmetric splits (e.g., `lg:grid-cols-[2fr_3fr]`)
add complexity without clear benefit for this content volume. Cruip-style split panels typically use 50/50
for login pages.

**Confidence: HIGH** — source code directly inspected.

---

## AUTH-20: Supabase Session Persistence

### Current State of Installed Packages

- `@supabase/ssr@0.10.2` — `DEFAULT_COOKIE_OPTIONS.maxAge = 400 * 24 * 60 * 60` = **34,560,000 seconds
  (400 days)**. Source: `node_modules/@supabase/ssr/dist/main/utils/constants.js` line 10.
- This means the auth session **cookie already persists 400 days** in the browser. The cookie itself is not
  the problem.
- The `createBrowserClient` and `createServerClient` accept `cookieOptions?: CookieOptionsWithName` which
  extends `SerializeOptions` (from the `cookie` package), including `maxAge`, `expires`, `sameSite`, etc.
  No `cookieOptions` override is currently set in any Supabase client in this project — the 400-day
  default applies.

### What Actually Controls Session Duration

The cookie TTL only controls how long the browser stores the token. The Supabase Auth server controls whether
the stored refresh token is still valid. Two orthogonal concerns:

| Setting | Where | Effect |
|---------|-------|--------|
| Cookie `maxAge` | `@supabase/ssr` client options | How long browser holds the token bytes |
| JWT expiry | Supabase Dashboard → Auth → JWT Settings | How long access token is valid before refresh is required |
| Refresh token rotation | `enable_refresh_token_rotation` (config.toml / Dashboard) | Each refresh token is single-use; rotated on use |
| Session timebox | Supabase Dashboard → Auth → Sessions (Pro plan only) | Hard maximum session lifetime |
| Inactivity timeout | Supabase Dashboard → Auth → Sessions (Pro plan only) | Session expires if not refreshed within window |

### Local config.toml Auth Settings (lines 150–270)

```toml
jwt_expiry = 3600                      # 1 hour access token — normal
enable_refresh_token_rotation = true    # refresh tokens rotate on use
refresh_token_reuse_interval = 10      # 10-second reuse window
# [auth.sessions]                       # COMMENTED OUT — no timebox or inactivity timeout set
# timebox = "24h"
# inactivity_timeout = "8h"
```

The `[auth.sessions]` block is commented out in `config.toml`. **For the local dev environment this means
no session timebox.** However, the hosted Supabase project (dashboard) may have independent settings.

### Root Cause of Re-Login Prompts (Hypothesis)

Since the cookie persists 400 days and rotation is enabled, the most likely causes of early re-login are:

1. **Dashboard-side session settings differ from config.toml.** The Supabase hosted project may have
   session timebox or inactivity timeout configured in the dashboard UI independently of local config.toml.
   Session controls are a Pro-plan feature; if Andrew is on the Free plan they should be unavailable, but
   the default behavior at project creation may set values.

2. **Refresh token reuse collision.** If two tabs or server requests fire simultaneously, the refresh token
   is consumed by one request; the other gets a 400. `getClaims()` in middleware fires on every request
   — concurrent requests within the 10-second reuse window may collide.

3. **Browser cookie deletion by the user or browser privacy settings.** The cookie is httpOnly: false
   (from `DEFAULT_COOKIE_OPTIONS`) and can be cleared by browser privacy tools.

### The 30-Day Sliding Window Target

"30-day sliding window" in AUTH-20 terminology means: if Andrew visits the app at least once every 30 days,
he stays logged in. With refresh token rotation enabled, each visit that triggers a `getClaims()` / token
refresh issues a new refresh token with a fresh reuse window. Since the cookie already lasts 400 days and
refresh tokens don't expire (only rotate), the session is already indefinitely sliding **as long as**:
- No session timebox is set in the dashboard
- The browser retains the cookie

### Required Action for AUTH-20

**Step 1 — Dashboard verification (manual by Andrew):**

Navigate to: Supabase Dashboard → Project → Authentication → Settings → Sessions

Check and clear any values for:
- "Time-box user sessions" — should be blank/off
- "Inactivity timeout" — should be blank/off or set to >= 30 days if present

**Step 2 — No code change needed for cookie TTL** — `@supabase/ssr@0.10.2` already sets 400-day cookies.

**Step 3 — Verify proxy.ts setAll signature.** The `proxy.ts` `setAll` currently omits the `headers`
parameter from the callback signature. The `@supabase/ssr@0.10.2` `SetAllCookies` type has a second
`headers: Record<string, string>` parameter for cache-control headers. This omission may cause cache
issues. Recommended: update `setAll` in `proxy.ts` to pass cache headers through:

```ts
setAll(cookiesToSet, headers) {
  cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
  supabaseResponse = NextResponse.next({ request });
  cookiesToSet.forEach(({ name, value, options }) =>
    supabaseResponse.cookies.set(name, value, options),
  );
  Object.entries(headers ?? {}).forEach(([key, value]) =>
    supabaseResponse.headers.set(key, value),
  );
},
```

This is a correctness fix, not a breaking change.

### Verification Strategy for AUTH-20

Without waiting 30 days, verification options:

1. **Decode the cookie expiry (immediate):** After login, open DevTools → Application → Cookies. Look for
   `sb-*-auth-token`. Check its "Expires / Max-Age" — should be ~400 days from now. This verifies the
   cookie TTL is correct.

2. **Inspect Supabase dashboard (immediate):** Auth → Settings → Sessions. Confirm no timebox or inactivity
   timeout is active. This directly confirms the server-side session policy.

3. **Simulate next-day visit (5 minutes):** Log in. Set system clock forward 2 hours (past JWT expiry).
   Reload `/app`. If the middleware `getClaims()` successfully refreshes the token and the user stays on
   `/app`, the sliding refresh works. (Alternatively: log in, wait 61 minutes, reload — should stay logged
   in via refresh token rotation.)

**Confidence: HIGH for cookie TTL (source code verified). MEDIUM for dashboard settings being the root
cause (inferred from evidence, requires manual verification).**

---

## AUTH-18 Reciprocal Link: Signup → Login (Claude's Discretion)

### Current State of signup-form.tsx

`app/(auth)/app/signup/signup-form.tsx` already has a "Log in" link at line 79:

```tsx
<p className="text-center text-sm text-muted-foreground">
  Already have an account?{" "}
  <Link href="/app/login" ...>Log in</Link>
</p>
```

The signup → login reciprocal link is **already present and correct.** No change needed here per AUTH-18's
symmetric requirement.

The signup page also has a "Forgot password?" link pointing to `/app/forgot-password`, which is also
correct.

**Confidence: HIGH** — source code directly inspected.

---

## Cruip Split-Panel Reference and v1.2 Auth Skin (Claude's Discretion)

### Existing v1.2 Auth Skin Components

**BackgroundGlow** (`app/_components/background-glow.tsx`):
- Two soft radial blobs, color defaulting to `#3B82F6` (blue-500)
- Absolute-positioned, `blur-[160px]`, opacity 0.35–0.40
- Renders on mobile via page-level wrapper (`lg:hidden`)
- Renders on desktop inside `AuthHero` (the hero panel only)

**AuthHero** (`app/(auth)/_components/auth-hero.tsx`):
- `bg-gray-50` background with `BackgroundGlow` inside
- NSI pill badge: "Powered by NSI" with emerald dot
- `h1` headline (4xl, font-semibold, text-gray-900) — varies per page
- Body paragraph (text-gray-600)
- 3-item bullet list with gray-400 dots
- Hidden on mobile, shown `lg:flex` with `lg:px-12 lg:py-20`

### Recommended Login Info-Pane Copy (Claude's Discretion)

The current login `AuthHero` headline is `"Welcome back to your bookings"`. This is already appropriate for
the welcome-back context. No change required unless the planner wants alignment with a Cruip reference.

Recommended info-pane bullets for the login page (differentiated from signup bullets which focus on
getting started):

```
- Your bookings, availability, and client history — all here.
- Never miss a booking — email confirmations go out automatically.
- Built for trade contractors, by NSI in Omaha.
```

The existing bullet copy in `auth-hero.tsx` is generic (defaults). The login page should pass the
`headline` prop; the bullets are part of the `AuthHero` default which the login page gets unchanged
(no subtext override either). The planner should decide whether to add login-specific bullet overrides
or leave the AuthHero defaults.

### Mobile Stacking Order (Claude's Discretion)

On mobile (`< lg`), `AuthHero` is hidden. The user sees:
- Header pill
- Form column (centered, with ambient BackgroundGlow from `lg:hidden` wrapper)

Recommendation: **keep current mobile behavior unchanged.** Form-first on mobile is the correct pattern
for a returning-user login flow. No content to stack — hero is absent on mobile.

---

## Session UX Choices (Claude's Discretion)

### "Remember me" — Always-on vs. Opt-in

Recommendation: **always-on (no UI toggle).** This is a single-owner app. Andrew is the only user.
There is no public-facing multi-user login requiring opt-in persistence. Adding a checkbox creates
unnecessary complexity. The 30-day target is best-effort persistence — the user can clear cookies/cache
to effectively "log out."

### Logout Scope

Recommendation: **current device only.** `signOut()` without options defaults to `local` scope in
Supabase auth-js v2 (signs out the current session only). This is correct for a single-owner app.
No change needed to existing logout behavior.

### Expiry UX (Hard Redirect vs. Inline Re-auth)

Recommendation: **hard redirect to /login** (current behavior). The middleware already redirects
unauthenticated requests to `/app/login`. No inline re-auth modal is needed. The CONTEXT.md defers
inline re-auth modal to future polish.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie session storage | Custom cookie manager | `@supabase/ssr` `DEFAULT_COOKIE_OPTIONS` | Already 400-day TTL; library manages chunking, Base64 encoding, refresh |
| Auth route middleware | Custom JWT decode | `supabase.auth.getClaims()` in proxy.ts | Validates JWT signature against published JWKS on every request |
| Refresh token rotation | Manual refresh logic | Supabase auto-refresh via `getClaims()` in middleware | Library handles rotation, reuse windows, and cookie write-back |

---

## Common Pitfalls

### Pitfall 1: Fixing AUTH-18 at the href, not the middleware

**What goes wrong:** Developer changes the Link href from `/app/signup` to something else or adds a
`target="_blank"`. The href is already correct.
**Root cause:** Misdiagnosis — the bug is the middleware gate, not the link.
**How to avoid:** Fix `proxy.ts` allow-list, not `login-form.tsx` href.

### Pitfall 2: Changing the form column's background on the swap

**What goes wrong:** After swapping columns, the `lg:bg-white` class on `<main>` (form column) is still
correct because the form column is now on the RIGHT and should have a white background. If a developer
applies the white background to the wrong column (the `AuthHero` aside), the hero loses its `bg-gray-50`
+ `BackgroundGlow` appearance.
**How to avoid:** Only swap JSX order; do not change class names on either element.

### Pitfall 3: Assuming the session problem is cookie maxAge

**What goes wrong:** Developer sets `cookieOptions: { maxAge: 30 * 24 * 60 * 60 }` in the Supabase clients
to "implement 30-day TTL" — but the default is already 400 days. Setting a shorter value would actually
make things worse.
**How to avoid:** Verify `DEFAULT_COOKIE_OPTIONS` in the installed package first. The fix is a dashboard
settings check, not a code change.

### Pitfall 4: Exempting only /app/signup in the middleware

**What goes wrong:** Developer adds only `pathname !== "/app/signup"` as a second exemption. The
`/app/forgot-password` and `/app/verify-email` routes also need to be accessible without a session.
**How to avoid:** Use an array allow-list pattern rather than multiple `!== ` conditions.

### Pitfall 5: Mobile layout regression from JSX swap

**What goes wrong:** Developer assumes swapping JSX order affects mobile. They add `order-last` or
`order-first` Tailwind classes unnecessarily.
**How to avoid:** `AuthHero` has `hidden` class — it does not render on mobile at all, so there is nothing
to reorder.

---

## Code Examples

### AUTH-18: Updated Middleware Allow-List

```ts
// lib/supabase/proxy.ts — updated condition
const publicAuthPaths = ["/app/login", "/app/signup", "/app/forgot-password", "/app/verify-email"];

if (!user && pathname.startsWith("/app") && !publicAuthPaths.includes(pathname)) {
  const url = request.nextUrl.clone();
  url.pathname = "/app/login";
  return NextResponse.redirect(url);
}
```

Source: direct inspection of `lib/supabase/proxy.ts` and `app/(auth)/app/` route structure.

### AUTH-19: Corrected Login Page Column Order

```tsx
// app/(auth)/app/login/page.tsx — swapped column order
<div className="relative grid min-h-screen lg:grid-cols-2">
  {/* LEFT: NSI hero (lg+ only) */}
  <AuthHero headline="Welcome back to your bookings" />
  {/* RIGHT: form column */}
  <main className="flex flex-col items-center justify-center bg-white/0 px-6 pt-20 pb-12
                   md:pt-24 md:pb-20 lg:bg-white lg:px-12">
    <div className="w-full max-w-sm">
      <header className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
          Sign in to your dashboard
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your email and password to continue.
        </p>
      </header>
      <LoginForm resetSuccess={reset === "success"} />
    </div>
  </main>
</div>
```

### AUTH-20: proxy.ts setAll with headers (correctness fix)

```ts
// lib/supabase/proxy.ts — corrected setAll to pass cache headers
setAll(cookiesToSet, headers) {
  cookiesToSet.forEach(({ name, value }) =>
    request.cookies.set(name, value),
  );
  supabaseResponse = NextResponse.next({ request });
  cookiesToSet.forEach(({ name, value, options }) =>
    supabaseResponse.cookies.set(name, value, options),
  );
  Object.entries(headers ?? {}).forEach(([key, value]) =>
    supabaseResponse.headers.set(key, value),
  );
},
```

Source: `@supabase/ssr@0.10.2` `types.d.ts` — `SetAllCookies` type includes `headers` param.

---

## State of the Art

| Old Pattern | Current Pattern | Impact |
|------------|-----------------|--------|
| `getSession()` for middleware auth check | `getClaims()` (already in use) | getClaims validates JWT signature; getSession trusts cookie without verification |
| Separate `get/set/remove` cookie methods | `getAll/setAll` (already in use) | New API handles chunked cookies and edge cases |
| Manual cookie maxAge configuration | `DEFAULT_COOKIE_OPTIONS` (400 days built-in) | No configuration needed for long-lived cookies |

---

## Open Questions

1. **Supabase hosted dashboard session settings**
   - What we know: `config.toml` has `[auth.sessions]` commented out (no timebox/inactivity on local)
   - What's unclear: Whether the hosted project (Supabase cloud) has independent session settings that
     override the local config. Only Andrew can verify by visiting Dashboard → Auth → Sessions.
   - Recommendation: Include a manual verification task in Plan 22-02. If the dashboard shows no timebox,
     the session bug may already be resolved once AUTH-18 is fixed (user was hitting the middleware loop
     instead of a genuine session expiry).

2. **Breakpoint discrepancy: docs say ≥768px, code uses lg: (1024px)**
   - What we know: `login/page.tsx` and `signup/page.tsx` both use `lg:grid-cols-2`. AuthHero is `hidden
     lg:flex`. The split panel activates at 1024px, not 768px.
   - What's unclear: Whether the ROADMAP/REQUIREMENTS success criterion of "≥768px" was intentional (use
     `md:`) or a documentation error.
   - Recommendation: Preserve the existing `lg:` breakpoint. The CONTEXT.md says "match existing v1.2 auth
     skin" and the existing skin uses `lg:`. Changing to `md:` would be a scope expansion.

---

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `app/(auth)/app/login/page.tsx` — confirmed column order, classes, JSX structure
- Direct file inspection: `app/(auth)/app/login/login-form.tsx` — confirmed Link href `/app/signup`
- Direct file inspection: `lib/supabase/proxy.ts` — confirmed middleware allow-list bug
- Direct file inspection: `app/(auth)/app/signup/signup-form.tsx` — reciprocal link already present
- Direct file inspection: `app/(auth)/_components/auth-hero.tsx` — confirmed hidden on mobile
- Direct file inspection: `node_modules/@supabase/ssr/dist/main/utils/constants.js` — DEFAULT_COOKIE_OPTIONS.maxAge = 400 days
- Direct file inspection: `node_modules/@supabase/ssr/dist/main/types.d.ts` — SetAllCookies headers param
- Direct file inspection: `supabase/config.toml` — auth settings, sessions block commented out

### Secondary (MEDIUM confidence)
- [Supabase Auth Sessions docs](https://supabase.com/docs/guides/auth/sessions) — session controls require Pro plan; refresh tokens never expire by default
- [Supabase Next.js SSR guide](https://supabase.com/docs/guides/auth/server-side/nextjs) — getClaims() is the correct proxy method

### Tertiary (LOW confidence)
- [supabase/ssr GitHub issue #40](https://github.com/supabase/ssr/issues/40) — historic cookieOptions.maxAge bug (resolved in 0.10.x; current DEFAULT is 400 days)

---

## Metadata

**Confidence breakdown:**
- AUTH-18 root cause: HIGH — confirmed by code inspection of middleware and link
- AUTH-19 layout fix: HIGH — confirmed by code inspection of page.tsx JSX structure
- AUTH-20 cookie TTL: HIGH — confirmed by node_modules source
- AUTH-20 dashboard settings: MEDIUM — inferred, requires manual verification
- Claude's Discretion recommendations: MEDIUM — grounded in code but judgment calls

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (stable libraries; dashboard settings may change)

---

## Plan-Ready Summary

### Plan 22-01: AUTH-18 + AUTH-19 (UI-only changes)

| Task | File | Change |
|------|------|--------|
| AUTH-18: fix middleware allow-list | `lib/supabase/proxy.ts` | Add array `["/app/login", "/app/signup", "/app/forgot-password", "/app/verify-email"]` to the auth gate condition |
| AUTH-19: swap login page columns | `app/(auth)/app/login/page.tsx` | Move `<AuthHero>` to first child, `<main>` to second child in `lg:grid-cols-2` div. No class changes needed. |
| AUTH-18 (bonus): verify reciprocal link | `app/(auth)/app/signup/signup-form.tsx` | Already correct — `href="/app/login"` present. No change needed. |

Total file changes: 2 files. Total line changes: ~8.

### Plan 22-02: AUTH-20 (Session configuration + verification)

| Task | Location | Change |
|------|----------|--------|
| Verify Supabase dashboard sessions | Supabase Dashboard → Auth → Sessions | Manual: confirm no timebox or inactivity timeout (manual step for Andrew) |
| Improve proxy.ts setAll headers | `lib/supabase/proxy.ts` | Pass `headers` param in `setAll` to avoid CDN cache issues on token refresh |
| Verify cookie TTL in browser | DevTools → Application → Cookies | Manual: confirm `sb-*-auth-token` cookie expires ~400 days out after login |
| Smoke-test sliding session | Browser | Manual: log in, wait 61 minutes (or advance clock), reload `/app`, confirm session persists |

Total code file changes: 1 file (`proxy.ts`). 1 new manual step block for Andrew.
