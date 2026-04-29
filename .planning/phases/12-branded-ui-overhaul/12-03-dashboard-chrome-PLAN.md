---
phase: 12-branded-ui-overhaul
plan: 03
type: execute
wave: 2
depends_on: ["12-01"]
files_modified:
  - app/layout.tsx
  - app/globals.css
  - app/(shell)/layout.tsx
  - app/(shell)/_components/floating-header-pill.tsx
  - components/app-sidebar.tsx
autonomous: true

must_haves:
  truths:
    - "Dashboard root layout uses Inter font (next/font/google) with --font-sans variable + tracking-tight default"
    - "Dashboard surfaces use bg-gray-50 page background + gray-900 primary text (Cruip Simple Light baseline)"
    - "A floating glass header pill renders fixed top-2 md:top-6 on every dashboard route, with hamburger trigger on mobile"
    - "Sidebar IA is a single flat list: Home / Event Types / Availability / Bookings / Branding / Settings"
    - "Settings is an inline accordion item — clicking expands Reminders + Profile underneath; clicking again collapses; defaults open when pathname.startsWith('/app/settings')"
    - "Mobile sidebar opens as a full-screen drawer (--sidebar-width-mobile: 100vw) when hamburger tapped"
    - "Account page background renders the GradientBackdrop primitive consuming the account's background_color + background_shade tokens"
  artifacts:
    - path: "app/layout.tsx"
      provides: "Root layout with Inter font wired via next/font/google"
      contains: "Inter"
    - path: "app/globals.css"
      provides: "@theme block updated with --background gray-50 + --sidebar-width-mobile 100vw"
      contains: "--sidebar-width-mobile"
    - path: "app/(shell)/layout.tsx"
      provides: "Shell layout with floating glass header pill + GradientBackdrop wrapper consuming account branding"
      contains: "FloatingHeaderPill"
    - path: "app/(shell)/_components/floating-header-pill.tsx"
      provides: "Cruip-pattern fixed-position glass header"
      exports: ["FloatingHeaderPill"]
    - path: "components/app-sidebar.tsx"
      provides: "Refactored sidebar: flat list + Settings inline accordion + Home item + reordered"
      contains: "Home|Event Types|Availability|Bookings|Branding|Settings"
  key_links:
    - from: "app/layout.tsx"
      to: "next/font/google"
      via: "Inter import + className on <html>"
      pattern: "Inter\\("
    - from: "app/(shell)/layout.tsx"
      to: "lib/branding/read-branding.ts"
      via: "Server-side fetch of account branding for current user"
      pattern: "readBrandingForAccount|background_color"
    - from: "app/(shell)/layout.tsx"
      to: "app/_components/gradient-backdrop.tsx"
      via: "Render GradientBackdrop with account's bg tokens"
      pattern: "GradientBackdrop"
    - from: "components/app-sidebar.tsx"
      to: "components/ui/sidebar (SidebarMenuSub)"
      via: "Inline accordion via SidebarMenuSub + useState toggle"
      pattern: "SidebarMenuSub"
---

<objective>
Refactor the dashboard chrome to the Cruip "Simple Light" aesthetic: swap Geist for Inter at the root, set `bg-gray-50` page background, replace the existing `<header>` with a floating glass pill (Cruip pattern), rebuild `app-sidebar.tsx` with the new flat IA (Home / Event Types / Availability / Bookings / Branding / Settings — Settings as inline accordion expanding to Reminders + Profile), and wire the account's `background_color` + `background_shade` tokens through to a `GradientBackdrop` rendered behind every dashboard surface.

Purpose: The dashboard is the owner's daily-use surface. This plan delivers Phase success criteria #1 (Inter + gray-50 + glass pill + sidebar IA) and the dashboard portion of #3 (gradient updates live across surfaces). It also unblocks Plan 12-04a (Home tab) which plugs into the new Home item in the sidebar.

Output:
- Inter loaded globally via `next/font/google`
- Updated `globals.css` with `--background` (gray-50) + `--sidebar-width-mobile: 100vw`
- New `FloatingHeaderPill` component (Cruip verbatim pattern)
- Rebuilt `app-sidebar.tsx`: 6 flat items, Settings accordion, mobile-drawer-friendly
- `(shell)/layout.tsx` renders `<GradientBackdrop>` behind content using account tokens
- UI-01, UI-02, UI-03, UI-04 (dashboard portion), UI-05 satisfied
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/12-branded-ui-overhaul/12-CONTEXT.md
@.planning/phases/12-branded-ui-overhaul/12-RESEARCH.md
@.planning/phases/12-branded-ui-overhaul/12-01-SUMMARY.md

