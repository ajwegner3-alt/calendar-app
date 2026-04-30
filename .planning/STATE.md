# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-04-30 — **v1.2 roadmap created.** 8 phases (14-21) mapped; 92/92 requirements covered. Ready to plan Phase 14.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-30 for v1.2 scoping)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.2 — NSI Brand Lock-Down + UI Overhaul. Reference UI: `lead-scoring-with-tools/website-analysis-tools/` (BackgroundGlow, Header, dashboard layout, globals.css).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.2 — NSI Brand Lock-Down + UI Overhaul (started 2026-04-30)
**Phase:** Phase 14 — Typography + CSS Token Foundations (next up)
**Plan:** —
**Status:** Roadmap created. Ready to plan Phase 14.
**Last activity:** 2026-04-30 — v1.2 roadmap written (Phases 14-21; 92 requirements mapped).

**v1.2 Phase Progress:**

```
Phase 14 [ ] Typography + CSS Token Foundations
Phase 15 [ ] BackgroundGlow + Header Pill + Owner Shell Re-Skin
Phase 16 [ ] Auth + Onboarding Re-Skin
Phase 17 [ ] Public Surfaces + Embed
Phase 18 [ ] Branding Editor Simplification
Phase 19 [ ] Email Layer Simplification
Phase 20 [ ] Dead Code + Test Cleanup
Phase 21 [ ] Schema DROP Migration
```

Progress: [░░░░░░░░░░] 0% (0 / 8 phases complete)

## Performance Metrics

**v1.2 velocity:** Not yet started.

**v1.1 reference velocity (for calibration):**
- 34 plans across 6 phases (Phases 10-13 incl. 12.5 + 12.6)
- 3 days from kickoff to sign-off

## Accumulated Context

### v1.2 Visual Locks (frozen at scoping — repeat in every phase plan preamble)

1. JIT pitfall: runtime hex via `style={{ ... }}` only — never `bg-[${color}]`
2. Email strategy: solid-color-only table band — no CSS gradients in email HTML
3. CSP: lives only in `proxy.ts`, never `next.config.ts`
4. Two-stage owner auth: RLS pre-check before service-role mutation
5. `background_shade` ENUM type must be dropped alongside the column
6. DROP migration = two-step deploy (code-stop-reading, wait 30 min, then DROP SQL)

### Key v1.2 Scoping Decisions (resolved before research)

- `brand_accent` → DROPPED. v1.2 ships `brand_primary` only. Requirements reflect this.
- `BrandedPage` → REPLACED with new `PublicShell` component. Clean break.
- Marathon QA (QA-09..QA-13) + Resend + Vercel Pro → RE-deferred to v1.3.
- Auth additions (OAuth, magic-link, etc.) → RE-deferred to v1.3.

### Pending Todos

None tracked for v1.2 yet.

### Active Blockers

None. Roadmap created. All 92 requirements mapped. Ready to execute Phase 14.

## Session Continuity

**Last session:** 2026-04-30 — v1.2 roadmap creation via `gsd-roadmapper`.
**Stopped at:** Roadmap written. Requirements traceability populated. Next: `/gsd:plan-phase 14`.
**Resume:** Run `/gsd:plan-phase 14` to begin Typography + CSS Token Foundations planning.

**Files of record:**
- `.planning/PROJECT.md` — what + why (v1.2 scoping current)
- `.planning/ROADMAP.md` — v1.2 Phases 14-21 (just written)
- `.planning/REQUIREMENTS.md` — 92 v1.2 requirements, traceability populated
- `.planning/STATE.md` — this file
- `.planning/research/SUMMARY.md` — synthesizer output (8-phase recommendation)
- `.planning/research/ARCHITECTURE.md` — migration map + build order
- `.planning/research/PITFALLS.md` — critical pitfalls + phase mappings
