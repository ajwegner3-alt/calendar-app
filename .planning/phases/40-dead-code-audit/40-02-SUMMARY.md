---
phase: 40
plan: 02
subsystem: tooling/dead-code-audit
tags: [knip, dead-code, audit, decisions, plan-02, andrew-checkpoint]
requires: [40-01]
provides: [40-knip-decisions-locked-scope, plan-03-deps-targets, plan-04-dup-targets, plan-05-exports-targets, plan-06-files-targets, plan-07-keep-list]
affects: [40-03, 40-04, 40-05, 40-06, 40-07]
tech-stack:
  added: []
  patterns: [andrew-delegated-decision-authority, conservative-bias-on-static-analysis, whole-symbol-vs-export-keyword-only-removal]
key-files:
  created:
    - .planning/phases/40-dead-code-audit/40-KNIP-DECISIONS.md
  modified:
    - .planning/phases/40-dead-code-audit/40-KNIP-REPORT.md
decisions:
  - id: KNIP-DECISIONS-LOCK
    summary: "All 80 findings resolved to REMOVE (27) or KEEP (53); zero unresolved INVESTIGATE."
  - id: KNIP-DELEGATED-AUTHORITY
    summary: "Andrew explicitly delegated final REMOVE/KEEP calls to Claude with conservative bias on INVESTIGATE deep-dives."
  - id: KNIP-WHOLE-VS-EXPORT-ONLY
    summary: "DECISIONS.md splits unused-export REMOVEs into whole-symbol-deletion (17) vs export-keyword-only (6) categories; Plan 05 needs both modes."
metrics:
  duration: ~25 min
  completed: 2026-05-08
---

# Phase 40 Plan 02: Andrew Review Checkpoint Summary

**One-liner:** All 80 knip findings finalized to 27 REMOVE / 53 KEEP via Andrew-delegated authority + 21-item INVESTIGATE deep-dive; `40-KNIP-DECISIONS.md` is now the locked machine-readable contract for Plans 03-06 deletion targets.

## Plan execution flow

Plan 02 was modified mid-flight: Andrew said "I trust what you recommend. Go ahead." rather than personally filling the Decision column. The plan's Task 1 wait-for-Andrew step was skipped. Claude:

1. Applied pre-seeded recommendations as final decisions for all 59 non-INVESTIGATE rows (14 REMOVE seeds + 41 KEEP seeds — wait, the actual count was 14 REMOVE + 45 KEEP non-INVESTIGATE; Andrew's prompt approximated to 41).
2. Performed Plan 02 Task 2 deep-dive on every INVESTIGATE row using grep across `app/`, `lib/`, `tests/`, plus targeted config-file checks (RESEARCH.md Pitfall 5).
3. Wrote a Claude `Investigation:` sub-row beneath each former INVESTIGATE row capturing the search performed, what was found, and the final call.
4. Flipped each former INVESTIGATE Decision cell to `REMOVE` or `KEEP` per conservative-bias rule.
5. Generated `40-KNIP-DECISIONS.md` per Task 3's spec (header counts, REMOVE sub-lists, KEEP sub-lists with rationales for Plan 07 ignore wiring, INVESTIGATE-→-KEEP audit-trail section, INVESTIGATE-→-REMOVE audit-trail section, recovery protocol).
6. Single commit `18ff367` covered both file finalizations per plan spec.

## Total findings reviewed: 80

### Final breakdown

| Category | REMOVE | KEEP | Total |
|---|---|---|---|
| 1a. Unused dependencies | 1 | 2 | 3 |
| 1b. Unused devDependencies | 2 | 2 | 4 |
| 1c. Unlisted dependencies | 0 | 1 | 1 |
| 2. Duplicate exports | 0 | 0 | 0 |
| 3a. Unused named exports | 13 | 45 | 58 |
| 3b. Unused exported types | 10 | 3 | 13 |
| 4. Unused files | 1 | 0 | 1 |
| **Total** | **27** | **53** | **80** |

### INVESTIGATE resolution (21 items deep-dived)

- **INVESTIGATE → REMOVE: 13**
  - Whole-symbol deletion: `lib/email/branding-blocks.ts:DEFAULT_BRAND_PRIMARY` (duplicate copy), `lib/branding/read-branding.ts:getBrandingForAccount`, `app/(shell)/app/branding/_lib/schema.ts:PNG_MAGIC`, `logoFileSchema`, `app/(shell)/app/availability/_lib/actions-batch-cancel.ts:CommitInverseOverrideInput`, `app/(auth)/app/login/schema.ts:MagicLinkInput`, `app/(shell)/app/availability/_lib/types.ts:DateOverrideInput`.
  - Export-keyword-only removal: `lib/bookings/pushback.ts:isPastEod`, `lib/branding/read-branding.ts:DEFAULT_BRAND_PRIMARY` (canonical site — keep constant), `lib/auth/rate-limits.ts:AUTH_RATE_LIMITS`, `time-window-picker.tsx:minutesToHHMM`/`hhmmToMinutes`, `event-types/_lib/types.ts:CustomQuestion`.

- **INVESTIGATE → KEEP: 8**
  - `shadcn` (CLI tool via `npx shadcn add`)
  - `postcss-load-config` (JSDoc-only annotation; suppress via `ignoreDependencies`)
  - `lib/oauth/encrypt.ts:generateKey` (ad-hoc CLI dev helper)
  - `pushback-dialog-provider.tsx:usePushbackDialog` (knip miscount — used at lines 109, 129 of same file)
  - `event-types/_lib/schema.ts:customQuestionSchema` (used internally at line 82 via `z.array()`)
  - `lib/email-sender/types.ts:EmailAttachment`, `EmailProvider`, `EmailClientConfig` (load-bearing internal type-graph nodes)

## Notable KEEP rationales (feeds Plan 07 `knip.json` ignore wiring)

1. **`tw-animate-css` — KEEP because dynamic CSS-only import.** `app/globals.css:2` `@import "tw-animate-css"`. Knip is a JS/TS analyzer; it cannot see CSS imports. Plan 07 will need to add this to `ignoreDependencies` (or accept that knip will keep flagging it on every CI run if not ignored).

2. **`shadcn`, `supabase` (devDep) — KEEP because CLI binary, not a runtime import.** Both are invoked via `npx <tool>`. RESEARCH.md Pitfall 5 enumerates this exact class. Plan 07 `ignoreDependencies` entries: `["shadcn", "supabase", "tailwindcss", "postcss-load-config", "tw-animate-css"]`.

3. **`tailwindcss` (devDep) — KEEP because transitive consumer.** `@tailwindcss/postcss` references it at runtime; removing breaks `next build`. Even though knip flags it as unused, it is load-bearing for the CSS pipeline. RESEARCH.md Pitfall 5 listed this explicitly.

4. **shadcn/ui primitives (42 entries) — KEEP because installed-as-library convention.** Every `components/ui/*.tsx` export is part of the `npx shadcn add` upgrade contract. Plan 07 will add an `ignore` glob `components/ui/**` (or `ignoreExportsUsedInFile` per file) so the CI gate stops re-flagging these on each run.

5. **`lib/email-sender/types.ts` interfaces — KEEP because module-internal type graph.** `EmailAttachment`, `EmailProvider`, `EmailClientConfig` are all exported from `types.ts` and consumed by other types in the same file (transitive references). After Plan 05 deletes the dead `index.ts` barrel re-exports (3.59-3.64), the source `types.ts` exports lose their external import path — but the types are still load-bearing within the type graph for `EmailOptions`, `EmailClient`, etc. Plan 07 `ignoreExportsUsedInFile` candidate: `lib/email-sender/types.ts`.

6. **`generateKey` — KEEP because dev-tool surface.** Documented in JSDoc as `node -e "..."` usage. The cost of "carry one unused export" is much smaller than the cost of "Andrew needs to rotate the GMAIL_TOKEN_ENCRYPTION_KEY in 6 months and finds the helper deleted."

## Surprising investigation findings

1. **`PNG_MAGIC` is dead because `actions.ts` inlines the literal bytes.** `app/(shell)/app/branding/_lib/actions.ts:48-51` does the magic-byte check directly: `head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47`. The `PNG_MAGIC` constant in schema.ts was never wired up to a real consumer — `logoFileSchema` was the only structural reference, and `logoFileSchema` itself is dead (no callers). Both REMOVE, full deletion.

2. **`DEFAULT_BRAND_PRIMARY` exists in two places.** `lib/email/branding-blocks.ts:4` and `lib/branding/read-branding.ts:11`. The branding-blocks copy has zero readers anywhere; the read-branding copy is consumed at line 31 by `brandingFromRow`. Plan 05 will delete the branding-blocks copy outright AND drop the `export` keyword from the read-branding copy (since nothing external consumes it).

3. **`CustomQuestion` is duplicated as DIFFERENT types in two places.** `app/(shell)/app/event-types/_lib/types.ts:9` is the OWNER-side discriminated union (Zod-derived). `app/[account]/[event-slug]/_lib/types.ts:15` is a separate INTERFACE for the BOOKER side. They're not connected via imports — each side has its own copy. Knip flagged the OWNER-side export as unused because the BOOKER side imports its own local copy. The OWNER-side export is genuinely vestigial (only line 47 of the same file uses it).

4. **`usePushbackDialog` was a knip miscount.** Knip flagged it as zero-references, but it's used at lines 109 and 129 of the SAME provider file (consumed by `PushbackHeaderButton` and `PushbackDaySectionButton` defined inside the provider module). Suspect: knip's "unused export" rule only looks for cross-file imports, missing same-file internal use. Plan 07 will need `ignoreExportsUsedInFile` to suppress this class of false positive going forward.

5. **`AUTH_RATE_LIMITS` and `isPastEod` are vestigial-`export` cases.** Both are only consumed inside their own file via the `keyof typeof` pattern (rate-limits.ts:23) or direct call (pushback.ts:183). The `export` keyword can be dropped without functional change. Plan 05's "REMOVE" for these means "drop the `export` keyword, keep the symbol" — explicitly distinguished in DECISIONS.md from whole-symbol REMOVEs.

## Output / next plan handoff

- `40-KNIP-DECISIONS.md` is the locked contract. Plans 03-06 enumerate the relevant sub-list:
  - Plan 03 (deps): 3 deps — `nodemailer`, `@eslint/eslintrc`, `@types/nodemailer`. Single `npm uninstall` commit.
  - Plan 04 (duplicates): None — empty wave; can be skipped or collapsed.
  - Plan 05 (exports): 17 whole-symbol REMOVEs + 6 export-keyword-only REMOVEs. Two distinct edit modes — DECISIONS.md sub-headers separate them so Plan 05 doesn't accidentally delete a constant that's still used internally.
  - Plan 06 (files): 1 file — `components/welcome-card.tsx`.
  - Plan 07 (CI gate + ignore wiring): KEEP list section in DECISIONS.md is the master ignore-list spec for `knip.json`.

## Authorization & process notes

- **Andrew explicitly delegated final REMOVE/KEEP calls; Claude applied conservative bias on INVESTIGATE deep-dives. All 21 INVESTIGATE items investigated and resolved per plan methodology (grep across source/tests/configs, git log review, dynamic-import / config-side risk check).**
- Working tree drift on three pre-existing files (`02-VERIFICATION.md`, `23-VERIFICATION.md`, `33-CONTEXT.md`) was NOT staged — those changes are unrelated to Plan 02 and remain uncommitted per Andrew's direction.

## Commits in this plan

- `18ff367` — `chore(40-02): lock dead-code decisions log` (40-KNIP-REPORT.md finalized + 40-KNIP-DECISIONS.md created)
- `(metadata)` — `docs(40-02): complete andrew-review-checkpoint plan` (this SUMMARY + STATE.md update)
