---
phase: 06-cancel-and-reschedule-lifecycle
plan: 02
subsystem: email
tags: [ical-generator, icalendar, email, rate-limiting, postgres, date-fns, typescript]

# Dependency graph
requires:
  - phase: 06-01
    provides: rate_limit_events table + composite index live on remote Supabase; admin client pattern
  - phase: 05-public-booking-flow
    provides: buildIcsBuffer (extended here), sendBookingEmails fire-and-forget pattern, escapeHtml pattern, Gmail SMTP no-from lock
provides:
  - buildIcsBuffer extended with optional method + sequence params (backward-compatible; CANCEL branch sets STATUS:CANCELLED)
  - sendCancelEmails(args) — fire-and-forget BOTH parties with METHOD:CANCEL .ics, SEQUENCE:1, same UID
  - sendRescheduleEmails(args) — fire-and-forget BOTH parties with METHOD:REQUEST .ics, SEQUENCE:1, same UID, new times, OLD→NEW layout
  - checkRateLimit(key, maxRequests, windowMs) — Postgres sliding-window rate limiter against rate_limit_events table
  - DEFAULT_TOKEN_RATE_LIMIT = { maxRequests: 10, windowMs: 5*60*1000 }
affects:
  - plan 06-03 (cancel + reschedule shared functions call void sendCancelEmails / void sendRescheduleEmails)
  - plan 06-04 (public token route handlers call checkRateLimit before token resolution)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildIcsBuffer EXTEND pattern: optional method + sequence params with backward-compatible defaults preserve Phase 5 callers"
    - "ICalEventStatus.CANCELLED set when method=CANCEL (belt-and-suspenders for non-iTIP calendar clients)"
    - "event.sequence() called explicitly on every invocation — ical-generator v10 does NOT auto-increment"
    - "Reason callout only for OPPOSITE party of trigger + only when non-empty (no 'Reason: (none)' empty cells)"
    - "Owner-cancel branch: booker email is apologetic + includes Book-again CTA"
    - "Old→New table layout: strikethrough Was row + bold New time row (booker-tz for booker, account-tz for owner)"
    - "Fails OPEN on DB error in checkRateLimit — transient DB hiccup must not block legitimate bookers"
    - "cancelled.ics filename for cancel .ics (not invite.ics) — obvious to non-iTIP email clients"

key-files:
  created:
    - lib/email/send-cancel-emails.ts
    - lib/email/send-reschedule-emails.ts
    - lib/rate-limit.ts
  modified:
    - lib/email/build-ics.ts

key-decisions:
  - "EXTEND buildIcsBuffer (not separate function) — avoids duplicating ~30 lines of VTIMEZONE setup; Open Question A resolved"
  - "Reason callout only for opposite party of trigger and only when non-empty — prevents confusing self-echo and empty-cell ugliness"
  - "cancelled.ics vs invite.ics filename distinction — cancel attachment is semantically different; non-iTIP clients see the filename"
  - "Fail open on checkRateLimit DB error — transient Supabase hiccup must not lock out legitimate bookers on a personal scheduling app"

patterns-established:
  - "buildIcsBuffer: always call event.sequence(opts.sequence ?? 0) explicitly — library default is 0 but explicit is defensive"
  - "sendCancelEmails / sendRescheduleEmails: void caller pattern (fire-and-forget after DB write succeeds)"
  - "checkRateLimit caller pattern: checkRateLimit('cancel:' + ip, ...DEFAULT_TOKEN_RATE_LIMIT) before token resolution"

# Metrics
duration: 6min
completed: 2026-04-26
---

# Phase 6 Plan 02: ICS Extension, Rate-Limit, and Email Senders Summary

**buildIcsBuffer extended for METHOD:CANCEL/SEQUENCE; Postgres sliding-window rate limiter; cancel + reschedule fire-and-forget email orchestrators with .ics attachments — 4 utility modules ready for Phase 6 business logic**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-26T01:41:10Z
- **Completed:** 2026-04-26T01:46:34Z
- **Tasks:** 3
- **Files modified:** 4 (1 extended, 3 created)

## Accomplishments

