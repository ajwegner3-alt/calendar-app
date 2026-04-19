# Phase 2: Owner Auth + Dashboard Shell - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Andrew can log in at `/app/login` with email + password via Supabase Auth, his session persists across refreshes via `@supabase/ssr` cookies, every `/app/*` route is gated (redirects to login when logged out), and he lands on an authenticated dashboard shell with left-sidebar nav stubs for Event Types / Availability / Branding / Bookings. His `auth.users` row is linked to the existing `nsi` account (`ba8e712d-...`) so downstream phases can read tenant-scoped data via RLS.

Covered requirements: AUTH-01, AUTH-02, AUTH-03, AUTH-04, DASH-01.

Event type CRUD, availability editor, branding upload, and bookings list are later phases — the sidebar links will exist but point to empty-stub pages in this phase.

</domain>

<decisions>
## Implementation Decisions

### How Andrew gets a session (no public signup in v1)

- **Manual auth user creation + one-time SQL link.** Andrew creates his user via Supabase Dashboard → Authentication → Add User. Once the user exists, I run a single MCP `execute_sql` to `UPDATE accounts SET owner_user_id = '<auth-uuid>' WHERE slug = 'nsi'`. No signup UI is built. This matches the locked "v1 is single-account" decision.
- **Email verification is OFF in Supabase settings.** Andrew will toggle off "Confirm email" in Dashboard → Authentication → Sign In / Up during the phase. Re-enabled when v2 ships real signup.
- **No `/forgot-password` flow in v1.** If the password is lost, reset via Supabase Dashboard. Per REQUIREMENTS.md, recovery is v2 scope.
- **Session length = Supabase defaults** — 1h access token + rolling 7-day refresh window. No JWT expiry tuning in this phase.

### Login page UX (`/app/login`)

- **Centered card on a plain background.** NSI logo at top, email + password inputs, single "Sign in" button. Standard shadcn form primitives + React Hook Form + Zod. No split-screen hero, no minimal-input-only style.
- **Errors as an inline banner above the form with a generic message.** "Invalid email or password." — does not distinguish wrong-email from wrong-password (no user enumeration). Separate tailored messages for: rate-limit (Supabase 429), unexpected network/server error. Per-field errors are reserved for client-side format validation (e.g., "enter a valid email").
- **Submit-in-flight** = button disabled + inline spinner. No full-page overlay.
- **After successful login, redirect to `/app`** (the dashboard landing). No `redirectTo` query-param preservation in v1 — a nice-to-have deferred because no owner-side page is yet bookmarkable.

### Dashboard shell layout

- **Fixed left sidebar** for primary nav with links: Event Types, Availability, Branding, Bookings. Collapses to a top bar + hamburger menu below ~768px breakpoint.
- **Landing content at `/app`** = welcome card with 3 next-step callouts ("Create an event type", "Set availability", "Pick branding"). Each callout links to its future page (empty stubs for now).
- **Logout control** = user-menu at the bottom of the sidebar. Email/name label; click opens a small menu containing "Log out". Future "Account settings" lives here too.
- **Branding for login + shell is hardcoded NSI** — NSI logo + a single primary color in Tailwind config. Per-account `brand_primary` / `logo_url` is not read from the DB yet; Phase 7 lights that up.
- **Empty-stub pages for the 4 nav links.** Each is a blank page with just the page title (e.g., `/app/event-types` renders a heading "Event Types" and "Coming in Phase 3"). Keeps nav clickable + route protection testable without scope creep.

### Owner-to-account linking + unlinked-user handling

- **Linking is manual, one-time MCP UPDATE** (above). Not an auto-link-on-first-login — avoids the code + edge cases.
- **If a logged-in user isn't linked to any account** (i.e., `current_owner_account_ids()` returns empty), show a clear error page: `/app/unlinked` or inline on `/app`, stating "This account isn't linked to a tenant. Contact the administrator." and a Log out button. This is essentially an assertion — should never trigger in v1, but prevents a silently broken dashboard if seeding drifts.
- **RLS proof for authenticated owner.** Extend the existing Vitest harness with a test that signs in as Andrew (via Supabase Auth test helper) and asserts: `select * from accounts` returns exactly 1 row (his), and tenant-scoped SELECTs on the other 5 tables return only his data. This is the authenticated side of the RLS lockout test — Phase 1 proved the anon side.

### Route protection mechanism

- **Server-side in `proxy.ts` using `@supabase/ssr`'s `supabase.auth.getClaims()` pattern.** Research explicitly says "Do not run code between createServerClient and getClaims()" — honor that. If `getClaims()` returns no user, redirect any `/app/*` request to `/app/login`. Public routes (`/`, future `/[account]/[slug]`, `/embed/*`) are unaffected.
- **Login page (`/app/login`) is a special case:** if already authenticated, redirect to `/app` (don't show a login form to a logged-in user).
- **Server Actions** for the login form submit (not a Client Component calling `supabase.auth.signInWithPassword()` directly). Keeps credentials off the client bundle and matches Next 16 + `@supabase/ssr` conventions.

### Claude's Discretion

- Exact shadcn/ui component set (Form, Input, Button, Card, Sidebar — whichever patterns the with-supabase starter exposes).
- Exact copy on the welcome card and next-step callouts. Keep it short and friendly.
- Exact loading spinner implementation (shadcn Spinner / Lucide icon / bespoke).
- Layout file structure under `app/` — server components vs client components boundary, route group naming (e.g., `(app)`, `(auth)`).
- Sidebar animation / collapse behavior on mobile.
- Whether the NSI primary color is literal hex in Tailwind or a CSS var (probably a CSS var to make Phase 7 easier).
- Icon choices for nav items (Lucide icons recommended by shadcn).

</decisions>

<specifics>
## Specific Ideas

- Sidebar pattern should feel like Linear / Vercel / Calendly's admin — persistent on left, user menu at bottom.
- NSI logo + primary color will be used at the top of the sidebar and on the login card. Hardcoded in Tailwind config for now; swap to DB-sourced in Phase 7.
- Login card should feel respectable at a client demo — not utilitarian internal-tool minimal. A client watching this sell could notice a sloppy login page.
- The welcome card's three callouts mirror the forthcoming phase order: event types (Phase 3), availability (Phase 4), branding (Phase 7). Bookings link can go to a stub saying "bookings appear here once visitors book."

</specifics>

<deferred>
## Deferred Ideas

- **Self-serve signup UI + invite codes** — v2 milestone (client onboarding).
- **Password reset flow (`/forgot-password`)** — v2 (REQUIREMENTS AUTH-03 is explicitly deferred).
- **`redirectTo` query-param preservation** on login bounce — premature; add when owners actually bookmark internal pages.
- **Account settings page** — Phase 7 (branding) or later.
- **2FA / magic link / OAuth (Google, GitHub)** — out of scope per REQUIREMENTS.md Out-of-Scope section.
- **Multiple linked users per account (team accounts)** — out of scope; product is solo-owner per tenant.
- **Full-page overlay during auth** — rejected in favor of inline spinner.
- **Per-field error distinction on login** — rejected to prevent user enumeration.
- **Per-account branding on the login + shell** — Phase 7 concern; v1 hardcodes NSI.
- **Auto-link auth user to account by email / metadata** — v2 concern; v1 does manual SQL link.

</deferred>

---

*Phase: 02-owner-auth-and-dashboard-shell*
*Context gathered: 2026-04-19*
