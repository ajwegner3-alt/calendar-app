import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AvailabilityEmptyBanner() {
  return (
    <Alert
      variant="default"
      className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20"
    >
      <AlertTriangle className="size-4" />
      <AlertTitle>You haven&apos;t set availability yet</AlertTitle>
      <AlertDescription>
        Bookings cannot be made until you open at least one weekday or add a
        date override below.
      </AlertDescription>
    </Alert>
  );
}
