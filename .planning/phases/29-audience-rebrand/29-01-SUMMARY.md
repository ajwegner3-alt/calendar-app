---
phase: 29-audience-rebrand
plan: 01
subsystem: docs
tags: [rebrand, copy, audience, branding, owner-surface]

# Dependency graph
requires:
  - phase: 28-per-event-type-buffer-and-column-drop
    provides: Clean working tree + production stability for cosmetic copy pass
provides:
  - Audience-neutral / "service businesses" framing across 2 owner-surface and 2 developer-doc files
  - LD-07 override applied + audited for booking-form.tsx:138 (inert dev comment only)
  - Canonical grep gate (`trade contractor|contractor` minus `contractor's brand` allowlist) baseline at 0
affects: [30-public-booker-3-column-layout, future-owner-onboarding-copy, future-marketing-site]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copy-only phase pattern: grep-clean + tsc-scope-clean + Vercel Ready as the close (no live-eyeball QA)"
    - "Single-commit batched copy edit when all changes verify under one canonical grep gate"

key-files:
  created:
    - .planning/phases/29-audience-rebrand/29-01-SUMMARY.md
  modified:
    - app/(auth)/_components/auth-hero.tsx
    - app/[account]/[event-slug]/_components/booking-form.tsx
    - README.md
    - FUTURE_DIRECTIONS.md

key-decisions:
  - "LD-07 override: booking-form.tsx:138 dev comment IS in scope (inert, zero booker-facing impact). Runtime raceMessage on line 139 stayed byte-identical."
  - "Tagline drops 'Built for X' framing entirely instead of swapping audience token — keeps NSI/Omaha provenance, removes audience-shaping from the closing line."
  - "README opening drops 'Calendly-style' (no competitor name) AND the '(plumbers, HVAC, roofers, electricians)' parenthetical — audience-led without competitor anchoring."
  - "Modifier form 'service-business' (hyphenated) used in FUTURE_DIRECTIONS line 62 because 'service businesses use case' is ungrammatical; canonical noun form 'service businesses' preserved everywhere it stands alone."
  - "FUTURE_DIRECTIONS lines 226 and 232 use 'owners' (in-product term) rather than 'service businesses' — referent is the owner of an account on this product, not the audience."
  - "Per CONTEXT.md verification waiver: NO live smoke / human-verify checkpoint for this phase. Copy-only change with no behavior to eyeball. Grep-clean + tsc-scope-clean + push-to-main + Vercel Ready is the close."

patterns-established:
  - "Copy-only phase pattern: when an entire phase is documentation/copy and a deterministic grep gate exists, the gate replaces the live-eyeball QA gate. Andrew's global 'live testing' default still applies (auto-deploy on push) but no separate QA checkpoint is needed."
  - "LD-07-style locks can be deliberately overridden in a successor phase's CONTEXT.md when the carve-out is narrow (single inert line, no runtime/UI effect) and recording the override keeps the gate honest. Override must be auditable: stated in CONTEXT, restated in PLAN, restated in SUMMARY."
  - "Pre-existing modifications outside plan scope (e.g., .planning/phases/02-...VERIFICATION.md was M before this plan started) are deliberately NOT staged. Per-file `git add` of plan files only — never `git add -A`."

# Metrics
duration: ~2min
completed: 2026-05-04
---

# Phase 29 Plan 01: Audience Rebrand Summary

**Single batched copy commit replaces "trade contractors" framing with "service businesses" across 2 owner-surface files (auth-hero subtext + tagline) and 2 developer-doc files (README + FUTURE_DIRECTIONS), plus LD-07-overridden inert dev comment in booking-form.tsx:138 — booker-facing surfaces untouched, canonical grep gate at 0.**

## Performance

- **Duration:** ~2 min (1m 48s)
- **Started:** 2026-05-04T01:39:11Z
- **Completed:** 2026-05-04T01:40:59Z
- **Tasks:** 3 (Task 1 + Task 2 edits batched into one commit per Task 3 / plan-locked single-commit rule)
- **Files modified:** 4
- **Commits:** 1 content commit + 1 metadata commit

## Accomplishments

