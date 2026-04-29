---
phase: 12-branded-ui-overhaul
plan: 06
type: execute
wave: 2
depends_on: ["12-01"]
files_modified:
  - public/nsi-mark.png
  - lib/email/branding-blocks.ts
  - lib/email/send-booking-confirmation.ts
  - lib/email/send-owner-notification.ts
  - lib/email/send-cancel-emails.ts
  - lib/email/send-reschedule-emails.ts
  - lib/email/send-reminder-booker.ts
autonomous: true

must_haves:
  truths:
    - "All 6 transactional emails (booker confirm, owner notify, booker cancel, owner cancel, booker reschedule, owner reschedule) ship a per-account solid-color header band using account.background_color (or brand_primary fallback when null)"
    - "Header treatment is identical across all 6 templates (CONTEXT.md lock: consistency over status semantics)"
    - "Email footer renders the NSI mark image (assets/nsi-mark.png) bottom-center with 'Powered by NSI' wordmark on every email"
    - "Booker confirmation email includes a plain-text alternative (text: stripHtml(html))"
    - "Booker cancel and booker reschedule emails ALSO include plain-text alternatives (extended scope per research recommendation; minimal cost via existing stripHtml helper)"
    - "Header text color auto-contrasts against background_color (uses existing pickTextColor helper)"
    - "EmailBranding type is extended to include backgroundColor; brandingFromAccount loader populates it"
  artifacts:
    - path: "public/nsi-mark.png"
      provides: "16x16 (or 32x32 retina) NSI mark image served at /nsi-mark.png"
    - path: "lib/email/branding-blocks.ts"
      provides: "renderEmailBrandedHeader (NEW) + NSI_MARK_URL flipped to ${APP_URL}/nsi-mark.png + EmailBranding type extended"
      contains: "renderEmailBrandedHeader|NSI_MARK_URL"
    - path: "lib/email/send-booking-confirmation.ts"
      provides: "Sender migrated to renderEmailBrandedHeader + plain-text alt + NSI footer"
      contains: "renderEmailBrandedHeader|stripHtml"
    - path: "lib/email/send-cancel-emails.ts"
      provides: "Both booker + owner cancel senders migrated; booker variant gets plain-text alt"
      contains: "renderEmailBrandedHeader"
    - path: "lib/email/send-reschedule-emails.ts"
      provides: "Both booker + owner reschedule senders migrated; booker variant gets plain-text alt"
      contains: "renderEmailBrandedHeader"
    - path: "lib/email/send-owner-notification.ts"
      provides: "Owner notification sender migrated to renderEmailBrandedHeader"
      contains: "renderEmailBrandedHeader"
    - path: "lib/email/send-reminder-booker.ts"
      provides: "Reminder sender already uses stripHtml plain-text; migrate header to renderEmailBrandedHeader"
      contains: "renderEmailBrandedHeader"
  key_links:
    - from: "lib/email/branding-blocks.ts"
      to: "EmailBranding interface"
      via: "Add backgroundColor: string | null field; brandingFromAccount loader sets it from accounts.background_color"
      pattern: "backgroundColor"
    - from: "All 6 senders"
      to: "lib/email/branding-blocks.ts (renderEmailBrandedHeader)"
      via: "import + invoke with branding.backgroundColor argument"
      pattern: "renderEmailBrandedHeader"
    - from: "lib/email/send-booking-confirmation.ts"
      to: "lib/email/branding-blocks.ts (stripHtml helper)"
      via: "text: stripHtml(html) added to nodemailer sendMail options"
      pattern: "text:.*stripHtml"
---

<objective>
Restyle all 6 transactional emails to ship a **per-account solid-color header bar** (CONTEXT.md lock: identical treatment across all 6 templates; solid-color only — no gradients, no VML fallback). Add the NSI mark image as a footer asset and flip `NSI_MARK_URL` from null to the live URL. Add plain-text alternatives to booker-facing emails (confirmation locked by EMAIL-10; cancel + reschedule extended per research recommendation).

Purpose: Phase success criterion #5 (per-account branded email header + booker confirmation plain-text alt + NSI footer mark + 6-row visual smoke). EMAIL-09, EMAIL-10, EMAIL-11, EMAIL-12 all coverage. Wave 2 plan, runs in parallel with Plan 12-04 (Home tab) and Plan 12-05 (public restyle) — no shared file conflicts.

