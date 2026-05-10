# Architecture Research — v1.7

**Domain:** Multi-tenant booking SaaS (calendar-app, NSI Booking Tool)
**Researched:** 2026-05-06
**Confidence:** HIGH (all conclusions verified against actual source files)

---

## 1. Google OAuth Signup — Auth Flow Integration

### Where `signInWithOAuth` lives

The existing auth surface is:

```
app/(auth)/app/signup/       → email/password form + signUpAction (server action)
app/(auth)/app/login/        → loginAction (server action)
app/auth/confirm/route.ts    → GET handler; verifyOtp() for all email OTP types
```

`signInWithOAuth` is a **client-side call** — it triggers a browser redirect to Google's consent screen and cannot be placed in a server action. It must live in a new client component, e.g. `app/(auth)/app/signup/_components/google-oauth-button.tsx`, which calls `supabase.signInWithOAuth()` from a `"use client"` module using the browser-side `lib/supabase/client.ts` client.

The call shape for combined scopes:

```typescript
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${origin}/auth/confirm?next=/onboarding`,
    scopes: "email profile https://mail.google.com/",
    queryParams: { access_type: "offline", prompt: "consent" },
  },
});
```

`access_type: "offline"` forces Google to return a refresh token. `prompt: "consent"` forces the consent screen even for returning users — required to re-obtain the refresh token on re-auth.

### Does the SECURITY DEFINER trigger fire on OAuth signup?

**Yes, confirmed.** The trigger:

```sql
-- supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql, lines 57-93
create trigger provision_account_on_signup
  after insert on auth.users
  for each row execute function public.provision_account_for_new_user();
```

It fires on **every** `auth.users` INSERT, regardless of provider. Supabase Auth inserts a row into `auth.users` for both email/password signups and OAuth signups. The stub `accounts` row is created identically — `slug=null`, `name=null`, `onboarding_complete=false`, `onboarding_step=1`. No change needed here.

### Where is the Google refresh token captured?

Supabase Auth stores the OAuth access token and refresh token in `auth.users.identities[].identity_data` as part of the standard OAuth flow. The refresh token is **not** directly queryable from RLS-scoped client — it requires the service-role admin client or a Supabase Edge Function.

For per-account Gmail OAuth send, we need the refresh token at send time. The chosen pattern is a **dedicated credentials table**:

```sql
-- New migration needed: account_oauth_credentials
create table account_oauth_credentials (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  provider text not null check (provider = 'google'),
  refresh_token text not null,           -- encrypted at rest via Supabase Vault or app-level AES
  access_token text,                     -- cached; short-lived (1h)
  access_token_expires_at timestamptz,
  gmail_address text not null,           -- the authorized Gmail address (matches auth identity)
  scopes text not null,                  -- space-separated scopes granted
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider)          -- one Google credential per account
);
-- RLS: owner can read/update their own row; no insert from client (server action only)
alter table account_oauth_credentials enable row level security;
create policy "owner reads own credentials"
  on account_oauth_credentials for select
  to authenticated using (
    account_id in (select id from accounts where owner_user_id = auth.uid())
  );
```

The refresh token is populated in a **server-side OAuth callback handler**. The flow:

```
Google consent screen
  → Supabase redirects to /auth/confirm?token_hash=...&type=signup&next=/onboarding
  → /auth/confirm verifyOtp() creates the Supabase session
  → redirect to /onboarding
  → /onboarding server component: load auth.users.identities to extract refresh token
     (requires admin client — getClaims() + admin.auth.admin.getUserById())
  → INSERT into account_oauth_credentials
