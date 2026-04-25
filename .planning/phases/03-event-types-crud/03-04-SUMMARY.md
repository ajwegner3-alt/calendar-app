---
phase: 03-event-types-crud
plan: 04
subsystem: ui
tags: [react, nextjs, supabase, shadcn, tailwind, soft-delete, radix]

# Dependency graph
requires:
  - phase: 03-03
    provides: "5 Server Actions (createEventTypeAction, updateEventTypeAction, softDeleteEventTypeAction, restoreEventTypeAction, toggleActiveAction), EventTypeState + RestoreResult types, EventTypeListItem type"
  - phase: 03-02
    provides: "shadcn primitives: Table, DropdownMenu, AlertDialog, Dialog, Badge, Switch, Skeleton, Sonner Toaster"
  - phase: 02-01..04
    provides: "shell layout, Supabase auth, RLS, createClient (server + browser)"
provides:
  - "Server Component list page at /app/event-types with archived-filter searchParam (Next.js 16 await searchParams)"
  - "EventTypesTable client component: 5-column table with conditional row styling"
  - "RowActionsMenu: kebab DropdownMenu with Edit/Toggle/Archive/Restore per row state"
  - "DeleteConfirmDialog: two-tier AlertDialog with lazy booking count fetch"
  - "RestoreCollisionDialog: standalone Dialog (not nested) for slug-collision restore flow"
  - "ShowArchivedToggle: Switch bound to ?archived URL param"
  - "StatusBadge: Active/Inactive/Archived badge variants"
  - "EmptyState: two-copy-variant card with CTA"
  - "loading.tsx: full skeleton table for route transitions"
