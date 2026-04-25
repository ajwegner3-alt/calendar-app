---
phase: 05-public-booking-flow
plan: 06
type: execute
wave: 3
depends_on: ["05-04", "05-05"]
files_modified:
  - app/[account]/[event-slug]/_components/booking-shell.tsx
  - app/[account]/[event-slug]/_components/slot-picker.tsx
  - app/[account]/[event-slug]/_components/booking-form.tsx
  - app/[account]/[event-slug]/_components/race-loser-banner.tsx
  - app/[account]/[event-slug]/page.tsx
autonomous: true

must_haves:
  truths:
    - "BookingShell ('use client') manages step state: 'pick-slot' → 'fill-form' → 'submitting'; and owns the 'Times shown in [browserTz]' line above the slot list (BOOK-02)"
    - "browserTz detected on mount via Intl.DateTimeFormat().resolvedOptions().timeZone; falls back to account.timezone if undefined (SSR safety)"
    - "SlotPicker shows shadcn Calendar (left desktop / top mobile) + slot list (right desktop / below mobile); fetches /api/slots on date selection (BOOK-03)"
    - "Calendar renders accent-color dots under dates that have any open slot (Phase 4 pattern reuse — same react-day-picker modifiersClassNames technique used in date-overrides UI)"
    - "Slot list displays times in BOOKER tz (formatInTimeZone via @date-fns/tz TZDate + format)"
    - "Empty state when /api/slots returns {slots: []}: friendly message + mailto:[owner_email] link (CONTEXT decision #2)"
    - "BookingForm uses RHF + zodResolver(bookingInputSchema); contact fields first (name/email/phone all required), custom questions below (BOOK-04, CONTEXT decision #3)"
    - "Custom-question rendering follows event_type.custom_questions[].type — Phase 3 enum (short_text/long_text/select/radio); falls back to text input on unknown type"
    - "Turnstile **Managed** mode (visible widget) via @marsidev/react-turnstile; widget renders ABOVE the submit button with a small explanatory label; ref-based getResponse() before submit; on any submit error (incl 409, validation, 5xx), call turnstileRef.current.reset() (RESEARCH Pitfall 5). NO `size: 'invisible'` option — let the widget render at default Managed appearance."
    - "Form passes browserTz as bookerTimezone, the picked slot's start_at/end_at as ISO UTC strings, and the Turnstile token to /api/bookings"
    - "On 409 SLOT_TAKEN: show RaceLoserBanner ('That time was just booked. Pick a new time below.' — locked CONTEXT message); auto-refetch /api/slots for current date range; preserve all form values; reset Turnstile token; clear selected slot; do NOT clear name/email/phone/answers"
    - "On 201 success: navigate to data.redirectTo (/[account]/[event-slug]/confirmed/[booking-id]) via router.push() — full-page navigation OK (server component on confirmation page does its own data load)"
    - "On 400 validation error: surface fieldErrors via RHF setError; reset Turnstile"
    - "On 403 Turnstile fail: toast.error + reset Turnstile (rare; only happens if Cloudflare verification fails)"
    - "On 5xx: toast.error('Something went wrong. Please try again.') + reset Turnstile"
    - "page.tsx swap: replace inline BookingShell stub (Plan 05-04 placeholder) with real import — uses the PLAN-05-06-REPLACE-* markers locked there"
  artifacts:
    - path: "app/[account]/[event-slug]/_components/booking-shell.tsx"
      provides: "Client root: TZ detection, step state, mounts SlotPicker + BookingForm"
      contains: "BookingShell\\|use client"
      exports: ["BookingShell"]
      min_lines: 80
    - path: "app/[account]/[event-slug]/_components/slot-picker.tsx"
      provides: "Calendar + slot list; fetches /api/slots; emits selected slot up"
      contains: "Calendar\\|/api/slots"
      exports: ["SlotPicker"]
      min_lines: 100
    - path: "app/[account]/[event-slug]/_components/booking-form.tsx"
      provides: "RHF form with Turnstile + custom questions"
      contains: "useForm\\|Turnstile\\|turnstileRef"
      exports: ["BookingForm"]
      min_lines: 100
    - path: "app/[account]/[event-slug]/_components/race-loser-banner.tsx"
      provides: "Inline red banner for 409 SLOT_TAKEN UX"
      contains: "Pick a new time below"
      exports: ["RaceLoserBanner"]
      min_lines: 15
  key_links:
    - from: "_components/slot-picker.tsx"
      to: "/api/slots"
      via: "fetch(`/api/slots?event_type_id=${eventType.id}&from=${YYYY-MM-DD}&to=${YYYY-MM-DD}`)"
      pattern: "/api/slots"
    - from: "_components/booking-form.tsx"
      to: "/api/bookings"
      via: "fetch('/api/bookings', { method: 'POST', body: JSON.stringify({...form, turnstileToken, startAt, endAt, bookerTimezone}) })"
      pattern: "/api/bookings"
    - from: "_components/booking-form.tsx"
      to: "@marsidev/react-turnstile"
      via: "<Turnstile ref={turnstileRef} siteKey={NEXT_PUBLIC_TURNSTILE_SITE_KEY} />"
      pattern: "TurnstileInstance\\|@marsidev/react-turnstile"
    - from: "_components/booking-shell.tsx"
      to: "Intl.DateTimeFormat"
      via: "useEffect(() => setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone), [])"
      pattern: "Intl.DateTimeFormat"
    - from: "page.tsx (Plan 05-04)"
      to: "BookingShell"
      via: "import { BookingShell } from './_components/booking-shell'"
      pattern: "BookingShell"
