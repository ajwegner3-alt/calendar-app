---
phase: 07-widget-and-branding
plan: 03
type: execute
wave: 2
depends_on: ["07-01", "07-02"]
files_modified:
  - app/embed/[account]/[event-slug]/page.tsx
  - app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx
  - app/embed/[account]/[event-slug]/_components/embed-shell.tsx
  - app/embed/layout.tsx
autonomous: true

must_haves:
  truths:
    - "Visiting /embed/nsi/consultation in a browser renders the booking picker + form with NO site nav, NO app chrome, NO outer header"
    - "The embed page posts {type:'nsi-booking:height', height} messages to window.parent on every height change"
    - "The embed page accepts ?previewColor=#hex and ?previewLogo=url query params and renders with those overrides (for branding editor live preview)"
    - "The embed page is noindex (robots meta + headers)"
    - "Reserved-slug guard prevents /embed/embed/* from leaking; non-existent account or event-slug returns notFound()"
  artifacts:
    - path: "app/embed/[account]/[event-slug]/page.tsx"
      provides: "Server Component: chromeless booking page; reuses BookingShell from /[account]/[event-slug]/_components"
      contains: "EmbedHeightReporter"
    - path: "app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx"
      provides: "Client component: ResizeObserver -> postMessage to window.parent"
      exports: ["EmbedHeightReporter"]
    - path: "app/embed/[account]/[event-slug]/_components/embed-shell.tsx"
      provides: "Client wrapper that applies branding CSS vars + renders BookingShell + EmbedHeightReporter"
      exports: ["EmbedShell"]
    - path: "app/embed/layout.tsx"
      provides: "Minimal layout: no sidebar, no Toaster (toasts go to host page in iframe = invisible anyway), no navbar"
      contains: "<html"
  key_links:
    - from: "app/embed/[account]/[event-slug]/page.tsx"
      to: "loadEventTypeForBookingPage"
      via: "import + same data shape used by Phase 5 booking page"
      pattern: "loadEventTypeForBookingPage"
    - from: "app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx"
      to: "window.parent.postMessage"
      via: "ResizeObserver on document.documentElement"
      pattern: "postMessage.*nsi-booking:height"
    - from: "app/embed/[account]/[event-slug]/page.tsx"
      to: "BookingShell from /[account]/[event-slug]/_components/booking-shell"
      via: "shared component reuse"
      pattern: "BookingShell"
---

<objective>
Build the chromeless `/embed/[account]/[event-slug]` route that renders the same booking flow as `/[account]/[event-slug]` but stripped of all site/app chrome. Wire the `nsi-booking:height` postMessage protocol via a `ResizeObserver` on the embed root. Accept `?previewColor` + `?previewLogo` query params for the branding editor live preview (Plan 07-04 dependency). Add a dedicated `app/embed/layout.tsx` so the embed inherits NEITHER the root toaster mount NOR any future shell decoration.

Purpose: This is the route that the widget.js iframe targets (Plan 07-05) and the route that the dashboard preview iframe (Plan 07-04) renders. Reusing the existing `BookingShell` client component (Phase 5) avoids drift between hosted and embedded surfaces. The postMessage handshake is THE contract that lets widget.js auto-resize the iframe.

Output: New `app/embed/[account]/[event-slug]/` directory with page + height-reporter + embed-shell, plus `app/embed/layout.tsx`.
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

