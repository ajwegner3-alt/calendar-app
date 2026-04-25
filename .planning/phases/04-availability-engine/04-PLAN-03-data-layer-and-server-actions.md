---
phase: 04-availability-engine
plan: 03
type: execute
wave: 2
depends_on: ["04-01"]
files_modified:
  - app/(shell)/app/availability/_lib/types.ts
  - app/(shell)/app/availability/_lib/schema.ts
  - app/(shell)/app/availability/_lib/queries.ts
  - app/(shell)/app/availability/_lib/actions.ts
autonomous: true

must_haves:
  truths:
    - "app/(shell)/app/availability/_lib/queries.ts exports loadAvailabilityState(): a Server Component data loader that fetches account settings + weekly rules + date overrides for the owner's account in a single trip and returns a typed AvailabilityState object"
    - "app/(shell)/app/availability/_lib/schema.ts exports Zod schemas: weeklyRulesSchema (per-day arrays of {start_minute, end_minute} windows with sort+overlap validation), dateOverrideSchema (discriminated union: blocked vs custom-hours), accountSettingsSchema (4 integer fields with documented bounds matching the migration CHECK constraints)"
    - "app/(shell)/app/availability/_lib/actions.ts exports saveWeeklyRulesAction (replaces all rules for a day_of_week atomically: delete + insert in one round-trip via single DELETE + bulk INSERT in a transaction-shaped pair), saveAccountSettingsAction (validates + updates the 4 columns), upsertDateOverrideAction (handles BOTH 'block' and 'custom hours' shapes; deletes opposite-shape rows for the same date first per RESEARCH Pitfall 5), deleteDateOverrideAction (removes all rows for a given override_date)"
    - "All actions resolve account_id via current_owner_account_ids RPC (mirrors Phase 3 pattern); use createClient() from @/lib/supabase/server (RLS-scoped; NO admin client); call revalidatePath('/app/availability') on success; do NOT redirect (the UI handles toast + state refresh)"
    - "Time-window overlap validation: for each day_of_week's windows, sorted by start_minute, every windows[i].end_minute MUST be <= windows[i+1].start_minute (no overlap; touching is OK). Validation rejects with friendly error message listing the conflicting pair (RESEARCH §6 recommendation)"
    - "Window time bounds validated: 0 <= start_minute < end_minute <= 1440 (matches DB CHECK constraints from Phase 1 schema)"
    - "Account settings bounds validated against migration CHECK constraints: buffer_minutes >= 0, min_notice_hours >= 0, max_advance_days > 0, daily_cap is null or > 0"
  artifacts:
    - path: "app/(shell)/app/availability/_lib/types.ts"
      provides: "Shared types for availability surface: AvailabilityState (loader return shape), DayOfWeek, TimeWindow, DateOverrideInput discriminated union"
      exports: ["AvailabilityState", "DayOfWeek", "TimeWindow", "DateOverrideInput", "AccountSettingsRow", "AvailabilityRuleRow", "DateOverrideRow"]
    - path: "app/(shell)/app/availability/_lib/schema.ts"
      provides: "Zod schemas for the 4 settings, weekly rules (per-day windows arrays), date override (discriminated union)"
      exports: ["accountSettingsSchema", "weeklyRulesSchema", "dateOverrideSchema", "AccountSettingsInput", "WeeklyRulesInput", "DateOverrideFormInput"]
      min_lines: 60
    - path: "app/(shell)/app/availability/_lib/queries.ts"
      provides: "Server-only data loader: loadAvailabilityState() returns {account, rules, overrides} for owner's account"
      exports: ["loadAvailabilityState"]
      min_lines: 30
    - path: "app/(shell)/app/availability/_lib/actions.ts"
      provides: "All Server Actions: saveAccountSettingsAction, saveWeeklyRulesAction (per-day replace), upsertDateOverrideAction, deleteDateOverrideAction"
      contains: "use server"
      exports: ["saveAccountSettingsAction", "saveWeeklyRulesAction", "upsertDateOverrideAction", "deleteDateOverrideAction", "AvailabilityActionState"]
      min_lines: 150
  key_links:
    - from: "app/(shell)/app/availability/_lib/queries.ts"
      to: "Supabase tables: accounts, availability_rules, date_overrides"
      via: "createClient() + .from(...).select(...) — three queries OR Promise.all"
      pattern: "from\\(.accounts.\\)|from\\(.availability_rules.\\)|from\\(.date_overrides.\\)"
    - from: "app/(shell)/app/availability/_lib/actions.ts"
      to: "Supabase RPC current_owner_account_ids"
      via: "supabase.rpc('current_owner_account_ids')"
      pattern: "current_owner_account_ids"
    - from: "app/(shell)/app/availability/_lib/actions.ts"
      to: "@/lib/supabase/server createClient"
      via: "RLS-scoped client (NOT admin)"
      pattern: "createClient\\(\\)"
    - from: "app/(shell)/app/availability/_lib/actions.ts"
      to: "Next.js revalidatePath"
      via: "revalidatePath('/app/availability') after every mutation"
      pattern: "revalidatePath"