affects: ["03-05 (form pages link back to list)", "Phase 4 (availability links to event types)", "Phase 8 (dashboard bookings list may share table patterns)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy data fetch inside dialog: useEffect on [open] with cancellation flag prevents stale fetch"
    - "Controlled AlertDialog opened imperatively from DropdownMenuItem via e.preventDefault()"
    - "Standalone Dialog for slug-collision (NOT nested inside AlertDialog — Radix focus trap limitation)"
    - "router.refresh() after non-redirecting Server Actions to re-fetch the Server Component"
    - "URL searchParam as UI state: ?archived=true via router.replace, server-renders correct data"
    - "useTransition wrapping async action calls for isPending UI state"

key-files:
  created:
    - "app/(shell)/app/event-types/page.tsx"
    - "app/(shell)/app/event-types/loading.tsx"
    - "app/(shell)/app/event-types/_components/empty-state.tsx"
    - "app/(shell)/app/event-types/_components/status-badge.tsx"
    - "app/(shell)/app/event-types/_components/event-types-table.tsx"
    - "app/(shell)/app/event-types/_components/show-archived-toggle.tsx"
    - "app/(shell)/app/event-types/_components/row-actions-menu.tsx"
    - "app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx"
    - "app/(shell)/app/event-types/_components/restore-collision-dialog.tsx"
  modified: []

key-decisions:
  - "RESEARCH Open Q1 confirmed: lazy booking count fetch via useEffect in DeleteConfirmDialog (NOT pre-fetched in list query — avoids N queries for N rows on initial render)"
  - "RESEARCH Open Q3 confirmed: RestoreCollisionDialog uses standalone Dialog, not nested inside AlertDialog — Radix nested-modal focus trap causes issues"
  - "Unlinked-user behavior: list page uses RLS-scoped client — unlinked user gets zero rows and sees EmptyState. No additional current_owner_account_ids redirect added (matches Phase 2 STATE decision)"
  - "router.refresh() after non-redirecting actions: required for toggleActiveAction, softDeleteEventTypeAction, restoreEventTypeAction — these return data (not redirect), so the client must trigger a Server Component re-fetch"
  - "Row styling: opacity-50 + [&>td]:line-through for archived rows; opacity-60 for inactive rows (Tailwind arbitrary variant for deep child selection)"

patterns-established:
  - "Controlled dialog opened from DropdownMenuItem: e.preventDefault() keeps focus management correct while imperatively setting open state"
  - "Cancellation flag in async useEffect: let cancelled = false; return () => { cancelled = true }; prevents stale async fetch from updating unmounted/closed dialog state"
  - "Two-tier confirmation gate: zero-bookings = simple confirm; has-bookings = type-the-name to enable button"
  - "RestoreResult discriminated union handling in client: 'ok' in result / 'slugCollision' in result / 'error' in result"

# Metrics
duration: 35min
completed: 2026-04-25
---

# Phase 03 Plan 04: List Page and Row Actions Summary

**Full event-types list surface: Server Component page with archived filter, 5-column table, kebab row actions (toggle/archive/restore), two-tier delete dialog with lazy booking count, and standalone slug-collision restore dialog.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-25T05:03:37Z
- **Completed:** 2026-04-25T05:38:00Z
- **Tasks:** 3 completed
- **Files created:** 9

## Accomplishments

- Replaced Phase 2 stub at `/app/event-types` with a full Server Component that awaits `searchParams` (Next.js 16), queries with `.is("deleted_at", null)` / `.not("deleted_at", "is", null)` soft-delete filter, and server-renders correct data for active/archived toggle without client-side fetch
- Shipped complete table surface: 5 columns (Name / Duration / Slug / Status / Actions), StatusBadge with Active/Inactive/Archived variants, conditional row opacity and line-through, and a kebab DropdownMenu with branched items per row state (Edit + Toggle + Archive for active/inactive; Restore for archived)
- Implemented RESEARCH-specified dialog patterns: DeleteConfirmDialog with lazy booking count (zero-bookings simple confirm, has-bookings type-the-name gate) and standalone RestoreCollisionDialog with pre-filled slug suggestion and slugify() coercion on input

## Task Commits

1. **Task 1: List page Server Component + loading/empty/badge primitives** - `26f852a` (feat)
2. **Task 2: Event types table, show-archived toggle, row actions kebab** - `f4586bd` (feat)
3. **Task 3: Delete-confirm dialog (two-tier) + restore-collision dialog** - `e5a7abe` (feat)

## Files Created

- `app/(shell)/app/event-types/page.tsx` - Server Component: awaits searchParams, soft-delete filter, renders EmptyState or EventTypesTable
- `app/(shell)/app/event-types/loading.tsx` - Full skeleton table (header + 4 skeleton rows) for route transitions
- `app/(shell)/app/event-types/_components/empty-state.tsx` - Two-copy-variant card: archived-empty ("no archived") vs primary-empty ("create first") with CTA
- `app/(shell)/app/event-types/_components/status-badge.tsx` - Maps {isActive, deletedAt} to Active/Inactive/Archived Badge variants; deletedAt checked first
- `app/(shell)/app/event-types/_components/event-types-table.tsx` - Client Component; 5-column Table with conditional row opacity-50/line-through for archived, opacity-60 for inactive
- `app/(shell)/app/event-types/_components/show-archived-toggle.tsx` - Switch wired to ?archived URL param via router.replace; server-driven toggle (not client state)
- `app/(shell)/app/event-types/_components/row-actions-menu.tsx` - Kebab DropdownMenu; Edit link + Toggle + Archive for active/inactive rows; Restore for archived; useTransition for isPending
- `app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx` - Controlled AlertDialog; lazy booking count via useEffect with cancellation flag; simple/type-name two-tier gate
- `app/(shell)/app/event-types/_components/restore-collision-dialog.tsx` - Standalone Dialog (not nested); pre-fills "${originalSlug}-restored"; slugify() on every keystroke; inline errors not toasts

## Decisions Made

**RESEARCH Open Q1 resolution — lazy booking count:** Booking count is fetched inside `DeleteConfirmDialog` via `useEffect(() => ..., [open, eventTypeId])` using the Supabase browser client with `{ count: "exact", head: true }` and `.neq("status", "cancelled")`. This avoids N count queries on the initial list render (one per row), which would be wasteful for a page that may have 10+ event types and rarely triggers the archive dialog.

**RESEARCH Open Q3 resolution — standalone Dialog for restore-collision:** `RestoreCollisionDialog` uses a top-level `<Dialog>` component, NOT nested inside an `<AlertDialog>`. The DropdownMenu, DeleteConfirmDialog, and RestoreCollisionDialog all live as siblings in `row-actions-menu.tsx`. The collision dialog is mounted conditionally (`{collisionSlug && ...}`) so it only exists in the DOM when needed. This avoids Radix nested-modal focus-trap issues.

**Unlinked-user behavior:** The list page does NOT call `current_owner_account_ids()`. RLS scopes the SELECT to the current user's account; an unlinked user returns zero rows and sees the EmptyState. The Phase 2 unlinked redirect on `/app` (dashboard root) is the safety net. This matches the Phase 2 STATE decision: "Stub pages at /app/event-types... inherit the check naturally."

**router.refresh() after non-redirecting actions:** After `toggleActiveAction`, `softDeleteEventTypeAction`, and `restoreEventTypeAction` succeed, the client calls `router.refresh()`. This triggers Next.js to re-fetch the Server Component at `/app/event-types`, incorporating the `revalidatePath("/app/event-types")` that the actions already called. Without `router.refresh()`, the UI stays stale even after the server cache is invalidated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Build failure from Plan 03-05's committed route pages importing event-type-form.tsx before it was created**

- **Found during:** Task 3 build verification
- **Issue:** Plans 03-04 and 03-05 ran in parallel. Plan 03-05 committed `/new/page.tsx` and `/[id]/edit/page.tsx` (both importing `event-type-form.tsx`) before Plan 03-05 had created `event-type-form.tsx`. This caused the Turbopack build to fail with "Module not found: Can't resolve '../../_components/event-type-form'".
- **Resolution:** Plan 03-05 completed the `event-type-form.tsx` file (with `as any` cast for the zodResolver Zod v4 type mismatch) while Plan 03-04 was running Task 3. By the time Task 3 dialogs were written and the build was re-run, the file existed. No stub was needed — the timing resolved naturally.
- **Files modified:** None by Plan 03-04 (Plan 03-05 owns event-type-form.tsx)
- **Net result:** Build passes clean, all 17 Vitest tests green

## Next Phase Readiness

- `/app/event-types` list page is functional and ready for data (currently shows EmptyState since no event types exist until Plan 03-05's form is used)
- Edit links in the kebab (`/app/event-types/${id}/edit`) route to Plan 03-05's edit page
- "Create event type" CTA links to `/app/event-types/new` (Plan 03-05's new page)
- All Server Actions from Plan 03-03 are wired and tested through the UI layer
- Sonner toasts fire on all success/error paths
- Build clean, all 17 tests green, pushed to main
