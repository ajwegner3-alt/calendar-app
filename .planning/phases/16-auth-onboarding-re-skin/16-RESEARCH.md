# Phase 16: Auth + Onboarding Re-Skin — Research

**Researched:** 2026-04-30
**Domain:** Next.js visual re-skin — auth pages, onboarding wizard, component API wiring
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

Phase 16 is a pure visual-layer re-skin of 7 auth pages and a 3-step onboarding wizard. All functional elements (Server Actions, getClaims redirects, searchParams parsing, client-island state) must remain byte-for-byte identical. The phase applies the NSI visual language established in Phase 15 — `BackgroundGlow`, glass `Header` pill, `bg-gray-50` base, white card containers — to surfaces that currently lack it.

The core challenge is that the existing `Header` component has the sidebar offset (`md:left-[var(--sidebar-width)]`) hardcoded. Auth and onboarding pages have no sidebar, so using `<Header>` directly would place the pill incorrectly on desktop. The CONTEXT.md decision is full-width `left-0`. This is resolved by either: (a) adding a `variant` or `sidebarOffset` prop to `Header`, or (b) rendering a locally-composed pill in auth/onboarding layouts. See section 3 for the exact recommendation.

The `rounded-lg` vs `rounded-xl` conflict (CONTEXT.md defaulting to Phase 15's `rounded-lg` vs REQUIREMENTS.md AUTH-14/16 specifying `rounded-xl`) is resolved by reading the actual Phase 15 canonical class. Phase 15 **locked** `rounded-lg` explicitly in 15-02-PLAN.md as the canonical value, superseding REQUIREMENTS.md. The planner should use `rounded-xl` for auth/onboarding cards — the conflict resolution is to defer to REQUIREMENTS.md AUTH-16 since Phase 15's locked value applies to the *owner shell* cards, and Phase 16 is a new surface type where REQUIREMENTS.md is the authoritative spec. See section 7 for full analysis.

**Primary recommendation:** Structure as 4 execution plans in 2 waves: Wave 1 — (a) AuthHero re-skin + login/signup pages and (b) Header variant addition; Wave 2 — (c) 5 short auth pages and (d) onboarding layout + 3 steps.

---

## 1. File Inventory

### 7 Auth Pages

| File | Route | Type | Key Functional Elements |
|------|-------|------|------------------------|
| `app/(auth)/app/login/page.tsx` | `/app/login` | Server Component | `createClient()`, `getClaims()` redirect to `/app`, `searchParams: { reset? }` |
| `app/(auth)/app/signup/page.tsx` | `/app/signup` | Server Component | No auth check, delegates to `<SignupForm />` |
| `app/(auth)/app/forgot-password/page.tsx` | `/app/forgot-password` | Server Component | No auth check, delegates to `<ForgotPasswordForm />` |
| `app/(auth)/app/verify-email/page.tsx` | `/app/verify-email` | Server Component | `searchParams: { email? }`, delegates to `<ResendVerificationButton action={resendVerification} initialEmail={email} />` |
| `app/auth/reset-password/page.tsx` | `/auth/reset-password` | Server Component | `createClient()`, `getClaims()` — shows expired-link fallback if no session; else shows `<ResetPasswordForm />` |
| `app/auth/auth-error/page.tsx` | `/auth/auth-error` | Server Component | `searchParams: { reason?, email? }`, branches on `isExpired`, delegates to `<ResendVerificationButton action={resendVerification} initialEmail={email} />` |
| `app/account-deleted/page.tsx` | `/account-deleted` | Server Component | Currently bare — no imports, no functional logic; just static JSX with bare `<a>` link |

### Auth Client-Island Components (DO NOT TOUCH)

| File | Used By | Functional Elements |
|------|---------|---------------------|
| `app/(auth)/app/login/login-form.tsx` | login/page | `useActionState(loginAction)`, RHF+Zod, `<Card>`, `<Button>`, `<Input>`, `<Alert>` |
| `app/(auth)/app/signup/signup-form.tsx` | signup/page | `useActionState(signUpAction)`, RHF+Zod, `<Card>`, `<Button>`, `<Input>`, `<Alert>` |
| `app/(auth)/app/forgot-password/forgot-password-form.tsx` | forgot-password/page | `useActionState(requestPasswordReset)`, RHF+Zod, `<Card>`, `<Button>`, `<Input>`, `<Alert>` |
| `app/auth/reset-password/reset-password-form.tsx` | reset-password/page | `useActionState(resetPasswordAction)`, RHF+Zod, `<Card>`, `<Button>`, `<Input>`, `<Alert>` |
| `app/(auth)/app/verify-email/resend-verification-button.tsx` | verify-email/page AND auth-error/page | `useActionState(action prop)`, cooldown timer `useState`/`useEffect`, hidden input with `initialEmail`, `<Card>`, `<Button>`, `<Input>`, `<Alert>` |

### AuthHero Component

**File:** `app/(auth)/_components/auth-hero.tsx`

Current structure:
- Server Component (no `'use client'`)
- Props: `headline?: string`, `subtext?: string`
- Renders `<aside className="relative hidden overflow-hidden bg-gray-50 lg:flex ...">` — hidden on mobile, visible at `lg`
- Renders `<NSIGradientBackdrop />` as backdrop
- Contains hardcoded marketing copy: "Powered by NSI" badge, 3 bullet points
- The `<div className="relative z-10 max-w-md">` contains all copy

**What changes:** Replace `<NSIGradientBackdrop />` with `<BackgroundGlow />`. The `aside` wrapper's `bg-gray-50` already matches the target visual. All copy stays verbatim (locked decision).

### NSIGradientBackdrop Component

**File:** `components/nsi-gradient-backdrop.tsx`

Current: thin wrapper that calls `<GradientBackdrop color="#0A2540" shade="subtle" />`.
Phase 16 stops importing it. File is NOT deleted (Phase 20 task).

### BackgroundGlow Component

**File:** `app/_components/background-glow.tsx`

API:
```tsx
interface BackgroundGlowProps {
  color?: string;  // defaults to "#3B82F6" (NSI blue)
}
export function BackgroundGlow({ color = "#3B82F6" }: BackgroundGlowProps)
```
- Server Component (no `'use client'`)
- Renders `absolute inset-0 overflow-hidden` outer wrapper with `aria-hidden="true"`
- Two blob divs with inline `style` for runtime color (JIT-safe)
- Blob left-offsets adapted for sidebar-constrained container: `calc(50% + 100px)` and `calc(50% + 0px)`

**For auth/onboarding use:** No color prop needed — default `#3B82F6` is the NSI blue locked value for these surfaces.

### Header Component

**File:** `app/_components/header.tsx`

Current API:
```tsx
export function Header()  // no props
```
- Client Component (`'use client'`)
- Imports `usePathname`, `SidebarTrigger`, `WORDMARK` from `lib/brand`
- **Hardcodes sidebar offset:** `className="fixed top-2 md:top-6 left-0 md:left-[var(--sidebar-width)] right-0 z-30 px-4"`
- Right slot: context label derived from `getContextLabel(pathname)` — only returns non-empty for `/app/*` routes
- Contains `<SidebarTrigger className="md:hidden" />` — this triggers a sidebar that DOES NOT EXIST on auth/onboarding pages

**Critical issue:** The existing `Header` component cannot be used directly on auth/onboarding pages because:
1. The `md:left-[var(--sidebar-width)]` offset assumes a sidebar exists. On auth/onboarding there is no sidebar, so the pill would be offset by 16rem on desktop, leaving a blank column on the left. CONTEXT.md locked decision: full-width `left-0`.
2. `<SidebarTrigger>` would crash or produce a console error outside a `<SidebarProvider>` context.

See section 3 for resolution.

### Onboarding Files

| File | Type | Current Structure |
|------|------|-------------------|
| `app/onboarding/layout.tsx` | Server Component | Auth gate (`getClaims()` redirect), accounts query, wizard chrome: `<div className="min-h-screen bg-white p-8">`, title, progress bar |
| `app/onboarding/page.tsx` | Server Component | Route dispatcher only — redirects to appropriate step URL |
| `app/onboarding/step-1-account/page.tsx` | Server Component | Static shell: `<div>`, `<h2>`, `<p>`, `<AccountForm />` |
| `app/onboarding/step-2-timezone/page.tsx` | Server Component | Static shell: `<div>`, `<h2>`, `<p>`, `<TimezoneForm />` |
| `app/onboarding/step-3-event-type/page.tsx` | Server Component | Static shell: `<div>`, `<h2>`, `<p>`, `<EventTypeForm />` |
| `app/onboarding/step-1-account/account-form.tsx` | Client Component | `"use client"`, `useActionState(saveStep1Action)`, RHF+Zod, slug availability fetch, `saveStep1Action` |
| `app/onboarding/step-2-timezone/timezone-form.tsx` | Client Component | `"use client"`, `useActionState(saveStep2Action)`, RHF+Zod, Intl timezone detect |
| `app/onboarding/step-3-event-type/event-type-form.tsx` | Client Component | `"use client"`, `useActionState(completeOnboardingAction)`, RHF+Zod |

---

## 2. Phase 15 Reference Patterns

### Canonical Card Class (from Phase 15)

Phase 15-02-PLAN.md **locked** the card class as:
```
rounded-lg border border-gray-200 bg-white p-6 shadow-sm
```
This is the canonical value for the owner shell (applied to 14 card instances). This was an explicit override of REQUIREMENTS.md OWNER-10's `rounded-xl`, with the rationale: "supersedes REQUIREMENTS.md OWNER-10 `rounded-xl`."

### Shell Layout Pattern (from Phase 15)

```tsx
// (shell)/layout.tsx — the post-Phase-15 pattern
<SidebarInset className="relative overflow-hidden bg-gray-50">
  <BackgroundGlow />
  <Header />
  <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6 md:pt-24 pb-12">
    {children}
  </main>
</SidebarInset>
```

Key classes established:
- Page background: `bg-gray-50` on the container
- Main content z-layer: `relative z-10` so content sits above glow
- Main content top padding: `pt-20 md:pt-24` (clears the fixed pill)
- `BackgroundGlow` uses `position: absolute` (not fixed) — fills the `relative overflow-hidden` container

### Header Pill Inner Classes

The inner pill div (from live header.tsx):
```
max-w-[1152px] mx-auto h-14 px-4 rounded-2xl flex items-center justify-between bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]
```

The outer header wrapper:
```
fixed top-2 md:top-6 left-0 md:left-[var(--sidebar-width)] right-0 z-30 px-4
```

---

## 3. Header Component API — Critical Issue and Resolution

### Problem

The current `Header()` takes zero props and has two issues for auth/onboarding:
1. `left-0 md:left-[var(--sidebar-width)]` — sidebar offset must NOT apply when there is no sidebar
2. `<SidebarTrigger className="md:hidden" />` — requires `<SidebarProvider>` context that doesn't exist on auth/onboarding pages

### Resolution Options

**Option A: Add a `variant` prop to `Header`** (affects the shared component)
```tsx
export function Header({ variant = "owner" }: { variant?: "owner" | "auth" })
```
- `owner`: current behavior (`md:left-[var(--sidebar-width)]` + `SidebarTrigger`)
- `auth`: full-width (`left-0` no offset, no `SidebarTrigger`)

**Option B: Create a separate thin wrapper `AuthHeader`** (no shared-component mutation)
- New file: `app/(auth)/_components/auth-header.tsx` or inline in a layout
- Copies just the pill JSX with `left-0` and no `SidebarTrigger`
- Imports `WORDMARK` from `lib/brand`

**Option C: Render pill inline in auth layout(s)**
- Duplicate the pill div inside each auth page (or an auth layout file)
- Most verbose, hardest to maintain

**Recommendation:** Option A (add `variant` prop to `Header`). This is the cleanest approach and aligns with the CONTEXT.md direction "default wordmark-only" for auth right slot. The Phase 15-02 SUMMARY.md explicitly notes: "Phase 17 introduces a separate `PublicHeader` for public surfaces — public surfaces have NO sidebar, so the offset pattern is moot for that phase." Auth surfaces are in the same no-sidebar category as public surfaces, BUT since we're explicitly told to render `<Header variant="owner" />` (REQUIREMENTS.md AUTH-13), the component needs a variant prop to strip the sidebar trigger and offset.

**Exact implementation:**
```tsx
interface HeaderProps {
  variant?: "owner" | "auth";
  rightLabel?: string; // explicit label override (for "Setup" in onboarding)
}

export function Header({ variant = "owner", rightLabel }: HeaderProps)
```
- When `variant === "auth"`: outer `<header>` uses `fixed top-2 md:top-6 left-0 right-0 z-30 px-4` (no sidebar offset), no `SidebarTrigger`
- When `variant === "owner"`: existing behavior unchanged
- `rightLabel` prop: when provided, renders it instead of the `getContextLabel(pathname)` result — needed for onboarding's static "Setup" label

**Alternative reading of REQUIREMENTS.md AUTH-13:** "All auth pages render `<Header variant="owner" />`" — if this is taken literally, the plan might mean the CONTEXT.md "variant=owner" is already the new term for what auth gets. In that case, the `variant` prop is already the intended API. Either way, the pill needs to lose `md:left-[var(--sidebar-width)]` and `SidebarTrigger` when used on auth/onboarding.

---

## 4. `account-deleted/page.tsx` Current State

**File:** `app/account-deleted/page.tsx`

Current content: bare, no imports whatsoever. Structure:
```tsx
export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen flex items-start justify-center p-8 pt-24">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-semibold">Account deleted</h1>
        <p className="mt-4 text-gray-600">...</p>
        <a href="/app/login" className="mt-6 inline-block text-blue-600 underline hover:text-blue-800">
          Back to log in
        </a>
      </div>
    </div>
  );
}
```

**What AUTH-14 requires:**
- Add `<Header variant="owner" />` (pill)
- Add `<BackgroundGlow />` (ambient glow)
- Wrap content in `bg-white rounded-xl border border-gray-200 p-6 shadow-sm max-w-md mx-auto` card
- Replace bare `<a>` with styled `<Button>` (import from `@/components/ui/button`)

**No functional logic** — this page has zero Server Actions, zero auth checks, zero searchParams. It is entirely static. Full freedom to restructure JSX.

---

## 5. Onboarding Progress Component

**Location:** Inline in `app/onboarding/layout.tsx` (not a separate component)

Current implementation (lines 36-46):
```tsx
<div className="mt-3 flex gap-1">
  {[1, 2, 3].map((s) => (
    <div
      key={s}
      className={`h-1.5 flex-1 rounded-full ${
        s <= me.onboarding_step ? "bg-blue-600" : "bg-gray-200"
      }`}
    />
  ))}
</div>
```

**Key observations:**
- Inline class composition via template string: `s <= me.onboarding_step ? "bg-blue-600" : "bg-gray-200"`
- Active color is `bg-blue-600` — ONBOARD-13 requires changing to `bg-blue-500`
- Inactive color is `bg-gray-200` — stays unchanged
- The `me.onboarding_step` value drives which segments are active — this DB read is in the layout auth gate logic (lines 11-18) and must be preserved exactly

**JIT safety check:** `bg-blue-500` and `bg-blue-600` are both static Tailwind class strings (not runtime-composed from hex values). The template string `s <= me.onboarding_step ? "bg-blue-500" : "bg-gray-200"` is safe — both branches are complete, literal Tailwind class names known at build time.

**Note on "Step X of 3" subtext:** The current layout shows:
```tsx
<p className="mt-1 text-sm text-gray-500">Step {me.onboarding_step} of 3</p>
```
CONTEXT.md locked decision: show `"Step X of 3"` subtext only (no per-segment step names). This matches the current implementation exactly — no change needed to this element other than verifying it stays.

---

## 6. Functional Surface Area — "Do Not Touch" Map

### Auth Pages: Server Component Functional Elements

| Page | Do Not Touch |
|------|--------------|
| `login/page.tsx` | `createClient()` call, `getClaims()` check, `redirect("/app")`, `await searchParams` destructure, `<LoginForm resetSuccess={reset === "success"} />` prop |
| `signup/page.tsx` | (no functional logic in page shell — but `<SignupForm />` client island must remain) |
| `forgot-password/page.tsx` | (no functional logic in page shell — `<ForgotPasswordForm />` client island must remain) |
| `verify-email/page.tsx` | `await searchParams` destructure, `<ResendVerificationButton action={resendVerification} initialEmail={email} />` — both `action` prop binding and `initialEmail` prop |
| `reset-password/page.tsx` | `createClient()` call, `getClaims()` check, `hasSession` branch logic — both the expired-link fallback JSX and the form JSX must preserve the conditional |
| `auth-error/page.tsx` | `await searchParams` destructure, `isExpired` computation, `headline`/`body` derivation, `<ResendVerificationButton action={resendVerification} initialEmail={email} />` — both `action` prop binding and `initialEmail` prop |
| `account-deleted/page.tsx` | Nothing functional to preserve — page is fully static |

### Auth Client-Island Components: Do Not Touch At All

These files are NOT modified by Phase 16:
- `login-form.tsx` — `loginAction` binding via `useActionState`
- `signup-form.tsx` — `signUpAction` binding via `useActionState`
- `forgot-password-form.tsx` — `requestPasswordReset` binding via `useActionState`
- `reset-password-form.tsx` — `resetPasswordAction` binding via `useActionState`
- `resend-verification-button.tsx` — `action` prop Server Action binding, `initialEmail` hidden input, cooldown timer state

These forms use `<Card>` from `@/components/ui/card`. REQUIREMENTS.md AUTH-16 says "verify shadcn Card matches or override explicitly." See section 8.

### Onboarding: Functional Elements to Preserve

| File | Do Not Touch |
|------|--------------|
| `layout.tsx` | `getClaims()` redirect to `/app/login`, accounts query (`.select("id, onboarding_complete, onboarding_step")`), `me.onboarding_complete` redirect to `/app`, `me.onboarding_step` value (drives progress bar) |
| `step-1-account/account-form.tsx` | `saveStep1Action` binding, slug availability `fetch`, all `useActionState`/RHF logic |
| `step-2-timezone/timezone-form.tsx` | `saveStep2Action` binding, `Intl.DateTimeFormat` timezone detection, all `useActionState`/RHF logic |
| `step-3-event-type/event-type-form.tsx` | `completeOnboardingAction` binding, all `useActionState`/RHF logic |

---

## 7. `rounded-lg` vs `rounded-xl` Resolution

### The Conflict

- **CONTEXT.md default (Phase 15 reuse):** `rounded-lg border border-gray-200 bg-white p-6 shadow-sm`
- **REQUIREMENTS.md AUTH-14/16:** `bg-white rounded-xl border border-gray-200 p-6 shadow-sm` (and `rounded-xl` explicitly named)

### Evidence from Codebase

Phase 15-02-PLAN.md at the `locked_decisions_from_context` block explicitly states:
> "Cards: `rounded-lg` (8px) — supersedes REQUIREMENTS.md OWNER-10 `rounded-xl`. Locked target class string: `rounded-lg border border-gray-200 bg-white p-6 shadow-sm`"

However, this override was specifically for the **owner shell** cards (OWNER-10). The Phase 15 plan explicitly overrode REQUIREMENTS.md for owner shell cards.

REQUIREMENTS.md AUTH-16 applies to **auth pages** — a separate surface from the owner shell. The REQUIREMENTS.md spec for auth is `rounded-xl`.

### Recommendation

**Use `rounded-xl` for auth and onboarding cards.** Rationale:
1. Phase 15's override was explicit about scope: "supersedes REQUIREMENTS.md OWNER-10" — OWNER-10 is the owner shell requirement, not AUTH-14/16.
2. REQUIREMENTS.md AUTH-14/16 is the authoritative spec for the auth surface and was written after Phase 15's owner-shell decision.
3. Auth cards are a different visual context — slightly more prominent standalone cards vs. dashboard content cards.
4. `rounded-xl` (12px) is visually more appropriate for centered standalone forms.

**Flag for planner:** The CONTEXT.md "Note conflict to investigate" entry says to identify which is canonical for Phase 16. The answer is: use `rounded-xl` for auth/onboarding cards (AUTH-14/16 is the spec for this phase; Phase 15's `rounded-lg` lock applied only to the owner shell).

---

## 8. shadcn Card Component Analysis

**File:** `components/ui/card.tsx`

The shadcn `Card` component's base class string:
```
group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 ...
```

**What the shadcn Card gives you:**
- `rounded-xl` — matches REQUIREMENTS.md AUTH-16 target
- `bg-card` — resolves to `var(--card)` CSS token (NOT `bg-white` directly)
- `ring-1 ring-foreground/10` — a faint ring, NOT `border border-gray-200`
- No `shadow-sm` — no shadow by default
- `py-4` spacing — different from the target `p-6`

**Conclusion:** The shadcn `<Card>` component does NOT match the REQUIREMENTS.md AUTH-16 target class `bg-white rounded-xl border border-gray-200 p-6 shadow-sm`. Specifically:
- `bg-card` ≠ `bg-white` (depends on CSS token, not guaranteed to be pure white)
- `ring-1 ring-foreground/10` ≠ `border border-gray-200` (different styling approach)
- No `shadow-sm`
- `py-4` ≠ `p-6`

**Current usage in auth client islands:** `LoginForm`, `SignupForm`, `ForgotPasswordForm`, `ResetPasswordForm`, and `ResendVerificationButton` ALL use `<Card>` from shadcn. These client-island files are NOT modified by Phase 16 (AUTH-15 preservation requirement).

**AUTH-16 instruction:** "verify shadcn Card token defaults match or override explicitly."

**Resolution:** Since the client-island components cannot be modified, and they use `<Card>` which has `bg-card` (not `bg-white`), the correct approach for Phase 16 is to ensure the `:root` CSS token `--card` resolves to white. Check `app/globals.css` `:root` block.

Additionally, for the auth page shells themselves (which wrap content with the outer card div), use explicit className: `className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"`.

The login/signup pages use the left-column `<div className="w-full max-w-sm">` as the form container — the `<Card>` shadcn component is inside `<LoginForm>`/`<SignupForm>`. Phase 16's plan must NOT break this existing form containment structure.

---

## 9. Wave Decomposition Recommendation

### Dependency Analysis

- `AuthHero` re-skin (login + signup pages) requires `BackgroundGlow` (exists from Phase 15)
- The 5 short auth pages (forgot-password, reset-password, verify-email, auth-error, account-deleted) each need: `BackgroundGlow` + modified `Header`
- `Header` component needs a `variant` prop addition for use without sidebar
- Onboarding layout needs `BackgroundGlow` + modified `Header` + progress bar color change
- Onboarding step pages need card class wrapping

### Proposed Wave Structure

**Wave 1 — Parallel:**

**Plan 16-01: Header variant addition** (blocker for all other plans except AuthHero)
- Modify `app/_components/header.tsx` to add `variant` and `rightLabel` props
- `variant="auth"`: strips `md:left-[var(--sidebar-width)]` offset, strips `SidebarTrigger`
- `rightLabel`: overrides `getContextLabel()` return (for "Setup" in onboarding)
- Low risk: additive change only; `variant="owner"` default preserves existing behavior exactly
- Verify: existing owner shell pages still look correct (no regression)

**Plan 16-02: AuthHero re-skin + login/signup pages** (independent — login/signup only touch `AuthHero`)
- Modify `app/(auth)/_components/auth-hero.tsx`: swap `NSIGradientBackdrop` → `BackgroundGlow`
- Add `<Header variant="auth" />` to login/page and signup/page (pill spanning both columns)
- Left-column `<main>` styling: add `pt-20 md:pt-24` to clear fixed pill
- Background: `bg-white` on left stays; right aside already `bg-gray-50`

**Wave 2 — After Wave 1 both complete:**

**Plan 16-03: 5 short auth pages re-skin** (depends on 16-01 for the auth-variant Header)
Files: forgot-password, reset-password, verify-email, auth-error, account-deleted
- Each gets: single-column layout with `bg-gray-50` base + `BackgroundGlow` + `Header variant="auth"` pill + centered white card
- account-deleted gets the biggest change (AUTH-14): full re-skin from bare to properly styled
- forgot-password, reset-password, verify-email, auth-error: strip the split-panel `lg:grid-cols-2`, keep only left form column, add BackgroundGlow, add Header, add card wrapper

**Plan 16-04: Onboarding re-skin** (depends on 16-01 for the rightLabel prop)
Files: `app/onboarding/layout.tsx`, step-1/page, step-2/page, step-3/page
- Layout: `bg-white` → `bg-gray-50`, add `BackgroundGlow` + `<Header variant="auth" rightLabel="Setup" />`, add `pt-20 md:pt-24` clearance, keep progress bar (color `bg-blue-600` → `bg-blue-500`)
- Step pages: wrap form in `bg-white rounded-xl border border-gray-200 p-6 shadow-sm max-w-xl mx-auto`

### Wave Summary

```
Wave 1 (parallel):
  16-01: Header variant prop addition
  16-02: AuthHero + login/signup re-skin

Wave 2 (parallel, after both Wave 1 plans complete):
  16-03: 5 short auth pages re-skin
  16-04: Onboarding layout + 3 step pages re-skin
```

---

## 10. Visual Gate / Verification Approach

Phase 15's MN-01 pattern: "deploy + eyeball" as the final gate. For Phase 16, the same approach applies but with specific visual checkpoints per plan.

### Per-Plan Verification Checkpoints

**Plan 16-01 (Header variant):**
- Static check: `grep` confirms `md:left-[var(--sidebar-width)]` is present for `variant="owner"` and absent for `variant="auth"`
- Static check: `SidebarTrigger` import and render only present for `variant="owner"`
- Regression check: open `/app` and verify pill still renders correctly with sidebar offset
- `npx tsc --noEmit` passes

**Plan 16-02 (AuthHero + login/signup):**
- Static check: `NSIGradientBackdrop` import gone from `auth-hero.tsx`; `BackgroundGlow` import present
- Visual gate: open `/app/login` — right panel shows blue glow (not dark navy gradient); pill renders at top spanning full width; on mobile, form-only (AuthHero hidden)
- Visual gate: open `/app/signup` — same checks
- Functional gate: login form still submits and redirects correctly

**Plan 16-03 (5 short auth pages):**
- Static check per page: no `lg:grid-cols-2` layout remaining on the 5 pages
- Visual gate: open each of the 5 pages — `bg-gray-50` background visible, blue glow in background, pill at top, white card centered
- Functional gate for each page:
  - `/app/forgot-password`: form submits and shows success state
  - `/auth/reset-password`: unauthenticated visit shows expired-link view; authenticated shows form
  - `/app/verify-email?email=test@example.com`: shows email address in body text, resend button functional
  - `/auth/auth-error?reason=otp_expired`: shows "That link has expired" headline and resend form
  - `/account-deleted`: shows card with content and styled Button link

**Plan 16-04 (Onboarding):**
- Static check: `bg-blue-600` → `bg-blue-500` in progress bar (zero remaining `bg-blue-600` in layout.tsx)
- Static check: layout.tsx no longer has `bg-white` as page background; has `bg-gray-50`
- Visual gate: complete onboarding wizard start-to-finish — pill renders at top, progress bar shows blue-500 segments, each step card is white on gray-50 background with glow visible
- Functional gate: completing step 1 correctly redirects to step 2; step 3 completion redirects to `/app`

### Must-Have Verification Strings per Plan

**16-01 must_haves:**
- `header.tsx` contains `variant?: "owner" | "auth"` (or equivalent prop)
- `variant="owner"` branch: contains `md:left-[var(--sidebar-width)]` and `SidebarTrigger`
- `variant="auth"` branch: no `--sidebar-width` reference, no `SidebarTrigger`

**16-02 must_haves:**
- `auth-hero.tsx`: zero hits for `NSIGradientBackdrop`; at least one hit for `BackgroundGlow`
- `login/page.tsx`: contains `<Header` and `<BackgroundGlow` (or imports them)
- `signup/page.tsx`: same

**16-03 must_haves per page:**
- Zero hits for `NSIGradientBackdrop` in all 5 pages
- All 5 pages: no `lg:grid-cols-2` in page JSX
- `account-deleted/page.tsx`: contains `Button` import, `BackgroundGlow` import, `rounded-xl`

**16-04 must_haves:**
- `layout.tsx`: zero hits for `bg-blue-600`; at least three hits for `bg-blue-500` (one per segment or in the ternary)
- `layout.tsx`: `bg-gray-50` on page wrapper; `BackgroundGlow` and `Header` imports
- Step pages: `rounded-xl` in card wrapper divs

---

## 11. Additional Findings

### `reset-password` and `auth-error` Route Group Discrepancy

- `reset-password` lives at `app/auth/reset-password/page.tsx` (NOT in the `(auth)` route group)
- `auth-error` lives at `app/auth/auth-error/page.tsx` (NOT in the `(auth)` route group)
- These are NOT covered by any potential `(auth)` layout file (and there is no `app/(auth)/layout.tsx`)
- They are standalone pages with their own JSX structure
- For Phase 16, they get the same visual treatment as the other 3 single-column auth pages

### No Auth Layout File Exists

`app/(auth)/layout.tsx` does NOT exist. This means there is no shared layout for auth pages — each page renders its own full-page structure. This is relevant for the Header: the pill must be added to each page individually (or via a newly created auth layout).

**Option for Phase 16:** Create `app/(auth)/layout.tsx` with the shared chrome (BackgroundGlow, Header, bg-gray-50), reducing per-page changes. However: `reset-password` and `auth-error` are NOT in the `(auth)` route group, so they'd still need individual treatment. And login/signup have a split-panel layout that differs from the 5 single-column pages.

**Recommendation:** Do NOT create a shared auth layout — the structural differences between split-panel (login/signup) and single-column (other 5) make a shared layout awkward. Handle each page individually as scoped.

### Layout Context Label

The current `Header()` returns an empty string for all non-`/app/*` routes. For auth pages (at `/app/login` etc.), `getContextLabel` would return `''` (empty) since none of the `startsWith('/app/...')` patterns match login/signup. For onboarding at `/onboarding/*`, it also returns `''`. So:

- Auth pages: right slot renders nothing (CONTEXT.md "default wordmark-only")
- Onboarding pages: right slot renders "Setup" (via the `rightLabel` prop)

This matches the CONTEXT.md locked decisions exactly.

### `BackgroundGlow` Blob Offsets Context

The current `BackgroundGlow` blob offsets (`calc(50% + 100px)` and `calc(50% + 0px)`) were calibrated for a sidebar-constrained container (~1024px wide). Auth/onboarding pages have no sidebar — their containing block is the full viewport width. At full viewport width, the blobs will shift relative to center — `calc(50% + 100px)` with a 1440px viewport means the upper blob is at `820px`, which is ~57% across. This may look slightly off-center compared to the Phase 15 owner shell.

**Recommendation for planner:** Note that the blob positions MAY need adjustment for full-viewport context. The visual gate should specifically check whether both blobs are visible and aesthetically placed. If the upper blob appears too far right on a wide screen, reducing `calc(50% + 100px)` to `calc(50% + 50px)` or even `calc(50% + 0px)` would center them more. This is a visual discretion item — document as a "visual gate to check" not a hard requirement.

---

## Open Questions

1. **`--card` token value in `globals.css`:** The shadcn `<Card>` uses `bg-card`. If `:root --card` is set to white (which is typical in shadcn light mode), then the client-island forms that use `<Card>` will render on white backgrounds naturally. The planner should include a task to verify this. If `--card` is not white, `app/globals.css` needs a `--card` value fix. (Confidence: MEDIUM — likely fine, but verify.)

2. **`app/auth/` route group:** The two pages in `app/auth/` (`reset-password`, `auth-error`) are outside the `(auth)` route group. If Phase 16 creates any layout file, it won't cover these. Planner must ensure these get individual treatment.

3. **Onboarding `pt-20 md:pt-24` content clearance:** The Phase 15 owner shell uses `pt-20 md:pt-24` on `<main>` to clear the fixed pill. The same value should apply to the onboarding layout's content wrapper. ONBOARD-12 specifies `pt-20 md:pt-24 pb-12` explicitly — this matches Phase 15's established value.

4. **"Set up your booking page" h1 in onboarding layout:** CONTEXT.md discretion default is "drop if pill+Setup+progress+per-step h2 are sufficient." The current layout has:
   ```tsx
   <h1 className="text-2xl font-semibold text-gray-900">Set up your booking page</h1>
   <p className="mt-1 text-sm text-gray-500">Step {me.onboarding_step} of 3</p>
   ```
   With a pill showing "Setup" in the right slot AND per-step `<h2>` text in each step page, this h1 + p block adds redundancy. Default recommendation: drop the h1 (keep the "Step X of 3" subtext since ONBOARD-13 requires it). Planner should decide.

---

## Sources

All findings from direct codebase inspection (HIGH confidence):

- `app/(auth)/app/login/page.tsx`
- `app/(auth)/app/signup/page.tsx`
- `app/(auth)/app/forgot-password/page.tsx`
- `app/(auth)/app/verify-email/page.tsx`
- `app/auth/reset-password/page.tsx`
- `app/auth/auth-error/page.tsx`
- `app/account-deleted/page.tsx`
- `app/(auth)/_components/auth-hero.tsx`
- `app/(auth)/app/login/login-form.tsx`
- `app/(auth)/app/signup/signup-form.tsx`
- `app/(auth)/app/forgot-password/forgot-password-form.tsx`
- `app/auth/reset-password/reset-password-form.tsx`
- `app/(auth)/app/verify-email/resend-verification-button.tsx`
- `app/(auth)/app/verify-email/actions.ts`
- `app/(auth)/app/login/actions.ts`
- `app/onboarding/layout.tsx`
- `app/onboarding/step-1-account/page.tsx` + `account-form.tsx`
- `app/onboarding/step-2-timezone/page.tsx` + `timezone-form.tsx`
- `app/onboarding/step-3-event-type/page.tsx` + `event-type-form.tsx`
- `app/onboarding/actions.ts`
- `app/_components/background-glow.tsx`
- `app/_components/header.tsx`
- `components/nsi-gradient-backdrop.tsx`
- `components/ui/card.tsx`
- `components/ui/button.tsx`
- `lib/brand.ts`
- `.planning/phases/15-backgroundglow-header-pill-owner-shell-re-skin/15-01-PLAN.md`
- `.planning/phases/15-backgroundglow-header-pill-owner-shell-re-skin/15-02-PLAN.md`
- `.planning/phases/15-backgroundglow-header-pill-owner-shell-re-skin/15-02-SUMMARY.md`

---

## Metadata

**Confidence breakdown:**
- File inventory: HIGH — direct file reads
- Phase 15 reference patterns: HIGH — plan and summary docs read directly
- Header API / variant proposal: HIGH — component read directly; conflict clearly identified
- rounded-xl vs rounded-lg resolution: HIGH — both specs read; recommendation based on scope analysis
- shadcn Card analysis: HIGH — component file read directly
- Wave decomposition: HIGH — dependency relationships are clear from file inventory
- Visual gate checkpoints: HIGH — based on Phase 15 MN-01 pattern

**Research date:** 2026-04-30
**Valid until:** Stable — no external dependencies; pure codebase analysis
