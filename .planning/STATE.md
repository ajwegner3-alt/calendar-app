# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-06 — v1.7 roadmap created. Phases 34-40 defined. 30/30 requirements mapped.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-06 after v1.7 kickoff)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.7 Phase 34 — Google OAuth Signup + Credential Capture. Roadmap created; ready to plan first phase.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code — IN PLANNING
**Phase:** 34 — Google OAuth Signup + Credential Capture (first v1.7 phase)
**Plan:** —
**Status:** Roadmap created. Ready to plan first phase.
**Last activity:** 2026-05-06 — v1.7 roadmap written. ROADMAP.md, STATE.md, REQUIREMENTS.md traceability updated.

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

**Last session:** 2026-05-06 — v1.7 roadmap created via `/gsd:new-milestone` flow.

**Stopped at:** Roadmap creation complete. Files written: ROADMAP.md, STATE.md, REQUIREMENTS.md (traceability filled).

**Next session:** Run `/gsd:plan-phase 34` to plan Phase 34 (Google OAuth Signup). Before starting: confirm PREREQ-01 and PREREQ-02 are in flight (Google Cloud Console + Supabase provider). PREREQ-04 env vars needed before first deploy.

**Files of record:**
- `.planning/ROADMAP.md` — v1.7 Phases 34-40 defined; v1.6 collapsed to `<details>`
- `.planning/STATE.md` — this file
- `.planning/REQUIREMENTS.md` — all 30 v1.7 requirements with phase traceability filled
