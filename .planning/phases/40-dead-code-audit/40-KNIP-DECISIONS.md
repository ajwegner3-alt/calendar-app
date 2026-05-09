# Phase 40: Knip Decisions Log

**Locked:** 2026-05-08
**Source:** 40-KNIP-REPORT.md (post-Andrew-review)
**Decision authority:** Andrew explicitly delegated final REMOVE/KEEP calls to Claude ("I trust what you recommend. Go ahead."). Pre-seeded recommendations applied as final decisions for non-INVESTIGATE rows; INVESTIGATE rows resolved via Plan 02 Task 2 deep-dive methodology with conservative bias.

**Total REMOVE: 27 (deps: 3, dup-exports: 0, unused-exports: 23, unused-files: 1)** | **Total KEEP: 53**

---

## Final REMOVE list

### Unused Dependencies (Plan 03 target)

- `nodemailer` — Phase 35-06 retired SMTP/App-Password path; zero `from "nodemailer"` imports in source. Surviving mentions are `.planning/` docs only.
- `@eslint/eslintrc` — Phase 08-02 migrated to native flat config (FlatCompat removed); only mention is a stale code comment in `eslint.config.mjs`.
- `@types/nodemailer` — Companion to `nodemailer`; remove in same commit.

### Duplicate Exports (Plan 04 target)

_None._ (Knip reported zero duplicates; the duplicate-`DEFAULT_BRAND_PRIMARY` situation surfaced in Section 3 was handled there, not here.)

### Unused Exports (Plan 05 target)

**Whole-symbol REMOVE (delete the constant/function/type entirely):**

- `lib/email-sender/index.ts:32` — `escapeHtml` (barrel re-export with zero consumers).
- `lib/email-sender/index.ts:32` — `stripHtml` (barrel re-export with zero consumers).
- `lib/email/branding-blocks.ts:4` — `DEFAULT_BRAND_PRIMARY` (duplicate of canonical site at `read-branding.ts:11`; this copy has zero readers).
- `lib/email/branding-blocks.ts:59` — `renderEmailLogoHeader` (`@deprecated` since Phase 12-06; superseded by `renderEmailBrandedHeader`).
- `lib/branding/read-branding.ts:57` — `getBrandingForAccount` (zero callers in `app/`, `lib/`, or `tests/`).
- `lib/email-sender/utils.ts:6` — `escapeHtml` (canonical export, but every caller inlines its own copy).
- `app/(shell)/app/branding/_lib/schema.ts:19` — `PNG_MAGIC` (only consumer was `logoFileSchema`; `actions.ts:48-51` inlines literal bytes).
- `app/(shell)/app/branding/_lib/schema.ts:26` — `logoFileSchema` (zero callers; aggregator object is dead).
- `lib/email-sender/index.ts:23` — `EmailOptions` type (barrel re-export).
- `lib/email-sender/index.ts:24` — `EmailResult` type (barrel re-export).
- `lib/email-sender/index.ts:25` — `EmailAttachment` type (barrel re-export).
- `lib/email-sender/index.ts:26` — `EmailClient` type (barrel re-export).
- `lib/email-sender/index.ts:27` — `EmailClientConfig` type (barrel re-export).
- `lib/email-sender/index.ts:28` — `EmailProvider` type (barrel re-export).
- `app/(shell)/app/availability/_lib/actions-batch-cancel.ts:87` — `CommitInverseOverrideInput` type (zero consumers).
- `app/(auth)/app/login/schema.ts:14` — `MagicLinkInput` type (zero consumers; form uses schema directly via zodResolver).
- `app/(shell)/app/availability/_lib/types.ts:62` — `DateOverrideInput` type (zero consumers; only JSDoc comment reference).

**Export-keyword-only REMOVE (drop `export` keyword, keep the symbol as file-private):**

