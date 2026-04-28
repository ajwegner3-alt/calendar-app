# Phase 10: Multi-User Signup + Onboarding - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A new visitor can sign up at `/signup`, verify their email, complete a 3-step onboarding wizard (display name + slug → timezone confirm → first event type), and arrive at a working dashboard with their own bookable URL — without Andrew touching a database. Includes password reset (closing the v1.0 `/auth/callback` 404 BLOCKER), `/app/settings/profile` for self-service account management, and rate-limiting on `/api/auth/*` endpoints.

Multi-user signup ships free (no Stripe/billing in v1.1). All visual/branding work is Phase 12 — Phase 10 ships functional auth/onboarding pages that may carry minimal styling and get re-skinned later.

</domain>

<decisions>
## Implementation Decisions

### Signup form (`/signup`)
- Form collects **email + password only** — display name, slug, timezone, and first event type are captured in the onboarding wizard after email verification.
- Generic "If your email is registered, you'll receive a verification link..." messaging on submit (does NOT leak whether email is already registered — locked by ROADMAP.md success criterion #5).

### Email verification UX
- After signup submit, route user to a **dedicated `/auth/verify-email` page** with: "Check your inbox at {email} — click the link to continue."
- Page includes a **resend verification email** button.
- User stays on this page until they click the email link in another tab/device (or close the tab).

### Onboarding wizard flow
- **Step 2 timezone default**: auto-detect via browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`), pre-select that IANA TZ in the dropdown, user confirms or changes.
- **Step 3 first event type is required** — user cannot reach the dashboard without creating at least one event type. Guarantees a working bookable URL on day 1.
- **Wizard abandonment**: persist progress server-side (e.g., `accounts.onboarding_step` column or equivalent state). If a user verifies their email but abandons the wizard, logging back in resumes them at the step they left off — they never see step 1 twice.

### Slug picker (Step 1 of wizard)
- **Auto-suggest from display name**: as user types display name, slug field fills with kebab-cased version ("Acme HVAC" → "acme-hvac"). User can override before submit.
- **Live availability check (debounced)**: ~300ms debounced check against `accounts.slug` + `RESERVED_SLUGS`. Inline green/red indicator next to the field.
- **Reserved slug message**: "This URL is reserved" (does NOT leak the full reserved-slug list — distinguishable from "taken by another tenant" messaging).
- **Slug is editable later** from `/app/settings/profile`. When a user changes their slug, the **old slug 404s immediately** — clean break, no 301 redirect. User is responsible for updating any embedded links on their website.

### Profile settings (`/app/settings/profile`)
- Editable fields: **display name, password, slug, email**.
  - Email change requires confirm-new-email re-verification flow (acknowledged scope expansion vs. ROADMAP.md baseline — flag for plan-phase to scope a dedicated plan or carve out for v1.2 if it threatens Phase 10 timeline).
  - Password change requires current-password challenge (locked by ROADMAP.md success criterion #4).
- Read-only: account created date.
- Soft-delete button at the bottom of the page.

### Soft-delete UX
- **Confirmation: type slug to confirm** (GitHub-style). User must type their exact account slug into a text input before the delete button activates.
- **Timing: immediate, no undo in v1.1**. Account flagged deleted instantly. Public surfaces (`/[slug]`, `/[slug]/[event]`, `/embed/[slug]/[event]`) return 404. User is logged out. No restore mechanism — a "deleted account is gone" model.

### Claude's Discretion
- **Password policy** — pick a sensible default (recommend 8-char minimum, no character-class requirements; Supabase enforces basics).
- **Expired/invalid verification token UX** — pick the cleaner flow (recommend dedicated error page with "Resend verification email" action that re-prompts for email).
- **First event type pre-fill** — pick lowest-friction default (recommend pre-filled "30-min consultation" template that user can edit name/duration of, rather than blank or pick-from-templates).
- **All visual styling** — Phase 12 owns the branded restyle of `/signup`, `/login`, `/auth/reset-password`, `/auth/verify-email`, the wizard, and `/app/settings/profile`. Phase 10 should ship unstyled-but-functional or minimally-styled pages.
- **Rate-limit thresholds** on `/api/auth/*` — reuse the v1.0 `rate_limit_events` table; pick reasonable per-IP thresholds.
- **Resend verification email rate limit** — pick a sensible per-email/per-IP cap (recommend 1/min, 5/hour).

</decisions>

<specifics>
## Specific Ideas

- The signup → verify → wizard → dashboard flow is the **most-watched UX surface** of v1.1 — every contractor's first impression. Even though styling is Phase 12, the *flow shape* (form fields, wizard sequencing, abandonment recovery) is locked here and Phase 12 inherits it.
- "Type your slug to confirm delete" is intentionally GitHub-style — Andrew explicitly chose the highest-friction confirmation pattern available, signaling that account deletion should feel deliberate.
- Email-change-with-re-verification was added as an explicit ask on top of ROADMAP.md success criterion #4. Plan-phase should decide whether this lives inside Phase 10 or splits into its own plan/sub-phase given the auxiliary verification flow it introduces.

</specifics>

<deferred>
## Deferred Ideas

- **301 redirect for old slug after change** — chose 404 (clean break) for v1.1. Add to v1.2 backlog if contractors report broken-link complaints.
- **Soft-delete reversibility / "restore on login within N days"** — chose immediate-no-undo for v1.1. v1.2 backlog if needed.
- **Slug editable from a dedicated branding/settings sub-page rather than profile** — folded into `/app/settings/profile` for v1.1 simplicity; revisit if profile page gets crowded.
- **Pick-from-templates first event type** — deferred in favor of single pre-filled default; revisit if onboarding analytics show users bouncing at step 3.

</deferred>

---

*Phase: 10-multi-user-signup-and-onboarding*
*Context gathered: 2026-04-28*
