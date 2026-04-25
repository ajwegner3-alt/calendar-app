---
phase: 05-public-booking-flow
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/email-sender/index.ts
  - lib/email-sender/types.ts
  - lib/email-sender/providers/resend.ts
  - package.json
  - .env.example
autonomous: false
user_setup:
  - service: cloudflare-turnstile
    why: "Bot protection on the booking form"
    env_vars:
      - name: TURNSTILE_SECRET_KEY
        source: "Cloudflare Dashboard -> Turnstile -> Sites -> [your site] -> Secret key"
      - name: NEXT_PUBLIC_TURNSTILE_SITE_KEY
        source: "Cloudflare Dashboard -> Turnstile -> Sites -> [your site] -> Site key"
    dashboard_config:
      - task: "Create a new Turnstile site"
        location: "Cloudflare Dashboard -> Turnstile -> Add site -> domain: calendar-app-xi-smoky.vercel.app + localhost; Widget mode: Invisible"
  - service: resend
    why: "Outbound transactional email (booker confirmation + owner notification)"
    env_vars:
      - name: RESEND_API_KEY
        source: "Resend Dashboard -> API Keys"
      - name: RESEND_FROM_EMAIL
        source: 'Use a verified-domain "from" address (initial: onboarding@resend.dev for dev; later switch to noreply@nsi.tools or similar)'
    dashboard_config:
      - task: "Verify a sender domain (Phase 8 hardening; for Phase 5 use the resend.dev sandbox sender)"
        location: "Resend Dashboard -> Domains"

must_haves:
  truths:
    - "lib/email-sender/index.ts exports sendEmail(input) — vendored copy of @nsi/email-sender from sibling ../email-sender/src/index.ts"
    - "lib/email-sender/types.ts exports EmailInput + EmailAttachment + EmailResult types — copied verbatim from sibling ../email-sender/src/types.ts"
    - "lib/email-sender/providers/resend.ts exports the Resend provider — copied from sibling ../email-sender/src/providers/resend.ts"
    - "Path aliases work: import { sendEmail } from '@/lib/email-sender' resolves to lib/email-sender/index.ts"
    - "Three new npm packages installed: ical-generator, timezones-ical-library, @marsidev/react-turnstile"
    - "resend npm package installed (peer dep of vendored provider) — check sibling package.json + copy"
    - ".env.example documents 4 new env vars: TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL (Andrew adds real values to .env.local + Vercel)"
    - "User checkpoint confirms env vars set both in .env.local AND in Vercel Production env BEFORE Wave 3 ships (Phase 5 booking POST is downstream consumer)"
    - "npm run build + npm run lint exit 0 with vendored modules in place (no broken imports)"
  artifacts:
    - path: "lib/email-sender/index.ts"
      provides: "sendEmail(input) entry point — picks provider from EMAIL_PROVIDER env (default resend)"
      contains: "sendEmail"
      exports: ["sendEmail"]
      min_lines: 20
    - path: "lib/email-sender/types.ts"
      provides: "EmailInput + EmailAttachment + EmailResult shared types"
      contains: "EmailAttachment"
      exports: ["EmailInput", "EmailAttachment", "EmailResult"]
      min_lines: 20
    - path: "lib/email-sender/providers/resend.ts"
      provides: "Resend provider implementation"
      contains: "Resend"
      min_lines: 20
    - path: ".env.example"
      provides: "Documents new env var keys (no values)"
      contains: "TURNSTILE_SECRET_KEY"
      min_lines: 5
  key_links:
    - from: "lib/email-sender/index.ts"
      to: "lib/email-sender/providers/resend.ts"
      via: "dynamic dispatch on EMAIL_PROVIDER env"
      pattern: "providers/resend"
    - from: "Phase 5 email sender modules (downstream)"
      to: "lib/email-sender"
      via: "import { sendEmail } from '@/lib/email-sender'"
      pattern: "@/lib/email-sender"
