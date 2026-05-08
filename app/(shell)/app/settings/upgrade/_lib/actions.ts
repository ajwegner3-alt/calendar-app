"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient } from "@/lib/email-sender/providers/resend";
import type { EmailClient } from "@/lib/email-sender/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RequestUpgradeArgs = {
  message: string; // may be empty string; "(no message provided)" is rendered server-side
};

export type RequestUpgradeResult =
  | { ok: true }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Constants (module-level — not secrets; hardcoding is the locked CONTEXT decision)
// ---------------------------------------------------------------------------

const RECIPIENT_EMAIL = "ajwegner3@gmail.com"; // CONTEXT: Andrew's personal Gmail, NOT env-var-gated
const FROM_NAME = "NSI Booking";
const FROM_ADDRESS = "bookings@nsintegrations.com"; // matches lib/email-sender/account-sender.ts:148
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Structural types for injected deps (narrow surface so tests don't need full SupabaseClient)
// ---------------------------------------------------------------------------

type RlsClientShape = Awaited<ReturnType<typeof createClient>>;
type AdminClientShape = ReturnType<typeof createAdminClient>;

export type RequestUpgradeDeps = {
  rlsClient: RlsClientShape; // for auth + ownership-scoped account read
  adminClient: AdminClientShape; // for the post-send UPDATE on accounts
  resendClient: EmailClient; // injected so tests don't hit real Resend
};

// ---------------------------------------------------------------------------
// Core function — exported for direct Vitest invocation
// ---------------------------------------------------------------------------

/**
 * Inner logic for the upgrade-request server action.
 *
 * Accepts injected clients (rlsClient, adminClient, resendClient) so Vitest
 * can call this directly with structural mocks — without needing Next.js
 * request scope (cookies(), next/cache).
 *
 * Order is load-bearing for failure semantics:
 *   1. Auth check (RLS client)
 *   2. Account read (RLS client — RLS scopes to requester's own account)
 *   3. 24h rate-limit check
 *   4. Build email body
 *   5. Send via Resend (LD-05 direct send — no quota guard)
 *   6. Write last_upgrade_request_at (AFTER send success — Pitfall 4)
 */
export async function requestUpgradeCore(
  args: RequestUpgradeArgs,
  deps: RequestUpgradeDeps,
): Promise<RequestUpgradeResult> {
  // Step 1: Auth check via RLS client (RESEARCH Pitfall 2 — never skip auth)
  const { data: claimsData } = await deps.rlsClient.auth.getClaims();
  if (!claimsData?.claims) return { ok: false, error: "Not signed in." };
  const ownerEmail =
    (claimsData.claims.email as string | undefined) ?? null;

  // Step 2: Read the requester's account via RLS client (ownership scoped by RLS)
  // IMPORTANT: column is `name`, NOT `business_name` (RESEARCH Pitfall 1)
  const { data: account } = await deps.rlsClient
    .from("accounts")
    .select("id, name, owner_email, last_upgrade_request_at")
    .is("deleted_at", null)
    .maybeSingle();
  if (!account) return { ok: false, error: "Account not found." };

  // Step 3: 24-hour rate-limit check (server-enforced; UI gating in Plan 03 is defense-in-depth)
  if (account.last_upgrade_request_at) {
    const elapsed =
      Date.now() - new Date(account.last_upgrade_request_at).getTime();
    if (elapsed < TWENTY_FOUR_HOURS_MS) {
      const remainingMs = TWENTY_FOUR_HOURS_MS - elapsed;
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      return {
        ok: false,
        error: `Already requested in the last 24 hours. Try again in ${hours}h ${minutes}m.`,
      };
    }
  }

  // Step 4: Build email body (simple inline HTML, matching sendWelcomeEmail style)
  const trimmedMessage = args.message?.trim() ?? "";
  const messageDisplay = trimmedMessage.length > 0
    ? trimmedMessage
    : "(no message provided)";
  const replyToEmail = ownerEmail ?? account.owner_email;
  const subject = `Upgrade request — ${account.name}`;
  const html = `
    <p><strong>Upgrade request from ${escapeHtml(account.name)}</strong></p>
    <p><strong>Owner email:</strong> ${escapeHtml(replyToEmail ?? "(unknown)")}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(messageDisplay).replace(/\n/g, "<br>")}</p>
    <p>Reply directly to this email to respond to the owner.</p>
  `.trim();

  // Step 5: Send via the injected Resend client (LD-05 bootstrap — direct send, NO quota guard)
  // CRITICAL: deps.resendClient is built by the wrapper using createResendClient() directly.
  // It is NEVER built via getSenderForAccount(accountId) — that path runs through
  // checkAndConsumeQuota() and would refuse-send when the requester is at cap,
  // which is exactly the moment this feature must work.
  const sendResult = await deps.resendClient.send({
    to: RECIPIENT_EMAIL,
    subject,
    html,
    replyTo: replyToEmail ?? undefined,
  });
  if (!sendResult.success) {
    return {
      ok: false,
      error: "Could not send the upgrade request right now. Please try again in a moment.",
    };
  }

  // Step 6: Persist the timestamp via the admin client (write AFTER send success — RESEARCH Pitfall 4)
  const { error: updateError } = await deps.adminClient
    .from("accounts")
    .update({ last_upgrade_request_at: new Date().toISOString() })
    .eq("id", account.id);
  if (updateError) {
    // Email already sent. Log and surface a soft failure — Andrew has the email,
    // and the worst case is the user can submit again immediately. Do NOT return
    // ok: true with a silent timestamp failure that would let them spam Andrew.
    console.error("[requestUpgradeAction] timestamp update failed", updateError);
    return {
      ok: false,
      error: "Request sent, but we could not record the timestamp. Please contact Andrew if you don't hear back.",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Wrapper — Server Action; constructs real clients, calls revalidatePath, returns result
// ---------------------------------------------------------------------------

/**
 * Public Server Action — what the client component imports.
 *
 * Constructs real RLS + admin + Resend clients then delegates to
 * requestUpgradeCore. Wraps success path with revalidatePath (dynamically
 * imported so tests calling requestUpgradeCore never touch next/cache).
 *
 * Send path: createResendClient() directly — bypasses getSenderForAccount()
 * and its quota guard. This is the LD-05 bootstrap that makes UPGRADE-03 work
 * at the cap-hit moment.
 */
export async function requestUpgradeAction(
  args: RequestUpgradeArgs,
): Promise<RequestUpgradeResult> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const resendClient = createResendClient({
    fromName: FROM_NAME,
    fromAddress: FROM_ADDRESS,
    replyToAddress: FROM_ADDRESS, // overridden per-send via options.replyTo with the owner's email
  });
  const result = await requestUpgradeCore(args, {
    rlsClient: supabase,
    adminClient: admin,
    resendClient,
  });
  if (result.ok) {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/app/settings/upgrade");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/**
 * Minimal HTML escaping for inline email body content.
 * Replaces &, <, >, ", ' to prevent XSS in the email HTML.
 * Not a security boundary (email to Andrew), but good hygiene.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
