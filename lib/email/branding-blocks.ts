import "server-only";
import { pickTextColor } from "@/lib/branding/contrast";

export const DEFAULT_BRAND_PRIMARY = "#0A2540"; // NSI navy

/** Branding subset most senders need; lets callers pass either the full account or a slim subset. */
export interface EmailBranding {
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
  /** Per-account background color (accounts.background_color — page background).
   *  No longer used for email header band color resolution as of Phase 12.6.
   *  Kept in the interface for backward compat; ignored by renderEmailBrandedHeader. */
  backgroundColor: string | null;
  /** Phase 12.6: per-account sidebar color (accounts.sidebar_color).
   *  Priority source for email header band: sidebarColor → brand_primary → DEFAULT.
   *  Optional: callers that haven't been updated yet fall through to brand_primary. */
  sidebarColor?: string | null;
  /** Phase 12.5: chrome tint intensity. DEPRECATED in Phase 12.6 — kept for backward compat only.
   *  Callers should use sidebarColor instead. Will be removed in a future cleanup pass. */
  chromeTintIntensity?: "none" | "subtle" | "full";
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
 * Color resolution (Phase 12.6 / EMAIL-14, sidebarColor-first):
 *   sidebarColor (accounts.sidebar_color) → brand_primary → DEFAULT_BRAND_PRIMARY
 * Matches dashboard sidebar visual: sidebar_color is the primary source.
 * Email clients cannot render color-mix(); both sidebarColor and brand_primary
 * are direct hex values — correct for all email clients.
 * Backward compat: callers without sidebarColor fall through to brand_primary.
 * Text color auto-picked via WCAG luminance (pickTextColor) for accessibility.
 *
 * When logo_url is set: renders an <img> centered on the band.
 * When logo_url is null: renders the account name as bold text on the band.
 *
 * Inline-styled for Gmail/Outlook/Apple Mail compatibility.
 */
export function renderEmailBrandedHeader(branding: EmailBranding): string {
  // Phase 12.6 / EMAIL-14: color priority chain for email header band.
  // Matches dashboard sidebar visual: sidebar_color is the primary source.
  // Email clients cannot render color-mix(); both sidebarColor and brand_primary
  // are direct hex values — correct for all clients.
  // Backward compat: callers without sidebarColor fall through to brand_primary.
  const bg =
    branding.sidebarColor ??
    branding.brand_primary ??
    DEFAULT_BRAND_PRIMARY;
  const fg = pickTextColor(bg);

  const logoCell = branding.logo_url
    ? `<img src="${branding.logo_url}" alt="${escapeHtml(branding.name)}" width="120" style="max-width:120px;height:auto;display:block;border:0;" />`
    : `<span style="color:${fg};font-size:20px;font-weight:600;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">${escapeHtml(branding.name)}</span>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg};margin:0;border-collapse:collapse;">
  <tr><td align="center" style="padding:24px 16px;">${logoCell}</td></tr>
</table>`;
}

/**
 * Top-centered logo header for transactional emails.
 *
 * @deprecated Use renderEmailBrandedHeader() instead (Plan 12-06 migration).
 * Kept for one release cycle so test fixtures referencing the old helper
 * don't break. Will be removed in a future cleanup pass.
 *
 * Returns "" when logo_url is null (no empty space, no broken-img placeholder).
 * Inline-styled to survive Gmail/Outlook/Apple Mail (caniemail.com lock).
 */
export function renderEmailLogoHeader(branding: Pick<EmailBranding, "name" | "logo_url">): string {
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
 * "Powered by NSI" footer with optional NSI mark image.
 *
 * NSI_MARK_URL is set when NEXT_PUBLIC_APP_URL is available (production + preview).
 * Falls back to null in test environments so existing tests don't get broken-image
 * artifacts from 404'd <img> tags.
 *
 * v1 ships with a solid-color placeholder PNG at /public/nsi-mark.png.
 * Andrew should replace this asset with the final NSI brand mark before Phase 13 QA.
 */
const NSI_MARK_URL: string | null = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/nsi-mark.png`
  : null;

const NSI_HOMEPAGE_URL = "https://nsintegrations.com";

export function renderEmailFooter(): string {
  const markHtml = NSI_MARK_URL
    ? `<img src="${NSI_MARK_URL}" alt="NSI" width="16" height="16" style="display:inline-block;vertical-align:middle;margin:0 2px;border:0;" /> `
    : "";
  return `<hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px 0;"/>
  <p style="margin: 0; font-size: 12px; color: #888; text-align: center;">
    ${markHtml}<span style="vertical-align:middle;">Powered by </span><a href="${NSI_HOMEPAGE_URL}" style="color:#888;text-decoration:underline;"><strong>North Star Integrations</strong></a>
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
