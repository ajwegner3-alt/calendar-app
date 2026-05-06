# Phase 34: Google OAuth Signup + Credential Capture - Research

**Researched:** 2026-05-06
**Domain:** Supabase Google OAuth, Gmail scope, AES-256-GCM token encryption, Next.js App Router OAuth callback
**Confidence:** HIGH (core patterns verified via official Supabase docs, Google docs); MEDIUM (partial-grant detection, linkIdentity with extra scopes)

---

## Summary

Phase 34 adds Google OAuth as a signup/login path, captures the Gmail `refresh_token` at the OAuth callback (the only time Supabase makes it available), encrypts it with AES-256-GCM, and stores it in a new `account_oauth_credentials` table. Existing email/password users can connect or disconnect Gmail from `/app/settings`.

The standard Supabase approach for capturing a Google `provider_refresh_token` is to intercept the PKCE callback in a dedicated route handler (`/auth/google-callback`) where `exchangeCodeForSession` returns `data.session.provider_refresh_token` for one request only — Supabase never persists it server-side beyond that exchange. Encryption uses Node `crypto` with a 32-byte hex key from `GMAIL_TOKEN_ENCRYPTION_KEY`.

**Primary recommendation:** Extend the existing `/auth/confirm` route handler pattern (already in `app/auth/confirm/route.ts`) with a new Google-specific callback route (`app/auth/google-callback/route.ts`) that handles PKCE exchange AND token storage in one atomic operation. This keeps the existing confirm handler clean and avoids scope-detection logic bleeding into the general OTP handler.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.103.1` (already installed) | `signInWithOAuth`, `linkIdentity`, `unlinkIdentity`, `getUserIdentities` | Supabase official client |
| `@supabase/ssr` | `^0.10.2` (already installed) | SSR-safe Supabase client with cookie handling | Required for Next.js App Router |
| Node.js `crypto` | Built-in (Node 20 — already in `engines`) | AES-256-GCM token encryption | No extra install; FIPS-grade |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | `0.0.1` (already installed) | Prevent accidental client import of encryption utils | Mark `lib/oauth/encrypt.ts` with it |

### No New Dependencies Needed

All required functionality is available through the existing stack. The `fetch` API (Node 18+) is sufficient for the Google token revocation HTTP call.

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── auth/
│   ├── confirm/route.ts          # EXISTING — OTP handler; leave untouched
│   └── google-callback/route.ts  # NEW — Google OAuth PKCE + token capture
├── (auth)/app/
│   ├── signup/
│   │   ├── page.tsx              # MODIFY — add Google button above existing form
│   │   ├── signup-form.tsx       # MODIFY — add GoogleSignupButton + divider
│   │   └── actions.ts            # MODIFY — add initiateGoogleOAuthAction
│   └── login/
│       ├── page.tsx              # MODIFY — add Google button above existing form
│       └── login-form.tsx        # MODIFY — add GoogleSignupButton + divider
├── (shell)/app/
│   ├── settings/
│   │   └── gmail/                # NEW — Gmail connect/disconnect settings panel
│   │       ├── page.tsx
│   │       └── actions.ts
│   └── app/                      # settings nav — add Gmail link
└── onboarding/
    └── step-4-gmail/             # NEW — skippable Gmail connect step
        ├── page.tsx
        └── gmail-connect-form.tsx

lib/
├── oauth/
│   ├── encrypt.ts                # NEW — encryptToken / decryptToken (AES-256-GCM)
│   └── google.ts                 # NEW — initiateGoogleOAuth, revokeGoogleToken helpers
└── supabase/
    └── server.ts                 # EXISTING — no changes needed

supabase/migrations/
└── 20260506120000_phase34_account_oauth_credentials.sql  # NEW
```

### Pattern 1: Google OAuth Initiation (Client Button → Server Action)

**What:** A server action that calls `supabase.auth.signInWithOAuth` with the combined scopes and returns a redirect URL, which the client button navigates to.

**When to use:** For both signup and login Google button clicks. The same server action handles both paths — Supabase determines whether to create a new user or sign in an existing one based on email matching.

