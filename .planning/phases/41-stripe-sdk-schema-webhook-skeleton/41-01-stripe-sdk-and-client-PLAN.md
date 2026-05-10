---
phase: 41-stripe-sdk-schema-webhook-skeleton
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - lib/stripe/client.ts
  - vitest.config.ts
autonomous: true
user_setup:
  - service: stripe
    why: "Server-side Stripe API + webhook signature verification"
    env_vars:
      - name: STRIPE_SECRET_KEY
        source: "Stripe Dashboard -> Developers -> API keys (test mode for preview/dev, live mode for production)"
      - name: STRIPE_WEBHOOK_SECRET
        source: "Stripe Dashboard -> Developers -> Webhooks -> {endpoint} -> Signing secret (set per environment after PREREQ-F)"
    dashboard_config:
      - task: "PREREQ-A: Create Stripe account (if not already created)"
        location: "https://dashboard.stripe.com/register"
      - task: "PREREQ-D: Add STRIPE_SECRET_KEY (test) and STRIPE_WEBHOOK_SECRET (test) to Vercel Preview env"
        location: "Vercel project -> Settings -> Environment Variables"

must_haves:
  truths:
    - "stripe@22.1.1 is installed at the exact version (no caret prefix) in package.json"
    - "lib/stripe/client.ts exports a singleton Stripe client pinned to apiVersion '2026-04-22.dahlia'"
    - "lib/stripe/client.ts has 'server-only' import — bundle-time error if imported from client code"
    - "Vitest can resolve @/lib/stripe/* via resolve.alias (Knip CI gate compatibility)"
  artifacts:
    - path: "lib/stripe/client.ts"
      provides: "Singleton Stripe SDK client (server-only)"
      exports: ["stripe"]
      min_lines: 15
    - path: "package.json"
      provides: "stripe dependency at version 22.1.1 exact (no semver prefix)"
      contains: "\"stripe\": \"22.1.1\""
  key_links:
    - from: "lib/stripe/client.ts"
      to: "process.env.STRIPE_SECRET_KEY"
      via: "Stripe constructor first arg"
      pattern: "new Stripe\\(process\\.env\\.STRIPE_SECRET_KEY"
    - from: "lib/stripe/client.ts"
      to: "Stripe API version pinning"
      via: "apiVersion option in constructor"
      pattern: "apiVersion:\\s*[\"']2026-04-22\\.dahlia[\"']"
    - from: "vitest.config.ts"
      to: "lib/stripe alias"
      via: "resolve.alias entry"
      pattern: "lib/stripe"
---

<objective>
Install the Stripe Node SDK at exact version 22.1.1 (LD-01) and create the singleton server-side client at `lib/stripe/client.ts`. This is the smallest possible foundation — every subsequent Phase 41 plan (migration, webhook route) builds on top of this client without further dependency churn.

Purpose: Guarantee that Phase 41 webhook code (Plan 41-03) and all future v1.8 billing code (Phases 42–44) imports a single, version-pinned Stripe client — preventing the V18-CP-08 schema-drift pitfall where SDK upgrades silently break webhook payload types.

Output:
- `stripe@22.1.1` (exact pin, no `^`) added to `package.json` dependencies and lockfile.
- `lib/stripe/client.ts` exporting `stripe` — a singleton `new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })` with `import "server-only"` at top.
- `vitest.config.ts` updated with a `resolve.alias` entry for `@/lib/stripe/*` so the Knip CI gate (carried v1.7 tech debt) does not flag the new path.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-CONTEXT.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-RESEARCH.md

# Established singleton-with-server-only pattern (mirror this shape)
@lib/supabase/admin.ts

# Vitest alias precedent — copy the alias pattern for new lib/stripe path
@vitest.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install stripe@22.1.1 (exact pin) and update vitest alias</name>
  <files>package.json, package-lock.json, vitest.config.ts</files>
  <action>
