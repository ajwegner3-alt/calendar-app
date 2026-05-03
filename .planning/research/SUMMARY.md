# Project Research Summary

**Project:** calendar-app v1.5 — Per-Event-Type Buffer + Audience Rebrand + Booker 3-Column Redesign
**Domain:** Multi-tenant Calendly-style booking tool for service-based businesses
**Researched:** 2026-05-03
**Confidence:** HIGH

---

## Executive Summary

The v1.5 milestone is simpler than it initially appears because the target buffer column already exists. The v1.0 initial schema (`20260419120000_initial_schema.sql`) created `event_types.buffer_after_minutes INT NOT NULL DEFAULT 0` on day one; it was never wired to the slot engine. This eliminates the ADD COLUMN migration entirely — v1.5 only needs a backfill UPDATE and the two-step CP-03 DROP of `accounts.buffer_minutes`, the column that has been acting as the account-wide proxy. All three features are implementable with the current installed stack; zero new npm packages are required.

The three features are architecturally independent. Buffer touches the deepest layers (schema, slot engine, route handler, event-type editor, availability settings); Rebrand is a surface-level copy pass across six touch sites in five files; and the Booker redesign is a CSS grid restructure in two components. The orchestrator has locked the phase order as Buffer first, Rebrand second, Booker redesign third. This ordering avoids merge conflicts on `lib/slots.ts` (the most-touched file) and ensures each phase ships clean before the next begins.

The dominant risk is the CP-03 two-step DROP protocol for `accounts.buffer_minutes`. This is not a new pattern — v1.2 Phase 21 executed an identical four-column DROP with a 772-minute drain window. The pre-flight gate (grep to confirm zero live reads before the DROP migration runs) and the 30-minute minimum drain window are hard blockers, not suggestions. The Booker redesign carries a secondary risk around the conditional vs. always-mounted form column: Turnstile token expiry forces the conditional mount pattern to be preserved, which means the form column reveal must use a placeholder div swapped for BookingForm on slot pick, not a CSS visibility toggle over an always-mounted form.

---

## Key Findings

### Recommended Stack

All three v1.5 features are implementable with the existing stack. Verified against live source files on 2026-05-03. No dependency additions, no Tailwind config changes, no new shadcn components, and no AST tooling (ts-morph, jscodeshift) required.

**Core technologies (unchanged from v1.4):**
- **Supabase (Postgres):** Schema already has `event_types.buffer_after_minutes`; migration scope is backfill + DROP only
- **Next.js 15 App Router:** All API routes and server actions follow existing patterns; no new routing needed
- **Tailwind v4:** Bracket syntax `lg:grid-cols-[auto_1fr_320px]` is first-class JIT; same syntax already used in `booking-shell.tsx:77`
- **shadcn/ui Calendar:** Intrinsic width ~280px; `auto` grid column tracks this correctly without overriding the component
- **`echo | npx supabase db query --linked -f`:** The only working migration apply path in this repo (supabase db push --linked is broken due to orphan timestamps in the remote tracking table — established in v1.2, confirmed current)

### Expected Features

**Must have (table stakes — all three are P1):**
- Per-event-type post-buffer via `event_types.buffer_after_minutes` with owner UI in event-type editor
- DROP `accounts.buffer_minutes` via CP-03 two-step protocol (schema correctness prerequisite)
- Owner-facing copy rebrand: "trade contractors" to "service-based businesses" across ~6 touch sites
- 3-column desktop booker layout: calendar LEFT / times MIDDLE / form RIGHT at lg: (1024px+)

**Should have (competitive differentiators — defer to v1.6+):**
- Pre-event buffer (`buffer_before_minutes`): schema column exists at 0; no user request yet
- Animated form slide-in on slot pick: visual polish only
- Buffer display badge on event-type card in owner list: low priority

**Explicitly out of scope for v1.5 (anti-features):**
- Buffer stored in `end_at` — breaks the reschedule invariant and Phase 27 EXCLUDE constraint semantics
- Industry/business-type onboarding question — generic copy covers all verticals
- Timezone re-selector in form column — duplicates PUB-14 element above the card
- Turnstile visible before slot pick — burns bot-protection tokens
- Skeleton loader in empty form column — misleading UX (form is waiting for input, not loading)
- Audience copy on booker-facing surfaces — rebrand is owner-facing only

### Architecture Approach

