# Requirements: Calendar App (NSI Booking Tool) — Milestone v1.7

**Defined:** 2026-05-06
**Core Value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Milestone goal:** Open multi-tenant signup with Google OAuth (combined `gmail.send` consent), enable magic-link login, retire the centralized Gmail SMTP in favor of per-account Gmail OAuth send, build the cap-hit "Request upgrade" path with NSI-owned Resend behind it for upgraded accounts, ship the v1.5-deferred booker polish (animated form slide-in + skeleton loader), and audit the runtime tree for dead code with surgical removal under per-item sign-off.

## v1.7 Requirements

### Authentication

- [ ] **AUTH-23**: User can sign up by clicking "Sign up with Google" on `/app/signup`; one consent screen requests `openid email profile` + `gmail.send` together
- [ ] **AUTH-24**: User can request a passwordless login email from the existing `/app/login` card (magic-link option, no separate route)
- [ ] **AUTH-25**: When user denies `gmail.send` at the OAuth consent screen, the account is still created and the user is prompted to connect Gmail later (partial-grant handled gracefully)
- [ ] **AUTH-26**: Existing email/password account holder can connect a Google Gmail from `/app/settings` via `linkIdentity()` — does NOT create a duplicate user
- [ ] **AUTH-27**: User can disconnect their Gmail from `/app/settings`, which revokes the stored refresh token
- [ ] **AUTH-28**: Magic-link requests rate-limited via `rate_limit_events` (3/hour per IP)
- [ ] **AUTH-29**: Magic-link request returns identical HTTP response body for known and unknown emails (enumeration-safe)
- [ ] **AUTH-30**: When user's Gmail refresh token is revoked (`invalid_grant`), an in-app banner prompts reconnect; subsequent email sends refuse-send fail-closed

### Email Infrastructure

- [ ] **EMAIL-26**: Every account (including `nsi`) sends transactional emails via its own connected Gmail OAuth — the centralized Gmail SMTP path is retired in a separate post-cutover deploy
- [ ] **EMAIL-27**: `email_send_log` table gains `account_id` column; `getDailySendCount()` and `checkAndConsumeQuota()` filter by account
- [ ] **EMAIL-28**: 200/day Gmail cap is enforced per-account (not globally); two accounts can each independently hit their own cap
- [ ] **EMAIL-29**: Gmail refresh tokens stored encrypted (AES-256-GCM) in a new `account_oauth_credentials` table; never plaintext in any environment
- [ ] **EMAIL-30**: Onboarding wizard includes a skippable "Connect Gmail" step
- [ ] **EMAIL-31**: `/app/settings` shows Gmail connection status (Connected / Needs reconnect / Never connected)
- [ ] **EMAIL-32**: All 7 transactional email paths (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner) route through `getSenderForAccount(accountId)` factory
- [ ] **EMAIL-33**: Strangler-fig cutover: Andrew connects `nsi` Gmail OAuth on preview; production cutover flips `nsi.email_provider` to `gmail_oauth`; SMTP path + `GMAIL_APP_PASSWORD` removed in a separate deploy after Andrew confirms production sends working

### Upgrade Flow (Cap-Hit Request)

- [ ] **UPGRADE-01**: When an account hits 200/day cap, the owner sees an inline "Request upgrade" link in the existing quota-exceeded banner
- [ ] **UPGRADE-02**: `/app/settings/upgrade` page accepts an optional message; submission triggers `requestUpgradeAction`
- [ ] **UPGRADE-03**: `requestUpgradeAction` emails Andrew via NSI-owned Resend, bypassing the per-account quota guard entirely (bootstrap-safe — works at exactly the moment the requester is at cap)
- [ ] **UPGRADE-04**: Upgrade request button has a 24-hour per-account debounce (one request/day max)
- [ ] **UPGRADE-05**: When Andrew sets `accounts.email_provider = 'resend'`, that account's emails route via NSI's Resend with the account's business name as the display name and NSI's verified domain in the envelope
- [ ] **UPGRADE-06**: Upgraded (Resend) accounts skip the 200/day cap check; sends still log to `email_send_log` for analytics

### Booker Polish

- [ ] **BOOKER-06**: After slot pick, the form column animates in (200–250ms ease-out, `transform`/`opacity` only via existing `tw-animate-css`)
- [ ] **BOOKER-07**: Before slot pick (`selectedSlot === null`), the empty form column shows a shape-only skeleton placeholder (no false-positive "loading" implication)
- [ ] **BOOKER-08**: Animation respects `prefers-reduced-motion` (no animation when user has OS reduced-motion enabled)
- [ ] **BOOKER-09**: V15-MP-05 Turnstile lifecycle lock preserved (`BookingForm` absent from DOM before `selectedSlot !== null`); Chrome CLS = 0.0 verified after slot-pick animation

### Dead-Code Audit

- [ ] **DEBT-09**: `knip` installed as devDependency; `knip.json` configured with explicit ignore list (`slot-picker.tsx` per Plan 30-01 Rule 4, test mock helpers, `__mocks__/`)
- [ ] **DEBT-10**: `knip` report (markdown + JSON) committed to phase folder for review
- [ ] **DEBT-11**: Andrew reviews each removal candidate individually (REMOVE / KEEP / INVESTIGATE)
- [ ] **DEBT-12**: Removals committed atomically per logical group; `next build` runs green between batches; SQL migration files always excluded from deletion candidates

