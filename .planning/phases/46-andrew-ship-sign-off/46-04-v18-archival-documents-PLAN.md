---
phase: 46-andrew-ship-sign-off
plan: "46-04"
type: execute
wave: 3
depends_on: ["46-03"]
files_modified:
  - FUTURE_DIRECTIONS.md
  - .planning/milestones/v1.8-ROADMAP.md
  - .planning/ROADMAP.md
autonomous: true
must_haves:
  truths:
    - "FUTURE_DIRECTIONS.md has a new `## v1.8 Stripe Paywall + Login UX Polish — Delta` section APPENDED to the end (no prior section renumbered or rewritten)"
    - "The v1.8 section captures all 4 Known Limitation categories required by CONTEXT.md (Branding tier, BILL-24 partial, PREREQ-03 DNS, Stripe API version pin)"
    - "The v1.8 section captures the schema_migrations Technical Debt resolution (Phase 46-01)"
    - "`.planning/milestones/v1.8-ROADMAP.md` exists and mirrors the v1.7-ROADMAP.md structure (top-level # heading, Status SHIPPED, Phases range, Total Plans count, Overview, per-phase blocks)"
    - "ROADMAP.md v1.8 section is collapsed to a one-line entry matching the v1.0..v1.7 pattern, with the in-progress 🚧 marker flipped to ✅"
    - "Total v1.8 plan count = 32 (Phase 41 4 + Phase 42 4 + Phase 42.5 6 + Phase 42.6 3 + Phase 43 2 + Phase 44 5 + Phase 45 3 + Phase 46 5) — verify by re-tallying from ROADMAP.md before writing"
  artifacts:
    - path: "FUTURE_DIRECTIONS.md"
      provides: "v1.8 delta section appended with Known Limitations + Technical Debt"
      contains: "v1.8 Stripe Paywall"
    - path: ".planning/milestones/v1.8-ROADMAP.md"
      provides: "Full v1.8 milestone archive mirroring v1.7-ROADMAP.md structure"
      contains: "SHIPPED"
      min_lines: 80
    - path: ".planning/ROADMAP.md"
      provides: "Collapsed v1.8 entry as a one-line completed milestone bullet"
      contains: "v1.8 Stripe Paywall"
  key_links:
    - from: ".planning/ROADMAP.md collapsed v1.8 entry"
      to: ".planning/milestones/v1.8-ROADMAP.md"
      via: "Markdown link `[`milestones/v1.8-ROADMAP.md`](./milestones/v1.8-ROADMAP.md)`"
      pattern: "milestones/v1.8-ROADMAP.md"
    - from: "FUTURE_DIRECTIONS.md v1.8 § Technical Debt"
      to: ".planning/phases/46-andrew-ship-sign-off/46-01-SUMMARY.md"
      via: "narrative reference to Phase 46-01 schema_migrations repair"
      pattern: "46-01|schema_migrations"
---

<objective>
After Andrew signs off on 46-VERIFICATION.md (status=passed), produce the three v1.8 archival documents: (1) FUTURE_DIRECTIONS.md v1.8 append, (2) `.planning/milestones/v1.8-ROADMAP.md` archive file, (3) ROADMAP.md v1.8 section collapse to one-liner. No code touched.

Purpose: These are the durable v1.8 ship artifacts. FUTURE_DIRECTIONS.md captures what we shipped and what's deferred; the milestone archive preserves full phase detail before the active ROADMAP collapses; the collapsed ROADMAP keeps the active doc tight.

Output: Three updated/created markdown files, ready for plan 46-05 to commit and tag.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/46-andrew-ship-sign-off/46-CONTEXT.md
@.planning/phases/46-andrew-ship-sign-off/46-RESEARCH.md
@.planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md
@.planning/phases/46-andrew-ship-sign-off/46-01-SUMMARY.md

@FUTURE_DIRECTIONS.md
@.planning/milestones/v1.7-ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Append v1.8 section to FUTURE_DIRECTIONS.md</name>
  <files>FUTURE_DIRECTIONS.md</files>
  <action>
Read FUTURE_DIRECTIONS.md in full. Identify the LAST section header (per RESEARCH.md §8 it should be `## Phase 36: Resend Backend — Activation Steps (Deferred from Phase 36)`).

Append the following section to the END of the file (after that last section, with one blank line separator). DO NOT renumber, rewrite, or re-order any prior section.

```markdown
## v1.8 Stripe Paywall + Login UX Polish — Delta

**Shipped:** <date Andrew signed off — read from 46-VERIFICATION.md frontmatter `signoff_at`>
**Phases:** 41-46 + 42.5 + 42.6

### Known Limitations

1. **Branding tier non-Stripe path (consult-only):** No `plan_tier = 'branding'` value exists in DB. The Branding card CTA links to `NSI_BRANDING_BOOKING_URL` (`https://booking.nsintegrations.com/nsi/branding-consultation`) per LD-16. No in-app upgrade flow exists. Activation requires personal onboarding by Andrew. In-app Branding upgrade flow is v1.9+ scope.

