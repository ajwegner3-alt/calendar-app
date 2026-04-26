---
phase: 05-public-booking-flow
verified: 2026-04-25T17:55:00Z
status: human_needed
score: 11/11 must-haves verified (all automated checks pass)
re_verification: false
human_verification:
  - test: "End-to-end booking flow visitor to confirmation"
    expected: "Navigate to /nsi/[event-slug] as unauthenticated visitor; pick date/time; fill Name/Email/Phone; complete Turnstile; submit; land on /nsi/[slug]/confirmed/[id] with event name, date/time in booker TZ, masked email, and confirmation copy"
    why_human: "Full client-side React + server round-trip not exercised by Vitest; TZ detection requires real browser; Turnstile Managed widget requires Cloudflare CDN"
  - test: "Booker receives confirmation email with .ics attachment"
    expected: "Email arrives at test booker inbox; subject Booking confirmed [event] on [date]; HTML body has event details in booker TZ, cancel/reschedule links; invite.ics opens in OS calendar"
    why_human: "Real Gmail SMTP send requires live GMAIL_USER + GMAIL_APP_PASSWORD env vars"
  - test: ".ics file structure correct for Gmail inline card (success criteria 4 manual QA gate)"
    expected: "Open booker confirmation email in Gmail web; see inline Add to Calendar card; event populates correctly in Google Calendar when accepted"
    why_human: "Gmail card behavior depends on live email client parsing METHOD:REQUEST; requires real email send"
  - test: "Owner notification email received with custom-question answers"
    expected: "Owner (ajwegner3@gmail.com) receives New booking email; body includes all custom-question answers; Reply-To is the booker email address"
    why_human: "Real email delivery to owner inbox; reply-to header behavior requires email client inspection"
  - test: "Race-loser 409 UX in browser"
    expected: "Two browsers submit identical slot simultaneously; one gets confirmation; other sees RaceLoserBanner with slot picker refreshed; form fields preserved; Turnstile reset"
    why_human: "True concurrent submission race requires two real browser sessions; banner visibility and form-value preservation are client-state behaviors"
  - test: "Turnstile Managed widget visible above submit button"
    expected: "Booking form shows a visible Cloudflare Turnstile widget above Book this time button; form submission blocked until Turnstile completes"
    why_human: "Turnstile widget is a third-party Cloudflare iframe; requires real browser and valid NEXT_PUBLIC_TURNSTILE_SITE_KEY"
  - test: "Slot times displayed in browser-detected local TZ not server TZ"
    expected: "Visitor in a TZ different from America/Chicago sees slot times in their own TZ; Times shown in [TZ] label reflects browser TZ"
    why_human: "Browser TZ detection runs on client only; requires actual browser"
  - test: "Gmail .ics deliverability mail-tester score target"
    expected: "mail-tester.com score >= 8/10 (QA-03 target for Phase 9); .ics VTIMEZONE block present; METHOD:REQUEST present; UID equals booking.id UUID"
    why_human: "Deliverability score requires live send to mail-tester.com"
  - test: "Confirmation page bookmarkable and refresh-safe after booking"
    expected: "After booking, reload /nsi/[slug]/confirmed/[booking-id] in a new private window; page renders without auth; booking details visible"
    why_human: "Requires a real booking ID in the live Supabase project"
  - test: "Cross-tenant confirmation URL guard"
    expected: "Accessing /wrong-account/[slug]/confirmed/[valid-booking-id] returns 404 not-found page not booking details"
    why_human: "Requires a real booking ID from the live DB"
---

# Phase 5: Public Booking Flow Verification Report

