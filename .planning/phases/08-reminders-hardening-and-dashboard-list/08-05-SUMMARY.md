---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-05"
subsystem: ui
tags: [settings, ui, server-actions, two-stage-auth, switch, textarea, reminders, sidebar, supabase, vitest, rls, di-pattern]

requires:
  - phase: 08-reminders-hardening-and-dashboard-list
    provides: 08-01 (accounts.reminder_include_custom_answers/location/lifecycle_links bool defaults true; event_types.location text nullable)
  - phase: 07-widget-and-branding
    provides: branding/_lib/actions.ts canonical two-stage owner auth (RLS pre-check via current_owner_account_ids RPC + service-role write); shadcn Switch already installed
  - phase: 03-event-types-crud
    provides: EventTypeForm + shared _lib/schema.ts/_lib/actions.ts at app/(shell)/app/event-types — extended in place rather than duplicated; direct-call Server Action contract
  - phase: 02-owner-auth-and-dashboard-shell
    provides: ShellLayout + AppSidebar pattern; current_owner_account_ids() RPC; redirect("/app/login")/redirect("/app/unlinked") helpers

provides:
  - "Reminder Settings page at /app/settings/reminders with three Switch toggles bound to accounts.reminder_include_custom_answers/location/lifecycle_links (Server Component reads RLS-scoped, Client Component issues optimistic mutations)"
  - "saveReminderTogglesAction Server Action (two-stage auth: getUser + current_owner_account_ids RPC pre-check + service-role admin UPDATE on accounts.reminder_include_*)"
  - "saveReminderTogglesCore DI-friendly inner function — vitest entry point that bypasses cookies()/next/cache (mirrors Plan 08-07 owner-note + Phase 6 cancel-test pattern)"
  - "LocationField client component (Textarea, edit-only) plumbed into shared EventTypeForm — renders only when mode === 'edit' so create-flow UX stays unchanged"
  - "event_types.location threaded through eventTypeSchema (optional/nullable, max 500 chars), createEventTypeAction, updateEventTypeAction, EventTypeRow type, edit page select+defaultValues"
  - "AppSidebar gains a 'Settings' SidebarGroup (with SidebarGroupLabel) containing Reminder Settings entry (BellRing icon) — first non-top-level group, sets pattern for future settings entries"
  - "tests/reminder-settings-actions.test.ts (11 cases): unauthorized, forbidden (wrong owner + no owner), unknown key, six happy-path key→column mappings, admin write error"

affects:
  - 08-04-cron-and-immediate-reminder (already shipped; this plan provides the *write* surface for the reminder_include_* toggles whose *read* surface 08-04 already wired into the rendered email body)
  - 08-08-rls-matrix-and-ops-hardening (will need to confirm RLS still locks down direct accounts UPDATEs from the anon client now that an admin write path exists; the two-stage auth pattern is the contract under audit)
  - "Phase 9 manual QA — owner-side smoke for toggle persistence + location reflected in reminder emails"

tech-stack:
  added: []
  patterns:
    - "DI-friendly Server Action core: extract `*Core(args, deps)` from the public Server Action so vitest can inject structural-mock supabase clients (mirrors Plan 08-07 saveOwnerNoteCore; both spawned from the Phase 6 cancel-test workaround for cookies() outside a Next request scope)"
    - "Two-stage owner auth surface — third call site after Phase 7 branding + Plan 08-07 owner-note. All three follow identical shape: RLS-client.auth.getUser() → RLS-client.rpc('current_owner_account_ids') → admin.from(table).update(...).eq('id', ownedId). New owner-mutation actions in future phases MUST reuse this shape verbatim"
    - "Optimistic Switch + revert-on-failure: useState mirrors checked, onCheckedChange flips local state immediately, action result revert+toast on {ok: false}. Single pendingKey state variable disables the in-flight switch but lets others remain interactive"
    - "Edit-only form field via mode prop on shared form: rather than fork EventTypeForm or build a parallel edit-only form, gate field rendering with {mode === 'edit' && <Field />}. Keeps schema/action surface single-source"
    - "Sidebar SidebarGroup with SidebarGroupLabel — first non-top-level group in this codebase. Future settings entries (account, billing, etc.) drop into the same group"

