/**
 * ConsultTierCard — Server Component (Phase 42.5-05, LD-16)
 *
 * The Branding tier card. Pure server-rendered HTML link — NO interactivity,
 * NO Stripe checkout call, NO database write.
 *
 * Constraints from LD-16:
 *   - Same-window navigation (no `target="_blank"`).
 *   - No `onClick` handler — it's a plain anchor wrapped in our Button styling.
 *   - The `bookingUrl` prop is read in the parent server component (page.tsx)
 *     from `process.env.NSI_BRANDING_BOOKING_URL`. This component MUST NOT
 *     touch process.env directly so that env-var reads happen at the page
 *     boundary and don't leak into client bundles.
 *
 * Intentionally NOT marked `"use client"`.
 */

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ConsultTierCardProps {
  bookingUrl: string;
}

export function ConsultTierCard({ bookingUrl }: ConsultTierCardProps) {
  return (
    <Card data-tier="branding">
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Custom design + personal onboarding. Talk to us.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tailored visual identity for your booking experience. Pricing varies
          based on scope.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="lg" className="w-full" asChild>
          <a href={bookingUrl}>Book a consultation</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
