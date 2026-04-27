"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { restoreEventTypeAction } from "../_lib/actions";
import { slugify } from "@/lib/slugify";

export function RestoreCollisionDialog({
  open,
  onOpenChange,
  eventTypeId,
  originalSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTypeId: string;
  originalSlug: string;
}) {
  const router = useRouter();
  const [slugInput, setSlugInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset to suggested slug whenever the dialog opens.
  // Re-seed pattern: synchronizing dialog state with parent's `open` signal.
  // Approved set-state-in-effect pattern (Plan 09-01 cleanup).
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlugInput(`${originalSlug}-restored`);
      setError(null);
    }
  }, [open, originalSlug]);

  function handleSlugChange(value: string) {
    setSlugInput(slugify(value));
    if (error) setError(null);
  }

  async function handleRestore() {
    setError(null);
    if (!slugInput) {
      setError("Slug cannot be empty.");
      return;
    }

    startTransition(async () => {
      const result = await restoreEventTypeAction(eventTypeId, slugInput);
      if ("ok" in result) {
        toast.success("Restored as inactive.");
        onOpenChange(false);
        router.refresh();
      } else if ("slugCollision" in result) {
        // Shouldn't happen since we passed a slug, but defensively handle it.
        setError("That slug is also in use. Try another.");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Slug already in use</DialogTitle>
          <DialogDescription>
            The slug <span className="font-mono">{originalSlug}</span> is taken
            by another active event type. Pick a new URL slug to restore this one.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="restore-slug">URL slug</Label>
          <Input
            id="restore-slug"
            value={slugInput}
            onChange={(e) => handleSlugChange(e.target.value)}
            autoComplete="off"
            className="font-mono"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleRestore} disabled={isPending || !slugInput}>
            {isPending ? "Restoring\u2026" : "Restore with new slug"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