The slot engine change is a signature update to `slotConflictsWithBookings`: instead of one account-wide `bufferMinutes`, it now receives (a) the candidate slot event-type buffer as a scalar, and (b) each existing booking event-type buffer embedded in `BookingRow`. The `/api/slots` route handler gains a join on `event_types` for the bookings query and drops `buffer_minutes` from the accounts SELECT. The event-type form gains one number input; the availability settings panel loses its buffer control. The Booker redesign collapses the nested 2-col grid in `slot-picker.tsx` into the parent 3-col grid owned by `booking-shell.tsx`.

**Major components touched in v1.5:**

| Component | Phase | Change |
|-----------|-------|--------|
| `lib/slots.types.ts` | Buffer | BookingRow gains buffer_after_minutes; AccountSettings loses buffer_minutes |
| `lib/slots.ts` | Buffer | slotConflictsWithBookings reads per-booking buffer; computeSlots passes event-type buffer |
| `app/api/slots/route.ts` | Buffer | Bookings query gains event_types!inner join; account SELECT drops buffer_minutes |
| `app/(shell)/app/event-types/_components/event-type-form.tsx` | Buffer | Add buffer_after_minutes number input |
| `app/(shell)/app/event-types/_lib/schema.ts` | Buffer | Add z.coerce.number().int().min(0).max(360) for buffer_after_minutes |
| `app/(shell)/app/availability/_components/settings-panel.tsx` + 4 siblings | Buffer A2 | Remove buffer_minutes field entirely |
| `app/(auth)/_components/auth-hero.tsx` | Rebrand | Rewrite 2 string literals |
| `README.md` | Rebrand | Rewrite line 3 description |
| `app/[account]/[event-slug]/_components/booking-shell.tsx` | Booker | Grid lg:grid-cols-[1fr_320px] to lg:grid-cols-[auto_1fr_320px]; max-w-3xl to max-w-4xl |
| `app/[account]/[event-slug]/_components/slot-picker.tsx` | Booker | Remove internal lg:grid-cols-2 wrapper; calendar and slot list become direct grid children |

**Unchanged by all phases:** `booking-form.tsx`, `race-loser-banner.tsx`, public booker `page.tsx`, embed shell, `public-shell.tsx`, `components/ui/calendar.tsx`.

### Critical Pitfalls

1. **Column naming collision (V15-CP-01)** — `buffer_after_minutes` and `buffer_before_minutes` already exist on `event_types`; adding `post_buffer_minutes` would create a third overlapping column. LOCKED: reuse `buffer_after_minutes`. See Locked Decisions.

2. **CP-03 two-step DROP (V15-CP-03)** — Dropping `accounts.buffer_minutes` in the same deploy that stops reading it causes 500s during Vercel stale-instance drain. Protocol: code deploy first, 30-minute minimum drain, then DROP migration. Pre-flight gate: `grep -rn "buffer_minutes" app/ lib/` must return zero before DROP runs.

3. **Slot engine type contract (V15-CP-04)** — Every caller of `computeSlots` must update synchronously when `AccountSettings.buffer_minutes` is removed. A stale test fixture that passes `buffer_minutes: 15` on the account object while the engine has stopped reading that field will compile but silently fail to apply the buffer. Update test fixtures at the same time as the type change.

4. **Per-event-type divergence test gap (V15-CP-05)** — No existing test covers two event types on the same account with different buffer values. Add two new test cases to `slot-generation.test.ts` before shipping Phase 1.

5. **Turnstile conditional mount (V15-MP-05)** — Always-mounted BookingForm (CSS visibility toggle) causes Turnstile to render on page load; its 2-minute token expires before most users complete slot selection. Keep the conditional mount pattern: placeholder div before slot pick, BookingForm mounted on slot pick.

6. **Embed inherits 3-column automatically via lg: breakpoint** — Realistic iframe widths never reach 1024px. No embed-specific code branch needed. (LOCKED — see LD-05.)

---

## Locked Decisions

These decisions are final. They resolve all open questions surfaced by the 4 research agents. The roadmapper and phase planners must treat these as constraints, not open questions.

**LD-01: Reuse `event_types.buffer_after_minutes` — do NOT add `post_buffer_minutes`.**
The v1.0 schema already created `buffer_after_minutes INT NOT NULL DEFAULT 0` on `event_types`. Wiring it up eliminates the ADD COLUMN migration step entirely. The TypeScript type `EventTypeRow` at `event-types/_lib/types.ts:43-44` already declares it; the edit page SELECT at `[id]/edit/page.tsx:18` already fetches it.

