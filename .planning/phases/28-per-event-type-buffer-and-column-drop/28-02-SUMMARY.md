---
phase: 28-per-event-type-buffer-and-column-drop
plan: 02
subsystem: database
tags: [supabase, postgres, migration, ddl, drop-column, two-step-deploy, cp-03]

# Dependency graph
requires:
  - phase: 28-per-event-type-buffer-and-column-drop
    provides: "Plan 28-01 deployed; event_types.buffer_after_minutes is sole post-event buffer source; lib/ + app/api/ no longer read accounts.buffer_minutes"
provides:
  - "accounts.buffer_minutes column dropped from production Postgres (information_schema returns 0 rows)"
  - "Availability settings page renders 3-field grid (no Buffer field); subtitle reads 'notice and caps'"
  - ".SKIP rollback artifact filed in supabase/migrations/ per CP-03 convention"
  - "Drain grep gate enforced as zero-match across app/ + lib/"
  - "AccountSettingsRow type and accountSettingsSchema Zod object no longer carry buffer_minutes"
affects: [28-03-divergence-tests-and-smoke, 29-audience-rebrand, 30-public-booker-3-column-desktop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CP-03 two-step DROP: deploy code that stops reading the column → drain → DROP migration → cleanup deploy"
    - ".SKIP rollback artifact convention: same timestamp prefix as DROP migration, .SKIP suffix prevents Supabase auto-apply"
    - "Drain gate waiver pattern: when product has zero traffic, the drain protects only theoretical warm-instance state; waiver acceptable when documented in STATE.md with rationale"
    - "Doc-comment scrubbing as part of grep gate: literal token gates require removing historical references in comments, not just live code paths"

key-files:
  created:
    - "supabase/migrations/20260504004202_v15_drop_accounts_buffer_minutes.sql"
    - "supabase/migrations/20260504004202_readd_accounts_buffer_minutes.sql.SKIP"
  modified:
    - "app/(shell)/app/availability/_lib/types.ts"
    - "app/(shell)/app/availability/_lib/schema.ts"
    - "app/(shell)/app/availability/_lib/queries.ts"
    - "app/(shell)/app/availability/_lib/actions.ts"
    - "app/(shell)/app/availability/_components/settings-panel.tsx"
    - "app/(shell)/app/availability/page.tsx"
    - "lib/slots.ts"
    - "app/(shell)/app/event-types/_lib/schema.ts"

key-decisions:
  - "Drain gate (CP-03) WAIVED by Andrew on 2026-05-04 — no booking traffic on product (single-tenant nsi only); residual risk accepted"
  - "Scrubbed two surviving doc-comment references to satisfy literal grep gate (lib/slots.ts:207-210, event-types/_lib/schema.ts:66-68); plan's gate explicitly mandates 0 matches anywhere in app/ + lib/"
  - "Left settings-panel grid as sm:grid-cols-2 (auto-flow) — plan permits this when grid wasn't hard-coded to 4 columns; 3 fields render as 2+1 on sm+ which is acceptable per plan's no-hard-cols-change guidance"

patterns-established:
  - "Drain gate waiver pattern: STATE.md decision with explicit rationale + acceptance unblocks CP-03 when traffic is verifiably zero"
  - "Two-commit cleanup ordering: Task 2 (cleanup) commits first to clear grep gate; Task 1 (DROP) commits second after migration applies; pushed together as a single deploy"

# Metrics
duration: 11min
completed: 2026-05-04
---

# Phase 28 Plan 02: DROP Column and Availability Cleanup Summary

**`accounts.buffer_minutes` permanently dropped from production Postgres after CP-03 drain gate was waived (zero booking traffic); availability settings panel scrubbed of buffer field with one-word subtitle edit; rollback artifact filed as `.SKIP` per convention.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-04T00:36:24Z
- **Completed:** 2026-05-04T00:47:38Z
- **Push to main:** 2026-05-04T00:43:04Z UTC (Vercel deploy "Ready" inferred from /api/slots smoke at T0+~4min)
- **Tasks:** 3 of 3 complete (drain checkpoint waived, then Task 2 → Task 1 → Task 3 per plan's intentional order inversion)
- **Files changed:** 10 (2 SQL created, 8 TypeScript/TSX modified)

## Drain Status

**WAIVED 2026-05-04 by Andrew.** Documented in `.planning/STATE.md` "Drain gate (CP-03) — WAIVED 2026-05-04 by Andrew" section.

- Original gate: T0 + 30 min = `2026-05-04T00:57:49Z UTC` minimum (T0 = 28-01 push at 2026-05-04T00:27:49Z)
- Waiver rationale (per STATE.md): No active booking traffic on the product (single-tenant nsi, no public bookers active). The drain protects warm pre-28-01 `/api/slots` instances from 500'ing on a dropped column; with zero traffic, those instances stay cold and serverless idles them out (~15 min) before any request lands. Andrew accepted residual risk (bots / monitoring / self-traffic during deploy window).
- Plan 28-02 launched at `2026-05-04T00:36:24Z UTC` — ~9 min after 28-01 push, ahead of the original 30-min gate.
- The drain checkpoint was therefore treated as resolved/approved before Plan 28-02 began executing auto tasks.

## Pre-DROP Drain Grep Gate

Run after Task 2 (availability cleanup + doc-comment scrubs) committed:

```bash
$ grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"
$ echo "EXIT_CODE=$?"
EXIT_CODE=1
```

Exit code 1 from grep = no matches. Gate passed before DROP migration applied.

LD-01 cross-check — `grep -rn "post_buffer_minutes" app/ lib/ supabase/ --include="*.ts" --include="*.tsx" --include="*.sql"` → exit 1 (no matches anywhere in code or migrations).

## DROP Migration & Rollback Artifact

- **DROP migration:** `supabase/migrations/20260504004202_v15_drop_accounts_buffer_minutes.sql`
  - Body: `BEGIN; DO $$ BEGIN RAISE NOTICE ...; END $$; ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes; COMMIT;`
  - Pattern matches Phase 21 DROP precedent (`20260502034300_v12_drop_deprecated_branding_columns.sql`)
- **Rollback artifact:** `supabase/migrations/20260504004202_readd_accounts_buffer_minutes.sql.SKIP`
  - Same timestamp prefix as DROP, `.SKIP` suffix prevents Supabase auto-apply
  - Body re-adds `buffer_minutes INT NOT NULL DEFAULT 0` if a critical regression forces emergency rollback
- **Apply path:** `echo | npx supabase db query --linked -f supabase/migrations/20260504004202_v15_drop_accounts_buffer_minutes.sql` (the only working path in this repo per STACK.md)

## Post-DROP information_schema Verification

```bash
$ echo "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'buffer_minutes';" | npx supabase db query --linked
{
  "boundary": "02ffa62d73d26a6c8f18c94d6e8c160c",
  "rows": []
}
```

`rows: []` → 0 rows. Column permanently dropped. ROADMAP success-criterion-5 satisfied.

## Production Smoke Check

- **Push to origin/main:** `2026-05-04T00:43:04Z UTC` (push completed at T+2s)
- **Vercel deploy:** Auto-triggered from main; Ready before smoke at `00:47:03Z` (deploy time ≈ 3-4 min)
- **Smoke check:**
  - URL: `https://calendar-app-xi-smoky.vercel.app/api/slots?event_type_id=5db348b8-7eae-4de9-a5ec-1dd2593ffac4&from=2026-05-07&to=2026-05-07`
  - HTTP: **200**
  - Body: `{"slots":[{"start_at":"2026-05-07T14:00:00.000Z","end_at":"2026-05-07T14:30:00.000Z"},...]}` (real slot list)
- **Today smoke:** `from=2026-05-04&to=2026-05-04` → HTTP 200, `{"slots":[]}` (Sunday + nsi has no Sunday hours, expected empty)
- **Conclusion:** Slot engine works post-DROP; no 500s; no `column "buffer_minutes" does not exist` errors. Plan 28-01's rewire successfully removed all reads of the dropped column before DROP applied.

## Task Commits

1. **Task 2: Remove buffer_minutes from availability settings panel** — `653e620` (refactor)
   - 8 files changed (6 availability files + 2 doc-comment scrubs in lib/slots.ts and event-types/_lib/schema.ts)
   - 10 insertions / 34 deletions
   - Cleared the drain grep gate in app/ + lib/
2. **Task 1: DROP accounts.buffer_minutes (CP-03 two-step complete)** — `dfb421f` (feat)
   - 2 files created (DROP SQL + .SKIP rollback)
   - 42 insertions
   - Migration applied to production via `echo | npx supabase db query --linked -f`
3. **Task 3: Push 28-02 commits + verify production deploy** — no source edits; push UTC `2026-05-04T00:43:04Z`; smoke 200; final information_schema 0 rows

**Plan metadata commit:** (created next, alongside STATE.md update)

## Files Created/Modified

### Created
- `supabase/migrations/20260504004202_v15_drop_accounts_buffer_minutes.sql` — DROP migration applied to production.
- `supabase/migrations/20260504004202_readd_accounts_buffer_minutes.sql.SKIP` — Rollback artifact (held inactive via `.SKIP` suffix).

### Modified — availability feature (6 files, plan-specified)
- `app/(shell)/app/availability/_lib/types.ts` — `AccountSettingsRow` no longer carries `buffer_minutes`.
- `app/(shell)/app/availability/_lib/schema.ts` — `accountSettingsSchema` Zod object no longer validates `buffer_minutes`.
- `app/(shell)/app/availability/_lib/queries.ts` — accounts SELECT drops `buffer_minutes`.
- `app/(shell)/app/availability/_lib/actions.ts` — `accounts.update()` payload drops `buffer_minutes`.
- `app/(shell)/app/availability/_components/settings-panel.tsx` — Removed prop, useState, save-call entry, and `<Field id="buffer_minutes">` JSX block (4 surgical removals). Grid stays `sm:grid-cols-2` auto-flow.
- `app/(shell)/app/availability/page.tsx` — Drops `buffer_minutes` prop on `<SettingsPanel>`; subtitle "buffers, notice, and caps" → "notice and caps" (one-word edit).

### Modified — doc-comment scrubs (2 files, deviation Rule 3 — blocking)
- `lib/slots.ts` (lines 207-210) — Reworded historical reference from "v1.0's symmetric account-wide `buffer_minutes`" to "the legacy v1.0 symmetric account-wide post-event buffer". No functional change.
- `app/(shell)/app/event-types/_lib/schema.ts` (lines 66-69) — Reworded LD-01 anchor comment from "replaces accounts.buffer_minutes" to "replaces the legacy account-wide buffer column". No functional change.

## Decisions Made

- **Drain gate WAIVED:** Andrew accepted residual risk on 2026-05-04 because the product has zero booking traffic. Decision recorded in STATE.md before Plan 28-02 launched. Treated the checkpoint as resolved/approved and proceeded directly to auto tasks. Note: served drains remain the default pattern for future phases when traffic is non-zero.
- **Doc-comment scrubs as Rule 3 auto-fix:** Plan 28-02 Task 2 Step 7 explicitly requires `grep -rn "buffer_minutes" app/ lib/` returns 0 matches "anywhere in app/ or lib/". Two doc-comment references survived Plan 28-01 (one in `lib/slots.ts` historical reference, one in the event-types schema's LD-01 anchor comment). Treated as Rule 3 (blocking — prevents Task 1 from running) and removed inline within the Task 2 commit. No functional code changed.
- **Settings-panel grid left as `sm:grid-cols-2`:** Plan permits this when the grid wasn't hard-coded to 4 columns. With 3 fields the grid renders as 2+1 on sm+, which is visually acceptable. No grid-cols change made.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Doc-comment scrubs in lib/slots.ts and event-types/_lib/schema.ts**

- **Found during:** Task 2 Step 7 (grep gate validation)
- **Issue:** Plan 28-01 left two doc-comment references to the literal token `buffer_minutes` (one in `lib/slots.ts` describing the legacy symmetric model, one in `app/(shell)/app/event-types/_lib/schema.ts` anchoring LD-01). The plan's grep gate is literal — "0 matches anywhere in app/ or lib/" — so doc-comments would block the DROP migration.
- **Fix:** Reworded both comments to describe the legacy model without naming the soon-to-be-dropped column. No code semantics changed; only prose.
- **Files modified:** `lib/slots.ts`, `app/(shell)/app/event-types/_lib/schema.ts`
- **Verification:** `grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"` exit 1 (no matches). tsc clean for app/ + lib/.
- **Committed in:** `653e620` (Task 2 commit, alongside the 6 plan-specified availability files)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking).
**Impact on plan:** Necessary to clear the literal grep gate that gates the DROP migration. Zero scope creep — pure prose edit in two doc-comments. The plan's grep gate explicitly demands 0 matches anywhere in `app/ + lib/`, and doc-comments fall within that scope.

## Issues Encountered

- **First smoke check returned HTTP 400, not the smoke target.** The plan's example smoke URL uses `account=nsi&event_type=<slug>` query params, but the actual `/api/slots` route handler (Plan 28-01-defined) requires `event_type_id` (UUID). Re-ran the smoke with `event_type_id=<uuid>` and got HTTP 200 with valid slot JSON. This is a plan example-URL mismatch, not a regression — the route handler's contract was set by Plan 28-01 and the slot engine works as designed.
- **Pre-existing tsc errors in tests/.** `npx tsc --noEmit` reports 33 errors, all in `tests/` and all pre-existing on `main` (test mock helpers like `__setTurnstileResult`, `__mockSendCalls` that are runtime-only or test-setup symbols). None in `app/` or `lib/`. None caused by Plan 28-02 changes. Plan 28-03 may want to address these as part of the test cleanup phase.

## User Setup Required

None — no external service configuration required. Andrew's only follow-up actions:
1. Confirm the Vercel deploy for commit `dfb421f` reached "Ready" on the dashboard (smoke check at T0+~4min already returned HTTP 200, so this is informational).
2. Optionally load `https://calendar-app-xi-smoky.vercel.app/app/availability` in a browser to confirm the 3-field grid renders cleanly with the new "notice and caps" subtitle (Plan 28-03's Andrew live-verify scope).

## Next Phase Readiness

**Plan 28-03 (divergence tests + smoke) is UNBLOCKED.**

Available for Plan 28-03 to consume:
- DB column `accounts.buffer_minutes` is gone; `event_types.buffer_after_minutes` is the sole post-event buffer mechanism.
- BUFFER-06 divergence describe block (3 tests) already shipped in 28-01; 28-03 may extend or accept as complete.
- Production smoke already passes for `/api/slots` post-DROP (HTTP 200 with real slot JSON).

Concerns for Plan 28-03:
- Pre-existing 33 tsc errors in `tests/` are NOT caused by Phase 28; they may surface during 28-03's CI/test gates if it runs `tsc --noEmit` against the full project. Consider scoping tsc to `app/ + lib/ + tests/slot-generation.test.ts` (the BUFFER-06 file) or addressing the test-mock symbol exports as a separate cleanup.

---
*Phase: 28-per-event-type-buffer-and-column-drop*
*Completed: 2026-05-04 (UTC)*
