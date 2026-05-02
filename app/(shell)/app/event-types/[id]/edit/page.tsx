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
      "id, account_id, slug, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_advance_days, custom_questions, is_active, created_at, deleted_at, location, max_bookings_per_slot, show_remaining_capacity",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  // RLS handles ownership. If row is missing OR archived, 404.
  if (error || !data) {
    notFound();
  }

  const eventType = data as EventTypeRow;

  // Resolve owner's account slug so BookingLinkField can render the real public URL.
  // Canonical RPC pattern from event-types/page.tsx (Phase 7 lock).
  const { data: accountIds } = await supabase.rpc("current_owner_account_ids");
  const ids = Array.isArray(accountIds) ? accountIds : [];
  let accountSlug = "nsi"; // safe fallback; replaced below if DB resolves
  if (ids.length > 0) {
    const { data: account } = await supabase
      .from("accounts")
      .select("slug")
      .eq("id", ids[0])
      .maybeSingle();
    if (account?.slug) accountSlug = account.slug;
  }

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
        accountSlug={accountSlug}
        defaultValues={{
          name: eventType.name,
          slug: eventType.slug,
          duration_minutes: eventType.duration_minutes,
          description: eventType.description ?? "",
          is_active: eventType.is_active,
          custom_questions: eventType.custom_questions ?? [],
          location: eventType.location ?? "",
          // Phase 11 Plan 11-07: capacity defaults from DB (fallback to safe v1.0 values).
          max_bookings_per_slot: eventType.max_bookings_per_slot ?? 1,
          show_remaining_capacity: eventType.show_remaining_capacity ?? false,
          confirmCapacityDecrease: false,
        }}
      />
    </div>
  );
}