---

<objective>
Ship the DATA LAYER for Phase 4: shared types, Zod schemas with overlap/bound validation, a Server Component data loader, and ALL Server Actions for the dashboard editor (settings panel, weekly rules per-day save, date override upsert/delete). Plans 04-04 (weekly editor + settings panel) and 04-05 (overrides UI) both consume this module.

Purpose: Centralize all availability mutations + reads in one tested, RLS-scoped module. Splitting actions across plans/files would risk subtle divergence (different validation rules, different revalidate paths, drift in the override mutual-exclusion logic). Mirrors the Plan 03-03 pattern that worked for Event Types: ONE action file, ONE schema file, ONE source of truth for slug/window/override semantics.

Output: Four module files under `app/(shell)/app/availability/_lib/` (types, schema, queries, actions). Type-checked and build-clean. No UI surface yet — that's Plans 04-04 + 04-05.

Plan-level scoping note: This plan inherits Phase 3's "direct-call Server Action contract" decision (STATE.md, locked). Actions accept structured TypeScript objects, NOT FormData. The weekly editor in Plan 04-04 will call `await saveWeeklyRulesAction({ day_of_week: 1, windows: [...] })` from RHF's `onSubmit` — same shape as Phase 3.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-availability-engine/04-CONTEXT.md
@.planning/phases/04-availability-engine/04-RESEARCH.md
@.planning/phases/04-availability-engine/04-01-SUMMARY.md

# Existing schema this plan reads from / writes to
@supabase/migrations/20260419120000_initial_schema.sql
@supabase/migrations/20260425120000_account_availability_settings.sql

# Phase 3 patterns to mirror (direct-call action contract, slug pre-flight, error handling)
@app/(shell)/app/event-types/_lib/actions.ts
@app/(shell)/app/event-types/_lib/schema.ts
@lib/supabase/server.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ship shared types + Zod schemas with overlap/bounds validation</name>
  <files>app/(shell)/app/availability/_lib/types.ts, app/(shell)/app/availability/_lib/schema.ts</files>
  <action>
