# Project Research Summary — v1.1

**Project:** calendar-app (NSI Booking Tool)
**Milestone:** v1.1 — additions to shipped v1.0 system
**Domain:** Multi-tenant Calendly-style booking SaaS for trade contractors
**Researched:** 2026-04-27
**Confidence:** MEDIUM-HIGH (HIGH on integration patterns; MEDIUM on specific version pins and unverified Supabase dashboard config)
**Supersedes:** v1.0 SUMMARY.md (2026-04-18) — that doc described the greenfield build; v1.1 is purely additive on top of the shipped v1.0 production system.

## Executive Summary

v1.1 is **NOT a new project**. v1.0 shipped 2026-04-27 — full Next.js 16 + Supabase booking tool with RLS, partial-unique-index race-safety, Postgres-backed rate limiting, Cloudflare Turnstile, vendored Gmail SMTP email, embeddable widget, branded pages with CSS-vars + per-account theming, and 16-case cross-tenant matrix tests. v1.1 adds three tightly-scoped capability areas on top of that locked foundation:

1. **Phase 10 — Multi-user signup + onboarding** (most urgent per project owner). Flips v1.0's single-tenant auth model to public signup. The single hardest blocker is the v1.0 `/auth/callback` 404 (which also breaks password reset today). Fix that, ship `/signup` + a 3-step onboarding wizard, auto-provision `accounts` rows, and re-enable Supabase email confirmation. **One unresolved decision the planner must make in Phase 10:** STACK.md recommends a Postgres `on auth.users insert` trigger for atomic account provisioning; ARCHITECTURE.md recommends a Server Action after `/auth/confirm` for explicit error handling and slug-picker UX. Both are defensible — the planner should pick one based on whether atomicity or UX-first error handling is the higher priority, and document the decision.

2. **Phase 11 — Capacity-aware booking + double-booking root-cause fix.** Andrew observed an actual double-booking in v1.0 prod on 2026-04-27. Phase 11 must (a) reproduce and root-cause the existing prod incident, (b) add per-event-type `max_bookings_per_slot`, and (c) replace the partial unique index `bookings_no_double_book` with a race-safe N-per-slot mechanism. **Two viable patterns** — both surface in the architecture research and require the planner's commitment: (i) BEFORE-INSERT trigger with `pg_advisory_xact_lock(event_type_id, start_at)` (declarative, ARCHITECTURE.md pick), or (ii) extended unique index with a `slot_index` retry pattern (PITFALLS.md pick — arguably the strongest invariant because it's still index-enforced). Either works; **flag this for `/gsd:research-phase` during Phase 11 planning.**

3. **Phase 12 — Branded UI overhaul (5 surfaces) using Cruip "Simple Light".** Extends v1.0's already-shipped `BrandedPage` CSS-vars pattern to add `accounts.background_color` + `accounts.background_shade` (enum: subtle/medium/vivid). New Home tab with monthly calendar (extend `react-day-picker@9` already in stack — explicitly NOT `@fullcalendar/react`). Sidebar IA refactor adds Home + Profile under a Settings group. Email gradients are a known pitfall (Outlook desktop = zero gradient support); STACK.md and PITFALLS.md both recommend solid colors for emails OR a VML fallback — pick one, document the decision in Phase 12.

**Key risks and mitigations.** Three Critical pitfalls dominate v1.1:
- **P-A12 Gmail SMTP quota** (~500/day) is the most under-discussed v1.1 risk — multi-user signup fundamentally changes email volume. Mitigation: cap signups at a low daily rate during launch OR migrate to Resend/Postmark before Phase 10 ships.
- **P-B1 capacity race regression** — the v1.0 prod double-booking proves the pattern is real; v1.1 must re-prove race-safety with N-concurrent tests at the `pg` driver layer (supabase-js may serialize at HTTP).
- **P-A5 RLS holes exposed only at N>1 tenants** — v1.0 ran the matrix test against synthetic tenants; v1.1 will be the first time multiple real owners share the cluster. Expand the test to N=3 tenants and gate every Phase 10/11/12 migration on it.

**Free tier — no Stripe in v1.1.** v1.0 marathon QA carry-overs (Apple Mail render walkthrough, mail-tester scoring, Vercel preview multi-device manual sweep) are RE-DEFERRED to v1.2.

---

## Key Findings

