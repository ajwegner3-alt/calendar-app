---
phase: 19-email-layer-simplification
plan: 01
subsystem: email
tags: [email, resend, branding, typescript, vitest, supabase-select]

# Dependency graph
requires:
  - phase: 18-branding-editor-simplification
    provides: "Collapsed Branding web type to {logo_url, brand_primary}; deprecated sidebar_color/background_color/chrome_tint_intensity from runtime reads on web side"
  - phase: 14-typography-css-tokens
    provides: "NSI brand token #3B82F6 (blue-500) locked as canonical primary color"
provides:
  - "EmailBranding interface collapsed to 3 fields: {name, logo_url, brand_primary}"
  - "renderEmailBrandedHeader color resolution simplified: brand_primary ?? #3B82F6 (was 3-tier sidebarColor priority chain)"
  - "Email-layer DEFAULT_BRAND_PRIMARY = #3B82F6 (intentional divergence from web-layer #0A2540)"
  - "renderEmailFooter: text-only 'Powered by North Star Integrations' linking to northstarintegrations.com (no nsi-mark.png img)"
  - "5 sender files updated; 4 caller files updated; all deprecated column reads removed from Supabase SELECTs"
  - "Plain-text MIME alternatives preserved on all 4 booker-facing senders (EMAIL-20)"
  - "Hardcoded #0A2540 inline link in send-owner-notification.ts replaced with brand_primary fallback"
affects:
  - 20-dead-code-test-cleanup
  - 21-schema-drop-migration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic email-layer collapse: interface hard-removed (no @deprecated shim) because tsc catches every downstream miss; single commit, single deploy"
    - "Email-layer vs web-layer DEFAULT_BRAND_PRIMARY intentional divergence: email uses NSI blue-500 (#3B82F6) as the visual identity default; web uses legacy null-data fallback (#0A2540). Do NOT unify."
    - "sendReminderBooker 5th caller pattern: (shell)/app/bookings/[id]/_lib/actions.ts is a manual-trigger path for the reminder sender; must be updated in sync with the cron path"

key-files:
  created: []
  modified:
    - lib/email/branding-blocks.ts
    - lib/email/send-booking-confirmation.ts
    - lib/email/send-cancel-emails.ts
    - lib/email/send-reschedule-emails.ts
    - lib/email/send-reminder-booker.ts
    - lib/email/send-owner-notification.ts
    - app/api/bookings/route.ts
    - app/api/cron/send-reminders/route.ts
    - lib/bookings/cancel.ts
    - lib/bookings/reschedule.ts
    - tests/email-branded-header.test.ts
    - tests/email-6-row-matrix.test.ts
    - app/(shell)/app/bookings/[id]/_lib/actions.ts

key-decisions:
  - "Email-layer DEFAULT_BRAND_PRIMARY = #3B82F6 (NSI blue-500); web-layer DEFAULT_BRAND_PRIMARY stays #0A2540. Intentional divergence per CONTEXT lock — do NOT unify."
  - "Atomic single-commit pattern (CP-02) landed without intermediate tsc-broken state — Phase 19 had no external consumers of EmailBranding, making a types-first wave unnecessary unlike Phase 18."
  - "5th sendReminderBooker caller in (shell)/app/bookings/[id]/_lib/actions.ts was not in the plan; found during pre-flight tsc gate; fixed inline (Rule 3 — blocking, required for tsc clean)."
  - "Footer URL corrected: nsintegrations.com (wrong domain in legacy code) → northstarintegrations.com (correct NSI domain). CONTEXT lock."

patterns-established:
  - "Pre-flight gate protocol: tsc → 8 grep gates → vitest all pass before commit; use this ordering in every future email-layer change"
  - "EmailBranding hard removal (no shim): appropriate when no external consumers exist outside the email layer itself"

# Metrics
duration: ~35min
completed: 2026-05-01
---

# Phase 19 Plan 01: Email Layer Simplification Summary

