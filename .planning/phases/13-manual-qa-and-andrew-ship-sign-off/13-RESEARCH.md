# Phase 13: Manual QA + Andrew Ship Sign-Off — Research

**Researched:** 2026-04-29
**Domain:** Human-driven manual QA + sign-off (no code, no library research)
**Confidence:** HIGH (all source material is internal project documentation read end-to-end)

---

## Summary

Phase 13 is a manual-QA + sign-off phase for v1.1 (analog of Phase 9 for v1.0). All v1.1 capability code is shipped (Phase 10/11/12/12.5/12.6 — 255 tests + 26 skipped). The job is to:

1. Run the **21 deferred manual checks** from `MILESTONE_V1_1_DEFERRED_CHECKS.md` (Phase 10 = 3 items, Phase 11 = 4 items, Phase 12 = 10 items, Phase 12.5 = 3 items, Phase 12.6 = 8 items — though Phase 12.6 items 1–7 are already live-verified per Andrew 2026-04-29; only NSI mark swap remains).
2. Walk through **QA-09..QA-15** (the 7 Phase 13 requirements) on production.
3. Update `FUTURE_DIRECTIONS.md` with v1.1 carry-overs.
4. Capture Andrew's verbatim "ship v1.1" sign-off.

**No library/framework research is in scope** — the ROADMAP explicitly states: *"Research flag: None. Standard manual QA — no decisions required."* This RESEARCH.md is therefore prescriptive process / walkthrough script research, not stack research.

**Primary recommendation:** Mirror Phase 9's 3-plan structure exactly: **13-01 pre-QA prerequisites + pre-flight fixes**, **13-02 marathon QA execution (QA-09..13)**, **13-03 future-directions update + sign-off (QA-14, QA-15)**. Front-load the lockout-risk pre-flight items (Supabase email-confirm toggle + Andrew's `email_confirmed_at` SQL) into 13-01 so 13-02 cannot be blocked mid-session.

---

## Standard Stack

**Not applicable.** This phase ships zero runtime code by design. All code under test was shipped in Phases 10–12.6.

The only "tooling" used:

| Tool | Purpose | Already in repo |
|------|---------|-----------------|
| Chrome DevTools (Device Toolbar) | 320 / 768 / 1024 viewport probe (QA-13) | n/a — browser feature |
| Supabase Dashboard (Auth, SQL Editor, Table Editor) | Test user creation, email-template config, RLS row inspection | n/a — web UI |
| Gmail web (`ajwegner3@gmail.com`) + `+aliasing` | Receive transactional emails for QA-09 / QA-12 | Andrew already has |
| Vercel Dashboard | Confirm production deploy current; check Cron tab | Andrew already has |
| `scripts/phase10-pre-flight-andrew-email-confirmed.sql` | Pre-flight SQL for email-confirm toggle | Already committed |
| `tests/rls-cross-tenant-matrix.test.ts` | Optional N=3 matrix test extension | Already committed |

---

## Architecture Patterns

### Recommended 3-Plan Structure (mirrors Phase 9)

```
.planning/phases/13-manual-qa-and-andrew-ship-sign-off/
├── 13-RESEARCH.md                                          # this file
├── 13-CHECKLIST.md                                         # session-of-record (created by 13-01)
├── 13-01-pre-qa-prerequisites-and-pre-flight-fixes-PLAN.md # gate before marathon
├── 13-02-marathon-qa-execution-PLAN.md                     # QA-09..QA-13 walkthroughs
└── 13-03-future-directions-and-sign-off-PLAN.md            # QA-14 + QA-15
```

### Plan 13-01 — Pre-QA Prerequisites + Pre-flight Fixes

**Wave 1, autonomous=false, depends_on=[]**

**Tasks:**
1. **Task 1 (checkpoint:human-action, blocking)** — Andrew completes Phase 12.6 NSI mark image swap (see "Pre-Flight Inventory" §Item 0 below). This is the only HARD prerequisite per `STATE.md` line 242.
2. **Task 2 (auto)** — Verify production deploy is current (Phase 12.6 commits live on Vercel). Guard:
   ```
   curl -i https://calendar-app-xi-smoky.vercel.app/app/branding
   # Expect 200 redirect to /app/login (auth required) — confirms route exists
   ```
3. **Task 3 (checkpoint:human-action, blocking)** — Andrew runs the 5-step Phase 10 Plan 10-05 deferred sequence (`scripts/phase10-pre-flight-andrew-email-confirmed.sql` → toggle email-confirm ON → whitelist redirect URLs → update 4 email templates → verify Andrew login still works). Full ordered procedure in "Pre-Flight Inventory" §Item 1.
4. **Task 4 (checkpoint:human-action, blocking)** — Andrew creates Test User 3 (Phase 10 Plan 10-09 deferred — Supabase Dashboard create + accounts row INSERT). This unblocks both QA-10 (multi-tenant walkthrough) and the QA-12 third branded account.
5. **Task 5 (auto)** — Create the 3 distinct branding profiles for QA-12 by writing branding directly to the 3 test accounts via Supabase SQL Editor (UPDATE on `accounts.brand_primary, background_color, background_shade, sidebar_color`). Distinct combos defined in "QA-12 Walkthrough" below.
6. **Task 6 (auto)** — Create the capacity=3 test event type for QA-11 (under Test User 2 to keep QA isolation clean). Owner can be either Andrew or Test User 2 — recommend Test User 2 because QA-09 (signup E2E) will be reusing a fresh user, and Andrew's NSI account may have its own brand_primary that conflicts with QA-12 setup.
7. **Task 7 (auto)** — Scaffold `13-CHECKLIST.md` (system-of-record artifact). Schema in "Code Examples" §Checklist Scaffold below.
8. **Task 8 (auto)** — Push all setup commits to origin/main; confirm Vercel deploy still green.

**Why front-loaded:** Once email-confirm is ON without `email_confirmed_at` set, Andrew is locked out of his own production NSI account. The pre-flight SQL is the lockout safety net. Doing this in 13-01 BEFORE the marathon means a lockout discovered mid-marathon does not derail QA-09..QA-13.

### Plan 13-02 — Marathon QA Execution (QA-09 through QA-13)

**Wave 2, autonomous=false, depends_on=["13-01"]**

**Pattern (per QA item, mirrors Phase 9 Plan 09-02):**
1. **Claude proposes:** the verification approach (steps copied verbatim from this RESEARCH.md), updates `13-CHECKLIST.md` to "in progress" with start timestamp.
2. **Andrew executes:** the steps + reports PASS / FAIL / DEFERRED with notes.
3. **Claude updates:** `13-CHECKLIST.md` row with result + end timestamp + Andrew's verbatim notes.
4. **On FAIL:** pause, drop into a quick-patch loop (read affected file → fix → commit → push → wait for Vercel deploy → ask Andrew to re-test the SAME criterion). Do NOT proceed to next item until current is PASS or explicitly DEFERRED.
5. **On DEFERRED:** capture reason in checklist Notes column AND queue for 13-03 FUTURE_DIRECTIONS.md.

**Recommended task ordering** (rationale: dependency chain + minimize Andrew context switches):

| Task | QA item | Why this order |
|------|---------|----------------|
| 1 | QA-09 | First — needs a fresh signup, exercises auth/email-confirm path the prerequisites just enabled |
| 2 | QA-10 | Second — log in as Test User 2 (already created in 13-01); verifies multi-tenant isolation BEFORE doing the per-account branding smoke |
| 3 | QA-12 | Third — branded UI smoke across 3 test accounts on 4 surfaces (dashboard + public + embed + emails); uses the 3 branding profiles set up in 13-01 |
| 4 | QA-13 | Fourth — purely viewport-based; no email or fresh-user dependency |
| 5 | QA-11 | Last in marathon — capacity E2E needs 3 different sessions; doing it last lets you reuse the same browser windows + recover gracefully if the cap test produces orphan rows |

