---
phase: 12-branded-ui-overhaul
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260429120000_phase12_branding_columns.sql
  - lib/branding/types.ts
  - lib/branding/read-branding.ts
  - lib/branding/gradient.ts
  - app/_components/branded-page.tsx
  - app/_components/gradient-backdrop.tsx
  - components/nsi-gradient-backdrop.tsx
  - app/(shell)/app/branding/_lib/schema.ts
  - app/(shell)/app/branding/_lib/load-branding.ts
  - app/(shell)/app/branding/_lib/actions.ts
  - app/(shell)/app/branding/_components/branding-editor.tsx
  - app/(shell)/app/branding/_components/color-picker-input.tsx
  - app/(shell)/app/branding/_components/shade-picker.tsx
  - app/(shell)/app/branding/_components/mini-preview-card.tsx
autonomous: true

must_haves:
  truths:
    - "An owner can pick a background_color from a curated swatch palette OR enter a custom hex on /app/branding"
    - "An owner can pick a background_shade (none / subtle / bold) on /app/branding"
    - "An inline mini-preview card on /app/branding shows the gradient blur-circles updating live as the owner adjusts background_color and background_shade"
    - "background_color + background_shade persist to the accounts row and are returned by readBrandingForAccount()"
    - "BrandedPage wrapper exposes --brand-bg-color and --brand-bg-shade CSS variables on its root element so consumer surfaces can render gradient backdrops"
    - "GradientBackdrop and NSIGradientBackdrop components are reusable primitives that render Cruip-style blur-circle gradients (or a flat tint when shade=none)"
  artifacts:
    - path: "supabase/migrations/20260429120000_phase12_branding_columns.sql"
      provides: "background_color + background_shade columns + enum + CHECK constraints"
      contains: "ADD COLUMN IF NOT EXISTS background_color"
    - path: "lib/branding/types.ts"
      provides: "Branding interface extended with backgroundColor + backgroundShade"
      contains: "backgroundShade"
    - path: "lib/branding/read-branding.ts"
      provides: "readBrandingForAccount() returns new fields"
      contains: "background_color"
    - path: "lib/branding/gradient.ts"
      provides: "shadeToGradient helper (pure function): inputs={color, shade}, output={tint, circles[]}"
      exports: ["shadeToGradient"]
    - path: "app/_components/gradient-backdrop.tsx"
      provides: "Reusable client component rendering 3 Cruip blur-circle divs (or flat tint when shade=none)"
      exports: ["GradientBackdrop"]
    - path: "components/nsi-gradient-backdrop.tsx"
      provides: "NSI-token-fixed gradient backdrop for auth pages (color=#0A2540, shade='subtle')"
      exports: ["NSIGradientBackdrop"]
    - path: "app/_components/branded-page.tsx"
      provides: "Wrapper exposes --brand-bg-color, --brand-bg-shade alongside existing --brand-primary, --brand-text"
      contains: "--brand-bg-color"
    - path: "app/(shell)/app/branding/_lib/schema.ts"
      provides: "Zod schema for background_color (hex regex) + background_shade (enum)"
      contains: "background_shade"
    - path: "app/(shell)/app/branding/_components/shade-picker.tsx"
      provides: "3-button toggle for none / subtle / bold"
      exports: ["ShadePicker"]
    - path: "app/(shell)/app/branding/_components/mini-preview-card.tsx"
      provides: "Inline preview card rendering GradientBackdrop with current editor state"
      exports: ["MiniPreviewCard"]
  key_links:
    - from: "app/(shell)/app/branding/_components/branding-editor.tsx"
      to: "app/(shell)/app/branding/_lib/actions.ts"
      via: "saveBrandingAction Server Action call with backgroundColor + backgroundShade"
      pattern: "saveBrandingAction"
    - from: "app/(shell)/app/branding/_lib/actions.ts"
      to: "supabase accounts table"
      via: "UPDATE background_color + background_shade"
      pattern: "background_color"
    - from: "app/_components/branded-page.tsx"
      to: "lib/branding/types.ts"
      via: "Branding type import + style.cssVariables expansion"
      pattern: "backgroundColor|backgroundShade"
    - from: "lib/branding/read-branding.ts"
      to: "supabase accounts table"
      via: "SELECT including background_color + background_shade"
      pattern: "background_color"
---

