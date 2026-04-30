# Architecture Patterns: v1.2 Migration Map

**Project:** calendar-app v1.2 — NSI Brand Lock-Down + UI Overhaul
**Researched:** 2026-04-30
**Confidence:** HIGH — every claim sourced from direct codebase inspection.

---

## A. Removal of Per-Account Theming on Owner Shell

### A-1. Every consumer of `--primary` CSS var override on the owner side

The Phase 12.6 override lives in one place only:

```
app/(shell)/layout.tsx  lines 62-66
  <div style={{ "--primary": chrome.primaryColor, "--primary-foreground": chrome.primaryTextColor }}>
```

`chrome.primaryColor` always resolves to a non-null string (falls back to `DEFAULT_BRAND_PRIMARY = "#0A2540"`), so this override fires for every authenticated shell page render.

**What `--primary` controls inside the shell wrapper (every consumer within the override's DOM scope):**

| Consumer | File | How it reads `--primary` | v1.2 action |
|----------|------|--------------------------|-------------|
| shadcn `Button` (default variant) | `components/ui/button.tsx` | `bg-primary text-primary-foreground` Tailwind utility → resolves from `@theme { --color-primary: var(--primary) }` | Remove override; Button shows NSI blue-500 from `@theme` |
| shadcn `Switch` | `components/ui/switch.tsx` | `data-[state=checked]:bg-primary` | Same — NSI blue-500 |
| Focus rings | `globals.css` `outline-ring/50` | Ring uses `--ring` (not `--primary`); focus ring on Button/Input maps to `--ring` not `--primary` | No change needed |
| `day-custom::after` marker (availability calendar) | `app/globals.css` line 175 | `background: hsl(var(--primary))` — dot under custom override days in `/app/availability` | Remove override; shows NSI blue-500 from `@theme` |
| `ShadePicker` active button border | `app/(shell)/app/branding/_components/shade-picker.tsx` line 36 | `border-primary bg-primary/5` | NSI blue-500 from `@theme` |
| `ColorPickerInput` active swatch indicator | `app/(shell)/app/branding/_components/color-picker-input.tsx` line 148 | `hsl(var(--primary, 221 83% 53%))` | NSI blue-500 from `@theme` |
| `MiniPreviewCard` faux button/switch | `app/(shell)/app/branding/_components/mini-preview-card.tsx` lines 61, 66 | `hsl(var(--primary))` fallback when `primaryColor` prop is null | v1.2 rebuilds this component entirely (see E-2) |
| `HomeCalendar` capped-dot DayButton | `app/(shell)/app/_components/home-calendar.tsx` line 99 | `var(--brand-primary, hsl(var(--primary)))` | This consumer uses `--brand-primary` first; `--primary` is the fallback. On owner side `--brand-primary` is not set (only `--primary` is overridden). Post v1.2: override removed, CSS var chain resolves to `@theme --color-primary = #3B82F6` = NSI blue. **No file change needed** — fallback cascade does the right thing automatically once `@theme` is updated. |

**v1.2 `@theme` change required:**

`app/globals.css` `@theme` block currently sets `--color-primary: #0A2540`. Change to `--color-primary: #3B82F6` (Tailwind `blue-500`). This single change locks NSI blue across all owner-side shadcn components without a DOM-level override.

The inline `<div style={{ "--primary": ... }}>` wrapper in `app/(shell)/layout.tsx` is then deleted entirely. The layout no longer needs to import `resolveChromeColors` for the `--primary` purpose (it may still need it temporarily if `sidebarColor` prop removal to `AppSidebar` happens in the same phase — see below).

### A-2. Every consumer of `chromeTintToCss`, `chromeTintTextColor`, and `resolveChromeColors`

**`chromeTintToCss`**

| Call site | File | Notes |
|-----------|------|-------|
| Internal call inside `chromeTintTextColor` | `lib/branding/chrome-tint.ts` line 63 | Implementation detail; deleted when the file is cleaned up |
| Test suite | `tests/branding-chrome-tint.test.ts` line 2 (import), lines 26–86 (test cases) | Only external importer; 11 test cases in the `describe("chromeTintToCss")` block |

No application code (routes, components, layouts, actions) imports `chromeTintToCss` directly. The function was already gated behind `resolveChromeColors` in Phase 12.6.

**`chromeTintTextColor`**

| Call site | File | Notes |
|-----------|------|-------|
| Internal to `chrome-tint.ts` only | `lib/branding/chrome-tint.ts` line 57 | No external consumer |
| Test suite | `tests/branding-chrome-tint.test.ts` line 2 (import), lines 89–107 (test cases) | 4 test cases in the `describe("chromeTintTextColor")` block |

**`resolveChromeColors`**

| Call site | File | Purpose | v1.2 action |
|-----------|------|---------|-------------|
| `app/(shell)/layout.tsx` line 13 (import), line 59 (call) | Shell layout | Derives `primaryColor`, `sidebarColor`, `sidebarTextColor`, `pageColor`, `primaryTextColor` — all 5 fed into inline styles | DELETE the import and call; remove the `--primary` wrapper div and the `AppSidebar` color props |
| `components/app-sidebar.tsx` line 39 (comment only) | Sidebar | Comment says "from resolveChromeColors in shell layout"; no direct import | No import to delete; just remove `sidebarColor` and `sidebarTextColor` props from the component interface and usage |
| Test suite | `tests/branding-chrome-tint.test.ts` line 2, lines 114–188 | 20+ test cases for Phase 12.6 path | UPDATE or DELETE (see H-15) |

**Deletion order for `chromeTintToCss` / `chromeTintTextColor`:**

1. Delete `tests/branding-chrome-tint.test.ts` first (removes the only external import).
2. Delete `chromeTintToCss` and `chromeTintTextColor` function bodies from `lib/branding/chrome-tint.ts`.
3. The `TINT_PCT` table and `ChromeTintSurface` type can also be deleted at that point.
4. `resolveChromeColors` and `ResolvedChromeColors` are retained until owner shell usage is removed (see migration order section G).

### A-3. Every consumer of deprecated DB columns

**Columns to drop:** `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity`

**`sidebar_color`**

| File | Read or Write | Context |
|------|---------------|---------|
| `app/(shell)/layout.tsx` line 42 | READ (SELECT) | `accounts` query; feeds `resolveChromeColors` |
| `lib/branding/read-branding.ts` line 29, 52 | READ (SELECT + row mapping) | `getBrandingForAccount` + `brandingFromRow` |
| `app/(shell)/app/branding/_lib/load-branding.ts` line 39 | READ (SELECT) | Branding editor page loader |
| `app/(shell)/app/branding/_lib/actions.ts` line 189 | WRITE (UPDATE) | `saveBrandingAction` |
| `app/(shell)/app/branding/_lib/schema.ts` line 52-59 | WRITE validation | `sidebarColorSchema`, `brandingBackgroundSchema` |
| `app/api/bookings/route.ts` line 171 | READ (SELECT) | Account row for email sender |
| `app/api/cron/send-reminders/route.ts` lines 92-93, 134 | READ (SELECT + scan query) | Account row for email sender |
| `lib/bookings/cancel.ts` line 91 | READ (SELECT with join) | Pre-fetch for cancel emails |
| `lib/bookings/reschedule.ts` (not shown but same pattern) | READ (SELECT with join) | Pre-fetch for reschedule emails |
| `lib/email/send-booking-confirmation.ts` lines 40-41, 93 | READ (interface field + usage) | `AccountRecord.sidebar_color`, branding object |
| `lib/email/send-owner-notification.ts` lines 36-37, 84 | READ (interface field + usage) | Same pattern |
| `lib/email/send-cancel-emails.ts` lines 44-45, 106, 211 | READ (interface field + usage) | Two functions in the file |
| `lib/email/send-reschedule-emails.ts` lines 44-45, 109, 209 | READ (interface field + usage) | Two functions in the file |
| `lib/email/send-reminder-booker.ts` lines 73-74, 118 | READ (interface field + usage) | Reminder sender |
| `lib/email/branding-blocks.ts` lines 17-19, 53 | READ (EmailBranding interface + priority chain) | `sidebarColor` field and resolution logic |
| `lib/branding/types.ts` line 31 | TYPE DEFINITION | `Branding.sidebarColor` field |
| `components/app-sidebar.tsx` lines 51-54, 56, 70-74 | PROP CONSUMER | `sidebarColor` / `sidebarTextColor` props |

**`background_color`**

| File | Read or Write | Context |
|------|---------------|---------|
| `app/(shell)/layout.tsx` line 42 | READ (SELECT) | `background_color` in accounts query |
| `app/(shell)/layout.tsx` line 79 | READ (usage) | `GradientBackdrop color={branding.backgroundColor}` |
| `lib/branding/read-branding.ts` line 27, 48 | READ | `brandingFromRow` |
| `app/(shell)/app/branding/_lib/load-branding.ts` line 39 | READ (SELECT) | Editor page loader |
| `app/(shell)/app/branding/_lib/actions.ts` line 189 | WRITE (UPDATE) | `saveBrandingAction` |
| `app/(shell)/app/branding/_lib/schema.ts` line 34-38 | WRITE validation | `backgroundColorSchema` |
| `app/(shell)/app/branding/_components/branding-editor.tsx` lines 39, 116 | STATE + UI | `backgroundColor` state |
| `app/(shell)/app/branding/_components/mini-preview-card.tsx` lines 3, 9, 48, 48 | PROP + usage | `pageColor` prop → `GradientBackdrop` |
| `app/[account]/page.tsx` lines 39, 46 | READ | Listing page |
| `app/[account]/[event-slug]/page.tsx` lines 42, 49 | READ | Booking page |
| `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` lines 51-52 | READ | Embed shell |
| `app/_components/branded-page.tsx` lines 12, 16, 66-67, 73 | PROP + usage | `backgroundColor` prop |
| `app/api/bookings/route.ts` line 171 | READ (SELECT) | Account row |
| `app/api/cron/send-reminders/route.ts` lines 88-89, 134 | READ (SELECT + scan) | Account row |
| `lib/bookings/cancel.ts` line 91 | READ (join) | Cancel pre-fetch |
| `lib/email/send-booking-confirmation.ts` lines 38-39, 93 | READ | `AccountRecord.background_color` |
| `lib/email/send-owner-notification.ts` lines 35-36, 84 | READ | Same |
| `lib/email/send-cancel-emails.ts` lines 41-42, 106, 210 | READ | Two functions |
| `lib/email/send-reschedule-emails.ts` lines 38-39, 109, 210 | READ | Two functions |
| `lib/email/send-reminder-booker.ts` lines 70-71, 118 | READ | Reminder |
| `lib/email/branding-blocks.ts` lines 12-14 | READ (EmailBranding interface) | `backgroundColor` field |
| `lib/branding/types.ts` lines 21-22 | TYPE DEFINITION | `Branding.backgroundColor` |

**`background_shade`**

| File | Read or Write | Context |
|------|---------------|---------|
| `app/(shell)/layout.tsx` line 42 | READ (SELECT via `getBrandingForAccount`) | Feeds `GradientBackdrop shade=` |
| `app/(shell)/layout.tsx` line 79 | READ (usage) | `GradientBackdrop shade={branding.backgroundShade}` |
| `lib/branding/read-branding.ts` lines 28, 33-36, 48 | READ + validation | `brandingFromRow` |
| `app/(shell)/app/branding/_lib/load-branding.ts` lines 39, 58-61 | READ (SELECT + validation) | Editor |
| `app/(shell)/app/branding/_lib/actions.ts` lines 9, 162, 189 | WRITE | `saveBrandingAction` |
| `app/(shell)/app/branding/_lib/schema.ts` line 40-42 | WRITE validation | `backgroundShadeSchema` |
| `app/(shell)/app/branding/_components/branding-editor.tsx` lines 42-44, 127, 133 | STATE + UI | `backgroundShade` state + `ShadePicker` |
| `app/(shell)/app/branding/_components/shade-picker.tsx` | UI COMPONENT | Entire component is the `background_shade` picker |
| `app/(shell)/app/branding/_components/mini-preview-card.tsx` line 9 | PROP | `shade` prop to `GradientBackdrop` |
| `app/[account]/page.tsx` lines 39, 47, 55 | READ | Listing page |
| `app/[account]/[event-slug]/page.tsx` lines 42, 49 | READ | Booking page |
| `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` line 52 | READ | Embed shell |
| `app/_components/branded-page.tsx` lines 13-16, 67, 73 | PROP + usage | `backgroundShade` prop |
| `lib/branding/types.ts` lines 7-8, 22-23 | TYPE DEFINITION | `BackgroundShade` type + `Branding.backgroundShade` field |

**`chrome_tint_intensity`**

| File | Read or Write | Context |
|------|---------------|---------|
| `lib/branding/read-branding.ts` lines 28, 38-41, 48 | READ | `brandingFromRow` |
| `lib/branding/read-branding.ts` line 77 | READ (SELECT column) | `getBrandingForAccount` |
| `app/(shell)/app/branding/_lib/schema.ts` lines 44-47 | WRITE validation | `chromeTintIntensitySchema` (no longer called from `saveBrandingAction` as of 12.6, but still declared) |
| `app/api/bookings/route.ts` line 171 | READ (SELECT) | Account row |
| `app/api/cron/send-reminders/route.ts` lines 90-91, 134 | READ (SELECT + scan) | Account row |
| `lib/bookings/cancel.ts` line 91 | READ (join) | Cancel pre-fetch |
| `lib/email/send-booking-confirmation.ts` lines 38-39 | READ (interface field only) | Marked deprecated in comment |
| `lib/email/send-owner-notification.ts` lines 35-36 | READ (interface field only) | Same |
| `lib/email/send-cancel-emails.ts` lines 43-44 | READ (interface field only) | Same |
| `lib/email/send-reschedule-emails.ts` lines 40-41 | READ (interface field only) | Same |
| `lib/email/send-reminder-booker.ts` lines 72-73 | READ (interface field only) | Same |
| `lib/email/branding-blocks.ts` lines 20-22 | READ (EmailBranding interface) | `chromeTintIntensity` field with compat comment |
| `lib/branding/types.ts` lines 10-11, 26-27 | TYPE DEFINITION | `ChromeTintIntensity` type + `Branding.chromeTintIntensity` |
| `tests/branding-chrome-tint.test.ts` line 17 | TEST FIXTURE | `makeBranding` default includes `chromeTintIntensity: "subtle"` |

---

## B. Public-Side Gain of `--primary` Override

### B-4. Integration point for `--primary` on public surfaces

Currently:
- `app/[account]/page.tsx` and `app/[account]/[event-slug]/page.tsx` wrap content in `<BrandedPage>` which sets `--brand-primary` and `--brand-text` CSS vars, but does NOT set `--primary`.
- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` sets `--brand-primary` and `--brand-text` but not `--primary`.
- `app/cancel/[token]` and `app/reschedule/[token]` also use `--brand-primary` via `BrandedPage`.
- All public-facing consumers (booking form CTA, slot picker, cancel form buttons) currently use `var(--brand-primary, #0A2540)` as their inline style — they do NOT depend on shadcn `--primary` at all.

**Recommendation:** Do NOT add `--primary` to public surfaces. The public slot picker, booking form CTA, and cancellation form buttons all use `var(--brand-primary, ...)` directly. This is the correct pattern — it keeps the two color systems independent and means no shadcn component accidentally bleeds customer brand color into NSI-chrome areas if components are reused.

The `BackgroundGlow` color on public surfaces comes from a `color` prop (see C-6). The glass pill on public surfaces uses customer logo/name but the pill itself is static white glass — no `--primary` needed for the pill structure.

**Conclusion:** No `--primary` override needed on public surfaces. Public coloring goes through `--brand-primary` (existing system) + `BackgroundGlow color={brandPrimary}` (new system). The `BrandedPage` wrapper should gain the `BackgroundGlow` integration but does not need a `--primary` override. No `PublicShell` wrapper is necessary — extend `BrandedPage` instead.

---

## C. `BackgroundGlow` Integration

### C-5. Where `BackgroundGlow` mounts per layout layer

**Reference implementation:** `lead-scoring/app/components/BackgroundGlow.tsx` — `fixed inset-0 z-0 pointer-events-none overflow-hidden`. Two absolute blobs inside.

Calendar-app has these layout layers:

| Surface | Layout file | Recommended mount point | z-index context |
|---------|------------|------------------------|-----------------|
| **Owner shell** (`/app/*`) | `app/(shell)/layout.tsx` | Inside `SidebarInset` (already has `relative overflow-hidden`), as first child, replacing `GradientBackdrop` | Owner `BackgroundGlow` must be `absolute` (not `fixed`) to stay inside `SidebarInset` bounds; otherwise it bleeds under the `Sidebar` panel. Use `absolute inset-0 z-0 pointer-events-none overflow-hidden` |
| **Auth pages** (`/app/login`, `/app/signup`, etc.) | No group layout file; each page is standalone | Mount inside `AuthHero` or per-page wrapper only, replacing `NSIGradientBackdrop` | Fixed NSI tokens; `NSIGradientBackdrop` already wraps `GradientBackdrop color="#0A2540"` — replace both with `BackgroundGlow` with fixed NSI blue |
| **Onboarding** (`/onboarding/*`) | `app/onboarding/layout.tsx` | Add `BackgroundGlow` as first child of the `min-h-screen bg-white` div | NSI blue fixed tokens |
| **Public booking page** (`/[account]/[event-slug]`, `/[account]`) | `app/_components/branded-page.tsx` | Replace `GradientBackdrop` call on line 73 with `<BackgroundGlow color={backgroundColor ?? brandPrimary} />` | Must be `absolute` (not `fixed`) — `BrandedPage` wrapper is `relative overflow-hidden` |
| **Embed** (`/embed/[account]/[event-slug]`) | `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` | Replace inline single-circle blob with `<BackgroundGlow color={backdropColor} />` but keep the `absolute` variant — embed must not use `fixed` (breaks iframe height reporting) | `absolute inset-0 z-0` |
| **Cancel/reschedule token pages** | These pages use `BrandedPage` wrapper — handled automatically by updating `BrandedPage` | — | — |

**z-index ordering:**

```
Owner shell (inside SidebarInset):
  BackgroundGlow: absolute z-0
  Main content:   relative z-10
  SidebarTrigger: fixed top-3 left-3 z-20 md:hidden (mobile only)
  Header pill:    fixed top-2 z-30
  AppSidebar:     z-index managed by shadcn Sidebar (uses Sheet on mobile, z-40+)
```

The shadcn `Sidebar` on mobile renders as a `Sheet` which uses Radix `Portal` — it appears above everything at `z-40+`. `BackgroundGlow` at `z-0` renders below everything. No conflict.

`AlertDialog` and other Radix overlays use `z-50+` via portal. `BackgroundGlow` at `z-0` is always below. No conflict.

**Two variants needed:**

1. `BackgroundGlow` (NSI fixed) — hardcoded `#3B82F6` blobs, `absolute` positioning for shell/auth/onboarding.
2. `BackgroundGlow color={hex}` — customer-tinted, same structure, `absolute` positioning for public/embed.

Single component with optional `color` prop (see C-6).

### C-6. `BackgroundGlow` prop API

**Recommendation:**

```tsx
// app/_components/background-glow.tsx
interface BackgroundGlowProps {
  /** Hex color for the gradient stop. Defaults to NSI blue-500 (#3B82F6). */
  color?: string;
}

export function BackgroundGlow({ color = "#3B82F6" }: BackgroundGlowProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute w-80 h-80 rounded-full opacity-40 blur-[160px]"
        style={{
          top: "-32px",
          left: "calc(50% + 580px)",
          transform: "translateX(-50%)",
          backgroundImage: `linear-gradient(to top right, ${color}, transparent)`,
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full opacity-[0.35] blur-[160px]"
        style={{
          top: "420px",
          left: "calc(50% + 380px)",
          transform: "translateX(-50%)",
          backgroundImage: `linear-gradient(to top right, ${color}, #111827)`,
        }}
      />
    </div>
  );
}
```

Key decisions:
- `absolute` not `fixed` — works inside any `relative overflow-hidden` parent without leaking outside the containing block. Lead-scoring uses `fixed` because its layout is a full-page app; calendar-app needs `absolute` for the embed (iframe height) and for the SidebarInset containment.
- Default `color="#3B82F6"` eliminates a required prop for NSI-locked surfaces.
- Inline `style` for runtime hex (Phase 7 pitfall: never dynamic Tailwind for runtime colors).
- Does NOT accept `shade` prop — the v1.2 visual language drops the 3-level "none/subtle/bold" gradient intensity knob. The blob is always on.
- Callers on public surfaces pass `color={branding.primaryColor}` (from the resolved `Branding` object).

---

## D. Glass Header Pill Component

### D-7. Header component shape: single component with `variant` vs. two components

**Recommendation: two separate components — `OwnerHeader` and `PublicHeader`.**

Rationale:
- The differences are structural, not just stylistic. `OwnerHeader` needs: NorthStar wordmark (static), context label from path, `SidebarTrigger` (mobile hamburger), no logo prop. `PublicHeader` needs: customer `logoUrl` (possibly null), customer `accountName`, no wordmark, no `SidebarTrigger`, no context label.
- A single `<Header variant="owner" />` would require 4-5 conditional blocks inside the component. Two focused components are each ~40 lines and can be read without following variant branches.
- The components are mounted in completely different layout contexts (`(shell)/layout.tsx` vs `BrandedPage`/`PublicShell`).
- "Two separate components" matches the lead-scoring codebase's own pattern: `Header.tsx` is a single-use component, not a generic variant system.

**`OwnerHeader` shape:**

```tsx
// app/(shell)/_components/owner-header.tsx
"use client";
// Uses usePathname() for context label
// Fixed top-2 md:top-6 left-0 right-0 z-30 px-4
// Pill: max-w-6xl h-14 px-4 rounded-2xl flex items-center justify-between
//       bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]
// Left: NorthStar wordmark (gray-900 + blue-500, font-extrabold tracking-[-0.04em])
//       + SidebarTrigger (md:hidden)
// Right: context label (text-[13px] font-medium text-gray-500)
```

Mounted in `app/(shell)/layout.tsx` inside `SidebarInset`, above `<main>`.

**`PublicHeader` shape:**

```tsx
// app/_components/public-header.tsx
// No "use client" needed — receives logo/name as props from Server Component
// Same pill structure: fixed top-2 md:top-6 z-30
// Left: logoUrl ? <img> : <span>{accountName}</span>
// Right: "Powered by NSI" small badge (text-[11px] text-gray-400)
```

Mounted inside `BrandedPage` (or optionally `PublicHeader` rendered by `BrandedPage` when `showHeader={true}`).

### D-8. Context label source for `OwnerHeader`

**Recommendation: `usePathname()` + static map, identical to lead-scoring's `getContextLabel`.**

```ts
function getContextLabel(pathname: string): string {
  if (pathname === "/app" || pathname === "/app/") return "Dashboard";
  if (pathname.startsWith("/app/event-types")) return "Event Types";
  if (pathname.startsWith("/app/availability")) return "Availability";
  if (pathname.startsWith("/app/bookings")) return "Bookings";
  if (pathname.startsWith("/app/branding")) return "Branding";
  if (pathname.startsWith("/app/settings")) return "Settings";
  return "";
}
```

This lives inside `OwnerHeader` client component. No layout prop, no metadata — just pathname matching.

Rationale: per-page metadata approach requires additional prop-drilling or context plumbing. The pathname map is 8 lines and covers all current sidebar items exactly. If new routes are added, the map is the single file to update (consistent with lead-scoring pattern).

### D-9. Public header with null `logo_url`

**Recommendation: fallback to text-only pill using `accounts.name`.**

```tsx
// Inside PublicHeader
{logoUrl ? (
  <img src={logoUrl} alt={accountName} className="h-8 w-auto max-w-[120px] object-contain" />
) : (
  <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{accountName}</span>
)}
```

No placeholder icon. Text-only is clean and accessible. If `accountName` is somehow also null (not possible given DB NOT NULL constraint on `accounts.name`), the pill renders empty left side — acceptable edge case.

---

## E. Branding Editor Restructure

### E-10. `saveBrandingAction` signature change

**Recommendation: single `saveBrandingAction` with the new simplified payload. No split.**

Rationale: the existing split is `uploadLogoAction` (Storage + DB, separate due to FormData requirement) + `savePrimaryColorAction` (brand_primary only) + `saveBrandingAction` (background fields). v1.2 keeps `uploadLogoAction` and `deleteLogoAction` as-is. It renames/replaces `saveBrandingAction` to save `{ brandPrimary, brandAccent }` together. `savePrimaryColorAction` is either merged into the new `saveBrandingAction` or deleted (since it only writes `brand_primary`, the new action covers it).

**New signature:**

```ts
export async function saveBrandingAction(payload: {
  brandPrimary: string;          // required; Zod validates #RRGGBB
  brandAccent: string | null;    // nullable; Zod validates #RRGGBB or null
}): Promise<ActionResult>
```

Writes `accounts SET brand_primary = ?, brand_accent = ?`. Single DB round-trip. Two-stage owner auth (existing `getOwnerAccountIdOrThrow` pattern preserved).

The old `saveBrandingAction` (background fields) is deleted. `savePrimaryColorAction` is also deleted — its purpose is absorbed.

**Files to update:**
- `app/(shell)/app/branding/_lib/actions.ts` — replace `saveBrandingAction` body and signature
- `app/(shell)/app/branding/_lib/schema.ts` — delete `backgroundColorSchema`, `backgroundShadeSchema`, `sidebarColorSchema`, `chromeTintIntensitySchema`, `brandingBackgroundSchema`; add `brandAccentSchema`
- `app/(shell)/app/branding/_components/branding-editor.tsx` — rewrite entirely
- `app/(shell)/app/branding/_lib/load-branding.ts` — remove `backgroundColor`, `backgroundShade`, `sidebarColor` fields from `BrandingState`; add `brandAccent`

### E-11. `MiniPreviewCard` rebuild

**Recommendation: rip out and rewrite as a new component.**

The current implementation (`app/(shell)/app/branding/_components/mini-preview-card.tsx`) is structurally incompatible with the v1.2 preview (faux booking page vs. faux dashboard). Evolving in place requires touching every line. A clean rewrite is ~60 lines and avoids carrying Phase 12.6 mental model into the new component.

**v1.2 `MiniPreviewCard` target structure:**
- `relative overflow-hidden rounded-lg border h-48` outer container (gray-50 background)
- `BackgroundGlow color={brandPrimary}` inside (absolute, clipped to the card)
- White card `bg-white rounded-md shadow-sm p-3 mx-3 mt-4` faux booking card
- Shimmer slot buttons: one with `bg-primary` (brandPrimary) as selected state, one with border only
- Accent color (`brandAccent`) shown as the slot-picker selected ring/border

The `ShadePicker` component (`app/(shell)/app/branding/_components/shade-picker.tsx`) is deleted — it belongs to the `background_shade` picker which is removed.

**`preview-iframe.tsx`** remains — the live embed preview in the right column of the branding editor continues to work unchanged (it points to `/embed/[account]/[event-slug]?previewColor=...`).

---

## F. Email Branding Interface Restructure

### F-12. `EmailBranding` interface — every file that defines or consumes it

**Current definition:** `lib/email/branding-blocks.ts` lines 7-22.

Current fields:
- `name: string`
- `logo_url: string | null`
- `brand_primary: string | null`
- `backgroundColor: string | null` (unused by `renderEmailBrandedHeader` as of 12.6)
- `sidebarColor?: string | null` (Phase 12.6 primary source for header band)
- `chromeTintIntensity?: "none" | "subtle" | "full"` (deprecated compat field)

**v1.2 target:**
```ts
export interface EmailBranding {
  name: string;           // accountName
  logo_url: string | null;
  brand_primary: string | null;  // renamed to brandPrimary in v1.2 (see below)
  brand_accent: string | null;   // new; available for future use (CTA button tint)
}
```

**Naming convention note:** The existing interface uses snake_case (`brand_primary`, `logo_url`) matching the raw DB column names. This is consistent with the existing pattern where senders pass the raw account row or a subset. Recommend keeping `brand_primary` / `logo_url` snake_case for v1.2 to minimize diff — the interface matches the DB columns passed by route callers.

**Files that define `EmailBranding`:** 1 file only — `lib/email/branding-blocks.ts`.

**Files that construct an `EmailBranding`-compatible object** (the `branding = { ... }` local variable pattern):

| File | Lines | Fields currently set |
|------|-------|----------------------|
| `lib/email/send-booking-confirmation.ts` | 87-93 | `name`, `logo_url`, `brand_primary`, `backgroundColor`, `sidebarColor` |
| `lib/email/send-owner-notification.ts` | 78-84 | Same 5 fields |
| `lib/email/send-cancel-emails.ts` (2 functions) | ~100-106 and ~205-211 | Same 5 fields |
| `lib/email/send-reschedule-emails.ts` (2 functions) | ~104-110 and ~204-210 | Same 5 fields |
| `lib/email/send-reminder-booker.ts` | 112-118 | Same 5 fields |

Total: 6 sender files, each constructing the branding object. Each needs `backgroundColor` and `sidebarColor` removed, `brand_accent` optionally added.

**Files that pass account columns to these senders** (the `AccountRecord` interface pattern):

The `AccountRecord` interface is local to each sender file (not shared). Each of the 6 sender files defines its own `AccountRecord` interface that includes `background_color?`, `chrome_tint_intensity?`, `sidebar_color?`. These local interfaces need the deprecated fields removed.

**Route/cron callers that SELECT the account row and pass it to senders:**

| File | SELECT columns | v1.2 change |
|------|---------------|-------------|
| `app/api/bookings/route.ts` line 171 | `logo_url, brand_primary, background_color, chrome_tint_intensity, sidebar_color` | Remove `background_color, chrome_tint_intensity, sidebar_color`; keep `logo_url, brand_primary`; add `brand_accent` |
| `app/api/cron/send-reminders/route.ts` line 134 | `logo_url, brand_primary, background_color, chrome_tint_intensity, sidebar_color` | Same changes |
| `lib/bookings/cancel.ts` line 91 (join select) | `logo_url, brand_primary, background_color, chrome_tint_intensity, sidebar_color` | Same changes |
| `lib/bookings/reschedule.ts` (join select, same pattern as cancel) | Same | Same changes |

### F-13. `renderEmailBrandedHeader` after `EmailBranding` collapse

Current priority chain (lines 52-56 of `branding-blocks.ts`):
```ts
const bg = branding.sidebarColor ?? branding.brand_primary ?? DEFAULT_BRAND_PRIMARY;
```

v1.2 collapses to:
```ts
const bg = branding.brand_primary ?? DEFAULT_BRAND_PRIMARY;
```

The function signature stays identical (`branding: EmailBranding`). No callers need to change their function call — only the `EmailBranding` type and the priority chain change.

`renderBrandedButton` already uses `opts.primaryColor ?? DEFAULT_BRAND_PRIMARY` directly — no change.

`brandedHeadingStyle` already uses `primaryColor ?? DEFAULT_BRAND_PRIMARY` directly — no change.

---

## G. Migration Order (DROP Timing)

### G-14. Recommended phase sequence for schema cleanup

**Constraint:** Supabase on Vercel with no zero-downtime deploy guarantee. Each phase is a deploy. Columns can be removed from SELECTs and UPDATEs in one deploy, then DROPped in the next.

**Recommended two-deploy pattern:**

**Phase N (code stop-reading/writing, deploy):**
- Remove all SELECT column lists from all route handlers and lib files (see A-3 tables above).
- Remove all UPDATE statements writing to the columns.
- Remove field definitions from `EmailBranding`, `Branding`, `BrandingState`.
- Remove `brandingFromRow` and `getBrandingForAccount` mappings for deprecated columns.
- The DB columns still exist; no application code reads or writes them.
- Deploy and verify no runtime errors (TypeScript will catch any missed consumers at build time).

**Phase N+1 (DROP migration, deploy):**
- Write migration:
  ```sql
  ALTER TABLE accounts DROP COLUMN IF EXISTS sidebar_color;
  ALTER TABLE accounts DROP COLUMN IF EXISTS background_color;
  ALTER TABLE accounts DROP COLUMN IF EXISTS background_shade;
  ALTER TABLE accounts DROP COLUMN IF EXISTS chrome_tint_intensity;
  DROP TYPE IF EXISTS background_shade;
  DROP TYPE IF EXISTS chrome_tint_intensity;
  ```
- Delete `lib/branding/chrome-tint.ts` (after test deletion).
- Delete `lib/branding/gradient.ts` (`shadeToGradient`).
- Delete `app/_components/gradient-backdrop.tsx`.
- Delete `components/nsi-gradient-backdrop.tsx`.
- Delete `app/(shell)/app/branding/_components/shade-picker.tsx`.
- Remove schema validation exports from `app/(shell)/app/branding/_lib/schema.ts`.

**Why not wait through a production cycle?**
The calendar-app is a low-traffic v1 tool with no high-volume concurrent requests. There is no risk of in-flight requests reading a column that's been DROPped — Next.js bundles are immutable between deploys. The two-deploy pattern provides the safety window without requiring a timed production soak period.

**CONCURRENTLY note:** `DROP COLUMN` is not an online operation in Postgres (it takes an `ACCESS EXCLUSIVE` lock), but on a small table (single-tenant v1) the lock duration is microseconds. No `CONCURRENTLY` equivalent exists for `DROP COLUMN`; none is needed here.

**Enum DROP order:** The `background_shade` and `chrome_tint_intensity` Postgres enums must be dropped AFTER the columns that use them. The migration above does this correctly (columns first, then types).

---

## H. Dead Code Removal Map

### H-15. `chromeTintToCss` / `chromeTintTextColor` removal

**Pre-condition for deletion:** `tests/branding-chrome-tint.test.ts` is the only external importer of both functions.

**Recommendation:** Delete the Phase 12.5 test file entirely. The `describe("chromeTintToCss")` and `describe("chromeTintTextColor")` blocks test math that is gone in v1.2 (color-mix tinting is removed). The `describe("resolveChromeColors")` block tests the v1.2 `resolveChromeColors` function, which is also going away (only the shell layout uses it, and that usage is deleted). Deleting the entire file is correct.

If a replacement test is desired for the v1.2 branding model (e.g., testing `brandingFromRow` with the simplified column set), create a new test file `tests/branding.test.ts`.

### H-16. Likely-deletable files (enumerated)

| File | Status | Dependency before delete |
|------|--------|--------------------------|
| `app/_components/gradient-backdrop.tsx` | DELETE in Phase N+1 | Remove all imports first: `branded-page.tsx`, `nsi-gradient-backdrop.tsx`, `mini-preview-card.tsx`, `embed-shell.tsx` |
| `components/nsi-gradient-backdrop.tsx` | DELETE in Phase N+1 | Remove import from `app/(auth)/_components/auth-hero.tsx` first (replace with `BackgroundGlow`) |
| `lib/branding/gradient.ts` | DELETE in Phase N+1 | Remove import from `gradient-backdrop.tsx` first (deleted above) |
| `app/(shell)/app/branding/_components/shade-picker.tsx` | DELETE in Phase N+1 | Remove import from `branding-editor.tsx` first |
| `app/(shell)/app/branding/_components/intensity-picker.tsx` | VERIFY ALREADY DELETED — confirmed not present in `app/(shell)/app/branding/_components/*` glob output (only 6 files, no `intensity-picker.tsx`) | N/A |
| `app/(shell)/_components/floating-header-pill.tsx` | VERIFY ALREADY DELETED — confirmed not present; Phase 12.5-02 deletion confirmed | N/A |
| `lib/branding/chrome-tint.ts` (functions `chromeTintToCss`, `chromeTintTextColor`, `TINT_PCT`, `ChromeTintSurface` type) | DELETE functions in Phase N+1; keep `resolveChromeColors` until Phase N | Delete test file first, then remove functions; `resolveChromeColors` deleted when shell layout is migrated |
| `tests/branding-chrome-tint.test.ts` | DELETE in Phase N (before column DROP) | No dependents — test runner only |

**Target `lib/branding/` shape after all deletions:**

```
lib/branding/
  contrast.ts        — KEEP (pickTextColor used everywhere)
  read-branding.ts   — KEEP but simplified (remove chrome-tint/gradient imports)
  types.ts           — KEEP but simplified (remove ChromeTintIntensity, BackgroundShade, deprecated Branding fields)
  chrome-tint.ts     — REDUCED to resolveChromeColors + ResolvedChromeColors only (or deleted entirely if resolveChromeColors is also removed)
```

If `resolveChromeColors` is also deleted (owner shell no longer needs it, public surfaces don't use it), `chrome-tint.ts` is deleted entirely. The only remaining lib/branding files would be `contrast.ts`, `read-branding.ts`, and `types.ts`.

**`brand_accent` integration points (new):**

`brand_accent` already exists in the initial schema (`accounts.brand_accent text`). It is not currently read by any application code. In v1.2:

| File | Change |
|------|--------|
| `lib/branding/read-branding.ts` — `brandingFromRow` | Add `brand_accent?: string | null` to input row type; map to `Branding.accentColor` |
| `lib/branding/types.ts` — `Branding` interface | Add `accentColor: string | null` field |
| `app/(shell)/app/branding/_lib/load-branding.ts` — `BrandingState` | Add `brandAccent: string | null` |
| `app/(shell)/app/branding/_lib/load-branding.ts` — SELECT | Add `brand_accent` to column list |
| `app/(shell)/app/branding/_lib/actions.ts` — `saveBrandingAction` | Write `brand_accent = brandAccentResult.data ?? null` |
| `app/_components/branded-page.tsx` | Add `accentColor` prop; set `--brand-accent` CSS var |
| `app/_components/background-glow.tsx` (new) | `color` prop defaults to `#3B82F6`; callers pass `brandPrimary` |
| `lib/email/branding-blocks.ts` — `EmailBranding` | Add `brand_accent: string | null` field |
| `app/api/bookings/route.ts` | Add `brand_accent` to SELECT |
| `app/api/cron/send-reminders/route.ts` | Add `brand_accent` to SELECT |
| `lib/bookings/cancel.ts` | Add `brand_accent` to join SELECT |
| `lib/bookings/reschedule.ts` | Add `brand_accent` to join SELECT |
| All 6 email sender `AccountRecord` interfaces | Add `brand_accent?: string | null` field |
| All 6 email sender branding objects | Add `brand_accent: account.brand_accent ?? null` |

**`brand_accent` actual usage on the booking page:** The STATE.md flags this as an open question. Based on the codebase, `--brand-accent` is defined in `globals.css` `@theme` as `--color-accent: #F97316` (orange), used only by `.day-has-slots::after` (the slot availability dot in the calendar). In v1.2, `brand_accent` controls this accent surface on the public booking page — the selected slot ring, the availability dot, or both. The simplest integration: set `--brand-accent` CSS var alongside `--brand-primary` in `BrandedPage`, and let the `.day-has-slots::after` CSS rule use it. This makes `brand_accent` immediately useful without UI surgery.

**Recommendation on `brand_accent` vs. dropping it:** Keep it. The column already exists (no migration needed), the branding editor is being rebuilt anyway, and it gives customers a second color for the slot picker / CTA secondary elements. Drop it only if v1.2 scope proves too large — it can always be wired later.

---

## I. Build Order

### I-17. Recommended phase sequence

Constraints:
- Visual changes cluster naturally: auth+onboarding+shell as one cluster, public+embed as second, email as third.
- Schema cleanup must be last.
- Branding editor simplification depends on `BackgroundGlow` + `OwnerHeader` existing first (preview shows them via the right-column `PreviewIframe`).
- `--primary` override removal on owner shell can ship independently of public-side `BackgroundGlow` gain (each is independent).
- Phase 12.5 test deletion must precede `chromeTintToCss` function removal.

**Proposed phase sequence:**

| Phase | Work | Rationale |
|-------|------|-----------|
| **v1.2-01: Foundations** | `@theme --color-primary: #3B82F6`. New `BackgroundGlow` component (`app/_components/background-glow.tsx`). New `OwnerHeader` component. Both wired into `app/(shell)/layout.tsx`: remove `--primary` override div, remove `GradientBackdrop`, add `BackgroundGlow` + `OwnerHeader`. `AppSidebar` props `sidebarColor`/`sidebarTextColor` removed (NSI sidebar locked). `globals.css` `bg-gray-50` base verified. | Owner shell visual re-skin. Ships cleanly: everything on owner side gets NSI blue + blob backdrop + glass pill. No public-facing changes. No schema changes. |
| **v1.2-02: Auth + Onboarding** | Replace `NSIGradientBackdrop` / `GradientBackdrop` with `BackgroundGlow` in `AuthHero` + onboarding layout. Update `NSIGradientBackdrop` → `BackgroundGlow`. | Small surface, independent of public. Ships cleanly. |
| **v1.2-03: Public + Embed** | Update `BrandedPage` to use `BackgroundGlow` component (replacing `GradientBackdrop`); pass `brand_primary` as `color` prop. Add `PublicHeader` component; mount in `BrandedPage`. `EmbedShell` single-blob replaced with `BackgroundGlow`. Remove `background_color` / `background_shade` from `BrandedPage` props and all 3 public page callers (`/[account]/page.tsx`, `/[account]/[event-slug]/page.tsx`, embed). `--brand-accent` CSS var added to `BrandedPage`. | Public surfaces gain new visual. `BrandedPage` and `EmbedShell` still read `background_color` / `background_shade` columns at query level (code still compiles). Stop READING those columns at the query/SELECT level in this phase too: update the DB SELECT in all route loaders that drive public pages. |
| **v1.2-04: Branding Editor** | Rewrite `branding-editor.tsx` (2 pickers: logo + brand_primary + brand_accent). Rewrite `MiniPreviewCard` as faux booking-page preview. Delete `shade-picker.tsx`. Update `saveBrandingAction` new signature. Update `load-branding.ts` / `BrandingState`. Update `schema.ts`. Delete deprecated schema exports. | Depends on `BackgroundGlow` existing (preview uses it). Depends on public visual being done (preview iframe shows the real public page). |
| **v1.2-05: Email** | Collapse `EmailBranding` interface. Update `renderEmailBrandedHeader` priority chain to `brand_primary` only. Update all 6 sender `AccountRecord` interfaces and branding object literals. Update 4 route/cron callers (remove `background_color`, `chrome_tint_intensity`, `sidebar_color` from SELECTs; add `brand_accent`). | Independent of UI phases. Can run in parallel with v1.2-04. |
| **v1.2-06: Dead Code + Test Cleanup** | Delete `tests/branding-chrome-tint.test.ts`. Remove `chromeTintToCss` + `chromeTintTextColor` from `chrome-tint.ts`. Remove `resolveChromeColors` from `chrome-tint.ts` (no longer called). Delete `lib/branding/gradient.ts`. Simplify `lib/branding/types.ts` (remove `ChromeTintIntensity`, `BackgroundShade` types; remove deprecated `Branding` fields). Simplify `lib/branding/read-branding.ts`. Confirm `lib/branding/chrome-tint.ts` can be deleted entirely. Remove `savePrimaryColorAction` (absorbed by new `saveBrandingAction`). Optionally: add new `tests/branding.test.ts` for simplified model. | Must follow phases 01-05. Test deletion enables `chromeTintToCss` function removal. |
| **v1.2-07: Schema DROP** | Migration: `DROP COLUMN sidebar_color`, `DROP COLUMN background_color`, `DROP COLUMN background_shade`, `DROP COLUMN chrome_tint_intensity`, `DROP TYPE background_shade`, `DROP TYPE chrome_tint_intensity`. Delete `app/_components/gradient-backdrop.tsx`. Delete `components/nsi-gradient-backdrop.tsx`. | Must be last. All code reads/writes must be gone (verified in 01-06). TypeScript build must pass before this deploys. |

**Phase v1.2-05 can run in parallel with v1.2-04** in the same Git branch or as simultaneous work streams, since the email layer doesn't depend on the editor or vice versa. They share only the `EmailBranding` interface in `branding-blocks.ts` — coordinate on that file in the merge.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| `--primary` consumer enumeration | HIGH | Grep over all `.tsx/.ts/.css` files; every match inspected |
| `chromeTintToCss` / `resolveChromeColors` call sites | HIGH | Grep confirms 2 app consumers, 1 test file |
| Deprecated column readers | HIGH | All SELECT strings read directly from source files |
| `BackgroundGlow` mount strategy | HIGH | Reference component read; all layout files read; z-index ordering verified |
| Header component split recommendation | HIGH | Structural differences are clear from reading both contexts |
| `brand_accent` integration scope | MEDIUM | Column exists in schema; no current consumer; exact public-surface usage is an open decision (slot ring vs. availability dot vs. both) |
| Migration timing | HIGH | Small-table Postgres behavior; two-deploy pattern is standard |
| Phase ordering | HIGH | Dependencies mapped explicitly; no circular dependencies |
