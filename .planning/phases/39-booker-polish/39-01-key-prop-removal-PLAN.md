---
phase: 39-booker-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/[account]/[event-slug]/_components/booking-shell.tsx
autonomous: true

must_haves:
  truths:
    - "BookingForm is absent from the DOM before any slot is selected (V15-MP-05 lock preserved)"
    - "After first slot pick, BookingForm mounts ONCE and remains in the DOM across re-picks"
    - "Typed field values (name, email, notes, phone) persist when the user re-picks a different slot"
    - "Turnstile token does not stale or re-challenge on slot re-pick"
  artifacts:
    - path: "app/[account]/[event-slug]/_components/booking-shell.tsx"
      provides: "Conditional mount of BookingForm without forced remount on slot re-pick"
      contains: "<BookingForm"
      not_contains: "key={selectedSlot.start_at}"
  key_links:
    - from: "app/[account]/[event-slug]/_components/booking-shell.tsx (~line 257)"
      to: "BookingForm component instance lifecycle"
      via: "Removal of key={selectedSlot.start_at} so React preserves the instance across selectedSlot changes"
      pattern: "<BookingForm[^>]*accountSlug"
---

<objective>
Remove the `key={selectedSlot.start_at}` prop from `<BookingForm>` in `booking-shell.tsx`. This is the single root-cause fix for both the V15-MP-05 Turnstile lifecycle lock and the Phase 39 field-value-persistence guarantee. With this prop in place, every re-pick destroys and recreates `BookingForm` (and its Turnstile widget) and resets every typed field — both behaviors are wrong.

Purpose: Stop forcing remount on slot re-pick. RHF state lives inside the component instance and survives prop changes; the slot data is read at submit time from `props.selectedSlot`, so removing the `key` causes zero visible regression while restoring the lifecycle guarantee.

Output: A single-line deletion in `booking-shell.tsx`, an atomic commit, and a manual-verification confirming React DevTools shows `BookingForm` persisting across re-picks with field values intact.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/39-booker-polish/39-CONTEXT.md
@.planning/phases/39-booker-polish/39-RESEARCH.md
@app/[account]/[event-slug]/_components/booking-shell.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete the key prop from BookingForm</name>
  <files>app/[account]/[event-slug]/_components/booking-shell.tsx</files>
  <action>
Open `app/[account]/[event-slug]/_components/booking-shell.tsx` and locate the conditional `<BookingForm>` mount (currently around lines 255-264). The current code reads:

```tsx
{selectedSlot ? (
  <BookingForm
    key={selectedSlot.start_at}
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

Delete EXACTLY the line `      key={selectedSlot.start_at}` (do not change any other prop, do not change indentation of remaining props). The result must read:

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

Also update the surrounding comment block (lines ~251-254). The current comment ends with "key={selectedSlot.start_at} forces RHF reset on slot change." — this statement is now wrong and must be replaced. Rewrite the comment block to:

```tsx
{/* Col 3: Form column — fixed 320px reserved at all times.
    V15-MP-05 LOCK: placeholder is a <div>, NOT a mounted <BookingForm>.
    Turnstile mounts on BookingForm mount (~2-min token expiry).
    BookingForm has NO `key` prop — once mounted on first slot pick, it must
    remain mounted across re-picks so RHF field values and the Turnstile
    token persist (Phase 39 field-persistence guarantee + V15-MP-05). */}
```

Do NOT touch any other code in this file. Do NOT modify `booking-form.tsx`. Do NOT add new imports.

Then run an atomic commit:

```
git add app/[account]/[event-slug]/_components/booking-shell.tsx
git commit -m "fix(39-01): remove key prop from BookingForm to preserve V15-MP-05 lock and field persistence"
```
  </action>
  <verify>
1. `git diff HEAD~1 -- app/[account]/[event-slug]/_components/booking-shell.tsx` shows ONLY the removal of the `key={selectedSlot.start_at}` line and the comment update. No other lines should differ.
2. `npx tsc --noEmit` (or the project's typecheck script) passes without errors introduced by this change.
3. `npm run build` (or `next build`) succeeds.
4. `grep -n "key={selectedSlot" app/[account]/[event-slug]/_components/booking-shell.tsx` returns NO matches.
  </verify>
  <done>
- The `key={selectedSlot.start_at}` line is deleted from `booking-shell.tsx`.
- Surrounding comment updated to reflect the new lifecycle guarantee.
- Type-check and build are green.
- One atomic commit `fix(39-01): ...` exists on the branch.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Removed `key={selectedSlot.start_at}` from `<BookingForm>` in `booking-shell.tsx`. `BookingForm` should now mount once on first slot pick and persist across re-picks. Field values typed by the user, and any solved Turnstile token, should survive a slot change.
  </what-built>
  <how-to-verify>
1. Run the app locally (`npm run dev`) and open a public booker URL (e.g. `/{account}/{event-slug}`).
2. Open Chrome DevTools and install/enable the React Developer Tools extension.
3. **Before picking a slot:** In the React DevTools Components tree, search for "BookingForm". It MUST NOT appear (V15-MP-05 lock — Success Criteria #4).
4. Pick a slot. "BookingForm" should now appear in the Components tree.
5. **Type a value into the Name field** (e.g. "Andrew Wegner") and into Email (`test@example.com`). Wait for Turnstile to solve if it auto-challenges.
6. Pick a DIFFERENT slot in the calendar. Watch the React DevTools Components tree:
   - "BookingForm" must REMAIN at the same position (no flash of disappearance/reappearance).
   - The Name and Email values you typed must STILL BE in the inputs.
   - Turnstile must NOT re-challenge or reload (the widget should stay solved).
7. Click submit. The booking should succeed for the second slot — confirming the slot data updates via prop, not via remount.

Type "approved" if all four checks pass. If "BookingForm" disappears/reappears on re-pick, or if field values clear, or if Turnstile re-challenges, describe what you saw.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- React DevTools confirms `BookingForm` absent before first pick, present and stable across re-picks.
- Field values persist on re-pick.
- Turnstile token does not stale.
- Type-check and build pass.
- Single atomic commit exists.
</verification>

<success_criteria>
- Phase Success Criteria #4 satisfied: V15-MP-05 lock preserved, Turnstile does not stale on re-pick.
- Field-persistence guarantee (LOCKED CONTEXT decision) satisfied.
- No visible UI regression — slot data continues to update via prop.
</success_criteria>

<output>
After completion, create `.planning/phases/39-booker-polish/39-01-SUMMARY.md` documenting the diff, the verified DevTools observation, and confirming Turnstile lifecycle integrity.
</output>
