"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BrandingState } from "../_lib/load-branding";
import type { BackgroundShade, ChromeTintIntensity } from "@/lib/branding/types";
import { LogoUploader } from "./logo-uploader";
import { ColorPickerInput } from "./color-picker-input";
import { PreviewIframe } from "./preview-iframe";
import { ShadePicker } from "./shade-picker";
import { IntensityPicker } from "./intensity-picker";
import { MiniPreviewCard } from "./mini-preview-card";
import { saveBrandingAction } from "../_lib/actions";

interface BrandingEditorProps {
  state: BrandingState;
}

/**
 * Top-level branding editor orchestrator.
 *
 * Owns five pieces of live preview state:
 * - primaryColor: starts from DB value (or DEFAULT_BRAND_PRIMARY if null)
 * - logoUrl: starts from DB value (or null)
 * - backgroundColor: starts from DB value (or null — gray-50 fallback in preview)
 * - backgroundShade: starts from DB value (or 'subtle')
 * - chromeTintIntensity: starts from DB value (or 'subtle')
 *
 * Changes to any propagate into the respective preview immediately, giving the
 * owner a live preview BEFORE they save (CONTEXT lock).
 *
 * Layout: two-column on md+ (editor left, preview right).
 */
export function BrandingEditor({ state }: BrandingEditorProps) {
  const [primaryColor, setPrimaryColor] = useState(state.primaryColor ?? "#0A2540");
  const [logoUrl, setLogoUrl] = useState<string | null>(state.logoUrl);

  // Phase 12: background gradient state
  const [backgroundColor, setBackgroundColor] = useState<string | null>(
    state.backgroundColor,
  );
  const [backgroundShade, setBackgroundShade] = useState<BackgroundShade>(
    state.backgroundShade,
  );

  // Phase 12.5: chrome tint intensity state
  const [chromeTintIntensity, setChromeTintIntensity] = useState<ChromeTintIntensity>(
    state.chromeTintIntensity,
  );

  const [isSavingBackground, startBackgroundSave] = useTransition();

  function handleSaveBackground() {
    startBackgroundSave(async () => {
      const result = await saveBrandingAction({
        backgroundColor,
        backgroundShade,
        chromeTintIntensity,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.fieldErrors) {
        const firstError = Object.values(result.fieldErrors).flat()[0];
        if (firstError) toast.error(firstError);
      } else {
        toast.success("Background saved.");
      }
    });
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Left column: controls */}
      <section className="space-y-8">
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

        <div className="space-y-3">
          <h2 className="text-lg font-medium">Primary color</h2>
          <p className="text-sm text-muted-foreground">
            Used for buttons and headings. Type a hex value or use the color picker.
          </p>
          <ColorPickerInput value={primaryColor} onChange={setPrimaryColor} />
        </div>

        {/* Phase 12: Background color */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Background color</h2>
          <p className="text-sm text-muted-foreground">
            Sets the gradient accent color on your booking pages. Pick a swatch or enter a custom hex.
          </p>
          <ColorPickerInput
            value={backgroundColor ?? "#0A2540"}
            onChange={(hex) => setBackgroundColor(hex)}
            showSaveButton={false}
            showSwatches={true}
          />
        </div>

        {/* Phase 12: Background shade */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Background shade</h2>
          <p className="text-sm text-muted-foreground">
            Controls gradient intensity. "Subtle" is a soft accent; "Bold" is a full Cruip-style pattern.
          </p>
          <ShadePicker value={backgroundShade} onChange={setBackgroundShade} />
        </div>

        {/* Phase 12.5: Chrome intensity */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Chrome intensity</h2>
          <p className="text-sm text-muted-foreground">
            Controls how much brand color tints the dashboard sidebar and background.
            "None" keeps the neutral gray look.
          </p>
          <IntensityPicker
            value={chromeTintIntensity}
            onChange={setChromeTintIntensity}
          />

          {/* Phase 12.5: Chrome-aware inline mini-preview (CONTEXT lock: only in-page preview) */}
          <MiniPreviewCard
            color={backgroundColor}
            shade={backgroundShade}
            chromeTintIntensity={chromeTintIntensity}
          />

          <Button
            onClick={handleSaveBackground}
            disabled={isSavingBackground}
            size="sm"
          >
            {isSavingBackground ? "Saving…" : "Save background"}
          </Button>
        </div>
      </section>

      {/* Right column: live preview */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Live preview</h2>
        <p className="text-sm text-muted-foreground">
          Updates instantly as you change logo or color — before you save.
        </p>
        <PreviewIframe
          accountSlug={state.accountSlug}
          firstActiveEventSlug={state.firstActiveEventSlug}
          previewColor={primaryColor}
          previewLogo={logoUrl}
        />
      </section>
    </div>
  );
}
