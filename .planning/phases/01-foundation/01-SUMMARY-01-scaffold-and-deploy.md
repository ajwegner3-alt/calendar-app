# Summary: 01-PLAN-01 Scaffold and Deploy

**Plan:** `01-PLAN-01-scaffold-and-deploy.md`
**Status:** Complete ✓
**Completed:** 2026-04-18

## What Was Built

A Next.js 16 + Tailwind v4 + `@supabase/ssr` project scaffolded from the canonical `with-supabase` template, published to a new public GitHub repo, and deployed live on Vercel. This is the v1 foundation: a working URL wired to the Supabase `calendar` project, ready for schema migrations in Wave 2.

## Commits

| Commit | Task | Files |
|--------|------|-------|
| `0b66177` | `feat(01-01): scaffold Next 16 + Tailwind v4 via with-supabase template` | 18 files (scaffold + lib/supabase/*) |

Plan metadata commit will follow this SUMMARY.

## Key Outputs

- **GitHub repo:** https://github.com/ajwegner3-alt/calendar-app (public, `main` branch, first commit pushed)
- **Vercel production URL:** https://calendar-app-xi-smoky.vercel.app/ (HTTP 200, Next.js SSR + Turbopack chunks confirmed)
- **Local env:** `.env.local` populated with three values (URL + publishable + service_role); gitignored
- **Stack pinned:** Next `16.2.4`, React `19.2.5`, Tailwind `^4.2.0`, `@supabase/ssr` `^0.10.2`, TypeScript `^6.0.3`
- **Key modules:**
  - `proxy.ts` (root) — Next 16 convention, not `middleware.ts`
  - `lib/supabase/client.ts` — browser client
  - `lib/supabase/server.ts` — server component client
  - `lib/supabase/proxy.ts` — used by `proxy.ts` for session refresh (`supabase.auth.getClaims()`)
  - `lib/supabase/admin.ts` — service-role client, `import "server-only"` as line 1
- **.env.example** — template using `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new Supabase key naming, not legacy `_ANON_KEY`)

## Verification vs Success Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Next 16 App Router page served from Vercel URL connected to `calendar` Supabase project | ✓ | `curl -sS https://calendar-app-xi-smoky.vercel.app/` → HTTP 200, 5942 bytes, Next SSR + Turbopack chunks; env vars set in Vercel for all three environments |
| `proxy.ts` exists; no `middleware.ts` | ✓ | File listing verified at commit time |
| `lib/supabase/admin.ts` line 1 is `import "server-only";` | ✓ | Read verified before commit |
| `.env.local` gitignored | ✓ | `.gitignore` contains `.env*.local`; `git status` confirms `.env.local` is hidden |
| GitHub repo public under `ajwegner3-alt` account | ✓ | `gh repo create ... --public` succeeded; URL reachable |

## Deviations / Discoveries

- **Wave 1 was interrupted mid-execution** by the parent conversation hitting a usage limit. Files were on disk but nothing was committed and no repo existed. Resume path: staged the scaffold individually (no `git add -A`), renamed `master` → `main` (git init default was `master`; CONTEXT.md locked `main`), created the repo via `gh`, pushed, then handed off Vercel import to Andrew.
- **`.gitignore` extended** with `.claude/settings.local.json` to keep user-local Claude Code permission grants out of the repo.
- **Legacy JWT `SUPABASE_SERVICE_ROLE_KEY`** (`eyJ...`) is in use rather than the new `sb_secret_*` format. Legacy keys still work — Supabase accepts them in parallel with the new format — but swap to `sb_secret_*` for consistency before any security-sensitive phase (noted in STATE.md todos). The `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is already the new format.
- **No `next-env.d.ts` committed** — correctly gitignored per Next's convention; it regenerates on every build.
- **Turbopack is the default** for both dev and prod builds in Next 16 (no `--turbopack` flag needed, as the research called out).

## must_haves Status

- [x] Deployed Vercel URL returns a working Next 16 page connected to Supabase `calendar`
- [x] Service-role client gated in `lib/supabase/admin.ts` via `import "server-only"` line 1
- [x] Env vars use new Supabase key naming (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- [x] Scaffold deployed BEFORE any schema work (two-step deploy order locked by CONTEXT.md)

## Next

Plan 02 (Schema Migrations) — Wave 2. Supabase CLI init/link to the remote `calendar` project, write versioned migration files for all 6 tables + partial unique index + `booking_status` enum + `booking_events` enum + RLS helper + per-table policies + `branding` storage bucket, push to remote, seed Andrew's account (idempotent, `America/Chicago`). Requires one human-action checkpoint for `supabase login` + `supabase link --project-ref <ref>`.
