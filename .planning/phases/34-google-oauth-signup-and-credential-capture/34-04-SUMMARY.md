---
phase: 34-google-oauth-signup-and-credential-capture
plan: 04
subsystem: auth
tags: [google-oauth, supabase, linkidentity, settings, onboarding, sonner, alertdialog]

# Dependency graph
requires:
  - phase: 34-03
    provides: /auth/google-callback handler with ?google_linked=1 and ?gmail_skipped=1 redirect wiring
  - phase: 34-01
    provides: account_oauth_credentials table with RLS (SELECT own, admin-only writes)
  - phase: 34-02
    provides: decryptToken, revokeGoogleRefreshToken, GoogleOAuthButton

provides:
  - Settings Gmail page (/app/settings/gmail) with three discrete status states: connected (green), never_connected (gray), needs_reconnect (amber)
  - connectGmailAction (linkIdentity with combined gmail.send scope) — shared by settings + onboarding
  - disconnectGmailAction: decrypt → revoke at Google (non-fatal) → admin delete → conditional unlinkIdentity
  - DisconnectGmailDialog with locked CONTEXT.md copy
  - Gmail sidebar link in Settings accordion (between Reminders and Profile)
  - Optional onboarding Connect Gmail step at /onboarding/connect-gmail (triggered by ?gmail_skipped=1)
  - GoogleLinkToast: fires locked banner once on /app?google_linked=1, strips param to prevent re-fire

