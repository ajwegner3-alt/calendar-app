import { createClient } from "@/lib/supabase/server";
import { EventTypeForm } from "../_components/event-type-form";

export default async function NewEventTypePage() {
  const supabase = await createClient();

  // Resolve owner's account slug for BookingLinkField.
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
        <h1 className="text-2xl font-semibold">Create event type</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define what people can book. You can edit any of this later.
        </p>
      </header>
      <EventTypeForm mode="create" accountSlug={accountSlug} />
    </div>
  );
}
