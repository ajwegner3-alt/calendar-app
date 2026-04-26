# Phase 7: Widget + Branding - Research

**Researched:** 2026-04-25
**Domain:** Embeddable widget (postMessage + iframe), per-route CSP headers (Next.js 16 proxy.ts), Supabase Storage (logo upload), branding propagation, WCAG contrast
**Confidence:** HIGH (most critical areas verified against official docs)

---

## Summary

Phase 7 introduces per-account branding (logo + primary color) across four surfaces, an embeddable widget (`widget.js` + iframe), a chromeless `/embed/[account]/[event-slug]` route, and a public `/[account]` event-type index. The stack is already established (Next.js 16, Supabase, Tailwind v4, shadcn/ui, Resend) — no new runtime dependencies are required except optionally `dompurify` + `jsdom` for SVG sanitization server-side.

The most important architectural decisions resolved by research: (1) use `proxy.ts` (not `next.config.ts` headers) to set per-route CSP because proxy runs per-request and can branch on pathname; (2) use a **public** Supabase Storage bucket for logo URLs — private signed URLs are unsuitable for email rendering and cross-origin embed images; (3) `widget.js` goes in `public/widget.js` with a versioned path or `?v=` cache-bust query param, served with `max-age=0` (default) which is acceptable since Vercel CDN edge-caches it automatically; (4) SVG logos must be **rejected**, not sanitized — accept PNG only in v1 given the rendering complexity and XSS surface; (5) the `accounts` table already has `logo_url text` and `brand_primary text` columns from the Phase 1 migration — no schema migration is needed for branding columns, only a migration to add the bucket configuration.

**Primary recommendation:** Implement CSP branching in `proxy.ts`, serve the embed route chromeless with `frame-ancestors *` via proxy header, store logos in a public Supabase bucket (PNG only, 2 MB limit), and implement the postMessage auto-resize protocol with `event.source` matching for origin validation.

---

## Standard Stack

All libraries already installed. No new deps required for core functionality.

### Core (already in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.4 | Framework + proxy.ts CSP control | Already installed; proxy.ts is Next 16's renamed middleware |
| @supabase/supabase-js | ^2.103.1 | Storage upload + getPublicUrl | Already installed |
| tailwindcss | ^4.2.0 | Inline CSS vars for per-account color | Already installed |
| sonner | ^2.0.7 | Toast on copy (Phase 3 pattern) | Already installed |

### Optional Addition (for SVG rejection guard, server-side)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | — | SVG rejection = check MIME type on upload | Accept PNG only; skip sanitize-svg entirely |

**Installation:** No new packages required for v1 scope.

---

## Architecture Patterns

### Recommended Project Structure
```
app/
├── embed/
│   └── [account]/
│       └── [event-slug]/
│           └── page.tsx          # Chromeless booking page (no site chrome)
├── [account]/
│   ├── page.tsx                  # Public event-type index (EMBED-08)
│   └── [event-slug]/             # existing booking page
│       └── ...
├── (shell)/app/
│   ├── branding/
│   │   └── page.tsx              # Stub → real editor (BRAND-01, BRAND-02)
│   └── event-types/
│       └── page.tsx              # Add "Get embed code" kebab entry
public/
└── widget.js                     # Static loader script (EMBED-02)
lib/
└── branding/
    ├── read-branding.ts          # Server-side: reads logo_url + primary_color from accounts
    └── contrast.ts               # WCAG luminance → white/black text picker
supabase/migrations/
└── 20260428120000_branding_bucket.sql  # Bucket creation (if done via SQL)
```

### Pattern 1: Per-Route CSP via proxy.ts

**What:** `proxy.ts` checks `request.nextUrl.pathname` and sets different `Content-Security-Policy` + `X-Frame-Options` headers on `/embed/*` vs. all other routes.

**When to use:** When you need different security headers on different route trees. `next.config.ts` `headers()` runs before proxy but cannot branch per-request with logic; proxy.ts can.

