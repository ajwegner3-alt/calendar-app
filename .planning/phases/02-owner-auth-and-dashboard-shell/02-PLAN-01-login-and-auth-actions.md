---
phase: 02-owner-auth-and-dashboard-shell
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - components.json
  - components/ui/button.tsx
  - components/ui/input.tsx
  - components/ui/label.tsx
  - components/ui/alert.tsx
  - components/ui/card.tsx
  - components/ui/sidebar.tsx
  - lib/utils.ts
  - app/globals.css
  - app/(auth)/app/login/schema.ts
  - app/(auth)/app/login/actions.ts
  - app/(auth)/app/login/login-form.tsx
  - app/(auth)/app/login/page.tsx
  - app/auth/signout/route.ts
autonomous: true

must_haves:
  truths:
    - "User can navigate to /app/login and see a centered card with NSI branding, email + password fields, and a Sign in button (AUTH-01)"
    - "Submitting valid credentials signs the user in via Supabase and redirects to /app (AUTH-01)"
    - "Submitting invalid credentials shows a generic 'Invalid email or password.' banner above the form (no user enumeration)"
    - "POST /auth/signout clears the Supabase session and redirects to /app/login (AUTH-02)"
    - "Visiting /app/login while already authenticated redirects to /app"
  artifacts:
    - path: "app/(auth)/app/login/actions.ts"
      provides: "loginAction Server Action + LoginState type + zod schema re-export"
      exports: ["loginAction", "LoginState"]
      contains: "use server"
    - path: "app/(auth)/app/login/schema.ts"
      provides: "Shared Zod loginSchema + LoginInput type"
      exports: ["loginSchema", "LoginInput"]
    - path: "app/(auth)/app/login/login-form.tsx"
      provides: "Client component — RHF + Zod + useActionState form"
      contains: "use client"
      min_lines: 50
    - path: "app/(auth)/app/login/page.tsx"
      provides: "Server component — already-authenticated bounce + centered card"
      min_lines: 10
    - path: "app/auth/signout/route.ts"
      provides: "POST route handler that calls supabase.auth.signOut() and redirects"
      exports: ["POST"]
    - path: "app/globals.css"
      provides: "NSI primary color + shadcn sidebar color tokens as CSS vars"
      contains: "--color-primary"
    - path: "components/ui/sidebar.tsx"
      provides: "shadcn Sidebar primitive suite (installed via CLI)"
  key_links:
    - from: "app/(auth)/app/login/login-form.tsx"
      to: "app/(auth)/app/login/actions.ts"
      via: "useActionState(loginAction, initialState)"
      pattern: "useActionState\\(loginAction"
    - from: "app/(auth)/app/login/actions.ts"
      to: "lib/supabase/server.ts"
      via: "await createClient()"
      pattern: "createClient\\(\\)"
    - from: "app/(auth)/app/login/actions.ts"
      to: "Supabase Auth"
      via: "supabase.auth.signInWithPassword"
      pattern: "signInWithPassword"
    - from: "app/auth/signout/route.ts"
      to: "Supabase Auth"
      via: "supabase.auth.signOut"
      pattern: "signOut"
---

<objective>
Install Phase 2 dependencies and shadcn primitives, set NSI branding CSS vars, and ship the complete login surface: the `/app/login` page with a centered card, an RHF + Zod + `useActionState` client form, the canonical Supabase Server Action that handles signin, and a POST `/auth/signout` route handler that clears the session.

Purpose: Covers AUTH-01 (login) and AUTH-02 (logout primitive). This plan lands the shadcn/Tailwind foundation (deps + components + CSS vars) that Plan 02 depends on.

Output: A user can navigate to `/app/login`, see a branded login card, submit credentials, get either an inline error or a successful redirect to `/app`, and POST to `/auth/signout` to clear their session.
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

# Existing Phase 1 modules this plan wires into
@lib/supabase/server.ts
@lib/supabase/client.ts
@app/globals.css
@app/layout.tsx
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install deps, scaffold shadcn, and set NSI CSS vars</name>
  <files>package.json, package-lock.json, components.json, components/ui/button.tsx, components/ui/input.tsx, components/ui/label.tsx, components/ui/alert.tsx, components/ui/card.tsx, components/ui/sidebar.tsx, lib/utils.ts, app/globals.css</files>
  <action>
Install runtime deps:

```bash
npm install react-hook-form @hookform/resolvers zod lucide-react
```

Initialize shadcn/ui (it will auto-detect Tailwind v4 + Next.js 16). If prompted for style pick `new-york`, base color `slate`, CSS variables = yes:

```bash
npx shadcn@latest init
```