**Phase Goal:** A visitor can land on a hosted booking page, pick a slot, fill the form, and walk away with a confirmation email containing a working .ics invite. Andrew gets a notification email with the booker answers.
**Verified:** 2026-04-25T17:55:00Z
**Status:** human_needed -- all automated structural checks pass; 10 human-gated items (standard for a booking flow with real email + Turnstile)
**Re-verification:** No (initial verification)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visitor (no auth) reaches /[account]/[event-slug] and sees slots in browser TZ | VERIFIED | page.tsx Server Component with no auth gate; BookingShell useEffect detects Intl.DateTimeFormat TZ; SlotPicker renders times via TZDate(@date-fns/tz) |
| 2 | Visitor picks date+time and fills form (name/email/phone + custom questions) | VERIFIED | SlotPicker Calendar + slot list wired to BookingShell step state; BookingForm renders RHF fields for all 4 custom question types (short_text/long_text/select/radio) |
| 3 | Two simultaneous submissions for same slot yield one 201 and one 409 SLOT_TAKEN | VERIFIED | route.ts catches insertError.code 23505; test (f) exercises the real partial unique index end-to-end; 54/54 tests pass |
| 4 | Booker confirmation email with .ics attachment sent | VERIFIED (structurally) | send-booking-confirmation.ts calls sendEmail with invite.ics Buffer; contentType text/calendar; method=REQUEST; human gate for delivery |
| 5 | .ics structure correct for Gmail import | VERIFIED (structurally) | buildIcsBuffer() sets METHOD:REQUEST, VTIMEZONE from tzlib_get_ical_block, UID=booking.id, ORGANIZER+ATTENDEE; CRLF/folding handled by ical-generator |
| 6 | Owner notification email with custom-question answers and reply-to=booker | VERIFIED (structurally) | send-owner-notification.ts sends to account.owner_email with replyTo=booker_email; answers rendered as table rows |
| 7 | Booking form protected by Cloudflare Turnstile Managed mode | VERIFIED | BookingForm renders Turnstile with no size=invisible; ref-based getResponse() before submit; reset() on all error paths; server-side verifyTurnstile() before any DB write |
| 8 | Visitor lands on confirmation screen after successful booking | VERIFIED | POST returns 201 + {bookingId, redirectTo}; BookingForm calls router.push(redirectTo); confirmation page loads via createAdminClient() and verifies cross-tenant slug match |
| 9 | accounts.owner_email populated for nsi account | VERIFIED | migration 20260426120000_account_owner_email.sql adds column and seeds owner_email ajwegner3@gmail.com for slug nsi |
| 10 | Emails fire-and-forget; booking succeeds even if email fails | VERIFIED | route.ts uses void sendBookingEmails (no await); sendBookingEmails uses Promise.allSettled; per-email errors caught, never rethrown |
| 11 | Raw cancel/reschedule tokens NOT in HTTP response body | VERIFIED | 201 response returns only {bookingId, redirectTo}; test (h) asserts cancelToken/rescheduleToken absent |