### Recommended Stack (delta from v1.0)

The full v1.0 stack is locked: Next 16 + React 19, `@supabase/ssr@0.10.2` + `@supabase/supabase-js@2.103.1`, Tailwind v4 + shadcn v4 + radix-ui monorepo, `react-day-picker@9.14.0`, `date-fns@4` + `@date-fns/tz`, vendored `@nsi/email-sender`, Cloudflare Turnstile, Postgres-backed rate limiting, RHF + Zod + Vitest. **Zero new dependencies required for Phases 10 + 11.** Phase 12 may add `aos@3.x` IF scroll animations are scoped in (optional, conditional per-route, requires `'use client'` boundary).

**Core v1.1 additions:**
- **Postgres trigger function** (no new dependency) — capacity enforcement via `enforce_booking_capacity()` BEFORE INSERT trigger with `pg_advisory_xact_lock`. Replaces `bookings_no_double_book` partial unique index.
- **`/auth/confirm` Route Handler** using the canonical `verifyOtp({ type, token_hash })` pattern (NOT the legacy `/auth/callback` `exchangeCodeForSession` pattern — the modern Supabase guidance unifies signup confirm + recovery + invite + email_change behind a single route).
- **`lib/reserved-slugs.ts`** — single source of truth replacing the v1.0 dup across 2 files (the slug picker is the third consumer; consolidating is now a hard prerequisite).
- **`event_types.max_bookings_per_slot int not null default 1 check (>=1)`** — per-event-type capacity column. Default preserves v1.0 single-capacity behavior.
- **`accounts.background_color text` + `accounts.background_shade text check (in subtle/medium/vivid)`** — per-account gradient tokens. Extends v1.0 BrandedPage CSS-vars pattern via `color-mix(in oklab, ...)` for perceptually-uniform gradients.
- **Inter font via `next/font/google`** — primary typography per Cruip "Simple Light".

**Verify before locking:** STACK.md flagged exact version pins as MEDIUM confidence (npm view was unavailable in the research session). Re-verify `@supabase/ssr`, `react-day-picker`, and `aos` versions at install time.

### Expected Features (v1.1 scope)

**Must have (table stakes for v1.1):**
- **Phase 10:** `/signup` (email + password + slug picker w/ collision detection); hard email-verify gate; `/auth/confirm` token-hash route; account auto-provisioning (`accounts` row + 5 default availability rules + 1 default 30-min event type at capacity 1); first-login wizard (3 steps: account/slug → availability → first event type); `/app/settings/profile`; working password reset flow; default Mon-Fri 9-5 in user's local TZ (captured via `Intl.DateTimeFormat().resolvedOptions().timeZone` at signup).
- **Phase 11:** `event_types.max_bookings_per_slot` migration; owner UI capacity input; capacity-aware slot computation (`lib/slots.ts` extension); race-safe insert via DB-layer mechanism; race tests at N=3, N=5, N=1 (regression); 409 reason-code distinction (`SLOT_TAKEN` vs `SLOT_CAPACITY_REACHED`); confirmation modal when capacity is decreased on an event with existing bookings.
- **Phase 12:** Inter + tracking-tight + bg-gray-50 base; new background_color/_shade columns + branding editor extension; floating glass header pill on dashboard; sidebar IA (Home + Event Types + Availability + Branding + Bookings + Settings group [Reminders + Profile]); Home tab monthly calendar with day-drawer; auth pages restyled (split panel); public booking page restyled; `/[account]` index landing; embed snippet dialog widening (`max-w-5xl`); email gradient header WITH OUTLOOK FALLBACK or solid-color-only; plain-text alternative on confirmation email; NSI mark in email footer; `RESERVED_SLUGS` consolidation (folds into Phase 10).

**Should have (capability-tier scope conversation):**
- "Show remaining capacity" toggle on event types (Calendly-parity, default OFF).
- Day-detail drawer with cancel/reschedule/view actions (small incremental over basic drawer).
- `/[account]` index public landing card restyled.

**Defer (v1.2+):**
- OAuth signup (Google/GitHub) and magic-link login.
- Slug suggestion-on-collision (add only if drop-off observed).
- Onboarding progress checklist on dashboard.
- Capacity-aware reminder emails ("you and N others").
- Account deletion / soft-delete UI (manual SQL cleanup acceptable in v1.1).
- Visual regression suite (Playwright) — *or pull forward into Phase 12 as cheap insurance; flag explicitly per P-C7.*
- Apple Mail email render walkthrough, mail-tester scoring, Vercel preview multi-device manual sweep (v1.0 QA carry-overs).

