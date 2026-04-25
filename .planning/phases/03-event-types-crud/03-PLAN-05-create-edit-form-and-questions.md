---
phase: 03-event-types-crud
plan: 05
type: execute
wave: 3
depends_on: ["03-03"]
files_modified:
  - app/(shell)/app/event-types/new/page.tsx
  - app/(shell)/app/event-types/[id]/edit/page.tsx
  - app/(shell)/app/event-types/_components/event-type-form.tsx
  - app/(shell)/app/event-types/_components/question-list.tsx
  - app/(shell)/app/event-types/_components/url-preview.tsx
autonomous: true

must_haves:
  truths:
    - "Andrew visits /app/event-types/new and sees a form with Name, URL slug, Duration, Description, Active toggle, and a Custom Questions section (EVENT-01)"
    - "As Andrew types in Name, the slug field auto-generates LIVE via the slugify() utility — UNTIL Andrew manually edits the slug, after which auto-gen stops for the rest of the session (CONTEXT decision)"
    - "A live URL preview appears below the slug field showing yoursite.com/nsi/[slug] (CONTEXT — hardcoded yoursite.com placeholder; Phase 7 swaps for branded domain)"
    - "When editing an already-saved event type, a yellow inline warning appears below the slug field if the user changes the saved slug ('Changing the slug breaks any existing booking links shared with this event type.')"
    - "Custom Questions section: Add Question button + per-question rows with Label / Type Select / Required Switch / Up arrow / Down arrow / Remove (×) (EVENT-05)"
    - "Question types in v1: short-text / long-text / yes-no / single-select. Single-select rows show an inline editable options list (cap 20) (CONTEXT)"
    - "Reorder via up/down arrow buttons swaps adjacent positions in the RHF form state (no drag-and-drop in v1)"
    - "Submitting the form calls createEventTypeAction or updateEventTypeAction directly (NOT via <form action>); event-type fields + custom questions submitted ATOMICALLY in a single action call (CONTEXT 'Save submits everything together')"
    - "Server-side fieldErrors from the action surface as inline RHF errors on the corresponding fields (slug duplication, length violations, etc.); formError surfaces in a top-of-form Alert"
    - "Edit page (/app/event-types/[id]/edit) loads the row server-side, passes it to the same form component as defaultValues; if the id doesn't match an event type the user owns (RLS or deleted_at IS NOT NULL), shows a 404 (notFound())"
    - "On success, the action redirects to /app/event-types and the list re-renders showing the new/updated row; toast fires from the list page on next mount"
  artifacts:
    - path: "app/(shell)/app/event-types/new/page.tsx"
      provides: "Server Component shell — renders <EventTypeForm mode='create' />"
      min_lines: 10
    - path: "app/(shell)/app/event-types/[id]/edit/page.tsx"
      provides: "Server Component shell — awaits params, fetches event type by id (active or inactive only — archived 404s), passes as defaultValues to <EventTypeForm mode='edit' />"
      min_lines: 25
      contains: "notFound"
    - path: "app/(shell)/app/event-types/_components/event-type-form.tsx"
      provides: "Client component — RHF + zodResolver + Controller for Switch + live name→slug auto-fill + URL preview + slug-edit warning; calls createEventTypeAction or updateEventTypeAction directly with structured input"
      contains: "use client"
      min_lines: 150
    - path: "app/(shell)/app/event-types/_components/question-list.tsx"
      provides: "Client component — useFieldArray subform: Add / Remove / Move up / Move down + per-question Label/Type/Required + inline options for single-select"
      contains: "use client"
      min_lines: 100
    - path: "app/(shell)/app/event-types/_components/url-preview.tsx"
      provides: "Pure component — renders yoursite.com/nsi/[slug] with monospace styling; Phase 7 will swap the domain"
  key_links:
    - from: "app/(shell)/app/event-types/_components/event-type-form.tsx"
      to: "app/(shell)/app/event-types/_lib/actions.ts"
      via: "imports createEventTypeAction, updateEventTypeAction; calls them directly with structured input (NOT via <form action>)"
      pattern: "createEventTypeAction|updateEventTypeAction"
    - from: "app/(shell)/app/event-types/_components/event-type-form.tsx"
      to: "app/(shell)/app/event-types/_lib/schema.ts"
      via: "useForm({ resolver: zodResolver(eventTypeSchema), defaultValues })"
      pattern: "zodResolver\\(eventTypeSchema\\)"
    - from: "app/(shell)/app/event-types/_components/event-type-form.tsx"
      to: "lib/slugify.ts"
      via: "slugify(name) on every name onChange while slugManuallyEdited === false"
      pattern: "slugify"
    - from: "app/(shell)/app/event-types/_components/question-list.tsx"
      to: "react-hook-form useFieldArray"
      via: "useFieldArray({ control, name: 'custom_questions' })"
      pattern: "useFieldArray"
    - from: "app/(shell)/app/event-types/[id]/edit/page.tsx"
      to: "Supabase event_types table"
      via: ".select('*').eq('id', id).is('deleted_at', null).maybeSingle()"
      pattern: "is\\(\"deleted_at\", null\\)"
