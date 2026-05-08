# Phase 38: Magic-Link Login - Research

**Researched:** 2026-05-08
**Domain:** Supabase OTP auth, Next.js server actions, rate limiting, UI toggle primitives
**Confidence:** HIGH (all key findings verified from installed packages and codebase)

---

## Summary

Phase 38 adds a passwordless email login path inside the existing `/app/login` card. The implementation maps cleanly onto the existing auth patterns in this codebase: server actions (`"use server"`), `useActionState`, Zod validation, `checkAuthRateLimit`, and the existing `/auth/confirm` route handler. No new routes or infrastructure are needed.

The `signInWithOtp` API is documented in the installed `@supabase/auth-js` package at version 2.103.1. Critical finding: `shouldCreateUser` defaults to `true` and MUST be explicitly set to `false` for login-only mode. When set to `false`, Supabase returns an error for unknown emails — this error must be swallowed server-side for enumeration safety (same pattern as `forgot-password/actions.ts`).

The `rate_limit_events` table schema (key: text, occurred_at: timestamptz) fits the IP+email composite key pattern without modification. The helper in `lib/auth/rate-limits.ts` can be extended with one new entry (`magicLink`) using the same `checkAuthRateLimit` wrapper.

The 30-second resend cooldown is best handled with a client-side `setInterval` — the exact same pattern as `resend-verification-button.tsx` — because 30 seconds is short enough that reload-survival provides no practical UX benefit, and the verify-email component already establishes this as the codebase convention.

**Primary recommendation:** Model `requestMagicLinkAction` exactly on `requestPasswordReset` (forgot-password). Model the resend-countdown UI exactly on `ResendVerificationButton`. Use the existing `Tabs`/`TabsList`/`TabsTrigger` primitives from `components/ui/tabs.tsx` for the Password | Magic link toggle.

---

## Standard Stack

No new packages are required. Everything needed is already installed.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.103.1 | `signInWithOtp` call | Already installed; provides the OTP API |
| `@supabase/ssr` | ^0.10.2 | Server client with PKCE default | Already installed; `createClient()` in `lib/supabase/server.ts` |
| `react-hook-form` | ^7.72.1 | Form state management | Consistent with all other auth forms |
| `zod` | ^4.3.6 | Request validation | Consistent with all other auth forms |
| `radix-ui` | ^1.4.3 | `Tabs` primitive | Already installed; `components/ui/tabs.tsx` wraps it |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^1.8.0 | `Loader2` spinner | Submit loading state |
| `shadcn/ui` Card, Alert, Button, Input, Label | in-repo | UI primitives | Consistent with all other auth forms |

**Installation:** None required. All dependencies exist.

---

## Architecture Patterns

### Recommended Project Structure

The magic-link feature adds to the existing login route without creating new routes:

```
app/(auth)/app/login/
├── actions.ts          ← ADD: requestMagicLinkAction + magicLinkSchema export
├── login-form.tsx      ← MODIFY: add toggle + magic-link sub-form
├── magic-link-success.tsx  ← NEW: success state with resend countdown
├── page.tsx            ← NO CHANGE (subtitle text may need update)
└── schema.ts           ← ADD: magicLinkSchema (email-only Zod schema)
```

Alternatively, `requestMagicLinkAction` can live in `actions.ts` alongside `loginAction` — this keeps all auth actions for the login page co-located.

### Pattern 1: Server Action for Magic Link Request

Modeled directly on `app/(auth)/app/forgot-password/actions.ts`.

```typescript
// Source: app/(auth)/app/forgot-password/actions.ts (existing pattern, verified)
"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkAuthRateLimit } from "@/lib/auth/rate-limits";
import { magicLinkSchema } from "./schema";

export type MagicLinkState = {
  success?: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<"email", string[]>>;
};

export async function requestMagicLinkAction(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  // 1. Zod validate
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { email } = parsed.data;

  // 2. Rate limit: 5 per (IP + email) per hour (AUTH-28 revised)
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";

  // Silent rate-limit: always return success shape, never leak throttle status
  const rl = await checkAuthRateLimit("magicLink", `${ip}:${email}`);
  if (!rl.allowed) {
    // Intentionally return success — attacker cannot distinguish from real send
    return { success: true };
  }

  // 3. Call Supabase — shouldCreateUser: false (login-only)
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,   // CRITICAL: login-only, do not create new users
      emailRedirectTo: `${origin}/auth/confirm?next=/app`,
    },
  });

  // 4. Enumeration-safe: NEVER return Supabase errors to client
  //    Supabase returns an error when shouldCreateUser:false + unknown email.
  //    Logging server-side only (same pattern as forgot-password).
  if (error) {
    console.error("[magic-link] signInWithOtp error (not returned to client):", error.message);
  }

  // 5. Always return the same success state
  return { success: true };
}
```