This creates `components.json`, `lib/utils.ts` (the `cn()` helper), and seeds `app/globals.css` with shadcn's base CSS variables. **Preserve any existing line in `app/globals.css`** (currently just `@import "tailwindcss";`) — shadcn init will merge, not clobber, but verify with `git diff` after.

Then add the required components in one batch (accept all prompts — these pull in Radix peer deps automatically):

```bash
npx shadcn@latest add button input label alert card sidebar
```

Confirm the following files now exist and are non-empty:
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/label.tsx`
- `components/ui/alert.tsx`
- `components/ui/card.tsx`
- `components/ui/sidebar.tsx`
- `lib/utils.ts`
- `components.json`

**Add NSI brand tokens to `app/globals.css`.** After the shadcn init output, append (or merge into the `@theme` block it created) the following NSI-specific tokens. The file should end up with a single `@theme` block that contains both shadcn's base tokens and these NSI overrides:

```css
@theme {
  /* NSI brand — hardcoded for Phase 2; Phase 7 swaps to per-account DB lookup */
  --color-primary: #0A2540;
  --color-primary-foreground: #FFFFFF;
  --color-accent: #F97316;

  /* shadcn sidebar tokens — NSI-themed */
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

If shadcn already wrote `--color-sidebar-*` defaults, OVERRIDE them with the NSI values above (shadcn's defaults are neutral greys; NSI wants the deep-navy brand).

DO NOT:
- Do not remove `@import "tailwindcss";` at the top of globals.css.
- Do not add any tailwind.config.ts — Tailwind v4 is CSS-first (`@theme` directive); no JS config needed.
- Do not touch `lib/supabase/*` — Phase 1's modules are already correct.
- Do not install `@supabase/ssr` or `@supabase/supabase-js` — both already in package.json from Phase 1.

After all installs + CSS edits, run `npm run build` to verify the dep graph resolves and Tailwind v4 accepts the new tokens. Commit.
  </action>
  <verify>
```bash
# All required files exist
ls components/ui/{button,input,label,alert,card,sidebar}.tsx lib/utils.ts components.json

# Deps present
node -e "const p=require('./package.json');['react-hook-form','@hookform/resolvers','zod','lucide-react'].forEach(n=>{if(!p.dependencies[n]&&!p.devDependencies[n])throw new Error('missing '+n);});console.log('deps ok');"

# CSS contains NSI tokens
grep -q "color-primary: #0A2540" app/globals.css && echo "NSI tokens ok"
grep -q "color-sidebar-primary: #0A2540" app/globals.css && echo "sidebar tokens ok"

# Build passes (Tailwind v4 validates @theme)
npm run build
```
  </verify>
  <done>
All 7 shadcn files exist, `components.json` and `lib/utils.ts` are committed, `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react` are in `package.json` dependencies, `app/globals.css` contains the NSI `@theme` block with `--color-primary: #0A2540` and the full `--color-sidebar-*` NSI set, and `npm run build` exits 0.

Commit: `chore(02-01): install auth deps and scaffold shadcn components`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Ship login schema + Server Action + Route Handler logout</name>
  <files>app/(auth)/app/login/schema.ts, app/(auth)/app/login/actions.ts, app/auth/signout/route.ts</files>
  <action>
Create three files. **Paste the code below verbatim — it is the canonical shape from RESEARCH §1a, §1b, §2a.**

**File 1 — `app/(auth)/app/login/schema.ts`** (shared by client + server):

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

**File 2 — `app/(auth)/app/login/actions.ts`** (the Server Action — CANONICAL Supabase pattern):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "./schema";

export type LoginState = {
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
  formError?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // 1. Server-side Zod re-validation (defense in depth).
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 2. Supabase auth. createClient is async (Phase 1 uses await cookies()).
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Generic for 400 (credentials) — do NOT distinguish email-unknown vs
    // wrong-password (user enumeration). Only tailor 429 + 5xx.
    // Gate on error.status, not error.code (upstream auth-js bug: code is
    // undefined on invalid credentials — RESEARCH §7.3).
    let formError = "Invalid email or password.";
    if (error.status === 429) {
      formError = "Too many attempts. Please wait a minute and try again.";
    } else if (!error.status || error.status >= 500) {
      formError = "Something went wrong. Please try again.";
    }
    return { formError };
  }

  // 3. Success. revalidatePath busts the root layout cache so the shell
  //    re-renders with the new session. redirect() throws NEXT_REDIRECT —
  //    MUST be outside any try/catch (RESEARCH §7.1).
  revalidatePath("/", "layout");
  redirect("/app");
}
```

**File 3 — `app/auth/signout/route.ts`** (Route Handler, NOT Server Action — Supabase canonical; NextResponse.redirect avoids NEXT_REDIRECT try/catch gotchas):

```ts
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Avoid calling signOut on an already-signed-out session.
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  return NextResponse.redirect(new URL("/app/login", req.url), { status: 302 });
}
```

Key rules (do not deviate):
- `redirect("/app")` must be the LAST statement in `loginAction` and must NOT be wrapped in try/catch. It throws `NEXT_REDIRECT`; catching swallows the navigation (RESEARCH §7.1).
- Error handling gates on `error.status` (400/429/5xx), NEVER on `error.code` (upstream auth-js bug per RESEARCH §7.3).
- Generic message "Invalid email or password." for ALL 400s. No per-field distinction.
- Logout is a POST Route Handler + `NextResponse.redirect`, NOT a Server Action. Supabase canonical pattern per RESEARCH §1b.
- Both files import from `@/lib/supabase/server` (the existing Phase 1 module). Do NOT create a new client here.

DO NOT:
- Do not call `supabase.auth.signInWithPassword` from a Client Component — credentials must stay off the client bundle.
- Do not return `error.message` verbatim (user enumeration).
- Do not add `redirectTo` query-param preservation (CONTEXT.md defers to v2).
  </action>
  <verify>
```bash
# Files exist
ls "app/(auth)/app/login/schema.ts" "app/(auth)/app/login/actions.ts" "app/auth/signout/route.ts"

