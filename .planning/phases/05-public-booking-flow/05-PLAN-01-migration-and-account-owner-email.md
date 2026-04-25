---
phase: 05-public-booking-flow
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260426120000_account_owner_email.sql
autonomous: true

must_haves:
  truths:
    - "accounts table has nullable column owner_email TEXT (citext acceptable; nullable for backward compat with existing rows)"
    - "Migration is idempotent: ALTER TABLE ... ADD COLUMN IF NOT EXISTS owner_email TEXT"
    - "Migration committed under supabase/migrations/ with timestamp >= existing migrations (20260426120000_*)"
    - "Migration is applied LIVE on Supabase project mogfnutxrrbtvnaupoun (via Supabase MCP apply_migration OR `supabase db query --linked -f`)"
    - "After applying, the seeded nsi account row has owner_email = 'ajwegner3@gmail.com' (Andrew's email)"
    - "Phase 5 downstream code reads accounts.owner_email — must be populated for nsi BEFORE Wave 3 ships"
    - "No changes to bookings table token columns — schema already has cancel_token_hash + reschedule_token_hash NOT NULL TEXT (Phase 5 generates raw tokens, hashes, inserts)"
  artifacts:
    - path: "supabase/migrations/20260426120000_account_owner_email.sql"
      provides: "Adds nullable owner_email TEXT column to accounts and seeds nsi row"
      contains: "owner_email"
      min_lines: 8
  key_links:
    - from: "Phase 5 booking POST handler (downstream)"
      to: "accounts.owner_email"
      via: "createAdminClient().from('accounts').select('owner_email, name, timezone')"
      pattern: "owner_email"
    - from: "Phase 5 .ics builder (downstream)"
      to: "accounts.owner_email"
      via: "ORGANIZER field on createEvent()"
      pattern: "ORGANIZER"
---

<objective>
Add a nullable `owner_email TEXT` column to the `accounts` table and populate it on the seeded `nsi` row with Andrew's email. This unlocks the .ics `ORGANIZER` field, the owner notification email recipient, and any future per-account "from" branding.

Purpose: CONTEXT decision #12 — `owner_email` lookup must be available to the public `/api/bookings` Route Handler, which uses `createAdminClient()` and has no auth session. Service-role lookup of `auth.users` by `owner_user_id` works but adds a round-trip and couples the booking flow to Supabase Auth internals; a denormalized column is simpler and survives auth-provider migrations.

Output: A new migration file under `supabase/migrations/` AND the migration applied to the live Supabase project. Andrew's `nsi` account row populated.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-public-booking-flow/05-CONTEXT.md
@.planning/phases/05-public-booking-flow/05-RESEARCH.md

# Existing schema we're extending
@supabase/migrations/20260419120000_initial_schema.sql
@supabase/migrations/20260425120000_account_availability_settings.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create + apply owner_email migration</name>
  <files>supabase/migrations/20260426120000_account_owner_email.sql</files>
  <action>
Create the migration file:

```sql
-- 20260426120000_account_owner_email.sql
-- Phase 5: add nullable owner_email to accounts.
-- Used by:
--   - .ics ORGANIZER field on booker confirmation invites
--   - Owner notification email recipient
--   - Future per-account "from" branding (Phase 7)
-- Nullable on purpose: pre-existing accounts (only nsi today) get backfilled
-- below; future v2 signup will set this at account creation.

alter table accounts
  add column if not exists owner_email text;

comment on column accounts.owner_email is
  'Owner email for outbound transactional emails (.ics ORGANIZER, owner notifications). Nullable; downstream code MUST handle null gracefully (skip owner notification, omit ORGANIZER).';

-- Seed Andrew's nsi account.
update accounts
  set owner_email = 'ajwegner3@gmail.com'
  where slug = 'nsi'
    and owner_email is null;
```

Then apply the migration LIVE. Two acceptable methods (try in order):

1. **Supabase MCP** (preferred when available in this Claude Code session):
   ```
   mcp__claude_ai_Supabase__apply_migration with name="account_owner_email" and query=<contents of file above>
   ```

2. **CLI fallback**:
   ```bash
   # Requires: supabase link --project-ref mogfnutxrrbtvnaupoun done previously.
   # If link missing, run that first; password is in 1Password.
   npx supabase db query --linked -f supabase/migrations/20260426120000_account_owner_email.sql
   ```

