---
phase: 39-booker-polish
plan: 03
type: execute
wave: 3
depends_on: ["39-02"]
files_modified:
  - app/[account]/[event-slug]/_components/booking-shell.tsx
  - app/globals.css
autonomous: true

must_haves:
  truths:
    - "On first slot pick, the form column animates in over ~220ms via fade + 8px upward rise (transform + opacity only — no width/height/margin/padding animation)"
    - "The animation does NOT re-fire on slot re-pick (BookingForm stays mounted, so the wrapper div does not re-trigger animate-in)"
    - "With OS prefers-reduced-motion: reduce, picking a slot shows the form INSTANTLY — no fade, no rise, no transition"
    - "Chrome DevTools Performance / Lighthouse reports CLS = 0.0 across the full booker interaction"
    - "V15-MP-05 lock from Plan 39-01 remains intact: BookingForm mounts once, never re-mounts; Turnstile token does not stale"
  artifacts:
    - path: "app/[account]/[event-slug]/_components/booking-shell.tsx"
      provides: "Animation wrapper div around <BookingForm> using tw-animate-css utilities"
      contains: "animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out motion-reduce:animate-none"
    - path: "app/globals.css"
      provides: "Defense-in-depth @media (prefers-reduced-motion: reduce) override that nullifies tw-animate-css enter animation"
      contains: "prefers-reduced-motion: reduce"
  key_links:
    - from: "app/[account]/[event-slug]/_components/booking-shell.tsx"
      to: "tw-animate-css `animate-in` keyframe"
      via: "Wrapper div className applying animate-in + fade-in + slide-in-from-bottom-2 + duration-[220ms] + ease-out + motion-reduce:animate-none"
      pattern: "animate-in[^\"]*fade-in[^\"]*slide-in-from-bottom-2"
    - from: "app/globals.css"
      to: "All .animate-in / .animate-out elements under reduced-motion"
      via: "@media (prefers-reduced-motion: reduce) { .animate-in, .animate-out { animation: none !important; } }"
      pattern: "prefers-reduced-motion: reduce"
---

<objective>
Add a small entry animation to the form column on first slot pick (220ms fade + 8px upward rise, transform/opacity only) using the already-installed `tw-animate-css` utilities, and add a defense-in-depth `@media (prefers-reduced-motion: reduce)` rule in `globals.css` so the animation is fully suppressed for users with OS reduced-motion enabled.

Purpose: Smooth, polished first-pick reveal that respects accessibility and never re-fires on re-pick. The animation lives on a wrapper div around `<BookingForm>` (NOT on `BookingForm` itself, NOT keyed) so React keeps the component mounted across re-picks — preserving the V15-MP-05 lock and field-persistence guarantee from Plan 39-01.

