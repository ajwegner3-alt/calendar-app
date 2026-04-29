# Phase 12: Branded UI Overhaul (5 Surfaces) - Research

**Researched:** 2026-04-28
**Domain:** UI/visual restyling across 5 product surfaces (dashboard, public booking page, embed widget, transactional emails, auth pages) + branding token migration + monthly-calendar Home tab + sidebar IA refactor
**Confidence:** HIGH for codebase facts (verified via direct read), HIGH for Cruip pattern (verified via raw github source), HIGH for react-day-picker v9 (Context7 + official docs), MEDIUM for email rendering patterns (no dedicated test harness, mostly trust-the-existing-Phase-5/7-patterns)

## Summary

Phase 12 is **almost entirely a re-skinning effort** layered on a fully-functional calendar app. Every surface listed in CONTEXT.md already exists in code; the work is replacing tokens, adding two new schema columns (`background_color`, `background_shade`), introducing a new `/app` Home tab (calendar + drawer), and refactoring the sidebar IA. **No new business logic, no new API endpoints, no new auth flows.**

The Cruip "Simple Light" aesthetic is concrete and well-documented in their open-source `tailwind-landing-page-template` repo — the "floating glass header pill" is `fixed top-2 md:top-6 ... rounded-2xl bg-white/90 ... backdrop-blur-xs` and the "gradient blur circles" are `<div className="h-80 w-80 rounded-full bg-linear-to-tr from-blue-500 opacity-50 blur-[160px]" />`. Tailwind v4 is already installed (`@theme` block in `app/globals.css`), so the token migration path is well-paved.

The codebase has all five required shadcn primitives already installed: `Sheet`, `Dialog`, `Calendar` (react-day-picker v9), `Sidebar` (collapsible="icon" mode supported), and `DropdownMenu`. The `BrandedPage` component already standardizes `--brand-primary` / `--brand-text` CSS variables across public surfaces — Phase 12 just adds `--brand-bg-color` / `--brand-bg-shade` to the same convention.

**Primary recommendation:** Slice into **6 plans** organized into 3 waves: (1) DB migration + branding-token API + auth-page restyle (parallelizable foundation), (2) dashboard restyle + sidebar IA + Home tab (sequential — sidebar is shared chrome), (3) public/embed/[account] restyle + emails restyle (parallelizable consumers). **Defer Playwright visual regression** — Phase 12 has high visual surface area but the work is largely token swaps that will be caught by manual review faster than a Playwright suite can be authored. Document the deferral in the FUTURE_DIRECTIONS appendix.

## Standard Stack

The stack is **already in the repo** — no new dependencies needed for the core scope. Listed for completeness so the planner doesn't accidentally add alternatives.

### Core
| Library | Version (verified from package.json) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.4 | App Router, RSC, server actions | Phase 1 lock — no alternatives entertained |
| `react` | 19.2.5 | UI framework | Phase 1 lock |
| `tailwindcss` | ^4.2.0 | Utility CSS + `@theme` token system | Already wired in `globals.css` — Cruip pattern uses Tailwind v4 same as we do |
| `react-day-picker` | ^9.14.0 | Monthly calendar primitive | Already used in `components/ui/calendar.tsx` + slot-picker + availability; v9 modifier API is what we need |
| `radix-ui` | ^1.4.3 | Sheet, Dialog, DropdownMenu primitives | Already installed via `components/ui/sheet.tsx` etc. |
| `shadcn` | ^4.3.0 | Component scaffolding | Already in use; `components.json` configured |
| `next-themes` | ^0.4.6 | Theme switching (currently default light) | Already installed; no dark mode work in this phase |
| `nodemailer` | ^8.0.6 | Gmail SMTP transport | Phase 5 lock; do NOT swap to Resend |
| `lucide-react` | ^1.8.0 | Icons (CalendarDays, Settings, ChevronDown, etc.) | Already used throughout sidebar |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@date-fns/tz` | ^1.4.1 | Timezone-aware formatting in calendar/drawer | Calendar day grouping; format booking start_at in account TZ |
| `date-fns` | ^4.1.0 | Date math (startOfMonth, endOfMonth, eachDayOfInterval) | Monthly calendar query range |
| `sonner` | ^2.0.7 | Toast notifications | "Reschedule link copied", "Reminder sent" feedback in drawer |
| `zod` | ^4.3.6 | Validation for new branding columns | `background_color` hex regex, `background_shade` enum |
| `class-variance-authority` | ^0.7.1 | Variant composition | If new gradient-shade variants need it |

### Alternatives Considered (and Rejected)
| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| react-day-picker v9 | FullCalendar, react-big-calendar | CONTEXT.md locks v9; both alternatives are heavier and not month-grid-with-dots-friendly |
| Custom drawer | shadcn Sheet | CONTEXT.md locks Sheet; already installed |
| React Email / MJML | Inline-styled HTML strings | Phase 5 STATE lock — current `branding-blocks.ts` pattern is already proven across Gmail/Outlook/Apple Mail |
| CSS-in-JS for branding tokens | Tailwind v4 `@theme` + inline `style` CSS vars | Phase 7 lock; `BrandedPage` already does this. Tailwind dynamic classes (`bg-${color}`) won't work — must use inline `style={{ backgroundColor }}` or CSS variables |
| Playwright visual regression NOW | Manual QA only | Recommendation: defer (see Visual Regression section below) |

**No new packages required for core scope.** Optional enhancements that *would* add packages:
- `@playwright/test` — only if visual regression is built (NOT recommended)
- `react-colorful` — alternative color picker; unnecessary, native `<input type="color">` already used in `color-picker-input.tsx`

## Architecture Patterns

### Recommended Project Structure (Additions Only)

```
app/
├── (shell)/app/
│   ├── page.tsx                          # MODIFY → becomes Home tab (monthly calendar)
│   ├── _components/                      # NEW dir for shared shell pieces
│   │   ├── floating-header-pill.tsx     # NEW (Cruip pattern)
│   │   └── gradient-backdrop.tsx        # NEW (consumes background_color/shade)
│   └── home/                             # OPTIONAL alt route if /app keeps onboarding redirect logic
│       ├── page.tsx                      # Server component: fetch month bookings
│       ├── _components/
│       │   ├── home-calendar.tsx        # Client wrapper around <Calendar> with dot modifiers
│       │   ├── day-detail-sheet.tsx     # shadcn Sheet — booking list for selected day
│       │   └── day-detail-row.tsx       # Per-row View/Cancel/Copy/Send-reminder actions
│       └── _lib/
│           └── load-month-bookings.ts   # Server query: bookings WHERE start_at BETWEEN
├── _components/
│   └── branded-page.tsx                  # MODIFY → add --brand-bg-color, --brand-bg-shade vars
├── (auth)/app/                           # Login/signup/forgot-password/verify-email — restyle existing files
└── auth/                                 # confirm/reset-password/auth-error — restyle existing files

