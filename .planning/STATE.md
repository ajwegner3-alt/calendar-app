# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-02 — **Plan 24-01 COMPLETE (code-side).** OWNER-12 home calendar de-oranged via per-instance className overrides on `app/(shell)/app/_components/home-calendar.tsx`; selected/today/hover/has-bookings dot now grey-only (selected = gray-700, NOT NSI blue per CONTEXT lock). Shared `components/ui/calendar.tsx` and `globals.css --color-accent` token preserved (3 other consumers still use orange). Build + 222 tests pass. Live-deploy visual verification pending. Plan 24-02 (OWNER-13 copyable booking link) remains in Phase 24.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-02 for v1.3 scope lock)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.3 — Bug Fixes + Polish. 8 items across 3 phases:
- Phase 22 (Auth Fixes): signup-link bug, sign-in layout flip, 30-day session TTL.
- Phase 23 (Public Booking Fixes): mobile calendar centering, desktop slot-picker layout collision fix, account-index event-type cards page.
- Phase 24 (Owner UI Polish): owner Home calendar orange-highlight removal, copyable booking link on event-type edit page.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.3 — Bug Fixes + Polish (IN PROGRESS).
**Phase:** 24 of 3 (Owner UI Polish — IN PROGRESS).
**Plan:** 01 of 2 in Phase 24 (CODE-COMPLETE; live-deploy verification pending).
**Status:** Plan 24-01 (OWNER-12 home calendar de-orange) committed at `2397f4c`. Plan 24-02 (OWNER-13 copyable booking link) is next.
**Last activity:** 2026-05-02 — Executed Plan 24-01: 3 className/style edits in `home-calendar.tsx`, build + 222 tests pass, atomic commit `2397f4c`.

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [◆] Bug Fixes + Polish           (Phases 22-24, 3 phases scoped, 6 plans est., Phases 22+23 DONE)
v1.4 [ ] Carryover backlog            (TBD — Marathon QA + Resend + OAuth + NSI mark image + tech debt)
```

## Performance Metrics

**v1.2 velocity (final):**
- 8 phases (14-21), 22 plans, ~80 tasks, 91 commits over 3 days (2026-04-30 → 2026-05-02)
- First net-deletion milestone: NET -792 lines runtime (910 inserted, 1,702 deleted across 74 files excluding `.planning/`)
- Final LOC: 21,871 TS/TSX in runtime tree (down from 29,450 at v1.1 close)
- Final test suite: 222 passing + 4 skipped (24 test files; -3 deleted in Phase 20)

**v1.1 reference velocity:** 6 phases (10-13 incl. 12.5/12.6), 34 plans, 135 commits, 3 days. 33,817 lines inserted + 2,153 deleted (additive milestone).

**v1.0 reference velocity:** 9 phases, 52 plans, 222 commits, 10 days. 85,014 lines inserted total. First-milestone scaffolding cost.

## Accumulated Context

### Architectural patterns established (carried into v1.3)

(See `PROJECT.md` "Context" → "Architectural patterns established" + "v1.1 architectural patterns added" + "v1.2 architectural patterns added" for the canonical record.)

**v1.2 highlights worth keeping in mind for v1.3:**
- Two-step DROP deploy protocol (CP-03) is locked. Any future column DROP follows the same: code-stop-reading deploy → 30-min drain → DROP SQL. (v1.3 has no schema changes — N/A this milestone.)
- `db query --linked -f` is the canonical migration apply method. `db push` remains broken in this repo per PROJECT.md §200.
- `Header` component is multi-variant (`'owner' | 'auth' | 'public'`). Reusable for any future no-sidebar surface — including the new `/[account]` event-type cards page in Phase 23 (PUB-15) which should use `variant="public"`.
- Owner shell is NSI-locked. Per-account chrome theming WILL NOT return on owner side. Public surfaces keep customer `brand_primary`.
- Visual gates run on live Vercel preview. Andrew's deploy-and-eyeball is the de-facto production gate (third-time pattern across v1.0/v1.1/v1.2; formally adopted as the canonical production gate for v1.3 — no marathon QA phase scheduled).
- JIT pitfall lock (MP-04): runtime hex via inline `style={{}}` only. NEVER `bg-[${color}]` dynamic Tailwind. Applies to PUB-15 event-type cards if they tint anything per-account.

### v1.2 ship-time invariants (still true post-archive)

- `accounts` schema: `id, slug, name, owner_email, logo_url, brand_primary, timezone, onboarding_complete` + standard timestamps. **Deprecated columns (`sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity`) PERMANENTLY DROPPED** as of `20260502034300_v12_drop_deprecated_branding_columns.sql`. Re-add `.SKIP` rollback artifact exists at `20260502034301_readd_deprecated_branding.sql.SKIP` (NOT applied).
- `Branding` interface canonical shape: `{ logoUrl, primaryColor, textColor }` (3 fields).
- `EmailBranding` interface canonical shape: `{ name, logo_url, brand_primary }` (3 fields).
- Email-layer `DEFAULT_BRAND_PRIMARY = "#3B82F6"` (NSI blue-500); web-layer `DEFAULT_BRAND_PRIMARY = "#0A2540"` (legacy null-fallback). Different purposes; do NOT unify.
- NSI account `brand_primary` = `#0A2540` (dark navy; below 0.85 luminance threshold; no PublicShell glow fallback).
- Pre-flight QA artifacts on prod (KEPT for v1.4 marathon): Test User 3, capacity-test event_type, 3 distinct branding profiles (navy/magenta/emerald-null).

