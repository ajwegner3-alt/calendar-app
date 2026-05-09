# Phase 40: Knip Audit Report

**Generated:** 2026-05-08
**Knip version:** 6.12.1
**Total findings:** 80 (1 unused file + 3 unused deps + 4 unused devDeps + 1 unlisted dep + 58 unused exports + 13 unused exported types + 0 duplicates)

## How to use this file

For each row below, edit the **Decision** cell to one of: `REMOVE`, `KEEP`, or `INVESTIGATE`.
- `REMOVE` — Claude will delete in the relevant per-category commit.
- `KEEP` — Andrew has a reason to keep this; rationale captured in `40-KNIP-DECISIONS.md`.
- `INVESTIGATE` — Claude must research before Andrew re-decides. INVESTIGATE items are deep-dived in-phase, never deferred.

After Andrew finishes, Plan 02 reads this file back and produces `40-KNIP-DECISIONS.md`.

**Configuration hints from knip (informational, no action required for Plan 01):**
- `app/[account]/[event-slug]/_components/slot-picker.tsx` — knip did NOT flag this file as unused (the ignore is preserved as policy per Plan 30-01 Rule 4; the "Remove from ignore" hint is dismissable).
- `tests/setup.ts` — Vitest plugin auto-detected it; the explicit `entry` is redundant but harmless. Kept as defensive lock per RESEARCH.md MEDIUM-confidence note.

---

## 1. Unused Dependencies

(Removed first per RESEARCH.md commit-order recommendation — smallest blast radius.)

### 1a. Unused `dependencies`

| #   | Dependency       | Type   | Recommended  | Rationale                                                                                                                                  | Decision |
| --- | ---------------- | ------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1.1 | `nodemailer`     | dep    | REMOVE       | Phase 35-06 retired SMTP/App-Password path; zero `from "nodemailer"` imports in source. Surviving mentions are .planning docs only.        | _____    |
| 1.2 | `shadcn`         | dep    | INVESTIGATE  | shadcn CLI tool (used via `npx shadcn add`); `components.json` exists but no source-level imports. Verify nothing references the package.  | _____    |
| 1.3 | `tw-animate-css` | dep    | KEEP         | Imported via CSS at `app/globals.css:2` (`@import "tw-animate-css"`); knip can't see CSS imports. Used by Phase 39 entry-animation work.   | _____    |

### 1b. Unused `devDependencies`

| #   | Dependency          | Type   | Recommended  | Rationale                                                                                                                                                              | Decision |
| --- | ------------------- | ------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1.4 | `@eslint/eslintrc`  | devDep | REMOVE       | Phase 08-02 migrated to native flat config (FlatCompat removed); only mention is a stale code comment in `eslint.config.mjs`.                                          | _____    |
| 1.5 | `@types/nodemailer` | devDep | REMOVE       | Companion to `nodemailer` (1.1). Should be removed in same commit.                                                                                                     | _____    |
| 1.6 | `supabase`          | devDep | KEEP         | Supabase CLI binary (used via `npx supabase`); RESEARCH.md Pitfall 5 explicitly lists this as a config/CLI consumer not visible to knip.                               | _____    |
| 1.7 | `tailwindcss`       | devDep | KEEP         | Tailwind v4 + PostCSS pipeline; `@tailwindcss/postcss` references it transitively. RESEARCH.md Pitfall 5 explicitly lists this. Removing breaks `next build`.          | _____    |

### 1c. Unlisted dependencies (used but not declared)

| #   | Dependency             | Used by              | Recommended  | Rationale                                                                                                                                              | Decision |
| --- | ---------------------- | -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1.8 | `postcss-load-config`  | `postcss.config.mjs:1` | INVESTIGATE  | JSDoc type-only ref (`@type {import('postcss-load-config').Config}`); transitive peer of `@tailwindcss/postcss`. Either declare it or drop the type.   | _____    |

---

## 2. Duplicate Exports

_None._

---

## 3. Unused Exports

Section 3a (named exports) and 3b (exported types) split for readability.

### 3a. Unused named exports (58)

