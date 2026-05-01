# Phase 18: Branding Editor Simplification — Research

**Researched:** 2026-05-01
**Domain:** Owner-facing `/app/branding` editor (Next.js 16 App Router + React Server Components + Supabase + shadcn) — UI shrink, type-shrink, server-action shrink, MiniPreviewCard rebuild against Phase 17 PublicShell visual language
**Confidence:** HIGH (all findings sourced from in-tree code, line-numbered)

---

## Summary

Phase 18 collapses `/app/branding` from a 5-control editor (logo + brand_primary + sidebar_color + background_color + background_shade) to a 2-control editor (logo + brand_primary). The cut spans four layers in a single phase:

1. **UI layer** — `BrandingEditor` removes 3 ColorPickerInput/ShadePicker blocks; control order becomes logo → brand_primary; layout becomes left controls / right column with `MiniPreviewCard` stacked above `PreviewIframe`.
2. **Editor state + server action** — `BrandingState` (in `app/(shell)/app/branding/_lib/load-branding.ts`) and `saveBrandingAction` (in `app/(shell)/app/branding/_lib/actions.ts`) drop `backgroundColor`, `backgroundShade`, `sidebarColor`. The `loadBrandingForOwner` SELECT shrinks. `savePrimaryColorAction` (singular) already exists and keeps working — `saveBrandingAction` becomes either deleted (color save handled by existing `savePrimaryColorAction`) or kept-but-emptied. **Decision required at planning time:** see "Open Questions" below.
3. **Branding type + reader** — `Branding` interface (`lib/branding/types.ts:13-31`) drops 4 fields; `brandingFromRow` and `getBrandingForAccount` (`lib/branding/read-branding.ts`) drop the same fields and shrink the accounts SELECT.
4. **MiniPreviewCard rebuild** — `mini-preview-card.tsx` switches from faux-dashboard (sidebar strip + page area) to faux-public-booking-page (gray-50 + brand_primary blob + white card + 3 slot buttons + Powered-by-NSI + faux pill). Mirrors Phase 17 `PublicShell` visual grammar.

**Primary recommendation:** Plan as **two waves**. Wave 1 = "type shrink + reader shrink" (forces tsc errors that map remaining work surface). Wave 2 = "editor UI rebuild + MiniPreviewCard rebuild + server-action shrink" (atomic UI commit that consumes the new types). This satisfies pitfall CP-04 (types-first) and MP-03 (UI atomic).

**Cross-phase blast radius (CRITICAL — see "Out-of-Scope Blast Radius" section):** Shrinking the `Branding` interface in `lib/branding/types.ts` will surface tsc errors in 6 email senders, 1 `branding-blocks.ts` interface, `chrome-tint.ts`, and 2 test files — all owned by Phase 19/20. Phase 18 must NOT change those files (Phase 19 owns email layer; Phase 20 owns dead-code deletion), so the type shrink must be done with a **transitional `Branding` shape that keeps optional shims** OR Phase 18 must accept temporary tsc breakage in email/test files and explicitly hand off the cleanup baton to Phase 19. **This is the single biggest planning decision and is NOT pre-locked in CONTEXT.md.**

---

## Phase Boundary (verbatim from CONTEXT.md, summarized)

**In scope (locked decisions):**
- Two controls only: `LogoUploader` + `brand_primary` `ColorPickerInput`.
- Three deprecated pickers (`sidebar_color`, `background_color`, `background_shade`) removed from UI AND server-side write paths.
- `MiniPreviewCard` rebuilt as faux PUBLIC booking page preview using Phase 17 `PublicShell` visual language.
- Inline contrast warning at `relativeLuminance(brand_primary) > 0.85` (informational only).
- "Reset to NSI blue (#3B82F6)" button.
- Layout: controls left, MiniPreviewCard above PreviewIframe in right column.
- Order: logo first, then color picker.
- `PreviewIframe` (`?previewColor=`) plumbing UNCHANGED — verify only.

**Out of scope:**
- Picker component file deletion (`shade-picker.tsx`) — Phase 20 (CLEAN-07).
- DB column drops — Phase 21.
- Email layer (`lib/email/*`, `branding-blocks.ts`) — Phase 19.

**Claude's discretion:**
- MiniPreviewCard micro-decisions (pill, slot labels, selected slot, header)
- Mobile layout
- Live-update wiring
- Color picker presets
- Hex input validation tightening
- Page intro copy
- Unsaved-changes guard

---

## Standard Stack (existing — no new dependencies)

This phase introduces **zero new libraries**. All work is in-tree refactor.

### Existing in use
| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| Next.js App Router | 16.x | RSC server actions, layouts | `package.json` |
| React | 19.x | Client components (`"use client"`) | `package.json` |
| Tailwind CSS | v4 | UI styling | `globals.css @theme` |
| shadcn/ui | (vendored) | `Button`, `Input`, `Label` | `components/ui/*` |
| Sonner | (toast) | Save-success / save-error feedback | `import { toast } from "sonner"` |
| Zod | 3.x | Hex validation (`primaryColorSchema`) | `app/(shell)/app/branding/_lib/schema.ts:4-5` |
| Vitest | (current) | Existing branding tests | `tests/branding-*.test.ts` |