### Phase 22 auth decisions (carry into v1.3 phases 23-24)

- `@supabase/ssr@0.10.2` default `maxAge` = 400 days. Do NOT add `cookieOptions.maxAge` override — it would shorten sessions.
- `proxy.ts` `setAll` signature is now `(cookiesToSet, headers)` with `Object.entries(headers ?? {})` forwarding cache-control headers. Maintain this pattern if proxy.ts is touched in future phases.
- Supabase hosted dashboard Auth → Sessions: timebox = 0, inactivity = 0 (Free plan; no override). Confirmed 2026-05-02.
- ROADMAP success criterion #3 ("close browser, reopen next day, stay authenticated") tracked observationally over next week. No blocking item for Phase 23 start.

### Phase 23 public-booking decisions (carry into Phase 24)

- `<Calendar>` widget centering inside a CSS grid cell uses `justify-self-center`, NOT `mx-auto`. The shadcn Calendar root has `w-fit`, and `mx-auto` did not reliably center it within a grid track on mobile during live deploy testing — `justify-self: center` is the canonical grid-item alignment property and worked. If Phase 24 touches `/app/home` calendar centering, follow this pattern.
- Shared `components/ui/calendar.tsx` remains untouched at end of Phase 23 (only the per-instance className on the slot-picker `<Calendar>` was modified). Phase 24 OWNER-12 (orange-highlight removal) should similarly avoid editing the shared component if at all possible — prefer instance-level overrides or `globals.css` token swaps.
- Public booker timezone hint pattern: full-width `<p>` hoisted ABOVE the `grid gap-6 lg:grid-cols-2` wrapper via React fragment. "Pick a date to see available times." stays in the right-column conditional ladder (CONTEXT discretion → kept).
- Browser title format on `/[account]` is locked: `Book with ${data.account.name}` (NOT `${name} — Book a time`). If any future surface adds a public listing page, follow this format.

### Phase 24 owner-ui decisions (Plan 24-01)

- `/app/home` day-button states are GREY-ONLY: hover = `bg-gray-100`, selected = `bg-gray-700 text-white` (NOT `bg-primary` / NSI blue), today = `bg-muted` + `font-semibold` + `ring-1 ring-gray-300`, has-bookings dot = `#9CA3AF` (Tailwind gray-400 inline hex). NSI brand color does NOT appear in any home-calendar day-button state.
- `globals.css --color-accent` token (orange `#F97316`) is PRESERVED. Three consumers depend on it: public booker `.day-has-slots::after` dot, bookings-table hover, cancel-confirm-form hover. Any future "remove this orange" request must be evaluated per-consumer, NOT globally.
- Per-instance className override is the canonical pattern when one consumer needs to diverge from a shared design token. Confirmed Phase 23 invariant: shared `components/ui/calendar.tsx` stays untouched; per-`<Calendar>` instance className overrides handle local variation.
- Booking-dot color is the lone hard-coded hex inside home-calendar.tsx (inline style, MP-04 compliant — no JIT dynamic Tailwind). If a future request requires runtime per-account theming of this dot, switch to inline style with a derived hex string, never `bg-[${color}]`.

### Active blockers / open items

- **Marathon QA carryover (third deferral, now formally adopted as deploy-and-eyeball):** QA-09..QA-13 + ~21 per-phase manual checks accumulated through v1.1+v1.2 are DEFERRED to v1.4. v1.3 has NO marathon QA phase by Andrew's explicit choice at scoping.
- **Infrastructure migrations awaiting v1.4:** Resend migration (closes EMAIL-08), Vercel Pro upgrade + hourly cron flip, live cross-client email QA.
- **Tech debt baseline:** ~22 pre-existing tsc errors in `tests/` (TS7006/TS2305) — DEBT-02; carried to v1.4.
- **Cosmetic:** `app/embed/[account]/[event-slug]/_lib/types.ts AccountSummary` retains `background_color` + `background_shade` fields — DEBT-07; carried to v1.4.

## Session Continuity

**Last session:** 2026-05-02 — Executed Plan 24-01 (OWNER-12 home calendar de-orange). 3 className/style edits in `app/(shell)/app/_components/home-calendar.tsx`, atomic commit `2397f4c`. Build clean, 222 tests pass + 4 skipped.
**Stopped at:** Plan 24-01 code-complete; live-deploy visual verification pending Andrew.
**Resume:** Plan 24-02 (OWNER-13 copyable booking link on event-type edit page) — last plan in Phase 24, last phase in v1.3.

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-05-02)
- `.planning/ROADMAP.md` — collapsed milestone summaries (v1.0/v1.1/v1.2 archived) + v1.3 active section (Phases 22-24)
- `.planning/REQUIREMENTS.md` — v1.3 requirements with traceability (8/8 mapped)
- `.planning/MILESTONES.md` — full ship records (v1.0/v1.1/v1.2)
- `.planning/STATE.md` — this file
- `.planning/milestones/v1.2-ROADMAP.md` — full v1.2 phase detail archive
- `.planning/milestones/v1.2-REQUIREMENTS.md` — v1.2 requirements archive (95/95 complete)
- `FUTURE_DIRECTIONS.md` — v1.4 backlog enumeration (formerly v1.3 backlog; carryover punted)
