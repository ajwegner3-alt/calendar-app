# Phase 15: BackgroundGlow + Header Pill + Owner Shell Re-Skin - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Every owner-facing page under `/app/*` presents the NSI visual identity: blue-blot ambient backdrop (`BackgroundGlow`), glass "NorthStar" pill fixed at top, gray-50 base, and zero per-account color overrides. Phase 12.6's `--primary` wrapper div and `AppSidebar` `sidebarColor` prop are removed. Auth pages, onboarding, public surfaces, and email are out of scope (later phases).

Visual reference (frozen at scoping): `lead-scoring-with-tools/website-analysis-tools/` — `BackgroundGlow`, `Header`, dashboard layout, `globals.css`.

</domain>

<decisions>
## Implementation Decisions

### BackgroundGlow composition
- Trust the lead-scoring reference UI for blob count, positions, opacity, and animation behavior — match the reference verbatim.
- Component must be `absolute`-positioned inside the shell layout (per CP-06), not `fixed`. Verify blobs render visible behind the sidebar.
- Runtime hex passed via `style={{ ... }}` only (per JIT lock MP-04) — never `bg-[${color}]`.

### Header pill behavior
- **Wordmark click target:** clicking "North**Star**" navigates to `/app` (logo-home pattern). Treat the wordmark as a link (cursor-pointer, hover state).
- **Pill contents:** wordmark only. No nav links, no account menu inside the pill. Sidebar remains the primary navigation surface; account/logout stays in sidebar footer (per HDR-08).
- **Scroll behavior:** Claude's discretion — match the reference UI's pattern (default expectation: always-visible / fixed at top).
- **Mobile pill:** Claude's discretion — match the reference's mobile pattern. Pill must replace the old mobile-only hamburger; sidebar trigger lives wherever the reference puts it.

### Sidebar treatment
- **Background:** translucent / glass — semi-transparent with `backdrop-blur` so the BackgroundGlow shows through. Unified atmospheric feel between sidebar and main content.
- **Mobile behavior:** off-canvas drawer — sidebar hidden by default on mobile, slides in as overlay drawer when triggered.
- **Footer (LogoutButton location):** Claude's discretion — `LogoutButton` stays in sidebar footer per HDR-08. Whether to add an account/email block above it is Claude's call based on existing structure.
- **Divider with main content:** Claude's discretion — pick the option that harmonizes with the glass sidebar and reference UI's overall visual weight.
- **Per-account theming removed:** no `sidebarColor` prop, no `--primary` wrapper div — strip all Phase 12.6 hooks.

### Card standardization (OWNER-08..11)
- **Rounded radius:** `rounded-lg` (8px) — applied uniformly across all `/app/*` cards.
- **Surface (bg / border / shadow):** Claude's discretion — pick the option that lifts cards cleanly off the gray-50 base and harmonizes with the glass pill. Apply the chosen treatment uniformly across all `/app/*` pages.
- **Interior padding:** Claude's discretion — pick a single consistent value and apply uniformly.
- **Card header treatment:** Claude's discretion — heading/description typography pattern that works across event-types, bookings, availability, branding, and dashboard.

### Claude's Discretion (summary)
- BackgroundGlow blob composition (defer to reference UI)
- Pill scroll behavior, mobile pill treatment
- Sidebar footer composition (just logout vs account block + logout)
- Sidebar/main divider style
- Card surface (shadow vs border vs both), padding scale, header treatment
- Z-index layering: glow → sidebar → main content → pill (default expectation; adjust if reference differs)

</decisions>

<specifics>
## Specific Ideas

- Reference UI is `lead-scoring-with-tools/website-analysis-tools/` — `BackgroundGlow`, `Header`, dashboard layout, `globals.css` are the frozen visual source of truth.
- Glass aesthetic: pill and sidebar share a `backdrop-blur` translucent treatment so the blue-blot glow is visible underneath both.
- Wordmark "North**Star**" — gray-900 "North" + blue-500 "Star", `font-extrabold` (Inter weight 800 from Phase 14).
- Sidebar is primary nav surface; pill is brand identity only — keep them visually and functionally distinct.

</specifics>

<deferred>
## Deferred Ideas

- Top-bar nav links inside the pill (instead of sidebar) — out of scope for v1.2; pill stays wordmark-only.
- Account avatar/menu inside the pill — out of scope; account stays in sidebar footer per HDR-08.
- Hide-on-scroll pill behavior — not selected; if revisited, lives in a future polish phase.
- Bottom nav bar on mobile (instead of off-canvas drawer) — not selected; off-canvas drawer is the v1.2 pattern.

</deferred>

---

*Phase: 15-backgroundglow-header-pill-owner-shell-re-skin*
*Context gathered: 2026-04-30*
