---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-07"
subsystem: dashboard
tags: [bookings-detail, owner-note, autosave, use-debounce, two-stage-auth, current_owner_account_ids, booking-events, history-timeline, dropdown-menu, kebab, dash-04]

requires:
  - phase: 08-reminders-hardening-and-dashboard-list
    provides: 08-01 (bookings.owner_note + event_types.location columns), 08-02 (use-debounce dependency installed)
  - phase: 07-widget-and-branding
    provides: Phase 7 branding two-stage owner-auth pattern via current_owner_account_ids() RPC + service-role admin client (canonical reference: app/(shell)/app/branding/_lib/actions.ts)
  - phase: 06-cancel-and-reschedule-lifecycle
    provides: app/(shell)/app/bookings/[id]/page.tsx Phase 6 stub + CancelButton component (preserved unchanged, only relocated into action-bar)
  - phase: 01-foundation
    provides: booking_events table + booking_event_kind enum + RLS policies that scope booking_events SELECT to owner's account
provides:
  - "Owner-facing detail page extension at /app/bookings/[id]: full custom-answers display, location section, owner-note autosave textarea, history timeline, action bar with Cancel + kebab placeholder"
  - "saveOwnerNoteAction Server Action with two-stage owner auth (current_owner_account_ids RPC + RLS-scoped ownership pre-check + service-role UPDATE)"
  - "OwnerNote client component (use-debounce 800ms + flush-on-blur)"
  - "BookingHistory server component (timeline; synthesizes 'Created' entry when booking_events lacks one)"
  - "7 integration tests for the Server Action's auth boundary"
affects:
  - 08-06-bookings-list-page (sibling Wave 2 plan; row click target is /app/bookings/[id] which this plan extends)
  - 08-08-rls-matrix-and-ops-hardening (will verify the booking_events RLS policy in matrix tests)
  - phase 9 manual QA (manual verification of autosave timing, refresh persistence, cross-tenant denial)

tech-stack:
  added: []
  patterns:
    - "Two-stage owner-write auth via current_owner_account_ids() RPC + RLS-scoped ownership pre-check + service-role UPDATE — mirrors Phase 7 branding (uploadLogoAction/savePrimaryColorAction). Identical error string for not-found and forbidden prevents UUID-existence leakage across tenants."
    - "DI-friendly inner core (saveOwnerNoteCore) accepts structural-mock clients so vitest can exercise the auth + write logic without a Next request scope (cookies()/next/cache require one). Server Action wrapper (saveOwnerNoteAction) constructs real clients and delegates."
    - "Autosave UX (Plan 08-07 + RESEARCH Pattern 6): 800ms debounce via useDebouncedCallback + save.flush() on blur + inline 'Saved' pill (NO Sonner toast on success — toasts reserved for errors only)."
    - "Synthesized history entry when booking_events lacks an event_type='created' row — derived client-side from bookings.created_at so legacy/orphan bookings still get a meaningful timeline (RESEARCH Pitfall 7)."
    - "Action-bar pattern: status badge + primary action (Cancel) + kebab DropdownMenu with placeholder item — slot exists for future per-booking actions without claiming behavior in v1."

key-files:
  created:
    - "app/(shell)/app/bookings/[id]/_components/owner-note.tsx (~85 LOC) — controlled Textarea with debounced autosave, flush-on-blur, inline Saved pill"
    - "app/(shell)/app/bookings/[id]/_components/booking-history.tsx (~90 LOC) — vertical timeline with dot indicators, friendly event labels, synthesized Created entry"
    - "app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts (~135 LOC) — saveOwnerNoteAction wrapper + saveOwnerNoteCore inner logic for tests"
    - "tests/owner-note-action.test.ts (~165 LOC, 7 cases) — auth boundary + happy path + edge cases"
  modified:
    - "app/(shell)/app/bookings/[id]/page.tsx — widened SELECT (owner_note + event_types.location), added booking_events query, restructured header into action bar (CancelButton + kebab DropdownMenu placeholder), added Location / Owner note / History sections, phone now renders as tel: link"