**Critical notes:**
- Next.js 16 renamed `middleware.ts` → `proxy.ts`. The existing file is already `proxy.ts`. The exported function is `proxy()` not `middleware()`.
- Execution order: `next.config.ts headers()` FIRST, then proxy.ts. So next.config.ts sets global defaults; proxy.ts overrides for specific paths.
- The existing `proxy.ts` calls `updateSession()` (Supabase auth refresh) and returns the response. The CSP headers must be appended to THAT response, not a fresh one, or the Supabase cookies will be lost.
- `X-Frame-Options` cannot be "removed" by proxy — you can only avoid setting it. The strategy: set `X-Frame-Options: SAMEORIGIN` globally in `next.config.ts headers()`, then in proxy.ts for `/embed/*` paths, override the response to delete that header and set `CSP: frame-ancestors *`.

**Example — proxy.ts CSP branching:**
```typescript
// proxy.ts (extends existing updateSession logic)
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy

import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  // Run Supabase session refresh first (gets back supabaseResponse with cookies)
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/embed/")) {
    // Embed route: allow framing from any origin
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors *"
    );
    // Remove X-Frame-Options — it conflicts with CSP frame-ancestors
    response.headers.delete("X-Frame-Options");
  } else {
    // All other routes: prevent framing
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'self'"
    );
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

**Alternative — next.config.ts header overriding:**

The `headers()` array in `next.config.ts` supports "last-match-wins" behavior: a more-specific `source` later in the array overrides an earlier wildcard. However, this approach runs at build time, cannot branch dynamically, and cannot DELETE a header (only overwrite). Use proxy.ts for the delete-X-Frame-Options requirement.

```typescript
// next.config.ts — can set the global default, proxy.ts handles /embed/* overrides
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};
```

### Pattern 2: widget.js Static Asset

**What:** `public/widget.js` — plain JavaScript (not TypeScript, not bundled) served at `/widget.js`. No CORS headers needed for script tags (scripts are not subject to CORS; only XHR/fetch are).

**Serving approach:** `public/widget.js` is simplest. Default cache headers from Next.js/Vercel for public/ files are `Cache-Control: public, max-age=0`. Vercel's edge CDN auto-caches it at the edge even without an explicit `max-age`. For versioning, use `?v=DEPLOY_ID` query param in the snippet shown to owners — or embed a version comment in the file.

**Cache strategy:**
- `next.config.ts` `headers()` can set a custom `Cache-Control` on `/widget.js` (source: `'/widget.js'`). Recommend `public, max-age=3600, s-maxage=86400` (1h browser, 24h CDN). Vercel edge will cache across deploys unless you change the filename or query param.
- For deploy-time cache busting: include `?v=` in the owner-facing snippet only. The actual `/widget.js` file has no version in its name.

**Example — next.config.ts header for widget.js:**
```typescript
// next.config.ts
{
  source: "/widget.js",
  headers: [
    { key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" },
    { key: "Access-Control-Allow-Origin", value: "*" }, // unnecessary for <script> but harmless
  ],
}
```

**CORS note:** `<script src="...">` tags do NOT trigger CORS preflight — the browser fetches the script as a "no-cors" request. CORS headers on widget.js are unnecessary. However, `fetch()` calls INSIDE the widget do need CORS headers on the API endpoints they hit — `/api/slots`, `/api/bookings` — which are already handled by the Next.js route handlers.

### Pattern 3: postMessage Auto-Resize Protocol

**What:** The `/embed/` page runs a `ResizeObserver` on `document.body` and posts height to `window.parent`. The host page (`widget.js`) listens and matches `event.source` to the correct iframe.

**Origin validation strategy:**
- Inside the embed (sender): posts to `"*"` because the host origin is unknown. This is safe — the message only contains content height, no secrets.
- In widget.js (receiver): validates `event.source === iframe.contentWindow` to ensure the message came from our iframe, not a foreign frame. Do NOT use `event.origin` for validation (the embed is on our own origin anyway).

**Handshake timeout:** After injecting the iframe, `widget.js` starts a 5-second timer. If no `nsi-booking:height` message arrives, it renders the fallback error UI inline.

**Example — embed page (sends height):**
```typescript
// app/embed/[account]/[event-slug]/page.tsx or a client component
// Source: pattern from https://jacobfilipp.com/iframe-height-autoresize-crossdomain/
"use client";
import { useEffect, useRef } from "react";

export function EmbedHeightReporter() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;

    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "nsi-booking:height", height }, "*");
    };

    sendHeight(); // initial

    const observer = new ResizeObserver(sendHeight);
    observer.observe(rootRef.current);

    return () => observer.disconnect();
  }, []);

  return <div ref={rootRef}>{/* embed content */}</div>;
}
```

**Example — widget.js (receives height, validates source):**
```javascript
// public/widget.js
(function () {
  if (window.__nsiWidgetLoaded) return; // idempotency guard
  window.__nsiWidgetLoaded = true;

  var BASE_URL = "https://calendar-app-xi-smoky.vercel.app"; // replaced at build/template time

  function initWidget(el) {
    var account = el.getAttribute("data-nsi-account");
    var event = el.getAttribute("data-nsi-event");
    if (!account || !event) return;

    // Skeleton placeholder
    el.innerHTML = '<div style="background:#f3f4f6;height:400px;border-radius:8px;"></div>';

    var iframe = document.createElement("iframe");
    iframe.src = BASE_URL + "/embed/" + account + "/" + event;
    iframe.style.cssText = "width:100%;border:0;display:block;";
    iframe.scrolling = "no";

    // Generate unique id for this widget instance
    var instanceId = "nsi-" + Math.random().toString(36).slice(2);
    iframe.id = instanceId;

    // Handshake timeout
    var timeout = setTimeout(function () {
      el.innerHTML =
        'Booking unavailable \u2014 <a href="' +
        BASE_URL + "/nsi/" + event +
        '" target="_blank">open booking page</a>';
    }, 5000);

    window.addEventListener("message", function (evt) {
      if (
        !evt.data ||
        evt.data.type !== "nsi-booking:height" ||
        evt.source !== iframe.contentWindow  // source validation — not origin
      ) return;
      clearTimeout(timeout);
      iframe.style.height = evt.data.height + "px";
      el.innerHTML = ""; // remove skeleton
      el.appendChild(iframe);
    });

    el.appendChild(iframe);
  }

  // Discover all mount points
  document.querySelectorAll("[data-nsi-calendar]").forEach(initWidget);
})();
```

**ResizeObserver re-fire loop prevention:** The observer fires when the iframe height CHANGES. Setting `iframe.style.height` on the host page does not trigger a re-observe inside the embed (the embed observes its OWN root element). No loop risk.

**Multiple widgets:** Each `[data-nsi-calendar]` element gets its own iframe object. The `message` listener validates `evt.source === iframe.contentWindow` — each closure captures its own `iframe` reference, so routing is automatic per-element.

### Pattern 4: Supabase Storage for Logos

**Bucket:** Create a public bucket named `branding` (or `logos`). Public buckets bypass access controls for GET requests — URLs are stable, permanent, CDN-cached, and usable in emails without expiry. Private + signed URLs break email rendering (URL expires before Gmail re-fetches from cache).

**Bucket creation via supabase-js admin client:**
```typescript
// One-time setup — call from a migration script or Supabase dashboard
const { error } = await supabaseAdmin.storage.createBucket("branding", {
  public: true,
  allowedMimeTypes: ["image/png"],       // PNG only — reject SVG
  fileSizeLimit: "2MB",
});
```

**Upload pattern (from Server Action):**
```typescript
// app/(shell)/app/branding/_lib/actions.ts
const path = `${accountId}/logo.png`;
const { error } = await supabaseAdmin.storage
  .from("branding")
  .upload(path, file, {
    contentType: "image/png",
    upsert: true,                         // replace existing logo
    cacheControl: "3600",
  });