# Files reused from Phase 5
@app/[account]/[event-slug]/page.tsx
@app/[account]/[event-slug]/_components/booking-shell.tsx
@app/[account]/[event-slug]/_lib/load-event-type.ts
@app/[account]/[event-slug]/_lib/types.ts
@app/layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create app/embed/layout.tsx (minimal chromeless layout)</name>
  <files>
    app/embed/layout.tsx
  </files>
  <action>
    Create `app/embed/layout.tsx` as a minimal nested layout. This SHADOWS the root `app/layout.tsx` for `/embed/*` routes (Next 16 nested layouts compose).

    BUT NOTE: nested layouts in Next.js compose with the root layout — they do NOT replace it. The root layout still wraps the embed (including `<html>`, `<body>`, root `<Toaster />`). To truly avoid the Toaster, we have two options:

    1. (Preferred) Accept the root Toaster — toasts inside the iframe are invisible to the host page anyway (the iframe is a sealed window). The root Toaster being present is harmless. SKIP creating app/embed/layout.tsx entirely if there's no other reason for it.

    2. Use a route group that bypasses root layout — Next 16 doesn't have a clean way to do this without restructuring everything.

    DECISION: Option 1. DO NOT create `app/embed/layout.tsx`. Delete this file from `files_modified` when verifying. Andrew can verify the embed renders without sidebar by visiting `/embed/nsi/consultation` directly — sidebar lives in `app/(shell)/layout.tsx` which is in a route group not in the embed parent chain.

    However, DO add an explicit `app/embed/layout.tsx` IF AND ONLY IF you discover during execution that the root layout includes any visible chrome (sidebar, header, footer). Re-read `app/layout.tsx` — if it's just `<html><body>{children}<Toaster/></body></html>`, skip this task and proceed to Task 2.

    Action when skipping: log in the SUMMARY.md that no embed layout was created and why. Update files_modified to remove `app/embed/layout.tsx`.
  </action>
  <verify>
    Read `app/layout.tsx`. Confirm it has no sidebar/nav/header. If clean, skip file creation. If not clean, create the embed layout to override.
  </verify>
  <done>
    Either app/embed/layout.tsx exists with documented reason, OR the SUMMARY notes that root layout is already chromeless and no override needed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create EmbedHeightReporter client component (ResizeObserver -> postMessage)</name>
  <files>
    app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx
  </files>
  <action>
    Create `app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx` as a `"use client"` component. Source: RESEARCH.md §Pattern 3 example.

    ```tsx
    "use client";

    import { useEffect } from "react";

    /**
     * Posts page height to window.parent on every layout change.
     *
     * Protocol: postMessage({ type: "nsi-booking:height", height: number }, "*")
     * Target origin "*" is intentional — host origin is unknowable; message contains
     * only height (no secrets). widget.js validates source via event.source matching
     * (RESEARCH §Pattern 3 + Pitfall 4).
     *
     * MUST observe document.documentElement (not document.body or a ref) — the
     * embed page may have content that overflows body's natural height (modal, dropdown).
     * documentElement.scrollHeight is the canonical "full content height".
     *
     * MUST NOT add CSS like min-height: 100vh on the embed root — Pitfall 4 loop risk.
     */
    export function EmbedHeightReporter() {
      useEffect(() => {
        // Sanity: only run if inside an iframe. Standalone visits to /embed/* shouldn't post.
        if (typeof window === "undefined" || window.parent === window) return;

        let lastHeight = 0;

        const send = () => {
          const h = document.documentElement.scrollHeight;
          if (h === lastHeight) return; // dedupe identical heights — Pitfall 4 belt
          lastHeight = h;
          window.parent.postMessage(
            { type: "nsi-booking:height", height: h },
            "*",
          );
        };

        // Initial post (after first paint)
        send();

        const observer = new ResizeObserver(() => send());
        observer.observe(document.documentElement);

        // Belt: window resize fires for some viewport changes
        window.addEventListener("resize", send);

        return () => {
          observer.disconnect();
          window.removeEventListener("resize", send);
        };
      }, []);

      return null;
    }
    ```

    KEY DECISIONS:
    - Observe `document.documentElement` not a ref — full-page height including overflowing children.
    - Dedupe via `lastHeight` to prevent infinite loops if any reflow re-fires the observer with same height.
    - Skip posting when `window.parent === window` (standalone view) — debugging UX: visit /embed/* directly without iframe doesn't spam the console.
    - Returns null — purely behavioral component.
  </action>
  <verify>
    Component file exists. `npx tsc --noEmit` passes.
    Smoke test will happen in Task 4 verify (visit /embed/* in browser, watch DevTools Console for postMessage events when inside an iframe).
  </verify>
  <done>
    EmbedHeightReporter is a client component that posts nsi-booking:height messages with dedupe; observes documentElement; cleans up on unmount; skips standalone (non-iframe) renders.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create EmbedShell client wrapper (branding CSS vars + BookingShell + Reporter)</name>
  <files>
    app/embed/[account]/[event-slug]/_components/embed-shell.tsx
  </files>
  <action>
    Create `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` as a `"use client"` wrapper.

    Why a separate client wrapper: the page.tsx is a Server Component (loads data via admin client + reads searchParams). It can't use React hooks. We need a client component to (a) apply CSS vars via inline style, (b) mount EmbedHeightReporter, (c) render BookingShell which is already a client component.

    ```tsx
    "use client";

    import type { CSSProperties } from "react";
    import { BookingShell } from "@/app/[account]/[event-slug]/_components/booking-shell";
    import type { AccountSummary, EventTypeSummary } from "@/app/[account]/[event-slug]/_lib/types";
    import { EmbedHeightReporter } from "./embed-height-reporter";
    import { pickTextColor } from "@/lib/branding/contrast";

    interface EmbedShellProps {
      account: AccountSummary;
      eventType: EventTypeSummary;
      /** Optional override from ?previewColor=#RRGGBB — branding editor live preview */
      previewColor?: string;
      /** Optional override from ?previewLogo=encodedUrl — branding editor live preview */
      previewLogo?: string;
    }

    export function EmbedShell({ account, eventType, previewColor, previewLogo }: EmbedShellProps) {
      const effectiveColor = previewColor ?? account.brand_primary ?? "#0A2540";
      const effectiveLogo = previewLogo ?? account.logo_url ?? null;
      const textColor = pickTextColor(effectiveColor);

      const style: CSSProperties = {
        // CSS vars consumed by Tailwind classes that read them, e.g. style={{ background: "var(--brand-primary)" }}
        // Approach mirrors Phase 2 STATE lock: per-account brand swaps Tailwind v4 @theme vars at the wrapping element.
        ["--brand-primary" as never]: effectiveColor,
        ["--brand-text" as never]: textColor,
        minHeight: "auto", // Pitfall 4: NEVER min-height: 100vh on embed root
      };

      return (
        <div style={style} className="px-4 py-6">
          {effectiveLogo && (
            <header className="mb-6 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={effectiveLogo}
                alt={`${account.name} logo`}
                style={{ maxWidth: 120, maxHeight: 60, height: "auto", width: "auto" }}
              />
            </header>
          )}
          <h1 className="text-xl font-semibold text-center mb-1">{eventType.name}</h1>
          <p className="text-sm text-center text-muted-foreground mb-6">
            {eventType.duration_minutes} min · with {account.name}
          </p>
          <BookingShell account={account} eventType={eventType} />
          <EmbedHeightReporter />
        </div>
      );
    }
    ```

    KEY DECISIONS:
    - Uses standard `<img>` (not `next/image`) because the logo is a Supabase Storage public URL on a different domain; configuring next/image remotePatterns is more friction than the eslint disable.
    - CSS var name `--brand-primary` (not `--color-brand` or `--color-primary`) — distinct from Tailwind v4 `@theme` token names so it doesn't accidentally clobber the global theme on the booking-shell side.
    - The downstream BookingShell does NOT yet consume `--brand-primary` — Plan 07-06 wires that consumption. For Plan 07-03's verification, Andrew should see the logo render and the booking flow work; brand color usage on buttons arrives in Plan 07-06.
    - `previewColor`/`previewLogo` plumbed but NOT validated here — page.tsx (Task 4) sanitizes the query params before passing.
  </action>
  <verify>
    File exists. `npx tsc --noEmit` passes (BookingShell + AccountSummary + pickTextColor imports resolve).
  </verify>
  <done>
    EmbedShell renders logo (if any) + event-type header + BookingShell + EmbedHeightReporter; CSS vars applied via inline style; preview overrides plumbed.
  </done>
</task>

<task type="auto">
  <name>Task 4: Create app/embed/[account]/[event-slug]/page.tsx (Server Component + searchParams)</name>
  <files>
    app/embed/[account]/[event-slug]/page.tsx
  </files>
  <action>
    Create the Server Component page. Pattern mirrors `app/[account]/[event-slug]/page.tsx` (Phase 5) but with embed-specific concerns.

    ```tsx
    import type { Metadata } from "next";
    import { notFound } from "next/navigation";
    import { loadEventTypeForBookingPage } from "@/app/[account]/[event-slug]/_lib/load-event-type";
    import { EmbedShell } from "./_components/embed-shell";

    interface RouteParams {
      account: string;
      "event-slug": string;
    }

    interface SearchParams {
      previewColor?: string;
      previewLogo?: string;
    }

    export async function generateMetadata({
      params,
    }: {
      params: Promise<RouteParams>;
    }): Promise<Metadata> {
      const { account, "event-slug": eventSlug } = await params;
      const data = await loadEventTypeForBookingPage(account, eventSlug);
      if (!data) {
        return { title: "Booking unavailable", robots: { index: false, follow: false } };
      }
      return {
        title: `${data.eventType.name} — ${data.account.name}`,
        robots: { index: false, follow: false }, // RESEARCH Open Q4: noindex /embed/*
      };
    }

    export default async function EmbedBookingPage({
      params,
      searchParams,
    }: {
      params: Promise<RouteParams>;
      searchParams: Promise<SearchParams>;
    }) {
      const { account, "event-slug": eventSlug } = await params;
      const sp = await searchParams;

      const data = await loadEventTypeForBookingPage(account, eventSlug);
      if (!data) notFound();

      // Sanitize preview overrides — only accept #RRGGBB hex and https:// URLs
      const previewColor =
        typeof sp.previewColor === "string" && /^#[0-9a-fA-F]{6}$/.test(sp.previewColor)
          ? sp.previewColor
          : undefined;
      const previewLogo =
        typeof sp.previewLogo === "string" && /^https:\/\//.test(sp.previewLogo)
          ? sp.previewLogo
          : undefined;

      return (
        <main className="mx-auto max-w-3xl">
          <EmbedShell
            account={data.account}
            eventType={data.eventType}
            previewColor={previewColor}
            previewLogo={previewLogo}
          />
        </main>
      );
    }
    ```

    KEY DECISIONS:
    - `generateMetadata` returns `robots: { index: false, follow: false }` (RESEARCH Open Q4 lock — canonical URL is `/[account]/[event-slug]`).
    - `searchParams` is awaited (Next 16 lock from Phase 3 STATE.md).
    - Preview params are STRICTLY validated server-side — `#RRGGBB` only, `https://` only. Prevents querystring injection if someone shares the embed URL with custom params.
    - Reserved-slug guard happens inside `loadEventTypeForBookingPage` (now includes "embed" after Plan 07-01).
    - No <header> outer wrapper — EmbedShell handles all visible content; page.tsx is a thin route shell.
    - `<main>` wrapper has no padding (EmbedShell handles its own internal `px-4 py-6`).
  </action>
  <verify>
    `npm run dev` then visit:
    1. `http://localhost:3000/embed/nsi/consultation` (or whatever active event-type slug exists in the DB) — should render booking flow with NO sidebar.
    2. `http://localhost:3000/embed/nsi/consultation?previewColor=%23ff0000` — confirm Plan 07-04 will be able to push preview colors. (Visual check: header text color reads pickTextColor("#ff0000") which should be white.)
    3. `http://localhost:3000/embed/embed/anything` — should `notFound()` (RESERVED_SLUGS guard from Plan 07-01).
    4. `http://localhost:3000/embed/nonexistent/whatever` — should `notFound()`.
    5. Check page source: should see `<meta name="robots" content="noindex,nofollow">` (or equivalent header).
    6. Open DevTools Console while iframing the page from another HTML file (or use `<iframe src=".../embed/nsi/consultation">` in a scratch file): postMessage events should fire.
  </verify>
  <done>
    /embed/[account]/[event-slug] renders chromeless booking flow; query-param overrides validated; noindex set; reserved slug guard works; postMessage fires when in iframe.
  </done>
