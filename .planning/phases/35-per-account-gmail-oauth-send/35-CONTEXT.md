# Phase 35: Per-Account Gmail OAuth Send - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the centralized Gmail SMTP singleton with a per-account sender factory. All seven transactional email paths (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner) route through `getSenderForAccount(accountId)` backed by each account's own Gmail OAuth refresh token (captured by Phase 34). Per-account quota isolation. Strangler-fig cutover with SMTP removal in a separate post-verification deploy.

**Out of scope:** Resend backend (Phase 36), upgrade flow (Phase 37), magic-link login (Phase 38), booker form polish (Phase 39).

</domain>

<decisions>
## Implementation Decisions

### Booking failure mode on revoked token
- When a visitor books against an account whose Gmail OAuth is revoked: **booking succeeds, email is skipped**.
- Slot is reserved, booker sees the normal confirmation page, no error to the booker.
- Owner sees a flag in their bookings list / dashboard indicating the email failed (alongside the standing reconnect banner).
- Rationale: silent partial failure is preferable to telling a paying customer the service is broken when the slot is genuinely available.

### nsi (Andrew's own) account first-connect
- Andrew connects his Gmail through the **same UI flow** as any other owner: `/app/settings/gmail` → "Connect Gmail" button (the Phase 34 panel).
- No manual DB seed, no gcloud/Postman side-channel. Dogfooding the Phase 34 UI is part of the verification.
- This means the very first preview-branch test exercises both the OAuth capture (Phase 34) and the new send path (Phase 35) end-to-end.

### SMTP removal deploy timing
- Two-step deploy in the **same work session**:
  1. Preview branch: cutover commit (callers switch to `getSenderForAccount`); Andrew verifies a booking confirmation arrives via Gmail OAuth.
  2. Merge cutover commit to main; verify in production.
  3. Push the SMTP-removal commit (deletes `GMAIL_APP_PASSWORD` path, `lib/email-sender` singleton, related code).
- No 24-48h soak between steps. Matches LD-06 two-step deploy from Phase 28; Andrew's pattern is "verify and immediately tighten" rather than long observation windows.

### Claude's Discretion

The user said "you decide" on these — Claude has flexibility:

- **Sender factory contract** — Shape of `getSenderForAccount(accountId)` (object with `.send()` vs direct function), access-token caching strategy (per-request vs LRU vs none), error contract for missing/revoked credentials (throw vs null vs no-op sender), and which account's credential sends booker-facing emails (likely `booking.account_id` since the owner is the brand the booker engaged with).
- **Token refresh + invalid_grant** — Refresh timing (lazy on first send vs eager on request entry), revocation flagging policy (mark on first invalid_grant vs after N failures), whether refused sends write to `email_send_log`, and whether refused sends count against the 200/day quota. Default to existing Phase 31 refuse-send conventions where they apply.
- **Revoked-token banner placement and CTA** — Banner location (site-wide vs dashboard vs settings-only), button target (direct OAuth flow vs link to settings page), and whether to also email the owner about the revocation (deferred — Resend isn't wired until Phase 36).
- **Cutover sequencing** — All 7 paths in one commit (with or without feature flag) vs one-at-a-time. Match CP-03 strangler-fig pattern from Phase 28.
- **Preview verification gate** — Which subset of the 7 paths Andrew actually exercises before the SMTP removal commit. A booking confirmation through `nsi` is the must-have; pick a pragmatic add-on set if more coverage is warranted.

</decisions>

<specifics>
## Specific Ideas

- The verification model is **deploy-and-eyeball** (consistent with the last 6 milestones); preview-branch live test against a real Gmail inbox is the canonical gate.
- "nsi" account is Andrew's own — using the same UI as any owner means Phase 34's settings panel gets a real-world dogfood pass during Phase 35 verification.

</specifics>

<deferred>
## Deferred Ideas

- **Email the owner when their token is revoked** — Requires Resend (or some out-of-band channel that doesn't depend on the broken Gmail). Belongs in or after Phase 36.
- **Retry queue for failed sends** — Booker emails that get skipped on revocation could be re-sent after reconnect. Adds queue/retry infrastructure; not in this phase's scope.

</deferred>

---

*Phase: 35-per-account-gmail-oauth-send*
*Context gathered: 2026-05-06*
