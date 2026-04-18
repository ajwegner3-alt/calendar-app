# Feature Landscape

**Domain:** Multi-tenant Calendly-style booking tool (trade-contractor vertical)
**Researched:** 2026-04-18
**Research mode:** Ecosystem
**Overall confidence:** MEDIUM-HIGH (based on training knowledge of Calendly, Cal.com, SavvyCal, Acuity, TidyCal, YouCanBookMe; WebSearch unavailable this session so specific recent UI changes unverified)

## Context and Framing

This project is a booking widget for trade contractors (plumbers, HVAC, roofers, electricians) taking quote/estimate consultations from homeowners. The competitive landscape is:

- **Calendly** — market leader, broad B2B/B2C, mature feature set, freemium
- **Cal.com** — open-source Calendly alternative, dev-friendly, self-hostable
- **SavvyCal** — premium UX, overlay availability, "ranked times"
- **Acuity (Squarespace)** — heavier, service-business oriented, intake forms + payments
- **TidyCal** — budget/AppSumo, lightweight
- **YouCanBookMe** — UK-origin, customization-focused
- **HoneyBook / Jobber / Housecall Pro** — vertical CRMs that include booking (competitive pressure, not direct feature peer)

The feature bar we must hit is *homeowner-facing booking UX on par with Calendly* (homeowners have seen Calendly; anything clunkier feels broken). The bar we can *ignore* is the enterprise/team-scheduling bar (round-robin across reps, Salesforce sync, workflows builder).

---

## Table Stakes

Features where absence makes the tool feel broken or unusable. If any of these ship missing, users (contractor or homeowner) will bounce.

### Availability & Scheduling Core

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Weekly recurring availability (per day, multiple windows) | Contractor sets "Mon-Fri 9a-5p, Sat 10a-2p" — the baseline mental model | M | — |
| Per-date overrides (holidays, vacation, one-off blocks) | Contractor takes July 4 off or blocks Thursday afternoon | M | Weekly availability |
| Minimum notice / scheduling window ("can't book less than 4 hours out") | Prevents someone booking 30 minutes from now | S | Availability engine |
| Maximum advance window ("only bookable 60 days out") | Prevents bookings 2 years out | S | Availability engine |
| Buffer time between bookings (before/after) | Contractor needs 30 min drive time between jobs | S | Availability engine |
| Daily max bookings cap | Contractor doesn't want 12 estimates in one day | S | Availability engine |
| Slot duration / increment (15, 30, 60 min) | Per event type | S | Event types |
| Prevent double-booking (atomic slot reservation) | Race condition handling is existential — two homeowners booking same slot is a disaster | L | DB transactions, conflict checks |

### Event Types

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Multiple event types per account ("Free Estimate 30min", "Emergency Call 15min", "In-Home Consult 60min") | Contractors offer different services at different lengths | M | Account model |
| Per-event-type availability override (optional) | "Emergency only available evenings" | M | Event types + availability |
| Custom URL slug per event type (`/andrew/estimate`) | Shareable, embeddable links | S | Account routing |
| Event description (what homeowner sees) | Sets expectations | S | Event types |
| Location field (in-person address, phone, video link) | Homeowner needs to know where/how | S | Event types |

