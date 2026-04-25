---
phase: 04-availability-engine
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - supabase/migrations/20260425120000_account_availability_settings.sql
  - components/ui/calendar.tsx
autonomous: true

must_haves:
  truths:
    - "package.json declares date-fns ^4.1.0 and @date-fns/tz ^1.4.1 as runtime dependencies; node_modules contains both packages"
    - "shadcn calendar component is installed at components/ui/calendar.tsx; react-day-picker is in package.json"
    - "accounts table has four new columns: buffer_minutes int NOT NULL DEFAULT 0, min_notice_hours int NOT NULL DEFAULT 24, max_advance_days int NOT NULL DEFAULT 14, daily_cap int NULL — each with the documented CHECK constraints"
    - "Existing seeded nsi account row has buffer_minutes=0, min_notice_hours=24, max_advance_days=14, daily_cap=NULL after migration apply (defaults backfill cleanly)"
    - "Migration is idempotent (uses ADD COLUMN IF NOT EXISTS) and committed under supabase/migrations/ matching Phase 1/3 convention"
    - "npm run build exits 0 after dependency install"
  artifacts:
    - path: "package.json"
      provides: "Adds date-fns + @date-fns/tz + react-day-picker to dependencies"
      contains: "date-fns"
    - path: "supabase/migrations/20260425120000_account_availability_settings.sql"
      provides: "ALTER TABLE accounts adding 4 nullable/defaulted settings columns with CHECK constraints"
      contains: "buffer_minutes"
      min_lines: 10
    - path: "components/ui/calendar.tsx"
      provides: "shadcn Calendar wrapper around react-day-picker (installed via shadcn CLI)"
      contains: "DayPicker"
  key_links:
    - from: "supabase/migrations/20260425120000_account_availability_settings.sql"
      to: "Supabase project (live)"
      via: "Supabase MCP apply_migration (or supabase db query --linked fallback)"
      pattern: "apply_migration|supabase db query"
    - from: "Phase 4 slot engine (Plan 04-02)"
      to: "accounts.{buffer_minutes,min_notice_hours,max_advance_days,daily_cap} columns"
      via: "computeSlots reads account settings; columns must exist"
      pattern: "buffer_minutes|min_notice_hours|max_advance_days|daily_cap"
---

<objective>
Land the foundation for Phase 4: install the missing dependencies (`date-fns`, `@date-fns/tz`, `react-day-picker` via `shadcn calendar`) and apply the migration that adds the four global availability-settings columns to the `accounts` table. Every other Phase 4 plan depends on this one.

Purpose: Phase 1's schema does not yet have the `buffer_minutes` / `min_notice_hours` / `max_advance_days` / `daily_cap` columns the slot engine reads from. The TZ-aware date library and the calendar primitive are also not installed. Land them all in a single small plan so Wave 2 (engine + actions) and Wave 3 (UI + API) start with a clean foundation.

Output: `package.json` updated with three new deps; the shadcn `calendar.tsx` component file exists; one new migration applied to the live Supabase project; existing seeded `nsi` row backfilled to documented defaults via the `DEFAULT` clause.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-availability-engine/04-CONTEXT.md
@.planning/phases/04-availability-engine/04-RESEARCH.md

# Existing schema (the table we're altering lives here)
@supabase/migrations/20260419120000_initial_schema.sql

# Existing migration convention from Phase 3
@supabase/migrations/20260424120000_event_types_soft_delete.sql

# Existing UI primitives (calendar.tsx is the only new one)
@components/ui/sonner.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install date-fns + @date-fns/tz</name>
  <files>package.json, package-lock.json</files>
  <action>
Install the two TZ-aware date libraries verified in RESEARCH §1. Both are missing from `package.json` today; the slot engine in Plan 04-02 cannot compile without them.

```bash
npm install date-fns@^4.1.0 @date-fns/tz@^1.4.1
```

Versions:
- `date-fns` ^4.1.0 — provides `addMinutes`, `addDays`, `getDay`, `isBefore`, `isAfter`, `format`
- `@date-fns/tz` ^1.4.1 — provides the `TZDate` class and `tz()` helper

