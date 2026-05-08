# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-08 (next session) — **Phase 35 SHIPPED.** Plan 35-05 verification gates passed (architectural quota isolation + reconnect-banner DB smoke); Plan 35-06 retired SMTP singleton + `GMAIL_APP_PASSWORD`. Verifier passed 5/5 must-haves. AUTH-30, EMAIL-26, EMAIL-27, EMAIL-28, EMAIL-32, EMAIL-33 marked Complete in REQUIREMENTS.md. Latest commits: `31db425` (welcome-email migrated to factory, Approach A), `138cfb0` (singleton + provider deleted), `6aecfbb` (env vars removed), `e7984fe` (plan-metadata).

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-06 after v1.7 kickoff)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.7 Phase 36 — Resend backend for upgraded accounts. Phase 35 fully shipped 2026-05-08. Andrew has one non-blocking manual cleanup item: delete `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` from Vercel env vars (now inert; no redeploy required).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code — IN PROGRESS (2 of 7 phases shipped)
**Phase:** 36 — Resend Backend for Upgraded Accounts — NOT STARTED. Blocked on PREREQ-03 (Andrew creates Resend account, verifies NSI domain via Namecheap DNS).
**Plan:** Phase 35 closed; Phase 36 plans TBD (will be created via `/gsd:plan-phase 36` after PREREQ-03).
**Status:** Phase 35 SHIPPED. Verifier passed 5/5. ROADMAP + REQUIREMENTS marked. SMTP path fully retired in source. Production live on Gmail REST API OAuth.
**Last activity:** 2026-05-08 — Plan 35-06 executed; Phase 35 verifier wrote 35-VERIFICATION.md (status: passed); ROADMAP/STATE/REQUIREMENTS updated to mark phase complete.

Progress (Phase 35): ███████ 7/7 plans complete (00-06 + 2 architectural fixes shipped) — ✅ DONE

