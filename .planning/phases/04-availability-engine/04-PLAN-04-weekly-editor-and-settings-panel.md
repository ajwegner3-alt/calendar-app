---
phase: 04-availability-engine
plan: 04
type: execute
wave: 3
depends_on: ["04-03"]
files_modified:
  - app/(shell)/app/availability/page.tsx
  - app/(shell)/app/availability/loading.tsx
  - app/(shell)/app/availability/_components/availability-empty-banner.tsx
  - app/(shell)/app/availability/_components/weekly-rules-editor.tsx
  - app/(shell)/app/availability/_components/weekday-row.tsx
  - app/(shell)/app/availability/_components/time-window-picker.tsx
  - app/(shell)/app/availability/_components/copy-from-menu.tsx
  - app/(shell)/app/availability/_components/settings-panel.tsx
autonomous: true

must_haves:
  truths:
    - "Andrew visits /app/availability and sees a single page laid out as: empty-banner (if no rules yet), weekly editor section, [overrides section placeholder owned by Plan 04-05], settings panel section — in that vertical order (CONTEXT-locked)"
    - "Weekly editor renders 7 rows (Sun-Mon-Tue-Wed-Thu-Fri-Sat per Postgres dow=0..6 → display order Mon-first is OK as a UX preference, but data still uses 0=Sun) with: weekday name, Open/Closed Switch, multiple time-window pickers stacked, '+ Add window' button, 'Copy from →' DropdownMenu (CONTEXT-locked layout)"
    - "Open/Closed Switch: Closed = no rules persist (saveWeeklyRulesAction gets empty windows = DELETE only); Open with no windows = adds a default 9:00-17:00 window so the row has something to save"
    - "TimeWindowPicker uses native <input type='time'> rendering HH:MM (RESEARCH §6 recommendation); converts HH:MM ↔ minutes-since-midnight via simple split + multiply"
    - "Copy from menu lists the OTHER 6 weekdays; selecting one replaces the current row's windows array (in form state — not yet saved) with the source day's windows; user must click Save to persist"
    - "Saving a weekday row calls saveWeeklyRulesAction({day_of_week, windows}) directly (NOT via <form action>); on success: sonner toast.success + router.refresh(); on error: toast.error or fieldErrors surfaced inline"
    - "Settings panel renders 4 plain <input type='number'> fields + unit labels: 'Buffer (minutes)' default 0, 'Min notice (hours)' default 24, 'Max advance (days)' default 14, 'Daily cap (bookings/day, leave empty for none)' nullable; saves via saveAccountSettingsAction"
    - "Empty-state banner shows above the editor when account has zero availability_rules rows AND zero date_overrides rows: 'You haven't set availability yet — bookings cannot be made until you do.' (CONTEXT-locked copy intent)"
    - "loading.tsx renders a skeleton matching the page layout (7 weekday-row skeletons + settings input skeletons) while the Server Component is fetching"
  artifacts:
    - path: "app/(shell)/app/availability/page.tsx"
      provides: "Server Component — calls loadAvailabilityState(), redirects to / if null (unlinked), renders empty banner + WeeklyRulesEditor + (placeholder) + SettingsPanel"
      contains: "loadAvailabilityState"
      min_lines: 30
    - path: "app/(shell)/app/availability/loading.tsx"
      provides: "Skeleton page matching layout (7 weekday rows + 4 settings inputs)"
      min_lines: 20
    - path: "app/(shell)/app/availability/_components/availability-empty-banner.tsx"
      provides: "Pure component — shadcn Alert variant warning with CONTEXT-locked copy"
      min_lines: 10
    - path: "app/(shell)/app/availability/_components/weekly-rules-editor.tsx"
      provides: "Client component — renders 7 WeekdayRow children, holds top-level form state, exposes 'all rows' shape so Copy-from can read sibling rows"
      contains: "use client"
      min_lines: 40
    - path: "app/(shell)/app/availability/_components/weekday-row.tsx"
      provides: "Client component — single weekday row: Switch + windows + Add button + Copy menu + Save button; calls saveWeeklyRulesAction on save"
      contains: "use client"
      min_lines: 80
    - path: "app/(shell)/app/availability/_components/time-window-picker.tsx"
      provides: "Pure client component — pair of <input type='time'> for start/end, exposes onChange with minutes-since-midnight values"
      contains: "use client"
      min_lines: 30
    - path: "app/(shell)/app/availability/_components/copy-from-menu.tsx"
      provides: "Client component — DropdownMenu listing 6 other weekdays, callback fires with selected day's windows"
      contains: "use client"
      min_lines: 30
    - path: "app/(shell)/app/availability/_components/settings-panel.tsx"
      provides: "Client component — 4 number inputs + Save button; calls saveAccountSettingsAction"
      contains: "use client"
      min_lines: 50
  key_links:
    - from: "app/(shell)/app/availability/page.tsx"
      to: "app/(shell)/app/availability/_lib/queries.ts"
      via: "imports loadAvailabilityState"
      pattern: "loadAvailabilityState"
    - from: "app/(shell)/app/availability/_components/weekday-row.tsx"
      to: "app/(shell)/app/availability/_lib/actions.ts"
      via: "imports saveWeeklyRulesAction; calls await saveWeeklyRulesAction({day_of_week, windows})"
      pattern: "saveWeeklyRulesAction"
    - from: "app/(shell)/app/availability/_components/settings-panel.tsx"
      to: "app/(shell)/app/availability/_lib/actions.ts"
      via: "imports saveAccountSettingsAction"
      pattern: "saveAccountSettingsAction"
    - from: "app/(shell)/app/availability/_components/weekday-row.tsx"
      to: "sonner toast"
      via: "import { toast } from 'sonner'"
      pattern: "toast\\.(success|error)"
