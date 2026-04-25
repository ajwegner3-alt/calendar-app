# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-24

## Project Reference

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox - no phone tag, no back-and-forth.

**Current focus:** Phase 2 plans all complete (4/4) — orchestrator running phase verifier next, then routing to Phase 3.

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Phase:** 2 (Owner Auth + Dashboard Shell) — all plans complete, phase verifier next
**Plan:** 02-01, 02-02, 02-03, 02-04 all complete
**Status:** Andrew's auth user provisioned + linked; authenticated-owner RLS suite green (4/4); dashboard renders end-to-end. Awaiting phase verifier.
**Last activity:** 2026-04-24 — Completed 02-PLAN-04-auth-user-provisioning.md including TooltipProvider runtime fix
**Progress:** [█░░░░░░░░] 1 / 9 phases complete (Phase 2: 4 / 4 plans done, awaiting verifier)

```
Phase 1  [✓] Foundation                              (verified 2026-04-19)
Phase 2  [~] Owner Auth + Dashboard Shell            ← plans done (4/4), awaiting verifier
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
| Requirements complete | 6 / 73 (FOUND-01..06); AUTH-01, AUTH-02, AUTH-03, AUTH-04, DASH-01 observably satisfied — pending phase verifier confirmation |

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
- **Logout primitive** (Plan 02-01) — POST Route Handler at `/auth/signout` + `NextResponse.redirect` (Supabase canonical; avoids NEXT_REDIRECT try/catch gotchas). Sidebar-mounted logout form posts to this.
- **shadcn v4 radix-nova style** (Plan 02-01) — init flags migrated from plan's `--base-color slate` to v4's `-d -b radix` (CLI changed between plan research and execution). Base color `neutral` in `components.json` is moot because NSI `@theme` overrides `--color-primary` etc. to NSI hex values.
- **NSI brand tokens in Tailwind v4 `@theme`** (Plan 02-01) — `--color-primary: #0A2540` (deep navy), `--color-accent: #F97316` (warm orange), full `--color-sidebar-*` NSI set. Phase 7 swaps these to per-account DB lookup via inline CSS vars on a wrapping element — trivial migration.
- **Proxy gate pattern** (Plan 02-03) — `pathname.startsWith("/app") && pathname !== "/app/login"` → `NextResponse.redirect("/app/login")`. Tight equality carve-out (faster than `!startsWith("/app/login")`). Future phases' gates should NOT add carve-outs under `/app/*`; other URL trees (`/embed/*`, `/[account]/[slug]`) are not matched by this guard.
- **SELECT-only contract for authenticated-owner tests** (Plan 02-03) — `signInAsNsiOwner()` Vitest helper signs in as Andrew against the REAL `nsi` account; tests that use it MUST NOT INSERT/UPDATE/DELETE. Writes use `adminClient()` + `nsi-test` slug (existing Phase 1 pattern). Locked in helper JSDoc for future phase authors.
- **Shell layout + sidebar cookie literal** (Plan 02-02) — installed shadcn sidebar (plan 02-01 via `shadcn@4.3.0`) defines `SIDEBAR_COOKIE_NAME = "sidebar_state"` (underscore). Layout reads `cookies().get("sidebar_state")` — hard-assertion grep in Task 1 verifies the literal matches. Future layout edits MUST keep the underscore form.
- **Unlinked-user check placement** (Plan 02-02) — `current_owner_account_ids()` linkage check lives ONLY on `/app/page.tsx`, NOT in the shell layout or proxy. Intentional layering (RESEARCH §5): layouts can't read pathname cleanly; per-route RPC adds round-trips for no gain. Stub pages at `/app/event-types|availability|branding|bookings` inherit the check naturally when Phases 3/4/7/8 start querying tenant data.
- **Dashboard nav icon set** (Plan 02-02) — Lucide `CalendarDays` / `Clock` / `Palette` / `Inbox` / `LogOut` in the sidebar; `Inbox` for Bookings deviates from RESEARCH §3c's `List` example (stylistic choice, no functional impact).
- **TooltipProvider wraps SidebarProvider** (Plan 02-04 fix) — shadcn version installed in Plan 02-01 does NOT bundle `TooltipProvider` inside `SidebarProvider`. Shell layout (`app/(shell)/layout.tsx`) wraps `<SidebarProvider>` with `<TooltipProvider delayDuration={0}>`. Discovered during Plan 02-04 Task 3 smoke ("Tooltip must be used within TooltipProvider" runtime crash). Future shadcn upgrades may re-internalize TooltipProvider; if so, the wrapper becomes redundant but not harmful.
- **RPC shape for `current_owner_account_ids()`** (Plan 02-04 evidence) — function returns `SETOF uuid` (verified via `pg_get_function_result`). supabase-js returns this as flat array of UUID strings (`['uuid', ...]`), NOT wrapped objects. Existing length check `Array.isArray(data) ? data.length : 0` is correct. Closes RESEARCH Open Question #1; reuse pattern in Phase 3 event-types CRUD.

