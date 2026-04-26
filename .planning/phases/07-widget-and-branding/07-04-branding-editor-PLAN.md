---
phase: 07-widget-and-branding
plan: 04
type: execute
wave: 2
depends_on: ["07-01", "07-02"]
files_modified:
  - app/(shell)/app/branding/page.tsx
  - app/(shell)/app/branding/_lib/actions.ts
  - app/(shell)/app/branding/_lib/schema.ts
  - app/(shell)/app/branding/_lib/load-branding.ts
  - app/(shell)/app/branding/_components/branding-editor.tsx
  - app/(shell)/app/branding/_components/logo-uploader.tsx
  - app/(shell)/app/branding/_components/color-picker-input.tsx
  - app/(shell)/app/branding/_components/preview-iframe.tsx
autonomous: false

must_haves:
  truths:
    - "Andrew can visit /app/branding and see the current logo + primary color for the nsi account"
    - "Andrew can upload a PNG (max 2 MB) and it is stored in Supabase Storage 'branding' bucket; logo_url column is updated"
    - "Andrew can type a hex color OR use the native color picker; on save, brand_primary column is updated"
    - "A live preview iframe alongside the editor reflects color/logo changes BEFORE save (via postMessage to the embed page)"
    - "Save action validates: hex matches /^#[0-9a-fA-F]{6}$/; PNG content-type; file size ≤ 2 MB"
  artifacts:
    - path: "app/(shell)/app/branding/page.tsx"
      provides: "Server Component: loads current branding for owner's account, renders BrandingEditor"
    - path: "app/(shell)/app/branding/_lib/actions.ts"
      provides: "uploadLogoAction(formData) + savePrimaryColorAction(hex) Server Actions; uses createAdminClient for storage"
      exports: ["uploadLogoAction", "savePrimaryColorAction"]
    - path: "app/(shell)/app/branding/_lib/schema.ts"
      provides: "Zod schemas for hex color and file upload"
      exports: ["primaryColorSchema", "logoFileSchema"]
    - path: "app/(shell)/app/branding/_components/branding-editor.tsx"
      provides: "Client component: orchestrates LogoUploader + ColorPickerInput + PreviewIframe"
    - path: "app/(shell)/app/branding/_components/preview-iframe.tsx"
      provides: "Iframe pointing to /embed/<account-slug>/<first-active-event-slug>?previewColor=...&previewLogo=...; re-renders src on changes"
    - path: "app/(shell)/app/branding/_components/logo-uploader.tsx"
      provides: "PNG upload with client-side size + type validation; calls uploadLogoAction"
    - path: "app/(shell)/app/branding/_components/color-picker-input.tsx"
      provides: "Hex text input + native <input type=color> bound together; live emits onChange"
  key_links:
    - from: "app/(shell)/app/branding/_lib/actions.ts"
      to: "Supabase Storage 'branding' bucket"
      via: "createAdminClient().storage.from('branding').upload()"
      pattern: "storage\\.from.*branding"
    - from: "app/(shell)/app/branding/_lib/actions.ts"
      to: "accounts table"
      via: "UPDATE logo_url + brand_primary WHERE id = ownerAccountId"
      pattern: "from\\(.accounts.\\)\\.update"
    - from: "app/(shell)/app/branding/_components/preview-iframe.tsx"
      to: "/embed/[account]/[event-slug]?previewColor=...&previewLogo=..."
      via: "iframe.src updated on color/logo change"
      pattern: "previewColor"
---

<objective>
Build the branding editor at `/app/branding`. Owner can upload a PNG logo (≤ 2 MB) and pick a primary color (free hex input + native color picker). Side-by-side live preview iframe pointing at `/embed/<account>/<first-active-event>` updates with `?previewColor=` and `?previewLogo=` query params on every change BEFORE save. Save persists `logo_url` + `brand_primary` to the `accounts` row via Server Actions.

Purpose: Delivers BRAND-01 (logo upload), BRAND-02 (color setting). The live preview is a CONTEXT decision lock — owners need to see what visitors see before committing. Uses the `?previewColor`/`?previewLogo` hooks that Plan 07-03 already plumbed into the embed page.