```

Alternatively, a dedicated `/auth/oauth-callback` route handler can be added to separate this concern from the general `/auth/confirm` handler. This is cleaner because `/auth/confirm` currently handles all OTP types and mixing token-capture logic in there creates a maintenance problem.

**Recommended:** Add `app/auth/oauth-callback/route.ts` as the OAuth-specific callback. Configure Supabase's OAuth `redirectTo` to point here (`/auth/oauth-callback?next=/onboarding`) instead of the generic `/auth/confirm`. This handler:
1. Exchanges the code for a session via `supabase.auth.exchangeCodeForSession(code)` (OAuth flow uses PKCE code exchange, not OTP)
2. Reads the provider token from the session metadata
3. Inserts into `account_oauth_credentials`
4. Redirects to `next`

Note: the existing `/auth/confirm` uses `verifyOtp()` which handles email OTP flows. OAuth uses `exchangeCodeForSession()` — they are different flows and should not share a handler.

### Onboarding wizard impact

The wizard lives at `/app/onboarding` (redirected from `/app` when `onboarding_complete = false` via shell layout logic). Currently there is no onboarding wizard directory visible in the file tree — the onboarding redirect is handled in `app/(shell)/layout.tsx` which redirects to `/app/unlinked` if no accounts row, and the shell's home page renders an onboarding banner via `OnboardingBanner` / `OnboardingChecklist`.

For OAuth signup, the account stub is created identically by the trigger. The onboarding flow detects `onboarding_complete = false` and routes accordingly. No change to the wizard gate is needed. However, the wizard should detect that the account already has a Gmail credential (via `account_oauth_credentials`) and skip any "connect Gmail" step it might otherwise show.

**Practical impact on wizard:** If a wizard "connect email" step is added in v1.7, OAuth signup users arrive with credentials already stored. The step should render as "Gmail connected" (green checkmark, skip button) rather than a "connect" CTA.

---

## 2. Magic-Link Login — Integration Points

### Route placement

Magic-link login should be added to the **existing `/app/login` route**, not a new route. The rationale: users already know `/app/login` is the login surface. Adding `/app/login/magic-link` as a separate route would fragment the UX. The login page can render a tab or toggle between "Password" and "Magic link" modes.

New components needed:
- `app/(auth)/app/login/magic-link-form.tsx` — client component with email field + submit
- `app/(auth)/app/login/magic-link-actions.ts` — server action calling `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '...' } })`

The `/auth/confirm` handler already supports `type=magiclink` (line 57 in route.ts: "future: magic-link"). No change needed there.

### `publicAuthPaths` in proxy.ts

Current list (verified from `lib/supabase/proxy.ts` lines 58-63):

```typescript
const publicAuthPaths = [
  "/app/login",
  "/app/signup",
  "/app/forgot-password",
  "/app/verify-email",
];
```

Magic-link uses the existing `/app/login` path — no new path to add. If a separate `/app/login/magic-link` page is added, add it here. No other proxy changes needed.

### Rate limiting

Magic-link sends a transactional email. Apply `checkAuthRateLimit` using the existing `rate_limit_events` table pattern. Add a `magicLink` key to `AUTH_RATE_LIMITS` in `lib/auth/rate-limits.ts`:

```typescript
magicLink: { max: 3, windowMs: 60 * 60 * 1000 }, // 3 / hour / (IP+email)
```

The `checkAuthRateLimit` wrapper at `lib/auth/rate-limits.ts:34` handles this automatically once the key is added. Magic-link emails also need to go through `checkAndConsumeQuota("signup-verify")` or a new `"magic-link"` EmailCategory — add the category to both the TS union and the DB CHECK constraint (same migration pattern as Phase 31).

---

## 3. Per-Account Gmail OAuth Send — Sender Layer Rewrite

### Current architecture (verified)

All 7 senders (`send-booking-confirmation.ts`, `send-owner-notification.ts`, `send-reminder-booker.ts`, `send-cancel-emails.ts` ×2 legs, `send-reschedule-emails.ts` ×2 legs) call:

```typescript
import { sendEmail } from "@/lib/email-sender";
// ...
await sendEmail({ to, subject, html, ... });
```

`sendEmail` in `lib/email-sender/index.ts` (lines 54-85) uses a module-level singleton `_defaultClient` initialized from `GMAIL_USER` + `GMAIL_APP_PASSWORD` env vars. **There is zero per-account dispatch.** The singleton is global.

### Do all 7 call sites already pass `accountId`?

**Yes, confirmed.** Every sender's `AccountRecord` interface already includes `id: string` (the account UUID), added in Phase 31 for `logQuotaRefusal`. The `account.id` field flows through to every `checkAndConsumeQuota` and `logQuotaRefusal` call. The call sites are ready for per-account dispatch without plumbing changes to their interfaces.

### Proposed `getSenderForAccount(accountId)` factory

The cleanest integration is a **sender factory** at `lib/email-sender/get-sender-for-account.ts`:

```
lib/email-sender/
  index.ts                    ← existing; exports createEmailClient + sendEmail singleton
  types.ts                    ← extend EmailProvider to include "gmail-oauth" | "resend"
  providers/
    gmail.ts                  ← existing SMTP (App Password) — deprecated in v1.7
    gmail-oauth.ts            ← NEW: nodemailer XOAUTH2 transport using refresh token
    resend.ts                 ← NEW: Resend HTTP API client
  get-sender-for-account.ts   ← NEW: factory; reads accounts + credentials, dispatches
  quota-guard.ts              ← existing; unchanged
  utils.ts                    ← existing; unchanged
