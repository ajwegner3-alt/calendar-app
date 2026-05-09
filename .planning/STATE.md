# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-09 — **Phase 40 Plan 08 COMPLETE.** v1.7 final production QA against `https://booking.nsintegrations.com` is **all PASS** — Phase 38 A-D (magic-link auth: enumeration safety + 5/hr rate-limit + Supabase ~60s cooldown + end-to-end delivery), Phase 39 A-C (BOOKER polish: 220ms fade+rise + skeleton + reduced-motion), and the V15-MP-05 Turnstile lifecycle + RHF-persistence bonus regression. Test A enumeration safety verified two ways: UI parity (Andrew live) plus Supabase MCP confirmation that zero `auth.users` rows and zero `auth.one_time_tokens` rows were created for the unknown email — only `ajwegner3@gmail.com` received a token. Locked record at `40-V17-FINAL-QA.md` (commit `c42529d`). PROCEED checked. **Plan 09 (milestone close) is the only remaining checkpoint plan in Phase 40 / v1.7.** Lockfile drift caveat from Plan 07 still open (CI's `npm ci` red until lockfile regenerated under Node 20) — flagged for Andrew, not blocking milestone close.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-06 after v1.7 kickoff)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.7 Phase 40 (dead-code audit) — **Plans 01-08 COMPLETE** (baseline + decisions locked + 3 unused deps removed + duplicate-exports no-op + 22 unused-export REMOVEs + 1 unused-file deleted + knip CI gate + v1.7 final QA all PASS). Wave 9 (Plan 09: milestone close, checkpoint plan) is the final v1.7 task. **Side-issue carried over from Plan 07:** pre-existing lockfile drift requires regenerating `package-lock.json` under Node 20 / npm 10 to make CI green — Andrew's call; non-blocking.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code — IN PROGRESS (Phase 40 in flight; Plans 01-08 done; Plan 09 = milestone close checkpoint)
**Phase:** 40 — Dead-code audit — Substantive work complete + production QA all PASS; Plan 09 (milestone close) is the only remaining task
**Plan:** 8 of 9 plans complete. Final plan (40-09) runs `/gsd:complete-milestone` under Andrew sign-off.
**Status:** Plans 40-01 through 40-08 complete. 80 baseline findings finalized to 27 REMOVE / 53 KEEP. All 4 removal commits landed (deps `14fb48c`, duplicates n/a, exports `1cbb273`, files `2a1b665`). CI gate `d94ca07` committed; first run RED at `npm ci` due to lockfile drift — surfaced as a separate, non-blocking chore. v1.7 final production QA all PASS (commit `c42529d`): magic-link enumeration safety verified two-ways (UI parity live + Supabase MCP confirmed zero `auth.users` / `one_time_tokens` rows for unknown email); 5/hr rate-limit silent throttle; Supabase ~60s inner cooldown; end-to-end magic-link delivery + Site URL correctness; 220ms fade+rise + CLS = 0; static skeleton on desktop + mobile; prefers-reduced-motion suppression; V15-MP-05 Turnstile lifecycle lock + RHF persistence on same-date re-pick. Andrew signed off PROCEED on `40-V17-FINAL-QA.md`. Remaining: Plan 09 (milestone close).
**Last activity:** 2026-05-09 — v1.7 final production QA all PASS committed as `docs(40-08): v1.7 final QA results — all PASS` (`c42529d`, pushed to `origin/main`). All 8 regression rows + V15-MP-05 bonus row marked PASS in `40-V17-FINAL-QA.md`. Andrew signature + PROCEED checkbox locked. Test A enumeration-safety verified two ways: UI parity (Andrew live on production) plus Supabase MCP confirmation — zero phantom `auth.users` rows, zero `one_time_tokens` for the unknown email; only `ajwegner3@gmail.com` received a token in the QA window. Plan 09 is the only remaining v1.7 task.

