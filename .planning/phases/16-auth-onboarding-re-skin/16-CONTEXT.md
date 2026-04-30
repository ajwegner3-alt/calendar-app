# Phase 16: Auth + Onboarding Re-Skin - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the 7 auth pages (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/error`, `/account-deleted`) and the 3-step `/onboarding` wizard to present the NSI visual language established in Phase 15: `BackgroundGlow` (NSI blue), glass "NorthStar" pill, `bg-gray-50` base, and white card form containers. **Visual layer only — all functional auth/onboarding flows must be preserved.** New auth methods, copy rewrites, and onboarding-step changes are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Split-panel fate (/login + /signup)
- **Keep the 2-col split-panel layout.** Swap `NSIGradientBackdrop` → `BackgroundGlow` (NSI blue) on the right column. Form stays on the left column.
- **`AuthHero` marketing copy stays verbatim** — headline, subtext, the 3 bullets, and the "Powered by NSI" badge. Pure visual swap (gradient → glow).
- Roadmap success criteria #1 reads this way: "split-panel layout with the blue-blot glow on the right column replacing `NSIGradientBackdrop`."

### Other 5 auth pages (forgot-password, reset-password, verify-email, auth/error, account-deleted)
- **Single centered white card** on `bg-gray-50` + `BackgroundGlow` + pill on top. No split-panel.
- Pattern matches their current single-column nature; uniform across all 5.

### Mobile / `<lg` breakpoint
- **Form-only with glow visible.** `BackgroundGlow` renders behind the form card on mobile (matches Phase 15 owner-shell mobile behavior — glow is not desktop-only).
- Pill renders on top on mobile too.
- `AuthHero` continues to hide below `lg` (current `hidden lg:flex` behavior preserved).

### Onboarding pill context label
- **Right slot shows `"Setup"` static across all 3 steps.** Matches roadmap success criteria #3.
- Step number/name is conveyed by the in-card "Step X of 3" subtext, not the pill.

### Onboarding progress indicator labels
- **Show `"Step X of 3"` subtext only.** No per-segment step names ("Account" / "Timezone" / "Event type") — those would duplicate the per-step `<h2>` inside the card.

### Onboarding heading layout-level
- Per-step `<h2>` headings inside each step's card carry the "what step is this" context.
- Layout-level `"Set up your booking page"` heading: **Claude's discretion** (see below).

### Pill width on auth/onboarding (no sidebar)
- **Full-width centered.** Pill spans the full viewport width with `left-0` (no sidebar offset). Phase 15's `md:left-[var(--sidebar-width)]` lock applies to **owner shell only** — these surfaces have no sidebar.
- This matches the Phase 15 lock note: "Phase 16's auth pages also have no sidebar — moot."

### Card max-width policy (mixed)
- **Short auth forms** (`/forgot-password`, `/reset-password`, `/verify-email`, `/auth/error`, `/account-deleted`): `max-w-md` (~28rem) — roomier than current `max-w-sm` but still focused.
- **Onboarding steps**: `max-w-xl` (~36rem) — preserves current onboarding layout width; multi-field steps need the room.
- **Login/signup form column**: existing inner `max-w-sm` preserved (form column, not centered card).

### Color tokens
- All `bg-blue-600` references in onboarding progress / per-step files **must update to `bg-blue-500`** (matches roadmap success criteria #3 and Phase 15's `:root --primary` lock at `oklch(0.606 0.195 264.5)` ≈ `#3B82F6` blue-500).
- No per-account `brand_primary` overrides on any auth/onboarding surface — these are NSI-only surfaces (per the v1.2 branding rule).

### `NSIGradientBackdrop` removal scope
- Component is removed from `AuthHero` (replaced by `BackgroundGlow`).
- File deletion happens in **Phase 20 (Dead Code + Test Cleanup)**, not Phase 16. Phase 16 just stops importing it; Phase 20 confirms zero importers and deletes the file.

### Claude's Discretion
- **Auth-pages pill right-slot policy**: per-page label vs. wordmark-only. Default to wordmark-only if labels feel redundant with the form's `<h2>` heading; switch to per-page labels if the pill looks visually unbalanced empty.
- **Pill positioning on the split-panel** (`/login` + `/signup`): default to spanning both columns per roadmap success criteria #2; deviate to "form column only" only if the live visual gate shows it looks bad spanning both.
- **Onboarding progress visual style**: default to keeping the existing 3-segment bar (smallest delta — only the `bg-blue-600` → `bg-blue-500` color swap is required to satisfy roadmap criteria); switch to numbered-stepper or dots-with-connector only if the segment bar looks weak in the new shell.
- **Onboarding progress placement**: default to inside-card-top (single contained surface, matches current pattern); move above-card if the live render looks cramped.
- **Layout-level "Set up your booking page" heading**: default to dropping it if pill + "Setup" label + progress + per-step `<h2>` together feel sufficient; keep if the layout looks bare without it.
- **Auth/onboarding card class**: default to exact Phase 15 reuse (`rounded-lg border border-gray-200 bg-white p-6 shadow-sm`); bump padding to `p-8` only if forms look cramped during the visual gate.
- **Card vertical placement**: default to viewport-centered (`min-h-screen flex items-center`) for the 5 short auth pages; default to anchored-top (under the pill with consistent top padding) for onboarding to avoid step-to-step vertical jump as content density changes.
- **`BackgroundGlow` visibility behind the card**: default to "visible behind card" (matches Phase 15's glass-shell aesthetic where glow leaks through `bg-white/80` surfaces). The standard Phase 15 card class uses opaque `bg-white` (not `bg-white/80`), so glow visibility primarily lives in the gutter around the card on these pages — that's expected.
- All visual gates run on the live Vercel preview, not local dev (per Phase 15 lock).

</decisions>

<specifics>
## Specific Ideas

- "Visiting `/login` shows the split-panel layout with the blue-blot glow on the right column replacing `NSIGradientBackdrop`" — direct quote from roadmap success criteria #1, locked.
- The glass shell aesthetic from Phase 15 (`bg-white/80 backdrop-blur-sm` on Sidebar + `bg-gray-50` base + ambient `BackgroundGlow`) is the reference. Auth/onboarding shells should mirror this aesthetic on their own non-sidebar layouts.
- `AuthHero` keeps its existing copy and bullets — this isn't a copy refresh, it's a backdrop swap.
- Onboarding step 1 progress bar active segment must be `bg-blue-500`, not `bg-blue-600` (current code).

</specifics>

<deferred>
## Deferred Ideas

- **`NSIGradientBackdrop` file deletion** — handled by Phase 20 (Dead Code + Test Cleanup) once Phase 16 confirms zero importers.
- **OAuth / magic-link / new auth methods** — re-deferred to v1.3 per the v1.2 scoping decisions in STATE.md ("Auth additions → RE-deferred to v1.3").
- **Onboarding flow restructuring** (more steps, different fields, conditional branching) — out of scope; visual layer only.
- **Auth copy rewrites** (headlines, marketing bullets, error messages) — out of scope; pure visual swap.
- **Per-page pill labels system** (if Claude defaults to wordmark-only and labels are wanted later) — can be added in a future polish phase.

</deferred>

---

*Phase: 16-auth-onboarding-re-skin*
*Context gathered: 2026-04-30*
