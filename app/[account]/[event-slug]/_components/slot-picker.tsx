"use client";

import { useEffect, useState } from "react";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";

export interface Slot {
  start_at: string; // ISO UTC string
  end_at: string; // ISO UTC string
  remaining_capacity?: number; // CAP-08: present only when owner has show_remaining_capacity=true
}

interface SlotPickerProps {
  eventTypeId: string;
  accountTimezone: string; // owner TZ
  bookerTimezone: string; // detected; falls back to accountTimezone
  ownerEmail: string | null;
  selectedDate: string | null; // YYYY-MM-DD in booker tz
  onSelectDate: (d: string | null) => void;
  selectedSlot: Slot | null;
  onSelectSlot: (s: Slot | null) => void;
  refetchKey: number; // bump to trigger re-fetch (used by 409 UX)
}

/** Format a Date back to "YYYY-MM-DD" using LOCAL clock fields (browser TZ). */
function dateToLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export function SlotPicker(props: SlotPickerProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Compute today and today+30 in booker TZ for range fetch.
  // Recomputed on render — intentional (day changes between renders handled correctly).
  const rangeFrom: string = (() => {
    const now = new TZDate(new Date(), props.bookerTimezone);
    return format(now, "yyyy-MM-dd");
  })();
  const rangeTo: string = (() => {
    const nowMs = new TZDate(new Date(), props.bookerTimezone).getTime();
    const plus30 = new Date(nowMs + 30 * 24 * 60 * 60 * 1000);
    return format(new TZDate(plus30, props.bookerTimezone), "yyyy-MM-dd");
  })();

  useEffect(() => {
    let cancelled = false;
    // Canonical async-fetch effect: setLoading + setFetchError prep the UI for
    // the in-flight request; the .then/.catch callbacks update state
    // asynchronously (those are not "during render" — they fire after the
    // network resolves). External system: /api/slots HTTP endpoint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFetchError(null);
    fetch(
      `/api/slots?event_type_id=${encodeURIComponent(props.eventTypeId)}&from=${rangeFrom}&to=${rangeTo}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        const slotsData = (data as { slots?: Slot[] } | null)?.slots;
        setSlots(Array.isArray(slotsData) ? slotsData : []);
      })
      .catch(() => {
        if (!cancelled) setFetchError("Failed to load available times. Try refreshing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.eventTypeId, rangeFrom, rangeTo, props.refetchKey]);

  // Group slots by date in booker TZ for marker rendering + filtering on date click.
  const slotsByDate = new Map<string, Slot[]>();
  for (const s of slots) {
    const localDate = format(
      new TZDate(new Date(s.start_at), props.bookerTimezone),
      "yyyy-MM-dd",
    );
    if (!slotsByDate.has(localDate)) slotsByDate.set(localDate, []);
    slotsByDate.get(localDate)!.push(s);
  }
  const markedDates = new Set(slotsByDate.keys());

  const slotsForSelectedDate: Slot[] = props.selectedDate
    ? (slotsByDate.get(props.selectedDate) ?? [])
    : [];

  const isCompletelyEmpty = !loading && !fetchError && slots.length === 0;

  if (isCompletelyEmpty) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        {props.ownerEmail ? (
          <>
            No times available right now &mdash; email{" "}
            <a
              className="underline hover:text-foreground transition-colors"
              href={`mailto:${props.ownerEmail}`}
            >
              {props.ownerEmail}
            </a>{" "}
            to book directly.
          </>
        ) : (
          <>No times available right now. Try again later.</>
        )}
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-muted-foreground mb-3">
        Times shown in {props.bookerTimezone}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calendar: left on desktop, top on mobile */}
        <Calendar
          mode="single"
          selected={
            props.selectedDate
              ? new Date(props.selectedDate + "T00:00:00")
              : undefined
          }
          onSelect={(d) => {
            if (!d) return;
            props.onSelectDate(dateToLocalYMD(d));
            props.onSelectSlot(null); // clear slot when date changes
          }}
          modifiers={{
            hasSlots: (d) => markedDates.has(dateToLocalYMD(d)),
          }}
          modifiersClassNames={{ hasSlots: "day-has-slots" }}
          className="mx-auto rounded-md border"
        />

        {/* Slot list: right on desktop, below on mobile */}
        <div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading times&hellip;</p>
          ) : fetchError ? (
            <p className="text-sm text-destructive">{fetchError}</p>
          ) : !props.selectedDate ? (
            <p className="text-sm text-muted-foreground">
              Pick a date to see available times.
            </p>
          ) : slotsForSelectedDate.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No times available on this date.
            </p>
          ) : (
            <ul className="grid gap-2">
              {slotsForSelectedDate.map((s) => {
                const label = format(
                  new TZDate(new Date(s.start_at), props.bookerTimezone),
                  "h:mm a",
                );
                const isSelected = props.selectedSlot?.start_at === s.start_at;
                return (
                  <li key={s.start_at}>
                    <button
                      type="button"
                      onClick={() => props.onSelectSlot(s)}
                      className={
                        "w-full rounded-md border px-3 py-2 text-sm text-left font-medium transition-colors " +
                        (isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border")
                      }
                    >
                      {label}
                      {typeof s.remaining_capacity === "number" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.remaining_capacity === 1
                            ? "1 spot left"
                            : `${s.remaining_capacity} spots left`}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