Key rules:
- Pin to caret major (`^4.1.0` and `^1.4.1`) — these are the latest verified versions per RESEARCH §1, refreshed 2026-04-25. Do not use exact-pin (`4.1.0`) — caret allows safe patch updates.
- Both go under `dependencies`, NOT `devDependencies`. They are runtime imports from production code paths (`/api/slots` route, `lib/slots.ts`).
- Do NOT install `date-fns-tz` (the v2/v3-era package). RESEARCH Pitfall 1 explicitly calls this out: `formatInTimeZone` etc. are NOT in `@date-fns/tz` v4 and never should be searched for. Anyone who later runs `npm install date-fns-tz` is undoing this plan.
- Do NOT install `dayjs`, `luxon`, `moment`, or any other date library. The architectural decision (STATE.md, locked) is `date-fns v4 + @date-fns/tz` everywhere.

After install, sanity-check the installed shapes:

```bash
node -e "const tz = require('@date-fns/tz'); console.log('TZDate:', typeof tz.TZDate); console.log('tz:', typeof tz.tz);"
# Expected: TZDate: function, tz: function

node -e "const d = require('date-fns'); console.log('addMinutes:', typeof d.addMinutes, 'getDay:', typeof d.getDay);"
# Expected: addMinutes: function, getDay: function

# Critical: confirm formatInTimeZone is NOT exported (sanity for RESEARCH Pitfall 1)
node -e "const tz = require('@date-fns/tz'); console.log('formatInTimeZone exists:', tz.formatInTimeZone !== undefined);"
# Expected: formatInTimeZone exists: false
```

DO NOT:
- Do not edit `package.json` by hand and then run `npm install` — let `npm install <pkg>@<ver>` write both fields atomically (avoids drift between `package.json` and `package-lock.json`).
- Do not commit a hand-edited `package-lock.json`.
  </action>
  <verify>
```bash
# Both packages declared as runtime deps
grep -q '"date-fns": "\^4' package.json && echo "date-fns ok"
grep -q '"@date-fns/tz": "\^1' package.json && echo "@date-fns/tz ok"

# Both installed under node_modules
ls node_modules/date-fns/package.json
ls node_modules/@date-fns/tz/package.json

# Build still passes (no breakage from new deps)
npm run build
```
  </verify>
  <done>
`package.json` lists `date-fns@^4.1.0` and `@date-fns/tz@^1.4.1` under `dependencies`. Both are installed in `node_modules`. The sanity checks (TZDate is a function, formatInTimeZone is undefined) all pass. `npm run build` exits 0.

Commit: `feat(04-01): install date-fns v4 and @date-fns/tz v1`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add shadcn calendar component (installs react-day-picker)</name>
  <files>components/ui/calendar.tsx, package.json, package-lock.json</files>
  <action>
Install the shadcn `Calendar` component. It is the only shadcn primitive Phase 4 needs that is not already installed (RESEARCH §4 confirmed all other primitives are present). Pulls in `react-day-picker` v9 as a transitive dependency.

```bash
npx shadcn@latest add calendar
```

If the CLI prompts for confirmation, accept defaults. The CLI:
1. Writes `components/ui/calendar.tsx` (the shadcn wrapper around `react-day-picker`).
2. Adds `react-day-picker` to `package.json` `dependencies`.
3. May add `date-fns` if not already there — already installed in Task 1, so it's a no-op.

After install, verify:

```bash
ls components/ui/calendar.tsx
grep -q '"react-day-picker"' package.json && echo "react-day-picker installed"
grep -q "DayPicker" components/ui/calendar.tsx && echo "wrapper imports DayPicker"
```

If the shadcn CLI fails (network, npm registry, version skew), fall back to the manual install:

```bash
npm install react-day-picker
```

Then create `components/ui/calendar.tsx` from the canonical shadcn template at https://ui.shadcn.com/docs/components/calendar — copy verbatim. The wrapper just adds Tailwind class styling around `DayPicker`.