Progress (Phase 40): ████████ 8/9 plans complete (Plan 09 = milestone close)

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
v1.7 [ ] Auth + Email + Polish + Debt (Phases 34-40, 7 phases — in progress: Phases 34, 35, 36, 37, 38, 39 shipped)
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
- **Resend HTTP provider lazy RESEND_API_KEY read (Phase 36, Plan 02)** — `RESEND_API_KEY` read inside `send()` body, not at module top level. Same pattern as Phase 34 `getKey()` and Phase 35 `fetchGoogleAccessToken`. Apply to all new env-var-gated providers.
- **Resend snake_case wire fields (Phase 36, Plan 02)** — Resend's REST API requires `reply_to` (not `replyTo`) and `content_type` on attachments (not `contentType`). Resend silently ignores unknown fields so a camelCase typo silently drops the feature. Always verify against Resend API docs.
- **RESEND_REFUSED_SEND_ERROR_PREFIX exported constant (Phase 36, Plan 02)** — `"resend_send_refused"` exported from `lib/email-sender/providers/resend.ts`. Plan 03 orchestrator dual-prefix fix uses `isRefusedSend(error)` helper (in account-sender mock) to check both `oauth_send_refused:` and `resend_send_refused:` prefixes.
- **resend-provider vitest alias registered pre-emptively (Phase 36, Plan 02)** — `find: /^@\/lib\/email-sender\/providers\/resend$/` → `tests/__mocks__/resend-provider.ts`. Dormant until Plan 03 wires `getSenderForAccount` to import `createResendClient`. Follows LD-14 exact-regex pattern.
- **Resend routing in getSenderForAccount (Phase 36, Plan 03)** — `accounts.email_provider='resend'` → `createResendClient()`; `resend_status='suspended'` → refused before any credential lookup; `'gmail'` (default) → existing OAuth path. CONTEXT decision: Resend wins even when `account_oauth_credentials` row present (flip back to `'gmail'` restores OAuth path without re-OAuth). Activation is one SQL UPDATE per account.
- **OQ-1 centralized in checkAndConsumeQuota (Phase 36, Plan 03)** — Resend cap bypass is inside `checkAndConsumeQuota` via an internal `accounts.email_provider` SELECT — zero leaf-caller changes. `maybeSingle()` returns `null` for nil-UUID sentinel → falls through to Gmail path (correct for system-level sends). All test mocks for `checkAndConsumeQuota` must add `maybeSingle: () => Promise.resolve({ data: null, error: null })` to the `.eq()` chain.
- **isRefusedSend shared helper (Phase 36, Plan 03)** — `export function isRefusedSend(error?: string)` in `lib/email-sender/account-sender.ts` covers both `oauth_send_refused:` and `resend_send_refused:` prefixes. Use `isRefusedSend(error)` everywhere — never `startsWith(REFUSED_SEND_ERROR_PREFIX)` directly. Future providers only need to update this one helper. Mock in `tests/__mocks__/account-sender.ts` mirrors the real implementation.
- **Soft Resend abuse threshold (Phase 36, Plan 03)** — `RESEND_ABUSE_WARN_THRESHOLD = 5000`; `warnIfResendAbuseThresholdCrossed(accountId)` fire-and-forget; emits `console.warn("[RESEND_ABUSE_THRESHOLD_CROSSED]", {...})`. Never blocks. Per-account `${today}:${accountId}` dedup pattern (matches Phase 35 LD-12 precedent). Hard cap deferred until abuse observed in production.
- **requestUpgradeAction uses createResendClient() directly — never getSenderForAccount() (Phase 37, Plan 02)** — The upgrade-request send MUST bypass the per-account quota guard (LD-05 bootstrap: works at cap-hit moment). `getSenderForAccount(accountId)` routes through `checkAndConsumeQuota()` and returns a refused sender when the account is at cap. Use `createResendClient(config)` directly for any send that must work regardless of account quota state.
- **send-then-write DB ordering for timestamp updates (Phase 37, Plan 02)** — `last_upgrade_request_at` written to DB ONLY after `resendClient.send()` returns `{ success: true }`. A send failure leaves the column null so the user can retry immediately. Any new timestamp-gated rate-limit feature must follow this ordering to avoid locking users out when sends fail.
- **Server-rendered locked-out countdown (Phase 37, Plan 03)** — Settings pages compute `lockedOut` (boolean) + `timeRemaining` (string | null) server-side and pass as props to the client form component. The client never recalculates or polls. No `setInterval`/`setTimeout`. User reloads the page to see an updated countdown. This avoids hydration mismatches and timer cleanup complexity. Apply to any future rate-limit UI where server-side computation is sufficient.
- **getClaims() as the settings page auth pattern (Phase 37, Plan 03)** — All settings pages in `app/(shell)/app/settings/*/page.tsx` use `supabase.auth.getClaims()` (NOT `getUser()`). Each page handles its own auth guard (no shared settings layout). `redirect("/app/login")` on no claims; `redirect("/app/unlinked")` on no account row.
- **account.id not forwarded to client form components (Phase 37, Plan 03)** — Server actions re-derive the account from the session via RLS-scoped query. Client props must not expose account IDs that a user could substitute. Pattern: pass only display values and gate flags (e.g., lockedOut, timeRemaining) as props.
- **invocationCallOrder Vitest assertion for async ordering (Phase 37, Plan 02)** — `sendMock.mock.invocationCallOrder[0] < updateMock.mock.invocationCallOrder[0]` proves temporal ordering across async calls without artificial ordering constraints. Use this pattern for any test that must assert "A happened before B" where both A and B are vi.fn() mocks.
- **Core/wrapper split with three injected clients (Phase 37, Plan 02)** — `requestUpgradeCore(args, { rlsClient, adminClient, resendClient })` extends the reminders two-client pattern by adding `resendClient: EmailClient` as a third injection point. Tests pass a structural `{ provider: "resend", send: vi.fn(...) }` mock. The wrapper builds all three real clients then delegates. Dynamic `revalidatePath` import in wrapper ensures core never touches `next/cache`.
- **Silent rate-limit return for enumeration-sensitive endpoints (Phase 38, Plan 01)** — `requestMagicLinkAction` returns `{ success: true }` (NOT `{ formError }`) on rate-limit miss. This intentionally diverges from `requestPasswordReset` and `loginAction`, which surface `formError` on throttle. CONTEXT lock: throttle status is itself enumeration-sensitive on magic-link (an attacker probing 6 requests for a target email could distinguish "real send threshold reached" from "no such account"). Apply this pattern to any future passwordless / OTP-style auth endpoint.
- **5xx-only formError gating for enumeration-safe Supabase actions (Phase 38, Plan 01)** — `requestMagicLinkAction` only surfaces `{ formError }` when `error.status >= 500 || !error.status`. 4xx (including the canonical "unknown email" 400 from `signInWithOtp` with `shouldCreateUser:false`) always logged + swallowed. Mirrors `loginAction` LD pattern (auth-js `error.code` is unreliable; gate on `status` only).
- **shouldCreateUser:false is the login-only switch (Phase 38, Plan 01)** — `signInWithOtp` defaults to `shouldCreateUser:true` which silently auto-registers any unknown email. CRITICAL: every magic-link login call site must pass `{ options: { shouldCreateUser: false } }`. The unknown-email error returned in this mode is the enumeration leak — handle in the action body via 5xx-only gating, never surface to the client.
- **magicLink rate-limit key shape (Phase 38, Plan 01)** — Key `auth:magicLink:${ip}:${email}` does NOT collide with `auth:forgotPassword:${ip}:${email}` because `checkAuthRateLimit` namespaces by route key. Multi-route IP+email scoping is safe — adding new auth routes that reuse the IP+email identifier shape requires zero deduplication work.
- **Radix Tabs unmount-resets-state (Phase 38, Plan 02)** — Radix's default `<TabsContent>` unmounts inactive panels. Local `useState` and `useActionState` inside an inactive panel are discarded; remounting starts fresh. Use this for free state cleanup on tab switch — no `key` prop needed. Confirmed in `app/(auth)/app/login/login-form.tsx` `MagicLinkTabContent` where switching to Password and back resets both `useActionState(requestMagicLinkAction)` and the local `submittedEmail` capture.
- **Distinct-IDs-per-tab pattern (Phase 38, Plan 02)** — When the same logical input (e.g., email) appears in multiple `TabsContent` panels, give each a unique DOM `id` (`id="email-password"`, `id="email-magic"`) with matching `<Label htmlFor>`. Defends against Radix configurations that keep both panels mounted simultaneously and is correct HTML regardless. RESEARCH §Pitfall 5.
- **Cooldown-on-mount for resend components (Phase 38, Plan 02)** — When the parent only mounts a resend component AFTER an initial successful send, start `useState(cooldown)` at the cooldown value, not 0. Distinct from `resend-verification-button.tsx` which starts at 0 because that component lives on a standalone page where a user may land via email link without having just submitted. `MagicLinkSuccess` starts at 30; `ResendVerificationButton` starts at 0 — both correct for their mount conditions.
- **Two useActionState hooks isolated by inner component (Phase 38, Plan 02)** — When one form area needs two independent server actions (here: `loginAction` for the Password tab + `requestMagicLinkAction` for the Magic-link tab), extract the second into a sibling/inner component (`MagicLinkTabContent`) rather than calling both `useActionState` hooks in the same parent. The inner component owns one hook + its own local state, and tab switching cleanly unmounts/remounts the entire isolated tree.
- **Four-way enumeration-safety ambiguity invariant (Phase 38, Plan 03)** — For any magic-link / passwordless / OTP-style submit, the user-visible response is byte-identical across FOUR distinct backend states: (a) unknown email, (b) our 5/hour rate-limit bucket exhausted, (c) Supabase's internal per-email OTP cooldown active (~60s), and (d) genuinely successful send. This is the working invariant for AUTH-29 — not a coincidence. It is a direct consequence of the 5xx-only formError gate in `requestMagicLinkAction` (LD pattern from Plan 38-01) which swallows ALL 4xx errors identically. Any future passwordless auth endpoint MUST preserve the 5xx-only gate to maintain this property; surfacing 4xx errors to the user breaks the invariant.
- **Supabase internal per-email OTP cooldown (~60s) is a second throttle layer (Phase 38, Plan 03)** — Supabase's auth service enforces its own ~60s cooldown per email address on top of any application-level rate-limit. This was observed live on production: 5 hits to our `auth:magicLink:${ip}:${email}` bucket across 23 minutes resulted in only 2 actual email deliveries because Supabase's cooldown fired faster than our 5/hour bucket on rapid retries. Treat this as feature, not bug — it strengthens AUTH-29's enumeration-safety contract. Every `signInWithOtp` call site must tolerate this and rely on the 5xx-only formError gate to keep it invisible. The error-swallow pattern from `app/(auth)/app/forgot-password/actions.ts` is the canonical model.
- **Hosted Supabase Site URL is the source-of-truth for `{{ .SiteURL }}` (Phase 38, Plan 03 deviation)** — When introducing a hosted Supabase email template that interpolates `{{ .SiteURL }}`, the Site URL field at Authentication → URL Configuration MUST be set to the production domain on the hosted dashboard. This is a DIFFERENT field from the Redirect URLs allowlist (which Phase 34 OAuth setup already populated). Local `supabase/config.toml` `site_url` is irrelevant to hosted email rendering. Surfaced live during Phase 38 verification: hosted Site URL was on default `http://localhost:3000` even though the redirect URL allowlist was correctly populated for the production domain — magic-link emails arrived with `localhost:3000` CTAs. Future phases that ship hosted email templates with `{{ .SiteURL }}` must include "Verify Site URL field is set to production domain" in their USER-SETUP checklist, AND should include "click the link in the actual email" as a verification step (not just dashboard-field inspection — the bug only manifests in the live email body, not in the dashboard UI itself).
- **Knip CI gate workflow shape (Phase 40, Plan 07)** — `.github/workflows/knip.yml` is the repo's first GitHub Actions workflow. Triggers on `pull_request` to main + `push` to main. Steps: `actions/checkout@v4` → `actions/setup-node@v4` (node-version `'20'` matching `engines.node`, `cache: 'npm'` for lockfile-keyed cache) → `npm ci` (strict-install matching Vercel's posture) → `npm run knip:ci` (which is `knip --no-progress --reporter compact` — exits non-zero on any new dead code). Single job, single check; no matrix, no `working-directory`. Future Actions workflows (type-check, vitest, build) should follow this same node/cache shape.
- **CI lockfile-strict drift surfaced by `npm ci` (Phase 40, Plan 07 latent issue)** — Plan 07's CI gate uses `npm ci` (strict-install: lockfile must satisfy package.json verbatim, fails on drift). First run on main failed at this step BEFORE knip ran, demanding `@emnapi/runtime@1.10.0`, `@emnapi/core@1.10.0`/`1.9.2`, `@emnapi/runtime@1.9.2`, `typescript@5.9.3` in lockfile — none present. Root cause: lockfile generated locally under Node 24 / npm 11 resolves transitive optional/peer deps differently from CI's Node 20 / npm 10.8.2. The lockfile was previously fine because Vercel deploys (production) use a more permissive install mode. The strict gate exposes this as a fail-fast signal. Resolution: regenerate `package-lock.json` from a Node 20 / npm 10 environment (`rm package-lock.json node_modules && npm install`) and commit. Pattern for future CI gates: any new strict-install workflow may surface similar latent drift; use `npm ci`'s error output to identify the missing-version set, then regenerate under matching Node major.

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
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` + `23-VERIFICATION.md` + `33-CONTEXT.md` working-tree drift — uncommitted.
- **Vitest watermark: 2 failing tests** (corrected by Plan 40-03 from previously-stated 1): `tests/bookings-api.test.ts > (a) 201 returns bookingId...` AND `tests/slots-api.test.ts > returns flat slots array...`. Both fail on pre-Plan-40-03 state (verified via temp `git checkout 6b1c3b0 -- package.json package-lock.json` rollback test). Both are date-sensitive fixture failures (test expects Monday 9-17 window seeded data; actual run-time may be a Friday triggering min-notice filter to 0 slots / 0 emails). 40/42 test files green.

## Session Continuity

**Last session:** 2026-05-09 — Phase 40 Plan 06 executed end-to-end. Read `40-KNIP-DECISIONS.md` `### Unused Files (Plan 06 target)` (1 entry) and `## Final KEEP list` (53 entries across files/deps/exports sub-sections). Final pre-flight grep on `welcome-card` confirmed zero source-code importers in `app/`, `lib/`, `tests/` — only `.planning/` documentation refs (historical). `git rm components/welcome-card.tsx`; SQL safety verified (no `supabase/migrations/` files staged); `npx tsc --noEmit` 42 lines (unchanged baseline). Synced `knip.json`: added `components/ui/**` to `ignore` (single glob covers all 42 shadcn/ui primitives), created `ignoreDependencies` with 5 entries (shadcn, tw-animate-css, supabase, tailwindcss, postcss-load-config). **Mid-flight pivot:** initially attempted `ignoreExportsUsedInFile` as file-keyed object per plan instructions; knip schema rejected with exit code 2 (knip 6.x only supports boolean OR export-type-keyed object). Pivoted to per-symbol `@public` JSDoc tags — knip's officially-supported locality-preserving suppression mechanism (PUBLIC_TAG = '@public' per `node_modules/knip/dist/constants.js:17`). Added 6 tags at: `lib/oauth/encrypt.ts:94 generateKey`, `lib/email-sender/types.ts` (EmailAttachment + EmailProvider + EmailClientConfig), `pushback-dialog-provider.tsx:44 usePushbackDialog`, `event-types/_lib/schema.ts:31 customQuestionSchema`. **`lib/email-sender/index.ts` kept as-is** — knip does not flag it (the `import "server-only"` directive marks it as side-effect file); test imports of bare specifier are fully intercepted by vitest alias regex; deletion would have been a no-op cosmetic change. All 7 changes landed atomically in `chore(40): remove unused files` (commit `2a1b665`). Pushed to `origin/main` (`8ec7b4a..2a1b665`). `npx knip` exits 0 across all 4 categories (2 informational hints remain — slot-picker + tests/setup.ts policy locks). Three pre-existing-drift VERIFICATION/CONTEXT files left untouched per plan instruction. DECISIONS.md extended with `(suppressed via: ...)` documentation per KEEP residue.

