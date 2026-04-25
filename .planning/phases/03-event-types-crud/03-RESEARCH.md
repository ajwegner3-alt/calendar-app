# Phase 3: Event Types CRUD - Research

**Researched:** 2026-04-24
**Domain:** Next.js 16 App Router Server Actions + Supabase CRUD + shadcn v4 table/form components
**Overall Confidence:** HIGH on schema, Server Action pattern, and component API; MEDIUM on soft-delete migration approach; LOW on slug-collision UX round-trip (no established framework pattern found)

---

## Summary

Phase 2 confirmed the full stack: Next.js 16.2.4, React 19, Supabase SSR 0.10.2, React Hook Form 7.72.1, Zod 4.3.6, shadcn radix-nova style, Tailwind v4. Andrew's auth user is live and RLS is confirmed working. Phase 3 builds the first real CRUD surface on top of this foundation.

The Phase 1 schema has `event_types` fully defined with `is_active boolean` and `custom_questions jsonb`, but NO `deleted_at` column. Soft-delete requires a new Supabase migration to add `deleted_at timestamptz`. The schema's unique constraint is `unique (account_id, slug)` — a standard composite unique index, correct for slug-per-account enforcement.

Ten shadcn components are needed for this phase; only the core auth components (button, input, label, alert, card, sidebar, skeleton, sheet, separator, tooltip) are installed. Table, DropdownMenu, AlertDialog, Switch, Badge, Select, Textarea, and Sonner must all be added via `npx shadcn@latest add`. The slugify function should be a 7-line inline utility — no npm dependency needed for ASCII-heavy English business names.

**Primary recommendation:** Server Actions for all mutations (create, update, soft-delete, restore, toggle), Server Components for data loading, RHF + Controller for the Switch fields, Sonner for toast feedback, and an inline `slugify()` utility placed in `lib/slugify.ts` for isomorphic use.

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| react-hook-form | ^7.72.1 | Form state + validation | Installed |
| @hookform/resolvers | ^5.2.2 | Zod adapter | Installed |
| zod | ^4.3.6 | Schema validation | Installed |
| @supabase/ssr | ^0.10.2 | Supabase client (server + client) | Installed |
| lucide-react | ^1.8.0 | Icons (MoreHorizontal, Pencil, Trash2, RotateCcw, ChevronUp, ChevronDown) | Installed |

### shadcn Components (already installed)

| Component | File | Installed By |
|-----------|------|-------------|
| button | components/ui/button.tsx | Phase 2, Plan 01 |
| input | components/ui/input.tsx | Phase 2, Plan 01 |
| label | components/ui/label.tsx | Phase 2, Plan 01 |
| alert | components/ui/alert.tsx | Phase 2, Plan 01 |
| card | components/ui/card.tsx | Phase 2, Plan 01 |
| sidebar | components/ui/sidebar.tsx | Phase 2, Plan 01 |
| skeleton | components/ui/skeleton.tsx | Phase 2 |
| sheet | components/ui/sheet.tsx | Phase 2 |
| separator | components/ui/separator.tsx | Phase 2 |
| tooltip | components/ui/tooltip.tsx | Phase 2 |

### shadcn Components to Install (Phase 3)

| Component | Install Command | Purpose |
|-----------|----------------|---------|
| table | `npx shadcn@latest add table` | Event types list view |
| dropdown-menu | `npx shadcn@latest add dropdown-menu` | Row kebab menu |
| alert-dialog | `npx shadcn@latest add alert-dialog` | Delete confirmation modal |
| switch | `npx shadcn@latest add switch` | Active/inactive toggle in form |
| badge | `npx shadcn@latest add badge` | Status column (Active/Inactive/Archived) |
| select | `npx shadcn@latest add select` | Question type selector + single-select options |
| textarea | `npx shadcn@latest add textarea` | Description field |
| sonner | `npx shadcn@latest add sonner` | Toast notifications after save/delete/restore |