if (error) throw new Error("Upload failed");

const { data } = supabaseAdmin.storage.from("branding").getPublicUrl(path);
// data.publicUrl is stable and permanent
```

**Path structure:** `branding/{account_id}/logo.png` — upsert overwrites on re-upload. No UUID suffix needed since upsert: true replaces in-place.

**Client-side size validation (belt):** `file.size > 2 * 1024 * 1024 → reject with error message` before the Server Action call.
**Server-side size validation (suspenders):** Supabase bucket `fileSizeLimit: "2MB"` rejects oversized uploads at the storage layer.

**SVG rejection — why not accept SVG:**
- SVG files are XML with executable script content (`<script>`, `onload` event handlers). Even when rendered via `<img>` (safe), uploading and storing untrusted SVG in a public bucket on the app's own domain is risky if any page ever serves it with `Content-Type: text/html` or via a direct link.
- `canIEmail` shows 92.86% email client SVG support, but Outlook for Windows (still widely used in enterprise) has inconsistent SVG support.
- Server-side SVG sanitization requires `dompurify` + `jsdom` (~3 MB dev dep), which is disproportionate for a v1 single-tenant tool.
- **Decision: accept PNG only.** The bucket `allowedMimeTypes: ["image/png"]` enforces this at the storage layer. The UI shows "PNG only, max 2 MB."

### Pattern 5: WCAG Auto-Text-Color

**What:** Given a user's primary hex color (e.g. `#0070f3`), compute whether white or black text provides sufficient contrast for WCAG AA (4.5:1 ratio).

