# Phase 25: Surgical Polish - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Four UI-only fixes across auth and owner-home surfaces. No DB, no shared component edits, no new capabilities. In scope:

- **AUTH-21 / AUTH-22**: Remove the "Powered by NSI" pill from `/login` and `/signup` (both share `app/(auth)/_components/auth-hero.tsx:27-31`).
- **OWNER-14**: Flip the home-calendar selected-date color from current `bg-gray-700 text-white` (`app/(shell)/app/_components/home-calendar.tsx:76`) to NSI blue via `bg-primary` token.
- **OWNER-15**: Stop the home-calendar grid from overflowing the Card on narrow mobile viewports (currently 7 × 36px cells = 252px minimum width before gaps/padding).

Shared `components/ui/calendar.tsx`, `globals.css --color-accent`, `Header` component, and public `powered-by-nsi.tsx` footer are UNTOUCHED — per-instance className overrides only (v1.3 invariant).

</domain>

<decisions>
## Implementation Decisions

### Selected-date interactions (OWNER-14)

- **Hover on selected**: Stay solid blue. No darken, no ring — selected state does not change on hover.
- **Text color on selected**: Use `text-primary-foreground` token (pairs canonically with `bg-primary`, inherits the v1.2 owner-shell `--primary-foreground` lock).
- **Today + selected combination**: Selection wins. When a date is both today and selected, render pure NSI blue fill — drop the `bg-muted` and `ring-1 ring-gray-300` styling for that combined state.
- **Today (unselected)**: Untouched. Keep `bg-muted text-foreground font-semibold ring-1 ring-gray-300` exactly as v1.3 shipped.

The selected-state class change happens on `home-calendar.tsx:76` only — replace `bg-gray-700 text-white` with `bg-primary text-primary-foreground` and ensure the `modifiers.today` branch is skipped when `isSelected`.

### Mobile overflow strategy (OWNER-15)

All implementation levers are Claude's discretion (see below). Constraint set:

- Must use the `--cell-size` instance override path per V14-mp-01 (do NOT add `overflow-x-auto` to the Calendar root).
- Must NOT modify shared `components/ui/calendar.tsx`.
- Fix lives in `home-calendar.tsx` instance — either via `style={{ "--cell-size": ... }}` on the Calendar wrapper or by replacing the `theme(spacing.9)` fallback in line 72's `min-w-[var(--cell-size,theme(spacing.9))]`.

### Verification viewports

- **390px** (iPhone 14/15 baseline): primary mobile target — calendar must fit Card with no horizontal scrollbar.
- **1024px+ desktop**: confirm v1.3 desktop appearance is unchanged.
- 375px (iPhone SE/12 mini) and 768px (iPad) NOT in the must-verify set, but the 390px fix should not regress them.

### Claude's Discretion

- **Pill removal mechanism**: Choose between deleting the pill JSX outright in `auth-hero.tsx:27-31` vs. adding a prop to `AuthHero` to make the pill conditional. AuthHero is auth-only, so straight delete is reasonable.
- **Mobile cell-size value**: Pick `spacing.7` (28px), `spacing.8` (32px), or another value that fits 390px without horizontal overflow.
- **Cell shape on mobile**: Stay `aspect-square` vs. allow compression. Pick whichever looks balanced at 390px.
- **Tap-target tradeoff**: Smaller-than-44px cells are acceptable if needed; calendar grids commonly run tight. No hard floor.
- **Responsive vs. unconditional shrink**: Apply the smaller cell-size only below a breakpoint, or unconditionally. Pick whichever produces a cleaner mobile + desktop result.
- **Verification approach**: Live deploy + Andrew eyeball is the assumed pattern (matches v1.3); no Playwright/snapshot tests required unless the planner sees high regression risk.

</decisions>

<specifics>
## Specific Ideas

- Selected-state replacement is a one-line className flip plus an `isSelected` precedence tweak — do not over-engineer.
- The home calendar lives inside a Card. A prior memory note (`feedback_grid_centering.md`) records that `mx-auto` failed to center a `w-fit` Calendar inside a grid cell on mobile and `justify-self-center` is the canonical fix; if the OWNER-15 work touches centering, prefer `justify-self-center` over `mx-auto`.
- v1.3 Phases 23/24 established the per-instance-override invariant; this phase extends that pattern, doesn't break it.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Pill removal mechanism and verification approach were offered but the user chose not to lock them; they remain open for the planner to decide.

</deferred>

---

*Phase: 25-surgical-polish*
*Context gathered: 2026-05-03*