Output: Branding editor route with upload + color picker + preview iframe + Server Actions; bucket already exists from Plan 07-02 manual checkpoint.
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
@.planning/phases/07-widget-and-branding/07-02-SUMMARY.md

# Existing patterns to mirror
@app/(shell)/app/event-types/_lib/actions.ts
@app/(shell)/app/event-types/_lib/schema.ts
@app/(shell)/app/event-types/_components/event-type-form.tsx
@lib/supabase/admin.ts
@lib/supabase/server.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Schema + Server Actions + branding loader</name>
  <files>
    app/(shell)/app/branding/_lib/schema.ts
    app/(shell)/app/branding/_lib/load-branding.ts
    app/(shell)/app/branding/_lib/actions.ts
  </files>
  <action>
    Create `_lib/schema.ts`:
    ```typescript
    import { z } from "zod";

    export const primaryColorSchema = z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB format (e.g. #0A2540)");

    // File validation runs BOTH client-side (UX) and server-side (truth).
    // Server limit also enforced by Supabase bucket policy (PNG only, 2 MB).
    export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
    ```

    Create `_lib/load-branding.ts`:
    ```typescript
    import "server-only";
    import { createClient } from "@/lib/supabase/server";

    export interface BrandingState {
      accountId: string;
      accountSlug: string;
      logoUrl: string | null;
      primaryColor: string | null;
      firstActiveEventSlug: string | null; // for preview iframe target; null = no events yet
    }

    /**
     * Loads branding state for the OWNER's account.
     *
     * Auth model: uses RLS-scoped server client (createClient from @supabase/ssr).
     * The owner is logged in; RLS scopes to their account_id automatically.
     * Returns null if owner is not linked to any account (Phase 2 unlinked state).
     */
    export async function loadBrandingForOwner(): Promise<BrandingState | null> {
      const supabase = await createClient();

      // Owner -> accounts they own (current_owner_account_ids RPC from Phase 2)
      const { data: accountIds } = await supabase.rpc("current_owner_account_ids");
      const ids = Array.isArray(accountIds) ? accountIds : [];
      if (ids.length === 0) return null;

      const accountId = ids[0]; // v1 single-account-per-owner; multi later

      const { data: account } = await supabase
        .from("accounts")
        .select("id, slug, logo_url, brand_primary")
        .eq("id", accountId)
        .maybeSingle();

      if (!account) return null;

      // First active, non-soft-deleted event for preview-iframe target
      const { data: firstEvent } = await supabase
        .from("event_types")
        .select("slug")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        accountId: account.id,
        accountSlug: account.slug,
        logoUrl: account.logo_url,
        primaryColor: account.brand_primary,
        firstActiveEventSlug: firstEvent?.slug ?? null,
      };
    }
    ```

    Create `_lib/actions.ts`:
    ```typescript
    "use server";
    import { revalidatePath } from "next/cache";
    import { createClient } from "@/lib/supabase/server";
    import { createAdminClient } from "@/lib/supabase/admin";
    import { primaryColorSchema, MAX_LOGO_BYTES } from "./schema";

    export interface ActionResult<T = void> {
      ok?: boolean;
      data?: T;
      error?: string;
      fieldErrors?: Record<string, string[]>;
    }

    /**
     * Two-stage owner authorization (mirrors Phase 6 cancelBookingAsOwner pattern):
     * 1. RLS-scoped client confirms current owner OWNS this accountId via current_owner_account_ids RPC
     * 2. Service-role admin client performs Storage upload + accounts UPDATE
     */
    async function getOwnerAccountIdOrThrow(): Promise<string> {
      const supabase = await createClient();
      const { data: ids } = await supabase.rpc("current_owner_account_ids");
      const arr = Array.isArray(ids) ? ids : [];
      if (arr.length === 0) throw new Error("Not linked to any account.");
      return arr[0];
    }

    export async function uploadLogoAction(formData: FormData): Promise<ActionResult<{ logoUrl: string }>> {
      try {
        const file = formData.get("file");
        if (!(file instanceof File)) return { error: "No file provided." };
        if (file.size > MAX_LOGO_BYTES) return { error: "File too large (max 2 MB)." };
        if (file.type !== "image/png") return { error: "PNG only." };

        const accountId = await getOwnerAccountIdOrThrow();

        const admin = createAdminClient();
        const path = `${accountId}/logo.png`;

        const { error: uploadError } = await admin.storage
          .from("branding")
          .upload(path, file, {
            contentType: "image/png",
            upsert: true,
            cacheControl: "3600",
          });

        if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

        // Cache-bust: append ?v={timestamp} so Gmail/CDN cache misses on the new URL.
        // Public URLs don't change on upsert, so we add a query param the DB stores.
        const { data: urlData } = admin.storage.from("branding").getPublicUrl(path);
        const versionedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

        const { error: updateError } = await admin
          .from("accounts")
          .update({ logo_url: versionedUrl })
          .eq("id", accountId);

        if (updateError) return { error: `DB update failed: ${updateError.message}` };

        revalidatePath("/app/branding");
        return { ok: true, data: { logoUrl: versionedUrl } };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Unknown error" };
      }
    }

    export async function savePrimaryColorAction(hex: string): Promise<ActionResult> {
      const parsed = primaryColorSchema.safeParse(hex);
      if (!parsed.success) {
        return { fieldErrors: { primaryColor: parsed.error.issues.map((i) => i.message) } };
      }

      try {
        const accountId = await getOwnerAccountIdOrThrow();
        const admin = createAdminClient();
        const { error } = await admin
          .from("accounts")
          .update({ brand_primary: parsed.data })
          .eq("id", accountId);

        if (error) return { error: `DB update failed: ${error.message}` };

        revalidatePath("/app/branding");
        return { ok: true };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Unknown error" };
      }
    }

    export async function deleteLogoAction(): Promise<ActionResult> {
      try {
        const accountId = await getOwnerAccountIdOrThrow();
        const admin = createAdminClient();
        // Best-effort delete from Storage (ignore not-found); always clear DB column.
        await admin.storage.from("branding").remove([`${accountId}/logo.png`]);
        const { error } = await admin
          .from("accounts")
          .update({ logo_url: null })
          .eq("id", accountId);
        if (error) return { error: `DB update failed: ${error.message}` };
        revalidatePath("/app/branding");
        return { ok: true };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Unknown error" };
      }
    }
    ```

    KEY DECISIONS:
    - Cache-bust via `?v={timestamp}` appended to the public URL stored in DB. Solves Pitfall 7 (Gmail proxy caching) — every upload yields a new URL even though Storage path is stable.
    - Two-stage auth: RLS-scoped check on owner -> admin client for Storage + cross-table UPDATE. Mirrors Phase 6 cancelBookingAsOwner lock.
    - `revalidatePath("/app/branding")` after every mutation; client uses `router.refresh()` after action call (Phase 3 lock).
    - No try/catch inside action (Phase 3 lock) — but here we DO use one outer try because `getOwnerAccountIdOrThrow` can throw. Acceptable variation given the auth check shape.
  </action>
  <verify>
    `npx tsc --noEmit` passes.
    Files exist with correct exports.
    No new dependencies added (uses existing `@/lib/supabase/server` + `admin` + `zod`).
  </verify>
  <done>
    Schema defines hex regex; loader returns BrandingState for owner; 3 Server Actions (upload, save color, delete logo) with two-stage auth + cache-bust + revalidate.
  </done>