**Anti-features (NOT building in v1.1):** OAuth, multi-user-per-account / team seats, Stripe paid tiers, 7+ step onboarding, custom CSS upload, custom HTML email templates per account, multiple themes, SVG logo upload, per-tenant subdomains, waitlists, round-robin scheduling, video conferencing integration.

### Architecture Approach

v1.1 integrates around v1.0's load-bearing invariants — `proxy.ts` exclusive CSP/X-Frame-Options ownership, `lib/supabase/admin.ts` `import "server-only"` gate, two-stage owner authorization, `current_owner_account_ids()` RPC (already user-scoped, no change for multi-user), and the `@supabase/ssr` cookie pattern. The major architectural questions for v1.1 are:

1. **How is the `accounts` row created at signup?** — Two viable approaches; planner picks one in Phase 10 plan (see Open Questions below).
2. **How does capacity > 1 stay race-safe?** — Two viable approaches; planner picks one in Phase 11 plan.
3. **How do per-account dynamic colors flow through Tailwind v4's static-purge system?** — One pattern (already shipped in v1.0): inline CSS variables on `BrandedPage` wrapper + `var(--brand-*)` arbitrary-value Tailwind classes. Extends cleanly to gradients via `color-mix(in oklab, ...)`.
4. **How are email gradients rendered across clients?** — STACK.md recommends solid colors only (Outlook = 0% gradient support, Yahoo = 0%, Gmail = partial). ARCHITECTURE.md offers a VML fallback pattern as an alternative. Pick one in Phase 12.

**Major components added/extended:**
1. **`/onboarding/*` route group (NEW — outside the shell).** Layout enforces wizard sequence by reading `accounts.onboarding_complete` + `accounts.slug` placeholder state. Server Component shells + RHF client islands per step.
2. **`/auth/confirm` Route Handler (NEW).** Single canonical handler for signup confirm + recovery + invite + email_change via `verifyOtp({ type, token_hash })`. Replaces the v1.0 404'd `/auth/callback`.
3. **`enforce_booking_capacity()` Postgres trigger function (NEW).** Replaces `bookings_no_double_book` partial unique index. Acquires advisory lock on `(event_type_id, start_at)` hash, counts confirmed bookings, raises `23P01` if at capacity. Maps to existing 409 SLOT_TAKEN branch in `/api/bookings`.
4. **`lib/reserved-slugs.ts` (NEW).** Single source of truth replacing 2-file duplication.
5. **`/app/home` (NEW).** Monthly calendar Server Component shell + `react-day-picker@9` client island + `<Sheet>` drawer for day detail.
6. **`/app/settings/profile` (NEW).** Email RO, password change, account slug RO + edit, default TZ.
7. **`BrandedPage` extension.** Adds `--brand-bg-base` and `--brand-bg-shade` CSS vars; gradient computed via `color-mix(in oklab, base, primary, shadePct)`.
8. **`lib/email/branding-blocks.ts` extension.** New `renderEmailHeroHeader` block (with chosen gradient strategy).

### Critical Pitfalls

Top 5 that gate v1.1 success:

1. **P-A4 / `/auth/callback` 404 blocks email verification** — Phase 10's first task. Without this route, signup confirmation, password reset, and any future magic-link flow all 404. Use the modern `verifyOtp` pattern at `/auth/confirm`, not legacy `exchangeCodeForSession`.
2. **P-B1 / Capacity race regression** — The v1.0 partial unique index is bulletproof at N=1; replacing it for N>1 is the central correctness bet of Phase 11. Naive trigger with `select count(*)` races under READ COMMITTED. Use advisory lock OR slot_index unique-index pattern. Mandatory N-concurrent race test at the `pg` driver layer.
3. **P-A12 / Gmail SMTP quota exhaustion** — Personal Gmail SMTP is ~500/day. Multi-user signup fundamentally changes the volume profile. Decision required BEFORE Phase 10 ships: (a) cap signups at low daily rate, (b) migrate to Resend/Postmark, or (c) accept the risk and wire a quota alert. Currently the most under-mitigated v1.1 risk.
4. **P-C2 / Email gradient compatibility** — Outlook desktop renders zero gradient support (~5-10% market share, especially in trades). Decision required in Phase 12: solid-color-only in emails (STACK.md pick) or VML conditional-comment fallback (ARCHITECTURE.md alternative).
5. **P-A5 / RLS holes exposed only at N>1 tenants** — v1.0 prod has exactly 1 tenant. v1.1 is the first time `current_owner_account_ids()` faces real concurrent multi-tenant traffic. Expand the cross-tenant matrix test to N=3 tenants and gate every Phase 10/11/12 migration on it. Every NEW v1.1 table MUST include `enable row level security`.

