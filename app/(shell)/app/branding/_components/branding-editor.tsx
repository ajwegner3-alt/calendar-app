"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BrandingState } from "../_lib/load-branding";
import type { BackgroundShade } from "@/lib/branding/types";
import { LogoUploader } from "./logo-uploader";
import { ColorPickerInput } from "./color-picker-input";
import { PreviewIframe } from "./preview-iframe";
import { ShadePicker } from "./shade-picker";
import { MiniPreviewCard } from "./mini-preview-card";
import { saveBrandingAction } from "../_lib/actions";

interface BrandingEditorProps {
  state: BrandingState;
}

/**
 * Top-level branding editor orchestrator.
 *
 * Phase 12.6: owns three live color preview fields (replacing Phase 12.5 chromeTintIntensity):
 * - primaryColor: "Button & accent color" — used for buttons, switches, focus rings
 * - sidebarColor: "Sidebar color" — direct hex fill for sidebar background
 * - backgroundColor: "Page background" — direct hex fill for page area background
 * - backgroundShade: "Background shade" — gradient backdrop intensity (unchanged)
 * - logoUrl: logo (unchanged)
 *
 * Changes to any field propagate into the MiniPreviewCard immediately, giving the
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

  // Phase 12.6: direct sidebar color state (replaces chromeTintIntensity)
  const [sidebarColor, setSidebarColor] = useState<string | null>(
    state.sidebarColor,
  );

  const [isSavingBackground, startBackgroundSave] = useTransition();

  function handleSaveBackground() {
    startBackgroundSave(async () => {
      const result = await saveBrandingAction({
        backgroundColor,
        backgroundShade,
        sidebarColor,
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
          <h2 className="text-lg font-medium">Button &amp; accent color</h2>
          <p className="text-sm text-muted-foreground">
            Used for buttons, switches, and focus rings throughout your dashboard.
          </p>
          <ColorPickerInput value={primaryColor} onChange={setPrimaryColor} />
        </div>

        {/* Phase 12.6: Sidebar color */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Sidebar color</h2>
          <p className="text-sm text-muted-foreground">
            Sets the sidebar background. Leave blank to use the default light gray.
          </p>
          <ColorPickerInput
            value={sidebarColor ?? "#0A2540"}
            onChange={(hex) => setSidebarColor(hex)}
            showSaveButton={false}
            showSwatches={true}
          />
        </div>

        {/* Phase 12.6: Page background (was "Background color") */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Page background</h2>
          <p className="text-sm text-muted-foreground">
            Sets the dashboard page area background. Leave blank for the default light gray.
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

          {/* Phase 12.6: 3-color mini preview */}
          <MiniPreviewCard
            sidebarColor={sidebarColor}
            pageColor={backgroundColor}
            primaryColor={primaryColor}
            shade={backgroundShade}
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
