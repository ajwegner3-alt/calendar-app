# Requirements: Calendar App (NSI Booking Tool) — Milestone v1.7

**Defined:** 2026-05-06
**Core Value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Milestone goal:** Open multi-tenant signup with Google OAuth (combined `gmail.send` consent), enable magic-link login, retire the centralized Gmail SMTP in favor of per-account Gmail OAuth send, build the cap-hit "Request upgrade" path with NSI-owned Resend behind it for upgraded accounts, ship the v1.5-deferred booker polish (animated form slide-in + skeleton loader), and audit the runtime tree for dead code with surgical removal under per-item sign-off.

## v1.7 Requirements

### Authentication

- [x] **AUTH-23**: User can sign up by clicking "Sign up with Google" on `/app/signup`; one consent screen requests `openid email profile` + `gmail.send` together
- [ ] **AUTH-24**: User can request a passwordless login email from the existing `/app/login` card (magic-link option, no separate route)
- [x] **AUTH-25**: When user denies `gmail.send` at the OAuth consent screen, the account is still created and the user is prompted to connect Gmail later (partial-grant handled gracefully)
- [x] **AUTH-26**: Existing email/password account holder can connect a Google Gmail from `/app/settings` via `linkIdentity()` — does NOT create a duplicate user
- [x] **AUTH-27**: User can disconnect their Gmail from `/app/settings`, which revokes the stored refresh token
- [ ] **AUTH-28**: Magic-link requests rate-limited via `rate_limit_events` (3/hour per IP)
- [ ] **AUTH-29**: Magic-link request returns identical HTTP response body for known and unknown emails (enumeration-safe)
- [x] **AUTH-30**: When user's Gmail refresh token is revoked (`invalid_grant`), an in-app banner prompts reconnect; subsequent email sends refuse-send fail-closed

### Email Infrastructure

- [x] **EMAIL-26**: Every account (including `nsi`) sends transactional emails via its own connected Gmail OAuth — the centralized Gmail SMTP path is retired in a separate post-cutover deploy
- [x] **EMAIL-27**: `email_send_log` table gains `account_id` column; `getDailySendCount()` and `checkAndConsumeQuota()` filter by account
- [x] **EMAIL-28**: 200/day Gmail cap is enforced per-account (not globally); two accounts can each independently hit their own cap
- [x] **EMAIL-29**: Gmail refresh tokens stored encrypted (AES-256-GCM) in a new `account_oauth_credentials` table; never plaintext in any environment
- [x] **EMAIL-30**: Onboarding wizard includes a skippable "Connect Gmail" step
- [x] **EMAIL-31**: `/app/settings` shows Gmail connection status (Connected / Needs reconnect / Never connected)
- [x] **EMAIL-32**: All 7 transactional email paths (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner) route through `getSenderForAccount(accountId)` factory
- [x] **EMAIL-33**: Strangler-fig cutover: Andrew connects `nsi` Gmail OAuth on preview; the `getSenderForAccount` factory unconditionally prefers an OAuth credential when one exists, so the cutover for `nsi` is the act of connecting Gmail OAuth itself (no per-account routing flag needed at v1.7); SMTP path + `GMAIL_APP_PASSWORD` removed in a separate deploy after Andrew confirms production sends working. (`accounts.email_provider` column and runtime routing logic are introduced in Phase 36 when Resend becomes a second backend — at v1.7 there is only one backend selectable per account, so a discriminator column is not needed yet.)

### Upgrade Flow (Cap-Hit Request)

