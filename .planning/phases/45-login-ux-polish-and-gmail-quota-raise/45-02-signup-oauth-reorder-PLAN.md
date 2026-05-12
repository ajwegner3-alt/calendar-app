---
phase: 45-login-ux-polish-and-gmail-quota-raise
plan: "45-02"
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(auth)/app/signup/signup-form.tsx
autonomous: true
must_haves:
  truths:
    - "On /app/signup, the Google OAuth button appears below the email/password Card, not above it"
    - "The OR divider sits between the Card and the Google button"
    - "GoogleErrorAlerts still render at the top of the page (above the Card)"
    - "All signup form behavior (validation, submit, redirect to /app/verify-email) is unchanged"
  artifacts:
    - path: "app/(auth)/app/signup/signup-form.tsx"
      provides: "Signup form with Google OAuth visually demoted below Card"
      contains: "Sign up with Google"
  key_links:
    - from: "JSX render order (top-to-bottom)"
      to: "visual layout"
      via: "Card precedes OAuth form in JSX"
      pattern: "</Card>[\\s\\S]*?Sign up with Google"
    - from: "GoogleErrorAlerts (Suspense)"
      to: "page top"
      via: "remains as first child of outer div"
      pattern: "<GoogleErrorAlerts"
---

<objective>
Reorder the JSX of `app/(auth)/app/signup/signup-form.tsx` so the Google OAuth button (and its OR divider) appears BELOW the email/password Card, not above it (AUTH-34). This is a pure DOM reorder with no state changes, no new behavior, and no copy changes.

Purpose: Visually demote the OAuth path from "first option" to "secondary alternative," matching the v1.8 product framing that email/password is the primary surface. CONTEXT.md frames this as "purely aesthetic."

Output: A clean reorder of the JSX block. The page renders identically except the OAuth button + divider have moved to below the Card.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/45-login-ux-polish-and-gmail-quota-raise/45-CONTEXT.md
@.planning/phases/45-login-ux-polish-and-gmail-quota-raise/45-RESEARCH.md