---

<objective>
Ship the WEEKLY EDITOR + SETTINGS PANEL UI for Phase 4. Andrew opens `/app/availability`, sees an empty-state banner (if applicable), edits per-weekday open/closed + time windows with a Calendly-style row layout, and configures the four global settings at the bottom of the page. The page is a Server Component that loads initial state via `loadAvailabilityState()` (Plan 04-03) and renders client components for editing.

Purpose: Replaces the Phase 2 stub at `/app/availability` with the production weekly editor + settings panel. Plan 04-05 owns the date-overrides surface (calendar + list + modal) — this plan leaves a SECTION SLOT in the page layout that 04-05 fills in. Both plans run in Wave 3 in parallel; their files don't overlap.

Output: A working `/app/availability` page Andrew can use to (a) toggle each weekday Open/Closed, (b) add/remove/edit time windows per weekday, (c) Copy from another day, and (d) save the four global settings.

Plan-level scoping: This plan does NOT build the calendar/overrides UI — Plan 04-05 owns those components. The page layout reserves a slot (a `<DateOverridesSection />` import that Plan 04-05 ships); we render a placeholder `<section />` here so the visual layout is correct without 04-05 needing to merge into our files.

Coordination with Plan 04-05: file ownership is exclusive — 04-04 owns `weekly-rules-editor.tsx`, `weekday-row.tsx`, `time-window-picker.tsx`, `copy-from-menu.tsx`, `settings-panel.tsx`, `availability-empty-banner.tsx`. 04-05 owns `date-overrides-section.tsx`, `overrides-calendar.tsx`, `overrides-list.tsx`, `override-modal.tsx`. The `page.tsx` references both subtrees but is owned by 04-04 (since 04-04 lands first or simultaneously; 04-05 patches in a single import line during its own work — the imports table below documents the contract).
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

# Plan 04-03 modules this plan consumes
@app/(shell)/app/availability/_lib/queries.ts
@app/(shell)/app/availability/_lib/actions.ts
@app/(shell)/app/availability/_lib/types.ts
@app/(shell)/app/availability/_lib/schema.ts

# Phase 3 form patterns to mirror (RHF + direct-call action + sonner)
@app/(shell)/app/event-types/[id]/edit/page.tsx
@app/(shell)/app/event-types/_components/event-type-form.tsx

# Existing UI primitives
@components/ui/switch.tsx
@components/ui/button.tsx
@components/ui/input.tsx
@components/ui/label.tsx
@components/ui/alert.tsx
@components/ui/card.tsx
@components/ui/dropdown-menu.tsx
@components/ui/separator.tsx
@components/ui/skeleton.tsx
@components/ui/sonner.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Server Component page + loading skeleton + empty-state banner</name>
  <files>app/(shell)/app/availability/page.tsx, app/(shell)/app/availability/loading.tsx, app/(shell)/app/availability/_components/availability-empty-banner.tsx</files>
  <action>
Replace the Phase 2 stub at `app/(shell)/app/availability/page.tsx` with a real Server Component that loads availability state and renders the editor sections. Add a `loading.tsx` skeleton and the empty-state banner component.

**File 1 — `app/(shell)/app/availability/page.tsx`:**

