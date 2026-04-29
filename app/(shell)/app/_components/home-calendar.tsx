"use client";
import { useState } from "react";
import type { DayButtonProps } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import type { MonthBooking } from "../_lib/load-month-bookings";

interface HomeCalendarProps {
  bookings: MonthBooking[];
  /** 12-04b passes a callback that opens the day-detail Sheet drawer. */
  onDayClick?: (date: Date, dayBookings: MonthBooking[]) => void;
}

/**
 * HomeCalendar
 *
 * Wraps shadcn/ui Calendar (which wraps react-day-picker v9) with a custom
 * DayButton that renders capped booking-dot indicators:
 *   - 1, 2, or 3 dots for days with 1-3 confirmed bookings
 *   - 3 dots + "+N" for days with >3 bookings
 *
 * Date grouping uses UTC date keys (YYYY-MM-DD from ISO slice). v1.2 can
 * upgrade to account timezone bucketing when needed.
 *
 * onDayClick is wired for 12-04b drawer integration. In this plan it has no
 * consumer, so clicking updates visual selection state but opens nothing.
 *
 * Phase 7 pitfall LOCKED: no Tailwind dynamic classes for runtime values;
 * all runtime hex via inline style only (dots use CSS var, not runtime hex).
 */
export function HomeCalendar({ bookings, onDayClick }: HomeCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    undefined,
  );

  // Group bookings by YYYY-MM-DD (UTC slice).
  // v1.2: bucket by account IANA timezone using TZDate for precision.
  const byDay = new Map<string, MonthBooking[]>();
  for (const b of bookings) {
    const key = new Date(b.start_at).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(b);
  }

  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={(date) => {
        if (!date) return;
        setSelectedDate(date);
        const key = date.toISOString().slice(0, 10);
        const dayBookings = byDay.get(key) ?? [];
        onDayClick?.(date, dayBookings);
      }}
      className="w-full"
      components={{
        DayButton: (props: DayButtonProps) => {
          const { day, modifiers, className, ...buttonProps } = props;
          const dateKey = day.date.toISOString().slice(0, 10);
          const count = byDay.get(dateKey)?.length ?? 0;
          const isSelected =
            modifiers.selected &&
            !modifiers.range_start &&
            !modifiers.range_end &&
            !modifiers.range_middle;

          return (
            <button
              type="button"
              {...buttonProps}
              className={[
                "relative isolate z-10 flex aspect-square w-full min-w-[var(--cell-size,theme(spacing.9))] flex-col items-center justify-center gap-0.5 rounded-[var(--cell-radius,var(--radius-md))] border-0 text-sm leading-none font-normal",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : modifiers.today
                    ? "bg-muted text-foreground"
                    : "",
                modifiers.outside ? "text-muted-foreground opacity-50" : "",
                modifiers.disabled ? "opacity-50 pointer-events-none" : "",
                className ?? "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="text-sm leading-none">
                {day.date.getDate()}
              </span>
              {count > 0 && (
                <span className="flex items-center gap-0.5 h-1.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span
                      key={i}
                      className="h-1 w-1 rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? "currentColor"
                          : "var(--brand-primary, hsl(var(--primary)))",
                      }}
                    />
                  ))}
                  {count > 3 && (
                    <span
                      className="text-[9px] leading-none ml-0.5"
                      style={{ opacity: 0.75 }}
                    >
                      +{count - 3}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        },
      }}
    />
  );
}