affects: [phase-35-gmail-send, phase-40-dead-code-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - connectGmailAction imported across route segments (settings → onboarding) — App Router supports this
    - disconnectGmailAction: revoke is best-effort (try/catch, non-fatal), credential delete is authoritative
    - Conditional unlinkIdentity: only when user has 2+ identities (RESEARCH §Pitfall 6) — Google-only users keep their auth.identities row
    - useSearchParams in Suspense boundary applied to GoogleLinkToast (same pattern as signup/login forms from Plan 03)

key-files:
  created:
    - app/(shell)/app/settings/gmail/_lib/actions.ts
    - app/(shell)/app/settings/gmail/_components/disconnect-gmail-dialog.tsx
    - app/(shell)/app/settings/gmail/_components/gmail-status-panel.tsx
    - app/(shell)/app/settings/gmail/page.tsx
    - app/onboarding/connect-gmail/_components/connect-gmail-card.tsx
    - app/onboarding/connect-gmail/page.tsx
    - app/(shell)/app/_components/google-link-toast.tsx
  modified:
    - components/app-sidebar.tsx
    - app/onboarding/page.tsx
    - app/(shell)/app/page.tsx

key-decisions:
  - "connectGmailAction uses supabase.auth.linkIdentity (NOT signInWithOAuth) to avoid duplicate user creation for existing email/password accounts"
  - "disconnectGmailAction calls revokeGoogleRefreshToken before admin delete; revocation failure is non-fatal (non-blocking disconnect)"
  - "unlinkIdentity only called when user has 2+ identities — Google-only signup users keep their identity row (Phase 35 reads account_oauth_credentials, not auth.identities)"
  - "Onboarding connect-gmail is an interstitial (unnumbered) step triggered by ?gmail_skipped=1 — no progress bar renumbering needed"
  - "GoogleLinkToast uses fired.current ref to prevent double-fire in React StrictMode"
  - "GmailStatusPanel wraps useSearchParams child in Suspense per Next.js 16 prerender pattern"

patterns-established:
  - "Server action cross-segment reuse: connectGmailAction defined in settings/_lib/actions.ts and imported by onboarding — no duplication of linkIdentity logic"
  - "Locked CONTEXT.md copy placement: disconnect modal title 'Disconnect Gmail?' + description 'You won't be able to send emails until you reconnect.' + banner 'Your account is now connected to Google — you can sign in either way.'"

# Metrics
duration: 4min
completed: 2026-05-06
---

# Phase 34 Plan 04: Settings Gmail Panel + Onboarding Step + Link Toast Summary

**Settings Gmail panel with three-state status + disconnect modal (locked copy), optional onboarding Connect Gmail interstitial, and post-link toast — closes Phase 34 success criteria #3 and #4**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-06T23:42:03Z
- **Completed:** 2026-05-06T23:45:50Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Full settings Gmail sub-page with connected/never_connected/needs_reconnect state visualization, connect form (linkIdentity), and disconnect dialog with CONTEXT.md-locked confirmation copy
- Optional onboarding interstitial at `/onboarding/connect-gmail` for users who denied gmail.send during Google signup — reuses connectGmailAction, skippable via `/onboarding`
- Post-link banner toast fires once on `/app?google_linked=1` with locked copy, then strips the search param to prevent re-fire

## Task Commits

1. **Task 1: Settings Gmail page — status panel + connect/disconnect actions + sidebar link** - `c9f2312` (feat)
2. **Task 2: Optional onboarding Connect Gmail step + ?gmail_skipped=1 router branch** - `f0da49e` (feat)
3. **Task 3: ?google_linked=1 banner toast on /app** - `03c0ebd` (feat)

## Files Created/Modified

- `app/(shell)/app/settings/gmail/_lib/actions.ts` — connectGmailAction (linkIdentity) + disconnectGmailAction (revoke + admin delete + conditional unlinkIdentity)
- `app/(shell)/app/settings/gmail/_components/disconnect-gmail-dialog.tsx` — AlertDialog with locked CONTEXT.md title + description
- `app/(shell)/app/settings/gmail/_components/gmail-status-panel.tsx` — three-state status panel, Suspense-wrapped for useSearchParams
- `app/(shell)/app/settings/gmail/page.tsx` — server component shell reading account_oauth_credentials + getUserIdentities
- `app/onboarding/connect-gmail/_components/connect-gmail-card.tsx` — optional card with mild blue info box, Connect form, Skip link; reuses connectGmailAction
- `app/onboarding/connect-gmail/page.tsx` — server shell with onboarding_complete guard
- `app/(shell)/app/_components/google-link-toast.tsx` — fires locked banner copy once, strips ?google_linked=1 param
- `components/app-sidebar.tsx` — added Gmail sub-link between Reminders and Profile
- `app/onboarding/page.tsx` — additive ?gmail_skipped=1 branch to /onboarding/connect-gmail
- `app/(shell)/app/page.tsx` — renders GoogleLinkToast in Suspense boundary

## Decisions Made

1. **connectGmailAction shared across segments** — imported by onboarding from settings path; no duplication of linkIdentity logic. App Router allows server action imports across route boundaries.
2. **Disconnect revocation is best-effort** — `revokeGoogleRefreshToken` failure is caught and logged; does not block credential row deletion. This matches the CONTEXT.md requirement: "revocation failure is non-fatal."
3. **Conditional unlinkIdentity** — only called when user has 2+ identities (RESEARCH §Pitfall 6). Google-only users keep their `auth.identities` row so they can still sign in after "disconnect" (which only removes the Phase 35 credential).
4. **Onboarding interstitial is unnumbered** — `/onboarding/connect-gmail` renders inside `onboarding/layout.tsx` which shows the Step X of 3 progress bar. Accepted in plan as OK for v1.7; can be hidden via pathname check in a follow-up.
5. **GoogleLinkToast uses fired.current ref** — prevents double-fire in React StrictMode (useEffect runs twice in development); `fired.current` is set before the `router.replace` call.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Manual QA Checklist (to verify once PREREQ-01/02/04 satisfied on Vercel preview)

- [ ] Log in with email/password → visit /app/settings/gmail → see "Not connected" gray dot + "Connect Gmail" button
- [ ] Click Connect Gmail → Google consent → approve with gmail.send → land back at /app/settings/gmail → see "Connected · your@gmail.com" green dot + connectedAt date + Disconnect button
- [ ] `select count(*) from accounts where owner_user_id = '<user>'` returns 1 (no duplicate — success criterion #3)
- [ ] Click Disconnect → modal title exactly "Disconnect Gmail?" → description exactly "You won't be able to send emails until you reconnect." → click Disconnect → status flips to "Not connected"
- [ ] `select count(*) from account_oauth_credentials where user_id = '<user>' and provider = 'google'` returns 0 (success criterion #4)
- [ ] Sign up via Google → deny gmail.send at consent → land in /onboarding → router redirects to /onboarding/connect-gmail → see optional card → click Skip → land in /onboarding/step-1-account
- [ ] Existing user links Google account → callback sends to /app?google_linked=1 → toast appears: "Your account is now connected to Google — you can sign in either way." → URL strips to /app → refresh does NOT re-fire toast
- [ ] Seed a row with `status = 'needs_reconnect'` in account_oauth_credentials → visit /app/settings/gmail → see amber dot + "Reconnect needed" + explanation text + "Reconnect Gmail" button

## Locked CONTEXT.md Strings Placed

| String | File | Line |
|--------|------|------|
| `Disconnect Gmail?` | `app/(shell)/app/settings/gmail/_components/disconnect-gmail-dialog.tsx` | 35 |
| `You won't be able to send emails until you reconnect.` | `app/(shell)/app/settings/gmail/_components/disconnect-gmail-dialog.tsx` | 37 |
| `Your account is now connected to Google — you can sign in either way.` | `app/(shell)/app/_components/google-link-toast.tsx` | 21 |

## Notes for Phase 35

- `needs_reconnect` status is WRITTEN by Phase 35 token-refresh logic (when a refresh attempt fails with invalid_grant). This plan only READS it for display. To verify the amber state before Phase 35 ships: `UPDATE account_oauth_credentials SET status = 'needs_reconnect' WHERE user_id = '<user>'`.
- `disconnectGmailAction` leaves the Supabase `auth.identities` row intact for Google-only users (conditional unlinkIdentity). Phase 35 reads exclusively from `account_oauth_credentials` — this is correct behavior.

## Next Phase Readiness

Phase 34 is complete. Phase 35 (Gmail Send) can now:
- Read `account_oauth_credentials` via `decryptToken` to get the refresh token
- Use `connectGmailAction` as the reconnect surface when `invalid_grant` is returned
- Write `status = 'needs_reconnect'` to trigger the amber state on /app/settings/gmail

Phase 34 recommendation: smoke ALL 5 success criteria on a Vercel preview branch with PREREQ-01/02/04 satisfied before merging to main.

---
*Phase: 34-google-oauth-signup-and-credential-capture*
*Completed: 2026-05-06*
