# Phase 20: Dead Code + Test Cleanup - Research

**Researched:** 2026-05-01
**Domain:** TypeScript dead code deletion — deprecated theming system remnants
**Confidence:** HIGH (direct codebase audit, no library research needed)

## Summary

Phase 20 is a delete-only phase. Every named deletion target was audited by reading the
actual files on disk and running exhaustive grep searches for all importers. No third-party
library research is required. All findings come from direct codebase inspection.

CLEAN-04 (`app/_components/gradient-backdrop.tsx`), CLEAN-05 (`components/nsi-gradient-backdrop.tsx`),
CLEAN-06 (`lib/branding/gradient.ts`), CLEAN-08 (`app/(shell)/_components/floating-header-pill.tsx`),
and CLEAN-09 (`app/(shell)/app/branding/_components/intensity-picker.tsx`) are confirmed NO-OPs —
those files do not exist on disk. Only three live deletions remain: `chrome-tint.ts`,
`shade-picker.tsx`, and the two test files.

The `Branding` interface shim drop and `brandingFromRow` body cleanup are safe to do atomically
with no wave-split needed: zero production callers pass deprecated fields to `brandingFromRow`,
and all consumers of `Branding` only read `primaryColor`, `textColor`, and `logoUrl`.

The `AccountSummary` / `AccountListingData` shim drop is NOT purely safe: two DB loaders
(`load-event-type.ts` and `load-account-listing.ts`) still SELECT `background_color` and
`background_shade` from the database and forward them into those types. Dropping these type
fields now requires also updating those two SELECT strings — or accepting that Supabase will
return extra columns that TypeScript ignores (which is safe but leaves junk columns in the
response until Phase 21 DROPs them). This is the one area requiring planning judgment.

**Primary recommendation:** Atomic single commit. Strip all 4 Branding shim fields plus
`brandingFromRow` shim body simultaneously with the file deletions. Handle `AccountSummary`
by also updating the two SELECT strings in the same commit (clean break) OR by accepting
the loose-column approach and deferring to Phase 21. Recommend clean break in Phase 20 since
it's a pure code edit with no visual risk.

---

## Deletion Target Inventory (CLEAN-01..09)

### CLEAN-01: `tests/branding-chrome-tint.test.ts`
- **Status:** EXISTS — delete required
- **Path:** `tests/branding-chrome-tint.test.ts`
- **Test count:** 27 `it()` calls
- **Importers:** None outside itself (it imports from `@/lib/branding/chrome-tint`)
- **Cross-cutting assertions:** `resolveChromeColors` tests (lines 114–188) test a function that
  exists in `chrome-tint.ts`. The logic being tested (`primaryColor` → `primaryTextColor`,
  WCAG `pickTextColor` wrapper) is duplicated/covered better by `branding-contrast.test.ts`.
  The `sidebarColor` and `backgroundColor` field access patterns in `makeBranding()` fixture
  are only relevant to the deprecated fields. **Recommendation: pure delete. No assertions worth porting.**
- **MP-06 note:** Delete this test BEFORE or simultaneously with deleting `chrome-tint.ts`. Since
  the plan targets an atomic commit, ordering within a single `git rm` is irrelevant.

### CLEAN-02/03: `lib/branding/chrome-tint.ts` (whole file)
- **Status:** EXISTS — delete required
- **Path:** `lib/branding/chrome-tint.ts`
- **Exports:** `chromeTintToCss` (fn), `chromeTintTextColor` (fn), `resolveChromeColors` (fn),
  `ChromeTintSurface` (type), `ResolvedChromeColors` (interface), `TINT_PCT` (const, unexported)
- **External importers of file:** Only `tests/branding-chrome-tint.test.ts` (line 2)
- **No production code imports `chrome-tint.ts`.** Confirmed zero hits for all 3 exported
  function names outside the test file and the source file itself.
- **`resolveChromeColors` also reads `branding.backgroundColor` and `branding.sidebarColor`** —
  those deprecated Branding fields — so deleting the file simultaneously with dropping the
  Branding shim fields is consistent. No dependency ordering issue.

### CLEAN-04: `app/_components/gradient-backdrop.tsx`
- **Status:** MISSING — confirmed NO-OP
- **References in codebase:** Only comment text in `app/(auth)/_components/auth-hero.tsx` (line 16)
  and `app/[account]/_components/listing-hero.tsx` (line 10). Both are JSDoc comments noting
  historical removal — not live imports.
