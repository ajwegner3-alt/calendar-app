---
phase: 17-public-surfaces-and-embed
plan: 03
type: execute
wave: 3
depends_on: ["17-02"]
files_modified:
  - app/[account]/page.tsx
  - app/[account]/_components/listing-hero.tsx
autonomous: true

must_haves:
  truths:
    - "Visiting /[account] renders PublicShell wrapping listing hero + event-type cards"
    - "ListingHero no longer renders its inner GradientBackdrop (PUB-05) — single page-level glow only"
    - "Hero card uses rounded-2xl + bg-white + customer brand color drives the page-level BackgroundGlow"
  artifacts:
    - path: "app/[account]/page.tsx"
      provides: "Public account listing page wrapped in PublicShell"
      contains: "PublicShell"
    - path: "app/[account]/_components/listing-hero.tsx"
      provides: "Hero card without inner GradientBackdrop"
      removes: "GradientBackdrop import + render"
  key_links:
    - from: "app/[account]/page.tsx"
      to: "app/_components/public-shell.tsx"
      via: "import + render with branding from brandingFromRow"
      pattern: "PublicShell"
    - from: "app/[account]/page.tsx"
      to: "lib/branding/read-branding.ts"
      via: "import brandingFromRow + call with data.account"
      pattern: "brandingFromRow"
---

<objective>
Migrate the public account listing page (`/[account]`) and its inner `ListingHero` component to the new `PublicShell` pattern. Remove `BrandedPage` usage from the page wrapper, and remove the inner `GradientBackdrop` from `ListingHero` (PUB-05 explicitly requires both).

Purpose: This is the canonical public surface (an NSI booking entry point). With this migration done, the visual gate can confirm `bg-gray-50` + customer-tinted glow + glass pill render correctly on a real public page. Removing `ListingHero`'s inner `GradientBackdrop` is also a hard prerequisite for Wave 4 deletion of `GradientBackdrop`.

Output: `/[account]` renders with the new visual language. `ListingHero` retains its no-logo-fallback initial circle but loses its standalone backdrop.
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
@.planning/phases/17-public-surfaces-and-embed/17-02-public-shell-SUMMARY.md

# Files this plan modifies
@app/[account]/page.tsx
@app/[account]/_components/listing-hero.tsx
@app/[account]/_lib/load-account-listing.ts
@lib/branding/read-branding.ts
</context>

