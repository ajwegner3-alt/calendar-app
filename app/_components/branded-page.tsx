import type { CSSProperties, ReactNode } from "react";
import { pickTextColor } from "@/lib/branding/contrast";
import type { BackgroundShade } from "@/lib/branding/types";
import { GradientBackdrop } from "@/app/_components/gradient-backdrop";

interface BrandedPageProps {
  logoUrl: string | null;
  primaryColor: string | null;
  accountName: string;
  children: ReactNode;
  /** Optional: render logo at this max width (default 120px). */
  logoMaxWidth?: number;
  /** Phase 12: per-account background hex tint. null = gray-50 fallback. */
  backgroundColor?: string | null;
  /** Phase 12: gradient intensity (default 'subtle'). */
  backgroundShade?: BackgroundShade;
}

/**
 * Wraps page content with --brand-primary + --brand-text CSS vars and renders
 * an optional top-centered logo header.
 *
 * Phase 12 extension: also renders a GradientBackdrop and exposes
 * --brand-bg-color + --brand-bg-shade CSS vars on the root element.
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
 *   - backgroundColor null → gray-50 fallback at GradientBackdrop level
 *   - backgroundShade undefined → 'subtle'
 *   - text color auto-picked via WCAG luminance for readable contrast
 *
 * New props are OPTIONAL — existing 4 consumers pass none and get a
 * subtle gray-50 gradient backdrop added without code changes.
 *
 * CSS var naming matches Plan 07-03 EmbedShell exactly:
 *   --brand-primary / --brand-text
 * Phase 12 additions:
 *   --brand-bg-color / --brand-bg-shade
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
  backgroundColor = null,
  backgroundShade = "subtle",
}: BrandedPageProps) {
  const effective = primaryColor ?? "#0A2540";
  const textColor = pickTextColor(effective);

  const style: CSSProperties = {
    ["--brand-primary" as never]: effective,
    ["--brand-text" as never]: textColor,
    ["--brand-bg-color" as never]: backgroundColor ?? "#F8FAFC",
    ["--brand-bg-shade" as never]: backgroundShade,
  };

  return (
    <div style={style} className="relative overflow-hidden">
      {/* Phase 12: gradient blur-circle backdrop — renders BEFORE children */}
      <GradientBackdrop color={backgroundColor} shade={backgroundShade} />
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
