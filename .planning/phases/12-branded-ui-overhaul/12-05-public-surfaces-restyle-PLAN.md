---
phase: 12-branded-ui-overhaul
plan: 05
type: execute
wave: 2
depends_on: ["12-01"]
files_modified:
  - app/[account]/page.tsx
  - app/[account]/[event-slug]/page.tsx
  - app/[account]/[event-slug]/_components/booking-shell.tsx
  - app/[account]/[event-slug]/_components/slot-picker.tsx
  - app/embed/[account]/[event-slug]/_components/embed-shell.tsx
  - app/(shell)/app/event-types/_components/embed-code-dialog.tsx
  - app/[account]/_components/listing-hero.tsx
autonomous: true

must_haves:
  truths:
    - "/[account] index page renders a Cruip-styled landing card: GradientBackdrop hero with logo + display name + brand color + active event types"
    - "/[account]/[event-slug] booking page uses py-12 md:py-20 section rhythm with max-w-3xl slot picker"
    - "/[account]/[event-slug] hero renders a strong gradient (background_shade='bold' visual density) and footer accents are subtle"
    - "/[account]/[event-slug] slot-picker section renders on a clean white/gray-50 background (no gradient distraction in the picker itself)"
    - "/embed/[account]/[event-slug] adopts the full restyle WITH gradient (CONTEXT.md lock: brand carries inside iframe)"
    - "EmbedCodeDialog widens to sm:max-w-2xl so the snippet does not overflow at 320 / 768 / 1024 viewports"
    - "All public surfaces consume account.background_color + account.background_shade from BrandedPage (additive props from Plan 12-01)"
  artifacts:
    - path: "app/[account]/page.tsx"
      provides: "Restyled /[account] index with hero card + event-type grid"
      contains: "GradientBackdrop|background_color|background_shade"
    - path: "app/[account]/_components/listing-hero.tsx"
      provides: "Reusable hero card for /[account] index page"
      exports: ["ListingHero"]
    - path: "app/[account]/[event-slug]/page.tsx"
      provides: "Restyled booking page passing background_color/background_shade to BrandedPage"
      contains: "backgroundColor|backgroundShade"
    - path: "app/[account]/[event-slug]/_components/booking-shell.tsx"
      provides: "Cruip section rhythm py-12 md:py-20, max-w-3xl slot picker container"
      contains: "py-12.*md:py-20|max-w-3xl"
    - path: "app/embed/[account]/[event-slug]/_components/embed-shell.tsx"
      provides: "Embed restyled with gradient (no header pill, no nav)"
      contains: "GradientBackdrop"
    - path: "app/(shell)/app/event-types/_components/embed-code-dialog.tsx"
      provides: "Dialog widened to sm:max-w-2xl"
      contains: "sm:max-w-2xl"
  key_links:
    - from: "app/[account]/[event-slug]/page.tsx"
      to: "app/_components/branded-page.tsx"
      via: "Pass backgroundColor + backgroundShade props"
      pattern: "backgroundColor=\\{|backgroundShade=\\{"
    - from: "app/embed/[account]/[event-slug]/_components/embed-shell.tsx"
      to: "app/_components/gradient-backdrop.tsx"
      via: "GradientBackdrop wrapped in overflow-hidden parent (Pitfall 10 fix)"
      pattern: "GradientBackdrop"
    - from: "app/[account]/page.tsx"
      to: "app/[account]/_lib/load-account-listing.ts"
      via: "loadAccountListing returns background_color/background_shade for ListingHero"
      pattern: "background_color"
---

<objective>
Restyle all public-facing surfaces (`/[account]` index landing card, `/[account]/[event-slug]` booking page, `/embed/[account]/[event-slug]` widget) to the Cruip "Simple Light" aesthetic by consuming the new `background_color` + `background_shade` tokens from Plan 12-01. Apply Cruip section rhythm (`py-12 md:py-20`) + `max-w-3xl` slot picker container. Widen the `EmbedCodeDialog` to `sm:max-w-2xl` so the snippet doesn't overflow at narrow viewports.

Purpose: This delivers Phase success criteria #3 (gradients update across public surfaces from owner's branding choice) and #4 (Cruip restyle of public booking + embed + /[account] + embed snippet dialog widening). Wave 3 plan, runs in parallel with Plan 12-04 (Home tab) — no shared file conflicts.

