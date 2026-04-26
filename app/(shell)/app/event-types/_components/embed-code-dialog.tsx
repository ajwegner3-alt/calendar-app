"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmbedTabs } from "./embed-tabs";

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUrl: string;
  accountSlug: string;
  eventSlug: string;
  eventName: string;
}

export function EmbedCodeDialog({
  open,
  onOpenChange,
  appUrl,
  accountSlug,
  eventSlug,
  eventName,
}: EmbedCodeDialogProps) {
  const previewSrc = `${appUrl.replace(/\/$/, "")}/embed/${accountSlug}/${eventSlug}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Embed: {eventName}</DialogTitle>
          <DialogDescription>
            Paste one of these snippets into your website. The script version is
            recommended for auto-resizing; iframe is the fallback if your site
            blocks script tags.
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
