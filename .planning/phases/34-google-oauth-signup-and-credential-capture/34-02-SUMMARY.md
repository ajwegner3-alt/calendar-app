---
phase: 34-google-oauth-signup-and-credential-capture
plan: 02
subsystem: auth
tags: [aes-256-gcm, crypto, google-oauth, refresh-token, encryption, branded-button]

# Dependency graph
requires:
  - phase: 34-01
    provides: account_oauth_credentials table + Supabase Google provider config
provides:
  - encryptToken / decryptToken (AES-256-GCM, iv:authTag:ciphertext hex format)
  - generateKey dev helper
  - fetchGoogleGrantedScopes (tokeninfo endpoint)
  - revokeGoogleRefreshToken (revoke endpoint, returns bool, never throws)
  - hasGmailSendScope (scope string parser)
  - GoogleOAuthButton (Google-branded, white/gray/G-logo, onClick + type="submit")
affects:
  - 34-03 (callback route imports encryptToken, google.ts helpers, GoogleOAuthButton)
  - 34-04 (signup/login pages import GoogleOAuthButton)
  - 34-05 (settings page imports revokeGoogleRefreshToken, decryptToken)
  - 35 (Phase 35 imports decryptToken to read stored refresh token)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AES-256-GCM encryption stored as iv:authTag:ciphertext (all hex) in text column"
    - "getKey() reads env var lazily (never at module top level) — safe for test isolation"
    - "server-only import as first line in all lib/oauth/* files"
    - "Google OAuth HTTP helpers return null/false on any error — callers branch, never catch"
    - "GoogleOAuthButton uses raw <button> with Google brand colors — no NSI theme override"

key-files:
  created:
    - lib/oauth/encrypt.ts
    - lib/oauth/google.ts
    - components/google-oauth-button.tsx
    - tests/oauth-encrypt.test.ts
  modified: []

key-decisions:
  - "getKey() reads GMAIL_TOKEN_ENCRYPTION_KEY lazily inside the function body, not at module top level — enables per-test env isolation without module cache issues"
  - "Return type React.JSX.Element (not bare JSX.Element) to satisfy project's TypeScript strict config (JSX namespace not globally available)"
  - "GoogleOAuthButton accepts both onClick and type='submit' to serve both client-handler and form-action usage patterns"
  - "Google HTTP helpers swallow all network errors and return null/false — Plan 03 callback route branches on return value rather than wrapping in try/catch"

patterns-established:
  - "Encrypt pattern: iv:authTag:ciphertext (hex) — 12-byte IV, 16-byte auth tag, variable ciphertext"
  - "Server-only lib/oauth/* — import 'server-only' is mandatory first import"

# Metrics
duration: 2min
completed: 2026-05-06
---

# Phase 34 Plan 02: OAuth Primitives Summary

**AES-256-GCM token encryption util + Google tokeninfo/revoke HTTP helpers + branded Google OAuth button component, all test-verified and TypeScript clean**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-06T23:29:32Z
- **Completed:** 2026-05-06T23:31:45Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `lib/oauth/encrypt.ts`: AES-256-GCM roundtrip encryption with fresh 12-byte IV per call, tamper detection via GCM auth tag, lazy env var validation — 5/5 tests passing
- `lib/oauth/google.ts`: `fetchGoogleGrantedScopes`, `revokeGoogleRefreshToken`, `hasGmailSendScope` — all return safe values on failure, never throw
- `components/google-oauth-button.tsx`: Google-brand-compliant button (white bg, `#747775` border, official 4-color G logo SVG) supporting both `onClick` and `type="submit"`

## Exported Function Signatures (Plan 03 imports all three modules)

```ts
// lib/oauth/encrypt.ts
export function encryptToken(plaintext: string): string
export function decryptToken(stored: string): string
export function generateKey(): string

// lib/oauth/google.ts
export async function fetchGoogleGrantedScopes(accessToken: string): Promise<string | null>
export async function revokeGoogleRefreshToken(token: string): Promise<boolean>
export function hasGmailSendScope(grantedScopes: string | null | undefined): boolean

// components/google-oauth-button.tsx
export interface GoogleOAuthButtonProps {
  label: string
  onClick?: () => void
  isPending?: boolean
  type?: "button" | "submit"   // default "button"
  className?: string
}
export function GoogleOAuthButton(props: GoogleOAuthButtonProps): React.JSX.Element
```

## Blob Format Contract