```typescript
// Source: https://supabase.com/docs/guides/auth/social-login/auth-google
// app/(auth)/app/signup/actions.ts (add to existing file)
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function initiateGoogleOAuthAction(): Promise<void> {
  const h = await headers();
  const origin =
    h.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/google-callback`,
      scopes: "email profile https://www.googleapis.com/auth/gmail.send",
      queryParams: {
        access_type: "offline",   // required to get a refresh_token from Google
        prompt: "consent",        // required to re-prompt even if user previously consented
      },
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? "OAuth initiation failed");
  }

  redirect(data.url);
}
```

**Key insight:** `access_type: "offline"` alone is not enough. If the user previously consented, Google will NOT re-issue a refresh token unless `prompt: "consent"` is also present. This is the most common production gotcha.

### Pattern 2: Google OAuth Callback Route Handler (PKCE Exchange + Token Capture)

**What:** A new Route Handler at `app/auth/google-callback/route.ts` that:
1. Exchanges the PKCE code for a session (which contains `provider_refresh_token` — available only at this moment)
2. Reads `granted_scopes` from the session to detect if `gmail.send` was denied
3. Encrypts and stores the refresh token in `account_oauth_credentials`
4. Redirects appropriately (onboarding or dashboard)

```typescript
// Source: https://supabase.com/docs/guides/auth/social-login/auth-google
// https://github.com/orgs/supabase/discussions/22653
// app/auth/google-callback/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/oauth/encrypt";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // User denied at the OAuth consent screen (not a partial grant — full cancel)
  if (error) {
    return NextResponse.redirect(new URL("/app/signup?google_error=access_denied", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth/auth-error?reason=missing_code", request.url));
  }

  const supabase = await createClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    return NextResponse.redirect(
      new URL(`/auth/auth-error?reason=${encodeURIComponent(exchangeError?.message ?? "exchange_failed")}`, request.url)
    );
  }

  const session = data.session;
  const userId = session.user.id;

  // Detect partial grant — gmail.send may have been denied
  // Google returns granted scopes in provider_token metadata; the session
  // exposes them as a space-separated string in session.user.user_metadata
  // or via the token info endpoint. Simplest approach: check provider_refresh_token
  // presence — if gmail.send was denied, Google typically does not issue a refresh token.
  // More reliable: parse session.user.app_metadata.provider_token scope field (see note below).
  const providerRefreshToken = session.provider_refresh_token ?? null;
  const gmailGranted = !!providerRefreshToken;  // conservative heuristic; see Open Questions

  if (providerRefreshToken) {
    // Encrypt and store
    const encryptedToken = encryptToken(providerRefreshToken);
    const grantedScopes = "email profile https://www.googleapis.com/auth/gmail.send"; // if confirmed

    await supabase
      .from("account_oauth_credentials")
      .upsert(
        {
          user_id: userId,
          provider: "google",
          refresh_token_encrypted: encryptedToken,
          granted_scopes: grantedScopes,
          connected_at: new Date().toISOString(),
          last_refresh_at: new Date().toISOString(),
          status: "connected",
        },
        { onConflict: "user_id,provider" }
      );
  }

  // Determine redirect: new user → onboarding, existing → /app
  // The existing trigger (provision_account_for_new_user) fires on auth.users insert,
  // so new Google users will already have an accounts stub row.
  // Check onboarding_complete to route correctly.
  const { data: accountData } = await supabase
    .from("accounts")
    .select("onboarding_complete")
    .eq("owner_user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  const isNewUser = !accountData?.onboarding_complete;

  if (isNewUser) {
    // New signup via Google — go to onboarding; step-4 (Gmail connect) shows if !gmailGranted
    const gmailParam = gmailGranted ? "" : "?gmail_skipped=1";
    return NextResponse.redirect(new URL(`/onboarding${gmailParam}`, request.url));
  }

  // Existing user linking Google — return to settings with success banner
  return NextResponse.redirect(new URL("/app/settings/gmail?linked=1", request.url));
}
```

**Critical:** `session.provider_refresh_token` is available **only** in the response from `exchangeCodeForSession`. It is NOT stored by Supabase and will NOT be accessible from `getSession()` on subsequent requests. You must capture it here.

### Pattern 3: AES-256-GCM Encryption (Node crypto)

**What:** A server-only encryption utility using Node's built-in `crypto` module.

```typescript
// Source: https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81
// Verified against Node.js crypto docs
// lib/oauth/encrypt.ts
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const KEY_HEX = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;

function getKey(): Buffer {
  if (!KEY_HEX) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY env var not set");
  }
  const key = Buffer.from(KEY_HEX, "hex");
  if (key.length !== 32) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)");
  }
  return key;
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a colon-delimited string: iv:authTag:ciphertext (all hex-encoded).
 * Each call generates a fresh 12-byte random IV — safe for single-key reuse.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypts a token encrypted by encryptToken.
 * Throws if the auth tag doesn't match (tampered ciphertext).
 */
