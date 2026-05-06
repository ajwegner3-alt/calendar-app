"use client";

/**
 * Phase 33 — PushbackDialog.
 *
 * Plan 33-01 built the editing state + 5-state shell.
 * Plan 33-02 wires the real preview: handlePreview calls previewPushbackAction,
 *   transitions editing → preview-loading → preview-ready, renders
 *   MOVE/ABSORBED/PAST_EOD badges + quota indicator + verbatim Phase 31 error.
 * Plan 33-03 will fill in handleConfirm (commit path).
 * Plan 33-04 will render the summary state (per-row Sent/Failed/Skipped).
 *
 * Note: shadcn RadioGroup is not installed in this project. Anchor selection
 * uses accessible native <input type="radio"> with the same visual treatment
 * (radio-column layout, keyboard nav, screen-reader labels). Deviation logged
 * in Plan 33-01 SUMMARY.md.
 */

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  getBookingsForPushbackAction,
  previewPushbackAction,
} from "../_lib/actions-pushback";
import type { PushbackBooking } from "../_lib/queries";
import type { CascadeRow, CascadeStatus } from "@/lib/bookings/pushback";

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Five-state machine for the pushback dialog lifecycle.
 *   editing         — owner is filling the form (Plan 33-01)
 *   preview-loading — cascade preview is being computed (Plan 33-02)
 *   preview-ready   — cascade preview is shown; owner can Confirm (Plan 33-02)
 *   committing      — commit in flight (Plan 33-03)
 *   summary         — per-booking result summary (Plan 33-04)
 */
export type PushbackDialogState =
  | "editing"
  | "preview-loading"
  | "preview-ready"
  | "committing"
  | "summary";

export type DelayUnit = "min" | "hr";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PushbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountTimezone: string;
  /** YYYY-MM-DD in accountTimezone — pre-filled date when dialog opens */
  initialDate: string;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Format a UTC ISO timestamp as a local time in the given IANA tz. */
function formatLocalTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(new Date(iso));
}

