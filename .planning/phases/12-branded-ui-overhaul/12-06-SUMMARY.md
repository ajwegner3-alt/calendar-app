---
phase: 12-branded-ui-overhaul
plan: "06"
subsystem: email
tags: [nodemailer, email, branding, html-email, plain-text, wcag, contrast, nsi-mark]

# Dependency graph
requires:
  - phase: 12-branded-ui-overhaul/12-01
    provides: "background_color + background_shade columns on accounts; Branding type with backgroundColor field"
  - phase: 05-public-booking-flow
    provides: "All 6 transactional email senders; EmailBranding interface; branding-blocks.ts primitives"
  - phase: 08-reminders-hardening
    provides: "stripHtml() plain-text pattern pioneered in send-reminder-booker.ts"
provides:
  - "renderEmailBrandedHeader(): solid-color header band on all 6 transactional emails; CONTEXT lock: no VML, no gradients"
  - "public/nsi-mark.png: placeholder PNG asset served at /nsi-mark.png; NSI_MARK_URL live"
  - "stripHtml() moved to branding-blocks.ts: shared by all booker-facing senders"
  - "Plain-text alternatives: booker confirmation + booker cancel + booker reschedule (EMAIL-10 extended)"
  - "EMAIL-12 6-row matrix: Vitest assertions on bgcolor= + footer + plain-text alt for all 6 senders"
affects:
  - "Phase 13 manual QA: live inbox verification of 6-row matrix; cross-client testing deferred to v1.2"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "renderEmailBrandedHeader(branding): solid-color bgcolor= table header; Outlook-safe pattern"
    - "EmailBranding.backgroundColor field: resolution chain backgroundColor → brand_primary → DEFAULT_BRAND_PRIMARY"
    - "stripHtml() shared from branding-blocks.ts (not private per-sender)"
    - "text: stripHtml(html) multipart plain-text alt on all booker-facing senders"
    - "NSI_MARK_URL: env-var-driven, null in test env (no broken-image 404)"

key-files:
  created:
    - public/nsi-mark.png
    - lib/email/branding-blocks.ts (renderEmailBrandedHeader added; stripHtml moved here)
    - tests/email-branded-header.test.ts
    - tests/email-6-row-matrix.test.ts
  modified:
    - lib/email/send-booking-confirmation.ts
    - lib/email/send-owner-notification.ts
    - lib/email/send-cancel-emails.ts
    - lib/email/send-reschedule-emails.ts
    - lib/email/send-reminder-booker.ts

key-decisions:
  - "Solid-color-only header band (CONTEXT.md lock): no VML conditional comments, no CSS gradients — Outlook desktop and Yahoo Mail render gradients as fallback color anyway; solid fill = consistent behavior"
  - "Identical header treatment across all 6 templates (consistency over status semantics — same band color/shape on confirm, cancel, reschedule)"
  - "backgroundColor resolution: branding.backgroundColor → branding.brand_primary → DEFAULT_BRAND_PRIMARY (#0A2540)"
  - "Plain-text alt extended beyond EMAIL-10 minimum: added to booker cancel + booker reschedule (research recommendation; minimal cost via shared stripHtml)"
  - "Owner-facing emails skip plain-text alt (CONTEXT discretion; can extend in v1.2 if needed)"
  - "NSI_MARK_URL falls back to null in test env (NEXT_PUBLIC_APP_URL unset) so existing tests don't fail on broken-image assertions"
  - "public/nsi-mark.png is a 32x32 solid-navy placeholder PNG — Andrew must swap with brand asset before Phase 13 QA"
  - "renderEmailLogoHeader() kept as deprecated export for one release cycle (test archive safety)"
  - "Live cross-client testing (Outlook desktop, Apple Mail iOS, Yahoo) deferred to Phase 13 QA / v1.2 per existing project pattern"

patterns-established:
  - "EmailBranding.backgroundColor: callers add background_color?: string | null to AccountRecord and pass backgroundColor: account.background_color ?? null in branding object"
  - "All 6 senders import renderEmailBrandedHeader + stripHtml from branding-blocks.ts"
  - "Booker-facing senders: text: stripHtml(html) in sendEmail() options"
  - "Owner-facing senders: no plain-text alt (CONTEXT discretion)"

