"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePrimaryColorAction } from "../_lib/actions";
import { primaryColorSchema } from "../_lib/schema";

// Phase 12: curated swatch palette aligned with Cruip gradient research
const CRUIP_SWATCHES = [
  { name: "NSI Navy", hex: "#0A2540" },
  { name: "Cruip Blue", hex: "#3B82F6" },
  { name: "Forest", hex: "#10B981" },
  { name: "Sunset", hex: "#F97316" },
  { name: "Magenta", hex: "#EC4899" },
  { name: "Violet", hex: "#8B5CF6" },
  { name: "Slate", hex: "#475569" },
  { name: "Stone", hex: "#78716C" },
] as const;

interface ColorPickerInputProps {
  value: string;
  onChange: (hex: string) => void;
  /**
   * When true (default), renders an inline "Save color" button that calls
   * savePrimaryColorAction directly.
   * When false, omits the save button — the parent handles saving.
   * Use false for the background-color slot (parent form handles persistence).
   */
  showSaveButton?: boolean;
  /**
   * When true, shows the curated swatch palette above the native picker.
   * Default: false (existing primary-color behavior unchanged).
   */
  showSwatches?: boolean;
}

/**
 * Normalizes any CSS color string to uppercase #RRGGBB if possible,
 * otherwise returns the input unchanged (let the blur validation catch it).
 */
function normalizeHex(val: string): string {
  const trimmed = val.trim();
  // Already valid format — just uppercase
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  // Allow typing 6 hex chars without # (auto-prefix)
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`;
  }
  return trimmed;
}

export function ColorPickerInput({
  value,
  onChange,
  showSaveButton = true,
  showSwatches = false,
}: ColorPickerInputProps) {
  // Local state for the text input so user can type freely without parent re-rendering every keystroke
  const [localText, setLocalText] = useState(value);
  const [isPending, startTransition] = useTransition();

  // Sync local text when parent value changes (e.g., after save + page refresh)
  // Use a ref trick: only sync when value changes from outside (not from local edits)
  // Simple approach: keep localText in sync on mount; parent drives after reset
  const [lastParentValue, setLastParentValue] = useState(value);
  if (value !== lastParentValue) {
    setLastParentValue(value);
    setLocalText(value);
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setLocalText(raw);
    const normalized = normalizeHex(raw);
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onChange(normalized);
    }
  }

  function handleTextBlur() {
    const normalized = normalizeHex(localText);
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      toast.error("Enter a valid 6-digit hex color (e.g. #FF6B6B).");
      return;
    }
    setLocalText(normalized);
    onChange(normalized);
  }

  function handleColorPickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const hex = e.target.value.toUpperCase(); // native picker always returns #rrggbb
    setLocalText(hex);
    onChange(hex);
  }

  function handleSwatchClick(hex: string) {
    setLocalText(hex);
    onChange(hex);
  }

  function handleSave() {
    const normalized = normalizeHex(localText);
    const parsed = primaryColorSchema.safeParse(normalized);
    if (!parsed.success) {
      toast.error("Enter a valid 6-digit hex color (e.g. #FF6B6B).");
      return;
    }

    startTransition(async () => {
      const result = await savePrimaryColorAction(parsed.data);
      if (result.error) {
        toast.error(result.error);
      } else if (result.fieldErrors?.primaryColor) {
        toast.error(result.fieldErrors.primaryColor[0]);
      } else {
        toast.success("Color saved.");
      }
    });
  }

  // Determine the color to show in native picker (must be valid 6-digit hex)
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(localText)
    ? localText.toLowerCase()
    : "#0a2540";

  return (
    <div className="space-y-3">
      {/* Phase 12: curated swatch palette (shown when showSwatches=true) */}
      {showSwatches && (
        <div className="flex flex-wrap gap-2">
          {CRUIP_SWATCHES.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              aria-label={swatch.name}
              onClick={() => handleSwatchClick(swatch.hex)}
              className="h-8 w-8 rounded-full border-2 transition focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: swatch.hex,
                // Phase 7 lesson: use inline style for runtime hex — never dynamic Tailwind classes
                borderColor:
                  value.toUpperCase() === swatch.hex
                    ? "hsl(var(--primary, 221 83% 53%))"
                    : "transparent",
                boxShadow:
                  value.toUpperCase() === swatch.hex
                    ? "0 0 0 2px white, 0 0 0 4px currentColor"
                    : undefined,
              }}
            />
          ))}
        </div>
      )}

      {showSwatches && (
        <p className="text-xs text-muted-foreground">
          Or enter a custom hex:
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Label htmlFor="color-text" className="sr-only">
            Hex color
          </Label>
          {/* Native color picker — bound to the same value */}
          <input
            type="color"
            value={pickerValue}
            onChange={handleColorPickerChange}
            className="h-10 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
            aria-label="Color picker"
          />
          <Input
            id="color-text"
            type="text"
            value={localText}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            placeholder="#0A2540"
            maxLength={7}
            className="font-mono uppercase w-32"
            aria-label="Hex color value"
          />
        </div>
        {showSaveButton && (
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? "Saving…" : "Save color"}
          </Button>
        )}
      </div>
      {!showSwatches && (
        <p className="text-xs text-muted-foreground">
          Use a 6-digit hex color (e.g. <span className="font-mono">#FF6B6B</span>). The
          color applies to buttons and headings on your booking page.
        </p>
      )}
    </div>
  );
}
