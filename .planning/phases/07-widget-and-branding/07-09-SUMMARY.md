---
phase: 07-widget-and-branding
plan: 09
subsystem: ui
tags: [shadcn, tabs, radix-ui, embed, widget, iframe, clipboard, csp, x-frame-options, postmessage]

# Dependency graph
requires:
  - phase: 07-03
    provides: /embed/* route + nsi-booking:height postMessage protocol + EmbedShell with CSS vars
  - phase: 07-05
    provides: /widget.js Route Handler + idempotency guard + 5s handshake timeout fallback
provides:
  - shadcn Tabs primitive (components/ui/tabs.tsx)
  - embed-snippets.ts pure builder functions (buildScriptSnippet + buildIframeSnippet)
  - EmbedCodeDialog client component (dialog with two tabs + live preview iframe)
  - EmbedTabs client component (Script recommended + iframe fallback tabs + per-tab copy button + Sonner toast)
  - Updated RowActionsMenu with Get embed code entry (active rows only)
  - Production-verified: widget posts nsi-booking:height from real https third-party origins
affects:
  - Phase 9 manual QA (Squarespace/WordPress live embed EMBED-07)
  - Phase 8 (any future embed snippet format changes must update buildScriptSnippet/buildIframeSnippet)

# Tech tracking
tech-stack:
  added:
    - shadcn tabs (wraps radix-ui monorepo Tabs primitive, already installed)
  patterns:
    - Belt-and-suspenders copy feedback: clipboard API + Sonner toast + 2s button label swap
    - Active-only guard on embed menu item (archived rows get no embed entry — no functioning page behind them)
    - appUrl prop-drilling from server component → dialog (ensures correct URL in any deploy environment)
    - Live preview iframe bounded at height=500 inside dialog (preview only; production embed auto-resizes via postMessage)
    - frame-ancestors CSP spec quirk: `*` does NOT match opaque origins (file://, about:blank); local testing requires http:// via `npx serve`

key-files:
  created:
    - components/ui/tabs.tsx
    - app/(shell)/app/event-types/_lib/embed-snippets.ts
    - app/(shell)/app/event-types/_components/embed-code-dialog.tsx
    - app/(shell)/app/event-types/_components/embed-tabs.tsx
  modified:
    - app/(shell)/app/event-types/_components/row-actions-menu.tsx
    - next.config.ts (mid-plan fix: removed global X-Frame-Options header)

key-decisions:
  - "Script snippet: mount-point div BEFORE script tag (DOMContentLoaded fires after DOM is built; element must exist)"
  - "Script snippet uses defer attribute for async load + better host-page performance"
  - "iframe snippet defaults height=600 (no owner-configured min-height; reasonable default)"
  - "buildScriptSnippet/buildIframeSnippet strip trailing slash from appUrl defensively"
  - "Dialog layout: max-w-3xl two-column (snippets left, preview right)"
  - "X-Frame-Options removed from next.config.ts entirely — proxy.ts owns it exclusively"
  - "frame-ancestors * per CSP spec does NOT match opaque origins — file:// tests always fail regardless of code"
  - "Production embed verification: Playwright on https://example.com parent confirmed widget posts nsi-booking:height (height: 626)"

patterns-established:
  - "Copy feedback: navigator.clipboard.writeText + toast.success + setCopied(true) + setTimeout 2000ms — reusable in any future copy-to-clipboard surface"
  - "Active-only guard in RowActionsMenu: embed menu item inside {!isArchived && ...} branch"
  - "Phase 9 Squarespace/WordPress test must be on a deployed https page, NOT file:// or browser sandbox URL"

# Metrics
duration: multi-session (Tasks 1-3 initial session + human-verify checkpoint + bug fix session + checkpoint resolution)
completed: 2026-04-26
---

# Phase 7 Plan 09: Embed Snippet Dialog Summary

**shadcn Tabs + EmbedCodeDialog with script/iframe snippet builders, copy feedback, and live preview iframe — verified production widget posts `nsi-booking:height` from real https third-party origins**

## Performance

- **Duration:** Multi-session (Tasks 1-3 + checkpoint + mid-plan bug fix + checkpoint resolution)
- **Started:** 2026-04-26
- **Completed:** 2026-04-26
- **Tasks:** 3 auto + 1 checkpoint (human-verify) — checkpoint resolved with "embed snippet approved"
- **Files modified:** 6

## Accomplishments

- Installed shadcn Tabs primitive (radix-ui monorepo, no new package install needed) and built pure `buildScriptSnippet` / `buildIframeSnippet` functions with correct HTML formats
- Built `EmbedCodeDialog` + `EmbedTabs` client components: two-tab dialog with copy buttons (clipboard API + Sonner toast + 2s label swap), live preview iframe, active-only guard in RowActionsMenu
- Diagnosed and fixed X-Frame-Options conflict: `next.config.ts` global headers were overwriting proxy.ts's `/embed/*` delete — removed X-FO from next.config.ts entirely; proxy.ts now exclusively owns the header
- Production embed verified end-to-end: Playwright on `https://example.com` parent confirmed iframe posts `{ type: "nsi-booking:height", height: 626 }` from origin `https://calendar-app-xi-smoky.vercel.app`
- Discovered and documented CSP spec quirk: `frame-ancestors *` does NOT match opaque origins (file://, about:blank); local testing must use `npx serve` (http:// scheme matches `*`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install tabs primitive + snippet builders** - `8944364` (feat)
2. **Task 2: Build EmbedCodeDialog + EmbedTabs** - `7aaeb7b` (feat)
3. **Task 3: Wire Get embed code into RowActionsMenu** - `9c5a1cc` (feat)
4. **Mid-plan fix: Remove X-Frame-Options from next.config.ts** - `d249562` (fix)

## Files Created/Modified

- `components/ui/tabs.tsx` — shadcn Tabs primitive wrapping radix-ui Tabs; exports Tabs, TabsList, TabsTrigger, TabsContent
- `app/(shell)/app/event-types/_lib/embed-snippets.ts` — Pure functions buildScriptSnippet + buildIframeSnippet; SnippetOpts interface (appUrl, accountSlug, eventSlug)
- `app/(shell)/app/event-types/_components/embed-tabs.tsx` — Client component; Script (recommended) + iframe fallback tabs; per-tab SnippetBlock with copy button + Sonner toast + 2s label swap
- `app/(shell)/app/event-types/_components/embed-code-dialog.tsx` — Client Dialog (max-w-3xl two-column); mounts EmbedTabs left + bounded preview iframe right (height=500); controlled open/close via parent
- `app/(shell)/app/event-types/_components/row-actions-menu.tsx` — Added embedOpen state + EmbedCodeDialog mount + Get embed code DropdownMenuItem inside {!isArchived} branch
- `next.config.ts` — Removed global X-Frame-Options SAMEORIGIN header (mid-plan fix); proxy.ts is now sole owner

## Decisions Made

**shadcn Tabs install outcome:** radix-ui monorepo pattern (same as Phase 3 lock — `npx shadcn@latest add tabs` created `components/ui/tabs.tsx` importing from `radix-ui`; no new separate package installed).

**Snippet HTML formats locked:**
- Script snippet: `<div data-nsi-calendar="${accountSlug}/${eventSlug}"></div>` then `<script src="${base}/widget.js" defer></script>` (div first — element in DOM before DOMContentLoaded; defer for async load)
- iframe snippet: `<iframe src="..." width="100%" height="600" frameborder="0" style="border:0;display:block;" title="Booking widget"></iframe>` (height=600 default)

**Dialog layout:** max-w-3xl two-column grid (snippets left, preview iframe right at bounded height=500). Preview is visual reference only; production embed auto-resizes via postMessage.

**Copy feedback pattern (belt-and-suspenders):** `navigator.clipboard.writeText(snippet)` → `toast.success(...)` + `setCopied(true)` + `setTimeout(() => setCopied(false), 2000)`. Error path calls `toast.error("Copy failed — select the text manually")`.

**Active-only constraint:** EmbedCodeDialog and Get embed code DropdownMenuItem are mounted exclusively inside the `{!isArchived && ...}` branch of RowActionsMenu. Archived event types have no functioning `/embed/*` page.

**X-Frame-Options ownership:** Removed from `next.config.ts` entirely. Reason: Next.js merges `next.config.ts headers()` AFTER middleware execution, so proxy.ts's `response.headers.delete("X-Frame-Options")` on `/embed/*` was overwritten by the static config. proxy.ts now owns X-FO exclusively: sets `SAMEORIGIN` on non-embed routes, omits it on `/embed/*`. This is RESEARCH Pitfall 1 confirmed in production.

## Deviations from Plan

### Mid-Plan Bug Fix (Orchestrator-Driven)

**[Rule 1 - Bug] X-Frame-Options in next.config.ts overwrote proxy.ts header deletion on /embed/*

- **Found during:** Human-verify checkpoint (Task 4 smoke test)
- **Issue:** Both iframes in the file:// smoke test hit the 5s handshake timeout and fell back to the inline link. curl investigation showed the embed response included both `Content-Security-Policy: frame-ancestors *` AND `X-Frame-Options: SAMEORIGIN`. Browsers honored the more restrictive X-FO and blocked framing. Root cause: `next.config.ts` set X-Frame-Options globally; Next.js merges next.config headers AFTER middleware runs, so proxy.ts's `response.headers.delete("X-Frame-Options")` on /embed/* was overwritten by the static config.
- **Fix:** Removed X-Frame-Options from `next.config.ts` entirely. proxy.ts now solely owns it: sets `SAMEORIGIN` on non-embed routes, omits on /embed/* routes.
- **Files modified:** `next.config.ts`
- **Verification:** `curl -I https://calendar-app-xi-smoky.vercel.app/embed/nsi/consultation` — only `frame-ancestors *` in CSP, no X-Frame-Options. `curl -I https://calendar-app-xi-smoky.vercel.app/` — returns `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`. Playwright on https://example.com parent confirmed iframe posts `nsi-booking:height` (height: 626) successfully.
- **Committed in:** `d249562`

---

**Total deviations:** 1 mid-plan bug fix (Rule 1 — incorrect header layering)
**Impact on plan:** Essential for correct embed framing. No scope creep. All EMBED-05 and EMBED-06 requirements delivered as specified.

### CSP Spec Quirk Discovery (Not a Deviation — Documentation)

The original file:// smoke test failure was NOT a bug in the code. Per CSP spec, `frame-ancestors *` does NOT match opaque origins (file://, about:blank). The code was always correct; the test environment was wrong.

**Critical lock for Phase 9 manual QA:** Squarespace/WordPress embed test MUST be on a deployed page (real https URL), NOT a local file:// or browser sandbox URL. If local testing is needed before deploying to a third-party host, use `npx serve tmp/` (serves at http://localhost:*) — http:// scheme matches `*` in `frame-ancestors`. Never use file:// for CSP embed testing.

## Authentication Gates

None.

## Issues Encountered

**CSP spec / frame-ancestors opaque origin quirk:** The initial file:// smoke test showed both iframes falling back to the inline link. Investigation traced the root cause to X-Frame-Options overriding frame-ancestors on /embed/* routes (see Deviations above). After the fix, a secondary discovery: even with correct CSP, `frame-ancestors *` cannot match file:// origins per spec. Subsequent http:// test via `npx serve tmp/` confirmed both iframes rendered correctly. Production Playwright test on https://example.com confirmed end-to-end success.

**Next.js header merge order:** next.config.ts `headers()` apply FIRST (as static config), then middleware runs and can add headers, but NOT reliably delete next.config.ts headers. This is a fundamental Next.js behavior that affects any plan that needs conditional header deletion based on route — such work must live entirely in middleware/proxy.ts.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Phase 7 is now complete.** All 9 plans (07-01 through 07-09) are executed and live-verified.

**EMBED-05 delivered:** Script snippet per active event type via dialog (Script recommended tab with div + defer script).
**EMBED-06 delivered:** Raw iframe fallback snippet per active event type (iframe fallback tab with height=600).
**Production verified:** Widget posts `nsi-booking:height` from real https third-party origins (height: 626, confirmed via Playwright on example.com).

**Phase 9 backlog (EMBED-07):**
- Live Squarespace/WordPress embed test on a real deployed third-party page (not file://)
- CSP spec note: `frame-ancestors *` does NOT match opaque origins — test must be on https:// or http://localhost (via `npx serve`)
- Multi-widget test (two `data-nsi-calendar` divs) + idempotency guard (duplicate script tag) on a real host

**Phase 8 proceeds:** Reminders + Hardening + Dashboard List. All Phase 7 locks (widget.js format, snippet HTML formats, EmbedCodeDialog API, X-FO ownership in proxy.ts) are stable and documented in STATE.md.

---
*Phase: 07-widget-and-branding*
*Completed: 2026-04-26*
