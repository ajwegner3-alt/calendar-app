---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-06"
type: execute
wave: 2
depends_on: ["08-01"]
files_modified:
  - app/(shell)/app/bookings/page.tsx
  - app/(shell)/app/bookings/_components/bookings-table.tsx
  - app/(shell)/app/bookings/_components/bookings-filters.tsx
  - app/(shell)/app/bookings/_components/bookings-pagination.tsx
  - app/(shell)/app/bookings/_lib/queries.ts
autonomous: true

must_haves:
  truths:
    - "/app/bookings shows a paginated table of bookings the owner can see (RLS-scoped)"
    - "Default view is upcoming-only (start_at >= now()), sorted by start_at ASC"
    - "Columns: Booker (name+email stacked), Phone, Event type+duration, Start time + status badge"
    - "Filters via URL searchParams: status (upcoming/all/confirmed/cancelled/rescheduled), date range (from/to), event_type (multi), q (search booker name+email)"
    - "Status visualized via colored badge only (green=confirmed, red=cancelled, amber=rescheduled); row text styling unchanged"
    - "Pagination: 25 per page, numbered, shows page N of M"
    - "Each row links to /app/bookings/[id] (URL contract locked Phase 6)"
    - "Custom-question answers are NOT shown in the list (CONTEXT.md decision)"
  artifacts:
    - path: "app/(shell)/app/bookings/page.tsx"
      provides: "Server Component reading searchParams + querying bookings"
      contains: "searchParams"
    - path: "app/(shell)/app/bookings/_components/bookings-table.tsx"
      provides: "Compact table rendering rows with status badge"
      contains: "Table"
    - path: "app/(shell)/app/bookings/_components/bookings-filters.tsx"
      provides: "Client-side filter controls that update URL searchParams"
      contains: "router.replace"
    - path: "app/(shell)/app/bookings/_components/bookings-pagination.tsx"
      provides: "Numbered pagination respecting current filter state"
  key_links:
    - from: "app/(shell)/app/bookings/page.tsx"
      to: "Supabase bookings table (RLS-scoped)"
      via: "createClient() from server + .from('bookings').select(...).range()"
      pattern: "from\\(.bookings.\\)"
    - from: "app/(shell)/app/bookings/_components/bookings-table.tsx"
      to: "/app/bookings/[id]"
      via: "Next Link wrapping row"
      pattern: "/app/bookings/"
    - from: "app/(shell)/app/bookings/_components/bookings-filters.tsx"
      to: "URL state"
      via: "useRouter().replace(`?${searchParams}`)"
      pattern: "router\\.replace"
---

<objective>
Build the dashboard bookings list at `/app/bookings`: compact table, filters, pagination, RLS-scoped query, status-badge visualization. Closes DASH-02 (list with name/email/phone/event/time/status — answers in detail) and DASH-03 (filters by status + date range).

Purpose: This is the primary owner-facing surface for "what's coming up". Must be fast, scannable, bookmarkable (URL state), and consistent with Phase 3's event-types list pattern.