Create the shared types module and the Zod schemas. Both live under `app/(shell)/app/availability/_lib/` — the `_lib` underscore prefix tells Next.js this is a private module folder, NOT a route (mirrors Phase 3's `app/(shell)/app/event-types/_lib/`).

**File 1 — `app/(shell)/app/availability/_lib/types.ts`:**

```typescript
/**
 * Shared types for the availability feature (Phase 4).
 *
 * - AccountSettingsRow / AvailabilityRuleRow / DateOverrideRow: DB row shapes
 * - DayOfWeek: 0 (Sun) – 6 (Sat) literal union, matches Postgres convention
 * - TimeWindow: a single {start_minute, end_minute} window inside a day
 * - DateOverrideInput: client-facing discriminated union for the override form
 *   (one of "block" or "custom_hours"); the server action splits the union
 *   into the right DB row shape
 * - AvailabilityState: the loader's return value (used by Plan 04-04 + 04-05
 *   page-level Server Components)
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeWindow {
  /** Minutes since local midnight, 0-1439 inclusive */
  start_minute: number;
  /** Minutes since local midnight, 1-1440 inclusive; must be > start_minute */
  end_minute: number;
}

export interface AccountSettingsRow {
  buffer_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  daily_cap: number | null;
  timezone: string;
}

export interface AvailabilityRuleRow {
  id: string;
  account_id: string;
  day_of_week: DayOfWeek;
  start_minute: number;
  end_minute: number;
  created_at: string;
}

export interface DateOverrideRow {
  id: string;
  account_id: string;
  override_date: string;          // YYYY-MM-DD
  is_closed: boolean;
  start_minute: number | null;
  end_minute: number | null;
  note: string | null;
  created_at: string;
}

/**
 * Form-side discriminated union for upsertDateOverrideAction.
 *
 * "block" = single is_closed=true row for the date.
 * "custom_hours" = one or more rows with start_minute/end_minute, no is_closed=true.
 */
export type DateOverrideInput =
  | {
      type: "block";
      override_date: string;       // YYYY-MM-DD
      note?: string;
    }
  | {
      type: "custom_hours";
      override_date: string;
      windows: TimeWindow[];
      note?: string;
    };

export interface AvailabilityState {
  account: AccountSettingsRow;
  /** All weekly rules for the owner's account; UI groups by day_of_week */
  rules: AvailabilityRuleRow[];
  /** All date overrides for the account (no time-range filter — Plan 04-05's
   *  calendar shows ~3 months at a time and can scroll forward; loading all
   *  is fine for v1 single-tenant scale) */
  overrides: DateOverrideRow[];
}
```

**File 2 — `app/(shell)/app/availability/_lib/schema.ts`:**

```typescript
import { z } from "zod";

import type { DayOfWeek, TimeWindow } from "./types";

/**
 * Single time-window inside a day. Minutes since local midnight.
 *
 * 0 <= start < end <= 1440 — matches the DB CHECK constraint on
 * availability_rules (`end_minute > start_minute`) plus the smallint
 * range bound. Custom error messages are user-facing.
 */
export const timeWindowSchema = z
  .object({
    start_minute: z.coerce
      .number()
      .int("Start time must be a whole minute.")
      .min(0, "Start time cannot be before 12:00 AM.")
      .max(1439, "Start time cannot be after 11:59 PM."),
    end_minute: z.coerce
      .number()
      .int("End time must be a whole minute.")
      .min(1, "End time must be after start time.")
      .max(1440, "End time cannot be after 12:00 AM (next day)."),
  })
  .refine((w) => w.end_minute > w.start_minute, {
    message: "End time must be after start time.",
    path: ["end_minute"],
  });

/**
 * Detect overlapping windows in a sorted-by-start array.
 *
 * Returns null if no overlap; otherwise the index of the first overlapping
 * pair (used to build a human-readable error). Touching boundaries
 * (a.end == b.start) are NOT overlaps — adjacent windows are valid.
 */
function findOverlap(sorted: TimeWindow[]): { i: number; j: number } | null {
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end_minute > sorted[i + 1].start_minute) {
      return { i, j: i + 1 };
    }
  }
  return null;
}

function minutesToHHMM(m: number): string {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Schema for "save all windows for one weekday" (saveWeeklyRulesAction).
 *
 * - day_of_week: 0–6 (Sun–Sat)
 * - windows: array of {start_minute, end_minute}, possibly empty
 *   (empty = "Closed" toggle for that weekday → action will DELETE all rules
 *   for the day_of_week)
 *
 * Refines for overlap (RESEARCH §6: validate on save, not on blur).
 */
export const weeklyRulesSchema = z
  .object({
    day_of_week: z.coerce
      .number()
      .int()
      .min(0, "day_of_week must be 0-6.")
      .max(6, "day_of_week must be 0-6.") as z.ZodType<DayOfWeek>,
    windows: z.array(timeWindowSchema).max(20, "Too many time windows for one day."),
  })
  .superRefine((data, ctx) => {
    const sorted = [...data.windows].sort(
      (a, b) => a.start_minute - b.start_minute,
    );
    const overlap = findOverlap(sorted);
    if (overlap) {
      const a = sorted[overlap.i];
      const b = sorted[overlap.j];
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["windows"],
        message: `Time windows overlap: ${minutesToHHMM(a.start_minute)}–${minutesToHHMM(a.end_minute)} and ${minutesToHHMM(b.start_minute)}–${minutesToHHMM(b.end_minute)}.`,
      });
    }
  });

/**
 * Schema for upsertDateOverrideAction. Matches DateOverrideInput shape from
 * types.ts. Discriminator is "type" — "block" or "custom_hours".
 */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const dateOverrideSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("block"),
    override_date: z
      .string()
      .regex(dateRegex, "Date must be in YYYY-MM-DD format."),
    note: z.string().max(200, "Note must be 200 characters or fewer.").optional(),
  }),
  z
    .object({
      type: z.literal("custom_hours"),
      override_date: z
        .string()
        .regex(dateRegex, "Date must be in YYYY-MM-DD format."),
      windows: z
        .array(timeWindowSchema)
        .min(1, "Add at least one time window or choose Block instead.")
        .max(20, "Too many time windows for one day."),
      note: z.string().max(200, "Note must be 200 characters or fewer.").optional(),
    })
    .superRefine((data, ctx) => {
      const sorted = [...data.windows].sort(
        (a, b) => a.start_minute - b.start_minute,
      );
      const overlap = findOverlap(sorted);
      if (overlap) {
        const a = sorted[overlap.i];
        const b = sorted[overlap.j];
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["windows"],
          message: `Time windows overlap: ${minutesToHHMM(a.start_minute)}–${minutesToHHMM(a.end_minute)} and ${minutesToHHMM(b.start_minute)}–${minutesToHHMM(b.end_minute)}.`,
        });
      }
    }),
]);

/**
 * Schema for saveAccountSettingsAction. Bounds match the migration CHECK
 * constraints (Plan 04-01).
 */
export const accountSettingsSchema = z.object({
  buffer_minutes: z.coerce
    .number()
    .int("Buffer must be a whole number of minutes.")
    .min(0, "Buffer cannot be negative.")
    .max(240, "Buffer cannot exceed 240 minutes (4 hours)."),
  min_notice_hours: z.coerce
    .number()
    .int("Minimum notice must be a whole number of hours.")
    .min(0, "Minimum notice cannot be negative.")
    .max(8760, "Minimum notice cannot exceed 8760 hours (1 year)."),
  max_advance_days: z.coerce
    .number()
    .int("Max advance must be a whole number of days.")
    .min(1, "Max advance must be at least 1 day.")
    .max(365, "Max advance cannot exceed 365 days."),
  daily_cap: z
    .union([
      z.coerce
        .number()
        .int("Daily cap must be a whole number.")
        .min(1, "Daily cap must be at least 1, or empty for no cap."),
      z.literal(null),
      z
        .literal("")
        .transform(() => null)
        .or(z.undefined().transform(() => null)),
    ])
    .nullable(),
});

export type WeeklyRulesInput = z.infer<typeof weeklyRulesSchema>;
export type DateOverrideFormInput = z.infer<typeof dateOverrideSchema>;
export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;
```

Key rules:
- Window-overlap validation runs on SAVE (RESEARCH §6 recommendation, CONTEXT-locked: don't auto-merge silently). Both `weeklyRulesSchema` and the `custom_hours` branch of `dateOverrideSchema` use the same `findOverlap` helper.
- Touching boundaries (e.g., 9:00–12:00 + 12:00–17:00) are NOT overlaps — `findOverlap` uses `>`, not `>=`. Adjacent windows are common ("morning shift, lunch break, afternoon shift") and must be allowed.
- The `weeklyRulesSchema.windows` array is allowed to be EMPTY. That represents "this weekday is Closed" — the action will DELETE all rules for that day_of_week. CONTEXT lock: presence/absence of rows IS the open/closed state, no separate `is_open` column.
- `accountSettingsSchema.daily_cap` accepts `number | null | "" | undefined`. The form's `<input type="number">` returns `""` when blank; we coerce to `null`. That's the "leave empty for no cap" UX from CONTEXT.
- Bounds on settings are tighter than the DB CHECK constraints (e.g., max_advance_days <= 365 here, but the DB only requires > 0). Tighter bounds in the UI catch typos client-side; the DB CHECK is the last-resort guard.
- All error messages are user-facing — they will surface as RHF field errors. End with a period. Be specific (the overlap error names the conflicting pair in HH:MM).

DO NOT:
- Do not include `account_id` in any schema — actions resolve it server-side via the RPC.
- Do not include `id` in `dateOverrideSchema` or `weeklyRulesSchema` — actions look up rows by `(account_id, day_of_week)` or `(account_id, override_date)`, not by id.
- Do not export `findOverlap` or `minutesToHHMM` — keep helpers private.
- Do not auto-merge overlapping windows. CONTEXT-locked: reject with a clear error.
  </action>
  <verify>
```bash
ls "app/(shell)/app/availability/_lib/types.ts" "app/(shell)/app/availability/_lib/schema.ts"

# types.ts shape
grep -q "export type DayOfWeek" "app/(shell)/app/availability/_lib/types.ts" && echo "DayOfWeek ok"
grep -q "export interface AvailabilityState" "app/(shell)/app/availability/_lib/types.ts" && echo "AvailabilityState ok"
grep -q "export type DateOverrideInput" "app/(shell)/app/availability/_lib/types.ts" && echo "DateOverrideInput ok"

# schema.ts shape
grep -q "export const weeklyRulesSchema" "app/(shell)/app/availability/_lib/schema.ts" && echo "weeklyRulesSchema ok"
grep -q "export const dateOverrideSchema" "app/(shell)/app/availability/_lib/schema.ts" && echo "dateOverrideSchema ok"
grep -q "export const accountSettingsSchema" "app/(shell)/app/availability/_lib/schema.ts" && echo "accountSettingsSchema ok"
grep -q 'discriminatedUnion("type"' "app/(shell)/app/availability/_lib/schema.ts" && echo "discriminator ok"
grep -q "Time windows overlap" "app/(shell)/app/availability/_lib/schema.ts" && echo "overlap message ok"

npm run build
```
  </verify>
  <done>
Both files exist. `types.ts` exports `DayOfWeek`, `TimeWindow`, `AccountSettingsRow`, `AvailabilityRuleRow`, `DateOverrideRow`, `DateOverrideInput`, `AvailabilityState`. `schema.ts` exports `timeWindowSchema`, `weeklyRulesSchema` (per-day windows array with overlap superRefine), `dateOverrideSchema` (discriminated union over block/custom_hours, with overlap validation on the custom_hours branch), `accountSettingsSchema` (4 fields with bounds matching migration CHECK constraints), and the inferred input types. `npm run build` exits 0.

Commit: `feat(04-03): add availability shared types and Zod schemas with overlap validation`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Ship the loadAvailabilityState data loader</name>
  <files>app/(shell)/app/availability/_lib/queries.ts</files>
  <action>
Create the Server Component data loader. Plans 04-04 + 04-05 will call this from their `page.tsx` (server component) to populate initial state.

```typescript
import "server-only";

import { createClient } from "@/lib/supabase/server";

import type {
  AvailabilityState,
  AccountSettingsRow,
  AvailabilityRuleRow,
  DateOverrideRow,
} from "./types";

/**
 * Resolve the current owner's account_id via the SETOF uuid RPC.
 *
 * Phase 2-04 confirmed supabase-js returns this as a flat string array.
 * Single-tenant v1 → exactly one element when authenticated.
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
 * Load the full availability state for the owner's account.
 *
 * Returns null if the user is not linked to any account (Plan 04-04 + 04-05's
 * page.tsx should redirect / show an unlinked-state if null).
 *
 * Three queries run in parallel via Promise.all (they share no dependencies on
 * each other's result — RESEARCH suggests no need for transactional reads,
 * RLS is sufficient).
 */
export async function loadAvailabilityState(): Promise<AvailabilityState | null> {
  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return null;

  const [accountRes, rulesRes, overridesRes] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "buffer_minutes, min_notice_hours, max_advance_days, daily_cap, timezone",
      )
      .eq("id", accountId)
      .single(),
    supabase
      .from("availability_rules")
      .select("id, account_id, day_of_week, start_minute, end_minute, created_at")
      .eq("account_id", accountId)
      .order("day_of_week", { ascending: true })
      .order("start_minute", { ascending: true }),
    supabase
      .from("date_overrides")
      .select(
        "id, account_id, override_date, is_closed, start_minute, end_minute, note, created_at",
      )
      .eq("account_id", accountId)
      .order("override_date", { ascending: true })
      .order("start_minute", { ascending: true, nullsFirst: true }),
  ]);

  if (accountRes.error || !accountRes.data) return null;

  return {
    account: accountRes.data as AccountSettingsRow,
    rules: (rulesRes.data ?? []) as AvailabilityRuleRow[],
    overrides: (overridesRes.data ?? []) as DateOverrideRow[],
  };
}
```

Key rules:
- File starts with `import "server-only"` (line 1) — same gate Phase 1's admin client uses. Prevents accidental client bundling.
- Uses `createClient()` from `@/lib/supabase/server` — RLS-scoped. NO admin client. The owner's RLS policies (Phase 1) restrict reads to their own account; this loader doesn't need elevated privileges.
- `Promise.all` over the 3 queries — they're independent, parallel reads.
- Returns `null` (NOT throw) when the user is unlinked. The page-level Server Component handles routing/messaging.
- `availability_rules` ordered by `(day_of_week, start_minute)` — UI consumes pre-grouped, pre-sorted; saves a client-side sort.
- `date_overrides` ordered by `(override_date, start_minute)` with `nullsFirst: true` so the `is_closed` row (where start_minute is NULL) comes first for any date that has both kinds of rows. Defensive against the mixed-rows case (RESEARCH Pitfall 5).
- Returns the full `AvailabilityState` shape declared in Task 1's `types.ts`. Plans 04-04 + 04-05 destructure from it.

DO NOT:
- Do not import from `@/lib/supabase/admin` — Phase 4 has zero need for service-role.
- Do not throw — return `null` so the page can render an unlinked-state UI gracefully.
- Do not filter overrides by date range here — Plan 04-05's calendar handles month-window paging client-side. Single-tenant v1 will have small override counts (Andrew's blocked-days + custom-hour days).
- Do not include event-types data — that lives in `app/(shell)/app/event-types/_lib/`.
  </action>
  <verify>
```bash
ls "app/(shell)/app/availability/_lib/queries.ts"

# Server-only marker on line 1
head -1 "app/(shell)/app/availability/_lib/queries.ts" | grep -q 'import "server-only"' && echo "server-only ok"

# Function exported + RPC + RLS-scoped client used
grep -q "export async function loadAvailabilityState" "app/(shell)/app/availability/_lib/queries.ts" && echo "exported"
grep -q "current_owner_account_ids" "app/(shell)/app/availability/_lib/queries.ts" && echo "RPC ok"
grep -q "@/lib/supabase/server" "app/(shell)/app/availability/_lib/queries.ts" && echo "RLS-scoped client ok"

# No admin client leak
! grep -q "@/lib/supabase/admin" "app/(shell)/app/availability/_lib/queries.ts" && echo "no admin client ok"

npm run build
```
  </verify>
  <done>
`app/(shell)/app/availability/_lib/queries.ts` starts with `import "server-only"`, exports `loadAvailabilityState(): Promise<AvailabilityState | null>`, uses `createClient()` from `@/lib/supabase/server`, resolves account_id via the `current_owner_account_ids` RPC, runs 3 parallel queries (account / rules / overrides) via `Promise.all`. `npm run build` exits 0.

Commit: `feat(04-03): add availability data loader (server-only)`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Ship all four Server Actions (settings, weekly rules, override upsert, override delete)</name>
  <files>app/(shell)/app/availability/_lib/actions.ts</files>
  <action>
Create the action module containing all four Server Actions. Mirrors Phase 3's `app/(shell)/app/event-types/_lib/actions.ts` shape (single `"use server"` at top, RLS-scoped client, redirect-free actions that revalidatePath, error gating on `error.code` only for DB constraint violations).

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  accountSettingsSchema,
  type AccountSettingsInput,
  weeklyRulesSchema,
  type WeeklyRulesInput,
  dateOverrideSchema,
  type DateOverrideFormInput,
} from "./schema";