components/
├── app-sidebar.tsx                       # MODIFY → inline accordion Settings group, Home item, Branding repositioned
├── nsi-gradient-backdrop.tsx             # NEW (auth pages — fixed NSI tokens)
└── ui/
    ├── accordion.tsx                     # NEW shadcn install (sidebar Settings expansion)
    └── (sheet, calendar, dialog, sidebar all already installed)

lib/
├── branding/
│   ├── types.ts                          # MODIFY → add backgroundColor, backgroundShade fields
│   ├── read-branding.ts                  # MODIFY → SELECT background_color, background_shade
│   └── gradient.ts                       # NEW — pure helper: shadeToGradient(color, shade): { circles: [...] }
└── email/
    └── branding-blocks.ts                # MODIFY → renderEmailBrandedHeader(branding) — solid-color bar

supabase/
└── migrations/
    └── 20260429120000_phase12_branding_columns.sql  # NEW — ALTER TABLE accounts ADD COLUMN ...
```

### Pattern 1: Cruip "Simple Light" — Floating Glass Header Pill
**What:** Header sits floating above content with rounded-2xl, subtle backdrop blur, white background w/ low opacity, gradient hairline border.
**When to use:** Top of every dashboard page (replaces current bordered `<header>` in `app/(shell)/layout.tsx` line 40-43).
**Source:** [`cruip/tailwind-landing-page-template` components/ui/header.tsx](https://github.com/cruip/tailwind-landing-page-template/blob/main/components/ui/header.tsx) — verbatim from raw fetch
**Example:**
```tsx
// Floating glass header pill — Cruip "Simple Light" verbatim pattern
<header className="fixed top-2 z-30 w-full md:top-6">
  <div className="mx-auto max-w-6xl px-4 sm:px-6">
    <div className="relative flex h-14 items-center justify-between gap-3 rounded-2xl bg-white/90 px-3 shadow-lg shadow-black/[0.03] backdrop-blur-xs before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(var(--color-gray-100),var(--color-gray-200))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)]">
      {/* logo + nav */}
    </div>
  </div>
</header>
```

### Pattern 2: Cruip Gradient Blur Circles (Decorative Backdrop)
**What:** Three positioned `div`s with `rounded-full`, `blur-[160px]`, `opacity-50`, gradient `from-{accent} to-{neutral}`, sized 80x80 (320px square in Tailwind units `h-80 w-80`).
**When to use:** Behind hero sections on **all 5 surfaces** (CONTEXT.md lock). Auth pages use NSI tokens; all other surfaces use account's `background_color` + `background_shade`.
**Source:** [`cruip/tailwind-landing-page-template` components/page-illustration.tsx](https://github.com/cruip/tailwind-landing-page-template/blob/main/components/page-illustration.tsx) — verified via raw fetch
**Example:**
```tsx
// Phase 12 generalization: parameterized by account branding tokens
function GradientBackdrop({ color, shade }: { color: string; shade: "none" | "subtle" | "bold" }) {
  if (shade === "none") {
    // CONTEXT.md Claude's discretion: flat solid tint
    return <div className="absolute inset-0 -z-10" style={{ backgroundColor: `color-mix(in oklch, ${color} 4%, white)` }} aria-hidden />;
  }
  const opacity = shade === "subtle" ? 0.25 : 0.5;
  const blur = shade === "subtle" ? 200 : 160;
  return (
    <>
      <div className="pointer-events-none absolute -top-32 left-1/2 ml-[280px] -translate-x-1/2 -z-10" aria-hidden="true">
        <div className="h-80 w-80 rounded-full" style={{
          backgroundImage: `linear-gradient(to top right, ${color}, transparent)`,
          opacity,
          filter: `blur(${blur}px)`,
        }} />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[420px] ml-[180px] -translate-x-1/2 -z-10" aria-hidden="true">
        <div className="h-80 w-80 rounded-full" style={{
          backgroundImage: `linear-gradient(to top right, ${color}, #0F172A)`,
          opacity,
          filter: `blur(${blur}px)`,
        }} />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[640px] -ml-[200px] -translate-x-1/2 -z-10" aria-hidden="true">
        <div className="h-80 w-80 rounded-full" style={{
          backgroundImage: `linear-gradient(to top right, ${color}, #0F172A)`,
          opacity,
          filter: `blur(${blur}px)`,
        }} />
      </div>
    </>
  );
}
```
**Pitfall:** Tailwind v4 dynamic classes do **NOT** work for `bg-{color}` from DB values — Phase 7 already learned this (see `BrandedPage` using inline `style`). Same constraint for gradient circles: must use inline `style` with the hex from DB.

### Pattern 3: react-day-picker v9 Custom Day Modifiers + Dot Rendering
**What:** Modifiers map a Date → boolean/data; `modifiersClassNames` adds CSS class; pseudo-element renders dot. For per-day booking COUNT capping at 3 dots + "+N", we need a **custom DayButton component** (the existing `components/ui/calendar.tsx` already wraps `DayButton` — easy to extend).
**When to use:** New Home tab `/app/home` (or `/app`).
**Sources:**
- [react-day-picker v9 Custom Modifiers](https://daypicker.dev/guides/custom-modifiers)
- [react-day-picker v9 Custom Components](https://daypicker.dev/guides/custom-components)
- Verified via Context7 (Confidence: HIGH)
**Example:**
```tsx
// In a new home-calendar.tsx (client component)
"use client";
import { Calendar } from "@/components/ui/calendar";
import { DayButton } from "react-day-picker";

