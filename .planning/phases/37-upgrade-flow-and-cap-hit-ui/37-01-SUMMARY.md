---
phase: 37-upgrade-flow-and-cap-hit-ui
plan: "01"
name: schema-and-banner-link
subsystem: schema, ui-banner
tags: [supabase, migration, next-link, server-component, accounts, cap-hit-banner]
status: complete

dependency-graph:
  requires:
    - "36-resend-backend-for-upgraded-accounts (accounts table exists; email_provider column added)"
  provides:
    - "accounts.last_upgrade_request_at column (nullable timestamptz, 24h debounce substrate)"
    - "UnsentConfirmationsBanner with inline Request upgrade Link to /app/settings/upgrade"
  affects:
    - "37-02 (requestUpgradeAction reads/writes last_upgrade_request_at)"
    - "37-03 (settings upgrade page rendered at /app/settings/upgrade — the link destination)"

tech-stack:
  added: []
  patterns:
    - "next/link Link used inside server component (no use client required)"
    - "Nullable timestamptz column with no default — NULL signals no request ever made"

key-files:
  created:
    - supabase/migrations/20260508120000_phase37_last_upgrade_request_at.sql
  modified:
    - app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx

decisions:
  - id: D1
    decision: "last_upgrade_request_at has no DEFAULT — existing rows get NULL"
    rationale: "NULL = no request ever submitted. Any non-NULL value is a timestamp. DEFAULT NULL would be redundant; explicit omission makes the intent clearer."
  - id: D2
    decision: "No database index on last_upgrade_request_at"
    rationale: "Reads are single-row keyed by accounts.id (PK). Full-table scan never occurs."
  - id: D3
    decision: "No CHECK constraint for 24h rate limit"
    rationale: "Business logic (24h debounce) lives in requestUpgradeAction (Plan 02), not the DB. Keeps schema changes minimal."
  - id: D4
    decision: "Link inherits amber text color — no explicit color class"
    rationale: "Banner is error-only amber; link reads as part of warning copy, not a standalone CTA button. Matches plan spec exactly."

metrics:
  duration: "~2 minutes"
  completed: "2026-05-08"
  tasks-completed: 2
  tasks-total: 2
  commits:
    - hash: 1eb0850
      message: "chore(37-01): add accounts.last_upgrade_request_at migration"
    - hash: ab285ba
      message: "feat(37-01): append Request upgrade link to unsent-confirmations banner"
---

# Phase 37 Plan 01: Schema and Banner Link Summary

**One-liner:** Nullable `timestamptz` column for 24h upgrade debounce + inline `next/link` "Request upgrade" entry point appended to cap-hit banner.

## What Was Done

### Task 1 — Migration: accounts.last_upgrade_request_at

Created `supabase/migrations/20260508120000_phase37_last_upgrade_request_at.sql`.

- Column type: `timestamptz`, nullable, no DEFAULT (existing rows get NULL automatically)
- NULL semantics: NULL = account has never submitted an upgrade request
- No new RLS policy needed: existing "owners update own account" policy in `20260419120001_rls_policies.sql` already covers all `accounts` columns
- No index: reads are keyed by `accounts.id` (PK), so single-row lookup is always fast
- No CHECK constraint: the 24h debounce logic lives in `requestUpgradeAction` (Plan 02), not the schema

Migration follows Phase 36 naming convention (`YYYYMMDD_HHMMSS_phaseNN_description.sql`) and style (detailed header comment explaining intent, backfill semantics, and RLS reasoning).

### Task 2 — Banner: Request upgrade link

Modified `app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx`:

- Added `import Link from "next/link"` at file top (server-component-safe; no `use client` required)
- Appended `{" "}<Link href="/app/settings/upgrade" className="underline underline-offset-2 font-medium">Request upgrade</Link>` immediately after "The quota resets at UTC midnight." inside the existing `<div role="alert">` element
- **Visibility gating unchanged**: banner still returns `null` when `count <= 0`; link inherits that guard by being inside the conditional render
- **Server component preserved**: no `"use client"` directive added
- **No style changes** beyond the new link's own Tailwind classes; amber color tokens untouched

## Verification Results

| Check | Result |
|---|---|
| `grep "/app/settings/upgrade" banner.tsx` | 1 match (line 39) |
| `grep "Request upgrade" banner.tsx` | 1 match (line 42) |
| `grep '"use client"' banner.tsx` | 0 matches |
| `grep "count <= 0" banner.tsx` | 1 match (line 23, gating unchanged) |
| `grep "last_upgrade_request_at" supabase/migrations/` | 1 match (new file only) |
| `npx tsc --noEmit` errors in modified files | 0 (pre-existing test errors unrelated) |
| `npm run lint` errors in modified files | 0 (pre-existing test errors unrelated) |

## Plan Wiring (What Comes Next)

- **Plan 02 (requestUpgradeAction)** will introduce the first code reference to `last_upgrade_request_at` — reads it to enforce 24h debounce, writes it on successful submission
- **Plan 03 (settings upgrade page)** will be the first code that renders at `/app/settings/upgrade` — the route this plan's banner link now points to (clicking will 404 until Plan 03 ships; this is expected and documented in the plan)

## Deviations from Plan

None — plan executed exactly as written.