```tsx
import { redirect } from "next/navigation";

import { Separator } from "@/components/ui/separator";

import { loadAvailabilityState } from "./_lib/queries";
import { AvailabilityEmptyBanner } from "./_components/availability-empty-banner";
import { WeeklyRulesEditor } from "./_components/weekly-rules-editor";
import { SettingsPanel } from "./_components/settings-panel";
// Plan 04-05 ships this component (DateOverridesSection). Until 04-05 lands,
// we fall back to a comment-only placeholder section. The import below is
// intentional and stable — 04-05 only needs to add the file.
// import { DateOverridesSection } from "./_components/date-overrides-section";

export default async function AvailabilityPage() {
  const state = await loadAvailabilityState();
  if (!state) {
    // Unlinked user — redirect to dashboard root which handles the unlinked
    // banner (existing Phase 2 pattern in app/(shell)/app/page.tsx).
    redirect("/app");
  }

  const isEmpty = state.rules.length === 0 && state.overrides.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Define when people can book and customize buffers, notice, and caps.
        </p>
      </header>

      {isEmpty && <AvailabilityEmptyBanner />}

      <section aria-label="Weekly availability">
        <h2 className="mb-4 text-lg font-medium">Weekly hours</h2>
        <WeeklyRulesEditor rules={state.rules} accountTimezone={state.account.timezone} />
      </section>

      <Separator />

      <section aria-label="Date overrides">
        <h2 className="mb-4 text-lg font-medium">Date overrides</h2>
        {/* Plan 04-05 will replace this comment with <DateOverridesSection
            overrides={state.overrides} />. Until then we render an
            "empty placeholder" so the page is shippable as-is. */}
        <p className="text-muted-foreground text-sm">
          Date-specific overrides will appear here.
        </p>
      </section>

      <Separator />

      <section aria-label="Booking settings">
        <h2 className="mb-4 text-lg font-medium">Booking settings</h2>
        <SettingsPanel
          initial={{
            buffer_minutes: state.account.buffer_minutes,
            min_notice_hours: state.account.min_notice_hours,
            max_advance_days: state.account.max_advance_days,
            daily_cap: state.account.daily_cap,
          }}
        />
      </section>
    </div>
  );
}
```

**File 2 — `app/(shell)/app/availability/loading.tsx`:**

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function AvailabilityLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <section>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="h-32 w-full" />
      </section>

      <Separator />

      <section>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
```

**File 3 — `app/(shell)/app/availability/_components/availability-empty-banner.tsx`:**

```tsx
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AvailabilityEmptyBanner() {
  return (
    <Alert variant="default" className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
      <AlertTriangle className="size-4" />
      <AlertTitle>You haven&apos;t set availability yet</AlertTitle>
      <AlertDescription>
        Bookings cannot be made until you open at least one weekday or add a
        date override below.
      </AlertDescription>
    </Alert>
  );
}
```

Key rules:
- `page.tsx` is a Server Component (`async` default export, no `"use client"`). It awaits `loadAvailabilityState()` and passes the data DOWN to client components as props.
- The `redirect("/app")` on null state matches the Phase 2 unlinked-user pattern (STATE.md "Unlinked-user check placement" decision says check lives on `/app/page.tsx`; redirecting to it inherits the existing unlinked banner).
- The `<DateOverridesSection />` import is COMMENTED OUT in this plan. Plan 04-05 will:
  1. Create `_components/date-overrides-section.tsx`.
  2. Uncomment the import line and the component usage in `page.tsx` (single-line patch — no other changes to page.tsx).
  3. Remove the placeholder `<p>...</p>` paragraph.
  This keeps file ownership clean and lets 04-04 + 04-05 run in true parallel.
- `loading.tsx` mirrors the page layout (header + 3 sections) so the skeleton "feels" like the real page is loading.
- The empty-state banner uses shadcn `Alert` (already installed, RESEARCH §4 confirmed). Copy is paraphrased from CONTEXT decision but stays close to the locked intent.

DO NOT:
- Do not add `<DateOverridesSection />` to page.tsx — Plan 04-05 ships its own file and patches the import.
- Do not seed default Mon-Fri 9-5 anywhere — CONTEXT-locked: empty by default, banner forces deliberate setup.
- Do not add a top-level "Save all" button — each section saves independently per RESEARCH and the per-row edit pattern.
- Do not add `"use client"` to page.tsx or loading.tsx.
  </action>
  <verify>
```bash
ls "app/(shell)/app/availability/page.tsx" "app/(shell)/app/availability/loading.tsx" "app/(shell)/app/availability/_components/availability-empty-banner.tsx"

