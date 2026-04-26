---
phase: 07-widget-and-branding
plan: 05
type: execute
wave: 3
depends_on: ["07-03"]
files_modified:
  - app/widget.js/route.ts
  - tests/widget-js.test.ts
autonomous: true

must_haves:
  truths:
    - "GET /widget.js returns a JavaScript file with Content-Type: application/javascript"
    - "The script's BASE_URL is injected from process.env.NEXT_PUBLIC_APP_URL at request time (NOT hardcoded)"
    - "Including <script src='/widget.js'> + <div data-nsi-calendar='nsi/consultation'> on a third-party HTML page injects an iframe to /embed/nsi/consultation"
    - "iframe height auto-resizes via the nsi-booking:height postMessage protocol (validated source via event.source matching)"
    - "If the postMessage handshake times out (5s), an inline fallback link to the hosted booking page renders"
    - "Multiple <div data-nsi-calendar> elements on one page each get their own iframe with independent message channels"
    - "Loading second <script src='/widget.js'> is a no-op (idempotency guard via window.__nsiWidgetLoaded)"
    - "Cache-Control: public, max-age=3600, s-maxage=86400 (1h browser, 24h CDN)"
  artifacts:
    - path: "app/widget.js/route.ts"
      provides: "Route Handler returning text/javascript with BASE_URL injected from env"
      exports: ["GET"]
    - path: "tests/widget-js.test.ts"
      provides: "Vitest integration: GET /widget.js returns 200 + correct headers + injected BASE_URL"
  key_links:
    - from: "app/widget.js/route.ts"
      to: "process.env.NEXT_PUBLIC_APP_URL"
      via: "string template substitution"
      pattern: "process\\.env\\.NEXT_PUBLIC_APP_URL"
    - from: "widget.js script body"
      to: "/embed/[account]/[event-slug]"
      via: "iframe.src = BASE_URL + '/embed/' + account + '/' + event"
      pattern: "/embed/"
    - from: "widget.js postMessage listener"
      to: "iframe.contentWindow"
      via: "event.source === iframe.contentWindow validation"
      pattern: "event\\.source"
---

<objective>
Serve `widget.js` from a Next.js Route Handler at `app/widget.js/route.ts`. The handler builds the JavaScript source string with the production `BASE_URL` injected from `process.env.NEXT_PUBLIC_APP_URL` at request time, returns it with `Content-Type: application/javascript` and a long cache header. The script implements the third-party-site widget loader: scans `[data-nsi-calendar]` elements, injects iframes pointing at `/embed/[account]/[event-slug]`, auto-resizes via the `nsi-booking:height` postMessage protocol, falls back to an inline link if the handshake times out.

Purpose: Delivers EMBED-02 (static loader script) + EMBED-03 (auto-resize via postMessage). RESEARCH §Pattern 2 + §Open Q2 lock the Route Handler approach over `public/widget.js` because it solves the BASE_URL hardcoding problem cleanly (Pitfall 10).

Output: Route Handler + integration test that asserts content-type, headers, BASE_URL injection, and key script invariants.
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
@.planning/phases/07-widget-and-branding/07-03-SUMMARY.md

