interface ListingHeroProps {
  accountName: string;
  logoUrl: string | null;
  brandPrimary: string | null;
}

/**
 * Hero card for the /[account] public landing page.
 *
 * Phase 17 (PUB-05): Inner GradientBackdrop removed — page-level BackgroundGlow
 * (rendered by PublicShell) provides all ambient color. The hero card itself is
 * a clean white rounded-2xl panel.
 *
 * No-logo fallback: brand_primary-tinted initial circle (canonical pattern,
 * shared with PublicHeader — see Plan 17-01 HDR-06 lock).
 *
 * MP-04 lock: runtime hex flows through inline style only, never Tailwind JIT classes.
 */
export function ListingHero({
  accountName,
  logoUrl,
  brandPrimary,
}: ListingHeroProps) {
  const avatarColor = brandPrimary ?? "#0A2540";

  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm md:py-20">
      <div className="flex flex-col items-center gap-4">
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
