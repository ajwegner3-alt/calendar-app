"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState } from "react";
import { saveStep2Action } from "../actions";
import { step2Schema } from "../schema";
import type { z } from "zod";

type FormData = z.infer<typeof step2Schema>;

// Common IANA timezone list for the select element.
// A full list would be hundreds of entries; this covers the most common zones.
// Phase 12 can swap for a proper combobox + Intl.supportedValuesOf("timeZone").
const COMMON_TIMEZONES = [
  // Americas
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  // Europe
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Helsinki",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  // Africa
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  // Asia
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  // Pacific
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
];

export function TimezoneForm() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: { timezone: "America/Chicago" },
  });

  const [actionState, formAction, isPending] = useActionState(
    saveStep2Action,
    null,
  );

  // Auto-detect timezone on mount.
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setValue("timezone", detected);
    } catch {
      // Fall back to default.
    }
  }, [setValue]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label
          htmlFor="timezone"
          className="block text-sm font-medium text-gray-700"
        >
          Timezone
        </label>
        <select
          id="timezone"
          {...register("timezone")}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {errors.timezone && (
          <p className="mt-1 text-xs text-red-600">{errors.timezone.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          Auto-detected from your browser. Adjust if needed.
        </p>
      </div>

      {actionState && "error" in actionState && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {actionState.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Continue"}
      </button>
    </form>
  );
}
