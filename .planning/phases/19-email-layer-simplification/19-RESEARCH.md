# Phase 19: Email Layer Simplification - Research

**Researched:** 2026-05-01
**Domain:** Email rendering layer refactor — `EmailBranding` interface collapse, color resolution simplification, footer replacement
**Confidence:** HIGH — all findings from direct source code reads

---

## Summary

Phase 19 is a pure refactor of 10 files with a very tight, well-defined scope. All source files have been read. The current code has a 3-tier priority chain (`sidebarColor ?? brand_primary ?? DEFAULT`) in `renderEmailBrandedHeader`. The target is a 2-tier chain (`brand_primary ?? NEW_DEFAULT`). Six sender files each carry a deprecated `AccountRecord` interface with optional `background_color?`, `chrome_tint_intensity?`, and `sidebar_color?` fields — these need removal. Four callers each SELECT those columns from the DB — those SELECT strings need trimming. The footer currently conditionally renders an `<img>` for `nsi-mark.png` and falls back to a text-only render in test; Phase 19 removes the conditional entirely and makes text-only the only render path.

The web-side `PoweredByNsi` component (Phase 17) is already text-only with no image. The email footer is catching up to match it.

**Primary recommendation:** Ship as a single atomic commit. The type change in `EmailBranding` is consumed by exactly 6 senders and 4 callers — all in the same repo, all readable at once. No external consumers. `tsc --noEmit` will catch every missed update.

---

## Current State: File-by-File Inventory

### `lib/email/branding-blocks.ts` — THE PRIMARY TARGET

**Current `EmailBranding` interface (lines 7–22):**
```typescript
export interface EmailBranding {
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
  backgroundColor: string | null;          // REMOVE: ignored since Phase 12.6
  sidebarColor?: string | null;            // REMOVE: was priority-1 source
  chromeTintIntensity?: "none" | "subtle" | "full";  // REMOVE: deprecated Phase 12.6
}
```

**Current color resolution in `renderEmailBrandedHeader` (lines 53–56):**
```typescript
const bg =
  branding.sidebarColor ??
  branding.brand_primary ??
  DEFAULT_BRAND_PRIMARY;
```

**Current `DEFAULT_BRAND_PRIMARY` (line 4):** `"#0A2540"` — NSI navy. This must change to `#3B82F6` (NSI blue-500). **IMPORTANT:** `lib/branding/read-branding.ts` has its own `DEFAULT_BRAND_PRIMARY = "#0A2540"` which is kept as-is per CONTEXT lock. These two constants intentionally diverge.

**Current `renderEmailFooter` (lines 106–114):**
```typescript
const NSI_MARK_URL: string | null = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/nsi-mark.png`
  : null;

const NSI_HOMEPAGE_URL = "https://nsintegrations.com";

export function renderEmailFooter(): string {
  const markHtml = NSI_MARK_URL
    ? `<img src="${NSI_MARK_URL}" alt="NSI" ... /> `
    : "";
  return `<hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px 0;"/>
  <p style="margin: 0; font-size: 12px; color: #888; text-align: center;">
    ${markHtml}<span style="vertical-align:middle;">Powered by </span><a href="${NSI_HOMEPAGE_URL}" style="color:#888;text-decoration:underline;"><strong>North Star Integrations</strong></a>
  </p>`;
}
```

Note: `NSI_HOMEPAGE_URL` is `"https://nsintegrations.com"`. The CONTEXT.md decision locks the URL to `"https://northstarintegrations.com"`. These differ — the footer URL needs updating as part of this phase.

**`renderBrandedButton` (lines 122–130):** Uses its own `opts.primaryColor ?? DEFAULT_BRAND_PRIMARY`. After the constant changes to `#3B82F6`, buttons will also default to blue. This is correct behavior — no structural change needed, the constant drives it.

**`brandedHeadingStyle` (lines 135–138):** Same pattern — `primaryColor ?? DEFAULT_BRAND_PRIMARY`. Same consequence.

**`renderEmailLogoHeader` (lines 78–88):** Deprecated helper retained from Phase 12 migration. Takes `Pick<EmailBranding, "name" | "logo_url">` — no deprecated fields. Unaffected by this phase.

**`stripHtml` (lines 146–162):** Unaffected.

---

### The 6 Senders — AccountRecord Interfaces and `branding` Object Construction

