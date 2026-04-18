# Calendar App (NSI Booking Tool)

## What This Is

A Calendly-style booking tool that lets visitors pick a time slot on a website and puts the appointment directly into the site owner's schedule. Andrew uses it for his own NSI bookings and white-labels it onto client websites (trade contractors: plumbers, HVAC, roofers, electricians). It's a multi-tenant web app — one codebase, one Supabase project, many branded booking pages.

## Core Value

A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Architecture & auth**
- [ ] Multi-tenant data model in Supabase (accounts, event types, availability, bookings) built in from day one
- [ ] Secure owner authentication via Supabase Auth (email/password)
- [ ] Deployed as a single Vercel app; schema supports many accounts even though v1 ships with one

**Owner side (Andrew's v1 use)**
- [ ] Owner can define multiple event types per account (e.g., "15-min discovery call", "60-min consultation") with per-type duration and custom questions
- [ ] Owner sets weekly recurring availability (Mon–Fri 9–5 etc.) with per-date overrides (vacation, holidays, one-off blocks)
- [ ] Owner sees a dashboard listing upcoming and past bookings
- [ ] Owner can cancel a booking from the dashboard

**Booker side**
- [ ] Public booking page shows available slots converted to booker's local time zone (browser auto-detect)
- [ ] Booker fills in standard fields (name, email, phone) plus any custom questions defined on the event type
- [ ] Booking is persisted in Supabase as the sole source of truth for availability (no Google Calendar sync)
- [ ] Booker receives email confirmation with .ics calendar invite attached
- [ ] Booker receives reminder email 24 hours before the appointment
- [ ] Booker can cancel or reschedule via links embedded in the confirmation email

**Embed & branding**
- [ ] Embeddable widget (iframe or script snippet) that drops into any website (NSI site, Squarespace, WordPress, custom)
- [ ] Per-account branding: account uploads logo, picks brand colors; widget and booking page render with those
- [ ] Owner also gets a hosted booking page URL for direct linking

**Notifications (owner + infra)**
- [ ] Owner receives email when a new booking is created
- [ ] Emails sent via the shared `@nsi/email-sender` tool using the Resend provider
- [ ] Reminder emails dispatched by a scheduled job (Supabase `pg_cron` or Vercel cron)

### Out of Scope

- **Google Calendar / iCal / Outlook sync** — Andrew explicitly wants Supabase as the sole source of truth; no external calendar OAuth.
- **Paid bookings / Stripe integration** — all bookings are free in v1; trade contractors don't typically charge for quote consultations.
- **Signup UI for new accounts / client self-serve onboarding** — v1 ships Andrew's account only; additional accounts are provisioned by Andrew when selling to a client (can come in a later milestone).
- **Custom subdomains (`book.clientsite.com`)** — per-account path-based URLs (`app.com/acct/plumber-bob`) are sufficient for v1; DNS work deferred.
- **Custom CSS white-label** — v1 offers logo + color theming only, not arbitrary CSS.
- **Configurable reminder timing** — hardcoded at 24h before appointment in v1.
- **Per-event-type availability schedules** — v1 uses account-wide availability applied to all event types; per-type schedules deferred.
- **Multiple reminders (24h + 1h)** — single 24h reminder in v1.
- **SMS notifications** — email only in v1.
- **Mobile app** — web-only (widget + hosted page).

## Context

**Business context.** Andrew runs North Star Integrations (NSI), a web design + business automation consultancy in Omaha targeting trade contractors. This tool is both (1) something he uses personally for his own client consultations and (2) a white-labelable product he drops into websites he builds for clients. Ability to brand it per-client is what makes it a sellable deliverable, not just an internal tool.

**Ship fast for personal use.** v1 only needs to work for Andrew's own account on the NSI site. Multi-tenant plumbing is baked into the schema from day one so later milestones can light up additional accounts without migrations — but the signup/onboarding UI and multiple simultaneous tenants aren't v1 concerns.

**Existing tooling to reuse.**
- `C:\Users\andre\OneDrive - Creighton University\Desktop\Claude-Code-Projects\tools-made-by-claude-for-claude\email-sender` (`@nsi/email-sender`) — handles all transactional email via Resend; supports attachments, so .ics files can ride along on confirmations. A new booking-specific template will need to be added.
- Supabase project named `calendar` already exists.

**Known integration surface.** Widget must embed cleanly into Squarespace, WordPress, and custom Next.js sites. Iframe is most portable; a script snippet that injects the iframe is the typical pattern.

## Constraints

- **Tech stack**: Next.js + Tailwind CSS + TypeScript on Vercel, Supabase for DB + Auth, `@nsi/email-sender` (Resend) for email. — Matches Andrew's standard NSI stack; everything stays on free/low tiers of services he already uses.
- **Hosting budget**: Must fit free tiers of Vercel + Supabase + Resend (3k emails/mo). — Andrew is on Claude Max 5x ($100/mo) and prefers free-tier services.
- **Data ownership**: Supabase is the sole source of truth for availability and bookings. — Explicit user preference; avoids Google OAuth complexity and third-party sync failure modes.
- **Multi-tenant from day one**: Schema must isolate data per account even though only one account exists in v1. — Avoids a painful data-migration milestone later when more tenants come online.
- **Deploy after every logical unit**: Push to GitHub → Vercel for each completed feature per Andrew's live-testing workflow. — Defined in `CLAUDE.md`.
- **Manual QA as final phase**: Last phase is explicitly Manual QA & Verification; project isn't done until Andrew signs off. — Defined in `CLAUDE.md`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Calendly-style booking tool, not a general calendar | Matches the actual use case (visitors booking owner's time); narrower scope ships faster | — Pending |
| Multi-tenant architecture from day one, v1 ships single account | Supports the NSI business model (sell to clients) without forcing a later data migration; still ships fast by deferring signup UI | — Pending |
| Embeddable widget (iframe/script) as primary embed, plus hosted page per account | Portable to any host site (Squarespace/WordPress/custom); hosted page gives a shareable link option | — Pending |
| Supabase is sole source of truth — no Google Calendar sync | Explicit user preference; removes OAuth/sync complexity; trade-off is owner must manage all availability in-app | — Pending |
| Per-account branding = logo + colors only (no custom CSS) | Good enough for trade contractor sites; avoids support burden of arbitrary CSS | — Pending |
| Emails via `@nsi/email-sender` (Resend) | Existing reusable tool from shared folder; already handles attachments needed for .ics | — Pending |
| Free bookings only; no Stripe | Trade contractors don't charge for quote consultations; removes PCI/Stripe scope from v1 | — Pending |
| v1 scope = Andrew's booking page + widget on NSI site | Ships fastest path to personal utility; client-onboarding flows come in a later milestone | — Pending |

---
*Last updated: 2026-04-18 after initialization*
