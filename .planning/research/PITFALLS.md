# Pitfalls Research — Calendar App v1.1

**Domain:** Multi-tenant Calendly-style booking SaaS — adding (A) public multi-user signup, (B) per-event-type capacity, (C) Cruip "Simple Light" branded UI overhaul on top of v1.0 production.
**Researched:** 2026-04-27
**Confidence:** HIGH for v1.1-specific pitfalls (verified against current `proxy.ts`, `lib/branding/`, `supabase/migrations/`, RLS policies, FUTURE_DIRECTIONS.md, and v1.0 ROADMAP). Specific Supabase Auth behaviors flagged LOW where dependent on dashboard config Andrew owns.

---

## Reading Guide

This document **supersedes** v1.0 PITFALLS.md for v1.1 planning. The 10 critical v1.0 pitfalls (C1–C10) are summarized in the **v1.0 Pitfalls — Status Reference** table below; their full text remains valuable historical context but is not duplicated here. New pitfalls introduced by v1.1's three capability areas are enumerated as P-#, organized by capability:

- **P-A**# — Multi-user signup pitfalls (Phase 10)
- **P-B**# — Capacity-aware booking pitfalls (Phase 11)
- **P-C**# — Branded UI overhaul pitfalls (Phase 12)
- **P-X**# — Cross-cutting pitfalls (multi-phase)

Each pitfall:
- **Severity:** Critical (causes outage / data loss / security breach), Moderate (causes UX regression or technical debt), Minor (cosmetic / fixable post-ship).
- **Warning signs** — concrete, observable: a log line, an HTTP code, a behavior.
- **Prevention** — actionable, specific to this codebase.
- **Phase to address** — Phase 10, 11, 12, 13, or "all phases" (cross-cutting).

---

## v1.0 Pitfalls — Status Reference

| ID | Name | v1.0 Status | v1.1 Regression Risk | Tracked Below As |
|----|------|-------------|----------------------|------------------|
| C1 | Double-booking via read-then-write race | ADDRESSED via `bookings_no_double_book` partial unique index `(event_type_id, start_at) WHERE status='confirmed'` | **HIGH — capacity change replaces the partial unique index with a trigger or count-check; race-safety must be re-proven** | **P-B1** |
| C2 | Timezone confusion / DST | ADDRESSED via `timestamptz` everywhere + IANA TZ + `date-fns v4` + `@date-fns/tz` + `TZDate` constructor | LOW — but signup must capture timezone correctly on first save | **P-A7** |
| C3 | Service-role key leak / public-route misuse | ADDRESSED via `import "server-only"` line 1 of `lib/supabase/admin.ts` | **MEDIUM — signup is a public route that MUST insert into `accounts` (no RLS insert policy exists); will it use service-role? Audit the surface** | **P-A6** |
| C4 | RLS policy looks right but isn't multi-tenant safe | ADDRESSED via `current_owner_account_ids()` + 16-case cross-tenant matrix | **MEDIUM — v1.0 prod has N=1 tenant; v1.1 has N>1 in prod for the first time. Synthetic 2-tenant test ≠ live N-tenant traffic** | **P-A5** |
| C5 | Email deliverability / SPF-DKIM-DMARC | DEFERRED to v1.2 marathon QA per Andrew's 2026-04-27 sign-off. v1.0 ships on Gmail SMTP from owner's personal address. | **HIGH — Gmail SMTP free tier is ~500 emails/day. Mass signups → mass confirmation emails → quota exhaustion** | **P-A12** |
| C6 | Cron duplicate reminders | ADDRESSED via CAS UPDATE `WHERE reminder_sent_at IS NULL` claim pattern | LOW — v1.1 doesn't touch reminder cron logic | (No new pitfall) |
| C7 | Cron missed runs (booking inside window) | ADDRESSED via hourly schedule + immediate-send hook in `/api/bookings` | LOW | (No new pitfall) |
| C8 | Embed iframe sizing | ADDRESSED via `nsi-booking:height` postMessage protocol | **MEDIUM — gradient backgrounds may extend visual layout; height-reporter must keep pace** | **P-C6** |
| C9 | Embed CSP / X-Frame-Options | ADDRESSED via `proxy.ts` exclusive ownership (`frame-ancestors *` on `/embed/*`) | **MEDIUM — per-account inline `<style>` blocks for gradients require `style-src` permissiveness; current CSP doesn't set `style-src` at all (default = inherit `default-src` which is also unset = browser default)** | **P-C4** |
| C10 | Cancel/reschedule token entropy | ADDRESSED via SHA-256 hashed tokens + rotation on every reminder | LOW | (No new pitfall) |

---

## Critical Pitfalls (v1.1)

Mistakes that cause data loss, security breaches, or production outages. Address proactively in the named phase — do not defer.

---

### P-A1: Email Enumeration Leak in Signup Form

**Severity:** Critical (security)

**What goes wrong:** The signup form returns "email already registered" when an attacker submits a known email. Attacker now has a confirmed list of users on the platform. Combined with leaked password databases, becomes credential-stuffing fuel.

**Why it happens:** Default Supabase Auth `signUp()` returns a distinct error for duplicate emails (`User already registered`). Most tutorial code surfaces this directly.

**Warning signs:**
- HTTP response body contains `"User already registered"`, `"already exists"`, or any string distinguishing existing-vs-new email.
- Response time differs measurably between known and unknown emails (timing oracle).
- Distinct status codes for duplicate vs. new (e.g., 409 vs. 200).