</task>

</tasks>

<verification>
- `npm run build` succeeds (no TypeScript errors).
- `npm test` — all existing tests still green.
- Visit `/embed/nsi/<active-slug>` in dev — see booking flow without sidebar/nav.
- Visit `/embed/nsi/<active-slug>` inside an iframe (scratch HTML file) — DevTools shows window.parent receiving `nsi-booking:height` messages.
- `curl -I http://localhost:3000/embed/nsi/<active-slug>` shows CSP `frame-ancestors *` (set by proxy.ts from Plan 07-02).
- `/embed/embed/anything` returns 404.
</verification>

<success_criteria>
1. EMBED-01: /embed/[account]/[event-slug] route exists, renders chromeless booking picker + form.
2. EMBED-03 (partial): nsi-booking:height postMessage protocol fires on every layout change with deduped heights.
3. EMBED-04 (verified end-to-end with Plan 07-02): CSP frame-ancestors * + no X-Frame-Options on /embed/* responses.
4. Branding-editor preview hook: ?previewColor and ?previewLogo query params override DB values for live preview (Plan 07-04 will use this).
5. Reserved-slug guard prevents conflict; non-existent accounts/events 404.
</success_criteria>

<output>
After completion, create `.planning/phases/07-widget-and-branding/07-03-SUMMARY.md` documenting:
- Route shape and file layout under app/embed/
- Decision on app/embed/layout.tsx (created or skipped + why)
- postMessage protocol contract (type, payload, target origin "*")
- CSS var naming locked (--brand-primary, --brand-text)
- Preview-param validation regex locked
- Verification screenshots / curl outputs
- Forward contract for Plan 07-05 (widget.js): iframe.src = `${BASE_URL}/embed/${account}/${slug}`
</output>
