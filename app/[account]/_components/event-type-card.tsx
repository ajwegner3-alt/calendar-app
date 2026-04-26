import Link from "next/link";
import type { CSSProperties } from "react";
import type { EventTypeCardData } from "../_lib/types";
import { pickTextColor } from "@/lib/branding/contrast";

const DESC_TRUNCATE_AT = 120; // CONTEXT lock

interface EventTypeCardProps {
  accountSlug: string;
  event: EventTypeCardData;
  brandPrimary: string | null;
}

export function EventTypeCard({
  accountSlug,
  event,
  brandPrimary,
}: EventTypeCardProps) {
  const desc = event.description ?? "";
  const truncated =
    desc.length > DESC_TRUNCATE_AT
      ? desc.slice(0, DESC_TRUNCATE_AT - 1).trimEnd() + "\u2026"
      : desc;

  const effectiveColor = brandPrimary ?? "#0A2540";
  const textColor = pickTextColor(effectiveColor);

  const badgeStyle: CSSProperties = {
    background: effectiveColor,
    color: textColor,
    padding: "2px 10px",
    borderRadius: "9999px",
    fontSize: 12,
    fontWeight: 600,
    display: "inline-block",
  };

  const ctaStyle: CSSProperties = {
    background: effectiveColor,
    color: textColor,
  };

  // Whole card is a Link (CONTEXT lock: whole card clickable)
  return (
    <Link
      href={`/${accountSlug}/${event.slug}`}
      className="block rounded-lg border bg-card p-6 hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold">{event.name}</h2>
        <span style={badgeStyle}>{event.duration_minutes} min</span>
      </div>
      {truncated && (
        <p className="text-sm text-muted-foreground mb-4">{truncated}</p>
      )}
      <span
        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium"
        style={ctaStyle}
      >
        Book
      </span>
    </Link>
  );
}
