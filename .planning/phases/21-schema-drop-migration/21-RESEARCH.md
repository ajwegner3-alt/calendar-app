# Phase 21: Schema DROP Migration - Research

**Researched:** 2026-05-01
**Domain:** Supabase Postgres DDL — DROP COLUMN + DROP TYPE migration via two-step deploy
**Confidence:** HIGH (codebase precedent firmly established; one critical apply-method conflict surfaced and resolved)

## Summary

Phase 21 is a structurally simple, operationally careful migration: drop 4 deprecated columns + 2 ENUM types from `accounts`, run a production booking smoke test, update `FUTURE_DIRECTIONS.md` §8.4. Phase 20 already satisfied the CP-01 grep-zero precondition (commit `8ec82d5`). The technical risk is near-zero; the procedural risk lives in the 30-min drain enforcement and the apply-method choice (which CONTEXT.md got wrong).

**The single material finding:** CONTEXT.md says apply via `npx supabase db push --linked`. The project's locked workaround — established in v1.0, repeatedly enforced through Phases 10/11/12/12.5/12.6 — is `npx supabase db query --linked -f <file>`. `db push` is **broken** in this repo per `PROJECT.md` §200 ("3 orphan timestamps in remote tracking table"). DB-09 in REQUIREMENTS.md and the ROADMAP success criterion both correctly specify `db query --linked -f`. **The plan must use `db query --linked -f`, not `db push`.**

ENUM coverage is also clear from the migration history: `background_shade` was created as an ENUM (Phase 12), `chrome_tint_intensity` was created as an ENUM (Phase 12.5), and `sidebar_color` + `background_color` are plain `text` columns with hex CHECK constraints (no ENUM types to drop). Two `DROP TYPE IF EXISTS` calls suffice.

**Primary recommendation:** Author one migration file `supabase/migrations/<ts>_v12_drop_deprecated_branding_columns.sql` using a single `BEGIN/COMMIT` block with idempotent `IF EXISTS` guards on all 4 column drops + 2 ENUM type drops; apply via `npx supabase db query --linked -f <path>`; ship as two git commits (migration file + SUMMARY).

## Standard Stack

### Apply method — locked workaround
| Command | Purpose | Source |
|---------|---------|--------|
| `npx supabase migration new drop_deprecated_branding_columns` | Generate timestamped migration file | CONTEXT.md decision |
| `npx supabase db query --linked -f supabase/migrations/<file>.sql` | Apply to remote (LOCKED workaround) | `PROJECT.md:200`, `STATE.md`, every Phase 10/11/12/12.5/12.6 SUMMARY |
| `echo "<sql>" \| npx supabase db query --linked` | Ad-hoc verification queries (`\d`, `\dT`) — `--sql` flag does NOT exist in installed CLI per Phase 12.6 SUMMARY:100 | `12.6-01-SUMMARY.md` |

**DO NOT use `npx supabase db push`** — broken since v1.0 (3 orphan timestamps in `supabase_migrations.schema_migrations`). CONTEXT.md error; REQUIREMENTS.md DB-09 has the correct command.

### Postgres DDL primitives
| Statement | Purpose | Notes |
|-----------|---------|-------|
| `ALTER TABLE accounts DROP COLUMN IF EXISTS <col>;` | Drop column, idempotent | Required for re-run safety |
| `DROP TYPE IF EXISTS <enum>;` | Drop ENUM type, idempotent | Must run AFTER column drop (column has FK-like dependency on type) |
| `BEGIN; ... COMMIT;` | Wrap all DDL in single transaction | Postgres DDL is transactional; defense-in-depth atomicity |

## Architecture Patterns

### Recommended migration file structure

Filename: `supabase/migrations/<TIMESTAMP>_v12_drop_deprecated_branding_columns.sql`

The Supabase CLI generates the timestamp via `npx supabase migration new`. Existing repo convention (per `20260429200000_phase12_6_sidebar_color.sql`) embeds the phase identifier in the slug.

### Migration file template (lift verbatim into plan)

