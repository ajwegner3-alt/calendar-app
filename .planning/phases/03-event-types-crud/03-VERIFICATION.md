---
phase: 03-event-types-crud
verified: 2026-04-24T00:20:00Z
status: passed
score: 20/20 must-haves verified
---

# Phase 3: Event Types CRUD Verification Report

**Phase Goal:** Andrew can define and manage the things people book (name, slug, duration, custom questions).
**Verified:** 2026-04-24T00:20:00Z
**Status:** PASSED

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Andrew can create an event type via UI form | VERIFIED | new/page.tsx + EventTypeForm mode=create + createEventTypeAction all wired |
| 2 | Andrew can edit any owned event type | VERIFIED | [id]/edit/page.tsx + EventTypeForm mode=edit + updateEventTypeAction |
| 3 | Andrew can soft-delete (archive) an event type | VERIFIED | softDeleteEventTypeAction sets deleted_at; DeleteConfirmDialog calls it |
| 4 | Andrew can toggle active/inactive from the kebab menu | VERIFIED | toggleActiveAction + RowActionsMenu.handleToggle |
| 5 | Slug uniqueness enforced per account with clean error | VERIFIED | Partial unique index + Zod regex + pre-flight SELECT + 23505 race-defense |
| 6 | Custom questions (label, type, required) persisted as JSONB | VERIFIED | customQuestionSchema discriminated union + QuestionList + actions |
| 7 | Inactive/archived event types hidden from listing by default | VERIFIED | .is(deleted_at, null) filter in page.tsx; archived view gated by ?archived=true |

**Score:** 7/7 truths verified (all 20 must-haves also pass)

---

## Must-Have Checklist (All 20)

