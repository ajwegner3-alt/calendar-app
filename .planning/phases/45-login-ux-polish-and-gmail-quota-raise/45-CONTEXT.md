# Phase 45: Login UX Polish + Gmail Quota Raise - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish to existing auth surfaces (`/app/login`, `/app/signup`) plus a one-line Gmail daily-cap configuration change. Specifically:

1. Reposition the Google OAuth button below the email/password form (currently above).
2. Make the Password tab the default on `/app/login` (currently Magic-link).
3. Add a 3-fail magic-link nudge under the password form.
4. Add a uniform helper line on the Magic-link tab that is byte-identical for all email states (preserves AUTH-29).
5. Raise `lib/email-sender/quota-guard.ts` daily quota constant from 200 to 400 and the 80% warning threshold from 160 to 320.

The user's framing for this phase: **"This change is purely aesthetic."** Behavioral changes (counter scope, reset rules) should default to the simplest existing patterns; UX/visual polish is the primary deliverable.

Out of scope: any new auth method, any change to enumeration-safety contract, any change to Turnstile lifecycle, any change to the underlying password/magic-link/OAuth backend code paths.

</domain>

<decisions>
## Implementation Decisions

### Google OAuth treatment
- **Position:** Below the email/password form card on BOTH `/app/login` and `/app/signup`.
- **Divider:** Horizontal rule with a centered small-caps "OR" label between the form and the Google button.
- **Visual weight:** Equal width to the primary CTA but **secondary style** — outlined / neutral background, NOT the brand-primary fill. Signals "alternative path" without burying it.
- **Icon + label:** Standard Google G logo + "Continue with Google" (per Google sign-in brand guidelines).
- **Login vs. signup copy:** Claude's discretion — match whatever reads naturally per surface (e.g., "Continue with Google" on login, optionally "Sign up with Google" on signup, or identical on both).

### 3-fail magic-link nudge
- **Style:** Inline text with an action link styled as an underlined link. No box, no border, no banner. Placed under the password field, not above the submit button.
- **Wording:** Recovery-framed — something along the lines of "Trouble signing in? Email me a sign-in link instead." (Final copy at Claude's discretion within this intent.)
- **Click behavior:** Auto-switches to the Magic-link tab AND pre-fills the email field with whatever the user typed on the Password tab. One-click recovery — does NOT auto-submit.
- **Animation:** Claude's discretion — match Phase 39 animation conventions (likely a subtle fade-in respecting `prefers-reduced-motion`, or instant if Phase 39 patterns favor that).
- **Dismissibility:** Persists until the counter resets (successful login OR tab/window close). No X button — user cannot dismiss it.
- **Post-nudge escalation:** Claude's discretion — default to "nudge stays, no escalation" (4th, 5th, Nth failure don't change copy or styling). Counter caps at 3 internally to avoid integer drift.

### Magic-link helper line
- **Timing:** Always present under the email field from the moment the tab loads. Static — does not toggle in/out on submit.
- **Content:** Generic, expectation-setting instruction. Something along the lines of "We'll email you a sign-in link if this address is registered." Final wording at Claude's discretion within this intent.
- **Tone:** Claude's discretion — match whatever tone Phase 38 helper lines already use across the auth surfaces.
- **AUTH-29 lock:** The helper string is **byte-identical for every email submission**, full stop. Known / unknown / rate-limited / Supabase OTP cooldown — all four states render the same DOM. Rate-limit and 5xx surfacing happen elsewhere (preserve the v1.7 5xx-only `formError` gate; do NOT introduce client-side branching in the helper itself).

### Failure counter edges
- **Scope:** Session-wide (one counter for the tab regardless of which email is typed).
- **Trigger:** Strict — only HTTP 400 auth-rejection responses from Supabase advance the counter. 429 rate-limit, 5xx server errors, and network errors do NOT advance. (Confirms V18 gate.)
- **Reset rules:** Per user direction, "go with what is currently in place — this is purely aesthetic." Claude's discretion: default to the simplest implementation (counter as a `useRef` or local `useState` in the login form component; resets on successful auth + unmount/tab-close, which is already the implicit behavior of component-local state). Do NOT introduce per-email keying, time-based decay, or tab-switch resets unless they fall out of the simplest implementation for free.
- **Post-nudge:** Counter caps at 3; further failures are no-ops on the nudge.

### Gmail quota raise (EMAIL-35)
- **`lib/email-sender/quota-guard.ts`:** Daily quota constant raised from 200 → **400**. Warning threshold from 160 → **320** (80% of 400).
- **Single-constant change:** No per-caller branching. No new logic. No new logging.
- **Carry-forward:** No PREREQ required — Gmail send caps for personal Workspace accounts comfortably exceed 400/day for the volume NSI handles; this is a software cap raise, not a Google-side quota change.

### Claude's Discretion
- Final copy strings for the nudge link, the magic-link helper, and the OAuth divider label ("OR" capitalization, spacing).
- Exact animation timing for the nudge (or no animation — match Phase 39 conventions).
- Whether the OAuth button on `/signup` uses different copy than `/login`.
- Counter implementation details (useRef vs useState; component-local state shape).
- Visual spacing between the HR divider and the surrounding form / OAuth button.
- Whether the failed-attempt counter is shared across the Password tab between component mounts in the same browser tab (depends on where it lives in the component tree — Claude picks the simplest tree-stable location).

</decisions>

<specifics>
## Specific Ideas

- "This change is purely aesthetic" — overall framing from Andrew. Treat behavioral choices that aren't visible to the user as Claude's discretion; prioritize visual polish that owner-facing users will actually notice.
- OAuth visual pattern: standard "form → divider → OAuth secondary button" stack matches what Andrew has seen on most modern SaaS sign-in pages. No need to reinvent.
- The 3-fail nudge should feel helpful, not punitive. "Trouble signing in?" framing, not "Too many attempts."
- The magic-link helper line is recovery-oriented documentation — it tells the user what's about to happen so they don't feel like they're submitting into a void.

</specifics>

<deferred>
## Deferred Ideas

None — the four discussed areas plus the Gmail quota raise cover the full scope of Phase 45 as defined in ROADMAP.md. No scope-creep ideas surfaced during discussion.

</deferred>

---

*Phase: 45-login-ux-polish-and-gmail-quota-raise*
*Context gathered: 2026-05-11*
