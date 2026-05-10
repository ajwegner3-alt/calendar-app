---
phase: 41-stripe-sdk-schema-webhook-skeleton
plan: 04
type: execute
wave: 3
depends_on: ["41-02", "41-03"]
files_modified: []
autonomous: false
user_setup:
  - service: stripe
    why: "PREREQ-F — register the deployed webhook endpoint in Stripe Dashboard so Stripe knows where to deliver events"
    dashboard_config:
      - task: "Register webhook endpoint at https://booking.nsintegrations.com/api/stripe/webhook (or current production URL); subscribe to the 6 event types listed in this plan; capture the whsec_* signing secret"
        location: "Stripe Dashboard -> Developers -> Webhooks -> Add endpoint"
      - task: "Add the captured whsec_* value to Vercel as STRIPE_WEBHOOK_SECRET (production env), then re-deploy to apply"
        location: "Vercel project -> Settings -> Environment Variables"

must_haves:
  truths:
    - "PREREQ-F is satisfied: webhook endpoint is registered in Stripe Dashboard, signing secret captured into Vercel STRIPE_WEBHOOK_SECRET, and a fresh production deploy has the new env var loaded"
    - "Stripe CLI 'stripe trigger customer.subscription.updated' against the deployed endpoint results in a 2xx response in Stripe Dashboard event log AND a corresponding row appearing in stripe_webhook_events"
    - "Replaying the SAME event_id (via Stripe Dashboard 'Resend' button) results in a 200 'ok_duplicate' response — exactly 1 row remains in stripe_webhook_events for that event_id and accounts was updated exactly once (BILL-06 V18-CP-02 idempotency proof)"
    - "Andrew's `nsi` test account is observed via SELECT to have subscription_status = 'trialing' and trial_ends_at ≈ deploy_time + 14 days (V18-CP-06 grandfather canary)"
    - "A signature-failure test (curl with bad sig header against the live endpoint) returns 400, logs source IP + error message only, and does NOT log the request body"
  artifacts: []  # This plan produces no code artifacts — it produces verification evidence captured in the SUMMARY.
  key_links:
    - from: "Stripe Dashboard webhook endpoint registration"
      to: "Production URL https://booking.nsintegrations.com/api/stripe/webhook"
      via: "PREREQ-F manual step"
    - from: "Vercel production env var STRIPE_WEBHOOK_SECRET"
      to: "Stripe Dashboard webhook signing secret"
      via: "Manual copy/paste of whsec_* value"
    - from: "stripe_webhook_events.stripe_event_id PRIMARY KEY"
      to: "Idempotency proof"
      via: "Replay same event_id from Dashboard, confirm only 1 row + 1 update"
---

<objective>
End-to-end verification of the Phase 41 billing foundation: confirm the webhook endpoint is registered, signature verification works against real Stripe-signed traffic, idempotency holds under replay, and the v1.7 grandfather backfill landed correctly on Andrew's `nsi` canary account.

Purpose: Plans 41-01, 41-02, 41-03 each shipped artifacts but none of them PROVE the system works end-to-end — Stripe must actually deliver an event and the row must actually appear in `accounts`. This plan is the gate before declaring Phase 41 done. Per Andrew's global preference, every phase ends with a Manual QA & Verification block — for a single phase, the manual checks live in this final-wave plan.

This plan is NOT autonomous: it requires Andrew to perform PREREQ-F (Stripe Dashboard webhook registration + Vercel env var update), and to confirm the visual results of the Stripe Dashboard event log. Claude executes everything that has a CLI / SQL / API path; Andrew handles the dashboard work.

Output:
- A single SUMMARY document capturing: PREREQ-F completion timestamp, the test event_id used, the dedupe row count after replay, the `nsi` account state post-deploy, and a green/red verdict for Phase 41 ship-readiness.
- No code or migration artifacts.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-CONTEXT.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-RESEARCH.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-02-SUMMARY.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-03-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: PREREQ-F — Register webhook endpoint in Stripe Dashboard + add signing secret to Vercel</name>
  <what-built>