Output: A wrapped form column with `animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out motion-reduce:animate-none` classes, plus a CSS override in `globals.css` that nullifies the `animate-in`/`animate-out` keyframes under reduced-motion as a belt-and-suspenders safeguard (RESEARCH §Open Questions #1 flagged the `motion-reduce:` × `tw-animate-css` interaction as MEDIUM confidence; we pre-include the fallback rather than treat it as contingent).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/39-booker-polish/39-CONTEXT.md
@.planning/phases/39-booker-polish/39-RESEARCH.md
@app/[account]/[event-slug]/_components/booking-shell.tsx
@app/globals.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wrap BookingForm in animate-in wrapper div</name>
  <files>app/[account]/[event-slug]/_components/booking-shell.tsx</files>
  <action>
Open `app/[account]/[event-slug]/_components/booking-shell.tsx`. After Plans 39-01 and 39-02 have run, the conditional render reads:

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

Wrap the `<BookingForm>` in an animation wrapper div. The result must read EXACTLY:

```tsx
{selectedSlot ? (
  <div className="animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out motion-reduce:animate-none">
    <BookingForm
      accountSlug={account.slug}
      eventType={eventType}
      selectedSlot={selectedSlot}
      bookerTimezone={bookerTz}
      onRaceLoss={handleRaceLoss}
    />
  </div>
) : (
  <BookingFormSkeleton />
)}
```

Critical constraints:
- The wrapper div must NOT have a `key` prop. A `key` would cause React to remount the wrapper (and re-trigger animate-in) on every slot change — defeating Plan 39-01's whole purpose. The animation should fire ONCE on first mount and never again.
- Do NOT wrap `<BookingFormSkeleton />` in an animation div — the skeleton appears on initial paint, not as a transition target.
- Use `duration-[220ms]` (Tailwind v4 arbitrary value) NOT `duration-220` (invalid scale value, RESEARCH Pitfall 2).
- `slide-in-from-bottom-2` translates from `2 * 4px = 8px` below the final position — the "8px upward rise" specified in CONTEXT.md.

Then commit:

```
git add app/[account]/[event-slug]/_components/booking-shell.tsx
git commit -m "feat(39-03): add 220ms fade+rise entry animation to form column on first slot pick"
```
  </action>
  <verify>
1. `grep "animate-in fade-in slide-in-from-bottom-2 duration-\[220ms\] ease-out motion-reduce:animate-none" app/[account]/[event-slug]/_components/booking-shell.tsx` returns exactly one match.
2. `grep -n "key=" app/[account]/[event-slug]/_components/booking-shell.tsx` shows NO `key=` on the new wrapper div (you may still see other `key` props in the slot list `.map()` — those are unrelated and should remain).
3. `npx tsc --noEmit` passes.
4. `npm run build` succeeds.
  </verify>
  <done>
- Animation wrapper div surrounds `<BookingForm>` with the exact class string.
- No `key` prop on the wrapper.
- Type-check and build pass.
- Atomic commit `feat(39-03): ...`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add reduced-motion CSS override in globals.css</name>
  <files>app/globals.css</files>
  <action>
Open `app/globals.css`. The first non-comment line is `@import "tw-animate-css";`.

Add the following CSS block AFTER the `@import "tw-animate-css";` line (and after any other `@import` lines that may be present — keep all imports grouped, then this rule below them). Find a sensible spot — ideally just after the imports but before any custom rules. If you find an existing media-query section, add it there; otherwise add it as a new top-level block:

```css
/* Phase 39: defense-in-depth reduced-motion override.
   tw-animate-css drives entry/exit via CSS custom properties; Tailwind's
   `motion-reduce:animate-none` variant SHOULD nullify it, but this @media
   rule is a belt-and-suspenders safeguard so the animation is fully
   cancelled for any user with prefers-reduced-motion: reduce. */
@media (prefers-reduced-motion: reduce) {
  .animate-in,
  .animate-out {
    animation: none !important;
    transition: none !important;
  }
}
```

Do NOT remove or modify any existing rules. Do NOT add other reduced-motion rules in this plan (the `Skeleton` primitive isn't used by `BookingFormSkeleton` per Plan 39-02, so its `animate-pulse` is not in scope here).

Then commit:

```
git add app/globals.css
git commit -m "feat(39-03): add prefers-reduced-motion override for tw-animate-css enter/exit"
```
  </action>
  <verify>
1. `grep -n "prefers-reduced-motion: reduce" app/globals.css` returns at least one match.
2. `grep -n "\.animate-in" app/globals.css` returns at least one match.
3. `npm run build` succeeds (CSS still parses).
  </verify>
  <done>
- `@media (prefers-reduced-motion: reduce)` block added with `.animate-in, .animate-out { animation: none !important; transition: none !important; }`.
- Comment explains why the rule exists.
- Atomic commit `feat(39-03): ...` for the CSS change.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
The form column now animates in over ~220ms on first slot pick with a fade + 8px upward rise, using `tw-animate-css` utilities on a wrapper div. A `@media (prefers-reduced-motion: reduce)` override in `globals.css` fully suppresses the animation when OS reduced-motion is enabled. The wrapper has no `key` prop, so re-picks do NOT re-trigger the animation — `BookingForm` stays mounted (Plan 39-01 lock intact).
  </what-built>
  <how-to-verify>
**A. Animation correctness (reduced-motion OFF):**

1. macOS: System Settings > Accessibility > Display > Reduce Motion = OFF. Windows: Settings > Accessibility > Visual effects > Animation effects = ON.
2. `npm run dev`, open a booker URL, hard refresh.
3. Pick a slot. The form column should fade in and rise ~8px over ~220ms. The animation should feel smooth, not jarring.
4. Pick a DIFFERENT slot. The form column should NOT re-animate — it stays in place; only the form's internal slot data updates. (If you see a fade/rise on re-pick, the wrapper has been keyed somewhere — STOP and report.)
5. Open Chrome DevTools > Performance tab. Click record, then pick a slot, then stop recording. Look at the "Experience" lane — Cumulative Layout Shift must read 0.000. (If CLS > 0, report the value and the layout-shift target.)

**B. Reduced-motion correctness:**

6. Enable OS reduced-motion (macOS: Reduce Motion ON; Windows: Animation effects OFF). Hard refresh the booker page.
7. Pick a slot. The form must appear INSTANTLY — no fade, no rise, no transition of any kind.
8. (Sanity) Disable OS reduced-motion again, hard refresh, pick a slot — animation should resume.

**C. V15-MP-05 lock still intact (regression check):**

9. With reduced-motion OFF, before picking any slot, open React DevTools — `BookingForm` is absent.
10. Pick slot A, type a name, wait for Turnstile to solve.
11. Pick slot B. `BookingForm` stays mounted (no remount), Name field still has the typed value, Turnstile not re-challenged.
12. Submit — booking succeeds.

Type "approved" if A, B, and C all pass. If reduced-motion still shows the animation, if CLS > 0, if the animation re-fires on re-pick, or if `BookingForm` remounts, describe exactly what you saw.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- First-pick animation: 220ms fade + 8px rise via transform/opacity only.
- Re-pick: no re-animation; BookingForm stays mounted; field values persist.
- Reduced-motion: animation fully suppressed; instant skeleton-to-form swap.
- CLS = 0.0 in DevTools Performance / Lighthouse.
- V15-MP-05 lock from Plan 39-01 still holds.
</verification>

<success_criteria>
- Phase Success Criteria #1 satisfied: 200-250ms entry via transform/opacity only, CLS = 0.0.
- Phase Success Criteria #3 satisfied: reduced-motion suppresses animation entirely.
- Phase Success Criteria #4 satisfied: BookingForm stays absent pre-pick, mounted-once post-pick, Turnstile token does not stale.
- (Combined with Plans 39-01 and 39-02, all four phase Success Criteria are met.)
</success_criteria>

<output>
After completion, create `.planning/phases/39-booker-polish/39-03-SUMMARY.md` documenting the wrapper diff, the globals.css addition, and the verified outcomes for sections A/B/C of the verification block above. Include CLS measurement number from DevTools.
</output>