**EmailBranding collapsed to {name, logo_url, brand_primary}, header band now #3B82F6 (NSI blue-500), text-only Powered-by footer linking to northstarintegrations.com — all 13 files updated in one atomic commit; Andrew approved live on Vercel 2026-05-01.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-01
- **Completed:** 2026-05-01T (Task 15 approval)
- **Tasks:** 15 (Tasks 1-14 code + pre-flight + commit; Task 15 live smoke test)
- **Files modified:** 13 (12 planned + 1 deviation)

## Accomplishments

- `EmailBranding` interface hard-collapsed from 6 fields to 3 (`name`, `logo_url`, `brand_primary`); tsc catches every missed callsite — no `@deprecated` shim needed
- All 5 sender files and 4 caller files scrubbed of `sidebar_color`, `background_color`, `chrome_tint_intensity` — Supabase SELECTs no longer fetch dead columns at runtime
- Footer image (`nsi-mark.png`) replaced with text-only "Powered by North Star Integrations" anchor; footer domain corrected from `nsintegrations.com` to `northstarintegrations.com`
- Email-layer `DEFAULT_BRAND_PRIMARY` flipped from `#0A2540` to `#3B82F6` (NSI blue-500); web-layer default intentionally unchanged — divergence is the correct design
- vitest suite 266 passed (email-branded-header + email-6-row-matrix updated; reminder-email-content unchanged); Vercel build green; Andrew smoke-test approved

## Task Commits

All tasks shipped in one atomic commit per CP-02 (atomic-deploy lock):

