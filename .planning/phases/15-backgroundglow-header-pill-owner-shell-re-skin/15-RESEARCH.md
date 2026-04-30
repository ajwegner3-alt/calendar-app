# Phase 15: BackgroundGlow + Header Pill + Owner Shell Re-Skin - Research

**Researched:** 2026-04-30
**Domain:** Next.js shell layout re-skin — CSS/Tailwind ambient glow, glass pill header, sidebar glass treatment, card standardization, Phase 12.6 chrome removal
**Confidence:** HIGH (all findings from direct codebase inspection + reference UI; no external library unknowns)

---

## Summary

Phase 15 is a pure visual re-skin of the owner shell (`app/(shell)/layout.tsx` + `AppSidebar`) with two new components (`BackgroundGlow`, `Header`). The reference UI (`lead-scoring-with-tools/website-analysis-tools/`) was successfully located and read verbatim. All CSS values for `BackgroundGlow` and `Header` are exact strings from that reference — no approximation needed.

The call graph for Phase 12.6 chrome removal is narrow: `resolveChromeColors` is imported only in `app/(shell)/layout.tsx`. `GradientBackdrop` has three other consumers (`branded-page.tsx`, `listing-hero.tsx`, `nsi-gradient-backdrop.tsx`) that are NOT touched by this phase. `AppSidebar` is the only component that takes `sidebarColor`/`sidebarTextColor` props; removing those props is safe and self-contained.

Card standardization (OWNER-10) touches 9 distinct locations with 4 different current class patterns (`rounded-xl border bg-white`, `rounded-lg border bg-card`, `border rounded-lg`, `bg-card p-6`). The locked target from CONTEXT.md is `rounded-lg` (not `rounded-xl` as REQUIREMENTS.md OWNER-10 states) — see Conflict Resolution below.

`lib/brand.ts` does NOT exist. MN-02 requires creating it with a `WORDMARK` constant.

**Primary recommendation:** Implement in exactly 2 plans as scoped. Plan 15-01 creates the two new components (no layout changes). Plan 15-02 re-skins the shell, strips Phase 12.6 hooks, and standardizes cards. Wave parallelization opportunities exist within 15-02.

---

## CONFLICT RESOLUTION (planner must act on this)

**OWNER-10 rounded-xl vs CONTEXT.md rounded-lg:**

- REQUIREMENTS.md OWNER-10 specifies `rounded-xl border border-gray-200 bg-white p-6 shadow-sm`
- CONTEXT.md (locked user decision) specifies `rounded-lg` for card radius

**Resolution: CONTEXT.md wins.** The locked card target class string is:
```
rounded-lg border border-gray-200 bg-white p-6 shadow-sm
```

The planner must update OWNER-10 acceptance criteria to use `rounded-lg` and note the deviation from the original requirement text.

---

## CONFLICT RESOLUTION: HDR-08 LogoutButton placement

- REQUIREMENTS.md HDR-08: "Owner variant on shell pages: integrates `LogoutButton` on right side"
- CONTEXT.md (locked decision HDR-08): "LogoutButton stays in sidebar footer per HDR-08"

These contradict. CONTEXT.md is the locked decision. **Resolution: LogoutButton stays in `AppSidebar`'s `<SidebarFooter>` exactly where it is now.** The planner must note that HDR-08 in REQUIREMENTS.md is superseded by CONTEXT.md and the Header right-side slot is unused (or holds only the optional context label from HDR-04).

---

## Standard Stack

No new library installations required. All needed tools are already in the project:

### Core (already installed)
| Library | Already in Project | Purpose in this Phase |
|---------|-------------------|----------------------|
| Next.js 15/16 | Yes | Server Components, `usePathname` |
| Tailwind CSS v4 | Yes | All class-driven styling |
| shadcn/ui Sidebar | Yes | `SidebarTrigger` in pill on mobile |
| `next/link` | Yes | Wordmark as link to `/app` |
| `next/navigation` | Yes | `usePathname` for context label |

### No new installs needed
The BackgroundGlow component uses only inline `style` (per JIT lock MP-04) and standard Tailwind classes. The Header uses shadcn `SidebarTrigger` already imported in layout.

---

## Reference UI: Exact Values (HIGH confidence)

