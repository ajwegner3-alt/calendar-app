# Phase 40: Dead-Code Audit - Research

**Researched:** 2026-05-08
**Domain:** Static dead-code analysis (knip) on Next.js 16 App Router + Vitest
**Confidence:** HIGH (knip docs verified live; codebase landmines enumerated by direct grep)

## Summary

Phase 40 is locked to `knip` with standard-mode (non-strict) audit, four-category coverage, per-item Andrew sign-off, and four-batch atomic removal commits. CONTEXT.md sets the binding decisions; this research confirms they are achievable and surfaces concrete how-to.

Key findings:
- **knip's Next.js plugin auto-detects everything that matters here**, including `proxy.ts` (Next 16's renamed middleware — verified in plugin's entry pattern). The minimal `knip.json` for this repo is ~10 lines.
- **No GitHub Actions workflow exists** in the repo (`.github/` directory is missing entirely). The CI gate will need to be created from scratch — recommend a small `.github/workflows/knip.yml` that runs `npx knip` on PRs. Vercel's build command does not support adding pre-build gates without a new top-level script, so CI-as-PR-gate is the right surface.
- **Landmine inventory is small and clean.** Only one truly dynamic import (`lib/email-sender/account-sender.ts` lazy-loading `./quota-guard`) plus three benign Vitest internals. No string-keyed component lookups, no `require.context`, no `eval`. All form actions reference statically-imported server actions — trivially traceable.
- **The three pre-ignore items survive knip's defaults cleanly:** `slot-picker.tsx` is at `app/[account]/[event-slug]/_components/slot-picker.tsx` (NOT `components/booking/` — CONTEXT.md path is stale; planner must use the actual path); `tests/__mocks__/` and the helper directory `tests/helpers/` need explicit handling since neither contains `.test.ts` files but are referenced by the live tests.
- **SQL migrations are structurally invisible to knip** — knip is a JS/TS tool. The 33 files in `supabase/migrations/` are out of scope at the analyzer level; no config protection needed (CONTEXT.md confirms).
- **Vitest plugin auto-detects `tests/**/*.test.ts(x)`, `vitest.config.ts`, and `**/__mocks__/**`** — but `tests/setup.ts` and `tests/helpers/*.ts` are NOT auto-entries; they will surface as "unused files" without intervention.

**Primary recommendation:** Use a 12-line `knip.json` with explicit entries for `tests/setup.ts` + `tests/helpers/**`, ignore the slot-picker file, generate two reports (markdown for human review + JSON for the audit log + future CI gate), and add a four-step package.json script set. Add the CI workflow as the last task in-phase, after all removals land green.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| knip | 6.x (latest) | Dead-code analysis | Locked by CONTEXT.md. JSON schema URL `https://unpkg.com/knip@6/schema.json` confirms v6 is current. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | knip is single-binary; no companion libs needed |

### Alternatives Considered
**Locked decision per CONTEXT.md** — alternatives (`ts-prune`, `unimported`, `depcheck`) NOT explored.

**Installation:**
```bash
npm install --save-dev knip@6
```

## Architecture Patterns

### Recommended `knip.json` (concrete, copy-paste ready)

Location: repo root (`./knip.json`).

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