**Single install command:**
```bash
npx shadcn@latest add table dropdown-menu alert-dialog switch badge select textarea sonner
```

**Important:** shadcn style is `radix-nova` (confirmed in `components.json`). All adds use this style automatically.

### No New npm Dependencies Needed

The slugify function is an inline 7-line utility. No `slugify`, `slug`, or `url-slug` package required. This avoids adding a dependency for a function trivially implementable in pure JS.

---

## Architecture Patterns

### Schema State (as-built, Phase 1)

The `event_types` table as built:

```sql
create table event_types (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  duration_minutes int not null check (duration_minutes > 0),
  buffer_before_minutes int not null default 0,
  buffer_after_minutes int not null default 0,
  min_notice_minutes int not null default 60,
  max_advance_days int not null default 60,
  custom_questions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (account_id, slug)               -- slug uniqueness per account
);
```

**Missing for Phase 3:** No `deleted_at` column. Soft-delete requires a migration.

### Required Migration (Phase 3 owns this)

```sql
-- Phase 3: add soft-delete column to event_types
alter table event_types
  add column deleted_at timestamptz;

-- Partial index: slug uniqueness only among non-deleted rows
-- The existing unique(account_id, slug) covers all rows including archived ones,
-- which would prevent restoring an archived type if a new one took the slug.
-- Replace with a partial unique index instead.
alter table event_types
  drop constraint event_types_account_id_slug_key;

create unique index event_types_account_id_slug_active
  on event_types(account_id, slug)
  where deleted_at is null;
```

**Critical:** Dropping the old unique constraint and replacing with a partial unique index is load-bearing. Without it, an archived event type occupies its slug forever, blocking restoration and new creation. The partial index enforces uniqueness only among non-deleted rows, which is the correct semantic. The slug-collision-on-restore check remains possible via a simple query before setting `deleted_at = null`.

**Apply via Supabase MCP** (`apply_migration` tool), not via CLI, per Phase 1/2 convention.

### File Structure

```
app/(shell)/app/event-types/
├── page.tsx                          # List page (Server Component)
├── new/
│   └── page.tsx                      # Create form page (Server Component shell)
├── [id]/
│   └── edit/
│       └── page.tsx                  # Edit form page (Server Component shell)
lib/
├── slugify.ts                        # Inline slugify utility (isomorphic)
├── supabase/
│   ├── server.ts                     # (existing)
│   └── client.ts                     # (existing)
app/(shell)/app/event-types/
├── _components/
│   ├── event-type-form.tsx           # "use client" — shared create/edit form
│   ├── event-type-table.tsx          # "use client" — list table with kebab menus
│   ├── delete-confirm-dialog.tsx     # "use client" — AlertDialog with booking-count check
│   ├── question-list.tsx             # "use client" — custom questions CRUD subform
│   └── actions.ts                    # "use server" — all CRUD Server Actions
supabase/migrations/
└── 20260424120000_event_types_soft_delete.sql
```

### Server Action Pattern (inherits from Phase 2)

Phase 2 established the canonical shape. Phase 3 extends it for CRUD mutations. Key rules carried forward:

1. `redirect()` must NOT be inside any `try/catch`
2. Gate errors on `error.status` not `error.code`
3. `revalidatePath('/app/event-types')` after every mutation that changes the list
4. Return `{ fieldErrors?, formError? }` state shape — same as LoginState

