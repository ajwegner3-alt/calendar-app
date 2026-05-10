# Feature Research

**Domain:** Multi-tenant SaaS booking tool — Auth Expansion + Per-Account Email + Polish + Dead Code (v1.7)
**Researched:** 2026-05-06
**Confidence:** MEDIUM — competitor UX observations from public docs/help centers; Google OAuth scope behavior from official docs (HIGH); animation timing from Motion docs (MEDIUM); dead code tooling from Knip docs (HIGH)

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Google "Sign in" button on /app/signup | Any SaaS in 2026 offers Google SSO; password-only signup feels dated | MEDIUM | Single OAuth consent screen combining profile + `gmail.send`; see "Partial Grant" section below |
| Magic-link fallback on /app/login | Password-only login feels friction-heavy; "email me a link" is now the norm for low-frequency SaaS logins | LOW | Email-only field; separate link or tab on existing /app/login page, NOT a separate route |
| 15-minute single-use magic-link tokens | Industry standard TTL (10–15 min); longer = security risk; shorter = email-delay UX failures | LOW | Must be invalidated on first use; defend against email prefetch bots by treating a failed prefetch as a re-request |
| "Your Gmail connection expired, reconnect" inline alert | Any app storing OAuth tokens must handle token revocation gracefully; silent failure of email sends is unacceptable | MEDIUM | Detect `invalid_grant` on send attempt; mark account `gmail_status: 'needs_reauth'`; surface inline banner on owner dashboard + settings page |
| "Connect Gmail" step in onboarding wizard | Calendly and Cal.com both surface calendar/email connect in onboarding, not buried in settings | MEDIUM | Must be skippable (graceful degradation); show clearly what permission is being requested: "send booking emails from your Gmail" |
| Connection status indicator on settings page | Users who connected Gmail need to know if it's working; "last email sent" timestamp or simple "Connected / Disconnected" badge | LOW | Badge states: Connected (green), Needs reconnect (yellow/orange), Never connected (gray) |
| Disconnect Gmail button | Users expect to be able to revoke the connection; GDPR / Google policy requires it | LOW | On disconnect: warn that booking emails will fail until reconnected; do NOT auto-fallback silently to centralized SMTP (centralized SMTP is being retired) |
| Inline cap-hit warning at point of failure | When a send is refused due to 200/day cap, the owner needs to know immediately, not discover it from a booker complaint | LOW | Reuse existing `text-sm text-red-600 role="alert"` quota vocabulary from v1.6 Phase 31 |
| "Request upgrade" button on cap-hit | Owner cannot self-serve beyond the cap; button must exist and be obvious | LOW | One-tap; auto-attaches account ID and current daily count; sends to Andrew |
| Form column slide-in on slot pick | Calendly and Cal.com both animate the form column into view; users notice the jarring no-animation version | LOW | 200–250ms, `ease-out`; the reserved 320px column already exists (v1.5); this is a visibility transition, not a layout shift |
| Skeleton placeholder in empty form column | The empty "Pick a time on the left" state looks unfinished; a subtle skeleton signals the column will become active | LOW | Show shape-only placeholder (no shimmer needed); resolves only to real form on slot pick, NOT on calendar load |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Single consent screen combining signup + gmail.send | Eliminates the separate "Go to Settings → Connect Gmail" step that Calendly requires post-signup; smoother new-user experience | HIGH | Only feasible if `gmail.send` is requested at signup OAuth; partial grant must be handled gracefully (see Anti-Features) |
| "Connection healthy" last-send timestamp | Gives power-user owners confidence their email is actually flowing; differentiates from competitors that show only binary Connected/Disconnected | LOW | Store `gmail_last_sent_at` on account; render as "Last sent 3 hours ago" |
| Upgrade path that preserves daily send count display | After upgrading to Resend backend, show the new higher cap (or "managed" indicator) rather than hiding the number; transparency builds trust | LOW | UI: "200 / 2,000 emails today" vs "Upgraded — managed send" |
| "Retry failed rows" post-pushback pattern reused for email sends | v1.6 already built per-row retry (PUSH-12); applying same pattern to cap-hit scenarios gives consistent owner UX across all email failure modes | LOW | Reuse `retryPushbackEmailAction` pattern vocabulary |
| Dead-code audit as a milestone (not a sprint) | Most tools accumulate dead code silently; surfacing it as a structured, Andrew-signed-off removal builds long-term codebase health | MEDIUM | Knip (not ts-prune — ts-prune is maintenance-only) is the right tool; per-item sign-off prevents accidental removal of intentionally kept code |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Force gmail.send at signup — block account creation if denied | Seems simpler to ensure all accounts have Gmail connected | Google's granular consent (rolling out Jan 2026) allows users to grant profile but deny gmail.send; blocking account creation would break the signup funnel for any user who hesitates at the send permission | Allow signup with profile-only; prompt to connect Gmail in onboarding step; send fails gracefully with "reconnect Gmail" inline alert |
| Re-prompt gmail.send on every login until granted | Feels like an easy nudge | Repeated permission nags are a Google OAuth violation ("Only request scopes your app needs at the time of the request"); Google can block apps that re-request already-denied scopes repeatedly | One prominent onboarding prompt + passive "Connect Gmail" card on settings page; never force a re-prompt after explicit denial |
| Magic-link as the ONLY login method | Passwordless is simpler to maintain | Operators in low-email-reliability environments (Gmail spam filters, corporate email blocks) lose access entirely; existing password users expect their passwords to keep working | Magic-link as additional method alongside existing password login; "Use magic link instead" toggle/link on the login form |
| Separate /login/magic-link page | Cleaner URL | Unnecessary route split; users expect a single /app/login page with both options; extra navigation adds friction | Add "Email me a sign-in link" inline below the password form on the existing login card |
| Multi-use magic links (token valid for 30 min, multiple clicks) | Reduces "link expired" support tickets | Opens replay attack window; email client prefetchers (Outlook SafeLinks, Gmail, etc.) auto-click links on receipt, consuming single-use tokens silently | Issue a secondary token after detecting prefetch (user-agent / no-JS GET pattern); 15-min TTL with silent reissuance if prefetch detected |
| "Unlimited" label for upgraded Resend accounts | Feels premium | Creates expectation of zero limits; Resend has its own per-day and per-month caps; support burden when owner hits Resend caps | Show higher cap number ("2,000/day") or "Managed plan — contact NSI for capacity"; never claim "unlimited" |
| Status page for NSI Resend backend | Some SaaS products offer this | Way out of scope for v1.7; adds maintenance surface; Resend has its own status page | Link to Resend status page in upgrade confirmation email; no custom status page |
| Dead-code removal as a big-bang single PR | Feels efficient | Single massive PR is un-reviewable; one false positive can delete a live path; Andrew cannot sign off on 200 items at once | Knip generates list → Andrew reviews and approves in batches → atomic per-item commits; one PR per logical group (e.g., all deprecated auth helpers, then all old booking utilities) |
| Using ts-prune for dead-code audit | It exists and was once common | ts-prune is in maintenance mode as of 2023; does not understand Next.js App Router entry points, server actions, or route handlers | Use Knip — has a Next.js plugin that knows App Router layout/page/route/template patterns, middleware, and instrumentation; ~150 framework-aware plugins |

