---
phase: 10
plan: 06
type: execute
name: "onboarding-wizard-and-provisioning"
wave: 4
depends_on: ["10-05"]
files_modified:
  - "app/onboarding/layout.tsx"
  - "app/onboarding/page.tsx"
  - "app/onboarding/step-1-account/page.tsx"
  - "app/onboarding/step-1-account/account-form.tsx"
  - "app/onboarding/step-2-timezone/page.tsx"
  - "app/onboarding/step-2-timezone/timezone-form.tsx"
  - "app/onboarding/step-3-event-type/page.tsx"
  - "app/onboarding/step-3-event-type/event-type-form.tsx"
  - "app/onboarding/actions.ts"
  - "app/onboarding/schema.ts"
  - "app/api/check-slug/route.ts"
  - "lib/slug-suggestions.ts"
  - "lib/onboarding/welcome-email.ts"
  - "app/(shell)/app/page.tsx"
autonomous: true
must_haves:
  truths:
    - "After /auth/confirm, user with onboarding_complete=false lands on /onboarding (redirect from /app)"
    - "Wizard step 1 (display name + slug) auto-suggests kebab-cased slug from display name; live availability check via /api/check-slug debounced 300ms"
    - "Slug picker rejects entries in RESERVED_SLUGS with 'This URL is reserved' messaging (distinct from 'taken by another tenant')"
    - "When slug taken, picker suggests 3 alternatives (kebab-name-2, kebab-name-{email-prefix}, kebab-name-bookings)"
    - "Wizard step 2 timezone auto-detects via Intl.DateTimeFormat().resolvedOptions().timeZone, pre-selects, user confirms"
    - "Wizard step 3 first event type is REQUIRED, pre-filled with 'Consultation' / 30min / capacity=1; user can edit name/duration but cannot skip"
    - "On step 3 submit: (a) UPDATE accounts row (slug, display_name, timezone, onboarding_complete=true), (b) INSERT 5 default availability_rules, (c) INSERT 1 event_types row, (d) send welcome email — all via Server Action"
    - "Wizard abandonment: accounts.onboarding_step persists; on re-login user resumes at the step they left off"
    - "/app/page.tsx redirects to /onboarding when onboarding_complete=false (replacing the v1.0 /app/unlinked redirect for new users)"
  artifacts:
    - path: "app/onboarding/layout.tsx"
      provides: "Server Component layout that gates /onboarding/* — redirects to /app/login if not authed; redirects to /app if onboarding_complete=true"
    - path: "app/api/check-slug/route.ts"
      provides: "GET ?slug=foo → { available: bool, reason?: 'reserved' | 'taken', suggestions?: string[] }"
      exports: ["GET"]
    - path: "lib/slug-suggestions.ts"
      provides: "suggestSlugAlternatives(base, email): string[3] — generates kebab-name-2, kebab-name-{email-prefix}, kebab-name-bookings"
      exports: ["suggestSlugAlternatives"]
    - path: "app/onboarding/actions.ts"
      provides: "saveStep1Action, saveStep2Action, completeOnboardingAction Server Actions"
      exports: ["saveStep1Action", "saveStep2Action", "completeOnboardingAction"]
    - path: "lib/onboarding/welcome-email.ts"
      provides: "sendWelcomeEmail(account) — renders + sends post-wizard welcome email; quota-guarded"
  key_links:
    - from: "app/onboarding/step-1-account/account-form.tsx"
      to: "app/api/check-slug/route.ts"
      via: "fetch GET /api/check-slug?slug={value}, debounced 300ms"
      pattern: "fetch.*check-slug"
    - from: "app/api/check-slug/route.ts"
      to: "lib/reserved-slugs.ts + accounts table SELECT"
      via: "isReservedSlug() short-circuit; then RLS-scoped query for accounts.slug"
    - from: "app/onboarding/actions.ts (completeOnboardingAction)"
      to: "accounts UPDATE + availability_rules INSERT (5 rows) + event_types INSERT (1 row) + welcome email"
      via: "Single Server Action; uses RLS-scoped client (auth.uid() = owner_user_id)"
    - from: "app/(shell)/app/page.tsx"
      to: "/onboarding redirect"
      via: "if onboarding_complete=false on the user's accounts row → redirect"
  requirements:
    - "ONBOARD-01 (3-step wizard at /onboarding)"
    - "ONBOARD-02 (atomic account row finalization)"
    - "ONBOARD-03 (5 default Mon-Fri 9-5 availability_rules in user's TZ)"
    - "ONBOARD-04 (1 default event_types row, 30min, capacity=1)"
    - "ONBOARD-05 (slug regex + RESERVED_SLUGS rejection — completes the validation; consolidation was 10-01)"
    - "ONBOARD-06 (live collision detection via /api/check-slug, debounced)"
    - "ONBOARD-07 (3 alternative suggestions on collision)"
    - "ONBOARD-08 (welcome email post-wizard-completion, separate from Supabase verification email)"
