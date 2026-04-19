---
phase: 02-owner-auth-and-dashboard-shell
plan: 01
subsystem: auth
tags: [supabase-auth, server-actions, react-hook-form, zod, shadcn, tailwind-v4, next-16, useActionState]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "lib/supabase/server.ts async createClient with @supabase/ssr cookie bridge; proxy.ts route-level session refresh; NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY wiring"
provides:
  - "POST /auth/signout route handler (Supabase canonical, NextResponse.redirect to /app/login)"
  - "Server Action `loginAction` with Zod re-validation, status-gated Supabase error messaging, redirect('/app')"
  - "Client LoginForm using useActionState + RHF + zodResolver, merged server fieldErrors via RHF `errors` prop"
  - "Login Server Component at /app/login with already-authenticated bounce via getClaims"
  - "shadcn/ui scaffolded (radix-nova style): button, input, label, alert, card, sidebar + peer deps"
  - "NSI brand tokens in app/globals.css (--color-primary: #0A2540 and --color-sidebar-* NSI set)"
affects: [02-02-proxy-gate-and-shell, 02-03-linking-and-auth-rls-test, 07-widget-and-branding]

# Tech tracking
tech-stack:
  added:
    - react-hook-form ^7.72.1
    - "@hookform/resolvers ^5.2.2"
    - zod ^4.3.6
    - lucide-react ^1.8.0
    - "shadcn/ui components (radix-nova style, Tailwind v4 + CSS variables)"
    - "shadcn peer deps: separator, sheet, skeleton, tooltip, use-mobile hook"
  patterns:
    - "Server Action login (credentials never on client bundle)"
    - "Route Handler logout (NextResponse.redirect avoids NEXT_REDIRECT try/catch gotchas)"
    - "RHF + useActionState bridge — client Zod for format, server Zod for defense-in-depth, server fieldErrors merged via RHF `errors` prop"
    - "Status-gated error messaging (error.status 400/429/5xx) — avoids auth-js .code: undefined upstream bug and prevents user enumeration"
    - "CSS-variable-driven branding (Tailwind v4 @theme block) — migration-friendly for Phase 7 per-account override"

key-files:
  created:
    - "app/(auth)/app/login/schema.ts"
    - "app/(auth)/app/login/actions.ts"
    - "app/(auth)/app/login/page.tsx"
    - "app/(auth)/app/login/login-form.tsx"
    - "app/auth/signout/route.ts"
    - "components/ui/button.tsx"
    - "components/ui/input.tsx"
    - "components/ui/label.tsx"
    - "components/ui/alert.tsx"
    - "components/ui/card.tsx"
    - "components/ui/sidebar.tsx"
    - "components/ui/separator.tsx"
    - "components/ui/sheet.tsx"
    - "components/ui/skeleton.tsx"
    - "components/ui/tooltip.tsx"
    - "lib/utils.ts"
    - "components.json"
    - "hooks/use-mobile.ts"
  modified:
    - "app/globals.css (shadcn base vars + NSI @theme overrides)"
    - "app/layout.tsx (Geist font wiring, shadcn init output)"
    - "package.json"
    - "package-lock.json"

key-decisions:
  - "shadcn v4 radix-nova style with oklch CSS variables in :root plus a trailing @theme block for NSI hex overrides — satisfies both Tailwind v4 semantics and plan's grep verification for literal #0A2540 tokens"
  - "Raw <form action={formAction}> instead of RESEARCH §2b's next/form <Form> wrapper — stylistic choice, behavior identical for Server Actions, smaller dep surface"
  - "Error gating on error.status rather than error.code (upstream @supabase/auth-js bug: .code is undefined on invalid credentials per RESEARCH §7.3)"
  - "Generic 'Invalid email or password.' for all 400s — no user enumeration per CONTEXT.md"
  - "redirect('/app') as last statement of loginAction, outside any try/catch (NEXT_REDIRECT throw propagation per RESEARCH §7.1)"

patterns-established:
  - "Login form pattern: Server Action + useActionState + RHF + zodResolver with shared schema.ts for client/server parity"
  - "Logout pattern: POST Route Handler + NextResponse.redirect (Supabase canonical, avoids NEXT_REDIRECT in try/catch)"
  - "Already-authenticated bounce: getClaims in Server Component + redirect (matches with-supabase app/protected pattern)"
  - "Brand tokens: later @theme block overrides earlier — NSI hex values via literal CSS vars, Phase 7 will swap per-account"

# Metrics
duration: ~18min
completed: 2026-04-19
---

# Phase 2 Plan 1: Login and Auth Actions Summary

