---
phase: 45-login-ux-polish-and-gmail-quota-raise
plan: "45-03"
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(auth)/app/login/login-form.tsx
  - app/(auth)/app/login/actions.ts
  - tests/login-form-auth-29.test.tsx
  - tests/login-form-counter.test.tsx
autonomous: true
must_haves:
  truths:
    - "On /app/login, the Google OAuth button appears below the email/password Card"
    - "Password tab is the default tab when /app/login loads"
    - "Magic-link tab shows an inline helper line under the email field whose wording is byte-identical for every email submission (known, unknown, rate-limited, OTP cooldown)"
    - "After 3 consecutive HTTP 400 auth-rejection responses in the same tab session, an inline link 'Trouble signing in? Email me a sign-in link instead.' appears under the password field"
    - "Clicking the nudge link switches the visible tab to Magic-link AND pre-fills the email field with whatever was typed on the Password tab"
    - "The 3-fail counter does NOT advance on rate-limit (429), network errors, or 5xx server errors"
    - "The 3-fail counter does NOT persist to localStorage or sessionStorage"
    - "The 3-fail counter resets to 0 on successful login (component unmount via redirect)"
    - "Tab switching does NOT remount the counter (counter state survives Password ↔ Magic-link tab switches)"
  artifacts:
    - path: "app/(auth)/app/login/login-form.tsx"
      provides: "Login form with Card-above-OAuth layout, controlled Tabs, helper line, 3-fail nudge, pre-fill support"
      contains: "Trouble signing in?"
    - path: "app/(auth)/app/login/actions.ts"
      provides: "LoginState with errorKind discriminant ('credentials' | 'rateLimit' | 'server')"
      contains: "errorKind"
    - path: "tests/login-form-auth-29.test.tsx"
      provides: "AUTH-29 byte-identical helper-line invariant test (covers four states: known, unknown, rate-limited, OTP cooldown)"
      contains: "byte-identical"
    - path: "tests/login-form-counter.test.tsx"
      provides: "3-fail counter behavior tests (advances on credentials only; resets on success; survives tab switch; no storage writes)"
      contains: "Trouble signing in"
  key_links:
    - from: "loginAction (actions.ts)"
      to: "LoginForm counter useEffect"
      via: "state.errorKind === 'credentials'"
      pattern: "errorKind:\\s*\"credentials\""
    - from: "Nudge onClick handler"
      to: "Magic-link tab + email Input defaultValue"
      via: "setActiveTab('magic-link') + setPrefillEmail(getValues('email'))"
      pattern: "setActiveTab\\(['\"]magic-link['\"]\\)"
    - from: "MagicLinkTabContent email Input"
      to: "prefillEmail prop"
      via: "defaultValue={prefillEmail}"
      pattern: "defaultValue=\\{prefillEmail\\}"
    - from: "Counter useState"
      to: "LoginForm top-level scope (NOT inside TabsContent)"
      via: "declared in LoginForm function body"
      pattern: "const \\[failCount, setFailCount\\] = useState"
---

<objective>
Apply the bulk of the login UX polish (AUTH-33, AUTH-35, AUTH-36, AUTH-37, AUTH-38, AUTH-39) to `app/(auth)/app/login/login-form.tsx` and add an `errorKind` discriminant to `LoginState` in `app/(auth)/app/login/actions.ts`. This plan carries five lockfile-grade invariants and is the highest-risk plan in Phase 45.

Purpose: Move Google OAuth below the email/password Card; lock Password as the default tab as a v1.8 invariant; add an inline magic-link nudge after 3 consecutive HTTP-400 credential rejections with one-click tab switch + email pre-fill; add a static byte-identical helper line under the magic-link email field that preserves the AUTH-29 four-way enumeration-safety invariant.

Output: Updated login-form.tsx + actions.ts + two Vitest + React Testing Library suites that lock both the AUTH-29 helper invariant and the counter behavior contract.
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

