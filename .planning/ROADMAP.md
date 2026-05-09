# Roadmap: Calendar App (NSI Booking Tool)

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- ✅ **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (34 plans, including decimal Phases 12.5 + 12.6) — shipped 2026-04-30. Full archive: [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md).
- ✅ **v1.2 NSI Brand Lock-Down + UI Overhaul** — Phases 14-21 (22 plans across 8 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md).
- ✅ **v1.3 Bug Fixes + Polish** — Phases 22-24 (6 plans across 3 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md).
- ✅ **v1.4 Slot Correctness + Polish** — Phases 25-27 (8 plans across 3 phases) — shipped 2026-05-03. Full archive: [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md).
- ✅ **v1.5 Buffer Fix + Audience Rebrand + Booker Redesign** — Phases 28-30 (6 plans across 3 phases) — shipped 2026-05-05. Full archive: [`milestones/v1.5-ROADMAP.md`](./milestones/v1.5-ROADMAP.md).
- ✅ **v1.6 Day-of-Disruption Tools** — Phases 31-33 (10 plans, 3 phases) — shipped 2026-05-06. Full archive: [`milestones/v1.6-ROADMAP.md`](./milestones/v1.6-ROADMAP.md).
- 🚧 **v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code** — Phases 34-40 (7 phases) — 6 of 7 phases shipped (34, 35, 36 framework, 37, 38, 39).

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-9) — SHIPPED 2026-04-27</summary>

See [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md) for full phase details.

- [x] Phase 1: Foundation — completed 2026-04-19
- [x] Phase 2: Owner Auth + Dashboard Shell — completed 2026-04-24
- [x] Phase 3: Event Types CRUD — completed 2026-04-24
- [x] Phase 4: Availability Engine — completed 2026-04-25
- [x] Phase 5: Public Booking Flow + Email + .ics — completed 2026-04-25
- [x] Phase 6: Cancel + Reschedule Lifecycle — completed 2026-04-25
- [x] Phase 7: Widget + Branding — completed 2026-04-26
- [x] Phase 8: Reminders + Hardening + Dashboard List — completed 2026-04-27
- [x] Phase 9: Manual QA & Verification — completed 2026-04-27 ("ship v1")

</details>

<details>
<summary>✅ v1.1 Multi-User + Capacity + Branded UI (Phases 10-13) — SHIPPED 2026-04-30</summary>

See [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md) for full phase details.

- [x] Phase 10: Multi-User Signup + Onboarding (9 plans) — code complete 2026-04-28
- [x] Phase 11: Booking Capacity + Double-Booking Root-Cause Fix (8 plans) — code complete 2026-04-29
- [x] Phase 12: Branded UI Overhaul (5 Surfaces) (7 plans) — code complete 2026-04-29
- [x] Phase 12.5: Per-Account Heavy Chrome Theming (INSERTED) (4 plans) — code complete 2026-04-29 (deprecated in code by 12.6; DB columns retained)
- [x] Phase 12.6: Direct Per-Account Color Controls (INSERTED) (3 plans) — code complete 2026-04-29 (Andrew live Vercel approval)
- [x] Phase 13: Manual QA + Andrew Ship Sign-Off (3 plans) — closed 2026-04-30 (Plan 13-01 complete; 13-02 + 13-03 closed-by-waiver; QA-09..13 deferred to v1.3)

</details>

<details>
<summary>✅ v1.2 NSI Brand Lock-Down + UI Overhaul (Phases 14-21) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md) for full phase details.

- [x] Phase 14: Typography + CSS Token Foundations (1 plan) — completed 2026-04-30
- [x] Phase 15: BackgroundGlow + Header Pill + Owner Shell Re-Skin (2 plans) — completed 2026-04-30
- [x] Phase 16: Auth + Onboarding Re-Skin (4 plans) — completed 2026-04-30
- [x] Phase 17: Public Surfaces + Embed (9 plans) — completed 2026-04-30
- [x] Phase 18: Branding Editor Simplification (3 plans) — completed 2026-05-01
- [x] Phase 19: Email Layer Simplification (1 plan) — completed 2026-05-01
- [x] Phase 20: Dead Code + Test Cleanup (1 plan) — completed 2026-05-01
- [x] Phase 21: Schema DROP Migration (1 plan) — completed 2026-05-02