# Existing files to refactor (preserve all functional behavior)
@app/layout.tsx
@app/globals.css
@app/(shell)/layout.tsx
@components/app-sidebar.tsx
@components/ui/sidebar.tsx

# Plan 12-01 outputs (REQUIRED — Wave 2 depends on Wave 1)
# - lib/branding/types.ts        (Branding now has backgroundColor/backgroundShade)
# - app/_components/gradient-backdrop.tsx
# - app/_components/branded-page.tsx (new CSS vars)

# Verified canonical auth/account access pattern (no helper wrappers exist):
#   - Auth claims: `await supabase.auth.getClaims()` (Supabase SDK method, called directly)
#   - Account-for-user lookup: inline SELECT from accounts WHERE owner_user_id = claims.claims.sub
#     Reference: app/(shell)/app/page.tsx lines 9-26 + app/(shell)/layout.tsx lines 19-21
#   - Branding-for-account: `readBrandingForAccount(accountId)` from `lib/branding/read-branding.ts`
</context>

<tasks>

<task type="auto">
  <name>Task 1: Inter font + globals.css tokens + sidebar mobile width override</name>
  <files>
    app/layout.tsx
    app/globals.css
  </files>
  <action>
    **app/layout.tsx** — swap Geist for Inter:

    Read the existing file (already verified: it imports Geist, sets `--font-sans` CSS variable). Replace:
    ```tsx
    import { Geist } from "next/font/google";
    const geist = Geist({subsets:['latin'],variable:'--font-sans'});
    ```
    With:
    ```tsx
    import { Inter } from "next/font/google";
    const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
    ```
    Update `<html className={cn("font-sans", geist.variable)}>` to `<html className={cn("font-sans tracking-tight", inter.variable)}>`. Adding `tracking-tight` at the root makes Cruip's tight-letter-spacing aesthetic the default for all descendants (UI-01 requirement). Page-level overrides remain possible.

    **app/globals.css** — read existing `@theme` block. Add (or update):
    ```css
    @theme {
      /* Phase 12: Cruip Simple Light baseline */
      --background: oklch(0.985 0.002 247);  /* approx gray-50 */
      --foreground: oklch(0.2 0.02 247);     /* approx gray-900 */

      /* Phase 12: mobile sidebar = full-screen drawer (CONTEXT.md lock) */
      --sidebar-width-mobile: 100vw;
    }
    ```
    If the existing `@theme` block already defines these, update values rather than duplicating. Do NOT remove existing tokens for `--brand-primary` / `--brand-text` (Phase 7 contract).

    Verify Tailwind v4 picks up the new tokens: `bg-background` should now resolve to gray-50 across the app.

    **Defensive note (research Open Question 2):** If anything other than Geist is currently in `app/layout.tsx`, abort and reconcile. The existing file has been verified to use Geist as of this plan write.
  </action>
  <verify>
    1. `grep "next/font" app/layout.tsx` returns the Inter import (not Geist).
    2. `npm run build` completes without warnings about font weights or unknown subsets.
    3. `npm run dev` → visit `/app` → DevTools → confirm body computed `font-family` includes `Inter`.
    4. DevTools → confirm `<html>` has `tracking-tight` class.
    5. Confirm body background is gray-50 (use color-picker on a blank area).
  </verify>
  <done>
    Inter is the global font; gray-50 is the page background baseline; `--sidebar-width-mobile: 100vw` is set; no build warnings.
  </done>
</task>