**Supabase password auth via Server Action with useActionState + RHF bridge, Route-Handler logout, and shadcn/radix-nova scaffolding with NSI brand tokens in Tailwind v4.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-19T21:58:00Z
- **Completed:** 2026-04-19T22:16:26Z
- **Tasks:** 3 / 3
- **Files created:** 17
- **Files modified:** 4
- **Build:** `npm run build` exits 0 (6 routes registered including `/app/login` and `/auth/signout`)
- **Smoke test:** `GET /app/login` returns HTTP 200 with "NSI / North Star Integrations / Sign in" rendered

## Accomplishments

- **AUTH-01 shipped (happy-path login surface).** `/app/login` renders a centered NSI-branded card with email, password, and Sign in; on submit, `useActionState(loginAction, ...)` drives a Server Action that validates with Zod, calls `supabase.auth.signInWithPassword`, shows an inline `Invalid email or password.` banner on failure, and `redirect('/app')` on success.
- **AUTH-02 shipped (logout primitive).** POST `/auth/signout` Route Handler clears the Supabase session and redirects to `/app/login`. Sidebar-mounted logout form in Plan 02 will post to this endpoint.
- **shadcn/ui foundation landed.** Button, Input, Label, Alert, Card, Sidebar (+ peer deps) installed via `shadcn@4.3.0` with the radix-nova style (Tailwind v4 + CSS variables auto-detected). Plan 02 picks this up for the dashboard shell.
- **NSI brand tokens in Tailwind v4 `@theme`.** `--color-primary: #0A2540` (deep navy), `--color-accent: #F97316` (warm orange), and the full `--color-sidebar-*` NSI set (deep-navy primary, slate backgrounds, subtle accent). Phase 7 swaps these to per-account DB lookups; today's CSS-variable indirection keeps that migration trivial.
- **Already-authenticated bounce at `/app/login`.** Server-component `getClaims` check redirects logged-in visitors straight to `/app`, matching the `with-supabase` starter pattern.

## Task Commits

Each task committed atomically and pushed to `main`:

1. **Task 1: Install deps, scaffold shadcn, set NSI CSS vars** — `7535f3e` (chore)
2. **Task 2: Ship login schema + Server Action + Route Handler logout** — `af24643` (feat)
3. **Task 3: Ship login page (server component) + client form** — `23938a8` (feat)

Plan metadata commit (docs) follows this SUMMARY.md + STATE.md update.

## shadcn Components Installed

Via `npx shadcn@latest init -d -b radix -y` then `add input label alert card sidebar -y`:

| Component   | File                         | Notes                                    |
|-------------|------------------------------|------------------------------------------|
| Button      | `components/ui/button.tsx`   | Installed by `init`                      |
| Input       | `components/ui/input.tsx`    |                                          |
| Label       | `components/ui/label.tsx`    |                                          |
| Alert       | `components/ui/alert.tsx`    | `variant="destructive"` for form banner  |
| Card        | `components/ui/card.tsx`     | Wraps the login form                     |
| Sidebar     | `components/ui/sidebar.tsx`  | Primary nav in Plan 02                   |
| Separator   | `components/ui/separator.tsx`| Peer dep (sidebar)                       |
| Sheet       | `components/ui/sheet.tsx`    | Peer dep (mobile offcanvas sidebar)      |
| Skeleton    | `components/ui/skeleton.tsx` | Peer dep                                 |
| Tooltip     | `components/ui/tooltip.tsx`  | Peer dep (sidebar icon-collapse tooltips)|

**Also created:**
- `lib/utils.ts` — `cn()` helper
- `hooks/use-mobile.ts` — breakpoint hook (sidebar responsive behavior)
- `components.json` — shadcn registry config (style: `radix-nova`, baseColor: `neutral`, `cssVariables: true`)

**shadcn CLI version used:** `shadcn@4.3.0`. Flags differ from the plan's instructions (v4 uses `-d -b radix` rather than `--base-color slate`); final outputs are equivalent.

## NSI Color Token Values (for Phase 7 reference)

Appended to `app/globals.css` in a trailing `@theme` block (later @theme wins in Tailwind v4 merge):

```css
@theme {
  /* NSI brand — hardcoded for Phase 2; Phase 7 swaps to per-account DB lookup */
  --color-primary: #0A2540;              /* deep navy */
  --color-primary-foreground: #FFFFFF;
  --color-accent: #F97316;               /* warm orange */

  /* shadcn sidebar tokens — NSI-themed */
  --color-sidebar: #F8FAFC;              /* slate-50 */
  --color-sidebar-foreground: #0F172A;   /* slate-900 */
  --color-sidebar-primary: #0A2540;      /* deep navy */
  --color-sidebar-primary-foreground: #FFFFFF;
  --color-sidebar-accent: #E2E8F0;       /* slate-200 */
  --color-sidebar-accent-foreground: #0F172A;
  --color-sidebar-border: #E2E8F0;
  --color-sidebar-ring: #0A2540;
}
```

