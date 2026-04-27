---
phase: 08-reminders-hardening-and-dashboard-list
verified: 2026-04-26T07:25:00Z
status: human_needed
score: 47/47 must-haves verified in code
test_suite:
  passing: 131
  skipped: 1
  total: 132
human_verification:
  - test: Vercel Cron first hourly tick fires send-reminders successfully
    expected: Vercel dashboard Crons tab shows green check on top-of-hour run with 200 status
    why_human: CRON_SECRET upload to Vercel + first cron tick must be observed live
    phase_9_deferred: false
    blocking: true
  - test: End-to-end reminder email delivery (live)
    expected: Booking 23h-out receives reminder email within 1h of cron tick; cancel/reschedule links work
    why_human: Requires real SMTP send + inbox inspection + clicking real tokens
    phase_9_deferred: true
  - test: mail-tester score for confirmation + reminder emails 9 of 10 or higher
    expected: Both email templates score 9 or higher with verified SPF DKIM DMARC
    why_human: Live deliverability test requires sending to mail-tester inbox
    phase_9_deferred: true
  - test: SPF DKIM DMARC verified on sending domain
    expected: Namecheap DNS shows passing records; mail-tester confirms
    why_human: DNS configuration in Namecheap UI
    phase_9_deferred: true
  - test: cron-job.org configured or Vercel Pro confirmed for hourly hits
    expected: Either cron-job.org hits hourly with valid Bearer OR Vercel Pro tier confirmed
    why_human: Requires Andrew Vercel billing tier check
    phase_9_deferred: false
  - test: Live RLS matrix run with TEST_OWNER_2 env populated
    expected: After Andrew creates second Supabase auth user full RLS matrix passes
    why_human: Requires Andrew to create second Supabase user via dashboard
    phase_9_deferred: false
  - test: Dashboard bookings list visual review
    expected: Status badges correct colors; filter URL state persists; pagination works
    why_human: Visual + click-through verification by Andrew
    phase_9_deferred: true
  - test: Owner-note autosave UX
    expected: Typing pauses save 800ms after last keystroke; tabbing forces flush; Saved indicator appears
    why_human: Real keyboard timing + visual confirmation
    phase_9_deferred: true
gaps: []
---

# Phase 8 Reminders Hardening and Dashboard List - Verification Report

Phase Goal (ROADMAP): Reminders fire reliably 24h before appointments; production is hardened (rate limits, deliverability, RLS audit); Andrew has a real bookings dashboard.

Verified: 2026-04-26 -- Status: human_needed -- Re-verification: No (initial)

## Summary

All 47 must-haves across the 8 plans (08-01 through 08-08) verified in code. Test suite passes (131 passing + 1 expected skip for RLS matrix without TEST_OWNER_2 env). Code-level goal achievement is complete; remaining items are operational/deliverability checks deferred to Phase 9 manual QA, plus first-cron-tick observation in Vercel.

## Goal Achievement - Observable Truths

### Reminders fire reliably 24h before appointments

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | GET /api/cron/send-reminders requires Bearer CRON_SECRET (401 otherwise) | verified | route.ts lines 101-105 |
| 2 | Compare-and-set claim via UPDATE WHERE reminder_sent_at IS NULL ensures exactly-once | verified | route.ts 180-200 .is reminder_sent_at null CAS guard |
| 3 | Cron sends reminder emails after CAS via after() from next/server (Vercel-safe) | verified | route.ts 42 import; 227-268 usage |
| 4 | Booking created within 24h triggers immediate reminder | verified | bookings route 280-395 same CAS pattern + after sendReminderBooker |
| 5 | Token rotation invalidates confirmation tokens at reminder send | verified | route.ts 175-185 fresh cancel + reschedule token hashes |
| 6 | vercel.json declares cron at /api/cron/send-reminders | verified | vercel.json hourly schedule |
| 7 | Reminder email respects per-account toggles | verified | lib/email/send-reminder-booker.ts three conditional blocks |
| 8 | Audit log row inserted into booking_events with event_type=reminder_sent actor=system | verified | route.ts 209-219 cron + bookings route 318-327 immediate |
| 9 | tests/reminder-cron.test.ts proves auth CAS idempotency toggles | verified | 338-line vitest |