**Why these choices:**
- **No `entry` list for app/route/layout/page/proxy/middleware/loading/error/not-found/icon/sitemap/robots files** — the Next.js plugin auto-adds them. Verified plugin pattern: `"app/**/{layout,page,route,template}.{js,jsx,ts,tsx}"` + `"app/**/{error,loading,not-found}.{js,jsx,ts,tsx}"` + `"{instrumentation,instrumentation-client,middleware,proxy}.{js,jsx,ts,tsx}"`. Our `proxy.ts` (Next 16 rename) is auto-picked.
- **No `entry` list for `tests/**/*.test.ts(x)` or `__mocks__`** — the Vitest plugin auto-adds them. Verified pattern: `"**/*.{bench,test,test-d,spec,spec-d}.?(c|m)[jt]s?(x)"` and `"**/__mocks__/**/*.[jt]s?(x)"`.
- **DO add `tests/setup.ts` + `tests/helpers/**`** — these are imported by tests at runtime via vitest config (`setupFiles: ["./tests/setup.ts"]`), but knip doesn't parse vitest's `setupFiles` array → it would flag `tests/setup.ts` as unused without an explicit entry. Same for `tests/helpers/{auth,booking-fixtures,pg-direct,supabase}.ts`.
- **`project` excludes `supabase/`** — knip won't analyze SQL anyway, but excluding the directory keeps the project file count clean. ESLint already excludes `supabase/migrations/**` (eslint.config.mjs:42), mirror it here.
- **`ignore` for slot-picker only** — Plan 30-01 Rule 4. `tests/__mocks__/` does not need an ignore (auto-detected as entry by Vitest plugin). The CONTEXT.md "test mock helpers" line refers to `tests/helpers/` which we promote to `entry` (cleaner than ignore — they ARE used).
- **Path correction:** CONTEXT.md says `components/booking/slot-picker.tsx` but the actual file is `app/[account]/[event-slug]/_components/slot-picker.tsx`. Use the actual path in `knip.json`. `components/booking/` directory does not exist in this repo.
- **No `paths` field** — `tsconfig.json` already has `"@/*": ["./*"]` and knip reads tsconfig automatically.
- **No `compilers` field** — Tailwind v4 / PostCSS files are CSS, not analyzed by knip.

### Output format invocations (verified)

```bash
# Human-review markdown report (one section per category, table format)
npx knip --reporter markdown > .planning/phases/40-dead-code-audit/40-KNIP-REPORT.md

# Machine-readable JSON for audit log + future diffing
npx knip --reporter json > .planning/phases/40-dead-code-audit/40-KNIP-REPORT.json

# Default symbols reporter (terminal-friendly, for ad-hoc checks)
npx knip
```

Knip's exit code is non-zero when issues are found. For report generation we don't care; for CI we do (see CI section).

### Recommended package.json scripts

```json
{
  "scripts": {
    "knip": "knip",
    "knip:report": "knip --reporter markdown > .planning/phases/40-dead-code-audit/40-KNIP-REPORT.md",
    "knip:json": "knip --reporter json > .planning/phases/40-dead-code-audit/40-KNIP-REPORT.json",
    "knip:ci": "knip --no-progress --reporter compact"
  }
}
```

- `knip` — interactive use during review.
- `knip:report` + `knip:json` — generate both audit artifacts in one shot. (Could be combined: `npm run knip:report && npm run knip:json`.)
- `knip:ci` — for the post-phase GitHub Actions gate. `--no-progress` keeps logs clean; `compact` is the most CI-readable reporter.

### CI gate recommendation

**Repo state:** No `.github/` directory exists. No GitHub Actions workflows yet. `vercel.json` only declares a cron — no pre-build hooks. Vercel build runs `next build` from `package.json`.

**Recommended approach: GitHub Actions PR gate (lowest friction, highest signal).**

Create `.github/workflows/knip.yml`:

```yaml
name: knip

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  knip:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run knip:ci
```

**Why this shape:**
- Non-zero exit from knip fails the workflow → PR is blocked.
- Runs on `pull_request` (gate) AND `push` to `main` (catches direct pushes / merge-commit drift).
- `npm ci` matches Vercel's lockfile-strict install behavior.
- Node 20.x matches `package.json` `engines.node`.
- Single job, no matrix — keeps CI minutes negligible (knip on this codebase will run in seconds).

**Alternative considered: Vercel ignored-build-step.** Vercel supports a "Skip deployment" hook but not a "fail deployment on lint." Build-step gating via `npm run build` would require chaining `npm run knip:ci && npm run build` in a custom script — but that fails the deployment AFTER knip exits, costing build minutes on every PR. GitHub Actions is faster, free on public repos, and gates BEFORE build attempts.

**Implementation note:** This workflow file is the LAST task in Phase 40 — after every category removal commit lands and `npx knip` shows the desired clean state (or the pre-decided KEEP-residue baseline). If shipped earlier, the CI gate fails on every PR until removals complete.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting unused exports | grep for `export` + cross-reference imports | `npx knip` | Knip handles re-exports, type-only imports, named-vs-default ambiguity, dynamic imports it can statically resolve |
| Detecting unused deps | Compare `package.json` to `import` statements | `npx knip` | Plugins know that e.g. `eslint-config-next` is consumed by `eslint.config.mjs` even though no source file `import`s it |
| Markdown report formatting | Hand-build a table | `--reporter markdown` | Built-in, stable, parseable |
| Pre-seeded recommendation logic | LLM-on-LLM heuristics | Use `git log --follow <file>` + grep for filename root + read neighbors | Methodology section below |

