"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState } from "react";
import { saveStep1Action } from "../actions";
import { step1Schema } from "../schema";
import type { z } from "zod";

type FormData = z.infer<typeof step1Schema>;

type SlugStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "reserved" }
  | { state: "taken"; suggestions: string[] }
  | { state: "invalid" }
  | { state: "error" };

function toKebab(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function AccountForm() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: { name: "", slug: "" },
  });

  const [actionState, formAction, isPending] = useActionState(
    saveStep1Action,
    null,
  );

  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ state: "idle" });
  const slugTouched = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nameValue = watch("name");
  const slugValue = watch("slug");

  // Auto-suggest slug from name when slug hasn't been manually edited.
  useEffect(() => {
    if (slugTouched.current) return;
    if (!nameValue) return;
    const kebab = toKebab(nameValue);
    if (kebab) setValue("slug", kebab);
  }, [nameValue, setValue]);

  // Debounced slug availability check.
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const slugToCheck = slugValue;
    if (!slugToCheck || !/^[a-z0-9-]{3,40}$/.test(slugToCheck)) {
      setSlugStatus({ state: slugToCheck ? "invalid" : "idle" });
      return;
    }

    setSlugStatus({ state: "checking" });
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/check-slug?slug=${encodeURIComponent(slugToCheck)}`,
        );
        if (!res.ok) {
          setSlugStatus({ state: "error" });
          return;
        }
        const json = (await res.json()) as {
          available: boolean;
          reason?: string;
          suggestions?: string[];
        };

        if (json.available) {
          setSlugStatus({ state: "available" });
        } else if (json.reason === "reserved") {
          setSlugStatus({ state: "reserved" });
        } else if (json.reason === "taken") {
          setSlugStatus({ state: "taken", suggestions: json.suggestions ?? [] });
        } else {
          setSlugStatus({ state: "invalid" });
        }
      } catch {
        setSlugStatus({ state: "error" });
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [slugValue]);

  return (
    <form
      action={formAction}
      className="space-y-5"
    >
      {/* Business name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700"
        >
          Business name
        </label>
        <input
          id="name"
          type="text"
          placeholder="Acme HVAC"
          {...register("name")}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        )}
      </div>

      {/* Slug / URL */}
      <div>
        <label
          htmlFor="slug"
          className="block text-sm font-medium text-gray-700"
        >
          Your booking URL
        </label>
        <div className="mt-1 flex items-center rounded-md border border-gray-300 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          <span className="rounded-l-md bg-gray-50 px-3 py-2 text-sm text-gray-400 border-r border-gray-300 select-none">
            calendar-app.vercel.app/
          </span>
          <input
            id="slug"
            type="text"
            placeholder="acme-hvac"
            {...register("slug", {
              onChange: () => {
                slugTouched.current = true;
              },
            })}
            className="flex-1 rounded-r-md px-3 py-2 text-sm focus:outline-none"
          />
        </div>
        {errors.slug && (
          <p className="mt-1 text-xs text-red-600">{errors.slug.message}</p>
        )}

        {/* Availability indicator */}
        <div className="mt-1 min-h-[20px] text-xs">
          {slugStatus.state === "checking" && (
            <span className="text-gray-400">Checking availability...</span>
          )}
          {slugStatus.state === "available" && (
            <span className="text-green-600">Available</span>
          )}
          {slugStatus.state === "reserved" && (
            <span className="text-red-600">
              This URL is reserved and cannot be used
            </span>
          )}
          {slugStatus.state === "taken" && (
            <span className="text-red-600">
              Already taken — try{" "}
              {slugStatus.suggestions.map((s, i) => (
                <span key={s}>
                  <button
                    type="button"
                    className="underline hover:text-red-800"
                    onClick={() => {
                      setValue("slug", s);
                      slugTouched.current = true;
                    }}
                  >
                    {s}
                  </button>
                  {i < slugStatus.suggestions.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          )}
          {slugStatus.state === "invalid" && (
            <span className="text-gray-400">
              3–40 lowercase letters, numbers, or hyphens
            </span>
          )}
          {slugStatus.state === "error" && (
            <span className="text-gray-400">
              Could not check — will verify on save
            </span>
          )}
        </div>
      </div>

      {/* Server action error */}
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