- Extended `lib/email/build-ics.ts` with optional `method?: ICalCalendarMethod` (default REQUEST) and `sequence?: number` (default 0); CANCEL branch sets `ICalEventStatus.CANCELLED`; Phase 5 callers unchanged
- Created `lib/rate-limit.ts` — `checkRateLimit(key, maxRequests, windowMs)` + `DEFAULT_TOKEN_RATE_LIMIT = { maxRequests: 10, windowMs: 5*60*1000 }`; Postgres sliding-window via `rate_limit_events` table; fails open on DB error
- Created `lib/email/send-cancel-emails.ts` — `sendCancelEmails(args)` sends BOTH parties via `Promise.allSettled`; METHOD:CANCEL .ics SEQUENCE:1 same UID; owner-cancel branch is apologetic + Book-again CTA; reason callout only for opposite party + non-empty
- Created `lib/email/send-reschedule-emails.ts` — `sendRescheduleEmails(args)` sends BOTH parties; METHOD:REQUEST .ics SEQUENCE:1 same UID NEW times; OLD→NEW table layout in both emails (booker-tz for booker, account-tz for owner)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend buildIcsBuffer with optional method + sequence params** - `8ba4f43` (feat)
2. **Task 2: Create lib/rate-limit.ts (Postgres-backed sliding window)** - `9c608f4` (feat)
3. **Task 3: Create cancel + reschedule email senders** - `893e428` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `lib/email/build-ics.ts` — Extended with `method?: ICalCalendarMethod` + `sequence?: number`; ICalEventStatus.CANCELLED on CANCEL branch; event.sequence() called explicitly; Phase 5 backward-compatible
- `lib/email/send-cancel-emails.ts` — Fire-and-forget cancel orchestrator; METHOD:CANCEL .ics; reason callout for opposite party; apology copy on owner-cancel; Book-again CTA (259 lines)
- `lib/email/send-reschedule-emails.ts` — Fire-and-forget reschedule orchestrator; METHOD:REQUEST .ics; OLD→NEW table layout; booker email includes new cancel/reschedule token links (243 lines)
- `lib/rate-limit.ts` — Postgres sliding-window rate limiter; checkRateLimit + DEFAULT_TOKEN_RATE_LIMIT; fails open on DB error (96 lines)

## Decisions Made

- **EXTEND buildIcsBuffer (Open Question A resolved: EXTEND)** — Adding optional params avoids duplicating the ~30-line VTIMEZONE setup block while keeping Phase 5 callers 100% unchanged. A separate `buildCancelIcsBuffer()` function would provide zero added clarity.
- **Reason callout for opposite party only** — If a booker cancels, showing their own reason back to them in their confirmation email is confusing. The callout surfaces for the party who didn't trigger the action. Empty or whitespace-only reason → omit entirely (no "Reason: (none)").
- **`cancelled.ics` filename (not `invite.ics`) for cancel attachments** — The filename is visible in email client attachment panels. A non-iTIP client that can't process METHOD:CANCEL inline still downloads a file called "cancelled.ics", making the situation clear.
- **Fail OPEN on checkRateLimit DB error** — A transient Supabase connection hiccup that blocks every cancel/reschedule attempt is worse for a real booker than a single missed enumeration check. Consistent with RESEARCH §Rate-Limit Storage Backend Decision rationale.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npm run lint` returns exit code 2 with the pre-existing ESLint circular-JSON error (tracked in STATE.md since Phase 1 as "Phase 8 backlog: ESLint flat-config migration"). Not introduced by this plan; build exits 0 cleanly. Both `npm run build` and TypeScript compilation pass on all 3 tasks.

## User Setup Required

None — no new environment variables, no external service configuration.

## Forward Contracts for Plan 06-03

`lib/bookings/cancel.ts` (Plan 06-03) will call:
```typescript
void sendCancelEmails({ booking, eventType, account, actor, reason, appUrl });
```

`lib/bookings/reschedule.ts` (Plan 06-03) will call:
```typescript
void sendRescheduleEmails({ booking, eventType, account, oldStartAt, oldEndAt, rawCancelToken, rawRescheduleToken, appUrl });
```

## Forward Contracts for Plan 06-04

Public token route handlers will call:
```typescript
const ip = req.headers.get("x-forwarded-for") ?? "unknown";
const rl = await checkRateLimit(`cancel:${ip}`, ...Object.values(DEFAULT_TOKEN_RATE_LIMIT));
if (!rl.allowed) {
  return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
}
```

## Next Phase Readiness

- Plan 06-03 (cancel + reschedule shared functions) can immediately use all 4 utility modules
- Plan 06-04 (public token routes) can immediately use `checkRateLimit` + `DEFAULT_TOKEN_RATE_LIMIT`
- No blockers for Plans 06-03 through 06-06

---
*Phase: 06-cancel-and-reschedule-lifecycle*
*Completed: 2026-04-26*