export function decryptToken(stored: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/** Generate a valid key for development (print once, store in .env.local) */
export function generateKey(): string {
  return randomBytes(32).toString("hex");
}
```

**Storage format:** `iv:authTag:ciphertext` — all hex. Total length for a typical Google refresh token: ~200–250 chars. Fits comfortably in a `text` column.

### Pattern 4: `linkIdentity()` for Existing Email/Password Users

**What:** An authenticated user on `/app/settings/gmail` clicks "Connect Gmail." A server action calls `linkIdentity` which redirects to Google consent.

```typescript
// Source: https://supabase.com/docs/guides/auth/auth-identity-linking
// app/(shell)/app/settings/gmail/actions.ts
"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function connectGmailAction(): Promise<void> {
  const h = await headers();
  const origin =
    h.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/google-callback`,
      scopes: "email profile https://www.googleapis.com/auth/gmail.send",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? "Link initiation failed");
  }

  // linkIdentity returns a URL to redirect to (same as signInWithOAuth)
  // Note: redirect() in server action works here
  const { redirect } = await import("next/navigation");
  redirect(data.url);
}
```

**Prerequisite for local dev:** `enable_manual_linking = true` must be set in `supabase/config.toml` under `[auth]`. Also enable "Enable Manual Linking" in the Supabase Dashboard (Auth → Configuration).

### Pattern 5: Disconnect + Revoke

**What:** A server action that revokes the Google token, deletes the `account_oauth_credentials` row, and optionally calls `unlinkIdentity`.

```typescript
// app/(shell)/app/settings/gmail/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/oauth/encrypt";

export async function disconnectGmailAction(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return { error: "Not authenticated" };

  const userId = claimsData.claims.sub as string;

  // 1. Fetch the encrypted refresh token
  const adminClient = createAdminClient();
  const { data: cred } = await adminClient
    .from("account_oauth_credentials")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  // 2. Revoke at Google (best-effort — don't block disconnect if revocation fails)
  if (cred?.refresh_token_encrypted) {
    try {
      const refreshToken = decryptToken(cred.refresh_token_encrypted);
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
        { method: "POST" }
      );
    } catch (err) {
      console.error("[disconnectGmail] revocation failed (non-fatal):", err);
    }
  }

  // 3. Delete the local credential row
  await adminClient
    .from("account_oauth_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");

  // 4. Unlink the Google identity from Supabase auth (optional — decide per trade-off below)
  // See trade-offs section in Open Questions
  // await supabase.auth.unlinkIdentity(googleIdentity);

  return {};
}
```

**Note on `unlinkIdentity` trade-off:** Unlinking means the user can no longer sign in with Google at all (reverts to email/password only). This is the "clean" disconnect but has a hard Supabase requirement: the user must have at least 2 linked identities. For Phase 34, the recommendation is to unlink only if the user has >1 identity, otherwise leave the Supabase identity linked (only delete our credential row). Phase 35 reads from `account_oauth_credentials` exclusively — the Supabase identity row doesn't matter for sending.

---

## `account_oauth_credentials` Table Schema

```sql
-- supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql

create table account_oauth_credentials (
  id uuid primary key default gen_random_uuid(),

  -- Foreign key: one row per user per provider
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google')),  -- extensible for future providers

  -- The credential
  refresh_token_encrypted text not null,  -- AES-256-GCM encrypted: iv:authTag:ciphertext (hex)

  -- Scope tracking (space-delimited, mirrors OAuth spec)
  granted_scopes text,  -- e.g. 'email profile https://www.googleapis.com/auth/gmail.send'

  -- Status for Phase 35 fail-closed send logic + settings UI
  status text not null default 'connected'
    check (status in ('connected', 'needs_reconnect')),

  -- Timestamps
  connected_at timestamptz not null default now(),
  last_refresh_at timestamptz,  -- Phase 35 will update on each successful token refresh

  -- Uniqueness: one credential per user per provider
  unique (user_id, provider),

  -- Soft audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for common lookup pattern (Phase 35: getSenderForAccount)
create index account_oauth_credentials_user_id_idx
  on account_oauth_credentials (user_id);

-- RLS: enabled, user can only see/modify their own row
alter table account_oauth_credentials enable row level security;

create policy "credentials_select_own"
  on account_oauth_credentials for select
  to authenticated
  using (auth.uid() = user_id);

-- UPDATE intentionally omitted from RLS — only server actions (via admin client) mutate credentials.
-- This prevents a client-side bug from accidentally overwriting a credential.
-- Server actions use createAdminClient() which bypasses RLS.

-- Trigger to keep updated_at current
create or replace function update_oauth_credentials_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger oauth_credentials_updated_at
  before update on account_oauth_credentials
  for each row execute function update_oauth_credentials_updated_at();
```

**RLS rationale:** SELECT is RLS-scoped so the settings page can read status without needing the admin client. All writes (INSERT, UPDATE, DELETE) are performed via `createAdminClient()` in server actions, bypassing RLS intentionally — this avoids exposing `refresh_token_encrypted` in UPDATE policies while still allowing the settings page to read status.

---

## Onboarding Step 4: Gmail Connect (Skippable)

### When the step appears

The step appears when `gmail_skipped=1` is in the URL after Google OAuth redirect. For users who signed up via email/password, the step is not surfaced during onboarding (it belongs to the settings connect flow).

**Concrete rule:** After the Google callback redirects to `/onboarding?gmail_skipped=1`, the onboarding router checks this query param and redirects to `/onboarding/step-4-gmail` instead of the normal step routing. If the param is absent, step 4 is skipped entirely.

### Layout change

The existing `onboarding/layout.tsx` shows "Step X of 3" with 3 progress bars. Step 4 means: update to show "Step 4 of 4" when present. Simplest approach: add a `step4Active` boolean prop derived from the URL in the router.

**Simpler alternative:** Don't renumber. Label it "Optional: Connect Gmail" outside the progress bar. This avoids any layout.tsx changes and matches the "skippable" framing better.

**Recommendation:** Use the "Optional" label approach. The step gets its own page outside the numbered step routing, at `/onboarding/connect-gmail`. The layout's "Step X of 3" progress bar stays untouched.

### Step content (Claude's discretion)

```tsx
// app/onboarding/connect-gmail/page.tsx
// Tone: informational, not alarming. In v1.7 transitional state,
// email sending still goes through SMTP (Phase 35 not yet live) —
// so the warning is mild.

<div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
  <div className="flex items-center gap-3 mb-4">
    {/* Google G icon — SVG inline */}
    <h2 className="text-xl font-medium text-gray-900">Connect Gmail (optional)</h2>
  </div>
  <p className="text-sm text-gray-600 mt-1">
    Connecting your Gmail account lets the app send booking confirmations
    from your own address in a future update.
  </p>
  <div className="mt-4 rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
    Skipping is fine for now — you can connect Gmail later from Settings.
  </div>
  <div className="mt-6 flex flex-col gap-3">
    <ConnectGmailButton />  {/* triggers initiateGoogleOAuthAction with linkIdentity */}
    <SkipButton href="/app" />
  </div>
</div>
```

---

## Settings Panel: Gmail Connection (`/app/settings/gmail`)

### Location

New sub-page at `/app/settings/gmail`. Add "Gmail" link to the settings sidebar/nav alongside "Profile" and "Reminders".

### Status visualization (three states)

```tsx
// Status: 'connected'
<div className="flex items-center gap-2">
  <div className="h-2 w-2 rounded-full bg-green-500" />
  <span className="text-sm font-medium text-gray-900">Connected</span>
  <span className="text-sm text-gray-500">· {gmailAddress}</span>
</div>
// + Disconnect button (opens modal)

// Status: 'never_connected' (no row in account_oauth_credentials)
<div className="flex items-center gap-2">
  <div className="h-2 w-2 rounded-full bg-gray-300" />
  <span className="text-sm font-medium text-gray-500">Not connected</span>
</div>
// + Connect Gmail button

// Status: 'needs_reconnect' (row exists but status = 'needs_reconnect')
<div className="flex items-center gap-2">
  <div className="h-2 w-2 rounded-full bg-amber-500" />
  <span className="text-sm font-medium text-amber-700">Reconnect needed</span>
</div>
// + reconnect explanation + Reconnect button
```

### Disconnect modal

Use existing `AlertDialog` component from `components/ui/alert-dialog.tsx`:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline" size="sm">Disconnect</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Disconnect Gmail?</AlertDialogTitle>
      <AlertDialogDescription>
        You won&apos;t be able to send emails from your Gmail address until you reconnect.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Connected-state info shown

Show: Gmail address (`session.user.user_metadata.email` or identity email), "Connected on [date]."

---

## Branded Google Button

### Spec (from Google Identity Branding Guidelines)

- Background: `#FFFFFF`
- Border: 1px solid `#747775`
- Text: Roboto Medium 14px, color `#1F1F1F`
- Padding: 12px left (before logo), 10px after logo, 12px right after text
- Call-to-action: "Sign up with Google" (signup page) / "Sign in with Google" (login page)

### Recommended Tailwind implementation

```tsx
// components/google-oauth-button.tsx
// Google G SVG from https://developers.google.com/identity/branding-guidelines (official SVG asset)
export function GoogleOAuthButton({
  label = "Sign in with Google",
  onClick,
  isPending = false,
}: {
  label?: string;
  onClick: () => void;
  isPending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-[#747775] bg-white px-3 py-2 text-sm font-medium text-[#1F1F1F] hover:bg-gray-50 disabled:opacity-50 transition-colors"
      style={{ fontFamily: "'Roboto', sans-serif" }}
    >
      {/* Official Google G SVG */}
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fillRule="evenodd">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </g>
      </svg>
      {isPending ? "Redirecting…" : label}
    </button>
  );
}
```

**Note:** Roboto is not loaded in the current app. Options: (a) add a Google Fonts `<link>` for Roboto (simple, free), (b) use system-ui with the understanding that the brand guidelines allow "comparable" fonts when Roboto is unavailable. Recommendation: add Roboto via `next/font/google` in the auth layout for compliance.

### Divider between Google and email/password

```tsx
<div className="relative my-4">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-gray-200" />
  </div>
  <div className="relative flex justify-center text-sm">
    <span className="bg-white px-3 text-gray-500">or</span>
  </div>
</div>
```

---

## Existing Account + Auto-Link Behavior

### Signup with Google when email already exists (email/password account)

Supabase automatic linking handles this transparently: when the Google email matches an existing user's email, Supabase signs them in and links the Google identity — no duplicate user is created. The callback route should detect this by checking if `account_oauth_credentials` already has a row for this user (if so, it's a returning Google user, not a new link).