---

<objective>
Ship the event-type CREATE and EDIT routes — the form (Client Component), the inline custom-questions sub-form, and the URL preview helper. Both routes share a single `EventTypeForm` component that branches on `mode` ("create" | "edit"). The form calls `createEventTypeAction` / `updateEventTypeAction` from Plan 03 directly with a structured `EventTypeInput` argument (not FormData) so that nested `custom_questions` data flows naturally.

Purpose: Closes EVENT-01 (create), EVENT-02 (edit), EVENT-05 (custom questions), and contributes to EVENT-04 (active toggle in form) + EVENT-06 (slug uniqueness UX with live preview + edit warning).

Output: A working `/app/event-types/new` and `/app/event-types/[id]/edit` that, end-to-end with Plan 04's list page, lets Andrew create, edit, and (via Plan 04's kebab) archive his event types. Custom questions persist as `jsonb` on the row.

Plan-level scoping: This plan does NOT build a separate questions sub-route — questions are an INLINE section in the same form (CONTEXT decision). This plan does NOT add a "Duplicate event type" button (deferred). Edit page rejects archived event types via `notFound()` — restoring is the path back per CONTEXT.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-event-types-crud/03-CONTEXT.md
@.planning/phases/03-event-types-crud/03-RESEARCH.md
@.planning/phases/03-event-types-crud/03-01-SUMMARY.md
@.planning/phases/03-event-types-crud/03-02-SUMMARY.md
@.planning/phases/03-event-types-crud/03-03-SUMMARY.md

# Plan 03 module this plan consumes
@app/(shell)/app/event-types/_lib/actions.ts
@app/(shell)/app/event-types/_lib/schema.ts
@app/(shell)/app/event-types/_lib/types.ts
@lib/slugify.ts

# Existing form patterns to inherit
@app/(auth)/app/login/login-form.tsx
@app/(auth)/app/login/page.tsx
@components/ui/switch.tsx
@components/ui/select.tsx
@components/ui/textarea.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ship route shells (new + edit pages) and the URL preview helper</name>
  <files>app/(shell)/app/event-types/new/page.tsx, app/(shell)/app/event-types/[id]/edit/page.tsx, app/(shell)/app/event-types/_components/url-preview.tsx</files>
  <action>
**File 1 — `app/(shell)/app/event-types/_components/url-preview.tsx`** (pure presentational; Phase 7 will swap the hardcoded domain):

```tsx
import { Card, CardContent } from "@/components/ui/card";

/**
 * Live URL preview shown below the slug field.
 *
 * Format: yoursite.com/nsi/[slug]
 *
 * The "yoursite.com" segment is a Phase-3 placeholder. Phase 7 swaps it for the
 * per-account branded domain. Do NOT bind this to the live Vercel deploy URL —
 * Phase 7 needs to swap it atomically (CONTEXT.md "Phase-7 forward-compatibility").
 *
 * The "nsi" segment is the seeded account slug; for v1 single-tenant it's
 * hardcoded. Multi-tenant signup (v2) will read it from the current account.
 */
export function UrlPreview({ slug }: { slug: string }) {
  return (
    <Card className="bg-muted/40 border-dashed">
      <CardContent className="py-2 px-3">
        <div className="text-xs text-muted-foreground mb-1">Booking URL</div>
        <code className="text-sm font-mono break-all">
          yoursite.com/nsi/{slug || <span className="text-muted-foreground">your-slug</span>}
        </code>
      </CardContent>
    </Card>
  );
}
```

**File 2 — `app/(shell)/app/event-types/new/page.tsx`** (Server Component shell — minimal):

```tsx
import { EventTypeForm } from "../_components/event-type-form";

export default function NewEventTypePage() {
  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Create event type</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define what people can book. You can edit any of this later.
        </p>
      </header>
      <EventTypeForm mode="create" />
    </div>
  );
}
```

**File 3 — `app/(shell)/app/event-types/[id]/edit/page.tsx`** (Server Component shell — fetches the row, gates on archived, passes defaultValues):

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventTypeForm } from "../../_components/event-type-form";
import type { EventTypeRow } from "../../_lib/types";