/**
 * Generic action result shape (mirrors Phase 3's EventTypeState).
 *
 * fieldErrors: Per-field RHF errors keyed by schema field name.
 * formError:   Form-level alert banner.
 * Actions DO NOT redirect — UI handles toasts + state refresh after revalidate.
 */
export type AvailabilityActionState = {
  fieldErrors?: Record<string, string[]>;
  formError?: string;
};

const REVALIDATE = "/app/availability";

/**
 * Resolve the current owner's account_id via the SETOF uuid RPC.
 * (Phase 2-04 evidence: returns flat string array.)
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
 * AVAIL-03..06: Save the four account-wide settings.
 */
export async function saveAccountSettingsAction(
  input: AccountSettingsInput,
): Promise<AvailabilityActionState> {
  const parsed = accountSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  const { error } = await supabase
    .from("accounts")
    .update({
      buffer_minutes: parsed.data.buffer_minutes,
      min_notice_hours: parsed.data.min_notice_hours,
      max_advance_days: parsed.data.max_advance_days,
      daily_cap: parsed.data.daily_cap,
    })
    .eq("id", accountId);

  if (error) {
    // CHECK constraint violations from the migration (e.g. someone bypassed
    // client validation). Map to a friendly form-level error.
    if (error.code === "23514") {
      return { formError: "One of the values is out of range. Try again." };
    }
    return { formError: "Failed to save settings. Please try again." };
  }

  revalidatePath(REVALIDATE);
  return {};
}

