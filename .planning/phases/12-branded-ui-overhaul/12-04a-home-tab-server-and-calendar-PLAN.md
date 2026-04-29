---
phase: 12-branded-ui-overhaul
plan: 04a
type: execute
wave: 3
depends_on: ["12-03"]
files_modified:
  - app/(shell)/app/_lib/load-month-bookings.ts
  - app/(shell)/app/_lib/regenerate-reschedule-token.ts
  - app/(shell)/app/bookings/[id]/_lib/actions.ts
  - app/(shell)/app/_components/home-calendar.tsx
  - app/(shell)/app/_components/onboarding-banner.tsx
  - app/(shell)/app/page.tsx
  - tests/load-month-bookings.test.ts
  - tests/regenerate-reschedule-token.test.ts
  - tests/send-reminder-for-booking.test.ts
autonomous: true

must_haves:
  truths:
    - "Visiting /app renders a monthly calendar (react-day-picker v9) that highlights days with confirmed bookings"
    - "Each day-with-bookings shows up to 3 dots; days with >3 bookings show 3 dots + '+N' indicator"
    - "Clicking a day surfaces a UI affordance for opening the day-detail drawer (drawer wiring lands in 12-04b)"
    - "Onboarding checklist (existing) renders as a dismissible banner ABOVE the calendar (only when onboarding_complete + within 7d + not dismissed)"
    - "Empty months show 'No bookings in {Month YYYY}. Bookings will appear here as they're scheduled.' centered + muted"
    - "Owner can issue a fresh reschedule link from the server (Server Action ships); the previously-emailed link is invalidated as a result of issuing the new one"
    - "Owner can manually re-trigger the booker reminder email for a booking (Server Action ships)"
  artifacts:
    - path: "app/(shell)/app/page.tsx"
      provides: "Server component fetching month bookings + rendering OnboardingBanner + HomeCalendar"
      contains: "loadMonthBookings|HomeCalendar"
    - path: "app/(shell)/app/_lib/load-month-bookings.ts"
      provides: "Server-only query: bookings for a month range, scoped to current account, status='confirmed'"
      exports: ["loadMonthBookings"]
    - path: "app/(shell)/app/_lib/regenerate-reschedule-token.ts"
      provides: "Server Action: mints + stores new SHA-256 hash for reschedule token, returns raw token"
      exports: ["regenerateRescheduleTokenAction"]
    - path: "app/(shell)/app/_components/home-calendar.tsx"
      provides: "Client wrapper around shadcn Calendar with custom DayButton rendering capped dots; emits onDayClick(date) for parent (12-04b drawer wiring)"
      exports: ["HomeCalendar"]
    - path: "app/(shell)/app/_components/onboarding-banner.tsx"
      provides: "Compact banner version of existing OnboardingChecklist for above-calendar placement"
      exports: ["OnboardingBanner"]
    - path: "app/(shell)/app/bookings/[id]/_lib/actions.ts"
      provides: "Existing cancelBookingAsOwner (used as-is) + new sendReminderForBookingAction"
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
    - from: "app/(shell)/app/_lib/regenerate-reschedule-token.ts"
      to: "lib/bookings/tokens.ts"
      via: "hashToken(rawReschedule) — uses existing helper, NOT a new mint algorithm"
      pattern: "hashToken"
---

<objective>
Ship the server primitives and the foundational `/app` Home tab landing: server-only `loadMonthBookings` query, two Server Actions (`regenerateRescheduleTokenAction`, `sendReminderForBookingAction`), the `HomeCalendar` client wrapper with capped-dot DayButton, the `OnboardingBanner`, and the refactored `app/(shell)/app/page.tsx` page wiring everything together. Drawer + per-row actions land in 12-04b.

Purpose: Phase success criterion #2 part 1 — the calendar surface and the server-side primitives that 12-04b's DayDetailRow will consume. Splitting 12-04 into a/b (per checker W3) keeps each plan ~3 tasks / ~50% context per the Phase 12 sizing budget.

Critical pitfall (research §Pitfall 8): Reschedule tokens are SHA-256-hashed at rest. "Copy link" must mint+store a new hash and return the raw token — invalidating the booker's emailed link. The Server Action in this plan exposes that capability; 12-04b adds the AlertDialog warning UX before invocation.

