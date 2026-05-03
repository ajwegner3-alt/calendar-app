---
phase: 24-owner-ui-polish
plan: 02
subsystem: ui
tags: [react, react-hook-form, clipboard-api, lucide-react, shadcn, supabase, nextjs-server-components]

# Dependency graph
requires:
  - phase: 09-event-types
    provides: EventTypeForm + edit/page.tsx server component scaffolding
  - phase: 17-account-slug
    provides: current_owner_account_ids RPC + accounts.slug lookup pattern (pattern source = event-types/page.tsx)
  - phase: 12-embed
    provides: Copy-with-icon-flip pattern (embed-tabs.tsx) + execCommand fallback recipe
provides:
  - BookingLinkField client component (reusable copyable URL field, code-block style, Copy → Check icon flip ~1.5s)
  - Per-row copy-link button on event-types list page (RowCopyLinkButton)
  - Blue per-instance focus override on event-types row-actions dropdown items
  - accountSlug threading from edit/page.tsx + new/page.tsx server components into EventTypeForm
affects: [event-types, public-booking, embed, future-owner-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational copy-field client component takes eventSlug as a PROP (not via context/watch). Parent owns react-hook-form state and passes watch('slug') in. Keeps the component reusable and testable."
    - "Host derivation: `process.env.NEXT_PUBLIC_APP_URL?.replace(/\\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')` — server-rendered host with client fallback. NO hard-coded vercel hosts."
    - "Per-instance className focus override on shared shadcn DropdownMenuItem (`focus:bg-primary focus:text-primary-foreground`) avoids editing the shared `components/ui/dropdown-menu.tsx` — extends the established pattern from Phase 23 calendar instance overrides."
    - "Required-prop type forces server-component conversion: making `accountSlug` required on EventTypeForm flushed out the create page consumer (new/page.tsx) which had to be converted from sync stub to async server component fetching the slug."

key-files:
  created:
    - "app/(shell)/app/event-types/_components/booking-link-field.tsx"
    - "app/(shell)/app/event-types/_components/row-copy-link-button.tsx"
  modified:
    - "app/(shell)/app/event-types/[id]/edit/page.tsx"
    - "app/(shell)/app/event-types/new/page.tsx"
    - "app/(shell)/app/event-types/_components/event-type-form.tsx"
    - "app/(shell)/app/event-types/_components/event-types-table.tsx"
    - "app/(shell)/app/event-types/_components/row-actions-menu.tsx"
  deleted:
    - "app/(shell)/app/event-types/_components/url-preview.tsx"

key-decisions:
  - "Render BookingLinkField as the FIRST form section (inside the form) instead of as a sibling above <header>. This satisfies the CONTEXT lock 'above the existing <header> (or as the first form section)' AND keeps `currentSlug = watch('slug')` in the same component scope — no state lifting, no prop drilling, live-update is free."
  - "Make `accountSlug: string` REQUIRED (no `?`) on EventTypeForm. Forces every consumer (edit + new) to fetch and pass it; TypeScript catches missing call sites at build time."
  - "Convert app/(shell)/app/event-types/new/page.tsx to async server component fetching accountSlug, mirroring the edit page pattern. Required by the now-mandatory prop (deviation Rule 3 — blocking)."
  - "Add per-row RowCopyLinkButton on the event-types list page (mid-checkpoint user request). Single-click copy without opening the edit page; Copy → Check icon flip ~1.5s; hidden on archived rows. Reuses the same host-derivation pattern as BookingLinkField."
  - "Change row-actions dropdown focus highlight from default orange to NSI blue via per-instance `focus:bg-primary focus:text-primary-foreground` overrides on each non-destructive DropdownMenuItem. Archive item retains destructive red `focus:text-destructive` (correct semantic for irreversible action). Shared `components/ui/dropdown-menu.tsx` UNTOUCHED — per-instance override pattern (matches Phase 23 calendar invariant)."

patterns-established:
  - "Copyable URL field: useState<boolean> copied + setTimeout(1500) revert + execCommand fallback + toast.error only on total failure. No success toast (CONTEXT 'no toast pollution' lock). Mirrors embed-tabs.tsx pattern."
  - "Per-row action button (copy-link-on-list-row): Sibling to the existing kebab dropdown, rendered inline on each non-archived row. Matches the at-a-glance utility expectation — owner shouldn't need to drill into edit/[id] to grab a sendable URL."
  - "Per-instance shadcn override for dropdown focus state: Apply `focus:bg-primary focus:text-primary-foreground` directly on each DropdownMenuItem in a specific menu instead of editing the shared component. Extends the Phase 23 calendar invariant ('shared component stays untouched; per-instance className handles local divergence') to dropdown menus."

# Metrics
duration: ~50 min (Tasks 1+2 ~25 min; mid-checkpoint deviation ~15 min; live-deploy verify wait excluded)
completed: 2026-05-02
---

# Phase 24 Plan 02: Copyable Booking-Link Field Summary

**Live copyable per-event booking-URL field at the top of the event-type edit form, plus a per-row copy-link button on the event-types list, plus blue dropdown focus highlights — closing OWNER-13 and replacing the v1.0 `UrlPreview` placeholder.**

## Performance

- **Duration:** ~50 min (code work; live-deploy wait excluded)
- **Started:** 2026-05-02
- **Completed:** 2026-05-02
- **Tasks:** 3 (Task 1 + Task 2 + checkpoint Task 3) + 1 mid-checkpoint deviation cycle
- **Files created:** 2 (booking-link-field.tsx, row-copy-link-button.tsx)
- **Files modified:** 5 (edit/page.tsx, new/page.tsx, event-type-form.tsx, event-types-table.tsx, row-actions-menu.tsx)
- **Files deleted:** 1 (url-preview.tsx)

## Accomplishments

- New `BookingLinkField` client component renders as the first form section on `/app/event-types/[id]/edit` — code-block style with monospace URL on the left and a Copy → Check icon-flip button on the right.
- URL live-updates as the owner types in the slug input (component reads `eventSlug` prop, parent passes `watch('slug')`).
- Old `yoursite.com/nsi/[slug]` `UrlPreview` placeholder fully removed (file deleted, import removed, call site removed).
- Account slug threaded server-side via `current_owner_account_ids` RPC + `accounts.slug` query in BOTH edit and new server pages.
- Mid-checkpoint user-driven additions (deviation): per-row `RowCopyLinkButton` on the event-types list page (single-click copy without opening edit) + blue NSI-brand focus highlight on the row-actions dropdown items.
- Build clean, 222 tests pass + 4 skipped, live-deploy approved by Andrew.

## Task Commits

1. **Task 1: Create BookingLinkField client component** — `4d12d25` (feat)
2. **Task 2: Wire BookingLinkField into edit/page.tsx + event-type-form.tsx; delete UrlPreview** — `f10de12` (feat) — also includes the new/page.tsx server-component conversion (deviation Rule 3, see below).
3. **Mid-checkpoint deviation: per-row copy-link button + blue dropdown focus** — `db7fb62` (fix) — driven by Andrew's checkpoint feedback before final approval.
4. **Task 3: Live-deploy human-verify** — APPROVED by Andrew (verbal, no commit).

**Plan metadata:** _(this commit — `docs(24-02): complete copyable-booking-link-field plan`)_

## Files Created/Modified

### Created

- `app/(shell)/app/event-types/_components/booking-link-field.tsx` — Client component. Props: `{ accountSlug: string; eventSlug: string }`. Computes `host = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')`. Builds `bookingUrl = ${host}/${accountSlug}/${eventSlug || 'your-slug'}`. Renders shadcn `<Card>` with `bg-muted/40 border-dashed`, "Booking URL" label, monospace URL, and `type="button"` copy button. Copy handler uses `navigator.clipboard.writeText` with document.execCommand textarea fallback, `setCopied(true)` then `setTimeout(() => setCopied(false), 1500)`, `toast.error` only on total failure (no success toast — CONTEXT "no toast pollution" lock). Icon flips Copy → Check while `copied === true`.

- `app/(shell)/app/event-types/_components/row-copy-link-button.tsx` — Client component (added in `db7fb62`). Same host-derivation pattern as BookingLinkField. Single-click copy on each event-types list row. Renders a small icon-only button with Copy → Check flip ~1.5s. Hidden on archived rows.

### Modified

- `app/(shell)/app/event-types/[id]/edit/page.tsx` — Server component now fetches `accountSlug` after the existing `event_types` query: `supabase.rpc("current_owner_account_ids")` → `accounts.select('slug').eq('id', ids[0]).maybeSingle()` with `"nsi"` fallback (matches event-types/page.tsx pattern lines 28-38). Passes `accountSlug={accountSlug}` into `<EventTypeForm>`.

- `app/(shell)/app/event-types/new/page.tsx` — **DEVIATION (Rule 3 — blocking).** Was a sync stub previously. Converted to async server component using the same `accountSlug` fetch pattern as edit/page.tsx. Required because `accountSlug: string` is now mandatory on EventTypeForm. Without this conversion the build fails on missing prop.

- `app/(shell)/app/event-types/_components/event-type-form.tsx` — Removed `UrlPreview` import + call site. Added `BookingLinkField` import. Updated prop signature to require `accountSlug: string`. Renders `<BookingLinkField accountSlug={accountSlug} eventSlug={currentSlug} />` as the FIRST element inside the form (currentSlug already exists via `watch("slug")`). Slug-change warning Alert and `register("slug")` wiring untouched.

- `app/(shell)/app/event-types/_components/event-types-table.tsx` — Added `<RowCopyLinkButton>` adjacent to the existing kebab/dropdown trigger on each non-archived row. (Mid-checkpoint deviation `db7fb62`.)

- `app/(shell)/app/event-types/_components/row-actions-menu.tsx` — Per-instance focus overrides on each non-destructive `<DropdownMenuItem>`: Edit, Make active, Make inactive, Get embed code, Restore. Each gained `focus:bg-primary focus:text-primary-foreground` (NSI blue). Archive item retained `focus:text-destructive` (correct semantic for the only irreversible action). Shared `components/ui/dropdown-menu.tsx` UNTOUCHED. (Mid-checkpoint deviation `db7fb62`.)

### Deleted

- `app/(shell)/app/event-types/_components/url-preview.tsx` — CONTEXT lock "Replace UrlPreview, don't duplicate." Removed via `git rm` as part of Task 2's commit (`f10de12`).

## Decisions Made

- **First form section, not above-header.** CONTEXT.md offered both. Chose first-form-section because `currentSlug = watch("slug")` already lives in EventTypeForm — rendering BookingLinkField there means zero state lifting and zero new prop-drilling for live-update. The owner still sees the URL field immediately on landing because it's the topmost element inside the form (the form sits directly under the page `<header>`).
- **Required `accountSlug` prop.** Made the prop required (no `?`) so TypeScript flushes out any consumer that doesn't pass it. This caught new/page.tsx at build time (deviation Rule 3 — see below).
- **Presentational booking-link component.** BookingLinkField does NOT read from a parent context or `watch("slug")` itself. It takes `eventSlug` as a prop. Keeps it reusable (e.g., for the per-row list-page button later), testable, and free of react-hook-form coupling.
- **No success toast.** CONTEXT lock — only the icon flip is the success signal. `toast.error` only fires on total clipboard failure (both `navigator.clipboard.writeText` AND the execCommand fallback failed).
- **Per-instance dropdown override (mid-checkpoint).** Andrew asked for blue (not orange) focus highlights on the row-actions dropdown items. Applied per-instance `focus:bg-primary focus:text-primary-foreground` on each non-destructive DropdownMenuItem rather than editing the shared `components/ui/dropdown-menu.tsx`. Archive's destructive red focus state preserved. Pattern matches Phase 23 calendar invariant ("shared shadcn component untouched; per-instance className handles local divergence").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Convert `new/page.tsx` to async server component**

- **Found during:** Task 2 (`<EventTypeForm>` consumer audit via `grep -rn '<EventTypeForm' app/`).
- **Issue:** `app/(shell)/app/event-types/new/page.tsx` was a sync stub rendering `<EventTypeForm mode="create" />` without `accountSlug`. Making `accountSlug: string` required would fail the TypeScript build with "Property 'accountSlug' is missing in type ..." on this page.
- **Fix:** Converted new/page.tsx to async server component. Added the same `current_owner_account_ids` RPC + `accounts.slug` fetch as edit/page.tsx. Passed `accountSlug={accountSlug}` into `<EventTypeForm mode="create" accountSlug={accountSlug} />`. Plan-aware — Task 2's "Other call sites of EventTypeForm" sub-step explicitly anticipated this with: "If a `create` page also renders `<EventTypeForm>`, it must ALSO be updated to fetch `accountSlug`... using the SAME pattern as Edit 1 above."
- **Files modified:** app/(shell)/app/event-types/new/page.tsx
- **Verification:** `npm run build` clean, `npm test -- --run` 222 passing.
- **Committed in:** `f10de12` (Task 2 commit).

### User-Driven Mid-Checkpoint Deviation

**2. Per-row copy-link button on event-types list + blue dropdown focus highlight**

- **Found during:** Task 3 (live-deploy human-verify checkpoint).
- **Trigger:** Andrew confirmed the booking-link field on the edit page worked as designed, then asked for two follow-ons: (a) a per-row "copy link" button on the LIST page so he can copy a single event type's URL with one click without opening edit, and (b) the row-actions kebab dropdown items' orange focus highlight changed to blue.
- **Fix:**
  - Created new `app/(shell)/app/event-types/_components/row-copy-link-button.tsx` with the same host-derivation pattern as BookingLinkField. Single-click copy, Copy → Check flip ~1.5s, hidden on archived rows.
  - Wired into `event-types-table.tsx` on each non-archived row, adjacent to the existing kebab trigger.
  - In `row-actions-menu.tsx`, added per-instance `focus:bg-primary focus:text-primary-foreground` to each non-destructive DropdownMenuItem (Edit, Make active, Make inactive, Get embed code, Restore). Archive item retained the destructive red focus class (correct UX — only irreversible action).
  - Shared `components/ui/dropdown-menu.tsx` NOT modified (per-instance override pattern, matching Phase 23 invariant).
- **Files created:** app/(shell)/app/event-types/_components/row-copy-link-button.tsx
- **Files modified:** app/(shell)/app/event-types/_components/event-types-table.tsx, app/(shell)/app/event-types/_components/row-actions-menu.tsx
- **Verification:** Live-deploy approved by Andrew after this commit landed.
- **Committed in:** `db7fb62` (mid-checkpoint commit).

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking — anticipated by the plan) + 1 user-driven mid-checkpoint enhancement.
**Impact on plan:** No scope creep on the planned tasks. The new/page.tsx conversion was explicitly anticipated as an "if exists, do this too" sub-step. The mid-checkpoint deviation is a small UX add-on driven directly by user feedback at the verify gate — it sharpens the OWNER-13 outcome (one-click URL copy for ANY event type from the list, not only from inside edit) and addresses a minor color complaint on an unrelated dropdown.

