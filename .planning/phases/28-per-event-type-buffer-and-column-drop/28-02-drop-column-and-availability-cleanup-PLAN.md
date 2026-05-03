---
phase: 28-per-event-type-buffer-and-column-drop
plan: 02
type: execute
wave: 2
depends_on: ["28-01"]
files_modified:
  - supabase/migrations/<TS>_v15_drop_accounts_buffer_minutes.sql
  - supabase/migrations/<TS>_readd_accounts_buffer_minutes.sql.SKIP
  - app/(shell)/app/availability/_lib/types.ts
  - app/(shell)/app/availability/_lib/schema.ts
  - app/(shell)/app/availability/_lib/queries.ts
  - app/(shell)/app/availability/_lib/actions.ts
  - app/(shell)/app/availability/_components/settings-panel.tsx
  - app/(shell)/app/availability/page.tsx
autonomous: false

must_haves:
  truths:
    - "Drain window of ≥30 minutes since 28-01 deploy is confirmed by Andrew before any 28-02 work runs"
    - "`grep -rn 'buffer_minutes' app/ lib/` returns 0 matches after availability cleanup, before DROP migration runs"
    - "`accounts.buffer_minutes` column no longer exists in production (information_schema query returns 0 rows)"
    - "Availability settings page has no Buffer field; remaining 3-field grid (min_notice_hours, max_advance_days, daily_cap) renders cleanly"
    - "Page subtitle updated from 'buffers, notice, and caps' to 'notice and caps' (one-word edit)"
    - "tsc --noEmit clean and Vercel deploy of 28-02 succeeds"
  artifacts:
    - path: "supabase/migrations/<TS>_v15_drop_accounts_buffer_minutes.sql"
      provides: "ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes"
      contains: "DROP COLUMN IF EXISTS buffer_minutes"
    - path: "supabase/migrations/<TS>_readd_accounts_buffer_minutes.sql.SKIP"
      provides: "CP-03 rollback artifact (.SKIP suffix prevents auto-apply)"
      contains: "ADD COLUMN"
    - path: "app/(shell)/app/availability/_components/settings-panel.tsx"
      provides: "Settings panel with no buffer field, no buffer state, no buffer in save call"
    - path: "app/(shell)/app/availability/page.tsx"
      provides: "Availability page with no buffer prop and updated subtitle"
  key_links:
    - from: "drain gate (grep)"
      to: "DROP migration"
      via: "Hard block — migration only runs if grep returns 0"
      pattern: "buffer_minutes"
    - from: "Andrew drain confirmation checkpoint"
      to: "all 28-02 work"
      via: "checkpoint:human-verify gates entire plan"
      pattern: "T0 + 30 minutes"
---

<objective>
Complete the CP-03 two-step DROP after the mandatory ≥30-minute drain: confirm 28-01 has been live long enough, run the grep gate to prove no code reads `buffer_minutes`, apply the DROP migration to production, clean up the availability settings page, and ship the cleanup deploy.

Purpose: Permanently remove `accounts.buffer_minutes` so the per-event-type column is the sole source of truth. The 30-minute drain ensures any in-flight Vercel function invocations that loaded the old code have terminated before the column is dropped (V15-MP-02 mitigation).

Output: Column dropped from production Postgres; availability page shows 3-field settings grid; cleanup commit deployed; Plan 28-03 unblocked for tests + smoke.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/28-per-event-type-buffer-and-column-drop/28-CONTEXT.md
@.planning/phases/28-per-event-type-buffer-and-column-drop/28-RESEARCH.md
@.planning/phases/28-per-event-type-buffer-and-column-drop/28-01-SUMMARY.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md

# Source files for availability cleanup (read before editing)
@app/(shell)/app/availability/_lib/types.ts
@app/(shell)/app/availability/_lib/schema.ts
@app/(shell)/app/availability/_lib/queries.ts
@app/(shell)/app/availability/_lib/actions.ts
@app/(shell)/app/availability/_components/settings-panel.tsx
@app/(shell)/app/availability/page.tsx

