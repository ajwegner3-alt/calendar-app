---
phase: 29-audience-rebrand
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(auth)/_components/auth-hero.tsx
  - app/[account]/[event-slug]/_components/booking-form.tsx
  - README.md
  - FUTURE_DIRECTIONS.md
autonomous: true

must_haves:
  truths:
    - "Signup and login auth-hero panel no longer reads 'trade contractors' anywhere — subtext uses 'service businesses' framing and the closing tagline drops the audience phrase."
    - "README.md opening references 'service businesses' (no 'Calendly-style' competitor name, no '(plumbers, HVAC, roofers, electricians)' parenthetical)."
    - "FUTURE_DIRECTIONS.md lines 62, 226, 232 no longer reference 'contractor(s)' as the audience."
    - "booking-form.tsx:138 inert dev comment uses 'owner' instead of 'contractor' (LD-07 lock deliberately overridden per CONTEXT.md)."
    - "Booker-facing surfaces (public booking form runtime UI, slot picker, embed widget, 6 transactional emails) contain no audience-shaping copy added by this phase — they remain brand-neutral."
    - "Canonical grep gate returns 0 matches: `grep -rniE 'trade contractor|contractor' app/ lib/ README.md FUTURE_DIRECTIONS.md | grep -viE \"contractor's brand|contractors' brand\"` → 0 lines."
    - "tsc --noEmit clean and Vercel deploy of 29-01 reaches Ready (no live-eyeball QA per CONTEXT verification waiver)."
  artifacts:
    - path: "app/(auth)/_components/auth-hero.tsx"
      provides: "Auth hero panel with audience-neutral / service-businesses copy in subtext default and tagline"
      contains: "service businesses"
    - path: "README.md"
      provides: "Project README opening that references service businesses without competitor name or contractor parenthetical"
      contains: "service businesses"
    - path: "FUTURE_DIRECTIONS.md"
      provides: "Future-directions doc with audience-context contractor references rewritten to service businesses / owners"
    - path: "app/[account]/[event-slug]/_components/booking-form.tsx"
      provides: "Booking form CROSS_EVENT_CONFLICT dev comment that says 'owner' instead of 'contractor' (LD-07 override)"
      contains: "// leak that the owner has another appointment."
  key_links:
    - from: "auth-hero.tsx defaults (lines 21, 42)"
      to: "callsites in app/(auth)/app/login/page.tsx and app/(auth)/app/signup/page.tsx"
      via: "Default prop values flow through; callsites pass NO audience-bearing strings (research-confirmed), so editing the defaults alone closes the auth surface."
      pattern: "subtext=|headline="
    - from: "Canonical grep gate"
      to: "Phase 29 close"
      via: "Hard verification — grep returns 0 lines after allowlist filter; phase does not close otherwise."
      pattern: "trade contractor|contractor"
---

<objective>
Stop reading too narrow on paper. Replace stale "trade contractors" framing with the canonical audience term **"service businesses"** across owner-facing copy (`auth-hero.tsx`) and developer-facing docs (`README.md`, `FUTURE_DIRECTIONS.md`), plus one inert dev comment in `booking-form.tsx`. Booker-facing runtime surfaces (public booking page, slot picker, embed widget, 6 transactional emails) stay brand-neutral and are NOT touched.

Purpose: This is **stale-copy cleanup, not a marketing repositioning**. The goal is to remove the too-narrow "trade contractor" framing so any prospective owner who lands on signup/login or the README sees an inclusive description. Tone stays understated — do not oversell a "bigger tent" or signal active outreach to new verticals.

Output: Three audience tokens in `auth-hero.tsx` neutralized, README opening rewritten audience-led with no competitor reference, three FUTURE_DIRECTIONS lines rewritten, one booking-form dev comment rewritten. Canonical grep gate returns 0 lines.

**LD-07 deviation note (auditable):** The original LD-07 lock placed `app/[account]/[event-slug]/_components/booking-form.tsx:138` OUT of scope on the basis that the booker surface stays untouched. Phase 29 CONTEXT.md (`booking-form.tsx:138 (deviation note)` section) **deliberately overrides LD-07 for this single line** — it is an inert dev comment with no runtime/UI effect, so scrubbing it has zero booker-facing impact and keeps the grep gate honest. Recording the override here per CONTEXT.md instruction.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/29-audience-rebrand/29-CONTEXT.md
@.planning/phases/29-audience-rebrand/29-RESEARCH.md

