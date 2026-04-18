---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - tsconfig.json
  - next.config.ts
  - postcss.config.mjs
  - app/layout.tsx
  - app/page.tsx
  - app/globals.css
  - proxy.ts
  - lib/supabase/client.ts
  - lib/supabase/server.ts
  - lib/supabase/proxy.ts
  - lib/supabase/admin.ts
  - .env.example
  - .env.local
  - .gitignore
  - README.md
autonomous: false
user_setup:
  - service: github
    why: "Public repo for source control + Vercel auto-deploy trigger"
    dashboard_config:
      - task: "Create public GitHub repo named calendar-app under Andrew's account"
        location: "https://github.com/new (or Claude runs `gh repo create andrewjwegner/calendar-app --public --source=. --push`)"
  - service: supabase
    why: "Database, auth, storage for the booking tool"
    env_vars:
      - name: NEXT_PUBLIC_SUPABASE_URL
        source: "Supabase Dashboard -> calendar project -> Settings -> API -> Project URL"
      - name: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        source: "Supabase Dashboard -> calendar project -> Settings -> API -> Project API keys (use sb_publishable_* format if shown, else legacy anon JWT)"
      - name: SUPABASE_SERVICE_ROLE_KEY
        source: "Supabase Dashboard -> calendar project -> Settings -> API -> service_role (or Secret keys -> sb_secret_*). NEVER prefix with NEXT_PUBLIC_."
  - service: vercel
    why: "Production hosting with main-branch auto-deploy"
    dashboard_config:
      - task: "Import calendar-app repo into Vercel, paste env vars, click Deploy"
        location: "https://vercel.com/new -> Import Git Repository -> select calendar-app -> paste NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY into Environment Variables (Production + Preview) BEFORE clicking Deploy"

must_haves:
  truths:
    - "Visiting the deployed Vercel URL returns HTTP 200 with a minimal Next.js page"
    - "The local dev server runs via `npm run dev` and serves a page on http://localhost:3000"
    - "The service-role Supabase module cannot be imported from client code (server-only guard active)"
    - "Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY are wired in .env.local (local) and Vercel (production/preview)"
    - "proxy.ts runs on every non-static request and calls supabase.auth.getClaims() without errors"
  artifacts:
    - path: "package.json"
      provides: "Next 16.2.4, React 19.2.5, @supabase/ssr 0.10.2+, tailwindcss ^4.2.0, server-only pinned"
      contains: '"next": "16'
    - path: "proxy.ts"
      provides: "Root proxy wiring (replaces middleware.ts in Next 16)"
      contains: "export async function proxy"
    - path: "lib/supabase/client.ts"
      provides: "Browser Supabase client using createBrowserClient + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
      contains: "createBrowserClient"
    - path: "lib/supabase/server.ts"
      provides: "Async server Supabase client using await cookies() + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
      contains: "await cookies()"
    - path: "lib/supabase/proxy.ts"
      provides: "updateSession using supabase.auth.getClaims() (NOT getUser())"
      contains: "supabase.auth.getClaims()"
    - path: "lib/supabase/admin.ts"
      provides: "Service-role client gated by server-only"
      contains: 'import "server-only"'
    - path: ".env.example"
      provides: "Env var template using publishable-key name"
      contains: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    - path: "app/page.tsx"
      provides: "Minimal scaffold landing page"
      min_lines: 3
  key_links:
    - from: "proxy.ts"
      to: "lib/supabase/proxy.ts"
      via: "updateSession import"
      pattern: "updateSession"
    - from: "lib/supabase/admin.ts"
      to: "bundler"
      via: 'import "server-only" on line 1'
      pattern: 'import "server-only"'
    - from: "Vercel deploy"
      to: "GitHub main branch"
      via: "main-only auto-deploy wiring"
      pattern: "main"
---

<objective>
Scaffold a Next.js 16 App Router project using the canonical `with-supabase` example, commit it to a new public GitHub repo `calendar-app`, wire it to Vercel with environment variables, and land a first production deploy BEFORE any database schema exists.

Purpose: Two-step "scaffold-then-schema" ordering (locked in CONTEXT.md) proves the Vercel ↔ GitHub pipeline works in isolation. Catching deploy/env issues now means every later plan starts from a known-good production URL.

Output: A live Vercel URL serving a minimal Next.js page, a public GitHub repo `calendar-app` on main-only branching, `.env.local` wired for local dev, and four `lib/supabase/*.ts` modules ready for downstream plans.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold Next 16 + Tailwind v4 + @supabase/ssr from with-supabase template</name>
  <files>package.json, tsconfig.json, next.config.ts, postcss.config.mjs, app/layout.tsx, app/page.tsx, app/globals.css, proxy.ts, lib/supabase/client.ts, lib/supabase/server.ts, lib/supabase/proxy.ts, lib/supabase/admin.ts, .env.example, .env.local, .gitignore, README.md</files>
  <action>