- Owner-surface auth hero (login + signup right-side panel) no longer reads "trade contractors" — subtext defaults to "service businesses" framing; tagline simplified to "Built by NSI in Omaha." (audience phrase dropped entirely).
- README opening rewritten audience-led without competitor anchor or trade parenthetical — first paragraph any reader (developer, prospective owner, AI agent) sees now reads inclusively.
- FUTURE_DIRECTIONS audience-context contractor mentions (lines 62, 226, 232) rewritten with appropriate term-of-art (`service-business` modifier on line 62; `owners` in-product noun on lines 226 and 232).
- LD-07 lock deliberately overridden for `booking-form.tsx:138` inert dev comment only; runtime `raceMessage` on line 139 byte-identical (booker copy untouched).
- Canonical grep gate, ROADMAP-verbatim narrower gate, AND booker-surface neutrality gate all return 0 matches.

## Task Commits

Plan-locked into a single content commit (Task 3 Step 5 explicitly chose "this whole copy pass is one logical unit. Single commit"). Per-task commits would have produced 3 commits for 7 tiny string swaps — disproportionate to the change size and Andrew's global "commit after a logical unit of work" preference.

1. **Task 1 (auth-hero subtext + tagline) + Task 2 (README + booking-form + FUTURE_DIRECTIONS) batched** — `0659c0e` (docs)
2. **Plan metadata commit** — to follow this SUMMARY write (will be `docs(29-01): complete audience-rebrand plan`)

## Files Created/Modified

- `app/(auth)/_components/auth-hero.tsx` — 2 line edits: subtext default (line 21) `trade contractors` → `service businesses`; tagline `<li>` (line 42) `Built for trade contractors, by NSI in Omaha.` → `Built by NSI in Omaha.`
- `app/[account]/[event-slug]/_components/booking-form.tsx` — 1 line edit: dev comment (line 138) `// leak that the contractor has another appointment.` → `// leak that the owner has another appointment.` (LD-07 override; runtime string at line 139 byte-identical)
- `README.md` — 1 line edit: opening (line 3) replaced — drops `Calendly-style`, drops `trade contractors (plumbers, HVAC, roofers, electricians)`, swaps `a contractor's website` → `a business's website`
- `FUTURE_DIRECTIONS.md` — 3 line edits: line 62 `v1 contractor use case` → `v1 service-business use case`; line 226 `if contractors report` → `if owners report`; line 232 `for contractors to choose from.` → `for owners to choose from.`

**Diff total:** 7 insertions, 7 deletions across 4 files (per `git show 0659c0e --stat`).

## Verification Results

### Canonical grep gate (PRIMARY — Task 3 Step 1)

```
$ grep -rniE "trade contractor|contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md \
    | grep -viE "contractor's brand|contractors' brand"
(0 lines)
```

**Result:** 0 lines. PASS.

### ROADMAP-verbatim narrower gate (Task 3 Step 2)

```
$ grep -rn "trade contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md
(0 matches)
```

**Result:** 0 matches. PASS. Closes ROADMAP success criterion #4 verbatim.

### Booker-surface neutrality gate (Task 3 Step 3)

```
$ grep -rn "service businesses" app/[account]/ lib/email-sender/
(0 matches)
```

**Result:** 0 matches. PASS. Confirms audience copy did NOT leak into booker-facing routes (`app/[account]/`) or transactional email templates (`lib/email-sender/`). Closes BRAND-03 / ROADMAP success criterion #5.

### tsc gate (Task 3 Step 4)

```
$ npx tsc --noEmit
... 33 errors total, ALL in tests/ (pre-existing, predates Phase 28 per STATE.md)
... 0 errors in app/ or lib/
```

**Result:** 0 new errors in plan-scope files (`app/` + `lib/`). PASS.

The 33 `tests/` errors (test mock helpers `__setTurnstileResult`, `__mockSendCalls`, `__resetMockSendCalls`, plus implicit-any test parameters in `cancel-reschedule-api.test.ts`, `email-6-row-matrix.test.ts`, `reminder-cron.test.ts`, `reminder-email-content.test.ts`, `bookings-api.test.ts`, `bookings-rate-limit.test.ts`, `owner-note-action.test.ts`) were already present at plan start and are explicitly out of scope per the prompt and STATE.md soft-concerns note.

### Deploy gate