Output: One Server Component page + three client components + one query helper. No new dependencies (uses existing shadcn Table + URL searchParams pattern).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-CONTEXT.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-RESEARCH.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-01-SUMMARY.md
@app/(shell)/app/event-types/page.tsx
@app/(shell)/app/bookings/page.tsx
@components/ui/table.tsx
@components/ui/badge.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Server Component page + RLS-scoped query helper</name>
  <files>app/(shell)/app/bookings/page.tsx, app/(shell)/app/bookings/_lib/queries.ts</files>
  <action>
    Step A — read the existing pattern:

    Read `app/(shell)/app/event-types/page.tsx` for the canonical Phase 3 pattern: Server Component, awaits searchParams, RLS-scoped Supabase call, paginated, passes data to client components.

    Step B — query helper:

    Create `app/(shell)/app/bookings/_lib/queries.ts`:

    ```typescript
    import "server-only";
    import { createClient } from "@/lib/supabase/server";

    export interface BookingsQueryParams {
      statusFilter: "upcoming" | "all" | "confirmed" | "cancelled" | "rescheduled";
      from?: string | null;        // ISO date string (yyyy-mm-dd) or null
      to?: string | null;
      eventTypeIds?: string[];     // multi-select
      q?: string | null;           // free-text search
      page: number;                // 1-based
      pageSize: number;            // default 25
    }

    export interface BookingRow {
      id: string;
      start_at: string;
      end_at: string;
      status: "confirmed" | "cancelled" | "rescheduled";
      booker_name: string;
      booker_email: string;
      booker_phone: string | null;
      booker_timezone: string;
      event_types: {
        id: string;
        name: string;
        duration_minutes: number;
      };
    }

    export async function queryBookings(params: BookingsQueryParams): Promise<{
      rows: BookingRow[];
      total: number;
    }> {
      const supabase = await createClient();
      const offset = (params.page - 1) * params.pageSize;

      let q = supabase
        .from("bookings")
        .select(
          `id, start_at, end_at, status, booker_name, booker_email, booker_phone, booker_timezone,
           event_types!inner(id, name, duration_minutes)`,
          { count: "exact" }
        )
        .order("start_at", { ascending: true })
        .range(offset, offset + params.pageSize - 1);

      // Status filter (CONTEXT.md decision: default = upcoming-only).
      // "upcoming" applies ONLY a time filter (start_at >= now); it does NOT constrain status.
      // Future cancelled/rescheduled bookings remain visible in the upcoming view so the owner
      // can see lifecycle changes that have already happened to future bookings. Status filtering
      // is user-controlled via the dropdown (confirmed/cancelled/rescheduled options).
      if (params.statusFilter === "upcoming") {
        q = q.gte("start_at", new Date().toISOString());
      } else if (params.statusFilter !== "all") {
        q = q.eq("status", params.statusFilter);
      }

      if (params.from) q = q.gte("start_at", new Date(params.from).toISOString());
      if (params.to) {
        // Inclusive end-of-day for the to-date
        const toEnd = new Date(params.to);
        toEnd.setUTCHours(23, 59, 59, 999);
        q = q.lte("start_at", toEnd.toISOString());
      }

      if (params.eventTypeIds && params.eventTypeIds.length > 0) {
        q = q.in("event_type_id", params.eventTypeIds);
      }

      if (params.q && params.q.trim()) {
        const term = params.q.trim();
        // Sanitize for ilike (basic: escape % and _)
        const safe = term.replace(/[%_]/g, "\\$&");
        q = q.or(`booker_name.ilike.%${safe}%,booker_email.ilike.%${safe}%`);
      }

      const { data, count, error } = await q;
      if (error) throw error;

      return {
        rows: (data ?? []) as BookingRow[],
        total: count ?? 0,
      };
    }

    export async function listEventTypesForFilter(): Promise<Array<{ id: string; name: string }>> {
      const supabase = await createClient();
      const { data } = await supabase
        .from("event_types")
        .select("id, name")
        .is("deleted_at", null)
        .order("name", { ascending: true });
      return data ?? [];
    }
    ```

    Critical:
    - Uses RLS-scoped `createClient()` (NOT admin client) — owner sees only their account's bookings via Phase 1 RLS policies.
    - `event_type_id` is the FK column on `bookings` per Phase 3 schema. Verify the column name in `supabase/migrations/20260419120000_initial_schema.sql` and adjust if it's named differently.
    - Pagination uses Supabase's `.range()` + `count: "exact"` (cheap because of `bookings_account_start_idx`).
    - Default sort = ASC on `start_at`. Soonest first per CONTEXT.md.

    Step C — page.tsx:

    Create `app/(shell)/app/bookings/page.tsx`:

    ```typescript
    import { queryBookings, listEventTypesForFilter } from "./_lib/queries";
    import { BookingsTable } from "./_components/bookings-table";
    import { BookingsFilters } from "./_components/bookings-filters";
    import { BookingsPagination } from "./_components/bookings-pagination";

    const PAGE_SIZE = 25;

    type SP = {
      status?: string;
      from?: string;
      to?: string;
      event_type?: string | string[];
      q?: string;
      page?: string;
    };

    export default async function BookingsPage({
      searchParams,
    }: {
      searchParams: Promise<SP>;
    }) {
      const sp = await searchParams;
      const page = Math.max(1, Number(sp.page ?? "1") || 1);
      const statusFilter = (["upcoming", "all", "confirmed", "cancelled", "rescheduled"].includes(sp.status ?? "") ? sp.status : "upcoming") as "upcoming" | "all" | "confirmed" | "cancelled" | "rescheduled";
      const eventTypeIds = Array.isArray(sp.event_type) ? sp.event_type : sp.event_type ? [sp.event_type] : [];

      const [{ rows, total }, eventTypes] = await Promise.all([
        queryBookings({
          statusFilter,
          from: sp.from ?? null,
          to: sp.to ?? null,
          eventTypeIds,
          q: sp.q ?? null,
          page,
          pageSize: PAGE_SIZE,
        }),
        listEventTypesForFilter(),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

      return (
        <div className="space-y-6 p-6">
          <header>
            <h1 className="text-2xl font-semibold">Bookings</h1>
            <p className="text-sm text-muted-foreground">
              {total} {total === 1 ? "booking" : "bookings"} matching current filters
            </p>
          </header>
          <BookingsFilters
            initial={{
              status: statusFilter,
              from: sp.from ?? "",
              to: sp.to ?? "",
              eventTypeIds,
              q: sp.q ?? "",
            }}
            eventTypes={eventTypes}
          />
          <BookingsTable rows={rows} />
          <BookingsPagination page={page} totalPages={totalPages} />
        </div>
      );
    }
    ```

    NOTE: `app/(shell)/app/bookings/page.tsx` already exists (Phase 6 placeholder). REPLACE it. The list URL is what STATE.md line 173 calls "Phase 8 placeholder" — fill it in here.

    Use Next.js 16 `await searchParams` pattern (RESEARCH Pitfall 4).
  </action>
  <verify>
    `ls app/(shell)/app/bookings/_lib/queries.ts` exists.
    `grep -n "queryBookings\|searchParams" app/(shell)/app/bookings/page.tsx` shows usage.
    `grep -n "ascending: true" app/(shell)/app/bookings/_lib/queries.ts` confirms ASC sort.
    `npx tsc --noEmit` passes.
    Manual: `npm run dev`, /app/bookings renders without error (empty table acceptable if no data).
  </verify>
  <done>
    Server Component reads searchParams, queries bookings via RLS, prepares data for child client components. Default = upcoming, ASC by start_at, paginated 25/page.
  </done>
