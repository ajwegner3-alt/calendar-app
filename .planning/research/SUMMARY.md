# Research Summary: calendar-app v1.2
# NSI Brand Lock-Down + UI Overhaul

**Synthesized:** 2026-04-30
**Research files:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Milestone:** v1.2

---

## Executive Summary

v1.2 is a purely visual milestone with zero new functional capabilities, routes, or npm packages. The scope is a clean branding split: owner-facing surfaces lock to NSI corporate identity (blue-500 primary, gray-50 backgrounds, BackgroundGlow ambiance component, NorthStar wordmark in Roboto Mono) while public-facing and embed surfaces continue rendering the customer brand_primary color. All 4 research agents converge on the same 7-8 phase execution sequence: typography and CSS token foundations first, BackgroundGlow component and owner shell re-skin second, auth/onboarding third, public surfaces fourth (pending two open questions), branding editor and email simplification fifth and sixth, dead code cleanup seventh, and schema DROP migration mandatory last.

The dominant risk is the schema DROP migration at the end. Four deprecated columns (sidebar_color, background_color, background_shade, chrome_tint_intensity) currently appear in SELECT strings across 10+ files spanning routes, lib, and email senders. Every reader must be updated before the DROP SQL runs, and a mandatory ~30-minute Vercel drain window must separate the final code-stop-reading deploy from the migration. The chromeTintToCss utility function has zero application call sites but one test file that imports it; that test must be deleted before the function file can be deleted.

Two architectural decisions remain open and must be resolved by Andrew before Phase 4 (public surfaces) can be planned: (1) whether brand_accent is kept as a wirable accent column or dropped entirely, and (2) whether the existing BrandedPage component is extended in place or replaced with a clean PublicShell component. Both decisions have clear tradeoffs documented in the research files. All other v1.2 design decisions are locked.

---

## Key Findings

### From STACK.md

**Zero new npm packages.** All required capabilities exist in the current stack.

**Three required font deltas:**
- Inter weight array: change from `["400"]` to `["400","500","600","700","800"]` in `app/layout.tsx`
- Roboto Mono: add as `next/font/google` declaration (not an npm install)
- Letter-spacing: switch from `tracking-tight` rem-based to em-based rules (`-0.017em` body, `-0.037em` h1-h3)

**BackgroundGlow:** Replicate from the lead-scoring reference (`lead-scoring-with-tools/website-analysis-tools/`). Do NOT vendor verbatim. Needs `color?: string` prop defaulting to `#3B82F6`. Must be `position: absolute` (not fixed) to respect SidebarInset containment and iframe height reporting.

**Tailwind v4 native:** `backdrop-blur-sm` works natively; no plugin needed.

**AOS:** Never installed in calendar-app; skip entirely. Do not add.

**New file to create:** `app/_components/background-glow.tsx`

---

### From FEATURES.md

**Surface-by-surface visual contracts confirmed for 19 surfaces.** Key rules:

| Surface group | Background | Primary color |
|---|---|---|
| Owner shell (dashboard, settings) | gray-50 + BackgroundGlow | NSI blue-500 |
| Auth pages (login, register) | gray-50 + BackgroundGlow | NSI blue-500 |
| Onboarding | gray-50 + BackgroundGlow | NSI blue-500 |
| Public booking pages | white/gray-50 | customer brand_primary |
| Embed | white | customer brand_primary |
| Emails | white | customer brand_primary |

**saveBrandingAction new signature:** `{ logoUrl, brandPrimary }` (logo upload stays separate). The brand_accent field is excluded from this signature pending Open Question 1 resolution.

**Email senders to update (6 files):**
- `send-booking-confirmation.ts`
- `send-booking-emails.ts`
- `send-cancel-emails.ts`
- `send-reschedule-emails.ts`
- `send-reminder-booker.ts`
- `send-owner-notification.ts`

**"Powered by NSI" treatment:**
- Web footer: text-only (`Powered by North Star Integrations`); `nsi-mark.png` is a 105-byte solid navy placeholder, not production-ready
- Embed: no mark at all (would be cropped, interferes with height reporting)

**FEATURES.md recommendation on brand_accent:** DROP (Option D). One color is correct UX for trade contractors; lead-scoring reference uses only blue-500.

**FEATURES.md recommendation on BrandedPage:** Replace with new PublicShell component (clean break, retires GradientBackdrop complexity).

---

### From ARCHITECTURE.md

**`--primary` CSS variable override location:** Single `<div style={{ "--primary": chrome.primaryColor, "--primary-foreground": chrome.primaryTextColor }}>` wrapper at `app/(shell)/layout.tsx` lines 62-66. Removing this wrapper + updating `@theme { --color-primary: #3B82F6 }` in `globals.css` fixes all shadcn Buttons, Switches, and focus rings with no per-component changes.

**chromeTintToCss call sites:** Zero application call sites confirmed. Only `tests/branding-chrome-tint.test.ts` imports it. Delete test file BEFORE deleting the function file.

