---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-08"
type: execute
wave: 3
depends_on: ["08-04"]
files_modified:
  - tests/rls-cross-tenant-matrix.test.ts
  - tests/helpers/auth.ts
  - tests/shell-render.test.tsx
  - .env.local.example
autonomous: false

user_setup:
  - service: supabase-second-tenant
    why: "RLS cross-tenant test matrix requires a second authenticated user linked to a second account"
    env_vars:
      - name: TEST_OWNER_2_EMAIL
        source: "Supabase Dashboard → Auth → Users → invite-or-create user with confirmed email"
      - name: TEST_OWNER_2_PASSWORD
        source: "Set when creating the second user (or via password-reset)"
    dashboard_config:
      - task: "Create second auth user, then in SQL editor: UPDATE accounts SET owner_user_id = '<new-user-uuid>' WHERE slug = 'nsi-rls-test'; (creates the account row first if it doesn't exist)"
        location: "Supabase Dashboard → Authentication → Users + Database → SQL Editor"
  - service: cron-job-org
    why: "Vercel Hobby plan blocks hourly cron; cron-job.org provides free hourly invocations"
    env_vars: []
    dashboard_config:
      - task: "Create free account at cron-job.org. Add cronjob: URL = https://calendar-app-xi-smoky.vercel.app/api/cron/send-reminders, schedule = every hour at :00, custom header Authorization: Bearer <CRON_SECRET-from-Vercel>"
        location: "https://cron-job.org/en/members/jobs"
  - service: gmail-mail-tester
    why: "EMAIL-08 requires mail-tester score >= 9/10 for confirmation + reminder emails"
    env_vars: []
    dashboard_config:
      - task: "Get a mail-tester address from https://www.mail-tester.com (10-min disposable). Trigger a real confirmation email by booking with that address. Then trigger a reminder by booking <24h out and waiting (or by manually invoking cron). Read score on mail-tester."
        location: "https://www.mail-tester.com"
  - service: supabase-key-swap
    why: "Phase 8 hardening backlog: legacy JWT SUPABASE_SERVICE_ROLE_KEY → modern sb_secret_* format"
    env_vars:
      - name: SUPABASE_SERVICE_ROLE_KEY
        source: "Supabase Dashboard → Project Settings → API → 'secret' API key (sb_secret_* format)"
    dashboard_config:
      - task: "Copy new sb_secret_* key, update local .env.local, then update Vercel env vars (Production + Preview), then trigger re-deploy"
        location: "Supabase Dashboard + Vercel Dashboard → Project → Settings → Environment Variables"

must_haves:
  truths:
    - "RLS test matrix proves second-tenant auth user cannot SELECT first tenant's bookings/event_types/accounts/booking_events via user-scoped client"
    - "RLS test matrix proves anon client cannot SELECT any of those tables"
    - "RLS test matrix proves admin (service-role) client CAN SELECT both tenants (control case — admin bypass works as expected)"
    - "Render harness test mounts the shell layout and asserts no missing context provider regressions"
    - "cron-job.org is configured to hit /api/cron/send-reminders hourly with valid Bearer (or Vercel Pro upgrade is confirmed and vercel.json is hourly)"
    - "mail-tester score for both confirmation and reminder emails is documented (>= 9/10 target)"
    - "SUPABASE_SERVICE_ROLE_KEY uses modern sb_secret_* format in .env.local AND Vercel"
    - ".env.local.example documents TEST_OWNER_2_EMAIL / TEST_OWNER_2_PASSWORD / CRON_SECRET requirements"
  artifacts:
    - path: "tests/rls-cross-tenant-matrix.test.ts"
      provides: "Vitest matrix proving 2-tenant RLS isolation across 4 tables × 3 client contexts"
      contains: "cross-tenant"
    - path: "tests/helpers/auth.ts"
      provides: "signInAsNsiOwner + signInAsNsiTest2Owner helpers (extends existing helpers)"
      contains: "signInAsNsiTest2Owner"
    - path: "tests/shell-render.test.tsx"
      provides: "Render-test harness for shell layout (catches missing-provider regressions)"
      contains: "ShellLayout"
    - path: ".env.local.example"
      provides: "Documentation of required env vars for full test matrix"
      contains: "TEST_OWNER_2_EMAIL"
  key_links:
    - from: "tests/rls-cross-tenant-matrix.test.ts"
      to: "Supabase RLS policies"
      via: "Two distinct authenticated clients querying tables they don't own"
      pattern: "signInAsNsiTest2Owner"
    - from: "cron-job.org"
      to: "/api/cron/send-reminders"
      via: "HTTP GET with Authorization: Bearer ${CRON_SECRET}"
      pattern: "Authorization: Bearer"