- `lib/bookings/pushback.ts:95` — `isPastEod` function (used internally at line 183 by `cascadeStatus`; export is vestigial).
- `lib/branding/read-branding.ts:11` — `DEFAULT_BRAND_PRIMARY` constant (used internally at line 31 by `brandingFromRow`; export is vestigial — but constant must remain).
- `lib/auth/rate-limits.ts:11` — `AUTH_RATE_LIMITS` const (used internally at lines 23, 39; callers use `checkAuthRateLimit("magicLink")` not the object directly).
- `app/(shell)/app/availability/_components/time-window-picker.tsx:16` — `minutesToHHMM` function (internal-only use at lines 48, 59; sibling files define their own private copies).
- `app/(shell)/app/availability/_components/time-window-picker.tsx:22` — `hhmmToMinutes` function (internal-only use at lines 50, 63).
- `app/(shell)/app/event-types/_lib/types.ts:9` — `CustomQuestion` type (internal-only use at line 47; booker side uses a different `CustomQuestion` interface).

### Unused Files (Plan 06 target)

- `components/welcome-card.tsx` — Last touched in `ec56540` (Phase 02-02 dashboard scaffold); zero grep hits in `app/`, `lib/`, or `tests/`. Original dashboard landing was rebuilt in later phases.

---

## Final KEEP list

(Items knip flagged that the audit chose to keep. The CI gate (Plan 07) will fail on these unless we add them to `knip.json` `ignore`, `ignoreDependencies`, or `ignoreExportsUsedInFile`. This list IS the contract for what `knip.json` ignores after Plan 06.)

### Files

_None._ (No files in the KEEP list. `slot-picker.tsx` is already suppressed via the `ignore` block in `knip.json` and was not flagged in this audit.)

### Dependencies

- `shadcn` — KEEP because: actively used as `npx shadcn add <component>` CLI tool. No source-level imports because it's a generator binary, not a runtime dep. (Note: arguably belongs in `devDependencies` rather than `dependencies` — Plan 07 may suggest the move, but for this audit the package stays.)
- `tw-animate-css` — KEEP because: imported via CSS at `app/globals.css:2` (`@import "tw-animate-css"`); knip is JS/TS-only and cannot see CSS imports. Used by Phase 39 entry-animation work.
- `supabase` (devDep) — KEEP because: Supabase CLI binary used via `npx supabase`. RESEARCH.md Pitfall 5 explicitly enumerates this.
- `tailwindcss` (devDep) — KEEP because: Tailwind v4 + PostCSS pipeline. `@tailwindcss/postcss` references it transitively. Removing breaks `next build`.
- `postcss-load-config` (unlisted) — KEEP because: JSDoc `@type` annotation at `postcss.config.mjs:1` is type-only; transitive peer of `@tailwindcss/postcss`. Removing the annotation is cosmetic; runtime build is unaffected. Suppress via `knip.json` `ignoreDependencies`.

### Exports

**shadcn/ui primitives (42 entries; reason identical for all):** Installed-as-library convention. Each is part of the `npx shadcn add <component>` upgrade surface. Removing breaks future re-installs. Suppress via `knip.json` `ignore` glob `components/ui/**` after Plan 06.