</task>

<task type="auto">
  <name>Task 2: BookingsTable + status-badge rendering</name>
  <files>app/(shell)/app/bookings/_components/bookings-table.tsx</files>
  <action>
    Create `app/(shell)/app/bookings/_components/bookings-table.tsx` ("use client" not strictly needed if no interactivity beyond the Link — server component is fine, but if Sonner toasts or hover state added later, switch to client. Start as Server Component.):

    Use shadcn `<Table>` from `components/ui/table.tsx` and `<Badge>` from `components/ui/badge.tsx`.

    Columns (CONTEXT.md decision):

    | Column | Content |
    |--------|---------|
    | Booker | Two-line: name (medium weight) above email (muted small) |
    | Phone | `tel:` link if present; `—` em dash if null |
    | Event | Two-line: event_types.name above `${duration_minutes} min` muted |
    | Start time + Status | `format(start_at, "MMM d, yyyy 'at' h:mm a (z)")` in booker_timezone via TZDate, with a trailing colored Badge |

    Status badge variant by color (CONTEXT.md):
    - confirmed → green (Tailwind: `bg-green-100 text-green-800` or shadcn variant `default`/`success`)
    - cancelled → red (`bg-red-100 text-red-800` or `destructive`)
    - rescheduled → amber (`bg-amber-100 text-amber-800` or `warning`)

    Each row wraps in `<Link href={`/app/bookings/${row.id}`} className="...">` so the entire row is clickable. Use `<TableRow>`'s `className="cursor-pointer hover:bg-accent/50"` and put the Link as a child of TableCell content, OR place Link wrapper outside TableRow if shadcn allows. The Phase 3 event-types pattern shows the canonical approach — match it.

    Empty state: When `rows.length === 0`, render a friendly empty-state card: "No bookings yet" or "No bookings match these filters" (depending on whether filters are active). Phase 3 event-types page has an empty state — mirror its visual.

    Critical:
    - Do NOT show custom answers anywhere on the list (CONTEXT.md locked).
    - Do NOT dim or strikethrough rows for cancelled bookings — status is conveyed by badge color only.
    - Time formatting MUST use booker_timezone (TZDate from `@date-fns/tz`), matching the convention used in confirmation/reminder emails. Showing time in the OWNER's timezone instead would mislead — Phase 4 established booker-timezone-on-display.
  </action>
  <verify>
    `grep -n "Badge\|bg-green\|bg-red\|bg-amber" app/(shell)/app/bookings/_components/bookings-table.tsx` shows status visualization.
    `grep -n "/app/bookings/" app/(shell)/app/bookings/_components/bookings-table.tsx` shows row link.
    `grep -n "answers" app/(shell)/app/bookings/_components/bookings-table.tsx` returns NOTHING (custom answers must not appear in list).
    `npm run dev` + visit /app/bookings — empty state OR rendered rows with badges.
  </verify>
  <done>
    Compact table renders 4-column layout. Status visualized by colored badges only. Rows clickable to detail. Empty state present.
  </done>
</task>

