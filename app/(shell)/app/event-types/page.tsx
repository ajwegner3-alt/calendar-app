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