// Next.js 16: params is a Promise — must be awaited (Phase 1 RESEARCH; Phase 3 RESEARCH Pitfall 4).
export default async function EditEventTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_types")
    .select(
      "id, account_id, slug, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_advance_days, custom_questions, is_active, created_at, deleted_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  // RLS handles ownership. If row is missing OR archived, 404.
  if (error || !data) {
    notFound();
  }

  const eventType = data as EventTypeRow;

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Edit event type</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update name, slug, duration, or custom questions.
        </p>
      </header>
      <EventTypeForm
        mode="edit"
        eventTypeId={eventType.id}
        defaultValues={{
          name: eventType.name,
          slug: eventType.slug,
          duration_minutes: eventType.duration_minutes,
          description: eventType.description ?? "",
          is_active: eventType.is_active,
          custom_questions: eventType.custom_questions ?? [],
        }}
      />
    </div>
  );
}
```

Key rules:
- The edit page filters by `.is("deleted_at", null)` — archived rows return null and 404 (CONTEXT: archived rows are not directly editable; user must restore first).
- `params` is awaited (Next.js 16 Promise shape; same as `searchParams` in Plan 04).
- The edit page does NOT also need a `current_owner_account_ids` check — RLS scopes the SELECT to rows the user owns (Phase 1 policy). If the user doesn't own the row, the SELECT returns no data and 404 fires.
- Both routes inherit the `(shell)` layout (sidebar + header) automatically — they live under `app/(shell)/app/event-types/`.
- Both routes use `max-w-3xl` (narrower than the list page's `max-w-5xl`) — forms read better at narrower width.
- The new page passes `mode="create"` and NO `defaultValues` — the form picks Zod defaults internally (`is_active: true`, `custom_questions: []`).
- The edit page passes `mode="edit"`, `eventTypeId={eventType.id}`, and explicit `defaultValues` extracted from the row — RHF will use these to pre-populate the form.

DO NOT:
- Do not add a "Delete" or "Archive" button to the edit page header — kebab on the list is the canonical archive entry.
- Do not pre-render or generateStaticParams the edit page — always fetched fresh per request.
- Do not import from `app/(shell)/app/event-types/_lib/actions.ts` here — the form owns the action calls.
- Do not coerce `description` to `null` here — pass the empty string and let the Zod transform normalize.
  </action>
  <verify>
```bash
ls "app/(shell)/app/event-types/new/page.tsx" "app/(shell)/app/event-types/[id]/edit/page.tsx" "app/(shell)/app/event-types/_components/url-preview.tsx"

# New page
grep -q 'mode="create"' "app/(shell)/app/event-types/new/page.tsx" && echo "create mode ok"
grep -q "EventTypeForm" "app/(shell)/app/event-types/new/page.tsx" && echo "form imported"

# Edit page
grep -q "await params" "app/(shell)/app/event-types/[id]/edit/page.tsx" && echo "async params ok"
grep -q '\.is("deleted_at", null)' "app/(shell)/app/event-types/[id]/edit/page.tsx" && echo "archived gate ok"
grep -q "notFound" "app/(shell)/app/event-types/[id]/edit/page.tsx" && echo "404 wired ok"
grep -q 'mode="edit"' "app/(shell)/app/event-types/[id]/edit/page.tsx" && echo "edit mode ok"
grep -q "defaultValues" "app/(shell)/app/event-types/[id]/edit/page.tsx" && echo "defaults passed"

# URL preview shows hardcoded yoursite.com placeholder
grep -q "yoursite.com" "app/(shell)/app/event-types/_components/url-preview.tsx" && echo "placeholder domain ok"
grep -q "/nsi/" "app/(shell)/app/event-types/_components/url-preview.tsx" && echo "account slug ok"
```

Note: Build will fail until Tasks 2+3 ship `event-type-form.tsx`. Build verify moves to Task 3.
  </verify>
  <done>
URL preview component shows `yoursite.com/nsi/[slug]` with placeholder. New page is a Server Component shell that renders `<EventTypeForm mode="create" />`. Edit page awaits params, fetches the row filtered to non-archived rows, 404s if missing/archived, and renders `<EventTypeForm mode="edit" eventTypeId=... defaultValues=... />`.

Commit: `feat(03-05): event types create + edit route shells and URL preview helper`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Ship the question-list sub-form (useFieldArray)</name>
  <files>app/(shell)/app/event-types/_components/question-list.tsx</files>
  <action>
Create the inline custom-questions section as a separate Client Component that takes RHF `control` as a prop. Using `useFieldArray` keeps reorder/add/remove operations local to RHF state (no manual array manipulation).

```tsx
"use client";

import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type FieldErrors,
  Controller,
  useWatch,
} from "react-hook-form";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventTypeInput } from "../_lib/schema";

const MAX_OPTIONS = 20;

const TYPE_LABELS: Record<EventTypeInput["custom_questions"][number]["type"], string> = {
  "short-text": "Short text",
  "long-text": "Long text",
  "yes-no": "Yes / No",
  "single-select": "Single select",
};