**Create action pattern:**
```typescript
// app/(shell)/app/event-types/_components/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eventTypeSchema, type EventTypeInput } from "./schema";

export type EventTypeState = {
  fieldErrors?: Partial<Record<keyof EventTypeInput, string[]>>;
  formError?: string;
};

export async function createEventTypeAction(
  _prev: EventTypeState,
  formData: FormData,
): Promise<EventTypeState> {
  // 1. Zod validation
  const parsed = eventTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 2. Resolve account_id (always scoped to current owner)
  const supabase = await createClient();
  const { data: accountIds } = await supabase.rpc("current_owner_account_ids");
  const accountId = Array.isArray(accountIds) ? accountIds[0] : null;
  if (!accountId) return { formError: "Account not found." };

  // 3. Slug uniqueness check (server-side, pre-insert)
  const { data: existing } = await supabase
    .from("event_types")
    .select("id")
    .eq("account_id", accountId)
    .eq("slug", parsed.data.slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return {
      fieldErrors: { slug: ["This slug is already in use. Choose a different one."] },
    };
  }

  // 4. Insert
  const { error } = await supabase.from("event_types").insert({
    account_id: accountId,
    ...parsed.data,
  });

  if (error) {
    // Handle Postgres unique violation (race condition between check + insert)
    if (error.code === "23505") {
      return {
        fieldErrors: { slug: ["This slug is already in use. Choose a different one."] },
      };
    }
    return { formError: "Failed to create event type. Please try again." };
  }

  // 5. Revalidate list + redirect — OUTSIDE any try/catch
  revalidatePath("/app/event-types");
  redirect("/app/event-types");
}
```

**Update action:** Same shape but with `.update()` + `.eq("id", id)`. Pass `id` as a hidden form field.

**Soft-delete action:**
```typescript
export async function softDeleteEventTypeAction(id: string): Promise<EventTypeState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_types")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { formError: "Failed to archive event type." };
  revalidatePath("/app/event-types");
  return {};
}
```

**Restore action (with slug-collision detection):**
```typescript
export async function restoreEventTypeAction(
  id: string,
  newSlug?: string,
): Promise<{ error?: string; slugCollision?: boolean; currentSlug?: string }> {
  const supabase = await createClient();

  // Check if original slug is available
  const { data: et } = await supabase
    .from("event_types")
    .select("slug, account_id")
    .eq("id", id)
    .single();

  const slugToUse = newSlug ?? et?.slug;

  const { data: collision } = await supabase
    .from("event_types")
    .select("id")
    .eq("account_id", et!.account_id)
    .eq("slug", slugToUse!)
    .is("deleted_at", null)
    .maybeSingle();

  if (collision) {
    // Return collision signal with original slug for the client prompt
    return { slugCollision: true, currentSlug: et?.slug };
  }

  const { error } = await supabase
    .from("event_types")
    .update({ deleted_at: null, is_active: false, slug: slugToUse })
    .eq("id", id);

  if (error) return { error: "Failed to restore event type." };
  revalidatePath("/app/event-types");
  return {};
}
```

### RHF + useActionState Bridge (confirmed Phase 2 pattern)

Exactly the same bridge as Phase 2's login form. The form is a Client Component using `useActionState`. Server errors feed back through `state.fieldErrors` into RHF via the `errors` prop on `useForm`.

**Controller for Switch (is_active toggle):**
```typescript
// Switch does not use register() — use Controller instead
<Controller
  name="is_active"
  control={control}
  render={({ field }) => (
    <Switch
      checked={field.value}
      onCheckedChange={field.onChange}
      id="is-active"
    />
  )}
/>
```

**Controller for Select (question type):**
```typescript
<Controller
  name={`questions.${index}.type`}
  control={control}
  render={({ field }) => (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="short-text">Short text</SelectItem>
        <SelectItem value="long-text">Long text</SelectItem>
        <SelectItem value="yes-no">Yes / No</SelectItem>
        <SelectItem value="single-select">Single select</SelectItem>
      </SelectContent>
    </Select>
  )}
/>
```

Note: `register()` works for standard HTML inputs (text, textarea, hidden). `Controller` is required for shadcn Switch and Select because they don't expose a native DOM `ref`. Do not call both `register()` and `Controller` on the same field.

### List Page (Server Component)

Pattern matches `/app/page.tsx` from Phase 2. Supabase query runs on the server, result passed as props to a Client Component table:

