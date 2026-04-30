---
phase: 13-manual-qa-and-andrew-ship-sign-off
plan: "13-02"
type: execute
wave: 2
depends_on: ["13-01"]
files_modified:
  - .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
autonomous: false

must_haves:
  truths:
    - "QA-09 verified: a brand-new test user completes signup → email-verify (real Supabase confirmation email click) → 3-step onboarding wizard → first booking received E2E with no errors; both confirmation + owner-notification emails arrive in inbox"
    - "QA-10 verified: logged in as Test User 2 (nsi-rls-test); ZERO of Andrew's NSI account data appears on any of the 7 dashboard surfaces (Home calendar, Event Types, Availability, Bookings, Branding, Settings → Profile, Settings → Reminders); logout clears session"
    - "QA-11 verified: capacity=3 event type accepts exactly 3 bookings from 3 different sessions (CAP-08 'X spots left' badge renders between bookings #2 and #3); 4th attempt is rejected — slot disappears from picker (CAP-04 exclusion) AND if a tight race triggers SLOT_CAPACITY_REACHED, the banner copy reads 'That time is fully booked. Please choose a different time.' (Plan 11-08 CAP-07 branching)"
    - "QA-12 verified: 3 branded test accounts (Account A nsi navy / Account B nsi-rls-test magenta / Account C nsi-rls-test-3 emerald-only) render correctly on 4 surfaces × 3 accounts (12 surface checks) + 3 confirmation email header bands. Email header band priority chain works: A and B show sidebar_color; C (sidebar_color=null) falls back to brand_primary (emerald)"
    - "QA-13 verified: EmbedCodeDialog (sm:max-w-2xl, Plan 12-05 lock) opens cleanly at 320 / 768 / 1024 px viewports; no horizontal page overflow; copy/close buttons remain reachable (>= 44px tap targets); textarea snippet wraps OR scrolls within dialog without overflowing"
    - "Every PASS / FAIL / DEFERRED outcome for QA-09..QA-13 + the QA-12 sub-table (12 surface cells + 3 email cells) is logged in 13-CHECKLIST.md with timestamp + Andrew's verbatim notes"
    - "Any FAIL discovered mid-marathon is either fixed-and-redeployed-and-retested (quick-patch loop) OR explicitly DEFERRED-with-reason by Andrew; no silently-skipped FAILs"
    - "Test artifacts created during marathon (throwaway signup user, capacity-test bookings, brandtest bookings) are captured in 13-CHECKLIST.md Test Artifacts Created section for Plan 13-03 cleanup propagation"
    - "Re-deferred items (EMAIL-08, QA-01..QA-06) are NOT exercised — even opportunistically — and are NOT marked PASS in checklist (per ROADMAP scope-NOT-in-Phase-13 lock)"
  artifacts:
    - path: ".planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md"
      provides: "Filled-in marathon checklist with PASS/FAIL/DEFERRED + timestamps + notes for QA-09..QA-13 + QA-12 sub-table + deferred-check-replay outcomes"
      contains: "PASS"
  key_links:
    - from: "Throwaway signup user (QA-09)"
      to: "/auth/confirm?token_hash=...&type=signup&next=/onboarding"
      via: "Real Supabase confirmation email click — exercises Plan 10-02 route handler under live email-confirm-toggle-ON conditions enabled in Plan 13-01 Task 3"
      pattern: "auth/confirm"
    - from: "Test User 2 logged-in session"
      to: "Multi-tenant UI surfaces (RLS-scoped data isolation in /app/* routes)"
      via: "RLS policies on accounts/event_types/bookings/availability_rules/branding (verified at code level by tests/rls-cross-tenant-matrix.test.ts; QA-10 is the UX-layer confirmation)"
      pattern: "auth.uid() = owner_user_id"
    - from: "3 concurrent QA-11 booking attempts at same slot"
      to: "bookings table partial unique index bookings_capacity_slot_idx"
      via: "POST /api/bookings retry loop on 23505 (slot_index 1..N); CAP-07 branching on SLOT_TAKEN vs SLOT_CAPACITY_REACHED"
      pattern: "ON CONFLICT|23505|slot_index"
    - from: "accounts.sidebar_color (set per-account in Plan 13-01 Task 5)"
      to: "Email header band rendered in real Gmail inbox"
      via: "renderEmailBrandedHeader → branding.sidebarColor ?? branding.brand_primary ?? DEFAULT_BRAND_PRIMARY (EMAIL-14 priority chain locked Plan 12.6-03)"
      pattern: "sidebarColor"
    - from: "EmbedCodeDialog component (sm:max-w-2xl)"
      to: "Chrome DevTools viewport widths 320/768/1024"
      via: "Tailwind responsive breakpoints + dialog max-width constraint"
      pattern: "sm:max-w-2xl"
---

<objective>
Execute the marathon QA verification of all 5 walkthrough requirements (QA-09..QA-13) for Phase 13. This is a human-driven session: Claude proposes the next QA item with the verbatim walkthrough script from RESEARCH.md, Andrew executes the steps and reports PASS / FAIL / DEFERRED with notes, Claude updates 13-CHECKLIST.md with the outcome. Failures trigger fix-as-you-go (quick patch → ship → re-verify → continue) with Andrew's call on deferrals.

Purpose: Prove the v1.1 build works end-to-end on production with real production data, real test users, real email arrival, and real branded chrome rendering — before Andrew gives explicit "ship v1.1" sign-off in Plan 13-03. This is the gate between "code complete + Phase 12.6 deploy approved 2026-04-29" and "shippable v1.1."

Output: A fully populated 13-CHECKLIST.md with PASS / FAIL / DEFERRED per QA criterion + per-cell QA-12 sub-table + deferred-check-replay outcomes + test artifacts captured. Any inline-fixed bugs committed + deployed during the session. Foundation set for Plan 13-03 (FUTURE_DIRECTIONS.md authoring + sign-off).

**Task-count note:** This plan has 6 tasks (mirrors Phase 9 Plan 09-02 which had 10 tasks at criterion-grain). Tasks 1-5 are blocking human-verify checkpoints (one per QA criterion); Task 6 is autonomous (final checklist update). Plan is `autonomous: false` because the entire flow is human-driven.

