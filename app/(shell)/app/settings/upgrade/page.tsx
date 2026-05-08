import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpgradeForm } from "./_components/upgrade-form";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function formatTimeRemaining(lastRequestAt: string): string {
  const elapsed = Date.now() - new Date(lastRequestAt).getTime();
  const remaining = Math.max(0, TWENTY_FOUR_HOURS_MS - elapsed);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function isWithin24h(lastRequestAt: string | null): boolean {
  if (!lastRequestAt) return false;
  return Date.now() - new Date(lastRequestAt).getTime() < TWENTY_FOUR_HOURS_MS;
}

export default async function UpgradeSettingsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, last_upgrade_request_at")
    .is("deleted_at", null)
    .maybeSingle();

  if (!account) redirect("/app/unlinked");

  const lockedOut = isWithin24h(account.last_upgrade_request_at);
  const timeRemaining =
    lockedOut && account.last_upgrade_request_at
      ? formatTimeRemaining(account.last_upgrade_request_at)
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Request an upgrade</h1>
        <p className="text-sm text-muted-foreground">
          Your account currently routes booking emails through Gmail, which has
          a 200-email/day limit. When you hit the cap, unsent confirmations
          appear in your dashboard.
        </p>
        <p className="text-sm text-muted-foreground">
          Upgrading routes your sends through NSI&apos;s shared email service,
          which handles higher volume. Submit a request and Andrew will be in
          touch within 1 business day.
        </p>
      </header>

      <UpgradeForm lockedOut={lockedOut} timeRemaining={timeRemaining} />
    </div>
  );
}