---

<objective>
Close out Phase 8 hardening by automating what can be automated and structuring the manual operations checkpoints for what cannot. Closes INFRA-05, EMAIL-08, and the cron-scheduler operational deployment.

Purpose: Several critical hardening items require human-only access (Supabase dashboard for second auth user, cron-job.org account, mail-tester live test, Vercel env UI for key swap, Vercel tier confirmation). This plan automates the test code that surrounds those operations and pauses cleanly at each checkpoint where Andrew has to act.

Output: New RLS matrix test, render harness test, helpers extended, .env.local.example documented, four checkpoint moments for Andrew's manual ops.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-CONTEXT.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-RESEARCH.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-04-SUMMARY.md
@tests/rls-anon-lockout.test.ts
@tests/rls-authenticated-owner.test.ts
@tests/helpers
@.planning/STATE.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Manual prerequisites — second auth user + Vercel tier confirmation + key swap</name>
  <what-needed>
    These four operations have no CLI/API path Claude can take. All require Andrew's account access.

    **Prerequisite A — confirm Vercel plan tier (1 min)**
    1. Open https://vercel.com/dashboard → click NSI's calendar-app project → Settings → Billing.
    2. Note: "Hobby" or "Pro".
    3. Reply with: "Vercel tier: Hobby" OR "Vercel tier: Pro".

    Why this matters: If Pro, vercel.json schedule can be `0 * * * *` (hourly) and cron-job.org is unnecessary. If Hobby, cron-job.org is mandatory for hourly cadence.

    **Prerequisite B — create second Supabase auth user for RLS matrix (10 min)**
    1. Open https://supabase.com/dashboard → calendar-app project → Authentication → Users → "Add user" → "Create new user".
    2. Email: `nsi-rls-test@example.com` (use a real address you control if you want to verify the email; otherwise check "Auto Confirm User").
    3. Set a strong password (record it for the next step).
    4. After user is created, copy the user's UUID from the table.
    5. Open SQL Editor → run:
       ```sql
       INSERT INTO accounts (slug, name, owner_user_id, brand_primary)
       VALUES ('nsi-rls-test', 'NSI RLS Test', '<user-uuid-from-step-4>', '#000000')
       ON CONFLICT (slug) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id;
       ```
    6. Verify with `SELECT id, slug, owner_user_id FROM accounts WHERE slug = 'nsi-rls-test';` — confirm the user UUID appears.

    Reply with: "Second user created: email=nsi-rls-test@example.com, password=<password>, account-id=<account-uuid>".

    **Prerequisite C — swap legacy JWT service-role key for sb_secret_* format (5 min)**
    1. Open Supabase Dashboard → Settings → API.
    2. Find the "secret" API key in the new sb_secret_* format. Copy it.
    3. Update local `.env.local`:
       ```
       SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxxxx
       ```
    4. Update Vercel env vars:
       - Open Vercel Dashboard → calendar-app → Settings → Environment Variables
       - Find `SUPABASE_SERVICE_ROLE_KEY` (should exist for Production + Preview)
       - Click Edit → paste new sb_secret_* value → Save for both environments
       - Redeploy: Deployments tab → most recent → "..." → Redeploy
    5. Add to `.env.local.example` as a documented env var (next task does this).

    Reply with: "Service role key swapped to sb_secret_* format in local + Vercel + redeployed".

    **Prerequisite D — add CRON_SECRET to Vercel env if not yet present (3 min)**
    1. In a terminal: `openssl rand -hex 32` (or use any 32+ char random string generator). Copy the output.
    2. Open Vercel Dashboard → calendar-app → Settings → Environment Variables.
    3. Add `CRON_SECRET` for Production + Preview, value = the random hex string.
    4. Update local `.env.local` with the SAME value:
       ```
       CRON_SECRET=<random-hex-string>
       ```
    5. Redeploy if you haven't already from prereq C.

    Reply with: "CRON_SECRET set in Vercel + local .env.local; deployed."
  </what-needed>
  <resume-signal>
    Reply with all four prerequisite confirmations:
    - Vercel tier (Hobby/Pro)
    - Second user created (email, password, account-id)
    - Service role key swapped
    - CRON_SECRET set
  </resume-signal>
