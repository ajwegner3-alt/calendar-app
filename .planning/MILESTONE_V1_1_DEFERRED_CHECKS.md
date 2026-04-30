# v1.1 Deferred Manual Checks

Per Andrew 2026-04-28: all manual / human-action checkpoints during Phase 10–13 execution are **deferred to milestone end** (Phase 13 manual QA). Execute-phase orchestrator skips the Supabase Dashboard / live-verification gates and continues forward; this file captures the queued actions so they can be replayed in one batch before v1.1 ship.

**Order matters when replaying** — items are listed in the order they were generated during execution. Some items have prerequisites (e.g., must deploy code before running pre-flight SQL).

---

## Phase 10 — Plan 10-05 — P-A8 Pre-flight + Supabase Dashboard Config

**Source:** `.planning/phases/10-multi-user-signup-and-onboarding/10-05-signup-page-and-email-confirm-toggle-PLAN.md` Task 1 (autonomous=false).
**Pre-flight SQL file:** `scripts/phase10-pre-flight-andrew-email-confirmed.sql`
**Pre-condition:** Phase 10 commits must be deployed to Vercel production. Verify via:
```
curl -i "https://<prod>/auth/confirm?token_hash=test&type=signup"
# Expect 4xx, NOT 404. 404 = code not deployed; STOP.
```

**Five steps to execute (in order):**

1. **Run the pre-flight SQL** in Supabase SQL Editor (or `npx supabase db query --linked -f scripts/phase10-pre-flight-andrew-email-confirmed.sql`):
   ```sql
   select id, email, email_confirmed_at, created_at
   from auth.users
   where email = 'ajwegner3@gmail.com';
   ```
   - Expected: `email_confirmed_at` is NOT NULL.
   - If NULL: uncomment the conditional UPDATE in the SQL file, run it, then re-SELECT to verify.

2. **Enable email confirmations.** Supabase Dashboard → Authentication → Sign In / Up → "Enable email confirmations" → ON.

3. **Whitelist redirect URLs.** Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Add:
   - `http://localhost:3000/auth/confirm`
   - `https://<vercel-prod-domain>/auth/confirm`
   - `https://calendar-app-*.vercel.app/auth/confirm` (verify Supabase accepts the wildcard; otherwise enumerate active preview URLs)

4. **Update email templates** (Authentication → Email Templates). Replace legacy `{{ .ConfirmationURL }}` with token-hash pattern:
   - **Confirm signup:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding`
   - **Reset Password:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
   - **Magic Link:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
   - **Confirm Email Change:** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`

5. **Verify Andrew's login still works.** Log in at production `/app/login` as `ajwegner3@gmail.com` post-toggle. Should reach `/app` successfully (he has an existing accounts row with `onboarding_complete=true` per 10-03).

**Why deferred:** The toggle flip itself is the manual gate that creates lockout risk. As long as the toggle stays OFF, Andrew cannot be locked out. Other Phase 10 plans (signup, wizard, profile settings) ship code that EXPECTS the toggle to be ON, but they will not be exercised in production until milestone-end QA — at which point Andrew runs all five steps in one sitting.

**Light-weight verification during Phase 10 execution:** later phases that depend on email-confirm being ON (signup E2E test, etc.) will be marked as deferred-to-milestone-end where they hit this dependency.

---

---

## Phase 10 — Plan 10-08 — Email-Change E2E Verification

**Source:** `.planning/phases/10-multi-user-signup-and-onboarding/10-08-email-change-with-reverification-PLAN.md` Task 2 verification.

**Pre-condition:** Plan 10-05 deferred items (email confirm toggle ON, Supabase URL config, email templates) must be completed first, AND the "Confirm Email Change" template must use the token-hash pattern (already listed in the 10-05 deferred steps above).

**Steps to execute (in order):**

1. **Log in** as a test user at `https://<prod>/app/login`.

2. **Navigate** to `/app/settings/profile` and confirm the "Change email" link is active (not "(coming soon)").

3. **Visit** `/app/settings/profile/email`. Verify the page shows the current email address and the request form.

4. **Submit a new email address.** The form should return the generic success message:
   > "If that email address is available, you will receive a confirmation link. Your email won't change until you click it."

5. **Check the NEW email inbox** for a confirmation link from Supabase.

6. **Click the confirmation link.** Verify it routes through `/auth/confirm?token_hash=...&type=email_change` (the 10-02 handler).

7. **After redirect**, confirm you land on `/app/settings/profile` (the `next` param set by the action).

8. **Verify both columns updated:**
   - In Supabase Dashboard → Auth → Users: `email` column updated for the test user.
   - In Supabase Dashboard → Table Editor → accounts: `owner_email` column updated (via the `sync_account_email_on_auth_update` trigger from the 10-08 migration).

