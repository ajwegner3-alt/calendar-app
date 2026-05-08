---
phase: 38-magic-link-login
plan: 02
subsystem: auth
tags: [magic-link, supabase, useActionState, radix-tabs, react-server-actions, login-ui]

# Dependency graph
requires:
  - phase: 38-magic-link-login
    provides: requestMagicLinkAction server action, MagicLinkState type, magicLinkSchema (Plan 01)
  - phase: 34-google-oauth-signup-and-credential-capture
    provides: GoogleOAuthButton + divider above the email-auth Card layout (locked)
provides:
  - Password | Magic-link Tabs control inside the email-auth Card on /app/login
  - MagicLinkSuccess inline-replace component (CONTEXT-locked copy + 30s resend countdown)
  - Updated /app/login subtitle reflecting both auth options
affects: [38-03 (Supabase email template config), Phase 40 (final manual QA pass)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Radix Tabs unmount-resets-state pattern (no key prop needed for state cleanup on tab switch)"
    - "Distinct id-per-tab pattern (id='email-password' / id='email-magic') to satisfy unique-DOM-id rule when same logical input appears in multiple TabsContent panels"
    - "Two useActionState hooks isolated in separate components within one form (LoginForm + MagicLinkTabContent inner) — each tab owns its own action state without cross-contamination"

key-files:
  created:
    - "app/(auth)/app/login/magic-link-success.tsx — Inline success/resend client component (30s setInterval cooldown, hidden email input for resend)"
  modified:
    - "app/(auth)/app/login/login-form.tsx — Added Tabs(defaultValue=password) inside CardContent; new inner MagicLinkTabContent component owns useActionState(requestMagicLinkAction). Google OAuth button + divider untouched ABOVE the Card."
    - "app/(auth)/app/login/page.tsx — Subtitle copy update only"

key-decisions:
  - "MagicLinkTabContent extracted as inner component (not inlined in LoginForm) so Radix's default unmount-on-tab-switch resets BOTH useActionState and submittedEmail in one move"
  - "onSubmit captures email synchronously into local state without preventDefault — form still submits via server action; capture is purely for the success-state hand-off"
  - "Cooldown starts at 30s on MagicLinkSuccess mount (not 0 like resend-verification-button) because the parent only mounts this component AFTER a successful initial send — the user just submitted, immediate resend would be wasted"
  - "id='email-password' chosen over id='email' to free 'email' for unambiguous future use AND avoid duplicate-id collision with id='email-magic' under the same DOM tree (Radix keeps both TabsContent panels mounted in some configurations; defensive even though current Radix behavior unmounts inactive)"

patterns-established:
  - "Radix Tabs unmount-resets-state — switching tabs unmounts inactive TabsContent by default, which discards local useState and useActionState. Future Tabs work that needs state-reset-on-switch can rely on this without `key` prop gymnastics."
  - "Distinct-IDs-per-tab — when the same logical field (e.g., email) appears in multiple TabsContent panels, give each a unique `id` (id='email-password', id='email-magic') with matching `<Label htmlFor>`. Duplicate IDs in the same DOM tree are invalid HTML."
  - "Cooldown-on-mount for resend components — when the parent only mounts a resend component after an initial successful send, start cooldown at the cooldown value (not 0). Saves a wasted-click round-trip. Distinct from resend-verification-button which starts at 0 because that component is mounted on a standalone /verify-email page where the user may not have just submitted."

# Metrics
duration: ~12min
completed: 2026-05-08
---

# Phase 38 Plan 02: login-form-tabs-and-success-component Summary

**Wired Plan 38-01's `requestMagicLinkAction` into `/app/login` via a Password|Magic-link Tabs control inside the existing email-auth Card, with an inline MagicLinkSuccess state featuring a 30-second resend countdown — Phase 34's Google OAuth button + divider remain untouched above the Card.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-08
- **Completed:** 2026-05-08
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 edited)

## Accomplishments