**Sequencing rationale (per RESEARCH.md):**
- QA-09 first — exercises auth + email-confirm flow that 13-01 just enabled (lockout-risk verification)
- QA-10 second — uses Test User 2 already created in 13-01; verifies multi-tenant UI isolation BEFORE per-account branding work
- QA-12 third — branded UI smoke across 3 accounts × 4 surfaces (uses 3 branding profiles set up in 13-01 Task 5)
- QA-13 fourth — purely viewport-based; no email/fresh-user dependency
- QA-11 fifth (last) — capacity E2E needs 3 sessions; doing it last lets Andrew reuse browser windows from prior tasks AND recover gracefully if cap test produces orphan rows
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md
@.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-RESEARCH.md
@.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
@.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-01-SUMMARY.md
@.planning/phases/09-manual-qa-and-verification/09-02-marathon-qa-execution-PLAN.md
</context>

<execution_pattern>
Each task below is one QA criterion verification (QA-09 through QA-13). The pattern PER CRITERION is:

1. **Claude action:** Propose the verification approach (the verbatim `<how-to-verify>` script copied from RESEARCH.md). Update 13-CHECKLIST.md to mark the criterion as "in progress" with start timestamp.
2. **Andrew action:** Execute the steps and report PASS / FAIL / DEFERRED with notes (per the per-task `<resume-signal>` format).
3. **Claude action:** Update 13-CHECKLIST.md row with the result, end timestamp, and Andrew's verbatim notes. For QA-12, also update the 3 × 4 sub-table cells.
4. **On FAIL:** Pause this plan, drop into a quick-patch loop (read affected file → fix → commit → push → wait for Vercel deploy → ask Andrew to re-test the SAME criterion). DO NOT proceed to next QA item until current is PASS or explicitly DEFERRED.
5. **On DEFERRED:** Capture reason in checklist Notes column AND queue for Plan 13-03 FUTURE_DIRECTIONS.md §8.