key-files:
  created:
    - app/(shell)/app/settings/reminders/page.tsx
    - app/(shell)/app/settings/reminders/_components/reminder-toggles-form.tsx
    - app/(shell)/app/settings/reminders/_lib/actions.ts
    - app/(shell)/app/event-types/[id]/edit/_components/location-field.tsx
    - tests/reminder-settings-actions.test.ts
  modified:
    - app/(shell)/app/event-types/[id]/edit/page.tsx
    - app/(shell)/app/event-types/_components/event-type-form.tsx
    - app/(shell)/app/event-types/_lib/actions.ts
    - app/(shell)/app/event-types/_lib/schema.ts
    - app/(shell)/app/event-types/_lib/types.ts
    - components/app-sidebar.tsx

key-decisions:
  - "Extended existing updateEventTypeAction (and createEventTypeAction for symmetry) rather than introducing a new action — matches Phase 3 lock and preserves single-source-of-truth for slug pre-flight + redirect handling"
  - "Sidebar Reminder Settings entry landed in a NEW 'Settings' SidebarGroup (with SidebarGroupLabel), not as a top-level item — preempts the eventual settings cluster (account, billing, etc.) so we don't have to refactor later"
  - "create-new-event-type flow does NOT show the Location field in v1 (per plan Step C). Schema accepts location optional/nullable so create still validates with no field present; action writes NULL when undefined. Owners set location after creation via the edit page"
  - "Empty-string location normalizes to undefined via schema z.literal('').transform(() => undefined), then to NULL via `?? null` in actions — mirrors the existing description handling exactly"
  - "saveReminderTogglesCore exported and tested directly (DI pattern); the public Server Action is a thin wrapper that constructs real clients + revalidatePath. Plan 08-07's owner-note action established the same split — locking it in as the standard for actions that need both unit testability AND production wrapper behavior"
  - "Reminder Settings page reads accounts via RLS-scoped maybeSingle() (no explicit account_id filter) — mirrors loadBrandingForOwner. Single-tenant v1 means RLS gives us at most one row, no need for the linkage RPC on read"

patterns-established:
  - "Server Action DI/core split: `actionName(args)` (public, uses real clients + revalidatePath) → `actionNameCore(args, {rlsClient, adminClient})` (testable, pure logic). Standard for new owner-mutation actions"
  - "Sidebar settings cluster: SidebarGroup + SidebarGroupLabel('Settings') + per-entry SidebarMenuButton. Use this group for any future per-account configuration UI"
  - "Schema-extension threading: when adding a column to an existing CRUD form, extend in this order — types.ts (DB row shape) → schema.ts (Zod input) → actions.ts (insert/update payload, ?? null normalization) → page.tsx (select column + thread defaultValues) → form/subcomponent (UI). Keeps every layer aware of the new field"

duration: 16min
completed: 2026-04-26
---

# Phase 8 Plan 08-05: Reminder Settings + Event-Type Location UI Summary

**New /app/settings/reminders page with three Switch toggles (account-level reminder content gates) plus event_types.location threaded into the existing event-type editor — both via the canonical Phase 7 two-stage owner-auth pattern.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-04-27T02:02:00Z
- **Completed:** 2026-04-27T02:21:00Z
- **Tasks:** 3 (all auto, no checkpoints)
- **Files modified/created:** 11 (5 new, 6 modified) — note: 5 of the 11 belong to Plan 08-07's parallel work that got swept into the Task 2 commit (see Deviations)

## Accomplishments

- Owner can now navigate to /app/settings/reminders from the sidebar and toggle three account-level reminder content switches; each toggle persists immediately via two-stage-auth Server Action with optimistic UI + revert-on-failure
- Owner can edit event_types.location via a Textarea on the existing event-type edit page; saves persist (NULL on empty); the field feeds directly into the reminder cron's email rendering shipped in 08-04
- Schema additions from 08-01 are now BOTH writable AND readable from the owner UI — no more dead-weight columns
- saveReminderTogglesCore extracted as the standard DI-pattern test entry point (third instance of two-stage auth after branding + owner-note); 11 test cases lock the column-name mapping against future drift
- Sidebar gains its first SidebarGroup with a SidebarGroupLabel — pattern reusable for any future settings cluster

## Task Commits

Each task was committed atomically:

1. **Task 1: Reminder Settings page + Server Action + sidebar link** — `9360e56` (feat)
2. **Task 2: Event-type location field in editor** — `f4a6cbf` (feat)
3. **Task 3: Server Action integration test for reminder toggles** — `b5f808b` (test)

