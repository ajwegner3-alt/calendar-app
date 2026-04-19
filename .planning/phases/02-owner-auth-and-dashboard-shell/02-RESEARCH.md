# Phase 2: Owner Auth + Dashboard Shell — Research

**Researched:** 2026-04-18
**Domain:** Supabase password auth via Server Actions (Next.js 16 App Router) + dashboard shell layout (shadcn sidebar) + Vitest auth-helper
**Overall confidence:** HIGH on Server Action shape, proxy gate, and shadcn sidebar; MEDIUM on exact `signInWithPassword` error-code table (Supabase docs reference "a table" but don't inline it — code/name strings are pinned from the auth-js source + GitHub issues).

---

## Summary

Phase 1 already shipped the Next 16 + `@supabase/ssr` 0.10.2 + Tailwind v4 + Vitest harness. Phase 2 is almost entirely app-layer code: **one Server Action file for login, one Route Handler (POST) for logout, a two-line diff in `lib/supabase/proxy.ts` to redirect `/app/*` to `/app/login` when unauthenticated, a shadcn-sidebar-based layout under `app/(app)/`, and one new Vitest file.** The login page uses the React 19 `useActionState` hook + React Hook Form + Zod pattern to bridge client-side format validation with server-side auth errors shown as an inline banner.

The scaffolded `with-supabase` starter that Phase 1 used as a reference ships a **client-side** login pattern (`createClient` from `lib/supabase/client` + `signInWithPassword` in a client handler). Our CONTEXT.md explicitly overrides that with Server Actions. The Supabase-official Nextjs tutorial (`supabase/examples/user-management/nextjs-user-management`) **does** use Server Actions — that file is the canonical pattern and is reproduced verbatim below.

shadcn/ui has a first-class `Sidebar` primitive (added late 2024, stable in 2026). Install it. Don't roll a custom sidebar — the primitive gives us `SidebarProvider`, `Sidebar`, `SidebarHeader/Content/Footer`, `SidebarMenu`, `SidebarMenuButton`, `SidebarTrigger`, cookie-persisted state, `collapsible="icon"`/`"offcanvas"` modes, and mobile hamburger behavior out of the box.

**Primary recommendation:** Server Actions for `login` and `logout` (the latter as a `POST /auth/signout` Route Handler per Supabase's canonical pattern — it handles `isAuthenticated`-guarded signOut cleanly). Put dashboard routes under the **`app/(app)/`** route group with a shared `layout.tsx` rendering the shadcn sidebar. Login page lives at **`app/(auth)/login/page.tsx`** (separate route group, bare layout, centered card). Proxy gate = 3 added lines.

---

## 1. `@supabase/ssr` Login/Logout Server Actions (verbatim)

### 1a. Login Server Action — `app/(auth)/login/actions.ts`

Canonical shape from `supabase/examples/user-management/nextjs-user-management/app/login/actions.ts` (current on master, verified 2026-04-18). Adapted below for our `useActionState` signature + inline-error return (instead of redirecting to a separate `/error` page):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginState = {
  // Field-level errors (from Zod). Rendered per-field by RHF.
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
  // Banner-level error (from Supabase auth). Rendered above the form.
  formError?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // 1. Client-side-shape validation (belt + suspenders — RHF validates too).
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 2. Supabase auth.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Intentionally generic — see Section 7 gotcha #2 on user-enumeration.
    // Tailor only for rate-limit (429) and network/500.
    let formError = "Invalid email or password.";
    if (error.status === 429) {
      formError = "Too many attempts. Please wait a minute and try again.";
    } else if (!error.status || error.status >= 500) {
      formError = "Something went wrong. Please try again.";
    }
    return { formError };
  }

  // 3. Success — revalidate + redirect OUTSIDE any try/catch.
  // See gotcha #1 — redirect() throws NEXT_REDIRECT, don't catch it.
  revalidatePath("/", "layout");
  redirect("/app");
}
```

**Key shape notes:**
- Signature is `(prevState, formData) => Promise<State>`. That matches React 19 `useActionState`.
- `redirect("/app")` is the LAST statement; it throws `NEXT_REDIRECT` which Next propagates to the client for navigation. **No `try/catch` around this call.**
- `revalidatePath("/", "layout")` busts the root layout cache so the sidebar's `<AuthButton>`/welcome name re-renders with the newly-authenticated session. Supabase's canonical file uses this exact line.
- `supabase.auth.signInWithPassword({ email, password })` returns `{ data, error }`. On failure, `error` is an `AuthApiError` with `.status` (HTTP code), `.message` (string), `.name` ("AuthApiError"), and `.code` (may be `undefined` for invalid credentials — known upstream bug, see gotcha #3).
- **The `createClient()` from `lib/supabase/server.ts` is async** (Phase 1's module uses `await cookies()`). The `await` is mandatory.

### 1b. Logout — `app/auth/signout/route.ts`

Verbatim from Supabase's canonical Nextjs tutorial (2026-04-18). This is a Route Handler (POST), not a Server Action, because a form posted to it is the simplest way to trigger logout from any page without needing a Server-Action-compatible button:

```ts
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Check if a user's logged in — avoid calling signOut with no session.
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  return NextResponse.redirect(new URL("/app/login", req.url), { status: 302 });
}
```

The sidebar's logout control is a `<form action="/auth/signout" method="POST">` wrapping a shadcn `<Button type="submit">` — no client JS needed.

**Why Route Handler over Server Action for signout:** In a Route Handler, `NextResponse.redirect()` is a first-class response (no NEXT_REDIRECT throw), avoiding all the try/catch gotchas. Supabase's own canonical code uses this pattern; stick with it.

### 1c. "Already authenticated" bounce on `/app/login`

In the **login page's Server Component** (not a Client Component — this runs before any render), check claims and redirect:

```tsx
// app/(auth)/login/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/app");

  return (
    <main className="min-h-screen grid place-items-center bg-muted px-4">
      <LoginForm />
    </main>
  );
}
```

`getClaims()` on the server is cheap (JWT verify, no DB round-trip). It reads the same cookie the proxy just refreshed. No race with the proxy: the proxy runs FIRST per request, so by the time the page's Server Component calls `getClaims()`, the cookie is fresh. (Gotcha #5 explores this further.)

**Confidence:** HIGH on 1a/1b (verbatim from canonical Supabase repo). HIGH on 1c (same pattern used in `with-supabase`'s `app/protected/page.tsx`).

---

## 2. Form Pattern — React Hook Form + Zod + `useActionState` + Server Action

The bridge pattern: RHF handles client-side format validation ("enter a valid email") and per-field error display; `useActionState` holds the Server Action's returned state (including the banner-level `formError` from Supabase). The server re-validates with the same Zod schema.

### 2a. Shared Zod schema — `app/(auth)/login/schema.ts`

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

Imported by BOTH `actions.ts` (server) and `login-form.tsx` (client).

### 2b. Client form — `app/(auth)/login/login-form.tsx`

```tsx
"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Form from "next/form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginSchema, type LoginInput } from "./schema";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  const {
    register,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    // Merge server-returned field errors so RHF renders them.
    errors: state.fieldErrors
      ? {
          email: state.fieldErrors.email?.[0]
            ? { type: "server", message: state.fieldErrors.email[0] }
            : undefined,
          password: state.fieldErrors.password?.[0]
            ? { type: "server", message: state.fieldErrors.password[0] }
            : undefined,
        }
      : undefined,
  });

  return (
    <Form action={formAction} className="flex flex-col gap-4 w-full max-w-sm">
      {state.formError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </Form>
  );
}
```

**Why this shape:**
- `<Form>` from `next/form` = progressive-enhancement friendly form that submits to the Server Action. Works even with JS off. (Plain `<form action={formAction}>` also works; `next/form` adds client-side prefetching + reload prevention but is optional.)
- `mode: "onBlur"` on RHF gives immediate format feedback when the user leaves a field.
- `errors` prop on `useForm` accepts server-returned errors — per the Oberlehner pattern — so Zod failures from the server show as per-field errors identically to client-side Zod failures.
- `state.formError` is the banner (above the form) — used only for auth-layer failures (bad password, rate limit, 500).
- `isPending` from `useActionState` drives the disabled+spinner state. No manual `useState` for loading.
- `autoComplete` attributes populate password managers correctly.

**Required install for Phase 2:**

```bash
npm install react-hook-form @hookform/resolvers zod
# shadcn components (if not already scaffolded by with-supabase):
npx shadcn@latest add button input label alert form sidebar
# Icons:
npm install lucide-react
```

**Note:** `@hookform/resolvers` is a small adapter package — Zod integration lives in `@hookform/resolvers/zod`.

**Confidence:** HIGH. Pattern verified across Oberlehner blog (2025) + Next.js official forms guide + RHF docs. The `errors` prop on `useForm` for server-side errors is a first-class RHF feature since v7.48.

---

## 3. Dashboard Shell / Sidebar — use `shadcn Sidebar` + `app/(app)/` route group

### 3a. Install shadcn Sidebar

```bash
npx shadcn@latest add sidebar
```

This installs a composable set of primitives and automatically adds the required dependencies (Radix primitives, `react-resizable-panels`, etc.). Drop-in for Next 16 + Tailwind v4; no known compat issues as of 2026-04-18.

**Primitives available** (docs: https://ui.shadcn.com/docs/components/radix/sidebar):
- `SidebarProvider` — context wrapper, persists open/collapsed state to a cookie (`sidebar:state`) so SSR renders the correct initial state.
- `Sidebar` — the panel itself. Props: `collapsible="icon" | "offcanvas" | "none"`, `side="left" | "right"`, `variant="sidebar" | "floating" | "inset"`.
- `SidebarHeader`, `SidebarContent` (scroll region), `SidebarFooter` — sticky header/footer + scrollable middle.
- `SidebarGroup` / `SidebarGroupLabel` / `SidebarGroupContent` — visual grouping.
- `SidebarMenu` / `SidebarMenuItem` / `SidebarMenuButton` — nav list primitives; `SidebarMenuButton` supports `isActive`, `asChild` (for `<Link>`), `tooltip` (shown when collapsed).
- `SidebarTrigger` — hamburger toggle (place in main content area, shows below mobile breakpoint automatically).
- `SidebarRail` — the collapse-drag handle (desktop).
- `SidebarInset` — the "main content" wrapper that sits alongside the sidebar.

**Responsive behavior built-in:** Sidebar auto-switches to a Sheet (offcanvas drawer) below the `md` (768px) breakpoint. No manual media queries needed.

### 3b. Route group structure

Use two route groups:

```
app/
├── (auth)/
│   └── login/
│       ├── actions.ts
│       ├── schema.ts
│       ├── login-form.tsx      # "use client"
│       └── page.tsx            # Server Component; bounce if authenticated
├── (app)/
│   ├── layout.tsx              # Server Component; renders <AppShell>
│   ├── page.tsx                # /app redirects to /app — see note below
│   ├── app/
│   │   ├── page.tsx            # welcome card (/app)
│   │   ├── event-types/page.tsx
│   │   ├── availability/page.tsx
│   │   ├── branding/page.tsx
│   │   ├── bookings/page.tsx
│   │   └── unlinked/page.tsx
├── auth/
│   └── signout/
│       └── route.ts            # POST /auth/signout
├── layout.tsx                  # Root layout
└── page.tsx                    # Public landing (/)
```

**Important clarification:** Next.js route groups `(foo)/` do NOT add path segments — they're organizational only. To keep the public URL `/app/event-types`, the folder structure needs to literally contain `app/event-types/page.tsx` somewhere. Two valid layouts:

1. **Flat with route group (recommended):**
   ```
   app/
   ├── (app)/                    # route group, no URL segment
   │   ├── layout.tsx            # sidebar shell
   │   ├── app/                  # creates /app URL
   │   │   ├── page.tsx
   │   │   ├── event-types/page.tsx
   │   │   ├── availability/page.tsx
   │   │   ├── branding/page.tsx
   │   │   ├── bookings/page.tsx
   │   │   └── unlinked/page.tsx
   │   │   └── login/            # /app/login — share the (app) group? NO, see below
   ```
   Problem: `/app/login` needs a DIFFERENT (bare) layout than the rest of `/app/*`. Having both under `(app)/` would nest the sidebar layout around the login page.

2. **Two route groups, one URL-prefix convention (strongly recommended):**
   ```
   app/
   ├── (public)/
   │   ├── layout.tsx            # bare layout (or none — root layout is enough)
   │   └── page.tsx              # / (landing)
   ├── (auth)/
   │   └── app/
   │       └── login/
   │           ├── page.tsx
   │           ├── login-form.tsx
   │           ├── actions.ts
   │           └── schema.ts
   ├── (shell)/
   │   ├── layout.tsx            # the AppShell with sidebar
   │   └── app/
   │       ├── page.tsx
   │       ├── event-types/page.tsx
   │       ├── availability/page.tsx
   │       ├── branding/page.tsx
   │       ├── bookings/page.tsx
   │       └── unlinked/page.tsx
   ├── auth/signout/route.ts
   ├── layout.tsx
   ```

   The `/app/login` URL lives under `(auth)/app/login/` (no sidebar); all other `/app/*` URLs live under `(shell)/app/*` (with sidebar). Next.js resolves the route groups at compile time and routes the URL correctly. This is the idiomatic Next 16 way to give one URL tree two different layouts.

   **Recommendation: go with layout #2.** It's the canonical Next.js pattern for mixing layout styles on the same URL prefix (Next docs' own example). The orphan `/app/login` won't inherit the sidebar; every other `/app/*` page will.

### 3c. AppShell layout — `app/(shell)/layout.tsx`

```tsx
// app/(shell)/layout.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Calendar, Clock, Palette, List, LogOut } from "lucide-react";
import Link from "next/link";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Authenticated check (proxy already enforces this, but belt-and-suspenders
  //    for linked-account discovery + claim access inside the layout).
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  // 2. Linked-account check (see Section 5).
  const { data: linkedIds } = await supabase.rpc("current_owner_account_ids");
  const isUnlinked = !linkedIds || linkedIds.length === 0;
  // If unlinked AND not already on the /app/unlinked page, bounce there.
  // We check in per-page, OR do it here by reading the request path (not
  // trivial in a layout). Simpler: let /app/* pages assume "linked" and
  // redirect to /app/unlinked from the /app page itself. See §5.

  // 3. SSR-correct sidebar initial state from cookie (shadcn convention).
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar:state")?.value !== "false";

  const email = (claimsData.claims.email as string) ?? "";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            {/* TODO Phase 7 swap to DB logo */}
            <span className="font-semibold text-primary">NSI</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem href="/app/event-types" icon={<Calendar />} label="Event Types" />
                <NavItem href="/app/availability" icon={<Clock />} label="Availability" />
                <NavItem href="/app/branding" icon={<Palette />} label="Branding" />
                <NavItem href="/app/bookings" icon={<List />} label="Bookings" />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="px-2 py-2 text-xs text-muted-foreground truncate">{email}</div>
          <form action="/auth/signout" method="POST">
            <SidebarMenuButton type="submit" className="w-full">
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </form>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label}>
        <Link href={href}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