# Server Action marker + correct shape
grep -q '"use server"' "app/(auth)/app/login/actions.ts" && echo "use server ok"
grep -q "signInWithPassword" "app/(auth)/app/login/actions.ts" && echo "signin call ok"
grep -q 'redirect("/app")' "app/(auth)/app/login/actions.ts" && echo "redirect ok"
grep -q "error.status === 429" "app/(auth)/app/login/actions.ts" && echo "status-gated errors ok"

# Signout route shape
grep -q "export async function POST" "app/auth/signout/route.ts" && echo "POST handler ok"
grep -q "NextResponse.redirect" "app/auth/signout/route.ts" && echo "redirect ok"

# Build passes
npm run build
```
  </verify>
  <done>
All 3 files exist, `loginAction` imports `createClient` from `@/lib/supabase/server`, calls `signInWithPassword` + `revalidatePath` + `redirect`, gates error messages on `error.status`, and the signout Route Handler calls `supabase.auth.signOut()` before `NextResponse.redirect` to `/app/login`. `npm run build` exits 0.

Commit: `feat(02-01): add login server action and signout route handler`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Ship login page (server component) + client form</name>
  <files>app/(auth)/app/login/page.tsx, app/(auth)/app/login/login-form.tsx</files>
  <action>
Create two files. The route group `(auth)/` does NOT add a URL segment, so `app/(auth)/app/login/page.tsx` resolves to the public URL `/app/login` (RESEARCH §3b, layout option 2).

**File 1 — `app/(auth)/app/login/page.tsx`** (Server Component — bounces already-authenticated users):

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/app");

  return (
    <main className="min-h-screen grid place-items-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold text-primary">NSI</div>
          <div className="text-sm text-muted-foreground mt-1">
            North Star Integrations
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
```

**File 2 — `app/(auth)/app/login/login-form.tsx`** (Client Component — RHF + Zod + `useActionState` bridge per RESEARCH §2b):

```tsx
"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {state.formError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
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
        </form>
      </CardContent>
    </Card>
  );
}
```