```sql
-- Phase 21: Drop deprecated branding columns + their ENUM types.
-- Applied via: npx supabase db query --linked -f supabase/migrations/<TIMESTAMP>_v12_drop_deprecated_branding_columns.sql
-- (CLI db push disabled — migration drift workaround LOCKED per STATE.md / PROJECT.md §200)
--
-- Pre-conditions verified before this file ran:
--   1. CP-01 grep-zero: zero runtime reads of any of the 4 column names in .ts/.tsx (excluding migrations) — Phase 20 commit 8ec82d5
--   2. tsc --noEmit clean
--   3. ≥30-min Vercel function drain since the last code deploy (CP-03)
--
-- Columns dropped:
--   accounts.sidebar_color           — Phase 12.6 (text, hex CHECK)
--   accounts.background_color        — Phase 12   (text, hex CHECK)
--   accounts.background_shade        — Phase 12   (background_shade ENUM)
--   accounts.chrome_tint_intensity   — Phase 12.5 (chrome_tint_intensity ENUM)
--
-- Types dropped (after their columns are gone):
--   background_shade           ENUM ('none','subtle','bold')
--   chrome_tint_intensity      ENUM ('none','subtle','full')

BEGIN;
  ALTER TABLE accounts DROP COLUMN IF EXISTS sidebar_color;
  ALTER TABLE accounts DROP COLUMN IF EXISTS background_color;
  ALTER TABLE accounts DROP COLUMN IF EXISTS background_shade;
  ALTER TABLE accounts DROP COLUMN IF EXISTS chrome_tint_intensity;

  DROP TYPE IF EXISTS background_shade;
  DROP TYPE IF EXISTS chrome_tint_intensity;
COMMIT;
```

**Notes on the template:**
- Order matters: drop columns BEFORE their ENUM types. A `DROP TYPE` while a column still references it raises `cannot drop type X because other objects depend on it`. The single `BEGIN/COMMIT` block makes ordering safe within one transaction.
- `IF EXISTS` everywhere makes the file safe to re-run (e.g., on a staging branch where the columns were already dropped manually).
- The DB-04 requirement specifies a "defensive `DO $$ BEGIN ... END $$;` transaction pattern (Phase 11-03 reference)." The Phase 11-03 file `20260428130003_phase11_drop_old_double_book_index.sql` uses a `DO $$ BEGIN ... END $$;` block to **conditionally raise an exception** if a precondition is missing (it checks for `bookings_capacity_slot_idx` before dropping the old index). For Phase 21, an analogous defensive guard would re-verify the grep precondition — but **grep cannot be expressed in SQL**. The honest mapping of DB-04 to Phase 21: `IF EXISTS` guards on every drop + `BEGIN/COMMIT` wrapping = Phase 11-03's defensive intent expressed in DDL. Optionally add a `DO $$ BEGIN RAISE NOTICE 'Phase 21 drops: ...'; END $$;` header for log clarity, but it adds no safety.

### Two-step deploy / 30-min drain

Already deployed (Step 1): Phase 20 atomic commit `8ec82d5` — code stops reading deprecated columns. Confirmed by Phase 20 verifier (5/5 must-haves) and Phase 19 verifier (NSI email band rendered `#3B82F6`).

Step 2 (Phase 21): The migration file. Drain ≥30 min wall-clock before running. **Mid-drain `main` push → restart timer** (CONTEXT.md lock). The plan must include an `autonomous: false` checkpoint task between pre-flight and migration apply, where the agent reports drain start UTC + local time and waits for Andrew to type `drained`.

### Post-migration verification queries

```bash
# Verify columns are gone
echo "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name IN ('sidebar_color','background_color','background_shade','chrome_tint_intensity');" | npx supabase db query --linked
# Expected: 0 rows

# Verify ENUMs are gone
echo "SELECT typname FROM pg_type WHERE typname IN ('background_shade','chrome_tint_intensity');" | npx supabase db query --linked
# Expected: 0 rows

# Confirm accounts schema (positive surface)
echo "\d accounts" | npx supabase db query --linked
# Expected: column list contains brand_primary, brand_accent, logo_url; does NOT contain any of the 4 dropped names
```

CLI flag note: `--sql` does NOT exist in installed CLI version (per Phase 12.6 SUMMARY:100). Use the stdin pipe pattern shown above (`echo "..." | npx supabase db query --linked`) for ad-hoc queries.