**Deprecated columns with exact file locations:**

`sidebar_color` readers: `api/bookings/route.ts`, `cron/send-reminders/route.ts`, `lib/bookings/cancel.ts`, `lib/bookings/reschedule.ts`

`background_color` readers: same 4 files plus email senders

`background_shade` readers: same files; note `DROP TYPE background_shade` required (Postgres ENUM, not just a column)

`chrome_tint_intensity` readers: same files; `chromeTintToCss` utility

**Two header components (not one with variant prop):**
- `OwnerHeader`: client component, uses `usePathname`
- `PublicHeader`: server component, renders logo/name

**ARCHITECTURE.md recommendation on brand_accent:** KEEP. Column already exists in initial schema; `--color-accent: #F97316` already in `@theme`; wiring to `.day-has-slots::after` calendar dot is ~10 lines.

**ARCHITECTURE.md recommendation on BrandedPage:** Extend in place. Smaller diff; no need to update 5 page-level call sites.

**7-phase sequence from ARCHITECTURE.md:** Foundations, Auth+Onboarding, Public+Embed, Branding Editor, Email, Dead Code, Schema DROP.

---

### From PITFALLS.md

**Critical pitfalls (must not miss):**

| ID | Pitfall | Prevention |
|---|---|---|
| CP-01 | `api/bookings/route.ts` line 171 reads `chrome_tint_intensity`, `sidebar_color` in SELECT -- will 500 at DROP time | Pre-flight grep: zero hits required before running DROP SQL |
| CP-02 | `EmailBranding` interface change must be atomic -- all 10 files in one deploy wave | Single PR for all email sender changes |
| CP-03 | Stale Vercel function instances live up to 30 min post-deploy | Mandatory 30-min drain window between code deploy and DROP migration SQL |
| CP-04 | `brandingFromRow` and `Branding` interface must shrink together | Update `types.ts` first to surface TypeScript errors compile-time |
| CP-05 | Embed iframe missing `--primary` override | Add `--primary` override to `EmbedShell` independently from `BrandedPage` |
| CP-06 | BackgroundGlow inside `overflow-hidden` + transform ancestor causes clipping | Audit ancestor chain; component must be `absolute` not `fixed` |

**Moderate pitfalls:**

| ID | Pitfall | Prevention |
|---|---|---|
| MP-04 | JIT dynamic class names -- runtime hex via inline style ONLY | Never dynamic className with bracket syntax; always `style={{ background: color }}` |
| MP-06 | Test file imports `chromeTintToCss` -- delete test BEFORE deleting function | Phase 7 must delete test first, then function |
| MP-10 | Second blob gradient terminus must be `transparent` (not `#111827`) on public surfaces with dynamic brand_primary | Review gradient stops before merge |

**"Looks Done But Isn't" checklist (13 items provided in PITFALLS.md)** -- must be run after Phase 3 (owner surfaces) and after Phase 4 (public surfaces) before proceeding.

---

## Open Questions (Must Resolve Before Phase 4)

### Open Question 1: What does brand_accent actually control?

**FEATURES.md says:** DROP brand_accent entirely. One accent color is wrong UX for trade contractors; lead-scoring reference uses only blue-500 for all interactive elements.

**ARCHITECTURE.md says:** Keep brand_accent. The column exists, `--color-accent: #F97316` is already in `@theme`, and wiring it to `.day-has-slots::after` calendar dot is ~10 lines. It is the only user-visible semantic use today.

**Decision required from Andrew.** Neither option is blocked technically. This affects `saveBrandingAction` signature, the branding editor UI, and whether the Supabase column persists.

---

### Open Question 2: Does BrandedPage survive or become PublicShell?

**FEATURES.md says:** Replace BrandedPage with a new PublicShell component. Clean break; retires GradientBackdrop complexity; clearer naming.

**ARCHITECTURE.md says:** Extend BrandedPage in place. Smaller diff; no need to update 5 page-level call sites; preserves existing import paths.

**Decision required from Andrew.** This is a refactor-scope decision, not a correctness decision. Both produce identical end-user output.

---

## Unanimous Findings (Locked)

These findings have no disagreement across research files:

- Zero new npm packages for v1.2
- Inter weight array must expand to `["400","500","600","700","800"]`
- Roboto Mono added via `next/font/google` (no npm install)
- Letter-spacing switched to em-based rules
- BackgroundGlow replicated (not vendored) with `color?: string` prop, `position: absolute`
- Owner side: NSI blue-500 + gray-50 + BackgroundGlow
- Public/embed/email: customer `brand_primary`
- `--primary` override removed from `(shell)/layout.tsx`; `@theme` updated in `globals.css`
- chromeTintToCss test deleted before function deleted
- Schema DROP is the final phase with 30-min mandatory drain window
- `DROP TYPE background_shade` (not just DROP COLUMN)
- Two separate header components: OwnerHeader + PublicHeader
- AOS: skip entirely
- JIT pitfall: inline style for runtime hex colors, never dynamic class names

