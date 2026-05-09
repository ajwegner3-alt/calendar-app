---
phase: 40-dead-code-audit
plan: 01
subsystem: testing
tags: [knip, dead-code, audit, devtooling, ci-prep]

# Dependency graph
requires:
  - phase: 30-...
    provides: "slot-picker.tsx canonical-keep precedent (Plan 30-01 Rule 4)"
  - phase: 35-per-account-gmail-oauth-send
    provides: "Phase 35-06 retired SMTP/nodemailer path (informs nodemailer REMOVE seed)"
  - phase: 39-booker-polish
    provides: "Stable green build to baseline against"
provides:
  - "knip@6.12.1 installed as devDependency"
  - "knip.json with locked ignore (slot-picker) and entry list (tests/setup, tests/helpers)"
  - "4 npm scripts: knip / knip:report / knip:json / knip:ci"
  - "Baseline 40-KNIP-REPORT.md (curated, REMOVE/KEEP/INVESTIGATE seeded) + 40-KNIP-REPORT.json (raw)"
affects:
  - 40-02-andrew-decision-checkpoint
  - 40-03..40-06 (per-category removal commits)
  - 40-07 (CI gate via .github/workflows/knip.yml)

# Tech tracking
tech-stack:
  added: ["knip@6.12.1 (dead-code static analysis)"]
  patterns:
    - "Audit baseline: curated MD report + raw JSON sidecar in phase folder"
    - "Pre-seeded recommendation methodology (git log + filename + grep + neighbors)"

key-files:
  created:
    - knip.json
    - .planning/phases/40-dead-code-audit/40-KNIP-REPORT.md
    - .planning/phases/40-dead-code-audit/40-KNIP-REPORT.json
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "knip@6 satisfied via ^6.12.1 (npm caret pins major; matches plan intent)"
  - "shadcn/ui primitives (components/ui/*) seeded as KEEP-as-library (38 of 80 findings)"
  - "Configuration hints from knip (slot-picker ignore, tests/setup entry redundancy) noted as informational; not actioned in Plan 01"

patterns-established:
  - "Pre-seeded recommendation: 1-line specific rationale per finding; Decision cell left as _____ for human"
  - "Section ordering matches commit-order per RESEARCH.md: Deps → Duplicates → Exports → Files"

# Metrics
duration: ~25min
completed: 2026-05-08
---

# Phase 40 Plan 01: Knip Install + Baseline Audit Report Summary

**knip@6.12.1 installed and configured; 80 findings enumerated across 4 categories with seeded REMOVE/KEEP/INVESTIGATE recommendations awaiting Andrew's decision in Plan 02**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-09T02:12:00Z (approx)
- **Completed:** 2026-05-09T02:37:20Z
- **Tasks:** 2
- **Files created:** 3 (knip.json + 2 reports)
- **Files modified:** 2 (package.json, package-lock.json)

## Accomplishments

- knip@6.12.1 installed as devDependency; `npx knip` executes cleanly (non-zero exit expected: 80 issues found)
- knip.json at repo root with locked config: ignore for `slot-picker.tsx`, entry for `tests/setup.ts` + `tests/helpers/**`, project excludes `.planning/`, `tmp/`, `supabase/`
- Four npm scripts added (`knip`, `knip:report`, `knip:json`, `knip:ci`) — all existing scripts preserved
- Baseline JSON sidecar (`40-KNIP-REPORT.json`) captured for diff/CI use
- Curated `40-KNIP-REPORT.md` with 80 rows across 4 sections, each pre-seeded with REMOVE/KEEP/INVESTIGATE + 1-line rationale, Decision column blank for Andrew

## Findings by Category

| Category                                | Count | Seeded REMOVE | Seeded KEEP | Seeded INVESTIGATE |
| --------------------------------------- | ----: | ------------: | ----------: | -----------------: |
| Unused dependencies (`dependencies`)    |     3 |             1 |           1 |                  1 |
| Unused devDependencies                  |     4 |             2 |           2 |                  0 |
| Unlisted dependencies (used, undeclared)|     1 |             0 |           0 |                  1 |
| Duplicate exports                       |     0 |             — |           — |                  — |
| Unused named exports                    |    58 |             4 |          38 |                 16 |
| Unused exported types                   |    13 |             6 |           0 |                  7 |
| Unused files                            |     1 |             1 |           0 |                  0 |
| **Total**                               |  **80** |          **14** |        **41** |               **25** |

KEEP-heavy on shadcn/ui primitives (33 of 41 KEEP seeds are `components/ui/*` library primitives — installed-as-library convention; removing breaks `npx shadcn add` upgrade flow).

## Task Commits

1. **Task 1: Install knip + write knip.json + add scripts** — `96f4033`
2. **Task 2: Generate baseline reports + pre-seed recommendations** — `d5cfe61`

