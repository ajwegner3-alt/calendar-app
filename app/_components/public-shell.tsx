// app/_components/public-shell.tsx
// Phase 17 (PUB-01, PUB-02, PUB-03): Public-surface shell. Replaces BrandedPage.
//
// Composition:
//   - bg-gray-50 base (NSI surface color)
//   - <BackgroundGlow color={brand_primary or NSI-blue fallback} />
//   - <Header variant="public" branding={branding} accountName={accountName} />
//   - CSS-var wrapper exposing BOTH --brand-primary (for BookingForm inline styles)
//     AND --primary (for slot picker bg-primary class). See RESEARCH.md Pitfall 1.
//   - <PoweredByNsi /> footer (PUB-04 attribution; renders on every public surface).
//
// Glow fallback: when brand_primary is near-white (luminance > 0.85), substitute
// NSI blue so the glow is always visible. Uses relativeLuminance() from contrast.ts.
//
// MP-04 lock: All runtime hex flows through inline style attribute, not Tailwind classes.

import type { CSSProperties, ReactNode } from "react";
import type { Branding } from "@/lib/branding/types";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { Header } from "@/app/_components/header";
import { PoweredByNsi } from "@/app/_components/powered-by-nsi";
import { relativeLuminance } from "@/lib/branding/contrast";

interface PublicShellProps {
  branding: Branding;
  /** Account display name for the Header pill right slot. */
  accountName: string;
  children: ReactNode;
}

/** Glow fallback: if brand_primary is too light to be visible on bg-gray-50, fall
 *  back to NSI blue. Threshold 0.85 ≈ #D0D0D0 — anything lighter substitutes. */
function resolveGlowColor(primaryColor: string): string {
  try {
    return relativeLuminance(primaryColor) > 0.85 ? "#3B82F6" : primaryColor;
  } catch {
    return "#3B82F6";
  }
}

export function PublicShell({ branding, accountName, children }: PublicShellProps) {
  const glowColor = resolveGlowColor(branding.primaryColor);
  // branding.textColor is pre-computed (#ffffff or #000000) by brandingFromRow().
  const foreground = branding.textColor;

  // Dual CSS vars: --brand-primary for existing BookingForm inline styles,
  // --primary for SlotPicker's `bg-primary` Tailwind class. Both must be set
  // because the codebase has both patterns in active use (RESEARCH.md Pitfall 1).
  const cssVars: CSSProperties = {
    ["--brand-primary" as never]: branding.primaryColor,
    ["--brand-text" as never]: foreground,
    ["--primary" as never]: branding.primaryColor,
    ["--primary-foreground" as never]: foreground,
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      <BackgroundGlow color={glowColor} />
      <Header variant="public" branding={branding} accountName={accountName} />
      <div style={cssVars}>
        <main className="pt-20 md:pt-24 pb-12">
          {children}
        </main>
      </div>
      <PoweredByNsi />
    </div>
  );
}
