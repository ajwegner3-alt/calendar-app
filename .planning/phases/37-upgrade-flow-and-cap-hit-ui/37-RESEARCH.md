# Phase 37: Upgrade Flow + In-App Cap-Hit UI - Research

**Researched:** 2026-05-08
**Domain:** Next.js App Router — server action, settings page, banner modification, schema migration, Resend direct send
**Confidence:** HIGH

## Summary

Phase 37 adds three discrete pieces to existing infrastructure: (1) a one-line link appended to an existing server component banner, (2) a new `/app/settings/upgrade` settings page that exactly matches existing settings page structure, and (3) a server action that bypasses the per-account quota guard by calling `createResendClient()` directly. All three integrate with code that already exists and was verified on disk.

The codebase has a very consistent settings page pattern (server component page that fetches account data → one or more client-component forms → `_lib/actions.ts` server action file). The upgrade page follows this exactly. The server action pattern uses `{ success: true } | { fieldErrors: ... } | { formError: string }` (profile-form style) or `{ ok: true } | { ok: false; error: string }` (reminders-actions style). For `requestUpgradeAction` the simpler `{ ok: true } | { ok: false; error: string }` shape is the right choice because there are no per-field validation errors — the only field is an optional textarea.

The LD-05 bypass claim is verified: `createResendClient()` from `lib/email-sender/providers/resend.ts` has no quota guard wiring. The 200/day cap lives entirely in `checkAndConsumeQuota()` in `quota-guard.ts`, which is only called from leaf sender helpers (`send-booking-emails.ts`, etc.). Calling `createResendClient()` directly and calling `.send()` on the returned client does exactly what the CONTEXT says — sends via Resend with no quota check, no logging to `email_send_log`.

**Primary recommendation:** Implement as a standard settings sub-page at `app/(shell)/app/settings/upgrade/` with `page.tsx` (server component) + `_components/upgrade-form.tsx` (client) + `_lib/actions.ts` (server action). The schema migration adds one nullable `timestamptz` column to `accounts`. The banner modification is a single JSX change (one link appended inside the existing `<div>`).

---

## Standard Stack

All libraries are already installed. No new dependencies.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `createResendClient` | (Phase 36, on disk) | Direct Resend HTTP send bypassing quota guard | LD-05 constraint — this is the only send path that works at cap |
| `createAdminClient` | (on disk) | Service-role DB write for `last_upgrade_request_at` | Writes to `accounts` from server actions use admin client (matches reminders pattern) |
| `createClient` (server) | (on disk) | Auth session + account read | Same pattern used by every existing settings page |
| `zod` | (on disk) | Optional message validation | Already used in all settings schema.ts files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` + `zodResolver` | (on disk) | Form state management | Used in profile-form.tsx; upgrade form is simpler but can use same pattern |
| `useTransition` | React built-in | Pending state during server action call | Used in all existing client forms |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `createAdminClient` for DB write | RLS client | RLS `owners update own account` policy allows update — either works, but admin client matches reminders pattern and is unambiguous |

**Installation:**
```bash
# No new packages needed — all dependencies already on disk
```

---

## Architecture Patterns

### Recommended Project Structure
```
app/(shell)/app/settings/upgrade/
├── page.tsx                     # Server component — auth guard, account fetch, 24h check
├── _components/
│   └── upgrade-form.tsx         # "use client" — textarea + submit, handles disabled state
└── _lib/
    └── actions.ts               # "use server" — requestUpgradeAction
