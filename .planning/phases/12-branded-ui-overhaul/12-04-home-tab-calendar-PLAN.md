---
phase: 12-branded-ui-overhaul
plan: 04
type: execute
wave: 3
depends_on: ["12-03"]
files_modified:
  - app/(shell)/app/page.tsx
  - app/(shell)/app/_lib/load-month-bookings.ts
  - app/(shell)/app/_lib/regenerate-reschedule-token.ts
  - app/(shell)/app/_components/home-calendar.tsx
  - app/(shell)/app/_components/day-detail-sheet.tsx
  - app/(shell)/app/_components/day-detail-row.tsx
  - app/(shell)/app/_components/onboarding-banner.tsx
  - app/(shell)/app/bookings/[id]/_lib/actions.ts
autonomous: true

must_haves:
  truths:
    - "Visiting /app renders a monthly calendar (react-day-picker v9) that highlights days with confirmed bookings"
    - "Each day-with-bookings shows up to 3 dots; days with >3 bookings show 3 dots + '+N' indicator"
    - "Clicking a day opens a shadcn Sheet drawer listing that day's confirmed bookings"
    - "Each booking row in the drawer exposes 4 actions: View / Cancel inline / Copy reschedule link / Send reminder now"
    - "View navigates to /app/bookings/[id] (existing route)"
    - "Cancel inline opens an AlertDialog confirming + calls existing cancelBookingAsOwnerAction"
    - "Copy reschedule link opens an AlertDialog warning that copying invalidates the previously-emailed link, then calls regenerateRescheduleTokenAction and copies to clipboard"
    - "Send reminder now calls a Server Action wrapping existing sendReminderBooker send-now path and toasts result"
    - "Onboarding checklist (existing) renders as a dismissible banner ABOVE the calendar (only when onboarding_complete + within 7d + not dismissed)"
    - "Empty months show 'No bookings in {Month YYYY}. Bookings will appear here as they're scheduled.' centered + muted"
  artifacts:
    - path: "app/(shell)/app/page.tsx"
      provides: "Server component fetching month bookings + rendering OnboardingBanner + HomeCalendar + DayDetailSheet"
      contains: "loadMonthBookings|HomeCalendar"
    - path: "app/(shell)/app/_lib/load-month-bookings.ts"
      provides: "Server-only query: bookings for a month range, scoped to current account, status='confirmed'"
      exports: ["loadMonthBookings"]
    - path: "app/(shell)/app/_lib/regenerate-reschedule-token.ts"
      provides: "Server Action: mints + stores new SHA-256 hash for reschedule token, returns raw token"
      exports: ["regenerateRescheduleTokenAction"]
    - path: "app/(shell)/app/_components/home-calendar.tsx"
      provides: "Client wrapper around shadcn Calendar with custom DayButton rendering capped dots"
      exports: ["HomeCalendar"]
    - path: "app/(shell)/app/_components/day-detail-sheet.tsx"
      provides: "shadcn Sheet drawer listing day's bookings with 4 row actions per booking"
      exports: ["DayDetailSheet"]
    - path: "app/(shell)/app/_components/day-detail-row.tsx"
      provides: "Single booking row rendering View/Cancel/Copy/Send-reminder actions"
      exports: ["DayDetailRow"]
    - path: "app/(shell)/app/_components/onboarding-banner.tsx"
      provides: "Compact banner version of existing OnboardingChecklist for above-calendar placement"
      exports: ["OnboardingBanner"]
    - path: "app/(shell)/app/bookings/[id]/_lib/actions.ts"
      provides: "Existing cancelBookingAsOwnerAction (used as-is) + new sendReminderForBookingAction"
      contains: "sendReminderForBookingAction"
  key_links:
    - from: "app/(shell)/app/page.tsx"
      to: "app/(shell)/app/_lib/load-month-bookings.ts"
      via: "Server-side fetch month bookings"
      pattern: "loadMonthBookings"
    - from: "app/(shell)/app/_components/home-calendar.tsx"
      to: "react-day-picker / @/components/ui/calendar"
      via: "components.DayButton override rendering capped dots"
      pattern: "components.*DayButton"
    - from: "app/(shell)/app/_components/day-detail-row.tsx"
      to: "app/(shell)/app/bookings/[id]/_lib/actions.ts"
      via: "cancelBookingAsOwnerAction + sendReminderForBookingAction"
      pattern: "cancelBookingAsOwnerAction|sendReminderForBookingAction"
    - from: "app/(shell)/app/_components/day-detail-row.tsx"
      to: "app/(shell)/app/_lib/regenerate-reschedule-token.ts"
      via: "regenerateRescheduleTokenAction + navigator.clipboard.writeText"
      pattern: "regenerateRescheduleTokenAction"