`encryptToken` stores tokens as: `iv:authTag:ciphertext` (all hex)
- `iv` — 12 bytes (24 hex chars), fresh `randomBytes(12)` per call
- `authTag` — 16 bytes (32 hex chars), GCM authentication tag
- `ciphertext` — variable length (hex-encoded AES-256-GCM output)

Typical total length for a Google refresh token: ~200–250 chars. Fits in a `text` column.

`decryptToken` calls `decipher.setAuthTag()` BEFORE `decipher.final()` — GCM integrity is enforced.

## Test Results

```
npx vitest run tests/oauth-encrypt.test.ts

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  321ms
```

Exit code: 0. All 5 cases pass:
1. Roundtrip: `decryptToken(encryptToken("a-realistic-google-refresh-token-1//04abcdef1234"))` === original
2. Unique IV: two calls to `encryptToken("x")` produce different ciphertext strings
3. Tamper detection: mutated ciphertext byte throws on decrypt
4. Missing key: `delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY` → throws `/not set/`
5. Wrong key length: `"abc"` hex key → throws `/32-byte/`

## Task Commits

1. **Task 1: AES-256-GCM token encryption util** — `e09f019` (feat)
2. **Task 2: Google OAuth HTTP helpers** — `f639f0c` (feat)
3. **Task 3: Branded Google OAuth button component** — `e427e52` (feat)

## Files Created/Modified

- `lib/oauth/encrypt.ts` — AES-256-GCM encryptToken/decryptToken/generateKey, server-only
- `lib/oauth/google.ts` — fetchGoogleGrantedScopes, revokeGoogleRefreshToken, hasGmailSendScope, server-only
- `components/google-oauth-button.tsx` — Branded Google button, client component
- `tests/oauth-encrypt.test.ts` — 5 vitest tests (roundtrip, IV uniqueness, tamper, missing key, wrong key length)

## Decisions Made

- `getKey()` reads env var lazily inside function body (not at module top) — required for test isolation since beforeEach/afterEach can modify `process.env` between tests.
- `React.JSX.Element` return type instead of bare `JSX.Element` — project TypeScript config does not globally expose the JSX namespace; `React.JSX.Element` compiles cleanly.
- `GoogleOAuthButton` supports both `onClick` (client button handler) and `type="submit"` (Next.js form action) — Plan 03's callback initiation will use both patterns across signup, login, and settings pages.
- Google HTTP helpers swallow all errors and return `null`/`false` — callback route in Plan 03 branches on return values without try/catch; cleaner than re-throwing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSX.Element return type to React.JSX.Element**
- **Found during:** Task 3 (GoogleOAuthButton TypeScript check)
- **Issue:** `JSX.Element` return type caused `TS2503: Cannot find namespace 'JSX'` under the project's strict TypeScript config
- **Fix:** Added `import React from "react"` and used `React.JSX.Element` as return type
- **Files modified:** `components/google-oauth-button.tsx`
- **Verification:** `npx tsc --noEmit` no longer reports errors for the component
- **Committed in:** `e427e52` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — TypeScript return type namespace)
**Impact on plan:** Single-line fix required for TypeScript compliance. No scope creep.

## Issues Encountered

None — all tasks executed smoothly. Pre-existing TypeScript errors in `tests/bookings-api.test.ts` and several other test files are unrelated to this plan (confirmed pre-existing from prior phases).

## GoogleOAuthButton Usage Notes

The component accepts BOTH `onClick` and `type="submit"`:

```tsx
// Client-handler usage (e.g., calls a server action manually)
<GoogleOAuthButton
  label="Sign up with Google"
  onClick={() => initiateGoogleOAuthAction()}
  isPending={isPending}
/>

// Form-action usage (works inside a Next.js <form> with action=)
<form action={initiateGoogleOAuthAction}>
  <GoogleOAuthButton label="Sign in with Google" type="submit" />
</form>
```

## Next Phase Readiness

- All three modules are ready for Plan 03 (callback route) to import.
- `encryptToken` import: `import { encryptToken } from "@/lib/oauth/encrypt"`
- `fetchGoogleGrantedScopes` / `revokeGoogleRefreshToken` / `hasGmailSendScope`: `import { ... } from "@/lib/oauth/google"`
- `GoogleOAuthButton`: `import { GoogleOAuthButton } from "@/components/google-oauth-button"`
- `GMAIL_TOKEN_ENCRYPTION_KEY` env var must be set in Vercel before Plan 03 callback route is deployed (PREREQ-04).

---
*Phase: 34-google-oauth-signup-and-credential-capture*
*Completed: 2026-05-06*
