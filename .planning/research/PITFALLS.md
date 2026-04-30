# Pitfalls Research

**Domain:** Multi-tenant booking tool — NSI Brand Lock-Down + UI Overhaul (v1.2)
**Researched:** 2026-04-30
**Confidence:** HIGH — all pitfalls grounded in actual codebase reads, not assumptions

---

## Critical Pitfalls

These will break the ship if not addressed before the DROP migration deploys.

---

### CP-01: `app/api/bookings/route.ts` Still Reads Deprecated Columns at DROP Time

**What goes wrong:**
`app/api/bookings/route.ts` line 171 SELECT clause includes both `chrome_tint_intensity` and `sidebar_color` — two of the four columns v1.2 plans to DROP. If the DROP migration runs before this file is updated, every new booking attempt throws a Postgres error (column does not exist) and the booking route returns 500.

**Why it happens:**
Code was correct at the time of writing (Phase 12.6). The DROP migration lands at end of v1.2 but the SELECT was never touched during the UI overhaul phases.

**How to avoid:**
Before running the DROP migration, grep the entire codebase for each column name and confirm zero hits remain in any `.select()` call:
```
sidebar_color, background_color, background_shade, chrome_tint_intensity
```
Confirmed affected files from codebase read (must be updated BEFORE DROP):
- `app/api/bookings/route.ts` line 171 (`chrome_tint_intensity`, `sidebar_color`)
- `app/api/cron/send-reminders/route.ts` (ScanRow interface + join select: `background_color`, `chrome_tint_intensity`, `sidebar_color`)
- `app/(shell)/layout.tsx` line 42 (`background_color`, `background_shade`, `sidebar_color`)
- `lib/branding/read-branding.ts` line 77 (`background_color`, `background_shade`, `chrome_tint_intensity`, `sidebar_color`)
- `app/(shell)/app/branding/_lib/load-branding.ts` line 39 (SELECT includes `background_color`, `background_shade`, `sidebar_color`)
- `app/[account]/_lib/load-account-listing.ts` line 23 (`background_color`, `background_shade`)
- `app/[account]/[event-slug]/_lib/load-event-type.ts` line 27 (`background_color`, `background_shade`)
- `app/[account]/[event-slug]/page.tsx` (reads `background_color`, `background_shade` from loaded data)

The DROP migration phase must be the LAST phase and must be gated by a pre-flight grep CI check or a manual confirmation that all call sites have been cleaned.

**Warning signs:**
- Any `500` on the booking route immediately after DROP deployment
- TypeScript compile errors referencing dropped column names (catches most cases if types are regenerated first)
- Pre-flight grep finds residual column name hits

**Phase to address:** DROP Migration Phase (final v1.2 phase) — gate is: codebase-wide grep returns zero hits for all four column names before the migration SQL runs.

---

### CP-02: `lib/email/branding-blocks.ts` Email Priority Chain Still Reads `sidebarColor` as Primary Source

**What goes wrong:**
`renderEmailBrandedHeader()` currently resolves: `sidebarColor ?? brand_primary ?? DEFAULT`. When `sidebar_color` is dropped from the schema and all callers stop passing `sidebarColor`, emails will fall through to `brand_primary` (correct). BUT if any caller still passes `sidebarColor` from a stale accounts row (race between code deploy and DROP), the chained fallback is still present. The real risk is the `EmailBranding` interface keeps optional `sidebarColor?: string | null` — if the v1.2 simplification deletes this field from the interface before all senders are updated, TypeScript will surface the gap. The reverse order (deleting too late) means the deprecated field silently passes through to email rendering.

**Why it happens:**
The `EmailBranding` interface in `lib/email/branding-blocks.ts` is a shared type. Six senders + four route/cron callers pass data into it. Changing the interface and updating all callers must happen atomically in one deploy, not across phases.

**How to avoid:**
1. In the email simplification phase, update `EmailBranding` to remove `sidebarColor` and `chromeTintIntensity` fields, and simplify `renderEmailBrandedHeader` to `brand_primary ?? DEFAULT`.
2. Update all six senders and four callers in the same wave.
3. The `renderEmailLogoHeader` function in `branding-blocks.ts` is already marked `@deprecated` — delete it in the same wave.
4. Do NOT leave the deprecated fields as optional for "backward compat" past v1.2. The compat bridge was for v1.1's one-release window.

**Warning signs:**
- TypeScript errors referencing `sidebarColor` in senders after the interface is updated
- Email header band color not matching the new `brand_primary` source after deploy
- Any remaining reference to `chromeTintIntensity` in non-test files

**Phase to address:** Email Re-Skin Phase (before DROP migration)

---

### CP-03: Stale Vercel Function Instance Reads Dropped Column During Deployment Window

**What goes wrong:**
Vercel's serverless functions are deployed as immutable bundles. When a new deploy completes, old function instances can still be alive for in-flight requests (typically seconds to low minutes; with warm instances up to ~30 minutes on Pro tier). If the DROP migration runs at the exact moment a stale instance is executing a SELECT that includes a dropped column, that request fails at the Postgres layer with `column does not exist`.

**Why it happens:**
Vercel deployment and Supabase migration are two separate operations with no coordinated fence between them. The old code bundle can still be live when the column disappears.

