import { BackgroundGlow } from "@/app/_components/background-glow";

interface AuthHeroProps {
  /** Page-specific headline override (e.g. "Welcome back" on login). */
  headline?: string;
  /** Page-specific subtext override. */
  subtext?: string;
}

/**
 * NSI marketing hero panel for auth pages.
 * CONTEXT.md lock: NSI tokens fixed (auth pages have no account context).
 * Renders on lg: as the right-side panel of a split-panel layout;
 * hidden on smaller breakpoints (form-only on mobile).
 *
 * Phase 16-02: backdrop swapped from NSIGradientBackdrop (dark navy) to
 * BackgroundGlow (NSI blue #3B82F6) per AUTH-12. Marketing copy preserved verbatim.
 */
export function AuthHero({
  headline = "Bookings without the back-and-forth.",
  subtext = "A multi-tenant scheduling tool built for trade contractors. Branded booking pages, capacity-aware slots, and email confirmations — done.",
}: AuthHeroProps) {
  return (
    <aside className="relative hidden overflow-hidden bg-gray-50 lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12 lg:py-20">
      <BackgroundGlow />
      <div className="relative z-10 max-w-md">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900">
          {headline}
        </h1>
        <p className="mt-4 text-base text-gray-600">{subtext}</p>
        <ul className="mt-8 space-y-3 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
            Free for new owners — no card, no trial gates.
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
            Brand it your way — colors, logo, embed widget.
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
            Built for trade contractors, by NSI in Omaha.
          </li>
        </ul>
      </div>
    </aside>
  );
}
