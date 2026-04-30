"use client";
import type { BackgroundShade } from "@/lib/branding/types";
import { GradientBackdrop } from "@/app/_components/gradient-backdrop";

interface MiniPreviewCardProps {
  sidebarColor: string | null;
  pageColor: string | null;
  primaryColor: string | null;
  shade: BackgroundShade; // keep for GradientBackdrop
}

/**
 * 3-color inline preview card showing a faux dashboard layout.
 *
 * Phase 12.6 rebuild: shows all three direct-color surfaces simultaneously:
 * - Faux sidebar strip: filled with sidebarColor (null = CSS default)
 * - Faux page area: filled with pageColor (null = CSS default)
 * - Faux primary button + switch: filled with primaryColor (null = CSS default)
 *
 * Phase 7 lesson: no dynamic Tailwind classes for runtime hex — all inline style.
 * CONTEXT.md lock: this is the ONLY in-page preview for the chrome layout.
 * Owners navigate to actual surfaces to see the full in-context experience.
 */
export function MiniPreviewCard({ sidebarColor, pageColor, primaryColor, shade }: MiniPreviewCardProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">Preview</p>
      <div
        className="relative h-48 overflow-hidden rounded-lg border"
        style={{ backgroundColor: pageColor ?? undefined }}
      >
        {/* Faux sidebar strip */}
        <div
          className="absolute left-0 top-0 bottom-0 w-12 border-r border-border/30"
          style={{ backgroundColor: sidebarColor ?? "hsl(var(--sidebar))" }}
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
          {/* GradientBackdrop composited on top of page color — same as real dashboard */}
          <GradientBackdrop color={pageColor} shade={shade} />

          {/* Faux card — always white, invariant of colors */}
          <div className="relative mx-3 mt-4 rounded-md bg-white p-3 shadow-sm">
            {/* Shimmer title bar */}
            <div className="h-2.5 w-2/3 rounded-full bg-foreground/10 mb-2" />
            {/* Shimmer body line */}
            <div className="h-2 w-1/2 rounded-full bg-foreground/8 mb-1" />
            {/* Faux action buttons — reflect primaryColor */}
            <div className="mt-2 flex items-center gap-2">
              {/* Faux primary button */}
              <div
                className="h-6 w-14 rounded text-[0px]"
                style={{ backgroundColor: primaryColor ?? "hsl(var(--primary))" }}
              />
              {/* Faux switch on-state */}
              <div
                className="h-4 w-7 rounded-full"
                style={{ backgroundColor: primaryColor ?? "hsl(var(--primary))" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