⚠ **Production cutover risk now mitigated:** nsi has Gmail connected on production — booking emails are working live. Other accounts (nsi-test, nsi-rls-test, etc.) have no active customers, no impact.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [X] Day-of-Disruption Tools      (Phases 31-33, 10 plans, 53 commits, shipped 2026-05-06 — ~2 days)
v1.7 [ ] Auth + Email + Polish + Debt (Phases 34-40, 7 phases, plans TBD — in progress: Phase 34 done)
```

**Total shipped:** 6 milestones archived (v1.0–v1.6), 33 phases completed, 138+ plans, ~570 commits

## Accumulated Context

### Patterns established in v1.7 (Phase 34+)

- **Admin-client-only writes (Phase 34, Plan 01)** — `account_oauth_credentials` has no INSERT/UPDATE/DELETE RLS. All writes must use the service-role Supabase client in server-side API routes, preventing browser-side credential manipulation.
- **AES-256-GCM encrypted blob format (Phase 34, Plan 02)** — `iv:authTag:ciphertext` (all lowercase hex, 12-byte IV, 16-byte auth tag). Produced by `lib/oauth/encrypt.ts`; Phase 35 consumes via `decryptToken`.
- **Lazy env var read in encryption utils (Phase 34, Plan 02)** — `getKey()` reads `GMAIL_TOKEN_ENCRYPTION_KEY` inside the function body, not at module top level. Required for test isolation (beforeEach can modify process.env). Apply same pattern to any new env-var-gated server utility.
- **Google OAuth HTTP helpers fail-safe return (Phase 34, Plan 02)** — `fetchGoogleGrantedScopes` and `revokeGoogleRefreshToken` return `null`/`false` on any network error, never throw. Callers branch on return value.
- **GoogleOAuthButton is NSI-color-locked (Phase 34, Plan 02)** — Google brand guidelines prohibit NSI colors. Component uses raw `<button>` (not `ui/button`). DO NOT apply brand theme to this component in any future plan.
- **useSearchParams-in-Suspense pattern (Phase 34, Plans 03+)** — Any client component using `useSearchParams()` must isolate that hook in a child component wrapped in `<Suspense fallback={null}>`. Next.js 16 prerender fails with CSR bailout error otherwise. Applied in signup-form.tsx, login-form.tsx, gmail-status-panel.tsx, google-link-toast.tsx.
- **Server-action OAuth init (Phase 34, Plan 03)** — `<form action={initiateGoogleOAuthAction}><Button type="submit">` — clean progressive enhancement, no `useTransition` needed. Combined scope string is a single space-delimited string, NOT an array.
- **Partial-grant detection via tokeninfo endpoint (Phase 34, Plan 03)** — Use Google tokeninfo endpoint (authoritative) to detect whether gmail.send was actually granted. Do NOT use heuristic scope string inspection. Only persist credentials when gmail.send confirmed granted.
- **Server action cross-segment reuse (Phase 34, Plan 04)** — `connectGmailAction` defined in `app/(shell)/app/settings/gmail/_lib/actions.ts` is imported by onboarding's `connect-gmail-card.tsx`. App Router supports cross-route-segment server action imports. Do NOT duplicate linkIdentity logic.
- **Conditional unlinkIdentity (Phase 34, Plan 04)** — `disconnectGmailAction` only calls `supabase.auth.unlinkIdentity` when user has 2+ identities (RESEARCH §Pitfall 6). Google-only users keep their `auth.identities` row after disconnect — Phase 35 reads `account_oauth_credentials`, not auth.identities.
- **Disconnect revocation is best-effort (Phase 34, Plan 04)** — `revokeGoogleRefreshToken` failure is caught and logged; does NOT block the credential row deletion. The user-visible promise is "credentials gone", not "Google session revoked".
- **fetchGoogleAccessToken lazy env-var read (Phase 35, Plan 02)** — `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` read inside the function body. Same pattern as Phase 34 `getKey()`. Apply to all new env-var-gated server utilities.
- **Gmail OAuth2 SMTP explicit form (Phase 35, Plan 02)** — `createGmailOAuthClient` uses `{ host: "smtp.gmail.com", port: 465, secure: true }` NOT `service: "gmail"` — some nodemailer versions require explicit form with `type: "OAuth2"`.
- **Enforced From header in Gmail OAuth client (Phase 35, Plan 02)** — `createGmailOAuthClient` always sets `from = enforcedFrom` derived from `config.user`; `options.from` from callers is silently ignored. Gmail rejects OAuth2 sends where From != authenticated user.
- **Per-account quota isolation (Phase 35, Plan 01)** — `email_send_log.account_id` + `.eq("account_id", accountId)` filter gives each account an independent 200/day cap. All three quota helpers (`getDailySendCount`, `checkAndConsumeQuota`, `getRemainingDailyQuota`) require `accountId: string`. Vitest supabase mocks must chain `.eq().gte()` to match the new query shape.
- **Warn dedup key is per-account (Phase 35, Plan 01)** — `warnedDays` Set uses `${today}:${accountId}` key. Account A firing 80% threshold does not suppress Account B's warning.
- **getSenderForAccount fail-closed contract (Phase 35, Plan 03)** — factory never throws; every error path returns a `refusedSender` whose `.send()` resolves `{ success: false, error: "oauth_send_refused: ..." }`. Plan 04 callers branch on `result.success` only; no try/catch needed.
- **invalid_grant is the only DB-write error path (Phase 35, Plan 03)** — only Google's authoritative revocation (`error: "invalid_grant"`) triggers `UPDATE account_oauth_credentials SET status='needs_reconnect'`. All other failures (network_error, decrypt failure, etc.) refuse silently without touching the DB.
- **REFUSED_SEND_ERROR_PREFIX exported constant (Phase 35, Plan 03)** — `"oauth_send_refused"` exported from `lib/email-sender/account-sender.ts`. Plan 04 callers can match `result.error?.startsWith(REFUSED_SEND_ERROR_PREFIX)` to distinguish OAuth refusal from other send errors.
- **getSenderForAccount is the only allowed EmailClient factory (Phase 35, Plan 04)** — zero `sendEmail()` singleton calls remain in `app/`, `lib/email/`, `lib/bookings/`. Grep guard: `grep -rn "import.*sendEmail|from \"@/lib/email-sender\"" app/ lib/ | grep -v welcome-email` → 0 results. `welcome-email.ts` is the sole remaining singleton user (Phase 36 migration target).
- **OAuth refusal treated as confirmation soft-fail (Phase 35, Plan 04)** — `send-booking-emails.ts` checks `result.error?.startsWith(REFUSED_SEND_ERROR_PREFIX)` on the confirmation leg result; if true, same `confirmation_email_sent=false` flag path as `QuotaExceededError`. Booking succeeds regardless. Cancel/reschedule/reminder: refusal logged but not re-thrown (already committed); reminder re-throws so cron can count refused.
- **Nil UUID sentinel for system-level sends (Phase 35, Plan 04)** — `signup/actions.ts` and `welcome-email.ts` pass `"00000000-0000-0000-0000-000000000000"` to `checkAndConsumeQuota`. No per-account context exists at these call sites. `email-change` action fetches the real accountId from DB.
- **account-sender Vitest alias mock shares __mockSendCalls (Phase 35, Plan 04)** — `tests/__mocks__/account-sender.ts` imports from `@/lib/email-sender` (the aliased bare specifier, NOT the direct file path) so both the mock and the integration test files share the exact same module instance. vitest.config.ts alias: `find: /^@\/lib\/email-sender\/account-sender$/`.
- **Direct-Google OAuth for Gmail connect (Phase 35 deviation, commit ab02a23)** — `connectGmailAction` builds the Google auth URL ourselves and the new `/auth/gmail-connect/callback` route exchanges the code at `oauth2.googleapis.com/token` directly. **Do NOT use `supabase.auth.linkIdentity` for capturing provider tokens** — it silently drops `provider_refresh_token` under several conditions and exposes Supabase's domain on Google's `/permissions` page. `signInWithOAuth` (signup/login) keeps using `/auth/google-callback` because it needs Supabase to create `auth.users` rows. Full pivot rationale in `.planning/phases/35-per-account-gmail-oauth-send/35-DEVIATION-DIRECT-OAUTH.md`.
- **Gmail REST API, NOT SMTP, for OAuth-based send (Phase 35 deviation #2, commit cb82b6f)** — `lib/email-sender/providers/gmail-oauth.ts` POSTs to `https://gmail.googleapis.com/gmail/v1/users/me/messages/send` with a base64url-encoded RFC-822 message and `Authorization: Bearer <accessToken>`. **Do NOT try to use SMTP (`smtp.gmail.com:465` with `auth.type='OAuth2'`) when the OAuth scope is `gmail.send`** — `gmail.send` only authorizes the REST endpoint; SMTP relay requires the much broader `https://mail.google.com/` scope. The pitfall is that nodemailer's XOAUTH2 SMTP handshake silently accepts the wrong-scope token AND returns a synthetic messageId, so callers think the send succeeded — but Gmail drops every message after acceptance. Symptom: `bookings.confirmation_email_sent=true` + `email_send_log` rows logged + zero recipient delivery.
- **state cookie CSRF for direct OAuth (Phase 35 deviation)** — `connectGmailAction` writes a 32-byte random hex token into an httpOnly `gmail_connect_state` cookie (10-min maxAge); `/auth/gmail-connect/callback` verifies the cookie matches the `state` query param before exchanging the code. Cookie is deleted after consumption.
- **Hosted Supabase migrations applied via MCP (Phase 35 deviation)** — `account_oauth_credentials` table and `email_send_log.account_id` column were applied to hosted Supabase via `mcp__claude_ai_Supabase__apply_migration` during the 35-05 verification session. Local `supabase/config.toml` flags (e.g., `enable_manual_linking`) only apply to local Supabase — the hosted dashboard equivalent must be configured separately or skipped if the new direct-OAuth flow doesn't need it.

