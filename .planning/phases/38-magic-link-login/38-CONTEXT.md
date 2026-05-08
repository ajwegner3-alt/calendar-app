# Phase 38: Magic-Link Login - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a passwordless email login flow to the existing `/app/login` card. Users can request a magic link via Supabase `signInWithOtp`, receive an email, and click through to authenticate. Flow is rate-limited and enumeration-safe (identical responses for known/unknown emails). No new route is created — the magic-link UI lives entirely on the existing login card alongside Google OAuth and email/password.

Out of scope: magic-link signup (login only), magic-link from settings/onboarding, custom magic-link landing routes.

</domain>

<decisions>
## Implementation Decisions

### Login card layout
- **Toggle modes** at the top of the email/password section: `Password | Magic link` tab-like control. Switches what's rendered below the email field.
- **Shared email field** — one email input drives both flows; user picks how to log in via the toggle.
- **Password is the default mode** (primary visual emphasis); magic-link is the alternate path. Toggle starts on "Password".
- **Google OAuth keeps current position** — top of card, above the `or` divider. No re-grouping with magic-link.

### Submit feedback & copy
- **Inline replace** — on submit, the magic-link form area is replaced with a success state. User stays on `/app/login`. Success state shows a check-your-email message and a resend control.
- **Success copy (enumeration-safe):** "If an account exists for that email, we sent a login link. Check your inbox." Phrasing pattern: *"If an account exists..."* (not "We sent... if your email is registered").
- **Link expiry: 15 minutes.** Communicated to the user in the success state and in the email body.
- **30-second resend cooldown** on the success state. Show "Resend in [N]s" countdown; button enables after 30s. Prevents accidental re-submits and rate-limit waste.

### Email content + landing
- **Subject:** "Your NSI login link"
- **Body style: minimal.** Single sentence + button + expiry note. (e.g., "Click below to sign in. Link expires in 15 minutes.") No greeting fluff, no "if you didn't request this" safety line — keep it terse.
- **Landing target: dashboard always (`/app`).** No `redirectTo` honoring; no onboarding-aware branching. Simple and predictable.
- **Sender: Supabase default** — Supabase auth's built-in email sender (their SMTP). Does NOT route through `getSenderForAccount`, NSI Resend, or any of the Phase 35/36 senders. Simplest path; no auth hook wiring.

### Rate-limit UX
- **Scope: IP + email** — limit fires only when BOTH same IP AND same email exceed the threshold within the window. Reduces shared-office collateral damage vs. IP-only.
- **Limit: 5 requests / hour** per (IP, email) pair.
  - ⚠ **Divergence from ROADMAP.md success criterion** (which states "3 requests / hour, same IP"). Planner must reconcile by either (a) updating ROADMAP.md success criterion #3 + REQUIREMENTS.md AUTH-29 to match these decisions, or (b) escalating back to Andrew. The user's intent is the 5/hour, IP+email scope captured here.
- **4th-and-beyond request UX: silent rate-limit.** Show the SAME "If an account exists..." success message as a normal submit. Attacker can't distinguish throttled vs. sent. No error banner, no retry-after timestamp leaked.
- **Storage: Claude's discretion** — default to existing `rate_limit_events` table if its schema fits; researcher to confirm shape and propose alternative only if needed.

### Claude's Discretion
- Exact toggle component implementation (existing `ui/` primitives or custom).
- Loading state during submit (spinner placement, button disabled visuals).
- Error states for true server errors (network failure, Supabase outage) — distinct from rate-limit silent path.
- Resend countdown timer implementation (server-rendered vs. client-side `setInterval`). Phase 37 LD-83 favors server-rendered when sufficient — apply judgment based on whether 30s cooldown needs precision across reloads.
- Rate-limit storage schema if `rate_limit_events` doesn't fit.
- Exact tab/toggle visual style — match existing NSI brand tokens.

</decisions>

<specifics>
## Specific Ideas

- Toggle pattern resembles a segmented control / pill switcher. Visual treatment should feel native to NSI's existing card UI, not a heavy-weight tab component.
- "Your NSI login link" subject keeps it short and recognizable in inbox previews.
- The minimal email body should feel like a Slack/Linear/Notion login email — single CTA button, almost no copy.

</specifics>

<deferred>
## Deferred Ideas

- Magic-link signup flow (currently login-only per phase boundary).
- Magic-link triggered from `/app/settings` for re-authentication.
- Custom branded magic-link emails via Supabase send-email auth hook → Resend (Phase 36+ infrastructure exists but not wired). Could be a future polish phase if Supabase default deliverability proves insufficient.
- Honoring `redirectTo` query param on the login card (deep-link recovery). Current decision: dashboard always.
- Onboarding-aware landing (redirect incomplete-onboarding users to `/onboarding` after magic-link auth).
- Visible rate-limit feedback for legitimate users (e.g., admin dashboard or in-app message). Currently silent for security.

</deferred>

---

*Phase: 38-magic-link-login*
*Context gathered: 2026-05-08*
