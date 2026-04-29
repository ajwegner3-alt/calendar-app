"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
import { eventTypeSchema, type EventTypeInput } from "../_lib/schema";
import {
  createEventTypeAction,
  updateEventTypeAction,
  type EventTypeState,
} from "../_lib/actions";
import { slugify } from "@/lib/slugify";
import { QuestionList } from "./question-list";
import { UrlPreview } from "./url-preview";
import { LocationField } from "../[id]/edit/_components/location-field";

type FormMode = "create" | "edit";

const DEFAULTS: EventTypeInput = {
  name: "",
  slug: "",
  duration_minutes: 30,
  description: "",
  is_active: true,
  custom_questions: [],
  location: "",
  // Phase 11 Plan 11-07: CAP-03 + CAP-08 defaults. confirmCapacityDecrease is
  // never true at rest — only set transiently when the modal confirms.
  max_bookings_per_slot: 1,
  show_remaining_capacity: false,
  confirmCapacityDecrease: false,
};

export function EventTypeForm({
  mode,
  eventTypeId,
  defaultValues,
}: {
  mode: FormMode;
  eventTypeId?: string;
  defaultValues?: EventTypeInput;
}) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // CAP-09 (Phase 11 Plan 11-07): state for the capacity-decrease confirmation modal.
  // null = modal closed; object = modal open with over-cap details from the action.
  const [overcapWarning, setOvercapWarning] = useState<null | {
    newCap: number;
    currentCap: number;
    affectedSlots: number;
    maxAffected: number;
  }>(null);

  // Track whether the user has manually edited the slug. Once true, name->slug
  // auto-fill stops for the rest of the session (CONTEXT decision).
  const [slugManuallyEdited, setSlugManuallyEdited] = useState<boolean>(
    mode === "edit", // Edit mode: assume the saved slug is intentional; do not auto-overwrite from name.
  );

  // Track the original slug for the "you're changing a saved slug" warning (edit mode only).
  const originalSlug = defaultValues?.slug ?? "";

  const initialValues: EventTypeInput = defaultValues ?? DEFAULTS;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    watch,
    getValues,
    formState: { errors },
  } = useForm<EventTypeInput>({
    // zodResolver generic anchors the output type so TS doesn't error on
    // z.coerce fields (duration_minutes, is_active) which have `unknown` input
    // types in Zod v4 + @hookform/resolvers v5. The cast is type-level only;
    // runtime behavior is identical.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(eventTypeSchema) as any,
    mode: "onBlur",
    defaultValues: initialValues,
  });

  // Live URL preview reads the current slug value reactively.
  const currentSlug = watch("slug");

  function handleNameChange(value: string) {
    setValue("name", value, { shouldValidate: false, shouldDirty: true });
    if (!slugManuallyEdited) {
      const next = slugify(value);
      setValue("slug", next, {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
  }

  function handleSlugChange(value: string) {
    // Coerce to slug-valid characters as the user types (no surprises at submit).
    const coerced = slugify(value);
    setValue("slug", coerced, { shouldValidate: false, shouldDirty: true });
    if (!slugManuallyEdited && coerced !== slugify(watch("name"))) {
      setSlugManuallyEdited(true);
    }
  }

  function applyServerErrors(state: EventTypeState) {
    if (state.fieldErrors) {
      for (const [field, messages] of Object.entries(state.fieldErrors)) {
        if (!messages || messages.length === 0) continue;
        setError(field as keyof EventTypeInput, {
          type: "server",
          message: messages[0],
        });
      }
    }
    if (state.formError) {
      setServerError(state.formError);
    }
  }

  async function onSubmit(values: EventTypeInput) {
    setServerError(null);

    startTransition(async () => {
      try {
        const result =
          mode === "create"
            ? await createEventTypeAction(values)
            : await updateEventTypeAction(eventTypeId!, values);

        // If the action redirected, control never returns here (NEXT_REDIRECT
        // throws). If it returned an EventTypeState, we have errors to surface.
        if (result) {
          // CAP-09: capacity-decrease overflow warning — open confirmation modal.
          if (result.warning === "capacity_decrease_overflow" && result.details) {
            setOvercapWarning(result.details);
            return;
          }
          applyServerErrors(result);
          if (result.formError) {
            toast.error(result.formError);
          }
          // Don't double-toast field errors; they appear inline.
        }
      } catch (err) {
        // Re-throw NEXT_REDIRECT so Next.js can navigate.
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest?: unknown }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        // Genuine unexpected error.
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  // CAP-09: re-submit with bypass flag after modal confirmation.
  async function handleOvercapConfirm() {
    const values = getValues();
    try {
      const result = await updateEventTypeAction(eventTypeId!, {
        ...values,
        confirmCapacityDecrease: true,
      });
      if (result) {
        if (result.formError) {
          toast.error(result.formError);
        } else {
          applyServerErrors(result);
        }
      }
      // On success (redirect thrown), NEXT_REDIRECT propagates naturally.
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "digest" in err &&
        typeof (err as { digest?: unknown }).digest === "string" &&
        (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }
      toast.error("Something went wrong. Please try again.");
    } finally {
      setOvercapWarning(null);
    }
  }

  // Show the slug-edit warning ONLY in edit mode AND only when the current
  // slug differs from the originally-saved slug.
  const showSlugChangeWarning =
    mode === "edit" && currentSlug !== originalSlug && currentSlug.length > 0;

  return (
    <>
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
      noValidate
    >
      {serverError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Name */}
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="30-minute consult"
          {...register("name")}
          onChange={(e) => handleNameChange(e.target.value)}
          autoComplete="off"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Slug */}
      <div className="grid gap-2">
        <Label htmlFor="slug">URL slug</Label>
        <Input
          id="slug"
          placeholder="30-minute-consult"
          className="font-mono"
          {...register("slug")}
          onChange={(e) => handleSlugChange(e.target.value)}
          autoComplete="off"
        />
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
        {showSlugChangeWarning && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Changing the slug breaks any existing booking links shared with this event type.
            </AlertDescription>
          </Alert>
        )}
        <UrlPreview slug={currentSlug} />
      </div>

      {/* Duration */}
      <div className="grid gap-2">
        <Label htmlFor="duration_minutes">Duration (minutes)</Label>
        <Input
          id="duration_minutes"
          type="number"
          min={1}
          max={480}
          step={5}
          inputMode="numeric"
          className="max-w-[160px]"
          {...register("duration_minutes", { valueAsNumber: true })}
        />
        {errors.duration_minutes && (
          <p className="text-sm text-destructive">{errors.duration_minutes.message}</p>
        )}
      </div>

      {/* Max bookings per slot (CAP-03, Phase 11 Plan 11-07) */}
      <div className="grid gap-2">
        <Label htmlFor="max_bookings_per_slot">Max bookings per slot</Label>
        <Input
          id="max_bookings_per_slot"
          type="number"
          min={1}
          max={50}
          step={1}
          inputMode="numeric"
          className="max-w-[160px]"
          {...register("max_bookings_per_slot", { valueAsNumber: true })}
        />
        {errors.max_bookings_per_slot && (
          <p className="text-sm text-destructive">{errors.max_bookings_per_slot.message}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Default 1 = exclusive booking (one person per time slot). Increase to allow multiple bookers per slot (group consultations, classes).
        </p>
      </div>

      {/* Show remaining capacity toggle (CAP-08 owner UI, Phase 11 Plan 11-07) */}
      <div className="flex items-start gap-3 border rounded-lg p-3 bg-muted/30">
        <Controller
          control={control}
          name="show_remaining_capacity"
          render={({ field }) => (
            <Switch
              id="show_remaining_capacity"
              checked={!!field.value}
              onCheckedChange={field.onChange}
              className="mt-0.5"
            />
          )}
        />
        <div className="grid gap-1">
          <Label htmlFor="show_remaining_capacity" className="cursor-pointer">
            Show remaining capacity to bookers
          </Label>
          <p className="text-xs text-muted-foreground">
            When ON, the booking page displays &ldquo;X spots left&rdquo; on each available slot.
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="grid gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="What happens during this booking?"
          rows={3}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Location (edit-only per Plan 08-05 Step C — owners set it after creation). */}
      {mode === "edit" && (
        <LocationField register={register} error={errors.location} />
      )}

      {/* Active toggle */}
      <div className="flex items-start gap-3 border rounded-lg p-3 bg-muted/30">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              id="is_active"
              checked={!!field.value}
              onCheckedChange={field.onChange}
              className="mt-0.5"
            />
          )}
        />
        <div className="grid gap-1">
          <Label htmlFor="is_active" className="cursor-pointer">
            Active
          </Label>
          <p className="text-xs text-muted-foreground">
            Inactive event types are hidden from booking pages but stay editable here.
          </p>
        </div>
      </div>

      <Separator />

      {/* Custom questions */}
      <QuestionList control={control} register={register} errors={errors} />

      <Separator />

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-3">
        <Button asChild variant="outline" type="button" disabled={isPending}>
          <Link href="/app/event-types">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending
            ? mode === "create"
              ? "Creating\u2026"
              : "Saving\u2026"
            : mode === "create"
              ? "Create event type"
              : "Save changes"}
        </Button>
      </div>
    </form>

    {/* CAP-09 capacity-decrease confirmation modal (Phase 11 Plan 11-07).
        Opens when updateEventTypeAction returns warning=capacity_decrease_overflow.
        Confirm re-submits with confirmCapacityDecrease=true to bypass the check. */}
    <AlertDialog
      open={overcapWarning !== null}
      onOpenChange={(open) => { if (!open) setOvercapWarning(null); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Reduce capacity to {overcapWarning?.newCap}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {overcapWarning && (
              <>
                {overcapWarning.affectedSlots} future slot
                {overcapWarning.affectedSlots === 1 ? "" : "s"} currently{" "}
                {overcapWarning.affectedSlots === 1 ? "has" : "have"} more
                confirmed bookings than your new cap of {overcapWarning.newCap}.
                The worst-affected slot has {overcapWarning.maxAffected} confirmed
                booking{overcapWarning.maxAffected === 1 ? "" : "s"}.
                Existing bookings will NOT be cancelled &mdash; but affected slots
                will be over-cap until those bookings end or are cancelled.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setOvercapWarning(null)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleOvercapConfirm}>
            Reduce capacity anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