### Production is hardened (rate limits + RLS audit)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 10 | POST /api/bookings rate-limited 20 per IP per 5min via shared lib/rate-limit.ts | verified | bookings route 114 checkRateLimit |
| 11 | Rate limit runs BEFORE Turnstile (cheaper fail-fast) | verified | rate limit 114 turnstile 130 |
| 12 | 21st req returns 429 with Retry-After header + RATE_LIMITED code | verified | route.ts 115-122 + tests/bookings-rate-limit.test.ts |
| 13 | RLS matrix proves cross-tenant SELECT lockout across 4 tables | verified | rls-cross-tenant-matrix.test.ts 173-189 loop |
| 14 | RLS matrix proves anon SELECT lockout | verified | rls-cross-tenant-matrix.test.ts 156-166 |
| 15 | RLS matrix proves cross-tenant UPDATE lockout | verified | rls-cross-tenant-matrix.test.ts 195-231 |
| 16 | RLS matrix includes admin service-role control case | verified | rls-cross-tenant-matrix.test.ts 237-247 |
| 17 | RLS matrix gracefully skipped when TEST_OWNER_2 env not set | verified | describe.skipIf + describe.runIf pair |
| 18 | Render harness test mounts shell layout | verified | tests/shell-render.test.tsx (130 lines) |
| 19 | use-debounce installed (08-07 dep) | verified | package.json use-debounce 10.1.1 |
| 20 | ESLint flat config replaces legacy .eslintrc | verified | eslint.config.mjs exists |
| 21 | Fire-and-forget email sends use after() from next/server | verified | bookings route imports after; lines 234 364 |
| 22 | env example documents TEST_OWNER_2 + CRON_SECRET + NEXT_PUBLIC_APP_URL | verified | .env.example contains all four vars |

### Andrew has a real bookings dashboard

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 23 | bookings page lists with name+email/phone/event-type+duration/start+status badge | verified | bookings page + bookings-table 4 columns |
| 24 | Default view upcoming-only sorted by start_at ASC | verified | queries.ts 51 60-61 |
| 25 | URL searchParams status from to event_type q page | verified | page.tsx 17-24 + filters component router.replace |
| 26 | Status badge colored only - row text styling unchanged | verified | bookings-table.tsx 22-31 color classes only on Badge |
| 27 | Pagination 25 per page numbered | verified | page.tsx PAGE_SIZE 25 + bookings-pagination.tsx 140 lines |
| 28 | Each row links to bookings detail | verified | bookings-table.tsx Link href |
| 29 | Custom-question answers NOT shown in list (detail-only) | verified | bookings-table columns Booker Phone Event Start - no answers |
| 30 | Detail page shows full custom-question answers | verified | bookings detail page 227-241 |
| 31 | Detail page renders booking_events history timeline | verified | page.tsx 60-71 259-266 + booking-history.tsx 91 lines |
| 32 | If no created booking_event row page synthesizes from bookings.created_at | verified | BookingHistory receives bookingCreatedAt prop |
| 33 | Action bar has Cancel button + kebab placeholder | verified | page.tsx 128-163 CancelButton + DropdownMenu |
| 34 | Booker email rendered as mailto phone as tel | verified | page.tsx 200 213 |
| 35 | Owner-note autosaves 800ms after last keystroke flushes on blur | verified | owner-note.tsx 37-46 72-76 useDebouncedCallback 800 + save.flush |
| 36 | Owner-note autosave uses two-stage owner auth via current_owner_account_ids RPC | verified | owner-note-action.ts 180+ lines |
| 37 | Saved indicator appears briefly 2s after success | verified | owner-note.tsx 51-59 |
| 38 | Sidebar links to bookings + settings/reminders | verified | components/app-sidebar.tsx lines 30 35 |

### Settings and schema

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 39 | accounts.reminder_include columns boolean default true | verified | migration 30-33 |
| 40 | event_types.location text col nullable | verified | migration 43-44 |
| 41 | bookings.owner_note text col nullable | verified | migration 50-51 |
| 42 | Migration is idempotent ADD COLUMN IF NOT EXISTS additive only | verified | All ALTERs use IF NOT EXISTS |
| 43 | Reminder Settings page shows 3 Switch toggles | verified | settings/reminders/page.tsx + reminder-toggles-form.tsx |
| 44 | Toggle save uses two-stage owner auth | verified | actions.ts 64-105 saveReminderTogglesCore + current_owner_account_ids RPC |
| 45 | Event-type edit page has Location textarea bound to event_types.location | verified | location-field.tsx register location |
| 46 | shared lib/booking-tokens.ts exports generateRawToken + hashToken | verified | imported by cron route + bookings route |
| 47 | lib/email/send-reminder-booker.ts exports sendReminderBooker | verified | 9.5KB exports sendReminderBooker |

## Required Artifacts - Existence + Substantive + Wired

