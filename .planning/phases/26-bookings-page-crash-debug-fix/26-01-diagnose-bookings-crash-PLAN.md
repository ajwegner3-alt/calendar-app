---
phase: 26-bookings-page-crash-debug-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md
autonomous: false

must_haves:
  truths:
    - "Vercel server-log stack trace for the /app/bookings crash has been captured verbatim from a live failed request."
    - "A specific failure site among Candidates A-E (or a newly-identified site) has been confirmed by code+data evidence, not speculation."
    - "Failure can be deterministically reproduced (either via SQL Editor query that exposes the bad data shape, or via local repro instructions)."
    - "A one-line mechanism explains WHY it fails (e.g., 'event_types!inner returns [] when X, normalization yields undefined, downstream consumer derefs undefined.name')."
    - "A candidate fix shape is named (specific file/line + change type), with its risk class noted."
    - "Andrew has explicitly confirmed the diagnosis is correct before Plan 02 starts."
  artifacts:
    - path: ".planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md"
      provides: "The locked diagnosis: stack trace, repro, mechanism, fix shape, risk."
      contains:
        - "## Stack Trace"
        - "## Reproduction"
        - "## Mechanism"
        - "## Proposed Fix Shape"
        - "## Andrew Confirmation"
  key_links:
    - from: "26-DIAGNOSIS.md"
      to: "Plan 02 (fix scope)"
      via: "Proposed Fix Shape section names exact file:line + change type"
      pattern: "Proposed Fix Shape"
---

<objective>
Identify the confirmed root cause of the `/app/bookings` server-component crash and write the diagnosis to `26-DIAGNOSIS.md`.

Purpose: Honors the CONTEXT hard rule — NO fix PR until repro + mechanism + fix shape are all in hand. This plan is the gate. Without a locked diagnosis, Plan 02 has nothing to fix surgically.

Output: `26-DIAGNOSIS.md` containing: actual Vercel stack trace, deterministic repro steps (SQL or otherwise), one-line mechanism, named fix shape, and Andrew's explicit confirmation.

**Hard rule (CONTEXT):** Do NOT write any application code changes in this plan. Diagnosis only. If you find yourself opening `_lib/queries.ts` to "just add a guard," stop — that work belongs in Plan 02 after this plan's gate clears.

**V14-MP-04 reminder:** The leading hypothesis from REQUIREMENTS that says "guard `bookings-table.tsx:108`" is STALE. Line 108 is markup; the duration access is line 67 and is already optional-chained. Adding speculative null guards on the table layer is a no-op AND a Pitfalls violation. The crash is somewhere ELSE in the render path. Confirm it before touching code.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/26-bookings-page-crash-debug-fix/26-CONTEXT.md
@.planning/phases/26-bookings-page-crash-debug-fix/26-RESEARCH.md
@.planning/research/PITFALLS.md

