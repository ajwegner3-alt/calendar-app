---
phase: 17-public-surfaces-and-embed
plan: 05
type: execute
wave: 3
depends_on: ["17-02"]
files_modified:
  - app/cancel/[token]/page.tsx
  - app/reschedule/[token]/page.tsx
autonomous: true

must_haves:
  truths:
    - "Visiting a valid /cancel/[token] renders cancel-confirm card inside PublicShell"
    - "Visiting an already-cancelled /cancel/[token] renders cancellation message inside PublicShell"
    - "Visiting a valid /reschedule/[token] renders RescheduleShell inside PublicShell"
    - "Token resolver account objects (without background_color/background_shade) work correctly with brandingFromRow partial-data signature"
  artifacts:
    - path: "app/cancel/[token]/page.tsx"
      provides: "Cancel token flow wrapped in PublicShell on cancelled+active branches"
      contains: "PublicShell"
    - path: "app/reschedule/[token]/page.tsx"
      provides: "Reschedule token flow wrapped in PublicShell on active branch"
      contains: "PublicShell"
  key_links:
    - from: "app/cancel/[token]/page.tsx"
      to: "lib/branding/read-branding.ts"
      via: "brandingFromRow with partial account object"
      pattern: "brandingFromRow"
    - from: "app/reschedule/[token]/page.tsx"
      to: "lib/branding/read-branding.ts"
      via: "brandingFromRow with partial account object"
      pattern: "brandingFromRow"
---

<objective>
Migrate the cancel and reschedule token flows (`/cancel/[token]`, `/reschedule/[token]`) from `BrandedPage` to `PublicShell`. These pages have a unique constraint: their token-resolver account objects do NOT include `background_color` or `background_shade` columns (RESEARCH.md Q5/Q6). `brandingFromRow` handles partial input safely.

Purpose: Cancel and reschedule are the booker's modification paths. They must adopt the new visual language to avoid jarring inconsistency when a booker clicks an email link to cancel and lands on an old-style page after experiencing the new style on the booking page.

Output: Token flow pages render with bg-gray-50 + customer-tinted glow + glass pill + customer brand on "Book again" button. The `not_active` branch (TokenNotActive) is handled in Plan 17-06 — this plan covers only the branches that have full account context.
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
@app/cancel/[token]/page.tsx
@app/reschedule/[token]/page.tsx
@app/cancel/[token]/_lib/resolve-cancel-token.ts
@app/reschedule/[token]/_lib/resolve-reschedule-token.ts
@lib/branding/read-branding.ts
</context>