**Banner implementation:** On redirect to `/app` after Google OAuth for an existing user, pass `?google_linked=1` in the URL. The shell layout or dashboard page reads this param and shows a `Sonner` toast: "Your account is now connected to Google — you can sign in either way."

### Email-mismatch case (connecting Gmail with a different email than account email)

**Recommendation:** Allow the connection. The `account_oauth_credentials.granted_scopes` and the Gmail address used for sending (Phase 35) will be the Google email, not the account email. Surfacing this clearly is the responsibility:

- On the settings panel after connection, show "Sending emails as: [gmail_address]" in small text
- On the `/onboarding/connect-gmail` step, add a note: "Confirmation emails will be sent from your connected Gmail address"

This is the safest approach for Phase 35's `getSenderForAccount` function which reads from `account_oauth_credentials` without caring about the account email match.

---

## "Needs Reconnect" Detection

**Reactive approach (recommended for Phase 34):** The `status` column defaults to `'connected'`. Phase 35 will set it to `'needs_reconnect'` when Gmail API returns `invalid_grant` (HTTP 401 with error `invalid_grant` in the response body). No cron is needed.

**Phase 34 only needs to:**
1. Create the `status` column with the enum
2. Read it on the settings page to render the correct state badge
3. Reset it to `'connected'` when the user reconnects