**Key points verified from source:**
- `shouldCreateUser` defaults to `true` in `@supabase/auth-js` — must be explicitly `false`
- Supabase returns an error for unknown email when `shouldCreateUser: false` — must be swallowed
- `emailRedirectTo` is the redirect URL embedded in the email; Supabase appends `token_hash` and `type=magiclink` as query params
- The PKCE flow is automatic — `@supabase/ssr` defaults `flowType: "pkce"` (confirmed in `node_modules/@supabase/ssr/dist/main/createServerClient.js:31`)

### Pattern 2: Rate Limit Config Extension

Add one entry to `lib/auth/rate-limits.ts`:

```typescript
// Source: lib/auth/rate-limits.ts (existing, verified)
export const AUTH_RATE_LIMITS = {
  // ... existing entries ...
  magicLink: { max: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour / (IP+email)
} as const;
```

The key passed to `checkAuthRateLimit` should be `\`${ip}:${email}\`` (same pattern as `forgotPassword`). The stored key becomes `auth:magicLink:${ip}:${email}` — compatible with the existing `rate_limit_events` table and `checkRateLimit` helper.

### Pattern 3: Toggle Component

Use `Tabs` / `TabsList` / `TabsTrigger` from `components/ui/tabs.tsx`. These wrap Radix UI `Tabs.Root` and are already used in `embed-tabs.tsx`.

The toggle has only two tabs: `"password"` and `"magic-link"`. `defaultValue="password"` (per CONTEXT.md lock).

```typescript
// Source: components/ui/tabs.tsx (verified) + embed-tabs.tsx (usage reference)
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

<Tabs defaultValue="password">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="password">Password</TabsTrigger>
    <TabsTrigger value="magic-link">Magic link</TabsTrigger>
  </TabsList>
  <TabsContent value="password">
    {/* existing email + password fields + submit */}
  </TabsContent>
  <TabsContent value="magic-link">
    {/* shared email field + magic-link submit + success state */}
  </TabsContent>
</Tabs>
```

**Note on layout:** The toggle wraps inside the Card below the existing Google OAuth + divider. The shared email field lives inside `TabsContent` for each tab (two separate `Input` renders with the same `id`/`name`). An alternative is a single email Input above the tabs — but that complicates form submission because each `<form action>` needs to control its own submit. Simpler to duplicate the email field per tab. Each tab is a separate `<form>` with its own action.

### Pattern 4: Success State with Resend Countdown

Modeled on `resend-verification-button.tsx` (client-side `setInterval`).

**Judgment on 30s vs. server-rendered:** The Phase 37 context recommends server-rendered when precision across reloads is not needed. For a 30-second countdown that resets on each send, client-side `setInterval` is the right call: (a) the verify-email precedent uses `setInterval` for 60s, (b) 30s is too short to survive reload meaningfully, (c) the server action returns `success: true` which triggers the countdown start — no server-rendered timestamp needed.

```typescript
// Source: app/(auth)/app/verify-email/resend-verification-button.tsx (existing pattern, verified)
const [cooldownSeconds, setCooldownSeconds] = useState(0);

useEffect(() => {
  if (state.success) setCooldownSeconds(30);
}, [state.success]);

useEffect(() => {
  if (cooldownSeconds <= 0) return;
  const id = setInterval(() => {
    setCooldownSeconds((s) => (s <= 1 ? 0 : s - 1));
  }, 1000);
  return () => clearInterval(id);
}, [cooldownSeconds]);
```

### Pattern 5: Email/Password Card Restructuring

The existing `<Card>` in `login-form.tsx` contains a `<form action={formAction}>` wrapping email + password + submit. The toggle must be added inside this Card, restructuring the form:

**Before:** Single Card with one form (email + password + submit)
**After:** Card with Tabs at top; each TabsContent has its own form