### Patterns established / locked through v1.6

See PROJECT.md Key Decisions for full table. Key ones relevant to v1.7:

- **Refuse-send fail-closed (Phase 31)** — all 7 email senders go through `checkAndConsumeQuota()`; v1.1 carve-out removed. `getRemainingDailyQuota()` for batch pre-flights.
- **Vitest `resolve.alias` array/regex exact-match** — `find: /^@\/lib\/email-sender$/` prevents alias prefix-bleed. New provider sub-paths get their own alias entries (LD-14).
- **Two-step deploy protocol (CP-03)** — strangler-fig pattern for cutover; SMTP removal is a separate deploy after production verification (LD-06).
- **`slot-picker.tsx` kept on disk** — Plan 30-01 Rule 4; explicit `knip` ignore list required (LD-09).
- **Deploy-and-eyeball as canonical production gate** — 6th consecutive milestone, formally the operating model.

### Blockers / prereqs for v1.7

- **PREREQ-01** (blocks Phase 34 live testing): Google Cloud Console OAuth setup + app verification (3-5 day lead time — start immediately). Also: add `https://{your-domain}/auth/google-callback` to Authorized Redirect URIs.
- **PREREQ-02** (blocks Phase 34 live testing): Supabase Google provider toggle + credential paste.
- **PREREQ-03** (blocks Phase 36): Resend account + NSI domain DNS verification via Namecheap.
- **PREREQ-04** (blocks Phases 34, 35, 36): Vercel env vars — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY`, `RESEND_API_KEY`.
- **CALLBACK-URL** (blocks Phase 34 live testing): `/auth/google-callback` must be registered in both Google Cloud Console (Authorized Redirect URIs) AND Supabase Dashboard (Additional Redirect URLs). Preview branch wildcard: `https://*-{vercel-team}.vercel.app/auth/google-callback`.