---

<objective>
Vendor the `@nsi/email-sender` module from the sibling `../email-sender/` directory into `lib/email-sender/` as a local module, install three new npm dependencies (`ical-generator`, `timezones-ical-library`, `@marsidev/react-turnstile`) plus the Resend SDK peer dependency, and document the four new environment variables in `.env.example`.

Purpose: CONTEXT decision #11 (LOCKED) — install method is "VENDOR (copy types.ts + providers/resend.ts + index.ts) NOT npm install". Vercel cannot resolve sibling-relative `file:../email-sender` paths during build. Vendoring is the simplest approach that keeps Phase 5 unblocked; the tradeoff is that future updates to `@nsi/email-sender` require manual re-copy.

Output: `lib/email-sender/{index,types,providers/resend}.ts` mirroring the sibling source 1:1, three npm deps added to package.json + lockfile, `.env.example` updated, and a checkpoint that pauses for Andrew to set Turnstile + Resend env vars in `.env.local` and Vercel Production env.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-public-booking-flow/05-CONTEXT.md
@.planning/phases/05-public-booking-flow/05-RESEARCH.md
@package.json
@tsconfig.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Vendor @nsi/email-sender + install npm deps</name>
  <files>lib/email-sender/index.ts, lib/email-sender/types.ts, lib/email-sender/providers/resend.ts, package.json, .env.example</files>
  <action>
**Step 1 — Locate sibling source.** The sibling project is at:

```
C:/Users/andre/OneDrive - Creighton University/Desktop/Claude-Code-Projects/tools-made-by-claude-for-claude/email-sender/src/
```

Files known to exist there (verified 2026-04-25): `index.ts`, `types.ts`, `utils.ts`, `providers/resend.ts`, `providers/gmail.ts`, `templates/`.

**Step 2 — Copy minimal set.** Copy the 3 files needed for the Resend pathway:

```bash
mkdir -p lib/email-sender/providers
cp "../email-sender/src/types.ts"             lib/email-sender/types.ts
cp "../email-sender/src/index.ts"             lib/email-sender/index.ts
cp "../email-sender/src/providers/resend.ts"  lib/email-sender/providers/resend.ts
```

If the sibling `index.ts` imports `./utils` or `./templates`, also copy those (smallest viable subset). Do NOT copy `providers/gmail.ts` — out of scope for Phase 5. If `index.ts` imports `./providers/gmail`, comment out / remove that import in our vendored copy and document in SUMMARY.

**Step 3 — Adjust import paths if needed.** The sibling project may use bare imports like `./types`, `./providers/resend` — those paths still resolve under `lib/email-sender/`. Verify by running `npm run build` after copying. If the sibling uses `@nsi/email-sender/` self-references, replace with relative paths.

**Step 4 — Add `import "server-only"` to `lib/email-sender/index.ts` line 1.** This module touches `RESEND_API_KEY` (server secret); do NOT let it leak into client bundles. Mirrors the `lib/supabase/admin.ts` pattern locked in STATE.md.

```typescript
// lib/email-sender/index.ts (line 1)
import "server-only";

// ...rest of vendored content
```

**Step 5 — Install npm dependencies.**

```bash
# Runtime deps (Phase 5)
npm install ical-generator timezones-ical-library @marsidev/react-turnstile

# Resend SDK — peer dependency of the vendored provider.
# Check what version the sibling project uses first:
grep -E '"resend"' "../email-sender/package.json"
# Match that version (or latest stable) when installing:
npm install resend
```

If `lib/email-sender/providers/resend.ts` references `process.env.RESEND_API_KEY` and `process.env.RESEND_FROM_EMAIL`, no additional deps needed. If it imports a logger or other utility, install or vendor that too.

**Step 6 — Update `.env.example`.** Append to the file (create if missing):

