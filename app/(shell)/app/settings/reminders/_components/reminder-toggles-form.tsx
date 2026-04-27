"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveReminderTogglesAction } from "../_lib/actions";

type ToggleKey = "custom_answers" | "location" | "lifecycle_links";

type ToggleState = {
  custom_answers: boolean;
  location: boolean;
  lifecycle_links: boolean;
};

const TOGGLE_META: Array<{
  key: ToggleKey;
  label: string;
  description: string;
}> = [
  {
    key: "custom_answers",
    label: "Include booker's custom-question answers",
    description:
      "Repeats the booker's answers to your custom intake questions in the reminder email body.",
  },
  {
    key: "location",
    label: "Include event location/address",
    description:
      "Shows the per-event-type location/address (when set) in the reminder email body.",
  },
  {
    key: "lifecycle_links",
    label: "Include cancel and reschedule links",
    description:
      "Adds the cancel + reschedule links to the reminder email so the booker can manage their booking from there.",
  },
];

export function ReminderTogglesForm({
  accountId,
  initial,
}: {
  accountId: string;
  initial: ToggleState;
}) {
  const [state, setState] = useState<ToggleState>(initial);
  const [pendingKey, setPendingKey] = useState<ToggleKey | null>(null);
  const [, startTransition] = useTransition();

  function onToggle(key: ToggleKey, next: boolean) {
    // Optimistic update; revert on failure.
    const previous = state[key];
    setState((s) => ({ ...s, [key]: next }));
    setPendingKey(key);

    startTransition(async () => {
      try {
        const result = await saveReminderTogglesAction({
          accountId,
          key,
          value: next,
        });
        if (result.ok) {
          toast.success("Saved");
        } else {
          setState((s) => ({ ...s, [key]: previous }));
          toast.error(result.error || "Failed to save reminder setting.");
        }
      } catch {
        setState((s) => ({ ...s, [key]: previous }));
        toast.error("Something went wrong. Please try again.");
      } finally {
        setPendingKey((cur) => (cur === key ? null : cur));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {TOGGLE_META.map((t) => {
        const checked = state[t.key];
        const isPending = pendingKey === t.key;
        return (
          <div
            key={t.key}
            className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4"
          >
            <Switch
              id={`toggle-${t.key}`}
              checked={checked}
              onCheckedChange={(next) => onToggle(t.key, next)}
              disabled={isPending}
              className="mt-0.5"
            />
            <div className="grid gap-1">
              <Label htmlFor={`toggle-${t.key}`} className="cursor-pointer">
                {t.label}
              </Label>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
