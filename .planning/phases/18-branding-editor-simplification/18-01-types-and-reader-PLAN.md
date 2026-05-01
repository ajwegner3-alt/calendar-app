---
phase: 18-branding-editor-simplification
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/branding/types.ts
  - lib/branding/read-branding.ts
  - app/(shell)/app/branding/_lib/load-branding.ts
autonomous: true

must_haves:
  truths:
    - "Branding interface in lib/branding/types.ts marks backgroundColor, backgroundShade, chromeTintIntensity, sidebarColor as @deprecated optional fields (Option B shim per RESEARCH.md Q1 — preserves chrome-tint.ts type-check until Phase 20 deletes it)"
    - "brandingFromRow continues to populate the deprecated optional fields (so chrome-tint.ts still receives them) — no new tsc errors introduced in lib/ or tests/"
    - "getBrandingForAccount accounts SELECT shrinks to logo_url, brand_primary ONLY (deprecated columns no longer read at runtime — Phase 19/21 dependency)"
    - "BrandingState in app/(shell)/app/branding/_lib/load-branding.ts drops backgroundColor, backgroundShade, sidebarColor — editor no longer surfaces them"
    - "loadBrandingForOwner SELECT shrinks to id, slug, logo_url, brand_primary"
    - "DEFAULT_BRAND_PRIMARY remains #0A2540 (used by brandingFromRow fallback only — UI reset uses #3B82F6 per CONTEXT.md, that's a Wave 2 concern)"
    - "tsc --noEmit produces ZERO new errors over baseline (pre-existing tests/branding-gradient.test.ts breakage from Phase 17-08 stays — do NOT fix, Phase 20 deletes it)"
    - "npm run build (Vercel-equivalent) succeeds — no runtime regressions"
  artifacts:
    - path: "lib/branding/types.ts"
      provides: "Branding interface with required fields {logoUrl, primaryColor, textColor} and deprecated optional shim fields"
      contains: "@deprecated"
    - path: "lib/branding/read-branding.ts"
      provides: "brandingFromRow + getBrandingForAccount, with shrunken accounts SELECT"
      contains: "select(\"logo_url, brand_primary\")"
    - path: "app/(shell)/app/branding/_lib/load-branding.ts"
      provides: "BrandingState interface + loadBrandingForOwner with shrunken shape and SELECT"
      contains: "BrandingState"
  key_links:
    - from: "lib/branding/read-branding.ts"
      to: "lib/branding/types.ts"
      via: "import type { Branding }"
      pattern: "import type \\{ Branding"
    - from: "app/(shell)/app/branding/_lib/load-branding.ts"
      to: "supabase.from(\"accounts\").select"
      via: "RLS-scoped server client"
      pattern: "select\\(\"id, slug, logo_url, brand_primary\""
---

<objective>
Wave 1 of Phase 18 — shrink the branding type/reader/loader layer FIRST so subsequent UI work in Wave 2 has a clean type surface to consume. CP-04 lock: types-first to surface tsc errors that map remaining work.

Purpose: BRAND-19 + BRAND-20 directly. Strips deprecated fields from `BrandingState` (editor-local) and shrinks `loadBrandingForOwner`'s accounts SELECT + `getBrandingForAccount`'s SELECT. The shared `Branding` interface keeps `backgroundColor`/`backgroundShade`/`chromeTintIntensity`/`sidebarColor` as `@deprecated` optional shim fields per RESEARCH.md Q1 Option B — chrome-tint.ts and its test stay type-clean until Phase 20 deletes them.

Output: type/reader/loader layer ready for Wave 2 UI rebuild. tsc --noEmit clean (no NEW errors). Vercel build passes. No UI changes yet.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/18-branding-editor-simplification/18-CONTEXT.md
@.planning/phases/18-branding-editor-simplification/18-RESEARCH.md

# Existing files to read before editing:
@lib/branding/types.ts
@lib/branding/read-branding.ts
@app/(shell)/app/branding/_lib/load-branding.ts

# Reference (do NOT modify):
@lib/branding/chrome-tint.ts
@tests/branding-chrome-tint.test.ts
</context>

