# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-25 (Phase 5 verified — verifier status: human_needed; 11/11 must-haves passed; 10 manual QA gates deferred to Phase 9)

## Project Reference

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox - no phone tag, no back-and-forth.

**Current focus:** Phase 5 (Public Booking Flow) COMPLETE — all 7 plans done. Booking flow end-to-end: visitor → page → form → POST → redirect → confirmation screen. Ready for Phase 6 (Cancel + Reschedule Lifecycle) || Phase 7 (Widget + Branding) || Phase 8 (Reminders + Hardening).

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Phase:** 6 (Cancel + Reschedule Lifecycle) — In progress
**Plan:** 2 of 6 plans complete (06-02 done — ICS extension + rate limiter + cancel/reschedule email senders)
**Status:** Phase 6 in progress. Plans 06-03..06-06 ready.
**Last activity:** 2026-04-26 — Completed 06-02 (buildIcsBuffer extension, lib/rate-limit.ts, send-cancel-emails.ts, send-reschedule-emails.ts; 8ba4f43 + 9c608f4 + 893e428)
**Progress:** [████░░░░░] 4 / 9 phases complete (Phase 5 code complete; Phase 9 QA pending; Phase 6 in progress)

```
Phase 1  [✓] Foundation                              (verified 2026-04-19)
Phase 2  [✓] Owner Auth + Dashboard Shell            (verified 2026-04-24)
Phase 3  [✓] Event Types CRUD                        (verified 2026-04-24)
Phase 4  [✓] Availability Engine                     (verified 2026-04-25)
Phase 5  [✓] Public Booking Flow + Email + .ics      (code complete 2026-04-25; Phase 9 manual QA pending)
Phase 6  [ ] Cancel + Reschedule Lifecycle
Phase 7  [ ] Widget + Branding
Phase 8  [ ] Reminders + Hardening + Dashboard List
Phase 9  [ ] Manual QA & Verification
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 5 / 9 |
| Phases complete | 5 / 9 |
| Requirements mapped | 73 / 73 |
| Requirements complete | 37 / 73 (FOUND-01..06; AUTH-01..04; DASH-01; EVENT-01..06; AVAIL-01..09; BOOK-01..07; EMAIL-01..04) |

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
- **Admin client for /api/slots (public endpoint)** (Plan 04-06) — `/api/slots` is hit by unauthenticated Phase 5 booking-page visitors; RLS-scoped client silently returns 0 rows for anon callers. `createAdminClient()` (service-role) used. Safety: reads scoped to resolved `account_id`; no writes; inputs validated by UUID + date regex before any query; `import "server-only"` gates client-bundle inclusion.
- **Bookings range padded ±1 UTC day** (Plan 04-06) — `from`/`to` are local YYYY-MM-DD dates. A booking at Chicago local 11pm has a later UTC timestamp. Bookings query uses `${from}T00:00:00.000Z .. ${to}T23:59:59.999Z`; engine filters precisely by local-date in account TZ.
- **server-only Vitest alias** (Plan 04-06) — `lib/supabase/admin.ts` has `import "server-only"` which throws in Vitest node env. Added `resolve.alias["server-only"]` in `vitest.config.ts` pointing to `tests/__mocks__/server-only.ts` (no-op export). Required for any future route handler integration test. Use `path.resolve(__dirname, ...)` not `new URL(...).pathname` on Windows (spaces encode as `%20` and break resolution).
- **Direct NextRequest for route handler tests** (Plan 04-06) — `NextRequest` from `next/server` constructs correctly in Vitest node environment. Tests construct `new NextRequest(url)` directly (not casting plain `Request`). This is the pattern for all future `app/api/*/route.ts` integration tests.
- **Plain useState per weekday row (no RHF)** (Plan 04-04) — WeekdayRow holds only a `TimeWindow[]` array. RHF overhead not justified for 7 identical uniform sub-forms. Phase 3 used RHF for 8+ heterogeneous fields — different case.
- **Mon-first display order in weekly editor** (Plan 04-04) — `WeeklyRulesEditor` renders `[1,2,3,4,5,6,0]` (Mon→Sat→Sun). Standard UX (Calendly, Google Calendar). Postgres `day_of_week = 0..6 = Sun..Sat` preserved in data layer.
- **TimeWindowPicker exports minutesToHHMM + hhmmToMinutes** (Plan 04-04) — Named exports so Plan 04-05 can import them for date-overrides custom_hours modal. Path: `app/(shell)/app/availability/_components/time-window-picker.tsx`.
- **PLAN-04-05-REPLACE-START/END comment markers in page.tsx** (Plan 04-04) — Date-overrides section fenced with markers for Plan 04-05 patch. Contract: (1) create `_components/date-overrides-section.tsx`, (2) uncomment import line, (3) replace placeholder paragraph with `<DateOverridesSection overrides={state.overrides} />`. DONE — markers replaced in Plan 04-05.
- **Two-button mode toggle for Block/Custom-hours in OverrideModal** (Plan 04-05) — shadcn Tabs not installed. Two `<Button>` elements (variant="default" active, variant="outline" inactive) handle the 2-option Block/Custom-hours toggle without an extra dep (~80 LOC saved). Pattern reusable for any 2-option toggle that doesn't justify full Tab nav.
- **Date input disabled in Edit mode (OverrideModal)** (Plan 04-05) — Changing the date in Edit mode would require tracking original date to delete it before inserting at new date. Forcing remove+add is simpler and explicit. The action's delete-all-for-date semantic assumes date is stable during an upsert.
- **Calendar marker rendering uses local browser TZ for Date objects** (Plan 04-05)
- **Public booking page loader pattern** (Plan 05-04) — `loadEventTypeForBookingPage(accountSlug, eventSlug)` in `app/[account]/[event-slug]/_lib/load-event-type.ts`: `server-only`, `createAdminClient()`, `RESERVED_SLUGS.has(accountSlug) → return null`, account by slug, event_type by `(account_id, slug)` filtered `.eq('is_active', true).is('deleted_at', null)`. Returns null on ANY miss; page calls `notFound()`. Same service-role pattern as /api/slots.
- **Reserved-slug guard locked** (Plan 05-04) — `["app", "api", "_next", "auth"]` in `RESERVED_SLUGS` Set in `load-event-type.ts`. Phase 7 MAY add `"embed"` if `/embed/[account]/[slug]` route is introduced. Guard lives in loader (not in proxy.ts) so it fires for both `page.tsx` and `generateMetadata`.
- **PLAN-05-06 patch markers** (Plan 05-04 → executed Plan 05-06) — Markers replaced: real `import { BookingShell } from "./_components/booking-shell"` added; inline stub function removed; `@ts-expect-error` directive removed. page.tsx is now clean.
- **formOnlySchema.pick() split** (Plan 05-06) — `useForm<FormValues>` holds only `bookerName/bookerEmail/bookerPhone/answers`. Server-required fields (`eventTypeId/startAt/endAt/bookerTimezone/turnstileToken`) are injected at submit time from props/state. Full `bookingInputSchema` validates the assembled payload. Same `zodResolver(...) as any` cast as Phase 3 lock.
- **Managed Turnstile widget (CONTEXT decision #4 revised)** (Plan 05-06) — `<Turnstile ref={turnstileRef} siteKey={...} />` with NO `size` prop. Cloudflare auto-decides between silent pass and visible checkbox. `turnstileRef.current?.reset()` called on EVERY error path (409/400/403/5xx/network) — RESEARCH Pitfall 5 (token is single-use).
- **409 race-loser flow** (Plan 05-06) — RaceLoserBanner renders ABOVE SlotPicker (not a toast/modal). Form values (name/email/phone/answers) preserved. `refetchKey` bumped so SlotPicker immediately re-fetches /api/slots. Banner dismissed when user picks a new slot. CONTEXT decision #5 locked copy.
- **refetchKey integer pattern** (Plan 05-06) — Parent owns `refetchKey: number` state; child's useEffect includes it in dependency array; parent bumps `k => k + 1` to trigger re-fetch without unmounting child. Reusable for any child that needs externally-triggered refetch.
- **Browser TZ SSR safety** (Plan 05-06) — `useState(account.timezone)` for initial server render; `useEffect(() => setBookerTz(Intl.DateTimeFormat().resolvedOptions().timeZone), [])` replaces on mount. Server HTML uses owner TZ; hydration swaps to browser TZ.
- **day-has-slots CSS marker** (Plan 05-06) — Added to `app/globals.css`: `.day-has-slots { position: relative }` + `.day-has-slots::after { background: var(--color-accent); ... }`. Mirrors Phase 4 `.day-blocked`/`.day-custom` pattern. `modifiersClassNames={{ hasSlots: "day-has-slots" }}` in SlotPicker Calendar.
- **Radio custom questions: native input + Controller** (Plan 05-06) — No shadcn RadioGroup (not installed). Native `<input type="radio">` with RHF `Controller` render prop. Controller required because native radio doesn't forward ref to RHF. Phase 7 can swap to shadcn RadioGroup if installed.
- **BookingShell prop contract (Wave 2 → Wave 3 LOCKED)** (Plan 05-04) — `{ account: AccountSummary; eventType: EventTypeSummary }` from `app/[account]/[event-slug]/_lib/types.ts`. Plan 05-06 MUST consume identical shape.
- **generateMetadata double-load** (Plan 05-04) — Both `generateMetadata` and `BookingPage` call `loadEventTypeForBookingPage()` (two DB round-trips per request). Acceptable for v1; Phase 8 can add `import { cache } from 'react'` wrapper if latency becomes a concern.
- **Client owns slot fetch** (Plan 05-04) — Server Component does NOT prefetch slots. `BookingShell` (Plan 05-06) calls `/api/slots` after browser TZ detection. Server-side prefetch would use server TZ → wrong slot times for non-Chicago visitors. Correctness constraint.
- **`accounts.owner_email` denormalized (not joined from auth.users)** (Plan 05-01) — nullable TEXT column on accounts; simpler for admin-client public route handlers (`/api/bookings` has no auth session); survives auth provider migrations. nsi seeded with `ajwegner3@gmail.com`. Plain `text` (not `citext`) — no lookup or uniqueness need. Downstream code MUST handle null gracefully (skip owner notification, omit .ics ORGANIZER).
- **`supabase db query --linked` link confirmed working** (Plan 05-01) — `supabase link --project-ref mogfnutxrrbtvnaupoun` was already established; STATE.md concern resolved. CLI fallback is viable for future migrations without needing MCP. — shadcn Calendar (react-day-picker v9) requires JavaScript `Date` objects for modifiers prop. Override dates are YYYY-MM-DD in account-local TZ. Using `new Date(y, m-1, d)` (browser-local midnight) is an acceptable simplification — visual markers only; the string identity passed to the action is always correct. Threading account.timezone to this component would be over-engineering.
- **OverridesList groups DateOverrideRow[] by override_date** (Plan 04-05) — Multiple window rows for one date (custom_hours) are consolidated into a single Card with comma-separated window strings. `groupOverrides()` utility function sorts dates ascending and sorts each group's windows by start_minute.
- **Vendor @nsi/email-sender into lib/email-sender/ (Plan 05-02)** — CONTEXT decision #11 LOCKED: vendoring (NOT `npm install ../email-sender`) because Vercel build cannot resolve sibling-relative `file:../` paths. Future updates require manual re-copy from sibling. Minimal set: index.ts + types.ts + providers/resend.ts + utils.ts (utils required by resend provider for stripHtml). Gmail provider and templates not copied — Phase 5 is Resend-only.
- **server-only on lib/email-sender/index.ts (Plan 05-02)** — `import "server-only"` as line 1 (mirrors lib/supabase/admin.ts pattern). RESEND_API_KEY is a server secret; module must never leak into client bundles.
- **ical-generator v10 ICalEventData uses `id` not `uid` field (Plan 05-03)** — `createEvent({ id: booking.id, ... })` not `{ uid: booking.id, ... }`. The getter/setter method on the returned event object is `uid()` but the input data field is `id`. TypeScript catches the mismatch at build time. Output in .ics is `UID:<value>` — semantically identical.
- **No explicit `from` field in any email send call (Plan 05-03)** — `sendEmail` singleton constructs `defaultFrom = "${GMAIL_FROM_NAME} <${GMAIL_USER}>"` from env vars automatically. Passing explicit `from` overrides the singleton and breaks Gmail SMTP auth. Modules pass only `to`, `subject`, `html`, optionally `replyTo` (owner notification) and `attachments` (booker confirmation).
- **Cancel/reschedule URL format LOCKED (Plan 05-03)** — `${appUrl}/cancel/${rawToken}` and `${appUrl}/reschedule/${rawToken}`. `rawToken` = pre-hash UUID; Phase 6 route handlers consume at these paths. Format must not change.
- **appUrl passed as parameter to sendBookingConfirmation (Plan 05-03)** — Caller (Plan 05-05 Route Handler) resolves `process.env.NEXT_PUBLIC_APP_URL` with fallback to `https://calendar-app-xi-smoky.vercel.app` and passes as `appUrl`. Not read inside the module — keeps module testable and env resolution in one place.
- **Fire-and-forget email contract (Plan 05-03)** — `sendBookingEmails()` uses `Promise.allSettled` + per-sender `.catch(console.error)`. Never throws. Route Handler calls `void sendBookingEmails(...)` after returning 201 — email failure MUST NOT roll back booking.
- **POST /api/bookings is a Route Handler (NOT Server Action) (Plan 05-05)** — Server Actions cannot return 409; locked since RESEARCH Pitfall 1. `export async function POST(req: NextRequest)` in `app/api/bookings/route.ts`.
- **Token generation pattern (Plan 05-05)** — `generateBookingTokens()` in `lib/bookings/tokens.ts` uses `crypto.randomUUID()` + Web Crypto `crypto.subtle.digest("SHA-256", ...)` → hex. Raw tokens passed ONLY to `sendBookingEmails()`; hashes stored in DB `cancel_token_hash`/`reschedule_token_hash`. 201 response body NEVER contains raw tokens.
- **No pre-flight slot validity check (Plan 05-05)** — `bookings_no_double_book` partial unique index is the authoritative race gate. Pre-flight `computeSlots()` adds latency without closing the race window (gap between check and INSERT). Plan 05-08 integration tests verify the 409 path.
- **Error code vocabulary (Plan 05-05)** — `BAD_REQUEST | VALIDATION | TURNSTILE | NOT_FOUND | SLOT_TAKEN | INTERNAL`. All error responses include machine-readable `{error, code}`. 409 body uses CONTEXT decision #5 verbatim: `"That time was just booked. Pick a new time below."`.
- **redirectTo format LOCKED (Plan 05-05)** — `/${account.slug}/${eventType.slug}/confirmed/${booking.id}`. Matches Plan 05-04 + 05-07 confirmation route. Client (Plan 05-06 booking form) `router.push(redirectTo)` on 201.
- **Confirmation route: UUID-as-soft-auth + cross-tenant defense-in-depth (Plan 05-07)** — Route keyed by `booking.id` UUID v4 (122-bit entropy ≈ unguessable). Service-role read bypasses RLS. Defense-in-depth: URL account-slug and event-slug verified against DB-resolved booking parents. Any mismatch → `notFound()`. Page exposes only what's already in booker's email (date/time, owner name, masked email stub) — acceptable PII surface at this auth level.
- **Email masking pattern LOCKED (Plan 05-07)** — `maskEmail("andrew@example.com")` → `"andrew@e***.com"`. Local part shown in full; domain-name replaced with first-char + `max(2, len-1)` stars; TLD shown in full. Function exported from `page.tsx`; reusable for any public PII display surface.
- **Confirmation route status-branch (Plan 05-07)** — `status === "confirmed"` → happy-path card; any other status → friendly "no longer active" fallback. Phase 6 cancel/reschedule may flip status to `"cancelled"` or `"rescheduled"` — this URL remains stable and graceful. No code change needed in this route when Phase 6 ships.
- **generateMetadata only (no module-level metadata export) (Plan 05-07)** — Next.js 16 build fails if both are exported from the same `page.tsx`. `generateMetadata` is the correct pattern for dynamic titles. `robots: { index: false, follow: false }` returned from every branch including 404 fallback.
- **is_active + deleted_at filter on event_type in confirmation loader (Plan 05-07)** — Archived event types' old booking confirmations 404 on revisit (acceptable v1 behavior; booker has all details in email). Privacy: soft-deleted event types' bookings should not be browsable.
- **Rate limiting deferred to Phase 8 INFRA-01 (Plan 05-05)** — Turnstile provides bot protection in v1; full per-IP/per-email rate limiting is Phase 8 hardening.
- **Postgres-backed rate limiting for Phase 6 token routes (Plan 06-01)** — `rate_limit_events(id bigserial PK, key text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now())` table with composite index `(key, occurred_at)`. No RLS (service-role admin client only). No `expires_at` column (window length lives in `lib/rate-limit.ts`). No UNIQUE constraint on `(key, occurred_at)` (concurrent requests must each be recorded). Phase 8 pg_cron sweep can clean up old rows.
- **`supabase db query --linked 'SQL'` positional arg syntax (Plan 06-01)** — The `--execute` flag does not exist in this project's Supabase CLI version. Inline SQL for ad-hoc verification must be passed as a positional argument. Confirmed: `npx supabase db query --linked "SELECT count(*) FROM rate_limit_events;"` works correctly.
- **buildIcsBuffer EXTEND pattern (Plan 06-02 Open Question A resolved)** — Optional `method?: ICalCalendarMethod` (default REQUEST) + `sequence?: number` (default 0) added to existing function. Phase 5 callers unchanged. CANCEL branch sets `ICalEventStatus.CANCELLED` (belt-and-suspenders for non-iTIP clients). `event.sequence()` called explicitly on every invocation (ical-generator v10 does NOT auto-increment).
- **sendCancelEmails reason-callout rule (Plan 06-02)** — Reason callout renders ONLY for the OPPOSITE party of the cancel trigger and ONLY when reason is non-empty. No "Reason: (none)" empty cells. Owner-cancel branch: booker email is apologetic + includes "Book again" CTA to re-book.
- **cancelled.ics filename for cancel .ics (Plan 06-02)** — Cancel attachment is named `cancelled.ics` (not `invite.ics`). Reschedule attachment keeps `invite.ics`. Non-iTIP clients see the filename in their attachment panel — makes intent clear.
- **checkRateLimit fails OPEN on DB error (Plan 06-02)** — Transient Supabase hiccup must not lock out a legitimate booker. Log + allow. Consistent with RESEARCH §Rate-Limit Storage Backend Decision.
- **sendRescheduleEmails token contract (Plan 06-02)** — `rawCancelToken` + `rawRescheduleToken` are the FRESH tokens for the NEW booking (after reschedule token rotation). Plan 06-03 generates them; Plan 06-02 senders embed them in links. Booker-tz times for booker email; account-tz for owner email (same pattern as Phase 5).
- **vitest.config.ts alias-level mock interception (Plan 05-08)** — `@/lib/turnstile` and `@/lib/email-sender` aliased to `tests/__mocks__/` via `path.resolve(__dirname, ...)`. Alias-level is preferred over `vi.mock()` for route-handler integration tests (avoids ESM hoisting issues). Pattern reusable for any future server-only module needing mock interception.
- **`sendEmail` spy asserts `>= 1` (not `== 2`) (Plan 05-08)** — Both `send-booking-confirmation.ts` and `send-owner-notification.ts` call `sendEmail`. Owner notification is conditional on `accounts.owner_email` being non-null. Assert `>= 1` to stay env-tolerant; assert `[0].to === bookerEmail` to confirm the booker confirmation fired.
- **Test event_type seeded on `nsi` (not `nsi-test`) for bookings-api tests (Plan 05-08)** — The POST handler resolves `account` by `event_type.account_id`. Using `nsi` account guarantees valid `slug/name/timezone/owner_email` for `redirectTo` assertion and email routing. Race-guard tests (`bookings_no_double_book`) require the event_type to be active + not soft-deleted — `nsi` account satisfies all preconditions. Cleanup: `afterAll` hard-deletes the temp event_type from `nsi` after the run.
- **daily_cap empty string → null at form boundary** (Plan 04-04) — `SettingsPanel` converts empty string to `null` before calling `saveAccountSettingsAction`. DB CHECK rejects 0; null = no cap. Coercion at component boundary, not in the action.
- **Locked Phase 5 forward contract: {slots: Array<{start_at, end_at}>}** (Plan 04-06) — Response shape from `/api/slots` is LOCKED here. Do NOT add `cap_reached`, `timezone`, or other top-level fields without updating Phase 5 consumers. Empty array = "no times available" — Phase 5 renders friendly empty-state.

### Carried Concerns / Todos

- **Tidy up legacy JWT `SUPABASE_SERVICE_ROLE_KEY`** — swap for `sb_secret_*` format in `.env.local` + Vercel env UI before any security-sensitive phase (target: Phase 8 hardening).
- **`supabase link` confirmed working** (Plan 05-01 resolved) — `supabase db query --linked -f` succeeded cleanly. Link already established; no action needed for future CLI-apply migrations.
- **Pre-existing `contact_submissions` table** (11 rows, unrelated) coexists in `public` schema on the Calendar Supabase project. No impact on booking app. Andrew can drop it from the dashboard anytime.
- Phase 4 needs `/gsd:research-phase` (date-fns/tz v4 + slot algorithm).
- Phase 5 needs `/gsd:research-phase` (.ics across clients + `@nsi/email-sender` attachment API).
- Phase 7 needs `/gsd:research-phase` (Next 16 per-route CSP + static `widget.js` on Vercel — note: Next 16 not 15).
- Phase 8 needs `/gsd:research-phase` (Vercel Cron hobby-tier limits + Resend DNS format).
- ~~Confirm `@nsi/email-sender` attachment signature before Phase 5 plan.~~ RESOLVED: vendored in Plan 05-02; attachment API in EmailAttachment interface (filename, content, contentType).
- **CHECKPOINT PENDING (Plan 05-02 Task 2):** Andrew must set TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL in both .env.local AND Vercel Production env before Plans 05-03+ can proceed. Resume signal: "env vars set".
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

**Last session:** 2026-04-26 — Phase 6 Plan 06-02 complete. buildIcsBuffer extended; lib/rate-limit.ts created; send-cancel-emails.ts + send-reschedule-emails.ts created. All 4 utility modules ready for Plan 06-03 consumers (8ba4f43 + 9c608f4 + 893e428).

**Next action:** Plan 06-03 — implement `lib/bookings/cancel.ts` + `lib/bookings/reschedule.ts` (shared business logic using the senders from 06-02).

**Phase 6 plan status:**
- ✅ Plan 06-01 (rate_limit_events migration — table + composite index, applied to remote DB) — complete, pushed (2026-04-26, 26a9030)
- ✅ Plan 06-02 (lib/rate-limit.ts + ICS extension + cancel/reschedule email senders) — complete, pushed (2026-04-26, 8ba4f43 + 9c608f4 + 893e428)
- [ ] Plan 06-03 (cancel + reschedule shared functions)
- [ ] Plan 06-03 (cancel + reschedule shared functions)
- [ ] Plan 06-04 (public token routes — /cancel/[token] + /reschedule/[token])
- [ ] Plan 06-05 (owner bookings detail page + cancel)
- [ ] Plan 06-06 (integration tests + manual QA)

**Phase 5 plan status:**
- ✅ Plan 05-01 (accounts.owner_email migration + seed nsi) — complete, pushed (2026-04-25, dcbe764)
- ✅ Plan 05-02 (vendor @nsi/email-sender + Gmail provider + deps) — complete, pushed (2026-04-25)
- ✅ Plan 05-03 (Zod bookingInputSchema + Turnstile verify + .ics builder + email senders + orchestrator) — complete, pushed (2026-04-25, 2d31d73 + 6bb45a5)
- ✅ Plan 05-04 (public booking page Server Component shell) — complete, pushed (2026-04-25, bad6b2a + a608f9e)
- ✅ Plan 05-05 (POST /api/bookings route handler + token helper) — complete (2026-04-25, 3d3e0de + 7743869)
- ✅ Plan 05-06 (BookingShell client components — calendar + slot picker + form + race-loser banner + page.tsx swap) — complete, pushed (2026-04-25, f803e43 + b717c08)
- ✅ Plan 05-07 (confirmation screen route /[account]/[event-slug]/confirmed/[booking-id]) — complete, pushed (2026-04-25, 2320777)
- ✅ Plan 05-08 (integration tests for POST /api/bookings — 9 cases: race-safe 409, Turnstile mock, email spy, no raw tokens) — complete, pushed (2026-04-25, 1e280aa + 44df424; 54/54 tests passing)

**Phase 4 plan status:**
- ✅ Plan 04-01 (deps + accounts migration) — complete, pushed (2026-04-25)
- ✅ Plan 04-02 (slot engine + computeSlots + AVAIL-09 DST tests) — complete, pushed (2026-04-25)
- ✅ Plan 04-03 (data layer + server actions) — complete, pushed (2026-04-25)
- ✅ Plan 04-04 (weekly editor + settings panel UI) — complete, pushed (2026-04-25)
- ✅ Plan 04-05 (date overrides UI: calendar + list + modal) — complete, pushed (2026-04-25)
- ✅ Plan 04-06 (/api/slots GET handler + 13-test integration suite) — complete, pushed (2026-04-25, Wave 3 parallel)

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
*State updated: 2026-04-25 after Phase 5 Plan 05-05 (POST /api/bookings + token helper)*