### Anti-Patterns to Avoid

- **`DROP TYPE` BEFORE `DROP COLUMN`** — fails with `cannot drop type ... because other objects depend on it`. Always columns first, types second.
- **`DROP TYPE ... CASCADE`** — would silently drop any column still referencing the type. Excessive blast radius. Use `IF EXISTS` (no CASCADE) so it fails loudly if the column wasn't dropped first; the `BEGIN/COMMIT` wrapper rolls back the whole transaction on any failure.
- **Multiple migration files** — one file per Phase 21. Splitting columns across multiple files breaks the transactional atomicity guarantee.
- **`npx supabase db push`** — broken per project lock. CONTEXT.md got this wrong. Use `db query --linked -f`.
- **Running pre-flight grep mid-30-min-drain** — the drain is precisely the wait for in-flight Vercel functions to complete. Re-running grep while functions still execute is a category error. Pre-flight grep runs ONCE, before drain start.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration filename timestamp | Manual `YYYYMMDDHHMMSS_*.sql` typing | `npx supabase migration new <slug>` | CLI guarantees the format Supabase's migration tracker recognizes; matches every prior migration in the repo |
| Atomic multi-DROP transaction | Per-statement `psql` calls | Single `BEGIN; ... COMMIT;` block in one migration file | Postgres DDL is fully transactional; one file = one transaction = all-or-nothing |
| Idempotency check for re-runs | Custom `pg_class` SELECT before each ALTER | `IF EXISTS` clause on every DROP statement | Native Postgres feature, zero round-trips, no race window |
| Re-add migration as rollback | Stage as a runnable `.sql` file | Stage as `.sql.SKIP` (Supabase migration runner ignores non-`.sql` files) | CONTEXT.md decision; keeps rollback inert until needed |
| 30-min drain enforcement | Sleep loop in script | `autonomous: false` checkpoint task with Andrew typing `drained` | Plan-level enforcement, restart-able, transparent to operator |

## Common Pitfalls

### Pitfall 1: Wrong apply method (`db push` vs `db query -f`)

**What goes wrong:** Plan calls `npx supabase db push --linked`; command fails with "Remote migration versions not found" due to 3 orphan timestamps in remote tracking table.
**Why it happens:** CONTEXT.md decision specifies `db push` but every actual successful migration in this repo (Phase 10/11/12/12.5/12.6) uses `db query --linked -f`. v1.0 lock explicitly disabled `db push`.
**How to avoid:** Plan uses `npx supabase db query --linked -f supabase/migrations/<file>.sql`. Migration file header comment includes `-- Applied via: npx supabase db query --linked -f ...` (matching `20260428120002_phase10_accounts_rls_and_trigger.sql` precedent).
**Warning signs:** "Remote migration versions not found" or any reference to `supabase_migrations.schema_migrations` in the error.

### Pitfall 2: ENUM not dropped → orphan type lingers

**What goes wrong:** Migration drops the column but skips `DROP TYPE`; the ENUM type stays in the database forever, polluting `\dT` output.
**Why it happens:** Author assumes "dropping the last column using a type drops the type" (Postgres does NOT do this — ENUMs are first-class types, independent lifecycle).
**How to avoid:** Two explicit `DROP TYPE IF EXISTS background_shade;` and `DROP TYPE IF EXISTS chrome_tint_intensity;` after the column drops. Both ENUMs are confirmed-existing per migration history (Phase 12 + Phase 12.5).
**Warning signs:** `SELECT typname FROM pg_type WHERE typname IN ('background_shade','chrome_tint_intensity');` returns rows after the migration.

### Pitfall 3: DROP TYPE before DROP COLUMN

**What goes wrong:** Error `cannot drop type background_shade because other objects depend on it`. Whole transaction rolls back; nothing changes; agent appears stuck.
**Why it happens:** Author groups all DROP TYPEs at the top of the file (mental model: "types come first like CREATE TYPE").
**How to avoid:** SQL ordering in template above — all `DROP COLUMN` first, then all `DROP TYPE`. Inside one `BEGIN/COMMIT` so a partial failure rolls back cleanly.
**Warning signs:** Error message mentions "depends on" or "objects depend on it".

