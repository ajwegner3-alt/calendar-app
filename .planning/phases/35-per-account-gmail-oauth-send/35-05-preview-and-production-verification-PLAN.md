---
phase: 35-per-account-gmail-oauth-send
plan: 05
type: execute
wave: 5
depends_on: ["35-04"]
files_modified: []
autonomous: false

must_haves:
  truths:
    - "Andrew connects nsi Gmail via /app/settings/gmail Connect Gmail button on the preview deploy"
    - "A test booking against the nsi account on the preview deploy delivers a real Gmail OAuth booking confirmation to a real inbox"
    - "Andrew confirms the same flow works on production after merge"
    - "Production verification gate is passed BEFORE Plan 06 (SMTP removal) ships"
  artifacts: []
  key_links:
    - from: "Preview deploy via Vercel"
      to: "Andrew's real Gmail inbox"
      via: "Real OAuth send through getSenderForAccount(nsi.id)"
      pattern: "n/a (live verification)"
---

<objective>
Two-step deploy verification gate (RESEARCH §State of the Art + CONTEXT decision):
1. Push the cutover commit (Plan 04) to a preview branch; Andrew dogfoods Phase 34's Connect Gmail button on the nsi account; Andrew makes a test booking and confirms the email arrives via Gmail OAuth.
2. Merge to main; Andrew repeats the verification on production.

Per CLAUDE.md "Testing & Deployment": testing is done live; push to GitHub immediately to deploy. Per CLAUDE.md "Project Phases & Manual Checks": this is the manual QA verification step that must precede the SMTP removal commit.

Purpose: This is the canonical deploy-and-eyeball gate (6th-consecutive-milestone operating model). A real send through real Gmail OAuth against a real Google account is the only way to confirm the env vars are right (Plan 00), the token exchange works (Plan 02), the factory composes (Plan 03), and the cutover wired correctly (Plan 04). The SMTP retire commit (Plan 06) is GATED behind this verification — under no circumstances delete `GMAIL_APP_PASSWORD` until both checkpoints below are signed off.