</details>

<details>
<summary>✅ v1.3 Bug Fixes + Polish (Phases 22-24) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md) for full phase details.

- [x] Phase 22: Auth Fixes (2 plans) — completed 2026-05-02
- [x] Phase 23: Public Booking Fixes (2 plans) — completed 2026-05-02
- [x] Phase 24: Owner UI Polish (2 plans) — completed 2026-05-02 (Andrew live deploy approved)

</details>

<details>
<summary>✅ v1.4 Slot Correctness + Polish (Phases 25-27) — SHIPPED 2026-05-03</summary>

See [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md) for full phase details.

- [x] Phase 25: Surgical Polish (2 plans) — completed 2026-05-03 (AUTH-21, AUTH-22, OWNER-14, OWNER-15)
- [x] Phase 26: Bookings Page Crash Debug + Fix (3 plans) — completed 2026-05-03 (BOOK-01, BOOK-02; root cause RSC boundary violation)
- [x] Phase 27: Slot Correctness DB-Layer Enforcement (3 plans) — completed 2026-05-03 (SLOT-01..05; EXCLUDE constraint live; Andrew smoke approved)

</details>

<details>
<summary>✅ v1.5 Buffer Fix + Audience Rebrand + Booker Redesign (Phases 28-30) — SHIPPED 2026-05-05</summary>

See [`milestones/v1.5-ROADMAP.md`](./milestones/v1.5-ROADMAP.md) for full phase details.

- [x] Phase 28: Per-Event-Type Buffer + Account Column Drop (3 plans) — completed 2026-05-04 (BUFFER-01..06 shipped; CP-03 DROP completed with drain waiver)
- [x] Phase 29: Audience Rebrand (1 plan) — completed 2026-05-04 (BRAND-01..03 shipped; canonical grep gate clean)
- [x] Phase 30: Public Booker 3-Column Desktop Layout (2 plans) — completed 2026-05-05 (BOOKER-01..05 shipped; Andrew live-verified at 1024/1280/1440 + mobile)

</details>

<details>
<summary>✅ v1.6 Day-of-Disruption Tools (Phases 31-33) — SHIPPED 2026-05-06</summary>

See [`milestones/v1.6-ROADMAP.md`](./milestones/v1.6-ROADMAP.md) for full phase details.

- [x] Phase 31: Email Hard Cap Guard (3 plans) — completed 2026-05-05 (Andrew live verification approved)
- [x] Phase 32: Inverse Date Overrides (3 plans) — completed 2026-05-05 (Andrew live verification approved 8/8 scenarios)
- [x] Phase 33: Day-Level Pushback Cascade (4 plans) — completed 2026-05-06 (Andrew live-verified all 8 scenarios; PUSH-10 gap closed by orchestrator commit `2aa9177`; verifier re-passed)

</details>

### 🚧 v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code (Phases 34-40) — IN PLANNING

**Milestone Goal:** Open multi-tenant signup with Google OAuth (combined `gmail.send` consent), retire the centralized Gmail SMTP singleton in favor of per-account Gmail OAuth send, build the cap-hit "Request upgrade" path with NSI-owned Resend behind it for upgraded accounts, enable magic-link login, ship BOOKER-06/07 animated form polish, and audit the runtime tree for dead code with surgical removal under per-item sign-off.