**Re-deferred items** (per ROADMAP scope-NOT-in-Phase-13 lock; do NOT include as marathon tasks): EMAIL-08 (SPF/DKIM/DMARC + mail-tester), QA-01..QA-06 (v1.0 marathon items already deferred to v1.2). Even if Andrew opportunistically scores mail-tester during a QA-09 send, the score is informational only — does NOT block sign-off.

**Replay of remaining deferred Phase 10–12 checks during marathon:** see "Deferred Check Replay Mapping" below — most fold opportunistically into QA-09..QA-13 (e.g., Phase 11 capacity badge live render at QA-11, Phase 12 gradient backdrop sweep at QA-12, etc.). A small residual set must be standalone tasks; enumerated below.

### Plan 13-03 — FUTURE_DIRECTIONS.md Update + Andrew Sign-Off (QA-14 + QA-15)

**Wave 3, autonomous=false, depends_on=["13-02"]**

**Tasks:**
1. **Task 1 (auto)** — Author the v1.1 update to `FUTURE_DIRECTIONS.md`. Add a NEW section `## 8. v1.1 Phase 13 — Marathon QA + Carry-overs` (mirroring the existing `## 7. v1.1 Phase 10` section pattern). Capture every DEFERRED row from `13-CHECKLIST.md` + Phase 11/12/12.5/12.6 deferrals that were NOT live-verified during marathon. Update §1 Known Limitations with anything QA discovered. **Audience invariant** (per existing FUTURE_DIRECTIONS.md How to Use This File): future Claude Code sessions, fact-statement bullets with source citations.
2. **Task 2 (auto)** — Commit `FUTURE_DIRECTIONS.md` + push to origin/main. Closes QA-15.
3. **Task 3 (checkpoint:human-action, blocking)** — Andrew reviews `13-CHECKLIST.md` + `FUTURE_DIRECTIONS.md`, confirms qualified-PASS rows are recorded as such (e.g., DEFERRED rows must record reason), and explicitly says "ship v1.1" (or equivalent — "approved", "sign off", "ship it").
4. **Task 4 (auto)** — On verbal sign-off: append final entry to `13-CHECKLIST.md` (§ Sign-off section per Phase 9 pattern), commit with message `docs(13): Andrew sign-off — v1.1 shipped`, push. Update `STATE.md` to mark Phase 13 complete + v1.1 shipped.

### Anti-Patterns to Avoid

- **DON'T** plan task-level granularity for marathon QA. Per Phase 9 Plan 09-02, QA proceeds at criterion granularity (one task per QA item), not sub-step granularity. Sub-steps live in the `<how-to-verify>` block.
- **DON'T** include any of the QA-01..QA-06 items in plan tasks. They are explicitly RE-deferred (ROADMAP "Scope NOT in Phase 13"). Even if a tester naturally encounters something, log it in checklist Notes only.
- **DON'T** use `autonomous: true` on any of the 3 plans. The entire phase is checkpoint-gated. Set `autonomous: false` everywhere.
- **DON'T** invent the checkpoint protocol — copy the `<task type="checkpoint:human-verify" gate="blocking">` shape from Phase 9 Plan 09-02 verbatim, including `<resume-signal>` text.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test users for QA-10 / QA-12 | New auth fixtures | Existing `TEST_OWNER_2_EMAIL` (`andrewjameswegner@gmail.com`) + new `TEST_OWNER_3_EMAIL` (`nsi-rls-test-3@andrewwegner.example`) created via Plan 10-09 deferred procedure | These users have already-correct `accounts` rows + RLS policies; new fixtures would skip the provisioning trigger and break invariants |
| Capacity test event for QA-11 | Bespoke harness | An owner-created event_type with `max_bookings_per_slot=3`, set via `/app/event-types/{id}/edit` UI | The point is to exercise the live path, not bypass it |
| Email content for QA-12 inbox check | Write fake confirmation emails | Trigger real bookings via `/[account]/[event-slug]` on each branded test account | The whole capability under test IS the email rendering — synthetic emails would prove nothing |
| Sign-off receipt | New artifact | Append to `13-CHECKLIST.md` § Sign-off (mirrors Phase 9 / `09-CHECKLIST.md`) | Single canonical session-of-record |
| FUTURE_DIRECTIONS.md v1.1 carry-over capture | New file | Append a new `## 8. v1.1 Phase 13` section to existing `FUTURE_DIRECTIONS.md` at repo root | One canonical file per project; future Claude reads top-to-bottom. Existing pattern: §7 = Phase 10 carry-overs |
| Multi-tenant isolation test | New automated test suite | Trust the existing `tests/rls-cross-tenant-matrix.test.ts` (24+ cases at N=2; +24 cases at N=3 once Test User 3 is provisioned). QA-10 is the human UI-LAYER confirmation only | Per Phase 9 Plan 09-02 Task 8: backend RLS isolation = automated; UX-layer = human walkthrough |
| Viewport testing for QA-13 | Real device farm | Chrome DevTools Device Toolbar (Ctrl+Shift+M), set width to 320 / 768 / 1024 manually | DevTools is the locked tool from Phase 9 Plan 09-02 Task 7 |

**Key insight:** The infrastructure is built. Phase 13 is a verification phase, not a build phase. Custom tooling here is wasted effort and risks introducing new bugs that drown the QA signal.

---

## Pre-Flight Inventory (the ordered list 13-01 must execute)

This is THE definitive list of things that must be TRUE before Plan 13-02 marathon QA can begin. Order matters.

### Item 0: Phase 12.6 NSI mark asset swap (HARD prerequisite per STATE.md line 242)

- **Source:** `MILESTONE_V1_1_DEFERRED_CHECKS.md` Phase 12.6 deferred item #8.
- **What:** Replace `/public/nsi-mark.png` placeholder (32x32 solid-navy) with the final NSI brand mark.
- **Why blocking:** Email branding QA-12 + QA-09 first booking will render this image. Placeholder shipping in production-grade QA dilutes confidence.
- **Who:** Andrew (asset is offline; Claude cannot procure).
- **Verification:** `curl -I https://calendar-app-xi-smoky.vercel.app/nsi-mark.png` returns 200 + `Content-Length` > placeholder bytes (placeholder is ~1KB; final mark is likely 2–10KB).

### Item 1: Phase 10 Plan 10-05 — Email-confirm toggle ON (5 ordered steps)

- **Source:** `MILESTONE_V1_1_DEFERRED_CHECKS.md` Phase 10 / Plan 10-05.
- **Pre-condition:** Production deploy current. Verify with:
  ```
  curl -i "https://calendar-app-xi-smoky.vercel.app/auth/confirm?token_hash=test&type=signup"
  # Expect 4xx (NOT 404). 404 means code not deployed; STOP.
  ```
- **Step 1:** Run `scripts/phase10-pre-flight-andrew-email-confirmed.sql` in Supabase SQL Editor (or `npx supabase db query --linked -f scripts/phase10-pre-flight-andrew-email-confirmed.sql`). Verify `email_confirmed_at IS NOT NULL` on `ajwegner3@gmail.com`. If null, uncomment + run the conditional UPDATE.
- **Step 2:** Supabase Dashboard → Authentication → Sign In / Up → "Enable email confirmations" → ON.
- **Step 3:** Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Add:
  - `http://localhost:3000/auth/confirm`
  - `https://calendar-app-xi-smoky.vercel.app/auth/confirm`
  - `https://calendar-app-*.vercel.app/auth/confirm` (verify Supabase accepts wildcard; otherwise enumerate active preview URLs)
