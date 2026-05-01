---
phase: 17-public-surfaces-and-embed
plan: 08
type: execute
wave: 4
depends_on: ["17-03", "17-04", "17-05", "17-06", "17-07"]
files_modified:
  - app/(shell)/app/branding/_components/mini-preview-card.tsx
  - app/_components/branded-page.tsx
  - app/_components/gradient-backdrop.tsx
  - components/nsi-gradient-backdrop.tsx
  - lib/branding/gradient.ts
autonomous: true

must_haves:
  truths:
    - "mini-preview-card.tsx no longer imports GradientBackdrop"
    - "BrandedPage component file is deleted"
    - "GradientBackdrop component file is deleted"
    - "NSIGradientBackdrop component file is deleted"
    - "lib/branding/gradient.ts is deleted (no remaining consumers)"
    - "Codebase grep for BrandedPage, GradientBackdrop, NSIGradientBackdrop returns zero matches in source files"
  artifacts:
    - path: "app/(shell)/app/branding/_components/mini-preview-card.tsx"
      provides: "Branding editor preview rebuilt without GradientBackdrop dependency"
      removes: "GradientBackdrop import + render"
  key_links:
    - from: "(deletion)"
      to: "app/_components/branded-page.tsx"
      via: "rm"
      pattern: "(file does not exist)"
    - from: "(deletion)"
      to: "app/_components/gradient-backdrop.tsx"
      via: "rm"
      pattern: "(file does not exist)"
---

<objective>
Final cleanup wave: migrate `mini-preview-card.tsx` (the last `GradientBackdrop` consumer in the codebase, located in the owner-side branding editor) to a flat color tint, then delete the four superseded files: `BrandedPage`, `GradientBackdrop`, `NSIGradientBackdrop`, and `lib/branding/gradient.ts`.

Purpose: PUB-12 requires these deletions. Per RESEARCH.md Pitfall 3, `mini-preview-card.tsx` blocks the deletion because it's the only remaining `GradientBackdrop` consumer outside the public surfaces (which were migrated in Wave 3). This plan closes that gap and completes the dead-code removal.

Output: Four file deletions + one mini-preview-card simplification. Codebase grep returns zero hits for `BrandedPage`, `GradientBackdrop`, `NSIGradientBackdrop`, `shadeToGradient` in `.ts/.tsx` source files.
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
@.planning/phases/17-public-surfaces-and-embed/17-CONTEXT.md
@.planning/phases/17-public-surfaces-and-embed/17-RESEARCH.md

# Files this plan modifies / deletes
@app/(shell)/app/branding/_components/mini-preview-card.tsx
@app/_components/branded-page.tsx
@app/_components/gradient-backdrop.tsx
@components/nsi-gradient-backdrop.tsx
@lib/branding/gradient.ts
</context>

<preamble>
## v1.2 Visual Locks
1-6. (See REQUIREMENTS.md preamble)

## Phase 17 Guardrails
- **MP-09 ordering rule:** GradientBackdrop deletion is the LAST step. The only remaining consumer (mini-preview-card.tsx) MUST be migrated FIRST in this plan. Reverse the order and the deployment will break.
- **Phase 18 will fully rebuild MiniPreviewCard:** Per BRAND-17, Phase 18 rebuilds this component as a faux public booking page. This plan only does the minimum to free up GradientBackdrop deletion — Phase 18 will replace this component entirely.
- **Don't touch `lib/branding/types.ts` `BackgroundShade` type yet:** Phase 18/21 will remove it. This plan's mini-preview-card update can drop the `shade` prop, but the `BackgroundShade` type itself stays for now.
- **CLEAN-04, CLEAN-05, CLEAN-06 traceability:** Those CLEAN requirements live in Phase 20 per the roadmap, but the actual file deletions must happen here in Phase 17 because PUB-12 explicitly requires them. Phase 20's CLEAN-04..06 will be no-op verifications confirming the deletions stuck.

## Requirement coverage
- PUB-12: covered by all 5 tasks (1 migration + 4 deletions)
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Migrate mini-preview-card.tsx away from GradientBackdrop</name>
  <files>app/(shell)/app/branding/_components/mini-preview-card.tsx</files>
  <action>
Open `app/(shell)/app/branding/_components/mini-preview-card.tsx`. Currently imports `GradientBackdrop` and `BackgroundShade` and renders the gradient as part of the faux dashboard preview.

