# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-19

## Project Reference

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox - no phone tag, no back-and-forth.

**Current focus:** Phase 2 near complete — Plans 01 / 02 / 03 all shipped; orchestrator will run phase verifier next.

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Phase:** 2 (Owner Auth + Dashboard Shell) — plans complete, awaiting phase verifier
**Plan:** 02-01, 02-02, 02-03 all complete; orchestrator runs phase verifier next
**Status:** All 3 Phase-2 plans executed + pushed. Orchestrator will run phase verifier after all plans complete.
**Last activity:** 2026-04-19 — Completed 02-PLAN-02-dashboard-shell.md
**Progress:** [█░░░░░░░░] 1 / 9 phases complete (Phase 2: 3 / 3 plans done, awaiting verifier)

```
Phase 1  [✓] Foundation                              (verified 2026-04-19)
Phase 2  [~] Owner Auth + Dashboard Shell            ← plans done (3/3), awaiting verifier
Phase 3  [ ] Event Types CRUD
Phase 4  [ ] Availability Engine
Phase 5  [ ] Public Booking Flow + Email + .ics
Phase 6  [ ] Cancel + Reschedule Lifecycle
Phase 7  [ ] Widget + Branding
Phase 8  [ ] Reminders + Hardening + Dashboard List
Phase 9  [ ] Manual QA & Verification
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 2 / 9 |
| Phases complete | 1 / 9 |
| Requirements mapped | 73 / 73 |
| Requirements complete | 6 / 73 (FOUND-01..06); AUTH-01, AUTH-02, AUTH-04, DASH-01 UI surfaces shipped (Plans 02-01/02/03); AUTH-03 linking pending Plan 04 user provisioning — full phase sign-off pending phase verifier |

## Accumulated Context

### Key Decisions

- **Multi-tenant from day one, single tenant in v1** — schema supports many accounts; only Andrew's account is seeded; signup UI deferred to v2.
- **Supabase is sole source of truth** — no Google Calendar sync, no external availability sources.
- **Race-safe at the DB layer** — partial unique index `bookings_no_double_book` is the authoritative double-book guard. Runtime-proved in Vitest race test.
- **Time discipline** — `timestamptz` everywhere, IANA TZ strings, `date-fns v4 + @date-fns/tz`. No raw `Date` math.
- **Service-role gate** — service-role Supabase client lives in `lib/supabase/admin.ts` with `import 'server-only'` as line 1.
- **Next.js 16 (not 15)** — `proxy.ts` instead of `middleware.ts`, async `cookies()/params/searchParams`, Turbopack default. Research upgraded the assumption during Phase 1 planning.
- **Supabase new key format** — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not legacy `_ANON_KEY`). Publishable key uses new `sb_publishable_*` format; service-role still uses legacy JWT (tidy-up item for Phase 8).
- **Apply migrations via Supabase MCP** — skipped `supabase db push` password prompt by using `apply_migration` tool directly; same SQL, same tracking table. CLI-versioned files still committed under `supabase/migrations/` for portability.
- **Vercel Cron for reminders** (primary); pg_cron confirmed available on Supabase Free tier as fallback (verified during Phase 1 research).
- **Embeds** — script-injected iframe + raw iframe fallback; CSP `frame-ancestors *` only on `/embed/*`.
- **Email** — all transactional via `@nsi/email-sender` (Resend); booker confirmation includes `.ics` (`METHOD:REQUEST`, stable UID).
- **Phase parallelization** — Phase 3 || Phase 4 after Phase 1; Phases 6 || 7 || 8 after Phase 5.
- **Login UX** (Plan 02-01) — Server Action (credentials off client bundle); RHF + zodResolver + `useActionState` bridge; raw `<form action={formAction}>` chosen over `next/form` for smaller surface area (behavior identical); error messages gated on `error.status` (not `.code` — upstream auth-js bug); generic "Invalid email or password." for all 400s (no user enumeration).
- **Logout primitive** (Plan 02-01) — POST Route Handler at `/auth/signout` + `NextResponse.redirect` (Supabase canonical; avoids NEXT_REDIRECT try/catch gotchas). Sidebar-mounted logout form will post to this in Plan 02-02.
- **shadcn v4 radix-nova style** (Plan 02-01) — init flags migrated from plan's `--base-color slate` to v4's `-d -b radix` (CLI changed between plan research and execution). Base color `neutral` in `components.json` is moot because NSI `@theme` overrides `--color-primary` etc. to NSI hex values.
- **NSI brand tokens in Tailwind v4 `@theme`** (Plan 02-01) — `--color-primary: #0A2540` (deep navy), `--color-accent: #F97316` (warm orange), full `--color-sidebar-*` NSI set. Phase 7 swaps these to per-account DB lookup via inline CSS vars on a wrapping element — trivial migration.
- **Proxy gate pattern** (Plan 02-03) — `pathname.startsWith("/app") && pathname !== "/app/login"` → `NextResponse.redirect("/app/login")`. Tight equality carve-out (faster than `!startsWith("/app/login")`). Future phases' gates should NOT add carve-outs under `/app/*`; other URL trees (`/embed/*`, `/[account]/[slug]`) are not matched by this guard.
- **SELECT-only contract for authenticated-owner tests** (Plan 02-03) — `signInAsNsiOwner()` Vitest helper signs in as Andrew against the REAL `nsi` account; tests that use it MUST NOT INSERT/UPDATE/DELETE. Writes use `adminClient()` + `nsi-test` slug (existing Phase 1 pattern). Locked in helper JSDoc for future phase authors.
- **Shell layout + sidebar cookie literal** (Plan 02-02) — installed shadcn sidebar (plan 02-01 via `shadcn@4.3.0`) defines `SIDEBAR_COOKIE_NAME = "sidebar_state"` (underscore). Layout reads `cookies().get("sidebar_state")` — hard-assertion grep in Task 1 verifies the literal matches. Future layout edits MUST keep the underscore form.
- **Unlinked-user check placement** (Plan 02-02) — `current_owner_account_ids()` linkage check lives ONLY on `/app/page.tsx`, NOT in the shell layout or proxy. Intentional layering (RESEARCH §5): layouts can't read pathname cleanly; per-route RPC adds round-trips for no gain. Stub pages at `/app/event-types|availability|branding|bookings` inherit the check naturally when Phases 3/4/7/8 start querying tenant data.
- **Dashboard nav icon set** (Plan 02-02) — Lucide `CalendarDays` / `Clock` / `Palette` / `Inbox` / `LogOut` in the sidebar; `Inbox` for Bookings deviates from RESEARCH §3c's `List` example (stylistic choice, no functional impact). Swap trivially post-phase if preferred.

### Carried Concerns / Todos

- **Tidy up legacy JWT `SUPABASE_SERVICE_ROLE_KEY`** — swap for `sb_secret_*` format in `.env.local` + Vercel env UI before any security-sensitive phase (target: Phase 8 hardening).
- **`supabase link` not completed locally.** Any future `npx supabase <cmd> --linked` will need `supabase link --project-ref mogfnutxrrbtvnaupoun` + DB password. MCP handles remote-apply case.
- **Pre-existing `contact_submissions` table** (11 rows, unrelated) coexists in `public` schema on the Calendar Supabase project. No impact on booking app. Andrew can drop it from the dashboard anytime.
- Phase 4 needs `/gsd:research-phase` (date-fns/tz v4 + slot algorithm).
- Phase 5 needs `/gsd:research-phase` (.ics across clients + `@nsi/email-sender` attachment API).
- Phase 7 needs `/gsd:research-phase` (Next 16 per-route CSP + static `widget.js` on Vercel — note: Next 16 not 15).
- Phase 8 needs `/gsd:research-phase` (Vercel Cron hobby-tier limits + Resend DNS format).
- Confirm `@nsi/email-sender` attachment signature before Phase 5 plan.

### Live Resources

- **GitHub:** https://github.com/ajwegner3-alt/calendar-app (public, `main` branch)
- **Vercel:** https://calendar-app-xi-smoky.vercel.app/ (production; auto-deploys on every push to `main`)
- **Supabase:** project `Calendar`, ref `mogfnutxrrbtvnaupoun`, region West US 2, Postgres 17.6.1
- **Seeded account:** `slug=nsi`, id `ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_user_id=null` (linked in Phase 2)

### Blockers

None.

## Session Continuity

**Last session:** 2026-04-19 — Plans 02-02 and 02-03 executed autonomously in parallel, pushed to `main`. No merge conflicts on overlapping files (STATE.md coordinated via fresh-read + surgical edits). Plan 02-02 shipped the dashboard shell (3 atomic commits); plan 02-03 shipped the proxy gate + authenticated RLS helper + test (3 atomic commits).

**Next action:** Orchestrator runs the Phase 2 verifier. After green verify → Phase 2 complete and Phase 3 (Event Types CRUD) unblocks.

**Phase 2 plan status:**
- ✅ Plan 02-01 (login + auth actions) — complete, pushed (3 atomic commits)
- ✅ Plan 02-02 (dashboard shell + nav stubs) — complete, pushed (3 atomic commits: `bde2ed1` shell layout + AppSidebar, `ec56540` landing + welcome card + unlinked, `25a3c2c` 4 stub pages). DASH-01 shipped; AUTH-02 UI wiring complete.
- ✅ Plan 02-03 (proxy gate + authenticated RLS Vitest scaffold) — complete, pushed (3 atomic commits: `d92becb` proxy gate, `b4bce59` helper+env, `bfc8dc5` test suite+TS fix). AUTH-04 shipped. Test authored but NOT yet run — Plan 04 will execute after Andrew's auth user is provisioned.

**Files of record:**
- `.planning/PROJECT.md` — what + why
- `.planning/REQUIREMENTS.md` — 73 v1 requirements, traceability updated through Phase 1
- `.planning/ROADMAP.md` — 9 phases, progress updated through Phase 1
- `.planning/research/` — domain-level research (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY)
- `.planning/phases/01-foundation/` — Phase 1 CONTEXT, RESEARCH, 3 PLANs, 3 SUMMARYs, VERIFICATION
- `.planning/phases/02-owner-auth-and-dashboard-shell/` — CONTEXT, RESEARCH, 3 PLANs, 02-01-SUMMARY, 02-02-SUMMARY, 02-03-SUMMARY
- `.planning/config.json` — depth, mode, parallelization, model profile (balanced), workflow toggles (all 3 on)

---
*State updated: 2026-04-19 after Plans 02-02 and 02-03 execution*
