---
phase: 10
plan: 07
type: execute
name: "profile-settings-and-soft-delete"
wave: 4
depends_on: ["10-05"]
files_modified:
  - "app/(shell)/app/settings/profile/page.tsx"
  - "app/(shell)/app/settings/profile/profile-form.tsx"
  - "app/(shell)/app/settings/profile/password-form.tsx"
  - "app/(shell)/app/settings/profile/slug-form.tsx"
  - "app/(shell)/app/settings/profile/delete-account-section.tsx"
  - "app/(shell)/app/settings/profile/actions.ts"
  - "app/(shell)/app/settings/profile/schema.ts"
  - "app/[account]/_lib/load-account-listing.ts"
  - "app/[account]/[event-slug]/_lib/load-event-type.ts"
  - "app/account-deleted/page.tsx"
  - "tests/account-soft-delete.test.ts"
  - "components/app-sidebar.tsx"
autonomous: true
must_haves:
  truths:
    - "/app/settings/profile renders email (read-only), display_name (editable), slug (editable), password (change form with current-password challenge), and a Danger Zone soft-delete section"
    - "Display name change updates accounts.display_name via RLS UPDATE"
    - "Slug change validates against RESERVED_SLUGS + collision (reuses /api/check-slug); on success, old slug 404s immediately (no 301 redirect)"
    - "Password change requires the current password to be re-entered and verified before update"
    - "Soft-delete requires user to type their exact slug in a confirmation field (GitHub-style); on submit, accounts.deleted_at = now(), user is logged out, redirected to a 'Account deleted' page"
    - "Public surfaces /[account]/, /[account]/[event-slug], /embed/[account]/[event-slug] return 404 when the resolved account has deleted_at IS NOT NULL"
    - "Sidebar IA includes a Settings → Profile link reachable from any /app page"
  artifacts:
    - path: "app/(shell)/app/settings/profile/page.tsx"
      provides: "Server Component shell loading the user's accounts row + rendering 4 forms (display name, slug, password, delete)"
    - path: "app/(shell)/app/settings/profile/actions.ts"
      provides: "updateDisplayNameAction, updateSlugAction, changePasswordAction, softDeleteAccountAction Server Actions"
      exports: ["updateDisplayNameAction", "updateSlugAction", "changePasswordAction", "softDeleteAccountAction"]
  key_links:
    - from: "app/[account]/_lib/load-account-listing.ts AND app/[account]/[event-slug]/_lib/load-event-type.ts"
      to: "accounts.deleted_at filter"
      via: ".is('deleted_at', null) on the SELECT query"
      pattern: "deleted_at.*null"
    - from: "softDeleteAccountAction"
      to: "supabase.auth.signOut() + redirect('/account-deleted')"
      via: "after UPDATE accounts SET deleted_at = now()"
    - from: "components/app-sidebar.tsx"
      to: "/app/settings/profile"
      via: "<Link href='/app/settings/profile'>Profile</Link>"
  requirements:
    - "ACCT-01 (/app/settings/profile route — display name, password change with current-password challenge, slug, email view)"
    - "ACCT-02 (soft-delete via accounts.deleted_at; type-slug-to-confirm GitHub-style)"
    - "ACCT-03 (soft-deleted accounts return 404 on all public surfaces)"
---

## Objective

Ship `/app/settings/profile` with editable display_name + slug + password (with current-password challenge per CONTEXT.md), email read-only, and a soft-delete section requiring slug-typed confirmation. Enforce the soft-delete 404 invariant on all 3 public surfaces (`/[account]`, `/[account]/[event-slug]`, `/embed/[account]/[event-slug]`) by adding `.is('deleted_at', null)` to the existing SELECT queries. Add the sidebar link so Profile is reachable from any /app page.

**Email-change scope decision:** Carved out into separate plan **10-08** to keep this plan focused on the locked profile fields + soft-delete. 10-08 adds the email-change flow with re-verification. Rationale: email change requires its own auxiliary verification flow (distinct from password reset), and combining it with this plan would push it past 3 tasks. CONTEXT.md Specifics flag explicitly invited this carve-out.

## Context