**Manual Prerequisites (Andrew action required before gated phases can ship):**
- **PREREQ-01** (blocks Phase 34): Google Cloud Console — create OAuth project, enable Gmail API, configure consent screen with `gmail.send` sensitive scope, create Client ID + Secret. Start app verification immediately (3-5 business day lead time).
- **PREREQ-02** (blocks Phase 34): Supabase dashboard — enable Google provider, paste Client ID + Secret.
- **PREREQ-03** (blocks Phase 36): Resend — create account, verify NSI domain via Namecheap DNS (SPF/DKIM/DMARC), capture API key, confirm Pro tier (~$20/month).
- **PREREQ-04** (blocks Phases 34, 35, 36): Vercel env vars on Preview + Production — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY` (32-byte hex), `RESEND_API_KEY`.

---

#### Phase 34: Google OAuth Signup + Credential Capture

**Goal:** Users can sign up with Google (combined `gmail.send` consent), existing accounts can connect or disconnect Gmail, and all OAuth tokens are stored encrypted — making Google-linked accounts available for Phase 35's per-account send.

**Depends on:** Phase 33 (prior milestone complete); PREREQ-01, PREREQ-02, PREREQ-04 (Andrew action required)

**Requirements:** AUTH-23, AUTH-25, AUTH-26, AUTH-27, EMAIL-29, EMAIL-30, EMAIL-31

**Andrew action required before this phase can ship:** PREREQ-01 (Google Cloud Console setup), PREREQ-02 (Supabase Google provider), PREREQ-04 (Vercel env vars).

**Success Criteria** (what must be TRUE):
1. Clicking "Sign up with Google" on `/app/signup` opens a single Google consent screen requesting `openid email profile` and `gmail.send` together; after approval the user lands in onboarding.
2. When a user denies `gmail.send` at the consent screen the account is still created and the onboarding wizard shows a skippable "Connect Gmail" step — no error, no blocked state.
3. An existing email/password account holder can connect their Gmail from `/app/settings` and the settings page shows "Connected" status — no duplicate user is created.
4. An owner can disconnect Gmail from `/app/settings`; the page returns to "Never connected" or "Needs reconnect" status and the stored credential is revoked.
5. Gmail refresh tokens never appear in plaintext in any environment; `account_oauth_credentials` table stores only `refresh_token_encrypted`.

**Plans:** 4 plans in 3 waves
- [x] 34-01-PLAN.md — DB migration (`account_oauth_credentials`) + supabase/config.toml `enable_manual_linking` (Wave 1) — completed 2026-05-06
- [x] 34-02-PLAN.md — Encryption util + Google HTTP helpers + branded GoogleOAuthButton (Wave 1) — completed 2026-05-06
- [x] 34-03-PLAN.md — `/auth/google-callback` route handler + signup/login Google buttons + actions (Wave 2) — completed 2026-05-06
- [x] 34-04-PLAN.md — Settings Gmail panel (connect/disconnect/status) + onboarding optional step + linked-banner toast (Wave 3) — completed 2026-05-06

---

#### Phase 35: Per-Account Gmail OAuth Send

**Goal:** All seven transactional email paths route through a per-account sender factory backed by each account's own Gmail OAuth credential, with per-account quota isolation and a strangler-fig cutover that retires the centralized SMTP singleton in a separate post-verification deploy.

**Depends on:** Phase 34 (OAuth tokens in database; `account_oauth_credentials` table exists); PREREQ-04 (Vercel env vars)

**Requirements:** AUTH-30, EMAIL-26, EMAIL-27, EMAIL-28, EMAIL-32, EMAIL-33

**Andrew action required before SMTP removal deploy:** Andrew connects `nsi` Gmail OAuth on preview branch; booking confirmation arrives in real inbox; only then does the SMTP removal commit ship as a separate deploy.

**Success Criteria** (what must be TRUE):
1. A booking confirmation sent from the `nsi` account arrives in Andrew's inbox via Gmail OAuth (not SMTP) after the preview-branch test.
2. Two test accounts can each independently receive email while the other's daily count is at 200 — one account at cap does not affect the other's quota.
3. When a Gmail refresh token is revoked (`invalid_grant`), the in-app banner appears prompting reconnect; subsequent send attempts refuse-send fail-closed rather than silently failing.
4. All 7 send paths (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner) call `getSenderForAccount(accountId)` — zero direct `sendEmail()` singleton calls remain in production send code.
5. `GMAIL_APP_PASSWORD` and the centralized SMTP path are removed in a separate deploy only after Andrew confirms production sends working via Gmail OAuth.

**Plans:** 7 plans in 6 waves — all complete 2026-05-08
- [x] 35-00-PLAN.md — Vercel GOOGLE_CLIENT_ID/SECRET env var checklist (manual handoff, Wave 1)
- [x] 35-01-PLAN.md — Per-account quota: email_send_log.account_id migration + quota-guard signature update (Wave 2)
- [x] 35-02-PLAN.md — Google token exchange helper + Gmail OAuth nodemailer provider (Wave 2)
- [x] 35-03-PLAN.md — getSenderForAccount factory with invalid_grant → needs_reconnect handling (Wave 3)
- [x] 35-04-PLAN.md — Cutover: thread accountId through 7 transactional senders + outer callers (Wave 4)
- [x] 35-05-PLAN.md — Two-step deploy verification: Andrew dogfoods nsi connect on production + reconnect smoke (Wave 5)
- [x] 35-06-PLAN.md — SMTP singleton + GMAIL_APP_PASSWORD removal commit (Wave 6, post-verification)

**Architectural deviations during verification (both shipped to production):**
- Direct-Google OAuth replaces Supabase `linkIdentity` for the Gmail-connect flow (commit `ab02a23`) — `linkIdentity` silently dropped `provider_refresh_token` under several conditions.
- Gmail provider switched from SMTP+OAuth2 to Gmail REST API (commit `cb82b6f`) — `gmail.send` scope authorizes only the REST endpoint; SMTP relay needs the broader `https://mail.google.com/` scope, which we don't request.

