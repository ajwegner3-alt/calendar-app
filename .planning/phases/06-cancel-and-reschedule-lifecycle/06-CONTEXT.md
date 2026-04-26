# Phase 6: Cancel + Reschedule Lifecycle - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Tokenized email-link flows that let a booker cancel or reschedule without logging in, plus owner-side cancel plumbing on the bookings detail page. Both parties get notified on every state change. Tokens are SHA-256 hashed in the DB; raw tokens live only in emails. Public token endpoints are rate-limited per IP.

In scope: `/cancel/[token]`, `/reschedule/[token]`, owner cancel button on booking detail, cancellation + reschedule emails (booker + owner), METHOD:CANCEL .ics for cancellations, fresh token rotation on reschedule.

Out of scope (other phases): full bookings list page (Phase 8), broader app-wide rate limiting (Phase 8 INFRA-01), owner reschedule on behalf of booker.

</domain>

<decisions>
## Implementation Decisions

### Cancel + reschedule UX (booker-facing)
- **Cancel: 2-step confirm.** Token URL lands on a page showing booking details + "Cancel this booking?" button. Click confirms. Defends against email-client link prefetching (Gmail/Outlook GET-prefetch is the canonical risk for token links).
- **Cancellation reason: optional textarea.** "Reason for cancelling (optional)" field; captured if filled, included in owner notification email when non-empty.
- **Reschedule slot picker: reuse Phase 5 `SlotPicker` component verbatim.** Same calendar + slot list scoped to the booking's existing event type. Old slot rendered above the picker as a reference line ("Currently scheduled: [old time]").
- **Reschedule preserves booker data silently.** Name, email, phone, and custom-question answers stay the same — only the slot changes. Booker doesn't see or edit them.

### Token lifecycle
- **Token validity = `status === 'confirmed' AND start_at > now()`.** Token is invalid the moment status flips OR the appointment time passes. Matches roadmap success criterion 3.
- **Reschedule rotates the token pair.** Old cancel + reschedule tokens are invalidated atomically with the slot change (same UPDATE). The new "rescheduled" email contains brand-new token URLs for the new time. Cleanest security model.
- **Invalid/used token UX: friendly "no longer active" page including owner email contact.** Branded page: "This link is no longer active. The booking may have already been cancelled or rescheduled. Need help? Contact [account.owner_email]." Page exposes owner email — same surface as the confirmation screen (Plan 05-07 already exposes masked email; here we expose the owner's, not the booker's).
- **Re-book path after cancel: link to public booking page.** Both the cancel-success screen AND the cancellation email include a "Book again" CTA pointing to `/[account]/[event-slug]`. Booker re-books from scratch.

### Email content & .ics method
- **Cancellation: both parties always get emailed**, regardless of who triggered the cancel. Symmetric, no surprises.
- **Reschedule: single "rescheduled" email per party.** Subject pattern: "Booking rescheduled: [event name]". Body shows OLD time → NEW time. Attached `.ics` is `METHOD:REQUEST` with the SAME UID as the original booking (calendar apps update the existing event in place — no orphan events).
- **Cancellation .ics: METHOD:CANCEL with the original UID.** Attached to BOTH booker and owner cancellation emails. Auto-removes the calendar event for any client that imported the original .ics.
- **Owner notification surfaces cancellation reason prominently when non-empty.** Callout block above booking details. Empty reason → omit the row entirely (no "Reason: (none)" empty cells).

### Owner-side cancel (dashboard)
- **Cancel control lives on the bookings detail page only.** Per roadmap success criterion 5; bookings list-row cancel waits for Phase 8 list page. Confirm via shadcn `AlertDialog` (existing primitive from Phase 3).
- **Owner-cancel email to booker is apologetic + includes re-book link.** Copy: "[Owner name] had to cancel your appointment for [time]. We apologize for the inconvenience. Book another time: [link]." Includes METHOD:CANCEL .ics (same as booker-initiated cancel). Owner CAN add a reason in the cancel modal that surfaces in the booker email when non-empty.

### Rate limiting (public token endpoints)
- **Per-IP, sliding window on `/cancel/*` and `/reschedule/*` token routes.** Initial threshold: 10 requests / IP / 5-minute window. Catches enumeration; lets a real booker retry on flaky network.
- **Throttled response: friendly branded page with Retry-After header.** Copy: "Too many requests. Please try again in a few minutes." JSON callers (none in v1) get bare `429` + `Retry-After` header.
- Storage backend (Upstash Redis vs in-memory vs Postgres) is **Claude's discretion** — research should evaluate hobby-tier-friendly options.

### Claude's Discretion
- Rate-limit storage backend choice (Upstash, in-memory keyed by Vercel instance, or Postgres) — researcher to compare cost / cold-start / horizontal-scaling tradeoffs on Vercel hobby tier.
- Exact form layout for the cancel-confirm page (vertical stack vs side-by-side details).
- How to atomically rotate tokens on reschedule (single transaction vs sequenced UPDATE — Plan 05-05 lock prefers no-pre-flight; same race-safety mindset applies here).
- METHOD:CANCEL `SEQUENCE` field handling in ical-generator v10 (RFC 5546 says SEQUENCE must increment for updates; check library default).
- Reschedule "rescheduled" email subject-line pattern (whether to include date diff in subject).
- Whether the `cancel-success` and `reschedule-success` screens reuse the Phase 5 confirmation route shell or get their own minimal route.
- Audit logging granularity in `booking_events` (who cancelled, IP, reason) — Phase 1 schema already has `booking_events` table; use it.

</decisions>

<specifics>
## Specific Ideas

- "Cancel any booking" from the dashboard mirrors the Phase 5 `AlertDialog` confirmation pattern Andrew already shipped in event-types delete (Plan 03-04) — reuse that aesthetic.
- The 2-step cancel-confirm page should feel like the Phase 5 confirmation screen (Plan 05-07): clean card, owner branding, masked-email-style PII discipline. Not a marketing page.
- The "rescheduled" email pattern is calendar-correct because METHOD:REQUEST with the same UID is the iCalendar canonical "update" — Apple Mail, Gmail web, Outlook all handle it natively. Avoids the "old event ghost" problem of a cancel+confirm pair.
- Rate-limit threshold (10 / IP / 5-min) is a starting point — observe in production and tune in Phase 8 hardening if needed.

</specifics>

<deferred>
## Deferred Ideas

- **Owner reschedule on behalf of booker** — owner picks a new time and forces the move. Belongs in a future enhancement; v1 is booker-initiated reschedule only.
- **Bookings list page with row-level cancel** — Phase 8 (DASH-02..04). Owner-cancel from the list-row kebab waits for that page to exist.
- **Token TTL hard cap (e.g. 90-day expiry)** — v1 ties expiry to status + appointment time only. Hard cap could be a Phase 8 hardening item.
- **Dashboard "revoke token" / "regenerate links" action** — not v1; theoretical risk only since tokens already invalidate on status change.
- **Inline re-book on cancel-success screen** — embedded slot picker right on the cancel screen. Adds complexity; "Book again" link is sufficient for v1.
- **Cancel deadline (cannot cancel within X minutes of start)** — not requested; current rule is just `start_at > now()`. Could add later if owners ask for it.
- **Silent CAPTCHA challenge on rate-limit hit** — Turnstile re-challenge instead of hard 429. v1 uses simple block; Turnstile is already a dependency so this is a small future upgrade.

</deferred>

---

*Phase: 06-cancel-and-reschedule-lifecycle*
*Context gathered: 2026-04-25*