**Locked decisions (CONTEXT.md):**
- Editable: display name, password, slug, email. Email is in 10-08; this plan ships email as read-only with a "Change email" link to the 10-08 surface (placeholder until 10-08 ships in same wave-5).
- Password change requires current-password challenge.
- Slug change → old slug 404s immediately (no 301 redirect). User responsible for updating embedded links.
- Soft-delete: type-slug-to-confirm (GitHub-style). Immediate, no undo. Public 404. User logged out.

**Locked decisions (10-03 schema):**
- `accounts.deleted_at TIMESTAMPTZ` column added.
- `accounts_slug_active_idx` partial index supports the deleted_at IS NULL filter on public-surface lookups.

## Tasks

<task id="1" type="auto">
  <description>
    Build the profile settings route + 3 forms + Server Actions (display name, slug, password). Email change is split out to 10-08; this plan renders email read-only with a "Change email" link that 10-08 wires.

    **`app/(shell)/app/settings/profile/page.tsx`** (Server Component):
    - Auth check + load user's accounts row (display_name, slug, owner_email, created_at).
    - Render 4 sections: Email (read-only with "Change email" link to /app/settings/profile/email — Plan 10-08), Display Name form, Slug form, Password form, then Delete Account section (Task 3 below).

    **`app/(shell)/app/settings/profile/schema.ts`**:
    ```ts
    import { z } from "zod";
    export const displayNameSchema = z.object({ display_name: z.string().min(2).max(80) });
    export const slugSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{3,40}$/) });
    export const passwordSchema = z.object({
      current_password: z.string().min(1),
      new_password: z.string().min(8).max(72),
    });
    ```

    **`app/(shell)/app/settings/profile/actions.ts`** — Server Actions:

    `updateDisplayNameAction`:
    - Zod validate.
    - `supabase.from('accounts').update({ display_name }).eq('owner_user_id', uid)` — RLS enforces ownership.
    - `revalidatePath('/app/settings/profile')`; return { success: true }.

    `updateSlugAction`:
    - Zod validate.
    - Reject reserved (call `isReservedSlug`); reject collision (call `slug_is_taken` RPC from 10-06).
    - UPDATE accounts SET slug = new_slug WHERE owner_user_id = uid.
    - On success, `revalidatePath` and return success. Implementation note: we do NOT need to manually 404 the old slug — the `accounts.slug` UNIQUE constraint means the old slug literally no longer exists in the DB after UPDATE. Public surfaces query by slug; not-found = 404 by existing v1.0 logic.

    `changePasswordAction`:
    - Zod validate.
    - **Current-password challenge — COMMITTED PATTERN (no alternatives):**
      Create a TRANSIENT, cookie-less Supabase client using `createClient` from `@supabase/supabase-js` (the raw SDK, NOT `@/lib/supabase/server`). Use `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` directly. Call `signInWithPassword` on this transient client, discard the result — only the error/success matters. Because this client has no cookie persistence (no `auth.persistSession` storage hooked into Next.js cookies), it cannot displace or affect the user's active cookie-based session in any way.

      ```ts
      import { createClient as createSupabaseSdkClient } from "@supabase/supabase-js";

      // Inside changePasswordAction, AFTER zod validate + getClaims:
      const verifier = createSupabaseSdkClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,    // critical — no cookie/storage interference
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      );
      const { error: pwError } = await verifier.auth.signInWithPassword({
        email: claims.claims.email!,
        password: parsed.data.current_password,
      });
      if (pwError) {
        return { fieldErrors: { current_password: ["Current password is incorrect."] } };
      }
      // Discard the verifier — no signOut needed because nothing was persisted.
      ```

      `import "server-only"` is NOT required at the top of this file (this is the anon-key client, not service-role; it's safe to instantiate on either client or server, though we only call it from the Server Action). The existing `app/(shell)/...` Server Actions context is already server-side.

    - After challenge passes, `await supabase.auth.updateUser({ password: new_password })` on the regular cookie-bearing `createClient()` client — this updates the password on the user's active session.
    - On success: `revalidatePath('/app/settings/profile')`; return `{ success: true }`.

    Forms (`profile-form.tsx`, `slug-form.tsx`, `password-form.tsx`) — each is a separate `'use client'` component using RHF + useActionState. Inline success/error state. The slug form reuses the picker UI pattern from 10-06's account-form (debounced /api/check-slug call, reserved/taken messaging) — extract a shared `<SlugPickerInput>` component if helpful, or duplicate the small useEffect pattern.
  </description>
  <files>
    app/(shell)/app/settings/profile/page.tsx (new)
    app/(shell)/app/settings/profile/profile-form.tsx (new — display name)
    app/(shell)/app/settings/profile/slug-form.tsx (new)
    app/(shell)/app/settings/profile/password-form.tsx (new)
    app/(shell)/app/settings/profile/actions.ts (new)
    app/(shell)/app/settings/profile/schema.ts (new)
  </files>
  <verification>
    `npx tsc --noEmit` clean.
    Visit `/app/settings/profile` as Andrew — page renders email=ajwegner3@gmail.com (RO), display_name editable, slug editable, password change form visible.
    Update display_name → save → revalidate → name shown updated.
    Update slug from "nsi" to "nsi-test" → save → visit `/nsi/...` → 404; visit `/nsi-test/...` → works.
    Change password with wrong current password → "Current password is incorrect." Change with correct current password → success; verify by logging out + logging in with new password.
  </verification>
</task>

<task id="2" type="auto">
  <description>
    Enforce the soft-delete 404 invariant on all 3 public surfaces.

    Update the existing v1.0 SELECT queries to filter `.is('deleted_at', null)`:

    **`app/[account]/_lib/load-account-listing.ts`** — find the accounts SELECT and add:
    ```ts
    .is('deleted_at', null)
    ```
    before `.maybeSingle()` / `.single()`.

    **`app/[account]/[event-slug]/_lib/load-event-type.ts`** — same pattern. The query likely joins or sub-queries on accounts.slug; add the deleted_at filter to the accounts side. This loader is the SHARED data-access function used by BOTH `app/[account]/[event-slug]/page.tsx` AND `app/embed/[account]/[event-slug]/page.tsx` (both call `loadEventTypeForBookingPage()`), so a single edit here covers BOTH public surfaces — no separate edit to embed page needed.

    **Embed-page coverage (verification only, no edit):** open `app/embed/[account]/[event-slug]/page.tsx` and confirm it imports/calls `loadEventTypeForBookingPage` from `app/[account]/[event-slug]/_lib/load-event-type.ts` — if it does, the deleted_at filter we added in load-event-type.ts already protects the embed surface (404 inherited via the shared loader). Document this in the task's verification output. Do NOT modify the embed page itself; doing so would duplicate the filter and create drift risk.

    Existing v1.0 tests should continue to pass; add ONE new test case to whichever file has the most relevant tenant-resolution coverage:
    - File: `tests/rls-cross-tenant-matrix.test.ts` OR a dedicated `tests/account-soft-delete.test.ts` (new).
    - Case: seed an accounts row with deleted_at = now(); SELECT via the public surface helpers; assert returns null (i.e., 404 is what the page renders).

    Recommend creating `tests/account-soft-delete.test.ts` — keeps the matrix test focused on RLS, and the soft-delete invariant gets dedicated coverage.
  </description>
  <files>
    app/[account]/_lib/load-account-listing.ts (modify — add deleted_at filter)
    app/[account]/[event-slug]/_lib/load-event-type.ts (modify — add deleted_at filter; covers /[account]/[event-slug] AND /embed/[account]/[event-slug] via shared loader)
    tests/account-soft-delete.test.ts (new)
  </files>
  <verification>
    `npm test -- tests/account-soft-delete.test.ts` passes (insert deleted account → public lookup returns null).
    `npm test` overall passes.
    `git grep "loadEventTypeForBookingPage" app/embed/` returns 1+ matches — proves embed page inherits the deleted_at filter via the shared loader (no direct edit needed).
    Manual: UPDATE accounts SET deleted_at = now() WHERE slug='some-test-slug'; visit /some-test-slug/... → 404; visit /embed/some-test-slug/<event-slug> → 404. UPDATE back to null; visit both again → both render.
  </verification>
</task>

<task id="3" type="auto">
  <description>
    Build the soft-delete UI + Server Action + sidebar link.

    **`app/(shell)/app/settings/profile/delete-account-section.tsx`** (`'use client'`):
    Renders a "Danger Zone" card. Visible content: warning copy ("This permanently deletes your booking link, public bookings page, and all account data. This cannot be undone."). A text input that requires the user to type their exact slug. Submit button disabled until input.value === account.slug. On submit, calls `softDeleteAccountAction({ slug })`.

    **`softDeleteAccountAction`** in `app/(shell)/app/settings/profile/actions.ts`:
    ```ts
    export async function softDeleteAccountAction(input: { confirmation: string }) {
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      if (!claims?.claims) redirect("/app/login");

      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, slug")
        .eq("owner_user_id", claims.claims.sub)
        .is("deleted_at", null)
        .limit(1);
      const me = accounts?.[0];
      if (!me) redirect("/app");

      // Server-side confirmation (defense in depth — client also gates).
      if (input.confirmation !== me.slug) {
        return { error: "Confirmation must match your account slug exactly." };
      }

      const { error } = await supabase
        .from("accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", me.id);
      if (error) return { error: error.message };

      // Sign user out and redirect.
      await supabase.auth.signOut();
      revalidatePath("/", "layout");
      redirect("/account-deleted");
    }
    ```

    **`app/account-deleted/page.tsx`** (new) — simple Server Component:
    ```tsx
    export default function AccountDeleted() {
      return (
        <div className="min-h-screen p-8 max-w-md mx-auto">
          <h1 className="text-2xl font-semibold">Account deleted</h1>
          <p className="mt-4 text-gray-600">Your account and booking link have been removed. If this was a mistake, please contact support.</p>
          <a href="/app/login" className="mt-6 inline-block text-blue-600 underline">Back to log in</a>
        </div>
      );
    }
    ```

    **Sidebar update** — `components/app-sidebar.tsx`:
    Find the existing sidebar nav structure. Add a Settings group (or extend an existing one) with a "Profile" link to `/app/settings/profile`. Phase 12 owns the IA refactor (UI-05); for Phase 10, just ensure Profile is reachable. Acceptable: add a single "Settings" link that points to `/app/settings/profile` directly (Phase 12 will replace with the expandable Settings group with Reminders + Profile). If a "Reminders" link already exists at `/app/settings/reminders`, sit Profile next to it.
  </description>
  <files>
    app/(shell)/app/settings/profile/delete-account-section.tsx (new)
    app/(shell)/app/settings/profile/actions.ts (extend — add softDeleteAccountAction)
    app/account-deleted/page.tsx (new)
    components/app-sidebar.tsx (modify — add Profile link)
  </files>
  <verification>
    Visit `/app/settings/profile` — Danger Zone visible at bottom.
    Click delete with confirmation field empty → button disabled.
    Type wrong slug → button disabled.
    Type correct slug → button enabled → click → server action runs → user logged out → land on /account-deleted.
    Re-attempt log in with deleted user's email → can log in (auth.users still exists per ACCT-02 — only accounts.deleted_at is set), but /app redirects to /onboarding (because the user has no accounts row visible — it's filtered by deleted_at via the accounts SELECT in /app/page.tsx). Wait — this is a UX hole: the user logs back in and is sent to onboarding.

    Decision: the /app/page.tsx redirect logic (set in 10-06) currently filters `.is('deleted_at', null)` and on no rows redirects to /app/unlinked. After soft-delete, the user logging back in will hit /app/unlinked. Acceptable for v1.1 (deleted_at is set; no clean state to land on). Document this in the test plan for QA Phase 13.

    Sidebar smoke: navigate from /app, /app/event-types, /app/branding — all show a Settings/Profile link reaching /app/settings/profile.
  </verification>
</task>

## Verification Criteria

- `/app/settings/profile` renders all 4 sections (display_name, slug, password, delete).
- Display name update works; slug update works (with reserved + collision rejection); password change requires current password.
- Soft-delete with type-slug-confirm works end-to-end; user logged out; /account-deleted page renders.
- All 3 public surfaces 404 for soft-deleted accounts.
- Sidebar has a Profile link reachable from any /app page.
- New test `tests/account-soft-delete.test.ts` passes.
- `npx tsc --noEmit` clean. `npm test` passes.

## must_haves

- ACCT-01 — /app/settings/profile route with display_name editable, password change with current-password challenge, slug editable, email view.
- ACCT-02 — soft-delete via accounts.deleted_at; type-slug-to-confirm; immediate; no undo.
- ACCT-03 — soft-deleted accounts 404 on all public surfaces (/[account], /[account]/[event-slug], /embed/[account]/[event-slug]).