- New `MagicLinkSuccess` client component renders the CONTEXT-locked success copy verbatim ("If an account exists for that email, we sent a login link. Check your inbox.") plus a 15-minute expiry note and a 30-second-cooldown Resend button.
- Restructured `LoginForm` to wrap the existing email/password form inside `<Tabs defaultValue="password">` + a new `<TabsContent value="magic-link">` containing a small inner `MagicLinkTabContent` component. Phase 34 Google-button-above-Card layout fully preserved.
- Login page subtitle updated to "Sign in with your email and password or a magic link." reflecting the new dual-mode auth UX.
- `npx tsc --noEmit` clean for Phase 38 source files; `next build` succeeds end-to-end.

## Task Commits

Each task was committed atomically:

1. **Task 1: MagicLinkSuccess component** — `ecd3dc5` (feat)
2. **Task 2: Password|Magic-link Tabs in LoginForm** — `8cafad2` (feat)
3. **Task 3: Login page subtitle update** — `2161052` (chore)

**Plan metadata:** _to be filled_

## Files Created/Modified

- `app/(auth)/app/login/magic-link-success.tsx` (NEW, 86 lines) — Client component: 30s resend cooldown, hidden-email forwarding, exact CONTEXT copy, 5xx Alert.
- `app/(auth)/app/login/login-form.tsx` (modified) — Tabs control inside CardContent. New inner `MagicLinkTabContent` owns `useActionState(requestMagicLinkAction)`. Google button + divider above Card untouched (Phase 34 lock verified at line 106 vs Card open at line 120).
- `app/(auth)/app/login/page.tsx` (1-line copy change) — Subtitle now mentions both auth options.

## Decisions Made

- **Inner-component extraction for the magic-link tab body:** `MagicLinkTabContent` is defined as a sibling function inside `login-form.tsx` rather than inlining its hooks in `LoginForm`. This isolates the second `useActionState` and the `submittedEmail` state from the password form's state and lets Radix's natural unmount-on-tab-switch fully reset the magic-link sub-tree without `key` prop tricks.
- **Cooldown starts at 30 on `MagicLinkSuccess` mount** (vs the 60s starts-at-0 pattern in `resend-verification-button.tsx`). Justification: the parent only mounts this component AFTER a successful initial submit, so a 0-second start would invite an immediate redundant resend click. The verify-email button starts at 0 because it lives on a standalone page where a user might land via email link without having just submitted.
- **`id="email-password"` rename in the password tab** to a tab-scoped id even though it could remain `id="email"`. Defensive against any future Radix configuration that keeps both TabsContent panels mounted simultaneously (would produce duplicate `id="email"` — invalid HTML, accessibility issue). Matches the new `id="email-magic"`.
- **Subtitle wording** ("Sign in with your email and password or a magic link.") chosen over alternatives like "Choose how you want to sign in" — it preserves the original sentence rhythm and explicitly names both options without sounding marketing-y. RESEARCH OQ-4 was deferred to executor; CONTEXT does not lock this so a one-line change post-execution is trivial if a reviewer prefers different copy.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing `npx tsc --noEmit` errors in `tests/reminder-cron.test.ts`, `tests/upgrade-action.test.ts`, `tests/bookings-api.test.ts`, `tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/owner-note-action.test.ts` are unrelated to Phase 38. They are test-file mock-shape errors and `parameter implicitly any` issues that were already present on the tip of `main` before Plan 02 started. Production source compiles cleanly; `next build` succeeds.

## User Setup Required

None - no external service configuration required for this plan. (Plan 38-03 will cover the Supabase email-template config that activates click-through authentication.)

## Next Phase Readiness

- **Plan 38-03 (Supabase email template) is unblocked.** All client-visible UI for magic-link login is now functional in dev. Submitting the magic-link form on `/app/login` produces the inline success state; clicking the link in email will not yet authenticate until Plan 03 lands the Supabase email template + auth confirm route wiring.
- **Manual QA in Phase 40** will need to:
  1. Verify Tabs render on `/app/login` with Password active by default.
  2. Verify Google OAuth button + "or" divider remain above the Card.
  3. Submit a known email on the magic-link tab → success state with 30s countdown.
  4. Submit an invalid email → Zod fieldError ("Enter a valid email address.").
  5. Switch tabs back-and-forth → magic-link form re-mounts empty.
  6. Resend button: disabled during 30s, ticks down to 0, re-fires action, re-enters 30s on success.

---
*Phase: 38-magic-link-login*
*Plan: 02*
*Completed: 2026-05-08*