- **Action:** Verify + log NO-OP.

### CLEAN-05: `components/nsi-gradient-backdrop.tsx`
- **Status:** MISSING — confirmed NO-OP
- **References:** Only comment in `auth-hero.tsx` (line 16). No live imports.
- **Action:** Verify + log NO-OP.

### CLEAN-06: `lib/branding/gradient.ts`
- **Status:** MISSING — confirmed NO-OP
- **References:** Only `tests/branding-gradient.test.ts` imports `shadeToGradient` from it. This
  import will fail at test-run time (vitest will report an import error) — but Phase 20 deletes
  that test file in the same commit, so the import failure is never observed.
- **Action:** Verify + log NO-OP.

### CLEAN-07: `app/(shell)/app/branding/_components/shade-picker.tsx`
- **Status:** EXISTS — delete required
- **Path:** `app/(shell)/app/branding/_components/shade-picker.tsx`
- **Importers:** None. Zero references to `ShadePicker` or `shade-picker` outside the file itself.
  `BrandingEditor` does not import it. The component was disconnected in Phase 18 Wave 2.
- **The file imports `BackgroundShade` from `@/lib/branding/types`** — that type must survive in
  `types.ts` until this file is deleted (it's the only non-types.ts, non-read-branding.ts consumer).
  After deletion, `BackgroundShade` can be dropped from `types.ts`.
- **Action:** Delete file. No consumer updates needed.

### CLEAN-08: `app/(shell)/_components/floating-header-pill.tsx`
- **Status:** MISSING — confirmed NO-OP
- **References:** Zero grep hits for `FloatingHeaderPill` or `floating-header-pill` anywhere in the
  codebase. Fully gone.
- **Action:** Verify + log NO-OP.

### CLEAN-09: `app/(shell)/app/branding/_components/intensity-picker.tsx`
- **Status:** MISSING — confirmed NO-OP
- **References:** Zero grep hits for `IntensityPicker` or `intensity-picker` anywhere in the
  codebase. Fully gone.
- **Action:** Verify + log NO-OP.

### CLEAN-10: `tests/branding-gradient.test.ts`
- **Status:** EXISTS — delete required (implicit in CLEAN-06 cleanup)
- **Path:** `tests/branding-gradient.test.ts`
- **Test count:** 8 `it()` calls
- **Importers:** None outside itself
- **Cross-cutting assertions:** All 8 tests exercise `shadeToGradient` exclusively. That function
  is already deleted (`lib/branding/gradient.ts` is MISSING). The test file is broken-on-import
  already — vitest would fail with a module-not-found error if run against Phase 19's codebase.
  **Recommendation: pure delete. No assertions worth porting.**

---

## `brandingFromRow` Body Audit (Discretion Area)

**Function location:** `lib/branding/read-branding.ts` lines 28–58

**All callers of `brandingFromRow`:**

| Caller | What fields passed | Passes deprecated columns? |
|--------|-------------------|-----------------------------|
| `app/cancel/[token]/page.tsx` (×2) | `{ logo_url, brand_primary }` only | NO |
| `app/reschedule/[token]/page.tsx` | `{ logo_url, brand_primary }` only | NO |
| `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` | `{ logo_url, brand_primary }` only | NO |
| `app/[account]/page.tsx` | `data.account` (AccountListingData.account) | YES — includes `background_color`, `background_shade` |
| `app/[account]/[event-slug]/page.tsx` | `data.account` (AccountSummary) | YES — includes `background_color`, `background_shade` |
| `lib/branding/read-branding.ts` (self, via `getBrandingForAccount`) | `{ logo_url, brand_primary }` only (DB SELECT is stripped) | NO |

**Consumption of deprecated fields after `brandingFromRow`:**
- `PublicShell` only reads `branding.primaryColor`, `branding.textColor` (confirmed via source read)
- `Header`, `BackgroundGlow` only consume `primaryColor`/`textColor`/`logoUrl`
- No production component reads `branding.backgroundColor`, `branding.backgroundShade`,
  `branding.chromeTintIntensity`, or `branding.sidebarColor` from the returned `Branding` object

**Conclusion:** Even though `[account]/page.tsx` and `[account]/[event-slug]/page.tsx` pass
`data.account` (which includes `background_color` and `background_shade`), those values are
accepted by the optional `background_color?` / `background_shade?` parameters in `brandingFromRow`'s
signature — they flow through the body and get set on the returned `Branding` object — but no
downstream consumer ever reads them from the `Branding` object. The deprecated fields are
computed but silently discarded.

**Recommendation: Strip the deprecated fields from the `brandingFromRow` body AND signature
simultaneously with dropping the `Branding` interface fields.** The callers that pass
`background_color`/`background_shade` (the two `data.account` spreads) will get a TypeScript
error ONLY if the `brandingFromRow` parameter type drops those fields AND tsc is strict about
extra properties. Since the parameter is a structural type (not a sealed object), extra
properties passed to a function are silently ignored in TypeScript — no TS error from callers
passing extra columns. But to be clean, update the two SELECT strings and drop the fields from
`AccountSummary`/`AccountListingData` in the same commit.

---

## `Branding` Interface Shim Drop Blast Radius

**Target fields to drop from `lib/branding/types.ts`:**
- `backgroundColor?: string | null` (line 26)
- `backgroundShade?: BackgroundShade` (line 28)
- `chromeTintIntensity?: ChromeTintIntensity` (line 30)
- `sidebarColor?: string | null` (line 32)

**All references to each field across the codebase (non-migration, non-comment):**

| Field | Files with live references |
|-------|---------------------------|
| `backgroundColor` | `chrome-tint.ts` (deleted), `read-branding.ts` (body stripped), `branding-chrome-tint.test.ts` (deleted) |
| `backgroundShade` | `read-branding.ts` (body stripped), `branding-chrome-tint.test.ts` (deleted), `schema.ts` (see orphan sweep) |
| `chromeTintIntensity` | `read-branding.ts` (body stripped), `schema.ts` (see orphan sweep), `branding-chrome-tint.test.ts` (deleted) |
| `sidebarColor` | `chrome-tint.ts` (deleted), `read-branding.ts` (body stripped), `branding-chrome-tint.test.ts` (deleted) |

**Conclusion:** After deleting `chrome-tint.ts`, `branding-chrome-tint.test.ts`, and stripping
the `brandingFromRow` body, there are ZERO remaining references to these 4 fields outside:
1. `lib/branding/types.ts` itself (the definitions)
2. `app/(shell)/app/branding/_lib/schema.ts` (orphan schemas — see below)
3. `shade-picker.tsx` uses `BackgroundShade` type (deleted in CLEAN-07)

**Phase-18-style wave-split is NOT needed.** All consumers are gone before the type drop.
This is atomic-safe.

**After dropping the 4 fields, `BackgroundShade` and `ChromeTintIntensity` type definitions
become orphaned in `types.ts`** — both types are only referenced by the fields being dropped
(plus `schema.ts` which imports `ChromeTintIntensity`, and `shade-picker.tsx` which imports
`BackgroundShade` — both being deleted). Drop `BackgroundShade` and `ChromeTintIntensity`
type aliases from `types.ts` as well.

---

## `AccountSummary` Shim Drop Blast Radius

**Target fields in `app/[account]/[event-slug]/_lib/types.ts`:**
- `background_color: string | null` (line 14)
- `background_shade: string` (line 15)

**Callers of `AccountSummary`:**
- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — imports `AccountSummary`,
  uses only `account.brand_primary`, `account.logo_url`, `account.name`. Does NOT read
  `account.background_color` or `account.background_shade`.
- `app/[account]/[event-slug]/_components/booking-shell.tsx` — uses only `account.name`,
  `account.timezone`. Does NOT read deprecated fields.
- `app/[account]/[event-slug]/page.tsx` — passes `data.account` to `brandingFromRow()`.
  After stripping the brandingFromRow signature, this becomes a pass-through with no TS error.

**DB SELECT in `load-event-type.ts` line 27:**
```
.select("id, slug, name, timezone, owner_email, logo_url, brand_primary, background_color, background_shade")
```
This actively queries deprecated columns. Must be updated when `AccountSummary` drops those fields.

**Same issue in `app/[account]/_lib/types.ts` (AccountListingData.account):**
- `background_color: string | null` (line 11)
- `background_shade: string` (line 13)
- DB SELECT in `load-account-listing.ts` line 23 is identical

**Consumer of `AccountListingData`:**
- `app/[account]/page.tsx` passes `data.account` to `brandingFromRow()`. Same analysis as above.

**Recommendation:** Drop both pairs of fields from both type files AND update both SELECT strings
in the same atomic commit. This completely eliminates `background_color` and `background_shade`
from non-migration TypeScript. The columns will still exist in Postgres until Phase 21 DROPs them,
but no code will query or type them.

---

## Orphan Sweep (Discretion Area)

Beyond the named CLEAN-01..09 targets, the following orphaned code was found:

### HIGH PRIORITY — Delete in Phase 20

**1. `app/(shell)/app/branding/_lib/schema.ts` — deprecated exports**

These schema definitions exist but have no production callers (only `tests/branding-schema.test.ts`
which tests the deprecated schemas themselves):
- `backgroundColorSchema` (line 34) — exported, tested by branding-schema.test.ts
- `backgroundShadeSchema` (line 40) — exported, tested by branding-schema.test.ts
- `chromeTintIntensitySchema` (line 45) — exported, used by schema.ts itself only
- `sidebarColorSchema` (line 50) — exported, used in `brandingBackgroundSchema` only
- `brandingBackgroundSchema` (line 56) — exported, tested by branding-schema.test.ts

The production `actions.ts` only imports `primaryColorSchema` and `MAX_LOGO_BYTES` — never
the deprecated schemas. These can be deleted from `schema.ts`.

**2. `tests/branding-schema.test.ts` — tests for deprecated schemas**

Currently has 17 `it()` tests for `backgroundColorSchema`, `backgroundShadeSchema`, and
`brandingBackgroundSchema`. Once those schemas are deleted from `schema.ts`, this test file
becomes a broken import. The schemas being tested validate DB columns that will be DROPped
in Phase 21.

The `primaryColorSchema` tests in `tests/branding-schema.test.ts` are NOT in scope for this
file — checking: this file only tests the deprecated schemas (starts at line 1 with imports
of `backgroundColorSchema`, `backgroundShadeSchema`, `brandingBackgroundSchema` — none of
the 17 tests touch `primaryColorSchema`).

**Delete `tests/branding-schema.test.ts` in Phase 20 along with removing the deprecated
exports from `schema.ts`.** This adds 17 more tests to the count drop.

**3. `tests/send-reminder-for-booking.test.ts` — stale `background_color` in fixture**

Line 72: `background_color: null` in `makeAccountRow()`. This mock object simulates an
accounts row for the send-reminder action. The send-reminder action's DB SELECT (line 144
in `app/(shell)/app/bookings/[id]/_lib/actions.ts`) does NOT select `background_color` —
it selects `id, slug, name, logo_url, brand_primary, owner_email, ...reminder_* columns`.
The mock fixture has a stale field that was never queried. Remove the `background_color: null`
line from the mock. This is a 1-line cleanup, not a test deletion.

