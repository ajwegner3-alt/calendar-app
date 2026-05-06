# Project Milestones: Calendar App (NSI Booking Tool)

## v1.6 Day-of-Disruption Tools (Shipped: 2026-05-06)

**Delivered:** Two new operational levers for day-of disruption — inverse date overrides with MINUS semantics (partial-day unavailability with auto-cancel batch) and day-level pushback cascade (smart gap absorption, abort-on-diverge race safety, per-row retry summary) — plus hardened 200/day Gmail SMTP cap as a true refuse-send guard across all 7 email paths. PUSH-10 reason callout wired end-to-end through the booker reschedule email (apology + "Reason:" block when actor='owner'; LD-07 booker-neutrality preserved throughout).

**Phases completed:** 31-33 — 3 phases, 10 plans total.

**Key accomplishments:**

- **Gmail SMTP 200/day hard cap implemented as fail-closed refuse-send guard across all 7 senders (EMAIL-21, EMAIL-24, EMAIL-25)** — Phase 31 extended `quota-guard.ts` with 7 new `EmailCategory` values (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner), closing the v1.1 carve-out that bypassed bookings and reminders. All 5 sender modules call `checkAndConsumeQuota()` before `sendEmail()`. Booking confirmations refused at cap now save-and-flag `bookings.confirmation_email_sent=false` (save-and-flag posture); owner-triggered cancel/reschedule/reminder paths receive synchronous `emailFailed: "quota"` signal. Dashboard banner (`/app/bookings`) self-suppresses when count is 0. 21 new refuse-send tests + PII-free log shape (5 fields: code, account_id, sender_type, count, cap) verified by negative assertion against booker_email/booker_name/booker_phone/ip/answers. Locked owner inline-error UX vocabulary: `text-sm text-red-600` + `role="alert"` + Gmail-fallback hint — reused verbatim across all 3 phases.
- **Inverse date overrides with MINUS semantics + auto-cancel batch with quota pre-flight (AVAIL-01..08, EMAIL-23)** — Phase 32 flipped `windowsForDate()` in `lib/slots.ts` to MINUS semantics: `is_closed=false` rows now subtract unavailable windows from weekly-hours base via new exported `subtractWindows()` helper (O(B×N) hand-rolled interval subtraction; defensive immutability; closed-weekday no-op deliberate). Wipe-and-flip migration `20260505120000` removed 3 legacy custom_hours rows (production diagnostic confirmed only 3 rows — cleaner than CP-03 dual-read). Override modal rewritten from "Enter available times" to "Add unavailable windows" + "Block entire day" hide+preserve toggle + inline affected-bookings preview (booker name + account-TZ times + event-type label). `commitInverseOverrideAction` ships HARD quota pre-flight via `getRemainingDailyQuota()` BEFORE any DB writes or sends; race-safe re-query unions post-write re-query with preview-approved IDs; `skipOwnerEmail=true` suppresses N duplicate owner cancel notifications while preserving booker leg unconditionally (LD-07). Fast path via `upsertDateOverrideAction` retained when affected.length === 0. Andrew human-verified 8/8 scenarios including quota gate (forced 0) and race-safety re-query.
- **Day-level pushback cascade with smart gap absorption and abort-on-diverge race safety (PUSH-01..12, EMAIL-22)** — Phase 33 delivered a 4-plan cascade: dialog shell with day-grouped bookings view and per-day shortcut buttons (Plan 33-01); pure `computeCascadePreview()` module (zero I/O, 1440 sentinel for no-rules days, per-booking slot step using each booking's own `duration_minutes`) + `previewPushbackAction` with EMAIL-22 quota gate (Plan 33-02); `commitPushbackAction` with ABORT-on-diverge race safety (contrast with Phase 32 union — cascade math is order-dependent, any ID set difference aborts entire batch) and 5-variant status taxonomy (`sent`/`email_failed`/`slot_taken`/`not_active`/`skipped`) (Plan 33-03); and per-row `retryPushbackEmailAction` with fresh-token mint, quota guard, and `useTransition` isolation per row (Plan 33-04). Andrew human-verified 8/8 scenarios live.
- **PUSH-10 reason callout wired end-to-end (commit `2aa9177`)** — Closed mid-flight by orchestrator after Phase 33 verifier returned `human_needed`. Reason text threaded through `RescheduleBookingArgs` → `sendRescheduleEmails()` → booker email template; apology line + "Reason:" callout block rendered when `actor='owner'` and `reason` is non-empty. LD-07 booker-neutrality preserved: no NSI branding, no owner identity revealed. Cancel email pattern mirrored (apology + reason block consistent across cancel and reschedule lifecycles).
- **`skipOwnerEmail`/`actor` pattern established as canonical owner-batch email suppression (Phases 32 + 33)** — `cancelBooking(args: CancelBookingArgs)` and `rescheduleBooking(args: RescheduleBookingArgs)` both accept `skipOwnerEmail?: boolean` + `actor?: "booker" | "owner"`, forwarding to `sendCancelEmails({ sendOwner? })` and `sendRescheduleEmails({ sendOwner? })` respectively. Owner-initiated batches suppress N duplicate owner notifications while keeping booker legs unconditional. Reusable pattern for any future owner-batch operation.
- **Critical cross-phase lesson: plans must reference real DB columns** — Phase 33 Plan 33-02 invented non-existent column `booker_first_name` (real column is `booker_name`, full name, v1.0). This caused a silent runtime failure (empty anchor list during live test); caught and fixed by orchestrator in commit `bba0e18`. Future planners must grep migrations before naming DB fields in plan bodies.

**Stats:**

- 3 phases (31: 3 plans, 32: 3 plans, 33: 4 plans), 10 plans, 25 requirements (8 AVAIL + 12 PUSH + 5 EMAIL) — all Complete
- 53 commits across the v1.6 phase span (planning + execution + plan-metadata + phase-completion)
- 78 files changed; +15,365 insertions / -340 deletions vs v1.5 tag baseline (includes `.planning/` planning artifacts)
- 5 production schema changes: `email_send_log.category` CHECK extended to 12 values; `bookings.confirmation_email_sent` boolean column + partial index; `date_overrides` 3 legacy rows wiped + column comments updated; `reschedule_tokens` updated via token-mint pattern on retry
- Test suite at sign-off: 30 of 31 test files pass (~285 tests); vitest `resolve.alias` regex fix (Plan 32-03) raised green-file count from 24/31 to 30/31; lone failing file (`bookings-api.test.ts`) is pre-existing fixture mismatch, not Phase 31-33 regression
- ~2 days from milestone start (`2345095` 2026-05-04) to last commit (`ca02c90` 2026-05-06)
- Andrew human-verified: Phase 31 (6/6 owner UX scenarios), Phase 32 (8/8 scenarios including quota gate + race-safety), Phase 33 (8/8 scenarios including abort-on-diverge + email retry + reason callout)

**Git range:** `2345095` (`docs: define milestone v1.6 requirements`) → `ca02c90` (`docs(33): complete day-level-pushback-cascade phase + close v1.6`)

**Sign-off:** Andrew live-deploy approved each phase — Phase 31 (all 6 owner UX scenarios), Phase 32 (all 8/8 scenarios including EMAIL-23 quota gate forced to 0 and race-safety re-query), Phase 33 (all 8/8 scenarios via Phase 33 verifier pass after PUSH-10 gap closed by orchestrator in commit `2aa9177`). No audit run (`/gsd:audit-milestone` skipped — yolo mode; phase-level verification covered all must-haves). Deploy-and-eyeball is the canonical production gate (6th consecutive milestone).

**What's next:** v1.7 — milestone goals not yet defined. Carryover backlog from v1.0–v1.6: INFRA-01 Resend migration, INFRA-02 Vercel Pro hourly cron, AUTH-23 OAuth, AUTH-24 magic-link, BRAND-22 NSI brand asset, DEBT-01..07 + DEBT-08 (slot-picker.tsx deletion), BUFFER-07/08/09, BOOKER-06/07, EMAIL-26/27 (per-account Gmail / Resend migration). Live-use feedback on the new day-of-disruption tools (inverse overrides + pushback) will drive v1.7 scope.

---

## v1.5 Buffer Fix + Audience Rebrand + Booker Redesign (Shipped: 2026-05-05)

**Delivered:** Three-phase milestone closing 14 requirements over ~2 calendar days. Headline was Phase 28: replaced account-wide `accounts.buffer_minutes` with per-event-type `event_types.buffer_after_minutes` (column already existed at default 0; reused per LD-01 lock). Asymmetric buffer math (LD-04: existing booking's post-buffer pushes back; candidate's own post-buffer pushes forward) shipped to production with 3 BUFFER-06 divergence tests pinning the regression behavior. The `accounts.buffer_minutes` column was permanently dropped via the CP-03 two-step deploy protocol; the 30-minute drain gate was waived with explicit Andrew acceptance under a documented zero-traffic rationale (first formal use of the new drain-waiver pattern). Phase 29 was a 1-plan owner-facing audience rebrand (copy strings only) verified by three independent grep gates. Phase 30 redesigned the public booker into a true 3-column desktop layout (calendar LEFT / times MIDDLE / form RIGHT) with state lifted from `slot-picker.tsx` into `booking-shell.tsx`, fixed 320px form column reservation (zero layout shift on slot pick), and natural mobile vertical stack — Andrew live-verified at 1024 / 1280 / 1440 + mobile real-device.

**Phases completed:** 28-30 — 3 phases, 6 plans total.

**Key accomplishments:**

- **Per-event-type post-event buffer shipped end-to-end (BUFFER-01..06)** — Owner editor at `event-type-form.tsx:304-322` (Input min=0 max=360 step=5; Zod `z.coerce.number().int().min(0).max(360).catch(0)` forgiving numeric input). Asymmetric math (LD-04) at `lib/slots.ts:212-230`: `bufferedStart = addMinutes(slotStartUtc, -b.buffer_after_minutes)` (existing booking's post-buffer extends back, per-booking field) + `bufferedEnd = addMinutes(slotEndUtc, slotBufferAfterMinutes)` (candidate's own post-buffer extends forward, per-candidate field). 3 BUFFER-06 divergence tests at `tests/slot-generation.test.ts:400-496` pin the cross-event-type asymmetric semantics. Backfill migration `20260503221744` populated existing event types from `accounts.buffer_minutes`. Event-types list table renders Buffer column always (LD-01 — even when 0). Availability settings panel scrubbed to 3 fields with subtitle "notice and caps". Andrew live verbatim: *"Looks like cross event is working. All event bookings seem to be working. Owner event pages seem to be working as well."*
- **CP-03 two-step DROP migration completed with formal drain-gate waiver pattern (BUFFER-04)** — `accounts.buffer_minutes` permanently dropped from production Postgres via `20260504004202_v15_drop_accounts_buffer_minutes.sql` (atomic BEGIN/COMMIT with `IF EXISTS` guard) applied via `echo | npx supabase db query --linked -f`. `.SKIP` rollback artifact filed alongside (excluded from migration runner). 30-min drain WAIVED for this deployment with explicit Andrew sign-off documented in STATE.md; rationale: single-tenant nsi product, no public booker traffic in flight, serverless idle-out (~15 min) covers warm-instance protection. New reusable pattern: future served drains remain default; waiver requires explicit Andrew sign-off + STATE.md decision before launch. Post-DROP smoke `/api/slots` returned HTTP 200; `information_schema` zero-row check confirmed column gone.
- **Owner-facing audience rebrand shipped via deterministic grep gate (BRAND-01..03)** — Single batched content commit `0659c0e` (4 files, 7-line diff): `auth-hero.tsx:21` subtext + `:42` tagline rewritten audience-neutral / "service businesses"; `README.md:3` rewritten audience-led drops "Calendly-style" + trade parenthetical; `FUTURE_DIRECTIONS.md:62/226/232` rewritten (`service-business` modifier on 62 for grammatical fit; in-product `owners` term on 226+232); `booking-form.tsx:138` inert dev comment swapped `contractor → owner` per LD-07 narrow override (runtime line 139 byte-identical). Three independent grep gates verified clean: literal `"trade contractor"` 0 matches; broader case-insensitive `contractor` 0 matches in scoped paths; booker-surface neutrality grep `"service business"` 0 matches in `app/[account]/`, `lib/email-sender/`, `app/embed/`. Live smoke explicitly waived per CONTEXT (copy-only). ~2 minute wall-clock baseline (`2026-05-04T01:39:11Z` → `2026-05-04T01:40:59Z`).
- **Public booker 3-column desktop layout shipped (BOOKER-01..05)** — `booking-shell.tsx:180` Tailwind v4 bracket-grid `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]` with `gap-6 p-6` inside `max-w-4xl` section wrapper (was `max-w-3xl`; `<header>` retains `max-w-3xl` intentionally). State lifted from `slot-picker.tsx` into `booking-shell.tsx` — shell now owns slots, loading, fetchError, rangeFrom/To, slotsByDate, markedDates, slotsForSelectedDate, isCompletelyEmpty, the date-range computation, and the canonical async-fetch effect. Calendar + slot list + form column render as direct grid children (single grid owner pattern). Form column always reserved at fixed 320px: `<div>` placeholder before slot pick → `<BookingForm key={selectedSlot.start_at}>` after (V15-MP-05 Turnstile lifecycle lock honored; RHF reset via key prop on re-pick; zero layout shift). Mobile (< 1024px) stacks vertically by natural document order; embed iframe single-column at 320–600px structurally guaranteed by same `lg:` breakpoint with no embed-specific code branch. Andrew quote-on-record verbatim: *"Everything looks good"* — single-phrase blanket approval covering all 7 mandatory checks (A–G) at 1024 / 1280 / 1440 desktop + mobile real-device on production deploy SHA `8b45c50`.
- **Mid-execution Rule 4 architectural-decision pattern introduced and validated (Plan 30-01)** — Plan as written locked `slot-picker.tsx` for deletion. Executor surfaced unanticipated production importer at `app/reschedule/[token]/_components/reschedule-shell.tsx:6` (Phase 6 reschedule flow, live in production). Routed to Andrew with 3 options (A: keep file as Phase-6-only / B: refactor reschedule to absorb the lift / C: extract a shared `<CalendarSlotPicker>`). Andrew chose **Option A** — keep file on disk; deletion deferred until reschedule itself is redesigned. Booker decoupling complete: `booking-shell.tsx:8` no longer imports `SlotPicker` (component); only imports `type Slot` (smallest-diff override of plan-locked refactor moves). Pattern is reusable for any future component-removal phase. New planner discipline: any plan that locks a file deletion MUST grep all importers during research, NOT only at execution time.
- **Verification-only plan pattern reused (Plans 28-03 + 30-02)** — Both plans shipped as zero-code closers with Andrew-quote-on-record SUMMARY format (precedent set in v1.4 Plan 28-03; reused twice in v1.5). Plan 28-03 was 1 metadata commit (full suite + grep + DB all green from prior plans). Plan 30-02 was 1 metadata commit `3118d68` post Andrew's blanket "Everything looks good". Reusable for any future "prove it works in prod" closer.
- **Pattern locked: single grid owner UI + reserved-column conditional-mount** — Parent shell owns grid template; child columns render as direct grid children (no nested grids). Replaces the prior nested 2-col-inside-2-col booker pattern. Reusable for any future multi-column layout where the columns logically belong to the same visual unit. The reserved-column pattern (fixed-width track with `<div>` placeholder swapping to mounted form on state change) gives "form column always visible at fixed width, content swaps in place, zero layout shift, Turnstile token never stales" — reusable for any conditional-mount-with-side-effect component.

**Stats:**

- 6 plans across 3 phases (28: 3, 29: 1, 30: 2) — 14 requirements (BUFFER-01..06 + BRAND-01..03 + BOOKER-01..05) all shipped (100%)
- 31 commits across the v1.5 phase span (planning + execution + plan-metadata + phase-completion); ~6 code commits + ~25 docs/state commits
- 55 files changed; +7,502 insertions / -990 deletions vs v1.4 tag baseline (includes `.planning/` planning artifacts; runtime code diff is much smaller)
- 22,356 LOC TypeScript/TSX in the runtime tree at sign-off (up from 22,071 at v1.3 close; v1.4 added DB constraint without significant LOC change)
- 3 production schema changes: `event_types.buffer_after_minutes` backfilled; `accounts.buffer_minutes` dropped; `.SKIP` rollback artifact filed
- Test suite at sign-off: 228 passing + 9 skipped (without `SUPABASE_DIRECT_URL`); zero regression vs v1.4 baseline; 3 new BUFFER-06 divergence tests added
- Per-phase verifier results: Phase 28 (5/5 must-haves), Phase 29 (5/5), Phase 30 (5/5) — milestone audit cleared 6/6 cross-phase risks; 14/14 requirements satisfied
- ~2 days from milestone start (`ca402a7` 2026-05-03 16:00 -0500) to last commit (`6dc91e8` 2026-05-04 19:44 -0500 = 2026-05-05 00:44 UTC)
- Andrew live-deploy approved each phase (Phase 28 cross-event live verify on `nsi`; Phase 29 copy-only waiver per CONTEXT; Phase 30 live-verify smoke at 1024/1280/1440 + mobile real-device)

**Git range:** `ca402a7` (`docs: start milestone v1.5 Buffer Fix + Audience Rebrand + Booker Redesign`) → `6dc91e8` (`docs(30): complete public-booker-3-column-layout phase`)

**Sign-off:** Andrew live-deploy approved each phase as it shipped — Phase 28 (cross-event-type buffer behavior verified on production nsi; "cross event is working. All event bookings seem to be working. Owner event pages seem to be working as well."), Phase 29 (live smoke explicitly waived per CONTEXT — copy-only scope), Phase 30 (blanket "Everything looks good" on production deploy SHA `8b45c50` covering all 7 mandatory checks A–G at 1024/1280/1440 desktop + mobile real-device). Milestone audit `v1.5-MILESTONE-AUDIT.md` cleared 6/6 cross-phase integration risks. No marathon QA executed; deploy-and-eyeball is the canonical production gate (5th consecutive milestone — operating model since v1.3).

**What's next:** v1.6 — milestone goals not yet defined. Carryover backlog deferred from v1.0–v1.5 (Marathon QA retired, INFRA-01 Resend, INFRA-02 Vercel Pro hourly cron, AUTH-23 OAuth, AUTH-24 magic-link, BRAND-22 NSI brand asset, DEBT-01..07, 3 Phase 26 audit fragilities, BUFFER-07 pre-event buffer wiring, BUFFER-08 list badge, BUFFER-09 step granularity, BOOKER-06 animated form slide-in, BOOKER-07 skeleton loader). v1.5-introduced tech debt: slot-picker.tsx kept on disk per Andrew Option A — date+slot UI duplicated across booking-shell.tsx + slot-picker.tsx; resolve when reschedule UI is itself redesigned (extract shared `<CalendarSlotPicker>`). Live-use feedback during the v1.5 → v1.6 interval will likely drive headline scope as it has for the last three milestones.

---

## v1.4 Slot Correctness + Polish (Shipped: 2026-05-03)

**Delivered:** Live-use feedback milestone closing 11 requirements from Andrew's first week post-v1.3. Headline: contractor-can't-be-in-two-places-at-once invariant sealed at the Postgres layer via account-scoped `EXCLUDE USING gist` constraint with a generated `tstzrange [)` column, mapped end-to-end into a 409 `CROSS_EVENT_CONFLICT` user experience that mirrors the existing SLOT_TAKEN race-loser flow. Owner `/app/bookings` page crash root-caused (RSC boundary violation — `onClick` on a Server Component anchor) and fixed in a 1-line surgical edit with a static-text regression test. Four UI-only polish items shipped on auth (pill removal) and owner-home (calendar selected-color flip + mobile overflow). Two-day milestone; deploy-and-eyeball model carried forward (4th consecutive milestone with no marathon QA, formally the operating model).

**Phases completed:** 25-27 — 3 phases, 8 plans total.

**Key accomplishments:**

- **Slot Correctness invariant sealed at DB layer (SLOT-01..05)** — `bookings_no_account_cross_event_overlap` EXCLUDE constraint live in production: `EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE ((status = 'confirmed'::booking_status))`. Generated `during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)'::text)) STORED` column; `btree_gist` extension. Half-open `[)` bound prevents adjacent-slot false collisions. `event_type_id WITH <>` preserves v1.1 group-booking capacity coexistence (same-event-type bookings still allowed). Pre-flight diagnostic returned 0 cross-event overlap rows on a 6-row bookings table; single-step `ADD CONSTRAINT` chosen (well under 10k threshold). `VALIDATE CONSTRAINT`-aborting hard gate (V14-CP-06) satisfied without manual data resolution.
- **Three-layer error mapping shipped end-to-end (Phase 27)** — Postgres `23P01` → HTTP 409 `CROSS_EVENT_CONFLICT` in `app/api/bookings/route.ts` with V14-MP-01 retry-loop-break (branch BEFORE 23505 check, `break` without `slot_index` increment). `lib/bookings/reschedule.ts` maps 23P01 → existing `slot_taken` reason (V14-MP-02), reusing `/api/reschedule` 409 SLOT_TAKEN response unchanged (no new code path, no copy change). Booker UI 409 handler in `booking-form.tsx` treats CROSS_EVENT_CONFLICT identically to SLOT_TAKEN — generic copy `"That time is no longer available. Please choose a different time."`, same auto-refresh-and-retry behavior. PII-free observability logs (`{code, account_id, event_type_id}` in route.ts; `{code, booking_id}` in reschedule.ts).
- **Bookings page crash root-caused and fixed (BOOK-01, BOOK-02)** — RSC boundary violation at `bookings-table.tsx:93` (`onClick` on a `<a href="tel:...">` anchor inside a Server Component; digest 2914592434). Confirmed via Vercel server logs and reproduced in Supabase SQL Editor. NOT Candidates A-E (data-layer hypotheses from RESEARCH.md). Fix: 1-line deletion. Regression test: Option 1 static text scan (`fs.readFile` + regex). Cross-account verification: 4 live shapes passed; 3 shapes waived with documented rationale (cancelled-only, >50 bookings, soft-deleted event_type — Q2/Q3/Q4 returned 0 production rows).
- **Auth + owner-home surgical polish (AUTH-21/22, OWNER-14/15)** — "Powered by NSI" pill removed from `app/(auth)/_components/auth-hero.tsx`; public `PoweredByNsi` footer kept on booking pages (different surface). Home calendar selected-date flipped to NSI blue (`bg-primary text-primary-foreground`) with hover-guard so `bg-gray-100` doesn't override on selected cells. Mobile cell overflow fixed via `min-w-[var(--cell-size,theme(spacing.8))]` (was `spacing.9`). Shared `components/ui/calendar.tsx` and `globals.css --color-accent` UNTOUCHED — extends Phase 23/24 per-instance-override invariant.
- **Pattern locked: static-text scan tests for control-flow invariants** — Phase 26 introduced `tests/bookings-table-rsc-boundary.test.ts` (regex-asserts no `onClick=` in tel: anchor block). Phase 27 Test 6 (`retry-loop-break`) extended the pattern to assert ordering of branches in `app/api/bookings/route.ts` source. Zero new dependencies. Placed OUTSIDE `describe.skipIf` so tests run in CI without `SUPABASE_DIRECT_URL`. Catches exactly the regression class that other test shapes miss (RSC boundary violations + control-flow invariants in source code).
- **Pattern locked: pre-flight hard-gate checkpoint for VALIDATE-CONSTRAINT-aborting DDL (V14-CP-06)** — read-only diagnostic SQL run BEFORE migration; non-zero result rows STOP the workflow and surface to user for manual data resolution; do NOT auto-cancel programmatically. Reusable for any future EXCLUDE / unique constraint / partial-WHERE migration where existing rows could violate the new invariant. Pattern: pre-flight → checkpoint:human-verify → migrate (only after gate passes).
- **Andrew live sign-off on production** — booked 10:00–10:30 on `nsi` (production account); cross-event re-book at 10:00 correctly rejected. Phase B (raw curl) Turnstile-blocked; acceptable per plan's explicit `partial: A passed, B blocked by Turnstile` allowance. Buffer-related observation about the 10:30 slot resolved as pre-existing v1.0 `accounts.buffer_minutes=15` on `nsi` (`lib/slots.ts:203` `slotConflictsWithBookings`), unmodified by Phase 27. Andrew chose option (a) keep buffer behavior; surfaced BUFFER-01 candidate (event-type-scoped buffer) for v1.5 consideration.

**Stats:**

- 8 plans across 3 phases (25: 2, 26: 3, 27: 3)
- 50 commits across the v1.4 phase span (planning + execution + plan-metadata + phase-completion + milestone-close)
- 4 files created (3 SQL migrations + 1 test file `tests/cross-event-overlap.test.ts`); 4 files modified (`route.ts`, `reschedule.ts`, `booking-form.tsx`, `bookings-table.tsx`); 1 prior test file added in Phase 26 (`bookings-table-rsc-boundary.test.ts`)
- 1 production schema change: `btree_gist` extension + `bookings.during` generated column + `bookings_no_account_cross_event_overlap` EXCLUDE constraint
- Test suite at sign-off: 225 passing + 9 skipped without `SUPABASE_DIRECT_URL` (≥230 + 4 with DIRECT_URL set; 5 of the 6 new pg-driver tests skip cleanly per V14-MP-05)
- 2 days from milestone start (`33c24d7` 2026-05-02 22:00) to milestone close (`09c07de` 2026-05-03)

**Git range:** `33c24d7` (`docs: start milestone v1.4 Slot Correctness + Polish`) → `09c07de` (`docs(27): complete slot-correctness-db-layer-enforcement phase`)

**Sign-off:** Andrew live-deploy approved each phase as it shipped — Phase 25 (AUTH-21/22 + OWNER-14/15 instant approvals), Phase 26 (BOOK-01/02 after cross-account live verification), Phase 27 (SLOT-01..05 after Phase A UI smoke on `nsi`). No marathon QA executed; deploy-and-eyeball is the canonical production gate (4th consecutive milestone with no marathon QA — formally the operating model since v1.3).

**What's next:** v1.5 — milestone goals not yet defined. Carryover backlog deferred from v1.0/v1.1/v1.2/v1.3/v1.4 (Marathon QA, Resend, Vercel Pro, OAuth, magic-link, brand asset, ~7 tech-debt items, 3 deferred fragilities from Phase 26, BUFFER-01 candidate from Phase 27 smoke). Live-use feedback during the v1.4 → v1.5 interval will likely drive headline scope, as it did for v1.3 → v1.4.

---

## v1.3 Bug Fixes + Polish (Shipped: 2026-05-02)

**Delivered:** Surgical bug-fix and polish milestone closing 8 items from Andrew's post-v1.2 live use — auth signup-link fix + login layout flip + 30-day session TTL verification, public booking mobile centering + desktop layout-collision fix + account-index browser title, and owner-side home calendar de-orange + copyable per-event booking-link field. Mid-checkpoint scope expansion added a per-row copy-link button on the event-types list page and flipped the dropdown menu focus highlight from orange to NSI blue. Same-day milestone (~10 hours scope-lock to ship) on the strength of surgical scope and parallel wave execution. Marathon QA formally adopted as deploy-and-eyeball (third consecutive deferral; carryover backlog deferred to v1.4 in entirety).

**Phases completed:** 22-24 — 3 phases, 6 plans total.

**Key accomplishments:**

- **Auth fixes shipped (AUTH-18, AUTH-19, AUTH-20)** — `publicAuthPaths.includes()` exact-match in `lib/supabase/proxy.ts` closes the broken signup-link from `/login` (root cause was `pathname.startsWith()` missing exempt paths). Login page columns swapped (`AuthHero` LEFT, form RIGHT) preserving the v1.2 `lg:` breakpoint to avoid regression. Session TTL verified via `@supabase/ssr@0.10.2` 400-day cookie default + Supabase hosted dashboard zero timebox/inactivity; `proxy.ts setAll` patched to forward cache-control headers via `Object.entries(headers ?? {})` defensively against CDN cache poisoning during token rotation. ROADMAP success criterion #3 (close-browser-reopen-next-day) tracked observationally.
- **Public booking layout fixes shipped (PUB-13, PUB-14, PUB-15)** — mobile slot picker calendar centered via `justify-self-center` (canonical grid-item alignment property; first attempt with `mx-auto` failed Andrew's live mobile test, corrected mid-verify in commit `23973c9`). Desktop timezone hint hoisted above `grid lg:grid-cols-2` wrapper as full-width sibling via React fragment root, eliminating the layout collision with the calendar. Public account-index page browser title locked to `Book with ${data.account.name}` via `generateMetadata()`; the event-type cards listing UI was already in place from a prior phase, so PUB-15 reduced to a metadata-only fix.
- **Owner UI polish shipped (OWNER-12, OWNER-13) + mid-checkpoint scope expansion** — `home-calendar.tsx` DayButton de-oranged: hover = `bg-gray-100 + text-gray-900`, selected = `bg-gray-700 + text-white`, today = `bg-muted + font-semibold + ring-1 ring-gray-300`, has-bookings dot = `#9CA3AF` (inline). Shared `components/ui/calendar.tsx` and `globals.css --color-accent` token UNTOUCHED (3 other consumers preserved: bookings-table hover, cancel-confirm-form hover, public booker `.day-has-slots::after`). New `BookingLinkField` client component renders as first form section in `event-type-form.tsx`, live-updates from `watch("slug")`, copies on click with Copy → Check icon flip ~1.5s. Required-prop typing on `EventTypeForm.accountSlug` forced `new/page.tsx` conversion to async server component. Old `UrlPreview` deleted. Mid-checkpoint feedback absorbed into commit `db7fb62`: per-row `RowCopyLinkButton` on event-types list page (single-click copy, hidden on archived rows) + per-instance `focus:bg-primary focus:text-primary-foreground` overrides on `DropdownMenuItem`s (Edit / Make active|inactive / Get embed code / Restore — Archive retains destructive red). Shared `components/ui/dropdown-menu.tsx` UNTOUCHED.
- **Pattern locked: per-instance className overrides for shared shadcn components** — extends Phase 23's calendar invariant. Phase 24 used the same pattern on `DropdownMenuItem` and `home-calendar.tsx` DayButton. When a CSS custom property is shared across multiple consumers and only ONE needs to change, override at the consumer site (per-instance className or inline style) instead of redefining the token globally.
- **Pattern locked: same-day milestone is viable for surgical scope** — scope lock → REQUIREMENTS.md → ROADMAP.md → 3 phases planned → 3 phases executed via parallel waves → verifier passes → milestone close, all in ~10 hours. Wall-clock from `7f66c33` (v1.2 archive) to `440fdf6` (Phase 24 completion) = 2026-05-02 11:35 → 21:36. Reproducible when scope is < 10 plans and all touch existing surfaces.
- **Marathon QA pattern formalized as deploy-and-eyeball** — third consecutive deferral; v1.0 → v1.1 → v1.2 → v1.3 all chose the same path. Andrew's live deploy approval is now the canonical production gate. QA-09..QA-34 + per-phase manual checks officially deferred to v1.4 with no commitment to execute (formerly tracked as "deferred" with implicit return-soon expectation).

**Stats:**

- 13 files changed across the v1.3 phase span (excluding `.planning/`)
- 326 lines inserted; 126 lines deleted (NET +200 LOC runtime; surgical milestone, not deletion-heavy)
- 22,071 LOC TypeScript/TSX in the runtime tree at sign-off (up from 21,871 at v1.2 close)
- 3 phases, 6 plans, ~9 tasks, 34 commits (including planning + execution + plan-metadata + phase-completion + milestone-close)
- ~10 hours from v1.2 archive (`7f66c33` 2026-05-02 11:35) to last phase commit (`440fdf6` 2026-05-02 21:36) — same-day milestone
- 222 passing + 4 skipped automated tests (26 test files) at sign-off — baseline preserved exactly from v1.2

**Git range:** `7f66c33` (`chore: archive v1.2 milestone`) → `440fdf6` (`docs(24): complete owner-ui-polish phase`)

**Sign-off:** Andrew live-deploy approved each phase as it shipped — Phase 22 (AUTH-18/19 immediately, AUTH-20 observational), Phase 23 (PUB-13/14/15 after `justify-self-center` follow-up), Phase 24 (OWNER-12/13 + mid-checkpoint expansion). Verbatim 2026-05-02 21:35 — *"approved"* on the Phase 24 live deploy verification. No marathon QA executed; deploy-and-eyeball is the production gate (third consecutive deferral, now formally adopted).

**What's next:** v1.4 — execute the third-deferral marathon QA + Resend migration + Vercel Pro upgrade + OAuth/magic-link + final NSI mark image swap + carryover tech debt (DEBT-01..07). See `FUTURE_DIRECTIONS.md` §8 for canonical v1.4 backlog.

---

## v1.2 NSI Brand Lock-Down + UI Overhaul (Shipped: 2026-05-02)

**Delivered:** Unified North Star Integrations visual language across the entire owner-facing app — `bg-gray-50` + blue-blot `BackgroundGlow` + glass "NorthStar" header pill + Inter weights 400-800 — while preserving each contractor's `brand_primary` on public booking surfaces and the 6 transactional emails. Per-account chrome theming stripped from the owner shell. Branding editor collapsed from 5 controls to 2 (logo + `brand_primary`). 4 deprecated `accounts` columns and 2 ENUM types permanently dropped from production Postgres via two-step deploy protocol. First net-deletion milestone (NET -792 lines).

**Phases completed:** 14-21 — 8 phases, 22 plans total.

**Key accomplishments:**

- **Owner shell + auth + onboarding re-skinned to lead-scoring "Simple Light" reference** — `BackgroundGlow` + glass `Header` pill with "NorthStar" wordmark + gray-50 base + Inter weights 400-800 + Roboto Mono. Phase 12.6's `--primary` wrapper div decommissioned; shadcn primary inherits NSI blue-500 directly via `:root --primary`. 14 owner-page cards standardized to `rounded-lg border border-gray-200 bg-white p-6 shadow-sm`. Andrew live-approved on Vercel after Phase 15 deploy.
- **Public booking + embed surfaces unified under `PublicShell`** — replaced legacy `BrandedPage` + `GradientBackdrop` + `NSIGradientBackdrop`. Customer `brand_primary` drives `BackgroundGlow` tint, glass pill (logo or initial circle), and slot-picker `--primary`. Embed widget sets its OWN `--primary` independently (CP-05 confirmed: CSS vars don't cross iframe boundaries). PoweredByNsi footer renders inside iframe. 233 lines legacy chrome deleted in Phase 17. Andrew approved 10/10 visual gates 2026-04-30.
- **Branding editor collapsed from 5 controls to 2** — removed `sidebar_color`, `background_color`, `background_shade` pickers; kept logo uploader + "Booking page primary color". `MiniPreviewCard` rebuilt as faux public booking page (gray-50 + brand-primary blob + white card + slot picker). `saveBrandingAction` deleted entirely (zero callers post-rewrite). Andrew approved 8/8 visual gates 2026-05-01.
- **Email layer simplified atomically** — `EmailBranding` interface collapsed to `{ name, logo_url, brand_primary }`. Color resolution simplified from 3-step `sidebarColor → brand_primary → DEFAULT` chain to `brand_primary → DEFAULT`. All 6 senders + 4 route/cron callers + 2 tests in single atomic deploy (`0130415`). Footer `nsi-mark.png` replaced with text-only "Powered by North Star Integrations". 5th `sendReminderBooker` caller (manual-trigger reminder path) discovered and fixed in same commit.
- **653 lines of deprecated theming dead code deleted** — `chrome-tint.ts`, `shade-picker.tsx`, `branding-chrome-tint.test.ts`, `branding-gradient.test.ts`, `branding-schema.test.ts`. `Branding` interface canonical shape (3 fields: `logoUrl`, `primaryColor`, `textColor`). `brandingFromRow` stripped to 2-param signature. AccountSummary + AccountListingData column drops. Single atomic commit `8ec82d5`.
- **4 deprecated DB columns + 2 ENUM types permanently dropped via two-step deploy protocol** — `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` columns removed from `accounts`. `background_shade` and `chrome_tint_intensity` ENUM types removed from `pg_type`. Pre-flight gates (CP-01 grep + tsc + ENUM existence) → 30-min Vercel function drain (CP-03, satisfied by 25× minimum at 772 minutes overnight) → atomic `BEGIN/COMMIT` migration via locked `db query --linked -f` workaround → 3-query post-verification → real production booking smoke test → §8.4 backlog closure. First production application of the v1.2-locked workflow.
- **Apply method `db query --linked -f` LOCKED.** `npx supabase db push` is broken in this repo (orphan timestamps in remote tracking table per PROJECT.md §200). All schema migrations from v1.1 forward use the workaround. Phase 21 was first DROP migration to use it.
- **First net-deletion milestone in project history.** v1.0 + v1.1 were additive (29,450 LOC at v1.1 close); v1.2 ended at 21,871 LOC TS/TSX in runtime tree (NET -7,579 LOC across the milestone span, including the planning ramp-up; 91 commits, 910 inserted, 1,702 deleted excluding `.planning/`).

**Stats:**

- 74 files changed across the v1.2 phase span (excluding `.planning/`)
- 910 lines inserted; 1,702 lines deleted (NET -792 lines runtime; first net-deletion milestone)
- 21,871 LOC TypeScript/TSX in the runtime tree at sign-off (down from 29,450 at v1.1 close)
- 8 phases, 22 plans, ~80 tasks, 91 commits
- 3 days from kickoff (2026-04-30) to ship (2026-05-02)
- 222 passing automated tests (down from 277 at v1.1 close — 3 deprecated-theming test files deleted in Phase 20)

**Git range:** `9263770` (`feat(14-01): load Inter weights 400-800 + Roboto Mono`) → `d81a990` (`docs(21): complete schema-drop-migration phase`)

**Sign-off:** Andrew confirmed `smoke passed` on Phase 21 production booking 2026-05-02 — booking submitted at `/nsi/30-minute-consultation`, confirmation email arrived with `#0A2540` (NSI `brand_primary`) header band rendered correctly against schema-cleaned `accounts` table.

**What's next:** v1.3 — execute the third-deferral marathon QA (QA-09..QA-13) + ~21 per-phase manual checks accumulated through v1.2 + Resend migration (closes EMAIL-08, ~$10/mo for 5k emails) + Vercel Pro hourly cron flip + final NSI mark image swap + live cross-client email QA + OAuth signup + magic-link login + hard-delete cron + soft-delete grace + slug 301 redirect. See `FUTURE_DIRECTIONS.md` §8 for canonical v1.3 backlog.

---

## v1.1 Multi-User + Capacity + Branded UI (Shipped: 2026-04-30)

**Delivered:** Public multi-user signup with email verification + 3-step onboarding wizard + per-event-type booking capacity (race-safe slot_index mechanism replacing v1.0 partial unique index) + Cruip "Simple Light" visual overhaul across all 5 owner-facing and public surfaces with direct per-account color controls (sidebar / page / primary) wired to shadcn `--primary` CSS variable for full dashboard chrome theming.

**Phases completed:** 10-13 (with decimal Phase 12.5 + 12.6 inserted) — 6 phases, 34 plans total.

**Key accomplishments:**

- **Public multi-user signup + onboarding wizard end-to-end shipped** — `/signup` → email verification via `/auth/confirm` (verifyOtp pattern, closes v1.0 BLOCKER) → 3-step wizard (slug + name + timezone + first event type) → working dashboard with the user's own bookable URL. Postgres SECURITY DEFINER trigger atomically creates stub `accounts` row on `auth.users` INSERT; wizard UPDATEs via RLS-scoped Server Action. Forgot-password + reset-password flows close v1.0 `/auth/callback` 404 BLOCKER.
- **Per-event-type booking capacity with race-safe slot_index mechanism** — `bookings_capacity_slot_idx` ON `(event_type_id, start_at, slot_index) WHERE status='confirmed'` replaces v1.0 `bookings_no_double_book`. CAP-07 distinguishes `SLOT_TAKEN` (cap=1) from `SLOT_CAPACITY_REACHED` (cap>1) for booker UX message branching. CAP-01 root-cause investigation confirmed zero prod duplicate confirmed bookings; rescheduled-status slot reuse documented as accepted structural gap.
- **Cruip "Simple Light" visual overhaul across 5 surfaces** — dashboard (Inter font + bg-gray-50 + flat sidebar IA + Home tab monthly calendar with day-detail Sheet drawer + 4 row actions), public booking page (`py-12 md:py-20` + `max-w-3xl`), embed widget (single-circle gradient pattern, EmbedCodeDialog `sm:max-w-2xl`), 6 transactional emails (solid-color branded header band + plain-text alts on booker-facing senders + NSI footer mark), and 6 auth pages (Cruip split-panel with NSI hero).
- **Direct per-account color controls (Phase 12.6 course-correction)** — three independent color pickers (`sidebar_color` / `background_color` / `brand_primary`) with auto-WCAG text contrast on `--sidebar-foreground` + `--primary-foreground` overrides. First wire-up of `brand_primary` to shadcn `--primary` CSS variable (buttons / switches / focus rings now inherit account branding). IntensityPicker REMOVED; MiniPreviewCard rebuilt as 3-color faux-dashboard preview.
- **RLS cross-tenant matrix extended to N=3 tenants** — 24 new test cases across 8 table×direction combos plus admin-sees-all-3 verification. Plus pg-driver race test (CAP-06) at the postgres.js layer (skip-guarded; runs against prod when `SUPABASE_DIRECT_URL` is set).
- **Email senders unified on per-account tokens** — header band priority chain `sidebar_color → brand_primary → '#0A2540'`. No separate user-controlled email branding fields. Plain-text alts shipped on confirmation + cancel + reschedule (extends EMAIL-10 minimum). Live cross-client QA (Outlook desktop, Apple Mail iOS, Yahoo) deferred to v1.2.
- **Gmail SMTP quota-guard shipped** — 200/day cap via `email_send_log` Postgres counter; 80% threshold logs `[GMAIL_SMTP_QUOTA_APPROACHING]`; fail-closed at cap; bookings/reminders bypass. Resend migration documented as v1.2 backlog (~$10/mo for 5k emails).

**Stats:**

- 239 files changed across the v1.1 phase span
- 33,817 lines inserted; 2,153 lines deleted
- 29,450 LOC TypeScript/TSX in the runtime tree at sign-off
- 6 phases, 34 plans, ~95 tasks (estimated), 135 commits
- 3 days from kickoff (2026-04-27) to sign-off (2026-04-30)
- 277 passing + 4 skipped automated tests (26 test files) at sign-off

**Git range:** `4ae2e92` (first v1.1 commit) → `e3119bc` (`docs(13): close phase + ship v1.1 milestone — Andrew marathon waiver`)

**Sign-off:** Andrew verbatim 2026-04-30 — *"consider everything good. close out the milestone."*

**What's next:** v1.2 — execute the deferred Phase 13 marathon (QA-09..QA-13) + per-phase manual checks accumulated through Phases 10/11/12/12.5/12.6 (~21 items per `MILESTONE_V1_1_DEFERRED_CHECKS.md`) + Resend migration + Vercel Pro hourly cron flip + DROP `accounts.chrome_tint_intensity` + remove `chromeTintToCss` compat export + final NSI mark image swap + live cross-client email QA. See `FUTURE_DIRECTIONS.md` §8 for canonical v1.2 backlog.

---

## v1.0 MVP (Shipped: 2026-04-27)

**Delivered:** A Calendly-style multi-tenant booking tool with race-safe DB-level slot uniqueness, DST-correct slot computation, branded embeddable widget with postMessage height protocol, and end-to-end booking lifecycle (book / confirm / cancel / reschedule / 24h reminder) wired to Andrew's NSI account on Vercel + Supabase.

**Phases completed:** 1-9 (52 plans total)

**Key accomplishments:**

- **DB-level race-safe booking via partial unique index** (`bookings_no_double_book` on `(event_type_id, start_at) WHERE status='confirmed'`) — proven by Vitest race test; two concurrent submits → one 201, one 409 with clean inline-banner UX preserving form values.
- **DST-correct slot engine** (`lib/slots.ts` pure `computeSlots()` + 13-test integration suite) validated against March 8 + Nov 1 2026 US DST transitions with no missing or duplicate slots at the boundary; `TZDate` from `@date-fns/tz` v4 for wall-clock construction, never `addMinutes` for window endpoints.
- **Multi-tenant data layer with RLS cross-tenant matrix** — 6 tables (`accounts`, `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events`) all with `account_id` denormalized + RLS policies; Plan 08-08 RLS matrix test proves a second seeded tenant cannot read or write the first tenant's data via any client context.
- **Branded embeddable widget with `nsi-booking:height` postMessage protocol** — chromeless `/embed/[account]/[event-slug]` route with per-route CSP `frame-ancestors *` (proxy.ts owns CSP exclusively); `/widget.js` Route Handler with 5s handshake timeout; live-verified posting from `https://example.com` 2026-04-26.
- **Full email lifecycle on Gmail SMTP via vendored `@nsi/email-sender`** — booker confirmation + .ics (`METHOD:REQUEST`, stable UID, VTIMEZONE block), owner notification, cancel pair, reschedule pair (`METHOD:REQUEST` SEQUENCE+1), and 24h reminder; per-account branded email blocks (logo header + brand H1 + branded CTA + Powered by NSI footer).
- **Reliable reminder cron with claim-once semantics** — Vercel hourly Cron at `/api/cron/send-reminders` authenticated by `CRON_SECRET`; compare-and-set UPDATE claims `reminder_sent_at` so duplicate cron invocations send exactly one reminder per booking; immediate-send hook for bookings created inside the 24h window.
- **Token-based booker self-service for cancel + reschedule** — SHA-256 hashed tokens in DB, raw tokens only in email; rate-limited at 10/5min/IP via Postgres-backed `rate_limit_events` table; double CAS guard prevents concurrent same-token success; tokens rotate on every reminder send.

**Stats:**

- 344 files created/modified across the 9-phase span
- 85,014 lines inserted total; 20,417 lines of TypeScript/TSX in the runtime tree at sign-off
- 9 phases, 52 plans, ~180 tasks, 222 commits
- 10 days from project start (2026-04-18) to v1 ship (2026-04-27)
- 131 passing + 1 skipped automated tests (16 test files) at sign-off

**Git range:** `e068ab8` (docs: initialize project) → `3f83461` (docs(09): complete manual-qa-and-verification phase)

**What's next:** v1.1 — close deferred QA items (marathon QA execution: 6 ROADMAP criteria + 9 Phase 8 dashboard sub-criteria + per-template branding 6-row smoke + Squarespace/Wix verification + cron-fired-in-prod). See FUTURE_DIRECTIONS.md for canonical v1.1 backlog enumeration.

---
