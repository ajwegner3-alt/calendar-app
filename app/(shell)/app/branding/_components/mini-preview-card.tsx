"use client";
import type { BackgroundShade } from "@/lib/branding/types";
import { GradientBackdrop } from "@/app/_components/gradient-backdrop";

interface MiniPreviewCardProps {
  color: string | null;
  shade: BackgroundShade;
}

/**
 * Inline preview card that renders GradientBackdrop with the current editor state.
 * Updates live as parent passes new color/shade props.
 *
 * CONTEXT.md lock: this is the ONLY in-page preview for the gradient backdrop.
 * Owners navigate to actual surfaces to see the full in-context experience.
 *
 * Phase 7 lesson: no dynamic Tailwind classes for runtime hex — all inline style.
 */
export function MiniPreviewCard({ color, shade }: MiniPreviewCardProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">Preview</p>
      <div className="relative h-48 overflow-hidden rounded-lg border bg-background">
        {/* Gradient backdrop updates live as color/shade change */}
        <GradientBackdrop color={color} shade={shade} />

        {/* Faux dashboard centerpiece — gives gradient something to sit behind */}
        <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6">
          <div className="h-3 w-2/3 rounded-full bg-foreground/10" />
          <div className="h-2 w-1/2 rounded-full bg-foreground/8" />
          <div className="mt-2 flex gap-2">
            <div className="h-8 w-20 rounded-md bg-foreground/15" />
            <div className="h-8 w-16 rounded-md bg-foreground/8" />
          </div>
          <div className="mt-1 h-2 w-3/4 rounded-full bg-foreground/6" />
          <div className="h-2 w-1/2 rounded-full bg-foreground/6" />
        </div>
      </div>
    </div>
  );
}
