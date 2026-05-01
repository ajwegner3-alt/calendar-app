---
phase: 17-public-surfaces-and-embed
plan: 06
type: execute
wave: 3
depends_on: ["17-02"]
files_modified:
  - app/[account]/[event-slug]/not-found.tsx
  - app/_components/token-not-active.tsx
autonomous: true

must_haves:
  truths:
    - "Visiting an invalid /[account]/[event-slug] URL renders a bg-gray-50 + centered card not-found page (no PublicShell — no account context)"
    - "TokenNotActive renders inside a bg-gray-50 wrapper with centered card matching v1.2 visual language"
    - "Both edge pages use rounded-xl + border-gray-200 + bg-white + shadow-sm card lock"
  artifacts:
    - path: "app/[account]/[event-slug]/not-found.tsx"
      provides: "Not-found page with bg-gray-50 shell"
      contains: "bg-gray-50"
    - path: "app/_components/token-not-active.tsx"
      provides: "Token-not-active fallback with bg-gray-50 shell"
      contains: "bg-gray-50"
  key_links:
    - from: "app/_components/token-not-active.tsx"
      to: "(none — self-contained fallback, no PublicShell)"
      via: "outer wrapper renders bg-gray-50 directly"
      pattern: "min-h-screen bg-gray-50"
---

<objective>
Re-skin the two edge pages that lack account branding context: `/[account]/[event-slug]/not-found.tsx` (404 page, account not resolved) and `<TokenNotActive>` (cancel/reschedule when token is invalid/expired). Per RESEARCH.md Q6 and Pitfall 6, these cannot use `PublicShell` because no `Branding` is available — they must use a simpler `bg-gray-50` shell.

Purpose: Without these updates, a booker landing on a stale or invalid link gets a jarring inconsistent visual (white background, no NSI footer). With this update, even error states match the v1.2 visual language. Also matches PUB-10 / PUB-11 requirements explicitly.

Output: Two simplified shell wrappers that render `bg-gray-50` + centered card with v1.2 class lock.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/17-public-surfaces-and-embed/17-CONTEXT.md
@.planning/phases/17-public-surfaces-and-embed/17-RESEARCH.md

# Files this plan modifies
@app/[account]/[event-slug]/not-found.tsx
@app/_components/token-not-active.tsx
</context>

<preamble>
## v1.2 Visual Locks
1-6. (See REQUIREMENTS.md preamble)

## Phase 17 Guardrails
- **No PublicShell here** (RESEARCH.md Q6, Pitfall 6): both pages render BEFORE account context is resolved (404 = account-or-event missing; TokenNotActive = token invalid/expired). They must use a plain `bg-gray-50` wrapper, not PublicShell, because there is no `Branding` to feed.
- **No NSI Header pill or Footer here:** Per PUB-10/PUB-11 wording, "no PublicShell wrapper here (no branding available)". Keep these pages minimal and self-contained.
- **Existing TokenNotActive consumers:** `<TokenNotActive ownerEmail={null} />` is rendered directly from `app/cancel/[token]/page.tsx` and `app/reschedule/[token]/page.tsx`. Those callers are already migrated in Plan 17-05's task NOT to touch the not_active branch — that branch returns the TokenNotActive component which this task updates.

## Requirement coverage
- PUB-10: covered by Task 1 (not-found.tsx)
- PUB-11: covered by Task 2 (token-not-active.tsx)
</preamble>

<tasks>

<task type="auto">
  <name>Task 1: Re-skin /[account]/[event-slug]/not-found.tsx with bg-gray-50 + centered card</name>
  <files>app/[account]/[event-slug]/not-found.tsx</files>
  <action>
Open `app/[account]/[event-slug]/not-found.tsx`. Current implementation is a bare `<main>` with no background:

```typescript
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-muted-foreground">
        The booking page you&apos;re looking for doesn&apos;t exist or is no
        longer active.
      </p>
    </main>
  );
}
```

Replace with:

```typescript
export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-md px-6 py-24">
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The booking page you&apos;re looking for doesn&apos;t exist or is no
            longer active.
          </p>
        </div>
      </main>
    </div>
  );
}
```

**Changes:**
- Outer `<div className="min-h-screen bg-gray-50">` wrapper (PUB-10 spec).
- `<main>` becomes inner element instead of root — gets max-width container styling.
- Content placed inside `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm` card (v1.2 card lock).
- Max-width reduced from `max-w-xl` to `max-w-md` (PUB-10 spec — narrower error card looks more focused).
- Body text font size dropped from default to `text-sm` to match v1.2 secondary text pattern.
- No NSI Header pill, no PoweredByNsi footer — per PUB-10 explicit "no PublicShell wrapper here" requirement.

