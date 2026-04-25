---
phase: 04-availability-engine
plan: 05
type: execute
wave: 3
depends_on: ["04-03", "04-04"]
files_modified:
  - app/(shell)/app/availability/page.tsx
  - app/(shell)/app/availability/_components/date-overrides-section.tsx
  - app/(shell)/app/availability/_components/overrides-calendar.tsx
  - app/(shell)/app/availability/_components/overrides-list.tsx
  - app/(shell)/app/availability/_components/override-modal.tsx
autonomous: true

must_haves:
  truths:
    - "DateOverridesSection client component renders the overrides surface: a calendar with red/blue dot markers showing override dates, a card-list view below the calendar showing all overrides as cards with date + type badge + summary, and an 'Add override' button that opens the OverrideModal with no preselected date (CONTEXT-locked: BOTH calendar AND list)"
    - "OverridesCalendar uses shadcn Calendar (react-day-picker v9 modifiers) with two CSS-class modifiers: 'day-blocked' (red dot, for is_closed=true rows) and 'day-custom' (blue dot, for custom-hours rows); clicking a dot-marked date opens the OverrideModal preloaded with that date's existing override (Edit mode); clicking an unmarked date opens the modal preloaded with that date in Add mode"
    - "OverridesList shows override entries as Cards: date (formatted in account timezone), type badge ('Blocked' / 'Custom hours'), summary text (windows formatted as HH:MM–HH:MM joined by commas, or 'All day' for blocked), Edit + Remove buttons; empty state copy when no overrides exist"
    - "OverrideModal is a shadcn Dialog with two tabs/modes (Block / Custom hours), date picker (read-only or editable depending on Add vs Edit), windows array editor (reuses TimeWindowPicker from Plan 04-04 — explicit cross-plan import), optional note field; saves via upsertDateOverrideAction (Block path or Custom hours path); deletes via deleteDateOverrideAction"
    - "Override always wins (CONTEXT lock): a Custom-hours override on a normally-Closed weekday OPENS that day for booking; the engine in Plan 04-02 already implements this — UI only needs to make it possible to save such an override"
    - "Mutual exclusion at the action layer (Plan 04-03 lock): saving Block deletes any custom-hours rows for the date; saving Custom hours deletes any Block row for the date — UI doesn't enforce this, the action does"
    - "page.tsx is patched to render <DateOverridesSection overrides={state.overrides} /> in the Date overrides section slot reserved by Plan 04-04 (replacing the placeholder paragraph)"
    - "After every successful CRUD on overrides, sonner toast fires (toast.success / toast.error); list refreshes via router.refresh() after revalidatePath in the action"
  artifacts:
    - path: "app/(shell)/app/availability/_components/date-overrides-section.tsx"
      provides: "Client component composing OverridesCalendar + OverridesList + OverrideModal; manages modal open state + selected date"
      contains: "use client"
      min_lines: 50
    - path: "app/(shell)/app/availability/_components/overrides-calendar.tsx"
      provides: "Client component — shadcn Calendar with modifiers/modifiersClassNames mapping override dates to .day-blocked or .day-custom"
      contains: "use client"
      min_lines: 40
    - path: "app/(shell)/app/availability/_components/overrides-list.tsx"
      provides: "Client component — list of Card entries; each card has Edit + Remove handlers; calls deleteDateOverrideAction on Remove"
      contains: "use client"
      min_lines: 50
    - path: "app/(shell)/app/availability/_components/override-modal.tsx"
      provides: "Client component — shadcn Dialog with Tabs (Block / Custom hours), windows editor (reuses TimeWindowPicker from Plan 04-04), note field, Save + Delete buttons; calls upsertDateOverrideAction on Save and deleteDateOverrideAction on Delete"
      contains: "use client"
      min_lines: 100
    - path: "app/(shell)/app/availability/page.tsx"
      provides: "Updated: imports DateOverridesSection and renders <DateOverridesSection overrides={state.overrides} /> in the Date overrides section (replacing the placeholder paragraph)"
      contains: "DateOverridesSection"
  key_links:
    - from: "app/(shell)/app/availability/_components/date-overrides-section.tsx"
      to: "app/(shell)/app/availability/_lib/actions.ts"
      via: "uses upsertDateOverrideAction + deleteDateOverrideAction (passed down via children)"
      pattern: "upsertDateOverrideAction|deleteDateOverrideAction"
    - from: "app/(shell)/app/availability/_components/overrides-calendar.tsx"
      to: "components/ui/calendar.tsx"
      via: "import { Calendar } from '@/components/ui/calendar' — passes modifiers + modifiersClassNames + onDayClick"
      pattern: "modifiers"
    - from: "app/(shell)/app/availability/_components/override-modal.tsx"
      to: "app/(shell)/app/availability/_components/time-window-picker.tsx"
      via: "imports + reuses TimeWindowPicker from Plan 04-04"
      pattern: "TimeWindowPicker"
    - from: "app/(shell)/app/availability/_components/overrides-list.tsx"
      to: "app/(shell)/app/availability/_lib/actions.ts"
      via: "imports deleteDateOverrideAction; calls it from per-row Remove button"
      pattern: "deleteDateOverrideAction"
    - from: "app/(shell)/app/availability/page.tsx"
      to: "app/(shell)/app/availability/_components/date-overrides-section.tsx"
      via: "uncomment import + replace placeholder paragraph"
      pattern: "DateOverridesSection"