Other Critical pitfalls fully enumerated in PITFALLS.md: P-A1 email enumeration leak, P-A3 partial provisioning failure, P-A6 service-role surface expansion via signup, P-A8 email-confirmation toggle migration risk for Andrew's existing user, P-B2 migration backward-compat window during capacity rollout, P-C7 visual regression risk (no Playwright suite exists), P-X13 multi-agent wave-2 git-index race.

---

## Implications for Roadmap

The roadmap structure is **already locked** by project owner: Phase 10 → Phase 11 → Phase 12 → Phase 13 (Manual QA + sign-off). All four research files independently arrive at this ordering as the correct one. The implications below sharpen each phase's scope, sequencing inside each phase, and research flags.

### Phase 10: Multi-User Signup + Onboarding
**Rationale:** Most urgent per project owner; unblocks `/auth/callback` 404 (also v1.0 password-reset blocker); `RESERVED_SLUGS` consolidation here unblocks slug picker AND simplifies Phase 12 Profile page; lower-risk to land BEFORE multi-user data volume increases.
**Delivers:** Public signup, working email verification, atomic account provisioning, onboarding wizard, password reset, profile settings page.
**Addresses:** Multi-user table-stakes features (FEATURES.md §A); `/auth/callback` 404 (FUTURE_DIRECTIONS §1).
**Avoids:** P-A1, P-A3, P-A4, P-A5, P-A6, P-A8, P-A12, P-A13, P-A15, P-X11, P-X14.
**Internal build order suggestion (per ARCHITECTURE.md §C.8):**
  1. `RESERVED_SLUGS` consolidation → `lib/reserved-slugs.ts` (BEFORE slug picker is wired — it's the 3rd consumer that would otherwise drift).
  2. `/auth/confirm` route + `/forgot-password` + `/app/reset-password` (fixes v1.0 BLOCKER).
  3. `accounts` INSERT RLS policy migration (so onboarding can use RLS-scoped client).
  4. `/signup` page + Supabase email-template configuration.
  5. `/onboarding` wizard (3 steps).
  6. `provisionAccount` + `setDefaultAvailability` + `createFirstEventType` Server Actions.
  7. `/app/page.tsx` redirect change (0 accounts → `/onboarding`).
  8. RLS cross-tenant matrix test extension (N=3 tenants).

### Phase 11: Booking Capacity + Double-Booking Root-Cause Fix
**Rationale:** Andrew's prod double-booking exists TODAY; new signups inherit the exposure. Capacity is a small, contained DB migration. Schema delta is well-scoped.
**Delivers:** `event_types.max_bookings_per_slot` column; race-safe DB-layer enforcement; capacity-aware slot computation; owner UI; race tests; 409 reason-code distinction.
**Addresses:** Capacity table-stakes features (FEATURES.md §B); v1.0 prod double-booking observed 2026-04-27.
**Avoids:** P-B1, P-B2, P-B3, P-B4, P-B5, P-B6, P-B7.
**Critical sequencing:** Migration applied via `npx supabase db query --linked -f` (LOCKED workaround). Drop `bookings_no_double_book` + create trigger MUST be in same transaction (sub-millisecond exposure window). Alternatively use `CREATE UNIQUE INDEX CONCURRENTLY` + `DROP INDEX` for the slot_index pattern.
**Decision required at planning:** Pick advisory-lock-trigger pattern (ARCHITECTURE.md) OR slot_index extended-unique-index pattern (PITFALLS.md). Both race-safe; slot_index has slight retry overhead but stays fully index-enforced.

### Phase 12: Branded UI Overhaul (5 Surfaces)
**Rationale:** IA refactor benefits from multi-user data shape (Profile page exists for users to manage themselves); Home tab calendar reads bookings — capacity-aware visual cues might be valuable. Largest surface, lowest implementation risk to land last.
**Delivers:** Cruip "Simple Light" aesthetic across owner dashboard, public booking page, embed widget, emails, auth/signup pages. Per-account `background_color` + `background_shade` data model. New Home tab + Profile route + sidebar IA refactor. Embed snippet dialog widening fix. Email branding (gradient OR solid color).
**Addresses:** Branded UI table stakes (FEATURES.md §C); FUTURE_DIRECTIONS.md §3 (NSI_MARK_URL, plain-text alt, 6-row branding smoke).
**Avoids:** P-C1, P-C2, P-C3, P-C4, P-C5, P-C6, P-C7, P-C9, P-C10, P-C11, P-C12.
**Decision required at planning:** Email gradient strategy — solid color (STACK.md) or VML fallback (ARCHITECTURE.md). Solid color is the lower-risk default for v1.1.
**Cheap-insurance question:** Pull a minimum-viable Playwright suite (5 critical screenshots × 3 viewports) into Phase 12 prerequisites? Per P-C7, ~1 day investment that pays off across Phase 12 + Phase 13. Otherwise Phase 13 manual QA falls entirely on Andrew's eyes.

### Phase 13: Manual QA + Sign-Off
**Rationale:** CLAUDE.md mandate — every project ends with explicit manual QA phase reviewed by Andrew. v1.0 marathon QA carry-overs are RE-DEFERRED to v1.2 per project owner; v1.1 Phase 13 scope is signup-flow + capacity + visual sweep across the 3 new capability areas only.
**Delivers:** Live walkthrough sign-off; FUTURE_DIRECTIONS.md update for v1.1; project completion report.

### Phase Ordering Rationale

- **Dependencies discovered:** Phase 10 must consolidate `RESERVED_SLUGS` BEFORE the slug picker is wired (3rd consumer = drift risk). Phase 11 capacity migration touches `event_types` schema — easier to land while only NSI's tenant exists than after Phase 10 multiplies the data. Phase 12 IA refactor needs the Profile page (Phase 10) AND the capacity column (Phase 11) to ship cleanly.
- **Risk grouping:** Phase 10 has the highest research surface (auth flows, RLS adjustments, onboarding UX) and benefits from going first while attention is focused. Phase 11 is mechanical once the pattern is locked. Phase 12 is the largest surface but lowest-risk because it's UI-layer.
- **Avoiding pitfalls:** Phase 10 first means `/auth/callback` 404 is fixed before signup is exposed. Phase 11 second means the prod double-booking is closed BEFORE multi-user volume increases. Phase 12 last means the visual overhaul doesn't fight unstable underlying behavior.

### Research Flags

**Phases likely needing `/gsd:research-phase` during planning:**
- **Phase 11:** **YES — flag explicitly.** Architecture research surfaces TWO viable race-safety patterns (advisory-lock trigger vs. slot_index extended unique index). Both work; planner needs deeper research at planning time to pick. Specifically: (a) verify v1.0 race test (`tests/bookings.race.test.ts`) is at the supabase-js layer or pg-driver layer, (b) decide whether the v1.0 prod double-booking is partial-index-gap or capacity-gap before designing the replacement, (c) confirm `pg_advisory_xact_lock` + Supabase pooling mode interaction.
- **Phase 12:** **MAYBE.** Email gradient compat across Apple Mail / Gmail / Outlook / Yahoo is well-documented in PITFALLS.md and STACK.md, but the specific decision (solid-only vs. VML) merits a focused research session if Phase 12 plan pushes for visual parity with the web surfaces. Also flag a Cruip "Simple Light" license/redistribution check.

**Phases with standard patterns (likely skip research-phase):**
- **Phase 10:** Multi-user signup is well-documented across the 4 research files. Exception: if planner picks the Postgres-trigger-on-`auth.users` provisioning pattern (vs. Server Action), spend 30 min verifying the SECURITY DEFINER + search_path hardening pattern against current Supabase docs.
- **Phase 13:** Standard manual QA — no research needed.

---

## Open Questions

Items the planner must re-verify or decide at Phase planning time:

- **Account auto-provisioning pattern (Phase 10).** Postgres trigger on `auth.users` (STACK.md, PITFALLS.md P-A3 #1) vs. Server Action after `/auth/confirm` (ARCHITECTURE.md §A.1). Both are defensible. Recommendation: use trigger if atomicity > UX-error-clarity; use Server Action if reverse. Document the decision.
- **Capacity race-safety pattern (Phase 11).** Advisory lock + count trigger (ARCHITECTURE.md, STACK.md) vs. slot_index extended unique index (PITFALLS.md P-B1). Both are race-safe; slot_index keeps the v1.0 invariant style.
- **Email gradient strategy (Phase 12).** Solid-color-only (STACK.md, recommended for v1.1) vs. VML conditional-comment fallback (ARCHITECTURE.md §C.6).
- **Gmail SMTP plan (pre-Phase 10 decision).** Cap signups at low rate / migrate to Resend / wire quota alert. Highest under-mitigated risk per P-A12.
- **Visual regression suite scope (Phase 12).** Pull forward Playwright (~1 day) or accept Phase 13 manual QA falling on Andrew?
- **Version pins re-verification.** STACK.md flagged exact versions as MEDIUM confidence; run `npm view <pkg> version` for `@supabase/ssr`, `react-day-picker`, `aos` (if scoped) before locking.
- **Supabase Allowed-Redirects config (Phase 10).** Confirm wildcard pattern works for Vercel preview URLs OR enumerate them; verify before merging signup PR.
- **Andrew's `email_confirmed_at` pre-flight (Phase 10).** Run `select email, email_confirmed_at from auth.users` BEFORE flipping the email-confirm toggle; UPDATE if null. Otherwise Andrew gets locked out (P-A8).
- **`@supabase/ssr` PKCE default version.** Confirm `^0.10.2` in `package.json` (already verified by STACK.md and PITFALLS.md sources).
- **v1.0 race test layer.** Is `tests/bookings.race.test.ts` at supabase-js or `pg`? Affects whether Phase 11 race-test extension can reuse the harness or needs a new pg-driver harness for true concurrency (P-B6).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Library *choices* HIGH (all primitives already installed v1.0 except optional `aos`); exact *version pins* MEDIUM (npm view unavailable in research session — re-verify at install). |
| Features | MEDIUM-HIGH | Calendly / Cal.com behavior HIGH (verified live docs); SavvyCal/Acuity specific 2026 onboarding step counts MEDIUM (flagged in FEATURES.md tertiary sources for verification at Phase 10 planning). |
| Architecture | HIGH | Grounded in shipped v1.0 code (`proxy.ts`, `lib/supabase/admin.ts`, `app/_components/branded-page.tsx`, migrations). Two open architectural decisions documented with both options. |
| Pitfalls | HIGH | All 10 v1.0 critical pitfalls (C1-C10) status-tracked. New v1.1 pitfalls verified against shipped code paths. Specific Supabase Auth dashboard behaviors flagged LOW where Andrew owns the config — those are the Open Questions above. |

**Overall confidence:** MEDIUM-HIGH. The integration patterns are HIGH because v1.1 layers on shipped v1.0 invariants (no greenfield architecture). The MEDIUM dimensions are exact version pins (re-verifiable in 5 min at install), specific Supabase Dashboard config Andrew owns, and the 2-3 deliberate open architectural decisions the planner documents in Phase 10/11/12 plans.

### Gaps to Address

- **Gmail SMTP daily limit for Andrew's specific account** — common-knowledge ~500/day but varies by account age + reputation. Verify with a controlled burst test before opening signup OR migrate.
- **Cruip "Simple Light" license + redistribution terms** — flag in Phase 12 plan; out of scope for research files but legally relevant.
- **Whether Supabase Branching is enabled on this project's tier** — affects whether P-A8 email-confirmation toggle can be tested against a preview branch first.
- **Exact pg-driver vs supabase-js layer of v1.0 race test** — affects Phase 11 race-test harness reuse.
- **2026-04-27 prod double-booking root cause** — Phase 11 should reproduce + diagnose BEFORE building the capacity replacement. May reveal partial-index gap distinct from capacity gap.

---

## Sources

All four detailed research files live alongside this summary:

- **`.planning/research/STACK.md`** (43 KB) — multi-user signup deps, capacity DB pattern, Tailwind v4 dynamic theming, monthly-calendar lib choice (react-day-picker over @fullcalendar), Postgres trigger pattern, Inter font integration. **Cumulative installation delta from v1.0: 0 new packages required for Phases 10/11; optional `aos@3.x` for Phase 12 if scroll animations scoped in.**
- **`.planning/research/FEATURES.md`** (41 KB) — Calendly / Cal.com / SavvyCal / Acuity competitive benchmarks; table stakes, capability-tier differentiators, anti-features for all 3 v1.1 capability areas; MVP definition; feature prioritization matrix; v1.0 dependency map.
- **`.planning/research/ARCHITECTURE.md`** (60 KB) — v1.0 invariants preserved; signup flow data path with three options compared; `/auth/confirm` route handler pattern; capacity trigger with advisory-lock race-safety justification; per-account theme tokens schema (two-columns vs JSONB); CSS-vars + Tailwind v4 bridge; sidebar IA refactor; email branding gradient pattern; build order suggestion per phase.
- **`.planning/research/PITFALLS.md`** (81 KB) — v1.0 pitfalls status reference; 30+ v1.1 pitfalls organized by Critical / Moderate / Minor with phase mapping; warning signs + prevention per pitfall; "Looks Done But Isn't" checklist; recovery strategies; integration gotchas; security mistakes; UX pitfalls.

### External Sources Cross-Referenced (HIGH confidence)

- Supabase Auth docs: [Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) (verifyOtp / `/auth/confirm` pattern), [verifyOtp reference](https://supabase.com/docs/reference/javascript/auth-verifyotp), [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
- PostgreSQL docs: [Explicit Locking §13.3.5 Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html), [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).
- Email-client compat: [Can I email — linear-gradient()](https://www.caniemail.com/features/css-linear-gradient/), [Litmus background gradients](https://www.litmus.com/blog/background-colors-html-email), [Maizzle gradients guide](https://maizzle.com/guides/gradients).
- Race-safety patterns: [FireHydrant advisory locks](https://firehydrant.com/blog/using-advisory-locks-to-avoid-race-conditions-in-rails/), [OneUptime PostgreSQL race conditions](https://oneuptime.com/blog/post/2026-01-25-postgresql-race-conditions/view), [Cybertec triggers + constraints](https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/).
- Calendar UI: [react-day-picker v9 grid + months](https://daypicker.dev/docs/grid-and-months).
- Competitor parity: Calendly Group event type help articles; Cal.com event-types guide; SavvyCal/Calendly comparison docs.
- Local skill: `website-creation/.claude/skills/tailwind-landing-page/SKILL.md` (Cruip "Simple Light" design system).

### v1.0 Codebase References Locked-In (HIGH confidence)

`proxy.ts` (CSP/XFO ownership) · `lib/supabase/admin.ts:1` (`import "server-only"`) · `lib/supabase/proxy.ts` (`@supabase/ssr` cookie pattern) · `app/api/bookings/route.ts:178-216` (23505 → 409 SLOT_TAKEN branch) · `app/api/slots/route.ts:86-145` (slot computation contract) · `lib/slots.ts:186-202` (buffer-overlap function) · `supabase/migrations/20260419120000_initial_schema.sql:16, 96-99` (`accounts.slug` unique; `bookings_no_double_book` partial unique index) · `supabase/migrations/20260419120001_rls_policies.sql:9-30` (`current_owner_account_ids()`; no INSERT policy on accounts) · `app/_components/branded-page.tsx:45-69` (CSS-vars pattern) · `lib/email/branding-blocks.ts` (email-block extension surface) · `components/app-sidebar.tsx:26-39` (sidebar IA extension surface).

### v1.0 Backlog References

`FUTURE_DIRECTIONS.md` (`/auth/callback` 404 §1; `RESERVED_SLUGS` duplication §2; NSI_MARK_URL + plain-text alt + 6-row branding smoke §3; wave-2 git-index race §4); `STATE.md` (migration drift workaround locked: `npx supabase db query --linked -f`).

---

*Research synthesized: 2026-04-27 for v1.1 milestone (multi-user signup + capacity-aware booking + branded UI overhaul).*
*Supersedes v1.0 SUMMARY.md (2026-04-18). v1.0 stack + features + architecture remain the locked foundation; v1.1 is purely additive.*
*Ready for requirements: yes*