```typescript
// app/(shell)/app/event-types/page.tsx  — Server Component
export default async function EventTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const supabase = await createClient();
  const { archived } = await searchParams;
  const showArchived = archived === "true";

  let query = supabase
    .from("event_types")
    .select("id, name, slug, duration_minutes, is_active, deleted_at, created_at")
    .order("created_at", { ascending: true });

  if (showArchived) {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
  }

  const { data: eventTypes, error } = await query;
  // ...
}
```

**Note on searchParams:** Next.js 16 makes `searchParams` a Promise — `await searchParams` is required (same as `await params` for dynamic routes, established in Phase 1 RESEARCH). This is a Next 16 breaking change from 15.

### slugify Utility

```typescript
// lib/slugify.ts
/**
 * Converts a string to a URL-friendly slug.
 * Works identically in browser and Node.js (no DOM APIs, no Node-only APIs).
 * NFKD normalization strips accents before lowercasing.
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

The final `.replace(/^-+|-+$/g, "")` trims leading/trailing hyphens (e.g., `"--foo--"` → `"foo"`). This handles edge cases like names starting with numbers or special characters.

**Usage in form:** Call `slugify(nameValue)` inside a `useEffect` or `onChange` handler on the name field. Once the user edits the slug manually, set a `slugManuallyEdited` boolean flag in component state to stop auto-generation.

### custom_questions Zod Schema

```typescript
// Zod v4 discriminated union on 'type' field
import { z } from "zod";

const baseQuestion = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, "Question label is required."),
  required: z.boolean().default(false),
});

const shortTextQuestion = baseQuestion.extend({
  type: z.literal("short-text"),
});

const longTextQuestion = baseQuestion.extend({
  type: z.literal("long-text"),
});

const yesNoQuestion = baseQuestion.extend({
  type: z.literal("yes-no"),
});

const singleSelectQuestion = baseQuestion.extend({
  type: z.literal("single-select"),
  options: z.array(z.string().min(1)).min(1, "Add at least one option.").max(20),
});

export const customQuestionSchema = z.discriminatedUnion("type", [
  shortTextQuestion,
  longTextQuestion,
  yesNoQuestion,
  singleSelectQuestion,
]);

export type CustomQuestion = z.infer<typeof customQuestionSchema>;

export const eventTypeSchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  slug: z.string()
    .min(1, "Slug is required.")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens."),
  duration_minutes: z.coerce.number().int().min(1, "Duration must be at least 1 minute.").max(480),
  description: z.string().max(500).optional(),
  is_active: z.coerce.boolean().default(true),
  custom_questions: z.array(customQuestionSchema).default([]),
});

export type EventTypeInput = z.infer<typeof eventTypeSchema>;
```

**Zod v4 note:** `z.coerce.number()` and `z.coerce.boolean()` work as expected for FormData string values. `z.discriminatedUnion` in Zod v4 uses O(1) discriminator lookup (faster than v3). No breaking API changes for this usage.

### custom_questions JSON storage shape

Each element stored in the `custom_questions` JSONB array:

```typescript
// short-text / long-text / yes-no
{ "id": "uuid-v4", "label": "Company name", "type": "short-text", "required": true }

// single-select
{ "id": "uuid-v4", "label": "Project type", "type": "single-select", "required": false, "options": ["Residential", "Commercial", "Industrial"] }
```

Order = array index position. Reorder by reindexing the array client-side, then saving. The up/down arrow pattern swaps `array[i]` and `array[i-1]` / `array[i+1]` then updates RHF state via `setValue("custom_questions", reorderedArray)`.

**Generate IDs client-side** using `crypto.randomUUID()` (browser + Node 16+). Do not use `uuid` npm package.

### Status Badge Logic

```typescript
// Three states as defined in CONTEXT.md decisions
function StatusBadge({ isActive, deletedAt }: { isActive: boolean; deletedAt: string | null }) {
  if (deletedAt) {
    return <Badge variant="outline">Archived</Badge>;  // strikethrough row
  }
  if (!isActive) {
    return <Badge variant="secondary">Inactive</Badge>;
  }
  return <Badge>Active</Badge>;
}
```

Badge variants from shadcn radix-nova: `default` (filled, primary color), `secondary` (muted), `outline` (bordered, subtle), `destructive`. "Archived" = outline, "Inactive" = secondary, "Active" = default.

### Toast Pattern (Sonner)

```typescript
// In root layout (app/layout.tsx), add Toaster once:
import { Toaster } from "@/components/ui/sonner";
// ...
<body><Toaster />{children}</body>

