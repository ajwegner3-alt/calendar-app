# Requirements: Calendar App (NSI Booking Tool) — v1.6 Day-of-Disruption Tools

**Defined:** 2026-05-04
**Core Value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

## v1.6 Requirements

Requirements for the v1.6 milestone. Each maps to roadmap phases.

### Availability — Inverse Date Overrides

- [ ] **AVAIL-01**: Owner can open the date override editor for a specific calendar date and see the new "Enter unavailable windows" mode (replacing the prior "Enter available times" mode); the prior mode is removed from the UI.
- [ ] **AVAIL-02**: Owner can add one or more unavailable time windows to a date (e.g., 10:00–11:00 AND 14:00–15:00 on the same date); the editor supports adding, editing, and removing individual windows.
- [ ] **AVAIL-03**: Owner can toggle "Block entire day" as a separate control (cleaner UX than entering a 12:00am–11:59pm window); when toggled on, the unavailable-windows list is suppressed and the day is fully blocked.
- [ ] **AVAIL-04**: Slot engine (`lib/slots.ts`) computes available slots for a date with overrides as (account-wide weekly hours) MINUS (the date's unavailable windows); the existing buffer + capacity logic continues to apply over the resulting available windows.
- [ ] **AVAIL-05**: When the owner saves an unavailable window (or full-day toggle) that overlaps existing confirmed bookings on that date, the editor shows a warning preview listing every affected booking (booker name, start/end time, event type) before commit.
- [ ] **AVAIL-06**: On confirmation, every existing confirmed booking inside a newly-created unavailable window is auto-cancelled via the existing cancel lifecycle (`booking_events` audit row, status → `cancelled`, .ics CANCEL email to booker, owner notification email).
- [ ] **AVAIL-07**: The auto-cancellation email to bookers explains that the appointment cannot be honored and includes a clear "rebook" CTA linking back to the public booking page; the email passes the existing rate-limit / quota guard for that day's send count.
- [ ] **AVAIL-08**: Existing v1.5 invariants preserved — buffer-after-minutes still applied to remaining available windows; cross-event-type EXCLUDE GIST constraint still binding; partial-unique capacity index still binding; race-safety unchanged.

### Pushback — Day-Level Cascade

- [ ] **PUSH-01**: Owner can open a "Pushback" action from the `/app/bookings` page (button or menu); the action opens a modal/dialog over the bookings list.
- [ ] **PUSH-02**: The pushback dialog defaults to today's date in the owner's account timezone; owner can change the date via a date picker. The dialog lists all confirmed bookings for the selected date in chronological order.
- [ ] **PUSH-03**: Owner picks an anchor booking from the day's bookings (the first booking that needs to move); all bookings starting before the anchor are unaffected.
- [ ] **PUSH-04**: Owner enters a delay amount with units of minutes OR hours (e.g., 15 min, 45 min, 2 hr); input must be a positive integer; the dialog computes new times in real time as input changes.
- [ ] **PUSH-05**: Owner has an optional reason text field (encouraged but not required, max ~280 characters); the same reason text is included in every pushback email in the batch.
- [ ] **PUSH-06**: Smart cascade rule — for each booking after the anchor (in chronological order), the booking moves only if the prior booking's NEW end time is greater than this booking's ORIGINAL start time; otherwise the gap is absorbed and the booking is left in place. When a booking must move, its new start time is the prior booking's new end time (rounded up to the next available slot per existing slot-engine semantics if necessary).
- [ ] **PUSH-07**: Bookings whose new start time would push past the account's end-of-workday for that date (per weekly availability rules and any date overrides) are still moved through the same email lifecycle but flagged in the preview as "rescheduled past end-of-day"; no separate email variant.
- [ ] **PUSH-08**: Owner sees a confirmation preview before commit listing: every booking that will move (booker name + old time → new time + duration), every booking that will not move (gap absorbed), and every booking flagged as "past end-of-day"; total email count surfaced.
- [ ] **PUSH-09**: On confirm, every affected booking rides the existing reschedule lifecycle: `booking_events` audit row, .ics with `METHOD:REQUEST` SEQUENCE+1, calendar invite update email to booker, owner notification, cancel-link in email so booker can decline if the new time doesn't work.
- [ ] **PUSH-10**: Pushback emails include "sorry for the inconvenience" copy + the owner's reason text (when provided); copy is brand-neutral on the booker-facing surfaces (existing v1.5 booker-neutrality lock preserved).
- [ ] **PUSH-11**: Pushback action is race-safe — a booker cancelling or rescheduling concurrently with the pushback commit must not produce duplicate emails or inconsistent calendar state; existing v1.4 EXCLUDE GIST + v1.1 capacity index continue to bind on the new times.
- [ ] **PUSH-12**: Owner sees a post-commit success summary listing emails sent + bookings updated; failure on any individual email surfaces in the summary (does not roll back successful sends).

### Email — 200/day Hard Cap

- [ ] **EMAIL-21**: The Gmail SMTP daily quota guard (`lib/email-sender/quota-guard.ts`) refuses to send when the day's count is at 200; refusal applies to ALL email senders including bookings, reminders, reschedules, and pushback (extends the v1.1 carve-out which previously exempted bookings/reminders).
- [ ] **EMAIL-22**: When a pushback batch is previewed (before commit), the dialog computes the batch email count and shows remaining daily quota; if the batch would exceed remaining quota, the preview shows a clear error and the commit button is disabled (pre-flight budget; no partial sends).
- [ ] **EMAIL-23**: When a date-override auto-cancel batch (AVAIL-06) would exceed remaining daily quota, the same pre-flight budget pattern applies — preview surfaces the conflict and commit is disabled until the next day or the cap is raised.
- [ ] **EMAIL-24**: A refused single send (e.g., a booking confirmation when the cap is hit) returns a clear error to the user-facing path that triggered it; no silent failure, no retry-spam.
- [ ] **EMAIL-25**: All quota refusals are logged with PII-free structured fields (`code: 'EMAIL_QUOTA_EXCEEDED'`, `account_id`, `sender_type`, `count`, `cap`); existing v1.4 PII-free observability discipline preserved.

## Future Requirements (deferred to v1.7+)

Tracked but not in v1.6 roadmap.

### Email — Per-Account Gmail / Provider Migration

- **EMAIL-26**: Each account can connect its own Gmail account so that account's emails are sent from that owner's inbox (distributes 200/day load across tenants); deferred per Path A v1.6 scope-lock.
- **EMAIL-27**: Alternative — migrate from Gmail SMTP to Resend (~$10/mo for 5k emails), eliminates the cap entirely; deferred per Path A v1.6 scope-lock.

### Buffer / Booker Polish (deferred from v1.5)

- **BUFFER-07**: Wire `event_types.buffer_before_minutes` into the slot engine (column already exists at default 0).
- **BUFFER-08**: Owner-facing "X min buffer" badge on event-type list cards.
- **BUFFER-09**: Configurable buffer step granularity (1-min instead of 5-min).
- **BOOKER-06**: Animated form slide-in (CSS translate-x transition on slot pick).
- **BOOKER-07**: Skeleton loader on slow `/api/slots` response.

### Auth / Infra (long-deferred carryover)

- **AUTH-23**: OAuth signup (Google / Microsoft).
- **AUTH-24**: Magic-link login.
- **INFRA-02**: Vercel Pro hourly cron flip (`vercel.json` `0 * * * *`).
- **BRAND-22**: NSI brand asset replacement (`public/nsi-mark.png` placeholder).
- **DEBT-01..07**: 7 tech debt items from v1.0–v1.2 carryover.

### v1.5 Tech Debt

- **DEBT-08**: Delete `slot-picker.tsx` after reschedule UI redesign; extract shared `<CalendarSlotPicker>` component (booker + reschedule).

## Out of Scope

Explicitly excluded from v1.6.

| Feature | Reason |
|---------|--------|
| Per-account Gmail OAuth or app-password connection | Path A scope-lock 2026-05-04 — defer to v1.7+ after live-use signal on whether the 200/day cap actually bites |
| Resend migration (INFRA-01) | Path A scope-lock 2026-05-04 — same reason; revisit alongside per-account Gmail decision |
| SMS notifications for pushback | Out-of-scope per project-level "email only in v1" lock; SMS would require new vendor + per-tenant phone number setup |
| Two-way negotiation in pushback (booker proposes alternate time) | v1.6 ships one-way: owner pushes, booker accepts or cancels; counter-proposal is a v2-class feature |
| Bulk cancel UI separate from inverse date override | Auto-cancel during inverse-availability commit is the only cancel-batch path; standalone bulk cancel adds UI surface for no proven need |
| Pushback applied across multiple days at once | v1.6 pushback is single-day only (anchor booking + later same-day bookings); cross-day cascade adds combinatorial complexity for no concrete owner request |
| Pushback preview / undo as a "schedule change" first-class entity in DB | The action commits each affected booking via the existing reschedule lifecycle (one row per affected booking); a parent "pushback event" entity is not required |
| Auto-rebook offer in pushback / cancel emails (suggested replacement times) | Email includes a "rebook" CTA link to the public booking page; suggested-time picker in email is v2-class |
| Customer-facing "schedule disruption" page or status banner | Email-only notification per project-level "email only" lock; no public status surface |

## Traceability

Empty initially. Populated during roadmap creation (Phase 9 of `/gsd:new-milestone`).

| Requirement | Phase | Status |
|-------------|-------|--------|
| AVAIL-01 | TBD | Pending |
| AVAIL-02 | TBD | Pending |
| AVAIL-03 | TBD | Pending |
| AVAIL-04 | TBD | Pending |
| AVAIL-05 | TBD | Pending |
| AVAIL-06 | TBD | Pending |
| AVAIL-07 | TBD | Pending |
| AVAIL-08 | TBD | Pending |
| PUSH-01 | TBD | Pending |
| PUSH-02 | TBD | Pending |
| PUSH-03 | TBD | Pending |
| PUSH-04 | TBD | Pending |
| PUSH-05 | TBD | Pending |
| PUSH-06 | TBD | Pending |
| PUSH-07 | TBD | Pending |
| PUSH-08 | TBD | Pending |
| PUSH-09 | TBD | Pending |
| PUSH-10 | TBD | Pending |
| PUSH-11 | TBD | Pending |
| PUSH-12 | TBD | Pending |
| EMAIL-21 | TBD | Pending |
| EMAIL-22 | TBD | Pending |
| EMAIL-23 | TBD | Pending |
| EMAIL-24 | TBD | Pending |
| EMAIL-25 | TBD | Pending |

**Coverage:**
- v1.6 requirements: 25 total (8 AVAIL + 12 PUSH + 5 EMAIL)
- Mapped to phases: 0 ⚠️ (filled by roadmapper)
- Unmapped: 25 ⚠️

---
*Requirements defined: 2026-05-04*
*Last updated: 2026-05-04 after `/gsd:new-milestone` requirements pass; awaiting roadmap.*