Plan 41-03 deployed `POST /api/stripe/webhook` to production, but Stripe doesn't yet know about it — the endpoint must be registered in the Stripe Dashboard, and the dashboard-issued signing secret must be added to Vercel before any real Stripe-signed event will verify.

This step has NO CLI/API path that doesn't involve handing Claude API credentials with full account write scope, which is unsafe. Andrew completes the dashboard config; Claude continues with verification once the env var is live.
  </what-built>
  <how-to-verify>
**Andrew, perform these steps in order:**

1. **Open the Stripe Dashboard.** Go to https://dashboard.stripe.com/webhooks (use the same mode — test or live — that your `STRIPE_SECRET_KEY` env var points at; for the first deploy this is likely TEST mode).

2. **Click "Add endpoint".**

3. **Endpoint URL:** Enter your production URL ending in `/api/stripe/webhook`. Most likely: `https://booking.nsintegrations.com/api/stripe/webhook`. If your custom domain isn't fully cut over yet, the Vercel-issued URL (e.g., `calendar-app-xxx.vercel.app/api/stripe/webhook`) is fine for the first test.

4. **Description:** "v1.8 billing webhook (Phase 41)".

5. **API version:** Set explicitly to `2026-04-22.dahlia` to match the SDK pin (V18-CP-08). Do NOT leave on "latest".

6. **Events to send:** Click "Select events" and check ALL of:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

   (Six events total. Do NOT subscribe to "all events" — narrows the audit surface and keeps the Dashboard event log readable.)

7. **Click "Add endpoint".** The Dashboard will show the new endpoint; click on it to reveal the **Signing secret** (starts with `whsec_`). Click "Reveal" and copy the value.

8. **Open Vercel.** Project -> Settings -> Environment Variables.

9. **Add (or update) `STRIPE_WEBHOOK_SECRET`** with the `whsec_*` value from step 7. Set it for the environment that matches the dashboard mode (Production for live mode, Preview for test mode — for the first Phase 41 test, this is Preview/Production with test-mode keys).

10. **Trigger a re-deploy** so the new env var loads: in Vercel, click the latest deployment and choose "Redeploy" (no need to push a new commit).

11. **Confirm the redeploy is live** by visiting the production URL and verifying it loads (the page itself is unrelated, this just confirms the deploy succeeded).

12. **Reply with:** the endpoint URL you registered AND the deployed Vercel URL/SHA so Claude can record them. (Do NOT paste the `whsec_` secret into chat — the env var is the system of record.)
  </how-to-verify>
  <resume-signal>Type "registered" and paste the endpoint URL + Vercel deploy URL. If you hit a snag (custom domain not ready, Vercel env var update failing, etc.), describe the issue.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Trigger a real event via Stripe CLI, replay for idempotency, then verify DB state</name>
  <files>(no files modified — this task uses Stripe CLI + MCP Supabase SQL)</files>
  <action>
**Step 1: Trigger a fresh subscription.updated event.**

Run from the project root or any local dev machine where Stripe CLI is installed and logged in:

```bash
stripe trigger customer.subscription.updated
```

This sends a synthetic test-mode event signed with the registered endpoint's secret. The Stripe CLI will print the event_id (`evt_*`). Capture this.

If `stripe` CLI is not installed locally, install it first: see https://stripe.com/docs/stripe-cli. If Andrew has not authenticated the CLI to the right account, surface the error and ask him to run `stripe login` and retry.

If the trigger returns an error indicating the endpoint isn't reachable or signature failed, STOP — Task 1 was likely incomplete or the Vercel redeploy didn't pick up the env var. Re-verify by hitting the endpoint with curl and confirming a 400 (not a 502/404).

**Step 2: Confirm Stripe Dashboard logged a 200 response.**