**LD-02: Leave `buffer_before_minutes` untouched.**
Exists at DEFAULT 0 for all rows. Preserves the option to ship pre-event buffer in v1.6+ without a migration. Do NOT remove from schema. Do NOT expose in the event-type editor UI in v1.5.

**LD-03: Backfill `event_types.buffer_after_minutes` from `accounts.buffer_minutes` per account.**
Migration SQL: `UPDATE event_types et SET buffer_after_minutes = a.buffer_minutes FROM accounts a WHERE et.account_id = a.id`. Run pre-flight first: `SELECT id, slug, buffer_after_minutes FROM event_types WHERE buffer_after_minutes <> 0` must return zero rows. Andrew confirmed pre-event buffer is not needed at this time — accounts with symmetric `buffer_minutes=15` will have `buffer_after_minutes=15` and `buffer_before_minutes=0`.

**LD-04: Buffer asymmetry semantics — post-buffer is per-event-type, applied asymmetrically.**
Event A with `buffer_after_minutes=15` blocks slots 15 minutes after any Event A booking. Event B with `buffer_after_minutes=0` does NOT block adjacent slots. `slotConflictsWithBookings` checks the existing booking buffer against the candidate slot start time, and the candidate slot buffer against any existing booking end time. This is the correct asymmetric implementation and does not need re-confirmation.

**LD-05: Embed widget stays single-column automatically via `lg:` breakpoint.**
`embed-shell.tsx` passes directly to `<BookingShell>`. The 3-column grid template fires only at lg: (1024px+). Realistic iframe widths are 320-600px. No embed-specific code branch, no variant prop. This overrides V15-CP-11.

**LD-06: `max-w-4xl` (896px) for the booker card.**
Change `booking-shell.tsx` from `max-w-3xl` (768px) to `max-w-4xl` (896px). At 896px: ~280px calendar + ~160px slot list + ~320px form = ~760px used of 896px available. Do NOT change `PublicShell`.

**LD-07: Rebrand is copy-only — no TypeScript identifier renames.**
Grep confirms zero `tradeContractor*` / `contractor*` camelCase/PascalCase identifiers in `app/` or `lib/`. The entire rebrand is 6 touch sites across 5 files: 2 string literals in `auth-hero.tsx`, 1 developer comment in `booking-form.tsx` (leave untouched — internal reasoning comment), `README.md` line 3, and 3 mentions in `FUTURE_DIRECTIONS.md`. Archived `.planning/` files from v1.0-v1.4 are historical records — do not amend.

**LD-08: Phase order is Buffer then Rebrand then Booker Redesign.**
Buffer touches `lib/slots.ts` (most-touched file) and carries the CP-03 ordering constraint. Rebrand is independent and trivial; it acts as a momentum phase between complex schema work and the layout refactor. Booker redesign is purely visual.

**LD-09: CP-03 two-step DROP protocol is REQUIRED for `accounts.buffer_minutes`.**
Identical to v1.2 Phase 21. Two separate migration files, two separate deploys, 30-minute minimum drain between them. DROP migration file held local during drain window. Author a `.SKIP` rollback artifact per CP-03 convention.

---

## Suggested Phase Structure

### Phase 1: Per-Event-Type Buffer Wire-Up (A1 + A2)

**Rationale:** Buffer has the most complex ordering constraint (CP-03 two-step) and touches the deepest stack layers. The locked column name (`buffer_after_minutes`) is already in the TypeScript type — minimum diff surface.

**Internal sequencing (hard ordering — do not reorder):**

| Step | Action | Gate |
|------|--------|------|
| A1-pre | Pre-flight: `SELECT buffer_after_minutes FROM event_types WHERE buffer_after_minutes <> 0` returns 0 rows | Hard stop if non-zero |
| A1-db | Apply backfill migration via `echo | npx supabase db query --linked -f` | Verify distinct values |
| A1-code | Code deploy: slots.types.ts, slots.ts, route.ts, event-type-form.tsx, schema.ts, actions.ts, tests | tsc --noEmit passes; all buffer tests pass |
| A1-deploy | Push to Vercel; confirm deployment | Deploy log green |
| DRAIN | Wait minimum 30 minutes; do NOT apply DROP migration | Mandatory hold |
| A2-gate | `grep -rn "buffer_minutes" app/ lib/` returns zero live reads | Hard stop if any matches |
| A2-db | Apply DROP migration: `ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes` | Verify column absent |
| A2-code | Remove buffer_minutes from availability panel, schema, actions, queries, types, page | tsc --noEmit passes |
| A2-deploy | Push to Vercel; confirm deployment | Deploy log green |

