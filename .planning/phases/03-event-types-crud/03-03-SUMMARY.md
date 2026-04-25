---
phase: 03-event-types-crud
plan: 03
subsystem: api
tags: [zod, supabase, server-actions, soft-delete, slug, typescript, rls]

# Dependency graph
requires:
  - phase: 03-01
    provides: event_types table with deleted_at + partial unique index on (account_id, slug) WHERE deleted_at IS NULL
  - phase: 03-02
    provides: shadcn primitives + Sonner Toaster in root layout
  - phase: 02-04
    provides: current_owner_account_ids() RPC (flat UUID array); RLS-scoped createClient()
provides:
  - lib/slugify.ts — isomorphic slugify(str) utility; no npm dep
  - app/(shell)/app/event-types/_lib/types.ts — CustomQuestion union, EventTypeRow, EventTypeListItem
  - app/(shell)/app/event-types/_lib/schema.ts — customQuestionSchema (discriminatedUnion), eventTypeSchema, EventTypeInput
  - app/(shell)/app/event-types/_lib/actions.ts — all 5 Server Actions (create/update/softDelete/restore/toggle) + EventTypeState + RestoreResult types
affects:
  - 03-04 (list page) — imports EventTypeListItem, toggleActiveAction, softDeleteEventTypeAction, restoreEventTypeAction
  - 03-05 (form pages) — imports EventTypeInput, EventTypeState, createEventTypeAction, updateEventTypeAction, slugify
  - all future phases that touch event_types — slug-uniqueness pre-flight pattern is the source of truth

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Direct-call Server Action contract (actions accept EventTypeInput, NOT FormData)
    - Slug pre-flight SELECT filtered to .is('deleted_at', null) before INSERT/UPDATE
    - 23505 race-defense: catch Postgres unique_violation for slug collision after concurrent saves
    - RestoreResult discriminated union: {ok}, {slugCollision, currentSlug}, {error}
    - resolveAccountId() private helper extracts current_owner_account_ids() RPC pattern
    - redirect() as last statement, no try/catch wrapping anywhere in actions.ts

key-files:
  created:
    - lib/slugify.ts
    - app/(shell)/app/event-types/_lib/types.ts
    - app/(shell)/app/event-types/_lib/schema.ts
    - app/(shell)/app/event-types/_lib/actions.ts
  modified: []

key-decisions:
  - "Direct-call Server Action contract: actions accept structured EventTypeInput (from RHF handleSubmit), NOT FormData. Avoids FormData-can't-serialize-nested-arrays pitfall for custom_questions. Progressive enhancement sacrificed — acceptable for private owner dashboard."
  - "RestoreResult shape: {ok: true} | {slugCollision: true, currentSlug} | {error} — allows client to open slug-prompt dialog without a dedicated API endpoint."
  - "resolveAccountId() private helper centralizes the RPC call; keeps action bodies clean."
  - "Inline slug regex in restoreEventTypeAction duplicates eventTypeSchema.slug.regex — documented trade-off to keep restore action self-contained. eventTypeSchema is the source of truth."

patterns-established:
  - "Slug uniqueness: pre-flight .eq('slug').is('deleted_at', null).maybeSingle() + catch error.code === '23505' race defense"
  - "Update excludes self: add .neq('id', id) to slug pre-flight"
  - "Soft-delete reads: always .is('deleted_at', null), never .eq('deleted_at', null)"
  - "redirect() outside try/catch: no try/catch anywhere in actions.ts; early returns handle error paths"
  - "revalidatePath('/app/event-types') after every mutation that changes the list"

# Metrics
duration: 5min
completed: 2026-04-25
---

# Phase 03 Plan 03: Schemas and Server Actions Summary

**Zod schemas (eventTypeSchema + discriminated-union customQuestionSchema) + all 5 Server Actions (create/update/soft-delete/restore-with-slug-collision/toggle) wired to RLS-scoped Supabase, with pre-flight slug uniqueness, 23505 race defense, and no try/catch around redirect()**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-25T04:55:04Z
- **Completed:** 2026-04-25T04:59:49Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments

- `lib/slugify.ts`: pure isomorphic slugify() — 6-case smoke test passes (30-Min Consult, Café Meeting, --foo--, hello   world, empty string, ALL CAPS!!!)
- `_lib/types.ts` + `_lib/schema.ts`: CustomQuestion discriminated union (4 branches), EventTypeRow (full DB shape), EventTypeListItem (list projection), eventTypeSchema with /^[a-z0-9-]+$/ slug regex matching slugify output
- `_lib/actions.ts`: all 5 Server Actions; redirect() outside try/catch verified by absence of any try block in file; .is("deleted_at", null) used consistently (not .eq); 23505 race defense in create, update, and restore
- TypeScript clean (Turbopack + tsc both pass); all 17 Vitest tests still green

## Task Commits

Each task was committed atomically:

1. **Task 1: Ship the slugify utility** - `b2af754` (feat)
2. **Task 2: Ship shared types + Zod schemas** - `42451b2` (feat)
3. **Task 3: Ship all five Server Actions** - `6774ff0` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `lib/slugify.ts` — Pure isomorphic slug utility; NFKD normalize → strip diacritics → lowercase → collapse non-alphanum to hyphens → trim
- `app/(shell)/app/event-types/_lib/types.ts` — CustomQuestion union, EventTypeRow (full DB shape), EventTypeListItem (list projection)
- `app/(shell)/app/event-types/_lib/schema.ts` — customQuestionSchema (discriminatedUnion over 4 question types), eventTypeSchema (name/slug/duration/description/is_active/custom_questions), EventTypeInput type
- `app/(shell)/app/event-types/_lib/actions.ts` — "use server"; createEventTypeAction, updateEventTypeAction, softDeleteEventTypeAction, restoreEventTypeAction, toggleActiveAction; EventTypeState, RestoreResult types

## Decisions Made

**Direct-call Server Action contract confirmed (closes RESEARCH Open Q2 + CONTEXT.md atomic-save decision):** Actions accept structured `EventTypeInput` directly from RHF `handleSubmit`, NOT `FormData`. This avoids the FormData-can't-serialize-nested-arrays pitfall for `custom_questions`. Progressive enhancement is sacrificed — acceptable for a private owner dashboard. Plans 04 + 05 MUST honor this contract: call `await createEventTypeAction(values)` not `<form action={action}>`.

**RestoreResult discriminated union shape:** `{ ok: true } | { slugCollision: true; currentSlug: string } | { error: string }`. The `currentSlug` field gives the client the original slug to pre-fill a slug-prompt dialog. Plan 04 (list page) implements the client side of this flow.

**No try/catch anywhere in actions.ts:** All error paths use early `return { ... }`. This is the simplest way to guarantee redirect() is never swallowed. Future actions in this file MUST maintain this pattern.

## Deviations from Plan

None — plan executed exactly as written. All patterns from RESEARCH and plan spec implemented without modification.

## Issues Encountered

- `npm run lint` produces the pre-existing circular-JSON ESLint error (documented in STATE.md as Phase 8 backlog). Not caused by this plan. Build (TypeScript) and Vitest both clean.
- `npx tsx -e` produced no output in this environment (likely a Windows path issue); verified slugify logic using `node -e` with inline JS. The TypeScript source matches exactly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for Plans 03-04 (list page) and 03-05 (form pages):**

- List page imports: `EventTypeListItem` from `_lib/types.ts`, `toggleActiveAction` + `softDeleteEventTypeAction` + `restoreEventTypeAction` from `_lib/actions.ts`
- Form pages import: `EventTypeInput` + `eventTypeSchema` from `_lib/schema.ts`, `createEventTypeAction` + `updateEventTypeAction` from `_lib/actions.ts`, `slugify` from `lib/slugify.ts`
- `RestoreResult` return shape: `{ ok: true }` | `{ slugCollision: true; currentSlug: string }` | `{ error: string }` — client opens slug-prompt Dialog on `slugCollision`
- `EventTypeState` return shape: `{ fieldErrors?, formError?, redirectTo? }` — RHF feeds `fieldErrors` into per-field errors; `formError` into alert banner
- Restore restored rows come back with `is_active: false` (Inactive state) — list page should show Inactive badge, not Active

No blockers.

---
*Phase: 03-event-types-crud*
*Completed: 2026-04-25*
