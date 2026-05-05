"use client";

import { useMemo } from "react";

import { Calendar } from "@/components/ui/calendar";

import type { DateOverrideRow } from "../_lib/types";

export interface OverridesCalendarProps {
  overrides: DateOverrideRow[];
  /** Called when user clicks any date — caller decides Add vs Edit based on whether the date already has an override. */
  onDayClick: (localDate: string) => void;
}

/** Parse "YYYY-MM-DD" into a local-midnight Date (browser TZ acceptable here —
 *  this is purely for the visual calendar; the Date never goes back to the
 *  server. The string identity is what's authoritative). */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a clicked Date back to "YYYY-MM-DD" using the LOCAL clock fields. */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export function OverridesCalendar({
  overrides,
  onDayClick,
}: OverridesCalendarProps) {
  const { blockedDates, unavailableDates } = useMemo(() => {
    const blocked: Date[] = [];
    const unavailable: Date[] = [];
    const seen = new Set<string>();
    for (const o of overrides) {
      // Mutual-exclusion lock from Plan 04-03 means a date should never have
      // both a is_closed row AND an unavailable-windows row, but if it does,
      // the engine treats it as blocked (Plan 04-02 lock). Mirror that here:
      // is_closed wins for the marker.
      if (seen.has(o.override_date)) continue;
      if (o.is_closed) {
        seen.add(o.override_date);
        blocked.push(parseLocalDate(o.override_date));
      } else {
        seen.add(o.override_date);
        unavailable.push(parseLocalDate(o.override_date));
      }
    }
    return { blockedDates: blocked, unavailableDates: unavailable };
  }, [overrides]);

  return (
    <Calendar
      mode="single"
      modifiers={{
        blocked: blockedDates,
        unavailable: unavailableDates,
      }}
      modifiersClassNames={{
        blocked: "day-blocked",
        unavailable: "day-custom",
      }}
      onDayClick={(day) => onDayClick(formatLocalDate(day))}
      className="rounded-md border"
    />
  );
}
