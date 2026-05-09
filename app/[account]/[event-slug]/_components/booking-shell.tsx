"use client";

import { useEffect, useState } from "react";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import type { AccountSummary, EventTypeSummary } from "../_lib/types";
import { type Slot } from "./slot-picker";
import { BookingForm } from "./booking-form";
import { RaceLoserBanner } from "./race-loser-banner";

interface BookingShellProps {
  account: AccountSummary;
  eventType: EventTypeSummary;
}

/** Format a Date back to "YYYY-MM-DD" using LOCAL clock fields (browser TZ). */
function dateToLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export function BookingShell({ account, eventType }: BookingShellProps) {
  // Browser TZ detected on mount; server-side render falls back to account.timezone.
  // MUST be in useEffect — Intl.DateTimeFormat on the server returns the server TZ.
  const [bookerTz, setBookerTz] = useState<string>(account.timezone);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Mount-only browser-TZ detection. setState-in-effect is correct here:
      // SSR uses account.timezone, client overrides on mount. Approved
      // synchronization-with-external-system pattern (the external system
      // is the browser's Intl resolved options).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (tz) setBookerTz(tz);
    } catch {
      // Keep account.timezone fallback — exotic browser/OS edge case.
    }
  }, []);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  // Bumping refetchKey causes the slot fetch effect to re-fire immediately.
  // Used by the 409 race-loser path: slot was taken → show fresh availability.
  const [refetchKey, setRefetchKey] = useState(0);
  const [showRaceLoser, setShowRaceLoser] = useState(false);
  const [raceLoserMessage, setRaceLoserMessage] = useState<string | undefined>(undefined);

  // --- Slot fetch state lifted from slot-picker.tsx (Phase 30 plan 30-01) ---
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Compute today and today+30 in booker TZ for range fetch.
  // Recomputed on render — intentional (day changes between renders handled correctly).
  const rangeFrom: string = (() => {
    const now = new TZDate(new Date(), bookerTz);
    return format(now, "yyyy-MM-dd");
  })();
  const rangeTo: string = (() => {
    const nowMs = new TZDate(new Date(), bookerTz).getTime();
    const plus30 = new Date(nowMs + 30 * 24 * 60 * 60 * 1000);
    return format(new TZDate(plus30, bookerTz), "yyyy-MM-dd");
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
      `/api/slots?event_type_id=${encodeURIComponent(eventType.id)}&from=${rangeFrom}&to=${rangeTo}`,
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
  }, [eventType.id, rangeFrom, rangeTo, refetchKey]);

  // Group slots by date in booker TZ for marker rendering + filtering on date click.
  const slotsByDate = new Map<string, Slot[]>();
  for (const s of slots) {
    const localDate = format(
      new TZDate(new Date(s.start_at), bookerTz),
      "yyyy-MM-dd",
    );
    if (!slotsByDate.has(localDate)) slotsByDate.set(localDate, []);
    slotsByDate.get(localDate)!.push(s);
  }
  const markedDates = new Set(slotsByDate.keys());

  const slotsForSelectedDate: Slot[] = selectedDate
    ? (slotsByDate.get(selectedDate) ?? [])
    : [];

  const isCompletelyEmpty = !loading && !fetchError && slots.length === 0;

  /** Called by BookingForm when POST /api/bookings returns 409. */
  const handleRaceLoss = (message?: string) => {
    setSelectedSlot(null);
    setShowRaceLoser(true);
    setRaceLoserMessage(message);
    setRefetchKey((k) => k + 1);
    // Banner persists until the user picks a new slot — see handleSelectSlot.
  };

  /** Called when user picks a time slot. */
  const handleSelectSlot = (s: Slot | null) => {
    setSelectedSlot(s);
    // Dismiss race-loser banner once the user has picked a fresh slot.
    if (s) {
      setShowRaceLoser(false);
      setRaceLoserMessage(undefined);
    }
  };

  return (
    <main className="mx-auto w-full">
      {/* Hero header — UNCHANGED. Keep max-w-3xl exactly. */}
      <header className="mx-auto max-w-3xl px-6 pt-12 pb-8 text-center md:pt-20 md:pb-12">
        <p className="text-sm font-medium text-gray-500 mb-2">{account.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
          {eventType.name}
        </h1>
        <p className="mt-3 text-sm text-gray-600 md:text-base">
          {eventType.duration_minutes} min
          {eventType.description ? ` · ${eventType.description}` : ""}
        </p>
      </header>

      {/* Booking section wrapper: max-w-3xl -> max-w-4xl (BOOKER-02) */}
      <section className="mx-auto max-w-4xl px-6 pb-12 md:pb-20">
        <RaceLoserBanner visible={showRaceLoser} message={raceLoserMessage} />
        <div className="mt-4 rounded-2xl border bg-white shadow-sm">
          {isCompletelyEmpty ? (
            // Empty-state lifted from slot-picker.tsx — rendered ABOVE the grid
            // when no slots exist in the entire 30-day window.
            <div className="p-8 text-center text-sm text-muted-foreground">
              {account.owner_email ? (
                <>
                  No times available right now &mdash; email{" "}
                  <a
                    className="underline hover:text-foreground transition-colors"
                    href={`mailto:${account.owner_email}`}
                  >
                    {account.owner_email}
                  </a>{" "}
                  to book directly.
                </>
              ) : (
                <>No times available right now. Try again later.</>
              )}
            </div>
          ) : (
            <>
              {/* Full-width timezone hint above the 3-col grid (V15-MP-04 preference) */}
              <p className="text-xs text-muted-foreground px-6 pt-6">
                Times shown in {bookerTz}
              </p>

              {/* 3-col grid: calendar | times | form. NO dividers, NO per-column tints. */}
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]">
                {/* Col 1: Calendar */}
                <Calendar
                  mode="single"
                  selected={
                    selectedDate
                      ? new Date(selectedDate + "T00:00:00")
                      : undefined
                  }
                  onSelect={(d) => {
                    if (!d) return;
                    setSelectedDate(dateToLocalYMD(d));
                    handleSelectSlot(null); // clear slot when date changes
                  }}
                  modifiers={{
                    hasSlots: (d) => markedDates.has(dateToLocalYMD(d)),
                  }}
                  modifiersClassNames={{ hasSlots: "day-has-slots" }}
                  className="justify-self-center rounded-md border"
                />

                {/* Col 2: Slot time list */}
                <div>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading times&hellip;</p>
                  ) : fetchError ? (
                    <p className="text-sm text-destructive">{fetchError}</p>
                  ) : !selectedDate ? (
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
                          new TZDate(new Date(s.start_at), bookerTz),
                          "h:mm a",
                        );
                        const isSelected = selectedSlot?.start_at === s.start_at;
                        return (
                          <li key={s.start_at}>
                            <button
                              type="button"
                              onClick={() => handleSelectSlot(s)}
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

                {/* Col 3: Form column — fixed 320px reserved at all times.
                    V15-MP-05 LOCK: placeholder is a <div>, NOT a mounted <BookingForm>.
                    Turnstile mounts on BookingForm mount (~2-min token expiry).
                    BookingForm has NO `key` prop — once mounted on first slot pick, it must
                    remain mounted across re-picks so RHF field values and the Turnstile
                    token persist (Phase 39 field-persistence guarantee + V15-MP-05). */}
                <div>
                  {selectedSlot ? (
                    <BookingForm
                      accountSlug={account.slug}
                      eventType={eventType}
                      selectedSlot={selectedSlot}
                      bookerTimezone={bookerTz}
                      onRaceLoss={handleRaceLoss}
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Pick a time on the left to continue.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
