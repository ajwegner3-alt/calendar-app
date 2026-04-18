# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-18

## Project Reference

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox - no phone tag, no back-and-forth.

**Current focus:** Roadmap complete. Awaiting kickoff of Phase 1 (Foundation).

**Mode:** yolo
**Depth:** standard
**Parallelization:** enabled

## Current Position

**Phase:** None (pre-Phase 1)
**Plan:** None
**Status:** Roadmap created; ready for `/gsd:plan-phase 1`
**Progress:** [-] 0 / 9 phases complete

```
Phase 1  [ ] Foundation
Phase 2  [ ] Owner Auth + Dashboard Shell
Phase 3  [ ] Event Types CRUD
Phase 4  [ ] Availability Engine
Phase 5  [ ] Public Booking Flow + Email + .ics
Phase 6  [ ] Cancel + Reschedule Lifecycle
Phase 7  [ ] Widget + Branding
Phase 8  [ ] Reminders + Hardening + Dashboard List
Phase 9  [ ] Manual QA & Verification
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases planned | 0 / 9 |
| Phases complete | 0 / 9 |
| Requirements mapped | 73 / 73 |
| Requirements complete | 0 / 73 |

## Accumulated Context

### Key Decisions

- **Multi-tenant from day one, single tenant in v1** - schema supports many accounts; only Andrew's account is seeded; signup UI deferred to v2.
- **Supabase is sole source of truth** - no Google Calendar sync, no external availability sources.
- **Race-safe at the DB layer** - partial unique index `UNIQUE (event_type_id, start_at) WHERE status='confirmed'` is the authoritative double-book guard.
- **Time discipline** - `timestamptz` everywhere, IANA TZ strings, `date-fns v4 + @date-fns/tz`. No raw `Date` math.
- **Service-role gate** - service-role Supabase client lives in a single `lib/supabase/admin.ts` with `import 'server-only'`.
- **Vercel Cron for reminders** (with pg_cron as fallback) - hourly tick, CAS claim pattern.
- **Embeds** - script-injected iframe + raw iframe fallback; CSP `frame-ancestors *` only on `/embed/*`.
- **Email** - all transactional via `@nsi/email-sender` (Resend); booker confirmation includes `.ics` (`METHOD:REQUEST`, stable UID).
- **Phase parallelization** - Phase 3 || Phase 4 after Phase 1; Phases 6 || 7 || 8 after Phase 5.

### Open Questions / Todos

- Phase 4 needs `/gsd:research-phase` (date-fns/tz v4 + slot algorithm).
- Phase 5 needs `/gsd:research-phase` (.ics across clients + `@nsi/email-sender` attachment API).
- Phase 7 needs `/gsd:research-phase` (Next 15 per-route CSP + static `widget.js` on Vercel).
- Phase 8 needs `/gsd:research-phase` (Vercel Cron hobby-tier limits + Resend DNS format).
- Verify pg_cron availability on Supabase Free tier during Phase 1.
- Confirm `@nsi/email-sender` attachment signature before Phase 5 plan.

### Blockers

None.

## Session Continuity

**Next action:** Run `/gsd:plan-phase 1` to decompose the Foundation phase into executable plans.

**Files of record:**
- `.planning/PROJECT.md` - what + why
- `.planning/REQUIREMENTS.md` - 73 v1 requirements with phase mapping
- `.planning/ROADMAP.md` - 9 phases with goals and success criteria
- `.planning/research/SUMMARY.md` - research findings + roadmap implications
- `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` - detail
- `.planning/config.json` - depth, mode, parallelization settings

---
*State initialized: 2026-04-18*
