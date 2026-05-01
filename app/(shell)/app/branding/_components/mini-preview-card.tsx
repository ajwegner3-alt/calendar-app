"use client";

interface MiniPreviewCardProps {
  brandPrimary: string;
  logoUrl: string | null;
  accountName: string;
}

/**
 * Faux PUBLIC booking page preview. Mirrors Phase 17 PublicShell visual
 * grammar (gray-50 base + brand_primary blob + glass pill + white card +
 * Powered-by-NSI footer) at miniature scale so owners see what their
 * brand_primary will produce on the real public booking page BEFORE saving.
 *
 * Phase 18 BRAND-17: replaces the Phase 12.6 faux-dashboard preview.
 * MP-04 JIT lock: runtime hex flows through inline style only — never
 * Tailwind classes.
 *
 * Props are reactive to parent state — every keystroke updates the preview.
 */
export function MiniPreviewCard({ brandPrimary, logoUrl, accountName }: MiniPreviewCardProps) {
  const initial = (accountName.charAt(0) || "P").toUpperCase();

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">Preview</p>

      {/* Faux public page: bg-gray-50 + blob + glass pill + white card + footer */}
      <div className="relative h-56 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {/* Brand-primary blob — inline style for JIT lock (MP-04) */}
        <div
          aria-hidden
          className="absolute h-32 w-32 rounded-full opacity-40"
          style={{
            top: "-16px",
            left: "calc(50% + 30px)",
            transform: "translateX(-50%)",
            background: `linear-gradient(to top right, ${brandPrimary}, transparent)`,
            filter: "blur(60px)",
          }}
        />

        {/* Faux glass pill at top — logo or initial circle */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 backdrop-blur-sm border border-gray-200 shadow-sm">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-4 w-auto" style={{ maxHeight: 16, maxWidth: 60 }} />
          ) : (
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold text-white"
              style={{ backgroundColor: brandPrimary }}
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
        </div>

        {/* Faux white card — slot picker preview */}
        <div className="absolute inset-x-4 top-12 bottom-4 flex flex-col">
          <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {/* Faux event title strip */}
            <div className="mb-3 space-y-1">
              <div className="h-2 w-2/3 rounded-full bg-gray-200" />
              <div className="h-1.5 w-1/3 rounded-full bg-gray-100" />
            </div>

            {/* Faux 3-button slot picker — middle button selected with brand_primary */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="h-6 rounded border border-gray-200 bg-white text-[10px] text-gray-600"
              >
                9:00
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="h-6 rounded text-[10px] font-medium text-white"
                style={{ backgroundColor: brandPrimary }}
              >
                10:00
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="h-6 rounded border border-gray-200 bg-white text-[10px] text-gray-600"
              >
                11:00
              </button>
            </div>

            {/* Powered-by-NSI footer at card bottom */}
            <div className="mt-3 text-center text-[10px] text-gray-400">
              Powered by North Star Integrations
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
