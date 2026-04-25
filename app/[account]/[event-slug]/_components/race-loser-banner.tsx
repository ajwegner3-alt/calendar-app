"use client";

interface Props {
  visible: boolean;
}

export function RaceLoserBanner({ visible }: Props) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      That time was just booked. Pick a new time below.
    </div>
  );
}
