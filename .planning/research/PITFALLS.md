# Domain Pitfalls — v1.5: Buffer Fix + Audience Rebrand + Booker Redesign

**Domain:** Booking system — per-event-type buffer migration + copy rebrand + booker layout refactor
**Researched:** 2026-05-03
**Covers:** Three parallel feature tracks: BUFFER-01 migration, audience rebrand, 3-column booker

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, silent correctness failures, or 500 errors in production.

---

### V15-CP-01: Schema mismatch — `event_types` already has `buffer_before_minutes` / `buffer_after_minutes`; new column naming must reconcile

**What goes wrong:** The v1.0 initial schema (`20260419120000_initial_schema.sql` lines 35-36) already created `event_types.buffer_before_minutes` and `event_types.buffer_after_minutes` as `int not null default 0`. Both columns exist in production RIGHT NOW. They were stubbed in v1.0 but never wired into the slot engine (Phase 4 lock: "account-wide settings win in v1, event_types columns ignored"). The PROJECT.md v1.5 scope names the new column `event_types.post_buffer_minutes` — a THIRD column name that does not match either existing column.

If the migration adds `event_types.post_buffer_minutes` without first deciding what to do with the existing `buffer_after_minutes` column, the codebase has two semantically overlapping columns for the same concept. The slot engine will read one; the UI form reads the other; silent divergence.

**Detection:** Run `SELECT column_name FROM information_schema.columns WHERE table_name = 'event_types' AND column_name LIKE '%buffer%';` in Supabase SQL Editor. Verify which buffer columns currently exist. Read `app/(shell)/app/event-types/_lib/types.ts:43-44` — both `buffer_before_minutes` and `buffer_after_minutes` are in the TypeScript type and are selected by `app/(shell)/app/event-types/[id]/edit/page.tsx:18`.

**Prevention (Buffer migration phase):** Make an explicit naming decision BEFORE writing any migration SQL:

- **Option A (recommended):** Repurpose `buffer_after_minutes` as the authoritative post-buffer. Migration backfills from `accounts.buffer_minutes`. DROP the duplicate concept `post_buffer_minutes` — avoid adding a third column. Rename the UI label to "Post-booking buffer (minutes)". This is zero new columns, one column repurposed, one column eventually dropped (`accounts.buffer_minutes`).
- **Option B:** Add `event_types.post_buffer_minutes` explicitly, then DROP `buffer_after_minutes` to remove the redundant column. Two-migration sequence; more churn.

Either way: the pre-flight plan must explicitly audit all three buffer column names and decide which one the engine will read before any migration runs.

**Owner:** Buffer migration phase

---

### V15-CP-02: Nullable column + NOT NULL DEFAULT race window — buffer column must be `NOT NULL DEFAULT 0`

**What goes wrong:** If the new/repurposed buffer column is added without `NOT NULL DEFAULT 0` (or if an existing column is altered to nullable), `lib/slots.ts` receives `null` where it expects `number`. The `slotConflictsWithBookings` call at `slots.ts:277` passes `account.buffer_minutes` (type `number` per `AccountSettings.buffer_minutes`). Switching to per-event-type means the route handler at `api/slots/route.ts:89` must now also SELECT the buffer column from `event_types`. If that column is nullable, TypeScript requires an explicit null-coalesce (`?? 0`) everywhere. Forgetting even one results in `NaN` buffer math — slots computed with `addMinutes(slotStart, NaN)` return `Invalid Date`, silently dropping all slots for that event type.

**Detection:** After any column addition/alteration: `SELECT id, post_buffer_minutes FROM event_types WHERE post_buffer_minutes IS NULL;` — zero rows expected. Also: `tsc --noEmit` with strict null checks must compile without `Object is possibly 'null'` on any buffer path.

**Prevention (Buffer migration phase):**
1. Migration must use `NOT NULL DEFAULT 0` for the buffer column (matching the existing constraint on `buffer_after_minutes`).
2. Backfill step: `UPDATE event_types SET buffer_after_minutes = (SELECT buffer_minutes FROM accounts WHERE accounts.id = event_types.account_id)` — runs BEFORE any code reads the new column, inside the same migration transaction.
3. `AccountSettings` interface in `lib/slots.types.ts` must change `buffer_minutes: number` to whatever new field name is chosen. TypeScript build catches any caller that forgets the rename.

**Owner:** Buffer migration phase

---

### V15-CP-03: CP-03 two-step deploy required for `accounts.buffer_minutes` DROP — same protocol as v1.2 Phase 21

**What goes wrong:** `accounts.buffer_minutes` is currently read by deployed Vercel function instances in three places:
1. `app/api/slots/route.ts:122` — SELECT from `accounts` includes `buffer_minutes`
2. `app/(shell)/app/availability/_components/settings-panel.tsx` — renders the buffer input
3. `app/(shell)/app/availability/_lib/actions.ts` — saves `buffer_minutes` via Server Action

Dropping the column the same deploy that stops reading it is safe ONLY if Vercel has drained ALL old function instances. Vercel can take up to 30 minutes to retire stale warm function containers after a deploy. If the DROP runs immediately after the code deploy, in-flight requests from stale instances that still SELECT `buffer_minutes` will receive a Postgres column-not-found error → 500 on ALL `/api/slots` calls during the drain window.

