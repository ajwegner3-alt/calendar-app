---
phase: 10
plan: 01
type: execute
name: "reserved-slugs-consolidation"
wave: 1
depends_on: []
files_modified:
  - "lib/reserved-slugs.ts"
  - "app/[account]/_lib/load-account-listing.ts"
  - "app/[account]/[event-slug]/_lib/load-event-type.ts"
autonomous: true
must_haves:
  truths:
    - "RESERVED_SLUGS is defined in exactly one place: lib/reserved-slugs.ts"
    - "Both v1.0 consumers import from the new module (no duplicate Set definitions remain)"
    - "Reserved set includes: app, api, _next, auth, embed, signup, onboarding, login, forgot-password, settings"
  artifacts:
    - path: "lib/reserved-slugs.ts"
      provides: "Single source of truth RESERVED_SLUGS Set + isReservedSlug() helper"
      contains: "export const RESERVED_SLUGS"
  key_links:
    - from: "app/[account]/_lib/load-account-listing.ts"
      to: "lib/reserved-slugs.ts"
      via: "import { RESERVED_SLUGS } from '@/lib/reserved-slugs'"
    - from: "app/[account]/[event-slug]/_lib/load-event-type.ts"
      to: "lib/reserved-slugs.ts"
      via: "import { RESERVED_SLUGS } from '@/lib/reserved-slugs'"
  requirements:
    - "ONBOARD-05 (set membership; live collision check ships in 10-06)"
---

## Objective

Consolidate the v1.0 `RESERVED_SLUGS` Set duplicated across two `_lib` files into a single module at `lib/reserved-slugs.ts`. The slug picker (Plan 10-06) is the third consumer — consolidating now avoids three-way drift and unblocks downstream waves.

## Context

**Locked from STATE.md:** "RESERVED_SLUGS duplicated across 2 files in v1.0 — Phase 10 step 1 consolidates."

**Two existing call sites (FUTURE_DIRECTIONS.md §2):**
- `app/[account]/_lib/load-account-listing.ts:8` — `const RESERVED_SLUGS = new Set(["app", "api", "_next", "auth", "embed"]);`
- `app/[account]/[event-slug]/_lib/load-event-type.ts:9` — same Set, defined separately.

**Build order (ROADMAP §Phase 10):** This plan is build-order step #1 — it must land before any downstream plan adds a 3rd consumer.

## Tasks

<task id="1" type="auto">
  <description>
    Create `lib/reserved-slugs.ts` with the canonical Set and a small helper.

    Contents:
    ```ts
    /**
     * Single source of truth for slugs that cannot be claimed as account slugs.
     * Consolidated in Phase 10 (Plan 10-01) — was previously duplicated across
     * `app/[account]/_lib/load-account-listing.ts` and
     * `app/[account]/[event-slug]/_lib/load-event-type.ts`.
     *
     * Adds Phase 10 entries for new top-level routes: signup, onboarding, login,
     * forgot-password, settings (settings is already implicitly covered via
     * /app/settings, but adding the bare path closes a future-proofing edge).
     */
    export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
      // v1.0 entries (from FUTURE_DIRECTIONS.md §2)
      "app",
      "api",
      "_next",
      "auth",
      "embed",
      // v1.1 Phase 10 additions
      "signup",
      "onboarding",
      "login",
      "forgot-password",
      "settings",
    ]);

    export function isReservedSlug(slug: string): boolean {
      return RESERVED_SLUGS.has(slug);
    }
    ```

    Use `ReadonlySet<string>` so consumers cannot mutate the export.
  </description>
  <files>lib/reserved-slugs.ts (new)</files>
  <verification>
    Run `npx tsc --noEmit` — no errors.
    Run `npx eslint lib/reserved-slugs.ts` — no errors.
  </verification>
</task>

<task id="2" type="auto">
  <description>
    Update both v1.0 consumers to import from the new module instead of defining their own Set.

    `app/[account]/_lib/load-account-listing.ts`:
    - Remove the local `const RESERVED_SLUGS = new Set([...]);` and the comment about mirroring.
    - Add `import { RESERVED_SLUGS } from "@/lib/reserved-slugs";` at top.
    - The existing `if (RESERVED_SLUGS.has(accountSlug)) return null;` line stays unchanged — same Set, same has() semantics.

    `app/[account]/[event-slug]/_lib/load-event-type.ts`:
    - Same change. Remove local Set, add import.

    Do NOT remove the `if (RESERVED_SLUGS.has(...)) return null;` guard logic in either file — only the Set definition is moving, not the usage.
  </description>
  <files>
    app/[account]/_lib/load-account-listing.ts
    app/[account]/[event-slug]/_lib/load-event-type.ts
  </files>
  <verification>
    `git grep "new Set(\\[\"app\", \"api\""` returns ZERO matches in `app/` — only `lib/reserved-slugs.ts`.
    `npm test -- tests/` passes (existing v1.0 tests that exercise these `_lib` functions stay green).
    `npx tsc --noEmit` — no errors.
  </verification>
</task>

## Verification Criteria

- `lib/reserved-slugs.ts` exists and exports `RESERVED_SLUGS` (Set) + `isReservedSlug` (helper).
- `git grep "RESERVED_SLUGS"` shows: 1 declaration site (`lib/reserved-slugs.ts`) + 2 import sites + any v1.0 doc references.
- No duplicate Set definitions remain anywhere in `app/`.
- `npm test` passes (existing tenant-resolution tests covering reserved slugs continue to pass).
- `npx tsc --noEmit` clean.

## must_haves

- ONBOARD-05 (the *consolidation* portion — the wizard picker validation against this set is in 10-06).
