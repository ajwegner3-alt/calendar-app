---
phase: 40
plan: 06
subsystem: dead-code-audit
tags: [knip, dead-code, files, refactor, hygiene, knip-config]
requires: [40-05]
provides: ["1 unused file deleted; knip.json synced with locked KEEP residue (5 deps + 1 file glob + 6 @public JSDoc tags); npx knip exits 0 across all 4 categories"]
affects: [40-07]
tech-stack:
  added: []
  patterns: ["@public JSDoc tag as per-symbol knip suppression", "components/ui/** glob ignore for shadcn library-installed primitives", "ignoreDependencies array for runtime-non-import deps (CLI binaries, CSS-only imports, type-graph peers)"]
key-files:
  created: []
  modified:
    - knip.json
    - lib/oauth/encrypt.ts
    - lib/email-sender/types.ts
    - app/(shell)/app/bookings/_components/pushback-dialog-provider.tsx
    - app/(shell)/app/event-types/_lib/schema.ts
    - .planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md
  deleted:
    - components/welcome-card.tsx
metrics:
  duration: ~10 minutes (single agent execution)
  completed: 2026-05-09
---

# Phase 40 Plan 06: Remove Unused Files + Sync knip.json — Summary

**One-liner:** Deleted `components/welcome-card.tsx` (the lone Plan 06 file target) and fully synced `knip.json` with the locked KEEP residue — single atomic chore commit `2a1b665`; build green, vitest watermark held at 2, `npx knip` now exits 0 across all 4 categories with only 2 informational config hints (defensive policy locks).

## Outcome

**Files deleted (1):**

- `components/welcome-card.tsx` — Phase 02-02 dashboard scaffold (`ec56540`); superseded by `HomeCalendar` in Phase 12-04a; final pre-flight grep confirmed zero source-code importers in `app/`, `lib/`, or `tests/` (only `.planning/` documentation references — historical artifacts).

**knip.json edits (3 sections updated):**

| Section | Entries added | Total after edit |
| --- | --- | --- |
| `ignore` | `"components/ui/**"` (1 glob, covers all 42 shadcn/ui primitive exports) | 2 entries (slot-picker preserved) |
| `ignoreDependencies` | `"shadcn"`, `"tw-animate-css"`, `"supabase"`, `"tailwindcss"`, `"postcss-load-config"` | 5 entries (array created) |
| `ignoreExportsUsedInFile` | _(not used — see "Suppression mechanism choice" below)_ | n/a |

**Per-symbol `@public` JSDoc tags added (6 export sites):**

| File | Symbol | Reason |
| --- | --- | --- |
| `lib/oauth/encrypt.ts:94` | `generateKey` | CLI dev helper invoked via `node -e`; intentionally has no static-analysis-visible callers |
| `lib/email-sender/types.ts:5` | `EmailAttachment` (interface) | Used internally at line 29 by `EmailOptions.attachments`; transitive type-graph false-positive |
| `lib/email-sender/types.ts:46` | `EmailProvider` (type) | Composed into `EmailClientConfig` and `EmailClient` later in same file; type-graph false-positive |
| `lib/email-sender/types.ts:49` | `EmailClientConfig` (interface) | Provider factory parameter shape consumed by `account-sender.ts` via inference |
| `app/(shell)/app/bookings/_components/pushback-dialog-provider.tsx:44` | `usePushbackDialog` | Used at lines 109, 129 of same file by sibling components; intra-file cross-component miscounting |
| `app/(shell)/app/event-types/_lib/schema.ts:31` | `customQuestionSchema` | Used at line 82 via `z.array(customQuestionSchema)`; Zod runtime composition reference |

## Suppression mechanism choice

**Initial plan called for `ignoreExportsUsedInFile` as a file-keyed object** (e.g., `{ "path/to/file.ts": true }`). When applied, `npx knip` rejected the schema with `ERROR: Invalid input (location: ignoreExportsUsedInFile)` and exit code 2. Inspection of `node_modules/knip/schema.json` showed `ignoreExportsUsedInFile` is **boolean OR object-keyed-by-export-type** (e.g., `{ "interface": true, "type": true }`) — there is no per-file form in this knip version (6.x).

