---
phase: 39-booker-polish
plan: 01
subsystem: ui
tags: [react, react-hook-form, turnstile, next.js, booker, lifecycle]

# Dependency graph
requires:
  - phase: 23-public-booking-fixes
    provides: BookingShell three-column layout and conditional BookingForm mount
  - phase: V15-MP-05 (Turnstile lifecycle lock)
    provides: BookingForm-as-Turnstile-host pattern; placeholder-as-div invariant
provides:
  - BookingForm instance lifecycle preserved across slot re-pick on the same date
  - RHF field values (name, email, notes, phone) persist across slot re-pick
  - Turnstile widget no longer re-challenges or stales on slot re-pick
  - Updated comment block in booking-shell.tsx documenting the new lifecycle guarantee
affects: [booker-polish, turnstile, public-booking, future-form-state-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React instance preservation: omit key prop on conditionally-mounted form so prop changes update without remount"
    - "Slot data flows via props (selectedSlot) — read at submit time, not via remount"

key-files:
  created:
    - .planning/phases/39-booker-polish/39-01-SUMMARY.md
  modified:
    - app/[account]/[event-slug]/_components/booking-shell.tsx

key-decisions:
  - "Option A (Andrew): date-change clearing the form is acceptable in-scope behavior; selectedSlot becoming null on date change is the intended unmount trigger"
  - "Single-line root-cause fix preferred over wrapping form in stable parent or hoisting form state"

patterns-established:
  - "Conditional mount without key: `{cond ? <Form ... /> : <Placeholder />}` — instance persists across prop changes, unmounts only when cond flips false"
  - "V15-MP-05 lock + field-persistence guarantee documented inline above the conditional mount in booking-shell.tsx"

# Metrics
duration: ~10 min (single-line edit + live verify)
completed: 2026-05-08
---

# Phase 39 Plan 01: Key Prop Removal Summary

**Removed `key={selectedSlot.start_at}` from `<BookingForm>` in booking-shell.tsx — single-line fix that simultaneously preserves the V15-MP-05 Turnstile lifecycle lock and the Phase 39 field-value-persistence guarantee.**

## Performance

- **Duration:** ~10 min (1 atomic code commit + live verification on production)
- **Completed:** 2026-05-08
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Removed the forced-remount `key` prop so `BookingForm` persists across slot re-picks on the same date
- Updated the surrounding comment block in `booking-shell.tsx` to document the new lifecycle guarantee (V15-MP-05 lock + Phase 39 field-persistence)
- Verified live on production: form is absent before any slot pick, mounts on first pick, persists across slot re-pick with field values intact, and Turnstile does not re-challenge

## Task Commits

1. **Task 1: Delete the key prop from BookingForm** — `7b0ec82` (fix)
   - `fix(39-01): remove key prop from BookingForm to preserve V15-MP-05 lock and field persistence`
   - 1 file changed, 3 insertions(+), 2 deletions(-)
   - Pushed to `origin/main`

2. **Task 2: Live verification (human-verify checkpoint)** — approved by Andrew on production
   - No additional commit (verification only)

**Plan metadata:** this SUMMARY commit (`docs(39-01): complete key-prop-removal plan`)

## Files Created/Modified

- `app/[account]/[event-slug]/_components/booking-shell.tsx` — Removed `key={selectedSlot.start_at}` from `<BookingForm>` mount; rewrote the preceding comment block to reflect that `BookingForm` has NO `key` prop and must remain mounted across re-picks once mounted on first slot pick.

### Diff (essence)

```diff
- {/* Col 3: Form column ... key={selectedSlot.start_at} forces RHF reset on slot change. */}
+ {/* Col 3: Form column — fixed 320px reserved at all times.
+     V15-MP-05 LOCK: placeholder is a <div>, NOT a mounted <BookingForm>.
+     Turnstile mounts on BookingForm mount (~2-min token expiry).
+     BookingForm has NO `key` prop — once mounted on first slot pick, it must
+     remain mounted across re-picks so RHF field values and the Turnstile
+     token persist (Phase 39 field-persistence guarantee + V15-MP-05). */}
  {selectedSlot ? (
    <BookingForm
-     key={selectedSlot.start_at}
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

## Decisions Made

- **Option A (Andrew, locked decision):** A date change which causes `selectedSlot` to become `null` is allowed to unmount `BookingForm` and therefore clear the form. This is the existing conditional-render contract and is considered in-scope for the current phase. Persisting fields across a full date change would require lifting form state (or restructuring the conditional) and is explicitly deferred.
- **Single-line fix preferred:** Removing the `key` prop is the minimum-surface-area change that delivers both Phase 39 (field persistence on slot re-pick) and the V15-MP-05 lock (no Turnstile re-challenge on re-pick). No alternate refactor (state hoisting, stable wrapper component, etc.) was needed.

## Deviations from Plan

None — plan executed exactly as written. The single-line removal and the comment rewrite both landed in one atomic commit, type-check and build were green, and the human-verify checkpoint passed on the first try.

## Issues Encountered

None during execution. The only "issue" surfaced is a known scope boundary, not a defect:

- **Date change clears form (by design).** When the user changes the calendar date, `selectedSlot` becomes `null`, the conditional flips, and `BookingForm` unmounts — clearing typed values and the Turnstile token. Per Andrew's Option A decision this is acceptable scope. Captured below as a future enhancement candidate, not as a defect.

## User Setup Required

None — no external service configuration changed. Turnstile site key, Supabase config, and all other env vars are unchanged.

## Next Phase Readiness

- BookingForm lifecycle is now stable across slot re-pick on the same date. V15-MP-05 lock is preserved AND the Phase 39 field-persistence guarantee is delivered with a single-line change.
- Production deploy via `origin/main` push is live; verification was performed against the production booker URL and all four DevTools checks passed.
- **Potential future enhancement (deferred, NOT a blocker):** Persist typed form values across a full date change. Would require lifting RHF state above the conditional mount, or restructuring so the form column never unmounts. Explicitly out of scope for Phase 39 per Andrew's Option A decision; revisit only if user feedback shows it's needed.

---
*Phase: 39-booker-polish*
*Plan: 01-key-prop-removal*
*Completed: 2026-05-08*