Reference located at: `C:\Users\andre\OneDrive - Creighton University\Desktop\Claude-Code-Projects\lead-scoring-with-tools\website-analysis-tools\app\components\`

### BackgroundGlow — verbatim from reference

Reference uses `position: fixed` (outer wrapper) with two absolutely-positioned blobs. Per GLOW-03/CP-06, the calendar-app version uses `position: absolute` (not `fixed`) inside `SidebarInset`. The blob-level positioning and styles are identical to the reference:

**Blob 1:**
```tsx
// position
top: '-32px'
left: 'calc(50% + 580px)'
transform: 'translateX(-50%)'
// style
w-80 h-80 rounded-full opacity-40 blur-[160px]
background: 'linear-gradient(to top right, #3B82F6, transparent)'
```

**Blob 2:**
```tsx
// position
top: '420px'
left: 'calc(50% + 380px)'
transform: 'translateX(-50%)'
// style
w-80 h-80 rounded-full opacity-[0.35] blur-[160px]
background: 'linear-gradient(to top right, #3B82F6, #111827)'
```

**BackgroundGlow outer wrapper (adapted from reference's `fixed` to `absolute`):**
```tsx
// reference uses: className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
// calendar-app uses absolute (CP-06 requirement):
<div
  className="pointer-events-none absolute inset-0 overflow-hidden"
  aria-hidden="true"
>
```

Note: Reference wraps blobs in `fixed inset-0`. Calendar-app version wraps in `absolute inset-0` because it lives inside `SidebarInset` which has `relative overflow-hidden`. The blob pixel offsets (e.g., `left: 'calc(50% + 580px)'`) reference the viewport/container center — these will reference `SidebarInset` width (correct behavior for the owner shell).

### Header pill — verbatim from reference

```tsx
// Outer wrapper (exact from reference):
<header className="fixed top-2 md:top-6 left-0 right-0 z-30 px-4">
  <div className="max-w-[1152px] mx-auto h-14 px-4 rounded-2xl flex items-center justify-between bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]">
    ...
  </div>
</header>
```

Wordmark (exact from reference, adapted for `/app` link):
```tsx
<Link href="/app" className="text-lg font-extrabold tracking-[-0.04em]">
  <span className="text-gray-900">North</span>
  <span className="text-blue-500">Star</span>
</Link>
```

Context label (exact from reference):
```tsx
{label && (
  <span className="text-[13px] font-medium text-gray-500">
    {label}
  </span>
)}
```

**Reference scroll behavior:** The pill is `fixed` — always visible. This matches CONTEXT.md "always-visible / fixed at top" expectation. The "hide-on-scroll" deferred idea is confirmed out of scope.

**Reference mobile behavior:** The reference has NO mobile hamburger (it's a marketing site, not an app shell). For the calendar-app owner shell, per HDR-07, a `SidebarTrigger` at `md:hidden` goes inside the pill. The reference has a two-item layout (`Link` left, label right) — for the owner shell: (`Link` + `SidebarTrigger` at md:hidden) on left, context label on right. Or more precisely: SidebarTrigger is `md:hidden` so on desktop the pill looks identical to reference.

---

## Architecture Patterns

### New File Structure

```
app/
├── _components/
│   ├── gradient-backdrop.tsx   # EXISTING — do not touch
│   ├── branded-page.tsx        # EXISTING — do not touch
│   ├── token-not-active.tsx    # EXISTING — do not touch
│   ├── background-glow.tsx     # NEW (15-01) — GLOW-01..05
│   └── header.tsx              # NEW (15-01) — HDR-01..08
lib/
└── brand.ts                    # NEW (15-01) — MN-02 wordmark constant
```

### Pattern 1: BackgroundGlow as Server Component

The reference `BackgroundGlow.tsx` has no `'use client'` directive and no hooks. Per GLOW-05, keep it as a Server Component — no `useState`, no `useEffect`, no props that need client-side evaluation. The optional `color?: string` prop (GLOW-02) defaults to `#3B82F6` at the component definition level (default parameter), satisfying server-side rendering with no client state.