```

Factory signature:

```typescript
// lib/email-sender/get-sender-for-account.ts
export async function getSenderForAccount(accountId: string): Promise<EmailClient> {
  const admin = createAdminClient();

  // 1. Load accounts.email_provider (new column)
  const { data: account } = await admin
    .from("accounts")
    .select("email_provider")
    .eq("id", accountId)
    .single();

  if (account?.email_provider === "resend") {
    // Resend path: use NSI shared Resend client
    return createResendClient({ apiKey: process.env.RESEND_API_KEY! });
  }

  // 2. Gmail OAuth path: load refresh token
  const { data: creds } = await admin
    .from("account_oauth_credentials")
    .select("refresh_token, gmail_address")
    .eq("account_id", accountId)
    .eq("provider", "google")
    .single();

  if (!creds) throw new Error(`[getSenderForAccount] No Gmail credential for account ${accountId}`);

  return createGmailOAuthClient({
    gmail_address: creds.gmail_address,
    refresh_token: creds.refresh_token,
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  });
}
```

Each sender module replaces `sendEmail(...)` with `(await getSenderForAccount(account.id)).send(...)`. The quota-guard calls remain unchanged — they are transport-agnostic.

### Gmail OAuth provider implementation

Nodemailer supports XOAUTH2 via the `googleapis` library or raw token exchange. Recommended approach: use Google's token endpoint directly to exchange the refresh token for a short-lived access token, then pass it to nodemailer's XOAUTH2 auth:

```typescript
// lib/email-sender/providers/gmail-oauth.ts
import nodemailer from "nodemailer";

export function createGmailOAuthClient(config: {
  gmail_address: string;
  refresh_token: string;
  client_id: string;
  client_secret: string;
}): EmailClient {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: config.gmail_address,
      clientId: config.client_id,
      clientSecret: config.client_secret,
      refreshToken: config.refresh_token,
    },
  });
  // ...
}
```

Nodemailer handles the access token refresh automatically with XOAUTH2 type — no manual token caching needed for v1.7.

### Quota guard integration

The existing `email_send_log` table has no `account_id` column — the `checkAndConsumeQuota` insert is:

```typescript
// lib/email-sender/quota-guard.ts line 84
await admin.from("email_send_log").insert({ category });
```

For per-account quota enforcement, the table needs an `account_id` column. The count query must be scoped by `account_id`. Migration pattern:

```sql
-- New migration: add account_id to email_send_log
ALTER TABLE email_send_log ADD COLUMN account_id uuid references accounts(id) on delete set null;
CREATE INDEX email_send_log_account_sent_at_idx ON email_send_log (account_id, sent_at DESC);
```

The `checkAndConsumeQuota` signature changes to accept an optional `account_id`:

```typescript
export async function checkAndConsumeQuota(
  category: EmailCategory,
  account_id?: string | null
): Promise<void>
```

When `account_id` is provided, the count query adds `.eq("account_id", account_id)`. This is backward compatible — existing callers without `account_id` (signup paths) continue to use the global count.

**Resend bypass:** When `account.email_provider === "resend"`, skip the 200/day cap check entirely (Resend's limits are governed by NSI's Resend plan, not the per-account Gmail limit). Still log to `email_send_log` for analytics — just call a lighter `logSendForAnalytics(category, account_id)` instead of `checkAndConsumeQuota`.

### Cron reminder path

`/api/cron/send-reminders/route.ts` (confirmed by reading lines 78-94) already:
1. Selects `account_id` on every booking scan row
2. Passes `account.id` as `id` field in the `account` arg to `sendReminderBooker`

The `sendReminderBooker` call at line 246-275 has full account context including `id`. The factory pattern slots in cleanly: replace the inner `sendEmail(...)` call in `send-reminder-booker.ts` with `(await getSenderForAccount(account.id)).send(...)`. No cron route changes needed.

---

## 4. Resend Backend for Upgraded Accounts

### `accounts.email_provider` column

Add a new column:

```sql
ALTER TABLE accounts ADD COLUMN email_provider text NOT NULL DEFAULT 'gmail'
  CHECK (email_provider IN ('gmail', 'resend'));
