---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-06"
subsystem: ui
tags: [next-16, supabase, rls, shadcn, table, pagination, url-state, use-debounce]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: bookings table + RLS policies
  - phase: 02-owner-auth
    provides: createClient() server helper, /app/(shell) layout
  - phase: 03-event-types
    provides: event-types list pattern (Server Component + URL state via router.replace)
  - phase: 04-availability
    provides: TZDate / date-fns convention for booker-timezone display
  - phase: 06-cancel-reschedule
    provides: /app/bookings/[id] route contract
  - phase: 08-01-schema-additions
    provides: schema baseline (no new columns required by this plan)
provides:
  - "/app/bookings list view (Server Component, RLS-scoped)"
  - "URL-driven filter state (status / date range / event type / search)"
  - "Numbered pagination preserving filters across page navigation"
  - "Status-badge color contract (green=confirmed, red=cancelled, amber=rescheduled)"
  - "BookingsQueryParams + BookingRow types reusable by future detail/export work"
affects: [phase 9 manual QA, future export/CSV work, future bulk-action selection on list]

# Tech tracking
tech-stack:
  added: []  # zero new deps; reused use-debounce from 08-02 + existing shadcn primitives
  patterns:
    - "Server Component + Promise<searchParams> + URL-driven filter state (Phase 3 lock continued)"
    - "Multi-select via DropdownMenuCheckboxItem with onSelect=preventDefault() to keep menu open"
    - "Compact pagination range: 1, ..., current-1, current, current+1, ..., N when totalPages > 7"
    - "Default-filter sentinel omitted from URL ('upcoming' status not serialized) for clean shareable links"
    - "Booker-timezone-on-display rule extended to list view (matches confirmation/reminder emails)"

key-files:
  created:
    - "app/(shell)/app/bookings/_lib/queries.ts"
    - "app/(shell)/app/bookings/_components/bookings-table.tsx"
    - "app/(shell)/app/bookings/_components/bookings-filters.tsx"
    - "app/(shell)/app/bookings/_components/bookings-pagination.tsx"
  modified:
    - "app/(shell)/app/bookings/page.tsx (Phase 6 stub replaced with real implementation)"

key-decisions:
  - "Status filter 'upcoming' applies time-only filter (start_at >= now), NOT a status constraint — future cancelled/rescheduled bookings remain visible so the owner sees lifecycle changes that already happened"
  - "Event-type multi-select uses shadcn DropdownMenuCheckboxItem (no Popover primitive installed); onSelect prevent-default keeps the menu open for multi-toggle"
  - "Date inputs are native HTML5 type=date (NOT shadcn Calendar popover) — internal-use dashboard, native browser UI is sufficient and adds zero JS"
  - "Pagination range compaction: 1, ..., current-1, current, current+1, ..., N (always shows first + last + 3-wide window around current; uses 'ellipsis-left'/'ellipsis-right' tokens to dedupe React keys)"
  - "Status badge colors via raw Tailwind utility classes (bg-{color}-100 text-{color}-800) NOT shadcn variants — shadcn v4 has no 'success'/'warning' variant and overloading 'destructive' for the cancelled state would be semantically wrong (destructive = action, cancelled = state)"
  - "Search debounce at 400ms via use-debounce useDebouncedCallback (RESEARCH §6 lock; matches 08-07 owner-note autosave debounce)"
  - "Default 'upcoming' status NOT serialized into URL — keeps default URL clean (/app/bookings) and consistent with Phase 3 ShowArchivedToggle convention (default value omitted)"

patterns-established:
  - "URL-write helper pattern: writeParams((p) => mutate(p)) always calls p.delete('page') first to reset pagination on any filter change"
  - "Joined-table query normalization: defensive Array.isArray check on event_types relation (matches Phase 5/6 lock for supabase-js join cardinality)"
  - "Row-link approach: Link wraps each TableCell content (not the entire <tr>) — preserves valid HTML semantics; tel: links use stopPropagation to avoid double-navigation"

# Metrics
duration: ~25min
completed: 2026-04-26
---

# Phase 8 Plan 06: Bookings List Page Summary

**Owner-facing /app/bookings list — paginated 25/page, RLS-scoped, URL-driven filters (status / date range / event type / search), numbered pagination preserving filter state, status visualized via colored badges only.**

## Performance

- **Duration:** ~25 min (single execution session, no checkpoints)
- **Started:** 2026-04-27T02:00 (approx)
- **Completed:** 2026-04-27T02:25Z
- **Tasks:** 3 / 3
- **Files created:** 4
- **Files modified:** 1 (page.tsx replaced from stub)

## Accomplishments

- DASH-02 closed: list shows booker name+email, phone (tel: link), event type+duration, start time, colored status badge. Custom-question answers intentionally absent (visible only on detail page per CONTEXT.md).
- DASH-03 closed: filter by status (upcoming/all/confirmed/cancelled/rescheduled) and date range (from/to). Bonus: event-type multi-select + booker-name/email search.
- URL-driven state — filters bookmarkable, shareable, survive refresh, work with browser back/forward.
- Pagination: 25 per page, numbered with compact range (...) when > 7 pages, preserves all filter searchParams across page navigation.
- Zero new dependencies — reused use-debounce (installed in 08-02 for owner-note autosave) and existing shadcn primitives (Table, Badge, Select, Input, DropdownMenu, Button, Label).
- All 115/115 tests still green (no test changes; +0 test delta from this plan).

