---
phase: 05-public-booking-flow
plan: 02
subsystem: infra
tags: [email, gmail, nodemailer, ical, turnstile, vendor, server-only, v2-architecture]

# Dependency graph
requires:
  - phase: 05-01
    provides: accounts.owner_email seeded (used as Gmail sender identity in v1)
provides:
  - lib/email-sender vendored module (Gmail-only in v1; sendEmail, createEmailClient, types, utils)
  - ical-generator + timezones-ical-library npm deps (for .ics attachment in 05-03+)
  - @marsidev/react-turnstile npm dep (for Managed Turnstile widget in 05-06)
  - nodemailer + @types/nodemailer (Gmail provider peer deps)
  - .env.example documents Gmail + Turnstile + Resend (commented-future) env vars
  - .env.local locally populated with Turnstile site/secret + Gmail App Password
  - Vercel Production + Preview environment variables populated (Andrew, manual)
affects: [05-03, 05-04, 05-05, 05-06, 06-01, 08-01]

# Tech tracking
tech-stack:
  added:
    - nodemailer ^7.0.10 (Gmail SMTP transport via App Password)
    - "@types/nodemailer ^7.0.4 (dev)"
    - ical-generator ^10.2.0 (calendar .ics attachment generation)
    - timezones-ical-library ^2.1.3 (timezone-aware ical support)
    - "@marsidev/react-turnstile ^1.5.0 (Cloudflare Turnstile React component)"
  removed:
    - resend (initially installed; removed during Gmail pivot)
  patterns:
    - "Vendor pattern: copy sibling lib into lib/<name>/ rather than npm install ../path (Vercel incompatible)"
    - "server-only guard on lib/email-sender/index.ts (mirrors lib/supabase/admin.ts)"
    - "Provider-agnostic email-sender abstraction: factory accepts per-call config; v2 onboarding extends with gmail-oauth without rewrite"

key-files:
  created:
    - lib/email-sender/index.ts (Gmail dispatch, env-based singleton)
    - lib/email-sender/types.ts (EmailProvider narrowed to "gmail")
    - lib/email-sender/providers/gmail.ts (nodemailer SMTP transport)
    - lib/email-sender/utils.ts (escapeHtml, stripHtml — peer dep of provider)
  modified:
    - package.json (4 deps added; resend uninstalled)
    - package-lock.json
    - .env.example (Gmail vars documented; Resend kept commented as future option)
    - .env.local (Andrew populated 4 values: Turnstile site/secret, Gmail App Password, Gmail user/from-name)

key-decisions:
  - "Pivot from Resend to Gmail App Password for v1 — Andrew's choice 2026-04-25 mid-Plan-05-02. Reason: existing email-sender tool already supports Gmail; avoids Resend signup + domain verification for v1; Andrew's personal Gmail is the natural sender identity for single-tenant."
  - "Pivot from Invisible Turnstile to Managed mode — Andrew's choice. Reason: trade-customer audience benefits from visible 'Verifying you are human' cue; fewer false rejections from over-eager submission."
  - "v2 forward-architecture: gmail-oauth provider variant — accounts.gmail_refresh_token + .gmail_oauth_email columns added in v2 migration; lib/email-sender/providers/gmail-oauth.ts uses Gmail API + OAuth refresh token (not App Password). createEmailClient factory already accepts per-call config — abstraction is forward-compatible without rewrite."
  - "v1 constraint locked: accounts.owner_email MUST equal GMAIL_USER env. nodemailer SMTP `from` is bound to authenticated address; mismatch breaks delivery. Both = ajwegner3@gmail.com for nsi."
  - "Resend provider removed entirely (not just gmail removed) — keeps the vendored copy minimal. Re-vendor from sibling if Phase 8 hardening swaps to Resend for QA-03 deliverability."

patterns-established:
  - "Vendor pattern: lib/<tool>/ copies sibling src files + adds import 'server-only' + ships only the providers needed for current scope"
  - "Email singleton bootstrapped from env: lib/email-sender/index.ts.getDefaultClient() reads GMAIL_* env vars at first send-call. v2 will replace with per-account credential lookup."
  - "Turnstile Managed mode = visible widget; rendered above submit button with explanatory label (Plan 05-06)"

# Metrics
duration: ~30min (incl. Gmail/Turnstile pivot)
completed: 2026-04-25
---

# Phase 5 Plan 02: Vendor Email Sender + Deps Summary

**Vendored @nsi/email-sender into lib/email-sender/ as Gmail-only module (nodemailer SMTP via App Password). Installed ical-generator, timezones-ical-library, @marsidev/react-turnstile, nodemailer. Andrew populated all env vars locally and on Vercel.**

## Performance