### Open tech debt (carried into v1.7)

- `slot-picker.tsx` on disk per Andrew Option A (Phase 40 audit will surface it; explicit knip ignore required).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — uncommitted.
- `tests/bookings-api.test.ts` one failing test (fixture mismatch); 30/31 test files green.

## Session Continuity

**Last session:** 2026-05-08 (orchestrator) — Plan 35-05 verification gates passed (architectural quota isolation via `.eq("account_id", accountId)` in `quota-guard.ts` + DB-flip reconnect-banner smoke); Plan 35-06 executed (welcome-email migrated to `getSenderForAccount` Approach A, SMTP singleton + `providers/gmail.ts` deleted, env vars removed); verifier ran and passed 5/5. Phase 35 fully shipped.

**Stopped at:** Phase 35 closed. Latest commit will be `docs(35): complete per-account-gmail-oauth-send phase` after orchestrator commits the metadata bundle. Phase 36 not yet started — blocked on PREREQ-03 (Andrew Resend account + NSI domain DNS verification).

## ▶ Next session — start here

**Phase 35 is shipped.** Two paths forward:

### Path A: Phase 36 (Resend backend) — preferred next phase

Blocker: **PREREQ-03** — Andrew must:
1. Create Resend account (~$20/month Pro tier)
2. Add NSI domain DNS records (SPF, DKIM, DMARC) in Namecheap
3. Verify domain in Resend dashboard (must show "Verified" for SPF + DKIM)
4. Capture API key
5. Add `RESEND_API_KEY` to Vercel env vars (Preview + Production)

Once PREREQ-03 is done, run `/gsd:discuss-phase 36` to gather context, then `/gsd:plan-phase 36` to create the plans.

### Path B: Phase 38 (Magic-link login) or Phase 39 (BOOKER polish) — work in parallel

Both have zero backend dependencies on Phase 36 — they can be planned and executed any time. Phase 38 needs no prereqs. Phase 39 is pure UI.

### Andrew manual cleanup (non-blocking; can be done at any time)

Delete from Vercel → Settings → Environment Variables:
1. `GMAIL_USER` (Preview + Production)
2. `GMAIL_APP_PASSWORD` (Preview + Production)
3. `GMAIL_FROM_NAME` (Preview + Production)
4. (Optional) Revoke App Password in Google Account → Security → 2-Step Verification → App passwords → "calendar-app"

These vars are now inert — code that read them has been deleted. No redeploy needed after cleanup.

### Phase 36 prep notes (when PREREQ-03 done)

welcome-email already has `accountId` threading in place (Plan 35-06 Approach A). Phase 36's design is to add a Resend provider implementation behind `getSenderForAccount`, keyed off `accounts.email_provider = 'resend'` (column does not yet exist — Phase 36 adds it).

### What's already in place — don't re-do

