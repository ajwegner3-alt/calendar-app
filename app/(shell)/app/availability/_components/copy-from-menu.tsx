"use client";

import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { DayOfWeek, TimeWindow } from "../_lib/types";

const DAY_NAMES: Record<DayOfWeek, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export interface CopyFromMenuProps {
  /** Current weekday — excluded from the menu */
  currentDay: DayOfWeek;
  /** All weekday → windows in current form state (the "live" sibling values) */
  allDays: Record<DayOfWeek, TimeWindow[]>;
  onCopy: (windows: TimeWindow[]) => void;
  disabled?: boolean;
}

export function CopyFromMenu({
  currentDay,
  allDays,
  onCopy,
  disabled,
}: CopyFromMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={disabled}>
          <Copy className="mr-2 size-4" />
          Copy from
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(DAY_NAMES) as unknown as string[])
          .map(Number)
          .filter((d) => d !== currentDay)
          .map((d) => {
            const dow = d as DayOfWeek;
            const count = allDays[dow]?.length ?? 0;
            const label =
              count === 0
                ? `${DAY_NAMES[dow]} (Closed)`
                : `${DAY_NAMES[dow]} (${count} window${count === 1 ? "" : "s"})`;
            return (
              <DropdownMenuItem
                key={dow}
                onSelect={() => onCopy(allDays[dow] ?? [])}
              >
                {label}
              </DropdownMenuItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