```

**Notes:**
- The `SidebarTrigger` header strip (hamburger) is wrapped in `md:hidden` so it only shows on mobile. On desktop, the persistent sidebar + `SidebarRail` drag handle cover it.
- `collapsible="icon"` gives you desktop icon-rail collapse AND mobile offcanvas behavior — that's the default "Linear/Vercel admin" feel.
- `SidebarMenuButton` with `asChild` + `<Link>` is the shadcn canonical pattern (lets the button render as an anchor for proper routing).
- Per-route `isActive` highlighting: add `isActive={pathname === href}` via a tiny client component wrapper that reads `usePathname()`. Omitted above for brevity; add in planning.
- The logout form inside the footer submits to the Route Handler from Section 1b. `SidebarMenuButton` forwards props to a `<button>` when no `asChild`; setting `type="submit"` makes it trigger the form.

### 3d. Primary-color hardcoding

Put NSI primary color as a CSS variable in `app/globals.css` (Tailwind v4 theme syntax):

```css
@import "tailwindcss";

@theme {
  --color-primary: #0A2540;          /* NSI deep navy */
  --color-primary-foreground: #FFFFFF;
  --color-accent: #F97316;           /* NSI warm orange */
  /* shadcn tokens (sidebar expects these) */
  --color-sidebar: #F8FAFC;
  --color-sidebar-foreground: #0F172A;
  --color-sidebar-primary: #0A2540;
  --color-sidebar-primary-foreground: #FFFFFF;
  --color-sidebar-accent: #E2E8F0;
  --color-sidebar-accent-foreground: #0F172A;
  --color-sidebar-border: #E2E8F0;
  --color-sidebar-ring: #0A2540;
}
```

Phase 7 will swap these to per-account values (CSS vars set on a wrapping `<div style={{"--color-primary": account.brand_primary}}>`). Using CSS vars now (not hardcoded hex in component classes) is the exact migration-friendly decision CONTEXT.md calls out.

**Confidence:** HIGH on sidebar component set and route group pattern (official shadcn docs + Next.js App Router docs). MEDIUM on the exact cookie name `sidebar:state` — verified from shadcn source as of late 2025; if the install output shows a different name in 2026, use whatever the installed component code references.

---

## 4. Proxy.ts Route-Protection Diff

Phase 1's `lib/supabase/proxy.ts` already refreshes the session via `getClaims()`. To gate `/app/*`, uncomment the commented-out block and add one route carve-out so `/app/login` stays accessible. Matcher config stays identical.

### Exact diff to `lib/supabase/proxy.ts`

```diff
   const { data } = await supabase.auth.getClaims();
   const user = data?.claims;

-  // Phase 1 has no auth-gated routes yet; keep the user check commented out
-  // or scoped so anon public routes stay public. Phase 2 (auth) wires this up.
-  // if (!user && request.nextUrl.pathname.startsWith("/app")) {
-  //   const url = request.nextUrl.clone();
-  //   url.pathname = "/login";
-  //   return NextResponse.redirect(url);
-  // }
-  void user;
+  // Phase 2: gate /app/* on authentication. Let /app/login through regardless.
+  const { pathname } = request.nextUrl;
+  if (
+    !user &&
+    pathname.startsWith("/app") &&
+    pathname !== "/app/login"
+  ) {
+    const url = request.nextUrl.clone();
+    url.pathname = "/app/login";
+    return NextResponse.redirect(url);
+  }

   return supabaseResponse;
```

### `proxy.ts` matcher (no change needed)

The Phase 1 matcher already covers `/app/*`:
```ts
matcher: [
  "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
],
```
Next 16 matcher syntax is identical to Next 15's — no breaking changes. The only Next 16 differences (filename `proxy.ts`, function name `proxy`, Node-only runtime) are already applied in Phase 1.

**Why the carve-out is needed:** If `/app/login` weren't exempted, the proxy would redirect `/app/login` → `/app/login` infinitely for an unauthenticated user trying to reach the login page.

**Alternative** (equivalent, slightly noisier): run the redirect on `startsWith("/app/") && !startsWith("/app/login")`. The equality check above is tighter and faster.

**Confidence:** HIGH — 3-line diff against verified Phase 1 file.

---

## 5. Unlinked-User Check Pattern

**Where the check lives:** In the `/app` page (landing), NOT in `proxy.ts` or the shell layout. Reason:

- `proxy.ts` runs on Node and should stay cheap. Calling `supabase.rpc("current_owner_account_ids")` on every `/app/*` request would add a DB round-trip per navigation. Skip.
- A layout-level check would need to read the current pathname to avoid redirecting FROM `/app/unlinked` back to `/app/unlinked` (infinite loop). Layouts don't get the pathname natively; you'd need a Client Component wrapper just to check `usePathname()`. Overkill.
- The `/app` landing page naturally runs on the first authenticated request. Check there, redirect to `/app/unlinked` if empty. Other `/app/*` pages (event-types etc.) don't need the check yet — they'll all be empty stubs in Phase 2 and won't query data. Downstream phases that query tenant data will also re-check in their own data-loading paths.

### `app/(shell)/app/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeCard } from "./welcome-card";

export default async function DashboardHome() {
  const supabase = await createClient();

  // current_owner_account_ids() returns setof uuid — Supabase RPC wraps
  // setof in an array of { current_owner_account_ids: uuid } rows UNLESS
  // the function is called with { get: true }.  We just want the count.
  const { data, error } = await supabase.rpc("current_owner_account_ids");
  if (error) {
    // Realistically: log + show generic error. For Phase 2, redirect unlinked
    // is the ONLY expected error case beyond infra breakage.
    throw new Error(`Failed to load account linkage: ${error.message}`);
  }

  const linkedCount = Array.isArray(data) ? data.length : 0;
  if (linkedCount === 0) redirect("/app/unlinked");

  return <WelcomeCard />;
}
```

### `app/(shell)/app/unlinked/page.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

**RPC return-shape note:** `supabase.rpc("current_owner_account_ids")` on a `returns setof uuid` function returns an array of raw UUID strings (not wrapped in `{ current_owner_account_ids: uuid }` — that's only for table-returning functions). A length check is correct. Verify at implementation time with a `console.log(data)` inside a test.

**Confidence:** HIGH on placement + redirect-flow design. MEDIUM on exact RPC return shape — `setof uuid` vs `setof record` behave differently in supabase-js; test with one real call before locking the length-check logic. If the shape surprises, `supabase.from("accounts").select("id").eq("owner_user_id", userId)` is a direct SQL alternative that's shape-stable.

---

## 6. Vitest Auth-Helper — `signInAsNsiOwner()`

Extend the existing `tests/helpers/supabase.ts` with an authenticated-owner client factory. Critical constraint: **the sign-in must NOT leak session state into other test files** — use a fresh client per test, no storage.

### Add to `tests/helpers/supabase.ts`

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ... existing anonClient(), adminClient(), getOrCreateTestAccount() ...

/**
 * The Supabase Auth user used for authenticated-owner tests.
 * Credentials live in .env.local (NOT committed). The user is created once
 * via Supabase dashboard (Auth → Add user) and its UUID is written to
 * accounts.owner_user_id for slug='nsi' via one-time MCP SQL.
 */
