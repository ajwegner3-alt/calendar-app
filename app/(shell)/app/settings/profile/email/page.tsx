import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmailChangeForm } from "./email-change-form";

/**
 * /app/settings/profile/email
 *
 * Displays the user's current email and the email-change request form.
 * Supabase will send a confirmation link to the NEW email on submission.
 * The change is not applied until the user clicks that link.
 *
 * After the user confirms, /auth/confirm (type=email_change) verifyOtp
 * updates auth.users.email. The sync_account_email_on_auth_update trigger
 * (Plan 10-08 migration) then propagates the change to accounts.owner_email.
 */
export default async function EmailChangePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("owner_email")
    .is("deleted_at", null)
    .maybeSingle();

  if (!account) redirect("/app/unlinked");

  // Prefer the JWT claim's email (most up-to-date after a recent change).
  const currentEmail =
    (claimsData.claims.email as string | undefined) ?? account.owner_email ?? "";

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <Link
          href="/app/settings/profile"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Profile Settings
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Change Email Address</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your current email is{" "}
          <span className="font-medium text-foreground">{currentEmail}</span>.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-base font-medium">New Email Address</h2>
        <p className="text-xs text-muted-foreground">
          Enter the email address you&apos;d like to use going forward. We&apos;ll send you a
          confirmation link — your email won&apos;t change until you click it.
        </p>
        <EmailChangeForm />
      </section>
    </div>
  );
}