</task>

<task type="auto">
  <name>Task 2: RLS cross-tenant matrix test + auth helpers + .env.local.example</name>
  <files>tests/rls-cross-tenant-matrix.test.ts, tests/helpers/auth.ts, .env.local.example</files>
  <action>
    Step A — extend `tests/helpers/auth.ts` (or create if it doesn't exist):

    Read the existing `tests/rls-authenticated-owner.test.ts` to find how it signs in as Andrew. There's likely a helper like `signInAsNsiOwner()` or inline sign-in code. Extract or extend.

    Add helpers (real Supabase auth client creation — these tests hit the live remote DB or local Supabase, NOT a mock):

    ```typescript
    // tests/helpers/auth.ts
    import { createClient as createSupabaseClient } from "@supabase/supabase-js";

    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    export async function signInAsNsiOwner() {
      const client = createSupabaseClient(URL, PUB);
      const email = process.env.TEST_OWNER_EMAIL!;
      const password = process.env.TEST_OWNER_PASSWORD!;
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`signInAsNsiOwner failed: ${error.message}`);
      return client;
    }

    export async function signInAsNsiTest2Owner() {
      const client = createSupabaseClient(URL, PUB);
      const email = process.env.TEST_OWNER_2_EMAIL!;
      const password = process.env.TEST_OWNER_2_PASSWORD!;
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`signInAsNsiTest2Owner failed: ${error.message}`);
      return client;
    }

    export function anonClient() {
      return createSupabaseClient(URL, PUB);
    }

    export function adminClient() {
      const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      return createSupabaseClient(URL, SECRET);
    }
    ```

    Step B — RLS matrix test:

    Create `tests/rls-cross-tenant-matrix.test.ts` (RESEARCH §RLS Test Matrix Structure):

    ```typescript
    import { describe, it, expect, beforeAll } from "vitest";
    import { signInAsNsiOwner, signInAsNsiTest2Owner, anonClient, adminClient } from "./helpers/auth";

    const SHARED_TABLES = ["bookings", "booking_events", "event_types", "accounts"] as const;

    describe("RLS cross-tenant isolation matrix (Phase 8 INFRA-05)", () => {
      // Skip suite gracefully if second-user env vars not set (e.g., CI without secrets)
      const skipIfNoSecondUser = !process.env.TEST_OWNER_2_EMAIL || !process.env.TEST_OWNER_2_PASSWORD;
      if (skipIfNoSecondUser) {
        it.skip("requires TEST_OWNER_2_EMAIL/TEST_OWNER_2_PASSWORD — see .env.local.example", () => {});
        return;
      }

      let nsiClient: Awaited<ReturnType<typeof signInAsNsiOwner>>;
      let test2Client: Awaited<ReturnType<typeof signInAsNsiTest2Owner>>;
      let test2EventTypeId: string | null = null;
      let test2AccountId: string | null = null;

      beforeAll(async () => {
        nsiClient = await signInAsNsiOwner();
        test2Client = await signInAsNsiTest2Owner();

        // Seed nsi-rls-test with at least one row in event_types so isolation
        // assertions exercise RLS meaningfully. Without seeded data, an empty
        // result trivially passes "test2 sees no nsi rows" because test2 sees
        // NOTHING — which would also be the (broken) outcome if RLS denied
        // its own account's rows. We need real test2 data to prove the
        // policy correctly ALLOWS own-account access AND DENIES cross-account.
        const admin = adminClient();

        // Look up nsi-rls-test account id (created in Task 1 prereq B)
        const { data: acct } = await admin
          .from("accounts")
          .select("id")
          .eq("slug", "nsi-rls-test")
          .maybeSingle();
        if (!acct) {
          throw new Error(
            "nsi-rls-test account not found. Run Task 1 prereq B SQL to insert account row.",
          );
        }
        test2AccountId = acct.id;

        // Idempotent seed: insert event_type if not already present
        const { data: existing } = await admin
          .from("event_types")
          .select("id")
          .eq("account_id", test2AccountId)
          .eq("slug", "rls-isolation-fixture")
          .maybeSingle();

        if (existing) {
          test2EventTypeId = existing.id;
        } else {
          const { data: inserted, error: insertErr } = await admin
            .from("event_types")
            .insert({
              account_id: test2AccountId,
              name: "RLS isolation fixture",
              slug: "rls-isolation-fixture",
              duration_minutes: 30,
              active: true,
            })
            .select("id")
            .single();
          if (insertErr || !inserted) {
            throw new Error(`Failed to seed nsi-rls-test event_type: ${insertErr?.message}`);
          }
          test2EventTypeId = inserted.id;
        }
      });

      // Positive control: prove RLS allows own-account access.
      // Without this, an empty result is ambiguous (could be RLS denying everything).
      it("nsi-rls-test owner CAN see their own seeded event_type (positive control)", async () => {
        const { data, error } = await test2Client
          .from("event_types")
          .select("id")
          .eq("id", test2EventTypeId!)
          .maybeSingle();
        expect(error).toBeNull();
        expect(data?.id).toBe(test2EventTypeId);
      });

      // Cross-tenant isolation: nsi owner must NOT see the seeded test2 event_type.
      it("nsi owner CANNOT see nsi-rls-test's seeded event_type (cross-tenant isolation)", async () => {
        const { data } = await nsiClient
          .from("event_types")
          .select("id")
          .eq("id", test2EventTypeId!)
          .maybeSingle();
        // RLS hides the row → maybeSingle() returns null data, no error
        expect(data).toBeNull();
      });

      // Anon SELECT lockout (already covered by rls-anon-lockout.test.ts but re-asserted for matrix completeness)
      for (const table of SHARED_TABLES) {
        it(`anon client cannot SELECT ${table} (returns [] not error)`, async () => {
          const client = anonClient();
          const { data } = await client.from(table).select("id").limit(5);
          expect(data ?? []).toEqual([]);
        });
      }

      // Cross-tenant SELECT lockout — the core matrix
      for (const table of SHARED_TABLES) {
        it(`nsi-rls-test owner cannot see nsi's ${table} rows`, async () => {
          // Test2 owner queries table — RLS should filter to ONLY their account's rows
          const { data } = await test2Client.from(table).select("id").limit(50);
          // We don't assert empty (test2 may have own rows), but we DO assert that
          // none of the returned ids belong to nsi's account.
          // Strategy: get nsi's row ids first, then assert no overlap.
          const nsiResult = await nsiClient.from(table).select("id").limit(50);
          const nsiIds = new Set((nsiResult.data ?? []).map((r) => r.id));
          for (const row of data ?? []) {
            expect(nsiIds.has(row.id)).toBe(false);
          }
        });
      }

      // Cross-tenant WRITE lockout — UPDATE/DELETE attempts on other tenant's rows
      it("nsi-rls-test owner cannot UPDATE nsi's bookings (RLS rejects via 0 rows updated)", async () => {
        // Get an nsi booking id via admin client (to know what we're attacking)
        const admin = adminClient();
        const { data: nsiBooking } = await admin
          .from("bookings")
          .select("id")
          .eq("status", "confirmed")
          .limit(1)
          .maybeSingle();

        if (!nsiBooking) {
          // No data to test against — soft skip with informative message
          console.warn("No nsi confirmed booking exists; cross-tenant UPDATE test skipped.");
          return;
        }

        const { data, error } = await test2Client
          .from("bookings")
          .update({ owner_note: "RLS attack" })
          .eq("id", nsiBooking.id)
          .select("id");

        // RLS denies via "0 rows match WHERE" semantics — data is [] not error
        expect((data ?? []).length).toBe(0);

        // Verify nsi's booking was NOT modified
        const { data: stillIntact } = await admin
          .from("bookings")
          .select("owner_note")
          .eq("id", nsiBooking.id)
          .maybeSingle();
        expect(stillIntact?.owner_note).not.toBe("RLS attack");
      });

      // Admin (control case): bypass works as expected
      it("admin client CAN see both tenants' rows (control case — admin bypass)", async () => {
        const admin = adminClient();
        const { data, error } = await admin.from("accounts").select("id, slug").limit(50);
        expect(error).toBeNull();
        const slugs = (data ?? []).map((r) => r.slug);
        expect(slugs).toContain("nsi");
        expect(slugs).toContain("nsi-rls-test");
      });
    });
    ```

    Step C — `.env.local.example`:

    Create or update `.env.local.example` at project root, documenting all required env vars (do NOT include real values; use placeholder text):

    ```
    # Supabase
    NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
    SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxx  # NEW format Phase 8 hardening

    # Email (Phase 5 — Gmail SMTP)
    GMAIL_USER=ajwegner3@gmail.com
    GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

    # Turnstile (Phase 5)
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=xxxx
    TURNSTILE_SECRET_KEY=xxxx

    # Cron (Phase 8)
    CRON_SECRET=<32+ char random hex>

    # App URL
    APP_URL=https://calendar-app-xi-smoky.vercel.app
    NEXT_PUBLIC_APP_URL=https://calendar-app-xi-smoky.vercel.app

    # Test users (Phase 1 + Phase 8)
    TEST_OWNER_EMAIL=ajwegner3@gmail.com           # nsi account owner — Phase 1
    TEST_OWNER_PASSWORD=<password>
    TEST_OWNER_2_EMAIL=nsi-rls-test@example.com    # nsi-rls-test account owner — Phase 8 RLS matrix
    TEST_OWNER_2_PASSWORD=<password>
    ```

    Step D — run the tests:

    ```bash
    npm test -- rls-cross-tenant-matrix
    ```

    Expected outcome with second user provisioned (Task 1 prereq B done):
    - Anon SELECT cases: pass.
    - Cross-tenant SELECT cases (4 tables): pass — test2 sees no nsi ids.
    - Cross-tenant UPDATE case: pass — RLS rejects via 0-row affected.
    - Admin control case: pass.

    If TEST_OWNER_2_* not set: suite is gracefully skipped with informative message — does not fail CI.
  </action>
  <verify>
    `npm test -- rls-cross-tenant-matrix` passes (with second user) OR skips with informative message (without).
    `cat .env.local.example` shows all required env vars documented.
    `grep -n "signInAsNsiTest2Owner" tests/helpers/auth.ts` shows the new helper.
    `npm test` full suite green.
  </verify>
  <done>
    INFRA-05 satisfied: matrix proves 2nd authenticated tenant cannot read or write 1st tenant's data via user-scoped client. Anon already locked. Admin control case proves admin bypass works as expected. Suite gracefully skips when second user not provisioned.
  </done>
</task>

<task type="auto">
  <name>Task 3: Shell render harness (catches missing-provider regressions)</name>
  <files>tests/shell-render.test.tsx</files>
  <action>
    STATE.md backlog item line 235: "render-test harness for shell layout — would have caught the TooltipProvider regression in Plan 02-04 at CI instead of user smoke."

    Create `tests/shell-render.test.tsx`:

    ```typescript
    import { describe, it, expect } from "vitest";
    import { render } from "@testing-library/react";
    import "@testing-library/jest-dom/vitest";

    // Import the actual shell layout used by /app/* routes
    import ShellLayout from "@/app/(shell)/layout"; // adjust if filename differs

    describe("ShellLayout render harness", () => {
      it("renders without crashing (catches missing-provider regressions)", () => {
        // Render with a minimal child to exercise every provider in the tree
        const { container } = render(
          <ShellLayout>
            <div data-testid="content">test content</div>
          </ShellLayout>
        );
        expect(container.querySelector('[data-testid="content"]')).toBeInTheDocument();
      });

      // Specific: TooltipProvider was the regression that motivated this harness
      // (Plan 02-04). Render a small child that USES <Tooltip> from the project
      // Tooltip primitives. If TooltipProvider is missing from ShellLayout's tree,
      // radix-ui throws at render with "Tooltip must be used within TooltipProvider".
      it("provides TooltipProvider context for descendants", () => {
        // Lazy import the project Tooltip primitive (path may differ by codebase
        // — adjust to the actual location, e.g. @/components/ui/tooltip).
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Tooltip, TooltipTrigger, TooltipContent } = require("@/components/ui/tooltip");

        // Render a Tooltip-using child INSIDE ShellLayout. If the layout fails to
        // mount TooltipProvider, this render call throws synchronously.
        const TooltipChild = () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <button data-testid="tooltip-trigger">trigger</button>
            </TooltipTrigger>
            <TooltipContent>tip</TooltipContent>
          </Tooltip>
        );

        // The render should NOT throw. If it does, jest/vitest surfaces the error
        // and the test fails — exactly the regression class Plan 02-04 motivated.
        expect(() => {
          render(
            <ShellLayout>
              <TooltipChild />
            </ShellLayout>
          );
        }).not.toThrow();

        // Also assert the trigger actually rendered (no silent provider stub).
        expect(document.querySelector('[data-testid="tooltip-trigger"]')).toBeTruthy();
      });
    });
    ```

    Implementation notes:
    - The Phase 2 ShellLayout likely lives at `app/(shell)/layout.tsx`. If it requires async data (e.g., fetches user from Supabase), the test will need to mock that fetch. Look at how existing tests mock the Supabase server client (`tests/__mocks__/`) and reuse.
    - Server components cannot be directly rendered by RTL in jsdom without converting to a client tree. If `ShellLayout` is a Server Component with async DB calls, this test may need to:
      - Mock the DB calls
      - Use `<Suspense>` or just await the component's render output (RTL has `renderAsync` patterns for RSC)
      - OR test the CLIENT-side providers wrapper if shell is split into server-shell + client-providers (likely structure in this codebase)
    - Read `app/(shell)/layout.tsx` first. If providers are pulled into a separate `client-providers.tsx`, render THAT in the test instead. The goal is provider-tree integrity, not full server-component invocation.

    For the second test (TooltipProvider specifically), import a small component that uses `<Tooltip>` from `@radix-ui/react-tooltip` and assert it renders without the "TooltipProvider not found" error.

    If the shell layout proves too entangled with server-only deps to render in jsdom, write a lighter test that imports the providers component used inside shell and asserts the tree mounts. Document the tradeoff in SUMMARY.

    Run: `npm test -- shell-render`. Test passes.
  </action>
  <verify>
    `ls tests/shell-render.test.tsx` exists.
    `npm test -- shell-render` passes.
    `npm test` full suite green.
  </verify>
  <done>
    Render harness exists and asserts shell layout / providers tree mounts without crash. STATE.md backlog item line 235 closed.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4: Configure cron-job.org (or upgrade Vercel) + run mail-tester live test</name>
  <what-needed>
    These two operations require dashboard access — cron-job.org has no API at the free tier, mail-tester is one-off browser based.

    **Op A — hourly cron driver (depends on Task 1 Vercel tier answer):**

    *If Vercel tier = Hobby (default assumption):*
    1. Sign up free at https://cron-job.org/en/.
    2. Members area → "CronJobs" → "Create cronjob".
    3. Title: "calendar-app reminder cron".
    4. URL: `https://calendar-app-xi-smoky.vercel.app/api/cron/send-reminders` (use the actual production URL from Vercel; if this changes, update here).
    5. Schedule: Every hour at minute 0 (cron expression `0 * * * *`).
    6. Advanced → Custom request headers → add header:
       - Header name: `Authorization`
       - Header value: `Bearer <CRON_SECRET-value-from-Vercel-env>` (the same string as Vercel/.env.local from Task 1 prereq D)
    7. Save → Enable the job.
    8. Wait ~1 hour OR manually click "Execute now" → check the History tab → confirm response 200 with body like `{"ok":true,"scanned":N,"claimed":M}`.

    Reply with: "cron-job.org configured; first run returned 200 with `{...}`."

    *If Vercel tier = Pro:*
    1. Open `vercel.json` and change schedule from `0 8 * * *` to `0 * * * *` (hourly).
    2. Commit + push:
       ```bash
       git add vercel.json
       git commit -m "chore(08-08): switch cron to hourly (Vercel Pro tier confirmed)"
       git push
       ```
    3. Confirm in Vercel dashboard → Project → Cron Jobs that the new schedule shows hourly with no error.

    Reply with: "Vercel Pro hourly cron deployed; vercel.json updated."

    **Op B — mail-tester.com live deliverability test:**

    1. Open https://www.mail-tester.com (no account required).
    2. Copy the disposable email address shown (e.g., `web-XXXXX@mail-tester.com`). Valid for 10 minutes.
    3. Visit the live booking page (https://calendar-app-xi-smoky.vercel.app/[your-account-slug]/[event-slug] OR via /app to find a real link).
    4. Book an appointment using the mail-tester address as the booker email. Use a slot >24h out for the FIRST test (you'll test the reminder separately).
    5. Wait for confirmation email to arrive (~30s).
    6. Return to mail-tester.com → click "Then check your score". Note the score (target: ≥9/10).
    7. **For reminder email:** repeat with a slot <24h out (e.g., 2h from now). Confirmation arrives, then immediate-send reminder arrives within 1 min (08-04 Task 3 immediate-send hook).
    8. Get a NEW disposable address for the reminder test if the first 10-min window expired.
    9. Note both scores.

    Reply with:
    - Confirmation email mail-tester score: <X>/10
    - Reminder email mail-tester score: <X>/10
    - Any flagged content issues (paste the bullets mail-tester surfaces — common ones are "no List-Unsubscribe header", "missing precedence header", which are acceptable for transactional emails)

    **Op C — manual rate-limit + cancel/reschedule live verification (Phase 9 backlog moved up):**

    SKIP this for now. STATE.md line 239 already defers this to Phase 9 manual QA. No action needed in 08-08.
  </what-needed>
  <resume-signal>
    Reply with:
    - cron-job.org configuration confirmation (or Vercel Pro hourly confirmation)
    - Confirmation email mail-tester score
    - Reminder email mail-tester score
    - Any content-side issues mail-tester flagged
  </resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: End-to-end Phase 8 walkthrough verification</name>
  <what-built>
    All eight Phase 8 plans are now executed. Manual verification of the integrated experience:
    1. /app/bookings list with filters + pagination + status badges
    2. /app/bookings/[id] detail with answers, owner-note autosave, history timeline, action bar
    3. /app/settings/reminders toggles work end-to-end
    4. /app/event-types/[id]/edit has a Location field that persists
    5. Reminder email arrives with correct branding, conditional toggle blocks, and working cancel/reschedule links
    6. Cron-job.org (or Vercel Pro hourly) is firing the reminder route and getting 200 responses
    7. Rate limit on /api/bookings returns 429 after 21 rapid requests (light verify; full live test deferred to Phase 9)
  </what-built>
  <how-to-verify>
    1. **Bookings list:** Visit `/app/bookings`. Confirm:
       - Default view shows upcoming-only, soonest first.
       - Status filter dropdown changes results when set to All/Cancelled/etc.
       - Date-range picker narrows results.
       - Event-type multi-select narrows results.
       - Search by booker name returns matching rows.
       - Pagination shows 25/page; preserve filters across page changes.
       - Status badges colored green/red/amber correctly.
       - Click a row → navigates to /app/bookings/[id].

    2. **Bookings detail:** On a real booking detail page, confirm:
       - Booker name + email (mailto: link clickable) + phone (tel: link if present) all visible.
       - Custom-question answers fully displayed.
       - Location card visible if event_type.location is set.
       - Owner-note textarea: type something → wait 1s → "Saved" appears → refresh page → note persists.
       - History timeline lists at least one event (created entry synthesized if booking_events lacks it).
       - Action bar top-right has Cancel + kebab icon.

    3. **Reminder Settings:** Visit `/app/settings/reminders`. Toggle each switch off and on, refreshing between toggles, confirm DB persistence.

    4. **Event-type Location:** Edit any event type, set Location to "123 Test St". Save, reload, confirm value persists.

    5. **Reminder email — live end-to-end:**
       - Make a NEW test booking starting in <23 hours from a clean booker email.
       - Within 1 minute, the reminder email should arrive (immediate-send via after()).
       - Confirm subject: "Reminder: <event name> tomorrow at <time>".
       - Confirm branding matches confirmation email visual (logo header + brand H1 + branded button + NSI footer).
       - Toggle each per-account switch off and re-test reminder content (or mentally verify against /app/settings/reminders state).
       - Click the Reschedule link in reminder — should resolve to the reschedule flow with valid token.
       - Click the Cancel link in reminder — should resolve to cancel flow with valid token.

    6. **Cron live verification (cron-job.org dashboard):** Open cron-job.org → CronJobs → calendar-app reminder cron → History. Confirm at least one execution returned 200 OK with `{ok: true, scanned: ..., claimed: ...}` body.

    7. **Rate limit smoke (light):** From browser devtools console, run a quick loop hitting `/api/bookings` ~25 times rapidly. The 21st+ should 429. Full live verification of timing is Phase 9 backlog (STATE.md line 239) — light smoke here is enough to confirm the guard exists.

    8. **Sidebar:** Confirm "Bookings" and "Reminder Settings" both appear in the dashboard sidebar.

    9. **Existing flows still work:** Quick smoke that existing booking + cancel + reschedule + branding + widget all still function (sanity check — Phase 7 baseline preserved).
  </how-to-verify>
  <resume-signal>
    Reply with "Phase 8 verified" if all 9 walkthrough items pass.

    OR list specific failures with item number + what went wrong; we'll diagnose and either fix in-line or open gap-closure plans via `/gsd:plan-phase 8 --gaps`.
  </resume-signal>
</task>

</tasks>

<verification>
1. `npm test -- rls-cross-tenant-matrix` passes (or skips cleanly without second user).
2. `npm test -- shell-render` passes.
3. `npm test` full suite green.
4. cron-job.org History shows successful 200 responses (or vercel.json has hourly schedule for Pro).
5. mail-tester score documented for both confirmation and reminder emails.
6. SUPABASE_SERVICE_ROLE_KEY uses sb_secret_* in local + Vercel.
7. Live walkthrough (Task 5) signed off by Andrew.
</verification>

<success_criteria>
- INFRA-05: RLS matrix test proves 2-tenant isolation across SELECT (4 tables) + UPDATE (1 table) + admin control case.
- EMAIL-08: mail-tester score ≥ 9/10 documented for both confirmation and reminder emails (or specific issues flagged).
- Cron operationally configured: cron-job.org hourly (Hobby) or vercel.json hourly (Pro).
- Render harness in place — TooltipProvider-style regressions caught at CI.
- Service role key migrated to sb_secret_* format.
- Andrew's end-to-end walkthrough signed off.
</success_criteria>

<output>
After completion, create `.planning/phases/08-reminders-hardening-and-dashboard-list/08-08-SUMMARY.md` documenting:
- Vercel tier confirmed (Hobby/Pro) and hourly cron driver chosen
- Second auth user UUID + nsi-rls-test account UUID
- mail-tester scores for both emails + any content issues
- RLS matrix test outcomes (which tables × which clients passed)
- Render harness scope (full ShellLayout vs lighter providers-only test)
- Service role key migration timestamp
- Phase 9 carryforward items (rate-limit live verification + any walkthrough failures triaged)
</output>
