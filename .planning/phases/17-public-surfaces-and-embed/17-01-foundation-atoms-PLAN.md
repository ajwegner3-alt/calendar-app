---
phase: 17-public-surfaces-and-embed
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/_components/background-glow.tsx
  - app/_components/powered-by-nsi.tsx
  - app/_components/header.tsx
autonomous: true

must_haves:
  truths:
    - "BackgroundGlow blob 2 terminus is transparent (not #111827) so customer-tinted blobs render cleanly on bg-gray-50"
    - "PoweredByNsi component exports a footer rendering 'Powered by North Star Integrations' linked to https://nsintegrations.com"
    - "Header component supports variant='public' with a branding prop that renders logo + account name pill"
  artifacts:
    - path: "app/_components/background-glow.tsx"
      provides: "Two-blob ambient glow (both blobs terminate at transparent)"
      contains: "linear-gradient(to top right, ${color}, transparent)"
    - path: "app/_components/powered-by-nsi.tsx"
      provides: "Public footer with NSI attribution link"
      exports: ["PoweredByNsi"]
    - path: "app/_components/header.tsx"
      provides: "Glass pill header supporting 'owner' | 'auth' | 'public' variants"
      contains: "variant === 'public'"
  key_links:
    - from: "app/_components/header.tsx"
      to: "lib/branding/types.ts"
      via: "import type { Branding }"
      pattern: "import type \\{ Branding \\} from"
    - from: "app/_components/powered-by-nsi.tsx"
      to: "https://nsintegrations.com"
      via: "anchor href"
      pattern: "https://nsintegrations\\.com"
---

<objective>
Establish three foundational component atoms that downstream public-surface plans will compose: fix the BackgroundGlow MP-10 bug (blob 2 terminus = transparent), create the PoweredByNsi footer component, and extend the Header component with a `public` variant + `branding` prop.

Purpose: PublicShell (Plan 17-02) cannot compose itself until these atoms exist. Each atom is small, additive, and parallel-safe — they touch separate files. Owner-shell behavior must remain byte-for-byte unchanged.

Output: Three independently-buildable components ready for PublicShell composition in Wave 2.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/17-public-surfaces-and-embed/17-CONTEXT.md
@.planning/phases/17-public-surfaces-and-embed/17-RESEARCH.md

# Files this plan modifies
@app/_components/background-glow.tsx
@app/_components/header.tsx
@lib/branding/types.ts
@lib/brand.ts
</context>

<preamble>
## v1.2 Visual Locks (repeat in every phase plan)
1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]` dynamic Tailwind
2. Email strategy: solid-color-only table band — no CSS gradients in email HTML
3. CSP: lives only in `proxy.ts`, never `next.config.ts`
4. Two-stage owner auth: RLS pre-check before service-role mutation
5. `background_shade` ENUM type must be dropped alongside the column
6. DROP migration = two-step deploy (code-stop-reading, wait 30 min, then DROP SQL)

## Phase 17 Guardrails
- **CP-07:** `.day-has-slots` dot is `var(--color-accent)` — DO NOT rewire to `--primary`. This plan does not touch any color tokens beyond what is explicitly listed below.
- **MP-04:** When passing brand hex into JSX, use inline `style={{...}}` only. Never compose Tailwind class strings with runtime hex.
- **Owner shell unaffected:** Header `variant="owner"` (default) and `variant="auth"` behavior MUST remain byte-for-byte identical. Only ADD the `'public'` branch + `branding` prop. Tests for owner/auth flows must pass unchanged.
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Fix BackgroundGlow MP-10 bug — blob 2 terminus → transparent</name>
  <files>app/_components/background-glow.tsx</files>
  <action>
Open `app/_components/background-glow.tsx`. Locate the second blob's `style.background` value (currently line 31):

```typescript
background: `linear-gradient(to top right, ${color}, #111827)`,
```

Change `#111827` to `transparent`:

```typescript
background: `linear-gradient(to top right, ${color}, transparent)`,
```

Update the file's top comment block to note the MP-10 fix. Append a short note to the existing comment (do not rewrite the whole comment):

