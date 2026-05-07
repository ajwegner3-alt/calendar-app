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
    - "Per-account quota isolation is proven live: a second test account seeded to 200/day (cap-hit) does NOT block sends from the nsi account"
    - "The /app/settings/gmail Reconnect state is proven live: flipping account_oauth_credentials.status to 'needs_reconnect' surfaces a Reconnect button in the Settings panel (AUTH-30 / EMAIL-31)"
    - "Andrew confirms the same flow works on production after merge"
    - "Production verification gate is passed BEFORE Plan 06 (SMTP removal) ships"
  artifacts: []
  key_links:
    - from: "Preview deploy via Vercel"
      to: "Andrew's real Gmail inbox"
      via: "Real OAuth send through getSenderForAccount(nsi.id)"
      pattern: "n/a (live verification)"
    - from: "account_oauth_credentials.status = 'needs_reconnect'"
      to: "/app/settings/gmail Reconnect button"
      via: "Phase 34 settings panel re-renders state from credential row"
      pattern: "n/a (live verification)"
---

<objective>
Two-step deploy verification gate (RESEARCH §State of the Art + CONTEXT decision):
1. Push the cutover commit (Plan 04) to a preview branch; Andrew dogfoods Phase 34's Connect Gmail button on the nsi account; Andrew makes a test booking and confirms the email arrives via Gmail OAuth; Andrew also proves per-account quota isolation and the Settings reconnect banner live.
2. Merge to main; Andrew repeats the booking smoke on production.

Per CLAUDE.md "Testing & Deployment": testing is done live; push to GitHub immediately to deploy. Per CLAUDE.md "Project Phases & Manual Checks": this is the manual QA verification step that must precede the SMTP removal commit.

