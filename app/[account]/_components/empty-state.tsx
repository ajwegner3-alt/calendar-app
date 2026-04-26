interface AccountEmptyStateProps {
  accountName: string;
  ownerEmail: string | null;
}

export function AccountEmptyState({
  accountName,
  ownerEmail,
}: AccountEmptyStateProps) {
  return (
    <div className="rounded-lg border bg-card p-10 text-center">
      <h2 className="text-lg font-semibold mb-2">
        No bookings available right now
      </h2>
      {ownerEmail ? (
        <p className="text-sm text-muted-foreground">
          Reach out to {accountName} at{" "}
          <a
            href={`mailto:${ownerEmail}`}
            className="underline underline-offset-2 hover:no-underline"
          >
            {ownerEmail}
          </a>
          .
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Check back later or contact {accountName} for availability.
        </p>
      )}
    </div>
  );
}