Per RESEARCH.md OQ-1, replace the `GradientBackdrop` with a flat tinted background. Phase 18 will rebuild this component entirely as a faux public booking page (BRAND-17), so this task is a minimal-change bridge to unblock GradientBackdrop deletion.

**Edit plan:**

1. Remove imports:
```typescript
// REMOVE
import type { BackgroundShade } from "@/lib/branding/types";
import { GradientBackdrop } from "@/app/_components/gradient-backdrop";
```

2. Update props interface — remove `shade`:
```typescript
interface MiniPreviewCardProps {
  sidebarColor: string | null;
  pageColor: string | null;
  primaryColor: string | null;
}
```

3. Update function signature:
```typescript
export function MiniPreviewCard({ sidebarColor, pageColor, primaryColor }: MiniPreviewCardProps) {
```

4. Replace the `<GradientBackdrop color={pageColor} shade={shade} />` line with nothing (just delete it). The page-area `<div className="relative ml-12 h-full overflow-hidden">` still renders correctly with the flat `style={{ backgroundColor: pageColor ?? undefined }}` from the parent — that's already on the outer container at line 30.

The simplified return:
```typescript
return (
  <div className="space-y-1.5">
    <p className="text-sm font-medium text-muted-foreground">Preview</p>
    <div
      className="relative h-48 overflow-hidden rounded-lg border"
      style={{ backgroundColor: pageColor ?? undefined }}
    >
      {/* Faux sidebar strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-12 border-r border-border/30"
        style={{ backgroundColor: sidebarColor ?? "hsl(var(--sidebar))" }}
      >
        {/* Sidebar shimmer items */}
        <div className="flex flex-col gap-2 p-2 pt-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-2 rounded-full bg-foreground/15 w-full" />
          ))}
        </div>
      </div>

      {/* Page area (right of sidebar) — flat color tint, gradient removed for v1.2 */}
      <div className="relative ml-12 h-full overflow-hidden">
        {/* Faux card — always white, invariant of colors */}
        <div className="relative mx-3 mt-4 rounded-md bg-white p-3 shadow-sm">
          <div className="h-2.5 w-2/3 rounded-full bg-foreground/10 mb-2" />
          <div className="h-2 w-1/2 rounded-full bg-foreground/8 mb-1" />
          <div className="mt-2 flex items-center gap-2">
            <div
              className="h-6 w-14 rounded text-[0px]"
              style={{ backgroundColor: primaryColor ?? "hsl(var(--primary))" }}
            />
            <div
              className="h-4 w-7 rounded-full"
              style={{ backgroundColor: primaryColor ?? "hsl(var(--primary))" }}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);
```

**Phase 18 will rebuild this entirely — this is a bridge edit only.** Do NOT add new visual elements; do NOT change layout structure. Just remove the `<GradientBackdrop>` render and the `shade` prop plumbing.

5. **Update consumer (branding editor page):** Search for callers of `<MiniPreviewCard`:

```bash
grep -rn "MiniPreviewCard" app/(shell)/app/branding/
```

Find every call site and remove the `shade={...}` prop. Likely callers: `app/(shell)/app/branding/_components/branding-editor.tsx` (or similar). Adjust each caller to drop `shade` from the props passed to `<MiniPreviewCard>`. Do NOT change other props (sidebarColor, pageColor, primaryColor must still be passed).

