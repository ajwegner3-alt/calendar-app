---
phase: 35-per-account-gmail-oauth-send
plan: 00
type: execute
wave: 1
depends_on: []
files_modified:
  - .env.local
autonomous: false
user_setup:
  - service: google-oauth-vercel
    why: "Per-account Gmail send factory exchanges refresh tokens via Google's token endpoint and needs GOOGLE_CLIENT_ID/SECRET in process.env. Without this, every send refuses and the nsi credential gets falsely flagged needs_reconnect on first attempt."
    env_vars:
      - name: GOOGLE_CLIENT_ID
        source: "GCP Console → APIs & Services → Credentials → the OAuth 2.0 client used for this project (same one Supabase Google provider points at)"
      - name: GOOGLE_CLIENT_SECRET
        source: "Same OAuth 2.0 client in GCP Console (Show secret)"

must_haves:
  truths:
    - "Andrew has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set in Vercel Preview environment"
    - "Andrew has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set in Vercel Production environment"
    - "Andrew has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set in local .env.local for any future local invocation"
  artifacts:
    - path: ".env.local"
      provides: "Local placeholders for GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (real values for Andrew's local; documented in .env.example separately if needed)"
      contains: "GOOGLE_CLIENT_ID="
  key_links:
    - from: "Vercel Preview deployment"
      to: "https://oauth2.googleapis.com/token"
      via: "process.env.GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in fetchGoogleAccessToken (Plan 02)"
      pattern: "process.env.GOOGLE_CLIENT_ID"
---

<objective>
Confirm GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in Vercel (Preview + Production) and Andrew's local `.env.local` BEFORE the cutover deploy.

Purpose: This is the most likely first-send blocker (RESEARCH §Pitfall 1). The Google OAuth app credentials live in Supabase's auth provider config, not automatically in the Next.js runtime env. Without these vars in `process.env`, `fetchGoogleAccessToken` returns `{ error: "GOOGLE_CLIENT_ID not set" }` and every send is refused — the nsi credential will be incorrectly flagged `needs_reconnect` on the very first send attempt during Andrew's preview verification.

Output: A confirmation checkpoint that env vars are in place. No code change required (besides documenting in `.env.local`).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/35-per-account-gmail-oauth-send/35-CONTEXT.md
@.planning/phases/35-per-account-gmail-oauth-send/35-RESEARCH.md
@.env.local
@.env.example
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew adds GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET to Vercel and .env.local</name>
  <action>
    These two env vars exist in GCP Console (the Google OAuth 2.0 client created during PREREQ-01 for Phase 34) and were pasted into Supabase's Google provider config during PREREQ-02. They are NOT yet in the Next.js app's runtime env. The Phase 35 sender factory needs them to exchange refresh tokens.

    Numbered checklist Andrew must complete:

    1. Go to GCP Console → APIs & Services → Credentials → click the OAuth 2.0 Client ID used for this project (the same one that's pasted in Supabase Auth → Providers → Google).
    2. Copy the **Client ID** (looks like `xxxxx.apps.googleusercontent.com`).
    3. Click "Show secret" (or use an existing copy) and copy the **Client Secret**.
    4. Open Vercel → this project → Settings → Environment Variables.
    5. Add `GOOGLE_CLIENT_ID` = `<paste from step 2>`. Scope: check **Preview** AND **Production**. (Development is optional but recommended — Andrew's local also needs it.)
    6. Add `GOOGLE_CLIENT_SECRET` = `<paste from step 3>`. Same scopes (Preview + Production + Development).
    7. Open `.env.local` in this repo and add (replacing values):
       ```
       GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
       GOOGLE_CLIENT_SECRET=xxxxx
       ```
       (Note: `.env.local` is gitignored. Do NOT commit real values.)
    8. Reply "env set" in the chat to release this gate.

    Why this is a human-only step: Vercel CLI can set env vars, but the secret values come from a private GCP Console UI that Claude cannot access. Andrew must retrieve and paste them. (Per CLAUDE.md "Manual Handoff" rule: format manual steps as a numbered checklist for the user to follow.)
  </action>
  <resume-signal>Reply "env set" once GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in Vercel (Preview + Production) and .env.local.</resume-signal>
</task>

</tasks>

<verification>
- After Andrew confirms "env set":
  - On the next Vercel preview deploy, the build env will include both vars.
  - Plan 02's `fetchGoogleAccessToken` will be able to exchange refresh tokens.
- No code-level verification in this plan — verification proves out in Plan 05's preview test (a successful send confirms env vars are live).
</verification>

<success_criteria>
- Andrew has explicitly confirmed `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in Vercel Preview and Production environments.
- `.env.local` contains both vars for any future local development invocation.
</success_criteria>

<output>
After completion, create `.planning/phases/35-per-account-gmail-oauth-send/35-00-SUMMARY.md` recording:
- Confirmation timestamp
- Vercel scopes set (Preview / Production / Development)
- Note that real values are gitignored / not in summary
</output>