<task type="auto">
  <name>Task 3: BookingsFilters + BookingsPagination (URL-driven)</name>
  <files>app/(shell)/app/bookings/_components/bookings-filters.tsx, app/(shell)/app/bookings/_components/bookings-pagination.tsx</files>
  <action>
    Step A — BookingsFilters ("use client"):

    Four controls in a single horizontal row (collapsible/wrap on mobile):

    1. **Status select** — shadcn `<Select>` with options: Upcoming (default), All, Confirmed, Cancelled, Rescheduled.
    2. **Date range** — two date inputs (`from`, `to`) using shadcn `<Calendar>` in popover OR plain `<input type="date">` for v1 simplicity. Phase 4 uses `react-day-picker` via shadcn Calendar — match that convention if a popover-date pattern already exists in the codebase, otherwise plain native inputs are acceptable for v1 dashboard internal-use.
    3. **Event type multi-select** — fetched via `eventTypes` prop. Use a shadcn `<Select>` with multiple selection if available; otherwise a series of checkboxes in a popover. Phase 3 doesn't have an existing multi-select — plain checkbox group inside a `<Popover>` is fine. Read the codebase first; reuse any existing multi-select from Phase 3 if found.
    4. **Search input** — `<Input placeholder="Search booker name or email" />` with debounced URL update (use `use-debounce` from 08-02 — `useDebouncedCallback` at 400ms).

    On any change, build new URLSearchParams from current state and call `router.replace(?${qs.toString()}, { scroll: false })`. Reset `page` to 1 when filters change.

    Step B — BookingsPagination ("use client"):

    Numbered pagination (CONTEXT.md decision):
    - Show: `← Prev | 1 2 3 ... N | Next →`
    - Highlight current page
    - Each page number is a `<Link>` with `?page=N&...current-filters`
    - Use `useSearchParams` to read current filters and preserve them when constructing page links
    - Disable Prev when page=1, Next when page=totalPages
    - Compact range when totalPages > 7 (show 1, 2, ..., current-1, current, current+1, ..., totalPages-1, totalPages — standard pattern)

    Critical:
    - All filter and pagination state lives in URL searchParams (RESEARCH Pattern 5). NO React state-only filters — bookmarkable and SSR-friendly.
    - Use `router.replace` (NOT `router.push`) so back button doesn't accumulate filter changes.

    Final check: `npm run build`, `npm run dev`, navigate to /app/bookings, exercise each filter + pagination, confirm URL updates and table refreshes via Next's automatic re-render of the Server Component.

    Commit:
    ```bash
    git add app/\(shell\)/app/bookings/page.tsx \
            app/\(shell\)/app/bookings/_components \
            app/\(shell\)/app/bookings/_lib
    git commit -m "feat(08-06): bookings list page with filters + pagination + status badges"
    ```
  </action>
  <verify>
    `grep -n "useDebouncedCallback\|router.replace" app/(shell)/app/bookings/_components/bookings-filters.tsx` shows debounced URL update.
    `grep -n "useSearchParams\|page=" app/(shell)/app/bookings/_components/bookings-pagination.tsx` shows page link construction preserves filters.
    `npm run build` succeeds.
    Manual: filtering by status, date range, event type, search; pagination — all reflect in URL and re-render server component.
  </verify>
  <done>
    Filters + pagination live in URL. Bookmarkable. Page navigation preserves filters. Search debounced 400ms.
  </done>
</task>

</tasks>

<verification>
1. `/app/bookings` lists upcoming bookings 25/page, ASC by start_at.
2. Status filter (upcoming/all/confirmed/cancelled/rescheduled) works.
3. Date-range filter narrows by start_at.
4. Event-type multi-select narrows by event_type_id.
5. Search filters booker_name + booker_email (debounced).
6. Numbered pagination preserves filters across pages.
7. Status badges colored correctly (green/red/amber).
8. Each row links to /app/bookings/[id].
9. Custom-question answers NOT visible in list.
10. `npm run build` and `npm test` succeed.
</verification>

<success_criteria>
- DASH-02: List shows name+email, phone, event type+duration, start time, status. Custom answers hidden (visible in detail per CONTEXT).
- DASH-03: Filterable by status (upcoming/all/confirmed/cancelled/rescheduled) and date range; bonus: event type multi-select + search.
- URL-driven state — bookmarkable filters.
- Phase 3 event-types pattern reused — same shell, same pagination shape.
- Zero new dependencies (uses existing shadcn Table + use-debounce from 08-02).
</success_criteria>

<output>
After completion, create `.planning/phases/08-reminders-hardening-and-dashboard-list/08-06-SUMMARY.md` documenting:
- Whether multi-select event-type filter used Popover+checkboxes or another shadcn pattern
- Date input choice (native vs popover Calendar)
- Pagination range-compaction strategy at high page counts
- How status colors landed (Tailwind raw classes vs shadcn variant)
</output>
