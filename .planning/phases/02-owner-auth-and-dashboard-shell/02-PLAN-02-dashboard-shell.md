---
phase: 02-owner-auth-and-dashboard-shell
plan: 02
type: execute
wave: 2
depends_on: ["02-01"]
files_modified:
  - app/(shell)/layout.tsx
  - app/(shell)/app/page.tsx
  - app/(shell)/app/event-types/page.tsx
  - app/(shell)/app/availability/page.tsx
  - app/(shell)/app/branding/page.tsx
  - app/(shell)/app/bookings/page.tsx
  - app/(shell)/app/unlinked/page.tsx
  - components/app-sidebar.tsx
  - components/welcome-card.tsx
autonomous: true

must_haves:
  truths:
    - "Authenticated user visiting /app sees a welcome card with 3 next-step callouts (Event Types, Availability, Branding) (DASH-01)"
    - "Every /app/* route shows a fixed left sidebar with nav links to Event Types, Availability, Branding, Bookings (DASH-01)"
    - "Sidebar collapses to a hamburger below 768px (shadcn Sidebar built-in)"
    - "User-menu at the bottom of the sidebar shows email + Log out button that POSTs to /auth/signout (AUTH-02)"
    - "Stub pages for /app/event-types, /app/availability, /app/branding, /app/bookings each render a heading + 'Coming in Phase N' placeholder (DASH-01)"
    - "Authenticated user whose account has no linked account_id is redirected to /app/unlinked when visiting /app (the landing page). Stub pages at /app/event-types, /app/availability, /app/branding, /app/bookings do not perform the check in Phase 2 — they are empty placeholders and will inherit the check when they start querying tenant data in Phases 3/4/7/8."
  artifacts:
    - path: "app/(shell)/layout.tsx"
      provides: "Shell layout with shadcn Sidebar, auth guard, cookie-based SSR state"
      min_lines: 50
      contains: "SidebarProvider"
    - path: "components/app-sidebar.tsx"
      provides: "The sidebar component (header + nav menu + footer with user-menu + logout form)"
      contains: "SidebarMenu"
    - path: "components/welcome-card.tsx"
      provides: "Welcome card with 3 next-step callouts"
      min_lines: 20
    - path: "app/(shell)/app/page.tsx"
      provides: "Dashboard landing — calls current_owner_account_ids RPC, renders WelcomeCard or redirects to /app/unlinked"
      contains: "current_owner_account_ids"
    - path: "app/(shell)/app/event-types/page.tsx"
      provides: "Stub for EVENT-* (Phase 3)"
    - path: "app/(shell)/app/availability/page.tsx"
      provides: "Stub for AVAIL-* (Phase 4)"
    - path: "app/(shell)/app/branding/page.tsx"
      provides: "Stub for BRAND-* (Phase 7)"
    - path: "app/(shell)/app/bookings/page.tsx"
      provides: "Stub for DASH-02/03/04 (Phase 8)"
    - path: "app/(shell)/app/unlinked/page.tsx"
      provides: "Error page for authenticated users not linked to an account"
  key_links:
    - from: "app/(shell)/layout.tsx"
      to: "lib/supabase/server.ts"
      via: "await createClient() + getClaims()"
      pattern: "getClaims\\(\\)"
    - from: "components/app-sidebar.tsx"
      to: "app/auth/signout/route.ts"
      via: "<form action='/auth/signout' method='POST'>"
      pattern: "action=\"/auth/signout\""
    - from: "app/(shell)/app/page.tsx"
      to: "Supabase RPC"
      via: "supabase.rpc('current_owner_account_ids')"
      pattern: "current_owner_account_ids"
    - from: "app/(shell)/app/page.tsx"
      to: "app/(shell)/app/unlinked/page.tsx"
      via: "redirect('/app/unlinked') when RPC returns empty"
      pattern: "redirect\\(\"/app/unlinked\"\\)"
---

<objective>
Ship the authenticated dashboard shell: a route-group layout (`app/(shell)/`) that renders the shadcn Sidebar + auth guard + cookie-based SSR state, the `/app` landing page with a welcome card and `current_owner_account_ids` linkage check, four empty stub pages for the future nav destinations, and the `/app/unlinked` error page.

Purpose: Covers DASH-01 (nav between event types, availability, branding, bookings) and completes the UI wiring for AUTH-02 (logout button). Sets the layout foundation every subsequent phase (3–8) builds inside.