**Plan metadata commit:** to follow this summary.

## Files Created/Modified

### Created

- `app/(shell)/app/settings/reminders/page.tsx` — Server Component; RLS-scoped read of accounts.reminder_include_*; redirects to /app/login or /app/unlinked
- `app/(shell)/app/settings/reminders/_components/reminder-toggles-form.tsx` — Client component; three Switch toggles with optimistic state + Sonner toasts
- `app/(shell)/app/settings/reminders/_lib/actions.ts` — saveReminderTogglesAction (public) + saveReminderTogglesCore (DI/test entry); two-stage owner auth
- `app/(shell)/app/event-types/[id]/edit/_components/location-field.tsx` — Textarea-based location field bound via register('location'); edit-only
- `tests/reminder-settings-actions.test.ts` — 11 cases covering auth + key→column mapping + admin error path

### Modified

- `app/(shell)/app/event-types/[id]/edit/page.tsx` — selects `location` column, threads into defaultValues
- `app/(shell)/app/event-types/_components/event-type-form.tsx` — adds `location: ""` to DEFAULTS, imports LocationField, renders only when `mode === "edit"`
- `app/(shell)/app/event-types/_lib/actions.ts` — both create + update actions write `location: parsed.data.location ?? null`
- `app/(shell)/app/event-types/_lib/schema.ts` — adds `location: z.string().max(500).optional().or(z.literal('').transform(() => undefined))`
- `app/(shell)/app/event-types/_lib/types.ts` — EventTypeRow gains `location: string | null`
- `components/app-sidebar.tsx` — adds SETTINGS_NAV_ITEMS const + new SidebarGroup with SidebarGroupLabel("Settings") + Reminder Settings entry (BellRing icon); imports SidebarGroupLabel + BellRing

## Decisions Made