## Pre-seeded recommendation methodology

For each knip finding, Claude inspects in this order before seeding REMOVE/KEEP/INVESTIGATE:

1. **`git log --oneline --follow -- <file>`** — When was this file last touched? If never since the phase that created it (e.g., the `<file>.test.ts` was deleted in Phase 31 and the source file wasn't), strong REMOVE signal.
2. **Filename semantics** — Names like `*-deprecated.ts`, `legacy-*.ts`, `*-old.ts` → REMOVE. Names matching the slot-picker pattern (canonical reference / template) → KEEP per Rule 4.
3. **Neighboring files in the same directory** — If `lib/foo/index.ts` is unused but `lib/foo/{a,b,c}.ts` are used, the index might be a dead barrel re-export. If the entire directory is unused, the parent module is dead.
4. **Plausible dynamic-callsite grep** — For each unused file, run `grep -r "<basename>"` (without extension) across the codebase. If the basename appears in a string literal anywhere, mark INVESTIGATE.
5. **Server-action / form-action grep** — For unused exports in `_lib/actions.ts` files, grep for the export name in `*-form.tsx` and `*-button.tsx` siblings. Form `action={fooAction}` props use static identifiers — straightforward to verify.
6. **For unused dependencies:** `grep -r "from ['\"]<pkg>"`, `grep -r "require(['\"]<pkg>"`, and `grep <pkg> *.config.*` (ESLint/PostCSS/Tailwind/Next configs sometimes consume packages without source-level imports).
7. **Default verdict:** REMOVE if all checks come back negative. KEEP if Rule 4 / business reason. INVESTIGATE if grep #4-#6 returns ambiguous hits.

Each finding gets a 1-line rationale of the form: `"Last touched in <commit>, no callers in source/tests, no string-key references."` Andrew can override.

## Common Pitfalls

### Pitfall 1: knip flags `proxy.ts` as unused
**What goes wrong:** Older knip docs and tutorials say `middleware.ts` — Next 16 renamed it to `proxy.ts`. If someone configures `entry: ["middleware.ts"]` manually, `proxy.ts` is missed.
**Why it happens:** Stale docs.
**How to avoid:** Don't add manual entries for these files at all. Knip's Next.js plugin (verified via knip.dev/reference/plugins/next) lists `proxy` in its auto-entry pattern. Trust the plugin.
**Warning signs:** `proxy.ts` appears in the unused-files report.

### Pitfall 2: `tests/setup.ts` and `tests/helpers/*.ts` flagged as unused
**What goes wrong:** Vitest plugin auto-detects `tests/**/*.test.ts(x)` and `__mocks__/` but does NOT parse vitest config's `setupFiles` array or follow imports from helpers transitively as entries. Without explicit entry config, `tests/setup.ts` shows up as "unused file."
**Why it happens:** Knip plugins auto-detect canonical file conventions, not config-driven runtime wiring.
**How to avoid:** Add `"tests/setup.ts"` and `"tests/helpers/**/*.ts"` to `entry` in `knip.json` (above).

### Pitfall 3: `app/widget.js/route.ts` route name confuses globs
**What goes wrong:** The literal directory name contains a dot (`widget.js`). Some glob engines treat `.js` as an extension trailer.
**Why it happens:** Next.js routes can use literal-named segments.
**How to avoid:** Knip's `app/**/route.{ts,tsx}` pattern matches by file extension, not directory name — verified safe. No special handling needed.
**Warning signs:** `app/widget.js/route.ts` listed as unused (would indicate a knip glob bug; report upstream if seen).

### Pitfall 4: Duplicate exports false-positive on barrel files
**What goes wrong:** A category 4 finding (duplicate exports) might flag legitimate barrel re-exports as duplicates.
**Why it happens:** Knip considers it a duplicate when both `import { X } from "./a"` and `import { X } from "./b"` resolve to the same symbol.
**How to avoid:** Default trust knip; for any duplicate-export finding, grep both export sites before deletion.

### Pitfall 5: Removing a dependency that's used only by a config file
**What goes wrong:** `eslint-config-next`, `@tailwindcss/postcss`, `vite-tsconfig-paths`, `dotenv`, `postgres`, `supabase` (CLI) are all devDeps consumed by config files or CLI invocations — not by `import` statements in source.
**Why it happens:** Knip's plugin coverage varies; ESLint/Tailwind/PostCSS plugins handle these but it's worth verifying.
**How to avoid:** Before any `chore(40): remove unused dependencies` commit, manually verify each flagged dep with `grep -rn "<pkg>"` across `*.config.*`, `*.json`, and `package.json` scripts.

## False-positive landmines inventory (codebase-specific)

Direct grep results — these are the patterns Claude must verify before any REMOVE.

### Dynamic imports (only 4 in the codebase, 1 production)
| File | Line | Specifier | Verdict |
|------|------|-----------|---------|
| `lib/email-sender/account-sender.ts` | 60 | `await import("./quota-guard")` | **STATIC SPECIFIER** — knip resolves these. No risk. |
| `app/(shell)/app/settings/upgrade/_lib/actions.ts` | 177 | `await import("next/cache")` | next builtin — N/A. |
| `tests/setup.ts` | 18 | `importOriginal<typeof import("next/server")>()` | Test-runtime import — N/A. |
| `tests/cross-event-overlap.test.ts` | 424 | `await import("node:fs/promises")` | Node builtin — N/A. |

**Conclusion:** Zero string-template / variable dynamic imports. Knip will resolve everything.

### Server actions (20 files with `'use server'`)
All form actions in this codebase use the pattern `<form action={someAction}>` where `someAction` is a top-of-file `import` from a sibling `_lib/actions.ts` file. Sample directories:
- `app/(auth)/app/login/`, `app/(auth)/app/signup/`, `app/(auth)/app/forgot-password/`, `app/(auth)/app/verify-email/`
- `app/(shell)/app/settings/{gmail,profile,reminders,upgrade}/_lib/actions.ts`
- `app/(shell)/app/event-types/_lib/actions.ts`, `app/(shell)/app/availability/_lib/actions.ts`, `app/(shell)/app/branding/_lib/actions.ts`
- `app/onboarding/{step-1-account,step-2-timezone,step-3-event-type}/`
- `app/auth/reset-password/actions.ts`

**Verification rule:** For any unused-export finding inside an `_lib/actions.ts` or `actions.ts` file, grep the export name across `*-form.tsx`, `*-button.tsx`, and `_components/*.tsx` siblings before approving REMOVE.

### Special Next.js exports (auto-detected by knip plugin, but worth listing)
Files with `generateMetadata` / `metadata` exports that knip's plugin treats as entries:
- `app/[account]/page.tsx`
- `app/[account]/[event-slug]/page.tsx`
- `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx`
- `app/cancel/[token]/page.tsx`
- `app/reschedule/[token]/page.tsx`
- `app/embed/[account]/[event-slug]/page.tsx`
- `app/layout.tsx`

Knip's Next plugin recognizes these as page/layout files and won't flag the metadata exports. No action needed; listed for sanity-check.

### `not-found.tsx`, `loading.tsx` (auto-entries)
- `app/[account]/[event-slug]/not-found.tsx`
- `app/(shell)/app/event-types/loading.tsx`
- `app/(shell)/app/availability/loading.tsx`

All covered by the Next plugin's `app/**/{error,loading,not-found}.{js,jsx,ts,tsx}` pattern.

### No string-keyed component lookups
Grepped `require.context`, `String(...)`, template-literal `.tsx`, `new Function`. Zero matches indicating dynamic component lookup. The few `String(...)` hits are number/error coercions, unrelated.

### Vercel cron entry
`app/api/cron/send-reminders/route.ts` — invoked by `vercel.json` cron, NOT by any source-level import. Auto-detected by knip's Next plugin via `route.ts` file convention. Confirmed safe.

### Embed / widget entries
- `app/widget.js/route.ts` — auto-entry (route.ts).
- `app/embed/[account]/[event-slug]/page.tsx` — auto-entry (page.tsx).

Both reachable only via cross-origin iframe / `<script src>` — knip can't statically detect those callers, but the file-convention auto-entries cover both.

### `scripts/phase10-pre-flight-andrew-email-confirmed.sql`
SQL file. Out of knip's scope. The `scripts/` directory contains only this SQL + README — no `.ts` files. Safe.

### `app/_components/*` (5 files)
Imported by various route pages — straightforward static imports, knip will trace correctly.

## Architecture Pattern: Removal commit cadence

CONTEXT.md locks one commit per knip category. Recommended order:

1. **`chore(40): remove unused dependencies`** — Run FIRST. Smallest blast radius; package.json + package-lock.json only. If `next build` fails, the missing dep is obvious.
2. **`chore(40): remove duplicate exports`** — Smallest source diff after deps. Touches single-line export statements; very low risk.
3. **`chore(40): remove unused exports`** — Larger diff; may cascade (removing an export can make its imports trivially unused).
4. **`chore(40): remove unused files`** — Biggest blast radius last. By the time this runs, exports/deps are clean → unused files are unambiguous.

**Between each commit:** `npm run build && npm test`. The pre-existing `tests/bookings-api.test.ts` failing test is the watermark; any new failure is a regression caused by the batch.

## Code Examples

### Verified `knip.json` (final, repo-ready)
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

### Report generation invocation
```bash
# Single-pass: generate both reports
npm run knip:report && npm run knip:json

# Outputs:
# .planning/phases/40-dead-code-audit/40-KNIP-REPORT.md
# .planning/phases/40-dead-code-audit/40-KNIP-REPORT.json
```

### CI workflow (deferred to last task in phase)
```yaml
# .github/workflows/knip.yml
name: knip
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  knip:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run knip:ci
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16 | Knip plugin already updated to detect `proxy.ts`; no manual entry needed |
| Manual `entry` lists for App Router | Plugin auto-detection | knip 5.x+ | `knip.json` shrinks from ~30 lines to ~10 |
| `--reporter json` only | Multiple reporters in one CLI | knip 5.x+ | Can chain `--reporter markdown --reporter json` if desired |

## Open Questions

None blocking. One verification item the planner should sequence:

1. **Initial `npx knip` baseline run before any removals** — The first task in the phase plan should be: install knip, write `knip.json` per above, run `npx knip` once with no config tweaks, capture the output. If `proxy.ts` / `route.ts` / `tests/setup.ts` etc. show up as unused-files in that initial run despite the recommended config, the plugin auto-detection assumption needs revisiting before the audit report is generated.
   - **Mitigation if surprises appear:** Add explicit `entry` lines for the surprises. Document in `40-KNIP-DECISIONS.md` why the explicit entry was needed.
   - **Confidence this won't fire:** HIGH for `proxy.ts` (verified in plugin pattern), HIGH for route/page/layout files (verified pattern), MEDIUM for the auto-detection of `tests/__mocks__/` (pattern verified, but interaction with vitest config aliases not exercised in docs).

## Sources

### Primary (HIGH confidence)
- https://knip.dev/reference/plugins/next — Next.js plugin entry patterns (verified `proxy.ts`, `app/**/{layout,page,route}` auto-entries)
- https://knip.dev/reference/plugins/vitest — Vitest plugin entry patterns (verified `**/*.test.ts(x)` and `**/__mocks__/**` auto-entries)
- https://knip.dev/reference/configuration — Top-level config schema (verified `entry`, `project`, `ignore`, `ignoreDependencies` fields)
- https://knip.dev/features/reporters — Reporter list and CLI flags (verified `--reporter markdown` / `--reporter json`)
- https://knip.dev/guides/handling-issues — `ignore` glob syntax and exact-path support
- Live codebase grep — All landmine inventory (dynamic imports, server actions, special exports)

### Secondary (MEDIUM confidence)
- https://knip.dev/overview/configuration — Minimal-config guidance ("Be specific with entry files")

### Tertiary (LOW confidence)
- (none — all key claims verified against primary sources)

## Metadata

**Confidence breakdown:**
- knip config schema: HIGH — verified live against current docs
- Next.js plugin auto-entries: HIGH — pattern strings copied verbatim from docs
- Vitest plugin auto-entries: HIGH — pattern strings copied verbatim from docs
- CI gate recommendation: HIGH — repo state inspected directly (no `.github/`, vercel.json minimal)
- Codebase landmine inventory: HIGH — direct grep results, not inferred
- Pre-seeded methodology: MEDIUM — heuristic; will be refined during actual review

**Research date:** 2026-05-08
**Valid until:** 2026-08-08 (knip is stable; revalidate if Next.js 17 ships before then or knip releases v7)
