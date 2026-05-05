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
import type { DateOverrideRow, TimeWindow } from "../_lib/types";

import { TimeWindowPicker } from "./time-window-picker";

export interface OverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "YYYY-MM-DD" — the date the user clicked, or null when adding without a date pre-selected */
  initialDate: string | null;
  /** All existing override rows for this account (used to seed Edit mode) */
  allOverrides: DateOverrideRow[];
}

const DEFAULT_WINDOW: TimeWindow = { start_minute: 540, end_minute: 1020 };

type Mode = "block" | "unavailable";

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

export function OverrideModal({
  open,
  onOpenChange,
  initialDate,
  allOverrides,
}: OverrideModalProps) {
  const router = useRouter();

  const [date, setDate] = useState<string>("");
  const [mode, setMode] = useState<Mode>("block");
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function save() {
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Pick a valid date.");
      return;
    }

    startTransition(async () => {
      const payload =
        mode === "block"
          ? { type: "block" as const, override_date: date, note: note || undefined }
          : {
              type: "unavailable" as const,
              override_date: date,
              windows,
              note: note || undefined,
            };

      const result = await upsertDateOverrideAction(payload);
      if (result.formError) {
        toast.error(result.formError);
        setError(result.formError);
        return;
      }
      if (result.fieldErrors?.windows?.[0]) {
        toast.error(result.fieldErrors.windows[0]);
        setError(result.fieldErrors.windows[0]);
        return;
      }
      toast.success(isEdit ? "Override updated." : "Override added.");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit override" : "Add override"}</DialogTitle>
          <DialogDescription>
            Block a specific day or replace its hours just for that date.
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
              disabled={isPending || isEdit}
            />
            {isEdit && (
              <p className="text-muted-foreground text-xs">
                To change the date, remove this override and add a new one.
              </p>
            )}
          </div>

          {/* Mode tabs implemented as two buttons (no shadcn Tabs primitive
              installed; two-button toggle is sufficient and avoids an extra dep). */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "block" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("block")}
              disabled={isPending}
            >
              Block this day
            </Button>
            <Button
              type="button"
              variant={mode === "unavailable" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode("unavailable");
                if (windows.length === 0) setWindows([{ ...DEFAULT_WINDOW }]);
              }}
              disabled={isPending}
            >
              Custom hours
            </Button>
          </div>

          {mode === "unavailable" && (
            <div className="flex flex-col gap-2">
              <Label>Time windows</Label>
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
                  disabled={isPending}
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
                disabled={isPending}
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
              disabled={isPending}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {isEdit ? (
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
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Update" : "Add override"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
