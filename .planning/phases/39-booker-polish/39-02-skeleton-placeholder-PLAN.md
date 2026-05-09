---
phase: 39-booker-polish
plan: 02
type: execute
wave: 2
depends_on: ["39-01"]
files_modified:
  - app/[account]/[event-slug]/_components/booking-form-skeleton.tsx
  - app/[account]/[event-slug]/_components/booking-shell.tsx
autonomous: true

must_haves:
  truths:
    - "Before any slot is selected, the form column shows a shape-only skeleton placeholder (not a bare line of text, not empty space)"
    - "The skeleton blocks render statically — no pulse/shimmer that would falsely imply 'system is loading'"
    - "Helper copy 'Pick a time to continue' is rendered inside the skeleton column so the user understands the next step"
    - "The skeleton occupies the same grid cell as the form (320px desktop col / full-width on mobile) so the form-column footprint is reserved on first paint"
  artifacts:
    - path: "app/[account]/[event-slug]/_components/booking-form-skeleton.tsx"
      provides: "BookingFormSkeleton component — static shape-only placeholder for the form column"
      min_lines: 25
      exports: ["BookingFormSkeleton"]
      contains: "Pick a time to continue"
    - path: "app/[account]/[event-slug]/_components/booking-shell.tsx"
      provides: "Conditional render replaces bare text placeholder with <BookingFormSkeleton />"
      contains: "<BookingFormSkeleton"
      not_contains: "Pick a time on the left to continue."
  key_links:
    - from: "app/[account]/[event-slug]/_components/booking-shell.tsx"
      to: "BookingFormSkeleton"
      via: "import + JSX use in the `selectedSlot ? ... : ...` else branch"
      pattern: "import.*BookingFormSkeleton.*from.*booking-form-skeleton"
---

<objective>
Replace the bare `<div className="text-sm text-muted-foreground">Pick a time on the left to continue.</div>` placeholder with a proper shape-only `<BookingFormSkeleton />` component. The skeleton is static (no pulse) per the CONTEXT.md "lean static" recommendation — pulse reads as "system is loading" but we are waiting on user input, which is a different semantic.

Purpose: Reserve the form-column footprint on first paint so the form-arrival doesn't shift layout, and give the user a clear visual cue that "something will appear here" without falsely implying loading.

Output: A new `booking-form-skeleton.tsx` file in `_components/`, and an updated `booking-shell.tsx` that imports and renders it in the no-slot branch.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/39-booker-polish/39-CONTEXT.md
@.planning/phases/39-booker-polish/39-RESEARCH.md
@app/[account]/[event-slug]/_components/booking-shell.tsx
@components/ui/skeleton.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create BookingFormSkeleton component (static, no pulse)</name>
  <files>app/[account]/[event-slug]/_components/booking-form-skeleton.tsx</files>
  <action>
Create a NEW file `app/[account]/[event-slug]/_components/booking-form-skeleton.tsx` with this exact content:

```tsx
/**
 * BookingFormSkeleton — shape-only placeholder for the form column shown
 * BEFORE any slot is selected.
 *
 * Phase 39 design notes:
 * - STATIC by design (no animate-pulse). The semantic here is "waiting on
 *   user input", not "system is loading" — a pulse would mislead. We
 *   render flat `bg-muted` blocks instead of using the shadcn `Skeleton`
 *   primitive (which carries `animate-pulse`).
 * - `aria-hidden="true"` because the skeleton is decorative; SR users get
 *   the helper copy below it.
 * - Heights/widths approximate BookingForm's 3 standard fields + Turnstile
 *   (~300x65 standard size) + submit button, with `space-y-4` to mirror
 *   the form's own gap. Exact CLS isn't a concern post-interaction
 *   (CLS is load-only) but matching shape preserves visual rhythm.
 */
export function BookingFormSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      {/* Name field (label + input) */}
      <div className="space-y-1">
        <div className="h-4 w-16 rounded-md bg-muted" />
        <div className="h-9 w-full rounded-md bg-muted" />
      </div>
      {/* Email field */}
      <div className="space-y-1">
        <div className="h-4 w-12 rounded-md bg-muted" />
        <div className="h-9 w-full rounded-md bg-muted" />
      </div>
      {/* Phone field */}
      <div className="space-y-1">
        <div className="h-4 w-14 rounded-md bg-muted" />
        <div className="h-9 w-full rounded-md bg-muted" />
      </div>
      {/* Turnstile widget placeholder (standard 300x65) */}
      <div className="h-[65px] w-[300px] max-w-full rounded-md bg-muted" />
      {/* Submit button */}
      <div className="h-9 w-full rounded-md bg-muted" />
      {/* Helper copy — visible to all users; describes the next action */}
      <p className="text-center text-xs text-muted-foreground">
        Pick a time to continue
      </p>
    </div>
  );
}
```

Notes:
- Do NOT use `<Skeleton />` from `@/components/ui/skeleton` — that primitive includes `animate-pulse` which the CONTEXT.md "lean static" decision explicitly rejects.
- Do NOT add `motion-reduce:` classes here — there is no animation to suppress.
- File must be a `.tsx` server-friendly component (no `"use client"` directive needed; it has no client hooks).

Then commit:

```
git add app/[account]/[event-slug]/_components/booking-form-skeleton.tsx
git commit -m "feat(39-02): add static BookingFormSkeleton placeholder component"
```
  </action>
  <verify>
