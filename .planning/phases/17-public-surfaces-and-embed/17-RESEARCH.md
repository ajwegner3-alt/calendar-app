# Phase 17: Public Surfaces + Embed - Research

**Researched:** 2026-04-30
**Domain:** Next.js 14 App Router, React Server Components, CSS custom properties, Tailwind v4
**Confidence:** HIGH — all findings sourced directly from current codebase files

---

## Summary

Phase 17 re-skins the 5 public booking surfaces and the embed widget to adopt the NSI visual language with per-account `brand_primary` driving the `BackgroundGlow` tint and a new glass `PublicHeader` pill. `PublicShell` replaces `BrandedPage` across all public pages. The `GradientBackdrop`, `BrandedPage`, and `NSIGradientBackdrop` components are deleted after consumers migrate.

The existing `Header` component (in `app/_components/header.tsx`) currently accepts `variant?: 'owner' | 'auth'` — there is no `'public'` variant. This phase must add a `'public'` variant (or a separate `PublicHeader` component). REQUIREMENTS.md specifies `<Header variant="public" branding={branding} />`, meaning the single-file extension approach. However the current `Header` is a `'use client'` component that uses `usePathname()` — adding a branding prop requires it to also accept branding data without becoming a Server Component. This is manageable: the `variant="public"` branch doesn't use `usePathname()` at all.

The primary risk is the CSS variable naming discontinuity: existing public-side components (`BookingForm`, `ConfirmedBookingPage`) consume `var(--brand-primary, ...)` while the embed's slot picker uses Tailwind's `bg-primary` (which reads `var(--color-primary)` → `var(--primary)`). `PublicShell` must set `--brand-primary` for the hosted pages, and `EmbedShell` must set `--primary` for the embed. These are two separate CSS var patterns in active use — the planner must handle both correctly.

**Primary recommendation:** Extend `Header` with `variant="public"` + `branding` prop, add `PublicShell` + `PoweredByNsi` as new Server Components, migrate each public page in dependency order (PublicShell must exist first), restyle `EmbedShell` independently, then delete `BrandedPage` + `GradientBackdrop` + `NSIGradientBackdrop` only after all consumers have migrated.

---

## Q1: Existing Header Component

**File:** `app/_components/header.tsx` (line 1-58)

**Current interface:**
```typescript
interface HeaderProps {
  variant?: 'owner' | 'auth';
  rightLabel?: string;
}
```

**Current behavior:**
- `variant="owner"` (default): Fixed header with `left-0 md:left-[var(--sidebar-width)]` offset, renders `SidebarTrigger` (hamburger) on mobile, `WORDMARK` link on left, path-derived label on right.
- `variant="auth"`: Fixed header with `left-0 right-0` (full width, no sidebar offset), no `SidebarTrigger`, same `WORDMARK` link.
- Is a `'use client'` component (uses `usePathname()`).
- No branding prop exists yet. No logo rendering. No account name slot.

**REQUIREMENTS.md says:** `<Header variant="public" branding={branding} />`

**Verdict:** The `'public'` variant does NOT exist. Phase 17 must add it. Adding `branding` prop to the existing interface is straightforward. The `'public'` variant can be a pure conditional branch inside the existing file that renders logo+name pill without calling `usePathname()` (the variant has no path-derived label).

**Addition required to HeaderProps:**
```typescript
import type { Branding } from "@/lib/branding/types";

interface HeaderProps {
  variant?: 'owner' | 'auth' | 'public';
  rightLabel?: string;
  branding?: Branding;  // required when variant="public"
}
```

The public variant outer class should be `'fixed top-2 md:top-6 left-0 right-0 z-30 px-4'` (same as auth, no sidebar offset).

---

## Q2: BackgroundGlow Component

**File:** `app/_components/background-glow.tsx` (lines 1-36)

**Interface:**
```typescript
interface BackgroundGlowProps {
  color?: string;  // defaults to "#3B82F6"
}
```

**Blob positions:**
- Blob 1 (top): `top: '-32px'`, `left: 'calc(50% + 100px)'` — matches CONTEXT.md spec.
- Blob 2 (lower): `top: '420px'`, `left: 'calc(50% + 0px)'` — matches CONTEXT.md spec.