@app/(auth)/app/login/login-form.tsx
@app/(auth)/app/login/actions.ts
@app/(auth)/app/login/schema.ts
@app/(auth)/app/login/magic-link-success.tsx
@components/google-oauth-button.tsx
@components/ui/tabs.tsx
@vitest.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add errorKind discriminant to LoginState + AUTH-29 byte-identical helper line (highest-risk sub-tasks first per RESEARCH risk ordering)</name>
  <files>app/(auth)/app/login/actions.ts, app/(auth)/app/login/login-form.tsx, tests/login-form-auth-29.test.tsx</files>
  <action>
    Split this task into THREE sub-steps. AUTH-29 helper line FIRST because it carries the highest regression risk (enumeration-safety contract from Phase 18 / v1.7).

    SUB-STEP A — Extend `LoginState` with an `errorKind` discriminant (actions.ts):

    Edit `app/(auth)/app/login/actions.ts`:

    1. Change the `LoginState` type (lines 10-13) to:
       ```ts
       export type LoginState = {
         fieldErrors?: Partial<Record<"email" | "password", string[]>>;
         formError?: string;
         /**
          * Phase 45 (AUTH-38): which class of error fired, used by the client
          * to gate the 3-fail magic-link nudge counter on credentials-only.
          * Undefined on success or on rate-limit/server error branches.
          */
         errorKind?: "credentials" | "rateLimit" | "server";
       };
       ```

    2. In `loginAction` (lines 15-62), set `errorKind` in each return branch:
       - Line 25 (Zod validation failure): KEEP returning `{ fieldErrors: ... }` only — DO NOT set errorKind. Zod failures are NOT auth rejections; they would never advance the counter anyway (RESEARCH P3).
       - Line 36 (rate-limit branch): change to `return { formError: "Too many login attempts. Please wait a few minutes and try again.", errorKind: "rateLimit" };`
       - Lines 43-54 (Supabase error branch): change the `return { formError };` on line 54 to:
         ```ts
         const errorKind: "credentials" | "rateLimit" | "server" =
           error.status === 429 ? "rateLimit"
           : (!error.status || error.status >= 500) ? "server"
           : "credentials";
         return { formError, errorKind };
         ```
         This preserves the existing `formError` string (no copy change) while emitting the discriminant. Order of the ternaries matches the existing if-chain logic for `formError` so the two values stay in sync.

    3. Do NOT change the success path (revalidatePath + redirect at lines 60-61). The redirect unmounts the form, so counter reset is automatic — no errorKind needed.

    SUB-STEP B — Add the AUTH-29 byte-identical helper line (login-form.tsx, MagicLinkTabContent):

    Edit `MagicLinkTabContent` in `app/(auth)/app/login/login-form.tsx` (function starting at line 211):

    1. Add a static helper `<p>` element AFTER the email `<div className="grid gap-2">...</div>` block (which currently ends at line 252) and BEFORE the submit `<Button>` (line 253). Use this exact JSX:
       ```tsx
       <p className="text-xs text-muted-foreground" data-testid="magic-link-helper">
         We&apos;ll email you a one-time sign-in link. Open it on this device to log in.
       </p>
       ```
       (RESEARCH Q4 / CONTEXT: Claude's discretion within "generic, expectation-setting instruction." This copy matches Phase 38 helper tone and avoids any state hint.)

    2. CRITICAL — AUTH-29 invariants (RESEARCH P1):
       - The helper `<p>` MUST be a literal string. Zero references to `magicState`, `magicPending`, props, or any variable.
       - The helper MUST live INSIDE the form-mode JSX (the `return ( <form>...</form> )` block at lines 226-258), NOT before the early `MagicLinkSuccess` branch at line 222. After a successful send, the helper does NOT render — `MagicLinkSuccess` takes over the whole DOM. This is intentional: the success view already collapses known + unknown + throttled into the same `MagicLinkSuccess email={submittedEmail}` render, preserving AUTH-29 at the success layer.
       - Do NOT touch line 234-238 (the `magicState.formError` Alert) — its visibility is gated on 5xx-only per `requestMagicLinkAction` lines 169-179. This gate is the v1.7 AUTH-29 contract and must be preserved verbatim.
       - Do NOT add any conditional className, aria-live, or `data-*` attribute that depends on state.

    3. Do NOT change the `requestMagicLinkAction` function in actions.ts. The byte-identical guarantee comes from (a) `success: true` returned in all 4xx paths (line 182), (b) `formError` only set on 5xx (line 169-172), and (c) the helper `<p>` being unconditional. These three properties are all already true in the current codebase — Task A's edits to actions.ts do NOT touch requestMagicLinkAction.

    SUB-STEP C — Write `tests/login-form-auth-29.test.tsx`:

    Create `tests/login-form-auth-29.test.tsx` using Vitest + React Testing Library. This test locks the byte-identical-DOM invariant for the helper line across the four AUTH-29 states.

    Mock `app/(auth)/app/login/actions.ts` with `vi.mock(...)` so `requestMagicLinkAction` returns each of:
    - Success (known email): `{ success: true }`
    - Unknown email (swallowed 4xx): `{ success: true }` (per source line 182, ALL non-5xx return success)
    - Rate-limited (silent throttle): `{ success: true }` (per source line 148)
    - OTP cooldown (Supabase 4xx): `{ success: true }` (also non-5xx — swallowed)

    Note all four states return the same `{ success: true }` from the action — that is the v1.7 AUTH-29 four-way invariant. This test does NOT exercise different action returns; it asserts that BEFORE submission, the helper `<p>` renders identical text regardless of any client-side state, AND that the helper is not present in the success view.

    Test cases (use `describe("AUTH-29 byte-identical helper line", ...)`):

    1. `it("helper line renders with exact byte-identical copy on initial magic-link tab render", ...)` — render `<LoginForm />`, click the Magic-link tab trigger, query `[data-testid="magic-link-helper"]`, assert `textContent === "We'll email you a one-time sign-in link. Open it on this device to log in."` (use the apostrophe character that React will render — `’` if needed, but plain `'` should match because React renders `&apos;` to a literal apostrophe).

    2. `it("helper line copy does not change when the email field has a value", ...)` — same as above but type into the email input first; helper text remains byte-identical.

    3. `it("helper line is absent in MagicLinkSuccess view (success state replaces entire form)", ...)` — mock requestMagicLinkAction to return `{ success: true }`, submit the form, assert `queryByTestId("magic-link-helper")` returns `null` after the success branch renders. This is the intended behavior: success collapses the entire DOM to `MagicLinkSuccess`, which has its own AUTH-29-safe copy.

    4. `it("helper line element has no state-dependent attributes (no aria-live, no conditional class)", ...)` — render the form mode, query the helper, assert `el.getAttribute("aria-live")` is null, `el.className === "text-xs text-muted-foreground"` exactly (no appended state classes).

    Test setup notes:
    - Import `render`, `screen`, `fireEvent` from `@testing-library/react`.
    - Use `vi.mock("./actions")` pattern from the existing repo convention (see other `tests/*.test.tsx` files if present, otherwise mock by path relative to `app/(auth)/app/login/actions`).
    - The test file lives in `tests/` per the project's Vitest convention.
    - Use `await screen.findByRole("tab", { name: /magic link/i })` to find and click the tab trigger.

    Self-checks for Task 1:
    - `grep -n "errorKind" app/\(auth\)/app/login/actions.ts` — must match the type definition plus the two return-branch usages.
    - `grep -n "magic-link-helper" app/\(auth\)/app/login/login-form.tsx` — must match exactly once.
    - `grep -nE "(magicState|magicPending)" app/\(auth\)/app/login/login-form.tsx` — same count as before this task (helper line does NOT reference these).
    - The helper `<p>` JSX MUST be a sibling of the email `<div>` and the submit `<Button>`, NOT nested inside either.
  </action>
  <verify>
    1. `npm run typecheck` — must pass (LoginState change must propagate cleanly; the union literal is the only structural change).
    2. `npm test -- login-form-auth-29` — all 4 test cases must pass green.
    3. `grep -n "errorKind" app/\(auth\)/app/login/actions.ts` — at least 3 matches (type definition + rateLimit branch + Supabase error branch).
    4. `grep -Pzo '(?s)className="text-xs text-muted-foreground"\s+data-testid="magic-link-helper"' app/\(auth\)/app/login/login-form.tsx` — must match exactly once.
    5. Negative invariants (RESEARCH P1):
       - `grep -E "magic-link-helper[\s\S]*?\{.*magicState" app/\(auth\)/app/login/login-form.tsx` — zero matches.
       - The helper element must NOT be inside the early `if (magicState.success && submittedEmail)` branch (lines 221-223). Visually inspect.
  </verify>
  <done>
    `LoginState.errorKind` is defined and set in `loginAction`'s rate-limit + Supabase error branches; Zod-failure branch does NOT set it. `MagicLinkTabContent` renders a static `<p data-testid="magic-link-helper">` between the email `<div>` and submit `<Button>` whose text is identical to the literal in the test fixture. Four AUTH-29 test cases pass. typecheck passes. The byte-identical helper element has zero state-dependent attributes or content.
  </done>
</task>

<task type="auto">
  <name>Task 2: Move OAuth below Card + convert Tabs to controlled + add 3-fail counter and magic-link nudge with email pre-fill (AUTH-33, AUTH-35 lock, AUTH-36, AUTH-37, AUTH-38)</name>
  <files>app/(auth)/app/login/login-form.tsx, tests/login-form-counter.test.tsx</files>
  <action>
    This task carries the remaining four login-form changes. Order the sub-steps as listed — converting Tabs to controlled BEFORE adding the counter, because the nudge depends on controlled `value`/`onValueChange`.

    SUB-STEP A — Move OAuth + divider below the Card (AUTH-33):

    In `app/(auth)/app/login/login-form.tsx`:
    1. Cut the OAuth `<form action={initiateGoogleOAuthAction}>...</form>` block (lines 104-107) and its comment (line 104).
    2. Cut the OR divider `<div className="relative my-4">...</div>` block (lines 109-117) and its `{/* Divider */}` comment.
    3. Paste BOTH below the closing `</Card>` (currently line 194) — divider first, then OAuth form (same order as plan 45-02 for signup).
    4. Update the OAuth comment to: `{/* Google OAuth button — appears BELOW Card per Phase 45 (AUTH-33) — demoted to secondary CTA */}`
    5. Update the Card opening comment (line 119) from `{/* Email auth card — Phase 38 adds ... */}` to `{/* Email auth card — primary CTA. Phase 38 Tabs (Password|Magic-link) inside CardContent. Phase 45 (AUTH-33) repositioned ABOVE OAuth. */}`
    6. Update the JSDoc on lines 61-75 to add a Phase 45 paragraph after the Phase 38 paragraph:
       ```
       * Phase 45 (AUTH-33, 35, 36, 37, 38, 39): Google OAuth + divider visually
       * demoted BELOW the Card. Tabs is converted to controlled mode so a
       * 3-fail-rejection nudge under the password field can switch the user
       * to the Magic-link tab and pre-fill their email. Counter lives at
       * LoginForm top level so it survives Tabs unmount of inactive content
       * (RESEARCH P2). Magic-link tab gains a static byte-identical helper
       * line under the email field (AUTH-29 preserved).
       ```

    SUB-STEP B — Convert Tabs to controlled mode (AUTH-35 invariant lock):

    1. Add a new `useState` at the top of `LoginForm` (after line 77's `useActionState`):
       ```ts
       const [activeTab, setActiveTab] = useState<"password" | "magic-link">("password");
       ```
    2. Change line 125 from `<Tabs defaultValue="password">` to `<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "password" | "magic-link")}>`.
       - RESEARCH P8: ALWAYS pair `value` with `onValueChange`. Both must be present.
       - The initial state value `"password"` PRESERVES the AUTH-35 invariant (Password tab is default). This is the v1.8 lock.

    SUB-STEP C — Add 3-fail counter state + reset effect (AUTH-37, AUTH-38):

    1. Below `activeTab` state, add:
       ```ts
       const [failCount, setFailCount] = useState(0);
       const [prefillEmail, setPrefillEmail] = useState("");
       ```
       (RESEARCH P6: counter is session-wide, NOT email-keyed. RESEARCH: counter MUST be `useState` not `useRef` so the nudge re-renders.)

    2. Add a `useEffect` that increments `failCount` when `state.errorKind === "credentials"`:
       ```ts
       useEffect(() => {
         if (state.errorKind === "credentials") {
           setFailCount((n) => Math.min(n + 1, 3));
         }
       }, [state]);
       ```
       (RESEARCH P3: gate on errorKind, not on `formError` presence. RESEARCH P4: depend on `[state]` reference so consecutive identical errors re-fire. RESEARCH P7: cap at 3 to prevent unbounded increment.)

    3. Import `useEffect` from React (line 4 — currently `import { useActionState, useState } from "react";`; change to `import { useActionState, useEffect, useState } from "react";`).

    4. RESEARCH P5 invariant: do NOT add `localStorage` or `sessionStorage` anywhere. The `useState` reset is automatic on unmount (successful login redirects, tab/window close destroys the component tree).

    SUB-STEP D — Render the inline nudge under the password field (AUTH-36):

    1. Wire `react-hook-form`'s `getValues` into the existing `useForm` call. Change line 79-95 destructure:
       ```ts
       const {
         register,
         getValues,
         formState: { errors },
       } = useForm<LoginInput>({...});
       ```

    2. Add the nudge JSX directly after the password field's closing `</div>` (currently line 170) and BEFORE the submit `<Button>` (currently line 172). Use this exact JSX:
       ```tsx
       {failCount >= 3 && (
         <p
           className="text-sm text-muted-foreground animate-in fade-in duration-200 ease-out motion-reduce:animate-none"
           data-testid="magic-link-nudge"
         >
           Trouble signing in?{" "}
           <button
             type="button"
             onClick={() => {
               setPrefillEmail(getValues("email") ?? "");
               setActiveTab("magic-link");
             }}
             className="underline underline-offset-4 hover:text-foreground"
           >
             Email me a sign-in link instead.
           </button>
         </p>
       )}
       ```
       Constraints (apply CONTEXT + RESEARCH):
       - Inline `<p>` with an underlined `<button>` action — NO box, border, or banner.
       - `type="button"` on the nested button (RESEARCH critical — without this, clicking the link would submit the surrounding password `<form>`).
       - The onClick handler calls `getValues` AT CLICK TIME, NOT during render (RESEARCH P9 — `getValues` during render is unsafe).
       - Animation: `animate-in fade-in duration-200 ease-out motion-reduce:animate-none` — fade-only, no slide (RESEARCH Q2 + Phase 39 conventions).
       - `failCount >= 3` (not `=== 3`) because the cap at 3 means once shown, it stays shown until reset.
       - Wording: "Trouble signing in? Email me a sign-in link instead." (CONTEXT lock with Claude-discretion final-copy authority — this matches the recovery-framed intent).

    SUB-STEP E — Pass `prefillEmail` to `MagicLinkTabContent` and use it as Input `defaultValue` (AUTH-36 pre-fill):

    1. Change the `<MagicLinkTabContent />` call (line 190) to `<MagicLinkTabContent prefillEmail={prefillEmail} />`.

    2. Update the `MagicLinkTabContent` function signature (line 211):
       ```ts
       function MagicLinkTabContent({ prefillEmail }: { prefillEmail: string }) {
       ```

    3. Add `defaultValue={prefillEmail}` to the email Input (line 241-248). The Input currently has no `defaultValue` and is uncontrolled. The new prop:
       ```tsx
       <Input
         id="email-magic"
         name="email"
         type="email"
         autoComplete="email"
         required
         defaultValue={prefillEmail}
         aria-invalid={magicState.fieldErrors?.email ? true : undefined}
       />
       ```
       This works because `MagicLinkTabContent` IS remounted when the user clicks the nudge (Radix unmounts the inactive `TabsContent`; switching back to Magic-link mounts a fresh instance with the current `prefillEmail` prop). `defaultValue` initializes the uncontrolled input on mount. RESEARCH-confirmed: pre-fill survives Tabs unmount because the source-of-truth lives in `LoginForm`, not inside `MagicLinkTabContent`.

    SUB-STEP F — Write `tests/login-form-counter.test.tsx`:

    Create `tests/login-form-counter.test.tsx`. Test cases (use `describe("3-fail counter and magic-link nudge", ...)`):

    1. `it("counter does not show nudge before any submission", ...)` — render `<LoginForm />`, click Password tab, assert `queryByTestId("magic-link-nudge")` is `null`.

    2. `it("counter does not advance on rateLimit errorKind (429)", ...)` — mock `loginAction` (via `vi.mock`) to return `{ formError: "Too many attempts...", errorKind: "rateLimit" }`. Submit the form 5 times. Assert nudge never appears.

    3. `it("counter does not advance on server errorKind (5xx)", ...)` — mock loginAction to return `{ formError: "Something went wrong...", errorKind: "server" }`. Submit 5 times. Assert nudge never appears.

    4. `it("counter advances ONLY on credentials errorKind and shows nudge at 3 consecutive failures", ...)` — mock loginAction to return `{ formError: "Invalid email or password.", errorKind: "credentials" }`. Submit 3 times. Assert nudge appears with text containing "Trouble signing in" and "Email me a sign-in link instead".

    5. `it("clicking the nudge switches to magic-link tab and pre-fills the email field", ...)` — same 3-fail setup. Type `user@example.com` into the password-tab email field. Click the nudge button. Assert:
       - Magic-link tab is now active (`getByRole("tab", { name: /magic link/i })` has `aria-selected="true"`).
       - The magic-link email Input has `value === "user@example.com"` (via `getByLabelText(/email/i)` scoped to the magic-link panel).

    6. `it("counter survives Password ↔ Magic-link tab switching (no remount of LoginForm state)", ...)` — submit 2 credentials failures. Switch to Magic-link tab. Switch back to Password tab. Submit one more credentials failure. Assert nudge appears (counter was 2, not reset by tab switch; third failure crossed the threshold). This is the RESEARCH P2 "Tabs no-remount" invariant.

    7. `it("does NOT write to localStorage or sessionStorage at any point", ...)` — spy on `Storage.prototype.setItem`. Run through the full 3-failure sequence + nudge click + tab switch. Assert spy was NEVER called with any key referencing "fail", "counter", "attempt", or "login". (Spec the spy broadly — if any login-related write occurs, fail the test.)

    Test setup notes:
    - Use `vi.mock("./actions", ...)` (relative path from the test file; the test imports `LoginForm` which itself imports actions).
    - Use `userEvent` from `@testing-library/user-event` if available; otherwise `fireEvent.submit`.
    - For the `useActionState` mock, the simplest pattern is to mock the action to return the chosen state and then trigger form submission via fireEvent — React's useActionState will call the mocked action and update state.

    Self-checks for Task 2:
    - `grep -n "data-testid=\"magic-link-nudge\"" app/\(auth\)/app/login/login-form.tsx` — exactly one match.
    - `grep -nE "(localStorage|sessionStorage)" app/\(auth\)/app/login/login-form.tsx` — ZERO matches (AUTH-37 hard constraint, RESEARCH P5).
    - `grep -n "value=\{activeTab\}" app/\(auth\)/app/login/login-form.tsx` — exactly one match.
    - `grep -n "onValueChange" app/\(auth\)/app/login/login-form.tsx` — exactly one match (RESEARCH P8 — both must be present together).
    - `grep -n "defaultValue=\{prefillEmail\}" app/\(auth\)/app/login/login-form.tsx` — exactly one match.
    - `grep -n "Math.min(n + 1, 3)" app/\(auth\)/app/login/login-form.tsx` — exactly one match (RESEARCH P7 cap).
    - `grep -n "type=\"button\"" app/\(auth\)/app/login/login-form.tsx` — at least one match (the nudge button — RESEARCH critical).
    - `grep -Pzo '(?s)</Card>.*?Sign in with Google' app/\(auth\)/app/login/login-form.tsx` — must match (Card closes BEFORE OAuth label).
  </action>
  <verify>
    1. `npm run typecheck` — must pass.
    2. `npm run lint` — must pass.
    3. `npm run build` — must succeed.
    4. `npm test -- login-form-counter` — all 7 test cases must pass green.
    5. `npm test -- login-form-auth-29` — re-run from Task 1; still 4/4 green (no regression).
    6. `npm test` — full Vitest suite; no other test should regress.
    7. Hard constraint check: `grep -E "localStorage|sessionStorage" app/\(auth\)/app/login/login-form.tsx app/\(auth\)/app/login/actions.ts` — must return zero matches (AUTH-37 hard fail).
    8. DOM source-order regex: `grep -Pzo '(?s)</Card>.*?Sign in with Google' app/\(auth\)/app/login/login-form.tsx` — must match.
    9. Negative source-order regex: `grep -Pzo '(?s)Sign in with Google.*?<Card' app/\(auth\)/app/login/login-form.tsx` — must NOT match.
    10. AUTH-35 invariant: `grep -n 'useState<\"password\" | \"magic-link\">\(\"password\"\)' app/\(auth\)/app/login/login-form.tsx` — exactly one match. This is the v1.8 default-tab lock.
  </verify>
  <done>
    login-form.tsx has: Card-above-OAuth source order; controlled Tabs initialized to `"password"`; session-scoped `failCount` + `prefillEmail` useState at LoginForm top level; useEffect that gates the counter on `errorKind === "credentials"` with `Math.min(n+1, 3)` cap; inline nudge `<p>` rendered when `failCount >= 3` with `type="button"` action that pre-fills email and switches tab; `MagicLinkTabContent` accepts `prefillEmail` prop and applies it as Input `defaultValue`; zero localStorage/sessionStorage references; helper line from Task 1 still present and unchanged. Both test suites (counter + AUTH-29) pass. typecheck + lint + build pass.
  </done>
</task>

</tasks>

<verification>
Final phase-level checks for plan 45-03:

Build + typecheck + lint:
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build` passes.

Test suite:
- `npm test -- login-form-auth-29` — 4/4 green.
- `npm test -- login-form-counter` — 7/7 green.
- `npm test` full suite — no regressions.

Goal-backward verification (success criteria + research pitfalls):
- SC1 (login half) AUTH-33: `grep -Pzo '(?s)</Card>.*?Sign in with Google' app/\(auth\)/app/login/login-form.tsx` matches.
- SC2 AUTH-35: `grep "useState<\"password\" | \"magic-link\">(\"password\")"` exists (v1.8 default-tab lock).
- SC3 AUTH-36: `grep "magic-link-nudge"` matches and `failCount >= 3` gate present.
- SC4 AUTH-37 + AUTH-38: errorKind gating verified by counter test #2, #3, #4; storage-write spy in counter test #7 verifies AUTH-37 non-persistence; useState resets on unmount automatically (redirect on success).
- SC5 AUTH-39: helper `<p>` present in MagicLinkTabContent form-mode JSX; AUTH-29 test suite locks byte-identical copy across four states + verifies absence of state-dependent attributes.
- RESEARCH P1 (AUTH-29): tests/login-form-auth-29.test.tsx case #4 locks no state-dependent attributes.
- RESEARCH P2 (Tabs no-remount): tests/login-form-counter.test.tsx case #6 locks counter survival across tab switches.
- RESEARCH P3 (errorKind gating): cases #2, #3, #4 verify counter advances ONLY on credentials.
- RESEARCH P4 (useEffect deps on full state ref): asserted by case #4 (three consecutive identical-shape returns must still advance counter to 3).
- RESEARCH P5 (no storage): case #7 locks zero localStorage/sessionStorage writes.
- RESEARCH P6 (session-wide counter): not email-keyed — visible by inspection of the state declaration.
- RESEARCH P7 (cap at 3): `grep "Math.min(n + 1, 3)"` matches.
- RESEARCH P8 (controlled Tabs both props): `grep "value={activeTab}"` AND `grep "onValueChange"` both match.
- RESEARCH P9 (getValues at click time): nudge onClick handler contains `getValues("email")`; no `getValues` call appears at the top level of LoginForm function body.

Phase 45 verification gates (from CONTEXT/ROADMAP):
- AUTH-29 four-way invariant: locked by tests/login-form-auth-29.test.tsx.
- Reframed "V15-MP-05 Turnstile lifecycle" → Tabs no-remount of cross-tab state: locked by tests/login-form-counter.test.tsx case #6.
- 3-fail counter advances ONLY on 400 auth-rejection: locked by tests/login-form-counter.test.tsx cases #2, #3, #4.

git diff scope check:
- `git diff --name-only` shows ONLY: app/(auth)/app/login/login-form.tsx, app/(auth)/app/login/actions.ts, tests/login-form-auth-29.test.tsx, tests/login-form-counter.test.tsx. No other file is touched.
</verification>

<success_criteria>
- SC1: On /app/login, the Google OAuth button appears below the email/password form Card. ✓ (DOM source-order regex)
- SC2: /app/login opens with Password tab active by default. ✓ (controlled Tabs initialized to "password"; v1.8 invariant locked)
- SC3: After 3 consecutive HTTP 400 auth-rejection responses in the same tab session, an inline prompt appears under the password form offering to switch to magic-link, and clicking switches the tab. ✓ (counter test #4 + #5)
- SC4: Counter resets on success (unmount via redirect) and tab close (component destruction); does NOT advance on 429/5xx/network; does NOT persist in storage. ✓ (counter test #2, #3, #6, #7)
- SC5: Magic-link tab shows inline helper line under email field; wording is byte-identical regardless of email validity, throttle, or cooldown — preserving AUTH-29. ✓ (AUTH-29 test suite 4/4)

Verification gates (mandatory pre-merge):
- AUTH-29 four-way invariant: locked. ✓
- Tabs no-remount of cross-tab state: locked. ✓
- 3-fail counter gates on 400-only: locked. ✓

Hard constraints:
- Zero localStorage/sessionStorage writes (AUTH-37). ✓
- No new auth method, no Turnstile changes (out of scope per CONTEXT). ✓
- No password/magic-link/OAuth backend code path changes (only LoginState type adds errorKind discriminant; signInWithPassword + signInWithOtp + signInWithOAuth all unchanged). ✓
- AUTH-29 enumeration safety preserved (requestMagicLinkAction is NOT touched; helper line is unconditional literal). ✓
</success_criteria>

<output>
After completion, create `.planning/phases/45-login-ux-polish-and-gmail-quota-raise/45-03-SUMMARY.md` using the standard summary template. Include:
- One-line outcome ("Login UX polish: OAuth below Card, controlled Tabs default to password, 3-fail magic-link nudge with email pre-fill, AUTH-29 byte-identical helper line").
- Files modified (the 4 above — 2 source + 2 new tests).
- Confirmation that quota-guard.ts and signup-form.tsx were NOT touched.
- Test result lines: AUTH-29 4/4, counter 7/7, full suite green.
- AUTH-29 enumeration-safety contract re-verified.
- AUTH-37 storage-non-persistence locked by test #7 spy.
</output>
</content>