**Marathon discipline:**
- Hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) at the start of every QA task and at every browser surface within QA-12 (RESEARCH.md Pitfall 5).
- DO NOT cancel any test bookings mid-marathon (RESEARCH.md Pitfall 6) — cleanup is Plan 13-03 Task 4 after sign-off.
- Re-deferred items (EMAIL-08, QA-01..QA-06): even if opportunistically encountered, log to checklist Notes ONLY; do NOT mark PASS. They are scope-NOT-in-Phase-13 per ROADMAP.
- Test artifact tracking: every throwaway signup, capacity booking, and brandtest booking goes into 13-CHECKLIST.md "Test Artifacts Created" section (RESEARCH.md Pitfall 3).
</execution_pattern>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: QA-09 — End-to-end signup → email-verify → onboarding wizard → first booking</name>
  <what-built>
    The full v1.1 multi-user signup + onboarding flow is shipped (Phase 10 plans 10-01 through 10-09). Phase 13-01 Task 3 has flipped the email-confirm toggle ON in production. QA-09 is the live end-to-end exercise of the entire signup → verify → onboard → first-booking happy path with a brand-new throwaway user.

    Per ROADMAP: "A brand-new test user completes signup → email-verify → onboarding wizard → first booking received end-to-end with no errors."
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md QA-09 Per-Criterion script):**

    Pre-condition: Plan 13-01 Items 1, 6 done. A throwaway email Andrew controls — using Gmail aliasing: `ajwegner3+phase13signup@gmail.com` (signup user) + `ajwegner3+phase13booker@gmail.com` (booker for the first-booking test). Both aliased emails arrive at `ajwegner3@gmail.com`.

    Steps for Andrew:

    1. Open https://calendar-app-xi-smoky.vercel.app/app/signup in a fresh incognito browser window (to ensure no session leakage from Andrew's primary login). **Hard-refresh after page loads (Ctrl+Shift+R)** to defeat any cache.

    2. Submit the signup form:
       - Email: `ajwegner3+phase13signup@gmail.com`
       - Password: pick a strong password (record it for re-login if needed)
       - Submit. Expect: redirect to `/app/verify-email`.

    3. Open https://mail.google.com (Gmail web for `ajwegner3@gmail.com` — `+phase13signup` aliased emails arrive in this inbox). Find the "Confirm your email" message from Supabase (subject typically "Confirm your signup"). Wait up to 60s for delivery.

    4. Click the confirmation link in the email. Expect: routes through `/auth/confirm?token_hash=...&type=signup&next=/onboarding` (Plan 10-02 handler) and lands on `/onboarding/step-1-account`.

    5. **Wizard step 1 (Account):**
       - Business name: "Phase 13 Test Co"
       - Slug: "phase13-test"
       - Submit. Expect: route advances to `/onboarding/step-2-timezone`.

    6. **Wizard step 2 (Timezone):**
       - Confirm timezone is auto-detected from browser default (`America/Chicago` for Andrew's machine).
       - Submit. Expect: route advances to `/onboarding/step-3-event-type`.

    7. **Wizard step 3 (First event type):**
       - Keep the pre-filled "Consultation / 30 min" defaults (per Plan 10-06 default seed).
       - Submit. Expect: redirect to `/app` (dashboard) — onboarding_complete=true.

    8. **First-booking E2E (CRITICAL — per ROADMAP "first booking received"):**
       - Open `https://calendar-app-xi-smoky.vercel.app/phase13-test/consultation` in a DIFFERENT browser session (incognito or different browser entirely, to ensure booker is a different user from owner).
       - Pick any slot at least 1h out (avoid the <24h reminder window — that's a different test surface).
       - Submit booking with:
         - Booker email: `ajwegner3+phase13booker@gmail.com`
         - Booker name: "Phase 13 Booker"
         - Phone: any test phone
         - Any required custom-question answers
       - Submit.

    9. **Verify all of:**
       - Booking-confirmation page renders without error.
       - Confirmation email arrives at `ajwegner3@gmail.com` (the `+phase13booker` aliased inbox) within 60s. Subject typically includes the event-type name.
       - Owner-notification email also arrives at `ajwegner3@gmail.com` (the new owner is `+phase13signup`, ALSO routed to ajwegner3@gmail.com).
       - Both emails render with shadcn defaults — Phase13TestCo has no branding values set yet (no brand_primary, no sidebar_color, no background_color). This is EXPECTED — branded variants are tested in QA-12 with the 3 pre-configured accounts.

    **Pitfall watch (RESEARCH.md Pitfall 4 / Gmail SMTP quota):** if signup confirmation email never arrives, check `email_send_log` for blocked rows OR `[GMAIL_SMTP_QUOTA_APPROACHING]` in Vercel function logs. Per Plan 10-04, signup-side emails cap at 200/day and fail-closed at cap. Booking + reminder paths bypass the guard, so they're not affected by quota. Andrew can run mid-marathon: `npx supabase db query --linked -c "SELECT count(*) FROM email_send_log WHERE created_at >= now() - interval '24 hours';"` to check quota usage.

    **Cleanup tracking:** Capture in 13-CHECKLIST.md Test Artifacts:
    - signup user email: `ajwegner3+phase13signup@gmail.com`
    - new account slug: `phase13-test`
    - booker email: `ajwegner3+phase13booker@gmail.com`
    - booking ID (visible in confirmation page URL or owner-notification email): ___

    **Cleanup deferred:** Per RESEARCH.md Pitfall 6, do NOT cancel/delete this test data mid-marathon. Plan 13-03 Task 4 handles cleanup capture.

    **PASS criteria:** Wizard completes without error; first-booking confirmation email arrives in inbox; owner-notification email arrives.

    **FAIL handling:** Pause and quick-patch loop (read affected file → fix → ship → re-test the SAME criterion). Common failure modes:
    - Confirmation link 404s → /auth/confirm route deploy issue OR template not updated in Plan 13-01 Task 3 Step 4 → re-check Supabase email template config
    - Wizard step 2 doesn't auto-detect TZ → JS error OR `Intl.DateTimeFormat` SSR mismatch → check Vercel function logs
    - Booking confirmation page errors → typically a missing column in event_types SELECT OR public-page loader bug
  </how-to-verify>
  <resume-signal>Type "qa-09 PASS" or "qa-09 FAIL: &lt;step&gt;: &lt;detail&gt;" or "qa-09 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: QA-10 — Multi-tenant UI isolation walkthrough as Test User 2</name>
  <what-built>
    Backend RLS isolation is covered by `tests/rls-cross-tenant-matrix.test.ts` (24 N=2 cases + 24 N=3 cases active once Test User 3 provisioning completes per Plan 13-01 Task 4). QA-10 is the UX-LAYER human walkthrough — log in as the second seeded test owner and verify dashboard surfaces NONE of Andrew's NSI account data.

    Per ROADMAP: "A 2nd test owner logged into the dashboard sees ZERO of Andrew's data on every surface (Home calendar, Event Types, Availability, Bookings, Branding, Settings) — multi-tenant UI isolation walkthrough complete."
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md QA-10 Per-Criterion script):**

    Pre-condition: Test User 2 password known (`TEST_OWNER_2_PASSWORD` in `.env.local`; Andrew already has this from Phase 9 + Phase 10 work).

    Steps for Andrew:

    1. Open a FRESH incognito browser window (no session leakage from QA-09's signup user OR Andrew's primary NSI login).
    2. Hard-refresh after page loads (Ctrl+Shift+R).
    3. Sign in at https://calendar-app-xi-smoky.vercel.app/app/login as:
       - Email: `andrewjameswegner@gmail.com` (Test User 2; account slug `nsi-rls-test`)
       - Password: from `.env.local` `TEST_OWNER_2_PASSWORD`

    4. After login (should reach `/app` dashboard), walk EACH of the 7 dashboard surfaces in order. Verify ZERO of Andrew's NSI data appears:

       | # | Surface | URL | Expected (Test User 2 perspective) |
       |---|---------|-----|------------------------------------|
       | 1 | Home calendar | `/app` | Empty calendar OR only `nsi-rls-test` bookings (the QA-11 capacity-test bookings will appear here AFTER QA-11 runs). NO bookings from Andrew's NSI account. NO bookings from Phase 13 Test Co (the QA-09 throwaway). |
       | 2 | Event Types | `/app/event-types` | Only the QA-11 "Capacity Test" event (after Plan 13-01 Task 6); zero of NSI's event types (no Andrew's qa-test, no Andrew's real types). |
       | 3 | Availability | `/app/availability` | Test User 2's rules only (defaults from onboarding). Not Andrew's availability rules. |
       | 4 | Bookings list | `/app/bookings` | Empty OR only Test User 2's bookings (none yet). Zero of Andrew's NSI bookings. |
       | 5 | Branding | `/app/branding` | Test User 2's branding values: brand_primary=#EC4899 (magenta), background_color=#FDF2F8 (pink-50), background_shade=bold, sidebar_color=#EC4899 (magenta) — these are the values set in Plan 13-01 Task 5. NOT Andrew's NSI navy. |
       | 6 | Settings → Profile | `/app/settings/profile` | Test User 2 email = `andrewjameswegner@gmail.com`; display name = whatever `nsi-rls-test` was created with (likely "Test Owner 2" or "NSI RLS Test"). NOT `ajwegner3@gmail.com`. NOT Andrew's NSI account name. |
       | 7 | Settings → Reminders | `/app/settings/reminders` | Test User 2 toggles (likely defaults from onboarding). NOT Andrew's NSI toggles (whatever Andrew has configured). |

    5. **For each surface:** hard-refresh (Ctrl+Shift+R) before observing to defeat any client-side cache from a prior session.

    6. After completing all 7 surfaces, log out via the user menu in the dashboard sidebar footer. Confirm session cleared by:
       - Visit `/app/bookings` after logout — should redirect to `/app/login`.
       - Visit `/app` — should redirect to `/app/login`.

    **PASS criteria:** All 7 surfaces show ZERO leakage of Andrew's `nsi` account data. Logout clears session.

    **FAIL handling:** If ANY surface shows data from another account (especially Andrew's NSI), this is a CRITICAL BUG. RLS policy on the affected table is broken. Capture:
    - Which surface
    - Which row(s) leaked (slug / id / any identifier)
    - The URL when the leak was observed

    Quick-patch loop is non-trivial here (RLS bug); likely escalates to a code-fix plan. If Andrew sees any leak, this is a SHIP-BLOCKER.

    **Note on the QA-09 throwaway data:** the Phase 13 Test Co account/booking/event from QA-09 is owned by a DIFFERENT user (the throwaway signup), not by Test User 2. Test User 2 should see ZERO of that data on every surface. If Phase 13 Test Co's event type appears in Test User 2's `/app/event-types` list, that's a CRITICAL RLS bug — same severity as Andrew's data leaking.

    **Note on QA-11 capacity event:** Plan 13-01 Task 6 created the capacity-test event under Test User 2. So Test User 2's `/app/event-types` SHOULD show "Capacity Test" — that's correct, not a leak.
  </how-to-verify>
  <resume-signal>Type "qa-10 PASS (7/7 surfaces clean + logout works)" or "qa-10 FAIL: &lt;surface&gt;: &lt;leak detail&gt;" or "qa-10 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: QA-12 — Branded UI smoke across 3 accounts × 4 surfaces (12 spot-checks + 3 emails)</name>
  <what-built>
    Three test accounts have been pre-configured with visually distinct branding profiles in Plan 13-01 Task 5. QA-12 walks all 4 branded surfaces (dashboard / public booking page / embed / email header band) for each of the 3 accounts. This exercises:
    - Phase 12.6 deferred items #1-#7 (already approved 2026-04-29 but reverified across 3 distinct combos here)
    - Phase 12.6 EMAIL-14 priority chain (sidebarColor → brand_primary → DEFAULT)
    - Phase 12 GradientBackdrop with 3 distinct shades (subtle / bold / none)
    - Phase 12.6-02 dashboard --primary CSS var override + AppSidebar direct hex
    - Phase 12.6-02 MiniPreviewCard 3-color faux-dashboard preview
    - Null/clear regression path on Account C (background_color=null, sidebar_color=null)

    Per ROADMAP: "Branded UI smoke: 3 different test accounts (different brand_primary, background_color, background_shade, sidebar_color combinations) render correctly on dashboard + public booking page + embed + emails."
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md QA-12 Per-Criterion script):**

    Pre-condition: Plan 13-01 Item 3 done — 3 accounts have distinct branding tuples per the verification SELECT in Plan 13-01 Task 5. Andrew has 3 separate browser sessions/profiles available (Chrome window + Chrome incognito + Firefox/Edge — to ensure independent sessions).

    The 4 surfaces × 3 accounts = 12 spot-checks. Plus per-account email triggers (3 emails) = **15 verifications total**.

    Hard-refresh (Ctrl+Shift+R) at every surface before observing — RESEARCH.md Pitfall 5.

    **Branding combos for reference:**
    - Account A (nsi): navy combo — brand_primary=#0A2540, background_color=#F8FAFC, background_shade=subtle, sidebar_color=#0A2540
    - Account B (nsi-rls-test): magenta combo — brand_primary=#EC4899, background_color=#FDF2F8, background_shade=bold, sidebar_color=#EC4899
    - Account C (nsi-rls-test-3): null/emerald combo — brand_primary=#22C55E, background_color=null, background_shade=none, sidebar_color=null

    **SURFACE 1 of 4 — Dashboard (`/app/branding` editor + `/app` shell)**

    For EACH of the 3 accounts (sign in fresh as that account's owner):

    1. Sign in at `/app/login` with that account's owner email + password.
    2. Visit `/app/branding`:
       - Verify the 3 distinct labeled pickers render: "Sidebar color", "Page background", "Button & accent".
       - Verify each picker shows the configured color (or null/cleared state for Account C).
       - Verify `MiniPreviewCard` faux-dashboard renders with all 3 color regions: faux-sidebar tint, faux-page tint with GradientBackdrop, white faux-card with brand-colored buttons (Account C: faux-sidebar uses shadcn default since sidebar_color=null; faux-page uses gray-50 since background_color=null; faux-button uses emerald).
       - Verify IntensityPicker is GONE (deleted in Plan 12.6-02).
    3. Visit `/app`:
       - Sidebar background = `sidebar_color` (or shadcn default for Account C).
       - Page background = `background_color` with the appropriate `background_shade` GradientBackdrop (or gray-50 default for Account C).
       - "Create event type" / row buttons = `brand_primary` color (Account A: navy, B: magenta, C: emerald).
       - WCAG contrast: sidebar text remains readable on each sidebar color. Specifically check Account B (magenta sidebar) — `pickTextColor(magenta)` should return white.
    4. Hard-refresh (Ctrl+Shift+R) to defeat any CSS cache.
    5. Log out before signing in to next account.

    **Mark in 13-CHECKLIST.md QA-12 Sub-table column "Dashboard":** PASS / FAIL per account.

    **SURFACE 2 of 4 — Public booking page (`/[account]/[event-slug]`)**

    For EACH account, open in incognito the public URL:
    - **A:** `/nsi/qa-test` — uses Andrew's existing qa-test event type if one exists; otherwise `/nsi/<any-existing-event-slug>`. If Andrew's NSI has no event types, log "DEFERRED — Account A has no event types for public surface check; covered by QA-09 path which uses a different account" and proceed.
    - **B:** `/nsi-rls-test/capacity-test` — the Plan 13-01 Task 6 event type.
    - **C:** any event type Test User 3 owns. NOTE: Test User 3 (`nsi-rls-test-3`) was provisioned in Plan 13-01 Task 4 with `onboarding_complete=true` (via direct INSERT, not via wizard) — so it has NO event types. Two options:
      - (preferred) **Sign in as Test User 3 and create one quickly** at `/app/event-types/new`: name="Brand Test", slug="brand-test", duration=30 min (no capacity needed). Saves ~30s.
      - (fallback) Mark this cell "DEFERRED — Account C has no event types; null-bg-page-rendering covered indirectly by Account C's `/app/branding` MiniPreviewCard and dashboard surface 1".

    For each account's public booking page, verify:
    - Page background = account's `background_color` with the configured `background_shade` GradientBackdrop (Account A: subtle gradient over off-white; Account B: bold gradient over pink-50; Account C: shadeToGradient returns flat color-mix tint over gray-50 fallback because background_color=null AND background_shade=none).
    - "Confirm booking" CTA button = account's `brand_primary` (A: navy, B: magenta, C: emerald).
    - Logo header (if `logo_url` set on the account; likely null for all 3 in v1.1) OR account-name span fallback per `branding-blocks.ts`.
    - The slot picker renders normally; date selection works.

    **Mark in 13-CHECKLIST.md QA-12 Sub-table column "Public booking":** PASS / FAIL per account.

    **SURFACE 3 of 4 — Embed (`/embed/[account]/[event-slug]`)**

    For EACH account (Account A and B work directly; Account C uses the brand-test event from above OR is marked DEFERRED), open `/embed/<slug>/<event-slug>`:
    - **A:** `/embed/nsi/qa-test`
    - **B:** `/embed/nsi-rls-test/capacity-test`
    - **C:** `/embed/nsi-rls-test-3/brand-test` (if event type was created above)

    For each:
    - Verify single-circle gradient pattern (per Plan 12-05 lock; not 3-circle backdrop). Embed surfaces use inline single-circle at `-top-32` inside `relative overflow-hidden` per STATE.md line 140.
    - Same brand_primary CTA color as the public booking page.
    - No horizontal overflow inside the iframe content (Pitfall 10: EmbedHeightReporter measures `documentElement.scrollHeight` correctly).
    - Page background uses the same color as Surface 2 (the embed inherits AccountSummary branding tokens).

    **Mark in 13-CHECKLIST.md QA-12 Sub-table column "Embed":** PASS / FAIL per account.

    **SURFACE 4 of 4 — Email header band (real Gmail inbox)**

    For EACH account, trigger one real booking against that account's public booking page. Use Gmail aliasing:
    - **A:** book on `/nsi/qa-test` (or whichever Account A event was used in Surface 2); booker email = `ajwegner3+brandtest-a@gmail.com`
    - **B:** book on `/nsi-rls-test/capacity-test` (one extra slot — note capacity=3 means up to 3 different slots can be booked; pick a DIFFERENT slot from the 3 that QA-11 will book later); booker email = `ajwegner3+brandtest-b@gmail.com`
    - **C:** book on `/nsi-rls-test-3/brand-test` (if event type created); booker email = `ajwegner3+brandtest-c@gmail.com`. If Account C public-page surface was deferred, this email check is also DEFERRED.

    **Mark each booking in 13-CHECKLIST.md Test Artifacts Created section.**

    Open Gmail web (`ajwegner3@gmail.com` inbox; the +brandtest-{a,b,c} emails all land here). For each confirmation email:

    - **Header band color** = expected per the EMAIL-14 priority chain `branding.sidebarColor ?? branding.brand_primary ?? DEFAULT_BRAND_PRIMARY`:
      - Account A: header band = sidebar_color = `#0A2540` (navy)
      - Account B: header band = sidebar_color = `#EC4899` (magenta)
      - Account C: header band = brand_primary = `#22C55E` (emerald) — because sidebar_color=null falls through to brand_primary
    - Header band has **NO gradient artifacts** (per Phase 12 deferred item #7 + STATE.md "renderEmailBrandedHeader solid-color-only pattern" — no VML, no CSS gradients, just `bgcolor=` table attribute solid color).
    - Logo is centered top when `logo_url` is set on the account, otherwise account-name span fallback (likely the latter for all 3 in v1.1).
    - "Powered by NSI" footer: should now show the NSI mark image swapped in Plan 13-01 Task 1 (NSI_MARK_URL is set in production; per STATE.md line 179 the `public/nsi-mark.png` was a placeholder before 13-01 Task 1). If the real NSI mark renders correctly + brand-name text alongside, that closes Phase 12.6 item #8 verification.
    - Auto-contrast text on header band: should be readable in all 3 cases per `pickTextColor()` WCAG helper (navy → white text; magenta → white text; emerald → white text).

    **Mark in 13-CHECKLIST.md QA-12 Sub-table column "Email header band":** PASS / FAIL per account.

    **PASS criteria:** All 12 surface × account spot-checks render correctly per the per-cell expectations; all 3 emails show correct header band per the priority chain; NSI mark renders in footer.

    **FAIL handling:** If a specific cell fails (e.g., Account C dashboard sidebar shows magenta instead of shadcn default), capture:
    - Which account
    - Which surface
    - What was observed vs expected
    - Hard-refresh + retest before logging FAIL (RESEARCH.md Pitfall 5: branding-data UPDATE doesn't trigger redeploy)

    Common failure modes:
    - sidebar shows brand_primary instead of sidebar_color → `AppSidebar` not updated to use new prop → check Plan 12.6-02 implementation
    - email header band gradient artifact → renderEmailBrandedHeader regression (should be solid bgcolor)
    - Account C surfaces show A or B's branding → caching or session leak (hard-refresh, re-incognito)

    Quick-patch loop applies if failure is fixable (typically a CSS or data-loader issue); otherwise DEFER with reason.
  </how-to-verify>
  <resume-signal>Type "qa-12 PASS (12/12 surfaces + 3/3 emails)" or partial e.g. "qa-12 PASS except: account-C/embed: brand-test event not created; account-C/email: deferred" or "qa-12 FAIL: &lt;account&gt;/&lt;surface&gt;: &lt;detail&gt;" or "qa-12 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: QA-13 — EmbedCodeDialog widening verified at 320 / 768 / 1024 viewports</name>
  <what-built>
    Per Plan 12-05 lock + STATE.md line 142: EmbedCodeDialog was widened from `max-w-3xl` to `sm:max-w-2xl` to fix horizontal overflow during copy-paste at narrow viewports. QA-13 verifies the dialog renders cleanly at the 3 standard breakpoints with no page-level horizontal scroll and no content clipping inside the dialog.

    Per ROADMAP: "Embed snippet dialog widening verified at 320 / 768 / 1024 viewports without horizontal overflow."
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md QA-13 Per-Criterion script):**

    Pre-condition: Andrew is logged in as any account owner (recommend Account A = NSI for fastest path — Andrew's primary login). At least one event type exists (NSI's qa-test, OR any event type Andrew has).

    Steps for Andrew:

    1. Navigate to `/app/event-types` (logged in as Andrew/NSI).
    2. Click any event type's kebab menu (3-dot icon at the right of the row) → click "Get embed code" (or similar — the EmbedCodeDialog from Plan 12-05).
    3. Confirm the dialog opens. The dialog should render at `sm:max-w-2xl` (~672px wide) on a normal desktop viewport.
    4. With the dialog OPEN, open Chrome DevTools (F12) → click the Toggle Device Toolbar icon (Ctrl+Shift+M / Cmd+Shift+M).

    **At viewport width 320px (mobile):**
    5. Set viewport width to **320px** (in DevTools, type 320 in the width input at top of viewport).
    6. Verify:
       - The dialog renders WITHIN the viewport (no horizontal page scroll — check the bottom of the page for horizontal scrollbar; should be absent).
       - The snippet `<textarea>` / code block does NOT overflow the dialog horizontally — code wraps OR the dialog itself has a vertical scroll inside the viewport.
       - The "Copy" button + "Close" button (or "X" / dialog dismiss) remain reachable — finger-tap target should be at least 44px tall.
       - No clipped text (no characters cut off at the right edge).

    **At viewport width 768px (tablet):**
    7. Set viewport width to **768px**. Repeat verifications from step 6.

    **At viewport width 1024px (small desktop):**
    8. Set viewport width to **1024px**. Repeat verifications from step 6. At 1024px, the dialog should be `sm:max-w-2xl` (~672px) centered in the viewport — NOT stretching full-width. Verify centering looks intentional.

    9. Reset DevTools viewport to "No override" (in DevTools toggle device toolbar OFF) when done.

    **What "horizontal overflow" looks like (if you see this, FAIL):**
    - The page or dialog body shows a horizontal scrollbar at the bottom.
    - Text or code is clipped at the right edge (cut-off characters).
    - The dialog extends past the viewport's right edge.
    - The "Copy" or "Close" button is partially or fully off-screen.

    **PASS criteria:** No horizontal page overflow AND no content clipping AND all action buttons reachable at any of the 3 widths.

    **FAIL handling:** If horizontal overflow appears at any width, check:
    - The dialog itself: should be `sm:max-w-2xl` per Plan 12-05 lock — verify in DevTools Elements panel that the DialogContent has the right Tailwind class.
    - The textarea inside: should have `w-full` + `whitespace-pre-wrap` or similar wrapping CSS.
    - The Copy button container: should not use `flex` without `flex-wrap` or proper truncation.

    Quick-patch is straightforward (CSS class fix). If patched, redeploy and retest at the failing viewport.
  </how-to-verify>
  <resume-signal>Type "qa-13 PASS (320/768/1024 all clean)" or "qa-13 FAIL: &lt;width&gt;: &lt;detail&gt;" or "qa-13 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: QA-11 — Capacity end-to-end (3 succeed, 4th rejected with SLOT_CAPACITY_REACHED)</name>
  <what-built>
    Phase 11 shipped capacity-aware booking with:
    - Plan 11-02: `max_bookings_per_slot` + `show_remaining_capacity` columns on event_types
    - Plan 11-03: `slot_index` column + `bookings_capacity_slot_idx` partial unique index
    - Plan 11-04: POST /api/bookings retry loop on 23505 + CAP-07 SLOT_TAKEN/SLOT_CAPACITY_REACHED branching
    - Plan 11-05: GET /api/slots capacity-aware (CAP-04 slot exclusion + CAP-08 remaining_capacity)
    - Plan 11-06: pg-driver race test (skip-guarded; OPTIONAL during marathon)
    - Plan 11-08: booker UI capacity badge ("X spots left") + 409 message branching

    QA-11 is the live UX-layer verification: a capacity=3 event accepts exactly 3 bookings (the badge counts down 3→2→1) and rejects the 4th attempt with the correct branded copy.

    Per ROADMAP: "Capacity end-to-end: an event with capacity=3 accepts exactly 3 bookings from different sessions; the 4th attempt returns the right SLOT_CAPACITY_REACHED error message in the UI."
  </what-built>
  <how-to-verify>
    **CLAUDE PROPOSES (per RESEARCH.md QA-11 Per-Criterion script):**

    Pre-condition: Plan 13-01 Item 4 done — capacity=3 "Capacity Test" event live at `https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/capacity-test`. Three browser sessions available (Chrome window + Chrome incognito + Firefox/Edge — to ensure separate sessions). A 4th window for the SLOT_CAPACITY_REACHED probe.

    Steps for Andrew:

    **Phase A — Setup (3 sessions, same slot picked):**

    1. In Chrome (Session 1), navigate to `https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/capacity-test`. Hard-refresh (Ctrl+Shift+R). Pick a slot at least 1h out (e.g., tomorrow 2:00 PM). DON'T submit yet — just fill the form.
    2. In Chrome incognito (Session 2), navigate to the same URL. Hard-refresh. Pick the SAME slot. Fill form. Don't submit.
    3. In Firefox/Edge (Session 3), navigate to the same URL. Hard-refresh. Pick the SAME slot. Fill form. Don't submit.

    Booker emails (use Gmail aliasing so all land in `ajwegner3@gmail.com` inbox):
    - Session 1: `ajwegner3+cap1@gmail.com`
    - Session 2: `ajwegner3+cap2@gmail.com`
    - Session 3: `ajwegner3+cap3@gmail.com`

    Names: "Cap Test Booker 1" / 2 / 3. Phone: any. Custom-question answers: any.

    **Phase B — Sequential bookings (3 succeed; observe capacity badge between them):**

    4. Submit Session 1's booking. Verify:
       - Confirmation page renders without error.
       - Confirmation email arrives at `ajwegner3@gmail.com` (the +cap1 inbox) within 60s.

    5. In Session 2 BEFORE submitting: refresh the slot picker (close + reopen the date picker, or hard-refresh the page and re-fill — picker re-queries `/api/slots`). After refresh, find the original slot. **Verify the capacity badge:** the slot button should now show "2 spots left" (CAP-08 + Plan 13-01 Task 6 sets `show_remaining_capacity=true` so the badge IS displayed). Then submit Session 2.

    6. Submit Session 2's booking. Verify:
       - Success.
       - Confirmation email arrives.

    7. In Session 3 BEFORE submitting: refresh the picker. Verify the slot now shows "1 spot left" (CAP-08 badge counted down). Then submit Session 3.

    8. Submit Session 3's booking. Verify:
       - Success.
       - Confirmation email arrives.

    **Phase C — 4th rejection (SLOT_CAPACITY_REACHED probe):**

    Two ways to trigger the 4th-attempt rejection — try in order:

    **Path 1 (CAP-04 slot exclusion — most likely scenario):**

    9. Open a 4th browser session (Chrome guest profile, OR another browser, OR a new incognito window). Navigate to the same URL.
    10. After the picker loads, look at the slot that just had 3 bookings: it should be GONE entirely from the picker (CAP-04 slot exclusion at `/api/slots` — when `confirmed_count >= max_bookings_per_slot`, the slot is filtered out).
    11. **Verify:** the slot is absent from the picker. Other slots in the day should still be available.

    **Path 2 (CAP-07 race-loser banner — explicit SLOT_CAPACITY_REACHED 409):**

    To explicitly trigger the SLOT_CAPACITY_REACHED 409 banner copy:

    12. Open 2 browser sessions. In both, navigate to the capacity-test event page and pick a NEW slot (a different slot from the one with 3 bookings — otherwise CAP-04 will exclude it from both pickers).
    13. In session A: fill the form for slot S. Don't submit.
    14. In session B: fill the form for slot S. Don't submit.
    15. Have a 3rd session pre-load the same slot (so 3 sessions all have the form filled for slot S). Submit Session A → success. Submit Session B → success. Submit the 3rd session → success (slot reaches capacity=3).
    16. Now in session A (or open a NEW session), refresh the picker, observe slot S is gone from the picker (CAP-04). To trigger CAP-07 explicitly, you'd need a tighter race condition — easier to verify CAP-07 banner copy is correct via Path 1.5 below.

    **Path 1.5 (concurrent submit race — explicit 409 path; OPTIONAL):**

    To explicitly trigger SLOT_CAPACITY_REACHED + 409 + UI banner WITHOUT clearing all 3 capacity slots:
    - Find a slot at capacity-1 (e.g., one of the original 3 sessions had its booking succeed; another should have been pre-filling for the same slot — both have the form open).
    - Have 2 sessions both fill the form for the SAME slot at capacity-1 (say sessions D and E).
    - Submit D → success (slot now full).
    - Submit E quickly → 409 returned with `code=SLOT_CAPACITY_REACHED`. Verify the UI banner reads:
      > "That time is fully booked. Please choose a different time."
    - Verify the slot picker auto-refreshes after the 409 (per Plan 11-08 deferred item #2 step 3) — the now-unavailable slot disappears from the picker.

    **PASS criteria:**
    - 3 bookings succeed at the same slot.
    - "X spots left" badge counts down 3→2→1 between bookings (Plan 11-08 + Plan 13-01 Task 6 `show_remaining_capacity=true`).
    - 4th attempt either:
      - (a) sees the slot absent from picker via CAP-04 exclusion (most common path), OR
      - (b) is explicitly rejected with `SLOT_CAPACITY_REACHED` banner copy "That time is fully booked. Please choose a different time." via the race path (CAP-07 via Path 1.5).
    - Slot picker self-refreshes after any 409 error.

    **FAIL handling:**
    - If 4 bookings all succeed: race-safe partial unique index `bookings_capacity_slot_idx` is broken. CRITICAL — escalate. Verify the index exists: `npx supabase db query --linked -c "SELECT indexname FROM pg_indexes WHERE tablename='bookings' AND indexname LIKE 'bookings_capacity%';"`
    - If 1st-3rd booking already shows "fully booked" before getting to 4th: CAP-04 exclusion is over-triggering. Verify `.eq("status","confirmed")` filter in /api/slots query (Plan 11-05 Pitfall 4 close).
    - If badge shows wrong number (e.g., "0 spots left" instead of "1 spot left" before 3rd booking): CAP-08 remaining_capacity computation off-by-one bug.
    - If 4th attempt shows generic "Something went wrong" instead of SLOT_CAPACITY_REACHED branded copy: CAP-07 branching broken in booking-form.tsx 409 handler.

    **Cleanup capture:**

    Mark in 13-CHECKLIST.md Test Artifacts Created:
    - 3 confirmed bookings on capacity-test event_type
    - Booker emails: cap1/cap2/cap3
    - 4th rejected attempt (note booker email if applicable)
    - Any additional bookings created during Path 1.5 (cap4/cap5/etc.)

    Per RESEARCH.md Pitfall 6: do NOT cancel these bookings during the marathon. Plan 13-03 Task 4 handles cleanup capture.

    **Optional: Phase 11-06 pg-driver race test (deferred check #6 from RESEARCH.md):**

    If Andrew has `SUPABASE_DIRECT_URL` (port 5432) handy in `.env.local`, he can OPTIONALLY run:
    ```
    npm run test -- race-guard.test.ts
    ```
    Expected: CAP-06 describe block UN-skips; both `it()` cases pass (capacity=3 N=10 → 3 succeed; capacity=1 N=5 → 1 succeeds). This is one-time milestone-end coverage.

    If Andrew doesn't have direct URL handy: log "DEFERRED — pg-driver race test (CAP-06) — covered at UI layer by QA-11 marathon" in checklist Notes; Plan 13-03 surfaces this in FUTURE_DIRECTIONS.md §8.
  </how-to-verify>
  <resume-signal>Type "qa-11 PASS (3 confirmed + 4th rejected via &lt;Path 1 / Path 1.5&gt;)" or "qa-11 FAIL: &lt;step&gt;: &lt;detail&gt;" or "qa-11 DEFERRED: &lt;reason&gt;"</resume-signal>
</task>

<task type="auto">
  <name>Task 6: Final 13-CHECKLIST.md update + handoff to Plan 13-03</name>
  <files>
    .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
  </files>
  <action>
    Aggregate all session results into 13-CHECKLIST.md. After Tasks 1-5 complete, fill in:

    1. **Marathon Criteria table:** Set status (PASS / FAIL / DEFERRED) on each of QA-09..QA-13 with timestamp + Andrew's verbatim notes per row.
    2. **QA-12 Sub-table:** Per-cell PASS / FAIL on the 3 × 4 grid (12 cells) + the 3 email-header-band cells (15 cells total). Note Account C cells that were DEFERRED due to no-event-type if applicable.
    3. **Deferred Check Replays section:** Update each row with replay outcome (LIVE-VERIFIED in QA-NN / DEFERRED with reason / N/A — Phase 9 covered).
    4. **Test Artifacts Created section:** Capture all test data created during marathon:
       - QA-09 throwaway signup user email + slug + new account uuid
       - QA-09 first-booking booker email + booking id (from confirmation email)
       - QA-11 3 bookings on capacity-test event type — booker emails + booking ids if accessible
       - QA-12 3 brandtest bookings — booker emails (one per Account A/B/C if all 3 ran)
       - Any booking created in QA-11 Path 1.5 (additional cap-N bookings)
    5. **Deferrals to v1.2 section:** Populate with any criterion downgraded by Andrew during the session — each row gets:
       - The QA item or deferred-replay item
       - Reason (verbatim from Andrew)
       - Recommended v1.2 action (if known)
    6. **Session end timestamp:** Capture in Session Start / End area at top of file.

    Plan 13-03 will read this file to populate FUTURE_DIRECTIONS.md §8.

    DO NOT collect Andrew's sign-off here — sign-off is Plan 13-03 Task 3 (after FUTURE_DIRECTIONS.md is committed).

    **If ANY of QA-09..QA-13 is FAIL (not deferred), STOP and signal CHECKPOINT REACHED** — sign-off cannot proceed until those are resolved (quick-patch loop) or explicitly DEFERRED by Andrew.

    Commit the updated checklist:
    ```
    git add .planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md
    git commit -m "docs(13-02): complete marathon QA checklist (QA-09..QA-13 outcomes + sub-table + deferrals)"
    git push origin main
    ```
  </action>
  <verify>
    13-CHECKLIST.md has every row populated for QA-09..QA-13 + the QA-12 3×4+3 sub-table + Deferred Check Replays section.
    Test Artifacts Created section lists every test signup + booking from the marathon (count: at least 1 throwaway signup + 1 first-booking + 3-4+ capacity bookings + 1-3 brandtest bookings = ~7-9 artifacts total).
    Deferrals section captures any downgraded items with reason.
    Sign-off section remains empty (Plan 13-03 Task 3 fills).
    File committed + pushed to origin/main.
  </verify>
  <done>
    13-CHECKLIST.md is the source of truth for the Phase 13 marathon. Plan 13-03 can begin (FUTURE_DIRECTIONS.md authoring + sign-off).
  </done>
</task>

</tasks>

<verification>
- All 5 marathon criteria (QA-09 through QA-13) marked PASS or DEFERRED in 13-CHECKLIST.md
- QA-12 sub-table (3 accounts × 4 surfaces + 3 emails = 15 cells) all populated
- Deferred Check Replays section reflects which Phase 10/11/12/12.5/12.6 items folded into which marathon QA item or were deferred
- Any inline fixes during the session are committed + deployed + retested before marking PASS
- All test artifacts captured (throwaway signups, capacity bookings, brandtest bookings, any additional)
- 13-CHECKLIST.md committed + pushed to origin/main
- 255 tests still passing + 26 skipped (no regression from quick-patch loops if any ran)
- Re-deferred scope (EMAIL-08, QA-01..QA-06) NOT exercised; NOT marked PASS
</verification>

<success_criteria>
- All Plan 13-02 must_haves satisfied
- Andrew has explicit visibility into every QA-09..QA-13 PASS / FAIL / DEFERRED outcome via 13-CHECKLIST.md
- QA-12 per-cell sub-table tells Andrew which of 15 surface-account-email combinations works
- No surprise blockers remain for Plan 13-03 sign-off
- All test data created during marathon is documented for Plan 13-03 cleanup capture
</success_criteria>

<output>
After completion, create `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-02-SUMMARY.md` summarizing the marathon session: total criteria evaluated, pass count, fail count, deferral count, time elapsed, fix-as-you-go commits if any (with SHAs), and the test-artifact roster for Plan 13-03 cleanup.
</output>

<pitfalls>
- **Pitfall 3 (RESEARCH.md): Test users dirty production data without cleanup.** EVERY test artifact created during the marathon MUST be captured in 13-CHECKLIST.md Test Artifacts Created section (Task 6 step 4). Plan 13-03 Task 4 owns cleanup decisions; do not delete anything mid-marathon.
- **Pitfall 4 (RESEARCH.md): Gmail SMTP quota cap.** If signup confirmation emails stop arriving, check `email_send_log` for blocked rows. QA-11 + QA-12 booking emails BYPASS the quota guard (per STATE.md Phase 10 ARCH DECISION #2) so only QA-09 signup is at risk.
- **Pitfall 5 (RESEARCH.md): Browser cache masks CSS regressions during QA-12.** Hard-refresh (Ctrl+Shift+R) at every surface check. For public pages and embeds, use incognito to defeat session cache.
- **Pitfall 6 (RESEARCH.md): Cancelling test bookings mid-marathon corrupts QA state.** Do NOT use the Bookings → Cancel UI mid-marathon. Cleanup is Plan 13-03's job after sign-off.
- **Re-deferred scope lock (ROADMAP):** EMAIL-08 (SPF/DKIM/DMARC + mail-tester) and QA-01..QA-06 (v1.0 marathon items) are explicitly NOT in Phase 13. If Andrew opportunistically scores mail-tester during a QA-09 send, log the score in checklist Notes ONLY — do NOT mark a QA-NN row PASS based on opportunistic mail-tester results.
- **--gaps mode (RESEARCH.md Open Question 4 / Pitfall — paused mid-marathon):** Per Andrew historical preference (Phase 9 marathon was single-session), default to one session. If fatigue surfaces, pause at any QA-NN boundary — checklist state is durable. Resume with `/gsd:execute-phase 13` from the next QA-NN.
</pitfalls>
