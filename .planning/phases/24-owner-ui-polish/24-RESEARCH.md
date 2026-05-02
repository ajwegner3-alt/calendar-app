# Phase 24: Owner UI Polish - Research

**Researched:** 2026-05-02
**Domain:** Next.js / Tailwind CSS / shadcn calendar / clipboard API
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

Both fixes are surgical and well-bounded. OWNER-12 (calendar de-orange) requires changes to a single component (`home-calendar.tsx`) only — no globals.css token swap is needed because the home calendar's custom `DayButton` already does NOT reference `--color-accent` or `bg-accent` for day fills; the only orange exposure is the `hover:bg-accent hover:text-accent-foreground` class on hover, plus the booking-dot `hsl(var(--primary))` style. The `--color-accent: #F97316` token in `globals.css` also feeds the `.day-has-slots` public booking calendar dot, so that token must NOT be swapped project-wide; only the per-instance className in `home-calendar.tsx` needs updating.

OWNER-13 (booking-link field) has a clear threading path: the `edit/page.tsx` server component already fetches the event type row; it just needs to also query the account slug using the same `current_owner_account_ids` RPC pattern used in `event-types/page.tsx`. The slug is then passed as a prop to `EventTypeForm`. The existing `UrlPreview` component (a placeholder with hardcoded `yoursite.com/nsi/[slug]`) is removed and replaced by a new inline copyable field. The host source is `NEXT_PUBLIC_APP_URL` (it is set in `.env.example` and used consistently across the codebase for server-side URL construction; for the client-rendered live-update, `window.location.origin` is the fallback pattern already used in `slug-form.tsx`). The copy-confirmation pattern should follow `embed-tabs.tsx` (icon-state swap, no toast for success, `navigator.clipboard.writeText` with `execCommand` fallback).

**Primary recommendation:** Treat both fixes as fully self-contained component edits. Zero schema changes, zero shared-component touches.

---

## Standard Stack

### Core (already in project — no installs needed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| lucide-react | ^1.8.0 | Icons (Copy, Check available) | Already used |
| react-day-picker | v9 (via shadcn) | Calendar backing | Already used |
| react-hook-form | present | Form state / `watch` | Already used |
| navigator.clipboard | Web API | Clipboard write | Used in embed-tabs.tsx |

**No new packages needed for either fix.**

---

## Architecture Patterns

### OWNER-12: Home Calendar Orange Removal

**File:** `app/(shell)/app/_components/home-calendar.tsx`

The `HomeCalendar` component renders a shadcn `<Calendar>` with a **fully custom `DayButton` component** passed via the `components` prop. This is the complete source of day-button styling. The shared `components/ui/calendar.tsx` `CalendarDayButton` is NOT used at all — the `components.DayButton` override in `HomeCalendar` replaces it entirely.

**Current orange sources (both in `home-calendar.tsx` lines 73 and 98-100):**

1. **Hover state** — `"hover:bg-accent hover:text-accent-foreground"` at line 73. This resolves to `--color-accent: #F97316` (set in `globals.css` `@theme` block at line 148). This is the primary orange source on hover.

2. **Booking dots** — `style={{ backgroundColor: isSelected ? "currentColor" : "hsl(var(--primary))" }}` at lines 98-100. `--primary` is NSI blue (`oklch(0.606 0.195 264.5)` = `#3B82F6`), NOT orange. So dots are blue/white, not orange.

**Blast-radius analysis for `--color-accent: #F97316` in globals.css:**

The `--color-accent` token is consumed in:
- `home-calendar.tsx` — `hover:bg-accent` (the target)
- `bookings-table.tsx` — `hover:bg-accent/50` (table row hover — would also turn grey if swapped globally)
- `cancel-confirm-form.tsx` — `hover:bg-accent` (button hover)
- `globals.css` `.day-has-slots::after` — `background: var(--color-accent)` (public booking calendar slot dots — MUST stay orange/accent)

**Verdict: Do NOT swap `--color-accent` in globals.css.** The `.day-has-slots` selector uses it on the public booking calendar, and the bookings table and cancel form rows also rely on it for hover states. Instead, override only in `home-calendar.tsx` by replacing `"hover:bg-accent hover:text-accent-foreground"` with `"hover:bg-muted hover:text-foreground"` (or a specific grey shade).

**Today and selected state (current implementation):**

