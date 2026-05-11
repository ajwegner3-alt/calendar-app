"use client";

import { useState, useTransition } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PortalButtonProps {
  /** Optional flow body — pass 'payment_method_update' for past_due deep-link, omit for generic Portal session. */
  flow?: "payment_method_update";
  /** Button label override. Defaults to "Manage Subscription" or "Update payment method" based on flow. */
  label?: string;
  /** Optional className for variant overrides on the Button (e.g., full-width). */
  className?: string;
  /** Button variant — defaults to "default" (filled). Use "outline" for secondary CTAs. */
  variant?: "default" | "outline";
}

/**
 * Phase 44 (BILL-21): client-side button that creates a Stripe Customer Portal session
 * and redirects the browser to the returned URL. Mirror of subscribe-tier-card.tsx's
 * POST-then-redirect pattern.
 *
 * Portal session URLs are short-lived (~5 min — RESEARCH.md Pitfall 1), so we ALWAYS
 * fetch a fresh URL on click — never cache. The fetch goes to /api/stripe/portal which
 * is dynamic='force-dynamic' + Cache-Control: no-store, enforcing freshness end-to-end.
 */
export function PortalButton({
  flow,
  label,
  className,
  variant = "default",
}: PortalButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultLabel =
    flow === "payment_method_update" ? "Update payment method" : "Manage Subscription";
  const buttonLabel = label ?? defaultLabel;

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/stripe/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(flow ? { flow } : {}),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "portal_failed");
          return;
        }
        const { url } = (await res.json()) as { url: string };
        if (url) {
          window.location.assign(url);
        } else {
          setError("no_redirect_url");
        }
      } catch {
        setError("network_error");
      }
    });
  };

  return (
    <div className={className ? `${className} space-y-2` : "space-y-2"}>
      <Button
        variant={variant}
        size="lg"
        onClick={handleClick}
        disabled={isPending}
        className="w-full"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <ExternalLink className="h-4 w-4 mr-2" />
        )}
        {buttonLabel}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error === "no_stripe_customer"
            ? "No payment account on file yet — please subscribe first."
            : error === "unauthorized"
              ? "Please sign in again."
              : error === "account_not_found"
                ? "Account not found. Try refreshing the page."
                : error === "network_error"
                  ? "Network error. Try again."
                  : "Couldn't open the billing portal. Try again."}
        </p>
      ) : null}
    </div>
  );
}
