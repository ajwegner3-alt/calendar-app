"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { passwordSchema } from "./schema";
import { changePasswordAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = z.infer<typeof passwordSchema>;

export function PasswordForm() {
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
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "" },
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await changePasswordAction(values);
      if ("success" in result) {
        setSuccessMessage("Password updated successfully.");
        reset();
      } else if ("fieldErrors" in result) {
        if (result.fieldErrors.current_password) {
          setError("current_password", {
            message: result.fieldErrors.current_password[0],
          });
        }
        if (result.fieldErrors.new_password) {
          setError("new_password", {
            message: result.fieldErrors.new_password[0],
          });
        }
      } else if ("formError" in result) {
        setServerError(result.formError);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="current_password">Current Password</Label>
        <Input
          id="current_password"
          type="password"
          {...register("current_password")}
          autoComplete="current-password"
          disabled={isPending}
        />
        {errors.current_password && (
          <p className="text-sm text-destructive">{errors.current_password.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="new_password">New Password</Label>
        <Input
          id="new_password"
          type="password"
          {...register("new_password")}
          autoComplete="new-password"
          disabled={isPending}
        />
        {errors.new_password && (
          <p className="text-sm text-destructive">{errors.new_password.message}</p>
        )}
        <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Updating..." : "Update Password"}
      </Button>
    </form>
  );
}
