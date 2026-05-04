# Phase 29: Audience Rebrand - Research

**Researched:** 2026-05-03
**Domain:** Copy / docs cleanup (no runtime behavior)
**Confidence:** HIGH (everything verified via direct file reads + grep)

## Summary

Stale-copy cleanup phase. The audience-token surface is **very small and very contained** — the entire in-scope footprint is 3 files: `app/(auth)/_components/auth-hero.tsx`, `README.md`, and `FUTURE_DIRECTIONS.md`. The "full audience scrub" decision adds one extra match in `booking-form.tsx:138` (the LD-07 dev-comment override) and four "contractor"-context matches in `FUTURE_DIRECTIONS.md`. There are **zero** `<AuthHero>` callsites that pass an audience-bearing string — both callsites only override `headline` and (in signup) `subtext`, and neither override mentions trade contractors. That means swapping the default in `auth-hero.tsx` is sufficient for that file; no callsite edits required. The roadmap-default grep gate (`trade contractor`) is too narrow — the planner should bake in a pattern that also catches audience-context `contractor` while allowlisting the booker-prose phrase `contractor's brand` (which does **not** appear anywhere in the current tree, so the allowlist is precautionary, not load-bearing).

**Primary recommendation:** Touch 3 files (auth-hero.tsx, README.md, FUTURE_DIRECTIONS.md) + 1 dev-comment line (booking-form.tsx:138). Use a 2-pattern grep gate. No callsite changes needed.

## File-by-File Reconnaissance

### 1. `app/(auth)/_components/auth-hero.tsx`

Full read confirmed structure:

- **Line 20** — `headline` default: `"Bookings without the back-and-forth."` — does **NOT** name the audience. Per CONTEXT.md "headline only in scope if it names the audience" → **leave untouched**.
- **Line 21** — `subtext` default: `"A multi-tenant scheduling tool built for trade contractors. Branded booking pages, capacity-aware slots, and email confirmations — done."` — **in scope** (audience swap + Claude's discretion to tighten feature list while in there).
- **Lines 32-43** — Feature `<ul>` with three `<li>` items:
  - L34: `Free for new owners — no card, no trial gates.`
  - L38: `Brand it your way — colors, logo, embed widget.`
  - L42: `Built for trade contractors, by NSI in Omaha.` ← **drop the audience phrase per CONTEXT.md** → `Built by NSI in Omaha.`
- No other audience tokens in this file.

### 2. `<AuthHero>` callsites (full enumeration)

Grep against `app/` returns **exactly two** callsites; neither passes an audience string:

| File:line | Props passed | Audience-bearing? |
|---|---|---|
| `app/(auth)/app/login/page.tsx:31` | `headline="Welcome back to your bookings"` | No — neither names audience nor passes subtext |
| `app/(auth)/app/signup/page.tsx:29-32` | `headline="Start scheduling in minutes"` + `subtext="Create your free account, pick a slug, and you'll have a live booking page before your first coffee."` | No — generic copy, no contractor reference |

**Implication:** "update defaults AND grep all callsites" requirement is satisfied by editing the default in auth-hero.tsx alone. The grep gate will confirm zero callsite matches because there already are zero. **No callsite file edits needed for Phase 29.**

### 3. `README.md`

Single audience-loaded line at the top:

- **Line 3:** `Multi-tenant Calendly-style booking tool for trade contractors (plumbers, HVAC, roofers, electricians). A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.`

Audience tokens on this line:
- `Calendly-style` ← drop per CONTEXT.md (no competitor name)
- `trade contractors (plumbers, HVAC, roofers, electricians)` ← swap to `service businesses`, drop parenthetical entirely
- `a contractor's website` ← swap to something like `a business's website` (this is README marketing prose, not the booker-prose `contractor's brand` allowlist case — the file is owner/dev-facing, in scope)

No other audience tokens in README.md (verified by full file read — only line 3 has them).

### 4. `FUTURE_DIRECTIONS.md`

Three audience-context "contractor" matches (all owner/audience-context, all in scope per "full scrub" decision):

- **Line 62:** `...fine for v1 contractor use case.` → swap to e.g. `service-business use case` or rephrase.
- **Line 226:** `Revisit if contractors report broken-link complaints after promoting their booking page.` → swap `contractors` → e.g. `owners` or `service businesses`.
- **Line 232:** `v1.2 could offer 3–4 template cards (Consultation, Discovery Call, Site Visit, etc.) for contractors to choose from.` → swap `contractors` → e.g. `owners`.

(Note: `Site Visit` example template is fine — it's a template label, not an audience token.)

No `trade contractor` literal matches in FUTURE_DIRECTIONS.md. No `plumbers`/`HVAC`/`roofers`/`electricians` mentions. (`acme-hvac` slug examples in `tests/slug-suggestions.test.ts` and `app/onboarding/step-1-account/account-form.tsx:127,151` are mock fixture data — booker/test surface, **out of scope**, do not touch.)

### 5. `booking-form.tsx:138` (LD-07 override per CONTEXT.md)

```
136:        // V14-MP-01 (Phase 27): cross-event-type overlap (DB EXCLUDE constraint).
137:        // Generic wording — booker has no concept of event types and we do NOT
138:        // leak that the contractor has another appointment.
```

This is an inert dev comment. **Now in scope** per CONTEXT.md LD-07 override. The word `contractor` here describes the owner/audience (it's the owner who has another appointment) → **swap** to e.g. `// leak that the owner has another appointment.` or `// leak that the account has another appointment.` Plan should document the LD-07 deviation explicitly in PLAN.md.

### 6. BRAND-01 wider owner surface check (onboarding wizard, dashboard, settings, event-type editor)

Verified by grep — **zero** audience-context `contractor` / `trade contractor` matches in:
- `app/onboarding/**` (only `acme-hvac` placeholder fixtures, out of scope)
- `app/(shell)/app/**` (dashboard, settings, event-types, availability)

So BRAND-01's wider surface enumeration ends up empty — the actual owner-facing copy footprint is just `auth-hero.tsx`. The roadmap mention was speculative; reality is tighter.

## Booker-Prose Allowlist Sanity Check

CONTEXT.md flags `contractor's brand` as a phrase that should NOT trigger the gate (it describes the booker-facing pattern where the owner's own brand surfaces in widgets/emails, not the audience). Direct grep for `contractor's brand`, `contractors' brand`, `contractor brand` returns **zero matches** in the current tree. Allowlist is therefore **precautionary, not load-bearing** — but baking it into the gate is still wise because:
- Future docs may legitimately use that phrase to describe the booker UX.
- It's cheap insurance against gate flakiness later.

## Proposed Canonical Grep Gate

The roadmap default (`grep -rn "trade contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md`) catches only the literal string. The full-audience-scrub decision requires also catching audience-context `contractor`. Recommended two-step gate:

```bash
# Gate 1: literal "trade contractor" (case-insensitive) — must be zero everywhere
grep -rni "trade contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md
# Pass condition: zero matches.

# Gate 2: audience-context "contractor" (case-insensitive), allowlist booker-prose
grep -rni "contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md \
  | grep -v "contractor's brand" \
  | grep -v "contractors' brand"
# Pass condition: zero matches (after allowlist filtering).
```

Notes for the planner:
- Searching `app/`, `lib/`, `README.md`, `FUTURE_DIRECTIONS.md` matches the requirement scope. Do **not** add `tests/` (slug fixtures use `acme-hvac` which would false-positive — though only against gate 1's `hvac` if you broadened, not against `contractor`). Current scope of just those four paths is correct.
- Do **not** broaden gate 2 to `plumber|HVAC|roofer|electrician` — those tokens currently only exist in README.md line 3 (which gate 1 already catches via the parenthetical edit) and `acme-hvac` test fixtures (out of scope). After Phase 29's edits, those tokens disappear from in-scope files, and you don't want to police test fixtures.
- Single-command alternative if you prefer one invocation:
  ```bash
  grep -rniE "trade contractor|contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md \
    | grep -viE "contractor's brand|contractors' brand"
  ```
  → must return zero lines.

## State of Working Tree (merge-risk check)

- `git status --short` shows only one unrelated dirty file: `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md`. **No conflict risk** with Phase 29's surface (auth-hero.tsx, README.md, FUTURE_DIRECTIONS.md, booking-form.tsx).
- `auth-hero.tsx` last touched in Phase 16-02 (header comments reference it); not touched by recent buffer/divergence work in Phase 28. Clean.
- `booking-form.tsx:138` comment was added in Phase 27 (V14-MP-01); also untouched since. Clean.
- `README.md` and `FUTURE_DIRECTIONS.md` are at project root, both readable, both writeable. Confirmed via `ls`.
- Phase 28 just landed (commit `dfb421f` per status snapshot) — buffer column drop work is done, no overlapping edits to any Phase 29 file.

**Verdict:** Zero merge risk. The diff will be small and clean.

## Open Questions

None blocking. All decisions either locked in CONTEXT.md or trivially derivable.

Minor open call (Claude's discretion at plan-time):
- Exact replacement wording for `auth-hero.tsx` subtext — needs to be punchier than current and contain the word `service businesses`. Planner picks.
- Whether to swap `contractor's website` (README line 3) to `business's website` or restructure the sentence. CONTEXT.md gives Claude's discretion on README opening.
- Whether `booking-form.tsx:138` should say `owner` or `account` — both read fine; pick one for consistency with neighboring code style (most surrounding comments use `owner`).

## Sources

All HIGH confidence — direct file reads and grep against the working tree:

- `app/(auth)/_components/auth-hero.tsx` (full read)
- `app/(auth)/app/login/page.tsx` (full read)
- `app/(auth)/app/signup/page.tsx` (full read)
- `README.md` (full read)
- `FUTURE_DIRECTIONS.md` (full read)
- `app/[account]/[event-slug]/_components/booking-form.tsx` lines 130-145 (focused read)
- Grep: `contractor` (case-insensitive), `trade|plumber|HVAC|roofer|electrician|service business`, `AuthHero`, `trade contractor|service business|service-based`
- `git status --short` (working tree)

## Metadata

**Confidence breakdown:**
- File enumeration: HIGH (grep is exhaustive against repo)
- Callsite analysis: HIGH (only 2 callsites, both fully read)
- Grep-gate proposal: HIGH (allowlist verified empty, fixtures verified)
- Merge-risk: HIGH (git status clean for in-scope files)

**Research date:** 2026-05-03
**Valid until:** Stable until any new auth-hero callsite, README rewrite, or FUTURE_DIRECTIONS edit lands. For this phase, valid for the immediate planning cycle.
