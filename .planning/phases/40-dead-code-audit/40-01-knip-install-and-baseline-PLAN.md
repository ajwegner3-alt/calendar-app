---
phase: 40-dead-code-audit
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - knip.json
  - .planning/phases/40-dead-code-audit/40-KNIP-REPORT.md
  - .planning/phases/40-dead-code-audit/40-KNIP-REPORT.json
autonomous: true

must_haves:
  truths:
    - "`knip` is installed as a devDependency and `npx knip` runs without crashing"
    - "`knip.json` at the repo root has the locked ignore list (slot-picker only) and entry list (tests/setup.ts + tests/helpers/**)"
    - "Both markdown and JSON knip reports exist in the phase folder, populated from a real run"
    - "Each finding in 40-KNIP-REPORT.md has a pre-seeded REMOVE/KEEP/INVESTIGATE recommendation with a 1-line rationale"
  artifacts:
    - path: "knip.json"
      provides: "Knip configuration with locked ignore + entry list"
      contains: "app/[account]/[event-slug]/_components/slot-picker.tsx"
    - path: "package.json"
      provides: "knip devDependency + knip/knip:report/knip:json/knip:ci scripts"
      contains: "\"knip\""
    - path: ".planning/phases/40-dead-code-audit/40-KNIP-REPORT.md"
      provides: "Human-review checklist with REMOVE/KEEP/INVESTIGATE column per finding"
    - path: ".planning/phases/40-dead-code-audit/40-KNIP-REPORT.json"
      provides: "Machine-readable audit log for diffing"
  key_links:
    - from: "knip.json `ignore`"
      to: "app/[account]/[event-slug]/_components/slot-picker.tsx"
      via: "exact-path glob"
      pattern: "slot-picker"
    - from: "knip.json `entry`"
      to: "tests/setup.ts + tests/helpers/**/*.ts"
      via: "explicit entry"
      pattern: "tests/(setup|helpers)"
---

<objective>
Install `knip@6` as a devDependency, write the locked `knip.json` config, add the four package.json scripts, run knip once to capture the baseline, and produce `40-KNIP-REPORT.md` with pre-seeded REMOVE/KEEP/INVESTIGATE recommendations per finding plus the raw JSON sidecar. Stop after committing the baseline so Andrew can review.

Purpose: Set up the audit tooling and produce the human-review checklist that drives Plans 03-06.
Output: knip installed, knip.json + scripts in place, both report artifacts committed to the phase folder.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/40-dead-code-audit/40-CONTEXT.md
@.planning/phases/40-dead-code-audit/40-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install knip and write knip.json + package.json scripts</name>
  <files>package.json, package-lock.json, knip.json</files>
  <action>
Run `npm install --save-dev knip@6` to add knip as a devDependency.

Create `knip.json` at the repo root with EXACTLY the config from RESEARCH.md §"Verified `knip.json` (final, repo-ready)":

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
    "tests/setup.ts",
    "tests/helpers/**/*.ts"
  ],
  "project": [
    "**/*.{ts,tsx}",
    "!.next/**",
    "!node_modules/**",
    "!.planning/**",
    "!tmp/**",
    "!supabase/**"
  ],
  "ignore": [
    "app/[account]/[event-slug]/_components/slot-picker.tsx"
  ]
}
```

Notes (do NOT deviate from this config without an explicit reason recorded in 40-KNIP-DECISIONS.md later):
- Path is `app/[account]/[event-slug]/_components/slot-picker.tsx` — NOT `components/booking/slot-picker.tsx` (CONTEXT.md path is stale; RESEARCH.md confirms the actual path).
- `tests/__mocks__/` is auto-detected by the Vitest plugin — does NOT need an `ignore` entry.
- `tests/setup.ts` and `tests/helpers/**` are NOT auto-detected (vitest setupFiles is config-driven) — they MUST be in `entry` to avoid false-positive "unused file" hits.
- Do NOT add `entry` lines for `app/**/page.tsx`, `route.ts`, `proxy.ts`, `layout.tsx`, etc. — knip's Next.js plugin auto-detects them.

Add the four scripts to `package.json` `"scripts"` block (preserve all existing scripts):

```json
"knip": "knip",
"knip:report": "knip --reporter markdown > .planning/phases/40-dead-code-audit/40-KNIP-REPORT.md",
"knip:json": "knip --reporter json > .planning/phases/40-dead-code-audit/40-KNIP-REPORT.json",
"knip:ci": "knip --no-progress --reporter compact"
  </action>
  <verify>
- `npx knip --version` prints a 6.x version.
- `cat knip.json` shows the exact config above.
- `node -e "console.log(Object.keys(require('./package.json').scripts).filter(k => k.startsWith('knip')))"` prints `[ 'knip', 'knip:report', 'knip:json', 'knip:ci' ]`.
- `npx knip` runs to completion (non-zero exit code is expected — issues found is the point of this phase).
  </verify>
  <done>
knip@6 in `devDependencies`, knip.json at repo root with locked config, four scripts in package.json. `npx knip` executes cleanly (config is valid).
  </done>
</task>

<task type="auto">
  <name>Task 2: Generate baseline reports and pre-seed REMOVE/KEEP/INVESTIGATE recommendations</name>
  <files>.planning/phases/40-dead-code-audit/40-KNIP-REPORT.md, .planning/phases/40-dead-code-audit/40-KNIP-REPORT.json</files>
  <action>
Run `npm run knip:json` to capture the raw JSON sidecar at `.planning/phases/40-dead-code-audit/40-KNIP-REPORT.json`.

Then build `40-KNIP-REPORT.md` by hand (do NOT just dump `--reporter markdown`; we need the REMOVE/KEEP/INVESTIGATE column and per-row rationale). Run `npm run knip:report` first to capture knip's raw markdown into a temp scratch (you can pipe it elsewhere or just read it inline) — use it as the source of truth for what to enumerate.