**Algorithm (verified against W3C spec):**
```typescript
// lib/branding/contrast.ts
// Source: https://www.w3.org/WAI/GL/wiki/Relative_luminance

function linearize(c: number): number {
  const sRGB = c / 255;
  return sRGB <= 0.04045
    ? sRGB / 12.92
    : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Returns "#ffffff" or "#000000" — whichever passes 4.5:1 against `bgHex`. */
export function pickTextColor(bgHex: string): "#ffffff" | "#000000" {
  const L = relativeLuminance(bgHex);
  const onWhite = (1.0 + 0.05) / (L + 0.05);  // white L = 1
  const onBlack = (L + 0.05) / (0 + 0.05);     // black L = 0
  // Pick whichever gives higher contrast ratio
  return onWhite >= onBlack ? "#ffffff" : "#000000";
}
```

**Note:** The spec lists the linearization threshold as 0.03928 but the IEC standard is 0.04045. The difference is negligible for 8-bit values. Use 0.04045 (more precise).

### Pattern 6: Branding Read Path

**Single source:** `accounts` table columns `logo_url TEXT` and `brand_primary TEXT` (both nullable, already exist from Phase 1 schema). No separate `branding` table needed.

**Existing columns confirmed in initial_schema.sql:**
- `logo_url text` (nullable)
- `brand_primary text` (nullable)
- `brand_accent text` (nullable — not needed for Phase 7; only `brand_primary` matters)

**Read pattern — extend existing loaders:**
- `loadEventTypeForBookingPage()` already selects from `accounts`. Add `logo_url, brand_primary` to the select.
- Email senders receive the full account object — they already have `accounts` data; just add the two new columns to the query.
- No new round-trip needed: each surface that already loads `accounts` gets branding for free by expanding the select.

**AccountSummary type extension:**
```typescript
// app/[account]/[event-slug]/_lib/types.ts — extend existing
export interface AccountSummary {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  owner_email: string | null;
  logo_url: string | null;       // ADD
  brand_primary: string | null;  // ADD
}
```

**CSS var injection (booking page + embed):**
```tsx
// Wrap page root element — no Tailwind class needed
<div
  style={{
    "--color-brand": account.brand_primary ?? "#0A2540",
    "--color-brand-text": pickTextColor(account.brand_primary ?? "#0A2540"),
  } as React.CSSProperties}
>
  {children}
</div>
```

### Pattern 7: Live Mini-Preview in Branding Editor

**Recommended approach:** Preview iframe points to `/embed/[account]/[event-slug]?previewColor=...&previewLogo=...` query params.

- The `/embed/` page Server Component reads query params for `previewColor`/`previewLogo`, overrides the DB values, and renders with those overrides.
- No auth needed — `/embed/` is already public.
- Parent re-sets `iframe.src` when the owner changes color/logo in the editor, triggering a re-render.
- Simpler than postMessage for preview updates; avoids making the embed page a complex reactive surface.
- The preview iframe is inside the dashboard (not a third-party site), so no cross-origin complexity.

**Alternative rejected:** Duplicating the booking page UI as a React-tree preview requires maintaining two render paths. Iframe avoids drift.

### Pattern 8: /[account] Index Route

**Route:** `app/[account]/page.tsx` — a Next.js 16 dynamic route Server Component.

