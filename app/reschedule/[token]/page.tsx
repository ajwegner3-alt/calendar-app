import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { TokenNotActive } from "@/app/_components/token-not-active";
import { resolveRescheduleToken } from "./_lib/resolve-reschedule-token";
import { RescheduleShell } from "./_components/reschedule-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  return {
    title: "Reschedule booking",
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ReschedulePage({ params }: PageProps) {
  const { token } = await params;
  const resolved = await resolveRescheduleToken(token);

  if (resolved.state === "not_active") {
    return <TokenNotActive ownerEmail={null} />;
  }

  const booking = resolved.booking!;
  const account = resolved.account!;
  const eventType = resolved.eventType!;
  const tokenHash = resolved.tokenHash!;

  // Old slot reference line in BOOKER TZ (server-rendered; client may re-render in detected browser TZ)
  const oldStartTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const oldDate = format(oldStartTz, "EEEE, MMMM d, yyyy");
  const oldTime = format(oldStartTz, "h:mm a (z)");

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold mb-2">Reschedule your booking</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Pick a new time for your appointment with <strong>{account.name}</strong>.
        </p>
        <p className="text-sm bg-muted/50 rounded-md px-3 py-2 mb-6">
          <span className="text-muted-foreground">Currently scheduled:</span>{" "}
          <span className="font-medium">{oldDate}, {oldTime}</span>
        </p>

        <RescheduleShell
          token={token}
          tokenHash={tokenHash}
          accountSlug={account.slug}
          accountTimezone={account.timezone}
          accountName={account.name}
          ownerEmail={account.owner_email}
          eventTypeId={eventType.id}
          eventTypeSlug={eventType.slug}
          eventTypeName={eventType.name}
          durationMinutes={eventType.duration_minutes}
          oldStartAt={booking.start_at}
          bookerTimezoneInitial={booking.booker_timezone}
        />
      </div>
    </div>
  );
}