Tell Andrew: "Open https://dashboard.stripe.com/webhooks/{your-endpoint-id}/attempts and find the event_id `evt_*` from Step 1. The 'Response' column should show 200 with body `ok` or `ok_duplicate`. If it shows 400 with `signature_failed`, the env var is wrong — re-do Task 1 step 9–10."

Capture Andrew's confirmation in the SUMMARY.

**Step 3: Verify the dedupe row landed in the DB.**

Run via `mcp__claude_ai_Supabase__execute_sql` against PRODUCTION:

```sql
SELECT stripe_event_id, event_type, received_at
FROM public.stripe_webhook_events
WHERE stripe_event_id = '{evt_id_from_step_1}';
```

EXPECT: 1 row, `event_type = 'customer.subscription.updated'`, `received_at` within the last 5 minutes.

If 0 rows: dedupe upsert silently failed OR the request never reached the route handler. Check Vercel runtime logs for the route — look for `[stripe-webhook]` log lines.

**Step 4: Replay the SAME event_id from Stripe Dashboard.**

Tell Andrew: "In the Dashboard webhook attempts view from Step 2, find the event row for `evt_*` and click the three-dots menu -> 'Resend'. Stripe will re-deliver the SAME event_id."

**Step 5: Verify idempotency held.**

Re-run the same SQL from Step 3 — should still return EXACTLY 1 row (not 2). If 2 rows appear, the dedupe upsert is broken (likely `ignoreDuplicates: true` not behaving as documented — see RESEARCH §Open Questions tertiary confidence note). Open a Phase 41 gap-closure plan to fix.

Also verify in Stripe Dashboard: the resent attempt should show 200 with body `ok_duplicate`.

**Step 6: Verify the `nsi` canary account state (V18-CP-06 grandfather proof).**

Run via `mcp__claude_ai_Supabase__execute_sql` against PRODUCTION:

```sql
SELECT
  slug,
  subscription_status,
  trial_ends_at,
  EXTRACT(EPOCH FROM (trial_ends_at - NOW())) / 86400 AS days_until_trial_end,
  stripe_customer_id,
  created_at
FROM public.accounts
WHERE slug = 'nsi';
```

EXPECT: `subscription_status = 'trialing'`, `days_until_trial_end` somewhere between 12.x and 14.0 (depending on how many days passed between Plan 41-02 apply and this verification step), `stripe_customer_id IS NULL`.

If `subscription_status != 'trialing'`: the Plan 41-02 backfill missed this row OR Andrew has been doing other testing. Surface the discrepancy in the SUMMARY but do not block — `nsi` not being trialing is concerning but the schema migration could still be valid (verify by re-running the Plan 41-02 verification queries).

**Step 7: Signature-failure smoke test.**

Run from any machine with curl:

```bash
curl -i -X POST https://{production_url}/api/stripe/webhook \
  -H "stripe-signature: t=1234567890,v1=invalid_signature_for_test" \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_test_invalid","type":"customer.subscription.updated"}'
```

EXPECT: HTTP 400 status. Body should be `signature_failed`. Confirm via Vercel runtime logs that the entry `[stripe-webhook] signature verification failed` appears with `ip`, `ts`, and `err` fields ONLY — NO request body content. If the body content appears in the log, that's a CONTEXT violation; surface in SUMMARY.

**Step 8: Compile verification verdict.**

For each of these checks, mark PASS / FAIL:

- [ ] Stripe CLI trigger event delivered with 2xx response in Dashboard
- [ ] Dedupe row appeared in `stripe_webhook_events` after first delivery
- [ ] Replayed event returned 200 `ok_duplicate` AND only 1 row remained in dedupe table
- [ ] `nsi` canary: `subscription_status = 'trialing'` and `trial_ends_at` in expected range
- [ ] Signature-failure curl returned 400 with `signature_failed` and minimal log (no payload)

If ALL pass: Phase 41 is GREEN. If any fail: open a gap-closure plan (`/gsd:plan-phase 41 --gaps`) — do NOT mark phase complete.