---

<objective>
Replace the current `/app` landing page (OnboardingChecklist + WelcomeCard) with a Cruip-styled Home tab: a monthly calendar (react-day-picker v9) showing capped dots for days with bookings, plus a shadcn `Sheet` drawer that opens on day-click and lists that day's confirmed bookings with 4 per-row actions (View / Cancel inline / Copy reschedule link / Send reminder now). The existing OnboardingChecklist is demoted to a small dismissible banner above the calendar.

Purpose: Owners need a daily-use surface that surfaces today's bookings at a glance. CONTEXT.md locks `react-day-picker@9` + shadcn `Sheet` + all 4 row actions. This plan delivers Phase success criterion #2 in full.

Critical pitfall (research §Pitfall 8): Reschedule tokens are SHA-256-hashed at rest. "Copy link" must mint+store a new hash and return the raw token — invalidating the booker's emailed link. Add an explicit confirmation dialog before doing so (Phase 8 reminder-rotation precedent).

Output:
- `loadMonthBookings` server-only query
- `regenerateRescheduleTokenAction` Server Action
- `sendReminderForBookingAction` Server Action (wraps existing sendReminderBooker send-now)
- `HomeCalendar` (client) with capped-dot DayButton
- `DayDetailSheet` + `DayDetailRow` (client) with 4 actions
- `OnboardingBanner` (compact wrapper around existing checklist)
- Refactored `app/(shell)/app/page.tsx`
- UI-06, UI-07, UI-08 satisfied (Plan 12-04 deliverable)
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/12-branded-ui-overhaul/12-CONTEXT.md
@.planning/phases/12-branded-ui-overhaul/12-RESEARCH.md
@.planning/phases/12-branded-ui-overhaul/12-03-SUMMARY.md

