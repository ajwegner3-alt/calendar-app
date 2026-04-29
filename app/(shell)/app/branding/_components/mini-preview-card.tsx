"use client";
import type { BackgroundShade, ChromeTintIntensity } from "@/lib/branding/types";
import { GradientBackdrop } from "@/app/_components/gradient-backdrop";
import { chromeTintToCss } from "@/lib/branding/chrome-tint";

interface MiniPreviewCardProps {
  color: string | null;
  shade: BackgroundShade;
  chromeTintIntensity: ChromeTintIntensity;
}

/**
 * Chrome-aware inline preview card showing a faux dashboard layout.
 *
 * Architecture decision (a) from CONTEXT.md: REPLACE gradient-only preview with
 * a chrome-aware layout — single source of truth for how the dashboard looks.
 *
 * Layout:
 * - Left strip: faux sidebar (tinted per sidebar intensity)
 * - Right area: faux page (tinted per page intensity) with GradientBackdrop behind faux card
 * - Faux card: always white, invariant of intensity
 *
 * Phase 7 lesson: no dynamic Tailwind classes for runtime hex — all inline style.
 * CONTEXT.md lock: this is the ONLY in-page preview for the chrome layout.
 * Owners navigate to actual surfaces to see the full in-context experience.
 */
export function MiniPreviewCard({ color, shade, chromeTintIntensity }: MiniPreviewCardProps) {
  const sidebarBg = chromeTintToCss(color, chromeTintIntensity, "sidebar");
  const pageBg = chromeTintToCss(color, chromeTintIntensity, "page");

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">Preview</p>
      <div
        className="relative h-48 overflow-hidden rounded-lg border"
        style={{ backgroundColor: pageBg ?? undefined }}
      >
        {/* Faux sidebar strip */}
        <div
          className="absolute left-0 top-0 bottom-0 w-12 border-r border-border/30"
          style={{ backgroundColor: sidebarBg ?? "hsl(var(--sidebar))" }}
        >
          {/* Sidebar shimmer items */}
          <div className="flex flex-col gap-2 p-2 pt-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-2 rounded-full bg-foreground/15 w-full" />
            ))}
          </div>
        </div>

        {/* Page area (right of sidebar) */}
        <div className="relative ml-12 h-full overflow-hidden">
          {/* GradientBackdrop composited on top of page tint — same as real dashboard */}
          <GradientBackdrop color={color} shade={shade} />

          {/* Faux card — always white, invariant of intensity */}
          <div className="relative mx-3 mt-4 rounded-md bg-white p-3 shadow-sm">
            {/* Shimmer title bar */}
            <div className="h-2.5 w-2/3 rounded-full bg-foreground/10 mb-2" />
            {/* Shimmer body line */}
            <div className="h-2 w-1/2 rounded-full bg-foreground/8 mb-1" />
            {/* Shimmer action buttons */}
            <div className="mt-2 flex gap-1.5">
              <div className="h-6 w-14 rounded bg-foreground/15" />
              <div className="h-6 w-10 rounded bg-foreground/8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