Output:
- `public/nsi-mark.png` asset (16x16 or 32x32 retina)
- New `renderEmailBrandedHeader(branding)` helper in `branding-blocks.ts`
- `NSI_MARK_URL` flipped from null to live URL
- All 6 senders migrated to the new header + footer wired to nsi-mark
- `stripHtml(html)` plain-text alt added to booker confirmation, booker cancel, booker reschedule, (booker reminder already has it per Phase 8)
- 6-row visual smoke verified (EMAIL-12)
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/12-branded-ui-overhaul/12-CONTEXT.md
@.planning/phases/12-branded-ui-overhaul/12-RESEARCH.md
@.planning/phases/12-branded-ui-overhaul/12-01-SUMMARY.md

# Existing files to extend (preserve all sender logic)
@lib/email/branding-blocks.ts
@lib/email/send-booking-confirmation.ts
@lib/email/send-owner-notification.ts
@lib/email/send-cancel-emails.ts
@lib/email/send-reschedule-emails.ts
@lib/email/send-reminder-booker.ts
@lib/branding/contrast.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: NSI mark asset + renderEmailBrandedHeader helper + EmailBranding type extension</name>
  <files>
    public/nsi-mark.png
    lib/email/branding-blocks.ts
  </files>
  <action>
    **Asset creation:**
    1. Create `public/` directory at the repo root if missing (Next.js convention; not currently present per planning verification).
    2. Place `public/nsi-mark.png` — a 32x32 (or 64x64 for 2x retina) PNG with NSI's wordmark/logomark on transparent background. Andrew should commit this asset; if Andrew hasn't supplied one yet, use a temporary 32x32 placeholder PNG (e.g., a simple colored square with "NSI" text) so the wiring lands and Andrew can swap the asset later.

    Build a placeholder programmatically if needed:
    ```bash
    # Simple placeholder: solid #0A2540 32x32 PNG via node script or imagemagick if available
    # OR commit a hand-made 32x32 PNG with "NSI" text in white on #0A2540 background
    ```

    Document in summary: "Placeholder PNG committed; Andrew to replace with brand asset before Phase 13 QA."

    **lib/email/branding-blocks.ts** — read existing file. Make these changes:

    **Change 1: Flip NSI_MARK_URL from null to live URL.**
    ```ts
    // Before:
    const NSI_MARK_URL: string | null = null;
    // After:
    const NSI_MARK_URL: string | null = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nsi-mark.png`;
    ```

    Defensive: if `NEXT_PUBLIC_APP_URL` is unset (test env), fall back to `null` so existing tests don't break:
    ```ts
    const NSI_MARK_URL: string | null = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/nsi-mark.png`
      : null;
    ```

    **Change 2: Extend `EmailBranding` interface.** Add `backgroundColor: string | null` (mirrors Plan 12-01 Branding type addition). Update `brandingFromAccount` loader (or wherever EmailBranding is constructed from a row) to read `accounts.background_color`.

    **Change 3: New `renderEmailBrandedHeader(branding)` function** (replaces `renderEmailLogoHeader` per research). Pattern from research §Pattern 7:

    ```ts
    import { pickTextColor } from "@/lib/branding/contrast";  // existing helper

    export function renderEmailBrandedHeader(branding: EmailBranding): string {
      // CONTEXT.md lock: solid-color-only, no gradients, no VML.
      const bg = branding.backgroundColor ?? branding.primaryColor ?? "#F8FAFC"; // gray-50 fallback
      const fg = pickTextColor(bg);
      const logoCell = branding.logoUrl
        ? `<img src="${branding.logoUrl}" alt="${escapeHtml(branding.name)}" width="120" style="max-width:120px;height:auto;display:block;border:0;" />`
        : `<span style="color:${fg};font-size:20px;font-weight:600;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">${escapeHtml(branding.name)}</span>`;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg};margin:0;border-collapse:collapse;">
        <tr><td align="center" style="padding:24px 16px;">${logoCell}</td></tr>
      </table>`;
    }
    ```

    **DO NOT delete** the legacy `renderEmailLogoHeader` immediately — keep it exported for one cycle so any test fixtures or v1.0 archive references don't break. Migrate all 6 senders to `renderEmailBrandedHeader` in Tasks 2-3, then a follow-up cleanup can remove the old fn.

    **Change 4: Confirm `escapeHtml` helper exists** (it should — used by existing branding-blocks.ts). If not, add a minimal one.

    **Change 5: `stripHtml` helper.** Phase 8 reminder sender already uses `stripHtml(html)` (per STATE.md). Verify it lives in `lib/email-sender/utils.ts` (per research §Don't Hand-Roll) — confirm import path. If exported from `branding-blocks.ts`, ensure it's accessible from all senders.

    **Change 6: Footer renderer** — add or update `renderEmailFooter()` to include the NSI mark when `NSI_MARK_URL` is set:

    ```ts
    export function renderEmailFooter(): string {
      const markImg = NSI_MARK_URL
        ? `<img src="${NSI_MARK_URL}" alt="NSI" width="16" height="16" style="display:inline-block;vertical-align:middle;border:0;" />`
        : "";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;">
        <tr><td align="center" style="padding:16px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;font-size:12px;color:#6B7280;">
          ${markImg} <span style="vertical-align:middle;margin-left:6px;">Powered by NSI</span>
        </td></tr>
      </table>`;
    }
    ```

    Add Vitest tests for `renderEmailBrandedHeader`:
    - White text on dark background_color
    - Black text on light background_color
    - Logo HTML when logoUrl set; text fallback when null
    - Falls back to primaryColor when backgroundColor is null
    - Final fallback to gray-50 when both null

    Test file: `tests/email-branded-header.test.ts`. Run: `npm test -- email-branded-header`.
  </action>
  <verify>
    1. `public/nsi-mark.png` exists, file size > 0.
    2. `npm test -- email-branded-header` — all cases pass.
    3. `npx tsc --noEmit` clean.
    4. `grep "renderEmailBrandedHeader" lib/email/branding-blocks.ts` returns the export.
    5. `grep "NSI_MARK_URL" lib/email/branding-blocks.ts` confirms flipped to env-var-driven URL.
  </verify>
  <done>
    NSI mark asset committed; `renderEmailBrandedHeader` ships; `NSI_MARK_URL` live; `EmailBranding` extended; 6 senders ready for migration.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate 4 senders (booking-confirmation + owner-notification + reminder-booker + cancel-emails)</name>
  <files>
    lib/email/send-booking-confirmation.ts
    lib/email/send-owner-notification.ts
    lib/email/send-reminder-booker.ts
    lib/email/send-cancel-emails.ts
  </files>
  <action>
    For each sender, the migration pattern is identical:

    **Step 1 — Replace header invocation:**
    Find the line invoking `renderEmailLogoHeader(branding)` (or whatever current header helper is called). Replace with `renderEmailBrandedHeader(branding)`. Keep all other HTML body construction unchanged.

    **Step 2 — Add footer if not present:**
    Most senders likely already include `renderEmailFooter()` (Phase 8 pattern). Confirm by reading. If absent, append to the email body before closing `</body>`.

    **Step 3 — Plain-text alt for booker-facing senders:**
    Add `text: stripHtml(html)` to the nodemailer `sendMail({ ... })` options object. Pattern (already used in `send-reminder-booker.ts:194-217` per research):

    ```ts
    await transporter.sendMail({
      from,
      to: bookerEmail,
      subject,
      html,
      text: stripHtml(html),  // NEW for booker confirmation; already present on reminder; ADD on cancel + reschedule
    });
    ```

    **Per-sender notes:**

    - **send-booking-confirmation.ts** — booker-facing. Migrate header. Add `text: stripHtml(html)`. (EMAIL-10 lock.)
    - **send-owner-notification.ts** — owner-facing. Migrate header. Plain-text alt is owner discretion; SKIP per CONTEXT minimum bar (research recommendation only locked plain-text for booker-facing).
    - **send-reminder-booker.ts** — booker-facing. Migrate header (current header is `renderEmailLogoHeader` per Phase 8). Plain-text alt already present; do not duplicate. Important: this sender is currently the ONE that already uses stripHtml — preserve its pattern, swap only the header.
    - **send-cancel-emails.ts** — this file likely exports BOTH `sendCancelToBooker` and `sendCancelToOwner` (or similar). Read carefully; migrate both header invocations. Add `text: stripHtml(html)` to the BOOKER variant only.

    **Test plan after migration (Vitest):**
    - For senders with existing test mocks, confirm they still pass with the new header signature.
    - If existing tests assert on header HTML markup, update assertions to match new `<table bgcolor=...>` structure.
    - Run: `npm test -- email send-booking send-cancel send-reminder send-owner` — all pass.

    **Smoke check via real send (one-off):**
    - Use Andrew's NSI account in dev. Set `accounts.background_color='#0A2540', background_shade='subtle'` for NSI temporarily.
    - Trigger a fresh booking from `/nsi/30min` to a test email Andrew owns.
    - Inspect inbox: confirmation email should have a navy header band, NSI logo (or "NSI" text), email body, then footer with NSI mark + "Powered by NSI".
    - Reset NSI to `null, 'subtle'` after smoke.
  </action>
  <verify>
    1. `npm test -- email` — all email tests pass.
    2. `npx tsc --noEmit` clean.
    3. Live smoke (manual but trivially fast in dev): send 1 booking → 1 confirmation + 1 owner notification arrive with new headers + footers.
    4. Inbox inspection (Gmail web): header band renders solid color; logo or fallback text visible; footer NSI mark visible bottom-center.
    5. Cancel a booking → cancel emails arrive (booker + owner) with same header/footer treatment.
    6. Trigger a reminder send-now (via Plan 12-04 Day Detail drawer "Send reminder" action OR via existing manual-trigger if available) → reminder email shows new header.
    7. View source on confirmation email in Gmail → confirm `text/plain` alt body is present alongside `text/html`.
  </verify>
  <done>
    4 senders migrated; booker confirmation has plain-text alt; reminder + owner notify have new header; cancel-booker has plain-text alt + new header; cancel-owner has new header.
  </done>
</task>

<task type="auto">
  <name>Task 3: Migrate reschedule senders + 6-row visual smoke</name>
  <files>
    lib/email/send-reschedule-emails.ts
  </files>
  <action>
    **send-reschedule-emails.ts** — same pattern as `send-cancel-emails.ts`. Likely exports `sendRescheduleToBooker` + `sendRescheduleToOwner`. Migrate both header invocations. Add `text: stripHtml(html)` to the booker variant.

    **6-row visual smoke matrix (EMAIL-12 — Phase 12 success criterion #5):**

    Run a manual send-and-inspect for all 6 templates against a test account with `background_color='#0A2540'` (or any non-default value) so the header band is visibly branded:

    | # | Template | Trigger | Expect |
    |---|----------|---------|--------|
    | 1 | booker_confirmation | Submit a booking on `/nsi/30min` | Navy header + plain-text alt |
    | 2 | owner_notification | (same booking) | Navy header (no plain-text alt — owner discretion) |
    | 3 | booker_cancel | Cancel from `/cancel/{token}` (booker flow) OR via Day Detail drawer | Navy header + plain-text alt |
    | 4 | owner_cancel | (same cancel) | Navy header |
    | 5 | booker_reschedule | Reschedule from `/reschedule/{token}` | Navy header + plain-text alt |
    | 6 | owner_reschedule | (same reschedule) | Navy header |

    **Smoke checklist for each row:**
    - [ ] Header band is solid color (not blank — Outlook desktop common failure mode)
    - [ ] Logo or fallback text visible on header
    - [ ] Email body content unchanged from prior version (regression check)
    - [ ] Footer renders NSI mark + "Powered by NSI" text
    - [ ] (Booker variants only) plain-text alt visible via Gmail → Show original → confirm `Content-Type: text/plain` part present

    **Document any deviations** in 12-06-SUMMARY.md (e.g., if Outlook desktop rendering needs revisit — defer to Phase 13 QA).

    Reset test account branding (`background_color=null`) after smoke completes.

    **Add Vitest test for the 6-row matrix where feasible** (snapshot-style):
    - For each of the 6 senders, render the email HTML in a test, assert the rendered HTML contains:
      - `<table` with `bgcolor=` attribute (header band exists)
      - The branding's `name` or logo URL
      - "Powered by NSI" text in footer
    - Test file: `tests/email-6-row-matrix.test.ts`. Run: `npm test -- email-6-row`.

    These automated tests give EMAIL-12 closure at code-level; live inbox inspection covers any client-rendering gaps and is logged in summary for Phase 13 QA cross-reference.
  </action>
  <verify>
    1. `npm test -- email` — all email tests pass (including 6-row matrix).
    2. `npx tsc --noEmit` clean.
    3. Live smoke: trigger reschedule flow on a test booking → both reschedule emails arrive with new header/footer.
    4. View-source on booker_reschedule → plain-text alt present.
    5. Visual matrix table populated in summary with checkmarks for all 6 rows (Gmail web pass minimum).
    6. No regressions in existing 148+ Vitest baseline.
  </verify>
  <done>
    All 6 senders migrated; 6-row visual smoke complete (Gmail web pass at minimum); EMAIL-09, EMAIL-10, EMAIL-11, EMAIL-12 all closed at code level (live cross-client testing deferred to Phase 13 QA per existing project pattern).
  </done>
</task>

</tasks>

<verification>
**Plan-level checks:**
- `public/nsi-mark.png` committed.
- `NSI_MARK_URL` flipped to live URL.
- `renderEmailBrandedHeader(branding)` is the canonical header function; all 6 senders invoke it.
- 4 booker-facing senders (confirmation, cancel-booker, reschedule-booker, reminder-booker) include `text: stripHtml(html)`.
- All 6 emails ship NSI mark in footer.
- 6-row matrix verified via live smoke + Vitest fixtures.
- Vitest baseline (148+) preserved.
- `npx tsc --noEmit` clean.

**Requirements satisfied:**
- EMAIL-09 (per-account branded header — solid-color, identical across all 6)
- EMAIL-10 (booker confirmation plain-text alt — extended to booker cancel + reschedule)
- EMAIL-11 (NSI mark in footer)
- EMAIL-12 (6-row visual smoke verified)

**Phase success criteria contribution:**
- Criterion #5 — fully satisfied
</verification>

<success_criteria>
1. NSI mark PNG asset live at `/nsi-mark.png`.
2. `EmailBranding` type extended with `backgroundColor`.
3. `renderEmailBrandedHeader` ships; uses pickTextColor for auto-contrast; solid-color-only per CONTEXT lock.
4. All 6 senders migrated.
5. Plain-text alts present on booker_confirmation, booker_cancel, booker_reschedule (reminder already has it).
6. NSI footer renders on all 6 templates.
7. Vitest 6-row matrix passes (HTML snapshot fragments).
8. Live smoke: 6 inbox inspections all pass Gmail-web rendering.
9. No regressions in Vitest baseline; `npx tsc --noEmit` clean.

Live cross-client testing (Outlook desktop, Apple Mail iOS, Yahoo) is **deferred to Phase 13 QA per existing project pattern** and the v1.2-deferred EMAIL-08/QA-01..06 backlog. Document this scope cut in summary.
</success_criteria>

<output>
After completion, create `.planning/phases/12-branded-ui-overhaul/12-06-SUMMARY.md` documenting:
- Files: list above
- Tech-stack additions: none (no new packages — extends existing nodemailer + branding-blocks pattern)
- Decisions: solid-color-only per CONTEXT lock (no VML fallback)
- Decisions: plain-text alt extended beyond EMAIL-10 minimum to booker cancel + reschedule (research recommendation; minimal cost)
- Decisions: owner-facing emails skip plain-text alt (CONTEXT discretion; can extend in v1.2 if needed)
- Decisions: NSI mark = simple PNG, no VML fallback (CONTEXT lock; if Outlook desktop renders weirdly during Phase 13, defer to v1.2)
- Decisions: NSI_MARK_URL falls back to null in test env so existing 26 skipped tests don't fail
- Live smoke matrix: 6-row table populated with Gmail-web checkmarks
- Phase 13 QA cross-reference: live cross-client (Outlook desktop, Apple Mail iOS, Yahoo) deferred to v1.2 per existing pattern
- For Phase 13: matrix to verify with 3 different test accounts × 6 templates = 18-row smoke (QA-12 prerequisite)
</output>
