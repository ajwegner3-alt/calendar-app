# Phase 28: Per-Event-Type Buffer Wire-Up + Account Column Drop - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Owners can set a per-event-type post-event buffer (`event_types.buffer_after_minutes`); the slot engine and event-type editor read/write that column; the legacy account-wide control (`accounts.buffer_minutes` + Availability-page Buffer field) is permanently retired via the CP-03 two-step deploy with a ≥30-min drain between deploys.

Locked by research (do not re-decide):
- **Column name:** `event_types.buffer_after_minutes` (LD-01) — already exists in production with correct semantics; do NOT add a `post_buffer_minutes` column.
- **Phase order:** Buffer → Rebrand → Booker (LD-08).
- **Deploy protocol:** CP-03 mandatory ≥30-min drain between Plan 28-01 (rewire + backfill) and Plan 28-02 (DROP). DROP migration file held local during drain.
- **Pre-flight gate (28-01):** `SELECT id, slug, buffer_after_minutes FROM event_types WHERE buffer_after_minutes <> 0` must return 0 rows before backfill runs.
- **Drain gate (28-02):** `grep -rn "buffer_minutes" app/ lib/` must return 0 matches before DROP migration applies.
- **Migration apply path:** `echo | npx supabase db query --linked -f <file>` (the `supabase db push --linked` path is broken in this repo).

</domain>

<decisions>
## Implementation Decisions

### Buffer control UI (event-type editor)
- **Input type:** Plain number input, `min=0`, `max=360`, `step=5`. No slider, no stepper buttons, no preset dropdown.
- **Position:** Place the field directly after the existing Duration field — pair them visually as adjacent "how long" inputs.
- **Label:** `Buffer after event` (matches column-name semantics; explicit about WHEN the buffer applies).
- **Help text:** Yes — one short hint line below the field. Plain-language description of what the buffer does (no concrete numeric example needed). Match the tone of any existing field hints in the editor.

### Backfill semantics (Plan 28-01 migration)
- **Idempotent:** Use `WHERE buffer_after_minutes = 0` (or equivalent guard) so a second run is a no-op. Pre-flight gate already proves the pre-state, but idempotency is cheap insurance.
- **Source value & scope filter:** Claude's discretion — pick based on actual production data patterns at migration time (see Claude's Discretion below). The default expectation is to preserve current behavior for any account that had a non-zero account-wide buffer, but Claude verifies the row counts before locking the SQL.
- **Drain-window default for new event types:** `0` (DB default). If an owner creates a new event type between Plan 28-01 deploy and Plan 28-02 DROP, the form defaults the buffer to 0. Do NOT add temporary code to read `accounts.buffer_minutes` as a fallback default — the drain window is brief and 0 is a safe, predictable default.

### Display & default value
- **Default for new event types:** `0` minutes. No automatic non-zero default; owner opts in.
- **Empty input on save:** Treat empty string as `0`. Forgiving — do not block save with a "required" error.
- **Display of `0` in editor:** Show literal `0` in the input field with the `min` suffix. No "No buffer" placeholder.
- **Display on event-types list/index:** Always show the buffer value for every event type (e.g. `Buffer: 15 min` or `Buffer: 0 min`). Never hide it for zero values.

### Claude's Discretion
- **Backfill source value:** Choose based on what makes most sense given production data — most likely: copy each account's current `buffer_minutes` into all of that account's `event_types.buffer_after_minutes` rows so existing behavior is preserved. Verify with a `SELECT` before writing the UPDATE.
- **Backfill scope filter:** Choose between "all rows" vs "active/non-archived only" based on whether soft-delete or `archived` exists on `event_types` in the current schema. Default to all rows unless soft-delete is present and there's a clear reason to skip those rows.
- **Availability panel cleanup (entire area):** Andrew deferred all four sub-questions to Claude.
  - Whether to add an inline acknowledgment note ("Buffer is now set per event type — edit individual event types"), or remove silently.
  - Whether to collapse the section heading if Buffer was the only field in it, or leave the section.
  - Whether to add a cross-link from the Availability page to the event-type editor.
  - Whether to audit and update any surrounding copy (page title, subtitle, section headings) that mentioned buffer.
  - Read the current `app/.../availability` page first; pick based on what's actually there. Bias toward minimal change — silent removal + collapse-if-empty is the likely default unless the existing copy makes the field's absence confusing.
- **Validation / error UX details:** Inline error on out-of-range or non-multiple-of-5 input; pick wording consistent with other editor fields.
- **Help-text exact wording:** One line, plain language, no example needed.
- **Mobile sizing & save-state feedback:** Match existing event-type form patterns.
- **Backfill SQL idempotency mechanic:** Pick the cleanest `WHERE` guard (e.g. `WHERE buffer_after_minutes = 0 AND <account-buffer-exists>`).

</decisions>

<specifics>
## Specific Ideas

- The Buffer field should sit visually paired with Duration on the event-type editor — they're both "how long does this take" semantics.
- Do not surprise owners: an existing 15-min account-wide buffer should keep working as a 15-min per-type buffer on every existing event type after the backfill (preserve current production behavior).
- Drain window is brief enough that a hard `0` default for newly-created event types during the window is acceptable — no temporary fallback-default code worth writing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Pre-event buffer, per-event-type minimum notice override, etc. would be future-phase work and were not raised.)

</deferred>

---

*Phase: 28-per-event-type-buffer-and-column-drop*
*Context gathered: 2026-05-03*
