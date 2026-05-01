"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { relativeLuminance } from "@/lib/branding/contrast";
import type { BrandingState } from "../_lib/load-branding";
import { LogoUploader } from "./logo-uploader";
import { ColorPickerInput } from "./color-picker-input";
import { MiniPreviewCard } from "./mini-preview-card";
import { PreviewIframe } from "./preview-iframe";

interface BrandingEditorProps {
  state: BrandingState;
}

const NSI_BLUE = "#3B82F6";
const LUMINANCE_NEAR_WHITE_THRESHOLD = 0.85; // Matches Phase 17 PublicShell resolveGlowColor — single source of truth

/**
 * Phase 18 (BRAND-13..21): collapsed to two controls — logo + brand_primary.
 *
 * Layout: controls left column / MiniPreviewCard above PreviewIframe right column.
 * Order in left column: logo first, then color picker (identity before style).
 *
 * Color save: ColorPickerInput's default showSaveButton=true mode wires
 * savePrimaryColorAction directly. No top-level handler needed.
 *
 * Logo save: LogoUploader wires uploadLogoAction / deleteLogoAction directly.
 *
 * MP-04 JIT lock honored throughout — runtime hex flows via inline style only
 * (see MiniPreviewCard implementation).
 */
export function BrandingEditor({ state }: BrandingEditorProps) {
  const [primaryColor, setPrimaryColor] = useState(state.primaryColor ?? NSI_BLUE);
  const [logoUrl, setLogoUrl] = useState<string | null>(state.logoUrl);

  // Contrast warning: matches Phase 17 PublicShell luminance > 0.85 fallback threshold.
  // Defensive try/catch — bad hex never crashes the editor (mirrors public-shell.tsx).
  let isNearWhite = false;
  try {
    isNearWhite = relativeLuminance(primaryColor) > LUMINANCE_NEAR_WHITE_THRESHOLD;
  } catch {
    isNearWhite = false;
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* LEFT COLUMN — controls */}
      <section className="space-y-8">
        {/* Logo first */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Logo</h2>
          <p className="text-sm text-muted-foreground">
            Upload a PNG logo (max 2 MB). It will appear in your booking page header and emails.
          </p>
          <LogoUploader
            currentLogoUrl={logoUrl}
            onUpload={(url) => setLogoUrl(url)}
            onDelete={() => setLogoUrl(null)}
          />
        </div>

        {/* Brand primary color second */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Booking page primary color</h2>
          <p className="text-sm text-muted-foreground">
            Used for the background glow, CTAs, and slot selection on your public booking pages.
          </p>
          <ColorPickerInput value={primaryColor} onChange={setPrimaryColor} />

          {/* Reset to NSI blue escape hatch */}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrimaryColor(NSI_BLUE)}
            >
              Reset to NSI blue ({NSI_BLUE})
            </Button>
          </div>

          {/* Contrast warning — informational only, save still allowed */}
          {isNearWhite ? (
            <p className="text-sm text-amber-600">
              This color may be hard to read on white backgrounds.
            </p>
          ) : null}
        </div>
      </section>

      {/* RIGHT COLUMN — MiniPreviewCard above PreviewIframe */}
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Mini preview</h2>
          <p className="text-sm text-muted-foreground">
            Updates instantly as you change logo or color — before you save.
          </p>
          <MiniPreviewCard
            brandPrimary={primaryColor}
            logoUrl={logoUrl}
            accountName={state.accountSlug}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-medium">Live booking page</h2>
          <p className="text-sm text-muted-foreground">
            Real embed widget — updates after you save the color.
          </p>
          <PreviewIframe
            accountSlug={state.accountSlug}
            firstActiveEventSlug={state.firstActiveEventSlug}
            previewColor={primaryColor}
            previewLogo={logoUrl}
          />
        </div>
      </section>
    </div>
  );
}