**How to avoid:**
Follow a two-phase deploy protocol for the DROP:
1. **Deploy 1 (code-stop-reading):** Ship the full v1.2 code wave that removes all column reads. Allow 30–60 minutes for old instances to drain. Confirm the deploy is live and healthy on Vercel.
2. **Deploy 2 (DROP migration):** Run the SQL DROP migration ONLY after confirming zero live traffic is going to old instances. For a low-traffic tool like this (Andrew's single-account prod), waiting 30 minutes post-code-deploy before running the migration is a safe practical window.

Do NOT run the DROP migration in the same Vercel deployment pipeline as the code change. Keep them as two separate manual steps with a time gap.

**Warning signs:**
- Any 500 errors on booking/cancel/reschedule routes in the 5 minutes after migration
- Supabase logs showing `column "sidebar_color" of relation "accounts" does not exist`

**Phase to address:** DROP Migration Phase — enforce two-step procedure in the phase checklist.

---

### CP-04: `brandingFromRow` and `getBrandingForAccount` Pass Dropped Columns Into TypeScript Types

**What goes wrong:**
`lib/branding/read-branding.ts` `brandingFromRow()` accepts `background_color`, `background_shade`, `chrome_tint_intensity`, and `sidebar_color` as input parameters. The `Branding` interface in `lib/branding/types.ts` contains `backgroundColor`, `backgroundShade`, `chromeTintIntensity`, and `sidebarColor` fields. When v1.2 simplifies branding to `{ logoUrl, brandPrimary, brandAccent }`, BOTH the function signature AND the interface must be updated. If only one is updated, TypeScript will compile with wrong types, and callers that destructure the return value will see unexpected `undefined` at runtime.

**Why it happens:**
`brandingFromRow` is called from 5+ places (shell layout, booking page, embed, cancel, reschedule). The `Branding` interface is also imported by `chrome-tint.ts` tests. If the interface is shrunk but the old fields are still accessed somewhere, TypeScript may not catch it if the old field access was optional-chained.

**How to avoid:**
1. Update `lib/branding/types.ts` Branding interface first — remove deprecated fields. TypeScript will immediately surface every consumer that accesses them.
2. Fix every consumer before merging.
3. Delete `lib/branding/chrome-tint.ts` entirely in the same wave (it only serves the deprecated tint system). Update the one test file that imports it (`tests/branding-chrome-tint.test.ts`) to delete or skip.
4. Run `tsc --noEmit` to confirm zero type errors before the DROP migration.

**Warning signs:**
- `tsc --noEmit` errors referencing `backgroundColor`, `backgroundShade`, `chromeTintIntensity`, `sidebarColor`
- Tests in `tests/branding-chrome-tint.test.ts` failing after `chrome-tint.ts` is deleted

**Phase to address:** NSI Brand Lock-Down Phase (early v1.2, before re-skin phases)

---

### CP-05: Embed Iframe `--primary` Override Missing — Inherits Wrong Color From Host Page

**What goes wrong:**
When the public-side `BackgroundGlow` and slot picker receive a `--primary` CSS variable override from `brand_primary`, the embed iframe (`/embed/[account]/[event-slug]`) lives in the host site's iframe sandbox. The host document does NOT share CSS variables with the iframe document — CSS vars do not cross iframe boundaries. HOWEVER, if the embed page's Server Component root does not set its own inline `--primary` override, the value used inside the iframe will be whatever the app's Tailwind/shadcn default `--primary` is (currently NSI navy from `@theme` block in `globals.css`, or shadcn's oklch near-black). The slot picker's selected-state indicator and any primary-colored button inside the embed will show the wrong color.

**Why it happens:**
The current `BrandedPage` wrapper (used by the hosted booking page) sets `--brand-primary` (not `--primary`). The v1.2 plan extends `--primary` to public surfaces for the first time (currently not in scope per Phase 12.6 lock). The embed page (`app/embed/[account]/[event-slug]/page.tsx`) uses `EmbedShell`, not `BrandedPage`. When the override is added to the hosted booking page, the embed page must receive the same override independently.

**How to avoid:**
In the public-side `--primary` override phase, explicitly add the inline style override to the embed page's Server Component root (`app/embed/[account]/[event-slug]/page.tsx` or `EmbedShell`), NOT just to `BrandedPage`. They are separate components. The pattern is identical to the owner-side shell layout pattern: `style={{ "--primary": brandPrimary } as React.CSSProperties}`. Do not assume `BrandedPage` changes propagate to `EmbedShell`.

**Warning signs:**
- Embed widget slot picker shows NSI navy (or shadcn black) selected states instead of customer brand color
- Visual inspection of embed on a page with a different host `--primary` shows the wrong color

**Phase to address:** Public Booking Page + Embed Re-Skin Phase

---

### CP-06: `BackgroundGlow` Ancestor `overflow-hidden` Crops Fixed Blobs — Invisible on Some Pages

**What goes wrong:**
`BackgroundGlow` is `fixed inset-0 z-0`. A `fixed` element is positioned relative to the nearest ancestor that establishes a containing block (an ancestor with `transform`, `perspective`, `filter`, `will-change`, or `contain` CSS properties — NOT just `overflow-hidden`). However, if any ancestor has `overflow-hidden` AND a `transform` or `filter` property, the fixed positioning breaks and `BackgroundGlow` will be clipped or invisible. The current shell layout's `SidebarInset` has `className="relative overflow-hidden bg-background"`. If `SidebarInset` ever gains a `transform` property (e.g., a slide-in animation), BackgroundGlow will be trapped inside it rather than covering the full viewport.