Key rules:
- The page is a Server Component. The form is a separate Client Component — this is required because `useActionState` and `useForm` are client-side hooks.
- Use raw `<form action={formAction}>` (NOT `<Form>` from `next/form` — it's optional; stick with raw for simpler a11y per RESEARCH §7.10).
- Use shadcn's raw `<Input>` + RHF `register` (NOT shadcn's `<FormField>` / `<Form>` wrapper — decision documented per CONTEXT.md Claude's Discretion).
- `mode: "onBlur"` for RHF — immediate feedback when a field loses focus.
- `isPending` from `useActionState` drives the spinner; no `useState` for loading.
- `autoComplete="email"` and `autoComplete="current-password"` are load-bearing for password managers.
- `redirect("/app")` in the page's server component is safe — no enclosing try/catch.

DO NOT:
- Do not import `createClient` from `@/lib/supabase/client` in the form — credentials stay off the client bundle; all auth goes through the Server Action.
- Do not add "Forgot password?" link (v2).
- Do not add "Sign up" link (v2; no public signup in v1).
- Do not add a `redirectTo` query-param read on the page.
  </action>
  <verify>
```bash
# Files exist
ls "app/(auth)/app/login/page.tsx" "app/(auth)/app/login/login-form.tsx"

# Page is a server component (no "use client" at top)
! grep -q '"use client"' "app/(auth)/app/login/page.tsx" && echo "page is server component ok"
grep -q "redirect(\"/app\")" "app/(auth)/app/login/page.tsx" && echo "already-authenticated bounce ok"

# Form is a client component with useActionState
grep -q '"use client"' "app/(auth)/app/login/login-form.tsx" && echo "form is client ok"
grep -q "useActionState(loginAction" "app/(auth)/app/login/login-form.tsx" && echo "useActionState ok"
grep -q "zodResolver(loginSchema)" "app/(auth)/app/login/login-form.tsx" && echo "zod resolver ok"
grep -q "autoComplete=\"current-password\"" "app/(auth)/app/login/login-form.tsx" && echo "autocomplete ok"

# Build passes
npm run build

# Start dev server and hit the login page
npm run dev &
sleep 8
curl -sI http://localhost:3000/app/login | grep "HTTP/1.1 200" && echo "login page serves 200"
curl -s http://localhost:3000/app/login | grep -qi "sign in" && echo "login page renders"
kill %1 2>/dev/null || true
```
  </verify>
  <done>
`/app/login` returns HTTP 200 in dev and renders a centered card with "NSI" branding, email and password fields, and a "Sign in" button. The page is a Server Component (no "use client" directive). `LoginForm` is a Client Component that uses `useActionState(loginAction, ...)` and `zodResolver(loginSchema)`. Submitting empty email/password shows inline RHF validation errors; submitting bad credentials (once Plan 04 creates the user) will show the "Invalid email or password." banner. `npm run build` exits 0.

Deviation note (MAJOR 3 from plan checker): Login form uses raw `<form action={formAction}>` rather than RESEARCH §2b's `next/form <Form>` wrapper — stylistic choice, behavior identical for Server Action submission. No functional impact; flagged here so the executor summarizes it correctly rather than looking like unintended drift.

Commit: `feat(02-01): add login page and client form`. Push.
  </done>
</task>

</tasks>

<verification>
Run the full plan verification:

```bash
# 1. Build + lint
npm run build
npm run lint

# 2. All files exist
ls components/ui/{button,input,label,alert,card,sidebar}.tsx
ls "app/(auth)/app/login/"{schema.ts,actions.ts,login-form.tsx,page.tsx}
ls app/auth/signout/route.ts
ls lib/utils.ts components.json

# 3. Existing Phase 1 tests still green (no regression on RLS/race tests)
npm test

# 4. Manual smoke — login page serves
npm run dev &
sleep 8
curl -sI http://localhost:3000/app/login | head -1
kill %1 2>/dev/null || true
```

Do NOT attempt to sign in end-to-end in this plan — Andrew's auth user doesn't exist yet (Plan 04). A generic "Invalid email or password." banner on submission is the expected happy path for this plan's verification.
</verification>

<success_criteria>
- [ ] `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react` in `package.json` dependencies
- [ ] shadcn scaffolded: `components.json`, `lib/utils.ts`, and `components/ui/{button,input,label,alert,card,sidebar}.tsx` all exist
- [ ] `app/globals.css` contains NSI `@theme` block with `--color-primary: #0A2540` and full `--color-sidebar-*` token set
- [ ] `app/(auth)/app/login/schema.ts` exports `loginSchema` + `LoginInput`
- [ ] `app/(auth)/app/login/actions.ts` is a Server Action (`"use server"`) that imports from `@/lib/supabase/server`, calls `signInWithPassword`, gates errors on `error.status`, `revalidatePath`s layout, and `redirect("/app")` OUTSIDE any try/catch
- [ ] `app/(auth)/app/login/login-form.tsx` is a Client Component using `useActionState(loginAction, ...)` + RHF + Zod
- [ ] `app/(auth)/app/login/page.tsx` is a Server Component that bounces authenticated users to `/app`
- [ ] `app/auth/signout/route.ts` exports a POST handler that calls `supabase.auth.signOut()` and `NextResponse.redirect`s to `/app/login`
- [ ] `npm run build` and `npm run lint` exit 0
- [ ] Existing Vitest suite (`race-guard.test.ts`, `rls-anon-lockout.test.ts`) still green
- [ ] `curl -sI http://localhost:3000/app/login` returns HTTP 200 in dev
- [ ] Each task committed atomically + pushed (3 commits total)
</success_criteria>

<output>
After completion, create `.planning/phases/02-owner-auth-and-dashboard-shell/02-01-SUMMARY.md` documenting:
- Shadcn components installed + versions
- NSI color token values (for Phase 7 reference)
- Server Action shape (confirming `error.status` gating, `redirect` placement)
- Any deviations from RESEARCH §1a/1b/2b (expected deviation: Task 3 uses raw `<form action={formAction}>` rather than RESEARCH §2b's `next/form <Form>` wrapper — stylistic choice, behavior identical for Server Action submission; flagged by plan checker MAJOR 3 and documented here so it reads as a planned choice, not drift).
</output>
</output>