```

`DEFAULT 'gmail'` means all existing accounts (including NSI's) start on Gmail OAuth. Upgrading an account = flipping this column to `'resend'`. No ENUM type needed (text with CHECK is simpler and easier to extend).

### Resend `from` address

**Shared NSI verified domain, not per-account.** Resend requires domain verification (DNS records). Per-account domain setup is a support burden at v1.7 scale. Use a single verified domain (e.g. `noreply@mail.nsi.tools`) as the sender. The account's branding name fills the `from` display name:

```
From: "Andrew's Plumbing" <noreply@mail.nsi.tools>
```

This is acceptable at v1.7 because upgraded accounts are NSI clients — they trust NSI's sending infrastructure. A future v2 could offer per-account custom domains via Resend's domain API.

### Sender factory dispatch logic

The `getSenderForAccount` factory (defined above in Section 3) handles this fully:

```
account.email_provider
  "gmail"  → createGmailOAuthClient(refresh_token from account_oauth_credentials)
  "resend" → createResendClient(RESEND_API_KEY env var, from: "NSI verified domain")
```

The Resend provider needs `from` address override logic:

```typescript
// lib/email-sender/providers/resend.ts
export function createResendClient(config: { apiKey: string }): EmailClient {
  return {
    provider: "resend",
    async send(options: EmailOptions): Promise<EmailResult> {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: options.from ?? "NSI Booking <noreply@mail.nsi.tools>",
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
          attachments: options.attachments?.map(a => ({
            filename: a.filename,
            content: Buffer.isBuffer(a.content)
              ? a.content.toString("base64")
              : a.content,
          })),
        }),
      });
      // ...
    }
  };
}
```

### Quota guard with provider awareness

The `checkAndConsumeQuota` function needs provider context:

```typescript
export async function checkAndConsumeQuota(
  category: EmailCategory,
  account_id?: string | null,
  provider?: "gmail" | "resend"
): Promise<void> {
  if (provider === "resend") {
    // Skip cap enforcement; log for analytics only
    await logSendAnalytics(category, account_id);
    return;
  }
  // Existing 200/day logic, scoped to account_id
}
```

The sender factory passes the provider through, or each sender can look it up. Simplest: pass it as a parameter when calling the guard.

---

## 5. In-App "Request Upgrade" Button

### The bootstrap problem — verified

When an account is at the 200/day cap, every `checkAndConsumeQuota` call throws `QuotaExceededError`. The "Request upgrade" button must send a notification to Andrew, but the account's own Gmail OAuth send is blocked. This is the bootstrap problem.

**Solution confirmed by architecture:** The upgrade notification uses the **NSI shared Resend client directly**, bypassing `getSenderForAccount`. This is a system-level notification, not a tenant-transactional email. It goes through a dedicated server action that imports `createResendClient` directly with `RESEND_API_KEY`:

```typescript
// app/(shell)/app/settings/upgrade/actions.ts
"use server";
export async function requestUpgradeAction(): Promise<void> {
  const resend = createResendClient({ apiKey: process.env.RESEND_API_KEY! });
  await resend.send({
    to: "andrew@northstarintegrations.com",  // hardcoded NSI notification address
    from: "NSI Booking System <noreply@mail.nsi.tools>",
    subject: "Upgrade request from [account name]",
    html: "...",
  });
}
```

This send does NOT go through `checkAndConsumeQuota` because it is a system notification on NSI's infrastructure, not the tenant's quota.

### Page vs modal

**Recommend a dedicated page** at `app/(shell)/app/settings/upgrade/page.tsx` rather than a modal, for two reasons:
1. Modals are hard to deep-link to; a page is linkable from cap-hit alerts anywhere in the shell
2. The upgrade flow may need to show pricing tiers in v1.8 — a page scales better

The "Request upgrade" button appears in the quota-exceeded UI (already in `app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx` and inline in the cap-hit paths). Each of these links to `/app/settings/upgrade`.

---

## 6. BOOKER-06/07 — Booking Shell Animation Hooks

### State location (verified)

State is fully lifted into `booking-shell.tsx` (confirmed at lines 43-54):

```typescript
const [selectedDate, setSelectedDate] = useState<string | null>(null);
const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
const [slots, setSlots] = useState<Slot[]>([]);
const [loading, setLoading] = useState(true);
```

The 3-column grid renders at lines 180-259. The form column (Col 3) renders at lines 251-259:

```typescript
{/* Col 3: Form column — fixed 320px reserved at all times */}
<div>
  {selectedSlot ? (
    <BookingForm key={selectedSlot.start_at} ... />
  ) : (
    // currently: empty div (no placeholder)
  )}