- `components/ui/sidebar.tsx:682` — `SidebarGroupAction`
- `components/ui/sidebar.tsx:684` — `SidebarGroupLabel`
- `components/ui/sidebar.tsx:685` — `SidebarHeader`
- `components/ui/sidebar.tsx:686` — `SidebarInput`
- `components/ui/sidebar.tsx:689` — `SidebarMenuAction`
- `components/ui/sidebar.tsx:690` — `SidebarMenuBadge`
- `components/ui/sidebar.tsx:693` — `SidebarMenuSkeleton`
- `components/ui/sidebar.tsx:698` — `SidebarRail`
- `components/ui/sidebar.tsx:699` — `SidebarSeparator`
- `components/ui/sidebar.tsx:701` — `useSidebar`
- `components/ui/card.tsx:98` — `CardFooter`
- `components/ui/card.tsx:100` — `CardAction`
- `components/ui/badge.tsx:49` — `badgeVariants` (CVA variants — convention is to export alongside component)
- `components/ui/dropdown-menu.tsx:255` — `DropdownMenuPortal`
- `components/ui/dropdown-menu.tsx:258` — `DropdownMenuGroup`
- `components/ui/dropdown-menu.tsx:259` — `DropdownMenuLabel`
- `components/ui/dropdown-menu.tsx:262` — `DropdownMenuRadioGroup`
- `components/ui/dropdown-menu.tsx:263` — `DropdownMenuRadioItem`
- `components/ui/dropdown-menu.tsx:265` — `DropdownMenuShortcut`
- `components/ui/dropdown-menu.tsx:266` — `DropdownMenuSub`
- `components/ui/dropdown-menu.tsx:267` — `DropdownMenuSubTrigger`
- `components/ui/dropdown-menu.tsx:268` — `DropdownMenuSubContent`
- `components/ui/alert-dialog.tsx:194` — `AlertDialogMedia`
- `components/ui/alert-dialog.tsx:195` — `AlertDialogOverlay`
- `components/ui/alert-dialog.tsx:196` — `AlertDialogPortal`
- `components/ui/sheet.tsx:140` — `SheetTrigger`
- `components/ui/sheet.tsx:141` — `SheetClose`
- `components/ui/sheet.tsx:144` — `SheetFooter`
- `components/ui/alert.tsx:76` — `AlertAction`
- `components/ui/calendar.tsx:222` — `CalendarDayButton` (day-picker custom render slot)
- `components/ui/tabs.tsx:90` — `tabsListVariants` (CVA variants)
- `components/ui/table.tsx:111` — `TableFooter`
- `components/ui/table.tsx:115` — `TableCaption`
- `components/ui/select.tsx:184` — `SelectGroup`
- `components/ui/select.tsx:186` — `SelectLabel`
- `components/ui/select.tsx:187` — `SelectScrollDownButton`
- `components/ui/select.tsx:188` — `SelectScrollUpButton`
- `components/ui/select.tsx:189` — `SelectSeparator`
- `components/ui/dialog.tsx:159` — `DialogClose`
- `components/ui/dialog.tsx:164` — `DialogOverlay`
- `components/ui/dialog.tsx:165` — `DialogPortal`
- `components/ui/dialog.tsx:167` — `DialogTrigger`

**Module-internal type-graph KEEPs (3 entries):** Suppress via `knip.json` `ignoreExportsUsedInFile` (or per-file `ignore`) after Plan 06.

- `lib/email-sender/types.ts:5` `EmailAttachment` (interface) — KEEP because: load-bearing internal type within the email-sender module. Used at `types.ts:29` (`attachments?: EmailAttachment[]` inside `EmailOptions`). Knip false positive on transitive type references.
- `lib/email-sender/types.ts:46` `EmailProvider` (type) — KEEP because: used internally at `types.ts:51` and `:69` to compose `EmailClientConfig` and `EmailClient`. Load-bearing type-graph node.
- `lib/email-sender/types.ts:49` `EmailClientConfig` (interface) — KEEP because: provider factory parameter shape consumed by `account-sender.ts` via inference. Conservative bias on type-only references.

**Internal-cross-component KEEPs (2 entries):**

- `app/(shell)/app/bookings/_components/pushback-dialog-provider.tsx:44` `usePushbackDialog` — KEEP because: used at lines 109, 129 of the same file by `PushbackHeaderButton` and `PushbackDaySectionButton`. Knip miscounted internal cross-component use as zero-references.
- `app/(shell)/app/event-types/_lib/schema.ts:31` `customQuestionSchema` — KEEP because: used internally at `schema.ts:82` (`custom_questions: z.array(customQuestionSchema).default([])`). Required by Zod's runtime composition (the eventTypeSchema embeds it). Knip false positive on array-element schema references.

**Developer-tool KEEP (1 entry):**

- `lib/oauth/encrypt.ts:94` `generateKey` — KEEP because: ad-hoc CLI helper documented in JSDoc as `node -e "const { generateKey } = require('./lib/oauth/encrypt'); console.log(generateKey())"`. Designed for one-off key rotation; removal would force re-creation. Conservative bias.

---

## Items flipped INVESTIGATE → KEEP

(Items where Claude's investigation surfaced something the initial seeding missed, or where conservative bias prevented a false-positive REMOVE. Documents WHY the static analysis was wrong so future-Claude doesn't re-flag.)