Key rules:
- Use the same `npx shadcn@latest add` command form Phase 3 used (Plan 03-02). The version installed by the CLI in Phase 3 was 4.4.0 with the `radix-ui` monorepo package (STATE.md "shadcn v4 uses radix-ui monorepo package" decision). The same CLI is in use here — no version pinning required.
- The calendar component file goes at `components/ui/calendar.tsx` — the standard shadcn location, alongside `dialog.tsx`, `dropdown-menu.tsx`, etc.
- Do NOT install `react-day-picker` directly via `npm install react-day-picker` UNLESS the shadcn CLI fails. The CLI version-pin is the source of truth for compatibility with the wrapper.
- Do NOT install `date-fns` again here — Task 1 handled that.

The Calendar component will be consumed in Plan 04-05 (overrides UI). This task only LANDS the primitive — no usage yet.

Add CSS for date-marker dots to `app/globals.css` (these classes are referenced from the shadcn `Calendar` via the `modifiersClassNames` prop in Plan 04-05):

```css
/* Date-override markers on the availability calendar (Phase 4 Plan 04-05) */
.day-blocked,
.day-custom {
  position: relative;
}
.day-blocked::after,
.day-custom::after {
  content: "";
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 9999px;
}
.day-blocked::after {
  background: hsl(var(--destructive));
}
.day-custom::after {
  background: hsl(var(--primary));
}
```

Append (do NOT replace existing styles) to `app/globals.css`. Plan 04-05 references these classes by exact name — don't rename.

DO NOT:
- Do not delete or replace existing CSS rules in `app/globals.css`.
- Do not add a different calendar library (`react-calendar`, `@fullcalendar/*`, etc.). RESEARCH §4 recommended shadcn Calendar specifically.
  </action>
  <verify>
```bash
# Calendar component installed
ls components/ui/calendar.tsx
grep -q "react-day-picker" package.json && echo "rdp ok"
grep -q "DayPicker" components/ui/calendar.tsx && echo "DayPicker import ok"

# Marker CSS appended
grep -q "day-blocked" app/globals.css && echo "blocked CSS ok"
grep -q "day-custom" app/globals.css && echo "custom CSS ok"

# Build still passes
npm run build
```
  </verify>
  <done>
`components/ui/calendar.tsx` exists and imports `DayPicker` from `react-day-picker`. `package.json` lists `react-day-picker` as a runtime dependency. `app/globals.css` contains `.day-blocked` and `.day-custom` rules with `::after` pseudo-element dots. `npm run build` exits 0.

Commit: `feat(04-01): add shadcn calendar component and date-marker CSS`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Author + apply accounts settings migration</name>
  <files>supabase/migrations/20260425120000_account_availability_settings.sql</files>
  <action>
Create + apply the migration that adds the four global availability-settings columns to `accounts`. RESEARCH §3 has the canonical SQL.

Migration file path: `supabase/migrations/20260425120000_account_availability_settings.sql`

```sql
-- Phase 4: Availability Engine — global account settings columns
--
-- Adds the four account-wide availability knobs the slot engine reads:
--   - buffer_minutes      (AVAIL-03) pre/post buffer applied around every booking
--   - min_notice_hours    (AVAIL-04) hours before NOW that a slot becomes bookable
--   - max_advance_days    (AVAIL-05) days into future that slots are shown
--   - daily_cap           (AVAIL-06) max confirmed bookings/day; NULL = no cap
--
-- Defaults match CONTEXT.md decisions: buffer=0, min-notice=24h, max-advance=14d,
-- daily-cap=null. Existing seeded rows (nsi account) backfill to these defaults
-- automatically because of the DEFAULT clause on the NOT NULL columns.
--
-- Idempotent: safe to re-run.

alter table accounts
  add column if not exists buffer_minutes int not null default 0
    check (buffer_minutes >= 0),
  add column if not exists min_notice_hours int not null default 24
    check (min_notice_hours >= 0),
  add column if not exists max_advance_days int not null default 14
    check (max_advance_days > 0),
  add column if not exists daily_cap int
    check (daily_cap is null or daily_cap > 0);

-- Document intent on the columns (helps future maintainers grep for it).
comment on column accounts.buffer_minutes is 'Pre/post buffer minutes applied around every booking (AVAIL-03)';
comment on column accounts.min_notice_hours is 'Hours before now a slot becomes bookable (AVAIL-04)';
comment on column accounts.max_advance_days is 'Days into future slots are shown (AVAIL-05)';
comment on column accounts.daily_cap is 'Max confirmed bookings per local-date; NULL = no cap (AVAIL-06)';
```