See `.planning/phases/35-per-account-gmail-oauth-send/35-DEVIATION-DIRECT-OAUTH.md` for the full pivot post-mortem.

---

#### Phase 36: Resend Backend for Upgraded Accounts

**Goal:** A Resend HTTP client backed by NSI's verified domain is wired into the sender factory so that any account with `email_provider = 'resend'` routes all sends through Resend — bypassing the 200/day Gmail cap entirely while still logging to `email_send_log` for analytics.

**Depends on:** Phase 35 (`accounts.email_provider` column and `getSenderForAccount` factory exist); PREREQ-03 (Resend domain verified — hard gate)

**Requirements:** UPGRADE-05, UPGRADE-06

**Andrew action required before this phase can ship:** PREREQ-03 — Resend account created, NSI domain DNS records added in Namecheap, Resend dashboard shows "Verified" for SPF and DKIM. Do not deploy Resend send code until verified.

**Success Criteria** (what must be TRUE):
1. An account with `email_provider = 'resend'` receives a booking confirmation email delivered via Resend (visible in Resend dashboard sent log) using the account's business name as display name and NSI's verified domain in the envelope.
2. A `.ics` calendar attachment is present and renders as a calendar invite in the received email (MEDIUM-confidence: verify in QA; `content_type: 'text/calendar'` may be needed if not).
3. An account with `email_provider = 'resend'` can receive more than 200 booking emails in a day — the 200/day cap check is skipped for Resend accounts; sends still appear in `email_send_log`.

**Plans:** 3 plans in 3 waves — all complete 2026-05-08 (framework only; PREREQ-03 deferred)
- [x] 36-01-PLAN.md — Schema migration (accounts.email_provider, accounts.resend_status, email_send_log.provider) + EmailProvider type union extension (Wave 1)
- [x] 36-02-PLAN.md — createResendClient HTTP provider + unit tests + mock + vitest alias (Wave 2)
- [x] 36-03-PLAN.md — Factory routing on email_provider + quota-guard cap bypass for Resend + isRefusedSend dual-prefix orchestrator fix + abuse warn-log + FUTURE_DIRECTIONS.md activation guide (Wave 3)