**Delivers:** `buffer_after_minutes` wired to slot engine; `accounts.buffer_minutes` dropped; owner can set buffer per event type in event-type editor; availability settings panel cleaned up; per-event-type divergence tests passing.

**Addresses:** LD-01, LD-03, LD-04, LD-09
**Avoids:** V15-CP-01, V15-CP-02, V15-CP-03, V15-CP-04, V15-CP-05, V15-CP-06, V15-MP-01, V15-MP-02

**Research flag:** Well-documented — CP-03 established in v1.2 Phase 21; STACK.md has complete line-by-line touch site maps. Skip `/gsd:research-phase`.

---

### Phase 2: Audience Rebrand (Copy-Only)

**Rationale:** Fully independent; zero shared files with Phases 1 and 3. Ships fast (6 touch sites, 5 files). Clean momentum win between complex schema work and visual layout work.

**Delivers:** `auth-hero.tsx` 2 string literals updated; `README.md` opening description updated; `FUTURE_DIRECTIONS.md` 3 mentions updated; `booking-form.tsx:138` developer comment left untouched; archived planning files left as historical records.

**Addresses:** LD-07
**Avoids:** V15-CP-07 (multi-line grep misses), V15-CP-08 (booker copy untouched), V15-CP-09 (no history rewrite), V15-MP-03 (no identifier rename)

**Execution note:** Use VSCode global search with case-insensitive regex for "contractor" rather than terminal grep — catches JSX text nodes split across lines. Audit each hit manually; apply file-by-file, not bulk replace.

**Research flag:** No research phase needed. Touch sites fully enumerated in STACK.md and ARCHITECTURE.md.

---

### Phase 3: Public Booker 3-Column Desktop Layout

**Rationale:** Purely visual; no schema or API changes. Phase 1 must be complete first for stable `EventTypeSummary` type. Doing this last means no concurrent migration risk.

**Delivers:** `booking-shell.tsx` gets `lg:grid-cols-[auto_1fr_320px]` and `max-w-4xl`; form `<aside>` always rendered with content-swap (not conditional mount); `slot-picker.tsx` internal 2-col wrapper removed; Calendar and slot list become direct parent grid children; timezone hint moves to top of slot list column (col 2); `justify-self-center` on Calendar preserved for mobile; mobile stacks calendar then times then form; embed stacks at narrow iframe widths automatically via `lg:` breakpoint; no layout shift on form reveal.

**Addresses:** LD-05, LD-06
**Avoids:** V15-CP-10, V15-CP-11, V15-MP-04, V15-MP-05, V15-MP-06, V15-mp-02, V15-mp-03

**Manual QA required:** Verify at 1024px, 1280px, 1440px — no horizontal overflow, all three columns visible. Verify embed at 320px, 480px stacks correctly. Verify no layout shift during slot pick by watching calendar column position while clicking a time slot.

**Research flag:** No research phase needed. Two-file change fully specified in ARCHITECTURE.md.

---

## Cross-Phase Notes

**Parallel safety:** All three phases are independently developable at the code level. Sequential execution chosen to avoid merge conflicts and maintain clean deploy checkpoints. Do not start Phase 2 until Phase 1 A2 deploy is confirmed. Do not start Phase 3 until Phase 2 is committed.

**Soft dependency:** `app/[account]/[event-slug]/_lib/types.ts` gains `buffer_after_minutes` on `EventTypeSummary` in Phase 1. Phase 3 touches components that read `EventTypeSummary`. Phase 3 does not read `buffer_after_minutes` in layout logic — maintain phase order and no conflict exists.

**Deploy ordering for Buffer phase (CP-03):** Four distinct git commits: (1) backfill migration SQL applied via db query, (2) A1 code pushed to Vercel, (3) 30-minute drain hold with DROP file held local, (4) DROP migration applied then A2 code pushed.

**Test coverage gate:** `vitest run tests/slot-generation.test.ts` must pass after A1 code changes and again after A2. New per-event-type divergence test cases must be written in A1 before A1 deploys.

