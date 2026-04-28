"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { forgotPasswordSchema, type ForgotPasswordInput } from "./schema";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

/**
 * Forgot password form (AUTH-09).
 *
 * Follows the same RHF + useActionState pattern as login-form.tsx.
 * After submit, renders the generic success message inline with no redirect
 * (so the user knows to check their inbox on the same page they submitted from).
 */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  const {
    register,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
    errors: state.fieldErrors
      ? {
          email: state.fieldErrors.email?.[0]
            ? { type: "server", message: state.fieldErrors.email[0] }
            : undefined,
        }
      : undefined,
  });

  // After a successful submit, show only the success message — no form resubmit.
  if (state.success && state.message) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert role="status">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {state.formError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
