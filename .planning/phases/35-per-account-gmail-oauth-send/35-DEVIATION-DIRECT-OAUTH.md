---
phase: 35-per-account-gmail-oauth-send
type: deviation-postmortem
created: 2026-05-08
authors: orchestrator + 3 parallel investigator agents
---

# Phase 35 Deviation: Direct-Google OAuth replaces Supabase linkIdentity for Gmail Connect

## TL;DR

The connect-Gmail flow that Phase 34 built around `supabase.auth.linkIdentity()` proved unreliable in practice for capturing `provider_refresh_token`. After ~3 hours of preview-deploy debugging during Plan 35-05, we abandoned the linkIdentity path and built a **parallel direct-Google OAuth flow** at `/auth/gmail-connect/callback`. Andrew opted to ship straight to production rather than continue preview iteration. The signup/login flow (`signInWithOAuth`) keeps using the existing `/auth/google-callback` because it needs Supabase to create the auth.users row.

**The pivot commit:** `ab02a23` — "feat(35): replace linkIdentity-based Gmail connect with direct Google OAuth"

## Symptom progression

1. Andrew clicks "Connect Gmail" on `/app/settings/gmail` (preview deploy).
2. Supabase auth log records identity_already_exists (422) on retries — but on **successful** retries, no row appears in `account_oauth_credentials` AND no entry appears in user's `myaccount.google.com/permissions`.
3. The inverted correlation (success → no Google permission entry; failure → Google permission entry) was the key signal: "successful" Supabase flows weren't actually completing OAuth at Google's level.
4. Three parallel investigator agents converged on the same root-cause: `linkIdentity` does NOT reliably surface `session.provider_refresh_token` to the callback handler under several conditions (cached Google grants, queryParams not being forwarded, Supabase's own callback short-circuiting before token capture).

## Root causes confirmed by investigation

1. **Google issues `refresh_token` only on FIRST consent unless `prompt=consent` reaches Google verbatim.** Supabase's identity-link OAuth proxy may or may not forward `queryParams: { access_type: 'offline', prompt: 'consent' }` faithfully. We have circumstantial evidence it sometimes drops them.
2. **Supabase's `linkIdentity` flow registers the OAuth client as Supabase's domain, not ours.** This is why "NSI Calendar" never appeared in Andrew's Google permissions list — Google considered Supabase the relying party.
3. **Auth state corruption from manual cleanup.** During debugging we deleted orphaned `auth.identities` rows directly via SQL, but `auth.users.raw_app_meta_data.providers` still listed `"google"`. Subsequent linkIdentity attempts then 422'd with "Identity is already linked" even though no identity row existed. (Repaired via SQL update before the rewrite.)
4. **Origin resolution in server actions.** Vercel server-action POSTs sometimes lack the `Origin` header, causing the original `connectGmailAction` to fall through to `http://localhost:3000` as the redirectTo. This caused at least one round of OAuth flows to land on dev-server localhost (which intercepted the callback while the Next.js dev server was still running on port 3000) instead of Vercel.

## What was tried before the rewrite

| # | Action | Outcome |
|---|--------|---------|
| 1 | Apply Phase 34 + 35 migrations to hosted Supabase via MCP | Tables/columns now exist; `account_oauth_credentials` still empty after attempts |
| 2 | Fix origin fallback to use `x-forwarded-host` / `VERCEL_URL` (commit 9c8146e) | Redirects now land on preview, not localhost |
| 3 | Add Vercel preview URL to GCP redirect URIs | OAuth flow no longer rejected at Google |
| 4 | Add Vercel preview URL pattern to Supabase redirect URL allowlist | Supabase honors our redirectTo |
| 5 | Kill the running Next.js dev server on port 3000 | Stops localhost from intercepting callbacks |
| 6 | Delete orphan `auth.identities` rows manually 3× | Each cleanup unblocked the next attempt but didn't fix the root issue |
| 7 | Add diag logging to route handler (commits a748a8e + ad079f1) | Vercel log streaming proved unreliable for surfacing console.log |
| 8 | Add `_oauth_debug` table for SQL-readable diagnostics (commit 10febde) | Table never received a write — confirming the persist branch wasn't being reached |
| 9 | Spawn 3 parallel investigator agents | Converged on architectural recommendation: bypass Supabase identity-linking |

## The new architecture

**Direct-Google OAuth flow for the Gmail connect path:**

```
[/app/settings/gmail Connect button]
  → connectGmailAction (server action)
    - Verifies caller is authenticated via Supabase
    - Generates random state token, stores in httpOnly cookie
    - redirect() to https://accounts.google.com/o/oauth2/v2/auth
        ?client_id=<GOOGLE_CLIENT_ID>
        &redirect_uri=<origin>/auth/gmail-connect/callback
        &response_type=code
        &scope=openid+email+profile+https://www.googleapis.com/auth/gmail.send
        &access_type=offline
        &prompt=consent
        &state=<csrf>
        &include_granted_scopes=true

  → User consents at Google

  → GET /auth/gmail-connect/callback?code=...&state=...
    - Verify state cookie matches state param
    - Verify Supabase session is authenticated (read user_id from claims)
    - POST to https://oauth2.googleapis.com/token directly with our client_id/secret
    - Receive { access_token, refresh_token, scope, expires_in }
    - Verify gmail.send is in granted scopes (via tokeninfo)
    - encryptToken(refresh_token) and upsert to account_oauth_credentials
    - redirect to /app/settings/gmail?connected=1

  → Settings panel re-reads account_oauth_credentials and shows "Connected"
```

**The callback owns the OAuth surface end-to-end.** No Supabase identity-link involvement. No `auth.identities` writes. The user's existing Supabase email/password auth is preserved unchanged — we just persist a sibling Gmail credential keyed to the same user_id.

## Files added / modified in commit `ab02a23`

| File | Change |
|------|--------|
| `app/auth/gmail-connect/callback/route.ts` | NEW — direct Google OAuth callback. ~150 lines. |
| `app/(shell)/app/settings/gmail/_lib/actions.ts` | REWRITE — `connectGmailAction` builds Google auth URL directly; `disconnectGmailAction` simplified (no more conditional `unlinkIdentity`). |
| `app/(shell)/app/settings/gmail/_components/gmail-status-panel.tsx` | UPDATE — error messages keyed off specific error codes (`no_refresh_token`, `scope_denied`, etc.); success banner on `?connected=1`. |
| `app/auth/google-callback/route.ts` | CLEANUP — removed Phase 35-05 diag instrumentation. Route preserved for `signInWithOAuth` signup/login flow (where Supabase has to create the auth.users row). |

## Database state at deploy time

- `account_oauth_credentials` table: applied via MCP, currently EMPTY (orphan rows from debugging were deleted).
- `email_send_log.account_id` column: applied via MCP. Existing rows (pre-migration) have NULL.
- `auth.identities` for ajwegner3@gmail.com: only `email` provider (we deleted all stale `google` rows during debugging).
- `auth.users.raw_app_meta_data.providers` for ajwegner3: `["email"]` (repaired via SQL after manual cleanup left it inconsistent).
- `_oauth_debug` table: dropped (no longer needed).
- 4 stale `auth.refresh_tokens` rows for ajwegner3 left intact (logging Andrew out would have broken his active session — they'll naturally expire).

## Production cutover risk profile

**The Phase 35 cutover (Plan 35-04) routes ALL transactional email through `getSenderForAccount(accountId)`.** Production accounts must have connected credentials before they can send. At deploy time, ZERO accounts in production DB have credentials.

| Account | Status post-deploy | Action required |
|---------|-------------------|-----------------|
| nsi (active) | Sends will refuse until Andrew connects Gmail | Andrew connects Gmail on production immediately after deploy |
| nsi-test, nsi-rls-test, nsi-rls-test-3, soft-delete-test-acct | Don't have active customers | None |

**Post-deploy SLA:** Andrew connects Gmail on production within ~5 minutes of deploy. Any real customer booking attempt during that window will create the booking row but `confirmation_email_sent=false` (same soft-fail semantics as quota-exceeded — booking still succeeds, just no email).

## Verification plan (replaces Plan 35-05's preview steps)

Since we're skipping preview verification per Andrew's direction:

1. **Push to main → Vercel auto-deploys to production.**
2. **Andrew immediately hits `https://booking.nsintegrations.com/app/settings/gmail`** and clicks Connect Gmail. Goes through Google consent (with the new direct-Google flow this time — no Supabase intermediary). Lands back on Settings with `?connected=1` and "Connected" status.
3. **Andrew makes a test booking** against nsi from a separate test inbox. Confirms both booker and owner emails arrive via Gmail OAuth.
4. **Per-account quota isolation can be tested via SQL** after step 3 — seed Account B (e.g., `nsi-rls-test`) to 200 rows in `email_send_log`, then make another nsi booking, verify it succeeds. Same as Plan 35-05 Step 4 but on production.
5. **Reconnect smoke** — flip nsi status to `needs_reconnect` via SQL, confirm panel surfaces Reconnect button, revert.
6. **If all four pass**, ship Wave 6 (Plan 35-06: SMTP singleton removal) as a separate follow-up commit.

## Future cleanup needed

- Plan 35-05 PLAN.md is now stale (refers to preview-then-production two-step). Either rewrite to reflect this single-step prod verification or supersede with this DEVIATION doc as the contract. Recommend the latter.
- Phase 34 RESEARCH.md and SUMMARY files describe `linkIdentity` as the canonical connect mechanism. Future readers should see this DEVIATION doc as the authoritative source for the connect flow architecture.
- The `disconnectGmailAction` no longer calls `unlinkIdentity` (since linkIdentity is no longer used to create the row). Phase 34's "Conditional unlinkIdentity" pattern in STATE.md is now historical only.
- The signup flow's `initiateGoogleOAuthAction` still uses `signInWithOAuth` which routes through `/auth/google-callback`. Refresh token capture for new-signup-with-Gmail may also be unreliable; if a future user reports their Gmail isn't connected after signup, route them through the Settings → Connect Gmail flow which will work via the new direct path.
