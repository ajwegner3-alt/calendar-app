---
phase: 19-email-layer-simplification
verified: 2026-05-01T00:00:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase 19: Email Layer Simplification Verification Report

**Phase Goal:** Collapse EmailBranding to {name, logo_url, brand_primary}, simplify header color resolution to brand_primary ?? DEFAULT, update all 6 senders and 4 route/cron callers atomically, replace nsi-mark.png footer with text-only Powered by North Star Integrations.

**Verified:** 2026-05-01
**Status:** passed
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | NSI confirmation email header band renders #3B82F6 (NSI blue-500), not #0A2540 | VERIFIED | DEFAULT_BRAND_PRIMARY = #3B82F6 at lib/email/branding-blocks.ts:4; resolver branding.brand_primary ?? DEFAULT_BRAND_PRIMARY at line 37; Andrew confirmed visually on live Vercel 2026-05-01 |
| 2 | Footer reads Powered by North Star Integrations as text linking to https://northstarintegrations.com - no broken nsi-mark.png image | VERIFIED | NSI_HOMEPAGE_URL = northstarintegrations.com at line 78; renderEmailFooter() returns text-only markup at lines 81-84; no nsi-mark or img in function body; Andrew confirmed no broken image live |
| 3 | tsc --noEmit passes with zero errors after EmailBranding collapses to 3 fields | VERIFIED | Pre-flight Gate 1 passed before commit 0130415; SUMMARY documents zero errors across all 13 modified files |
| 4 | vitest run completes green - email-branded-header.test.ts and email-6-row-matrix.test.ts updated to simplified interface | VERIFIED | 266 tests passed per SUMMARY Gate 10; both test files verified clean of deprecated fields; #3B82F6 DEFAULT asserted in test [#6] at line 83 of email-branded-header.test.ts |
| 5 | Vercel deploy succeeds; 5 email senders + 4 callers compile cleanly | VERIFIED | Commit 0130415 landed on main; SUMMARY confirms Vercel build green; Andrew approved live at https://calendar-app-xi-smoky.vercel.app |
| 6 | Booker-facing senders still emit plain-text via stripHtml(html) (EMAIL-20 preserved) | VERIFIED | stripHtml called in all 4 booker-facing senders: send-booking-confirmation.ts:155, send-cancel-emails.ts:172, send-reschedule-emails.ts:167, send-reminder-booker.ts:195 |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| lib/email/branding-blocks.ts | VERIFIED | 3-field EmailBranding interface at lines 7-11; DEFAULT_BRAND_PRIMARY = #3B82F6 at line 4; brand_primary ?? DEFAULT_BRAND_PRIMARY resolver at line 37; text-only footer with northstarintegrations.com at lines 78-84; 144 lines, substantive |
| lib/email/send-booking-confirmation.ts | VERIFIED | AccountRecord at lines 29-36: {name, timezone, owner_email, slug, logo_url, brand_primary} - no deprecated fields; branding literal brand_primary: account.brand_primary at line 84; text: stripHtml(html) at line 155 |
| lib/email/send-cancel-emails.ts | VERIFIED | AccountRecord at lines 33-40: 3 surviving branding fields only; brand_primary: account.brand_primary at lines 97 AND 200 (both construction sites confirmed); stripHtml at line 172 (booker side) |
| lib/email/send-reschedule-emails.ts | VERIFIED | AccountRecord 3-field branding subset; brand_primary: account.brand_primary at lines 101 AND 199 (both construction sites confirmed); stripHtml at line 167 |
| lib/email/send-reminder-booker.ts | VERIFIED | ReminderAccountRecord with brand_primary at line 68 - no deprecated fields; branding literal at line 109; stripHtml at line 195 |
| lib/email/send-owner-notification.ts | VERIFIED | AccountRecord at lines 25-31: 3-field branding subset; branding literal at line 75; inline link color at line 117 uses account.brand_primary ?? #3B82F6 - no hardcoded #0A2540 (grep exit 1 confirmed) |
| app/api/bookings/route.ts | VERIFIED | SELECT #1 at line 171: id,slug,name,timezone,owner_email,logo_url,brand_primary - no deprecated cols; accounts!inner(slug,name,logo_url,brand_primary,...) at line 391 (SELECT #2); account literals at lines 304-305 and 325-326 clean |
| app/api/cron/send-reminders/route.ts | VERIFIED | ScanRow.accounts sub-shape at lines 86-87: logo_url and brand_primary only; accounts!inner SELECT at lines 127-128; account literal at lines 251-252 clean |
| lib/bookings/cancel.ts | VERIFIED | SELECT at line 90: accounts!inner(name,slug,timezone,owner_email,logo_url,brand_primary) - no deprecated cols; account literal at lines 179-180 clean |
| lib/bookings/reschedule.ts | VERIFIED | SELECT at line 111: accounts!inner(name,slug,timezone,owner_email,logo_url,brand_primary) - no deprecated cols; account literal at lines 199-200 clean |
| tests/email-branded-header.test.ts | VERIFIED | baseBranding factory at lines 17-24: 3-field shape {name, logo_url, brand_primary: #0A2540}; no deprecated fields (grep exit 1); #3B82F6 DEFAULT asserted at line 83 (test [#6]) |
| tests/email-6-row-matrix.test.ts | VERIFIED | account fixture at lines 48-56: no deprecated fields (grep exit 1); background-color:#0A2540 asserted 7 times (lines 95,120,146,172,198,229,269); Powered by assertion at line 67 |
| app/(shell)/app/bookings/[id]/_lib/actions.ts (deviation) | VERIFIED | SELECT at line 144 includes only logo_url, brand_primary for branding fields; account literal at line 223: brand_primary: account.brand_primary; no deprecated fields |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| lib/email/branding-blocks.ts | renderEmailBrandedHeader color resolution | branding.brand_primary ?? DEFAULT_BRAND_PRIMARY | WIRED | Line 37: const bg = branding.brand_primary ?? DEFAULT_BRAND_PRIMARY; pattern confirmed |
| lib/email/branding-blocks.ts | renderEmailFooter text-only attribution | anchor to northstarintegrations.com | WIRED | NSI_HOMEPAGE_URL = northstarintegrations.com at line 78; used in anchor at line 83 |
| 5 sender files | EmailBranding consumer | branding literal with exactly 3 fields | WIRED | brand_primary: account.brand_primary found in all 5 senders: confirmation (1 site), cancel (2 sites), reschedule (2 sites), reminder-booker (1 site), owner-notification (1 site) - 7 total construction sites confirmed |
| 4 caller files | Supabase SELECT on accounts | SELECT contains only logo_url, brand_primary among branding columns | WIRED | All 4 callers confirmed: bookings route lines 171+391, cron route lines 127-128, cancel.ts line 90, reschedule.ts line 111 - zero deprecated column names (Gate 3 exit 1) |
| lib/email/send-owner-notification.ts line 117 | inline link color | no longer hardcodes #0A2540 - uses brand_primary fallback | WIRED | Line 117: style using account.brand_primary ?? #3B82F6 - grep for #0A2540 in this file returned exit 1 (zero hits) |

---

### ROADMAP Success Criteria Coverage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 1. Confirmation email branded header shows #3B82F6, not #0A2540 | SATISFIED | DEFAULT_BRAND_PRIMARY = #3B82F6 in branding-blocks.ts; NSI account brand_primary drives band color; Andrew confirmed live Gmail render |
| 2. Footer reads Powered by North Star Integrations as text - no broken nsi-mark.png image | SATISFIED | renderEmailFooter() returns text-only markup; no img tag; northstarintegrations.com URL confirmed |
| 3. tsc --noEmit passes | SATISFIED | Gate 1 passed before atomic commit; all 13 files type-check clean |
| 4. vitest passes (deprecated-field tests updated) | SATISFIED | 266 tests passed; sidebarColor-priority tests dropped; email-6-row-matrix.test.ts color assertions updated from #1A3A5C to #0A2540 |
| 5. Vercel deploy succeeds; 6 senders + 4 callers compile cleanly | SATISFIED | Commit 0130415 deployed; SUMMARY confirms green Vercel build; smoke test passed |

---

### Pre-flight Gates Re-verified

| Gate | Description | Result |
|------|-------------|--------|
| Gate 2 | Zero camelCase deprecated identifiers (sidebarColor, backgroundColor, chromeTintIntensity) in email layer + callers | PASS (grep exit 1 - zero matches) |
| Gate 3 | Zero snake_case deprecated columns (sidebar_color, background_color, chrome_tint_intensity) in caller SELECT strings + email layer | PASS (grep exit 1 - zero matches) |
| Gate 4 | Email-layer DEFAULT_BRAND_PRIMARY = #3B82F6 | PASS - confirmed lib/email/branding-blocks.ts:4 |
| Gate 5 | Web-layer DEFAULT_BRAND_PRIMARY = #0A2540 unchanged | PASS - confirmed lib/branding/read-branding.ts:11; intentional divergence preserved |
| Gate 6 | nsi-mark not referenced in functional code of branding-blocks.ts | PASS - doc comment only at line 74; no img or functional reference |
| Gate 7 | Footer URL is northstarintegrations.com, not bare nsintegrations.com | PASS - NSI_HOMEPAGE_URL at line 78 |
| Gate 8 | stripHtml present in all 4 booker-facing senders (EMAIL-20) | PASS - confirmed in send-booking-confirmation.ts:155, send-cancel-emails.ts:172, send-reschedule-emails.ts:167, send-reminder-booker.ts:195 |
| Gate 9 | #0A2540 removed from send-owner-notification.ts | PASS (grep exit 1 - zero matches) |

---

### Anti-Patterns Found

None. No TODO/FIXME blockers, no placeholder content, no stub implementations detected in any of the 13 modified files.

Note: nsi-mark.png appears once in a doc comment at branding-blocks.ts:74 explaining the Phase 19 change. This is documentation only, not functional code - not a blocker.

---

### Human Verification (completed by Andrew, 2026-05-01)

1. Header band color - NSI confirmation email rendered #3B82F6 (NSI blue-500), not the legacy #0A2540 navy, in Gmail web.
2. Footer text - Powered by North Star Integrations rendered as plain text with no broken image icon.
3. Footer link - clicking North Star Integrations opened https://northstarintegrations.com (not the old nsintegrations.com).
4. Plain-text MIME part - Gmail Show original confirmed both Content-Type: text/html and Content-Type: text/plain MIME parts present.
5. No broken image - no nsi-mark.png broken image icon anywhere in the email.

Signal: approved

---

### Scope Integrity

Files confirmed untouched (no Phase 19 changes):
- lib/email/send-booking-emails.ts - pure orchestrator; confirmed NOT in commit 0130415
- lib/branding/read-branding.ts - web-layer DEFAULT_BRAND_PRIMARY stays #0A2540; confirmed
- lib/branding/types.ts, lib/branding/chrome-tint.ts, tests/branding-chrome-tint.test.ts, tests/reminder-email-content.test.ts - Phase 20 territory; not modified

Deviation: app/(shell)/app/bookings/[id]/_lib/actions.ts was a 13th file not in the plan (5th sendReminderBooker caller missed by research). Fixed in same atomic commit 0130415 per CP-02 lock. Strictly removal of deprecated fields - no scope creep.

---

_Verified: 2026-05-01_
_Verifier: Claude (gsd-verifier)_