If any caller imports `BackgroundShade` solely for `MiniPreviewCard` use, also remove that import.
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "GradientBackdrop" app/(shell)/app/branding/_components/mini-preview-card.tsx` — zero matches.
Run `grep -n "BackgroundShade" app/(shell)/app/branding/_components/mini-preview-card.tsx` — zero matches.
Run `grep -rn "<MiniPreviewCard" app/(shell)/app/branding/` — confirm no caller passes `shade=`.
Run `grep -rn "GradientBackdrop" app/(shell)/` — zero matches across the entire owner shell tree.
  </verify>
  <done>mini-preview-card.tsx has no GradientBackdrop import or render. `shade` prop removed from interface and all consumers. Owner-shell tree has zero remaining GradientBackdrop references. TypeScript clean.</done>
</task>

<task type="auto">
  <name>Task 2: Delete BrandedPage, GradientBackdrop, NSIGradientBackdrop, lib/branding/gradient.ts</name>
  <files>app/_components/branded-page.tsx, app/_components/gradient-backdrop.tsx, components/nsi-gradient-backdrop.tsx, lib/branding/gradient.ts</files>
  <action>
With Wave 3 complete (all 5 public pages migrated to PublicShell, embed restyled, edge pages updated) and Task 1 of this plan complete (mini-preview-card freed of GradientBackdrop), the four deletion targets have zero consumers.

**Pre-deletion grep gate (verify before deleting):**

```bash
# Each of these should return zero matches in .ts/.tsx files (excluding the file itself):
grep -rn "BrandedPage" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v "branded-page.tsx"
grep -rn "GradientBackdrop" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v "gradient-backdrop.tsx"
grep -rn "NSIGradientBackdrop" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v "nsi-gradient-backdrop.tsx"
grep -rn "shadeToGradient" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v "lib/branding/gradient.ts"
```

If ANY of these returns matches (other than the file itself or comment-only references like `auth-hero.tsx` line 29's "Powered by NSI" text comment), STOP. Investigate and migrate the consumer FIRST. Do not proceed with deletion until the grep gate is clean.

**Acceptable comment-only matches (do NOT block deletion):**
- `app/(auth)/_components/auth-hero.tsx` may reference "NSIGradientBackdrop" in a comment block describing the Phase 16 migration history. Comments don't break compilation.

**Deletion commands (run after grep gate passes):**

```bash
rm "app/_components/branded-page.tsx"
rm "app/_components/gradient-backdrop.tsx"
rm "components/nsi-gradient-backdrop.tsx"
rm "lib/branding/gradient.ts"
```

**Post-deletion verification:**

```bash
npx tsc --noEmit
```

Must pass with zero errors. If any error appears, the consumer-migration assumption was wrong — restore the deleted file(s) and investigate.

**Note about `lib/branding/gradient.ts`:** This file exports `shadeToGradient`, used historically by `GradientBackdrop` to compute opacity/blur values per shade. Since `GradientBackdrop` is being deleted, `shadeToGradient` has zero consumers and the entire file is removed. The `BackgroundShade` type is defined in `lib/branding/types.ts`, NOT this file — that type stays.

**Note about `components/nsi-gradient-backdrop.tsx`:** Per RESEARCH.md Q3, this is a thin wrapper around `GradientBackdrop` and currently has zero active import consumers (auth-hero.tsx only references it in a Phase 16 migration comment). Safe to delete.
  </action>
  <verify>
Run `ls app/_components/branded-page.tsx 2>/dev/null` — must return "No such file or directory" (or empty).
Run `ls app/_components/gradient-backdrop.tsx 2>/dev/null` — same.
Run `ls components/nsi-gradient-backdrop.tsx 2>/dev/null` — same.
Run `ls lib/branding/gradient.ts 2>/dev/null` — same.
Run `npx tsc --noEmit` — must pass with zero errors.
Run `grep -rn "BrandedPage\\|GradientBackdrop\\|NSIGradientBackdrop\\|shadeToGradient" app/ components/ lib/ --include="*.ts" --include="*.tsx"` — must return zero matches in source files (comment-only references in auth-hero.tsx are acceptable).
  </verify>
  <done>Four files deleted. TypeScript clean. Zero consumers remain for any of the deleted exports. Codebase is fully migrated to BackgroundGlow + PublicShell.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zero errors.
2. `npm run build` — must succeed (full Next.js build catches dynamic-import / route-discovery issues that tsc misses).
3. Filesystem confirms 4 deleted files no longer exist.
4. Grep for the 4 deleted symbols across `app/`, `components/`, `lib/` returns no source-code matches (comments OK).
</verification>

<success_criteria>
1. `mini-preview-card.tsx` does not import `GradientBackdrop` or `BackgroundShade`.
2. `app/_components/branded-page.tsx` does not exist.
3. `app/_components/gradient-backdrop.tsx` does not exist.
4. `components/nsi-gradient-backdrop.tsx` does not exist.
5. `lib/branding/gradient.ts` does not exist.
6. `npx tsc --noEmit` passes.
7. `npm run build` succeeds.
</success_criteria>

<output>
After completion, create `.planning/phases/17-public-surfaces-and-embed/17-08-deletions-and-mini-preview-SUMMARY.md`. List the 4 deleted files, the mini-preview-card changes, and confirm the grep gate is clean. Note that Phase 18 will fully rebuild MiniPreviewCard per BRAND-17 (this is a bridge change).
</output>
