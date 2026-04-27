"use client";
import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SlotPicker, type Slot } from "@/app/[account]/[event-slug]/_components/slot-picker";

interface RescheduleShellProps {
  token: string;
  tokenHash: string; // not actually sent to client API; purely informational here. Server route re-hashes from token.
  accountSlug: string;
  accountTimezone: string;
  accountName: string;
  ownerEmail: string | null;
  eventTypeId: string;
  eventTypeSlug: string;
  eventTypeName: string;
  durationMinutes: number;
  oldStartAt: string;          // ISO UTC
  bookerTimezoneInitial: string; // SSR fallback; replaced on mount
}

export function RescheduleShell(props: RescheduleShellProps) {
  // Browser TZ detection (SSR fallback to bookerTimezoneInitial; mirror Phase 5 BookingShell)
  const [bookerTimezone, setBookerTimezone] = useState(props.bookerTimezoneInitial);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Mount-only browser-TZ detection — same pattern as Phase 5 BookingShell.
      // External system: browser Intl resolved options.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (tz) setBookerTimezone(tz);
    } catch {
      // keep SSR fallback
    }
  }, []);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [raceBanner, setRaceBanner] = useState<string | null>(null);

  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  async function handleSubmit() {
    if (!selectedSlot) {
      toast.error("Pick a new time first.");
      return;
    }
    // Note: this route (POST /api/reschedule) does NOT verify Turnstile in v1 —
    // CONTEXT decision matches the cancel route (rate-limit only). The Turnstile
    // widget is included for parity with Phase 5 BookingForm UX and to give us
    // the option to enable verification in Phase 8 hardening with no UI change.
    setSubmitting(true);
    setRaceBanner(null);
    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          startAt: selectedSlot.start_at,
          endAt: selectedSlot.end_at,
        }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (res.status === 409 && body?.code === "SLOT_TAKEN") {
        // Race-loser flow (mirror Phase 5)
        setRaceBanner(body.error ?? "That time was just booked. Pick a new time below.");
        setRefetchKey((k) => k + 1);
        setSelectedSlot(null);
        turnstileRef.current?.reset();
      } else if (res.status === 429) {
        toast.error("Too many requests. Please try again in a few minutes.");
        turnstileRef.current?.reset();
      } else if (res.status === 410) {
        // NOT_ACTIVE — reload to show TokenNotActive page
        toast.error(body?.error ?? "This link is no longer active.");
        window.location.reload();
      } else if (res.status === 400) {
        toast.error(body?.error ?? "Invalid slot. Please try another.");
        turnstileRef.current?.reset();
      } else {
        toast.error(body?.error ?? "Reschedule failed. Please try again.");
        turnstileRef.current?.reset();
      }
    } catch {
      toast.error("Network error. Please try again.");
      turnstileRef.current?.reset();
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <h2 className="text-lg font-semibold mb-2">Booking rescheduled</h2>
        <p className="text-sm text-muted-foreground">
          We sent updated calendar invites. Check your email for the new details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {raceBanner ? (
        <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          {raceBanner}
        </div>
      ) : null}

      <SlotPicker
        eventTypeId={props.eventTypeId}
        accountTimezone={props.accountTimezone}
        bookerTimezone={bookerTimezone}
        ownerEmail={props.ownerEmail}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        selectedSlot={selectedSlot}
        onSelectSlot={setSelectedSlot}
        refetchKey={refetchKey}
      />

      {siteKey ? (
        <div className="pt-2">
          <Turnstile ref={turnstileRef} siteKey={siteKey} />
        </div>
      ) : null}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !selectedSlot}
        className="w-full"
        style={{
          background: "var(--brand-primary, #0A2540)",
          color: "var(--brand-text, #ffffff)",
        }}
      >
        {submitting ? "Rescheduling\u2026" : selectedSlot ? "Confirm new time" : "Pick a new time first"}
      </Button>
    </div>
  );
}
