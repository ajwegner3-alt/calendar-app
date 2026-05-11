"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmbedTabs } from "./embed-tabs";

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUrl: string;
  accountSlug: string;
  eventSlug: string;
  eventName: string;
  isWidgetAllowed: boolean; // Phase 42.6 — gate flag from server
}

export function EmbedCodeDialog({
  open,
  onOpenChange,
  appUrl,
  accountSlug,
  eventSlug,
  eventName,
  isWidgetAllowed,
}: EmbedCodeDialogProps) {
  const previewSrc = `${appUrl.replace(/\/$/, "")}/embed/${accountSlug}/${eventSlug}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isWidgetAllowed ? `Embed: ${eventName}` : "Widget feature"}
          </DialogTitle>
          <DialogDescription>
            {isWidgetAllowed
              ? "Paste one of these snippets into your website. The script version is recommended for auto-resizing; iframe is the fallback if your site blocks script tags."
              : "Upgrade to embed the booking widget on your website."}
          </DialogDescription>
        </DialogHeader>

        {isWidgetAllowed ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <EmbedTabs
                appUrl={appUrl}
                accountSlug={accountSlug}
                eventSlug={eventSlug}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Live preview:</p>
              <iframe
                src={previewSrc}
                title="Embed preview"
                width="100%"
                height="500"
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  display: "block",
                }}
              />
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Widget requires an upgrade</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Embed the booking widget on any website</li>
                <li>Auto-resizing via script or iframe fallback</li>
                <li>Brand colors applied inside the iframe</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/app/billing">Upgrade to Widget</Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