**Prevention:**
- **Always return a generic success message** ("If that email is new, we've sent a verification link"). Never echo the email's existence.
- Always send the verification email, even when account exists (Supabase's `signUp` with email confirmation does this automatically — verify the dashboard "Confirm email" toggle is ON before opening signup).
- For race-condition scenario where the duplicate-email check is server-side: catch the Supabase error code (`user_already_exists` / `email_address_invalid`) server-side, log it, return generic 200.
- Constant-time delay on the response (e.g., `await sleep(500)` regardless of outcome) to defeat timing oracles.
- Apply the same pattern to password-reset: never reveal whether an email exists.

**Phase to address:** Phase 10 (Multi-user signup).

---

### P-A3: `accounts` Row Provisioning Failure (Auth-User-Without-Account)

**Severity:** Critical (data integrity / user lockout)

**What goes wrong:** Supabase Auth creates the `auth.users` row successfully, but the application's `INSERT INTO accounts (owner_user_id, slug, timezone, ...)` fails (RLS reject, network blip, slug collision, NOT NULL violation, RPC timeout). User now has Supabase auth credentials but no `accounts` row. They log in, hit dashboard, and `current_owner_account_ids()` returns empty → blank dashboard, 403 on every action, no recovery path.

**Why it happens:**
- v1.0 `accounts` table has **NO insert RLS policy** (verified at `supabase/migrations/20260419120001_rls_policies.sql:30` — comment: "No insert/delete policy for accounts in Phase 1 — service role handles seeding"). v1.1 must either add an `accounts` insert policy OR use service-role from the signup flow (see P-A6).
- Supabase Auth + application DB are two separate systems with no native transaction.
- Most tutorials show "create auth user, then create profile row" as two sequential client calls — partial failure is invisible.

**Warning signs:**
- User reports "I signed up, got the verification email, clicked it, logged in, but my dashboard is empty / I can't create event types."
- Server logs: `auth.users` row created but no matching `accounts` row.
- `current_owner_account_ids()` returns empty for a user with valid `auth.uid()`.
- Sentry/error log: failed `accounts` INSERT after successful `auth.signUp`.

**Prevention (pick ONE pattern, document why):**

1. **Postgres trigger on `auth.users` insert** — preferred. A `SECURITY DEFINER` function fires on every new auth.users row and inserts the matching `accounts` row inside the same transaction as the auth signup. Failure aborts both.
   ```sql
   create or replace function public.provision_account_for_new_user()
   returns trigger language plpgsql security definer set search_path = public as $$
   begin
     insert into accounts (owner_user_id, slug, timezone, owner_email)
     values (new.id, /* deferred slug */, 'America/Chicago', new.email);
     return new;
   end $$;
   create trigger on_auth_user_created
     after insert on auth.users
     for each row execute function public.provision_account_for_new_user();
   ```
   *Caveat:* slug must be picked at signup time and passed via `signUp({ options: { data: { slug, timezone } } })` so it's available in `new.raw_user_meta_data`.

2. **Compensating action in API route** — server route calls `auth.admin.createUser()` (service-role), then INSERT accounts in same `try/catch`. On INSERT failure, immediately `auth.admin.deleteUser(userId)`. Atomic-by-rollback. Worse: requires service-role on a public route (P-A6).

3. **Onboarding wizard (deferred provisioning)** — `auth.users` exists immediately; `accounts` row is created on first wizard submit. Clean recovery: if wizard never completes, next login redirects them back to it. Sleeps poorly with `current_owner_account_ids()` returning empty (every authenticated route must handle this state).

**Recommended:** Pattern #1 (Postgres trigger). Atomic; no service-role needed; handles the race for free. Compensation pattern (#2) ships only if signup needs server-side validation that can't run inside a Postgres trigger (e.g., Turnstile verification).

**Phase to address:** Phase 10.

---

### P-A5: RLS Holes Exposed Only at N>1 Tenants

**Severity:** Critical (multi-tenant data leak)

**What goes wrong:** v1.0 prod has exactly ONE tenant (NSI). The 16-case RLS cross-tenant test matrix (`tests/rls-cross-tenant-matrix.test.ts`) used SYNTHETIC tenant pairs, never load-tested with concurrent multi-tenant traffic. v1.1 opens signup → real N>1 tenants → first time `current_owner_account_ids()` is exercised against multiple authenticated owners simultaneously. Any policy gap that didn't surface with N=1 now leaks data.

**Why it happens:**
- `current_owner_account_ids()` is a `STABLE SECURITY DEFINER` function (`migrations/20260419120001_rls_policies.sql:11-18`). `STABLE` means Postgres can cache the result across rows in the same query. The function is correct, but every policy writes `account_id IN (select current_owner_account_ids())` — if a future migration accidentally writes `account_id = (select current_owner_account_ids())` (singular `=` instead of `IN`), the query passes when there's one tenant and breaks at N>1.
- New columns added in v1.1 (e.g., `accounts.background_color`, `event_types.max_bookings_per_slot`) inherit existing table RLS, but if the v1.1 plan adds a NEW table (e.g., `signup_invitations`, `password_reset_audit`), it must opt in to RLS explicitly — `ALTER TABLE foo ENABLE ROW LEVEL SECURITY` is NOT default.
- Public routes that previously read account-by-slug (e.g., `/[account]`, `/[account]/[event-slug]`) use service-role via `lib/supabase/admin.ts`. These bypass RLS entirely; v1.1 must verify each route still narrows by slug + active filter (no enumeration via UUID iteration).

**Warning signs:**
- New table added in a v1.1 migration without `enable row level security` line.
- New policy uses `=` against the helper function rather than `IN (select ...)`.
- Cross-tenant integration test still uses 2 hardcoded tenants — should be expanded to a parameterized N-tenant fixture.
- Any logged query against `accounts` / `event_types` / `bookings` that doesn't include `account_id` or `slug` filter.
- Production smoke: log in as tenant B, view dashboard, check Network tab — any response containing tenant A's UUIDs is a leak.

**Prevention:**
- **Phase 10 acceptance criterion:** the RLS matrix test (`tests/rls-cross-tenant-matrix.test.ts`) must be expanded to N=3 tenants AND must run after every migration in Phase 10/11/12. Add to CI gate.
- Audit every new migration line: `enable row level security` on all new tenant-scoped tables.
- For new columns, no policy change required (column-level RLS not in use; row-level filter cascades).
- For new public read paths (e.g., `/[account]/about`), default to service-role + slug filter + `is_active = true` + `deleted_at is null` — same pattern as v1.0 `loadEventTypeForBookingPage()`.
- Log every service-role admin client construction (already line 1 `server-only`); add a runtime warning if invoked from a code path that has a request context (heuristic).
- Manual QA in Phase 13: log in as test tenant 2, screenshot every dashboard page, confirm zero NSI data appears.

**Phase to address:** Phase 10 (provisioning) + Phase 13 (live walkthrough).

---

### P-A6: Service-Role Bypass Surface Expands via Signup

**Severity:** Critical (security)

**What goes wrong:** Signup is a public, unauthenticated route. To insert the `accounts` row (no insert RLS policy exists), the route must either (a) use service-role admin client OR (b) defer provisioning to a Postgres trigger (preferred per P-A3). If (a), public input flows directly into a service-role-authenticated INSERT — any input-validation gap is a tenant-spawning vulnerability.

**Why it happens:**
- Path of least resistance: `lib/supabase/admin.ts` is right there, already used by `/api/bookings`, `/api/cancel`, `/api/reschedule`. "Just use it for signup too."
- Without a trigger, there is no other way to insert into `accounts` with the current RLS posture.

**Warning signs:**
- Grep `lib/supabase/admin.ts` import inside any file under `app/(auth)/` or `app/api/auth/` — flag for review.
- Server logs: signup endpoint INSERTs into `accounts` from a request with no `auth.uid()`.
- No rate limit on signup endpoint.
- No Turnstile / captcha on signup form.
- Audit trail: no record of "who created account X" because the service-role path doesn't preserve the originating IP.

**Prevention:**
- **Prefer the Postgres trigger pattern (P-A3 #1).** Removes the need for service-role on the public path entirely.
- If service-role is unavoidable: gate the signup route with **(1)** `checkRateLimit({ key: 'signup:' + ip, max: 5, windowSec: 600 })` (extends existing `rate_limit_events` table), **(2)** Cloudflare Turnstile validation (same `verifyTurnstile` lib used by `/api/bookings`), **(3)** Zod-validate every field before any DB call, **(4)** insert an audit row in `booking_events` or a new `signup_audit` table with IP + UA.
- Never expose the service-role key with `NEXT_PUBLIC_*` prefix. Verify `next build` output does not include `SUPABASE_SERVICE_ROLE_KEY` in any client bundle (grep build output).
- Rotate `SUPABASE_SERVICE_ROLE_KEY` post-launch if the surface area concerns Andrew (cheap: regenerate in Supabase dashboard, redeploy).

**Phase to address:** Phase 10.

---

### P-B1: Capacity Trigger Race-Safety Regression vs. Partial Unique Index

**Severity:** Critical (double-booking returns)

**What goes wrong:** v1.0's `bookings_no_double_book` partial unique index is bulletproof: at the index level, only one row with the same `(event_type_id, start_at) WHERE status='confirmed'` can exist. INSERT contention resolves atomically — second INSERT raises `23505`. v1.1 changes "exactly 1 per slot" to "up to N per slot" via `event_types.max_bookings_per_slot`. The naive replacement — a `BEFORE INSERT` trigger that does `SELECT count(*) ... < max_bookings_per_slot` — can race under READ COMMITTED isolation. Two concurrent INSERTs both see count=N-1, both pass the check, both INSERT → final count = N+1. **Andrew's 2026-04-27 prod observation of an actual double-booking is the likely root cause being rediscovered if not addressed correctly.**

**Why it happens:**
- Default Postgres isolation is READ COMMITTED. Visibility of "uncommitted row from concurrent transaction" is not guaranteed.
- A `SELECT count(*)` does not take a row lock; concurrent INSERTs are invisible until committed.
- Trigger runs INSIDE the inserting transaction but does not lock the existing rows.

**Warning signs:**
- Any v1.1 plan that proposes "BEFORE INSERT trigger that counts existing bookings" without `FOR UPDATE`, advisory lock, or unique index.
- Load test (e.g., `Promise.all` of N+1 concurrent POSTs to `/api/bookings`) returns N+1 successful 200 responses (should be N successes + 1 409).
- Production booking count exceeds `max_bookings_per_slot` for any slot.

**Prevention (pick the strongest pattern):**

1. **Generalized partial unique index with row number.** Add `slot_index smallint NOT NULL DEFAULT 1` to `bookings`. Replace the existing `bookings_no_double_book` index with `UNIQUE (event_type_id, start_at, slot_index) WHERE status = 'confirmed'`. INSERT logic: try `slot_index = 1`, on 23505 try 2, ..., up to `max_bookings_per_slot`. After max attempts, return 409 SLOT_FULL.
   - **Pros:** Same race-guarantee as v1.0; mechanically simple; slot_index is a useful diagnostic field.
   - **Cons:** N round-trips on contended slots; minor wasted writes.

2. **Postgres advisory lock per slot.** Trigger or RPC takes `pg_advisory_xact_lock(hashtext(event_type_id::text || start_at::text))` before count check. Lock auto-released at commit/rollback.
   - **Pros:** Single-shot insert.
   - **Cons:** Hash collision possible (extremely rare); requires SECURITY DEFINER RPC pattern; lock contention scales linearly.

3. **`SELECT ... FOR UPDATE` on a sentinel row.** Maintain a `slot_capacity_state(event_type_id, start_at, count)` table; INSERT into bookings via RPC that locks the sentinel row first. Most complex; avoid unless 1+2 don't work.

4. **NOT acceptable:** plain trigger with un-locked count. Will race; will reproduce Andrew's observed bug.

**Recommended:** Pattern #1 (slot_index + extended unique index). Preserves the v1.0 invariant (DB-level atomic guard); 99% of slots will succeed on slot_index=1; only oversold slots see retries.

**Test pattern (mandatory in Phase 11):**
- Load test: capacity = 3, fire 10 concurrent `/api/bookings` POSTs against the same slot via Vitest (`Promise.all`). Assert exactly 3 successes (200) and 7 SLOT_FULL (409).
- The v1.0 race test (`bookings.race.test.ts`) covers the N=1 case; the v1.1 test must extend to N>1 with multiple capacity values.
- Direct-Postgres concurrent harness (using `pg` driver, not `supabase-js`, to bypass HTTP serialization) is the most rigorous form. Vitest can drive it via `Promise.all`.

**Phase to address:** Phase 11 (mandatory before opening signup with capacity-toggleable event types).

---

### P-B2: Migration Backward-Compat Window During Capacity Rollout

**Severity:** Critical (production outage during deploy)

**What goes wrong:** Migration adds `max_bookings_per_slot int NOT NULL DEFAULT 1`. Existing rows get default = 1. New code expects the column. Old code (cached pages, in-flight requests during deploy, edge cache) doesn't know about the column. If the migration drops the partial unique index BEFORE new code is fully deployed, there is a window where:
1. Old code POSTs to `/api/bookings` (unaware of capacity).
2. The unique index is gone.
3. The new trigger isn't deployed yet OR is deployed but not yet active.
4. Two concurrent bookings against the same slot both succeed.

**Why it happens:**
- Vercel deploys are not atomic with respect to Supabase migrations (CLI-applied separately).
- `app/(shell)` and `/api/bookings` route may serve old + new code for ~30 seconds during a deploy.
- "Drop old index, add new trigger" is naturally two SQL statements with a window between them.

**Warning signs:**
- Migration file contains `DROP INDEX` followed by `CREATE TRIGGER` or column addition.
- No double-write / double-read transition strategy.
- No staging environment confirms zero-downtime deploy.

**Prevention:**
- **Forward-compatible rollout sequence (mandatory):**
  1. Migration A: ADD column `max_bookings_per_slot int NOT NULL DEFAULT 1`. No index changes. Old code keeps working (ignores column). New code works (column = 1 means "old behavior").
  2. Deploy A: code that READS `max_bookings_per_slot` but still relies on the existing partial unique index for atomicity (capacity = 1 case, equivalent to v1.0).
  3. Migration B: ADD `slot_index smallint NOT NULL DEFAULT 1`. Replace `bookings_no_double_book` with extended unique index `UNIQUE (event_type_id, start_at, slot_index) WHERE status='confirmed'`. **Done in a single transaction:** `CREATE INDEX CONCURRENTLY` new index, then `DROP INDEX` old one, in one migration script.
  4. Deploy B: code that writes `slot_index` and retries on 23505.

- **No-rollback rule:** the partial unique index `bookings_no_double_book` is the v1.0 invariant. Whatever replaces it MUST be in place atomically. Use `CREATE UNIQUE INDEX CONCURRENTLY` then `DROP INDEX` in the same migration.
- Verify in staging (or Andrew's dev branch on Vercel preview) that double-booking is impossible mid-deploy. Run the load-test against the preview URL.

**Phase to address:** Phase 11 (migration + rollout strategy must be explicit in the plan).

---

### P-A8: Email-Confirmation Toggle Migration Risk for Existing Owner

**Severity:** Critical (production lockout for Andrew)

**What goes wrong:** v1.0 disabled email confirmation in Supabase Auth dashboard (`02-04: auth-user-provisioning — auth user creation + email-confirm disable`). v1.1 must RE-enable it for new signups. The toggle is per-project (not per-user). When re-enabled:
- Existing users (Andrew's `ajwegner3@gmail.com`) might be flagged as `email_confirmed_at IS NULL` if Supabase Auth treats them as unconfirmed by retroactive policy.
- Password-reset flow may stop working because reset emails route through the same email-confirmation codepath.
- Andrew's session cookie is unaffected (he's already authenticated), but his next forced re-login could fail.

**Why it happens:**
- Supabase Auth dashboard settings are global per project.
- "Enable email confirmation" doesn't retroactively confirm existing users.
- v1.0 created Andrew's user via `auth.admin.createUser({ email_confirm: true })` (per Plan 02-04 details), so his row should have `email_confirmed_at` set. **VERIFY THIS BEFORE TOGGLING.**

**Warning signs:**
- Andrew can't log in after toggling.
- Password-reset email never arrives, OR arrives but the link 404s (compounded with `/auth/callback` not existing — see P-A4).
- Supabase Auth logs show `email_not_confirmed` for Andrew's user.

**Prevention:**
- **Pre-flight check (Phase 10, Task 1):** SQL query `select email, email_confirmed_at from auth.users` — confirm Andrew's row has a non-null `email_confirmed_at`. If null, manually confirm via SQL `UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'ajwegner3@gmail.com'` BEFORE flipping the dashboard toggle.
- Test in a Supabase preview branch first if possible (Supabase Branching available on Pro tier).
- Document the toggle in Phase 10 acceptance criteria with a screenshot of the "before" and "after" state.
- Pair with `/auth/callback` route fix (P-A4) — re-enabling email confirmation without a working callback bricks every new signup.

**Phase to address:** Phase 10 (Task 1 / pre-flight).

---

### P-A4: `/auth/callback` Route 404 Blocks Email Verification

**Severity:** Critical (signup fundamentally broken without this)

**What goes wrong:** v1.0 has no `/auth/callback` route (confirmed: `app/auth/` only contains `signout/`). Supabase email confirmation, password reset, and magic-link flows all redirect to `/auth/callback?code=...` after the user clicks the email link. Currently this 404s. v1.1 multi-user signup is impossible without this route.

**Why it happens:**
- v1.0 disabled email confirmation, so the route was never built.
- The `@supabase/ssr` PKCE code-exchange pattern is non-trivial (cookies, code verifier, state validation).
- Tutorials are split between `@supabase/auth-helpers` (deprecated) and `@supabase/ssr` (current); Claude's training data may pull from the wrong one.

**Warning signs:**
- User clicks confirmation link → lands on 404 page.
- Production logs: 404 GET `/auth/callback?code=...`.
- Supabase Auth dashboard: "Site URL" or "Redirect URLs" do not include the production `/auth/callback` path.

**Prevention:**
- Build `app/auth/callback/route.ts` as a Route Handler that:
  ```typescript
  import { createClient } from '@/lib/supabase/server'
  import { NextResponse, type NextRequest } from 'next/server'

  export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/app'
    if (code) {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/app/login?error=auth_callback_failed`)
  }
  ```
- Configure Supabase dashboard "Redirect URLs" to include both `https://calendar-app-xi-smoky.vercel.app/auth/callback` AND every Vercel preview URL pattern (`https://calendar-app-*.vercel.app/auth/callback`) — Supabase supports wildcards as of 2025.
- PKCE is enabled by default in `@supabase/ssr` ≥0.4 — confirm version in `package.json`.
- Test by creating a new test user in Supabase dashboard, triggering "Send invite", and clicking the link. Should land on `/app` after callback.

**Phase to address:** Phase 10 (Task 1 / pre-flight, or wedge into earliest task).

---

### P-A12: Gmail SMTP Quota Exhaustion Under Mass Signup Load

**Severity:** Critical (deliverability collapse + potential Gmail account suspension)

**What goes wrong:** v1.0 sends ALL transactional email through `ajwegner3@gmail.com` via `lib/email-sender/providers/gmail.ts`. Gmail SMTP free tier is **~500 messages per day** (Gmail's documented limit; lower for newer accounts). v1.1 introduces signup confirmation emails, password-reset emails, plus the existing booking + reminder + cancel + reschedule + owner-notification flows. A burst of signups (Reddit post, contractor industry mention, even bot-driven enumeration) saturates the daily quota. Once exceeded:
- Gmail rate-limits or blocks SMTP for the day.
- Existing booking confirmation emails silently fail (reminder retry = NONE per design — see C6).
- In severe abuse, Google may flag the account for suspicious activity and suspend it (this would brick ALL transactional email until manual recovery).

**Why it happens:**
- Personal Gmail SMTP was a deliberate v1.0 pivot for time-to-ship; was acceptable for a single-tenant tool.
- Multi-user signup fundamentally changes the volume profile. Even 50 signups/day + their first bookings + verification + reminders quickly approach the cap.
- Gmail SMTP failures often surface as cryptic SMTP error codes inside `nodemailer` (e.g., 421, 454, 550); the email-sender library catches and logs but doesn't alert.

**Warning signs:**
- `lib/email-sender/providers/gmail.ts` logs SMTP errors with codes 421/454/550.
- Sudden drop in delivery rate (no errors but emails not arriving — signal of soft block).
- Gmail account inbox: warning email from Google about "unusual sending activity."
- Daily email count metric (count rows in any send-log) approaching 400+.

**Prevention:**
- **Pre-Phase-10 acceptance criterion:** evaluate Resend / Postmark / Mailgun migration BEFORE opening public signup. Plan 10 should call out this decision explicitly.
- If sticking with Gmail SMTP for v1.1: cap signups at a low daily rate via rate-limit (e.g., 50 signups/day globally for the v1.1 launch period). Add a "private beta" code field that gates signup until volume is monitored.
- Add a daily-send-count metric and dashboard. If it exceeds a threshold (e.g., 300/day), Slack/email alert Andrew.
- Always have plain-text fallback in emails (mail-tester deduction risk per C5 / FUTURE_DIRECTIONS.md §3).
- v1.0 Resend research is in `.planning/` (Plan 05-02 era) — pulling that thread is cheaper now than after 100 signups.

**Phase to address:** Phase 10 (pre-flight) + Phase 13 (verify in staging burst test).

---

### P-C2: Email-Client Gradient Compatibility Failure

**Severity:** Critical (branding mismatch in 30%+ of inboxes)

**What goes wrong:** v1.1 BRAND-05 adds `accounts.background_shade` (gradient intensity). Email templates render gradient backgrounds via inline `style="background: linear-gradient(...)"`. Outlook for Windows desktop (still ~5–10% market share, especially in trades) renders email through the Microsoft Word HTML engine, which **does not support `linear-gradient`**. Result: the gradient header collapses to white (or to the first color stop if VML is used), the logo positions break, the H1 text-color picked by `pickTextColor()` no longer has the assumed background.

**Why it happens:**
- Email HTML/CSS support is fragmented across clients. `linear-gradient` works in Apple Mail, Gmail web, Outlook 365 web — but NOT Outlook desktop (Word-engine), NOT Outlook for Mac in some versions, partially in Lotus Notes (irrelevant for trades).
- Developers test in Gmail web, see it works, ship.
- The `pickTextColor()` helper at `lib/branding/contrast.ts:47` takes a single hex; gradients have endpoint colors that can have wildly different luminance — a gradient from light yellow to dark navy will fail contrast at one end no matter which text color is chosen.

**Warning signs:**
- Email QA in Outlook desktop shows white/blank header where gradient should be.
- Apple Mail iOS mostly fine; Outlook desktop "broken".
- mail-tester.com may flag the email if it has only HTML and the gradient breaks the layout.
- `pickTextColor()` is called with only `accounts.brand_primary` — gradients have at least two relevant points.

**Prevention:**
- **Solid-color fallback strategy.** Email gradients always wrap with VML for Outlook compatibility. The pattern:
  ```html
  <!--[if mso]>
  <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false"
          style="width:600px;height:80px;">
    <v:fill type="gradient" color="#FFE4B5" color2="#FFA07A" angle="135" />
    <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
  <![endif]-->
  <div style="background: linear-gradient(135deg, #FFE4B5, #FFA07A); ...">
    [content]
  </div>
  <!--[if mso]>
    </v:textbox>
  </v:rect>
  <![endif]-->
  ```
- **Or:** use a solid color for email headers (the average of the two gradient endpoints, or just `brand_primary`), and reserve gradients for the web UI only. **Recommended for v1.1** — simpler, fewer cross-client surprises, falls back gracefully.
- Extend `pickTextColor()` to handle the "background-pair" case: compute contrast for BOTH gradient endpoints and the midpoint; if any fails WCAG AA, fall back to a solid background color in email and warn the owner in the branding editor.
- Test the v1.0 LIKELY-PASS Apple Mail code-review criteria (FUTURE_DIRECTIONS.md §5) extended to gradient cases. Specifically check `border-radius` (already present, harmless), `linear-gradient` (must have VML fallback), `background-image` (Apple Mail strips by default — confirm).
- Phase 12 mandatory test matrix: 1 owner with light-bg gradient, 1 with dark-bg gradient, 1 with high-contrast gradient. Render each via mail-tester + manual screenshots in Gmail web + Apple Mail.

**Phase to address:** Phase 12.

---

### P-C7: Visual Regression Risk — No Snapshot Tests Exist

**Severity:** Critical (Phase 12 risks silently breaking the booking flow that Andrew already signed off)

**What goes wrong:** Phase 12 refactors EVERY UI surface (5 of them). v1.0 has zero Playwright tests, zero visual-regression snapshots. The booking flow, confirmation page, cancel/reschedule pages, branding editor, and dashboard all share the `BrandedPage` wrapper + Tailwind utilities. A change to `BrandedPage` to support gradients can break the booking page layout in subtle ways (footer overlap, card padding, mobile breakpoint) without any test failing — only Andrew's eyes catch it. Andrew already signed off v1.0 specifically waiving live-render testing (FUTURE_DIRECTIONS.md §1 Known Limitations); rerunning that QA in v1.1 is exactly the marathon QA Andrew scope-cut.

**Why it happens:**
- Visual regression tooling (Playwright + screenshot diffs) was never set up.
- The team velocity of v1.0 was achieved partly by deferring this; v1.1 inherits the gap.
- Tailwind class changes have cascading effects that pure unit tests can't catch.

**Warning signs:**
- `package.json` has no `@playwright/test` or `playwright` dependency.
- Any v1.1 plan that says "refactor the BrandedPage wrapper" without an accompanying screenshot-test plan.
- Phase 13 manual QA scope in v1.1 is identical to Phase 9 / v1.0 (which got scope-cut to v1.2).

**Prevention:**
- **Phase 12 acceptance criterion:** establish a minimum-viable Playwright suite covering 5 critical screenshots: (1) `/[account]/[event-slug]` booking page, (2) confirmation page, (3) `/app` dashboard home, (4) `/app/branding` editor, (5) embed widget at 320 + 768 + 1024 viewports. ~12 screenshots total.
- Run Playwright in CI on every PR with `--update-snapshots` only on explicit approval.
- The investment is ~1 day; pays off across Phase 12 (constant refactoring) + Phase 13 (QA) + every future milestone.
- Alternative: defer visual regression to v1.2, but then **Phase 13 QA must be done by Andrew personally** (no scope-cut option) since automated coverage is absent. State this trade-off explicitly in the Phase 12 plan.
- For highest-leverage cheap insurance: at minimum, before/after screenshots committed manually for each Phase 12 wave.

**Phase to address:** Phase 12 (setup) + Phase 13 (run as gate).

---

## Moderate Pitfalls (v1.1)

Mistakes that cause UX regressions, technical debt, or delays. Should be addressed but won't sink the milestone.

---

### P-A2: Slug Collision Race + UX Recovery

**Severity:** Moderate

**What goes wrong:** Two users pick the same slug at the same moment in the signup wizard. Slug-picker calls a "is this slug available?" check; both pass; both INSERT; one succeeds, one fails on `event_types_account_id_slug_active` UNIQUE — wait, that's per-account. The relevant unique constraint is `accounts.slug` (account-level slug, used in `/[account]` URL). One signup succeeds, the other returns a 23505 error.

**Why it happens:** Inherent in any "check then insert" pattern across separate transactions.

**Warning signs:**
- 23505 PostgreSQL error in signup endpoint logs.
- User reports "I picked a slug that said available, then got an error."

**Prevention:**
- Slug picker UI auto-suggests 3 alternatives on collision (`{slug}-2`, `{slug}-omaha`, `{firstname}-{lastname}`).
- Server-side: catch 23505 from `accounts` insert, return 409 with `nextAvailable` candidates pre-computed.
- Wizard preserves all other entered data on retry — never lose typed input.
- Reserve slugs at registration time via a short-TTL `slug_reservations` table (not strictly necessary; auto-suggest is simpler).

**Phase to address:** Phase 10.

---

### P-A9: Onboarding Wizard Abandonment Recovery

**Severity:** Moderate

**What goes wrong:** User signs up → email verification → clicks link → onboarding wizard starts → abandons mid-step. `auth.users` exists; `accounts` exists (if trigger pattern); but no event types, no availability rules. Next login lands on dashboard with empty state. User confused.

**Why it happens:** Wizard abandonment is normal (~20–40% drop-off in B2B SaaS).

**Warning signs:**
- High auth.users count vs. event_types count.
- Users with `accounts` rows but zero `event_types` after >1 week.

**Prevention:**
- Dashboard empty state explicitly directs to "Resume setup" if any required step (timezone, first event type, first availability rule) is incomplete.
- Track `accounts.onboarding_completed_at` (nullable) — set when wizard finishes; redirect to wizard if NULL on dashboard load.
- Don't auto-redirect — banner with "Resume setup" CTA, dismissible. Power users may want to go straight to the dashboard.

**Phase to address:** Phase 10.

---

### P-A10: Slug Squatting / Bot Signups

**Severity:** Moderate

**What goes wrong:** Bots discover `/signup`, register with random emails, claim valuable slugs (`plumber`, `roofer`, `omaha-hvac`). When a real contractor tries to sign up, the slug they want is taken.

**Why it happens:** Public signup forms are bot-magnets. Trade contractors aren't the only entities scraping the URL space.

**Warning signs:**
- Spike in signup rate from a single IP range.
- High auth.users count with zero subsequent activity (no event types created, no logins after first).
- Slug pattern looks generated (`user12345`, `aaaaaa`) — or worse, *dictionary slugs* claimed by accounts that never log in.

**Prevention:**
- Cloudflare Turnstile on signup form (same `verifyTurnstile` lib used by `/api/bookings`). Free, integrated.
- Rate limit signup at 5/hour/IP (extend `rate_limit_events` with key `signup:`).
- Reserved slug list (consolidated — see P-X11): block `admin`, `api`, generic occupation names (`plumber`, `electrician`, `roofer`), city names if NSI is local-focused. Andrew should curate this list.
- Background job: prune accounts inactive >30 days that never created an event type. Free up squatted slugs.
- Honeypot field in signup form (hidden CSS field that bots fill, real users don't) — bots auto-rejected.

**Phase to address:** Phase 10.

---

### P-X11: `RESERVED_SLUGS` Duplication Drift

**Severity:** Moderate (existing v1.0 tech debt, becomes a security gap if missed in v1.1)

**What goes wrong:** v1.0 has `RESERVED_SLUGS = ["app", "api", "_next", "auth", "embed"]` duplicated in two files (`app/[account]/[event-slug]/_lib/load-event-type.ts` AND `app/[account]/_lib/load-account-listing.ts`). v1.1 adds signup → must add `signup`, `login`, `reset-password`, `auth/callback`-relevant prefixes to the reserved list. If only ONE of the two files is updated, the slug-picker validates against an incomplete list, and a malicious user could register `slug=signup`, gaining `/[account]/signup`-style URL collision attacks.

**Why it happens:** Hand-sync is brittle; v1.0 noted this as tech debt (`FUTURE_DIRECTIONS.md §2 Assumptions & Constraints`).

**Warning signs:**
- Grep across both files diverges.
- Phase 10 plan mentions adding to one file but not the other.

**Prevention:**
- **Phase 10 Task 1: consolidate `RESERVED_SLUGS` to a single source of truth.** Move to `lib/slugs/reserved.ts` (server-only or shared as desired). Both existing files import from there. Signup wizard imports from there. Future v1.2 routes import from there.
- Add a unit test that asserts `RESERVED_SLUGS` includes every top-level path segment in `app/`. Auto-detects new routes that need protection.
- Add to slug Zod schema: `.refine(slug => !RESERVED_SLUGS.includes(slug), { message: 'Slug is reserved.' })`.

**Phase to address:** Phase 10 (consolidate first; everything else depends on it).

---

### P-A13: Auth Endpoints Lack Rate Limiting

**Severity:** Moderate (becomes Critical at scale)

**What goes wrong:** `/api/auth/signup`, `/api/auth/login`, `/api/auth/reset-password` endpoints get hit by brute-force attempts. v1.0 has rate limiting on `/api/bookings`, `/api/cancel`, `/api/reschedule` (per-IP, Postgres-backed via `rate_limit_events`). Auth endpoints currently lack this protection (login is a Server Action and benefits from Supabase's own rate limit, but signup if newly built will be a public API route).

**Why it happens:** Existing rate-limit infrastructure was built for booking-flow routes; auth wasn't a public surface.

**Warning signs:**
- Spike in 401/400 responses on auth endpoints from a single IP.
- Supabase Auth rate-limit errors in logs (Supabase has its own internal rate limit but it's permissive for a "public" pattern).

**Prevention:**
- Extend `checkRateLimit` to auth endpoints with route-specific keys:
  - `signup:{ip}` — 5/hour
  - `login:{ip}` — 10/5min
  - `reset-password:{email}` — 3/hour (per-email, not per-IP, to prevent inbox harassment)
- Login is a Server Action — wrap it with rate-limit at the action's first line.
- Reset-password rate limit prevents spam-resending password-reset emails to a target email.
- Fail-OPEN on rate-limit DB errors (matches v1.0 pattern; better to allow legitimate users than lock everyone out).

**Phase to address:** Phase 10.

---

### P-A14: Multi-Tab Signup Race

**Severity:** Moderate

**What goes wrong:** User opens signup form in tab 1, opens it again in tab 2 (forgot they had one open). Submits both within seconds. Both create `auth.users` rows? Both INSERT into `accounts`? Slug collision? Email-confirmation emails arrive in duplicate?

**Why it happens:** Idempotency is rarely designed in.

**Warning signs:**
- User reports "I got two confirmation emails."
- Two `auth.users` rows for the same email (shouldn't happen — Supabase Auth has UNIQUE on email).

**Prevention:**
- Supabase Auth's UNIQUE on email handles the duplicate-user problem at the DB level. Tab 1 succeeds; tab 2 gets `user_already_exists` error — which (via P-A1) returns the same generic success message.
- Slug collision on the wizard-step is handled by P-A2.
- Idempotency key: signup form generates a client-side UUID per page load, sends with the request; server dedupes within a 5-minute window via `rate_limit_events` table abuse (key = `signup-idem:{uuid}`).
- Acceptable level of user confusion — not worth heavy infrastructure.

**Phase to address:** Phase 10.

---

### P-A15: Missing Supabase Allowed-Redirects Config

**Severity:** Moderate (silent production bug)

**What goes wrong:** Supabase Auth dashboard has an allowlist of redirect URLs. Email-confirmation links + password-reset links use only redirects matching this list. Production-deploy-time omission: forgetting to add the production URL OR Vercel preview URL pattern. Result: signup verification email arrives, user clicks the link, lands on Supabase's "redirect URL is not allowed" error page.

**Why it happens:** Per-environment config; easy to forget on first deploy.

**Warning signs:**
- Test signup in production fails at the verification-link step.
- Supabase Auth logs: `redirect_to is not allowed`.

**Prevention:**
- Phase 10 acceptance criteria: Supabase dashboard "Authentication > URL Configuration" includes:
  - Site URL: `https://calendar-app-xi-smoky.vercel.app`
  - Redirect URLs: `https://calendar-app-xi-smoky.vercel.app/auth/callback`, `https://calendar-app-*.vercel.app/auth/callback` (wildcard for previews), `http://localhost:3000/auth/callback` (dev)
- Document these in `.planning/phases/10-*/CONTEXT.md` setup checklist.
- Test in Vercel preview branch BEFORE merging to main.

**Phase to address:** Phase 10 (Phase 13 verifies live).

---

### P-B3: Capacity = 0 Validation Footgun

**Severity:** Moderate

**What goes wrong:** Owner accidentally sets `max_bookings_per_slot = 0` in the event-type editor. No one can book. Owner doesn't realize until customers complain.

**Why it happens:** Form input validation gap.

**Warning signs:**
- Event types in DB with `max_bookings_per_slot = 0`.
- Slot endpoint returns empty for an active event type.

**Prevention:**
- DB-level: `CHECK (max_bookings_per_slot >= 1)` in the migration. Default 1.
- Zod schema: `z.number().int().min(1).max(20)` (max protects against typos like `1000`).
- UX: stepper input (not free-text), min=1, with clear label "How many bookings can be made for the same time slot?"
- Owner-facing helpful empty-state if all event types have capacity issues.

**Phase to address:** Phase 11.

---

### P-B4: Capacity Decrease With Existing Bookings (Over-Capacity State)

**Severity:** Moderate (unexpected UX state for owners)

**What goes wrong:** Owner has 5 bookings at capacity 5. Owner edits to capacity 3. Existing 5 bookings stay (can't kick out customers). System now has slot at "over capacity" — 5 booked, capacity = 3. New bookings should be blocked until 2 cancellations. Owner is confused: "I set capacity to 3 but I see 5 bookings."

**Why it happens:** Capacity is a forward-looking constraint, not a backward-applied one.

**Warning signs:**
- Owner reports booking-count > capacity for a slot.
- Slot endpoint shows "fully booked" for slots that look "available" to the owner per their settings.

**Prevention:**
- Owner-facing UX: on capacity decrease, show a warning if any current slots have more bookings than the new capacity. "Slot 2026-05-01 14:00 has 5 bookings; new capacity 3 means it will remain unbookable until 3+ existing bookings cancel."
- Don't auto-cancel bookings (UX disaster).
- Surface the over-capacity state on the dashboard bookings list with a badge.
- Alternative: add a "warn-only / block save" toggle in the editor.

**Phase to address:** Phase 11.

---

### P-B5: Stale Slot Cache Permits Doomed Booking Attempts

**Severity:** Moderate

**What goes wrong:** `/api/slots` is currently `Cache-Control: no-cache` (verified for v1.0 booking flow). v1.1 capacity-aware logic must preserve this. Stale slot list cached at the CDN or browser would let a 4th person try to book a capacity-3 slot — race-safe at the DB layer (P-B1 prevents the actual double-booking) but bad UX (user picks slot, submits, gets 409, has to re-pick).

**Why it happens:** Performance optimization gone wrong.

**Warning signs:**
- `/api/slots` response headers don't include `Cache-Control: no-cache, no-store, must-revalidate`.
- Vercel Edge Cache caching the slot endpoint.
- Users report "I see a slot, click it, get 'no longer available'."

**Prevention:**
- Verify response headers in Phase 11. Same `no-cache` posture as v1.0.
- Optional: short-TTL revalidation (`Cache-Control: private, max-age=10, stale-while-revalidate=30`) — 10 seconds is short enough that doomed attempts are rare.
- Slot picker UI: refetch slots after every booking attempt (already v1.0 behavior via `refetchKey`).

**Phase to address:** Phase 11.

---

### P-B6: Concurrent Test Harness Coverage at N>1

**Severity:** Moderate (test gap, not a runtime bug — but enables runtime bugs)

**What goes wrong:** v1.0 has a 2-concurrent race test for the partial unique index. v1.1 capacity logic needs N-concurrent (e.g., 10 concurrent for capacity=3). Vitest's default behavior is sequential within a test file; the existing race test uses `Promise.all` with 2 promises. Scaling to 10 concurrent inserts requires the harness to actually achieve concurrent INSERTs at the DB level.

**Why it happens:**
- `supabase-js` serializes requests through a single fetch client per instance. `Promise.all` of 10 supabase-js calls may serialize at the HTTP layer.
- Need direct Postgres driver (`pg` or `postgres-js`) to achieve true concurrency.

**Warning signs:**
- Race test always passes (suspicious — either no race exists OR the test isn't actually racing).
- Test logs show sequential timestamps for "concurrent" inserts.

**Prevention:**
- Phase 11 acceptance criterion: race test uses `pg` driver directly with N+1 simultaneous transactions, asserts exactly N succeed.
- OR test harness uses 10 separate `createClient()` instances, each with its own fetch agent, fired via `Promise.all`.
- Document the chosen pattern; v1.0's existing race test in `tests/bookings.race.test.ts` (or similar) is the starting reference.

**Phase to address:** Phase 11.

---

### P-B7: 409 Reason-Code Conflation

**Severity:** Moderate (UX clarity)

**What goes wrong:** v1.0 `/api/bookings` returns 409 for "slot taken" (race-loser scenario). v1.1 introduces a NEW 409 case: "slot capacity reached" (slot has N bookings, no more). Plus existing rate-limit returns 429. UI must distinguish these:
- 409 SLOT_TAKEN (race loser, same as v1.0): "Someone just booked this slot. Try another."
- 409 SLOT_CAPACITY_REACHED: "This time is fully booked. Please choose another."
- 429 RATE_LIMITED: "Too many attempts. Wait 5 minutes."

If conflated, user can't tell whether to retry now or wait.

**Why it happens:** Over-loading 409 with multiple reasons.

**Warning signs:**
- Single inline error banner reads "Booking conflict" regardless of cause.
- Tests pass on race-loser scenario but capacity-full case is identical.

**Prevention:**
- Response body includes machine-readable code: `{ code: 'SLOT_TAKEN' | 'SLOT_CAPACITY_REACHED' | 'RATE_LIMITED', message: '...', retryAfterMs?: number }`.
- Rate-limit case uses 429 not 409.
- Update `RaceLoserBanner` (v1.0 component) to read the code field and render the appropriate copy.

**Phase to address:** Phase 11.

---

### P-C1: Tailwind v4 Dynamic Class Purge for Per-Account Themes

**Severity:** Moderate

**What goes wrong:** Tailwind v4 (in use per `package.json`) statically purges classes not present in source files. A class string like `bg-[#${account.brand_primary}]` cannot be reliably purged — Tailwind sees the literal `bg-[#${account.brand_primary}]` as a template string and may or may not include the runtime class. v1.0 dodged this with inline CSS variables (`--brand-primary` via inline `style` on `EmbedShell` per FUTURE_DIRECTIONS.md). v1.1 adds gradient styling — must extend the inline-CSS-vars pattern, NOT introduce dynamic Tailwind classes.

**Why it happens:** Tailwind dynamic-class pitfall is universal; gradient case is a fresh occurrence of an existing pattern.

**Warning signs:**
- `bg-[var(--brand)]` works but only with the variable defined upstream; if upstream skips definition, falls through to default-Tailwind (which uses `var(--tw-bg-opacity)` → blank).
- Gradient `bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)]` requires both `--brand-from` and `--brand-to` defined.
- "Branding works in dev" but breaks in prod (purge removes class only at build time).

**Prevention:**
- ALL dynamic colors flow through CSS variables on `BrandedPage` wrapper. v1.0 pattern locked at `--brand-primary` and `--brand-text`.
- v1.1 adds: `--brand-bg-color`, `--brand-bg-shade-from`, `--brand-bg-shade-to`. Defined inline on the page wrapper from the loaded `account` row.
- Gradient via raw CSS, not Tailwind utility: `<div style="background: linear-gradient(135deg, var(--brand-bg-shade-from), var(--brand-bg-shade-to))">`. Tailwind layout utilities (padding, sizing) only.
- Build-time check: `npm run build` output shouldn't contain warnings about "ignored" dynamic classes.

**Phase to address:** Phase 12.

---

### P-C3: Per-Account Gradient Contrast Accessibility

**Severity:** Moderate (WCAG compliance + UX)

**What goes wrong:** Owner picks light yellow background + light yellow gradient endpoint + white text. Body text becomes unreadable. v1.0 contrast helper (`lib/branding/contrast.ts`) only handles solid backgrounds. Gradients have endpoint colors AND a midpoint where text appears — at least 3 points to check. If any point fails WCAG AA (contrast ratio ≥ 4.5:1 for body text, 3:1 for large text), the page is inaccessible.

**Why it happens:** Brand-color pickers default to letting the user choose anything; contrast checks are after-the-fact.

**Warning signs:**
- Owner sees their dashboard fine (high-contrast monitor, dim light) but bookers complain "can't read the page."
- Lighthouse a11y score drops below v1.0 baseline.
- Contrast ratio for either gradient endpoint < 4.5:1.

**Prevention:**
- Extend `pickTextColor()` to accept multiple background colors:
  ```typescript
  export function pickTextColorForGradient(colors: string[]): "#ffffff" | "#000000" {
    // Pick the text color whose worst-case contrast across all stops is best.
    const luminances = colors.map(relativeLuminance);
    const worstWhite = Math.min(...luminances.map(L => 1.05 / (L + 0.05)));
    const worstBlack = Math.min(...luminances.map(L => (L + 0.05) / 0.05));
    return worstWhite >= worstBlack ? "#ffffff" : "#000000";
  }
  ```
- Branding editor: live contrast warning if the BEST achievable contrast (white or black text vs. worst gradient stop) is < 4.5:1. Don't BLOCK save — show the warning, let owner override (it's their brand).
- For mid-luminance backgrounds where neither white nor black achieves AA: warn and force fallback to a high-contrast solid background.
- Document the WCAG decision in `lib/branding/contrast.ts` JSDoc — current single-color version stays for backward compat.

**Phase to address:** Phase 12.

---

### P-C4: CSP `style-src` Impact on Per-Account Inline Styles

**Severity:** Moderate

**What goes wrong:** v1.1 inline styles for per-account gradients via `<style>` blocks or inline `style="..."` attributes. Current `proxy.ts` sets `Content-Security-Policy: frame-ancestors 'self'` (or `*` for embed). It does NOT set `style-src` or `script-src` — meaning the browser's default policy applies (which permits inline styles unless other directives constrain). **This is fine for now** — but if future hardening adds `default-src 'self'` to the CSP, inline styles will break.

**Why it happens:** CSP hardening is often added piecemeal; one team adds `default-src 'self'` not realizing inline styles are everywhere.

**Warning signs:**
- Browser console warning: `Refused to apply inline style because it violates the following Content Security Policy directive`.
- CSP report-only mode shows inline-style violations.

**Prevention:**
- Phase 12 accepts the current CSP posture (no `style-src` directive) — DON'T harden CSP in v1.1.
- Document in `proxy.ts` comments: "Per-account branding requires inline styles. Adding `style-src 'self'` would break gradient backgrounds. Defer hardening to v1.2 with a `nonce` or hash-based approach."
- If future hardening adds `style-src`, must use `'unsafe-inline'` OR per-request nonces (Next.js supports this via headers on a per-request basis).

**Phase to address:** Phase 12 (no action needed; document constraint).

---

### P-C5: Server→Client Gradient Prop Drilling Performance

**Severity:** Moderate

**What goes wrong:** Per-account brand colors are loaded server-side (Server Component), passed to `BrandedPage` wrapper. Wrapper applies inline CSS vars. If the wrapper is regenerated on every render (e.g., parent re-renders triggered by client interactions), the inline `style` object is a fresh reference each render → React reconciliation re-applies → no measurable problem at v1.1 scale, BUT if the gradient is computed via a heavy function (e.g., parsing brand colors, computing luminance, picking text color) each render burns CPU.

**Why it happens:** Memoization gaps on server-derived values that flow through client components.

**Warning signs:**
- React DevTools profiler shows `BrandedPage` re-rendering on every interaction.
- `pickTextColorForGradient()` called > 1 time per page load.

**Prevention:**
- Compute `pickTextColorForGradient()` ONCE in the Server Component (where account is loaded). Pass the resolved `--brand-text` value as a string prop, not the computation function.
- `BrandedPage` accepts pre-resolved CSS variable values; doesn't compute anything on its own.
- If client-side branding live-preview (in branding editor) is needed, that's a separate flow with `useMemo` on the colors.

**Phase to address:** Phase 12.

---

### P-C6: Embed Widget Gradient + Iframe Height Race

**Severity:** Moderate

**What goes wrong:** Gradient backgrounds may extend the visual layout (e.g., a tall gradient header pushes content down). The `nsi-booking:height` postMessage protocol relies on `ResizeObserver` watching `document.documentElement`. If gradient content loads after initial paint (e.g., logo image), height changes mid-flight, postMessage fires with the right value — but the parent iframe may flicker or scroll-jump.

**Why it happens:** Async content loading (logos, fonts) re-triggers layout.

**Warning signs:**
- Embed iframe visibly "jumps" on initial load.
- ResizeObserver fires twice with different heights within 500ms.
- Customer reports "the widget jumps when loading."

**Prevention:**
- Gradient backgrounds applied via CSS (instant, no async) — not via images.
- Logo image has explicit `width` and `height` attributes (prevents layout shift).
- ResizeObserver observation already in v1.0 — just verify it still fires when gradient + logo come in.
- Embed handshake timeout (5s in v1.0) catches degenerate cases.
- Test embed at slow-3G in DevTools Network throttle.

**Phase to address:** Phase 12.

---

### P-C9: Sidebar IA Refactor Breaking Active-State Highlighting

**Severity:** Moderate

**What goes wrong:** v1.1 Phase 12 adds Settings group + Home tab to the sidebar in `app/(shell)/layout.tsx`. Existing sidebar uses `pathname.startsWith(...)` to highlight active links. Adding nested Settings group requires either accordion expand/collapse logic or refactoring the active-detection. Risk: existing routes (`/app/event-types`, `/app/availability`, etc.) lose their active highlighting because the new sidebar nav structure breaks the pathname matcher.

**Why it happens:** Refactor cascade.

**Warning signs:**
- Visual regression: active link no longer highlighted on existing routes.
- Sidebar accordion auto-collapses on navigation.

**Prevention:**
- Refactor the active-detection into a single helper (`isActive(pathname, route)`) and unit-test it for every route in the new sidebar.
- Sidebar state (which group is expanded) persists in `sidebar_state` cookie (v1.0 already uses this — extend to track expanded groups).
- Visual regression test (P-C7) catches this if set up.

**Phase to address:** Phase 12.

---

### P-C10: Mobile Responsiveness Regression from Cruip "Simple Light"

**Severity:** Moderate

**What goes wrong:** Cruip "Simple Light" landing page aesthetic is desktop-first (large hero, wide cards, generous padding). Booking flow already validated at 320 / 768 / 1024 (per v1.0 ROADMAP, deferred to v1.1 marathon QA per FUTURE_DIRECTIONS.md). Phase 12 changes risk pushing breakpoints in ways that break the booking flow on mobile — exactly the surface where conversions matter most for trades (~60% mobile traffic).

**Why it happens:** Designs ported from desktop-first templates rarely test mobile.

**Warning signs:**
- Phase 12 PR shows changes to padding/margin without media query coverage.
- Manual device test: 375px (iPhone) shows horizontal scroll or cut-off CTA.
- Lighthouse mobile score drops below v1.0 baseline.

**Prevention:**
- Phase 12 acceptance criterion: every modified surface tested at 320px AND 768px AND 1024px before merging.
- Use Tailwind responsive utilities (`sm:`, `md:`, `lg:`) for every spacing/sizing change.
- Visual regression suite (P-C7) covers the three viewports.
- Cruip template provides reference; adapt mobile breakpoints, don't copy desktop-only layouts.

**Phase to address:** Phase 12 + Phase 13 (live device check).

---

### P-C11: Email Logo + Gradient Header Layout Risk

**Severity:** Moderate

**What goes wrong:** v1.0 emails insert a logo image at the top via `lib/email/branding-blocks.ts`. v1.1 adds a gradient ABOVE or BEHIND the logo. Email clients with images-disabled (Outlook desktop default; some Gmail configurations) show no logo + no gradient → header collapses to nothing or shows alt-text against an unintended background. Also: Gmail clips emails over 102 KB (HTML body) → the inlined gradient styles (which can be verbose with VML fallback) may push the body over the limit, causing Gmail to show "View entire message" link mid-email.

**Why it happens:**
- Email clients pretty universally disable images by default for security.
- Gmail's 102 KB HTML clip is a hard limit applied to the rendered HTML.
- VML for Outlook gradient fallback adds ~500–1000 bytes per gradient.

**Warning signs:**
- Inboxes show "View entire message" link partway through.
- Outlook desktop with images disabled shows broken layout where logo should be.
- Email body HTML > 100 KB.

**Prevention:**
- Gradient applied as CSS background-color WITH `linear-gradient` fallback. Logo image has alt text + dimensions + a sensible fallback color.
- Use a solid color for the gradient cell when images are disabled (default browser fallback).
- Keep email HTML under 100 KB. Strip whitespace at build time (`html-minifier-terser` or simple regex).
- Phase 12 mandatory: render every email template, measure HTML size, alert if > 90 KB.
- Gmail clipping FAQ: a single email > 102 KB will be clipped; the .ics attachment is separate (doesn't count toward HTML body).

**Phase to address:** Phase 12.

---

### P-C12: Color Picker Live-Preview Cache Skew

**Severity:** Moderate

**What goes wrong:** Owner edits brand color in `/app/branding`; live preview iframe shows old color due to caching. v1.0 used cache-busting (`?v=${Date.now()}` on logo URL per Plan 07-04). v1.1 adds `background_color` and `background_shade` — must extend cache-busting OR live-preview refetch logic OR rely on the iframe's natural reload-on-state-change.

**Why it happens:** Browser caches image and CSS; React state updates the URL but iframe `src` doesn't reload unless the URL string changes.

**Warning signs:**
- Owner saves new color, refreshes preview iframe, still shows old color.
- Owner reports "I changed the color but it's not showing."

**Prevention:**
- Branding editor passes brand colors via URL params (`?previewBg=...&previewShadeFrom=...&previewShadeTo=...`) per v1.0 pattern (`?previewColor`/`?previewLogo`).
- iframe `src` includes a cache-busting timestamp on every preview update, OR re-mounts iframe on color change via a `key` prop.
- Same pattern as v1.0 logo upload.

**Phase to address:** Phase 12.

---

## Minor Pitfalls (v1.1)

Issues fixable post-ship if missed; not gating.

---

### P-A11: Browser Timezone Detection Edge Cases

**Severity:** Minor

**What goes wrong:** Signup wizard captures timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Modern browsers return IANA strings (`America/Chicago`). Some old browsers / privacy tools return empty string, `UTC`, or `null`.

**Prevention:** Default to `America/Chicago` (NSI's default) if undefined/empty/unparseable. Validate against IANA list at signup. Owner can change in settings.

**Phase to address:** Phase 10.

---

### P-X14: tsc Test-Mock Alias Errors Compounding

**Severity:** Minor

**What goes wrong:** Pre-existing `tsc --noEmit` alias errors (`__mockSendCalls` etc.). v1.1 adds new tests, possibly adding new aliased mocks → more tsc errors → drift between `vitest.config.ts` and `tsconfig.json` continues.

**Prevention:** Phase 10 Task 1: add tsconfig path mapping to alias the same paths as `vitest.config.ts`. One-time fix; pre-Phase-10 cleanup.

**Phase to address:** Phase 10 (pre-flight).

---

### P-X15: Migration Drift Workaround Reminder

**Severity:** Minor (workflow gotcha)

**What goes wrong:** `supabase db push --linked` fails (FUTURE_DIRECTIONS.md §2). Phase planners may reach for `db push` and get blocked.

**Prevention:** Phase 10/11/12 plans explicitly call out: use `supabase db query --linked -f migrations/<filename>.sql` to apply migrations to remote.

**Phase to address:** All migration phases (document in CONTEXT.md).

---

## Cross-Cutting Pitfalls

---

### P-X13: Multi-Agent Wave-2 Git-Index Race

**Severity:** Critical (data loss risk in YOLO multi-wave runs)

**What goes wrong:** Plan 08-05/06/07 surfaced a wave-2 git-index race: parallel agents' `git add` ran between staging and commit, sweeping in untracked files from sibling plans (per FUTURE_DIRECTIONS.md §4 + STATE.md). v1.1 phases 10/11/12 are large, parallel-friendly — high probability of running multi-wave. Without prevention, commit attribution is mixed, untracked sibling files get swept up, recovery is manual.

**Warning signs:**
- Multi-agent commits show `git diff --cached` items the agent didn't touch.
- Commit messages reference Plan A but include files from Plan B.

**Prevention (pick one):**
1. **Serialize commits** — no two agents commit at the same time. Pre-flight pattern: each agent waits for a `commit-lock` file before staging + committing.
2. **Per-plan git worktrees** — each Plan runs in its own `git worktree` directory; commits are atomic per-worktree; merge to main when wave completes.
3. **`git diff --cached --name-only` assertion** — agent verifies staged files match its expected set before committing; aborts and retries on mismatch.

**Recommended:** Pattern #2 (worktrees). Most isolation; clean commit attribution; cheap to set up. Pattern #3 is a fallback if worktrees are infeasible.

**Phase to address:** Phase 10 (set up before any wave-based execution); applies to Phase 11 + 12 also.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use service-role for `accounts` insert in signup | Fast; no schema change | Public-route service-role surface (P-A6) | Never — use trigger pattern (P-A3) |
| Skip `/auth/callback` and use magic links | Simpler signup | Password reset broken; v1.0 already debt | Never — fix in Phase 10 Task 1 |
| Email gradient in HTML only, no VML fallback | Works in dev (Apple Mail) | Outlook desktop renders white (P-C2) | Only if Outlook desktop is < 5% of audience and you flag it explicitly |
| Capacity via plain BEFORE-INSERT count check | Simpler than slot_index | Race-loses double-booking (P-B1) | Never — choose lock pattern (advisory or unique-index) |
| Defer visual regression suite | Saves ~1 day | Phase 13 QA falls on Andrew personally | Only if Andrew accepts it as Phase 13 work |
| Hand-sync `RESERVED_SLUGS` across files | Saves ~30 min | Security gap as routes grow (P-X11) | Never — consolidate in Phase 10 Task 1 |
| Stay on Gmail SMTP for v1.1 | No migration work | 500/day cap → mass-signup outage (P-A12) | Only if Phase 10 caps signup rate AND adds quota alerts |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth + accounts table | Two sequential calls (auth.signUp then INSERT) | Postgres trigger on `auth.users` insert (atomic) |
| Supabase Auth callback | Use deprecated `auth-helpers` API | Use `@supabase/ssr` + `exchangeCodeForSession` |
| Supabase Auth redirect URLs | Forget Vercel preview URL pattern | Wildcard `https://calendar-app-*.vercel.app/auth/callback` |
| Email gradient + Outlook desktop | `linear-gradient` only | Plus VML fallback OR solid-color + gradient web-only |
| Tailwind v4 + dynamic colors | `bg-[#${hexFromDB}]` template string | Inline CSS variables on a wrapper element |
| Vercel deploy + Supabase migration | Apply migration after Vercel deploys | Apply migration BEFORE deploying code that depends on it; use forward-compatible migration sequence |
| Cloudflare Turnstile + signup | Reuse the `verifyTurnstile` lib correctly | Same pattern as `/api/bookings`; new sitekey if needed |
| Postgres trigger + Supabase | `auth.users` is in the `auth` schema, not `public` | Trigger function declared in public, references `auth.users` explicitly |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Capacity count via `SELECT count(*)` per insert | Slow on hot slots | Use slot_index pattern (no count needed) | At 5+ concurrent bookings on same slot |
| Inline-style re-computation per render | DevTools profile shows BrandedPage in slow paths | Pre-compute in Server Component, pass as string prop | At 10+ child components nested under BrandedPage |
| Email HTML > 100 KB | Gmail clips with "View entire message" | Minify HTML at build; keep VML lean | When per-account branding adds verbose inline styles |
| RLS policy with EXISTS subquery | Slow dashboard queries | Use `IN (select current_owner_account_ids())` pattern (already v1.0 standard) | At 1000+ event_types per account (not v1.1 scale) |
| Dashboard query without account_id filter | Cross-tenant scan | All queries narrow by account_id (RLS enforces but app-level too) | Already v1.0 baseline |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Signup endpoint with no Turnstile | Bot signups, slug squatting (P-A10) | Turnstile + per-IP rate limit |
| Email enumeration via signup error message | Confirmed-user list for credential stuffing | Generic success message (P-A1) |
| `auth.users` row without matching `accounts` row | Half-provisioned account; mystery 403s | Atomic provisioning via Postgres trigger (P-A3) |
| Service-role client in public signup endpoint | Tenant-creation surface from unauthenticated input | Trigger pattern moves provisioning out of the public route |
| Re-enabling email confirmation without confirming Andrew's row | Andrew locked out of production | Pre-flight SQL: `UPDATE auth.users SET email_confirmed_at = now() WHERE email = '...'` (P-A8) |
| New v1.1 table without `ENABLE ROW LEVEL SECURITY` | Multi-tenant leak (P-A5) | Migration template includes RLS-enable line |
| `linear-gradient` in email without VML | 30%+ of inboxes broken visual | Solid-color fallback (P-C2) |
| `RESERVED_SLUGS` drift between two files | Signup allows `/[account]/login`-style collision | Consolidate to single import (P-X11) |
| Reset-password rate limit per-IP | Inbox harassment (target email keeps getting reset emails) | Rate-limit per-email, not per-IP (P-A13) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 409 on signup says "Slug taken" without auto-suggest | User picks slug 4 times before success | Auto-suggest 3 alternatives (P-A2) |
| Wizard abandonment leaves user on empty dashboard | Confusion; churn | Resume-setup banner (P-A9) |
| Capacity decrease silently leaves slots over-booked | Owner confused why slots show "full" | Warn on save with explicit count (P-B4) |
| 409 conflated for race-loss vs capacity-full | User can't tell whether to wait or pick another slot | Distinct error codes (P-B7) |
| Owner picks low-contrast brand colors | Customers can't read booking page | Live contrast warning, soft block (P-C3) |
| Branding editor preview cached | Owner thinks color save failed | Cache-bust preview iframe (P-C12) |
| Mobile booking flow breaks after Cruip refactor | 60% of trade traffic lost | Three-viewport test gate (P-C10) |
| Iframe jumps on load with gradient | Awful first impression | Pre-sized logo + CSS gradient (no async) (P-C6) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Multi-user signup ships with email confirmation enabled.** Verify Andrew's user has `email_confirmed_at IS NOT NULL` BEFORE flipping the toggle (P-A8).
- [ ] **`/auth/callback` route exists and exchanges code for session.** Verify by running a test signup end-to-end in Vercel preview (P-A4).
- [ ] **Supabase dashboard "Redirect URLs" includes prod + preview wildcard.** Verify in dashboard before merging signup PR (P-A15).
- [ ] **`accounts` row provisioning is atomic.** Verify by simulating INSERT failure mid-signup; auth.users should also rollback (P-A3).
- [ ] **Capacity-aware booking is race-safe at N>1.** Load test with 10 concurrent submits against capacity=3; assert exactly 3 succeed (P-B1).
- [ ] **Migration applied via `supabase db query --linked -f`** (NOT `db push`) (P-X15).
- [ ] **Capacity migration is forward-compatible.** Old code keeps working between Migration A and Migration B (P-B2).
- [ ] **`/api/slots` cache-control is `no-cache`** for capacity-aware logic (P-B5).
- [ ] **409 responses distinguish race-loser from capacity-full from rate-limited.** Inline banner UX surfaces the difference (P-B7).
- [ ] **Email gradient has VML fallback OR is replaced with solid color in emails** (P-C2).
- [ ] **Branding editor preview cache-busts on color change** (P-C12).
- [ ] **`pickTextColor` extended to handle gradient endpoints** with WCAG AA warning (P-C3).
- [ ] **`RESERVED_SLUGS` consolidated to single source-of-truth file**; both old import sites updated; new signup imports from it (P-X11).
- [ ] **Auth endpoints rate-limited** (signup 5/hr, login 10/5min, reset-password 3/hr per email) (P-A13).
- [ ] **Cloudflare Turnstile on signup form**, same pattern as `/api/bookings` (P-A6 / P-A10).
- [ ] **RLS test matrix expanded to N=3 tenants**, runs in CI (P-A5).
- [ ] **No new v1.1 table missing `enable row level security`** (P-A5).
- [ ] **Tailwind v4 dynamic colors flow via inline CSS vars on `BrandedPage`,** never as template-string classes (P-C1).
- [ ] **Visual regression suite** at minimum 5 critical screenshots at 3 viewports (P-C7).
- [ ] **Mobile (320 / 375 / 768) tested live** before Phase 13 sign-off (P-C10).
- [ ] **Sidebar active-state highlighting** works on every existing route after refactor (P-C9).
- [ ] **Gmail SMTP daily quota alert wired** OR migrated to Resend/Postmark (P-A12).
- [ ] **Multi-agent wave commits use worktrees** (P-X13).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| P-A3 partial provisioning (auth.users without accounts) | LOW | Background job: query for orphaned `auth.users`; either delete or insert missing `accounts` row |
| P-A8 email-confirmation lockout for Andrew | LOW | SQL: `UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'ajwegner3@gmail.com'` |
| P-B1 capacity double-booking in production | HIGH | Manual reconciliation per affected slot; apologetic emails to bookers; deploy hotfix migration with stricter constraint |
| P-B2 mid-deploy double-booking | HIGH | Same as P-B1; plus retroactively pull migration logs to bound the affected window |
| P-A5 cross-tenant data leak | HIGH | Audit logs for the leaked range; notify affected accounts; migration to add the missing RLS clause; rotate any tokens that may have been exposed |
| P-A6 service-role abuse via signup | HIGH | Rotate `SUPABASE_SERVICE_ROLE_KEY`; audit `accounts` rows for anomalous patterns (slugs that look generated, no event types, no logins); delete bad accounts; migrate to trigger pattern |
| P-A12 Gmail SMTP quota exceeded | MEDIUM | Same-day: pause signup; switch to Resend (already researched in v1.0); next day: confirm Gmail account not suspended |
| P-C2 Outlook gradient broken | LOW | Hot-fix: swap gradient for solid color in email templates; deploy; verify mail-tester |
| P-C7 Phase 12 silently broke booking page | MEDIUM | Roll back Phase 12 PR; reapply with visual regression coverage |
| P-C10 mobile regression in production | MEDIUM | Hotfix CSS for affected viewports; ship via Vercel preview first |
| P-X13 git-index race swept stray files | LOW | `git revert` the offending commit; reapply changes from individual plans manually |

---

## Pitfall-to-Phase Mapping

| Pitfall | Severity | Prevention Phase | Verification |
|---------|----------|------------------|--------------|
| **P-A1** Email enumeration | Critical | Phase 10 | Test signup with known + unknown email; responses identical |
| **P-A2** Slug collision UX | Moderate | Phase 10 | Concurrent signup test with same slug; both users land on success page |
| **P-A3** Account provisioning failure | Critical | Phase 10 | Simulate INSERT failure; verify auth.users also rolled back |
| **P-A4** /auth/callback 404 | Critical | Phase 10 (Task 1) | Live test: signup → email → click link → land on /app |
| **P-A5** RLS holes at N>1 | Critical | Phase 10 + 13 | Expanded RLS matrix test (N=3 tenants) in CI |
| **P-A6** Service-role public surface | Critical | Phase 10 | Grep verify no service-role admin in public auth routes |
| **P-A7** Default TZ inference | Minor | Phase 10 | Test signup with Intl returning null; default applied |
| **P-A8** Email-confirmation toggle migration | Critical | Phase 10 (Task 1) | SQL pre-flight; Andrew can still log in post-toggle |
| **P-A9** Wizard abandonment | Moderate | Phase 10 | Test: abandon mid-wizard, log back in, see resume banner |
| **P-A10** Slug squatting | Moderate | Phase 10 | Turnstile renders; reserved slugs rejected |
| **P-A11** TZ edge cases | Minor | Phase 10 | Unit test for null/empty/UTC timezone inputs |
| **P-A12** Gmail SMTP quota | Critical | Phase 10 (decision) + 13 | Resend migration OR signup-rate cap OR alert wiring |
| **P-A13** Auth rate limits | Moderate | Phase 10 | Burst signup test → 429 after 5 |
| **P-A14** Multi-tab signup | Moderate | Phase 10 | Open two tabs, submit both; only one user created |
| **P-A15** Supabase redirect URLs | Moderate | Phase 10 | Live test from Vercel preview URL |
| **P-B1** Capacity race regression | Critical | Phase 11 | Load test: 10 concurrent submits, capacity=3, exactly 3 succeed |
| **P-B2** Migration backward-compat | Critical | Phase 11 | Vercel preview deploy: no double-booking mid-deploy |
| **P-B3** Capacity = 0 footgun | Moderate | Phase 11 | DB CHECK constraint + Zod min(1) |
| **P-B4** Capacity decrease UX | Moderate | Phase 11 | Owner-facing warning on capacity decrease save |
| **P-B5** Stale slot cache | Moderate | Phase 11 | Verify Cache-Control on /api/slots |
| **P-B6** Concurrent test harness | Moderate | Phase 11 | Vitest race test extended to N=10 |
| **P-B7** 409 reason-code | Moderate | Phase 11 | Distinct UI copy for SLOT_TAKEN vs CAPACITY_REACHED vs 429 |
| **P-C1** Tailwind dynamic class | Moderate | Phase 12 | Build output has no dynamic-class warnings |
| **P-C2** Email gradient | Critical | Phase 12 | Render in Outlook desktop; fallback works |
| **P-C3** Gradient contrast | Moderate | Phase 12 | Branding editor live-warns on low contrast |
| **P-C4** CSP impact | Moderate | Phase 12 | proxy.ts comment documents constraint |
| **P-C5** Prop drilling perf | Moderate | Phase 12 | React profile shows BrandedPage stable |
| **P-C6** Iframe height race | Moderate | Phase 12 | Embed test on slow-3G shows no jump |
| **P-C7** Visual regression | Critical | Phase 12 + 13 | Playwright suite green; manual screenshot diff |
| **P-C9** Sidebar IA | Moderate | Phase 12 | Active-link highlight works on every existing route |
| **P-C10** Mobile responsiveness | Moderate | Phase 12 + 13 | Live device test at 320 / 768 / 1024 |
| **P-C11** Email logo + gradient | Moderate | Phase 12 | Email HTML < 100 KB; images-disabled fallback works |
| **P-C12** Color picker cache | Moderate | Phase 12 | Live preview iframe updates on color change |
| **P-X11** RESERVED_SLUGS drift | Moderate | Phase 10 (Task 1) | Single import path; unit test asserts coverage |
| **P-X13** Git-index race | Critical | All phases | Worktree-per-plan or commit-lock pattern |
| **P-X14** tsc alias errors | Minor | Phase 10 (pre-flight) | `npx tsc --noEmit` clean |
| **P-X15** Migration drift workaround | Minor | All migration phases | Plan CONTEXT.md documents `db query -f` pattern |

---

## Sources & Confidence

| Claim | Confidence | Notes |
|---|---|---|
| Partial unique index `bookings_no_double_book` on `(event_type_id, start_at) WHERE status='confirmed'` | HIGH | Verified in `supabase/migrations/20260419120000_initial_schema.sql:96-99` |
| `accounts` table has no INSERT RLS policy in v1.0 | HIGH | Verified in `supabase/migrations/20260419120001_rls_policies.sql:30` (explicit comment) |
| `current_owner_account_ids()` is `STABLE SECURITY DEFINER` returning SETOF uuid | HIGH | Verified in `supabase/migrations/20260419120001_rls_policies.sql:10-18` |
| `/auth/callback` route does not exist | HIGH | Verified by `ls app/auth/` returning only `signout/` |
| `pickTextColor` handles solid backgrounds only | HIGH | Verified in `lib/branding/contrast.ts:47-55` |
| `proxy.ts` sets only `frame-ancestors`; no `style-src` directive | HIGH | Verified in `proxy.ts:14, 23` |
| `RESERVED_SLUGS` duplicated across two files | HIGH | Verified by grep + FUTURE_DIRECTIONS.md §2 + STATE.md |
| Gmail SMTP free-tier ~500/day | MEDIUM | Common-knowledge for Google Workspace docs; exact limit varies by account age and reputation; verify before launch |
| Outlook desktop renders email via Word HTML engine, no `linear-gradient` support | HIGH | Well-documented across email-dev community (litmus.com, emailonacid.com) |
| Postgres trigger pattern for `auth.users` insert is the recommended Supabase signup-provisioning approach | HIGH | Supabase docs (Auth + Triggers) confirm this is the canonical approach |
| Supabase redirect URLs support wildcard patterns | MEDIUM | Verify in Supabase dashboard before relying on it; otherwise enumerate Vercel preview URLs |
| Tailwind v4 statically purges dynamic classes | HIGH | Tailwind v4 docs explicit on this |
| Gmail email body 102 KB clip | HIGH | Documented in Gmail Help; long-standing |
| `CREATE INDEX CONCURRENTLY` + `DROP INDEX` in single migration is safe | HIGH | Postgres docs |
| `frame-ancestors *` does not match opaque origins (file://, about:blank) | HIGH | CSP spec; verified in v1.0 by Andrew (FUTURE_DIRECTIONS.md §1) |

**Gaps to address in phase-specific research:**
- Exact Gmail SMTP daily limit for owner's account (call Google or send test bursts).
- Whether Supabase Branching is enabled on Pro tier for this project (affects P-A8 testing strategy).
- Current `@supabase/ssr` version in package.json (PKCE default is version-dependent).
- Whether v1.0 race test (`tests/bookings.race.test.ts` or similar) is at the supabase-js layer or pg-driver layer (affects P-B6 harness reuse).
- Cruip "Simple Light" license + redistribution terms (out of scope here but flag in Phase 12 plan).

---

*Pitfalls research for: Calendar App v1.1 — multi-user signup + capacity + branding overhaul*
*Researched: 2026-04-27*
*Supersedes the v1.0 PITFALLS.md for v1.1 planning. v1.0 critical pitfalls C1–C10 referenced in the status table at top.*