**Plan metadata commit:** _(this commit, see below)_

## Files Created/Modified

- `knip.json` — Locked config (ignore: slot-picker.tsx; entry: tests/setup.ts + tests/helpers/**)
- `package.json` — Added 4 knip scripts; added `knip@^6.12.1` to devDependencies
- `package-lock.json` — knip + 14 transitive packages added
- `.planning/phases/40-dead-code-audit/40-KNIP-REPORT.md` — Curated 80-row baseline (REMOVE/KEEP/INVESTIGATE seeded)
- `.planning/phases/40-dead-code-audit/40-KNIP-REPORT.json` — Raw JSON sidecar from `knip --reporter json`

## Decisions Made

- **Use shadcn/ui KEEP precedent at the library level (not per-component).** 33 unused exports across `components/ui/*` are seeded KEEP because shadcn primitives are installed wholesale; removing internal sub-components would break `npx shadcn add <component>` upgrade workflow and create maintenance hazard. Andrew can override per-row if he wants to slim individual files.
- **Two `DEFAULT_BRAND_PRIMARY` constants flagged together (3.3 + 3.17).** Both seeded INVESTIGATE because dedup decision must come first — picking the canonical location is upstream of the REMOVE call.
- **`isPastEod` and `AUTH_RATE_LIMITS` seeded INVESTIGATE despite being internal-only.** Pattern: `export` keyword is vestigial when the symbol is only used inside its own file. Suggested resolution is "drop `export`, keep function" rather than full REMOVE.
- **knip.json kept defensive entries for `tests/setup.ts` even though Vitest plugin auto-detects it.** Knip emits a "redundant entry" hint, but RESEARCH.md flagged this auto-detection as MEDIUM confidence; the explicit entry is harmless lock against future plugin behavior changes.

## Deviations from Plan

None — plan executed exactly as written. Two minor notes (not deviations):

1. **`knip@6` resolved as `^6.12.1` in package.json.** This is npm's standard install behavior; the caret pins to v6.x.x (allowing minor/patch within v6, not v7). Matches the plan's locked-decision intent ("pin the major"). No deviation.
2. **Knip emitted 2 informational config hints** (slot-picker ignore "redundant", tests/setup.ts entry "redundant"). Both kept per RESEARCH.md and Plan 30-01 Rule 4. Documented in the report's "Configuration hints from knip" callout. No action needed.

## Issues Encountered

- npm warned `EBADENGINE` (Node 24 in use vs. `engines.node: 20.x`); pre-existing local env condition, not a regression. Install succeeded.

## Surprises / Things to call out for Andrew

- **`tw-animate-css`** flagged as unused dependency but is actually imported via CSS at `app/globals.css:2` — knip does not analyze CSS imports. Seeded KEEP. Worth noting because this is a textbook "false positive" Pitfall the next contributor might second-guess.
- **`escapeHtml` exists 6+ times in the codebase as separate local copies** in each email sender file (`send-reschedule-emails.ts:396`, `send-reminder-booker.ts:255`, `welcome-email.ts:88`, `upgrade/_lib/actions.ts:192`, etc.) — the canonical export at `lib/email-sender/utils.ts:6` has zero callers. This is technical debt one level below knip's surface; flagging in Plan 02 review may be worth a follow-up consolidation phase.
- **No `proxy.ts` / `route.ts` / `page.tsx` / `layout.tsx` false positives** — knip's Next.js plugin handled all auto-entries cleanly, including the Next 16 `proxy.ts` rename. RESEARCH.md HIGH-confidence prediction held.
- **`postcss-load-config` flagged as unlisted** — it's referenced via JSDoc `@type` in `postcss.config.mjs`. Either declare it explicitly in package.json or remove the type comment (seeded INVESTIGATE).

## Confirmation: slot-picker.tsx correctly suppressed

`slot-picker.tsx` does NOT appear in the unused-files section of either report. The `ignore` glob `app/[account]/[event-slug]/_components/slot-picker.tsx` worked exactly as RESEARCH.md predicted. The path-with-brackets glob did not need escaping — knip's matcher handled it natively. Knip's "configuration hint" telling us we could remove the ignore confirms the suppression worked but is preserved as policy per Plan 30-01 Rule 4.

## Next Phase Readiness

- **Plan 02 (Andrew checkpoint) is unblocked.** Andrew opens `40-KNIP-REPORT.md`, fills the Decision column, and Plan 02 reads it back to produce `40-KNIP-DECISIONS.md`.
- **Plans 03–06 (per-category removal commits)** await Andrew's decisions. Order locked: deps → duplicates (skipped, none) → exports → files.
- **No blockers, no concerns.** Phase 40 ready to proceed.

---
*Phase: 40-dead-code-audit*
*Plan: 01*
*Completed: 2026-05-08*
