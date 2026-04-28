import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { SlugForm } from "./slug-form";
import { PasswordForm } from "./password-form";
import { DeleteAccountSection } from "./delete-account-section";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, slug, owner_email")
    .is("deleted_at", null)
    .maybeSingle();

  if (!account) redirect("/app/unlinked");

  const email = (claimsData.claims.email as string | undefined) ?? account.owner_email ?? "";

  return (
    <div className="max-w-2xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Profile Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account identity, login credentials, and account lifecycle.
        </p>
      </header>

      {/* Email (read-only) */}
      <section className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="text-base font-medium">Email Address</h2>
        <p className="text-sm text-muted-foreground">
          {email}
        </p>
        <p className="text-xs text-muted-foreground">
          <Link
            href="/app/settings/profile/email"
            className="text-primary underline-offset-4 hover:underline"
          >
            Change email
          </Link>
        </p>
      </section>

      {/* Display Name */}
      <section className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="text-base font-medium">Display Name</h2>
        <p className="text-xs text-muted-foreground">
          Shown on your public booking page and in confirmation emails.
        </p>
        <ProfileForm currentName={account.name} />
      </section>

      {/* Slug */}
      <section className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="text-base font-medium">Booking URL</h2>
        <p className="text-xs text-muted-foreground">
          Your public booking link uses this slug. Changing it immediately invalidates the old URL.
        </p>
        <SlugForm currentSlug={account.slug} />
      </section>

      {/* Password */}
      <section className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="text-base font-medium">Change Password</h2>
        <p className="text-xs text-muted-foreground">
          You must enter your current password to set a new one.
        </p>
        <PasswordForm />
      </section>

      {/* Danger Zone */}
      <DeleteAccountSection accountSlug={account.slug ?? ""} />
    </div>
  );
}
