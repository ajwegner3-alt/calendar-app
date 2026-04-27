# Project Milestones: Calendar App (NSI Booking Tool)

## v1.0 MVP (Shipped: 2026-04-27)

**Delivered:** A Calendly-style multi-tenant booking tool with race-safe DB-level slot uniqueness, DST-correct slot computation, branded embeddable widget with postMessage height protocol, and end-to-end booking lifecycle (book / confirm / cancel / reschedule / 24h reminder) wired to Andrew's NSI account on Vercel + Supabase.

**Phases completed:** 1-9 (52 plans total)

**Key accomplishments:**

- **DB-level race-safe booking via partial unique index** (`bookings_no_double_book` on `(event_type_id, start_at) WHERE status='confirmed'`) — proven by Vitest race test; two concurrent submits → one 201, one 409 with clean inline-banner UX preserving form values.
- **DST-correct slot engine** (`lib/slots.ts` pure `computeSlots()` + 13-test integration suite) validated against March 8 + Nov 1 2026 US DST transitions with no missing or duplicate slots at the boundary; `TZDate` from `@date-fns/tz` v4 for wall-clock construction, never `addMinutes` for window endpoints.
- **Multi-tenant data layer with RLS cross-tenant matrix** — 6 tables (`accounts`, `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events`) all with `account_id` denormalized + RLS policies; Plan 08-08 RLS matrix test proves a second seeded tenant cannot read or write the first tenant's data via any client context.
- **Branded embeddable widget with `nsi-booking:height` postMessage protocol** — chromeless `/embed/[account]/[event-slug]` route with per-route CSP `frame-ancestors *` (proxy.ts owns CSP exclusively); `/widget.js` Route Handler with 5s handshake timeout; live-verified posting from `https://example.com` 2026-04-26.
- **Full email lifecycle on Gmail SMTP via vendored `@nsi/email-sender`** — booker confirmation + .ics (`METHOD:REQUEST`, stable UID, VTIMEZONE block), owner notification, cancel pair, reschedule pair (`METHOD:REQUEST` SEQUENCE+1), and 24h reminder; per-account branded email blocks (logo header + brand H1 + branded CTA + Powered by NSI footer).
- **Reliable reminder cron with claim-once semantics** — Vercel hourly Cron at `/api/cron/send-reminders` authenticated by `CRON_SECRET`; compare-and-set UPDATE claims `reminder_sent_at` so duplicate cron invocations send exactly one reminder per booking; immediate-send hook for bookings created inside the 24h window.
- **Token-based booker self-service for cancel + reschedule** — SHA-256 hashed tokens in DB, raw tokens only in email; rate-limited at 10/5min/IP via Postgres-backed `rate_limit_events` table; double CAS guard prevents concurrent same-token success; tokens rotate on every reminder send.

**Stats:**

- 344 files created/modified across the 9-phase span
- 85,014 lines inserted total; 20,417 lines of TypeScript/TSX in the runtime tree at sign-off
- 9 phases, 52 plans, ~180 tasks, 222 commits
- 10 days from project start (2026-04-18) to v1 ship (2026-04-27)
- 131 passing + 1 skipped automated tests (16 test files) at sign-off

**Git range:** `e068ab8` (docs: initialize project) → `3f83461` (docs(09): complete manual-qa-and-verification phase)

**What's next:** v1.1 — close deferred QA items (marathon QA execution: 6 ROADMAP criteria + 9 Phase 8 dashboard sub-criteria + per-template branding 6-row smoke + Squarespace/Wix verification + cron-fired-in-prod). See FUTURE_DIRECTIONS.md for canonical v1.1 backlog enumeration.

---