---

<objective>
Ship the DATE OVERRIDES surface for `/app/availability`. Andrew can browse overrides on a calendar with at-a-glance markers (red = blocked, blue = custom hours), see the same overrides in a list view below, and add/edit/remove overrides through a modal that supports both Block and Custom hours modes. Plan 04-04 reserved a section slot for this; this plan fills it.

Purpose: Without overrides, Andrew can only set weekly recurring availability. The override surface is what lets him block one-off Sundays for vacation, or open a normally-closed Saturday for a specific date. CONTEXT-locked: BOTH calendar AND list view (calendar for at-a-glance scanning, list for management/sorting).

Output: Four new client components under `_components/` plus a 2-line patch to `page.tsx` (uncomment the import, replace the placeholder paragraph). Reuses `TimeWindowPicker` from Plan 04-04 — single source of truth for the time-window UX across weekly rules and date overrides.

Plan-level scoping: This plan does NOT modify the weekly editor, settings panel, queries, actions, schemas, or types. The four action surfaces it consumes (`upsertDateOverrideAction`, `deleteDateOverrideAction`, plus the shape of `DateOverrideRow` / `DateOverrideInput` / `dateOverrideSchema` from Plan 04-03) are stable contracts.

Coordination with Plan 04-04: 04-04 reserved an empty `<section aria-label="Date overrides">` slot in page.tsx with a placeholder paragraph and a commented-out import. This plan:
1. Creates `_components/date-overrides-section.tsx` and the three sub-components.
2. Edits page.tsx in EXACTLY two places: uncomment the import line; replace the placeholder paragraph with `<DateOverridesSection overrides={state.overrides} />`. No other page.tsx changes.

This minimal page.tsx surgery means 04-04 and 04-05 can be reviewed/merged independently.
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
@.planning/phases/04-availability-engine/04-03-SUMMARY.md
@.planning/phases/04-availability-engine/04-04-SUMMARY.md

# Plan 04-03 actions/schema/types this plan consumes
@app/(shell)/app/availability/_lib/actions.ts
@app/(shell)/app/availability/_lib/schema.ts
@app/(shell)/app/availability/_lib/types.ts

# Plan 04-04 page.tsx (we patch this) and TimeWindowPicker (we reuse)
@app/(shell)/app/availability/page.tsx
@app/(shell)/app/availability/_components/time-window-picker.tsx

# Existing UI primitives (Calendar from Plan 04-01, plus standard shadcn)
@components/ui/calendar.tsx
@components/ui/dialog.tsx
@components/ui/card.tsx
@components/ui/badge.tsx
@components/ui/button.tsx
@components/ui/input.tsx
@components/ui/label.tsx
@components/ui/textarea.tsx
@app/globals.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: OverridesCalendar with red/blue dot markers</name>
  <files>app/(shell)/app/availability/_components/overrides-calendar.tsx</files>
  <action>
Build the calendar view that highlights override dates with marker dots.

