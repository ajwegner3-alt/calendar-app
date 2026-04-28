"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { emailChangeSchema } from "./schema";
import { requestEmailChangeAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = z.infer<typeof emailChangeSchema>;

export function EmailChangeForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: { new_email: "" },
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    setSuccessMessage(null);

    // Build FormData so we can call the Server Action (which accepts FormData).
    const fd = new FormData();
    fd.set("new_email", values.new_email);

    startTransition(async () => {
      const result = await requestEmailChangeAction(null, fd);
      if (!result) return;

      if (result.success) {
        setSuccessMessage(result.message ?? "Check your new email for a confirmation link.");
        reset();
      } else if (result.fieldErrors?.new_email) {
        setError("new_email", { message: result.fieldErrors.new_email[0] });
      } else if (result.formError) {
        setServerError(result.formError);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="new_email">New Email Address</Label>
        <Input
          id="new_email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register("new_email")}
          disabled={isPending}
        />
        {errors.new_email && (
          <p className="text-sm text-destructive">{errors.new_email.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          We&apos;ll send a confirmation link to the new address. Your email won&apos;t change until
          you click it.
        </p>
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      {successMessage && (
        <p className="text-sm text-green-600 leading-snug">{successMessage}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending..." : "Send Confirmation Link"}
      </Button>
    </form>
  );
}