</div>
```

### BOOKER-06: Slide-in animation

The animation should trigger when `selectedSlot` transitions from `null` to non-null. The hook point is the `<div>` wrapper of `<BookingForm>` in Col 3. Use a CSS class transition or `tw-animate-css`:

```tsx
// booking-shell.tsx Col 3 wrapper — add transition class
<div className={selectedSlot ? "animate-slide-in-right" : ""}>
  {selectedSlot ? <BookingForm ... /> : <SkeletonForm />}
</div>
```

`tw-animate-css` is already in `package.json` (`"tw-animate-css": "^1.4.0"`) — no new dependency needed.

### BOOKER-07: Skeleton loader

The skeleton appears when `!selectedSlot` (form column is empty). The current state in the code is a bare `<div>` when no slot is selected (the comment at line 253 says "V15-MP-05 LOCK: placeholder is a `<div>`, NOT a mounted `<BookingForm>`"). The skeleton replaces this bare div:

```tsx
{selectedSlot ? (
  <BookingForm key={selectedSlot.start_at} ... />
) : (
  <SkeletonFormColumn />  // NEW: render skeleton, not bare div
)}
```

`<SkeletonFormColumn>` is a new component at `app/[account]/[event-slug]/_components/skeleton-form-column.tsx`. It renders shimmer placeholders matching the BookingForm's height/layout so the 320px column always has visual content.

The lifecycle: skeleton is visible until the user picks a slot. On slot pick, `selectedSlot` becomes non-null, the skeleton unmounts, BookingForm mounts with the slide-in animation.

---

## 7. Dead-Code Audit Phase

### Recommended tool: knip

`knip` is the current standard for finding unused exports, files, and dependencies in TypeScript/Next.js projects. It understands Next.js App Router conventions (page.tsx, layout.tsx, route.ts are entry points automatically).

Installation and run:

```bash
npx knip --reporter json > .planning/phases/[N]-dead-code-audit/knip-output.json
npx knip --reporter markdown > .planning/phases/[N]-dead-code-audit/findings.md
```

`ts-prune` is an alternative but it does not understand Next.js route conventions and will flag route handlers as "unused". Use `knip` for this codebase.

### Workflow

1. Run `knip` → outputs `findings.md` committed to `.planning/phases/[N]-dead-code-audit/`
2. Andrew reviews line by line — mark each item as REMOVE / KEEP / INVESTIGATE
3. Each approved removal = atomic git commit: one file or export per commit
4. Re-run `knip` after removals to confirm clean
5. Phase is signed off when `knip` reports zero issues in the target categories

### Caveats for this codebase

- `app/(shell)/app/unlinked/page.tsx` may appear unused if `knip` doesn't trace the redirect from `app/(shell)/layout.tsx` — mark KEEP
- Any file under `lib/email-sender/` that knip flags because it's "only used in tests" — verify test coverage before removing
- Migration `.sql` files are not TypeScript — knip won't touch them

---

## 8. Phase Ordering — Proposed Sequence

### Dependencies graph

```
OAuth signup + credential capture
  ↓ (required for)
Gmail OAuth send provider
  ↓ (required for)
Per-account send replaces global singleton
  ↓ (required for)
Centralized SMTP retirement (GMAIL_USER + GMAIL_APP_PASSWORD env vars removed)

