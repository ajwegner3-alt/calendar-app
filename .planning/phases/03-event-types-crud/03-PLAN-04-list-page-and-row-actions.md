---
phase: 03-event-types-crud
plan: 04
type: execute
wave: 3
depends_on: ["03-03"]
files_modified:
  - app/(shell)/app/event-types/page.tsx
  - app/(shell)/app/event-types/loading.tsx
  - app/(shell)/app/event-types/_components/event-types-table.tsx
  - app/(shell)/app/event-types/_components/status-badge.tsx
  - app/(shell)/app/event-types/_components/row-actions-menu.tsx
  - app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx
  - app/(shell)/app/event-types/_components/restore-collision-dialog.tsx
  - app/(shell)/app/event-types/_components/show-archived-toggle.tsx
  - app/(shell)/app/event-types/_components/empty-state.tsx
autonomous: true

must_haves:
  truths:
    - "Andrew visits /app/event-types and sees a table of his event types with columns Name / Duration / Slug / Status / Actions, in created-at-ascending order (EVENT-01..04 surface)"
    - "Empty state (no event types yet) shows a friendly card with a 'Create event type' CTA linking to /app/event-types/new"
    - "Each row has a kebab (⋯) DropdownMenu with: Edit (link to /[id]/edit), Make active / Make inactive (calls toggleActiveAction, no confirm), Archive (opens delete-confirm dialog) for active+inactive rows; Restore for archived rows (EVENT-04, EVENT-03)"
    - "Status column shows three badge variants: Active (default), Inactive (secondary), Archived (outline) — and inactive rows have opacity-60 + archived rows have opacity-50 line-through (CONTEXT visual decision)"
    - "A 'Show archived' toggle near the page header reveals soft-deleted rows; toggle state lives in URL (?archived=true) so it survives refresh and is server-rendered"
    - "Delete confirmation dialog: zero-bookings path shows simple Are-you-sure; has-bookings path requires typing the event type name to enable the confirm button (EVENT-03 + GitHub/Stripe pattern)"
    - "Booking count is fetched lazily inside the dialog (after Archive is clicked) via supabase browser client with .neq('status','cancelled') and {count:'exact', head:true} (RESEARCH Open Q1 recommendation)"
    - "Restore: clicking Restore in the kebab calls restoreEventTypeAction(id); if the response is {slugCollision: true}, a standalone Dialog opens with a slug input pre-filled with `${currentSlug}-restored` and calls restoreEventTypeAction(id, newSlug) on confirm (RESEARCH Open Q3 standalone-Dialog recommendation)"
    - "After every successful CRUD action, a Sonner toast fires (toast.success / toast.error); the list refreshes via revalidatePath in the action"
    - "loading.tsx renders a full skeleton table during navigation/refresh (CONTEXT Claude's Discretion — full skeleton chosen)"
  artifacts:
    - path: "app/(shell)/app/event-types/page.tsx"
      provides: "Server Component — async searchParams handling, calls supabase to load event_types filtered by archived param, renders EventTypesTable or EmptyState"
      min_lines: 40
      contains: "current_owner_account_ids"
    - path: "app/(shell)/app/event-types/loading.tsx"
      provides: "Skeleton table that renders during route transitions"
      min_lines: 15
    - path: "app/(shell)/app/event-types/_components/event-types-table.tsx"
      provides: "Client component — renders shadcn Table with rows, status badges, row-actions menu; receives EventTypeListItem[] as prop"
      contains: "use client"
      min_lines: 50
    - path: "app/(shell)/app/event-types/_components/status-badge.tsx"
      provides: "Pure component — maps {is_active, deleted_at} to Active/Inactive/Archived Badge with correct variant"
    - path: "app/(shell)/app/event-types/_components/row-actions-menu.tsx"
      provides: "Client component — DropdownMenu kebab with Edit / Toggle Active / Archive / Restore items conditioned on row state"
      contains: "use client"
    - path: "app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx"
      provides: "Client component — AlertDialog with two-tier (zero-bookings vs has-bookings) confirmation; lazily fetches booking count via supabase browser client"
      contains: "use client"
      min_lines: 50
    - path: "app/(shell)/app/event-types/_components/restore-collision-dialog.tsx"
      provides: "Client component — standalone Dialog (not nested) with slug input that opens when restoreEventTypeAction returns {slugCollision: true}"
      contains: "use client"
      min_lines: 30
    - path: "app/(shell)/app/event-types/_components/show-archived-toggle.tsx"
      provides: "Client component — Switch wired to URL searchParam (router.replace) so state survives refresh"
      contains: "use client"
    - path: "app/(shell)/app/event-types/_components/empty-state.tsx"
      provides: "Pure component — friendly card with copy + 'Create event type' button linking to /new"
  key_links:
    - from: "app/(shell)/app/event-types/page.tsx"
      to: "Supabase event_types table"
      via: ".select(...).is('deleted_at', null) or .not('deleted_at', 'is', null) based on searchParams"
      pattern: "deleted_at"
    - from: "app/(shell)/app/event-types/_components/row-actions-menu.tsx"
      to: "app/(shell)/app/event-types/_lib/actions.ts"
      via: "imports toggleActiveAction, restoreEventTypeAction"
      pattern: "toggleActiveAction|restoreEventTypeAction"
    - from: "app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx"
      to: "app/(shell)/app/event-types/_lib/actions.ts"
      via: "imports softDeleteEventTypeAction"
      pattern: "softDeleteEventTypeAction"
    - from: "app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx"
      to: "Supabase bookings table"
      via: "client supabase .from('bookings').select('id', {count: 'exact', head: true}).eq('event_type_id', id).neq('status', 'cancelled')"
      pattern: "bookings"
    - from: "app/(shell)/app/event-types/_components/restore-collision-dialog.tsx"
      to: "app/(shell)/app/event-types/_lib/actions.ts"
      via: "calls restoreEventTypeAction(id, newSlug)"
      pattern: "restoreEventTypeAction"