**Data query:** Single admin-client round-trip joining accounts + active event_types:
```typescript
const { data: account } = await supabaseAdmin
  .from("accounts")
  .select("id, name, slug, logo_url, brand_primary, owner_email")
  .eq("slug", accountSlug)
  .maybeSingle();

const { data: eventTypes } = await supabaseAdmin
  .from("event_types")
  .select("id, slug, name, description, duration_minutes")
  .eq("account_id", account.id)
  .eq("is_active", true)
  .is("deleted_at", null)
  .order("created_at");
```

**Reserved slug guard:** Already exists in `loadEventTypeForBookingPage()`. The `/[account]` loader needs the same guard — add `"embed"` to `RESERVED_SLUGS` since `/embed/` is a new top-level route that would otherwise match the `[account]` dynamic segment.

**Owner email:** `owner_email` is already in `accounts` table (Phase 5 migration). Render contact line only when non-null.

### Pattern 9: Schema — No Migration Needed for Branding Columns

The Phase 1 initial schema already created `logo_url text` and `brand_primary text` on `accounts`. No ALTER TABLE migration is needed for Phase 7 branding columns.

**What IS needed:**
1. Supabase Storage bucket `branding` — create via dashboard UI or a migration using `storage.buckets` insert (the latter requires service-role SQL). Simplest: create via Supabase dashboard, document in PLAN.
2. Add `"embed"` to `RESERVED_SLUGS` in the account loader.
3. Update `AccountSummary` type to include `logo_url` and `brand_primary`.

**Optional CHECK constraint on hex format:**
```sql
ALTER TABLE accounts
  ADD CONSTRAINT accounts_brand_primary_hex_check
  CHECK (brand_primary IS NULL OR brand_primary ~ '^#[0-9a-fA-F]{6}$');
```
Enforce hex format at the DB layer to prevent invalid values from reaching the contrast function. LOW risk — client validates before save.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG contrast ratio | Custom luminance formula from scratch | The 4-line formula in lib/branding/contrast.ts | The formula is standardized; implement it directly, no library needed |
| SVG sanitization | Custom XML parser | Reject SVG entirely (PNG only) | sanitize-svg + jsdom adds 3MB; safer to simply reject |
| iframe resizer | Third-party `iframe-resizer` library | Custom postMessage with ResizeObserver | The protocol is 20 lines; no library needed for a single-domain embed |
| Supabase signed URL rotation | Custom expiry management | Public bucket + permanent URLs | Signed URLs break email rendering; public bucket is the right choice here |
| Cross-origin cookie auth in embed | Storage Access API workaround | Don't need auth in embed at all | Public booking flow has no auth; third-party cookies are irrelevant |

**Key insight:** The embed widget pattern is simple enough (one script, one iframe, one postMessage type) that no library is warranted. Libraries like `iframe-resizer` are designed for same-domain or bidirectional communication; this use case is strictly one-directional (height up to parent).

---

## Common Pitfalls

### Pitfall 1: X-Frame-Options Conflicts with CSP frame-ancestors
**What goes wrong:** Setting both `X-Frame-Options: SAMEORIGIN` and `Content-Security-Policy: frame-ancestors *` on the embed route. When both are present, Chrome honors CSP and ignores X-Frame-Options, but some older browsers and proxies may behave differently. The correct behavior is to DELETE X-Frame-Options on `/embed/*`.
**How to avoid:** In proxy.ts, call `response.headers.delete("X-Frame-Options")` explicitly for embed routes.
**Warning signs:** Browser console shows "Refused to display in frame" even with CSP allowing it.

### Pitfall 2: Updating Supabase Session Cookies in proxy.ts Response
**What goes wrong:** Creating a FRESH `NextResponse` to add CSP headers, discarding the response from `updateSession()`. This drops the Supabase session cookie updates and logs the user out.
**How to avoid:** Call `updateSession(request)` first, capture its response, then call `response.headers.set(...)` on THAT response, return it.
**Warning signs:** Dashboard session expires unexpectedly; user gets redirected to login on every request.

