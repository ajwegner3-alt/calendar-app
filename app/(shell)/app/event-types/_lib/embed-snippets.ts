export interface SnippetOpts {
  appUrl: string; // e.g., "https://calendar-app-xi-smoky.vercel.app"
  accountSlug: string; // e.g., "nsi"
  eventSlug: string; // e.g., "consultation"
}

/**
 * Recommended snippet — mount-point div THEN script tag.
 * Div must be in the DOM before widget.js init() runs at DOMContentLoaded.
 * Multiline string mirrors what the owner pastes into Squarespace/WordPress HTML block.
 */
export function buildScriptSnippet({
  appUrl,
  accountSlug,
  eventSlug,
}: SnippetOpts): string {
  const base = appUrl.replace(/\/$/, "");
  return `<div data-nsi-calendar="${accountSlug}/${eventSlug}"></div>
<script src="${base}/widget.js" defer></script>`;
}

/**
 * Fallback snippet — raw iframe, no JS.
 * Use when the host site blocks <script> tags (rare).
 * Height 600 is a sensible default; owner can adjust.
 */
export function buildIframeSnippet({
  appUrl,
  accountSlug,
  eventSlug,
}: SnippetOpts): string {
  const base = appUrl.replace(/\/$/, "");
  return `<iframe
  src="${base}/embed/${accountSlug}/${eventSlug}"
  width="100%"
  height="600"
  frameborder="0"
  style="border:0;display:block;"
  title="Booking widget"
></iframe>`;
}