// In any Client Component that fires a mutation:
import { toast } from "sonner";

// After successful save (called in form's onSuccess handler or after action resolves):
toast.success("Event type saved.");
toast.error("Failed to save. Please try again.");
```

Sonner is the current shadcn-recommended toast (the older `toast` component is deprecated). It requires the `<Toaster />` placed once in the root layout.

### Delete Confirmation Pattern

Two-tier logic based on booking count:

```typescript
// In the kebab menu handler, before showing the dialog,
// fetch the booking count (client-side via supabase browser client):
const { count } = await supabase
  .from("bookings")
  .select("id", { count: "exact", head: true })
  .eq("event_type_id", eventTypeId)
  .neq("status", "cancelled");
```

If `count === 0`: render simple AlertDialog ("Are you sure? This cannot be undone.").
If `count > 0`: render AlertDialog with a controlled Input that must match the event type name. AlertDialogAction is disabled until `inputValue === eventType.name`.

### Slug Uniqueness Validation

**Primary enforcement:** Postgres partial unique index `event_types_account_id_slug_active` (non-deleted rows only). This is the source of truth.

**Pre-flight check (optimistic, client-friendly):** The Server Action does a pre-insert SELECT for the slug before attempting the INSERT. If it finds a match, it returns `{ fieldErrors: { slug: [...] } }` — RHF displays this as a per-field error below the slug input.

**Race condition defense:** If two concurrent saves race, the INSERT fails with Postgres error code `23505` (unique_violation). The Server Action catches this by checking `error.code === "23505"` and returns the same slug field error. This is the only place in Phase 3 where gating on `error.code` (rather than `error.status`) is correct — this is a DB-level constraint violation, not an auth-js bug.

**No client-side debounced uniqueness check** (async lookup while typing). Server-only validation is sufficient for a single-owner dashboard. The pre-flight check in the Server Action gives clean field-level error feedback without the complexity of a dedicated uniqueness API endpoint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for question IDs | Custom ID generator | `crypto.randomUUID()` | Built into browser + Node 16+; no dependency |
| Kebab menu | Custom popover + state | shadcn DropdownMenu | Keyboard nav, focus trap, portal positioning handled |
| Confirmation modal | Custom modal | shadcn AlertDialog | Focus management, aria-modal, Radix primitives |
| Toast notifications | Custom toast state | shadcn Sonner | Animation, queue, position, a11y done |
| Form submission loading state | `useState(isLoading)` | `isPending` from `useActionState` | Already provided; no extra state needed |
| Slug deduplication | DB-level slug counter | Pre-flight SELECT + partial unique index | Correct semantic (only among non-deleted) |

---

## Common Pitfalls

### Pitfall 1: `deleted_at` missing from Phase 1 schema

**What goes wrong:** Soft-delete update silently fails or errors because the column doesn't exist.
**Why it happens:** Phase 1 schema intentionally deferred soft-delete to Phase 3.
**How to avoid:** The very first task in Phase 3 must apply the migration adding `deleted_at` and replacing the unique constraint with a partial index.
**Warning signs:** Any `supabase.update({ deleted_at: ... })` call returning a column-not-found error.

### Pitfall 2: Unique constraint blocks slug re-use after archive/restore

**What goes wrong:** Andrew archives "30-min-consult", creates a new "30-Min Consult" (same slug), then tries to restore the archived one — but the unique constraint blocks both from existing simultaneously.
**Why it happens:** The original `unique(account_id, slug)` constraint covers ALL rows including archived.
**How to avoid:** Replace with the partial unique index `where deleted_at is null`. This is load-bearing for the restore UX.
**Warning signs:** Restore action fails with a 23505 unique_violation even when the live event types list appears to have no slug conflict.

### Pitfall 3: `redirect()` inside a try/catch swallows the redirect

**What goes wrong:** Page never navigates after successful create/update.
**Why it happens:** `redirect()` throws `NEXT_REDIRECT`; a bare `catch` swallows it.
**How to avoid:** Call `redirect()` as the LAST statement in the Server Action, after any try/catch blocks. This is Phase 2's documented pattern — do not deviate.
**Warning signs:** Create action returns without error but the browser stays on the same page.

### Pitfall 4: `searchParams` must be awaited in Next 16

**What goes wrong:** TypeScript error or runtime undefined when accessing `searchParams.archived`.
**Why it happens:** Next.js 16 made `searchParams` a Promise in Server Components (same as `params` for dynamic routes).
**How to avoid:** `const { archived } = await searchParams;` — always await before accessing.
**Warning signs:** TypeScript complains about `searchParams.archived` being a `Promise<...>` not a string.

### Pitfall 5: Switch and Select need `Controller`, not `register()`

**What goes wrong:** Toggle state doesn't update, or toggling fires no change event.
**Why it happens:** shadcn Switch and Select don't expose a DOM `ref` that RHF's `register()` can attach to.
**How to avoid:** Use `Controller` with `field.value`/`field.onChange` for all non-native-input fields. Never call both `register()` and wrap in `Controller` on the same field.
**Warning signs:** `is_active` in the saved event type never changes from default, or question type dropdown doesn't update form state.

### Pitfall 6: custom_questions sent as JSON string, not nested FormData

**What goes wrong:** The Server Action receives `formData.get("custom_questions")` as a JSON string, but Zod tries to validate it as an array.
**Why it happens:** FormData cannot natively represent nested arrays; the form must serialize `custom_questions` to JSON and pass it as a hidden field, or the action must JSON.parse it.
**How to avoid:** In the form's submit, serialize the RHF questions array to JSON and set it as a hidden `<input type="hidden" name="custom_questions" value={JSON.stringify(questions)} />`. In the Server Action, `JSON.parse(formData.get("custom_questions") as string)` before Zod validation. Alternatively, call the Server Action directly (not via `<form action>`) and pass the questions object directly — this avoids FormData serialization entirely.
**Warning signs:** `custom_questions` Zod validation always fails with "expected array, received string."

### Pitfall 7: Booking count fetch blocks the kebab menu from opening

**What goes wrong:** The delete menu item has a noticeable delay because it awaits a Supabase query before showing the dialog.
**Why it happens:** Fetching booking count inside the click handler is synchronous with the UI.
**How to avoid:** Either (a) pre-fetch booking count when the table loads (include it in the Server Component's SELECT with a subquery join), or (b) show the dialog immediately and fetch count inside the dialog before enabling the confirm button. Option (b) feels more responsive.
**Warning signs:** Clicking the kebab "Archive" item has a 300-500ms pause before the dialog appears.

### Pitfall 8: Sonner not rendering — missing `<Toaster />` in layout

**What goes wrong:** `toast.success(...)` is called but nothing appears.
**Why it happens:** Sonner requires the `<Toaster />` portal component placed once at the root layout level.
**How to avoid:** Add `<Toaster />` to `app/layout.tsx` (the root layout, not the shell layout) so it's always mounted.
**Warning signs:** No visual feedback after save actions despite `toast.success(...)` being called without error.

---

## Code Examples

### Soft-Delete Query Filter

```typescript
// Active event types (default list view):
const { data } = await supabase
  .from("event_types")
  .select("*")
  .is("deleted_at", null)          // supabase-js: IS NULL uses .is("col", null)
  .order("created_at", { ascending: true });