# Source files for this plan (read before editing)
@app/(auth)/_components/auth-hero.tsx
@app/[account]/[event-slug]/_components/booking-form.tsx
@README.md
@FUTURE_DIRECTIONS.md

# Callsite verification (do NOT edit — confirmed pass-through-only by research)
@app/(auth)/app/login/page.tsx
@app/(auth)/app/signup/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite auth-hero defaults (subtext + tagline) — owner-facing surface</name>
  <files>
app/(auth)/_components/auth-hero.tsx
  </files>
  <action>
Two edits to `app/(auth)/_components/auth-hero.tsx`. Read the file first to confirm line numbers (currently lines 21 and 42, but verify before editing — the JSX may have drifted).

**Edit 1 — Subtext default (line 21).**

Current:
```ts
  subtext = "A multi-tenant scheduling tool built for trade contractors. Branded booking pages, capacity-aware slots, and email confirmations — done.",
```

Replace with:
```ts
  subtext = "A multi-tenant scheduling tool built for service businesses. Branded booking pages, capacity-aware slots, and email confirmations — done.",
```

(Single-token swap: `trade contractors` → `service businesses`. Feature list trim is folded into Edit 2 below — the subtext sentence itself is already punchy, no further trim needed.)

**Edit 2 — Tagline `<li>` (line 42).**

Current:
```tsx
            Built for trade contractors, by NSI in Omaha.
```

Replace with:
```tsx
            Built by NSI in Omaha.
```

(Drops the audience phrase entirely per CONTEXT.md decision — the tagline keeps the NSI/Omaha provenance, drops the "Built for X" framing.)

**Do NOT touch:**
- Line 20 `headline` default — it does not name the audience (research-confirmed).
- Lines 34, 38 — feature `<li>` items 1 and 2. They're already punchy; CONTEXT's "feature-list trim" discretion is satisfied by tightening item 3 (the tagline) above.
- Any layout, color, structure, className, or surrounding JSX — that's deferred to a future hero-polish phase.
- `app/(auth)/app/login/page.tsx` or `app/(auth)/app/signup/page.tsx` callsites — research confirmed neither passes audience-bearing strings, so default-only edit is sufficient.

**Verify locally:**
```bash
grep -n "trade contractor" app/\(auth\)/_components/auth-hero.tsx
# Expected: 0 matches
grep -n "Built for" app/\(auth\)/_components/auth-hero.tsx
# Expected: 0 matches (tagline simplified)
```
  </action>
  <verify>
- `grep -n "trade contractor" app/(auth)/_components/auth-hero.tsx` → 0 matches
- Subtext default contains "service businesses"
- `<li>` at former line 42 reads exactly `Built by NSI in Omaha.`
- No other lines in the file changed (diff shows exactly 2 single-line edits)
  </verify>
  <done>
auth-hero defaults are audience-neutral. Login and signup pages — which both consume those defaults without passing overrides — automatically pick up the new copy. BRAND-01 owner-surface requirement is closed (research confirmed the wider owner surface had zero audience matches; no other owner-facing files need editing).
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite README opening + booking-form dev comment + FUTURE_DIRECTIONS audience tokens</name>
  <files>
README.md
app/[account]/[event-slug]/_components/booking-form.tsx
FUTURE_DIRECTIONS.md
  </files>
  <action>
Three independent files, batched into one task because each is a single-region edit and the grep gate verifies them together at the end.

---

**Edit A — `README.md` line 3 (developer-facing doc, BRAND-02).**

Current line 3:
```
Multi-tenant Calendly-style booking tool for trade contractors (plumbers, HVAC, roofers, electricians). A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.
```

Replace with:
```
Multi-tenant booking tool for service businesses. A visitor lands on a business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.
```

Three changes folded in:
1. `Calendly-style` dropped (no competitor reference per CONTEXT decision).
2. `trade contractors (plumbers, HVAC, roofers, electricians)` → `service businesses` (audience swap + parenthetical dropped).
3. `a contractor's website` → `a business's website` (audience-context contractor swap).

Do NOT touch any other line in README.md. Line 1 (`# calendar-app`), line 5 (`**Live production:**`), and the Tech stack section stay byte-identical.

---

**Edit B — `app/[account]/[event-slug]/_components/booking-form.tsx` line 138 (LD-07 OVERRIDE).**

> **LD-07 deviation:** This single line was originally locked OUT of Phase 29 scope. CONTEXT.md `booking-form.tsx:138 (deviation note)` deliberately overrides that lock for this inert dev comment only. The runtime user-facing string at line 139 (`raceMessage = "That time is no longer available..."`) is **NOT** touched — the booker surface stays untouched.