9. **Rate-limit burst test:** Attempt 4 email-change requests within 1 hour. The 4th request should return "Too many email-change attempts. Please wait an hour before trying again."

10. **Restore:** If using a throwaway test user, no cleanup needed. If using Andrew's NSI account, repeat steps 3–7 to change back to `ajwegner3@gmail.com`.

**Why deferred:** Requires email confirm toggle to be ON (10-05 deferred item) plus a live email inbox to click the confirmation link. Cannot be automated in code-level testing.

---

## Phase 10 — Plan 10-09 — RLS Test User 3 Creation

**Source:** `.planning/phases/10-multi-user-signup-and-onboarding/10-09-rls-matrix-extension-and-checklist-PLAN.md` Task 1 (checkpoint:human-action).

**Why deferred:** Per Andrew 2026-04-28, all human-action checkpoints across Phase 10–13 are batched for milestone-end QA. The N=3 RLS matrix test code is committed and skips gracefully when `TEST_OWNER_3_EMAIL`/`PASSWORD` are absent. These steps enable the full N=3 run locally.

**Pre-condition:** Phase 10 code fully deployed.

**Steps to execute (in order):**

1. **Supabase Dashboard → Authentication → Users → Add user → "Create new user":**
   - Email: `nsi-rls-test-3@andrewwegner.example`
   - Password: pick a strong password (record it for step 3).
   - Auto-confirm email: **ON**.
   - Note the new user's UUID (visible after creation in the Users table).

2. **Supabase SQL Editor** — seed the matching `accounts` row (or UPDATE if the 10-03 provisioning trigger already created a stub):
   ```sql
   -- First check if a stub row was auto-created by the trigger:
   SELECT id, slug, onboarding_complete
   FROM accounts
   WHERE owner_user_id = '{NEW_USER_UUID_FROM_STEP_1}';

   -- If no row exists → INSERT:
   INSERT INTO accounts (
     owner_user_id,
     owner_email,
     slug,
     name,
     timezone,
     onboarding_complete
   ) VALUES (
     '{NEW_USER_UUID_FROM_STEP_1}',
     'nsi-rls-test-3@andrewwegner.example',
     'nsi-rls-test-3',
     'NSI RLS Test 3',
     'America/Chicago',
     true
   );

   -- If a stub row EXISTS (onboarding_complete=false, slug=null):
   -- Delete it first, then re-INSERT above:
   -- DELETE FROM accounts WHERE owner_user_id = '{NEW_USER_UUID_FROM_STEP_1}' AND onboarding_complete = false;
   ```
   Note: the column is `name` (NOT `display_name`) per the 10-03 schema deviation.

3. **Local `.env.test.local`** (or wherever `TEST_OWNER_2_EMAIL` is set — check `tests/helpers/auth.ts`) — add:
   ```
   TEST_OWNER_3_EMAIL=nsi-rls-test-3@andrewwegner.example
   TEST_OWNER_3_PASSWORD={password from step 1}
   ```

4. **Optionally add to Vercel project env vars** (for CI parity) the same `TEST_OWNER_3_EMAIL` + `TEST_OWNER_3_PASSWORD` pair. The matrix test is `describe.skipIf(!hasThreeUsers)` so omitting CI is acceptable — tests skip in CI but run locally for Andrew.

**Verification after completing steps:**
```bash
# Confirm accounts row:
npx supabase db query --linked -c "SELECT slug, owner_email, name FROM accounts WHERE slug = 'nsi-rls-test-3';"

# Run the extended N=3 matrix test locally:
npm test -- tests/rls-cross-tenant-matrix.test.ts
# Expect: all new N=3 cases pass (approx 28-30 total cases).
```

---

## Phase 11 — Plan 11-08 — Remaining-Capacity Badge Live Render

**Source:** `11-VERIFICATION.md` human-verification item 1 (CAP-08 booker UI).

**Pre-condition:** Phase 11 deployed. At least one event type with `show_remaining_capacity=true` and `max_bookings_per_slot > 1`.

**Steps:**

1. Log in as the owner. Navigate to `/app/event-types/{id}/edit` for an existing event type.
2. Set `Max bookings per slot` to a value > 1 (e.g., 3). Toggle `Show remaining capacity to bookers` ON. Save.
3. Visit the public booking page: `https://<prod>/<account-slug>/<event-slug>`.
4. Confirm each available slot button renders an "X spots left" / "1 spot left" sub-label.
5. Toggle the owner-side switch OFF and re-save. Re-visit the booking page; confirm the badge no longer renders.

---

## Phase 11 — Plan 11-08 — 409 Message Branching Live Trigger

