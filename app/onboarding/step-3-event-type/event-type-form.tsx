"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState } from "react";
import { completeOnboardingAction } from "../actions";
import { step3Schema } from "../schema";
import type { z } from "zod";

type FormData = z.infer<typeof step3Schema>;

const DURATION_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 20, label: "20 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

export function EventTypeForm() {
  const {
    register,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      name: "Consultation",
      duration_minutes: 30,
    },
  });

  const [actionState, formAction, isPending] = useActionState(
    completeOnboardingAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      {/* Event type name */}
      <div>
        <label
          htmlFor="event-name"
          className="block text-sm font-medium text-gray-700"
        >
          Appointment name
        </label>
        <input
          id="event-name"
          type="text"
          placeholder="Consultation"
          {...register("name")}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        )}
      </div>

      {/* Duration */}
      <div>
        <label
          htmlFor="duration"
          className="block text-sm font-medium text-gray-700"
        >
          Duration
        </label>
        <select
          id="duration"
          {...register("duration_minutes", { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.duration_minutes && (
          <p className="mt-1 text-xs text-red-600">
            {errors.duration_minutes.message}
          </p>
        )}
      </div>

      <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
        This event type is required. You can rename it or add more types from
        your dashboard after setup.
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
        {isPending ? "Finishing setup..." : "Finish setup"}
      </button>
    </form>
  );
}
