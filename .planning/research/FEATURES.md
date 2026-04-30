# Feature Research: v1.2 Visual Contracts

**Domain:** Calendar booking app — NSI Brand Lock-Down + UI Overhaul
**Researched:** 2026-04-30
**Confidence:** HIGH — based on direct code inspection of every surface + verified reference components

---

## Scope Note

This document answers ONE question: **what is the expected visual contract for each surface under v1.2's branding rule?** It does NOT re-research functional capabilities — those shipped in v1.0/v1.1 and are unchanged. Categorization at the bottom (table stakes / capability-tier / anti-features) refers to the visual overhaul work items, not to functional features.

Branding rule locked at scoping:

| Surface group | Whose colors |
|---|---|
| `/app/*`, `/auth/*`, `/onboarding/*`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account-deleted` | NSI ONLY |
| `/[account]`, `/[account]/[event-slug]`, `/[account]/[event-slug]/confirmed/*`, `/cancel/*`, `/reschedule/*` | Customer (`brand_primary`) |
| `/embed/[account]/[event-slug]` | Customer (`brand_primary`) |
| 6 transactional emails | Customer (`brand_primary`) |

---

## Surface-by-Surface Visual Contracts

### Owner Side (NSI-Locked)

#### 1. Owner Shell `(shell)/layout.tsx`

**Current state (v1.1):** Wraps `SidebarProvider` + `SidebarInset`. Applies `--primary` CSS var override from `chrome.primaryColor` (account's `brand_primary`). Applies `backgroundColor: chrome.pageColor` on `SidebarInset`. Renders `GradientBackdrop` with account's `backgroundColor` + `backgroundShade`. Mobile-only `SidebarTrigger` hamburger at `fixed top-3 left-3 z-20 md:hidden` replaces the deleted `FloatingHeaderPill`.

**v1.2 contract:**

- Remove `--primary` CSS var override entirely (the wrapping `<div style={{ "--primary": ... }}>` is deleted). All shadcn primary buttons/switches/focus rings on owner side inherit the global default `--primary = #3B82F6` (Tailwind `blue-500`), which must be confirmed in `globals.css` or `tailwind.config`.
- Remove `AppSidebar` `sidebarColor` + `sidebarTextColor` props. Sidebar locks to default shadcn `--sidebar` background (white or near-white). No inline-style `backgroundColor` on the `<Sidebar>` element.
- Remove `backgroundColor: chrome.pageColor` from `SidebarInset` inline style.
- Replace `GradientBackdrop` call with `BackgroundGlow` component (vendored from lead-scoring). `BackgroundGlow` is fixed-position, hardcoded NSI blue (`#3B82F6`), no color prop on owner side.
- Replace mobile-only `SidebarTrigger` div with a full `Header` component (fixed `top-2 md:top-6 left-0 right-0 z-30 px-4`). The pill is `max-w-[1152px] mx-auto h-14 px-4 rounded-2xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03)]`. "NorthStar" wordmark: `text-lg font-extrabold tracking-[-0.04em]` with `text-gray-900` "North" + `text-blue-500` "Star". Right side: context label `text-[13px] font-medium text-gray-500` (e.g. "Dashboard"). This pill sits ABOVE the sidebar, spanning full width — desktop and mobile.
- `SidebarInset` background: `bg-gray-50` (class-driven, no inline style). Content shell: `min-h-screen bg-gray-50 pt-20 md:pt-24` (matching lead-scoring `dashboard/layout.tsx` pattern).
- Page content wrapper: `main className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 md:pt-8"` — kept from v1.1, confirm `pt` accounts for header pill height (`pt-20 md:pt-24`).

**What stays:** `SidebarProvider` + `SidebarInset` + `AppSidebar` IA (Home / Event Types / Availability / Bookings / Branding / Settings). `TooltipProvider`. Cookie-based SSR sidebar state. Auth guard. No structural change to sidebar navigation items.

---

#### 2. Auth Pages (login, signup, forgot-password, reset-password, verify-email, auth-error, account-deleted)

**Current state (v1.1):** All auth pages (except `account-deleted`) use `grid min-h-screen lg:grid-cols-2` split-panel. Left column: `bg-white px-6 py-12` form area. Right column: `<AuthHero>` component with `NSIGradientBackdrop` + "Powered by NSI" pill + headline + bullet list. `account-deleted` is standalone (no split-panel, no hero, bare `min-h-screen flex items-start justify-center p-8 pt-24`).

**v1.2 contract:**

**Split-panel kept.** The two-column layout is correct and visually differentiated — keep `grid min-h-screen lg:grid-cols-2`.

Left column (form side):
- Background: `bg-white` (kept)
- Add the `Header` pill from the shell (NSI "NorthStar" wordmark, same glass pill). The header pill spans the full page width, so it sits above both columns — a single shared header.
- Alternatively (simpler): left column keeps its own top branding strip showing "NorthStar" wordmark in the form column header area, matching the lead-scoring free-audit page pattern where the header is always full-width. Prefer the full-width Header component approach — consistent with shell.

`AuthHero` aside (right column):
- Replace `NSIGradientBackdrop` with `BackgroundGlow` component (fixed-position NSI blue blots). The aside background becomes `bg-gray-50` to let the glow show through (currently `bg-gray-50` is already set on the aside — confirmed in `auth-hero.tsx` line 21).
- Keep the "Powered by NSI" pill inside the aside (`inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur-sm` with `h-1.5 w-1.5 rounded-full bg-emerald-500` dot). This pill is DIFFERENT from the glass header pill — it is a marketing badge inside the hero content, not the site header. Keep it.
- Keep headline + subtext + bullet list content. These are NSI marketing copy, not branding controls.
- The `BackgroundGlow` component in the aside must be scoped to the aside container, not fixed-position (aside is not full-viewport). Use `absolute inset-0 overflow-hidden` wrapper with the two glow divs repositioned for the narrower aside panel, OR accept that the fixed-position `BackgroundGlow` will bleed through the aside from the global instance. Simplest: render `BackgroundGlow` as a global fixed element on the page (same as shell layout), letting it illuminate both columns.

**Form cards:** Currently use shadcn `<Card>` components (`bg-card rounded-lg border`). The `bg-card` token resolves to white on `bg-white` column — fine. No change needed. Under v1.2 `--primary = #3B82F6` globally, the submit buttons in these forms will show NSI blue automatically (no per-account override to remove here since auth pages never had per-account context).

**`account-deleted` page:**
- Currently bare `min-h-screen flex items-start justify-center p-8 pt-24` with plain `max-md w-full`.
- v1.2: add `BackgroundGlow` (global fixed instance if the layout includes it). Add the NSI `Header` pill. Wrap the content in a card: `bg-white rounded-xl border border-gray-200 p-6 shadow-sm max-w-md mx-auto`. "Account deleted" heading + body text + "Back to log in" link. The link should be a proper `Button` (NSI blue, not bare `text-blue-600 underline`).

---

#### 3. Onboarding Wizard (`/onboarding` layout + 3 steps)

**Current state (v1.1):** `min-h-screen bg-white p-8`. Container `mx-auto max-w-xl`. Progress bar: 3 `h-1.5 flex-1 rounded-full` segments, active = `bg-blue-600`, inactive = `bg-gray-200`. Steps use plain page with form cards.

**v1.2 contract:**

- Background: `bg-gray-50` (was `bg-white` — align with NSI visual language).
- Add `BackgroundGlow` (global fixed instance from root layout, or explicit in onboarding layout).
- Add NSI `Header` pill (same glass pill, "NorthStar" wordmark, context label = "Setup").
- Content padding: `pt-20 md:pt-24 pb-12` to clear the header pill. Container: `max-w-xl mx-auto px-4`.
- Progress bar: keep structure. Active segments switch from `bg-blue-600` to `bg-blue-500` (NSI canonical blue). Inactive stays `bg-gray-200`.
- Step form cards: `bg-white rounded-xl border border-gray-200 p-6 shadow-sm` — matching lead-scoring card pattern. Currently steps use shadcn `Card` — the `bg-card` token resolves to white, `rounded-lg border` — this is close enough; the only change is confirming `rounded-xl` and `shadow-sm` match the target pattern.
- Submit buttons: NSI blue-500 (`bg-primary` which is now `#3B82F6` globally). No per-account override needed here.
- Same shell as auth (no sidebar, no sidebar IA). Onboarding is a separate layout — confirmed `app/onboarding/layout.tsx` is its own file, not `(shell)`.

---

#### 4. Home Tab Monthly Calendar

**Current state (v1.1):** `HomeCalendar` wraps shadcn `Calendar`. Selected day: `bg-primary text-primary-foreground`. Booking dots: `var(--brand-primary, hsl(var(--primary)))` when not selected, `currentColor` when selected.

**v1.2 contract:**

- Selected day background: `bg-primary text-primary-foreground` — no change needed. With `--primary = #3B82F6` locked, this automatically becomes NSI blue-500.
- Booking dots: Change the CSS var fallback. Currently `var(--brand-primary, hsl(var(--primary)))`. Since `--brand-primary` is being removed from the owner shell (it was a per-account override on the `(shell)` layout), this falls through to `hsl(var(--primary))` which IS now NSI blue. However, `--brand-primary` as a var name is confusing on the owner side. Simplify to just `hsl(var(--primary))` directly — no need for the two-layer fallback on the owner side.
- The `HomeCalendar` component itself needs one-line change: `style={{ backgroundColor: isSelected ? "currentColor" : "hsl(var(--primary))" }}` on the dot spans (or simply `"var(--primary)"` directly if it resolves correctly with shadcn's theme).
- Page layout context: Home tab page (`app/(shell)/app/page.tsx`) renders inside the shell's `<main className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-6">`. The calendar sits inside a card. Card pattern: `bg-white rounded-xl border border-gray-200 p-4 shadow-sm` for consistency with lead-scoring.

---

#### 5. Event Types CRUD Pages

**Current state (v1.1):** `EventTypesPage` renders `max-w-5xl flex flex-col gap-6` with an `<header>` containing h1 + muted subtext + `<Button asChild>` CTA. `EventTypesTable` uses shadcn table. New/Edit pages use `event-type-form.tsx`.

**v1.2 contract:**

- No layout change to the page structure. The shell already provides `max-w-6xl` outer bounds.
- Card containers for form sections: adopt `bg-white rounded-xl border border-gray-200 p-6 shadow-sm` (matching lead-scoring + Profile Settings pattern). The event type form already lives in a card-like container — ensure `rounded-xl` and `shadow-sm` are present.
- CTA button: `<Button>` inherits `bg-primary = blue-500` automatically — no per-account override to strip here (these pages are in `(shell)` whose layout override is being removed).
- `EventTypesTable` already uses `rounded-lg border bg-card` for the enclosing card (matches). Confirm row hover uses `hover:bg-muted` (OK).
- Empty state component: same `bg-white rounded-xl border border-gray-200 p-6 shadow-sm` card pattern.

---

#### 6. Availability Editor

**Current state (v1.1):** `max-w-3xl flex flex-col gap-8 p-6` wrapper. `WeeklyRulesEditor`, `DateOverridesSection`, `SettingsPanel` sub-sections separated by `<Separator>`.

**v1.2 contract:**

- Same `bg-white rounded-xl border border-gray-200 p-{4,6} shadow-sm` card wrapping pattern for each section (weekly hours, date overrides, booking settings). Currently these use `Separator` between bare sections — v1.2 wraps each section in a white card for visual consistency with the rest of the owner shell.
- `WeekdayRow` toggle switches: `bg-primary` inherits NSI blue automatically.
- Override calendar: already uses shadcn `Calendar` which inherits `--primary`.
- Time window pickers: `<Select>` / `<Input>` inherit `focus:ring-primary` = NSI blue.

---

#### 7. Bookings List + Booking Detail

**Current state (v1.1):** `BookingsPage` renders `max-w-6xl flex flex-col gap-6` with a plain `<header>`. `BookingsTable` uses shadcn table. `BookingDetailPage` renders `max-w-3xl flex flex-col gap-6` with sections using `rounded-lg border bg-card p-6`.

**v1.2 contract:**

- `rounded-lg border bg-card p-6` → `rounded-xl border border-gray-200 bg-white p-6 shadow-sm` (standardize to lead-scoring card pattern — `rounded-xl` + `shadow-sm` + explicit `border-gray-200`).
- `bg-card` token may already resolve to white in the current theme; the explicit change prevents theme-drift if shadcn default changes.
- Status `<Badge>` colors: destructive/default/secondary are NSI-global, no per-account override needed.
- Filters: `<Select>` and `<Input>` components inherit `--primary` focus rings = NSI blue.
- Cancellation banner in detail: `rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3` — keep as-is (semantic color, not brand color).

---

#### 8. Branding Editor (`/app/branding`)

**Current state (v1.1):** Two-column layout (editor left, live preview right). Left: logo uploader + "Button & accent color" (`primaryColor`) + "Sidebar color" (`sidebarColor`) + "Page background" (`backgroundColor`) + "Background shade" (`backgroundShade`). Right: `PreviewIframe` (live embed iframe) + `MiniPreviewCard` (3-color faux dashboard layout).

**v1.2 contract — SIGNIFICANT REBUILD:**

**Controls (left column) — collapsed to 3 items:**

1. **Logo upload** — kept as-is (`LogoUploader`). Description updated: "Appears in your public booking page header and emails." Aspect ratio guidance: no strict enforcement (max 2 MB, PNG recommended, rendered `max-width: 120px max-height: 60px`). See logo section below.
2. **Brand Primary Color** — kept (`ColorPickerInput`). Label: "Booking page primary color". Description: "Used for the background glow, CTAs, and slot selection on your public booking pages." Replaces current "Button & accent color" label (which was misleading since v1.2 removes per-account button color on the owner side).
3. **Brand Accent Color** — NEW picker (`ColorPickerInput`). Label: "Booking page accent color". Description: "Used for the selected slot state and focus rings on your booking form." See `brand_accent` semantics section below.

**Removed controls:**
- "Sidebar color" picker — DEPRECATED. DB column `sidebar_color` stays until schema DROP migration (last phase of v1.2) but the UI control is removed.
- "Page background" picker — DEPRECATED. DB column `background_color` removed from UI.
- "Background shade" picker — DEPRECATED. DB column `background_shade` removed from UI.

**Preview (right column) — REBUILT:**

`MiniPreviewCard` rebuilt as a faux PUBLIC booking page (not faux dashboard):
- `bg-gray-50` base.
- Blob glow circle in `brand_primary` (inline style, `blur-[60px] opacity-40`).
- White card `bg-white rounded-xl border border-gray-200 p-4 shadow-sm` centered.
- Inside card: faux slot picker (3 `rounded-md border px-2 py-1` shimmer buttons; one "selected" = `bg-primary` filled using `brand_primary` inline style).
- "Powered by NSI" text in `text-[10px] text-gray-400 text-center` at the card bottom.
- Faux pill header at top of preview area (tiny `rounded-2xl bg-white/80 border border-gray-200`): shows logo (if set) or account initial circle.

`PreviewIframe` — kept as live preview but the URL it points to now renders the NEW public booking page style. The `?previewColor=` query param still works. No change to iframe plumbing.

`ShadePicker` component — REMOVED from page. No longer has a save target.

Save button labeling: change from "Save background" to "Save branding" since the entire left form is now one save action (or keep separate saves for logo vs. colors — existing per-section save UX can be preserved with updated labels).

---

#### 9. Settings Pages (Profile + Email + Reminders)

**Current state (v1.1):** `ProfileSettingsPage` renders `max-w-2xl space-y-10`. Form sections use `rounded-lg border bg-card p-6 space-y-3`. `ReminderSettingsPage` renders `max-w-2xl` with header + `ReminderTogglesForm`.

**v1.2 contract:**

- Section cards: `rounded-lg border bg-card p-6` → `rounded-xl border border-gray-200 bg-white p-6 shadow-sm` (same standardization as bookings).
- Toggle switches in `ReminderTogglesForm`: inherit `--primary = blue-500` automatically.
- No structural changes. `max-w-2xl` stays. `space-y-10` between sections stays.
- "Danger Zone" delete section: currently `DeleteAccountSection` — keep the red destructive button styling. It uses `variant="destructive"` which is a semantic color, not a brand color.

---

#### 10. `/app/unlinked` Page

**Current state (v1.1):** `max-w-md mx-auto mt-16` with a shadcn `Card`.

**v1.2 contract:**

- Sits inside the `(shell)` layout (with sidebar). The shell re-skin handles the background.
- Card: `rounded-xl border border-gray-200 bg-white p-6 shadow-sm` (standardize).
- "Log out" button: `variant="outline"` — keep (neutral action).

---

### Public Side (Customer-Themed)

The public side uses the SAME visual layout pattern as NSI's owner side (gray-50 + blob glow + glass pill) but with two substitutions:
1. Blob color = customer's `brand_primary` (not NSI blue).
2. Header pill = customer logo + account name (not "NorthStar" wordmark).

#### 11. Account Index `/[account]`

**Current state (v1.1):** `BrandedPage` wrapper (sets `--brand-primary`, renders `GradientBackdrop`). Inside: `max-w-5xl px-6 py-12` main. `ListingHero` section: `relative overflow-hidden rounded-2xl border bg-white px-6 py-12 text-center` with inner `GradientBackdrop`. Below: grid of `EventTypeCard` components.

**v1.2 contract:**

- `BrandedPage` wrapper evolves into a new `PublicShell` component (or `BrandedPage` is updated internally). `PublicShell` wraps children with:
  - `bg-gray-50` base (already correct via `bg-background` in `globals.css`).
  - `BackgroundGlow` component with `color` prop = customer `brand_primary`. The `BackgroundGlow` component needs a `color?: string` prop added (not in the v1.1 reference component which hardcodes `#3B82F6`). This is the key code change — parameterize the gradient hex.
  - Glass header pill: customer logo (if set) on the left + account name text on the right. Same pill spec: `h-14 px-4 rounded-2xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-[...]`. NOT "NorthStar" wordmark. Logo rendered as `<img>` `max-width: 120px max-height: 40px`. If no logo: account initial in a colored circle using `brand_primary`.
  - "Powered by NSI" footer mark (see section 14).
  - `pt-20 md:pt-24` content area to clear the header pill.

- `ListingHero`: The inner `GradientBackdrop` inside the hero card is REMOVED (redundant with the global `BackgroundGlow`). The hero becomes a clean white card: `rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm`. Logo avatar or initial circle centered. Account name as `h1 text-3xl font-semibold tracking-tight text-gray-900`. Subtext as `text-sm text-gray-600`.

- `EventTypeCard` grid: white cards `bg-white rounded-xl border border-gray-200 p-6 shadow-sm`. No per-account background tinting. Card hover: `hover:shadow-md transition-shadow`. CTA "Book" button: uses `--brand-primary` as inline style (customer color, not NSI blue).

---

#### 12. Event-Slug Booking Page `/[account]/[event-slug]`

**Current state (v1.1):** `BrandedPage` wrapper. `BookingShell` inside. Hero `<header>`: `mx-auto max-w-3xl px-6 pt-12 pb-8 text-center`. Slot-picker white card: `rounded-2xl border bg-white shadow-sm` `grid gap-8 p-6 lg:grid-cols-[1fr_320px]`. Slot buttons: `bg-primary text-primary-foreground border-primary` when selected (via `bg-primary` class — currently this means the account's `--primary` from the Phase 12.6 override; under v1.2 public side gains its own `--primary` from `brand_primary`).

**v1.2 contract:**

- `PublicShell` wraps (same as account index above) with glass pill = customer logo + name.
- Hero header: keep structure. `text-sm font-medium text-gray-500` account name above the event title — unchanged.
- Slot-picker white card: keep `rounded-2xl border bg-white shadow-sm`. Style unchanged.
- `BookingShell` is shared between the hosted page and the embed — keep as a presentation component with no shell knowledge.
- The public `[account]/[event-slug]/page.tsx` gains the `--primary` CSS var override from `brand_primary` (the Phase 12.6 pattern that was locked to owner side only is now ALSO applied to public surfaces). This makes slot selection buttons + form focus rings inherit customer color automatically via shadcn's `bg-primary` class.
- Slot button selected state: `bg-primary text-primary-foreground border-primary` — no code change needed once `--primary` is wired to `brand_primary` on the public layout.
- `brand_accent` (see section 18) does NOT change the slot selection background — it controls the slot button border color only when NOT selected (a subtle distinction). In practice this means slot buttons in unselected state gain a `border-[brand_accent]` inline style instead of `border-border`. Low visual impact — see recommendation in section 18.

---

#### 13. Embed Widget `/embed/[account]/[event-slug]`

**Current state (v1.1):** `EmbedShell` — chromeless (no nav, no pill), single gradient circle at `-top-32 left-1/2`, `BookingShell` inside, `EmbedHeightReporter`. Background: `bg-white` base with gradient circle overlay. Branding vars: `--brand-primary` + `--brand-text` CSS vars from `brand_primary`.

**v1.2 contract:**

- No glass pill header (correct — embed must stay chromeless for iframe UX).
- No "Powered by NSI" footer pill inside the embed. The mark belongs on the public hosting page, not the embed itself (it would be cropped in most iframe configurations and break the height reporting). The "Powered by NSI" mark is surfaced on the parent page that hosts the embed — out of scope for the embed itself. DECISION: embed has NO "Powered by NSI" mark.
- Background: change from `bg-white` to `bg-gray-50` (aligns the embed with the public page visual — they are the same layout, just one is chromeless). This matters for the faux booking preview in `MiniPreviewCard`.
- Single gradient circle: keep single-circle pattern (correct for small iframe canvas). Update the circle to use `brand_primary` instead of `background_color ?? brand_primary` (deprecated columns). The fallback chain simplifies: `brand_primary ?? "#0A2540"`.
- `--primary` CSS var override: wire `--primary = brand_primary` on `EmbedShell` (same as public page). This makes slot buttons inherit customer color.
- Remove references to `background_color` and `background_shade` from `EmbedShell` (deprecated columns). Remove `shade !== "none"` branch — just always render the single circle.

---

#### 14. "Powered by NSI" Footer Mark

**Current state (v1.1):** Already implemented in emails via `renderEmailFooter()` in `lib/email/branding-blocks.ts`. Web pages do NOT currently have a "Powered by NSI" footer mark — it is email-only.

**v1.2 contract (web):**

The mark appears once per public-facing page, in the footer of the page — below the main content, outside any card, centered.

Spec:
```
<footer class="py-8 text-center">
  <p class="text-xs text-gray-400">
    Powered by <a href="https://nsintegrations.com" class="hover:text-gray-600 transition-colors">North Star Integrations</a>
  </p>
</footer>
```

- Text-only on web (no `nsi-mark.png` image). The `public/nsi-mark.png` placeholder (105 bytes, solid navy) is not production-ready. Deferring the image to v1.3 when the final NSI brand mark asset exists.
- Placement: inside `PublicShell` as the last child, below `{children}`. Present on:
  - `/[account]` (account index)
  - `/[account]/[event-slug]` (booking page)
  - `/[account]/[event-slug]/confirmed/[id]` (confirmation page)
  - `/cancel/[token]` (cancellation pages)
  - `/reschedule/[token]` (reschedule pages)
- NOT in embed (`/embed/...`) — see section 13.
- NOT on owner pages (`/app/*`, `/auth/*`, `/onboarding/*`) — those are the product, not powered-by marketing.

---

#### 15. Confirmation + Cancellation + Reschedule Confirmed Pages

**Current state (v1.1):** All use `BrandedPage` wrapper.

`/[account]/[event-slug]/confirmed/[id]` — white card `rounded-lg border p-6` or `rounded-lg border p-8` with booking details. Success checkmark icon with `color-mix(in srgb, var(--brand-primary, ...) 15%, transparent)` tint.

`/cancel/[token]` — white card `rounded-lg border bg-card p-6 sm:p-8`. "Book again" CTA uses `var(--brand-primary, #0A2540)` inline style.

`/reschedule/[token]` — white card `rounded-lg border bg-card p-6 sm:p-8` with `RescheduleShell` inside.

`/[account]/[event-slug]/not-found.tsx` — bare `mx-auto max-w-xl px-6 py-24 text-center`.

**v1.2 contract:**

- All three `BrandedPage`-wrapped pages move to `PublicShell` (same as booking page).
- Cards: `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm` (standardize to `rounded-xl` + `shadow-sm`).
- `--primary = brand_primary` CSS var applied by `PublicShell` — "Book again" CTA inherits brand color automatically from `bg-primary`.
- Success checkmark circle: keep `color-mix()` pattern for the tinted icon background.
- `not-found.tsx`: add `PublicShell`-like wrapper (or simply add `BackgroundGlow` fixed at the root layout level for all public pages). The 404 is a minimal page — adding `bg-gray-50` body and centering the text is sufficient. No customer branding context (account not resolved) — use gray-50 + no blob. Consider: blank the pill header (no account context). Text: keep as-is.
- `TokenNotActive` component (used by cancel and reschedule when token is expired): currently `min-h-screen flex items-center justify-center`. v1.2: wrap in same gray-50 + centered card pattern as `not-found.tsx`.

---

### Email Side (Customer-Themed)

#### 16. 6 Transactional Emails — Header Band

**Current state (v1.1):** `renderEmailBrandedHeader()` in `lib/email/branding-blocks.ts`. Color resolution: `branding.sidebarColor ?? branding.brand_primary ?? DEFAULT_BRAND_PRIMARY`. Solid-color band with centered logo (img) or account name (bold text). Band padding: `24px 16px`. WCAG text color via `pickTextColor()`.

`EmailBranding` interface carries: `name`, `logo_url`, `brand_primary`, `backgroundColor` (ignored), `sidebarColor` (phase 12.6 priority source), `chromeTintIntensity` (deprecated).

**v1.2 contract:**

**Color priority chain simplification:** Remove `sidebarColor` as a source. New chain: `brand_primary ?? DEFAULT_BRAND_PRIMARY`. This is one of the explicit v1.2 locks from STATE.md.

`EmailBranding` interface collapses to:
```typescript
export interface EmailBranding {
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
  // brand_accent included for potential future use but not used in email header
}
```

Remove: `backgroundColor`, `sidebarColor`, `chromeTintIntensity` fields. Update all 6 senders + the reminder cron caller to pass the new slim interface.

**Header band visual:** Unchanged from v1.1 — still a solid-color `<table>` band with centered logo or text. `padding: 24px 16px`. Logo `max-width: 120px` centered. No VML, no CSS gradients. This is the correct pattern for email client compatibility — do NOT change it.

**`renderEmailBrandedHeader` update:** Replace the 3-part `??` chain with `branding.brand_primary ?? DEFAULT_BRAND_PRIMARY`. Remove `sidebarColor` optional field. No visual change to the rendered HTML.

**6 senders affected:**
- `send-booking-confirmation.ts` (booker)
- `send-booking-emails.ts` (owner notification)
- `send-cancel-emails.ts` (booker cancel + owner cancel)
- `send-reschedule-emails.ts` (booker reschedule + owner reschedule)
- `send-reminder-booker.ts` (24h reminder)
- `send-owner-notification.ts` (owner new booking)

Each sender must be updated to pass `{ name, logo_url, brand_primary }` (drop `sidebarColor`, `backgroundColor`, `chromeTintIntensity`). The `getBrandingForAccount` helper also needs its return type trimmed.

---

#### 17. "Powered by NSI" Footer Mark in Emails

**Current state (v1.1):** `renderEmailFooter()` in `lib/email/branding-blocks.ts`. Renders: `<hr>` + `<p style="font-size:12px;color:#888;text-align:center">` with optional `nsi-mark.png` `<img>` (16×16) + "Powered by " + `<a href="https://nsintegrations.com"><strong>North Star Integrations</strong></a>`.

**v1.2 contract:**

**Text-only footer, no image.** The `nsi-mark.png` placeholder is 105 bytes of solid navy — it is not a usable brand mark. Remove the `NSI_MARK_URL` conditional and the `<img>` tag. Render:

```html
<hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px 0;"/>
<p style="margin:0;font-size:12px;color:#888;text-align:center;">
  Powered by <a href="https://nsintegrations.com" style="color:#888;text-decoration:underline;"><strong>North Star Integrations</strong></a>
</p>
```

This is simpler, more reliable across email clients (no 404 image risk), and honest about the current state of the NSI brand asset. When the final mark asset ships in v1.3, it can be added back.

**Footer is present in all 6 senders** via the shared `renderEmailFooter()` call — no per-sender changes needed.

---

### Branding Controls

#### 18. `brand_accent` Semantics — RECOMMENDED ANSWER

**Option D: Drop `brand_accent` column entirely. Ship `brand_primary` only.**

**Recommendation: Option D.**

Justification:

1. **The lead-scoring reference site uses `blue-500` for everything** — primary blob, CTAs, slot buttons, focus rings. No second color. The visual language is clean because it uses one color consistently.

2. **`brand_primary` already drives everything needed** on the customer side: blob glow, CTA buttons, slot button selected state (via `--primary` CSS var override). A second color would require every component that renders a "selected" or "focus" state to be updated with an `--brand-accent` CSS var — that is non-trivial scope for uncertain value.

3. **Options A/C (slot-picker border / active tab indicator)** would mean the selected slot button has a DIFFERENT color from the booking-form submit button, creating visual incoherence unless the owner chooses complementary colors. Most trade contractors will not. The design breaks badly with poor color choices.

4. **Option B (hover state)** is auto-derivable (`blue-600` hover on `blue-500` primary) and not worth a DB column.

5. **Real-world usage:** NSI is selling to trade contractors (plumbers, HVAC). Giving them TWO brand colors to configure is more decisions, more support burden, and more chance of ugly results. One color is the right UX for this market.

6. **Schema simplicity:** Dropping `brand_accent` means the `accounts` table gets ONE column added in v1.2 (none — `brand_primary` already exists) and several deprecated columns dropped. Adding a column to then DROP it in v1.3 is unnecessary thrash.

**Action:** Do not add `brand_accent` column. Do not add `brand_accent` picker to branding editor. The v1.2 branding editor controls are: logo + brand_primary (2 items, not 3). Remove `brand_accent` from all v1.2 scope documents.

---

#### 19. Logo Handling

**Current state (v1.1):** `accounts.logo_url` (Supabase Storage public URL). `LogoUploader` in branding editor. Rendered at `max-width: 120px, max-height: 60px` in all contexts.

**v1.2 contract:**

- Column: `accounts.logo_url` — unchanged.
- Constraints (NO enforcement change for v1.2 — these are guidance in the UI copy only):
  - Format guidance: PNG or SVG preferred (transparent background renders well on white cards and on colored email bands).
  - Max file size: 2 MB (enforced by `LogoUploader` already).
  - Aspect ratio: no enforcement. Wide horizontal logos (e.g. "NSI PLUMBING") render fine at `max-width: 120px`. Square logos also fine. The CSS `max-width: 120px max-height: 60px height: auto width: auto` handles both gracefully.
  - No server-side resize in v1.2 (defer to v1.3 if needed).
- Usage surfaces:
  - Glass header pill on public booking page: `max-height: 40px` (slightly smaller than email to fit the `h-14` pill). This is the one sizing change from v1.1 (booking page logo was in `BrandedPage` header at `max-height: 60px` — the new pill is shorter, so `max-height: 40px` fits cleanly).
  - Email header band: `max-width: 120px height: auto` centered on the band — unchanged.
  - Account index listing hero: `h-16 w-auto` (unchanged from v1.1 `ListingHero`).
  - Branding editor logo uploader: preview thumbnail — unchanged.
  - `MiniPreviewCard` faux booking page: `max-height: 20px` (tiny, for scale representation).

---

## Feature Categorization

### Table Stakes (Must Have for v1.2 to Ship)

These are the minimum for the v1.2 milestone goal ("NSI Brand Lock-Down + UI Overhaul") to be meaningful.

| Item | Surface | Complexity |
|------|---------|------------|
| Strip `--primary` per-account override from `(shell)` layout | Owner shell | LOW |
| Strip `sidebarColor` + `sidebarTextColor` props from `AppSidebar` | Owner shell + sidebar | LOW |
| Vendor `BackgroundGlow` component with optional `color` prop | Global shared component | LOW |
| Add full `Header` pill component (`NorthStar` wordmark) to owner shell | Owner shell | MEDIUM |
| Add customer-branded glass pill (logo + name) to `PublicShell` | Public shell | MEDIUM |
| Create `PublicShell` component (replacing `BrandedPage` + `GradientBackdrop`) | Shared public | MEDIUM |
| Wire `--primary = brand_primary` on public page layout | Public shell | LOW |
| Re-skin auth pages: `BackgroundGlow` in hero aside + `Header` pill | Auth pages (7 pages) | MEDIUM |
| Re-skin onboarding layout: `bg-gray-50` + `Header` pill + progress bar | Onboarding layout | MEDIUM |
| Re-skin `account-deleted` page: card pattern + `Header` pill | account-deleted | LOW |
| Simplify `BrandingEditor`: remove 3 deprecated pickers (sidebar/background/shade) | Branding editor | MEDIUM |
| Rebuild `MiniPreviewCard` as faux public booking page | Branding editor | MEDIUM |
| Simplify `EmailBranding` interface: drop `sidebarColor`, `backgroundColor`, `chromeTintIntensity` | Email layer | MEDIUM |
| Update `renderEmailBrandedHeader()` priority chain to `brand_primary ?? DEFAULT` | Email layer | LOW |
| Update all 6 senders to pass new slim `EmailBranding` | Email layer | MEDIUM |
| Add "Powered by NSI" text footer to `PublicShell` (web) | Public pages | LOW |
| Simplify `renderEmailFooter()`: remove `nsi-mark.png` image tag | Email layer | LOW |
| Standardize card classes to `rounded-xl border border-gray-200 bg-white p-6 shadow-sm` across owner pages | All owner pages | MEDIUM |
| Fix `HomeCalendar` dot color: remove `--brand-primary` fallback var | Home calendar | LOW |
| Schema DROP migration: remove `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` columns + `chromeTintToCss` compat export | Schema cleanup | MEDIUM |
| Update `saveBrandingAction` signature to `{ logoUrl, brandPrimary }` | Branding actions | LOW |

### Capability-Tier (Should Have — Defer if Scope Cuts)

| Item | Surface | Complexity | Why Deferrable |
|------|---------|------------|----------------|
| `Header` pill right-side context label (e.g. "Dashboard", "Setup") on owner side | Owner shell + onboarding | LOW | Nice UX but not visible blocking |
| Logo sizing in glass pill scaled to `max-height: 40px` (vs 60px in email) | Public pill | LOW | Works at 60px too, just less optically balanced |
| `not-found.tsx` and `TokenNotActive` page background update to gray-50 card | Public 404/expired-token pages | LOW | Not a primary customer-facing flow |
| Standardize `rounded-lg` to `rounded-xl` + `shadow-sm` on existing owner pages | Owner detail pages | LOW | Existing `rounded-lg` is close enough |

### Anti-Features (NOT Building in v1.2)

| Anti-Feature | Why Not |
|---|---|
| `brand_accent` column + picker | See section 18 — drops. One color is correct for this market. |
| Custom CSS white-label | Out of scope for all v1.x per PROJECT.md |
| NSI mark image (`nsi-mark.png`) in emails or on web | Placeholder asset is not production-ready. Defer to v1.3 when final NSI mark exists. |
| "Powered by NSI" mark inside the embed iframe | Would be cropped and interfere with height reporting. Text-only footer belongs on hosted pages only. |
| Changing sidebar IA (adding/removing items) | IA locked per v1.2 scoping. Visual re-skin only. |
| Adding new functional capabilities to any page | v1.2 is visual-only. No new routes, no new data models beyond schema cleanup. |
| Multiple booking page themes / theme picker | v1.x uses single unified visual language. Customer controls only blob color (brand_primary). |
| Dark mode | No requirement, significant added complexity. |
| AOS scroll-reveal animations | Lead-scoring uses them; booking pages are short single-screen flows — AOS adds no value and risks embed height-reporting issues. |
| Per-event-type branding | Account-level branding only for v1.x. |

---

## Feature Dependencies

```
BackgroundGlow component (parameterized color prop)
    └──required by──> PublicShell (customer-tinted blob)
    └──required by──> Owner shell (NSI blue blob)
    └──required by──> Auth pages (NSI blue blob in hero aside)
    └──required by──> Onboarding layout (NSI blue blob)

PublicShell component
    └──required by──> /[account] index page
    └──required by──> /[account]/[event-slug] booking page
    └──required by──> /[account]/[event-slug]/confirmed/* page
    └──required by──> /cancel/[token] page
    └──required by──> /reschedule/[token] page
    └──includes──> "Powered by NSI" footer mark

--primary = brand_primary CSS var override
    └──required by──> Slot button selected state (bg-primary)
    └──required by──> Booking form CTA button (bg-primary)
    └──applies in──> PublicShell (public pages only, NOT owner shell)

EmailBranding interface simplification
    └──required by──> all 6 transactional senders
    └──blocks──> Schema DROP migration (must update callers before dropping columns)

Schema DROP migration
    └──depends on──> EmailBranding callers updated
    └──depends on──> BrandingEditor pickers removed
    └──depends on──> Phase 12.5 tests deleted (chromeTintToCss test references)
    └──must be──> LAST phase of v1.2
```

---

## Sources

- Direct code inspection: all TSX files under `calendar-app/app/` (2026-04-30)
- Reference component: `lead-scoring-with-tools/website-analysis-tools/app/components/BackgroundGlow.tsx`
- Reference component: `lead-scoring-with-tools/website-analysis-tools/app/components/Header.tsx`
- Reference layout: `lead-scoring-with-tools/website-analysis-tools/app/dashboard/layout.tsx`
- Reference page: `lead-scoring-with-tools/website-analysis-tools/app/free-audit/page.tsx` (lines 274+)
- State locks: `.planning/STATE.md` (v1.2 Visual Locks section, verified 2026-04-30)
- Scope locks: `.planning/PROJECT.md` (Current Milestone: v1.2 section)
- Email branding: `calendar-app/lib/email/branding-blocks.ts` (full file read)
- Branding types: `calendar-app/lib/branding/types.ts`

---
*Feature research for: calendar-app v1.2 — NSI Brand Lock-Down + UI Overhaul*
*Researched: 2026-04-30*
*Confidence: HIGH — all findings from direct code inspection of shipped v1.1 codebase*
