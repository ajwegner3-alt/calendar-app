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

/** Inner component that reads search params (must be inside Suspense per Next.js 16 pattern). */
function GmailStatusPanelInner({ status, gmailAddress, connectedAt }: GmailStatusPanelProps) {
  const params = useSearchParams();
  const hasConnectError = params.get("connect_error") === "1";

  const connectedDate = connectedAt
    ? new Date(connectedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      {hasConnectError && (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t start the Gmail connection. Please try again.
          </AlertDescription>
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
