# Phase 45: Login UX Polish + Gmail Quota Raise - Research

**Researched:** 2026-05-11
**Domain:** Auth surface polish (login + signup forms), Radix Tabs lifecycle, in-memory failure counter, Gmail quota constant
**Confidence:** HIGH — all findings verified directly from the codebase

---

## Summary

Phase 45 is a UX-only polish phase plus a one-constant Gmail quota change. Every required pattern already lives in the codebase: `Tabs` + `TabsContent` (Radix, in `components/ui/tabs.tsx`), the `GoogleOAuthButton` (already styled per Google brand guidelines), the OR-divider markup (currently used **above** the form in both login and signup), the AUTH-29 enumeration-safe magic-link action (`requestMagicLinkAction` at `app/(auth)/app/login/actions.ts:127`), the `prefers-reduced-motion` defense-in-depth CSS rule in `app/globals.css:12`, and the tw-animate-css utility convention (`animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out motion-reduce:animate-none`) established in Phase 39-03.

The phase touches **five files** (login form, signup form, login actions, quota-guard, plus possibly the verification doc). Every change is mechanical because the patterns are already in place. The most subtle work is (a) **converting Radix `Tabs` from uncontrolled (`defaultValue`) to controlled (`value`/`onValueChange`)** so the nudge can programmatically switch to the Magic-link tab and pre-fill its email field, and (b) **threading the typed-password-tab email into the magic-link tab through component-local state** since Radix Tabs unmounts inactive `TabsContent` by default — so a sibling state at the `LoginForm` level is required.

Important: the "V15-MP-05 Turnstile lifecycle" verification gate in ROADMAP.md is **misnomered for this phase**. Turnstile is on the public booker only (`app/[account]/[event-slug]/_components/booking-form.tsx`), NOT on login/signup. The intent of that gate here is **"no remount on tab switch"** — verify by tracking that the magic-link form doesn't refetch any client-state on tab toggles. Plans should reference this as "Tabs no-remount" rather than "Turnstile lifecycle".

**Primary recommendation:** Three plans — (1) `/app/login` restructure + nudge + helper line + AUTH-29 lock test, (2) `/app/signup` OAuth reorder, (3) Gmail quota raise (single-constant + test fixture update). Plan 1 carries all the lifecycle/state risk; Plans 2 and 3 are trivial mechanical changes.

---

## Files to Modify (with current line numbers)

### 1. `app/(auth)/app/login/login-form.tsx` (260 lines total)
Primary surface for AUTH-33/35/36/37/38/39.

| Lines | Current content | Change |
|-------|-----------------|--------|
| 104-117 | Google OAuth button form + OR divider above the email card | **Move to below the Card** (after the closing `</Card>` at line 194). Flip divider semantics: card on top, divider, then OAuth button. |
| 125 | `<Tabs defaultValue="password">` | **Change to controlled:** `<Tabs value={activeTab} onValueChange={setActiveTab}>`. Add `const [activeTab, setActiveTab] = useState<"password" \| "magic-link">("password")` at line 77 next to existing state. AUTH-35 lock = `useState` initializer is `"password"`. |
| 131-187 | Password TabsContent — single `<form action={formAction}>` block with email/password fields, submit, "Don't have an account?" link | **Add 3-fail counter** (`useRef<number>(0)` or `useState<number>(0)`) advanced via a `useEffect` watching `state.formError` (see Pattern 4). **Add inline nudge** after the password field's error `<p>` at line 168 (under field, NOT above submit) — render only when counter ≥ 3. Nudge is a `<p>` with a `<button type="button">` styled as underlined link that calls `(e) => { setMagicEmailPrefill(currentTypedEmail); setActiveTab("magic-link"); }`. |
| 189-191 | `<TabsContent value="magic-link"><MagicLinkTabContent /></TabsContent>` | **Pass prefill prop:** `<MagicLinkTabContent prefillEmail={magicEmailPrefill} />`. Add `const [magicEmailPrefill, setMagicEmailPrefill] = useState("")` at line 77. |
| 211-259 | `MagicLinkTabContent` inner component (no props) | **Accept `prefillEmail?: string` prop**, set as `defaultValue` on the email `<Input>` at line 241-248. **Add static helper `<p>` under the email field**, AUTH-29-byte-identical (does NOT branch on `magicState`). Place between the `<div>` containing the Label/Input at line 239-252 and the submit button at line 253. |

