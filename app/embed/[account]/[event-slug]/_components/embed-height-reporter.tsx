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