After applying, verify with a service-role SELECT:

```bash
# Inline node script using @supabase/supabase-js + service-role key from .env.local
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
c.from('accounts').select('slug, owner_email').eq('slug', 'nsi').single().then(r => console.log(r.data));
"
# Expected: { slug: 'nsi', owner_email: 'ajwegner3@gmail.com' }
```

DO NOT:
- Do NOT add `bookings.cancel_token` or `bookings.reschedule_token` columns. The existing schema already has `cancel_token_hash` and `reschedule_token_hash` (NOT NULL TEXT) — Phase 5 generates the raw tokens, SHA-256 hashes them, and stores the hash. Raw tokens go in the email only. This matches LIFE-03 requirement and CONTEXT decision #10 ("Phase 5 generates `cancel_token` + `reschedule_token`") — the columns ARE the hash storage; nothing new to add.
- Do NOT add a NOT NULL constraint to `bookings.booker_phone`. CONTEXT decision #3 says phone is required at the form layer; enforce at Zod schema (Plan 05-03), not the column. Adding NOT NULL would require backfilling existing rows and risks breaking Phase 6+ data flows.
- Do NOT add CHECK constraints on `owner_email` format. Email validation is at the application layer (Zod). Postgres regex on email is brittle.
- Do NOT use `citext` for the column type. Plain `text` is fine — there is no per-account uniqueness requirement, no equality lookup against this column, and Phase 1 schema already mixes plain text emails (booker_email is citext only because it has lookup needs). Plain text avoids extension dependencies for callers.
  </action>
  <verify>
```bash
# File exists
ls "supabase/migrations/20260426120000_account_owner_email.sql"

# Idempotent ALTER syntax used
grep -q "add column if not exists owner_email" "supabase/migrations/20260426120000_account_owner_email.sql" && echo "idempotent ok"

# Seed UPDATE present
grep -q "ajwegner3@gmail.com" "supabase/migrations/20260426120000_account_owner_email.sql" && echo "seed ok"

# Live verification (script above)
node -e "require('dotenv').config({path:'.env.local'});const{createClient}=require('@supabase/supabase-js');const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);c.from('accounts').select('slug, owner_email').eq('slug','nsi').single().then(r=>console.log(r.data));"
# Expected: { slug: 'nsi', owner_email: 'ajwegner3@gmail.com' }
```
  </verify>
  <done>
Migration file created at `supabase/migrations/20260426120000_account_owner_email.sql` with idempotent `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS owner_email text;` + seed UPDATE for nsi. Migration applied live (via MCP or `supabase db query --linked`). Live SELECT confirms `nsi.owner_email = 'ajwegner3@gmail.com'`.

Commit: `feat(05-01): add accounts.owner_email + seed nsi`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# Migration file present
ls "supabase/migrations/20260426120000_account_owner_email.sql"

# Live row populated
node -e "require('dotenv').config({path:'.env.local'});const{createClient}=require('@supabase/supabase-js');const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);c.from('accounts').select('owner_email').eq('slug','nsi').single().then(r=>process.exit(r.data?.owner_email==='ajwegner3@gmail.com'?0:1));" && echo "owner_email populated ok"
```
</verification>

<success_criteria>
- [ ] Migration file at `supabase/migrations/20260426120000_account_owner_email.sql` exists and is committed
- [ ] Migration uses `ADD COLUMN IF NOT EXISTS` (idempotent)
- [ ] Migration applied to live Supabase project (mogfnutxrrbtvnaupoun)
- [ ] `nsi` account row has `owner_email = 'ajwegner3@gmail.com'`
- [ ] No bookings table changes (token columns already exist as hashes)
- [ ] Single commit, pushed
</success_criteria>

<output>
After completion, create `.planning/phases/05-public-booking-flow/05-01-SUMMARY.md` documenting:
- Final migration file name + timestamp
- Method used to apply (MCP vs CLI)
- Confirmed nsi.owner_email value
- Note: bookings token columns already exist as `*_token_hash` — no schema changes needed for tokens
- Note: booker_phone left nullable; required-ness enforced in Zod (Plan 05-03)
</output>