From the parent directory of this repo (the repo currently lives at `C:\Users\andre\OneDrive - Creighton University\Desktop\Claude-Code-Projects\tools-made-by-claude-for-claude\calendar-app`), the `.planning/` dir already exists in place. Scaffold INTO this existing dir — do not create a nested `calendar-app/calendar-app`.

Steps (run from the project root):

1. **Preflight check.** Confirm Node.js >= 20.9 with `node --version`. If Node < 20.9, STOP and tell Andrew to upgrade — Next 16 rejects older versions.

2. **Scaffold via canonical template.** Run `npx create-next-app@latest calendar-app-scaffold -e with-supabase --use-npm` in a temp parent location (e.g., `..\tmp-scaffold\`), then move its contents (except `.git/`) on top of the current project root. This avoids the `directory not empty` error `create-next-app` throws when run in a non-empty dir. Alternative: create the files by hand using the verbatim code blocks from `.planning/phases/01-foundation/01-RESEARCH.md` Section 2 — this is fine and may be cleaner given `.planning/` already exists.

3. **Pin exact versions in `package.json`** (per RESEARCH.md Section 1):
   - `"next": "16.2.4"`
   - `"react": "19.2.5"`, `"react-dom": "19.2.5"`
   - `"@supabase/ssr": "^0.10.2"`, `"@supabase/supabase-js": "^2.103.1"`
   - `"tailwindcss": "^4.2.0"` (NOT `^4` — avoids the v4.1.18 Turbopack bug)
   - `"@tailwindcss/postcss": "^4.2.0"`
   - `"server-only": "0.0.1"`
   - `"typescript": "^6.0.3"` (dev)
   - `"@types/node": "^20"`, `"@types/react": "^19"`, `"@types/react-dom": "^19"`
   - Do NOT add `--turbopack` flag to `dev`/`build` scripts — Turbopack is default in Next 16.
   - Add `"engines": { "node": "20.x" }`.

4. **Create `lib/supabase/client.ts`** verbatim from RESEARCH.md Section 2 "Browser / Client Component" code block. Uses `createBrowserClient` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

5. **Create `lib/supabase/server.ts`** verbatim from RESEARCH.md Section 2 "Server Components" code block. MUST use `await cookies()` (Next 16 async) and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `setAll` MUST be wrapped in try/catch — the catch is intentional and load-bearing.

6. **Create `lib/supabase/proxy.ts`** verbatim from RESEARCH.md Section 2 "Session refresh" code block. MUST use `supabase.auth.getClaims()` (NOT `getUser()`). The comment "Do not run code between createServerClient and supabase.auth.getClaims()" MUST stay in the file — this rule is load-bearing. Leave the `if (!user && ...)` auth redirect block COMMENTED OUT — Phase 2 wires auth, not this phase.

7. **Create `proxy.ts`** (root) verbatim from RESEARCH.md Section 2 "root of project" code block. File must be named `proxy.ts` (NOT `middleware.ts`). Exported function must be named `proxy` (NOT `middleware`). Matcher excludes `_next/static`, `_next/image`, favicon, and common image formats.

8. **Create `lib/supabase/admin.ts`** verbatim from RESEARCH.md Section 7 code block. `import "server-only";` MUST be LINE 1 (first import). Exports `createAdminClient()` that reads `SUPABASE_SERVICE_ROLE_KEY` and throws a clear error if env var missing. Do NOT memoize into a module-level singleton.

9. **Create `.env.example`** (committed) with exactly these three lines:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

10. **Create `.env.local`** (gitignored). Leave values blank for now — the checkpoint task below walks Andrew through pasting them in. Confirm `.env*.local` is in `.gitignore` (Next scaffold default).

11. **Replace `app/page.tsx`** with a minimal scaffold — a single `<main>` with `<h1>calendar-app</h1>` and a `<p>` noting "Phase 1 scaffold — booking flow coming soon." This signals liveness without looking like the default template. Strip out any `with-supabase` template landing-page content that references features not yet built.

12. **Keep `app/globals.css`** from the template. It contains `@import "tailwindcss";` (Tailwind v4 single-line syntax). Do NOT add a `tailwind.config.ts` unless the template ships one — v4 uses CSS-first config.

13. **Create minimal `README.md`** at repo root with:
    - Project name + one-line description
    - Placeholder "Getting started" section (full content lands in Plan 03)
    - Tech-stack one-liner (Next 16 + Supabase + Tailwind v4)

14. **Install dependencies**: `npm install`. Resolve any peer warnings; all listed versions have been verified compatible on 2026-04-18.

15. **Local smoke test**: run `npm run dev` in a background shell, then `curl -sSf http://localhost:3000` and confirm HTTP 200 + the page contains `calendar-app`. Kill the dev server.

DO NOT do in this task:
- Install vitest, jsdom, testing-library — those are Plan 03.
- Install `supabase` CLI — that is Plan 02.
- Create `supabase/` directory or any migrations — that is Plan 02.
- Write any SQL — that is Plan 02.
- Write any tests — that is Plan 03.
- Wire any auth-gated routes — that is Phase 2.
  </action>
  <verify>
1. `cat package.json | grep '"next"'` shows `"next": "16.2.4"` (or `"next": "^16.2.4"` — either acceptable).
2. `cat package.json | grep '"tailwindcss"'` shows `"^4.2` (NOT plain `"^4"`).
3. `ls proxy.ts` succeeds AND `ls middleware.ts` fails (file is `proxy.ts`, not `middleware.ts`).
4. `head -1 lib/supabase/admin.ts` outputs exactly `import "server-only";`.
5. `grep -l "getClaims" lib/supabase/proxy.ts` finds the file (uses getClaims, not getUser).
6. `grep "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" .env.example` finds the line (not `_ANON_KEY`).
7. `npm run dev` on localhost:3000 returns HTTP 200 and page contains `calendar-app`.
8. `npm run build` succeeds with no errors (Turbopack default, no `--turbopack` flag).
  </verify>
  <done>
Project scaffolded with Next 16.2.4 + React 19.2.5 + @supabase/ssr 0.10.2 + Tailwind ^4.2.0 + server-only. Four `lib/supabase/*.ts` modules present and matching RESEARCH.md Section 2/7 verbatim. `proxy.ts` at root (not middleware.ts). `.env.example` uses publishable-key name. `.env.local` exists (gitignored). `npm run dev` and `npm run build` both succeed locally. Ready for first commit + GitHub + Vercel.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew creates GitHub repo, wires Vercel, provides env var values</name>
  <what-built>
Scaffolded Next 16 project ready to be committed, pushed to a public GitHub repo named `calendar-app`, and wired to Vercel with env vars for the first production deploy. Three external services require Andrew's dashboard clicks (GitHub repo creation, Supabase key retrieval, Vercel project import + env var paste).
  </what-built>
  <how-to-verify>
Andrew must complete the following numbered steps outside the terminal, then paste env var values into `.env.local` so Claude can continue:

**Part A — GitHub (pick ONE option):**

Option A1 (Claude runs it): In a separate terminal, Claude runs `gh repo create calendar-app --public --source=. --remote=origin` (assumes `gh` CLI is authed). Skip to Part B.

Option A2 (Andrew runs it manually):
1. Go to https://github.com/new
2. Repository name: `calendar-app`
3. Visibility: Public
4. Do NOT initialize with README, .gitignore, or license (we already have them locally)
5. Click "Create repository"
6. Copy the SSH or HTTPS remote URL shown
7. Tell Claude the remote URL so it can run `git remote add origin <URL>` and `git push -u origin main`

**Part B — Supabase env vars:**
1. Go to https://app.supabase.com -> `calendar` project -> Settings -> API
2. Copy "Project URL" -> paste into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL=<value>`
3. Copy "Project API keys" -> "publishable" (the `sb_publishable_*` key if shown, else the legacy anon JWT) -> paste as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<value>`
4. Copy "service_role" (or "Secret keys" -> `sb_secret_*`) -> paste as `SUPABASE_SERVICE_ROLE_KEY=<value>`
5. Save `.env.local`. Confirm `.env.local` is listed in `.gitignore`.

**Part C — Vercel project + env vars:**
1. Go to https://vercel.com/new
2. Import Git Repository -> select `calendar-app`
3. Framework preset: Next.js (auto-detected — leave it)
4. Root directory: `./` (leave default)
5. BEFORE clicking Deploy, expand "Environment Variables" and paste:
   - `NEXT_PUBLIC_SUPABASE_URL` = (same value as .env.local)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = (same value)
   - `SUPABASE_SERVICE_ROLE_KEY` = (same value) -- mark Production + Preview only (NOT Development)
6. Click Deploy
7. Wait for the deploy to succeed -> copy the production URL (e.g. `https://calendar-app-<hash>.vercel.app`)
8. Tell Claude the production URL so it can verify with `curl`.

**Resume with:** Paste the Vercel production URL AND confirm `.env.local` has all three values filled in.
  </how-to-verify>
  <resume-signal>Type the Vercel URL (e.g. `https://calendar-app.vercel.app`) and "env ready" once `.env.local` is populated.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Push to GitHub, verify first production deploy, commit scaffold</name>
  <files>README.md</files>
  <action>
After Andrew completes the checkpoint:

1. **Git init + first commit** (if not already done):
   ```bash
   git add -A
   git status   # confirm no .env.local, no node_modules
   git commit -m "feat(01): scaffold Next 16 + Supabase + Tailwind v4 foundation"
   ```

2. **Push to GitHub** (whichever remote strategy Andrew picked):
   ```bash
   git branch -M main
   git remote add origin <URL>   # skip if already set by gh repo create
   git push -u origin main
   ```

3. **Verify GitHub has the push**: `gh repo view --web` or just confirm the remote URL with `git remote -v`.

4. **Verify Vercel deploy landed**:
   - `curl -sSf <VERCEL_URL>` returns HTTP 200
   - Response body contains the string `calendar-app`
   - `curl -sI <VERCEL_URL>` headers show `server: Vercel` (or similar Vercel signature)

5. **Verify local dev still works against real env**:
   - `npm run dev` in background
   - `curl -sSf http://localhost:3000` returns 200
   - Kill the dev server.

6. **Update README.md** to include a brief "Live at" line pointing at the Vercel URL. Commit + push.
   ```bash
   git add README.md
   git commit -m "docs(01): add live Vercel URL to README"
   git push
   ```

7. **Confirm auto-deploy works**: The README push should trigger a second Vercel deploy. Wait ~60s then re-curl the URL to verify it still returns 200 (auto-deploy didn't break).

DO NOT do in this task:
- Install or configure Supabase CLI (Plan 02)
- Create or push migrations (Plan 02)
- Run `supabase link` (Plan 02)
  </action>
  <verify>
1. `git log --oneline` shows at least one commit on `main`.
2. `git remote -v` shows `origin` pointing at `https://github.com/<user>/calendar-app.git` (or SSH equiv).
3. `curl -sSf -o /dev/null -w "%{http_code}\n" <VERCEL_URL>` outputs `200`.
4. `curl -sSf <VERCEL_URL> | grep calendar-app` matches.
5. Second README commit pushed; Vercel auto-deploy webhook fired (check Vercel dashboard Deployments tab or re-curl after ~60s).
  </verify>
  <done>
GitHub repo `calendar-app` exists, is public, and has the scaffold committed on `main`. Vercel production URL serves the scaffold page and auto-deploys on push to `main`. `.env.local` is populated locally (gitignored) with all three Supabase keys. Foundation is live before schema ever touches the DB — the "scaffold deploys before schema" invariant locked in CONTEXT.md is satisfied.
  </done>
</task>

</tasks>

<verification>
Run against the current working directory after the plan executes:

1. `head -1 lib/supabase/admin.ts` → `import "server-only";`
2. `test -f proxy.ts && ! test -f middleware.ts` (proxy.ts exists, middleware.ts does not)
3. `grep -q "getClaims" lib/supabase/proxy.ts && grep -qv "getUser" lib/supabase/proxy.ts` (uses getClaims, not getUser; `-qv` for absence of getUser is best-effort — manual inspect if shell lacks it)
4. `grep -q "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" .env.example`
5. `grep -q '"next": "16' package.json`
6. `grep -q '"tailwindcss": "\^4\.2' package.json`
7. `curl -sSf -o /dev/null -w "%{http_code}" <VERCEL_URL>` == `200`
8. `git remote -v` shows origin and repo is public on GitHub.
9. `.env.local` exists locally with three non-empty values AND is listed in `.gitignore`.
</verification>

<success_criteria>
- Next 16.2.4 scaffold lives in the project root using `with-supabase` example conventions.
- Four `lib/supabase/*.ts` modules exist matching RESEARCH.md Section 2 + 7 verbatim.
- `proxy.ts` (not middleware.ts) with `proxy` export wires session refresh via `getClaims()`.
- `.env.example` committed with publishable-key name; `.env.local` populated locally (gitignored).
- `calendar-app` public GitHub repo exists on main-only branching.
- Vercel production deploy returns HTTP 200 for the scaffold page.
- Vercel auto-deploy triggers on push to `main` (verified via README commit).
- No Supabase schema, no migrations, no tests, no auth-gated routes — all deferred to Plans 02/03.
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-PLAN-01-SUMMARY.md` capturing:
- The Vercel production URL
- The GitHub repo URL
- Exact versions landed (from `package.json`)
- Any deviations from RESEARCH.md (should be zero; note if any)
- A one-paragraph "ready for Plan 02" status confirming env vars and scaffold are live
</output>