```

### Pattern 1: Server Component Page (Existing Settings Pattern)

**What:** Page fetches session + account data server-side, derives computed state (e.g., 24h remaining), then renders a client form component with those values as props. Auth redirect if unauthenticated or account not found.

**When to use:** All settings sub-pages follow this. `/app/settings/upgrade` should be identical.

**Example (from `app/(shell)/app/settings/profile/page.tsx`, lines 9–20):**
```typescript
// Source: app/(shell)/app/settings/profile/page.tsx
export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, slug, owner_email")
    .is("deleted_at", null)
    .maybeSingle();

  if (!account) redirect("/app/unlinked");
  // ...
}
```

For the upgrade page, additionally select `last_upgrade_request_at` and derive whether the 24h window is active.

### Pattern 2: Settings Page Auth Pattern — getClaims vs getUser

**What:** The shell layout (`app/(shell)/layout.tsx`) already verifies the auth guard and redirects to `/app/login` before any page renders. Individual settings pages redundantly re-check using `supabase.auth.getClaims()` (gmail/page.tsx, profile/page.tsx pattern) rather than `getUser()` (reminders/page.tsx pattern). Both work; `getClaims()` is more consistent with the newer pages.

**Example:**
```typescript
// Source: app/(shell)/app/settings/gmail/page.tsx, lines 6-9
const { data: claimsData } = await supabase.auth.getClaims();
if (!claimsData?.claims) redirect("/app/login");
const userId = claimsData.claims.sub as string;
// email: claimsData.claims.email as string | undefined
```

Use `getClaims()` for the upgrade page — it gives both `sub` (uid) and `email` in one call.

### Pattern 3: Server Action Return Shape

**What:** Two shapes exist in the codebase. Profile actions use `ActionResult<F>` with `{ success: true } | { fieldErrors: ... } | { formError: string }`. Reminders action uses `{ ok: true } | { ok: false; error: string }`. The upgrade action has no per-field errors (optional textarea), so use the reminders shape.

**Example (from `app/(shell)/app/settings/reminders/_lib/actions.ts`, lines 33-36):**
```typescript
// Source: app/(shell)/app/settings/reminders/_lib/actions.ts
export type SaveReminderTogglesResult =
  | { ok: true }
  | { ok: false; error: string };
```

### Pattern 4: Core/Wrapper Split for Testability

**What:** The reminders action (and owner-note action) split inner logic into an exported `xxxCore(args, deps)` function that accepts injected clients. The Server Action wrapper constructs real clients and delegates. Tests call `xxxCore` directly with structural mocks.

**When to use:** Required for any server action that needs to call `cookies()` or `next/cache` APIs, because those throw in Vitest without a Next request scope.

**Example (from `app/(shell)/app/settings/reminders/_lib/actions.ts`, lines 64–106):**
```typescript
// Source: app/(shell)/app/settings/reminders/_lib/actions.ts
export async function saveReminderTogglesCore(
  args: SaveReminderTogglesArgs,
  deps: { rlsClient: RlsClientShape; adminClient: AdminClientShape },
): Promise<SaveReminderTogglesResult> { ... }

