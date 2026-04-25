# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-25 (Phase 4 Plans 02 + 03 complete)

## Project Reference

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox - no phone tag, no back-and-forth.

**Current focus:** Phase 4 (Availability Engine) in progress — Plans 01 + 02 + 03 complete (Wave 2 parallel done).

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Phase:** 4 in progress (Availability Engine)
**Plan:** 03 of N complete (Plans 02 + 03 were Wave 2 parallel, both done)
**Status:** Plans 04-01, 04-02, 04-03 complete. Pure slot engine + 15 AVAIL-09 DST tests (02) and full data layer (03) both done.
**Last activity:** 2026-04-25 — Completed 04-02-PLAN (slot engine + DST tests)
**Progress:** [███░░░░░░] 3 / 9 phases complete (Phase 4 in progress)

```
Phase 1  [✓] Foundation                              (verified 2026-04-19)
Phase 2  [✓] Owner Auth + Dashboard Shell            (verified 2026-04-24)
Phase 3  [✓] Event Types CRUD                        (verified 2026-04-24)
Phase 4  [ ] Availability Engine                     ← next
Phase 5  [ ] Public Booking Flow + Email + .ics
Phase 6  [ ] Cancel + Reschedule Lifecycle
Phase 7  [ ] Widget + Branding
Phase 8  [ ] Reminders + Hardening + Dashboard List
Phase 9  [ ] Manual QA & Verification
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 3 / 9 |
| Phases complete | 3 / 9 |
| Requirements mapped | 73 / 73 |
| Requirements complete | 17 / 73 (FOUND-01..06; AUTH-01..04; DASH-01; EVENT-01..06) |

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
- **Soft-delete via `deleted_at timestamptz` on event_types** (Plan 03-01) — null = active, timestamptz = archived. No boolean flag. Filter active rows with `.is('deleted_at', null)` in supabase-js. Archive writes `deleted_at = now()`.
- **Partial unique index replaces full constraint on event_types** (Plan 03-01) — `event_types_account_id_slug_active ON event_types(account_id, slug) WHERE deleted_at IS NULL` replaces the dropped `event_types_account_id_slug_key`. Slug becomes reusable after archive; DB enforces uniqueness among active rows only.
- **Postgres CTEs run concurrently** (Plan 03-01 smoke test) — Within a single CTE query, all data-modifying CTEs see the same snapshot; an UPDATE in one CTE branch is not visible to an INSERT in another branch of the same query. Smoke tests requiring INSERT → UPDATE → INSERT must be sequential statements, not a single CTE.
- **`supabase db query --linked` as MCP fallback** (Plan 03-01) — When Supabase MCP `apply_migration`/`execute_sql` tools are not in scope (Claude Code CLI sessions), use `supabase db query --linked -f <migration.sql>`. Requires `supabase link --project-ref mogfnutxrrbtvnaupoun` first. Same Management API path; fully equivalent.
- **TEST_OWNER_PASSWORD dotenv quoting** (Plan 03-01 bug fix) — Fixed `#plaNNing4succ3ss!` → `"#plaNNing4succ3ss!"` in `.env.local`. dotenvx treats unquoted `#` as comment character. Value starting with `#` MUST be double-quoted. Updated locally (.env.local gitignored). Andrew must apply same fix to any other environments.
- **shadcn v4 uses radix-ui monorepo package** (Plan 03-02) — `npx shadcn@latest add` (v4.4.0) installs a single `radix-ui` package (`^1.4.3`) rather than individual `@radix-ui/react-*` packages. Generated `components/ui/*.tsx` import from `radix-ui` directly. Future plans verifying Radix deps should check for `radix-ui` key in package.json, not individual `@radix-ui/react-*` keys.
- **Sonner Toaster in root layout, not shell layout** (Plan 03-02) — `<Toaster />` mounted in `app/layout.tsx` (root) so toasts fire on `/app/login` and future public booking routes (`/[account]/[slug]`) which are outside the shell. Shell layout (`app/(shell)/layout.tsx`) intentionally has no Toaster. Any future layout work must preserve single-mount invariant.
- **next-themes added as Sonner peer dep, no ThemeProvider** (Plan 03-02) — shadcn's `sonner.tsx` wrapper calls `useTheme()` from `next-themes`. No `<ThemeProvider>` was added — Sonner defaults to `"system"` theme (acceptable v1 behavior; app has no dark mode). Phase 7 or 8 can add ThemeProvider if dark mode is ever desired.
- **Direct-call Server Action contract for event types** (Plan 03-03) — Actions in `_lib/actions.ts` accept structured `EventTypeInput` directly from RHF `handleSubmit`, NOT `FormData`. Avoids FormData-can't-serialize-nested-arrays pitfall for `custom_questions`. Plans 04 + 05 MUST call `await createEventTypeAction(values)` not use `<form action={action}>` pattern.
- **RestoreResult discriminated union** (Plan 03-03) — `{ ok: true } | { slugCollision: true; currentSlug: string } | { error: string }`. Client opens slug-prompt Dialog on `slugCollision`. Restored rows come back with `is_active: false` (Inactive, not Active).
- **No try/catch in actions.ts** (Plan 03-03) — All error paths use early `return { ... }`. redirect() is the last statement in createEventTypeAction and updateEventTypeAction, never inside a try block. All future actions in this file MUST maintain this invariant.
- **Slug pre-flight pattern** (Plan 03-03) — `.eq("slug", x).is("deleted_at", null).maybeSingle()` for create; add `.neq("id", id)` for update. This is the SINGLE source of truth for slug uniqueness among active rows. Race-defense: catch `error.code === "23505"` (Postgres unique_violation) and return slug fieldError.
- **Lazy booking count in DeleteConfirmDialog** (Plan 03-04) — Count fetched via `useEffect(() => ..., [open, eventTypeId])` with Supabase browser client, `{ count: "exact", head: true }`, `.neq("status", "cancelled")`. Cancellation flag (`let cancelled = false`) prevents stale fetch from updating state if dialog closes before query resolves. Avoids N count queries on list render.
- **RestoreCollisionDialog: standalone Dialog, not nested** (Plan 03-04) — Uses top-level `<Dialog>` as sibling to `<DeleteConfirmDialog>` in RowActionsMenu. Mounting conditional (`{collisionSlug && ...}`) keeps it out of the DOM when unused. Radix nested-modal focus-trap issues are the reason — confirmed by RESEARCH Open Q3.
- **router.refresh() required after non-redirecting actions** (Plan 03-04) — `toggleActiveAction`, `softDeleteEventTypeAction`, `restoreEventTypeAction` all call `revalidatePath()` then return data (no redirect). The client MUST call `router.refresh()` afterward to trigger re-fetch of the Server Component. Without it, UI stays stale even after cache invalidation.
- **URL param as server-driven filter state** (Plan 03-04) — `ShowArchivedToggle` writes `?archived=true` via `router.replace`; the Server Component awaits `searchParams` (Next 16 Promise) and queries accordingly. Toggle state survives refresh, is shareable as a URL, and requires no client-side state management.
- **useTransition + direct-call + NEXT_REDIRECT re-throw** (Plan 03-05) — EventTypeForm's `onSubmit` calls `await createEventTypeAction(values)` inside `startTransition(async () => { ... })`. The `try/catch` MUST re-throw errors whose `digest` starts with `"NEXT_REDIRECT"` so Next.js navigation succeeds. This pattern replaces `useActionState` for actions using structured input (not FormData).
- **zodResolver `as any` cast for z.coerce fields** (Plan 03-05) — Zod v4 `z.coerce.number()` and `z.coerce.boolean()` have `unknown` input types. `@hookform/resolvers v5` infers from the schema input type, conflicting with `useForm<OutputType>`. Cast `zodResolver(schema) as any` to resolve — type-level only, runtime correct.
- **slugManuallyEdited flag** (Plan 03-05) — Create mode: slug auto-fills from name via `slugify()` until user edits slug (detected by typed slug diverging from `slugify(name)`). Edit mode: starts `true` so saved slug is never auto-overwritten. Future forms with slug auto-fill MUST implement this pattern.
- **UrlPreview domain placeholder** (Plan 03-05) — `yoursite.com/nsi/[slug]` is hardcoded. Phase 7 swaps the domain to per-account branded domain. Do NOT bind to live Vercel URL (`calendar-app-xi-smoky.vercel.app`) — Phase 7 needs atomic domain swap.
- **Controller required for Switch and Select (confirmed Plan 03-05)** — Both `is_active` (EventTypeForm) and question `required` + `type` (QuestionList) use `Controller`. Radix UI primitives do not forward DOM refs; `register()` silently no-ops. All future forms MUST use Controller for Switch and Select.
- **date-fns v4 + @date-fns/tz v1 runtime deps** (Plan 04-01) — `date-fns@4.1.0` + `@date-fns/tz@1.4.1` installed as runtime (not dev) deps. `formatInTimeZone` does NOT exist in `@date-fns/tz`; use `TZDate` and `tz()` instead. Any future npm install of `date-fns-tz` (the v2/v3-era package) is a mistake. Sanity guard: `tz.formatInTimeZone === undefined`.
- **shadcn CLI v4.5.0 installs calendar + react-day-picker@9.14.0** (Plan 04-01) — CLI auto-upgraded from 4.4.0 (Phase 3) to 4.5.0; no breaking changes; `radix-ui` monorepo package pattern still holds. `components/ui/calendar.tsx` wraps `DayPicker`. `.day-blocked`/`.day-custom` CSS classes in `app/globals.css` used via `modifiersClassNames` prop in Plan 04-05.
- **accounts availability settings columns** (Plan 04-01) — `buffer_minutes INT NOT NULL DEFAULT 0`, `min_notice_hours INT NOT NULL DEFAULT 24`, `max_advance_days INT NOT NULL DEFAULT 14`, `daily_cap INT NULL`. `daily_cap NULL` = no cap. CHECK: `daily_cap IS NULL OR daily_cap > 0`. Migration idempotent (IF NOT EXISTS). Applied live 2026-04-25. nsi row: (0, 24, 14, NULL).
- **Availability data layer: direct-call action contract** (Plan 04-03) — 4 Server Actions in `app/(shell)/app/availability/_lib/actions.ts` accept structured TS objects (`WeeklyRulesInput`, `DateOverrideFormInput`, `AccountSettingsInput`), NOT FormData. Plans 04-04 + 04-05 call `await saveWeeklyRulesAction({...})` from RHF `onSubmit`. Mirrors Phase 3 lock.
- **Empty windows = closed weekday** (Plan 04-03) — `saveWeeklyRulesAction({ day_of_week, windows: [] })` deletes all rules for that day (= Closed). No `is_open` column. Presence/absence of rows IS the open/closed state (CONTEXT lock). UI toggle to Closed sends empty array.
- **Date override mutual exclusion in action layer** (Plan 04-03) — `upsertDateOverrideAction` always deletes ALL rows for `(account_id, override_date)` FIRST, then inserts the new shape. Prevents mixed is_closed+windows state (RESEARCH Pitfall 5). DB schema allows both; action is the enforcement point.
- **No transaction wrapper for delete+insert pairs** (Plan 04-03) — supabase-js has no explicit tx API. Worst case (delete ok, insert fails): day/date shows Closed until retry. Acceptable for v1 single-tenant. Fix path if needed: Postgres RPC wrapping the pair.
- **AvailabilityActionState** (Plan 04-03) — `{ fieldErrors?: Record<string, string[]>; formError?: string }`. Empty object `{}` = success. Plans 04-04 + 04-05 check `result.formError`/`result.fieldErrors` and call `router.refresh()` after success (Phase 3 lock: required after non-redirecting actions).
- **Window overlap validation** (Plan 04-03) — `findOverlap`: sort windows by `start_minute`, check `end_minute > next.start_minute`. Touching boundaries (end == next.start) are NOT overlaps — adjacent windows valid. Error message names conflicting pair in HH:MM format. Validated on save, not on blur (RESEARCH §6 lock).
- **`addMinutes(midnight, startMinute)` is DST-UNSAFE for window endpoints** (Plan 04-02) — adds elapsed UTC milliseconds, not wall-clock minutes. On spring-forward day, `addMinutes(midnight_CST, 540)` = 10:00 CDT not 9:00 CDT. Fix: `new TZDate(y, m-1, d, Math.floor(min/60), min%60, 0, TZ)`. Use `addMinutes` ONLY for cursor advancement inside the slot loop (elapsed-time between slots is intended).
- **`TZDate.toISOString()` returns offset format, not UTC Z** (Plan 04-02) — @date-fns/tz v1.4.1 `TZDate.toISOString()` returns `T09:00:00-05:00` not `T14:00:00.000Z`. Use `new Date(tzDate.getTime()).toISOString()` for UTC Z output. RESEARCH.md was wrong on this point.
- **`TZDate.getDay()` (method call) is TZ-aware** (Plan 04-02) — confirmed by AVAIL-09 spring-forward Sunday tests (day_of_week=0). Use `tzDate.getDay()` not `getDay(tzDate)` from date-fns.
- **Buffer-overlap removes upstream adjacent slot** (Plan 04-02) — with buffer=15min and booking 10:00-10:30, slots 9:30, 10:00, AND 10:30 are removed (3 total, not 2). The 10:30 slot's buffered range overlaps the booking tail. Plans consuming computeSlots should expect aggressive buffering.
- **`computeSlots()` pure function contract** (Plan 04-02) — NO `new Date()` inside; `now` MUST be injected via `SlotInput.now`. Caller (Plan 04-06 route handler) pre-fetches all data. Step size = `durationMinutes` (no separate step param). Daily cap: caller MUST filter cancelled bookings before passing `bookings` array. Returns sorted `Slot[]`; empty for blocked/cap-reached/no-rules days (no `cap_reached` flag).

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
- **dotenv quoting trap** — leading-`#` values silently parse as empty strings. Plan 02-04 Task 2 and Plan 03-01 Task 2 both tripped over this. Fixed locally in `.env.local` (TEST_OWNER_PASSWORD now quoted). Any env value starting with `#` MUST be double-quoted. Future plans involving env values should add to failure-mode tables.

