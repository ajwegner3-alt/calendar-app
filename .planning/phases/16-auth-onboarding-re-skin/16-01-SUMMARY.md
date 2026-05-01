---
phase: 16
plan: 01
subsystem: ui-shell
tags: [header, variant-prop, auth-shell, onboarding-shell, additive-api]
requires:
  - phase-15-header-pill-locked
provides:
  - header-variant-auth
  - header-rightLabel-prop
affects:
  - phase-16-02-auth-hero-login-signup
  - phase-16-03-five-short-auth-pages
  - phase-16-04-onboarding-reskin
tech-stack:
  added: []
  patterns:
    - variant-prop-on-shared-shell-component
key-files:
  created: []
  modified:
    - app/_components/header.tsx
decisions:
  - REQUIREMENTS.md AUTH-13 wording corrected — variant="auth" is the canonical value for no-sidebar surfaces (research-recommended)
  - Owner default behavior preserved byte-for-byte (zero call-site changes in this plan)
  - SidebarTrigger import retained at module top (tree-shaking handles dead code; conditional render only)
duration: ~5min
completed: 2026-04-30
---

# Phase 16 Plan 01: Header Variant + RightLabel Prop Summary

**One-liner:** Extended `Header` with `variant?: "owner" | "auth"` and `rightLabel?: string` props as a backward-compatible API addition; owner-shell default behavior preserved exactly.

## What Was Built

Extended `app/_components/header.tsx` with two optional props:

1. **`variant?: "owner" | "auth"`** (default `"owner"`)
   - `"owner"`: outer wrapper uses the existing string `fixed top-2 md:top-6 left-0 md:left-[var(--sidebar-width)] right-0 z-30 px-4` and renders `<SidebarTrigger className="md:hidden" />` — Phase 15 HDR-02 sidebar offset preserved exactly.
   - `"auth"`: outer wrapper uses `fixed top-2 md:top-6 left-0 right-0 z-30 px-4` (no sidebar offset) and skips `SidebarTrigger` entirely (no `SidebarProvider` exists on auth/onboarding pages).

2. **`rightLabel?: string`** (optional)
   - When provided (truthy), renders directly in the right-slot span.
   - When omitted, falls back to existing `getContextLabel(pathname)` derivation.
   - Enables onboarding's static `"Setup"` label across all 3 steps without per-pathname plumbing.

The inner pill `<div>` className string, the `<Link href="/app">` wordmark JSX, the `'use client'` directive, all imports, and the `getContextLabel` helper are all unchanged.

A JSDoc comment was added above the function describing both props.

## API Reference

```tsx
interface HeaderProps {
  variant?: 'owner' | 'auth';
  rightLabel?: string;
}

export function Header({ variant = 'owner', rightLabel }: HeaderProps) { ... }
```

Consumers in subsequent plans:
- Plans 16-02 (login/signup): `<Header variant="auth" />`
- Plan 16-03 (5 short auth pages): `<Header variant="auth" />`
- Plan 16-04 (onboarding): `<Header variant="auth" rightLabel="Setup" />`

## Verification Results

| Check | Result |
|-------|--------|
| `variant` prop present in header.tsx | PASS (line 19) |
| `rightLabel` prop present in header.tsx | PASS (lines 20, 31, 33) |
| `md:left-[var(--sidebar-width)]` still present in owner branch | PASS (line 38) |
| `SidebarTrigger` rendered conditionally on `variant !== 'auth'` | PASS (line 44) |
| `npx tsc --noEmit` exits clean for non-test files | PASS (zero new errors; pre-existing `tests/` errors unchanged per STATE.md backlog note) |

## Owner-Shell Regression Status

**Zero regression.** Default behavior with no props is byte-for-byte identical:
- Outer header wrapper className string is the unchanged Phase 15 string.
- SidebarTrigger renders unconditionally when `variant === 'owner'` (the default).
- `getContextLabel(pathname)` is the fallback when `rightLabel` is undefined — existing pathname-driven label derivation runs exactly as before.

No call sites updated in this plan. The single `<Header />` invocation in `app/(shell)/layout.tsx` continues to render with the default variant. Phase 15's HDR-02 desktop sidebar offset and mobile SidebarTrigger remain intact.

## Deviations from Plan

None — plan executed exactly as written.

## Authentication Gates

None — single autonomous task, no external services touched.

## Note on REQUIREMENTS.md AUTH-13

REQUIREMENTS.md AUTH-13 reads `<Header variant="owner" />` for auth pages. Per RESEARCH.md section 3, this is corrected to `<Header variant="auth" />` for auth/onboarding (no sidebar) — taking the original wording literally would either crash (no `SidebarProvider`) or place the pill incorrectly (sidebar offset on no-sidebar surfaces). This correction is implemented at the Header API level here; consumer plans (16-02/03/04) will use `variant="auth"`.

## Call Site Updates

**None in this plan.** Subsequent plans wire the new variant:
- Plan 16-02 — `app/(auth)/_components/auth-hero.tsx` + `app/(auth)/app/login/page.tsx` + `app/(auth)/app/signup/page.tsx`
- Plan 16-03 — 5 short auth pages
- Plan 16-04 — `app/onboarding/layout.tsx` (with `rightLabel="Setup"`)

## Next Phase Readiness

- Plans 16-02, 16-03, 16-04 are unblocked. The Header API now supports both no-sidebar layouts and static-label scenarios.
- No outstanding concerns. Owner-shell visual gate not required for this plan (pure additive API change with default-preserves-behavior contract); subsequent plans that wire `variant="auth"` will run live Vercel preview gates.

## Commit

- `0248caf` — feat(16-01): extend Header with variant and rightLabel props