All 6 senders follow an identical pattern: they define a local `AccountRecord` interface, then construct a `branding` literal from the account fields before passing to `renderEmailBrandedHeader`. The `branding` literal is where the deprecated fields are assembled.

#### `lib/email/send-booking-confirmation.ts`

**Local `AccountRecord` (lines 29–42):**
```typescript
interface AccountRecord {
  name: string;
  timezone: string;
  owner_email: string | null;
  slug: string;
  logo_url: string | null;
  brand_primary: string | null;
  background_color?: string | null;        // REMOVE
  chrome_tint_intensity?: string | null;   // REMOVE
  sidebar_color?: string | null;           // REMOVE
}
```

**`branding` construction (lines 87–93):**
```typescript
const branding = {
  name: account.name,
  logo_url: account.logo_url,
  brand_primary: account.brand_primary,
  backgroundColor: account.background_color ?? null,   // REMOVE
  sidebarColor: account.sidebar_color ?? null,          // REMOVE
};
```

Also uses `account.brand_primary` directly in `brandedHeadingStyle` and `renderBrandedButton` calls — these stay (they pass `brand_primary`, not deprecated fields).

Has plain-text alt: `text: stripHtml(html)` — **MUST NOT regress** (EMAIL-20).

#### `lib/email/send-booking-emails.ts`

This file is a thin orchestrator. It imports from `send-booking-confirmation` and `send-owner-notification`, extends `SendBookingConfirmationArgs`, and delegates. **The `AccountRecord` interface it exposes is via re-export from the confirmation sender — no local AccountRecord.** No direct `branding` construction here. **Changes needed: zero** — it picks up the type changes from the senders it imports.

#### `lib/email/send-cancel-emails.ts`

**Local `AccountRecord` (lines 33–46):**
```typescript
interface AccountRecord {
  name: string;
  slug: string;
  timezone: string;
  owner_email: string | null;
  logo_url: string | null;
  brand_primary: string | null;
  background_color?: string | null;        // REMOVE
  chrome_tint_intensity?: string | null;   // REMOVE
  sidebar_color?: string | null;           // REMOVE
}
```

**`branding` constructions: TWO sites** — `sendBookerCancelEmail` (lines 100–106) and `sendOwnerCancelEmail` (lines 205–211). Both:
```typescript
const branding = {
  name: account.name,
  logo_url: account.logo_url,
  brand_primary: account.brand_primary,
  backgroundColor: account.background_color ?? null,   // REMOVE
  sidebarColor: account.sidebar_color ?? null,          // REMOVE
};
```

Booker cancel has plain-text alt: `text: stripHtml(html)` — **MUST NOT regress** (EMAIL-20).
Owner cancel has no `text:` field — correct by design, no change needed.

#### `lib/email/send-reschedule-emails.ts`

**Local `AccountRecord` (lines 37–43):**
```typescript
interface AccountRecord {
  // ...
  background_color?: string | null;        // REMOVE
  chrome_tint_intensity?: string | null;   // REMOVE
  sidebar_color?: string | null;           // REMOVE
}
```

**`branding` constructions: TWO sites** — `sendBookerRescheduleEmail` (lines 104–110) and `sendOwnerRescheduleEmail` (lines 207–213).

Booker reschedule has plain-text alt: `text: stripHtml(html)` — **MUST NOT regress** (EMAIL-20).
Owner reschedule has no `text:` field — correct, no change.

#### `lib/email/send-reminder-booker.ts`

**Local `ReminderAccountRecord` (lines 64–80):**
```typescript
interface ReminderAccountRecord {
  slug: string;
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
  background_color?: string | null;        // REMOVE
  chrome_tint_intensity?: string | null;   // REMOVE
  sidebar_color?: string | null;           // REMOVE
  owner_email?: string | null;
  reminder_include_custom_answers: boolean;
  reminder_include_location: boolean;
  reminder_include_lifecycle_links: boolean;
}
```

**`branding` construction (lines 112–118):**
```typescript
const branding = {
  name: account.name,
  logo_url: account.logo_url,
  brand_primary: account.brand_primary,
  backgroundColor: account.background_color ?? null,   // REMOVE
  sidebarColor: account.sidebar_color ?? null,          // REMOVE
};
```

Has plain-text alt: `const text = stripHtml(html)` — **MUST NOT regress** (EMAIL-20).