**Precedent:** v1.2 Phase 21 (PROJECT.md line 198) applied this exact protocol for 4 deprecated `accounts` columns. The drain was satisfied by 772 minutes (overnight). The protocol:
1. Deploy code that stops reading `accounts.buffer_minutes` (while the column still exists).
2. Wait minimum 30 minutes.
3. Apply DROP migration via `supabase db query --linked -f`.

**Detection:** Before the DROP migration, grep ALL callers of `buffer_minutes` from `accounts`:
`grep -rn "buffer_minutes" app/ lib/` — every match must be dead code or already repointed to the new event-type column. Zero live reads from `accounts.buffer_minutes` = drain phase cleared.

**Prevention (Buffer migration phase):** Plan the buffer work as THREE tasks, not two:
- Task 1: ADD column to `event_types` + backfill (migration only, no code reads it yet)
- Task 2: Code deploy — stop reading `accounts.buffer_minutes`, start reading `event_types.post_buffer_minutes` (or whichever column)
- Task 3 (separate deploy, ≥30 min later): DROP `accounts.buffer_minutes`

**Owner:** Buffer migration phase (schema drop sub-task)

---

### V15-CP-04: `slots.ts` / `slots.types.ts` caller contract change — every caller of `computeSlots` must update synchronously

**What goes wrong:** `computeSlots` receives `SlotInput` which includes `account: AccountSettings`. `AccountSettings.buffer_minutes` (in `lib/slots.types.ts:15`) is what `slotConflictsWithBookings` reads at `slots.ts:277`. If the per-event-type buffer migrates into `SlotInput` as a top-level field (e.g., `postBufferMinutes: number`) rather than inside `account`, then:

1. `lib/slots.types.ts` must add the new field AND remove `buffer_minutes` from `AccountSettings` (or keep it as a deprecated 0-value for the drop window).
2. `computeSlots` in `lib/slots.ts` must pass the new field to `slotConflictsWithBookings`.
3. `app/api/slots/route.ts` must pass the new field when constructing `SlotInput`.
4. All tests in `tests/slot-generation.test.ts` construct `SlotInput` directly — `baseAccount.buffer_minutes: 0` at line 32 and the buffer test at line 216 (`buffer_minutes: 15`) must be updated.

If ANY caller is missed and `buffer_minutes` is removed from `AccountSettings`, TypeScript `tsc --noEmit` will catch it. But if the interface keeps `buffer_minutes` as a type-compatible alias during the transition, test values that construct `baseAccount` with `buffer_minutes: 15` will silently pass the wrong value if the engine has already stopped reading that field.

**Detection:** After the types change: `tsc --noEmit` — all callers must compile. Additionally, run the buffer-specific test (`account: { ...baseAccount, buffer_minutes: 15 }` at `tests/slot-generation.test.ts:216`) — if the engine stopped reading `buffer_minutes`, this test will pass but the buffer will not actually be applied, hiding the regression.

**Prevention (Buffer migration phase):** When the slot engine switches from `account.buffer_minutes` to the new per-event-type field, immediately update BOTH the test at line 216 AND `baseAccount` at line 32 to use the new field name. Never leave a stale field in test fixtures even if TypeScript accepts it.

**Owner:** Buffer migration phase

---

### V15-CP-05: New buffer tests required — per-event divergence is an untested case

**What goes wrong:** Current slot-generation tests at `tests/slot-generation.test.ts` use a single fixed `buffer_minutes` value on `baseAccount` for all event types in a test. After the per-event-type migration, two event types on the same account can have different buffer values. The existing test at line 216 (`buffer_minutes: 15`) only tests the buffer-applied case for one event type. No current test asserts:

- Event type A has `buffer=0`, event type B has `buffer=15`, same account. A slot adjacent to an event-B booking should appear available to event-A bookings.
- Two bookings from different event types with different buffers on the same day — the slot picker should show different availability for each.

Without these tests, silent regressions in cross-event-type buffer interactions can slip to production.

**Detection (before shipping):** `grep -n "buffer" tests/slot-generation.test.ts` — count test cases that vary buffer per-event-type. If zero, write them before shipping the buffer migration.

**Prevention (Buffer migration phase):** Add two test cases to `slot-generation.test.ts`:
1. Event-type buffer=0 — adjacent slot after a confirmed booking IS available.
2. Event-type buffer=15 — adjacent slot IS hidden (matches current behavior for `nsi` account).

Additionally: add a test for the divergence case (two event types, different buffers, same account, same confirmed booking on the timeline — verify each event type sees the correct availability independently).

**Owner:** Buffer migration phase

---

### V15-CP-06: Reschedule lib reads `accounts` join — verify no `buffer_minutes` reference is added during buffer refactor

**What goes wrong:** `lib/bookings/reschedule.ts:110-113` joins `accounts` but currently does NOT select `buffer_minutes` (it only needs `name, slug, timezone, owner_email, logo_url, brand_primary` for email sending). The reschedule operation is an in-place UPDATE on `start_at`/`end_at` — it does not recompute slot availability and does not apply buffer. This is correct by design (buffer enforcement is the picker's job, not the reschedule path's job).

