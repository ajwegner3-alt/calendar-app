import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReminderTogglesForm } from "./_components/reminder-toggles-form";

export default async function ReminderSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  // RLS-scoped read — only returns the account this owner is linked to.
  // Mirrors the loadBrandingForOwner pattern (Plan 07-04): rely on RLS for
  // visibility rather than re-running the linkage RPC on every page load.
  const { data: account } = await supabase
    .from("accounts")
    .select(
      "id, name, reminder_include_custom_answers, reminder_include_location, reminder_include_lifecycle_links",
    )
    .maybeSingle();

  if (!account) redirect("/app/unlinked");

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Reminder Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what&apos;s included in the reminder email sent to bookers
          about 24 hours before their appointment. Changes save automatically.
        </p>
      </header>
      <ReminderTogglesForm
        accountId={account.id}
        initial={{
          custom_answers: account.reminder_include_custom_answers,
          location: account.reminder_include_location,
          lifecycle_links: account.reminder_include_lifecycle_links,
        }}
      />
    </div>
  );
}
