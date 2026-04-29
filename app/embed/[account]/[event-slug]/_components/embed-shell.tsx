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

/**
 * Embed shell: chromeless (no nav, no header pill), single-circle gradient.
 *
 * Phase 12 restyle: adopts branded gradient backdrop WITH brand color.
 * CONTEXT lock: brand carries inside the iframe.
 *
 * Pitfall 10: outer wrapper MUST be `relative overflow-hidden` so blur circles
 * clip to the iframe's visible area and don't extend document.body.scrollHeight
 * (which would cause EmbedHeightReporter to report an inflated height to the parent).
 *
 * Why single-circle (not 3-circle GradientBackdrop):
 * Embed iframes are typically 300-500px tall. The 3-circle pattern positions circles
 * at top-32, top-[420px], and top-[640px] — circles 2 and 3 would never be visible
 * in a typical iframe height. Using a single inline circle avoids bloating the
 * GradientBackdrop API and keeps the visual impact appropriate for the smaller canvas.
 *
 * Phase 7 lock: NEVER Tailwind dynamic classes for runtime hex — inline style only.
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

  // Phase 12: background_color drives the gradient; fall back to brand_primary so
  // the embed is always branded even without an explicit background_color.
  const backdropColor = account.background_color ?? effectiveColor;
  const shade = (account.background_shade ?? "subtle") as "none" | "subtle" | "bold";

  const cssVars: CSSProperties = {
    ["--brand-primary" as never]: effectiveColor,
    ["--brand-text" as never]: textColor,
    // Pitfall 4 (embed): NEVER min-height: 100vh — EmbedHeightReporter loop risk.
    minHeight: "auto",
  };

  return (
    <div style={cssVars} className="relative overflow-hidden bg-white">
      {/*
        Single-circle gradient — appropriate for small iframe canvas.
        Phase 7 pitfall: inline style for runtime hex (no Tailwind dynamic classes).
        Positioned at -top-32 (inside relative overflow-hidden parent → clips cleanly).
      */}
      {shade !== "none" && (
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 -z-10">
          <div
            className="h-80 w-80 rounded-full"
            style={{
              backgroundImage: `linear-gradient(to top right, ${backdropColor}, transparent)`,
              opacity: shade === "subtle" ? 0.25 : 0.5,
              filter: `blur(${shade === "subtle" ? 200 : 160}px)`,
            }}
          />
        </div>
      )}
      {shade === "none" && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundColor: `color-mix(in oklch, ${backdropColor} 4%, white)`,
          }}
        />
      )}

      {/* Optional logo header — branding preview feature (live preview via ?previewLogo) */}
      {effectiveLogo && (
        <header className="flex justify-center pt-6 px-4">
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
      <BookingShell account={account} eventType={eventType} />

      <EmbedHeightReporter />
    </div>
  );
}
