"use client";

interface Props {
  visible: boolean;
  message?: string; // CAP-07: optional override; defaults to v1.0 message when absent
}

export function RaceLoserBanner({ visible, message }: Props) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message ?? "That time was just booked. Pick a new time below."}
    </div>
  );
}