All 25+ artifacts named in the 8 plans pass all three levels. Spot-checked sizes range from 55 lines (migration) to 338 lines (reminder cron test), well above the 15-line substantive threshold. All exports are imported and used by their consumer files (verified via grep).

## Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| /api/cron/send-reminders | bookings table | UPDATE WHERE id AND reminder_sent_at IS NULL CAS | wired |
| /api/cron/send-reminders | sendReminderBooker | after sendReminderBooker | wired |
| /api/bookings POST | sendReminderBooker immediate-send | after sendReminderBooker when start lt 24h | wired |
| /api/bookings POST | rate_limit_events table | checkRateLimit bookings ip 20 5min | wired |
| Reminder toggles form | accounts.reminder_include columns | saveReminderTogglesAction service-role UPDATE | wired |
| Owner-note textarea | bookings.owner_note | useDebouncedCallback 800 saveOwnerNoteAction UPDATE | wired |
| BookingsFilters | URL state | useRouter replace | wired |
| BookingsTable rows | bookings detail | Next Link wrapping cells | wired |
| Sidebar | bookings + settings/reminders | href entries | wired |

## Requirements Coverage

| Req | Description | Status | Notes |
| --- | ----------- | ------ | ----- |
| EMAIL-05 | Reminder email pipeline | satisfied (code) | sendReminderBooker + cron route + immediate-send |
| EMAIL-08 | Email deliverability SPF DKIM DMARC + mail-tester 9 of 10 | phase 9 manual | Requires live deliverability test |
| INFRA-01 | Vercel Cron declared | satisfied (code) | vercel.json hourly schedule |
| INFRA-02 | CRON_SECRET-authenticated reminder route | satisfied (code) | 401 path verified |
| INFRA-03 | Immediate-send for in-window bookings | satisfied (code) | bookings route 280-395 |
| INFRA-04 | /api/bookings IP rate-limited | satisfied (code) | 20 per IP per 5min via lib/rate-limit.ts |
| INFRA-05 | Cross-tenant RLS matrix | satisfied (code) | Test exists; live run pending TEST_OWNER_2 env |
| DASH-02 | Bookings list with name email phone event start status | satisfied (code) | bookings-table.tsx |
| DASH-03 | Filterable by status + date range | satisfied (code) | bookings-filters.tsx + queries.ts |
| DASH-04 | Booking detail with answers + autosave note + history | satisfied (code) | id/page.tsx + owner-note.tsx + booking-history.tsx |

## Anti-Patterns Scan

No blocker anti-patterns found. Two intentional placeholders documented in CONTEXT.md:

- bookings detail page kebab placeholder (More actions coming soon). Intentional v1 stub.
- Custom-question answers omitted from list view per CONTEXT.md decision (detail-only).

## Test Suite

Test Files 16 passed (16) -- Tests 131 passed | 1 skipped (132)

The 1 skipped test is the RLS cross-tenant matrix when TEST_OWNER_2_EMAIL or TEST_OWNER_2_PASSWORD are not set. Manual prereq B in Plan 08-08 will allow this test to run live.

## Human Verification Checklist

The following items require Andrew account access or live observation. They are NOT gaps - they are deferred to Phase 9 manual QA per CLAUDE.md project rules.

### Cron-first-tick observation (NOT phase 9 - needed for Phase 8 sign-off)

1. Vercel Cron first hourly tick - Open Vercel dashboard Crons tab; wait for next top-of-hour. Confirm green check + 200 status. Inspect logs for ok=true scanned=N claimed=N shape.
2. Vercel tier confirmation - Settings Billing. If Hobby vercel.json hourly schedule will be downgraded to daily by Vercel; either upgrade to Pro OR configure cron-job.org as hourly external driver.
3. TEST_OWNER_2 env populated - Create second Supabase auth user via dashboard add to .env.local + Vercel env. Re-run npm test to confirm the 1 skipped test now passes.

### Phase 9 deferred (manual QA & verification phase)

4. End-to-end reminder email delivery (live booking, wait for cron, click cancel/reschedule links).
5. mail-tester score 9 of 10 or higher for both confirmation and reminder emails.
6. SPF DKIM DMARC verified in Namecheap DNS.
7. Dashboard list visual review (status badge colors, URL state, pagination).
8. Owner-note autosave UX (timing of debounce + flush on blur).

## Gaps Summary

No code gaps. All 47 must-haves across the 8 plans are verified in code; the test suite passes with the expected 1-skip behavior. Status routes to human_needed because the goal reminders fire reliably 24h before appointments cannot be fully attested without observing the first live cron tick in Vercel + running the deferred Phase 9 deliverability checks.

---

Verified: 2026-04-26
Verifier: Claude (gsd-verifier)