1. File exists at the exact path.
2. `grep -c "rounded-md bg-muted" app/[account]/[event-slug]/_components/booking-form-skeleton.tsx` returns 5 (3 fields × 2 elements minus labels = correct shape count: 3 labels + 3 inputs + 1 turnstile + 1 button = 8 blocks; the grep should match each occurrence — adjust expectation: 8).
3. `grep -c "animate-pulse" app/[account]/[event-slug]/_components/booking-form-skeleton.tsx` returns 0.
4. `grep "Pick a time to continue" app/[account]/[event-slug]/_components/booking-form-skeleton.tsx` returns the helper copy line.
5. `npx tsc --noEmit` passes.
  </verify>
  <done>
- New file `booking-form-skeleton.tsx` exists with `BookingFormSkeleton` named export.
- Component renders 8 static `bg-muted` blocks plus helper text.
- No `animate-pulse` anywhere in the file.
- Atomic commit `feat(39-02): ...` for the new file.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire BookingFormSkeleton into booking-shell.tsx</name>
  <files>app/[account]/[event-slug]/_components/booking-shell.tsx</files>
  <action>
Open `app/[account]/[event-slug]/_components/booking-shell.tsx`.

Step 1: Add an import near the existing `BookingForm` import. Find the line that imports `BookingForm` (likely near the top with other `_components` imports) and add immediately after it:

```tsx
import { BookingFormSkeleton } from "./booking-form-skeleton";
```

(Use the same relative-import style as the existing `BookingForm` import — i.e. if `BookingForm` is imported via `from "./booking-form"`, mirror that path style.)

Step 2: Replace the bare-text placeholder in the conditional render. The current code (after Plan 39-01) is:

```tsx
{selectedSlot ? (
  <BookingForm
    accountSlug={account.slug}
    eventType={eventType}
    selectedSlot={selectedSlot}
    bookerTimezone={bookerTz}
    onRaceLoss={handleRaceLoss}
  />
) : (
  <div className="text-sm text-muted-foreground">
    Pick a time on the left to continue.
  </div>
)}
```

Replace the entire `else` branch (the `<div className="text-sm text-muted-foreground">...</div>` block) with:

```tsx
<BookingFormSkeleton />
```

Result:

```tsx
{selectedSlot ? (
  <BookingForm
    accountSlug={account.slug}
    eventType={eventType}
    selectedSlot={selectedSlot}
    bookerTimezone={bookerTz}
    onRaceLoss={handleRaceLoss}
  />
) : (
  <BookingFormSkeleton />
)}
```

Do NOT change the wrapping `<div>` around the conditional. Do NOT touch any other code.

Then commit:

```
git add app/[account]/[event-slug]/_components/booking-shell.tsx
git commit -m "feat(39-02): wire BookingFormSkeleton into booking-shell pre-slot state"
```
  </action>
  <verify>
1. `grep "Pick a time on the left to continue" app/[account]/[event-slug]/_components/booking-shell.tsx` returns NO matches.
2. `grep "BookingFormSkeleton" app/[account]/[event-slug]/_components/booking-shell.tsx` returns at least 2 matches (the import + the JSX usage).
3. `npx tsc --noEmit` passes.
4. `npm run build` succeeds.
5. Visit a booker URL in dev — before picking a slot, the form column shows shape-only blocks with "Pick a time to continue" centered below them.
  </verify>
  <done>
- `booking-shell.tsx` imports `BookingFormSkeleton`.
- The bare `<div>Pick a time on the left to continue.</div>` is gone.
- The else branch renders `<BookingFormSkeleton />`.
- Atomic commit `feat(39-02): ...` for the wiring.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
A new static `BookingFormSkeleton` component is wired into `booking-shell.tsx`'s pre-slot state. Before any slot is picked, the form column shows shape-only blocks (no pulse) with "Pick a time to continue" helper copy centered below.
  </what-built>
  <how-to-verify>
1. `npm run dev`, open a public booker URL on desktop (window width ≥ `lg` breakpoint).
2. **Before picking a slot:**
   - The form column (right side, 320px) shows: 3 label/input pairs (small label block + larger input block), a 300×65 Turnstile-shaped block, a submit-button-shaped block, and "Pick a time to continue" centered text below.
   - The blocks must be STATIC — no pulsing/shimmering. Watch for at least 5 seconds.
   - There is no "loading spinner" anywhere on the column.
3. Resize the browser to mobile width (< `lg`). The skeleton should stack below the calendar (single-column layout) and remain visible. Same shape, full width.
4. Pick a slot — the skeleton disappears and the form appears (animation comes in Plan 39-03; for now an instant swap is fine).
5. Verify React DevTools still shows `BookingForm` absent before pick (Plan 39-01 lock holds).

Type "approved" if all checks pass. If pulse is visible, if helper text is missing, or if shape proportions look wrong, describe what you saw.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Skeleton visible before slot pick on desktop and mobile.
- Helper copy "Pick a time to continue" present.
- No pulse/shimmer (static blocks).
- Form column footprint preserved at all viewport widths.
- V15-MP-05 lock from Plan 39-01 still holds.
</verification>

<success_criteria>
- Phase Success Criteria #2 satisfied: shape-only skeleton, no false loading spinner, no empty white space.
- Plan 39-01's V15-MP-05 lock preserved.
</success_criteria>

<output>
After completion, create `.planning/phases/39-booker-polish/39-02-SUMMARY.md` documenting the new component, the wiring change, and the verified visual outcome (with screenshot reference if Andrew supplies one).
</output>
