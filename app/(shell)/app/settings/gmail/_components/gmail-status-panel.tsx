"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GoogleOAuthButton } from "@/components/google-oauth-button";
import { connectGmailAction } from "../_lib/actions";
import { DisconnectGmailDialog } from "./disconnect-gmail-dialog";

interface GmailStatusPanelProps {
  status: "connected" | "never_connected" | "needs_reconnect";
  gmailAddress?: string | null;
  connectedAt?: string | null;
}

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  cancelled: "You cancelled the Google sign-in. Try again to connect.",
  missing_code: "The Google response was missing the authorization code. Try again.",
  invalid_state: "Connection request expired or was tampered with. Try again.",
  not_authenticated: "Your session expired. Sign in again, then reconnect.",
  server_misconfigured:
    "Server configuration error — Google credentials missing. Contact support.",
  token_exchange:
    "Google rejected the token exchange. Try revoking the app at myaccount.google.com/permissions, then retry.",
  no_refresh_token:
    "Google didn't issue a refresh token (likely a stale prior grant). Revoke this app at myaccount.google.com/permissions, then click Connect Gmail again.",
  scope_denied:
    "Send-on-your-behalf permission was denied. Click Connect Gmail again and approve all requested permissions.",
  db_write: "Couldn't save the credential. Try again or contact support.",
  encrypt: "Couldn't securely store the credential. Try again or contact support.",
};

/** Inner component that reads search params (must be inside Suspense per Next.js 16 pattern). */
function GmailStatusPanelInner({ status, gmailAddress, connectedAt }: GmailStatusPanelProps) {
  const params = useSearchParams();
  const connectError = params.get("connect_error");
  const justConnected = params.get("connected") === "1";
  const errorMessage = connectError
    ? (CONNECT_ERROR_MESSAGES[connectError] ??
       "Couldn't complete the Gmail connection. Please try again.")
    : null;

  const connectedDate = connectedAt
    ? new Date(connectedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {justConnected && status === "connected" && (
        <Alert>
          <AlertDescription>Gmail connected — you&apos;re all set.</AlertDescription>
        </Alert>
      )}

      {status === "connected" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900">Connected</span>
            {gmailAddress && (
              <span className="text-sm text-muted-foreground">· {gmailAddress}</span>
            )}
          </div>
          {connectedDate && (
            <p className="text-xs text-muted-foreground">Connected on {connectedDate}</p>
          )}
          <DisconnectGmailDialog />
        </div>
      )}

      {status === "never_connected" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900">Not connected</span>
          </div>
          <form action={connectGmailAction}>
            <GoogleOAuthButton type="submit" label="Connect Gmail" />
          </form>
        </div>
      )}

      {status === "needs_reconnect" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900">Reconnect needed</span>
          </div>
          <p className="text-sm text-muted-foreground">
            We lost access to your Gmail. Reconnect to keep sending emails.
          </p>
          <form action={connectGmailAction}>
            <GoogleOAuthButton type="submit" label="Reconnect Gmail" />
          </form>
        </div>
      )}
    </div>
  );
}

export function GmailStatusPanel(props: GmailStatusPanelProps) {
  return (
    <Suspense fallback={null}>
      <GmailStatusPanelInner {...props} />
    </Suspense>
  );
}