More practically: if `BackgroundGlow` is placed inside the `SidebarInset` rather than at the body/layout level, `overflow-hidden` on `SidebarInset` will crop the blobs to the `SidebarInset` bounds (which excludes the sidebar column). The blob will not appear behind the sidebar.

**How to avoid:**
Place `BackgroundGlow` at the root layout level — directly in `app/(shell)/layout.tsx` as a sibling of `<SidebarProvider>`, not nested inside `SidebarInset`. Verify it appears correctly with the sidebar visible (blobs should span behind the sidebar). Never place it inside any container with `overflow-hidden` plus transforms.

Also confirm: the `BackgroundGlow` component must be `pointer-events-none`. The reference implementation already has this. Do NOT remove `pointer-events-none` during the copy-paste step.

**Warning signs:**
- Blobs appear clipped to the main content area (not behind the sidebar)
- Blobs invisible on pages where an ancestor has `transform`
- Clicks on the page feel "dead" (sign that `pointer-events-none` was accidentally removed)

**Phase to address:** BackgroundGlow Integration Phase

---

### CP-07: Slot Picker `day-has-slots` Dot Uses `var(--color-accent)` — Not `--primary`

**What goes wrong:**
`globals.css` line 191 sets the `.day-has-slots::after` dot to `background: var(--color-accent)`. The `@theme` block sets `--color-accent: #F97316` (NSI orange). When v1.2 gains a customer `--primary` override on the public surface, the calendar dot will still show NSI orange, not the customer's color. This inconsistency is probably acceptable on the public side (the dot is a structural affordance, not a brand element). But the more dangerous direction is the inverse: if a developer assumes the dot "just uses the account color" and wires it to `--primary` during the re-skin, then a yellow or very light `brand_primary` will make the dot invisible against a white calendar cell background.

**Why it happens:**
The dot styling predates the per-account color system. The `var(--color-accent)` reference is in the global CSS, not a component, so no TypeScript type check will catch a change here.

**How to avoid:**
Do NOT change the `.day-has-slots` dot color during the public re-skin unless explicitly planned. If a change is desired, use a fixed color (e.g., `#3B82F6` NSI blue) with sufficient contrast against white cells, NOT the dynamic `--primary` variable. Document the decision in the phase checklist.

**Warning signs:**
- Calendar dots invisible on the public booking page for light `brand_primary` accounts (yellow, beige, etc.)

**Phase to address:** Public Booking Page Re-Skin Phase

---

## Moderate Pitfalls

These degrade quality or cause regressions but are recoverable without a schema rollback.

---

### MP-01: Owner Shell `--primary` Override Removal Leaves Stale `resolveChromeColors` and `GradientBackdrop` Call Sites

**What goes wrong:**
`app/(shell)/layout.tsx` currently calls `getBrandingForAccount()`, then `resolveChromeColors()`, then passes `chrome.primaryColor`, `chrome.sidebarColor`, `chrome.sidebarTextColor`, and `chrome.pageColor` down to child components. It also renders `<GradientBackdrop>`. When v1.2 strips the overrides, all of these calls must be removed. If any are left behind (partial removal), the build may succeed but the removed columns will still be referenced by `getBrandingForAccount` (CP-04 above) or the layout will still pass stale props to `AppSidebar`.