<preamble>
## v1.2 Visual Locks (mandatory restate)
1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]` dynamic Tailwind
2. Email strategy: solid-color-only table band — no CSS gradients in email HTML
3. CSP: lives only in `proxy.ts`, never `next.config.ts`
4. Two-stage owner auth: RLS pre-check before service-role mutation
5. `background_shade` ENUM type must be dropped alongside the column (Phase 21)
6. DROP migration = two-step deploy (code-stop-reading deploy, then DROP SQL)

## Phase 18 Locked Decisions (do NOT revisit)
- Wave 1 owns the **type/reader/loader shrink only**. UI rebuild is Wave 2.
- **Q1 resolution: Option B (deprecated-optional shim)** — `Branding` keeps `backgroundColor`/`backgroundShade`/`chromeTintIntensity`/`sidebarColor` as `@deprecated` optional fields so `lib/branding/chrome-tint.ts` and `tests/branding-chrome-tint.test.ts` continue to type-check. Phase 20 deletes chrome-tint.ts; the shim fields drop with it naturally.
- **Phase 18 success criterion 4 (ROADMAP):** "tsc --noEmit passes with zero errors — Branding interface, BrandingState, saveBrandingAction signature, and brandingFromRow are all consistent on the simplified field set." With Option B shim, this passes — the optional shim fields are still type-consistent.
- **Pre-existing broken test:** `tests/branding-gradient.test.ts` has been broken since Phase 17-08 deleted `lib/branding/gradient.ts`. Do NOT fix this in Phase 18 — Phase 20 deletes the file. If `tsc --noEmit` complains about it, that's expected baseline noise. Phase 18's tsc gate is "no NEW errors over baseline."
- `DEFAULT_BRAND_PRIMARY` value remains `#0A2540` (used only by `brandingFromRow` fallback when `brand_primary` is null). The UI "Reset to NSI blue (#3B82F6)" button is a separate concern in Wave 2 — do NOT change `DEFAULT_BRAND_PRIMARY` here.

## Atomic commit boundary
This plan ships ONE commit covering all three files together. CP-04: types and reader must move atomically — splitting would surface false tsc errors mid-edit.

## Requirement coverage (this plan)
- BRAND-19: `BrandingState` drops `backgroundColor`, `backgroundShade`, `sidebarColor`. `Branding` interface — see Option B shim approach (deprecated-optional, not removed).
- BRAND-20: `getBrandingForAccount` + `brandingFromRow` accounts SELECT shrunk to `logo_url, brand_primary`.
- (BRAND-13..18 + BRAND-21 covered in Wave 2 / Wave 3.)
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Shrink lib/branding/types.ts and lib/branding/read-branding.ts (atomic)</name>
  <files>lib/branding/types.ts, lib/branding/read-branding.ts</files>
  <action>
Edit `lib/branding/types.ts`:

1. Keep the existing `BackgroundShade` and `ChromeTintIntensity` type aliases at the top of the file (they are still imported by `chrome-tint.ts` and tests; Phase 20 deletes them).
2. Update the `Branding` interface JSDoc to note the simplification:
   - Replace the existing comment block above `// Phase 12 additions` (lines 20-21) and `// Phase 12.5 additions` (lines 25-26) and `// Phase 12.6 additions` (line 28) with a single block above the deprecated fields:
     ```ts
     // Phase 18: deprecated — kept as optional shims so lib/branding/chrome-tint.ts
     // and tests/branding-chrome-tint.test.ts type-check until Phase 20 deletes them.
     // Phase 20 (CLEAN-07..09) will remove these fields entirely.
     ```
3. Mark the four deprecated fields as **optional** (`?:`) and add a `@deprecated` JSDoc tag to each:
   - `backgroundColor?: string | null;` (was `backgroundColor: string | null;`)
   - `backgroundShade?: BackgroundShade;` (was `backgroundShade: BackgroundShade;`)
   - `chromeTintIntensity?: ChromeTintIntensity;` (was `chromeTintIntensity: ChromeTintIntensity;`)
   - `sidebarColor?: string | null;` (was `sidebarColor: string | null;`)
   - Each gets a `/** @deprecated Phase 18 — Phase 20 removes. */` line above it.