```
# Cloudflare Turnstile (booking form bot protection)
# Test keys for local dev:
#   Site key (always passes):    1x00000000000000000000AA
#   Secret key (always passes):  1x0000000000000000000000000000000AA
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=

# Resend transactional email
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Step 7 — Smoke build.**

```bash
npm run build
npm run lint
```

If the build fails because the vendored `index.ts` imports `./providers/gmail`, surgically remove the gmail import + dispatch branch (Phase 5 only ships Resend). Document the deletion in the SUMMARY.

DO NOT:
- Do NOT run `npm install ../email-sender`. CONTEXT decision #11 explicitly chose VENDOR over npm install. Vercel build fails on sibling-relative paths.
- Do NOT publish `@nsi/email-sender` to npm in this plan — out of scope for Phase 5; revisit in v2.
- Do NOT install `nodemailer` or `@sendgrid/mail` — Resend is the chosen provider for Phase 5.
- Do NOT pin Turnstile or ical-generator to specific patch versions in package.json without `^` (semver minor); RESEARCH §"Standard Stack" lists current versions but minor updates are safe.
- Do NOT commit `.env.local` (gitignored). Only `.env.example` is committed.
- Do NOT add Vercel env vars via CLI in this task — that's Andrew's manual step (next task).
  </action>
  <verify>
```bash
# Vendored files in place
ls "lib/email-sender/index.ts" "lib/email-sender/types.ts" "lib/email-sender/providers/resend.ts"

# server-only gate on entry point
head -2 "lib/email-sender/index.ts" | grep -q 'import "server-only"' && echo "server-only ok"

# sendEmail export
grep -q "sendEmail" "lib/email-sender/index.ts" && echo "sendEmail exported"

# EmailAttachment type exported
grep -q "EmailAttachment" "lib/email-sender/types.ts" && echo "attachment type ok"

# npm deps installed
node -e "console.log(require('./package.json').dependencies['ical-generator'])" | grep -q "^^?[0-9]" && echo "ical-generator installed"
node -e "console.log(require('./package.json').dependencies['timezones-ical-library'])" | grep -q "^^?[0-9]" && echo "timezones-ical-library installed"
node -e "console.log(require('./package.json').dependencies['@marsidev/react-turnstile'])" | grep -q "^^?[0-9]" && echo "react-turnstile installed"
node -e "console.log(require('./package.json').dependencies['resend'])" | grep -q "^^?[0-9]" && echo "resend SDK installed"

# .env.example documents the four new vars
grep -q "TURNSTILE_SECRET_KEY" .env.example && echo "turnstile secret documented"
grep -q "NEXT_PUBLIC_TURNSTILE_SITE_KEY" .env.example && echo "turnstile site documented"
grep -q "RESEND_API_KEY" .env.example && echo "resend key documented"
grep -q "RESEND_FROM_EMAIL" .env.example && echo "resend from documented"