#### `lib/email/send-owner-notification.ts`

**Local `AccountRecord` (lines 25–37):**
```typescript
interface AccountRecord {
  name: string;
  timezone: string;
  owner_email: string | null;
  logo_url: string | null;
  brand_primary: string | null;
  background_color?: string | null;        // REMOVE
  chrome_tint_intensity?: string | null;   // REMOVE
  sidebar_color?: string | null;           // REMOVE
}
```

**`branding` construction (lines 78–84):**
```typescript
const branding = {
  name: account.name,
  logo_url: account.logo_url,
  brand_primary: account.brand_primary,
  backgroundColor: account.background_color ?? null,   // REMOVE
  sidebarColor: account.sidebar_color ?? null,          // REMOVE
};
```

No plain-text alt — correct by design (owner emails intentionally HTML-only).

Also has a hardcoded `#0A2540` color value at line 125 in the email link style:
```typescript
<a href="mailto:..." style="color: #0A2540;">
```
This is NOT driven by `DEFAULT_BRAND_PRIMARY` — it's a hardcoded inline string. It should be updated to reference `brand_primary` or the new default blue. The CONTEXT locks the default to `#3B82F6` but this link is inside the HTML body, not the header band. **Recommendation:** update to `style="color:${escapeHtml(account.brand_primary ?? '#3B82F6')};"` to stay consistent with the rest of the template's brand-color usage.

---

### The 4 Callers — SELECT Clauses (CP-01 Pre-Flight Targets)

#### `app/api/bookings/route.ts`

**SELECT at line 171:**
```typescript
.select("id, slug, name, timezone, owner_email, logo_url, brand_primary, background_color, chrome_tint_intensity, sidebar_color")
```
Remove: `background_color, chrome_tint_intensity, sidebar_color`

**Two construction sites** in the account object literal passed to `sendBookingEmails` (lines 298–309 and 329–335). Both pass `background_color`, `chrome_tint_intensity`, `sidebar_color`. Remove from both.

**Enriched join SELECT at lines 396–404:**
```typescript
accounts!inner(
  slug, name, logo_url, brand_primary, background_color, chrome_tint_intensity, sidebar_color,
  owner_email, ...
)
```
Remove: `background_color, chrome_tint_intensity, sidebar_color`

**`ScanRow`-equivalent construction for `sendReminderBooker` (lines 440–450):** Passes `background_color`, `chrome_tint_intensity`, `sidebar_color`. Remove.

#### `app/api/cron/send-reminders/route.ts`

**`ScanRow` interface `accounts` sub-shape (lines 86–98):**
```typescript
accounts: {
  // ...
  background_color: string | null;         // REMOVE
  chrome_tint_intensity: string | null;    // REMOVE
  sidebar_color: string | null;            // REMOVE
  // ...
}
```

**SELECT at lines 133–141:**
```typescript
accounts!inner(
  slug, name, logo_url, brand_primary, background_color, chrome_tint_intensity, sidebar_color,
  owner_email, ...
)
```
Remove: `background_color, chrome_tint_intensity, sidebar_color`

**`sendReminderBooker` call at lines 258–265:** Passes `background_color`, `chrome_tint_intensity`, `sidebar_color`. Remove.

#### `lib/bookings/cancel.ts`

**Pre-fetch SELECT at lines 87–90:**
```typescript
accounts!inner(name, slug, timezone, owner_email, logo_url, brand_primary, background_color, chrome_tint_intensity, sidebar_color)
```
Remove: `background_color, chrome_tint_intensity, sidebar_color`

**`sendCancelEmails` call account object (lines 175–184):** Passes `background_color`, `chrome_tint_intensity`, `sidebar_color`. Remove.

#### `lib/bookings/reschedule.ts`

**Pre-fetch SELECT at lines 109–112:**
```typescript
accounts!inner(name, slug, timezone, owner_email, logo_url, brand_primary, background_color, chrome_tint_intensity, sidebar_color)
```
Remove: `background_color, chrome_tint_intensity, sidebar_color`

**`sendRescheduleEmails` call account object (lines 196–204):** Passes `background_color`, `chrome_tint_intensity`, `sidebar_color`. Remove.

---

### `lib/branding/read-branding.ts` — Reference Only