### Booker Experience (Homeowner-Facing)

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Mobile-responsive booking UI | >50% of homeowner traffic is mobile; a broken mobile flow kills conversion | M | Widget |
| Month/week calendar view with available days | Standard Calendly UX pattern | M | Availability query |
| Time slot selection after date pick | Standard pattern | S | Availability query |
| Standard fields: name, email, phone | Phone is *required* for this vertical (contractor needs to call) | S | Booking form |
| Custom questions per event type (text, long text, select, yes/no) | "What's the issue?", "Single story or two story?", "Street address?" | M | Event types |
| Required vs optional field marking | Standard form UX | S | Custom questions |
| Confirmation screen with all booking details | User needs proof it worked | S | Booking flow |
| Time zone auto-detection for booker | Homeowner sees slots in their local time — non-negotiable | M | TZ library (luxon/date-fns-tz) |
| Time zone display for owner (always contractor's TZ on admin side) | Contractor thinks in local time | S | TZ library |

### Notifications & Lifecycle

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Booker confirmation email | Trust signal, record of appointment | S | @nsi/email-sender |
| Owner notification email (contractor gets notified) | Contractor needs to know a booking happened | S | @nsi/email-sender |
| .ics calendar attachment on confirmation | Homeowner adds to their calendar — huge no-show reducer | M | ics library |
| 24-hour reminder email | Reduces no-shows significantly (industry-reported 20-30% reduction) | M | Scheduled job / cron |
| Cancel via email link (tokenized URL, no login) | Homeowner must be able to cancel without creating an account | M | Signed tokens |
| Reschedule via email link | Same as above — account-less reschedule | M | Signed tokens, reuse booking flow |
| Cancellation notifies owner | Contractor needs to know slot freed up | S | Email + event hooks |
| Reschedule notifies owner | Same | S | Email + event hooks |

### Account & Branding

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Per-account logo upload | Contractor's brand on the booking page | S | Supabase Storage |
| Per-account primary color | Matches contractor's site | S | CSS vars / Tailwind |
| Per-account booking page URL (`book.nsi.com/andrews-plumbing`) | Shareable hosted page (alt to widget) | M | Routing, slug reservation |
| Admin auth (contractor logs in to manage) | Non-negotiable security | M | Supabase Auth |

### Embed / Widget UX

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Inline iframe embed (drops into a div on contractor's site) | Primary v1 distribution | M | Widget route, iframe-safe CSS |
| Embed snippet generator in admin ("copy this code") | Non-technical contractors can't hand-write iframes | S | Admin UI |
| Widget height auto-adjusts (or sensible min-height) | Nothing worse than a scroll-inside-scroll | M | postMessage or fixed responsive heights |
| Works cross-origin (no X-Frame-Options / frame-ancestors block) | Must embed on any domain | S | HTTP headers config |

### Reliability & Trust

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Booking persists even if email fails (email is not the source of truth) | Lost booking = lost revenue | S | Async email, DB-first writes |
| Idempotent booking submission (double-click doesn't create two bookings) | Common homeowner behavior | S | Request ID or DB unique constraint |
| Graceful conflict handling ("that slot was just taken, pick another") | Race condition UX | M | Atomic availability check + retry UI |
| Basic spam protection (honeypot or rate limit) | Public forms get bot traffic | S | Rate limit middleware |

---

## Differentiators

Features that are *not* expected but create a meaningful edge, especially for the trade-contractor vertical. Pick 1-2 for v1; the rest are v2+.

### Trade-Vertical-Specific (Strong Differentiators)

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Service area gating by ZIP code** | Homeowner enters ZIP before seeing availability; out-of-area = "we don't service your area, here's our number" — saves contractor from drive-to-nowhere estimates | M | Custom questions, pre-booking step |
| **Photo upload in booking form** | "Upload a photo of the leak/roof/panel" — contractor pre-qualifies before driving out | M | Supabase Storage, file size limits |
| **Urgency tier ("Can wait 1 week" / "This week" / "Emergency")** | Contractor can triage booking queue; emergency routes to different calendar | S | Custom questions, possibly conditional routing |
| **Two-story / property type quick selector** | Plumbers/roofers need this; asking up front prevents on-site surprise | S | Custom questions with structured types |
| **Address capture with Google Places autocomplete** | Valid address = real lead; free text is spam-prone | M | Google Places API (free tier) |

### Booker UX Polish

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Weekend/business-day visual distinction | Homeowners understand quickly | S | UI |
| Show "next available" CTA when current week is full | Reduces bounce when booking far out | S | Availability query |
| Explicit time zone confirmation ("We detected Central Time — correct?") | Edge case but loud when it fails | S | TZ library |
| SMS reminder (in addition to email) | Massive no-show reduction for homeowner bookings | L | Twilio integration, phone verification |

### Owner/Contractor Tooling

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Bookings list / dashboard with filters | Contractor sees what's on the calendar | M | Admin UI |
| Manual booking creation ("I talked to Susan on the phone, block that slot") | Admin needs to reserve slots not booked through the widget | M | Admin UI, reuse booking flow |
| Export bookings CSV | For contractors who live in spreadsheets | S | Admin UI |
| Basic analytics (bookings this week, no-show rate, cancel rate) | Contractor sanity check | M | Aggregation query |
| Webhook on new booking | Future Zapier/n8n integration | S | HTTP POST on event |

### Branding (Beyond v1)

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Custom favicon on hosted booking page | White-label polish | S | Storage |
| Custom subdomain (`book.andrewsplumbing.com` CNAME) | Looks native on contractor's domain | L | DNS, TLS provisioning, middleware routing |
| Remove "Powered by NSI" on higher tier | Monetization hook | S | Plan-gated flag |

---

## Anti-Features

Features to deliberately NOT build. These are where competitors over-invested and where complexity compounds without matching user value for the trade-contractor use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Google/Outlook/iCloud calendar sync (two-way)** | Massive complexity (OAuth, token refresh, webhooks, conflict resolution, freebusy lookups). Explicitly out of scope — Supabase is source of truth. | Send .ics on confirmation so contractor can add to their own calendar manually |
| **Round-robin / collective / team scheduling** | Enterprise feature; our users are solo or small teams. Pulls in team management, assignment logic, load balancing. | v1 is single-owner-per-account. If a 3-person shop needs it later, add per-owner event types. |
| **Payments at booking / deposits** | Stripe integration + refund flows + tax + dispute handling is a project of its own. Trade contractors typically don't charge for estimates. | Defer entirely. If added, scope as its own milestone. |
| **Workflow builder (drag-drop automation)** | Calendly and Cal.com have these; they're bloat for our users. | Hard-coded: confirmation, owner-notify, 24h reminder, .ics. That's it. |
| **Multi-step booking wizards with conditional branching** | Form builders are quicksand. | Flat form with optional custom questions per event type — no conditional logic in v1. |
| **SMS two-way conversation / chat** | Not scheduling — that's a different product. | Email-only for v1; SMS reminder (one-way) is a v2 differentiator at most. |
| **Video conferencing integration (Zoom/Meet auto-create)** | Homeowner estimates happen in-person or by phone, not Zoom. | "Location" is a free-text field — contractor writes "I'll call you at the number above" |
| **Timezone-independent "floating" events** | Irrelevant for a geographically-local service business | Everything is in the contractor's TZ; booker sees their own TZ |
| **Group bookings (multiple attendees per slot)** | Trade estimates are 1:1 | One booking = one slot = one homeowner |
| **Polls / "find a time" group scheduling** | Different product (Doodle-style) | Not in scope |
| **Custom CSS / theme editor** | Support nightmare, breaks on every layout update | Logo + primary color only in v1. If the contractor wants full custom, they can style around the embed |
| **White-label reselling / agency multi-account admin** | Multi-tenant != agency. Users managing other users is a separate auth tier. | Each contractor has their own account. Andrew (operator) has DB access if needed. |
| **Mobile native app** | The web widget works on mobile; native is 10x effort for marginal gain | Responsive web only |
| **Recurring bookings** ("book every other Tuesday for 6 weeks") | Estimates aren't recurring | One-off bookings only |
| **Waitlists** | Premature — requires notification plumbing, conflict resolution | "Pick another slot" is the v1 answer |

---

## Feature Dependency Map

High-level build order based on dependencies:

```
Foundation:
  Account model + Auth
    ↓
  Event types (depends on account)
    ↓
  Weekly availability (depends on account)
    ↓
  Date overrides (depends on weekly availability)
    ↓
  Availability query engine (computes free slots from rules + existing bookings)

Booker flow:
  Widget route + embed (depends on event type)
    ↓
  Booking form (depends on event type's custom questions)
    ↓
  Atomic booking insert (depends on availability query)
    ↓
  Email pipeline (confirmation + owner notify + .ics) — depends on booking insert

Lifecycle:
  Tokenized cancel/reschedule links (depends on booking + email)
    ↓
  Reminder job (depends on booking + email + scheduler)

Admin:
  Bookings list (depends on booking data)
    ↓
  Branding upload (depends on account + Supabase Storage)
    ↓
  Embed snippet generator (depends on event type URLs)
```

**Critical path for usable v1:**
1. Account + auth
2. Event types
3. Availability (weekly + overrides + query engine)
4. Widget + booking form + atomic insert
5. Email pipeline (confirmation + owner + .ics)
6. Cancel/reschedule tokens
7. Admin bookings list + branding upload + embed snippet

Everything else (reminders, analytics, differentiators) layers on.

---

## MVP Recommendation

**v1 (ship it) — Table Stakes only:**
1. Account, auth, single-owner-per-account
2. Event types with custom questions + custom URL slug
3. Weekly availability + date overrides + buffers + min-notice + max-window + daily cap
4. Atomic booking with race-safe slot reservation
5. Booker flow: date/time pick → form → confirmation, mobile responsive, TZ-aware
6. Email: confirmation + owner-notify + .ics + 24h reminder
7. Email-link cancel + reschedule (tokenized)
8. Admin: bookings list, logo + color branding, embed snippet generator
9. Inline iframe embed + hosted booking page

**v1.1 (first post-launch iteration) — pick 2 trade-vertical differentiators:**
- Service-area ZIP gating (highest leverage for contractors)
- Photo upload in booking form
- Urgency tier selector

**Explicitly deferred (v2+):**
- SMS reminders (Twilio integration effort doesn't fit v1 scope)
- Custom subdomain (`book.theirdomain.com`)
- Manual booking creation in admin
- Analytics dashboard
- Webhooks
- Address autocomplete (Google Places)

**Never (anti-features):**
- Calendar sync, payments, round-robin, workflow builder, SMS chat, video integration, recurring bookings, waitlists, custom CSS, group bookings.

---

## Complexity Hotspots (Flag for Roadmap)

These features look small but have outsized complexity; the roadmap phase covering them should get deeper research:

| Area | Why It's Harder Than It Looks |
|------|-------------------------------|
| Availability query engine | Combining weekly rules + date overrides + buffers + existing bookings + TZ into "list of free slots for date D" is the algorithmic core of the product. Off-by-one errors and DST bugs live here. |
| Atomic booking / no double-booking | Requires DB-level transaction with conflict detection. Naive "check then insert" has a race window. |
| Time zones end-to-end | Storage (UTC), computation (contractor TZ), display (booker TZ), DST transitions, TZ-less dates (overrides). This bites every scheduling tool. |
| Tokenized cancel/reschedule without login | Token signing + expiry + single-use vs reusable + abuse prevention. Needs a deliberate design. |
| Embed iframe sizing across domains | postMessage handshake or fixed responsive heights — one is complex, the other is imperfect. Pick deliberately. |
| Reminder job scheduling | 24h reminders require a scheduler (cron, Supabase pg_cron, or Vercel cron). Race with cancellation (don't send reminder for cancelled booking). |

---

## Sources & Confidence

**HIGH confidence** (based on widely-documented product behavior from Calendly, Cal.com, SavvyCal that is stable across years):
- Event type structure, availability rules, buffer/min-notice patterns
- Email lifecycle (confirmation + reminder + .ics)
- Tokenized cancel/reschedule links (universal pattern)
- Anti-features list (these are consistently the feature-bloat traps)

**MEDIUM confidence** (current training, but specific UI/feature details may have shifted):
- Exact feature differentiation between SavvyCal/TidyCal/YouCanBookMe tiers
- Specific complexity estimates (S/M/L) — these are informed guesses based on typical implementation effort, not measured

**LOW confidence** (flag for validation during implementation):
- Specific claims about "X% no-show reduction" from reminders — directional truth, specific numbers unverified
- Whether current Calendly/Cal.com have added new features since training cutoff that shift "table stakes" (e.g., AI scheduling assistants are emerging — monitor, but not urgent for v1)

**Research limitation:** WebSearch was unavailable in this session; findings are from model knowledge (cutoff January 2026) rather than fresh competitive scans. Recommend a quick manual spot-check of Calendly's current booking flow and Cal.com's OSS feature set before finalizing v1 scope — specifically to confirm no new "table stakes" feature has emerged (e.g., AI-generated booking summaries, accessibility requirements) that would change the MVP list.
