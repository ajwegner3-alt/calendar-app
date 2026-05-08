"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/oauth/encrypt";
import { revokeGoogleRefreshToken } from "@/lib/oauth/google";

/** Connect: kick off Supabase linkIdentity with the combined Gmail scope. */
export async function connectGmailAction(): Promise<void> {
  const h = await headers();
  // Server-action POSTs sometimes lack the Origin header; fall back to the
  // forwarded host (Vercel sets x-forwarded-host/proto on every request) so
  // the redirectTo lands on the same deploy the user is actually on.
  const forwardedHost = h.get("x-forwarded-host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  const origin =
    h.get("origin") ??
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/google-callback`,
      scopes: "email profile https://www.googleapis.com/auth/gmail.send",
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error || !data.url) {
    console.error("[connectGmailAction] linkIdentity failed:", error?.message);
    redirect("/app/settings/gmail?connect_error=1");
  }
  redirect(data.url);
}

/** Disconnect: revoke at Google + delete local credential row. */
export async function disconnectGmailAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return { ok: false, error: "Not authenticated" };
  const userId = claimsData.claims.sub as string;

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("account_oauth_credentials")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  // Best-effort revoke at Google. Do NOT block disconnect on revocation failure
  // — credential deletion is the user-visible promise.
  if (cred?.refresh_token_encrypted) {
    try {
      const refreshToken = decryptToken(cred.refresh_token_encrypted);
      await revokeGoogleRefreshToken(refreshToken);
    } catch (err) {
      console.error("[disconnectGmailAction] decrypt/revoke (non-fatal):", err);
    }
  }

  const { error: delError } = await admin
    .from("account_oauth_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");
  if (delError) return { ok: false, error: delError.message };

  // Conditionally unlink Supabase identity: ONLY if user has 2+ identities (RESEARCH §Pitfall 6).
  // For Google-only users we leave the auth.identities row alone — it doesn't affect Phase 35
  // (which reads exclusively from account_oauth_credentials).
  const { data: identities } = await supabase.auth.getUserIdentities();
  const idents = identities?.identities ?? [];
  if (idents.length >= 2) {
    const googleIdent = idents.find((i) => i.provider === "google");
    if (googleIdent) {
      const { error: unlinkErr } = await supabase.auth.unlinkIdentity(googleIdent);
      if (unlinkErr) console.error("[disconnectGmailAction] unlinkIdentity (non-fatal):", unlinkErr.message);
    }
  }

  return { ok: true };
}
