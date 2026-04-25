"use client";

import { useMemo, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { deleteDateOverrideAction } from "../_lib/actions";
import type { DateOverrideRow } from "../_lib/types";

export interface OverridesListProps {
  overrides: DateOverrideRow[];
  onEdit: (override_date: string) => void;
}

interface GroupedOverride {
  override_date: string;
  is_closed: boolean;
  windows: Array<{ start_minute: number; end_minute: number }>;
  note: string | null;
}

function groupOverrides(rows: DateOverrideRow[]): GroupedOverride[] {
  const map = new Map<string, GroupedOverride>();
  for (const r of rows) {
    const existing = map.get(r.override_date);
    if (!existing) {
      map.set(r.override_date, {
        override_date: r.override_date,
        is_closed: r.is_closed,
        windows:
          r.is_closed
            ? []
            : r.start_minute !== null && r.end_minute !== null
              ? [{ start_minute: r.start_minute, end_minute: r.end_minute }]
              : [],
        note: r.note,
      });
    } else if (!r.is_closed && r.start_minute !== null && r.end_minute !== null) {
      existing.windows.push({
        start_minute: r.start_minute,
        end_minute: r.end_minute,
      });
    }
  }
  // Sort by date ascending; sort each group's windows by start_minute.
  const out = Array.from(map.values());
  out.sort((a, b) => (a.override_date < b.override_date ? -1 : 1));
  for (const g of out) g.windows.sort((a, b) => a.start_minute - b.start_minute);
  return out;
}

function minutesToHHMM(m: number): string {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDate(s: string): string {
  // s = "YYYY-MM-DD" — render as e.g. "Sun, Mar 8, 2026" using local TZ.
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function OverridesList({ overrides, onEdit }: OverridesListProps) {
  const grouped = useMemo(() => groupOverrides(overrides), [overrides]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRemove(override_date: string) {
    startTransition(async () => {
      const result = await deleteDateOverrideAction(override_date);
      if (result.formError) {
        toast.error(result.formError);
        return;
      }
      toast.success("Override removed.");
      router.refresh();
    });
  }

  if (grouped.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No date overrides yet. Use the calendar above or click &ldquo;Add
        override&rdquo;.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {grouped.map((g) => (
        <Card key={g.override_date}>
          <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="font-medium">{formatDate(g.override_date)}</span>
              {g.is_closed ? (
                <Badge variant="destructive">Blocked</Badge>
              ) : (
                <Badge variant="secondary">Custom hours</Badge>
              )}
              <span className="text-muted-foreground text-sm">
                {g.is_closed
                  ? "All day"
                  : g.windows
                      .map(
                        (w) =>
                          `${minutesToHHMM(w.start_minute)}\u2013${minutesToHHMM(w.end_minute)}`,
                      )
                      .join(", ")}
              </span>
              {g.note && (
                <span className="text-muted-foreground truncate text-xs">
                  {g.note}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(g.override_date)}
                disabled={isPending}
              >
                <Pencil className="mr-1 size-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(g.override_date)}
                disabled={isPending}
                aria-label={`Remove override for ${formatDate(g.override_date)}`}
              >
                <Trash2 className="mr-1 size-3.5" />
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