Output: An authenticated user lands on `/app`, sees a branded sidebar with 4 working nav links, clicks through to stub pages for each, and can log out from the user-menu at the bottom of the sidebar.

Scoping note (BLOCKER 1 from plan checker): The `current_owner_account_ids()` linkage check lives ONLY on `/app/page.tsx` per RESEARCH §5's intentional layering decision. Authenticated-but-unlinked users hitting `/app/event-types`, `/app/availability`, `/app/branding`, or `/app/bookings` directly (via URL or bookmark) will see the empty stub, NOT a redirect to `/app/unlinked`. This is acceptable in Phase 2 because the stubs render zero tenant data. Phases 3/4/7/8 inherit the check naturally: the moment each page starts querying event_types/availability_rules/branding/bookings scoped by `current_owner_account_ids()`, an unlinked user will get an empty result and the phase will either render empty-state UX or add its own `/app/unlinked` redirect — whichever fits that phase's UX. Do NOT add a layout-level check in Phase 2 (RESEARCH §5 rejected it: layouts can't read pathname cleanly, and running the RPC on every `/app/*` navigation adds a round-trip for no gain).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-owner-auth-and-dashboard-shell/02-CONTEXT.md
@.planning/phases/02-owner-auth-and-dashboard-shell/02-RESEARCH.md

# Plan 01 artifacts this plan depends on
@app/auth/signout/route.ts
@components/ui/sidebar.tsx
@components/ui/card.tsx
@components/ui/button.tsx
@app/globals.css
@lib/supabase/server.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ship the shell layout + AppSidebar component</name>
  <files>app/(shell)/layout.tsx, components/app-sidebar.tsx</files>
  <action>
Create the shell layout and its sidebar component. The `(shell)` route group has no URL segment — nested `app/(shell)/app/*/page.tsx` files resolve to `/app/*` URLs (RESEARCH §3b, layout option 2).

**File 1 — `components/app-sidebar.tsx`** (Client Component — uses `usePathname` for active-link highlight):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Palette,
  Inbox,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { href: "/app/event-types", label: "Event Types", icon: CalendarDays },
  { href: "/app/availability", label: "Availability", icon: Clock },
  { href: "/app/branding", label: "Branding", icon: Palette },
  { href: "/app/bookings", label: "Bookings", icon: Inbox },
] as const;

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/app" className="flex items-center gap-2 px-2 py-2">
          <span className="text-lg font-semibold text-primary">NSI</span>
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Bookings
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
          {email}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action="/auth/signout" method="POST" className="w-full">
              <SidebarMenuButton type="submit" tooltip="Log out" className="w-full">
                <LogOut />
                <span>Log out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