# Phase 21 DROP migration template (CP-03 precedent)
@supabase/migrations/20260502034300_v12_drop_deprecated_branding_columns.sql
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Plan 28-01 has shipped and the drain window is presumed to be active.</what-built>
  <how-to-verify>
1. Open the Vercel dashboard for the calendar-app project.
2. Confirm the most recent deployment is the 28-01 commit ("feat(28-01): expose buffer_after_minutes ...") in `Ready` status.
3. Read the deploy timestamp T0 from the dashboard (or from `28-01-SUMMARY.md`).
4. Confirm the current UTC time is at least T0 + 30 minutes. If not, wait the remaining time before approving.
5. Confirm `https://<prod-url>/api/slots?account=nsi&event_type=<slug>&from=<today>&to=<today>` still returns 200 (the drain didn't introduce a regression).

Expected outcome: ≥30 minutes have elapsed since 28-01 deploy went Ready, and production slots API is healthy.
  </how-to-verify>
  <resume-signal>Type "drain confirmed: T0=&lt;timestamp&gt; elapsed=&lt;minutes&gt;" to proceed, or describe what looks wrong.</resume-signal>
</task>

<task type="auto">
  <name>Task 1: Run drain grep gate, then apply DROP migration</name>
  <files>
supabase/migrations/&lt;TS&gt;_v15_drop_accounts_buffer_minutes.sql
supabase/migrations/&lt;TS&gt;_readd_accounts_buffer_minutes.sql.SKIP
  </files>
  <action>
Step 1 — Drain gate (HARD BLOCKER from STATE.md). Run:
```bash
grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"
```
Per CONTEXT this MUST return 0 matches before DROP applies. **EXPECTED at this point in the plan: matches still exist in `app/(shell)/app/availability/_lib/` and `_components/settings-panel.tsx` — those are the cleanup targets in Task 2.**

So the order is intentionally inverted from the STATE.md phrasing: we clean availability first, THEN the grep returns 0, THEN the DROP runs. To follow CONTEXT exactly, do this:

a. Skip ahead to Task 2 and complete the availability cleanup edits (types.ts, schema.ts, queries.ts, actions.ts, settings-panel.tsx, page.tsx).
b. Run `npx tsc --noEmit` to confirm the cleanup compiles cleanly.
c. Re-run the grep gate. NOW it must return 0 matches anywhere in `app/` and `lib/`.
d. Only after the grep gate passes 0, return to this task and apply the DROP migration.

(Equivalent restated: Task 2 is a prerequisite of the DROP migration. Execute Task 2 first; then perform the steps below.)

Step 2 — Author the DROP migration. Use a UTC timestamp matching the convention. Filename: `supabase/migrations/<TS>_v15_drop_accounts_buffer_minutes.sql`.

Body (CP-03 pattern from Phase 21 precedent):
```sql
BEGIN;
  DO $$ BEGIN RAISE NOTICE 'v1.5 Phase 28 DROP migration: accounts.buffer_minutes'; END $$;
  ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes;
COMMIT;
```

Step 3 — Author the rollback artifact (CP-03 convention — `.SKIP` suffix prevents Supabase from auto-applying it). Filename: `supabase/migrations/<TS>_readd_accounts_buffer_minutes.sql.SKIP` (use the SAME timestamp prefix as the DROP).

Body:
```sql
-- ROLLBACK FOR v1.5 Phase 28 DROP — held as .SKIP per CP-03 convention
-- DO NOT RENAME without an intentional rollback decision
BEGIN;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS buffer_minutes INT NOT NULL DEFAULT 0;
COMMIT;
```

Step 4 — Apply the DROP migration:
```bash
echo | npx supabase db query --linked -f supabase/migrations/<TS>_v15_drop_accounts_buffer_minutes.sql
```

Step 5 — Verify column is gone:
```bash
echo "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'buffer_minutes';" | npx supabase db query --linked
```
Expected: 0 rows.

Step 6 — Commit:
```bash
git add supabase/migrations/<TS>_v15_drop_accounts_buffer_minutes.sql supabase/migrations/<TS>_readd_accounts_buffer_minutes.sql.SKIP
git commit -m "feat(28-02): DROP accounts.buffer_minutes (CP-03 two-step complete)"
```
  </action>
  <verify>
- Drain grep gate returned 0 matches in `app/` and `lib/` BEFORE DROP migration ran (this is achieved by completing Task 2 first)
- DROP migration file exists with `BEGIN/COMMIT` and `IF EXISTS` guard
- `.SKIP` rollback artifact exists with the same timestamp prefix
- `information_schema.columns` query returns 0 rows for `accounts.buffer_minutes`
- Both files committed
  </verify>
  <done>
`accounts.buffer_minutes` is permanently dropped from production Postgres. Rollback artifact is available locally if a future emergency requires re-adding (must be intentionally renamed from `.SKIP` to apply). Per-event-type buffer is now the sole owner-facing buffer mechanism.
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove buffer field from availability settings (do FIRST per Task 1 Step 1)</name>
  <files>
app/(shell)/app/availability/_lib/types.ts
app/(shell)/app/availability/_lib/schema.ts
app/(shell)/app/availability/_lib/queries.ts
app/(shell)/app/availability/_lib/actions.ts
app/(shell)/app/availability/_components/settings-panel.tsx
app/(shell)/app/availability/page.tsx
  </files>
  <action>
**Execution order: this task runs BEFORE the DROP migration step in Task 1.** The grep gate cannot pass while these files still reference `buffer_minutes`.

The goal is silent removal of the Buffer field with one supporting subtitle edit (RESEARCH "Availability Page Copy Decision" recommendation, accepted under "Claude's Discretion" in CONTEXT).

Step 1 — `app/(shell)/app/availability/_lib/types.ts`:
- Around line 23: REMOVE `buffer_minutes: number;` from `AccountSettingsRow`. After change, the interface should have `min_notice_hours`, `max_advance_days`, `daily_cap`, `timezone` only (verify against the current file before assuming line numbers).

Step 2 — `app/(shell)/app/availability/_lib/schema.ts`:
- Around lines 134-139: REMOVE the entire `buffer_minutes` field block from `accountSettingsSchema`. Be careful with surrounding commas — the resulting object literal must remain valid Zod syntax.

Step 3 — `app/(shell)/app/availability/_lib/queries.ts`:
- Around line 53: REMOVE `buffer_minutes,` from the accounts SELECT string.

Step 4 — `app/(shell)/app/availability/_lib/actions.ts`:
- Around line 64: REMOVE `buffer_minutes: parsed.data.buffer_minutes,` from the `accounts.update()` payload object.

Step 5 — `app/(shell)/app/availability/_components/settings-panel.tsx`:
- Around line 15: REMOVE `buffer_minutes: number;` from `SettingsPanelProps.initial`.
- Around lines 24-25: REMOVE the `bufferMinutes` `useState` line entirely.
- Around lines 47-48: REMOVE `buffer_minutes: Number(bufferMinutes),` from the save call payload.
- Around lines 74-85: REMOVE the entire `<Field id="buffer_minutes" ... />` JSX block (the "Buffer (minutes)" input, label, and helper text).
- After removal, verify the remaining 3 fields render in the same grid layout. Do NOT change grid column count or spacing — the existing grid likely auto-flows; one fewer item is fine. If the grid was hard-coded to `grid-cols-4`, change to `grid-cols-3` to keep visual balance. (Read the JSX before editing to confirm.)

Step 6 — `app/(shell)/app/availability/page.tsx`:
- Around line 49: REMOVE `buffer_minutes: state.account.buffer_minutes,` from the `<SettingsPanel initial={...}>` prop object.
- Find the page subtitle text. Per RESEARCH, it currently reads: "Define when people can book and customize buffers, notice, and caps." Change "buffers, notice, and caps" to "notice and caps" — one-word edit (RESEARCH recommendation, CONTEXT-approved). Resulting subtitle: "Define when people can book and customize notice and caps." Do NOT change the page title ("Availability") or other section headings ("Weekly hours", "Date overrides", "Booking settings"). Do NOT add a cross-link to the event-type editor.

Step 7 — Verify locally:
```bash
npx tsc --noEmit
grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"
```
- tsc must be clean.
- grep must return 0 matches. If any match remains anywhere in `app/` or `lib/`, fix it before continuing.

Step 8 — Commit (do NOT push yet — push after the DROP migration commits in Task 1):
```bash
git add app/\(shell\)/app/availability/
git commit -m "refactor(28-02): remove buffer_minutes from availability settings panel"
```

Step 9 — RETURN to Task 1 to complete the DROP migration.
  </action>
  <verify>
- `npx tsc --noEmit` is clean
- `grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"` returns 0 matches
- Availability page subtitle updated to "notice and caps"
- Settings panel renders 3 fields (min_notice_hours, max_advance_days, daily_cap) without layout glitches — verify by loading the page locally if practical
- Commit landed locally
  </verify>
  <done>
The availability settings page no longer offers an account-wide buffer control. Code is ready for the DROP migration in Task 1 to apply cleanly.
  </done>
</task>

<task type="auto">
  <name>Task 3: Push 28-02 commits and verify production deploy</name>
  <files>(no source edits — git + verify only)</files>
  <action>
Step 1 — Confirm both commits from Tasks 1 and 2 exist on the local branch:
```bash
git log --oneline -n 5
```
Expected: most recent commits include "feat(28-02): DROP accounts.buffer_minutes (CP-03 two-step complete)" and "refactor(28-02): remove buffer_minutes from availability settings panel".

Step 2 — Push to origin/main:
```bash
git push origin main
```

Step 3 — Watch the Vercel deploy succeed. When status is `Ready`, run a smoke check:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-url>/api/slots?account=nsi&event_type=<slug>&from=<today>&to=<today>
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-url>/app/availability
```
Both expected: 200 (the second may be 200/302 depending on auth — adjust expectation if redirect to login is normal). The slots API hitting 500 here is the canary that something downstream still expected `accounts.buffer_minutes`.

Step 4 — Final production-state check:
```bash
echo "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'buffer_minutes';" | npx supabase db query --linked
```
Expected: 0 rows. (This is the ROADMAP success-criterion-5 verification.)

Step 5 — Record outcomes in SUMMARY.
  </action>
  <verify>
- Both 28-02 commits are pushed and the Vercel deploy is `Ready`
- Production `/api/slots` smoke returns 200
- `information_schema.columns` query confirms column is gone
  </verify>
  <done>
CP-03 two-step deploy is complete. Both deploys live, column dropped, no buffer_minutes anywhere in code or database. Plan 28-03 (tests + Andrew live verify) is unblocked.
  </done>
</task>

</tasks>

<verification>
End-of-plan checks:

```bash
# DB state
echo "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'buffer_minutes';" | npx supabase db query --linked
# Expected: 0 rows

# Code state
grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"
# Expected: 0 matches anywhere

grep -rn "post_buffer_minutes" . --include="*.ts" --include="*.tsx" --include="*.sql"
# Expected: 0 matches anywhere (LD-01 enforcement)

# Type & test gates
npx tsc --noEmit
npx vitest run

# Production smoke
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-url>/api/slots?account=nsi&event_type=<slug>&from=<today>&to=<today>
# Expected: 200
```
</verification>

<success_criteria>
1. Andrew confirmed ≥30-min drain between 28-01 and 28-02 deploys.
2. `grep -rn "buffer_minutes" app/ lib/` returned 0 matches BEFORE the DROP migration applied.
3. `accounts.buffer_minutes` column dropped (`information_schema` returns 0 rows for it).
4. `.SKIP` rollback artifact exists in `supabase/migrations/`.
5. Availability page renders 3 settings fields (no Buffer field); subtitle reads "notice and caps".
6. 28-02 deploy is `Ready` on Vercel; production smoke passes.
</success_criteria>

<output>
After completion, create `.planning/phases/28-per-event-type-buffer-and-column-drop/28-02-SUMMARY.md` with:
- T0 (28-01 deploy time) and actual elapsed drain duration confirmed by Andrew
- Pre-DROP grep result (must show 0 in the recorded grep output)
- Post-DROP `information_schema` query result (0 rows confirmed)
- DROP migration filename and rollback `.SKIP` filename
- 28-02 deploy timestamp and smoke check status
- Any deviations from the plan with rationale
</output>