Purpose: This is the canonical deploy-and-eyeball gate (6th-consecutive-milestone operating model). A real send through real Gmail OAuth against a real Google account is the only way to confirm the env vars are right (Plan 00), the token exchange works (Plan 02), the factory composes (Plan 03), and the cutover wired correctly (Plan 04). Per Phase Success Criterion 2, the per-account quota isolation must also be proven on the live preview deploy — unit tests in Plan 01 cover the logic, but this checkpoint provides the human-observable evidence. Per AUTH-30 / EMAIL-31, the Settings reconnect surface must also be proven live (a quick smoke, not a hard gate). The SMTP retire commit (Plan 06) is GATED behind this verification — under no circumstances delete `GMAIL_APP_PASSWORD` until both checkpoints below are signed off.

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
  <name>Task 2: Andrew dogfoods nsi Gmail connect + test booking + per-account quota isolation + reconnect smoke on preview</name>
  <what-built>
    - Phase 35 cutover commit live on preview deploy (per Task 1).
    - All 7 transactional email paths route through `getSenderForAccount(accountId)`.
    - Per-account 200/day quota (`email_send_log.account_id` populated on every new send).
    - The Phase 34 Settings Gmail panel + onboarding connect-gmail step are unchanged but now feed into the new send factory.
  </what-built>
  <how-to-verify>
    Numbered checklist for Andrew on the preview URL. Steps 1-3 are the OAuth-send gate. Step 4 is the per-account quota isolation gate (REQUIRED, not optional — this is how Phase Success Criterion 2 is proven live). Step 5 is the AUTH-30 reconnect smoke (REQUIRED but quick — not iteration-ending if it fails, just file a follow-up).

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

    4. **Per-account quota isolation (REQUIRED — proves Phase Success Criterion 2):**
       This step proves a cap-hit on Account B does NOT block sends from Account A. We will seed a second account's `email_send_log` to 200 rows for today, then send from nsi and confirm it succeeds.

       a. **Pick (or create) a second test account** in Supabase Studio. Any non-nsi `accounts` row works — if none exists, create one quickly via `/app/signup` on the preview deploy using a throwaway Google account or via direct SQL insert (`insert into accounts (slug, business_name, owner_email) values ('quota-test-b', 'Quota Test B', '<throwaway>@example.com');`). Capture its `id` UUID.

       b. **Seed Account B to the cap.** In Supabase Studio SQL editor, run:
          ```sql
          insert into email_send_log (category, account_id, sent_at)
          select 'booking_confirmation', '<account-b-uuid>', now()
          from generate_series(1, 200);
          ```
          Verify with: `select count(*) from email_send_log where account_id = '<account-b-uuid>' and sent_at >= current_date;` — must return 200.

       c. **Confirm nsi quota is unaffected.** Run: `select count(*) from email_send_log where account_id = '<nsi-account-uuid>' and sent_at >= current_date;` — should be the small handful (e.g., 2) from Step 2's booking, NOT 200+.

       d. **Send from nsi while Account B is at cap.** Make a SECOND test booking against nsi (same flow as Step 2, different time slot, different test inbox to avoid Gmail dedup). The booking confirmation email MUST arrive — proving Account B's cap-hit did not poison nsi's quota state.

       e. **Confirm the new nsi sends were logged under nsi's account_id, not Account B's.** Re-run: `select count(*), account_id from email_send_log where sent_at >= current_date group by account_id;` — nsi's count should have grown by 2 (booker + owner), Account B's should still be exactly 200.

       **If nsi's send was refused with a quota error:** isolation is broken (likely a callsite passed the wrong account_id or `getDailySendCount` is still global). STOP and file a gap-closure plan. Do NOT proceed to Step 5 or Task 3.

    5. **Reconnect banner smoke (REQUIRED, quick):**
       This proves the AUTH-30 / EMAIL-31 surface still works post-cutover.

       a. In Supabase Studio, flip the nsi credential row's status:
          ```sql
          update account_oauth_credentials
          set status = 'needs_reconnect'
          where user_id = '<nsi-owner-user-id>' and provider = 'google';
          ```

       b. Refresh `<preview-url>/app/settings/gmail`. The panel must show a Reconnect button (or equivalent "needs reconnect" UI per Phase 34's settings panel design).

       c. Revert the status:
          ```sql
          update account_oauth_credentials
          set status = 'connected'
          where user_id = '<nsi-owner-user-id>' and provider = 'google';
          ```

       d. Refresh `/app/settings/gmail` once more — should be back to "Connected".

       **If the Reconnect button does NOT appear:** the panel is not re-reading credential status. This is a real defect but does not block the SMTP cutover (the OAuth send path still works). File a follow-up gap-closure plan AFTER signing off this checkpoint, but do not gate Task 3 on this single failure. Note it in the resume signal so it gets tracked.

    6. **Reply approval:** type **"preview verified"** if Steps 1-4 all passed (Step 5 may be flagged as "preview verified, reconnect surface broken" if only Step 5 fails — that's still allowed to proceed since it's a separate Phase 34 surface, but must be tracked). Otherwise describe what's broken and DO NOT proceed to Task 3.

    Per CONTEXT decision: a booking confirmation through nsi via OAuth + per-account isolation are the must-haves. Cancel/reschedule/reminder paths use the same factory and same code path — confirming the booking-confirmation send is sufficient evidence the architecture works. Andrew may exercise a cancel and reschedule too if he wants extra coverage.

    **If Steps 1-4 verification fails:** Stop here. Diagnose, fix in a new gap-closure plan, re-verify. Do NOT proceed to Task 3 (production merge) or Plan 06 (SMTP removal).
  </how-to-verify>
  <resume-signal>Type "preview verified" once a real booking against nsi delivered email via Gmail OAuth on the preview deploy AND per-account quota isolation was proven (Steps 1-4 all green). Append ", reconnect surface broken" if Step 5 failed — that flag does not block Task 3 but will trigger a Phase 34 follow-up. Or describe what's broken in Steps 1-4.</resume-signal>
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

    Note: per-account quota isolation was already proven on preview in Task 2 Step 4 (same DB, same code path) — no need to re-seed 200 rows on production. The Step 5 reconnect smoke is also preview-proven.

    **Reply:** type **"production verified"** to release the gate to Plan 06 (SMTP removal). Or describe any issue and DO NOT proceed.

    Important: per CONTEXT, this is a same-session two-step deploy. No 24-48h soak. The moment "production verified" is signed off, Plan 06 ships immediately.
  </how-to-verify>
  <resume-signal>Type "production verified" once a real production booking delivered email via Gmail OAuth. Plan 06 will then remove the SMTP path.</resume-signal>
</task>

</tasks>

<verification>
- Preview deploy: real booking → real OAuth email → Andrew signed off (Step 1-3).
- Preview deploy: per-account quota isolation proven (Step 4) — Account B at 200/day did not block nsi sends.
- Preview deploy: Settings reconnect surface smoke (Step 5) — Reconnect button appears when status='needs_reconnect'. Failure here is tracked but non-blocking for Task 3.
- Production deploy: real booking → real OAuth email → Andrew signed off.
- Both gates blocking; Plan 06 cannot proceed without both.
</verification>

<success_criteria>
- Two `checkpoint:human-verify` tasks signed off ("preview verified" and "production verified").
- Per-account quota isolation proven live on preview (seeded 200-row Account B did not block nsi sends).
- Reconnect surface smoke run live on preview (pass or follow-up filed).
- Production proven to send via Gmail OAuth before any SMTP removal.
- Plan 06 (SMTP removal) is now safe to ship.
</success_criteria>

<output>
After completion, create `.planning/phases/35-per-account-gmail-oauth-send/35-05-SUMMARY.md` recording: preview URL, production URL, the exact resume-signal text Andrew provided, the test booking IDs (if Andrew shares them), the seeded Account B UUID and pre/post row counts from the isolation test, the Step 5 reconnect smoke outcome (pass / follow-up filed), any header / log evidence captured, and the timestamp gap between preview verification and production verification.
</output>
