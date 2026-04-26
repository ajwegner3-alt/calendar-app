---
phase: 07-widget-and-branding
plan: 07
type: execute
wave: 3
depends_on: ["07-01"]
files_modified:
  - lib/email/branding-blocks.ts
  - lib/email/send-booking-confirmation.ts
  - lib/email/send-owner-notification.ts
  - lib/email/send-cancel-emails.ts
  - lib/email/send-reschedule-emails.ts
  - lib/bookings/cancel.ts
  - lib/bookings/reschedule.ts
  - app/api/bookings/route.ts
autonomous: false

must_haves:
  truths:
    - "Booker confirmation email renders the account's logo (if set) at the top, centered, max ~120px wide"
    - "Booker confirmation email's H1 + Reschedule/Cancel links use the account's brand_primary color"
    - "Booker cancel email renders logo + brand-colored 'Book again' CTA"
    - "Booker reschedule email renders logo + brand-colored heading + cancel/reschedule links"
    - "Owner notification email renders the same logo + brand color (consistent with public surfaces)"
    - "All emails include a 'Powered by NSI' text-link footer (CONTEXT lock — not white-label in v1). Logo mark is conditional on NSI_MARK_URL being set; v1 ships text-only."
    - "When account.logo_url is null OR brand_primary is null, emails gracefully fall back (no logo header; default NSI navy color); no broken images, no validator errors"
    - "All sender callers pass account.logo_url + brand_primary through (no hard-coded null)"
  artifacts:
    - path: "lib/email/branding-blocks.ts"
      provides: "renderEmailLogoHeader(account) + renderEmailFooter(account) + renderBrandedButton(href, label, primaryColor) — pure functions returning HTML strings"
      exports: ["renderEmailLogoHeader", "renderEmailFooter", "renderBrandedButton", "DEFAULT_BRAND_PRIMARY"]
    - path: "lib/email/send-booking-confirmation.ts"
      provides: "Updated AccountRecord type + email HTML uses branding blocks"
      contains: "logo_url"
    - path: "lib/email/send-owner-notification.ts"
      provides: "Same — branding blocks applied"
      contains: "logo_url"
    - path: "lib/email/send-cancel-emails.ts"
      provides: "Same for both booker + owner cancel emails"
      contains: "logo_url"
    - path: "lib/email/send-reschedule-emails.ts"
      provides: "Same for both booker + owner reschedule emails"
      contains: "logo_url"
  key_links:
    - from: "lib/email/send-booking-confirmation.ts"
      to: "lib/email/branding-blocks.ts"
      via: "import { renderEmailLogoHeader, renderBrandedButton, renderEmailFooter }"
      pattern: "branding-blocks"
    - from: "AccountRecord (each sender)"
      to: "account.logo_url + account.brand_primary"
      via: "added to interface + populated by callers"
      pattern: "logo_url.*brand_primary"
    - from: "callers (api/bookings/route.ts + lib/bookings/cancel.ts + reschedule.ts)"
      to: "account branding fields"
      via: "DB SELECT widened to include logo_url + brand_primary"
      pattern: "logo_url"
---

<objective>
Apply per-account branding to all transactional emails: confirmation, cancel (booker + owner), reschedule (booker + owner), and owner-notification. Each email gets a top-centered logo header (when set), brand-colored H1 + CTA buttons (with auto-picked text color), and a "Powered by NSI" footer with small NSI logo (CONTEXT lock — v1 is not white-label).

