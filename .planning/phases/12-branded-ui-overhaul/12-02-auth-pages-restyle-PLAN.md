---
phase: 12-branded-ui-overhaul
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(auth)/app/login/page.tsx
  - app/(auth)/app/signup/page.tsx
  - app/(auth)/app/forgot-password/page.tsx
  - app/(auth)/app/verify-email/page.tsx
  - app/auth/reset-password/page.tsx
  - app/auth/auth-error/page.tsx
  - app/(auth)/_components/auth-hero.tsx
autonomous: true

must_haves:
  truths:
    - "/login renders a Cruip 'Simple Light' split-panel: form on left (or single-column on mobile), NSI marketing hero with gradient + headline + value-prop on right"
    - "/signup, /forgot-password, /verify-email, /auth/reset-password, /auth/auth-error all share the same Cruip auth shell pattern with NSI tokens"
    - "Auth pages render NSIGradientBackdrop (fixed #0A2540 + 'subtle') regardless of any account context"
    - "Existing logged-in redirects (getClaims → redirect('/app')) preserved on every page"
    - "Existing searchParams flash banners (e.g. /login?reset=success) preserved"
    - "Existing Server Actions (signup, login, forgot-password, reset-password, resendVerification) preserved unchanged"
  artifacts:
    - path: "app/(auth)/_components/auth-hero.tsx"
      provides: "Reusable NSI marketing hero panel for auth pages"
      exports: ["AuthHero"]
    - path: "app/(auth)/app/login/page.tsx"
      provides: "Restyled login page using AuthHero + NSIGradientBackdrop, redirect logic preserved"
      contains: "AuthHero"
    - path: "app/(auth)/app/signup/page.tsx"
      provides: "Restyled signup page"
      contains: "AuthHero"
    - path: "app/(auth)/app/forgot-password/page.tsx"
      provides: "Restyled forgot-password page"
      contains: "AuthHero"
    - path: "app/(auth)/app/verify-email/page.tsx"
      provides: "Restyled verify-email page (preserves resend Server Action)"
      contains: "AuthHero"
    - path: "app/auth/reset-password/page.tsx"
      provides: "Restyled reset-password page"
      contains: "AuthHero"
    - path: "app/auth/auth-error/page.tsx"
      provides: "Restyled auth-error page"
      contains: "AuthHero"
  key_links:
    - from: "app/(auth)/app/login/page.tsx"
      to: "components/nsi-gradient-backdrop.tsx"
      via: "import + render NSIGradientBackdrop in page wrapper"
      pattern: "NSIGradientBackdrop"
    - from: "app/(auth)/_components/auth-hero.tsx"
      to: "tailwind classes"
      via: "Inter font tracking-tight + bg-gray-50 base + py-12 md:py-20 rhythm"
      pattern: "py-12.*md:py-20|tracking-tight"
    - from: "app/(auth)/app/login/page.tsx"
      to: "Server Actions (loginAction or equivalent)"
      via: "form action prop unchanged from pre-restyle"
      pattern: "action=\\{|formAction=\\{"
---

<objective>
Restyle all 6 auth pages (`/login`, `/signup`, `/forgot-password`, `/verify-email`, `/auth/reset-password`, `/auth/auth-error`) to the Cruip "Simple Light" aesthetic with **NSI tokens fixed** (CONTEXT.md lock — pre-signup users have no account context). Each page becomes a split-panel layout: form on left, marketing-y NSI hero panel (gradient + headline + value-prop copy) on right (`lg:` and up; stacked on mobile). All existing data-loading logic, redirects, flash banners, and Server Actions are preserved verbatim — this is a JSX-shell restyle only.

Purpose: Auth pages double as a soft NSI sales surface for visiting trade contractors (CONTEXT lock). They must feel like the same product as the Cruip dashboard restyle landing in Wave 2/3. Restyling them in Wave 1 in parallel with Plan 12-01 (branding-tokens foundation) lets us ship visible polish to the public surfaces (signup is the entry point for every new account) without blocking on the dashboard IA refactor.