**Why these specific lines:**
- Line 77 is where existing `useActionState` and `useForm` are declared — co-locating new state there keeps related state contiguous.
- Radix `Tabs` unmounts inactive `TabsContent` by default (verified at `components/ui/tabs.tsx:77-88`, no `forceMount` prop). That means switching tabs RESETS `MagicLinkTabContent`'s internal `useState` for `submittedEmail` (line 218). To pre-fill from the nudge, the email source must live in the parent (`LoginForm`) and be passed as a prop — the child can then use `defaultValue={prefillEmail}` on the uncontrolled `<Input>` and the value will appear when the tab next mounts.
- Phase 38 already chose this default-unmount behavior intentionally (RESEARCH §Open Question #2 = "Yes, clear it"); the nudge prefill works WITH this behavior, not against it.

### 2. `app/(auth)/app/signup/signup-form.tsx` (177 lines total)
AUTH-34 only (parity with AUTH-33 on `/app/signup`).

| Lines | Current content | Change |
|-------|-----------------|--------|
| 90-102 | Google OAuth button form + OR divider above the email card | **Move to below the Card** (after closing `</Card>` at line 173). |

No tabs here, no nudge, no counter. Pure DOM reorder.

### 3. `app/(auth)/app/login/actions.ts` (184 lines total)
Likely **NO change required**. The existing `loginAction` already gates on `error.status`:
- Line 49-53: `error.status === 429` → rate-limit message; `!error.status || error.status >= 500` → "Something went wrong"; default (400/credentials) → `"Invalid email or password."`
- This is exactly the 3-state shape AUTH-38 needs. The 3-fail counter on the client can advance ONLY when `state.formError === "Invalid email or password."`. The two other branches (rate-limit, 5xx/network) produce a DIFFERENT `formError` string, so a simple string-equality gate is sufficient. NO new state shape is required.

**Alternative (cleaner):** Add a discriminated `state.errorKind: "credentials" | "rateLimit" | "server" | undefined` to `LoginState` (line 10-13) so the client doesn't depend on copy. RECOMMEND this — copy strings will eventually drift and break the counter. Cost: ~10 LOC.

### 4. `lib/email-sender/quota-guard.ts` (173 lines total)
EMAIL-35 — single-line change.

| Line | Current | Change |
|------|---------|--------|
| 18 | `export const SIGNUP_DAILY_EMAIL_CAP = 200;` | `export const SIGNUP_DAILY_EMAIL_CAP = 400;` |

The 80% warning threshold is **derived** at runtime: `count >= SIGNUP_DAILY_EMAIL_CAP * WARN_THRESHOLD_PCT` at line 118. With cap=400 and pct=0.8, threshold automatically becomes 320. **No second constant exists to change.** The header comment at lines 4-17 should also be updated (200 → 400, "40%" → "80%" of Gmail's 500/day soft limit). CONTEXT.md's "single-constant change" is literally one digit.

### 5. `tests/quota-guard.test.ts` (260+ lines)
Fixture updates — multiple lines reference `200`, `160`, `170` as quota numbers:
- Line 126: comment `count = 100, cap = 200, threshold = 160` → `cap = 400, threshold = 320`
- Line 139-140: `count = 160 = 80% of 200 → exactly at warn threshold` and `setCountResult(160)` → `setCountResult(320)`
- Line 148: assertion `"160/200"` → `"320/400"`
- Line 152-153: `count = 200 = cap → must throw` and `setCountResult(200)` → `setCountResult(400)`
- Line 180, 183, 201, 203: hardcoded 200s in the deep-mock at-cap test
- Line 226, 236: `setCountResult(170)` (85% of 200) → `setCountResult(340)` (85% of 400); `"170/200"` → `"340/400"`
- Line 21 docblock: `count >= 200` → `count >= 400`

This is mechanical find-and-replace, but **every literal 200 or 160 in the test file must be migrated** — if any are missed, the test will pass on the old constant accidentally. Recommend grepping `\\b(160|200)\\b` in just this file and walking each match.

---

## Components / Patterns to Reuse

### Existing primitives (DO NOT rebuild)
| Component | Location | What it does |
|-----------|----------|--------------|
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `components/ui/tabs.tsx:9-90` | Radix wrapper; supports controlled mode via `value`/`onValueChange` |
| `GoogleOAuthButton` | `components/google-oauth-button.tsx:34-87` | Google-branded outlined button — already secondary visual weight per CONTEXT |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `components/ui/card.tsx` | Card chrome — used for email/password form |
| `Alert`, `AlertDescription` | `components/ui/alert.tsx` | Used for `formError`/`resetSuccess` |
| OR-divider DOM pattern | `app/(auth)/app/login/login-form.tsx:109-117` and `signup-form.tsx:94-102` | Identical HR-with-centered-OR markup — reuse verbatim when relocating |

### OR-divider markup to reuse (verbatim)
```tsx
<div className="relative my-4">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-gray-200" />
  </div>
  <div className="relative flex justify-center text-sm">
    <span className="bg-white px-3 text-gray-500">or</span>
  </div>
</div>
```
This is byte-identical in `login-form.tsx:110-117` and `signup-form.tsx:95-102`. CONTEXT calls for "small-caps OR" — current is lowercase `or`. **Either keep `or` (existing convention; lowest risk) or change to `OR` (CONTEXT's small-caps intent could be served by `text-xs uppercase tracking-wide` styling).** RECOMMEND: keep lowercase `or` to match v1.7 ship; if CONTEXT's small-caps is non-negotiable, use `<span className="bg-white px-3 text-xs uppercase tracking-wider text-gray-500">or</span>` — adds 3 utility classes.

### Phase 38 helper-line / footer-link conventions to match
| Pattern | Class string | Where seen |
|---------|--------------|------------|
| Muted center footer link | `text-center text-sm text-muted-foreground` | `login-form.tsx:177`, `signup-form.tsx:152, 162` |
| Inline link inside that text | `underline underline-offset-4 hover:text-foreground` | `login-form.tsx:181`, `signup-form.tsx:156` |
| Form helper sub-text | `text-xs text-muted-foreground` | `magic-link-success.tsx:68` |
| Inline field error | `text-sm text-destructive` | `login-form.tsx:155, 168, 250` |
| Subtitle under page header | `mt-2 text-sm text-gray-600` | `login/page.tsx:39`, `signup/page.tsx:40` |

**Recommended magic-link helper line styling:** `text-xs text-muted-foreground` (matches `magic-link-success.tsx:68` "The link expires in 15 minutes." — already the established sub-input helper convention for this exact form).

**Recommended nudge styling:** `text-sm text-muted-foreground` for the wrapping `<p>`, with the action `<button>` styled as `underline underline-offset-4 hover:text-foreground font-medium` (mirrors footer link pattern in `login-form.tsx:181` but slightly bolder to signal action). The CONTEXT says "no box, no border, no banner" — this matches.

### Phase 39 animation conventions to match
Established in Plan 39-03 (`booking-shell.tsx:260` and `globals.css:12-18`):
- **Tw-animate-css utility:** `animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out motion-reduce:animate-none`
- **Defense-in-depth CSS** already in `globals.css:12-18`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .animate-in, .animate-out {
      animation: none !important;
      transition: none !important;
    }
  }
  ```
- The `motion-reduce:animate-none` Tailwind variant is sufficient; the global rule is a belt-and-suspenders safeguard already present.
- For the nudge, use a **shorter, subtler animation** since it's small inline text, not a column reveal. Suggested: `animate-in fade-in duration-[200ms] ease-out motion-reduce:animate-none` (no slide). CONTEXT marks animation as Claude's discretion; the fade-only is the most subdued match for "purely aesthetic" intent.

### Component-local state pattern for 3-fail counter
The existing `useActionState` returns `state` after each form action invocation. The cleanest counter implementation:

```tsx
// In LoginForm, near line 77:
const [failedCount, setFailedCount] = useState(0);

// Effect — advance counter ONLY on a fresh credentials-rejection:
useEffect(() => {
  if (!state.formError) return;
  // Cap at 3 internally — per CONTEXT decision
  if (failedCount >= 3) return;
  // Gate on error kind, NOT copy string (see action.ts proposed change above)
  if (state.errorKind === "credentials") {
    setFailedCount((n) => Math.min(n + 1, 3));
  }
}, [state]); // Re-runs when useActionState returns a new state object
```

**Important:** `useActionState` returns a **new state object** on each form submit, so the `useEffect` dependency `[state]` fires per-submit. Do NOT depend on `[state.formError]` alone — two consecutive rejections with the same error string would not advance the counter (string equality means effect doesn't re-run). The full `state` reference identity changes on each action invocation; depend on that.

Reset rules:
- **Successful login** → never reached (action redirects via `redirect("/app")` at line 61, unmounts everything).
- **Tab/window close** → `useState` is naturally per-component-instance; closing the tab destroys it. No persistence layer touched (V18-MP-06 prevention).

**Implementation choice:** Use `useState` over `useRef`. `useRef` would NOT trigger a re-render when the counter changes, so the nudge wouldn't appear. The counter needs to drive UI → `useState` is required.

### Pre-fill mechanism (typed-password-tab email → magic-link tab)
Capture the typed email at nudge-click time. Use react-hook-form's `getValues` to read the current Password-tab email input WITHOUT requiring a submit:

```tsx
const { register, getValues, formState: { errors } } = useForm<LoginInput>({ ... });

// Nudge button onClick:
onClick={() => {
  const currentEmail = getValues("email") ?? "";
  setMagicEmailPrefill(currentEmail);
  setActiveTab("magic-link");
}}
```

`getValues` does not trigger validation or submission — just reads the current field state. Pass `magicEmailPrefill` as a prop to `MagicLinkTabContent`, and use it as `defaultValue` on the email `<Input>` (line 241-248 currently has no `defaultValue`). Setting `defaultValue` on a fresh-mount uncontrolled input populates it correctly. CONTEXT lock: "One-click recovery — does NOT auto-submit" — `defaultValue` only fills the field; the user still clicks "Send login link".

---

## Pitfalls to Avoid

### Pitfall 1: AUTH-29 byte-identical contract regression (V18-MP-03)
**What goes wrong:** Adding the magic-link helper line under the email field conditionally — e.g., showing it only before the first submit, or hiding it when `magicState.success` is true — breaks the four-way invariant: response DOM for unknown email + rate-limited + Supabase 60s cooldown + genuine send must be byte-identical.

**Why it happens:** A developer might think "show helper before submit, hide after success" is helpful UX. But after submit, `MagicLinkSuccess` REPLACES the form entirely (line 221-223 of login-form.tsx: `if (magicState.success && submittedEmail) return <MagicLinkSuccess email={...} />`). So the helper line is only ever rendered on the FORM view, which is shown only when `magicState.success` is falsy. CONTEXT lock: "Static — does not toggle in/out on submit."

**How to avoid:**
1. Render the helper line UNCONDITIONALLY inside the form-mode branch (i.e., as a sibling to the `<Input>` div, BEFORE the `<Button>`).
2. The helper text must be a literal string in the JSX, NOT pulled from `magicState` or `magicState.formError` or any computed source.
3. Do NOT add the helper line inside `MagicLinkSuccess` — keep it form-side only.
4. Existing `if (magicState.success && submittedEmail)` swap-out at line 221 stays. After swap, NEITHER state shows the helper. That's the correct four-state coverage because all four AUTH-29 cases produce `success: true` and render `MagicLinkSuccess` — IDENTICAL DOM.
5. Verification test: submit known email → `MagicLinkSuccess` renders. Submit unknown email → `MagicLinkSuccess` renders. Both DOM trees byte-identical for the same `submittedEmail`. The HELPER line never appears in either case (because it lives on the form view, not the success view). AUTH-29 holds.

**Warning signs:**
- Any `magicState.*` reference inside the helper `<p>` JSX.
- Any conditional `{!magicState.formError && <p>helper</p>}` or similar.
- The helper rendered both inside `MagicLinkSuccess` AND on the form (introduces a DOM-difference vector across the success view if one state has it and the other doesn't).

### Pitfall 2: "Turnstile lifecycle" gate confusion (LD-07 misnomer)
**What goes wrong:** ROADMAP §Verification gates lists "V15-MP-05 Turnstile lifecycle: widget mounts exactly once per page load through tab switching." But **Turnstile is NOT on the login/signup forms** (verified: grep `turnstile` returns matches only in `app/[account]/[event-slug]/_components/booking-form.tsx`, `booking-shell.tsx`, `booking-form-skeleton.tsx`, `app/api/bookings/route.ts`, and `reschedule/[token]/_components/reschedule-shell.tsx`).

**Why it happens:** v1.7 archive references propagated the V15-MP-05 lock into v1.8 verification by analogy. The TRUE intent for Phase 45: "no remount of state-bearing components on tab switch."

**How to avoid:**
1. Plans should re-frame the gate as: "Tabs no-remount of cross-tab state — failure counter persists, page-level state (like `magicEmailPrefill`) persists across tab toggles."
2. Specifically: failed-attempt counter lives on `LoginForm` (not inside `TabsContent`). Tab switching does NOT reset it. (Radix Tabs only unmounts `TabsContent` children — parent state survives.)
3. Verification: open login page, fail password 2 times, switch to Magic-link tab, switch back to Password tab, fail 1 more time → nudge appears (counter=3). If counter resets on tab switch, the implementation has incorrectly placed `useState` inside `TabsContent`.

### Pitfall 3: Counter advances on 5xx or network errors (V18-MP-05)
**What goes wrong:** A naive `useEffect(() => { if (state.formError) setFailedCount(n => n + 1); }, [state])` advances the counter for ALL errors, including 429 rate-limit and 5xx server errors.

**Why it happens:** The current action returns a single `formError: string` for all error kinds (line 48-54 of actions.ts). Without a typed discriminant, the client cannot tell credentials-rejection from rate-limit from 5xx.

**How to avoid:** Add `errorKind: "credentials" | "rateLimit" | "server" | undefined` to `LoginState` (actions.ts line 10-13) — set in each error branch of `loginAction` at lines 35-54. Counter gate becomes `if (state.errorKind === "credentials") setFailedCount(...)`. This is the cleanest implementation per V18-MP-05 prevention guidance.

**Alternative:** Gate on the literal `formError === "Invalid email or password."` string. WORKS but is brittle — copy drift will silently break the counter. Discouraged.

### Pitfall 4: useActionState state-identity behavior with consecutive identical errors
**What goes wrong:** React 19's `useActionState` returns a new state OBJECT for each action invocation, even if the contents are identical. But if a developer instead memoizes the state or pulls `state.formError` into a string-keyed dependency array, two consecutive rejections with the same error string would not advance the counter.

**How to avoid:** Depend on the full `state` reference in `useEffect`, not its string fields. The hook's identity contract gives a fresh object per submit. Verified: `useActionState` in React 19 follows this pattern.

### Pitfall 5: Persistent counter via storage (V18-MP-06)
**What goes wrong:** A future developer adds `localStorage.setItem("loginAttempts", ...)` to "remember" failed attempts across reloads.

**How to avoid:** CONTEXT explicitly forbids storage. AUTH-37 requirement = "resets on tab/window close (no localStorage/sessionStorage persistence)". `useState` is naturally per-component-instance — no storage code needed. Verification gate: grep `(localStorage|sessionStorage)` in the diff — must be zero matches.

### Pitfall 6: Counter scope mismatch with CONTEXT
**What goes wrong:** Implementation per-email (counter resets when user changes email) but CONTEXT says **session-wide** (one counter per tab regardless of typed email).

**How to avoid:** Counter `useState` is declared at `LoginForm` top level, NOT keyed by email. Changing the email value does NOT reset it. Verification test: type wrong password 2x with email A, change to email B, fail 1x → nudge appears at attempt 3.

### Pitfall 7: Counter cap missing — escalation past 3 advances state needlessly
**What goes wrong:** Counter increments unbounded. After the nudge is shown, additional failures still advance state, triggering re-renders.

**How to avoid:** Cap at 3 inside the effect: `setFailedCount(n => Math.min(n + 1, 3))`. CONTEXT lock: "Counter caps at 3 internally; further failures are no-ops."

### Pitfall 8: Tabs uncontrolled → controlled conversion subtlety
**What goes wrong:** Switching `<Tabs defaultValue="password">` to `<Tabs value={activeTab} ...>` without also providing `onValueChange` causes the trigger clicks to no-op (Radix sees the value as locked).

**How to avoid:** Always pair `value` with `onValueChange`. Final shape:
```tsx
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "password" | "magic-link")}>
```

### Pitfall 9: getValues during form render
**What goes wrong:** Calling `getValues("email")` from inside the JSX (rather than inside an event handler) reads the field on every render and can desync with form state during validation cycles.

**How to avoid:** Only call `getValues` inside the nudge button's `onClick` handler — never during render.

### Pitfall 10: Quota-guard header comment drift
**What goes wrong:** The header comment at lines 4-17 hardcodes "200/day" and "40% of Gmail's ~500/day soft limit". If only line 18 changes, the comment misleads future readers.

**How to avoid:** Update the comment block at lines 4-17: "400/day = 80% of Gmail's ~500/day soft limit, leaving headroom..." (or whatever new framing is accurate).

### Pitfall 11: Test fixture drift (multiple 200/160 literals)
**What goes wrong:** `tests/quota-guard.test.ts` has 200 and 160 as literals in test assertions, deep-mocks, and comments at MANY lines. Updating only `SIGNUP_DAILY_EMAIL_CAP` will cause some tests to fail (count=200 no longer at cap, count=160 no longer at warn threshold).

**How to avoid:** Walk every `\\b(160|170|200)\\b` match in the test file and migrate each to the proportional new value (320/340/400). Run `npm test -- quota-guard` and confirm green before commit.

---

## Test Approach

### Existing test surface
- **Vitest** is the test runner. Config at `vitest.config.ts`. Tests live in `tests/*.test.ts(x)`.
- No Playwright / E2E framework in the repo. No login/signup form tests currently exist (`grep login|signup|magic-link` in tests/ returns zero matches).
- Quota-guard has a unit test at `tests/quota-guard.test.ts` with deep Supabase admin mocks — same pattern to follow for the cap change.

### Recommended tests for Phase 45
| Test name | Type | What it covers |
|-----------|------|----------------|
| `tests/quota-guard.test.ts` (modify) | Unit | EMAIL-35 — cap is 400, warn threshold is 320. Update all numeric fixtures. |
| `tests/login-form-counter.test.tsx` (new) | Unit (Vitest + Testing Library) | AUTH-36/37/38 — counter advances on 3x credentials-rejection but NOT on 429 or 5xx; resets on remount; pre-fills magic-link email on nudge click. |
| `tests/login-form-auth-29.test.tsx` (new) | Unit | AUTH-29 — render `MagicLinkTabContent` with form-state for both success and form view; snapshot byte-identical DOM. |

**On E2E:** CONTEXT calls out manual QA in the final phase. The lock validations (counter behavior, tab default, helper-line invariance) are best validated via React Testing Library Vitest tests, not browser E2E.

**On Vitest + Testing Library:** Verify it's installed:
- `package.json` exists in repo root — check `@testing-library/react` presence before assuming. (Day-detail tests are `.test.tsx` files which suggests it IS installed; verify in plan.)

### Verification commands per plan
- `npx tsc --noEmit` — type safety
- `npm test -- quota-guard` — quota tests pass
- `npm test -- login-form` — counter + AUTH-29 tests pass (after creating)
- `npm run build` — Next.js build succeeds
- Manual: live preview of `/app/login` and `/app/signup` after deploy — visual verification per CONTEXT's "purely aesthetic" framing

---

## Recommended Plan Breakdown

Three plans, sequenced by independence and risk:

### Plan 45-01: Gmail quota raise (EMAIL-35) — START HERE
**Why first:** Trivial, mechanical, zero coupling to other changes. Gets the production benefit (raised daily cap) immediately even if UX plans take longer.
**Touch:** `lib/email-sender/quota-guard.ts` (1 line + comment update), `tests/quota-guard.test.ts` (find-and-replace `200|160|170|200` literals).
**Risk:** LOW. No new logic. No new code paths. Test suite validates.
**Verification gate:** `npm test -- quota-guard` green.

### Plan 45-02: Signup OAuth reorder (AUTH-34)
**Why second:** Smallest UI change. No state, no counters, no AUTH-29 implications. Validates the relocate pattern visually before applying the same move to the more complex login form.
**Touch:** `app/(auth)/app/signup/signup-form.tsx` (move lines 90-102 to after line 173, swap divider's `my-4` positioning).
**Risk:** LOW. Pure DOM reorder.
**Verification gate:** Manual visual check of `/app/signup` — Google button under "Already have an account?" footer link. Build succeeds.

### Plan 45-03: Login UX polish (AUTH-33, AUTH-35, AUTH-36, AUTH-37, AUTH-38, AUTH-39)
**Why last:** All the lifecycle/state risk lives here. Touches counter logic, Tabs controlled-mode conversion, AUTH-29 byte-identical helper line, nudge pre-fill, and OAuth relocation.
**Touch:**
- `app/(auth)/app/login/login-form.tsx` (extensive — see Files to Modify §1)
- `app/(auth)/app/login/actions.ts` (add `errorKind` discriminant to `LoginState`)
- `app/(auth)/app/login/page.tsx` (optionally update subtitle copy at line 39-41 to reflect new layout)
- New: `tests/login-form-counter.test.tsx`, `tests/login-form-auth-29.test.tsx`

**Risk:** MEDIUM. The five lockfile-grade invariants (AUTH-29 byte-identical, AUTH-37 no-storage, AUTH-38 status-only counter advance, AUTH-35 password-default, Tabs no-remount of parent state) all live in one diff. Plan should sequence sub-tasks as: (a) move OAuth + divider, (b) convert Tabs to controlled, (c) add helper line (AUTH-29 first because it's the highest-risk regression), (d) add counter + nudge, (e) add tests.

**Verification gate:** Both new test files green; manual QA in final phase verifies all 6 ROADMAP success criteria.

### Why NOT bundle 45-02 with 45-03
Bundling tempts a developer to make `signup-form.tsx` reorder atomic with the login changes. But that couples a 12-line trivial change with a 100+ line complex change — if the login work fails review, the signup fix is held hostage. Separate atomic commits = independent ship/revert.

### Why NOT split nudge from helper line within 45-03
Both touch `MagicLinkTabContent` and both are AUTH-29-adjacent. Splitting risks the nudge plan being merged before the helper-line plan is verified, leaving an intermediate state where the prefill works but AUTH-29 byte-identical is unverified. Bundle them.

---

## Open Questions

### Q1: Should `loginAction` add a typed `errorKind` discriminant?
**What we know:** The current `state.formError` is a string only. Counter gate by string-equality WORKS but is brittle.
**What's unclear:** Plans could go either way — string-equality gate is 0 LOC of action change; discriminant is ~10 LOC. CONTEXT says counter logic is Claude's discretion.
**Recommendation:** Add `errorKind: "credentials" | "rateLimit" | "server" | undefined`. The 10-LOC cost buys robustness against copy drift, which is the most likely cause of future counter bugs.

### Q2: Should the nudge animation use `slide-in-from-bottom-2` or fade-only?
**What we know:** Phase 39 uses fade + 8px rise for a column-level reveal (large element).
**What's unclear:** Whether a small inline text element warrants the same motion language.
**Recommendation:** Fade-only (`animate-in fade-in duration-[200ms] ease-out motion-reduce:animate-none`). Small inline text rising from below could feel busy.

### Q3: Should `/signup` use different OAuth button copy than `/login`?
**What we know:** Current copy is "Sign in with Google" (login) and "Sign up with Google" (signup). CONTEXT marks this as Claude's discretion.
**Recommendation:** Keep existing copy. "Sign in / Sign up with Google" is correct and reads naturally per surface. No change needed.

### Q4: Small-caps "OR" vs lowercase "or" in divider
**What we know:** Current is lowercase `or`. CONTEXT says "centered small-caps OR label."
**Recommendation:** Lowercase `or` is the existing convention. If small-caps is non-negotiable, use `text-xs uppercase tracking-wider` styling — minimal class addition.

---

## Sources

### Primary (HIGH confidence — all from codebase)
- `app/(auth)/app/login/login-form.tsx:1-260` — current login form structure
- `app/(auth)/app/signup/signup-form.tsx:1-177` — current signup form structure
- `app/(auth)/app/login/actions.ts:1-184` — loginAction + requestMagicLinkAction (AUTH-29 swallow)
- `app/(auth)/app/login/magic-link-success.tsx:1-87` — success-view DOM (post-submit)
- `app/(auth)/app/login/schema.ts:1-15` — `magicLinkSchema` shape
- `components/ui/tabs.tsx:1-90` — Radix Tabs wrapper, no `forceMount` default
- `components/google-oauth-button.tsx:1-87` — Google-branded button (no change needed)
- `lib/email-sender/quota-guard.ts:1-173` — single-constant cap
- `tests/quota-guard.test.ts:1-260+` — fixtures with literal 200/160
- `app/globals.css:7-18` — defense-in-depth prefers-reduced-motion
- `.planning/phases/39-booker-polish/39-03-entry-animation-and-reduced-motion-PLAN.md` — tw-animate-css convention
- `.planning/phases/38-magic-link-login/38-RESEARCH.md` — Tabs default-unmount behavior verified
- `.planning/REQUIREMENTS.md:16-26` — AUTH-33..39 + EMAIL-35 text
- `.planning/research/PITFALLS.md:232-292` — V18-MP-03, V18-MP-04, V18-MP-05, V18-MP-06
- `.planning/research/ARCHITECTURE.md:505` — confirms Turnstile NOT on login form
- `.planning/research/FEATURES.md:35, 300, 370` — Phase 45 design intent

### Verified (codebase grep results)
- `grep Turnstile` returns matches only in `app/[account]/[event-slug]/_components/*` and `app/api/bookings/route.ts` and `app/reschedule/[token]/_components/*` — NONE in auth surfaces. V18-MP-04 "tab-switch Turnstile remount" pitfall is structural-pattern guidance for this phase, not a literal Turnstile concern.
- `grep "(localStorage|sessionStorage)"` in `app/(auth)/` returns no matches — V18-MP-06 baseline is clean.

---

## Metadata

**Confidence breakdown:**
- File locations + line numbers: HIGH — all verified by direct file read
- Tabs controlled-mode mechanics: HIGH — verified at `components/ui/tabs.tsx` (Radix passthrough)
- AUTH-29 byte-identical contract: HIGH — verified in `requestMagicLinkAction` server-side error-swallow at actions.ts:165-179
- 3-fail counter implementation: HIGH — pattern verified against `useActionState` + `useEffect` React 19 semantics
- Pre-fill mechanism: HIGH — `getValues` + `defaultValue` is canonical react-hook-form usage
- Turnstile gate reframing: HIGH — codebase grep is definitive
- Quota constant change: HIGH — single export at line 18; no per-caller branching exists

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (codebase-only research; only invalidated by upstream library bumps which are unlikely in 30 days)