```tsx
"use client";

import { useMemo } from "react";

import { Calendar } from "@/components/ui/calendar";

import type { DateOverrideRow } from "../_lib/types";

export interface OverridesCalendarProps {
  overrides: DateOverrideRow[];
  /** Called when user clicks any date — caller decides Add vs Edit based on whether the date already has an override. */
  onDayClick: (localDate: string) => void;
}

/** Parse "YYYY-MM-DD" into a local-midnight Date (browser TZ acceptable here —
 *  this is purely for the visual calendar; the Date never goes back to the
 *  server. The string identity is what's authoritative). */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a clicked Date back to "YYYY-MM-DD" using the LOCAL clock fields. */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export function OverridesCalendar({ overrides, onDayClick }: OverridesCalendarProps) {
  const { blockedDates, customHoursDates } = useMemo(() => {
    const blocked: Date[] = [];
    const custom: Date[] = [];
    const seen = new Set<string>();
    for (const o of overrides) {
      // Mutual-exclusion lock from Plan 04-03 means a date should never have
      // both a is_closed row AND a custom-hours row, but if it does, the
      // engine treats it as blocked (Plan 04-02 lock). Mirror that here:
      // is_closed wins for the marker.
      if (seen.has(o.override_date)) continue;
      if (o.is_closed) {
        seen.add(o.override_date);
        blocked.push(parseLocalDate(o.override_date));
      } else {
        seen.add(o.override_date);
        custom.push(parseLocalDate(o.override_date));
      }
    }
    return { blockedDates: blocked, customHoursDates: custom };
  }, [overrides]);

  return (
    <Calendar
      mode="single"
      modifiers={{
        blocked: blockedDates,
        customHours: customHoursDates,
      }}
      modifiersClassNames={{
        blocked: "day-blocked",
        customHours: "day-custom",
      }}
      onDayClick={(day) => onDayClick(formatLocalDate(day))}
      className="rounded-md border"
    />
  );
}
```

Key rules:
- File starts with `"use client"`.
- Reads override rows; groups them into `blocked: Date[]` and `customHours: Date[]` arrays based on `is_closed`. Mutual-exclusion: if both exist for a date (defensive for the bug case), `is_closed` wins for the marker (mirrors the Plan 04-02 engine).
- Passes `modifiers` + `modifiersClassNames` to the shadcn `Calendar`. The CSS classes `.day-blocked` and `.day-custom` were added to `app/globals.css` in Plan 04-01 — they paint the colored dots via `::after` pseudo-elements.
- `onDayClick` callback receives a `Date`; we format it back to `YYYY-MM-DD` using local clock fields and pass the string upstream. The string is what the action accepts.
- Uses `mode="single"` — react-day-picker shows a single-month view; users can scroll forward/back via the built-in navigation arrows. Multi-month is overkill for v1.
- Date parsing intentionally uses local browser TZ (`new Date(y, m-1, d)`) rather than account TZ. The calendar's purpose is purely to MARK which dates have overrides; the underlying string identity (`override_date` is YYYY-MM-DD in account-local) is what the action receives. This is a known acceptable simplification — at midnight in some other browser TZ, a date could appear shifted by ±1 day on the marker, but the string passed to the action remains correct.

DO NOT:
- Do not use a different calendar library — RESEARCH §4 confirmed shadcn Calendar (react-day-picker v9) is the canonical choice.
- Do not parse `override_date` through TZDate or `@date-fns/tz` here — that's overkill for visual markers and adds a complex dep on `account.timezone` to be threaded through.
- Do not handle Edit-vs-Add distinction here. The parent (`DateOverridesSection`) decides what the click means based on whether the date has an existing override.
- Do not show event blocks or time-windows on the calendar — RESEARCH §"Specific Ideas": "think Google Calendar with colored dots, NOT a full event-block visualization."
  </action>
  <verify>
```bash
ls "app/(shell)/app/availability/_components/overrides-calendar.tsx"
head -1 "app/(shell)/app/availability/_components/overrides-calendar.tsx" | grep -q '"use client"' && echo "use client ok"

# Modifiers wired
grep -q 'modifiers=' "app/(shell)/app/availability/_components/overrides-calendar.tsx" && echo "modifiers ok"
grep -q 'modifiersClassNames' "app/(shell)/app/availability/_components/overrides-calendar.tsx" && echo "classNames ok"
grep -q '"day-blocked"' "app/(shell)/app/availability/_components/overrides-calendar.tsx" && echo "blocked class ok"
grep -q '"day-custom"' "app/(shell)/app/availability/_components/overrides-calendar.tsx" && echo "custom class ok"
grep -q "onDayClick" "app/(shell)/app/availability/_components/overrides-calendar.tsx" && echo "click handler ok"

npm run build
```
  </verify>
  <done>
`overrides-calendar.tsx` is a client component, renders shadcn `<Calendar mode="single">`, derives `blocked: Date[]` and `customHours: Date[]` from override rows, passes those via `modifiers` + `modifiersClassNames={{ blocked: "day-blocked", customHours: "day-custom" }}`, and forwards date clicks to the parent as YYYY-MM-DD strings. `npm run build` exits 0.

Commit: `feat(04-05): add overrides calendar with red/blue dot markers`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: OverridesList card-view + OverrideModal with Block/Custom-hours tabs</name>
  <files>app/(shell)/app/availability/_components/overrides-list.tsx, app/(shell)/app/availability/_components/override-modal.tsx</files>
  <action>