// Archived event types (when "Show archived" is on):
const { data } = await supabase
  .from("event_types")
  .select("*")
  .not("deleted_at", "is", null)   // IS NOT NULL uses .not("col", "is", null)
  .order("deleted_at", { ascending: false });
```

Note: supabase-js uses `.is("column", null)` for `IS NULL` — NOT `.eq("column", null)` which generates `= null` (always false in SQL). This is a frequent source of bugs.

### Restore with Slug Collision

```typescript
// Server Action return shapes:
type RestoreResult =
  | { ok: true }
  | { slugCollision: true; archivedSlug: string }
  | { error: string };

// Client-side flow:
const result = await restoreEventTypeAction(id);
if ("slugCollision" in result) {
  // Show a Dialog with a controlled Input for new slug
  // Pre-fill with result.archivedSlug + "-restored" as suggestion
  openSlugPromptDialog({ id, suggestedSlug: result.archivedSlug + "-restored" });
} else if ("error" in result) {
  toast.error(result.error);
} else {
  toast.success("Event type restored as inactive.");
}
```

### Table Row with Kebab

```typescript
// Table component imports from shadcn
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

// In a row:
<TableRow className={et.deleted_at ? "opacity-50 line-through" : !et.is_active ? "opacity-60" : ""}>
  <TableCell>{et.name}</TableCell>
  <TableCell className="font-mono text-xs">{et.slug}</TableCell>
  <TableCell>{et.duration_minutes} min</TableCell>
  <TableCell><StatusBadge isActive={et.is_active} deletedAt={et.deleted_at} /></TableCell>
  <TableCell>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Row actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/app/event-types/${et.id}/edit`}>Edit</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleToggleActive(et.id, !et.is_active)}>
          {et.is_active ? "Set Inactive" : "Set Active"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleArchive(et.id)} className="text-destructive">
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TableCell>
</TableRow>
```

