# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-06 — Phase 34 fully complete (4 plans, 10 commits). Verifier returned 5/5 static PASS, status `human_needed` for live OAuth runtime (4 items pending PREREQ-01/02/04). Phase 34 requirements (AUTH-23/25/26/27, EMAIL-29/30/31) marked Complete.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-06 after v1.7 kickoff)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.7 Phase 34 COMPLETE. Next: Phase 35 — Gmail Send (per-account transactional email).

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code — IN PROGRESS
**Phase:** 34 — Google OAuth Signup + Credential Capture — COMPLETE
**Plan:** 04 of 4 — complete
**Status:** Phase 34 code complete (5/5 must-haves PASS static verification). Live OAuth runtime testing (4 items in 34-VERIFICATION.md `human_verification` section) deferred until Andrew completes PREREQ-01 (Google Cloud Console — 3-5 day verification window), PREREQ-02 (Supabase Google provider), PREREQ-04 (Vercel env vars). Phase 35 can begin in parallel (depends on the table + factory shape, not on live OAuth).
**Last activity:** 2026-05-06 — Completed 34-04-PLAN.md (settings Gmail panel + onboarding connect-gmail + link toast)

Progress (Phase 34): ████ 4/4 plans complete

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [X] Day-of-Disruption Tools      (Phases 31-33, 10 plans, 53 commits, shipped 2026-05-06 — ~2 days)
v1.7 [ ] Auth + Email + Polish + Debt (Phases 34-40, 7 phases, plans TBD — in progress: Phase 34 done)
```

**Total shipped:** 6 milestones archived (v1.0–v1.6), 33 phases completed, 138+ plans, ~570 commits

## Accumulated Context

### Patterns established in v1.7 (Phase 34+)

- **Admin-client-only writes (Phase 34, Plan 01)** — `account_oauth_credentials` has no INSERT/UPDATE/DELETE RLS. All writes must use the service-role Supabase client in server-side API routes, preventing browser-side credential manipulation.
- **AES-256-GCM encrypted blob format (Phase 34, Plan 02)** — `iv:authTag:ciphertext` (all lowercase hex, 12-byte IV, 16-byte auth tag). Produced by `lib/oauth/encrypt.ts`; Phase 35 consumes via `decryptToken`.
- **Lazy env var read in encryption utils (Phase 34, Plan 02)** — `getKey()` reads `GMAIL_TOKEN_ENCRYPTION_KEY` inside the function body, not at module top level. Required for test isolation (beforeEach can modify process.env). Apply same pattern to any new env-var-gated server utility.
- **Google OAuth HTTP helpers fail-safe return (Phase 34, Plan 02)** — `fetchGoogleGrantedScopes` and `revokeGoogleRefreshToken` return `null`/`false` on any network error, never throw. Callers branch on return value.
- **GoogleOAuthButton is NSI-color-locked (Phase 34, Plan 02)** — Google brand guidelines prohibit NSI colors. Component uses raw `<button>` (not `ui/button`). DO NOT apply brand theme to this component in any future plan.
- **useSearchParams-in-Suspense pattern (Phase 34, Plans 03+)** — Any client component using `useSearchParams()` must isolate that hook in a child component wrapped in `<Suspense fallback={null}>`. Next.js 16 prerender fails with CSR bailout error otherwise. Applied in signup-form.tsx, login-form.tsx, gmail-status-panel.tsx, google-link-toast.tsx.
- **Server-action OAuth init (Phase 34, Plan 03)** — `<form action={initiateGoogleOAuthAction}><Button type="submit">` — clean progressive enhancement, no `useTransition` needed. Combined scope string is a single space-delimited string, NOT an array.
- **Partial-grant detection via tokeninfo endpoint (Phase 34, Plan 03)** — Use Google tokeninfo endpoint (authoritative) to detect whether gmail.send was actually granted. Do NOT use heuristic scope string inspection. Only persist credentials when gmail.send confirmed granted.
- **Server action cross-segment reuse (Phase 34, Plan 04)** — `connectGmailAction` defined in `app/(shell)/app/settings/gmail/_lib/actions.ts` is imported by onboarding's `connect-gmail-card.tsx`. App Router supports cross-route-segment server action imports. Do NOT duplicate linkIdentity logic.
- **Conditional unlinkIdentity (Phase 34, Plan 04)** — `disconnectGmailAction` only calls `supabase.auth.unlinkIdentity` when user has 2+ identities (RESEARCH §Pitfall 6). Google-only users keep their `auth.identities` row after disconnect — Phase 35 reads `account_oauth_credentials`, not auth.identities.
- **Disconnect revocation is best-effort (Phase 34, Plan 04)** — `revokeGoogleRefreshToken` failure is caught and logged; does NOT block the credential row deletion. The user-visible promise is "credentials gone", not "Google session revoked".

### Patterns established / locked through v1.6

See PROJECT.md Key Decisions for full table. Key ones relevant to v1.7:

- **Refuse-send fail-closed (Phase 31)** — all 7 email senders go through `checkAndConsumeQuota()`; v1.1 carve-out removed. `getRemainingDailyQuota()` for batch pre-flights.
- **Vitest `resolve.alias` array/regex exact-match** — `find: /^@\/lib\/email-sender$/` prevents alias prefix-bleed. New provider sub-paths get their own alias entries (LD-14).
- **Two-step deploy protocol (CP-03)** — strangler-fig pattern for cutover; SMTP removal is a separate deploy after production verification (LD-06).
- **`slot-picker.tsx` kept on disk** — Plan 30-01 Rule 4; explicit `knip` ignore list required (LD-09).
- **Deploy-and-eyeball as canonical production gate** — 6th consecutive milestone, formally the operating model.

### Blockers / prereqs for v1.7

- **PREREQ-01** (blocks Phase 34 live testing): Google Cloud Console OAuth setup + app verification (3-5 day lead time — start immediately). Also: add `https://{your-domain}/auth/google-callback` to Authorized Redirect URIs.
- **PREREQ-02** (blocks Phase 34 live testing): Supabase Google provider toggle + credential paste.
- **PREREQ-03** (blocks Phase 36): Resend account + NSI domain DNS verification via Namecheap.
- **PREREQ-04** (blocks Phases 34, 35, 36): Vercel env vars — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY`, `RESEND_API_KEY`.
- **CALLBACK-URL** (blocks Phase 34 live testing): `/auth/google-callback` must be registered in both Google Cloud Console (Authorized Redirect URIs) AND Supabase Dashboard (Additional Redirect URLs). Preview branch wildcard: `https://*-{vercel-team}.vercel.app/auth/google-callback`.

