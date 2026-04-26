---
phase: 07-widget-and-branding
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/branding/contrast.ts
  - lib/branding/read-branding.ts
  - lib/branding/types.ts
  - app/[account]/[event-slug]/_lib/types.ts
  - app/[account]/[event-slug]/_lib/load-event-type.ts
  - tests/branding-contrast.test.ts
autonomous: true

must_haves:
  truths:
    - "WCAG contrast helper picks white text for dark colors and black text for light colors"
    - "AccountSummary type includes logo_url and brand_primary"
    - "loadEventTypeForBookingPage selects logo_url + brand_primary from accounts"
    - "RESERVED_SLUGS includes 'embed' (prevents future /[account]=embed conflict with /embed/* route)"
    - "All consumers (booking page, embed, confirmation, cancel, reschedule, emails) can call a single helper to get account branding"
  artifacts:
    - path: "lib/branding/contrast.ts"
      provides: "pickTextColor(hex) -> '#ffffff' | '#000000' + relativeLuminance(hex)"
      exports: ["pickTextColor", "relativeLuminance"]
    - path: "lib/branding/read-branding.ts"
      provides: "Server-only helper: getBrandingForAccount(accountId) -> { logoUrl, primaryColor, textColor, primaryColorWithFallback }"
      exports: ["getBrandingForAccount", "DEFAULT_BRAND_PRIMARY"]
    - path: "lib/branding/types.ts"
      provides: "Branding type interface shared across surfaces"
      exports: ["Branding"]
    - path: "app/[account]/[event-slug]/_lib/types.ts"
      provides: "Extended AccountSummary with logo_url + brand_primary"
      contains: "logo_url"
    - path: "tests/branding-contrast.test.ts"
      provides: "Vitest unit tests for pickTextColor across known hex inputs"
  key_links:
    - from: "lib/branding/read-branding.ts"
      to: "lib/branding/contrast.ts"
      via: "import { pickTextColor }"
      pattern: "pickTextColor"
    - from: "app/[account]/[event-slug]/_lib/load-event-type.ts"
      to: "accounts table"
      via: "supabase.from('accounts').select includes logo_url, brand_primary"
      pattern: "logo_url.*brand_primary"
---

