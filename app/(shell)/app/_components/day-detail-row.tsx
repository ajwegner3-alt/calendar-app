"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cancelBookingAsOwner } from "@/app/(shell)/app/bookings/[id]/_lib/actions";
import { sendReminderForBookingAction } from "@/app/(shell)/app/bookings/[id]/_lib/actions";
import { regenerateRescheduleTokenAction } from "@/app/(shell)/app/_lib/regenerate-reschedule-token";
import type { MonthBooking } from "../_lib/load-month-bookings";

interface DayDetailRowProps {
  booking: MonthBooking;
  /** IANA timezone string, e.g. 'America/Chicago' */
  accountTimezone: string;
}

/**
 * DayDetailRow — one booking entry in the DayDetailSheet drawer.
 *
 * Shows: booker name, start time formatted in account timezone, event-type name.
 * Provides 4 actions:
 *   1. View — Link to /app/bookings/{id} (no confirmation)
 *   2. Cancel — AlertDialog confirmation + cancelBookingAsOwner
 *   3. Copy reschedule link — AlertDialog warns about token rotation +
 *      regenerateRescheduleTokenAction; copies URL to clipboard or falls back
 *      to an inline copyable input.
 *   4. Send reminder — AlertDialog warns about token rotation +
 *      sendReminderForBookingAction
 *
 * Phase 7 pitfall lock: no Tailwind dynamic classes for runtime values.
 * CONTEXT lock: no optimistic UI; Server Actions drive all state.
 */
export function DayDetailRow({ booking, accountTimezone }: DayDetailRowProps) {
  const router = useRouter();

  // --- Cancel ---
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPending, startCancelTransition] = useTransition();

  // --- Copy reschedule link ---
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reschedulePending, startRescheduleTransition] = useTransition();
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  // --- Send reminder ---
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderPending, startReminderTransition] = useTransition();
  // Phase 31 (EMAIL-24): inline error rendered in the AlertDialog footer when
  // sendReminderForBookingAction returns errorCode "EMAIL_QUOTA_EXCEEDED". The
  // locked CONTEXT decision says: NEVER toast the quota error here — render it
  // inline alongside the Send button so the owner sees the Gmail-fallback hint
  // without dismissing the dialog.
  const [reminderError, setReminderError] = useState<string | null>(null);

  // Format the start time in the owner's account timezone
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: accountTimezone,
  }).format(new Date(booking.start_at));

  function handleCancelConfirm() {
    startCancelTransition(async () => {
      const result = await cancelBookingAsOwner(booking.id);
      if ("ok" in result && result.ok) {
        setCancelOpen(false);
        toast.success("Booking cancelled.");
        router.refresh();
        return;
      }
      const message =
        "error" in result ? result.error : "Cancel failed. Please try again.";
      toast.error(message);
      // If booking is already inactive, close the dialog and refresh
      if (
        "error" in result &&
        result.error.toLowerCase().includes("no longer active")
      ) {
        setCancelOpen(false);
        router.refresh();
      }
    });
  }

  function handleRescheduleConfirm() {
    startRescheduleTransition(async () => {
      const result = await regenerateRescheduleTokenAction(booking.id);
      if (result.ok && result.rawToken) {
        const url = `${window.location.origin}/reschedule/${result.rawToken}`;
        setRescheduleOpen(false);
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Reschedule link copied.");
        } catch {
          // Clipboard blocked — show inline fallback input
          setFallbackUrl(url);
          toast("Copy the link below.", { description: "Clipboard write was blocked by the browser." });
        }
        return;
      }
      const message = result.error ?? "Failed to generate link. Please try again.";
      toast.error(message);
    });
  }

  function handleReminderConfirm() {
    setReminderError(null);
    startReminderTransition(async () => {
      const result = await sendReminderForBookingAction(booking.id);
      if ("ok" in result && result.ok) {
        setReminderOpen(false);
        toast.success("Reminder sent.");
        return;
      }
      // Phase 31 (EMAIL-24): quota refusal renders inline (NOT a toast) so the
      // owner can read the Gmail-fallback hint while the dialog is still open.
      // The action's error string already contains the Gmail-fallback wording —
      // do not duplicate it here.
      if ("errorCode" in result && result.errorCode === "EMAIL_QUOTA_EXCEEDED") {
        setReminderError(result.error);
        return;
      }
      const message =
        "error" in result ? result.error : "Reminder failed. Please try again.";
      toast.error(message);
    });
  }

  return (
    <div className="py-3">
      {/* Booking metadata */}
      <div className="mb-2">
        <p className="text-sm font-medium text-foreground">{booking.booker_name}</p>
        <p className="text-xs text-muted-foreground">
          {formattedTime} &middot; {booking.event_type.name}
        </p>
      </div>

      {/* Clipboard fallback: inline copyable input (shown when clipboard API blocked) */}
      {fallbackUrl && (
        <div className="mb-2">
          <input
            readOnly
            value={fallbackUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full rounded border border-input bg-muted px-2 py-1 text-xs font-mono text-foreground"
            aria-label="Reschedule link — select to copy"
          />
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 1. View */}
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/bookings/${booking.id}`}>View</Link>
        </Button>

        {/* 2. Cancel */}
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Cancel
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
              <AlertDialogDescription>
                You&apos;re about to cancel{" "}
                <strong>{booking.booker_name}</strong>&apos;s booking at{" "}
                <strong>{formattedTime}</strong>. They will receive a
                cancellation email.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelPending}>
                Keep booking
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleCancelConfirm();
                }}
                disabled={cancelPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cancelPending ? "Cancelling…" : "Yes, cancel"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 3. Copy reschedule link */}
        <AlertDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm">
              Copy reschedule link
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Generate a new reschedule link?</AlertDialogTitle>
              <AlertDialogDescription>
                This will invalidate the link we previously emailed to{" "}
                <strong>{booking.booker_name}</strong>. They&apos;ll only be
                able to reschedule via the new link.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={reschedulePending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleRescheduleConfirm();
                }}
                disabled={reschedulePending}
              >
                {reschedulePending ? "Generating…" : "Generate & copy"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 4. Send reminder */}
        <AlertDialog
          open={reminderOpen}
          onOpenChange={(next) => {
            setReminderOpen(next);
            // Phase 31: clear the inline quota error whenever the dialog opens
            // or closes, so a stale message from a previous attempt never
            // lingers across opens.
            if (!next || next) setReminderError(null);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm">
              Send reminder
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send a reminder email now?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{booking.booker_name}</strong> will receive a reminder
                for this booking. This rotates the cancel and reschedule tokens
                — the links from previous emails will stop working.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {/* Phase 31 (EMAIL-24): inline quota error — renders in the footer
                area only when the action returned errorCode EMAIL_QUOTA_EXCEEDED.
                NEVER toasted, per locked CONTEXT decision. */}
            {reminderError && (
              <p
                className="text-sm text-red-600 mt-2"
                role="alert"
                data-testid="reminder-quota-error"
              >
                {reminderError}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={reminderPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleReminderConfirm();
                }}
                disabled={reminderPending}
              >
                {reminderPending ? "Sending…" : "Send reminder"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
