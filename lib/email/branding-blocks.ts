import "server-only";
import { pickTextColor } from "@/lib/branding/contrast";

export const DEFAULT_BRAND_PRIMARY = "#0A2540"; // NSI navy

/** Branding subset most senders need; lets callers pass either the full account or a slim subset. */
export interface EmailBranding {
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
}

/**
 * Top-centered logo header for transactional emails.
 * Returns "" when logo_url is null (no empty space, no broken-img placeholder).
 *
 * Inline-styled to survive Gmail/Outlook/Apple Mail (caniemail.com lock).
 */
export function renderEmailLogoHeader(branding: EmailBranding): string {
  if (!branding.logo_url) return "";
  // Use escapeHtml on alt text only — URL is from our DB and already URL-shaped
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
    <tr>
      <td align="center" style="padding: 16px 0;">
        <img src="${branding.logo_url}" alt="${escapeHtml(branding.name)} logo" width="120" style="max-width:120px;height:auto;display:block;border:0;" />
      </td>
    </tr>
  </table>`;
}

/**
 * "Powered by NSI" footer.
 * CONTEXT lock: not white-label in v1; always present as a text link.
 *
 * v1 SHIPS TEXT-ONLY. The image mark is rendered ONLY when NSI_MARK_URL is set
 * (non-null). Default is null because /public/nsi-mark.png does not exist yet
 * and a 404'd <img> in transactional email is a guaranteed broken-image
 * artifact in every email client. Text-only is the safe v1 surface.
 *
 * TODO(future): when nsi-mark.png is added to /public/, set
 *   NSI_MARK_URL = `${appUrl}/nsi-mark.png`
 * to render the inline mark. Remove the null guard once the asset is committed.
 */
const NSI_MARK_URL: string | null = null;
const NSI_HOMEPAGE_URL = "https://nsintegrations.com";

export function renderEmailFooter(): string {
  const markHtml = NSI_MARK_URL
    ? `<img src="${NSI_MARK_URL}" alt="NSI" width="14" height="14" style="display:inline-block;vertical-align:middle;margin:0 2px;border:0;" /> `
    : "";
  return `<hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px 0;"/>
    <p style="margin: 0; font-size: 12px; color: #888; text-align: center;">
      Powered by ${markHtml}<a href="${NSI_HOMEPAGE_URL}" style="color:#888;text-decoration:underline;"><strong>North Star Integrations</strong></a>
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

/** Standard escape — duplicated from senders so this module is self-contained. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
