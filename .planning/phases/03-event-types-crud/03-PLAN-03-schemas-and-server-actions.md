---
phase: 03-event-types-crud
plan: 03
type: execute
wave: 2
depends_on: ["03-01", "03-02"]
files_modified:
  - lib/slugify.ts
  - app/(shell)/app/event-types/_lib/schema.ts
  - app/(shell)/app/event-types/_lib/types.ts
  - app/(shell)/app/event-types/_lib/actions.ts
autonomous: true

must_haves:
  truths:
    - "lib/slugify.ts exports a pure isomorphic slugify(str) function that lowercases, strips diacritics, replaces non-alphanumeric with hyphens, collapses repeated hyphens, and trims leading/trailing hyphens"
    - "Zod eventTypeSchema validates name, slug (regex /^[a-z0-9-]+$/), duration_minutes (1-480 coerced int), description (optional, max 500), is_active (coerced bool default true), and custom_questions (discriminated-union array of short-text/long-text/yes-no/single-select)"
    - "createEventTypeAction Server Action validates input, resolves account_id via current_owner_account_ids RPC, performs a slug uniqueness pre-flight SELECT (filtered to deleted_at IS NULL), inserts the row, handles 23505 race-condition unique violation by returning slug field error, calls revalidatePath('/app/event-types'), and redirect()s OUTSIDE try/catch (EVENT-01, EVENT-06)"
    - "updateEventTypeAction handles the same shape but with .update().eq('id', id), and excludes the row being edited from the slug uniqueness pre-flight check (an event type can keep its own slug across edits) (EVENT-02, EVENT-06)"
    - "softDeleteEventTypeAction sets deleted_at = now() on the row, revalidates the list, returns {} on success or {formError} on failure (EVENT-03)"
    - "restoreEventTypeAction(id, newSlug?) checks for slug collision among non-deleted rows for the same account; returns {slugCollision: true, currentSlug} if collision detected and no newSlug supplied; otherwise sets deleted_at = null + is_active = false + slug = (newSlug ?? original slug); revalidates"
    - "toggleActiveAction(id, nextActive) flips is_active for the row, revalidates the list (EVENT-04)"
    - "All actions use createClient() from @/lib/supabase/server (RLS-scoped — no admin client)"
    - "All actions gate auth-style errors on error.status, but the slug uniqueness race-defense IS a code check (error.code === '23505') because that's a Postgres constraint violation, not an auth bug"
  artifacts:
    - path: "lib/slugify.ts"
      provides: "Pure isomorphic slugify(str: string): string"
      exports: ["slugify"]
      min_lines: 8
    - path: "app/(shell)/app/event-types/_lib/types.ts"
      provides: "Shared TypeScript types: CustomQuestion union, EventTypeRow (DB shape), EventTypeListItem (list-page projection)"
      exports: ["CustomQuestion", "EventTypeRow", "EventTypeListItem"]
    - path: "app/(shell)/app/event-types/_lib/schema.ts"
      provides: "Zod schemas: customQuestionSchema (discriminated union), eventTypeSchema, EventTypeInput type"
      exports: ["customQuestionSchema", "eventTypeSchema", "EventTypeInput"]
      min_lines: 50
    - path: "app/(shell)/app/event-types/_lib/actions.ts"
      provides: "All Server Actions: createEventTypeAction, updateEventTypeAction, softDeleteEventTypeAction, restoreEventTypeAction, toggleActiveAction; EventTypeState + RestoreResult types"
      contains: "use server"
      exports: ["createEventTypeAction", "updateEventTypeAction", "softDeleteEventTypeAction", "restoreEventTypeAction", "toggleActiveAction", "EventTypeState", "RestoreResult"]
      min_lines: 150
  key_links:
    - from: "app/(shell)/app/event-types/_lib/actions.ts"
      to: "lib/supabase/server.ts"
      via: "await createClient()"
      pattern: "createClient\\(\\)"
    - from: "app/(shell)/app/event-types/_lib/actions.ts"
      to: "Supabase RPC current_owner_account_ids"
      via: "supabase.rpc('current_owner_account_ids') — flat UUID array per Plan 02-04 evidence"
      pattern: "current_owner_account_ids"
    - from: "app/(shell)/app/event-types/_lib/actions.ts"
      to: "event_types.deleted_at column"
      via: ".is('deleted_at', null) reads + .update({deleted_at: ...}) writes"
      pattern: "deleted_at"
    - from: "app/(shell)/app/event-types/_lib/actions.ts"
      to: "app/(shell)/app/event-types/_lib/schema.ts"
      via: "eventTypeSchema.safeParse() in create + update"
      pattern: "eventTypeSchema"
