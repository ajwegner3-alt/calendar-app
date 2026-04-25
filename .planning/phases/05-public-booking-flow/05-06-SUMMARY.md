---
phase: 05-public-booking-flow
plan: "06"
subsystem: ui
tags: [react, next.js, react-hook-form, zod, cloudflare-turnstile, date-fns, react-day-picker, client-components]

# Dependency graph
requires:
  - phase: 05-03
    provides: bookingInputSchema (RHF zodResolver source) from lib/bookings/schema.ts
  - phase: 05-04
    provides: page.tsx with PLAN-05-06-REPLACE-* markers; AccountSummary/EventTypeSummary/BookingPageData types from _lib/types.ts
  - phase: 05-05
    provides: POST /api/bookings route handler (201/400/403/409/5xx responses); data.redirectTo in 201 body
  - phase: 04-06
    provides: GET /api/slots with LOCKED response shape {slots: Array<{start_at, end_at}>}
  - phase: 04-05
    provides: react-day-picker modifiersClassNames pattern (.day-blocked/.day-custom CSS in globals.css)
provides:
  - BookingShell client component: TZ detection + step state + SlotPicker + BookingForm + RaceLoserBanner wired together
  - SlotPicker: 30-day slot fetch, calendar with accent-dot markers (day-has-slots), booker-TZ slot list, empty state
  - BookingForm: RHF + zodResolver, Managed Turnstile widget, contact fields + custom questions, full error handling
  - RaceLoserBanner: inline destructive alert for 409 SLOT_TAKEN UX
  - page.tsx patched: real import replaces inline stub; @ts-expect-error removed
  - globals.css: .day-has-slots::after rule with --color-accent dot
affects:
  - 05-07 (confirmation page — router.push(data.redirectTo) lands here; BookingShell does not own the confirmed route)
  - 05-08 (integration tests — all 4 client components + page.tsx are test targets)
  - Phase 9 (manual QA — visit /nsi/<slug>, pick slot, fill form, submit, verify 409 banner, verify 201 redirect)

# Tech tracking
tech-stack:
  added: []  # @marsidev/react-turnstile already installed in Plan 05-03 deps; no new packages
  patterns:
    - "RHF formOnlySchema.pick() subset: RHF holds only bookerName/bookerEmail/bookerPhone/answers; eventTypeId/startAt/endAt/bookerTimezone/turnstileToken layered at submit time"
    - "zodResolver(formOnlySchema) as any cast — same Phase 3 lock for zod v4 + @hookform/resolvers v5 friction"
    - "Managed Turnstile widget (visible, no size=invisible) — ref.getResponse() at submit; ref.reset() on every error path"
    - "Browser TZ detection: Intl.DateTimeFormat().resolvedOptions().timeZone in useEffect with account.timezone SSR fallback"
    - "refetchKey pattern: parent bumps integer state to trigger useEffect re-fetch in child without losing other props"
    - "Controller for Select/radio custom questions — Radix primitives don't forward refs (Phase 3 lock)"
    - "day-has-slots::after CSS dot using var(--color-accent) — mirrors Phase 4 .day-blocked/.day-custom pattern"

key-files:
  created:
    - app/[account]/[event-slug]/_components/booking-shell.tsx
    - app/[account]/[event-slug]/_components/slot-picker.tsx
    - app/[account]/[event-slug]/_components/booking-form.tsx
    - app/[account]/[event-slug]/_components/race-loser-banner.tsx
  modified:
    - app/[account]/[event-slug]/page.tsx
    - app/globals.css

key-decisions:
  - "formOnlySchema = bookingInputSchema.pick({bookerName,bookerEmail,bookerPhone,answers}) — RHF does NOT hold server-required fields; those are injected at submit time. Full bookingInputSchema validates the assembled body before POST."
  - "Managed Turnstile (NOT invisible) — CONTEXT decision #4 (revised). No size prop passed to <Turnstile>; Cloudflare auto-decides between silent pass and visible checkbox based on risk score."
  - "Turnstile reset on EVERY error path: 409, 400, 403, 5xx, network — RESEARCH Pitfall 5. Token is single-use; retry without reset always fails."
  - "409 race-loser: RaceLoserBanner shown ABOVE SlotPicker, not toast. Form values preserved (name/email/phone/answers NOT cleared). refetchKey bumped so SlotPicker re-fetches /api/slots immediately. Banner dismissed when user picks a new slot."
  - "bookerTimezone SSR safety: useState initializes to account.timezone; useEffect replaces with Intl result on mount. Server renders with owner TZ (never user TZ) — correct for initial HTML."
  - "SlotPicker refetchKey dependency: useEffect dependency array includes refetchKey so 409 path triggers an immediate re-fetch of /api/slots for the current range."
  - "CustomQuestionField switch: short_text (default/fallback) → Input; long_text → Textarea; select → Controller+Select; radio → Controller+native radio inputs with accent-primary. Falls back to short_text on unknown type per plan spec."
  - "Radio inputs: native <input type=radio> with Controller rather than a shadcn RadioGroup component (not installed). Pattern is clean; Phase 7 can swap to shadcn RadioGroup if installed."
  - "Slot list buttons: plain styled <button> (not shadcn Button) to avoid variant overhead on a dense list. Selected state uses bg-primary/text-primary-foreground."
  - "Page layout: BookingShell uses lg:grid-cols-[1fr_360px] — 1024px breakpoint. Form aside has h-fit to not stretch full height. Mobile: stacks vertically (SlotPicker above, aside below)."

