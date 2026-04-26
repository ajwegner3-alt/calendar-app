---
phase: 07-widget-and-branding
plan: 06
type: execute
wave: 3
depends_on: ["07-01"]
files_modified:
  - app/[account]/[event-slug]/page.tsx
  - app/[account]/[event-slug]/_components/booking-shell.tsx
  - app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx
  - app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts
  - app/cancel/[token]/page.tsx
  - app/cancel/[token]/_lib/resolve-cancel-token.ts
  - app/reschedule/[token]/page.tsx
  - app/reschedule/[token]/_lib/resolve-reschedule-token.ts
  - app/_components/branded-page.tsx
autonomous: false

must_haves:
  truths:
    - "Public booking page /[account]/[event-slug] shows the account logo (if set) in its header and uses brand_primary on the primary CTA button"
    - "Confirmation page /[account]/[event-slug]/confirmed/[booking-id] shows the account logo + brand-colored success header"
    - "Cancel page /cancel/[token] shows account logo + brand-colored Cancel button"
    - "Reschedule page /reschedule/[token] shows account logo + brand-colored Confirm Reschedule button"
    - "All four surfaces gracefully fall back to NSI navy (#0A2540) and no-logo when account columns are null"
    - "Text-on-color contrast is auto-picked via pickTextColor (no unreadable buttons)"
  artifacts:
    - path: "app/_components/branded-page.tsx"
      provides: "Shared client wrapper: applies --brand-primary + --brand-text CSS vars to a wrapping div + renders optional logo header"
      exports: ["BrandedPage"]
    - path: "app/[account]/[event-slug]/page.tsx"
      provides: "Public booking page wrapped in BrandedPage; passes account branding through"
      contains: "BrandedPage"
    - path: "app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts"
      provides: "Loader extended to SELECT logo_url + brand_primary on accounts join"
      contains: "logo_url"
    - path: "app/cancel/[token]/_lib/resolve-cancel-token.ts"
      provides: "Resolver extended to return account branding"
      contains: "logo_url"
    - path: "app/reschedule/[token]/_lib/resolve-reschedule-token.ts"
      provides: "Resolver extended to return account branding"
      contains: "logo_url"
  key_links:
    - from: "app/_components/branded-page.tsx"
      to: "lib/branding/contrast.ts pickTextColor"
      via: "import { pickTextColor }"
      pattern: "pickTextColor"
    - from: "app/[account]/[event-slug]/page.tsx"
      to: "BrandedPage wrapper"
      via: "JSX wraps existing main content"
      pattern: "<BrandedPage"
    - from: "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx"
      to: "data.account.logo_url + brand_primary"
      via: "passes to BrandedPage"
      pattern: "BrandedPage"
    - from: "app/cancel/[token]/page.tsx"
      to: "BrandedPage wrapper"
      via: "JSX wraps existing card"
      pattern: "<BrandedPage"
    - from: "app/reschedule/[token]/page.tsx"
      to: "BrandedPage wrapper"
      via: "JSX wraps existing card"
      pattern: "<BrandedPage"
---

<objective>
Apply per-account branding to the four public page surfaces:
1. Public booking page `/[account]/[event-slug]`
2. Confirmation page `/[account]/[event-slug]/confirmed/[booking-id]`
3. Cancel page `/cancel/[token]`
4. Reschedule page `/reschedule/[token]`

Each surface gets a top-centered logo (when set) and uses the account's brand_primary color on its primary CTA. Fallbacks: NSI navy `#0A2540` when null; no logo when null. Text contrast auto-picked.

Purpose: Delivers BRAND-03 (booking + confirmation + cancel + reschedule pages render account branding). The shared `BrandedPage` wrapper centralizes logo + CSS-var injection so each page only needs a one-line wrap. CTAs in existing components consume `var(--brand-primary)` via inline style.

Output: New `app/_components/branded-page.tsx`; loader extensions on confirmation + cancel + reschedule resolvers; one-line wraps + targeted CTA color updates on the four pages.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07-widget-and-branding/07-CONTEXT.md
@.planning/phases/07-widget-and-branding/07-RESEARCH.md
@.planning/phases/07-widget-and-branding/07-01-SUMMARY.md