/**
 * AVAIL-01: Replace ALL weekly rules for a given day_of_week.
 *
 * "Replace" semantics: the action DELETEs all existing rules for the
 * (account_id, day_of_week) pair, then INSERTs the new windows. This is the
 * simplest correct shape for the per-row editor:
 *   - empty array → "Closed" (delete only, no insert)
 *   - 1+ windows → delete + bulk insert
 *
 * The two writes are not transactional (supabase-js doesn't expose tx), but
 * because they are scoped to a single weekday they are idempotent at the row
 * level. Worst case (delete succeeds, insert fails): the day shows as Closed
 * until the user retries. Acceptable for v1.
 */
export async function saveWeeklyRulesAction(
  input: WeeklyRulesInput,
): Promise<AvailabilityActionState> {
  const parsed = weeklyRulesSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  // Step 1: delete existing rows for (account_id, day_of_week).
  const { error: delError } = await supabase
    .from("availability_rules")
    .delete()
    .eq("account_id", accountId)
    .eq("day_of_week", parsed.data.day_of_week);

  if (delError) {
    return { formError: "Failed to update weekly rules. Please try again." };
  }

  // Step 2: insert new windows (skip if "Closed" / empty array).
  if (parsed.data.windows.length > 0) {
    const rows = parsed.data.windows.map((w) => ({
      account_id: accountId,
      day_of_week: parsed.data.day_of_week,
      start_minute: w.start_minute,
      end_minute: w.end_minute,
    }));

    const { error: insError } = await supabase
      .from("availability_rules")
      .insert(rows);

    if (insError) {
      // CHECK constraint violation: end_minute > start_minute. Should be
      // impossible (Zod already validated), but report anyway.
      if (insError.code === "23514") {
        return {
          fieldErrors: { windows: ["End time must be after start time."] },
        };
      }
      return { formError: "Failed to save weekly rules. Please try again." };
    }
  }

  revalidatePath(REVALIDATE);
  return {};
}

