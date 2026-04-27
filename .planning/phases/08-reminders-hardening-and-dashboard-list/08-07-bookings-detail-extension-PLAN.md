---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-07"
type: execute
wave: 2
depends_on: ["08-01", "08-02"]
files_modified:
  - app/(shell)/app/bookings/[id]/page.tsx
  - app/(shell)/app/bookings/[id]/_components/owner-note.tsx
  - app/(shell)/app/bookings/[id]/_components/booking-history.tsx
  - app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts
  - tests/owner-note-action.test.ts
autonomous: true

must_haves:
  truths:
    - "Owner can read and edit a private note on /app/bookings/[id]"
    - "Note autosaves ~800ms after last keystroke; on blur a final flush save fires"
    - "Saved indicator appears briefly after each successful save"
    - "Booking detail page shows full custom-question answers (CONTEXT.md decision: detail-only)"
    - "Booking history timeline lists booking_events ordered by occurred_at ASC"
    - "If no booking_events row exists for 'created', detail page synthesizes one from bookings.created_at"
    - "Top-right action bar contains existing Cancel button (Phase 6) + kebab menu placeholder"
    - "Booker contact: name displayed, email as mailto:, phone as tel: when present"
  artifacts:
    - path: "app/(shell)/app/bookings/[id]/page.tsx"
      provides: "Detail page rendering booking core + booker contact + answers + owner note + history + action bar"
    - path: "app/(shell)/app/bookings/[id]/_components/owner-note.tsx"
      provides: "Client component with autosave textarea using useDebouncedCallback"
      contains: "useDebouncedCallback"
    - path: "app/(shell)/app/bookings/[id]/_components/booking-history.tsx"
      provides: "Timeline rendering booking_events"
    - path: "app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts"
      provides: "saveOwnerNoteAction Server Action with two-stage owner auth"
      exports: ["saveOwnerNoteAction"]
  key_links:
    - from: "app/(shell)/app/bookings/[id]/_components/owner-note.tsx"
      to: "saveOwnerNoteAction"
      via: "useDebouncedCallback(800ms) → action call"
      pattern: "useDebouncedCallback"
    - from: "app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts"
      to: "bookings.owner_note column"
      via: "two-stage auth: RLS pre-check → service-role UPDATE"
      pattern: "owner_note"
    - from: "app/(shell)/app/bookings/[id]/_components/booking-history.tsx"
      to: "booking_events table"
      via: "server-side query in page.tsx, passed as prop"
      pattern: "booking_events"
---

<objective>
Extend the existing /app/bookings/[id] detail page (Phase 6 placeholder with cancel button) with three Phase 8 capabilities: full custom-answers display, owner-note autosave textarea, and booking-events history timeline. Closes DASH-04.

Purpose: Detail is where the owner does real work (call the booker, prep notes, see what they asked). Phase 6 left this URL as a stub with only a cancel button. Phase 8 fills in the working detail surface.