This means the `loginAction` form stays inside `TabsContent value="password"`, and `requestMagicLinkAction` form lives inside `TabsContent value="magic-link"`.

The `useActionState` hook for `loginAction` stays. A second `useActionState` for `requestMagicLinkAction` is added alongside it in `LoginForm`.

The `resetSuccess` alert (shown after password reset) should remain above the Tabs, visible regardless of active tab.

### Pattern 6: /auth/confirm Route (Already Handles Magic Link)

The existing `app/auth/confirm/route.ts` already handles `type=magiclink`:

```typescript
// Source: app/auth/confirm/route.ts (verified, lines 1-61)
// Already handles: "signup" | "recovery" | "magiclink" | "email_change"
// For magiclink: redirects to `next` query param (default /app)
// No changes needed to this file.
```

The `emailRedirectTo` passed in `signInWithOtp` must be:
```
${NEXT_PUBLIC_APP_URL}/auth/confirm?next=/app
```
Supabase will append `token_hash=...&type=magiclink` to this URL automatically when constructing the magic link.

**The confirm route already sends magic link sessions to `/app`.** No changes needed.

### Anti-Patterns to Avoid

- **Do NOT pass `next` via `emailRedirectTo` to let the user control landing.** The decision is `next=/app` always.
- **Do NOT return Supabase errors to the client** when `shouldCreateUser: false` rejects an unknown email. Swallow server-side.
- **Do NOT show a different UI for rate-limited requests** vs. successful sends. Silent rate-limit = same success state shown.
- **Do NOT use a single `<form>` wrapping both tabs.** Each tab needs its own `<form action={...}>` so the correct server action fires.
- **Do NOT use `state === "password"` React state to implement the toggle.** Use Radix Tabs controlled via `defaultValue` — less code, accessible keyboard navigation for free.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OTP email send | Custom email + token generation | `supabase.auth.signInWithOtp()` | Handles PKCE, token storage, expiry, email delivery |
| Magic link callback | Custom token verification | Existing `/auth/confirm/route.ts` | Already handles `type=magiclink` — no change needed |
| Rate limiting | Custom in-memory/Redis store | `checkAuthRateLimit("magicLink", ...)` | Existing Postgres-backed helper with correct IP+email keying |
| Resend countdown | Custom animation library | `useState` + `setInterval` | Established pattern in `resend-verification-button.tsx` |
| Tab/segmented control | Custom toggle buttons with manual state | `Tabs`/`TabsList`/`TabsTrigger` from `components/ui/tabs.tsx` | Accessibility, keyboard nav, already in repo |

**Key insight:** The codebase has already solved every sub-problem. This phase wires existing primitives together.

---

## Common Pitfalls

### Pitfall 1: `shouldCreateUser` Defaults to True
**What goes wrong:** If `shouldCreateUser` is omitted, unknown emails get auto-registered as new users. This breaks the login-only requirement and silently enrolls visitors.
**Why it happens:** The API default is `true` (verified in `node_modules/@supabase/auth-js/dist/main/lib/types.d.ts:525`).
**How to avoid:** Always pass `options: { shouldCreateUser: false }` explicitly.
**Warning signs:** New users appearing in Supabase Auth dashboard after magic-link submits with unknown emails.

### Pitfall 2: Returning Supabase Error for Unknown Email
**What goes wrong:** When `shouldCreateUser: false`, Supabase returns a 400 error for unknown emails. If this error is surfaced to the client (even as a generic "something went wrong"), it leaks account existence.
**Why it happens:** Known upstream issue — GitHub supabase/auth#1547. Supabase does not currently make this response uniform.
**How to avoid:** Always return `{ success: true }` regardless of whether `error` is set, after logging the error server-side. Identical to the `forgot-password` pattern.
**Warning signs:** Different UI shown for known vs. unknown emails after submit.

### Pitfall 3: Timing Attack via Response Latency
**What goes wrong:** The server action takes longer for known emails (Supabase actually sends an email) vs. unknown emails (fast 400 error). A timing attacker could enumerate accounts.
**Why it happens:** Network latency difference between "email sent" and "instant error".
**Assessment:** For this single-owner scheduling app (low attacker value), timing attack resistance is LOW priority. The codebase has not added artificial delays in `forgot-password`. Accept the same risk here — document it but don't add `await setTimeout(randomDelay)`.
**Warning signs:** Not applicable at this threat model.