| # | Must-Have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Schema migration: deleted_at column, dropped old constraint, partial unique index | PASS | supabase/migrations/20260424120000_event_types_soft_delete.sql lines 13-26 |
| 2 | 5 server actions with use server + tenant scoping + revalidatePath | PASS | actions.ts line 1; resolveAccountId via current_owner_account_ids(); revalidatePath at lines 127, 195, 222, 308, 337 |
| 3 | Slug uniqueness 3 layers: DB partial index, Zod regex, pre-flight SELECT + 23505 gate | PASS | Migration line 24; schema.ts line 57; actions.ts lines 83-98 + 116 |
| 4 | Soft-delete query uses .is(deleted_at, null) and .not(...) -- never .eq | PASS | 8 correct usages confirmed; grep for .eq(deleted_at returns empty |
| 5 | customQuestionSchema: 4 discriminated union branches; single-select options min 1 max 20 | PASS | schema.ts lines 31-36; options .min(1).max(20) at lines 26-29 |
| 6 | List page Server Component: awaits searchParams, correct filter, table or empty state | PASS | page.tsx lines 10-35 |
| 7 | Row actions kebab: Edit link, Toggle no-confirm, Archive dialog, Restore collision flow | PASS | row-actions-menu.tsx lines 80-105 |
| 8 | Two-tier delete confirmation: lazy booking count; type-name gate when count > 0 | PASS | delete-confirm-dialog.tsx lines 44-92 |
| 9 | restoreEventTypeAction returns slugCollision:true; standalone Dialog; restored as is_active:false | PASS | actions.ts line 288; restore-collision-dialog.tsx line 72; actions.ts line 295 |
| 10 | Create/Edit routes exist; Edit awaits params and calls notFound() on missing or archived | PASS | new/page.tsx exists; [id]/edit/page.tsx lines 11-26 |
| 11 | Form: RHF + zodResolver; Switch/Select in Controller; direct action call; NEXT_REDIRECT re-thrown | PASS | event-type-form.tsx lines 6, 74, 244-255, 139-144 |
| 12 | Slug auto-fill from name until manual edit; edit mode auto-fill off by default | PASS | slugManuallyEdited = mode===edit at line 52; handleNameChange respects flag at lines 82-91 |
| 13 | Edit-slug warning: amber Alert when saved slug changes in edit mode | PASS | showSlugChangeWarning at lines 155-156; amber Alert at lines 200-206 |
| 14 | URL preview: yoursite.com/nsi/[slug] literal, not Vercel URL | PASS | url-preview.tsx line 21 |
| 15 | QuestionList uses useFieldArray; up/down move; remove; required toggle; no drag-and-drop | PASS | question-list.tsx lines 43-46, 86-88; no dnd-kit/react-dnd found |
| 16 | lib/slugify.ts isomorphic, produces lowercase hyphenated slugs | PASS | slugify.ts 27 lines; pure; normalize(NFKD) + regex only |
| 17 | shadcn primitives: table, dropdown-menu, alert-dialog, dialog, switch, badge, select, textarea, sonner | PASS | All 9 files present in components/ui/ |
| 18 | Toaster mounted ONCE at root app/layout.tsx; NOT in shell layout or anywhere else | PASS | app/layout.tsx lines 5,28; no other instances found |
| 19 | No deferred features: no drag-and-drop, bulk ops, hard-delete, analytics | PASS | dnd-kit/react-dnd grep returns clean; no such actions or components exist |
| 20 | npm run build exits 0; 17 Vitest tests green -- no regressions | PASS | Build: 13/13 pages, 0 TypeScript errors; Vitest: 3 files, 17 tests passed |

---

## Required Artifacts

| Artifact | Status | Lines | Key Evidence |
|----------|--------|-------|--------------|
| supabase/migrations/20260424120000_event_types_soft_delete.sql | VERIFIED | 26 | ALTER TABLE + DROP CONSTRAINT + CREATE UNIQUE INDEX WHERE deleted_at IS NULL |
| app/(shell)/app/event-types/_lib/actions.ts | VERIFIED | 340 | 5 substantive actions; use server at line 1; no stubs |
| app/(shell)/app/event-types/_lib/schema.ts | VERIFIED | 76 | 4-branch discriminated union + full eventTypeSchema |
| app/(shell)/app/event-types/page.tsx | VERIFIED | 67 | Server Component; awaits searchParams; correct .is/.not filter |
| app/(shell)/app/event-types/new/page.tsx | VERIFIED | 15 | Composes EventTypeForm mode=create; no params needed |
| app/(shell)/app/event-types/[id]/edit/page.tsx | VERIFIED | 54 | Awaits params; notFound() guard; passes defaultValues |
| app/(shell)/app/event-types/_components/event-type-form.tsx | VERIFIED | 292 | RHF + zodResolver; Switch + Select in Controller; NEXT_REDIRECT re-thrown |
| app/(shell)/app/event-types/_components/question-list.tsx | VERIFIED | 317 | useFieldArray; move/remove/required; nested options list for single-select |
| app/(shell)/app/event-types/_components/event-types-table.tsx | VERIFIED | 72 | 5-column Table; StatusBadge + RowActionsMenu wired per row |
| app/(shell)/app/event-types/_components/row-actions-menu.tsx | VERIFIED | 125 | DropdownMenu with 4 actions; collision dialog state managed |
| app/(shell)/app/event-types/_components/delete-confirm-dialog.tsx | VERIFIED | 152 | AlertDialog; lazy booking count; type-name gate |
| app/(shell)/app/event-types/_components/restore-collision-dialog.tsx | VERIFIED | 114 | Standalone Dialog (not AlertDialog); slug input field |
| app/(shell)/app/event-types/_components/status-badge.tsx | VERIFIED | 14 | 3-state Badge: Active/Inactive/Archived |
| app/(shell)/app/event-types/_components/url-preview.tsx | VERIFIED | 27 | yoursite.com/nsi/[slug] literal; not Vercel URL |
| app/(shell)/app/event-types/_components/show-archived-toggle.tsx | VERIFIED | 37 | URL param toggle via router.replace |
| lib/slugify.ts | VERIFIED | 27 | Pure isomorphic function; NFKD normalize + regex only |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| event-type-form.tsx | createEventTypeAction / updateEventTypeAction | onSubmit await call lines 122-125 | WIRED |
| event-type-form.tsx | NEXT_REDIRECT handling | catch block re-throws at lines 139-144 | WIRED |
| row-actions-menu.tsx | toggleActiveAction | handleToggle startTransition lines 40-50 | WIRED |
| row-actions-menu.tsx | restoreEventTypeAction | handleRestore startTransition lines 52-64 | WIRED |
| delete-confirm-dialog.tsx | softDeleteEventTypeAction | handleConfirm startTransition line 75 | WIRED |
| restore-collision-dialog.tsx | restoreEventTypeAction(id, newSlug) | handleRestore line 57 | WIRED |
| delete-confirm-dialog.tsx | bookings table | useEffect lazy count fetch lines 52-67 | WIRED |
| page.tsx | event_types table | .is(deleted_at, null) or .not(...) lines 25-35 | WIRED |
| createEventTypeAction | event_types insert | pre-flight check lines 83-98 then insert lines 101-123 | WIRED |
| restoreEventTypeAction | event_types update | update deleted_at=null, is_active=false lines 291-300 | WIRED |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| event-type-form.tsx lines 175,190,233 | placeholder= on input elements | INFO | Correct HTML attribute; not a code stub |
| question-list.tsx lines 157,279 | placeholder= on input elements | INFO | Correct HTML attribute; not a code stub |
| url-preview.tsx line 8 | Comment mentions Phase-3 placeholder | INFO | Explains Phase 7 domain-swap intent; yoursite.com is intentional per CONTEXT |

No blockers. No warnings. All INFO items are correct and intentional.

---

## Human Verification Required

The following items require manual testing in the browser against a live Supabase instance:

### 1. End-to-End Create Flow
**Test:** Log in as owner, go to /app/event-types, click Create event type, fill all fields including a single-select question with two options, submit.
**Expected:** Redirects to list; new row appears Active with correct name/slug/duration.
**Why human:** Requires live Supabase session and actual DB insertion.

### 2. Slug Auto-Fill Behavior
**Test:** In Create mode, type a name -- verify slug auto-fills. Manually edit slug. Continue typing name.
**Expected:** Auto-fill stops permanently after manual slug edit.
**Why human:** Stateful JS flag (slugManuallyEdited) requires browser interaction.

### 3. Slug Collision Error
**Test:** Create event type with slug test-meeting. Attempt to create another with same slug.
**Expected:** Inline field error on slug field: This slug is already in use.
**Why human:** Requires live DB state with existing slug.

### 4. Delete Confirmation Type-Name Gate
**Test:** Archive an event type that has at least one non-cancelled booking.
**Expected:** Dialog shows booking count; requires typing event type name exactly before Archive enables.
**Why human:** Requires bookings row tied to event type in DB.

### 5. Restore with Slug Collision
**Test:** Archive event type A (slug: consult). Create event type B with slug consult. Try to restore A from archived view.
**Expected:** Collision dialog opens with suggested slug consult-restored. After entering new slug, restores as Inactive.
**Why human:** Requires two sequential DB state changes.

---

## Gaps Summary

No gaps. All 20 must-haves verified against actual code. Implementation is complete and substantive -- no stubs, no orphaned artifacts, no broken wiring. Build passes with 0 TypeScript errors across 13 routes, and all 17 prior-phase Vitest tests remain green.

---

_Verified: 2026-04-24T00:20:00Z_
_Verifier: Claude (gsd-verifier)_
