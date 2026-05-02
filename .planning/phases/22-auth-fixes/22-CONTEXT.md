# Phase 22: Auth Fixes - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Three surgical fixes to existing owner-auth surfaces:

1. **AUTH-18** — `/login` "Sign up" link must navigate to `/signup` (currently broken).
2. **AUTH-19** — `/login` desktop layout flips: info pane on the LEFT, email/password form on the RIGHT at `≥768px` (currently form-LEFT, hero-RIGHT in `app/(auth)/app/login/page.tsx`).
3. **AUTH-20** — Owner sessions persist for a sliding 30-day window so Andrew isn't re-prompted during normal weekly use; new TTL applies on next login or refresh-token rotation, not retroactively to existing sessions.

Touches `/login`, `/signup` (reciprocal link only), `LoginForm`, `AuthHero`, and Supabase auth client config. **No** schema changes, **no** new auth methods, **no** new packages.

</domain>

<decisions>
## Implementation Decisions

### Sign-up link discoverability (AUTH-18)
- **/signup gets a reciprocal "Already have an account? Log in" link back to /login.** Symmetric auth pattern; small intentional addition beyond AUTH-18's stated direction.
- /login → /signup link location and copy: Claude's discretion (match Cruip-style standard auth pattern).
- Verify the actual root cause of the broken link before fixing — current href is `/app/signup` and route is `app/(auth)/app/signup/page.tsx`; confirm whether the bug is href, middleware redirect, or `<Link>` vs `<a>` usage.

### Login layout (AUTH-19)
- Desktop (`≥1024px`): info pane LEFT, form RIGHT. (Current `lg:grid-cols-2` order is reversed in `page.tsx` — form column first, then `<AuthHero />`. Swap them.)
- Mobile stacking order, desktop split ratio, info-pane content/copy, and visual lane treatment (distinct vs shared backgrounds): **all Claude's discretion**, anchored to Cruip-style split-panel direction and existing v1.2 auth skin.

### Session persistence (AUTH-20)
- Target: 30-day sliding refresh window for owner sessions.
- Always-on vs opt-in "Remember me", sliding-refresh trigger semantics, expiry UX (hard redirect vs inline re-auth), and logout scope (current device vs all devices): **all Claude's discretion** — default to Supabase's recommended/built-in patterns at a 30-day setting unless there's a clear reason to deviate.
- Existing sessions are NOT retroactively extended; new TTL kicks in on next login or refresh-token rotation. This trade-off is accepted.

### Scope lock — Cruip fidelity
- **OAuth, social login, and magic-link auth are explicitly DEFERRED to v1.4** even if the Cruip reference includes social-login buttons. Phase 22 is visual layout reference only, not feature reference.
- Form fields themselves do not change in Phase 22. Only: column flip, info-pane content, sign-up link discoverability, and session TTL.
- Cruip reference fidelity (specific template vs general vibe vs v1.2 auth skin alignment) and brand-token strictness (strict NSI lock vs NSI-adjacent accents): **Claude's discretion**.

### Claude's Discretion
The following are open for Claude to decide during planning/implementation:
- All `/login` layout details: mobile stack order, desktop split ratio, info-pane copy/content, background treatment, typography choices.
- Sign-up link copy ("Sign up" vs "Create an account") and exact placement.
- All session UX choices within the 30-day TTL goal: opt-in mechanism, sliding semantics, expiry behavior, logout scope.
- Cruip reference interpretation and degree of brand-token deviation.

</decisions>

<specifics>
## Specific Ideas

- "Cruip-style" split-panel auth direction is the visual north star — clean two-column desktop layout with branded info pane and functional form pane.
- Andrew's success metric for AUTH-20 is concrete: "close the browser, reopen the next day, hit /app, stay logged in" through a normal week of use without re-prompts.
- Anchor visual decisions on the v1.2 auth skin (Phase 16 re-skin: `BackgroundGlow`, `AuthHero`, NSI navy `#0A2540`, blue-500 accents) unless Cruip alignment requires deviation.

</specifics>

<deferred>
## Deferred Ideas

- **OAuth / social login (Google, Microsoft, etc.)** — already in v1.4 backlog; explicitly NOT in Phase 22 even if Cruip reference includes it.
- **Magic-link / passwordless auth** — v1.4 or later; not in scope.
- **MFA / 2FA** — not in scope; would be its own phase.
- **Session management UI** ("active sessions", "sign out everywhere" controls visible to owner) — not in scope; only the underlying logout behavior decision applies here.
- **Inline re-auth modal at expiry** — if Claude defaults to hard-redirect at expiry, this remains a future-phase polish item.

</deferred>

---

*Phase: 22-auth-fixes*
*Context gathered: 2026-05-02*