### Pitfall 4: Magic Link Email Template Not Updated for PKCE
**What goes wrong:** The default Supabase magic link email template uses `{{ .ConfirmationURL }}` which may route to Supabase's own domain, not your `/auth/confirm` route. With PKCE, the template must use a URL that includes `token_hash` pointing to your app.
**Why it happens:** The template needs `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink` for PKCE flow.
**How to avoid:** Set the magic link template in Supabase Dashboard > Auth > Email Templates > Magic Link. See Manual Config Steps below.
**Warning signs:** After clicking the magic link, user lands on Supabase's domain or gets a session error.

### Pitfall 5: Two Forms with Same Email Field ID
**What goes wrong:** Both the password tab form and the magic-link tab form include an email `<Input id="email">`. Duplicate IDs are invalid HTML, causing accessibility failures and potential `htmlFor` label mismatches.
**How to avoid:** Use distinct IDs per tab: `id="email-password"` and `id="email-magic"`, with matching `<Label htmlFor>`.

### Pitfall 6: Rate Limit Key Already Used for `forgotPassword`
**What goes wrong:** If the key format for `magicLink` accidentally matches `forgotPassword` (both use IP+email), the two flows could share rate limit counters.
**Why it doesn't happen:** `checkAuthRateLimit` namespaces keys as `auth:${route}:${identifier}` — `auth:magicLink:${ip}:${email}` vs `auth:forgotPassword:${ip}:${email}` are distinct.
**How to avoid:** Verify the route key is `"magicLink"` (not `"forgotPassword"`).

### Pitfall 7: `revalidatePath` / `redirect` Inside Magic Link Action
**What goes wrong:** Unlike `loginAction`, the magic-link action does NOT redirect on success — it returns `{ success: true }` to trigger the inline success state. Adding `redirect()` would break the "stay on page" UX.
**How to avoid:** Return `{ success: true }` only. Do not call `redirect()` or `revalidatePath()`.

---

## Code Examples

### Verified: signInWithOtp with login-only config
```typescript
// Source: node_modules/@supabase/auth-js/dist/main/lib/types.d.ts (lines 520-530)
// shouldCreateUser defaults to true — must be false for login-only
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: false,
    emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/app`,
  },
});
// Always swallow error — return success either way (enumeration safety)
```

### Verified: Rate limit call pattern (IP+email key)
```typescript
// Source: lib/auth/rate-limits.ts (verified) + app/(auth)/app/forgot-password/actions.ts
const h = await headers();
const ip =
  h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  h.get("x-real-ip") ??
  "unknown";
const rl = await checkAuthRateLimit("magicLink", `${ip}:${email}`);
if (!rl.allowed) {
  return { success: true }; // silent rate-limit — same shape as real send
}
```

### Verified: 30-second resend countdown (client-side setInterval)
```typescript
// Source: app/(auth)/app/verify-email/resend-verification-button.tsx (verified)
const [cooldownSeconds, setCooldownSeconds] = useState(0);

useEffect(() => {
  if (state.success) setCooldownSeconds(30); // 30s instead of 60s
}, [state.success]);

useEffect(() => {
  if (cooldownSeconds <= 0) return;
  const id = setInterval(() => {
    setCooldownSeconds((s) => (s <= 1 ? 0 : s - 1));
  }, 1000);
  return () => clearInterval(id);
}, [cooldownSeconds]);

// Button label:
// isPending → "Sending…"
// cooldownSeconds > 0 → `Resend in ${cooldownSeconds}s`
// else → "Send login link"
```

### Verified: Tabs toggle structure
```typescript
// Source: components/ui/tabs.tsx + app/(shell)/app/event-types/_components/embed-tabs.tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Inside the Card's CardContent, replacing the current single <form>:
<Tabs defaultValue="password">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="password">Password</TabsTrigger>
    <TabsTrigger value="magic-link">Magic link</TabsTrigger>
  </TabsList>
  <TabsContent value="password">
    <form action={loginFormAction} className="flex flex-col gap-4">
      {/* email + password fields */}
    </form>
  </TabsContent>
  <TabsContent value="magic-link">
    {magicLinkState.success ? <MagicLinkSuccessState ... /> : (
      <form action={magicLinkFormAction} className="flex flex-col gap-4">
        {/* email field + submit */}
      </form>
    )}
  </TabsContent>