**DO NOT:**
- Add any imports (this remains a bare functional component).
- Add `BackgroundGlow` (no glow on error pages — they're meant to be minimal).
- Add any branding context (none is available at not-found time).
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "bg-gray-50" app/[account]/[event-slug]/not-found.tsx` — must match.
Run `grep -n "rounded-xl border border-gray-200" app/[account]/[event-slug]/not-found.tsx` — must match.
Run `grep -n "PublicShell" app/[account]/[event-slug]/not-found.tsx` — zero matches (intentionally absent).
  </verify>
  <done>Not-found page uses `min-h-screen bg-gray-50` outer + centered card with v1.2 lock. No imports added. Heading + body text preserved. TypeScript clean.</done>
</task>

<task type="auto">
  <name>Task 2: Re-skin TokenNotActive with bg-gray-50 + centered card</name>
  <files>app/_components/token-not-active.tsx</files>
  <action>
Open `app/_components/token-not-active.tsx`. Current implementation:

```typescript
import Link from "next/link";

export interface TokenNotActiveProps {
  ownerEmail: string | null;
  ownerName?: string | null;
}

export function TokenNotActive({ ownerEmail, ownerName }: TokenNotActiveProps) {
  return (
    <div className="mx-auto max-w-md p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">This link is no longer active</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The booking may have already been cancelled, rescheduled, or the
          appointment time has passed.
        </p>
        {ownerEmail ? (
          <p className="text-sm">
            Need help?{" "}
            <a href={`mailto:${ownerEmail}`} className="text-primary font-medium hover:underline">
              Contact {ownerName ?? ownerEmail}
            </a>
          </p>
        ) : null}
        <p className="text-sm mt-6">
          <Link href="/" className="text-muted-foreground hover:underline">Return home</Link>
        </p>
      </div>
    </div>
  );
}
```

Replace with:

```typescript
import Link from "next/link";

export interface TokenNotActiveProps {
  ownerEmail: string | null;
  ownerName?: string | null;
}

/** Friendly "no longer active" page for cancel + reschedule when token is invalid
 *  or expired. Renders WITHOUT PublicShell because no branding context is
 *  available at this point (account may not have been resolved). Phase 17 (PUB-11):
 *  bg-gray-50 outer + v1.2 card lock for visual continuity with the rest of the
 *  public surface family. */
export function TokenNotActive({ ownerEmail, ownerName }: TokenNotActiveProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-md px-6 py-24">
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold mb-2">This link is no longer active</h1>
          <p className="text-sm text-muted-foreground mb-6">
            The booking may have already been cancelled, rescheduled, or the
            appointment time has passed.
          </p>
          {ownerEmail ? (
            <p className="text-sm">
              Need help?{" "}
              <a href={`mailto:${ownerEmail}`} className="text-primary font-medium hover:underline">
                Contact {ownerName ?? ownerEmail}
              </a>
            </p>
          ) : null}
          <p className="text-sm mt-6">
            <Link href="/" className="text-muted-foreground hover:underline">Return home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
```

**Changes:**
- Outer wrapper: `<div className="mx-auto max-w-md p-6 sm:p-10">` → `<div className="min-h-screen bg-gray-50"><main className="mx-auto max-w-md px-6 py-24">` (PUB-11 spec: bg-gray-50 + centered card).
- Card class: `rounded-lg border bg-card p-6 sm:p-8 text-center` → `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm` (v1.2 lock).
- Inner content (h1, body p, ownerEmail mailto, Return home Link) preserved verbatim.
- `text-primary` link reference preserved — when called from cancel/reschedule's not_active branch, no `--primary` is set (no PublicShell), so this falls back to the global `:root --primary` (NSI blue per Phase 15 globals.css). Acceptable.

**Note on `text-primary`:** In the not_active code path, no PublicShell wraps this component, so `--primary` resolves to the global NSI blue (`oklch(0.606 0.195 264.5)`). The "Contact {ownerName}" link will be NSI blue, not customer brand color. This is correct per PUB-11 wording ("no `<PublicShell>` wrapper here (no branding available)") — when there's no branding, default to NSI.

**DO NOT:**
- Change the `TokenNotActiveProps` interface (callers depend on it).
- Add new imports beyond the existing `Link` import.
- Add NSI Header pill or PoweredByNsi (PUB-11 says simpler shell).
- Touch consumers — `app/cancel/[token]/page.tsx` and `app/reschedule/[token]/page.tsx` already render this in their not_active branches and will continue to work.
  </action>
  <verify>
Run `npx tsc --noEmit` — must pass.
Run `grep -n "min-h-screen bg-gray-50" app/_components/token-not-active.tsx` — must match.
Run `grep -n "rounded-xl border border-gray-200" app/_components/token-not-active.tsx` — must match.
Run `grep -n "PublicShell" app/_components/token-not-active.tsx` — zero matches (intentionally absent per PUB-11).
Run `grep -rn "TokenNotActive" app/cancel/ app/reschedule/` — confirm consumers unchanged (they import the same name with the same props).
  </verify>
  <done>TokenNotActive uses `min-h-screen bg-gray-50` outer + `<main>` + v1.2 card lock. Props interface unchanged. ownerEmail mailto preserved, Return home link preserved. TypeScript clean. Consumers (cancel + reschedule not_active branches) work without modification.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` — zero errors.
2. `grep -rn "bg-card" app/[account]/[event-slug]/not-found.tsx app/_components/token-not-active.tsx` — zero matches (replaced with bg-white).
3. `grep -rn "rounded-lg" app/_components/token-not-active.tsx` — zero matches (promoted to rounded-xl).
4. Consumers of TokenNotActive (cancel, reschedule) compile without changes.
</verification>

<success_criteria>
1. `app/[account]/[event-slug]/not-found.tsx` has outer `min-h-screen bg-gray-50` + centered card with v1.2 lock.
2. `app/_components/token-not-active.tsx` has outer `min-h-screen bg-gray-50` + `<main>` + centered card with v1.2 lock.
3. Neither page imports or uses `PublicShell` (per PUB-10/PUB-11 explicit guidance).
4. TokenNotActiveProps interface unchanged.
5. `npx tsc --noEmit` passes.
</success_criteria>

<output>
After completion, create `.planning/phases/17-public-surfaces-and-embed/17-06-edge-pages-migration-SUMMARY.md`. Note that PublicShell intentionally not used per PUB-10/PUB-11 requirement, and confirm consumers (cancel, reschedule) work without changes.
</output>