Purpose: Delivers BRAND-04 (emails sent for an account render with that account's branding). Centralizes the email branding HTML in `lib/email/branding-blocks.ts` so every sender uses identical inline-styled markup that survives Gmail/Outlook/Apple Mail rendering.

Output: New `branding-blocks.ts` shared module, type extensions to `AccountRecord` in each sender, HTML updates in 4 sender files (5 functions counting both booker + owner branches in cancel/reschedule), and caller updates in `app/api/bookings/route.ts` + `lib/bookings/cancel.ts` + `lib/bookings/reschedule.ts` to widen their DB SELECTs and pass branding through.
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
@.planning/phases/07-widget-and-branding/07-01-SUMMARY.md

# Email senders to modify
@lib/email/send-booking-confirmation.ts
@lib/email/send-owner-notification.ts
@lib/email/send-cancel-emails.ts
@lib/email/send-reschedule-emails.ts

# Callers (need to widen SELECT and pass branding through)
@app/api/bookings/route.ts
@lib/bookings/cancel.ts
@lib/bookings/reschedule.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create lib/email/branding-blocks.ts (shared email HTML helpers)</name>
  <files>
    lib/email/branding-blocks.ts
  </files>
  <action>
    Create the shared module with three pure functions returning HTML strings.

    ```typescript
    import "server-only";
    import { pickTextColor } from "@/lib/branding/contrast";

    export const DEFAULT_BRAND_PRIMARY = "#0A2540"; // NSI navy

    /** Branding subset most senders need; lets callers pass either the full account or a slim subset. */
    export interface EmailBranding {
      name: string;
      logo_url: string | null;
      brand_primary: string | null;
    }

    /**
     * Top-centered logo header for transactional emails.
     * Returns "" when logo_url is null (no empty space, no broken-img placeholder).
     *
     * Inline-styled to survive Gmail/Outlook/Apple Mail (caniemail.com lock).
     */
    export function renderEmailLogoHeader(branding: EmailBranding): string {
      if (!branding.logo_url) return "";
      // Use escapeHtml on alt text only — URL is from our DB and already URL-shaped
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
        <tr>
          <td align="center" style="padding: 16px 0;">
            <img src="${branding.logo_url}" alt="${escapeHtml(branding.name)} logo" width="120" style="max-width:120px;height:auto;display:block;border:0;" />
          </td>
        </tr>
      </table>`;
    }

    /**
     * "Powered by NSI" footer.
     * CONTEXT lock: not white-label in v1; always present as a text link.
     *
     * v1 SHIPS TEXT-ONLY. The image mark is rendered ONLY when NSI_MARK_URL is set
     * (non-null). Default is null because /public/nsi-mark.png does not exist yet
     * and a 404'd <img> in transactional email is a guaranteed broken-image
     * artifact in every email client. Text-only is the safe v1 surface.
     *
     * TODO(future): when nsi-mark.png is added to /public/, set
     *   NSI_MARK_URL = `${appUrl}/nsi-mark.png`
     * to render the inline mark. Remove the null guard once the asset is committed.
     */
    const NSI_MARK_URL: string | null = null;
    const NSI_HOMEPAGE_URL = "https://nsi.dev";

    export function renderEmailFooter(): string {
      const markHtml = NSI_MARK_URL
        ? `<img src="${NSI_MARK_URL}" alt="NSI" width="14" height="14" style="display:inline-block;vertical-align:middle;margin:0 2px;border:0;" /> `
        : "";
      return `<hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px 0;"/>
        <p style="margin: 0; font-size: 12px; color: #888; text-align: center;">
          Powered by ${markHtml}<a href="${NSI_HOMEPAGE_URL}" style="color:#888;text-decoration:underline;"><strong>North Star Integrations</strong></a>
        </p>`;
    }

    /**
     * Branded inline-styled CTA button.
     *
     * The button uses an <a> styled as a button (Outlook does not render <button> in HTML emails).
     * Background = primary color; text color auto-picked via WCAG luminance.
     */
    export function renderBrandedButton(opts: {
      href: string;
      label: string;
      primaryColor: string | null;
    }): string {
      const bg = opts.primaryColor ?? DEFAULT_BRAND_PRIMARY;
      const fg = pickTextColor(bg);
      return `<a href="${opts.href}" style="display:inline-block;background-color:${bg};color:${fg};padding:12px 24px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;">${escapeHtml(opts.label)}</a>`;
    }

    /**
     * Returns inline-style for H1/H2 to use brand color (CONTEXT decision: headings AND CTAs both get brand color).
     */
    export function brandedHeadingStyle(primaryColor: string | null): string {
      const color = primaryColor ?? DEFAULT_BRAND_PRIMARY;
      return `color:${color};font-size:22px;font-weight:600;margin:0 0 16px 0;`;
    }

    /** Standard escape — duplicated from senders so this module is self-contained. */
    function escapeHtml(s: string): string {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
    ```

    DO NOT create `public/nsi-mark.png` in this plan. v1 ships TEXT-ONLY (NSI_MARK_URL = null). Fix rationale: a 404'd `<img>` tag in a transactional email is a guaranteed broken-image artifact in Gmail/Outlook/Apple Mail. By rendering text-only when NSI_MARK_URL is null, we ship a clean v1 footer and leave a documented TODO comment for the future.

    KEY DECISIONS:
    - All HTML returned is INLINE-STYLED (Gmail/Outlook compatibility — STATE.md Phase 5 lock continues here).
    - `escapeHtml` is duplicated within branding-blocks.ts (kept self-contained; no cross-module helper churn).
    - Logo URL is taken from DB as-is (Plan 07-04 already includes `?v=` cache-bust); senders DO NOT modify it.
    - DEFAULT_BRAND_PRIMARY is duplicated from `lib/branding/read-branding.ts` to keep this module's deps tight (no circular).
  </action>
  <verify>
    File exists. `npx tsc --noEmit` passes.
    `grep -n 'pickTextColor' lib/email/branding-blocks.ts` confirms import.
    Test rendering inline:
    ```
    npx tsx -e "import('./lib/email/branding-blocks.ts').then(m => console.log(m.renderBrandedButton({href:'https://x.com',label:'Click',primaryColor:'#0A2540'})))"
    ```
    (Or skip if tsx not available; type-check is sufficient gate.)
  </verify>
  <done>
    branding-blocks.ts exports 4 functions + DEFAULT_BRAND_PRIMARY; uses pickTextColor; HTML is inline-styled; self-contained escapeHtml.
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply branding blocks to all 4 email sender files (5 functions)</name>
  <files>
    lib/email/send-booking-confirmation.ts
    lib/email/send-owner-notification.ts
    lib/email/send-cancel-emails.ts
    lib/email/send-reschedule-emails.ts
  </files>
  <action>
    For EACH file, perform the following substitutions:

    **A. Update the AccountRecord interface**: add `logo_url: string | null;` and `brand_primary: string | null;`. Keep the existing fields exactly.

    **B. Import branding blocks at the top**:
    ```typescript
    import { renderEmailLogoHeader, renderEmailFooter, renderBrandedButton, brandedHeadingStyle } from "./branding-blocks";
    ```

    **C. Replace the H1 string** with brand-colored heading:
    Currently:
    ```
    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">You're booked.</h1>
    ```
    Replace with:
    ```
    <h1 style="${brandedHeadingStyle(account.brand_primary)}">You're booked.</h1>
    ```
    (Use the same brand color for `<h1>` in every email.)

    **D. Insert logo header at the top of HTML body** (just inside the outer `<div>`, before the `<h1>`):
    ```typescript
    ${renderEmailLogoHeader({ name: account.name, logo_url: account.logo_url, brand_primary: account.brand_primary })}
    ```

    **E. Replace anchor links for CTAs**:
    The current pattern in send-booking-confirmation.ts:
    ```
    <a href="${rescheduleUrl}" style="color: #0A2540;">Reschedule</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="${cancelUrl}" style="color: #0A2540;">Cancel</a>
    ```
    Replace with branded buttons stacked or inline. CONTEXT decision: CTAs use primary color. Use renderBrandedButton:
    ```
    <p style="margin: 0 0 8px 0;">Need to make a change?</p>
    <p style="margin: 0;">
      ${renderBrandedButton({ href: rescheduleUrl, label: "Reschedule", primaryColor: account.brand_primary })}
      &nbsp;
      ${renderBrandedButton({ href: cancelUrl, label: "Cancel", primaryColor: account.brand_primary })}
    </p>
    ```

    For send-cancel-emails.ts (booker branch): the "Book again" link becomes a `renderBrandedButton`.
    For send-reschedule-emails.ts (booker branch): the cancel/reschedule links become `renderBrandedButton`.
    For send-owner-notification.ts: no major CTAs to recolor (it's a notification, not action). Just apply logo header + brand H1 color.
    For send-cancel-emails.ts (owner branch): same — logo + H1 color, no major CTA buttons.

    **F. Replace the existing footer line** with `renderEmailFooter()`:
    Current pattern:
    ```
    <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 16px 0;"/>
    <p style="margin: 0; font-size: 12px; color: #888;">
      ${escapeHtml(account.name)}${account.owner_email ? ...}
    </p>
    ```
    Replace with: keep the account-name line for context, then APPEND the NSI footer block:
    ```
    <p style="margin: 0; font-size: 12px; color: #888;">
      ${escapeHtml(account.name)}${account.owner_email ? " &nbsp;·&nbsp; " + escapeHtml(account.owner_email) : ""}
    </p>
    ${renderEmailFooter()}
    ```
    The account name line + the "Powered by NSI" line both render. Two lines is OK — owner identity stays visible.

    DO NOT change the .ics generation logic, the subject lines, the recipient lists, or any other behavior. ONLY HTML body modifications + interface widening.

    DO NOT remove the inline `escapeHtml` helper — keep it for the rest of the body that still uses it.
  </action>
  <verify>
    `npx tsc --noEmit` passes.
    `grep -nE 'logo_url|renderEmailLogoHeader' lib/email/*.ts` shows the additions in all 4 files.
    Eyeball each HTML body — top of body should now read: `${logo header HTML}\n  <h1 style="${brandedHeadingStyle...}">...</h1>`.
  </verify>
  <done>
    All 4 sender files updated with branding; AccountRecord widened; HTML uses branding blocks; tests will be updated/verified in Task 4 (manual QA + integration test re-run).
  </done>
</task>

<task type="auto">
  <name>Task 3: Update callers to SELECT branding columns and pass them through</name>
  <files>
    app/api/bookings/route.ts
    lib/bookings/cancel.ts
    lib/bookings/reschedule.ts
  </files>
  <action>
    For EACH caller, find the place where `accounts` columns are SELECTed (or where `account` props are constructed) and add `logo_url, brand_primary`.

    **A. app/api/bookings/route.ts**:
    - Find the SELECT for the account (likely after fetching event_type).
    - Add `logo_url, brand_primary` to the column list.
    - When constructing the args for `sendBookingEmails(...)` or `sendBookingConfirmation(...)`, ensure `account.logo_url` and `account.brand_primary` are passed through to the AccountRecord shape.

    **B. lib/bookings/cancel.ts**:
    - Find the pre-fetch snapshot (Plan 06-03 lock: pre-fetch booking + event_types!inner + accounts!inner BEFORE the CAS UPDATE).
    - Add `logo_url, brand_primary` to the accounts!inner select.
    - When passing to `sendCancelEmails(args)`, include both fields in the account object.

    **C. lib/bookings/reschedule.ts**:
    - Same pattern. Pre-fetch snapshot widened. `sendRescheduleEmails(args)` gets both fields.

    SPECIFIC PATTERN for the join (Phase 6 lock):
    ```typescript
    .select(`
      id, status, ...,
      event_types!inner(id, slug, name, ...),
      accounts!inner(id, name, slug, timezone, owner_email, logo_url, brand_primary)
    `)
    ```

    DO NOT change the rate-limit logic, the CAS UPDATE, the token rotation, the email firing logic, or any other behavior. ONLY widen the SELECT and pass branding through.
  </action>
  <verify>
    `npx tsc --noEmit` passes — strictly checks that AccountRecord widening (Task 2) is satisfied by callers (Task 3). Mismatch will surface here.
    `npm test` — all Phase 5 + Phase 6 integration tests still green. The integration tests assert email sender mocks were called with specific args — adding fields to the args object should not break existing assertions (additive). If a test asserts strict shape equality (`expect(arg).toEqual(...)`), the test will fail and need to be updated to include the new fields. Update only those tests; do not loosen assertions.
  </verify>
  <done>
    All three callers SELECT branding columns; sendBookingConfirmation/sendOwnerNotification/sendCancelEmails/sendRescheduleEmails all receive non-undefined logo_url + brand_primary fields (may be null); existing tests pass or are updated additively.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Andrew verifies branded emails arrive correctly across booker/owner + create/cancel/reschedule</name>
  <what-built>
    All 6 email types (booker confirmation + .ics, owner notification, booker cancel + .ics, owner cancel + .ics, booker reschedule + .ics, owner reschedule + .ics) now render the account's logo + brand color in:
    - Top-centered logo header
    - Brand-colored H1
    - Brand-colored CTA buttons (where applicable — confirmation, cancel-booker, reschedule-booker)
    - "Powered by NSI" text-link footer (text-only in v1; no broken image, no missing asset)
  </what-built>
  <how-to-verify>
    Pre-req: branding editor (Plan 07-04) has saved a logo + custom color (e.g., magenta) on the nsi account.

    1. Visit /nsi/<active-event-slug> and create a booking with your real email (ajwegner3@gmail.com).
    2. Check Andrew's inbox:
       - **Booker confirmation email** with .ics:
         - Logo at top, centered
         - "You're booked." in your magenta color
         - Reschedule + Cancel buttons with magenta background
         - "Powered by NSI" text-link footer at the bottom (no broken image; "North Star Integrations" links to https://nsi.dev)
         - .ics still attaches and Gmail shows the inline calendar card
       - **Owner notification email**:
         - Logo at top
         - H1 in magenta
         - Booking details rendered correctly
         - "Powered by NSI" text-link footer (no broken image)
    3. Click the cancel link in the booker confirmation. Submit cancel.
    4. Check inbox again:
       - **Booker cancel email**:
         - Logo + magenta H1
         - "Book again" button is magenta
         - cancelled.ics attaches
       - **Owner cancel email**:
         - Logo + magenta H1
         - cancelled.ics attaches
    5. Create another booking. From the confirmation email, click reschedule. Pick a new time.
    6. Check inbox:
       - **Booker reschedule email**:
         - Logo + magenta H1
         - Cancel + Reschedule buttons (with the NEW rotated tokens) magenta
         - invite.ics with SEQUENCE:1 (METHOD:REQUEST)
       - **Owner reschedule email**:
         - Logo + magenta H1
         - invite.ics SEQUENCE:1
    7. Sanity fallback: clear nsi.brand_primary in Supabase Table Editor; create another booking; verify email falls back to NSI navy with no errors.
    8. Sanity logo-null: clear nsi.logo_url; verify email renders with no logo header (no broken image, no empty space).
  </how-to-verify>
  <resume-signal>
    Reply "branded emails approved" to wrap Plan 07-07. If any of the 6 email types is broken (missing logo, wrong color, validator error, .ics broken), describe and we'll fix.
  </resume-signal>
</task>

</tasks>

<verification>
- `npm run build` succeeds.
- `npm test` — all 66+ existing tests pass; if integration test mocks asserted exact account-record shape, those tests are updated additively to include logo_url + brand_primary.
- Manual: 6 email types render correctly with branding; fallbacks work; .ics still functional.
</verification>

<success_criteria>
1. BRAND-04: All 6 transactional emails render account logo + brand color.
2. CONTEXT lock honored: heading + CTA both use primary; "Powered by NSI" text-link footer present (text-only in v1; logo mark gated on NSI_MARK_URL).
3. Fallbacks work (null logo → no header; null brand_primary → NSI navy).
4. .ics attachments unchanged (Phase 5/6 functionality preserved).
5. Inline-styled HTML survives Gmail/Outlook/Apple Mail (lock from Phase 5 STATE).
</success_criteria>

<output>
After completion, create `.planning/phases/07-widget-and-branding/07-07-SUMMARY.md` documenting:
- branding-blocks.ts contract (4 functions + DEFAULT_BRAND_PRIMARY)
- Per-sender changes (HTML diffs, AccountRecord widening)
- Caller widening (route handler + cancel/reschedule libs)
- Footer "Powered by NSI" + nsi-mark.png hosting decision (placeholder vs real asset)
- Smoke test outcome from Andrew
- Integration test updates (which tests needed shape updates)
- Forward contract: any future email sender (e.g., Phase 8 reminders) MUST import branding-blocks and follow the same pattern
</output>
