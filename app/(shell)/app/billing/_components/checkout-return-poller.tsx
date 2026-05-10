"use client";

/**
 * CheckoutReturnPoller — Client Component
 *
 * Shown when /app/billing?session_id=cs_* is in the URL after Stripe Checkout return.
 * Polls GET /api/stripe/checkout/status every 2s for up to 30s.
 *
 * State machine:
 *   polling  → polls every 2s
 *   active   → shows "You're all set!" then auto-redirects to /app after ~2s
 *   timeout  → shows reassuring fallback with Refresh CTA (not "failed" framing)
 *
 * Constraints (from CONTEXT + LDs):
 *   - LD-10: NEVER optimistically set pollState to "active" — only set from status poll response
 *   - CONTEXT: auto-redirect to /app after ~2s on success (not immediately — user reads "You're all set!")
 *   - 30s hard cap, poll every 2s, cleanup on unmount (RESEARCH Pitfall 6)
 *   - cache: 'no-store' on every fetch (RESEARCH Pitfall 4 — prevent stale Stripe webhook lag)
 *   - sessionId NOT included in fetch URL/body — auth session identifies the account
 *   - Transient network errors: keep polling (don't throw)
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CheckoutReturnPollerProps {
  /** Stripe checkout session ID from URL — forensic/display only.
   *  NOT passed to the status endpoint; auth session identifies the account. */
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type PollState = "polling" | "active" | "timeout";

export function CheckoutReturnPoller({ sessionId: _sessionId }: CheckoutReturnPollerProps) {
  const [pollState, setPollState] = useState<PollState>("polling");
  const router = useRouter();
  // startedAt initialized to 0; set to Date.now() at effect mount time so that
  // the 30s timeout is measured from when the component actually mounts in the
  // browser, not from module evaluation time (avoids react-hooks/purity lint error).
  const startedAt = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------------------
  // Polling state machine — RESEARCH Pattern 6 + Pitfall 6
  // -------------------------------------------------------------------------

  useEffect(() => {
    const POLL_INTERVAL_MS = 2000;
    const TIMEOUT_MS = 30_000;
    let cancelled = false;

    // Record mount time here (inside the effect) to avoid calling Date.now()
    // during render (react-hooks/purity rule violation if called at ref init).
    startedAt.current = Date.now();

    async function poll() {
      if (cancelled) return;

      // 30s hard cap — transition to timeout state
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPollState("timeout");
        return;
      }

      try {
        const res = await fetch("/api/stripe/checkout/status", {
          cache: "no-store",
        });
        // Transient server errors (5xx) — keep polling
        if (!res.ok) return;

        const data = await res.json().catch(() => ({}));

        if (data.subscription_status === "active") {
          // Only here is it valid to transition to "active" (LD-10 — webhook is canonical)
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPollState("active");
          // CONTEXT: auto-redirect after ~2s so user reads "You're all set!" first
          setTimeout(() => {
            if (!cancelled) router.push("/app");
          }, 2000);
        }
        // Any other status (trialing, past_due, etc.) — keep polling
      } catch {
        // Network blip — keep polling, do not surface error to user
      }
    }

    // Poll immediately on mount (RESEARCH Pitfall 7 — fast-webhook case:
    // webhook may already have fired before the user's browser loads this page)
    void poll();
    intervalRef.current = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router]); // sessionId NOT in deps — never changes for this mount

  // -------------------------------------------------------------------------
  // Render — three visual states
  // -------------------------------------------------------------------------

  if (pollState === "active") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re all set!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Taking you to your dashboard&hellip;
          </p>
        </CardContent>
      </Card>
    );
  }

  if (pollState === "timeout") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Almost there&hellip;</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your payment went through &mdash; we&apos;re still confirming your
            subscription in the background. This usually takes only a few
            seconds.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  // polling state
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirming your subscription&hellip;</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>This usually takes just a few seconds.</span>
      </CardContent>
    </Card>
  );
}