### Pitfall 4: 30-min timer not restarted on mid-drain push

**What goes wrong:** Andrew or Claude pushes a hotfix to `main` during the drain window; Vercel deploys new functions; the original 30-min countdown was for the OLD function set; new functions might still read deprecated columns until grep-verified.
**Why it happens:** Operator assumes the timer is a "wait period" not a "drain period."
**How to avoid:** CONTEXT.md lock — restart the 30-min timer on any `main` push during drain. Plan checkpoint mentions this explicitly. Andrew is reminded that any fix-up commit triggers a restart.
**Warning signs:** `git log main --since="30 minutes ago"` shows commits during the drain window.

### Pitfall 5: Smoke test passes a non-NSI account

**What goes wrong:** Andrew submits the test booking for a non-NSI event slug; the email band might render the wrong color and obscure the actual schema-DROP success/failure signal.
**Why it happens:** Multiple test accounts exist on prod (`nsi`, `nsi-rls-test`, `nsi-rls-test-3`, etc.) per `PROJECT.md:160`.
**How to avoid:** Smoke test URL is hardcoded in the plan: `https://calendar-app-xi-smoky.vercel.app/nsi/<active-event-slug>`. The `nsi` slug specifically — that's the seeded account whose `brand_primary` is the source-of-truth check.
**Warning signs:** Email band renders an unexpected color (magenta, emerald) → wrong account.

### Pitfall 6: Pre-flight grep includes migration files

**What goes wrong:** Grep returns dozens of hits across `supabase/migrations/*.sql` and the agent halts thinking CP-01 failed.
**Why it happens:** Migration files ARE the source-of-truth for the column names; they MUST contain the names.
**How to avoid:** Grep excludes migrations. The literal command (lift into plan):
```bash
git grep -l "sidebar_color\|background_color\|background_shade\|chrome_tint_intensity" -- "*.ts" "*.tsx" ":!supabase/migrations/*"
```
**Expected result:** 2 files (`app/embed/[account]/[event-slug]/_components/embed-shell.tsx` and `app/(shell)/layout.tsx`) — both with comment-only references that Phase 20 verifier already classified as inert. **Comment-only hits are PASS.** Only runtime reads (uncommented code) are FAIL.
**Warning signs:** Hits in files that are NOT one of the 2 known comment-only files → real regression; HALT.

## Code Examples

### Pre-flight grep (lift literally into plan task)

```bash
# CP-01 re-verification (defense-in-depth — Phase 20 already passed this)
git grep -l "sidebar_color\|background_color\|background_shade\|chrome_tint_intensity" \
  -- "*.ts" "*.tsx" ":!supabase/migrations/*"
```

**Expected output:** 2 files, both comment-only:
- `app/(shell)/layout.tsx` (line 38-39: `// Columns removed: sidebar_color, sidebar_text_color, background_color, // background_shade, chrome_tint_intensity, brand_primary (Phase 15 cleanup).`)
- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` (lines 28-29 and 69-70: JSDoc references)

**Verification step:** For each file in the grep output, run:
```bash
git grep -n "sidebar_color\|background_color\|background_shade\|chrome_tint_intensity" -- <path>
```
Confirm every hit is on a comment line (starts with `//`, `*`, or is inside a `/* ... */` block). If any hit is uncommented code → HALT, escalate to Andrew.

### tsc gate (lift literally)

```bash
npx tsc --noEmit
```

Expected: Same exit-zero or pre-existing baseline tests/ errors as Phase 20 close (per Phase 20 SUMMARY Gate 1).

### Migration file generation

```bash
npx supabase migration new drop_deprecated_branding_columns
# Creates: supabase/migrations/<UTC_TIMESTAMP>_drop_deprecated_branding_columns.sql
```

Then overwrite the empty file with the SQL template above. The Supabase CLI doesn't accept a slug-prefix flag; if the desired slug is `v12_drop_deprecated_branding_columns`, manually rename:
```bash
mv supabase/migrations/<TIMESTAMP>_drop_deprecated_branding_columns.sql \
   supabase/migrations/<TIMESTAMP>_v12_drop_deprecated_branding_columns.sql
```