---

## Feature Dependencies

```
[Google OAuth signup]
    └──requires──> [Supabase Auth Google provider enabled]
    └──requires──> [Google Cloud project with gmail.send sensitive scope + verification]
    └──yields───> [Gmail OAuth tokens stored in DB]
                       └──enables──> [Per-account Gmail send]

[Per-account Gmail send]
    └──requires──> [Gmail OAuth tokens stored in DB]
    └──requires──> [Token refresh logic + invalid_grant detection]
    └──replaces──> [Centralized Gmail SMTP (v1.0)]
    └──yields───> [gmail_status field on accounts table]
                       └──enables──> [Reconnect UX / inline alert]

[Magic-link login]
    └──requires──> [Supabase Auth magic link / OTP flow]
    └──independent of──> [Google OAuth signup]

[Cap-hit "Request upgrade" button]
    └──requires──> [Existing 200/day quota guard (v1.6)]
    └──requires──> [NSI Resend account + API key]
    └──feeds───> [Upgraded account flag on accounts table]
                     └──routes──> [NSI Resend backend for sends]

[BOOKER-06 animated form slide-in]
    └──requires──> [Existing 320px fixed form column (v1.5)]
    └──independent of──> [BOOKER-07 skeleton]

[BOOKER-07 skeleton loader]
    └──requires──> [Form column conditional-mount pattern (v1.5)]
    └──should not conflict with──> [BOOKER-06 animation]
    └──note──> [Skeleton is for the NULL slot state; BOOKER-06 is the enter animation when slot IS selected — they fire at different lifecycle moments]

[Dead-code audit]
    └──requires──> [Knip installed + configured for Next.js App Router]
    └──independent of──> [All other v1.7 features]
    └──should run LAST──> [After all new code is written, to avoid auditing code still being added]
```

