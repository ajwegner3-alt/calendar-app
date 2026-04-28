---
phase: 10
plan: 09
type: execute
name: "rls-matrix-extension-and-checklist"
wave: 6
depends_on: ["10-06", "10-07", "10-08"]
files_modified:
  - "tests/rls-cross-tenant-matrix.test.ts"
  - "tests/helpers/auth.ts"
  - "components/onboarding-checklist.tsx"
  - "app/(shell)/app/page.tsx"
  - "app/(shell)/app/onboarding-checklist-actions.ts"
  - "FUTURE_DIRECTIONS.md"
autonomous: false
must_haves:
  truths:
    - "RLS cross-tenant matrix test runs with N=3 tenants (Andrew + nsi-rls-test + nsi-rls-test-3)"
    - "All cross-tenant SELECT/UPDATE/INSERT pairs (3*2 = 6 directions) verified to enforce tenant isolation"
    - "Onboarding checklist component renders on /app dashboard for accounts within their first 7 days post-onboarding (created_at + 7d > now())"
    - "Checklist items: 'Set availability', 'Customize first event type', 'Share your link' with completion status; user can dismiss"
    - "Dismissal persists in accounts.onboarding_checklist_dismissed_at via dismissChecklistAction"
    - "FUTURE_DIRECTIONS.md updated with v1.1 carry-overs and v1.2 backlog items (Resend migration, OAuth, magic-link, onboarding analytics)"
  artifacts:
    - path: "tests/rls-cross-tenant-matrix.test.ts"
      provides: "Extended matrix test with 3 tenants verifying SHARED_TABLES isolation"
      contains: "TEST_OWNER_3"
    - path: "components/onboarding-checklist.tsx"
      provides: "Dashboard checklist UI; reads accounts state to compute completion; dismiss button"
    - path: "app/(shell)/app/onboarding-checklist-actions.ts"
      provides: "dismissChecklistAction Server Action setting accounts.onboarding_checklist_dismissed_at"
      exports: ["dismissChecklistAction"]
  key_links:
    - from: "tests/rls-cross-tenant-matrix.test.ts"
      to: "tests/helpers/auth.ts"
      via: "signInAsNsiTest3Owner() new helper export"
    - from: "components/onboarding-checklist.tsx (rendered in app/(shell)/app/page.tsx)"
      to: "app/(shell)/app/onboarding-checklist-actions.ts"
      via: "Form action on Dismiss button"
  requirements:
    - "ONBOARD-09 (dashboard onboarding checklist with dismiss)"
    - "RLS matrix extension to N=3 (gates Phase 10 close per ROADMAP build-order step 8)"
    - "Phase 10 FUTURE_DIRECTIONS update"
---

## Objective

Close Phase 10 by extending the v1.0 RLS cross-tenant matrix test to 3 tenants (gating Phase 10 per ROADMAP build-order step 8 + PITFALLS.md P-A5: "RLS holes exposed only at N>1 tenants"). Ship the dashboard onboarding checklist (ONBOARD-09 — the last unimplemented Phase 10 requirement). Update FUTURE_DIRECTIONS.md with v1.1 carry-overs.

This plan is **autonomous: false** — Andrew must create a 3rd test Supabase auth user (`TEST_OWNER_3_EMAIL` / `TEST_OWNER_3_PASSWORD`) and an `nsi-rls-test-3` accounts row before the matrix test can run. That manual setup is structured as a checkpoint task.

## Context

**Locked from STATE.md / PITFALLS.md:**
- v1.0 matrix test exists at `tests/rls-cross-tenant-matrix.test.ts` covering N=2 tenants (Andrew + `nsi-rls-test`).
- Test helpers at `tests/helpers/auth.ts` include `signInAsNsiOwner()` and `signInAsNsiTest2Owner()`.
- P-A5 says: extend to N=3, gate every v1.1 migration on it.
- The test is already gracefully-skipped when env vars are not set (`TEST_OWNER_2_EMAIL`/`PASSWORD`) — same pattern for the 3rd user.

**Locked from CONTEXT.md (ONBOARD-09):**
- Checklist visible to accounts within first 7 days.
- Items: 'Set availability ✓', 'Customize event ✓', 'Share your link ☐' (the last one is a UX-affordance, not a backed action).
- Dismissible — persists in `accounts.onboarding_checklist_dismissed_at`.

## Tasks