/**
 * AVAIL-02: Upsert a date override (Block or Custom hours).
 *
 * RESEARCH Pitfall 5: must enforce mutual exclusion at the action layer —
 * delete any opposite-shape rows for the same date before writing the new ones.
 *
 *   "block" save:        DELETE all rows for date → INSERT one is_closed=true row
 *   "custom_hours" save: DELETE all rows for date → INSERT N window rows
 *
 * Always delete-all-first to avoid orphaned mixed-state rows.
 */
export async function upsertDateOverrideAction(
  input: DateOverrideFormInput,
): Promise<AvailabilityActionState> {
  const parsed = dateOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  // Step 1: clear ALL existing rows for this date.
  const { error: delError } = await supabase
    .from("date_overrides")
    .delete()
    .eq("account_id", accountId)
    .eq("override_date", parsed.data.override_date);

  if (delError) {
    return { formError: "Failed to save override. Please try again." };
  }

  // Step 2: insert the new shape.
  if (parsed.data.type === "block") {
    const { error: insError } = await supabase.from("date_overrides").insert({
      account_id: accountId,
      override_date: parsed.data.override_date,
      is_closed: true,
      start_minute: null,
      end_minute: null,
      note: parsed.data.note ?? null,
    });

    if (insError) {
      return { formError: "Failed to save override. Please try again." };
    }
  } else {
    // custom_hours
    const rows = parsed.data.windows.map((w) => ({
      account_id: accountId,
      override_date: parsed.data.override_date,
      is_closed: false,
      start_minute: w.start_minute,
      end_minute: w.end_minute,
      note: parsed.data.note ?? null,
    }));

    const { error: insError } = await supabase.from("date_overrides").insert(rows);

    if (insError) {
      // 23505 = unique_violation on (account_id, override_date, start_minute).
      // Means the user submitted two windows with the same start_minute (Zod
      // overlap check should have caught equal starts already; defensive).
      if (insError.code === "23505") {
        return {
          fieldErrors: {
            windows: ["Two windows have the same start time. Adjust them and retry."],
          },
        };
      }
      if (insError.code === "23514") {
        return {
          fieldErrors: { windows: ["End time must be after start time."] },
        };
      }
      return { formError: "Failed to save override. Please try again." };
    }
  }

  revalidatePath(REVALIDATE);
  return {};
}

