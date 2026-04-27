---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-05"
type: execute
wave: 2
depends_on: ["08-01"]
files_modified:
  - app/(shell)/app/settings/reminders/page.tsx
  - app/(shell)/app/settings/reminders/_components/reminder-toggles-form.tsx
  - app/(shell)/app/settings/reminders/_lib/actions.ts
  - app/(shell)/app/event-types/[id]/edit/page.tsx
  - app/(shell)/app/event-types/[id]/edit/_components/location-field.tsx
  - app/(shell)/app/event-types/[id]/edit/_lib/actions.ts
  - components/app-sidebar.tsx
  - tests/reminder-settings-actions.test.ts
autonomous: true

must_haves:
  truths:
    - "Owner can navigate to /app/settings/reminders from the sidebar"
    - "Reminder settings page shows three Switch toggles bound to accounts.reminder_include_custom_answers / location / lifecycle_links"
    - "Toggling a switch persists to DB via Server Action with two-stage owner auth (RLS pre-check + service-role write)"
    - "Owner can edit event_types.location on /app/event-types/[id]/edit via a Textarea"
    - "Saving event_type with location persists to DB and is visible after page reload"
    - "Both new pages are wrapped in the existing ShellLayout (sidebar + header context)"
  artifacts:
    - path: "app/(shell)/app/settings/reminders/page.tsx"
      provides: "Reminder settings page (Server Component)"
      contains: "reminder_include"
    - path: "app/(shell)/app/settings/reminders/_components/reminder-toggles-form.tsx"
      provides: "Client component with three Switch toggles"
      contains: "Switch"
    - path: "app/(shell)/app/settings/reminders/_lib/actions.ts"
      provides: "saveReminderTogglesAction Server Action"
      exports: ["saveReminderTogglesAction"]
    - path: "app/(shell)/app/event-types/[id]/edit/_components/location-field.tsx"
      provides: "Location textarea field bound to event_types.location"
      contains: "location"
  key_links:
    - from: "app/(shell)/app/settings/reminders/_components/reminder-toggles-form.tsx"
      to: "saveReminderTogglesAction"
      via: "Switch onCheckedChange → action"
      pattern: "saveReminderTogglesAction"
    - from: "app/(shell)/app/settings/reminders/_lib/actions.ts"
      to: "accounts table"
      via: "service-role client UPDATE accounts SET reminder_include_*"
      pattern: "reminder_include_"
    - from: "app/(shell)/app/event-types/[id]/edit/_components/location-field.tsx"
      to: "event_types.location column"
      via: "form field bound to existing edit Server Action"
      pattern: "location"
---

<objective>
Build two settings surfaces that expose the new Phase 8 schema fields: a Reminder Settings page (three toggles for what reminder emails include) and a Location field in the event-type editor.

Purpose: Without these UIs, the schema columns from 08-01 are dead weight. Owners need to actually configure their per-account reminder content and per-event-type location. Both pages reuse established Phase 2/3 patterns (ShellLayout, two-stage auth, Server Actions) — no new architecture.