<task id="1" type="checkpoint:human-action" gate="blocking">
  <name>Create 3rd test user + accounts row for RLS matrix N=3 extension</name>
  <description>
    Manual Supabase Dashboard / SQL steps:

    1. **Supabase Dashboard → Authentication → Users → Add user → "Create new user"**:
       - Email: `nsi-rls-test-3@andrewwegner.example` (use a real-looking but never-mailed address; Andrew can pick any pattern that matches the existing `nsi-rls-test-2` convention).
       - Password: pick a strong password.
       - Auto-confirm email: ON.
       - Note the new user's UUID.
    2. **Supabase SQL Editor** — INSERT the matching accounts row:
       ```sql
       insert into accounts (
         owner_user_id,
         owner_email,
         slug,
         display_name,
         timezone,
         onboarding_complete
       ) values (
         '{NEW_USER_UUID_FROM_STEP_1}',
         'nsi-rls-test-3@andrewwegner.example',
         'nsi-rls-test-3',
         'NSI RLS Test 3',
         'America/Chicago',
         true
       );
       ```
       (The trigger from 10-03 may have already created a stub row — if so, UPDATE instead of INSERT, or just `delete from accounts where owner_user_id = '...' and onboarding_complete = false; ` then INSERT.)
    3. **Local `.env.test` (or wherever the matrix test reads test secrets — likely `.env.test.local`)** — add:
       ```
       TEST_OWNER_3_EMAIL=nsi-rls-test-3@andrewwegner.example
       TEST_OWNER_3_PASSWORD={password from step 1}
       ```
    4. **Vercel project env vars (for CI if relevant)** — add the same TEST_OWNER_3_* pair. Note: matrix test is `describe.skipIf(!hasEnv)` so omitting CI is acceptable; tests will skip in CI but run locally for Andrew.

    **Resume signal:** "RLS test user 3 created" + Andrew confirms the `nsi-rls-test-3` accounts row is visible via SQL: `select slug, owner_email from accounts where slug = 'nsi-rls-test-3';`.
  </description>
  <files>none (manual)</files>
  <verification>
    Andrew confirms in chat: 3rd auth user created, accounts row exists, env vars added.
  </verification>
</task>

<task id="2" type="auto">
  <description>
    Extend `tests/helpers/auth.ts` and `tests/rls-cross-tenant-matrix.test.ts` to N=3 tenants.

    **`tests/helpers/auth.ts`** — add:
    ```ts
    export const TEST_RLS_3_ACCOUNT_SLUG = "nsi-rls-test-3";

    export async function signInAsNsiTest3Owner(): Promise<SupabaseClient> {
      // Mirror signInAsNsiTest2Owner pattern but reads TEST_OWNER_3_EMAIL/PASSWORD.
      // ...
    }
    ```

    **`tests/rls-cross-tenant-matrix.test.ts`** — extend:
    1. Update the `skipIfNoSecondUser` guard to also require `TEST_OWNER_3_EMAIL`/`PASSWORD`. Rename to `skipIfNoThreeUsers` for clarity.
    2. Add a 3rd `beforeAll` setup block: load test3's account_id + seed an event_type for them (so positive control exists for owner=test3).
    3. Add new test cases verifying full N=3 matrix:
       - test3 cannot SELECT nsi's rows (and vice versa). [adds 4 SHARED_TABLES × 1 direction = 4 cases]
       - test3 cannot SELECT test2's rows (and vice versa). [4 × 1 = 4 cases]
       - test3 cannot UPDATE nsi's bookings; test3 cannot UPDATE test2's bookings. [2 cases]
       - Positive control for test3 (owner CAN see own seeded data). [1 case]
       - Anon SELECT lockout for the test3-seeded event_type. [1 case]
    4. Total new cases: ~12. Combined with v1.0's existing N=2 cases, the matrix is now ~28-30 cases.

    Use the existing test patterns (the file already shows the structure clearly — load it for reference). Reuse the `SHARED_TABLES` array from v1.0.
  </description>
  <files>
    tests/helpers/auth.ts (modify — add signInAsNsiTest3Owner + slug constant)
    tests/rls-cross-tenant-matrix.test.ts (modify — extend to N=3)
  </files>
  <verification>
    `npm test -- tests/rls-cross-tenant-matrix.test.ts` passes (skips gracefully if env vars not set; runs and passes when set).
    All new cases pass: cross-tenant denies, positive controls, admin sees-all.
    `npx tsc --noEmit` clean.
  </verification>
</task>

