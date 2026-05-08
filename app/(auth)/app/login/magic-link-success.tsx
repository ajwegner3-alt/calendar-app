"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requestMagicLinkAction, type MagicLinkState } from "./actions";

const initialState: MagicLinkState = {};

interface MagicLinkSuccessProps {
  /** The email submitted by the user; resends fire against the same address. */
  email: string;
}

/**
 * Inline success state for the magic-link tab on /app/login (AUTH-24).
 *
 * Renders the CONTEXT-locked success copy verbatim, the 15-minute expiry note,
 * and a Resend button with a 30-second countdown.
 *
 * Pattern source: `verify-email/resend-verification-button.tsx` (60s cooldown
 * there → 30s here). Cooldown starts on mount because the parent only mounts
 * this component AFTER a successful initial submit. A successful resend resets
 * the countdown to 30. 5xx `formError` from the action surfaces as a
 * destructive Alert at the top.
 *
 * Hidden `<input type="hidden" name="email">` allows the resend submit to
 * fire against the original address without the user retyping it. Per
 * RESEARCH Pattern 4 the cooldown is client-side `setInterval` only —
 * sub-minute reload-survival has no UX benefit.
 */
export function MagicLinkSuccess({ email }: MagicLinkSuccessProps) {
  const [state, formAction, isPending] = useActionState(
    requestMagicLinkAction,
    initialState,
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(30); // start countdown on mount

  // Reset cooldown after each successful resend
  useEffect(() => {
    if (state.success) setCooldownSeconds(30);
  }, [state.success]);

  // Tick down every second
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setInterval(() => {
      setCooldownSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSeconds]);

  const isDisabled = isPending || cooldownSeconds > 0;

  return (
    <div className="flex flex-col gap-4">
      {state.formError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div role="status" className="flex flex-col gap-1">
        <p className="text-sm text-foreground">
          If an account exists for that email, we sent a login link. Check your inbox.
        </p>
        <p className="text-xs text-muted-foreground">
          The link expires in 15 minutes.
        </p>
      </div>

      <form action={formAction}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" disabled={isDisabled} variant="outline" className="w-full">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending
            ? "Sending…"
            : cooldownSeconds > 0
              ? `Resend in ${cooldownSeconds}s`
              : "Resend login link"}
        </Button>
      </form>
    </div>
  );
}