Output: Reminder settings page + sidebar link + Server Action; Event-type location field + edit-action update; sidebar updates; one Server Action integration test.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-CONTEXT.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-01-SUMMARY.md
@app/(shell)/app/branding/page.tsx
@app/(shell)/app/event-types/[id]/edit/page.tsx
@components/app-sidebar.tsx
@components/ui/switch.tsx
@components/ui/textarea.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reminder Settings page + Server Action + sidebar link</name>
  <files>app/(shell)/app/settings/reminders/page.tsx, app/(shell)/app/settings/reminders/_components/reminder-toggles-form.tsx, app/(shell)/app/settings/reminders/_lib/actions.ts, components/app-sidebar.tsx</files>
  <action>
    Step A — read existing branding page first:

    Read `app/(shell)/app/branding/page.tsx` and the colocated `_components/` and `_lib/`. Phase 7 Plan 07-04 established a "two-stage owner auth" Server Action pattern (RLS pre-check via `current_owner_account_ids()` RPC, then service-role UPDATE). Reuse it verbatim for the toggles action.

    Step B — Server Component page:

    Create `app/(shell)/app/settings/reminders/page.tsx`:
    ```typescript
    import { createClient } from "@/lib/supabase/server";
    import { redirect } from "next/navigation";
    import { ReminderTogglesForm } from "./_components/reminder-toggles-form";

    export default async function ReminderSettingsPage() {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) redirect("/login");

      // RLS-scoped read — only returns accounts the user owns
      const { data: account } = await supabase
        .from("accounts")
        .select("id, name, reminder_include_custom_answers, reminder_include_location, reminder_include_lifecycle_links")
        .single();

      if (!account) redirect("/login"); // user has no linked account

      return (
        <div className="max-w-2xl space-y-6 p-6">
          <header>
            <h1 className="text-2xl font-semibold">Reminder Settings</h1>
            <p className="text-sm text-muted-foreground">
              Choose what's included in the reminder email sent to bookers about 24 hours before their appointment.
            </p>
          </header>
          <ReminderTogglesForm
            accountId={account.id}
            initial={{
              custom_answers: account.reminder_include_custom_answers,
              location: account.reminder_include_location,
              lifecycle_links: account.reminder_include_lifecycle_links,
            }}
          />
        </div>
      );
    }
    ```

    Step C — Client component with three Switch toggles:

    Create `app/(shell)/app/settings/reminders/_components/reminder-toggles-form.tsx` ("use client"). Three rows, each with:
    - Label + 1-line helper description
    - shadcn `<Switch>` from `components/ui/switch.tsx`

    On `onCheckedChange`:
    - Optimistically update local state
    - Call `saveReminderTogglesAction({ accountId, key, value })`
    - On error, revert and toast via Sonner
    - On success, toast `"Saved"` (subtle)

    Toggle copy (CONTEXT.md decision):
    - "Include booker's custom-question answers" — `reminder_include_custom_answers`
    - "Include event location/address" — `reminder_include_location`
    - "Include cancel and reschedule links" — `reminder_include_lifecycle_links`

    Step D — Server Action `_lib/actions.ts`:

    ```typescript
    "use server";
    import { revalidatePath } from "next/cache";
    import { createClient } from "@/lib/supabase/server";
    import { createAdminClient } from "@/lib/supabase/admin";

    type ToggleKey = "custom_answers" | "location" | "lifecycle_links";

    const COLUMN_BY_KEY: Record<ToggleKey, string> = {
      custom_answers: "reminder_include_custom_answers",
      location: "reminder_include_location",
      lifecycle_links: "reminder_include_lifecycle_links",
    };

    export async function saveReminderTogglesAction(args: {
      accountId: string;
      key: ToggleKey;
      value: boolean;
    }): Promise<{ ok: true } | { ok: false; error: string }> {
      // Stage 1: RLS-scoped owner check (matches Phase 7 branding pattern)
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { ok: false, error: "Unauthorized" };

      const { data: ownership } = await supabase
        .rpc("current_owner_account_ids");
      const ids = (ownership ?? []) as string[];
      if (!ids.includes(args.accountId)) {
        return { ok: false, error: "Forbidden" };
      }

      // Stage 2: service-role write (RLS bypass intentional after stage 1)
      const admin = createAdminClient();
      const column = COLUMN_BY_KEY[args.key];
      const { error } = await admin
        .from("accounts")
        .update({ [column]: args.value })
        .eq("id", args.accountId);

      if (error) return { ok: false, error: "Save failed" };

      revalidatePath("/app/settings/reminders");
      return { ok: true };
    }
    ```

    Step E — Sidebar link in `components/app-sidebar.tsx`:

    Add a new entry under an appropriate section (Settings group if one exists; otherwise as a top-level item near Branding). Read the existing sidebar file first to match the icon/label style. Suggested icon: `BellRing` from lucide-react. Label: "Reminder Settings".

    DO NOT change the route guard (proxy.ts) — `/app/settings/reminders` is already covered by the existing `/app/*` auth gate.
  </action>
  <verify>
    `ls app/(shell)/app/settings/reminders/page.tsx app/(shell)/app/settings/reminders/_components/reminder-toggles-form.tsx app/(shell)/app/settings/reminders/_lib/actions.ts` — all three exist.
    `grep -n "Reminder Settings\|/app/settings/reminders" components/app-sidebar.tsx` shows the sidebar link.
    `grep -n "current_owner_account_ids" app/(shell)/app/settings/reminders/_lib/actions.ts` confirms two-stage auth.
    `npm run build` succeeds; `npx tsc --noEmit` passes.
    Manual: `npm run dev`, navigate to /app/settings/reminders, see three toggles with current values.
  </verify>
  <done>
    /app/settings/reminders page exists, shows three toggles preloaded from DB, persists changes via two-stage-auth Server Action, accessible from sidebar.
  </done>
</task>

