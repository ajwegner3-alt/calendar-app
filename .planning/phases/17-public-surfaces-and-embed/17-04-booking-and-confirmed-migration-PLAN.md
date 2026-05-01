---
phase: 17-public-surfaces-and-embed
plan: 04
type: execute
wave: 3
depends_on: ["17-02"]
files_modified:
  - app/[account]/[event-slug]/page.tsx
  - app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx
autonomous: true

must_haves:
  truths:
    - "Visiting /[account]/[event-slug] renders BookingShell inside PublicShell with customer brand color driving glow + slot picker selected state"
    - "Visiting /[account]/[event-slug]/confirmed/[id] renders confirmation card inside PublicShell on both confirmed and not-confirmed branches"
    - "Confirmation card uses rounded-xl + border-gray-200 + p-6 sm:p-8 + shadow-sm (PUB-07 standardization)"
  artifacts:
    - path: "app/[account]/[event-slug]/page.tsx"
      provides: "Booking page wrapped in PublicShell"
      contains: "PublicShell"
    - path: "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx"
      provides: "Confirmation page wrapped in PublicShell (both branches)"
      contains: "PublicShell"
  key_links:
    - from: "app/[account]/[event-slug]/page.tsx"
      to: "app/_components/public-shell.tsx"
      via: "import + render"
      pattern: "PublicShell"
    - from: "app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx"
      to: "app/_components/public-shell.tsx"
      via: "import + render in BOTH return branches"
      pattern: "PublicShell"
---

<objective>
Migrate the booking page (`/[account]/[event-slug]`) and the confirmation page (`/[account]/[event-slug]/confirmed/[booking-id]`) from `BrandedPage` to `PublicShell`. Standardize the confirmation card class string to the v1.2 lock.

Purpose: These two pages are the booker's primary path (pick slot → fill form → confirm). They must adopt the new visual language together so the customer sees consistent branding across the booking flow. Slot picker `bg-primary` selected state will inherit `--primary` from PublicShell automatically (no SlotPicker code change needed — PublicShell sets `--primary` per Plan 17-02).

Output: Two migrated pages where the booking flow renders with bg-gray-50 + customer-tinted glow + glass pill + customer-tinted slot picker selected state + NSI footer.
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

# Files this plan modifies / reads
@app/[account]/[event-slug]/page.tsx
@app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx
@lib/branding/read-branding.ts
</context>