/**
 * Remove an override entirely (returns a date to using its weekly rules).
 *
 * Deletes ALL rows for the (account_id, override_date) pair so a "Custom hours"
 * override with multiple windows is removed atomically.
 */
export async function deleteDateOverrideAction(
  override_date: string,
): Promise<AvailabilityActionState> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(override_date)) {
    return { formError: "Invalid date." };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  const { error } = await supabase
    .from("date_overrides")
    .delete()
    .eq("account_id", accountId)
    .eq("override_date", override_date);

  if (error) {
    return { formError: "Failed to remove override. Please try again." };
  }

  revalidatePath(REVALIDATE);
  return {};
}
```

Key rules:
- Single `"use server"` directive at the top of the file applies to every exported function.
- All actions use `createClient()` from `@/lib/supabase/server` — RLS-scoped. NO admin client. RLS policies (Phase 1) gate the writes by owner_user_id.
- NO action redirects. UI calls `await action(input)`, then either fires a toast on `result.formError` / `result.fieldErrors` or refreshes via `router.refresh()` (Phase 3 lock: required after non-redirecting actions to re-fetch the Server Component).
- All actions call `revalidatePath("/app/availability")` on success. Single shared constant `REVALIDATE` prevents drift.
- 23505 (`unique_violation`) and 23514 (`check_violation`) are gated on `error.code` per Phase 3 convention (the documented exception to "gate on error.status only").
- `saveWeeklyRulesAction` deletes-then-inserts. Empty `windows` array = closed weekday = delete only.
- `upsertDateOverrideAction` always deletes ALL rows for the date FIRST (RESEARCH Pitfall 5: enforces mutual exclusion). Block writes one row; custom_hours writes N rows.
- The `daily_cap` settings field is `null | number`; the Zod schema's transform converts `""` → `null`. No special server-side handling needed.

DO NOT:
- Do not call `redirect()` in any action — UI lifecycle handles navigation/refresh, NOT the action.
- Do not import from `@/lib/supabase/admin`.
- Do not use upsert (`onConflict`) for `availability_rules` — the per-row primary key is `id` (uuid), not `(account_id, day_of_week, start_minute)`. Delete-then-insert is the right shape.
- Do not write multi-row UPSERTs for `date_overrides` either — same reason; delete-all-first is simpler and matches the UI shape (one form save = one full date-state replace).
- Do not pass `FormData` — direct-call only (Phase 3 lock; structured TS objects).
- Do not validate the `override_date` against the account timezone here — the calendar widget (Plan 04-05) sends YYYY-MM-DD strings already in account-local format.
  </action>
  <verify>
```bash
ls "app/(shell)/app/availability/_lib/actions.ts"

# Server-only marker
head -1 "app/(shell)/app/availability/_lib/actions.ts" | grep -q '"use server"' && echo "use server ok"

# All 4 actions exported
grep -q "export async function saveAccountSettingsAction" "app/(shell)/app/availability/_lib/actions.ts" && echo "settings ok"
grep -q "export async function saveWeeklyRulesAction" "app/(shell)/app/availability/_lib/actions.ts" && echo "weekly ok"
grep -q "export async function upsertDateOverrideAction" "app/(shell)/app/availability/_lib/actions.ts" && echo "override upsert ok"
grep -q "export async function deleteDateOverrideAction" "app/(shell)/app/availability/_lib/actions.ts" && echo "override delete ok"

# State type exported
grep -q "export type AvailabilityActionState" "app/(shell)/app/availability/_lib/actions.ts" && echo "AvailabilityActionState ok"

# Load-bearing patterns
grep -q "current_owner_account_ids" "app/(shell)/app/availability/_lib/actions.ts" && echo "RPC ok"
grep -q 'revalidatePath\("/app/availability"\)' "app/(shell)/app/availability/_lib/actions.ts" && echo "revalidate ok"
grep -q '"23505"' "app/(shell)/app/availability/_lib/actions.ts" && echo "unique-violation gate ok"
grep -q '"23514"' "app/(shell)/app/availability/_lib/actions.ts" && echo "check-violation gate ok"