Risk: during the buffer refactor, a developer may be tempted to add buffer validation to the reschedule path ("does the new slot clear the buffer for other bookings?"). If so, the reschedule lib would need to read `event_types.buffer_after_minutes`, and the existing SELECT would need updating. More dangerously, if the wrong field is added (`accounts.buffer_minutes` during the drain window), the reschedule path would fail after the DROP.

**Detection:** After the buffer migration phase is complete: `grep -n "buffer" lib/bookings/reschedule.ts` — should return ZERO matches. Any match is an unplanned addition.

**Prevention (Buffer migration phase):** The v1.5 scope defines buffer enforcement as a slot-picker (display layer) concern only — the DB EXCLUDE constraint enforces hard adjacency, buffer is cosmetic "extra breathing room" shown to the booker. Reschedule does not re-run `computeSlots`. Do NOT add buffer validation to `reschedule.ts`.

**Owner:** Buffer migration phase

---

### V15-CP-07: Rebrand grep misses JSX text nodes split across lines and template literals with expressions

**What goes wrong:** Running `grep -rn "contractor"` catches:
- `"trade contractors"` in a string literal
- `contractor's` in template literal

But does NOT catch:
```tsx
Built for trade {" "}
contractors, by NSI.
```
Or:
```tsx
const copy = `Book an appointment with your ${
  entityType  // renders as "contractor" at runtime
}`;
```

JSX text split across a line break is one text node in the DOM but two lines in the file. A grep for "contractor" on the first line finds nothing on the second line. Template literals with interpolations may compute "contractor" from a variable that holds the string — grep on the variable name won't surface the rendered word.

**Detection:** Use VSCode global search (not terminal grep) with the "Match case" ON and "Match whole word" OFF for "contractor" AND "Contractor" AND "trade". Review context manually — a hit on line N may be the continuation of a string that starts on line N-1.

Additionally, verify the `.ics` summary fields in email templates. The `.ics` `SUMMARY:` and `DESCRIPTION:` lines in `lib/email/` are TypeScript template literals that compose event copy from account data. If any template hard-codes "contractor" in the fallback or label text, it will appear in calendar invites.

**Prevention (Rebrand phase):**
1. Run multi-line search: VSCode global search > Use regular expression > `contractor` (case-insensitive)
2. Audit results by file type: `.tsx` (JSX text nodes), `.ts` (template literals), `.md` (docs)
3. Separately audit any `.ics` builder files (`lib/email/`) for hard-coded "contractor" in SUMMARY/DESCRIPTION fallbacks

**Owner:** Rebrand phase

---

### V15-CP-08: Booker copy must NOT be rebranded — booker sees generic language; rebrand is owner-facing only

**What goes wrong:** The rebrand scope in PROJECT.md line 19 says "owner-facing copy + internal identifiers." The public booker already uses generic language ("Pick a time", "Book this time", "Name", "Email", etc.) that has nothing to do with the "trade contractors" framing. There is NO "contractor" copy in the booking form, the slot picker, the public shell, or the confirmed/cancelled/rescheduled pages — these surfaces are customer-facing and were always generic.

Risk: a developer doing a global "contractor" replace hits the single JSX comment in `booking-form.tsx:138` (`// leak that the contractor has another appointment.`) and either removes the comment or rewrites it. This is a developer-facing comment explaining the CROSS_EVENT_CONFLICT error message rationale. Rewriting it doesn't change behavior, but it's a code churn risk that can introduce mistakes.

Separately, `booking-form.tsx:138` uses the word "contractor" as part of an internal comment about data privacy reasoning, not as user-visible copy. This does NOT need rebranding — it's documenting why we use the generic copy "That time is no longer available."

**Detection:** Before running any rebrand replacement, audit EVERY grep hit for "contractor" in its full file context. The `booking-form.tsx` hit is a comment; do not change it. The `auth-hero.tsx` hits are user-visible marketing copy and MUST be changed.

**Prevention (Rebrand phase):** Apply rebrand replacements file-by-file with manual review, NOT a bulk find-replace across the entire repo. Comments that use "contractor" as a conceptual term (not user-facing copy) should be left alone or updated to reflect the new internal mental model, not blindly text-replaced.

**Owner:** Rebrand phase

---

### V15-CP-09: `.planning/` archived milestone files reference "contractor" — decide whether to rewrite history

**What goes wrong:** Archived `.planning/` files from v1.0–v1.4 (MILESTONES.md, v1.x-ROADMAP.md, phase SUMMARY files, v1.x-REQUIREMENTS.md) contain "trade contractors" throughout. Commits in git history also contain the old copy in commit messages and code comments.

Options:
1. **Leave history alone (recommended):** v1.5 rebrand applies to the live codebase and live documentation (README.md, FUTURE_DIRECTIONS.md, active `.planning/PROJECT.md`, `.planning/MILESTONES.md`). Archived phase files are historical records, not live copy — future milestone docs will use the new language naturally.
2. **Rewrite history via `git filter-repo`:** Invasive, destroys commit hashes, invalidates GitHub PRs/issues. Not justified for a copy change.