**What to AVOID:**
- Do NOT use `stripe trigger customer.subscription.deleted` for the first test — it modifies a real subscription in test mode and can leave dangling state. `customer.subscription.updated` is the safest read-only-ish trigger.
- Do NOT skip Step 5 (idempotency replay) — this is the V18-CP-02 proof point and the most-likely-to-be-broken behavior given the MEDIUM confidence on the `.upsert(ignoreDuplicates: true).select().maybeSingle()` pattern (RESEARCH §Open Questions tertiary).
- Do NOT manually delete rows from `stripe_webhook_events` between tests. If the trigger generated a new event_id each time, every row is a legitimate audit entry. Cleanup is not required.
- Do NOT proceed to Phase 42 until ALL 5 verification points are GREEN. Phase 42 builds on a live, working webhook — re-litigating Phase 41 issues during Phase 42 doubles the debug surface.
  </action>
  <verify>
Captured evidence (paste into the SUMMARY file produced by this plan):

1. Stripe event_id from `stripe trigger` output.
2. Stripe Dashboard screenshot (or quoted text) showing 200 response for the first delivery + 200 `ok_duplicate` for the resend.
3. SQL output of `SELECT * FROM stripe_webhook_events WHERE stripe_event_id = '...'` showing exactly 1 row before AND after replay.
4. SQL output of `nsi` account check showing `subscription_status = 'trialing'` and computed `days_until_trial_end`.
5. Curl response (status code + body) for the bad-signature test.
6. Snippet of Vercel runtime log showing the bad-signature log entry has only `{ip, ts, err}` fields — no body content.
  </verify>
  <done>
- Stripe CLI trigger delivered an event that the production endpoint accepted with 200.
- Replay of the same event_id returned 200 `ok_duplicate` AND `stripe_webhook_events` has exactly 1 row for it.
- `nsi` account verified `trialing` with trial_ends_at in expected range.
- Bad-signature curl confirmed 400 with minimal log.
- All evidence captured in SUMMARY file.
- If any check failed: gap-closure plan is open (Phase 41 NOT marked complete).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Andrew final sign-off on Phase 41</name>
  <what-built>
The full Phase 41 billing foundation:

- Plan 41-01 shipped `lib/stripe/client.ts` with stripe@22.1.1 pinned + apiVersion locked.
- Plan 41-02 shipped the schema migration: 7 columns on `accounts`, `stripe_webhook_events` table, updated trigger, grandfather backfill on existing accounts.
- Plan 41-03 shipped `app/api/stripe/webhook/route.ts` with signature verification, dedupe, atomic per-event UPDATEs, and dedupe-rollback on DB failure.
- Plan 41-04 Tasks 1–2 verified end-to-end: PREREQ-F satisfied, real Stripe trigger delivered + acked, idempotency proven via replay, `nsi` canary green, bad-signature behavior correct.

Phase 41 ships the LIVE billing skeleton: every event Stripe fires for any customer is now mirrored into the database. Phase 42 (checkout) can now write `stripe_customer_id` onto an account row, redirect to hosted Checkout, and trust that the resulting `customer.subscription.created` event will land cleanly.
  </what-built>
  <how-to-verify>
**Andrew, sanity-check before signing off:**

1. **Stripe Dashboard → Webhooks:** confirm your endpoint is listed, status is "Enabled", and the API version shown matches `2026-04-22.dahlia`.

2. **Stripe Dashboard → Webhooks → your endpoint → Webhook attempts:** confirm the test event from Task 2 Step 1 is logged with a 200 response, AND the resend from Task 2 Step 4 is also logged with 200.

3. **Vercel runtime logs:** confirm `[stripe-webhook] processed { ... outcome: 'routed' }` appeared for the first delivery and `[stripe-webhook] duplicate { ... outcome: 'duplicate' }` appeared for the resend. (Vercel project → Logs → filter by `/api/stripe/webhook`.)

4. **Your `nsi` test account:** open the app, log in as the nsi owner, navigate to whatever page you normally see. Confirm nothing has changed visually (Phase 41 ships zero UI). The trial banner / paywall middleware is Phase 43 — there should be no visible difference yet.