# Suspect render path (read-only inspection during diagnosis)
@app/(shell)/app/bookings/page.tsx
@app/(shell)/app/bookings/_lib/queries.ts
@app/(shell)/app/bookings/_components/bookings-table.tsx
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Capture Vercel server-log stack trace from a live failed /app/bookings request</name>
  <action>
    Andrew must trigger the crash live and copy the resulting Vercel server log into the chat.

    Detailed steps for Andrew:
    1. Open the Vercel dashboard for the calendar-app project.
    2. In a separate browser tab/window (signed in as the failing owner — start with the seeded NSI account, slug=`nsi`), visit the production URL `/app/bookings`.
    3. Confirm the page renders a server error (500 or framework error page).
    4. Return to Vercel → Deployments → the active production deployment → Functions tab (or Logs tab).
    5. Filter logs to the last few minutes. Locate the entry for the failed `/app/bookings` request (path will include `/app/bookings`).
    6. Click into the entry to expand the full stack trace.
    7. Copy/paste the FULL log entry into chat. Include:
       - Timestamp
       - Request path + status code
       - Full error message
       - Full stack trace (every frame, especially frames inside `app/(shell)/app/bookings/...` or `_lib/queries.ts`)
       - Any PostgREST error body if surfaced (look for `code`, `message`, `details`, `hint` fields)
    8. Also note: the failing owner's account slug, and roughly what `slug=` URL was visited.

    Why human-action (not auto): Vercel server logs require dashboard auth; no CLI access to historic function-invocation logs from this project setup. This is the PRIMARY diagnostic lever per RESEARCH §"Diagnostic Levers" and the explicit CONTEXT decision: "Do NOT deploy temporary instrumentation as a first move. If Vercel server logs are opaque or the stack trace is unhelpful, pause and ask Andrew to copy/paste raw Vercel logs."

    What Claude does once logs arrive:
    - Read the topmost frame inside the app's source tree (NOT framework frames). This is the failure site.
    - Cross-reference against the five candidates in `26-RESEARCH.md` §"Five Candidate Failure Sites":
      * Frame in `_lib/queries.ts:86` (`if (error) throw error`) → Candidate A (PostgREST/RLS error). Read the included PostgREST message body for sub-classification.
      * Frame in `_lib/queries.ts:91-99` or in a downstream consumer that dereffed `event_types.<x>` → Candidate B (normalization yields undefined).
      * Frame in `bookings-table.tsx:33-39` (`formatBookerStart` / `TZDate` / `RangeError`) → Candidate C.
      * PostgREST message body suggesting RLS exclusion or row-level filter mismatch → likely Candidate D.
      * Frame in `listEventTypesForFilter` → Candidate E.
      * No match → new candidate; document and proceed to Task 2 with the unknown.
    - Note the matched candidate (or "unknown") in working memory; Task 2 turns this into a deterministic repro.

    If Andrew's logs are opaque (e.g., truncated trace, no PostgREST body, generic 500): pause and ask Andrew for additional context (which seeded account, what filter was applied via search params, recent dashboard activity). Only after exhausting human-supplied evidence is it acceptable to consider deploying instrumentation — and even then, prefer a `console.error` at suspect catch sites in a separate diagnostic-only commit, not full instrumentation.
  </action>
  <resume-signal>Andrew pastes the Vercel log entry (including stack trace + PostgREST error body if any) into chat. Type "logs pasted" or just paste the log block.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Reproduce the failure deterministically via Supabase SQL Editor (or document the equivalent)</name>
  <files>.planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md</files>
  <action>
    Goal: turn the stack trace from Task 1 into a deterministic repro that names the exact data shape (or runtime condition) producing the crash.

    Approach by candidate (after Task 1 narrows the field):

    **If Candidate A (PostgREST error throw at `_lib/queries.ts:86`):**
    - The PostgREST error body is the repro. Document the exact `{code, message, details, hint}` payload.
    - If RLS-related (e.g., `code: '42501'`): run, via Supabase SQL Editor, the literal `SELECT` from `_lib/queries.ts:42-83` against the failing account's `account_id`. Confirm whether the same error reproduces.
    - If schema-cache (e.g., `column ... does not exist`): note migration timeline in DIAGNOSIS — last migration touching the bookings render path was Phase 21's `accounts` column drop on 2026-05-02. Cross-check whether queries.ts references any column that no longer exists.

    **If Candidate B (normalization yields undefined):**
    - Hand Andrew the SQL one-liner from `26-RESEARCH.md` §"Diagnostic Levers" → "Direct join inspection". Translated to raw SQL:

        SELECT
          b.id,
          b.event_type_id,
          et.id IS NULL AS et_missing
        FROM bookings b
        LEFT JOIN event_types et ON et.id = b.event_type_id
        WHERE b.account_id = '<failing-account-id>';

    - Andrew runs this in SQL Editor (admin client; bypasses RLS for diagnosis). Andrew pastes results.
    - Confirm whether any `et_missing = true` rows exist. If yes → Candidate B confirmed at the data layer.
    - Then run the RLS-scoped equivalent: in SQL Editor, "Run as authenticated" with the failing owner's `auth.uid()`. The original PostgREST query is approximated by:

        SELECT
          b.*,
          row_to_json(et) AS event_types_inner
        FROM bookings b
        LEFT JOIN event_types et ON et.id = b.event_type_id AND et.account_id = b.account_id
        WHERE b.account_id IN (SELECT account_id FROM accounts WHERE owner_user_id = auth.uid());

    - If `event_types_inner` is `null` for any row when authenticated, but the booking row still appears → that's the RLS exclusion artifact (Candidate D feeding into Candidate B).

    **If Candidate C (`formatBookerStart` RangeError):**
    - Run, via SQL Editor (admin client):

        SELECT id, start_at, booker_timezone
        FROM bookings
        WHERE account_id = '<failing-account-id>'
          AND (booker_timezone IS NULL OR booker_timezone = '' OR LENGTH(booker_timezone) < 3);

    - Andrew pastes results. Each returned row is a deterministic crash trigger; pick one for repro doc.
    - Optionally confirm the RangeError shape locally: `node -e "new Intl.DateTimeFormat('en', {timeZone: ''})"` will throw the same RangeError class — just confirm error class, not full integration.

    **If Candidate D (RLS join data drift):**
    - Run, via SQL Editor (admin client):

        SELECT
          b.id, b.account_id AS booking_account,
          et.id AS et_id, et.account_id AS et_account
        FROM bookings b
        JOIN event_types et ON et.id = b.event_type_id
        WHERE b.account_id <> et.account_id;

    - Any returned row is a smoking gun for cross-account FK drift. Document the affected booking and event_type IDs in DIAGNOSIS.
    - This is the case where CONTEXT explicitly authorizes a DDL fix — flag in DIAGNOSIS that Plan 02 will need a data-fix UPDATE plus optionally a CHECK/trigger.

    **If Candidate E or unknown:**
    - Read the topmost stack frame's surrounding code (5-line context). Hypothesize a minimal repro. If Vercel logs alone don't yield repro, ask Andrew for additional hints (recent operations on the failing account, last successful render time, etc.). Iterate until repro lands.

    **Stop condition (CONTEXT hard rule):** Do not move to Task 3 until you have ALL THREE of:
    1. The stack trace (from Task 1).
    2. A deterministic repro (named bad row IDs, named PostgREST error, or named runtime condition).
    3. A one-line mechanism — the chain from data/state → throw site.

    If after reasonable diagnostic work any of the three is missing, escalate to Andrew: ask for specific additional data (e.g., "please run THIS SQL and paste results" or "please attempt the same URL while signed in as nsi-rls-test-3 and paste those logs"). Do NOT guess.

    Write the in-progress findings into `26-DIAGNOSIS.md` at this task. Sections to populate (template skeleton — fill what you have so far):

        # Phase 26 Diagnosis

        **Diagnosed:** <YYYY-MM-DD>
        **Status:** in-progress | confirmed | gated-on-andrew

        ## Stack Trace
        <verbatim from Task 1, in code fence>

        ## Failing Account(s)
        - Slug: <e.g., `nsi`>
        - Account ID: <uuid>
        - Other accounts that also reproduce: <slug list>

        ## Reproduction
        <Either:
          - SQL Editor query + observed row count or specific row IDs that trigger the crash, OR
          - Runtime condition: "Visit /app/bookings as <account>; row with booker_timezone='' triggers RangeError on render of row.id=<uuid>">

        ## Mechanism
        <ONE LINE explaining WHY it fails. Example:
          "queryBookings normalizes `event_types: []` (RLS-excluded join) to `undefined`, casts to BookingRow, downstream consumer at <file:line> dereferences `.name` without optional chaining, throws TypeError.">

        ## Matched Candidate
        <A | B | C | D | E | new>

        ## Proposed Fix Shape
        <Named file:line + change type. Examples:
          - "Filter null-event_types rows in `_lib/queries.ts` post-normalization; refactor BookingRow.event_types to `EventTypeJoin | null`; update consumers (table already uses `?.`, type-only change there)."
          - "Default `booker_timezone` to 'UTC' inside formatBookerStart with explicit `console.error` log when the fallback fires; do NOT add `?? 'UTC'` at insert time (out of scope)."
          - "Data-fix UPDATE to repair drifted bookings.account_id rows; flag for Phase 27 schema CHECK constraint follow-up.">
        Risk: <low | medium | high>; Reason: <e.g., "type widening forces caller audit; mitigated by all consumers already using `?.`">

        ## Deferred Findings (for Plan 02 SUMMARY, do not fix)
        <list potentially-fragile sites observed during diagnosis: load-month-bookings.ts:62 unguarded join consumer, regenerate-reschedule-token.ts:55 inline access, etc. Per RESEARCH §"Grep Audit".>

        ## Andrew Confirmation
        <empty until Task 3>

  </action>
  <verify>
    `26-DIAGNOSIS.md` exists and contains non-empty sections: Stack Trace, Reproduction, Mechanism, Matched Candidate, Proposed Fix Shape. The "ONE LINE" mechanism is genuinely one sentence (no hand-waving multi-paragraph "could be A or B"). Reproduction names specific row IDs, specific error codes, or specific runtime inputs — not "RLS issue maybe."
  </verify>
  <done>
    Three CONTEXT artifacts present in 26-DIAGNOSIS.md: (1) deterministic repro, (2) one-line mechanism, (3) named fix shape with file:line. Andrew Confirmation section still empty (filled in Task 3).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Andrew confirms the diagnosis</name>
  <what-built>
    `26-DIAGNOSIS.md` is written with stack trace, deterministic repro, one-line mechanism, matched candidate, and proposed fix shape with risk classification.
  </what-built>
  <how-to-verify>
    1. Open `.planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md`.
    2. Read top to bottom. Sanity-check:
       - Does the stack trace look like what you saw on Vercel?
       - Does the Reproduction step actually reproduce on your end (re-run the SQL or re-visit the URL if practical)?
       - Does the Mechanism sentence make sense — does it explain WHY this specific data shape causes this specific throw?
       - Does the Proposed Fix Shape feel surgical (one site, named file:line) rather than sprawling (multiple unrelated changes)?
       - Is the risk classification honest? (e.g., "low" risk for a single null-filter is reasonable; "low" for a DDL data-fix is not)
    3. If any of the above is weak, type "diagnosis weak: <what's missing>" and Claude will iterate (re-run SQL, ask for more logs, refine the mechanism).
    4. If all four hold, append to the "Andrew Confirmation" section in `26-DIAGNOSIS.md`:

           ## Andrew Confirmation
           Confirmed by Andrew on <YYYY-MM-DD>. Diagnosis matches observed behavior. Plan 02 cleared to implement the proposed fix shape.

       (Claude will write this on Andrew's go-ahead — Andrew just types "diagnosis confirmed" or similar.)
  </how-to-verify>
  <resume-signal>Type "diagnosis confirmed" to proceed to Plan 02. Type "diagnosis weak: <reason>" to iterate. Type "rediagnose" to redo from Task 1 with new evidence.</resume-signal>
</task>

</tasks>

<verification>
Plan 01 is complete when:
- `26-DIAGNOSIS.md` exists with all required sections populated.
- Andrew Confirmation section has Andrew's explicit go-ahead.
- The Proposed Fix Shape is specific enough that Plan 02 can execute it without re-diagnosing (named file:line + change type + risk).
- No application code (`.ts`/`.tsx` under `app/` or `lib/`) has been modified in this plan. Diagnosis only.
</verification>

<success_criteria>
- DIAGNOSIS.md exists at `.planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md`.
- Stack Trace, Reproduction, Mechanism, Matched Candidate, Proposed Fix Shape, Andrew Confirmation all populated.
- CONTEXT stop condition satisfied: repro + mechanism + fix-shape all in hand.
- Zero modifications to `app/`, `lib/`, `tests/`, `supabase/`, or any source/migration files.
</success_criteria>

<output>
After completion, create `.planning/phases/26-bookings-page-crash-debug-fix/26-01-SUMMARY.md` with:
- Brief recap of the diagnosis (link to DIAGNOSIS.md, do not duplicate content)
- The matched candidate and one-line mechanism
- Deferred findings for SUMMARY consolidation in Plan 03
- Time to diagnose (rough)
- Any unexpected discoveries (e.g., found two related crashes, escalated to Phase 27 candidate, etc.)
</output>