### Internal modules referenced
| Module | Purpose |
|--------|---------|
| `lib/branding/contrast.ts` | `relativeLuminance(hex)` and `pickTextColor(bgHex)` |
| `lib/branding/read-branding.ts` | `brandingFromRow`, `getBrandingForAccount`, `DEFAULT_BRAND_PRIMARY = "#0A2540"` |
| `lib/branding/types.ts` | `Branding`, `BackgroundShade`, `ChromeTintIntensity` |
| `app/_components/public-shell.tsx` | Phase 17 visual reference (gray-50 + glow + pill + Powered-by-NSI) |
| `app/_components/background-glow.tsx` | Phase 17 blob component (`color` prop, `blur-[160px]`) |
| `app/_components/header.tsx` | Phase 17 `variant="public"` (logo / initial fallback pill) |
| `app/_components/powered-by-nsi.tsx` | Phase 17 footer atom |

**Installation:** None — phase is pure refactor.

---

## Architecture Patterns

### Current `/app/branding` Project Structure (verified, no changes needed)

```
app/(shell)/app/branding/
├── page.tsx                           # Server: loads BrandingState, redirects if unlinked
├── _components/
│   ├── branding-editor.tsx            # Client: orchestrator (Phase 18 rebuild target)
│   ├── logo-uploader.tsx              # Client: keep as-is (BRAND-14)
│   ├── color-picker-input.tsx        # Client: keep, possibly extend with reset button
│   ├── mini-preview-card.tsx          # Client: REBUILD (BRAND-17)
│   ├── preview-iframe.tsx             # Client: keep, verify only (BRAND-21)
│   └── shade-picker.tsx               # Client: REMOVE from page; file deleted Phase 20
└── _lib/
    ├── load-branding.ts               # Server-only: shrink BrandingState + SELECT
    ├── actions.ts                     # Server actions: shrink saveBrandingAction
    └── schema.ts                      # Zod: keep primaryColorSchema; mark dead schemas
```

### Pattern 1: Inline-style for runtime hex (JIT lock — MP-04)

**What:** Tailwind v4 JIT cannot generate arbitrary runtime hex classes. All runtime brand colors flow through inline `style` attributes.

**Where it's used (verified Phase 17 reference):**

```tsx
// Source: app/_components/background-glow.tsx:18-25
<div
  className="absolute w-80 h-80 rounded-full opacity-40 blur-[160px]"
  style={{
    top: '-32px',
    left: 'calc(50% + 100px)',
    transform: 'translateX(-50%)',
    background: `linear-gradient(to top right, ${color}, transparent)`,
  }}
/>
```

```tsx
// Source: app/_components/public-shell.tsx:49-54
const cssVars: CSSProperties = {
  ["--brand-primary" as never]: branding.primaryColor,
  ["--brand-text" as never]: foreground,
  ["--primary" as never]: branding.primaryColor,
  ["--primary-foreground" as never]: foreground,
};
```

```tsx
// Source: app/_components/header.tsx:64-67 (initial-circle fallback for pill)
<div
  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
  style={{ backgroundColor: primaryColor }}
  aria-hidden="true"
>
  {initial}
</div>
```

**MiniPreviewCard application:** the brand_primary blob, the selected slot button, and the initial-circle pill fallback all need inline `style={{ backgroundColor: brandPrimary }}` (or `style={{ background: \`linear-gradient(...)\` }}` for the blob), never Tailwind classes.

### Pattern 2: Phase 17 PublicShell visual grammar (mirror at miniature scale)

The faux preview must look like a tiny version of the real public booking page. Reference composition (verified `app/_components/public-shell.tsx:56-67`):

```
<div className="relative min-h-screen bg-gray-50">       ← gray-50 base
  <BackgroundGlow color={glowColor} />                   ← brand_primary blob
  <Header variant="public" branding={...} />             ← glass pill w/ logo
  <main>{children}</main>                                ← white card content
  <PoweredByNsi />                                       ← footer
</div>
```

**Public shell glow fallback** (`app/_components/public-shell.tsx:33-39`):

```tsx
function resolveGlowColor(primaryColor: string): string {
  try {
    return relativeLuminance(primaryColor) > 0.85 ? "#3B82F6" : primaryColor;
  } catch {
    return "#3B82F6";
  }
}
```

**This is the SAME 0.85 threshold the Phase 18 contrast warning must use** (CONTEXT lock — single source of truth).

### Pattern 3: Two-stage owner authorization in server actions (no change needed)

`saveBrandingAction` and `savePrimaryColorAction` both follow the existing pattern (`app/(shell)/app/branding/_lib/actions.ts:26-32`):

```ts
async function getOwnerAccountIdOrThrow(): Promise<string> {
  const supabase = await createClient();
  const { data: ids } = await supabase.rpc("current_owner_account_ids");
  const arr = Array.isArray(ids) ? ids : [];
  if (arr.length === 0) throw new Error("Not linked to any account.");
  return arr[0];
}
```

Phase 18 does not change auth — only the field set being written.

### Anti-Patterns to Avoid

