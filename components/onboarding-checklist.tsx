"use client";

import { useState } from "react";
import { Check, Link as LinkIcon, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dismissChecklistAction } from "@/app/(shell)/app/onboarding-checklist-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingChecklistAccount {
  id: string;
  slug: string;
  created_at: string;
  onboarding_checklist_dismissed_at: string | null;
  onboarding_complete: boolean;
}

interface OnboardingChecklistProps {
  account: OnboardingChecklistAccount;
  availabilityCount: number;
  eventTypeCount: number;
}

// ---------------------------------------------------------------------------
// Visibility gate (pure function — mirrors server-side check in page.tsx)
// ---------------------------------------------------------------------------

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function shouldShowChecklist(account: OnboardingChecklistAccount): boolean {
  if (!account.onboarding_complete) return false;
  if (account.onboarding_checklist_dismissed_at !== null) return false;

  const createdAt = new Date(account.created_at).getTime();
  const now = Date.now();
  return createdAt + SEVEN_DAYS_MS > now;
}

// ---------------------------------------------------------------------------
// ChecklistItem sub-component
// ---------------------------------------------------------------------------

function ChecklistItem({
  label,
  done,
  children,
}: {
  label: string;
  done: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          done
            ? "border-green-500 bg-green-500 text-white"
            : "border-muted-foreground/40 bg-background"
        }`}
      >
        {done && <Check className="h-3 w-3" />}
      </span>
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}
        >
          {label}
        </span>
        {children && <div className="mt-1">{children}</div>}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * OnboardingChecklist
 *
 * Renders a dismissible checklist card on the /app dashboard for newly
 * onboarded accounts (within the first 7 days, not yet dismissed).
 *
 * Visibility gate (all conditions must be true):
 *   1. account.onboarding_complete === true
 *   2. account.onboarding_checklist_dismissed_at === null
 *   3. account.created_at + 7 days > now()
 *
 * Items:
 *   - "Set your availability"    — checked when availabilityCount >= 1
 *   - "Customize your first event type" — checked when eventTypeCount >= 1
 *   - "Share your link"          — uncheckable affordance with copy button
 *
 * Dismiss button calls dismissChecklistAction() (Server Action) which writes
 * accounts.onboarding_checklist_dismissed_at = now().
 */
export function OnboardingChecklist({
  account,
  availabilityCount,
  eventTypeCount,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [copying, setCopying] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  // Server-side render already filters this out, but guard client-side too
  // (e.g. if a cached page loads for an old user).
  if (dismissed || !shouldShowChecklist(account)) {
    return null;
  }

  const bookingLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/${account.slug}`
      : `/${account.slug}`;

  async function handleDismiss() {
    setDismissing(true);
    const result = await dismissChecklistAction();
    if ("success" in result) {
      setDismissed(true);
    } else {
      // Non-fatal: surface error in console but don't block the UI.
      console.error("[OnboardingChecklist] dismiss failed:", result.error);
      setDismissing(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopying(true);
      setTimeout(() => setCopying(false), 1500);
    } catch {
      // Fallback: select the text (clipboard API may be unavailable in some contexts).
    }
  }

  const allDone = availabilityCount >= 1 && eventTypeCount >= 1;

  return (
    <div className="max-w-3xl">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3 flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">
              {allDone ? "You're all set!" : "Get started"}
            </CardTitle>
            <CardDescription className="mt-1">
              {allDone
                ? "Your booking page is ready to share."
                : "Complete these steps to get your booking page live."}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            disabled={dismissing}
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <ul className="space-y-3">
            <ChecklistItem
              label="Set your availability"
              done={availabilityCount >= 1}
            />
            <ChecklistItem
              label="Customize your first event type"
              done={eventTypeCount >= 1}
            />
            <ChecklistItem label="Share your booking link" done={false}>
              <div className="flex items-center gap-2 mt-1.5">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                  {bookingLink}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 text-xs"
                  onClick={handleCopyLink}
                >
                  <LinkIcon className="h-3 w-3" />
                  {copying ? "Copied!" : "Copy"}
                </Button>
              </div>
            </ChecklistItem>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