The column exists for Phase 35 to write to — Phase 34 never writes `'needs_reconnect'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google OAuth redirect | Custom OAuth 2.0 flow | `supabase.auth.signInWithOAuth` | PKCE, state param, nonce handled automatically |
| Identity linking | Custom merge logic | `supabase.auth.linkIdentity` | GoTrue handles the identity merge safely |
| Identity unlinking | Custom identity deletion | `supabase.auth.unlinkIdentity` | GoTrue enforces 2-identity minimum |
| Token encryption | Custom cipher or third-party lib | Node `crypto` AES-256-GCM | No extra dependency; FIPS-grade |
| Refresh token rotation | Manual refresh logic | Left to Phase 35 | Phase 34 is capture-only |
| Confirm modal | Custom modal | Existing `AlertDialog` from shadcn/ui | Already installed |

---

## Common Pitfalls

### Pitfall 1: Refresh Token Not Returned (Google)

**What goes wrong:** Google only issues a `refresh_token` when `access_type=offline` AND the user explicitly grants consent. If a user previously consented, Google may skip re-issuing a refresh token even with `access_type=offline`.

**Why it happens:** Google treats re-consent as optional for previously-authorized apps unless `prompt=consent` forces the consent screen.

**How to avoid:** Always include both `access_type: "offline"` AND `prompt: "consent"` in `queryParams`. Accept that this forces users through the consent screen on every new OAuth initiation.

**Warning signs:** `session.provider_refresh_token` is null despite successful OAuth.

### Pitfall 2: `provider_refresh_token` Available Only Once

**What goes wrong:** Code tries to read `provider_refresh_token` from `getSession()` on a subsequent request and gets null.

**Why it happens:** Supabase does not persist `provider_refresh_token` beyond the initial `exchangeCodeForSession` response. It's available only in that one response.

**How to avoid:** Capture and encrypt the token in the callback route handler immediately. Never rely on it being available later.

### Pitfall 3: Redirect URI Mismatch (Google Cloud Console + Supabase)

**What goes wrong:** OAuth fails with "redirect_uri_mismatch" error.

**Why it happens:** The redirect URI registered in Google Cloud Console must match exactly what Supabase sends. Supabase uses `https://[project-ref].supabase.co/auth/v1/callback` as its canonical redirect URI — NOT your app's URL. Your `redirectTo` parameter controls where Supabase sends the user after it handles the OAuth, but the URI in Google Cloud Console should be the Supabase callback URL.