**Score:** 11/11 truths structurally verified (3 truths have human-gated delivery/UX components requiring Phase 9 QA)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| supabase/migrations/20260426120000_account_owner_email.sql | Adds owner_email + seeds nsi | VERIFIED | 21 lines; ADD COLUMN IF NOT EXISTS; UPDATE seeds ajwegner3@gmail.com |
| lib/email-sender/index.ts | sendEmail() Gmail-only entry point | VERIFIED | 76 lines; imports server-only; v2-forward-architecture comment in header; exports sendEmail |
| lib/email-sender/types.ts | EmailOptions + EmailAttachment + EmailResult | VERIFIED | 71 lines; type is EmailOptions (renamed from EmailInput during Gmail pivot; functionally identical) |
| lib/email-sender/providers/gmail.ts | Gmail nodemailer SMTP provider (ONLY file in providers/) | VERIFIED | 60 lines; createGmailClient() with nodemailer; no resend.ts present |
| lib/bookings/schema.ts | Zod bookingInputSchema with turnstileToken | VERIFIED | 47 lines; phone format-loose regex + 7-digit min; turnstileToken z.string().min(1) |
| lib/turnstile.ts | verifyTurnstile(token, ip?) | VERIFIED | 68 lines; throws if TURNSTILE_SECRET_KEY missing; fails closed on network error |
| lib/email/build-ics.ts | buildIcsBuffer() with METHOD:REQUEST + VTIMEZONE + stable UID | VERIFIED | 82 lines; ICalCalendarMethod.REQUEST; tzlib_get_ical_block; uid=booking.id |
| lib/email/send-booking-confirmation.ts | Booker email with .ics attachment | VERIFIED | 158 lines; subject Booking confirmed [event] on [date]; cancel/reschedule URLs; no explicit from field |
| lib/email/send-owner-notification.ts | Owner email with answers + reply-to | VERIFIED | 143 lines; replyTo: booker_email; answers HTML table; null owner_email skip |
| lib/email/send-booking-emails.ts | Fire-and-forget orchestrator | VERIFIED | 52 lines; Promise.allSettled; per-email .catch(console.error); never throws |
| app/[account]/[event-slug]/page.tsx | Server Component + BookingShell | VERIFIED | 60 lines; real BookingShell imported (PLAN-05-06 placeholder replaced); generateMetadata |
| app/[account]/[event-slug]/_lib/types.ts | BookingPageData, AccountSummary, EventTypeSummary | VERIFIED | 32 lines; owner_email: string or null in AccountSummary |
| app/[account]/[event-slug]/_lib/load-event-type.ts | Loader with reserved-slug guard | VERIFIED | 68 lines; RESERVED_SLUGS set includes app/api/_next/auth; maybeSingle() |
| app/[account]/[event-slug]/not-found.tsx | Friendly 404, no slug leakage | VERIFIED | 11 lines; Page not found copy; no slug in message |
| app/[account]/[event-slug]/_components/booking-shell.tsx | use client; TZ detection; step state | VERIFIED | 85 lines; useEffect TZ detection with account.timezone SSR fallback; handleRaceLoss wired |
| app/[account]/[event-slug]/_components/slot-picker.tsx | Calendar + slot list; /api/slots fetch | VERIFIED | 184 lines; Calendar with modifiersClassNames hasSlots dots; TZDate formatting |
| app/[account]/[event-slug]/_components/booking-form.tsx | RHF + Managed Turnstile + 4 question types | VERIFIED | 361 lines; no size=invisible; reset() on all error paths; all 4 custom question types rendered |
| app/[account]/[event-slug]/_components/race-loser-banner.tsx | Inline 409 banner with locked copy | VERIFIED | 17 lines; exact copy That time was just booked. Pick a new time below. |
| app/api/bookings/route.ts | POST handler with 23505 then 409 path | VERIFIED | 254 lines; 23505 returns 409 + SLOT_TAKEN; void sendBookingEmails; Cache-Control no-store all paths |
| lib/bookings/tokens.ts | Web Crypto SHA-256 (Edge-safe, not Node createHash) | VERIFIED | 53 lines; crypto.subtle.digest; no Node-only createHash |
| app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx | Confirmation Server Component | VERIFIED | 207 lines; robots noindex; TZDate booker TZ; cancelled status fallback renders gracefully |
| app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts | Cross-tenant loader | VERIFIED | 118 lines; UUID fast-reject; parallel account+eventType fetch; slug cross-check; is_active filter |
| tests/bookings-api.test.ts | 9 Vitest cases (all 8 required + 1 extra) | VERIFIED | 356 lines; real DB; mocked Turnstile and email-sender |
| tests/__mocks__/turnstile.ts | Controllable Turnstile mock | VERIFIED | 27 lines; exports verifyTurnstile + __setTurnstileResult |
| tests/__mocks__/email-sender.ts | sendEmail spy | VERIFIED | 49 lines; exports sendEmail + __mockSendCalls + __resetMockSendCalls |
| vitest.config.ts | resolve.alias for 2 mocks (path.resolve, Windows-safe) | VERIFIED | path.resolve aliases for @/lib/turnstile and @/lib/email-sender |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| lib/email-sender/index.ts | providers/gmail.ts | createGmailClient import | WIRED |
| lib/email/send-booking-confirmation.ts | lib/email-sender | import sendEmail from @/lib/email-sender | WIRED |
| lib/email/send-owner-notification.ts | lib/email-sender | import sendEmail from @/lib/email-sender | WIRED |
| lib/email/build-ics.ts | ical-generator + timezones-ical-library | ICalCalendarMethod.REQUEST + tzlib_get_ical_block | WIRED |
| lib/email/send-booking-confirmation.ts | lib/email/build-ics.ts | buildIcsBuffer({uid: booking.id, ...}) | WIRED |
| app/api/bookings/route.ts | lib/bookings/schema.ts | bookingInputSchema.safeParse(body) line 82 | WIRED |
| app/api/bookings/route.ts | lib/turnstile.ts | verifyTurnstile(token, ip) BEFORE DB hit line 102 | WIRED |
| app/api/bookings/route.ts | lib/email/send-booking-emails.ts | void sendBookingEmails({...}) line 200 | WIRED |
| app/api/bookings/route.ts | bookings_no_double_book DB index | insertError.code 23505 then 409 line 177 | WIRED |
| app/api/bookings/route.ts | lib/bookings/tokens.ts | generateBookingTokens() line 147 | WIRED |
| app/[account]/[event-slug]/page.tsx | _lib/load-event-type.ts | loadEventTypeForBookingPage(account, eventSlug) | WIRED |
| app/[account]/[event-slug]/page.tsx | _components/booking-shell.tsx | BookingShell account={...} eventType={...} line 57 | WIRED |
| _components/slot-picker.tsx | /api/slots | fetch /api/slots and reads .slots array | WIRED |
| _components/booking-form.tsx | /api/bookings | fetch POST /api/bookings line 91 | WIRED |
| _components/booking-form.tsx | @marsidev/react-turnstile | Turnstile ref={turnstileRef} no size=invisible | WIRED |
| _components/booking-shell.tsx | Intl.DateTimeFormat | useEffect TZ detection with account.timezone fallback | WIRED |
| confirmed/[booking-id]/page.tsx | _lib/load-confirmed-booking.ts | loadConfirmedBooking({accountSlug, eventSlug, bookingId}) | WIRED |
| _lib/load-confirmed-booking.ts | lib/supabase/admin.ts | createAdminClient() service-role | WIRED |
| _lib/load-confirmed-booking.ts | cross-tenant guard | accountRes.data.slug !== args.accountSlug then null | WIRED |
| tests/bookings-api.test.ts | app/api/bookings/route.ts | import { POST } from @/app/api/bookings/route | WIRED |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| BOOK-01: Public /[account]/[event-slug] no-auth route | SATISFIED | Middleware only gates /app |
| BOOK-02: Browser TZ detection + Times shown label | SATISFIED | BookingShell useEffect + SlotPicker label |
| BOOK-03: Calendar + slot picker | SATISFIED | SlotPicker Calendar + slot list + accent dots |
| BOOK-04: Booking form name/email/phone + custom questions | SATISFIED | BookingForm RHF; all 4 question types |
| BOOK-05: Race-safe 409 SLOT_TAKEN with retry UX | SATISFIED | 23505 then 409; RaceLoserBanner; refetchKey bump; test (f) passes |
| BOOK-06: Confirmation screen after successful booking | SATISFIED | /confirmed/[booking-id] Server Component; cross-tenant guard; noindex |
| BOOK-07: Turnstile Managed-mode bot protection | SATISFIED | Managed widget; server-side verifyTurnstile before DB write; 403 on failure |
| EMAIL-01: Booker confirmation email | SATISFIED (structurally) | sendBookingConfirmation wired; human gate for delivery |
| EMAIL-02: .ics attachment METHOD:REQUEST | SATISFIED (structurally) | buildIcsBuffer sets REQUEST; contentType text/calendar; method=REQUEST |
| EMAIL-03: Owner notification with custom-question answers | SATISFIED (structurally) | sendOwnerNotification renders answers; replyTo=booker |
| EMAIL-04: Fire-and-forget (booking never blocked by email) | SATISFIED | void sendBookingEmails; Promise.allSettled; per-email catch |