<objective>
Establish Phase 12's branding-tokens foundation: add per-account `background_color` (nullable hex) + `background_shade` (none/subtle/bold) to the `accounts` table, extend the `Branding` type + reader, ship reusable `GradientBackdrop` / `NSIGradientBackdrop` primitives that consume these tokens, expose new CSS variables on `BrandedPage`, and add the swatch-picker + shade-picker + mini-preview-card UI to `/app/branding` so the owner can configure both fields with live local preview.

Purpose: This plan is the foundation for Wave 2 (dashboard chrome) and Wave 3 (public surfaces + emails). Every consumer in this phase reads from these primitives; getting them right once unblocks all parallel restyle work and prevents the Tailwind-v4-dynamic-class JIT pitfall (Phase 7 lesson) from regressing.

Output:
- Migration `20260429120000_phase12_branding_columns.sql`
- Extended `Branding` type with `backgroundColor: string | null` and `backgroundShade: 'none' | 'subtle' | 'bold'`
- `lib/branding/gradient.ts` pure helper
- `app/_components/gradient-backdrop.tsx` (account-tokens consumer)
- `components/nsi-gradient-backdrop.tsx` (NSI-fixed for auth)
- `BrandedPage` augmented with `--brand-bg-color` + `--brand-bg-shade` CSS vars
- `/app/branding` UI: existing color-picker EXTENDED to swatches + custom hex; NEW shade-picker (3 buttons); NEW inline mini-preview card; persistence wired through schema/actions
- BRAND-05, BRAND-06, BRAND-07 coverage
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
@.planning/phases/12-branded-ui-overhaul/12-CONTEXT.md
@.planning/phases/12-branded-ui-overhaul/12-RESEARCH.md

# Existing code to extend (do NOT rewrite from scratch — additive)
@app/_components/branded-page.tsx
@lib/branding/types.ts
@lib/branding/read-branding.ts
@lib/branding/contrast.ts
@app/(shell)/app/branding/_components/branding-editor.tsx
@app/(shell)/app/branding/_components/color-picker-input.tsx
@app/(shell)/app/branding/_lib/schema.ts
@app/(shell)/app/branding/_lib/actions.ts
@app/(shell)/app/branding/_lib/load-branding.ts

# Migration locked workaround (Phase 11 STATE)
# Use: npx supabase db query --linked -f <migration.sql>
# DO NOT use `supabase db push` (CLI tracking-table drift).
</context>

<tasks>