# Existing files to refactor or extend
@app/(shell)/app/page.tsx
@app/(shell)/app/bookings/[id]/_lib/actions.ts
@components/onboarding-checklist.tsx
@components/ui/calendar.tsx
@components/ui/sheet.tsx
@lib/email/send-reminder-booker.ts
@lib/booking-tokens.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Server-side data + actions (loadMonthBookings + regenerateRescheduleTokenAction + sendReminderForBookingAction)</name>
  <files>
    app/(shell)/app/_lib/load-month-bookings.ts
    app/(shell)/app/_lib/regenerate-reschedule-token.ts
    app/(shell)/app/bookings/[id]/_lib/actions.ts
  </files>
  <action>
    Create directory `app/(shell)/app/_lib/` if missing.

    **load-month-bookings.ts** (NEW, server-only):

    ```ts
    import "server-only";
    import { startOfMonth, endOfMonth } from "date-fns";
    import { createClient } from "@/lib/supabase/server";
    import { resolveAccountIdForUser } from "@/lib/auth/resolve-account";  // adapt name to actual helper

    export interface MonthBooking {
      id: string;
      start_at: string;       // ISO timestamptz
      booker_name: string;
      booker_email: string;
      status: 'confirmed' | 'rescheduled' | 'cancelled';
      event_type: { name: string };
      reschedule_token_hash: string | null;  // exposed only so the action can decide whether to re-mint
    }

    export async function loadMonthBookings(month: Date): Promise<MonthBooking[]> {
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      if (!claims?.claims) return [];
      const accountId = await resolveAccountIdForUser(claims.claims.sub);
      if (!accountId) return [];

      const from = startOfMonth(month).toISOString();
      const to = endOfMonth(month).toISOString();

      const { data } = await supabase
        .from("bookings")
        .select("id, start_at, booker_name, booker_email, status, reschedule_token_hash, event_types!inner(name, account_id)")
        .eq("event_types.account_id", accountId)
        .eq("status", "confirmed")
        .gte("start_at", from)
        .lte("start_at", to)
        .order("start_at", { ascending: true });

      return (data ?? []).map((row: any) => ({
        id: row.id,
        start_at: row.start_at,
        booker_name: row.booker_name,
        booker_email: row.booker_email,
        status: row.status,
        reschedule_token_hash: row.reschedule_token_hash,
        event_type: { name: row.event_types?.name ?? "" },
      }));
    }
    ```

    Adapt to match existing helper names (e.g. `resolveAccountIdForUser` may be called something else; check `lib/auth/` and existing `/app/page.tsx` for the canonical lookup). RLS will already scope reads to the account; the explicit `account_id` filter is defense-in-depth.

    **regenerate-reschedule-token.ts** (NEW, Server Action — research Open Question 3 → Server Action over RPC):

    ```ts
    "use server";
    import { createClient } from "@/lib/supabase/server";
    import { mintRescheduleToken } from "@/lib/booking-tokens";  // existing helper
    import { resolveAccountIdForUser } from "@/lib/auth/resolve-account";  // adapt
    import { revalidatePath } from "next/cache";

    interface ActionResult {
      ok: boolean;
      rawToken?: string;
      error?: string;
    }

    export async function regenerateRescheduleTokenAction(bookingId: string): Promise<ActionResult> {
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      if (!claims?.claims) return { ok: false, error: "unauthenticated" };
      const accountId = await resolveAccountIdForUser(claims.claims.sub);
      if (!accountId) return { ok: false, error: "no account" };

      // Pre-check: booking belongs to this account (RLS-scoped + explicit guard)
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, event_types!inner(account_id)")
        .eq("id", bookingId)
        .eq("event_types.account_id", accountId)
        .maybeSingle();
      if (!booking) return { ok: false, error: "not found" };

      // Mint new token + store hash (re-use existing helper signature)
      const { rawToken, hash } = await mintRescheduleToken();  // adapt to actual signature
      const { error } = await supabase
        .from("bookings")
        .update({ reschedule_token_hash: hash })
        .eq("id", bookingId);

      if (error) return { ok: false, error: "db_error" };

      revalidatePath("/app");
      return { ok: true, rawToken };
    }
    ```

    **CRITICAL:** This Server Action's pattern (read existing booking → mint new token → write hash) MUST mirror Phase 8's reminder-rotation precedent. Read `lib/booking-tokens.ts` to confirm the exact mint helper name + return shape; adapt the snippet above. Do NOT invent a new minting algorithm.

    **app/(shell)/app/bookings/[id]/_lib/actions.ts** — read existing file. Add a NEW exported Server Action `sendReminderForBookingAction(bookingId: string)`:

    ```ts
    export async function sendReminderForBookingAction(bookingId: string) {
      // Pattern mirrors existing send-now path. Read send-reminder-booker.ts for the canonical entry.
      // Owner-auth gate: confirm booking belongs to current account (use existing helper or replicate the maybeSingle pattern from cancelBookingAsOwnerAction).
      // Call sendReminderBooker (or equivalent send-now wrapper); catch errors; return { ok, error? }.
    }
    ```

    Keep `cancelBookingAsOwnerAction` unchanged — DayDetailRow imports it directly.

    Add Vitest unit tests:
    - `tests/regenerate-reschedule-token.test.ts` — mock supabase, assert: (a) auth check fails returns `{ok:false}`, (b) cross-account booking returns `{ok:false}`, (c) success path returns `{ok:true, rawToken}` and writes new hash.
    - `tests/load-month-bookings.test.ts` — mock supabase, assert filter scopes to current account + status='confirmed' + month range.
  </action>
  <verify>
    1. `npm test -- regenerate-reschedule-token load-month-bookings` — all pass.
    2. `npx tsc --noEmit` clean.
    3. From psql / supabase dashboard: pick an existing booking, capture `reschedule_token_hash`. Trigger action via temp test page. Confirm hash changed. Confirm rawToken returned.
  </verify>
  <done>
    All 3 server-side primitives ship with unit tests; Phase 8 token-rotation precedent followed.
  </done>
