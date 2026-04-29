"use client";
import type { ChromeTintIntensity } from "@/lib/branding/types";

interface IntensityPickerProps {
  value: ChromeTintIntensity;
  onChange: (v: ChromeTintIntensity) => void;
}

const OPTIONS: Array<{
  value: ChromeTintIntensity;
  label: string;
  description: string;
}> = [
  {
    value: "none",
    label: "None",
    description: "Gray dashboard (Phase 12 baseline)",
  },
  {
    value: "subtle",
    label: "Subtle",
    description: "Light brand accent",
  },
  {
    value: "full",
    label: "Full",
    description: "Heavy chrome tint",
  },
];

/**
 * 3-button toggle for chrome tinting intensity: none / subtle / full.
 * Phase 12.5 BRAND-08.
 *
 * Matches ShadePicker styling pattern exactly.
 */
export function IntensityPicker({ value, onChange }: IntensityPickerProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg border p-3 text-left transition ${
            value === o.value
              ? "border-primary bg-primary/5"
              : "border-input hover:bg-muted"
          }`}
          aria-pressed={value === o.value}
        >
          <div className="text-sm font-medium">{o.label}</div>
          <div className="text-xs text-muted-foreground">{o.description}</div>
        </button>
      ))}
    </div>
  );
}