**Source:** `11-VERIFICATION.md` human-verification item 2 (CAP-07 booker UI).

**Pre-condition:** Phase 11 deployed. Two browser sessions / incognito windows.

**Steps:**

1. **SLOT_TAKEN path (capacity=1):** create or pick a capacity=1 event type. In Browser A, fill the booking form for slot S; do NOT submit. In Browser B, complete a booking for slot S. Then submit Browser A's form. Confirm the banner reads "That time was just taken by another booker. Please choose a different time."
2. **SLOT_CAPACITY_REACHED path (capacity≥2):** create a capacity=2 event type. In two browser sessions complete bookings for slot S in parallel — both succeed. In a third session, attempt to book the same slot S. Confirm the banner reads "That time is fully booked. Please choose a different time."
3. Confirm both error paths trigger a slot-list refresh — the now-unavailable slot disappears from the picker after the error.

---

## Phase 11 — Plan 11-06 — pg-Driver Race Test Execution (CAP-06)

**Source:** `11-VERIFICATION.md` human-verification item 3 (CAP-06 race-safety proof at pg-driver layer).

**Pre-condition:** Phase 11 deployed. Local clone of the repo with `npm install` complete. The CAP-06 describe block in `tests/race-guard.test.ts` is `describe.skipIf(!hasDirectUrl())`.

**Steps:**

1. **Get the direct connection string** from Supabase Dashboard → Project (`mogfnutxrrbtvnaupoun`) → Project Settings → Database → Connection string → **Direct connection** (port 5432, NOT 6543). Format: `postgresql://postgres.{ref}:{pwd}@db.{ref}.supabase.co:5432/postgres`.
2. Add to `.env.local`:
   ```
   SUPABASE_DIRECT_URL=postgresql://postgres.mogfnutxrrbtvnaupoun:<password>@db.mogfnutxrrbtvnaupoun.supabase.co:5432/postgres
   ```
3. Run the focused test:
   ```bash
   npm run test -- race-guard.test.ts
   ```
4. Expected: the CAP-06 describe block UN-skips. Both `it()` cases pass:
   - capacity=3, 10 concurrent pg-driver INSERTs → exactly 3 succeed, 7 exhaust capacity.
   - capacity=1, 5 concurrent pg-driver INSERTs → exactly 1 succeeds, 4 exhaust capacity.
5. Confirm cleanup ran: each test deletes its own bookings in a `finally` block. Spot-check via Supabase SQL Editor:
   ```sql
   SELECT count(*) FROM bookings WHERE booker_email LIKE 'pg-race-%@test.local' OR booker_email LIKE 'pg-cap1-%@test.local';
   ```
   Expected: 0.

**Why deferred:** Requires user-only access to Supabase Dashboard credentials. Skip-guard keeps CI green; live execution is a one-time milestone-end check.

---

## Phase 11 — Plan 11-07 — CAP-09 Over-Cap Confirmation Modal Manual Smoke

**Source:** `11-VERIFICATION.md` human-verification item 4 (CAP-09 form behavior).

**Pre-condition:** Phase 11 deployed. An event type with at least 2 confirmed FUTURE bookings at the SAME `start_at` slot (capacity ≥ 2 to allow them).

**Steps:**

1. Set up: create or pick a capacity=3 event type. Use two browser sessions to book the same future slot twice (creates 2 confirmed bookings at one `(event_type_id, start_at)` pair).
2. Owner UI: navigate to `/app/event-types/{id}/edit` for that event type.
3. Decrease `Max bookings per slot` from 3 to 1. Click Save.
4. **Confirm the AlertDialog appears** with:
   - Title: "Reduce capacity to 1?"
   - Description naming the affected-slot count (1 future slot has 2 bookings) + worst-affected count (2).
   - Two buttons: "Cancel" and "Reduce capacity anyway".
5. Click "Cancel" — modal closes, capacity remains at 3 (verify by re-loading the page).
6. Repeat steps 3–4. This time click "Reduce capacity anyway".
7. Confirm a success toast appears and capacity is now 1.
8. Verify in Supabase SQL Editor:
   ```sql
   SELECT max_bookings_per_slot FROM event_types WHERE id = '<event-type-id>';
   ```
   Expected: 1. The 2 over-cap confirmed bookings are NOT cancelled — they remain on the books (modal warned this would happen).

**Cleanup:** delete the test bookings or restore the event type's capacity per Andrew's preference.

---

## Phase 12 — Branded UI Overhaul (10 deferred items)

Source: `.planning/phases/12-branded-ui-overhaul/12-VERIFICATION.md`. All 5/5 must_haves and 20/20 requirements verified at code level. Items below are inherently browser/email-client checks.

