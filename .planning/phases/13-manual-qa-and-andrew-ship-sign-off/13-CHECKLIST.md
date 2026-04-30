# Phase 13 Manual QA Checklist

**Session start:** [TIMESTAMP — fill at start of Plan 13-02]
**Driver:** Andrew (executor) + Claude (proposer / scribe)
**Pass bar:** Strict by default. Any QA item may be downgraded to "deferred to v1.2" by Andrew at the time of surface — captured in the Notes column and propagated to FUTURE_DIRECTIONS.md §8.

## Pre-flight (Plan 13-01 artifacts)

- [x] Item 0: NSI mark asset swap — **DEFERRED** to v1.2 per Andrew explicit skip 2026-04-29 ("isn't really all that important"). Placeholder (105 bytes solid-navy) remains at `public/nsi-mark.png`. Email header bands in QA-12 surface 4 will render the placeholder; **do not fail QA-12 surface 4 on placeholder** — accepted defect, v1.2 swap.
- [x] Item 1: Phase 10 Plan 10-05 5-step sequence complete (email-confirm toggle ON; Andrew login still works) — completed 2026-04-29. Step 1 SELECT result: `email_confirmed_at = 2026-04-25 02:44:37+00` (lockout-safe). Steps 2-4 in Supabase Dashboard. Step 5: Andrew login to /app confirmed.
- [x] Item 2: Test User 3 created in auth.users + accounts row INSERTed (Phase 10 Plan 10-09) — uuid: `c692a86d-ec65-4ce0-9c77-837d3f75b7d3`, email: `andrew.wegner.3@gmail.com`, slug: `nsi-rls-test-3`, name: `NSI RLS Test 3`. Note: plan asked for `nsi-rls-test-3@andrewwegner.example` placeholder domain; Andrew used a real Gmail variant (works the same; bonus = real inbox if Test User 3 ever needs to receive email).
- [x] Item 3: 3 distinct branding profiles applied to nsi / nsi-rls-test / nsi-rls-test-3 — verified 2026-04-29 via SQL. Pre-13-01 NSI tuple captured for restoration: `(#5ABF6E, #FFFFFF, subtle, #10B981, subtle)`. New branding live: A=navy, B=magenta, C=emerald-null.
- [x] Item 4: capacity=3 "Capacity Test" event type live on `/nsi-rls-test/capacity-test` — verified 2026-04-29 (200 OK). event_type id `5344a500-acd5-4336-b195-ebea16f8dec4`. Direct INSERT used (Andrew elected — bypasses Server Action validation but smoke verified). Bonus: also seeded Test User 2's missing Mon-Fri 9am-5pm availability_rules so slots actually render.
- [x] Item 5: 13-CHECKLIST.md scaffolded (this file)
- [x] Item 6: Production deploy current — commit SHA `ed81ac7` (post Plan 13-01 push, 2026-04-29). Verified: `/auth/confirm?token_hash=test` → 307 (route live), `/nsi` → 200, `/nsi-rls-test/capacity-test` → 200.

**Hard-cache-clear note:** Before starting QA-12, hit Ctrl+Shift+R on every production tab open during Phase 12.6 to defeat client-side cache (RESEARCH.md Pitfall 5).

## Marathon Criteria (Plan 13-02)

**Marathon waived by Andrew 2026-04-30** — verbatim instruction "consider everything good. close out the milestone." All five QA-09..QA-13 criteria are recorded as DEFERRED-TO-V1.2 (not silently skipped, not marked PASS). Pre-flight prerequisites (Plan 13-01) were established and remain available for v1.2 marathon execution. Code-level verification is the ship gate; live multi-surface human verification carries forward.

