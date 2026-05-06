# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-06 — Phase 34 Plan 01 complete. account_oauth_credentials schema + config.toml enable_manual_linking.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-06 after v1.7 kickoff)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.7 Phase 34 — Google OAuth Signup + Credential Capture. Plan 01 complete (schema + config); Plans 02-04 next.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code — IN PROGRESS
**Phase:** 34 — Google OAuth Signup + Credential Capture (first v1.7 phase)
**Plan:** 01 of ~4 — complete
**Status:** Plan 01 complete. Plans 02-04 pending.
**Last activity:** 2026-05-06 — Completed 34-01-PLAN.md (schema foundation + config.toml)

Progress (Phase 34): █░░░ 1/4 plans complete

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [X] Day-of-Disruption Tools      (Phases 31-33, 10 plans, 53 commits, shipped 2026-05-06 — ~2 days)
v1.7 [ ] Auth + Email + Polish + Debt (Phases 34-40, 7 phases, plans TBD — in planning)
```

**Total shipped:** 6 milestones archived (v1.0–v1.6), 33 phases, 138 plans, ~563 commits

## Accumulated Context

### Patterns established in v1.7 (Phase 34+)

- **Admin-client-only writes (Phase 34, Plan 01)** — `account_oauth_credentials` has no INSERT/UPDATE/DELETE RLS. All writes must use the service-role Supabase client in server-side API routes, preventing browser-side credential manipulation.
- **AES-256-GCM encrypted blob format** — `iv:authTag:ciphertext` (all lowercase hex, 12-byte IV, 16-byte auth tag). Canonical format documented in migration comment; Plan 34-02 produces it, Phase 35 consumes it.

### Patterns established / locked through v1.6

See PROJECT.md Key Decisions for full table. Key ones relevant to v1.7:

- **Refuse-send fail-closed (Phase 31)** — all 7 email senders go through `checkAndConsumeQuota()`; v1.1 carve-out removed. `getRemainingDailyQuota()` for batch pre-flights.
- **Vitest `resolve.alias` array/regex exact-match** — `find: /^@\/lib\/email-sender$/` prevents alias prefix-bleed. New provider sub-paths get their own alias entries (LD-14).
- **Two-step deploy protocol (CP-03)** — strangler-fig pattern for cutover; SMTP removal is a separate deploy after production verification (LD-06).
- **`slot-picker.tsx` kept on disk** — Plan 30-01 Rule 4; explicit `knip` ignore list required (LD-09).
- **Deploy-and-eyeball as canonical production gate** — 6th consecutive milestone, formally the operating model.

### Blockers / prereqs for v1.7

- **PREREQ-01** (blocks Phase 34): Google Cloud Console OAuth setup + app verification (3-5 day lead time — start immediately).
- **PREREQ-02** (blocks Phase 34): Supabase Google provider toggle + credential paste.
- **PREREQ-03** (blocks Phase 36): Resend account + NSI domain DNS verification via Namecheap.
- **PREREQ-04** (blocks Phases 34, 35, 36): Vercel env vars — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY`, `RESEND_API_KEY`.

### Open tech debt (carried into v1.7)

- `slot-picker.tsx` on disk per Andrew Option A (Phase 40 audit will surface it; explicit knip ignore required).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — uncommitted.
- `tests/bookings-api.test.ts` one failing test (fixture mismatch); 30/31 test files green.

## Session Continuity

**Last session:** 2026-05-06 — Phase 34 Plan 01 executed (schema + config.toml).

**Stopped at:** Completed 34-01-PLAN.md. Commits: b214eb5 (migration), f490e7e (config.toml).

**Next session:** Execute Phase 34 Plan 02 — write API route that encrypts and stores the Google refresh token into account_oauth_credentials.

**Files of record:**
- `.planning/ROADMAP.md` — v1.7 Phases 34-40 defined; v1.6 collapsed to `<details>`
- `.planning/STATE.md` — this file
- `.planning/REQUIREMENTS.md` — all 30 v1.7 requirements with phase traceability filled
- `.planning/phases/34-google-oauth-signup-and-credential-capture/34-01-SUMMARY.md` — Plan 01 complete
- `supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql` — table schema (b214eb5)
- `supabase/config.toml` — enable_manual_linking = true (f490e7e)

**Note:** Docker was not running during Plan 01 execution. Run `npx supabase db reset` to verify migration applies cleanly before testing Plan 02 locally.
