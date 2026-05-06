---
phase: 34-google-oauth-signup-and-credential-capture
plan: 01
subsystem: database
tags: [supabase, postgres, rls, oauth, google, migration, encryption]

# Dependency graph
requires:
  - phase: 10-accounts-rls-and-trigger
    provides: "RLS pattern and updated_at trigger convention used here"
provides:
  - "account_oauth_credentials table with encrypted refresh token storage"
  - "SELECT-only RLS policy (credentials_select_own) scoped to auth.uid()"
  - "Supabase manual identity linking enabled locally (config.toml)"
affects:
  - 34-02 (write API route that INSERTs into this table)
  - 34-03 (settings page that calls linkIdentity())
  - 35-gmail-token-refresh (updates last_refresh_at and status columns)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin-client-only writes: no INSERT/UPDATE/DELETE RLS — writes enforced through server-side API routes"
    - "AES-256-GCM encrypted blob format: iv:authTag:ciphertext (all lowercase hex)"

key-files:
  created:
    - supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql
  modified:
    - supabase/config.toml

key-decisions:
  - "No INSERT/UPDATE/DELETE RLS policies — all credential writes go through admin Supabase client in API routes to prevent browser-side credential manipulation"
  - "Encrypted blob format: iv:authTag:ciphertext hex (AES-256-GCM, 12-byte IV, 16-byte auth tag) — format spec stored in migration comment for Plan 34-02"
  - "provider check constraint: ('google') only, but table design is extensible to future providers"
  - "Forward-only migration (no rollback file) — consistent with project convention"
  - "enable_manual_linking = true in config.toml is local dev only; Supabase Dashboard toggle is separate (PREREQ-02)"

patterns-established:
  - "Admin-only writes pattern: credentials table has SELECT-only RLS; write path requires service-role key"

# Metrics
duration: 1min
completed: 2026-05-06
---

# Phase 34 Plan 01: Schema Foundation Summary

**account_oauth_credentials table with AES-256-GCM encrypted refresh token storage, SELECT-only RLS (admin-writes-only pattern), and Supabase manual identity linking enabled for local dev**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-06T23:28:19Z
- **Completed:** 2026-05-06T23:29:11Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Created `account_oauth_credentials` table with all required columns (id, user_id FK with cascade, provider, refresh_token_encrypted, granted_scopes, status, connected_at, last_refresh_at, created_at, updated_at), unique constraint on (user_id, provider), and index on user_id
- Added SELECT-only RLS policy `credentials_select_own` using `auth.uid() = user_id`; no INSERT/UPDATE/DELETE policies enforces admin-client-only write pattern
- Flipped `enable_manual_linking = true` in `supabase/config.toml` (line 174) with explanatory comment for Phase 34 `linkIdentity()` flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create account_oauth_credentials migration** - `b214eb5` (feat)
2. **Task 2: Enable manual identity linking in supabase/config.toml** - `f490e7e` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql` - Forward-only migration: table schema, index, RLS enable, SELECT policy, updated_at trigger
- `supabase/config.toml` - Line 174: `enable_manual_linking = false` → `true` with Phase 34 comment

## Decisions Made

- **Admin-only write pattern:** No INSERT/UPDATE/DELETE RLS policies created. All credential writes must go through the Supabase admin client in a server-side API route, preventing any browser-side credential manipulation or token extraction.
- **Encrypted blob format spec in migration comment:** The `iv:authTag:ciphertext` (all lowercase hex) format is documented in the migration header so Plan 34-02's implementation has a canonical reference without needing to hunt for it.
- **Provider extensibility:** `check (provider in ('google'))` uses a list constraint so future providers (e.g. `'microsoft'`) can be added with a simple migration rather than requiring a table redesign.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Docker not running:** `npx supabase db reset` could not be executed because Docker Desktop is not running (confirmed via `npx supabase status` returning docker_engine pipe error). Migration correctness verified by manual inspection:

- `references auth.users(id) on delete cascade` present on line 19
- `auth.uid() = user_id` in RLS policy present on line 46
- `unique (user_id, provider)` constraint on line 29
- `credentials_select_own` policy for SELECT only (no other policies)
- `updated_at` trigger function and trigger creation following Phase 10 convention

**To verify after Docker is available:**
```bash
npx supabase db reset
npx supabase migration list --local
psql $DATABASE_URL -c "\d account_oauth_credentials"
psql $DATABASE_URL -c "select polname, polcmd from pg_policy where polrelid = 'account_oauth_credentials'::regclass"
```

## User Setup Required

**PREREQ-01 + PREREQ-02 (Google Cloud Console + Supabase Dashboard) are not required for this plan** — Plan 34-01 is schema + local config only.

For the full Phase 34 runtime to work, the following still need manual action:
- PREREQ-01: Google Cloud Console OAuth app setup (3-5 day verification lead time)
- PREREQ-02: Supabase Dashboard "Enable Manual Linking" toggle + Google provider credentials paste
- PREREQ-04: Vercel env vars — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY`

## Encrypted Blob Format Reminder

Plan 34-02 must produce and Plan 35 must consume the following format for `refresh_token_encrypted`:

```
iv:authTag:ciphertext
```

All three segments are **lowercase hex strings**. Algorithm: AES-256-GCM, 12-byte IV, 16-byte auth tag.

Node.js production: `crypto.createCipheriv('aes-256-gcm', key, iv)` where key is derived from `GMAIL_TOKEN_ENCRYPTION_KEY`.

## Next Phase Readiness

- Plan 34-02 can proceed: the `account_oauth_credentials` table schema is defined and committed
- Plan 34-03 can proceed: `enable_manual_linking = true` is live in config.toml for local `linkIdentity()` testing
- Plans 34-02 through 34-04 depend on this migration being applied — run `npx supabase db reset` once Docker is available before testing locally
- No blockers for continued code authoring (Plans 34-02+ can be written before Docker verification)

---
*Phase: 34-google-oauth-signup-and-credential-capture*
*Completed: 2026-05-06*