Build the list view (card per override) and the modal that handles Add/Edit/Delete.

**File 1 — `app/(shell)/app/availability/_components/overrides-list.tsx`:**

```tsx
"use client";

import { useMemo, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { deleteDateOverrideAction } from "../_lib/actions";
import type { DateOverrideRow } from "../_lib/types";

export interface OverridesListProps {
  overrides: DateOverrideRow[];
  onEdit: (override_date: string) => void;
}

interface GroupedOverride {
  override_date: string;
  is_closed: boolean;
  windows: Array<{ start_minute: number; end_minute: number }>;
  note: string | null;
}

function groupOverrides(rows: DateOverrideRow[]): GroupedOverride[] {
  const map = new Map<string, GroupedOverride>();
  for (const r of rows) {
    const existing = map.get(r.override_date);
    if (!existing) {
      map.set(r.override_date, {
        override_date: r.override_date,
        is_closed: r.is_closed,
        windows: r.is_closed
          ? []
          : r.start_minute !== null && r.end_minute !== null
            ? [{ start_minute: r.start_minute, end_minute: r.end_minute }]
            : [],
        note: r.note,
      });
    } else if (!r.is_closed && r.start_minute !== null && r.end_minute !== null) {
      existing.windows.push({
        start_minute: r.start_minute,
        end_minute: r.end_minute,
      });
    }
  }
  // Sort by date ascending; sort each group's windows by start_minute.
  const out = Array.from(map.values());
  out.sort((a, b) => (a.override_date < b.override_date ? -1 : 1));
  for (const g of out) g.windows.sort((a, b) => a.start_minute - b.start_minute);
  return out;
}

function minutesToHHMM(m: number): string {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDate(s: string): string {
  // s = "YYYY-MM-DD" — render as e.g. "Sun, Mar 8, 2026" using local TZ.
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function OverridesList({ overrides, onEdit }: OverridesListProps) {
  const grouped = useMemo(() => groupOverrides(overrides), [overrides]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRemove(override_date: string) {
    startTransition(async () => {
      const result = await deleteDateOverrideAction(override_date);
      if (result.formError) {
        toast.error(result.formError);
        return;
      }
      toast.success("Override removed.");
      router.refresh();
    });
  }

  if (grouped.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No date overrides yet. Use the calendar above or click &ldquo;Add override&rdquo;.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {grouped.map((g) => (
        <Card key={g.override_date}>
          <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="font-medium">{formatDate(g.override_date)}</span>
              {g.is_closed ? (
                <Badge variant="destructive">Blocked</Badge>
              ) : (
                <Badge variant="secondary">Custom hours</Badge>
              )}
              <span className="text-muted-foreground text-sm">
                {g.is_closed
                  ? "All day"
                  : g.windows
                      .map(
                        (w) =>
                          `${minutesToHHMM(w.start_minute)}–${minutesToHHMM(w.end_minute)}`,
                      )
                      .join(", ")}
              </span>
              {g.note && (
                <span className="text-muted-foreground truncate text-xs">
                  {g.note}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(g.override_date)}
                disabled={isPending}
              >
                <Pencil className="mr-1 size-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(g.override_date)}
                disabled={isPending}
                aria-label={`Remove override for ${formatDate(g.override_date)}`}
              >
                <Trash2 className="mr-1 size-3.5" />
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**File 2 — `app/(shell)/app/availability/_components/override-modal.tsx`:**

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  upsertDateOverrideAction,
  deleteDateOverrideAction,
} from "../_lib/actions";
import type { DateOverrideRow, TimeWindow } from "../_lib/types";

import { TimeWindowPicker } from "./time-window-picker";

export interface OverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "YYYY-MM-DD" — the date the user clicked, or null when adding without a date pre-selected */
  initialDate: string | null;
  /** All existing override rows for this account (used to seed Edit mode) */
  allOverrides: DateOverrideRow[];
}

const DEFAULT_WINDOW: TimeWindow = { start_minute: 540, end_minute: 1020 };

type Mode = "block" | "custom_hours";

function existingFor(
  allOverrides: DateOverrideRow[],
  date: string,
): { mode: Mode; windows: TimeWindow[]; note: string } | null {
  const rows = allOverrides.filter((o) => o.override_date === date);
  if (rows.length === 0) return null;
  const blocked = rows.find((r) => r.is_closed);
  if (blocked) {
    return { mode: "block", windows: [], note: blocked.note ?? "" };
  }
  const windows = rows
    .filter((r) => r.start_minute !== null && r.end_minute !== null)
    .map((r) => ({
      start_minute: r.start_minute as number,
      end_minute: r.end_minute as number,
    }))
    .sort((a, b) => a.start_minute - b.start_minute);
  return { mode: "custom_hours", windows, note: rows[0].note ?? "" };
}

export function OverrideModal({
  open,
  onOpenChange,
  initialDate,
  allOverrides,
}: OverrideModalProps) {
  const router = useRouter();

  const [date, setDate] = useState<string>("");
  const [mode, setMode] = useState<Mode>("block");
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-seed state every time the modal opens (initialDate may change).
  useEffect(() => {
    if (!open) return;
    const seedDate = initialDate ?? "";
    setDate(seedDate);
    setError(null);
    if (seedDate) {
      const existing = existingFor(allOverrides, seedDate);
      if (existing) {
        setMode(existing.mode);
        setWindows(existing.windows);
        setNote(existing.note);
      } else {
        setMode("block");
        setWindows([{ ...DEFAULT_WINDOW }]);
        setNote("");
      }
    } else {
      setMode("block");
      setWindows([{ ...DEFAULT_WINDOW }]);
      setNote("");
    }
  }, [open, initialDate, allOverrides]);

  const isEdit = !!(date && existingFor(allOverrides, date));

  function save() {
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Pick a valid date.");
      return;
    }

    startTransition(async () => {
      const payload =
        mode === "block"
          ? { type: "block" as const, override_date: date, note: note || undefined }
          : {
              type: "custom_hours" as const,
              override_date: date,
              windows,
              note: note || undefined,
            };

      const result = await upsertDateOverrideAction(payload);
      if (result.formError) {
        toast.error(result.formError);
        setError(result.formError);
        return;
      }
      if (result.fieldErrors?.windows?.[0]) {
        toast.error(result.fieldErrors.windows[0]);
        setError(result.fieldErrors.windows[0]);
        return;
      }
      toast.success(isEdit ? "Override updated." : "Override added.");
      router.refresh();
      onOpenChange(false);
    });
  }

  function remove() {
    if (!isEdit) return;
    startTransition(async () => {
      const result = await deleteDateOverrideAction(date);
      if (result.formError) {
        toast.error(result.formError);
        return;
      }
      toast.success("Override removed.");
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit override" : "Add override"}</DialogTitle>
          <DialogDescription>
            Block a specific day or replace its hours just for that date.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-date">Date</Label>
            <Input
              id="override-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isPending || isEdit}
            />
            {isEdit && (
              <p className="text-muted-foreground text-xs">
                To change the date, remove this override and add a new one.
              </p>
            )}
          </div>

          {/* Mode tabs implemented as two buttons (no shadcn Tabs primitive
              available without extra install; two-button toggle is sufficient). */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "block" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("block")}
              disabled={isPending}
            >
              Block this day
            </Button>
            <Button
              type="button"
              variant={mode === "custom_hours" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode("custom_hours");
                if (windows.length === 0) setWindows([{ ...DEFAULT_WINDOW }]);
              }}
              disabled={isPending}
            >
              Custom hours
            </Button>
          </div>

          {mode === "custom_hours" && (
            <div className="flex flex-col gap-2">
              <Label>Time windows</Label>
              {windows.map((w, i) => (
                <TimeWindowPicker
                  key={i}
                  start_minute={w.start_minute}
                  end_minute={w.end_minute}
                  onChange={(next) =>
                    setWindows((prev) =>
                      prev.map((x, j) => (j === i ? next : x)),
                    )
                  }
                  onRemove={
                    windows.length > 1
                      ? () => setWindows((prev) => prev.filter((_, j) => j !== i))
                      : undefined
                  }
                  disabled={isPending}
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setWindows((prev) => [...prev, { ...DEFAULT_WINDOW }])}
                disabled={isPending}
              >
                <Plus className="mr-2 size-4" />
                Add window
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-note">Note (optional)</Label>
            <Textarea
              id="override-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="e.g. Vacation, Trade show"
              disabled={isPending}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {isEdit ? (
            <Button type="button" variant="ghost" onClick={remove} disabled={isPending}>
              Remove override
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Update" : "Add override"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Key rules:
- Both files start with `"use client"`.
- `OverridesList` groups DB rows by `override_date` (multiple windows per date = same card with comma-separated time strings). Empty state copy when no overrides exist.
- Card per date with: formatted date (using browser locale for friendliness), badge (`destructive` for Blocked, `secondary` for Custom hours), summary line, optional note, Edit + Remove buttons.
- `OverrideModal`:
  - Single Dialog handling Add (no `initialDate` match in `allOverrides`) and Edit (date matches an existing override).
  - Two-button mode toggle (Block / Custom hours) instead of shadcn Tabs (Tabs isn't installed; saving the install since two buttons are sufficient and avoid an extra dep).
  - When mode = `block`: only the date + optional note. No windows shown.
  - When mode = `custom_hours`: windows array editor (reuses `TimeWindowPicker` from Plan 04-04). Add window button.
  - Edit mode: date input is disabled (changing date = remove + add); shows a "Remove override" button in the footer.
  - Saves via `upsertDateOverrideAction(payload)` with the discriminated-union payload shape. The action handles mutual exclusion (delete-all-first per Plan 04-03 lock).
  - Deletes via `deleteDateOverrideAction(date)`.
  - Reseeds form state every time `open` flips true (the user might click a different date right after closing/opening).
- Mutual exclusion is the ACTION's responsibility (Plan 04-03 lock). UI just sends the new payload.

DO NOT:
- Do not add a shadcn Tabs install — use two Buttons. Keeps shadcn surface area small.
- Do not reuse the weekly editor's TimeWindowPicker by importing it from a relative path that crosses package boundaries — it's in the same `_components/` folder, sibling import is fine.
- Do not allow editing the date in Edit mode. Forcing remove+add for date changes prevents complex orphan-row bugs (the `delete-all-for-date` semantic only works if the date stays the same).
- Do not validate windows client-side — the Zod schema in Plan 04-03 does that server-side. UI surfaces `result.fieldErrors.windows[0]` inline.
- Do not nest the delete confirmation inside the modal as a sub-Dialog — RESEARCH Open Q3 + STATE.md "RestoreCollisionDialog: standalone Dialog, not nested" decision applies. The Remove button here calls `deleteDateOverrideAction` directly and closes the modal on success. If a confirm step is needed in v1, add a sonner toast with an Undo action or a top-level AlertDialog — NOT a nested Dialog.
  </action>
  <verify>
```bash
ls "app/(shell)/app/availability/_components/overrides-list.tsx" "app/(shell)/app/availability/_components/override-modal.tsx"

