"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { bookingInputSchema, type BookingInput } from "@/lib/bookings/schema";
import type { CustomQuestion, EventTypeSummary } from "../_lib/types";

// RHF holds only the fields the user fills in; the remaining BookingInput
// fields (eventTypeId, startAt, endAt, bookerTimezone, turnstileToken) are
// layered in at submit time from props/state.
const formOnlySchema = bookingInputSchema.pick({
  bookerName: true,
  bookerEmail: true,
  bookerPhone: true,
  answers: true,
});
type FormValues = z.infer<typeof formOnlySchema>;

interface BookingFormProps {
  accountSlug: string;
  eventType: EventTypeSummary;
  selectedSlot: { start_at: string; end_at: string };
  bookerTimezone: string;
  onRaceLoss: (message?: string) => void; // CAP-07: optional message for branched 409 copy
}

/** Stable key for a custom question — use id if present, fallback to label. */
function questionKey(q: CustomQuestion): string {
  return q.id ?? q.label;
}

export function BookingForm(props: BookingFormProps) {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance>(null);

  const initialAnswers = Object.fromEntries(
    props.eventType.custom_questions.map((q) => [questionKey(q), ""]),
  );

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formOnlySchema) as any,
    defaultValues: {
      bookerName: "",
      bookerEmail: "",
      bookerPhone: "",
      answers: initialAnswers,
    },
    mode: "onSubmit",
  });

  // The async callback below only runs when the form's onSubmit fires (an
  // event handler); turnstileRef.current is always read after render. The
  // linter can't statically prove that handleSubmit's return value is invoked
  // outside render, so we disable react-hooks/refs here. Safe per
  // https://react.dev/reference/react/useRef (refs in event handlers).
  // eslint-disable-next-line react-hooks/refs
  const onSubmit = form.handleSubmit(async (values) => {
    const token = turnstileRef.current?.getResponse();
    if (!token) {
      toast.error("Please wait for the security check to complete.");
      return;
    }

    const body: BookingInput = {
      eventTypeId: props.eventType.id,
      startAt: props.selectedSlot.start_at,
      endAt: props.selectedSlot.end_at,
      bookerTimezone: props.bookerTimezone,
      turnstileToken: token,
      bookerName: values.bookerName,
      bookerEmail: values.bookerEmail,
      bookerPhone: values.bookerPhone,
      answers: values.answers,
    };

    let res: Response;
    try {
      res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      toast.error("Network error. Check your connection and try again.");
      turnstileRef.current?.reset();
      return;
    }

    if (res.status === 201) {
      const data = (await res.json().catch(() => null)) as {
        redirectTo?: string;
      } | null;
      if (data?.redirectTo) {
        router.push(data.redirectTo);
      } else {
        router.push(
          `/${props.accountSlug}/${props.eventType.slug}/confirmed/unknown`,
        );
      }
      return;
    }

    if (res.status === 409) {
      // Race-loser / capacity-full: read code to surface the right message.
      const body409 = (await res.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      let raceMessage: string;
      if (body409?.code === "SLOT_CAPACITY_REACHED") {
        // CAP-07: slot had capacity>1 but all seats are now taken
        raceMessage = "That time is fully booked. Please choose a different time.";
      } else if (body409?.code === "SLOT_TAKEN") {
        // CAP-07: capacity=1 race (or any single-seat taken path)
        raceMessage = "That time was just taken by another booker. Please choose a different time.";
      } else if (body409?.code === "CROSS_EVENT_CONFLICT") {
        // V14-MP-01 (Phase 27): cross-event-type overlap (DB EXCLUDE constraint).
        // Generic wording — booker has no concept of event types and we do NOT
        // leak that the contractor has another appointment.
        raceMessage = "That time is no longer available. Please choose a different time.";
      } else {
        // Defensive fallback — unknown code or missing body
        raceMessage = body409?.error ?? "That time is no longer available. Please choose a different time.";
      }
      // Parent clears selectedSlot + bumps refetchKey; preserve form values.
      props.onRaceLoss(raceMessage);
      turnstileRef.current?.reset();
      return;
    }

    if (res.status === 400) {
      const data = (await res.json().catch(() => null)) as {
        fieldErrors?: Record<string, string[]>;
      } | null;
      if (data?.fieldErrors) {
        for (const [field, msgs] of Object.entries(data.fieldErrors)) {
          form.setError(field as keyof FormValues, {
            message: msgs?.[0] ?? "Invalid value.",
          });
        }
      } else {
        toast.error("Validation failed. Check your input and try again.");
      }
      turnstileRef.current?.reset();
      return;
    }

    if (res.status === 403) {
      toast.error("Bot check failed. Please refresh and try again.");
      turnstileRef.current?.reset();
      return;
    }

    // 5xx or any other unexpected status
    toast.error("Something went wrong. Please try again.");
    turnstileRef.current?.reset();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Contact fields: name → email → phone (CONTEXT decision #3) */}
      <div className="space-y-1">
        <Label htmlFor="bookerName">Name</Label>
        <Input
          id="bookerName"
          placeholder="Your name"
          autoComplete="name"
          {...form.register("bookerName")}
        />
        {form.formState.errors.bookerName && (
          <p className="text-sm text-destructive">
            {form.formState.errors.bookerName.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="bookerEmail">Email</Label>
        <Input
          id="bookerEmail"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          {...form.register("bookerEmail")}
        />
        {form.formState.errors.bookerEmail && (
          <p className="text-sm text-destructive">
            {form.formState.errors.bookerEmail.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="bookerPhone">Phone</Label>
        <Input
          id="bookerPhone"
          type="tel"
          placeholder="(555) 123-4567"
          autoComplete="tel"
          {...form.register("bookerPhone")}
        />
        {form.formState.errors.bookerPhone && (
          <p className="text-sm text-destructive">
            {form.formState.errors.bookerPhone.message}
          </p>
        )}
      </div>

      {/* Custom questions below contact fields (CONTEXT decision #3) */}
      {props.eventType.custom_questions.map((q) => (
        <CustomQuestionField
          key={questionKey(q)}
          question={q}
          form={form}
        />
      ))}

      {/* Managed Turnstile widget — visible, no size="invisible" (CONTEXT decision #4) */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          We use Cloudflare to verify you&rsquo;re human.
        </p>
        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        />
      </div>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full"
        style={{
          background: "var(--brand-primary, #0A2540)",
          color: "var(--brand-text, #ffffff)",
        }}
      >
        {form.formState.isSubmitting ? "Booking\u2026" : "Book this time"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Custom question renderer
// ---------------------------------------------------------------------------

interface CustomQuestionFieldProps {
  question: CustomQuestion;
  form: ReturnType<typeof useForm<FormValues>>;
}

function CustomQuestionField({ question, form }: CustomQuestionFieldProps) {
  const key = questionKey(question);
  const fieldPath = `answers.${key}` as const;
  const error = (form.formState.errors.answers as Record<string, { message?: string }> | undefined)?.[key];

  const label = (
    <Label htmlFor={`q-${key}`}>
      {question.label}
      {question.required && (
        <span className="ml-1 text-destructive" aria-hidden>
          *
        </span>
      )}
    </Label>
  );

  switch (question.type) {
    case "short_text":
    default:
      return (
        <div className="space-y-1">
          {label}
          <Input
            id={`q-${key}`}
            {...form.register(fieldPath, {
              required: question.required ? `${question.label} is required.` : false,
            })}
          />
          {error && (
            <p className="text-sm text-destructive">{error.message}</p>
          )}
        </div>
      );

    case "long_text":
      return (
        <div className="space-y-1">
          {label}
          <Textarea
            id={`q-${key}`}
            rows={3}
            {...form.register(fieldPath, {
              required: question.required ? `${question.label} is required.` : false,
            })}
          />
          {error && (
            <p className="text-sm text-destructive">{error.message}</p>
          )}
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          {label}
          <Controller
            control={form.control}
            name={fieldPath}
            rules={{
              required: question.required ? `${question.label} is required.` : false,
            }}
            render={({ field }) => (
              <Select value={field.value as string} onValueChange={field.onChange}>
                <SelectTrigger id={`q-${key}`}>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {(question.options ?? []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {error && (
            <p className="text-sm text-destructive">{error.message}</p>
          )}
        </div>
      );

    case "radio":
      return (
        <div className="space-y-1">
          {label}
          <div className="flex flex-col gap-2 pt-1">
            {(question.options ?? []).map((opt) => {
              const radioId = `q-${key}-${opt}`;
              return (
                <label key={opt} htmlFor={radioId} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Controller
                    control={form.control}
                    name={fieldPath}
                    rules={{
                      required: question.required ? `${question.label} is required.` : false,
                    }}
                    render={({ field }) => (
                      <input
                        id={radioId}
                        type="radio"
                        value={opt}
                        checked={field.value === opt}
                        onChange={() => field.onChange(opt)}
                        className="accent-primary"
                      />
                    )}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
          {error && (
            <p className="text-sm text-destructive">{error.message}</p>
          )}
        </div>
      );
  }
}