### LOW PRIORITY — Phase 21 coordination

**`read-branding.ts` JSDoc comments** (lines 20-23, 73-75): After stripping the body and
signature, the `@deprecated` comments become inaccurate. Clean up as part of the body strip.

---

## `lib/branding/` Barrel Check

**`lib/branding/index.ts` does not exist.** Confirmed by direct filesystem check.
`tsc` will catch any dangling imports directly (no barrel to audit).

---

## Test Count Delta

**Current baseline (Phase 19):** 266 passing tests

**Tests being deleted:**
- `tests/branding-chrome-tint.test.ts`: 27 tests
- `tests/branding-gradient.test.ts`: 8 tests
- `tests/branding-schema.test.ts`: 17 tests (orphan sweep recommendation)
  - If not deleted: 266 - 27 - 8 = **231** (branding-schema.test.ts becomes broken import; vitest would fail)
  - branding-schema.test.ts MUST be deleted because its imports will break after schema cleanup

**1-line fixture cleanup (not a deletion):**
- `tests/send-reminder-for-booking.test.ts`: remove `background_color: null` from `makeAccountRow()`
  (5 tests remain intact)

**Predicted post-Phase-20 count:** 266 - 27 - 8 - 17 = **214 passing**

**Verification approach:** Count = old_count - 52. Assert `vitest` output shows 214 passing.
Do not use brittle grep count — use vitest's reported pass count.

