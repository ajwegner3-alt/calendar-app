# Phase 34: Google OAuth Signup + Credential Capture - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can sign up via Google with combined `gmail.send` consent, existing accounts can connect or disconnect Gmail from `/app/settings`, and all OAuth tokens are stored encrypted in `account_oauth_credentials`. This phase captures and stores credentials only — actual per-account sending lands in Phase 35; Resend backend lands in Phase 36; magic-link login lands in Phase 38.

</domain>

<decisions>
## Implementation Decisions

### Signup card layout (`/app/signup`)
- "Sign up with Google" appears **first** (above the email/password form) — it's the primary path going forward.
- Use the **branded Google button**: white background, gray border, official 'G' logo, "Sign up with Google" label per Google's brand guidelines.
- Same Google button **mirrors onto `/app/login`** — existing Google users can sign in via the same surface.
- Divider style between Google and email/password: **Claude's discretion** (likely "or" divider, but pick what matches existing `/app/signup` styling).

### Gmail-denied onboarding step
- **All four sub-decisions are Claude's discretion**: when the step appears (likely only when `gmail.send` was denied at consent), skip-option copy/style, whether to warn about send consequences, and step content density.
- Guiding constraints for Claude:
  - The phase boundary is "skippable" — never block account creation on Gmail consent.
  - In v1.7 transitional state (Phase 34 ships before Phase 35 cuts over from SMTP), users who skip aren't actually broken yet — calibrate warning copy accordingly.
  - Match the existing onboarding wizard's tone and step density.

### Settings connect/disconnect UI (`/app/settings`)
- **All four sub-decisions are Claude's discretion**: panel location on the settings page, status visualization style (Connected / Never connected / Needs reconnect), connected-state info shown, and reconnect prompt mechanism.
- Hard requirements (from success criteria, not discretion):
  - Three discrete status states must be representable: Connected, Never connected, Needs reconnect.
  - Disconnect action must revoke the stored credential (not just clear the UI).
  - "Needs reconnect" must surface when the refresh token has been revoked externally.

### Account-merge + disconnect edges
- **Already-connected case** — User clicks "Sign up with Google" but the Google email already has an email/password account: **sign them in + offer to link**. Show a banner after login: "Your account is now connected to Google — you can sign in either way." Treat the OAuth event as login + credential-link, not as a duplicate signup.
- **Disconnect flow** — **Confirmation modal** required: "Disconnect Gmail? You won't be able to send emails until you reconnect." with Cancel / Disconnect buttons. No typed confirmation, no instant-undo toast.
- **Email-mismatch case** (existing email/pw user connects a Gmail with a different email) — **Claude's discretion**, but bias toward what's safest for Phase 35 (the credential will be read by `getSenderForAccount` to send mail). Note: even if allowed, the *sender identity* on outbound mail will be the Gmail address, not the account email — this needs to be obvious to the user.
- **Token encryption** — **Claude's discretion**, but PREREQ-04 already mandates `GMAIL_TOKEN_ENCRYPTION_KEY` (32-byte hex) as a Vercel env var, which strongly implies app-layer AES-256-GCM rather than Supabase Vault. Researcher should confirm.

### Claude's Discretion (summary)
The user explicitly delegated these areas — Claude has full flexibility during planning/implementation:
- Divider style between Google and email/password on signup
- Entire onboarding "Connect Gmail" step (trigger, skip copy, warning copy, content density)
- Entire settings panel design (location, status visualization, connected-state info, reconnect prompt)
- Email-mismatch behavior (allow / refuse / prompt)
- Encryption approach (env-var AES vs Supabase Vault — though env var path is heavily suggested by PREREQ-04)

</decisions>

<specifics>
## Specific Ideas

- **Branded Google button is non-negotiable** — Google's own brand guidelines for the official 'G' logo on white/gray-bordered button. Don't theme it with NSI colors.
- **Already-existing-email behavior is "link, don't duplicate"** — match the conventional SaaS pattern users expect: clicking Google with a known email signs them in and links the credential, with a banner acknowledging the link.
- **Disconnect needs friction** — confirmation modal, not instant. The cost of accidental disconnect (refuse-send fail-closed in Phase 35) is high enough to warrant the prompt.
- Login page should mirror signup's Google button — don't make existing Google users hunt for it.

</specifics>

<deferred>
## Deferred Ideas

- **Per-account Gmail sending** — Phase 35 (this phase only captures credentials; Phase 35 wires `getSenderForAccount` and the strangler-fig SMTP cutover).
- **Resend backend for upgraded accounts** — Phase 36.
- **Magic-link login** — Phase 38 (existing email/password users get a passwordless option separately from this phase's OAuth work).
- **In-app cap-hit upgrade flow** — Phase 37.

</deferred>

---

*Phase: 34-google-oauth-signup-and-credential-capture*
*Context gathered: 2026-05-06*