1. **Tasks 1-14: All code + pre-flight + commit** - `0130415` (feat)
   - Task 1: branding-blocks.ts (interface, resolver, default, footer)
   - Task 2: send-booking-confirmation.ts
   - Task 3: send-cancel-emails.ts (2 branding sites)
   - Task 4: send-reschedule-emails.ts (2 branding sites)
   - Task 5: send-reminder-booker.ts
   - Task 6: send-owner-notification.ts (+ #0A2540 link color fix)
   - Task 7: app/api/bookings/route.ts (2 SELECTs + multiple object sites)
   - Task 8: app/api/cron/send-reminders/route.ts
   - Task 9: lib/bookings/cancel.ts
   - Task 10: lib/bookings/reschedule.ts
   - Task 11: tests/email-branded-header.test.ts
   - Task 12: tests/email-6-row-matrix.test.ts
   - Deviation fix: app/(shell)/app/bookings/[id]/_lib/actions.ts (5th caller)
   - Task 13: Pre-flight gates all passed
   - Task 14: Commit + push + Vercel deploy verified green
2. **Task 15: Andrew live Vercel smoke test** — APPROVED 2026-05-01 (no code commit; human verification only)

**Plan metadata:** pending — `docs(19-01): complete email-layer-collapse plan`

## Files Created/Modified

- `lib/email/branding-blocks.ts` — EmailBranding interface (3 fields), DEFAULT_BRAND_PRIMARY = #3B82F6, simplified color resolver, text-only footer with northstarintegrations.com
- `lib/email/send-booking-confirmation.ts` — 3-field AccountRecord, 3-field branding literal, stripHtml preserved
- `lib/email/send-cancel-emails.ts` — 3-field AccountRecord, BOTH branding literal sites updated (booker + owner), stripHtml preserved on booker side
- `lib/email/send-reschedule-emails.ts` — 3-field AccountRecord, BOTH branding literal sites updated (booker + owner), stripHtml preserved on booker side
- `lib/email/send-reminder-booker.ts` — 3-field ReminderAccountRecord branding subset, 3-field branding literal, stripHtml preserved
- `lib/email/send-owner-notification.ts` — 3-field AccountRecord, 3-field branding literal, hardcoded #0A2540 link replaced with brand_primary fallback
- `app/api/bookings/route.ts` — 2 Supabase SELECTs trimmed, multiple account-object construction sites trimmed
- `app/api/cron/send-reminders/route.ts` — ScanRow.accounts sub-shape, SELECT clause, sendReminderBooker call all trimmed
- `lib/bookings/cancel.ts` — Pre-fetch SELECT and sendCancelEmails account literal trimmed
- `lib/bookings/reschedule.ts` — Pre-fetch SELECT and sendRescheduleEmails account literal trimmed
- `tests/email-branded-header.test.ts` — baseBranding factory aligned to 3-field interface; sidebarColor-priority tests removed; #3B82F6 DEFAULT path asserted
- `tests/email-6-row-matrix.test.ts` — fixture stripped of deprecated fields; color assertions updated from #1A3A5C to #0A2540 (brand_primary sentinel)
- `app/(shell)/app/bookings/[id]/_lib/actions.ts` — **DEVIATION FIX** — 5th sendReminderBooker caller; deprecated fields removed (Rule 3 — blocking; required for tsc clean)

## Decisions Made

- **Email-layer vs web-layer DEFAULT divergence locked:** `DEFAULT_BRAND_PRIMARY = "#3B82F6"` in `lib/email/branding-blocks.ts` (NSI blue-500, what the NSI account's email band should show); `DEFAULT_BRAND_PRIMARY = "#0A2540"` in `lib/branding/read-branding.ts` (legacy null-data fallback for web surfaces). These serve different purposes and must NOT be unified. CONTEXT.md lock honored.
- **Atomic single-commit pattern (CP-02) worked cleanly:** Phase 19 had no external consumers of `EmailBranding` outside the email layer itself (confirmed by research), so no types-first wave was needed. All 13 files landed in one commit without any intermediate tsc-broken state — contrast with Phase 18's two-wave approach.
- **5th sendReminderBooker caller deviation:** `(shell)/app/bookings/[id]/_lib/actions.ts` was not listed in the plan's `files_modified` frontmatter (research missed it). Found during pre-flight tsc gate (Gate 1). Fixed inline in the same atomic commit — Rule 3 (blocking; required for tsc clean). No separate fix-up commit.
- **Footer URL corrected to northstarintegrations.com:** Legacy code had `nsintegrations.com` (short domain, wrong). CONTEXT.md specified the long-form domain. Corrected as part of Task 1.

## Pre-flight Gate Evidence

All 8 grep gates + tsc + vitest passed before commit (Task 13):

- **Gate 1 — tsc --noEmit:** Zero errors across all 13 modified files.
- **Gate 2 — Zero camelCase deprecated identifiers in email layer + callers:** `grep -rn "sidebarColor|backgroundColor|chromeTintIntensity"` across lib/email/, app/api/bookings/, app/api/cron/, lib/bookings/ → 0 matches.
- **Gate 3 — Zero snake_case deprecated columns in SELECT strings:** `grep -rn "sidebar_color|background_color|chrome_tint_intensity"` across same paths → 0 matches.
- **Gate 4 — Email-layer DEFAULT is #3B82F6:** `grep -n "DEFAULT_BRAND_PRIMARY" lib/email/branding-blocks.ts` → `export const DEFAULT_BRAND_PRIMARY = "#3B82F6"`.
- **Gate 5 — Web-layer DEFAULT unchanged at #0A2540:** `grep -n "DEFAULT_BRAND_PRIMARY" lib/branding/read-branding.ts` → `export const DEFAULT_BRAND_PRIMARY = "#0A2540"`. Intentional divergence confirmed.
- **Gate 6 — nsi-mark.png removed from email branding:** `grep -n "nsi-mark" lib/email/branding-blocks.ts` → 0 hits.
- **Gate 7 — Footer URL is northstarintegrations.com:** `grep -n "nsintegrations|northstarintegrations" lib/email/branding-blocks.ts` → only `northstarintegrations.com`; no bare `nsintegrations.com`.
- **Gate 8 — EMAIL-20 plain-text alternatives preserved:** `grep -n "stripHtml"` across 4 booker-facing senders → at least one hit per sender.
- **vitest run:** 266 tests passed. `email-branded-header.test.ts`, `email-6-row-matrix.test.ts`, `reminder-email-content.test.ts` all green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 5th sendReminderBooker caller in (shell)/app/bookings/[id]/_lib/actions.ts**

- **Found during:** Task 13 — pre-flight Gate 1 (tsc --noEmit)
- **Issue:** `app/(shell)/app/bookings/[id]/_lib/actions.ts` calls `sendReminderBooker` and constructs an account literal that included deprecated fields (`background_color`, `chrome_tint_intensity`, `sidebar_color`). This caller was not listed in the plan's `files_modified` frontmatter — research identified 4 callers (bookings route, send-reminders cron, cancel lib, reschedule lib) but missed this 5th manual-trigger path.
- **Fix:** Removed the 3 deprecated keys from the account object literal in that file; confirmed the `ReminderAccountRecord` interface type-checks clean.
- **Files modified:** `app/(shell)/app/bookings/[id]/_lib/actions.ts`
- **Verification:** `npx tsc --noEmit` returned zero errors after the fix.
- **Committed in:** `0130415` (same atomic commit — no separate fix-up commit per CP-02 lock)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Fix was required for tsc clean, which was a hard pre-flight gate. No scope creep — the change was strictly removal of deprecated fields, matching the pattern of Tasks 2-10. The atomic-commit lock was preserved: the fix landed in the same `0130415` commit.

## Issues Encountered

None beyond the deviation above. Pre-flight gates surfaced the 5th caller deterministically before commit, so no post-deploy fix-up was needed.

## User Setup Required

None — no external service configuration required.

## Andrew Smoke-Test Approval

**Signal:** `approved`
**Date:** 2026-05-01
**Verified on:** https://calendar-app-xi-smoky.vercel.app

Evidence confirmed by Andrew:
1. NSI confirmation email header band renders `#3B82F6` (NSI blue-500), not the legacy `#0A2540` navy.
2. Footer reads "Powered by North Star Integrations" as plain text (no broken image where nsi-mark.png used to render).
3. "North Star Integrations" is a clickable link opening `https://northstarintegrations.com`.
4. Plain-text MIME alternative confirmed present in raw email source (Content-Type: text/plain part).
5. No broken image icon anywhere in the email.

## Must-Haves Verification (6/6 truths confirmed)

1. **NSI confirmation email header band = #3B82F6** — Andrew confirmed visually on live Vercel deploy.
2. **Footer = text-only "Powered by North Star Integrations" + northstarintegrations.com link, no broken image** — Andrew confirmed; nsi-mark.png removed in Task 1.
3. **tsc --noEmit = zero errors** — Gate 1 passed; all 13 files type-check clean.
4. **vitest green (266 passing, email tests updated)** — Gate 10 passed; email-branded-header.test.ts and email-6-row-matrix.test.ts both updated and green.
5. **Vercel deploy succeeded; 5 senders + 4 callers compiled cleanly** — Task 14 confirmed deploy green before checkpoint.
6. **Booker-facing senders still emit plain-text alternative via stripHtml (EMAIL-20 preserved)** — Gate 8 confirmed; Andrew raw-source check confirmed MIME multipart.

## Next Phase Readiness

**Phase 20 (Dead Code + Test Cleanup)** can proceed immediately:
- `sidebar_color`, `background_color`, `chrome_tint_intensity` now have zero runtime read paths across both web (Phase 18) and email (Phase 19) layers
- The `@deprecated` shim fields on `lib/branding/types.ts` (`backgroundColor`, `backgroundShade`, `chromeTintIntensity`, `sidebarColor`) remain on the type for `chrome-tint.ts` and its test — Phase 20 (CLEAN-04..07) deletes those
- `tests/branding-gradient.test.ts` still imports the deleted `shadeToGradient` — Phase 20 deletes this test
- `shade-picker.tsx` still on disk — Phase 20 (CLEAN-07) deletes it
- No blockers. Phase 19 baseline is clean.

**Phase 21 (Schema DROP Migration)** dependency satisfied:
- Both read-path phases (18 web, 19 email) complete. Phase 21's two-step DROP deploy (code-stop-reading → 30 min wait → DROP SQL) is now unblocked from a code perspective.

---
*Phase: 19-email-layer-simplification*
*Completed: 2026-05-01*