Output:
- Restyled `/[account]` page with hero card
- New `ListingHero` component
- Restyled `/[account]/[event-slug]` page + booking-shell
- Restyled `/embed/[account]/[event-slug]` (gradient included; chromeless)
- Widened `EmbedCodeDialog` to `sm:max-w-2xl`
- UI-09, UI-10, UI-11, UI-13, UI-04 (public portion) satisfied
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
@.planning/phases/12-branded-ui-overhaul/12-01-SUMMARY.md

# Existing files to restyle (preserve all booking logic — JSX-only)
@app/[account]/page.tsx
@app/[account]/[event-slug]/page.tsx
@app/[account]/[event-slug]/_components/booking-shell.tsx
@app/[account]/[event-slug]/_components/slot-picker.tsx
@app/[account]/[event-slug]/_components/booking-form.tsx
@app/[account]/_lib/load-account-listing.ts
@app/embed/[account]/[event-slug]/_components/embed-shell.tsx
@app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx
@app/(shell)/app/event-types/_components/embed-code-dialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: /[account] index landing card + ListingHero + load-account-listing extension</name>
  <files>
    app/[account]/page.tsx
    app/[account]/_lib/load-account-listing.ts
    app/[account]/_components/listing-hero.tsx
  </files>
  <action>
    **load-account-listing.ts** — read existing file. Extend the SELECT to include `background_color, background_shade` so the page + ListingHero can consume them. Update the returned shape's TypeScript type accordingly (e.g. `data.account.background_color`, `data.account.background_shade`).

    **listing-hero.tsx** (NEW client-or-server component — server-component-only since no interactivity):

    ```tsx
    import Image from "next/image";
    import { GradientBackdrop } from "@/app/_components/gradient-backdrop";
    import type { BackgroundShade } from "@/lib/branding/types";

    interface ListingHeroProps {
      accountName: string;
      logoUrl: string | null;
      brandPrimary: string;
      backgroundColor: string | null;
      backgroundShade: BackgroundShade;
    }

    export function ListingHero({ accountName, logoUrl, brandPrimary, backgroundColor, backgroundShade }: ListingHeroProps) {
      return (
        <section className="relative overflow-hidden rounded-2xl border bg-white px-6 py-12 text-center md:py-20">
          <GradientBackdrop color={backgroundColor ?? brandPrimary} shade={backgroundShade} />
          <div className="relative z-10 flex flex-col items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt={accountName} className="h-16 w-auto" />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white"
                style={{ backgroundColor: brandPrimary }}
              >
                {accountName.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">{accountName}</h1>
            <p className="max-w-md text-sm text-gray-600 md:text-base">Pick a time below to book a meeting.</p>
          </div>
        </section>
      );
    }
    ```

    Why color fallback chain: ListingHero receives both `brandPrimary` and `backgroundColor`. When `backgroundColor` is null (owner hasn't picked one), fall back to `brandPrimary` so the gradient still keys off owner branding rather than gray-50. This produces a "branded-feeling" hero even before the owner explicitly picks a background_color.

    **app/[account]/page.tsx** — modify the existing page:

    Read existing file. The current shape: BrandedPage wrapper > main with header > event-type grid. Replace with:

    ```tsx
    return (
      <BrandedPage
        logoUrl={data.account.logo_url}
        primaryColor={data.account.brand_primary}
        accountName={data.account.name}
        backgroundColor={data.account.background_color ?? null}
        backgroundShade={(data.account.background_shade ?? 'subtle') as BackgroundShade}
      >
        <main className="mx-auto max-w-5xl px-6 py-12 md:py-20">
          <ListingHero
            accountName={data.account.name}
            logoUrl={data.account.logo_url}
            brandPrimary={data.account.brand_primary}
            backgroundColor={data.account.background_color}
            backgroundShade={(data.account.background_shade ?? 'subtle') as BackgroundShade}
          />
          <section className="mt-10">
            {data.eventTypes.length === 0 ? (
              <AccountEmptyState accountName={data.account.name} ownerEmail={data.account.owner_email} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.eventTypes.map((event) => (
                  <EventTypeCard key={event.id} accountSlug={data.account.slug} event={event} brandPrimary={data.account.brand_primary} />
                ))}
              </div>
            )}
          </section>
        </main>
      </BrandedPage>
    );
    ```

    Preserve all existing imports (`generateMetadata`, `notFound`, `loadAccountListing`, `EventTypeCard`, `AccountEmptyState`).

    Note: `BrandedPage` already renders `<GradientBackdrop>` (Plan 12-01 Task 2). The hero card has its OWN inner GradientBackdrop for visual emphasis (CONTEXT lock: hero gradient density = strong). The page-level backdrop is subtle/none-driven by account tokens; the hero is a self-contained "spotlight" panel.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `npm run dev` → visit `/nsi`. Confirm: hero card with logo + name renders centered. Confirm: gradient blur circles appear in/behind hero. Confirm: event-type grid renders below.
    3. Set `accounts.background_color='#F97316', background_shade='bold'` for NSI → reload → confirm hero gradient is now orange + denser. Reset to `null, 'subtle'` after test.
    4. With background_shade='none' → confirm hero shows flat tint instead of circles.
    5. `notFound()` for unknown slugs still works (visit `/notarealslug` → 404).
    6. Soft-deleted account (`deleted_at IS NOT NULL`) still 404s (Phase 10 ACCT-03 contract).
  </verify>
  <done>
    `/[account]` is a Cruip-styled landing card; UI-13 satisfied; UI-04 satisfied for /[account] surface.
  </done>
</task>

<task type="auto">
  <name>Task 2: /[account]/[event-slug] booking page + booking-shell restyle</name>
  <files>
    app/[account]/[event-slug]/page.tsx
    app/[account]/[event-slug]/_components/booking-shell.tsx
    app/[account]/[event-slug]/_components/slot-picker.tsx
  </files>
  <action>
    **app/[account]/[event-slug]/page.tsx** — read existing. The page consumes `loadEventTypeForBookingPage` and renders `<BrandedPage>` > `<BookingShell>`. Update:
    - Pass `backgroundColor` and `backgroundShade` to `<BrandedPage>` (additive — Plan 12-01 made these optional props).
    - Source from `data.account.background_color` + `data.account.background_shade`. Confirm `loadEventTypeForBookingPage` returns these fields — if not, extend its SELECT.

    **booking-shell.tsx** — read existing. This is the layout wrapper. Apply Cruip rhythm:
    - Top section (header / event title / metadata): `py-12 md:py-20` rhythm with hero-style typography (`text-3xl md:text-4xl font-semibold tracking-tight`).
    - Slot-picker container: `max-w-3xl mx-auto` (UI-10 lock). Background should be `bg-white` (clean) — slot-picker section sits in a "calm" zone per CONTEXT.md (gradient is in hero + footer accents only).
    - Footer accents: a subtle `<GradientBackdrop>` wrapper with a different positional offset, OR a soft `bg-gradient-to-t from-{branding}/10 to-transparent` strip — keep it simple and avoid duplicating the page-level `<BrandedPage>` backdrop. Recommendation: **skip footer accents for v1.1**; CONTEXT says "footer accents" but the page-level GradientBackdrop already extends down. Document the simplification in summary.

    Pseudo-pattern for booking-shell.tsx outer:

    ```tsx
    return (
      <main className="mx-auto w-full">
        <header className="mx-auto max-w-3xl px-6 pt-12 pb-8 text-center md:pt-20 md:pb-12">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">{eventType.name}</h1>
          <p className="mt-3 text-sm text-gray-600 md:text-base">{eventType.duration_minutes} minutes with {accountName}</p>
        </header>
        <section className="mx-auto max-w-3xl px-6 pb-12 md:pb-20">
          <div className="rounded-2xl border bg-white shadow-sm">
            {/* slot-picker + booking-form rendered inside */}
          </div>
        </section>
      </main>
    );
    ```

    **slot-picker.tsx** — read existing. The slot picker already supports the `remaining_capacity` "X spots left" badge (Phase 11). Apply visual polish only:
    - Slot buttons: rounded-lg, hover:bg-gray-50, selected state uses `style={{ backgroundColor: brandPrimary }}` (Phase 7 contract).
    - "X spots left" badge already styled (Phase 11 lock); leave alone unless it visibly clashes.
    - Date selector (the calendar grid): keep existing react-day-picker; Cruip styling already present via shadcn Calendar.

    **DO NOT TOUCH:**
    - booking-form.tsx submit logic (Phase 11 CAP-07 409 branching is live; do not regress).
    - The race-loser banner.
    - Existing CAP-08 "X spots left" rendering.

    **Embed-iframe height pitfall (research §Pitfall 10):** Plan 12-05 doesn't directly affect embed shell here, but applies same care: ensure the BrandedPage `relative overflow-hidden` from Plan 12-01 prevents gradient circles from extending the document scroll height. Test by inspecting `document.body.scrollHeight` before vs after change in DevTools.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `npm run dev` → visit `/nsi/30min`. Confirm: hero header at `py-12`+ rhythm, event name in tracking-tight 3xl-4xl, slot-picker in white card max-w-3xl.
    3. Confirm: gradient backdrop renders behind via BrandedPage (Plan 12-01 wiring).
    4. Set NSI `background_color='#3B82F6', background_shade='bold'` → reload → blue gradient circles visible. Reset.
    5. Submit a booking → existing flow still works (POST 200 → confirmation page).
    6. Trigger 409 with capacity-1 race → existing RaceLoserBanner still appears (no regression to Phase 11 work).
    7. Mobile (375px): no horizontal scroll; slot picker stacks correctly.
    8. Set background_shade='none' → confirm flat tint, no circles.
  </verify>
  <done>
    Booking page adopts Cruip rhythm; max-w-3xl slot picker; gradient consumes account tokens; Phase 11 booker UX (capacity badge + 409 branching) preserved.
  </done>
</task>

<task type="auto">
  <name>Task 3: Embed shell restyle + EmbedCodeDialog widening</name>
  <files>
    app/embed/[account]/[event-slug]/_components/embed-shell.tsx
    app/(shell)/app/event-types/_components/embed-code-dialog.tsx
  </files>
  <action>
    **embed-shell.tsx** — read existing. The embed renders chromeless (no nav, no header pill). Apply Cruip restyle WITH gradient (CONTEXT.md lock: brand carries inside iframe):

    ```tsx
    // Pseudo-pattern (adapt to existing imports)
    return (
      <div className="relative min-h-screen overflow-hidden bg-white">
        <GradientBackdrop color={branding.backgroundColor ?? branding.primaryColor} shade={branding.backgroundShade} />
        <main className="relative z-10 mx-auto max-w-3xl px-4 py-8 md:py-12">
          {/* Existing slot-picker + booking-form children unchanged */}
          {children}
        </main>
        <EmbedHeightReporter />
      </div>
    );
    ```

    **CRITICAL — research Pitfall 10 (embed height-reporter conflict):**
    - The outer wrapper MUST be `relative overflow-hidden` so blur circles clip to the iframe's visible area (don't extend `document.body.scrollHeight`).
    - GradientBackdrop is `absolute -z-10` (positioned within the relative parent) so it doesn't contribute to layout height.
    - EmbedHeightReporter measures `document.body.scrollHeight` and posts to parent — verify by manually triggering height resize in dev (open `/embed/nsi/30min` in iframe via a host page; check console for postMessage).
    - **Reduced gradient density for embed:** Embed is typically rendered in a much smaller iframe (300-500px height) than full pages. The 3 absolutely-positioned circles at `top-[420px]` etc. would not render visibly because they're below the iframe fold. Use ONLY the first circle position (`-top-32`) for embed. Add an `embedMode` prop to `<GradientBackdrop>` OR render a custom inline single-circle wrapper inside embed-shell. Pick: **inline single-circle** to avoid bloating the GradientBackdrop API.

    Custom inline (within embed-shell.tsx):
    ```tsx
    // Inside embed-shell.tsx, replace GradientBackdrop with:
    {branding.backgroundShade !== 'none' && (
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 -z-10">
        <div
          className="h-80 w-80 rounded-full"
          style={{
            backgroundImage: `linear-gradient(to top right, ${branding.backgroundColor ?? branding.primaryColor}, transparent)`,
            opacity: branding.backgroundShade === 'subtle' ? 0.25 : 0.5,
            filter: `blur(${branding.backgroundShade === 'subtle' ? 200 : 160}px)`,
          }}
        />
      </div>
    )}
    {branding.backgroundShade === 'none' && (
      <div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundColor: `color-mix(in oklch, ${branding.backgroundColor ?? '#F8FAFC'} 4%, white)` }} />
    )}
    ```

    Document why: 3-circle pattern for full pages, 1-circle for embed iframes (height-reporter compatibility). Phase summary should note this divergence.

    **embed-code-dialog.tsx** — read existing. Find the dialog `<DialogContent>` line. Update its `className` to include `sm:max-w-2xl` (was `sm:max-w-md` or similar). UI-09 lock.

    Verify with snippet copy:
    ```tsx
    <DialogContent className="sm:max-w-2xl">
      {/* existing snippet UI unchanged */}
    </DialogContent>
    ```

    Existing snippet contents (the `<iframe>` + copy button) remain untouched.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `npm run dev` → visit `/embed/nsi/30min` directly in browser. Confirm: chromeless layout (no sidebar, no header pill), single gradient circle at top, slot picker centered max-w-3xl.
    3. Embed via test host page (or use the existing `app/embed/[account]/[event-slug]/page.tsx` directly in browser, simulating iframe context). Confirm no horizontal scrollbar, iframe height reports correctly (console.log or DevTools Network → embed parent).
    4. Set background_shade='none' → embed renders flat tint, no circle.
    5. Visit `/app/event-types`. Click "Embed code" on an event row → dialog opens at `sm:max-w-2xl` width.
    6. Confirm code snippet inside dialog wraps cleanly without horizontal overflow at 320 / 768 / 1024 viewports.
    7. Booking flow inside embed still works (submit → existing confirmation flow).
  </verify>
  <done>
    Embed widget adopts Cruip restyle with gradient (single-circle pattern for iframe height compatibility); EmbedCodeDialog widened to sm:max-w-2xl; UI-09, UI-11 satisfied.
  </done>