- ✓ Production deploy of Plans 00-04 + both architectural fixes (commit `cb82b6f` on `main`)
- ✓ Hosted Supabase migrations applied (`account_oauth_credentials` table, `email_send_log.account_id` column)
- ✓ Vercel env vars set (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY`)
- ✓ GCP redirect URIs registered: `localhost:3000`, `booking.nsintegrations.com`, the preview vercel.app, `/auth/gmail-connect/callback` paths for each
- ✓ Supabase URL allowlist includes preview + production domains
- ✓ nsi has a `connected` row in `account_oauth_credentials` with `gmail.send` scope
- ✓ Real production booking proven via Gmail REST API (booking id `592eb13e-3037-4baf-8c81-c420a8e87a35` at 01:51 UTC sent emails successfully after the SMTP→REST API fix)

### Files of record (post-pivots)

- `lib/email-sender/providers/gmail-oauth.ts` — Gmail REST API provider (commit `cb82b6f`)
- `app/auth/gmail-connect/callback/route.ts` — direct-Google OAuth callback (commit `ab02a23`)
- `app/(shell)/app/settings/gmail/_lib/actions.ts` — direct-OAuth `connectGmailAction` (commit `ab02a23`)
- `app/(shell)/app/settings/gmail/_components/gmail-status-panel.tsx` — error code → message map; `?connected=1` success banner (commit `ab02a23`)
- `app/auth/google-callback/route.ts` — preserved for `signInWithOAuth` signup/login flow only; diag instrumentation removed (commit `ab02a23`)
- `tests/email-sender-gmail-oauth.test.ts` — REST API fetch-mocked tests, 8/8 pass (commit `cb82b6f`)
- `.planning/phases/35-per-account-gmail-oauth-send/35-DEVIATION-DIRECT-OAUTH.md` — full deviation post-mortem (this is the canonical Phase 35 story)

**Files of record:**
- `.planning/ROADMAP.md` — v1.7 Phases 34-40 defined; v1.6 collapsed to `<details>`
- `.planning/STATE.md` — this file
- `.planning/REQUIREMENTS.md` — all 30 v1.7 requirements with phase traceability filled
- `.planning/phases/35-per-account-gmail-oauth-send/35-DEVIATION-DIRECT-OAUTH.md` — **READ FIRST** if returning to Phase 35 work after a break. Captures the linkIdentity → direct-OAuth pivot, why, and what's now on production.
- `.planning/phases/35-per-account-gmail-oauth-send/35-00..04-SUMMARY.md` — wave-by-wave plan completion records
- `.planning/phases/34-google-oauth-signup-and-credential-capture/34-01..04-SUMMARY.md` — Phase 34 plan completion records
- `app/auth/gmail-connect/callback/route.ts` — **NEW (commit ab02a23)** direct-Google OAuth callback for the connect flow
- `app/(shell)/app/settings/gmail/_lib/actions.ts` — **REWRITTEN (commit ab02a23)** — `connectGmailAction` builds Google auth URL directly, no `linkIdentity`
- `lib/email-sender/account-sender.ts` — getSenderForAccount factory + REFUSED_SEND_ERROR_PREFIX (3e1ba69)
- `lib/oauth/encrypt.ts` — AES-256-GCM encrypt/decrypt/generateKey (e09f019)
- `lib/oauth/google.ts` — fetchGoogleGrantedScopes, revokeGoogleRefreshToken, hasGmailSendScope (f639f0c)
- `components/google-oauth-button.tsx` — branded Google button (e427e52)
- `app/(auth)/app/signup/actions.ts` — signUpAction + initiateGoogleOAuthAction (e3a7dfb)
- `app/(auth)/app/login/actions.ts` — loginAction + initiateGoogleOAuthAction (e3a7dfb)
- `app/(auth)/app/signup/signup-form.tsx` — GoogleOAuthButton first + divider + error alerts (c816e8c)
- `app/(auth)/app/login/login-form.tsx` — GoogleOAuthButton first + divider + error alerts (c816e8c)
- `app/auth/google-callback/route.ts` — PKCE exchange + token capture + routing (66f47f0)
- `app/(shell)/app/settings/gmail/_lib/actions.ts` — connectGmailAction + disconnectGmailAction (c9f2312)
- `app/(shell)/app/settings/gmail/page.tsx` — settings Gmail page (c9f2312)
- `app/onboarding/connect-gmail/page.tsx` — optional connect-gmail onboarding step (f0da49e)
- `app/(shell)/app/_components/google-link-toast.tsx` — post-link banner toast (03c0ebd)
