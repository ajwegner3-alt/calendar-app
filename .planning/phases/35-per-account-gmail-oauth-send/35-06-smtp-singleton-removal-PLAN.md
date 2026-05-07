---
phase: 35-per-account-gmail-oauth-send
plan: 06
type: execute
wave: 6
depends_on: ["35-05"]
files_modified:
  - lib/email-sender/index.ts
  - lib/email-sender/providers/gmail.ts
  - .env.example
  - .env.local
  - tests/email-sender.test.ts
autonomous: true

must_haves:
  truths:
    - "lib/email-sender/index.ts no longer exports sendEmail or contains _defaultClient/getDefaultClient"
    - "lib/email-sender/providers/gmail.ts (SMTP App Password provider) is deleted"
    - "GMAIL_USER / GMAIL_APP_PASSWORD / GMAIL_FROM_NAME are removed from .env.example and .env.local"
    - "Repo-wide grep for GMAIL_APP_PASSWORD returns zero matches in source code"
    - "next build succeeds; full test suite green"
    - "Welcome email continues to work — its singleton import was removed in this plan and replaced with a direct createGmailOAuthClient OR (simpler) it stays on a minimal singleton path until Phase 36 — see Task 1 for the chosen approach"
  artifacts:
    - path: "lib/email-sender/index.ts"
      provides: "Type re-exports + createEmailClient factory only — no singleton, no sendEmail"
      contains: "createEmailClient"
    - path: "lib/email-sender/providers/gmail.ts"
      provides: "DELETED"
  key_links:
    - from: "git history"
      to: "lib/email-sender/index.ts"
      via: "Diff shows removal of _defaultClient, getDefaultClient, sendEmail; remainder is types + createEmailClient factory shell"
      pattern: "n/a"
---

<objective>
Separate post-verification deploy that retires the centralized SMTP path. Per CONTEXT decision (LD-06 two-step deploy), this commit ships ONLY after Plan 05 has signed off both preview and production verification — same work session, no 24-48h soak.

Per RESEARCH §SMTP Removal Checklist (Step 3 Deploy):
- Delete `_defaultClient`, `getDefaultClient`, `sendEmail` from `lib/email-sender/index.ts`
- Delete `lib/email-sender/providers/gmail.ts` (SMTP App Password provider)
- Delete `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` from `.env.example` and `.env.local`
- Update tests
- Welcome email path: per CONTEXT, stays out of this phase. See Task 1 for the surgical decision on what to do with its singleton import.

Purpose: Eliminate the credential-in-env-var attack surface. After this commit there is no longer any code path in production that uses `GMAIL_APP_PASSWORD`. (EMAIL-33.)