- **Commit SHA:** `0659c0e`
- **Branch:** `main`
- **Push:** `8c464f6..0659c0e  main -> main` (succeeded)
- **Vercel auto-deploy:** triggered on push (push timestamp `2026-05-04T01:40:55Z`-ish, exact "Ready" timestamp visible on Andrew's Vercel dashboard)
- **Live smoke:** EXPLICITLY WAIVED per 29-CONTEXT.md verification decision. Copy-only change, no behavior to eyeball. Grep-clean + tsc-scope-clean + push-to-main is the close. The deploy still happens (push triggers auto-deploy), but no human-verify checkpoint was added to the plan and none is required.

## Decisions Made

All decisions were either pre-locked in 29-CONTEXT.md / 29-RESEARCH.md or explicitly written into the plan. None made unilaterally during execution.

Key decisions surfaced into frontmatter:

1. **LD-07 override** for `booking-form.tsx:138` (inert dev comment in scope; runtime line 139 untouched) — pre-locked in CONTEXT.md, audited here.
2. **Tagline drops "Built for X" entirely** rather than swapping audience token — pre-locked in CONTEXT.md, executed verbatim.
3. **README drops "Calendly-style"** (no competitor anchor) plus the parenthetical — pre-locked in CONTEXT.md.
4. **Modifier form `service-business` on FUTURE_DIRECTIONS line 62** for grammatical fit ("service businesses use case" is ungrammatical) — locked in plan Edit C-1 rationale.
5. **`owners` (in-product term-of-art) on FUTURE_DIRECTIONS lines 226 and 232** rather than `service businesses` — locked in plan Edit C-2 / C-3 rationale.
6. **No live smoke / no human-verify checkpoint** — pre-locked in CONTEXT.md verification waiver; restated in plan Task 3 Step 8.

## Deviations from Plan

**One process-level deviation: per-task commits collapsed into one batched content commit.**

- **What the GSD spec defaults to:** atomic per-task commits (`{type}({phase}-{plan}): {task-name}`).
- **What this plan locked instead:** single batched commit for all 7 string swaps across Tasks 1 + 2 + 3 (Task 3 Step 5 explicitly chose "this whole copy pass is one logical unit. Single commit." with the exact `git commit -m` block locked in the plan body).
- **Resolution:** Followed the plan as written, not the GSD default. Plan author had explicit reasoning (Andrew's global "commit after a logical unit of work" preference + 7 tiny string swaps not warranting 3 commits). The plan-locked commit message was used verbatim.
- **Audit:** This deviation is recorded here for traceability. Future copy-only plans should explicitly state their commit strategy in the plan body to avoid the reader needing to reconcile against GSD defaults.

**No content / behavioral deviations.** All edits matched plan-locked text byte-for-byte; all gates passed first try.

---

**Total deviations:** 1 process-level (commit batching, plan-locked, not unilateral).
**Impact on plan:** Zero. Plan executed exactly as written including the explicit single-commit choice.

## Issues Encountered

**None.** First-try success on all four file edits, all three grep gates, and the tsc-scope check. Zero retries, zero blockers, zero authentication gates.

Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` was present at plan start (orthogonal to this plan) and was deliberately NOT staged into either commit — left in working tree exactly as found.

## User Setup Required

None — no external service configuration, no environment variables, no dashboard work. Pure code/copy edit deployed via standard `git push origin main` → Vercel auto-deploy pipeline.

## Next Phase Readiness

**Phase 29 closes with this single-plan execution.** All three BRAND-01 / BRAND-02 / BRAND-03 requirements shipped. Canonical grep gate baseline established at 0; future regressions will be visible immediately if any contributor reintroduces "trade contractor" / "contractor" framing in `app/`, `lib/`, `README.md`, or `FUTURE_DIRECTIONS.md`.

**v1.5 progress:** 4 of 6 plans complete (28-01, 28-02, 28-03, 29-01). 2 remaining plans (Phase 30: Public Booker 3-Column Desktop Layout — BOOKER-01..05).

**Resume next:** Run `/gsd:plan-phase 30` to begin Phase 30 (Public Booker 3-Column Desktop Layout). Per V15-MP-05 lock, keep the conditional mount pattern for `<BookingForm>` (`{selectedSlot ? <BookingForm /> : <prompt>}`) — always-mounted form causes Turnstile token expiry.

**Soft concerns carried forward (unchanged from Phase 28 close):**
- 33 pre-existing tsc errors in `tests/` — still present; still out of scope; address as a separate cleanup pass when convenient.
- `tests/slot-generation.test.ts:31` JSDoc historical reference to `buffer_minutes` — still present; still optional future docs scrub.

---
*Phase: 29-audience-rebrand*
*Completed: 2026-05-04*
