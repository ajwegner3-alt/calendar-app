import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventTypeForm } from "../../_components/event-type-form";
import type { EventTypeRow } from "../../_lib/types";

// Next.js 16: params is a Promise — must be awaited (Phase 1 RESEARCH; Phase 3 RESEARCH Pitfall 4).
export default async function EditEventTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_types")
    .select(
      "id, account_id, slug, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_advance_days, custom_questions, is_active, created_at, deleted_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  // RLS handles ownership. If row is missing OR archived, 404.
  if (error || !data) {
    notFound();
  }

  const eventType = data as EventTypeRow;

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Edit event type</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update name, slug, duration, or custom questions.
        </p>
      </header>
      <EventTypeForm
        mode="edit"
        eventTypeId={eventType.id}
        defaultValues={{
          name: eventType.name,
          slug: eventType.slug,
          duration_minutes: eventType.duration_minutes,
          description: eventType.description ?? "",
          is_active: eventType.is_active,
          custom_questions: eventType.custom_questions ?? [],
        }}
      />
    </div>
  );
}