---

## Objective

Ship the 3-step onboarding wizard at `/onboarding` (separate route group, OUTSIDE the (shell) layout to avoid sidebar/header before account is finalized). Implement the slug picker with live availability check, reserved-slug rejection, and 3-alternative suggestions on collision. Implement timezone auto-detect. Implement first-event-type pre-fill (required, can edit name/duration). On step 3 submit, atomically finalize the account stub (UPDATE), seed default availability rules + event type, and send the welcome email. Persist `onboarding_step` between steps so abandonment resumes correctly. Update `/app/page.tsx` to redirect new users to `/onboarding`.

## Context

**Locked decisions (CONTEXT.md):**
- Wizard collects display name + slug (step 1) → timezone confirm (step 2) → first event type (step 3, required).
- Slug auto-suggest from display name; 300ms debounced availability check.
- "This URL is reserved" messaging distinct from "taken by another tenant."
- Step 2 TZ auto-detect via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Step 3 REQUIRED — user cannot reach dashboard without an event type.
- Wizard abandonment: persist server-side via `accounts.onboarding_step` (added in 10-03).
- First event type pre-fill (Claude's Discretion): "Consultation" / 30min / capacity=1.

**Locked decisions (10-03 trigger pattern):**
- Account stub already exists with `onboarding_complete=false, slug=null, display_name=null, timezone='UTC', onboarding_step=1`.
- Wizard UPDATEs the stub via RLS-scoped client (auth.uid() = owner_user_id).
- Step 1 saves slug + display_name + onboarding_step=2.
- Step 2 saves timezone + onboarding_step=3.
- Step 3 saves event_types + availability_rules + flips onboarding_complete=true.

## Tasks

<task id="1" type="auto">
  <description>
    Create the wizard route group + layout + per-step pages + Server Actions.

    **Routing approach:** use `app/onboarding/` (top-level, NOT inside `(shell)` group — wizard pages should not render the sidebar). Each step is its own route segment so URLs are:
    - `/onboarding` (router redirects to current step based on accounts.onboarding_step)
    - `/onboarding/step-1-account`
    - `/onboarding/step-2-timezone`
    - `/onboarding/step-3-event-type`

    **`app/onboarding/layout.tsx`** (Server Component, gates entire wizard):
    ```ts
    import { redirect } from "next/navigation";
    import { createClient } from "@/lib/supabase/server";

    export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      if (!claims?.claims) redirect("/app/login");

      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, onboarding_complete, onboarding_step")
        .eq("owner_user_id", claims.claims.sub)
        .is("deleted_at", null)
        .limit(1);

      const me = accounts?.[0];
      if (!me) {
        // Trigger should have created a stub. If absent, send to /app — error fallback.
        redirect("/app");
      }
      if (me.onboarding_complete) redirect("/app");

      // Wizard chrome (minimal — Phase 12 restyles): step indicator + container.
      return (
        <div className="min-h-screen bg-white p-8">
          <div className="mx-auto max-w-xl">
            <div className="mb-8 text-sm text-gray-500">Step {me.onboarding_step} of 3</div>
            {children}
          </div>
        </div>
      );
    }
    ```

    **`app/onboarding/page.tsx`** (router that redirects to the correct step):
    ```ts
    import { redirect } from "next/navigation";
    import { createClient } from "@/lib/supabase/server";

    export default async function OnboardingRouter() {
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const { data: accounts } = await supabase
        .from("accounts")
        .select("onboarding_step")
        .eq("owner_user_id", claims!.claims.sub)
        .limit(1);
      const step = accounts?.[0]?.onboarding_step ?? 1;
      redirect(`/onboarding/step-${step}-${stepName(step)}`);
    }

    function stepName(s: number) {
      return s === 1 ? "account" : s === 2 ? "timezone" : "event-type";
    }
    ```

    **`app/onboarding/schema.ts`**:
    ```ts
    import { z } from "zod";

    export const step1Schema = z.object({
      display_name: z.string().min(2).max(80),
      slug: z.string().regex(/^[a-z0-9-]{3,40}$/, "Use 3–40 lowercase letters, numbers, or hyphens"),
    });

    export const step2Schema = z.object({
      timezone: z.string().min(3).max(64), // IANA TZ — server validates via try/catch on Intl.DateTimeFormat
    });

    export const step3Schema = z.object({
      name: z.string().min(2).max(80),
      duration_minutes: z.number().int().min(5).max(480),
      // capacity defaults to 1 — Phase 11 will expose per-event-type capacity input;
      // Phase 10 doesn't surface this in the wizard.
    });
    ```

    **`app/onboarding/actions.ts`** — three Server Actions matching the steps. Each one:
    1. Zod validates.
    2. Calls `supabase.auth.getClaims()`; redirect to login if no session.
    3. UPDATEs the user's accounts row via RLS-scoped client.
    4. On success, increments `onboarding_step` (step 1 → 2 → 3) and `redirect(/onboarding/step-N-...)`.

    `completeOnboardingAction` (called from step 3) is special — it does:
    1. Zod validate event-type input.
    2. UPDATE accounts SET onboarding_complete=true (slug/display_name/timezone are already set from steps 1+2).
    3. INSERT 5 availability_rules rows: weekday 1-5 (Mon-Fri), 09:00-17:00 each, in the saved timezone. Use the v1.0 availability_rules schema as reference (load from migration `20260419120000_initial_schema.sql` or recent availability migrations).
    4. INSERT 1 event_types row. **CRITICAL — explicit column shape:**
       ```ts
       // max_bookings_per_slot is OMITTED — Phase 11 adds this column with DEFAULT 1.
       // Hardcoding it here would crash for every Phase-10 signup because the column
       // does not exist yet. When Phase 11 ships, the new column gets DEFAULT 1 which
       // applies retroactively to rows inserted now AND to all future inserts.
       const { error: etError } = await supabase
         .from("event_types")
         .insert({
           account_id: me.id,
           name: parsed.data.name,                  // user-edited "Consultation" or whatever
           slug: "consultation",                    // kebab(name) if collision-prone; v1.0 unique constraint is per-account so this is safe across tenants
           duration_minutes: parsed.data.duration_minutes,
           is_active: true,
           // max_bookings_per_slot omitted — Phase 11 adds this column with DEFAULT 1
         });
       ```
       Use the v1.0 event_types schema as reference (`supabase/migrations/20260419120000_initial_schema.sql`) — confirm the exact column list AT EXECUTION TIME (any v1.0 columns like `description`, `buffer_minutes` etc. should also be omitted unless the wizard collects them; their defaults will apply).
    5. Send welcome email via `sendWelcomeEmail(account)` from `lib/onboarding/welcome-email.ts` (Task 4).
    6. `revalidatePath("/", "layout"); redirect("/app");`.

    All 3 Steps form pages + Client form components: `'use client'` RHF + useActionState. Step 1 includes the slug picker UI from Task 2. Step 2 includes the TZ auto-detect (via `useEffect(() => setValue('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone), [])`). Step 3 includes the pre-filled event-type form ("Consultation" / 30 min).

    **CRITICAL — error handling on completeOnboardingAction:** If event_types INSERT fails (e.g., slug collision because Andrew somehow created `nsi/consultation` and a new user also picked "Consultation" → kebab="consultation"), surface a clear error and DO NOT mark onboarding_complete=true. The 4-step flow should be:
    a. Validate everything.
    b. Try INSERT availability_rules + event_types in a single transaction (use a Postgres function OR sequential INSERTs with rollback-on-second-failure). Acceptable v1.1 simplification: sequential INSERTs; if event_types fails, DELETE the availability_rules and return error to user.
    c. Only mark onboarding_complete=true after ALL inserts succeed.
    d. Welcome email is fire-and-forget (logged but not gated).

    **Note on event_types slug uniqueness:** the v1.0 schema is `(account_id, slug)` unique — different accounts CAN both have `consultation`. So this is not actually a collision risk for new users. Document this in the action comments.
  </description>
  <files>
    app/onboarding/layout.tsx (new)
    app/onboarding/page.tsx (new)
    app/onboarding/step-1-account/page.tsx (new)
    app/onboarding/step-1-account/account-form.tsx (new)
    app/onboarding/step-2-timezone/page.tsx (new)
    app/onboarding/step-2-timezone/timezone-form.tsx (new)
    app/onboarding/step-3-event-type/page.tsx (new)
    app/onboarding/step-3-event-type/event-type-form.tsx (new)
    app/onboarding/schema.ts (new)
    app/onboarding/actions.ts (new)
  </files>
  <verification>
    `npx tsc --noEmit` clean.
    Manual: log in as a new user (post-10-05 signup); land on `/onboarding/step-1-account`; submit display_name="Acme HVAC" + slug="acme-hvac" → step-2; confirm TZ auto-detected; submit → step-3; submit event-type → land on `/app`.
    Manual abandonment: log out at step-2; log back in → routed to step-2-timezone (NOT step-1).
  </verification>
</task>

<task id="2" type="auto">
  <description>
    Build slug picker: `/api/check-slug` route + suggestion helper + client UI.

    **`lib/slug-suggestions.ts`**:
    ```ts
    /**
     * Generate 3 slug alternatives when the requested slug is taken.
     * Strategy:
     *   1. base + "-2" (e.g., acme-2)
     *   2. base + "-" + email-prefix (e.g., acme-andrew)
     *   3. base + "-bookings" (e.g., acme-bookings)
     *
     * All outputs validated against the same regex /^[a-z0-9-]{3,40}$/.
     * Caller is responsible for re-checking these against accounts.slug + RESERVED_SLUGS.
     */
    export function suggestSlugAlternatives(base: string, email: string): string[] {
      const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
      const emailPrefix = slug(email.split("@")[0] ?? "");
      return [
        slug(`${base}-2`),
        emailPrefix && emailPrefix !== base ? slug(`${base}-${emailPrefix}`) : slug(`${base}-3`),
        slug(`${base}-bookings`),
      ].filter((s) => /^[a-z0-9-]{3,40}$/.test(s));
    }
    ```
    Plus `lib/slug-suggestions.test.ts` with cases for: short base, base with caps, base with special chars, email with no @ prefix.

    **`app/api/check-slug/route.ts`** — GET handler:
    ```ts
    import { NextResponse, type NextRequest } from "next/server";
    import { createClient } from "@/lib/supabase/server";
    import { isReservedSlug } from "@/lib/reserved-slugs";
    import { suggestSlugAlternatives } from "@/lib/slug-suggestions";
    import { z } from "zod";

    const querySchema = z.object({
      slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
    });

    export async function GET(req: NextRequest) {
      const url = new URL(req.url);
      const parsed = querySchema.safeParse({ slug: url.searchParams.get("slug") });
      if (!parsed.success) {
        return NextResponse.json({ available: false, reason: "invalid" }, { status: 200 });
      }
      const { slug } = parsed.data;

      // Auth check — only authenticated users in onboarding need this.
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      if (!claims?.claims) {
        return NextResponse.json({ available: false, reason: "unauthorized" }, { status: 401 });
      }

      // Reserved short-circuit (FREE — no DB call).
      if (isReservedSlug(slug)) {
        return NextResponse.json({ available: false, reason: "reserved" });
      }

      // Collision check via RLS-scoped client. Note: RLS allows SELECT on own-account
      // rows only — but for slug uniqueness we need to know if ANY account has this slug.
      // Solution: a public-readable function `slug_exists(p_slug text) returns boolean`
      // OR a non-RLS-enforced view. v1.0 already has the unique constraint at DB level;
      // for the picker UX we check via the existing public-surface load functions.
      // Simplest: use the `accounts` SELECT via an RPC (created in this task as a
      // SECURITY DEFINER function returning boolean), since the wizard user only
      // sees own row via direct SELECT.

      // For Phase 10: add the helper RPC inline in this plan's migration deltas.
      // (See Task 2b below.)

      const { data: exists, error } = await supabase.rpc("slug_is_taken", { p_slug: slug });
      if (error) {
        // Fail OPEN — show as available; the UPDATE in completeOnboarding will catch the collision.
        return NextResponse.json({ available: true });
      }

      if (exists) {
        const email = claims.claims.email ?? "";
        const suggestions = suggestSlugAlternatives(slug, email);
        return NextResponse.json({ available: false, reason: "taken", suggestions });
      }

      return NextResponse.json({ available: true });
    }
    ```

    **Task 2b (inline migration):** create `supabase/migrations/20260428120004_phase10_slug_is_taken_fn.sql`:
    ```sql
    -- Phase 10: SECURITY DEFINER function for slug-availability check from /api/check-slug.
    -- Returns true if a non-soft-deleted account has this slug.
    create or replace function public.slug_is_taken(p_slug text)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
    as $$
      select exists(
        select 1 from accounts
        where slug = p_slug
          and deleted_at is null
      );
    $$;

    -- Allow authenticated users to call it (anon does not need to; signup is for authed wizard).
    grant execute on function public.slug_is_taken(text) to authenticated;
    ```
    Apply via `npx supabase db query --linked -f supabase/migrations/20260428120004_phase10_slug_is_taken_fn.sql`.

    **Client side** (in `account-form.tsx` from Task 1): add a debounced check using `useEffect` + `setTimeout(300ms)` cleared on dependency change. Render an inline `<span class="text-green-600">Available</span>` / `<span class="text-red-600">This URL is reserved</span>` / `<span class="text-red-600">Taken — try {sugg1}, {sugg2}, {sugg3}</span>` with clickable suggestions.

    Auto-suggest from display name: a separate `useEffect` that watches `display_name` value, computes `kebab(value)`, and calls `setValue('slug', kebabbed)` IFF the user has not manually edited the slug field (track via a `slugTouched` ref).
  </description>
  <files>
    lib/slug-suggestions.ts (new)
    lib/slug-suggestions.test.ts (new)
    app/api/check-slug/route.ts (new)
    supabase/migrations/20260428120004_phase10_slug_is_taken_fn.sql (new)
    app/onboarding/step-1-account/account-form.tsx (extend with picker UI)
  </files>
  <verification>
    `npm test -- lib/slug-suggestions.test.ts` passes (4+ cases).
    Apply slug_is_taken migration; `npx supabase db query --linked -c "select slug_is_taken('nsi');"` returns t; `select slug_is_taken('does-not-exist');` returns f.
    Manual: in wizard step 1, type display_name="Acme HVAC" — slug field auto-fills "acme-hvac"; backspace and type "app" → "This URL is reserved"; type "nsi" → "Taken — try nsi-2, nsi-andrew, nsi-bookings".
  </verification>
</task>

<task id="3" type="auto">
  <description>
    Build the welcome email helper + wire the redirect change.

    **`lib/onboarding/welcome-email.ts`**:
    ```ts
    import "server-only";
    import { sendEmail } from "@/lib/email-sender";
    import { checkAndConsumeQuota, QuotaExceededError } from "@/lib/email-sender/quota-guard";

    // Resolved email-sender entry point (verified 2026-04-28): the project uses
    // a vendored email-sender package at lib/email-sender/index.ts. The exported
    // function is `sendEmail(options)` (NOT `sendTransactionalEmail`). All v1.0
    // booking/reminder senders import the same symbol — we mirror that pattern here.

    export async function sendWelcomeEmail(account: {
      owner_email: string;
      display_name: string;
      slug: string;
    }): Promise<void> {
      // Quota guard FIRST (per 10-04 contract — signup-side callers gate before send).
      try {
        await checkAndConsumeQuota("signup-welcome");
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          console.error("[welcome-email] quota exceeded; skipping welcome", e);
          return; // Fire-and-forget — wizard already succeeded.
        }
        // Non-quota error from the guard means "fail open" already happened inside
        // the guard (DB hiccup); proceed with the send.
      }

      const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://calendar-app.example.com"}/${account.slug}`;
      const subject = "Your booking link is live";
      const html = `
        <p>Hi ${escapeHtml(account.display_name)},</p>
        <p>Your booking link is live: <a href="${bookingUrl}">${bookingUrl}</a></p>
        <p>Share it on your website, business card, or anywhere clients reach you.</p>
        <p>— NSI Booking</p>
      `;
      const text = `Hi ${account.display_name},\n\nYour booking link: ${bookingUrl}\n\n— NSI Booking`;

      // DO NOT pass `from` — the sendEmail singleton constructs defaultFrom from
      // GMAIL_FROM_NAME + GMAIL_USER env vars. (Same pattern as send-booking-confirmation.ts.)
      const result = await sendEmail({
        to: account.owner_email,
        subject,
        html,
        text,
      });
      if (!result.success) {
        // Welcome email is fire-and-forget per Task 1 spec — log and continue.
        console.error("[welcome-email] sendEmail failed (non-fatal):", result.error);
      }
    }

    function escapeHtml(s: string): string {
      return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    }
    ```

    **Update `app/(shell)/app/page.tsx`** (the dashboard home from earlier read):
    Currently: `if (linkedCount === 0) redirect("/app/unlinked");`
    Change to: check the user's accounts row directly and redirect to `/onboarding` if `onboarding_complete = false`. Keep `/app/unlinked` as a fallback for the truly-no-accounts edge case.

    ```ts
    // Replace the linkedCount = 0 branch:
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("onboarding_complete")
      .eq("owner_user_id", claims!.claims.sub)
      .is("deleted_at", null)
      .limit(1);

    if (error) throw new Error(`Failed to load account: ${error.message}`);
    if (!accounts || accounts.length === 0) redirect("/app/unlinked");
    if (!accounts[0].onboarding_complete) redirect("/onboarding");

    return <WelcomeCard />;
    ```

    Note: this preserves the v1.0 `/app/unlinked` route for the "auth.users exists but accounts row missing" edge case (which the trigger should prevent, but defense in depth).
  </description>
  <files>
    lib/onboarding/welcome-email.ts (new)
    app/(shell)/app/page.tsx (modify — add onboarding_complete check)
  </files>
  <verification>
    `npx tsc --noEmit` clean.
    Manual end-to-end: signup → verify email → /auth/confirm → land on /onboarding; complete wizard; receive welcome email; land on /app dashboard.
    Manual existing user: log in as Andrew → /app loads (NOT redirected to /onboarding) because his onboarding_complete=true.
  </verification>
</task>

## Verification Criteria

- All 3 wizard steps render and persist progress.
- Slug picker enforces RESERVED_SLUGS + collision detection + 3 suggestions.
- Step 3 atomically creates: accounts UPDATE (onboarding_complete=true) + 5 availability_rules + 1 event_types row + welcome email.
- `/app/page.tsx` redirects new users to `/onboarding`.
- `npx tsc --noEmit` clean. `npm test` passes.

## must_haves

- ONBOARD-01 — 3-step wizard at /onboarding.
- ONBOARD-02 — atomic account row finalization (UPDATE of stub created by trigger).
- ONBOARD-03 — 5 default Mon-Fri 9-5 availability rules in user's TZ.
- ONBOARD-04 — 1 default event_types row, 30min, capacity=1, slug=consultation.
- ONBOARD-05 — slug regex + RESERVED_SLUGS rejection.
- ONBOARD-06 — live collision detection, debounced 300ms.
- ONBOARD-07 — 3 alternative suggestions on collision.
- ONBOARD-08 — welcome email post-completion.