</Tabs>
```

### Verified: Auth confirm route already handles magiclink
```typescript
// Source: app/auth/confirm/route.ts (verified, line 57)
// "All other types (signup, magiclink, email_change) — redirect to `next`."
// No changes needed to this file.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `signInWithMagicLink()` (deprecated) | `signInWithOtp({ email })` | auth-js v2 | Different API; `shouldCreateUser` option added |
| Implicit auth flow (fragment-based) | PKCE flow via `/auth/confirm?token_hash=...` | @supabase/ssr default | More secure; `verifyOtp` at callback instead of `getSessionFromUrl` |
| Client-side Supabase client for OTP | Server action → server-side Supabase client | Codebase convention since Phase 02 | Consistent with all auth actions in this app |

**Deprecated/outdated:**
- `signInWithMagicLink()`: replaced by `signInWithOtp()` in auth-js v2; not present in v2.103.1.
- `exchangeCodeForSession()`: legacy callback pattern; this app uses `verifyOtp` in `/auth/confirm`.

---

## Manual Config Steps

These steps require the Supabase Dashboard and cannot be automated via code.

### Step 1: Set Magic Link Email Template (REQUIRED for PKCE)
**Where:** Supabase Dashboard → Project → Authentication → Email Templates → Magic Link

**Subject:** `Your NSI login link`

**Body (minimal, per CONTEXT.md):**
```html
<p>Click below to sign in. Link expires in 15 minutes.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">Sign in to NSI</a></p>
```

**Why this template URL pattern:** PKCE flow requires `token_hash` to be sent to your app's `/auth/confirm` route (not Supabase's own verify endpoint). The existing `/auth/confirm/route.ts` already handles this.

**Note on `{{ .ConfirmationURL }}` vs. `{{ .TokenHash }}`:** The default `{{ .ConfirmationURL }}` points to `project-ref.supabase.co/auth/v1/verify` — this bypasses your app's PKCE callback. For PKCE, you must use the `{{ .TokenHash }}` pattern shown above.

### Step 2: Set Magic Link Expiry (REQUIRED)
**Where:** Supabase Dashboard → Project → Authentication → Configuration → Auth Settings

Look for: "OTP Expiry" or "Magic link OTP expiry" — this is the same `otp_expiry` field that controls email OTP lifetime. The local `config.toml` shows `otp_expiry = 3600` (1 hour default).

**Action:** Change to `900` seconds (15 minutes) in the production dashboard.

**Also update `config.toml` for local dev:**
```toml
# [auth.email]
otp_expiry = 900   # 15 minutes (was 3600)
```

**Note:** This change affects ALL email OTP flows (magic link, email verification). Verify this does not break other flows (signup confirmation OTPs use the same field).

### Step 3: Verify Redirect URL Allowlist
**Where:** Supabase Dashboard → Project → Authentication → URL Configuration

Ensure `${NEXT_PUBLIC_APP_URL}/auth/confirm` (or `*` wildcard for the domain) is in the allowed redirect URLs. The existing Google OAuth setup already required this; confirm it covers the magic link path.

---

## Divergence Reconciliation: Rate Limit (REQUIRED PLANNER ACTION)

**CONTEXT.md decision:** 5 requests / hour, per (IP + email)
**ROADMAP.md success criterion #3 + REQUIREMENTS.md AUTH-28:** 3 requests / hour, per IP

**Recommendation:** Update REQUIREMENTS.md AUTH-28 and ROADMAP.md Phase 38 success criterion #3 to match CONTEXT.md. The user's intent is clearly documented in CONTEXT.md as 5/hour + IP+email scope. The ROADMAP text predates the user's CONTEXT.md decision.

**Proposed updated text for AUTH-28:**
> Magic-link requests rate-limited via `rate_limit_events` (5/hour per (IP+email) pair, silent on throttle)

**Proposed updated ROADMAP success criterion #3:**
> More than 5 magic-link requests from the same IP+email pair within one hour are silently rejected (rate-limited via `rate_limit_events`); throttled requests return the same success message as real sends — no enumeration or throttle leakage.

---

## Open Questions

