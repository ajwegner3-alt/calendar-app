---
phase: 07-widget-and-branding
plan: 07
subsystem: email
tags: [email, branding, html, inline-styles, gmail, outlook, wcag, typescript, supabase]

# Dependency graph
requires:
  - phase: 07-01
    provides: "lib/branding/contrast.ts — pickTextColor(hex) WCAG helper used by renderBrandedButton"
  - phase: 05-public-booking-flow-and-email
    provides: "Six email sender files in lib/email/ — modified in this plan"
  - phase: 06-cancel-and-reschedule-lifecycle
    provides: "lib/bookings/cancel.ts + reschedule.ts callers — widened in this plan"
provides:
  - "lib/email/branding-blocks.ts — renderEmailLogoHeader, renderEmailFooter, renderBrandedButton, brandedHeadingStyle, DEFAULT_BRAND_PRIMARY, EmailBranding interface"
  - "All 4 email senders updated with AccountRecord widened (logo_url + brand_primary)"
  - "Callers (route.ts + cancel.ts + reschedule.ts) widened to SELECT + pass branding columns"
affects:
  - "Phase 8 (any future email sender MUST import branding-blocks and follow the same pattern)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Email branding via branding-blocks.ts module — all senders import from single source"
    - "Inline-styled HTML in all email functions (Gmail/Outlook/Apple Mail lock from Phase 5)"
    - "NSI_MARK_URL=null guard: text-only footer in v1 to prevent 404'd img in transactional email"
    - "pickTextColor(hex) used for WCAG-correct auto-picked button text color"
    - "accounts!inner SELECT widened additively — no breaking change to join shape"

key-files:
  created:
    - lib/email/branding-blocks.ts
  modified:
    - lib/email/send-booking-confirmation.ts
    - lib/email/send-owner-notification.ts
    - lib/email/send-cancel-emails.ts
    - lib/email/send-reschedule-emails.ts
    - app/api/bookings/route.ts
    - lib/bookings/cancel.ts
    - lib/bookings/reschedule.ts

key-decisions:
  - "NSI_MARK_URL=null in v1: no nsi-mark.png asset yet; 404'd img in transactional email is a guaranteed broken-image in Gmail/Outlook. Text-only footer is safe v1 surface."
  - "escapeHtml duplicated inside branding-blocks.ts for module self-containment (no cross-module helper churn)"
  - "Logo URL used as-is from DB: Plan 07-04 already includes ?v= cache-bust; senders must NOT strip or re-encode"
  - "DEFAULT_BRAND_PRIMARY = '#0A2540' duplicated from lib/branding/read-branding.ts to avoid circular dependency"
  - "Account-name line preserved above NSI footer: owner identity stays visible alongside 'Powered by NSI'"
  - "renderBrandedButton: <a> styled as button (Outlook does not render <button> in HTML email)"

patterns-established:
  - "Pattern: all future email senders MUST import from lib/email/branding-blocks.ts — no inline branding HTML"
  - "Pattern: AccountRecord in each sender always includes logo_url + brand_primary as string | null"

# Metrics
duration: 11min
completed: 2026-04-26
---

# Phase 7 Plan 07: Apply Branding to Emails Summary

**Centralized email branding via `branding-blocks.ts` — logo headers, brand-colored H1s and CTA buttons, and 'Powered by NSI' footer applied to all 6 transactional email types across 4 sender files**

## Performance