### Pitfall 3: Multiple `<script>` Tags for widget.js (Idempotency)
**What goes wrong:** A third-party site accidentally includes two `<script src="/widget.js">` tags. Each invocation scans for `[data-nsi-calendar]` elements and injects iframes — the same element gets two iframes.
**How to avoid:** Guard at top of widget.js: `if (window.__nsiWidgetLoaded) return; window.__nsiWidgetLoaded = true;`
**Warning signs:** Double iframes appear on the host page.

### Pitfall 4: ResizeObserver Loop (re-fire on height set)
**What goes wrong:** The ResizeObserver fires when the iframe's content changes height, triggering a postMessage, which causes the parent to set `iframe.style.height`, which... does NOT trigger the ResizeObserver inside the iframe (the observer watches the embed's OWN document root, not the iframe element itself on the host page). This is safe.
**However:** If the embed page has elements that expand in response to the page height (e.g., `min-height: 100vh`), setting the iframe height can cause a reflow that triggers another ResizeObserver fire, creating an infinite loop.
**How to avoid:** The embed page should use `height: fit-content` (or no explicit height) on the root. Never use `min-height: 100vh` on the embed root.

### Pitfall 5: Third-Party Cookies in the Embed iframe (Safari ITP)
**What goes wrong:** If any part of the booking flow requires session cookies or localStorage, Safari ITP (Intelligent Tracking Prevention) blocks all third-party cookies in iframes — even first-party cookies from the app domain when loaded as a cross-origin iframe.
**Why we are safe:** The public booking flow (`/embed/`) requires no auth cookies. All data reads use the service-role admin client server-side. No cookies are set in the embed response. This is a non-issue for this architecture.
**Warning signs:** Booking form works in Chrome but silently fails in Safari. (Should not happen here.)

### Pitfall 6: Broken HTTPS Mixed Content in widget.js
**What goes wrong:** The owner copies the snippet from a dev environment where widget.js is at `http://localhost:3000/widget.js`. When pasted to a live HTTPS site, the browser blocks mixed content.
**How to avoid:** Always generate the snippet with the production HTTPS URL (from `NEXT_PUBLIC_APP_URL`). Document clearly in the UI.

### Pitfall 7: Public Bucket Logo URL in Emails — Gmail Proxy Caching
**What goes wrong:** Gmail proxies and caches all email images after first open. If the logo URL changes (re-upload to same path + `upsert: true`), Gmail may serve the stale cached version to returning openers for hours.
**Why it matters:** If the owner uploads a new logo, old emails in Gmail's cache may show the old logo.
**How to avoid:** The CDN cache invalidation takes up to 60 seconds at Supabase's CDN. For email rendering, this staleness is acceptable — the logo appears correctly on first open and updates on subsequent Gmail cache refresh. No action needed.

### Pitfall 8: Reserved Slug Collision for /embed/
**What goes wrong:** A future account tries to register slug `"embed"`. The `[account]` dynamic route matches before the static `/embed/` route... actually Next.js 16 static routes take precedence over dynamic routes. But to be safe, add `"embed"` to `RESERVED_SLUGS`.
**How to avoid:** Add `"embed"` to `RESERVED_SLUGS` in `app/[account]/[event-slug]/_lib/load-event-type.ts` AND in the new `/[account]/page.tsx` loader. Add the same guard to any future account slug input validation in the dashboard.

### Pitfall 9: SVG XSS via Logo Upload
**What goes wrong:** SVG files are XML that can contain `<script>` tags and `onload` event handlers. Accepting SVG uploads from authenticated owners and serving them from a public bucket on the app domain creates an XSS vector — a malicious owner could upload an SVG that executes JavaScript when any visitor's browser renders it.
**How to avoid:** Accept PNG only (`allowedMimeTypes: ["image/png"]`). The bucket-level policy enforces this at the storage layer. The UI communicates "PNG only" to the owner.

### Pitfall 10: widget.js BASE_URL Hardcoded to Wrong Domain
**What goes wrong:** widget.js contains a hardcoded BASE_URL pointing to the Vercel preview URL. When the custom domain is configured, the snippet still works (it points to the right URL) but if the file is cached with the old URL...
**How to avoid:** The snippet shown to owners in the dashboard is generated dynamically from `NEXT_PUBLIC_APP_URL`. The BASE_URL in widget.js itself should be injected from an environment variable at build time (e.g., via a Route Handler that serves widget.js dynamically, or a build script). For v1 simplicity: hardcode to production URL and document the manual update step.