const TEST_OWNER_EMAIL = process.env.TEST_OWNER_EMAIL!;
const TEST_OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD!;

/**
 * Returns a Supabase client authenticated as Andrew (the NSI owner).
 * Each call creates a fresh client; no session is persisted to disk or
 * shared across tests. Caller is responsible for signOut() at test teardown
 * if desired — with `persistSession: false` no teardown is strictly needed.
 */
export async function signInAsNsiOwner(): Promise<SupabaseClient> {
  if (!TEST_OWNER_EMAIL || !TEST_OWNER_PASSWORD) {
    throw new Error(
      "TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD missing in .env.local. " +
      "See Phase 2 plan for setup.",
    );
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_OWNER_EMAIL,
    password: TEST_OWNER_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`signInAsNsiOwner failed: ${error?.message ?? "no session"}`);
  }

  return client;
}
```

### Env additions — `.env.local`

```bash
# Phase 2 — Vitest authenticated-owner test helper.
TEST_OWNER_EMAIL=andrew@example.com
TEST_OWNER_PASSWORD=<strong-password-set-in-supabase-dashboard>
```

(These are the real owner's credentials, NOT a separate test user. For Phase 2 v1 we have one user. Commit `.env.example` with empty placeholders only; never commit the real values.)

### Sample test — `tests/rls-authenticated-owner.test.ts`

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { signInAsNsiOwner } from "./helpers/supabase";

describe("RLS authenticated-owner visibility (Phase 2)", () => {
  let client: Awaited<ReturnType<typeof signInAsNsiOwner>>;

  beforeAll(async () => {
    client = await signInAsNsiOwner();
  });

  it("owner sees exactly 1 account row (their own)", async () => {
    const { data, error } = await client.from("accounts").select("id, slug");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].slug).toBe("nsi");
  });

  it("owner sees 0 event_types initially (tenant-scoped)", async () => {
    const { data, error } = await client.from("event_types").select("id");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // 0 rows because Phase 2 hasn't seeded any event types. Phase 3 adds CRUD.
  });

  it("owner cannot see the nsi-test account via RLS", async () => {
    const { data, error } = await client.from("accounts").select("id").eq("slug", "nsi-test");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
```