```
// Lines 75-79 of home-calendar.tsx
isSelected
  ? "bg-primary text-primary-foreground"   // blue fill
  : modifiers.today
    ? "bg-muted text-foreground"           // grey muted background
    : ""
```

- Selected = NSI blue (`--primary`). Decision: replace with grey.
- Today = `bg-muted` (already grey: `oklch(0.97 0 0)` = near-white grey). This is already neutral. A subtle ring or `font-semibold` could differentiate it from unselected days without adding color.

**Has-bookings indicator (current implementation):**

The dot is already rendered below the day number. Color is `hsl(var(--primary))` (blue) when not selected, `currentColor` (white) when selected. Under the all-grey decision, dots should become a fixed grey (e.g., `#9CA3AF` / `text-gray-400`).

**What to change (surgical, within home-calendar.tsx only):**

| Element | Current | Replace With |
|---------|---------|--------------|
| Hover | `hover:bg-accent hover:text-accent-foreground` | `hover:bg-muted hover:text-foreground` |
| Selected fill | `bg-primary text-primary-foreground` | `bg-gray-800 text-white` or `bg-gray-200 text-gray-900` |
| Today affordance | `bg-muted text-foreground` | Add `font-semibold` or `ring-1 ring-gray-400 bg-muted` |
| Dot color (not selected) | `hsl(var(--primary))` inline style | `#9CA3AF` (gray-400) inline style |
| Dot color (selected) | `currentColor` | `currentColor` (keep — adapts to selected bg) |

**Recommendation for selected:** Use `bg-gray-700 text-white` — dark grey, clearly selected, no brand color.
**Recommendation for today:** `ring-1 ring-gray-400 rounded-[var(--cell-radius,var(--radius-md))] font-medium` — subtle ring differentiates without brand color.

---

### OWNER-13: Copyable Booking-Link Field

**Edit page server component:** `app/(shell)/app/event-types/[id]/edit/page.tsx`
- This is an async Server Component that fetches the event type row.
- It does NOT currently fetch the account slug.
- It passes `eventType` and `defaultValues` to `<EventTypeForm>`.

**Account slug threading — confirmed pattern:**

`event-types/page.tsx` (lines 28-38) shows the exact query pattern:
```typescript
const { data: accountIds } = await supabase.rpc("current_owner_account_ids");
const ids = Array.isArray(accountIds) ? accountIds : [];
let accountSlug = "nsi"; // safe fallback
if (ids.length > 0) {
  const { data: account } = await supabase
    .from("accounts")
    .select("slug")
    .eq("id", ids[0])
    .maybeSingle();
  if (account?.slug) accountSlug = account.slug;
}
```

This is the canonical pattern. Add it to `edit/page.tsx` and pass `accountSlug` as a new prop to `EventTypeForm`.

**`EventTypeForm` current prop signature:**
```typescript
export function EventTypeForm({
  mode,
  eventTypeId,
  defaultValues,
}: {
  mode: FormMode;
  eventTypeId?: string;
  defaultValues?: EventTypeInput;
})
```

Add `accountSlug: string` to the prop signature.

**Existing `UrlPreview` component:**
- File: `app/(shell)/app/event-types/_components/url-preview.tsx`
- Used in `event-type-form.tsx` line 272: `<UrlPreview slug={currentSlug} />`
- Shows placeholder: `yoursite.com/nsi/[slug]`
- Props: `{ slug: string }`
- Decision: **delete or repurpose** this file entirely and replace the `<UrlPreview>` call site.

**Host source recommendation: `NEXT_PUBLIC_APP_URL` with `window.location.origin` fallback**

`NEXT_PUBLIC_APP_URL` is set in `.env.example` (line 68: `NEXT_PUBLIC_APP_URL=https://calendar-app-xi-smoky.vercel.app`) and is used consistently for URL construction throughout the codebase (auth actions, booking actions, widget route, event-types list page). For the client component, `process.env.NEXT_PUBLIC_APP_URL` is accessible since it has the `NEXT_PUBLIC_` prefix. Use it as primary; fall back to `window.location.origin` if undefined (matches the pattern in `slug-form.tsx` line 63).

Concretely in the new copyable field component:
```typescript
const host =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  (typeof window !== "undefined" ? window.location.origin : "");
const bookingUrl = `${host}/${accountSlug}/${currentSlug || "your-slug"}`;
```

**Public booking URL route — confirmed:**

