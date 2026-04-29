"use client";

import { useEffect, useState } from "react";
import type { AccountSummary, EventTypeSummary } from "../_lib/types";
import { SlotPicker, type Slot } from "./slot-picker";
import { BookingForm } from "./booking-form";
import { RaceLoserBanner } from "./race-loser-banner";

interface BookingShellProps {
  account: AccountSummary;
  eventType: EventTypeSummary;
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
  // Bumping refetchKey causes SlotPicker to re-fetch /api/slots immediately.
  // Used by the 409 race-loser path: slot was taken → show fresh availability.
  const [refetchKey, setRefetchKey] = useState(0);
  const [showRaceLoser, setShowRaceLoser] = useState(false);
  const [raceLoserMessage, setRaceLoserMessage] = useState<string | undefined>(undefined);

  /** Called by BookingForm when POST /api/bookings returns 409. */
  const handleRaceLoss = (message?: string) => {
    setSelectedSlot(null);
    setShowRaceLoser(true);
    setRaceLoserMessage(message);
    setRefetchKey((k) => k + 1);
    // Banner persists until the user picks a new slot — see handleSelectSlot.
  };

  /** Called by SlotPicker when user picks a time slot. */
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
      {/* Hero header: Cruip section rhythm py-12 md:py-20 */}
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

      {/* Slot-picker section: clean white card, max-w-3xl (UI-10 lock) */}
      <section className="mx-auto max-w-3xl px-6 pb-12 md:pb-20">
        <RaceLoserBanner visible={showRaceLoser} message={raceLoserMessage} />
        <div className="mt-4 rounded-2xl border bg-white shadow-sm">
          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_320px]">
            {/* Left panel: slot picker */}
            <SlotPicker
              eventTypeId={eventType.id}
              accountTimezone={account.timezone}
              bookerTimezone={bookerTz}
              ownerEmail={account.owner_email}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
              refetchKey={refetchKey}
            />

            {/* Right panel: booking form (shows when a slot is selected) */}
            <aside className="border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              {selectedSlot ? (
                <BookingForm
                  accountSlug={account.slug}
                  eventType={eventType}
                  selectedSlot={selectedSlot}
                  bookerTimezone={bookerTz}
                  onRaceLoss={handleRaceLoss}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pick a time on the left to continue.
                </p>
              )}
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