1. Run `npm install stripe@22.1.1 --save-exact` from the project root. The `--save-exact` flag is REQUIRED — it writes `"stripe": "22.1.1"` (no caret) to `package.json`. A caret would allow `npm install` to silently bump to 22.x.y minor versions which can drift the bundled apiVersion typings (V18-CP-08).
2. After install completes, open `package.json` and verify the `dependencies.stripe` entry is exactly `"22.1.1"` (no `^`, no `~`). If a caret appears, manually edit to remove it and re-run `npm install`.
3. Read `vitest.config.ts`. Locate the existing `resolve.alias` block (carries `@/lib/...` entries from prior phases). Add a new alias entry that maps `@/lib/stripe` to the absolute path of `lib/stripe` in the repo root, mirroring the form of any existing `@/lib/email-sender` or `@/lib/supabase` entry. If the alias block uses a single `@` -> repo root mapping that already covers `lib/stripe`, no change is needed — but DOUBLE-CHECK by skimming the existing entries.
4. Do NOT install `@stripe/stripe-js` or `@stripe/react-stripe-js`. Do NOT install `micro` / `raw-body` / `body-parser`. The v1.8 milestone uses hosted Checkout (no client-side Stripe code) and the App Router exposes `req.text()` natively. Adding any of those packages violates LD-02 / RESEARCH §Standard Stack Do-Not-Install.
  </action>
  <verify>
- `node -e "console.log(require('./package.json').dependencies.stripe)"` outputs exactly `22.1.1` (no caret, no tilde).
- `npm ls stripe --depth=0` resolves cleanly to `stripe@22.1.1`.
- `cat node_modules/stripe/package.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).version))"` outputs `22.1.1`.
- `grep -E "@stripe/stripe-js|@stripe/react-stripe-js|^\\s*\"micro\"|raw-body|body-parser" package.json` returns NO matches.
- `cat vitest.config.ts | grep -E "lib/stripe|@/lib"` shows the alias path either explicitly covers `@/lib/stripe` or is covered by a generic `@` -> repo-root mapping (document which case in the SUMMARY).
  </verify>
  <done>
- `package.json` has `"stripe": "22.1.1"` exact (no semver prefix).
- `package-lock.json` updated and committed.
- No forbidden Stripe browser packages or raw-body shims installed.
- Vitest alias resolution path verified or extended for `lib/stripe`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create lib/stripe/client.ts singleton</name>
  <files>lib/stripe/client.ts</files>
  <action>
Create the file `lib/stripe/client.ts` with EXACTLY this shape (mirrors `lib/supabase/admin.ts` server-only conventions, but uses module-scope singleton because the Stripe SDK is a stateless HTTP wrapper with internal keep-alive — see RESEARCH §Standard Stack rationale):

```typescript
import "server-only";
import Stripe from "stripe";

/**
 * Server-side Stripe client.
 *
 * RULES:
 *   - Import ONLY from server code (Route Handlers, Server Actions, Server Components).
 *     The `import "server-only"` at top throws at bundle time on client import.
 *   - Singleton at module scope — the Stripe SDK maintains an internal HTTP agent
 *     with keep-alive. Re-instantiating per request would burn TCP handshakes.
 *     This is OPPOSITE to lib/supabase/admin.ts (no singleton due to Fluid compute
 *     Postgres connection pooling) because the Stripe SDK has no per-request
 *     session state — it's just a typed fetch wrapper.
 *   - apiVersion is pinned to '2026-04-22.dahlia' — the version that ships with
 *     SDK 22.x. NEVER omit apiVersion (V18-CP-08 — webhook schema breaks on
 *     Stripe's next API release if apiVersion is unpinned).
 *   - Test/live key switching is automatic via the STRIPE_SECRET_KEY env var,
 *     which is set per Vercel environment (sk_test_* in preview, sk_live_* in
 *     production). Never inspect the prefix in code — that would lock dev to
 *     test mode and confuse the live cutover (V18-CP-03).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});
```