---

## Commit Shape Recommendation

**Use atomic single commit (matching Phase 19 pattern).**

Rationale:
- All deletions have zero external consumers (confirmed by full importer audit above)
- The `Branding` shim drop has no consumers to rewrite — it's a simultaneous type+implementation+consumer deletion
- The `AccountSummary` / `AccountListingData` drop requires updating 2 SELECT strings and 2 type files — still entirely within one logical "remove deprecated columns from TypeScript layer" operation
- No intermediate tsc-broken state: all deletions are leaf nodes or have no callers
- The schema.ts cleanup is self-contained (remove exported symbols, delete test file)

**Single plan: `20-01`** (matches ROADMAP placeholder)

**Pre-commit gate (compose in this order):**
1. `npx tsc --noEmit` — must be clean
2. `npx vitest run` — must show 214 passing (0 failing)
3. `git grep -l "chromeTintToCss\|chromeTintTextColor\|resolveChromeColors\|shadeToGradient\|IntensityPicker\|FloatingHeaderPill\|ShadePicker" -- "*.ts" "*.tsx"` — must return zero files
4. `git grep -l "sidebar_color\|background_color\|background_shade\|chrome_tint_intensity" -- "*.ts" "*.tsx" ":!*migrations*"` — must return zero files (Phase 21 grep-zero gate, folded in per CONTEXT.md discretion)