**MP-10 status — CRITICAL BUG FOUND:**
The second blob's gradient terminus is `#111827` (hardcoded dark gray), NOT `transparent`:
```typescript
// Line 32 — CURRENT (WRONG for public surfaces):
background: `linear-gradient(to top right, ${color}, #111827)`,
```
MP-10 requires the terminus be `transparent` on public surfaces. The Phase 15 owner shell apparently accepted this for the dark navy glow (it blends into the dark sidebar area), but on `bg-gray-50` public pages `#111827` will produce a visible dark blob terminus.

**Action required:** When `PublicShell` uses `BackgroundGlow`, it either (a) passes a `terminusColor` prop to `BackgroundGlow` and uses `transparent` for public, or (b) a separate fix is applied to `BackgroundGlow` to always use `transparent`. Option (b) is cleaner: fix `BackgroundGlow` to use `transparent` for blob 2 as part of this phase (consistent with MP-10, and the blob 1 already uses `transparent` correctly).

---

## Q3: BrandedPage / GradientBackdrop / NSIGradientBackdrop — All Consumers

### BrandedPage consumers (files that import `BrandedPage`):

| File | Occurrences | Migration target |
|------|-------------|------------------|
| `app/[account]/page.tsx` line 3, 42, 77 | 1 usage | PUB-05 → `<PublicShell>` |
| `app/[account]/[event-slug]/page.tsx` line 7, 45, 56 | 1 usage | PUB-06 → `<PublicShell>` |
| `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` lines 6, 110, 125, 130, 169 | 2 usages (both branches) | PUB-07 → `<PublicShell>` |
| `app/cancel/[token]/page.tsx` lines 8, 35, 58, 73, 105 | 2 usages (both branches) | PUB-08 → `<PublicShell>` |
| `app/reschedule/[token]/page.tsx` lines 6, 41, 73 | 1 usage | PUB-09 → `<PublicShell>` |

Total: 5 files. After migration, `BrandedPage` has zero consumers and can be deleted.

### GradientBackdrop consumers (files that import `GradientBackdrop`):

| File | Purpose | Status after Phase 17 |
|------|---------|----------------------|
| `app/_components/branded-page.tsx` | Inner backdrop | Deleted with `BrandedPage` |
| `app/_components/gradient-backdrop.tsx` | Self (definition) | Deleted (MP-09) |
| `app/[account]/_components/listing-hero.tsx` | Inner hero card backdrop | **Survives** — `ListingHero` has its own inner `GradientBackdrop` on the hero card, separate from the page wrapper |
| `app/(shell)/app/branding/_components/mini-preview-card.tsx` | Branding editor preview | **Survives** — owner shell tool |
| `app/(auth)/_components/auth-hero.tsx` | Comment reference only ("Phase 16-02: backdrop swapped from NSIGradientBackdrop") | No import, just comment |

**IMPORTANT:** `ListingHero` (`app/[account]/_components/listing-hero.tsx`) directly imports and uses `GradientBackdrop` for its inner card background. PUB-05 says "ListingHero inner GradientBackdrop removed." The planner must also update `ListingHero` to remove its `GradientBackdrop` usage (otherwise `GradientBackdrop` cannot be deleted).

`mini-preview-card.tsx` (branding editor, owner shell) also uses `GradientBackdrop` and is NOT being deleted. This means **`GradientBackdrop` cannot be fully deleted without also updating `mini-preview-card.tsx`**. The requirements say to delete `GradientBackdrop` (PUB-12), so `mini-preview-card.tsx` must be migrated away from it as well, OR the requirements are aspirational and the file stays. This is an **open question** — see below.

### NSIGradientBackdrop:

| File | Status |
|------|--------|
| `components/nsi-gradient-backdrop.tsx` | Thin wrapper around `GradientBackdrop` — no active consumers |
| `app/(auth)/_components/auth-hero.tsx` | References in a comment only; the actual import was removed in Phase 16-02 |

`NSIGradientBackdrop` has zero active import consumers. It can be deleted immediately (no migration needed for consumers).

---

## Q4: `pickTextColor` Helper

**File:** `lib/branding/contrast.ts` (lines 1-55)

**Signature:**
```typescript
export function pickTextColor(bgHex: string): "#ffffff" | "#000000"
```

**Behavior:** Full WCAG 2.1 luminance computation. Handles malformed input gracefully (returns valid result). Accepts any `#RRGGBB` string. Exported and ready to use. No issues.

`relativeLuminance` is also exported from the same file and can be used for the "near-white fallback" detection for `BackgroundGlow`.

---

## Q5: `Branding` Type

**File:** `lib/branding/types.ts`

```typescript
export interface Branding {
  logoUrl: string | null;
  primaryColor: string;           // always valid #RRGGBB (fallback applied)
  textColor: "#ffffff" | "#000000";
  backgroundColor: string | null;
  backgroundShade: BackgroundShade;
  chromeTintIntensity: ChromeTintIntensity;
  sidebarColor: string | null;
}
```

**Key fields for Phase 17:**
- `logoUrl`: `string | null` — used for logo in PublicHeader pill.
- `primaryColor`: always a resolved `string` (never null — fallback to `#0A2540` applied in `brandingFromRow`). This is what `BackgroundGlow` and `--brand-primary` / `--primary` CSS var should receive.
- `textColor`: pre-computed, ready to use.

**However**, Phase 17's `PublicShell` receives `branding: Branding` per PUB-01. But examining the 5 public pages, they currently pass raw DB row fields (e.g., `data.account.brand_primary`, `data.account.logo_url`) directly to `BrandedPage` — they do NOT use the `Branding` type or `brandingFromRow()`. The migration to `PublicShell` can either:
- (a) Keep passing raw fields and adjust `PublicShell` props, or
- (b) Call `brandingFromRow()` in each page and pass the resolved `Branding` object.

REQUIREMENTS.md says `PublicShell` accepts `branding: Branding` (PUB-01), which means option (b): each page must call `brandingFromRow(data.account)` before rendering `<PublicShell branding={branding}>`. This is a small addition to each page's loader or render logic.

**Note on cancel/reschedule account objects:** The `ResolvedCancelToken.account` and `ResolvedRescheduleToken.account` interfaces do NOT include `background_color` or `background_shade` — only `logo_url` and `brand_primary`. To use `brandingFromRow()` they would need those fields added (or `brandingFromRow` called with partial data, which it supports). Since `PublicShell` only needs `brand_primary` for the glow and `logo_url` + `name` for the header, a minimal `Branding` can be constructed without `background_color`/`background_shade` (both default to `null`/`'subtle'`).

---

## Q6: Current Public Surface Code Map

### `app/[account]/page.tsx` (PUB-05 target)
- Wraps everything in `<BrandedPage logoUrl backgroundColor backgroundShade>`.
- Passes `background_color`, `background_shade` to both `BrandedPage` and `ListingHero`.
- Inner `ListingHero` uses its OWN `GradientBackdrop` (separate from page wrapper) — **must be removed per PUB-05**.
- `ListingHero` also gets `brandPrimary` and `backgroundColor` props for its internal gradient.
- After migration: `<PublicShell branding={branding}>` wraps `<main>`, `ListingHero` loses its `GradientBackdrop`.
- `ListingHero` no-logo fallback already exists: initial letter in brand-colored circle (line 47-49 of `listing-hero.tsx`).

### `app/[account]/[event-slug]/page.tsx` (PUB-06 target)
- Wraps `<BookingShell>` in `<BrandedPage>`.
- `BookingShell` uses `account.timezone`, `account.name`, etc. — no branding consumption inside shell itself.
- `BookingForm` (inside `BookingShell`) uses `var(--brand-primary, #0A2540)` for the submit button style.
- Slot picker uses `bg-primary` Tailwind class for selected slot.

### `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` (PUB-07 target)
- Two `<BrandedPage>` renders: one for non-confirmed branch, one for confirmed branch.
- Confirmed page uses `var(--brand-primary, #0A2540)` + `var(--brand-text, #ffffff)` for the checkmark icon.
- Both branches use only `logoUrl`, `primaryColor`, `accountName` (no `backgroundColor`/`backgroundShade`).

### `app/cancel/[token]/page.tsx` (PUB-08 target)
- Three render paths: `not_active` → `<TokenNotActive>` (no BrandedPage), `cancelled` → `<BrandedPage>` with "Book again" link using `var(--brand-primary)`, `active` → `<BrandedPage>` with `<CancelConfirmForm>`.
- `TokenNotActive` renders without any shell — needs `bg-gray-50` wrapper per PUB-11.
- `BrandedPage` here uses only `logoUrl`, `primaryColor`, `accountName`.
- Account object from `resolveCancelToken` does NOT include `background_color`/`background_shade`.

### `app/reschedule/[token]/page.tsx` (PUB-09 target)
- One `<BrandedPage>` wrapping `<RescheduleShell>`.
- Account object from `resolveRescheduleToken` does NOT include `background_color`/`background_shade`.

### `app/[account]/[event-slug]/not-found.tsx` (PUB-10 target)
- Currently renders bare `<main>` with no background — needs `bg-gray-50` class added.
- No branding available at 404 time (no account context), so no `PublicShell`.

---

## Q7: EmbedShell Current State

**File:** `app/embed/[account]/[event-slug]/_components/embed-shell.tsx`

**Current behavior:**
- Sets `--brand-primary` and `--brand-text` via `cssVars` (lines 54-59).
- Background: `bg-white` (line 62) — **must change to `bg-gray-50` per EMBED-08**.
- Has single-circle gradient that reads from `account.background_color ?? effectiveColor` (line 51) — **references `background_color` which must be removed per EMBED-09**.
- References `account.background_shade` (line 52) — **must be removed per EMBED-09**.
- Fallback for `brand_primary` is `"#0A2540"` (NSI navy, line 45) — **EMBED-09 says fallback becomes `'#0A2540'`** (already matches, no change needed there).

**What EMBED-09/10 require:**
- Remove `backdropColor`/`shade` logic driven by `background_color`/`background_shade`.
- Replace with a single-circle gradient using `brand_primary` directly (simplified).
- Add `--primary` CSS var override (CP-05): `style={{ "--primary": effectiveColor }}` on the root element.
- **The current code sets `--brand-primary`, NOT `--primary`**. The slot picker's selected state uses `bg-primary` (Tailwind class that reads `var(--color-primary)` → `var(--primary)`). So the embed currently does NOT color the selected slot with brand color. EMBED-10 fixes this by adding `--primary` override.

**CSS var map (current vs Phase 17 target):**

| Var | Current in EmbedShell | Phase 17 target | Used by |
|-----|----------------------|-----------------|---------|
| `--brand-primary` | Set to `effectiveColor` | Keep (for `BookingForm` submit button) | `booking-form.tsx` line 248 |
| `--brand-text` | Set to `textColor` | Keep | `booking-form.tsx` line 249 |
| `--primary` | Not set | Add to override slot picker | `slot-picker.tsx` bg-primary class |

---

## Q8: EmbedHeightReporter — scrollHeight Impact

**File:** `app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx`

The reporter observes `document.documentElement.scrollHeight`. The key constraints:
- EmbedShell root is `relative overflow-hidden` — this clips absolutely-positioned glow circles and prevents them from inflating `scrollHeight`. This constraint must be maintained.
- Changing `bg-white` to `bg-gray-50` has no effect on layout dimensions — it is a color-only change.
- The glow circle is absolutely positioned inside `relative overflow-hidden` — `bg-gray-50` change doesn't alter this.
- Adding a `<PoweredByNsi>` footer **will** increase `scrollHeight`. This is expected and correct — the parent iframe will resize to accommodate. The `EmbedHeightReporter` sends the new height automatically via `ResizeObserver`. No change to `EmbedHeightReporter` code is needed.
- The `--primary` CSS var override via inline `style` attribute has zero layout impact.

**Conclusion:** `EmbedHeightReporter` code is unchanged. The embed will correctly report the taller height after `PoweredByNsi` is added.

---

## Q9: NSI Marketing URL

Searched the entire codebase for NSI domain references. Results:

- `app/(auth)/_components/auth-hero.tsx` line 29: `"Powered by NSI"` (text only, no URL)
- `.planning/ROADMAP.md`: multiple references to "North Star Integrations" (text only)
- No `nsintegrations.com`, `northstarintegrations.com`, or any marketing URL found anywhere in source code.

**REQUIREMENTS.md hardcodes:** `https://nsintegrations.com` (PUB-04)

Use `https://nsintegrations.com` per REQUIREMENTS.md. This is now locked — not Claude's discretion.

---

## Q10: Glow Fallback Logic

**Current BackgroundGlow default:** `color = "#3B82F6"` (NSI blue).

**CONTEXT.md decision:** Fall back to NSI blue when `brand_primary` is null/undefined/near-white.

**Recommendation:** Simple null/undefined check is sufficient for the `PublicShell` level:

```typescript
const glowColor = branding.primaryColor ?? '#3B82F6';
// branding.primaryColor is always a resolved string (never null) per brandingFromRow()
// so this is effectively always branding.primaryColor
```

Since `Branding.primaryColor` is guaranteed non-null by `brandingFromRow()`, the `PublicShell` always has a valid color. The "near-white" case (very light brand colors where the glow is invisible) can be addressed with a luminance threshold using the existing `relativeLuminance()` helper:

```typescript
import { relativeLuminance } from "@/lib/branding/contrast";

function resolveGlowColor(primaryColor: string): string {
  const lum = relativeLuminance(primaryColor);
  // Luminance > 0.85 = near-white — substitute NSI blue for visible glow
  return lum > 0.85 ? '#3B82F6' : primaryColor;
}
```

Threshold `0.85` corresponds roughly to colors lighter than #D0D0D0 (light grays, near-white). This is Claude's discretion — the luminance check is recommended over null-only because it handles the near-white edge case that produces invisible glows.

---

## Q11: Wave / Dependency Analysis

### Wave 1 — New shared components (no existing code touched)
**Can all run in parallel:**
- Create `app/_components/public-shell.tsx` (PUB-01, PUB-02, PUB-03)
- Create `app/_components/powered-by-nsi.tsx` (PUB-04)
- Add `variant="public"` + `branding` prop to `app/_components/header.tsx` (HDR-05, HDR-06)
- Fix `BackgroundGlow` blob-2 terminus: `#111827` → `transparent` (MP-10)

### Wave 2 — Page migrations (all depend on Wave 1 PublicShell existing)
**Can all run in parallel after Wave 1:**
- `app/[account]/page.tsx` + `listing-hero.tsx` (PUB-05)
- `app/[account]/[event-slug]/page.tsx` (PUB-06)
- `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` (PUB-07)
- `app/cancel/[token]/page.tsx` (PUB-08)
- `app/reschedule/[token]/page.tsx` (PUB-09)

### Wave 3 — Cleanup and edge cases (depends on Wave 2 complete)
**Can all run in parallel after Wave 2:**
- `app/[account]/[event-slug]/not-found.tsx` → `bg-gray-50` (PUB-10)
- `TokenNotActive` component → `bg-gray-50` + centered card (PUB-11)
- `EmbedShell` restyle (EMBED-08, 09, 10, 11)
- Decide `mini-preview-card.tsx` fate (see Open Questions)

### Wave 4 — Deletions (depends on Wave 2+3 complete, all consumers migrated)
- Delete `app/_components/branded-page.tsx` (PUB-12)
- Delete `app/_components/gradient-backdrop.tsx` (PUB-12) — only after `mini-preview-card.tsx` resolved
- Delete `components/nsi-gradient-backdrop.tsx` (PUB-12)
- Delete `lib/branding/gradient.ts` (PUB-12) — only if no remaining consumer (check `mini-preview-card` path)

### Wave 5 — Visual gate
- Deploy to Vercel, visually verify with `nsi` (blue), `nsi-rls-test` (magenta), emerald, and navy test accounts.

---

## Q12: Pitfall Verification

### CP-05 (embed CSS vars don't cross iframe boundaries)
**Status: Addressed by EMBED-10.** `EmbedShell` adds `--primary: brand_primary` inline style on its own root, independent of host page. The `style={{ "--primary": effectiveColor }}` must be on the root `<div>` of `EmbedShell`, not a parent. **Verified structure is correct** — EmbedShell's root div is the iframe document root's first meaningful element.

### CP-07 (`.day-has-slots` dot is `var(--color-accent)`, NOT `--primary`)
**Status: Safe.** Confirmed in `globals.css` line 204: `.day-has-slots::after { background: var(--color-accent); }` where `--color-accent: #F97316` (orange, set in the `@theme` block). This is a hardcoded theme token, not influenced by `--primary` or `--brand-primary`. No rewiring will happen during Phase 17 work.

### MP-04 (JIT lock for `brand_primary` hex — never use dynamic Tailwind classes)
**Status: Maintained.** `BackgroundGlow` correctly uses inline `style={{ background: ... }}` with the runtime hex. `PublicShell` will pass `branding.primaryColor` to `BackgroundGlow` via prop — no Tailwind dynamic classes. The `--primary` and `--brand-primary` overrides are inline styles on the wrapper div.

### MP-09 (delete `GradientBackdrop` after consumers migrate)
**Status: Partially at risk.** `mini-preview-card.tsx` in the branding editor imports `GradientBackdrop` and is NOT being migrated by Phase 17. `GradientBackdrop` cannot be fully deleted without also updating `mini-preview-card.tsx`. See Open Questions.

### MP-10 (second blob gradient terminus = `transparent`)
**Status: BUG IN CURRENT CODE.** `BackgroundGlow` blob 2 currently uses `#111827` (dark gray) as terminus. Must be changed to `transparent` as part of Phase 17. Blob 1 already uses `transparent` correctly.

### MN-01 (deploy + eyeball with multiple brand colors)
**Status: Test accounts exist** (`nsi`, `nsi-rls-test`, plus emerald/navy). Visual gate is Wave 5.

---

## Architecture Patterns

### PublicShell Structure (PUB-01, 02, 03)

```typescript
// app/_components/public-shell.tsx — Server Component
import type { ReactNode } from "react";
import type { Branding } from "@/lib/branding/types";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { Header } from "@/app/_components/header";
import { PoweredByNsi } from "@/app/_components/powered-by-nsi";
import { pickTextColor } from "@/lib/branding/contrast";
import { relativeLuminance } from "@/lib/branding/contrast";

interface PublicShellProps {
  branding: Branding;
  children: ReactNode;
}

function resolveGlowColor(primaryColor: string): string {
  return relativeLuminance(primaryColor) > 0.85 ? '#3B82F6' : primaryColor;
}

export function PublicShell({ branding, children }: PublicShellProps) {
  const glowColor = resolveGlowColor(branding.primaryColor);
  const foreground = pickTextColor(branding.primaryColor);

  return (
    <div className="relative min-h-screen bg-gray-50">
      <BackgroundGlow color={glowColor} />
      <Header variant="public" branding={branding} />
      <div style={{
        "--brand-primary": branding.primaryColor,
        "--brand-text": foreground,
        "--primary": branding.primaryColor,
        "--primary-foreground": foreground,
      } as React.CSSProperties}>
        <main className="pt-20 md:pt-24">
          {children}
        </main>
      </div>
      <PoweredByNsi />
    </div>
  );
}
```

Note: Setting both `--brand-primary` (for `BookingForm`'s existing inline styles) and `--primary`/`--primary-foreground` (for the slot picker's Tailwind `bg-primary` class) on the CSS var wrapper is necessary to brand all interactive elements on hosted pages.

### PoweredByNsi Component (PUB-04)

```typescript
// app/_components/powered-by-nsi.tsx — Server Component
export function PoweredByNsi() {
  return (
    <footer className="py-8 text-center">
      <p className="text-xs text-gray-400">
        Powered by{" "}
        <a
          href="https://nsintegrations.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 transition-colors"
        >
          North Star Integrations
        </a>
      </p>
    </footer>
  );
}
```

(URL `https://nsintegrations.com` per REQUIREMENTS.md PUB-04.)

### Header variant="public" Addition

The `Header` component (`app/_components/header.tsx`) must be extended:
- Add `'public'` to the `variant` union.
- Add `branding?: Branding` to `HeaderProps`.
- Add the public pill branch: logo on left (max-height 40px per HDR-05), account name text on right.
- No-logo fallback (HDR-06): initial letter in `brand_primary`-tinted circle (same pattern as `ListingHero` line 46-50).
- Outer position class for public: same as `'auth'` — `fixed top-2 md:top-6 left-0 right-0 z-30 px-4`.
- No `SidebarTrigger` in public variant.
- No `usePathname()` needed for the public branch.

**Pill glass treatment (Claude's Discretion):** Recommend `bg-white/80 backdrop-blur-sm border border-gray-200` — identical to the owner pill (consistency within the visual family). A brand-tinted glass would be visually noisier with arbitrary brand colors. Decision: white glass.

### EmbedShell Changes (EMBED-08, 09, 10)

```typescript
// Changes to embed-shell.tsx:

// 1. Background: bg-white → bg-gray-50 (EMBED-08)
// 2. Remove backdropColor/shade vars using background_color/background_shade
// 3. Simplify to: gradient uses brand_primary directly (EMBED-09)
// 4. Add --primary override for slot picker (EMBED-10)
// 5. Keep --brand-primary for BookingForm submit button

const cssVars: CSSProperties = {
  ["--brand-primary" as never]: effectiveColor,
  ["--brand-text" as never]: textColor,
  ["--primary" as never]: effectiveColor,          // EMBED-10: CP-05 -- must be on this root
  ["--primary-foreground" as never]: textColor,
  minHeight: "auto",
};

// root div: bg-gray-50 (was bg-white)
// single-circle gradient: use effectiveColor directly (not backdropColor)
// remove shade !== "none" conditional — always render the glow circle
// opacity: 0.40, blur: 160px (matching BackgroundGlow blob 1 intensity)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Luminance check for near-white glow fallback | Custom luminance function | `relativeLuminance()` from `lib/branding/contrast.ts` | Already implemented, tested, WCAG-correct |
| Text color for logo pill background | Custom contrast check | `pickTextColor()` from `lib/branding/contrast.ts` | Already implemented |
| Brand object construction | New fetch / new type | `brandingFromRow()` from `lib/branding/read-branding.ts` | Already handles all fallbacks |
| Account initial generation | New utility | `accountName.charAt(0).toUpperCase()` inline | One-liner, no library needed |

---

## Common Pitfalls

### Pitfall 1: CSS var name mismatch between public pages and embed
**What goes wrong:** Public pages' `BookingForm` uses `var(--brand-primary)`. Slot picker uses `bg-primary` (→ `var(--primary)`). Setting only one of these will leave the other unbranded.
**Prevention:** `PublicShell` wrapper div must set BOTH `--brand-primary` AND `--primary` (and their foreground counterparts). `EmbedShell` must also set both.

### Pitfall 2: `BackgroundGlow` blob-2 dark terminus on light pages
**What goes wrong:** Blob 2 currently ends at `#111827` — on `bg-gray-50` this creates a visible dark smear.
**Prevention:** Fix blob 2 terminus to `transparent` in this phase (MP-10).

### Pitfall 3: `GradientBackdrop` deletion blocked by `mini-preview-card.tsx`
**What goes wrong:** Deleting `gradient-backdrop.tsx` before updating `mini-preview-card.tsx` will break the branding editor preview.
**Prevention:** Either update `mini-preview-card.tsx` to not use `GradientBackdrop`, or defer `GradientBackdrop` deletion to Phase 18+.

### Pitfall 4: cancel/reschedule account objects lack `background_color`/`background_shade`
**What goes wrong:** `resolveCancelToken` and `resolveRescheduleToken` return account objects without `background_color`/`background_shade` — `brandingFromRow()` needs those for a full `Branding` object.
**Prevention:** Since `PublicShell` only needs `primaryColor` (for glow) and `logoUrl` + `name` (for header), call `brandingFromRow()` with just the available fields — it defaults missing fields to `null`/`'subtle'` which is correct.

### Pitfall 5: `ListingHero` still owns `GradientBackdrop` after PUB-05
**What goes wrong:** Migrating `app/[account]/page.tsx` to `PublicShell` but forgetting to remove the inner `GradientBackdrop` from `ListingHero` — results in double-gradient, and `GradientBackdrop` still has a consumer blocking deletion.
**Prevention:** PUB-05 task must include `listing-hero.tsx` changes: remove the `GradientBackdrop` import and usage, remove the `backgroundColor` and `backgroundShade` props.

### Pitfall 6: `TokenNotActive` has no branding context
**What goes wrong:** `TokenNotActive` is rendered BEFORE account context resolves (token is invalid/expired). It cannot receive `branding` or use `PublicShell`.
**Prevention:** Wrap with a plain `div` with `className="min-h-screen bg-gray-50"` and center the card — no shell needed (PUB-11).

### Pitfall 7: `EmbedHeightReporter` inflated height after `PoweredByNsi` added
**What goes wrong:** Dev assumes `EmbedHeightReporter` needs changes.
**Actually fine:** `ResizeObserver` on `document.documentElement` detects the height change from the footer automatically and reports the new correct height to the parent. No code changes needed.

---

## State of the Art

| Old Pattern | New Pattern | Reason |
|-------------|-------------|--------|
| `BrandedPage` wrapper (Phase 7-12) | `PublicShell` | Adopts NSI visual language, replaces arbitrary gradient with brand-tinted `BackgroundGlow` |
| `GradientBackdrop` (3-circle, Phase 12) | `BackgroundGlow` (2-blob, Phase 15) | Phase 15 established NSI v1.2 glow pattern — public side now uses same component |
| `--brand-primary` CSS var only | `--brand-primary` + `--primary` both set | Slot picker uses Tailwind `bg-primary` class which reads `--primary`, not `--brand-primary` |
| EmbedShell `bg-white` | `bg-gray-50` | Match NSI base surface color |
| EmbedShell gradient driven by `background_color` + shade | Gradient driven by `brand_primary` only | Phase 15 removed per-account background colors from owner shell; public follows |

**Deprecated after Phase 17:**
- `BrandedPage`: deleted (was Phase 7-12's public wrapper)
- `GradientBackdrop`: deleted (was Phase 12's 3-circle pattern) — pending `mini-preview-card.tsx` resolution
- `NSIGradientBackdrop`: deleted (thin wrapper, no remaining consumers)
- `lib/branding/gradient.ts`: deleted if no remaining consumers (currently used only by `GradientBackdrop`)
- `lib/branding/types.ts` `BackgroundShade` type: kept (still used by `mini-preview-card.tsx` if `GradientBackdrop` survives)

---

## Open Questions

### OQ-1: `mini-preview-card.tsx` blocks full `GradientBackdrop` deletion

- **What we know:** `mini-preview-card.tsx` (`app/(shell)/app/branding/_components/mini-preview-card.tsx`) directly imports and uses `GradientBackdrop`. It is a branding editor preview component in the owner shell — not a public surface.
- **What's unclear:** PUB-12 says delete `GradientBackdrop`. But the requirements don't mention updating `mini-preview-card.tsx`.
- **Recommendation:** Update `mini-preview-card.tsx` during Wave 4 to replace `GradientBackdrop` with `BackgroundGlow` (or simply remove the gradient from the mini preview, which only needs to show color — a flat `backgroundColor` tint would suffice). Then `GradientBackdrop` + `gradient.ts` can be deleted as planned.

### OQ-2: Does `PublicShell` need `bg-gray-50` as a Tailwind class or just CSS?

- **What we know:** `bg-gray-50` is a Tailwind static class (not dynamic) — it will compile correctly.
- **Recommendation:** Use `className="relative min-h-screen bg-gray-50"` on the outer div. This matches the established NSI surface pattern.

### OQ-3: `--primary-foreground` override on public pages

- **What we know:** Slot picker uses `text-primary-foreground` alongside `bg-primary`. If `--primary` is overridden with an arbitrary brand color but `--primary-foreground` is not overridden, text legibility on the selected slot depends on whether the global `--primary-foreground: #FFFFFF` happens to contrast with the brand color.
- **Recommendation:** Set `--primary-foreground` to `branding.textColor` (which is the WCAG-correct white or black for the brand color). Include it in the `PublicShell` CSS var wrapper and `EmbedShell`'s `cssVars`.

---

## Sources

### Primary (HIGH confidence)
All findings sourced directly from current codebase files. No external sources required for this phase — it is a migration/restyle of existing components.

| File | Findings |
|------|---------|
| `app/_components/header.tsx` | Q1: Current Header API — no `public` variant, no `branding` prop |
| `app/_components/background-glow.tsx` | Q2: Blob positions confirmed, MP-10 bug confirmed |
| `app/_components/branded-page.tsx` | Q3: BrandedPage consumer list, CSS var names |
| `app/_components/gradient-backdrop.tsx` | Q3: GradientBackdrop definition |
| `components/nsi-gradient-backdrop.tsx` | Q3: NSIGradientBackdrop — no active consumers |
| `lib/branding/contrast.ts` | Q4: pickTextColor, relativeLuminance |
| `lib/branding/types.ts` | Q5: Branding interface fields |
| `lib/branding/read-branding.ts` | Q5: brandingFromRow, DEFAULT_BRAND_PRIMARY |
| `app/[account]/page.tsx` | Q6: ListingHero + BrandedPage usage |
| `app/[account]/[event-slug]/page.tsx` | Q6: BookingShell + BrandedPage usage |
| `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` | Q6: Two BrandedPage branches |
| `app/cancel/[token]/page.tsx` + `_lib/resolve-cancel-token.ts` | Q6: Cancel account shape |
| `app/reschedule/[token]/page.tsx` + `_lib/resolve-reschedule-token.ts` | Q6: Reschedule account shape |
| `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` | Q7: background_color/shade refs, CSS vars |
| `app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx` | Q8: scrollHeight semantics |
| `app/globals.css` | Q12: CP-07 confirmed (.day-has-slots uses --color-accent) |
| `app/[account]/[event-slug]/_components/slot-picker.tsx` | Q12: bg-primary used for selected slot |
| `app/[account]/[event-slug]/_components/booking-form.tsx` | Q12: --brand-primary used for submit button |
| `app/[account]/_components/listing-hero.tsx` | Q3/Q6: Inner GradientBackdrop usage |
| `app/(shell)/app/branding/_components/mini-preview-card.tsx` | Q3: GradientBackdrop consumer in owner shell |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries needed, all work is component composition
- Architecture: HIGH — all patterns sourced from existing working code in this repo
- Pitfalls: HIGH — MP-10 bug confirmed by reading actual source; CSS var mismatch confirmed by reading slot-picker and booking-form source

**Research date:** 2026-04-30
**Valid until:** 2026-06-01 (stable codebase; no external dependencies)
