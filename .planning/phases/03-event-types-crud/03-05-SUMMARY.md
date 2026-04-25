---
phase: 03-event-types-crud
plan: 05
subsystem: ui
tags: [react-hook-form, zod, shadcn, slugify, server-actions, next16]

# Dependency graph
requires:
  - phase: 03-event-types-crud/03-03
    provides: eventTypeSchema, EventTypeInput, createEventTypeAction, updateEventTypeAction, slugify utility
  - phase: 03-event-types-crud/03-02
    provides: shadcn primitives (Switch, Select, Alert, Separator, Card, Input, Textarea, Button, Label)
provides:
  - /app/event-types/new route (Server Component shell, create mode)
  - /app/event-types/[id]/edit route (Server Component shell, edit mode with notFound gate)
  - EventTypeForm Client Component (RHF + zodResolver, slug auto-fill, URL preview, edit warning, atomic submit)
  - QuestionList Client Component (useFieldArray, reorder, single-select inline options)
  - UrlPreview presentational component (yoursite.com/nsi/[slug] placeholder)
affects: [phase-9-manual-qa, phase-7-widget-branding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct-call Server Action: form onSubmit calls await createEventTypeAction(values) directly (not via <form action>); enables nested custom_questions to flow as structured input rather than FormData"
    - "useTransition + NEXT_REDIRECT re-throw: replaces Phase 2 useActionState bridge; try/catch must re-throw errors whose digest starts with NEXT_REDIRECT"
    - "zodResolver `as any` cast: workaround for Zod v4 z.coerce fields having unknown input type in @hookform/resolvers v5; runtime behavior identical"
    - "slugManuallyEdited flag: create mode auto-fills slug from name until user edits slug; edit mode starts as true (saved slug preserved)"
    - "Controller required for Switch and Select (Pitfall 5): Radix UI primitives do not forward DOM refs; register() silently no-ops"
    - "Nested useFieldArray: inner useFieldArray over custom_questions.${i}.options (as never cast); only mounted for single-select rows"

key-files:
  created:
    - app/(shell)/app/event-types/new/page.tsx
    - app/(shell)/app/event-types/[id]/edit/page.tsx
    - app/(shell)/app/event-types/_components/event-type-form.tsx
    - app/(shell)/app/event-types/_components/question-list.tsx
    - app/(shell)/app/event-types/_components/url-preview.tsx
  modified: []

key-decisions:
  - "zodResolver cast to `any` to resolve Zod v4 z.coerce input/output type mismatch with @hookform/resolvers v5 — type-level only, no runtime impact"
  - "slugManuallyEdited starts true in edit mode so saved slug is never overwritten by name changes"
  - "No success toast from the form — redirect() fires before any client code can run; v1 polish gap acknowledged (v2: pass ?created/?updated searchParam)"
  - "as never casts on inner useFieldArray name and register for option strings — RHF cannot narrow through discriminated union dynamic paths; runtime correct"
  - "No drag-and-drop — deferred to v2 per CONTEXT.md locked decision"

patterns-established:
  - "useTransition + direct-call action + NEXT_REDIRECT re-throw: canonical form submit pattern for this project (replaces useActionState for actions returning structured input)"
  - "Controller for all Switch and Select fields — must be maintained in all future forms"
  - "yoursite.com/nsi/ URL preview placeholder — Phase 7 will swap the domain; do not bind to live Vercel URL"

# Metrics
duration: 5min
completed: 2026-04-25
---

# Phase 3 Plan 05: Create/Edit Form and Questions Summary

**EventTypeForm with live slug auto-fill, yellow edit-warning, URL preview, inline useFieldArray custom-questions, and atomic direct-call Server Action submit — closes EVENT-01, EVENT-02, EVENT-05, EVENT-06**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-25T05:04:19Z
- **Completed:** 2026-04-25T05:09:02Z
- **Tasks:** 3
- **Files modified:** 5 created

## Accomplishments

- Shipped `/app/event-types/new` (create shell) and `/app/event-types/[id]/edit` (edit shell with `await params`, archived-row notFound gate, and RLS-scoped SELECT)
- Built `EventTypeForm` Client Component: RHF + `zodResolver(eventTypeSchema)`, live name-to-slug auto-fill via `slugify()` with manual-edit session lock, yellow Alert warning when changing saved slug in edit mode, URL preview (`yoursite.com/nsi/[slug]`), `Controller` for `is_active` Switch, `useTransition` + direct-call action + NEXT_REDIRECT re-throw
- Built `QuestionList` Client Component: top-level `useFieldArray` over `custom_questions`, per-row Controller for Switch (required) + Select (type), up/down reorder via `move()`, remove, nested `useFieldArray` for `single-select` inline options capped at 20

## Task Commits

1. **Task 1: Route shells + URL preview** - `037b7a9` (feat)
2. **Task 2: QuestionList sub-form** - `ad3dd9b` (feat)
3. **Task 3: EventTypeForm component** - `6866899` (feat)

**Plan metadata:** committed with docs(03-05) after SUMMARY + STATE update

## Files Created/Modified

- `app/(shell)/app/event-types/new/page.tsx` — Server Component shell, renders `<EventTypeForm mode="create" />`
- `app/(shell)/app/event-types/[id]/edit/page.tsx` — Server Component shell; `await params` (Next 16); `.is("deleted_at", null)` gate; `notFound()` on miss/archived; passes `defaultValues` to form
- `app/(shell)/app/event-types/_components/event-type-form.tsx` — Core form: RHF + zodResolver + slug auto-fill + URL preview + edit warning + atomic action submit
- `app/(shell)/app/event-types/_components/question-list.tsx` — useFieldArray question list with reorder, Remove, per-row type Select + required Switch + inline single-select options
- `app/(shell)/app/event-types/_components/url-preview.tsx` — Presentational: `yoursite.com/nsi/[slug]` with monospace styling; Phase 7 swap target

## Decisions Made

- **Direct-call action contract confirmed**: `EventTypeForm` calls `await createEventTypeAction(values)` / `await updateEventTypeAction(id, values)` directly inside `useTransition`'s callback, NOT via `<form action>`. This is required because `custom_questions` is a nested array that cannot be serialized by FormData.
- **Slug auto-fill rules**: Create mode starts with `slugManuallyEdited=false` — name changes auto-fill slug via `slugify()` until the user edits the slug directly (detected by typed slug diverging from `slugify(name)`). Edit mode starts with `slugManuallyEdited=true` so the saved slug is always preserved.
- **Slug-change warning**: Only shows in edit mode AND when `currentSlug !== originalSlug`. Yellow Alert using manual amber Tailwind classes (shadcn Alert has no "warning" variant in v4).
- **NEXT_REDIRECT re-throw**: The `try/catch` wrapping the action call must re-throw errors whose `digest` starts with `"NEXT_REDIRECT"`. Without this, `redirect("/app/event-types")` inside the action is silently swallowed.
- **zodResolver `as any` cast**: Zod v4 `z.coerce.number()` and `z.coerce.boolean()` have `unknown` input types. `@hookform/resolvers v5` infers from the schema's input type, creating a TS error when the form generic is the output type (`EventTypeInput`). Cast to `any` is type-level only; runtime behavior is correct.
- **v1 polish gap acknowledged**: No success toast after create/update — `redirect()` fires server-side before any client code runs. The user sees the new/updated row in the list. v2 polish: pass `?created` or `?updated` as a searchParam from the action; have the list page consume it with a toast on mount.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: zodResolver type mismatch with z.coerce fields**

- **Found during:** Task 3 build (`npm run build`)
- **Issue:** Zod v4 `z.coerce.number()` and `z.coerce.boolean()` produce schemas with `unknown` input types. `@hookform/resolvers v5` derives the resolver's expected type from the schema input, which conflicts with `useForm<EventTypeInput>` where `EventTypeInput` is the output type. TypeScript error: `Resolver<...unknown...>` not assignable to `Resolver<EventTypeInput>`.
- **Fix:** Added `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + `as any` cast on the `zodResolver(eventTypeSchema)` call. Runtime behavior is identical — Zod validation runs correctly; the cast is purely to satisfy TypeScript's type checker.
- **Files modified:** `app/(shell)/app/event-types/_components/event-type-form.tsx`
- **Verification:** `npm run build` exits 0 after fix; all 17 Vitest tests still green
- **Committed in:** `6866899` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix required for build to pass. Type-level only; no behavior change.

## Issues Encountered

- Pre-existing ESLint circular-JSON error (`npm run lint` exits 2) — documented in STATE.md as Phase 8 backlog item. Does not affect build or tests.

## TS Escape Hatches Documented

`question-list.tsx` uses two `as never` casts that are intentional and safe:

1. `name: \`custom_questions.${index}.options\` as never` on inner `useFieldArray` — RHF's TypeScript cannot narrow through dynamic discriminated-union paths to know that `options` exists only on single-select branches.
2. `register(\`custom_questions.${index}.options.${optIndex}\` as never)` — same narrowing limitation for the option string inputs.

Both are type-level escape hatches. Runtime behavior is correct: `useFieldArray` at the dynamic path works as expected, and `register` at the nested path correctly binds the input.

## Next Phase Readiness

- `/app/event-types/new` and `/app/event-types/[id]/edit` are fully functional and committed
- Plan 03-04 (list page + table + dialogs) is running in parallel — once it lands, the full Event Types CRUD flow is complete end-to-end
- Phase 9 (Manual QA) smoke test steps 1-9 are testable once 03-04 lands
- No blockers for Plan 03-04 from this plan's territory

---
*Phase: 03-event-types-crud*
*Completed: 2026-04-25*