@app/(auth)/app/signup/signup-form.tsx
@components/google-oauth-button.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move Google OAuth + OR divider below the signup Card</name>
  <files>app/(auth)/app/signup/signup-form.tsx</files>
  <action>
    In `app/(auth)/app/signup/signup-form.tsx`, perform a JSX block move:

    Current structure (lines 82-174):
    ```
    <div className="flex flex-col gap-0">
      <Suspense><GoogleErrorAlerts /></Suspense>   ← KEEP HERE (top)
      <form action={initiateGoogleOAuthAction}>    ← MOVE (lines 89-92, OAuth)
        <GoogleOAuthButton ... />
      </form>
      <div className="relative my-4">              ← MOVE (lines 94-102, divider)
        ...
      </div>
      <Card>...</Card>                              ← KEEP, but now first below alerts
    </div>
    ```

    Target structure:
    ```
    <div className="flex flex-col gap-0">
      <Suspense><GoogleErrorAlerts /></Suspense>   ← unchanged
      <Card>...</Card>                              ← now directly after alerts
      <div className="relative my-4">              ← divider, now below Card
        ...
      </div>
      <form action={initiateGoogleOAuthAction}>    ← OAuth, now below divider
        <GoogleOAuthButton type="submit" label="Sign up with Google" />
      </form>
    </div>
    ```

    Specific edits:
    1. Cut the OAuth `<form action={initiateGoogleOAuthAction}>...</form>` block (currently lines ~89-92, immediately following the comment `{/* Google OAuth button — appears FIRST per CONTEXT.md lock */}`).
    2. Cut the OR divider `<div className="relative my-4">...</div>` block (currently lines ~94-102, the comment `{/* Divider */}` plus its contents).
    3. Cut the comment lines above each cut block (`{/* Google OAuth button ... */}` and `{/* Divider */}`).
    4. Paste BOTH blocks (in original divider-then-OAuth or OAuth-then-divider order? — see below) AFTER the closing `</Card>` (currently line 173).

    CRITICAL — divider/OAuth order BELOW the Card:
    - The divider goes FIRST below the Card (it separates Card from OAuth).
    - The OAuth button goes BELOW the divider.
    - Final order below Card: `</Card>` → divider → OAuth form → closing `</div>`.

    5. Update the inline comment for the OAuth block from:
       `{/* Google OAuth button — appears FIRST per CONTEXT.md lock */}`
       to:
       `{/* Google OAuth button — appears BELOW Card per Phase 45 (AUTH-34) — demoted to secondary CTA */}`

    6. Update the inline comment for the Card from:
       `{/* Email/password card — unchanged below divider */}`
       to:
       `{/* Email/password card — primary CTA, appears ABOVE OAuth (Phase 45 AUTH-34) */}`

    7. Update the JSDoc on line 55-56 (the `Phase 34: Google OAuth button appears FIRST...` paragraph):
       Add a paragraph after the Phase 34 paragraph:
       ```
       * Phase 45 (AUTH-34): Google OAuth visually demoted BELOW the email/password
       * Card. Email/password is the primary CTA; OAuth is the secondary alternative
       * below an OR divider. The OAuth FORM, divider markup, and GoogleErrorAlerts
       * placement remain otherwise identical to Phase 34. Pure DOM reorder.
       ```

    Constraints (apply RESEARCH guidance):
    - Do NOT change OAuth button copy ("Sign up with Google" stays per CONTEXT Q3).
    - Do NOT change divider copy ("or" lowercase stays per CONTEXT Q4 / existing markup).
    - Do NOT change any className, color, border, or spacing in the OAuth form, divider, or Card.
    - Do NOT introduce small-caps styling (CONTEXT says "centered small-caps OR" but RESEARCH recommends keeping existing lowercase "or" since markup already exists and changing it would be visual scope creep beyond AUTH-34; lowercase preserves Phase 34 precedent).
    - Do NOT touch the inner `<form action={formAction}>` (the email/password form inside the Card) — its content and behavior are unchanged.
    - Do NOT touch `GoogleErrorAlerts`, the Suspense boundary, or the outer `<div className="flex flex-col gap-0">` wrapper.
    - The OAuth `<form action={initiateGoogleOAuthAction}>` block must be preserved verbatim (action handler, GoogleOAuthButton props all unchanged). This is a move, not a rewrite.

    Self-check before completing:
    - `grep -n "Sign up with Google" app/\(auth\)/app/signup/signup-form.tsx` — must match exactly once.
    - `grep -n "initiateGoogleOAuthAction" app/\(auth\)/app/signup/signup-form.tsx` — must match exactly twice (import + form action).
    - Visually inspect: in source line order, the FIRST element after `<Suspense>...</Suspense>` is `<Card>`, and the LAST element before the closing outer `</div>` is the OAuth `<form>`.
  </action>
  <verify>
    1. `npm run typecheck` — must pass (zero new errors).
    2. `npm run lint` — must pass (or no new violations in this file).
    3. `npm run build` — must succeed; `/app/signup` route must compile.
    4. Source-order regex check (RESEARCH P-style invariant):
       `grep -Pzo '(?s)</Card>.*?Sign up with Google' app/\(auth\)/app/signup/signup-form.tsx` — must match (Card closes BEFORE OAuth label appears).
    5. Negative check: `grep -Pzo '(?s)Sign up with Google.*?<Card' app/\(auth\)/app/signup/signup-form.tsx` — must NOT match (OAuth must not appear before Card).
    6. Manual visual confirmation deferred to Phase 46 manual QA (per global instructions: live testing).
  </verify>
  <done>
    The signup-form.tsx JSX renders, in source order: GoogleErrorAlerts (Suspense), then Card (email/password form inside), then OR divider, then OAuth button form. typecheck + lint + build all pass. The OAuth form's `action={initiateGoogleOAuthAction}` and the GoogleOAuthButton props/label are unchanged. The Card's contents are byte-identical to the previous version.
  </done>
</task>

</tasks>

<verification>
Final phase-level checks for plan 45-02:
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build` passes.
- `git diff --stat` shows ONLY `app/(auth)/app/signup/signup-form.tsx` changed.
- DOM order regex: `grep -Pzo '(?s)</Card>.*?Sign up with Google' app/\(auth\)/app/signup/signup-form.tsx` matches.
- No new client-side state, no new hooks, no new imports introduced.

Pure DOM reorder invariant: `git diff app/(auth)/app/signup/signup-form.tsx` shows ONLY a block move (with the three comment/JSDoc text touchups). No logic or attribute changes outside comments.
</verification>

<success_criteria>
- SC1 (signup half): On `/app/signup`, the Google OAuth button appears below the email/password form Card. ✓ (verified via DOM source-order regex; final visual confirmation at Phase 46 manual QA per project policy).
- AUTH-34 satisfied: Signup parity — OAuth below email/password.
- No regression: signup-form.tsx still type-checks, lints, builds. Inner Card form (email + password Input + submit Button + links) is byte-identical.
- No scope creep: zero behavior changes — no copy edits to OAuth button label, no divider re-style, no Card content edit.
</success_criteria>

<output>
After completion, create `.planning/phases/45-login-ux-polish-and-gmail-quota-raise/45-02-SUMMARY.md` using the standard summary template. Include:
- One-line outcome ("Signup OAuth button + divider moved below email/password Card per AUTH-34; pure DOM reorder").
- File modified (the 1 above).
- Confirmation that login-form.tsx and quota-guard.ts were NOT touched.
- typecheck + lint + build status.
</output>
</content>