<task type="auto">
  <name>Task 2: Event-type location field in editor</name>
  <files>app/(shell)/app/event-types/[id]/edit/page.tsx, app/(shell)/app/event-types/[id]/edit/_components/location-field.tsx, app/(shell)/app/event-types/[id]/edit/_lib/actions.ts</files>
  <action>
    Step A — read the existing event-type edit page to find where the form lives:

    The edit page exists at `app/(shell)/app/event-types/[id]/edit/page.tsx` (Phase 3). Read it and the colocated form component to identify:
    - The Server Action that handles save (likely `updateEventTypeAction` or similar)
    - The form component (likely `EventTypeForm` or split components)
    - The Zod schema used for validation

    Step B — extend the form:

    Add a `location` field to the existing edit form. Use shadcn `<Textarea>` from `components/ui/textarea.tsx`.

    Suggested placement: below the description field, above the duration/buffer fields. Label: "Location / Address". Helper text: "Optional. Shown in reminder emails when enabled."

    Field props:
    - `name="location"`
    - `defaultValue={eventType.location ?? ""}`
    - `rows={3}`
    - Optional `maxLength={500}` for sanity

    Step C — extend the existing Server Action:

    Wherever the existing edit action lives, add `location: z.string().max(500).optional().nullable()` to the Zod schema, and include `location: input.location ?? null` in the UPDATE payload.

    Critical:
    - Do NOT create a new action. Extend the existing one. Reduces duplication and matches Phase 3 patterns.
    - Empty-string input should normalize to `null` in the DB (cleaner queries downstream).
    - The "create new event type" flow at `app/(shell)/app/event-types/new` does NOT need a location field in v1 (CONTEXT.md doesn't require it). Owners can edit-set after creation. Document this in SUMMARY.

    Step D — typecheck + manual verify:

    `npx tsc --noEmit`
    `npm run dev`, navigate to an existing event type's edit page, set location to "123 Main St, Omaha NE 68102", save, refresh — value persists.
  </action>
  <verify>
    `grep -n "location" app/(shell)/app/event-types/[id]/edit/page.tsx app/(shell)/app/event-types/[id]/edit/_components/*.tsx` shows the field added.
    `grep -n "location" app/(shell)/app/event-types/[id]/edit/_lib/actions.ts` shows the action updated.
    `npm run build` succeeds.
    Manual save+refresh persistence check passes.
  </verify>
  <done>
    Location field is editable on existing event-type edit page. Saves persist. Empty input normalizes to NULL. Field is read by reminder cron via the join in 08-04.
  </done>
</task>

<task type="auto">
  <name>Task 3: Server Action integration test for reminder toggles</name>
  <files>tests/reminder-settings-actions.test.ts</files>
  <action>
    Create a Vitest integration test for `saveReminderTogglesAction` mirroring the test pattern used for Phase 7 branding actions (look in `tests/` for any existing branding-action test; if none, mirror `tests/cancel-reschedule-api.test.ts` style).

    Cases to cover:

    1. **Unauthenticated**: Mock `auth.getUser()` to return null → action returns `{ ok: false, error: "Unauthorized" }`.
    2. **Wrong owner**: Mock `current_owner_account_ids()` RPC to return `[]` while args has a different accountId → action returns `{ ok: false, error: "Forbidden" }`.
    3. **Happy path**: Mock RPC to return `[args.accountId]` → action calls admin client UPDATE with the right column and value, returns `{ ok: true }`.
    4. **Each toggle key**: Loop through `["custom_answers", "location", "lifecycle_links"]` and assert each maps to the correct DB column (`reminder_include_custom_answers`, `reminder_include_location`, `reminder_include_lifecycle_links`).

    The test should NOT exercise the Phase 7 branding action; just the new toggles action. Reuse the existing supabase mocks from `tests/__mocks__/`.

    Note on `cancelBookingAsOwner` mocking lesson (STATE.md line 178): Server Actions that call `createClient()` from `next/headers` will throw outside a Next request context. If this test pattern fails for the same reason, the workaround is to import the action's INNER logic (extract a pure function) or use vitest's request-context mocking. Match whatever pattern the Phase 6 owner-cancel tests use — DO NOT invent a new approach.

    Run: `npm test -- reminder-settings-actions`. All cases pass.

    Commit:
    ```bash
    git add app/\(shell\)/app/settings \
            app/\(shell\)/app/event-types/\[id\]/edit \
            components/app-sidebar.tsx \
            tests/reminder-settings-actions.test.ts
    git commit -m "feat(08-05): reminder settings page + event-type location field"
    ```
  </action>
  <verify>
    `npm test -- reminder-settings-actions` passes all cases.
    `npm test` full suite green.
  </verify>
  <done>
    Three toggle keys map correctly. Unauthorized + forbidden paths return proper error. Test prevents future drift in column-name mapping.
  </done>
</task>

</tasks>

<verification>
1. /app/settings/reminders renders with three switches matching DB state.
2. Toggling a switch persists across reload.
3. Sidebar shows "Reminder Settings" link.
4. Event-type edit page has a Location textarea; save+reload persists value.
5. `npm test` full suite green.
6. `npm run build` succeeds.
</verification>

<success_criteria>
- New capability: per-account reminder content toggles editable from dashboard.
- New capability: event_types.location editable via existing edit form.
- Two-stage auth pattern from Phase 7 reused (no new security pattern).
- Tests cover the auth + key-to-column mapping.
- Sidebar surfaces the new settings page.
</success_criteria>

<output>
After completion, create `.planning/phases/08-reminders-hardening-and-dashboard-list/08-05-SUMMARY.md` documenting:
- Whether the existing event-type edit action was extended (preferred) or a new action created
- Sidebar group/section the link landed in
- Whether create-new-event-type flow gained the location field too (deferred per plan)
- Any deviations from the Phase 7 two-stage auth pattern
</output>