<preamble>
## v1.2 Visual Locks
1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]`
2-6. (See REQUIREMENTS.md preamble)

## Phase 17 Guardrails
- **CP-07 reminder:** SlotPicker's `.day-has-slots` dot is `var(--color-accent)` — DO NOT change. PublicShell sets `--primary`, not `--color-accent`. The dot stays orange.
- **MP-04:** Confirmation page's checkmark uses `var(--brand-primary, #0A2540)` inline style — keep as-is. PublicShell now sets `--brand-primary` so this var resolves to customer color (was previously dependent on BrandedPage). Functional behavior unchanged.
- **AUTH-15-style preservation:** Existing booking-flow logic (loaders, BookingShell internals, maskEmail helper, status branching) MUST remain verbatim. Visual wrapper only.

## Requirement coverage
- PUB-06: covered by Task 1
- PUB-07: covered by Task 2
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Migrate /[account]/[event-slug]/page.tsx (booking page) to PublicShell</name>
  <files>app/[account]/[event-slug]/page.tsx</files>
  <action>
Open `app/[account]/[event-slug]/page.tsx`. The current implementation wraps `<BookingShell>` in `<BrandedPage>` with logo+primary+name+backgroundColor+backgroundShade props.

**Edit plan:**

1. Replace imports:
```typescript
// REMOVE
import { BrandedPage } from "@/app/_components/branded-page";
import type { BackgroundShade } from "@/lib/branding/types";
```
Add:
```typescript
import { PublicShell } from "@/app/_components/public-shell";
import { brandingFromRow } from "@/lib/branding/read-branding";
```

2. In `BookingPage` function body, AFTER `if (!data) notFound()`, REMOVE:
```typescript
const backgroundShade = (data.account.background_shade ?? "subtle") as BackgroundShade;
```
And REPLACE with:
```typescript
const branding = brandingFromRow(data.account);
```

3. Replace the JSX return. Current:
```typescript
return (
  <BrandedPage
    logoUrl={data.account.logo_url}
    primaryColor={data.account.brand_primary}
    accountName={data.account.name}
    backgroundColor={data.account.background_color ?? null}
    backgroundShade={backgroundShade}
  >
    {/* PLAN-05-06-REPLACE-INLINE-START */}
    {/* BookingShell is a "use client" component (Plan 05-06). Real import above. */}
    {/* PLAN-05-06-REPLACE-INLINE-END */}
    <BookingShell account={data.account} eventType={data.eventType} />
  </BrandedPage>
);
```

Replace with:
```typescript
return (
  <PublicShell branding={branding} accountName={data.account.name}>
    <BookingShell account={data.account} eventType={data.eventType} />
  </PublicShell>
);
```

**Note:** The `PLAN-05-06-REPLACE-INLINE-*` markers are stale (Phase 5 artifacts). They can be deleted along with the surrounding code. Their purpose was historical (signaling a swap point during Phase 5). They serve no current purpose and removing them is a tidy-up consistent with the migration.

**Why no `<main>` or `<div>` wrapper:** PublicShell already wraps children in `<main className="pt-20 md:pt-24 pb-12">`. `BookingShell` is a `"use client"` component that owns its own internal layout — it should sit directly inside the shell's main without nested wrappers.

**Slot picker selected state:** SlotPicker uses Tailwind's `bg-primary` class which reads `var(--color-primary, var(--primary))`. PublicShell sets `--primary: branding.primaryColor` on the CSS-var wrapper around children. This means the slot picker's selected state will render in customer brand color automatically — no SlotPicker code change needed. (Verified by RESEARCH.md Q12 / Pitfall 1.)

**BookingForm submit button:** BookingForm uses `var(--brand-primary, #0A2540)` for its submit button background. PublicShell also sets `--brand-primary: branding.primaryColor` so this resolves to customer brand color too. Both patterns work simultaneously.
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "BrandedPage" app/[account]/[event-slug]/page.tsx` — zero matches.
Run `grep -n "PublicShell" app/[account]/[event-slug]/page.tsx` — must match.
Run `grep -n "PLAN-05-06" app/[account]/[event-slug]/page.tsx` — zero matches (stale markers removed).
Run `grep -n "brandingFromRow" app/[account]/[event-slug]/page.tsx` — must match.
  </verify>
  <done>Booking page wrapped in PublicShell. BookingShell rendered as direct child. Stale PLAN-05-06 comment markers removed. TypeScript clean.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate /[account]/[event-slug]/confirmed/[booking-id]/page.tsx (both branches) to PublicShell + standardize card class</name>
  <files>app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx</files>
  <action>
Open the confirmation page. It has TWO `<BrandedPage>` returns (one for `!isConfirmed` fallback branch, one for `isConfirmed` happy path). Both must be migrated.

**Edit plan:**

1. Replace import:
```typescript
// REMOVE
import { BrandedPage } from "@/app/_components/branded-page";
```
Add:
```typescript
import { PublicShell } from "@/app/_components/public-shell";
import { brandingFromRow } from "@/lib/branding/read-branding";
```

2. After the `const { booking, account: acct, eventType } = data;` destructuring, add:
```typescript
const branding = brandingFromRow({
  logo_url: acct.logo_url,
  brand_primary: acct.brand_primary,
});
```
(The confirmation page's account object has only `logo_url` and `brand_primary` exposed — verified RESEARCH.md Q6. Pass partial data; brandingFromRow defaults missing fields to safe values per `lib/branding/read-branding.ts:23-53`.)

3. **Branch A — `!isConfirmed`** (currently lines 109-126). Current:
```typescript
return (
  <BrandedPage
    logoUrl={acct.logo_url}
    primaryColor={acct.brand_primary}
    accountName={acct.name}
  >
    <main className="mx-auto max-w-xl px-6 py-16">
      <section className="rounded-lg border p-8 text-center">
        <h1 className="text-xl font-semibold mb-3">
          This booking is no longer active.
        </h1>
        <p className="text-sm text-muted-foreground">
          Check your email for the latest details about your appointment.
        </p>
      </section>
    </main>
  </BrandedPage>
);
```

Replace with:
```typescript
return (
  <PublicShell branding={branding} accountName={acct.name}>
    <div className="mx-auto max-w-xl px-6 py-16">
      <section className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold mb-3">
          This booking is no longer active.
        </h1>
        <p className="text-sm text-muted-foreground">
          Check your email for the latest details about your appointment.
        </p>
      </section>
    </div>
  </PublicShell>
);
```

Changes:
- `BrandedPage` → `PublicShell`
- `<main>` → `<div>` (PublicShell renders its own `<main>`)
- Card class `rounded-lg border p-8` → `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm` (v1.2 card lock per PUB-07).
- Note `text-center` was on the original section; preserve it. Added `bg-white` since PublicShell's bg is gray-50 and the card needs to stand out.

4. **Branch B — `isConfirmed` happy path** (currently lines 129-170). Current:
```typescript
return (
  <BrandedPage
    logoUrl={acct.logo_url}
    primaryColor={acct.brand_primary}
    accountName={acct.name}
  >
    <main className="mx-auto max-w-xl px-6 py-16">
      <header className="mb-8 text-center">
        <div
          className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full text-xl"
          style={{
            backgroundColor: "color-mix(in srgb, var(--brand-primary, #0A2540) 15%, transparent)",
            color: "var(--brand-primary, #0A2540)",
          }}
          aria-hidden="true"
        >
          ✓
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          You&apos;re booked.
        </h1>
      </header>

      <dl className="rounded-lg border p-6 space-y-3 text-sm">
        <BookingRow label="Event">{eventType.name}</BookingRow>
        ...
      </dl>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Confirmation sent to <strong>{maskedEmail}</strong> with calendar invite.
      </p>
    </main>
  </BrandedPage>
);
```

Replace with:
```typescript
return (
  <PublicShell branding={branding} accountName={acct.name}>
    <div className="mx-auto max-w-xl px-6 py-16">
      <header className="mb-8 text-center">
        <div
          className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full text-xl"
          style={{
            backgroundColor: "color-mix(in srgb, var(--brand-primary, #0A2540) 15%, transparent)",
            color: "var(--brand-primary, #0A2540)",
          }}
          aria-hidden="true"
        >
          ✓
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          You&apos;re booked.
        </h1>
      </header>

      <dl className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 space-y-3 text-sm shadow-sm">
        <BookingRow label="Event">{eventType.name}</BookingRow>
        <BookingRow label="When">
          <span>{dateLine}</span>
          <span className="block text-muted-foreground">{timeLine}</span>
        </BookingRow>
        <BookingRow label="Duration">{eventType.duration_minutes} min</BookingRow>
        <BookingRow label="With">{acct.name}</BookingRow>
      </dl>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Confirmation sent to <strong>{maskedEmail}</strong> with calendar invite.
      </p>
    </div>
  </PublicShell>
);
```

Changes from original:
- Both branches: `<BrandedPage>` → `<PublicShell branding={branding} accountName={acct.name}>`
- Both branches: `<main>` → `<div>` (avoid nested main since PublicShell renders main).
- Branch A: card class promoted to v1.2 lock with text-center preserved.
- Branch B: `<dl className="rounded-lg border p-6 space-y-3 text-sm">` → `<dl className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 space-y-3 text-sm shadow-sm">`.
- Checkmark `<div>` PRESERVED VERBATIM — its `var(--brand-primary)` reference now resolves correctly because PublicShell sets that var. No code change.
- BookingRow helper function and maskEmail helper function preserved verbatim.

**DO NOT:**
- Change `BookingRow` or `maskEmail` helpers.
- Change date/time formatting logic.
- Change the loadConfirmedBooking call or generateMetadata.
- Touch the `robots: { index: false, follow: false }` metadata setting.
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "BrandedPage" app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` — zero matches.
Run `grep -n "PublicShell" app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` — must match (at least 2 occurrences — one for each branch).
Run `grep -n "rounded-xl border border-gray-200" app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` — must match (v1.2 card lock).
Run `grep -n "var(--brand-primary" app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` — must still match (checkmark CSS var preserved).
  </verify>
  <done>Both confirmation branches wrapped in PublicShell. Cards use v1.2 class lock (`rounded-xl border border-gray-200 bg-white ... shadow-sm`). Checkmark CSS-var styling preserved. BookingRow + maskEmail helpers untouched. TypeScript clean.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zero errors.
2. `grep -rn "BrandedPage" app/[account]/[event-slug]/` — zero matches across the entire event-slug subtree.
3. `grep -rn "<main" app/[account]/[event-slug]/page.tsx app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` — zero matches (avoid nested main; PublicShell owns main).
4. Functional preservation: BookingShell, BookingRow, maskEmail, helpers unchanged.
</verification>

<success_criteria>
1. `app/[account]/[event-slug]/page.tsx` uses `<PublicShell>` wrapping `<BookingShell>`.
2. `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` has 2 PublicShell renders (both branches).
3. Confirmation card class is `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 ... shadow-sm` (PUB-07 lock).
4. `var(--brand-primary)` checkmark style preserved verbatim.
5. `npx tsc --noEmit` passes.
</success_criteria>

<output>
After completion, create `.planning/phases/17-public-surfaces-and-embed/17-04-booking-and-confirmed-migration-SUMMARY.md`. Note any deviations and confirm both confirmation branches are migrated.
</output>