4. The required fields stay required: `logoUrl`, `primaryColor`, `textColor`. Do NOT touch them.

Edit `lib/branding/read-branding.ts`:

1. Keep the existing imports: `Branding`, `BackgroundShade`, `ChromeTintIntensity` are all still needed because `brandingFromRow` continues to populate the deprecated shim fields (otherwise `chrome-tint.ts` would receive `undefined` and fail at runtime — even though only its test exercises it).
2. **Shrink the SELECT in `getBrandingForAccount`** (currently line 77):
   - Was: `.select("logo_url, brand_primary, background_color, background_shade, chrome_tint_intensity, sidebar_color")`
   - Becomes: `.select("logo_url, brand_primary")`
   - This is the BRAND-20 runtime change — production code stops READING the deprecated columns.
3. **Update the `brandingFromRow` parameter shape and body to reflect that the deprecated columns may not be present**:
   - The function signature stays compatible (`background_color?`, `background_shade?`, etc. are already optional in the param type at lines 23-29 — leave as-is).
   - The function body keeps producing the deprecated shim fields **defensively**: if the row doesn't include a column, fall back to the same defaults that were there before:
     - `backgroundShade` defaults to `"subtle"` (already does this via `validShades.includes(...)`)
     - `chromeTintIntensity` defaults to `"subtle"` (already does this via `validIntensities.includes(...)`)
     - `backgroundColor` defaults to `null` (already `row.background_color ?? null`)
     - `sidebarColor` defaults to `null` (already `row.sidebar_color ?? null`)
   - **No structural change needed in body — just keep the existing body.** The change is purely in the SELECT call site (step 2 above) and what the row argument contains at runtime.
4. Add a JSDoc block above `brandingFromRow` noting the Phase 18 shim contract:
   ```
   * Phase 18: SELECT in getBrandingForAccount no longer reads background_color,
   * background_shade, chrome_tint_intensity, sidebar_color from the accounts row.
   * The shim fields on the returned Branding default to safe values (null/null/"subtle"/"subtle")
   * so chrome-tint.ts and its test continue to type-check until Phase 20 deletes them.
   ```
5. Keep `DEFAULT_BRAND_PRIMARY = "#0A2540"` exactly as-is. Do NOT change to `#3B82F6`.

**WHY this approach:** Per RESEARCH.md Q1 Option B — chrome-tint.ts is dead in production but its test runs. Marking the fields optional + keeping the JSDoc breadcrumb satisfies the success criterion (tsc clean, no new errors) without scope-creeping into Phase 20 territory. The SELECT shrink is the meaningful BRAND-20 win — production STOPS READING the deprecated columns at runtime.

**Avoid:** Do NOT delete `BackgroundShade` or `ChromeTintIntensity` type aliases from `types.ts`. Do NOT delete `backgroundShade`/`chromeTintIntensity` import or population logic in `brandingFromRow`. Do NOT delete `DEFAULT_BRAND_PRIMARY`. All of these belong to Phase 20.
  </action>
  <verify>
1. Read each edited file and visually confirm:
   - `lib/branding/types.ts` has 4 deprecated optional fields with `@deprecated` tags; required fields unchanged.
   - `lib/branding/read-branding.ts` SELECT is exactly `"logo_url, brand_primary"`.
2. Run typecheck:
   ```bash
   npx tsc --noEmit 2>&1 | tee /tmp/tsc-wave1.log | head -50
   ```
3. Compare against pre-existing baseline: ONLY pre-existing errors should appear (specifically `tests/branding-gradient.test.ts` is the known broken file per STATE.md:123). No NEW errors.
4. Confirm chrome-tint.ts still compiles:
   ```bash
   npx tsc --noEmit lib/branding/chrome-tint.ts 2>&1 | head -10
   ```
   Expect: zero errors (it reads `branding.backgroundColor` and `branding.sidebarColor`, which are now optional but still present on the type).
