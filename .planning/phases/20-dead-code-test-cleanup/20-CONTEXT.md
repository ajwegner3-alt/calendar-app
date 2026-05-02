# Phase 20: Dead Code + Test Cleanup - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Delete deprecated theming code (Phase 12.5 chrome tinting + Phase 12.6 gradient remnants + shade picker), the test files that pin them, and the leftover `Branding` interface shim that Phase 18 deferred. End state: zero runtime references to the four deprecated `accounts` columns (`sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity`) so Phase 21 can run the DB DROP migration safely.

Visual surfaces are NOT touched. Pre-existing tsc errors in `tests/` (the ~20 TS7006/TS2305 noted in STATE.md) are explicitly OUT of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Shim cleanup scope (locked aggressive)

- **Drop all 4 `@deprecated` optional fields on the `Branding` interface** (`backgroundColor`, `backgroundShade`, `chromeTintIntensity`, `sidebarColor`) in Phase 20. Phase 18 deferred these so `chrome-tint.ts` could keep type-checking; with `chrome-tint.ts` deleted in this phase, the shim is no longer load-bearing. Phase 21 inherits a fully shrunken type.
- **Strip `AccountSummary` deprecated fields in Phase 20** (`background_color`, `background_shade` in `app/embed/[account]/[event-slug]/_lib/types.ts`). Same logic as the `Branding` shim — leave Phase 21 purely a DB phase.
- **`chrome-tint.ts` gets fully deleted** as a file (not surgical export removal). The test file is its only external importer; once the test goes, the file goes.
- **`brandingFromRow` body — Claude's discretion.** Audit callers spreading full account rows (email senders, embed page) during planning; either strip defaults entirely (clean break, paired with type drop) or keep populated body until callers are confirmed safe. Plan should document which path was taken and why.

### Maintenance backlog (strict scope)

- **Pre-existing `tests/` tsc errors stay deferred.** ~20 TS7006/TS2305 errors are NOT in v1.2 scope — do not touch in Phase 20. Open a separate maintenance ticket if needed.
- **Other deprecated-era code sweep — Claude's discretion.** Beyond the 6-9 named symbols/files, planner may run a structural search for any helpers/constants/type aliases still touching the 4 deprecated column names and propose deletions. If found, surface for review before bundling into Phase 20.
- **Test rewrites — Claude's discretion.** Skim `branding-chrome-tint.test.ts` and `branding-gradient.test.ts` for any cross-cutting branding behavior worth rehoming to surviving test files (e.g., contrast or read-branding tests). Default expectation is pure delete.
- **`lib/branding/` barrel/index check — Claude's discretion.** If `lib/branding/index.ts` exists, scan for stale re-exports of deleted symbols. Otherwise rely on tsc to catch dangling imports.

### Plan & wave structure (Claude's discretion)

- **Commit shape, plan count, push cadence, pre-commit gates — all Claude's discretion.** Decide during planning based on dependency graph. Phase 19's atomic single-commit pattern worked when there were no external consumers of the changed type; Phase 18's CP-04 wave-split was needed because Wave 1 left tsc broken. For Phase 20 (delete-only), tsc *should* stay clean throughout, which favors atomic — but verify during planning.
- **Default expectation:** single plan (`20-01`, matches ROADMAP placeholder); split only if shim-drop adds enough complexity to warrant `20-02`.
- **Default gates per commit:** `tsc --noEmit` clean + vitest passes (with expected count drop) + grep for all deleted symbols returns zero hits.

### Verification rigor

- **No Andrew live-eyeball gate.** Pure delete + tsc-clean + vitest pass + grep zero is sufficient. Phase 21 will smoke-test the full booking flow as part of its post-DROP verification — that doubles as Phase 20's safety net.
- **Phase 21 grep gate enforcement — Claude's discretion.** Phase 21 owns its own CP-01 pre-flight check. Phase 20 may fold the same `git grep` (zero hits for the 4 column names in non-migration `.ts/.tsx`) into its exit criterion if it's straightforward; otherwise let Phase 21 run it independently.
- **Test count delta handling — Claude's discretion.** Either (a) document the new count + cite the two deleted files, or (b) pre-count tests in both files before deletion and assert the new count = 266 - deleted. Pick during planning based on how brittle the test fixture file feels.
- **Halt conditions — Claude's discretion.** Default to halting on (a) any unexpected runtime importer of a "should-be-orphan" symbol, or (b) any vitest failure beyond the expected count drop. Conservatism is appropriate since this is the last code-cleanup phase before DB DROP.

### Claude's Discretion (summary)

- `brandingFromRow` body cleanup approach (strip vs audit-then-strip)
- Sweep for orphaned helpers/constants/type aliases beyond the named list
- Whether any test assertions are worth porting before deletion
- `lib/branding/` barrel/index inspection
- Commit shape (atomic vs wave-split), plan count (1 vs 2), push cadence, pre-commit gate exact composition
- Whether to fold Phase 21 CP-01 grep gate into Phase 20 exit criteria
- Test count delta verification approach
- Halt conditions (default = unexpected importer OR vitest failure)

</decisions>

<specifics>
## Specific Ideas

- **Known deletion targets (from STATE.md + ROADMAP Phase 20):**
  - Files: `lib/branding/chrome-tint.ts` (whole file), `components/.../shade-picker.tsx`, `tests/branding-chrome-tint.test.ts`, `tests/branding-gradient.test.ts`
  - Symbols: `chromeTintToCss`, `chromeTintTextColor`, `resolveChromeColors`, `shadeToGradient`, `IntensityPicker`, `FloatingHeaderPill`
  - Already deleted in Phase 17: `GradientBackdrop`, `NSIGradientBackdrop`, `lib/branding/gradient.ts` — do not redo.
- **Phase 19 single-commit pattern is the precedent to beat.** No external consumers, single atomic commit (`0130415`), no tsc-broken intermediate state. If Phase 20 can match that, do so.
- **Phase 18 CP-04 wave-split is the fallback pattern.** Used when Wave 1 left tsc broken by design (type shrink before consumer rewrite). Push deferred until end of Wave 2. Apply only if shim-drop creates a similar "type-first, then consumers" dependency.
- **MP-06 ordering rule:** delete `tests/branding-chrome-tint.test.ts` BEFORE deleting `chrome-tint.ts` function bodies — the test is the only external importer. (Moot if both land in one atomic commit.)
- **Phase 21 dependency:** Phase 21 cannot start until Phase 20's grep-zero state is achieved for the 4 column names. Phase 21 will re-verify via its own CP-01 pre-flight regardless.

</specifics>

<deferred>
## Deferred Ideas

- **Pre-existing tsc errors in `tests/`** (~20 TS7006/TS2305) — explicitly out of v1.2 scope. Capture as a maintenance backlog item.
- **DB column DROP migration** — Phase 21 (already roadmapped). Phase 20 produces the grep-zero precondition; Phase 21 runs the SQL.
- **`AccountSummary` field trim coordination with Phase 21** — moved INTO Phase 20 by this discussion (was previously tagged "removed when columns drop"). STATE.md "Pending Todos" entry should be updated to reflect this when Phase 20 ships.

</deferred>

---

*Phase: 20-dead-code-test-cleanup*
*Context gathered: 2026-05-01*
