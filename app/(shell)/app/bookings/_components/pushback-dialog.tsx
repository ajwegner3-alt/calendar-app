"use client";

/**
 * Phase 33 Plan 01 — PushbackDialog shell.
 *
 * Implements the "editing" state fully:
 *   - Native HTML date input (today + future only)
 *   - Chronological bookings list with radio-column anchor selection
 *   - Delay number input + segmented [Min | Hr] toggle
 *   - Always-visible 280-char reason textarea
 *
 * States 2–5 render placeholder regions:
 *   - "preview-loading" — spinner placeholder for 33-02
 *   - "preview-ready"   — cascade preview region for 33-02
 *   - "committing"      — commit progress placeholder for 33-03
 *   - "summary"         — per-row result summary for 33-04
 *
 * Note: shadcn RadioGroup is not installed in this project. Anchor selection
 * uses accessible native <input type="radio"> with the same visual treatment
 * (radio-column layout, keyboard nav, screen-reader labels). This is a
 * deviation from the plan's RadioGroup reference — functionally identical.
 */

import { useState, useTransition, useEffect } from "react";
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

import { getBookingsForPushbackAction } from "../_lib/actions-pushback";
import type { PushbackBooking } from "../_lib/queries";

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Five-state machine for the pushback dialog lifecycle.
 *   editing         — owner is filling the form (this plan implements this)
 *   preview-loading — cascade preview is being computed (33-02)
 *   preview-ready   — cascade preview is shown; owner can Confirm (33-02)
 *   committing      — commit in flight (33-03)
 *   summary         — per-booking result summary (33-04)
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
  const [, startTransition] = useTransition();

  // Re-seed state whenever the modal opens or initialDate prop changes.
  // Pattern: setState-in-useEffect (React docs "reset state with a key prop"
  // alternative — avoids full unmount/remount of dialog tree on each open,
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
  // client-side here since this is a client component; the server page also
  // computes it but doesn't need to pass it as a prop for the min constraint).
  const todayLocal = todayInTz(accountTimezone);

  const canPreview =
    !!anchorId && isValidDelay(delayValue) && bookings.length > 0;

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

        {/* ── Preview-loading state — 33-02 will replace this stub ── */}
        {state === "preview-loading" && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Computing preview…
          </div>
        )}

        {/* ── Preview-ready state — 33-02 will render cascade rows here ── */}
        {state === "preview-ready" && (
          <div className="text-sm text-muted-foreground py-4">
            {/* 33-02: render MOVE / ABSORBED / PAST_EOD badge rows + quota indicator */}
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
              <Button
                disabled={!canPreview}
                onClick={() => {
                  // 33-02 will replace this stub with:
                  //   setState("preview-loading");
                  //   startTransition(async () => {
                  //     const result = await previewPushbackAction({ ... });
                  //     ...setState("preview-ready");
                  //   });
                  setState("preview-ready");
                }}
              >
                Preview
              </Button>
            </>
          )}
          {/* 33-02 / 33-03 / 33-04: footer buttons for other states go here */}
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
                  {formatLocalTime(b.start_at, accountTimezone)} →{" "}
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