5. Run grep to confirm no stale runtime reads:
   ```bash
   grep -n "background_color\|background_shade\|chrome_tint_intensity\|sidebar_color" lib/branding/read-branding.ts
   ```
   Expect: snake_case column names appear ONLY in the param destructuring/optional fields signature for `brandingFromRow` — NOT in the `.select(...)` call.
  </verify>
  <done>
- `lib/branding/types.ts` has 4 fields marked `@deprecated` and optional (`?:`)
- `lib/branding/read-branding.ts` SELECT is `"logo_url, brand_primary"` only
- `brandingFromRow` body continues to produce shim fields with safe defaults
- tsc baseline is unchanged (no NEW errors)
  </done>
</task>

<task type="auto">
  <name>Task 2: Shrink BrandingState + loadBrandingForOwner SELECT</name>
  <files>app/(shell)/app/branding/_lib/load-branding.ts</files>
  <action>
Edit `app/(shell)/app/branding/_lib/load-branding.ts`:

1. **Drop the `BackgroundShade` import** (line 3): `import type { BackgroundShade } from "@/lib/branding/types";` — REMOVE this entire line. Wave 2 BrandingEditor will no longer reference it.
2. **Shrink the `BrandingState` interface (lines 5-16)** to:
   ```ts
   export interface BrandingState {
     accountId: string;
     accountSlug: string;
     logoUrl: string | null;
     primaryColor: string | null;
     firstActiveEventSlug: string | null; // for preview iframe target; null = no events yet
   }
   ```
   Remove: `backgroundColor`, `backgroundShade`, `sidebarColor` and their JSDoc lines.
3. **Remove the `VALID_SHADES` constant** (line 18): no longer needed.
4. **Shrink the SELECT in `loadBrandingForOwner`** (line 39-41):
   - Was: `.select("id, slug, logo_url, brand_primary, background_color, background_shade, sidebar_color")`
   - Becomes: `.select("id, slug, logo_url, brand_primary")`
5. **Remove the shade-coercion block** (lines 58-61):
   ```ts
   const shade = account.background_shade as BackgroundShade;
   const backgroundShade: BackgroundShade = VALID_SHADES.includes(shade)
     ? shade
     : "subtle";
   ```
   DELETE this whole block.
6. **Shrink the return literal** (lines 63-72) to:
   ```ts
   return {
     accountId: account.id,
     accountSlug: account.slug,
     logoUrl: account.logo_url,
     primaryColor: account.brand_primary,
     firstActiveEventSlug: firstEvent?.slug ?? null,
   };
   ```
7. Keep the rest of the file (RLS auth flow, event lookup query) UNCHANGED.

**Why this is safe to do in Wave 1 even though `BrandingEditor` (Wave 2) still references the dropped fields:** `BrandingEditor` will be rewritten in Wave 2 — its imports of `state.backgroundColor`, `state.backgroundShade`, `state.sidebarColor` will become tsc errors after this Wave 1 commit. **That's the CP-04 contract** — types-first to surface the work surface for Wave 2. Wave 1 will end with `branding-editor.tsx` having tsc errors, and `npm run build` will fail until Wave 2 ships. **This is intentional and the entire reason for the 2-wave split.**

**Mitigation for the inter-wave tsc failure window:** Wave 1 and Wave 2 ship as separate commits but the executor must run them back-to-back without an intermediate deploy. The Vercel deploy gate happens at the END of Wave 2 (Wave 3 visual-gate plan handles deploy + eyeball).
  </action>
  <verify>
1. Read the edited file. Confirm:
   - No `import type { BackgroundShade }` line.
   - `BrandingState` has exactly 5 fields: `accountId`, `accountSlug`, `logoUrl`, `primaryColor`, `firstActiveEventSlug`.
   - SELECT is `"id, slug, logo_url, brand_primary"`.
   - No `VALID_SHADES` constant.
   - Return literal has 5 properties (no `backgroundColor`, `backgroundShade`, `sidebarColor`).