## v1.8+ Requirements (Deferred)

### Brand

- **BRAND-22**: Final NSI brand asset swap (logo/mark image vs current text-only "Powered by North Star Integrations")

### Calendar Sync

- **CAL-SYNC-01**: Google Calendar read/write sync (extends gmail.send → full Workspace integration)
- **CAL-SYNC-02**: Owner can opt to write confirmed bookings into their primary Google Calendar

### Auth Extensions

- **AUTH-31**: Microsoft OAuth signup
- **AUTH-32**: SAML/SSO (enterprise)

### Email Infrastructure

- **EMAIL-34**: Per-account custom Resend domain (currently shared NSI domain across all upgraded accounts)
- **EMAIL-35**: Bounce handling + retry queue for Resend
- **EMAIL-36**: Per-account custom email templates (currently NSI-styled)

### Booker Polish (further)

- **BOOKER-10**: Page-transition animations between event-types index and event-page

## Out of Scope

| Feature | Reason |
|---------|--------|
| `googleapis` npm package | Nodemailer handles OAuth2 token refresh natively (LD-01) |
| `pgsodium` for token encryption | AES-256-GCM with Vercel env var key sufficient at v1.7 scale (LD-03) |
| Framer Motion for booker animation | `tw-animate-css` already installed; CSS-only animation sufficient (LD-08) |
| Per-account Resend account (customer pays Resend directly) | Reverted from initial discussion: shared NSI Resend gives Andrew per-email margin (LD-05) |
| Separate `/app/login/magic-link` route | Magic-link is a secondary action on the existing login card (LD-07) |
| Block account creation when `gmail.send` is denied | Google policy + UX dead-end; partial grants must be handled gracefully (V17-CP-01) |
| Re-prompt `gmail.send` scope on every login | Google OAuth policy violation |
| Big-bang dead-code deletion PR | Each removal needs Andrew sign-off; atomic commits only (LD-09) |
| Vercel Pro hourly cron flip | Per-account cap relieves the centralized cap pressure that motivated this |

## Manual Prerequisites

These block specific phases. Andrew action required before phase can ship.

| Prereq | Required for | Description |
|--------|--------------|-------------|
| **PREREQ-01** | Phase 1 (AUTH-23..27) | Google Cloud Console: create/configure OAuth project, enable Gmail API, configure consent screen, add `gmail.send` sensitive scope, create OAuth Client ID + Secret. Start app verification (3–5 business days lead time). |
| **PREREQ-02** | Phase 1 (AUTH-23..27) | Supabase dashboard: enable Google provider, paste Client ID + Secret. |
| **PREREQ-03** | Phase 3 (UPGRADE-05) | Resend: create account, verify NSI domain via Namecheap DNS (SPF/DKIM/DMARC records), capture API key, confirm Pro tier (~$20/month). |
| **PREREQ-04** | Phases 1, 2, 3 | Vercel env vars on Preview + Production: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY` (32-byte hex), `RESEND_API_KEY`. |

## Traceability

Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-23 | Phase TBD | Pending |
| AUTH-24 | Phase TBD | Pending |
| AUTH-25 | Phase TBD | Pending |
| AUTH-26 | Phase TBD | Pending |
| AUTH-27 | Phase TBD | Pending |
| AUTH-28 | Phase TBD | Pending |
| AUTH-29 | Phase TBD | Pending |
| AUTH-30 | Phase TBD | Pending |
| EMAIL-26 | Phase TBD | Pending |
| EMAIL-27 | Phase TBD | Pending |
| EMAIL-28 | Phase TBD | Pending |
| EMAIL-29 | Phase TBD | Pending |
| EMAIL-30 | Phase TBD | Pending |
| EMAIL-31 | Phase TBD | Pending |
| EMAIL-32 | Phase TBD | Pending |
| EMAIL-33 | Phase TBD | Pending |
| UPGRADE-01 | Phase TBD | Pending |
| UPGRADE-02 | Phase TBD | Pending |
| UPGRADE-03 | Phase TBD | Pending |
| UPGRADE-04 | Phase TBD | Pending |
| UPGRADE-05 | Phase TBD | Pending |
| UPGRADE-06 | Phase TBD | Pending |
| BOOKER-06 | Phase TBD | Pending |
| BOOKER-07 | Phase TBD | Pending |
| BOOKER-08 | Phase TBD | Pending |
| BOOKER-09 | Phase TBD | Pending |
| DEBT-09 | Phase TBD | Pending |
| DEBT-10 | Phase TBD | Pending |
| DEBT-11 | Phase TBD | Pending |
| DEBT-12 | Phase TBD | Pending |

**Coverage:**
- v1.7 requirements: 30 total (8 AUTH + 8 EMAIL + 6 UPGRADE + 4 BOOKER + 4 DEBT)
- Mapped to phases: 0 (filled by roadmap)
- Unmapped: 30 (will resolve after roadmap)

---

*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 — initial v1.7 definition from research SUMMARY.md*