# page.tsx is a Server Component (no "use client", does load data)
! head -1 "app/(shell)/app/availability/page.tsx" | grep -q '"use client"' && echo "server component ok"
grep -q "loadAvailabilityState" "app/(shell)/app/availability/page.tsx" && echo "loader called"
grep -q "WeeklyRulesEditor" "app/(shell)/app/availability/page.tsx" && echo "editor rendered"
grep -q "SettingsPanel" "app/(shell)/app/availability/page.tsx" && echo "settings rendered"
grep -q 'redirect\("/app"\)' "app/(shell)/app/availability/page.tsx" && echo "unlinked redirect ok"

# Empty banner has CONTEXT-locked copy intent
grep -q "haven" "app/(shell)/app/availability/_components/availability-empty-banner.tsx" && echo "empty banner ok"

npm run build
```
  </verify>
  <done>
`page.tsx` is a Server Component that calls `loadAvailabilityState()`, redirects unlinked users to `/app`, and renders the page layout (header → empty-banner if applicable → weekly editor → date-overrides placeholder section → settings panel). `loading.tsx` renders a skeleton matching the layout. `availability-empty-banner.tsx` renders a shadcn Alert with the CONTEXT-locked copy. `npm run build` exits 0.

Commit: `feat(04-04): add availability page server component, loading skeleton, and empty banner`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Weekly rules editor — TimeWindowPicker, CopyFromMenu, WeekdayRow, WeeklyRulesEditor</name>
  <files>app/(shell)/app/availability/_components/time-window-picker.tsx, app/(shell)/app/availability/_components/copy-from-menu.tsx, app/(shell)/app/availability/_components/weekday-row.tsx, app/(shell)/app/availability/_components/weekly-rules-editor.tsx</files>
  <action>
Build the weekly editor in 4 components, smallest-to-largest. Each is a client component (`"use client"` at top).

**File 1 — `app/(shell)/app/availability/_components/time-window-picker.tsx`:**

```tsx
"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Single time-window row: <input type="time"> start, "to", <input type="time"> end, trash icon.
 *
 * Native time inputs render an OS picker on mobile (clock wheel) and a spinner
 * on desktop. Outputs HH:MM strings; we convert to/from minutes-since-midnight
 * via the helpers below.
 */