`DEFAULT_BRAND_PRIMARY = "#0A2540"` — **unchanged**. Phase 18 already shrunk its SELECT to `logo_url, brand_primary`. The `brandingFromRow` function pattern can be used as a reference for an `emailBrandingFromRow` helper, but per CONTEXT decision analysis below, inline construction is simpler here.

---

### `tests/email-branded-header.test.ts` — 11 Tests Needing Updates

The test file has 11 tests in `describe("renderEmailBrandedHeader")` + 3 in `describe("stripHtml")`. The `stripHtml` tests are unaffected.

**Tests requiring updates:**

| Test | Current assertion | Required change |
|------|-------------------|-----------------|
| #1 | `baseBranding({ sidebarColor: "#1A3A5C" })` — asserts sidebarColor wins | Remove sidebarColor from fixture; test should verify brand_primary wins when set |
| #2 | `baseBranding({ sidebarColor: "#ffffff" })` — light sidebarColor | Replace with light brand_primary test |
| #3 | `baseBranding({ sidebarColor: "#1A3A5C", logo_url: ... })` | Remove sidebarColor |
| #4 | `baseBranding({ logo_url: null })` | Already fine — no sidebarColor dependency |
| #5 | `baseBranding({ sidebarColor: null, brand_primary: "#F97316" })` — sidebarColor null → brand_primary | Already tests correct post-phase behavior; just drop sidebarColor from call |
| #6 | `baseBranding({ sidebarColor: null, brand_primary: null })` — expects `#0A2540` | Update expected value to `#3B82F6` |
| #7 | Table structure test — no deprecated fields | Fine |
| #8 | HTML encoding test | Fine |
| #9 | `sidebarColor: "#FF0000" takes precedence over brand_primary` | This test validates old behavior — REMOVE or replace with brand_primary priority test |
| #10 | `chromeTintIntensity` backward compat ignored | REMOVE |
| #11 | `backgroundColor` backward compat ignored | REMOVE |

**`baseBranding` factory (lines 16–24):**
```typescript
function baseBranding(overrides: Partial<EmailBranding> = {}): EmailBranding {
  return {
    name: "Acme Plumbing",
    logo_url: null,
    brand_primary: "#0A2540",
    backgroundColor: null,    // REMOVE
    ...overrides,
  };
}
```

**Post-phase `baseBranding`:**
```typescript
function baseBranding(overrides: Partial<EmailBranding> = {}): EmailBranding {
  return {
    name: "Acme Plumbing",
    logo_url: null,
    brand_primary: "#0A2540",
    ...overrides,
  };
}
```

Tests #1, #2, #9, #10, #11 need rewrites (not just fixture changes). The sidebarColor priority chain was the focus of EMAIL-14 tests. Post-phase, the equivalent tests are `brand_primary → DEFAULT`. Net tests retained: the structurally important ones (#3 logo, #4 null logo, #5 brand_primary fallback, #6 double-null DEFAULT, #7 table structure, #8 HTML encoding). New test: `brand_primary null → #3B82F6 DEFAULT`.

### `tests/email-6-row-matrix.test.ts` — Needs Fixture Updates

This test has a shared `account` fixture that includes `sidebar_color: "#1A3A5C"` and `background_color: "#1A3A5C"`. Multiple tests assert `expect(html).toContain("background-color:#1A3A5C")` — after Phase 19, the header band will use `brand_primary` (`"#0A2540"`) instead. Update fixture to remove `sidebar_color`/`background_color` fields and update color assertions to `#0A2540`.

Also: `assertBrandedEmail` helper (line 65) asserts `expect(html).toContain("Powered by")` — this still passes post-phase (text is kept). No change needed there.

### `tests/reminder-email-content.test.ts` — Minor Fixture Update

The `baseArgs` account fixture (lines 39–48) has NO deprecated fields — it only passes `brand_primary: "#0A2540"`. The `ReminderAccountRecord` interface will lose `background_color?`, `chrome_tint_intensity?`, `sidebar_color?`. Since the test fixture doesn't pass them, `tsc --noEmit` will pass with no changes. **Zero changes required to this test file.**

---

## Recommended Decisions for Claude's Discretion Items

### 1. Hard removal vs. `@deprecated` shim

**Decision: HARD REMOVE.** The call graph is 10 files, all in the same repo. `tsc` catches every missed update. No external npm consumers. Phase 18 used shims because `chrome-tint.ts` + its test would have broken; no analogous external consumer exists for `EmailBranding`. Hard removal is cleaner and the whole point of this phase.

