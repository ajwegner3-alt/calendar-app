# Phase 40: Dead-Code Audit - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Install `knip`, configure it with an explicit ignore list, run it against the full codebase, and surgically remove dead code under per-item Andrew sign-off — leaving `next build` and the Vitest suite green throughout. After cleanup lands, re-run the v1.7 manual QA regressions (Phase 38 A-D + Phase 39 A-C) on production as the v1.7 milestone ship-gate.

Includes: knip install + config, audit report generation, per-item review, atomic surgical removals, decision-log archival, knip CI gate, final v1.7 manual QA pass, milestone close.

Excludes: any new features, refactors that go beyond removing knip-flagged items, SQL migration file edits, behavioral changes to surviving code.

</domain>

<decisions>
## Implementation Decisions

### Knip scope (all four categories audited)
- **Unused files** — whole modules nothing imports
- **Unused exports & types** — named exports/types defined but never imported
- **Unused dependencies** — packages in `package.json` nothing imports
- **Duplicate exports & enum members** — re-exports / enum entries with no consumers

### Knip configuration
- **Standard defaults** — use knip's built-in Next.js plugin + auto-detected entry points; minimal config, tightest signal-to-noise.
- **Strictness:** not `--strict`. Standard mode runs the audit; CI gate (added end-of-phase) decides whether to fail on warnings.
- **Pre-ignore list (minimal):** only the three known items
  - `components/booking/slot-picker.tsx` (per Plan 30-01 Rule 4)
  - test mock helpers
  - `tests/__mocks__/`
- **Everything else flows through review** — no preemptive ignores for migrations, deviation docs, vitest config, fixtures. Andrew makes the REMOVE/KEEP/INVESTIGATE call per item.
- **SQL migration files:** untouched per success criterion #3 (locked from ROADMAP, not ignored — they should not appear in the report at all because knip doesn't analyze SQL).

### Knip in CI (post-phase)
- After all removals land, add `npx knip` to CI as a PR gate so future PRs that introduce dead code fail at review time.
- Implementation detail (workflow file edits, exit-code policy) is **Claude's discretion**; the binding decision is "CI gate exists post-phase."

### Review workflow
- **Format:** Markdown checklist `40-KNIP-REPORT.md` in the phase folder, one row per finding.
  - Columns: file/export, current location, knip category, recommended verdict, rationale, REMOVE/KEEP/INVESTIGATE checkbox column.
  - Andrew edits the file directly; Claude reads back decisions before any deletion.
- **Pre-seeded recommendations:** Claude inspects each finding (last-touched commit, semantic name, neighboring files, plausible callers) and seeds a recommended verdict + 1-line rationale. Andrew overrides what he disagrees with.
- **Grouping:** Sectioned by knip category (Unused Files → Unused Exports & Types → Unused Dependencies → Duplicate Exports & Enum Members). Mirrors the removal-commit boundaries.
- **Audit log:** Final decisions persist in `40-KNIP-DECISIONS.md` (separate file from the report) — REMOVE list, KEEP list with rationale, any INVESTIGATE→KEEP flips with reason. Committed to phase folder; pairs with the CI gate so future PRs that re-add a known-KEEP item have a documented "this is intentional" trail.

### Commit cadence
- **Granularity:** One commit per knip category — at most 4 chore commits.
  - `chore(40): remove unused files`
  - `chore(40): remove unused exports`
  - `chore(40): remove unused dependencies`
  - `chore(40): remove duplicate exports`
- **Build+test gate between batches:** `next build` AND `vitest run` execute between every category commit. Both must pass before the next batch starts.
  - Pre-existing `tests/bookings-api.test.ts` single failing test is the watermark — anything beyond that is a real regression caused by the removal.
- **Failure recovery:** if `next build` or vitest fails after a batch, `git revert` the failing commit, edit `40-KNIP-DECISIONS.md` to flip the offending items to KEEP with rationale, then continue with remaining batches. Preserves audit trail; avoids per-item bisect.

### INVESTIGATE handling
- Items Andrew marks INVESTIGATE during review are **deep-dived in-phase, not deferred.**
- Claude investigates each: search for dynamic imports, string-keyed references, server-action invocations from form actions, route handler registrations, test usage. Reports back with findings.
- Andrew re-decides as REMOVE or KEEP based on Claude's investigation.
- **Phase 40 does not ship with unresolved INVESTIGATE items** — every finding closes as REMOVE or KEEP.

### False-positive handling
- **Default:** trust knip's static analysis.
- **Verify only suspicious items:** anything that looks like it could be dynamically referenced (string-keyed lookups, route handlers, server actions called from `<form action={...}>`, components looked up by name string) gets a grep verification before deletion. Otherwise the knip recommendation flows through.
- This is the standard knip workflow — leans on the build + tests + (later) deploy-and-eyeball as the safety net.

### Final v1.7 QA scope (after removals land)
- **Re-run Phase 38 A-D** on production (`booking.nsintegrations.com`):
  - Magic-link enumeration safety (unknown email vs. real email return identical responses)
  - 5/hr/IP+email rate-limit silently throttles
  - Supabase ~60s inner cooldown observed (feature, not bug)
  - End-to-end magic-link delivery + Site URL correctness
- **Re-run Phase 39 A-C** on production:
  - 220ms fade+rise animation on first slot pick (CLS = 0)
  - Static skeleton renders pre-pick on desktop + mobile (no false loading spinner)
  - `prefers-reduced-motion` suppresses animation cleanly
  - V15-MP-05 Turnstile lifecycle lock + RHF field persistence on slot re-pick (regression check)
- This is the v1.7 milestone ship-gate, not a separate phase.

### Milestone close
- Phase 40 verifier PASS + final v1.7 QA green → run `/gsd:complete-milestone` to archive v1.7 ROADMAP into `milestones/v1.7-ROADMAP.md`.
- Mirrors the v1.0–v1.6 close pattern documented in STATE.md.

### Claude's Discretion
- Exact `knip.json` schema beyond the locked decisions (entry points, project plugin selection, paths config).
- CI workflow file location + exit-code policy for the post-phase gate (e.g., GitHub Actions vs. Vercel vs. existing CI surface — pick whatever fits the current setup).
- Report row formatting (table vs. nested headings) inside `40-KNIP-REPORT.md`, as long as REMOVE/KEEP/INVESTIGATE state is editable and machine-readable on read-back.
- Order of operations within a single category commit (alphabetical, by file size, by directory) — atomic per category is what matters.
- How to phrase rationale lines in the seeded recommendations.

</decisions>

<specifics>
## Specific Ideas

- `slot-picker.tsx` is the canonical "knip will flag this; never remove it" example — Plan 30-01 Rule 4. Use it as the model for any future explicit-keep with rationale.
- Decision log doubles as the answer to "why is X still in the codebase?" — pairs with the CI gate so future contributors (including future-Claude) can see the audit trail without re-running the analysis.
- Pre-existing single failing Vitest test (`tests/bookings-api.test.ts` fixture mismatch, per STATE.md "Open tech debt") sets the green-watermark — knip removal must not increase failing-test count above 1.
- This phase is the v1.7 ship-gate, not just a cleanup phase. The final QA pass is non-optional.

</specifics>

<deferred>
## Deferred Ideas

- None raised during discussion. Discussion stayed within phase scope — no scope creep to capture.

</deferred>

---

*Phase: 40-dead-code-audit*
*Context gathered: 2026-05-08*
