"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Per-event copyable booking-link field rendered as the first form section in
 * EventTypeForm. Replaces the v1.0-era UrlPreview placeholder (`yoursite.com/nsi/[slug]`)
 * with the real public URL so the owner can grab a sendable link directly from
 * the dashboard.
 *
 * Host derivation matches the canonical `slug-form.tsx` pattern (Phase 7 lock):
 *   NEXT_PUBLIC_APP_URL (build-time) → window.location.origin (client-side fallback)
 *
 * Copy handler matches the proven `embed-tabs.tsx` pattern: clipboard API → execCommand
 * fallback → toast.error only on total failure. Icon flip Copy → Check for ~1.5s acts
 * as the success signal (no toast pollution per CONTEXT lock).
 */
export function BookingLinkField({
  accountSlug,
  eventSlug,
}: {
  accountSlug: string;
  eventSlug: string;
}) {
  const [copied, setCopied] = useState(false);

  const host =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const bookingUrl = `${host}/${accountSlug}/${eventSlug || "your-slug"}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Legacy fallback for non-HTTPS / older browsers
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
        toast.error("Copy failed — select the text manually");
      }
    }
  }

  return (
    <Card className="bg-muted/40 border-dashed">
      <CardContent className="py-2 px-3">
        <div className="text-xs text-muted-foreground mb-1">Booking URL</div>
        <div className="flex items-center">
          <code className="text-sm font-mono break-all flex-1 mr-2">
            {bookingUrl}
          </code>
          <button
            type="button"
            aria-label="Copy booking URL"
            onClick={handleCopy}
            className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