```tsx
// app/_components/background-glow.tsx
// NO 'use client' directive — Server Component per GLOW-05

interface BackgroundGlowProps {
  color?: string;
}

export function BackgroundGlow({ color = "#3B82F6" }: BackgroundGlowProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute w-80 h-80 rounded-full opacity-40 blur-[160px]"
        style={{
          top: '-32px',
          left: 'calc(50% + 580px)',
          transform: 'translateX(-50%)',
          background: `linear-gradient(to top right, ${color}, transparent)`,
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full opacity-[0.35] blur-[160px]"
        style={{
          top: '420px',
          left: 'calc(50% + 380px)',
          transform: 'translateX(-50%)',
          background: `linear-gradient(to top right, ${color}, #111827)`,
        }}
      />
    </div>
  );
}
```

JIT lock (MP-04): runtime `color` is passed via `style={{ background: \`...\` }}`, never via `bg-[${color}]`. Compliant.

### Pattern 2: Header as Client Component

The reference `Header.tsx` uses `'use client'` + `usePathname()`. Per HDR-04, the owner variant derives the context label from the pathname. Per HDR-07, mobile `SidebarTrigger` integration requires `SidebarTrigger` from shadcn, which is already a client component. Therefore `header.tsx` must be `'use client'`.

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';

function getContextLabel(pathname: string): string {
  if (pathname === '/app') return 'Dashboard';
  if (pathname.startsWith('/app/event-types')) return 'Event Types';
  if (pathname.startsWith('/app/availability')) return 'Availability';
  if (pathname.startsWith('/app/bookings')) return 'Bookings';
  if (pathname.startsWith('/app/branding')) return 'Branding';
  if (pathname.startsWith('/app/settings')) return 'Settings';
  return '';
}

export function Header() {
  const pathname = usePathname();
  const label = getContextLabel(pathname);

  return (
    <header className="fixed top-2 md:top-6 left-0 right-0 z-30 px-4">
      <div className="max-w-[1152px] mx-auto h-14 px-4 rounded-2xl flex items-center justify-between bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Link href="/app" className="text-lg font-extrabold tracking-[-0.04em]">
            <span className="text-gray-900">North</span>
            <span className="text-blue-500">Star</span>
          </Link>
        </div>
        {label && (
          <span className="text-[13px] font-medium text-gray-500">
            {label}
          </span>
        )}
      </div>
    </header>
  );
}
```

Note: `variant="owner"` prop (HDR-01 mentions "Owner variant") is optional — since there's only one variant used in the shell layout and the requirements show a single `Header` usage, implementing it without a `variant` prop is cleaner. If future phases need a public variant, the prop can be added then. The planner can decide either way; this is low-risk either direction.

### Pattern 3: Shell Layout After Re-skin

Current `app/(shell)/layout.tsx` has these removals and additions:

**Remove:**
1. `import { GradientBackdrop } from "@/app/_components/gradient-backdrop"` 
2. `import { getBrandingForAccount } from "@/lib/branding/read-branding"`
3. `import { resolveChromeColors } from "@/lib/branding/chrome-tint"`
4. `import { SidebarTrigger } from "@/components/ui/sidebar"` (no longer needed directly in layout — now inside Header)
5. The `branding` fetch (`getBrandingForAccount(account.id)`)
6. The `chrome` resolve (`resolveChromeColors(branding)`)
7. Outer `<div style={{ "--primary": ... }}>` wrapper (OWNER-01)
8. `<GradientBackdrop ...>` render (OWNER-04)
9. `<div className="fixed top-3 left-3 z-20 md:hidden"><SidebarTrigger /></div>` (OWNER-05)
10. `sidebarColor` and `sidebarTextColor` props from `<AppSidebar>` (OWNER-02)
11. `style={{ backgroundColor: chrome.pageColor ?? undefined }}` from `<SidebarInset>` (OWNER-03)
12. `sidebar_color, background_color, background_shade, chrome_tint_intensity` from SELECT (OWNER-11)

**Trim accounts SELECT to:**
```ts
.select("id, slug, brand_primary")
```
(Only `id` for `getBrandingForAccount` is removed too — `brand_primary` not needed either. Actually, with all chrome logic removed, the layout only needs `id` for the redirect check and `email` from claims. The accounts SELECT can be trimmed to just `.select("id")` or removed entirely if `email` comes from claims already — email IS from claims: `claimsData.claims.email`. So the accounts SELECT is only needed for the redirect guard and `account.id` check. Simplest trim: `.select("id")`.)

**Add:**
1. `import { BackgroundGlow } from "@/app/_components/background-glow"`
2. `import { Header } from "@/app/_components/header"`
3. `<Header />` before `<SidebarProvider>` (or inside, at layout root — see Z-index section)
4. `<BackgroundGlow />` inside `<SidebarInset>` where `<GradientBackdrop>` was
5. `className="bg-gray-50"` on `<SidebarInset>` (OWNER-07)
6. `pt-20 md:pt-24 pb-12` content padding on `<main>` (OWNER-06)

**Resulting shell layout structure:**
```tsx
return (
  <TooltipProvider delayDuration={0}>
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar email={email} />
      <SidebarInset className="relative overflow-hidden bg-gray-50">
        <BackgroundGlow />
        <Header />
        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6 md:pt-24 pb-12">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  </TooltipProvider>
);
```

Wait — `<Header />` is `fixed` positioned, so it doesn't need to be inside `SidebarInset` for layout purposes. However, keeping it inside `SidebarInset` (as a sibling to `BackgroundGlow` and `main`) is fine because `fixed` positioning detaches from the document flow entirely regardless of parent. The pill's `z-30` ensures it sits above everything. Placing `<Header />` inside `SidebarInset` is the cleaner pattern because it keeps all owner shell UI in one place.

### Pattern 4: AppSidebar After Strip

Remove from `AppSidebar`:
1. `sidebarColor` and `sidebarTextColor` props from the interface
2. The `style={{ backgroundColor: sidebarColor ?? undefined, ...}}` from `<Sidebar>`

The sidebar falls back to shadcn `--sidebar` token (`#F8FAFC` from globals.css `@theme`) with no inline style — this is the clean default.

**Glass sidebar treatment (Claude's Discretion):** The sidebar currently uses the `--sidebar` token (`#F8FAFC` — nearly white, from globals.css). To achieve the glass/translucent look specified in CONTEXT.md so the glow shows through:

The shadcn `<Sidebar>` component applies `--sidebar` as its background via CSS variable. To make it translucent, override `--sidebar` in globals.css to a semi-transparent value, OR apply `bg-white/80 backdrop-blur-sm` via the `className` prop on `<Sidebar>`.

Recommendation: Add `className="bg-white/80 backdrop-blur-sm"` to `<Sidebar>` in AppSidebar. This overrides the `--sidebar` background token with a translucent white, and the backdrop-blur makes the glow visible through it. This harmonizes with the pill's `bg-white/90 backdrop-blur-sm`.

**Sidebar opacity choice:** `bg-white/80` (80% opacity) vs `bg-white/90` (90% opacity, same as pill). Using `bg-white/80` gives more glow bleed-through for the sidebar while `bg-white/90` gives more glow bleed-through for the pill. The difference is subtle. Recommendation: `bg-white/85` (sidebar slightly more transparent than pill) — but Tailwind v4 may not have `/85` as a built-in step. Use `bg-white/80` (confirmed Tailwind step).

**Sidebar/main divider (Claude's Discretion):** The shadcn sidebar already renders a border on its right edge via `--sidebar-border: #E2E8F0` (from globals.css `@theme`). With the glass sidebar, this border naturally creates the divider. No additional divider class needed. Recommendation: keep the existing `--sidebar-border` token and do not add any extra divider styling — the natural border between the translucent sidebar and the `bg-gray-50` main area provides sufficient visual separation.

### Pattern 5: Sidebar Footer (Claude's Discretion)

Current `AppSidebar` footer already has:
1. Email display (`px-2 py-1 text-xs text-muted-foreground truncate`)
2. Logout form button

This is already a complete account block + logout pattern. **Recommendation: keep exactly as-is.** No changes to the footer composition. LogoutButton stays in sidebar footer per CONTEXT.md lock.

### Pattern 6: Z-index Layering

```
Layer 0: BackgroundGlow (no z-index, absolute inset-0, behind everything)
Layer 10: main content (z-10, relative)
Layer 20: [freed — old mobile SidebarTrigger div, now removed]
Layer 30: Header pill (z-30, fixed — shadcn sidebar likely z-20 internally)
```

The shadcn sidebar itself renders at z-20 by default on mobile (as a sheet/overlay). The pill at z-30 sits above the sidebar overlay on mobile — correct, since the pill is the brand identity layer and the sidebar slides beneath it.

Verify: when the sidebar is open on mobile (full-screen drawer), does it cover the pill? With z-30 on the pill and z-20 on the sidebar, the pill stays visible above the open drawer. This may be desired (brand always visible) or may obscure the close button. Consider: if shadcn's mobile sidebar sheet uses a higher z-index than z-20, the pill may be occluded. The planner should add a verification step to check z-index behavior on mobile with the drawer open.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime hex in classnames | `bg-[${color}]` | `style={{ background: ... }}` | Tailwind v4 JIT won't compile dynamic class segments (Phase 7 pitfall, already documented in existing code) |
| Mobile sidebar | Custom drawer | shadcn `SidebarTrigger` + `SidebarProvider` | Already implemented; off-canvas behavior is built in |
| Backdrop blur glass effect | Custom CSS | `backdrop-blur-sm bg-white/80` Tailwind classes | Tailwind has these; no custom CSS needed |
| Wordmark constant | Inline string in component | `lib/brand.ts` constant | MN-02 requires single source of truth |

---

## Current Card Class Audit (OWNER-10)

Full mapping of existing card class patterns across affected files:

| File | Current Classes | Target (OWNER-10 locked) |
|------|-----------------|--------------------------|
| `app/(shell)/app/page.tsx` line 111 | `rounded-xl border bg-white p-6 text-center` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center` |
| `app/(shell)/app/page.tsx` line 121 | `rounded-xl border bg-white p-4 sm:p-6` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm` |
| `app/(shell)/app/event-types/_components/event-types-table.tsx` line 30 | `border rounded-lg overflow-hidden` | `rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm` |
| `app/(shell)/app/bookings/_components/bookings-table.tsx` line 44 | `border rounded-lg p-12 text-center` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center` |
| `app/(shell)/app/bookings/_components/bookings-table.tsx` line 54 | `border rounded-lg overflow-hidden` | `rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm` |
| `app/(shell)/app/bookings/[id]/page.tsx` line 186 | `rounded-lg border bg-card p-6` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm` |
| `app/(shell)/app/bookings/[id]/page.tsx` line 245 | `rounded-lg border bg-card p-6` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm` |
| `app/(shell)/app/bookings/[id]/page.tsx` line 251 | `rounded-lg border bg-card p-6` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm` |
| `app/(shell)/app/bookings/[id]/page.tsx` line 259 | `rounded-lg border bg-card p-6` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm` |
| `app/(shell)/app/settings/profile/page.tsx` line 34 | `rounded-lg border bg-card p-6 space-y-3` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3` |
| `app/(shell)/app/settings/profile/page.tsx` line 50 | `rounded-lg border bg-card p-6 space-y-3` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3` |
| `app/(shell)/app/settings/profile/page.tsx` line 59 | `rounded-lg border bg-card p-6 space-y-3` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3` |
| `app/(shell)/app/settings/profile/page.tsx` line 68 | `rounded-lg border bg-card p-6 space-y-3` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3` |
| `app/(shell)/app/settings/profile/email/page.tsx` line 50 | `rounded-lg border bg-card p-6 space-y-4` | `rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4` |

**Not in OWNER-10 scope (keep as-is):**
- `app/(shell)/app/unlinked/page.tsx` — uses shadcn `<Card>` component (already correct semantically; OWNER-10 is about div-based cards)
- Branding page — no top-level card divs (uses `BrandingEditor` component)
- Availability page — no card divs at page level (sections with `<h2>` headings, no wrapper cards)

**Exceptions — do NOT standardize (destructive/muted variants are intentional):**
- `app/(shell)/app/settings/profile/delete-account-section.tsx` line 48: `rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-4` — danger zone styling, intentional
- `app/(shell)/app/bookings/[id]/page.tsx` line 167: `rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm` — cancellation alert banner, not a content card

**OWNER-09: HomeCalendar DayButton dot color:**

Current (line 99 of `home-calendar.tsx`):
```tsx
"var(--brand-primary, hsl(var(--primary)))"
```

Target:
```tsx
"hsl(var(--primary))"
```

This is a one-line change in `app/(shell)/app/_components/home-calendar.tsx`.

---

## Common Pitfalls

### Pitfall 1: BackgroundGlow absolute vs fixed breaks scroll height
**What goes wrong:** If `SidebarInset` does not have `overflow-hidden`, the absolute-positioned glow blobs (especially blob 2 at `top: 420px`) extend the scrollable area, adding phantom scroll space below content.
**Why it happens:** `absolute` positioning inside a non-overflow-hidden parent contributes to scroll height. `fixed` positioning (reference UI) does not.
**How to avoid:** `SidebarInset` must have `overflow-hidden`. Current layout already has `className="relative overflow-hidden bg-background"` — keep `overflow-hidden` when changing `bg-background` to `bg-gray-50`.
**Warning sign:** Page scrolls past visible content on short pages.

### Pitfall 2: JIT lock — runtime hex in Tailwind class
**What goes wrong:** Writing `bg-[${color}]` where color is a runtime variable causes Tailwind v4 JIT to not compile the class (it only purges/compiles classes seen at build time).
**Why it happens:** Tailwind v4 JIT cannot enumerate runtime values.
**How to avoid:** The `BackgroundGlow` component uses `style={{ background: \`linear-gradient(..., ${color}, ...)\` }}` for runtime color. All Tailwind classes in the component are static (`w-80 h-80 rounded-full blur-[160px]`).
**Warning sign:** Glow blobs appear unstyled or wrong color in production but work in dev (dev may fall back differently).

### Pitfall 3: `--primary` override removal cascades to HomeCalendar dots
**What goes wrong:** Removing the `style={{ "--primary": chrome.primaryColor }}` wrapper div means the only source of `--primary` is the `@theme` token `--color-primary: #3B82F6`. HomeCalendar's dots use `hsl(var(--primary))` — but `--primary` in this codebase is `oklch(0.205 0 0)` (near-black) from the `:root` block. The `@theme { --color-primary: #3B82F6 }` sets `--color-primary` (Tailwind token), not `--primary` (CSS variable).
**Wait — actual investigation:** Looking at `globals.css`:
- `:root { --primary: oklch(0.205 0 0); }` (shadcn default, near-black)
- `@theme { --color-primary: #3B82F6; }` (Tailwind token, blue)
- The shell layout currently sets `style={{ "--primary": chrome.primaryColor }}` which overrides the `:root` `--primary` for owner pages to the brand color (usually the default `#3B82F6`)

After removal, `--primary` on owner pages reverts to `oklch(0.205 0 0)` (near-black). This would break:
- Button primary color (`bg-primary`)
- HomeCalendar dots (if using `hsl(var(--primary))`)
- Any shadcn component using `--primary`

**Resolution required:** Either (a) update `:root { --primary }` to the NSI blue value directly in globals.css, or (b) confirm that Phase 14's `@theme { --color-primary: #3B82F6 }` token feeds into the shadcn `--primary` CSS variable somehow.

**Verification needed:** Check if `@theme { --color-primary }` and `:root { --primary }` are linked. Looking at globals.css `@theme inline` block: `--color-primary: var(--primary)` — this maps Tailwind's `--color-primary` to the CSS `--primary` variable, but does NOT set the CSS `--primary` variable.

**Conclusion:** After removing `style={{ "--primary": chrome.primaryColor }}`, `:root { --primary: oklch(0.205 0 0) }` takes effect on the owner shell — turning primary buttons dark/black. This is a regression.

**Fix:** In globals.css, update `:root { --primary }` to the NSI blue oklch value, OR add to `@layer base { :root { --primary: oklch(0.6 0.2 264); } }` (approximate oklch for `#3B82F6`). Alternatively, since Phase 14 already added `--color-primary: #3B82F6` to `@theme`, check if there's a way to set `--primary` directly.

**Simplest fix:** In globals.css `:root`, change `--primary: oklch(0.205 0 0)` to the oklch equivalent of `#3B82F6`. The value is approximately `oklch(0.6 0.22 264.4)`. The planner should add this as an explicit task in 15-02.

This pitfall is **critical** — without it, removing the `--primary` wrapper will break all primary-colored shadcn components on owner pages.

### Pitfall 4: SidebarTrigger z-index on mobile with fixed pill
**What goes wrong:** With `Header` at `z-30` (fixed) and the shadcn sidebar mobile sheet at its default z-index, the pill may appear on top of the sidebar overlay's close/hamburger area on mobile, or the sidebar sheet may appear above the pill.
**Why it happens:** shadcn Sidebar uses Radix Dialog for mobile, which typically uses `z-50` or higher for the overlay.
**How to avoid:** Verify after implementation by opening the mobile sidebar and checking if the pill remains visually correct. The SidebarTrigger inside the pill (at `z-30`) may become partially covered by the sidebar overlay — acceptable since the trigger's purpose is to open the sidebar; once open, the pill doesn't need to be interactive.
**Warning sign:** Pill appears behind the mobile sidebar overlay, making the wordmark invisible when the drawer is open.

### Pitfall 5: `getBrandingForAccount` uses admin client — removing it drops an admin client import
**What goes wrong:** Simply removing `import { getBrandingForAccount }` from layout.tsx without checking if `createAdminClient` is called elsewhere in the same file could leave a dangling import or, conversely, be fine.
**Reality:** The shell layout currently imports `getBrandingForAccount` from `@/lib/branding/read-branding`. Removing this import is safe — no other admin client usage is in `layout.tsx`. The admin client stays available via `read-branding.ts` for other consumers (email, embed, public booking page).

### Pitfall 6: `GradientBackdrop` still used by other consumers — do NOT delete it
**Call graph — GradientBackdrop consumers:**
1. `app/(shell)/layout.tsx` — REMOVE (Phase 15 scope)
2. `app/_components/branded-page.tsx` — KEEP (public booking page)
3. `app/[account]/_components/listing-hero.tsx` — KEEP (public account listing)
4. `components/nsi-gradient-backdrop.tsx` — KEEP (auth pages via NSIGradientBackdrop)

**Do not delete** `gradient-backdrop.tsx`. Only remove its import/usage from `(shell)/layout.tsx`.

---

## Code Examples

### BackgroundGlow component (verified against reference)

```tsx
// app/_components/background-glow.tsx
// Source: lead-scoring-with-tools/website-analysis-tools/app/components/BackgroundGlow.tsx
// Adapted: fixed → absolute (CP-06), color prop added (GLOW-02)

interface BackgroundGlowProps {
  color?: string;
}

export function BackgroundGlow({ color = "#3B82F6" }: BackgroundGlowProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute w-80 h-80 rounded-full opacity-40 blur-[160px]"
        style={{
          top: '-32px',
          left: 'calc(50% + 580px)',
          transform: 'translateX(-50%)',
          background: `linear-gradient(to top right, ${color}, transparent)`,
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full opacity-[0.35] blur-[160px]"
        style={{
          top: '420px',
          left: 'calc(50% + 380px)',
          transform: 'translateX(-50%)',
          background: `linear-gradient(to top right, ${color}, #111827)`,
        }}
      />
    </div>
  );
}
```

### lib/brand.ts (new file — MN-02)

```ts
// lib/brand.ts
// Single source of truth for NSI wordmark display strings.
// Consumed by Header component (and future consumers).

export const WORDMARK = {
  prefix: "North",
  suffix: "Star",
  full: "NorthStar",
} as const;
```

### AppSidebar after strip

Key changes only:
```tsx
// Remove from interface:
// sidebarColor: string | null;
// sidebarTextColor: "#ffffff" | "#000000" | null;

// New interface:
interface AppSidebarProps {
  email: string;
}

// Remove style prop from <Sidebar>:
// Before: style={{ backgroundColor: sidebarColor ?? undefined, ... }}
// After (glass treatment):
<Sidebar
  collapsible="icon"
  className="bg-white/80 backdrop-blur-sm"
>
```

### HomeCalendar dot color fix (OWNER-09)

```tsx
// Before (line 99 of home-calendar.tsx):
backgroundColor: isSelected
  ? "currentColor"
  : "var(--brand-primary, hsl(var(--primary)))",

// After:
backgroundColor: isSelected
  ? "currentColor"
  : "hsl(var(--primary))",
```

---

## State of the Art

| Old Approach | Current Approach | Phase | Impact |
|--------------|------------------|-------|--------|
| `GradientBackdrop` with per-account colors in shell | `BackgroundGlow` with fixed NSI blue | Phase 15 | Removes per-account theming from owner shell |
| `<div style={{ "--primary": ... }}>` wrapper | No wrapper; `--primary` set globally in CSS | Phase 15 | Simplifies layout, requires globals.css fix |
| `sidebarColor`/`sidebarTextColor` props on AppSidebar | Hardcoded glass treatment | Phase 15 | Removes Phase 12.6 chrome prop chain |
| Mobile-only floating SidebarTrigger | SidebarTrigger inside fixed Header pill | Phase 15 | Unified header across viewport sizes |
| `bg-card` mixed with `bg-white` in owner cards | Uniform `bg-white border-gray-200 shadow-sm` | Phase 15 | Visual consistency |

**Deprecated/outdated after Phase 15:**
- `resolveChromeColors` — no longer called from shell layout (still exported, other consumers could use it, but practically orphaned after Phase 15)
- `getBrandingForAccount` in shell layout — removed
- `accounts.sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` columns in shell SELECT — trimmed

---

## Plan Shape Recommendation

**Keep the 2-plan split as scoped.** The split is clean and logical:

**15-01: Component creation** (zero risk — no layout modification)
- Create `app/_components/background-glow.tsx`
- Create `app/_components/header.tsx`
- Create `lib/brand.ts`
- No changes to shell layout or AppSidebar

**15-02: Shell re-skin + card standardization** (higher risk — touches layout and 14 card locations)
- Shell layout re-skin (OWNER-01..08, OWNER-11)
- globals.css `--primary` fix (critical, see Pitfall 3)
- AppSidebar prop strip (OWNER-02)
- HomeCalendar dot fix (OWNER-09)
- Card standardization across 14 locations (OWNER-10)

**Wave parallelization in 15-02:**
- Wave A: globals.css `--primary` fix + shell layout re-skin (must be done together, one file each)
- Wave B (parallel after Wave A): AppSidebar strip | HomeCalendar dot fix | Card standardization (independent files, no cross-dependencies)

Cards across different page files are independent of each other and can be parallelized within Wave B.

**No need for a 3rd plan.** The card standardization is mechanical (find/replace with exact strings catalogued above) and belongs in 15-02.

---

## Open Questions

1. **`--primary` CSS variable value in globals.css**
   - What we know: `:root { --primary: oklch(0.205 0 0) }` (near-black) in the app's globals.css. `@theme { --color-primary: #3B82F6 }` (NSI blue) exists but maps Tailwind token, not the CSS variable directly.
   - What's unclear: The exact oklch value of `#3B82F6` that should replace `oklch(0.205 0 0)` in `:root`.
   - Recommendation: Convert `#3B82F6` to oklch. Approximate: `oklch(0.606 0.195 264.5)`. Planner should include this CSS change as an explicit task in 15-02, Wave A, alongside the layout re-skin. Verify by checking a primary button color after deployment.

2. **shadcn Sidebar z-index on mobile**
   - What we know: Header pill uses `z-30`. Reference UI has no sidebar. shadcn mobile sidebar typically renders as a Sheet at `z-50` or higher via Radix Dialog.
   - What's unclear: Exact z-index of shadcn Sidebar mobile Sheet in this installation.
   - Recommendation: Add a visual verification step in 15-02 plan: "Open sidebar on mobile — confirm pill is visible/usable above drawer." If the pill is occluded, raise its z-index to `z-50` (matching or exceeding Radix Dialog default).

3. **`variant="owner"` prop on Header**
   - What we know: REQUIREMENTS.md HDR-01 mentions "Owner variant" for the pill. Currently there's only one usage context (the owner shell). The reference UI has no variants.
   - What's unclear: Whether a `variant` prop is needed now or is future scope.
   - Recommendation: Skip the `variant` prop for Phase 15. Build a single-purpose `Header` component targeting the owner shell. Add variant support if a second usage context emerges. This avoids premature abstraction.

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `lead-scoring-with-tools/website-analysis-tools/app/components/BackgroundGlow.tsx` — exact blob positions, opacities, gradient strings
- Direct file read: `lead-scoring-with-tools/website-analysis-tools/app/components/Header.tsx` — exact pill classes, wordmark pattern
- Direct file read: `calendar-app/app/(shell)/layout.tsx` — current shell composition
- Direct file read: `calendar-app/components/app-sidebar.tsx` — current prop interface
- Direct file read: `calendar-app/app/globals.css` — CSS variable values, `--color-primary` token, `--sidebar` tokens
- Direct file read: `calendar-app/lib/branding/chrome-tint.ts` — `resolveChromeColors` call graph
- Direct grep: all `resolveChromeColors`, `GradientBackdrop` consumers across codebase

### Secondary (MEDIUM confidence)
- Tailwind v4 JIT dynamic class limitation — documented in existing codebase comments (`gradient-backdrop.tsx` line 17) and Phase 7 institutional knowledge

### Tertiary (LOW confidence)
- shadcn Sidebar mobile z-index behavior — based on general knowledge of Radix Dialog; not verified against installed component source

---

## Metadata

**Confidence breakdown:**
- Reference UI values: HIGH — read verbatim from source files
- Call graph (GradientBackdrop, resolveChromeColors): HIGH — exhaustive grep
- Card class inventory: HIGH — direct file reads
- `--primary` CSS variable regression: HIGH — direct reading of globals.css confirms risk
- Sidebar glass treatment: HIGH — Tailwind classes are standard
- shadcn mobile z-index: LOW — not verified against installed component

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable reference UI unlikely to change; codebase stable)
