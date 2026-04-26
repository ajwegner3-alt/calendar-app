"use client";

import Link from "next/link";

interface PreviewIframeProps {
  accountSlug: string;
  firstActiveEventSlug: string | null;
  previewColor: string;
  previewLogo: string | null;
}

/**
 * Live preview iframe for the branding editor.
 *
 * Points to /embed/<accountSlug>/<eventSlug>?previewColor=...&previewLogo=...
 * Key is set to the full URL so React unmounts/remounts the iframe on every
 * prop change — forces a fresh load with the new query params.
 *
 * RESEARCH §Pattern 7 option (b): iframe src with query params.
 * Simpler than postMessage from editor → embed; works without Plan 07-03
 * needing extra postMessage receivers.
 *
 * Empty state: when firstActiveEventSlug is null, shows a friendly placeholder
 * with a link to create an event type.
 */
export function PreviewIframe({
  accountSlug,
  firstActiveEventSlug,
  previewColor,
  previewLogo,
}: PreviewIframeProps) {
  if (!firstActiveEventSlug) {
    return (
      <div className="flex h-[600px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 text-center px-6">
        <p className="text-sm font-medium text-foreground">No active event types yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first event type to see a live preview here.
        </p>
        <Link
          href="/app/event-types/new"
          className="mt-4 text-sm font-medium text-primary underline underline-offset-4 hover:opacity-80"
        >
          Create event type
        </Link>
      </div>
    );
  }

  const params = new URLSearchParams();
  params.set("previewColor", previewColor);
  if (previewLogo) {
    params.set("previewLogo", previewLogo);
  }

  const iframeSrc = `/embed/${accountSlug}/${firstActiveEventSlug}?${params.toString()}`;

  return (
    <iframe
      key={iframeSrc}
      src={iframeSrc}
      title="Booking page live preview"
      className="w-full rounded-lg border border-border"
      style={{ height: "600px" }}
      // sandbox allows same-origin scripts (needed for the embed page to work)
      // allow-same-origin is required for Supabase auth cookie access in embed
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  );
}