Output: Extended page.tsx + two new components + one Server Action + one integration test. Reuses use-debounce from 08-02 and two-stage auth pattern from Phase 7.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-CONTEXT.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-RESEARCH.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-01-SUMMARY.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-02-SUMMARY.md
@app/(shell)/app/bookings/[id]/page.tsx
@app/(shell)/app/bookings/[id]/_components
@app/(shell)/app/branding/_lib/actions.ts
@components/ui/textarea.tsx
@components/ui/dropdown-menu.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend detail page with answers, history query, action bar layout</name>
  <files>app/(shell)/app/bookings/[id]/page.tsx, app/(shell)/app/bookings/[id]/_components/booking-history.tsx</files>
  <action>
    Step A — read existing detail page:

    `app/(shell)/app/bookings/[id]/page.tsx` exists from Phase 6 with the Cancel button. Read it. Identify:
    - The Supabase query that loads the booking
    - Where the Cancel button is rendered
    - The auth gate / not-found logic

    Step B — extend the booking query:

    Add `owner_note`, full `answers`, `booker_phone` to the existing select. Also fetch `booking_events` for this booking (separate query — RLS-scoped):

    ```typescript
    const supabase = await createClient();
    const { data: booking } = await supabase
      .from("bookings")
      .select(`
        id, start_at, end_at, status, owner_note,
        booker_name, booker_email, booker_phone, booker_timezone, answers,
        created_at,
        event_types!inner(id, name, duration_minutes, location)
      `)
      .eq("id", params.id)
      .maybeSingle();

    if (!booking) notFound();

    const { data: events } = await supabase
      .from("booking_events")
      .select("id, event_type, occurred_at, metadata")
      .eq("booking_id", booking.id)
      .order("occurred_at", { ascending: true });
    ```

    NOTE: Verify the column name on `booking_events` is `event_type` vs `kind` vs `type` — read `supabase/migrations/20260419120000_initial_schema.sql` for the actual schema. Adjust the select accordingly. The cron in 08-04 inserts with `event_type: "reminder_sent"` — both must match.

    Step C — page layout:

    ```tsx
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{booking.event_types.name}</h1>
          <p className="text-sm text-muted-foreground">
            {format(startTz, "EEEE, MMMM d, yyyy 'at' h:mm a (z)")} · {booking.event_types.duration_minutes} min
          </p>
        </div>
        <BookingActionBar booking={booking} />  {/* existing Cancel button + kebab */}
      </header>

      <section>
        <StatusBadge status={booking.status} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Booker</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="font-medium">{booking.booker_name}</div>
            <a href={`mailto:${booking.booker_email}`} className="text-sm text-muted-foreground underline">{booking.booker_email}</a>
            {booking.booker_phone && (
              <a href={`tel:${booking.booker_phone}`} className="block text-sm text-muted-foreground underline">{booking.booker_phone}</a>
            )}
            <div className="text-xs text-muted-foreground">Timezone: {booking.booker_timezone}</div>
          </CardContent>
        </Card>

        {booking.event_types.location && (
          <Card>
            <CardHeader><CardTitle>Location</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-line">{booking.event_types.location}</CardContent>
          </Card>
        )}
      </section>

      {booking.answers && Object.keys(booking.answers).length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-2">Booker's answers</h2>
          <dl className="space-y-2">
            {Object.entries(booking.answers).map(([q, a]) => (
              <div key={q}>
                <dt className="text-sm font-medium">{q}</dt>
                <dd className="text-sm text-muted-foreground">{String(a)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium mb-2">Owner note</h2>
        <OwnerNote bookingId={booking.id} initialNote={booking.owner_note} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">History</h2>
        <BookingHistory
          events={events ?? []}
          bookingCreatedAt={booking.created_at}
        />
      </section>
    </div>
    ```

    Step D — `BookingHistory` component:

    Create `app/(shell)/app/bookings/[id]/_components/booking-history.tsx` (Server Component, no interactivity):

    Render a vertical timeline. Each entry shows:
    - Event label (Created / Confirmed / Reminder sent / Cancelled / Rescheduled — map from `event_type` value to friendly label)
    - Timestamp formatted in OWNER's local time (this is owner-facing dashboard) — use `format(new Date(occurred_at), "MMM d, yyyy 'at' h:mm a")` (no TZ since owner is single-tenant local).

    If `events` is empty OR no `event_type === 'created'` row exists, prepend a synthesized entry from `bookingCreatedAt` (RESEARCH Pitfall 7).

    Layout: Plain bulleted list with subtle left border / dot indicators is fine for v1. RESEARCH calls visual layout "Claude's Discretion".

    Step E — `BookingActionBar` (small wrapper):

    Wrap the existing Phase 6 Cancel button into a `<BookingActionBar>` flex container with the existing Cancel + a shadcn `<DropdownMenu>` (kebab `<MoreVertical />` icon). The kebab dropdown is a placeholder for v1 — populate with `<DropdownMenuItem disabled>Send manual reminder (coming soon)</DropdownMenuItem>` to demonstrate the slot exists, OR leave the dropdown empty with a "No additional actions" disabled item. CONTEXT.md says "currently empty in v1; placeholder for future".

    The Cancel button itself is unchanged from Phase 6 — DO NOT rewrite it. Just relocate it into the action-bar container.
  </action>
  <verify>
    `grep -n "owner_note\|booking_events" app/(shell)/app/bookings/[id]/page.tsx` shows new queries.
    `grep -n "BookingHistory\|OwnerNote" app/(shell)/app/bookings/[id]/page.tsx` shows new components rendered.
    `grep -n "answers" app/(shell)/app/bookings/[id]/page.tsx` shows custom answers shown.
    `grep -n "DropdownMenu\|MoreVertical" app/(shell)/app/bookings/[id]/page.tsx` shows kebab placeholder.
    `npm run build` succeeds.
    Manual: navigate to a real booking detail; sees booker contact (with mailto + tel), location, answers, history, owner-note section, action bar.
  </verify>
  <done>
    Detail page shows full booking context. History timeline renders events (or synthesizes a created entry if booking_events lacks one). Action bar contains existing Cancel + kebab placeholder.
  </done>
