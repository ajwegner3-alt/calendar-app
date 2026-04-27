"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import type { BookingStatusFilter } from "../_lib/queries";

interface FiltersInitial {
  status: BookingStatusFilter;
  from: string;
  to: string;
  eventTypeIds: string[];
  q: string;
}

const STATUS_OPTIONS: Array<{ value: BookingStatusFilter; label: string }> = [
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
];

export function BookingsFilters({
  initial,
  eventTypes,
}: {
  initial: FiltersInitial;
  eventTypes: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state for the search input (debounced) so typing feels snappy.
  // All other filters write to the URL immediately on change.
  const [searchValue, setSearchValue] = useState(initial.q);

  // Helper: update URL params, always reset page=1 on filter change.
  const writeParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page"); // any filter change resets pagination
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  function handleStatusChange(value: string) {
    writeParams((p) => {
      if (value === "upcoming") {
        // Default — drop the param to keep URLs clean.
        p.delete("status");
      } else {
        p.set("status", value);
      }
    });
  }

  function handleDateChange(field: "from" | "to", value: string) {
    writeParams((p) => {
      if (value) p.set(field, value);
      else p.delete(field);
    });
  }

  function handleEventTypeToggle(id: string, checked: boolean) {
    writeParams((p) => {
      const current = p.getAll("event_type");
      const next = checked
        ? Array.from(new Set([...current, id]))
        : current.filter((v) => v !== id);
      p.delete("event_type");
      next.forEach((v) => p.append("event_type", v));
    });
  }

  // Debounced URL write for search (400ms — RESEARCH §6 lock for typing inputs).
  const debouncedSearchUpdate = useDebouncedCallback((value: string) => {
    writeParams((p) => {
      if (value.trim()) p.set("q", value.trim());
      else p.delete("q");
    });
  }, 400);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearchUpdate(value);
  }

  const selectedEventTypeNames = eventTypes
    .filter((et) => initial.eventTypeIds.includes(et.id))
    .map((et) => et.name);

  const eventTypeButtonLabel =
    selectedEventTypeNames.length === 0
      ? "All event types"
      : selectedEventTypeNames.length === 1
        ? selectedEventTypeNames[0]
        : `${selectedEventTypeNames.length} selected`;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5 min-w-40">
        <Label htmlFor="bookings-status">Status</Label>
        <Select value={initial.status} onValueChange={handleStatusChange}>
          <SelectTrigger id="bookings-status" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bookings-from">From</Label>
        <Input
          id="bookings-from"
          type="date"
          className="w-40"
          defaultValue={initial.from}
          onChange={(e) => handleDateChange("from", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bookings-to">To</Label>
        <Input
          id="bookings-to"
          type="date"
          className="w-40"
          defaultValue={initial.to}
          onChange={(e) => handleDateChange("to", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5 min-w-48">
        <Label>Event type</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-48 justify-between font-normal"
            >
              <span className="truncate">{eventTypeButtonLabel}</span>
              <ChevronDown className="size-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) max-h-72"
          >
            {eventTypes.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No event types
              </div>
            ) : (
              eventTypes.map((et) => (
                <DropdownMenuCheckboxItem
                  key={et.id}
                  checked={initial.eventTypeIds.includes(et.id)}
                  onCheckedChange={(checked) =>
                    handleEventTypeToggle(et.id, !!checked)
                  }
                  // Prevent the menu from auto-closing on each toggle so users
                  // can multi-select without re-opening.
                  onSelect={(e) => e.preventDefault()}
                >
                  {et.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 min-w-56">
        <Label htmlFor="bookings-search">Search</Label>
        <Input
          id="bookings-search"
          type="search"
          placeholder="Search booker name or email"
          value={searchValue}
          onChange={handleSearchChange}
        />
      </div>
    </div>
  );
}