Output: Two human-verified gates, both signed off, in the same work session. No code change in this plan.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/35-per-account-gmail-oauth-send/35-CONTEXT.md
@.planning/phases/35-per-account-gmail-oauth-send/35-RESEARCH.md
@.planning/phases/35-per-account-gmail-oauth-send/35-04-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Push cutover commit to preview branch</name>
  <files></files>
  <action>
    Plans 01-04 should already have committed their work to a feature branch (or to main if Andrew's git workflow puts cutover commits on main and previews via Vercel branch deploys — confirm with `git status` first).

    Check `git status` and `git log --oneline -10`. If the cutover work is on a feature branch, push it: `git push -u origin <branch-name>`. If on main, push: `git push origin main`.

    Either way, Vercel should auto-trigger a preview deploy. Get the preview URL by running `vercel ls --prod=false` (if available) or by checking the GitHub Actions / Vercel dashboard.

    Print the preview URL clearly so Andrew can open it for the next checkpoint.
  </action>
  <verify>
    Vercel dashboard or `vercel ls` shows a successful preview deploy on the cutover commit. Build status: green. Preview URL is reachable (curl the root URL and expect HTTP 200).
  </verify>
  <done>
    Preview deploy is live and the URL has been clearly surfaced for Andrew.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew dogfoods nsi Gmail connect + test booking on preview</name>
  <what-built>
    - Phase 35 cutover commit live on preview deploy (per Task 1).
    - All 7 transactional email paths route through `getSenderForAccount(accountId)`.
    - Per-account 200/day quota (`email_send_log.account_id` populated on every new send).
    - The Phase 34 Settings Gmail panel + onboarding connect-gmail step are unchanged but now feed into the new send factory.
  </what-built>
  <how-to-verify>
    Numbered checklist for Andrew on the preview URL:

    1. **Connect nsi Gmail (dogfoods Phase 34 UI):**
       - Open `<preview-url>/app/login` and log in as the nsi owner account (Andrew).
       - Navigate to `<preview-url>/app/settings/gmail`.
       - Click "Connect Gmail". Walk through the Google consent screen using `ajwegner3@gmail.com` (the nsi owner_email).
       - After redirect back, the panel must show "Connected" status with the Gmail address.
       - **Sanity check (optional, in Supabase Studio):** confirm `account_oauth_credentials` has a row where `user_id` matches `auth.users` for the nsi user, `provider = 'google'`, `status = 'connected'`. Confirm `accounts` row for nsi has `owner_user_id` matching that same user_id (per RESEARCH §Pitfall 4).

    2. **Make a real test booking:**
       - Open the nsi public booker page (e.g., `<preview-url>/{nsi-slug}/{event-type-slug}`).
       - Pick any available time slot.
       - Fill in the booking form using a different real email (a personal/test inbox you control). This is the booker email.
       - Submit the booking.

    3. **Verify both confirmation emails arrive via Gmail OAuth:**
       - **Booker email:** the test inbox should receive the booking confirmation. Open the email and check the "Show original" / message headers. The `From:` header should be `ajwegner3@gmail.com` (the nsi owner email). Look for `X-Google-Smtp-Source` or similar in the headers — that confirms the send went through Gmail SMTP (OAuth or app-password are both Gmail SMTP, but the next check distinguishes).
       - **Owner email:** the nsi owner inbox (`ajwegner3@gmail.com`) should receive the owner notification.
       - **Distinguish OAuth vs SMTP:** in Vercel function logs for the preview deploy, search for `[account-sender]` or `[EMAIL_OAUTH_REVOKED]` log lines. If the send went OAuth, you should see no errors and a 200 response on `/api/bookings`. If it fell back to or failed via the singleton, you'd see `getDefaultClient` errors. Conversely the SMTP path doesn't log `[account-sender]` at all.

    4. **(Bonus, optional) Per-account quota smoke:** in Supabase Studio, `select count(*), account_id from email_send_log where sent_at >= current_date group by account_id;` — confirm the nsi account_id has 2 rows (one confirmation, one owner-notification). The legacy global rows from before Phase 35 should have `account_id = null`.

    5. **Reply approval:** type **"preview verified"** if the booking emails arrived through OAuth (or describe what's broken if not — refused sends, missing env vars, decrypt failure, etc. — and DO NOT proceed to Task 3).

    Per CONTEXT decision: a booking confirmation through nsi via OAuth is the must-have. Cancel/reschedule/reminder paths use the same factory and same code path — confirming the booking-confirmation send is sufficient evidence the architecture works. Andrew may exercise a cancel and reschedule too if he wants extra coverage.

    **If verification fails:** Stop here. Diagnose, fix in a new gap-closure plan, re-verify. Do NOT proceed to Task 3 (production merge) or Plan 06 (SMTP removal).
  </how-to-verify>
  <resume-signal>Type "preview verified" once a real booking against nsi delivered email via Gmail OAuth on the preview deploy. Or describe what's broken.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Merge cutover to main and trigger production deploy</name>
  <files></files>
  <action>
    Only execute this task if Task 2 returned "preview verified".

    If Plan 04 committed to a feature branch:
    - Open a PR (`gh pr create --title "feat(35): per-account Gmail OAuth send cutover" --body ...`) or have Andrew merge the branch directly.
    - Once merged to main, Vercel auto-deploys to production.
    - Wait for the production deploy to finish (`vercel ls --prod` or check the dashboard).
    - Surface the production URL clearly for Andrew's next checkpoint.

    If Plan 04 already committed to main, this task is a no-op for the merge step — just confirm the production deploy succeeded and surface the production URL.
  </action>
  <verify>
    Vercel production deploy is green on the cutover commit. Production URL responds 200.
  </verify>
  <done>
    Production deploy live; URL surfaced.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Andrew verifies production booking still works via Gmail OAuth</name>
  <what-built>
    Same cutover commit, now live on production. Same nsi Gmail OAuth credential (the credential row is in the shared Supabase DB — the production deploy reads the same row Andrew connected on preview).
  </what-built>
  <how-to-verify>
    Quick production smoke for Andrew:

    1. Open the production nsi booker URL.
    2. Make a test booking using a real test inbox.
    3. Confirm the booking confirmation arrives — same as preview.
    4. (Optional) Check Vercel production function logs for `[account-sender]` log lines (should be absent unless something refused).

    **Reply:** type **"production verified"** to release the gate to Plan 06 (SMTP removal). Or describe any issue and DO NOT proceed.

    Important: per CONTEXT, this is a same-session two-step deploy. No 24-48h soak. The moment "production verified" is signed off, Plan 06 ships immediately.
  </how-to-verify>
  <resume-signal>Type "production verified" once a real production booking delivered email via Gmail OAuth. Plan 06 will then remove the SMTP path.</resume-signal>
</task>

</tasks>

<verification>
- Preview deploy: real booking → real OAuth email → Andrew signed off.
- Production deploy: real booking → real OAuth email → Andrew signed off.
- Both gates blocking; Plan 06 cannot proceed without both.
</verification>

<success_criteria>
- Two `checkpoint:human-verify` tasks signed off ("preview verified" and "production verified").
- Production proven to send via Gmail OAuth before any SMTP removal.
- Plan 06 (SMTP removal) is now safe to ship.
</success_criteria>

<output>
After completion, create `.planning/phases/35-per-account-gmail-oauth-send/35-05-SUMMARY.md` recording: preview URL, production URL, the exact resume-signal text Andrew provided, the test booking IDs (if Andrew shares them), any header / log evidence captured, and the timestamp gap between preview verification and production verification.
</output>