---

<objective>
Ship the data-layer foundation for Phase 3: the `slugify()` utility, the Zod schemas (event type + custom questions discriminated union), shared TypeScript types, and ALL five Server Actions (create, update, soft-delete, restore-with-slug-collision, toggle-active). Plans 04 (list page) and 05 (form pages) both consume this module — they cannot run without it.

Purpose: Centralize all mutation logic in one tested, RLS-scoped module. The actions are the SINGLE source of truth for slug uniqueness, soft-delete semantics, and the restore-with-collision flow. Splitting actions across plans/files would risk subtle divergence (different validation rules, different error handling). One file, one shape.

Output: A `lib/slugify.ts` utility, three module files under `app/(shell)/app/event-types/_lib/` (types, schema, actions), all type-checked and build-clean. No UI surface yet — that's Plans 04 + 05.

Plan-level scoping note: This plan also OWNS the decision (deferred from CONTEXT.md "Claude's Discretion") to call Server Actions DIRECTLY from the form (RHF `handleSubmit` → action call) rather than via `<form action={formAction}>`. Reason: `custom_questions` is structured array data that doesn't serialize naturally through FormData (RESEARCH Pitfall 6 + Open Question 2). Researcher recommended direct call; this loses progressive enhancement which is acceptable for an owner-only dashboard. The action signatures below reflect this: create/update accept a STRUCTURED `EventTypeInput` argument, not a `FormData`. Plan 05 (form) honors this contract.
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

# Existing modules this plan inherits from
@lib/supabase/server.ts
@app/(auth)/app/login/actions.ts
@app/(auth)/app/login/schema.ts

# Migration that provides deleted_at
@supabase/migrations/20260424120000_event_types_soft_delete.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ship the slugify utility</name>
  <files>lib/slugify.ts</files>
  <action>
Create `lib/slugify.ts` with the canonical 7-line implementation from RESEARCH §"slugify Utility". This is the ONLY slugify implementation in the project — both the form (Plan 05, live name→slug auto-fill) and Zod's regex validation (Plan 03 Task 2) reference the SAME function/rules.

```typescript
// lib/slugify.ts
/**
 * Converts a string to a URL-friendly slug.
 *
 * Pure, isomorphic (no DOM APIs, no Node-only APIs) — safe to call from
 * both Server Components and Client Components.
 *
 * Rules:
 *   - NFKD-normalize, then strip diacritics
 *   - lowercase
 *   - replace any non [a-z0-9 -] with empty
 *   - collapse whitespace runs to single hyphen
 *   - collapse repeated hyphens
 *   - trim leading/trailing hyphens
 *
 * Matches the regex used in eventTypeSchema.slug: /^[a-z0-9-]+$/
 */
export function slugify(str: string): string {
  return String(str)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

Key rules:
- Pure function. No side effects. No imports beyond what's shown (none needed).
- The OUTPUT must always validate against `/^[a-z0-9-]+$/` (the Zod regex in Task 2). Sanity-check examples: `slugify("30-Min Consult")` → `"30-min-consult"`, `slugify("Café Meeting")` → `"cafe-meeting"`, `slugify("--foo--")` → `"foo"`, `slugify("hello   world")` → `"hello-world"`.
- Edge case: empty string input returns empty string (Zod's `.min(1)` will reject it downstream — that's the right place to error, not here).
- Do NOT use `String.prototype.normalize("NFD")` — `NFKD` is correct (handles compatibility decomposition like full-width chars too).
- Do NOT add an `npm install slugify` dependency.

DO NOT:
- Do not export anything else from this file (keep the surface tiny).
- Do not add a config-object overload (`slugify(str, {separator: "_"})`) — overengineering for one caller.
  </action>
  <verify>
```bash
ls lib/slugify.ts
grep -q "export function slugify" lib/slugify.ts && echo "export ok"
grep -q '/^[-+]+|-+$/g' lib/slugify.ts || grep -q '\^-+|-\+\$' lib/slugify.ts && echo "trim regex ok"