# Both client components
head -1 "app/(shell)/app/availability/_components/overrides-list.tsx" | grep -q '"use client"' && echo "list use client ok"
head -1 "app/(shell)/app/availability/_components/override-modal.tsx" | grep -q '"use client"' && echo "modal use client ok"

# Load-bearing patterns — list
grep -q "deleteDateOverrideAction" "app/(shell)/app/availability/_components/overrides-list.tsx" && echo "delete wired"
grep -q "Badge" "app/(shell)/app/availability/_components/overrides-list.tsx" && echo "badge ok"

# Load-bearing patterns — modal
grep -q "upsertDateOverrideAction" "app/(shell)/app/availability/_components/override-modal.tsx" && echo "upsert wired"
grep -q "deleteDateOverrideAction" "app/(shell)/app/availability/_components/override-modal.tsx" && echo "delete wired"
grep -q "TimeWindowPicker" "app/(shell)/app/availability/_components/override-modal.tsx" && echo "picker reused"
grep -q '"block"' "app/(shell)/app/availability/_components/override-modal.tsx" && grep -q '"custom_hours"' "app/(shell)/app/availability/_components/override-modal.tsx" && echo "two modes ok"

npm run build
npm run lint
```
  </verify>
  <done>
`overrides-list.tsx` is a client component rendering one Card per override (grouped by date), with badge variants for Blocked vs Custom hours, summary text (windows joined by commas, or "All day"), Edit + Remove buttons; Remove calls `deleteDateOverrideAction` inside `useTransition` with toast + router.refresh. `override-modal.tsx` is a client component shadcn Dialog supporting Add + Edit modes with two-button mode toggle (Block / Custom hours), date input (disabled in Edit mode), windows editor reusing TimeWindowPicker, optional note Textarea, Save + Cancel + Remove (Edit only) actions; Save calls `upsertDateOverrideAction`. `npm run build` + `npm run lint` exit 0.

Commit: `feat(04-05): add overrides list and override modal (block/custom-hours)`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: DateOverridesSection composition + page.tsx 2-line patch</name>
  <files>app/(shell)/app/availability/_components/date-overrides-section.tsx, app/(shell)/app/availability/page.tsx</files>
  <action>
Build the composition component that wires calendar + list + modal together, and patch page.tsx to render it.

**File 1 — `app/(shell)/app/availability/_components/date-overrides-section.tsx`:**

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { DateOverrideRow } from "../_lib/types";

import { OverridesCalendar } from "./overrides-calendar";
import { OverridesList } from "./overrides-list";
import { OverrideModal } from "./override-modal";

export interface DateOverridesSectionProps {
  overrides: DateOverrideRow[];
}

export function DateOverridesSection({ overrides }: DateOverridesSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function openForDate(date: string) {
    setSelectedDate(date);
    setModalOpen(true);
  }

  function openForAdd() {
    setSelectedDate(null);
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={openForAdd}>
          <Plus className="mr-2 size-4" />
          Add override
        </Button>
      </div>

      <OverridesCalendar overrides={overrides} onDayClick={openForDate} />

      <OverridesList overrides={overrides} onEdit={openForDate} />

      <OverrideModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialDate={selectedDate}
        allOverrides={overrides}
      />
    </div>
  );
}
```

