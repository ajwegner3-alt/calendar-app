# Phase 31: Email Hard Cap Guard - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the v1.1 carve-out: every email path in the system (booking confirmation, reminder, cancel, reschedule, owner notification, pushback) must go through `lib/email-sender/quota-guard.ts` and refuse-send fail-closed at the 200/day Gmail SMTP cap. A single refused send returns a clear error to the caller (no silent swallow); every refusal writes a PII-free structured log entry. Pre-flight batch quota helpers consumed by Phases 32 and 33 are enabled by this phase but their UI surfaces ship inside those phases (EMAIL-22, EMAIL-23).

Requirements: EMAIL-21, EMAIL-24, EMAIL-25.

</domain>

<decisions>
## Implementation Decisions

### Booker-facing refusal
- **Owner must be informed** when bookings cannot be confirmed via email — non-negotiable. The booker-facing copy itself stays generic, but the dashboard side must surface the situation.
- Booker-facing error copy: **generic** (e.g., "Something went wrong. Please try again later.") — do not expose quota internals to bookers.
- Owner notification of refused booker-facing sends: **dashboard alert** on the owner surface (e.g., `/app/bookings`) showing how many bookings today have unsent confirmations. **No separate owner email** about the refusal — that send would also count against the same cap.
- Whether to (a) reject the booking outright, (b) save the booking + flag it unconfirmed on the dashboard, or (c) save + queue retry is **Claude's discretion**, with the hard constraint that the owner must be able to see affected bookings.
- Held-slot fate when booking is saved but email failed is **Claude's discretion** — pick the simplest path that doesn't introduce a new lifecycle.

### Owner-facing error UX
- **Error surface:** **inline on the action** that triggered the send (next to / replacing the button or spinner). No global toast, no modal.
- **Error copy:** **plain technical** — state the cap was hit (e.g., "Daily email quota reached (200/200). Resets at UTC midnight.") AND tell the owner they can use **normal Gmail** to send the message manually. The Gmail-fallback hint is mandatory.
- **Recovery instruction:** "wait until tomorrow" (UTC midnight reset). No support-email prompt, no docs link.
- **Proactive quota visibility:** **none** — error-only. Do NOT add a quota counter, 80% banner, or dashboard widget. The 80% in-code warning log already exists and stays where it is.

### Cron / batch behavior
- Behavior when reminder cron hits the cap mid-run, fate of skipped reminders, and the cron HTTP exit code on quota refusals are all **Claude's discretion**. Suggested guideline: log structured refusal entries, don't break the cron platform's success signal, don't introduce a new retry-queue table unless there's strong reason.
- Whether Phase 31 also ships a batch pre-flight helper for Phases 32/33 to consume is **Claude's discretion** — bundle it now if it's a small, contained addition; defer to Phase 32/33 if it would expand scope meaningfully.

### Categories + log payload
- `EmailCategory` granularity, log destination (console-only vs new table vs reuse `email_send_log`), extra log fields beyond the required `code`/`account_id`/`sender_type`/`count`/`cap`, and exact boundary semantics (refuse at 200 vs refuse the 200th vs atomic refuse-at-200) are all **Claude's discretion**.
- Hard constraints: PII-free at all costs (preserve v1.4 observability discipline); the five required fields must be present; the existing v1.1 race-tolerance posture is acceptable unless tightening is trivial.

### Claude's Discretion
The user explicitly delegated the following to Claude during planning/implementation:

- Booking-creation outcome on refusal (reject vs save-and-flag vs save-and-queue), provided the owner is informed.
- Held-slot fate when a booking saves but its confirmation email refuses.
- Cron mid-batch behavior, skipped-reminder handling, and cron HTTP exit code on refusal.
- Whether to ship the batch pre-flight helper in Phase 31 or defer to Phase 32/33.
- `EmailCategory` taxonomy (per-function vs grouped vs booker/owner-split).
- Log destination (`console.error` vs new DB table vs reusing `email_send_log`).
- Extra log fields beyond the required five.
- Boundary semantics for refusal (refuse-at-200 vs refuse-the-200th vs atomic).

</decisions>

<specifics>
## Specific Ideas

- **Gmail fallback as escape hatch:** the owner-facing error must explicitly say "you can use normal Gmail to send the message manually." This is the user's preferred recovery path — don't bury or omit it.
- **Audience separation for booker vs owner:** booker error stays generic; owner gets the technical detail. Booker-facing surfaces remain audience-neutral (LD-07 booker-neutrality lock).
- **No new owner-facing observability widgets in Phase 31** — the user explicitly does not want a quota counter or 80% warning banner added to the dashboard during this phase. Refusals must surface only at the moment they occur (inline error + dashboard alert for unsent booker confirmations).
- **Existing 80% warn log stays as-is** in `quota-guard.ts` lines 65–73 (one-per-day in-memory de-dup).

</specifics>

<deferred>
## Deferred Ideas

- **Quota counter / always-visible usage indicator** on the dashboard — the user said "no, error-only" for Phase 31. Could revisit if owners report missing the cap repeatedly.
- **Resend migration** — already in `quota-guard.ts` comments ("v1.2 will migrate to Resend"). Tracked in `FUTURE_DIRECTIONS.md`. Not in v1.6 scope.
- **Skipped-reminder retry queue** (a real DB-backed retry table) — only worth doing if the cron-batch behavior Claude picks turns out to lose enough reminders to matter. Defer until evidence.
- **Owner-email notification of quota refusals** — explicitly out of scope (it would consume the same quota). Dashboard-only surface.

</deferred>

---

*Phase: 31-email-hard-cap-guard*
*Context gathered: 2026-05-04*