# Round-trip sanity test (Node 22 supports modern syntax inline)
node --input-type=module -e "
import('./lib/slugify.ts').catch(()=>import('./lib/slugify.js')).then(async m=>{
  // tsx-style fallback for plain test:
  const cases = [
    ['30-Min Consult','30-min-consult'],
    ['Café Meeting','cafe-meeting'],
    ['--foo--','foo'],
    ['hello   world','hello-world'],
    ['',''],
    ['ALL CAPS!!!','all-caps'],
  ];
  for (const [input, expected] of cases) {
    const got = m.slugify(input);
    if (got !== expected) throw new Error(\`slugify(\${JSON.stringify(input)}) returned \${JSON.stringify(got)}, expected \${JSON.stringify(expected)}\`);
  }
  console.log('slugify round-trip ok');
}).catch(e=>{console.error(e);process.exit(1);});
" 2>&1 || echo "Note: TypeScript runtime test optional; rely on npm run build for type check"

npm run build
```
  </verify>
  <done>
`lib/slugify.ts` exists and exports `slugify(str: string): string` matching the canonical RESEARCH implementation. `npm run build` exits 0.

Commit: `feat(03-03): add slugify utility`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Ship shared types + Zod schemas</name>
  <files>app/(shell)/app/event-types/_lib/types.ts, app/(shell)/app/event-types/_lib/schema.ts</files>
  <action>
Create the shared types module and the Zod schema module. Both live under `app/(shell)/app/event-types/_lib/` — the `_lib` underscore prefix tells Next.js this is a private module folder, NOT a route (it doesn't generate `/app/event-types/_lib`). RESEARCH §"File Structure" used `_components` for the same purpose; we use `_lib` for non-component shared code (types, schema, actions) to keep the boundary clean.

**File 1 — `app/(shell)/app/event-types/_lib/types.ts`:**

```typescript
/**
 * Shared types for the event-types feature.
 *
 * - CustomQuestion: discriminated union, mirrors the customQuestionSchema in schema.ts
 * - EventTypeRow: full DB row shape (all columns) — for the form (edit) page
 * - EventTypeListItem: projected shape for the list page (subset of columns we SELECT)
 */

export type CustomQuestion =
  | {
      id: string;
      label: string;
      required: boolean;
      type: "short-text";
    }
  | {
      id: string;
      label: string;
      required: boolean;
      type: "long-text";
    }
  | {
      id: string;
      label: string;
      required: boolean;
      type: "yes-no";
    }
  | {
      id: string;
      label: string;
      required: boolean;
      type: "single-select";
      options: string[];
    };

export type EventTypeRow = {
  id: string;
  account_id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_advance_days: number;
  custom_questions: CustomQuestion[];
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type EventTypeListItem = Pick<
  EventTypeRow,
  "id" | "name" | "slug" | "duration_minutes" | "is_active" | "deleted_at" | "created_at"
>;
```

**File 2 — `app/(shell)/app/event-types/_lib/schema.ts`:**

```typescript
import { z } from "zod";

/**
 * Custom-question discriminated union.
 *
 * Zod v4: z.discriminatedUnion uses O(1) discriminator lookup.
 * Each branch shares: id (uuid), label (1-200 chars), required (default false).
 * Single-select adds an options array (1-20 strings, each 1-100 chars).
 */
const baseQuestion = z.object({
  id: z.string().uuid({ message: "Internal error: missing question id." }),
  label: z
    .string()
    .min(1, "Question label is required.")
    .max(200, "Question label must be 200 characters or fewer."),
  required: z.coerce.boolean().default(false),
});

const shortTextQuestion = baseQuestion.extend({ type: z.literal("short-text") });
const longTextQuestion = baseQuestion.extend({ type: z.literal("long-text") });
const yesNoQuestion = baseQuestion.extend({ type: z.literal("yes-no") });

const singleSelectQuestion = baseQuestion.extend({
  type: z.literal("single-select"),
  options: z
    .array(z.string().min(1, "Option label cannot be empty.").max(100))
    .min(1, "Add at least one option.")
    .max(20, "A single-select question can have at most 20 options."),
});

export const customQuestionSchema = z.discriminatedUnion("type", [
  shortTextQuestion,
  longTextQuestion,
  yesNoQuestion,
  singleSelectQuestion,
]);

/**
 * Event-type schema for create + edit.
 *
 * - name: 1-100 chars
 * - slug: 1-100 chars, must match /^[a-z0-9-]+$/ (matches slugify output)
 * - duration_minutes: 1-480 (8 hours max — matches CONTEXT v1 scope)
 * - description: optional, up to 500 chars
 * - is_active: defaults to true on create
 * - custom_questions: array (default empty); each entry validated by customQuestionSchema
 */
export const eventTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or fewer."),
  slug: z
    .string()
    .min(1, "URL slug is required.")
    .max(100, "URL slug must be 100 characters or fewer.")
    .regex(
      /^[a-z0-9-]+$/,
      "URL slug may only contain lowercase letters, numbers, and hyphens.",
    ),
  duration_minutes: z.coerce
    .number()
    .int("Duration must be a whole number.")
    .min(1, "Duration must be at least 1 minute.")
    .max(480, "Duration cannot exceed 480 minutes (8 hours)."),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  is_active: z.coerce.boolean().default(true),
  custom_questions: z.array(customQuestionSchema).default([]),
});

export type EventTypeInput = z.infer<typeof eventTypeSchema>;
```

Key rules:
- The `description` field accepts both `undefined` and `""` (the form will pass empty strings when the textarea is blank); the `.or(z.literal("").transform(() => undefined))` clause normalizes `""` → `undefined` so DB inserts of "no description" use NULL, not empty string. (Important for clean SELECT projection in Plan 04's list display.)
- `is_active` and `required` use `z.coerce.boolean()` so the form can pass either booleans (RHF `Controller`) OR FormData strings (`"true"`/`"false"` if anyone ever submits via raw form). Since this plan picks direct-call (not FormData), the coerce is belt-and-suspenders defense.
- `duration_minutes` uses `z.coerce.number()` — same reason.
- The slug regex `/^[a-z0-9-]+$/` MUST match what `lib/slugify.ts` produces. Sanity: any output from `slugify(name)` that is non-empty WILL satisfy this regex.
- `customQuestionSchema` uses `z.discriminatedUnion("type", ...)` — Zod v4 O(1) lookup. Do NOT use `z.union` (that would be O(n) and lose the type narrowing in `EventTypeInput`).
- All error messages are user-facing — they will surface as RHF field errors in the form. Keep them friendly, end with a period.

DO NOT:
- Do not include `account_id` in the schema — actions resolve that server-side via the RPC. The form should never accept an `account_id` from the user.
- Do not include `id` in `eventTypeSchema` — the update action accepts `id` as a separate argument (typed `string`) for clarity. Putting it in the schema would force every form field to handle it.
- Do not include `created_at` or `deleted_at` in the schema — those are DB-managed.
- Do not export `customQuestionSchema` branches individually (`shortTextQuestion`, etc.) — the union is the only public surface.
  </action>
  <verify>
```bash
ls "app/(shell)/app/event-types/_lib/types.ts" "app/(shell)/app/event-types/_lib/schema.ts"

# types.ts shape
grep -q "export type CustomQuestion" "app/(shell)/app/event-types/_lib/types.ts" && echo "CustomQuestion exported"
grep -q "export type EventTypeRow" "app/(shell)/app/event-types/_lib/types.ts" && echo "EventTypeRow exported"
grep -q "export type EventTypeListItem" "app/(shell)/app/event-types/_lib/types.ts" && echo "EventTypeListItem exported"

# schema.ts shape
grep -q 'discriminatedUnion("type"' "app/(shell)/app/event-types/_lib/schema.ts" && echo "discriminated union ok"
grep -q 'export const eventTypeSchema' "app/(shell)/app/event-types/_lib/schema.ts" && echo "eventTypeSchema exported"
grep -q 'export type EventTypeInput' "app/(shell)/app/event-types/_lib/schema.ts" && echo "EventTypeInput exported"
grep -q '/\^\[a-z0-9-\]+\$/' "app/(shell)/app/event-types/_lib/schema.ts" && echo "slug regex matches slugify output"

npm run build
```
  </verify>
  <done>
Both files exist. `types.ts` exports `CustomQuestion` (union), `EventTypeRow`, and `EventTypeListItem`. `schema.ts` exports `customQuestionSchema` (Zod v4 discriminated union over 4 question types), `eventTypeSchema` (with the load-bearing `/^[a-z0-9-]+$/` slug regex), and `EventTypeInput` (inferred type). `npm run build` exits 0.

Commit: `feat(03-03): add event types shared types and Zod schemas`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Ship all five Server Actions (create, update, soft-delete, restore, toggle-active)</name>
  <files>app/(shell)/app/event-types/_lib/actions.ts</files>
  <action>
Create `app/(shell)/app/event-types/_lib/actions.ts` containing all five Server Actions. This is the SINGLE Server Actions module for Phase 3 — the form (Plan 05) and list (Plan 04) both import from here.

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eventTypeSchema, type EventTypeInput } from "./schema";

/**
 * Action result shape for create + update.
 *
 * Mirrors Phase 2's LoginState contract: optional fieldErrors for per-field
 * RHF feedback, optional formError for the form-level alert banner.
 *
 * `redirectTo` is set on success so the caller can route to it AFTER unwrapping
 * the result — keeps redirect() out of try/catch (Phase 2 RESEARCH §7.1 + Phase 3
 * RESEARCH Pitfall 3). Caller pattern:
 *
 *   const result = await createEventTypeAction(input);
 *   if (result.redirectTo) router.push(result.redirectTo);
 *   else { showErrors(result); }
 *
 * Note: For the create + update actions specifically we ALSO call
 * redirect("/app/event-types") inside the action when there are no errors,
 * because the action runs server-side via direct call from the form's
 * onSubmit. redirect() inside a Server Action triggers a server-side
 * navigation. We keep redirectTo in the type for future-flexibility but
 * the canonical path is the in-action redirect.
 */
export type EventTypeState = {
  fieldErrors?: Partial<Record<keyof EventTypeInput, string[]>>;
  formError?: string;
  redirectTo?: string;
};

export type RestoreResult =
  | { ok: true }
  | { slugCollision: true; currentSlug: string }
  | { error: string };

/**
 * Resolve the current owner's account_id.
 *
 * `current_owner_account_ids()` is a SETOF uuid RPC; supabase-js returns it as a
 * flat string array (verified Plan 02-04, see STATE.md "RPC shape" decision).
 * We pick the first id — single-tenant v1 only ever has one.
 */
async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_owner_account_ids");
  if (error) return null;
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as string;
}

/**
 * EVENT-01: Create a new event type.
 *
 * - Zod validation
 * - Resolve account_id
 * - Pre-flight slug uniqueness check (filtered to deleted_at IS NULL)
 * - Insert
 * - Race-condition defense: catch 23505 and return slug field error
 * - revalidatePath + redirect
 */
export async function createEventTypeAction(
  input: EventTypeInput,
): Promise<EventTypeState> {
  // 1. Server-side Zod re-validation (defense in depth — the form already
  //    validated, but never trust the client).
  const parsed = eventTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // 2. Resolve account_id (RLS ensures the user can only insert into their own
  //    account, but we need the explicit value for the INSERT column).
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  // 3. Pre-flight slug uniqueness check among non-deleted rows.
  const { data: existing } = await supabase
    .from("event_types")
    .select("id")
    .eq("account_id", accountId)
    .eq("slug", parsed.data.slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return {
      fieldErrors: {
        slug: ["This slug is already in use. Choose a different one."],
      },
    };
  }

  // 4. Insert.
  const { error } = await supabase.from("event_types").insert({
    account_id: accountId,
    name: parsed.data.name,
    slug: parsed.data.slug,
    duration_minutes: parsed.data.duration_minutes,
    description: parsed.data.description ?? null,
    is_active: parsed.data.is_active,
    custom_questions: parsed.data.custom_questions,
  });

  if (error) {
    // Postgres unique_violation — race condition between pre-flight check + insert.
    // RESEARCH §"Slug Uniqueness Validation": THIS is the one place where gating
    // on error.code (not error.status) is correct, because it's a DB constraint
    // violation, not an auth-js bug.
    if (error.code === "23505") {
      return {
        fieldErrors: {
          slug: ["This slug is already in use. Choose a different one."],
        },
      };
    }
    return { formError: "Failed to create event type. Please try again." };
  }

  // 5. Revalidate then redirect — outside try/catch (RESEARCH Pitfall 3).
  revalidatePath("/app/event-types");
  redirect("/app/event-types");
}

/**
 * EVENT-02: Update an existing event type.
 *
 * Same shape as create, but with .update().eq("id", id) and an EXCLUDED-self
 * pre-flight slug check (a row can keep its own slug across edits).
 */
export async function updateEventTypeAction(
  id: string,
  input: EventTypeInput,
): Promise<EventTypeState> {
  const parsed = eventTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!id || typeof id !== "string") {
    return { formError: "Missing event type id." };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  // Pre-flight slug uniqueness — same as create, but EXCLUDE the row being edited.
  const { data: collision } = await supabase
    .from("event_types")
    .select("id")
    .eq("account_id", accountId)
    .eq("slug", parsed.data.slug)
    .is("deleted_at", null)
    .neq("id", id)
    .maybeSingle();

  if (collision) {
    return {
      fieldErrors: {
        slug: ["This slug is already in use. Choose a different one."],
      },
    };
  }

  const { error } = await supabase
    .from("event_types")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      duration_minutes: parsed.data.duration_minutes,
      description: parsed.data.description ?? null,
      is_active: parsed.data.is_active,
      custom_questions: parsed.data.custom_questions,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        fieldErrors: {
          slug: ["This slug is already in use. Choose a different one."],
        },
      };
    }
    return { formError: "Failed to update event type. Please try again." };
  }

  revalidatePath("/app/event-types");
  redirect("/app/event-types");
}

/**
 * EVENT-03: Soft-delete an event type (sets deleted_at).
 *
 * Returns {} on success, {formError} on failure. Does NOT redirect — the caller
 * (a client component dialog) handles the toast + dismiss.
 */
export async function softDeleteEventTypeAction(
  id: string,
): Promise<EventTypeState> {
  if (!id || typeof id !== "string") {
    return { formError: "Missing event type id." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_types")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { formError: "Failed to archive event type." };
  }

  revalidatePath("/app/event-types");
  return {};
}

/**
 * Restore a soft-deleted event type with optional new slug for collision case.
 *
 * Behavior (RESEARCH §"Restore with Slug Collision"):
 *   1. Look up the archived row's original slug + account_id.
 *   2. Determine effective slug to use: newSlug if supplied, else original.
 *   3. Check for collision against active (deleted_at IS NULL) rows in the same
 *      account. If collision AND no newSlug was supplied, return
 *      {slugCollision: true, currentSlug} so the client opens a Dialog with a
 *      slug input. If collision AND newSlug WAS supplied, that means the user's
 *      proposed slug ALSO collides — return {error}. If no collision, proceed.
 *   4. Restore: deleted_at = null, is_active = false, slug = effective slug.
 *      Restored types come back as Inactive per CONTEXT decision.
 *
 * Returns RestoreResult discriminated union.
 */
export async function restoreEventTypeAction(
  id: string,
  newSlug?: string,
): Promise<RestoreResult> {
  if (!id || typeof id !== "string") {
    return { error: "Missing event type id." };
  }

  const supabase = await createClient();

  const { data: et, error: lookupError } = await supabase
    .from("event_types")
    .select("slug, account_id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !et) {
    return { error: "Event type not found." };
  }

  const slugToUse = newSlug ?? et.slug;

  // If newSlug supplied, validate it through eventTypeSchema's slug rule by
  // running the regex inline (cheaper than spinning up a partial schema).
  if (!/^[a-z0-9-]+$/.test(slugToUse) || slugToUse.length === 0 || slugToUse.length > 100) {
    return {
      error:
        "URL slug may only contain lowercase letters, numbers, and hyphens (1-100 chars).",
    };
  }

  const { data: collision } = await supabase
    .from("event_types")
    .select("id")
    .eq("account_id", et.account_id)
    .eq("slug", slugToUse)
    .is("deleted_at", null)
    .neq("id", id)
    .maybeSingle();

  if (collision) {
    if (newSlug) {
      // User supplied a slug but it ALSO collides.
      return { error: "That slug is also in use. Try another." };
    }
    // Original slug is taken — prompt the user.
    return { slugCollision: true, currentSlug: et.slug };
  }

  const { error } = await supabase
    .from("event_types")
    .update({
      deleted_at: null,
      is_active: false,
      slug: slugToUse,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      // Race: someone else took the slug between our check and update.
      return { error: "That slug was just taken. Try another." };
    }
    return { error: "Failed to restore event type." };
  }

  revalidatePath("/app/event-types");
  return { ok: true };
}

/**
 * EVENT-04: Toggle active/inactive for an event type.
 *
 * Called from the kebab menu (no confirm — reversible) and from the edit form's
 * Switch (already covered by updateEventTypeAction). This is the kebab-menu
 * fast path — no schema parse, no slug check, just flip the bit.
 */
export async function toggleActiveAction(
  id: string,
  nextActive: boolean,
): Promise<EventTypeState> {
  if (!id || typeof id !== "string") {
    return { formError: "Missing event type id." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_types")
    .update({ is_active: nextActive })
    .eq("id", id);

  if (error) {
    return { formError: "Failed to update status." };
  }

  revalidatePath("/app/event-types");
  return {};
}
```

Key rules:
- Single `"use server"` directive at the top of the file applies to every exported function (Next.js convention).
- All actions use `createClient()` from `@/lib/supabase/server` — RLS-scoped. NO admin client. The owner's RLS policies (Phase 1) restrict writes to rows they own; passing `accountId` to the INSERT is for the explicit column, not for security.
- `redirect("/app/event-types")` is called as the LAST line of `createEventTypeAction` and `updateEventTypeAction`. It MUST NOT be wrapped in try/catch (RESEARCH Pitfall 3 + Phase 2 lesson). The functions return `EventTypeState` for the error path; the success path throws `NEXT_REDIRECT` and never returns.
- TypeScript will warn that `redirect()` makes the function "return Promise<never>" but the declared return type is `Promise<EventTypeState>`. That's fine — the early `return { ... }` paths handle the EventTypeState case; the redirect throws. Same shape as Phase 2's `loginAction`.
- `softDeleteEventTypeAction` and `toggleActiveAction` do NOT redirect — they're called from a client dialog/menu that handles its own UI dismissal. They DO `revalidatePath` so the list re-fetches.
- `restoreEventTypeAction` does NOT redirect for the same reason — the client component handles the toast.
- The 23505 unique-violation gate on `error.code` is a documented exception to Phase 2's "gate on error.status" rule. RESEARCH §"Slug Uniqueness Validation" calls this out explicitly: it's a Postgres constraint violation, not an auth-js bug.
- Use `.is("deleted_at", null)` for IS NULL checks — NOT `.eq("deleted_at", null)` which generates `= null` (always false) per RESEARCH Pitfall (#9 in research-summary).
- `restoreEventTypeAction`'s inline slug regex DUPLICATES `eventTypeSchema.slug.regex` — the duplication is acceptable to keep the action self-contained and avoid spinning up a sub-schema for one field. If the regex ever changes, BOTH places must change. The Zod schema is the source of truth; the inline check is defense.

DO NOT:
- Do not call `supabase.from("bookings")` here — booking-count fetching for the delete dialog lives in Plan 04 (client-side, RESEARCH Open Question 1).
- Do not add a `hardDeleteEventTypeAction` — CONTEXT.md explicitly defers hard-delete to v1+1.
- Do not pass `FormData` to any action — direct-call only (this plan's contract decision; see Objective).
- Do not import from `@/lib/supabase/admin` — Phase 3 has zero need for service-role; all writes are RLS-scoped.
- Do not add `redirectTo` query-param handling.
  </action>
  <verify>
```bash
ls "app/(shell)/app/event-types/_lib/actions.ts"

# All 5 actions exported
grep -q "export async function createEventTypeAction" "app/(shell)/app/event-types/_lib/actions.ts" && echo "create exported"
grep -q "export async function updateEventTypeAction" "app/(shell)/app/event-types/_lib/actions.ts" && echo "update exported"
grep -q "export async function softDeleteEventTypeAction" "app/(shell)/app/event-types/_lib/actions.ts" && echo "softDelete exported"
grep -q "export async function restoreEventTypeAction" "app/(shell)/app/event-types/_lib/actions.ts" && echo "restore exported"
grep -q "export async function toggleActiveAction" "app/(shell)/app/event-types/_lib/actions.ts" && echo "toggleActive exported"

# State + RestoreResult types exported
grep -q "export type EventTypeState" "app/(shell)/app/event-types/_lib/actions.ts" && echo "EventTypeState exported"
grep -q "export type RestoreResult" "app/(shell)/app/event-types/_lib/actions.ts" && echo "RestoreResult exported"

# Server-only marker
head -1 "app/(shell)/app/event-types/_lib/actions.ts" | grep -q '"use server"' && echo "use server ok"

# Load-bearing patterns
grep -q "current_owner_account_ids" "app/(shell)/app/event-types/_lib/actions.ts" && echo "RPC ok"
grep -q '\.is("deleted_at", null)' "app/(shell)/app/event-types/_lib/actions.ts" && echo "soft-delete filter ok"
grep -q 'error.code === "23505"' "app/(shell)/app/event-types/_lib/actions.ts" && echo "race defense ok"
grep -q 'redirect("/app/event-types")' "app/(shell)/app/event-types/_lib/actions.ts" && echo "redirect ok"
grep -q 'revalidatePath("/app/event-types")' "app/(shell)/app/event-types/_lib/actions.ts" && echo "revalidate ok"

# No admin client leak
! grep -q "@/lib/supabase/admin" "app/(shell)/app/event-types/_lib/actions.ts" && echo "no admin client ok"

npm run build
npm run lint
```
  </verify>
  <done>
`app/(shell)/app/event-types/_lib/actions.ts` exists with `"use server"` at the top, exports all 5 actions (create, update, softDelete, restore, toggleActive) plus `EventTypeState` and `RestoreResult` types. All actions use `createClient()` from `@/lib/supabase/server`, gate slug-collision races on `error.code === "23505"`, use `.is("deleted_at", null)` for soft-delete filtering, call `revalidatePath("/app/event-types")` after writes, and the create/update actions call `redirect("/app/event-types")` outside any try/catch. `npm run build` + `npm run lint` exit 0.

Commit: `feat(03-03): add event types Server Actions (create, update, soft-delete, restore, toggle-active)`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# All 4 files present
ls lib/slugify.ts "app/(shell)/app/event-types/_lib/"{types,schema,actions}.ts

# Build + lint
npm run build
npm run lint

# Existing tests still green (no regression on auth, RLS, race tests)
npm test
```

No live action smoke test in this plan — the actions have no UI consumer yet (Plans 04 + 05 build that). Type-check via `npm run build` is the verification that the action signatures + Zod schemas + slugify all compose correctly.
</verification>

<success_criteria>
- [ ] `lib/slugify.ts` exports a pure isomorphic `slugify(str)` function
- [ ] `app/(shell)/app/event-types/_lib/types.ts` exports `CustomQuestion` (discriminated union), `EventTypeRow`, `EventTypeListItem`
- [ ] `app/(shell)/app/event-types/_lib/schema.ts` exports `customQuestionSchema` (Zod v4 discriminated union over 4 question types), `eventTypeSchema` (with `/^[a-z0-9-]+$/` slug regex matching slugify output), and `EventTypeInput`
- [ ] `app/(shell)/app/event-types/_lib/actions.ts` is `"use server"`, exports all 5 actions (create, update, softDelete, restore, toggleActive) plus `EventTypeState` and `RestoreResult`
- [ ] Create + update actions perform Zod validation, resolve `account_id` via `current_owner_account_ids` RPC, pre-flight slug uniqueness check filtered to `.is("deleted_at", null)`, gate race-condition unique violations on `error.code === "23505"`, `revalidatePath("/app/event-types")`, and `redirect("/app/event-types")` OUTSIDE try/catch
- [ ] Update action excludes the row being edited from the slug pre-flight check (`.neq("id", id)`)
- [ ] Soft-delete sets `deleted_at = now()`, revalidates, returns `{}` or `{formError}` (no redirect)
- [ ] Restore checks for slug collision among non-deleted rows; returns `{slugCollision, currentSlug}` if collision and no newSlug; otherwise restores with `deleted_at = null, is_active = false, slug = effective`
- [ ] Toggle-active flips `is_active` and revalidates (no Zod parse, fast path)
- [ ] All actions use `createClient()` from `@/lib/supabase/server` — NO admin client import
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Existing Vitest suite still green
- [ ] Each task committed atomically (3 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/03-event-types-crud/03-03-SUMMARY.md` documenting:
- Final shape of `EventTypeState` and `RestoreResult` (for Plan 04 + 05 reference)
- Confirmed direct-call contract decision (Server Actions accept structured `EventTypeInput`, NOT `FormData`) — Plans 04 + 05 honor this
- Slug pre-flight pattern: `.eq("slug", x).is("deleted_at", null).neq("id", id) [for update]` — SINGLE source of truth for the slug uniqueness rule
- Confirmed RPC return shape used (flat UUID array; matches Plan 02-04 evidence)
- Any deviation from RESEARCH §"Server Action Pattern" or §"Restore with Slug Collision" (none expected)
</output>
</content>
</invoke>