- `shadcn` (dep) — Initial recommendation: INVESTIGATE. Investigation found: no source imports because the package is the shadcn/ui CLI binary used via `npx shadcn add`. Final: **KEEP**.
- `postcss-load-config` (unlisted) — Initial recommendation: INVESTIGATE. Investigation found: JSDoc `@type` annotation only (cosmetic); transitive peer of `@tailwindcss/postcss`. Final: **KEEP** (suppress via `ignoreDependencies`).
- `lib/oauth/encrypt.ts:94` `generateKey` — Initial recommendation: INVESTIGATE. Investigation found: ad-hoc CLI dev helper documented in JSDoc; designed to be called via `node -e`. Final: **KEEP**.
- `app/(shell)/app/bookings/_components/pushback-dialog-provider.tsx:44` `usePushbackDialog` — Initial recommendation: INVESTIGATE. Investigation found: knip miscounted; used at lines 109 and 129 of the same provider file. Final: **KEEP**.
- `app/(shell)/app/event-types/_lib/schema.ts:31` `customQuestionSchema` — Initial recommendation: INVESTIGATE. Investigation found: used at `schema.ts:82` via `z.array(customQuestionSchema)`. Knip undercounts Zod composition references. Final: **KEEP**.
- `lib/email-sender/types.ts:5` `EmailAttachment` (interface) — Initial recommendation: INVESTIGATE. Investigation found: used internally at `types.ts:29` inside `EmailOptions`. Final: **KEEP**.
- `lib/email-sender/types.ts:46` `EmailProvider` (type) — Initial recommendation: INVESTIGATE. Investigation found: composed into `EmailClientConfig` (line 51) and `EmailClient` (line 69). Final: **KEEP**.
- `lib/email-sender/types.ts:49` `EmailClientConfig` (interface) — Initial recommendation: INVESTIGATE. Investigation found: parameter shape consumed by `account-sender.ts` via inference. Final: **KEEP** (conservative).

## Items flipped INVESTIGATE → REMOVE

(For audit completeness — items where investigation confirmed the static-analysis verdict and we proceed with removal.)

- `lib/email/branding-blocks.ts:4` `DEFAULT_BRAND_PRIMARY` — Investigation confirmed duplicate of canonical site; this copy has zero readers. **REMOVE entirely.**
- `lib/bookings/pushback.ts:95` `isPastEod` — Investigation confirmed internal-only use at line 183. **REMOVE export keyword.**
- `lib/branding/read-branding.ts:11` `DEFAULT_BRAND_PRIMARY` — Investigation confirmed internal-only use at line 31. **REMOVE export keyword** (constant stays).
- `lib/branding/read-branding.ts:57` `getBrandingForAccount` — Investigation confirmed zero callers in `app/`, `lib/`, or `tests/`. **REMOVE entirely.**
- `lib/auth/rate-limits.ts:11` `AUTH_RATE_LIMITS` — Investigation confirmed internal-only use at lines 23, 39. **REMOVE export keyword.**
- `time-window-picker.tsx:16,22` `minutesToHHMM` / `hhmmToMinutes` — Investigation confirmed sibling files define their own private copies; export is vestigial. **REMOVE export keywords.**
- `branding/_lib/schema.ts:19,26` `PNG_MAGIC` / `logoFileSchema` — Investigation confirmed `actions.ts` inlines magic-byte literals and imports `MAX_LOGO_BYTES` directly. **REMOVE both entirely.**
- `actions-batch-cancel.ts:87` `CommitInverseOverrideInput` — Investigation confirmed zero consumers; action uses `inputSchema.parse()` directly. **REMOVE.**
- `event-types/_lib/types.ts:9` `CustomQuestion` — Investigation confirmed booker side declares a different interface; this OWNER-side export has zero external consumers. **REMOVE export keyword** (type stays for line 47 internal use).
- `login/schema.ts:14` `MagicLinkInput` — Investigation confirmed Phase 38 forms use schema directly via zodResolver. **REMOVE.**
- `availability/_lib/types.ts:62` `DateOverrideInput` — Investigation confirmed zero runtime/type-import consumers (only JSDoc comment reference at `schema.ts:88`). **REMOVE.**

---

## Recovery protocol

If `next build` or `vitest run` fails after a category commit during Plans 03-06:

1. `git revert <failing-commit>` (preserves history; do NOT amend or force-push).
2. Edit this file: move the offending item from REMOVE list to KEEP list with rationale "{commit-sha} caused regression: {symptom}".
3. Continue with remaining batches.