---

## Code Examples

### Supabase Storage Bucket Create (run once via dashboard or admin SQL)
```typescript
// lib/branding/setup-bucket.ts — run-once admin utility
import { createAdminClient } from "@/lib/supabase/admin";

const supabase = createAdminClient();
await supabase.storage.createBucket("branding", {
  public: true,
  allowedMimeTypes: ["image/png"],
  fileSizeLimit: "2MB",
});
// Source: https://supabase.com/docs/guides/storage/buckets/creating-buckets
```

### Logo Upload Server Action
```typescript
// app/(shell)/app/branding/_lib/actions.ts
"use server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function uploadLogoAction(accountId: string, file: File) {
  if (file.size > 2 * 1024 * 1024) return { error: "File too large (max 2 MB)" };
  if (file.type !== "image/png") return { error: "PNG only" };

  const supabase = createAdminClient();
  const path = `${accountId}/logo.png`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { contentType: "image/png", upsert: true });

  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from("branding").getPublicUrl(path);

  // Persist URL to accounts table
  await supabase
    .from("accounts")
    .update({ logo_url: data.publicUrl })
    .eq("id", accountId);

  return { ok: true, logoUrl: data.publicUrl };
}
// Source: https://supabase.com/docs/guides/storage/uploads/standard-uploads
```

### next.config.ts — Global Security Headers + widget.js Cache
```typescript
// next.config.ts
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
      {
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" },
        ],
      },
    ];
  },
};
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
```

### WCAG Contrast — Full Implementation
```typescript
// lib/branding/contrast.ts
// Source: https://www.w3.org/WAI/GL/wiki/Relative_luminance (W3C spec)

function linearize(channel8bit: number): number {
  const s = channel8bit / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Returns "#ffffff" or "#000000" for highest contrast against bgHex. */
export function pickTextColor(bgHex: string): "#ffffff" | "#000000" {
  const L = relativeLuminance(bgHex);
  const contrastWhite = (1.05) / (L + 0.05);
  const contrastBlack = (L + 0.05) / (0.05);
  return contrastWhite >= contrastBlack ? "#ffffff" : "#000000";
}
```

### Email Logo Rendering (inline HTML)
```typescript
// In email HTML template (inline styles required for email clients)
// Source: caniemail.com + Litmus best practices

const logoHtml = account.logo_url
  ? `<img
       src="${account.logo_url}"
       alt="${escapeHtml(account.name)} logo"
       width="120"
       style="max-width:120px;height:auto;display:block;margin:0 auto 16px;"
     />`
  : "";

// Primary color on CTA buttons and headings:
const buttonStyle = `background-color:${account.brand_primary ?? "#0A2540"};
  color:${pickTextColor(account.brand_primary ?? "#0A2540")};
  padding:12px 24px;border-radius:6px;text-decoration:none;
  font-family:sans-serif;font-size:16px;`;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` (renamed) | Next.js 16.0 | Function renamed from `middleware()` to `proxy()`; codemod available |
| `X-Frame-Options` for iframe control | `CSP frame-ancestors` | Modern browsers | X-Frame-Options is superseded; both are set for compatibility |
| Signed URLs for all storage | Public bucket for public content | Ongoing | Public content should use public buckets for CDN performance + email reliability |
| `formatInTimeZone` from date-fns-tz | `TZDate` + `tz()` from @date-fns/tz | v4 | Already locked in Phase 4 |

**Deprecated/outdated:**
- `middleware.ts` / `export function middleware()`: renamed to `proxy.ts` / `export function proxy()` in Next.js 16. The project already uses `proxy.ts`.
- `X-Frame-Options` as the primary iframe guard: superseded by CSP `frame-ancestors`. Still set as belt-and-suspenders on non-embed routes.

---

## Open Questions

1. **Supabase Storage bucket creation method**
   - What we know: Bucket can be created via JS SDK (supabase-js admin client), SQL (storage.buckets insert), or Supabase dashboard UI
   - What's unclear: Whether `createBucket()` is idempotent (if called twice, does it error or no-op?)
   - Recommendation: Create via Supabase dashboard manually (one-time operation, not worth a migration script). Document as a human step in the plan.