1. **Inter font load** — DevTools Network tab on the live deploy; confirm `inter-latin.woff2` requests succeed.
2. **`bg-gray-50` actual render** — DevTools eyedropper; confirm dashboard page bg is ~#F8FAFC (not #FFFFFF).
3. **Gradient backdrop visual sweep** — Set a non-null `background_color` and toggle `background_shade` through `none` / `subtle` / `bold`; check each of the 5 surfaces (dashboard / public booking / embed / `/[account]` / auth pages) renders as expected.
4. **Live branding editor update** — `MiniPreviewCard` updates instantly while editing; public surfaces reflect saved values after refresh.
5. **Home tab calendar + Sheet drawer** — Click a day with bookings, confirm Sheet opens with each row's 4 actions (View / Cancel / Copy reschedule link / Send reminder).
6. **Auth pages split-panel responsive** — `lg+` two-column with `AuthHero` on right; `sm` form-only.
7. **Email branded header in real inbox** — Trigger live booking; check Gmail web for solid-color header band; confirm no gradient artifacts.
8. **NSI mark image** — Replace `/public/nsi-mark.png` placeholder with the final brand mark before sign-off.
9. **`EmbedCodeDialog` `sm:max-w-2xl`** — Verify at 320 / 768 / 1024 viewports; no horizontal overflow.
10. **Phase 11 regression live trigger** — Concurrent booking races to confirm `RaceLoserBanner` + capacity badge still render correctly under the new branded chrome.

---

## Phase 12.5 — Per-Account Chrome Theming (DEPRECATED in code by Phase 12.6 — manual QA covers regression-safety only)

Source: `.planning/phases/12.5-per-account-chrome-theming/12.5-VERIFICATION.md`. Phase 12.5 code paths were deprecated and replaced by Phase 12.6, but the schema columns persist. Phase 13 should confirm Phase 12.5's DB additions don't break anything; functional QA happens against Phase 12.6.

1. **`accounts.chrome_tint_intensity` column unaffected** — verify SELECTs that include this column don't fail; column persists with DEFAULT `'subtle'` for all accounts.
2. **`FloatingHeaderPill` removal** — confirm no glass header pill on any dashboard route at any viewport (was removed in 12.5; Phase 13 confirms no regression).
3. **Mobile hamburger trigger** — confirm `<SidebarTrigger>` reachable at <768px viewport (replacement for the deleted pill).

---

## Phase 12.6 — Direct Per-Account Color Controls (8 deferred items — load-bearing for Phase 13 sign-off)

Source: `.planning/phases/12.6-direct-color-controls/12.6-VERIFICATION.md`. 8/8 must_haves + 7/7 requirements verified at code level. Items below are the functional QA Andrew approved live during the Phase 12.6 deploy session (2026-04-29).

1. **Full-strength 3-color combo** — Set `sidebar_color=#0A2540`, `background_color=#F8FAFC`, `brand_primary=#0A2540` on `/app/branding`. Reload `/app`. Confirm full navy sidebar + light-gray page + navy buttons + navy switches.
2. **Null/clear regression path** — Clear all 3 fields. Confirm shadcn defaults restore cleanly (white-ish sidebar, gray-50 page, default near-black buttons).
3. **Button accent color** — Set `brand_primary` to a distinct color (e.g., magenta `#EC4899`). Visit `/app/event-types`; confirm "Create event type" / row buttons inherit the color.
4. **Switch on-state** — With same custom primary, visit `/app/availability`; confirm Switch on-state (toggle filled background) inherits the color.
5. **Email header band** — Trigger a real booking against your own NSI URL; inspect the confirmation email in Gmail web; confirm header band uses `sidebar_color` (or falls back to `brand_primary` when sidebar_color is null).
6. **`/app/branding` UI layout** — Confirm 3 distinct labeled pickers (Sidebar / Page background / Button & accent); IntensityPicker is gone; `MiniPreviewCard` faux-dashboard updates live with 3 color regions.
7. **Mobile hamburger** — Sub-768px viewport; confirm `<SidebarTrigger>` at `top-3 left-3` opens the drawer.
8. **NSI mark asset swap** — Replace `/public/nsi-mark.png` placeholder with final brand mark before "ship v1.1" sign-off.

**Andrew confirmed Phase 12.6 deploy approved 2026-04-29** during the live verification step. Items 1-7 above were live-verified during that approval; only NSI mark asset swap (item 8) remains as a hard prerequisite for Phase 13 sign-off.

---

## (Add additional deferred checks here as later plans emit them)

---

*Last updated: 2026-04-29 — appended 21 deferred items from Phases 12 (10), 12.5 (3), and 12.6 (8) during the 3-phase code-complete close-out. Phase 13 (Manual QA + Andrew Ship Sign-Off) replays all queued items.*