### 2. `emailBrandingFromRow` helper vs. inline construction

**Decision: INLINE.** Each of the 4 callers already constructs an `account` object from a Supabase SELECT. After removing the deprecated fields, the inline construction reduces to 3 fields:
```typescript
account: {
  name: account.name,
  slug: account.slug,        // where applicable
  timezone: account.timezone, // where applicable
  owner_email: account.owner_email,
  logo_url: account.logo_url ?? null,
  brand_primary: account.brand_primary ?? null,
}
```
This is not repeated across "4 callers" — each caller has a different superset of fields (one needs `slug`, one needs reminder toggles, etc.). A generic `emailBrandingFromRow` helper would only extract the 3 branding fields anyway, and callers would still construct the broader `account` object themselves. The helper adds a layer of indirection for no simplification gain. Inline is the right call.

### 3. Keep `renderEmailBrandedHeader` name vs. rename

**Decision: KEEP.** Name is still accurate (header is brand-colored). Rename across 6 sender import sites adds churn for zero clarity gain.

### 4. Email-side `DEFAULT_BRAND_PRIMARY` placement

**Decision: Define locally in `lib/email/branding-blocks.ts` only.** The existing module-level constant is already in that file. Change its value from `"#0A2540"` to `"#3B82F6"`. Do NOT export it from `lib/branding/read-branding.ts` — those are different defaults for different purposes (CONTEXT lock: intentional divergence). Keep the constant name `DEFAULT_BRAND_PRIMARY` — it already exists, renaming it across callers in the same file costs nothing but the value changes.

Actually: `renderBrandedButton` and `brandedHeadingStyle` in `branding-blocks.ts` also reference `DEFAULT_BRAND_PRIMARY`. After the value changes to `#3B82F6`, those functions will also default to blue. This is correct — they should use the same email-layer default.

### 5. Footer design (alignment, separator, font-size)

**Current footer already has:**
- `<hr>` separator with `border-top: 1px solid #eee; margin: 32px 0 16px 0`
- `text-align: center`
- `font-size: 12px; color: #888`

**Recommended post-phase footer:**
- Keep the `<hr>` separator — it's already there and provides visual separation
- Keep `text-align: center` — matches `PoweredByNsi` web component spirit
- Font-size: `12px` — keep current
- Color: Change `#888` to `#9ca3af` (CONTEXT lock: Tailwind `text-gray-400` equivalent)
- Remove `NSI_MARK_URL` constant and the conditional `markHtml` block entirely
- Update `NSI_HOMEPAGE_URL` to `"https://northstarintegrations.com"` (CONTEXT lock)
- Remove `<strong>` wrapper — web component does not bold it; plain anchor text only

**Recommended new `renderEmailFooter` HTML:**
```html
<hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px 0;"/>
<p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
  Powered by <a href="https://northstarintegrations.com" style="color:#9ca3af;text-decoration:underline;" target="_blank">North Star Integrations</a>
</p>
```

Note `target="_blank"` is optional for email clients (many strip it), but harmless. The web `PoweredByNsi` uses it; consistency is fine but not required.

### 6. Test update strategy (email-branded-header.test.ts)