<task id="3" type="auto">
  <description>
    Ship the onboarding checklist + update FUTURE_DIRECTIONS.md.

    **`components/onboarding-checklist.tsx`** (`'use client'` for the dismiss button + RHF):
    - Props: `account` (id, slug, created_at, onboarding_checklist_dismissed_at), `availabilityCount` (number of availability_rules rows), `eventTypeCount` (number of event_types rows).
    - Shows ONLY when:
      - `account.onboarding_complete === true` (we never show on the wizard).
      - `account.onboarding_checklist_dismissed_at === null`.
      - `account.created_at + 7 days > now()` (within first 7 days).
    - Renders 3 checklist items with check/uncheck:
      - "Set your availability" — checked if `availabilityCount >= 1`.
      - "Customize your first event type" — checked if `eventTypeCount >= 1` (always true post-wizard since 10-06 creates one). Ship it anyway; user might delete it.
      - "Share your link" — uncheckable affordance with the user's booking link displayed + "Copy" button.
    - Dismiss button → calls `dismissChecklistAction()`.

    **`app/(shell)/app/onboarding-checklist-actions.ts`**:
    ```ts
    "use server";
    import { revalidatePath } from "next/cache";
    import { redirect } from "next/navigation";
    import { createClient } from "@/lib/supabase/server";

    export async function dismissChecklistAction() {
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      if (!claims?.claims) redirect("/app/login");

      const { error } = await supabase
        .from("accounts")
        .update({ onboarding_checklist_dismissed_at: new Date().toISOString() })
        .eq("owner_user_id", claims.claims.sub);

      if (error) return { error: error.message };
      revalidatePath("/app");
      return { success: true };
    }
    ```

    **`app/(shell)/app/page.tsx`** — extend the existing dashboard home (modified by 10-06 already) to render `<OnboardingChecklist />` ABOVE the WelcomeCard, when applicable. Server Component loads the account row + the two counts (or a single SELECT with subqueries if cleaner).

    **Update `FUTURE_DIRECTIONS.md`** at the repo root — add a "v1.1 Phase 10 carry-overs" section:
    ```
    ### v1.1 Phase 10 — Multi-User Signup + Onboarding (Carry-overs)

    - **Gmail SMTP → Resend/Postmark migration.** Phase 10 capped at 200/day with 80%-warning + fail-closed-at-cap. v1.2 should migrate to Resend (~$10/mo for 5k emails) for higher headroom and proper SPF/DKIM/DMARC posture (also closes EMAIL-08 v1.2 backlog).
    - **OAuth signup (Google / GitHub)** — deferred per CONTEXT.md.
    - **Magic-link / passwordless login** — deferred per CONTEXT.md.
    - **Slug 301 redirect for old slugs after change** — chose 404 in v1.1; revisit if contractors report broken-link complaints.
    - **Soft-delete reversibility / 'restore on login within N days'** — chose immediate-no-undo in v1.1.
    - **Pick-from-templates first event type** — deferred in favor of single pre-filled default; revisit if onboarding analytics show users bouncing at step 3.
    - **Onboarding analytics** — Phase 10 captures no metrics. Add Supabase event-log on wizard step transitions for v1.2.
    - **Hard-delete cron purge** — v1.1 ships soft-delete only; auth.users rows preserved indefinitely. v1.2 cron should purge after N days.
    - **Constant-time delay on signup form** — P-A1 prevention notes recommend ~500ms delay regardless of outcome to defeat timing oracles. Not implemented in v1.1 (rate limiting + generic messaging is sufficient table-stakes); add for stronger posture in v1.2.
    ```
  </description>
  <files>
    components/onboarding-checklist.tsx (new)
    app/(shell)/app/onboarding-checklist-actions.ts (new)
    app/(shell)/app/page.tsx (modify — render checklist conditionally)
    FUTURE_DIRECTIONS.md (modify — add Phase 10 carry-overs section)
  </files>
  <verification>
    Visit /app as a user within their first 7 days post-onboarding → checklist visible.
    Click dismiss → checklist disappears; reload → still gone (persisted via accounts.onboarding_checklist_dismissed_at).
    Visit /app as Andrew (created_at well > 7 days) → checklist NOT visible (window expired).
    `npx tsc --noEmit` clean. `npm test` passes (overall test run).
  </verification>
</task>

## Verification Criteria

- TEST_OWNER_3_* env vars set; matrix test runs with all N=3 cases passing.
- Onboarding checklist renders on /app for accounts within first 7 days post-onboarding; dismiss works + persists.
- FUTURE_DIRECTIONS.md updated with Phase 10 carry-overs.
- `npx tsc --noEmit` clean. `npm test` passes (full suite, 131+ existing tests + new Phase 10 tests).
- Phase 10 close: ALL 19 requirements (AUTH-05..11, ONBOARD-01..09, ACCT-01..03) covered by at least one plan's must_haves AND verified.

## must_haves

- ONBOARD-09 — dashboard onboarding checklist with dismiss + 7-day window.
- RLS matrix extension to N=3 — gates Phase 10 close per ROADMAP build-order step 8.
- FUTURE_DIRECTIONS.md update with v1.1 Phase 10 carry-overs to v1.2.