---

## Implications for Roadmap

### Suggested Phase Structure (8 phases)

**Phase 1: Typography + CSS Token Foundations**
- Rationale: Everything downstream depends on font loading and `--primary` token. Zero risk; fully isolated.
- Delivers: Inter weights, Roboto Mono, em-based letter-spacing, `--color-primary: #3B82F6` in `@theme`, removal of `--primary` wrapper from `(shell)/layout.tsx`
- Pitfalls to avoid: CP-04 (update types.ts first)
- Research flag: NONE -- standard Next.js font patterns

**Phase 2: BackgroundGlow Component + Owner Shell Re-Skin**
- Rationale: Owner surfaces use NSI colors only; no open questions block this.
- Delivers: `background-glow.tsx` component, gray-50 backgrounds on dashboard/settings, NorthStar wordmark in OwnerHeader
- Pitfalls to avoid: CP-06 (no overflow-hidden ancestor), MP-04 (no JIT class names)
- Research flag: NONE -- reference implementation available

**Phase 3: Auth + Onboarding Re-Skin**
- Rationale: Isolated pages; same NSI treatment as Phase 2; no customer data involved.
- Delivers: Login, register, onboarding pages with gray-50 + BackgroundGlow + blue-500
- Pitfalls to avoid: MP-04
- Research flag: NONE

**Phase 4: Public Booking Surfaces + Embed**
- Rationale: Requires Open Question 2 resolved (BrandedPage vs PublicShell). Cannot start until Andrew decides.
- Delivers: PublicHeader with customer brand_primary, public booking pages re-skinned, embed `--primary` override added to EmbedShell
- Pitfalls to avoid: CP-05 (embed needs own override), MP-10 (gradient terminus), CP-07 (day-has-slots dot is accent not primary -- do not change)
- Research flag: MODERATE -- Open Question 2 must be resolved first

**Phase 5: Branding Editor Simplification**
- Rationale: `saveBrandingAction` signature change; depends on Open Question 1 resolved (brand_accent keep/drop).
- Delivers: Simplified branding editor UI, updated action signature, logo upload UX
- Pitfalls to avoid: CP-04 (shrink Branding interface and brandingFromRow together)
- Research flag: NONE once Open Question 1 resolved

**Phase 6: Email Layer Simplification**
- Rationale: Parallelizable with Phase 5 if team allows; 6 email senders must update together atomically.
- Delivers: EmailBranding interface simplified, all 6 senders updated, deprecated column reads removed from email layer
- Pitfalls to avoid: CP-02 (atomic deploy for all 10 email files)
- Research flag: NONE

**Phase 7: Dead Code + Test Cleanup**
- Rationale: Must come after Phases 5-6 confirm no remaining call sites for deprecated code.
- Delivers: chromeTintToCss test deleted, function deleted, GradientBackdrop deleted (if BrandedPage replaced), any other orphaned branding utilities
- Pitfalls to avoid: MP-06 (delete test before function)
- Research flag: NONE

**Phase 8: Schema DROP Migration**
- Rationale: Mandatory last. All code must stop reading deprecated columns before DROP SQL runs.
- Delivers: DROP COLUMN sidebar_color, background_color, chrome_tint_intensity; DROP COLUMN + DROP TYPE background_shade; migration verified
- Pitfalls to avoid: CP-01 (pre-flight grep), CP-03 (30-min drain window), MN-01 (Vercel eyeball checkpoint)
- Research flag: NONE -- well-documented two-step deploy pattern

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Zero ambiguity; all agents agree; specific file locations confirmed |
| Features | HIGH | 19 surfaces documented; 2 open questions are scope decisions, not unknowns |
| Architecture | HIGH | Exact line numbers provided; call sites enumerated; component boundaries clear |
| Pitfalls | HIGH | Critical pitfalls well-documented with specific prevention steps |
| Phase ordering | HIGH | All 4 agents converge on same sequence |
| brand_accent | MEDIUM | Technically clear either way; decision is product preference |
| BrandedPage vs PublicShell | MEDIUM | Technically clear either way; decision is refactor appetite |

**Overall confidence: HIGH**

**Gaps to address before planning:**
1. Andrew must decide brand_accent (keep/drop) -- affects Phase 5 scope
2. Andrew must decide BrandedPage vs PublicShell -- affects Phase 4 scope
3. Confirm `nsi-mark.png` production timeline (currently 105-byte placeholder); web footer falls back to text-only until resolved

---

## Sources

Research files synthesized:
- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`

Reference implementation:
- `lead-scoring-with-tools/website-analysis-tools/BackgroundGlow.tsx`
- `lead-scoring-with-tools/website-analysis-tools/Header.tsx`
- `lead-scoring-with-tools/website-analysis-tools/dashboard/layout.tsx`
- `lead-scoring-with-tools/website-analysis-tools/globals.css`

Project context:
- `.planning/PROJECT.md`
- `.planning/STATE.md`