`app/[account]/[event-slug]/page.tsx` exists, so the URL pattern is `/<account-slug>/<event-slug>`. This matches the `appUrl/accountSlug/eventSlug` pattern used in `embed-code-dialog.tsx` and `event-types-table.tsx`.

**Copy-confirmation pattern (prior art in this codebase):**

`embed-tabs.tsx` is the closest analog:
- `useState(false)` for `copied`
- `navigator.clipboard.writeText(text)` → `setCopied(true)` → `setTimeout(() => setCopied(false), 2000)`
- `execCommand('copy')` fallback (legacy HTTPS-less environments)
- On total failure: `toast.error("Copy failed — select the text manually")`

The decision requires icon flip (Copy → Check) for ~1.5s. `embed-tabs.tsx` uses text swap ("Copy snippet" → "Copied!"). The icon-flip variant uses the same `copied` boolean; render `<Check>` when `copied`, `<Copy>` otherwise.

**Check icon availability:** `Check` is in `lucide-react` (same package, version ^1.8.0) but is NOT currently imported anywhere in the project. It is a standard lucide icon — confirmed available. `Copy` is already imported in `copy-from-menu.tsx`.

**Clipboard-failure handling recommendation:** Match `day-detail-row.tsx` pattern for the owner context — show a fallback read-only input containing the URL pre-selected (better UX than toast for a URL that the owner needs to manually copy). Alternatively, match `embed-tabs.tsx` simplicity with `toast.error`. Given the CONTEXT decision says "Claude's discretion," use the simpler `toast.error("Copy failed — select the text manually")` to keep the component lean.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard write | Custom clipboard abstraction | `navigator.clipboard.writeText` + `execCommand` fallback | Already proven in embed-tabs.tsx |
| Account slug fetch | New RPC or auth context hook | Same `current_owner_account_ids` RPC + accounts query | Pattern already proven in event-types/page.tsx |
| Copy icon | Custom SVG | `Copy` and `Check` from `lucide-react` | Package already installed |
| Host URL | Hard-coded origin | `NEXT_PUBLIC_APP_URL` env var | Already set, used consistently |

---

## Common Pitfalls

### Pitfall 1: Swapping `--color-accent` globally
**What goes wrong:** Changing `--color-accent: #F97316` in `globals.css` also changes `.day-has-slots::after` background (public booking calendar dots) and hover states in `bookings-table.tsx` and `cancel-confirm-form.tsx`.
**How to avoid:** Only change the `hover:bg-accent` className inside `home-calendar.tsx`. Do not touch `globals.css`.

### Pitfall 2: Using `bg-primary` for the selected day grey
**What goes wrong:** `--primary` is NSI blue (`#3B82F6`), not grey. Replacing `bg-primary text-primary-foreground` with another token-based class risks pulling in another brand color.
**How to avoid:** Use explicit Tailwind grey scale classes (`bg-gray-700 text-white` for selected, `bg-gray-100` for muted states) rather than semantic tokens that map to brand colors.

### Pitfall 3: Forgetting `NEXT_PUBLIC_APP_URL` is a build-time constant
**What goes wrong:** `process.env.NEXT_PUBLIC_APP_URL` is inlined at build time. In dev it may differ from production origin.
**How to avoid:** The `window.location.origin` fallback handles dev correctly. The combined pattern `NEXT_PUBLIC_APP_URL ?? window.location.origin` is already used in `slug-form.tsx`.

### Pitfall 4: Touching shared `components/ui/calendar.tsx`
**What goes wrong:** Breaks the public booker calendar (Phase 23) and the availability overrides calendar.
**How to avoid:** Only modify `home-calendar.tsx`. The custom `DayButton` override in that file is fully independent of the shared component.

### Pitfall 5: Placing the booking-link field below the slug field
**What goes wrong:** The CONTEXT decision says "above the existing header (or as first form section)."
**How to avoid:** In `edit/page.tsx`, render the booking-link field (or a wrapper component) above the `<header>` block. In `event-type-form.tsx`, the field can be rendered as the first element inside the `<form>` tag — before the Name field.

### Pitfall 6: Rendering `UrlPreview` and the new field simultaneously
**What goes wrong:** Two booking URL displays, one real and one with placeholder text, causes confusion.
**How to avoid:** Remove the `<UrlPreview slug={currentSlug} />` call at line 272 of `event-type-form.tsx` when adding the new field. The `url-preview.tsx` file can be deleted outright.