<preamble>
## v1.2 Visual Locks
1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]`
2-6. (See REQUIREMENTS.md preamble)

## Phase 17 Guardrails
- **MP-04:** ListingHero's avatar circle (no-logo fallback) keeps inline `style={{ backgroundColor: avatarColor }}` — leave that pattern as-is.
- **CP-07:** Calendar dot color (`.day-has-slots`) is unaffected by this migration.
- **brandingFromRow with partial data:** The `loadAccountListing` row may not have ALL Branding columns (it does select `background_color` and `background_shade` per the existing code). Pass whatever the loader returns; `brandingFromRow` defaults missing fields to safe values per `lib/branding/read-branding.ts:23-53`.

## Requirement coverage
- PUB-05: covered by both tasks below (page + hero migration)
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Migrate /[account]/page.tsx from BrandedPage to PublicShell</name>
  <files>app/[account]/page.tsx</files>
  <action>
Open `app/[account]/page.tsx`. Current code wraps in `<BrandedPage logoUrl primaryColor accountName backgroundColor backgroundShade>` and passes `backgroundColor` + `backgroundShade` to `<ListingHero>`.

**Edit plan:**

1. Replace the `BrandedPage` import:
```typescript
// REMOVE
import { BrandedPage } from "@/app/_components/branded-page";
// REMOVE
import type { BackgroundShade } from "@/lib/branding/types";
```
With:
```typescript
import { PublicShell } from "@/app/_components/public-shell";
import { brandingFromRow } from "@/lib/branding/read-branding";
```

2. In `AccountIndexPage` function body, AFTER `if (!data) notFound()`, REMOVE the line:
```typescript
const backgroundShade = (data.account.background_shade ?? "subtle") as BackgroundShade;
```
And REPLACE with:
```typescript
const branding = brandingFromRow(data.account);
```

3. Replace the JSX return block. Current:
```typescript
return (
  <BrandedPage
    logoUrl={data.account.logo_url}
    primaryColor={data.account.brand_primary}
    accountName={data.account.name}
    backgroundColor={data.account.background_color ?? null}
    backgroundShade={backgroundShade}
  >
    <main className="mx-auto max-w-5xl px-6 py-12 md:py-20">
      <ListingHero
        accountName={data.account.name}
        logoUrl={data.account.logo_url}
        brandPrimary={data.account.brand_primary}
        backgroundColor={data.account.background_color}
        backgroundShade={backgroundShade}
      />
      <section className="mt-10">
        {/* ... event types grid unchanged ... */}
      </section>
    </main>
  </BrandedPage>
);
```

Replace with:
```typescript
return (
  <PublicShell branding={branding} accountName={data.account.name}>
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-20">
      <ListingHero
        accountName={data.account.name}
        logoUrl={data.account.logo_url}
        brandPrimary={data.account.brand_primary}
      />
      <section className="mt-10">
        {data.eventTypes.length === 0 ? (
          <AccountEmptyState
            accountName={data.account.name}
            ownerEmail={data.account.owner_email}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.eventTypes.map((event) => (
              <EventTypeCard
                key={event.id}
                accountSlug={data.account.slug}
                event={event}
                brandPrimary={data.account.brand_primary}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  </PublicShell>
);
```

**Key changes:**
- `<main>` → `<div>` because `PublicShell` already renders its own `<main>` wrapper. Avoid nested `<main>` (semantic HTML rule).
- `<ListingHero>` no longer receives `backgroundColor` or `backgroundShade` props — those props are removed in Task 2 below.
- All other JSX (event types section, EventTypeCard rendering, AccountEmptyState) preserved verbatim.
- `data.account.brand_primary` continues to be passed to `EventTypeCard` directly (that component is out of scope for this migration; it uses inline-style brand color for its CTA).

**Verify imports remain valid:**
- `EventTypeCard` import preserved.
- `AccountEmptyState` import preserved.
- `ListingHero` import preserved.
- `loadAccountListing` import preserved.
- `Metadata`, `notFound` imports preserved.
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "BrandedPage" app/[account]/page.tsx` — must return zero matches.
Run `grep -n "PublicShell" app/[account]/page.tsx` — must match.
Run `grep -n "brandingFromRow" app/[account]/page.tsx` — must match.
Run `grep -n "<main" app/[account]/page.tsx` — must return zero matches (replaced with div).
Run `npm run build` (or skip if too slow; tsc is the load-bearing check).
  </verify>
  <done>`/[account]` renders inside `<PublicShell branding={...} accountName={...}>`. No `BrandedPage` reference remains. Inner content uses `<div>` instead of `<main>`. ListingHero is rendered without backgroundColor/backgroundShade props. TypeScript clean.</done>
</task>

<task type="auto">
  <name>Task 2: Strip GradientBackdrop from ListingHero</name>
  <files>app/[account]/_components/listing-hero.tsx</files>
  <action>
Open `app/[account]/_components/listing-hero.tsx`. The current component renders an inner `<GradientBackdrop>` on the hero card and accepts `backgroundColor` + `backgroundShade` props for that purpose.

Per PUB-05 ("ListingHero inner GradientBackdrop removed (redundant with global BackgroundGlow)") and per RESEARCH.md Pitfall 5, this task removes the inner gradient AND the now-unused props.

**Edit plan:**

1. Remove imports:
```typescript
// REMOVE
import { GradientBackdrop } from "@/app/_components/gradient-backdrop";
import type { BackgroundShade } from "@/lib/branding/types";
```

2. Update the props interface — remove `backgroundColor` and `backgroundShade`:

```typescript
interface ListingHeroProps {
  accountName: string;
  logoUrl: string | null;
  brandPrimary: string | null;
}
```

3. Update function signature:
```typescript
export function ListingHero({
  accountName,
  logoUrl,
  brandPrimary,
}: ListingHeroProps) {
```

4. Remove the `backdropColor` derivation (it relied on `backgroundColor` which is gone). The `avatarColor` derivation stays:
```typescript
const avatarColor = brandPrimary ?? "#0A2540";
```

5. Update JSX — remove the `<GradientBackdrop>` element AND simplify the section's outer class. Current outer class is `relative overflow-hidden rounded-2xl border bg-white px-6 py-12 text-center md:py-20` — keep the same shape but the `relative overflow-hidden` was specifically for GradientBackdrop's absolutely-positioned circles. We can simplify to:

```typescript
return (
  <section className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm md:py-20">
    <div className="flex flex-col items-center gap-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={accountName} className="h-16 w-auto" />
      ) : (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white"
          style={{ backgroundColor: avatarColor }}
        >
          {accountName.charAt(0).toUpperCase()}
        </div>
      )}
      <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
        {accountName}
      </h1>
      <p className="max-w-md text-sm text-gray-600 md:text-base">
        Pick a time below to book a meeting.
      </p>
    </div>
  </section>
);
```

**Class string changes from PUB-05:**
- `border` → `border border-gray-200` (matches v1.2 card lock from Phase 15 OWNER-10)
- Added `shadow-sm` (matches v1.2 card lock)
- Removed `relative overflow-hidden` (no longer needed with no GradientBackdrop)
- Removed inner `relative z-10` div (no z-index stacking needed) — flatten to a single `<div className="flex flex-col items-center gap-4">`

**Decisions locked:**
- Keep `rounded-2xl` (PUB-05 spec). Note: this differs from the standard `rounded-xl` v1.2 card lock — PUB-05 explicitly specifies `rounded-2xl` for the hero pattern (more pronounced curve for the marquee element).
- Keep no-logo fallback (initial in `brand_primary`-tinted circle) verbatim — this is the canonical pattern referenced by HDR-06 and used as Header public variant fallback in Plan 17-01.

**DO NOT:**
- Remove the file (still in use).
- Change the avatar fallback pattern (it's intentional and matches Header's no-logo fallback).
- Change copy ("Pick a time below to book a meeting.").
- Touch consumers other than `app/[account]/page.tsx` (which is updated in Task 1 of this same plan to drop the deleted props).
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "GradientBackdrop" app/[account]/_components/listing-hero.tsx` — must return zero matches.
Run `grep -n "backgroundColor" app/[account]/_components/listing-hero.tsx` — must return zero matches in the props interface (only `style={{ backgroundColor: avatarColor }}` for the inline avatar style is OK — that's a different identifier).
Run `grep -rn "<ListingHero" app/` — confirm only `app/[account]/page.tsx` consumes it, and that file passes only `accountName`, `logoUrl`, `brandPrimary` (matching Task 1).
  </verify>
  <done>ListingHero no longer imports or renders `GradientBackdrop`. Props reduced to `accountName`, `logoUrl`, `brandPrimary`. Avatar no-logo fallback preserved. Outer section uses v1.2 card class string with `rounded-2xl`. TypeScript clean.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zero errors.
2. `grep -rn "GradientBackdrop" app/[account]/` — zero matches in the listing route subtree (proves PUB-05 inner removal).
3. `grep -rn "BrandedPage" app/[account]/page.tsx` — zero matches.
4. The page should render without runtime errors when navigating to `/nsi` (verified during Plan 17-09 visual gate, not here).
</verification>

<success_criteria>
1. `app/[account]/page.tsx` uses `<PublicShell>` instead of `<BrandedPage>`.
2. `app/[account]/page.tsx` calls `brandingFromRow(data.account)` to derive Branding object.
3. `app/[account]/_components/listing-hero.tsx` does not import or render `GradientBackdrop`.
4. `ListingHero` props reduced to `{ accountName, logoUrl, brandPrimary }` — `backgroundColor` and `backgroundShade` removed.
5. Hero card outer class uses `rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm md:py-20`.
6. `npx tsc --noEmit` passes.
</success_criteria>

<output>
After completion, create `.planning/phases/17-public-surfaces-and-embed/17-03-listing-page-migration-SUMMARY.md`. Note any deviations from PUB-05 spec class string and the inner-div flatten decision.
</output>