# Metrics
duration: 30min
completed: 2026-04-29
---

# Phase 12 Plan 06: Email Restyle Summary

**All 6 transactional emails ship per-account solid-color header bands + NSI mark footer + plain-text alts on all 3 booker-facing templates; EMAIL-09, EMAIL-10, EMAIL-11, EMAIL-12 all closed at code level**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-29T07:39:00Z
- **Completed:** 2026-04-29T08:10:00Z
- **Tasks:** 3 / 3
- **Files created/modified:** 9

## Accomplishments

- `renderEmailBrandedHeader()` ships: solid-color-only header band (CONTEXT lock), bgcolor= for Outlook, auto-contrast text via WCAG pickTextColor, logo img or account-name fallback
- All 6 senders migrated: booking_confirmation, owner_notification, cancel_booker, cancel_owner, reschedule_booker, reschedule_owner, reminder_booker
- NSI mark PNG asset committed at `public/nsi-mark.png` (placeholder — Andrew to swap before Phase 13); `NSI_MARK_URL` flipped from null to `${NEXT_PUBLIC_APP_URL}/nsi-mark.png`
- Plain-text alternatives added to all 3 booker-facing senders (confirmation, cancel, reschedule); reminder had it already; EMAIL-10 extended per research recommendation
- `stripHtml()` moved from private helper in send-reminder-booker.ts to shared export in branding-blocks.ts
- 18 new Vitest tests (11 unit + 7 matrix); all passing; no regressions

## Task Commits

1. **Task 1: NSI mark asset + renderEmailBrandedHeader + EmailBranding extension** - `70c1702` (feat)
2. **Task 2: Migrate 4 senders** - `a8e8f26` (feat)
3. **Task 3: Migrate reschedule senders + 6-row matrix tests** - `4d2f935` (feat)

**Plan metadata:** (TBD after docs commit)

## Files Created/Modified