---

<objective>
Ship the event-types LIST surface: the server-rendered list page (with archived-filter searchParam), the table client component with kebab row actions (Edit / Toggle Active / Archive / Restore), the delete-confirm dialog (two-tier based on booking count), the restore-collision dialog, the show-archived toggle, the empty state, and a loading skeleton.

Purpose: Replaces the Phase 2 stub at `/app/event-types`. Andrew can browse all his event types, filter active/archived, and act on rows (toggle, archive, restore) without leaving the list. Edit + Create live on dedicated routes (Plan 05).

Output: A working `/app/event-types` page that renders the seeded data (after Plan 05 lets Andrew create some), supports the full row-action set, and uses Sonner toasts for feedback. Replaces `app/(shell)/app/event-types/page.tsx` (Phase 2 stub) entirely.

Plan-level scoping: This plan does NOT build the create/edit form or the custom-questions sub-component — Plan 05 owns those. Edit links from the kebab go to `/app/event-types/${id}/edit` (route exists from Plan 05). The Archive flow's interaction with Plan 03's `softDeleteEventTypeAction` is the shared boundary; the Restore flow's interaction with Plan 03's `restoreEventTypeAction` (including `{slugCollision}` shape) is the other shared boundary. Both are stable contracts from Plan 03's SUMMARY.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-event-types-crud/03-CONTEXT.md
@.planning/phases/03-event-types-crud/03-RESEARCH.md
@.planning/phases/03-event-types-crud/03-01-SUMMARY.md
@.planning/phases/03-event-types-crud/03-02-SUMMARY.md
@.planning/phases/03-event-types-crud/03-03-SUMMARY.md

# Plan 03 module this plan consumes
@app/(shell)/app/event-types/_lib/actions.ts
@app/(shell)/app/event-types/_lib/types.ts

# Existing patterns to inherit
@app/(shell)/app/page.tsx
@lib/supabase/server.ts
@lib/supabase/client.ts
@components/ui/table.tsx
@components/ui/dropdown-menu.tsx
@components/ui/alert-dialog.tsx
@components/ui/dialog.tsx
@components/ui/badge.tsx
@components/ui/sonner.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ship the list page (Server Component) + loading skeleton + empty state + status badge</name>
  <files>app/(shell)/app/event-types/page.tsx, app/(shell)/app/event-types/loading.tsx, app/(shell)/app/event-types/_components/empty-state.tsx, app/(shell)/app/event-types/_components/status-badge.tsx</files>
  <action>
**REPLACE** the Phase 2 stub at `app/(shell)/app/event-types/page.tsx` with the real Server Component. Also create `loading.tsx` (route-level skeleton), `empty-state.tsx`, and `status-badge.tsx`.

**File 1 — `app/(shell)/app/event-types/page.tsx`** (REPLACES Phase 2 stub):

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { EventTypeListItem } from "./_lib/types";
import { EventTypesTable } from "./_components/event-types-table";
import { EmptyState } from "./_components/empty-state";
import { ShowArchivedToggle } from "./_components/show-archived-toggle";