### Live Resources

- **GitHub:** https://github.com/ajwegner3-alt/calendar-app (public, `main` branch)
- **Vercel:** https://calendar-app-xi-smoky.vercel.app/ (production; auto-deploys on every push to `main`)
- **Supabase:** project `Calendar`, ref `mogfnutxrrbtvnaupoun`, region West US 2, Postgres 17.6.1
- **Seeded account:** `slug=nsi`, id `ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_user_id=1a8c687f-73fd-4085-934f-592891f51784` (Andrew, linked Plan 02-04)
- **Andrew's auth user:** UUID `1a8c687f-73fd-4085-934f-592891f51784`, email `ajwegner3@gmail.com`, email_confirmed_at set, RLS verified

### Blockers

None.

## Session Continuity

**Last session:** 2026-04-25 — Phase 4 Plans 02 + 03 both complete. Slot engine + 15 AVAIL-09 DST tests (02) and _lib/ data layer (03) both pushed.

**Next action:** Phase 4 Plans 04-04 (weekly editor + settings panel) and 04-05 (overrides UI) — Wave 3. Slot engine + data layer both ready.

**Phase 4 plan status:**
- ✅ Plan 04-01 (deps + accounts migration) — complete, pushed (2026-04-25)
- ✅ Plan 04-02 (slot engine + computeSlots + AVAIL-09 DST tests) — complete, pushed (2026-04-25)
- ✅ Plan 04-03 (data layer + server actions) — complete, pushed (2026-04-25)