The risk of Option 2 is high: `git filter-repo` requires force-push to `main`, disrupts any collaborator's working trees, and creates a confusing "history doesn't match" situation in GitHub's file-change view.

**Prevention (Rebrand phase):** Explicitly decide at planning time: scope the rebrand to `README.md`, `FUTURE_DIRECTIONS.md`, `app/**`, `lib/**`, and the ACTIVE `.planning/` files (PROJECT.md, MILESTONES.md) only. Document this decision in the phase plan so the verifier knows not to fail on archive files.

**Owner:** Rebrand phase (planning task, day 1)

---

### V15-CP-10: 3-column booker — Tailwind v4 CSS grid with 3 `auto` columns produces unexpected widths; reserve form column before pick

**What goes wrong:** The current 2-column booker uses `grid lg:grid-cols-[1fr_320px]` (explicit 320px right column). In the new 3-column layout (calendar LEFT, times MIDDLE, form RIGHT), naively writing `grid lg:grid-cols-3` gives three equal-width columns. The calendar component has a minimum width of ~280px (determined by the shadcn Calendar's internal cell size and padding); the times list is variable-width (short labels like "9:00 AM"); the form is tall and has fixed-width inputs.

Two failure modes:
1. **Auto-size failure:** `grid lg:grid-cols-[auto_auto_1fr]` gives the form column all remaining space, which is correct semantically, but the calendar and times columns collapse to their content width, which may be very narrow if Tailwind calculates "auto" as `min-content`.
2. **Form-reveal layout shift:** If the form column has width `0` or `display: none` before slot pick and then appears, the layout reflows and the calendar/times columns shift left. This is jarring and violates the "no layout shift" requirement.

**Detection:** Test at the exact 1024px (`lg:`) breakpoint where the grid activates. Check at 1024px, 1280px, and 1440px. Inspect column widths with browser DevTools grid overlay. On reveal of the form column, record any layout shift via PerformanceObserver CLS metric or visual inspection.

**Prevention (Booker redesign phase):** Use a 3-column template that reserves the form column width regardless of reveal state:
```css
grid-template-columns: minmax(280px, auto) minmax(160px, auto) 320px
```
Or in Tailwind v4: `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]`

The form column (320px fixed) is ALWAYS in the grid. When `selectedSlot` is null, render the form column as a placeholder (`<div aria-hidden="true" />` or a "Pick a time" hint) — this prevents layout shift on reveal. The form is revealed IN PLACE by swapping the placeholder for `<BookingForm />`, not by changing grid structure.

**Owner:** Booker redesign phase

---

### V15-CP-11: Embed widget at narrow iframe widths — 3-column layout would scroll horizontally or break

**What goes wrong:** The embed widget renders the booker at `/embed/[account]/[event-slug]` inside a parent site's iframe. The `widget.js` script resizes the iframe to fit content height via `nsi-booking:height` postMessage, but iframe WIDTH is controlled by the parent site's CSS. Many embed implementations set `width: 100%` on the iframe, which may produce widths as narrow as 320px on mobile or 480px on a narrow sidebar widget.

At 480px, a 3-column grid with `minmax(280px,auto) + minmax(160px,auto) + 320px` = minimum 760px total — the iframe would overflow its container horizontally, creating a horizontal scrollbar on the parent site. The embed widget would be broken.

**Detection:** Load the embed widget page at widths 320px, 480px, 768px, 1024px. Check for horizontal scroll or column overflow at each breakpoint. The embed widget uses `EmbedShell` in `app/embed/[account]/[event-slug]/` — verify it receives the same grid changes as the public booker or is explicitly excluded.

**Prevention (Booker redesign phase):** The 3-column layout must apply ONLY to the public hosted page (`/[account]/[event-slug]`), not the embed widget. The embed widget must remain responsive (stack vertically). Implement via:
1. Keep `BookingShell` as the shared logic component.
2. Pass a `variant="embed"` prop OR use a separate component for the embed path.
3. The `lg:` breakpoint guard on the grid is appropriate for the hosted page (users on desktops); the embed must always stack.

Document this decision explicitly in the phase plan. If the same `BookingShell` component is used for both paths, the `lg:grid-cols-3` class must be absent on the embed render path.

**Owner:** Booker redesign phase

---

## Moderate Pitfalls

Mistakes that cause wrong behavior, UX regressions, or tech debt — fixable without schema changes or rewrites.

---

### V15-MP-01: `AccountSettings` type narrowing — removing `buffer_minutes` field breaks compile for `settings-panel` action

**What goes wrong:** `app/(shell)/app/availability/_lib/actions.ts` calls `saveAccountSettingsAction` with a `buffer_minutes` field (confirmed by `settings-panel.tsx:24`). If `AccountSettings` in `lib/slots.types.ts` is modified to remove `buffer_minutes` during the buffer refactor, and the availability settings action was not simultaneously updated to remove the buffer input from the form, TypeScript will produce a type error in the action file. This is caught at build time — not a runtime issue — but it can block deployment if not addressed synchronously.

**Detection:** After removing `buffer_minutes` from `AccountSettings`: `tsc --noEmit` will surface the mismatch. Also manually check `app/(shell)/app/availability/_lib/actions.ts` and `settings-panel.tsx` for any `buffer_minutes` field in the form state or save payload.

**Prevention (Buffer migration phase):** The settings panel UI for buffer must be removed (or moved to the event-type form) as part of the same code deploy that stops reading `accounts.buffer_minutes`. Do not leave a buffer input in the availability settings form that now saves a column the code no longer reads.

**Owner:** Buffer migration phase

---

### V15-MP-02: Backfill ordering — migrate must ADD column + backfill in same transaction BEFORE code reads new column

**What goes wrong:** A common migration ordering mistake:
1. Deploy code that reads `event_types.post_buffer_minutes` (new column).
2. Apply migration that adds the column (with backfill).

If step 1 runs first, the new code hits a deployed Postgres schema that doesn't have the column yet → `column "post_buffer_minutes" does not exist` → 500 on ALL `/api/slots` requests until the migration runs. This is a production outage window.

**Detection:** The correct order is: migration first (column added, data backfilled), THEN code deploy. Verify the git commit sequence: the migration SQL file must be committed and applied BEFORE the code change that reads the new field.

**Prevention (Buffer migration phase):** Task ordering is:
1. Write + apply the ADD COLUMN + backfill migration (database first)
2. Verify the new column contains the correct backfilled values (`SELECT COUNT(*) FROM event_types WHERE post_buffer_minutes IS NULL;` → 0)
3. Then deploy code that reads the new column
4. Then (≥30 min later) apply the DROP COLUMN migration for `accounts.buffer_minutes`

This matches the v1.2 CP-03 pattern exactly.

**Owner:** Buffer migration phase

---

### V15-MP-03: Rebrand identifier rename — `tradeContractor*` / `contractor*` JS identifiers may not exist

**What goes wrong:** PROJECT.md line 29 specifies "Rename internal identifiers (tradeContractor* / contractor* → serviceBusiness*)". A grep for these specific identifier patterns in the codebase (`grep -rn "tradeContractor\|contractorType"`) will likely return zero matches — the current codebase was built with generic names (`account`, `AccountSummary`, `AccountSettings`, `eventType`, etc.). There are no `tradeContractor` TypeScript identifiers in the production code.

The "contractor" pattern in the codebase appears only as:
- **String copy** in `auth-hero.tsx` (user-facing)
- **Developer comments** in `booking-form.tsx` and planning files (not identifiers)
- **Column names** in archived SQL migrations (not runtime code)

Spending time searching for TypeScript identifiers that don't exist delays the actual work (copy changes).

**Detection:** Run `grep -rn "tradeContractor\|contractorType\|contractorAccount" app/ lib/` before planning any identifier rename tasks. Confirm whether any such identifiers exist.

**Prevention (Rebrand phase):** Scope the rebrand correctly from the start:
- Copy changes (string literals, JSX text): `auth-hero.tsx`, `README.md`, `FUTURE_DIRECTIONS.md`
- No TypeScript identifier renames needed (identifiers are already generic)
- No SQL column renames needed (no `contractor_*` column names in schema)

If the identifier rename scope is empty, remove it from the plan rather than spending a task searching for patterns that don't exist.

**Owner:** Rebrand phase (scoping task)

---

### V15-MP-04: Timezone hint placement in 3-column layout — currently rendered INSIDE `SlotPicker` at the top of the left panel

**What goes wrong:** In the current 2-column layout (`booking-shell.tsx:77`), the `SlotPicker` component renders the timezone hint `"Times shown in {bookerTimezone}"` at line 122 of `slot-picker.tsx` as the first element in the slot picker JSX, above the `grid lg:grid-cols-2` calendar/times grid. This places the timezone hint at the top-left of the slot picker panel.

In the new 3-column layout, the timezone hint's position becomes ambiguous:
- If left at the top of the calendar column (leftmost column), it's logically associated with the calendar but visually at the far left — users may not see it before picking a time in the middle column.
- If moved above the entire 3-column grid (as a full-width banner), it applies to all three columns which is semantically correct (times in all columns are in the booker's timezone).
- If moved into the times column header, it's close to the times list but may conflict with the times column heading.

Forgetting to address this means the timezone hint renders in an unintuitive position in the redesigned layout.

**Detection:** After implementing the 3-column layout, check the timezone hint at desktop widths. It should be clearly visible BEFORE the user starts picking dates, not tucked above only one column.

**Prevention (Booker redesign phase):** Move the timezone hint OUT of `SlotPicker` and into `BookingShell` as a full-width element ABOVE the 3-column grid. This mirrors the v1.3 PUB-14 fix where the timezone hint was hoisted above the `grid lg:grid-cols-2` wrapper as a full-width sibling.

**Owner:** Booker redesign phase

---

### V15-MP-05: Turnstile widget inside the form column — verify it mounts correctly on dynamic reveal

**What goes wrong:** The `Turnstile` widget (Cloudflare) in `booking-form.tsx:242` uses `@marsidev/react-turnstile`. This widget initializes when its host element mounts in the DOM. In the current 2-column layout, the form is conditionally rendered: `{selectedSlot ? <BookingForm ... /> : <p>Pick a time...</p>}`. When `selectedSlot` becomes non-null, `<BookingForm>` mounts and Turnstile initializes.

In the new 3-column layout with a reserved form column, there are two possible implementation patterns:
1. **Conditional render (same as today):** `<BookingForm>` mounts on slot pick → Turnstile mounts fresh → no issue.
2. **Always-mounted form, hidden via CSS:** `<BookingForm>` always in DOM, visibility toggled via CSS class → Turnstile renders immediately on page load, before the user has picked a slot. The user's Turnstile token may expire (2-minute validity by default) during slot selection, causing the form submission to fail with `TURNSTILE_VALIDATION_FAILED`.

**Detection:** Check the form implementation strategy. If `<BookingForm>` is always mounted, check Turnstile token expiry behavior. The `Turnstile` component's `ref.current?.getResponse()` returns an empty string after token expiry.

**Prevention (Booker redesign phase):** Keep the conditional mount pattern from the current implementation. The form column placeholder (rendered when `selectedSlot` is null) is a `<div>` with a "Pick a time to continue" hint, NOT a mounted `<BookingForm>`. The `<BookingForm>` mounts only when `selectedSlot` is set — this preserves the correct Turnstile lifecycle and avoids token-expiry issues.

**Owner:** Booker redesign phase

---

### V15-MP-06: Mobile stack ordering — 3-column desktop must stack as calendar → times → form on mobile, not form → calendar → times

**What goes wrong:** CSS grid on mobile (`flex-col` or single-column fallback) stacks DOM order top-to-bottom. If the 3-column DOM order is `[calendar] [times] [form]` (left-to-right on desktop), the mobile stack is naturally correct (calendar top, times middle, form bottom — user must pick date, then time, then fill form, which is the correct UX flow).

But if any CSS reordering (`order:` property or `flex-direction: column-reverse`) is applied to achieve a visual effect on desktop, the mobile order may be scrambled.

**Detection:** At 375px viewport width, verify the rendered order is: calendar component first, time slot list second, booking form third. Use browser DevTools to check `order` CSS property on each grid child.

**Prevention (Booker redesign phase):** Use natural DOM order (calendar → times → form) and let the CSS grid handle column placement on desktop via `grid-column` assignment if needed. Do NOT use CSS `order:` property to reorder visually — it creates an accessibility issue (keyboard tab order follows DOM order, not visual order).

**Owner:** Booker redesign phase

---

### V15-MP-07: Form column scroll-into-view behavior — current 2-column triggers scroll on slot pick; 3-column must not

**What goes wrong:** In the current `booking-shell.tsx`, there is no explicit `scrollIntoView` call when a slot is picked. However, on mobile the 2-column layout means the form appears BELOW the slot picker — users must scroll down to see the form after picking a time. In the 3-column layout, the form is always in the right column and already visible without scrolling.

If any scroll-into-view behavior was added (either in the current codebase or as a planned v1.5 enhancement), it should NOT be applied in the 3-column layout — the form is already visible. Triggering scroll-to-form in the 3-column layout would cause a disorienting jump to the bottom of the page.

**Detection:** Search `grep -rn "scrollIntoView\|scroll" app/\[account\]/` — verify no scroll-to-form calls exist. If any scroll behavior is added as part of the mobile stack, add a breakpoint guard (`window.innerWidth < 1024 && formRef.current?.scrollIntoView()`).

**Prevention (Booker redesign phase):** Do not add scroll-into-view for the 3-column desktop layout. For mobile (stacked), a scroll into view after slot pick is acceptable UX; guard it behind `window.innerWidth < 1024` or a responsive CSS scroll-margin.

**Owner:** Booker redesign phase

---

## Minor Pitfalls

Mistakes that are cosmetic or trivially fixable.

---

### V15-mp-01: `README.md` and `FUTURE_DIRECTIONS.md` rebrand — these files are committed but not deployed; don't forget them

**What goes wrong:** The rebrand primarily touches `app/` files but PROJECT.md explicitly calls out `README.md` and `FUTURE_DIRECTIONS.md`. These files are in the repo root and deployed as documentation. They contain "trade contractors" in the opening description. If the rebrand phase only touches `app/` and `lib/`, the repository's primary documentation still describes the product for "plumbers, HVAC, roofers, electricians" — confusing to new viewers who encounter the broader "service-based businesses" positioning everywhere else.

**Detection:** After the rebrand phase: `grep -n "trade contractor\|plumber\|HVAC\|roofer\|electrician" README.md FUTURE_DIRECTIONS.md` — results should be zero or explicitly retained as historical examples.

**Prevention (Rebrand phase):** Add `README.md` and `FUTURE_DIRECTIONS.md` to the explicit file list for the rebrand phase plan. Update the opening description and any audience-specific language.

**Owner:** Rebrand phase

---

### V15-mp-02: Slot-picker `lg:grid-cols-2` nested inside the 3-column grid — two grid levels must not conflict

**What goes wrong:** `slot-picker.tsx:125` contains `<div className="grid gap-6 lg:grid-cols-2">` — the calendar+times sub-grid inside the slot picker. In the new 3-column layout, the slot picker occupies TWO columns (calendar LEFT, times MIDDLE). If `SlotPicker` is restructured to NOT use its internal `lg:grid-cols-2` (because the parent grid handles column placement), the calendar and times list render as a single-column vertical stack inside both the calendar column and the times column — they'd both be full-width blocks in wrong columns.

The correct approach depends on the architecture decision:
- **Option A (children of parent grid):** `SlotPicker` renders `<Calendar>` and the times `<ul>` as direct children of the 3-column parent grid. The parent grid places them in column 1 and column 2. `SlotPicker` no longer manages its own 2-column internal grid.
- **Option B (slot picker unchanged):** `SlotPicker` keeps its internal `lg:grid-cols-2` and spans columns 1+2 of the parent grid via `col-span-2`. The form is column 3. This keeps `SlotPicker` as a self-contained component.

**Detection:** After implementing the 3-column layout, inspect at 1024px width. Check that the calendar is visually in column 1, the times list in column 2, and the form in column 3 — not stacked.

**Prevention (Booker redesign phase):** Choose Option B (simpler) unless the internal `lg:grid-cols-2` in `SlotPicker` causes issues. Update `BookingShell` to use `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]` with `SlotPicker` spanning `col-span-2` via a wrapper div, and the form in column 3.

**Owner:** Booker redesign phase

---

### V15-mp-03: `PublicShell` glass pill extends full-width; the 3-column grid is content-area only — verify no bleed outside Card

**What goes wrong:** `PublicShell` renders the glass header pill shell-wide (not inside the booking card). The booking content area is `<section className="mx-auto max-w-3xl px-6 pb-12 md:pb-20">`. If the 3-column grid exceeds `max-w-3xl` (e.g., at 1440px with a 320px form column + 280px calendar + 160px times = 760px minimum, which fits inside 3xl=768px), there's no bleed. But if the new layout needs `max-w-4xl` or `max-w-5xl` to give all 3 columns comfortable space, the `max-w` constraint must be updated consistently in `BookingShell` — not in `PublicShell`.

**Detection:** At 1280px desktop width, verify the 3-column grid fits within the content card without horizontal overflow. Check `max-w-3xl` (768px) is sufficient or identify what the minimum comfortable width is for all three columns.

**Prevention (Booker redesign phase):** If 3 columns need more than 768px, increase `max-w` in `BookingShell` only (`max-w-4xl` = 896px, `max-w-5xl` = 1024px). Do NOT touch `PublicShell` — it is used by all public surfaces (`/[account]` index page, `/[account]/[event-slug]`). A wider card on the booking page should be a `BookingShell`-specific class change.

**Owner:** Booker redesign phase

---

## Cross-Feature Pitfalls

Risks that span two or more of the three v1.5 feature tracks.

---

### V15-XF-01: Rebrand and buffer refactor touch the same files — consolidate or sequence to avoid merge conflicts

**What goes wrong:** The buffer refactor modifies:
- `lib/slots.ts` (reads `account.buffer_minutes` → new field)
- `lib/slots.types.ts` (`AccountSettings.buffer_minutes` field)
- `app/api/slots/route.ts` (SELECT columns from accounts and event_types)
- `tests/slot-generation.test.ts` (buffer test values)
- `app/(shell)/app/availability/_components/settings-panel.tsx` (remove buffer input)
- `app/(shell)/app/availability/_lib/actions.ts` (remove buffer from save action)

The rebrand also touches `app/(shell)/` files for owner-facing copy. If these two tracks are worked in parallel by the same developer switching between tasks, uncommitted changes in `slots.ts` or `api/slots/route.ts` can collide with rebrand search-and-replace operations (especially if the rebrand uses global replace tools that sweep all files).

**Detection:** Verify before starting any task: `git status` shows a clean working tree. Never start a rebrand search-and-replace with uncommitted buffer changes in the working tree.

**Prevention:** Execute the three tracks in sequence, not in parallel: Buffer migration → Rebrand → Booker redesign. Commit and deploy each track before starting the next. If parallel work is unavoidable, use separate git branches and merge after each track.

**Owner:** Phase planning (sequencing decision)

---

### V15-XF-02: Booker redesign ships AFTER rebrand — avoids rewriting booker copy twice

**What goes wrong:** If the booker redesign ships BEFORE the rebrand, the new 3-column layout is designed around the current generic copy ("Pick a time to continue", "Book this time", etc.). The rebrand then audits all owner-facing copy — the booker's copy is already generic and needs no change. No double-touch of booker copy.

But if the rebrand ships before the booker redesign and someone mistakenly "rebrands" the booker (adding "service-based businesses" copy to the public form), the booker redesign then must revert those changes. Confusion risk.

**Detection (non-issue if sequenced correctly):** The booker copy is already generic. A correctly-scoped rebrand will not touch it. The risk is human error in the rebrand phase.

**Prevention:** Explicitly document in the rebrand phase plan: "The public booker, embed widget, confirmation/cancellation pages, and all customer-facing email copy are OUT OF SCOPE for the rebrand. These surfaces use generic language that is already audience-agnostic."

**Owner:** Rebrand phase (scope guard in phase plan)

---

### V15-XF-03: Buffer migration pre-flight uses V14-CP-06 pattern — add it as a hard gate before any schema change

**What goes wrong:** The v1.4 CP-03 30-min drain protocol and the V14-CP-06 pre-flight diagnostic pattern are both required for the `accounts.buffer_minutes` DROP. The v1.4 PITFALLS.md established these as reusable patterns. v1.5 must apply them again for this DROP:

- **Pre-flight gate:** Before the ADD COLUMN + backfill migration, verify the `event_types` table's existing `buffer_before_minutes` / `buffer_after_minutes` columns don't contain non-zero values that should influence the backfill. If any event type had a custom `buffer_after_minutes` value set (unlikely but possible via direct DB edit), blindly backfilling from `accounts.buffer_minutes` would overwrite it.
- **Drain gate:** Before the DROP `accounts.buffer_minutes` migration, all deployed code must be confirmed to NOT reference the column. 30-minute minimum drain.

**Detection:** Pre-flight: `SELECT id, slug, buffer_after_minutes FROM event_types WHERE buffer_after_minutes <> 0;` — if any rows return, they were manually customized; decide whether to preserve or overwrite.

**Prevention (Buffer migration phase):** Add both gates as mandatory checkpoints in the buffer phase plan, explicitly labeled as CP-06 (pre-flight diagnostic) and CP-03 (30-min drain). The plan must block on human verification at each gate.

**Owner:** Buffer migration phase

---

## Phase-Specific Summary

| Phase | Pitfall IDs | Risk Level | Notes |
|-------|-------------|------------|-------|
| Buffer migration (DB) | V15-CP-01, V15-CP-02, V15-CP-03, V15-MP-02, V15-XF-01, V15-XF-03 | CRITICAL | Pre-flight + drain gates are hard blockers; CP-01 naming decision must be made first |
| Buffer migration (code) | V15-CP-04, V15-CP-05, V15-CP-06, V15-MP-01 | HIGH | Types-first pattern; update tests synchronously |
| Rebrand | V15-CP-07, V15-CP-08, V15-CP-09, V15-MP-03, V15-XF-02 | MODERATE | Audit each hit manually; scope guard required |
| Rebrand (identifiers) | V15-MP-03 | LOW | Identifier rename is likely a no-op; verify first |
| Booker redesign | V15-CP-10, V15-CP-11, V15-MP-04, V15-MP-05, V15-MP-06, V15-MP-07 | HIGH | Embed isolation is critical; Turnstile mount pattern must be preserved |
| Booker redesign (layout) | V15-mp-02, V15-mp-03 | LOW | Nested grid + max-w decisions; cosmetic impact only |

---

## "Looks Done But Isn't" Checklist

Run this checklist before marking v1.5 complete:

- [ ] **Buffer column naming resolved:** Confirm exactly ONE buffer column exists on `event_types` (not both `buffer_after_minutes` AND a new `post_buffer_minutes`). `SELECT column_name FROM information_schema.columns WHERE table_name = 'event_types' AND column_name LIKE '%buffer%'` should return exactly the expected columns.
- [ ] **`accounts.buffer_minutes` column DROPPED:** `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'buffer_minutes'` returns zero rows. CP-03 30-min drain verified before DROP was applied.
- [ ] **Slot engine reads event-type buffer, NOT account buffer:** `grep -n "account.buffer_minutes" lib/slots.ts` returns zero matches. `grep -n "buffer" app/api/slots/route.ts` shows the new event-type column in the SELECT, not `accounts.buffer_minutes`.
- [ ] **Per-event divergence test passes:** A test with event-type A buffer=0 and event-type B buffer=15 on the same account correctly shows different slot availability for each event type. `vitest run tests/slot-generation.test.ts` passes all buffer tests.
- [ ] **Rebrand coverage confirmed:** `grep -rn "trade contractor\|Built for trade\|for trade contractors" app/ lib/ README.md FUTURE_DIRECTIONS.md` returns zero matches. `grep -rn "contractor" app/ lib/` returns only the `booking-form.tsx:138` developer comment (intentionally left) and zero user-facing copy.
- [ ] **No booker copy rebranded:** The public booker form (`app/[account]/[event-slug]/`), confirmation page, and cancellation page use only generic copy. No "service-based businesses" language appears on customer-facing surfaces.
- [ ] **3-column desktop layout renders without horizontal overflow:** At 1024px, 1280px, and 1440px viewport widths, the booking card does not overflow its container. No horizontal scrollbar. Calendar, times, and form columns are all visible without scrolling.
- [ ] **Embed widget is NOT 3-column:** Load `calendar-app-xi-smoky.vercel.app/embed/nsi/[any-event-slug]` — the embed renders in the stacked (single-column) layout at all tested widths (320px, 480px, 768px). No horizontal overflow.
- [ ] **Turnstile mounts correctly after slot pick:** In the 3-column layout, select a date and time. The form column reveals with a valid Turnstile widget (not expired). Submit the form — the Turnstile token is accepted (HTTP 201 or 409 race, not 403 Turnstile-failed).
- [ ] **No layout shift on form reveal:** In the 3-column layout, select a time slot. The calendar and times columns do NOT move horizontally during the form reveal. The CLS (Cumulative Layout Shift) during slot pick is zero or near-zero — visually confirmed by watching the calendar position while clicking a time.