export function QuestionList({
  control,
  register,
  errors,
}: {
  control: Control<EventTypeInput>;
  register: UseFormRegister<EventTypeInput>;
  errors: FieldErrors<EventTypeInput>;
}) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "custom_questions",
  });

  function handleAdd() {
    append({
      id: crypto.randomUUID(),
      label: "",
      type: "short-text",
      required: false,
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Custom questions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Optional. Booker answers appear with the booking confirmation.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add question
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No custom questions yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <QuestionRow
              key={field.id}
              index={index}
              total={fields.length}
              control={control}
              register={register}
              errors={errors}
              onMoveUp={() => move(index, index - 1)}
              onMoveDown={() => move(index, index + 1)}
              onRemove={() => remove(index)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestionRow({
  index,
  total,
  control,
  register,
  errors,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  total: number;
  control: Control<EventTypeInput>;
  register: UseFormRegister<EventTypeInput>;
  errors: FieldErrors<EventTypeInput>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  // Watch the type so we conditionally render the options sub-list for single-select.
  const type = useWatch({
    control,
    name: `custom_questions.${index}.type`,
  });

  const labelError = errors.custom_questions?.[index]?.label?.message;

  return (
    <li className="border rounded-lg p-4 flex flex-col gap-3 bg-card">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move question up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Move question down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="grid gap-2">
            <Label htmlFor={`q-${index}-label`}>Question</Label>
            <Input
              id={`q-${index}-label`}
              placeholder="e.g. What's the project address?"
              {...register(`custom_questions.${index}.label`)}
            />
            {labelError && (
              <p className="text-sm text-destructive">{labelError}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`q-${index}-type`}>Type</Label>
            <Controller
              control={control}
              name={`custom_questions.${index}.type`}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(next) => {
                    field.onChange(next);
                    // Note: switching to single-select would orphan options if the
                    // user previously had a single-select with options. RHF preserves
                    // values across renders. For v1, accept that minor edge case —
                    // the Zod safeParse on submit will surface validation errors if
                    // a stale options array fails. v2 polish: clear options on type
                    // change.
                  }}
                >
                  <SelectTrigger id={`q-${index}-type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short-text">{TYPE_LABELS["short-text"]}</SelectItem>
                    <SelectItem value="long-text">{TYPE_LABELS["long-text"]}</SelectItem>
                    <SelectItem value="yes-no">{TYPE_LABELS["yes-no"]}</SelectItem>
                    <SelectItem value="single-select">{TYPE_LABELS["single-select"]}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 items-center">
          <Controller
            control={control}
            name={`custom_questions.${index}.required`}
            render={({ field }) => (
              <div className="flex flex-col items-center gap-1">
                <Switch
                  id={`q-${index}-required`}
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
                <Label
                  htmlFor={`q-${index}-required`}
                  className="text-xs font-normal cursor-pointer"
                >
                  Required
                </Label>
              </div>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label="Remove question"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {type === "single-select" && (
        <SingleSelectOptions
          index={index}
          control={control}
          register={register}
          errors={errors}
        />
      )}
    </li>
  );
}

function SingleSelectOptions({
  index,
  control,
  register,
  errors,
}: {
  index: number;
  control: Control<EventTypeInput>;
  register: UseFormRegister<EventTypeInput>;
  errors: FieldErrors<EventTypeInput>;
}) {
  // Inner field array for this question's options.
  const { fields, append, remove } = useFieldArray({
    control,
    // useFieldArray needs primitive arrays wrapped — RHF supports nested paths.
    // We coerce the path to any because the options key only exists on
    // single-select branches of the discriminated union (TS struggles to narrow
    // through a generic dynamic path).
    name: `custom_questions.${index}.options` as never,
  });

  // Per-question error surface (Zod will populate this if options fail validation)
  const optionsError = (errors.custom_questions?.[index] as { options?: { message?: string } } | undefined)?.options?.message;

  return (
    <div className="ml-8 grid gap-2">
      <Label>Options</Label>
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Add at least one option.
        </p>
      )}
      <ul className="grid gap-2">
        {fields.map((field, optIndex) => (
          <li key={field.id} className="flex items-center gap-2">
            <Input
              placeholder={`Option ${optIndex + 1}`}
              {...register(`custom_questions.${index}.options.${optIndex}` as never)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => remove(optIndex)}
              aria-label={`Remove option ${optIndex + 1}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      {optionsError && (
        <p className="text-sm text-destructive">{optionsError}</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append("" as never)}
        disabled={fields.length >= MAX_OPTIONS}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add option
      </Button>
      {fields.length >= MAX_OPTIONS && (
        <p className="text-xs text-muted-foreground">
          Maximum {MAX_OPTIONS} options reached.
        </p>
      )}
    </div>
  );
}
```

Key rules:
- Top-level `useFieldArray` is over `custom_questions` (the question list).
- Per-row `useFieldArray` (only mounted for `single-select` rows) is over `custom_questions.${index}.options` (the option strings).
- Use `Controller` for `Switch` and `Select` (RESEARCH Pitfall 5: Switch and Select don't expose DOM refs; `register()` would silently no-op).
- Use `register()` for the `label` Input and the `options.${optIndex}` Inputs (these are native HTML inputs, ref-forwarding works).
- `useWatch` on `custom_questions.${index}.type` so the row re-renders when the type changes (to mount/unmount the SingleSelectOptions sub-component).
- IDs for new questions use `crypto.randomUUID()` (browser + Node 16+; no `uuid` npm dep).
- Reorder: `move(from, to)` from `useFieldArray` swaps positions in RHF state. Up arrow disabled at `index === 0`, down arrow disabled at `index === total - 1`.
- Remove: `remove(index)` from `useFieldArray`. No confirmation modal — rebuild is cheap and accidental removal is recoverable by clicking Add Question.
- Cap of 20 options per single-select (matches `eventTypeSchema`'s `.max(20)` + CONTEXT.md 20 cap). Add Option button disabled at the cap with a small notice.
- The `as never` casts on the inner `useFieldArray`'s `name` and the `register(... as never)` on option inputs are needed because RHF's TypeScript can't narrow the discriminated union path. The runtime behavior is correct; the cast is purely a type-level escape hatch.
- Empty-question-list copy: just italic "No custom questions yet." — don't make it look like an error.

DO NOT:
- Do not add drag-and-drop — CONTEXT defers to v2.
- Do not add a "Duplicate question" button.
- Do not auto-clear options when the user switches a single-select to a different type — accept the minor edge case (commented in the code) for v1; Zod will surface a "tried to validate single-select without options" error if it happens, which is at least loud.
- Do not pre-populate any default question on Add Question other than `{type: "short-text", label: "", required: false}`.
- Do not extract `SingleSelectOptions` to its own file — it's only used here, and inlining keeps RHF type narrowing local.
  </action>
  <verify>
```bash
ls "app/(shell)/app/event-types/_components/question-list.tsx"
grep -q "useFieldArray" "app/(shell)/app/event-types/_components/question-list.tsx" && echo "useFieldArray ok"
grep -q "crypto.randomUUID" "app/(shell)/app/event-types/_components/question-list.tsx" && echo "uuid generation ok"
grep -q "Controller" "app/(shell)/app/event-types/_components/question-list.tsx" && echo "Controller used for Switch+Select"
grep -q 'name={`custom_questions' "app/(shell)/app/event-types/_components/question-list.tsx" || grep -q 'name=`custom_questions' "app/(shell)/app/event-types/_components/question-list.tsx" && echo "field array path ok"
grep -q "single-select" "app/(shell)/app/event-types/_components/question-list.tsx" && echo "single-select branch ok"
grep -q "MAX_OPTIONS" "app/(shell)/app/event-types/_components/question-list.tsx" && echo "options cap ok"
grep -qE "ArrowUp|ArrowDown" "app/(shell)/app/event-types/_components/question-list.tsx" && echo "reorder buttons ok"
```

Note: Build verify happens in Task 3 (the form imports this file).
  </verify>
  <done>
QuestionList exists, uses `useFieldArray` for both the question list and per-question options, mounts `SingleSelectOptions` only for `single-select` type, generates IDs via `crypto.randomUUID()`, uses `Controller` for Switch + Select and `register()` for text inputs, supports reorder via `move()` and remove via `remove()`, and respects the 20-option cap.

Commit: `feat(03-05): custom questions sub-form with useFieldArray, reorder, and inline options`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Ship the EventTypeForm component (the heart of the plan)</name>
  <files>app/(shell)/app/event-types/_components/event-type-form.tsx</files>
  <action>
This is the largest file in the plan. It composes everything: RHF + zodResolver + Controller for the active Switch + live name→slug auto-fill + URL preview + slug-edit warning + atomic submit calling the right action based on `mode`.

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { eventTypeSchema, type EventTypeInput } from "../_lib/schema";
import {
  createEventTypeAction,
  updateEventTypeAction,
  type EventTypeState,
} from "../_lib/actions";
import { slugify } from "@/lib/slugify";
import { QuestionList } from "./question-list";
import { UrlPreview } from "./url-preview";

type FormMode = "create" | "edit";

const DEFAULTS: EventTypeInput = {
  name: "",
  slug: "",
  duration_minutes: 30,
  description: "",
  is_active: true,
  custom_questions: [],
};

export function EventTypeForm({
  mode,
  eventTypeId,
  defaultValues,
}: {
  mode: FormMode;
  eventTypeId?: string;
  defaultValues?: EventTypeInput;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // Track whether the user has manually edited the slug. Once true, name->slug
  // auto-fill stops for the rest of the session (CONTEXT decision).
  const [slugManuallyEdited, setSlugManuallyEdited] = useState<boolean>(
    mode === "edit", // Edit mode: assume the saved slug is intentional; do not auto-overwrite from name.
  );

  // Track the original slug for the "you're changing a saved slug" warning (edit mode only).
  const originalSlug = defaultValues?.slug ?? "";

  const initialValues: EventTypeInput = defaultValues ?? DEFAULTS;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<EventTypeInput>({
    resolver: zodResolver(eventTypeSchema),
    mode: "onBlur",
    defaultValues: initialValues,
  });

  // Live URL preview reads the current slug value reactively.
  const currentSlug = watch("slug");

  function handleNameChange(value: string) {
    setValue("name", value, { shouldValidate: false, shouldDirty: true });
    if (!slugManuallyEdited) {
      const next = slugify(value);
      setValue("slug", next, {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
  }

  function handleSlugChange(value: string) {
    // Coerce to slug-valid characters as the user types (no surprises at submit).
    const coerced = slugify(value);
    setValue("slug", coerced, { shouldValidate: false, shouldDirty: true });
    if (!slugManuallyEdited && coerced !== slugify(watch("name"))) {
      setSlugManuallyEdited(true);
    }
  }

  function applyServerErrors(state: EventTypeState) {
    if (state.fieldErrors) {
      for (const [field, messages] of Object.entries(state.fieldErrors)) {
        if (!messages || messages.length === 0) continue;
        setError(field as keyof EventTypeInput, {
          type: "server",
          message: messages[0],
        });
      }
    }
    if (state.formError) {
      setServerError(state.formError);
    }
  }

  async function onSubmit(values: EventTypeInput) {
    setServerError(null);

    startTransition(async () => {
      try {
        const result =
          mode === "create"
            ? await createEventTypeAction(values)
            : await updateEventTypeAction(eventTypeId!, values);

        // If the action redirected, control never returns here (NEXT_REDIRECT
        // throws). If it returned an EventTypeState, we have errors to surface.
        if (result) {
          applyServerErrors(result);
          if (result.formError) {
            toast.error(result.formError);
          } else if (result.fieldErrors) {
            // Don't double-toast field errors; they appear inline.
          }
        }
      } catch (err) {
        // Re-throw NEXT_REDIRECT so Next.js can navigate.
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest?: unknown }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        // Genuine unexpected error.
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  // Show the slug-edit warning ONLY in edit mode AND only when the current
  // slug differs from the originally-saved slug.
  const showSlugChangeWarning =
    mode === "edit" && currentSlug !== originalSlug && currentSlug.length > 0;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
      noValidate
    >
      {serverError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Name */}
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="30-minute consult"
          {...register("name")}
          onChange={(e) => handleNameChange(e.target.value)}
          autoComplete="off"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Slug */}
      <div className="grid gap-2">
        <Label htmlFor="slug">URL slug</Label>
        <Input
          id="slug"
          placeholder="30-minute-consult"
          className="font-mono"
          {...register("slug")}
          onChange={(e) => handleSlugChange(e.target.value)}
          autoComplete="off"
        />
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
        {showSlugChangeWarning && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Changing the slug breaks any existing booking links shared with this event type.
            </AlertDescription>
          </Alert>
        )}
        <UrlPreview slug={currentSlug} />
      </div>

      {/* Duration */}
      <div className="grid gap-2">
        <Label htmlFor="duration_minutes">Duration (minutes)</Label>
        <Input
          id="duration_minutes"
          type="number"
          min={1}
          max={480}
          step={5}
          inputMode="numeric"
          className="max-w-[160px]"
          {...register("duration_minutes", { valueAsNumber: true })}
        />
        {errors.duration_minutes && (
          <p className="text-sm text-destructive">{errors.duration_minutes.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="grid gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="What happens during this booking?"
          rows={3}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Active toggle */}
      <div className="flex items-start gap-3 border rounded-lg p-3 bg-muted/30">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              id="is_active"
              checked={!!field.value}
              onCheckedChange={field.onChange}
              className="mt-0.5"
            />
          )}
        />
        <div className="grid gap-1">
          <Label htmlFor="is_active" className="cursor-pointer">
            Active
          </Label>
          <p className="text-xs text-muted-foreground">
            Inactive event types are hidden from booking pages but stay editable here.
          </p>
        </div>
      </div>

      <Separator />

      {/* Custom questions */}
      <QuestionList control={control} register={register} errors={errors} />

      <Separator />

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-3">
        <Button asChild variant="outline" type="button" disabled={isPending}>
          <Link href="/app/event-types">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create event type"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
```

Key rules:
- The form uses `handleSubmit(onSubmit)` — RHF runs Zod validation, and ONLY if validation passes does `onSubmit(values)` execute. Server-side action then re-validates (defense in depth).
- The action is called DIRECTLY (`await createEventTypeAction(values)`), NOT via `<form action={formAction}>`. This is the contract from Plan 03 (the action signature accepts a structured `EventTypeInput`, not FormData) — driven by the need to send nested `custom_questions` cleanly (RESEARCH Pitfall 6 + Open Q2).
- The NEXT_REDIRECT re-throw in the catch block is essential: when the action calls `redirect("/app/event-types")` it throws `NEXT_REDIRECT`. Without re-throwing, the catch swallows the navigation. This is the same pattern Phase 2's login form uses.
- Slug auto-fill rules:
  - Create mode: slug auto-fills from name UNTIL the user manually edits the slug. Detected by comparing typed slug to `slugify(name)` — if they diverge, the user edited it.
  - Edit mode: `slugManuallyEdited` starts true (the saved slug is intentional, so name edits should NOT overwrite the slug).
- Slug auto-coercion: every keystroke on the slug field passes through `slugify()`. This means "Hello World" typed into slug becomes "hello-world" on the fly — no slug-validation surprises at submit time.
- Slug-change warning: only renders in edit mode AND when the current slug differs from the original. Yellow Alert (amber-300/50/900 — manual color classes since shadcn Alert doesn't ship a "warning" variant). Renders ABOVE the URL preview so it's the first thing the user sees.
- `register("duration_minutes", { valueAsNumber: true })` coerces the input value to number (the input is `type="number"` but RHF defaults to string). Otherwise Zod's `z.coerce.number()` would handle it, but valueAsNumber gives cleaner form state during typing.
- Description textarea: bound via `register("description")`. The Zod schema's `.or(z.literal("").transform(() => undefined))` normalizes empty strings to undefined.
- `noValidate` on the form prevents browser's default HTML5 tooltips from racing with RHF's error rendering.
- Submit button uses `isPending` from `useTransition` for the spinner.
- Cancel link goes back to `/app/event-types` — no "are you sure?" prompt for unsaved changes (CONTEXT doesn't require it).
- After successful action: redirect happens server-side; the form never sees the success state. On the redirect target (`/app/event-types`), Plan 04's list page mounts — there's no toast on the list page yet for "created/updated" messages because the action redirected. **Acceptable v1 polish gap**: success feedback comes from seeing the new row in the list. v2 polish: pass a `?created` or `?updated` searchParam from the action and have Plan 04 toast on mount.

DO NOT:
- Do not use `useActionState` — the action signatures are direct-call (structured input), incompatible with `useActionState`'s `(prev, formData) => state` shape. The `useTransition` + try/catch pattern is the right replacement.
- Do not show a success toast in the form — the redirect happens before any client code can fire one.
- Do not pre-validate slug uniqueness as the user types (no debounced async lookup) — RESEARCH explicitly skips this. Pre-flight check in the action + race-condition catch are sufficient.
- Do not block submit when `slug === originalSlug` in edit mode — the user might be only changing other fields. The slug-change warning is informational only.
- Do not show the URL preview when slug is empty — the UrlPreview component handles the empty-state placeholder internally.
- Do not edit the existing `app/(auth)/app/login/login-form.tsx` (different shape, different action contract — unrelated).
  </action>
  <verify>
```bash
ls "app/(shell)/app/event-types/_components/event-type-form.tsx"

# Form structure
grep -q '"use client"' "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "client component ok"
grep -q "zodResolver(eventTypeSchema)" "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "zod resolver ok"
grep -q "createEventTypeAction" "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "create action wired"
grep -q "updateEventTypeAction" "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "update action wired"
grep -q "QuestionList" "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "questions sub-form rendered"
grep -q "UrlPreview" "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "URL preview rendered"

# Slugify wiring
grep -q "slugify(value)" "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "slugify wired"
grep -q "slugManuallyEdited" "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "manual edit tracking ok"

# Controller for Switch
grep -q 'name="is_active"' "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "is_active field ok"
grep -q 'Controller' "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "Controller used"

# NEXT_REDIRECT re-throw
grep -q "NEXT_REDIRECT" "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "redirect rethrow ok"

# Slug-change warning gated to edit mode + diff
grep -q "showSlugChangeWarning" "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "slug warning gate ok"
grep -q 'mode === "edit"' "app/(shell)/app/event-types/_components/event-type-form.tsx" && echo "edit mode branch ok"

# Build + lint pass (entire plan now compiles)
npm run build
npm run lint

# Existing tests still green
npm test
```
  </verify>
  <done>
EventTypeForm exists, branches on `mode` ("create" vs "edit"), uses `zodResolver(eventTypeSchema)` + `Controller` for Switch + `register()` for text/number/textarea inputs. Live name→slug auto-fill via `slugify()` runs UNTIL `slugManuallyEdited` flips true (creates: detected by typed-slug ≠ slugified-name; edits: starts true so saved slug is preserved). Slug-change warning renders only in edit mode when the current slug differs from the original. URL preview renders below the slug field. The Active toggle, description textarea, duration number input, and embedded `<QuestionList />` all wire to RHF correctly. Submit calls `createEventTypeAction` or `updateEventTypeAction` directly, surfaces `fieldErrors` via `setError` (inline) and `formError` via top-of-form Alert + Sonner toast, and re-throws `NEXT_REDIRECT` so the action's `redirect("/app/event-types")` succeeds.

`npm run build` + `npm run lint` exit 0. Existing Vitest suite still green.

Commit: `feat(03-05): event type form with slug auto-fill, url preview, edit warning, and atomic submit`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# All 5 files in this plan exist
ls "app/(shell)/app/event-types/new/page.tsx"
ls "app/(shell)/app/event-types/[id]/edit/page.tsx"
ls "app/(shell)/app/event-types/_components/"{event-type-form,question-list,url-preview}.tsx

# Build + lint
npm run build
npm run lint

# Existing tests still green
npm test

# Manual smoke (after deploy):
# 1. Visit /app/event-types — empty state shows
# 2. Click "Create event type" → /app/event-types/new
# 3. Type "30 Minute Consult" in Name — slug auto-fills "30-minute-consult", URL preview updates
# 4. Click "Add question" → row appears with type=short-text default
# 5. Change type to single-select → Options sub-list appears, Add Option works
# 6. Submit → redirects to /app/event-types, new row appears in table
# 7. Click kebab → Edit → form pre-populates with saved values; slug warning does NOT show
# 8. Edit slug → yellow warning appears
# 9. Save → redirects to list, row reflects updated slug
# 10. Kebab → Make inactive → row visually greyed; status badge → Inactive
# 11. Kebab → Archive → dialog opens, simple confirm (zero bookings); confirm → row disappears
# 12. Toggle "Show archived" → archived row reappears with strikethrough; kebab shows Restore only
# 13. Restore → restored as Inactive (verify badge)
# 14. Archive an event type that has a booking (use Supabase MCP to insert one) → dialog requires typing the name
```
</verification>

<success_criteria>
- [ ] `app/(shell)/app/event-types/new/page.tsx` is a Server Component shell that renders `<EventTypeForm mode="create" />`
- [ ] `app/(shell)/app/event-types/[id]/edit/page.tsx` awaits params, fetches the row filtered by `.is("deleted_at", null)`, calls `notFound()` if missing/archived, renders `<EventTypeForm mode="edit" eventTypeId=... defaultValues=... />`
- [ ] `app/(shell)/app/event-types/_components/url-preview.tsx` renders `yoursite.com/nsi/[slug]` with placeholder when slug empty
- [ ] `event-type-form.tsx` uses RHF + `zodResolver(eventTypeSchema)`, `Controller` for the `is_active` Switch, `register()` for text/number/textarea inputs
- [ ] Live name→slug auto-fill via `slugify()` runs in create mode until user manually edits slug; edit mode starts with auto-fill OFF (saved slug preserved)
- [ ] Every keystroke on slug field passes through `slugify()` so the value can never be slug-invalid at submit
- [ ] URL preview updates reactively from `watch("slug")`
- [ ] Slug-change warning (yellow Alert) renders ONLY in edit mode AND when current slug !== original slug
- [ ] Form submit calls `createEventTypeAction(values)` or `updateEventTypeAction(id, values)` DIRECTLY (not via `<form action>`)
- [ ] NEXT_REDIRECT thrown by the action is re-thrown by the catch block so navigation succeeds
- [ ] Server `fieldErrors` apply to RHF via `setError(field, {type: "server", message})`; `formError` shows in top Alert + Sonner toast
- [ ] `question-list.tsx` uses top-level `useFieldArray` over `custom_questions` and per-row `useFieldArray` over `custom_questions.${i}.options` (only for single-select)
- [ ] Reorder via `move(from, to)`; up arrow disabled at index 0; down arrow disabled at last index
- [ ] Add Question generates `crypto.randomUUID()` IDs, defaults to `{type: "short-text", required: false}`
- [ ] Single-select rows show inline option list with Add Option capped at 20
- [ ] Type and Required use `Controller` (Switch + Select don't forward refs)
- [ ] All inputs have proper labels with `htmlFor`/`id` matching
- [ ] Cancel button links to `/app/event-types`; no unsaved-changes prompt
- [ ] Submit button shows "Creating…"/"Saving…" + spinner while pending
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Existing Vitest suite still green
- [ ] Each task committed atomically (3 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/03-event-types-crud/03-05-SUMMARY.md` documenting:
- The 5 files shipped + their roles (form, questions sub-form, URL preview, new shell, edit shell)
- Confirmed direct-call action contract (form passes structured `EventTypeInput`, not FormData) — necessary for nested `custom_questions`
- Slug auto-fill rules: create mode auto-fills until manual edit; edit mode starts disabled (preserves saved slug)
- Slug-change warning: only shows in edit mode when current ≠ original
- NEXT_REDIRECT re-throw pattern documented (replaces Phase 2's `useActionState`-driven redirect path)
- v1 polish gap acknowledged: no toast on the list page after create/update success (the action redirects before any client toast can fire); v2 polish would add a `?created`/`?updated` searchParam pattern for the list page to consume
- Acknowledged TS escape hatches in `question-list.tsx`: `as never` casts on the inner `useFieldArray` name and `register` for option strings (RHF can't narrow through dynamic discriminated-union paths; runtime behavior correct)
- Any deviation from RESEARCH §"RHF + useActionState Bridge" — this plan replaces that bridge with `useTransition` + direct call (intentional, planned in Plan 03 contract)
</output>
</content>
</invoke>