**Phase 3 plan status (final):**
- ✅ Plan 03-01 (schema migration: deleted_at + partial unique index) — complete, pushed
- ✅ Plan 03-02 (9 shadcn primitives + Sonner Toaster mounted at root) — complete, pushed
- ✅ Plan 03-03 (slugify + Zod schemas + 5 Server Actions with race-defense) — complete, pushed
- ✅ Plan 03-04 (list page + table + kebab + 2-tier delete + restore-collision dialogs) — complete, pushed (Wave 3 parallel)
- ✅ Plan 03-05 (create/edit routes + form + custom-questions sub-form + URL preview) — complete, pushed (Wave 3 parallel)
- ✅ Phase verifier (2026-04-24) — 20/20 must-haves passed, no gaps; 5 advisory human-test items for Phase 9 manual QA

**Phase 3 key decisions (folded into history):**
- **Direct-call action contract** — Wave-3 form calls `await createEventTypeAction(values)` from RHF `onSubmit` (NOT via `<form action>`); avoids FormData-can't-serialize-nested-arrays pitfall for `custom_questions`. Tradeoff: loses progressive enhancement (acceptable for owner-only dashboard).
- **Partial unique index over plain unique constraint** — `event_types_account_id_slug_active WHERE deleted_at IS NULL` replaces the old `unique(account_id, slug)`. Load-bearing for restore-with-slug-reuse UX. Pattern reusable for any future soft-deleted entity with a per-tenant slug.
- **Lazy booking count fetch in delete dialog** — fetched after dialog mounts (with `useEffect` cancellation flag), not in list query. Avoids blocking kebab-open and complicating list SELECT. `{ count: "exact", head: true }` filtered to non-cancelled bookings.
- **NEXT_REDIRECT re-throw in form's catch** — direct-call actions still hit `redirect()` on success which throws NEXT_REDIRECT; the form's catch checks `digest.startsWith("NEXT_REDIRECT")` and re-throws so Next handles it. Pattern to reuse in any direct-call form.
- **shadcn@4.4 uses radix-ui monorepo** — single `radix-ui@^1.4.3` package (NOT individual `@radix-ui/react-*`). Future verification scripts should grep for `radix-ui`, not `@radix-ui/react-dropdown-menu` etc.
- **Sonner mounted at root layout, not shell** — `<Toaster />` lives in `app/layout.tsx` so toasts work even on routes outside the shell (login). Shell layout has none (would double-mount).
- **Zod v4 + RHF resolver v5 friction** — `zodResolver(eventTypeSchema) as any` cast in EventTypeForm because `z.coerce` fields have `unknown` input types that conflict with `useForm<EventTypeInput>`. Type-only workaround; no runtime impact. Revisit when @hookform/resolvers ships proper Zod v4 input-type support.
- **CTE caveat for migration smoke tests** — Postgres CTEs run concurrently within a single statement, so `WITH archived AS (UPDATE ...) INSERT ...` does not see the UPDATE. Use sequential statements (UPDATE; INSERT;) for migration smokes that depend on order.

