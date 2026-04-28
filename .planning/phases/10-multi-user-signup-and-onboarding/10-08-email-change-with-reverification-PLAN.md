---
phase: 10
plan: 08
type: execute
name: "email-change-with-reverification"
wave: 5
depends_on: ["10-07"]
files_modified:
  - "app/(shell)/app/settings/profile/email/page.tsx"
  - "app/(shell)/app/settings/profile/email/email-change-form.tsx"
  - "app/(shell)/app/settings/profile/email/actions.ts"
  - "app/(shell)/app/settings/profile/email/schema.ts"
  - "app/(shell)/app/settings/profile/page.tsx"
autonomous: true
must_haves:
  truths:
    - "User can request an email change at /app/settings/profile/email by entering a new email address"
    - "Supabase sends a confirmation link to the NEW email; clicking it routes through /auth/confirm with type=email_change"
    - "After confirmation, the auth.users.email field updates AND accounts.owner_email updates (via post-confirm hook OR a SECURITY DEFINER function called from the wizard step)"
    - "Email change is rate-limited (3/hour per user) and quota-guarded ('email-change' category)"
    - "If the new email is already in use, return generic 'If that email is available, you will receive a confirmation link' messaging (P-A1)"
  artifacts:
    - path: "app/(shell)/app/settings/profile/email/page.tsx"
      provides: "Email change request form"
    - path: "app/(shell)/app/settings/profile/email/actions.ts"
      provides: "requestEmailChangeAction Server Action calling supabase.auth.updateUser({ email })"
      exports: ["requestEmailChangeAction"]
  key_links:
    - from: "app/(shell)/app/settings/profile/email/actions.ts"
      to: "supabase.auth.updateUser({ email: new_email })"
      via: "Server Action; Supabase fires the email_change confirmation email automatically"
    - from: "app/auth/confirm/route.ts (existing from 10-02)"
      to: "type=email_change handling"
      via: "verifyOtp({ type: 'email_change', token_hash }) — verifyOtp itself updates auth.users.email"
    - from: "Post-confirm trigger or app code"
      to: "accounts.owner_email"
      via: "Either a trigger on auth.users UPDATE OF email, OR a sync call inside /auth/confirm route after verifyOtp success"
  requirements:
    - "Closes CONTEXT.md Specifics scope decision: 'Email change with re-verification — planner decides whether it lives inside Phase 10 or splits' — DECISION: dedicated Plan 10-08 inside Phase 10"
    - "Extends ACCT-01 (email becomes editable, was deferred from 10-07)"
---

## Objective

