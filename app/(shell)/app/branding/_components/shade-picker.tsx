"use client";
import type { BackgroundShade } from "@/lib/branding/types";

interface ShadePickerProps {
  value: BackgroundShade;
  onChange: (shade: BackgroundShade) => void;
}

const OPTIONS: Array<{
  value: BackgroundShade;
  label: string;
  description: string;
}> = [
  { value: "none", label: "None", description: "Flat solid surface, no gradient" },
  {
    value: "subtle",
    label: "Subtle",
    description: "Soft gradient accents (default)",
  },
  { value: "bold", label: "Bold", description: "Strong gradient circles" },
];

/**
 * 3-button toggle for background gradient intensity: none / subtle / bold.
 * Phase 12 BRAND-06.
 */
export function ShadePicker({ value, onChange }: ShadePickerProps) {
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