Notes / what to AVOID:
- Do NOT add any module-level memoization wrapper around `new Stripe(...)` — the `export const stripe = ...` IS the singleton.
- Do NOT add a fallback like `process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy"`. The non-null assertion (`!`) is correct: missing env should fail loudly at first import (the Stripe constructor throws a clear error on undefined input).
- Do NOT export a factory function (`export function getStripe()`). Direct `import { stripe } from "@/lib/stripe/client"` is the API.
- Do NOT import `Stripe` types under a different name. The default-imported `Stripe` namespace also exposes types (e.g. `Stripe.Event`, `Stripe.Subscription`) used by Plan 41-03's webhook handler.
- Do NOT add `STRIPE_WEBHOOK_SECRET` here. That env var is consumed at the call site of `stripe.webhooks.constructEvent(...)` inside the webhook route — keeping the secrets next to where they're used makes the dependency graph obvious.
  </action>
  <verify>
- File `lib/stripe/client.ts` exists and contains the literal string `apiVersion: "2026-04-22.dahlia"` (verify with `grep -F "apiVersion: \"2026-04-22.dahlia\"" lib/stripe/client.ts`).
- File contains `import "server-only";` as its first non-comment line.
- File exports a const named `stripe` (not a function): `grep -E "^export const stripe = new Stripe" lib/stripe/client.ts` returns one match.
- TypeScript compiles cleanly: `npx tsc --noEmit` exits 0 (or, if the project uses an existing typecheck script, run that — e.g., `npm run typecheck` if defined in package.json scripts).
- `npx next build` does NOT throw a `server-only` violation against this file (i.e., no client-side import accidentally pulled it in — there shouldn't be any yet, but the build is the canonical check).
  </verify>
  <done>
- `lib/stripe/client.ts` exists with the singleton pattern, server-only import, apiVersion pinned to `2026-04-22.dahlia`.
- TypeScript compiles without errors.
- `npx next build` completes without bundling-side violations.
  </done>
</task>

</tasks>

<verification>

Phase-level checks for this plan:

1. `npm ls stripe --depth=0` returns exactly `stripe@22.1.1` (no version range resolution).
2. `grep -E "\"stripe\":\\s*\"22\\.1\\.1\"" package.json` returns one match (exact pin, no caret).
3. `lib/stripe/client.ts` exists, exports `stripe`, pins `apiVersion: "2026-04-22.dahlia"`, and has `import "server-only"` as the first import.
4. `npx tsc --noEmit` (or the project's typecheck script) exits 0.
5. `npx next build` succeeds.
6. No client-side or browser-targeted Stripe packages added (`@stripe/stripe-js`, `@stripe/react-stripe-js`, `micro`, `raw-body` all absent from `package.json`).

</verification>

<success_criteria>

This plan is complete when:

- [ ] `stripe@22.1.1` installed at exact version (no `^` or `~`) and committed to `package.json` + `package-lock.json`.
- [ ] `lib/stripe/client.ts` exists, exports the `stripe` singleton, pins `apiVersion: "2026-04-22.dahlia"`, has `import "server-only"` first.
- [ ] Vitest alias path resolves `@/lib/stripe/*` (either via existing generic `@` mapping or new explicit entry).
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx next build` succeeds.
- [ ] No forbidden packages added (browser Stripe, raw-body shims).
- [ ] All changes committed in a single commit: `feat(41-01): install stripe SDK and add server-side client singleton`.

</success_criteria>

<output>
After completion, create `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-01-SUMMARY.md` documenting:

1. Final exact stripe version pinned in `package.json`.
2. Exact path of the client file (`lib/stripe/client.ts`) and the apiVersion string used.
3. Whether vitest.config.ts needed an explicit alias entry, OR whether the generic `@` alias already covered it (cite the existing alias line).
4. Confirmation that no forbidden packages were added.
5. Note for downstream plans: `import { stripe } from "@/lib/stripe/client"` is the canonical import for Plans 41-03 (webhook), 42-* (checkout), 44-* (portal).
6. Frontmatter must include:
   - `subsystem: billing`
   - `affects: [41-03, 42-01, 42-02, 44-01]`
   - `tech-stack.added: ["stripe@22.1.1"]`
   - `key-files: ["lib/stripe/client.ts"]`
</output>