Ship the email-change-with-re-verification flow as a dedicated plan inside Phase 10. The user requests a change at `/app/settings/profile/email`, Supabase sends a verification link to the NEW email, clicking it routes through `/auth/confirm` (type=email_change, already handled by 10-02's verifyOtp pattern), and on success both `auth.users.email` AND `accounts.owner_email` are updated.

**Scope decision documentation:** CONTEXT.md flagged this as planner-discretion: "Plan-phase should decide whether this lives inside Phase 10 or splits into its own plan/sub-phase given the auxiliary verification flow it introduces." DECISION: dedicated plan inside Phase 10. Rationale:
- The verifyOtp pattern at /auth/confirm already supports `type='email_change'`; only one extra path needed.
- Wave count stays at 9 (within ROADMAP's ~7-9 estimate).
- Email change is "table stakes" for any account-settings page; deferring to v1.2 would create an awkward "you can change everything but your email" gap.
- Auxiliary verification flow does not require new infrastructure — uses existing /auth/confirm + email-template (Supabase auto-sends on `updateUser({ email })`).

## Context

**Locked decisions (CONTEXT.md):** "Email change requires confirm-new-email re-verification."

**Supabase pattern:**
```ts
// Server-side, with the user authenticated:
await supabase.auth.updateUser({ email: 'new@example.com' });
// Supabase automatically sends an email to the NEW address with a confirmation link.
// The link includes ?token_hash=...&type=email_change.
// Default Supabase behavior: it sends ONE confirmation to the new email; if "Secure email change" is enabled in Supabase Auth settings, it ALSO sends a notice/confirmation to the OLD email. Default for Supabase is "Secure email change" = ON.
// On user clicking the link: /auth/confirm calls verifyOtp({ type: 'email_change', token_hash }), which updates auth.users.email.
```

**Cross-system sync:** `accounts.owner_email` must stay in sync with `auth.users.email`. Two options:
- Option A: Trigger on `auth.users` UPDATE OF email — fires AFTER UPDATE, propagates to accounts.
- Option B: Sync inline in /auth/confirm after `verifyOtp` success (when type=email_change).

**Decision: Option A (trigger).** Mirrors the 10-03 atomicity-first pattern; ensures sync even if email change happens via Supabase admin API or another future code path. Add the trigger in this plan's migration.

## Tasks

<task id="1" type="auto">
  <description>
    Add the auth.users.email → accounts.owner_email sync trigger.

    Create `supabase/migrations/20260428120005_phase10_sync_account_email.sql`:
    ```sql
    -- Phase 10 (10-08): keep accounts.owner_email in sync with auth.users.email
    -- after verifyOtp(type=email_change) updates the auth.users row.

    create or replace function public.sync_account_email_on_auth_update()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
    as $$
    begin
      if new.email is distinct from old.email then
        update public.accounts
          set owner_email = new.email
          where owner_user_id = new.id;
      end if;
      return new;
    end;
    $$;

    drop trigger if exists sync_account_email_on_auth_update on auth.users;
    create trigger sync_account_email_on_auth_update
      after update of email on auth.users
      for each row execute function public.sync_account_email_on_auth_update();
    ```

    Apply: `npx supabase db query --linked -f supabase/migrations/20260428120005_phase10_sync_account_email.sql`.
  </description>
  <files>supabase/migrations/20260428120005_phase10_sync_account_email.sql (new)</files>
  <verification>
    Apply migration. `npx supabase db query --linked -c "select tgname from pg_trigger where tgname='sync_account_email_on_auth_update';"` returns 1 row.
    Smoke (DESTRUCTIVE — dev only): pick a test user; UPDATE auth.users SET email = 'new@x.com' WHERE id = '...'; SELECT owner_email FROM accounts WHERE owner_user_id = '...' — confirms it updated.
  </verification>
</task>

<task id="2" type="auto">
  <description>
    Build the email-change request route + Server Action.

    **`app/(shell)/app/settings/profile/email/schema.ts`**:
    ```ts
    import { z } from "zod";
    export const emailChangeSchema = z.object({
      new_email: z.string().email().max(254),
    });
    ```

    **`app/(shell)/app/settings/profile/email/actions.ts`**:
    ```ts
    "use server";
    import { headers } from "next/headers";
    import { revalidatePath } from "next/cache";
    import { createClient } from "@/lib/supabase/server";
    import { checkAuthRateLimit } from "@/lib/auth/rate-limits";
    import { checkAndConsumeQuota, QuotaExceededError } from "@/lib/email-sender/quota-guard";
    import { emailChangeSchema } from "./schema";

    export async function requestEmailChangeAction(_prev: any, formData: FormData) {
      const parsed = emailChangeSchema.safeParse({ new_email: formData.get("new_email") });
      if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      if (!claims?.claims) return { formError: "Please log in." };

      const h = await headers();
      const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const origin = h.get("origin") ?? "";

      // Rate limit per (ip + uid) — uid is fine because the user is already authenticated
      // here. Keying on uid prevents cross-device bypass while tolerating shared-IP
      // scenarios (office NAT, mobile carriers). Uses the dedicated `emailChange`
      // threshold added to AUTH_RATE_LIMITS in Plan 10-05 (3/hour, same numeric value
      // as forgotPassword but a SEPARATE key — so future tuning of one doesn't
      // silently change the other).
      const rl = await checkAuthRateLimit("emailChange", `${ip}:${claims.claims.sub}`);
      if (!rl.allowed) return { formError: "Too many email-change attempts. Please wait an hour." };

      // Quota guard: count this against signup-class email volume.
      try {
        await checkAndConsumeQuota("email-change");
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          return { formError: "Email changes are temporarily unavailable. Please try again tomorrow." };
        }
      }

      // Trigger the email-change. Supabase sends to the NEW email automatically.
      const { error } = await supabase.auth.updateUser(
        { email: parsed.data.new_email },
        { emailRedirectTo: `${origin}/auth/confirm?next=/app/settings/profile&type_hint=email_change` },
      );

      if (error) {
        // Generic — never distinguish "email already in use" (P-A1).
        console.error("[email-change] updateUser error (returning generic):", error);
      }

      revalidatePath("/app/settings/profile");
      return { success: true, message: "Check your new email for a confirmation link. Your email won't change until you click it." };
    }
    ```

    **`app/(shell)/app/settings/profile/email/email-change-form.tsx`** (`'use client'`):
    RHF + useActionState. Single field: new_email. Disclaimer text below: "We'll send a confirmation link to the new address. Your email won't change until you click it." Inline success/error message.

    **`app/(shell)/app/settings/profile/email/page.tsx`** (Server Component):
    Loads the user's current email (via getClaims + accounts SELECT). Renders the current email plus the EmailChangeForm.

    **Update `app/(shell)/app/settings/profile/page.tsx`** (from 10-07):
    Replace the placeholder "Change email" link with a real link to `/app/settings/profile/email`.
  </description>
  <files>
    app/(shell)/app/settings/profile/email/schema.ts (new)
    app/(shell)/app/settings/profile/email/actions.ts (new)
    app/(shell)/app/settings/profile/email/email-change-form.tsx (new)
    app/(shell)/app/settings/profile/email/page.tsx (new)
    app/(shell)/app/settings/profile/page.tsx (modify — wire "Change email" link)
  </files>
  <verification>
    `npx tsc --noEmit` clean.
    Manual: log in as a test user; visit /app/settings/profile/email; submit a new email; check the new email inbox for confirmation; click link → /auth/confirm → land on /app/settings/profile (or /app); verify auth.users.email updated AND accounts.owner_email updated (via the trigger).
    Burst test: 4 email-change requests within 1 hour → 4th returns rate-limit message.
    `npm test` passes.
  </verification>
</task>

## Verification Criteria

- `supabase/migrations/20260428120005_phase10_sync_account_email.sql` applied; trigger exists.
- `/app/settings/profile/email` route renders + functional.
- Email change end-to-end: request → email arrives at new address → click link → auth.users.email updated → accounts.owner_email updated automatically via trigger.
- Rate limit + quota guard wired.
- `npx tsc --noEmit` clean. `npm test` passes.

## must_haves

- Closes CONTEXT.md Specifics scope question — email-change ships in Phase 10 (Plan 10-08).
- Extends ACCT-01 — email becomes editable (with re-verification).