**Stopped at:** Plan 40-06 complete (1 file deleted; knip.json fully synced; 6 `@public` JSDoc tags added; npx knip exits 0). Plan 07 (Wave 7 — knip CI gate via `.github/workflows/knip.yml`) is the next batch.

**Resume file:** None — `/gsd:execute-phase 40` resumes from Plan 07.

## ▶ Next session — start here

**Phase 40 Plans 01 + 02 + 03 + 04 + 05 + 06 COMPLETE.** 80 findings finalized to 27 REMOVE / 53 KEEP via Andrew-delegated authority. All 4 substantive removal commits landed: deps `14fb48c` (3 items), duplicates n/a (Plan 04 no-op), exports `1cbb273` (22 items / 138 lines), files `2a1b665` (1 item / 64 source lines + knip.json sync + 6 `@public` JSDoc tags). Codebase is now knip-clean: `npx knip` exits 0 across all 4 categories. `40-KNIP-DECISIONS.md` remains the locked contract; KEEP residue 100% suppressed (no items punted to Plan 07).

### Path A: Resume at Plan 07 (knip CI gate)

1. Run `/gsd:execute-phase 40` — Plan 07 (CI gate) executes next: create `.github/workflows/knip.yml` running `npx knip` on PR. Decide exit-code policy: fail PR on any unused-files/exports/deps. Consider `--no-config-hints` flag to silence the 2 known informational hints (slot-picker ignore + tests/setup.ts entry, both defensive policy locks). May add `npm run knip` script alias to `package.json` for local dev convenience.
2. Final v1.7 manual QA pass (Phase 38 A-D + Phase 39 A-C regressions) closes the milestone after Plan 07 lands and Vercel deploys green.