---

#### Phase 37: Upgrade Flow + In-App Cap-Hit UI

**Goal:** When an account hits the 200/day Gmail cap, the owner sees an inline "Request upgrade" link; submitting the upgrade request emails Andrew via NSI Resend, bypassing the requester's own quota guard entirely (bootstrap-safe: works at the exact moment the account is at cap).

**Depends on:** Phase 36 (`createResendClient` must exist before `requestUpgradeAction` can be implemented per LD-05 bootstrap constraint)

**Requirements:** UPGRADE-01, UPGRADE-02, UPGRADE-03, UPGRADE-04

**Success Criteria** (what must be TRUE):
1. When an account's `email_send_log` contains 200 rows for the current day, the existing quota-exceeded banner gains an inline "Request upgrade" link — the banner is otherwise unchanged.
2. Clicking "Request upgrade" opens `/app/settings/upgrade` with an optional message field; submitting the form sends an email to Andrew via NSI Resend.
3. With `email_send_log` seeded to 200 rows for the requester's account, the upgrade request email still arrives in Andrew's inbox — the quota guard is bypassed for this specific send path.
4. Submitting the upgrade request disables the button for 24 hours (one request per account per day); a second submit within 24 hours is rejected with a clear message.

**Plans:** 3 plans in 3 waves — all complete 2026-05-08 (framework only; live Resend delivery gated on PREREQ-03)
- [x] 37-01-PLAN.md — Schema migration (accounts.last_upgrade_request_at) + banner Request-upgrade link append (Wave 1)
- [x] 37-02-PLAN.md — requestUpgradeAction server action (createResendClient direct send + 24h rate limit) + 9 Vitest unit tests (Wave 2)
- [x] 37-03-PLAN.md — /app/settings/upgrade page (server component) + UpgradeForm client component with inline success/error/lockout states (Wave 3)

---

#### Phase 38: Magic-Link Login

**Goal:** An existing account holder can request a passwordless login email from the `/app/login` card; the flow is rate-limited, enumeration-safe, and uses Supabase `signInWithOtp` — no new route required.

**Depends on:** None (fully independent of Phases 34-37; can be developed in parallel with Phase 36)

**Requirements:** AUTH-24, AUTH-28, AUTH-29

**Success Criteria** (what must be TRUE):
1. On the existing `/app/login` card, a user can enter their email and request a magic-link login email without leaving the page or navigating to a separate route.
2. Submitting a known email address and submitting an unknown email address return identical HTTP status codes and identical response body text — no enumeration leakage.
3. More than 5 magic-link requests from the same (IP, email) pair within one hour are silently throttled (rate-limited via `rate_limit_events`); throttled requests return the SAME success-shape response as real sends — no enumeration leakage and no throttle leakage.

**Plans:** 3 plans in 3 waves — all complete 2026-05-08
- [x] 38-01-PLAN.md — Server action (requestMagicLinkAction) + magicLinkSchema + magicLink rate-limit config + ROADMAP/REQUIREMENTS reconciliation (Wave 1)
- [x] 38-02-PLAN.md — Login form Tabs (Password|Magic link) + MagicLinkSuccess client component with 30s resend countdown + page subtitle update (Wave 2)
- [x] 38-03-PLAN.md — supabase/config.toml otp_expiry → 900 + manual Supabase dashboard config (template + expiry + Site URL) + live end-to-end production verification (Wave 3, had checkpoints)

**Deviations during verification (non-blocking, captured in 38-03-SUMMARY.md):**
- Hosted Supabase Site URL was on default `http://localhost:3000`; Andrew updated to `https://booking.nsintegrations.com` mid-verification (was not in the original Task 2 dashboard checklist because Phase 34 OAuth uses redirect URL allowlist, not `{{ .SiteURL }}` template interpolation).
- Supabase's internal per-email OTP cooldown (~60s) reduces actual email deliveries below our 5/hour bucket on rapid-fire submits. Treated as feature, not bug — produces a four-way enumeration-safety ambiguity (unknown email / our-throttle / Supabase-throttle / real-send all return identical UI), strengthening AUTH-29 beyond the must_have.