Output:
- `loadMonthBookings` server-only query
- `regenerateRescheduleTokenAction` Server Action
- `sendReminderForBookingAction` Server Action (wraps existing sendReminderBooker send-now)
- `HomeCalendar` (client) with capped-dot DayButton + onDayClick callback
- `OnboardingBanner` (compact wrapper around existing checklist)
- Refactored `app/(shell)/app/page.tsx` rendering banner + month header + calendar
- UI-06 satisfied (monthly calendar with modifiers); UI-08 partially satisfied (Server Actions ready for 12-04b row wiring)
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

# Existing files to refactor or extend (verified canonical signatures)
@app/(shell)/app/page.tsx
@app/(shell)/app/bookings/[id]/_lib/actions.ts
@components/onboarding-checklist.tsx
@components/ui/calendar.tsx
@lib/email/send-reminder-booker.ts
@lib/bookings/tokens.ts

# VERIFIED canonical helpers (grep-confirmed during planning):
# - Auth: `await supabase.auth.getClaims()` (Supabase SDK direct call, NO wrapper helper exists)
# - Account-for-user: inline `from("accounts").select(...).eq("owner_user_id", claims.claims.sub)` per app/(shell)/app/page.tsx lines 19-26
# - Existing owner cancel: `cancelBookingAsOwner(bookingId, reason?)` exported from app/(shell)/app/bookings/[id]/_lib/actions.ts:40 — return shape `{ ok: true } | { error: string }`
# - Token mint helpers: `hashToken(raw): Promise<string>` and `generateBookingTokens()` from lib/bookings/tokens.ts (NO `mintRescheduleToken` helper exists — use `crypto.randomUUID()` + `hashToken()` for reschedule-only minting)
# - Reminder sender: `sendReminderBooker(args: SendReminderBookerArgs): Promise<void>` from lib/email/send-reminder-booker.ts:90 — args include {booking, eventType, account, rawCancelToken, rawRescheduleToken, appUrl}
</context>

<tasks>