</task>

<task type="auto">
  <name>Task 2: OwnerNote autosave component + Server Action</name>
  <files>app/(shell)/app/bookings/[id]/_components/owner-note.tsx, app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts</files>
  <action>
    Step A — Server Action (mirrors Phase 7 branding two-stage auth):

    Create `app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts`:

    ```typescript
    "use server";
    import { revalidatePath } from "next/cache";
    import { createClient } from "@/lib/supabase/server";
    import { createAdminClient } from "@/lib/supabase/admin";

    export async function saveOwnerNoteAction(args: {
      bookingId: string;
      note: string;  // empty string is valid (means "clear note")
    }): Promise<{ ok: true } | { ok: false; error: string }> {
      // Sanity: cap length to prevent abuse
      const note = args.note.length > 5000 ? args.note.slice(0, 5000) : args.note;

      // Stage 1: RLS-scoped check that the caller can SEE this booking
      const supabase = await createClient();
      const { data: booking } = await supabase
        .from("bookings")
        .select("id")
        .eq("id", args.bookingId)
        .maybeSingle();

      if (!booking) {
        return { ok: false, error: "Booking not found." }; // 404-equivalent (matches Phase 6 cancel pattern)
      }

      // Stage 2: service-role UPDATE — RLS already proved authorization
      const admin = createAdminClient();
      const { error } = await admin
        .from("bookings")
        .update({ owner_note: note.length > 0 ? note : null })
        .eq("id", args.bookingId);

      if (error) return { ok: false, error: "Save failed." };

      revalidatePath(`/app/bookings/${args.bookingId}`);
      return { ok: true };
    }
    ```

    Critical:
    - Two-stage auth: RLS-scoped pre-check using `createClient()` proves the caller is logged-in and owns this booking via Phase 1 RLS policies. Then service-role write. Same shape as Phase 7 branding action and Phase 6 owner cancel.
    - Empty string normalizes to NULL.
    - 5000-char cap is generous but bounded.
    - Both 404-equivalent and forbidden return identical error string (no information leakage about UUIDs that exist in other tenants — matches Phase 6 cancel convention from STATE.md line 169).

    Step B — Client component with autosave:

    Create `app/(shell)/app/bookings/[id]/_components/owner-note.tsx`:

    ```typescript
    "use client";
    import { useState, useTransition } from "react";
    import { useDebouncedCallback } from "use-debounce";
    import { Textarea } from "@/components/ui/textarea";
    import { saveOwnerNoteAction } from "../_lib/owner-note-action";
    import { toast } from "sonner";

    export function OwnerNote({
      bookingId,
      initialNote,
    }: {
      bookingId: string;
      initialNote: string | null;
    }) {
      const [value, setValue] = useState(initialNote ?? "");
      const [savedAt, setSavedAt] = useState<number | null>(null);
      const [, startTransition] = useTransition();

      const save = useDebouncedCallback(async (next: string) => {
        startTransition(async () => {
          const result = await saveOwnerNoteAction({ bookingId, note: next });
          if (result.ok) {
            setSavedAt(Date.now());
          } else {
            toast.error(result.error);
          }
        });
      }, 800);  // RESEARCH Pattern 6 + Claude's Discretion: 800ms

      const showSaved = savedAt !== null && Date.now() - savedAt < 2000;

      return (
        <div className="space-y-1">
          <Textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSavedAt(null);
              save(e.target.value);
            }}
            onBlur={() => save.flush()}
            rows={5}
            maxLength={5000}
            placeholder="Private note. The booker never sees this."
            className="resize-y"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{value.length}/5000</span>
            {showSaved && <span>Saved</span>}
          </div>
        </div>
      );
    }
    ```

    Critical:
    - `value` is fully controlled — keystrokes update local state immediately.
    - `save.flush()` on blur ensures no orphaned saves.
    - "Saved" indicator is inline muted text (RESEARCH Pattern 6 Claude's-Discretion: do NOT use Sonner toast for save confirmations — only for errors).
    - 800ms debounce per CONTEXT.md/RESEARCH.

    Step C — integration test `tests/owner-note-action.test.ts`:

    Cover:
    1. Booking not visible to caller (RLS returns null) → action returns `{ ok: false, error: "Booking not found." }`.
    2. Happy path: RLS finds booking, admin UPDATE called with `owner_note: <note>`.
    3. Empty string normalizes to NULL: caller passes `note: ""` → admin UPDATE called with `owner_note: null`.
    4. Length cap: caller passes 6000-char note → admin UPDATE called with note truncated to 5000.

    Match the Phase 6 owner-cancel test pattern for Server Actions (STATE.md line 178: caller imports the inner logic to bypass Next request-context dependency in vitest, OR uses the same workaround the existing tests use).

    Run: `npm test -- owner-note-action`. All 4 cases pass.

    Commit:
    ```bash
    git add app/\(shell\)/app/bookings/\[id\]/page.tsx \
            app/\(shell\)/app/bookings/\[id\]/_components/owner-note.tsx \
            app/\(shell\)/app/bookings/\[id\]/_components/booking-history.tsx \
            app/\(shell\)/app/bookings/\[id\]/_lib/owner-note-action.ts \
            tests/owner-note-action.test.ts
    git commit -m "feat(08-07): bookings detail extension - answers, owner note autosave, history"
    ```
  </action>
  <verify>
    `grep -n "useDebouncedCallback" app/(shell)/app/bookings/[id]/_components/owner-note.tsx` shows the hook.
    `grep -n "save.flush\|onBlur" app/(shell)/app/bookings/[id]/_components/owner-note.tsx` shows blur flush.
    `grep -n "current_owner_account_ids\|createAdminClient" app/(shell)/app/bookings/[id]/_lib/owner-note-action.ts` shows two-stage auth.
    `npm test -- owner-note-action` all 4 cases pass.
    Manual: type into the textarea, see "Saved" appear ~800ms later; refresh page, note persists.
  </verify>
  <done>
    Owner-note textarea autosaves at 800ms debounce + flush on blur. Two-stage auth prevents cross-tenant writes. Empty string clears note. 5000-char cap enforced. "Saved" indicator visible on success, error toast on failure.
  </done>
</task>

</tasks>

<verification>
1. /app/bookings/[id] for an existing booking renders booker contact (with mailto + tel), location (if set), answers, owner-note textarea, history timeline, action bar.
2. Type into note, "Saved" indicator appears within ~1s.
3. Refresh page — note value persists from DB.
4. Owner of a different account cannot save a note to a booking they don't own (test verifies).
5. `npm test` full suite green.
6. `npm run build` succeeds.
</verification>

<success_criteria>
- DASH-04: Owner can view full booking detail (booker contact, all answers, location, history, owner note).
- New capability: per-booking owner notes editable via autosave with two-stage auth.
- Phase 6 Cancel button still works (relocated into action bar but unchanged).
- Reuses use-debounce from 08-02.
- Tests cover the 4 edge cases of the Server Action.
</success_criteria>

<output>
After completion, create `.planning/phases/08-reminders-hardening-and-dashboard-list/08-07-SUMMARY.md` documenting:
- Whether the existing Phase 6 cancel button was relocated cleanly or required refactoring
- booking_events column-name confirmation (event_type vs kind vs type)
- Whether the kebab menu was left empty or populated with a "coming soon" placeholder
- Server Action test workaround used (matches Phase 6 pattern or new approach)
</output>
