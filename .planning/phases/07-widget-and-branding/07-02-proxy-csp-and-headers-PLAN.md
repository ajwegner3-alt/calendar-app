---
phase: 07-widget-and-branding
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - proxy.ts
  - next.config.ts
autonomous: false

user_setup:
  - service: supabase-storage
    why: "Logo uploads need a public Storage bucket. createBucket() idempotency unclear (RESEARCH Open Q1) — manual dashboard setup is the safest path."
    env_vars: []
    dashboard_config:
      - task: "Create public Storage bucket named 'branding'"
        location: "Supabase Dashboard -> Storage -> New bucket. Name: branding. Public: ON. Allowed MIME types: image/png. File size limit: 2 MB."

must_haves:
  truths:
    - "Visiting /embed/[anything] returns Content-Security-Policy: frame-ancestors * AND has no X-Frame-Options header"
    - "Visiting any non-/embed/* route (e.g. /, /app, /nsi/consultation) returns Content-Security-Policy: frame-ancestors 'self' AND X-Frame-Options: SAMEORIGIN"
    - "Supabase auth session cookies still set correctly on /app/* routes (proxy CSP work does not break updateSession())"
    - "Public Supabase Storage bucket 'branding' exists with PNG-only + 2 MB cap (manual dashboard step)"
  artifacts:
    - path: "proxy.ts"
      provides: "Per-route CSP branching (embed vs default) layered on top of updateSession()"
      contains: "frame-ancestors"
    - path: "next.config.ts"
      provides: "Global default headers (X-Frame-Options + X-Content-Type-Options)"
      contains: "X-Frame-Options"
  key_links:
    - from: "proxy.ts"
      to: "lib/supabase/proxy.ts updateSession"
      via: "preserves response from updateSession before mutating headers"
      pattern: "updateSession\\(request\\)"
    - from: "proxy.ts"
      to: "request.nextUrl.pathname"
      via: "branches on pathname.startsWith('/embed/')"
      pattern: "startsWith\\(.embed"
---

<objective>
Wire per-route Content-Security-Policy in proxy.ts so `/embed/*` allows framing from any origin (third-party site embeds) while every other route prevents framing. Set global default security headers in next.config.ts. Trigger the manual Supabase Storage bucket creation as a checkpoint (one-time dashboard action — RESEARCH Open Q1 prefers manual over scripted).