---

## Code Examples

### Grey day-button — replacing orange accent in home-calendar.tsx
```typescript
// Source: direct codebase inspection — home-calendar.tsx lines 70-86
// BEFORE:
"hover:bg-accent hover:text-accent-foreground",
isSelected
  ? "bg-primary text-primary-foreground"
  : modifiers.today
    ? "bg-muted text-foreground"
    : "",

// AFTER (all grey, no brand color):
"hover:bg-gray-100 hover:text-gray-900",
isSelected
  ? "bg-gray-700 text-white"
  : modifiers.today
    ? "bg-muted text-foreground font-semibold ring-1 ring-gray-300 rounded-[var(--cell-radius,var(--radius-md))]"
    : "",
```

### Booking dot colour — replacing blue primary with grey
```typescript
// Source: home-calendar.tsx lines 97-100
// BEFORE:
style={{ backgroundColor: isSelected ? "currentColor" : "hsl(var(--primary))" }}

// AFTER:
style={{ backgroundColor: isSelected ? "currentColor" : "#9CA3AF" }}
// #9CA3AF = Tailwind gray-400 — neutral, visible, not a brand color
```

### Account slug fetch pattern for edit/page.tsx
```typescript
// Source: event-types/page.tsx lines 28-38
const { data: accountIds } = await supabase.rpc("current_owner_account_ids");
const ids = Array.isArray(accountIds) ? accountIds : [];
let accountSlug = "nsi"; // safe fallback
if (ids.length > 0) {
  const { data: account } = await supabase
    .from("accounts")
    .select("slug")
    .eq("id", ids[0])
    .maybeSingle();
  if (account?.slug) accountSlug = account.slug;
}
```

### Copy-with-icon-flip pattern (based on embed-tabs.tsx prior art)
```typescript
// Source: embed-tabs.tsx lines 51-82 — adapted for icon flip
import { Copy, Check } from "lucide-react";

const [copied, setCopied] = useState(false);

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = bookingUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed — select the text manually");
    }
  }
}

// Render:
<button type="button" onClick={handleCopy}>
  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
</button>
```

### Booking URL construction (client component)
```typescript
// Source: slug-form.tsx line 63 + env.example line 68 patterns combined
const host =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  (typeof window !== "undefined" ? window.location.origin : "");
const bookingUrl = `${host}/${accountSlug}/${currentSlug || "your-slug"}`;
```

---

## Open Questions

1. **New component vs. inline JSX for the booking-link field**
   - What we know: `UrlPreview` is a separate component file. The new field is more complex (client state for copy).
   - Recommendation: Create a new `BookingLinkField` client component in `event-types/_components/`. This keeps `event-type-form.tsx` from growing and makes the copy logic testable in isolation.

2. **`UrlPreview` file disposal**
   - What we know: It is imported only in `event-type-form.tsx` line 34 and used at line 272.
   - Recommendation: Delete `url-preview.tsx` outright. Remove the import from `event-type-form.tsx`. No other consumers exist.

---

## Sources

### Primary (HIGH confidence — direct file inspection)
- `app/(shell)/app/_components/home-calendar.tsx` — full DayButton implementation
- `app/globals.css` — full CSS token definitions and accent usage
- `app/(shell)/app/event-types/[id]/edit/page.tsx` — edit page server component
- `app/(shell)/app/event-types/_components/event-type-form.tsx` — form component
- `app/(shell)/app/event-types/_components/url-preview.tsx` — existing placeholder component
- `app/(shell)/app/event-types/page.tsx` — account slug fetch pattern
- `app/(shell)/app/event-types/_components/embed-tabs.tsx` — copy-with-confirmation prior art
- `app/(shell)/app/_components/day-detail-row.tsx` — clipboard fallback prior art
- `components/ui/calendar.tsx` — shared calendar component (confirmed off-limits, custom DayButton overrides it)
- `.env.example` — NEXT_PUBLIC_APP_URL confirmed set
- `package.json` — lucide-react ^1.8.0 confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries confirmed present
- Architecture: HIGH — all file paths verified, all patterns inspected directly
- Pitfalls: HIGH — blast radius verified by grepping all accent consumers
- Code examples: HIGH — derived from existing code in the repo

**Research date:** 2026-05-02
**Valid until:** 60 days (stable codebase, no fast-moving dependencies involved)
