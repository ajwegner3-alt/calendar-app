"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  upsertDateOverrideAction,
  deleteDateOverrideAction,
} from "../_lib/actions";
import {
  previewAffectedBookingsAction,
  commitInverseOverrideAction,
} from "../_lib/actions-batch-cancel";
import type { AffectedBooking } from "../_lib/queries";
import type { DateOverrideRow, TimeWindow } from "../_lib/types";

import { TimeWindowPicker } from "./time-window-picker";

export interface OverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "YYYY-MM-DD" — the date the user clicked, or null when adding without a date pre-selected */
  initialDate: string | null;
  /** All existing override rows for this account (used to seed Edit mode) */
  allOverrides: DateOverrideRow[];
  /** IANA tz (e.g. "America/Chicago") used to format affected-booking times */
  accountTimezone: string;
}

const DEFAULT_WINDOW: TimeWindow = { start_minute: 540, end_minute: 1020 };

type Mode = "block" | "unavailable";

/**
 * Modal commit-flow state machine (Phase 32 Plan 02):
 *   editing         — owner is editing the form; Save triggers preview
 *   preview-loading — previewAffectedBookingsAction is in flight
 *   preview-ready   — affected list rendered; Confirm/Back visible
 *
 * The "no-affected-bookings fast path" skips preview-ready and goes straight
 * to upsertDateOverrideAction → close → toast (the snappy UX for the most
 * common case where the owner is blocking a future date with no bookings).
 */
type CommitState = "editing" | "preview-loading" | "preview-ready";

function existingFor(
  allOverrides: DateOverrideRow[],
  date: string,
): { mode: Mode; windows: TimeWindow[]; note: string } | null {
  const rows = allOverrides.filter((o) => o.override_date === date);
  if (rows.length === 0) return null;
  const blocked = rows.find((r) => r.is_closed);
  if (blocked) {
    return { mode: "block", windows: [], note: blocked.note ?? "" };
  }
  const windows = rows
    .filter((r) => r.start_minute !== null && r.end_minute !== null)
    .map((r) => ({
      start_minute: r.start_minute as number,
      end_minute: r.end_minute as number,
    }))
    .sort((a, b) => a.start_minute - b.start_minute);
  return { mode: "unavailable", windows, note: rows[0].note ?? "" };
}

function formatLocalTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(new Date(iso));
}