**How to avoid:**
1. In Google Cloud Console → Credentials → OAuth Client → Authorized redirect URIs: add `https://[project-ref].supabase.co/auth/v1/callback` (find exact URL in Supabase Dashboard → Auth → Providers → Google)
2. For local dev: also add `http://localhost:54321/auth/v1/callback`
3. Do NOT add your app's `/auth/google-callback` to Google Cloud Console — that's handled by `redirectTo` in the Supabase client

**Warning signs:** Error happens at Google's consent screen redirect, not in your app.

### Pitfall 4: Vercel Preview URL Not in Supabase Allowed Redirects

**What goes wrong:** OAuth works on production but fails on Vercel preview deployments with "redirect not allowed" error.

**Why it happens:** The `redirectTo` URL (your app's `/auth/google-callback`) must be in Supabase's allowed redirect list. Preview deployments have unique URLs.

**How to avoid:** In Supabase Dashboard → Auth → URL Configuration → Additional Redirect URLs, add wildcard:
- `https://*-[vercel-team-slug].vercel.app/**`
- `http://localhost:3000/**`

**Warning signs:** Works on `main` branch deploy but fails on PR preview.

### Pitfall 5: `enable_manual_linking` Not Enabled

**What goes wrong:** `linkIdentity()` returns a 422 error: "manual linking is disabled."

**Why it happens:** Supabase disables manual identity linking by default.

**How to avoid:**
1. `supabase/config.toml`: add `enable_manual_linking = true` under `[auth]`
2. Supabase Dashboard → Auth → Configuration → Enable Manual Linking: ON
3. Restart local Supabase after config.toml change

### Pitfall 6: Two-Identity Minimum for `unlinkIdentity`

**What goes wrong:** `unlinkIdentity` returns "user must have at least 2 identities" error when a Google-only user tries to disconnect.

**Why it happens:** Supabase prevents users from being locked out of their account.

**How to avoid:** Before calling `unlinkIdentity`, call `supabase.auth.getUserIdentities()` and check count. If only 1 identity, skip `unlinkIdentity` and only delete the `account_oauth_credentials` row.

### Pitfall 7: `signInWithOAuth` vs `linkIdentity` Confusion

**What goes wrong:** Using `signInWithOAuth` for an already-authenticated user trying to connect Gmail creates a new session, signs them out of their current session, and links in a weird state.

**Why it happens:** `signInWithOAuth` is designed for unauthenticated users. `linkIdentity` is for authenticated users adding a provider.

**How to avoid:** Gate on authentication state:
- Unauthenticated path: `signInWithOAuth` (signup/login page)
- Authenticated path: `linkIdentity` (settings page)

The callback route handler (`/auth/google-callback`) serves both paths — the difference is whether Supabase creates a new user or links to the existing one.

### Pitfall 8: New Trigger Firing for Google OAuth Users

**What goes wrong:** The existing `provision_account_for_new_user` trigger fires when Google OAuth creates a new `auth.users` row. This creates a stub `accounts` row (as expected), but with `owner_email` set from the Google `email` claim, which may differ from the Gmail address used for sending.

**Why it happens:** Trigger reads `new.email` from `auth.users` — Google OAuth populates this with the Google account email.

**How to avoid:** This is actually correct behavior — the trigger email and the Gmail sender will be the same for most users. Document this clearly. For email-mismatch (connecting Gmail with different email), only `account_oauth_credentials` stores the Gmail address; `accounts.owner_email` retains the primary login email.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase implicit OAuth flow | PKCE flow (default in `@supabase/ssr`) | `@supabase/ssr` v0.1+ | Callback route required; `provider_refresh_token` captured in callback |
| `supabase.auth.getSession()` server-side | `supabase.auth.getClaims()` or `getUser()` | Supabase SSR docs update 2024 | `getSession()` is unsafe server-side per Supabase docs |
| Google OAuth button with app colors | Google-branded button (white/gray/G logo) | Google brand policy ongoing | Required for app store / production submission |

**Deprecated/outdated:**
- `exchangeCodeForSession` in the same handler as `verifyOtp`: keep these separate. The existing `/auth/confirm` route uses `verifyOtp` for email OTPs. OAuth uses `exchangeCodeForSession`. Don't merge them — they handle different flows and error paths.

---

## Supabase `config.toml` Changes Required

```toml
[auth]
# ... existing config ...
enable_manual_linking = true  # ADD THIS — required for linkIdentity() to work

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
# Supabase handles the redirect to Google — set in Google Cloud Console to:
# https://[project-ref].supabase.co/auth/v1/callback
```

Add to local `.env.local`:
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GMAIL_TOKEN_ENCRYPTION_KEY=...  # 64 hex chars (32 bytes), generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Open Questions

### 1. Detecting `gmail.send` Partial Grant Reliably

- **What we know:** Google's token response includes a `scope` field listing only the scopes actually granted. If the user unchecks `gmail.send` at the consent screen, that scope is absent from the token.
- **What's unclear:** Supabase's `exchangeCodeForSession` response does not directly expose the Google `scope` field from the token exchange. The `session.provider_refresh_token` heuristic (null = no gmail.send) is imprecise — Google issues a refresh token for `openid email profile` (offline access) even without `gmail.send`.
- **Recommendation:** After `exchangeCodeForSession`, make a server-side call to Google's token info endpoint: `GET https://oauth2.googleapis.com/tokeninfo?access_token={provider_token}`. The response includes `scope`. Check if `https://www.googleapis.com/auth/gmail.send` is in the scope string. Store `granted_scopes` from this endpoint in `account_oauth_credentials`.
- **Alternative:** Store as "pending" and let Phase 35 verify scopes when it first attempts to send — set `needs_reconnect` if `gmail.send` is missing. This defers the detection problem to Phase 35. For Phase 34, store whatever `provider_refresh_token` we get and let Phase 35 discover the missing scope.

### 2. Onboarding Step Numbering

- **What we know:** Current wizard is 3 steps, hardcoded in `layout.tsx` as "Step X of 3" with a 3-segment progress bar.
- **What's unclear:** Whether to add Gmail as a 4th numbered step or as an "Optional" unnumbered step.
- **Recommendation:** Unnumbered optional step at `/onboarding/connect-gmail`. The trigger is the `gmail_skipped=1` URL param from the Google callback. This avoids any layout.tsx changes and is less disruptive to users who went the email/password signup path. The existing wizard completes at step 3 → `/app`; this optional step is an in-between redirect.

### 3. Supabase Identity Row and `auth.users.email` for Google OAuth

- **What we know:** When Google OAuth creates a new user, `auth.users.email` is set to the Google account email, and the `provision_account_for_new_user` trigger copies it to `accounts.owner_email`.
- **What's unclear:** If an existing email/password user links a Google identity with a different email, does `auth.users.email` change? Per Supabase docs, `linkIdentity` does not change the primary user email — the primary email stays as-is. The linked identity's email is stored separately in `auth.identities`.
- **Recommendation (confirmed MEDIUM confidence):** `linkIdentity` does not alter `auth.users.email`. Safe to proceed. For the email-mismatch case, the Gmail address for sending is obtained from `auth.identities` (the google identity row) by Phase 35, not from `auth.users.email`.

---

## Sources

### Primary (HIGH confidence)
- `https://supabase.com/docs/guides/auth/social-login/auth-google` — signInWithOAuth for Google, access_type/prompt params, provider_refresh_token
- `https://supabase.com/docs/guides/auth/auth-identity-linking` — linkIdentity, unlinkIdentity, enable_manual_linking
- `https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke` — revoke endpoint POST /revoke
- `https://developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth` — granted_scopes detection pattern
- `https://developers.google.com/identity/branding-guidelines` — Google button brand specs
- `https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81` — AES-256-GCM Node crypto pattern
- Codebase: `app/auth/confirm/route.ts` — existing callback pattern to follow
- Codebase: `lib/supabase/admin.ts` — createAdminClient pattern
- Codebase: `app/(auth)/app/signup/actions.ts` — server action pattern
- Codebase: `supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql` — trigger + RLS pattern
- Codebase: `components/ui/alert-dialog.tsx` — existing dialog component (confirmed installed)

### Secondary (MEDIUM confidence)
- `https://github.com/orgs/supabase/discussions/22653` — provider_refresh_token capture in callback route (community-verified)
- WebSearch: `linkIdentity` supports same `options.queryParams` as `signInWithOAuth` — confirmed via multiple sources, verified against docs
- WebSearch: `enable_manual_linking = true` in config.toml confirmed via community discussion

### Tertiary (LOW confidence)
- Heuristic: "provider_refresh_token null → gmail.send denied" — imprecise, see Open Questions. Recommend token info endpoint approach instead.
- Claim that Supabase exposes `granted_scopes` in session metadata — not directly verified from official docs; the token info endpoint is the authoritative source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new deps
- Architecture patterns: HIGH — OAuth callback pattern follows existing `/auth/confirm/route.ts`; encryption pattern from official Node docs
- AES-256-GCM: HIGH — standard Node crypto, well-documented
- `linkIdentity` with extra scopes: MEDIUM — supported per docs but not tested with gmail.send specifically
- Partial-grant detection: LOW — requires tokeninfo endpoint approach; Supabase session doesn't expose granted_scopes directly
- Pitfalls: HIGH — redirect URI mismatch and prompt=consent requirement are well-documented and community-confirmed

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (Supabase OAuth docs are stable; Google brand guidelines change infrequently)

---

## RESEARCH COMPLETE

**Phase:** 34 - Google OAuth Signup + Credential Capture
**Confidence:** HIGH (core flow), MEDIUM (edge cases)

### Key Findings

- `provider_refresh_token` is available **only** in the `exchangeCodeForSession` response — must capture it in the `/auth/google-callback` route handler immediately; Supabase never persists it.
- Both `access_type: "offline"` AND `prompt: "consent"` are required in `queryParams` to guarantee Google issues a refresh token, even for users who previously authorized the app.
- A new `/auth/google-callback/route.ts` route handler handles both new-signup and link-identity callbacks — the same redirect URL works for both `signInWithOAuth` and `linkIdentity`.
- `enable_manual_linking = true` must be added to `supabase/config.toml` AND enabled in Supabase Dashboard before `linkIdentity()` works.
- The existing `provision_account_for_new_user` trigger fires for Google OAuth signups exactly as it does for email/password — no changes needed to it.
- AES-256-GCM with a 32-byte hex env-var key and per-encrypt random 12-byte IV is the correct implementation pattern; stored as `iv:authTag:ciphertext` hex string.

### File Created

`.planning/phases/34-google-oauth-signup-and-credential-capture/34-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All libs already installed |
| OAuth Initiation | HIGH | Verified against official Supabase docs |
| Token Capture | HIGH | community-confirmed + official docs |
| Encryption Pattern | HIGH | Official Node.js crypto, stable API |
| `linkIdentity` with Gmail scope | MEDIUM | Docs confirm it; not tested with sensitive scope specifically |
| Partial-grant detection | LOW | Requires tokeninfo endpoint; session doesn't expose granted_scopes directly |
| Supabase redirect URL config | HIGH | Official docs + Vercel wildcard pattern confirmed |

### Open Questions

1. **Partial-grant detection** — use Google tokeninfo endpoint after exchange to check `scope` field; or defer to Phase 35 reactive detection on first failed send.
2. **Onboarding step numbering** — recommend "Optional" unnumbered step to avoid layout changes.
3. **`unlinkIdentity` call on disconnect** — recommend conditional: only call if user has 2+ identities.

### Ready for Planning

Research complete. Planner can now create PLAN.md files.
