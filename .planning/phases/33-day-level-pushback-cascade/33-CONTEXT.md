# Phase 33: Day-Level Pushback Cascade - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Owner triggers a day-level cascade reschedule from `/app/bookings`: pick a date + anchor booking + delay (min OR hr) + optional reason → see a smart-cascade preview classifying each booking as Move / Gap-absorbed / Past-EOD with email-count + remaining-quota gate → commit pushes the affected bookings through the existing reschedule lifecycle (audit row, .ics METHOD:REQUEST SEQ+1, brand-neutral booker email with cancel link, owner notification) with race-safety re-query at commit and a persistent post-commit summary surfacing per-booking send status with retry on failures.

Out of scope: changing the cascade algorithm itself (locked by PUSH-06), introducing new email content variants beyond reason text, mass-cancel-instead-of-push fallback, scheduling pushbacks for later execution.

</domain>

<decisions>
## Implementation Decisions

### Dialog entry & input UX
- **Pushback button placement:** BOTH a page-header action on `/app/bookings` (top-right, primary entry — opens dialog with today pre-selected) AND a per-day-section button on each day group in the bookings list (shortcut — opens dialog pre-filled with that day's date).
- **Anchor selection:** Explicit radio-button column on the left of every booking row inside the dialog. Defaults to selecting the first (earliest) booking on the chosen date. Accessible / unambiguous — no whole-row click semantics.
- **Delay input format:** Single number input next to a segmented `[Min | Hr]` toggle. Matches PUSH-04 "minutes OR hours" semantics — one or the other, never both. Number input enforces positive integer.
- **Reason field:** Always-visible textarea below the delay row. Placeholder text suggests examples (e.g., "Running late from earlier appointment"). 280-character counter visible. Optional per PUSH-05.

### Preview layout
- **Format:** Single chronological list (time-ordered) with a colored state badge per row: `[MOVE]` / `[ABSORBED]` / `[PAST EOD]`. Time order preserved; status communicated via badge, not section grouping.
- **Row metadata:** Old time → new time, booker first name, duration (e.g., "30min"). No event-type label, no full name — keeps rows compact and PII-light.
- **Quota indicator placement:** Footer of preview, immediately above/beside the Confirm button. Format: "Sending N emails · M remaining today". Visually couples the gate to the commit affordance.
- **Past-EOD visual cue:** Amber badge + ⚠ warning icon on the row. Does NOT block commit (per PUSH-07 these still send through normal lifecycle); cue communicates "owner should know" not "error."
- **Empty state:** When the chosen date has no bookings to push (or anchor is the last booking with no later ones), show "No bookings to move on this date." and disable the Confirm button. Date picker stays enabled so owner can change date.

### Cascade math
- **Buffer-after-minutes interaction:** When chaining a moving booking's new start, formula is `prior new end + prior event-type's buffer-after-minutes, then slot-rounded`. Matches Phase 28 buffer semantics applied throughout the slot engine — pushback math stays consistent with the rest of the app.
- **Slot rounding:** New start times round UP to the next slot in the grid (matches PUSH-06 "rounded up to the next available slot per existing slot-engine semantics"). No mid-grid landings.
- **Max delay cap:** None. Owner can enter any positive integer; cascade naturally classifies overflow bookings as PAST EOD per PUSH-07. Respects PUSH-04's "positive integer" wording without adding arbitrary limits.
- **Date picker range:** Today + future only. Past dates are disabled in the picker — past bookings are immutable history with no practical pushback effect.

### Commit & race-safety strategy
- **Race-window strategy = re-query + abort if diverged.** At commit start, re-fetch the day's confirmed bookings; if the set differs from the preview-approved IDs at all (booker cancelled, booker rescheduled, new booking landed), abort the commit with a "Bookings changed — review again" message and owner re-previews. STRICTER than Phase 32's preview→commit→union pattern (justified: pushback affects every booking from anchor forward, so any divergence invalidates the cascade math itself; Phase 32 only added unavailable windows where union was safe).
- **Constraint enforcement:** New times pass through the existing v1.4 EXCLUDE GIST + v1.1 capacity index at the per-booking UPDATE layer (PUSH-11). Race-window violations surface as per-row failures in the post-commit summary; owner-initiated retry uses the same path.
- **Quota gate (EMAIL-22):** Pre-flight check at preview render — `needed = affected.length` (each affected booking sends 1 booker reschedule email). Inline error UX matches Phase 31 / Phase 32 vocabulary (`text-sm text-red-600`, `role="alert"`, "X email(s) needed, Y remaining today. Quota resets at UTC midnight. Wait until tomorrow or contact bookers manually."). Commit button disabled until quota allows.

### Post-commit failure UX
- **Summary shape:** Per-booking list. Every affected booking row shown with a status badge: `Sent` / `Failed` / `Skipped`. Owner sees exactly which bookings need follow-up — no top-line counts hiding detail.
- **Failure recovery affordance:** Each failed row gets a per-row "Retry email" button. Booking time has already been updated; only the .ics + email send needs to retry. Server action wraps a single-send retry path through the same quota guard.
- **Summary fate:** Replaces the preview content INSIDE the dialog and persists until the owner explicitly clicks Close. No auto-dismiss, no toast, no /app/bookings banner. Owner can't accidentally lose the failure list.

### Email content (LD-07 booker-neutrality lock)
- "Sorry for the inconvenience" copy + the owner's reason text (when provided) appear in the booker-facing reschedule email body. Audience-neutral — no NSI branding on booker surfaces (existing v1.5 lock preserved). Reason text is the same string in every email of the batch (PUSH-05).

### Claude's Discretion
- Exact dialog dimensions, padding, typography (defer to existing dashboard patterns)
- Animation/transition between preview state and post-commit summary state
- Loading skeleton during preview compute and during commit
- Exact wording of "Bookings changed — review again" abort message
- Server action file placement (likely `actions-pushback.ts` alongside the existing `actions-batch-cancel.ts` precedent from Phase 32)
- Reason text placement within the email body (header line vs quoted block) — match existing reschedule email tone

</decisions>

<specifics>
## Specific Ideas

- **Mirror Phase 32's "preview-then-commit with HARD quota gate" pattern, but stricter on the race window.** Phase 32 used preview → write override → re-query → union (additive — safe to include race-window bookings). Phase 33 uses preview → re-query → abort-if-diverged (mutative — cascade math depends on the exact set).
- **Reuse Phase 31 inline quota error vocabulary verbatim.** Don't invent a new copy or visual treatment for EMAIL-22 — Phase 31 (reminder) and Phase 32 (AVAIL auto-cancel) already locked the pattern.
- **The per-day-section Pushback button is a shortcut, not a duplicate.** It opens the same dialog as the header button, just pre-filled with that section's date. Single source of truth for the dialog component.
- **Owner sees first names only in the preview.** Reduces row width, lowers PII surface in screenshots/screen-shares for a feature owners may use under stress.

</specifics>

<deferred>
## Deferred Ideas

- **Per-booking opt-out from the cascade** (let owner uncheck specific bookings in the preview) — would change PUSH-06's deterministic cascade into a partial-set algorithm. Out of scope for v1.6; consider for a future "manual override" milestone.
- **Scheduled pushbacks** (queue a pushback for later execution) — different mental model entirely (drift between schedule and execute breaks race-safety). Separate phase.
- **Mass-cancel-instead-of-push fallback** when delay exceeds workday — cancellation is a different lifecycle and a different audience expectation. AVAIL-06 (Phase 32) already provides batch cancel via a different surface.
- **"Bookings changed" diff display** on abort — instead of a generic "review again" message, show owner exactly what changed (cancelled X, new booking Y). Nice-to-have; not required for correctness. Consider for v1.7 polish.
- **Persistent-banner post-commit summary** on `/app/bookings` (so owner can review failures later without keeping the dialog open) — heavier UX; defer until we see if the in-dialog summary is missed.

</deferred>

---

*Phase: 33-day-level-pushback-cascade*
*Context gathered: 2026-05-05*