2. **BILL-24 partial (2/4 emails shipped):** The trial-ending email (3 days out) and payment-failed email shipped in Phase 44. The welcome-to-paid email and account-locked email were de-scoped per Phase 44 CONTEXT.md narrowing and are deferred to v1.9.

3. **PREREQ-03 Resend DNS activation deferred:** The Resend backend framework shipped in Phase 36. Live activation is gated on DNS verification via Namecheap (SPF/DKIM/DMARC) + Resend domain approval. See `## Phase 36: Resend Backend — Activation Steps (Deferred from Phase 36)` above for the step-by-step.

4. **Stripe API version pin (LD-01):** `stripe@22.1.1` + `apiVersion: '2026-04-22.dahlia'` are pinned forever in `lib/stripe/client.ts`. Do NOT upgrade either without auditing structural changes — this API version moved `invoice.subscription` to `invoice.parent.subscription_details.subscription`, and the webhook handlers depend on that path. **Revisit trigger:** when Stripe SDK forces an upgrade (e.g., `stripe@22.1.1` is sunset) or the `2026-04-22.dahlia` API version is end-of-lifed by Stripe.

### Technical Debt

- **schema_migrations dormant entries (RESOLVED in Phase 46-01):** Migrations for Phases 36, 37, and 41 were applied via Supabase MCP `apply_migration` without going through `supabase db push`, leaving them absent from `supabase_migrations.schema_migrations` in production. Repaired in Phase 46-01 via `npx supabase migration repair {VERSION} --linked --status applied` for each dormant version. See `.planning/phases/46-andrew-ship-sign-off/46-01-SUMMARY.md` for the audit log.

- **Pre-existing schema_migrations orphan rows (UNCHANGED — locked workaround):** Three orphan rows (`20251223162516`, `20260419144234`, `20260419144302`) remain in production `schema_migrations` from before Phase 9. They cause `supabase db push --linked` to fail with "Remote migration versions not found." The locked workaround for any future migration apply is `supabase db query --linked -f <file>`. See `## 2. Assumptions & Constraints` above (and Phase 9 SUMMARY) for the original decision context.
```

Replace `<date Andrew signed off — read from 46-VERIFICATION.md frontmatter signoff_at>` with the actual value from 46-VERIFICATION.md frontmatter.

Verify after writing:
```bash
tail -50 FUTURE_DIRECTIONS.md
```
Should show the new section at the bottom; prior sections unchanged.
  </action>
  <verify>
- `grep -n "v1.8 Stripe Paywall" FUTURE_DIRECTIONS.md` returns exactly one match in the new section.
- `wc -l FUTURE_DIRECTIONS.md` shows line count increased (delta only — no deletions from prior content).
- All 4 Known Limitation categories present (Branding tier, BILL-24 partial, PREREQ-03 DNS, Stripe API version pin) — `grep -E "Branding tier|BILL-24|PREREQ-03|Stripe API version pin" FUTURE_DIRECTIONS.md` shows 4+ matches.
- schema_migrations Technical Debt section present.
  </verify>
  <done>
FUTURE_DIRECTIONS.md has v1.8 delta appended, no prior content disturbed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create `.planning/milestones/v1.8-ROADMAP.md` archive</name>
  <files>.planning/milestones/v1.8-ROADMAP.md</files>
  <action>
Read `.planning/milestones/v1.7-ROADMAP.md` to study the exact archive structure (heading, status block, overview paragraph(s), per-phase blocks with Goal/Depends on/Requirements/Plans list).

Read `.planning/ROADMAP.md` and locate every v1.8 phase block (Phase 41, 42, 42.5, 42.6, 43, 44, 45, 46) within the v1.8 milestone section. Copy each phase block verbatim (Goal, Depends on, Requirements, Plans list with checkbox marks, Completed date if present, any Details notes).

Write `.planning/milestones/v1.8-ROADMAP.md` with this structure:

```markdown
# Milestone v1.8: Stripe Paywall + Login UX Polish

**Status:** ✅ SHIPPED <signoff_at date from 46-VERIFICATION.md frontmatter>
**Phases:** 41-46 + 42.5 + 42.6 (8 phases)
**Total Plans:** 30

## Overview