interface BookingsByDay { [yyyy_mm_dd: string]: number }  // count per day

export function HomeCalendar({ bookingsByDay, onDayClick }: { bookingsByDay: BookingsByDay; onDayClick: (date: Date) => void }) {
  return (
    <Calendar
      mode="single"
      onSelect={(date) => date && onDayClick(date)}
      components={{
        DayButton: (props) => {
          const key = props.day.date.toISOString().slice(0, 10); // "2026-04-28"
          const count = bookingsByDay[key] ?? 0;
          return (
            <button {...props} className="relative flex flex-col items-center w-full aspect-square">
              <span>{props.day.date.getDate()}</span>
              {count > 0 && (
                <span className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span key={i} className="h-1 w-1 rounded-full bg-[var(--brand-primary)]" />
                  ))}
                  {count > 3 && (
                    <span className="text-[8px] text-muted-foreground ml-0.5">+{count - 3}</span>
                  )}
                </span>
              )}
            </button>
          );
        },
      }}
    />
  );
}
```
**Note:** The existing `components/ui/calendar.tsx` already overrides `DayButton` with `CalendarDayButton`. Phase 12 home-calendar can either compose by passing `components={{ DayButton: ... }}` (overriding the default) OR forking a parallel `home-calendar.tsx` that calls `<DayPicker>` directly. **Recommendation: pass `components` prop** — keeps the shadcn calendar styling intact for other surfaces.

### Pattern 4: Day-Detail Sheet Drawer (CONTEXT.md lock)
**What:** Click a day → opens shadcn `Sheet` (right side default, `sm:max-w-sm` already configured) listing bookings with View/Cancel/Copy/Send-reminder actions.
**When to use:** Triggered from Home tab calendar.
**Example:**
```tsx
"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { sendReminderForBookingAction, cancelBookingAsOwnerAction } from "@/app/(shell)/app/bookings/[id]/_lib/actions";  // existing

interface DayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  bookings: Array<{
    id: string;
    booker_name: string;
    booker_email: string;
    start_at: string;
    event_type: { name: string };
    status: "confirmed" | "cancelled" | "rescheduled";
    rescheduleToken?: string;  // raw token from server (would need a new RPC)
  }>;
  appUrl: string;
}