<task type="auto">
  <name>Task 1: DB migration + branding types + reader + gradient helper</name>
  <files>
    supabase/migrations/20260429120000_phase12_branding_columns.sql
    lib/branding/types.ts
    lib/branding/read-branding.ts
    lib/branding/gradient.ts
  </files>
  <action>
    Create `supabase/migrations/20260429120000_phase12_branding_columns.sql` with:

    ```sql
    -- Phase 12: per-account background_color + background_shade tokens
    ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS background_color text
        CHECK (background_color IS NULL OR background_color ~* '^#[0-9a-f]{6}$');

    DO $$ BEGIN
      CREATE TYPE background_shade AS ENUM ('none', 'subtle', 'bold');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS background_shade background_shade NOT NULL DEFAULT 'subtle';

    COMMENT ON COLUMN accounts.background_color IS
      'Phase 12: per-account hex tint for gradient backdrops. NULL = falls back to gray-50.';
    COMMENT ON COLUMN accounts.background_shade IS
      'Phase 12: gradient intensity. none=flat tint of background_color (4% over white); subtle=light circles; bold=full Cruip pattern.';
    ```

    Apply via locked workaround: `npx supabase db query --linked -f supabase/migrations/20260429120000_phase12_branding_columns.sql`. Verify with `npx supabase db query --linked` running `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='accounts' AND column_name LIKE 'background%'`.

    Extend `lib/branding/types.ts` `Branding` interface:
    ```ts
    export type BackgroundShade = 'none' | 'subtle' | 'bold';

    export interface Branding {
      logoUrl: string | null;
      primaryColor: string;
      textColor: '#ffffff' | '#000000';
      // Phase 12 additions
      backgroundColor: string | null;   // null = use gray-50 fallback at consumer
      backgroundShade: BackgroundShade; // never null (DB DEFAULT 'subtle')
    }
    ```
    Update `brandingFromRow` (and any DB-row → Branding mapper) to read `background_color` (string | null) and `background_shade` (cast to BackgroundShade with `'subtle'` fallback when undefined).

    Update `lib/branding/read-branding.ts` SELECT to include `background_color, background_shade`. Confirm RLS allows owner to SELECT own row (existing v1.0 SELECT policy already covers this).

    Create `lib/branding/gradient.ts` (NEW, pure module — no React, no DOM):
    ```ts
    import type { BackgroundShade } from "./types";

    export interface GradientCircle {
      // CSS-ready inline-style fragments for one of the 3 blur circles.
      backgroundImage: string;  // e.g. "linear-gradient(to top right, #0A2540, transparent)"
      opacity: number;          // 0-1
      blurPx: number;           // px value for filter: blur(...)
      // positional class additions are owned by the consumer (GradientBackdrop)
    }

    export interface GradientPlan {
      shade: BackgroundShade;
      flatTint: string | null;  // when shade='none', a color-mix tint string; otherwise null
      circles: GradientCircle[]; // empty when shade='none'
    }

    export function shadeToGradient(color: string | null, shade: BackgroundShade): GradientPlan {
      const baseColor = color ?? '#F8FAFC'; // gray-50 fallback
      if (shade === 'none') {
        return {
          shade,
          flatTint: `color-mix(in oklch, ${baseColor} 4%, white)`,
          circles: [],
        };
      }
      const opacity = shade === 'subtle' ? 0.25 : 0.5;
      const blurPx = shade === 'subtle' ? 200 : 160;
      return {
        shade,
        flatTint: null,
        circles: [
          { backgroundImage: `linear-gradient(to top right, ${baseColor}, transparent)`, opacity, blurPx },
          { backgroundImage: `linear-gradient(to top right, ${baseColor}, #0F172A)`, opacity, blurPx },
          { backgroundImage: `linear-gradient(to top right, ${baseColor}, #0F172A)`, opacity, blurPx },
        ],
      };
    }
    ```

    Add Vitest unit tests for `shadeToGradient` covering all 3 shades + null color (gray-50 fallback). Add to `tests/branding-gradient.test.ts`. Run: `npm test -- branding-gradient`.

    Why this design: Pure helper means all consumers (GradientBackdrop, NSIGradientBackdrop, mini-preview-card, future email preview) share one source of truth. Avoids drift across surfaces. Phase 7 BrandedPage pattern — extend it, don't fork.
  </action>
  <verify>
    1. `npx supabase db query --linked -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='accounts' AND column_name LIKE 'background%' ORDER BY column_name;"` returns 2 rows (`background_color text`, `background_shade USER-DEFINED`).
    2. `npx supabase db query --linked -c "SELECT background_color, background_shade FROM accounts WHERE slug='nsi';"` returns `(null, 'subtle')`.
    3. `npm test -- branding-gradient` — all cases pass (none-with-color, none-without-color, subtle, bold).
    4. `npx tsc --noEmit` — no errors in `lib/branding/*.ts`.
  </verify>
  <done>
    Migration applied to prod (NSI account row has `background_color=null, background_shade='subtle'`). `Branding` type has new fields. `readBrandingForAccount()` returns them. `shadeToGradient` is unit-tested. No TypeScript errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: GradientBackdrop + NSIGradientBackdrop primitives + BrandedPage CSS variable extension</name>
  <files>
    app/_components/gradient-backdrop.tsx
    components/nsi-gradient-backdrop.tsx
    app/_components/branded-page.tsx
  </files>
  <action>
    Create `app/_components/gradient-backdrop.tsx` (client component — uses inline `style` for runtime hex values, NO Tailwind dynamic classes — Phase 7 pitfall):

    ```tsx
    "use client";
    import type { BackgroundShade } from "@/lib/branding/types";
    import { shadeToGradient } from "@/lib/branding/gradient";

    interface GradientBackdropProps {
      color: string | null;
      shade: BackgroundShade;
    }

    /**
     * Cruip-pattern decorative gradient blur-circles for branded surfaces.
     * Renders 3 absolutely-positioned divs with blur(160px) gradient fills.
     * shade='none' renders a flat color-mix tint instead.
     *
     * Consumer responsibility: place inside a `relative` parent with `overflow-hidden` if scrollheight matters (embed iframe pitfall).
     */
    export function GradientBackdrop({ color, shade }: GradientBackdropProps) {
      const plan = shadeToGradient(color, shade);
      if (plan.shade === 'none') {
        return (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{ backgroundColor: plan.flatTint ?? undefined }}
          />
        );
      }
      // Three positioned circles per Cruip pattern (research §Pattern 2)
      const positions = [
        "pointer-events-none absolute -top-32 left-1/2 ml-[280px] -translate-x-1/2 -z-10",
        "pointer-events-none absolute left-1/2 top-[420px] ml-[180px] -translate-x-1/2 -z-10",
        "pointer-events-none absolute left-1/2 top-[640px] -ml-[200px] -translate-x-1/2 -z-10",
      ];
      return (
        <>
          {plan.circles.map((c, i) => (
            <div key={i} aria-hidden className={positions[i]}>
              <div
                className="h-80 w-80 rounded-full"
                style={{
                  backgroundImage: c.backgroundImage,
                  opacity: c.opacity,
                  filter: `blur(${c.blurPx}px)`,
                }}
              />
            </div>
          ))}
        </>
      );
    }
    ```

    Create `components/nsi-gradient-backdrop.tsx` (NSI-fixed wrapper for auth pages — CONTEXT lock: NSI tokens always, regardless of visiting account):

    ```tsx
    import { GradientBackdrop } from "@/app/_components/gradient-backdrop";

    /**
     * Auth-page gradient backdrop. Uses fixed NSI tokens (CONTEXT.md lock):
     * pre-signup users have no account context, so auth pages always render NSI brand.
     */
    export function NSIGradientBackdrop() {
      return <GradientBackdrop color="#0A2540" shade="subtle" />;
    }
    ```

    Modify `app/_components/branded-page.tsx`:
    - Add new optional props: `backgroundColor?: string | null`, `backgroundShade?: BackgroundShade`.
    - Existing call sites pass only `logoUrl` + `primaryColor` + `accountName`; new props are additive (default `backgroundShade='subtle'`, `backgroundColor=null`).
    - On the root wrapper element, augment the inline `style` with two new CSS variables:
      `--brand-bg-color: ${backgroundColor ?? '#F8FAFC'}` and `--brand-bg-shade: ${backgroundShade ?? 'subtle'}`.
    - Render `<GradientBackdrop color={backgroundColor} shade={backgroundShade ?? 'subtle'} />` as the FIRST child inside the root wrapper, BEFORE `{children}`.
    - Ensure root wrapper has `relative overflow-hidden` so blur circles clip inside.
    - DO NOT change existing `--brand-primary` / `--brand-text` exports. DO NOT alter signature for old callers (4 routes consume this — see research).

    Why this design: Wave 3 plans render `<BrandedPage backgroundColor={branding.backgroundColor} backgroundShade={branding.backgroundShade}>` with no other code changes. Plan 12-04 dashboard root will pass identical props. Plan 12-02 auth pages compose `<NSIGradientBackdrop />` directly without going through BrandedPage (because BrandedPage is account-scoped and auth pages have no account).
  </action>
  <verify>
    1. `npx tsc --noEmit` passes.
    2. `grep -r "BrandedPage" app/` shows existing 4 callers (`/[account]`, `/[account]/[event-slug]`, `/[account]/[event-slug]/confirmed`, `/cancel/[token]`, `/reschedule/[token]`) — none broken (props are optional).
    3. Visit `/nsi` in dev (with NSI account having `background_color=null, background_shade='subtle'`); confirm 3 blur circles render behind the page (gray-50 fallback color).
    4. Open `/nsi` DevTools → inspect root element → see `--brand-bg-color` and `--brand-bg-shade` in computed styles.
  </verify>
  <done>
    `GradientBackdrop` + `NSIGradientBackdrop` ship as reusable primitives. `BrandedPage` exposes new CSS vars + renders the backdrop additively. Existing 4 consumer routes still render correctly with no props passed (default subtle gray-50 backdrop appears).
  </done>