Magic-link login      → independent (can ship any time)
Resend backend        → depends on: accounts.email_provider column + getSenderForAccount factory
Upgrade flow          → depends on: Resend backend (sends notification via Resend)
BOOKER-06/07          → independent (pure UI, no backend dependencies)
Dead-code audit       → must be LAST (after all features land, audit is final)
```

### Proposed 7-phase sequence

**Phase A: OAuth Signup + Credential Capture**
- `app/auth/oauth-callback/route.ts` (new)
- Google OAuth button in signup page
- `account_oauth_credentials` migration
- `lib/supabase/proxy.ts` publicAuthPaths: add `/auth/oauth-callback` if needed
- Rationale: everything downstream depends on credentials being stored here

**Phase B: Gmail OAuth Send Provider**
- `lib/email-sender/providers/gmail-oauth.ts` (new)
- `lib/email-sender/get-sender-for-account.ts` factory (new)
- `email_send_log` `account_id` column migration
- Update `checkAndConsumeQuota` signature for per-account scoping
- Wire 7 senders to use factory instead of `sendEmail` singleton
- Cron path: no changes needed (account.id already threaded through)
- Rationale: must ship before centralized SMTP can be retired

**Phase C: accounts.email_provider + Resend Backend**
- `accounts.email_provider` column migration
- `lib/email-sender/providers/resend.ts` (new)
- Update `getSenderForAccount` factory to branch on provider
- `checkAndConsumeQuota` provider-awareness (skip cap for Resend)
- Rationale: depends on the factory from Phase B

**Phase D: Upgrade Flow + In-App Cap-Hit UI**
- `app/(shell)/app/settings/upgrade/page.tsx` + `actions.ts` (new)
- Upgrade request email via NSI Resend (bootstrap problem solved)
- Cap-hit UI wires "Request upgrade" button to `/app/settings/upgrade`
- Rationale: depends on Resend (Phase C) to send notification past the cap

**Phase E: Magic-Link Login**
- `app/(auth)/app/login/magic-link-form.tsx` + `magic-link-actions.ts`
- `AUTH_RATE_LIMITS.magicLink` in `lib/auth/rate-limits.ts`
- New EmailCategory `"magic-link"` in quota-guard + DB migration
- Rationale: fully independent; can be Phase B or Phase C instead if preferred

**Phase F: BOOKER-06/07 Polish**
- `booking-shell.tsx` Col 3 animation wrapper
- `app/[account]/[event-slug]/_components/skeleton-form-column.tsx` (new)
- Rationale: pure UI; zero backend dependencies; can be any phase

**Phase G: Dead-Code Audit**
- Run `knip`, commit `findings.md`
- Andrew approves items → atomic surgical removals
- Rationale: must be last; removing code before features land risks removing something still needed

---

## 9. Component Map — New vs Modified

### New files (proposed paths)

| File | Type | Purpose |
|------|------|---------|
| `app/auth/oauth-callback/route.ts` | Route handler | OAuth code exchange + refresh token capture |
| `app/(auth)/app/signup/_components/google-oauth-button.tsx` | Client component | Triggers `signInWithOAuth` |
| `app/(auth)/app/login/magic-link-form.tsx` | Client component | Magic-link email input + submit |
| `app/(auth)/app/login/magic-link-actions.ts` | Server action | `signInWithOtp` + rate limit |
| `app/(shell)/app/settings/upgrade/page.tsx` | Server component | "Request upgrade" page |
| `app/(shell)/app/settings/upgrade/actions.ts` | Server action | Sends upgrade request via Resend |
| `app/[account]/[event-slug]/_components/skeleton-form-column.tsx` | Client component | Skeleton placeholder for Col 3 |
| `lib/email-sender/providers/gmail-oauth.ts` | Server-only lib | Nodemailer XOAUTH2 transport |
| `lib/email-sender/providers/resend.ts` | Server-only lib | Resend HTTP API client |
| `lib/email-sender/get-sender-for-account.ts` | Server-only lib | Per-account sender factory |

### Modified files

| File | Change | Lines affected |
|------|--------|----------------|
| `lib/email-sender/index.ts` | Add `export { getSenderForAccount }` | New export |
| `lib/email-sender/types.ts` | Extend `EmailProvider` union with `"gmail-oauth" \| "resend"` | Line 46 |
| `lib/email-sender/quota-guard.ts` | Add `account_id` + `provider` params to `checkAndConsumeQuota`; add `"magic-link"` EmailCategory | Lines 20, 68 |
| `lib/auth/rate-limits.ts` | Add `magicLink` entry to `AUTH_RATE_LIMITS` | Line 17 |
| `lib/supabase/proxy.ts` | Add `/auth/oauth-callback` to `publicAuthPaths` if needed | Lines 58-63 |
| `app/(auth)/app/signup/page.tsx` | Add Google OAuth button component | Render |
| `app/(auth)/app/login/page.tsx` | Add magic-link tab/toggle | Render |
| `lib/email/send-booking-confirmation.ts` | Replace `sendEmail(...)` with factory | Line 175 |
| `lib/email/send-owner-notification.ts` | Replace `sendEmail(...)` with factory | Line 168 |
| `lib/email/send-reminder-booker.ts` | Replace `sendEmail(...)` with factory | Line 223 |
| `lib/email/send-cancel-emails.ts` | Replace `sendEmail(...)` (×2 legs) with factory | Lines 220, 333 |
| `lib/email/send-reschedule-emails.ts` | Replace `sendEmail(...)` (×2 legs) with factory | Lines 244, 349 |
| `app/[account]/[event-slug]/_components/booking-shell.tsx` | Col 3: add animation class + skeleton | Lines 251-259 |

### New migrations

| Migration | Purpose |
|-----------|---------|
| `_v17_account_oauth_credentials.sql` | New table for per-account OAuth tokens |
| `_v17_accounts_email_provider.sql` | `accounts.email_provider` text column |
| `_v17_email_send_log_account_id.sql` | `account_id` column + index on `email_send_log` |
| `_v17_email_send_log_magic_link.sql` | Add `"magic-link"` to `email_send_log` category CHECK |

---

## 10. Critical Integration Constraints

### SMTP singleton retirement

The global `getDefaultClient()` singleton in `lib/email-sender/index.ts` (lines 52-65) must not be removed until **every account** has a credential in `account_oauth_credentials`. In practice, NSI's own account must be migrated first (Andrew connects his Gmail via the OAuth flow). Only after all active accounts are migrated can `GMAIL_USER` + `GMAIL_APP_PASSWORD` be removed from env vars.

**Two-step retirement:** (1) ship the factory; factory falls back to singleton if no credential found. (2) After all accounts migrated, remove fallback + env vars. Matches the v1.5 CP-03 two-step deploy protocol pattern.

### `email_send_log` per-account scoping

The current `getDailySendCount()` in `quota-guard.ts` counts ALL rows regardless of account. After the `account_id` column is added, the count query MUST be scoped by `account_id` for per-account enforcement to work. Any account without `account_id` in the log (legacy rows) are treated as global. This is acceptable — they predate per-account tracking.

### Resend bootstrap is not recursive

The upgrade notification sent via Resend (Phase D) does not go through `checkAndConsumeQuota`. It uses `RESEND_API_KEY` directly. This is intentional — it is NSI infrastructure, not the tenant's quota.

### `/auth/oauth-callback` must be in `publicAuthPaths`

The Supabase OAuth redirect lands at `/auth/oauth-callback` with no active session yet. The proxy middleware at `lib/supabase/proxy.ts` gates `/app/*` paths. Since `/auth/oauth-callback` is NOT under `/app/`, it is already public by the existing `pathname.startsWith("/app")` check (line 67). No proxy change needed.

### Trigger fires on OAuth — onboarding path unchanged

The `provision_account_on_signup` trigger fires on every `auth.users` INSERT including OAuth. The stub row is created with `onboarding_complete=false`. The `/auth/oauth-callback` handler runs AFTER the trigger (the session is established in the callback). The onboarding wizard check in `app/(shell)/layout.tsx` will route the new OAuth user to onboarding as expected.

---

## Sources

All conclusions verified against actual source files (no training-data assumptions):

- `lib/email-sender/index.ts` — singleton pattern confirmed
- `lib/email-sender/providers/gmail.ts` — SMTP transport confirmed
- `lib/email-sender/quota-guard.ts` — per-account gap confirmed (no account_id in insert)
- `lib/email/send-*.ts` (all 5 files) — `account.id` field presence confirmed
- `app/api/cron/send-reminders/route.ts` — `account_id` threading confirmed
- `app/auth/confirm/route.ts` — `verifyOtp` pattern + magic-link comment confirmed
- `lib/supabase/proxy.ts` — `publicAuthPaths` exact list confirmed
- `lib/auth/rate-limits.ts` — `rate_limit_events` pattern confirmed
- `app/(auth)/app/signup/actions.ts` — `signUp` + quota guard pattern confirmed
- `supabase/migrations/20260428120002_...` — trigger SQL confirmed
- `supabase/migrations/20260428120003_...` — `email_send_log` schema confirmed
- `supabase/migrations/20260504130000_...` — Phase 31 category extension confirmed
- `app/(shell)/layout.tsx` — shell auth gate + unlinked redirect confirmed
- `app/[account]/[event-slug]/_components/booking-shell.tsx` — Col 3 structure confirmed
- `package.json` — `tw-animate-css` already present; `nodemailer` already present