| #    | File                                                                      | Export                  | Recommended  | Rationale                                                                                                                                                | Decision |
| ---- | ------------------------------------------------------------------------- | ----------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 3.1  | `lib/email-sender/index.ts:32:10`                                         | `escapeHtml`            | REMOVE       | Re-export from barrel; nobody imports `escapeHtml` from `@/lib/email-sender`; canonical use is local copies in each sender.                              | _____    |
| 3.2  | `lib/email-sender/index.ts:32:22`                                         | `stripHtml`             | REMOVE       | Same as 3.1 — barrel re-export with zero consumers.                                                                                                      | _____    |
| 3.3  | `lib/email/branding-blocks.ts:4:14`                                       | `DEFAULT_BRAND_PRIMARY` | INVESTIGATE  | Also exported from `lib/branding/read-branding.ts:11` (3.17). Two definitions of the same constant — dedupe before removing either.                      | _____    |
| 3.4  | `lib/email/branding-blocks.ts:59:17`                                      | `renderEmailLogoHeader` | REMOVE       | Marked `@deprecated` in Phase 12-06; superseded by `renderEmailBrandedHeader`. Phase 13 cleanup never landed; this is the cleanup.                       | _____    |
| 3.5  | `lib/oauth/encrypt.ts:94:17`                                              | `generateKey`           | INVESTIGATE  | Crypto helper; verify no admin/script callers (e.g., one-off rotation tools) before removing.                                                            | _____    |
| 3.6  | `lib/bookings/pushback.ts:95:17`                                          | `isPastEod`             | INVESTIGATE  | Used INTERNALLY at `pushback.ts:183` by `cascadeStatus`; `export` keyword may be vestigial. Remove `export` (keep function) — INVESTIGATE the export.    | _____    |
| 3.7  | `components/ui/sidebar.tsx:682:3`                                         | `SidebarGroupAction`    | KEEP         | shadcn/ui primitive — installed-as-library convention; future composition surface. Removing breaks `npx shadcn add` upgrade flow.                       | _____    |
| 3.8  | `components/ui/sidebar.tsx:684:3`                                         | `SidebarGroupLabel`     | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.9  | `components/ui/sidebar.tsx:685:3`                                         | `SidebarHeader`         | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.10 | `components/ui/sidebar.tsx:686:3`                                         | `SidebarInput`          | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.11 | `components/ui/sidebar.tsx:689:3`                                         | `SidebarMenuAction`     | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.12 | `components/ui/sidebar.tsx:690:3`                                         | `SidebarMenuBadge`      | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.13 | `components/ui/sidebar.tsx:693:3`                                         | `SidebarMenuSkeleton`   | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.14 | `components/ui/sidebar.tsx:698:3`                                         | `SidebarRail`           | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.15 | `components/ui/sidebar.tsx:699:3`                                         | `SidebarSeparator`      | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.16 | `components/ui/sidebar.tsx:701:3`                                         | `useSidebar`            | KEEP         | shadcn/ui primitive hook (see 3.7).                                                                                                                       | _____    |
| 3.17 | `lib/branding/read-branding.ts:11:14`                                     | `DEFAULT_BRAND_PRIMARY` | INVESTIGATE  | Duplicate constant (paired with 3.3). Pick one canonical location; remove the other.                                                                     | _____    |
| 3.18 | `lib/branding/read-branding.ts:57:23`                                     | `getBrandingForAccount` | INVESTIGATE  | One reference in source/tests (likely just the export site itself). Verify no booker-flow callers before removing.                                       | _____    |
| 3.19 | `app/(shell)/app/bookings/_components/pushback-dialog-provider.tsx:44:17` | `usePushbackDialog`     | INVESTIGATE  | Hook exported from a Provider file; check if dialog children import it via `useContext` hook re-export pattern.                                          | _____    |
| 3.20 | `components/ui/card.tsx:98:3`                                             | `CardFooter`            | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.21 | `components/ui/card.tsx:100:3`                                            | `CardAction`            | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.22 | `components/ui/badge.tsx:49:17`                                           | `badgeVariants`         | KEEP         | shadcn/ui CVA variants export — convention is to export alongside component for external composition.                                                    | _____    |
| 3.23 | `components/ui/dropdown-menu.tsx:255:3`                                   | `DropdownMenuPortal`    | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.24 | `components/ui/dropdown-menu.tsx:258:3`                                   | `DropdownMenuGroup`     | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.25 | `components/ui/dropdown-menu.tsx:259:3`                                   | `DropdownMenuLabel`     | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.26 | `components/ui/dropdown-menu.tsx:262:3`                                   | `DropdownMenuRadioGroup`| KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.27 | `components/ui/dropdown-menu.tsx:263:3`                                   | `DropdownMenuRadioItem` | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.28 | `components/ui/dropdown-menu.tsx:265:3`                                   | `DropdownMenuShortcut`  | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.29 | `components/ui/dropdown-menu.tsx:266:3`                                   | `DropdownMenuSub`       | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.30 | `components/ui/dropdown-menu.tsx:267:3`                                   | `DropdownMenuSubTrigger`| KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.31 | `components/ui/dropdown-menu.tsx:268:3`                                   | `DropdownMenuSubContent`| KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.32 | `lib/email-sender/utils.ts:6:17`                                          | `escapeHtml`            | REMOVE       | Canonical export, but every caller (4 sender files + welcome-email + upgrade actions) inlines its own `function escapeHtml`. Dead source helper.        | _____    |
| 3.33 | `components/ui/alert-dialog.tsx:194:3`                                    | `AlertDialogMedia`      | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.34 | `components/ui/alert-dialog.tsx:195:3`                                    | `AlertDialogOverlay`    | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.35 | `components/ui/alert-dialog.tsx:196:3`                                    | `AlertDialogPortal`     | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.36 | `components/ui/sheet.tsx:140:3`                                           | `SheetTrigger`          | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.37 | `components/ui/sheet.tsx:141:3`                                           | `SheetClose`            | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.38 | `components/ui/sheet.tsx:144:3`                                           | `SheetFooter`           | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.39 | `components/ui/alert.tsx:76:47`                                           | `AlertAction`           | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.40 | `components/ui/calendar.tsx:222:20`                                       | `CalendarDayButton`     | KEEP         | shadcn/ui primitive — exposed for day-picker custom render slots.                                                                                        | _____    |
| 3.41 | `components/ui/tabs.tsx:90:52`                                            | `tabsListVariants`      | KEEP         | shadcn/ui CVA variants (see 3.22).                                                                                                                        | _____    |
| 3.42 | `components/ui/table.tsx:111:3`                                           | `TableFooter`           | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.43 | `components/ui/table.tsx:115:3`                                           | `TableCaption`          | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.44 | `components/ui/select.tsx:184:3`                                          | `SelectGroup`           | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.45 | `components/ui/select.tsx:186:3`                                          | `SelectLabel`           | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.46 | `components/ui/select.tsx:187:3`                                          | `SelectScrollDownButton`| KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.47 | `components/ui/select.tsx:188:3`                                          | `SelectScrollUpButton`  | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.48 | `components/ui/select.tsx:189:3`                                          | `SelectSeparator`       | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.49 | `app/(shell)/app/event-types/_lib/schema.ts:31:14`                        | `customQuestionSchema`  | INVESTIGATE  | Zod schema; possible callers in form actions (Phase 24). Grep `customQuestionSchema` in `_lib/actions.ts` siblings before removing.                     | _____    |
| 3.50 | `lib/auth/rate-limits.ts:11:14`                                           | `AUTH_RATE_LIMITS`      | INVESTIGATE  | Used internally at `rate-limits.ts:23,39`; `export` may be vestigial. Same pattern as 3.6 — remove `export` keyword, keep object.                        | _____    |
| 3.51 | `app/(shell)/app/availability/_components/time-window-picker.tsx:16:17`   | `minutesToHHMM`         | INVESTIGATE  | Display helper; multiple time-window picker variants exist (Phase 24). Verify no sibling `_form.tsx`/`_lib/` consumers before removing.                  | _____    |
| 3.52 | `app/(shell)/app/availability/_components/time-window-picker.tsx:22:17`   | `hhmmToMinutes`         | INVESTIGATE  | Inverse of 3.51 — same logic applies.                                                                                                                    | _____    |
| 3.53 | `components/ui/dialog.tsx:159:3`                                          | `DialogClose`           | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.54 | `components/ui/dialog.tsx:164:3`                                          | `DialogOverlay`         | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.55 | `components/ui/dialog.tsx:165:3`                                          | `DialogPortal`          | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.56 | `components/ui/dialog.tsx:167:3`                                          | `DialogTrigger`         | KEEP         | shadcn/ui primitive (see 3.7).                                                                                                                            | _____    |
| 3.57 | `app/(shell)/app/branding/_lib/schema.ts:19:14`                           | `PNG_MAGIC`             | INVESTIGATE  | PNG signature constant used internally at `schema.ts:logoFileSchema`. Possibly used as `export` for tests. Verify before removing.                       | _____    |
| 3.58 | `app/(shell)/app/branding/_lib/schema.ts:26:14`                           | `logoFileSchema`        | INVESTIGATE  | Zod schema; check `branding/_lib/actions.ts` and `branding-form.tsx` for callers before removing.                                                        | _____    |