</task>

</tasks>

<verification>
**Plan-level checks:**
- `/[account]` index renders Cruip hero card with logo + name + gradient.
- `/[account]/[event-slug]` uses py-12 md:py-20 + max-w-3xl slot picker.
- `/embed/[account]/[event-slug]` uses single-circle gradient (height-reporter safe).
- BrandedPage receives backgroundColor + backgroundShade props on all public consumers.
- EmbedCodeDialog opens at sm:max-w-2xl.
- Phase 11 booker UX (capacity badge, 409 branching, race banner) preserved.
- ACCT-03 deleted_at filter still 404s (no regressions to Phase 10 behavior).
- Vitest baseline preserved.
- `npx tsc --noEmit` clean.

**Requirements satisfied:**
- UI-09 (EmbedCodeDialog sm:max-w-2xl)
- UI-10 (Public booking page py-12 md:py-20 + max-w-3xl + gradient)
- UI-11 (Embed restyle with gradient inside iframe)
- UI-13 (/[account] index polished landing card)
- UI-04 (gradient backdrops on public surfaces) — public portion

**Phase success criteria contribution:**
- Criterion #3 — fully satisfied with Plan 12-04 (dashboard already covered)
- Criterion #4 — fully satisfied for public + embed (auth covered in Plan 12-02)
</verification>