export async function saveReminderTogglesAction(args) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const result = await saveReminderTogglesCore(args, { rlsClient: supabase, adminClient: admin });
  if (result.ok) revalidatePath("/app/settings/reminders");
  return result;
}
```

Use this pattern for `requestUpgradeAction`. The core function takes `{ rlsClient, adminClient, resendClient }` so tests can inject a mock Resend client without hitting the real API.

### Pattern 5: createResendClient Direct Call (LD-05 Bypass)

**What:** Calling `createResendClient(config)` directly returns an `EmailClient`. Calling `.send(options)` sends via Resend HTTP API with no quota check, no `email_send_log` insert. This is the intentional bypass.

**Example (from `lib/email-sender/providers/resend.ts`, lines 37–42):**
```typescript
// Source: lib/email-sender/providers/resend.ts
export function createResendClient(config: ResendConfig): EmailClient {
  const from = `${config.fromName} <${config.fromAddress}>`;
  return {
    provider: "resend",
    async send(options: EmailOptions): Promise<EmailResult> {
      const apiKey = process.env.RESEND_API_KEY;
      // ... lazy env var read, fetch to https://api.resend.com/emails
    },
  };
}
```

For the upgrade request send:
- `fromName`: "NSI Booking" (or constant — not tied to any account)
- `fromAddress`: `"bookings@nsintegrations.com"` (same as all Resend sends — confirmed in `account-sender.ts` line 148)
- `replyToAddress`: owner's email (from session/claims)
- `options.to`: `"ajwegner3@gmail.com"` (hardcoded — not env-var-gated per CONTEXT)
- `options.replyTo`: owner's auth email (overrides `replyToAddress` for the per-send reply)

### Pattern 6: 24h Remaining Time Calculation

**What:** Server-side computation of time remaining in a 24h rate-limit window. Pure arithmetic, UTC-based, formatted as "18h 23m" string.

**Example:**
```typescript
// Computed in page.tsx (server component), passed as prop to form
function formatTimeRemaining(lastRequestAt: string): string {
  const elapsed = Date.now() - new Date(lastRequestAt).getTime();
  const remaining = Math.max(0, 24 * 60 * 60 * 1000 - elapsed);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function isWithin24h(lastRequestAt: string | null): boolean {
  if (!lastRequestAt) return false;
  return Date.now() - new Date(lastRequestAt).getTime() < 24 * 60 * 60 * 1000;
}
```

The CONTEXT decision is "server-rendered text — no live JS countdown." This means compute the string in the page server component, pass it as a prop to the form. The form re-fetches on page reload (no client-side timer).

### Pattern 7: DB Write Order — Update After Send

**CONTEXT decision:** Update `last_upgrade_request_at` AFTER the Resend send returns success. This means a send failure leaves the column null (or unchanged), allowing the user to retry immediately. This is the correct failure posture.

### Pattern 8: Banner Link Append

**What:** The banner is a pure server component (no "use client", no useState). Adding a Next.js `<Link>` or an `<a>` tag is safe. The link text "Request upgrade" appended after "The quota resets at UTC midnight." — same `<div>`.

**From `app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx` (full file, 38 lines):**
```tsx
// The current copy ends with:
// "...The quota resets at UTC midnight."
// Append after that sentence, inside the same <div>, e.g.:
{" "}
<Link href="/app/settings/upgrade" className="underline underline-offset-2 font-medium">
  Request upgrade
</Link>
```

`Link` requires `import Link from "next/link"`. The component has no `"use client"` directive — it is a server component.

### Anti-Patterns to Avoid
- **Using `getSenderForAccount(accountId)` for the upgrade send:** This goes through the Gmail/Resend router AND the quota guard. If the account is at the Gmail 200/day cap, it would return a refused sender. Must use `createResendClient()` directly.
- **Writing `last_upgrade_request_at` BEFORE the send:** CONTEXT decision is "AFTER." Write-before means a Resend failure leaves the user locked out for 24h with no email sent.
- **Module-level `RESEND_API_KEY` read:** The existing `createResendClient` implementation already reads the env var lazily inside `send()`. Don't read it at import time in the server action — Vitest env mutation between tests would break tests.
- **Using the RLS client for the `accounts` UPDATE:** The RLS client (`createClient()`) CAN write to `accounts.last_upgrade_request_at` via the `owners update own account` policy (confirmed — policy covers all columns). However, using `createAdminClient()` for writes is the established pattern (see reminders). Either works; admin is safer and matches precedent.
- **Redirect after submit:** CONTEXT decision is inline success state on the same page, not redirect. Do not call `redirect()` in the server action on success.
- **Countdown timer in client:** CONTEXT decision is server-rendered static text "Try again in 18h 23m." Don't add a live countdown with `setInterval` — the page just shows the static computed string at load time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sending email to Andrew | Custom fetch to Resend API | `createResendClient(config).send(opts)` | Already implemented, tested, handles all error cases |
| 24h rate-limit check | Custom date math in multiple places | Single `isWithin24h()` helper in the server action | Centralize; server action enforces it independently of UI |
| Auth guard | Custom auth check | `supabase.auth.getClaims()` + `redirect("/app/login")` | Standard pattern used in all 3 existing settings pages |
| Account lookup | Direct RPC or admin query | RLS-scoped `supabase.from("accounts").select(...).maybeSingle()` | RLS guarantees only the owner's own account returns |

**Key insight:** The Resend provider is a thin HTTP wrapper that already handles all error cases (missing API key, 4xx/5xx from Resend, network failure). The only new code needed is the business logic in `requestUpgradeAction`.

---

## Common Pitfalls

### Pitfall 1: Column Name Is `accounts.name`, Not `accounts.business_name`

**What goes wrong:** The CONTEXT document uses "business_name" as a description. The actual DB column is `name` (confirmed in initial schema migration line 17: `name text not null`). The profile actions file refers to the "DB column is `name` (not display_name)" correction at line 41.

**How to avoid:** In the `accounts` SELECT, use `"id, name, owner_email"` not `"id, business_name, owner_email"`. In the email body, reference `account.name` not `account.business_name`.

### Pitfall 2: RLS Blocks `last_upgrade_request_at` UPDATE via RLS Client

**What goes wrong:** The `owners update own account` RLS policy (`with check (owner_user_id = auth.uid())`) covers all columns, so an RLS-scoped client CAN update `last_upgrade_request_at`. However, the server action will typically construct both an RLS client (for auth check) and an admin client (for the write) per the reminders pattern. If only the admin client is used for both the read and write without an auth check, there is no authorization stage.

**How to avoid:** Follow the two-stage pattern from reminders: (1) use the RLS client to verify auth and ownership, (2) use the admin client to perform the write. Never skip stage 1.

**Warning signs:** Server action that only uses `createAdminClient()` with no auth check is a security hole.

### Pitfall 3: Race Condition on Double-Submit

**What goes wrong:** A user clicks submit twice rapidly. Both server action invocations check `last_upgrade_request_at` at the same millisecond (null in both cases), both pass the 24h check, both write to `last_upgrade_request_at`, and two emails are sent to Andrew.

**Why it happens:** No database-level uniqueness constraint on the timestamp column. Server actions are stateless.

**How to avoid:** Two mitigations:
1. Disable the submit button in the client component using `useTransition` during the pending state (already the standard pattern in all settings forms).
2. The server action performs an atomic check-and-set: read `last_upgrade_request_at`, check the 24h window, then update the column. Because both actions run sequentially against Postgres, and the update uses `.eq("id", accountId)`, a second identical request will see the already-written timestamp and return the "already requested" error. The window for a true race (both reads happening before either write) is milliseconds and consequence is low (two emails to Andrew, which is tolerable). No special locking needed.

### Pitfall 4: Resend Send Fails but DB Was Written

**What goes wrong:** If the write happens before the send, a Resend failure leaves the user locked out for 24h with no email sent to Andrew.

**CONTEXT decision already addresses this:** Write AFTER send returns success. Implement strictly:
```typescript
const result = await resendClient.send({ ... });
if (!result.success) return { ok: false, error: "..." };
// Only write if send succeeded:
await admin.from("accounts").update({ last_upgrade_request_at: new Date().toISOString() }).eq("id", accountId);
return { ok: true };
```

### Pitfall 5: Resend Silently Ignores `replyTo` if Named `replyTo` in Body

**What goes wrong:** Resend's API uses `reply_to` (snake_case), not `replyTo`. The `EmailOptions` interface has `replyTo` (camelCase), and `createResendClient` maps it to `reply_to` in the body (line 61 of `providers/resend.ts`). Passing `options.replyTo` to `createResendClient(...).send({ ..., replyTo: ownerEmail })` works correctly — the mapping is inside the provider.

**How to avoid:** Pass `replyTo` in `EmailOptions`. The provider handles the snake_case mapping. Do not manually construct a Resend fetch call — use `createResendClient().send()`.

### Pitfall 6: `accounts.owner_email` May Differ from Auth Email

**What goes wrong:** The profile page uses `claimsData.claims.email ?? account.owner_email` with a note that claims email is preferred. The accounts table has `owner_email` which may be stale if the user changed their auth email.

**How to avoid:** For the Reply-To in the upgrade email, prefer the auth claims email: `(claimsData.claims.email as string) ?? account.owner_email`. This ensures Andrew can reply to the current email address.

### Pitfall 7: Settings Layout Has No Shared `/app/settings` Layout File

**What goes wrong:** There is no `app/(shell)/app/settings/layout.tsx` (verified — `find` returned nothing). Each settings page handles its own auth guard independently. The upgrade page must include its own `getClaims()` + redirect pattern — it cannot rely on a shared settings layout to handle this.

**How to avoid:** Copy the auth guard pattern from `app/(shell)/app/settings/gmail/page.tsx` (the most recently added settings page).

---

## Code Examples

### The Full createResendClient API
```typescript
// Source: lib/email-sender/providers/resend.ts (lines 37-117)
// Signature:
export function createResendClient(config: ResendConfig): EmailClient
// where ResendConfig = { fromName: string, fromAddress: string, replyToAddress: string }
// Returns EmailClient = { provider: "resend", send(options: EmailOptions): Promise<EmailResult> }
// EmailResult = { success: boolean, messageId?: string, error?: string }
// Never throws. All error paths return { success: false, error: "resend_send_refused: <reason>" }
```

### The fromAddress Standard Value
```typescript
// Source: lib/email-sender/account-sender.ts, line 148
fromAddress: "bookings@nsintegrations.com"
// This is the NSI verified domain. Use the same value for upgrade request sends.
```

### 24h Check Logic for Server Action
```typescript
// Pattern (server action):
const { data: account } = await admin
  .from("accounts")
  .select("id, name, owner_email, last_upgrade_request_at")
  .eq("id", accountId)
  .maybeSingle();

const lastRequest = account?.last_upgrade_request_at;
if (lastRequest) {
  const elapsed = Date.now() - new Date(lastRequest).getTime();
  if (elapsed < 24 * 60 * 60 * 1000) {
    const remaining = 24 * 60 * 60 * 1000 - elapsed;
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return { ok: false, error: `Already requested. Try again in ${hours}h ${minutes}m.` };
  }
}
```

### Account Lookup in Upgrade Page Server Component
```typescript
// Source: adapted from app/(shell)/app/settings/gmail/page.tsx (lines 6-9)
const supabase = await createClient();
const { data: claimsData } = await supabase.auth.getClaims();
if (!claimsData?.claims) redirect("/app/login");
const userId = claimsData.claims.sub as string;
const ownerEmail = (claimsData.claims.email as string | undefined) ?? null;

const { data: account } = await supabase
  .from("accounts")
  .select("id, name, owner_email, last_upgrade_request_at")
  .is("deleted_at", null)
  .maybeSingle();

if (!account) redirect("/app/unlinked");
```

### Schema Migration Pattern
```sql
-- Source: adapted from supabase/migrations/20260428120001_phase10_onboarding_columns.sql
-- Naming: YYYYMMDD_HHMMSS_phaseNN_description.sql
-- e.g.: 20260508120000_phase37_last_upgrade_request_at.sql

ALTER TABLE accounts
  ADD COLUMN last_upgrade_request_at timestamptz;
-- Nullable (no DEFAULT). Existing rows get NULL, meaning no request ever made.
-- RLS: existing "owners update own account" policy covers this column.
-- No new policy needed.
```

### Test Pattern for requestUpgradeAction (Core/Wrapper Split)
```typescript
// Based on: tests/reminder-settings-actions.test.ts pattern
// Source: tests/account-sender.test.ts for Resend mock pattern

// Structure: export requestUpgradeCore(args, deps) + requestUpgradeAction wrapper
// deps = { rlsClient, adminClient, resendClient }

// In tests, mock the resendClient:
const mockSendResult = { success: true, messageId: "msg-123" };
const mockResendClient = {
  provider: "resend" as const,
  send: vi.fn(async () => mockSendResult),
};

// To test Resend failure:
mockResendClient.send.mockResolvedValueOnce({ success: false, error: "resend_send_refused: 422 domain_not_found" });
```

### Vitest Mock Registration for New Test File

The `requestUpgradeAction` test file should NOT use the `vitest.config.ts` aliases (those intercept the real module globally). Instead, test `requestUpgradeCore` directly with injected clients, bypassing the need for `createResendClient` or `createAdminClient` module mocks.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SMTP singleton / App Password | Per-account Gmail OAuth + Resend routing | Phase 35-36 | `lib/email-sender/index.ts` no longer exports `sendEmail()` singleton |
| Global 200/day quota | Per-account quota (email_provider aware) | Phase 36 | Resend accounts bypass cap; gmail accounts have independent limits |

**Deprecated/outdated:**
- `sendEmail()` singleton: removed in Phase 35/36 cutover. `lib/email-sender/index.ts` only exports types now.
- `getDefaultClient()`: gone. Do not reference in any new code.

---

## Open Questions

1. **`accounts.name` vs. display label "business name"**
   - What we know: The DB column is `name` (initial schema). The profile page has a comment "DB column is `name` (not display_name)." The CONTEXT document uses "business_name" as a description.
   - What's unclear: Nothing — the column is definitively `accounts.name`.
   - Recommendation: Select `name` from accounts, reference it as `account.name` in the email body.

2. **Plain text vs HTML email body for Andrew**
   - What we know: CONTEXT says "Plain-text or simple HTML at Claude's discretion." The `send-booking-confirmation.ts` and other leaf senders all use HTML. The `sendWelcomeEmail` in `onboarding/welcome-email.ts` uses simple inline HTML (no template engine).
   - Recommendation: Use simple inline HTML (matching `sendWelcomeEmail` style). It renders readably in Gmail. Keep it to 4-5 `<p>` tags. Include a plain text fallback — `createResendClient.send()` auto-derives `text` from `html` via `stripHtml()` if `text` is omitted.

3. **What happens to `last_upgrade_request_at` if the account is eventually upgraded to Resend?**
   - What we know: Andrew manually flips `accounts.email_provider` to `'resend'`. The column has no FK or constraint.
   - What's unclear: Nothing critical — the column just stays. A Resend account won't see the quota-exceeded banner (that only shows when `count > 0` from `countUnsentConfirmations()`), so the upgrade link is naturally inaccessible.
   - Recommendation: No cleanup needed; document in migration comments.

---

## Recommendations on Claude's Discretion Items

### Banner Link Text
Use **"Request upgrade"** — the roadmap success criteria use it verbatim (Success Criterion #1 and #2). Consistent with how Andrew tracks it.

### Page Copy Tone
Soft + transparent per CONTEXT. Recommended copy:

> **Gmail plan — 200 sends/day**
>
> Your account currently routes booking emails through Gmail, which has a 200-email/day limit. When you hit the cap, unsent confirmations appear in your dashboard.
>
> Upgrading routes your sends through NSI's shared email service, which handles higher volume. Submit a request and Andrew will be in touch within 1 business day.

Keep it factual, no apology, no pressure. One optional textarea: "Message (optional) — anything Andrew should know?"

### Email Body Format
Use simple inline HTML, matching `sendWelcomeEmail` style. Suggested:

```html
<p><strong>Upgrade request from {{ business_name }}</strong></p>
<p><strong>Owner email:</strong> {{ owner_email }}</p>
<p><strong>Message:</strong> {{ message || "(no message provided)" }}</p>
<p>Reply directly to this email to respond to the owner.</p>
```

Subject: `Upgrade request — {account.name}` (verbatim from CONTEXT).

### Locked-Out Form Layout
Render the textarea as `disabled` + opacity-50, submit button `disabled`. Below the button, show: `Already requested — Andrew will be in touch. You can submit another request in {hours}h {minutes}m.`

This is simpler than hiding the form entirely and gives the owner confidence the first request was received.

### Post-Submit Success State
Replace the form area (textarea + button) with a `<div>` containing: "Request received — Andrew will be in touch within 1 business day." Green-tinted or neutral-tinted box matching existing success patterns (`text-sm text-green-600` per profile-form.tsx). Submit button disabled. On page reload, the server-rendered locked-out state appears (24h window active).

---

## Sources

### Primary (HIGH confidence)
All findings from direct file reads of on-disk code. No external sources needed — this is entirely an integration of existing infrastructure.

- `app/(shell)/app/bookings/_components/unsent-confirmations-banner.tsx` — exact banner structure, props, gating
- `app/(shell)/app/settings/profile/page.tsx` — settings page server component pattern
- `app/(shell)/app/settings/profile/actions.ts` — ActionResult shape, getClaims auth, admin client usage
- `app/(shell)/app/settings/reminders/page.tsx` — alternative auth pattern (getUser)
- `app/(shell)/app/settings/reminders/_lib/actions.ts` — core/wrapper split pattern, ok/error shape
- `app/(shell)/app/settings/gmail/page.tsx` — most recent settings page (getClaims + userId pattern)
- `app/(shell)/layout.tsx` — shell layout auth guard (no settings-level layout exists)
- `lib/email-sender/providers/resend.ts` — createResendClient signature, fromAddress, lazy env var
- `lib/email-sender/account-sender.ts` — getSenderForAccount, quota guard wiring, fromAddress constant
- `lib/email-sender/quota-guard.ts` — where the 200/day cap lives; confirms direct createResendClient bypasses it
- `lib/email-sender/types.ts` — EmailOptions, EmailResult, EmailClient interfaces
- `lib/supabase/admin.ts` — createAdminClient signature
- `lib/supabase/server.ts` — createClient signature
- `supabase/migrations/20260419120000_initial_schema.sql` — accounts table schema (column is `name`)
- `supabase/migrations/20260507120000_phase36_resend_provider.sql` — email_provider migration pattern
- `supabase/migrations/20260419120001_rls_policies.sql` — accounts RLS policies
- `tests/account-sender.test.ts` — chainable Supabase mock pattern for admin client
- `tests/resend-provider.test.ts` — vi.stubGlobal("fetch") pattern for Resend unit tests
- `tests/reminder-settings-actions.test.ts` — structural mock pattern for core/wrapper split
- `tests/__mocks__/resend-provider.ts` — existing Resend mock for integration tests
- `tests/__mocks__/account-sender.ts` — account-sender mock (not needed for upgrade action tests)
- `vitest.config.ts` — alias setup, `@vitest-environment node` requirement for server code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified on disk, Phase 36 already shipped
- Architecture patterns: HIGH — read from 4 existing settings pages + 2 action files
- Pitfalls: HIGH — derived from actual code constraints (RLS policies, column names, quota guard wiring)
- DB migration: HIGH — naming convention and column type verified from 5+ existing migrations

**Research date:** 2026-05-08
**Valid until:** 2026-06-07 (stable — no fast-moving dependencies)