**How to avoid:**
In the NSI brand lock-down phase, perform a complete replacement of `app/(shell)/layout.tsx`:
- Remove the `getBrandingForAccount` call entirely from the shell layout (the shell no longer needs branding — it's NSI-locked)
- Remove the `resolveChromeColors` call
- Remove the `GradientBackdrop` component (superseded by `BackgroundGlow`)
- Remove the outer `<div style={{ "--primary": ... }}>` wrapper
- Update `AppSidebar` props to remove `sidebarColor` and `sidebarTextColor` (these props are deleted from the component interface)
- The `accounts` SELECT in the shell layout should be stripped to only the columns still needed (currently `id, slug, brand_primary, background_color, background_shade, sidebar_color` — all of which are deprecated except `id` and `slug` for redirect logic)

After stripping, the shell layout SELECT should only need `id, slug` (plus `deleted_at` for soft-delete check) and `owner_user_id`.

**Warning signs:**
- Build succeeds but Vercel preview shows incorrect button colors (not NSI blue-500)
- `AppSidebar` receives `sidebarColor` prop type errors after interface change

**Phase to address:** NSI Brand Lock-Down Phase

---

### MP-02: `AppSidebar` `--sidebar-foreground` Override Removal Breaks Dark Sidebar Text

**What goes wrong:**
`AppSidebar` currently sets `--sidebar-foreground` via inline style when `sidebarTextColor` is non-null. When an account had a dark `sidebarColor` (navy), the WCAG check returned `#ffffff` and the nav text was white. After v1.2 removes the override, `--sidebar-foreground` reverts to the `@theme` value `--color-sidebar-foreground: #0F172A` (near-black from `globals.css`). For NSI's locked blue sidebar (if the visual re-skin applies a custom sidebar background color via CSS class), near-black text on a blue sidebar may be acceptable — but needs a visual confirmation sweep on the Vercel preview.

The risk is if the v1.2 sidebar re-skin applies a CSS class with a blue background but does not also set the foreground token, resulting in near-black text on a medium-blue sidebar (low contrast for gray text on blue).

**How to avoid:**
After removing the dynamic override, do a manual visual check of the sidebar on the Vercel preview: confirm nav item labels, icons, hover states, and the active indicator are all legible. If the new v1.2 sidebar is blue, set a hardcoded `--sidebar-foreground: #ffffff` in the `@theme` block (or as a CSS class on `AppSidebar`), not via inline style.

**Warning signs:**
- Nav text nearly invisible against sidebar background color in Vercel preview
- Active pill indicator blends into sidebar

**Phase to address:** Sidebar Visual Re-Skin Phase

---

### MP-03: `MiniPreviewCard` Must Not Reference Dropped Columns During Rebuild

**What goes wrong:**
`app/(shell)/app/branding/_components/mini-preview-card.tsx` is currently a 3-color preview (sidebar + page + primary). The v1.2 plan rebuilds it as a faux public-booking-page preview (gray-50 + blob in `brandPrimary` + white card + accent on slot picker). If the rebuild still accepts or renders `sidebarColor` or `backgroundColor` props from the parent `branding-editor.tsx`, those props will need to be removed from both components simultaneously. If only `MiniPreviewCard` is updated but `BrandingEditor` still passes the old props, TypeScript will catch it — unless the props are passed via `{...rest}` spread.

**How to avoid:**
Update `MiniPreviewCard` and `BrandingEditor` in the same commit wave. Ensure `BrandingEditor`'s state interface (`BrandingState`) is also shrunk in the same commit to match v1.2's `{ logoUrl, brandPrimary, brandAccent }`.

**Warning signs:**
- TypeScript errors on `mini-preview-card.tsx` prop types after interface change
- Branding editor preview showing wrong colors or empty state after deploy

**Phase to address:** Branding Editor Simplification Phase

---

### MP-04: Runtime Hex via Dynamic Tailwind Class Name (`bg-[${color}]`) — JIT Pitfall Reapplied

**What goes wrong:**
This is the v1.1 Phase 7 locked pitfall, still fully applicable for all new components in v1.2. `BackgroundGlow` (and any new component that accepts a customer `brand_primary` color) must apply dynamic hex colors via inline `style` props, NOT via Tailwind JIT class-name tokens like `bg-[${brandPrimary}]`. JIT only generates classes present in the source files at build time. A runtime hex value produces a class name that was never generated, so the color is invisible in production but may appear to work in dev (which has a JIT watcher).

Specifically at risk in v1.2:
- `BackgroundGlow` vendored copy needs a `color` prop for the public surface — must use `style={{ background: color }}`, not `className={bg-[${color}]}`
- Slot picker selected-state (if styled dynamically)
- `MiniPreviewCard` blob preview

**How to avoid:**
Every component that renders a runtime hex (not a Tailwind design token) must use `style={{ ... }}` for that value. This applies to ALL new v1.2 components consuming `brand_primary`. Lock this in the v1.2 plan preamble and surface it in every phase plan that introduces new colored components.

**Warning signs:**
- Colors work on local dev (`next dev`) but are invisible on Vercel preview (production build)
- No class matching the dynamic hex in the compiled CSS

**Phase to address:** Every phase that introduces new components with dynamic colors

---

### MP-05: `saveBrandingAction` Signature Shrink — Old Form Fields Still Submitted

**What goes wrong:**
`app/(shell)/app/branding/_lib/actions.ts` `saveBrandingAction` currently accepts `{ backgroundColor, backgroundShade, sidebarColor }`. The v1.2 simplified signature will be `{ logoUrl?, brandPrimary, brandAccent }` (or just the color fields). If `BrandingEditor` is rebuilt but the old `saveBrandingAction` signature is not updated, TypeScript will catch the mismatch. The reverse risk is if the action is updated first and deployed before the editor — the editor submits the old shape and the action silently ignores unrecognized fields (Zod `strip` mode). Harmless but confusing.

The real risk: if `background_shade` is an ENUM column in Postgres (it is — `background_shade background_shade NOT NULL DEFAULT 'subtle'`), the DROP migration must also DROP the ENUM type. Failing to drop the type leaves a dangling Postgres type that may conflict with a future migration trying to recreate it.

**How to avoid:**
The DROP migration must explicitly drop both the column AND the `background_shade` ENUM type. Follow the same defensive `DO $$ BEGIN ... END $$;` pattern from Phase 11 (check existence before DROP). After dropping, confirm via `psql` or Supabase console that `\dT` no longer shows `background_shade`.

**Warning signs:**
- Migration re-run in a fresh Supabase environment throws `type background_shade already exists`
- Supabase Studio shows column `background_shade` still present after migration

**Phase to address:** DROP Migration Phase

---

### MP-06: `chromeTintToCss` Compat Export Still Imported by Tests — Blocks DROP

**What goes wrong:**
`lib/branding/chrome-tint.ts` exports `chromeTintToCss` and `resolveChromeColors`. `tests/branding-chrome-tint.test.ts` imports and exercises these functions. If v1.2 deletes `chrome-tint.ts` without deleting the test file, the test suite fails to compile and `vitest` will error. Since the test CI gate runs before deployment, this blocks the ship. Per `STATE.md`, `accounts.chrome_tint_intensity` column is "no longer read by production code; `chromeTintToCss` compat export retained for Phase 12.5 tests." v1.2 closes this loop.

**How to avoid:**
1. Delete `lib/branding/chrome-tint.ts` in the brand lock-down phase.
2. Delete `tests/branding-chrome-tint.test.ts` in the same commit (it tests a deleted function).
3. Confirm `vitest` pass count drops by exactly the number of tests in that file (expected; not a regression).
4. Confirm `tests/branding-schema.test.ts` and `tests/email-branded-header.test.ts` do not import from `chrome-tint.ts` — from the grep output they do not, but verify.

**Warning signs:**
- `vitest` compilation error: `Cannot find module '@/lib/branding/chrome-tint'`
- CI fails on the branding-chrome-tint test file after deleting the source

**Phase to address:** NSI Brand Lock-Down Phase (same wave as types.ts simplification)

---

### MP-07: `tracking-tight` on `<html>` Conflicts With Lead-Scoring Arbitrary Values

**What goes wrong:**
`app/layout.tsx` applies `tracking-tight` via `className="font-sans tracking-tight"` on `<html>`. Tailwind's `tracking-tight` is `-0.025em`. The lead-scoring reference `globals.css` uses `letter-spacing: -0.017em` on `body` and `letter-spacing: -0.037em` on `h1, h2, h3`. If v1.2 copies these exact values into the calendar-app `globals.css` as `body { letter-spacing: -0.017em; }` and `h1, h2, h3 { letter-spacing: -0.037em; }`, but the `<html>` class still has `tracking-tight` (`-0.025em`), the body rule will inherit from the more-specific body selector and win (CSS specificity). BUT: any component not under `body`/`h1`/`h2`/`h3` selectors will get the `-0.025em` from `<html>`.

The practical result: heading elements will get the correct `-0.037em`, body text will get the correct `-0.017em`, but form labels, nav items, and other inline elements that aren't explicitly targeted will get `-0.025em` — slightly different from the reference. This is unlikely to be visually noticeable, but if the wordmark uses `tracking-[-0.04em]` and relies on exact spacing, a global `tracking-tight` on `<html>` may push it slightly off.

**How to avoid:**
In the globals.css update phase: replace `tracking-tight` on `<html>` with explicit `letter-spacing: 0` (neutral), then control tracking via the `body` and `h1-h3` arbitrary-value rules matching the lead-scoring reference. Alternatively, keep `tracking-tight` on `<html>` and override with arbitrary values only where needed. Document which approach is chosen and lock it.

**Warning signs:**
- Wordmark letter spacing looks slightly different from the reference lead-scoring site
- Body text is slightly tighter or looser than intended

**Phase to address:** Globals CSS / BackgroundGlow Integration Phase

---

### MP-08: Inter Font Missing Weight 800 (`font-extrabold`) for Wordmark

**What goes wrong:**
`app/layout.tsx` loads Inter as `Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })` with NO `weight` parameter. When no weight is specified, Next.js loads a variable font file if available, which covers all weights. However, if the build falls back to a static subset for any reason, weight 800 may not be available and `font-extrabold` renders with browser font synthesis (looks noticeably different — blurrier, slightly thicker). The wordmark spec from the reference is `font-extrabold tracking-[-0.04em]` on `<html>`.

**How to avoid:**
Verify the Inter font load works correctly for weight 800 by inspecting the Vercel preview wordmark. If visual inspection shows a blurry or imprecise weight, explicitly add `weight: ["400", "500", "600", "700", "800"]` to the Inter constructor in `app/layout.tsx`. This guarantees the static subset includes 800.

**Warning signs:**
- Wordmark "NorthStar" looks slightly blurry or slightly different weight compared to the lead-scoring reference
- Chrome DevTools Network tab shows no `inter-latin-800` font file fetched

**Phase to address:** Glass Header Pill Phase

---

### MP-09: `GradientBackdrop` and `NSIGradientBackdrop` Not Deleted — Dead Code Lingers

**What goes wrong:**
`app/_components/gradient-backdrop.tsx` is currently used by `BrandedPage` and `app/(shell)/layout.tsx`. When v1.2 replaces these with `BackgroundGlow`, both the `GradientBackdrop` component and the Phase 12-01 `NSIGradientBackdrop` (if it exists as a separate file) become dead code. If not deleted, they will still be imported by the old `BrandedPage` — causing confusion when `BrandedPage` is rebuilt as `PublicShell` or similar.

Additionally, `globals.css` contains the `day-blocked`, `day-custom`, and `day-has-slots` dot-marker CSS. These are load-bearing (the availability calendar and public slot picker use them). They must NOT be deleted during the globals.css cleanup.

**How to avoid:**
When rebuilding `BrandedPage` into `PublicShell` (or however the public surface shell is restructured), explicitly delete the `GradientBackdrop` import. Then delete the file. Run `tsc --noEmit` to confirm no remaining importers.

**Warning signs:**
- Dead import of `gradient-backdrop.tsx` in `BrandedPage` after rebuild
- `tsc --noEmit` shows zero errors (could mean dead import was `import type` and tree-shook silently)

**Phase to address:** Public Booking Page Re-Skin Phase

---

### MP-10: Second Blob Gradient Becomes Muddy With Dark `brand_primary`

**What goes wrong:**
The reference `BackgroundGlow` second blob uses `linear-gradient(to top right, #3B82F6, #111827)` — blue-to-near-black. When the public-side `BackgroundGlow` substitutes `brand_primary` for `#3B82F6`, a customer with a dark `brand_primary` (navy `#0A2540`, dark green `#064E3B`) will produce a near-black-to-near-black gradient that is invisible against the gray-50 background. A customer with yellow `brand_primary` (`#F59E0B`) will produce a yellow-to-dark-gray blob that looks muddy.

**How to avoid:**
For the public-side `BackgroundGlow` variant, use `brand_primary → transparent` (NOT `brand_primary → #111827`) for the second blob. The `→ transparent` approach degrades gracefully across all colors: dark colors produce a visible subtle fade, light colors produce a visible subtle glow. The `→ #111827` dark stop is a design choice that works when the source color is a medium-value blue — it breaks with dark or light source colors.

Recommended implementation:
```
// Blob 1: brand_primary → transparent (opacity 0.4)
background: `linear-gradient(to top right, ${brandPrimary}, transparent)`

// Blob 2: brand_primary → transparent (opacity 0.35)
background: `linear-gradient(to top right, ${brandPrimary}, transparent)`
```

**Warning signs:**
- Dark `brand_primary` accounts (navy, dark green) show near-invisible blobs
- Light `brand_primary` accounts (yellow, beige) show muddy brown blobs

**Phase to address:** BackgroundGlow Integration Phase (public-side color prop)

---

## Minor Pitfalls

These cause annoyance or technical debt but are straightforward to fix.

---

### MN-01: Andrew's Live-Deploy QA Pattern — Visual Changes Need Vercel Eyeball Before Next Phase

**What goes wrong:**
Andrew's established workflow: push to GitHub → Vercel → live visual confirmation before continuing. Visual phases (BackgroundGlow, header pill, sidebar re-skin) produce changes that look correct in `next dev` but may differ slightly on the production build due to font loading, CSS purging, or PostCSS transforms. Without a Vercel eyeball checkpoint between phases, visual regressions compound and the final QA becomes a forensics exercise.

**How to avoid:**
Each v1.2 phase that touches CSS or component visuals must end with an explicit checkpoint: Andrew opens the Vercel preview URL and confirms the affected surfaces before the next phase begins. This is the established pattern (Phase 12.6 was confirmed live before sign-off). The phase checklist must include a "DEPLOY + EYEBALL" step as a required item, not optional.

**Warning signs:**
- Multiple phases merged before any Vercel preview confirmation
- Phase plan does not include a deploy checkpoint step

**Phase to address:** Every visual phase — not optional

---

### MN-02: `NorthStar` Wordmark Hard-Coded Across Multiple Components

**What goes wrong:**
If the wordmark string "North" + "Star" appears in multiple places (header pill, possibly onboarding, auth pages), a future copy change (e.g., "NSI Booking" branding) requires finding and updating all instances. The lead-scoring pattern hard-codes the wordmark in a single `Header.tsx` component, which is acceptable for a single-surface reference. In calendar-app, the wordmark will appear on the owner-side header AND potentially on auth pages.

**How to avoid:**
Define a single constant in `lib/constants.ts` (or a new `lib/brand.ts`):
```typescript
export const OWNER_WORDMARK = {
  partA: "North",
  partB: "Star",
} as const;
```
All components import from this constant. A future rename is a one-line change.

**Warning signs:**
- The string "NorthStar" or "North" + "Star" appears in more than one component file via text search

**Phase to address:** Glass Header Pill Phase (when wordmark is first introduced)

---

### MN-03: `RLS Cross-Tenant Matrix` Tests Select `"id, slug"` From Accounts — Safe, But Verify After Schema Change

**What goes wrong:**
`tests/rls-cross-tenant-matrix.test.ts` uses `.select("id, slug")` from the accounts table in all RLS cases. Neither `id` nor `slug` are among the columns being dropped. These tests are safe across the v1.2 DROP migration. However, the `email-6-row-matrix.test.ts` and `email-branded-header.test.ts` test files import from `branding-blocks.ts` and may test against `sidebarColor` and `chromeTintIntensity` fields. If those test fixtures reference the deprecated interface fields, they will fail after the `EmailBranding` interface is simplified.

**How to avoid:**
Before merging the EmailBranding simplification, run `vitest --reporter verbose` and confirm test counts. After the change, confirm no test regressions beyond the intentionally deleted `branding-chrome-tint.test.ts` cases. Update `email-branded-header.test.ts` fixtures to remove `sidebarColor` and `chromeTintIntensity` fixture fields.

**Warning signs:**
- `email-branded-header.test.ts` or `email-6-row-matrix.test.ts` TypeScript errors after interface change

**Phase to address:** Email Re-Skin Phase

---

### MN-04: `/clear` Between Phase Boundaries — Plan Must Be Self-Contained

**What goes wrong:**
Andrew's session management practice is to `/clear` between major phases. If a phase plan relies on information only in the conversation context (not written to STATE.md or the phase checklist), that context is lost. A sub-agent or resumed session that reads only STATE.md + the phase plan will miss the lock.

**How to avoid:**
Every v1.2 phase plan must restate the v1.1 locked decisions that remain load-bearing:
1. JIT pitfall: runtime hex via inline style only, never `bg-[${color}]`
2. Email strategy: solid-color-only, no CSS gradients in email HTML
3. CSP: lives only in `proxy.ts`, never `next.config.ts`
4. Two-stage owner auth: RLS pre-check before service-role mutation
5. `background_shade` ENUM type must be dropped alongside the column
6. DROP migration = two-step deploy (code-stop-reading, then wait, then DROP)

These six locks should appear in every phase plan preamble, not just in PITFALLS.md.

**Warning signs:**
- A sub-agent adds `bg-[${color}]` Tailwind syntax
- A sub-agent adds CSS gradient to email HTML
- A phase plan does not mention the JIT lock

**Phase to address:** All phases — enforce via plan preamble template

---

### MN-05: NSI Mark Image in Emails — Remote URL Blocked by Image Policies

**What goes wrong:**
`lib/email/branding-blocks.ts` `renderEmailFooter()` renders the NSI mark as `<img src="${NSI_MARK_URL}">`. The `NSI_MARK_URL` is `${NEXT_PUBLIC_APP_URL}/nsi-mark.png`. Gmail, Outlook, and Yahoo block remote images by default until the user clicks "Display images." The NSI mark becomes an invisible broken icon in initial email view for a significant percentage of recipients.

The v1.1 lock for email images is: the footer text `"Powered by North Star Integrations"` already renders as text (the `<strong>` tag), and the mark is additive. The current implementation already handles the `null` case correctly (no img tag when URL is null in test environments).

For v1.2, if the decision is to keep the mark image, it should be a small (16x16 or 24x24) hosted PNG that fails gracefully when blocked — which is the current implementation. The text fallback "Powered by North Star Integrations" remains legible.

**How to avoid:**
Do NOT switch to base64-encoded inline SVG for the NSI mark in email — Outlook desktop strips inline SVG. Do NOT use CSS gradients or complex HTML for the footer mark. The existing text + small `<img>` pattern is the correct approach. The risk is minimal since the text label renders regardless of image blocking. Document this decision explicitly so a sub-agent doesn't "improve" it with SVG.

**Warning signs:**
- Any change to `renderEmailFooter()` that replaces `<strong>North Star Integrations</strong>` text with an image-only approach

**Phase to address:** Email Re-Skin Phase (confirm footer unchanged or only additive changes)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `renderEmailLogoHeader` @deprecated function in `branding-blocks.ts` past v1.2 | No test churn | Dead code grows; future devs confuse it for the active API | Never — delete in the email re-skin phase |
| Leave `GradientBackdrop` file after `BackgroundGlow` replaces it | Faster phase | Dead import in `BrandedPage`; future devs re-use old component | Never — delete when replaced |
| Run DROP migration same deploy as code change | One deploy | Stale function instances cause 500s during transition window | Never — always two-step |
| Skip `tsc --noEmit` before DROP migration | Faster ship | Runtime errors if a stale column reference was missed | Never — run it |
| Hard-code wordmark in every component | Quick | Every brand rename requires N-file edit | Only OK if single component; use constant for 2+ |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CP-01: Deprecated columns in SELECT clauses | Before DROP migration — codebase grep gate | `grep -r "sidebar_color\|background_color\|background_shade\|chrome_tint_intensity"` returns zero hits in non-migration, non-test-fixture files |
| CP-02: EmailBranding interface still references `sidebarColor` | Email Re-Skin Phase | `tsc --noEmit` passes; no `sidebarColor` in `EmailBranding` interface |
| CP-03: Stale Vercel function reads dropped column | DROP Migration Phase — 30-60 min gap after code deploy | No 500s on booking route for 5 minutes post-migration |
| CP-04: `Branding` interface has dropped fields | NSI Brand Lock-Down Phase | `tsc --noEmit` passes after `types.ts` update |
| CP-05: Embed iframe missing `--primary` override | Public Re-Skin Phase | Visual inspection of embed with a non-blue `brand_primary` account (emerald/magenta test accounts on prod) |
| CP-06: `BackgroundGlow` inside `overflow-hidden` container | BackgroundGlow Phase | Blobs visible behind sidebar column in Vercel preview |
| CP-07: Slot picker dot wired to wrong variable | Public Re-Skin Phase | Visual check: slot picker dot visible with extreme `brand_primary` colors |
| MP-01: `resolveChromeColors` / `GradientBackdrop` call sites left in shell layout | NSI Brand Lock-Down Phase | Shell layout imports `getBrandingForAccount` and `resolveChromeColors` removed from file |
| MP-02: `--sidebar-foreground` removal breaks text contrast | Sidebar Re-Skin Phase | Manual visual check on Vercel preview — nav labels legible |
| MP-03: `MiniPreviewCard` / `BrandingEditor` mismatch | Branding Editor Phase | TypeScript clean; preview renders faux booking page blob pattern |
| MP-04: JIT dynamic class names (reapplied v1.1 pitfall) | Every new component phase | Production deploy visual check; no color "works in dev but not prod" |
| MP-05: `background_shade` ENUM not dropped | DROP Migration Phase | `\dT` in Supabase shows `background_shade` type removed |
| MP-06: `chrome-tint.ts` compat export blocks deletion | NSI Brand Lock-Down Phase | `tests/branding-chrome-tint.test.ts` deleted; `vitest` count drops by correct amount |
| MP-07: `tracking-tight` conflicts with arbitrary values | Globals CSS Phase | Wordmark spacing matches lead-scoring reference on Vercel preview |
| MP-08: Inter weight 800 missing | Glass Header Pill Phase | Wordmark weight visually matches lead-scoring reference |
| MP-09: Dead `GradientBackdrop` component lingers | Public Re-Skin Phase | `tsc --noEmit` + grep confirm no imports |
| MP-10: Second blob muddy with dark `brand_primary` | BackgroundGlow Phase | Visual check with navy and yellow `brand_primary` test accounts |
| MN-01: Andrew's live-deploy QA | Every visual phase | Each phase checklist has explicit DEPLOY + EYEBALL step |
| MN-02: Wordmark hard-coded N times | Glass Header Pill Phase | Single `OWNER_WORDMARK` constant source; text search confirms |
| MN-03: Email test fixtures reference deprecated interface | Email Re-Skin Phase | `vitest` passes with no unexpected failures |
| MN-04: Session continuity — locks not in plan preamble | All phases | Every phase plan document has 6 locked decisions in preamble |
| MN-05: NSI mark as image-only in email footer | Email Re-Skin Phase | Text label `"Powered by North Star Integrations"` renders regardless of image blocking |

---

## "Looks Done But Isn't" Checklist

- [ ] **Brand lock-down:** `resolveChromeColors` import removed from `app/(shell)/layout.tsx` — verify with grep
- [ ] **Brand lock-down:** `AppSidebar` `sidebarColor` and `sidebarTextColor` props removed from interface AND all call sites
- [ ] **Brand lock-down:** `chrome-tint.ts` AND `tests/branding-chrome-tint.test.ts` both deleted
- [ ] **Email simplification:** `EmailBranding` interface no longer has `sidebarColor` or `chromeTintIntensity` fields
- [ ] **Email simplification:** `renderEmailLogoHeader` @deprecated function deleted from `branding-blocks.ts`
- [ ] **Public re-skin:** Embed page root sets `--primary` inline style override independently from `BrandedPage`
- [ ] **BackgroundGlow:** Component is NOT inside any `SidebarInset` or other `overflow-hidden` ancestor
- [ ] **BackgroundGlow:** `pointer-events-none` is present on the root div
- [ ] **DROP migration:** Pre-flight grep returns zero hits for all four column names in runtime code
- [ ] **DROP migration:** Code deploy ran at least 30 minutes before migration SQL ran
- [ ] **DROP migration:** `background_shade` ENUM type dropped alongside the column
- [ ] **DROP migration:** TypeScript types regenerated (if Supabase type generation is committed to repo)
- [ ] **DROP migration:** `vitest` passes after migration with expected test-count delta only

---

## Sources

- `app/(shell)/layout.tsx` — live shell layout with deprecated column reads (verified 2026-04-30)
- `components/app-sidebar.tsx` — live sidebar with `sidebarColor`/`sidebarTextColor` props (verified 2026-04-30)
- `lib/branding/chrome-tint.ts` — `resolveChromeColors` + `chromeTintToCss` compat export (verified 2026-04-30)
- `lib/branding/types.ts` — `Branding` interface with deprecated fields (verified 2026-04-30)
- `lib/branding/read-branding.ts` — `brandingFromRow` SELECT including all four deprecated columns (verified 2026-04-30)
- `lib/email/branding-blocks.ts` — `EmailBranding` interface + `sidebarColor` priority chain (verified 2026-04-30)
- `app/api/bookings/route.ts` line 171 — SELECT includes `chrome_tint_intensity`, `sidebar_color` (verified 2026-04-30)
- `app/api/cron/send-reminders/route.ts` — ScanRow interface includes `background_color`, `chrome_tint_intensity`, `sidebar_color` (verified 2026-04-30)
- `app/[account]/_lib/load-account-listing.ts` — SELECT includes `background_color`, `background_shade` (verified 2026-04-30)
- `app/[account]/[event-slug]/_lib/load-event-type.ts` — SELECT includes `background_color`, `background_shade` (verified 2026-04-30)
- `app/globals.css` — `@theme` block, `--sidebar-width-mobile`, `day-has-slots` dot using `var(--color-accent)` (verified 2026-04-30)
- `app/layout.tsx` — Inter font load without explicit weight, `tracking-tight` on `<html>` (verified 2026-04-30)
- `lead-scoring-with-tools/website-analysis-tools/app/components/BackgroundGlow.tsx` — reference implementation with `pointer-events-none fixed inset-0 z-0` (verified 2026-04-30)
- `supabase/migrations/20260429120000_phase12_branding_columns.sql` — `background_shade background_shade ENUM` type declaration (verified 2026-04-30)
- `supabase/migrations/20260428130003_phase11_drop_old_double_book_index.sql` — defensive `DO $$ BEGIN...END $$` DROP pattern (verified 2026-04-30)
- `.planning/STATE.md` — v1.2 Visual Locks, accumulated context (verified 2026-04-30)

---
*Pitfalls research for: NSI Booking Tool v1.2 — NSI Brand Lock-Down + UI Overhaul*
*Researched: 2026-04-30*