/** Compute today's date as YYYY-MM-DD in the given IANA tz (client-side). */
function todayInTz(timezone: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isValidDelay(s: string): boolean {
  const n = Number(s);
  return Number.isInteger(n) && n > 0;
}

// ─── CascadeBadge ─────────────────────────────────────────────────────────────

/**
 * Colored badge for each cascade row status.
 *   MOVE     → blue (booking will be rescheduled)
 *   ABSORBED → slate (gap absorbed the push; no change)
 *   PAST_EOD → amber + warning icon (moved past end-of-day; does NOT block commit per PUSH-07)
 */
function CascadeBadge({ status }: { status: CascadeStatus }) {
  if (status === "MOVE") {
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 shrink-0">
        MOVE
      </span>
    );
  }
  if (status === "ABSORBED") {
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-600 shrink-0">
        ABSORBED
      </span>
    );
  }
  // PAST_EOD: amber + warning icon
  return (
    <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800 inline-flex items-center gap-1 shrink-0">
      <span aria-hidden>&#9888;</span> PAST EOD
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PushbackDialog({
  open,
  onOpenChange,
  accountId,
  accountTimezone,
  initialDate,
}: PushbackDialogProps) {
  const [state, setState] = useState<PushbackDialogState>("editing");
  const [date, setDate] = useState(initialDate);
  const [bookings, setBookings] = useState<PushbackBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [delayValue, setDelayValue] = useState<string>("15");
  const [delayUnit, setDelayUnit] = useState<DelayUnit>("min");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // Preview state — populated by previewPushbackAction
  const [previewRows, setPreviewRows] = useState<CascadeRow[]>([]);
  const [movedCount, setMovedCount] = useState(0);
  const [remainingQuota, setRemainingQuota] = useState(0);
  const [quotaError, setQuotaError] = useState(false);

  // Re-seed state whenever the modal opens or initialDate prop changes.
  // Pattern: setState-in-useEffect (avoids full unmount/remount of dialog tree
  // which would break exit animations). Matches override-modal.tsx line 116.
  useEffect(() => {
    if (!open) return;
    setState("editing");
    setDate(initialDate);
    setReason("");
    setDelayValue("15");
    setDelayUnit("min");
    setAnchorId(null);
    setBookings([]);
    setPreviewRows([]);
    setMovedCount(0);
    setRemainingQuota(0);
    setQuotaError(false);
  }, [open, initialDate]);

  // Fetch bookings whenever open state or date changes.
  // useTransition keeps the UI responsive while the server action is in flight.
  useEffect(() => {
    if (!open || !date) return;
    setBookingsLoading(true);
    startTransition(async () => {
      const result = await getBookingsForPushbackAction({
        accountId,
        date,
        accountTimezone,
      });
      if (result.ok) {
        setBookings(result.bookings);
        // Default anchor: first (earliest) booking per CONTEXT.md decision.
        setAnchorId(result.bookings[0]?.id ?? null);
      } else {
        setBookings([]);
        setAnchorId(null);
      }
      setBookingsLoading(false);
    });
  }, [open, date, accountId, accountTimezone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Today in account timezone (for date-picker min attribute — computed
  // client-side here since this is a client component).
  const todayLocal = todayInTz(accountTimezone);

  const canPreview =
    !!anchorId && isValidDelay(delayValue) && bookings.length > 0;

  // ── handlePreview ────────────────────────────────────────────────────────────
  // Replaces the Plan 33-01 stub. Calls previewPushbackAction and transitions
  // editing → preview-loading → preview-ready (or back to editing on error).

  function handlePreview() {
    setState("preview-loading");
    startTransition(async () => {
      const delayMinutes =
        delayUnit === "hr" ? Number(delayValue) * 60 : Number(delayValue);

      const result = await previewPushbackAction({
        accountId,
        date,
        accountTimezone,
        anchorId: anchorId!, // canPreview guard ensures non-null
        delayMinutes,
        reason: reason || undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        setState("editing");
        return;
      }

      setPreviewRows(result.rows);
      setMovedCount(result.movedCount);
      setRemainingQuota(result.remainingQuota);
      setQuotaError(result.quotaError);
      setState("preview-ready");
    });
  }

  // ── handleConfirm ────────────────────────────────────────────────────────────
  // Stub — Plan 33-03 will replace this with the real commitPushbackAction call.

  async function handleConfirm() {
    toast.info("Commit path lands in Plan 33-03");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pushback bookings</DialogTitle>
        </DialogHeader>

        {/* ── Editing state — full form ── */}
        {state === "editing" && (
          <EditingForm
            date={date}
            setDate={setDate}
            todayLocal={todayLocal}
            bookings={bookings}
            bookingsLoading={bookingsLoading}
            anchorId={anchorId}
            setAnchorId={setAnchorId}
            delayValue={delayValue}
            setDelayValue={setDelayValue}
            delayUnit={delayUnit}
            setDelayUnit={setDelayUnit}
            reason={reason}
            setReason={setReason}
            accountTimezone={accountTimezone}
          />
        )}

        {/* ── Preview-loading state ── */}
        {state === "preview-loading" && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Computing preview…
          </div>
        )}

        {/* ── Preview-ready state — cascade rows + quota indicator ── */}
        {state === "preview-ready" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {movedCount} booking{movedCount === 1 ? "" : "s"} will be moved.
              {previewRows.length - movedCount > 0 &&
                ` ${previewRows.length - movedCount} unaffected (gap absorbed).`}
            </p>

            {/* Chronological list with state badges */}
            <ul className="divide-y rounded border max-h-80 overflow-y-auto">
              {previewRows.map((row) => (
                <li
                  key={row.booking.id}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <CascadeBadge status={row.status} />
                  <span className="text-sm font-mono">
                    {formatLocalTime(row.old_start_at, accountTimezone)}
                    {row.new_start_at && (
                      <>
                        {" → "}
                        <span className="font-semibold">
                          {formatLocalTime(row.new_start_at, accountTimezone)}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="text-sm font-medium">
                    {row.booking.booker_first_name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {row.booking.duration_minutes}min
                  </span>
                </li>
              ))}
            </ul>

            {/* Footer: quota indicator + verbatim Phase 31 inline error markup */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm">
                Sending {movedCount} email{movedCount === 1 ? "" : "s"} &middot;{" "}
                {remainingQuota} remaining today
              </p>
              {/* VERBATIM Phase 31 quota error markup — matches override-modal.tsx
                  lines 426-432. Class, role, and copy are character-for-character
                  identical. Do NOT paraphrase. */}
              {quotaError && (
                <p className="text-sm text-red-600" role="alert">
                  {movedCount} email{movedCount === 1 ? "" : "s"} needed,{" "}
                  {remainingQuota} remaining today. Quota resets at UTC midnight.
                  Wait until tomorrow or contact bookers manually.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Committing state — 33-03 will replace this stub ── */}
        {state === "committing" && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Committing reschedules…
          </div>
        )}

        {/* ── Summary state — 33-04 will render per-row Sent/Failed/Skipped badges ── */}
        {state === "summary" && (
          <div className="text-sm text-muted-foreground py-4">
            {/* 33-04: per-booking result rows with retry buttons for failed emails */}
          </div>
        )}

        <DialogFooter>
          {state === "editing" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!canPreview || isPending} onClick={handlePreview}>
                {isPending ? "Loading…" : "Preview"}
              </Button>
            </>
          )}

          {state === "preview-ready" && (
            <>
              <Button
                variant="outline"
                onClick={() => setState("editing")}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                disabled={quotaError || movedCount === 0 || isPending}
                onClick={handleConfirm}
              >
                {isPending
                  ? "Committing…"
                  : `Pushback ${movedCount} booking${movedCount === 1 ? "" : "s"}`}
              </Button>
            </>
          )}

          {/* 33-03 / 33-04: footer buttons for committing and summary states */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EditingForm sub-component ────────────────────────────────────────────────

interface EditingFormProps {
  date: string;
  setDate: (d: string) => void;
  todayLocal: string;
  bookings: PushbackBooking[];
  bookingsLoading: boolean;
  anchorId: string | null;
  setAnchorId: (id: string) => void;
  delayValue: string;
  setDelayValue: (v: string) => void;
  delayUnit: DelayUnit;
  setDelayUnit: (u: DelayUnit) => void;
  reason: string;
  setReason: (r: string) => void;
  accountTimezone: string;
}

function EditingForm({
  date,
  setDate,
  todayLocal,
  bookings,
  bookingsLoading,
  anchorId,
  setAnchorId,
  delayValue,
  setDelayValue,
  delayUnit,
  setDelayUnit,
  reason,
  setReason,
  accountTimezone,
}: EditingFormProps) {
  return (
    <div className="space-y-4">
      {/* ── Date picker (today + future only; past disabled via min attr) ── */}
      <div className="space-y-1.5">
        <Label htmlFor="pushback-date">Date</Label>
        <Input
          id="pushback-date"
          type="date"
          value={date}
          min={todayLocal}
          onChange={(e) => setDate(e.target.value)}
          className="w-48"
        />
      </div>

      {/* ── Bookings list with anchor radio column ── */}
      <div className="space-y-1.5">
        <Label>Anchor (first booking that needs to move)</Label>
        {bookingsLoading ? (
          <div className="py-4 text-sm text-muted-foreground">
            Loading bookings…
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-4 text-sm text-muted-foreground">
            No bookings to move on this date.
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-label="Anchor booking selection"
            className="space-y-1 max-h-64 overflow-y-auto"
          >
            {bookings.map((b) => (
              <label
                key={b.id}
                htmlFor={`anchor-${b.id}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-muted",
                  anchorId === b.id && "bg-muted",
                )}
              >
                <input
                  type="radio"
                  id={`anchor-${b.id}`}
                  name="pushback-anchor"
                  value={b.id}
                  checked={anchorId === b.id}
                  onChange={() => setAnchorId(b.id)}
                  className="shrink-0 accent-primary"
                />
                <span className="text-sm font-mono w-32 shrink-0">
                  {formatLocalTime(b.start_at, accountTimezone)} &rarr;{" "}
                  {formatLocalTime(b.end_at, accountTimezone)}
                </span>
                <span className="text-sm font-medium">{b.booker_first_name}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {b.duration_minutes}min
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Delay row: number input + segmented [Min | Hr] toggle ── */}
      <div className="space-y-1.5">
        <Label htmlFor="pushback-delay">Delay</Label>
        <div className="flex gap-2 items-center">
          <Input
            id="pushback-delay"
            type="number"
            min={1}
            step={1}
            value={delayValue}
            onChange={(e) => setDelayValue(e.target.value)}
            className="w-28"
          />
          {/* Segmented Min | Hr toggle — two buttons acting as a radio group.
              Uses aria-pressed per WAI-ARIA authoring practices. */}
          <div
            className="inline-flex rounded-md border overflow-hidden"
            role="group"
            aria-label="Delay unit"
          >
            <button
              type="button"
              onClick={() => setDelayUnit("min")}
              aria-pressed={delayUnit === "min"}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                delayUnit === "min"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              Min
            </button>
            <button
              type="button"
              onClick={() => setDelayUnit("hr")}
              aria-pressed={delayUnit === "hr"}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors border-l",
                delayUnit === "hr"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              Hr
            </button>
          </div>
        </div>
      </div>

      {/* ── Reason textarea (always visible, 280-char counter) ── */}
      <div className="space-y-1.5">
        <Label htmlFor="pushback-reason">
          Reason{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="pushback-reason"
          maxLength={280}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Running late from earlier appointment"
        />
        <p className="text-xs text-muted-foreground text-right">
          {reason.length}/280
        </p>
      </div>
    </div>
  );
}