**Vercel deploy confirmation:** Confirm each Vercel deploy log before proceeding to the next step. Do not batch buffer + rebrand + booker changes into a single push.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings verified against live source files; zero npm changes required; migration apply path confirmed from v1.2 precedent |
| Features | HIGH | Buffer behavior confirmed against live codebase; rebrand surface map from direct file inspection; booker layout confirmed against current source |
| Architecture | HIGH | All file paths verified by Read tool; component boundaries confirmed; touch site table complete |
| Pitfalls | HIGH (buffer/rebrand), MEDIUM (booker layout) | Buffer and rebrand pitfalls sourced from live codebase and v1.2 precedent; booker layout competitor patterns limited by auth walls on Calendly/Acuity |

**Overall confidence:** HIGH

### Gaps to Address

- **Booker layout at production:** No leading tool ships a simultaneous 3-column calendar+times+form layout — the NSI v1.5 design is original. The `[auto_1fr_320px]` column template is well-reasoned but requires manual QA at the `lg:` breakpoint before Phase 3 is marked done.
- **Pre-flight buffer column check:** `SELECT id, slug, buffer_after_minutes FROM event_types WHERE buffer_after_minutes <> 0` must return zero rows before backfill runs. If any non-zero rows exist (manually set via Supabase dashboard), decide whether to preserve or overwrite before migration applies.
- **Embed at exactly 1024px:** If a client embeds in a container exactly 1024px wide (uncommon), the 3-column layout fires. Likely desirable; confirm during Phase 3 QA.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection, 2026-05-03)

| Source | What Was Verified |
|--------|------------------|
| `supabase/migrations/20260419120000_initial_schema.sql:35-36` | buffer_before_minutes and buffer_after_minutes exist on event_types since v1.0 |
| `supabase/migrations/20260425120000_account_availability_settings.sql` | accounts.buffer_minutes added Phase 4 |
| `lib/slots.ts:203-218, 277` | slotConflictsWithBookings signature; account.buffer_minutes passed |
| `lib/slots.types.ts:15` | AccountSettings.buffer_minutes field confirmed |
| `app/api/slots/route.ts:89,121,160` | Full buffer read chain confirmed |
| `app/(shell)/app/availability/` (5 files) | All buffer_minutes read/write sites confirmed |
| `app/(shell)/app/event-types/_lib/types.ts:43-44` | EventTypeRow already has buffer_after_minutes |
| `app/(shell)/app/event-types/[id]/edit/page.tsx:18` | Edit page SELECT already includes buffer_after_minutes |
| `app/(auth)/_components/auth-hero.tsx:21,42` | 2 contractor copy touch sites confirmed |
| `app/[account]/[event-slug]/_components/booking-form.tsx:138` | Comment-only contractor reference confirmed |
| `README.md:3`, `FUTURE_DIRECTIONS.md:62,226,232` | Documentation touch sites confirmed |
| `app/[account]/[event-slug]/_components/booking-shell.tsx:77` | Current lg:grid-cols-[1fr_320px] confirmed |
| `app/[account]/[event-slug]/_components/slot-picker.tsx:125` | Current lg:grid-cols-2 inner grid confirmed |
| `app/embed/[account]/[event-slug]/_components/embed-shell.tsx:107` | BookingShell passthrough confirmed |
| `supabase/migrations/20260502034300_v12_drop_deprecated_branding_columns.sql` | CP-03 DROP migration template (Phase 21 precedent) |
| `PROJECT.md paragraphs 196-209` | Two-step DROP deploy protocol documentation |
| `tests/slot-generation.test.ts:32,216` | baseAccount.buffer_minutes fixture locations confirmed |

### Secondary (MEDIUM confidence — official docs)

- Calendly buffer help: "Limits and buffers" section name confirmed; units = minutes
- Cal.com event settings guide: "Limits" tab confirmed; booker view modes confirmed
- Calendly redesign layout: "choosing a day and time happens on the same page" confirmed
- SavvyCal buffer docs: "Buffer Before" / "Buffer After" per-link confirmed
- Acuity buffer help: per-appointment-type, minutes confirmed via WebSearch summary

### Tertiary (LOW confidence)

- Acuity layout details (sourced from SavvyCal Acuity guide, not Acuity directly)

---

*Research completed: 2026-05-03*
*Ready for roadmap: yes*
