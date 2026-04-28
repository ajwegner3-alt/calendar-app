"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { displayNameSchema } from "./schema";
import { updateDisplayNameAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = z.infer<typeof displayNameSchema>;

export function ProfileForm({ currentName }: { currentName: string | null }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { display_name: currentName ?? "" },
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await updateDisplayNameAction(values);
      if ("success" in result) {
        setSuccessMessage("Display name updated.");
      } else if ("fieldErrors" in result) {
        if (result.fieldErrors.display_name) {
          setError("display_name", { message: result.fieldErrors.display_name[0] });
        }
      } else if ("formError" in result) {
        setServerError(result.formError);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="display_name">Display Name</Label>
        <Input
          id="display_name"
          {...register("display_name")}
          placeholder="Your display name"
          disabled={isPending}
        />
        {errors.display_name && (
          <p className="text-sm text-destructive">{errors.display_name.message}</p>
        )}
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