<success_criteria>
1. `/[account]` renders ListingHero with gradient + logo/name + event-type grid below.
2. `/[account]/[event-slug]` booking-shell uses py-12 md:py-20 rhythm and max-w-3xl slot picker container.
3. BrandedPage receives backgroundColor + backgroundShade on all 4 public callers.
4. Embed shell uses single-circle gradient (or flat tint for shade='none') with overflow-hidden parent.
5. EmbedHeightReporter still functions (no horizontal scroll, no height jumps).
6. EmbedCodeDialog widened to sm:max-w-2xl; snippet renders cleanly at 320/768/1024.
7. Phase 11 booker UX preserved end-to-end.
8. No Vitest regressions.
</success_criteria>

<output>
After completion, create `.planning/phases/12-branded-ui-overhaul/12-05-SUMMARY.md` documenting:
- Files: list above
- Tech-stack additions: none
- Decisions: ListingHero falls back to brand_primary when background_color is null (so hero looks branded by default)
- Decisions: Footer accents simplified to "page-level GradientBackdrop reaches down naturally" (CONTEXT.md said "subtle footer accents" but layered backdrops would over-engineer; flag in summary if Andrew wants explicit footer)
- Decisions: Embed uses single-circle gradient pattern (NOT 3-circle) to avoid iframe height-reporter conflicts (Pitfall 10)
- Key files for Phase 13 QA matrix: 3 test accounts × 5 surfaces × 3 shade values = matrix to walk through
- For Plan 12-06: emails will read same background_color, but must use solid-color (not gradient) — different rendering path
</output>