- **Duration:** ~30 min (includes mid-plan pivot from Resend → Gmail and Invisible → Managed Turnstile)
- **Started:** 2026-04-25T21:14:55Z
- **Completed:** 2026-04-25 (Andrew confirmed env vars set)
- **Tasks:** 2/2 complete
- **Commits:** 3 (`6efa13f` initial vendor, `5eec647` Gmail/Managed pivot, plan-doc commit)

## Accomplishments

- Vendored @nsi/email-sender from sibling into `lib/email-sender/` with `server-only` gate on entry point
- Pivoted Resend-only → Gmail-only after Andrew chose Gmail App Password path
- Restored `lib/email-sender/providers/gmail.ts` from sibling source
- Removed `lib/email-sender/providers/resend.ts` (re-vendor if Phase 8 needs it)
- Narrowed `EmailProvider` type to `"gmail"`; updated `index.ts` factory + singleton
- Installed runtime deps: `nodemailer@^7.0.10`, `ical-generator@^10.2.0`, `timezones-ical-library@^2.1.3`, `@marsidev/react-turnstile@^1.5.0`
- Installed dev dep: `@types/nodemailer@^7.0.4`
- Uninstalled `resend` (was installed in initial vendor before pivot)
- Updated `.env.example` with Gmail block + Turnstile (Managed mode) block + Resend (commented future-option) block
- Populated `.env.local` with NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, GMAIL_FROM_NAME, EMAIL_PROVIDER
- Andrew populated Vercel Production + Preview env with the same set
- Adjusted Plan 05-03 (email senders MUST NOT pass explicit `from` — singleton handles it) and Plan 05-06 (Turnstile rendered visibly with explanatory label)
- `npm run build` exits 0; `npm run lint` failure is pre-existing Node v24 / ESLint 9 tooling conflict

## Task Commits

1. **Task 1: Vendor @nsi/email-sender + install deps** — `6efa13f` (feat)
2. **Pivot: Gmail provider + Managed Turnstile** — `5eec647` (feat)
3. **Task 2: Andrew sets Turnstile + Gmail env vars (local + Vercel)** — completed (no code commit; .env.local is gitignored)

## Files Created/Modified

- `lib/email-sender/index.ts` — Gmail-only dispatch with `server-only` guard; v2 architecture documented in header
- `lib/email-sender/types.ts` — EmailProvider narrowed to "gmail"; Resend-specific fields removed
- `lib/email-sender/providers/gmail.ts` — nodemailer SMTP transport (copied from sibling)
- `lib/email-sender/utils.ts` — escapeHtml + stripHtml utilities (used by gmail provider)
- `package.json` — 4 runtime deps + 1 dev dep added; `resend` uninstalled
- `package-lock.json` — lockfile updated
- `.env.example` — Gmail block + Managed Turnstile block + Resend (commented future) block
- `.env.local` — Andrew populated 4 secret values (gitignored, never committed)
- `.planning/phases/05-public-booking-flow/05-CONTEXT.md` — decisions #4 (Managed Turnstile), #11 (Gmail + v2 forward architecture), #12 (owner_email = GMAIL_USER constraint)
- `.planning/phases/05-public-booking-flow/05-PLAN-03-*.md` — locked email modules to use singleton's auto-from
- `.planning/phases/05-public-booking-flow/05-PLAN-06-*.md` — Turnstile visible + Managed mode

## Sibling Files Copied

| Source (`../email-sender/src/`) | Destination (`lib/email-sender/`) | Modification |
|---|---|---|
| `index.ts` | `index.ts` | Rewritten: `server-only` line 1; Gmail-only dispatch; env-based singleton; v2 architecture comment |
| `types.ts` | `types.ts` | Verbatim copy + vendor header; EmailProvider narrowed to "gmail" |
| `providers/gmail.ts` | `providers/gmail.ts` | Verbatim copy + vendor header |
| `utils.ts` | `utils.ts` | Verbatim copy + vendor header |

**NOT copied:** `providers/resend.ts` (removed during pivot), `templates/` (Phase 5 builds its own HTML inline)

## Decisions Made (Architectural)

### Gmail provider for v1, Resend deferred
- **What:** Phase 5 ships Gmail (nodemailer SMTP via App Password) instead of Resend.
- **Why:** Andrew's existing email-sender tool already shipped a Gmail provider; faster path to first email; no domain verification or signup. v1 single-tenant means Andrew's personal Gmail IS the canonical sender identity.
- **Tradeoff:** QA-03 (mail-tester 9/10) may be harder from a personal address. Phase 8 hardening can swap to Resend with verified domain — re-vendor `providers/resend.ts` from sibling, toggle `EMAIL_PROVIDER=resend`, populate `RESEND_*` env. The abstraction supports the swap without code rewrite.