<preamble>
## v1.2 Visual Locks
1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]`
2-6. (See REQUIREMENTS.md preamble)

## Phase 17 Guardrails
- **Partial Branding (RESEARCH.md Pitfall 4):** `resolveCancelToken` and `resolveRescheduleToken` return account objects with only `logo_url`, `brand_primary`, `name`, `slug`, `timezone`, `owner_email` (cancel/reschedule type definitions intentionally lean). Pass these to `brandingFromRow` — it accepts optional fields. The resulting `Branding` object will have `backgroundColor: null`, `backgroundShade: 'subtle'` defaults, which are unused by PublicShell anyway.
- **TokenNotActive branch is OUT OF SCOPE here.** When `resolved.state === "not_active"` the page returns `<TokenNotActive />` directly — that component is handled in Plan 17-06. Do NOT modify the not_active branch in this plan.
- **MP-04:** "Book again" link in the cancelled branch uses inline `style={{ background: "var(--brand-primary, #0A2540)", color: "var(--brand-text, #ffffff)" }}` — keep as-is. PublicShell now sets both `--brand-primary` and `--brand-text` so these vars resolve to customer color.
- **AUTH-15-style preservation:** All token resolution logic, Suspense boundaries, form bindings (CancelConfirmForm, RescheduleShell internals, oldStartTz/oldDate/oldTime formatting) preserved verbatim.

## Requirement coverage
- PUB-08: covered by Task 1 (cancel)
- PUB-09: covered by Task 2 (reschedule)
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Migrate /cancel/[token]/page.tsx (cancelled + active branches) to PublicShell</name>
  <files>app/cancel/[token]/page.tsx</files>
  <action>
Open `app/cancel/[token]/page.tsx`. Three render paths:
- `not_active` → `<TokenNotActive ownerEmail={null} />` — DO NOT TOUCH (handled in Plan 17-06).
- `cancelled` → `<BrandedPage>` with "Booking cancelled" message + "Book again" link.
- `active` → `<BrandedPage>` with `<CancelConfirmForm>`.

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

2. **Cancelled branch** (currently the `if (resolved.state === "cancelled")` block). Replace:
```typescript
return (
  <BrandedPage
    logoUrl={resolved.account?.logo_url ?? null}
    primaryColor={resolved.account?.brand_primary ?? null}
    accountName={resolved.account?.name ?? "NSI"}
  >
    <div className="mx-auto max-w-md p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8 text-center">
        ...
      </div>
    </div>
  </BrandedPage>
);
```

With:
```typescript
const cancelledBranding = brandingFromRow({
  logo_url: resolved.account?.logo_url ?? null,
  brand_primary: resolved.account?.brand_primary ?? null,
});
return (
  <PublicShell branding={cancelledBranding} accountName={resolved.account?.name ?? "NSI"}>
    <div className="mx-auto max-w-md px-6 sm:px-10">
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Booking cancelled</h1>
        <p className="text-sm text-muted-foreground mb-6">Your appointment has been cancelled.</p>
        {resolved.account && resolved.eventType ? (
          <Link
            href={`/${resolved.account.slug}/${resolved.eventType.slug}`}
            className="inline-block px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
            style={{
              background: "var(--brand-primary, #0A2540)",
              color: "var(--brand-text, #ffffff)",
            }}
          >
            Book again
          </Link>
        ) : null}
      </div>
    </div>
  </PublicShell>
);
```

Changes:
- BrandedPage → PublicShell with brandingFromRow for partial data.
- Outer wrapper class `p-6 sm:p-10` → `px-6 sm:px-10` (drop vertical padding — PublicShell's `<main className="pt-20 md:pt-24 pb-12">` already provides vertical spacing).
- Card class `rounded-lg border bg-card p-6 sm:p-8 text-center` → `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm` (v1.2 lock per PUB-08).
- "Book again" inline-style preserved verbatim.

3. **Active branch** (final return). Replace:
```typescript
return (
  <BrandedPage
    logoUrl={account.logo_url ?? null}
    primaryColor={account.brand_primary ?? null}
    accountName={account.name}
  >
    <div className="mx-auto max-w-md p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        ...
      </div>
    </div>
  </BrandedPage>
);
```

With:
```typescript
const activeBranding = brandingFromRow({
  logo_url: account.logo_url ?? null,
  brand_primary: account.brand_primary ?? null,
});
return (
  <PublicShell branding={activeBranding} accountName={account.name}>
    <div className="mx-auto max-w-md px-6 sm:px-10">
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Cancel this booking?</h1>
        <p className="text-sm text-muted-foreground mb-6">
          You&apos;re about to cancel your appointment with <strong>{account.name}</strong>.
        </p>

        <dl className="space-y-3 mb-6">
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">What</dt>
            <dd className="text-sm">{eventType.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">When</dt>
            <dd className="text-sm">{dateLine}<br />{timeLine}</dd>
          </div>
        </dl>

        <Suspense fallback={null}>
          <CancelConfirmForm
            token={token}
            accountSlug={account.slug}
            eventSlug={eventType.slug}
          />
        </Suspense>
      </div>
    </div>
  </PublicShell>
);
```

Changes:
- BrandedPage → PublicShell with brandingFromRow.
- Outer wrapper `p-6 sm:p-10` → `px-6 sm:px-10` (vertical padding moved to PublicShell main).
- Card class `rounded-lg border bg-card p-6 sm:p-8` → `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm` (v1.2 lock).
- All inner content (h1, p, dl, Suspense+CancelConfirmForm) preserved verbatim.

**DO NOT:**
- Touch the `not_active` branch (Plan 17-06 handles that).
- Change `dynamic`, `revalidate`, or `generateMetadata` exports.
- Change `resolveCancelToken` call or its return shape handling.
- Modify `CancelConfirmForm`.
- Move the date/time formatting (`startTz`, `dateLine`, `timeLine`).
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "BrandedPage" app/cancel/[token]/page.tsx` — zero matches.
Run `grep -c "PublicShell" app/cancel/[token]/page.tsx` — must be ≥ 2 (one per branch).
Run `grep -n "TokenNotActive" app/cancel/[token]/page.tsx` — must still match (not_active branch preserved).
Run `grep -n "rounded-xl border border-gray-200" app/cancel/[token]/page.tsx` — must match (v1.2 lock).
Run `grep -n "var(--brand-primary" app/cancel/[token]/page.tsx` — must match (Book again button preserved).
  </verify>
  <done>Both cancelled and active branches wrapped in PublicShell with brandingFromRow-derived Branding. not_active branch unchanged. Card classes use v1.2 lock. Suspense+CancelConfirmForm preserved. TypeScript clean.</done>
</task>

<task type="auto">
  <name>Task 2: Migrate /reschedule/[token]/page.tsx (active branch) to PublicShell</name>
  <files>app/reschedule/[token]/page.tsx</files>
  <action>
Open `app/reschedule/[token]/page.tsx`. Two render paths:
- `not_active` → `<TokenNotActive ownerEmail={null} />` — DO NOT TOUCH.
- Default (active) → `<BrandedPage>` with `<RescheduleShell>`.

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

2. **Active branch** (final return). Replace:
```typescript
return (
  <BrandedPage
    logoUrl={account.logo_url ?? null}
    primaryColor={account.brand_primary ?? null}
    accountName={account.name}
  >
    <div className="mx-auto max-w-2xl p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold mb-2">Reschedule your booking</h1>
        ...
        <RescheduleShell ... />
      </div>
    </div>
  </BrandedPage>
);
```

With:
```typescript
const branding = brandingFromRow({
  logo_url: account.logo_url ?? null,
  brand_primary: account.brand_primary ?? null,
});
return (
  <PublicShell branding={branding} accountName={account.name}>
    <div className="mx-auto max-w-2xl px-6 sm:px-10">
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Reschedule your booking</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Pick a new time for your appointment with <strong>{account.name}</strong>.
        </p>
        <p className="text-sm bg-muted/50 rounded-md px-3 py-2 mb-6">
          <span className="text-muted-foreground">Currently scheduled:</span>{" "}
          <span className="font-medium">{oldDate}, {oldTime}</span>
        </p>

        <RescheduleShell
          token={token}
          tokenHash={tokenHash}
          accountSlug={account.slug}
          accountTimezone={account.timezone}
          accountName={account.name}
          ownerEmail={account.owner_email}
          eventTypeId={eventType.id}
          eventTypeSlug={eventType.slug}
          eventTypeName={eventType.name}
          durationMinutes={eventType.duration_minutes}
          oldStartAt={booking.start_at}
          bookerTimezoneInitial={booking.booker_timezone}
        />
      </div>
    </div>
  </PublicShell>
);
```

Changes:
- BrandedPage → PublicShell with brandingFromRow.
- Outer wrapper `p-6 sm:p-10` → `px-6 sm:px-10` (vertical padding moved to PublicShell main).
- Card class `rounded-lg border bg-card p-6 sm:p-8` → `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm` (v1.2 lock per PUB-09).
- All RescheduleShell props preserved verbatim.
- Inner h1, paragraphs, and "Currently scheduled" pill preserved verbatim.

**DO NOT:**
- Touch the `not_active` branch.
- Change `dynamic`, `revalidate`, or `generateMetadata` exports.
- Change `resolveRescheduleToken` call or its return shape handling.
- Modify `RescheduleShell` or any of its props.
- Move the oldStartTz/oldDate/oldTime formatting.
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "BrandedPage" app/reschedule/[token]/page.tsx` — zero matches.
Run `grep -n "PublicShell" app/reschedule/[token]/page.tsx` — must match.
Run `grep -n "TokenNotActive" app/reschedule/[token]/page.tsx` — must still match (not_active branch preserved).
Run `grep -n "rounded-xl border border-gray-200" app/reschedule/[token]/page.tsx` — must match.
Run `grep -n "RescheduleShell" app/reschedule/[token]/page.tsx` — must still match (all props passed).
  </verify>
  <done>Reschedule active branch wrapped in PublicShell. not_active branch unchanged. Card class uses v1.2 lock. RescheduleShell unchanged. TypeScript clean.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zero errors.
2. `grep -rn "BrandedPage" app/cancel/ app/reschedule/` — zero matches.
3. `grep -rn "TokenNotActive" app/cancel/ app/reschedule/` — must still match (handled in Plan 17-06).
4. Functional preservation: token resolvers, Suspense, CancelConfirmForm, RescheduleShell, date formatting all unchanged.
</verification>

<success_criteria>
1. `app/cancel/[token]/page.tsx` cancelled + active branches use `<PublicShell>` with `brandingFromRow`-derived Branding.
2. `app/reschedule/[token]/page.tsx` active branch uses `<PublicShell>` with `brandingFromRow`-derived Branding.
3. Both pages preserve `not_active` branch returning `<TokenNotActive />` unchanged.
4. All cards use `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm` (v1.2 lock).
5. CancelConfirmForm, RescheduleShell, all helpers preserved verbatim.
6. `npx tsc --noEmit` passes.
</success_criteria>

<output>
After completion, create `.planning/phases/17-public-surfaces-and-embed/17-05-token-flows-migration-SUMMARY.md`. Note that brandingFromRow handles partial input correctly and confirm not_active branches are deferred to Plan 17-06.
</output>