# Build + lint clean
npm run build
npm run lint
```
  </verify>
  <done>
`lib/email-sender/{index,types,providers/resend}.ts` exist and mirror the sibling source. `import "server-only"` is line 1 of `index.ts`. `package.json` dependencies include `ical-generator`, `timezones-ical-library`, `@marsidev/react-turnstile`, and `resend`. `.env.example` documents all four new env vars. `npm run build` + `npm run lint` exit 0.

Commit: `feat(05-02): vendor @nsi/email-sender + install ical/turnstile/resend deps`. Push.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Andrew sets Turnstile + Resend env vars (local + Vercel)</name>
  <what-built>Vendored email-sender module + npm deps installed. Now Andrew must populate four env vars before any downstream Phase 5 plan can ship.</what-built>
  <how-to-verify>
**Local (`.env.local`):**

1. Open https://dash.cloudflare.com/?to=/:account/turnstile and create a new site:
   - Domain: `calendar-app-xi-smoky.vercel.app` AND `localhost` (add both)
   - Widget mode: **Invisible**
   - Pre-clearance: off (default)
2. Copy the **Site key** (looks like `0x4AAAAAAAxxxxxxxxxxxxxx`) into `.env.local` as `NEXT_PUBLIC_TURNSTILE_SITE_KEY=...`
3. Copy the **Secret key** (looks like `0x4AAAAAAAyyyyyyyyyyyyyy`) into `.env.local` as `TURNSTILE_SECRET_KEY=...`
4. Open https://resend.com/api-keys and create a new key (read+send permissions). Copy into `.env.local` as `RESEND_API_KEY=re_...`
5. Set `RESEND_FROM_EMAIL=onboarding@resend.dev` for now. Phase 8 swaps this to a verified domain sender.

**Vercel Production env:**

1. Open https://vercel.com/<your-team>/calendar-app/settings/environment-variables
2. Add all four variables to the **Production** environment (and **Preview** for safety):
   - `TURNSTILE_SECRET_KEY`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
3. Trigger a redeploy (push any commit, or click "Redeploy" on the latest deployment) so the values are baked into the build.

**Quick sanity test (local only — Vercel will be re-tested in Phase 5 verification):**

```bash
# Confirm .env.local has all four keys
grep -E '^(TURNSTILE_SECRET_KEY|NEXT_PUBLIC_TURNSTILE_SITE_KEY|RESEND_API_KEY|RESEND_FROM_EMAIL)=' .env.local | wc -l
# Expected: 4

# Confirm none are empty
node -e "require('dotenv').config({path:'.env.local'});['TURNSTILE_SECRET_KEY','NEXT_PUBLIC_TURNSTILE_SITE_KEY','RESEND_API_KEY','RESEND_FROM_EMAIL'].forEach(k=>{if(!process.env[k])throw new Error(k+' missing');});console.log('all four set');"
```

If any value contains `#`, double-quote it (STATE.md "dotenv quoting trap" — Plan 02-04/03-01 hit this).
  </how-to-verify>
  <resume-signal>Type "env vars set" when both `.env.local` and Vercel Production have all four values.</resume-signal>
</task>

</tasks>

<verification>
```bash
# Vendored module + deps
ls "lib/email-sender/index.ts" "lib/email-sender/providers/resend.ts"
npm run build && npm run lint

# Env keys documented (committed) and populated locally (NOT committed)
grep -q "TURNSTILE_SECRET_KEY" .env.example
grep -q "RESEND_API_KEY" .env.example
node -e "require('dotenv').config({path:'.env.local'});['TURNSTILE_SECRET_KEY','NEXT_PUBLIC_TURNSTILE_SITE_KEY','RESEND_API_KEY','RESEND_FROM_EMAIL'].forEach(k=>{if(!process.env[k])throw new Error(k+' missing');});console.log('ok')"
```
</verification>

<success_criteria>
- [ ] `lib/email-sender/{index,types,providers/resend}.ts` exist; `index.ts` line 1 = `import "server-only"`
- [ ] `npm install` adds `ical-generator`, `timezones-ical-library`, `@marsidev/react-turnstile`, `resend` to dependencies
- [ ] `.env.example` documents `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- [ ] `.env.local` has all four populated (Andrew's responsibility — checkpoint)
- [ ] Vercel Production env has all four populated (Andrew's responsibility — checkpoint)
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Vendor approach documented in SUMMARY (which sibling files copied, what was deleted/adapted)
</success_criteria>

<output>
After completion, create `.planning/phases/05-public-booking-flow/05-02-SUMMARY.md` documenting:
- Exact list of files copied from sibling (`index.ts`, `types.ts`, `providers/resend.ts`, plus any utils/templates pulled along)
- Any imports surgically removed from the vendored copy (e.g., gmail provider import)
- Resend SDK version pinned
- The 3 new npm deps + their installed versions
- Confirmation Andrew set env vars in both `.env.local` and Vercel Production
- The Cloudflare Turnstile site ID configured (last 4 chars of the site key are fine for record)
</output>
