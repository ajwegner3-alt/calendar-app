"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Single time-window row: <input type="time"> start, "to", <input type="time"> end, trash icon.
 *
 * Native time inputs render an OS picker on mobile (clock wheel) and a spinner
 * on desktop. Outputs HH:MM strings; we convert to/from minutes-since-midnight
 * via the helpers below.
 */

export function minutesToHHMM(m: number): string {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function hhmmToMinutes(s: string): number {
  // s = "09:30"
  const [hh, mm] = s.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

export interface TimeWindowPickerProps {
  start_minute: number;
  end_minute: number;
  onChange: (next: { start_minute: number; end_minute: number }) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export function TimeWindowPicker({
  start_minute,
  end_minute,
  onChange,
  onRemove,
  disabled,
}: TimeWindowPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        value={minutesToHHMM(start_minute)}
        onChange={(e) =>
          onChange({ start_minute: hhmmToMinutes(e.target.value), end_minute })
        }
        disabled={disabled}
        aria-label="Start time"
        className="w-28"
      />
      <span className="text-muted-foreground text-sm">to</span>
      <Input
        type="time"
        value={minutesToHHMM(end_minute === 1440 ? 1439 : end_minute)}
        onChange={(e) =>
          onChange({
            start_minute,
            end_minute: hhmmToMinutes(e.target.value),
          })
        }
        disabled={disabled}
        aria-label="End time"
        className="w-28"
      />
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove time window"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