- **Step 4:** Supabase Dashboard → Authentication → Email Templates. Replace ALL FOUR templates:
  - **Confirm signup:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding`
  - **Reset Password:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
  - **Magic Link:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
  - **Confirm Email Change:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`
- **Step 5:** Verify Andrew's login still works. Open production `/app/login`, sign in as `ajwegner3@gmail.com`. Should reach `/app` successfully.
- **Lockout-risk note:** Per CHECKS file: "The toggle flip itself is the manual gate that creates lockout risk. As long as the toggle stays OFF, Andrew cannot be locked out." Step 1 is the safety net.

### Item 2: Phase 10 Plan 10-09 — Test User 3 creation (4 steps)

- **Source:** `MILESTONE_V1_1_DEFERRED_CHECKS.md` Phase 10 / Plan 10-09.
- **Pre-condition:** Item 1 done (so user can in theory log in via the new email-confirm flow; but Step 1 below uses "Auto-confirm email: ON" so it doesn't actually require Item 1 — sequencing is for safety).
- **Step 1:** Supabase Dashboard → Authentication → Users → Add user → "Create new user":
  - Email: `nsi-rls-test-3@andrewwegner.example`
  - Password: strong; record it
  - Auto-confirm email: ON
  - Note the new user UUID
- **Step 2:** Supabase SQL Editor:
  ```sql
  -- Check if 10-03 trigger auto-created stub:
  SELECT id, slug, onboarding_complete FROM accounts WHERE owner_user_id = '{NEW_USER_UUID}';

  -- If stub exists with onboarding_complete=false: DELETE first
  -- DELETE FROM accounts WHERE owner_user_id = '{NEW_USER_UUID}' AND onboarding_complete = false;

  -- Then INSERT:
  INSERT INTO accounts (
    owner_user_id, owner_email, slug, name, timezone, onboarding_complete
  ) VALUES (
    '{NEW_USER_UUID}',
    'nsi-rls-test-3@andrewwegner.example',
    'nsi-rls-test-3',
    'NSI RLS Test 3',
    'America/Chicago',
    true
  );
  ```
  Note: column is `name` NOT `display_name` (per Plan 10-03 schema deviation, captured in STATE.md).
- **Step 3:** Add to `.env.test.local`:
  ```
  TEST_OWNER_3_EMAIL=nsi-rls-test-3@andrewwegner.example
  TEST_OWNER_3_PASSWORD={password from Step 1}
  ```
- **Step 4 (optional):** add to Vercel project env vars for CI parity.
- **Verification:**
  ```bash
  npx supabase db query --linked -c "SELECT slug, owner_email, name FROM accounts WHERE slug = 'nsi-rls-test-3';"
  npm test -- tests/rls-cross-tenant-matrix.test.ts
  # Expect: N=3 cases UN-skip; ~28-30 total cases pass
  ```

### Item 3: Three distinct branded test accounts ready (for QA-12)

- **Source:** Roadmap QA-12 success criterion + this research.
- **Three accounts to brand:**
  - **Account A — Andrew's NSI** (`slug=nsi`, owner=ajwegner3@gmail.com): leave at NSI defaults OR set the "navy combo" below.
  - **Account B — Test User 2** (`slug=nsi-rls-test`, owner=andrewjameswegner@gmail.com): set the "magenta combo" below.
  - **Account C — Test User 3** (`slug=nsi-rls-test-3`, owner=nsi-rls-test-3@andrewwegner.example): set the "neutral/null combo" below.
- **Recommended distinct combos** (chosen to maximize coverage of all 3 controls × shade × null behavior):

  | Account | brand_primary | background_color | background_shade | sidebar_color | What this exercises |
  |---------|---------------|------------------|------------------|---------------|---------------------|
  | A (NSI) | `#0A2540` | `#F8FAFC` | `subtle` | `#0A2540` | "Navy full-strength 3-color combo" — matches Phase 12.6 deferred item #1; full sidebar tint; subtle backdrop |
  | B (Test User 2) | `#EC4899` (magenta) | `#FDF2F8` (pink-50) | `bold` | `#EC4899` | Distinct hue; bold gradient; tests button accent (magenta) + switch on-state per Phase 12.6 deferred items #3 + #4 |
  | C (Test User 3) | `#22C55E` (emerald) | `null` | `none` | `null` | Null/clear regression path per Phase 12.6 deferred item #2; sidebar uses shadcn default; only brand_primary set; no backdrop |

- **How to apply (13-01 Task 5 — Supabase SQL):**
  ```sql
  -- Account A (NSI):
  UPDATE accounts
  SET brand_primary='#0A2540', background_color='#F8FAFC', background_shade='subtle', sidebar_color='#0A2540'
  WHERE slug='nsi';

  -- Account B (Test User 2):
  UPDATE accounts
  SET brand_primary='#EC4899', background_color='#FDF2F8', background_shade='bold', sidebar_color='#EC4899'
  WHERE slug='nsi-rls-test';

  -- Account C (Test User 3):
  UPDATE accounts
  SET brand_primary='#22C55E', background_color=NULL, background_shade='none', sidebar_color=NULL
  WHERE slug='nsi-rls-test-3';
  ```
  Verify with:
  ```sql
  SELECT slug, brand_primary, background_color, background_shade, sidebar_color
  FROM accounts WHERE slug IN ('nsi','nsi-rls-test','nsi-rls-test-3') ORDER BY slug;
  ```

### Item 4: QA-11 capacity=3 test event type ready

- **Source:** Roadmap QA-11 + Plan 11-07 + Phase 11 deferred item #4.
- **Pick an owner:** Test User 2 (`nsi-rls-test`) is the cleanest choice — keeps the capacity test event off Andrew's primary NSI account.
- **Procedure:** Log in as Test User 2 → `/app/event-types/new` → name="Capacity Test", slug="capacity-test", duration=30 min, max_bookings_per_slot=3, show_remaining_capacity=true. Set availability to allow at least the next 7 days (use defaults).
- **Verification:** Public page renders at `https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/capacity-test` with at least one slot in the next 7 days.

### Item 5: 13-CHECKLIST.md scaffolded

- See "Code Examples" §Checklist Scaffold below.

### Item 6: Production deploy is current

- **Verification:** Vercel Dashboard → calendar-app project → Deployments → latest deploy is green AND its commit SHA matches `git log origin/main -1 --format=%H`. Per `STATE.md` Session Continuity, latest commit at the start of Phase 13 should be `2dc5ae1` (or its successors).
- **Smoke:**
  ```
  curl -I https://calendar-app-xi-smoky.vercel.app/nsi
  # Expect 200; confirms /[account] route renders
  ```

---

## Per-Criterion Walkthrough Scripts

These are the verbatim `<how-to-verify>` block contents the planner should drop into Plan 13-02 tasks.

### QA-09 — End-to-end signup → email-verify → onboarding → first booking

**Pre-condition:** Items 1, 6 done. A throwaway email Andrew controls (e.g., `ajwegner3+phase13signup@gmail.com` via Gmail aliasing — Gmail aliasing was confirmed working in Phase 9; STATE.md has no contradiction).

**Steps:**
1. Open https://calendar-app-xi-smoky.vercel.app/app/signup in a fresh browser (or incognito).
2. Submit signup form with `ajwegner3+phase13signup@gmail.com` + a strong password. Expect: redirect to `/app/verify-email`.
3. Open Gmail web (`ajwegner3@gmail.com` inbox; `+phase13signup` aliased emails arrive there). Find the "Confirm your email" message from Supabase.
4. Click the confirmation link. Expect: routes through `/auth/confirm?token_hash=...&type=signup&next=/onboarding` and lands on `/onboarding/step-1-account`.
5. **Wizard step 1:** enter business name (e.g., "Phase 13 Test Co") + slug (e.g., "phase13-test"). Submit. Expect: routes to `/onboarding/step-2-timezone`.
6. **Wizard step 2:** confirm timezone auto-detected (browser default). Submit. Expect: routes to `/onboarding/step-3-event-type`.
7. **Wizard step 3:** keep the pre-filled "Consultation / 30 min" defaults. Submit. Expect: redirect to `/app` (dashboard).
8. **First-booking E2E:** open `https://calendar-app-xi-smoky.vercel.app/phase13-test/consultation` in a different browser session (or incognito). Pick a slot at least 1h out. Submit booking with a *different* email Andrew controls (e.g., `ajwegner3+phase13booker@gmail.com`).
9. Verify:
   - Booking-confirmation page renders without error.
   - Confirmation email arrives at `ajwegner3@gmail.com` (the `+phase13booker` aliased inbox).
   - Owner-notification email also arrives at `ajwegner3@gmail.com` (the new test owner is using `+phase13signup`, also routed to ajwegner3@gmail.com).
   - Both emails render branded header band (will use shadcn defaults since no branding set on this account yet — that's expected; QA-12 covers branded variants).

**PASS criteria:** Wizard completes without error AND first booking confirmation email arrives in inbox AND owner-notification arrives.

**Cleanup (post-marathon, capture in checklist):** Note this throwaway account in checklist for v1.2 hard-delete cron purge candidate (per FUTURE_DIRECTIONS.md §7 hard-delete entry). Soft-delete via `/app/settings/profile` Danger Zone is acceptable but optional.

**Resume-signal:** `qa-09 PASS` / `qa-09 FAIL: <step>: <detail>` / `qa-09 DEFERRED: <reason>`

### QA-10 — Multi-tenant UI isolation walkthrough

**Pre-condition:** Test User 2 password known (`TEST_OWNER_2_PASSWORD` in `.env.local`).

**Steps:**
1. Open a FRESH incognito window (no session leakage from QA-09 / Andrew login).
2. Sign in at `https://calendar-app-xi-smoky.vercel.app/app/login` as `andrewjameswegner@gmail.com` (Test User 2, slug `nsi-rls-test`).
3. After login, walk every dashboard surface and verify ZERO of Andrew's NSI data appears:

   | Surface | URL | Expected |
   |---------|-----|----------|
   | Home calendar | `/app` | Empty calendar OR only `nsi-rls-test` bookings (the QA-11 capacity test bookings, when they happen). NO bookings from Andrew's NSI. |
   | Event Types | `/app/event-types` | Only the QA-11 "Capacity Test" event (after Item 4); zero of NSI's event types (no qa-test, no Andrew's real types). |
   | Availability | `/app/availability` | Only Test User 2's rules (likely defaults from onboarding). |
   | Bookings list | `/app/bookings` | Empty OR only Test User 2's bookings. Zero of Andrew's NSI bookings. |
   | Branding | `/app/branding` | Test User 2's branding values (the magenta combo from Item 3). NOT Andrew's NSI navy. |
   | Settings → Profile | `/app/settings/profile` | Test User 2 email + name. NOT `ajwegner3@gmail.com`. |
   | Settings → Reminders | `/app/settings/reminders` | Test User 2 toggles (likely defaults). |

4. Log out via the user menu. Confirm session cleared (visiting `/app/bookings` after logout redirects to `/app/login`).

**PASS criteria:** All 7 surfaces show ZERO leakage of Andrew's `nsi` account data.

**Resume-signal:** `qa-10 PASS` / `qa-10 FAIL: <surface>: <leak detail>` / `qa-10 DEFERRED: <reason>`

### QA-11 — Capacity end-to-end (capacity=3; book 3; 4th rejected)

**Pre-condition:** Item 4 done (capacity=3 event live at `/nsi-rls-test/capacity-test`). Three browser sessions available (recommend: Chrome window 1, Chrome incognito, Firefox — to ensure separate sessions). A 4th window for the SLOT_CAPACITY_REACHED probe.

**Steps (from MILESTONE_V1_1_DEFERRED_CHECKS.md Phase 11 item #2 + roadmap QA-11):**
1. **Setup:** in each of 3 sessions, navigate to `https://calendar-app-xi-smoky.vercel.app/nsi-rls-test/capacity-test`. Pick the SAME slot in all 3 (don't submit yet).
2. **Book #1, #2, #3:** complete the booking form sequentially in sessions 1, 2, 3. Use distinct emails:
   - `ajwegner3+cap1@gmail.com`
   - `ajwegner3+cap2@gmail.com`
   - `ajwegner3+cap3@gmail.com`
3. Verify each succeeds. After session 2 books, session 3 should still see "1 spot left" badge (QA-11 also lightly verifies the CAP-08 remaining-capacity badge from Phase 11 deferred item #1).
4. **Book #4 (rejection probe):** open a 4th session (Chrome guest profile or different browser). Navigate to the same event page. The same slot should now be GONE from the picker (CAP-04 slot exclusion at `/api/slots`).
   - Alternative path to actually trigger SLOT_CAPACITY_REACHED in UI: in 2 sessions, fill the form for the same slot WITHOUT submitting; have one submit, then quickly the other submits. The second receives the 409 with `code=SLOT_CAPACITY_REACHED` and the booker UI banner reads "That time is fully booked. Please choose a different time." (per Phase 11 deferred item #2 SLOT_CAPACITY_REACHED path).
5. Verify slot-list refreshes after the 409 (the now-unavailable slot disappears from the picker per Phase 11 deferred item #2 step 3).

**PASS criteria:** 3 bookings succeed; 4th attempt is correctly rejected with `SLOT_CAPACITY_REACHED` banner copy ("fully booked"); slot picker self-refreshes after the error.

**Cleanup:** Note 3 confirmed bookings in capacity-test event. Andrew's call whether to clean up via Bookings → Cancel UI or leave for v1.2 cleanup cron.

**Resume-signal:** `qa-11 PASS` / `qa-11 FAIL: <book #N>: <detail>` / `qa-11 DEFERRED: <reason>`

### QA-12 — Branded UI smoke across 3 test accounts × 4 surfaces

**Pre-condition:** Item 3 done (3 accounts with the branding combos applied). Andrew has 3 separate sessions / browser profiles.

**The 4 surfaces × 3 accounts = 12 spot-checks. Plus per-account email triggers (3 emails) = 15 verifications total.**

**Steps:**

#### Surface 1 of 4 — Dashboard (`/app/branding` + `/app` chrome)

For EACH account (A=NSI, B=nsi-rls-test, C=nsi-rls-test-3):
1. Sign in as that account's owner.
2. `/app/branding`: verify the 3 pickers (Sidebar / Page background / Button & accent) show the configured colors. `MiniPreviewCard` faux-dashboard renders with all 3 color regions (per Phase 12.6 deferred item #6).
3. `/app`: verify in the live shell:
   - Sidebar background = `sidebar_color` (or shadcn default for Account C).
   - Page background = `background_color` with `background_shade` GradientBackdrop (or gray-50 default for Account C).
   - "Create event type" / row buttons = `brand_primary` color (Account A: navy, B: magenta, C: emerald).
   - WCAG contrast: sidebar text remains readable on each sidebar color.
4. Hard-refresh (Ctrl+Shift+R) to defeat any CSS cache.

#### Surface 2 of 4 — Public booking page (`/[account]/[event-slug]`)

For EACH account, open in incognito the public URL:
- A: `/nsi/qa-test` (or any existing event type — pick one with availability)
- B: `/nsi-rls-test/capacity-test` (Item 4)
- C: any event type Test User 3 owns (note: if none, this surface is N/A for Account C — log in checklist as "DEFERRED — no event types on Account C")

Verify:
- Page background = account's `background_color` with shade.
- "Confirm booking" CTA button = account's `brand_primary`.
- Logo header (if `logo_url` set) or account-name span fallback.

#### Surface 3 of 4 — Embed (`/embed/[account]/[event-slug]`)

For EACH account, open `/embed/<slug>/<event-slug>` directly. Verify:
- Single-circle gradient pattern (per Phase 12-05 lock; not 3-circle backdrop).
- Same brand_primary CTA color as public booking page.
- No horizontal overflow (Pitfall 10: EmbedHeightReporter measures correctly).

#### Surface 4 of 4 — Email (header band color)

For EACH account, trigger one real booking against that account's public booking page. Use the +alias inbox `ajwegner3+brandtest-{a,b,c}@gmail.com` so all 3 land in `ajwegner3@gmail.com`.

In Gmail web, open each confirmation email and verify:
- **Header band color** = `sidebar_color` (priority chain: `sidebarColor → brand_primary → DEFAULT`). For Account C (sidebar_color=null), expect brand_primary (emerald). For A and B, expect sidebar_color (navy / magenta).
- Header band has **NO gradient artifacts** (per Phase 12 deferred item #7 — solid-color-only).
- Logo top-centered when `logo_url` set; account-name span when null.
- "Powered by NSI" footer: text-only (NSI_MARK_URL=null in test env) OR shows nsi-mark.png (when production NEXT_PUBLIC_APP_URL is set — should be the real mark from Item 0 swap).

**PASS criteria:** All 12 surface × account spot-checks render correctly; all 3 emails show correct header band per the priority chain.

**FAIL handling:** Record which surface × account failed in checklist. Quick-patch loop applies if failure is fixable; otherwise DEFER with reason.

**Resume-signal:** `qa-12 PASS (12/12 surfaces + 3/3 emails)` / `qa-12 FAIL: <account>/<surface>: <detail>` / `qa-12 DEFERRED: <reason>`

### QA-13 — Embed snippet dialog widening at 320 / 768 / 1024

**Pre-condition:** Andrew is logged in as any account owner (any of A/B/C works — recommend A=NSI for fastest path) at `/app/event-types`.

**Steps:**
1. On `/app/event-types`, click any event type's kebab menu → "Get embed code" (the EmbedCodeDialog from Phase 12-05; widened to `sm:max-w-2xl` per UI-09 lock).
2. With the dialog OPEN, open Chrome DevTools (F12) → Toggle Device Toolbar (Ctrl+Shift+M).
3. Set viewport width to **320px**:
   - Verify the dialog renders WITHIN the viewport (no horizontal page scroll).
   - Verify the snippet `<textarea>` / code block does NOT overflow the dialog horizontally — code wraps OR the dialog itself scrolls vertically inside the viewport.
   - Verify the "Copy" button + "Close" button remain reachable (≥ 44px tap target).
4. Set viewport width to **768px** — repeat verifications.
5. Set viewport width to **1024px** — repeat verifications. At 1024 the dialog should be `max-w-2xl` (~672px) centered, not stretching full-width.
6. Reset DevTools "No override" when done.

**PASS criteria:** No horizontal page overflow and no content clipping at any of the 3 widths.

**Note on what "horizontal overflow" looks like:** the page or dialog body shows a horizontal scrollbar, OR text/code is clipped at the right edge (cut-off characters), OR the dialog extends past the viewport's right edge.

**Resume-signal:** `qa-13 PASS` / `qa-13 FAIL: <width>: <detail>` / `qa-13 DEFERRED: <reason>`

### QA-14 — Andrew explicit "ship v1.1" sign-off

**Pre-condition:** All of QA-09..QA-13 captured in `13-CHECKLIST.md` as PASS / DEFERRED. `FUTURE_DIRECTIONS.md` updated + committed (Plan 13-03 Task 2).

**Procedure (mirrors Phase 9 Plan 09-03 Task 3):**
1. Andrew reviews `13-CHECKLIST.md` — confirms every QA-09..QA-13 row is PASS or explicitly DEFERRED with reason captured.
2. Andrew reviews `FUTURE_DIRECTIONS.md` updated section 8 — confirms no surprises; everything Andrew is aware of as deferred is captured.
3. Andrew says "ship v1.1" (or equivalent: "approved", "sign off", "ship it").
4. Claude appends Sign-off section to `13-CHECKLIST.md`:
   ```markdown
   ## Sign-off

   - [x] Andrew reviewed 13-CHECKLIST.md and FUTURE_DIRECTIONS.md (§8)
   - [x] Andrew explicit verbal sign-off: "<actual phrasing>"
   - **Sign-off timestamp:** YYYY-MM-DD HH:MM TZ
   - **Sign-off commit:** <SHA after this entry is committed>
   ```
5. Claude commits with message `docs(13): Andrew sign-off — v1.1 shipped`. Pushes to origin/main.
6. v1.1 is officially shipped.

**Resume-signal:** `ship v1.1` (or equivalent) — OR list items still blocking.

### QA-15 — FUTURE_DIRECTIONS.md updated with v1.1 carry-overs

**Where:** `FUTURE_DIRECTIONS.md` at repo root (already exists with §1–§7).

**What to add:** A new `## 8. v1.1 Phase 13 — Marathon QA + Carry-overs` section. Mirror the existing `## 7. v1.1 Phase 10` section pattern.

**Required content (sourced from `13-CHECKLIST.md` once 13-02 completes):**
- Every DEFERRED row from QA-09..QA-13 with reason citation.
- Any Phase 11 deferred items NOT replayed during marathon (likely none if QA-11 is thorough; possibly the CAP-06 pg-driver test if Andrew chose to skip).
- Any Phase 12 deferred items NOT replayed (likely the Apple Mail-related items if no device access).
- Any Phase 12.6 items beyond #1–#7 that didn't get a green check (only #8 NSI mark — should be DONE before Phase 13 starts).
- Any net-new bugs or cosmetic issues Andrew flagged but chose to defer.
- The known v1.2 backlog items already in `STATE.md` "v1.2 backlog items captured during v1.1" list — append to §3 Future Improvements:
  - Hourly cron flip after Vercel Pro upgrade
  - `rate_limit_events` test DB cleanup
  - DROP `accounts.chrome_tint_intensity` after v1.1 release window
  - Remove `chromeTintToCss` compat export
  - Live cross-client email QA (Outlook desktop, Apple Mail iOS, Yahoo)

**Style invariants (per existing FUTURE_DIRECTIONS.md How to Use This File):**
- Audience = future Claude Code sessions, not human engineers / not marketing.
- Bullets are FACT statements with `Source:` citation (file path + line, OR commit SHA, OR `13-CHECKLIST.md` row reference).
- No marketing language ("seamless", "robust", "best-in-class"). No mention of features that aren't built.
- Each non-trivial bullet must answer "would a future Claude session need to know this to make a good decision?"

**4 sections required by project CLAUDE.md** (Andrew's global instructions): Known Limitations, Assumptions & Constraints, Future Improvements, Technical Debt. The existing FUTURE_DIRECTIONS.md already has these as §1–§4. Phase 13 update is INCREMENTAL — append to §1, §3, §4 as needed; §2 likely unchanged. Add the new dated `## 8. v1.1 Phase 13` section after §7.

---

## Deferred Check Replay Mapping

This is the tracking matrix the planner should use to make sure every deferred item from `MILESTONE_V1_1_DEFERRED_CHECKS.md` either gets replayed during Phase 13 OR is explicitly logged as a v1.2 carry-over in 13-03's FUTURE_DIRECTIONS.md update.

### Phase 10 (3 items) — all become 13-01 pre-flight tasks

| Source item | Replay during 13 | Where |
|-------------|------------------|-------|
| 10-05 P-A8 5-step pre-flight | YES | 13-01 Task 3 (5 sub-steps) — REQUIRED before marathon |
| 10-08 email-change E2E | OPPORTUNISTIC | If marathon time permits, Andrew can run; else 13-03 deferral. Not required for v1.1 ship per ROADMAP scope. |
| 10-09 Test User 3 creation | YES | 13-01 Task 4 — REQUIRED for QA-10 + QA-12 Account C |

### Phase 11 (4 items) — fold into QA-11 + log residuals

| Source item | Replay during 13 | Where |
|-------------|------------------|-------|
| 11-08 remaining-capacity badge live render | YES | QA-11 step 3 (sees "1 spot left" between bookings #2 and #3) |
| 11-08 409 message branching live trigger | YES | QA-11 step 4 (SLOT_CAPACITY_REACHED path — explicit) |
| 11-06 pg-driver race test execution (CAP-06) | OPTIONAL | One-time check; requires SUPABASE_DIRECT_URL env. Recommend Andrew defer to v1.2 post-ship — log in 13-03 §3 unless Andrew explicitly wants to run. |
| 11-07 CAP-09 over-cap modal manual smoke | OPPORTUNISTIC | Capacity-decrease modal — natural fold-in if Andrew has time at end of QA-11; log if skipped. |

### Phase 12 (10 items) — split between marathon-replays and FUTURE_DIRECTIONS deferrals

| Source item | Replay during 13 | Where |
|-------------|------------------|-------|
| #1 Inter font load | NO — captured by Phase 9; Phase 13 not retrying | n/a |
| #2 bg-gray-50 actual render | YES | QA-12 surface 1 (dashboard chrome — Account C with null background) |
| #3 Gradient backdrop visual sweep (none/subtle/bold) | YES | QA-12 — covered by 3 accounts × 3 distinct shades |
| #4 Live branding editor update | YES | QA-12 surface 1 step 3 (`/app/branding` MiniPreviewCard) |
| #5 Home tab calendar + Sheet drawer | OPPORTUNISTIC | Click a day during QA-09 first-booking verification; log if not exercised |
| #6 Auth pages split-panel responsive | OPPORTUNISTIC | Will be exercised during QA-09 signup form rendering at 320 / 768 / 1024 if Andrew probes; log if not |
| #7 Email branded header in real inbox | YES | QA-12 surface 4 (3 emails inspected) |
| #8 NSI mark image swap | YES | 13-01 Item 0 — HARD prerequisite |
| #9 EmbedCodeDialog sm:max-w-2xl at 3 viewports | YES | QA-13 |
| #10 Phase 11 regression live trigger (race + chrome) | YES | QA-11 plus QA-12 surface 1 (sidebar/page chrome doesn't break race banner copy) |

### Phase 12.5 (3 items) — regression-only

| Source item | Replay during 13 | Where |
|-------------|------------------|-------|
| #1 chrome_tint_intensity column unaffected | OPPORTUNISTIC | Implicitly verified by QA-12 not erroring; SQL spot-check optional |
| #2 FloatingHeaderPill removal regression | OPPORTUNISTIC | Andrew confirms during QA-12 surface 1 dashboard walk |
| #3 Mobile hamburger trigger | OPPORTUNISTIC | At 320px during QA-13 or QA-12 |

### Phase 12.6 (8 items) — items #1–#7 already live-verified 2026-04-29

| Source item | Replay during 13 | Where |
|-------------|------------------|-------|
| #1–#7 | NO — already approved 2026-04-29 (per `MILESTONE_V1_1_DEFERRED_CHECKS.md` final note + STATE.md) | Log as "verified 2026-04-29 deploy approval" in 13-CHECKLIST |
| #8 NSI mark asset swap | YES | 13-01 Item 0 — same item as Phase 12 #8 |

---

## Common Pitfalls

### Pitfall 1: Email-confirm toggle flipped before pre-flight SQL → Andrew locked out

**What goes wrong:** Pre-flight Step 1 SQL is skipped or fails silently; Step 2 toggles the flag; Andrew's `email_confirmed_at` is null; next login gets "Email not confirmed" error.

**Why it happens:** Steps 1–5 must run in strict order. Any Step 1 failure (e.g., SQL Editor permissions) is silent unless you check the SELECT result.

**How to avoid:** Plan 13-01 Task 3 must be a `<task type="checkpoint:human-action" gate="blocking">`. The `<resume-signal>` should require Andrew to paste the result of the SELECT query (or affirm "Andrew's email_confirmed_at is set").

**Warning signs:** Andrew can't log in to production. Mitigation: rerun Step 1 SQL with the conditional UPDATE uncommented.

### Pitfall 2: Marathon QA runs before deploy is current → false negatives

**What goes wrong:** QA-12 Account C is null-shipped without sidebar_color; tester sees a regression that's actually just stale CDN/Vercel cache.

**Why it happens:** Phase 12.6 commits ship to main, but a previous deploy is still serving. Or Andrew is testing in a tab that has cached the previous bundle.

**How to avoid:** 13-01 Task 2 verification step (`curl -i /app/branding` returns 200; commit SHA matches `git log origin/main -1 --format=%H`). Hard-refresh (Ctrl+Shift+R) at start of every QA task.

**Warning signs:** A surface "doesn't have" a feature that's clearly committed in `git log`.

### Pitfall 3: Test users dirty production data without cleanup → noise compounds across QA cycles

**What goes wrong:** QA-09's throwaway signup leaves an `auth.users` row + `accounts` stub. QA-11's 3 capacity bookings sit on `bookings` table. Future Phase 13 reruns (e.g., for a v1.1 patch release) accumulate.

**Why it happens:** Phase 13 has no "cleanup" plan — STATE.md confirms there's no hard-delete cron in v1.1.

**How to avoid:**
- Capture every test artifact's slug/ID/email in `13-CHECKLIST.md` "Test artifacts created" section.
- Document the cleanup procedure (soft-delete via Profile Danger Zone OR direct SQL DELETE) in FUTURE_DIRECTIONS.md §8.
- Recommend running cleanup AFTER sign-off so any live re-test during Andrew's review doesn't lose state.

**Warning signs:** Future Phase 13 reruns show duplicate-slug collisions on signup.

### Pitfall 4: Gmail SMTP quota cap blocks QA emails mid-marathon

**What goes wrong:** Phase 10's `email_send_log` 200/day cap is hit during heavy QA send activity. Bookings stop sending confirmation emails; QA-09 / QA-12 fail with no inbox arrival.

**Why it happens:** QA-12 alone triggers 3 confirmation + 3 owner-notification = 6 sends. QA-09 = 2 sends. QA-11 = 6 sends (3 booker + 3 owner). Total ~14 sends just from marathon. Plus prior QA test sends, signup verification email, etc.

**How to avoid:**
- Quota is 200/day per `lib/email-sender/quota-guard.ts` — well above 14, but monitor. Andrew should run `SELECT count(*) FROM email_send_log WHERE created_at >= now() - interval '24 hours'` mid-marathon if any send fails.
- If quota approached during QA: 80% threshold logs `[GMAIL_SMTP_QUOTA_APPROACHING]` once/day. Check Vercel function logs for this signal.
- BOOKINGS / REMINDERS bypass quota (per STATE.md Phase 10 ARCH DECISION #2: "Booking/reminder paths bypass guard"). Only signup-side emails are capped. So QA-11 and QA-12 booking sends are NOT quota-affected; only QA-09 signup confirmation hits the cap.

**Warning signs:** Signup verification email never arrives. Check `email_send_log` for blocked rows and `QuotaExceededError` in Vercel logs.

### Pitfall 5: Browser cache masks CSS regressions → false PASS on QA-12

**What goes wrong:** Andrew sets new branding values for Account B but the public page renders previous values from CDN cache; logs PASS.

**Why it happens:** Tailwind/Next.js asset hashes change with deploys but `/app/branding` SQL UPDATE doesn't trigger a redeploy — the data refreshes, but DOM may still hold previous server-side render until a full reload.

**How to avoid:** Hard-refresh (Ctrl+Shift+R or Cmd+Shift+R) at every surface check in QA-12. For public pages and embeds, open in incognito to defeat any session-related cache. Plan 13-02 task `<how-to-verify>` blocks should explicitly include "hard-refresh before observation."

**Warning signs:** A branding value just SQL-set "doesn't appear"; values from minutes ago still visible.

### Pitfall 6: Cancelling test bookings mid-marathon corrupts subsequent QA state

**What goes wrong:** Andrew cancels a QA-11 booking to "clean up" partway, but QA-12 is still running and references that same event_type. Subsequent QA-12 surface checks fail unexpectedly.

**Why it happens:** Marathon is a stateful session; cancellations propagate through `bookings.status='cancelled'` and may free slots, change visible counts, etc.

**How to avoid:** Capture all cleanup actions until AFTER QA-14 sign-off. The 13-03 plan should include a final "Cleanup test artifacts" task as the LAST thing before sign-off.

### Pitfall 7: "Auto-confirm email: ON" on Test User 3 creation skips the live email-confirm path

**What goes wrong:** Test User 3 is auto-confirmed via Supabase Dashboard. QA-10 walks fine (login works). But this means NO live verification of the new email-confirm flow happened for Test User 3 — only QA-09's throwaway user exercises that path.

**Why it happens:** Phase 10 Plan 10-09 deferred procedure explicitly says "Auto-confirm email: ON" because the goal is RLS testing, not signup-flow testing.

**How to avoid:** This is intentional. QA-09 covers the signup→verify path with a real fresh user. QA-10 only needs Test User 3 logged in, no signup-flow re-test required.

### Pitfall 8: Phase 12.6 NSI mark swap deferred → emails ship with placeholder during QA

**What goes wrong:** 13-01 Item 0 is skipped or postponed; QA-12 surface 4 inbox checks see the 32x32 solid-navy placeholder rendered for "Powered by NSI" footer.

**Why it happens:** Asset is offline; Andrew may not have it ready Day 1.

**How to avoid:** 13-01 Task 1 is a HARD blocking checkpoint — NSI mark must be in `/public/nsi-mark.png` before marathon starts. If Andrew doesn't have the final asset, escalate as blocker in 13-01; do NOT proceed to 13-02 with placeholder.

**Warning signs:** Email footer shows a tiny solid-color square instead of a recognizable mark.

---

## Code Examples

### Checklist Scaffold (Plan 13-01 Task 7 creates this file)

Drop this verbatim into `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md`:

```markdown
# Phase 13 Manual QA Checklist

**Session start:** [TIMESTAMP — fill at start of Plan 13-02]
**Driver:** Andrew (executor) + Claude (proposer / scribe)
**Pass bar:** Strict by default. Any QA item may be downgraded to "deferred to v1.2" by Andrew at the time of surface — captured in the Notes column and propagated to FUTURE_DIRECTIONS.md §8.

## Pre-flight (Plan 13-01 artifacts)

- [ ] Item 0: NSI mark asset swap done (Phase 12.6 deferred #8)
- [ ] Item 1: Phase 10 Plan 10-05 5-step sequence complete (email-confirm toggle ON; Andrew login still works)
- [ ] Item 2: Test User 3 created in auth.users + accounts row INSERTed (Phase 10 Plan 10-09)
- [ ] Item 3: 3 distinct branding profiles applied to nsi / nsi-rls-test / nsi-rls-test-3
- [ ] Item 4: capacity=3 "Capacity Test" event type live on `/nsi-rls-test/capacity-test`
- [ ] Item 5: 13-CHECKLIST.md scaffolded
- [ ] Item 6: Production deploy current (commit SHA: ___)

## Marathon Criteria (Plan 13-02)

| # | Criterion | Status | Timestamp | Notes |
|---|-----------|--------|-----------|-------|
| QA-09 | Signup → email-verify → onboarding wizard → first booking E2E | __ | __ | __ |
| QA-10 | Multi-tenant UI isolation (login as Test User 2, ZERO of Andrew's data on 7 surfaces) | __ | __ | __ |
| QA-11 | Capacity=3 E2E (3 succeed, 4th SLOT_CAPACITY_REACHED) | __ | __ | __ |
| QA-12 | 3-account branded smoke × 4 surfaces (12 spot-checks + 3 emails = 15 total) | __ | __ | __ |
| QA-13 | EmbedCodeDialog at 320 / 768 / 1024 (no horizontal overflow) | __ | __ | __ |

## QA-12 Sub-table (3 accounts × 4 surfaces + 3 emails)

| Account | Dashboard | Public booking | Embed | Email header band |
|---------|-----------|----------------|-------|-------------------|
| A — nsi (navy combo) | __ | __ | __ | __ |
| B — nsi-rls-test (magenta combo) | __ | __ | __ | __ |
| C — nsi-rls-test-3 (null combo) | __ | __ | __ | __ |

## Deferred Check Replays (from MILESTONE_V1_1_DEFERRED_CHECKS.md)

| Source phase / item | Replay outcome | Notes |
|---------------------|----------------|-------|
| Phase 10 / 10-05 (5-step) | __ | Item 1 above |
| Phase 10 / 10-08 email-change E2E | __ | (opportunistic) |
| Phase 10 / 10-09 Test User 3 | __ | Item 2 above |
| Phase 11 / 11-08 capacity badge | __ | (folds into QA-11) |
| Phase 11 / 11-08 409 branching | __ | (folds into QA-11) |
| Phase 11 / 11-06 pg-driver race | __ | (optional) |
| Phase 11 / 11-07 CAP-09 modal | __ | (opportunistic) |
| Phase 12 / 10 items | __ | (mostly fold into QA-09/12/13) |
| Phase 12.5 / 3 items | __ | (regression confirmations only) |
| Phase 12.6 / NSI mark swap | __ | Item 0 above |

## Test Artifacts Created During Marathon

*Capture every test signup, test booking, test event_type for cleanup post-sign-off*

- Throwaway signup user: ___ (slug: ___)
- QA-11 bookings: ___ (event_type_id: ___; 3 booker emails: ___)
- QA-12 trigger bookings: ___

## Deferrals to v1.2

*Any criterion downgraded by Andrew during the session — captured here with reason*

## Sign-off

- [ ] Andrew reviewed 13-CHECKLIST.md and FUTURE_DIRECTIONS.md §8
- [ ] Andrew explicit verbal sign-off ("ship v1.1")
- **Sign-off timestamp:** __
- **Sign-off commit:** __
```

### FUTURE_DIRECTIONS.md §8 Skeleton (Plan 13-03 Task 1)

Append to existing `FUTURE_DIRECTIONS.md` (after §7):

```markdown
---

## 8. v1.1 Phase 13 — Marathon QA + Carry-overs

*Added [DATE], Plan 13-03. Items deferred from Phase 13 marathon QA to v1.2 backlog.*

- **[Each DEFERRED row from 13-CHECKLIST.md becomes a bullet here.]**
  - Source: `13-CHECKLIST.md` row [QA-NN]
  - Reason deferred: [verbatim from Andrew]
  - Recommended v1.2 action: [if known]

- **Test artifacts persisting in production after v1.1 ship.** [List throwaway signup + capacity-test bookings + any other test data; include cleanup recommendation]
  - Source: `13-CHECKLIST.md` Test Artifacts section.
  - Cleanup procedure: [SQL or UI flow]

- **v1.2 backlog items captured during v1.1** (also tracked in STATE.md Session Continuity):
  - Hourly cron flip after Vercel Pro upgrade (currently `0 13 * * *` daily on Hobby).
  - `rate_limit_events` test DB cleanup (4 transient bookings-api.test.ts failures).
  - DROP `accounts.chrome_tint_intensity` after v1.1 release window (Phase 12.5 leftover).
  - Remove `chromeTintToCss` compat export (Phase 12.5 leftover; only Phase 12.5 tests still import).
  - Live cross-client email QA (Outlook desktop, Apple Mail iOS, Yahoo) — deferred since v1.0.
  - EMAIL-08 SPF/DKIM/DMARC + mail-tester (re-deferred per ROADMAP scope-not-in-Phase-13).
  - QA-01..QA-06 v1.0 marathon items (re-deferred).
```

---

## State of the Art

Not applicable — no library / framework state to track. Internal project state is captured in `STATE.md` lines 1–266 (read-only reference for the planner).

**Two state items the planner must respect verbatim:**

| Lock | Source |
|------|--------|
| Phase 12.6 deferred items #1–#7 are ALREADY live-verified per Andrew 2026-04-29 — do NOT re-test | `MILESTONE_V1_1_DEFERRED_CHECKS.md` Phase 12.6 final note |
| `accounts` schema column is `name` NOT `display_name` | STATE.md "sendWelcomeEmail uses accounts.name column" Plan 10-06 line; Plan 10-09 Step 2 SQL |

---

## Open Questions

### 1. Should QA-09's throwaway test signup be cleaned up before or after sign-off?

**What we know:** v1.1 has soft-delete (`/app/settings/profile` Danger Zone) but no hard-delete cron. Throwaway user persists indefinitely.

**What's unclear:** Whether to soft-delete during marathon (cleaner Bookings list for Andrew's NSI account) vs after sign-off (keeps state stable for re-test).

**Recommendation:** Defer cleanup to AFTER QA-14 sign-off. Plan 13-03 Task 5 (new) = "Soft-delete throwaway QA-09 test account; capture in CHECKLIST." This preserves marathon state through sign-off review.

### 2. Does QA-12 require a logo on each test account, or is null-logo (text-only fallback) sufficient?

**What we know:** Phase 12 logo upload is PNG-only ≤2MB. Logo column is `accounts.logo_url`; null = text-only "Powered by NSI" footer per `branding-blocks.ts:44`. None of the 3 test accounts have a logo set unless Andrew uploads one.

**What's unclear:** ROADMAP QA-12 says "render correctly" — implicitly includes the no-logo fallback. Phase 12 already verified the null-logo path at code level.

**Recommendation:** Skip per-account logo upload — verify the null-logo text-only path on all 3 accounts. Saves 3 logo upload steps + reduces "did the upload corrupt the asset?" debug surface. If Andrew wants logo coverage, add ONE logo upload to Account A (NSI) only and verify on its 4 surfaces; Accounts B and C stay null.

### 3. Should QA-11's `pg-driver-race-test` (Phase 11 deferred item #3) be run during marathon?

**What we know:** Test requires `SUPABASE_DIRECT_URL` in `.env.local` (port 5432, NOT 6543). Skip-guarded; CI passes without it. Plan 11-06 deferred this; estimate is "5-10 min including env setup." It tests the same race condition that QA-11 step 4 covers at the UI layer.

**What's unclear:** Marathon time budget. If Andrew has the direct URL handy, +5 min; if not, +20 min for Supabase Dashboard navigation + env file edits.

**Recommendation:** Plan 13-02 makes this an OPTIONAL marathon task (not blocking). If Andrew chooses to run, do it AFTER QA-11 (so QA-11 itself doesn't get blocked on env setup). Otherwise log as "deferred; covered at UI layer by QA-11" in FUTURE_DIRECTIONS.md §8.

### 4. Does Andrew want the marathon to span one session or split across days?

**What we know:** Phase 9 marathon was a single session (2026-04-27); Andrew has historical preference for marathon-style (per Phase 9 CONTEXT). v1.1 has more surface area (5 capability phases vs 8 for v1.0 but smaller per-phase scope).

**What's unclear:** Estimated 3–6 hours wall time depending on email arrival latency, refresh cycles, etc.

**Recommendation:** Plan 13-02 as a single session by default. If Andrew flags fatigue, the checklist's PASS/FAIL state is durable across sessions — Plan 13-02 can pause at any QA-NN boundary and resume.

---

## Sources

### Primary (HIGH confidence)

- `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md` (full file, 290 lines, 21 deferred items inventoried)
- `.planning/ROADMAP.md` lines 222–243 (Phase 13 section)
- `.planning/REQUIREMENTS.md` lines 105–111 (QA-09..QA-15 verbatim) and 121, 223–229
- `.planning/STATE.md` (full, 265 lines — STATE invariants + locked decisions + Session Continuity for Phase 13 resume guidance)
- `.planning/phases/09-manual-qa-and-verification/09-01-pre-qa-prerequisites-and-pre-flight-fixes-PLAN.md` (template for 13-01 — frontmatter shape, must_haves block, checkpoint-task pattern)
- `.planning/phases/09-manual-qa-and-verification/09-02-marathon-qa-execution-PLAN.md` (template for 13-02 — execution_pattern block, per-criterion task shape, resume-signal phrasing)
- `.planning/phases/09-manual-qa-and-verification/09-03-future-directions-and-sign-off-PLAN.md` (template for 13-03 — FUTURE_DIRECTIONS.md authoring task, sign-off task shape)
- `FUTURE_DIRECTIONS.md` (existing 242-line file at repo root — §1–§7 in place; §8 to be added)
- User-provided phase context block (Andrew's own enumeration of pre-flight items, test data needs, viewport approach, sign-off mechanics, pitfalls)

### Secondary (MEDIUM confidence)

- `~/.claude/CLAUDE.md` global instructions (4-section FUTURE_DIRECTIONS.md mandate; manual-QA-as-final-phase mandate; testing-is-live mandate; Vercel deploy after every push mandate)

### Tertiary (LOW confidence)

- *None used.* No WebSearch performed; this is purely internal project research and no library/framework decisions are at stake.

---

## Metadata

**Confidence breakdown:**
- 3-plan structure: HIGH — Phase 9 is the explicit template referenced in ROADMAP "~2-3 plans (... mirroring Phase 9 structure)"; all 3 source plans read in full.
- Pre-flight inventory: HIGH — every item sourced from `MILESTONE_V1_1_DEFERRED_CHECKS.md` with line references.
- QA walkthroughs: HIGH — derived from ROADMAP success criteria + REQUIREMENTS.md verbatim entries + STATE.md feature locks; no novel inference.
- Pitfalls: HIGH — derived from STATE.md locked decisions, deferred-checks file pre-conditions, and CLAUDE.md constraints; verified against project history.
- 3 branding combos for QA-12: MEDIUM — combos are RECOMMENDED based on coverage analysis; planner / Andrew may swap to alternative hex values without affecting verification semantics. The CHOICE of combos is Claude's discretion per ROADMAP "Standard manual QA — no decisions required" — the planner can adjust if Andrew prefers different hex values.

**Research date:** 2026-04-29
**Valid until:** Until Phase 13 marathon completes (project-internal research; no external freshness decay). If Phase 12.6 re-opens or Phase 13 splits into sub-phases, this file requires update.
