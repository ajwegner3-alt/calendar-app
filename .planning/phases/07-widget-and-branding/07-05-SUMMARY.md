---
phase: 07-widget-and-branding
plan: 05
subsystem: api
tags: [widget, embed, iframe, postMessage, route-handler, javascript, caching, vitest]

# Dependency graph
requires:
  - phase: 07-03
    provides: "nsi-booking:height postMessage protocol contract; /embed/[account]/[event-slug] route"
  - phase: 07-01
    provides: "NEXT_PUBLIC_APP_URL env var convention; project env setup"
provides:
  - "app/widget.js/route.ts — Route Handler serving IIFE embed loader at GET /widget.js"
  - "BASE_URL injected from NEXT_PUBLIC_APP_URL at request time (not hardcoded)"
  - "5-second handshake timeout + inline fallback link contract"
  - "nsi-booking:height postMessage listener with evt.source === iframe.contentWindow validation"
  - "tests/widget-js.test.ts — 5 Vitest integration test cases"
  - "Forward contract for 07-09 snippet dialog: script src = ${baseUrl}/widget.js, mount = <div data-nsi-calendar='${accountSlug}/${eventSlug}'></div>"
affects:
  - 07-09-embed-snippet-dialog (script src URL + mount-point attribute format locked here)
  - future-plan-public-docs (widget.js embedding documentation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route Handler at app/widget.js/route.ts makes Next.js serve dynamic JS at /widget.js URL"
    - "JSON.stringify(baseUrl) for safe env var injection into JS string template"
    - "|| fallback (not ??) for BASE_URL so empty-string env var also falls back to request origin"
    - "Iframe placed hidden (height:0; visibility:hidden) inside mount el from start; revealed on first valid postMessage"
    - "Skeleton + iframe coexist in mount el; skeleton siblings removed when height message arrives"
    - "Per-initWidget closure captures its own iframe ref — independent postMessage channels per mount point"

key-files:
  created:
    - app/widget.js/route.ts
    - tests/widget-js.test.ts
  modified:
    - app/cancel/[token]/_lib/resolve-cancel-token.ts

key-decisions:
  - "Route Handler over public/widget.js: dynamic handler enables NEXT_PUBLIC_APP_URL injection at request time (Pitfall 10 avoidance)"
  - "Cache-Control: public, max-age=3600, s-maxage=86400 — 1h browser / 24h CDN; bust by appending ?v=<deployId> to script src"
  - "Content-Type: application/javascript; charset=utf-8 (not text/javascript per plan contract)"
  - "evt.source === iframe.contentWindow source guard (not origin) — host origin unknowable at script load time"
  - "data-nsi-calendar='account/event' preferred single-attribute format; data-nsi-account + data-nsi-event fallback"
  - "encodeURIComponent on slug parts in iframe.src — prevents path injection from malicious data attributes"
  - "|| fallback for BASE_URL resolution: empty-string env var treated same as unset (falls back to request.nextUrl.origin)"

patterns-established:
  - "Pattern: buildWidgetScript(baseUrl) pure function — separates BASE_URL resolution from script generation, makes unit testing straightforward"
  - "Pattern: JSON.stringify for env var injection into JS template literals — handles any special chars safely"
  - "Pattern: relative import path for tests/ importing app/widget.js/route.ts — avoids @/ alias misinterpreting .js extension"

# Metrics
duration: 5min
completed: 2026-04-26
---

# Phase 7 Plan 05: Widget.js Route Handler Summary

**Next.js Route Handler at app/widget.js/route.ts serving IIFE embed loader with NEXT_PUBLIC_APP_URL injected at request time, evt.source postMessage validation, 5s handshake timeout fallback, and 5-case Vitest suite (80/80 tests green)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-26T14:47:08Z
- **Completed:** 2026-04-26T14:52:16Z
- **Tasks:** 2/2
- **Files modified:** 3 (2 created, 1 bug-fixed)

## Accomplishments

- Built the Route Handler at `app/widget.js/route.ts` — Next.js serves it at `/widget.js`. BASE_URL is read from `process.env.NEXT_PUBLIC_APP_URL` at request time via `JSON.stringify` injection, never hardcoded (RESEARCH Pitfall 10 avoided)
- Implemented full embed loader IIFE: `data-nsi-calendar="account/event"` discovery, skeleton animation, hidden-then-reveal iframe lifecycle, `evt.source === iframe.contentWindow` source guard, 5-second handshake timeout with inline fallback link, and `window.__nsiWidgetLoaded` idempotency guard
- Vitest integration suite passes 5 test cases covering status/headers, BASE_URL injection from env, request-origin fallback, trailing-slash stripping, and script-body invariants — 80/80 tests green (up from 75)
- Locked the forward contract for Plan 07-09 (snippet dialog): `script src="${baseUrl}/widget.js"` and mount `<div data-nsi-calendar="${accountSlug}/${eventSlug}"></div>`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create app/widget.js/route.ts** - `2796c55` (feat)
2. **Task 2: Vitest integration test for /widget.js** - `92f7067` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/widget.js/route.ts` — Route Handler: GET /widget.js returns Content-Type: application/javascript with injected BASE_URL and full IIFE embed loader
- `tests/widget-js.test.ts` — 5 Vitest integration tests (headers, BASE_URL injection, origin fallback, trailing slash, script invariants)
- `app/cancel/[token]/_lib/resolve-cancel-token.ts` — Bug fix: added missing `logo_url` and `brand_primary` fields to account return objects (both "active" and "cancelled" branches)

## Decisions Made

- **Route Handler over `public/widget.js`**: A static file cannot inject `NEXT_PUBLIC_APP_URL`. The Route Handler solves this cleanly at request time; Vercel CDN caches via `s-maxage`. Cache bust by appending `?v=<deployId>` to the `<script src>`.
- **`Content-Type: application/javascript; charset=utf-8`**: Correct MIME type per plan contract (not `text/javascript`).
- **Cache strategy `public, max-age=3600, s-maxage=86400`**: 1h browser / 24h CDN. Chosen over `immutable` because the URL is not versioned by default; owners append `?v=` for explicit cache bust.
- **`||` fallback for BASE_URL**: Used `process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin` instead of `??` so that an empty-string env var (e.g. in test `vi.stubEnv("NEXT_PUBLIC_APP_URL", "")`) also falls back to request origin.
- **Source validation via `evt.source`**: `evt.source !== iframe.contentWindow` (not origin matching) per Plan 07-03 lock. Host page origin is unknowable at script load time.
- **Iframe starts hidden inside mount el**: `height:0; visibility:hidden` from the start. Skeleton siblings are removed when the first valid message arrives. Avoids the offscreen-move-and-listener-rebind complexity from the plan's first draft.
- **Relative import in test**: `../app/widget.js/route` instead of `@/app/widget.js/route` — the `@/` alias path concatenation creates `app/widget.js` which TypeScript resolves as a `.js` extension import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed empty-string env var not falling back to request origin**

- **Found during:** Task 2 (Vitest test execution — test 3 failed on first run)
- **Issue:** `process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin` — nullish coalescing `??` only handles `null`/`undefined`. Setting env var to `""` via `vi.stubEnv` returned `""` (empty string) which `??` does not replace.
- **Fix:** Changed `??` to `||` so empty string also falls back: `process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin`
- **Files modified:** `app/widget.js/route.ts`
- **Verification:** Test 3 now passes; all 5 tests green
- **Committed in:** `92f7067` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed resolve-cancel-token.ts missing logo_url + brand_primary in account return**

- **Found during:** Task 1 (build verification — TypeScript type error surfaced)
- **Issue:** `ResolvedCancelToken.account` interface was updated in a prior plan to require `logo_url: string | null; brand_primary: string | null`, but the two return statements in `resolveCancelToken()` (for "active" and "cancelled" states) were not updated — TS2739 type error
- **Fix:** Added `logo_url: account.logo_url ?? null` and `brand_primary: account.brand_primary ?? null` to both return branches
- **Files modified:** `app/cancel/[token]/_lib/resolve-cancel-token.ts`
- **Verification:** `npm run build` succeeds; TypeScript clean
- **Committed in:** `2796c55` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required for correct operation — one for test correctness, one to unblock the build. No scope creep.

## Issues Encountered

None beyond the two auto-fixed bugs above.

## User Setup Required

None - no external service configuration required.

## Forward Contract for Plan 07-09 (Snippet Dialog)

The embed snippet dialog (Plan 07-09) should generate HTML using these exact forms:

```html
<!-- Script tag -->
<script src="${baseUrl}/widget.js"></script>

<!-- Mount point (preferred single-attribute form) -->
<div data-nsi-calendar="${accountSlug}/${eventSlug}"></div>
```

The `baseUrl` is whatever `NEXT_PUBLIC_APP_URL` resolves to in production (e.g. `https://calendar-app.vercel.app`). The snippet dialog can read `process.env.NEXT_PUBLIC_APP_URL` server-side or construct it from the current request origin.

## Next Phase Readiness

- Plans 07-06, 07-07, 07-08 are parallel and unaffected — this plan only touched `app/widget.js/route.ts` and `tests/widget-js.test.ts`
- Plan 07-09 (snippet dialog) has the locked contract above — no further coordination needed before starting
- 80/80 tests green; build clean; `/widget.js` visible in Next.js route manifest

---
*Phase: 07-widget-and-branding*
*Completed: 2026-04-26*
