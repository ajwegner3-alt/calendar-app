---
phase: 07-widget-and-branding
plan: 03
subsystem: ui
tags: [embed, iframe, postMessage, ResizeObserver, branding, next-js, server-component, chromeless]

# Dependency graph
requires:
  - phase: 07-01
    provides: lib/branding/contrast.ts (pickTextColor), AccountSummary with logo_url + brand_primary, RESERVED_SLUGS with "embed"
  - phase: 07-02
    provides: proxy.ts CSP branching — frame-ancestors * on /embed/* routes
  - phase: 05-public-booking-flow-and-email
    provides: BookingShell client component, loadEventTypeForBookingPage loader, BookingPageData types
provides:
  - app/embed/[account]/[event-slug]/page.tsx — chromeless Server Component booking page; noindex; preview-param sanitization
  - app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx — ResizeObserver -> postMessage protocol
  - app/embed/[account]/[event-slug]/_components/embed-shell.tsx — client wrapper; --brand-primary + --brand-text CSS vars; logo; EmbedHeightReporter
  - nsi-booking:height postMessage protocol (CONTRACT for Plan 07-05 widget.js)
  - ?previewColor + ?previewLogo param contract (CONTRACT for Plan 07-04 branding editor iframe)
affects:
  - 07-04-branding-editor (preview iframe src = /embed/[account]/[slug]?previewColor=&previewLogo=)
  - 07-05-widget-js (iframe.src = BASE_URL/embed/[account]/[slug]; listens for nsi-booking:height messages)
  - 07-06-apply-branding-to-page-surfaces (--brand-primary + --brand-text CSS vars established here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chromeless embed route: /embed/[account]/[slug] mirrors /[account]/[slug] data layer but reuses BookingShell without site chrome"
    - "ResizeObserver on document.documentElement (not body or ref) for full-page height including overflow"
    - "postMessage dedupe via lastHeight guard — prevents infinite resize loop (Pitfall 4)"
    - "iframe guard: window.parent === window check skips posting on standalone visits to /embed/*"
    - "Server-side query-param sanitization before passing to client component"
    - "Standard <img> over next/image for cross-domain Supabase Storage logos (avoids remotePatterns friction)"

key-files:
  created:
    - app/embed/[account]/[event-slug]/page.tsx
    - app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx
    - app/embed/[account]/[event-slug]/_components/embed-shell.tsx
  modified: []

key-decisions:
  - "app/embed/layout.tsx NOT created — root layout is already chromeless (html+body+Toaster only); sidebar lives in app/(shell)/layout.tsx route group which embed never enters"
  - "postMessage target origin '*' — host origin is unknowable; payload contains only height (no secrets); widget.js validates via event.source"
  - "Observe document.documentElement (not body) — scrollHeight includes overflowing modal/dropdown content"
  - "--brand-primary / --brand-text CSS var names — distinct from Tailwind v4 @theme tokens to avoid clobbering global theme"
  - "previewColor: /^#[0-9a-fA-F]{6}$/ regex; previewLogo: /^https:\\/\\// protocol gate — server-side sanitization prevents querystring injection"
  - "robots: { index: false, follow: false } on all embed metadata — canonical URL is /[account]/[event-slug]"
  - "BookingShell does NOT yet consume --brand-primary — Plan 07-06 wires that; embed is functional for 07-03 scope"

patterns-established:
  - "Pattern: embed route reuses Phase 5 loader + BookingShell without duplicating data fetching logic"
  - "Pattern: thin page.tsx (Server Component data + sanitization) + EmbedShell (client wrapper + CSS vars) + EmbedHeightReporter (behavioral, returns null)"

# Metrics
duration: 12min
completed: 2026-04-26
---

# Phase 7 Plan 03: Embed Route and Height Reporter Summary

**Chromeless /embed/[account]/[event-slug] route with nsi-booking:height postMessage protocol via ResizeObserver, ?previewColor/?previewLogo server-validated overrides for branding editor live preview, and noindex robots meta**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-26T09:12:00Z
- **Completed:** 2026-04-26T09:24:51Z
- **Tasks:** 3/4 (Task 1 skipped by design — root layout already chromeless)
- **Files modified:** 3 created, 0 modified

## Accomplishments

- Built the chromeless `/embed/[account]/[event-slug]` route that reuses `loadEventTypeForBookingPage` + `BookingShell` from Phase 5 — zero data-layer duplication; embed and hosted page always stay in sync
- Implemented `EmbedHeightReporter` with `ResizeObserver` on `document.documentElement`, dedupe via `lastHeight`, standalone-visit guard (`window.parent === window`), and proper cleanup on unmount — the contract that `widget.js` (Plan 07-05) will depend on
- Locked the `?previewColor` + `?previewLogo` server-side sanitization regex that `Plan 07-04` branding editor will rely on for live preview iframe
- Build succeeds with `npm run build`, 75/75 Vitest tests pass, TypeScript clean (pre-existing test-file errors unrelated to this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Assess app/embed/layout.tsx** — skipped (no commit; root layout is already chromeless — see Decisions Made)
2. **Task 2: Create EmbedHeightReporter** — `84fc4c4` (feat)
3. **Task 3: Create EmbedShell** — `2a2bb06` (feat)
4. **Task 4: Create embed page.tsx** — `b83cfae` (feat)

## Files Created/Modified

- `app/embed/[account]/[event-slug]/_components/embed-height-reporter.tsx` — `"use client"` behavioral component; ResizeObserver on documentElement; postMessage `{ type: "nsi-booking:height", height: number }` to `"*"`; deduped; iframe-only guard
- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` — `"use client"` wrapper; applies `--brand-primary` + `--brand-text` CSS vars; renders logo header (conditional), event name/duration, `BookingShell`, `EmbedHeightReporter`; plumbs `previewColor`/`previewLogo`
- `app/embed/[account]/[event-slug]/page.tsx` — `async` Server Component; `generateMetadata` with `robots: noindex/nofollow`; `await searchParams`; previewColor regex gate `/^#[0-9a-fA-F]{6}$/`; previewLogo protocol gate `/^https:\/\//`; `notFound()` on missing data

## Decisions Made

- **app/embed/layout.tsx NOT created:** Root `app/layout.tsx` is `<html><body>{children}<Toaster/></body></html>` — no sidebar, no nav, no header. The shell layout (`app/(shell)/layout.tsx`) is in a route group that the `/embed/*` path never enters. Creating an embed layout would be redundant. Toaster inside an iframe is invisible to the host page (sealed window) — harmless.
- **postMessage target origin `"*"`:** The host page embedding this iframe could be any domain (Squarespace, WordPress, contractor's custom site). There is no knowable "correct" origin to lock to. The payload is only `{ type, height }` — no auth tokens, no PII. `widget.js` validates source via `event.source === iframeRef.contentWindow` (Plan 07-05 will implement this).
- **Observe `document.documentElement` not `document.body`:** Body's `scrollHeight` can be less than the visible content height if the page uses `overflow: hidden` on body or if modals/dropdowns overflow the body boundary. `documentElement.scrollHeight` is the canonical full-page height.
- **`--brand-primary` / `--brand-text` CSS var names:** Kept distinct from Tailwind v4 `@theme` variable names (e.g., `--color-primary`) to avoid accidentally overriding the global NSI theme on `BookingShell` child components. Plan 07-06 will wire components to consume these vars.
- **Server-side preview-param sanitization:** `previewColor` validated against `/^#[0-9a-fA-F]{6}$/`; `previewLogo` validated against `/^https:\/\//`. Neither is passed to `EmbedShell` if validation fails (becomes `undefined`). This runs in the Server Component before any client boundary, preventing injection of arbitrary CSS values or non-HTTPS image URLs.
- **`robots: { index: false, follow: false }` on embed metadata:** The embed page is a distribution mechanism, not a canonical resource. Canonical is `/[account]/[event-slug]`. Both `generateMetadata` success and not-found paths set noindex to prevent accidental SEO indexing of the embed URL.

## postMessage Protocol Contract (for Plan 07-05)

```
Event name:     nsi-booking:height
Payload shape:  { type: "nsi-booking:height", height: number }
Target origin:  "*"
Sent when:      document.documentElement.scrollHeight changes (ResizeObserver + window resize)
Deduped:        lastHeight guard — only posts when height changes
Iframe guard:   window.parent === window check — standalone /embed/* visits do NOT post
Cleanup:        observer.disconnect() + removeEventListener on React unmount
```

**widget.js (Plan 07-05) validation contract:** Filter incoming messages by `event.data?.type === "nsi-booking:height"` AND `event.source === iframe.contentWindow`. Do NOT filter by `event.origin` — `"*"` origin makes origin `null` in some browsers.

## Preview-Param Contract (for Plan 07-04)

```
?previewColor   #RRGGBB hex — validated /^#[0-9a-fA-F]{6}$/
                Overrides account.brand_primary for live preview
                Used by: EmbedShell effectiveColor computation

?previewLogo    https:// URL — validated /^https:\/\//
                Overrides account.logo_url for live preview
                Used by: EmbedShell effectiveLogo computation

Both params:    Undefined (not passed to EmbedShell) if validation fails
                DB values remain as fallback when params absent or invalid
```

**iframe src pattern for Plan 07-04 branding editor:**
```
/embed/{accountSlug}/{eventSlug}?previewColor=%23{hex}&previewLogo={encodedUrl}
```

## CSS Var Naming Contract (for Plan 07-06)

```css
--brand-primary   The account's primary color (#RRGGBB)
--brand-text      "#ffffff" or "#000000" from pickTextColor(--brand-primary)
```

Applied via inline style on the `<div>` wrapping root in `EmbedShell`. Plan 07-06 will wire `BookingShell` child components (buttons, headings) to consume these vars via Tailwind utilities.

## Forward Contract for Plan 07-05 (widget.js)

```
iframe.src = `${BASE_URL}/embed/${accountSlug}/${eventSlug}`
iframe.style.width = "100%"
iframe.style.border = "none"
iframe.style.height = "0px"  // initial; updated by postMessage

// Listen:
window.addEventListener("message", (event) => {
  if (event.data?.type !== "nsi-booking:height") return;
  if (event.source !== iframe.contentWindow) return;
  iframe.style.height = `${event.data.height}px`;
});
```

## Deviations from Plan

### Task 1: app/embed/layout.tsx — Skipped by Plan Design

The plan explicitly specified that if `app/layout.tsx` is already chromeless, skip creating the embed layout. Root layout confirmed to be `<html><body>{children}<Toaster/></body></html>` — no sidebar, no nav. Skipping was the correct outcome per the plan's decision tree.

This is NOT a deviation — it is the documented optional path. No auto-fix rule applies.

## Issues Encountered

None. TypeScript check returns only pre-existing test-file errors (Phase 5/6 mock alias issues, documented in 07-01 SUMMARY — unrelated to this plan). Build clean, 75/75 tests pass.

## User Setup Required

None — no new external services or environment variables introduced. The embed route reads from existing DB (via `loadEventTypeForBookingPage`) and uses existing CSP headers (via Plan 07-02 proxy.ts).

## Next Phase Readiness

- `/embed/[account]/[event-slug]` route is live and accessible in dev + Vercel deploy
- `nsi-booking:height` postMessage protocol is fully implemented — Plan 07-05 may proceed
- `?previewColor` + `?previewLogo` contract is locked and server-validated — Plan 07-04 may use this immediately
- `--brand-primary` + `--brand-text` CSS vars are applied at the EmbedShell wrapper level — Plan 07-06 may wire consumption
- Reserved-slug guard (`"embed"` in RESERVED_SLUGS) prevents `/[account]=embed/...` collision — confirmed working from Plan 07-01

---
*Phase: 07-widget-and-branding*
*Completed: 2026-04-26*