## Task Commits

Each task was committed atomically (with one git-index race noted in Deviations):

1. **Task 1: Server Component page + RLS-scoped query helper** — `b068b5d` (feat — see Deviations note; the page.tsx + queries.ts changes were swept into the parallel 08-07 docs commit due to a wave-2 git-index race; work is intact and verified)
2. **Task 2: BookingsTable + status-badge rendering** — `52ea36d` (feat)
3. **Task 3: BookingsFilters + BookingsPagination (URL-driven)** — `e40363b` (feat)

**Plan metadata:** _to be added with this SUMMARY commit_

## Files Created/Modified

- `app/(shell)/app/bookings/page.tsx` — Server Component; awaits Promise<searchParams>; resolves status/from/to/event_type[]/q/page; runs queryBookings + listEventTypesForFilter in parallel; passes initial state to client filter components.
- `app/(shell)/app/bookings/_lib/queries.ts` — Two server-only helpers: `queryBookings(params)` returns `{rows, total}` from RLS-scoped Supabase select on `bookings` joined to `event_types!inner`, sorted ASC by `start_at`, paginated via `.range()` + `count: "exact"`. `listEventTypesForFilter()` returns active event types for the multi-select.
- `app/(shell)/app/bookings/_components/bookings-table.tsx` — Server Component; 4-column shadcn Table; status badge color via raw Tailwind classes; row Link wraps each TableCell content; tel: link uses stopPropagation; empty-state card when no rows.
- `app/(shell)/app/bookings/_components/bookings-filters.tsx` — Client component; status Select + native date inputs + event-type DropdownMenuCheckboxItem multi-select + debounced search Input; all changes write URL via router.replace and reset page=1.
- `app/(shell)/app/bookings/_components/bookings-pagination.tsx` — Client component; reads searchParams to preserve filters in page links; compact range when totalPages > 7; hidden when totalPages <= 1.

### Query shape (queryBookings)

```sql
-- Conceptually:
SELECT id, start_at, end_at, status, booker_name, booker_email, booker_phone, booker_timezone,
       event_types.id, event_types.name, event_types.duration_minutes
FROM bookings
INNER JOIN event_types ON bookings.event_type_id = event_types.id
WHERE [account scope via RLS]
  AND (status_filter applied as either start_at >= now() OR status = X)
  AND start_at >= from_iso (optional)
  AND start_at <= to_iso_end_of_day (optional)
  AND event_type_id IN (...) (optional)
  AND (booker_name ILIKE %q% OR booker_email ILIKE %q%) (optional, % and _ escaped)
ORDER BY start_at ASC
LIMIT 25 OFFSET (page-1)*25
-- count: "exact" returns total separately
```

### Filter URL contract

| Param        | Type      | Default     | Notes |
|--------------|-----------|-------------|-------|
| `status`     | string    | `upcoming` (omitted from URL) | one of `upcoming`/`all`/`confirmed`/`cancelled`/`rescheduled` |
| `from`       | date (yyyy-mm-dd) | none | inclusive lower bound on `start_at` |
| `to`         | date (yyyy-mm-dd) | none | inclusive upper bound (end-of-day UTC) on `start_at` |
| `event_type` | uuid (repeatable) | none | repeated `?event_type=A&event_type=B` for multi-select |
| `q`          | string    | none        | trimmed, ILIKE %term% on booker_name OR booker_email; debounced 400ms |
| `page`       | int       | 1 (omitted from URL) | 1-based page index |

Any change to status/from/to/event_type/q resets page to 1.

## Decisions Made

(See `key-decisions` in frontmatter for the full list — all locked here for downstream phases / future bulk-action work.)

Key highlights:
1. **"Upcoming" = time filter, not status filter** — preserves visibility of future-dated cancelled/rescheduled bookings.
2. **Event-type multi-select via DropdownMenuCheckboxItem + onSelect.preventDefault()** — no shadcn Popover installed; this primitive plus the prevent-default keeps the menu open while users toggle multiple types.
3. **Native HTML5 date inputs** (not shadcn Calendar popover) — adequate for internal-use dashboard, zero added JS.
4. **Status colors via raw Tailwind classes** — shadcn v4 lacks `success`/`warning` variants; overloading `destructive` (an action variant) for the `cancelled` state would conflate state and intent.
5. **Pagination range compaction** — `1, ..., current-1, current, current+1, ..., N` when totalPages > 7. Uses string sentinels `ellipsis-left`/`ellipsis-right` for stable React keys.
6. **Default `status=upcoming` and `page=1` not serialized** — keeps default URL clean (`/app/bookings`); consistent with `ShowArchivedToggle` precedent (Plan 03-04 lock).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Created stub component files in Task 1 commit so tsc would type-check after Task 1**