Purpose: This is the load-bearing security boundary for the embed widget. RESEARCH.md §Pattern 1 + Pitfall 1 both identify the proxy.ts approach as the only correct way to (a) DELETE X-Frame-Options on /embed/* and (b) preserve Supabase session cookies (Pitfall 2). Without this, the embed iframe is blocked by every browser AND owner sessions get logged out on every request.

Output: Updated `proxy.ts` (CSP branching), updated `next.config.ts` (global defaults), and a public Supabase `branding` bucket created via dashboard.
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

# Files modified
@proxy.ts
@next.config.ts
@lib/supabase/proxy.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add global default security headers in next.config.ts</name>
  <files>
    next.config.ts
  </files>
  <action>
    Replace the empty `nextConfig: NextConfig = {}` with a `headers()` function that returns global defaults for all routes. Source: RESEARCH.md §"next.config.ts — Global Security Headers".

    ```typescript
    import type { NextConfig } from "next";

    const nextConfig: NextConfig = {
      async headers() {
        return [
          {
            source: "/(.*)",
            headers: [
              { key: "X-Frame-Options", value: "SAMEORIGIN" },
              { key: "X-Content-Type-Options", value: "nosniff" },
            ],
          },
        ];
      },
    };

    export default nextConfig;
    ```

    DO NOT set `Content-Security-Policy` here — proxy.ts owns CSP because it must branch per-pathname. CSP set in next.config.ts cannot be conditionally deleted by proxy.ts (RESEARCH Pattern 1 + Pitfall 1).

    DO NOT add the widget.js cache headers section yet — Plan 07-05 owns the widget.js Route Handler approach (the `?v=` cache-bust strategy is in the snippet, not the file). next.config.ts headers() for `/widget.js` source pattern is OUT — Route Handler will set its own Cache-Control header.
  </action>
  <verify>
    `npm run build` succeeds (next.config validates at build time).
    `curl -I https://calendar-app-xi-smoky.vercel.app/` after deploy shows `X-Frame-Options: SAMEORIGIN` and `X-Content-Type-Options: nosniff`. (Verified after Task 3 deploy.)
  </verify>
  <done>
    next.config.ts exports headers() returning global defaults; build succeeds; ready for proxy.ts overlay.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add per-route CSP branching in proxy.ts (preserve Supabase session cookies)</name>
  <files>
    proxy.ts
  </files>
  <action>
    Modify the existing `proxy()` function to (a) capture the response from `updateSession()`, (b) branch on `request.nextUrl.pathname.startsWith("/embed/")`, (c) mutate the SAME response object's headers (NOT a fresh NextResponse — RESEARCH Pitfall 2: a fresh response drops the Supabase session cookie updates and logs the user out).

    Reference shape from RESEARCH.md §Pattern 1 (adapt to existing imports):

    ```typescript
    import { updateSession } from "@/lib/supabase/proxy";
    import { type NextRequest } from "next/server";

    export async function proxy(request: NextRequest) {
      const response = await updateSession(request);

      const { pathname } = request.nextUrl;

      if (pathname.startsWith("/embed/")) {
        // Embed route: allow framing from any origin (third-party site embeds)
        response.headers.set(
          "Content-Security-Policy",
          "frame-ancestors *",
        );
        // X-Frame-Options conflicts with frame-ancestors — must DELETE,
        // not just override. Some older browsers/proxies honor X-FO over CSP.
        response.headers.delete("X-Frame-Options");
      } else {
        // All other routes: prevent framing (defense in depth alongside next.config.ts default)
        response.headers.set(
          "Content-Security-Policy",
          "frame-ancestors 'self'",
        );
        // X-Frame-Options is set by next.config.ts; here we re-assert in case any
        // upstream layer cleared it. Idempotent and safe.
        response.headers.set("X-Frame-Options", "SAMEORIGIN");
      }

      return response;
    }

    export const config = {
      matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      ],
    };
    ```

    DO NOT introduce a fresh `NextResponse.next()`. Reuse the response from `updateSession()` (already a NextResponse with Supabase cookie mutations applied).

    The matcher stays unchanged — image asset exclusion is already correct.

    Why `pathname.startsWith("/embed/")` and not `=== "/embed"`: nested paths like `/embed/nsi/consultation` and `/embed/foo/bar` must all match. Trailing-slash form is canonical Next.js routing.
  </action>
  <verify>
    `npm run build` succeeds.
    Manual local check after `npm run dev`:
    - `curl -I http://localhost:3000/` → `Content-Security-Policy: frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`
    - `curl -I http://localhost:3000/embed/nsi/consultation` → `Content-Security-Policy: frame-ancestors *` AND no `X-Frame-Options` line
    - Sign in at /app/login, refresh — session persists (Pitfall 2 regression test). If session drops, `updateSession` response was discarded; revisit code.
    Note: /embed route returns 404 until Plan 07-03 lands — but the headers should still be set on the 404 response.
  </verify>
  <done>
    proxy.ts branches on /embed/ prefix, deletes X-Frame-Options on embed routes, preserves Supabase response object; sign-in session survives multiple requests; CSP headers verified via curl on both branches.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Andrew creates 'branding' Supabase Storage bucket via dashboard</name>
  <action>
    The Supabase JS `createBucket()` API has unclear idempotency (errors if exists vs. no-ops). Rather than write a one-shot script, Andrew creates the bucket manually via the Supabase Dashboard UI.

    Why this is human-action (not automated): Supabase Storage buckets are infrastructure-level resources. Treating them like migrations (auto-create) risks duplicate-create errors on re-deploy. The dashboard is the canonical place for one-time bucket setup.
  </action>
  <instructions>
    1. Visit https://supabase.com/dashboard/project/mogfnutxrrbtvnaupoun/storage/buckets
    2. Click "New bucket"
    3. Name: `branding`
    4. Public bucket: **ON** (toggle the switch — this is critical; private buckets break email/embed image rendering per RESEARCH §Pattern 4)
    5. Additional configuration:
       - Allowed MIME types: `image/png` (one entry, exact)
       - File size limit: `2` with unit `MB`
    6. Save / Create bucket
    7. Verify the bucket appears in the list with "Public" badge
    8. Optional sanity: upload a test PNG via the dashboard, copy the public URL, paste it in a browser — should render the image directly (no signed URL expiry)
  </instructions>
  <resume-signal>
    Reply "bucket created" once the `branding` bucket exists with Public + image/png + 2 MB. If you hit errors (e.g., bucket name taken on the project), reply with the error and we'll adjust the name in Plan 07-04.
  </resume-signal>
</task>

</tasks>

<verification>
- `curl -I https://calendar-app-xi-smoky.vercel.app/` → CSP frame-ancestors 'self' + X-Frame-Options: SAMEORIGIN (after deploy).
- `curl -I https://calendar-app-xi-smoky.vercel.app/embed/anything` → CSP frame-ancestors * AND no X-Frame-Options. (Returns 404 until 07-03 ships, but headers are still on the 404 response.)
- Owner login flow at /app/login still works; session survives 5+ subsequent requests (RESEARCH Pitfall 2 regression test).
- Supabase dashboard shows `branding` bucket with Public badge.
</verification>

<success_criteria>
1. proxy.ts CSP branching is live; verified via curl on both branches.
2. next.config.ts global X-Frame-Options + X-Content-Type-Options are set on every response.
3. Owner session persistence unchanged from Phase 6 (no regression from updateSession() handling).
4. `branding` Supabase Storage bucket exists, public, PNG-only, 2 MB cap.
5. Build green; no new TypeScript errors.
</success_criteria>

<output>
After completion, create `.planning/phases/07-widget-and-branding/07-02-SUMMARY.md` documenting:
- proxy.ts diff and rationale (RESEARCH Pitfall 2 — preserve updateSession response)
- next.config.ts header strategy (defaults here, CSP in proxy)
- Manual checkpoint outcome (bucket name confirmed; any naming overrides for Plan 07-04)
- Decisions locked: CSP lives ONLY in proxy.ts (never in next.config.ts); X-Frame-Options is next.config.ts default + proxy override
- Verification curl outputs (one per branch)
</output>