<task type="auto">
  <name>Task 2: FloatingHeaderPill + (shell)/layout.tsx wiring with GradientBackdrop</name>
  <files>
    app/(shell)/_components/floating-header-pill.tsx
    app/(shell)/layout.tsx
  </files>
  <action>
    Create directory `app/(shell)/_components/` if missing.

    Create `app/(shell)/_components/floating-header-pill.tsx` (client component — needs `<SidebarTrigger>` interactivity):

    ```tsx
    "use client";
    import { SidebarTrigger } from "@/components/ui/sidebar";
    import Link from "next/link";

    interface FloatingHeaderPillProps {
      accountName: string;
      logoUrl: string | null;
    }

    /**
     * Cruip "Simple Light" floating glass header pill.
     * Fixed-position, rounded-2xl, white/90 with backdrop-blur, gradient hairline border.
     * Renders on all viewports: hamburger trigger always visible (mobile uses sidebar full-screen drawer).
     */
    export function FloatingHeaderPill({ accountName, logoUrl }: FloatingHeaderPillProps) {
      return (
        <header className="fixed top-2 z-30 w-full md:top-6">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div
              className="relative flex h-14 items-center justify-between gap-3 rounded-2xl bg-white/90 px-3 shadow-lg shadow-black/[0.03] backdrop-blur-sm before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(var(--color-gray-100),var(--color-gray-200))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)]"
            >
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:flex" />
                <Link href="/app" className="flex items-center gap-2">
                  {logoUrl ? (
                    <img src={logoUrl} alt={accountName} className="h-7 w-auto" />
                  ) : (
                    <span className="text-sm font-semibold text-gray-900">{accountName}</span>
                  )}
                </Link>
              </div>
              <div className="flex items-center gap-2">
                {/* Future: account avatar dropdown (deferred to v1.2) */}
              </div>
            </div>
          </div>
        </header>
      );
    }
    ```

    **app/(shell)/layout.tsx** — read existing file (verified canonical pattern, lines 19-21):
    ```ts
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims) redirect("/app/login");
    ```

    The current pattern: `<SidebarProvider>` → `<AppSidebar>` → `<SidebarInset>` → mobile-only `md:hidden` `<header>` → `<div className="p-6">{children}</div>`. **Replace** the mobile-only header with the new `FloatingHeaderPill` rendered always (Cruip pattern is fixed-position on all viewports — research §Pattern 1).

    To drive the `GradientBackdrop` and `FloatingHeaderPill`, fetch the user's account row + branding using the verified canonical inline pattern (no `loadAccountForUser` helper exists — use the same SELECT pattern as `app/(shell)/app/page.tsx` lines 19-26):

    ```tsx
    // VERIFIED CANONICAL PATTERN — no helper wrapper exists; replicate inline.
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    if (!claimsData?.claims) redirect("/app/login");

    // Inline account lookup (matches app/(shell)/app/page.tsx pattern).
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, slug, name, logo_url, brand_primary, background_color, background_shade")
      .eq("owner_user_id", claimsData.claims.sub)
      .is("deleted_at", null)
      .limit(1);

    if (!accounts || accounts.length === 0) {
      redirect("/app/unlinked"); // matches existing fallback in /app/page.tsx
    }
    const account = accounts[0];

    // Branding read (canonical helper exists — use it for the brand-derived fields).
    const branding = await readBrandingForAccount(account.id);

    return (
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar email={email} />
        <SidebarInset className="relative overflow-hidden bg-background">
          <GradientBackdrop color={branding.backgroundColor} shade={branding.backgroundShade} />
          <FloatingHeaderPill
            accountName={account.name ?? "Dashboard"}
            logoUrl={account.logo_url}
          />
          <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6 md:pt-28">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
    ```

    **Critical preservation:**
    - The existing `supabase.auth.getClaims()` + `if (!claimsData?.claims) redirect("/app/login")` guard MUST be kept verbatim (lines 19-21 of current file).
    - The existing `cookieStore.get("sidebar_state")` SSR cookie read (lines 30-31) MUST be kept — Phase 7 contract for sidebar collapse persistence.
    - The existing `email` extraction from claims MUST be kept and passed to `<AppSidebar email={email} />`.

    **Padding adjustment:** The fixed glass pill takes ~3.5rem of vertical space + top offset. Add `pt-20 md:pt-28` to the main content area so content isn't hidden behind the pill. This replaces the existing `<div className="p-6">` wrapper.

    **Embed routes are NOT under (shell):** `/embed/[account]/[event-slug]` lives at `app/embed/...` outside the (shell) group. Plan 12-05 handles embed restyle separately. This plan does not affect embed.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `npm run dev` → log in as Andrew → visit `/app`. Confirm: floating glass pill renders fixed at top-6, hamburger trigger visible on left of pill.
    3. Confirm: page content is NOT hidden behind the pill (top padding works).
    4. Confirm: GradientBackdrop renders subtle blue circles in the background (Andrew's account is `background_color=null, background_shade='subtle'` → defaults to gray-50 fallback color in shadeToGradient → soft circles visible).
    5. Resize to mobile (375px) → confirm pill is still rendered + hamburger present.
    6. Click hamburger on mobile → confirm sidebar opens as full-screen drawer (occupies 100vw — verified via `--sidebar-width-mobile: 100vw` from Task 1).
    7. Logged-out user visits `/app` → still redirects to `/app/login` (matches existing redirect target in current layout.tsx, NOT `/login`).
    8. Sidebar collapse cookie still works: collapse sidebar, refresh page, verify state persists (Phase 7 contract).
  </verify>
  <done>
    Dashboard chrome (header pill + gradient backdrop) renders on every dashboard route; auth-redirect logic preserved; mobile drawer is full-screen; sidebar SSR cookie state preserved.
  </done>
</task>

<task type="auto">
  <name>Task 3: Refactor app-sidebar.tsx — flat IA + Settings inline accordion + Home item</name>
  <files>
    components/app-sidebar.tsx
  </files>
  <action>
    Read existing `components/app-sidebar.tsx`. The current state (per STATE.md): 2 separate `SidebarGroup`s (Main + Settings).

    **Replace** with a SINGLE `SidebarGroup` rendering 6 flat items in this exact order (UI-05):
    1. **Home** — `/app` — icon: `Home` from lucide-react
    2. **Event Types** — `/app/event-types` — icon: `CalendarRange`
    3. **Availability** — `/app/availability` — icon: `Clock`
    4. **Bookings** — `/app/bookings` — icon: `CalendarDays`
    5. **Branding** — `/app/branding` — icon: `Palette`
    6. **Settings** — accordion expanding to:
       - Reminders — `/app/settings/reminders`
       - Profile — `/app/settings/profile`
       — icon: `Settings`

    **Settings inline accordion implementation** (CONTEXT.md lock — NOT flyout, NOT auto-route-driven):

    ```tsx
    "use client";
    import { useState } from "react";
    import { usePathname } from "next/navigation";
    import { ChevronDown, Home, CalendarRange, Clock, CalendarDays, Palette, Settings } from "lucide-react";
    import Link from "next/link";
    import {
      Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
      SidebarMenu, SidebarMenuItem, SidebarMenuButton,
      SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
    } from "@/components/ui/sidebar";

    const TOP_ITEMS = [
      { label: "Home",        href: "/app",              Icon: Home },
      { label: "Event Types", href: "/app/event-types",  Icon: CalendarRange },
      { label: "Availability",href: "/app/availability", Icon: Clock },
      { label: "Bookings",    href: "/app/bookings",     Icon: CalendarDays },
      { label: "Branding",    href: "/app/branding",     Icon: Palette },
    ] as const;

    export function AppSidebar() {
      const pathname = usePathname();
      const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/app/settings"));

      return (
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {TOP_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href))}
                      >
                        <Link href={item.href}>
                          <item.Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setSettingsOpen((v) => !v)}
                      isActive={pathname.startsWith("/app/settings")}
                      aria-expanded={settingsOpen}
                    >
                      <Settings />
                      <span>Settings</span>
                      <ChevronDown
                        className={`ml-auto transition-transform ${settingsOpen ? "rotate-180" : ""}`}
                      />
                    </SidebarMenuButton>
                    {settingsOpen && (
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === "/app/settings/reminders"}
                          >
                            <Link href="/app/settings/reminders">Reminders</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === "/app/settings/profile"}
                          >
                            <Link href="/app/settings/profile">Profile</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      );
    }
    ```

    **Active-state rule for Home (`/app`):** Use exact-match (`pathname === '/app'`) so other dashboard routes don't bleed into Home highlight (since every dashboard route prefix-matches `/app`).

    **PITFALL 5 — Sidebar SSR cookie state collision (research §Pitfall 5):** This is a KNOWN risk to keep visible during execution.
    - Existing `sidebar_state` cookie (set by shadcn `SidebarProvider`, read in `(shell)/layout.tsx` line 31) tracks the WHOLE-sidebar collapsed/expanded state and MUST remain untouched. Do NOT alter cookie name or read/write semantics.
    - Settings expansion uses local `useState` ONLY — no cookie. Owner expectation per CONTEXT lock: Settings collapses on every page navigation (no persistence).
    - **Verification command (run during task):** `grep -n "sidebar_state" components/ui/sidebar.tsx app/(shell)/layout.tsx` — should return at least 2 hits (the SIDEBAR_COOKIE_NAME constant + the layout.tsx read). Both must remain.
    - If Andrew complains about Settings collapse-on-nav, follow up by adding a separate `sidebar_settings_open` cookie — flag in summary as a known v1.2 follow-up if requested.

    **Verify SidebarMenuSub export** — research said this needed grep-confirmation. Confirmed during planning: `components/ui/sidebar.tsx` exports `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`. No additional install needed.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `grep "SIDEBAR_COOKIE_NAME\|sidebar_state" components/ui/sidebar.tsx app/(shell)/layout.tsx` — at least 2 hits remain (cookie persistence intact).
    3. `npm run dev` → log in → visit `/app` → confirm sidebar shows 6 items in order: Home (highlighted) / Event Types / Availability / Bookings / Branding / Settings (chevron pointing right).
    4. Click Settings → chevron rotates 180° → Reminders + Profile appear underneath.
    5. Click Settings again → collapses.
    6. Click Profile → navigates to `/app/settings/profile` → reload page → confirm Settings auto-expanded (defaultOpen logic via `pathname.startsWith('/app/settings')`).
    7. Click Home → navigate to `/app` → confirm Settings collapses (state reset on remount; acceptable per CONTEXT).
    8. Collapse the whole sidebar (top trigger), refresh → sidebar still collapsed (sidebar_state cookie preserved — Phase 7 contract NOT regressed).
    9. Mobile (375px) → tap hamburger → full-screen sidebar drawer → tap Settings → expansion works inside drawer.
    10. Verify all top item active-states fire on their respective routes (Branding active on `/app/branding`, etc.).
  </verify>
  <done>
    Sidebar renders 6 flat items in the correct order; Settings is an inline accordion with Reminders + Profile; mobile drawer is full-screen; cookie state for whole-sidebar persistence is preserved (Phase 7 contract — verified by grep + manual refresh test).
  </done>
</task>

</tasks>

<verification>
**Plan-level checks:**
- Inter font wired globally (`grep "next/font" app/layout.tsx` returns Inter).
- `<html>` has `tracking-tight`.
- Page background is gray-50.
- FloatingHeaderPill renders fixed top-2 / md:top-6 on every dashboard page.
- GradientBackdrop renders behind dashboard content using account tokens.
- Sidebar shows 6 flat items in correct order.
- Settings is an inline accordion (NOT flyout, NOT separate group).
- Mobile sidebar opens full-screen.
- Auth redirect for logged-out users still fires (target: `/app/login`, matching existing).
- Sidebar SSR cookie state preserved across reloads (Pitfall 5 — verified by grep + refresh test).
- `npx tsc --noEmit` clean; Vitest baseline (148+ passing) preserved.

**Requirements satisfied:**
- UI-01 (Inter + tracking-tight)
- UI-02 (bg-gray-50 + gray-900 text)
- UI-03 (floating glass header pill)
- UI-04 partial (gradient renders on dashboard surfaces — public surfaces in Plan 12-05)
- UI-05 (sidebar IA: Home / Event Types / Availability / Bookings / Branding / Settings + accordion)

**Phase success criteria contribution:**
- Criterion #1 — fully satisfied
- Criterion #3 — dashboard portion satisfied (Plan 12-05 covers public + embed + /[account])
</verification>

<success_criteria>
1. Inter font loaded via `next/font/google`; `--font-sans` variable updated.
2. `bg-gray-50` baseline + `tracking-tight` global.
3. `FloatingHeaderPill` renders fixed-position with hamburger trigger on every dashboard route.
4. Sidebar IA: Home / Event Types / Availability / Bookings / Branding / Settings (with Reminders + Profile under Settings).
5. Settings is an inline accordion controlled by `useState` (NOT route-driven persistence — local state only).
6. Mobile sidebar full-screen via `--sidebar-width-mobile: 100vw`.
7. `<GradientBackdrop>` renders inside `(shell)/layout.tsx` consuming the account's `background_color` + `background_shade`.
8. No regressions in Vitest or `npx tsc --noEmit`.
9. Auth-redirect logic for logged-out users preserved (target `/app/login`).
10. `sidebar_state` cookie persistence preserved (Phase 7 contract — Pitfall 5 flag closed).
</success_criteria>

<output>
After completion, create `.planning/phases/12-branded-ui-overhaul/12-03-SUMMARY.md` documenting:
- Font swap: Geist → Inter (impacts: every dashboard page picks up Inter; no `font-mono` change)
- Sidebar IA refactor: 2 groups → 1 group with accordion; Home item NEW
- Decisions: Settings expansion is local `useState` only (research recommendation; flag for revisit if Andrew asks for persistence)
- Decisions: Mobile sidebar is `100vw` full-screen (research recommendation; flag for revisit)
- Tech-stack additions: none (no new packages; SidebarMenuSub already exported from existing shadcn install)
- Auth/account access pattern used: inline `supabase.auth.getClaims()` + accounts SELECT (no helper wrapper exists in this codebase — replicated app/(shell)/app/page.tsx pattern)
- Pitfall 5 (sidebar_state cookie) closed: cookie name + read/write semantics untouched; verified by grep + manual refresh test
- Key files: list above
- For Plan 12-04a/b: Home item links to `/app` — Plan 12-04a refactors `/app/page.tsx` to be the calendar landing.
- For Plan 12-05: GradientBackdrop pattern established here applies to public surfaces (BrandedPage already wires it via Plan 12-01).
</output>
