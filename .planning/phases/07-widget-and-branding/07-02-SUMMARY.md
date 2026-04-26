---
phase: 07-widget-and-branding
plan: 02
subsystem: infra
tags: [csp, security-headers, next-config, proxy, supabase-storage, x-frame-options, embed, iframe]

# Dependency graph
requires:
  - phase: 07-01-branding-lib
    provides: "AccountSummary extension, RESERVED_SLUGS 'embed' added — confirmed embed route will exist"
  - phase: 06-cancel-and-reschedule-lifecycle
    provides: "proxy.ts established as middleware entry point with updateSession() pattern"
provides:
  - "Per-route CSP branching in proxy.ts: /embed/* gets frame-ancestors * + no X-Frame-Options; all other routes get frame-ancestors 'self' + X-Frame-Options: SAMEORIGIN"
  - "Global default security headers in next.config.ts (X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff)"
  - "Public Supabase Storage bucket 'branding' (PNG-only, 2 MB cap) — pre-existed from prior session"
affects:
  - "07-03 embed route (relies on /embed/* CSP being set; Plan 07-03 must not set its own CSP)"
  - "07-04 branding editor (logo upload uses 'branding' bucket)"
  - "07-05 logo upload action (bucket name 'branding' locked)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "proxy.ts owns all CSP — never in next.config.ts (conditional delete impossible in headers())"
    - "updateSession() response preserved and mutated in place (not replaced with NextResponse.next())"
    - "next.config.ts owns X-Frame-Options + X-Content-Type-Options global defaults; proxy.ts overrides per-route"

key-files:
  created: []
  modified:
    - proxy.ts
    - next.config.ts

key-decisions:
  - "CSP lives ONLY in proxy.ts — next.config.ts headers() cannot conditionally delete a header (frame-ancestors * on /embed/* requires deletion of X-Frame-Options, which is impossible in next.config.ts)"
  - "X-Frame-Options: SAMEORIGIN set in next.config.ts as global default; proxy.ts re-asserts it on non-embed routes and DELETES it on /embed/* routes"
  - "updateSession() response object mutated in place — fresh NextResponse.next() would discard Supabase auth cookie updates (RESEARCH Pitfall 2)"
  - "Supabase Storage 'branding' bucket: PNG-only (not PNG+SVG) in v1 — SVG can embed scripts (XSS surface); SVG support is a deferred future enhancement"
  - "Bucket pre-existed from prior session — no creation action needed; verified in Supabase dashboard"

patterns-established:
  - "proxy.ts CSP branch pattern: capture updateSession() response → branch on pathname → mutate response headers → return same response"
  - "Header deletion pattern: response.headers.delete('X-Frame-Options') on embed routes — delete beats override for X-FO/CSP conflict"

# Metrics
duration: continuation session (Tasks 1+2 prior session; Task 3 pre-existing bucket)
completed: 2026-04-26
---

# Phase 7 Plan 02: Proxy CSP and Headers Summary

**Per-route Content-Security-Policy via proxy.ts mutation of updateSession() response, with global X-Frame-Options defaults in next.config.ts and pre-existing 'branding' Supabase Storage bucket confirmed**

## Performance

- **Duration:** 2-session execution (Tasks 1+2 in prior session; Task 3 bucket pre-existed; continuation verified and documented in this session)
- **Started:** 2026-04-26T00:00:00Z (prior session)
- **Completed:** 2026-04-26T14:17:25Z
- **Tasks:** 3 (all complete)
- **Files modified:** 2

## Accomplishments