# Existing route handler pattern to mirror
@app/api/slots/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create app/widget.js/route.ts (Route Handler with injected BASE_URL)</name>
  <files>
    app/widget.js/route.ts
  </files>
  <action>
    Create the Route Handler. The file path `app/widget.js/route.ts` makes Next.js serve it at the URL `/widget.js`.

    ```typescript
    import { type NextRequest, NextResponse } from "next/server";

    /**
     * Serves widget.js with BASE_URL injected from env at request time.
     *
     * Why a Route Handler instead of public/widget.js:
     *   - public/widget.js is static — cannot inject NEXT_PUBLIC_APP_URL
     *   - hardcoding BASE_URL means manual edit on every deploy or Pitfall 10
     *   - Route Handler runs on every request but Vercel CDN caches by URL+headers
     *
     * Cache strategy:
     *   - Browser: 1 hour (max-age=3600)
     *   - CDN: 24 hours (s-maxage=86400)
     *   - On deploy with new BASE_URL: owners append ?v=<deployId> to bust CDN
     */
    export async function GET(request: NextRequest) {
      // Resolve BASE_URL: env var > request origin fallback (dev convenience)
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;

      const script = buildWidgetScript(baseUrl);

      return new NextResponse(script, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
          // Scripts don't need CORS headers (no-cors fetch model), but harmless to add
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    /**
     * Builds the widget loader source as a string.
     *
     * Embedded protocol:
     *   - Idempotency: window.__nsiWidgetLoaded guard (Pitfall 3)
     *   - Discovery: querySelectorAll('[data-nsi-calendar]')
     *   - data-nsi-calendar attribute format: "<account-slug>/<event-slug>"
     *   - Optional data-nsi-account + data-nsi-event for explicit override
     *   - postMessage source validation: event.source === iframe.contentWindow
     *   - 5-second handshake timeout → inline fallback link
     *
     * NOTE: This is plain ES5 (var, function, no arrow funcs in places where IE
     * compatibility matters less but for max compatibility we stay conservative).
     */
    function buildWidgetScript(baseUrl: string): string {
      // BASE_URL is JSON-encoded so any quotes/special chars in the env var are safe.
      // The template literal is read at module load (build) time only for the function body —
      // the actual baseUrl substitution happens here on each request.
      const safeBaseUrl = JSON.stringify(baseUrl);

      return `(function () {
  if (window.__nsiWidgetLoaded) return;
  window.__nsiWidgetLoaded = true;

  var BASE_URL = ${safeBaseUrl};
  var HANDSHAKE_TIMEOUT_MS = 5000;

  function parseTarget(el) {
    // Preferred: data-nsi-calendar="account-slug/event-slug"
    var combined = el.getAttribute("data-nsi-calendar");
    if (combined && combined.indexOf("/") > 0) {
      var parts = combined.split("/");
      return { account: parts[0], event: parts.slice(1).join("/") };
    }
    // Fallback: separate attributes
    var account = el.getAttribute("data-nsi-account");
    var event = el.getAttribute("data-nsi-event");
    if (account && event) return { account: account, event: event };
    return null;
  }

  function renderSkeleton(el) {
    el.innerHTML =
      '<div style="background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);background-size:200% 100%;animation:nsiPulse 1.5s ease-in-out infinite;height:480px;border-radius:8px;"></div>' +
      '<style>@keyframes nsiPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>';
  }

  function renderFallback(el, target) {
    el.innerHTML =
      '<p style="margin:0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;font-family:sans-serif;font-size:14px;color:#374151;">' +
      'Booking unavailable in embed \\u2014 ' +
      '<a href="' + BASE_URL + '/' + target.account + '/' + target.event + '" target="_blank" rel="noopener noreferrer" style="color:#0A2540;font-weight:600;">' +
      'open booking page' +
      '</a></p>';
  }

  function initWidget(el) {
    var target = parseTarget(el);
    if (!target) return;

    renderSkeleton(el);

    var iframe = document.createElement("iframe");
    iframe.src = BASE_URL + "/embed/" + encodeURIComponent(target.account) + "/" + encodeURIComponent(target.event);
    iframe.style.cssText = "width:100%;border:0;display:block;background:transparent;";
    iframe.scrolling = "no";
    iframe.setAttribute("allow", "");
    iframe.setAttribute("title", "Booking widget");

    var settled = false;
    var timeoutId = setTimeout(function () {
      if (settled) return;
      settled = true;
      renderFallback(el, target);
    }, HANDSHAKE_TIMEOUT_MS);

    function onMessage(evt) {
      if (!evt.data || evt.data.type !== "nsi-booking:height") return;
      // SOURCE validation (RESEARCH Pattern 3): origin is unknowable for embed,
      // but evt.source MUST equal our iframe's contentWindow.
      if (evt.source !== iframe.contentWindow) return;
      if (typeof evt.data.height !== "number" || evt.data.height <= 0) return;

      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        // Replace skeleton with iframe
        el.innerHTML = "";
        el.appendChild(iframe);
      }
      iframe.style.height = evt.data.height + "px";
    }

    window.addEventListener("message", onMessage);

    // Insert iframe immediately (not visible behind skeleton until first message)
    // This is what triggers the embed page to load and start posting heights.
    document.body.appendChild(iframe);
    iframe.style.position = "absolute";
    iframe.style.visibility = "hidden";
    iframe.style.left = "-9999px";

    // Once first message arrives, onMessage moves iframe into el and resets positioning.
    // We need to reset position when moving — adjust onMessage to do this:
    // (incorporated above via el.innerHTML = ""; el.appendChild(iframe))
    // After append into el, clear the offscreen positioning.
    var origOnMessage = onMessage;
    onMessage = function (evt) {
      origOnMessage(evt);
      iframe.style.position = "static";
      iframe.style.visibility = "visible";
      iframe.style.left = "auto";
    };
    // Re-bind: remove old, add wrapped
    window.removeEventListener("message", origOnMessage);
    window.addEventListener("message", onMessage);
  }

  function init() {
    var els = document.querySelectorAll("[data-nsi-calendar]");
    for (var i = 0; i < els.length; i++) initWidget(els[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();`;
    }
    ```

    KEY DECISIONS:
    - `JSON.stringify(baseUrl)` for safe injection — handles any unexpected chars in env value.
    - Skeleton uses inline CSS animation (no external dependency); embedded `<style>` defines `@keyframes nsiPulse`.
    - `data-nsi-calendar="account/event"` is the preferred form (one attribute, matches RESEARCH); also accepts split `data-nsi-account` + `data-nsi-event` as documented fallback.
    - Iframe is inserted offscreen first to trigger load + handshake; on first message, moved into the mount element and made visible. Avoids flash of unstyled content while waiting for height.
    - `encodeURIComponent` on slug parts prevents path injection from malicious data attributes.
    - `iframe.scrolling = "no"` because the parent host page handles scrolling (iframe content is fully expanded via height msg).
    - Idempotency guard at top — multiple `<script src="/widget.js">` is a no-op (Pitfall 3).

    The implementation above includes a small subtlety with the offscreen iframe move + listener re-binding. SIMPLIFY: do not move the iframe; just place it in `el` from the start, hidden via `visibility:hidden`, and reveal on first message:

    ```javascript
    // SIMPLIFIED VERSION — supersedes the move-from-offscreen logic above
    iframe.style.cssText = "width:100%;border:0;display:block;background:transparent;visibility:hidden;height:0;";
    el.appendChild(iframe);

    function onMessage(evt) {
      if (!evt.data || evt.data.type !== "nsi-booking:height") return;
      if (evt.source !== iframe.contentWindow) return;
      if (typeof evt.data.height !== "number" || evt.data.height <= 0) return;

      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        // Remove skeleton siblings (skeleton is el.firstChild; iframe is el.lastChild)
        var children = el.children;
        for (var j = children.length - 1; j >= 0; j--) {
          if (children[j] !== iframe) el.removeChild(children[j]);
        }
        iframe.style.visibility = "visible";
      }
      iframe.style.height = evt.data.height + "px";
    }

    window.addEventListener("message", onMessage);
    ```

    USE THIS SIMPLIFIED VERSION. The iframe lives inside `el` from the start (not offscreen), hidden via `height:0; visibility:hidden`. On first valid message: skeleton siblings removed, iframe revealed at the reported height. Subsequent messages just update height. This is cleaner and avoids the listener-rebind complexity.

    Final action: write the route handler with the SIMPLIFIED version of the iframe lifecycle.
  </action>
  <verify>
    `npm run build` succeeds.
    `curl -I http://localhost:3000/widget.js` shows:
    - 200 status
    - Content-Type: application/javascript; charset=utf-8
    - Cache-Control: public, max-age=3600, s-maxage=86400
    `curl http://localhost:3000/widget.js | head -20` shows the IIFE wrapper + `BASE_URL = "http://localhost:3000"` (or whatever NEXT_PUBLIC_APP_URL resolves to).
  </verify>
  <done>
    Route Handler returns valid JavaScript with injected BASE_URL, correct content-type, correct cache headers, and the simplified iframe lifecycle.
  </done>
</task>

<task type="auto">
  <name>Task 2: Vitest integration test for /widget.js</name>
  <files>
    tests/widget-js.test.ts
  </files>
  <action>
    Create Vitest integration test mirroring the route-handler test pattern from Phase 4 (`/api/slots`) and Phase 6 (`/api/cancel`).

    Use `NextRequest` constructor (Phase 6 lock — STATE.md: "NextRequest required for route-handler integration tests").

    Test cases:
    1. **Returns 200 with correct headers**:
       - Construct `new NextRequest("http://localhost:3000/widget.js")`
       - Call `await GET(request)`
       - Assert response.status === 200
       - Assert response.headers.get("Content-Type") matches `/^application\/javascript/`
       - Assert response.headers.get("Cache-Control") === "public, max-age=3600, s-maxage=86400"

    2. **BASE_URL is injected from NEXT_PUBLIC_APP_URL**:
       - Use `vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prod.example.com")`
       - Call GET, await response.text()
       - Assert text contains `BASE_URL = "https://prod.example.com"` (JSON-stringified)
       - `vi.unstubAllEnvs()` in afterEach

    3. **BASE_URL falls back to request origin when env unset**:
       - `vi.stubEnv("NEXT_PUBLIC_APP_URL", "")`
       - GET request to `http://localhost:9999/widget.js`
       - Assert text contains `BASE_URL = "http://localhost:9999"`

    4. **Trailing slash stripped from BASE_URL**:
       - `vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com/")`
       - Assert text contains `BASE_URL = "https://example.com"` (no trailing slash)

    5. **Script contains key invariants** (smoke regex tests on text body):
       - Contains `window.__nsiWidgetLoaded` (idempotency guard)
       - Contains `data-nsi-calendar` (mount-point selector)
       - Contains `nsi-booking:height` (postMessage protocol)
       - Contains `event.source !== iframe.contentWindow` (source validation — note: in script as `evt.source !== iframe.contentWindow`)
       - Contains `HANDSHAKE_TIMEOUT_MS = 5000` (timeout)
       - Contains `/embed/` (target path prefix)

    Import the GET function: `import { GET } from "@/app/widget.js/route";` — note the `widget.js` directory name; if TS resolution complains about the dot, use the explicit relative path `import { GET } from "../app/widget.js/route";` from tests/.

    Use `path.resolve(__dirname, ...)` for any path concerns (Phase 4 STATE lock — Windows compatibility).
  </action>
  <verify>
    `npm test -- tests/widget-js.test.ts` passes all 5 test cases.
  </verify>
  <done>
    Vitest suite green; BASE_URL injection + headers + script invariants all verified.
  </done>
</task>

</tasks>

<verification>
- `curl http://localhost:3000/widget.js` returns valid JavaScript with BASE_URL injected.
- `curl -I http://localhost:3000/widget.js` shows correct Content-Type + Cache-Control.
- Smoke test by creating a scratch HTML file at `/tmp/widget-test.html`:
  ```html
  <!DOCTYPE html>
  <html>
  <body>
    <h1>Host page</h1>
    <div data-nsi-calendar="nsi/<active-event-slug>"></div>
    <script src="http://localhost:3000/widget.js"></script>
  </body>
  </html>
  ```
  Open via `file://` in browser. Should see skeleton briefly then booking flow.
- Open scratch HTML with TWO mount points → both render independently.
- Add a SECOND `<script src="...widget.js">` → no duplicate iframes (idempotency guard works).
</verification>

<success_criteria>
1. EMBED-02: widget.js served as static loader; finds `[data-nsi-calendar]` elements; injects iframe.
2. EMBED-03 (full): auto-resize via nsi-booking:height postMessage with source validation.
3. Multi-widget per page works (each closure captures its own iframe).
4. Idempotency guard prevents double-load.
5. Handshake timeout (5s) → inline fallback link.
6. Cache headers correct (1h browser, 24h CDN).
7. Vitest integration tests pass (5 cases).
</success_criteria>

<output>
After completion, create `.planning/phases/07-widget-and-branding/07-05-SUMMARY.md` documenting:
- Route Handler approach (vs public/widget.js) and rationale (BASE_URL injection)
- Iframe lifecycle (mounted hidden inside el from the start, revealed on first valid message)
- postMessage protocol final shape (nsi-booking:height + height number)
- Source-validation strategy (event.source matching, NOT origin matching)
- 5s handshake timeout + fallback link contract
- data-nsi-calendar attribute format ("account/event" preferred; data-nsi-account + data-nsi-event fallback)
- Cache header values + reasoning
- Test coverage summary
- Forward contract for Plan 07-09 (snippet dialog): the script src is `${baseUrl}/widget.js` and the mount-point template is `<div data-nsi-calendar="${accountSlug}/${eventSlug}"></div>`
</output>
