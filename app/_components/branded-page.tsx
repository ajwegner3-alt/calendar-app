import type { CSSProperties, ReactNode } from "react";
import { pickTextColor } from "@/lib/branding/contrast";

interface BrandedPageProps {
  logoUrl: string | null;
  primaryColor: string | null;
  accountName: string;
  children: ReactNode;
  /** Optional: render logo at this max width (default 120px). */
  logoMaxWidth?: number;
}

/**
 * Wraps page content with --brand-primary + --brand-text CSS vars and renders
 * an optional top-centered logo header.
 *
 * Used by:
 *   - /[account]/[event-slug]                  (booking page)
 *   - /[account]/[event-slug]/confirmed/[id]   (confirmation page)
 *   - /cancel/[token]                           (cancel page)
 *   - /reschedule/[token]                       (reschedule page)
 *
 * Fallback strategy:
 *   - logoUrl null → no header rendered
 *   - primaryColor null → falls back to NSI navy (#0A2540)
 *   - text color auto-picked via WCAG luminance for readable contrast
 *
 * CSS var naming matches Plan 07-03 EmbedShell exactly:
 *   --brand-primary / --brand-text
 * Single convention across all surfaces (embed + hosted pages).
 *
 * Components inside `children` consume the CSS vars via inline style:
 *   <button style={{ background: "var(--brand-primary)", color: "var(--brand-text)" }}>
 */
export function BrandedPage({
  logoUrl,
  primaryColor,
  accountName,
  children,
  logoMaxWidth = 120,
}: BrandedPageProps) {
  const effective = primaryColor ?? "#0A2540";
  const textColor = pickTextColor(effective);

  const style: CSSProperties = {
    ["--brand-primary" as never]: effective,
    ["--brand-text" as never]: textColor,
  };

  return (
    <div style={style}>
      {logoUrl && (
        <header className="pt-8 pb-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={`${accountName} logo`}
            style={{
              maxWidth: logoMaxWidth,
              maxHeight: 60,
              height: "auto",
              width: "auto",
            }}
          />
        </header>
      )}
      {children}
    </div>
  );
}