Milestone v1.8 introduced a full Stripe-backed paywall to the platform with three subscription tiers (Basic, Widget, Branding-consult), multi-tier checkout, customer-portal-driven cancel/reactivate/plan-switching, widget feature gating, paywall enforcement with locked-state UX + trial banners, Stripe-triggered transactional emails (trial-ending + payment-failed), login UX polish (OAuth-below-Card, password-first tab, 3-fail magic-link nudge, AUTH-29 enumeration-safety hardening), and a raise of the per-account Gmail quota cap from 200/day to 400/day.

The milestone was structured around the locked decisions captured during the Phase 41 discussion (LD-01..LD-20): a single Stripe Product with 4 Prices, Branding as a non-Stripe consult-CTA, paywall middleware gating `/app/*` only (`/{account}/*` structurally exempt), and `past_due` as a banner-only state (never lockout). Two phases were inserted mid-milestone (42.5 for multi-tier schema + checkout and 42.6 for widget gating) when the original Phase 42 plumbing proved insufficient.

Phase 46 closed the milestone via live UAT against the nsi grandfathered test account on the production deployment in Stripe test mode, covering 14 ROADMAP QA scenarios + rolled-up Phase 44 (email delivery) and Phase 45 (login UX visual) deferred items, plus dormant `schema_migulations` repair for Phases 36/37/41.

**Manual Prerequisites (Andrew action; gated phases):**
- **PREREQ-C** (gated Phase 44 + Phase 46 UAT): Stripe Customer Portal Dashboard config — cancel-at-period-end, plan switching across all 4 Prices, payment-method updates, invoice history. **Status:** ✅ Confirmed complete during Phase 46 UAT.
- **PREREQ-03** (gated Phase 36 Resend backend): Resend domain DNS activation (SPF/DKIM/DMARC via Namecheap + Resend domain approval). **Status:** Deferred — framework shipped, DNS activation outstanding. See `FUTURE_DIRECTIONS.md` § Phase 36: Resend Backend.

## Phases

### Phase 41: Stripe SDK + Schema + Webhook Skeleton

<copy Goal, Depends on, Requirements, Plans block verbatim from ROADMAP.md Phase 41 section>

### Phase 42: Checkout Flow Plumbing

<copy verbatim — note that UI was superseded by Phase 42.5>

### Phase 42.5: Multi-Tier Stripe + Schema (INSERTED)

<copy verbatim>

### Phase 42.6: Widget Feature Gating (INSERTED)

<copy verbatim>

### Phase 43: Paywall Enforcement + Locked-State UX + Trial Banners

<copy verbatim>

### Phase 44: Customer Portal + Billing Settings Polish + Stripe-Triggered Emails

<copy verbatim — note BILL-24 partial (2/4 emails)>

### Phase 45: Login UX Polish + Gmail Quota Raise

<copy verbatim>

### Phase 46: Andrew Ship Sign-Off

<copy verbatim, with Plans list reflecting all 5 actual plans: 46-01 migration repair, 46-02 UAT checklist authoring, 46-03 live UAT execution, 46-04 archival documents, 46-05 tag + sign-off commits. Mark each ✓ shipped with date if applicable.>
```

If `.planning/milestones/` directory does not exist, create it. Verify the existing v1.7 file lives there before writing:

```bash
ls .planning/milestones/
```

The `Total Plans:` field MUST be re-tallied at write time by reading ROADMAP.md Phase blocks (don't trust the must_haves figure of 30 without verification). The current count from grep was: Phase 41=4, Phase 42=4, Phase 42.5=6, Phase 42.6=3, Phase 43=2, Phase 44=5, Phase 45=3, Phase 46=5 plans. Total = 32. Re-tally if any phase plan count changed since planning.
  </action>
  <verify>
- File exists at `.planning/milestones/v1.8-ROADMAP.md`.
- `head -5` shows `# Milestone v1.8:` and `**Status:** ✅ SHIPPED`.
- Every v1.8 phase (41, 42, 42.5, 42.6, 43, 44, 45, 46) appears as a `### Phase N:` block with non-empty Goal/Plans content.
- Structure mirrors v1.7-ROADMAP.md (diff the heading hierarchy).
  </verify>
  <done>
v1.8 milestone archive captures full phase detail before ROADMAP.md collapses.
  </done>
</task>

<task type="auto">
  <name>Task 3: Collapse v1.8 section in ROADMAP.md to one-liner</name>
  <files>.planning/ROADMAP.md</files>
  <action>
Read ROADMAP.md and locate:
1. The in-progress milestone marker at the top: `🚧 **v1.8 Stripe Paywall + Login UX Polish** — Phases 41-46 + inserted 42.5 + 42.6 ...` (around line 13).
2. The full v1.8 milestone body section (containing all the `### Phase N:` blocks for Phases 41-46 + 42.5 + 42.6 plus the milestone-level intro / PREREQ-C block).
3. The roadmap-status footer line(s) (around line 415 / 419) referencing "v1.8 in progress."