2. **widget.js BASE_URL injection at build time**
   - What we know: `public/widget.js` is a static file — no build-time env substitution happens automatically
   - What's unclear: Whether to hardcode the production URL or serve widget.js via a Route Handler (which can inject process.env at runtime)
   - Recommendation: For v1, serve via a Route Handler at `app/widget.js/route.ts` that returns the script as `text/javascript` with the BASE_URL injected from `NEXT_PUBLIC_APP_URL`. This solves the domain problem cleanly and allows the Route Handler to set cache headers via the Response object.

3. **Email client SVG support re-assessment**
   - What we know: caniemail.com shows 92.86% support for linked SVG, including Outlook 2007+
   - What's unclear: This contradicts many blog posts saying "Outlook doesn't support SVG." The caniemail data may reflect linked SVG (via `<img src="...svg">`) rather than inline SVG.
   - Recommendation: Accept PNG only regardless — the XSS risk and sanitization overhead outweigh the marginal UX benefit of allowing SVG in v1.

4. **`noindex` on /embed/ route**
   - What we know: Phase 5/6 established the pattern of `robots: { index: false }` for token routes
   - What's unclear: Should `/embed/*` be noindex? It contains the booking form (public, not sensitive) but is not a canonical URL.
   - Recommendation: Add `robots: { index: false, follow: false }` to `/embed/` generateMetadata. The canonical booking URL is `/[account]/[event-slug]`.

---

## Sources

### Primary (HIGH confidence)
- `https://nextjs.org/docs/app/api-reference/file-conventions/proxy` — proxy.ts API, matcher, setting response headers, version history (v16.0.0 rename)
- `https://nextjs.org/docs/app/api-reference/config/next-config-js/headers` — headers() syntax, override behavior (last-match-wins), source patterns
- `https://nextjs.org/docs/app/guides/content-security-policy` — CSP with proxy.ts, frame-ancestors, without-nonces pattern
- `https://nextjs.org/docs/pages/api-reference/file-conventions/public-folder` — public/ folder cache behavior (`max-age=0` default)
- `https://vercel.com/docs/caching/cache-control-headers` — Vercel CDN caching, s-maxage, edge cache behavior for public assets
- `https://supabase.com/docs/guides/storage/buckets/creating-buckets` — createBucket API with allowedMimeTypes + fileSizeLimit
- `https://supabase.com/docs/reference/javascript/storage-from-getpublicurl` — getPublicUrl() API
- `https://supabase.com/docs/guides/storage/uploads/standard-uploads` — upload() API with upsert + contentType
- `https://www.w3.org/WAI/GL/wiki/Relative_luminance` — WCAG relative luminance formula (verified)
- `https://jacobfilipp.com/iframe-height-autoresize-crossdomain/` — postMessage resize pattern with source validation
- `calendar-app/supabase/migrations/20260419120000_initial_schema.sql` — confirmed `logo_url text` and `brand_primary text` exist on `accounts` table
- `calendar-app/proxy.ts` — confirmed project uses `proxy.ts` + `export function proxy()`

### Secondary (MEDIUM confidence)
- `https://www.caniemail.com/features/image-svg/` — SVG email support data (92.86%; verified but interpretation unclear — linked vs. inline)
- Multiple sources confirming Gmail image proxy (images auto-fetched + cached by Google, URL must be stable HTTPS)

### Tertiary (LOW confidence)
- WebSearch for embed widget idempotency patterns — confirmed `window.__nsiWidgetLoaded` guard pattern is standard practice

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new deps verified against package.json
- CSP / proxy.ts pattern: HIGH — verified against official Next.js 16 docs
- Supabase Storage: HIGH — verified against official Supabase docs
- postMessage protocol: HIGH — standard Web API; pattern verified against multiple sources
- WCAG contrast formula: HIGH — verified against W3C specification directly
- Email image rendering: MEDIUM — caniemail data verified but SVG/PNG tradeoff has some ambiguity
- widget.js BASE_URL injection: MEDIUM — Route Handler approach is sound but not verified with an official example

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days; Next.js 16 and Supabase APIs are relatively stable)