```
// Phase 17 (MP-10): blob 2 terminus changed from #111827 → transparent so customer-
// tinted glows on bg-gray-50 public surfaces render cleanly without a visible dark smear.
```

DO NOT change blob 1 (it already uses `transparent`). DO NOT change blob positions, opacity, blur, size, or default color. DO NOT add new props.

**Why this matters:** Phase 15 owner shell tolerated `#111827` because the navy sidebar masked the dark terminus. On bg-gray-50 with arbitrary brand_primary (e.g., emerald, magenta), the dark gray terminus is visible and ugly. Per MP-10, both blobs must terminate at `transparent`.
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass with no new errors. Run `grep -n "#111827" app/_components/background-glow.tsx` — must return zero matches. Run `grep -n "transparent" app/_components/background-glow.tsx` — must return at least 2 matches (one per blob).
  </verify>
  <done>BackgroundGlow blob 2 terminus is `transparent`. Both blobs use `linear-gradient(to top right, ${color}, transparent)`. Owner shell visual unchanged on Vercel preview (NSI blue blobs already correctly fade to transparent in the gray-50 SidebarInset). No TypeScript errors.</done>
</task>

<task type="auto">
  <name>Task 2: Create PoweredByNsi footer component</name>
  <files>app/_components/powered-by-nsi.tsx</files>
  <action>
Create new file `app/_components/powered-by-nsi.tsx` as a Server Component (no `'use client'` directive):

```typescript
// app/_components/powered-by-nsi.tsx
// Phase 17 (PUB-04): "Powered by North Star Integrations" attribution footer.
// Used by PublicShell on every public booking surface AND inside EmbedShell.
// Text-only — final NSI mark image deferred to v1.3 (PROJECT.md Out of Scope).

export function PoweredByNsi() {
  return (
    <footer className="py-8 text-center">
      <p className="text-xs text-gray-400">
        Powered by{" "}
        <a
          href="https://nsintegrations.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 transition-colors"
        >
          North Star Integrations
        </a>
      </p>
    </footer>
  );
}
```

URL `https://nsintegrations.com` is locked by REQUIREMENTS.md PUB-04 — do NOT change. Class strings are locked by REQUIREMENTS.md PUB-04 — copy them verbatim. This component is a Server Component (no hooks, no state). DO NOT add a default export — named export only (consistency with `BackgroundGlow`, `Header`, etc.).
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass. Run `grep -n "export function PoweredByNsi" app/_components/powered-by-nsi.tsx` — must match. Run `grep -n "https://nsintegrations.com" app/_components/powered-by-nsi.tsx` — must match. Run `grep -n "use client" app/_components/powered-by-nsi.tsx` — must return zero matches (Server Component).
  </verify>
  <done>File `app/_components/powered-by-nsi.tsx` exists and exports `PoweredByNsi` as a named Server Component. Anchor links to `https://nsintegrations.com` with `target="_blank"` and `rel="noopener noreferrer"`. Text reads "Powered by North Star Integrations" (no abbreviation).</done>
</task>

<task type="auto">
  <name>Task 3: Extend Header with variant='public' + branding prop</name>
  <files>app/_components/header.tsx</files>
  <action>
Open `app/_components/header.tsx`. The current file is a `'use client'` component using `usePathname()` for owner/auth variants. Extend it WITHOUT removing or changing existing owner/auth behavior.

**Step 1 — Update HeaderProps interface:**

Add `'public'` to the variant union and add an optional `branding` prop:

```typescript
import type { Branding } from "@/lib/branding/types";

interface HeaderProps {
  variant?: 'owner' | 'auth' | 'public';
  rightLabel?: string;
  /** Required when variant="public". Provides logo + account name for the pill. */
  branding?: Branding;
  /** Required when variant="public". Provides account name text for the right slot. */
  accountName?: string;
}
```

**Step 2 — Add public-variant render branch:**

Inside the `Header` function, BEFORE the existing return for owner/auth, add a guard for `variant === 'public'` and render a separate JSX tree. Do not call `usePathname()` on this branch (no path-derived label needed). Use this implementation:

```typescript
if (variant === 'public') {
  // Phase 17 (HDR-05, HDR-06): Public pill — logo (or initial fallback) on left,
  // account name on right. Glass treatment matches owner pill (white/80 + blur)
  // for visual family continuity across surfaces.
  const logoUrl = branding?.logoUrl ?? null;
  const primaryColor = branding?.primaryColor ?? '#3B82F6';
  const name = accountName ?? '';
  const initial = name.charAt(0).toUpperCase() || 'N';

  return (
    <header className="fixed top-2 md:top-6 left-0 right-0 z-30 px-4">
      <div className="max-w-[1152px] mx-auto h-14 px-4 rounded-2xl flex items-center justify-between bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${name} logo`}
              style={{ maxHeight: 40, maxWidth: 140, height: 'auto', width: 'auto' }}
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
        </div>
        {name && (
          <span className="text-[13px] font-medium text-gray-700">
            {name}
          </span>
        )}
      </div>
    </header>
  );
}
```

**Step 3 — Leave owner/auth branch unchanged.**

The existing code path that uses `usePathname()` and renders `WORDMARK` must remain exactly as-is. The `'public'` branch returns BEFORE `usePathname()` is consumed — but since `usePathname()` is always called at the top of the function (React hooks rule), keep the `const pathname = usePathname()` call in place. The hook runs but its result is unused on the public branch (acceptable — there is no early-return-before-hook violation since the hook is still called every render).

**Verify the existing public consumer pattern:**
- `branding.logoUrl` is `string | null` per `lib/branding/types.ts` — OK to render conditionally.
- `branding.primaryColor` is always a resolved string per `brandingFromRow()` — OK to use as inline style.
- `accountName` is passed separately because `Branding` does not contain account name (it's not a branding field — it's an account field).

**MP-04 lock:** All hex values are inline styles, no Tailwind class composition.

**HDR-05/HDR-06 traceability:**
- HDR-05: logo `<img>` max-height 40px ✓
- HDR-06: no-logo fallback = initial in `brand_primary`-tinted circle ✓
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass with no errors. Run `grep -n "variant === 'public'" app/_components/header.tsx` — must match. Run `grep -n "branding?: Branding" app/_components/header.tsx` — must match. Run `grep -n "import type { Branding }" app/_components/header.tsx` — must match. Confirm owner-default behavior unchanged: `grep -n "WORDMARK" app/_components/header.tsx` still matches the existing wordmark rendering.
  </verify>
  <done>Header component accepts `variant="public"` with `branding` and `accountName` props. Public branch renders logo+initial pill. Owner and auth branches unchanged byte-for-byte. TypeScript clean. No call sites updated in this plan (call site for public surfaces lands in Plan 17-02 PublicShell and Plan 17-04..06 page migrations).</done>
</task>

</tasks>

<verification>
Run each task's verify block. Then:

1. `npx tsc --noEmit` — zero errors.
2. `grep -rn "BackgroundGlow" app/` — confirm no consumers broken (BackgroundGlow API unchanged: `color` is the only prop).
3. Open `app/(shell)/layout.tsx` mentally and confirm `<Header />` (no variant) still works — owner default unchanged.
4. Open `app/(auth)/_components/auth-hero.tsx` mentally and confirm `<Header variant="auth" />` still works — auth branch unchanged.
5. Vercel preview deploy is NOT required for this plan — it's component-only foundation work. Visual gate happens in Plan 17-09.
</verification>

<success_criteria>
1. `app/_components/background-glow.tsx` blob 2 uses `transparent` (not `#111827`).
2. `app/_components/powered-by-nsi.tsx` exists and exports `PoweredByNsi` Server Component.
3. `app/_components/header.tsx` exports `Header` with `variant: 'owner' | 'auth' | 'public'` union; `branding?: Branding` and `accountName?: string` props are accepted; public branch renders logo+initial pill.
4. `npx tsc --noEmit` passes.
5. No existing call site of `Header` or `BackgroundGlow` is broken (additive changes only).
</success_criteria>

<output>
After completion, create `.planning/phases/17-public-surfaces-and-embed/17-01-foundation-atoms-SUMMARY.md` documenting what was built and any decisions made (especially: any deviation from the spec class strings, any TypeScript signature decisions for the public variant). Note in the summary that this enables Plan 17-02 (PublicShell composition).
</output>