key-decisions:
  - "Two-stage auth via RPC (NOT a single RLS-scoped UPDATE) — mirrors Phase 7 branding getOwnerAccountIdOrThrow pattern. RPC returns caller's account ids; RLS-scoped SELECT proves the booking belongs to one of them; service-role UPDATE bypasses RLS once authorization is proved. Plan revision-1 explicitly rejected the simpler RLS-only pattern for inconsistency with the rest of the owner-write surface."
  - "Identical error string for not-found and forbidden ('Booking not found.') — no UUID-existence leakage across tenants. Matches Phase 6 cancel convention (STATE.md line 169)."
  - "Empty string normalizes to NULL in DB — clearing the note via empty textarea is a valid operation, distinct from 'never set'."
  - "5000-char cap enforced BOTH client-side (Textarea maxLength) AND server-side (slice in saveOwnerNoteCore) — defense in depth against malicious or rogue clients."
  - "800ms debounce — top of the typist-friendly range from RESEARCH Pattern 6. Coalesces rapid edits into one save without feeling laggy on pause."
  - "save.flush() on blur — guarantees no in-flight edits get lost when owner tabs away. Pairs with the debounce to give the best of both worlds (latency-free typing + zero data loss on blur)."
  - "'Saved' pill is inline muted text (auto-clears in 2s via useEffect timer), NOT a Sonner toast. RESEARCH Pattern 6 explicitly bans toasts for autosave success — too noisy. Toasts reserved for the error path."
  - "BookingHistory renders timestamps in the OWNER's account timezone — same convention as the parent page header. This is the owner-facing dashboard surface, not the booker-facing widget."
  - "Synthesized 'Created' entry when booking_events lacks an event_type='created' row — derived from bookings.created_at. Keeps the timeline meaningful for legacy bookings or any booking where the audit row was never written. RESEARCH Pitfall 7."
  - "Kebab DropdownMenu populated with one disabled 'More actions coming soon' item — signals the slot exists without making a behavior promise. CONTEXT.md: 'currently empty in v1; placeholder for future'."
  - "DI-friendly Server Action core — saveOwnerNoteCore accepts structural-mock clients so vitest tests bypass the next/headers + next/cache request-scope dependency. Mirrors the Phase 6 cancel-test pattern documented in STATE.md line 178 (tests call the inner module directly)."
  - "Phone surfaces as tel: link — Phase 6 rendered phone as plain text. Plan 08-07 wraps it in <a href='tel:...'> for one-tap dial from mobile devices. Trivial UX win, zero schema change."

patterns-established:
  - "Owner-write Server Action shape — three modules per write: (a) inner core with DI clients for tests; (b) wrapper that constructs real clients + calls revalidatePath; (c) integration test exercising the inner core with structural mocks. Apply this shape to any future per-booking owner-write action."
  - "Action-bar header layout — status badge + primary destructive action (Cancel) + kebab placeholder. Reusable for any future detail page where actions need a slot but v1 only wires one or two."
  - "Synthesize-when-missing audit row — when an entity has an audit log table but legacy rows pre-date it, synthesize the missing 'Created' entry from the entity's created_at column. Rendering layer responsibility; never write the synthesized row back to the audit table."

duration: ~50 min
completed: 2026-04-26
---

# Phase 08 Plan 07: Bookings Detail Extension Summary