**File 2 — `app/(shell)/app/availability/page.tsx` (patch):**

Edit the existing page.tsx (Plan 04-04) in EXACTLY two places:

1. **Uncomment the import line** at the top:
   ```diff
   - // import { DateOverridesSection } from "./_components/date-overrides-section";
   + import { DateOverridesSection } from "./_components/date-overrides-section";
   ```

2. **Replace the placeholder paragraph** in the Date overrides section:
   ```diff
   <section aria-label="Date overrides">
     <h2 className="mb-4 text-lg font-medium">Date overrides</h2>
   - {/* Plan 04-05 will replace this comment with <DateOverridesSection
   -     overrides={state.overrides} />. Until then we render an
   -     "empty placeholder" so the page is shippable as-is. */}
   - <p className="text-muted-foreground text-sm">
   -   Date-specific overrides will appear here.
   - </p>
   + <DateOverridesSection overrides={state.overrides} />
   </section>
   ```

NO other changes to page.tsx. The header, weekly section, separator, settings section all stay byte-identical.

Key rules:
- `DateOverridesSection` starts with `"use client"`.
- Holds two pieces of state: `modalOpen` boolean + `selectedDate` (null = Add mode, string = Edit/Add-with-date mode).
- Three subcomponents wired:
  - `OverridesCalendar` — `onDayClick={openForDate}` (open modal pre-filled with that date).
  - `OverridesList` — `onEdit={openForDate}` (same handler — Edit means pre-fill date, modal infers Edit mode by checking allOverrides).
  - `OverrideModal` — controlled by `modalOpen` + `setModalOpen`; receives `initialDate` (null or string) and the full `allOverrides` array (so it can detect Edit mode and seed initial form state).