Structure of `40-KNIP-REPORT.md`:

```markdown
# Phase 40: Knip Audit Report

**Generated:** {date}
**Knip version:** {from package.json}
**Total findings:** {N}

## How to use this file

For each row below, edit the **Decision** cell to one of: `REMOVE`, `KEEP`, or `INVESTIGATE`.
- `REMOVE` — Claude will delete in the relevant per-category commit.
- `KEEP` — Andrew has a reason to keep this; rationale captured in 40-KNIP-DECISIONS.md.
- `INVESTIGATE` — Claude must research before Andrew re-decides. INVESTIGATE items are deep-dived in-phase, never deferred.

After Andrew finishes, Plan 02 reads this file back and produces 40-KNIP-DECISIONS.md.

---

## 1. Unused Dependencies

(Removed first per RESEARCH.md commit-order recommendation — smallest blast radius.)

| # | Dependency | Type (dep / devDep) | Recommended | Rationale | Decision |
|---|-----------|---------------------|-------------|-----------|----------|
| 1.1 | {pkg-name} | devDep | REMOVE | No imports in source/config/scripts (grep clean) | _____ |
| ... |

## 2. Duplicate Exports

| # | File | Export | Recommended | Rationale | Decision |
|---|------|--------|-------------|-----------|----------|
| 2.1 | {file:line} | {symbol} | REMOVE | Re-exported in {other-file}; only one site has consumers | _____ |
| ... |

## 3. Unused Exports

| # | File | Export | Type (named / type-only) | Recommended | Rationale | Decision |
|---|------|--------|--------------------------|-------------|-----------|----------|
| 3.1 | {file:line} | {symbol} | named | REMOVE | Last touched in {commit}, no callers in source/tests, no string-key references | _____ |
| ... |

## 4. Unused Files

| # | File | Recommended | Rationale | Decision |
|---|------|-------------|-----------|----------|
| 4.1 | {path} | REMOVE | {seeded rationale} | _____ |
| ... |
```

For each finding, apply the seeding methodology from RESEARCH.md §"Pre-seeded recommendation methodology":

1. `git log --oneline --follow -- <file>` — when last touched? Stale = stronger REMOVE.
2. Filename semantics — `*-deprecated`, `legacy-*`, `*-old` → REMOVE. `slot-picker` pattern → KEEP (but slot-picker is already ignored).
3. Neighboring files — dead barrel? Dead directory?
4. `grep -r "<basename>" --include="*.ts" --include="*.tsx" --include="*.json"` — any string-literal hits → INVESTIGATE.
5. For `_lib/actions.ts` exports: grep export name in `*-form.tsx`, `*-button.tsx`, `_components/*.tsx` siblings before approving REMOVE.
6. For deps: grep across `*.config.*`, `*.json`, package.json scripts (RESEARCH.md Pitfall 5 — `eslint-config-next`, `@tailwindcss/postcss`, etc. live only in configs).
7. Default: REMOVE if all checks negative; INVESTIGATE if grep returns ambiguous hits.

Each rationale should be ≤1 line. Be specific: `"Last touched in c3108b3 (Phase 39); zero grep hits across app/, lib/, tests/."` — not `"Looks unused."`.

Set the **Decision** cell to `_____` (five underscores) — Andrew fills these in. Do NOT pre-fill the decision; that column is editable on his end.

Section ordering matches the commit order: Dependencies → Duplicate Exports → Unused Exports → Unused Files (smallest-blast-radius first).
  </action>
  <verify>
- `.planning/phases/40-dead-code-audit/40-KNIP-REPORT.json` exists and contains valid JSON parsable by `node -e "JSON.parse(require('fs').readFileSync('.planning/phases/40-dead-code-audit/40-KNIP-REPORT.json'))"`.
- `.planning/phases/40-dead-code-audit/40-KNIP-REPORT.md` exists with all four section headers (Unused Dependencies, Duplicate Exports, Unused Exports, Unused Files), even if some sections are empty (write "_None._" rather than omitting the header).
- Every finding row has a non-empty Recommended cell (REMOVE / KEEP / INVESTIGATE) and a non-empty Rationale cell.
- Every Decision cell is `_____` (placeholder, NOT filled).
- The report total finding count matches the JSON sidecar's finding count.
- `npx knip` exit code is non-zero (issues found — this is expected).
  </verify>
  <done>
Both report artifacts committed; report has pre-seeded recommendations + rationale per finding; Decision column is empty awaiting Andrew. Plan 02 picks up from here.
  </done>
</task>

</tasks>

<verification>
- `git status` shows knip.json, package.json, package-lock.json, the two report files (and that's it — no other modifications).
- Reports under `.planning/phases/40-dead-code-audit/` are committed (per global rule "push early and often" — commit message `chore(40-01): install knip + baseline audit report`).
- `slot-picker.tsx` is NOT in the unused-files section of the report (the ignore list works).
- `tests/setup.ts` is NOT in the unused-files section of the report (the entry list works).
</verification>

<success_criteria>
- knip@6 installed.
- knip.json valid + locked-list ignore.
- 4 package.json scripts present.
- Both reports committed with pre-seeded recommendations.
- Phase folder ready for Andrew's review.
</success_criteria>

<output>
After completion, create `.planning/phases/40-dead-code-audit/40-01-SUMMARY.md` summarizing:
- knip version installed
- Total findings per category (deps / dup-exports / unused-exports / unused-files)
- Any surprises (e.g., proxy.ts flagged unexpectedly — should NOT happen per RESEARCH.md but call it out if so)
- Confirmation that slot-picker.tsx was correctly suppressed
</output>