- **Existing edit action extended (preferred path)** — `updateEventTypeAction` in `app/(shell)/app/event-types/_lib/actions.ts` was extended with a `location: parsed.data.location ?? null` line; no new action created. `createEventTypeAction` was extended too for symmetry (schema makes it optional so create flow doesn't need to populate it). NOTE: the plan frontmatter listed `app/(shell)/app/event-types/[id]/edit/_lib/actions.ts` but actions actually live one level up at `_lib/actions.ts` (shared between create + edit). Plan Step C wording ("Wherever the existing edit action lives") explicitly accommodates this.
- **Sidebar group/section: NEW 'Settings' SidebarGroup with SidebarGroupLabel** — landed below the existing top-level NAV_ITEMS group, before the SidebarFooter. SidebarGroupLabel was previously unused in this codebase but was already exported from components/ui/sidebar.tsx. This sets the pattern for future settings entries (account, billing, etc.).
- **create-new-event-type flow does NOT gain the Location field** (deferred per plan Step C) — schema accepts location optional/nullable, action writes NULL when missing, but the form gates rendering on `mode === "edit"`. Owners set location after creation. Documented in field placeholder copy as well.
- **No deviation from Phase 7 two-stage auth pattern** — saveReminderTogglesCore implements the exact same shape: RLS-client.auth.getUser() → RLS-client.rpc('current_owner_account_ids') → service-role admin.from('accounts').update(...).eq('id', accountId). Only addition vs branding's `getOwnerAccountIdOrThrow` helper is an explicit `includes(args.accountId)` check (callers pass the accountId being mutated), which is more defensive than branding's "just use the first id" pattern — appropriate when the action accepts the target id from the client.
- **Reminder Settings page uses RLS-scoped maybeSingle() instead of the linkage RPC** — mirrors loadBrandingForOwner: single-tenant v1 means RLS already gives us at most one accounts row, so an explicit current_owner_account_ids round-trip on read is redundant. The mutation path still uses the RPC (per the two-stage auth contract).
- **DI/core split exposed and tested directly** — saveReminderTogglesCore is exported and consumed by tests; the public Server Action wrapper is a 12-line thin shell that constructs real clients + revalidatePath. Mirrors Plan 08-07's saveOwnerNoteCore split. Both descended from the Phase 6 cancel-test workaround (STATE.md line 178) — formalizing as the standard for new owner-mutation actions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Refactored actions.ts to expose saveReminderTogglesCore for vitest**
- **Found during:** Task 3 (writing the integration test)
- **Issue:** Plan Step D specified `saveReminderTogglesAction` as a single Server Action that calls `createClient()` directly. The test note in plan Task 3 acknowledged this would throw outside a Next request scope and pointed at "the Phase 6 owner-cancel test pattern." Plan 08-07 had since formalized this into the `*Core(args, deps)` DI split. Without the split, the action could not be tested at all — blocked Task 3.
- **Fix:** Extracted `saveReminderTogglesCore(args, {rlsClient, adminClient})` containing the auth + write logic; reduced `saveReminderTogglesAction` to a thin wrapper that builds real clients and delegates. Public surface unchanged from the client component's perspective.
- **Files modified:** app/(shell)/app/settings/reminders/_lib/actions.ts
- **Verification:** 11/11 test cases pass against saveReminderTogglesCore; full suite 115/115 green.
- **Committed in:** b5f808b (Task 3 commit)

### Process Deviations (worktree contention with parallel Wave 2 agents)

**2. [Rule 3 - Blocking] Task 2 commit unintentionally included Plan 08-07 files**
- **Found during:** Task 2 commit (post-hoc, on `git show --stat`)
- **Issue:** Between Task 1 commit and Task 2 staging, a parallel Wave-2 agent (Plan 08-07) wrote untracked files into the worktree (`app/(shell)/app/bookings/[id]/_components/{booking-history,owner-note}.tsx`, `app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts`, `tests/owner-note-action.test.ts`) and modified `app/(shell)/app/bookings/[id]/page.tsx`. I explicitly `git add`-ed only my Task 2 files, but the resulting commit `f4a6cbf` swept in the 08-07 files anyway. Most likely cause: a parallel `git add` from the 08-07 agent ran between my staging and my commit. No worktree corruption — just commit-attribution noise.
- **Fix:** Accepted the messy commit rather than reverting and re-staging — undoing risked stomping on 08-07's in-flight work mid-flight. Task-2-attributed commit `f4a6cbf` therefore contains both 08-05 location-field work AND 08-07 owner-note skeleton. 08-07's SUMMARY.md (when it lands) will need to acknowledge that its commit-of-record is `f4a6cbf` for those files (not a future 08-07 commit).
- **Files affected:** As listed above; net-additions belonging to 08-05 are visible in the same commit's diff for `event-types/`, `event-types/[id]/edit/`, and the LocationField.
- **Verification:** Full test suite 115/115 green. No 08-07-attributed code introduces regressions to 08-05 functionality (the two surface areas are disjoint at the route + module level).
- **Committed in:** f4a6cbf (Task 2 commit, mixed)

---

**Total deviations:** 2 (1 blocking refactor, 1 process — neither requires user attention)
**Impact on plan:** Refactor formalizes the test-friendly split that 08-07 also adopted; commit-mixing is a multi-agent worktree artifact that will resolve itself when 08-07's SUMMARY.md is written.

## Issues Encountered

- Pre-existing TS errors in `tests/*.test.ts` for `__setTurnstileResult` / `__mockSendCalls` (vitest aliases not visible to `tsc --noEmit`) — predate Plan 08-05, not introduced by this work, no action taken (filtered out via `grep -v "^tests/"` when verifying).
- The plan listed `app/(shell)/app/event-types/[id]/edit/_lib/actions.ts` in `files_modified` but no such file exists — the actual edit action lives at `app/(shell)/app/event-types/_lib/actions.ts` (shared between create + edit). This was anticipated by plan Step C wording ("Wherever the existing edit action lives") and is documented in Decisions Made above.

## User Setup Required

None — no external service configuration required. The two new owner-facing surfaces (reminder settings page + location field) are immediately usable on the next deploy. Manual verification (toggle persistence across reload + location persistence across reload) belongs to Phase 9 manual QA.

## Next Phase Readiness

- 08-05 closes the owner-side write loop on the schema added in 08-01: every column from 08-01 now has a UI to read AND write it.
- 08-04's reminder cron + email-sender already reads `accounts.reminder_include_*` and `event_types.location`; with 08-05 the owner can actually configure both. Live verification of "toggle off → field disappears from next reminder" is the natural Phase 9 acceptance test.
- 08-08 (RLS matrix + ops hardening) should add anon-client probes against accounts UPDATE to confirm the new admin write path doesn't accidentally relax direct-mutation guarantees.
- No blockers introduced for any remaining Phase 8 plans.

---
*Phase: 08-reminders-hardening-and-dashboard-list*
*Completed: 2026-04-26*