### Migration apply (lift literally)

```bash
npx supabase db query --linked -f supabase/migrations/<TIMESTAMP>_v12_drop_deprecated_branding_columns.sql
```

### Re-add `.SKIP` rollback artifact (lift verbatim)

Save to `supabase/migrations/<TIMESTAMP+1>_readd_deprecated_branding.sql.SKIP` (the `.SKIP` extension makes Supabase ignore it):

```sql
-- Phase 21 ROLLBACK — DO NOT RUN UNLESS PHASE 21 SMOKE FAILS AND DIAGNOSIS REQUIRES.
-- To activate: rename to .sql, run: npx supabase db query --linked -f <renamed>.sql
-- Recreates 4 deprecated branding columns + 2 ENUM types in their original Phase 12 / 12.5 / 12.6 shape.

BEGIN;
  -- Phase 12: background_color (text, hex CHECK)
  ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS background_color text
      CHECK (background_color IS NULL OR background_color ~* '^#[0-9a-f]{6}$');

  -- Phase 12: background_shade ENUM + column (NOT NULL DEFAULT 'subtle')
  DO $$ BEGIN
    CREATE TYPE background_shade AS ENUM ('none', 'subtle', 'bold');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS background_shade background_shade NOT NULL DEFAULT 'subtle';

  -- Phase 12.5: chrome_tint_intensity ENUM + column (NOT NULL DEFAULT 'subtle')
  DO $$ BEGIN
    CREATE TYPE chrome_tint_intensity AS ENUM ('none', 'subtle', 'full');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS chrome_tint_intensity chrome_tint_intensity NOT NULL DEFAULT 'subtle';

  -- Phase 12.6: sidebar_color (text, hex CHECK)
  ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS sidebar_color text
      CHECK (sidebar_color IS NULL OR sidebar_color ~* '^#[0-9a-f]{6}$');

  COMMENT ON COLUMN accounts.background_color IS
    'Phase 12: per-account hex tint for gradient backdrops. NULL = falls back to gray-50.';
  COMMENT ON COLUMN accounts.background_shade IS
    'Phase 12: gradient intensity. none=flat tint of background_color (4% over white); subtle=light circles; bold=full Cruip pattern.';
  COMMENT ON COLUMN accounts.sidebar_color IS
    'Per-account sidebar background color. Null = shadcn default (--sidebar token). Phase 12.6.';
COMMIT;
```

This is byte-for-byte derived from `supabase/migrations/20260429120000_phase12_branding_columns.sql`, `20260429180000_phase12_5_chrome_tint_intensity.sql`, and `20260429200000_phase12_6_sidebar_color.sql` — the original creation files. Note: the original Phase 12.5 file used bare `CREATE TYPE` (no DO-block guard); the rollback uses the guarded form for re-run safety.

### FUTURE_DIRECTIONS.md §8.4 update

**Lines to remove from §8.4 (currently lines 281-282 in `FUTURE_DIRECTIONS.md`):**

```markdown
- **DROP `accounts.chrome_tint_intensity` column.** Phase 12.5 leftover; safe to remove after one v1.1 release window per Phase 12.6 lock (`chrome_tint_intensity` is no longer read by any production code path; only Phase 12.5 tests still reference the chromeTintToCss compat export). Source: `STATE.md` Session Continuity + Phase 12.6 close-out decision #1.
- **Remove `chromeTintToCss` compat export from `lib/branding/chrome-tint.ts`.** Only Phase 12.5 tests still import it. Pair with the `chrome_tint_intensity` DROP. Source: `STATE.md` Session Continuity.
```

**Replacement (one bullet, marking both as completed):**

```markdown
- ~~**DROP `accounts.chrome_tint_intensity` column** + companion ENUM type, plus DROP `accounts.sidebar_color`, `accounts.background_color`, `accounts.background_shade` (column + ENUM type). Plus removal of `lib/branding/chrome-tint.ts` and `chromeTintToCss` compat export.~~ **CLOSED v1.2 Phase 21** (2026-05-XX). Phase 20 commit `8ec82d5` removed the runtime reads + dead code; Phase 21 migration `<TIMESTAMP>_v12_drop_deprecated_branding_columns.sql` permanently dropped the 4 columns + 2 ENUM types.
```

