"use client";

import type { CSSProperties } from "react";
import { BookingShell } from "@/app/[account]/[event-slug]/_components/booking-shell";
import type {
  AccountSummary,
  EventTypeSummary,
} from "@/app/[account]/[event-slug]/_lib/types";
import { EmbedHeightReporter } from "./embed-height-reporter";
import { pickTextColor } from "@/lib/branding/contrast";

interface EmbedShellProps {
  account: AccountSummary;
  eventType: EventTypeSummary;
  /** Optional override from ?previewColor=#RRGGBB — branding editor live preview */
  previewColor?: string;
  /** Optional override from ?previewLogo=encodedUrl — branding editor live preview */
  previewLogo?: string;
}

export function EmbedShell({
  account,
  eventType,
  previewColor,
  previewLogo,
}: EmbedShellProps) {
  const effectiveColor = previewColor ?? account.brand_primary ?? "#0A2540";
  const effectiveLogo = previewLogo ?? account.logo_url ?? null;
  const textColor = pickTextColor(effectiveColor);

  const style: CSSProperties = {
    // CSS vars consumed by Tailwind classes that read them.
    // Approach mirrors Phase 2 STATE lock: per-account brand swaps Tailwind v4 @theme
    // vars at the wrapping element. Plan 07-06 wires consumption of these vars.
    ["--brand-primary" as never]: effectiveColor,
    ["--brand-text" as never]: textColor,
    minHeight: "auto", // Pitfall 4: NEVER min-height: 100vh on embed root
  };

  return (
    <div style={style} className="px-4 py-6">
      {effectiveLogo && (
        <header className="mb-6 flex justify-center">
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
      <h1 className="text-xl font-semibold text-center mb-1">
        {eventType.name}
      </h1>
      <p className="text-sm text-center text-muted-foreground mb-6">
        {eventType.duration_minutes} min · with {account.name}
      </p>
      <BookingShell account={account} eventType={eventType} />
      <EmbedHeightReporter />
    </div>
  );
}