export function DayDetailSheet({ open, onOpenChange, date, bookings, appUrl }: DayDetailSheetProps) {
  if (!date) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</SheetTitle>
          <SheetDescription>{bookings.length} booking{bookings.length === 1 ? "" : "s"}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 p-4">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-lg border p-3">
              <div className="font-medium">{b.event_type.name}</div>
              <div className="text-sm text-muted-foreground">{b.booker_name} · {new Date(b.start_at).toLocaleTimeString()}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><Link href={`/app/bookings/${b.id}`}>View</Link></Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  // Reschedule URL pattern: ${appUrl}/reschedule/${rawToken}  (existing convention)
                  await navigator.clipboard.writeText(`${appUrl}/reschedule/${b.rescheduleToken}`);
                  toast.success("Reschedule link copied");
                }}>Copy reschedule link</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  const res = await sendReminderForBookingAction(b.id);
                  toast[res.ok ? "success" : "error"](res.ok ? "Reminder sent" : res.error);
                }}>Send reminder</Button>
                {b.status === "confirmed" && (
                  <Button variant="destructive" size="sm" onClick={() => /* confirm dialog */ null}>Cancel</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```
**Side panel width:** Default `data-[side=right]:sm:max-w-sm` (~24rem / 384px). For day-detail with multiple bookings + 4-button action rows, this is **tight**. **Recommendation:** override `className="sm:max-w-md"` (~28rem / 448px) on `<SheetContent>` for better breathing room.

### Pattern 5: Sidebar — Inline Accordion for Settings (CONTEXT.md lock)
**What:** Click "Settings" → expands inline (chevron rotates) showing Profile + Reminders. Click again → collapses. No flyout, no auto-route-driven expansion.
**When to use:** Replacing the current 2-group sidebar (Main + Settings as separate `SidebarGroup`s) in `components/app-sidebar.tsx`.
**Implementation:** shadcn provides `SidebarMenuSub` + `SidebarMenuSubButton` for this exact pattern, OR install `accordion.tsx` and wrap. The shadcn-canonical approach is `SidebarMenuSub` with a controlled toggle button.
**Example skeleton:**
```tsx
"use client";
import { useState } from "react";
import { ChevronDown, Settings } from "lucide-react";
import {
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";

function SettingsGroup({ pathname }: { pathname: string }) {
  // Default open if user is on a settings sub-route, else collapsed
  const [open, setOpen] = useState(pathname.startsWith("/app/settings"));
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => setOpen(!open)}>
        <Settings />
        <span>Settings</span>
        <ChevronDown className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </SidebarMenuButton>
      {open && (
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={pathname === "/app/settings/reminders"}>
              <Link href="/app/settings/reminders">Reminders</Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={pathname === "/app/settings/profile"}>
              <Link href="/app/settings/profile">Profile</Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}
```
**Verification needed:** confirm `SidebarMenuSub` is exported from the installed `components/ui/sidebar.tsx` — Phase 2 installed it but only the imports actually used were referenced in `app-sidebar.tsx`. Likely already there (shadcn ships the full set); 1-line grep at task start confirms.

### Pattern 6: Mobile — Hamburger → Full-Screen Drawer (CONTEXT.md lock)
**What:** On `md:hidden`, sidebar is hidden; mobile header has `<SidebarTrigger>` (hamburger); tap → full-screen overlay drawer. shadcn's `Sidebar` already supports this via `<SheetContent side="left">` under the hood when in mobile mode.
**Current state:** `app/(shell)/layout.tsx` line 40 already has `md:hidden` mobile header with `<SidebarTrigger>`. **The pattern is already implemented** — Phase 12 just needs to verify it renders the full-screen overlay (not a thin pill) when triggered. The shadcn Sidebar component, when `data-mobile=true`, uses Sheet internally with `w-(--sidebar-width-mobile)` — defaults to 18rem. Override to `w-full sm:w-(--sidebar-width-mobile)` if "full-screen" is desired vs. "side drawer".

### Pattern 7: Email Solid-Color Header Bar (CONTEXT.md lock)
**What:** Replace gradient/blur visuals from `branding-blocks.ts#renderEmailLogoHeader` with a solid-color band using account's `background_color` (NOT brand_primary). Logo on the bar.
**When to use:** All 6 transactional emails. Identical treatment.
**Source:** caniemail.com confirms `<table>` with inline `bgcolor=` and `style="background-color:..."` works in 100% of major clients (Outlook desktop included).
**Example:**
```ts
// New helper in lib/email/branding-blocks.ts
export function renderEmailBrandedHeader(branding: EmailBranding & { background_color: string | null }): string {
  const bg = branding.background_color ?? "#F8FAFC"; // gray-50 fallback
  const fg = pickTextColor(bg);
  const logoCell = branding.logo_url
    ? `<img src="${branding.logo_url}" alt="${escapeHtml(branding.name)}" width="120" style="max-width:120px;height:auto;display:block;border:0;" />`
    : `<span style="color:${fg};font-size:20px;font-weight:600;">${escapeHtml(branding.name)}</span>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg};margin:0 0 0 0;">
    <tr><td align="center" style="padding:24px 16px;">${logoCell}</td></tr>
  </table>`;
}
```
**Verification:** caniemail.com — `<table bgcolor>` is universally supported (HIGH confidence). VML/gradient alternatives explicitly rejected by CONTEXT.md.

### Pattern 8: NSI Footer Mark in Emails
**Current state (`lib/email/branding-blocks.ts:44`):** `NSI_MARK_URL: string | null = null` — text-only because the asset doesn't exist yet. CONTEXT.md locks "NSI mark in footer bottom-center."
**Action:** Add `public/nsi-mark.png` (16x16 or 32x32, 2x for retina) and set `NSI_MARK_URL = ${process.env.NEXT_PUBLIC_APP_URL}/nsi-mark.png`. Plan 12-XX should be a 1-task slot to commit the asset + flip the constant.

### Anti-Patterns to Avoid

- **Tailwind dynamic classes from DB values:** `bg-${row.brand_primary}` will NOT compile (no JIT class for arbitrary hex). Always inline-style or CSS variable. (Phase 7 already learned this — `BrandedPage` uses `style={{ "--brand-primary": effective }}`.)
- **CSS gradients in email HTML:** Gmail web strips `background-image: linear-gradient(...)`; Outlook desktop renders nothing. CONTEXT.md already locks solid-color-only — DO NOT add gradients to email headers.
- **Putting the home calendar in a server component without a client wrapper:** react-day-picker requires `"use client"`. Pattern: server component fetches month bookings + passes to client `<HomeCalendar>` wrapper.
- **Refactoring `BrandedPage` signature aggressively:** It's consumed by 4 routes (`/[account]/[event-slug]`, confirmed page, `/cancel/[token]`, `/reschedule/[token]`). Add new optional props (`backgroundColor`, `backgroundShade`); don't break existing call sites.
- **Hardcoding gray-50 page bg in components:** Use `bg-background` (Tailwind v4 var) or extend `globals.css` `@theme` `--background: oklch(0.98 0 0)` for the gray-50 baseline so it's overrideable per-account.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monthly calendar with day modifiers | Custom grid layout | `react-day-picker` v9 (already installed) | Locale-aware, ARIA-compliant, keyboard nav, weekday headers all free |
| Day-detail drawer | Custom modal/portal | shadcn `Sheet` (already installed) | Focus trap, escape key, overlay backdrop all handled |
| Sidebar collapsible accordion | Custom toggle JS | `SidebarMenuSub` from shadcn sidebar (already installed) OR shadcn `Accordion` | Accessible disclosure pattern, animation primitives included |
| Hamburger drawer for mobile | Custom slide-in | shadcn `Sidebar` mobile mode | Already wired in repo's `app/(shell)/layout.tsx` |
| Color picker | Custom HSV/HSL JS | Native `<input type="color">` (already in `color-picker-input.tsx`) | Native picker is universally supported; preset swatches are just `<button>` triggers that call `onChange` |
| WCAG contrast checker | Custom luminance math | `lib/branding/contrast.ts` (already exists) | Already battle-tested for `pickTextColor` in emails |
| Email HTML rendering | React Email / MJML | Existing `lib/email/branding-blocks.ts` inline-styled pattern | Phase 5 lock; rebuilding emails in React Email would be a 5-day rewrite that delivers no incremental benefit |
| Gradient blur backdrops | Custom Canvas/SVG | Inline-styled `<div>` with `blur-[160px]` (Cruip pattern) | 6 lines per circle, perfect mobile perf, no JS |
| Plain-text email derivation | Hand-write parallel templates | `stripHtml(html)` already in use in `send-reminder-booker.ts:194-217` AND `lib/email-sender/utils.ts` | DRY; auto-derives from HTML |
| Visual regression | Hand-take screenshots in PR descriptions | Manual QA review (Phase 12 final task) — DO NOT add Playwright in v1.1 | Cost/value mismatch (see Visual Regression section) |
| Custom-question SVG icons | Custom SVG | `lucide-react` (already installed) | Home icon, Calendar icon, etc. all there |

**Key insight:** Phase 12 is **near-zero greenfield**. Every primitive is already in the repo from Phases 1-11. The bulk of the work is **token swapping, layout restructuring, and copy-paste of the Cruip pattern.** Resist the urge to introduce new libraries — they will fight the Phase 1-11 conventions.

## Common Pitfalls

### Pitfall 1: Tailwind v4 dynamic class JIT failure
**What goes wrong:** `<div className={`bg-[${row.brand_primary}]`}>` produces unstyled output. Tailwind JIT can't see runtime hex values.
**Why it happens:** JIT scans source files at build time; runtime DB values aren't visible.
**How to avoid:** Always use inline `style={{ backgroundColor: row.brand_primary }}` or CSS variables on a parent + `style={{ "--brand-primary": row.brand_primary }}`. Phase 7's `BrandedPage` is the correct pattern — copy it.
**Warning signs:** Designer reports "color picker doesn't work in production"; works in dev because JIT scans dev bundle differently.

### Pitfall 2: react-day-picker v9 SSR / "use client" requirement
**What goes wrong:** `Module not found` or hydration mismatch when used directly in server component.
**Why it happens:** react-day-picker uses `useId`, `useState`, etc. — strictly client-side.
**How to avoid:** Wrap in a `"use client"` component. Server component fetches data → passes as prop. Pattern already used in repo (`app/[account]/[event-slug]/_components/slot-picker.tsx`).
**Warning signs:** Build error or `Hydration failed because the initial UI does not match what was rendered on the server`.

### Pitfall 3: Branding token consumption — flash of unstyled background
**What goes wrong:** Page renders with default gray-50, then ~100ms later the gradient pops in.
**Why it happens:** Branding tokens fetched client-side after hydration.
**How to avoid:** Server-fetch `accounts.background_color` + `background_shade` in the page's RSC; pass to a wrapper component that applies inline style on first paint. `BrandedPage` already does this for primary color — extend.
**Warning signs:** Visible "flash" on page load. Use Network throttling 3G in DevTools to test.

### Pitfall 4: Email-client gradient stripping
**What goes wrong:** Header renders fine in browser preview but is blank/white in Gmail or Outlook desktop.
**Why it happens:** Gmail web strips `background-image: linear-gradient(...)`; Outlook desktop uses Word renderer that ignores most modern CSS.
**How to avoid:** CONTEXT.md locks solid-color-only — but if anyone is tempted to "improve," remember: `<table bgcolor="#XXX" style="background-color:#XXX">` is the only universally-rendered approach.
**Warning signs:** Outlook desktop shows blank header band; mail-tester score drops.

### Pitfall 5: Sidebar shadcn cookie state collision
**What goes wrong:** Adding accordion state breaks existing collapsed-icon-mode persistence.
**Why it happens:** Existing `sidebar_state` cookie tracks collapsed/expanded for the WHOLE sidebar. Adding a separate "Settings group expanded" cookie or state needs to coexist.
**How to avoid:** Local component state (`useState`) for Settings expansion is sufficient — don't persist across sessions. If Andrew expects persistence, add a separate `sidebar_settings_open` cookie.
**Warning signs:** Sidebar collapses on next page nav unexpectedly.

### Pitfall 6: shadcn Sheet drawer max-width on mobile
**What goes wrong:** Day-detail drawer feels cramped on iPhone-width viewports because default is `data-[side=right]:sm:max-w-sm` (24rem).
**Why it happens:** Default shadcn config; "small-screen friendly" but not action-row friendly.
**How to avoid:** On Home tab usage, override `<SheetContent className="sm:max-w-md">` (28rem) or even `sm:max-w-lg` for breathing room.
**Warning signs:** "Send reminder" button wrapping to next line on viewport ≥ 375px.

### Pitfall 7: `background_shade='none'` flat-tint contrast
**What goes wrong:** Owner picks a vivid background_color + shade='none' → flat saturated bg + dark text = unreadable.
**Why it happens:** "None" is interpreted as "fill solid with chosen color" — fine for `subtle` (4% mixed with white) per CONTEXT.md recommendation, but if naively `background_color` is used directly, contrast suffers.
**How to avoid:** Apply `color-mix(in oklch, ${color} 4%, white)` for `none` (very light tint). For `subtle` and `bold`, only the gradient circles use the saturated color; the page bg stays gray-50.
**Warning signs:** Lighthouse contrast warning; owner says "my dashboard looks like a stop sign."

### Pitfall 8: Bookings reschedule token in drawer = security exposure
**What goes wrong:** "Copy reschedule link" needs the **raw** reschedule token, but the DB only stores the SHA-256 hash (Phase 6 design). Naive implementation: re-mint a token on every drawer open → invalidates the link emailed to the booker.
**Why it happens:** Phase 6 hashes tokens at rest by design. Re-issuing breaks the email links.
**How to avoid:** **Two options:**
1. Add a new RPC `regenerate_reschedule_token(booking_id)` that mints + stores hash + returns raw → owner sends new link, but old emailed link is invalidated. **Lock this in Plan task** — booker's emailed link will stop working. Acceptable per Phase 8 reminder rotation precedent.
2. Defer the "Copy reschedule link" feature in v1.1 if security review pushes back. CONTEXT.md locks all 4 actions including copy-link, so option 1 is the path.
**Warning signs:** Booker calls/emails "my reschedule link doesn't work anymore" after owner copies a link from drawer.

### Pitfall 9: Auth pages — preserving existing Phase 10 onboarding redirect logic
**What goes wrong:** Restyling `/login`, `/signup`, `/auth/reset-password` accidentally drops the `redirect("/app")` if logged in, or the `searchParams.reset === "success"` flash banner.
**Why it happens:** Big visual rewrites tend to throw out the page.tsx and rebuild from scratch.
**How to avoid:** **Restyle = swap the `<main>` JSX wrapper, not the data-loading logic.** Read `app/(auth)/app/login/page.tsx:9-15` carefully — preserve `getClaims`, `redirect`, `searchParams` parsing. Only the JSX between `return (` and `)` changes.
**Warning signs:** E2E logged-in user lands on /login instead of redirecting to /app.

### Pitfall 10: Embed widget gradient → height-reporter conflict
**What goes wrong:** Adding gradient blur circles to `EmbedShell` increases scroll height; `EmbedHeightReporter` reports new height to parent; iframe resizes; user sees jump.
**Why it happens:** Gradient circles are positioned `absolute` with negative offsets — they extend beyond container, but the height reporter measures `document.body.scrollHeight`.
**How to avoid:** Wrap gradient circles in a parent with `overflow: hidden` so they clip to the visible content area, or use `pointer-events-none` + ensure z-index + position don't extend outside `<main>`. Test in iframe with DevTools.
**Warning signs:** Embed iframe is unexpectedly tall; horizontal scrollbar appears.

## Code Examples

### Adding background_color + background_shade columns
```sql
-- supabase/migrations/20260429120000_phase12_branding_columns.sql
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS background_color text
    CHECK (background_color IS NULL OR background_color ~* '^#[0-9a-f]{6}$');

CREATE TYPE background_shade AS ENUM ('none', 'subtle', 'bold');

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS background_shade background_shade NOT NULL DEFAULT 'subtle';

COMMENT ON COLUMN accounts.background_color IS
  'Per-account background tint (Phase 12). NULL = use brand_primary as fallback. Hex #RRGGBB.';
COMMENT ON COLUMN accounts.background_shade IS
  'Gradient intensity: none=flat tint, subtle=light gradient circles, bold=full Cruip pattern.';
```

### Branding type extension
```ts
// lib/branding/types.ts (MODIFY)
export interface Branding {
  logoUrl: string | null;
  primaryColor: string;
  textColor: "#ffffff" | "#000000";
  // Phase 12 additions
  backgroundColor: string;        // resolved (defaults to primaryColor if column null)
  backgroundShade: "none" | "subtle" | "bold";
}
```

### Preset swatch + custom hex picker
```tsx
// app/(shell)/app/branding/_components/color-picker-input.tsx (MODIFY)
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
// Render: 8 swatch buttons → <input type="color"> → text hex input. All call onChange(hex).
```

### Server-side load-month-bookings query
```ts
// app/(shell)/app/_lib/load-month-bookings.ts (NEW)
import "server-only";
import { startOfMonth, endOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";

export async function loadMonthBookings(month: Date) {
  const supabase = await createClient();
  const from = startOfMonth(month).toISOString();
  const to   = endOfMonth(month).toISOString();
  const { data } = await supabase
    .from("bookings")
    .select("id, start_at, status, booker_name, booker_email, event_types(name)")
    .gte("start_at", from)
    .lte("start_at", to)
    .order("start_at", { ascending: true });
  return data ?? [];
}
```

## State of the Art

| Old Approach (current code) | Current/Phase 12 Approach | When Changed | Impact |
|---|---|---|---|
| Sidebar with 2 separate `SidebarGroup` (Main + Settings) | Single `SidebarGroup` with Settings as collapsible accordion item | Phase 12 (this) | IA simplification, Settings reachable from any state |
| Dashboard at `/app` shows OnboardingChecklist + WelcomeCard | `/app` becomes Home tab with monthly calendar | Phase 12 | Owner gets daily-use surface as the landing tab |
| Auth pages render basic centered card on `bg-muted` | Cruip-style hero with NSI gradient + value-prop copy | Phase 12 | Auth pages double as soft NSI sales surface |
| Email header = solo logo image | Solid-color header band w/ logo (per-account branded) | Phase 12 | Visual brand carries to inbox |
| Branding tokens = brand_primary only | + background_color + background_shade ('none'\|'subtle'\|'bold') | Phase 12 | Owners can pick distinct page-bg from button-color |
| `BrandedPage` exposes `--brand-primary`, `--brand-text` | + `--brand-bg-color`, `--brand-bg-shade` | Phase 12 | Same convention extended; existing consumers untouched |

**Deprecated/superseded:**
- `app/(shell)/app/page.tsx` current implementation (OnboardingChecklist + WelcomeCard) — moves to a sub-component that renders only when `account.created_at < 7d AND !dismissed`, displayed *above* the new Home calendar. Don't delete the onboarding logic.
- `lib/email/branding-blocks.ts#renderEmailLogoHeader` (logo-only) — superseded by `renderEmailBrandedHeader` (solid-color band + logo). Old function can be deleted after all 6 senders migrate.

## Visual Regression — Recommendation: DEFER

**Recommendation:** Skip Playwright in Phase 12. Rely on manual QA in Phase 13.

**Reasoning:**
1. **Playwright not installed** (verified: `package.json` has zero `@playwright/*` deps; no `playwright.config.ts`). Adding it = ~0.5d setup + ~0.5d author 5 critical screenshots × 3 viewports + ~0.5d CI integration = ~1.5d minimum, not the "1 day" CONTEXT.md hopes for.
2. **Test infra is Vitest + Testing Library** (148 passing tests, see CONTEXT.md). Adding Playwright = a second test runner + a second CI lane + a second config to maintain.
3. **Phase 12 work is token swaps + layout restructures** — manual review (open 5 surfaces in browser, eyeball) catches issues faster than maintaining a screenshot baseline. Visual diffs are noisy on resolution changes, font rendering, scrollbars, etc.
4. **CONTEXT.md frames it as "cheap insurance" with a 1d budget** — actual cost is closer to 1.5-2d for meaningful coverage, and the insurance pays out only if a future change breaks something. Phase 12 is the change.
5. **Defer doesn't mean reject** — add to FUTURE_DIRECTIONS.md as "v1.2 work: add Playwright visual-regression baseline once UI is stable post-12."

**If planner wants to ship a minimum slice anyway:** install `@playwright/test`, snapshot only `/app` (Home tab) + `/[account]/[event-slug]` + `/login` at 1280×800, no mobile viewports. ~0.5d. But Andrew's `/CLAUDE.md` philosophy is "live testing" — Playwright is more aligned with staging-CI workflows than the deploy-and-eyeball loop he runs.

## Plan Slicing Recommendation (6 plans, 3 waves)

### Wave 1 — Foundation (parallelizable, 1.5-2 days each)
**Plan 12-01: DB Migration + Branding Token API**
- Migration: `accounts.background_color`, `accounts.background_shade` columns + enum
- Update `lib/branding/types.ts` + `read-branding.ts` + `brandingFromRow`
- Update `app/(shell)/app/branding/_lib/{schema,actions,load-branding}.ts` to handle new fields
- Update `BrandedPage` to expose `--brand-bg-color`, `--brand-bg-shade` CSS vars (additive — don't break consumers)
- New helper `lib/branding/gradient.ts` — `<GradientBackdrop>` component
- Tests: schema validation, contrast.ts unchanged, brandingFromRow returns new fields with defaults
- **Blocks:** Plans 12-04, 12-05, 12-06 (consumers)

**Plan 12-02: Auth Pages Restyle (NSI Tokens)**
- `/(auth)/app/login`, `/signup`, `/forgot-password`, `/verify-email`
- `/auth/reset-password`, `/auth/auth-error`
- New component `components/nsi-gradient-backdrop.tsx` (fixed NSI colors — `#0A2540` + 'subtle')
- Cruip hero with NSI brand: gradient backdrop, headline, value-prop copy alongside form
- **Preserve:** existing `getClaims` redirects, `searchParams.reset` flash banners, all Server Actions
- **Doesn't block anything** — auth surfaces are isolated.

### Wave 2 — Dashboard Core (sequential, depends on 12-01)
**Plan 12-03: Dashboard Sidebar IA Refactor + Floating Header Pill**
- `app/(shell)/layout.tsx`: replace mobile-only header with floating glass pill on all viewports
- `components/app-sidebar.tsx`: rebuild navigation
  - NEW order: Home, Event Types, Availability, Bookings, Branding, Settings (accordion → Reminders, Profile)
  - Inline accordion for Settings (controlled `useState`)
  - Mobile: existing hamburger → drawer pattern (verify full-screen overlay — adjust `--sidebar-width-mobile` if needed)
- Tailwind `@theme` `globals.css`: add `--background: oklch(0.98 0 0)` for gray-50 base
- **Blocks:** 12-04 (Home tab plugs into the new IA)

**Plan 12-04: Home Tab — Monthly Calendar + Day Drawer**
- New route: `app/(shell)/app/home/page.tsx` (server component) OR keep at `/app` and refactor existing page
  - **Recommendation:** keep at `/app`. Move OnboardingChecklist into a small banner above the calendar. Single landing surface.
- New components: `home-calendar.tsx` (client wrapper, custom DayButton with capped dots), `day-detail-sheet.tsx`, `day-detail-row.tsx`
- New server lib: `_lib/load-month-bookings.ts`
- Server Action: `regenerate_reschedule_token(bookingId)` (or accept that copy-link uses a fresh-issued token and emails will be invalidated — call out in plan)
- Wire existing `cancelBookingAsOwnerAction` (Phase 6) for inline cancel
- New Server Action: `sendReminderForBookingAction(bookingId)` — calls existing `sendReminderBooker` send-now path

### Wave 3 — Public-Facing Restyles (parallelizable, depend on 12-01)
**Plan 12-05: Public Booking + Embed + /[account] Index Restyle**
- `app/[account]/page.tsx`: hero w/ gradient + footer accents per CONTEXT.md
- `app/[account]/[event-slug]/page.tsx` + `_components/booking-shell.tsx`: same hero treatment, slot-picker section in clean white/gray-50
- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx`: full restyle including gradient (CONTEXT lock)
- Embed snippet dialog: widen to `sm:max-w-2xl` (1-line config change in widget config dialog — verify path)
- Inter typography globally (already loaded via `next/font` — need to confirm; otherwise enable)
- All section rhythm `py-12 md:py-20`, `max-w-3xl` slot picker
- Section: `<GradientBackdrop>` consuming `--brand-bg-color`/`--brand-bg-shade`

**Plan 12-06: Email Restyle (6 Templates) + Plain-Text Alternatives + NSI Mark**
- Add `public/nsi-mark.png` asset; update `NSI_MARK_URL` in `branding-blocks.ts`
- New helper `renderEmailBrandedHeader(branding)` — solid-color band w/ logo (CONTEXT lock: identical across all 6)
- Migrate all 6 senders: `send-booking-confirmation`, `send-owner-notification`, `send-cancel-emails` (×2 booker/owner), `send-reschedule-emails` (×2 booker/owner)
- Plain-text alternative: confirmation locked. Recommend extending to all booker-facing (cancel, reschedule) — minimal cost, uses existing `stripHtml` helper.
- Branding-editor preview iframe (`preview-iframe.tsx`) might need a query-param tweak to forward `previewBgColor` / `previewBgShade`.
- All 6 senders accept `account.background_color` + `account.background_shade` in their record types — additive.

### Wave Summary
- **Wave 1:** 12-01, 12-02 (parallel; ~2d wall-clock if both go in one PR session, ~3d sequential)
- **Wave 2:** 12-03 → 12-04 (sequential; 12-04 depends on 12-03 sidebar; ~2d each)
- **Wave 3:** 12-05, 12-06 (parallel; ~2d each)

**Total estimated effort:** ~10-12d sequential, ~6-8d with parallelization.
**Plan count:** 6 (within CONTEXT.md's 5-7 estimate).

## Open Questions

### 1. Reschedule-link copy in day-detail drawer — invalidation tradeoff
**What we know:** Reschedule tokens are stored as SHA-256 hashes (Phase 6 design). To "Copy reschedule link" we need the raw token — only available at issue-time.
**What's unclear:** Whether owners are OK with copy-link rotating the token (and thus invalidating the link in the booker's emails).
**Recommendation:** Plan 12-04 task should add an explicit confirmation dialog: "Copying a new link will invalidate the link previously sent to {booker_name}. Continue?" Phase 8 reminder-rotation precedent supports this UX.

### 2. Inter font — already loaded?
**What we know:** Cruip uses `next/font` to load Inter. Repo `globals.css` has `--font-sans: var(--font-sans)` referencing a CSS var — but the actual `next/font` import isn't visible in the files I read.
**What's unclear:** Whether Inter is already wired in `app/layout.tsx`, or whether Phase 12 needs to add it.
**Recommendation:** Plan 12-03 task #1 — verify with `grep "next/font" app/layout.tsx`. If absent, add `import { Inter } from "next/font/google"; const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });` and apply to root layout.

### 3. `regenerate_reschedule_token` — RPC vs. Server Action
**What we know:** Phase 6 mints tokens server-side via `lib/booking-tokens.ts`. New RPC needed for owner-initiated re-issue.
**What's unclear:** Whether this should be a Postgres RPC (consistent with Phase 8 pattern) or a Server Action calling lib helpers.
**Recommendation:** Server Action — token rotation is owner-only (owner_user_id check via existing `current_owner_account_ids` RPC). Keep RPC surface lean.

### 4. Mobile sidebar full-screen vs. side-drawer
**What we know:** CONTEXT.md says "full-screen drawer." shadcn Sidebar mobile mode defaults to ~18rem side drawer.
**What's unclear:** Whether owner expects literal `w-full` or just "wide enough to be the dominant surface."
**Recommendation:** Override `--sidebar-width-mobile` to `100vw` in `:root` block of `globals.css` → mobile sidebar fills viewport. Easy to revisit if it feels too aggressive.

### 5. Empty-calendar state copy
**What we know:** CONTEXT.md flags this as Claude's discretion.
**Recommendation:** "No bookings in {month name}. Bookings will appear here as they're scheduled." Single line, muted color, centered. No CTA needed (event types are the booking source — no point steering owner there from Home).

### 6. Default landing tab
**What we know:** CONTEXT.md flags this as Claude's discretion.
**Recommendation:** Home tab at `/app` (CONTEXT.md success criteria #2 says `/app/home (or /app)`). Keep `/app` and move OnboardingChecklist into a small dismissible banner above the calendar. New owners see checklist; established owners see today's bookings at-a-glance.

## Sources

### Primary (HIGH confidence)
- **Codebase direct read** (verified via Read tool, current main branch as of 2026-04-28):
  - `package.json` — Next 16.2.4, React 19.2.5, Tailwind 4.2, react-day-picker 9.14, all shadcn primitives installed
  - `app/(shell)/layout.tsx` — current sidebar/mobile-header pattern
  - `app/(shell)/app/page.tsx` — current `/app` landing (OnboardingChecklist + WelcomeCard)
  - `app/(shell)/app/branding/_components/branding-editor.tsx` — current branding form pattern
  - `app/(shell)/app/branding/_lib/{schema,actions}.ts` — current branding write path
  - `lib/branding/{types,read-branding,contrast}.ts` — current branding read API
  - `lib/email/branding-blocks.ts` — email rendering helpers, NSI mark currently null
  - `lib/email/send-booking-confirmation.ts` + `send-reminder-booker.ts` — sender patterns
  - `app/_components/branded-page.tsx` — `--brand-primary`/`--brand-text` CSS var convention
  - `components/app-sidebar.tsx` — current 2-group sidebar
  - `components/ui/sheet.tsx` — Sheet primitive (Radix Dialog) confirmed installed
  - `components/ui/calendar.tsx` — react-day-picker v9 wrapper, custom DayButton already in use
  - `app/[account]/page.tsx` + `app/embed/[account]/[event-slug]/page.tsx` — public/embed entry points
  - `supabase/migrations/` — confirmed background_color/background_shade do NOT exist yet
- **[Cruip tailwind-landing-page-template GitHub raw source](https://github.com/cruip/tailwind-landing-page-template)** — verbatim hero, page-illustration, header components fetched 2026-04-28
- **[react-day-picker v9 docs — Custom Modifiers](https://daypicker.dev/guides/custom-modifiers)** — modifier API
- **[react-day-picker v9 docs — Custom Components](https://daypicker.dev/guides/custom-components)** — DayButton override pattern
- **[react-day-picker v9 release notes](https://github.com/gpbl/react-day-picker/discussions/2280)** — confirmed v9 stable

### Secondary (MEDIUM confidence)
- **[Cruip "Simple" demo](https://simple.cruip.com/)** — visual reference (live site)
- **caniemail.com** (general knowledge — `<table bgcolor>` 100% support is well-known) — solid-color email header pattern
- WebSearch results on Cruip aesthetic — corroborate Inter/gray-50/blue gradient findings

### Tertiary (LOW confidence — flagged for validation in plan tasks)
- Default `--sidebar-width-mobile` value (18rem) — assumed from shadcn defaults; verify via `grep` in `components/ui/sidebar.tsx` at task start
- `next/font` already loading Inter — assumed from `globals.css` font var pattern; verify via `grep "next/font" app/layout.tsx`
- `SidebarMenuSub` exported from installed `components/ui/sidebar.tsx` — assumed from shadcn defaults; verify at task start

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package verified in package.json
- Architecture patterns (Cruip): HIGH — pulled verbatim from Cruip GitHub raw source
- Architecture patterns (sidebar accordion): MEDIUM — pattern is standard but `SidebarMenuSub` export needs grep-confirm
- Pitfalls: HIGH for compile-time issues (Tailwind JIT, RSC client boundary), MEDIUM for runtime (token rotation UX is judgement)
- Plan slicing: MEDIUM — 6 plans is a defensible cut but Andrew may prefer 5 or 7 based on PR-size preference
- Visual regression recommendation: HIGH — Playwright not installed, infra setup cost confirmed

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30d — Cruip pattern + react-day-picker v9 are stable; revisit if Tailwind v5 ships)
