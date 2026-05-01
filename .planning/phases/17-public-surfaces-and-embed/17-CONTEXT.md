# Phase 17: Public Surfaces + Embed - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the 5 public booking surfaces (`/[account]`, `/[account]/[event-slug]`, confirmation, cancel, reschedule) and the embed widget (`/embed/[account]/[event-slug]`) to present the NSI visual language tinted with each contractor's `brand_primary`:

- New `PublicShell` component replaces `BrandedPage` (which is deleted alongside `GradientBackdrop`).
- New `PublicHeader` component (separate from owner `Header` — public has no sidebar).
- Customer-tinted `BackgroundGlow` on every public surface.
- "Powered by North Star Integrations" footer on every public page.
- Embed widget gets its own independent `--primary` override (CSS vars do not cross iframe boundaries — CP-05).

**Out of scope:** new public pages, new booker features, OAuth/magic-link, Marathon QA. v1.2 owner-shell already shipped in Phase 15; this phase is the public-side counterpart.

</domain>

<decisions>
## Implementation Decisions

### PublicHeader pill content
- Pill content is **logo + account name** (logo on the left, account name text on the right).
- Layout order: **logo first, then name**.
- When an account has no logo uploaded: **Claude's discretion** (initial-in-brand vs initial-in-gray vs collapse-to-text-only).
- Pill background glass treatment: **Claude's discretion** (white glass identical to owner pill, brand-tinted glass, or white-with-brand-border).

### Customer-tinted BackgroundGlow
- **Both blobs tinted with `brand_primary`** — strongest brand presence on public surfaces.
- **Saturation matches owner-shell intensity** — same opacity/blur as Phase 15's NSI blue blobs. Consistent ambiance regardless of brand.
- **Fallback when `brand_primary` is null/undefined/near-white:** fall back to NSI blue (`#3B82F6`) so the glow is always visible. Claude's discretion on the threshold (luminance check, alpha check, or simple null check).
- **Blob offsets:** **same as owner shell** — `calc(50% + 100px)` top, `calc(50% + 0px)` lower. Reuse Phase 15-01's validated values. Visual gate on live preview confirms ambiance translates from sidebar-offset owner layout to no-sidebar public layout (per Phase 15 reference-UI-adaptation rule).

### Powered-by-NSI footer
- **Exact text:** "Powered by North Star Integrations" (full company name, not abbreviated).
- **Linked** to NSI homepage (anchor element). `target="_blank"` and exact URL: Claude's discretion (grep existing codebase for an established NSI marketing URL, or use the canonical northstarintegrations.com / similar — confirm during planning if not findable).
- **Placement:** Claude's discretion (in-flow at end of content, sticky bottom, or inside `PublicShell` wrapper after main content).
- **Styling:** Claude's discretion (subtle gray text only, text + small mark, or text with top border).
- Footer **always renders** on every public surface, including the embed (see below).

### Embed widget visual scope
- **Embed sets its own `--primary` from `brand_primary`** independently from the host page (honors CP-05 — CSS vars do not cross iframe boundaries). Slot picker selected state renders in customer color, not NSI blue.
- **Footer renders inside the embed** — "Powered by NSI" attribution shows on every embed, even though the iframe lives inside a contractor's own site.
- **Chrome density (pill/glow inside embed):** Claude's discretion. Decide based on iframe sizing constraints — full re-skin if the embed has room, or minimal (slot picker on `bg-gray-50` + footer) if chrome would crowd the picker.
- **Embed background color:** Claude's discretion (gray-50 matching NSI shell, transparent for host-flexibility, or white).

### Claude's Discretion (consolidated)

These were marked "you decide" during discussion — Claude has flexibility during planning/implementation. Validate via visual gate on live Vercel preview where ambiguous.

- No-logo fallback inside the public pill (initial-in-brand / initial-in-gray / collapse to text).
- Pill glass background treatment (white / brand-tinted / white + brand border).
- Glow fallback luminance/alpha threshold for "near-white" `brand_primary` detection.
- "Powered by NSI" footer placement, styling, exact link URL, and `target="_blank"` behavior.
- Embed chrome density (full re-skin vs glow-only vs slot-picker-only).
- Embed background color.

</decisions>

<specifics>
## Specific Ideas

- **Test accounts for visual gate:** the existing `nsi` (NSI blue), `nsi-rls-test` (magenta), and any emerald/navy test account established in earlier phases — exercise both blobs tinted across the brand spectrum.
- **Reference UI continuity:** Phase 15 owner shell uses `bg-white/80 backdrop-blur-sm` glass + `bg-gray-50` base + ambient blue-blot glow. Public should read as the same visual family, just brand-tinted rather than NSI blue.
- **CP-05 honored:** the Phase 12.6 `style={{ "--primary": ... }}` wrapper pattern is decommissioned for the owner shell, but the embed iframe still requires a `--primary` override at its own document `:root` — not the same anti-pattern.
- **CP-07 reminder:** `.day-has-slots` dot is `var(--color-accent)`, NOT `--primary`. Don't rewire it during this phase even though `--primary` work is happening.
- **MP-10 honored:** second blob gradient terminus must be `transparent`, not a hardcoded color, on public surfaces — verified during Phase 15-01 for NSI blue, must hold for arbitrary `brand_primary` values too.

</specifics>

<deferred>
## Deferred Ideas

- **Pill footer behaviors not asked about** (mobile sizing, scroll behavior, click target on the pill itself, sticky behavior on long pages) — Claude's discretion at planning time, escalate if a non-obvious decision surfaces.
- **Embed-host integration improvements** (postMessage parent-frame communication, dynamic resize, etc.) — out of scope for v1.2 visual re-skin; revisit in v1.3 if needed.
- **PublicHeader variants beyond logo+name** (custom tagline, social links, contact CTA) — none requested. New capability if proposed.

</deferred>

---

*Phase: 17-public-surfaces-and-embed*
*Context gathered: 2026-04-30*