**Extends /app/bookings/[id] with full custom-answers display, owner-note autosave textarea (800ms debounce + flush-on-blur, two-stage owner auth via current_owner_account_ids RPC + service-role write), and a booking-events history timeline (synthesizes a Created entry when audit log lacks one). Phase 6 CancelButton preserved and relocated into a new action-bar with a kebab DropdownMenu placeholder. Closes DASH-04. 97 → 104 tests green.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 (per plan; combined into one logical commit per plan's explicit instruction)
- **Files created:** 4 (owner-note client component, booking-history server component, owner-note Server Action, integration test)
- **Files modified:** 1 (page.tsx — extended SELECT, added events query, restructured header, added new sections)
- **Test count:** 97 → 104 (+7 new owner-note auth-boundary cases)

## Accomplishments

- **DASH-04** — Owner can view and edit a private per-booking note with autosave; refresh persists; cross-tenant writes denied with UUID-leak-free error.
- **Two-stage owner auth via RPC** — `saveOwnerNoteAction` mirrors the Phase 7 branding pattern: `current_owner_account_ids()` RPC returns caller's account ids; RLS-scoped SELECT on bookings proves ownership; service-role admin client performs the UPDATE. Both not-found and forbidden return the identical "Booking not found." error string — a probe cannot tell whether a UUID exists in another tenant.
- **Autosave UX** — 800ms debounced save via `useDebouncedCallback` (use-debounce installed by 08-02), `save.flush()` on blur to guarantee no orphaned edits, inline "Saved" pill auto-clears after 2s via a `useEffect` timer (NO Sonner toast on success per RESEARCH Pattern 6 — toasts reserved for error path).
- **Booking history timeline** — `BookingHistory` server component renders booking_events ordered ASC, formats timestamps in the owner's account timezone (matches page-header convention), maps `event_type` enum to friendly labels (Created / Cancelled / Rescheduled / Reminder sent), synthesizes a "Created" entry from `bookings.created_at` when the audit log lacks one (RESEARCH Pitfall 7).
- **Custom answers fully visible on detail page** — Phase 6 already rendered answers, but the plan validates this is the canonical detail-only display per CONTEXT.md decision (list view shows summary; detail view shows full text).
- **Action-bar restructure** — Phase 6 Cancel button is preserved unchanged and relocated into a new `<div>` containing the status badge + Cancel + kebab `<DropdownMenu>`. Kebab populated with one disabled "More actions coming soon" item to demonstrate the slot exists without promising behavior in v1.
- **Phone is now a tel: link** — small UX upgrade over Phase 6 (was plain text). One-tap dial from mobile.
- **DI-friendly Server Action core** — `saveOwnerNoteCore` accepts structural mock clients so vitest tests bypass the next/headers + next/cache request-scope dependency. Server Action wrapper (`saveOwnerNoteAction`) constructs real clients and delegates. Mirrors Phase 6 cancel-test pattern.

## Task Commits

1. **Tasks 1 + 2 (combined per plan instruction)** — bundled into commit `f4a6cbf` due to a wave-2 git-index race (see Deviations below). Files in HEAD: `app/(shell)/app/bookings/[id]/page.tsx`, `app/(shell)/app/bookings/[id]/_components/booking-history.tsx`, `app/(shell)/app/bookings/[id]/_components/owner-note.tsx`, `app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts`, `tests/owner-note-action.test.ts`. The commit message attribution is the parallel 08-05 plan; the work is intact and tested.

## Files Created/Modified

### Created (4 files, ~475 LOC)
- `app/(shell)/app/bookings/[id]/_components/owner-note.tsx` (~85 LOC) — controlled Textarea, useDebouncedCallback (800ms), save.flush() on blur, inline Saved pill auto-clearing via useEffect timer, 5000-char client cap, error path uses `toast.error` from sonner.
- `app/(shell)/app/bookings/[id]/_components/booking-history.tsx` (~90 LOC) — Server Component, vertical `<ol>` timeline with absolute-positioned dot indicators on a left border, friendly event labels via map, TZDate-formatted timestamps in owner's account timezone, synthesized Created entry when audit row absent.
- `app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts` (~135 LOC) — `saveOwnerNoteAction` (Server Action wrapper) + `saveOwnerNoteCore` (DI-friendly inner logic). Two-stage auth: RPC → RLS-scoped ownership SELECT → service-role UPDATE. 5000-char cap before any DB call. Empty string → NULL.
- `tests/owner-note-action.test.ts` (~165 LOC, 7 cases) — exercises `saveOwnerNoteCore` directly with structural mock RLS + admin clients. Coverage: no-owner-accounts / wrong-account / missing-booking / happy-path / empty-string-clears / length-cap-truncates / DB-error.

### Modified (1 file)
- `app/(shell)/app/bookings/[id]/page.tsx` — widened SELECT to include `owner_note` + `event_types.location`; added second RLS-scoped query for `booking_events` ordered by `occurred_at ASC`; restructured the `<header>` into an action bar (status Badge + CancelButton + kebab DropdownMenu placeholder); added Location section (renders only when `event_types.location` set); added Owner note section (renders OwnerNote with bookingId + initialNote); added History section (renders BookingHistory with events + bookingCreatedAt + accountTimezone). Phone link upgraded from plain text to `<a href="tel:...">`. Phase 6 CancelButton import + invocation logic preserved unchanged.

## Plan Output Questions Answered

(Plan's `<output>` block asked five specific questions; answers below.)

1. **Whether the existing Phase 6 cancel button was relocated cleanly or required refactoring** — Relocated cleanly. Zero changes to `cancel-button.tsx` (the component itself), `_lib/actions.ts` (the cancelBookingAsOwner Server Action), or the cancel call site logic. Only change was wrapping the existing `canCancel ? <CancelButton ... />` invocation inside the new action-bar `<div>` alongside the status badge and the new kebab DropdownMenu.

2. **booking_events column-name confirmation (event_type vs kind vs type)** — Confirmed `event_type` (typed as `booking_event_kind` enum). Verified by reading `supabase/migrations/20260419120000_initial_schema.sql` lines for the `booking_events` CREATE TABLE. Enum values: `'created' | 'cancelled' | 'rescheduled' | 'reminder_sent'` — matches the friendly label map in `BookingHistory` and the cron route's insert from Plan 08-04.

3. **Whether the kebab menu was left empty or populated with a "coming soon" placeholder** — Populated with ONE `<DropdownMenuItem disabled>More actions coming soon</DropdownMenuItem>`. Demonstrates the slot exists, signals future intent, makes no behavior promise. Per CONTEXT.md guidance: "currently empty in v1; placeholder for future".

4. **Server Action test workaround used (matches Phase 6 pattern or new approach)** — Matches the Phase 6 pattern documented in STATE.md line 178 with one structural improvement. Phase 6 cancel tests call `cancelBooking()` directly (the shared lib function the Server Action delegates to). For the owner-note action, the equivalent shared function did not yet exist, so I refactored the Server Action into TWO exports: `saveOwnerNoteAction` (the actual Server Action wrapper that constructs real Supabase clients) and `saveOwnerNoteCore` (a DI-friendly inner function accepting structural mock clients). Tests call `saveOwnerNoteCore` with vitest mock clients — no next/headers, no next/cache, no request scope needed. This is a small generalization of the Phase 6 pattern that future Server Actions can adopt without needing to extract a separate lib module just for testability.

5. **RPC + service-role two-stage auth pattern verified consistent with Plan 08-05 + Phase 7 branding** — Verified by reading `app/(shell)/app/branding/_lib/actions.ts`. Branding's `getOwnerAccountIdOrThrow()` calls `supabase.rpc("current_owner_account_ids")` and asserts the result is non-empty before allowing service-role writes. Plan 08-07's `saveOwnerNoteCore` uses the same RPC + same non-empty check, then adds a stricter ownership pre-check (the booking's `account_id` must be IN the returned list) because owner-note operates on a per-booking key while branding operates on the caller's own single account. Same trust boundary, same RPC, same service-role admin client construction (`createAdminClient()` from `lib/supabase/admin.ts`).

## Deviations from Plan

### 1. Parallel-execution race: commit attribution (Rule 4 — would have been architectural to fix; chose non-destructive path)

**Found during:** Task 2 commit step.

**Issue:** Wave-2 plans (08-04, 08-05, 08-06, 08-07) are designed to run in parallel. They edit disjoint file subtrees, but they share a single git index and git working directory. After staging my five files (`git add ...`) and running `git commit`, the commit failed with "no changes added to commit" because a parallel agent (the 08-05 plan) had run `git commit -a`-equivalent moments earlier and bundled my staged files into their commit `f4a6cbf` ("feat(08-05): event-type location field on editor + thread location through actions").

**Verification the work is intact:** `git show --stat f4a6cbf` lists all five 08-07 files with the correct LOC totals. `git log --diff-filter=A --name-only -- "app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts"` confirms the file was added in commit `f4a6cbf`. `npm test -- owner-note-action` runs all 7 tests and passes. `npm test` full suite is 104/104 green.

**Fix attempted / not attempted:** Did NOT rewrite history (`git commit --amend`, `git rebase -i`, etc.). Rewriting would have been destructive across the parallel-execution branch and the agent execution instructions explicitly forbid destructive git operations without explicit user request. The work is preserved correctly; only the commit message attribution is off.

**Files affected:** All five 08-07 implementation files are committed in `f4a6cbf` with the 08-05 commit message instead of an 08-07 commit message.

**Recommendation for future wave-N executions:** either (a) serialize commit operations across parallel agents via a file lock, or (b) execute each parallel plan in its own git worktree so each has an isolated index. This is an orchestration-layer concern, not a per-plan concern.

### 2. useEffect for the "Saved" pill timer (Rule 1 — bug-prevention)

**Found during:** Initial OwnerNote component implementation review (self-caught before commit).

**Issue:** Plan example showed `if (showSaved) { setTimeout(() => setSavedAt(null), 2000); }` directly in the render path. Calling `setTimeout` during render is a React anti-pattern — it's a side effect that schedules state updates outside any controlled effect lifecycle. Every re-render while the pill is visible would have spawned an additional timer; no cleanup; potentially-stale `savedAt` closures.

**Fix:** Moved the timer into `useEffect(() => { ... return () => clearTimeout(handle); }, [savedAt])`. Effect re-runs only when `savedAt` changes; cleanup runs on unmount or before the next effect; only one timer is ever active at a time.

**Files modified:** `app/(shell)/app/bookings/[id]/_components/owner-note.tsx` (added `useEffect` import + replaced inline setTimeout block).

**Tests:** No new test (pure UI lifecycle behavior; covered by manual QA in Phase 9).

### 3. Skipped `npm run build` per orchestrator instruction

**Found during:** Verification phase.

**Issue:** Plan's `<verification>` block lists `npm run build`. Spawning orchestrator instruction explicitly said "Do NOT run npm run build."

**Fix:** Honored orchestrator instruction. Used `npm test` (104/104 green) as the verification floor. All 8 grep-based verify checks from the plan also pass:
- `grep "owner_note\|booking_events" page.tsx` — 6 matches
- `grep "BookingHistory\|OwnerNote" page.tsx` — 4 matches
- `grep "answers" page.tsx` — 5 matches
- `grep "DropdownMenu\|MoreVertical" page.tsx` — 14 matches
- `grep "useDebouncedCallback" owner-note.tsx` — 2 matches
- `grep "save.flush\|onBlur" owner-note.tsx` — 3 matches
- `grep "current_owner_account_ids" owner-note-action.ts` — 2 matches
- `grep "createAdminClient" owner-note-action.ts` — 2 matches

**Files modified:** None.

## Authentication Gates

None.

## Test Coverage

`tests/owner-note-action.test.ts` — 7 cases, all green:

1. **No owner accounts** — RPC returns `[]` → `{ ok: false, error: "Booking not found." }`. Critical: NO admin write happens (asserted via spy).
2. **Booking belongs to a different account** — RPC returns `[ACCOUNT_A]`, booking has `account_id: ACCOUNT_B` → identical "Booking not found." error string (no UUID-existence leakage). NO admin write.
3. **Booking does not exist** — RPC returns `[ACCOUNT_A]`, RLS-scoped select returns null → identical "Booking not found." error string. NO admin write.
4. **Happy path** — RPC returns `[ACCOUNT_A]`, booking owned by `ACCOUNT_A` → admin UPDATE called once with `{ owner_note: "Call back at 2pm" }`. Returns `{ ok: true }`.
5. **Empty string normalizes to NULL** — `note: ""` → admin UPDATE called with `{ owner_note: null }`.
6. **Length cap at 5000 chars** — `note: "x".repeat(6000)` → admin UPDATE called with note truncated to exactly 5000 `"x"` chars.
7. **DB error path** — admin UPDATE returns `{ error: { message: "DB exploded" } }` → `{ ok: false, error: "Save failed." }`.

Full suite: **104/104 passing** (97 baseline + 7 new). Duration ~22s.

## Manual QA Hand-off

Phase 9 manual QA must verify (from plan's `<verification>` block):

1. /app/bookings/[id] for an existing booking renders booker contact (with mailto + tel), location (if set), answers, owner-note textarea, history timeline, action bar.
2. Type into note → "Saved" indicator appears within ~1s, then auto-clears at ~3s.
3. Refresh page → note value persists from DB.
4. Owner of a different account cannot save a note to a booking they don't own (sample by attempting via /api with another account's UUID — should return "Booking not found.").
5. Cancel button still works (Phase 6 regression check).
6. Kebab opens and shows "More actions coming soon" disabled item.

## Next Plan Readiness

**08-06 (bookings list page)** — independently unblocked (was already in Wave 2 alongside 08-07). Plan 08-06 owns `/app/bookings/page.tsx` which links INTO `/app/bookings/[id]` (this plan's surface). No coordination needed; the link target is stable.

**08-08 (RLS matrix + ops hardening)** — will verify the booking_events RLS policy holds for cross-account reads (the plan 08-07 detail page reads booking_events via the RLS-scoped client; matrix tests will prove no cross-account leakage).