### 3b. Unused exported types (13)

| #     | File                                                              | Export                       | Type kind  | Recommended | Rationale                                                                                                                          | Decision |
| ----- | ----------------------------------------------------------------- | ---------------------------- | ---------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 3.59  | `lib/email-sender/index.ts:23:3`                                  | `EmailOptions`               | type       | REMOVE      | Barrel re-export; nobody imports from `@/lib/email-sender`. Source `./types` is the canonical site.                               | _____    |
| 3.60  | `lib/email-sender/index.ts:24:3`                                  | `EmailResult`                | type       | REMOVE      | Same as 3.59.                                                                                                                       | _____    |
| 3.61  | `lib/email-sender/index.ts:25:3`                                  | `EmailAttachment`            | type       | REMOVE      | Same as 3.59.                                                                                                                       | _____    |
| 3.62  | `lib/email-sender/index.ts:26:3`                                  | `EmailClient`                | type       | REMOVE      | Same as 3.59.                                                                                                                       | _____    |
| 3.63  | `lib/email-sender/index.ts:27:3`                                  | `EmailClientConfig`          | type       | REMOVE      | Same as 3.59.                                                                                                                       | _____    |
| 3.64  | `lib/email-sender/index.ts:28:3`                                  | `EmailProvider`              | type       | REMOVE      | Same as 3.59.                                                                                                                       | _____    |
| 3.65  | `app/(shell)/app/availability/_lib/actions-batch-cancel.ts:87:13` | `CommitInverseOverrideInput` | type       | INVESTIGATE | Server-action input type; possibly typed at the form `<form action={commitInverseOverride}>` boundary. Grep before removing.       | _____    |
| 3.66  | `lib/email-sender/types.ts:5:18`                                  | `EmailAttachment`            | interface  | INVESTIGATE | Vendored type from sibling `@nsi/email-sender` project. May be deferred-used or re-exported. Verify before removing.                | _____    |
| 3.67  | `lib/email-sender/types.ts:46:13`                                 | `EmailProvider`              | type       | INVESTIGATE | Same as 3.66.                                                                                                                       | _____    |
| 3.68  | `lib/email-sender/types.ts:49:18`                                 | `EmailClientConfig`          | interface  | INVESTIGATE | Same as 3.66.                                                                                                                       | _____    |
| 3.69  | `app/(shell)/app/event-types/_lib/types.ts:9:13`                  | `CustomQuestion`             | type       | INVESTIGATE | Form-shape type; possibly used in `event-types-form.tsx` props. Grep before removing.                                              | _____    |
| 3.70  | `app/(auth)/app/login/schema.ts:14:13`                            | `MagicLinkInput`             | type       | INVESTIGATE | Zod-derived type for Phase 38 magic-link form. Verify the form component doesn't reference it directly via `z.infer<typeof schema>`.| _____    |
| 3.71  | `app/(shell)/app/availability/_lib/types.ts:62:13`                | `DateOverrideInput`          | type       | INVESTIGATE | Date-override server-action input type. Same pattern as 3.65 — likely a server-action boundary type.                                | _____    |

---

## 4. Unused Files

| #   | File                            | Recommended  | Rationale                                                                                                                                                          | Decision |
| --- | ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 4.1 | `components/welcome-card.tsx`   | REMOVE       | Last touched in `ec56540` (Phase 02-02 dashboard scaffold); zero grep hits in app/, lib/, or tests/. Original dashboard landing was rebuilt in later phases.       | _____    |