</task>

<task type="auto">
  <name>Task 3: /app/branding swatches + custom hex + shade picker + mini-preview card + persistence</name>
  <files>
    app/(shell)/app/branding/_lib/schema.ts
    app/(shell)/app/branding/_lib/load-branding.ts
    app/(shell)/app/branding/_lib/actions.ts
    app/(shell)/app/branding/_components/branding-editor.tsx
    app/(shell)/app/branding/_components/color-picker-input.tsx
    app/(shell)/app/branding/_components/shade-picker.tsx
    app/(shell)/app/branding/_components/mini-preview-card.tsx
  </files>
  <action>
    **schema.ts** — extend the existing zod schema. Add:
    - `background_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional()` (nullable persists DB null when owner clears).
    - `background_shade: z.enum(['none', 'subtle', 'bold']).default('subtle')`.

    **load-branding.ts** — `BrandingState` type adds `backgroundColor: string | null`, `backgroundShade: 'none' | 'subtle' | 'bold'`. Reader pulls from `accounts.background_color`, `accounts.background_shade` (already returned by readBrandingForAccount from Task 1 — but `/app/branding` may have its own loader; verify and align).

    **actions.ts** — `saveBrandingAction` accepts the new fields, writes them to the `accounts` UPDATE statement. Defensive: if `background_color` is empty string, persist as `null`.

    **color-picker-input.tsx** — extend the existing component (do NOT replace) to add a curated swatch palette ABOVE the existing native `<input type="color">` + hex input. Use the 8 swatches from research:

    ```ts
    const CRUIP_SWATCHES = [
      { name: "NSI Navy",    hex: "#0A2540" },
      { name: "Cruip Blue",  hex: "#3B82F6" },
      { name: "Forest",      hex: "#10B981" },
      { name: "Sunset",      hex: "#F97316" },
      { name: "Magenta",     hex: "#EC4899" },
      { name: "Violet",      hex: "#8B5CF6" },
      { name: "Slate",       hex: "#475569" },
      { name: "Stone",       hex: "#78716C" },
    ];
    ```
    Render as 8 round buttons (`h-8 w-8 rounded-full`) with `style={{ backgroundColor: swatch.hex }}`, `aria-label={swatch.name}`, with a `ring-2 ring-offset-2` highlight when `value === swatch.hex`. Click sets value via `onChange(swatch.hex)`. The existing native picker + hex text input stay below — labelled "Or enter a custom hex".

    Reuse the same `ColorPickerInput` for **both** primary color (existing usage) and the new background_color slot — same component, two instances on the page.

    **shade-picker.tsx** — NEW client component:

    ```tsx
    "use client";
    import type { BackgroundShade } from "@/lib/branding/types";
    interface ShadePickerProps {
      value: BackgroundShade;
      onChange: (shade: BackgroundShade) => void;
    }
    const OPTIONS: Array<{ value: BackgroundShade; label: string; description: string }> = [
      { value: "none",   label: "None",   description: "Flat solid surface, no gradient" },
      { value: "subtle", label: "Subtle", description: "Soft gradient accents (default)" },
      { value: "bold",   label: "Bold",   description: "Strong gradient circles" },
    ];
    export function ShadePicker({ value, onChange }: ShadePickerProps) {
      return (
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`flex-1 rounded-lg border p-3 text-left transition ${value === o.value ? "border-primary bg-primary/5" : "border-input hover:bg-muted"}`}
              aria-pressed={value === o.value}
            >
              <div className="text-sm font-medium">{o.label}</div>
              <div className="text-xs text-muted-foreground">{o.description}</div>
            </button>
          ))}
        </div>
      );
    }
    ```

    **mini-preview-card.tsx** — NEW client component. A self-contained `relative overflow-hidden h-48 rounded-lg border` card that renders `<GradientBackdrop color={color} shade={shade} />` plus a faux "Dashboard preview" centerpiece (a few lorem-style placeholder bars in gray-200 to give the gradient something to sit behind). Updates live as parent passes new color/shade props. CONTEXT.md lock: this is the ONLY in-page preview — owner navigates to actual surfaces to see in-context.

    **branding-editor.tsx** — wire it together:
    - Lift two new pieces of state alongside existing `primaryColor` + `logoUrl`: `backgroundColor` (init from `state.backgroundColor`), `backgroundShade` (init from `state.backgroundShade`).
    - Add a new section under "Primary color" titled "Background color" + use `<ColorPickerInput value={backgroundColor ?? ''} onChange={setBackgroundColor} />`.
    - Add a section "Background shade" + use `<ShadePicker value={backgroundShade} onChange={setBackgroundShade} />`.
    - Insert `<MiniPreviewCard color={backgroundColor} shade={backgroundShade} />` directly under the shade picker (CONTEXT lock: inline mini-preview).
    - Wire form submit to pass `backgroundColor` + `backgroundShade` into `saveBrandingAction`.
    - Existing `<PreviewIframe>` remains untouched (it's the legacy primary-color/logo preview); the mini-preview card is additive, narrowly scoped to gradient.

    Add Vitest unit tests for `schema.ts` covering valid/invalid hex, valid/invalid shade enum, optional/null behavior. Run: `npm test -- branding`.

    Avoid: dynamic Tailwind classes for hex values (`bg-${hex}` does NOT compile — Phase 7 pitfall). Use inline `style` everywhere a runtime hex is involved.
  </action>
  <verify>
    1. `npm test -- branding` — schema tests pass.
    2. `npm run dev` → log in as NSI owner → visit `/app/branding`. Confirm: 8 swatch circles render above the existing color picker for "Background color" section. Confirm: 3 shade buttons (None/Subtle/Bold) render. Confirm: clicking a swatch updates the inline mini-preview card immediately.
    3. Click "Sunset" swatch + "Bold" shade → mini-preview card shows orange gradient circles.
    4. Click "None" shade → mini-preview card switches to flat tint.
    5. Click "Save". Reload page. Persisted values appear (`background_color='#F97316', background_shade='bold'` in DB).
    6. `npx supabase db query --linked -c "SELECT slug, background_color, background_shade FROM accounts WHERE slug='nsi';"` reflects the saved values.
    7. Reset to `background_color=null, background_shade='subtle'` for clean state before Wave 2.
    8. `npx tsc --noEmit` clean.
  </verify>
  <done>
    Owner can pick background_color (swatch OR custom hex) + background_shade on `/app/branding`; mini-preview card updates live; persistence works end-to-end; all 3 BRAND-05/06/07 requirements satisfied.
  </done>
</task>

</tasks>

<verification>
**Plan-level checks (after all 3 tasks complete):**
- DB has both columns + enum + CHECK constraints (Task 1 verify).
- `Branding` type / reader returns new fields with correct types.
- `GradientBackdrop` renders 3 blur circles when shade='subtle'/'bold', 1 flat tint when shade='none', uses inline `style` for runtime hex (Phase 7 lesson).
- `NSIGradientBackdrop` is a thin pass-through with NSI tokens fixed.
- `BrandedPage` exports `--brand-bg-color` + `--brand-bg-shade` CSS vars; existing 4 consumers render unchanged.
- `/app/branding` UI: swatches + custom hex + shade picker + mini-preview-card all live.
- Persistence: save → reload → values stick.
- All Vitest suites pass; `npx tsc --noEmit` clean.

**Requirements satisfied:**
- BRAND-05 (background_color column)
- BRAND-06 (background_shade column with enum + DEFAULT 'subtle')
- BRAND-07 (branding editor adds swatch picker + shade toggle + live preview — inline mini-preview card per CONTEXT lock)
</verification>

<success_criteria>
1. Migration applied to prod; NSI row defaults to (`null`, `'subtle'`).
2. `Branding` type extended; `readBrandingForAccount()` returns new fields.
3. `shadeToGradient` is unit-tested across all 3 shades + null color.
4. `GradientBackdrop` renders correctly in dev for all 3 shades; uses inline `style` for hex (no Tailwind JIT failures).
5. `NSIGradientBackdrop` ships as the auth-page wrapper.
6. `BrandedPage` exposes `--brand-bg-color` + `--brand-bg-shade`; existing call sites unbroken.
7. `/app/branding` shows 8 swatches + custom hex + shade picker + inline mini-preview card; save persists; reload restores.
8. No regressions in Vitest (148+ baseline) or `npx tsc --noEmit`.

Phase success criterion #3 (owner can pick swatch + shade and see live update) is **fully satisfied for /app/branding mini-preview**; Wave 2 + Wave 3 plans extend this to actual surfaces (dashboard, public, embed, /[account]).
</success_criteria>

<output>
After completion, create `.planning/phases/12-branded-ui-overhaul/12-01-SUMMARY.md` documenting:
- Migration name + applied timestamp
- Tech-stack additions: none (no new packages)
- New patterns established: `GradientBackdrop` as the canonical Cruip-blur-circle primitive; `shadeToGradient` as the pure plan-helper; `NSIGradientBackdrop` for auth surfaces
- Key files: list above
- Decisions: shade='none' = `color-mix(in oklch, ${color} 4%, white)` flat tint (research recommendation); curated 8 Cruip-aligned swatches; mini-preview-card lives only on `/app/branding`
- For Wave 2/3 consumers: pass `branding.backgroundColor` + `branding.backgroundShade` to `<BrandedPage>` (public surfaces) or to `<GradientBackdrop>` directly (dashboard chrome)
- 6-row branding-state matrix (color × shade) verified in mini-preview
</output>
