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
