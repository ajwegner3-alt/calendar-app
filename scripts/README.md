# scripts/

One-off SQL scripts that support specific migration phases or pre-flight checks.
These scripts are run manually via Supabase Studio SQL Editor or the CLI:

```bash
npx supabase db query --linked -f scripts/<filename>.sql
```

## Scripts

### `phase10-pre-flight-andrew-email-confirmed.sql`

**Purpose:** P-A8 pre-flight check — verifies Andrew's `auth.users` row has
`email_confirmed_at` set before the Supabase "Enable email confirmations" toggle
is flipped in Phase 10 (Plan 10-05).

**When to run:** Once, immediately before the Plan 10-05 Task 1 checkpoint.

**Steps:**
1. Run Step A SELECT to confirm `email_confirmed_at` is NOT NULL.
2. If NULL (unexpected), uncomment and run Step B UPDATE.
3. Run Step C re-SELECT to verify the final state.

See `Plan 10-05 Task 1` in `.planning/phases/10-multi-user-signup-and-onboarding/`
for the full context and surrounding checklist.
