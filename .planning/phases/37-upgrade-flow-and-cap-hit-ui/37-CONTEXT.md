# Phase 37: Upgrade Flow + In-App Cap-Hit UI - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

When an account hits the 200/day Gmail cap, the existing quota-exceeded banner gains an inline "Request upgrade" link. Clicking opens a dedicated `/app/settings/upgrade` page with an optional message field; submitting emails Andrew via NSI Resend, bypassing the requester's own quota guard so it works at the exact moment the account is at cap. One request per account per rolling 24 hours.

**In scope:** banner link, upgrade page, server action, email to Andrew, 24-hour rate limit, schema column for last-request timestamp.

**Out of scope:** automated upgrade approval, in-app billing, plan tiers, self-service flip of `accounts.email_provider` (Andrew still does the SQL flip manually per Phase 36 activation guide).

</domain>

<decisions>
## Implementation Decisions

### Cap-hit banner integration

- The "Request upgrade" link is added to the **existing** `app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx` only — no new banners, no new surfaces, no always-visible quota counter.
- Link is **appended at the end of the banner copy**, after "The quota resets at UTC midnight." — preserves the existing banner shape and locked CONTEXT decisions from Phase 31.
- Banner visibility trigger is **unchanged**: still gated on `count > 0` from `countUnsentConfirmations()`. An owner who has never had a refuse-send won't see the upgrade entry point here. (Acceptable — the banner only matters to owners actually feeling cap pressure.)
- **Link text: Claude's discretion** — pick something consistent with NSI brand voice. The roadmap success criteria use "Request upgrade" verbatim, so default to that unless something noticeably better fits.

### Upgrade page UX (`/app/settings/upgrade`)

- **Dedicated route**, not modal or inline section. Path matches roadmap success criterion #2 verbatim.
- **Single optional message textarea** as the only form field. All other context (account name, owner email, account ID) is server-derived from the session — never user-editable.
- **Page copy framing: soft + transparent.** Owner-facing explanation along the lines of: "You're on the Gmail-backed plan (200/day cap). Upgrading routes your sends through NSI's shared service for higher volume. Submit a request and Andrew will be in touch." Exact copy at Claude's discretion, consistent with NSI's existing settings-page tone.
- **Post-submit success: inline state on the same page.** No redirect, no toast-then-vanish. Submit button becomes disabled, success state replaces the form area: "Request received — Andrew will be in touch within 1 business day." Page reload shows the same locked-out state for the rest of the 24h window.

### Email content to Andrew

- **Recipient:** `ajwegner3@gmail.com` (Andrew's personal Gmail). Hard-coded constant — not env-var-gated. Andrew's personal inbox is the fastest path to action.
- **From:** NSI verified Resend domain (the same `noreply@nsintegrations.com`-style address used elsewhere in the Phase 36 framework).
- **Reply-To:** the requesting owner's auth email. Andrew hits reply, the response goes directly to the requester.
- **Subject:** `Upgrade request — {business_name}`.
- **Body context (server-derived, in the email body):**
  - Account business name (`accounts.business_name`)
  - Owner email (from session / `auth.users.email`)
  - The user's optional message (or "(no message provided)" if empty)
- Plain-text or simple HTML at Claude's discretion — internal-facing email, no branded layout required.
- **Quota guard bypass:** the upgrade-request send goes through `createResendClient()` directly (bootstrap-safe per LD-05), NOT through the requester's `getSenderForAccount(accountId)` factory path. The send must succeed even when `email_send_log` has 200 rows for the requester's account today.

### 24-hour rate-limit UX

- **Storage:** new column on `accounts` table — `last_upgrade_request_at timestamptz` (nullable). Schema migration is part of this phase.
- **Window:** **rolling 24 hours.** Cannot submit if `now() - last_upgrade_request_at < interval '24 hours'`. Submitting at 9am Tuesday means next allowed at 9am Wednesday.
- **Locked-out UX:** form still rendered, submit button disabled, helper text shows time remaining: "Already requested. Try again in 18h 23m." Server-rendered text is fine — no live JS countdown required. The text recomputes on each page load.
- **Server enforcement:** server action checks `last_upgrade_request_at` independently of the UI. If within the 24h window, returns a clear error ("Already requested in the last 24 hours — try again at {timestamp}") without sending the email or updating the timestamp. UI surfaces this as an inline error.
- **DB write order:** update `last_upgrade_request_at` AFTER the Resend send returns success. If the send fails, the timestamp stays null/old so the user can retry immediately.

### Claude's Discretion

- Exact link wording on the banner ("Request upgrade" is the default per success criteria; flexibility for a better phrase if one emerges)
- Exact page copy on `/app/settings/upgrade`
- Plain-text vs lightly-formatted HTML for the email body
- Visual styling of the disabled submit button + countdown helper text
- Whether to render the locked-out form as a single layout or to swap to a more compact "already submitted" panel — both are fine as long as the server-rendered countdown is visible and the submit path is blocked

</decisions>

<specifics>
## Specific Ideas

- The banner is **error-only by design** (Phase 31 locked CONTEXT) — DO NOT introduce an always-visible quota counter or 80% warn banner as part of this phase. The upgrade link rides on top of the existing trigger only.
- The email recipient is Andrew's personal Gmail (`ajwegner3@gmail.com`), NOT a business address — this is the operational decision: Andrew watches that inbox most closely and the upgrade flow is currently a one-person operation.
- The send path MUST use `createResendClient()` directly (Phase 36 framework), not the per-account factory. This is the LD-05 bootstrap constraint that makes the whole phase work at-cap. Any planner attempt to route the upgrade-request send through `getSenderForAccount(requesterAccountId)` is wrong — it would refuse-send when the requester is at quota.

</specifics>

<deferred>
## Deferred Ideas

- Volume estimate field on the upgrade form — useful pricing-conversation context, but adds form complexity for v1. Defer.
- Phone callback field / preferred contact method — out of scope for v1; Andrew can ask for that in the reply.
- Auto-flip `accounts.email_provider` on Andrew's approval (e.g., a magic link in the request email) — interesting, but introduces auth/privilege concerns. Andrew runs the SQL flip manually per Phase 36 FUTURE_DIRECTIONS.md activation guide.
- Always-visible quota counter widget in the app header — conflicts with Phase 31 "error-only by design" and was out of scope here. Could revisit as its own phase.
- Account creation date / today's send count in the email body — small bits of context, deferred to keep the email body lean.
- Self-service plan tiers / in-app billing — entire separate milestone if/when that becomes the operating model.

</deferred>

---

*Phase: 37-upgrade-flow-and-cap-hit-ui*
*Context gathered: 2026-05-08*
