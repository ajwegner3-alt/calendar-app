---
phase: 17-public-surfaces-and-embed
plan: 09
status: complete
completed: 2026-04-30
---

# 17-09 Visual Gate — SUMMARY

## What was verified

Phase 17 deployed to live Vercel preview at https://calendar-app-xi-smoky.vercel.app/ via push of commits 9e36f58..3cb41e2 (all Plans 17-01..08 already atomically committed). Andrew eyeballed all 10 gates on live preview and approved 2026-04-30.

## Deploy details

- Pushed `8f3220b..3cb41e2` to `main` → triggered Vercel preview build
- Probe: `/nsi` HTTP 200, `/nsi-rls-test` HTTP 200 — deploy succeeded
- No fix-up commits required between deploy and approval

## Gate results — 10/10 passed

| # | Gate | Status |
|---|------|--------|
| 1 | NSI public landing — gray-50 + blue glow + glass pill + footer | ✓ |
| 2 | Magenta public landing — magenta glow | ✓ |
| 3 | Emerald + navy accounts color spectrum | ✓ |
| 4 | Booking slot picker — magenta selected, orange day dot (CP-07) | ✓ |
| 5 | Confirmation page — magenta checkmark, v1.2 card | ✓ |
| 6 | Cancel + Reschedule token flows — PublicShell | ✓ |
| 7 | TokenNotActive — minimal bg-gray-50 (PUB-11) | ✓ |
| 8 | Not-found — bg-gray-50 + centered card | ✓ |
| 9 | Embed widget — bg-gray-50 + customer-color slot (CP-05) + footer inside iframe | ✓ |
| 10 | Owner shell + auth no-regression | ✓ |

## Critical fixes verified live

- **MP-10:** No dark smear on bg-gray-50 with magenta/emerald — blob 2 `transparent` terminus working
- **CP-05:** Embed slot picker selected color matches host account (NSI blue on `/embed/nsi`, magenta on `/embed/nsi-rls-test`) — embed's own `--primary` override propagates inside iframe
- **CP-07:** Calendar day-has-slots dot still orange (`--color-accent` untouched)
- **BackgroundGlow blob offsets:** translated cleanly to no-sidebar full-viewport containing block — no re-tuning needed

## Phase 17 ready for completion

ROADMAP/STATE/REQUIREMENTS to be updated by orchestrator in phase-completion commit.