Make three edits:

**Edit 1 — Flip the in-progress one-liner to a completed milestone one-liner:**

Replace the existing `🚧 **v1.8 ...` line (the in-progress entry around line 13) with the completed pattern matching v1.0..v1.7 format from RESEARCH.md §6:

```markdown
- ✅ **v1.8 Stripe Paywall + Login UX Polish** — Phases 41-46 + 42.5 + 42.6 (32 plans across 8 phases) — shipped <signoff_at YYYY-MM-DD>. Full archive: [`milestones/v1.8-ROADMAP.md`](./milestones/v1.8-ROADMAP.md).
```

(Verify the plan count `32` by re-tallying; replace with actual value if different. Verify the date from 46-VERIFICATION.md `signoff_at`.)

**Edit 2 — Remove the full v1.8 body section:**

Delete the entire v1.8 milestone body — all `### Phase 41` through `### Phase 46` blocks plus the milestone-level intro narrative and PREREQ-C block that sits within the v1.8 section. The collapsed one-liner from Edit 1 is the only v1.8 trace remaining in the active ROADMAP.

Preserve:
- The header section above v1.0..v1.7 / v1.8.
- v1.0..v1.7 collapsed entries (already collapsed, do not touch).
- Any v1.9+ placeholder sections below v1.8 (if present).
- The roadmap-status footer line(s) at the bottom (Edit 3 covers those).

**Edit 3 — Update the roadmap-status footer line(s):**

The current footer (around line 415, 419, 421) references v1.8 in-progress and Phase 45 SHIPPED 2026-05-12. Add a new top-most footer line documenting Phase 46 ship + v1.8 milestone closure:

```markdown
*Roadmap last updated: <signoff_at YYYY-MM-DD> — Phase 46 SHIPPED. v1.8 milestone ✅ closed. Andrew live-verified 14 ROADMAP QA scenarios + Phase 44/45 deferred items on the production deployment against the nsi grandfathered account in Stripe test mode. schema_migrations repaired for Phases 36/37/41 (Phase 46-01). FUTURE_DIRECTIONS.md v1.8 delta appended. Full milestone archive at `milestones/v1.8-ROADMAP.md`. v1.8.0 git tag annotated and pushed by plan 46-05.*
```

Move the existing `*Roadmap last updated: 2026-05-12 — Phase 45 SHIPPED ...` line below the new entry (the most recent update goes at top).

Run a sanity check after edits:
```bash
grep -n "### Phase 4[12345]" .planning/ROADMAP.md
# Expect ZERO matches — all v1.8 phase blocks have been removed.
grep -n "v1.8 Stripe Paywall" .planning/ROADMAP.md
# Expect exactly TWO matches (one in the collapsed milestone entry, one in the footer line).
```
  </action>
  <verify>
- `grep -n "### Phase 4[123456]" .planning/ROADMAP.md` returns 0 matches (v1.8 phase blocks fully collapsed).
- `grep -n "🚧" .planning/ROADMAP.md` returns 0 matches (no in-progress markers remaining for v1.8).
- The new ✅ one-liner exists and links to `./milestones/v1.8-ROADMAP.md`.
- The Phase 46 SHIPPED footer line is present at the top of the footer block.
  </verify>
  <done>
ROADMAP.md is tight: v1.8 collapsed to one-liner, full archive lives in milestones/v1.8-ROADMAP.md.
  </done>
</task>

</tasks>

<verification>
- FUTURE_DIRECTIONS.md has v1.8 delta appended; no prior section disturbed.
- `.planning/milestones/v1.8-ROADMAP.md` is a complete archive mirroring v1.7-ROADMAP.md structure.
- `.planning/ROADMAP.md` v1.8 section is collapsed to one-liner; in-progress marker is gone; footer documents Phase 46 ship.
- All three files are valid markdown and lint-clean.
- No source code touched.
</verification>

<success_criteria>
1. FUTURE_DIRECTIONS.md contains a `## v1.8 Stripe Paywall + Login UX Polish — Delta` section with all 4 Known Limitations + Technical Debt resolution.
2. `.planning/milestones/v1.8-ROADMAP.md` exists, mirrors v1.7-ROADMAP.md structure, with all 8 phase blocks copied from ROADMAP.md.
3. `.planning/ROADMAP.md` has the v1.8 milestone collapsed to a single one-line entry linking to the archive, the 🚧 marker flipped to ✅, and a Phase 46 SHIPPED footer line.
4. Plan 46-05 can now commit + tag.
</success_criteria>

<output>
After completion, create `.planning/phases/46-andrew-ship-sign-off/46-04-SUMMARY.md` per the GSD summary template noting all three files written and the actual plan-count tally.
</output>