<task type="auto">
  <name>Task 1: load-month-bookings + regenerate-reschedule-token Server Action</name>
  <files>
    app/(shell)/app/_lib/load-month-bookings.ts
    app/(shell)/app/_lib/regenerate-reschedule-token.ts
    tests/load-month-bookings.test.ts
    tests/regenerate-reschedule-token.test.ts
  </files>
  <action>
    Create directory `app/(shell)/app/_lib/` if missing.

    **load-month-bookings.ts** (NEW, server-only) — uses verified canonical inline auth pattern (no `resolveAccountIdForUser` helper exists; replicate the SELECT pattern from app/(shell)/app/page.tsx lines 19-26):

    ```ts
    import "server-only";
    import { startOfMonth, endOfMonth } from "date-fns";
    import { createClient } from "@/lib/supabase/server";

    export interface MonthBooking {
      id: string;
      start_at: string;       // ISO timestamptz
      booker_name: string;
      booker_email: string;
      status: 'confirmed' | 'rescheduled' | 'cancelled';
      event_type: { name: string };
      reschedule_token_hash: string | null;  // exposed only so the action can confirm hash exists; raw token lives only in email
    }

    export async function loadMonthBookings(month: Date): Promise<MonthBooking[]> {
      const supabase = await createClient();
      const { data: claimsData } = await supabase.auth.getClaims();
      if (!claimsData?.claims) return [];

      // VERIFIED CANONICAL PATTERN — inline accounts lookup (no helper wrapper exists).
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("owner_user_id", claimsData.claims.sub)
        .is("deleted_at", null)
        .limit(1);
      const accountId = accounts?.[0]?.id;
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

    RLS already scopes reads to the account; the explicit `account_id` filter is defense-in-depth.

    **regenerate-reschedule-token.ts** (NEW, Server Action — research Open Question 3 → Server Action over RPC):

    ```ts
    "use server";
    import { createClient } from "@/lib/supabase/server";
    import { hashToken } from "@/lib/bookings/tokens";  // VERIFIED export — see lib/bookings/tokens.ts:21
    import { revalidatePath } from "next/cache";

    interface ActionResult {
      ok: boolean;
      rawToken?: string;
      error?: string;
    }

    export async function regenerateRescheduleTokenAction(bookingId: string): Promise<ActionResult> {
      const supabase = await createClient();
      const { data: claimsData } = await supabase.auth.getClaims();
      if (!claimsData?.claims) return { ok: false, error: "unauthenticated" };

      // VERIFIED CANONICAL PATTERN — inline accounts lookup.
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("owner_user_id", claimsData.claims.sub)
        .is("deleted_at", null)
        .limit(1);
      const accountId = accounts?.[0]?.id;
      if (!accountId) return { ok: false, error: "no account" };

      // Belt-and-suspenders ownership check: booking belongs to this account
      // (RLS-scoped + explicit guard via event_types FK join).
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, event_types!inner(account_id)")
        .eq("id", bookingId)
        .eq("event_types.account_id", accountId)
        .maybeSingle();
      if (!booking) return { ok: false, error: "not found" };

      // Mint a NEW reschedule token. NO `mintRescheduleToken` helper exists —
      // generateBookingTokens() mints both cancel + reschedule, but we only want
      // reschedule. Replicate its primitive: crypto.randomUUID() + hashToken().
      const rawToken = crypto.randomUUID();
      const hash = await hashToken(rawToken);

      const { error } = await supabase
        .from("bookings")
        .update({ reschedule_token_hash: hash })
        .eq("id", bookingId);

      if (error) return { ok: false, error: "db_error" };

      revalidatePath("/app");
      return { ok: true, rawToken };
    }
    ```

    **CRITICAL:** This Server Action mirrors Phase 8's reminder-rotation precedent (mint + store hash + return raw). It does NOT introduce a new minting algorithm — it composes existing `crypto.randomUUID()` + `hashToken()` from `lib/bookings/tokens.ts`. Old emailed reschedule link becomes invalid because its hash no longer matches stored `reschedule_token_hash`.

    **Vitest tests:**

    `tests/regenerate-reschedule-token.test.ts`:
    - mock supabase, assert: (a) auth check fails returns `{ok:false, error:"unauthenticated"}`
    - (b) cross-account booking returns `{ok:false, error:"not found"}`
    - (c) success path returns `{ok:true, rawToken}`, writes new hash to bookings.reschedule_token_hash, calls revalidatePath
    - (d) old hash + new hash differ (invalidation invariant)

    `tests/load-month-bookings.test.ts`:
    - mock supabase, assert filter scopes to current account, status='confirmed', month range (startOfMonth..endOfMonth)
    - empty claims returns [] without DB call
    - empty accounts returns [] without bookings DB call

    Run: `npm test -- regenerate-reschedule-token load-month-bookings`.
  </action>
  <verify>
    1. `npm test -- regenerate-reschedule-token load-month-bookings` — all cases pass.
    2. `npx tsc --noEmit` clean.
    3. From psql / supabase dashboard: pick an existing booking, capture `reschedule_token_hash`. Trigger action via temp test page or a one-off script. Confirm hash changed. Confirm rawToken returned and `await hashToken(rawToken) === newHash`.
  </verify>
  <done>
    Server-only month query + reschedule-rotate Server Action ship with unit tests. Phase 8 token-rotation precedent followed (composes existing `hashToken` + `crypto.randomUUID()`).
  </done>
</task>

<task type="auto">
  <name>Task 2: sendReminderForBookingAction in bookings/[id]/_lib/actions.ts</name>
  <files>
    app/(shell)/app/bookings/[id]/_lib/actions.ts
    tests/send-reminder-for-booking.test.ts
  </files>
  <action>
    Read existing `app/(shell)/app/bookings/[id]/_lib/actions.ts`. Existing exports: `cancelBookingAsOwner(bookingId, reason?)` returning `{ ok: true } | { error: string }` (verified canonical — line 40, return type alias `CancelBookingAsOwnerResult`).

    **DO NOT change** `cancelBookingAsOwner` — 12-04b imports and calls it as-is.

    Add a new Server Action `sendReminderForBookingAction` matching the same authorization + return-shape pattern as `cancelBookingAsOwner`:

    ```ts
    "use server";
    // ... keep existing imports ...
    import { sendReminderBooker } from "@/lib/email/send-reminder-booker";  // VERIFIED export — lib/bookings/tokens.ts is for tokens; reminder lives in lib/email/

    export type SendReminderForBookingResult = { ok: true } | { error: string };

    /**
     * OWNER-INITIATED manual reminder send.
     *
     * Wraps the canonical reminder send path (sendReminderBooker — see
     * lib/email/send-reminder-booker.ts:90). Mirrors the cancelBookingAsOwner
     * authorization pattern: RLS-scoped accounts SELECT, then booking ownership
     * check via event_types FK join, then delegate to sendReminderBooker.
     *
     * RAW-TOKEN PROBLEM: sendReminderBooker requires {rawCancelToken, rawRescheduleToken}
     * (see SendReminderBookerArgs in lib/email/send-reminder-booker.ts:75-88), but the
     * DB stores ONLY hashes (Phase 6 contract). Phase 8's cron rotates tokens before
     * sending — we follow that precedent here:
     *   1. Mint fresh raw cancel + reschedule tokens via crypto.randomUUID().
     *   2. Hash both via hashToken() and persist to bookings.cancel_token_hash + reschedule_token_hash.
     *   3. Pass the freshly-minted RAW tokens to sendReminderBooker.
     * Side effect: previously-emailed cancel/reschedule links are invalidated. This
     * matches Phase 8 cron behavior — acceptable per existing project pattern.
     */
    export async function sendReminderForBookingAction(
      bookingId: string,
    ): Promise<SendReminderForBookingResult> {
      const supabase = await createClient();
      const { data: claimsData } = await supabase.auth.getClaims();
      if (!claimsData?.claims) return { error: "Not signed in." };

      // Inline accounts lookup (canonical pattern — no helper wrapper).
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, slug, name, logo_url, brand_primary, owner_email, reminder_include_custom_answers, reminder_include_location, reminder_include_lifecycle_links")
        .eq("owner_user_id", claimsData.claims.sub)
        .is("deleted_at", null)
        .limit(1);
      const account = accounts?.[0];
      if (!account) return { error: "No account found." };

      // Booking + event_type fetch + ownership guard (mirrors cancelBookingAsOwner).
      const { data: booking, error: lookupError } = await supabase
        .from("bookings")
        .select("id, start_at, end_at, booker_name, booker_email, booker_timezone, answers, status, event_types!inner(id, name, duration_minutes, location, account_id)")
        .eq("id", bookingId)
        .eq("event_types.account_id", account.id)
        .maybeSingle();
      if (lookupError || !booking) return { error: "Booking not found." };
      if (booking.status !== "confirmed") return { error: "Reminder is only available for confirmed bookings." };

      // Mint fresh tokens (Phase 8 cron precedent — old emailed links invalidate).
      const { hashToken } = await import("@/lib/bookings/tokens");
      const rawCancelToken = crypto.randomUUID();
      const rawRescheduleToken = crypto.randomUUID();
      const [hashCancel, hashReschedule] = await Promise.all([
        hashToken(rawCancelToken),
        hashToken(rawRescheduleToken),
      ]);
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ cancel_token_hash: hashCancel, reschedule_token_hash: hashReschedule })
        .eq("id", bookingId);
      if (updateError) return { error: "Reminder failed. Please try again." };

      // appUrl resolution (matches cancelBookingAsOwner step 3).
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.NEXT_PUBLIC_VERCEL_URL
          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
          : "http://localhost:3000");

      try {
        await sendReminderBooker({
          booking: {
            id: booking.id,
            start_at: booking.start_at,
            end_at: booking.end_at,
            booker_name: booking.booker_name,
            booker_email: booking.booker_email,
            booker_timezone: booking.booker_timezone,
            answers: booking.answers,
          },
          eventType: {
            id: booking.event_types.id,
            name: booking.event_types.name,
            duration_minutes: booking.event_types.duration_minutes,
            location: booking.event_types.location,
          },
          account: {
            slug: account.slug,
            name: account.name,
            logo_url: account.logo_url,
            brand_primary: account.brand_primary,
            owner_email: account.owner_email,
            reminder_include_custom_answers: account.reminder_include_custom_answers,
            reminder_include_location: account.reminder_include_location,
            reminder_include_lifecycle_links: account.reminder_include_lifecycle_links,
          },
          rawCancelToken,
          rawRescheduleToken,
          appUrl,
        });
      } catch (err) {
        console.error("[sendReminderForBookingAction] send error:", err);
        return { error: "Reminder send failed. Please try again." };
      }

      return { ok: true };
    }
    ```

    **READ AND ADAPT BEFORE COMMITTING:** Open `lib/email/send-reminder-booker.ts` and confirm:
    - `SendReminderBookerArgs` interface field names match the call above (lines 75-88 verified during planning: booking, eventType, account, rawCancelToken, rawRescheduleToken, appUrl).
    - `ReminderBookingRecord` field names (the inner `booking` arg fields) match the SELECT above.
    - `ReminderEventTypeRecord` + `ReminderAccountRecord` field names match.

    If any field name diverges, adapt the SELECT or the args mapping — DO NOT invent new fields.

    **Vitest test** — `tests/send-reminder-for-booking.test.ts`:
    - mock supabase + sendReminderBooker + hashToken
    - case (a): unauthenticated → `{ error: "Not signed in." }`
    - case (b): cross-account booking → `{ error: "Booking not found." }`
    - case (c): cancelled booking → `{ error: "Reminder is only available for confirmed bookings." }`
    - case (d): success path → `{ ok: true }`, both hashes updated, sendReminderBooker called with raw tokens
    - case (e): sendReminderBooker throws → `{ error: "Reminder send failed. Please try again." }`

    Run: `npm test -- send-reminder-for-booking`.
  </action>
  <verify>
    1. `npm test -- send-reminder-for-booking` — all 5 cases pass.
    2. `npx tsc --noEmit` clean.
    3. `grep "sendReminderForBookingAction" app/(shell)/app/bookings/[id]/_lib/actions.ts` returns the export.
    4. Manual smoke: in dev, trigger the action via a temp test page → confirm reminder email arrives at booker_email + DB hashes rotated.
  </verify>
  <done>
    `sendReminderForBookingAction` ships in the same file as `cancelBookingAsOwner` (12-04b imports both from one path). Authorization matches `cancelBookingAsOwner` pattern; token rotation matches Phase 8 cron precedent.
  </done>
</task>

<task type="auto">
  <name>Task 3: HomeCalendar (capped-dot DayButton) + OnboardingBanner + /app page.tsx refactor</name>
  <files>
    app/(shell)/app/_components/home-calendar.tsx
    app/(shell)/app/_components/onboarding-banner.tsx
    app/(shell)/app/page.tsx
  </files>
  <action>
    Create directory `app/(shell)/app/_components/` if missing.

    **home-calendar.tsx** (client component — react-day-picker requires "use client"; research Pitfall 2):

    ```tsx
    "use client";
    import { useState } from "react";
    import { Calendar } from "@/components/ui/calendar";
    import type { MonthBooking } from "../_lib/load-month-bookings";

    interface HomeCalendarProps {
      bookings: MonthBooking[];
      /** 12-04b passes a callback that opens the day-detail Sheet drawer. */
      onDayClick?: (date: Date, dayBookings: MonthBooking[]) => void;
    }

    export function HomeCalendar({ bookings, onDayClick }: HomeCalendarProps) {
      const [selectedDate, setSelectedDate] = useState<Date | null>(null);

      // Group bookings by YYYY-MM-DD (UTC slice; v1.2 can move to account TZ)
      const byDay = new Map<string, MonthBooking[]>();
      for (const b of bookings) {
        const key = new Date(b.start_at).toISOString().slice(0, 10);
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(b);
      }

      return (
        <Calendar
          mode="single"
          selected={selectedDate ?? undefined}
          onSelect={(date) => {
            if (!date) return;
            setSelectedDate(date);
            const key = date.toISOString().slice(0, 10);
            const dayBookings = byDay.get(key) ?? [];
            onDayClick?.(date, dayBookings);
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

    **app/(shell)/app/page.tsx** — read existing. Current behavior (verified, lines 9-46): `supabase.auth.getClaims()` → inline accounts SELECT → `redirect("/app/unlinked")` if missing → `redirect("/onboarding")` if `!onboarding_complete` → load checklist counts → render `<OnboardingChecklist>` + `<WelcomeCard>`.

    **Preserve verbatim:**
    - The `supabase.auth.getClaims()` call + `redirect("/app/login")` if no claims.
    - The inline accounts SELECT pattern (lines 19-26).
    - The `redirect("/app/unlinked")` for missing accounts row.
    - The `redirect("/onboarding")` for `onboarding_complete=false`.
    - The 7-day OnboardingChecklist visibility gate logic (Phase 10 ONBOARD-09).
    - All checklist count fetches IF the window is open.

    **Refactor:**
    - Move `<OnboardingChecklist>` render into the new `<OnboardingBanner>` wrapper.
    - Remove `<WelcomeCard>` (it was a v1.0 placeholder; the calendar replaces it). Document removal in plan summary.
    - Add `loadMonthBookings(today)` server-side fetch.
    - Render `<HomeCalendar bookings={bookings} />` (no `onDayClick` here — 12-04b adds the drawer wrapper).
    - Wrap content in a section heading: `<h1>{currentMonth}</h1>`.

    Skeleton (adapt to actual existing imports / logic):

    ```tsx
    import { redirect } from "next/navigation";
    import { createClient } from "@/lib/supabase/server";
    import { loadMonthBookings } from "./_lib/load-month-bookings";
    import { HomeCalendar } from "./_components/home-calendar";
    import { OnboardingBanner } from "./_components/onboarding-banner";
    // ... existing imports for OnboardingChecklist props if needed ...

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    export default async function DashboardHome() {
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      if (!claims?.claims) redirect("/app/login");

      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("id, slug, onboarding_complete, onboarding_checklist_dismissed_at, created_at")
        .eq("owner_user_id", claims.claims.sub)
        .is("deleted_at", null)
        .limit(1);

      if (error) throw new Error(`Failed to load account: ${error.message}`);
      if (!accounts || accounts.length === 0) redirect("/app/unlinked");
      const account = accounts[0];
      if (!account.onboarding_complete) redirect("/onboarding");

      const checklistWindowOpen =
        account.onboarding_checklist_dismissed_at === null &&
        new Date(account.created_at).getTime() + SEVEN_DAYS_MS > Date.now();

      // ... existing checklist count logic if windowOpen ...

      const today = new Date();
      const bookings = await loadMonthBookings(today);

      return (
        <div>
          {checklistWindowOpen && (
            <OnboardingBanner /* pass props as existing OnboardingChecklist needs */ />
          )}

          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {today.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h1>
            <p className="text-sm text-gray-600 mt-1">Your bookings at a glance.</p>
          </header>

          {bookings.length === 0 && (
            <div className="rounded-xl border bg-white p-6 mb-4 text-center">
              <p className="text-sm text-muted-foreground">
                No bookings in {today.toLocaleDateString(undefined, { month: "long", year: "numeric" })}.
                Bookings will appear here as they're scheduled.
              </p>
            </div>
          )}

          <div className="rounded-xl border bg-white p-4 sm:p-6">
            <HomeCalendar bookings={bookings} />
            {/* 12-04b will wrap HomeCalendar with a sibling DayDetailSheet via a small client wrapper component. */}
          </div>
        </div>
      );
    }
    ```

    Empty-state copy (research Open Question 5): "No bookings in {Month YYYY}. Bookings will appear here as they're scheduled." Calendar still renders behind it (so owner can navigate to other months).

    **Note:** This plan ships HomeCalendar without the drawer. Days are clickable (cursor + hover state), but `onDayClick` is undefined so nothing opens. 12-04b adds a small client-component wrapper that supplies `onDayClick` and renders the `DayDetailSheet`. This split keeps the page.tsx server component small and pushes drawer state to a focused client component in 12-04b.
  </action>
  <verify>
    1. `npx tsc --noEmit` clean.
    2. `npm run dev` → log in as Andrew → visit `/app`. Confirm: calendar visible; sidebar Home item highlighted (from 12-03); floating header pill at top; gradient backdrop behind.
    3. Confirm: month name renders as h1 above calendar.
    4. Days with bookings show capped dots (1, 2, 3, or 3 + "+N") — verify by setting up test bookings if needed.
    5. Click a day → state updates (selected day highlights), no drawer opens (drawer ships in 12-04b — expected).
    6. Onboarding-incomplete account redirects to `/onboarding` (verify by manually setting `onboarding_complete=false` on test account → visiting `/app`).
    7. New account within 7-day window → OnboardingBanner renders above calendar.
    8. Empty months → empty-state text visible above calendar.
    9. Vitest baseline preserved (148+).
  </verify>
  <done>
    `/app` is the Cruip-styled Home tab landing; OnboardingBanner above calendar; HomeCalendar renders capped dots; existing redirects preserved; 12-04b can plug DayDetailSheet into the existing onDayClick prop without touching server-side code.
  </done>
</task>

</tasks>

<verification>
**Plan-level checks:**
- `/app` renders monthly calendar with capped dots (1-3 dots + "+N").
- `loadMonthBookings` filters: status='confirmed', month range, account-scoped.
- `regenerateRescheduleTokenAction` rotates hash + returns rawToken; old hash invalidated.
- `sendReminderForBookingAction` rotates both tokens (Phase 8 cron precedent) + invokes `sendReminderBooker` with verified arg shape.
- Onboarding-incomplete redirect to `/onboarding` preserved.
- OnboardingBanner renders above calendar for new accounts.
- `cancelBookingAsOwner` (existing) UNCHANGED — 12-04b consumes it.
- Vitest baseline preserved (148+ passing).

**Requirements satisfied:**
- UI-06 (monthly calendar with modifiers — capped dots)
- UI-08 (per-row actions) — Server-Action half: regenerate + sendReminder ship; cancel reuses existing; UI wiring in 12-04b

**Phase success criteria contribution:**
- Criterion #2 — calendar half satisfied (drawer half lands in 12-04b)
</verification>

<success_criteria>
1. `loadMonthBookings` server-only query ships, RLS-scoped + explicit account filter, status='confirmed', tested.
2. `regenerateRescheduleTokenAction` ships, follows Phase 8 token-rotation precedent (composes existing `hashToken`), tested.
3. `sendReminderForBookingAction` ships in `app/(shell)/app/bookings/[id]/_lib/actions.ts` next to existing `cancelBookingAsOwner`, mirrors its authorization pattern, tested with 5 cases.
4. HomeCalendar renders capped-dot DayButton (1-3 dots + "+N") and exposes `onDayClick` prop for 12-04b drawer wiring.
5. OnboardingBanner preserves Phase 10 ONBOARD-09 visibility gate.
6. `/app/page.tsx` refactored: existing redirects + checklist gate preserved; WelcomeCard removed (flagged for revisit).
7. Empty-state copy renders for empty months without breaking calendar nav.
8. No Vitest regressions; `npx tsc --noEmit` clean.
</success_criteria>

<output>
After completion, create `.planning/phases/12-branded-ui-overhaul/12-04a-SUMMARY.md` documenting:
- Files: list above
- Decisions: empty-state copy "No bookings in {Month YYYY}..." (research recommendation); WelcomeCard removed (flag for revisit); OnboardingBanner is a thin wrapper preserving existing visibility gate
- Decisions: `regenerateRescheduleTokenAction` composes `hashToken` + `crypto.randomUUID()` rather than using `generateBookingTokens` (which mints both cancel + reschedule — overshoots scope)
- Decisions: `sendReminderForBookingAction` rotates BOTH cancel and reschedule tokens before sending (matches Phase 8 cron precedent in `app/api/cron/send-reminders/route.ts:185`); flag in summary that owner-initiated reminder also invalidates booker's existing email links
- Tech-stack additions: none
- For 12-04b: HomeCalendar exposes `onDayClick(date, dayBookings)` — wrap with a small client component that opens DayDetailSheet
- Cookie-state pitfall: HomeCalendar uses local state only; sidebar_state cookie untouched
</output>