**Decision: Update in place (don't delete).** The tests still have value — they verify the `brand_primary → DEFAULT` resolution, logo/no-logo rendering, HTML structure, encoding. Deleting them would reduce coverage for free. Update fixtures and replace the sidebarColor-specific tests with equivalent brand_primary tests. Net count: retain 8 structurally-valid tests, add 1 new DEFAULT-color assertion test (`brand_primary null → #3B82F6`), drop 3 sidebarColor-specific tests (#1 old winner, #9 precedence, #10 chromeTintIntensity, #11 backgroundColor). Total: ~8-9 tests.

### 7. Atomic vs. wave deployment

**Decision: ATOMIC.** All 10 files change in one PR. The type narrowing of `EmailBranding` immediately breaks any caller that still passes deprecated fields — `tsc` makes this deterministic before merge. No intermediate state to deploy. The Phase 18-style types-first wave was justified there because `chrome-tint.ts` had external consumers; here there are none.

---

## Standard Stack

No new libraries introduced. This phase uses only:

| Tool | Purpose |
|------|---------|
| TypeScript (`tsc --noEmit`) | Pre-flight type gate |
| Vitest | Test validation gate |
| grep / ripgrep | Pre-flight string scan gate |

---

## Don't Hand-Roll

| Problem | Use Instead |
|---------|-------------|
| Email-safe inline styles | Already inline — no CSS-in-JS conversion needed |
| Color fallback chain | Simple `??` null-coalescing — no utility function needed |
| Plain-text alt generation | `stripHtml()` already in `branding-blocks.ts` — keep using it |

---

## Common Pitfalls

### Pitfall 1: Updating `EmailBranding` but missing a `branding` construction site

`send-cancel-emails.ts` has TWO `branding` construction sites (booker cancel + owner cancel). `send-reschedule-emails.ts` also has TWO (booker + owner). Missing one causes a TypeScript error that `tsc --noEmit` catches — but only if you run the check.

**Prevention:** Run `tsc --noEmit` after each file change, not just at the end.

### Pitfall 2: Forgetting `email-6-row-matrix.test.ts` fixture update

That test asserts `background-color:#1A3A5C` (the old `sidebar_color` value from its fixture). After removing `sidebar_color` from `ReminderAccountRecord` and sender `AccountRecord` interfaces, the fixture call to `sendReminderBooker` will fail to compile. The color assertion will also fail because `brand_primary: "#0A2540"` will now win.

**Prevention:** `email-6-row-matrix.test.ts` is in the file modification list for this phase.

### Pitfall 3: `app/api/bookings/route.ts` has TWO Supabase SELECT calls

The route file has TWO places that SELECT from `accounts`:
1. Line 171: direct `.select("..., background_color, chrome_tint_intensity, sidebar_color")` for the main booking flow
2. Lines 396–404: the enriched join SELECT for the immediate reminder path

Both must be updated. Missing the second one does not cause a TypeScript error (the enriched result is typed via supabase-js inference from the select string), but it will leave deprecated columns in the DB query.

**Prevention:** Grep for `background_color` in route.ts specifically and confirm zero hits before calling it done.

### Pitfall 4: The footer URL discrepancy

Current code: `NSI_HOMEPAGE_URL = "https://nsintegrations.com"` (no "north" prefix).
CONTEXT lock: `"https://northstarintegrations.com"`.
These are different domains. Easy to miss since the link renders fine with either URL — it just goes to the wrong place.

**Prevention:** Include URL verification in the smoke-test checklist (click the footer link).

### Pitfall 5: Hardcoded `#0A2540` in `send-owner-notification.ts`

Line 125 has `style="color: #0A2540;"` hardcoded in the booker email link inside owner notification. This is not driven by the `DEFAULT_BRAND_PRIMARY` constant — it will not auto-update when the constant changes. It's a minor style inconsistency but worth fixing in the same pass.

### Pitfall 6: `chromeTintIntensity` in test #10

Test #10 passes `chromeTintIntensity: "none"` to `baseBranding`. After removing the field from the interface, this is a TypeScript error. The test must be deleted or rewritten, not just its assertion changed.

---

## Pre-Flight Checklist

Run before merge:

```bash
# 1. TypeScript clean
npx tsc --noEmit

# 2. Zero deprecated identifiers in email layer and callers
# (run from repo root — should return no matches)
grep -rn "sidebarColor\|backgroundColor\|chromeTintIntensity" \
  lib/email/ \
  app/api/bookings/ \
  app/api/cron/ \
  lib/bookings/cancel.ts \
  lib/bookings/reschedule.ts

# 3. Zero deprecated column names in SELECT strings in caller files
grep -rn "sidebar_color\|background_color\|chrome_tint_intensity" \
  app/api/bookings/route.ts \
  app/api/cron/send-reminders/route.ts \
  lib/bookings/cancel.ts \
  lib/bookings/reschedule.ts

# 4. Vitest passes
npx vitest run

# 5. Verify new default color is correct
grep -n "DEFAULT_BRAND_PRIMARY" lib/email/branding-blocks.ts
# Should show: export const DEFAULT_BRAND_PRIMARY = "#3B82F6"; // NSI blue-500

# 6. Verify old default still intact in read-branding (must NOT change)
grep -n "DEFAULT_BRAND_PRIMARY" lib/branding/read-branding.ts
# Should show: export const DEFAULT_BRAND_PRIMARY = "#0A2540";

# 7. Verify nsi-mark.png image tag gone from branding-blocks
grep -n "nsi-mark" lib/email/branding-blocks.ts
# Should return no matches

# 8. Verify footer URL is northstarintegrations.com
grep -n "nsintegrations\|northstarintegrations" lib/email/branding-blocks.ts
# Should show only northstarintegrations.com
```

---

## File Modification List (Single Atomic Wave)

**Grouped by role:**

**Group A — Core library (start here, changes propagate to compiler errors):**
1. `lib/email/branding-blocks.ts` — collapse `EmailBranding`, simplify color chain, change `DEFAULT_BRAND_PRIMARY` to `#3B82F6`, replace `renderEmailFooter` body

**Group B — 5 sender files (update `AccountRecord`/`ReminderAccountRecord` + `branding` construction):**
2. `lib/email/send-booking-confirmation.ts`
3. `lib/email/send-cancel-emails.ts` (2 branding construction sites)
4. `lib/email/send-reschedule-emails.ts` (2 branding construction sites)
5. `lib/email/send-reminder-booker.ts`
6. `lib/email/send-owner-notification.ts` (+ fix hardcoded `#0A2540` in email link)

`lib/email/send-booking-emails.ts` — NO CHANGES. It only orchestrates; no `AccountRecord`, no `branding` literal.

**Group C — 4 callers (remove deprecated columns from SELECT and object construction):**
7. `app/api/bookings/route.ts` (2 SELECT sites, multiple object construction sites)
8. `app/api/cron/send-reminders/route.ts` (`ScanRow` interface + SELECT + construction)
9. `lib/bookings/cancel.ts` (pre-fetch SELECT + construction)
10. `lib/bookings/reschedule.ts` (pre-fetch SELECT + construction)

**Group D — Tests:**
11. `tests/email-branded-header.test.ts` (update `baseBranding` factory, rewrite/drop 4 tests, add 1 DEFAULT-color test)
12. `tests/email-6-row-matrix.test.ts` (remove deprecated fields from `account` fixture, update color assertions from `#1A3A5C` to `#0A2540`)

**Unchanged files (confirmed not in scope):**
- `tests/reminder-email-content.test.ts` — fixture has no deprecated fields, zero changes
- `lib/email/send-booking-emails.ts` — orchestrator only
- `lib/branding/read-branding.ts` — different default, different purpose, CONTEXT lock
- `lib/branding/types.ts` — web-side, Phase 20 territory
- `lib/branding/chrome-tint.ts` — Phase 20 territory
- `tests/branding-chrome-tint.test.ts` — Phase 20 territory

---

## Plain-Text Alternatives — EMAIL-20 Preservation Map

The following senders have plain-text `text:` fields that must not regress:

| Sender | `text:` field | Location |
|--------|--------------|----------|
| `send-booking-confirmation.ts` | `text: stripHtml(html)` | Line 163 |
| `send-cancel-emails.ts` — booker cancel | `text: stripHtml(html)` | Line 180 |
| `send-reschedule-emails.ts` — booker reschedule | `text: stripHtml(html)` | Line 175 |
| `send-reminder-booker.ts` | `const text = stripHtml(html)` + passed to `sendEmail` | Lines 203, 209 |

Owner-side emails intentionally have no plain-text alt:
- `send-owner-notification.ts` — no `text:` field (by design)
- `send-cancel-emails.ts` — owner cancel `sendEmail` call has no `text:` (by design)
- `send-reschedule-emails.ts` — owner reschedule `sendEmail` call has no `text:` (by design)

`stripHtml` is imported from `branding-blocks.ts` in all callers — not re-implemented. Phase 19 does not touch `stripHtml`. No regression risk here.

---

## Web Component Reference

`app/_components/powered-by-nsi.tsx` (Phase 17, lines 1–22):
- Text: `"Powered by North Star Integrations"` (split across two nodes)
- Link: `href="https://nsintegrations.com"` — note: same old URL as the current footer
- Color: `text-gray-400` class (= `#9ca3af` in Tailwind v3/v4)
- Size: `text-xs` class (= 12px)
- Alignment: `text-center`
- No image, no bold

The CONTEXT decision locks the email footer URL to `https://northstarintegrations.com` — this is different from what the web component currently uses. The email footer is intentionally being set to the correct long-form URL regardless of what the web component has.

---

## State of the Art (What Changes)

| Old Behavior | New Behavior |
|--------------|--------------|
| `EmailBranding` has 6 fields | `EmailBranding` has 3 fields (`name`, `logo_url`, `brand_primary`) |
| Header color: `sidebarColor ?? brand_primary ?? #0A2540` | Header color: `brand_primary ?? #3B82F6` |
| Email-layer default: `#0A2540` (NSI navy) | Email-layer default: `#3B82F6` (NSI blue-500) |
| Footer: conditional `<img>` for `nsi-mark.png` + text | Footer: text-only + link |
| Footer color: `#888` | Footer color: `#9ca3af` |
| Footer URL: `https://nsintegrations.com` | Footer URL: `https://northstarintegrations.com` |
| 4 callers SELECT 3 deprecated columns each | 4 callers SELECT 0 deprecated columns |
| 11 `renderEmailBrandedHeader` tests, many sidebarColor-centric | ~8-9 tests, `brand_primary`-centric |

---

## Sources

All findings are from direct file reads (HIGH confidence):

- `lib/email/branding-blocks.ts` — interface, resolver, footer
- `lib/email/send-booking-confirmation.ts` — sender pattern
- `lib/email/send-booking-emails.ts` — orchestrator (no changes needed)
- `lib/email/send-cancel-emails.ts` — 2 construction sites
- `lib/email/send-reschedule-emails.ts` — 2 construction sites
- `lib/email/send-reminder-booker.ts` — reminder sender
- `lib/email/send-owner-notification.ts` — hardcoded color discovery
- `app/api/bookings/route.ts` — 2 SELECT sites, 3 construction sites
- `app/api/cron/send-reminders/route.ts` — ScanRow + SELECT + construction
- `lib/bookings/cancel.ts` — pre-fetch SELECT + construction
- `lib/bookings/reschedule.ts` — pre-fetch SELECT + construction
- `lib/branding/read-branding.ts` — reference for DEFAULT_BRAND_PRIMARY isolation
- `lib/branding/types.ts` — Phase 20 shim confirmation
- `tests/email-branded-header.test.ts` — 11 tests mapped
- `tests/email-6-row-matrix.test.ts` — fixture mapped, color assertions mapped
- `tests/reminder-email-content.test.ts` — confirmed zero changes needed
- `app/_components/powered-by-nsi.tsx` — web reference for footer spirit
- `public/nsi-mark.png` — confirmed file exists (will no longer be referenced in email)

---

## RESEARCH COMPLETE

**Phase:** 19 — Email Layer Simplification
**Confidence:** HIGH — all files read directly, no speculation

### Key Findings

- `send-booking-emails.ts` requires **zero changes** — it is a pure orchestrator with no `AccountRecord` or `branding` literal
- `send-cancel-emails.ts` and `send-reschedule-emails.ts` each have **two** `branding` construction sites (booker + owner sub-functions) — easy to miss the second
- `app/api/bookings/route.ts` has **two** Supabase SELECT calls that pull deprecated columns — one for the main booking flow, one for the immediate reminder path
- The current footer URL is `"https://nsintegrations.com"` — CONTEXT locks it to `"https://northstarintegrations.com"`, a different domain, must be updated
- `send-owner-notification.ts` has a hardcoded `#0A2540` in the email body link style — not driven by the constant, needs a targeted fix
- `tests/reminder-email-content.test.ts` needs **zero changes** — its fixture already lacks deprecated fields
- `tests/email-6-row-matrix.test.ts` needs fixture + color assertion updates — this file is not called out in CONTEXT.md but was discovered during research

### File Modification Count: 12 files total

Group A (1): `branding-blocks.ts`
Group B (5): 5 senders (not `send-booking-emails.ts`)
Group C (4): 4 callers
Group D (2): `email-branded-header.test.ts`, `email-6-row-matrix.test.ts`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Interface shape | HIGH | File read directly |
| Priority chain logic | HIGH | File read directly |
| All construction sites | HIGH | Every sender read, every caller read |
| SELECT clauses | HIGH | All 4 caller files read |
| Test impact | HIGH | All 3 affected test files read |
| Footer current state | HIGH | File read directly |
| Recommended new footer | HIGH | CONTEXT decisions are locked |

### Open Questions

None that block planning. All files are accounted for.

### Ready for Planning

Research complete. Planner can create a single-wave PLAN.md with file-level task precision.