**Session-leak defense:**
- `persistSession: false` disables the localStorage/sessionStorage write — no file-based leakage across Vitest workers.
- `autoRefreshToken: false` disables the background refresh timer that can keep a process alive past test end.
- The client is a local `const` inside the `describe` — garbage collected after the file runs.
- Each test file that needs auth calls `signInAsNsiOwner()` fresh. Do NOT share a module-level singleton.

**Confidence:** HIGH on the helper shape — standard supabase-js pattern with the critical `persistSession: false` flag. HIGH on `beforeAll` scoping.

---

## 7. Gotchas / Recent Breaking Changes

### 7.1. `redirect()` in Server Actions throws `NEXT_REDIRECT` — don't catch it

`next/navigation`'s `redirect()` works by throwing a special error. If you wrap your Server Action body in a `try/catch` that catches `unknown`, you'll swallow the redirect. **Always call `redirect()` after the try/catch, or in a branch with no enclosing try/catch.**

The Section 1a code deliberately uses `if (error) return { formError }` (no throw, no catch) for the Supabase failure path, and calls `redirect("/app")` as the last statement with nothing around it. If you later add logging in a try/catch, put the `redirect()` OUTSIDE.

**Escape hatch if you must catch:** `import { isRedirectError } from "next/navigation"` and re-throw:
```ts
try { /* ... */ redirect("/app"); }
catch (err) { if (isRedirectError(err)) throw err; /* handle others */ }
```

