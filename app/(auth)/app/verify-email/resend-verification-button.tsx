"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { type ResendVerificationState } from "./actions";

interface ResendVerificationButtonProps {
  /** The server action to invoke on submit. */
  action: (
    prev: ResendVerificationState,
    formData: FormData,
  ) => Promise<ResendVerificationState>;
  /** Pre-filled email (from ?email= query param). When provided, renders read-only. */
  initialEmail?: string;
}

const initialState: ResendVerificationState = {};

/**
 * Client Component: resend verification email button with 60-second cooldown.
 *
 * When initialEmail is provided the email field is shown read-only and hidden
 * from the user (so we don't leak existence info while still sending to the
 * right address). When absent, a small email input is shown.
 *
 * The 60-second disabled state after click is a frontend echo of the 1/min
 * rate limit — pure UX; the server enforces the real limit.
 */
export function ResendVerificationButton({
  action,
  initialEmail,
}: ResendVerificationButtonProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Start 60-second cooldown after a successful submit
  useEffect(() => {
    if (state.success) {
      setCooldownSeconds(60);
    }
  }, [state.success]);

  // Tick down the cooldown every second
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setInterval(() => {
      setCooldownSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSeconds]);

  const isDisabled = isPending || cooldownSeconds > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="flex flex-col gap-4">
          {state.formError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.formError}</AlertDescription>
            </Alert>
          )}
          {state.success && state.message && (
            <Alert role="status">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          {initialEmail ? (
            /* Email is known — hidden input; no label needed */
            <input type="hidden" name="email" value={initialEmail} />
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="resend-email">Email address</Label>
              <Input
                id="resend-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
          )}

          <Button type="submit" disabled={isDisabled} className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending
              ? "Sending…"
              : cooldownSeconds > 0
                ? `Resend in ${cooldownSeconds}s`
                : "Resend verification email"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