## Issues Encountered

None — plan executed cleanly. The new/page.tsx conversion was anticipated by Task 2's consumer-audit sub-step, so it landed in the same commit (`f10de12`) without surprise.

## User Setup Required

None — no environment variables added, no external service configuration. `NEXT_PUBLIC_APP_URL` already exists and was already used by `slug-form.tsx` (RESEARCH.md "Booking URL construction" pattern source). The new component reuses the same env var.

## Next Phase Readiness

- **Phase 24 fully code-complete.** Both plans (24-01 home-calendar de-orange + 24-02 copyable-booking-link-field) shipped to live and approved by Andrew.
- **OWNER-12 + OWNER-13 closed.** Both ROADMAP success criteria for Phase 24 are met:
  - OWNER-12: home calendar day-buttons are grey-only, no orange (Plan 24-01).
  - OWNER-13: copyable booking-link field on the edit page + per-row copy button on the list page (Plan 24-02).
- **v1.3 ready to ship** as soon as the phase-completion commit lands. Phases 22 (auth fixes), 23 (public-booking fixes), and 24 (owner UI polish) are all complete.
- **Carryover to v1.4 unchanged:** Marathon QA (QA-09..QA-13 + ~21 manual checks), Resend migration, Vercel Pro upgrade, OAuth, NSI mark image, DEBT-02 (~22 pre-existing tsc errors in tests/), DEBT-07 (cosmetic AccountSummary fields).

---
*Phase: 24-owner-ui-polish*
*Completed: 2026-05-02*