---

#### Phase 39: BOOKER Polish

**Goal:** After a slot is picked, the booking form column animates in smoothly; before a slot is picked the column shows a shape-only skeleton; the animation respects reduced-motion; and the V15-MP-05 Turnstile lifecycle lock is preserved with zero CLS.

**Depends on:** None (pure UI; zero backend dependencies; can be developed in parallel with Phases 36-38)

**Requirements:** BOOKER-06, BOOKER-07, BOOKER-08, BOOKER-09

**Success Criteria** (what must be TRUE):
1. After picking a time slot, the form column animates in over 200-250ms using `transform`/`opacity` only (no layout-shifting properties); Chrome DevTools Performance panel shows CLS = 0.0.
2. Before any slot is selected, the form column area shows a shape-only skeleton placeholder — no false "loading" spinner and no empty white space.
3. With OS reduced-motion enabled, picking a slot shows the form immediately with no animation — the skeleton disappears and the form appears without any transition.
4. React DevTools confirms `BookingForm` is absent from the DOM before a slot is selected (V15-MP-05 Turnstile lifecycle lock preserved); Turnstile token does not stale on slot re-pick.

**Plans:** 3 plans in 3 waves — all complete 2026-05-08

- [x] 39-01-key-prop-removal-PLAN.md — Remove `key={selectedSlot.start_at}` from `<BookingForm>` to preserve V15-MP-05 lock and field-persistence (Wave 1)
- [x] 39-02-skeleton-placeholder-PLAN.md — Add static `BookingFormSkeleton` component and wire into pre-slot state (Wave 2)
- [x] 39-03-entry-animation-and-reduced-motion-PLAN.md — Add 220ms fade+rise wrapper animation and `prefers-reduced-motion` CSS override (Wave 3)

---

#### Phase 40: Dead-Code Audit

**Goal:** `knip` is installed, configured with an explicit ignore list, run against the full codebase, and its report reviewed by Andrew item-by-item — resulting in atomic surgical removals under per-item sign-off, leaving `next build` green throughout.

**Depends on:** Phases 34-39 all complete (audit a stable codebase, not a moving target — LD-09)

**Requirements:** DEBT-09, DEBT-10, DEBT-11, DEBT-12

**Success Criteria** (what must be TRUE):
1. `knip` is installed as a devDependency and `knip.json` at the project root has an explicit ignore list covering `slot-picker.tsx` (Plan 30-01 Rule 4), test mock helpers, and `__mocks__/`.
2. A `knip` report (markdown + JSON) is committed to the phase folder and Andrew has reviewed each removal candidate with a REMOVE / KEEP / INVESTIGATE decision recorded.
3. Each removal group is committed atomically; `next build` runs green between batches; SQL migration files are not touched.
4. After all approved removals, `npx knip` reports zero issues in the target categories.

**Plans:** 9 plans in 9 waves

