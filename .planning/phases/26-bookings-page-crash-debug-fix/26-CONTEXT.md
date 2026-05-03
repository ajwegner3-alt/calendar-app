# Phase 26: Bookings Page Crash Debug + Fix - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Identify the confirmed root cause of the `/app/bookings` page crash and ship a fix that holds across all seeded production accounts. Scope is debug-and-fix on the bookings page render path — no new bookings features, no unrelated query refactors. Research narrows the suspected site to `_lib/queries.ts:85-92` (`event_types!inner` join or RLS artifact), but the prior is treated as a hint, not a constraint.

</domain>

<decisions>
## Implementation Decisions

### Diagnostic protocol
- **Evidence threshold:** Claude's discretion — escalate evidence-gathering only when prior step is ambiguous. Don't force a fixed checklist (logs → SQL → local) if the first signal is decisive.
- **Stop condition (hard rule):** Do NOT open a fix PR until all three are in hand: (1) deterministic reproduction of the failure, (2) one-line mechanism explaining WHY it fails, (3) candidate fix that demonstrably resolves the repro.
- **Log fallback:** If Vercel server logs are opaque or the stack trace is unhelpful, pause and ask Andrew to copy/paste raw Vercel logs and any relevant Supabase rows into the conversation. Do NOT deploy temporary instrumentation as a first move.
- **Root cause prior:** Claude's discretion — start narrow on `_lib/queries.ts:85-92` per research, widen to RLS / data-shape / server-component candidates if the first lead goes cold.

### Fix scope & shape
- **Breadth:** Surgical at the failing site, plus a grep audit for the same anti-pattern (e.g., other `!inner` joins or similar return-shape bugs) across `_lib/queries.ts` and adjacent helpers. Document risks in SUMMARY but do NOT fix sites that aren't actually broken.
- **Shared helper handling:** If the root cause lives in a helper whose return type is inherently bug-prone (e.g., union with null that callers forget to handle), refactor the signature so the bug class becomes impossible at the type level. Update all callers in the same commit.
- **DB / RLS touch:** Claude's discretion. Default is app-code-only with read-only SQL Editor for diagnosis. If the confirmed root cause is genuinely a schema or RLS issue, fix it here rather than artificially stopping at the app boundary — flag the escalation in SUMMARY before applying any DDL.
- **Defensive guards:** Claude's discretion based on the actual root cause shape. Bias toward strict fixes (no dead `?? []` belts), but a single safety net at the page-component boundary is acceptable if it preserves a useful failure mode.

### Verification breadth
- **Required account shapes (all must render cleanly on prod):**
  - The 3 seeded accounts: NSI (`slug=nsi`), nsi-rls-test, nsi-rls-test-3
  - Empty bookings — account with zero bookings ever (empty state, no crash)
  - Cancelled-only — account where every booking is `status=cancelled`
  - Many bookings — account with high booking count (>50) to surface perf or limit regressions
  - Mixed event types — bookings spanning multiple event types, including any with deleted/null `event_type` rows (stress-tests the `!inner` join)
- **Environment:** Production-live verification only. Push to main → Vercel deploys → verify on the live URL. Matches the project-wide "all testing is done live" rule.
- **Automated tests:** Add ONE targeted regression test that would have caught this specific crash (e.g., bookings query returns valid shape for a fixture matching the failing account). No broader test sweep — keep the suite lean.
- **Sign-off:** Andrew live-verifies `/app/bookings` on production for each verification account and confirms in chat. Matches v1.3 sign-off pattern.

### Failure-mode UX
- All four sub-decisions delegated to Claude's discretion (see below).

### Claude's Discretion
- **Failure UI behavior** — Whether to wrap the page in an error boundary, show empty-state fallback, or leave hard-crash status quo. Choose based on what existing patterns in the app do and on the actual root cause shape. Loud-failure bias is preferred (regressions should be visible), but don't expose a raw stack trace to contractor users.
- **Server-side error logging** — Whether/how to add `console.error` at the catch site. Default is "minimal if none exists at this site, none if logging convention is already established elsewhere." Don't introduce a logging framework here.
- **Loading state** — Touch only if the crash is causally linked to an unhandled loading/suspense state. Otherwise leave alone.
- **User-facing communication** — No support links, toasts, or incident banners by default (internal contractor-only app). A friendly error message is fine if an error boundary is added.
- **Defensive null guards** — Strict-fix bias; one boundary-level guard acceptable if it preserves a useful failure mode.
- **Diagnostic evidence escalation** — Per "Evidence threshold" above, judge per-evidence rather than running a fixed checklist.

</decisions>

<specifics>
## Specific Ideas

- **Reproduce-first protocol is non-negotiable** — V14-MP-04 from research applies: no speculative null guards before the root cause is confirmed.
- **Seeded test accounts already exist** — NSI (`slug=nsi`), nsi-rls-test, nsi-rls-test-3 are the canonical reproduction surface for any fix.
- **Logs gathering is a manual handoff** — Andrew pulls Vercel logs and Supabase rows when needed, per global preference for manual handoffs on dashboard-only data.
- **Research suspect file:** `_lib/queries.ts:85-92` (`event_types!inner` join or RLS artifact). Treat as starting point, not as a foregone conclusion.

</specifics>

<deferred>
## Deferred Ideas

- **Broader query-helper return-shape refactor** — If the audit finds multiple `!inner` joins with similar fragility but the bookings-page fix only requires touching one, those other sites are noted in SUMMARY but deferred to a future tech-debt phase.
- **Structured / centralized error logging convention** — Out of scope. If logging is needed, it's the minimum viable kind. A real logging convention (Sentry, structured JSON, log levels) is its own future phase.
- **Bookings page UX polish** (loading skeletons, error illustrations, retry UX patterns) — Not part of debug-and-fix. Belongs in a future polish phase if/when prioritized.
- **Schema / RLS hardening** beyond what's needed to fix the confirmed root cause — Phase 27 owns DB-layer correctness work; Phase 26 only touches the DB if the confirmed root cause is actually there.

</deferred>

---

*Phase: 26-bookings-page-crash-debug-fix*
*Context gathered: 2026-05-03*
