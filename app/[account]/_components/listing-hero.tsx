import { GradientBackdrop } from "@/app/_components/gradient-backdrop";
import type { BackgroundShade } from "@/lib/branding/types";

interface ListingHeroProps {
  accountName: string;
  logoUrl: string | null;
  brandPrimary: string | null;
  backgroundColor: string | null;
  backgroundShade: BackgroundShade;
}

/**
 * Cruip-styled hero card for the /[account] public landing page.
 *
 * Renders a self-contained gradient spotlight panel (separate from the page-level
 * BrandedPage gradient backdrop). The inner GradientBackdrop provides strong
 * visual emphasis on the hero card itself.
 *
 * Color fallback chain: backgroundColor → brandPrimary → gray-50 (#F8FAFC).
 * When backgroundColor is null, brand_primary is used so the hero looks branded
 * even before the owner explicitly picks a background color.
 *
 * Phase 7 lock: NEVER dynamic Tailwind classes for runtime hex — inline style only.
 * Consumer: place inside a `relative` parent for GradientBackdrop positioning.
 */
export function ListingHero({
  accountName,
  logoUrl,
  brandPrimary,
  backgroundColor,
  backgroundShade,
}: ListingHeroProps) {
  // Fall back to brand_primary so hero is always branded even without background_color.
  const backdropColor = backgroundColor ?? brandPrimary ?? null;
  const avatarColor = brandPrimary ?? "#0A2540";

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-white px-6 py-12 text-center md:py-20">
      <GradientBackdrop color={backdropColor} shade={backgroundShade} />
      <div className="relative z-10 flex flex-col items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={accountName} className="h-16 w-auto" />
        ) : (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {accountName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
          {accountName}
        </h1>
        <p className="max-w-md text-sm text-gray-600 md:text-base">
          Pick a time below to book a meeting.
        </p>
      </div>
    </section>
  );
}