Note: the strikethrough marks the items as historically captured but now resolved — preserving §8.4's source-attribution audit trail while reflecting v1.2 closure. Plan should fill in the actual migration timestamp + close-out date at execution time.

### Smoke test URL (lift literally)

```
https://calendar-app-xi-smoky.vercel.app/nsi/<event-slug>
```

The `<event-slug>` placeholder must be filled with an active NSI event type slug at execution time. **Recommended discovery query (run pre-smoke):**

```bash
echo "SELECT slug, name FROM event_types WHERE account_id = (SELECT id FROM accounts WHERE slug='nsi') AND is_active = true AND deleted_at IS NULL ORDER BY created_at;" | npx supabase db query --linked
```

Pick the first slug returned. Standard NSI naming (per Phase 13 + earlier seeds) is likely something like `30-min-consultation`, `60-min-strategy`, or similar — but the canonical answer is whatever the query returns at execution.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npx supabase db push --linked` | `npx supabase db query --linked -f <file>` | v1.0 (orphan-timestamps drift) | All schema migrations; PROJECT.md §200 lock |
| `--sql "<query>"` flag for ad-hoc | `echo "<sql>" \| npx supabase db query --linked` | Phase 12.6 (CLI version mismatch) | All ad-hoc verification; per Phase 12.6 SUMMARY:100 |
| Single-deploy DROP migration | Two-step deploy: code-stop-reading deploy → 30-min drain → DROP migration | v1.2 milestone scoping (CP-03) | This phase only — accepted procedural cost for code-DB safety |

**Deprecated/outdated within this codebase:**
- `lib/branding/chrome-tint.ts` (deleted Phase 20 commit `8ec82d5` — file no longer exists)
- `BackgroundShade` and `ChromeTintIntensity` TypeScript type aliases (removed Phase 20)
- `Branding` interface fields `backgroundColor`, `backgroundShade`, `chromeTintIntensity`, `sidebarColor` (collapsed Phase 20 to 3-field shape)
- `EmailBranding` deprecated fields (collapsed Phase 19 to `{name, logo_url, brand_primary}`)

## Open Questions

1. **NSI account's current `brand_primary` value**
   - **What we know:** Phase 13 set NSI to `brand_primary='#0A2540'` (navy) per `13-CHECKLIST.md` artifact note. Phase 19 verifier confirmed the live email band renders `#3B82F6`. The email-layer `DEFAULT_BRAND_PRIMARY = '#3B82F6'` is used when `brand_primary` is null. Either: (a) NSI's `brand_primary` is currently `null` (so default kicks in), OR (b) NSI's `brand_primary` was updated to `#3B82F6` between Phase 13 and Phase 19.
   - **What's unclear:** Which of (a) or (b) is the actual live state.
   - **Recommendation:** Plan includes a pre-flight `SELECT brand_primary FROM accounts WHERE slug='nsi';` query so the smoke test asserts against the actual current value (not a hardcoded `#3B82F6`). The success criterion in CONTEXT.md says `verifies the header band renders #3B82F6`; if the DB value disagrees, the plan should reconcile (likely Andrew updates NSI's `brand_primary` to `#3B82F6` before smoke, or accepts whatever the DB says).

2. **Whether DB-04's "defensive `DO $$ BEGIN ... END $$;` transaction pattern" is binding or aspirational**
   - **What we know:** Phase 11-03's migration uses a `DO $$ BEGIN ... END $$;` block for a *runtime precondition check* (verifying another index is live). The Phase 21 analog ("verify CP-01 grep") cannot be expressed in SQL — grep is a filesystem operation.
   - **What's unclear:** Whether DB-04 means literally "use a `DO $$` block in the SQL" or "use defensive guards equivalent to Phase 11-03's intent."
   - **Recommendation:** Plan satisfies DB-04 via (a) `IF EXISTS` on every drop, (b) `BEGIN/COMMIT` wrap, (c) optional `DO $$ BEGIN RAISE NOTICE 'Phase 21 DROP migration starting'; END $$;` header purely for log clarity. Document in plan that the substantive defensive check (CP-01 grep) lives in the pre-flight task gate, not in SQL.

3. **Whether to delete or retain the smoke-test booking**
   - **What we know:** CONTEXT.md leaves this to Claude's discretion based on user-visibility.
   - **What's unclear:** Whether public bookings list view shows the test booking to other users.
   - **Recommendation:** Plan includes a cleanup task that deletes the smoke booking via `DELETE FROM bookings WHERE booker_email = '<andrew's test email>' AND created_at > '<smoke-start-timestamp>';` after Andrew confirms the email arrived. Bookings dashboard at `/app/bookings` shows owners' own bookings — leaving the test booking would clutter Andrew's view. Delete it.

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260429120000_phase12_branding_columns.sql` — `background_color` + `background_shade` ENUM definitions
- `supabase/migrations/20260429180000_phase12_5_chrome_tint_intensity.sql` — `chrome_tint_intensity` ENUM definition
- `supabase/migrations/20260429200000_phase12_6_sidebar_color.sql` — `sidebar_color` (text, hex CHECK)
- `supabase/migrations/20260428130003_phase11_drop_old_double_book_index.sql` — DB-04 reference pattern (`DO $$ BEGIN ... END $$;` + `BEGIN/COMMIT`)
- `supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql` — header comment convention (`-- Applied via: npx supabase db query --linked -f ...`)
- `.planning/PROJECT.md:200` — locked workaround declaration
- `.planning/REQUIREMENTS.md:178` (DB-09) — locked apply method
- `.planning/ROADMAP.md:267` — Phase 21 success criterion
- `.planning/phases/19-email-layer-simplification/19-01-SUMMARY.md` — Phase 19 atomic-commit precedent
- `.planning/phases/20-dead-code-test-cleanup/20-01-SUMMARY.md` — Phase 20 atomic-commit precedent + grep-zero confirmation
- `.planning/phases/12.6-direct-color-controls/12.6-01-SUMMARY.md` — `--sql` flag does not exist; use `echo \| ... db query --linked`
- `FUTURE_DIRECTIONS.md` lines 274-285 — §8.4 backlog items (literal text for DB-11 update)
- `lib/email/branding-blocks.ts:4` — `DEFAULT_BRAND_PRIMARY = "#3B82F6"` (email-layer source of truth)

### Secondary (MEDIUM confidence)
- [PostgreSQL Documentation: DROP TYPE](https://www.postgresql.org/docs/current/sql-droptype.html) — confirms `IF EXISTS` semantics, dependency-rejection default
- [Supabase Docs: Managing Enums in Postgres](https://supabase.com/docs/guides/database/postgres/enums) — confirms standard column-then-type drop ordering
- WebSearch verification — multiple Postgres references agree on column-first / type-second ordering

### Tertiary (LOW confidence)
- None. All findings backed by primary sources.

## Metadata

**Confidence breakdown:**
- Apply method (`db query --linked -f` vs `db push`): HIGH — codebase precedent + explicit lock in PROJECT.md / STATE.md / multiple SUMMARYs.
- ENUM coverage (background_shade + chrome_tint_intensity exist; sidebar_color + background_color do NOT): HIGH — verified directly in migration source files.
- Migration file template: HIGH — lifted from in-repo Phase 12 / 12.5 / 12.6 / 11-03 patterns.
- Pre-flight grep command: HIGH — lifted from Phase 20 SUMMARY Gate 4.
- §8.4 update text: HIGH — literal lines from FUTURE_DIRECTIONS.md.
- Smoke test URL host + path shape: HIGH — Phase 19 SUMMARY + ROADMAP success criterion 5.
- NSI `brand_primary` current value: MEDIUM — historical record contradicts Phase 19 result; plan must verify at execution.
- DB-04 interpretation: MEDIUM — Phase 11-03 reference is for a different kind of guard; plan should document the analog rather than literally replicate.

**Research date:** 2026-05-01
**Valid until:** 2026-05-31 (stable — schema, CLI, and Postgres semantics are all stable; revisit only if Supabase CLI ships a major version bump that fixes `db push` drift)