- "Add override" button at the top — `selectedDate=null` opens the modal in pure Add mode where the user picks a date manually.
- Page.tsx patch is surgical: uncomment 1 line, replace ~5 lines with 1 line. Total diff: 2 hunks.

DO NOT:
- Do not move state into the calendar or list — keep it lifted into `DateOverridesSection` so all three subcomponents stay focused.
- Do not pass action functions as props — each subcomponent imports its own actions directly. (Phase 3 pattern: kebab → DropdownMenuItem onClick → action call. We're following that.)
- Do not modify any other section of page.tsx (header, weekly section, settings section). The 2-line patch is the entire scope.
- Do not delete the placeholder paragraph if you forget the import line — both edits are required to ship the section.
  </action>
  <verify>
```bash
ls "app/(shell)/app/availability/_components/date-overrides-section.tsx"

# Section is a client component composing the three pieces
head -1 "app/(shell)/app/availability/_components/date-overrides-section.tsx" | grep -q '"use client"' && echo "use client ok"
grep -q "OverridesCalendar" "app/(shell)/app/availability/_components/date-overrides-section.tsx" && echo "calendar imported"
grep -q "OverridesList" "app/(shell)/app/availability/_components/date-overrides-section.tsx" && echo "list imported"
grep -q "OverrideModal" "app/(shell)/app/availability/_components/date-overrides-section.tsx" && echo "modal imported"

# page.tsx patched correctly
grep -q "DateOverridesSection" "app/(shell)/app/availability/page.tsx" && echo "section imported in page"
grep -q "<DateOverridesSection" "app/(shell)/app/availability/page.tsx" && echo "section rendered in page"
# placeholder paragraph removed
! grep -q "Date-specific overrides will appear here" "app/(shell)/app/availability/page.tsx" && echo "placeholder removed"
# import uncommented
! grep -q "// import { DateOverridesSection }" "app/(shell)/app/availability/page.tsx" && echo "import uncommented"

npm run build
npm run lint
npm test
```
  </verify>
  <done>
`date-overrides-section.tsx` is a client component composing `OverridesCalendar` + `OverridesList` + `OverrideModal`, manages `modalOpen` + `selectedDate` state, and wires day-click + edit-click + add-click handlers. `page.tsx` was edited in exactly two places: import line uncommented, placeholder paragraph replaced with `<DateOverridesSection overrides={state.overrides} />`. `npm run build` + `npm run lint` + `npm test` all exit 0.

Commit: `feat(04-05): wire date overrides section into availability page`. Push.

Final smoke test (user-runnable on Vercel after push):
- Visit `/app/availability` while logged in
- Date overrides section renders below weekly editor and above settings
- Calendar shows current month with no markers (no overrides yet)
- Click "Add override" → modal opens with today's date, "Block this day" tab active
- Switch to Custom hours → window editor appears with default 9-17 window
- Enter date 2026-12-25, switch to Block, optional note "Christmas", click "Add override" → toast.success, modal closes, calendar shows red dot on Dec 25, list card appears
- Click red dot on calendar → modal opens in Edit mode preloaded with Block + Christmas note
- Click "Remove override" → toast, modal closes, dot disappears, list card removed
- Add a Custom hours override on a Sunday (normally closed weekday) — confirm it persists; the engine in Plan 04-02 will treat it as opening that Sunday
  </done>
</task>

</tasks>

<verification>
```bash
# All Plan 04-05 files present
ls "app/(shell)/app/availability/_components/"{date-overrides-section,overrides-calendar,overrides-list,override-modal}.tsx

# page.tsx patched
grep -q "<DateOverridesSection" "app/(shell)/app/availability/page.tsx"

# Build + lint + tests
npm run build
npm run lint
npm test
```

This plan is UI-only — no new Vitest tests. Verification is the user smoke test on the live deployment after push.
</verification>

<success_criteria>
- [ ] `OverridesCalendar` renders shadcn Calendar with `modifiers: { blocked: Date[], customHours: Date[] }` and `modifiersClassNames: { blocked: "day-blocked", customHours: "day-custom" }` — red/blue dots appear on override dates
- [ ] Clicking any date on the calendar fires `onDayClick(yyyymmdd)` which opens the modal pre-filled with that date
- [ ] `OverridesList` groups DB rows by `override_date`; renders one Card per date with formatted date, type Badge (Blocked / Custom hours), summary (windows joined by commas, or "All day"), optional note, Edit + Remove buttons
- [ ] List Empty state copy when no overrides exist
- [ ] Remove button calls `deleteDateOverrideAction(date)` inside `useTransition`; success → toast + router.refresh
- [ ] `OverrideModal` is a shadcn Dialog with: date input (disabled in Edit mode), two-button mode toggle (Block / Custom hours), window editor (reuses TimeWindowPicker from Plan 04-04 — sibling import), optional note Textarea, Save + Cancel buttons, plus Remove button in Edit mode
- [ ] Save calls `upsertDateOverrideAction(payload)` with discriminated union shape (`{type: "block", ...}` or `{type: "custom_hours", windows: [...], ...}`); success → toast + router.refresh + close modal
- [ ] Edit mode detected by checking if `initialDate` matches an existing override in `allOverrides`; on detect, modal seeds form state from existing rows
- [ ] `DateOverridesSection` composes calendar + list + modal, manages `modalOpen` + `selectedDate` state, wires three click handlers (calendar day, list edit, "Add override" button)
- [ ] page.tsx patched in exactly two places: import uncommented, placeholder paragraph replaced with `<DateOverridesSection overrides={state.overrides} />`
- [ ] Override always wins (CONTEXT lock) is preserved end-to-end: a custom-hours override saved on a Closed weekday, when read by the slot engine, opens that day for booking
- [ ] No nested Dialogs; no shadcn Tabs install; no `formatInTimeZone`; no admin-client import; no raw Date math touching slot generation paths
- [ ] `npm run build` + `npm run lint` + `npm test` exit 0
- [ ] Each task committed atomically (3 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/04-availability-engine/04-05-SUMMARY.md` documenting:
- Final 2-line patch to page.tsx (import uncommented; placeholder paragraph replaced with `<DateOverridesSection overrides={state.overrides} />`)
- Confirmed reuse of TimeWindowPicker from Plan 04-04 via sibling import (single source of truth for time-window UX)
- Decision to use two-button mode toggle instead of installing shadcn Tabs (rationale: small surface area; Tabs would add ~80 LOC for a 2-option choice)
- Decision to disable date input in Edit mode (rationale: simpler delete-all-for-date semantic; explicit remove+add for date changes)
- Calendar local-TZ vs account-TZ tradeoff for marker rendering (acceptable simplification documented)
- Mutual-exclusion responsibility: actions enforce, UI just sends payloads
- Any deviation from CONTEXT decisions or RESEARCH §4 recommendations
</output>