patterns-established:
  - "refetchKey integer pattern: parent owns integer state; child's useEffect includes it as dep; bump = immediate re-fetch. Reusable for any child that needs externally-triggered refetch without full unmount/remount."
  - "formOnlySchema.pick() split: RHF validates user-facing fields only; server-required fields layered at submit. Prevents exposing hidden field state to RHF validation UX. Reuse in any form where server adds context fields."

# Metrics
duration: 35min
completed: 2026-04-25
---

# Phase 5 Plan 06: Booking Page Client Components Summary

**Interactive public booking page: calendar + slot picker in booker TZ, RHF form with Managed Turnstile, 409 race-loser banner with slot refetch, page.tsx stub replaced with real BookingShell import**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-25T (session)
- **Completed:** 2026-04-25
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Four client components built and wired end-to-end: BookingShell → SlotPicker + BookingForm + RaceLoserBanner
- SlotPicker fetches 30-day window from /api/slots, groups by booker TZ date for both calendar dots and slot list, handles empty state with mailto link
- BookingForm assembles full bookingInputSchema payload at submit time from RHF values + props; handles all 5 response statuses (201/400/403/409/5xx) with Turnstile reset on every error
- page.tsx inline stub replaced with real import; @ts-expect-error directive removed; build exits 0

## Task Commits

1. **Task 1: SlotPicker + RaceLoserBanner** - `f803e43` (feat)
2. **Task 2: BookingForm + BookingShell + page.tsx swap** - `b717c08` (feat)

**Plan metadata:** (included in this summary commit)

## Files Created/Modified

- `app/[account]/[event-slug]/_components/booking-shell.tsx` — Client root: browser TZ detection, step state (selectedDate/selectedSlot/refetchKey/showRaceLoser), renders SlotPicker + BookingForm + RaceLoserBanner in lg:grid-cols-[1fr_360px] layout
- `app/[account]/[event-slug]/_components/slot-picker.tsx` — Calendar (react-day-picker v9) with day-has-slots modifier dots; slot list in booker TZ via TZDate+format; 30-day window fetch from /api/slots; empty state with mailto
- `app/[account]/[event-slug]/_components/booking-form.tsx` — RHF + formOnlySchema.pick zodResolver; Managed Turnstile widget (visible); CustomQuestionField per question.type; full 201/400/403/409/5xx handling; reset on every error
- `app/[account]/[event-slug]/_components/race-loser-banner.tsx` — Inline destructive alert: "That time was just booked. Pick a new time below." (visible=true only)
- `app/[account]/[event-slug]/page.tsx` — Patched: real `import { BookingShell }` from `_components/booking-shell`; inline stub function removed; marker comments preserved
- `app/globals.css` — Added `.day-has-slots { position: relative }` + `.day-has-slots::after` with `--color-accent` dot (mirrors Phase 4 pattern)

## Decisions Made

- **formOnlySchema.pick() split:** RHF holds only `bookerName/bookerEmail/bookerPhone/answers`. Server-required fields (`eventTypeId/startAt/endAt/bookerTimezone/turnstileToken`) are injected at submit time from props/state. This prevents phantom validation errors on hidden fields and keeps the RHF state minimal.
- **Managed Turnstile (not invisible):** CONTEXT decision #4 revised. `<Turnstile ref={turnstileRef} siteKey={...} />` with no `size` prop. Cloudflare determines whether to show a checkbox or run silently. Better for trades audience (clear "verifying you're human" cue).
- **Turnstile reset on all error paths:** Per RESEARCH Pitfall 5, token is single-use. `turnstileRef.current?.reset()` called after 409, 400, 403, 5xx, and network errors. Without reset, retry always returns `timeout-or-duplicate` from Cloudflare.
- **409 flow — inline banner, not toast:** RaceLoserBanner renders ABOVE SlotPicker. Form values (name/email/phone/answers) are NOT cleared. refetchKey bumps immediately so /api/slots re-fetches. Banner dismisses when user picks a new slot. Matches CONTEXT decision #5 locked copy.
- **SSR TZ safety:** `useState(account.timezone)` for initial render; `useEffect(() => setBookerTz(Intl.DateTimeFormat().resolvedOptions().timeZone), [])` replaces on mount. Server-rendered HTML uses owner TZ (Chicago) — acceptable; hydration swaps to browser TZ within ~16ms.
- **CustomQuestionField fallback:** Unknown question types fall through to `short_text` (Input) case via switch default. Plan spec: "Falls back to text input on unknown type."
- **Radio inputs:** Native `<input type="radio">` with Controller, not shadcn RadioGroup (not installed). Controller required because native radio doesn't forward ref to RHF.
- **Slot buttons:** Plain styled `<button>` rather than shadcn Button component. Selected state: `bg-primary text-primary-foreground border-primary`. Avoids shadcn variant overhead on dense list.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — build exited 0 on first attempt for both tasks.

## User Setup Required

None beyond env vars already required (NEXT_PUBLIC_TURNSTILE_SITE_KEY for the Turnstile widget to render). Already captured in STATE.md checkpoint from Plan 05-02.

## Next Phase Readiness

- Phase 5 Plan 05-07 (confirmation page at `/[account]/[event-slug]/confirmed/[booking-id]`) — BookingForm does `router.push(data.redirectTo)` where `redirectTo` = `/${account}/${slug}/confirmed/${bookingId}`. That route is currently unbuilt (404). Plan 05-07 builds it.
- Phase 5 Plan 05-08 (integration tests) — all 4 components + page.tsx are test targets.
- Phase 9 manual QA items: visit /nsi/<active-event-slug>, pick a date, verify slot list in browser TZ, pick a slot, fill form, verify Turnstile widget renders, submit; test 409 race-loser by booking same slot in two tabs.

---
*Phase: 05-public-booking-flow*
*Completed: 2026-04-25*
