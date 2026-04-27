"use client";

import type { UseFormRegister, FieldError } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EventTypeInput } from "../../../_lib/schema";

/**
 * Location / address textarea for the event-type editor (Phase 8 Plan 08-05).
 *
 * Bound to event_types.location via `register("location")` on the parent
 * EventTypeForm. Empty input normalizes to NULL in the DB (action layer
 * converts `undefined` → `null`).
 *
 * Edit-only: not rendered in the create flow per Plan 08-05 Step C
 * ("CONTEXT.md doesn't require it; owners can edit-set after creation").
 */
export function LocationField({
  register,
  error,
}: {
  register: UseFormRegister<EventTypeInput>;
  error?: FieldError;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="location">Location / Address</Label>
      <Textarea
        id="location"
        placeholder="e.g. 123 Main St, Omaha NE 68102 — or a Zoom link, or 'Customer's home'"
        rows={3}
        maxLength={500}
        {...register("location")}
      />
      <p className="text-xs text-muted-foreground">
        Optional. Shown in reminder emails when the account-level &ldquo;Include
        event location&rdquo; toggle is on. Leave blank for no location.
      </p>
      {error && (
        <p className="text-sm text-destructive">{error.message}</p>
      )}
    </div>
  );
}
