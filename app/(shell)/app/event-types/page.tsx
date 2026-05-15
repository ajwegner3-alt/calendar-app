import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireWidgetTier } from "@/lib/stripe/widget-gate";
import { BILLING_ENABLED } from "@/lib/stripe/billing-flag";
import type { EventTypeListItem } from "./_lib/types";
import { EventTypesTable } from "./_components/event-types-table";
import { EmptyState } from "./_components/empty-state";
import { ShowArchivedToggle } from "./_components/show-archived-toggle";

// Fallback matches Plan 07-05 lock: production Vercel URL as last resort.
const DEFAULT_APP_URL = "https://calendar-app-xi-smoky.vercel.app";

// Next.js 16: searchParams is a Promise — must be awaited (RESEARCH Pitfall 4).
export default async function EventTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "true";

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || DEFAULT_APP_URL;

  const supabase = await createClient();

  // Resolve owner's account slug for embed snippets.
  // Uses same RPC pattern as loadBrandingForOwner (Phase 7 lock).
  const { data: accountIds } = await supabase.rpc("current_owner_account_ids");
  const ids = Array.isArray(accountIds) ? accountIds : [];
  let accountSlug = "nsi"; // safe fallback; replaced below if DB resolves
  // Phase 42.6: gate the "Get embed code" dialog on plan_tier. Page itself and
  // menu item remain accessible — only the dialog body is gated. If account is
  // null (defensive), default to FALSE (no widget access) so we never leak the
  // embed snippets to an unresolved account state.
  // v1.9 free-offering scope change: when BILLING_ENABLED is false the embed
  // code is available to every account — the tier gate is skipped.
  let isWidgetAllowed = !BILLING_ENABLED;
  if (ids.length > 0) {
    const { data: account } = await supabase
      .from("accounts")
      .select("slug, plan_tier, subscription_status")
      .eq("id", ids[0])
      .maybeSingle();
    if (account?.slug) accountSlug = account.slug;
    if (BILLING_ENABLED) {
      isWidgetAllowed = account
        ? requireWidgetTier({
            plan_tier: (account.plan_tier ?? null) as "basic" | "widget" | null,
            subscription_status: account.subscription_status ?? null,
          }).allowed
        : false;
    }
  }

  // Soft-delete filter — RESEARCH §"Soft-Delete Query Filter":
  //   .is("deleted_at", null) for IS NULL
  //   .not("deleted_at", "is", null) for IS NOT NULL
  // (NOT .eq which generates `= null` and is always false in SQL.)
  let query = supabase
    .from("event_types")
    .select(
      // Phase 28 LD-01: include buffer_after_minutes for the list-table column.
      "id, name, slug, duration_minutes, buffer_after_minutes, is_active, deleted_at, created_at",
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
        <EventTypesTable
          eventTypes={eventTypes}
          showArchived={showArchived}
          accountSlug={accountSlug}
          appUrl={appUrl}
          isWidgetAllowed={isWidgetAllowed}
        />
      )}
    </div>
  );
}