- proxy.ts updated to capture `updateSession()` response and branch on `/embed/` prefix: embed routes get `frame-ancestors *` + X-Frame-Options deleted; all other routes get `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` re-asserted
- next.config.ts updated from empty config to `headers()` returning global defaults (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`) applied to all routes via `source: "/(.*)"` — CSP intentionally absent here (proxy.ts owns CSP)
- Supabase Storage `branding` bucket confirmed pre-existing (public, PNG-only, 2 MB cap) — no dashboard action needed this session; checkpoint outcome documented

## Task Commits

Each task was committed atomically:

1. **Task 1: Add global default security headers in next.config.ts** - `bc7572f` (feat)
2. **Task 2: Add per-route CSP branching in proxy.ts** - `902ad35` (feat)
3. **Task 3: Supabase Storage 'branding' bucket** - pre-existing (no commit; verified in dashboard prior session)

## Files Created/Modified

- `proxy.ts` — Added per-route CSP branching layered on top of `updateSession()` response; preserves Supabase auth cookies (RESEARCH Pitfall 2 compliance)
- `next.config.ts` — Replaced empty `{}` config with `headers()` returning X-Frame-Options + X-Content-Type-Options global defaults

## proxy.ts Key Diff

```typescript
// Before: proxy.ts called updateSession() and returned its response unchanged
// After: response is captured, then headers are mutated in place before returning

export async function proxy(request: NextRequest) {
  // CRITICAL: capture response — do NOT create fresh NextResponse.next()
  // A fresh response discards Supabase cookie mutations → owner logs out on every request
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/embed/")) {
    response.headers.set("Content-Security-Policy", "frame-ancestors *");
    // Delete X-Frame-Options — conflicts with frame-ancestors on older browsers/proxies
    // next.config.ts sets SAMEORIGIN globally; proxy.ts removes it for /embed/*
    response.headers.delete("X-Frame-Options");
  } else {
    response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
  }

  return response;
}
```

**Pitfall 2 rationale:** `updateSession()` from `@/lib/supabase/proxy` modifies the response object to set refreshed Supabase auth cookies. If proxy.ts discards this response and creates a `NextResponse.next()`, those cookie mutations are lost. The owner's session token is never refreshed → they appear to be logged out after the first response cycle. Fix: always mutate the `updateSession()` response in place.

## next.config.ts Header Strategy

```typescript
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
```

**Why CSP is NOT here:** `next.config.ts` `headers()` runs statically and cannot branch on pathname at runtime. `/embed/*` requires `frame-ancestors *` AND deletion of X-Frame-Options — both of which are impossible from a static header config. CSP is owned exclusively by proxy.ts where pathname is available at middleware execution time.

## Manual Checkpoint Outcome: Task 3 (Supabase Storage Bucket)

**Outcome:** Bucket pre-existed — no action required this session.

The `branding` Supabase Storage bucket was already present on project `mogfnutxrrbtvnaupoun` when Andrew checked the dashboard. It was likely created during a prior planning or setup session. The bucket exists with the correct configuration:
- Name: `branding`
- Public: ON
- Allowed MIME types: `image/png` only
- File size limit: 2 MB

**Impact on downstream plans:** None. Plans 07-04 and 07-05 reference bucket name `branding` — confirmed correct.

## Decisions Made

1. **CSP lives ONLY in proxy.ts** — never in `next.config.ts`. Static `headers()` cannot conditionally delete a header. `frame-ancestors *` on `/embed/*` requires deleting `X-Frame-Options` — impossible in `next.config.ts`. LOCKED.

2. **X-Frame-Options layering** — `next.config.ts` sets the global default `SAMEORIGIN`; proxy.ts re-asserts on non-embed routes (belt-and-suspenders) and deletes on embed routes. Both layers needed: next.config.ts runs first (static), proxy.ts overrides/deletes at runtime.

3. **updateSession() response preserved** — proxy.ts mutates `response.headers` on the object returned by `updateSession()`, never creating a fresh `NextResponse`. This is the authoritative pattern for all future proxy.ts modifications (RESEARCH Pitfall 2).

4. **PNG-only in v1 'branding' bucket** — SVG support deferred; SVG can embed JavaScript, making it an XSS attack surface for logo uploads. PNG only for v1; SVG is a deferred future enhancement.

## Deviations from Plan

None — plan executed exactly as written. Task 3 (bucket) pre-existed; treated as done per checkpoint resolution.

## Authentication Gates

None.

## Verification Results

**Build:** `npm run build` — clean (13/13 static pages generated, 0 TypeScript errors)

**Tests:** `npm test` — 75/75 passing (8 test files; no regressions from proxy.ts or next.config.ts changes)

**Expected curl behavior (post-deploy):**
- `curl -I https://calendar-app-xi-smoky.vercel.app/` → `content-security-policy: frame-ancestors 'self'` + `x-frame-options: SAMEORIGIN` + `x-content-type-options: nosniff`
- `curl -I https://calendar-app-xi-smoky.vercel.app/embed/anything` → `content-security-policy: frame-ancestors *` AND no `x-frame-options` header (returns 404 until 07-03 ships, but headers are set on the 404 response)

## Next Phase Readiness

- Plan 07-03 (embed route + height reporter): CSP foundation complete. `/embed/*` will receive correct headers automatically. Plan 07-03 must NOT add its own CSP headers — proxy.ts already handles it.
- Plan 07-04 (branding editor): `branding` bucket confirmed ready. PNG-only, 2 MB cap, public.
- Plan 07-05 (logo upload action): bucket name `branding` locked — no deviation from plan needed.
- No blockers.

---
*Phase: 07-widget-and-branding*
*Completed: 2026-04-26*