Key rules:
- Filename uses `YYYYMMDDHHMMSS_name.sql`. Timestamp `20260425120000` is the next slot after Phase 3's `20260424120000`. Use exactly this filename — do not regenerate the timestamp.
- All four `add column` clauses use `if not exists`. The migration must be safe to re-run if Supabase MCP `apply_migration` records partial state.
- The `not null default 0/24/14` clauses backfill existing rows (the seeded `nsi` row) to the documented defaults. No separate `UPDATE accounts SET ...` statement is needed.
- `daily_cap` is nullable BY DESIGN — null = "no cap" per CONTEXT.md. The CHECK constraint `daily_cap is null or daily_cap > 0` allows NULL but disallows zero or negative.
- Do NOT add `is_setup_complete` or other flag columns. CONTEXT.md's "first-visit empty state" decision is a UI concern, not a schema concern (the UI infers "no rules yet" by checking if any `availability_rules` rows exist for the account).
- Do NOT add columns to `availability_rules` or `date_overrides` — RESEARCH §3 confirmed both are correct as-is for Phase 4.

Apply via Supabase MCP `apply_migration`:
- `name`: `account_availability_settings`
- `query`: full contents of the SQL file above

If `apply_migration` is unavailable in the executor's MCP scope (e.g., Claude Code CLI session without Supabase MCP), fall back to:
```bash
supabase db query --linked -f supabase/migrations/20260425120000_account_availability_settings.sql
```
(STATE.md "supabase db query --linked as MCP fallback" decision — same Management API path.)

Verification queries (run via MCP `execute_sql` or `supabase db query --linked -e`):

1. **Confirm all four columns exist with correct types/defaults:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounts'
  AND column_name IN ('buffer_minutes', 'min_notice_hours', 'max_advance_days', 'daily_cap')
ORDER BY column_name;
```
Expected: 4 rows. `buffer_minutes`/`min_notice_hours`/`max_advance_days` are `integer`, `is_nullable='NO'`, defaults `0`/`24`/`14`. `daily_cap` is `integer`, `is_nullable='YES'`, default `NULL`.

2. **Confirm seeded nsi row backfilled to documented defaults:**
```sql
SELECT slug, buffer_minutes, min_notice_hours, max_advance_days, daily_cap
FROM accounts
WHERE slug = 'nsi';
```
Expected: 1 row with `(0, 24, 14, NULL)`.

3. **Confirm CHECK constraints reject invalid writes (negative test, MUST fail):**
```sql
-- This must fail with check_violation 23514
UPDATE accounts SET daily_cap = 0 WHERE slug = 'nsi';
```
Expected: error `new row for relation "accounts" violates check constraint "accounts_daily_cap_check"`. If the UPDATE succeeds, the CHECK is missing — re-inspect the migration apply.

If the negative test accidentally succeeds (no constraint), revert the bad value:
```sql
UPDATE accounts SET daily_cap = NULL WHERE slug = 'nsi';
```

DO NOT:
- Do not run the negative test against any account other than `nsi`.
- Do not edit `20260419120000_initial_schema.sql` — Phase 4 adds a NEW migration on top.
- Do not include any RLS policy changes; the existing `accounts` policy already covers reads/writes by `owner_user_id`.
- Do not skip the verification queries — they are how this plan proves the migration landed correctly.
  </action>
  <verify>
```bash
# Migration file exists with the right name + content
ls supabase/migrations/20260425120000_account_availability_settings.sql
grep -q "buffer_minutes int not null default 0" supabase/migrations/20260425120000_account_availability_settings.sql && echo "buffer ok"
grep -q "min_notice_hours int not null default 24" supabase/migrations/20260425120000_account_availability_settings.sql && echo "min_notice ok"
grep -q "max_advance_days int not null default 14" supabase/migrations/20260425120000_account_availability_settings.sql && echo "max_advance ok"
grep -q "daily_cap int" supabase/migrations/20260425120000_account_availability_settings.sql && echo "daily_cap ok"
grep -q "if not exists" supabase/migrations/20260425120000_account_availability_settings.sql && echo "idempotent ok"

