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

export function EventTypesTable({
  eventTypes,
  showArchived,
  accountSlug,
  appUrl,
}: {
  eventTypes: EventTypeListItem[];
  showArchived: boolean;
  accountSlug: string;
  appUrl: string;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-28">Duration</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-12 text-right">
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
                  <RowActionsMenu
                    id={et.id}
                    name={et.name}
                    slug={et.slug}
                    isActive={et.is_active}
                    isArchived={!!et.deleted_at}
                    accountSlug={accountSlug}
                    appUrl={appUrl}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