---

<objective>
Build the four client components that fill the public booking page: a top-level shell (TZ detection + step state), a calendar + slot picker, the booking form (RHF + Turnstile + custom questions), and the race-loser banner. Patch `page.tsx` to import the real `BookingShell` (replacing the Plan 05-04 placeholder).

Purpose: BOOK-02 (browser TZ detection + slot display in booker local), BOOK-03 (calendar + slot picker), BOOK-04 (form with name/email/phone + custom questions), BOOK-07 (Turnstile protection), and the inline 409 race-loser UX (CONTEXT decision #5).

Output: Four `_components/*.tsx` files plus a small surgical patch to `page.tsx`. After this plan, the booking page is fully interactive end-to-end (visitor → calendar → slot → form → submit → /api/bookings → redirect).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-public-booking-flow/05-CONTEXT.md
@.planning/phases/05-public-booking-flow/05-RESEARCH.md
@.planning/phases/05-public-booking-flow/05-04-SUMMARY.md
@.planning/phases/05-public-booking-flow/05-05-SUMMARY.md

# Page shell + types from Plan 05-04
@app/[account]/[event-slug]/page.tsx
@app/[account]/[event-slug]/_lib/types.ts

# Schema (isomorphic — used by RHF resolver here)
@lib/bookings/schema.ts

# Phase 3 RHF/zodResolver pattern (direct-call action; we adapt for fetch())
@app/(shell)/app/event-types/_components/event-type-form.tsx
@app/(shell)/app/event-types/_components/question-list.tsx

# Phase 4 calendar marker pattern (modifiersClassNames + dot CSS)
@app/(shell)/app/availability/_components/overrides-calendar.tsx
@app/globals.css

# Sonner toast (already mounted in root layout — Phase 3)
@components/ui/sonner.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: SlotPicker + RaceLoserBanner</name>
  <files>app/[account]/[event-slug]/_components/slot-picker.tsx, app/[account]/[event-slug]/_components/race-loser-banner.tsx</files>
  <action>
**`race-loser-banner.tsx`:**

```tsx
"use client";

interface Props {
  visible: boolean;
}

export function RaceLoserBanner({ visible }: Props) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      That time was just booked. Pick a new time below.
    </div>
  );
}
```

**`slot-picker.tsx`:**

The component:
- Receives: `eventTypeId`, `accountTimezone`, `bookerTimezone`, `ownerEmail` (for empty state mailto), `selectedDate`, `onSelectDate`, `selectedSlot`, `onSelectSlot`, `refetchKey` (bumping this triggers a re-fetch — used by 409 UX).
- Owns: `slots: Slot[]`, `loading: boolean`, `dateMarkers: Set<YYYY-MM-DD>` for calendar dots.
- Strategy:
  - On mount, fetch a 30-day window starting today (`from = today_in_account_tz`, `to = today + 30`). Call /api/slots, dedupe slot dates, populate `dateMarkers`.
  - On date selection, narrow to the picked date and re-render slot list (same `slots` array filtered by date, OR refetch single-day for fewer rows; pick whichever is simpler — refetching single-day is fine).
  - On `refetchKey` change (parent bumps after 409), refetch the current date range immediately.
- UI:
  - shadcn `Calendar` on left (desktop, `lg:grid-cols-2`); stacks vertically on mobile.
  - Above slot list: a dim small-text line `Times shown in {bookerTz}` (CONTEXT decision #1) — passed in by parent.
  - Slot list: vertical list of buttons (one per slot), label = `format(TZDate(start_at, bookerTz), 'h:mm a')`. Hover/active states use shadcn button variants.
  - Empty state for the picked date: `No times available on this date.`
  - Empty state for the entire range (no markers, no slots): friendly copy + mailto link (CONTEXT decision #2): `No times available right now — email <a href="mailto:{ownerEmail}">{ownerEmail}</a> to book directly.` If `ownerEmail` is null, fall back to `No times available right now. Try again later.`
  - Loading state: shadcn skeleton (or simple `<div className="text-sm text-muted-foreground">Loading…</div>`).
- Calendar marker pattern: mirror Phase 4 `overrides-calendar.tsx` — `modifiersClassNames={{ hasSlots: 'day-has-slots' }}` + CSS in `globals.css` adding `::after` accent-color dot. If a `day-has-slots` class isn't yet defined, add it now near the existing `.day-blocked` / `.day-custom` rules.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export interface Slot {
  start_at: string; // ISO UTC
  end_at: string;
}

interface SlotPickerProps {
  eventTypeId: string;
  accountTimezone: string; // owner TZ
  bookerTimezone: string;  // detected; falls back to accountTimezone
  ownerEmail: string | null;
  selectedDate: string | null; // YYYY-MM-DD in booker tz
  onSelectDate: (d: string | null) => void;
  selectedSlot: Slot | null;
  onSelectSlot: (s: Slot | null) => void;
  refetchKey: number;
}

export function SlotPicker(props: SlotPickerProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute fetch range: today (in booker TZ) to today+30 days.
  const todayInBookerTz = (() => {
    const now = new TZDate(new Date(), props.bookerTimezone);
    return format(now, "yyyy-MM-dd");
  })();
  const rangeFrom = todayInBookerTz;
  const rangeTo = (() => {
    const now = new TZDate(new Date(), props.bookerTimezone);
    const plus30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return format(new TZDate(plus30, props.bookerTimezone), "yyyy-MM-dd");
  })();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/slots?event_type_id=${encodeURIComponent(props.eventTypeId)}&from=${rangeFrom}&to=${rangeTo}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(Array.isArray(data?.slots) ? data.slots : []);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load times. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.eventTypeId, rangeFrom, rangeTo, props.refetchKey]);

  // Group by date in booker TZ for marker rendering + filtering on date click.
  const slotsByDate = new Map<string, Slot[]>();
  for (const s of slots) {
    const localDate = format(new TZDate(new Date(s.start_at), props.bookerTimezone), "yyyy-MM-dd");
    if (!slotsByDate.has(localDate)) slotsByDate.set(localDate, []);
    slotsByDate.get(localDate)!.push(s);
  }
  const markedDates = new Set(slotsByDate.keys());

  const slotsForSelectedDate = props.selectedDate
    ? slotsByDate.get(props.selectedDate) ?? []
    : [];

  const isCompletelyEmpty = !loading && slots.length === 0;

  if (isCompletelyEmpty) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        {props.ownerEmail
          ? <>No times available right now — email <a className="underline" href={`mailto:${props.ownerEmail}`}>{props.ownerEmail}</a> to book directly.</>
          : <>No times available right now. Try again later.</>}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Calendar
        mode="single"
        selected={props.selectedDate ? new Date(props.selectedDate + "T00:00:00") : undefined}
        onSelect={(d) => {
          if (!d) return;
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          props.onSelectDate(`${yyyy}-${mm}-${dd}`);
          props.onSelectSlot(null); // clear slot when date changes
        }}
        modifiers={{
          hasSlots: (d) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            return markedDates.has(`${yyyy}-${mm}-${dd}`);
          },
        }}
        modifiersClassNames={{ hasSlots: "day-has-slots" }}
      />

      <div>
        <p className="text-xs text-muted-foreground mb-2">
          Times shown in {props.bookerTimezone}
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading times…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !props.selectedDate ? (
          <p className="text-sm text-muted-foreground">Pick a date to see times.</p>
        ) : slotsForSelectedDate.length === 0 ? (
          <p className="text-sm text-muted-foreground">No times available on this date.</p>
        ) : (
          <ul className="grid gap-2">
            {slotsForSelectedDate.map((s) => {
              const label = format(new TZDate(new Date(s.start_at), props.bookerTimezone), "h:mm a");
              const selected =
                props.selectedSlot?.start_at === s.start_at;
              return (
                <li key={s.start_at}>
                  <button
                    type="button"
                    onClick={() => props.onSelectSlot(s)}
                    className={
                      "w-full rounded-md border px-3 py-2 text-sm text-left transition " +
                      (selected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted")
                    }
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
```

Add (or confirm) `app/globals.css` has a rule like:

```css
.day-has-slots::after {
  content: "";
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-accent);
}
```

If `.day-blocked` / `.day-custom` already exist with similar geometry, just add `.day-has-slots` next to them and reuse the positioning.

DO NOT:
- Do NOT pass `bookerTimezone` directly to /api/slots query string. The endpoint computes slots in account TZ; the booker_timezone is for DISPLAY only (per Phase 4 contract). The slot result's UTC ISO timestamps are converted to booker TZ on this client.
- Do NOT debounce date clicks. shadcn Calendar already handles state via `selected`.
- Do NOT show grayed-out dates that have no slots — let the calendar show all dates; only the marker dots indicate availability. (Phase 7 / future polish could add `disabled` to no-slot dates; deferred.)
- Do NOT cache the /api/slots response in `useEffect`. Always fresh — endpoint already returns `Cache-Control: no-store`. Pass `cache: "no-store"` in fetch to be explicit.
  </action>
  <verify>
```bash
ls "app/[account]/[event-slug]/_components/slot-picker.tsx" "app/[account]/[event-slug]/_components/race-loser-banner.tsx"

grep -q "use client" "app/[account]/[event-slug]/_components/slot-picker.tsx" && echo "client directive ok"
grep -q "/api/slots" "app/[account]/[event-slug]/_components/slot-picker.tsx" && echo "fetch wired"
grep -q "modifiersClassNames" "app/[account]/[event-slug]/_components/slot-picker.tsx" && echo "marker pattern ok"
grep -q "Times shown in" "app/[account]/[event-slug]/_components/slot-picker.tsx" && echo "TZ line ok"
grep -q "mailto:" "app/[account]/[event-slug]/_components/slot-picker.tsx" && echo "empty-state mailto ok"

grep -q "Pick a new time below" "app/[account]/[event-slug]/_components/race-loser-banner.tsx" && echo "banner copy locked"

# globals.css (only if added)
grep -q "day-has-slots" "app/globals.css" && echo "css marker rule present"

npm run build
npm run lint
```
  </verify>
  <done>
Both files exist; SlotPicker renders calendar + slot list with markers + booker-TZ time labels + empty state with mailto. RaceLoserBanner exports a non-null UI when `visible=true`. Build + lint clean.

Commit: `feat(05-06): add slot picker + race-loser banner client components`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: BookingForm + BookingShell + page.tsx swap</name>
  <files>app/[account]/[event-slug]/_components/booking-form.tsx, app/[account]/[event-slug]/_components/booking-shell.tsx, app/[account]/[event-slug]/page.tsx</files>
  <action>
**`booking-form.tsx`:**

The form:
- RHF + zodResolver(`bookingInputSchema` — Plan 05-03). The schema requires the full input shape; we layer `eventTypeId`, `startAt`, `endAt`, `bookerTimezone`, `turnstileToken` from props/state at submit time, NOT as form fields. RHF holds: `bookerName`, `bookerEmail`, `bookerPhone`, `answers` (record).
- Custom-question rendering: iterate `eventType.custom_questions`. Render text/textarea for `short_text`/`long_text`; shadcn Select for `select`; radio group for `radio`. Required answers get RHF required: true.
- Turnstile: `<Turnstile ref={turnstileRef} siteKey={...} />` mounted **visibly** in Managed mode (no `size: "invisible"` prop). Place above the submit button with a small label like "We use Cloudflare to verify you're human." Before submit, `const token = turnstileRef.current?.getResponse()`. On any error, `turnstileRef.current?.reset()`.
- Submit handler:
  - If `selectedSlot` is null, return early (parent should not render form, but defensive).
  - Build POST body with all server-required fields.
  - `fetch('/api/bookings', { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({...}) })`.
  - Switch on response.status:
    - 201: parse `data.redirectTo`; `router.push(data.redirectTo)`.
    - 409: `onRaceLoss()` — parent clears selectedSlot + bumps refetchKey; turnstile reset.
    - 400: parse `data.fieldErrors`; loop and `setError(field, { message })`. Reset Turnstile.
    - 403: `toast.error('Bot check failed. Please refresh and try again.')`. Reset Turnstile.
    - 5xx: `toast.error('Something went wrong. Please try again.')`. Reset Turnstile.

```tsx
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
// Controller-wrapped shadcn Select / RadioGroup imports as needed.

import { bookingInputSchema, type BookingInput } from "@/lib/bookings/schema";
import type { CustomQuestion, EventTypeSummary } from "../_lib/types";

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
  onRaceLoss: () => void;
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
      toast.error("Network error. Try again.");
      turnstileRef.current?.reset();
      return;
    }

    if (res.status === 201) {
      const data = (await res.json().catch(() => null)) as { redirectTo?: string } | null;
      if (data?.redirectTo) {
        router.push(data.redirectTo);
      } else {
        router.push(`/${props.accountSlug}/${props.eventType.slug}/confirmed/unknown`);
      }
      return;
    }

    if (res.status === 409) {
      props.onRaceLoss();
      turnstileRef.current?.reset();
      return;
    }

    if (res.status === 400) {
      const data = (await res.json().catch(() => null)) as
        | { fieldErrors?: Record<string, string[]> }
        | null;
      if (data?.fieldErrors) {
        for (const [field, msgs] of Object.entries(data.fieldErrors)) {
          form.setError(field as keyof FormValues, { message: msgs?.[0] ?? "Invalid value." });
        }
      } else {
        toast.error("Validation failed. Check your input.");
      }
      turnstileRef.current?.reset();
      return;
    }

    if (res.status === 403) {
      toast.error("Bot check failed. Please refresh and try again.");
      turnstileRef.current?.reset();
      return;
    }

    toast.error("Something went wrong. Please try again.");
    turnstileRef.current?.reset();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="bookerName">Name</Label>
        <Input id="bookerName" {...form.register("bookerName")} />
        {form.formState.errors.bookerName && (
          <p className="text-sm text-destructive mt-1">
            {form.formState.errors.bookerName.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="bookerEmail">Email</Label>
        <Input id="bookerEmail" type="email" {...form.register("bookerEmail")} />
        {form.formState.errors.bookerEmail && (
          <p className="text-sm text-destructive mt-1">
            {form.formState.errors.bookerEmail.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="bookerPhone">Phone</Label>
        <Input id="bookerPhone" type="tel" {...form.register("bookerPhone")} />
        {form.formState.errors.bookerPhone && (
          <p className="text-sm text-destructive mt-1">
            {form.formState.errors.bookerPhone.message}
          </p>
        )}
      </div>

      {/* Custom questions */}
      {props.eventType.custom_questions.map((q) => (
        <CustomQuestionField
          key={questionKey(q)}
          question={q}
          control={form.control}
          register={form.register}
          errors={form.formState.errors}
        />
      ))}

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          We use Cloudflare to verify you&rsquo;re human.
        </p>
        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        />
      </div>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Booking…" : "Book this time"}
      </Button>
    </form>
  );
}

function questionKey(q: CustomQuestion): string {
  return q.id ?? q.label;
}

function CustomQuestionField(/* ... renders text/textarea/select/radio per q.type ... */) {
  // Implementation: switch on q.type, render appropriate primitive, register
  // under `answers.${questionKey(q)}` key. Use Controller for Select/Radio
  // (Phase 3 lock — radix primitives don't forward refs).
  return null; // placeholder for plan brevity; implement against shadcn primitives
}
```

(The `CustomQuestionField` body is a focused sub-component — implement it referring to the established Phase 3 `question-list.tsx` rendering patterns. For text/textarea, `register("answers." + key)` works. For Select/Radio, use `Controller`.)

**`booking-shell.tsx`:**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { BookingPageData } from "../_lib/types";
import { SlotPicker, type Slot } from "./slot-picker";
import { BookingForm } from "./booking-form";
import { RaceLoserBanner } from "./race-loser-banner";

interface Props {
  account: BookingPageData["account"];
  eventType: BookingPageData["eventType"];
}

export function BookingShell({ account, eventType }: Props) {
  // Browser TZ detected on mount; falls back to account.timezone if Intl unavailable.
  const [bookerTz, setBookerTz] = useState<string>(account.timezone);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setBookerTz(tz);
    } catch {
      // keep account.timezone fallback
    }
  }, [account.timezone]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);
  const [showRaceLoser, setShowRaceLoser] = useState(false);

  const handleRaceLoss = () => {
    setSelectedSlot(null);
    setShowRaceLoser(true);
    setRefetchKey((k) => k + 1);
    // Banner stays visible until user picks a new slot.
  };

  const handleSelectSlot = (s: Slot | null) => {
    setSelectedSlot(s);
    if (s) setShowRaceLoser(false); // user picked a fresh time → dismiss banner
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <RaceLoserBanner visible={showRaceLoser} />
        <SlotPicker
          eventTypeId={eventType.id}
          accountTimezone={account.timezone}
          bookerTimezone={bookerTz}
          ownerEmail={account.owner_email}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          selectedSlot={selectedSlot}
          onSelectSlot={handleSelectSlot}
          refetchKey={refetchKey}
        />
      </div>

      <aside className="rounded-lg border p-4">
        {selectedSlot ? (
          <BookingForm
            accountSlug={account.slug}
            eventType={eventType}
            selectedSlot={selectedSlot}
            bookerTimezone={bookerTz}
            onRaceLoss={handleRaceLoss}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick a time to continue.
          </p>
        )}
      </aside>
    </div>
  );
}
```

**`page.tsx` patch:**

Replace the inline `BookingShell` stub function and the `@ts-expect-error` comment with the real import. Use the marker blocks Plan 05-04 placed in the file:

```typescript
// PLAN-05-06-REPLACE-IMPORT-START
import { BookingShell } from "./_components/booking-shell";
// PLAN-05-06-REPLACE-IMPORT-END

// ...

// PLAN-05-06-REPLACE-INLINE-START
// (inline stub function deleted — real BookingShell imported above)
// PLAN-05-06-REPLACE-INLINE-END
```

Remove the `@ts-expect-error` directive on the JSX usage. The page file's JSX stays unchanged (`<BookingShell account={...} eventType={...} />`), only the source of `BookingShell` shifts from inline-stub to real import.

DO NOT:
- Do NOT export the form schema from `booking-form.tsx`. The shared schema is `bookingInputSchema` in `lib/bookings/schema.ts` (Plan 05-03). The form may use a `.pick()` subset for client-only fields, but server validation is on the full schema in /api/bookings.
- Do NOT include the Turnstile site key in `process.env.TURNSTILE_SECRET_KEY` — that's the secret for the server. Use `NEXT_PUBLIC_TURNSTILE_SITE_KEY` on the client.
- Do NOT submit the form if `turnstileRef.current?.getResponse()` returns empty — Cloudflare's invisible mode may take 100-500ms to issue a token. If empty, show a friendly message and let the user retry.
- Do NOT manually mark fields with asterisks; rely on Phase 3 form pattern (likely no asterisk; required-ness shown via error message on submit).
- Do NOT assume `useRouter` from `next/navigation` provides `replace()` for the success redirect — `push()` is correct (the booker can navigate back; the booking is done).
- Do NOT clear `name`/`email`/`phone`/`answers` form values on 409 race-loss. CONTEXT decision #5 — preserve form values.
- Do NOT show the banner forever after 409 — dismiss when the user picks a new slot (clean UX).
- Do NOT submit auto-formatted phone numbers; Zod accepts the input as-is per format-loose rule.
  </action>
  <verify>
```bash
ls "app/[account]/[event-slug]/_components/booking-form.tsx" "app/[account]/[event-slug]/_components/booking-shell.tsx"

# Form essentials
grep -q "useForm" "app/[account]/[event-slug]/_components/booking-form.tsx" && echo "RHF wired"
grep -q "Turnstile" "app/[account]/[event-slug]/_components/booking-form.tsx" && echo "Turnstile mounted"
grep -q "turnstileRef.current\\?\\.reset" "app/[account]/[event-slug]/_components/booking-form.tsx" && echo "Turnstile reset on error"
grep -q '"/api/bookings"' "app/[account]/[event-slug]/_components/booking-form.tsx" && echo "POST endpoint wired"
grep -q "res.status === 409" "app/[account]/[event-slug]/_components/booking-form.tsx" && echo "409 handled"
grep -q "res.status === 201" "app/[account]/[event-slug]/_components/booking-form.tsx" && echo "201 handled"
grep -q "router.push" "app/[account]/[event-slug]/_components/booking-form.tsx" && echo "redirect on success ok"

# Shell essentials
grep -q "Intl.DateTimeFormat" "app/[account]/[event-slug]/_components/booking-shell.tsx" && echo "browser TZ detected"
grep -q "setRefetchKey\\|refetchKey" "app/[account]/[event-slug]/_components/booking-shell.tsx" && echo "refetch on race"
grep -q "setShowRaceLoser" "app/[account]/[event-slug]/_components/booking-shell.tsx" && echo "race-loser state"

# page.tsx swap done
grep -q "from \"./_components/booking-shell\"" "app/[account]/[event-slug]/page.tsx" && echo "real import present"
grep -q "@ts-expect-error" "app/[account]/[event-slug]/page.tsx" && echo "ERROR: stub @ts-expect-error still present" && exit 1
echo "page.tsx clean"

npm run build
npm run lint
```
  </verify>
  <done>
Three files (form, shell, banner already from Task 1). page.tsx now imports the real `BookingShell` from `_components/booking-shell`; the inline stub function is gone; `@ts-expect-error` removed. Form submits to /api/bookings, handles 201/400/403/409/5xx with appropriate UX (router.push on success, race-loser banner on 409 with state preservation, fieldErrors via setError on 400, toast + Turnstile reset on 403/5xx). Shell detects browser TZ on mount and propagates to picker + form. Build + lint clean.

Commit: `feat(05-06): wire booking form + shell + race-loser flow`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# All 4 client component files + page.tsx swap
ls "app/[account]/[event-slug]/_components/booking-shell.tsx" "app/[account]/[event-slug]/_components/slot-picker.tsx" "app/[account]/[event-slug]/_components/booking-form.tsx" "app/[account]/[event-slug]/_components/race-loser-banner.tsx"
grep -q "from \"./_components/booking-shell\"" "app/[account]/[event-slug]/page.tsx" && echo "page swapped"

npm run build
npm run lint

# Live smoke (after deploy): visit booking page; pick a date; verify slot list renders in
# browser TZ; pick a slot; fill form; submit. Verify Turnstile is invisible (no widget visible).
# Run a second tab booking the same slot to manually test 409 race-loser banner.
```
</verification>

<success_criteria>
- [ ] `_components/booking-shell.tsx` ('use client') detects browser TZ via `Intl.DateTimeFormat`; manages `selectedDate`, `selectedSlot`, `refetchKey`, `showRaceLoser` state; renders SlotPicker + BookingForm + RaceLoserBanner
- [ ] `_components/slot-picker.tsx` fetches /api/slots for 30-day window; renders shadcn Calendar with `day-has-slots` modifier dots; renders slot list in booker TZ; renders empty state with mailto:[owner_email] link when slots empty
- [ ] `_components/booking-form.tsx` uses RHF + zodResolver, mounts Turnstile invisible mode, submits to /api/bookings, handles 201/400/403/409/5xx correctly, resets Turnstile on every error
- [ ] On 409 SLOT_TAKEN: banner shown ("That time was just booked. Pick a new time below."), refetchKey bumped, selectedSlot cleared, form values preserved, Turnstile reset
- [ ] On 201: `router.push(data.redirectTo)` to confirmation route
- [ ] page.tsx imports real `BookingShell` from `_components/booking-shell`; inline stub removed; `@ts-expect-error` directive deleted
- [ ] `globals.css` has `.day-has-slots` rule for marker dots (or equivalent)
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/05-public-booking-flow/05-06-SUMMARY.md` documenting:
- Final BookingShell prop contract (consumed by page.tsx — locked)
- The form-fields subset (RHF) vs server schema (full bookingInputSchema)
- Custom-question rendering behavior per type
- The exact 409 → race-loser flow (state changes step by step)
- The Turnstile reset call points (every error path)
- The mobile responsive breakpoint chosen (defaults to `lg:` per Tailwind v4 — 1024px)
- Any deviations from RESEARCH §"Code Examples" booking form skeleton
</output>