**Phase 2 plan status (final):**
- ✅ Plan 02-01 (login + auth actions) — complete, pushed (4 commits)
- ✅ Plan 02-02 (dashboard shell + nav stubs) — complete, pushed (4 commits)
- ✅ Plan 02-03 (proxy gate + authenticated RLS Vitest scaffold) — complete, pushed (4 commits)
- ✅ Plan 02-04 (auth user provisioning + smoke + TooltipProvider fix) — complete, pushed (4 commits)
- ✅ Phase verifier (2026-04-24) — 19/19 must-haves passed, no gaps

**Files of record:**
- `.planning/PROJECT.md` — what + why
- `.planning/REQUIREMENTS.md` — 73 v1 requirements
- `.planning/ROADMAP.md` — 9 phases
- `.planning/research/` — domain-level research (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY)
- `.planning/phases/01-foundation/` — Phase 1 CONTEXT, RESEARCH, 3 PLANs, 3 SUMMARYs, VERIFICATION
- `.planning/phases/02-owner-auth-and-dashboard-shell/` — CONTEXT, RESEARCH, 4 PLANs, 4 SUMMARYs, VERIFICATION
- `.planning/phases/03-event-types-crud/` — CONTEXT, RESEARCH, 5 PLANs, 5 SUMMARYs, VERIFICATION
- `.planning/config.json` — depth, mode, parallelization, model profile (balanced), workflow toggles (all 3 on)

---
*State updated: 2026-04-24 after Phase 3 close-out (verifier 20/20)*