Output: SMTP path completely gone from source. Builds and tests green.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/35-per-account-gmail-oauth-send/35-RESEARCH.md
@.planning/phases/35-per-account-gmail-oauth-send/35-05-SUMMARY.md
@lib/email-sender/index.ts
@lib/email-sender/providers/gmail.ts
@lib/onboarding/welcome-email.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Resolve welcome-email's singleton dependency before retiring index.ts singleton</name>
  <files>lib/onboarding/welcome-email.ts, lib/email-sender/index.ts</files>
  <action>
    Per CONTEXT and RESEARCH §Open Question 3: welcome email is OUT of Phase 35 scope (migrates to Resend in Phase 36). But Plan 06 is about to delete `sendEmail` from `lib/email-sender/index.ts` — so welcome-email's `sendEmail` import will break compilation.

    **Surgical resolution: keep welcome-email working with minimal change. Two acceptable approaches:**

    **Approach A (preferred):** Migrate welcome-email to use the new factory anyway, even though CONTEXT says "stays on singleton this phase." The original constraint exists because welcome-email's call sites don't pass `account.id`. Read `lib/onboarding/welcome-email.ts` and check the call sites:
      - If `account.id` IS available at the call site (likely — onboarding has just created the account), update welcome-email to take `accountId` and use `getSenderForAccount` like the 7 transactional senders. This is a cleaner end state and is consistent with what Phase 36 will do (it'll just swap providers, not threading).
      - If `account.id` is NOT available at the call site without significant restructuring, fall back to Approach B.

    **Approach B (fallback):** Preserve a tiny SMTP singleton just for welcome-email. Keep `getDefaultClient` and `sendEmail` in `lib/email-sender/index.ts` BUT mark them with a `@deprecated — only used by lib/onboarding/welcome-email.ts; delete in Phase 36 when welcome moves to Resend` comment. Keep `lib/email-sender/providers/gmail.ts`. Keep `GMAIL_USER` / `GMAIL_APP_PASSWORD` env vars. The "removal" is then partial — only the App Password code path becomes dead for the 7 transactional sends, but the env vars stay.

    **Decide based on what `lib/onboarding/welcome-email.ts` looks like.** Read it first; if it's a pure function called from onboarding completion and the onboarding code has the account row, go with Approach A and document the choice in the SUMMARY.

    If Approach A is chosen, the rest of this plan's tasks (delete index.ts singleton + gmail.ts provider + env vars) proceed unchanged.

    If Approach B is chosen, update Tasks 2 + 3 to be partial: delete only the App Password leak in `index.ts` for non-welcome paths (or just leave singleton intact and instead add a giant `@deprecated` warning), DON'T delete `providers/gmail.ts`, DON'T delete env vars. Re-state in the SUMMARY exactly what was and wasn't removed and why.

    **Document the choice clearly in the commit message.**
  </action>
  <verify>
    `cat lib/onboarding/welcome-email.ts` and confirm one of the two approaches is implemented:
    - Approach A: file imports `getSenderForAccount`, takes `accountId`, no `sendEmail` import.
    - Approach B: file still imports `sendEmail`, and `lib/email-sender/index.ts` still exports it with a `@deprecated` comment naming welcome-email as the only consumer.

    Either way: `npx tsc --noEmit` clean.
  </verify>
  <done>
    Welcome-email path is either migrated to the factory (A) or explicitly preserved as a tiny tagged-for-Phase-36 island (B). Plans 2 and 3 below adjust accordingly per the SUMMARY note.
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete SMTP singleton + App Password provider from email-sender</name>
  <files>lib/email-sender/index.ts, lib/email-sender/providers/gmail.ts, tests/email-sender.test.ts</files>
  <action>
    Per RESEARCH §SMTP Removal Checklist (and conditional on Approach A from Task 1):

    1. **`lib/email-sender/index.ts`:**
       - Remove `import { createGmailClient } from "./providers/gmail";`
       - Remove the `case "gmail":` branch in `createEmailClient` switch (the only provider was App Password). If no providers remain, simplify `createEmailClient` to `throw new Error("No providers vendored. Use lib/email-sender/account-sender.ts:getSenderForAccount instead.")` OR delete `createEmailClient` entirely if no other code calls it (grep first: `grep -rn "createEmailClient" app/ lib/`).
       - Remove `let _defaultClient`, `function getDefaultClient`, and `export async function sendEmail` entirely.
       - Keep all type re-exports (`EmailOptions`, `EmailResult`, `EmailAttachment`, `EmailClient`, `EmailClientConfig`, `EmailProvider`).
       - Keep `escapeHtml`, `stripHtml` re-exports from utils.
       - Update the file's top comment block: replace the `// v1 / v2` history with a Phase 35 note explaining this file now only provides type re-exports + utils; the active sender factory lives at `./account-sender.ts`.

    2. **`lib/email-sender/providers/gmail.ts`:** delete the file (`rm lib/email-sender/providers/gmail.ts`).

    3. **`tests/email-sender.test.ts`** (or whatever the existing test file is for the singleton): tests for `sendEmail` and `getDefaultClient` are now testing dead code. Either:
       - Delete the file if every test in it tested `sendEmail` only.
       - Or trim it to just the type-export tests if any exist.

    4. If Approach B was chosen in Task 1, do NOT delete the singleton — only delete `providers/gmail.ts` if the singleton's only branch was the App Password one. Adjust per-Task 1 decision.

    **Pre-flight grep (safety):**
    Before deleting, run: `grep -rn "GMAIL_APP_PASSWORD\|GMAIL_FROM_NAME\|getDefaultClient\|sendEmail\b" lib/ app/ tests/ | grep -v "lib/onboarding/welcome-email"`. If Approach A: must be zero matches (welcome already migrated). If Approach B: only welcome-email-related matches.
  </action>
  <verify>
    `ls lib/email-sender/providers/` — `gmail.ts` no longer present (Approach A) or still present (Approach B).
    `grep -n "sendEmail\|_defaultClient\|getDefaultClient" lib/email-sender/index.ts` — zero matches (A) or annotated with `@deprecated` (B).
    `npx tsc --noEmit` clean.
    `npx vitest run` — full suite green.
    `npm run build` (next build) — green.
  </verify>
  <done>
    Per the chosen approach, the singleton path is removed (A) or quarantined (B). Build + test green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Remove GMAIL_APP_PASSWORD env vars from .env.example and .env.local</name>
  <files>.env.example, .env.local</files>
  <action>
    Per RESEARCH §SMTP Removal Checklist:

    1. **`.env.example`:** remove the three lines:
       ```
       GMAIL_USER=...
       GMAIL_APP_PASSWORD=...
       GMAIL_FROM_NAME=...
       ```
       (Approximate line numbers: 41-43 per RESEARCH.)

       If Approach B from Task 1 was chosen, KEEP these lines but add a `# DEPRECATED — used only by welcome email; remove in Phase 36` comment above each.

    2. **`.env.local`:** same removal (or annotation under Approach B). Lines ~40-42 per RESEARCH. Note `.env.local` is gitignored — Andrew's local will be modified directly.

    3. **Final guard grep (after deletion):**
       ```
       grep -rn "GMAIL_APP_PASSWORD" lib/ app/ tests/ supabase/
       ```
       Must return zero matches under Approach A. (`.env.example` and `.env.local` are no longer searched here because they were just edited; if grep widens to those files, they should also be zero under A.)

    4. **Andrew action follow-up (manual handoff per CLAUDE.md):**
       After this commit deploys, Andrew should also delete `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` from Vercel (Preview + Production) Environment Variables. Surface this as a numbered checklist at the end of execution:
       ```
       Manual cleanup steps (Andrew):
       1. Vercel → this project → Settings → Environment Variables.
       2. Delete GMAIL_USER (Preview + Production).
       3. Delete GMAIL_APP_PASSWORD (Preview + Production).
       4. Delete GMAIL_FROM_NAME (Preview + Production).
       5. (Optional) Revoke the App Password in Google Account → Security → 2-Step Verification → App passwords.
       ```
       Do NOT block this plan's completion on Andrew's Vercel cleanup — surface the checklist and proceed. The code is what matters; the env vars in Vercel are inert once the code that reads them is gone.
  </action>
  <verify>
    `grep -n "GMAIL_APP_PASSWORD\|GMAIL_USER\|GMAIL_FROM_NAME" .env.example .env.local` — zero matches under Approach A (or annotated under Approach B).
    Repo-wide `grep -rn "GMAIL_APP_PASSWORD" .` (excluding .git) returns zero source-code matches.
    `next build` succeeds.
  </verify>
  <done>
    Env vars removed (A) or annotated (B). Andrew handed a manual cleanup checklist for Vercel. Build green.
  </done>
</task>

</tasks>

<verification>
- Singleton + App-Password provider gone (Approach A) or quarantined (Approach B).
- Env vars removed from .env.example and .env.local (A) or annotated (B).
- Repo-wide GMAIL_APP_PASSWORD grep is zero (A) or only welcome-email-tagged matches (B).
- next build green; full test suite green.
- Andrew given a numbered checklist for Vercel env var cleanup.
- This commit is a SEPARATE deploy from Plan 04's cutover commit per LD-06.
</verification>

<success_criteria>
- Under Approach A: zero references to `sendEmail`, `getDefaultClient`, `GMAIL_APP_PASSWORD` anywhere in `lib/`, `app/`, or `tests/`. `lib/email-sender/providers/gmail.ts` deleted.
- Under Approach B: only `lib/onboarding/welcome-email.ts` and the deprecated singleton path in `lib/email-sender/index.ts` reference them; everything else is migrated; the deprecated paths carry a `@deprecated — Phase 36 removes` comment.
- Either approach: `next build` and `npx vitest run` both green.
- Phase 35 is functionally complete after this plan; ROADMAP can mark all 6 success criteria PASS.
</success_criteria>

<output>
After completion, create `.planning/phases/35-per-account-gmail-oauth-send/35-06-SUMMARY.md` recording:
- Which approach (A or B) was chosen for welcome-email and why
- Exact list of deleted/modified files
- The grep-guard result (zero or named exceptions)
- The manual Vercel cleanup checklist surfaced to Andrew
- A note that Phase 35 is now complete; STATE.md and ROADMAP.md should be updated by the orchestrator workflow

Then surface the manual handoff cleanup checklist (numbered) to Andrew so he can purge the now-inert Vercel env vars at his convenience.
</output>
