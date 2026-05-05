"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { DateOverrideRow } from "../_lib/types";

import { OverridesCalendar } from "./overrides-calendar";
import { OverridesList } from "./overrides-list";
import { OverrideModal } from "./override-modal";

export interface DateOverridesSectionProps {
  overrides: DateOverrideRow[];
  /** IANA tz (e.g. "America/Chicago") used by the override modal to format
   *  affected-booking times in the inverse-override preview. */
  accountTimezone: string;
}

export function DateOverridesSection({
  overrides,
  accountTimezone,
}: DateOverridesSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function openForDate(date: string) {
    setSelectedDate(date);
    setModalOpen(true);
  }

  function openForAdd() {
    setSelectedDate(null);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={openForAdd}>
          <Plus className="mr-2 size-4" />
          Add override
        </Button>
      </div>

      <OverridesCalendar overrides={overrides} onDayClick={openForDate} />

      <OverridesList overrides={overrides} onEdit={openForDate} />

      <OverrideModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialDate={selectedDate}
        allOverrides={overrides}
        accountTimezone={accountTimezone}
      />
    </div>
  );
}