// Next.js 16: searchParams is a Promise — must be awaited (RESEARCH Pitfall 4).
export default async function EventTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "true";

  const supabase = await createClient();

  // Soft-delete filter — RESEARCH §"Soft-Delete Query Filter":
  //   .is("deleted_at", null) for IS NULL
  //   .not("deleted_at", "is", null) for IS NOT NULL
  // (NOT .eq which generates `= null` and is always false in SQL.)
  let query = supabase
    .from("event_types")
    .select(
      "id, name, slug, duration_minutes, is_active, deleted_at, created_at",
    )
    .order("created_at", { ascending: true });

  query = showArchived
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load event types: ${error.message}`);
  }

  const eventTypes = (data ?? []) as EventTypeListItem[];

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Event Types</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define what people can book — name, slug, duration, custom questions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ShowArchivedToggle defaultChecked={showArchived} />
          <Button asChild>
            <Link href="/app/event-types/new">Create event type</Link>
          </Button>
        </div>
      </header>

      {eventTypes.length === 0 ? (
        <EmptyState showArchived={showArchived} />
      ) : (
        <EventTypesTable eventTypes={eventTypes} showArchived={showArchived} />
      )}
    </div>
  );
}
```

**File 2 — `app/(shell)/app/event-types/loading.tsx`** (full skeleton table — CONTEXT Claude's Discretion choice):

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function EventTypesLoading() {
  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="border-b bg-muted/40 h-10" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-b last:border-b-0 grid grid-cols-5 gap-4 px-4 py-3"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-6 w-6 ml-auto rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**File 3 — `app/(shell)/app/event-types/_components/empty-state.tsx`**:

```tsx
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EmptyState({ showArchived }: { showArchived: boolean }) {
  if (showArchived) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No archived event types</CardTitle>
          <CardDescription>
            Event types you archive will appear here. Toggle &quot;Show archived&quot; off
            to see your active list.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>No event types yet</CardTitle>
            <CardDescription>
              Create your first event type to start accepting bookings.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/app/event-types/new">Create event type</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

**File 4 — `app/(shell)/app/event-types/_components/status-badge.tsx`** (pure component — RESEARCH §"Status Badge Logic"):

```tsx
import { Badge } from "@/components/ui/badge";

export function StatusBadge({
  isActive,
  deletedAt,
}: {
  isActive: boolean;
  deletedAt: string | null;
}) {
  if (deletedAt) return <Badge variant="outline">Archived</Badge>;
  if (!isActive) return <Badge variant="secondary">Inactive</Badge>;
  return <Badge>Active</Badge>;
}
```

Key rules:
- `searchParams` MUST be `await`ed — Next.js 16 makes it a Promise (RESEARCH Pitfall 4).
- Use `.is("deleted_at", null)` and `.not("deleted_at", "is", null)` — NEVER `.eq("deleted_at", null)` (RESEARCH explicit warning).
- The list page does NOT do an `current_owner_account_ids` linkage check — RLS handles it (the SELECT will simply return zero rows if Andrew is unlinked, which renders the empty state). This matches the Phase 2 STATE.md decision: "Stub pages at /app/event-types... inherit the check naturally when Phases 3/4/7/8 start querying tenant data" — by querying tenant data via RLS-scoped client, an unlinked user just sees an empty result. The Phase 2 unlinked redirect on `/app` is the safety net.
- Error handling on the SELECT: throw, which surfaces the Next.js error boundary. Don't silently render zero rows on error — that hides infrastructure problems.
- The header layout is `max-w-5xl` (not `max-w-3xl` like Phase 2's pages) — table content needs more horizontal room than copy.
- Empty state has TWO variants: archived-empty ("no archived types") vs primary-empty ("create your first") — different copy + only the primary variant has the CTA button.
- StatusBadge mapping: `deletedAt → "Archived" outline`, `!isActive → "Inactive" secondary`, else `"Active" default`. Order matters — check `deletedAt` first because an archived row may also have `is_active=true` in storage.

DO NOT:
- Do not add a `current_owner_account_ids` redirect — RLS + Phase 2 unlinked-redirect are sufficient (see above).
- Do not add column sort UI — CONTEXT.md doesn't require it; rows are always created-at ascending.
- Do not add pagination — CONTEXT.md explicitly skips it (5-10 event types).
- Do not add a "Search" input — out of CONTEXT scope.
- Do not pre-fetch booking counts in the list query — RESEARCH Open Q1: lazy-fetch in the dialog.
  </action>
  <verify>
```bash
ls "app/(shell)/app/event-types/"{page,loading}.tsx
ls "app/(shell)/app/event-types/_components/"{empty-state,status-badge}.tsx

# Page wires the right things
grep -q "await searchParams" "app/(shell)/app/event-types/page.tsx" && echo "async searchParams ok"
grep -q '\.is("deleted_at", null)' "app/(shell)/app/event-types/page.tsx" && echo "active filter ok"
grep -q '\.not("deleted_at", "is", null)' "app/(shell)/app/event-types/page.tsx" && echo "archived filter ok"
grep -q "EventTypesTable" "app/(shell)/app/event-types/page.tsx" && echo "table rendered"
grep -q "EmptyState" "app/(shell)/app/event-types/page.tsx" && echo "empty state rendered"
grep -q "/app/event-types/new" "app/(shell)/app/event-types/page.tsx" && echo "new link ok"

# Status badge has all 3 branches
grep -q "Archived" "app/(shell)/app/event-types/_components/status-badge.tsx" && echo "archived branch"
grep -q "Inactive" "app/(shell)/app/event-types/_components/status-badge.tsx" && echo "inactive branch"

npm run build
```

Note: The build will FAIL until Task 2 ships `event-types-table.tsx` and `show-archived-toggle.tsx` because page.tsx imports them. That's expected — the build success gate moves to Task 2's verify.
  </verify>
  <done>
`page.tsx`, `loading.tsx`, `empty-state.tsx`, `status-badge.tsx` all exist with the contents described. The page is a Server Component that awaits `searchParams`, switches between active and archived filters using `.is`/`.not("deleted_at", "is", null)`, and renders either `EmptyState` or `EventTypesTable`. `npm run build` will fail until Task 2 ships the imported components — expected.

Commit: `feat(03-04): list page server component with loading/empty/badge primitives`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Ship the table client component + show-archived toggle + row-actions menu</name>
  <files>app/(shell)/app/event-types/_components/event-types-table.tsx, app/(shell)/app/event-types/_components/show-archived-toggle.tsx, app/(shell)/app/event-types/_components/row-actions-menu.tsx</files>
  <action>
Create three Client Components. The table shell, the searchParam-bound toggle, and the kebab menu live as separate files so each is small and focused.

**File 1 — `app/(shell)/app/event-types/_components/show-archived-toggle.tsx`** (Switch wired to URL):

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ShowArchivedToggle({
  defaultChecked,
}: {
  defaultChecked: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("archived", "true");
    else params.delete("archived");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="show-archived"
        checked={defaultChecked}
        onCheckedChange={handleChange}
      />
      <Label htmlFor="show-archived" className="text-sm font-normal cursor-pointer">
        Show archived
      </Label>
    </div>
  );
}
```

**File 2 — `app/(shell)/app/event-types/_components/event-types-table.tsx`** (the table — pure presentational; row actions delegated to RowActionsMenu):

```tsx
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventTypeListItem } from "../_lib/types";
import { StatusBadge } from "./status-badge";
import { RowActionsMenu } from "./row-actions-menu";

export function EventTypesTable({
  eventTypes,
  showArchived,
}: {
  eventTypes: EventTypeListItem[];
  showArchived: boolean;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-28">Duration</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-12 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {eventTypes.map((et) => {
            const rowClass = et.deleted_at
              ? "opacity-50 [&>td]:line-through"
              : !et.is_active
                ? "opacity-60"
                : "";
            return (
              <TableRow key={et.id} className={rowClass}>
                <TableCell className="font-medium">{et.name}</TableCell>
                <TableCell>{et.duration_minutes} min</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {et.slug}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    isActive={et.is_active}
                    deletedAt={et.deleted_at}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <RowActionsMenu
                    id={et.id}
                    name={et.name}
                    isActive={et.is_active}
                    isArchived={!!et.deleted_at}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

**File 3 — `app/(shell)/app/event-types/_components/row-actions-menu.tsx`** (kebab — branches actions on row state):

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  toggleActiveAction,
  restoreEventTypeAction,
} from "../_lib/actions";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { RestoreCollisionDialog } from "./restore-collision-dialog";

export function RowActionsMenu({
  id,
  name,
  isActive,
  isArchived,
}: {
  id: string;
  name: string;
  isActive: boolean;
  isArchived: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [collisionOpen, setCollisionOpen] = useState(false);
  const [collisionSlug, setCollisionSlug] = useState<string | null>(null);

  async function handleToggle() {
    startTransition(async () => {
      const result = await toggleActiveAction(id, !isActive);
      if (result.formError) {
        toast.error(result.formError);
      } else {
        toast.success(isActive ? "Set to inactive." : "Set to active.");
        router.refresh();
      }
    });
  }

  async function handleRestore() {
    startTransition(async () => {
      const result = await restoreEventTypeAction(id);
      if ("ok" in result) {
        toast.success("Restored as inactive.");
        router.refresh();
      } else if ("slugCollision" in result) {
        setCollisionSlug(result.currentSlug);
        setCollisionOpen(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${name}`}
            disabled={isPending}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isArchived && (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/app/event-types/${id}/edit`}>Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleToggle}>
                {isActive ? "Make inactive" : "Make active"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setArchiveOpen(true);
                }}
                className="text-destructive focus:text-destructive"
              >
                Archive
              </DropdownMenuItem>
            </>
          )}
          {isArchived && (
            <DropdownMenuItem onSelect={handleRestore}>Restore</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        eventTypeId={id}
        eventTypeName={name}
      />

      {collisionSlug && (
        <RestoreCollisionDialog
          open={collisionOpen}
          onOpenChange={setCollisionOpen}
          eventTypeId={id}
          originalSlug={collisionSlug}
        />
      )}
    </>
  );
}
```

Key rules:
- `useTransition` wraps the action calls so the trigger button can disable + the UI doesn't tear during the action's redirect/revalidate cycle.
- On `Make active`/`Make inactive`, after the action succeeds, call `router.refresh()` to trigger the Server Component re-render (the action's `revalidatePath` invalidates the cache; `router.refresh()` is what re-fetches in the current client). This pattern is required because `toggleActiveAction` does NOT redirect (it returns `{}`).
- `DropdownMenuItem onSelect` DEFAULT closes the menu and triggers the handler. For the "Archive" item, we also need to OPEN a controlled AlertDialog — calling `e.preventDefault()` keeps focus management sane while we open the dialog.
- The Archive AlertDialog (DeleteConfirmDialog) is a CONTROLLED component — its `open` state lives in `RowActionsMenu`, not inside the dialog. This is because the menu must imperatively open the dialog after the user picks "Archive".
- The RestoreCollisionDialog is mounted CONDITIONALLY (`{collisionSlug && ...}`) — we only mount it when we have a collision to show. Otherwise it sits unmounted, no DOM.
- Active/inactive AND archived rows expose DIFFERENT kebab items: active+inactive show Edit / Toggle / Archive; archived shows Restore only. (No "Edit" for archived rows — CONTEXT.md doesn't allow editing archived types directly; user must restore first.)
- `aria-label` on the kebab button is descriptive (`Actions for ${name}`) — improves screen-reader experience over a generic "Row actions".
- Sonner toasts: use `toast.success(msg)` for happy path, `toast.error(msg)` for errors. Match Phase 2's friendly tone.

DO NOT:
- Do not add a "Duplicate" or "Copy URL" item — CONTEXT.md defers both to v2.
- Do not show all four items unconditionally — Edit on archived rows is wrong UX.
- Do not call `softDeleteEventTypeAction` directly here — the dialog owns that call (it needs the booking-count branch first).
- Do not use `router.push("/app/event-types")` after toggle — the page already IS `/app/event-types`; `router.refresh()` is the right primitive to re-fetch the server component.
  </action>
  <verify>
```bash
ls "app/(shell)/app/event-types/_components/"{event-types-table,show-archived-toggle,row-actions-menu}.tsx

# Table imports the right things
grep -q '"use client"' "app/(shell)/app/event-types/_components/event-types-table.tsx" && echo "table client ok"
grep -q "RowActionsMenu" "app/(shell)/app/event-types/_components/event-types-table.tsx" && echo "table uses kebab"
grep -q "StatusBadge" "app/(shell)/app/event-types/_components/event-types-table.tsx" && echo "table uses badge"
grep -q "line-through" "app/(shell)/app/event-types/_components/event-types-table.tsx" && echo "archived row styling ok"

# Toggle wires URL param
grep -q "useRouter" "app/(shell)/app/event-types/_components/show-archived-toggle.tsx" && echo "toggle uses router"
grep -q 'archived"' "app/(shell)/app/event-types/_components/show-archived-toggle.tsx" && echo "toggle param ok"

# Row actions menu has the right action set
grep -q "toggleActiveAction" "app/(shell)/app/event-types/_components/row-actions-menu.tsx" && echo "toggle wired"
grep -q "restoreEventTypeAction" "app/(shell)/app/event-types/_components/row-actions-menu.tsx" && echo "restore wired"
grep -q "DeleteConfirmDialog" "app/(shell)/app/event-types/_components/row-actions-menu.tsx" && echo "delete dialog wired"
grep -q "RestoreCollisionDialog" "app/(shell)/app/event-types/_components/row-actions-menu.tsx" && echo "collision dialog wired"
grep -q "isArchived" "app/(shell)/app/event-types/_components/row-actions-menu.tsx" && echo "isArchived branching ok"
grep -q '/app/event-types/\${id}/edit' "app/(shell)/app/event-types/_components/row-actions-menu.tsx" && echo "edit link ok"
```

Note: Build will still fail until Task 3 ships the dialogs. Build verification moves to Task 3.
  </verify>
  <done>
`event-types-table.tsx`, `show-archived-toggle.tsx`, `row-actions-menu.tsx` all exist as Client Components. The table renders all 5 columns with conditional row styling (opacity-50+line-through for archived, opacity-60 for inactive). The toggle binds the `archived` URL param via `router.replace`. The kebab menu shows Edit + Toggle + Archive on active/inactive rows, Restore on archived rows; Archive opens a controlled AlertDialog; Restore handles `{slugCollision}` by opening the RestoreCollisionDialog.

Commit: `feat(03-04): event types table, show-archived toggle, row actions kebab`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Ship the delete-confirm dialog (two-tier) + restore-collision dialog</name>
  <files>app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx, app/(shell)/app/event-types/_components/restore-collision-dialog.tsx</files>
  <action>
Create the two dialog components. The DeleteConfirmDialog has the GitHub/Stripe two-tier pattern; the RestoreCollisionDialog is the standalone-Dialog (NOT nested AlertDialog) per RESEARCH Open Q3.

**File 1 — `app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx`**:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { softDeleteEventTypeAction } from "../_lib/actions";

type CountState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; count: number }
  | { status: "error" };

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  eventTypeId,
  eventTypeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTypeId: string;
  eventTypeName: string;
}) {
  const router = useRouter();
  const [countState, setCountState] = useState<CountState>({ status: "idle" });
  const [confirmInput, setConfirmInput] = useState("");
  const [isPending, startTransition] = useTransition();

  // Lazy fetch booking count when the dialog opens (RESEARCH Open Q1).
  useEffect(() => {
    if (!open) return;

    setCountState({ status: "loading" });
    setConfirmInput("");

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("event_type_id", eventTypeId)
        .neq("status", "cancelled");

      if (cancelled) return;
      if (error) {
        setCountState({ status: "error" });
      } else {
        setCountState({ status: "ready", count: count ?? 0 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, eventTypeId]);

  async function handleConfirm() {
    startTransition(async () => {
      const result = await softDeleteEventTypeAction(eventTypeId);
      if (result.formError) {
        toast.error(result.formError);
      } else {
        toast.success("Event type archived.");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  const hasBookings =
    countState.status === "ready" && countState.count > 0;
  const confirmDisabled =
    isPending ||
    countState.status === "loading" ||
    countState.status === "error" ||
    (hasBookings && confirmInput !== eventTypeName);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Archive &ldquo;{eventTypeName}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {countState.status === "loading" && "Checking for bookings…"}
            {countState.status === "error" &&
              "Couldn't load booking count. Refresh and try again."}
            {countState.status === "ready" && !hasBookings &&
              "The event type will be hidden from booking pages. You can restore it later from \"Show archived\"."}
            {countState.status === "ready" && hasBookings && (
              <>
                This event type has <strong>{countState.count}</strong>{" "}
                {countState.count === 1 ? "booking" : "bookings"}. Archiving
                preserves them. Type the event type&apos;s name to confirm.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {countState.status === "loading" && (
          <Skeleton className="h-9 w-full" />
        )}

        {countState.status === "ready" && hasBookings && (
          <div className="grid gap-2 py-2">
            <Label htmlFor="confirm-name">
              Type &ldquo;{eventTypeName}&rdquo; to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={confirmDisabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Archiving…" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**File 2 — `app/(shell)/app/event-types/_components/restore-collision-dialog.tsx`**:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { restoreEventTypeAction } from "../_lib/actions";
import { slugify } from "@/lib/slugify";

export function RestoreCollisionDialog({
  open,
  onOpenChange,
  eventTypeId,
  originalSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTypeId: string;
  originalSlug: string;
}) {
  const router = useRouter();
  const [slugInput, setSlugInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset to suggested slug whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setSlugInput(`${originalSlug}-restored`);
      setError(null);
    }
  }, [open, originalSlug]);

  function handleSlugChange(value: string) {
    setSlugInput(slugify(value));
    if (error) setError(null);
  }

  async function handleRestore() {
    setError(null);
    if (!slugInput) {
      setError("Slug cannot be empty.");
      return;
    }

    startTransition(async () => {
      const result = await restoreEventTypeAction(eventTypeId, slugInput);
      if ("ok" in result) {
        toast.success("Restored as inactive.");
        onOpenChange(false);
        router.refresh();
      } else if ("slugCollision" in result) {
        // Shouldn't happen since we passed a slug, but defensively handle it.
        setError("That slug is also in use. Try another.");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Slug already in use</DialogTitle>
          <DialogDescription>
            The slug <span className="font-mono">{originalSlug}</span> is taken
            by another active event type. Pick a new URL slug to restore this one.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="restore-slug">URL slug</Label>
          <Input
            id="restore-slug"
            value={slugInput}
            onChange={(e) => handleSlugChange(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleRestore} disabled={isPending || !slugInput}>
            {isPending ? "Restoring…" : "Restore with new slug"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Key rules:
- DeleteConfirmDialog: lazy booking count via `useEffect(() => ..., [open, ...])`. The cancellation flag (`let cancelled = false`) prevents a stale fetch from setting state if the dialog is closed before the query resolves.
- The booking count query uses `{ count: "exact", head: true }` (server returns count without rows) and filters `.neq("status", "cancelled")` per RESEARCH §"Delete Confirmation Pattern".
- The "type the name to confirm" Input is autoComplete="off" so password managers don't suggest stale values.
- AlertDialogAction uses `e.preventDefault()` + manual handler call so the dialog doesn't auto-close before the action resolves — we want to stay open with the spinner running.
- AlertDialogAction is styled with destructive colors (`bg-destructive ...`) for visual weight. shadcn AlertDialogAction defaults to primary; the destructive override is appropriate here.
- The destructive-styled className is required because shadcn's AlertDialogAction doesn't accept a `variant` prop directly — pass the destructive utility classes via className.
- RestoreCollisionDialog: uses standalone `Dialog` (NOT nested inside AlertDialog) per RESEARCH Open Q3. The previous AlertDialog (delete-confirm) is closed before this opens because they live in separate state slots in `row-actions-menu.tsx`.
- The slug input pre-fills with `${originalSlug}-restored` (sensible suggestion) and runs the user's typed input through `slugify()` on every keystroke — this guarantees the value being sent to the action is always slug-valid (won't trip the action's inline regex check).
- If `restoreEventTypeAction` returns an error, show it inline in the dialog (NOT a toast) — the user is in a focused decision context; inline error is more discoverable.

DO NOT:
- Do not nest AlertDialog inside Dialog or Dialog inside AlertDialog (Radix nested-modal issues per RESEARCH Open Q3).
- Do not pre-fetch the booking count when the row mounts — only fetch when the dialog opens (avoids N queries for N rows on the initial list render).
- Do not show a per-row "X bookings" badge in the table — out of CONTEXT scope.
- Do not call `softDeleteEventTypeAction` from the kebab menu directly — always go through the dialog (even the no-bookings branch) to keep the UX flow uniform.
  </action>
  <verify>
```bash
ls "app/(shell)/app/event-types/_components/"{delete-confirm-dialog,restore-collision-dialog}.tsx

# Delete dialog wires the lazy count + two-tier branches
grep -q "useEffect" "app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx" && echo "lazy fetch ok"
grep -q "count: \"exact\", head: true" "app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx" && echo "count query ok"
grep -q '\.neq("status", "cancelled")' "app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx" && echo "cancelled filter ok"
grep -q "softDeleteEventTypeAction" "app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx" && echo "delete action wired"
grep -q "confirmInput !== eventTypeName" "app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx" && echo "type-to-confirm gate ok"

# Restore dialog uses standalone Dialog (not AlertDialog), wires slugify
grep -q "from \"@/components/ui/dialog\"" "app/(shell)/app/event-types/_components/restore-collision-dialog.tsx" && echo "dialog primitive ok"
! grep -q "AlertDialog" "app/(shell)/app/event-types/_components/restore-collision-dialog.tsx" && echo "no nested alertdialog ok"
grep -q "from \"@/lib/slugify\"" "app/(shell)/app/event-types/_components/restore-collision-dialog.tsx" && echo "slugify imported"
grep -q "restoreEventTypeAction" "app/(shell)/app/event-types/_components/restore-collision-dialog.tsx" && echo "restore action wired"
grep -q "originalSlug}-restored" "app/(shell)/app/event-types/_components/restore-collision-dialog.tsx" && echo "suggested slug ok"

# Build now passes (page.tsx imports from Tasks 1+2+3 are all resolved)
npm run build
npm run lint

# Existing tests still green
npm test
```
  </verify>
  <done>
DeleteConfirmDialog (`AlertDialog`) is a controlled component that lazy-fetches booking count via supabase browser client when opened, branches between simple confirm (zero bookings) and type-the-name confirm (has bookings), calls `softDeleteEventTypeAction` on confirm, and `router.refresh()`s on success.

RestoreCollisionDialog (standalone `Dialog`) opens with a slug input pre-filled with `${originalSlug}-restored`, runs every keystroke through `slugify()`, calls `restoreEventTypeAction(id, newSlug)` on confirm, and shows inline errors.

`npm run build` + `npm run lint` exit 0. Existing Vitest suite still green.

Commit: `feat(03-04): delete-confirm dialog (two-tier) and restore-collision dialog`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# All 9 files in this plan exist
ls "app/(shell)/app/event-types/"{page,loading}.tsx
ls "app/(shell)/app/event-types/_components/"{empty-state,status-badge,event-types-table,show-archived-toggle,row-actions-menu,delete-confirm-dialog,restore-collision-dialog}.tsx

# Build + lint
npm run build
npm run lint

# Existing tests still green
npm test

# Manual smoke (will only show empty state until Plan 05 lets Andrew create event types)
# npm run dev — visit /app/event-types: should render header + empty state card
# Toggle "Show archived" — URL should update to ?archived=true and show "no archived" empty state
# Click "Create event type" — should navigate to /app/event-types/new (404 until Plan 05; expected)
```
</verification>

<success_criteria>
- [ ] `app/(shell)/app/event-types/page.tsx` REPLACES the Phase 2 stub (Server Component, awaits searchParams, queries event_types with deleted_at filter, renders EmptyState or EventTypesTable)
- [ ] `app/(shell)/app/event-types/loading.tsx` renders a full skeleton table (header row + 4 skeleton rows)
- [ ] StatusBadge maps {is_active, deleted_at} → Active/Inactive/Archived with Badge variants default/secondary/outline
- [ ] EmptyState has TWO copy variants (showArchived vs primary) — primary has "Create event type" CTA
- [ ] EventTypesTable renders 5 columns (Name / Duration / Slug / Status / Actions) with conditional row styling (opacity-50+line-through for archived, opacity-60 for inactive)
- [ ] ShowArchivedToggle is a Switch wired to ?archived URL param via `router.replace`
- [ ] RowActionsMenu shows Edit / Toggle Active / Archive on active+inactive rows; Restore on archived rows
- [ ] RowActionsMenu calls `toggleActiveAction` (no confirm) and `restoreEventTypeAction` (handles {slugCollision} by opening RestoreCollisionDialog)
- [ ] DeleteConfirmDialog (AlertDialog) lazy-fetches booking count via supabase browser client with `{count:'exact', head:true}` and `.neq('status','cancelled')`; branches between simple confirm and type-the-name; calls `softDeleteEventTypeAction` on confirm
- [ ] RestoreCollisionDialog (standalone Dialog — NOT AlertDialog) opens with slug input pre-filled `${originalSlug}-restored`, runs input through `slugify()`, calls `restoreEventTypeAction(id, newSlug)`
- [ ] All success paths fire Sonner `toast.success`; all error paths fire `toast.error` (or inline error for the restore dialog)
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Existing Vitest suite still green
- [ ] Each task committed atomically (3 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/03-event-types-crud/03-04-SUMMARY.md` documenting:
- The 9 component files shipped + their roles (table, kebab, dialogs, toggle, empty, badge, loading, page)
- Confirmed RESEARCH Open Q1 implementation: lazy booking count via `useEffect` in DeleteConfirmDialog with cancellation flag (NOT pre-fetched in list query)
- Confirmed RESEARCH Open Q3 implementation: standalone Dialog (not nested AlertDialog) for the restore-collision flow
- Confirmed Phase-3 unlinked-user behavior: list page uses RLS-scoped client; unlinked user gets zero rows → empty state. No additional `current_owner_account_ids` redirect added (matches Phase 2 STATE decision)
- Note on `router.refresh()` usage: required after non-redirecting actions (toggle, soft-delete, restore) to re-fetch the Server Component
- Any deviation from RESEARCH §"Table Row with Kebab" or §"Delete Confirmation Pattern" (none expected)
</output>
</content>
</invoke>