- [ ] 40-01-knip-install-and-baseline-PLAN.md — Install knip + write knip.json + add scripts + generate baseline 40-KNIP-REPORT.md (Wave 1, autonomous)
- [ ] 40-02-andrew-review-checkpoint-PLAN.md — Andrew reviews report; Claude deep-dives INVESTIGATE items; produces 40-KNIP-DECISIONS.md (Wave 2, has checkpoint)
- [ ] 40-03-remove-unused-deps-PLAN.md — Atomic chore commit removing unused dependencies (Wave 3, build+test gate)
- [ ] 40-04-remove-duplicate-exports-PLAN.md — Atomic chore commit removing duplicate exports (Wave 4, build+test gate)
- [ ] 40-05-remove-unused-exports-PLAN.md — Atomic chore commit removing unused exports + server-action grep verification (Wave 5, build+test gate)
- [ ] 40-06-remove-unused-files-PLAN.md — Atomic chore commit removing unused files + sync knip.json with KEEP residue (Wave 6, build+test gate)
- [ ] 40-07-knip-ci-gate-PLAN.md — Add .github/workflows/knip.yml PR gate (Wave 7, autonomous, lands AFTER all removals)
- [ ] 40-08-v17-final-qa-PLAN.md — Andrew runs Phase 38 A-D + Phase 39 A-C regression checks on production; results captured in 40-V17-FINAL-QA.md (Wave 8, has checkpoint)
- [ ] 40-09-milestone-close-PLAN.md — Andrew runs /gsd:complete-milestone to archive v1.7 (Wave 9, has checkpoint)

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v1.0 | 52 / 52 | ✅ Shipped | 2026-04-27 |
| 10-13 | v1.1 | 34 / 34 | ✅ Shipped | 2026-04-30 |
| 14-21 | v1.2 | 22 / 22 | ✅ Shipped | 2026-05-02 |
| 22-24 | v1.3 | 6 / 6 | ✅ Shipped | 2026-05-02 |
| 25-27 | v1.4 | 8 / 8 | ✅ Shipped | 2026-05-03 |
| 28-30 | v1.5 | 6 / 6 | ✅ Shipped | 2026-05-05 |
| 31-33 | v1.6 | 10 / 10 | ✅ Shipped | 2026-05-06 |
| 34 | v1.7 | 4 / 4 | ✅ Code complete — connect path superseded by Phase 35 direct-OAuth (commit `ab02a23`); signup path still uses original `/auth/google-callback` | 2026-05-06 |
| 35 | v1.7 | 7 / 7 | ✅ Shipped — verifier 5/5 PASS; SMTP singleton + `GMAIL_APP_PASSWORD` removed (commits `31db425`, `138cfb0`, `6aecfbb`). See `35-DEVIATION-DIRECT-OAUTH.md` for architecture pivots. | 2026-05-08 |
| 36 | v1.7 | 3 / 3 | ✅ Framework shipped — verifier 13/13 PASS; live activation requires PREREQ-03 (Resend domain DNS) per FUTURE_DIRECTIONS.md | 2026-05-08 |
| 37 | v1.7 | 3 / 3 | ✅ Framework shipped — verifier 4/4 PASS; live Resend delivery requires PREREQ-03 (same gate as Phase 36) | 2026-05-08 |
| 38 | v1.7 | 3 / 3 | ✅ Shipped — verifier 19/19 PASS; Andrew live-verified A/B/C/D against production (`booking.nsintegrations.com`); two non-blocking deviations captured (Site URL fix, Supabase inner-cooldown observation) | 2026-05-08 |
| 39 | v1.7 | 3 / 3 | ✅ Shipped — verifier 4/4 PASS; Andrew live-verified all three checkpoints (key-prop removal, skeleton, animation+reduced-motion) on production | 2026-05-08 |
| 40 | v1.7 | 0 / TBD | Not started | - |

## Cumulative Stats

- **Total milestones shipped:** 6 (v1.0 → v1.6); v1.7 in planning
- **Total phases shipped:** 33 (Phases 1-9 + 10/11/12/12.5/12.6/13 + 14-21 + 22-24 + 25-27 + 28-30 + 31-33)
- **Total plans shipped:** 138 (52 + 34 + 22 + 6 + 8 + 6 + 10)
- **Total commits:** ~563 (222 v1.0 + 135 v1.1 + 91 v1.2 + 34 v1.3 + 50 v1.4 + 31 v1.5 + 53 v1.6)
- **v1.7 phases planned:** 7 (Phases 34-40); 30 requirements mapped; plans TBD

---

