import { type NextRequest, NextResponse } from "next/server";

/**
 * GET /widget.js — Serves the NSI embed loader script with BASE_URL injected
 * from process.env.NEXT_PUBLIC_APP_URL at request time.
 *
 * Why a Route Handler instead of public/widget.js:
 *   - public/widget.js is static — cannot inject NEXT_PUBLIC_APP_URL
 *   - Hardcoding BASE_URL means manual edit on every deploy (Pitfall 10)
 *   - Route Handler runs server-side; Vercel CDN caches via s-maxage
 *
 * Cache strategy:
 *   - Browser: 1 hour  (max-age=3600)
 *   - CDN:     24 hours (s-maxage=86400)
 *   - Cache bust: append ?v=<deployId> to URL for immediate CDN invalidation
 *
 * postMessage protocol contract (Plan 07-03 lock):
 *   - Event shape:  { type: "nsi-booking:height", height: number }
 *   - Source guard: event.source === iframe.contentWindow (NOT origin matching)
 *   - Target origin: "*" on postMessage sender (host origin is unknowable)
 *
 * iframe src:  ${BASE_URL}/embed/${accountSlug}/${eventSlug}
 *
 * EMBED-02 (static loader) + EMBED-03 (auto-resize via postMessage).
 */
export async function GET(request: NextRequest) {
  // Resolve BASE_URL: env var > request origin fallback (dev convenience).
  // Strip trailing slash so string concatenation in the script body is uniform.
  // Use || (not ??) so an empty-string env var also falls back to request origin.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    request.nextUrl.origin;

  const script = buildWidgetScript(baseUrl);

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Browser caches 1h; CDN caches 24h. On redeploy with a new BASE_URL,
      // append ?v=<deployId> to the script tag src to bust both layers.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      // Scripts use no-cors fetch model; CORS header is harmless and makes
      // fetch()-based inclusion possible for edge cases.
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Builds the widget loader IIFE as a string.
 *
 * Decisions:
 *   - JSON.stringify(baseUrl): safe injection — handles any special chars in env value
 *   - window.__nsiWidgetLoaded guard: idempotency — second <script> is a no-op (Pitfall 3)
 *   - data-nsi-calendar="account/event": preferred single-attribute form
 *   - data-nsi-account + data-nsi-event: explicit-attribute fallback
 *   - encodeURIComponent on slug parts: prevents path injection from malicious attributes
 *   - iframe placed inside mount el hidden (height:0; visibility:hidden) from the start
 *   - On first valid nsi-booking:height message: skeleton removed, iframe revealed
 *   - 5-second handshake timeout: falls back to inline link if embed never posts
 *   - event.source === iframe.contentWindow: source validation per Plan 07-03 lock
 *   - Each invocation of initWidget() closes over its own `iframe` var: independent channels
 */
function buildWidgetScript(baseUrl: string): string {
  // JSON.stringify produces a quoted, escaped JS string literal.
  const safeBaseUrl = JSON.stringify(baseUrl);

  return `(function () {
  // Idempotency guard — second <script src="/widget.js"> is a no-op.
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
    // Fallback: data-nsi-account + data-nsi-event (explicit attribute form)
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
      '<a href="' + BASE_URL + '/' + target.account + '/' + target.event +
        '" target="_blank" rel="noopener noreferrer" style="color:#0A2540;font-weight:600;">' +
      'open booking page' +
      '</a></p>';
  }

  function initWidget(el) {
    var target = parseTarget(el);
    if (!target) return;

    renderSkeleton(el);

    var iframe = document.createElement("iframe");
    iframe.src =
      BASE_URL +
      "/embed/" +
      encodeURIComponent(target.account) +
      "/" +
      encodeURIComponent(target.event);
    // Hidden inside el from the start; revealed on first valid postMessage.
    iframe.style.cssText =
      "width:100%;border:0;display:block;background:transparent;visibility:hidden;height:0;";
    iframe.scrolling = "no";
    iframe.setAttribute("allow", "");
    iframe.setAttribute("title", "Booking widget");

    // Append iframe inside mount element immediately so the embed page loads
    // and begins sending nsi-booking:height messages.
    el.appendChild(iframe);

    var settled = false;
    var timeoutId = setTimeout(function () {
      if (settled) return;
      settled = true;
      // Remove iframe; replace skeleton + iframe with fallback link.
      renderFallback(el, target);
    }, HANDSHAKE_TIMEOUT_MS);

    function onMessage(evt) {
      // Protocol filter (Plan 07-03 lock): type must be "nsi-booking:height".
      if (!evt.data || evt.data.type !== "nsi-booking:height") return;
      // Source guard (Plan 07-03 lock): ignore postMessages from unrelated iframes
      // or from the host page itself. Origin matching is not used (it is "*" on
      // the sender side and unknowable at widget.js load time).
      if (evt.source !== iframe.contentWindow) return;
      // Sanity: height must be a positive number.
      if (typeof evt.data.height !== "number" || evt.data.height <= 0) return;

      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        // Remove skeleton siblings; leave iframe in place.
        var children = el.children;
        for (var j = children.length - 1; j >= 0; j--) {
          if (children[j] !== iframe) el.removeChild(children[j]);
        }
        // Reveal iframe.
        iframe.style.visibility = "visible";
      }
      // Apply reported height on every message (handles content resize events).
      iframe.style.height = evt.data.height + "px";
    }

    window.addEventListener("message", onMessage);
  }

  function init() {
    var els = document.querySelectorAll("[data-nsi-calendar]");
    for (var i = 0; i < els.length; i++) {
      initWidget(els[i]);
    }
  }

  // Run after DOM is ready.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();`;
}
