"use client";

import type { CSSProperties } from "react";
import { BookingShell } from "@/app/[account]/[event-slug]/_components/booking-shell";
import type {
  AccountSummary,
  EventTypeSummary,
} from "@/app/[account]/[event-slug]/_lib/types";
import { EmbedHeightReporter } from "./embed-height-reporter";
import { pickTextColor } from "@/lib/branding/contrast";
import { PoweredByNsi } from "@/app/_components/powered-by-nsi";

interface EmbedShellProps {
  account: AccountSummary;
  eventType: EventTypeSummary;
  /** Optional override from ?previewColor=#RRGGBB — branding editor live preview */
  previewColor?: string;
  /** Optional override from ?previewLogo=encodedUrl — branding editor live preview */
  previewLogo?: string;
}

/**
 * Embed shell: chromeless (no nav, no header pill), single-circle gradient.
 *
 * Phase 17 restyle (EMBED-08..11): bg-gray-50 background, --primary override so
 * SlotPicker's bg-primary selected state renders in customer color (CP-05: CSS vars
 * do NOT cross iframe document boundaries — parent page's --primary is invisible here),
 * simplified gradient driven by brand_primary directly (background_color /
 * background_shade columns deprecated; dropped in Phase 21 schema migration).
 *
 * Pitfall 10: outer wrapper MUST be `relative overflow-hidden` so blur circles
 * clip to the iframe's visible area and don't extend document.body.scrollHeight
 * (which would cause EmbedHeightReporter to report an inflated height to the parent).
 *
 * Why single-circle (not BackgroundGlow's 2-blob pattern):
 * Embed iframes are typically 300-500px tall. BackgroundGlow's second blob sits at
 * top:420px -- it would never be visible. Single circle is the correct visual scale
 * for the smaller canvas; no need to pull in the BackgroundGlow component.
 *
 * Phase 7 lock: NEVER Tailwind dynamic classes for runtime hex -- inline style only.
 */
export function EmbedShell({
  account,
  eventType,
  previewColor,
  previewLogo,
}: EmbedShellProps) {
  const effectiveColor = previewColor ?? account.brand_primary ?? "#0A2540";
  const effectiveLogo = previewLogo ?? account.logo_url ?? null;
  const textColor = pickTextColor(effectiveColor);

  const cssVars: CSSProperties = {
    ["--brand-primary" as never]: effectiveColor,
    ["--brand-text" as never]: textColor,
    // EMBED-10 (CP-05): CSS vars do not cross iframe boundaries -- embed must set
    // its own --primary so SlotPicker's bg-primary class renders in customer color
    // (otherwise it inherits NSI blue from globals.css :root). --primary-foreground
    // ensures the selected-slot text contrasts correctly on arbitrary brand colors.
    ["--primary" as never]: effectiveColor,
    ["--primary-foreground" as never]: textColor,
    // Pitfall 4 (embed): NEVER min-height: 100vh -- EmbedHeightReporter loop risk.
    minHeight: "auto",
  };

  return (
    <div style={cssVars} className="relative overflow-hidden bg-gray-50">
      {/*
        Phase 17 (EMBED-09): single-circle gradient driven by brand_primary directly.
        Removed background_color/background_shade reads (deprecated columns dropped
        in Phase 21 schema migration). Single gradient profile (always rendered) with
        opacity 0.40 + blur 160px to match BackgroundGlow blob 1 ambiance.

        Why single-circle (not BackgroundGlow's 2-blob pattern): embed iframes are
        typically 300-500px tall -- 2nd blob (positioned at top:420px) would never be
        visible. Single circle is the correct visual scale for the smaller canvas.
        Phase 7 lock: NEVER Tailwind dynamic classes for runtime hex -- inline style only.
      */}
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 -z-10">
        <div
          className="h-80 w-80 rounded-full opacity-40"
          style={{
            backgroundImage: `linear-gradient(to top right, ${effectiveColor}, transparent)`,
            filter: "blur(160px)",
          }}
        />
      </div>

      {/* Optional logo header -- branding preview feature (live preview via ?previewLogo) */}
      {effectiveLogo && (
        <header className="flex justify-center pt-6 px-4 relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={effectiveLogo}
            alt={`${account.name} logo`}
            style={{
              maxWidth: 120,
              maxHeight: 60,
              height: "auto",
              width: "auto",
            }}
          />
        </header>
      )}

      {/* BookingShell renders the Cruip-styled header + slot-picker card (max-w-3xl) */}
      <div className="relative z-10">
        <BookingShell account={account} eventType={eventType} />
      </div>

      {/* PUB-04: NSI attribution footer -- always rendered inside the iframe */}
      <PoweredByNsi />

      {/* EmbedHeightReporter MUST stay last -- measures scrollHeight after footer renders */}
      <EmbedHeightReporter />
    </div>
  );
}