*Roadmap last updated: 2026-05-08 — Phase 39 SHIPPED (verifier 4/4 PASS). All three plans complete: key-prop removal (`7b0ec82`) preserves V15-MP-05 Turnstile lifecycle lock + field persistence on slot re-pick; static `BookingFormSkeleton` (`672500b` + `8223203`) replaces bare-text placeholder with shape-only blocks + "Pick a time to continue" copy; 220ms fade+rise wrapper (`c3108b3`) + `@media (prefers-reduced-motion: reduce)` override (`0595108`) deliver smooth first-pick animation that respects accessibility and never re-fires on re-pick. Andrew live-verified all three checkpoints on production: animation smooth + CLS = 0, reduced-motion suppresses cleanly, Turnstile token + RHF field values persist across slot re-picks. BOOKER-06..09 marked Complete in REQUIREMENTS.md. v1.7 progress: 6 of 7 phases shipped (34, 35, 36, 37, 38, 39). Final phase: 40 (dead-code audit).*

*Earlier: Phase 38 SHIPPED (verifier 19/19 PASS). All three plans complete: backend (`requestMagicLinkAction` + `magicLinkSchema` + 5/hr/IP+email rate-limit config), UI (Password|Magic-link Tabs in `/app/login` Card with Google OAuth preserved above; `MagicLinkSuccess` component with exact CONTEXT-locked copy + 15-min expiry note + 30s resend countdown), and live wiring (`supabase/config.toml` `otp_expiry → 900` + hosted Supabase Magic Link template using `{{ .TokenHash }}` PKCE-compatible URL + Site URL set to production). Andrew live-verified A/B/C/D against production. AUTH-24, AUTH-28, AUTH-29 marked Complete in REQUIREMENTS.md. v1.7 progress: 5 of 7 phases shipped (34, 35, 36, 37, 38). Next candidates: Phase 39 (BOOKER polish, pure UI) or Phase 40 (dead-code audit, depends on all of 34-39).*

*Earlier: Phase 37 SHIPPED (verifier 4/4 PASS). Schema migration + Request-upgrade banner link + requestUpgradeAction server action (createResendClient direct send, 24h rate limit, 9 Vitest unit tests passing) + /app/settings/upgrade server-component page + UpgradeForm client component with 5 visual states all landed. UPGRADE-01..04 marked Complete in REQUIREMENTS.md. Live email delivery requires PREREQ-03 (same Resend gate as Phase 36). v1.7 progress: 4 of 7 phases shipped (34, 35, 36, 37). Next candidates: Phase 38 (magic-link login, no prereqs) or Phase 39 (BOOKER polish, pure UI).*

*Earlier: Phase 36 framework SHIPPED (verifier 13/13 PASS). Schema migration + Resend HTTP provider + factory routing + quota-guard cap-bypass + dual-prefix orchestrator fix + FUTURE_DIRECTIONS.md activation guide all landed; live Resend activation requires PREREQ-03 (Andrew creates Resend account, verifies NSI domain DNS via Namecheap, adds RESEND_API_KEY to Vercel). Code activates immediately on `UPDATE accounts SET email_provider='resend' WHERE id=...` once PREREQ-03 done — no redeploy. v1.7 progress: 3 of 7 phases shipped (34, 35, 36).*

*Earlier: Phase 35 SHIPPED. Plan 35-05 verification completed (architectural quota isolation + reconnect-banner smoke); Plan 35-06 retired the SMTP singleton and `GMAIL_APP_PASSWORD` env var (commits `31db425` migrate-welcome-email, `138cfb0` delete-singleton, `6aecfbb` remove-env-vars, `e7984fe` plan-metadata). Verifier passed 5/5 must-haves. Phase 35 requirements (AUTH-30, EMAIL-26, EMAIL-27, EMAIL-28, EMAIL-32, EMAIL-33) all marked Complete in REQUIREMENTS.md. v1.7 progress: Phases 34 + 35 of 7 shipped. Andrew manual cleanup pending: delete `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` from Vercel (Preview + Production) — they are now inert, no redeploy required.*