# Existing tests still green (no regression on Phases 1-3)
npm test
```

The three MCP/SQL verification queries from the action body ARE the source of truth that the migration applied correctly. The shell `ls` + `grep` only confirm the local file shape.
  </verify>
  <done>
`supabase/migrations/20260425120000_account_availability_settings.sql` exists, is idempotent (uses `if not exists` on all four ADD COLUMN clauses), and is applied to the live Supabase project. The four columns exist on the `accounts` table with the documented types, NULL-ability, and DEFAULTs. The seeded `nsi` row reads back as `buffer_minutes=0, min_notice_hours=24, max_advance_days=14, daily_cap=NULL`. The negative CHECK test (`SET daily_cap = 0`) fails with `23514`. Existing Vitest suite still green.

Commit: `feat(04-01): add account availability settings migration`. Push.

If the migration apply produces a separate commit (rare; usually folded into Task 1), commit message: `chore(04-01): apply account availability settings migration to live project`.
  </done>
</task>

</tasks>

<verification>
```bash
# All three foundational pieces in place
ls components/ui/calendar.tsx supabase/migrations/20260425120000_account_availability_settings.sql
grep -q '"date-fns"' package.json && grep -q '"@date-fns/tz"' package.json && grep -q '"react-day-picker"' package.json && echo "all deps ok"

# Build + lint clean
npm run build
npm run lint

# Existing test suite still green (no regression)
npm test
```

Live-DB verification (the MCP/SQL queries from Task 3) is the authoritative confirmation that the migration landed. Shell verification only checks local artifacts.
</verification>

<success_criteria>
- [ ] `package.json` lists `date-fns@^4.1.0`, `@date-fns/tz@^1.4.1`, and `react-day-picker` under `dependencies`
- [ ] `components/ui/calendar.tsx` exists and imports `DayPicker` from `react-day-picker`
- [ ] `app/globals.css` contains `.day-blocked` and `.day-custom` CSS rules with `::after` dot markers
- [ ] `supabase/migrations/20260425120000_account_availability_settings.sql` exists, is idempotent, committed
- [ ] Migration applied to live Supabase project via MCP `apply_migration` (or `supabase db query --linked` fallback)
- [ ] `accounts` table has `buffer_minutes int NOT NULL DEFAULT 0`, `min_notice_hours int NOT NULL DEFAULT 24`, `max_advance_days int NOT NULL DEFAULT 14`, `daily_cap int NULL` — verified via `information_schema.columns`
- [ ] Seeded `nsi` row reads back with the documented defaults — verified via `SELECT ... WHERE slug = 'nsi'`
- [ ] Negative CHECK test (`SET daily_cap = 0`) fails with `23514` — verified
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Existing Vitest suite still green (no regression on auth, RLS, race, event-types tests)
- [ ] Each task committed atomically (3 commits + optional 4th for migration apply)
</success_criteria>

<output>
After completion, create `.planning/phases/04-availability-engine/04-01-SUMMARY.md` documenting:
- Final installed versions of `date-fns`, `@date-fns/tz`, `react-day-picker` (resolved exact versions from `npm ls`)
- shadcn CLI version that ran `add calendar` (likely 4.4.0 per Phase 3 STATE.md decision)
- Migration apply timestamp + Supabase MCP migration name
- Confirmed `accounts` column shape (output of the `information_schema.columns` query)
- Confirmed seeded nsi defaults (output of the `SELECT ... WHERE slug = 'nsi'` query)
- Result of the negative CHECK test (must have failed with 23514)
- Any deviation from RESEARCH §1 (deps) or RESEARCH §3 (migration)
</output>