---

### Locked Invariants from Earlier Phases -- All Preserved

| Invariant | Status |
|-----------|--------|
| /api/slots response shape {slots: Array<{start_at, end_at}>} | PRESERVED -- SlotPicker reads .slots array with Slot interface matching {start_at, end_at} |
| Service-role only for public reads | PRESERVED -- all public routes use createAdminClient() |
| lib/supabase/admin.ts has import server-only line 1 | PRESERVED -- confirmed |
| Sonner Toaster mounted ONLY at root layout | PRESERVED -- only in app/layout.tsx line 28 |
| TooltipProvider wrapper in shell layout intact | PRESERVED -- app/(shell)/layout.tsx lines 36/47 |

---

### Critical Revised Decisions -- All Correct

| Decision | Required | Actual |
|----------|---------|--------|
| Turnstile Managed mode (not invisible) | No size=invisible in BookingForm | Absent; comment on line 211 explicitly calls it out |
| Gmail provider only (not Resend) | providers/ has gmail.ts only | Confirmed; no resend.ts present |
| nodemailer in package.json (not resend) | nodemailer present; resend absent | nodemailer ^8.0.6; grep resend in package.json = 0 matches |
| v2-forward-architecture comment in index.ts | gmail-oauth roadmap documented in header | Lines 9-14 document per-account gmail-oauth v2 path |

---

### Anti-Patterns Found

No blockers. Three informational items only:

| Item | Severity | Impact |
|------|---------|--------|
| .env.example has RESEND_API_KEY and RESEND_FROM_EMAIL (vestigial from pre-pivot) | Info | Documented as alternative provider not used in v1 with clear comment. Intentional future option. |
| EMAIL_PROVIDER env var in .env.example but not read by code (implementation hard-wires Gmail) | Info | Hard-codes Gmail for v1 simplicity; .env.example documents it for future provider dispatch. Harmless. |
| generateMetadata in confirmed/[booking-id]/page.tsx calls loadConfirmedBooking separately from default export (two DB round-trips) | Info | Acknowledged in code comments: acceptable v1; Phase 8 can wrap in React cache() if latency matters. |

