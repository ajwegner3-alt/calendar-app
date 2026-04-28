"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { slugSchema } from "./schema";
import { updateSlugAction } from "./actions";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = z.infer<typeof slugSchema>;

export function SlugForm({ currentSlug }: { currentSlug: string | null }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(slugSchema),
    defaultValues: { slug: currentSlug ?? "" },
  });

  const slugValue = watch("slug");

  // Client-side reserved check (Option B — inline, no API call dependency)
  // TODO: When 10-06's /api/check-slug is confirmed live, replace with debounced
  // API call for real-time collision feedback. Server action catches collisions.
  const isReserved = slugValue ? isReservedSlug(slugValue) : false;

  function onSubmit(values: FormValues) {
    setServerError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await updateSlugAction(values);
      if ("success" in result) {
        setSuccessMessage("Slug updated. Your old booking link no longer works — update any embedded links.");
      } else if ("fieldErrors" in result) {
        if (result.fieldErrors.slug) {
          setError("slug", { message: result.fieldErrors.slug[0] });
        }
      } else if ("formError" in result) {
        setServerError(result.formError);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="slug">Booking URL Slug</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {typeof window !== "undefined" ? window.location.origin : ""}/
          </span>
          <Input
            id="slug"
            {...register("slug")}
            placeholder="your-slug"
            disabled={isPending}
            className="max-w-xs"
          />
        </div>
        {isReserved && !errors.slug && (
          <p className="text-sm text-destructive">That slug is reserved and cannot be used.</p>
        )}
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Changing your slug immediately removes the old URL. Update any shared links or embedded widgets.
        </p>
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
      <Button type="submit" disabled={isPending || isReserved}>
        {isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