### revalidatePath After CRUD Mutation

```typescript
// After create/update/delete/restore — all mutations use the same pattern:
revalidatePath("/app/event-types");   // revalidates the list page
// For edit page, also revalidate the specific event type (if list uses ISR):
// revalidatePath(`/app/event-types/${id}/edit`);
// Not needed for this use case — the edit page is always fetched fresh (no cache).
```

### Type-the-Name Confirmation Dialog

```typescript
"use client";
import { useState } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteConfirmDialog({
  eventTypeName, onConfirm, hasBookings
}: { eventTypeName: string; onConfirm: () => void; hasBookings: boolean }) {
  const [inputValue, setInputValue] = useState("");

  if (!hasBookings) {
    return (
      <AlertDialog>
        {/* Simple confirm — no type-the-name gate */}
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{eventTypeName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The event type will be hidden from booking pages. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive "{eventTypeName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This event type has existing bookings. Type its name to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="confirm-name">Event type name</Label>
          <Input
            id="confirm-name"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={eventTypeName}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={inputValue !== eventTypeName}
          >
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| shadcn `Toast` component | shadcn `Sonner` component | Old `Toast` is deprecated; install `sonner` not `toast` |
| `unique(account_id, slug)` (all rows) | Partial unique index `where deleted_at is null` | Allows slug reuse after archive; required for restore UX |
| `z.discriminatedUnion` with O(n) validation (Zod v3) | O(1) discriminator lookup (Zod v4) | Faster validation; same API surface |
| `searchParams` as plain object (Next 15) | `searchParams` as Promise (Next 16) | Must `await searchParams` in Server Components |
| `register()` for all inputs (RHF) | `Controller` for Switch/Select (non-ref-forwarding components) | Switch and Select require Controller; register fails silently |

---

## Open Questions

1. **Booking count fetch strategy for delete confirmation**
   - What we know: The delete dialog needs to know if any bookings exist for an event type before showing the simple vs. complex confirm UI.
   - What's unclear: Should booking count be included in the list-page Server Component query (requires a JOIN or subquery), or fetched lazily when the user clicks "Archive" in the kebab?
   - Recommendation: Fetch lazily inside the dialog (client-side query via browser supabase client after the dialog opens). This avoids complicating the list query and the count only matters when actually archiving.

2. **Server Action direct call vs. form submission for custom_questions**
   - What we know: The `custom_questions` array is nested structured data that doesn't serialize naturally through `FormData`.
   - What's unclear: Whether the planner prefers (a) serializing to JSON as a hidden input + JSON.parse in the action, or (b) calling the Server Action directly (not via `<form action>`) and passing the full form object.
   - Recommendation: Call the Server Action directly (`await createEventTypeAction(formData)` where `formData` is the RHF `handleSubmit` result). This is the cleaner approach for complex structured data and avoids the JSON round-trip. The `useActionState` bridge still works — wrap the direct call in a thin state handler. However, this loses progressive enhancement (form submits without JS). For a private owner dashboard, this tradeoff is acceptable. Andrew should confirm if that matters.

3. **Slug-collision prompt UX for restore**
   - What we know: If restoring an archived event type whose slug is now taken, the UI must prompt for a new slug.
   - What's unclear: Whether this should be a second Dialog that opens inside the first (nested dialogs are problematic in Radix), or a full page redirect to a restore form, or an inline input that appears in the archived-row area.
   - Recommendation: A standalone Dialog component (not nested) that replaces the archive kebab flow. The restore action returns a collision signal; the client then mounts a separate Dialog with a slug input. This avoids the nested-dialog Radix issue.

---

## Sources

### Primary (HIGH confidence)

- Phase 1 migration files (read directly) — confirmed schema, RLS, unique constraint shape
- Phase 2 RESEARCH.md + plan files (read directly) — confirmed Server Action pattern, useActionState bridge, RHF + Zod shape, shadcn install commands
- Phase 2 SUMMARY files (read directly) — confirmed RPC return shape, TooltipProvider pattern, `.env.local` password quoting
- `components.json` (read directly) — confirmed `style: "radix-nova"`, CSS variables enabled
- `package.json` (read directly) — confirmed all installed dependency versions
- Next.js official docs `revalidatePath` — fetched 2026-04-24, version 16.2.4
- shadcn/ui docs (WebFetch) — Table, DropdownMenu, AlertDialog, Switch, Badge, Select, Sonner component APIs

### Secondary (MEDIUM confidence)

- Supabase soft-delete pattern — WebSearch cross-referenced with multiple Supabase community sources; `.is("deleted_at", null)` syntax confirmed
- RHF Controller with Switch pattern — WebSearch found official shadcn form integration source; `checked={field.value}` + `onCheckedChange={field.onChange}` confirmed in shadcn GitHub issue #98
- Zod v4 discriminated union — WebFetch of zod.dev v4 release notes; no breaking changes to `z.discriminatedUnion` API surface

### Tertiary (LOW confidence)

- Restore + slug-collision UX pattern — No established framework pattern found; recommendation is original design based on Radix Dialog constraints
- Booking count fetch strategy — No authoritative source; recommendation is based on reasoning from established patterns

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Schema (existing) | HIGH | Read directly from migration files |
| Schema (needed migration) | HIGH | Derived from schema + CONTEXT.md decisions |
| shadcn components to install | HIGH | Official shadcn docs fetched |
| Server Action pattern | HIGH | Verbatim from Phase 2 + Next.js official docs |
| RHF Controller for Switch/Select | HIGH | Confirmed in shadcn GitHub issue + RHF docs |
| slugify implementation | HIGH | Standard algorithm, multiple sources agree |
| custom_questions Zod schema | HIGH | Zod v4 docs; discriminatedUnion API stable |
| Soft-delete query syntax | MEDIUM | Community sources; `.is()` syntax well-known |
| Toast (Sonner) | HIGH | shadcn official docs; old Toast deprecated |
| Restore slug-collision UX | LOW | Original design; no established pattern |
| Booking count fetch strategy | LOW | Reasoning from patterns; no authoritative source |

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days; shadcn and Next.js ship frequently — re-verify shadcn component install commands if deferred)