### Dependency Notes

- **Google OAuth signup requires Google Cloud project verification:** `gmail.send` is classified as a **sensitive scope**. An unverified app shows a "This app isn't verified" warning page where users must click "Advanced" then "Go to [app] (unsafe)" to proceed. During testing (app publishing status = "Testing"), refresh tokens expire after 7 days. Verification takes 3–5 business days. Plan for verification lead time before v1.7 ships to production users.

- **Granular consent (partial grant) is live as of Jan 2026:** Google's new granular OAuth consent screen lets users grant profile-only and deny `gmail.send`. Apps must handle the partial grant case: create the account, surface the Gmail connect prompt in onboarding, do not block signup.

- **Per-account Gmail send token lifecycle:** Google revokes refresh tokens on: (a) user changes password, (b) user removes app access in their Google account, (c) 6 months inactivity, (d) >100 live tokens per OAuth client (oldest silently revoked), (e) testing mode 7-day cap. Detect `invalid_grant` on every send attempt; mark `gmail_status = 'needs_reauth'`; do not retry silently.

- **BOOKER-07 skeleton should NOT conflict with BOOKER-06:** The skeleton is the resting state of the empty form column (no slot selected). The BOOKER-06 slide-in animation fires when a slot IS picked — the skeleton exits and the BookingForm enters with the slide-in. These are sequential states, not competing animations. Prefer CSS Tailwind transitions over Framer Motion for this simple case (no Framer Motion dependency in the project currently).

---

## MVP Definition for v1.7

### Launch With

- [ ] Google OAuth signup — basic profile scope only; gmail.send scope combined in same flow if Google project verification is complete, deferred to settings connect-step if not
- [ ] Magic-link login added as option on existing /app/login card
- [ ] Per-account Gmail OAuth send — connect in onboarding step 3+ and settings; `invalid_grant` detection + reconnect prompt
- [ ] Cap-hit "Request upgrade" button — inline at quota refusal point; one-tap email to Andrew with account ID + daily count
- [ ] NSI Resend backend routing for accounts with `upgraded: true` flag
- [ ] BOOKER-06 animated form slide-in (200–250ms, ease-out, Tailwind CSS only)
- [ ] BOOKER-07 skeleton in empty form column (shape-only, no shimmer needed for v1.7)
- [ ] Dead-code audit pass (Knip report → Andrew sign-off → atomic removals)

### Add After Validation (v1.x)

- [ ] `gmail_last_sent_at` timestamp display — add after confirming per-account send is stable in production
- [ ] Google Calendar read/write sync — separate OAuth scope from gmail.send; major feature surface for v1.8+
- [ ] Upgrade tier with higher cap display ("2,000/day") — after first paid upgrade customer confirmed

### Future Consideration (v2+)

- [ ] Custom NSI status page for Resend backend
- [ ] SAML/SSO for enterprise accounts
- [ ] Multiple calendar integrations (Outlook, iCloud)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google OAuth signup | HIGH | HIGH (verification overhead) | P1 |
| Per-account Gmail send | HIGH | HIGH (token lifecycle complexity) | P1 |
| Magic-link login | MEDIUM | LOW | P1 |
| Cap-hit Request upgrade button | HIGH | LOW | P1 |
| NSI Resend backend routing | HIGH (for upgraded accounts) | MEDIUM | P1 |
| Gmail reconnect alert + badge | HIGH | LOW | P1 |
| BOOKER-06 animated slide-in | MEDIUM | LOW | P2 |
| BOOKER-07 skeleton placeholder | LOW | LOW | P2 |
| Dead-code audit | MEDIUM (maintainability) | MEDIUM (review overhead) | P2 |
| `gmail_last_sent_at` display | LOW | LOW | P3 |