2. Run typecheck:
   ```bash
   npx tsc --noEmit 2>&1 | tee /tmp/tsc-wave1-final.log | grep -E "branding-editor|load-branding|branding/types|read-branding" | head -30
   ```
   Expect:
   - Errors in `app/(shell)/app/branding/_components/branding-editor.tsx` referencing `state.backgroundColor`, `state.backgroundShade`, `state.sidebarColor` — **THESE ARE EXPECTED.** Wave 2 will fix them.
   - NO errors in `lib/branding/types.ts`, `lib/branding/read-branding.ts`, or this `load-branding.ts`.
3. Run grep:
   ```bash
   grep -n "background_color\|background_shade\|sidebar_color\|chrome_tint_intensity" app/\(shell\)/app/branding/_lib/load-branding.ts
   ```
   Expect: zero hits.
  </verify>
  <done>
- `BrandingState` has 5 fields (no deprecated)
- SELECT is `"id, slug, logo_url, brand_primary"` only
- `BackgroundShade` import removed
- `VALID_SHADES` and the shade-coercion block removed
- tsc errors now surfaced ONLY in `branding-editor.tsx` import sites (expected — Wave 2 fixes)
  </done>
</task>

</tasks>

<verification>
**Wave 1 gate (atomic — all three files committed together):**

1. `npx tsc --noEmit` errors are limited to:
   - Pre-existing baseline (e.g., `tests/branding-gradient.test.ts` per STATE.md:123)
   - Wave 2 surface area: `app/(shell)/app/branding/_components/branding-editor.tsx` references to `state.backgroundColor`, `state.backgroundShade`, `state.sidebarColor` and to `saveBrandingAction` payload fields
   - **NO errors in `lib/branding/`, `lib/email/*`, `tests/branding-chrome-tint.test.ts`, or `tests/branding-schema.test.ts`** — Option B shim must hold.
2. Grep verification:
   - `grep -rn "background_color\|background_shade\|chrome_tint_intensity\|sidebar_color" lib/branding/` should show: param destructuring in `read-branding.ts`, NOTHING ELSE.
   - `grep -rn "background_color\|background_shade\|sidebar_color" app/\(shell\)/app/branding/_lib/load-branding.ts` should return zero hits.
3. `npm run build` is NOT expected to pass at end of Wave 1 (Wave 2 fixes the `branding-editor.tsx` errors). Do NOT attempt build until after Wave 2.
4. **No git push at end of Wave 1.** Commit only — push happens at end of Wave 2's atomic commit (or during Wave 3 visual-gate deploy).
</verification>

<success_criteria>
1. `lib/branding/types.ts`, `lib/branding/read-branding.ts`, `app/(shell)/app/branding/_lib/load-branding.ts` all updated per Tasks 1-2.
2. `npx tsc --noEmit` errors limited to (a) pre-existing baseline (`tests/branding-gradient.test.ts`) and (b) `branding-editor.tsx` (which Wave 2 will fix). Zero errors in `lib/`, in email layer, or in `tests/branding-chrome-tint.test.ts` / `tests/branding-schema.test.ts`.
3. `chrome-tint.ts` and its test type-check cleanly (Option B shim contract).
4. `loadBrandingForOwner` accounts SELECT is `"id, slug, logo_url, brand_primary"` (BRAND-20 runtime stop-reading).
5. `getBrandingForAccount` accounts SELECT is `"logo_url, brand_primary"` (BRAND-20 runtime stop-reading).
6. Single atomic git commit covering all three files. Suggested message: `refactor(18-01): shrink Branding type + reader + editor loader (BRAND-19, BRAND-20)`.
</success_criteria>

<output>
After completion, create `.planning/phases/18-branding-editor-simplification/18-01-types-and-reader-SUMMARY.md` capturing:
- Confirm Option B shim approach landed (4 fields marked `@deprecated` optional)
- Both reader SELECTs shrunk to `logo_url, brand_primary` (and editor loader to `id, slug, logo_url, brand_primary`)
- `BrandingState` shrunken; `BackgroundShade` import dropped from load-branding
- tsc state at end of wave (which files are knowingly broken — only branding-editor.tsx + pre-existing baseline)
- `chrome-tint.ts` + its test still clean (verify command output)
- Files of record: 3 changed, line count delta
- Hand-off to Wave 2: `branding-editor.tsx` import sites need rewriting
</output>