</task>

<task type="auto">
  <name>Task 2: Build all client components (LogoUploader + ColorPickerInput + PreviewIframe + BrandingEditor)</name>
  <files>
    app/(shell)/app/branding/_components/logo-uploader.tsx
    app/(shell)/app/branding/_components/color-picker-input.tsx
    app/(shell)/app/branding/_components/preview-iframe.tsx
    app/(shell)/app/branding/_components/branding-editor.tsx
  </files>
  <action>
    Create 4 client components in this order. All `"use client"`.

    **logo-uploader.tsx**:
    - File input restricted `accept="image/png"` + label drop zone
    - Client-side validation: `file.size > 2 * 1024 * 1024` → toast error; `file.type !== "image/png"` → toast error
    - On valid file: build FormData, call `uploadLogoAction(fd)`, on success toast "Logo updated" + call `onUpload(newUrl)` so parent can update preview
    - "Remove logo" button calls `deleteLogoAction()`
    - Shows current logo as `<img src={currentLogoUrl}>` if present

    **color-picker-input.tsx**:
    - Two bound inputs: `<input type="text">` (hex string) + `<input type="color">` (native picker)
    - Local `value` state; on either input change, normalize to `#RRGGBB` and call `onChange(hex)` (parent owns state for live preview)
    - Validate format on blur (toast if not 7-char hex starting with #)
    - "Save color" button calls `savePrimaryColorAction(value)`

    **preview-iframe.tsx**:
    - Receives `accountSlug`, `firstActiveEventSlug`, `previewColor`, `previewLogo` props
    - Renders `<iframe src={url}>` where url is `/embed/${accountSlug}/${firstActiveEventSlug}?previewColor=${encodeURIComponent(previewColor)}&previewLogo=${encodeURIComponent(previewLogo ?? "")}`
    - Width 100%; height fixed at 600px (preview is bounded; we don't auto-resize the preview iframe)
    - On `previewColor`/`previewLogo` change, key the iframe by URL so React re-mounts it (forces a fresh load with new params)
    - Empty state when `firstActiveEventSlug === null`: render a placeholder "Create your first event type to see a live preview" with a Link to `/app/event-types/new`

    Use approach (b) from RESEARCH §Pattern 7: iframe src with query params. Simpler than postMessage from editor → embed; works without Plan 07-03 needing extra postMessage receivers.

    **branding-editor.tsx** (top-level orchestrator):
    - Receives `BrandingState` as prop
    - useState for `primaryColor` (initial: state.primaryColor ?? "#0A2540"), `logoUrl` (initial: state.logoUrl)
    - Two-column layout (md:grid-cols-2): left column = LogoUploader + ColorPickerInput, right column = PreviewIframe
    - Passes `primaryColor` + `logoUrl` to PreviewIframe so changes propagate live
    - Passes `onUpload` callback to LogoUploader (sets logoUrl state)
    - Passes `onChange` to ColorPickerInput (sets primaryColor state)
    - Use sonner `toast` for all feedback (Phase 3 lock)
    - Use `useTransition` for action calls (Phase 3 lock)

    Layout sketch:
    ```
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h2>Logo</h2>
        <LogoUploader currentLogoUrl={logoUrl} onUpload={setLogoUrl} />

        <h2 className="mt-8">Primary color</h2>
        <ColorPickerInput value={primaryColor} onChange={setPrimaryColor} />
      </section>
      <section>
        <h2>Live preview</h2>
        <PreviewIframe accountSlug={state.accountSlug} firstActiveEventSlug={state.firstActiveEventSlug} previewColor={primaryColor} previewLogo={logoUrl} />
      </section>
    </div>
    ```

    DO NOT install any shadcn primitives — file input is native (shadcn doesn't have an input file component); color picker is native; everything else uses Button + Input + Label which are already installed.
  </action>
  <verify>
    `npx tsc --noEmit` passes.
    All 4 component files exist.
    `grep "use client"` confirms all 4 are client components.
  </verify>
  <done>
    LogoUploader handles PNG-only validated upload; ColorPickerInput binds text + color picker; PreviewIframe re-mounts on prop change; BrandingEditor orchestrates with live state.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire branding/page.tsx + dev-server smoke check</name>
  <files>
    app/(shell)/app/branding/page.tsx
  </files>
  <action>
    Replace the stub `app/(shell)/app/branding/page.tsx`:

    ```tsx
    import { redirect } from "next/navigation";
    import { loadBrandingForOwner } from "./_lib/load-branding";
    import { BrandingEditor } from "./_components/branding-editor";

    export default async function BrandingPage() {
      const state = await loadBrandingForOwner();
      if (!state) redirect("/app/unlinked");

      return (
        <div className="max-w-6xl">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold">Branding</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your logo and pick your primary color. Changes apply to the
              public booking page, the embeddable widget, and email templates.
            </p>
          </header>
          <BrandingEditor state={state} />
        </div>
      );
    }
    ```

    The `redirect("/app/unlinked")` mirrors the Phase 2 lock for owners not linked to an account (placeholder route exists).
  </action>
  <verify>
    Run `npm run dev`. Sign in as Andrew. Visit `/app/branding`.
    - Should see Logo section + Color section on the left, Preview iframe on the right.
    - Upload a small PNG (try a 100KB test file). Confirm it appears in current-logo display + live preview.
    - Try uploading a JPG → toast "PNG only".
    - Try uploading a 5MB PNG → toast "File too large".
    - Type `#ff0000` in color text input → preview iframe re-mounts with red.
    - Use native color picker to pick a green → text input updates to e.g. `#00ff00`; preview updates.
    - Click "Save color" → toast "Saved"; refresh page; color persists.
    - Verify in Supabase Storage dashboard: `branding/<account-id>/logo.png` exists.
    - Verify in Supabase Table Editor: `accounts.logo_url` ends with `?v=<timestamp>`; `accounts.brand_primary` matches the saved hex.
  </verify>
  <done>
    /app/branding fully functional: upload, color picker, save color, live preview, all persist to DB + Storage.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Andrew smoke-tests the branding editor live</name>
  <what-built>
    Branding editor at /app/branding with logo upload, color picker, and live preview iframe pointing at /embed/<account>/<first-active-event>.
  </what-built>
  <how-to-verify>
    1. Pull latest, run `npm run dev` (or visit Vercel preview if the branch is deployed).
    2. Sign in to /app/login as Andrew.
    3. Navigate to /app/branding.
    4. Confirm side-by-side layout: editor on left, preview iframe on right.
    5. Type `#FF6B6B` (coral) in the hex input → preview reloads with coral.
    6. Click the native color picker, pick a teal → both inputs sync; preview reloads.
    7. Click "Save color" → see "Saved" toast.
    8. Refresh /app/branding → coral/teal (whichever you saved last) persists.
    9. Upload a PNG logo (any small PNG you have). Confirm:
       - Toast "Logo updated"
       - Logo shows in current-logo display
       - Logo appears in preview iframe header
    10. Try uploading a JPG → toast "PNG only" (no upload happens).
    11. Try uploading a >2MB PNG → toast "File too large".
    12. Open a new tab to /nsi/<your-event-slug> (the public booking page) — branding NOT YET applied (Plan 07-06 wires this; preview iframe is correct but the production booking page still uses default colors). This is expected.
    13. Click "Remove logo" → logo cleared from preview + DB.
    14. Re-upload the PNG to leave Andrew's NSI logo in place for downstream plan demos.
  </how-to-verify>
  <resume-signal>
    Reply "branding editor approved" to continue to Plan 07-05. If anything fails (preview doesn't update, save errors, layout broken), describe and we'll fix before proceeding.
  </resume-signal>
</task>

</tasks>

<verification>
- Visit /app/branding while logged in → editor loads with current state.
- Upload a PNG → success toast → DB has new logo_url with `?v=` cache-bust → Storage has file.
- Save a hex color → success toast → DB has brand_primary updated.
- Live preview iframe re-mounts on every change.
- Reject paths: JPG, oversized PNG, malformed hex all caught with user-visible errors.
- Phase 5/6 booking pages still render normally (Plan 07-06 hasn't wired branding into them yet — that's expected).
</verification>

<success_criteria>
1. BRAND-01: Logo upload working end-to-end (Storage + DB).
2. BRAND-02: Primary color (hex + native color picker) saves to DB.
3. Live preview iframe shows changes BEFORE save (CONTEXT lock).
4. Two-stage owner auth applied (RLS check then admin client).
5. Cache-busting `?v=` query param prevents Gmail proxy stale-image issue.
6. All client-side + server-side validation in place; bucket-level limits provide third layer.
</success_criteria>

<output>
After completion, create `.planning/phases/07-widget-and-branding/07-04-SUMMARY.md` documenting:
- Files created (page.tsx, 3 _lib files, 4 _components files)
- Server Action contracts (uploadLogoAction returns logoUrl with `?v=` cache-bust)
- Two-stage auth lock (RLS check via current_owner_account_ids RPC, then admin client)
- Cache-bust strategy (timestamped query param) and rationale (Pitfall 7)
- Live preview approach (RESEARCH §Pattern 7 option b: iframe src with query params, key by URL for re-mount)
- Smoke test outcome from Andrew
- Forward contract: downstream plans (07-06 booking page branding, 07-07 emails) read from `accounts.logo_url` (which includes `?v=` already) and pass directly to <img src={...}> without further manipulation
</output>
