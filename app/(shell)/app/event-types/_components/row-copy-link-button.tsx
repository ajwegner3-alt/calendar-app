"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RowCopyLinkButton({
  accountSlug,
  eventSlug,
  eventName,
  appUrl,
}: {
  accountSlug: string;
  eventSlug: string;
  eventName: string;
  appUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const bookingUrl = `${appUrl.replace(/\/$/, "")}/${accountSlug}/${eventSlug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = bookingUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        toast.error("Copy failed — open the event type to grab the link.");
      }
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      onClick={handleCopy}
      aria-label={`Copy booking link for ${eventName}`}
      title={copied ? "Copied!" : "Copy booking link"}
    >
      {copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}