Current lines 136-139 (verify before editing):
```ts
      } else if (body409?.code === "CROSS_EVENT_CONFLICT") {
        // V14-MP-01 (Phase 27): cross-event-type overlap (DB EXCLUDE constraint).
        // Generic wording — booker has no concept of event types and we do NOT
        // leak that the contractor has another appointment.
        raceMessage = "That time is no longer available. Please choose a different time.";
```

Replace ONLY line 138 (`// leak that the contractor has another appointment.`) with:
```ts
        // leak that the owner has another appointment.
```

Use `owner` (CONTEXT noted research suggested `owner` for surrounding-code-style consistency; planner concurs — `owner` matches the rest of this codebase's terminology). Indentation stays exact (8 spaces + `// `). Lines 136, 137, 139 are byte-identical.

Do NOT touch any other line in booking-form.tsx. The runtime `raceMessage` string at line 139 stays exactly `"That time is no longer available. Please choose a different time."` — booker-facing copy is brand-neutral and untouched.

---

**Edit C — `FUTURE_DIRECTIONS.md` (full audience scrub, BRAND-02).**

Three line edits. Verify each line number before editing — content must match exactly.

**C-1, line 62.** Current:
```
- **Gmail SMTP for transactional delivery via owner's personal Gmail** (`GMAIL_USER` / `GMAIL_FROM_NAME` env vars; `lib/email-sender/providers/gmail.ts`). Not suitable for high volume; fine for v1 contractor use case.
```
Replace `fine for v1 contractor use case.` → `fine for v1 service-business use case.`

Resulting line 62:
```
- **Gmail SMTP for transactional delivery via owner's personal Gmail** (`GMAIL_USER` / `GMAIL_FROM_NAME` env vars; `lib/email-sender/providers/gmail.ts`). Not suitable for high volume; fine for v1 service-business use case.
```

(The hyphenated form `service-business` reads better as an attributive adjective modifying `use case` — "service businesses use case" would be ungrammatical. Canonical noun-form `service businesses` is preserved everywhere it stands alone; this is the one place the modifier form is grammatically required.)

**C-2, line 226.** Current:
```
- **Slug 301 redirect for old slugs after change.** In v1.1 (Plan 10-07), changing a slug produces a 404 for the old URL. v1.2 could store `previous_slug` and serve a 301 from `app/[account]/page.tsx`. Revisit if contractors report broken-link complaints after promoting their booking page.
```
Replace `if contractors report` → `if owners report`.

Resulting line 226:
```
- **Slug 301 redirect for old slugs after change.** In v1.1 (Plan 10-07), changing a slug produces a 404 for the old URL. v1.2 could store `previous_slug` and serve a 301 from `app/[account]/page.tsx`. Revisit if owners report broken-link complaints after promoting their booking page.
```

(In this context the audience referent is "the owners of accounts on this product" — `owners` is the project's own term-of-art, more precise than `service businesses` here.)

**C-3, line 232.** Current:
```
- **Pick-from-templates first event type.** Plan 10-06 ships a single pre-filled "Consultation / 30 min" default in the wizard. v1.2 could offer 3–4 template cards (Consultation, Discovery Call, Site Visit, etc.) for contractors to choose from. Revisit if onboarding analytics show users bouncing at wizard step 3.
```
Replace `for contractors to choose from.` → `for owners to choose from.`.

Resulting line 232:
```
- **Pick-from-templates first event type.** Plan 10-06 ships a single pre-filled "Consultation / 30 min" default in the wizard. v1.2 could offer 3–4 template cards (Consultation, Discovery Call, Site Visit, etc.) for owners to choose from. Revisit if onboarding analytics show users bouncing at wizard step 3.
```

(Same rationale as C-2 — "owners" is the in-product term for who's choosing.)

Do NOT touch any other line in FUTURE_DIRECTIONS.md. In particular: any "the contractor's brand" / "contractors' brand" phrases are explicitly OUT of scope (those describe the booker-facing pattern, not the audience) — research confirmed none currently appear in tree, but the allowlist exists defensively.

---

**Verify all three edits (run from repo root):**

```bash
# Per-file confirmations
grep -n "Calendly-style\|trade contractors\|contractor's website" README.md
# Expected: 0 matches

grep -n "leak that the contractor" app/\[account\]/\[event-slug\]/_components/booking-form.tsx
# Expected: 0 matches
grep -n "leak that the owner" app/\[account\]/\[event-slug\]/_components/booking-form.tsx
# Expected: exactly 1 match (line 138)

grep -nE "v1 contractor|if contractors|for contractors" FUTURE_DIRECTIONS.md
# Expected: 0 matches

# tsc — copy-only, but run anyway to catch any accidental syntax breakage in booking-form.tsx
npx tsc --noEmit
# Expected: clean
```
  </action>
  <verify>
- README.md line 3 reads exactly the replacement string above (no `Calendly-style`, no `trade contractors`, no `contractor's website`).
- booking-form.tsx line 138 reads `// leak that the owner has another appointment.`; lines 136, 137, 139 unchanged; runtime `raceMessage` string at line 139 byte-identical.
- FUTURE_DIRECTIONS.md lines 62, 226, 232 each match the replacement strings above.
- `npx tsc --noEmit` clean.
- The three per-file greps return 0 matches as listed.
  </verify>
  <done>
All three docs / one dev comment scrubbed. Combined with Task 1, the canonical grep gate (Task 3) should now pass with 0 matches. LD-07 deviation is recorded and audited via the explicit override note above.
  </done>
</task>

<task type="auto">
  <name>Task 3: Run canonical grep gate, commit, push (no live smoke per CONTEXT)</name>
  <files>(no source edits — verification + git only)</files>
  <action>
**Step 1 — Run the canonical grep gate (locked here, planner's discretion per CONTEXT).**

Single-command form (RESEARCH-recommended, planner-locked):
```bash
grep -rniE "trade contractor|contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md \
  | grep -viE "contractor's brand|contractors' brand"
```

**Pass criterion:** 0 lines of output.

If any line returns, identify the file and decide:
- If it's a missed audience reference → fix it now (extend Task 1 or Task 2 per the file's location).
- If it's a `contractor's brand` / `contractors' brand` allowlisted phrase that the regex missed (e.g., capitalization or whitespace variant) → extend the second `grep -viE` pattern to cover it, but **only if the phrase genuinely describes the booker-facing pattern** (per CONTEXT: "those describe the owner's brand-neutral booker experience, not the audience"). Document the extension in the SUMMARY.

**Step 2 — Run the narrower belt-and-suspenders check** to satisfy ROADMAP success criterion #4 (which uses the simpler legacy form):
```bash
grep -rn "trade contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md
```
**Pass criterion:** 0 matches. (This subset of the canonical gate is the literal command listed in ROADMAP — running it explicitly closes that success criterion verbatim.)

**Step 3 — Booker-surface neutrality check** (BRAND-03 / success criterion #5).

Confirm the phrase `service businesses` does NOT appear in booker-facing surfaces:
```bash
grep -rn "service businesses" app/\[account\]/ lib/email-sender/
```
**Pass criterion:** 0 matches. (We're proving the audience copy did NOT leak into booker-facing routes or transactional email templates.)

If `service businesses` appears in either path, that's a regression — the rebrand leaked into the booker surface. Fix by removing the offending string and re-running the gate.

**Step 4 — tsc gate.**
```bash
npx tsc --noEmit
```
Expected: clean.

**Step 5 — Commit.**

Per Andrew's global pref ("commit after a logical unit of work") and the project's atomic-commit norm, this whole copy pass is one logical unit. Single commit:

```bash
git add app/\(auth\)/_components/auth-hero.tsx \
        app/\[account\]/\[event-slug\]/_components/booking-form.tsx \
        README.md \
        FUTURE_DIRECTIONS.md

git commit -m "docs(29-01): rebrand audience copy to service businesses

- auth-hero: subtext default + tagline now audience-neutral
- README: opening rewritten audience-led, drops Calendly-style + parenthetical
- FUTURE_DIRECTIONS: 3 audience-context contractor refs rewritten
- booking-form.tsx:138: dev comment swapped contractor->owner (LD-07 override per 29-CONTEXT.md)

Canonical grep gate (trade contractor|contractor minus contractor's brand
allowlist across app/ lib/ README.md FUTURE_DIRECTIONS.md) returns 0 lines.

Closes BRAND-01, BRAND-02, BRAND-03."
```

**Step 6 — Push.**
```bash
git push origin main
```

**Step 7 — Confirm Vercel deploy reaches `Ready`** in the dashboard.

**Step 8 — VERIFICATION DECISION (recorded for the SUMMARY):**

Per CONTEXT.md verification section: **NO live smoke / live-eyeball QA for this phase.** This departs from the v1.4 default ("deploy-and-eyeball") for THIS PHASE ONLY because the change is copy-only with no behavior to verify. Grep-clean + tsc-clean + Vercel `Ready` is the close. Do NOT add a `checkpoint:human-verify` task. Do NOT request Andrew to load `/login` or `/signup` and visually confirm the new copy. The plan is `autonomous: true`.

(The deploy still happens — Andrew's global pref keeps GitHub-push → Vercel-auto-deploy in the loop — but no QA gate.)
  </action>
  <verify>
- Canonical gate (Step 1) returns 0 lines
- Narrower legacy gate (Step 2) returns 0 matches
- Booker-surface neutrality gate (Step 3) returns 0 matches in `app/[account]/` and `lib/email-sender/`
- `npx tsc --noEmit` clean
- Single commit landed and pushed; Vercel deploy reaches `Ready`
- No `checkpoint:human-verify` task triggered (explicitly waived for this phase)
  </verify>
  <done>
Phase 29 grep-clean. Production deploy is live (auto-deploy, no eyeball gate). All five ROADMAP success criteria are met:
1. Auth surface no longer references trade contractors (Task 1).
2. README opening references service businesses without competitor or parenthetical (Task 2 Edit A).
3. FUTURE_DIRECTIONS incidental mentions updated (Task 2 Edit C).
4. `grep -rn "trade contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md` returns 0 matches; LD-07 override on `booking-form.tsx:138` is documented (Task 2 Edit B).
5. Booker surfaces (public form, slot picker, embed widget, 6 emails) contain no `service businesses` audience copy (Step 3 booker-neutrality gate).
  </done>
</task>

</tasks>

<verification>
End-of-plan checks (run from repo root):

```bash
# Canonical grep gate — primary verification
grep -rniE "trade contractor|contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md \
  | grep -viE "contractor's brand|contractors' brand"
# Expected: 0 lines

# ROADMAP success-criterion-4 verbatim check
grep -rn "trade contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md
# Expected: 0 matches

# Booker-surface neutrality (BRAND-03 / success criterion #5)
grep -rn "service businesses" app/\[account\]/ lib/email-sender/
# Expected: 0 matches

# Type gate
npx tsc --noEmit
# Expected: clean

# Deploy gate
# Vercel dashboard: most recent deploy is the 29-01 commit and status is Ready
```

**Live smoke:** Explicitly waived per 29-CONTEXT.md verification decision. Copy-only change, no behavior to eyeball. Grep-clean is sufficient close for this phase.
</verification>

<success_criteria>
1. `auth-hero.tsx` subtext default contains "service businesses"; tagline `<li>` reads `Built by NSI in Omaha.`; both old strings absent.
2. `README.md` line 3 contains "service businesses" and contains neither "Calendly-style" nor "(plumbers, HVAC, roofers, electricians)" nor "contractor's website".
3. `FUTURE_DIRECTIONS.md` lines 62, 226, 232 contain no audience-context "contractor(s)".
4. `booking-form.tsx:138` reads `// leak that the owner has another appointment.` — runtime `raceMessage` string on line 139 is byte-identical to before.
5. Canonical grep gate returns 0 lines; ROADMAP-verbatim narrower gate also returns 0 matches.
6. `npx tsc --noEmit` clean; single commit pushed; Vercel deploy `Ready`.
7. Booker surfaces (`app/[account]/`, `lib/email-sender/`) contain 0 instances of "service businesses" — proving the rebrand did not leak into booker-facing copy.
</success_criteria>

<output>
After completion, create `.planning/phases/29-audience-rebrand/29-01-SUMMARY.md` with:
- Files edited (4) with diff summary (≈ 2 lines in auth-hero, 1 line in README, 1 line in booking-form, 3 lines in FUTURE_DIRECTIONS)
- Canonical grep gate output (must show "0 lines" / empty)
- ROADMAP verbatim grep gate output (must show 0 matches)
- Booker-surface neutrality gate output (must show 0 matches)
- tsc result
- Commit SHA + Vercel deploy status (`Ready`)
- LD-07 deviation note: confirm `booking-form.tsx:138` was edited and runtime string at line 139 was NOT touched
- Verification waiver: explicit note that "no live smoke per 29-CONTEXT.md; copy-only change, grep-clean is the close" — for audit trail
- Any deviations from the plan with rationale
</output>