### Open tech debt (carried into v1.7)

- `slot-picker.tsx` on disk per Andrew Option A (Phase 40 audit will surface it; explicit knip ignore required).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — uncommitted.
- `tests/bookings-api.test.ts` one failing test (fixture mismatch); 30/31 test files green.

## Session Continuity

**Last session:** 2026-05-06 — Phase 34 Plans 01-04 executed. Phase 34 complete.

**Stopped at:** Completed 34-04-PLAN.md. Commits: c9f2312 (settings Gmail panel), f0da49e (onboarding connect-gmail), 03c0ebd (google-link toast).

**Next session:** Phase 35 — Gmail Send (per-account transactional email using stored refresh tokens from Phase 34).

**Files of record:**
- `.planning/ROADMAP.md` — v1.7 Phases 34-40 defined; v1.6 collapsed to `<details>`
- `.planning/STATE.md` — this file
- `.planning/REQUIREMENTS.md` — all 30 v1.7 requirements with phase traceability filled
- `.planning/phases/34-google-oauth-signup-and-credential-capture/34-01-SUMMARY.md` — Plan 01 complete
- `.planning/phases/34-google-oauth-signup-and-credential-capture/34-02-SUMMARY.md` — Plan 02 complete
- `.planning/phases/34-google-oauth-signup-and-credential-capture/34-03-SUMMARY.md` — Plan 03 complete
- `.planning/phases/34-google-oauth-signup-and-credential-capture/34-04-SUMMARY.md` — Plan 04 complete
- `lib/oauth/encrypt.ts` — AES-256-GCM encrypt/decrypt/generateKey (e09f019)
- `lib/oauth/google.ts` — fetchGoogleGrantedScopes, revokeGoogleRefreshToken, hasGmailSendScope (f639f0c)
- `components/google-oauth-button.tsx` — branded Google button (e427e52)
- `app/(auth)/app/signup/actions.ts` — signUpAction + initiateGoogleOAuthAction (e3a7dfb)
- `app/(auth)/app/login/actions.ts` — loginAction + initiateGoogleOAuthAction (e3a7dfb)
- `app/(auth)/app/signup/signup-form.tsx` — GoogleOAuthButton first + divider + error alerts (c816e8c)
- `app/(auth)/app/login/login-form.tsx` — GoogleOAuthButton first + divider + error alerts (c816e8c)
- `app/auth/google-callback/route.ts` — PKCE exchange + token capture + routing (66f47f0)
- `app/(shell)/app/settings/gmail/_lib/actions.ts` — connectGmailAction + disconnectGmailAction (c9f2312)
- `app/(shell)/app/settings/gmail/page.tsx` — settings Gmail page (c9f2312)
- `app/onboarding/connect-gmail/page.tsx` — optional connect-gmail onboarding step (f0da49e)
- `app/(shell)/app/_components/google-link-toast.tsx` — post-link banner toast (03c0ebd)
