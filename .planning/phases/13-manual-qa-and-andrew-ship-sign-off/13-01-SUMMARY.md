---
plan: "13-01"
phase: 13-manual-qa-and-andrew-ship-sign-off
status: complete-with-deferral
completed: 2026-04-29
---

# Plan 13-01 Summary — Pre-QA Prerequisites + Pre-Flight Fixes

## Outcome

Production environment + planning workspace brought to known-good state for Plan 13-02 marathon QA. Six of eight tasks executed cleanly; one task deferred by Andrew; one task substituted (direct INSERT instead of browser form-fill).

## Pre-flight items (final state)

- **Item 0 — NSI mark image swap:** DEFERRED to v1.2. Andrew explicit skip 2026-04-29 ("isn't really all that important"). Placeholder (105 bytes solid-navy) remains at `public/nsi-mark.png`. Email header bands in QA-12 surface 4 will render placeholder; do not fail QA-12 surface 4 on this — accepted defect, captured in 13-CHECKLIST.md "Deferrals to v1.2" table.
- **Item 1 — Phase 10 Plan 10-05 5-step email-confirm sequence:** ✓ Done. Step 1 SELECT confirmed `email_confirmed_at = 2026-04-25 02:44:37+00` (lockout-safe). Toggle ON, redirect URLs whitelisted, all 4 email templates updated to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` pattern (Confirm signup → next=/onboarding; Reset Password → recovery; Magic Link → magiclink; Confirm Email Change → email_change). Step 5: Andrew login to /app verified post-toggle.
- **Item 2 — Test User 3 created:** ✓ Done. UUID `c692a86d-ec65-4ce0-9c77-837d3f75b7d3`, email `andrew.wegner.3@gmail.com` (Andrew chose real Gmail variant; plan suggested `nsi-rls-test-3@andrewwegner.example` — works the same since the test helper reads env vars, slug `nsi-rls-test-3` is what tests assert against). Plan 10-03 trigger created stub; DELETEd stub then INSERT'd proper row (slug=`nsi-rls-test-3`, name=`NSI RLS Test 3`, timezone=`America/Chicago`, onboarding_complete=true). Bonus deviation: Test User 2's accounts row had stale `onboarding_complete=false` from a prior session — flipped to `true` so QA-10 walkthrough lands on `/app` instead of `/onboarding`. Credentials written to `.env.test.local` (gitignored). Quoted password in env file (dotenv treats unquoted `#` prefix as comment marker — quote required for passwords starting with `#`).
- **Item 3 — 3 distinct branding profiles:** ✓ Done. Pre-13-01 NSI tuple captured for restoration: `(brand_primary='#5ABF6E', background_color='#FFFFFF', background_shade='subtle', sidebar_color='#10B981', chrome_tint_intensity='subtle')`. Applied:
  - Account A `nsi`: navy combo (`#0A2540` / `#F8FAFC` subtle / `#0A2540`)
  - Account B `nsi-rls-test`: magenta combo (`#EC4899` / `#FDF2F8` bold / `#EC4899`)
  - Account C `nsi-rls-test-3`: emerald-only regression-safe path (`#22C55E` / null / none / null)
- **Item 4 — capacity=3 event live:** ✓ Done. event_type id `5344a500-acd5-4336-b195-ebea16f8dec4` on `/nsi-rls-test/capacity-test` (200 OK). Direct INSERT used at Andrew's election (bypasses Server Action validation; smoke verified via curl). Bonus deviation: Test User 2 had ZERO availability_rules (wizard never ran) — seeded standard Mon-Fri 9am-5pm rules (start_minute=540, end_minute=1020) so slots actually render in the picker.
- **Item 5 — 13-CHECKLIST.md scaffolded:** ✓ Done. Located at `.planning/phases/13-manual-qa-and-andrew-ship-sign-off/13-CHECKLIST.md`. All deferral pre-populates baked in.
- **Item 6 — Production deploy current:** ✓ Done. Pushed HEAD `ed81ac7` to origin/main. Smoke curls pass: `/auth/confirm` → 307, `/nsi` → 200, `/nsi-rls-test/capacity-test` → 200.

## Commits

- `e0e8e9a` docs(13): commit phase 13 plan documents (13-01, 13-02, 13-03)
- `ed81ac7` docs(13-01): scaffold 13-CHECKLIST.md session-of-record

(No commits for Tasks 2/3/4/5/6 — those modified production environment / data, not local files.)

## Test impact

- Baseline before plan: 255 passing + 26 skipped (281 total).
- After plan: 277 passing + 4 skipped (281 total).
- Delta: +22 tests un-skipped — the 24 N=3 RLS matrix cases activated when `TEST_OWNER_3_*` env vars landed (2 unrelated cases still skip — pre-existing, not Phase 13 scope).

## Deviations from plan-as-written

1. **Task 1 (NSI mark) deferred** — Andrew explicit skip; v1.2 propagation captured in checklist + this summary.
2. **Task 4 email choice** — Andrew used `andrew.wegner.3@gmail.com` instead of plan-specified `nsi-rls-test-3@andrewwegner.example`. Test helper reads env vars, slug is what matters; works identically. Bonus: real inbox if Test User 3 ever needs to receive email.
3. **Task 4 password env quoting** — Initial `.env.test.local` write left password unquoted. dotenv treats unquoted `#` prefix as comment, parsing password as empty (length 0). Diagnosed via `node -e` env-load probe; fixed by wrapping value in double-quotes. Test count delta confirmed fix (matrix went from 24-skipped to 24-passing).
4. **Task 4 bonus — Test User 2 onboarding_complete flag** — Found stale `false` value during account state audit; flipped to `true` so QA-10 walkthrough doesn't get redirected to onboarding wizard. Not in plan but unblocks QA-10.
5. **Task 5 chrome_tint_intensity untouched** — Per plan, this column is deprecated post-Phase 12.6 and persists for backward compat only. Left as-is on all 3 accounts (`subtle` default).
6. **Task 6 — direct INSERT at Andrew's election** — Skipped browser form-fill in favor of direct SQL. Bypasses CAP-09 capacity-decrease modal exercise but that wasn't required for Plan 13-01 scope (only event creation, not modification).
7. **Task 6 bonus — availability_rules seeding** — Test User 2 had no availability rules (wizard never ran). Seeded Mon-Fri 9-5 directly so QA-11 capacity test has bookable slots.
8. **Task 8 plan-doc commit** — Plan documents (`13-01-PLAN.md`, `13-02-PLAN.md`, `13-03-PLAN.md`) were drafted during /gsd:plan-phase 13 but never committed to origin. Landed them as part of this plan's commit batch.

## Issues / deferrals captured for Plan 13-03 FUTURE_DIRECTIONS.md

- **NSI mark image swap (Phase 12.6 deferred #8):** Andrew explicit skip; recommended v1.2 action: replace `public/nsi-mark.png` 105-byte placeholder with final NSI brand collateral (≤10 KB PNG, 64-128px square, transparent background). Affects email header band footer rendering on all transactional emails.

## What Plan 13-02 inherits

- Three production accounts with distinct branding ready for QA-12 walkthrough
- Test Users 1/2/3 all signed-in-able with credentials available
- Capacity=3 event live with availability for QA-11 race testing
- Email-confirm toggle ON with all 4 templates routing through canonical `/auth/confirm` handler — QA-09 fresh signup will exercise this
- Deploy SHA `ed81ac7` is current on `https://calendar-app-xi-smoky.vercel.app`
- 13-CHECKLIST.md scaffolded with all deferrals pre-populated
- 277/281 tests passing (no regressions; +22 un-skipped)
