# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-27 — v1.0 milestone archived. All 9 phases complete; v1.0 SHIPPED with Andrew's verbatim sign-off "ship v1" on 2026-04-27. ROADMAP/REQUIREMENTS archived to `.planning/milestones/v1.0-*`. PROJECT.md fully evolved (Validated section populated with 25 shipped capabilities; Active section = v1.1 backlog of 8 deferred requirements + 6 dashboard walkthrough items). v1.1 not yet planned.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-27 after v1.0 milestone)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** Planning v1.1 — close deferred QA items (canonical backlog in `FUTURE_DIRECTIONS.md` at repo root).

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Milestone:** v1.0 SHIPPED 2026-04-27.
**Phase:** Not started — v1.1 not yet planned. Next: `/gsd:new-milestone` for v1.1 questioning → research → requirements → roadmap.
**Status:** Ready to plan v1.1.
**Last activity:** 2026-04-27 — v1.0 milestone archived. `.planning/milestones/v1.0-ROADMAP.md` + `.planning/milestones/v1.0-REQUIREMENTS.md` written; `.planning/MILESTONES.md` created with v1.0 entry; `.planning/PROJECT.md` evolved (Validated populated, Active = v1.1 backlog); `.planning/ROADMAP.md` collapsed to one-line summary; `.planning/REQUIREMENTS.md` deleted (will be re-created during `/gsd:new-milestone` for v1.1).

**Progress:** [█████████] 9 / 9 phases complete (v1.0 SHIPPED 2026-04-27)