---

### Test Results

```
Test Files  6 passed (6)
      Tests  54 passed (54)
   Duration  4.55s
```

Bookings API test coverage -- all 8 Plan 05-08 required cases pass:
- (a) 201 happy path + bookingId + redirectTo + email spy -- PASS
- (b) 400 BAD_REQUEST malformed JSON -- PASS
- (c) 400 VALIDATION missing bookerEmail -- PASS
- (c) 400 VALIDATION phone fewer than 7 digits -- PASS
- (c) 400 VALIDATION non-UUID eventTypeId -- PASS
- (d) 403 TURNSTILE mock returns false -- PASS
- (e) 404 NOT_FOUND unknown UUID -- PASS
- (f) 409 SLOT_TAKEN second insert same slot (real DB partial unique index) -- PASS
- (g) Cache-Control: no-store confirmed on 201 -- PASS (also covered on 400/403/409)
- (h) Raw tokens NOT in 201 response body -- PASS

Build: npm run build exits 0. Routes appear in build output as dynamic:
- /[account]/[event-slug]
- /[account]/[event-slug]/confirmed/[booking-id]
- /api/bookings

---

### Human Verification Required (Phase 9 QA Gate)

Ten items require human testing. All automated infrastructure is verified and in place.

**1. End-to-end booking flow**
Test: Navigate to /nsi/[event-slug] as unauthenticated visitor; pick a date and time; fill the form; submit.
Expected: Land on /nsi/[slug]/confirmed/[id] with correct event name, date/time in local TZ, and Confirmation sent to [masked-email] with calendar invite.
Why human: Full client-side TZ detection + Turnstile + server round-trip.

**2. Booker confirmation email with .ics attachment**
Test: Complete a test booking; check the booker email inbox.
Expected: Email with subject Booking confirmed: [event] on [date]; HTML body with event details in booker TZ; invite.ics opens in OS calendar.
Why human: Real Gmail SMTP delivery requires live env vars.

**3. .ics Gmail inline calendar card (success criteria 4 -- manual QA gate)**
Test: Open booker confirmation email in Gmail web.
Expected: Gmail displays an inline Add to Calendar card (not a plain attachment download); clicking it adds the event to Google Calendar correctly.
Why human: Gmail card behavior depends on live email client parsing METHOD:REQUEST.

**4. Owner notification email**
Test: Check ajwegner3@gmail.com after a test booking.
Expected: Email New booking: [name] -- [event] on [date]; custom-question answers in body; hitting Reply populates booker email as To:
Why human: Real email delivery + reply-to header inspection.

**5. Race-loser 409 UX in browser**
Test: Two browser windows open to same event; submit same slot from both within ~1 second.
Expected: One gets confirmation; the other sees RaceLoserBanner with slot list refreshed; form fields preserved; Turnstile widget resets.
Why human: Concurrent submission race requires two real browser sessions.

**6. Turnstile Managed widget visible**
Test: Load booking form at /nsi/[slug].
Expected: Visible Cloudflare Turnstile widget (checkbox or spinner) appears above Book this time button; form submission is blocked until it completes.
Why human: Cloudflare iframe requires real browser and valid NEXT_PUBLIC_TURNSTILE_SITE_KEY.

**7. Slot times in browser-local TZ**
Test: Open booking page from a browser/OS set to a TZ other than America/Chicago.
Expected: Slot times displayed in your local TZ; Times shown in [your TZ] label correct.
Why human: Browser TZ detection runs on client only.

**8. Gmail .ics deliverability -- mail-tester score**
Test: Send a real booking confirmation to mail-tester.com test address.
Expected: Score >= 8/10 (Phase 9 QA-03 target).
Why human: Deliverability score requires live send to external scoring service.

**9. Confirmation page bookmarkable after booking**
Test: After a real booking, copy the /confirmed/[booking-id] URL; open in a new private window (no session).
Expected: Confirmation page renders without auth; booking details visible.
Why human: Requires a real booking ID in live Supabase.

**10. Cross-tenant confirmation URL guard**
Test: Take a valid /confirmed/[booking-id] URL; replace the account slug with a different value.
Expected: 404 not-found page; booking details NOT shown.
Why human: Requires a real booking ID from live DB.

---

*Verified: 2026-04-25T17:55:00Z*
*Verifier: Claude (gsd-verifier)*