function minutesToHHMM(m: number): string {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hhmmToMinutes(s: string): number {
  // s = "09:30"
  const [hh, mm] = s.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

export interface TimeWindowPickerProps {
  start_minute: number;
  end_minute: number;
  onChange: (next: { start_minute: number; end_minute: number }) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export function TimeWindowPicker({
  start_minute,
  end_minute,
  onChange,
  onRemove,
  disabled,
}: TimeWindowPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        value={minutesToHHMM(start_minute)}
        onChange={(e) =>
          onChange({ start_minute: hhmmToMinutes(e.target.value), end_minute })
        }
        disabled={disabled}
        aria-label="Start time"
        className="w-28"
      />
      <span className="text-muted-foreground text-sm">to</span>
      <Input
        type="time"
        value={minutesToHHMM(end_minute === 1440 ? 1440 - 1 : end_minute)}
        onChange={(e) =>
          onChange({
            start_minute,
            end_minute: hhmmToMinutes(e.target.value),
          })
        }
        disabled={disabled}
        aria-label="End time"
        className="w-28"
      />
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove time window"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
```

**File 2 — `app/(shell)/app/availability/_components/copy-from-menu.tsx`:**

```tsx
"use client";

import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { DayOfWeek, TimeWindow } from "../_lib/types";

const DAY_NAMES: Record<DayOfWeek, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export interface CopyFromMenuProps {
  /** Current weekday — excluded from the menu */
  currentDay: DayOfWeek;
  /** All weekday → windows in current form state (the "live" sibling values) */
  allDays: Record<DayOfWeek, TimeWindow[]>;
  onCopy: (windows: TimeWindow[]) => void;
  disabled?: boolean;
}

export function CopyFromMenu({
  currentDay,
  allDays,
  onCopy,
  disabled,
}: CopyFromMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={disabled}>
          <Copy className="mr-2 size-4" />
          Copy from
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(DAY_NAMES) as unknown as string[])
          .map(Number)
          .filter((d) => d !== currentDay)
          .map((d) => {
            const dow = d as DayOfWeek;
            const count = allDays[dow]?.length ?? 0;
            const label =
              count === 0 ? `${DAY_NAMES[dow]} (Closed)` : `${DAY_NAMES[dow]} (${count} window${count === 1 ? "" : "s"})`;
            return (
              <DropdownMenuItem
                key={dow}
                onSelect={() => onCopy(allDays[dow] ?? [])}
              >
                {label}
              </DropdownMenuItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**File 3 — `app/(shell)/app/availability/_components/weekday-row.tsx`:**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { saveWeeklyRulesAction } from "../_lib/actions";
import type { DayOfWeek, TimeWindow } from "../_lib/types";

import { TimeWindowPicker } from "./time-window-picker";
import { CopyFromMenu } from "./copy-from-menu";

const DAY_NAMES: Record<DayOfWeek, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const DEFAULT_WINDOW: TimeWindow = { start_minute: 540, end_minute: 1020 }; // 9:00-17:00

export interface WeekdayRowProps {
  dayOfWeek: DayOfWeek;
  initialWindows: TimeWindow[];
  /** Read-only view of all sibling rows for the Copy-from menu */
  allDays: Record<DayOfWeek, TimeWindow[]>;
}

export function WeekdayRow({ dayOfWeek, initialWindows, allDays }: WeekdayRowProps) {
  const router = useRouter();
  const [windows, setWindows] = useState<TimeWindow[]>(initialWindows);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // "Open" means there is at least one window. "Closed" means windows is empty.
  const isOpen = windows.length > 0;

  function handleToggle(next: boolean) {
    if (next) {
      // Switching to Open: seed a default window if empty.
      setWindows(windows.length === 0 ? [{ ...DEFAULT_WINDOW }] : windows);
    } else {
      setWindows([]);
    }
    setError(null);
  }

  function updateWindow(index: number, next: TimeWindow) {
    setWindows((prev) => prev.map((w, i) => (i === index ? next : w)));
    setError(null);
  }

  function removeWindow(index: number) {
    setWindows((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  function addWindow() {
    setWindows((prev) => [...prev, { ...DEFAULT_WINDOW }]);
    setError(null);
  }

  function copyFrom(srcWindows: TimeWindow[]) {
    setWindows(srcWindows.map((w) => ({ ...w })));
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveWeeklyRulesAction({ day_of_week: dayOfWeek, windows });
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
      toast.success(`${DAY_NAMES[dayOfWeek]} saved.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-32 items-center gap-3">
        <Switch
          checked={isOpen}
          onCheckedChange={handleToggle}
          disabled={isPending}
          aria-label={`Toggle ${DAY_NAMES[dayOfWeek]} open/closed`}
        />
        <span className="font-medium">{DAY_NAMES[dayOfWeek]}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {!isOpen && <span className="text-muted-foreground text-sm">Closed</span>}
        {windows.map((w, i) => (
          <TimeWindowPicker
            key={i}
            start_minute={w.start_minute}
            end_minute={w.end_minute}
            onChange={(next) => updateWindow(i, next)}
            onRemove={windows.length > 1 ? () => removeWindow(i) : undefined}
            disabled={isPending}
          />
        ))}
        {isOpen && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addWindow}
            disabled={isPending}
            className="self-start"
          >
            <Plus className="mr-2 size-4" />
            Add window
          </Button>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-start">
        <CopyFromMenu
          currentDay={dayOfWeek}
          allDays={allDays}
          onCopy={copyFrom}
          disabled={isPending}
        />
        <Button type="button" size="sm" onClick={save} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
```

**File 4 — `app/(shell)/app/availability/_components/weekly-rules-editor.tsx`:**

```tsx
"use client";

import { useMemo } from "react";

import type { AvailabilityRuleRow, DayOfWeek, TimeWindow } from "../_lib/types";

import { WeekdayRow } from "./weekday-row";

const ALL_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]; // Mon-first display order

export interface WeeklyRulesEditorProps {
  rules: AvailabilityRuleRow[];
  /** Currently unused — reserved for displaying account TZ next to the editor in a future polish pass. */
  accountTimezone?: string;
}

export function WeeklyRulesEditor({ rules }: WeeklyRulesEditorProps) {
  /** Group rules by day_of_week into TimeWindow[] arrays, sorted by start_minute. */
  const allDays = useMemo<Record<DayOfWeek, TimeWindow[]>>(() => {
    const out: Record<DayOfWeek, TimeWindow[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    for (const r of rules) {
      const dow = r.day_of_week as DayOfWeek;
      out[dow].push({ start_minute: r.start_minute, end_minute: r.end_minute });
    }
    for (const k of Object.keys(out)) {
      out[Number(k) as DayOfWeek].sort(
        (a, b) => a.start_minute - b.start_minute,
      );
    }
    return out;
  }, [rules]);

  return (
    <div className="flex flex-col gap-3">
      {ALL_DAYS.map((d) => (
        <WeekdayRow
          key={d}
          dayOfWeek={d}
          initialWindows={allDays[d]}
          allDays={allDays}
        />
      ))}
    </div>
  );
}
```

Key rules:
- All four files start with `"use client"` (line 1).
- `TimeWindowPicker` uses native `<input type="time">` (RESEARCH §6 recommendation). Stores minutes-since-midnight; converts to/from HH:MM at the input boundary.
- The end-time edge case: if `end_minute === 1440` (midnight next day), the `<input type="time">` cannot represent that as `24:00`. The picker shows `23:59` for display but the parent state can still store 1440 (this UI choice is acceptable for v1; per CONTEXT decision we don't worry about cross-midnight windows).
- `CopyFromMenu` reads sibling rows from the `allDays` prop. Selecting a day calls `onCopy(srcWindows)` which the row's `copyFrom` callback uses to overwrite local state. The user MUST click Save to persist (Copy is a state-only action).
- `WeekdayRow`:
  - `useState` holds the windows for THIS row.
  - Open/Closed toggle: on→seed default 9-17, off→empty array.
  - Save calls `saveWeeklyRulesAction({day_of_week, windows})` inside `startTransition`. On success: `toast.success` + `router.refresh()` (per Phase 3 lock: required after non-redirecting actions).
  - `useTransition` is required so the Save button shows a "Saving..." pending state.
  - The Switch uses Phase 3 lock pattern: switch state derived from `windows.length > 0` (doesn't need a separate state variable).
- `WeeklyRulesEditor`:
  - Pure presenter that groups DB rows by day_of_week into a `Record<DayOfWeek, TimeWindow[]>` via `useMemo`.
  - Renders 7 `WeekdayRow` instances. Display order Mon-first (1,2,3,4,5,6,0) — common UX preference; data-layer day_of_week is still 0=Sun.
  - Passes the FULL `allDays` object to each row so the Copy-from menu can read sibling values.
  - Note: when one row saves and `router.refresh()` runs, Server Component re-fetches and `WeeklyRulesEditor` receives fresh `rules` props. The other rows' local state is preserved (their `useState` doesn't re-init from props on re-render). This is acceptable for v1: if the user has unsaved edits in another row, they can save those independently. If they want to discard local edits, they can refresh the page.

DO NOT:
- Do not use react-hook-form for this UI — the per-row state is simple `useState`. RHF would add overhead without benefit. (Phase 3 used RHF for the event-type form because that form had 8+ heterogeneous fields with complex validation; this UI has 7 small uniform sub-forms.)
- Do not validate windows client-side beyond what `<input type="time">` enforces (HH:MM format). The Zod schema in Plan 04-03 owns server-side validation including overlap; the action returns fieldErrors which we surface inline.
- Do not auto-save on blur — explicit Save button per row.
- Do not collapse multiple weekdays into one save. Each row saves independently to keep failure modes localized.
  </action>
  <verify>
```bash
ls "app/(shell)/app/availability/_components/"{time-window-picker,copy-from-menu,weekday-row,weekly-rules-editor}.tsx

# All four are client components
for f in time-window-picker copy-from-menu weekday-row weekly-rules-editor; do
  head -1 "app/(shell)/app/availability/_components/$f.tsx" | grep -q '"use client"' && echo "$f use client ok"
done

# Load-bearing patterns
grep -q 'type="time"' "app/(shell)/app/availability/_components/time-window-picker.tsx" && echo "native time input ok"
grep -q "saveWeeklyRulesAction" "app/(shell)/app/availability/_components/weekday-row.tsx" && echo "action wired ok"
grep -q "router.refresh" "app/(shell)/app/availability/_components/weekday-row.tsx" && echo "refresh wired ok"
grep -q "toast.success\|toast.error" "app/(shell)/app/availability/_components/weekday-row.tsx" && echo "sonner wired ok"
grep -q "useTransition" "app/(shell)/app/availability/_components/weekday-row.tsx" && echo "transition ok"

npm run build
npm run lint
```
  </verify>
  <done>
All 4 client components exist. `TimeWindowPicker` renders native `<input type="time">` for start/end with minutes-since-midnight conversion. `CopyFromMenu` shows a DropdownMenu listing the other 6 weekdays with window counts. `WeekdayRow` holds per-row state, calls `saveWeeklyRulesAction` inside `useTransition`, fires `toast.success`/`toast.error` and `router.refresh()` after save, and supports add/remove/copy/toggle. `WeeklyRulesEditor` groups DB rows by day_of_week and renders 7 `WeekdayRow` instances in Mon-first order. `npm run build` + `npm run lint` exit 0.

Commit: `feat(04-04): add weekly rules editor (rows, copy-from, time pickers)`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 3: Settings panel with 4 number inputs</name>
  <files>app/(shell)/app/availability/_components/settings-panel.tsx</files>
  <action>
Build the settings panel — 4 plain number inputs at the bottom of the page. Saves via `saveAccountSettingsAction`. CONTEXT-locked: plain `<input type="number">` + unit labels.

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveAccountSettingsAction } from "../_lib/actions";

export interface SettingsPanelProps {
  initial: {
    buffer_minutes: number;
    min_notice_hours: number;
    max_advance_days: number;
    daily_cap: number | null;
  };
}

export function SettingsPanel({ initial }: SettingsPanelProps) {
  const router = useRouter();
  const [bufferMinutes, setBufferMinutes] = useState(String(initial.buffer_minutes));
  const [minNoticeHours, setMinNoticeHours] = useState(String(initial.min_notice_hours));
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(String(initial.max_advance_days));
  // daily_cap is nullable — empty string represents "no cap" in the form.
  const [dailyCap, setDailyCap] = useState(
    initial.daily_cap === null ? "" : String(initial.daily_cap),
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await saveAccountSettingsAction({
        buffer_minutes: Number(bufferMinutes),
        min_notice_hours: Number(minNoticeHours),
        max_advance_days: Number(maxAdvanceDays),
        // Empty string → null (no cap).
        daily_cap: dailyCap.trim() === "" ? null : Number(dailyCap),
      });

      if (result.formError) {
        toast.error(result.formError);
        setFormError(result.formError);
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        toast.error("Please fix the highlighted fields.");
        return;
      }

      toast.success("Settings saved.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="buffer_minutes"
          label="Buffer (minutes)"
          help="Time held before and after each booking."
          value={bufferMinutes}
          onChange={setBufferMinutes}
          min={0}
          max={240}
          step={5}
          disabled={isPending}
          errors={fieldErrors.buffer_minutes}
        />
        <Field
          id="min_notice_hours"
          label="Min notice (hours)"
          help="Earliest a slot becomes bookable, before now."
          value={minNoticeHours}
          onChange={setMinNoticeHours}
          min={0}
          max={8760}
          step={1}
          disabled={isPending}
          errors={fieldErrors.min_notice_hours}
        />
        <Field
          id="max_advance_days"
          label="Max advance (days)"
          help="How far into the future slots are shown."
          value={maxAdvanceDays}
          onChange={setMaxAdvanceDays}
          min={1}
          max={365}
          step={1}
          disabled={isPending}
          errors={fieldErrors.max_advance_days}
        />
        <Field
          id="daily_cap"
          label="Daily cap (bookings/day)"
          help="Leave empty for no cap."
          value={dailyCap}
          onChange={setDailyCap}
          min={1}
          max={1000}
          step={1}
          disabled={isPending}
          errors={fieldErrors.daily_cap}
          placeholder="No cap"
        />
      </div>

      {formError && <p className="text-destructive text-sm">{formError}</p>}

      <div>
        <Button type="button" onClick={save} disabled={isPending}>
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  errors?: string[];
  placeholder?: string;
}

function Field({
  id,
  label,
  help,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  errors,
  placeholder,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={errors && errors.length > 0 ? true : undefined}
      />
      <p className="text-muted-foreground text-xs">{help}</p>
      {errors?.map((err, i) => (
        <p key={i} className="text-destructive text-xs">
          {err}
        </p>
      ))}
    </div>
  );
}
```

Key rules:
- File starts with `"use client"`.
- 4 plain `<input type="number">` fields per CONTEXT lock — no fancy stepper, no slider.
- `daily_cap` accepts empty string → submitted as `null` (CONTEXT-locked: empty = no cap). Placeholder reads "No cap" so the empty state is self-explanatory.
- Saves via `saveAccountSettingsAction` inside `startTransition`. Same pattern as WeekdayRow: toast + setError + router.refresh on success.
- Field-level errors surface under each input via the inline `Field` component.
- Bounds (`min`/`max`/`step` HTML attrs) match the Zod schema bounds from Plan 04-03 — defense in depth.

DO NOT:
- Do not use a slider for buffer_minutes (CONTEXT explicitly chose plain number inputs).
- Do not auto-save on blur — explicit Save button.
- Do not split the panel into 4 separate save actions — settings save together (one DB row, one UPDATE).
- Do not bind `daily_cap === 0` to "no cap" — null vs 0 must stay distinct (DB CHECK rejects 0).
  </action>
  <verify>
```bash
ls "app/(shell)/app/availability/_components/settings-panel.tsx"

# Client component + load-bearing patterns
head -1 "app/(shell)/app/availability/_components/settings-panel.tsx" | grep -q '"use client"' && echo "use client ok"
grep -q "saveAccountSettingsAction" "app/(shell)/app/availability/_components/settings-panel.tsx" && echo "action wired"
grep -q 'type="number"' "app/(shell)/app/availability/_components/settings-panel.tsx" && echo "number inputs ok"
grep -q "router.refresh" "app/(shell)/app/availability/_components/settings-panel.tsx" && echo "refresh ok"
grep -q "toast.success\|toast.error" "app/(shell)/app/availability/_components/settings-panel.tsx" && echo "sonner ok"

# 4 fields by id
for f in buffer_minutes min_notice_hours max_advance_days daily_cap; do
  grep -q "id=\"$f\"" "app/(shell)/app/availability/_components/settings-panel.tsx" && echo "$f ok"
done

npm run build
npm run lint
```
  </verify>
  <done>
`settings-panel.tsx` is a client component with 4 `<input type="number">` fields (buffer_minutes, min_notice_hours, max_advance_days, daily_cap), saves via `saveAccountSettingsAction` inside `useTransition`, surfaces field + form errors inline, fires sonner toasts, calls `router.refresh()` on success. `daily_cap` empty input → `null`. `npm run build` + `npm run lint` exit 0.

Commit: `feat(04-04): add availability settings panel (buffer, notice, max-advance, daily cap)`. Push.

Final smoke test (user-runnable):
- Visit `/app/availability` while logged in
- Empty banner shows on first visit (no rules + no overrides)
- Toggle Mon to Open, edit windows, click Save → toast + persists across refresh
- Try Copy from Mon on Tue → windows populate; click Save → persists
- Edit settings (buffer = 15, daily cap = 3) → toast + persists
  </done>
</task>

</tasks>

<verification>
```bash
# All Plan 04-04 files present
ls "app/(shell)/app/availability/page.tsx" \
   "app/(shell)/app/availability/loading.tsx" \
   "app/(shell)/app/availability/_components/"{availability-empty-banner,weekly-rules-editor,weekday-row,time-window-picker,copy-from-menu,settings-panel}.tsx

# Build + lint clean
npm run build
npm run lint

# Existing test suite still green (no regression)
npm test
```

This plan is UI-only — no new tests in Vitest. Verification is a user smoke test on the live deployment after push (Vercel auto-deploys to https://calendar-app-xi-smoky.vercel.app/).
</verification>

<success_criteria>
- [ ] `/app/availability` Server Component awaits `loadAvailabilityState()` and redirects unlinked users to `/app`
- [ ] Empty-state banner renders when both rules and overrides are empty
- [ ] Weekly editor renders 7 weekday rows in Mon-first display order, each with: weekday name, Open/Closed Switch, time-window pickers, Add window button, Copy from menu, Save button
- [ ] Open/Closed toggle: Closed = empty array (saves as DELETE-only); Open = at least one window with default 9:00-17:00
- [ ] TimeWindowPicker uses native `<input type="time">` and converts HH:MM ↔ minutes-since-midnight
- [ ] Copy from menu lists the other 6 weekdays with their window counts; selecting one populates current row's local state (does NOT auto-save)
- [ ] WeekdayRow saves via direct call to `saveWeeklyRulesAction` inside `useTransition`; success → toast.success + router.refresh
- [ ] Settings panel renders 4 plain number inputs (buffer / min-notice / max-advance / daily-cap) with unit labels and help text
- [ ] Settings panel: empty `daily_cap` input submits as `null`
- [ ] Settings panel saves via `saveAccountSettingsAction`; field errors surface inline; success → toast + router.refresh
- [ ] `loading.tsx` renders a skeleton matching the page layout
- [ ] Page reserves a "Date overrides" section slot for Plan 04-05 (commented import + placeholder paragraph)
- [ ] No raw `Date` math anywhere; no formatInTimeZone; no admin-client import; no redirect() in any client action call
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Existing Vitest suite still green
- [ ] Each task committed atomically (3 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/04-availability-engine/04-04-SUMMARY.md` documenting:
- Final shape of the page layout (header, sections, vertical order)
- Confirmed contract for Plan 04-05 patch: it adds `_components/date-overrides-section.tsx` and updates page.tsx via 2 line edits (uncomment import; replace placeholder paragraph with `<DateOverridesSection overrides={state.overrides} />`)
- Decision to use plain `useState` per row (no RHF) — rationale logged for future polish phases
- Mon-first display order chosen for the weekday rows (data still 0=Sun)
- Note that `daily_cap` empty-string → null is handled at the form boundary (component) before reaching the action
- Any deviation from CONTEXT decisions or RESEARCH §6 recommendations
</output>