Output:
- New `AuthHero` component (NSI marketing panel)
- 6 restyled page.tsx files preserving all auth logic
- UI-12 satisfied (split-panel pattern on lg:)
- Phase success criterion #4 satisfied for the auth subset
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

# Existing pages to restyle (preserve all logic — restyle is JSX-only)
@app/(auth)/app/login/page.tsx
@app/(auth)/app/signup/page.tsx
@app/(auth)/app/forgot-password/page.tsx
@app/(auth)/app/verify-email/page.tsx
@app/auth/reset-password/page.tsx
@app/auth/auth-error/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: AuthHero component + NSI hero copy</name>
  <files>
    app/(auth)/_components/auth-hero.tsx
  </files>
  <action>
    Create directory `app/(auth)/_components/` if not present.

    Create `app/(auth)/_components/auth-hero.tsx` (server component is fine — no client-side state needed):

    ```tsx
    import Image from "next/image";
    import { NSIGradientBackdrop } from "@/components/nsi-gradient-backdrop";

    interface AuthHeroProps {
      /** Page-specific headline overrides (e.g. "Welcome back" on login). */
      headline?: string;
      /** Page-specific subtext override. */
      subtext?: string;
    }

    /**
     * NSI marketing hero panel for auth pages.
     * CONTEXT.md lock: NSI tokens fixed (auth pages have no account context).
     * Renders on lg: as the right-side panel of a split-panel layout;
     * hidden on smaller breakpoints (form-only on mobile).
     */
    export function AuthHero({
      headline = "Bookings without the back-and-forth.",
      subtext = "A multi-tenant scheduling tool built for trade contractors. Branded booking pages, capacity-aware slots, and email confirmations — done.",
    }: AuthHeroProps) {
      return (
        <aside className="relative hidden overflow-hidden bg-gray-50 lg:flex lg:flex-col lg:items-start lg:justify-center lg:px-12 lg:py-20">
          <NSIGradientBackdrop />
          <div className="relative z-10 max-w-md">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Powered by NSI
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900">{headline}</h1>
            <p className="mt-4 text-base text-gray-600">{subtext}</p>
            <ul className="mt-8 space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                Free for new owners — no card, no trial gates.
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                Brand it your way — colors, logo, embed widget.
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                Built for trade contractors, by NSI in Omaha.
              </li>
            </ul>
          </div>
        </aside>
      );
    }
    ```

    Note: This component does NOT depend on Plan 12-01 — it imports `NSIGradientBackdrop` which Plan 12-01 will create. Since both plans are Wave 1, execute order matters: Plan 12-01 must commit `NSIGradientBackdrop` BEFORE Plan 12-02 imports it. If wave ordering inside execute-phase doesn't enforce this, this task will fail import and the executor must finish 12-01 Task 2 first.

    **Defensive contingency:** If `components/nsi-gradient-backdrop.tsx` does not exist when Plan 12-02 runs (parallel-execution race), inline a temporary 5-line `NSIGradientBackdrop` directly in `auth-hero.tsx`:
    ```tsx
    function NSIGradientBackdropInline() {
      return (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,#0A254040,transparent_60%)]" />
      );
    }
    ```
    This is a Tailwind-static-class fallback (no DB-driven hex, so JIT works). When Plan 12-01 lands, swap back to the proper import in a follow-up commit.
  </action>
  <verify>
    1. `app/(auth)/_components/auth-hero.tsx` exists.
    2. `npx tsc --noEmit` clean (assuming Plan 12-01's NSIGradientBackdrop is committed; otherwise contingency-fallback inline).
    3. Component renders without errors (will be verified in Task 2 when imported into login).
  </verify>
  <done>
    `AuthHero` ships as a reusable server component for the 6 auth pages.
  </done>
</task>

<task type="auto">
  <name>Task 2: Restyle /login, /signup, /forgot-password, /verify-email</name>
  <files>
    app/(auth)/app/login/page.tsx
    app/(auth)/app/signup/page.tsx
    app/(auth)/app/forgot-password/page.tsx
    app/(auth)/app/verify-email/page.tsx
  </files>
  <action>
    **Critical preservation rule (research Pitfall 9):** For each page, READ the existing file first. Identify and preserve verbatim:
    - All imports of Server Actions, Supabase clients
    - `getClaims()` + `redirect("/app")` checks at the top of the page function
    - `searchParams` parsing (e.g. `?reset=success`, `?verified=true`, `?error=...`)
    - The form's existing `action={...}` prop binding to its Server Action
    - Any `useFormState` / `useFormStatus` hooks (these are inside the form-component, often a sibling client component)

    **Restyle pattern — apply identically to all 4 pages:**

    ```tsx
    // Top of file unchanged: imports, Server Action references, getClaims redirect
    // Then the JSX wrapper changes:

    return (
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left: form column */}
        <main className="flex flex-col items-center justify-center bg-white px-6 py-12 md:py-20 lg:px-12">
          <div className="w-full max-w-sm">
            <header className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{/* page title, e.g. "Sign in to your dashboard" */}</h2>
              <p className="mt-2 text-sm text-gray-600">{/* page subtitle */}</p>
            </header>
            {/* Existing flash banners (e.g. searchParams.reset === "success") render here */}
            {/* Existing form goes here unchanged — DO NOT modify the form itself */}
          </div>
        </main>
        {/* Right: NSI hero (lg+ only) */}
        <AuthHero
          headline={/* page-specific or default */}
          subtext={/* page-specific or default */}
        />
      </div>
    );
    ```

    **Per-page hero copy (CONTEXT.md auth-pages-tone lock — marketing-y):**
    - **/login** — `headline="Welcome back to your bookings"`, default subtext.
    - **/signup** — `headline="Start scheduling in minutes"`, `subtext="Create your free account, pick a slug, and you'll have a live booking page before your first coffee."`.
    - **/forgot-password** — `headline="We've got your back"`, `subtext="Enter your email and we'll send a reset link if it's registered."`.
    - **/verify-email** — `headline="One quick step"`, `subtext="Check your inbox for the verification link. Click it to finish setting up your account."`.

    **Apply Cruip 'Simple Light' typography to the form column:**
    - Page title: `text-2xl font-semibold tracking-tight text-gray-900`
    - Subtitle: `text-sm text-gray-600`
    - Form labels: `text-sm font-medium text-gray-700`
    - Input fields: keep existing shadcn `<Input>` (already styled correctly)
    - Submit button: keep existing shadcn `<Button>` (will inherit Inter from Plan 12-03's font swap; for now, Geist is fine)

    **Do NOT change:**
    - Form action bindings
    - getClaims/redirect
    - searchParams flash-banner JSX (just move it inside the new wrapper)
    - resendVerification Server Action call on `/verify-email`

    **Test redirects work after restyle:** for `/login`, `/signup`, `/forgot-password`, log in as Andrew first → visit each page → confirm `redirect('/app')` still fires (page never renders). Log out → page renders correctly.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `npm run dev` → log out → visit `/login`. Confirm split-panel renders on lg+ (use DevTools responsive mode to test 1280px+). Confirm form is centered on mobile.
    3. `/signup` — submit form with bogus email → existing P-A1 generic-success message still displays.
    4. `/forgot-password` — submit form → existing flash banner renders.
    5. `/verify-email` — confirm "Resend email" button still works (existing rate-limited Server Action).
    6. Log in as Andrew → visit `/login` → confirm redirect to `/app` still fires.
    7. Visit `/login?reset=success` (URL-craft) → confirm flash banner shows.
  </verify>
  <done>
    4 auth pages adopt Cruip split-panel layout with NSI hero on lg+; all auth logic preserved; no regressions in redirect/flash behavior.
  </done>
</task>

<task type="auto">
  <name>Task 3: Restyle /auth/reset-password + /auth/auth-error</name>
  <files>
    app/auth/reset-password/page.tsx
    app/auth/auth-error/page.tsx
  </files>
  <action>
    **Same preservation + restyle pattern as Task 2.** These two routes live under `app/auth/` (not `app/(auth)/app/`) — they don't go through the `(auth)` route group's layout.

    **/auth/reset-password** — preserve:
    - `getClaims()` recovery-session guard
    - 8-character password validation
    - Expired-link fallback rendering
    - Form's POST to `/auth/confirm` (Server Action or form action — read existing file)

    Apply split-panel layout. Hero copy:
    - `headline="Set a new password"`, `subtext="Choose a strong password (8+ characters) to finish resetting your account."`

    **/auth/auth-error** — preserve:
    - Error message parsing from `searchParams`
    - "Resend verification" CTA wired to existing Server Action

    Apply split-panel layout. Hero copy:
    - `headline="That link didn't work"`, `subtext="Auth links expire after a set time or when used. Sign in or request a fresh one below."`

    **Note on import path:** `AuthHero` lives at `app/(auth)/_components/auth-hero.tsx`. Import via `@/app/(auth)/_components/auth-hero` (or relative `../../(auth)/_components/auth-hero` from `app/auth/reset-password/page.tsx`). The `(auth)` parens are valid in the import path because Next.js route groups don't affect filesystem.

    **Apply same Cruip typography conventions** as Task 2.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `npm run dev` → trigger forgot-password flow end-to-end → land on `/auth/reset-password` → confirm split-panel + form works → set new password → redirect to `/login` (existing flow).
    3. Visit `/auth/auth-error?error=expired` → confirm split-panel + error message renders.
    4. Confirm getClaims-based recovery-session guard still throws on invalid session (try visiting `/auth/reset-password` directly without a recovery link → existing fallback UI renders).
  </verify>
  <done>
    Both `/auth/*` pages adopt the same Cruip split-panel layout; recovery + error flows preserved.
  </done>
</task>

</tasks>

<verification>
**Plan-level checks:**
- All 6 pages adopt split-panel + NSI hero on lg+.
- Mobile (sm:) renders form-only column with hero hidden (`hidden lg:flex`).
- All `getClaims` redirects still fire when logged in.
- All flash banners (searchParams) still render.
- All Server Actions still bind to forms (form `action={...}` prop unchanged).
- No regressions in Vitest test suite.
- `npx tsc --noEmit` clean.

**Requirements satisfied:**
- UI-12 (auth pages adopt split-panel pattern on `lg:`)

**Phase success criteria contribution:**
- Criterion #4 (auth pages adopt Cruip restyle) — fully satisfied for auth subset
- Criterion #4 also covers public + embed + /[account] — those land in Plan 12-05
</verification>

<success_criteria>
1. 6 auth pages restyled to Cruip split-panel layout with NSI hero (lg+).
2. Form-only stacked layout on mobile; no horizontal overflow at 320px.
3. All preserved logic: getClaims redirects, searchParams flash banners, Server Action bindings.
4. AuthHero is a reusable server component with default + override headline/subtext.
5. NSIGradientBackdrop renders correctly behind hero panel (color=#0A2540, shade=subtle).
6. No Vitest regressions.
7. `npx tsc --noEmit` clean.

UI-12 ships with this plan; no other auth requirements remain in Phase 12.
</success_criteria>

<output>
After completion, create `.planning/phases/12-branded-ui-overhaul/12-02-SUMMARY.md` documenting:
- 6 pages restyled (list)
- AuthHero component (NEW) — reusable for any future auth page
- Pattern established: preserve all data-loading + Server-Action logic; only the JSX wrapper changes
- Tech-stack additions: none
- Confirm: redirect/banner regression tests passed
- Decisions: 4 default + 4 page-specific hero copy strings; "Powered by NSI" pill in hero
- For Phase 13 QA: include each page in the multi-account smoke (auth pages always render NSI tokens — all 3 test accounts should see identical auth-page styling)
</output>