export function OverrideModal({
  open,
  onOpenChange,
  initialDate,
  allOverrides,
  accountTimezone,
}: OverrideModalProps) {
  const router = useRouter();

  const [date, setDate] = useState<string>("");
  const [mode, setMode] = useState<Mode>("block");
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Phase 32: preview + quota gate state
  const [commitState, setCommitState] = useState<CommitState>("editing");
  const [affected, setAffected] = useState<AffectedBooking[]>([]);
  const [remainingQuota, setRemainingQuota] = useState<number>(0);

  // Re-seed state every time the modal opens (initialDate may change).
  // External system being synchronized: the parent's open/initialDate props.
  // setState-in-effect is the React-team-approved pattern for "reset child
  // state when a key prop changes" — see https://react.dev/reference/react/useState#resetting-state-with-a-key (alternative remount key would unmount the
  // entire dialog tree on every open, breaking exit animations).
  useEffect(() => {
    if (!open) return;
    const seedDate = initialDate ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(seedDate);
    setError(null);
    setCommitState("editing");
    setAffected([]);
    if (seedDate) {
      const existing = existingFor(allOverrides, seedDate);
      if (existing) {
        setMode(existing.mode);
        setWindows(existing.windows);
        setNote(existing.note);
      } else {
        setMode("block");
        setWindows([{ ...DEFAULT_WINDOW }]);
        setNote("");
      }
    } else {
      setMode("block");
      setWindows([{ ...DEFAULT_WINDOW }]);
      setNote("");
    }
  }, [open, initialDate, allOverrides]);

  const isEdit = !!(date && existingFor(allOverrides, date));
  const quotaError =
    commitState === "preview-ready" && affected.length > remainingQuota;

  function save() {
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Pick a valid date.");
      return;
    }

    // Step 1: preview affected bookings + remaining quota.
    setCommitState("preview-loading");
    startTransition(async () => {
      const previewInput =
        mode === "block"
          ? {
              isFullDayBlock: true as const,
              override_date: date,
              unavailableWindows: [] as TimeWindow[],
            }
          : {
              isFullDayBlock: false as const,
              override_date: date,
              unavailableWindows: windows,
            };

      const preview = await previewAffectedBookingsAction(previewInput);
      if (!preview.ok) {
        setCommitState("editing");
        setError(preview.error);
        toast.error(preview.error);
        return;
      }

      // Fast path: no confirmed bookings inside the proposed windows. Skip the
      // preview UI entirely and call the existing upsertDateOverrideAction
      // (no quota gate needed — it sends nothing).
      if (preview.affected.length === 0) {
        const payload =
          mode === "block"
            ? {
                type: "block" as const,
                override_date: date,
                note: note || undefined,
              }
            : {
                type: "unavailable" as const,
                override_date: date,
                windows,
                note: note || undefined,
              };

        const result = await upsertDateOverrideAction(payload);
        if (result.formError) {
          setCommitState("editing");
          toast.error(result.formError);
          setError(result.formError);
          return;
        }
        if (result.fieldErrors?.windows?.[0]) {
          setCommitState("editing");
          toast.error(result.fieldErrors.windows[0]);
          setError(result.fieldErrors.windows[0]);
          return;
        }
        toast.success(isEdit ? "Override updated." : "Override added.");
        router.refresh();
        onOpenChange(false);
        return;
      }

      // Slow path: at least one confirmed booking will be cancelled. Show the
      // inline preview + quota gate; owner must Confirm to proceed.
      setAffected(preview.affected);
      setRemainingQuota(preview.remainingQuota);
      setCommitState("preview-ready");
    });
  }

  function handleConfirm() {
    if (quotaError) return; // belt-and-suspenders; button is also disabled

    startTransition(async () => {
      const result = await commitInverseOverrideAction({
        isFullDayBlock: mode === "block",
        override_date: date,
        unavailableWindows: mode === "unavailable" ? windows : [],
        affectedBookingIds: affected.map((b) => b.id),
        reason: note || undefined,
      });

      if (!result.ok) {
        if ("quotaError" in result) {
          // Quota drifted between preview and confirm — refresh the UI gate.
          setRemainingQuota(result.remaining);
          // affected may have grown via race-safe re-query; keep the user's
          // approved list as-is (they can click Save again if they want a
          // fresh preview).
          toast.error(
            `Quota changed. ${result.needed} email${result.needed === 1 ? "" : "s"} needed, ${result.remaining} remaining today.`,
          );
          return;
        }
        toast.error(result.formError);
        return;
      }

      const cancelMsg =
        result.cancelledCount > 0
          ? `Saved. Cancelled ${result.cancelledCount} booking${result.cancelledCount === 1 ? "" : "s"}.`
          : "Saved.";
      toast.success(cancelMsg);
      if (result.emailFailures.length > 0) {
        toast.warning(
          `${result.emailFailures.length} email${result.emailFailures.length === 1 ? "" : "s"} failed to send. Check the bookings page.`,
        );
      }
      router.refresh();
      onOpenChange(false);
    });
  }

  function remove() {
    if (!isEdit) return;
    startTransition(async () => {
      const result = await deleteDateOverrideAction(date);
      if (result.formError) {
        toast.error(result.formError);
        return;
      }
      toast.success("Override removed.");
      router.refresh();
      onOpenChange(false);
    });
  }

  const showWindowsList = mode === "unavailable";
  const inPreview = commitState === "preview-ready";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit override" : "Add override"}</DialogTitle>
          <DialogDescription>
            Block an entire day or block specific time windows just for that
            date.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-date">Date</Label>
            <Input
              id="override-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isPending || isEdit || inPreview}
            />
            {isEdit && (
              <p className="text-muted-foreground text-xs">
                To change the date, remove this override and add a new one.
              </p>
            )}
          </div>

          {/* Mode tabs implemented as two buttons (no shadcn Tabs primitive
              installed; two-button toggle is sufficient and avoids an extra
              dep). Phase 32: "Block entire day" and "Add unavailable windows"
              — toggle hides+preserves the windows list state. */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "block" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("block")}
              disabled={isPending || inPreview}
            >
              Block entire day
            </Button>
            <Button
              type="button"
              variant={mode === "unavailable" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode("unavailable");
                if (windows.length === 0) setWindows([{ ...DEFAULT_WINDOW }]);
              }}
              disabled={isPending || inPreview}
            >
              Add unavailable windows
            </Button>
          </div>

          {showWindowsList && (
            <div className="flex flex-col gap-2">
              <Label>Unavailable windows</Label>
              <p className="text-muted-foreground text-xs">
                These windows will be blocked. Slots inside these times
                won&apos;t appear on your booking page.
              </p>
              {windows.map((w, i) => (
                <TimeWindowPicker
                  key={i}
                  start_minute={w.start_minute}
                  end_minute={w.end_minute}
                  onChange={(next) =>
                    setWindows((prev) =>
                      prev.map((x, j) => (j === i ? next : x)),
                    )
                  }
                  onRemove={
                    windows.length > 1
                      ? () => setWindows((prev) => prev.filter((_, j) => j !== i))
                      : undefined
                  }
                  disabled={isPending || inPreview}
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() =>
                  setWindows((prev) => [...prev, { ...DEFAULT_WINDOW }])
                }
                disabled={isPending || inPreview}
              >
                <Plus className="mr-2 size-4" />
                Add window
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-note">Note (optional)</Label>
            <Textarea
              id="override-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="e.g. Vacation, Trade show"
              disabled={isPending || inPreview}
            />
          </div>

          {error && !inPreview && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          {inPreview && (
            <div className="border-t mt-2 pt-4 flex flex-col gap-2">
              <p className="text-sm font-medium">
                Saving will cancel {affected.length} booking
                {affected.length === 1 ? "" : "s"}:
              </p>
              <ul
                className="space-y-2 max-h-64 overflow-y-auto"
                aria-label="Affected bookings"
              >
                {affected.map((b) => (
                  <li
                    key={b.id}
                    className="text-sm flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                  >
                    <span className="font-medium">{b.booker_name}</span>
                    <span className="text-muted-foreground">
                      {formatLocalTime(b.start_at, accountTimezone)} &ndash;{" "}
                      {formatLocalTime(b.end_at, accountTimezone)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {b.event_type_name}
                    </span>
                  </li>
                ))}
              </ul>

              {quotaError && (
                <p className="text-sm text-red-600 mt-2" role="alert">
                  {affected.length} email{affected.length === 1 ? "" : "s"}{" "}
                  needed, {remainingQuota} remaining today. Quota resets at UTC
                  midnight. Wait until tomorrow or contact bookers manually.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {isEdit && !inPreview ? (
            <Button
              type="button"
              variant="ghost"
              onClick={remove}
              disabled={isPending}
            >
              Remove override
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {inPreview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCommitState("editing")}
                  disabled={isPending}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={quotaError || isPending}
                >
                  {isPending
                    ? "Cancelling..."
                    : `Confirm — cancel ${affected.length} booking${affected.length === 1 ? "" : "s"}`}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={save} disabled={isPending}>
                  {isPending
                    ? "Saving..."
                    : isEdit
                      ? "Update"
                      : "Add override"}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