- [ ] **UPGRADE-01**: When an account hits 200/day cap, the owner sees an inline "Request upgrade" link in the existing quota-exceeded banner
- [ ] **UPGRADE-02**: `/app/settings/upgrade` page accepts an optional message; submission triggers `requestUpgradeAction`
- [ ] **UPGRADE-03**: `requestUpgradeAction` emails Andrew via NSI-owned Resend, bypassing the per-account quota guard entirely (bootstrap-safe — works at exactly the moment the requester is at cap)
- [ ] **UPGRADE-04**: Upgrade request button has a 24-hour per-account debounce (one request/day max)
- [x] **UPGRADE-05**: When Andrew sets `accounts.email_provider = 'resend'`, that account's emails route via NSI's Resend with the account's business name as the display name and NSI's verified domain in the envelope (framework complete 2026-05-08; live activation requires PREREQ-03)
- [x] **UPGRADE-06**: Upgraded (Resend) accounts skip the 200/day cap check; sends still log to `email_send_log` for analytics (framework complete 2026-05-08; live activation requires PREREQ-03)

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
| **PREREQ-01** | Phase 34 (AUTH-23..27) | Google Cloud Console: create/configure OAuth project, enable Gmail API, configure consent screen, add `gmail.send` sensitive scope, create OAuth Client ID + Secret. Start app verification (3–5 business days lead time). |
| **PREREQ-02** | Phase 34 (AUTH-23..27) | Supabase dashboard: enable Google provider, paste Client ID + Secret. |
| **PREREQ-03** | Phase 36 (UPGRADE-05) | Resend: create account, verify NSI domain via Namecheap DNS (SPF/DKIM/DMARC records), capture API key, confirm Pro tier (~$20/month). |
| **PREREQ-04** | Phases 34, 35, 36 | Vercel env vars on Preview + Production: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY` (32-byte hex), `RESEND_API_KEY`. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-23 | Phase 34 | Complete |
| AUTH-24 | Phase 38 | Pending |
| AUTH-25 | Phase 34 | Complete |
| AUTH-26 | Phase 34 | Complete |
| AUTH-27 | Phase 34 | Complete |
| AUTH-28 | Phase 38 | Pending |
| AUTH-29 | Phase 38 | Pending |
| AUTH-30 | Phase 35 | Complete |
| EMAIL-26 | Phase 35 | Complete |
| EMAIL-27 | Phase 35 | Complete |
| EMAIL-28 | Phase 35 | Complete |
| EMAIL-29 | Phase 34 | Complete |
| EMAIL-30 | Phase 34 | Complete |
| EMAIL-31 | Phase 34 | Complete |
| EMAIL-32 | Phase 35 | Complete |
| EMAIL-33 | Phase 35 | Complete |
| UPGRADE-01 | Phase 37 | Pending |
| UPGRADE-02 | Phase 37 | Pending |
| UPGRADE-03 | Phase 37 | Pending |
| UPGRADE-04 | Phase 37 | Pending |
| UPGRADE-05 | Phase 36 | Complete (framework — live activation deferred per PREREQ-03) |
| UPGRADE-06 | Phase 36 | Complete (framework — live activation deferred per PREREQ-03) |
| BOOKER-06 | Phase 39 | Pending |
| BOOKER-07 | Phase 39 | Pending |
| BOOKER-08 | Phase 39 | Pending |
| BOOKER-09 | Phase 39 | Pending |
| DEBT-09 | Phase 40 | Pending |
| DEBT-10 | Phase 40 | Pending |
| DEBT-11 | Phase 40 | Pending |
| DEBT-12 | Phase 40 | Pending |

**Coverage:**
- v1.7 requirements: 30 total (8 AUTH + 8 EMAIL + 6 UPGRADE + 4 BOOKER + 4 DEBT)
- Mapped to phases: 30 / 30
- Unmapped: 0

---

*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 — traceability filled by roadmap creation. All 30 requirements mapped to Phases 34-40.*
*EMAIL-33 amended 2026-05-06 — removed `nsi.email_provider` flip clause: the column does not exist at v1.7 (no migration adds it), and the `getSenderForAccount` factory is unconditional (always uses an OAuth credential when one exists), so cutover is the act of connecting Gmail OAuth itself. The `accounts.email_provider` column and runtime routing logic land in Phase 36 when Resend becomes a second backend.*
