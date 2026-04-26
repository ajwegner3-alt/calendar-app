"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelBookingAsOwner } from "../_lib/actions";

interface CancelButtonProps {
  bookingId: string;
  eventTypeName: string;
  /** Pre-formatted "Day, Mon DD, YYYY, h:mm a (z)" line for the dialog body */
  scheduledLine: string;
}

/**
 * Owner-side cancel control.
 *
 * UX (CONTEXT lock + delete-confirm-dialog.tsx pattern from Plan 03-04):
 *   - Trigger button is destructive variant
 *   - AlertDialog asks the owner to confirm
 *   - Optional reason Textarea — when non-empty, surfaces as a callout in the
 *     booker's apologetic cancellation email (Plan 06-02 EMAIL-07)
 *   - On confirm: invokes Server Action, await result, toast success/error
 *   - On success: dialog closes, router.refresh() ensures the cancelled-state
 *     read-only banner appears (the action also calls revalidatePath, but
 *     refresh() makes the UI swap feel instantaneous)
 *   - NO optimistic UI (CONTEXT lock — let the Server Action drive the state)
 */
export function CancelButton({
  bookingId,
  eventTypeName,
  scheduledLine,
}: CancelButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await cancelBookingAsOwner(bookingId, reason);
      if ("ok" in result && result.ok) {
        setOpen(false);
        setReason("");
        toast.success("Booking cancelled. Both parties have been notified.");
        router.refresh();
        return;
      }
      // Error path: keep dialog open so owner can retry or close manually
      const message =
        "error" in result ? result.error : "Cancel failed. Please try again.";
      toast.error(message);
      // If the booking is no longer active, refresh so the cancelled-state
      // banner can render — but ALSO close the dialog (no point keeping it open
      // when there is nothing to cancel anymore).
      if (
        "error" in result &&
        result.error.toLowerCase().includes("no longer active")
      ) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Cancel booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;re about to cancel <strong>{eventTypeName}</strong> on{" "}
            <strong>{scheduledLine}</strong>. The booker will receive an
            apologetic cancellation email with a link to book again. The
            calendar invite will be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label
            htmlFor="owner-cancel-reason"
            className="text-xs uppercase text-muted-foreground tracking-wide"
          >
            Reason for cancelling (optional)
          </Label>
          <Textarea
            id="owner-cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Conflict came up — happy to reschedule when you're ready."
            className="text-sm"
            disabled={isPending}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">
            If filled, this will be shown in the booker&apos;s email.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // prevent default close — we close manually after action resolves
              handleConfirm();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Cancelling\u2026" : "Yes, cancel booking"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
