"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { saveWeeklyRulesAction } from "../_lib/actions";
import type { DayOfWeek, TimeWindow } from "../_lib/types";

import { TimeWindowPicker } from "./time-window-picker";
import { CopyFromMenu } from "./copy-from-menu";

const DAY_NAMES: Record<DayOfWeek, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const DEFAULT_WINDOW: TimeWindow = { start_minute: 540, end_minute: 1020 }; // 9:00-17:00

export interface WeekdayRowProps {
  dayOfWeek: DayOfWeek;
  initialWindows: TimeWindow[];
  /** Read-only view of all sibling rows for the Copy-from menu */
  allDays: Record<DayOfWeek, TimeWindow[]>;
}

export function WeekdayRow({
  dayOfWeek,
  initialWindows,
  allDays,
}: WeekdayRowProps) {
  const router = useRouter();
  const [windows, setWindows] = useState<TimeWindow[]>(initialWindows);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // "Open" means there is at least one window. "Closed" means windows is empty.
  const isOpen = windows.length > 0;

  function handleToggle(next: boolean) {
    if (next) {
      // Switching to Open: seed a default window if empty.
      setWindows(windows.length === 0 ? [{ ...DEFAULT_WINDOW }] : windows);
    } else {
      setWindows([]);
    }
    setError(null);
  }

  function updateWindow(index: number, next: TimeWindow) {
    setWindows((prev) => prev.map((w, i) => (i === index ? next : w)));
    setError(null);
  }

  function removeWindow(index: number) {
    setWindows((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  function addWindow() {
    setWindows((prev) => [...prev, { ...DEFAULT_WINDOW }]);
    setError(null);
  }

  function copyFrom(srcWindows: TimeWindow[]) {
    setWindows(srcWindows.map((w) => ({ ...w })));
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveWeeklyRulesAction({
        day_of_week: dayOfWeek,
        windows,
      });
      if (result.formError) {
        toast.error(result.formError);
        setError(result.formError);
        return;
      }
      if (result.fieldErrors?.windows?.[0]) {
        toast.error(result.fieldErrors.windows[0]);
        setError(result.fieldErrors.windows[0]);
        return;
      }
      toast.success(`${DAY_NAMES[dayOfWeek]} saved.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-32 items-center gap-3">
        <Switch
          checked={isOpen}
          onCheckedChange={handleToggle}
          disabled={isPending}
          aria-label={`Toggle ${DAY_NAMES[dayOfWeek]} open/closed`}
        />
        <span className="font-medium">{DAY_NAMES[dayOfWeek]}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {!isOpen && (
          <span className="text-muted-foreground text-sm">Closed</span>
        )}
        {windows.map((w, i) => (
          <TimeWindowPicker
            key={i}
            start_minute={w.start_minute}
            end_minute={w.end_minute}
            onChange={(next) => updateWindow(i, next)}
            onRemove={windows.length > 1 ? () => removeWindow(i) : undefined}
            disabled={isPending}
          />
        ))}
        {isOpen && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addWindow}
            disabled={isPending}
            className="self-start"
          >
            <Plus className="mr-2 size-4" />
            Add window
          </Button>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-start">
        <CopyFromMenu
          currentDay={dayOfWeek}
          allDays={allDays}
          onCopy={copyFrom}
          disabled={isPending}
        />
        <Button type="button" size="sm" onClick={save} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
