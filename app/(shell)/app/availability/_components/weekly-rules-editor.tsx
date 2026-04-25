"use client";

import { useMemo } from "react";

import type { AvailabilityRuleRow, DayOfWeek, TimeWindow } from "../_lib/types";

import { WeekdayRow } from "./weekday-row";

const ALL_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Mon-first display order

export interface WeeklyRulesEditorProps {
  rules: AvailabilityRuleRow[];
}

export function WeeklyRulesEditor({ rules }: WeeklyRulesEditorProps) {
  /** Group rules by day_of_week into TimeWindow[] arrays, sorted by start_minute. */
  const allDays = useMemo<Record<DayOfWeek, TimeWindow[]>>(() => {
    const out: Record<DayOfWeek, TimeWindow[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    for (const r of rules) {
      const dow = r.day_of_week as DayOfWeek;
      out[dow].push({ start_minute: r.start_minute, end_minute: r.end_minute });
    }
    for (const k of Object.keys(out)) {
      out[Number(k) as DayOfWeek].sort(
        (a, b) => a.start_minute - b.start_minute,
      );
    }
    return out;
  }, [rules]);

  return (
    <div className="flex flex-col gap-3">
      {ALL_DAYS.map((d) => (
        <WeekdayRow
          key={d}
          dayOfWeek={d}
          initialWindows={allDays[d]}
          allDays={allDays}
        />
      ))}
    </div>
  );
}