- `public/nsi-mark.png` - 32x32 solid-navy (#0A2540) placeholder PNG; served at /nsi-mark.png; Andrew to replace with brand asset before Phase 13 QA
- `lib/email/branding-blocks.ts` - Added `renderEmailBrandedHeader()`, `stripHtml()` (moved from reminder sender), `EmailBranding.backgroundColor` field, `NSI_MARK_URL` env-var-driven, deprecated `renderEmailLogoHeader()` kept
- `lib/email/send-booking-confirmation.ts` - Migrated to `renderEmailBrandedHeader`; added `background_color?` to AccountRecord; added `text: stripHtml(html)` (EMAIL-10)
- `lib/email/send-owner-notification.ts` - Migrated to `renderEmailBrandedHeader`; added `background_color?` to AccountRecord
- `lib/email/send-cancel-emails.ts` - Both senders migrated to `renderEmailBrandedHeader`; booker cancel gets `text: stripHtml(html)` (EMAIL-10 extended); owner cancel skips plain-text alt
- `lib/email/send-reschedule-emails.ts` - Both senders migrated to `renderEmailBrandedHeader`; booker reschedule gets `text: stripHtml(html)` (EMAIL-10 extended); owner reschedule skips plain-text alt
- `lib/email/send-reminder-booker.ts` - Migrated to `renderEmailBrandedHeader`; `stripHtml` now imported from branding-blocks; `background_color?` added to ReminderAccountRecord
- `tests/email-branded-header.test.ts` - 11 unit tests: dark/light bg contrast, logo/text fallback, entity escaping, stripHtml
- `tests/email-6-row-matrix.test.ts` - 7 matrix tests: all 6 senders + bonus reminder; asserts bgcolor= header + "Powered by" footer + plain-text alt on booker-facing senders

## Decisions Made

1. **Solid-color-only (CONTEXT lock):** `renderEmailBrandedHeader` uses a single solid `bgcolor=` fill. No VML conditional comments, no CSS gradients. Outlook desktop and Yahoo Mail render CSS gradients as fallback solid color anyway — locking to solid ensures consistent visual across all clients without the maintenance overhead of VML fallbacks.

2. **Identical treatment across all 6 templates:** Header band color/shape is the same on confirm, cancel, and reschedule emails. Per CONTEXT.md lock: consistency over status semantics.

3. **Background color resolution chain:** `branding.backgroundColor ?? branding.brand_primary ?? DEFAULT_BRAND_PRIMARY (#0A2540)`. Phase 13 QA accounts that haven't set `background_color` will get their `brand_primary` in the header band — visually correct.

4. **Plain-text alt extended to booker cancel + reschedule:** Research recommendation; minimal cost via shared `stripHtml` helper. Owner-facing emails skip plain-text alt per CONTEXT discretion (v1.2 can extend if needed).

5. **NSI_MARK_URL null in test env:** `NEXT_PUBLIC_APP_URL` is unset in Vitest — `NSI_MARK_URL` evaluates to null, so footer renders text-only. No broken-image test assertions. Existing 26 skipped DB tests unaffected.

6. **Placeholder PNG shipped:** `public/nsi-mark.png` is a programmatically-generated 32x32 solid #0A2540 square. Serves as correct wiring (URL resolves, no 404). Andrew must swap with the actual NSI logomark before Phase 13 QA.

7. **Live cross-client testing deferred:** Outlook desktop, Apple Mail iOS, Yahoo Mail rendering deferred to Phase 13 QA / v1.2 per existing project pattern and CONTEXT.md lock.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion used `You&#39;re booked.` — static string is not HTML-escaped**
- **Found during:** Task 3 (6-row matrix test authoring)
- **Issue:** `renderEmailBrandedHeader` and body HTML escape user-supplied strings only; the static literal `You're booked.` is not passed through `escapeHtml()` so it appears as `You're booked.` in the rendered HTML, not `You&#39;re booked.`
- **Fix:** Changed test assertion from `"You&#39;re booked."` to `"You're booked."` — semantically correct behavior
- **Files modified:** `tests/email-6-row-matrix.test.ts`
- **Committed in:** 4d2f935 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test assertion bug)
**Impact on plan:** Zero scope creep. Fix necessary for correct test behavior.

## 6-Row Visual Smoke Matrix (EMAIL-12)

| # | Template | Vitest pass | Plain-text alt | Live inbox (Gmail web) |
|---|----------|-------------|----------------|------------------------|
| 1 | booker_confirmation | PASS | YES | Deferred to Phase 13 QA |
| 2 | owner_notification | PASS | No (owner discretion) | Deferred to Phase 13 QA |
| 3 | booker_cancel | PASS | YES | Deferred to Phase 13 QA |
| 4 | owner_cancel | PASS | No (owner discretion) | Deferred to Phase 13 QA |
| 5 | booker_reschedule | PASS | YES | Deferred to Phase 13 QA |
| 6 | owner_reschedule | PASS | No (owner discretion) | Deferred to Phase 13 QA |

**For Phase 13 QA:** Live smoke test 3 accounts x 6 templates = 18 rows. Also verify:
- Gmail web: header band renders solid color (not blank)
- Logo or account-name text visible on header
- Footer "Powered by North Star Integrations" link present
- View-source on booker emails: `Content-Type: text/plain` part present
- Andrew to swap `public/nsi-mark.png` with brand asset first

**Cross-client testing scope note:** Outlook desktop, Apple Mail iOS, Yahoo Mail deferred to v1.2 per CONTEXT.md lock (EMAIL-08 / QA-01..06 backlog).

## Authentication Gates

None — plan executed fully automated.

## Issues Encountered

None — plan executed as written with one minor test assertion fix.

## Next Phase Readiness

- EMAIL-09, EMAIL-10, EMAIL-11, EMAIL-12 all closed at code level
- All 6 senders production-ready; callers only need to pass `background_color` from accounts row
- Live inbox verification deferred to Phase 13 QA (normal project pattern)
- NSI mark PNG needs Andrew's brand asset swap before Phase 13

---
*Phase: 12-branded-ui-overhaul*
*Completed: 2026-04-29*
