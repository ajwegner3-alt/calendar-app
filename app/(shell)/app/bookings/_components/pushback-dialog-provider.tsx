"use client";

/**
 * Phase 33 Plan 01 — PushbackDialogProvider + button exports.
 *
 * Client wrapper that:
 *   1. Holds [open, initialDate] state for the single shared PushbackDialog.
 *   2. Exposes a React Context so descendant buttons can open the dialog with
 *      a pre-filled date without prop-drilling.
 *   3. Exports PushbackHeaderButton (for page.tsx header) and
 *      PushbackDaySectionButton (for BookingsDayGroupedView section headers).
 *      Both buttons access context → must be rendered inside the provider tree.
 *
 * RSC-safe: only receives serializable props (strings). Server actions are
 * imported directly inside the dialog component — not passed as props.
 * (Phase 26 RSC boundary precedent — RESEARCH.md Risk 4.)
 *
 * Layout contract with page.tsx:
 *   <PushbackDialogProvider ...>          ← mounts here (wraps page content)
 *     <header>
 *       <h1>...</h1>
 *       <PushbackHeaderButton ... />      ← client leaf inside provider tree
 *     </header>
 *     ...rest of page...
 *     <BookingsDayGroupedView>            ← renders PushbackDaySectionButton per day
 *   </PushbackDialogProvider>
 */

import { useState, createContext, useContext, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PushbackDialog } from "./pushback-dialog";

// ─── Context ──────────────────────────────────────────────────────────────────

interface PushbackDialogContextValue {
  /** Open the dialog pre-filled with the given YYYY-MM-DD date. */
  openDialog: (date: string) => void;
}

const PushbackDialogCtx = createContext<PushbackDialogContextValue | null>(
  null,
);

export function usePushbackDialog(): PushbackDialogContextValue {
  const ctx = useContext(PushbackDialogCtx);
  if (!ctx) {
    throw new Error(
      "usePushbackDialog must be used within a PushbackDialogProvider",
    );
  }
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface PushbackDialogProviderProps {
  accountId: string;
  accountTimezone: string;
  /** YYYY-MM-DD in accountTimezone — default date for the header button */
  todayIsoYmd: string;
  children: ReactNode;
}

export function PushbackDialogProvider({
  accountId,
  accountTimezone,
  todayIsoYmd,
  children,
}: PushbackDialogProviderProps) {
  const [open, setOpen] = useState(false);
  const [initialDate, setInitialDate] = useState(todayIsoYmd);

  const ctxValue: PushbackDialogContextValue = {
    openDialog: (date: string) => {
      setInitialDate(date);
      setOpen(true);
    },
  };

  return (
    <PushbackDialogCtx.Provider value={ctxValue}>
      {/* Children includes the page layout and client button leaves that
          access this context (PushbackHeaderButton, PushbackDaySectionButton). */}
      {children}

      {/* Single dialog instance — shared by all buttons via context. */}
      <PushbackDialog
        open={open}
        onOpenChange={setOpen}
        accountId={accountId}
        accountTimezone={accountTimezone}
        initialDate={initialDate}
      />
    </PushbackDialogCtx.Provider>
  );
}

// ─── Header button ────────────────────────────────────────────────────────────

/**
 * Primary entry point on /app/bookings. Opens dialog with today pre-selected.
 * Must be rendered inside PushbackDialogProvider (satisfied by page.tsx layout).
 */
export function PushbackHeaderButton({
  todayIsoYmd,
}: {
  todayIsoYmd: string;
}) {
  const { openDialog } = usePushbackDialog();
  return (
    <Button
      onClick={() => openDialog(todayIsoYmd)}
      variant="default"
      className="shrink-0"
    >
      Pushback
    </Button>
  );
}

// ─── Day-section button ───────────────────────────────────────────────────────

/**
 * Per-day shortcut button rendered in BookingsDayGroupedView section headers.
 * Opens the shared dialog pre-filled with that day's date.
 * Must be rendered inside PushbackDialogProvider (satisfied by page.tsx layout).
 */
export function PushbackDaySectionButton({ date }: { date: string }) {
  const { openDialog } = usePushbackDialog();
  return (
    <Button size="sm" variant="outline" onClick={() => openDialog(date)}>
      Pushback this day
    </Button>
  );
}