<objective>
Build the shared branding foundation: WCAG contrast helper, server-only branding read helper, type extensions to AccountSummary, and the addition of "embed" to RESERVED_SLUGS so the new /embed/* top-level route does not conflict with the /[account] dynamic segment.

Purpose: Every downstream Phase 7 plan (embed route, branding editor, booking page surfaces, email senders, /[account] index) needs to load `logo_url` + `brand_primary` from the `accounts` table and compute a readable text color against the primary. Centralizing this in `lib/branding/` is the single-source pattern locked by RESEARCH.md (§Pattern 6 + §Pattern 5).

Output: `lib/branding/{contrast,read-branding,types}.ts`, type extension to AccountSummary, RESERVED_SLUGS update, and Vitest tests for the contrast helper.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07-widget-and-branding/07-CONTEXT.md
@.planning/phases/07-widget-and-branding/07-RESEARCH.md

# Existing files this plan extends
@app/[account]/[event-slug]/_lib/types.ts
@app/[account]/[event-slug]/_lib/load-event-type.ts
@lib/supabase/admin.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create lib/branding/contrast.ts + types.ts + Vitest unit tests</name>
  <files>
    lib/branding/contrast.ts
    lib/branding/types.ts
    tests/branding-contrast.test.ts
  </files>
  <action>
    Create `lib/branding/contrast.ts` with the W3C-spec WCAG contrast formula from RESEARCH.md §Pattern 5. Export two functions:

    - `relativeLuminance(hex: string): number` — sRGB linearization with 0.04045 threshold (NOT 0.03928 — RESEARCH.md flagged the spec discrepancy; use 0.04045)
    - `pickTextColor(bgHex: string): "#ffffff" | "#000000"` — returns the higher-contrast option against the background hex

    Also create `lib/branding/types.ts`:

    ```typescript
    export interface Branding {
      logoUrl: string | null;
      primaryColor: string;          // resolved (DEFAULT if null in DB)
      textColor: "#ffffff" | "#000000"; // contrast pick
    }
    ```

    Hex parsing: assume 7-character `#RRGGBB` format (validated upstream by Zod in Plan 07-04). The function MUST gracefully handle inputs that fail the format — wrap parseInt result with `Number.isFinite` guard and fall back to `#0A2540` luminance. (Defensive — Zod gates input but downstream callers may forget.)

    Then create `tests/branding-contrast.test.ts` (Vitest) with these cases:
    - `pickTextColor('#ffffff')` → `'#000000'` (white background needs black text)
    - `pickTextColor('#000000')` → `'#ffffff'` (black background needs white text)
    - `pickTextColor('#0A2540')` → `'#ffffff'` (NSI navy is dark)
    - `pickTextColor('#F97316')` → `'#000000'` (NSI orange is light enough for black per W3C formula)
    - `pickTextColor('#777777')` → either `'#ffffff'` or `'#000000'` (boundary; assert it's one of the two — DO NOT lock specific value, this is the spec's gray boundary)
    - `pickTextColor('#bad-input')` → does NOT throw; returns one of the two valid values (defensive)
    - `relativeLuminance('#ffffff')` ≈ 1.0 within 0.001 tolerance
    - `relativeLuminance('#000000')` === 0
  </action>
  <verify>
    `npm test -- tests/branding-contrast.test.ts` passes all cases.
    `node -e "console.log(require('./lib/branding/contrast.ts'))"` is NOT a valid check (TS file). Instead: `npx tsc --noEmit lib/branding/contrast.ts lib/branding/types.ts` returns no errors.
  </verify>
  <done>
    contrast.ts exports `pickTextColor` + `relativeLuminance`; types.ts exports `Branding` interface; Vitest suite passes 6+ cases including defensive bad-input case.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create lib/branding/read-branding.ts (server-only helper)</name>
  <files>
    lib/branding/read-branding.ts
  </files>
  <action>
    Create `lib/branding/read-branding.ts` with `import "server-only"` as line 1 (mirrors `lib/supabase/admin.ts` pattern locked in STATE.md).

    Export:
    - `DEFAULT_BRAND_PRIMARY = "#0A2540"` (NSI navy from Phase 2 lock — Tailwind v4 `@theme` `--color-primary`)
    - `async function getBrandingForAccount(accountId: string): Promise<Branding>` — calls `createAdminClient()`, selects `logo_url, brand_primary` from `accounts` WHERE id = accountId, returns `Branding` object with:
      - `logoUrl: row?.logo_url ?? null`
      - `primaryColor: row?.brand_primary ?? DEFAULT_BRAND_PRIMARY`
      - `textColor: pickTextColor(row?.brand_primary ?? DEFAULT_BRAND_PRIMARY)`
    - `function brandingFromRow(row: { logo_url: string | null; brand_primary: string | null }): Branding` — pure synchronous variant for callers that ALREADY have the row (booking page loader, /[account] loader). Avoids redundant DB round-trip.

    Why both: booking page already SELECTs accounts row; passing it through `brandingFromRow` is zero-cost. Email senders and embed page may receive only `accountId` and use `getBrandingForAccount`.

    No DB write paths. No error logging beyond letting Supabase errors bubble — caller decides fallback. If row missing entirely, return all-defaults Branding (logoUrl null, primaryColor DEFAULT, textColor white).

    Reference: RESEARCH.md §Pattern 6 "Single source: accounts table columns logo_url + brand_primary".
  </action>
  <verify>
    File exists. `import "server-only"` is line 1. `npx tsc --noEmit lib/branding/read-branding.ts` passes (path alias `@/` for supabase admin).

    Smoke: `npx tsx -e "import('./lib/branding/read-branding.ts').then(m => console.log(Object.keys(m)))"` — but tsx may not be installed. Alternative verify: grep that the file exports `getBrandingForAccount`, `brandingFromRow`, `DEFAULT_BRAND_PRIMARY`.
  </verify>
  <done>
    read-branding.ts exists with server-only gate; exports getBrandingForAccount + brandingFromRow + DEFAULT_BRAND_PRIMARY; uses pickTextColor from contrast.ts; uses createAdminClient from @/lib/supabase/admin.
  </done>
</task>

<task type="auto">
  <name>Task 3: Extend AccountSummary type + load-event-type SELECT + RESERVED_SLUGS adds "embed"</name>
  <files>
    app/[account]/[event-slug]/_lib/types.ts
    app/[account]/[event-slug]/_lib/load-event-type.ts
  </files>
  <action>
    Edit `app/[account]/[event-slug]/_lib/types.ts`: add two fields to `AccountSummary`:
    ```typescript
    logo_url: string | null;
    brand_primary: string | null;
    ```
    Place them at the end of the interface (after `owner_email`). DO NOT change the existing fields — Phase 5/6 callers depend on the exact existing shape.

    Edit `app/[account]/[event-slug]/_lib/load-event-type.ts`:

    1. Update the `accounts` SELECT to include the two new columns:
       ```typescript
       .select("id, slug, name, timezone, owner_email, logo_url, brand_primary")
       ```

    2. Pass the new fields through to the returned `account` object:
       ```typescript
       account: {
         id: accountRow.id,
         slug: accountRow.slug,
         name: accountRow.name,
         timezone: accountRow.timezone,
         owner_email: accountRow.owner_email,
         logo_url: accountRow.logo_url,
         brand_primary: accountRow.brand_primary,
       },
       ```

    3. Update `RESERVED_SLUGS` from `new Set(["app", "api", "_next", "auth"])` to `new Set(["app", "api", "_next", "auth", "embed"])`.

       WHY: Plan 07-03 introduces `/embed/[account]/[event-slug]`. Next.js routes static segments before dynamic, but RESEARCH.md Pitfall 8 explicitly recommends adding "embed" to RESERVED_SLUGS as belt-and-suspenders. Same guard fires for both the booking page loader AND `generateMetadata` (CONTEXT lock from Phase 5).

    DO NOT touch `app/[account]/[event-slug]/_lib/load-confirmed-booking.ts` in this task — confirmation page has its own loader; Plan 07-06 will branch it.
  </action>
  <verify>
    `npx tsc --noEmit` passes for the whole project (types.ts is consumed by booking-shell, page.tsx, confirmed/page.tsx — they should all still compile because the new fields are additive).

    `grep -n 'logo_url' app/[account]/[event-slug]/_lib/types.ts` shows the field.
    `grep -n 'logo_url' app/[account]/[event-slug]/_lib/load-event-type.ts` shows it in the SELECT and the return object.
    `grep -n '"embed"' app/[account]/[event-slug]/_lib/load-event-type.ts` shows the new RESERVED_SLUGS entry.
  </verify>
  <done>
    AccountSummary has logo_url + brand_primary fields; load-event-type SELECTs and returns them; RESERVED_SLUGS includes "embed"; full project tsc clean; existing Phase 5/6 booking shell still compiles unchanged.
  </done>
</task>

</tasks>

<verification>
- `npm test` — all existing tests still green (no behavior change to consumers; only additive fields).
- `npm test -- tests/branding-contrast.test.ts` — new contrast suite passes.
- `npx tsc --noEmit` — type-clean.
- `git diff --stat lib/branding/` — 3 new files (contrast.ts, read-branding.ts, types.ts) + 1 test file.
- `git diff app/[account]/[event-slug]/_lib/` — additive changes to types.ts (2 fields) and load-event-type.ts (SELECT + return + RESERVED_SLUGS).
</verification>

<success_criteria>
1. `pickTextColor("#0A2540")` returns `"#ffffff"`; `pickTextColor("#ffffff")` returns `"#000000"` (Vitest passes).
2. `getBrandingForAccount(nsiAccountId)` returns a `Branding` object with sensible defaults when DB columns are null.
3. Existing `loadEventTypeForBookingPage("nsi", "consultation")` still returns the same shape PLUS `account.logo_url` and `account.brand_primary`.
4. Visiting any `/embed/*` URL would no longer accidentally match `/[account]=embed/[event-slug]` (verified by RESERVED_SLUGS grep — actual /embed route arrives in Plan 07-03).
5. No regressions in Phase 5/6 tests (run `npm test`, all 66 prior tests still green).
</success_criteria>

<output>
After completion, create `.planning/phases/07-widget-and-branding/07-01-SUMMARY.md` documenting:
- Files added (lib/branding/{contrast,read-branding,types}.ts + tests/branding-contrast.test.ts)
- Files modified (AccountSummary extension, RESERVED_SLUGS update)
- Public API surface for downstream plans (07-03 embed, 07-04 editor, 07-06 booking surfaces, 07-07 emails, 07-08 /[account] index)
- Default fallback color and rationale
- Decisions locked (e.g., DEFAULT_BRAND_PRIMARY = NSI navy; brandingFromRow vs getBrandingForAccount split)
</output>
