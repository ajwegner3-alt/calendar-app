import "server-only";
import { pickTextColor } from "@/lib/branding/contrast";

// Phase 40 Plan 05 (2026-05-09): export keyword removed — internal-only use
// at lines 37, 98, 107 of this file. DECISIONS.md classified as whole-symbol
// REMOVE but verification surfaced 3 internal readers; reclassified to
// export-keyword-only REMOVE (same kind as the read-branding.ts copy).
const DEFAULT_BRAND_PRIMARY = "#3B82F6"; // NSI blue-500 — email-layer default. Intentionally diverges from lib/branding/read-branding.ts DEFAULT_BRAND_PRIMARY (#0A2540). DO NOT unify per Phase 19 CONTEXT lock.

/** Branding subset most senders need; lets callers pass either the full account or a slim subset. */
export interface EmailBranding {
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
}

/**
 * Solid-color header band for transactional emails.
 *
 * CONTEXT.md lock: solid-color-only. No gradients, no VML conditional comments.
 * Outlook desktop and Yahoo Mail render gradients as fallback color anyway, so
 * we lock to consistent solid behavior across all clients.
 *
 * Header treatment is IDENTICAL across all 6 templates (consistency over status
 * semantics — same band color/shape on confirm, cancel, reschedule).
 *
 * Color resolution (Phase 19 simplification):
 *   brand_primary → DEFAULT_BRAND_PRIMARY
 * Email clients cannot render color-mix(); brand_primary is a direct hex value
 * — correct for all email clients.
 * Text color auto-picked via WCAG luminance (pickTextColor) for accessibility.
 *
 * When logo_url is set: renders an <img> centered on the band.
 * When logo_url is null: renders the account name as bold text on the band.
 *
 * Inline-styled for Gmail/Outlook/Apple Mail compatibility.
 */
export function renderEmailBrandedHeader(branding: EmailBranding): string {
  // Phase 19 simplification: color resolution for email header band.
  // brand_primary is the single source; falls back to DEFAULT_BRAND_PRIMARY (NSI blue-500).
  const bg = branding.brand_primary ?? DEFAULT_BRAND_PRIMARY;
  const fg = pickTextColor(bg);

  const logoCell = branding.logo_url
    ? `<img src="${branding.logo_url}" alt="${escapeHtml(branding.name)}" width="120" style="max-width:120px;height:auto;display:block;border:0;" />`
    : `<span style="color:${fg};font-size:20px;font-weight:600;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">${escapeHtml(branding.name)}</span>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg};margin:0;border-collapse:collapse;">
  <tr><td align="center" style="padding:24px 16px;">${logoCell}</td></tr>
</table>`;
}

// Phase 40 Plan 05 (2026-05-09): renderEmailLogoHeader deleted (deprecated
// since Phase 12-06; superseded by renderEmailBrandedHeader; zero consumers).

/**
 * "Powered by North Star Integrations" text-only footer.
 *
 * Phase 19 (EMAIL-19): replaced the optional nsi-mark.png <img> with
 * plain text attribution. No broken image risk; consistent across all clients.
 * Domain corrected from nsintegrations.com to northstarintegrations.com.
 */
const NSI_HOMEPAGE_URL = "https://northstarintegrations.com";

export function renderEmailFooter(): string {
  return `<hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px 0;"/>
<p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
  Powered by <a href="${NSI_HOMEPAGE_URL}" style="color:#9ca3af;text-decoration:underline;" target="_blank">North Star Integrations</a>
</p>`;
}

/**
 * Branded inline-styled CTA button.
 *
 * The button uses an <a> styled as a button (Outlook does not render <button> in HTML emails).
 * Background = primary color; text color auto-picked via WCAG luminance.
 */
export function renderBrandedButton(opts: {
  href: string;
  label: string;
  primaryColor: string | null;
}): string {
  const bg = opts.primaryColor ?? DEFAULT_BRAND_PRIMARY;
  const fg = pickTextColor(bg);
  return `<a href="${opts.href}" style="display:inline-block;background-color:${bg};color:${fg};padding:12px 24px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;">${escapeHtml(opts.label)}</a>`;
}

/**
 * Returns inline-style for H1/H2 to use brand color (CONTEXT decision: headings AND CTAs both get brand color).
 */
export function brandedHeadingStyle(primaryColor: string | null): string {
  const color = primaryColor ?? DEFAULT_BRAND_PRIMARY;
  return `color:${color};font-size:22px;font-weight:600;margin:0 0 16px 0;`;
}

/**
 * Crude HTML → plain-text strip for multipart text alternatives.
 *
 * Shared by all booker-facing senders. Phase 8 reminder sender pioneered this pattern.
 * Plan 12-06 extends plain-text alt to all booker-facing senders (confirm, cancel, reschedule).
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(?!\n)/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Standard escape — duplicated from senders so this module is self-contained. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