**Priority key:**
- P1: Required for v1.7 to deliver its stated goal
- P2: Polish; ships in v1.7 if time allows, else v1.8
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Calendly | Cal.com | This App (v1.7 plan) |
|---------|----------|---------|----------------------|
| Google OAuth signup | Yes — profile scope; calendar connect is a separate post-signup step in Settings | Yes — profile scope at signup; Gmail send connect separate in settings | Combined signup + gmail.send in single consent if verified; partial-grant graceful fallback |
| Magic-link login | No (password + Google SSO only) | Yes — "Email sign-in" link on login page alongside password and SSO | "Email me a sign-in link" on existing /app/login card |
| Per-account email send | Calendly sends from `notifications@calendly.com`; Google Meet links in invites | Cal.com sends from `cal@...`; self-hosted instances can BYOE | Every account sends from their own Gmail; v1.0 centralized SMTP retired |
| OAuth token expiry handling | Calendly shows "Calendar connection expired" banner; requires manual reconnect in Settings | Cal.com similar — inline error in settings; booking continues but without calendar sync | Detect `invalid_grant` on send; mark `needs_reauth`; surface inline banner on dashboard |
| Cap-hit upgrade path | Calendly upgrades go to full plans with billing UI | Cal.com self-hosted has no cap path | Simple "Request upgrade" one-tap button; email to Andrew; manual white-glove upgrade |
| Booking form animation | Column expands with a ~200ms fade-slide (CSS transition); form content fades in | Time list slides left; form column slides in from right (~250ms ease-out) | BOOKER-06: Tailwind CSS transition on the form column div; 200–250ms ease-out |
| Skeleton loader in booker | Calendly shows shimmer skeleton for time-slot column while loading | Cal.com uses skeleton for entire booker during initial load | BOOKER-07: shape-only placeholder in form column when no slot selected |
| Dead-code audit tooling | N/A (closed source) | Knip in CI (calcom/cal.com repo uses it) | Knip with Next.js App Router plugin; per-item Andrew sign-off; atomic commits |

---

## Detailed UX Notes Per Feature

### Google OAuth signup + gmail.send

**User sees (unverified app, during development/testing):**
1. Standard "Sign in with Google" modal
2. "This app isn't verified" warning page
3. User must click "Advanced" → "Go to [appname] (unsafe)"
4. Consent screen lists requested scopes including "Send email on your behalf"
5. With granular consent (Jan 2026+): each scope is a checkbox; user can approve profile and skip gmail.send

**User sees (verified app, production):**
1. Standard consent screen with NSI branding
2. Scope list shows "Send email on your behalf" — this IS visible but not alarming for verified apps
3. No "unverified" interstitial

**Partial grant handling (table stakes):**
- Account created regardless of whether gmail.send was granted
- Onboarding wizard shows "Connect Gmail for email notifications" step
- Settings page shows "Gmail: Not connected — Connect" card
- Owner dashboard shows `yellow` badge "Email not configured — connect Gmail to send booking emails"

**Token expiry reconnect UX:**
- On `invalid_grant` error: mark `accounts.gmail_status = 'needs_reauth'`
- On next dashboard load: inline banner "Your Gmail connection expired. Reconnect to resume sending." with "Reconnect Gmail" button
- Button re-initiates the same OAuth flow (incremental auth with `access_type=offline&prompt=consent`)
- After reconnect: banner dismisses, status badge returns to green

### Magic-link login