### Managed Turnstile widget
- **What:** Visible widget that auto-decides checkbox vs silent based on risk, instead of fully invisible.
- **Why:** Trade-customer audience — visible "Verifying you are human" cue prevents users from blasting through the form before the bot check resolves. Fewer false rejections.
- **Implementation:** Plan 05-06 renders `<Turnstile ref={...} siteKey={...} />` with no `size` prop (defaults to Managed) inside a `<div>` with an explanatory label.

### v2 forward-architecture (gmail-oauth)
- **What:** Vendor abstraction explicitly designed so v2 onboarding can add a `gmail-oauth` provider keyed to per-account refresh tokens.
- **Why:** Future tenants will OAuth their own Gmail (scopes: `gmail.send` + optional `gmail.readonly` for inbox-side reply parsing). The current `createEmailClient(config)` factory already accepts per-call config — only a new provider file + 2 schema columns (`accounts.gmail_refresh_token`, `accounts.gmail_oauth_email`) needed.
- **Captured in:** CONTEXT.md decision #11 (revised) + `lib/email-sender/index.ts` header comment.

### v1 constraint: owner_email = GMAIL_USER
- **What:** `accounts.owner_email` MUST equal `GMAIL_USER` env value in v1.
- **Why:** nodemailer SMTP `from` is bound to the authenticated Gmail address. Mismatch causes Gmail to either reject the send or rewrite the From header (silent UX bug). Both = `ajwegner3@gmail.com` for nsi.
- **v2 path:** When per-account OAuth ships, this constraint relaxes — each account's outbound emails come from their own authenticated Gmail.

## Deviations from Plan

### Auto-fixed (Rule 3 — Blocking)

**1. Vendored `utils.ts` alongside the 3 specified files** — `providers/gmail.ts` imports `stripHtml` from `../utils`. Build would fail without it. (Same as the original Plan 05-02 deviation; persists post-pivot.)

### User-driven redesign (Rule 4 — Architectural)

**2. Pivot Resend → Gmail (mid-plan)** — Andrew changed provider choice during the env-var checkpoint. Required: restore gmail.ts, rewrite index.ts, swap npm deps, rewrite .env.example, update CONTEXT.md decisions #4/#11/#12, update Plans 05-03 + 05-06.

**3. Pivot Invisible → Managed Turnstile** — Andrew changed widget mode during the same checkpoint. Required: update CONTEXT.md decision #4, update Plan 05-06 component code (remove `size: "invisible"`, add visible-widget wrapper with label).

---

**Total deviations:** 3 (1 auto-fixed blocking, 2 user-driven architectural).
**Impact on plan:** Net-positive — v2-ready abstraction explicitly documented; better UX for Managed Turnstile; uses existing tool stack.

## Issues Encountered

- **ESLint circular JSON error (pre-existing):** `npm run lint` exits 2 with a circular-structure JSON error in `@eslint/eslintrc` on Node v24. Pre-existing tech debt; not introduced here. Phase 8 backlog item (already tracked in STATE.md).

## User Setup Completed

| Step | Status |
|------|--------|
| Cloudflare Turnstile site created (Managed mode, calendar-app-xi-smoky.vercel.app + localhost) | ✓ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `.env.local` | ✓ (`0x4AAAAAADDRAYpD-wu5vIUN`) |
| `TURNSTILE_SECRET_KEY` in `.env.local` | ✓ (35 chars) |
| Gmail 2FA + App Password generated | ✓ |
| `GMAIL_USER` in `.env.local` | ✓ (`ajwegner3@gmail.com`) |
| `GMAIL_APP_PASSWORD` in `.env.local` | ✓ (16-char App Password, space-separated form) |
| `GMAIL_FROM_NAME` in `.env.local` | ✓ (`Andrew @ NSI`) |
| `EMAIL_PROVIDER` in `.env.local` | ✓ (`gmail`) |
| Vercel Production + Preview env populated | ✓ (Andrew confirmed) |

## Next Phase Readiness

- `lib/email-sender` ready to import via `@/lib/email-sender` in Phase 5 booking route — call `sendEmail({to, subject, html, replyTo?, attachments?})`; the singleton handles `from` automatically from `GMAIL_FROM_NAME` + `GMAIL_USER`
- `ical-generator` + `timezones-ical-library` ready for `.ics` attachment builder (Plan 05-03)
- `@marsidev/react-turnstile` ready for booking form (Plan 05-06) — render visibly without `size: "invisible"` prop
- Wave 1 complete; Wave 2 (Plans 05-03 + 05-04) unblocked

---
*Phase: 05-public-booking-flow*
*Completed: 2026-04-25*
