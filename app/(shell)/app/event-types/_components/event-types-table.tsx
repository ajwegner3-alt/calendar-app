"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventTypeListItem } from "../_lib/types";
import { StatusBadge } from "./status-badge";
import { RowActionsMenu } from "./row-actions-menu";
import { RowCopyLinkButton } from "./row-copy-link-button";

export function EventTypesTable({
  eventTypes,
  // showArchived is part of the table's API contract (parent passes it for
  // future filter UI hints) but is currently unused inside this component —
  // filtering is server-driven via searchParams. Keep prop, mark intentional.
  showArchived: _showArchived,
  accountSlug,
  appUrl,
  isWidgetAllowed,
}: {
  eventTypes: EventTypeListItem[];
  showArchived: boolean;
  accountSlug: string;
  appUrl: string;
  isWidgetAllowed: boolean; // Phase 42.6 — server-side widget-tier gate
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-28">Duration</TableHead>
            {/* Phase 28 LD-01: Buffer column. Always rendered, including 0 values
                (CONTEXT lock: never hide). Placed after Duration to mirror the
                editor's Duration → Buffer pairing. */}
            <TableHead className="w-28">Buffer</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-24 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {eventTypes.map((et) => {
            const rowClass = et.deleted_at
              ? "opacity-50 [&>td]:line-through"
              : !et.is_active
                ? "opacity-60"
                : "";
            return (
              <TableRow key={et.id} className={rowClass}>
                <TableCell className="font-medium">{et.name}</TableCell>
                <TableCell>{et.duration_minutes} min</TableCell>
                {/* Phase 28 LD-01: per-event-type buffer (always shown, even 0). */}
                <TableCell>{et.buffer_after_minutes} min</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {et.slug}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    isActive={et.is_active}
                    deletedAt={et.deleted_at}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!et.deleted_at && (
                      <RowCopyLinkButton
                        accountSlug={accountSlug}
                        eventSlug={et.slug}
                        eventName={et.name}
                        appUrl={appUrl}
                      />
                    )}
                    <RowActionsMenu
                      id={et.id}
                      name={et.name}
                      slug={et.slug}
                      isActive={et.is_active}
                      isArchived={!!et.deleted_at}
                      accountSlug={accountSlug}
                      appUrl={appUrl}
                      isWidgetAllowed={isWidgetAllowed}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
