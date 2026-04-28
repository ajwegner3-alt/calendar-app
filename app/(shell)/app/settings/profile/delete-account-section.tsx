"use client";

import { useState, useTransition } from "react";
import { softDeleteAccountAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteAccountSectionProps {
  accountSlug: string;
}

/**
 * Danger Zone: GitHub-style type-slug-to-confirm soft delete.
 *
 * Client-side: disables submit button until input matches accountSlug exactly.
 * Server-side: softDeleteAccountAction re-validates confirmation as defense-in-depth,
 *   then sets accounts.deleted_at = now(), signs the user out, and redirects
 *   to /account-deleted.
 *
 * After deletion the auth.users row is retained (ACCT-02). The user can log
 * back in but will see /app/unlinked since their accounts row is soft-deleted
 * (filtered by .is('deleted_at', null)). This is the accepted v1.1 behavior —
 * tracked as QA note for Phase 13.
 */
export function DeleteAccountSection({ accountSlug }: DeleteAccountSectionProps) {
  const [confirmation, setConfirmation] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isConfirmed = confirmation === accountSlug;

  function handleDelete() {
    if (!isConfirmed) return;
    setServerError(null);

    startTransition(async () => {
      const result = await softDeleteAccountAction({ confirmation });
      // If we get here, the action returned an error (redirect throws, so
      // a successful delete never returns — the user is already redirected).
      if (result && "error" in result) {
        setServerError(result.error);
      }
    });
  }

  return (
    <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-4">
      <div>
        <h2 className="text-base font-medium text-destructive">Danger Zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deleting your account permanently removes your booking link, public page, and all account
          data. <strong>This cannot be undone.</strong>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your login credentials remain so you can contact support if needed, but you will not be
          able to access any booking data.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="delete-confirmation">
          Type{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
            {accountSlug}
          </code>{" "}
          to confirm
        </Label>
        <Input
          id="delete-confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={accountSlug}
          disabled={isPending}
          className="max-w-xs"
        />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button
        variant="destructive"
        onClick={handleDelete}
        disabled={!isConfirmed || isPending}
      >
        {isPending ? "Deleting..." : "Delete Account"}
      </Button>
    </section>
  );
}
