import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EmptyState({ showArchived }: { showArchived: boolean }) {
  if (showArchived) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No archived event types</CardTitle>
          <CardDescription>
            Event types you archive will appear here. Toggle &quot;Show archived&quot; off
            to see your active list.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>No event types yet</CardTitle>
            <CardDescription>
              Create your first event type to start accepting bookings.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/app/event-types/new">Create event type</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