```
Phase 1  [✓] Foundation                              (verified 2026-04-19)
Phase 2  [✓] Owner Auth + Dashboard Shell            (verified 2026-04-24)
Phase 3  [✓] Event Types CRUD                        (verified 2026-04-24)
Phase 4  [✓] Availability Engine                     (verified 2026-04-25)
Phase 5  [✓] Public Booking Flow + Email + .ics      (Complete 2026-04-25)
Phase 6  [✓] Cancel + Reschedule Lifecycle           (Complete 2026-04-25)
Phase 7  [✓] Widget + Branding                       (Complete 2026-04-26 — live-verified)
Phase 8  [✓] Reminders + Hardening + Dashboard List  (CODE COMPLETE 2026-04-27; dashboard walkthrough → v1.1)
Phase 9  [✓] Manual QA & Verification                (COMPLETE 2026-04-27 — Andrew sign-off "ship v1"; v1.0 SHIPPED)
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 9 / 9 |
| Phases complete | 9 / 9 (v1.0 SHIPPED 2026-04-27) |
| Plans complete | 52 / 52 |
| Requirements mapped | 73 / 73 |
| Requirements complete | 66 / 73 (90.4%) — 7 deferred to v1.1 (EMBED-07, EMAIL-08, QA-01..QA-06; see `FUTURE_DIRECTIONS.md` for canonical enumeration) |
| Files created/modified | 344 |
| Lines inserted | 85,014 |
| TS/TSX runtime LOC | 20,417 |
| Commits | 222 (`e068ab8` → `3f83461`) |
| Timeline | 10 days (2026-04-18 → 2026-04-27) |
| Tests | 131 passing + 1 skipped (16 test files) |

## Accumulated Context

### Key Decisions (carried forward to v1.1+)

(Full historical decision log in `.planning/PROJECT.md` Key Decisions table and `.planning/milestones/v1.0-ROADMAP.md` Milestone Summary. The following are the load-bearing decisions for v1.1 planning.)

- **v1.0 SHIPPED 2026-04-27 with Andrew's verbatim sign-off "ship v1".** Marathon QA scope-cut to v1.1 by project-owner discretion. v1 ships on extensive automated coverage (131/132 green) + Phase 7 live verification + Phase 8 code-complete + Apple Mail code-review LIKELY PASS.
- **Multi-tenant from day one, single tenant in production** — schema supports many accounts; only Andrew's account seeded; signup UI deferred to v2 (per Phase 9 CONTEXT lock: "multi-tenant signup + onboarding flow; out of scope for v1").
- **DB-level race-safe via `bookings_no_double_book` partial unique index** — authoritative double-book guard. Pattern reusable for any future "exactly one of these can succeed" insert race in v1.1+.
- **`timestamptz` everywhere + IANA TZ + `date-fns v4 + @date-fns/tz`** — no raw `Date` math; `TZDate(y, m-1, d, hh, mm, 0, TZ)` constructor for wall-clock window endpoints. Locked.
- **Service-role gate** — `lib/supabase/admin.ts` line 1 `import "server-only"`. Locked for any future service-role module.
- **CSP/X-Frame-Options ownership rule** — `proxy.ts` is the EXCLUSIVE owner; `next.config.ts` only sets the global SAMEORIGIN default. Never set X-Frame-Options in `next.config.ts` again — it merges AFTER middleware and silently overwrites `proxy.ts`'s `delete()`.
- **Vendor `@nsi/email-sender` (NOT `npm install ../email-sender`)** — Vercel build cannot resolve sibling-relative `file:../` paths. Pattern locked for any future shared tooling.
- **Email = Gmail SMTP via owner's personal Gmail** (post-Resend pivot in Phase 5). Acceptable for v1 contractor volume; revisit if multi-account v2 lights up.
- **Vercel Pro tier required for hourly cron** — `vercel.json` `crons[].schedule = "0 * * * *"` does not deploy on Hobby. cron-job.org fallback was dropped.
- **Direct-call Server Action contract for forms** — actions accept structured TS objects (NOT FormData) when forms have nested arrays/discriminated unions. NEXT_REDIRECT re-throw in form catch handler.
- **Two-stage owner authorization** — RLS-scoped pre-check before service-role mutation. Pattern locked across `cancelBookingAsOwner`, branding actions, `saveReminderTogglesCore`.
- **POST `/api/bookings` is a Route Handler (NOT Server Action)** — Server Actions cannot return 409.
- **Token rotation on every reminder send invalidates original confirmation tokens** — accepted side-effect; v1.1 may add reminder retry/resend UI on `/app/bookings/[id]`.
- **Reminder retry on send failure = NONE by design** (RESEARCH Pitfall 4 — clearing `reminder_sent_at` on failure causes retry spam).
- **Postgres-backed rate limiting** — single `rate_limit_events` table with composite index, per-route key prefix. `checkRateLimit` fails OPEN on DB error.
- **Migration drift workaround LOCKED** — `npx supabase db push --linked` fails with "Remote migration versions not found" (3 orphan timestamps in remote tracking table). Use `npx supabase db query --linked -f <migration.sql>` instead. Same Management API path; bypasses tracking table.
- **Apply migrations via Supabase MCP `apply_migration` tool when available; CLI fallback otherwise.** CLI-versioned files committed under `supabase/migrations/` for portability.
- **`RESERVED_SLUGS = ["app", "api", "_next", "auth", "embed"]`** duplicated across 2 files (`app/[account]/[event-slug]/_lib/load-event-type.ts` AND `app/[account]/_lib/load-account-listing.ts`). Hand-sync any additions in v1.1+.
- **Supabase project + ref locked** — `mogfnutxrrbtvnaupoun`, region West US 2, Postgres 17.6.1.
- **Seeded NSI account** — `slug=nsi`, `id=ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_email=ajwegner3@gmail.com`, `owner_user_id=1a8c687f-73fd-4085-934f-592891f51784`.

### Open Carried Concerns (v1.1 backlog — see `FUTURE_DIRECTIONS.md`)

These concerns are NOT blockers for v1.0 ship; they are starting points for v1.1 planning.

- **EMBED-07 + QA-01..QA-06 + EMAIL-08 (8 deferred requirements)** — canonical enumeration in `FUTURE_DIRECTIONS.md` §1, §3.
- **Phase 8 dashboard 9-item human walkthrough** — bookings list filters/pagination, detail page (answers + owner-note autosave + history timeline + action bar), reminder settings toggles, event-type Location field, reminder email branding live in inbox, Vercel Cron green-tick verification, rate-limit live smoke (3 endpoints), Settings sidebar group, branding editor file-rejection edge cases.
- **Cron-fired-in-production functional proof** — Vercel Crons UI tab not surfacing schedule for Andrew despite `vercel.json` deployed. Verify with real reminder arrival.
- **Apple Mail live device verification** — currently code-review LIKELY PASS only (commit `3d5fb31`, 11 fact-bullets); device-based pass deferred.
- **Per-template branding 6-row smoke** — booker × owner × confirm/cancel/reschedule (6 surfaces).
- **Plain-text alternative on confirmation email** — small commit; mirror reminder pattern.
- **NSI mark image in email footer** — currently text-only because `NSI_MARK_URL = null`.
- **`react-hooks/incompatible-library` warning** — RHF `watch()` on `event-type-form.tsx:99` not memoizable; refactor to `useWatch`.
- **Pre-existing `tsc --noEmit` test-mock alias errors** — aliases live only in `vitest.config.ts`, not `tsconfig.json`.
- **`/auth/callback` route 404s** — blocks Supabase password-reset / magic-link flows. v2 backlog.
- **Supabase service-role key still legacy JWT** — `sb_secret_*` format not yet rolled out for this project; revisit when Supabase changelog announces availability.
- **`generateMetadata` double-load on public booking page** — 2 DB round-trips per request; can wrap in `import { cache } from 'react'`.
- **Reminder retry/resend UI** on `/app/bookings/[id]` detail page (Phase 8 surface). Critical caveat: do NOT auto-clear `reminder_sent_at` on send failure (RESEARCH Pitfall 4).
- **`qa-test` dedicated event type** — Plan 09-01 prereq #4 was skipped per Andrew's direction. Cleaner regression-test isolation could be re-introduced in v1.1.
- **Plan 08-05/06/07 wave-2 git-index race** — multi-agent commits swept in untracked sibling files. Future YOLO multi-wave runs should serialize commits or use per-agent worktrees.

### Resolved Blockers (v1.0)

All v1.0 blockers resolved or deferred to v1.1. None carry forward as active blockers for v1.1 planning. Full historical resolution log in `.planning/milestones/v1.0-ROADMAP.md` Milestone Summary "Issues Resolved" section.

---

## Session Continuity

**Last session:** 2026-04-27 — v1.0 milestone archived. ROADMAP collapsed; REQUIREMENTS archived + deleted; PROJECT.md fully evolved; MILESTONES.md created; STATE.md rewritten for v1.1 readiness; git tag `v1.0` created and pushed; milestone close commit pushed to `origin/main`.

**Stopped at:** v1.0 milestone complete. Ready to start v1.1.

**Resume:** `/clear` first → fresh context window → `/gsd:new-milestone` for v1.1 questioning → research → requirements → roadmap.

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-04-27)
- `.planning/MILESTONES.md` — v1.0 entry (created 2026-04-27)
- `.planning/ROADMAP.md` — collapsed one-line summary; v1.1 placeholder
- `.planning/milestones/v1.0-ROADMAP.md` — full v1.0 phase archive
- `.planning/milestones/v1.0-REQUIREMENTS.md` — full v1.0 requirements archive (73 mapped, 66 shipped, 7 deferred)
- `.planning/research/` — domain-level research (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY)
- `.planning/phases/01-foundation/` through `.planning/phases/09-manual-qa-and-verification/` — full execution history (kept; phase numbering continues in v1.1)
- `.planning/config.json` — depth, mode, parallelization, model profile, workflow toggles
- `FUTURE_DIRECTIONS.md` (repo root) — canonical v1.1 backlog enumeration; future Claude Code sessions read after CLAUDE.md