- **Dynamic Tailwind classes for runtime hex.** Never `className={\`bg-[${primary}]\`}`. Always inline style. (Phase 7 lock, restated in `mini-preview-card.tsx:18-19`, `embed-shell.tsx:41`, `background-glow.tsx:5-6`.)
- **Cross-phase scope creep.** Don't delete `shade-picker.tsx` file (Phase 20). Don't drop DB columns (Phase 21). Don't touch `lib/email/*` or `branding-blocks.ts` (Phase 19).
- **Touching `chrome-tint.ts`.** It is dead code in production (only consumer is its own test) but its removal is Phase 20 territory. Phase 18 either leaves it broken at type level OR ships a transitional shape (see Open Questions Q1).
- **Re-designing PreviewIframe.** BRAND-21 is verify-only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hex validation | Custom regex inline | `primaryColorSchema` from `_lib/schema.ts:4-5` | Already Zod-validated; test coverage exists |
| Luminance threshold for contrast warning | New helper | `relativeLuminance` from `lib/branding/contrast.ts:23` | Same function PublicShell uses — single source of truth at 0.85 |
| Glow blob | New CSS | Match `BackgroundGlow` pattern at smaller scale | `blur-[60px]` (smaller than PublicShell's `blur-[160px]`) per CONTEXT.md lock — but use the same `linear-gradient(to top right, color, transparent)` recipe |
| Powered-by-NSI footer | New text | Tiny `text-[10px] text-gray-400` text mirroring `app/_components/powered-by-nsi.tsx` style at miniature scale | Don't import `<PoweredByNsi />` (full footer too large for mini card); just match the visual |
| Initial circle for missing logo | New component | Mirror `app/_components/header.tsx:63-71` pattern (filled circle in `brand_primary` w/ initial) | Ensures pill preview looks identical to the real public page header |
| Brand_primary save UX | New action | Existing `savePrimaryColorAction(hex: string)` at `actions.ts:95-116` | Already wired with `revalidatePath("/app/branding")` |

**Key insight:** Phase 18 is a refactor, not a feature. Reuse every existing helper, schema, and pattern. The only NEW visual primitive is the faux slot button row (3 buttons, one selected) — and even that is a styling variation on existing button patterns.

---

## Common Pitfalls

### Pitfall 1: CP-04 — Type shrink without coordinating reader

**What goes wrong:** If `Branding` interface in `lib/branding/types.ts` is shrunk before `brandingFromRow` is updated, the reader returns extra fields that no longer match the type. If reader is shrunk first, every consumer that reads the dropped fields breaks before the interface is fixed.

**How to avoid:** Update `lib/branding/types.ts` and `lib/branding/read-branding.ts` in the **same commit** (Wave 1). The type shrink will surface tsc errors in `chrome-tint.ts`, `branding-blocks.ts`, all 6 email senders, and 2 tests — those are hand-off territory (see Out-of-Scope Blast Radius).

**Warning sign:** `npm run tsc` after editing one but not the other shows mismatched property errors at the reader/consumer boundary.

### Pitfall 2: MP-03 — MiniPreviewCard + BrandingEditor must commit atomically

**What goes wrong:** `MiniPreviewCard` currently takes `{ sidebarColor, pageColor, primaryColor }`. Phase 18 changes it to take `{ brandPrimary, logoUrl, accountName }` (or similar). If only one is changed, the other has compile errors.

**How to avoid:** Edit both files in Wave 2 task atomic commit. The plan should pair them in a single task (or sequence them within a single task with no intermediate commit).

**Warning sign:** Half-applied prop interface; tsc fails on the import site.

### Pitfall 3: MP-04 — JIT lock for brand_primary preview blob

**What goes wrong:** Writing `<div className={\`bg-[${primary}] blur-[60px]\`}>` will not produce a colored blob — Tailwind v4 JIT cannot generate arbitrary hex classes at runtime.

**How to avoid:** Use inline style for the runtime hex; use Tailwind classes only for static utilities:

```tsx
<div
  className="absolute w-32 h-32 rounded-full opacity-40 blur-[60px]"
  style={{
    background: `linear-gradient(to top right, ${brandPrimary}, transparent)`,
  }}
/>
```

Same pattern as `BackgroundGlow` (`app/_components/background-glow.tsx:18-25`) and `EmbedShell`'s single-circle gradient (`app/embed/[account]/[event-slug]/_components/embed-shell.tsx:78-86`).

**Warning sign:** Live preview shows no blob — colored area never renders.

### Pitfall 4: MN-01 — Deploy + eyeball the faux preview

**What goes wrong:** Faux preview "looks fine" in dev but on Vercel the visual scale is wrong (blob too big / white card too small / slot buttons cramped). Phase 12.6's mini-preview was a faux dashboard — the new faux public booking page has different dimension expectations.

**How to avoid:** Final task in Phase 18 is a deploy gate where Andrew confirms on Vercel preview that:
- Blob is visible but doesn't dominate
- White card has the right padding/scale
- 3 slot buttons fit horizontally without wrap
- Selected slot reads as "selected" via `brand_primary` fill
- "Powered by NSI" text is legible but unobtrusive
- Pill at top renders logo (or initial circle if no logo) at miniature scale

**Warning sign:** Preview looks empty / oversaturated / cramped.

### Pitfall 5: Reset button race with native input change

**What goes wrong:** `ColorPickerInput` keeps `localText` state separate from parent `value` (verified `color-picker-input.tsx:64-74`). A "Reset to NSI blue" button that just calls `onChange("#3B82F6")` may not update the visible text input until the next parent re-render flush.

**How to avoid:** The existing sync pattern at `color-picker-input.tsx:70-74` handles this:

```tsx
const [lastParentValue, setLastParentValue] = useState(value);
if (value !== lastParentValue) {
  setLastParentValue(value);
  setLocalText(value);
}
```

So calling `onChange("#3B82F6")` from a parent button will propagate correctly on next render. The reset can live in the parent (`BrandingEditor`) calling `setPrimaryColor("#3B82F6")` directly, OR be added inside `ColorPickerInput` via a new prop.

### Pitfall 6: PreviewIframe `previewColor` validation re-check

The embed page sanitizes `previewColor` server-side (`app/embed/[account]/[event-slug]/page.tsx:50-56`):

```ts
const previewColor =
  typeof sp.previewColor === "string" &&
  /^#[0-9a-fA-F]{6}$/.test(sp.previewColor)
    ? sp.previewColor
    : undefined;
```

`PreviewIframe` (`app/(shell)/app/branding/_components/preview-iframe.tsx:49-55`) already builds the URL with `URLSearchParams`. **No change needed for BRAND-21.** Verification task: confirm changing the brand_primary picker still re-keys the iframe (the `key={iframeSrc}` at `preview-iframe.tsx:59` forces remount).

---

## Code Examples (verified existing patterns)

### Example 1: Phase 17 PublicShell composition (the model)

```tsx
// Source: app/_components/public-shell.tsx:41-68
export function PublicShell({ branding, accountName, children }: PublicShellProps) {
  const glowColor = resolveGlowColor(branding.primaryColor);
  const foreground = branding.textColor;

  const cssVars: CSSProperties = {
    ["--brand-primary" as never]: branding.primaryColor,
    ["--brand-text" as never]: foreground,
    ["--primary" as never]: branding.primaryColor,
    ["--primary-foreground" as never]: foreground,
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      <BackgroundGlow color={glowColor} />
      <Header variant="public" branding={branding} accountName={accountName} />
      <div style={cssVars}>
        <main className="pt-20 md:pt-24 pb-12">{children}</main>
      </div>
      <PoweredByNsi />
    </div>
  );
}
```

### Example 2: Public Header pill (logo OR initial fallback)

```tsx
// Source: app/_components/header.tsx:42-80
if (variant === 'public') {
  const logoUrl = branding?.logoUrl ?? null;
  const primaryColor = branding?.primaryColor ?? '#3B82F6';
  const name = accountName ?? '';
  const initial = name.charAt(0).toUpperCase() || 'N';

  return (
    <header className="...glass pill...">
      {logoUrl ? (
        <img src={logoUrl} alt={`${name} logo`} style={{ maxHeight: 40, maxWidth: 140 }} />
      ) : (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {initial}
        </div>
      )}
      {/* ...account name on right... */}
    </header>
  );
}
```

### Example 3: Embed single-circle blob (the small-canvas reference)

```tsx
// Source: app/embed/[account]/[event-slug]/_components/embed-shell.tsx:78-86
<div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 -z-10">
  <div
    className="h-80 w-80 rounded-full opacity-40"
    style={{
      backgroundImage: `linear-gradient(to top right, ${effectiveColor}, transparent)`,
      filter: "blur(160px)",
    }}
  />
</div>
```

For the MiniPreviewCard, scale this down: `h-24 w-24` or `h-32 w-32`, `blur-[60px]` per CONTEXT.md lock, `opacity-40`.

### Example 4: Save-and-toast pattern (existing — keep)

```tsx
// Source: app/(shell)/app/branding/_components/branding-editor.tsx:53-69
function handleSaveBackground() {
  startBackgroundSave(async () => {
    const result = await saveBrandingAction({...});
    if (result.error) toast.error(result.error);
    else if (result.fieldErrors) {
      const firstError = Object.values(result.fieldErrors).flat()[0];
      if (firstError) toast.error(firstError);
    } else toast.success("Background saved.");
  });
}
```

### Example 5: Color picker inline-save (existing — already used by brand_primary)

```ts
// Source: app/(shell)/app/branding/_lib/actions.ts:95-116
export async function savePrimaryColorAction(hex: string): Promise<ActionResult> {
  const parsed = primaryColorSchema.safeParse(hex);
  if (!parsed.success) return { fieldErrors: { primaryColor: parsed.error.issues.map(i => i.message) } };
  try {
    const accountId = await getOwnerAccountIdOrThrow();
    const admin = createAdminClient();
    const { error } = await admin.from("accounts").update({ brand_primary: parsed.data }).eq("id", accountId);
    if (error) return { error: `DB update failed: ${error.message}` };
    revalidatePath("/app/branding");
    return { ok: true };
  } catch (e) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}
```

`ColorPickerInput` already wires this directly when `showSaveButton={true}` (default) at `color-picker-input.tsx:106-124`. **Phase 18 can simplify by using the existing default-`showSaveButton` mode** — no new server action needed for color save.

---

## Out-of-Scope Blast Radius (CRITICAL planning input)

When `Branding` interface in `lib/branding/types.ts` drops `backgroundColor`, `backgroundShade`, `chromeTintIntensity`, `sidebarColor`, the following files reference those fields and will need attention:

### Production code (lib/)

| File | Lines | Reads which dropped field | Phase 18 action |
|------|-------|---------------------------|-----------------|
| `lib/branding/read-branding.ts` | 4, 28-29, 32-43, 48-51 | All four (writes them) | **Update — Phase 18 owns** |
| `lib/branding/types.ts` | 8, 11, 22-30 | Defines them | **Update — Phase 18 owns** |
| `lib/branding/chrome-tint.ts` | 1, 89-140 | `branding.backgroundColor`, `branding.sidebarColor` | **Phase 20 territory** (`resolveChromeColors` is dead — no production callers; only consumer is its own test). Phase 18 must decide: leave broken & hand off to Phase 20, OR delete (scope creep). |
| `lib/email/branding-blocks.ts` | 11-21, 50-56 | `EmailBranding.backgroundColor`, `branding.sidebarColor`, `branding.chromeTintIntensity` | **Phase 19 territory.** Note: `EmailBranding` is a SEPARATE interface from `Branding` — `EmailBranding` is constructed manually by each sender, NOT derived from `Branding`. So `Branding` shrink does NOT directly break `EmailBranding`. But the senders (next row) DO reference Branding fields. |
| `lib/email/send-booking-confirmation.ts` | 91-92 | Constructs EmailBranding with `backgroundColor`, `sidebarColor` from `account` row directly | **Phase 19 territory.** Reads from `account` row, not from `Branding` — so type shrink does NOT directly break it. |
| `lib/email/send-cancel-emails.ts` | 104-105, 209-210 | Same as above | **Phase 19 territory.** Same — direct from row. |
| `lib/email/send-reschedule-emails.ts` | 108-109, 208-209 | Same as above | **Phase 19 territory.** Same — direct from row. |
| `lib/email/send-owner-notification.ts` | 82-83 | Same as above | **Phase 19 territory.** Same — direct from row. |
| `lib/email/send-reminder-booker.ts` | 116-117 | Same as above | **Phase 19 territory.** Same — direct from row. |

**Critical insight:** The 6 email senders construct `EmailBranding` from `account` rows DIRECTLY (e.g., `account.background_color`, `account.sidebar_color`) — they never read the `Branding` interface. So **shrinking `Branding` does NOT cascade tsc errors into senders** as long as the underlying DB columns and `accounts` SELECTs in those senders stay intact (which they do — Phase 19 owns that, Phase 21 owns DB). This dramatically reduces the blast radius.

### Tests (tests/)

| File | Lines | References | Phase 18 action |
|------|-------|------------|-----------------|
| `tests/branding-chrome-tint.test.ts` | 10-21, 115-181 | `Branding` fixture with all 4 fields; tests `resolveChromeColors` | **BREAKS at type level when fields removed.** Phase 20 owns deletion (test follows `chrome-tint.ts`). Options: (a) leave broken & flag for Phase 20, (b) update fixture to omit dropped fields temporarily, (c) delete test as scope creep. |
| `tests/branding-schema.test.ts` | 1-113 | Imports `backgroundColorSchema`, `backgroundShadeSchema`, `brandingBackgroundSchema` from `_lib/schema.ts` | If Phase 18 deletes those Zod schemas, tests break. **Recommend: keep the Zod schemas in `_lib/schema.ts` for now** (mark deprecated) — Phase 20 deletes file, tests follow. |
| `tests/email-branded-header.test.ts` | 16-23, 27-129 | `EmailBranding` fixture w/ `backgroundColor`, `sidebarColor`, `chromeTintIntensity` | **Phase 19 territory** — `EmailBranding` is in `branding-blocks.ts`, not `Branding`. Phase 18 type shrink does not break this test. |
| `tests/email-6-row-matrix.test.ts` | 47-58 | Uses `account` object with `background_color`, `sidebar_color` (column names, not Branding fields) | **Phase 19/21 territory.** Not broken by Phase 18. |
| `tests/branding-gradient.test.ts` | 1-2 | Imports deleted `lib/branding/gradient.ts` | **ALREADY BROKEN** (Phase 17-08 deleted gradient.ts; STATE.md:123 logs this; Phase 20 deletes). Phase 18 leaves alone. |
| `tests/branding-contrast.test.ts` | (full file) | Tests `relativeLuminance`, `pickTextColor` — not Branding interface | **Unaffected by Phase 18.** |

### Editor-local files (Phase 18 owns)

| File | Lines | Phase 18 action |
|------|-------|-----------------|
| `app/(shell)/app/branding/_lib/load-branding.ts` | 5-16, 27-72 | Shrink `BrandingState` interface; shrink SELECT to `id, slug, logo_url, brand_primary` |
| `app/(shell)/app/branding/_lib/actions.ts` | 5-12, 144-202 | Either delete `saveBrandingAction` (and remove `BackgroundShade` import + 3 schema imports) OR shrink to no-op. Keep `savePrimaryColorAction`, `uploadLogoAction`, `deleteLogoAction`. |
| `app/(shell)/app/branding/_lib/schema.ts` | 33-60 | **RECOMMEND keep `backgroundColorSchema`, `backgroundShadeSchema`, `brandingBackgroundSchema`, `sidebarColorSchema`, `chromeTintIntensitySchema` for now** so `tests/branding-schema.test.ts` keeps passing. Mark with `@deprecated` JSDoc. Phase 20 deletes file. |
| `app/(shell)/app/branding/_components/branding-editor.tsx` | 1-163 | Major rewrite — see "Architecture Patterns" |
| `app/(shell)/app/branding/_components/mini-preview-card.tsx` | 1-66 | Full rewrite — see Code Examples |
| `app/(shell)/app/branding/_components/shade-picker.tsx` | 1-49 | **Leave file alone** (Phase 20 deletes); just remove its import + usage from `branding-editor.tsx` |
| `app/(shell)/app/branding/_components/preview-iframe.tsx` | 1-69 | **Verify only** (BRAND-21). No changes. |
| `app/(shell)/app/branding/_components/color-picker-input.tsx` | 1-205 | Possibly add reset-button prop OR handle reset in parent. Existing presets at line 12-21 — discretion call to keep/replace/remove. |
| `app/(shell)/app/branding/_components/logo-uploader.tsx` | 1-110 | **No changes** (BRAND-14). |
| `app/(shell)/app/branding/page.tsx` | 1-21 | Possibly update intro copy (Claude's discretion) |

---

## State of the Art (within this codebase)

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 12.5 chrome tint via `chrome_tint_intensity` ENUM + `color-mix()` | Phase 12.6 direct hex per surface (`sidebar_color`, `background_color`) | 2026-04-29 | All 4 chrome fields (`sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity`) became deprecated, only kept for backward-compat reads |
| Phase 12.6 5-control branding editor | Phase 18 2-control (logo + brand_primary) | 2026-05-01 (this phase) | UI cut + type shrink |
| Phase 12.6 faux-dashboard MiniPreviewCard | Phase 18 faux-public-booking-page MiniPreviewCard | 2026-05-01 (this phase) | Visual rebuild |
| Phase 17-08 GradientBackdrop dependency | Phase 17-08 flat color tint bridge | 2026-04-30 | `lib/branding/gradient.ts` deleted; `MiniPreviewCard` lost its `shade` prop |
| Phase 7 BrandedPage | Phase 17 PublicShell | 2026-04-30 | New visual grammar Phase 18 mirrors |

**Already deprecated / scheduled for deletion:**
- `lib/branding/chrome-tint.ts` (`resolveChromeColors`, `chromeTintToCss`, `chromeTintTextColor`) — only consumer is its own test; Phase 20 deletion
- `app/(shell)/app/branding/_components/shade-picker.tsx` — Phase 20 deletion (CLEAN-07)
- `tests/branding-gradient.test.ts` — already broken; Phase 20 deletion
- `tests/branding-chrome-tint.test.ts` — Phase 20 follows chrome-tint.ts deletion
- DB columns `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` — Phase 21 DROP migration

---

## Open Questions

### Q1 (CRITICAL): How aggressive should the type shrink be in Phase 18?

**The dilemma:** `Branding` interface in `lib/branding/types.ts` has 4 fields slated for removal: `backgroundColor`, `backgroundShade`, `chromeTintIntensity`, `sidebarColor`. Removing them in Phase 18 will break:
- `lib/branding/chrome-tint.ts` (Phase 20 territory) — the file is dead in production but its test runs
- `tests/branding-chrome-tint.test.ts` (Phase 20 territory)

**Three options:**

**Option A — Aggressive shrink (recommended).** Drop all 4 fields from `Branding` in Phase 18. Accept that `chrome-tint.ts` and its test break at type level. Document the breakage in 18-SUMMARY and explicitly hand off to Phase 20 (which is just one phase away). **Trade-off:** `npm run tsc` and `npm run test` will fail until Phase 20 ships. CLAUDE.md mandates "All testing is done live" — so deploy might still succeed since Vercel uses `npm run build` which excludes test files, but tsc gate in CI would fail.

**Option B — Conservative shim.** Keep dropped fields in `Branding` interface as `@deprecated` optional fields (`backgroundColor?: string | null`, etc.) so `chrome-tint.ts` and its test keep compiling. Phase 20 deletes them when chrome-tint.ts is deleted. **Trade-off:** `Branding` keeps zombie fields for 2 phases; reader (`brandingFromRow`) must still produce them OR keep them as optional reads. Slightly more code but zero hand-off pain.

**Option C — Delete chrome-tint.ts in Phase 18 (scope creep).** Drop `Branding` fields cleanly AND delete `chrome-tint.ts` + its test. Justification: zero production callers, test is the only consumer. **Trade-off:** Crosses Phase 20 boundary; CONTEXT.md and ROADMAP.md scope this for Phase 20 (CLEAN-07/08/09). Probably wrong despite being technically clean.

**Recommendation:** **Option B** (conservative shim). Reasoning:
1. Andrew's CLAUDE.md says "Never mark a project done... if the manual QA phase is still pending" — implies tsc-clean is part of "done."
2. Phase 18 success criterion 4 (ROADMAP:188) explicitly says: "tsc --noEmit passes with zero errors — Branding interface, BrandingState, saveBrandingAction signature, and brandingFromRow are all consistent on the simplified field set."
3. With Option A, criterion 4 is violated. With Option B, criterion 4 passes (the optional shim fields are still consistent).
4. Phase 20 is not far away; 2-phase shim is acceptable.

**Planner should confirm with Andrew before locking.** The success criterion language is ambiguous about whether "consistent on simplified field set" tolerates optional shim fields.

### Q2: `saveBrandingAction` — delete or empty?

`saveBrandingAction` (lines 144-202) currently writes `background_color`, `background_shade`, `sidebar_color` to the accounts row. After Phase 18:
- These are write-only (UI no longer surfaces them)
- DB columns still exist (Phase 21 drops them)

**Options:**
- **Delete `saveBrandingAction` entirely.** UI uses `savePrimaryColorAction` (already exists) for color saves. Cleaner.
- **Keep `saveBrandingAction` as a no-op stub.** Returns `{ ok: true }` without writing. Less clean but avoids any callers (none exist outside `branding-editor.tsx`).

**Recommendation:** **Delete entirely.** No callers outside the editor; the editor will be rewritten anyway. Removing `BackgroundShade` import + 3 schema imports from `actions.ts` is part of the same delete.

### Q3: Live-update wiring — MiniPreviewCard reactive vs PreviewIframe `?previewColor=` reactive

**Current behavior (verified):**
- `PreviewIframe` re-keys on `previewColor` prop change → forces iframe remount (`preview-iframe.tsx:59`). Already reactive.
- `MiniPreviewCard` props are reactive to parent state — already updates on every keystroke.

**No change needed.** Both update live as user types. The only question is whether the editor's `primaryColor` state should debounce to avoid hammering the iframe (currently no debounce — every keystroke remounts the iframe).

**Recommendation:** **Leave as-is** (no debounce). User experience is acceptable; iframe remount is fast; debouncing is premature optimization.

### Q4: Color picker presets — keep or simplify?

`ColorPickerInput` currently has an 8-color CRUIP_SWATCHES palette (`color-picker-input.tsx:12-21`) gated behind `showSwatches={true}` prop. In the current `BrandingEditor`, brand_primary calls `ColorPickerInput` WITHOUT `showSwatches` (line 92), so the palette is hidden today.

**Options:**
- Keep current default (no presets for brand_primary) — minimal change.
- Enable `showSwatches={true}` for brand_primary in Phase 18 — gives users curated picks.
- Replace palette with a smaller, brand-relevant set (5-8 trade-contractor colors).

**Recommendation:** **Keep current default (no presets).** CONTEXT.md says: "Preset color swatches and hex input field validation behavior are at Claude's discretion (default: leave existing `ColorPickerInput` behavior unchanged unless presets clearly improve UX)." The "Reset to NSI blue" button is a one-click escape hatch that obviates the need for presets in the first iteration.

### Q5: Page intro copy

CONTEXT.md options: "minimal h1 only vs h1 + description vs h1 + NSI-brand-lock explainer."

Current copy (`app/(shell)/app/branding/page.tsx:11-17`):
> "Upload your logo and pick your primary color. Changes apply to the public booking page, the embeddable widget, and email templates."

**Recommendation:** **Keep as-is.** It already covers the two-control simplification narrative ("logo and primary color") and the apply-where lock ("public booking page, embeddable widget, email templates"). Andrew benefits from a stable surface. No change.

### Q6: Unsaved-changes guard

CONTEXT.md says: "Unsaved-changes navigation guard is at Claude's discretion (default: match existing behavior — do not add a new beforeunload listener)."

Current behavior: no guard. Logo and brand_primary save inline on action (logo on upload, color on Save button click). There's no "form" with a draft state to lose.

**Recommendation:** **No guard.** Save is per-control, immediate, and toast-confirmed. Adding a beforeunload listener would be a regression in UX (browser native dialog is jarring).

---

## Wave Structure Recommendation

Given Pitfalls CP-04 (types-first), MP-03 (UI atomic), and the Out-of-Scope Blast Radius (Q1), recommend **two waves with explicit gates**:

### Wave 1: Types + Reader + Editor State (foundational shrink)

**Files modified:**
- `lib/branding/types.ts` — apply Option B from Q1 (mark 4 fields `@deprecated` optional) OR Option A (full delete; depends on planning lock)
- `lib/branding/read-branding.ts` — shrink SELECT, shrink return mapping, drop `BackgroundShade`/`ChromeTintIntensity` imports if Option A; keep them if Option B
- `app/(shell)/app/branding/_lib/load-branding.ts` — shrink `BrandingState`, shrink SELECT, drop `BackgroundShade` import

**Gate:** `npm run tsc --noEmit` passes (or has only the pre-known broken files: `chrome-tint.ts`, `branding-chrome-tint.test.ts`, `branding-gradient.test.ts` if Option A). `npm run build` passes.

**Why first:** Forces the type signal that drives Wave 2 work. CP-04 lock.

### Wave 2: Editor UI + MiniPreviewCard + Server Action (atomic UI commit)

**Files modified atomically:**
- `app/(shell)/app/branding/_components/mini-preview-card.tsx` — full rewrite (props + render)
- `app/(shell)/app/branding/_components/branding-editor.tsx` — remove 3 picker blocks, drop `saveBrandingAction` call, drop `ShadePicker` + `BackgroundShade` imports, add reset-to-NSI-blue button, add contrast warning, restructure layout (left controls / right MiniPreviewCard + PreviewIframe stacked)
- `app/(shell)/app/branding/_lib/actions.ts` — delete `saveBrandingAction`, drop 3 schema imports + `BackgroundShade` import (per Q2)
- (optional, Claude's discretion) `app/(shell)/app/branding/_components/color-picker-input.tsx` — small props addition for reset OR leave alone (parent handles reset)
- (verification only) `app/(shell)/app/branding/_components/preview-iframe.tsx` — read-through to confirm BRAND-21

**Gate:** Live deploy + Andrew eyeball (MN-01). Confirms:
1. UI shows exactly 2 controls (BRAND-13, BRAND-14)
2. MiniPreviewCard renders the faux public booking page (BRAND-17)
3. Changing brand_primary updates both MiniPreviewCard (instant) and PreviewIframe (re-key) (BRAND-21)
4. tsc + build clean
5. Test suite unchanged from Wave 1 outcome

**Why atomic:** MP-03 lock — `MiniPreviewCard` props change AND `branding-editor.tsx` import-site change in the same commit window.

### Why two waves, not one or three

- **Not one:** The types-first lock (CP-04) wants Wave 1 to land before UI work, so tsc errors in Wave 1 surface every consumer that needs Wave 2 attention.
- **Not three:** No clean three-way split — splitting Wave 2 into "UI" + "MiniPreviewCard" risks half-applied prop interface (MP-03 violation).

---

## Sources

### Primary (HIGH confidence — in-tree code)

| Source | Lines | Topic |
|--------|-------|-------|
| `app/(shell)/app/branding/page.tsx` | 1-21 | Page entry, BrandingEditor mount |
| `app/(shell)/app/branding/_components/branding-editor.tsx` | 1-163 | Current 5-control editor |
| `app/(shell)/app/branding/_components/mini-preview-card.tsx` | 1-66 | Current faux-dashboard preview |
| `app/(shell)/app/branding/_components/preview-iframe.tsx` | 1-69 | Iframe key+remount on previewColor change |
| `app/(shell)/app/branding/_components/color-picker-input.tsx` | 1-205 | Hex validation, swatches gate, save button |
| `app/(shell)/app/branding/_components/logo-uploader.tsx` | 1-110 | PNG-only upload, magic-byte check (no Phase 18 change) |
| `app/(shell)/app/branding/_components/shade-picker.tsx` | 1-49 | 3-button toggle (to be removed from editor) |
| `app/(shell)/app/branding/_lib/load-branding.ts` | 1-73 | `BrandingState` interface + SELECT |
| `app/(shell)/app/branding/_lib/actions.ts` | 1-202 | `uploadLogoAction`, `savePrimaryColorAction`, `saveBrandingAction`, `deleteLogoAction` |
| `app/(shell)/app/branding/_lib/schema.ts` | 1-60 | Zod schemas for all branding fields |
| `lib/branding/types.ts` | 1-31 | `Branding` interface (target of shrink) |
| `lib/branding/read-branding.ts` | 1-90 | `brandingFromRow`, `getBrandingForAccount` (target of shrink) |
| `lib/branding/contrast.ts` | 1-55 | `relativeLuminance`, `pickTextColor` |
| `lib/branding/chrome-tint.ts` | 1-140 | `resolveChromeColors` (dead code; Phase 20 territory) |
| `app/_components/public-shell.tsx` | 1-68 | Phase 17 visual reference |
| `app/_components/background-glow.tsx` | 1-38 | Phase 17 blob component |
| `app/_components/header.tsx` | 1-106 | Phase 17 public pill (logo or initial fallback) |
| `app/_components/powered-by-nsi.tsx` | 1-22 | Phase 17 footer atom |
| `app/embed/[account]/[event-slug]/page.tsx` | 1-72 | `?previewColor=` server-side validation |
| `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` | 1-117 | Single-circle blob reference at small canvas |
| `lib/email/branding-blocks.ts` | 1-172 | `EmailBranding` (separate from `Branding` — Phase 19 territory) |
| `.planning/REQUIREMENTS.md` | 130-138 | BRAND-13 through BRAND-21 verbatim |
| `.planning/ROADMAP.md` | 174-194 | Phase 18 success criteria |
| `.planning/STATE.md` | 123 | Pre-known broken `branding-gradient.test.ts` |
| `.planning/phases/18-branding-editor-simplification/18-CONTEXT.md` | full | Locked decisions + Claude's discretion areas |
| `.planning/phases/17-public-surfaces-and-embed/17-08-deletions-and-mini-preview-SUMMARY.md` | 30-138 | What Phase 17-08 left for Phase 18 |

### Secondary (HIGH confidence — verified test files)

- `tests/branding-schema.test.ts` (1-113) — depends on schemas Phase 18 should keep alive
- `tests/branding-chrome-tint.test.ts` (1-181) — will break with type shrink (Phase 20 deletes)
- `tests/email-branded-header.test.ts` (1-30) — Phase 19 territory (uses EmailBranding, not Branding)
- `tests/email-6-row-matrix.test.ts` (40-58) — Phase 19/21 territory (uses raw account row)
- `tests/branding-gradient.test.ts` (1-2) — already broken; Phase 20 deletes
- `tests/branding-contrast.test.ts` — unaffected

### Tertiary (LOW confidence — none required)

Phase 18 is internal refactor; no WebSearch / external docs needed.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in `package.json`, no version uncertainty
- Architecture: HIGH — patterns verified in-tree at line-numbered files (Phase 17 PublicShell, BackgroundGlow, EmbedShell)
- Pitfalls: HIGH — CP-04 / MP-03 / MP-04 / MN-01 sourced from CONTEXT.md + ROADMAP.md; Pitfall 5 (reset race) verified via `color-picker-input.tsx:64-74` sync pattern
- Blast radius: HIGH — full grep of `sidebarColor|backgroundColor|backgroundShade|chromeTintIntensity` and `sidebar_color|background_color|background_shade|chrome_tint_intensity` performed; line-numbered map of every consumer

**Open questions are HIGH confidence as questions** (well-scoped) but the recommended answers are MEDIUM confidence — Andrew or planner should ratify Q1 (Option A vs B vs C) and Q2 (delete vs no-op `saveBrandingAction`) before Wave 1 lands.

**Research date:** 2026-05-01
**Valid until:** 2026-05-15 (stable — no upstream library churn expected; refactor is in-tree)