| # | Criterion | Status | Timestamp | Notes |
|---|-----------|--------|-----------|-------|
| QA-09 | Signup → email-verify → onboarding wizard → first booking E2E | DEFERRED-V1.2 | 2026-04-30 | Andrew waived marathon at milestone close-out. Code-level verification: Phase 10 verifier passed 9/9 plans 2026-04-28 |
| QA-10 | Multi-tenant UI isolation (login as Test User 2, ZERO of Andrew's data on 7 surfaces) | DEFERRED-V1.2 | 2026-04-30 | Andrew waived marathon. Backend RLS: `tests/rls-cross-tenant-matrix.test.ts` 24 N=3 cases passing. UI-layer human walkthrough deferred |
| QA-11 | Capacity=3 E2E (3 succeed, 4th SLOT_CAPACITY_REACHED) | DEFERRED-V1.2 | 2026-04-30 | Andrew waived marathon. Code-level: Phase 11 verifier passed 8/8 plans; 148 tests + pg-driver race test (CAP-06) skip-guarded ready when SUPABASE_DIRECT_URL is set |
| QA-12 | 3-account branded smoke × 4 surfaces (12 spot-checks + 3 emails = 15 total) | DEFERRED-V1.2 | 2026-04-30 | Andrew waived marathon. Phase 12.6 was Andrew-live-approved on Vercel deploy 2026-04-29 (single-account smoke). 3-account A/B/C cross-render deferred. Branding profiles remain seeded on prod for v1.2 |
| QA-13 | EmbedCodeDialog at 320 / 768 / 1024 (no horizontal overflow) | DEFERRED-V1.2 | 2026-04-30 | Andrew waived marathon. Code-level: Plan 12-05 EmbedCodeDialog locked to `sm:max-w-2xl` (commit `2dc5ae1`). Multi-viewport human verification deferred |

## QA-12 Sub-table (3 accounts × 4 surfaces + 3 emails)

**All 15 cells DEFERRED-V1.2 per marathon waiver.** Branding profiles remain on prod for v1.2 execution.

| Account | Dashboard | Public booking | Embed | Email header band |
|---------|-----------|----------------|-------|-------------------|
| A — nsi (navy combo: brand_primary=#0A2540, bg=#F8FAFC, shade=subtle, sidebar=#0A2540) | DEFERRED-V1.2 | DEFERRED-V1.2 | DEFERRED-V1.2 | DEFERRED-V1.2 |
| B — nsi-rls-test (magenta combo: brand_primary=#EC4899, bg=#FDF2F8, shade=bold, sidebar=#EC4899) | DEFERRED-V1.2 | DEFERRED-V1.2 | DEFERRED-V1.2 | DEFERRED-V1.2 |
| C — nsi-rls-test-3 (null combo: brand_primary=#22C55E, bg=null, shade=none, sidebar=null) | DEFERRED-V1.2 | DEFERRED-V1.2 | DEFERRED-V1.2 | DEFERRED-V1.2 |

## Deferred Check Replays (from MILESTONE_V1_1_DEFERRED_CHECKS.md)

| Source phase / item | Replay outcome | Notes |
|---------------------|----------------|-------|
| Phase 10 / 10-05 (5-step) | ✓ Done 2026-04-29 | Item 1 above (Plan 13-01 Task 3) |
| Phase 10 / 10-08 email-change E2E | __ | OPPORTUNISTIC — log if exercised; else defer to v1.2 |
| Phase 10 / 10-09 Test User 3 | ✓ Done 2026-04-29 | Item 2 above (Plan 13-01 Task 4) |
| Phase 11 / 11-08 capacity badge ('X spots left') | __ | Folds into QA-11 step 3 |
| Phase 11 / 11-08 409 message branching (SLOT_CAPACITY_REACHED) | __ | Folds into QA-11 step 4 |
| Phase 11 / 11-06 pg-driver race test (CAP-06) | __ | OPTIONAL — requires SUPABASE_DIRECT_URL |
| Phase 11 / 11-07 CAP-09 over-cap modal | __ | OPPORTUNISTIC — log if exercised |
| Phase 12 / item #1 Inter font load | __ | Phase 9 captured; not retrying |
| Phase 12 / item #2 bg-gray-50 render | __ | Folds into QA-12 surface 1 (Account C) |
| Phase 12 / item #3 Gradient backdrop sweep | __ | Folds into QA-12 (3 shades across 3 accounts) |
| Phase 12 / item #4 Live branding editor update | __ | Folds into QA-12 surface 1 step 3 |
| Phase 12 / item #5 Home tab calendar + Sheet drawer | __ | OPPORTUNISTIC during QA-09 |
| Phase 12 / item #6 Auth pages split-panel responsive | __ | OPPORTUNISTIC during QA-09 signup form |
| Phase 12 / item #7 Email branded header in real inbox | __ | Folds into QA-12 surface 4 |
| Phase 12 / item #8 NSI mark image swap | DEFERRED — see Deferrals to v1.2 row | (Andrew explicit skip 2026-04-29) |
| Phase 12 / item #9 EmbedCodeDialog viewports | __ | Equals QA-13 |
| Phase 12 / item #10 Phase 11 regression under branded chrome | __ | Folds into QA-11 + QA-12 surface 1 |
| Phase 12.5 / item #1 chrome_tint_intensity column unaffected | __ | Implicit via QA-12 not erroring |
| Phase 12.5 / item #2 FloatingHeaderPill removal regression | __ | OPPORTUNISTIC — confirm during QA-12 surface 1 |
| Phase 12.5 / item #3 Mobile hamburger trigger | __ | OPPORTUNISTIC during QA-13 at 320px |
| Phase 12.6 / items #1-#7 | LIVE-VERIFIED 2026-04-29 (Andrew approval) | No retry needed |
| Phase 12.6 / item #8 NSI mark | DEFERRED — see Deferrals to v1.2 row | (Andrew explicit skip 2026-04-29) |

## Test Artifacts Created During Marathon

Marathon waived — no test bookings, no throwaway signups created.

Pre-flight artifacts from Plan 13-01 remain on prod (intentional, available for v1.2 marathon):
- Test User 3: `andrew.wegner.3@gmail.com` (uuid `c692a86d-ec65-4ce0-9c77-837d3f75b7d3`, slug `nsi-rls-test-3`)
- Capacity-test event_type: `5344a500-acd5-4336-b195-ebea16f8dec4` on `/nsi-rls-test/capacity-test`
- 3 distinct branding profiles applied to nsi / nsi-rls-test / nsi-rls-test-3 (navy / magenta / emerald-null)

**Pre-13-01 NSI branding values (for restoration if Andrew chooses to revert post-v1.1):** `brand_primary='#5ABF6E', background_color='#FFFFFF', background_shade='subtle', sidebar_color='#10B981', chrome_tint_intensity='subtle'`. KEPT (Andrew did not request restoration at close-out).

**Cleanup decision:** KEEP all pre-flight artifacts on prod for future v1.2 marathon execution.

## Deferrals to v1.2

*Any criterion downgraded by Andrew during the session — captured here with reason. Each row is propagated to FUTURE_DIRECTIONS.md §8 by Plan 13-03.*

| Item | Reason | Recommended v1.2 action |
|------|--------|-------------------------|
| NSI mark image swap (Phase 12.6 deferred #8) | Andrew explicit skip during Plan 13-01 Task 1: "isn't really all that important" | Replace `public/nsi-mark.png` placeholder (105 bytes solid-navy) with final NSI brand collateral; expected ≤10KB PNG, 64-128px square, transparent background. Affects email header band footer rendering on all transactional emails. |
| (more rows filled during 13-02) | | |

## Sign-off

- [x] Andrew reviewed 13-CHECKLIST.md and FUTURE_DIRECTIONS.md §8 (waived marathon at milestone close-out)
- [x] Andrew explicit verbal sign-off — verbatim 2026-04-30: **"consider everything good. close out the milestone"**
- **Sign-off timestamp:** 2026-04-30
- **Sign-off commit:** _populated post-commit; see git log for `docs(13): complete phase + close v1.1 milestone`_