# Files modified
@app/[account]/[event-slug]/page.tsx
@app/[account]/[event-slug]/_components/booking-shell.tsx
@app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx
@app/cancel/[token]/page.tsx
@app/reschedule/[token]/page.tsx
@app/[account]/[event-slug]/_lib/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create app/_components/branded-page.tsx (shared wrapper)</name>
  <files>
    app/_components/branded-page.tsx
  </files>
  <action>
    Create a server component (NO `"use client"` — it's pure JSX with inline style) that wraps page content with branding CSS vars and an optional logo header.

    ```tsx
    import type { CSSProperties, ReactNode } from "react";
    import { pickTextColor } from "@/lib/branding/contrast";

    interface BrandedPageProps {
      logoUrl: string | null;
      primaryColor: string | null;
      accountName: string;
      children: ReactNode;
      /** Optional: render logo at this max width (default 120px). */
      logoMaxWidth?: number;
    }

    /**
     * Wraps page content with --brand-primary + --brand-text CSS vars and renders
     * an optional top-centered logo header.
     *
     * Used by:
     *   - /[account]/[event-slug]                  (booking page)
     *   - /[account]/[event-slug]/confirmed/[id]   (confirmation page)
     *   - /cancel/[token]                           (cancel page)
     *   - /reschedule/[token]                       (reschedule page)
     *
     * Fallback strategy:
     *   - logoUrl null → no header rendered
     *   - primaryColor null → falls back to NSI navy (#0A2540)
     *   - text color auto-picked via WCAG luminance for readable contrast
     *
     * Components inside `children` consume the CSS vars via inline style:
     *   <button style={{ background: "var(--brand-primary)", color: "var(--brand-text)" }}>
     */
    export function BrandedPage({
      logoUrl,
      primaryColor,
      accountName,
      children,
      logoMaxWidth = 120,
    }: BrandedPageProps) {
      const effective = primaryColor ?? "#0A2540";
      const textColor = pickTextColor(effective);

      const style: CSSProperties = {
        ["--brand-primary" as never]: effective,
        ["--brand-text" as never]: textColor,
      };

      return (
        <div style={style}>
          {logoUrl && (
            <header className="pt-8 pb-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={`${accountName} logo`}
                style={{
                  maxWidth: logoMaxWidth,
                  maxHeight: 60,
                  height: "auto",
                  width: "auto",
                }}
              />
            </header>
          )}
          {children}
        </div>
      );
    }
    ```

    KEY DECISIONS:
    - Plain `<img>` (not next/image) — Supabase Storage URL is on a different domain; configuring remotePatterns is more friction.
    - CSS var names match Plan 07-03 EmbedShell exactly: `--brand-primary` + `--brand-text`. Single naming convention across all surfaces.
    - The CSS vars cascade to all descendants — components reference `var(--brand-primary)` in their own inline styles without needing props.
    - logoUrl null → header NOT rendered (no empty space). primaryColor null → NSI navy default. Both independent.
  </action>
  <verify>
    File exists. `npx tsc --noEmit` passes.
  </verify>
  <done>
    BrandedPage component renders optional logo + applies CSS vars; reusable across all four surfaces.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend loaders for confirmed/cancel/reschedule pages to return logo_url + brand_primary</name>
  <files>
    app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts
    app/cancel/[token]/_lib/resolve-cancel-token.ts
    app/reschedule/[token]/_lib/resolve-reschedule-token.ts
  </files>
  <action>
    For each of the three loader files:

    1. **Read the file first** to understand its current SELECT shape and return type.
    2. Find the `accounts` SELECT (either standalone `.from('accounts').select(...)` or `accounts!inner(...)` join).
    3. Add `, logo_url, brand_primary` to the column list.
    4. Update the returned account object shape to include `logo_url` and `brand_primary`.
    5. Update any TypeScript interface in the same file (or imported) so consumers can read these fields.

    SPECIFIC LOCATIONS:

    **load-confirmed-booking.ts**:
    - Likely uses `accounts!inner(name, slug, timezone, ...)` syntax in the bookings query.
    - Add `logo_url, brand_primary` to that join's column list.
    - Update the returned `data.account` object to include both.

    **resolve-cancel-token.ts**:
    - Same pattern. Account fields are returned in `resolved.account` object.
    - Add the two fields.

    **resolve-reschedule-token.ts**:
    - Same pattern. Returned in `resolved.account`.
    - Add the two fields.

    DO NOT modify the load logic, the rate-limit logic, or any business rules. ONLY widen the SELECT and the returned shape.

    DO NOT remove `import "server-only"` or any other existing line.
  </action>
  <verify>
    `grep -n 'logo_url' app/[account]/[event-slug]/confirmed/[booking-id]/_lib/load-confirmed-booking.ts` → present.
    `grep -n 'logo_url' app/cancel/[token]/_lib/resolve-cancel-token.ts` → present.
    `grep -n 'logo_url' app/reschedule/[token]/_lib/resolve-reschedule-token.ts` → present.
    `npx tsc --noEmit` passes (page.tsx files that consume these loaders should still compile because the change is additive).
    `npm test` — Phase 6 integration tests still green (loader output is a superset; nothing is removed).
  </verify>
  <done>
    All three loaders return account.logo_url + brand_primary; types reflect this; no test regressions.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wrap all four pages with BrandedPage + recolor primary CTAs</name>
  <files>
    app/[account]/[event-slug]/page.tsx
    app/[account]/[event-slug]/_components/booking-shell.tsx
    app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx
    app/cancel/[token]/page.tsx
    app/reschedule/[token]/page.tsx
  </files>
  <action>
    For EACH of the four pages: wrap the existing top-level JSX with `<BrandedPage logoUrl={...} primaryColor={...} accountName={...}>...</BrandedPage>`.

    **A. app/[account]/[event-slug]/page.tsx** (booking page):
    - Import `BrandedPage` from `@/app/_components/branded-page`.
    - Wrap the `<main>` block with `<BrandedPage logoUrl={data.account.logo_url} primaryColor={data.account.brand_primary} accountName={data.account.name}>` (BrandedPage outside `<main>`).
    - Hide the existing text-only `<header>` that shows account name (logo replaces it visually) IF logo is present — OR leave it in (subtle text + logo together is fine). Decision: leave the existing text header; logo sits above it. Two-tier branding.

    **B. app/[account]/[event-slug]/_components/booking-shell.tsx** (the BookingShell client component):
    - Find the primary submit button on the BookingForm (the "Book this slot" or similar CTA).
    - Add `style={{ background: "var(--brand-primary, #0A2540)", color: "var(--brand-text, #fff)" }}` to it. The fallback in the CSS var (`, #0A2540`) covers contexts where BrandedPage isn't a parent (e.g., direct rendering in a test).
    - DO NOT add a className change — the existing shadcn Button styling handles padding/radius. The inline style overrides the bg + color only.
    - Also recolor the "Pick a new time below" race-loser banner CTA if it has one.

    **C. app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx**:
    - Wrap the `<main>` with `<BrandedPage logoUrl={data.account.logo_url} primaryColor={data.account.brand_primary} accountName={data.account.name}>`.
    - Find the success "✓" circle (currently `bg-primary/10 text-primary`) and recolor it to use `var(--brand-primary)` for both bg (with opacity) and text. Inline style approach: `style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 15%, transparent)", color: "var(--brand-primary)" }}` — color-mix is well-supported in modern browsers.
    - Note: Phase 5/6 confirmation page reads `data.account` from `loadConfirmedBooking`; data shape extension was done in Task 2.

    **D. app/cancel/[token]/page.tsx**:
    - Wrap the outer `<div>` with `<BrandedPage logoUrl={resolved.account?.logo_url ?? null} primaryColor={resolved.account?.brand_primary ?? null} accountName={resolved.account?.name ?? "NSI"}>`. Note: `resolved.account` may be null on `not_active` state — handle gracefully (BrandedPage accepts null logo + null color and falls back).
    - The "Book again" Link in the cancelled-state branch should use brand color: `style={{ background: "var(--brand-primary, #0A2540)", color: "var(--brand-text, #fff)" }}`.
    - In the active-state branch, find the CancelConfirmForm — it's a child component. Locate its primary "Cancel booking" button and apply the same inline style. (Read `app/cancel/[token]/_components/cancel-confirm-form.tsx` first.)

    **E. app/reschedule/[token]/page.tsx**:
    - Same wrap pattern with `resolved.account`.
    - Find RescheduleShell's primary "Confirm new time" button and apply brand color inline style. (Read `app/reschedule/[token]/_components/reschedule-shell.tsx` first.)

    PATTERN LOCK FOR INLINE BUTTON STYLE:
    ```tsx
    style={{
      background: "var(--brand-primary, #0A2540)",
      color: "var(--brand-text, #ffffff)",
    }}
    ```
    The `, #0A2540` and `, #ffffff` fallbacks make the components safe even outside BrandedPage context.

    DO NOT recolor every button — only PRIMARY CTAs (the actions the user is meant to take). Secondary buttons (Cancel, Back, etc.) keep their default neutral styling.
  </action>
  <verify>
    `npm run build` succeeds.
    `npm test` — all existing Phase 5/6 integration tests still pass.
    Manual dev smoke: visit /nsi/<active-event> with a saved logo + custom color in DB:
    - Logo appears at top
    - "Book this slot" button uses the custom color
    Visit /nsi/<active-event>/confirmed/<a-recent-booking-id>:
    - Logo + colored success circle.
    Visit a /cancel/<token> link from a recent confirmation email:
    - Logo + colored Cancel button.
    Visit a /reschedule/<token> link:
    - Logo + colored Confirm button.
  </verify>
  <done>
    All four pages wrapped in BrandedPage; primary CTAs consume var(--brand-primary); fallback colors hardcoded in inline style; no test regressions.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Andrew verifies branding renders on all four public surfaces</name>
  <what-built>
    Branding (logo + primary color from account.logo_url + account.brand_primary) now renders on:
    - Public booking page
    - Confirmation page
    - Cancel page
    - Reschedule page
  </what-built>
  <how-to-verify>
    Pre-req: complete Plan 07-04 (branding editor). Save a non-default color (e.g., #C026D3 magenta) and upload a PNG logo for the nsi account.

    1. Visit https://calendar-app-xi-smoky.vercel.app/nsi/<active-event-slug> (or the local dev equivalent):
       - Top of page shows your uploaded logo (centered, max ~120px wide)
       - "Book this slot" button (after picking a time + filling form) is magenta (or whatever you set)
       - Text on button is readable (auto-picked white or black)
    2. Complete a booking. On the confirmation screen:
       - Logo is at the top
       - The success ✓ circle uses your magenta color
    3. Open the confirmation email in your inbox. Click the cancel link:
       - Cancel page shows your logo
       - "Cancel booking" button is magenta
    4. (Hopefully test booking still active) — open the reschedule link:
       - Reschedule page shows your logo
       - "Confirm new time" button is magenta
    5. Sanity check fallback: temporarily clear the brand_primary in Supabase Table Editor (or use a different account that has no branding set) and visit the booking page → falls back to NSI navy with no logo, no errors.
  </how-to-verify>
  <resume-signal>
    Reply "branding on surfaces approved" to continue. If logo doesn't appear or color isn't applied, name which surface(s) and we'll debug.
  </resume-signal>
</task>

</tasks>

<verification>
- All four pages render correctly with branding when account has logo + color set.
- Fallback to NSI navy + no logo when account columns are null.
- pickTextColor ensures readable text on any chosen color.
- No regressions in Phase 5/6 integration tests.
- Build is clean.
</verification>

<success_criteria>
1. BRAND-03 (page surfaces): booking page + confirmation + cancel + reschedule all render account.logo_url and account.brand_primary.
2. Loaders extended additively (no removed columns; no shape changes that break Phase 5/6 callers).
3. BrandedPage is reusable; CSS-var consumption pattern locked.
4. Auto-text-color via pickTextColor prevents unreadable buttons.
</success_criteria>

<output>
After completion, create `.planning/phases/07-widget-and-branding/07-06-SUMMARY.md` documenting:
- BrandedPage component contract + props
- CSS var convention (--brand-primary + --brand-text) consistent with Plan 07-03 EmbedShell
- Inline-style fallback pattern (`var(--brand-primary, #0A2540)`) so components work outside BrandedPage
- Loader extensions (additive — no removed fields)
- Specific buttons recolored per surface
- Smoke test outcome from Andrew
- Forward contract for Plan 07-07 (emails): same logo URL + brand_primary already in account row; email senders read directly from account.logo_url and account.brand_primary
</output>
