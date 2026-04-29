"use client";
import type { BackgroundShade } from "@/lib/branding/types";
import { shadeToGradient } from "@/lib/branding/gradient";

interface GradientBackdropProps {
  color: string | null;
  shade: BackgroundShade;
}

/**
 * Cruip-pattern decorative gradient blur-circles for branded surfaces.
 * Renders 3 absolutely-positioned divs with blur(160-200px) gradient fills.
 * shade='none' renders a flat color-mix tint instead.
 *
 * Phase 7 lesson: NEVER use Tailwind dynamic classes for runtime hex values
 * (bg-${hex} does NOT compile in v4 JIT). All runtime colors use inline `style`.
 *
 * Consumer responsibility: place inside a `relative` parent with `overflow-hidden`
 * if scroll-height matters (embed iframe pitfall).
 */
export function GradientBackdrop({ color, shade }: GradientBackdropProps) {
  const plan = shadeToGradient(color, shade);

  if (plan.shade === "none") {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundColor: plan.flatTint ?? undefined }}
      />
    );
  }

  // Three positioned circles per Cruip pattern (research §Pattern 2)
  const positions = [
    "pointer-events-none absolute -top-32 left-1/2 ml-[280px] -translate-x-1/2 -z-10",
    "pointer-events-none absolute left-1/2 top-[420px] ml-[180px] -translate-x-1/2 -z-10",
    "pointer-events-none absolute left-1/2 top-[640px] -ml-[200px] -translate-x-1/2 -z-10",
  ];

  return (
    <>
      {plan.circles.map((c, i) => (
        <div key={i} aria-hidden className={positions[i]}>
          <div
            className="h-80 w-80 rounded-full"
            style={{
              backgroundImage: c.backgroundImage,
              opacity: c.opacity,
              filter: `blur(${c.blurPx}px)`,
            }}
          />
        </div>
      ))}
    </>
  );
}