- **Duration:** ~11 min (Tasks 1-3 complete; Task 4 checkpoint awaiting Andrew's manual verification)
- **Started:** 2026-04-26T14:47:29Z
- **Completed:** 2026-04-26T14:58:32Z (Tasks 1-3)
- **Tasks:** 3/4 auto tasks complete; 1 checkpoint pending manual verify
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- Built `lib/email/branding-blocks.ts` with 4 pure functions (`renderEmailLogoHeader`, `renderEmailFooter`, `renderBrandedButton`, `brandedHeadingStyle`) + `DEFAULT_BRAND_PRIMARY` + `EmailBranding` interface — all HTML inline-styled for Gmail/Outlook/Apple Mail
- Applied branding blocks to all 4 sender files (7 email functions total counting booker/owner branches): logo headers, brand H1s, brand CTAs where applicable, "Powered by NSI" text-only footer
- Widened AccountRecord interface in all 4 senders to include `logo_url` and `brand_primary`; widened 3 caller DB SELECTs and call sites to pass branding through
- 80/80 tests pass with no regressions (additive changes only)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/email/branding-blocks.ts** - `1f0c7eb` (feat)
2. **Task 2: Apply branding blocks to all 4 email sender files** - `242cfe6` (feat)
3. **Task 3: Update callers to SELECT branding columns and pass them through** - `73389a1` (feat)

**Plan metadata:** (docs commit — pending checkpoint resolution)

## Files Created/Modified

- `lib/email/branding-blocks.ts` — 4 functions + DEFAULT_BRAND_PRIMARY + EmailBranding interface; inline-styled; self-contained escapeHtml; NSI_MARK_URL=null guard
- `lib/email/send-booking-confirmation.ts` — AccountRecord widened; logo header + brand H1 + Reschedule/Cancel buttons + NSI footer
- `lib/email/send-owner-notification.ts` — AccountRecord widened; logo header + brand H1 + NSI footer
- `lib/email/send-cancel-emails.ts` — AccountRecord widened; booker branch: logo + H1 + 'Book again' button + footer; owner branch: logo + H1 + footer
- `lib/email/send-reschedule-emails.ts` — AccountRecord widened; booker branch: logo + H1 + Reschedule/Cancel buttons + footer; owner branch: logo + H1 + footer
- `app/api/bookings/route.ts` — accounts SELECT adds logo_url, brand_primary; both account objects in sendBookingEmails() pass them through
- `lib/bookings/cancel.ts` — accounts!inner SELECT adds logo_url, brand_primary; sendCancelEmails() account arg includes both fields
- `lib/bookings/reschedule.ts` — accounts!inner SELECT adds logo_url, brand_primary; sendRescheduleEmails() account arg includes both fields

## Public API Surface (for downstream plans)

```typescript
// lib/email/branding-blocks.ts  (server-only)
export const DEFAULT_BRAND_PRIMARY = "#0A2540";
export interface EmailBranding { name: string; logo_url: string | null; brand_primary: string | null; }
export function renderEmailLogoHeader(branding: EmailBranding): string;
export function renderEmailFooter(): string;
export function renderBrandedButton(opts: { href: string; label: string; primaryColor: string | null }): string;
export function brandedHeadingStyle(primaryColor: string | null): string;
```

**Forward contract for Phase 8+:** Any new email sender (e.g., reminders) MUST import from `lib/email/branding-blocks.ts` and include `logo_url` + `brand_primary` in its AccountRecord. Do NOT add inline branding HTML — use the shared functions.

## Decisions Made

- **NSI_MARK_URL=null in v1**: The `/public/nsi-mark.png` asset doesn't exist yet. A 404'd `<img>` in a transactional email is a guaranteed broken-image artifact in Gmail/Outlook/Apple Mail. Text-only "Powered by NSI" footer is the correct v1 surface. TODO comment documents the path to enabling the image mark once the asset is committed.
- **escapeHtml duplicated in branding-blocks.ts**: Self-contained module avoids cross-module helper dependencies. Each sender also keeps its own copy for body strings not going through branding-blocks.
- **Logo URL not modified**: Callers pass `account.logo_url` as-is from the DB. Plan 07-04 already appended `?v=<timestamp>` cache-bust. Senders must not strip or re-encode the URL.
- **DEFAULT_BRAND_PRIMARY duplicated**: branding-blocks.ts re-declares `"#0A2540"` rather than importing from `lib/branding/read-branding.ts` to avoid a circular dependency chain (branding-blocks → contrast → [email context]).
- **Account-name line preserved above NSI footer**: Owner identity visible alongside "Powered by NSI". Two lines is intentional — owner can be identified by recipients.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `tests/bookings-api.test.ts` and `tests/cancel-reschedule-api.test.ts` (mock alias errors for `__setTurnstileResult`, `__mockSendCalls`, `__resetMockSendCalls`) — existed before this plan, documented in 07-01-SUMMARY.md. The Vitest suite (which uses alias resolution, not `tsc`) passes 80/80 tests.

## Authentication Gates

None.

## User Setup Required

None — no external service configuration required. The `accounts` table already has `logo_url` and `brand_primary` columns from the Phase 1 schema.

**Task 4 (checkpoint:human-verify) requires Andrew to:**
1. Create a booking with a real email to test booker confirmation + owner notification
2. Cancel and reschedule to test the remaining 4 email types
3. Verify logo, brand color, CTA buttons, and "Powered by NSI" footer render correctly
4. Test null fallbacks (clear logo_url and brand_primary in Supabase to verify graceful fallback)

## Next Phase Readiness

- `lib/email/branding-blocks.ts` is the canonical source for email branding HTML — ready for Phase 8 email senders
- All 6 transactional email types are wired to branding; only human verification remains
- Plan 07-08 (account index route): no overlap — no blockers from 07-07

---
*Phase: 07-widget-and-branding*
*Completed: 2026-04-26 (Tasks 1-3; Task 4 pending manual QA)*
