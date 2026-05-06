import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GmailStatusPanel } from "./_components/gmail-status-panel";

export default async function SettingsGmailPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");
  const userId = claimsData.claims.sub as string;

  // Read credential status via SELECT (RLS policy credentials_select_own allows this).
  const { data: cred } = await supabase
    .from("account_oauth_credentials")
    .select("status, granted_scopes, connected_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  // Pull the linked Google identity's email (for "· user@gmail.com" subline).
  const { data: identities } = await supabase.auth.getUserIdentities();
  const googleIdent = identities?.identities?.find((i) => i.provider === "google");
  const gmailAddress = (googleIdent?.identity_data?.email as string | undefined) ?? null;

  let status: "connected" | "never_connected" | "needs_reconnect";
  if (!cred) status = "never_connected";
  else if (cred.status === "needs_reconnect") status = "needs_reconnect";
  else status = "connected";

  return (
    <div className="max-w-2xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Gmail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Gmail to send booking emails from your own address.
        </p>
      </header>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <GmailStatusPanel
          status={status}
          gmailAddress={gmailAddress}
          connectedAt={cred?.connected_at ?? null}
        />
      </section>
    </div>
  );
}