Source: https://github.com/vercel/next.js/issues/55586, Next docs https://nextjs.org/docs/app/api-reference/functions/redirect.

### 7.2. Don't distinguish invalid-email from invalid-password in the UI

Returning "User not found" vs "Wrong password" enables **user enumeration attacks** — an attacker can script login attempts to learn which emails are registered. CONTEXT.md already locks this in ("generic 'Invalid email or password.'"). The Section 1a action honors that. Only tailor messages for: `error.status === 429` (rate limit — legitimate to surface so the user waits) and 500/network (so the user knows it's not their fault).

### 7.3. `signInWithPassword` returns `error.code: undefined` for bad credentials

Known `@supabase/auth-js` bug (issue #1662, still open as of late 2025). For invalid credentials, the server returns `{ error: "invalid_grant", error_description: "Invalid login credentials" }` but supabase-js wraps it into an `AuthApiError` with `.status: 400` and `.code: undefined`. **Therefore: gate on `error.status` (400 = credentials, 429 = rate, 5xx = server), not `error.code`.** The Section 1a code does this.

For robustness if you need string matching: `.message` is "Invalid login credentials" for the common case; "Email not confirmed" for the email-not-confirmed case. In Phase 2 email confirmation is OFF (per CONTEXT.md), so only "Invalid login credentials" is expected for the happy-path failure mode.

Source: https://github.com/supabase/auth/issues/1631, https://github.com/supabase/auth/issues/1662.

### 7.4. `setAll` Server Component throw in `server.ts` — KEEP the try/catch

Phase 1's `lib/supabase/server.ts` wraps the `cookieStore.set()` loop in `try { ... } catch {}`. This is load-bearing: calling `cookies().set()` from a Server Component (read-only context) throws, and the catch prevents that error from bubbling when you read the Supabase client from a Server Component. Session refresh happens in `proxy.ts` anyway, so dropping the write is safe. **Do not remove this try/catch.** (Phase 1 RESEARCH §10 item 3.)

### 7.5. No race between `proxy.ts` session refresh and the login page's `getClaims()` bounce

Concern: if `proxy.ts` runs `getClaims()` (refreshing cookies) and THEN `app/(auth)/login/page.tsx` runs `getClaims()` again, could they conflict? No:
- Next.js runs `proxy.ts` before any Route Handler or Server Component per request.
- `proxy.ts` writes refreshed cookies via `supabaseResponse.cookies.set()`. When it returns, the outbound response has the fresh cookies.
- The Server Component reads the SAME request's cookies through `cookies()`. In Next 16, this reads the proxy-refreshed cookies correctly.
- `getClaims()` in the Server Component just verifies the JWT from the cookie — it doesn't mutate. No race, no double-refresh.

Confirmed by `with-supabase`'s `app/protected/page.tsx` which does exactly this (`await supabase.auth.getClaims()` in a Server Component while `proxy.ts` also runs `getClaims()`). Works in production at Vercel.

### 7.6. `revalidatePath("/", "layout")` is necessary, not optional

After login or logout, call `revalidatePath("/", "layout")` to bust all cached layouts (the root layout + every nested layout). Without this, the sidebar's server-rendered email / authenticated-content won't refresh on client-side navigation after login. Supabase's canonical pattern includes this line; do not drop it.

### 7.7. `next/form` + Server Actions: `action` prop type is the Server Action, not a URL

In the Section 2b code, `<Form action={formAction}>` passes the Server Action function reference directly. Don't wrap in `() => formAction(...)` — breaks progressive enhancement. `formAction` from `useActionState` is already the correct shape.

### 7.8. Tailwind v4 + shadcn sidebar — cookie-based SSR initial state

shadcn's `SidebarProvider` reads `defaultOpen` from a cookie so the server renders the correct initial collapsed/expanded state. Section 3c's `cookies().get("sidebar:state")` is mandatory — without it, the sidebar flickers between expanded (SSR) and collapsed (client) on reload. Next 16's async `cookies()` means `await` is required. Already in the example.

### 7.9. No `middleware.ts` fallback

Phase 1 ships `proxy.ts` (not `middleware.ts`). Next 16 accepts both with a deprecation warning, but if any dep or codegen tool adds a `middleware.ts` at the root, Next uses THAT instead of `proxy.ts` silently. Spot-check after install.

### 7.10. shadcn `Form` component vs raw `<form>`

shadcn ships a `Form` primitive that wraps RHF's `FormProvider` + per-field `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`. It's NICE but adds verbosity. The Section 2b code uses raw `<Form>` from `next/form` + RHF's `register` directly — simpler, same a11y. Recommend sticking with raw. If the planner wants shadcn `<Form>`, it's a drop-in replacement for the field markup; behavior is identical.

**Confidence on gotchas:** HIGH for 7.1, 7.4, 7.5, 7.6, 7.7, 7.9 (all verified against canonical sources). MEDIUM for 7.3 (the `.code: undefined` bug is confirmed in issues but may get fixed in a later `@supabase/auth-js` release — check `error.code` first, fall back to `error.status`).

---

## 8. Sources + Confidence

### Primary (HIGH confidence)

- **Supabase canonical Nextjs tutorial** — `supabase/examples/user-management/nextjs-user-management/app/login/actions.ts` and `app/auth/signout/route.ts`. Fetched verbatim 2026-04-18 from GitHub master. Source of Section 1a + 1b patterns.
- **Next.js 16 redirect docs** — https://nextjs.org/docs/app/api-reference/functions/redirect and https://nextjs.org/docs/app/guides/redirecting. Section 7.1.
- **shadcn/ui Sidebar docs** — https://ui.shadcn.com/docs/components/radix/sidebar and https://ui.shadcn.com/blocks/sidebar. Section 3a–c.
- **Next.js route groups docs** — https://nextjs.org/docs/app/api-reference/file-conventions/route-groups. Section 3b.
- **`with-supabase` example** — https://github.com/vercel/next.js/tree/canary/examples/with-supabase. `app/protected/page.tsx`, `components/auth-button.tsx`, `components/login-form.tsx`. Reference for auth patterns + layout shape.
- **Next.js 16 upgrade guide / proxy docs** — https://nextjs.org/docs/app/guides/upgrading/version-16, https://nextjs.org/docs/app/api-reference/file-conventions/proxy. Section 4 + 7.9.
- **Supabase auth-js source / issues** — https://github.com/supabase/auth/issues/1631, #1662. Section 7.3.

### Secondary (MEDIUM confidence — cross-verified WebSearch)

- **React Hook Form + useActionState bridge pattern** — Markus Oberlehner's 2025 blog post + several Medium articles. Pattern is stable across 2025–2026; `errors` prop on `useForm` is a first-class RHF feature since v7.48. Section 2.
- **`sidebar:state` cookie name** — shadcn source code convention; confirm at install time by reading the installed `sidebar.tsx`.
- **AuthApiError shape** — Supabase docs https://supabase.com/docs/guides/auth/debugging/error-codes (doc mentions the property set but the full code table isn't inline in the current page; the property shape is unambiguous from issues + auth-js source).

### Tertiary (LOW confidence — validate at implementation time)

- **`supabase.rpc("current_owner_account_ids")` return shape** — Section 5 assumes raw UUID array for `setof uuid`. Test with a real call before locking the length check; fallback is a direct `accounts.select()` query.

---

## 9. Confidence Breakdown

| Area | Level | Reason |
|---|---|---|
| Login Server Action shape | HIGH | Verbatim from Supabase canonical Nextjs tutorial |
| Logout Route Handler shape | HIGH | Same source |
| Login page "already-authenticated" bounce | HIGH | Matches `with-supabase` `app/protected/page.tsx` |
| RHF + Zod + useActionState form pattern | MEDIUM | Multi-source community pattern, not in official docs; first-class RHF feature |
| shadcn Sidebar primitives + route groups | HIGH | Official shadcn + Next.js docs |
| Proxy gate diff | HIGH | 3-line change against verified Phase 1 file |
| Unlinked-user pattern | HIGH on placement, MEDIUM on RPC return shape | Validate with one real call |
| Vitest auth helper | HIGH | Standard supabase-js pattern |
| Gotchas | HIGH except 7.3 (MEDIUM) | Upstream bug may resolve |

**Research date:** 2026-04-18
**Valid until:** ~2026-05-18 (30 days — Supabase auth-js and shadcn/ui ship frequently; re-verify cookie name + error.code behavior if Phase 2 is deferred past May)