**Standard pattern (verified by baytechconsulting source):**
- 10–15 min TTL; single-use; invalidate on first click
- Email-only field on a tab or section of /app/login (NOT a separate page)
- "We sent you a link" confirmation shown immediately after submission; do not re-render the email field
- If user requests a second link before first expires: invalidate the first, issue a new one (silent from user's perspective — they just get a fresh email)
- Already-logged-in users hitting a magic link: redirect to /app/dashboard; do not error
- Prefetch bot defense: implement using Supabase's built-in OTP/magic-link (it handles token verification); if GET pre-fetches the link, the single-use token is consumed silently — mitigate by using POST-to-verify pattern (link goes to a page that POSTs the token server-side, not auto-verified on GET)

**Placement decision (table stakes):**
- DO NOT create /app/login/magic-link as a separate route
- Add "Sign in with email link instead" as a secondary action below the existing password form on /app/login
- This keeps the existing password flow as default (existing users), magic-link as the opt-in path

### Per-account Gmail OAuth send

**Connect flow (onboarding):**
1. After event type creation step: "Connect Gmail to send booking confirmation emails"
2. Single "Connect Gmail" button → Google OAuth → return to onboarding
3. On return: checkmark + "Connected as yourname@gmail.com"; continue button activates
4. Skip option: "Skip for now — you can connect later in Settings"

**Connect flow (settings page):**
- Section: "Email sending" with current status badge
- Connected: green badge + email address + "Last sent: 3 hours ago" + "Disconnect" button
- Disconnected: orange badge + "Gmail not connected — booking emails will not send" + "Connect Gmail" button
- Needs reauth: yellow badge + "Your Gmail connection expired" + "Reconnect" button

**Disconnect behavior:**
- Show confirm dialog: "Disconnecting Gmail will stop all booking email delivery until you reconnect. Existing bookings will not be affected but no future emails will send."
- On confirm: revoke token on Google + clear stored tokens + set `gmail_status = 'disconnected'`
- Do NOT silently fall back to any centralized SMTP — centralized SMTP is being retired in v1.7

### Cap-hit "Request upgrade" flow

**Point-of-failure UX (table stakes):**
- Email send fails → existing quota refusal vocabulary already in place (`text-sm text-red-600 role="alert"`)
- Append to existing quota error: "Daily limit reached. [Request upgrade →]" inline link/button
- No separate upgrade page needed for v1.7

**Request upgrade button behavior:**
- Single click; no multi-step form needed
- POST to server action that sends email to Andrew (via NSI Resend — NOT the owner's Gmail)
- Email body: account ID, account email, current daily count, timestamp, account creation date
- Owner sees: "Request sent. Andrew will contact you within 1 business day." toast
- No second click possible for 24 hours (debounce to prevent accidental spam to Andrew)

**Andrew's receive side:**
- Email to Andrew's inbox via Resend
- No Linear/in-app admin tool required for v1.7 — manual upgrade via DB flag `accounts.resend_upgraded = true`

**After upgrade (NSI Resend backend):**
- Account routes through Resend instead of Gmail OAuth
- Daily count display changes from "200/day cap" to show Resend-tier limit or "Managed plan"
- Owner settings shows "Email: Managed by NSI (Resend)" in place of Gmail connect section

### BOOKER-06 animated form slide-in

**What the existing code does (booking-shell.tsx line 255–269):**
The form column Col 3 is a `<div>` that conditionally renders `<BookingForm>` or a plain text placeholder. No animation exists. Layout is already 320px fixed-width with no shift (v1.5 lock).

**Target behavior:**
- On slot pick: form column transitions from placeholder to active form
- Animation: form slides in from right (~20px translateX) + fades in (opacity 0→1)
- Duration: 200–250ms, `ease-out` (slows at end = feels like it "lands")
- Implementation: Tailwind CSS `transition-all duration-200 ease-out` on the container + conditional translate class; NO Framer Motion dependency (no existing Framer Motion in project, avoid adding it for a 200ms transition)
- Cal.com pattern: time list slides left, form slides in from right in ~250ms ease-out — this is the reference

**When does it feel laggy?** Above 300ms users perceive it as slow. Below 150ms users miss it entirely. 200–250ms is the sweet spot confirmed by Motion docs and standard Material Design motion timing.

**Turnstile guard:** The existing `key={selectedSlot.start_at}` forces BookingForm remount on slot change — this is intentional (RHF reset + Turnstile token refresh). The animation should be on the container div, not on BookingForm itself, so remounting BookingForm doesn't re-trigger the slide-in on every slot change. Animate the wrapper; let BookingForm mount fresh inside it.

### BOOKER-07 skeleton loader for empty form column

**When is it needed?**
The empty form column currently shows: `"Pick a time on the left to continue."` — plain text. This feels like a dead zone. A skeleton signal communicates "content will appear here."

**What the skeleton should look like:**
- Shape matching approximate form layout: title bar ghost, 3 input field ghosts, submit button ghost
- No shimmer animation needed for v1.7 (shimmer adds motion budget; shape alone is sufficient)
- Should be visually subordinate — muted gray, not as visually loud as the active form
- Disappears when a slot is selected (replaced by animated BOOKER-06 slide-in)

**Does it conflict with BOOKER-06?**
No, if implemented correctly:
- Skeleton = state when `selectedSlot === null` (resting state)
- BOOKER-06 slide-in = transition when `selectedSlot` changes from null to a value
- These are mutually exclusive states; skeleton exits, form slides in

**Competitor pattern (Cal.com):**
Cal.com's embed uses a skeleton for the entire booker on initial load (before slots are fetched). They do NOT use a skeleton for the form column specifically — the form column is only shown after slot pick, and they slide it in directly. This app's pattern (reserving the 320px column in the 3-col grid at all times) is actually better for layout stability; a skeleton in that reserved column is purely a polish signal.

**Implementation path:**
Simple: replace the `<div className="text-sm text-muted-foreground">Pick a time...</div>` placeholder with a `<FormColumnSkeleton />` component. Pure Tailwind, no deps.

### Dead-code audit

**Standard tooling (HIGH confidence — Knip docs verified):**
- Knip is the current standard; ts-prune is maintenance-only
- Knip's Next.js plugin automatically detects App Router entry points: `app/**/page.tsx`, `app/**/layout.tsx`, `app/**/route.ts`, `app/**/template.tsx`, `app/**/loading.tsx`, `app/**/error.tsx`, `app/**/not-found.tsx`, `middleware.ts`, `instrumentation.ts`
- Server actions: Knip follows imports; if a `'use server'` file is imported by a page/route, it's live. Orphaned server action files not imported anywhere will be flagged.
- Test files: Knip treats test-runner entry points (Vitest config, test files) separately; exports used ONLY in tests are flagged as unused in source (this is intentional — they ARE unused in runtime code)

**Recommended workflow:**
1. Run `npx knip` to generate full report (unused files, unused exports, unused dependencies)
2. Triage in three buckets: (a) safe to delete, (b) needs investigation, (c) intentionally kept (test helpers, future placeholders)
3. Andrew reviews each item in bucket (a) and signs off
4. Atomic commits per logical group — never one big-bang deletion PR
5. For each ambiguous item (referenced in test setup but not in source): keep unless test coverage can be re-expressed without it

**Known false-positive categories for this project:**
- `slot-picker.tsx` — on disk per Andrew Option A (Plan 30-01 Rule 4); intentionally kept for future `<CalendarSlotPicker>` extraction; must be marked `// @knip-ignore` or added to Knip ignore list
- Test mock helpers (`__mockSendCalls`, `__setTurnstileResult`) — referenced in test setup; correct Knip behavior to flag them; keep them, add to test-only ignore pattern
- `02-VERIFICATION.md` and similar planning artifacts — not in Knip's scope (non-JS/TS); no action needed

---

## Sources

- [Gmail API OAuth scopes — Google for Developers](https://developers.google.com/workspace/gmail/api/auth/scopes) — `gmail.send` is a **sensitive scope** (HIGH confidence, official docs)
- [Sensitive scope verification — Google for Developers](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — verification process, timeline, user cap for unverified apps (HIGH confidence, official docs)
- [Granular OAuth consent — Google Workspace Updates](https://workspaceupdates.googleblog.com/2025/11/granular-oauth-consent-in-webapps.html) — partial grant behavior rolling out Jan 7, 2026; users can approve profile but deny gmail.send (HIGH confidence, official blog)
- [Google invalid_grant causes and recovery — Nango Blog](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked/) — token revocation causes, reconnect UX recommendation (MEDIUM confidence, well-sourced technical article)
- [Magic link UX and TTL best practices — BayTech Consulting 2025](https://www.baytechconsulting.com/blog/magic-links-ux-security-and-growth-impacts-for-saas-platforms-2025) — 10–15 min TTL, single-use, prefetch bot risk (MEDIUM confidence, secondary source, consistent with Supertokens docs)
- [Knip — Next.js plugin reference](https://knip.dev/reference/plugins/next) — App Router entry point patterns (HIGH confidence, official Knip docs)
- [Knip homepage](https://knip.dev/) — ts-prune is maintenance-mode; Knip is successor (HIGH confidence, official)
- [Motion/Framer Motion transition docs](https://motion.dev/docs/react-transitions) — ease-out for enter animations; 200–300ms duration range (HIGH confidence, official Motion docs)
- [Unverified apps — Google Cloud Console Help](https://support.google.com/cloud/answer/7454865?hl=en) — user warning screen behavior for unverified apps (HIGH confidence, official Google support)
- [Skeleton screens vs spinners — NN/g](https://www.nngroup.com/articles/skeleton-screens/) — when to use skeleton vs spinner; dynamic content revealed by interaction should use skeleton for layout continuity (HIGH confidence, NN/g)
- Cal.com open-source repo (public GitHub observation) — booking page states: `loading`, `selecting_date`, `selecting_time`; animation described in v2.1 release notes; skeleton for embed initial load (MEDIUM confidence, observed from public docs and issue tracker)

---

*Feature research for: NSI Booking Tool v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code*
*Researched: 2026-05-06*
