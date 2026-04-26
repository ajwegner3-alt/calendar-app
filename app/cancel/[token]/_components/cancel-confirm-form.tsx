"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CancelConfirmFormProps {
  token: string;
  accountSlug: string;
  eventSlug: string;
}

export function CancelConfirmForm({ token, accountSlug, eventSlug }: CancelConfirmFormProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, reason: reason.trim() || undefined }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      // Non-OK: surface a friendly toast + don't flip state
      const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (res.status === 429) {
        toast.error("Too many requests. Please try again in a few minutes.");
      } else if (res.status === 410) {
        // booking already cancelled / no longer active — refresh to show the inline TokenNotActive
        toast.error(body?.error ?? "This link is no longer active.");
        // Soft refresh: replace router.refresh() — re-resolves the token; will hit not_active branch
        window.location.reload();
      } else {
        toast.error(body?.error ?? "Cancel failed. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-4">Your booking has been cancelled.</p>
        <Link
          href={`/${accountSlug}/${eventSlug}`}
          className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Book again
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="cancel-reason" className="block text-xs uppercase text-muted-foreground tracking-wide mb-1">
          Reason for cancelling (optional)
        </label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Help the host plan&hellip;"
          className="text-sm"
          disabled={submitting}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full sm:w-auto"
          variant="destructive"
        >
          {submitting ? "Cancelling\u2026" : "Yes, cancel this booking"}
        </Button>
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 rounded-md text-sm border hover:bg-accent"
        >
          Keep my booking
        </Link>
      </div>
    </div>
  );
}