**Phase 7 migration note:** When per-account branding goes live, these vars get set inline on a wrapping `<div style={{"--color-primary": account.brand_primary, ... }}>` that wraps the entire authenticated + public shell. No component code changes — Tailwind v4 CSS vars resolve at runtime.

**Coexistence with shadcn's `:root` oklch vars:** shadcn v4 init wrote a full `:root { --primary: oklch(...); ... }` plus an `@theme inline` block that points `--color-primary` at `var(--primary)`. Our trailing literal `@theme { --color-primary: #0A2540; }` block wins the merge, so the NSI hex lands on `bg-primary` / `text-primary` utility classes. If Phase 7 wants to restore the oklch indirection for per-account branding, one option is dropping the trailing block and editing `:root.--primary` to match the account — trivial refactor.

## Server Action Shape (confirmed)

`app/(auth)/app/login/actions.ts`:

- `"use server"` directive at top.
- Signature `(_prev: LoginState, formData: FormData): Promise<LoginState>` — matches React 19 `useActionState`.
- **Defense-in-depth Zod re-validation** (server-side `loginSchema.safeParse` on `formData.get("email" | "password")`) returns `{ fieldErrors }` on failure, merged by the client form via RHF's `errors` prop.
- `createClient()` from `@/lib/supabase/server` — async (awaits `cookies()` in Phase 1 module).
- `supabase.auth.signInWithPassword(parsed.data)` with error gating **on `error.status`**:
  - `400` (or any non-429/5xx) → `"Invalid email or password."` (generic, no user enumeration).
  - `429` → `"Too many attempts. Please wait a minute and try again."`
  - `!status || >= 500` → `"Something went wrong. Please try again."`
- `revalidatePath("/", "layout")` — busts root layout cache so post-login rendering picks up the new session.
- `redirect("/app")` — **last statement**, outside any try/catch. Throws `NEXT_REDIRECT` which Next propagates.

Route Handler `app/auth/signout/route.ts`:

- `export async function POST(req: NextRequest)` — Supabase canonical, not a Server Action.
- Guards `signOut()` behind `getClaims()` existence check (avoids signOut-on-nothing).
- `revalidatePath("/", "layout")` + `NextResponse.redirect(new URL("/app/login", req.url), { status: 302 })`.
- First-class redirect response (no NEXT_REDIRECT throw, no try/catch gotchas).

## Files Created/Modified

**Created:**
- `app/(auth)/app/login/schema.ts` — shared Zod `loginSchema` + `LoginInput` type
- `app/(auth)/app/login/actions.ts` — `loginAction` Server Action + `LoginState` type
- `app/(auth)/app/login/page.tsx` — Server Component with already-authenticated bounce + NSI card layout
- `app/(auth)/app/login/login-form.tsx` — Client Component with useActionState + RHF + zodResolver
- `app/auth/signout/route.ts` — POST handler for logout
- `components/ui/button.tsx`, `input.tsx`, `label.tsx`, `alert.tsx`, `card.tsx`, `sidebar.tsx`
- `components/ui/separator.tsx`, `sheet.tsx`, `skeleton.tsx`, `tooltip.tsx` (peer deps)
- `lib/utils.ts` — shadcn `cn()` helper
- `hooks/use-mobile.ts` — responsive breakpoint hook for sidebar
- `components.json` — shadcn registry config

**Modified:**
- `app/globals.css` — shadcn oklch base vars + `@theme inline` + trailing `@theme` NSI override block
- `app/layout.tsx` — Geist font import + `cn("font-sans", geist.variable)` on `<html>` (shadcn init output)
- `package.json` — added `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`
- `package-lock.json` — lockfile reconciliation

## Decisions Made

See frontmatter `key-decisions` for the durable ones. Additional notes:

- **`components.json` uses `baseColor: "neutral"`** despite the plan requesting `slate`. shadcn v4's `-b radix` preset defaults to `neutral`; changing it would require a non-default flag not exposed in `init -h` output. Tailwind v4 + the explicit NSI `@theme` override makes this moot — base-color only affects shadcn's initial `:root { --primary: oklch(...); }` values, which our NSI block overrides anyway.
- **Raw `<form action={formAction}>` vs `next/form <Form>`.** Plan's RESEARCH §2b recommended `next/form`; plan checker MAJOR 3 flagged the switch to raw. Behavior is identical for Server Action submission — the only `next/form` benefit is client-side prefetching, which a login form doesn't need. Keeps the surface smaller. Documented as planned stylistic choice, not drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] shadcn init auto-committed its output with a generic "feat: initial commit" message.**
- **Found during:** Task 1 (after `npx shadcn@latest init`)
- **Issue:** The `shadcn@4.3.0` CLI now auto-commits its file writes (unlike the 2024 version the plan's RESEARCH was based on). This created an untagged commit that violated the plan's atomic-commit protocol (`chore(02-01): install auth deps and scaffold shadcn components`).
- **Fix:** `git reset --soft HEAD~1 && git reset HEAD` to undo the commit while preserving the files, then re-staged all Task 1 files individually and committed with the correct message.
- **Files modified:** (no content changes; commit history only)
- **Verification:** `git log --oneline -2` shows `7535f3e chore(02-01): install auth deps and scaffold shadcn components` directly on top of `9b3a01f docs(02): address plan checker blockers + majors` — no orphan `feat: initial commit` in the graph.
- **Committed in:** `7535f3e` (Task 1 commit, correct message)

**2. [Rule 3 — Blocking] shadcn init touched `app/layout.tsx` (added Geist font wiring).**
- **Found during:** Task 1 (after `npx shadcn@latest init`, during file staging)
- **Issue:** The plan's Task 1 `<files>` list didn't include `app/layout.tsx`, but shadcn v4 auto-imports Geist and wires `cn("font-sans", geist.variable)` on `<html>` as part of init output. This is benign and consistent with shadcn conventions — it gives us a proper `--font-sans` CSS var for the sidebar and form primitives.
- **Fix:** Included `app/layout.tsx` in the Task 1 commit (documented in commit body). No manual content edits beyond what shadcn wrote.
- **Files modified:** `app/layout.tsx` (Geist font wiring)
- **Verification:** `npm run build` exits 0, `/app/login` renders with Geist font.
- **Committed in:** `7535f3e` (Task 1 commit)

**3. [Rule 1 — CLI flag drift] Plan's shadcn init flags don't match `shadcn@4.3.0`.**
- **Found during:** Task 1 (first `npx shadcn@latest init` attempt)
- **Issue:** Plan's `<action>` said `npx shadcn@latest init` with prompts for style `new-york` / base color `slate` / CSS variables yes. `shadcn@4.3.0` uses non-interactive presets: `-d` (defaults: `--template=next --preset=base-nova`) and `-b radix|base` (component library). `--base-color` is not a valid flag in v4.
- **Fix:** Used `npx shadcn@latest init -d -b radix -y`, which selects `radix-nova` style (latest equivalent of the old `new-york` + Radix pairing) with CSS variables on by default. Outputs are functionally equivalent for Phase 2's needs.
- **Files modified:** None beyond the shadcn init output files already tracked.
- **Verification:** All 6 required shadcn files created + `components.json` + `lib/utils.ts`; `npm run build` passes.
- **Committed in:** `7535f3e` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 CLI drift). No architectural changes.
**Impact on plan:** All three were mechanical CLI-version drift. Zero impact on runtime behavior, Server Action shape, or security posture. Plan-checker MAJOR 3 (raw `<form>` vs `next/form`) was documented in Task 3's `<done>` block as a planned deviation, not a surprise.

## Authentication Gates

None encountered. Supabase CLI auth / remote MCP were not exercised in this plan — all work was local file creation and `npm run build`.

## Issues Encountered

None that required recovery beyond the CLI-drift deviations above. `npm` emitted a harmless `EBADENGINE` warning (package.json pins Node 20.x; runtime is 24.12.0) — no action needed; Next 16 + Tailwind v4 work identically on Node 24 locally.

## User Setup Required

**None for this plan.** Plan 04 will add the Supabase Auth user creation step (dashboard UI + one-time MCP SQL to link `accounts.owner_user_id`). Without that user, the login form will correctly return `Invalid email or password.` for any credential attempt — expected per the plan's `<verification>` note.

## Next Phase Readiness

**Ready for Plan 02 (proxy gate + shell layout).** Plan 02 will:
- Diff `proxy.ts` to gate `/app/*` behind `getClaims()` with the `/app/login` carve-out (RESEARCH §4).
- Add `app/(shell)/layout.tsx` rendering the shadcn `<Sidebar>` with nav stubs + bottom logout form posting to `/auth/signout`.
- Add four empty stub pages: `/app/event-types`, `/app/availability`, `/app/branding`, `/app/bookings` + welcome card at `/app`.

**Blockers for Plan 02:** None. All shadcn primitives (sidebar, sheet, separator, tooltip) are installed; `use-mobile` hook is present; NSI color vars are live.

**Blockers for Plan 03 (linking + authenticated RLS test):** Plan 03 needs the Supabase Auth user to exist (owner account link via MCP SQL) before the Vitest helper can sign in. Plan the user-creation step before running Plan 03.

---
*Phase: 02-owner-auth-and-dashboard-shell*
*Completed: 2026-04-19*