Pivoted to knip's officially-supported per-symbol mechanism: the **`@public` JSDoc tag** (`PUBLIC_TAG = '@public'` per `node_modules/knip/dist/constants.js:17`). Each KEEP residue at an export site receives an `@public` tag with rationale documented inline. Advantages:

1. **Locality** — rationale lives next to the symbol (future-Claude sees it in context, no jump to config).
2. **Granularity** — only the specific symbol is suppressed; legitimate future unused-export findings in the same file still surface.
3. **No global-config bloat** — knip.json stays compact; readers see only files/deps suppressions.
4. **Schema-supported** — knip's first-class export-suppression mechanism, not a workaround.

DECISIONS.md updated to record `(suppressed via: @public JSDoc tag at export site)` per KEEP residue.

## `lib/email-sender/index.ts` decision

Plan 05 SUMMARY noted this file was reduced to a documentation-only stub (all barrel re-exports removed; only `import "server-only"` + comment block remain). Pre-flight check considered deleting it as a Plan 06 cascade. **Outcome: kept as-is.** Reasoning:

- `npx knip` does NOT flag the file as unused. The `import "server-only"` directive marks it as a side-effect file; knip's heuristic preserves it.
- Production code does not import from `@/lib/email-sender` (bare specifier) — verified via repo-wide grep (excluding `.planning/`). Only test files import the bare specifier, and the vitest alias regex `/^@\/lib\/email-sender$/` fully intercepts those imports to `tests/__mocks__/email-sender.ts`. The real file is never loaded by tests.
- Therefore: the file's presence is a no-op at build time, and its inert documentation-marker comment is legitimately useful for future-Claude orientation.
- No knip suppression needed (it isn't flagged); no source change needed; no risk to delete OR keep.

Chose **keep** as the lower-risk, zero-change option. Plan 07's CI gate inherits a clean tree either way.

## Verification gates

| Gate | Status | Notes |
| --- | --- | --- |
| `npx knip` exit code | **0** | Across all 4 categories (files / deps / exports / types). Only 2 informational config hints remain: `slot-picker.tsx` "Remove from ignore" and `tests/setup.ts` "Remove redundant entry pattern" — both kept as defensive policy locks per Plan 01 SUMMARY (Plan 30-01 Rule 4 + RESEARCH.md MEDIUM-confidence note). Hints do NOT cause non-zero exit by default; Plan 07 may add `--no-config-hints` to the CI invocation if desired. |
| `npm run build` | **0** | All routes prerendered/server-rendered as before; no regressions. |
| `npx vitest run` | **2 failed / 353 passed / 9 skipped** | Watermark held: same pre-existing date-sensitive fixtures (`tests/bookings-api.test.ts`, `tests/slots-api.test.ts`); within budget (≤2). |
| `npx tsc --noEmit` | **42 lines (unchanged)** | All pre-existing test-file errors (`tests/reminder-cron.test.ts`, `tests/upgrade-action.test.ts`); no new errors from welcome-card deletion or `@public` tag additions. |
| `git diff HEAD~1 -- supabase/migrations/` | **empty** | SQL migrations untouched (`supabase/**` excluded from project glob). |
| `slot-picker.tsx` exists | **YES** | Still at `app/[account]/[event-slug]/_components/slot-picker.tsx`; ignore entry preserved. |
| Vercel deploy | **deferred to Andrew** | Push to `origin/main` succeeded (commit `2a1b665`); Vercel auto-deploy will trigger from main; manual confirmation in Plan 07 manual-QA pass. |

## Commits landed

| Commit | Message | Files changed |
| --- | --- | --- |
| `2a1b665` | `chore(40): remove unused files` | 7 files (1 deleted, 6 modified) — 49 insertions, 74 deletions |

## Phase 40 cumulative impact (Plans 03-06)

| Plan | Commit | Category | Items removed |
| --- | --- | --- | --- |
| 40-03 | `14fb48c` | Unused dependencies | 3 (`nodemailer`, `@types/nodemailer`, `@eslint/eslintrc`) |
| 40-04 | n/a (no-op) | Duplicate exports | 0 (knip reported zero duplicates) |
| 40-05 | `1cbb273` | Unused exports | 22 (15 whole-symbol + 7 export-keyword-only) across 12 files; 138 lines deleted |
| 40-06 | `2a1b665` | Unused files | 1 (`components/welcome-card.tsx`); 64 source lines deleted |

**Cumulative totals:**
- **Files deleted:** 1
- **Dependencies removed:** 3
- **Exports removed:** 22 (whole-symbol + export-keyword-only combined)
- **Source lines removed:** ~202 (138 from Plan 05 + 64 from Plan 06's welcome-card)
- **knip.json suppressions added (Plan 06):** 1 ignore glob, 5 ignoreDependencies entries
- **`@public` JSDoc tags added (Plan 06):** 6 (covering all module-internal-use KEEP residue)

## Decisions Made

1. **Used `@public` JSDoc tag instead of `ignoreExportsUsedInFile` config** — knip 6.x does not support per-file form of that flag; `@public` is the official per-symbol mechanism with locality and rationale-in-context advantages.

2. **Kept `lib/email-sender/index.ts` as inert documentation marker** — knip does not flag it (server-only side-effect file); test imports of the bare specifier are fully intercepted by vitest alias; deletion would have been a no-op cosmetic change with marginal risk.

3. **Single `components/ui/**` glob ignore** for all 42 shadcn/ui primitive exports — clean blanket policy matching DECISIONS.md prescription; one entry covers all current and future shadcn-installed primitives.

4. **Preserved both informational config hints** (slot-picker ignore + tests/setup.ts entry) — both are policy locks per Plan 01 SUMMARY; hints are non-fatal in default knip exit-code semantics; Plan 07 can add `--no-config-hints` to CI invocation if quieter output is desired.

5. **Atomic single-commit landing** — deletion + knip.json sync + JSDoc tag additions + DECISIONS.md updates all in `2a1b665`. Per CONTEXT.md commit-cadence rule: gate runs after the commit, with `git revert HEAD` as the rollback if any gate had failed. All gates green; no revert needed.

## Next Phase Readiness

**Plan 07 (Wave 7 — knip CI gate) is unblocked.**

- All 4 removal commits exist on `origin/main` (`14fb48c` → `1cbb273` → `2a1b665`; the no-op Plan 04 has no chore commit, only its docs commit `fa30c43`).
- Codebase is knip-clean: `npx knip` exits 0 across all 4 categories.
- KEEP residue is 100% suppressed (no items punted to Plan 07).
- knip.json is now the standing source of truth for "what's intentionally kept despite knip flagging."

**Suggestions for Plan 07:**

1. Add `npx knip` (or `npx knip --no-config-hints`) as a CI gate in `.github/workflows/`. Decide exit-code policy: fail PR on any unused-files/exports/deps OR allow informational hints.
2. Add `npm run knip` script alias to `package.json` for local dev convenience.
3. Consider adding `npx knip --reporter json` output capture for trend tracking (optional).
4. Run final v1.7 manual QA pass (Phase 38 A-D + Phase 39 A-C regressions) on production after Vercel deploy completes; close v1.7 milestone.

## Files modified

**Source code:**
- `lib/oauth/encrypt.ts` — added `@public` JSDoc tag at line ~88-93 above `generateKey`.
- `lib/email-sender/types.ts` — added `@public` JSDoc tags above `EmailAttachment`, `EmailProvider`, `EmailClientConfig`.
- `app/(shell)/app/bookings/_components/pushback-dialog-provider.tsx` — added `@public` JSDoc tag above `usePushbackDialog`.
- `app/(shell)/app/event-types/_lib/schema.ts` — added `@public` JSDoc tag above `customQuestionSchema`.

**Source code (deleted):**
- `components/welcome-card.tsx` — entire file removed.

**Configuration:**
- `knip.json` — added `components/ui/**` to `ignore`; created `ignoreDependencies` array with 5 entries.

**Audit log:**
- `.planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md` — extended each "Final KEEP list → Exports" entry with `(suppressed via: @public JSDoc tag at export site)` or `(suppressed via: knip.json ignore: ["components/ui/**"])` documentation tag.