### Carried Concerns / Todos

- **Tidy up legacy JWT `SUPABASE_SERVICE_ROLE_KEY`** — swap for `sb_secret_*` format in `.env.local` + Vercel env UI before any security-sensitive phase (target: Phase 8 hardening).
- **`supabase link` not completed locally.** Any future `npx supabase <cmd> --linked` will need `supabase link --project-ref mogfnutxrrbtvnaupoun` + DB password. MCP handles remote-apply case.
- **Pre-existing `contact_submissions` table** (11 rows, unrelated) coexists in `public` schema on the Calendar Supabase project. No impact on booking app. Andrew can drop it from the dashboard anytime.
- Phase 4 needs `/gsd:research-phase` (date-fns/tz v4 + slot algorithm).
- Phase 5 needs `/gsd:research-phase` (.ics across clients + `@nsi/email-sender` attachment API).
- Phase 7 needs `/gsd:research-phase` (Next 16 per-route CSP + static `widget.js` on Vercel — note: Next 16 not 15).
- Phase 8 needs `/gsd:research-phase` (Vercel Cron hobby-tier limits + Resend DNS format).
- Confirm `@nsi/email-sender` attachment signature before Phase 5 plan.
- **Phase 8 backlog: render-test harness** — Vitest + React Testing Library coverage for shell layout. The TooltipProvider regression in Plan 02-04 would have been caught at CI instead of user smoke. Add a render test that mounts `ShellLayout` and asserts no missing context providers.
- **Phase 8 backlog: ESLint flat-config migration** — pre-existing circular-JSON error in `npm run lint` carries forward from Phase 1. Doesn't block phases 2-7 builds, but blocks lint hygiene.
- **v2 backlog: `/auth/callback` route** — Supabase recovery / magic-link flows currently 404. Blocks password reset for end users; deferred to v2.
- **dotenv quoting trap** — leading-`#` values silently parse as empty strings. Plan 02-04 Task 2 tripped over this. Future plans involving env values should add to failure-mode tables.

### Live Resources

- **GitHub:** https://github.com/ajwegner3-alt/calendar-app (public, `main` branch)
- **Vercel:** https://calendar-app-xi-smoky.vercel.app/ (production; auto-deploys on every push to `main`)
- **Supabase:** project `Calendar`, ref `mogfnutxrrbtvnaupoun`, region West US 2, Postgres 17.6.1
- **Seeded account:** `slug=nsi`, id `ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_user_id=1a8c687f-73fd-4085-934f-592891f51784` (Andrew, linked Plan 02-04)
- **Andrew's auth user:** UUID `1a8c687f-73fd-4085-934f-592891f51784`, email `ajwegner3@gmail.com`, email_confirmed_at set, RLS verified

### Blockers

None.

## Session Continuity

**Last session:** 2026-04-24 — Plan 02-04 executed across two checkpoints. Andrew provisioned auth user via Supabase Dashboard (recreated once after first attempt was passwordless). Orchestrator MCP-linked the new UUID and fixed `email_confirmed_at` via SQL. Plan 02-04 Task 3 smoke surfaced a runtime bug — shadcn `SidebarMenuButton` requires a `TooltipProvider` ancestor that the installed sidebar primitive does NOT bundle. Fixed in `app/(shell)/layout.tsx`. RPC shape evidence captured via Postgres introspection + empirical /app redirect path.

**Next action:** Orchestrator runs the Phase 2 verifier. After green verify → Phase 2 complete and Phase 3 (Event Types CRUD) unblocks.

**Phase 2 plan status:**
- ✅ Plan 02-01 (login + auth actions) — complete, pushed (4 commits including metadata)
- ✅ Plan 02-02 (dashboard shell + nav stubs) — complete, pushed (4 commits including metadata)
- ✅ Plan 02-03 (proxy gate + authenticated RLS Vitest scaffold) — complete, pushed (4 commits including metadata)
- ✅ Plan 02-04 (auth user provisioning + smoke + TooltipProvider fix) — complete, pushed (commits `dc2ac71`, `264bdd4`, `762b3c8`; metadata commit pending)

**Files of record:**
- `.planning/PROJECT.md` — what + why
- `.planning/REQUIREMENTS.md` — 73 v1 requirements
- `.planning/ROADMAP.md` — 9 phases
- `.planning/research/` — domain-level research (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY)
- `.planning/phases/01-foundation/` — Phase 1 CONTEXT, RESEARCH, 3 PLANs, 3 SUMMARYs, VERIFICATION
- `.planning/phases/02-owner-auth-and-dashboard-shell/` — CONTEXT, RESEARCH, 4 PLANs, 02-01-SUMMARY, 02-02-SUMMARY, 02-03-SUMMARY, 02-04-SUMMARY
- `.planning/config.json` — depth, mode, parallelization, model profile (balanced), workflow toggles (all 3 on)

---
*State updated: 2026-04-24 after Plan 02-04 execution*
