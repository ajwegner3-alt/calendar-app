"use client";

import { useState } from "react";
import type { BrandingState } from "../_lib/load-branding";
import { LogoUploader } from "./logo-uploader";
import { ColorPickerInput } from "./color-picker-input";
import { PreviewIframe } from "./preview-iframe";

interface BrandingEditorProps {
  state: BrandingState;
}

/**
 * Top-level branding editor orchestrator.
 *
 * Owns two pieces of live preview state:
 * - primaryColor: starts from DB value (or DEFAULT_BRAND_PRIMARY if null)
 * - logoUrl: starts from DB value (or null)
 *
 * Changes to either propagate into PreviewIframe immediately, giving the
 * owner a live preview BEFORE they save (CONTEXT lock).
 *
 * Layout: two-column on md+ (editor left, preview right).
 */
export function BrandingEditor({ state }: BrandingEditorProps) {
  const [primaryColor, setPrimaryColor] = useState(state.primaryColor ?? "#0A2540");
  const [logoUrl, setLogoUrl] = useState<string | null>(state.logoUrl);

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