```

**File 2 — `app/(shell)/layout.tsx`** (Server Component — auth guard + cookie-based SSR state per RESEARCH §3c):

```tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth guard (belt + suspenders — proxy.ts also gates, but layout-level check
  // also unlocks direct access to claims for the sidebar footer).
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  // Cookie-based SSR state for shadcn Sidebar (prevents flicker).
  // Next 16 cookies() is async — await is required (RESEARCH §7.8).
  // Cookie name is "sidebar:state" (colon) per shadcn convention (RESEARCH §3d/§7.8).
  // MUST match the literal used inside the installed components/ui/sidebar.tsx —
  // the verify step hard-asserts this.
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar:state")?.value !== "false";

  const email = (claimsData.claims.email as string | undefined) ?? "";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar email={email} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-medium text-primary">NSI</span>
        </header>
        <div className="p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

Key rules:
- The layout's `redirect("/app/login")` must be outside try/catch (RESEARCH §7.1).
- The cookie name used by shadcn sidebar is `"sidebar:state"` (colon) per RESEARCH §3d/§7.8. **The verify block below hard-asserts the literal in `layout.tsx` matches the literal in the installed `components/ui/sidebar.tsx`.** If shadcn's installed version happens to ship `"sidebar_state"` (underscore) instead, update the layout's literal to match — the assertion will fail and point to the mismatch. Do NOT guess; make the two sides agree exactly.
- `collapsible="icon"` gives the Linear/Vercel admin feel — desktop icon-rail + mobile offcanvas. Do not use `collapsible="offcanvas"` or `"none"`.
- The `SidebarTrigger` header strip is wrapped in `md:hidden` so hamburger only appears below 768px. Above that, the persistent sidebar + rail handle the collapse UX.
- The logout `<form action="/auth/signout" method="POST">` wraps a `SidebarMenuButton` with `type="submit"` — no client JS, just HTML form posting to the Route Handler from Plan 01.
- Use Lucide icons: `CalendarDays`, `Clock`, `Palette`, `Inbox`, `LogOut` (CONTEXT.md Claude's Discretion — these are idiomatic choices). Note that RESEARCH §3c's example uses `List` for Bookings; we use `Inbox` (MAJOR 4 plan-checker deviation note — trivial stylistic choice, swap post-Phase-2 if preferred).
- `group-data-[collapsible=icon]:hidden` is a shadcn Sidebar convention — hides text labels when the sidebar collapses to the icon rail.
- Do NOT read per-account branding from DB here. NSI-hardcoded via CSS vars in `app/globals.css` (Plan 01); Phase 7 swaps to DB lookup.

DO NOT:
- Do not add the `current_owner_account_ids` RPC check in the layout — that lives on the `/app` page only (RESEARCH §5 placement decision: layouts can't read pathname cleanly, and running the RPC on every `/app/*` navigation adds a round-trip for no gain). See the objective's "Scoping note" for the full coverage story.
- Do not add a "Settings" link to the sidebar (deferred per CONTEXT.md).
- Do not read `accounts.brand_primary` or `accounts.logo_url`.
  </action>
  <verify>
```bash
# Files exist
ls "app/(shell)/layout.tsx" components/app-sidebar.tsx

# Layout shape
grep -q "getClaims()" "app/(shell)/layout.tsx" && echo "auth guard ok"
grep -q 'redirect("/app/login")' "app/(shell)/layout.tsx" && echo "unauth redirect ok"
grep -q "SidebarProvider" "app/(shell)/layout.tsx" && echo "provider ok"
grep -q "AppSidebar" "app/(shell)/layout.tsx" && echo "sidebar used ok"

# Sidebar shape
grep -q 'collapsible="icon"' components/app-sidebar.tsx && echo "icon-rail mode ok"
grep -q 'action="/auth/signout"' components/app-sidebar.tsx && echo "logout form ok"
grep -q "usePathname" components/app-sidebar.tsx && echo "active highlight ok"
grep -qE "CalendarDays|Clock|Palette|Inbox" components/app-sidebar.tsx && echo "lucide icons ok"

# BLOCKER 2 — HARD ASSERTION: cookie literal in layout.tsx MUST match the literal
# inside the installed components/ui/sidebar.tsx. Fail loudly if they diverge.
INSTALLED=$(grep -oE '"sidebar[_:]state"' components/ui/sidebar.tsx | head -1)
LAYOUT=$(grep -oE '"sidebar[_:]state"' "app/(shell)/layout.tsx" | head -1)
[ -n "$INSTALLED" ] && [ "$INSTALLED" = "$LAYOUT" ] || { echo "Sidebar cookie name mismatch: installed=$INSTALLED, layout=$LAYOUT"; exit 1; }
echo "sidebar cookie literal matches installed shadcn sidebar: $INSTALLED"

npm run build
```
  </verify>
  <done>
`app/(shell)/layout.tsx` auth-guards on `getClaims`, redirects to `/app/login` when unauthenticated, reads the shadcn sidebar state cookie using the `"sidebar:state"` literal (verified against the installed `components/ui/sidebar.tsx` via hard-assertion grep — if the installed shadcn version ships a different literal, the assertion fails and the executor must update the layout to match), renders `<SidebarProvider><AppSidebar /><SidebarInset>{children}</SidebarInset></SidebarProvider>`. `components/app-sidebar.tsx` renders NSI branding in the header, 4 nav items with Lucide icons + `isActive` highlighting, and a logout form in the footer that POSTs to `/auth/signout`. `npm run build` exits 0.

Commit: `feat(02-02): add shell layout and app-sidebar component`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Ship /app landing, welcome card, and unlinked page</name>
  <files>app/(shell)/app/page.tsx, components/welcome-card.tsx, app/(shell)/app/unlinked/page.tsx</files>
  <action>
Create three files.

**File 1 — `components/welcome-card.tsx`** (presentational — no data, just 3 callouts):

```tsx
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays, Clock, Palette } from "lucide-react";

const NEXT_STEPS = [
  {
    href: "/app/event-types",
    icon: CalendarDays,
    title: "Create an event type",
    description: "Define what people can book (name, duration, questions).",
  },
  {
    href: "/app/availability",
    icon: Clock,
    title: "Set your availability",
    description: "Weekly hours, buffers, notice windows, daily cap.",
  },
  {
    href: "/app/branding",
    icon: Palette,
    title: "Pick your branding",
    description: "Upload a logo and pick a primary color.",
  },
] as const;

export function WelcomeCard() {
  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to NSI Bookings</CardTitle>
          <CardDescription>
            Get your booking page live in three quick steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {NEXT_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.href}
                href={step.href}
                className="rounded-lg border p-4 hover:bg-muted/60 transition"
              >
                <Icon className="h-5 w-5 text-primary mb-2" />
                <div className="font-medium">{step.title}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {step.description}
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
```

**File 2 — `app/(shell)/app/page.tsx`** (Server Component — does the `current_owner_account_ids` linkage check per RESEARCH §5):

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeCard } from "@/components/welcome-card";

export default async function DashboardHome() {
  const supabase = await createClient();

  // RESEARCH Open Question #1: verify the RPC return shape at runtime.
  // current_owner_account_ids() is `returns setof uuid`, which in supabase-js
  // returns an array of raw UUID strings (not wrapped objects). A length check
  // is correct. If this surprises in practice (e.g., shape is
  // [{current_owner_account_ids: uuid}, ...]), fall back to the direct query:
  //
  //   const { data } = await supabase
  //     .from("accounts")
  //     .select("id")
  //     .eq("owner_user_id", claims.sub);
  //
  // Plan 04 Task 3 inspects this shape end-to-end with a transient console.log
  // and documents the observed form in the plan-04 SUMMARY. If wrapped, the
  // length check below should become:
  //   data.filter(r => r.current_owner_account_ids).length === 0
  // Do NOT ship the console.log — it's transient, removed in the same commit.
  const { data, error } = await supabase.rpc("current_owner_account_ids");

  if (error) {
    // Infrastructure failure — surface rather than silently hide.
    throw new Error(`Failed to load account linkage: ${error.message}`);
  }

  const linkedCount = Array.isArray(data) ? data.length : 0;
  if (linkedCount === 0) redirect("/app/unlinked");

  return <WelcomeCard />;
}
```

**File 3 — `app/(shell)/app/unlinked/page.tsx`** (Server Component — dedicated error page):

```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UnlinkedPage() {
  return (
    <div className="max-w-md mx-auto mt-16">
      <Card>
        <CardHeader>
          <CardTitle>Account not linked</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Your login is valid, but it isn&apos;t linked to an organization yet.
            Contact the administrator to finish setup.
          </p>
          <form action="/auth/signout" method="POST">
            <Button type="submit" variant="outline" className="w-full">
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

Key rules:
- `/app/page.tsx` runs the linkage check on EVERY visit to `/app`. The RPC is cheap (one index lookup on `accounts.owner_user_id`).
- `redirect("/app/unlinked")` must be outside try/catch (RESEARCH §7.1).
- `redirect()` uses an absolute app path; no need for `request.url` building in Server Components.
- The `/app/unlinked` page re-uses the `/auth/signout` Route Handler from Plan 01 — same form pattern as the sidebar logout.
- The welcome card uses shadcn `Card` + `CardContent` primitives. Grid is `md:grid-cols-3` (stacks on mobile).
- Next-step callouts: 3 items only (Event Types / Availability / Branding). Bookings is a separate sidebar link, not a callout — per CONTEXT.md the callouts mirror setup-order phases.
- Copy is short and friendly (CONTEXT.md Claude's Discretion).
- Unlinked coverage (BLOCKER 1): this check fires ONLY when the user hits `/app`. Direct hits to `/app/event-types`, `/app/availability`, `/app/branding`, `/app/bookings` will NOT bounce unlinked users to `/app/unlinked` in Phase 2. This is intentional per RESEARCH §5 and the objective's "Scoping note" — Phases 3/4/7/8 inherit the check naturally when they start reading tenant data.

DO NOT:
- Do not add a fourth "Bookings" callout — not in scope for Phase 2 welcome copy.
- Do not add an "Account settings" link anywhere (deferred).
- Do not add query params or dynamic routing to `/app/unlinked`.
  </action>
  <verify>
```bash
# Files exist
ls "app/(shell)/app/page.tsx" components/welcome-card.tsx "app/(shell)/app/unlinked/page.tsx"

# Linkage check wired
grep -q "current_owner_account_ids" "app/(shell)/app/page.tsx" && echo "rpc call ok"
grep -q 'redirect("/app/unlinked")' "app/(shell)/app/page.tsx" && echo "unlinked redirect ok"
grep -q "WelcomeCard" "app/(shell)/app/page.tsx" && echo "welcome rendered ok"

# Welcome card has 3 callouts + links to phase targets
grep -q "/app/event-types" components/welcome-card.tsx && echo "event-types link ok"
grep -q "/app/availability" components/welcome-card.tsx && echo "availability link ok"
grep -q "/app/branding" components/welcome-card.tsx && echo "branding link ok"

# Unlinked page has logout
grep -q 'action="/auth/signout"' "app/(shell)/app/unlinked/page.tsx" && echo "unlinked has logout ok"

npm run build
```
  </verify>
  <done>
`/app` landing page calls `supabase.rpc("current_owner_account_ids")`, redirects to `/app/unlinked` if empty, otherwise renders `<WelcomeCard />`. `WelcomeCard` renders 3 callouts linking to `/app/event-types`, `/app/availability`, `/app/branding`. `/app/unlinked` renders a card with a "Contact the administrator" message + a Log out button that POSTs to `/auth/signout`. `npm run build` exits 0.

Commit: `feat(02-02): add dashboard landing welcome card and unlinked page`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Ship 4 sidebar nav stub pages</name>
  <files>app/(shell)/app/event-types/page.tsx, app/(shell)/app/availability/page.tsx, app/(shell)/app/branding/page.tsx, app/(shell)/app/bookings/page.tsx</files>
  <action>
Create 4 stub pages, one per sidebar nav link. Each is a Server Component with a heading + "Coming in Phase N" placeholder. No data, no forms — just enough to make the sidebar links navigable so route protection is testable.

Each file follows the same shape. Replace `{TITLE}`, `{DESCRIPTION}`, `{PHASE}` per the table below:

| File | Title | Description | Phase |
|---|---|---|---|
| `app/(shell)/app/event-types/page.tsx` | "Event Types" | "Define what people can book — name, slug, duration, custom questions." | 3 |
| `app/(shell)/app/availability/page.tsx` | "Availability" | "Weekly hours, per-date overrides, buffers, notice windows, daily cap." | 4 |
| `app/(shell)/app/branding/page.tsx` | "Branding" | "Upload a logo and set your primary color." | 7 |
| `app/(shell)/app/bookings/page.tsx` | "Bookings" | "Upcoming and past bookings will appear here once visitors book." | 8 |

Template (use for all 4, fill placeholders):

```tsx
export default function {PascalCaseFileName}Page() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">{TITLE}</h1>
      <p className="text-sm text-muted-foreground mt-2">
        {DESCRIPTION}
      </p>
      <p className="text-sm text-muted-foreground mt-4">
        Coming in Phase {PHASE}.
      </p>
    </div>
  );
}
```

Example for `app/(shell)/app/event-types/page.tsx`:

```tsx
export default function EventTypesPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Event Types</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Define what people can book — name, slug, duration, custom questions.
      </p>
      <p className="text-sm text-muted-foreground mt-4">
        Coming in Phase 3.
      </p>
    </div>
  );
}
```

Key rules:
- All 4 pages are Server Components (no `"use client"`).
- No data fetching, no Supabase calls, no forms.
- The Phase N reference must match the ROADMAP.md phase numbers (3, 4, 7, 8).
- Each stub inherits the shell layout's sidebar + auth guard automatically (via `(shell)/layout.tsx`).
- Unlinked users (BLOCKER 1): these stubs do NOT perform the `current_owner_account_ids()` check. Phase 2 ships them as empty placeholders; the check becomes free when Phases 3/4/7/8 start querying tenant data. This is the intentional scoping — do not try to add the check here.

DO NOT:
- Do not scaffold placeholder forms or tables "for Phase 3".
- Do not add any data-fetching logic.
- Do not add `"use client"` — no interactivity needed.
  </action>
  <verify>
```bash
# All 4 files exist
ls "app/(shell)/app/"{event-types,availability,branding,bookings}/page.tsx

# Each exports a default Page component
for p in event-types availability branding bookings; do
  grep -q "export default function" "app/(shell)/app/$p/page.tsx" && echo "$p default export ok"
done

# Each references the correct phase
grep -q "Phase 3" "app/(shell)/app/event-types/page.tsx" && echo "event-types phase ok"
grep -q "Phase 4" "app/(shell)/app/availability/page.tsx" && echo "availability phase ok"
grep -q "Phase 7" "app/(shell)/app/branding/page.tsx" && echo "branding phase ok"
grep -q "Phase 8" "app/(shell)/app/bookings/page.tsx" && echo "bookings phase ok"

npm run build
```
  </verify>
  <done>
All 4 stub pages exist, each is a Server Component exporting a default function that renders a heading + description + "Coming in Phase N" text. Each page references the correct phase number from ROADMAP.md (3/4/7/8). `npm run build` exits 0.

Commit: `feat(02-02): add sidebar nav stub pages for event-types, availability, branding, bookings`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# Build + lint
npm run build
npm run lint

# All files present
ls "app/(shell)/"{layout.tsx,app/page.tsx,app/unlinked/page.tsx}
ls "app/(shell)/app/"{event-types,availability,branding,bookings}/page.tsx
ls components/{app-sidebar,welcome-card}.tsx

# Existing tests still green
npm test
```

Manual end-to-end smoke (visual check; will fully verify in Plan 04):

- Run `npm run dev`.
- Visit `/app` WITHOUT a session → proxy redirects to `/app/login` (this works after Plan 03's proxy gate lands; before Plan 03, `/app` may render and then the shell layout's own `getClaims()` redirect kicks in).
- Once Plan 04 creates Andrew's auth user + links him, the full flow light up. Plan 02 only builds UI surfaces.
</verification>

<success_criteria>
- [ ] `app/(shell)/layout.tsx` exists, auth-guards via `getClaims`, reads shadcn sidebar cookie state, renders `SidebarProvider + AppSidebar + SidebarInset`
- [ ] Hard-assertion grep in Task 1 verify confirms the layout's sidebar cookie literal matches the literal inside installed `components/ui/sidebar.tsx` (no more "guess and hope")
- [ ] `components/app-sidebar.tsx` exists, renders NSI brand header, 4 nav items (Event Types / Availability / Branding / Bookings) with Lucide icons + `isActive` highlight, and a footer with email + logout form POSTing to `/auth/signout`
- [ ] `app/(shell)/app/page.tsx` calls `supabase.rpc("current_owner_account_ids")`, redirects to `/app/unlinked` on empty result, renders `<WelcomeCard />` otherwise
- [ ] `components/welcome-card.tsx` renders 3 callouts linking to `/app/event-types`, `/app/availability`, `/app/branding`
- [ ] `app/(shell)/app/unlinked/page.tsx` renders error card + Log out form
- [ ] All 4 nav stub pages exist and reference the correct phase number
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Existing Vitest suite still green
- [ ] Each task committed atomically + pushed (3 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/02-owner-auth-and-dashboard-shell/02-02-SUMMARY.md` documenting:
- Confirmed shadcn sidebar cookie name (whatever the installed `components/ui/sidebar.tsx` uses; hard-asserted in Task 1 verify)
- Observed shape of `current_owner_account_ids` RPC result on first run (raw UUID array vs wrapped objects) — for Phase 3 reuse reference (Plan 04 Task 3 is the actual shape-proof)
- Scoping note on unlinked-user coverage (BLOCKER 1 from plan checker): check lives only on `/app` (the landing page). Stubs at `/app/event-types`, `/app/availability`, `/app/branding`, `/app/bookings` do NOT perform the check in Phase 2 — they are empty placeholders and inherit the check when they start querying tenant data in Phases 3/4/7/8. This matches RESEARCH §5's intentional layering (layouts can't read pathname cleanly; per-route RPC adds round-trips for no gain). Document this clearly so a future reader doesn't mistake it for a coverage bug.
- Icon choice deviation (MAJOR 4 from plan checker): Bookings nav icon uses `Inbox` (discretionary); RESEARCH §3c's example used `List`. Swap trivially post-Phase-2 if preferred. No functional impact.
- Any other deviation from RESEARCH §3c / §5 (expected: none beyond the two above).
</output>
</output>