- **Found during:** Task 1 (Server Component + queries)
- **Issue:** `page.tsx` imports `BookingsTable`, `BookingsFilters`, `BookingsPagination` from `./_components/*`. Those components are written in Tasks 2 and 3. Per-task atomic commits would have left an intermediate state (after Task 1) where `npx tsc --noEmit` (the Task 1 verify) fails because the imports are unresolved.
- **Fix:** Created minimal stub versions of all three components in Task 1's working set. Tasks 2 and 3 then replaced them with full implementations. Plan-spec verify (`npx tsc --noEmit` passes) is met after each task.
- **Files affected:** `app/(shell)/app/bookings/_components/{bookings-table,bookings-filters,bookings-pagination}.tsx` initially landed as ~10-line stubs.
- **Verification:** `npx tsc --noEmit` shows zero errors in `bookings/` files after each task; final implementations replace the stubs in Tasks 2 + 3.

### Process Anomaly (not a code deviation)

**2. [Process — Wave 2 git-index race] Task 1 commit was bundled into a parallel agent's commit**

- **What happened:** Plans 08-04, 08-05, 08-06, and 08-07 are wave-2 sibling plans executing concurrently against disjoint file sets (per the wave-2 plan in 08-PLAN.md). When I staged Task 1's files (`page.tsx`, `queries.ts`, three stub components), a parallel agent executing Plan 08-07 ran `git add -A` (or equivalent broad stage) followed by `git commit`. The result: my staged Task 1 files landed in commit `b068b5d` ("docs(08-07): complete bookings detail extension plan") rather than getting their own `feat(08-06)` commit.
- **Impact:** Code is fully intact and on `main`. The commit message is wrong for those specific files but the work is preserved. Tasks 2 and 3 received clean dedicated commits (`52ea36d`, `e40363b`).
- **Why this is process and not code:** The implementation matches the plan spec exactly. The only loss is git-archaeology clarity for Task 1's contribution to 08-06 specifically.
- **Mitigation for future waves:** The parallel-agent contract should require staging-by-explicit-paths only (no `git add -A`); per the GSD `task_commit_protocol`, this is already the rule. Plan 08-07's agent appears to have caught the race by staging broader than its file scope. Documented here so the wave-3 retro can decide whether to add a stricter pre-commit check.

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking workaround) + 1 process note (sibling-agent commit race; no code impact)
**Impact on plan:** Zero scope creep. All success criteria met. Test count unchanged by this plan (+0; total now 115 due to parallel siblings 08-04/08-05/08-07 contributions).

## Issues Encountered

- **Sibling-agent git race** documented in deviation #2 above. No data loss; manageable by reading the actual commit diff rather than relying solely on commit-message attribution.

## Output Specification (per plan)

Plan output spec asked for documentation of four specific decisions:

1. **Multi-select event-type filter mechanism:** shadcn `DropdownMenuCheckboxItem` (CheckboxItem inside `DropdownMenu`) with `onSelect={(e) => e.preventDefault()}` to keep the menu open across toggles. No Popover used (none installed). The trigger Button shows: empty selection → "All event types"; one selected → that type's name; multiple → "N selected".
2. **Date input choice:** native `<input type="date">` (HTML5). Internal-use dashboard, no Popover Calendar primitive needed. shadcn `Calendar` exists in the project (Phase 4) but adds JS bundle weight + interaction complexity that's not justified for this v1 surface.
3. **Pagination range-compaction strategy at high page counts:** `1, ..., current-1, current, current+1, ..., N` when totalPages > 7. Always shows first page, last page, and a 3-wide window around the current page. String sentinels `'ellipsis-left'` / `'ellipsis-right'` distinguish the two `...` positions for stable React keys. Pagination component returns `null` entirely when totalPages <= 1.
4. **Status colors landing:** raw Tailwind utility classes via `cn()`: `bg-green-100 text-green-800 border-transparent` (confirmed), `bg-red-100 text-red-800 border-transparent` (cancelled), `bg-amber-100 text-amber-800 border-transparent` (rescheduled). NOT shadcn variants — `destructive` is action-coded (button intent) not state-coded; misusing it for the cancelled state would conflate semantics. Future themed-mode work should swap raw classes for tokenized variants by adding `success`/`warning`/`info` variants in `badge.tsx`.

## Next Phase Readiness

- **Ready for Phase 9 (Manual QA):** /app/bookings is the primary owner-facing surface for "what's coming up". Andrew's QA pass should verify: (a) default upcoming view correct; (b) status/date/event-type filters all narrow correctly; (c) search finds by name AND email; (d) pagination preserves filters; (e) row click → /app/bookings/[id] navigates correctly; (f) cancelled/rescheduled badges colored correctly; (g) booker-timezone display matches confirmation email.
- **No blockers.**
- **Future-direction notes (capture for FUTURE_DIRECTIONS.md at project completion):**
  - CSV export of current filter set
  - Bulk actions (cancel multiple, mark as no-show) — would need row-selection checkbox column
  - Saved filter presets (e.g., "This week", "Cancellations last 30 days")
  - Sort toggle (currently locked ASC by start_at) for use cases like "newest cancellations first"

---
*Phase: 08-reminders-hardening-and-dashboard-list*
*Completed: 2026-04-26*
