"use client";

import { useEffect, useState, useTransition } from "react";
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { softDeleteEventTypeAction } from "../_lib/actions";

type CountState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; count: number }
  | { status: "error" };

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  eventTypeId,
  eventTypeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTypeId: string;
  eventTypeName: string;
}) {
  const router = useRouter();
  const [countState, setCountState] = useState<CountState>({ status: "idle" });
  const [confirmInput, setConfirmInput] = useState("");
  const [isPending, startTransition] = useTransition();

  // Lazy fetch booking count when the dialog opens (RESEARCH Open Q1).
  // Re-seed pattern: synchronizing local dialog state with parent's `open`
  // signal. Approved set-state-in-effect pattern (Plan 09-01 cleanup).
  useEffect(() => {
    if (!open) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountState({ status: "loading" });
    setConfirmInput("");

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("event_type_id", eventTypeId)
        .neq("status", "cancelled");

      if (cancelled) return;
      if (error) {
        setCountState({ status: "error" });
      } else {
        setCountState({ status: "ready", count: count ?? 0 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, eventTypeId]);

  async function handleConfirm() {
    startTransition(async () => {
      const result = await softDeleteEventTypeAction(eventTypeId);
      if (result.formError) {
        toast.error(result.formError);
      } else {
        toast.success("Event type archived.");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  const hasBookings =
    countState.status === "ready" && countState.count > 0;
  const confirmDisabled =
    isPending ||
    countState.status === "loading" ||
    countState.status === "error" ||
    (hasBookings && confirmInput !== eventTypeName);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Archive &ldquo;{eventTypeName}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {countState.status === "loading" && "Checking for bookings\u2026"}
            {countState.status === "error" &&
              "Couldn\u2019t load booking count. Refresh and try again."}
            {countState.status === "ready" && !hasBookings &&
              "The event type will be hidden from booking pages. You can restore it later from \u201cShow archived\u201d."}
            {countState.status === "ready" && hasBookings && (
              <>
                This event type has <strong>{countState.count}</strong>{" "}
                {countState.count === 1 ? "booking" : "bookings"}. Archiving
                preserves them. Type the event type&apos;s name to confirm.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {countState.status === "loading" && (
          <Skeleton className="h-9 w-full" />
        )}

        {countState.status === "ready" && hasBookings && (
          <div className="grid gap-2 py-2">
            <Label htmlFor="confirm-name">
              Type &ldquo;{eventTypeName}&rdquo; to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={confirmDisabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Archiving\u2026" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