</task>

<task type="auto">
  <name>Task 2: HomeCalendar + DayDetailSheet + DayDetailRow + OnboardingBanner client components</name>
  <files>
    app/(shell)/app/_components/home-calendar.tsx
    app/(shell)/app/_components/day-detail-sheet.tsx
    app/(shell)/app/_components/day-detail-row.tsx
    app/(shell)/app/_components/onboarding-banner.tsx
  </files>
  <action>
    Create directory `app/(shell)/app/_components/` if missing.

    **home-calendar.tsx** (client component — react-day-picker requires "use client"; research Pitfall 2):

    ```tsx
    "use client";
    import { useState } from "react";
    import { Calendar } from "@/components/ui/calendar";
    import { DayDetailSheet } from "./day-detail-sheet";
    import type { MonthBooking } from "../_lib/load-month-bookings";

    interface HomeCalendarProps {
      bookings: MonthBooking[];
      appUrl: string;  // for clipboard URL composition
    }

    export function HomeCalendar({ bookings, appUrl }: HomeCalendarProps) {
      const [selectedDate, setSelectedDate] = useState<Date | null>(null);
      const [open, setOpen] = useState(false);

      // Group bookings by YYYY-MM-DD (uses owner local TZ for grouping — accept locale.toISOString().slice(0,10) keyed in UTC for v1.1; v1.2 can move to account TZ)
      const byDay = new Map<string, MonthBooking[]>();
      for (const b of bookings) {
        const key = new Date(b.start_at).toISOString().slice(0, 10);
        (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(b);
      }

      const dayBookings = selectedDate
        ? (byDay.get(selectedDate.toISOString().slice(0, 10)) ?? [])
        : [];

      return (
        <>
          <Calendar
            mode="single"
            onSelect={(date) => {
              if (date) {
                setSelectedDate(date);
                setOpen(true);
              }
            }}
            components={{
              DayButton: (props: any) => {
                const dateKey = props.day.date.toISOString().slice(0, 10);
                const count = byDay.get(dateKey)?.length ?? 0;
                return (
                  <button
                    {...props}
                    className={`relative flex flex-col items-center justify-center w-full h-full rounded-md hover:bg-accent ${props.className ?? ""}`}
                  >
                    <span className="text-sm">{props.day.date.getDate()}</span>
                    {count > 0 && (
                      <span className="flex items-center gap-0.5 mt-0.5">
                        {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                          <span key={i} className="h-1 w-1 rounded-full bg-[var(--brand-primary,theme(colors.primary.DEFAULT))]" />
                        ))}
                        {count > 3 && (
                          <span className="text-[8px] text-muted-foreground ml-0.5">+{count - 3}</span>
                        )}
                      </span>
                    )}
                  </button>
                );
              },
            }}
          />
          <DayDetailSheet
            open={open}
            onOpenChange={setOpen}
            date={selectedDate}
            bookings={dayBookings}
            appUrl={appUrl}
          />
        </>
      );
    }
    ```

    **day-detail-sheet.tsx** (client):

    ```tsx
    "use client";
    import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
    import { DayDetailRow } from "./day-detail-row";
    import type { MonthBooking } from "../_lib/load-month-bookings";

    interface DayDetailSheetProps {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      date: Date | null;
      bookings: MonthBooking[];
      appUrl: string;
    }

    export function DayDetailSheet({ open, onOpenChange, date, bookings, appUrl }: DayDetailSheetProps) {
      if (!date) return null;
      return (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent className="sm:max-w-md">  {/* widened from default sm:max-w-sm — research Pitfall 6 */}
            <SheetHeader>
              <SheetTitle>{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</SheetTitle>
              <SheetDescription>
                {bookings.length === 0 ? "No bookings this day." : `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 p-4 overflow-y-auto">
              {bookings.map((b) => (
                <DayDetailRow key={b.id} booking={b} appUrl={appUrl} />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      );
    }
    ```

    **day-detail-row.tsx** (client) — 4 actions:

    ```tsx
    "use client";
    import { useState } from "react";
    import Link from "next/link";
    import { toast } from "sonner";
    import { Button } from "@/components/ui/button";
    import {
      AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
      AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
    } from "@/components/ui/alert-dialog";
    import type { MonthBooking } from "../_lib/load-month-bookings";
    import { cancelBookingAsOwnerAction } from "@/app/(shell)/app/bookings/[id]/_lib/actions";
    import { sendReminderForBookingAction } from "@/app/(shell)/app/bookings/[id]/_lib/actions";
    import { regenerateRescheduleTokenAction } from "../_lib/regenerate-reschedule-token";

    export function DayDetailRow({ booking, appUrl }: { booking: MonthBooking; appUrl: string }) {
      const [cancelOpen, setCancelOpen] = useState(false);
      const [copyOpen, setCopyOpen] = useState(false);
      const [busy, setBusy] = useState(false);

      const time = new Date(booking.start_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

      async function handleCopy() {
        setBusy(true);
        try {
          const res = await regenerateRescheduleTokenAction(booking.id);
          if (!res.ok || !res.rawToken) {
            toast.error(res.error ?? "Could not regenerate reschedule link.");
            return;
          }
          await navigator.clipboard.writeText(`${appUrl}/reschedule/${res.rawToken}`);
          toast.success("New reschedule link copied. Previous link is now invalid.");
        } finally {
          setBusy(false);
          setCopyOpen(false);
        }
      }

      async function handleSendReminder() {
        setBusy(true);
        try {
          const res = await sendReminderForBookingAction(booking.id);
          toast[res.ok ? "success" : "error"](res.ok ? "Reminder sent" : (res.error ?? "Failed to send"));
        } finally {
          setBusy(false);
        }
      }

      async function handleCancel() {
        setBusy(true);
        try {
          const res = await cancelBookingAsOwnerAction(booking.id);
          toast[res?.ok !== false ? "success" : "error"](res?.ok !== false ? "Booking cancelled" : "Cancel failed");
        } finally {
          setBusy(false);
          setCancelOpen(false);
        }
      }

      return (
        <div className="rounded-lg border bg-white p-3">
          <div className="font-medium text-gray-900">{booking.event_type.name}</div>
          <div className="text-sm text-gray-600">{booking.booker_name} · {time}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/bookings/${booking.id}`}>View</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)} disabled={busy}>
              Copy reschedule link
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendReminder} disabled={busy}>
              Send reminder
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)} disabled={busy}>
              Cancel
            </Button>
          </div>

          <AlertDialog open={copyOpen} onOpenChange={setCopyOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Issue a new reschedule link?</AlertDialogTitle>
                <AlertDialogDescription>
                  Copying a new link invalidates the link previously sent to {booking.booker_name}. They will no longer be able to reschedule using their email link. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleCopy}>Issue and copy</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will notify {booking.booker_name} via email and free the slot.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancel}>Cancel booking</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }
    ```

    **onboarding-banner.tsx** (NEW — wraps existing OnboardingChecklist):

    ```tsx
    import { OnboardingChecklist } from "@/components/onboarding-checklist";
    // OnboardingChecklist already handles its own visibility gate (onboarding_complete + within 7d + not dismissed).
    // This wrapper just constrains it visually to a banner format above the calendar.
    export function OnboardingBanner(props: React.ComponentProps<typeof OnboardingChecklist>) {
      return (
        <div className="mb-6">
          <OnboardingChecklist {...props} />
        </div>
      );
    }
    ```

    **Pitfall 6 (drawer width):** SheetContent gets `sm:max-w-md` (28rem) — confirmed in DayDetailSheet above.

    **Pitfall 5 (sidebar cookie state):** No interaction here — DayDetailSheet uses local state.

    **AlertDialog import:** Verify shadcn `alert-dialog.tsx` is installed. If missing: `npx shadcn@latest add alert-dialog` (Phase 11 already used this primitive for CAP-09, so it should already be installed).

    **clipboard fallback:** Modern browsers support `navigator.clipboard.writeText` over HTTPS or localhost. v1.1 is HTTPS-only on Vercel, so no fallback needed.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `npm run dev` → log in → visit `/app` (after Task 3 wires this in). Calendar renders.
    3. Pick a day with no bookings → drawer opens showing "No bookings this day."
    4. Pick a day with bookings → drawer opens showing booking rows with all 4 buttons.
    5. Click "View" → navigates to `/app/bookings/[id]` (existing route).
    6. Click "Send reminder" → toast appears (success or error depending on Gmail SMTP).
    7. Click "Copy reschedule link" → AlertDialog opens with invalidation warning. Click "Issue and copy" → toast confirms + clipboard contains a URL like `${appUrl}/reschedule/{raw token}`. Verify `bookings.reschedule_token_hash` changed in DB.
    8. Click "Cancel" → AlertDialog opens. Click "Cancel booking" → existing cancellation flow runs (email sent, slot freed).
    9. Mobile (375px) → drawer renders sheet with comfortable button wrapping (sm:max-w-md kicks in at sm: breakpoint, so on actual 375px device the sheet is full-width via sheet's mobile-default which is fine).
  </verify>
  <done>
    HomeCalendar shows capped dots; DayDetailSheet drawer renders 4 actions per row; all actions wire to Server Actions or navigation correctly; reschedule-token rotation is gated by an explicit confirmation dialog.
  </done>
</task>

<task type="auto">
  <name>Task 3: Refactor /app/page.tsx as Home tab landing</name>
  <files>
    app/(shell)/app/page.tsx
  </files>
  <action>
    Read existing `app/(shell)/app/page.tsx`. Current behavior (per STATE.md): renders OnboardingChecklist + WelcomeCard, redirects to `/onboarding` if `onboarding_complete=false`.

    **Preserve:**
    - The `onboarding_complete=false` redirect to `/onboarding` (Phase 10 contract).
    - The OnboardingChecklist visibility gate (Phase 10 ONBOARD-09: 7-day window + dismissed_at + onboarding_complete).
    - `loadAccountForUser` (or whatever auth helper is currently in use).

    **Refactor:**
    - Move OnboardingChecklist render into the OnboardingBanner wrapper, above the calendar.
    - Demote/remove WelcomeCard (it was a v1.0 placeholder; the calendar replaces it as the primary daily-use surface). Document removal in plan summary; if Andrew wants WelcomeCard back, restore in a follow-up.
    - Render `<HomeCalendar bookings={bookings} appUrl={appUrl} />` as the primary content.
    - Wrap the page content in a section heading: `<h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-6">{currentMonth}</h1>` for context.

    Pseudo-skeleton:

    ```tsx
    import { redirect } from "next/navigation";
    import { loadAccountForUser } from "...";  // existing
    import { loadMonthBookings } from "./_lib/load-month-bookings";
    import { HomeCalendar } from "./_components/home-calendar";
    import { OnboardingBanner } from "./_components/onboarding-banner";

    export default async function HomePage() {
      const account = await loadAccountForUser();
      if (!account) redirect("/login");
      if (!account.onboarding_complete) redirect("/onboarding");

      const today = new Date();
      const bookings = await loadMonthBookings(today);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

      return (
        <div>
          {/* Existing OnboardingBanner gate already handles 7-day + dismissed checks */}
          <OnboardingBanner /* pass props that existing OnboardingChecklist requires */ />

          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {today.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h1>
            <p className="text-sm text-gray-600 mt-1">Your bookings at a glance.</p>
          </header>

          {bookings.length === 0 ? (
            <div className="rounded-xl border bg-white p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No bookings in {today.toLocaleDateString(undefined, { month: "long", year: "numeric" })}.
                Bookings will appear here as they're scheduled.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border bg-white p-4 sm:p-6">
            <HomeCalendar bookings={bookings} appUrl={appUrl} />
          </div>
        </div>
      );
    }
    ```

    Empty-state copy (research Open Question 5): "No bookings in {Month YYYY}. Bookings will appear here as they're scheduled." Single line, muted color. Calendar still renders behind it (so owner can navigate to other months).

    **Note:** Calendar UX renders ALWAYS (even when no bookings) so the owner can navigate to past or future months. The empty-state message sits above as a hint.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `npm run dev` → log in as Andrew → visit `/app`. Confirm: calendar visible; sidebar Home item highlighted; floating header pill at top; gradient backdrop behind.
    3. Confirm: month name renders as h1 above calendar.
    4. Pick a day with bookings → drawer opens.
    5. Onboarding-incomplete account redirects to `/onboarding` (verify by manually setting `onboarding_complete=false` on test account → visiting `/app`).
    6. New account within 7-day window → OnboardingBanner renders above calendar.
    7. No regressions in Vitest (148+ baseline).
  </verify>
  <done>
    `/app` is the Cruip-styled Home tab; OnboardingBanner is demoted to top-banner; existing redirects preserved; phase success criterion #2 fully delivered.
  </done>
</task>

</tasks>

<verification>
**Plan-level checks:**
- `/app` renders monthly calendar with capped dots (1-3 dots + "+N").
- Click day → Sheet drawer opens with 4 actions per booking row.
- Copy reschedule link shows confirmation dialog before re-issuing token.
- Send reminder calls existing send-now path.
- Cancel inline calls existing cancelBookingAsOwnerAction.
- View navigates to `/app/bookings/[id]` (existing detail page).
- Onboarding-incomplete redirect to `/onboarding` preserved.
- OnboardingBanner renders above calendar for new accounts.
- Empty months show empty-state copy without breaking calendar nav.
- Vitest baseline preserved (148+ passing).

**Requirements satisfied:**
- UI-06 (monthly calendar with modifiers)
- UI-07 (Sheet drawer on day-click)
- UI-08 (View / Cancel / Copy / Send reminder per row)

**Phase success criteria contribution:**
- Criterion #2 — fully satisfied
</verification>

<success_criteria>
1. `/app` server component fetches month bookings (status='confirmed', RLS-scoped + explicit account filter).
2. HomeCalendar renders capped-dot DayButton modifier (1-3 dots + "+N").
3. DayDetailSheet uses shadcn Sheet at sm:max-w-md.
4. DayDetailRow exposes all 4 actions: View / Cancel / Copy / Send reminder.
5. Copy reschedule link gated by AlertDialog warning about invalidation.
6. regenerateRescheduleTokenAction follows Phase 8 token-rotation precedent.
7. sendReminderForBookingAction wraps existing sendReminderBooker send-now path.
8. OnboardingBanner renders above calendar (preserves Phase 10 visibility gate).
9. Empty-state copy renders for empty months.
10. No Vitest regressions; `npx tsc --noEmit` clean.
</success_criteria>

<output>
After completion, create `.planning/phases/12-branded-ui-overhaul/12-04-SUMMARY.md` documenting:
- Files: list above
- Decisions: empty-state copy "No bookings in {Month YYYY}..." (research recommendation); WelcomeCard removed (flag for revisit); OnboardingBanner is a thin wrapper preserving existing visibility gate
- Decisions: Reschedule-link copy invalidates previously-emailed link (CONTEXT-locked behavior; AlertDialog warns); Phase 8 reminder-rotation precedent followed
- Tech-stack additions: none
- Key wiring: HomeCalendar (client) + DayDetailSheet (client) + Server Actions for the 3 mutating row actions
- For Phase 13 QA: spot-check capped-dot rendering when count = 0, 1, 2, 3, 4, 5+ (boundary at 3); test cancel/reminder/reschedule flows end-to-end
- Cookie-state pitfall: Settings expansion is local state (no cookie), so navigating from `/app` to `/app/settings/profile` collapses the sidebar Settings group — acceptable per CONTEXT lock
</output>