---

## Risks and Pitfalls

### Risk 1: `AccountSummary` / `AccountListingData` SELECT update scope creep
**What:** Two loader files (`load-event-type.ts`, `load-account-listing.ts`) actively SELECT
`background_color` and `background_shade` from Postgres. Dropping those type fields requires
updating those SELECT strings. If the planner forgets to update the SELECTs, TypeScript will
NOT catch the error (Supabase's generated types may not be tight enough to flag extra columns).
**How to avoid:** Explicitly include `load-event-type.ts` and `load-account-listing.ts` SELECT
updates in the task list. Gate with `git grep -c "background_color\|background_shade" -- "*.ts" ":!*migrations*"`.

### Risk 2: `branding-schema.test.ts` broken import if schema.ts is cleaned but test not deleted
**What:** If the planner removes the deprecated exports from `schema.ts` but doesn't delete
`branding-schema.test.ts`, vitest will fail with a module-not-found or "is not exported" error —
which looks like an unexpected test failure and triggers the halt condition.
**How to avoid:** Add `tests/branding-schema.test.ts` to the deletion list in the plan. Delete
it in the same commit as the schema.ts cleanup.

### Risk 3: `BackgroundShade` type drop requires shade-picker.tsx to be deleted first
**What:** `shade-picker.tsx` imports `BackgroundShade` from `@/lib/branding/types`. Dropping
`BackgroundShade` from types before deleting shade-picker.tsx will cause a tsc error.
**How to avoid:** In a single atomic commit, delete shade-picker.tsx AND drop BackgroundShade
from types.ts simultaneously. No ordering issue in a single commit.

### Risk 4: `chromeTintIntensitySchema` in schema.ts imports `ChromeTintIntensity` from types.ts
**What:** `schema.ts` line 2: `import type { ChromeTintIntensity } from "@/lib/branding/types"`.
After dropping `ChromeTintIntensity` from `types.ts` and removing `chromeTintIntensitySchema`
from `schema.ts`, this import line must also be removed — or tsc will error on a missing named export.
**How to avoid:** When cleaning `schema.ts`, remove the `ChromeTintIntensity` import line.

### Risk 5: `send-reminder-for-booking.test.ts` fixture stale field (LOW severity)
**What:** `makeAccountRow()` line 72 has `background_color: null`. After `AccountSummary` drops
`background_color`, the mock object contains a field that no longer exists in the type. TypeScript
will flag this as "Object literal may only specify known properties" only if the mock is explicitly
typed as `AccountSummary` — checking the test: the mock is returned from a function with no
explicit return type, so tsc may or may not flag it depending on context.
**How to avoid:** Remove the stale field from the mock as part of the cleanup sweep. Low risk of
tsc error but good hygiene and avoids confusion.

### Risk 6: MP-06 ordering (moot in atomic commit)
Per CONTEXT.md: delete `tests/branding-chrome-tint.test.ts` BEFORE deleting `chrome-tint.ts`
function bodies. In an atomic commit (`git rm` both files simultaneously), this ordering is
irrelevant — both deletions land in one commit and tsc only evaluates the final state.

---

## Architecture Patterns

### Deletion Sequence (within single atomic commit)

**Files to delete (`git rm`):**
1. `tests/branding-chrome-tint.test.ts`
2. `tests/branding-gradient.test.ts`
3. `tests/branding-schema.test.ts`
4. `lib/branding/chrome-tint.ts`
5. `app/(shell)/app/branding/_components/shade-picker.tsx`

**Files to edit (surgical removals):**
1. `lib/branding/types.ts` — drop 4 deprecated optional fields + `BackgroundShade` type + `ChromeTintIntensity` type
2. `lib/branding/read-branding.ts` — strip deprecated params from `brandingFromRow` signature and body (lines 31–56 gutted); update import to remove `BackgroundShade`, `ChromeTintIntensity`
3. `app/(shell)/app/branding/_lib/schema.ts` — remove `import type { ChromeTintIntensity }` + remove `backgroundColorSchema`, `backgroundShadeSchema`, `chromeTintIntensitySchema`, `sidebarColorSchema`, `brandingBackgroundSchema` exports
4. `app/[account]/[event-slug]/_lib/types.ts` — drop `background_color` and `background_shade` from `AccountSummary`
5. `app/[account]/[event-slug]/_lib/load-event-type.ts` — update SELECT to remove `background_color, background_shade`
6. `app/[account]/_lib/types.ts` — drop `background_color` and `background_shade` from `AccountListingData.account`
7. `app/[account]/_lib/load-account-listing.ts` — update SELECT to remove `background_color, background_shade`
8. `tests/send-reminder-for-booking.test.ts` — remove `background_color: null` from `makeAccountRow()` fixture

**NO-OP verifications (log only):**
- `app/_components/gradient-backdrop.tsx` — MISSING (CLEAN-04)
- `components/nsi-gradient-backdrop.tsx` — MISSING (CLEAN-05)
- `lib/branding/gradient.ts` — MISSING (CLEAN-06)
- `app/(shell)/_components/floating-header-pill.tsx` — MISSING (CLEAN-08)
- `app/(shell)/app/branding/_components/intensity-picker.tsx` — MISSING (CLEAN-09)

---

## `brandingFromRow` Post-Cleanup Shape

After cleanup, the function signature and body should be:

```typescript
// Source: direct codebase audit 2026-05-01
export function brandingFromRow(row: {
  logo_url: string | null;
  brand_primary: string | null;
}): Branding {
  const primaryColor = row.brand_primary ?? DEFAULT_BRAND_PRIMARY;
  return {
    logoUrl: row.logo_url ?? null,
    primaryColor,
    textColor: pickTextColor(primaryColor),
  };
}
```

And `Branding` becomes:
```typescript
export interface Branding {
  logoUrl: string | null;
  primaryColor: string;
  textColor: "#ffffff" | "#000000";
}
```

---

## Sources

### Primary (HIGH confidence — direct codebase audit)
- `lib/branding/chrome-tint.ts` — read in full
- `lib/branding/read-branding.ts` — read in full
- `lib/branding/types.ts` — read in full
- `tests/branding-chrome-tint.test.ts` — read in full (27 tests counted)
- `tests/branding-gradient.test.ts` — read in full (8 tests counted)
- `tests/branding-schema.test.ts` — read in full (17 tests counted)
- `app/(shell)/app/branding/_lib/schema.ts` — read in full
- `app/(shell)/app/branding/_lib/actions.ts` — read in full
- `app/(shell)/app/branding/_lib/load-branding.ts` — read in full
- `app/[account]/[event-slug]/_lib/types.ts` — read in full
- `app/[account]/[event-slug]/_lib/load-event-type.ts` — read in full
- `app/[account]/_lib/types.ts` — read in full
- `app/[account]/_lib/load-account-listing.ts` — read in full
- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — read in full
- `app/_components/public-shell.tsx` — read in full
- `app/_components/background-glow.tsx` — read in full
- All importers verified via exhaustive grep across `*.ts`/`*.tsx`

---

## Metadata

**Confidence breakdown:**
- Deletion target inventory: HIGH — files read, importers grep-verified
- brandingFromRow blast radius: HIGH — all callers read, downstream consumers read
- Branding shim blast radius: HIGH — exhaustive grep for all 4 field names
- AccountSummary blast radius: HIGH — SELECT strings read, consumers read
- Orphan sweep: HIGH — schema.ts read, branding-schema.test.ts read
- Test count delta: HIGH — it() counted per file
- Commit shape: HIGH — dependency graph is clear

**Research date:** 2026-05-01
**Valid until:** N/A (codebase-specific audit, not library documentation)