# No redirect, no admin
! grep -q "redirect(" "app/(shell)/app/availability/_lib/actions.ts" && echo "no redirect (good)"
! grep -q "@/lib/supabase/admin" "app/(shell)/app/availability/_lib/actions.ts" && echo "no admin client (good)"

npm run build
npm run lint
npm test
```
  </verify>
  <done>
`app/(shell)/app/availability/_lib/actions.ts` exists with `"use server"` at the top, exports `saveAccountSettingsAction`, `saveWeeklyRulesAction`, `upsertDateOverrideAction`, `deleteDateOverrideAction`, and `AvailabilityActionState`. All four actions: use `createClient()` (RLS-scoped), resolve account_id via `current_owner_account_ids`, validate input with the Zod schemas from Task 1, call `revalidatePath("/app/availability")` on success, gate DB constraint errors on `error.code === "23505" | "23514"`, do NOT redirect. `npm run build`, `npm run lint`, `npm test` all exit 0.

Commit: `feat(04-03): add availability Server Actions (settings, weekly rules, overrides)`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# All 4 module files present
ls "app/(shell)/app/availability/_lib/"{types,schema,queries,actions}.ts

# Build + lint clean
npm run build
npm run lint

# Existing test suite still green (no regression on auth, RLS, race, event-types, slot-engine)
npm test
```

No live action smoke test in this plan — actions have no UI consumer yet (Plans 04-04 + 04-05 build that). Type-check via `npm run build` is the verification that the action signatures + Zod schemas + loader compose correctly. The slot-engine tests from Plan 04-02 confirm the data shapes are slot-engine-compatible.
</verification>

<success_criteria>
- [ ] `app/(shell)/app/availability/_lib/types.ts` exports `DayOfWeek`, `TimeWindow`, `AccountSettingsRow`, `AvailabilityRuleRow`, `DateOverrideRow`, `DateOverrideInput`, `AvailabilityState`
- [ ] `app/(shell)/app/availability/_lib/schema.ts` exports `weeklyRulesSchema` (overlap-validating per-day windows array, allows empty), `dateOverrideSchema` (discriminated union over block/custom_hours with overlap validation), `accountSettingsSchema` (4 fields with bounds matching migration CHECK constraints), and inferred input types
- [ ] `app/(shell)/app/availability/_lib/queries.ts` starts with `import "server-only"`, exports `loadAvailabilityState(): Promise<AvailabilityState | null>` running 3 parallel SELECTs via `Promise.all`
- [ ] `app/(shell)/app/availability/_lib/actions.ts` is `"use server"`, exports `saveAccountSettingsAction`, `saveWeeklyRulesAction`, `upsertDateOverrideAction`, `deleteDateOverrideAction`, plus `AvailabilityActionState`
- [ ] All actions use `createClient()` from `@/lib/supabase/server` — NO admin client, NO `redirect()` calls
- [ ] All actions resolve `account_id` via `current_owner_account_ids` RPC and validate input via the Zod schemas from Task 1
- [ ] All actions call `revalidatePath("/app/availability")` on success
- [ ] `saveWeeklyRulesAction` deletes existing rows for `(account_id, day_of_week)` then bulk-inserts new windows (empty array → delete-only = closed weekday)
- [ ] `upsertDateOverrideAction` deletes ALL rows for `(account_id, override_date)` first, then inserts the new shape (Block = 1 row with is_closed=true, Custom hours = N rows with is_closed=false) — RESEARCH Pitfall 5 mutual exclusion
- [ ] DB constraint violations gated on `error.code === "23505"` (unique) and `"23514"` (check) per Phase 3 pattern
- [ ] Time-window overlap validation rejects with friendly HH:MM-formatted error message naming the conflicting pair
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Existing Vitest suite still green (no regression)
- [ ] Each task committed atomically (3 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/04-availability-engine/04-03-SUMMARY.md` documenting:
- Final shape of `AvailabilityActionState`, `WeeklyRulesInput`, `DateOverrideFormInput`, `AccountSettingsInput` (boundary contracts Plans 04-04 + 04-05 + 04-06 consume)
- Confirmed direct-call contract (Server Actions accept structured TS objects, NOT `FormData`) — Plans 04-04 + 04-05 honor
- Mutual-exclusion pattern for date_overrides: delete-all-for-date FIRST, then insert new shape (RESEARCH Pitfall 5 lock)
- Empty-windows-array semantics for weekly rules (= "Closed weekday" = delete-only)
- Decision to NOT use a transaction wrapper for the delete+insert pair (single-tenant v1 acceptable, document the failure mode)
- Any deviation from RESEARCH §3 (schema audit) or Phase 3 action-pattern conventions
</output>