1. **`otp_expiry` affects all email OTP flows**
   - What we know: `config.toml` `otp_expiry = 3600` controls email OTP expiry globally for the project
   - What's unclear: Whether changing to 900 seconds breaks signup confirmation flow (if enabled) or email-change OTP
   - Recommendation: Check `[auth.email] enable_confirmations = false` in config.toml — confirmations are disabled, so signup confirmation OTPs are not in use. Email-change OTP (Phase 10) uses `otp_expiry` too; 15 minutes should be acceptable for email-change as well. Planner should verify this is acceptable.

2. **Success state and `state.success` reset on tab switch**
   - What we know: `useActionState` state is persistent within component lifetime
   - What's unclear: If user submits magic link, sees success state, then switches to Password tab and back — should the success state clear?
   - Recommendation: Yes, clear it. Implement with a React `key` on `TabsContent value="magic-link"` or explicit `useState` to track whether to show success vs. form.

3. **`formError` for true server errors (Claude's Discretion)**
   - What we know: Supabase 5xx errors should show a distinct "Something went wrong" message
   - Recommendation: Gate on `error?.status && error.status >= 500` (same pattern as `loginAction`). Log server-side; show a generic error Alert to the client. This is the only case where the magic-link action returns a `formError` instead of `success: true`.

4. **`page.tsx` subtitle text**
   - Current subtitle: "Enter your email and password to continue."
   - After this phase, magic link is an alternative — subtitle should be updated
   - Recommendation: Change to "Sign in with your email and password or a magic link." (Planner to confirm exact copy.)

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@supabase/auth-js/dist/main/lib/types.d.ts` — `SignInWithPasswordlessCredentials` type definition; `shouldCreateUser` default confirmed as `true`
- `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js` — `signInWithOtp` implementation; PKCE code challenge generation confirmed
- `node_modules/@supabase/ssr/dist/main/createServerClient.js:31` — `flowType: "pkce"` default confirmed
- `app/(auth)/app/login/actions.ts` — server action pattern, IP extraction
- `app/(auth)/app/login/login-form.tsx` — existing card layout, `useActionState` pattern
- `app/(auth)/app/forgot-password/actions.ts` — enumeration-safe action pattern (direct model for magic link action)
- `app/(auth)/app/forgot-password/forgot-password-form.tsx` — inline-replace success state pattern
- `app/(auth)/app/verify-email/resend-verification-button.tsx` — `setInterval` resend countdown pattern
- `lib/rate-limit.ts` + `lib/auth/rate-limits.ts` — rate limit helpers and config
- `supabase/migrations/20260427120000_rate_limit_events.sql` — `rate_limit_events` schema
- `app/auth/confirm/route.ts` — magic link callback already handled via `type=magiclink`
- `supabase/config.toml` — `otp_expiry = 3600` confirmed; template stanza structure confirmed
- `components/ui/tabs.tsx` — Tabs primitive available, uses Radix UI

### Secondary (MEDIUM confidence)
- Supabase official docs `https://supabase.com/docs/guides/auth/auth-magic-link` — `shouldCreateUser: false` behavior, `emailRedirectTo`, expiry config location
- Supabase official docs `https://supabase.com/docs/guides/auth/auth-email-templates` — `{{ .TokenHash }}` and `{{ .SiteURL }}` template variables

### Tertiary (LOW confidence — for awareness only)
- GitHub supabase/auth#1547 — `shouldCreateUser: false` leaks account existence; status unknown but the risk exists in current version; our mitigation is correct (swallow error server-side)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages installed, versions confirmed
- Architecture: HIGH — direct models exist in codebase (forgot-password, resend-verification-button, embed-tabs)
- Supabase API: HIGH — types and implementation confirmed from installed `node_modules`
- PKCE callback: HIGH — `/auth/confirm` already handles `type=magiclink`
- Email template: MEDIUM — dashboard location described from docs; exact current field names not verified in live dashboard
- OTP expiry config: HIGH (local) / MEDIUM (production dashboard) — `config.toml` key confirmed; production dashboard UI not directly verified
- Enumeration safety: HIGH — swallowing Supabase error is the correct mitigation regardless of upstream issue status
- Pitfalls: HIGH — derived from codebase evidence and confirmed upstream issue

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (Supabase auth-js stable; 30-day window)