5. **Confirm no production data damage:** open Supabase Dashboard, browse `accounts` table, spot-check 2–3 accounts other than `nsi` to confirm they all have `subscription_status = 'trialing'` and `trial_ends_at` ≈ migration-apply-time + 14 days. None should have `subscription_status` of any other value.

6. **Spot-check `stripe_webhook_events`:** in Supabase Dashboard, browse the new table. You should see at least 1 row (the test trigger from Task 2). No PII should be visible — just `stripe_event_id`, `event_type`, `received_at`, `processed_at` columns.

**If everything looks right:** approve, and Phase 41 is shipped. The roadmap can move to Phase 42.

**If anything is off:** describe the issue, and a gap-closure plan will be opened.
  </how-to-verify>
  <resume-signal>Type "approved" to mark Phase 41 complete and unblock Phase 42 planning. Or describe issues for a gap-closure plan.</resume-signal>
</task>

</tasks>

<verification>

Phase-level checks for this plan (and for closing out Phase 41 entirely):

1. PREREQ-F satisfied: Stripe Dashboard endpoint registered, `STRIPE_WEBHOOK_SECRET` set in Vercel production env, fresh deploy with new env var live.
2. `stripe trigger customer.subscription.updated` against production endpoint returned 2xx in Stripe Dashboard event log.
3. Production `stripe_webhook_events` table has at least one row matching the test event_id.
4. Replay of the same event_id returned 200 `ok_duplicate` and the dedupe table count for that event_id is still exactly 1 (idempotency proven).
5. `nsi` canary: `subscription_status = 'trialing'`, `trial_ends_at` within expected range.
6. Bad-signature curl returned 400 with minimal log (no payload leak).
7. Andrew's visual sign-off received (`approved` resume-signal on Task 3).

</verification>

<success_criteria>

This plan is complete (and Phase 41 is shipped) when:

- [ ] PREREQ-F manual steps confirmed by Andrew (`registered` resume-signal).
- [ ] Stripe CLI test event delivered and acked with 2xx.
- [ ] Idempotency replay proven via SQL count check.
- [ ] `nsi` grandfather canary green.
- [ ] Bad-signature handling proven via curl.
- [ ] Andrew's final visual sign-off received (`approved` resume-signal).
- [ ] All evidence captured in this plan's SUMMARY.

</success_criteria>

<output>
After completion, create `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-04-SUMMARY.md` documenting:

1. PREREQ-F completion timestamp + endpoint URL Andrew registered + Vercel deploy URL/SHA.
2. Test event_id from `stripe trigger` + Stripe Dashboard outcome (200 / 200-resend).
3. SQL evidence of single dedupe row before AND after replay.
4. `nsi` account state (status + trial_ends_at + days_until_trial_end at verification time).
5. Curl response from bad-signature test (status code + body) + log snippet confirming no payload leak.
6. Final verdict table (PASS/FAIL × 5 checks).
7. Andrew's sign-off acknowledgement.
8. Notes for Phase 42:
   - Webhook endpoint is live and verified — Phase 42's checkout route can rely on it to update `subscription_status` after Stripe completes the Checkout session.
   - Phase 42 must add `subscription_data: { metadata: { account_id } }` to the Checkout Session params if a defense-in-depth account-id link is desired (RESEARCH §Account Lookup Option B).
   - Phase 42 must write `stripe_customer_id` onto the `accounts` row BEFORE redirecting to Checkout (or accept the Phase 41 "fail loud + retry" behavior on the first webhook).
9. Frontmatter must include:
   - `subsystem: billing`
   - `affects: [42-01, 42-02, 43-01, 44-01]`
   - `requires: [41-01, 41-02, 41-03]`
   - `verification: ["BILL-01", "BILL-02", "BILL-03", "BILL-04", "BILL-05", "BILL-06", "BILL-07", "BILL-08"]`
</output>
