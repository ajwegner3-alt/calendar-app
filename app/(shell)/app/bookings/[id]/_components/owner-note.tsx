"use client";

import { useEffect, useState, useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { saveOwnerNoteAction } from "../_lib/owner-note-action";

/**
 * Owner-note autosave textarea (Plan 08-07).
 *
 * Behavior:
 *   - Fully controlled textarea (keystrokes update local state immediately).
 *   - Debounced save fires 800ms after the last keystroke (RESEARCH Pattern 6
 *     + CONTEXT.md Claude's Discretion). Quick edits coalesce into one save;
 *     longer pauses settle.
 *   - On blur, `save.flush()` forces the pending debounced call to run NOW so
 *     the owner can't tab away and lose an in-flight edit.
 *   - "Saved" indicator is inline muted text that auto-clears after 2s.
 *     RESEARCH Pattern 6 explicitly bans Sonner toasts for save success
 *     (too noisy for an autosave loop) — toasts are reserved for errors.
 *   - 5000-char cap (matches the server-side cap in saveOwnerNoteAction).
 */

interface OwnerNoteProps {
  bookingId: string;
  initialNote: string | null;
}

const NOTE_MAX_LEN = 5000;

export function OwnerNote({ bookingId, initialNote }: OwnerNoteProps) {
  const [value, setValue] = useState(initialNote ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = useDebouncedCallback((next: string) => {
    startTransition(async () => {
      const result = await saveOwnerNoteAction({ bookingId, note: next });
      if (result.ok) {
        setSavedAt(Date.now());
      } else {
        toast.error(result.error);
      }
    });
  }, 800);

  // After a successful save, schedule one re-render 2s later so the
  // "Saved" pill disappears. Cleanup the timer if savedAt changes again
  // (another save fired) or the component unmounts.
  useEffect(() => {
    if (savedAt === null) return;
    const handle = setTimeout(() => {
      setSavedAt((prev) => (prev === savedAt ? null : prev));
    }, 2000);
    return () => clearTimeout(handle);
  }, [savedAt]);

  // Plan 09-01: Date.now() during render is impure (lint react-hooks/purity).
  // Since the useEffect above schedules a setTimeout that nulls savedAt after
  // 2s, savedAt !== null is already a sufficient guard for the "Saved"
  // visibility window — the timer enforces the 2s ceiling.
  const showSaved = savedAt !== null;

  return (
    <div className="space-y-1">
      <Textarea
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          // Any new keystroke means the previous "Saved" indicator is stale.
          setSavedAt(null);
          save(next);
        }}
        onBlur={() => {
          // Force any pending debounced save to fire now so blurring the
          // field never strands an in-flight edit.
          save.flush();
        }}
        rows={5}
        maxLength={NOTE_MAX_LEN}
        placeholder="Private note. The booker never sees this."
        className="resize-y"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {value.length}/{NOTE_MAX_LEN}
        </span>
        <span aria-live="polite">
          {isPending ? "Saving\u2026" : showSaved ? "Saved" : ""}
        </span>
      </div>
    </div>
  );
}