**Final-decision summary (per `40-KNIP-DECISIONS.md`):**
- **27 REMOVE landed: 3 deps (Plan 03) + 22 exports (Plan 05) + 1 file (Plan 06) + 0 duplicates (Plan 04 no-op). Total executed: 26/27 (Plan 04's "0" target is satisfied by knip's zero-duplicate baseline.)**
- **53 KEEP — all suppressed:** 5 deps in `ignoreDependencies` array (Plan 06), 42 shadcn/ui primitives covered by `components/ui/**` glob in `ignore` (Plan 06), 6 module-internal-use exports tagged `@public` at export site (Plan 06: generateKey + 3 type-graph nodes + usePushbackDialog + customQuestionSchema). `lib/email-sender/index.ts` not flagged by knip; kept as documentation marker.

**Recommended next command:** `/gsd:execute-phase 40` — Plan 07 (knip CI gate) starts immediately.

### Path B: Pause v1.7 and do something else

Phase 40 is optional — current production state is fully shippable. Decide based on whether dead-code surgical removal and final QA are worth the time investment now vs. moving to v1.8 work.

### PREREQ-03 — still required for Phase 36 live activation

Andrew must (when ready):
1. Create Resend account (~$20/month Pro tier)
2. Add NSI domain DNS records (SPF, DKIM, DMARC) in Namecheap
3. Verify domain in Resend dashboard (must show "Verified" for SPF + DKIM)
4. Capture API key
5. Add `RESEND_API_KEY` to Vercel env vars (Preview + Production)
6. Apply migration `20260507120000_phase36_resend_provider.sql` to hosted Supabase via `mcp__claude_ai_Supabase__apply_migration`

Full activation guide: `FUTURE_DIRECTIONS.md` Phase 36 section.

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
- `lib/email-sender/providers/resend.ts` — **NEW (Plan 36-02, commit 0d4a1a4)** Resend HTTP provider; createResendClient + RESEND_REFUSED_SEND_ERROR_PREFIX
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
