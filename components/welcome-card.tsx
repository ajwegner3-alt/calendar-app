import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays, Clock, Palette } from "lucide-react";

const NEXT_STEPS = [
  {
    href: "/app/event-types",
    icon: CalendarDays,
    title: "Create an event type",
    description: "Define what people can book (name, duration, questions).",
  },
  {
    href: "/app/availability",
    icon: Clock,
    title: "Set your availability",
    description: "Weekly hours, buffers, notice windows, daily cap.",
  },
  {
    href: "/app/branding",
    icon: Palette,
    title: "Pick your branding",
    description: "Upload a logo and pick a primary color.",
  },
] as const;

export function WelcomeCard() {
  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to NSI Bookings</CardTitle>
          <CardDescription>
            Get your booking page live in three quick steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {NEXT_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.href}
                href={step.href}
                className="rounded-lg border p-4 hover:bg-muted/60 transition"
              >
                <Icon className="h-5 w-5 text-primary mb-2" />
                <div className="font-medium">{step.title}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {step.description}
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
