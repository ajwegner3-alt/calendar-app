# Phase 26: Bookings Page Crash Debug + Fix — Research

**Researched:** 2026-05-03
**Domain:** Server-component crash debugging on `/app/bookings` (Next.js 16 + Supabase RLS + supabase-js join normalization)
**Confidence:** HIGH (code-level grounding) / MEDIUM (root cause attribution — log evidence still missing)

---

## Summary

The leading hypothesis carried in REQUIREMENTS/ARCHITECTURE — "null guards on `row.event_types?.duration_minutes` access at `bookings-table.tsx:108`" — does NOT match the live code. As of HEAD:

- `bookings-table.tsx:67` is `row.event_types?.duration_minutes` (already optional-chained).
- `bookings-table.tsx:66` is `row.event_types?.name ?? "(deleted event type)"` (already null-safe).
- Line 108 in the table is the `typeof duration === "number"` render, which is also safe.

The "leading hypothesis" was written against an earlier file shape; the table-layer null deref is already defused. So the crash is somewhere ELSE in the render path, and a "just add a null guard at line 108" reflex would be a no-op (and would violate V14-MP-04 anyway).

The render path has FIVE plausible failure sites, ranked by likelihood. The diagnostic protocol must distinguish between them via Vercel logs / SQL Editor BEFORE any fix is written. Per CONTEXT decision, the fix is surgical at the confirmed site.

**Primary recommendation:** Treat this phase as a 3-step protocol — (1) gather Vercel server logs and the actual stack trace via Andrew, (2) reproduce in SQL Editor against the failing account, (3) fix the confirmed site only. Do NOT add belt-and-suspenders null guards to the render path on speculation — they will mask the real bug for the next regression.

---

## Phase Boundary (from CONTEXT)

- IN scope: identify root cause of `/app/bookings` crash, ship surgical fix, audit for the same anti-pattern across `_lib/queries.ts` and adjacent helpers, add ONE targeted regression test.
- OUT of scope: broader query-helper refactor, Sentry/structured logging, UX polish (skeletons, retry UI), Phase 27 schema/RLS hardening.
- Hard rule: do NOT open a fix PR until ALL THREE are in hand: (a) deterministic repro, (b) one-line mechanism, (c) candidate fix that resolves the repro.

---

## Render Path (Ground Truth)

The bookings page uses the `(shell)` route group, NOT `(authenticated)`. Files involved:

```
app/(shell)/app/bookings/page.tsx                       (Server Component)
  └─ awaits searchParams (Next.js 16 lock)
  └─ Promise.all([
       queryBookings(...)          → app/(shell)/app/bookings/_lib/queries.ts:37-105
       listEventTypesForFilter()   → same file:107-117
     ])
  └─ renders <BookingsFilters /> (client)
  └─ renders <BookingsTable rows={rows} />  → _components/bookings-table.tsx
       └─ for each row:
           - eventName = row.event_types?.name ?? "(deleted event type)"   [line 66 — guarded]
           - duration  = row.event_types?.duration_minutes                  [line 67 — guarded]
           - <Badge> via statusBadgeClass(row.status)                       [line 124 — exhaustive switch]
           - formatBookerStart(row) → new TZDate(new Date(row.start_at), row.booker_timezone)  [line 37 — UNGUARDED]
  └─ renders <BookingsPagination />
```

**No `error.tsx` exists in `app/(shell)/app/bookings/` or any ancestor up to `app/`.** A thrown error bubbles to the Next.js framework default error response — i.e., a hard 500. There is also no `loading.tsx` for bookings.

---

## Five Candidate Failure Sites (Ranked)

For each: where the throw happens, the mechanism, and the diagnostic that confirms it.

### Candidate A — `queryBookings` throws via `if (error) throw error` (queries.ts:86)

- **Mechanism:** Supabase returns a non-null `error` (RLS denial, schema-cache miss, PostgREST 400 on the join syntax, missing column post-migration, etc). The throw bubbles to the unhandled server-component boundary.
- **Why plausible:** `page.tsx` has no try/catch around `Promise.all`. Any `error.message` from PostgREST surfaces as a hard 500. The Phase 21 column-drop migration (`20260502034300`) was the last schema change — small chance of stale schema cache or a column that the bookings query references but no longer exists (unlikely on the bookings path; that migration only touched `accounts`).
- **Confirmation:** Vercel function log will show `Error: <PostgREST message>` with frame at `_lib/queries.ts:86`.
- **Fix shape:** Depends on the PostgREST message. If RLS-related → see Candidate D. If schema/cache-related → may need `npx supabase gen types` rebuild or PostgREST restart.

### Candidate B — `event_types` normalization yields `undefined` (queries.ts:91-99)

- **Mechanism:** PostgREST returns `event_types: []` (empty array) for a row even with `!inner`. The normalization at line 92 (`Array.isArray(row.event_types) ? row.event_types[0] : row.event_types`) returns `undefined`. Type assertion `as BookingRow[]` lies — `et` is `undefined`, but `BookingRow.event_types` is typed as required. Downstream readers either trip the `?.` chain (safe at table layer) OR a downstream consumer that does NOT use optional chaining crashes.
- **Why plausible:** The Phase 5/6 lock comment at line 88-90 acknowledges that supabase-js join cardinality is non-deterministic. An empty-array case for `!inner` is theoretically impossible per FK semantics, but PostgREST has historically returned `[]` when RLS filters out the joined row (RLS on `event_types` requires the user's account to own the event type — they do — but a denormalized FK + soft-delete corner case could still produce this).
- **Confirmation:** SQL Editor query of the same join with `auth.uid()` substituted → check whether any row has zero matched `event_types`. Also: log `data` before normalization to see the raw shape.
- **Fix shape:** Add `if (!et) return null/skip` at the normalization layer + filter out null rows before returning, OR upgrade `BookingRow.event_types` to `... | null` and update all consumers (table component already uses `?.`, so the change is type-correctness only).
- **Note:** This is the candidate ARCHITECTURE.md called out at line 246-248, and it's the most code-architecturally suspect site, but the table consumer is already guarded — so this candidate alone wouldn't crash unless something downstream from the page (a different consumer or a future server-side use of the row before the table renders) accesses `et.name` directly.

### Candidate C — `formatBookerStart` throws on bad date/timezone (bookings-table.tsx:33-39)

- **Mechanism:** `new TZDate(new Date(row.start_at), row.booker_timezone)` will throw `RangeError: Invalid time zone specified` if `booker_timezone` is `""`, `null`, or an unrecognized string. Will throw `RangeError: Invalid time value` if `start_at` is malformed.
- **Why plausible:** `booker_timezone` is `text not null` in the DB (initial schema line 84) — but historic seed data or admin-inserted rows could have an empty string. `start_at` is `timestamptz not null` — invalid value is unlikely but not impossible.
- **Confirmation:** Stack trace will include `TZDate` or `formatBookerStart`. SQL Editor: `SELECT id, start_at, booker_timezone FROM bookings WHERE booker_timezone IS NULL OR booker_timezone = ''` against the failing account.
- **Fix shape:** Either fall back to a sane default (`row.booker_timezone || "UTC"`), or sanitize at insert time (out-of-scope for this phase). The CONTEXT "loud-failure bias" pushes against silent UTC fallback — but a useful failure mode would be rendering "—" for that row's time and continuing, so the rest of the table renders.

### Candidate D — RLS join exclusion artifact

- **Mechanism:** `bookings` RLS policy is `account_id in (select current_owner_account_ids())` (rls_policies.sql:51-54). `event_types` RLS is the same shape (line 33-36). The `!inner` join requires the event_types row to be visible too. If the booking's `event_type_id` points to an event type whose `account_id` is no longer in the current owner's set (data corruption, manual surgery, mid-migration state), the join silently drops the row → `event_types` is `undefined` (Candidate B) OR the entire query returns `error` (Candidate A) depending on PostgREST behavior.
- **Why plausible:** ARCHITECTURE called this out as the secondary candidate. The seeded `nsi-rls-test` and `nsi-rls-test-3` accounts could be in a state where bookings exist but the corresponding event_types' RLS path is misaligned (e.g., account_id mismatch).
- **Confirmation:** SQL Editor with admin client: `SELECT b.id, b.account_id, b.event_type_id, et.account_id AS et_account_id FROM bookings b LEFT JOIN event_types et ON et.id = b.event_type_id WHERE b.account_id <> et.account_id;` — should return 0 rows. If it returns rows, that's the smoking gun.
- **Fix shape:** Data-fix (admin SQL UPDATE to repair `bookings.account_id` or `event_types.account_id`) plus a CHECK constraint or trigger to prevent the drift (CONTEXT allows DDL if confirmed root cause is here, but escalation must be flagged in SUMMARY first).

### Candidate E — `listEventTypesForFilter` throws or interacts with Promise.all rejection

- **Mechanism:** The `Promise.all([queryBookings(...), listEventTypesForFilter()])` at page.tsx:46-57 fails-fast if either rejects. `listEventTypesForFilter` doesn't throw (it returns `data ?? []`), but a missing `deleted_at` column or schema cache issue could still surface.
- **Why plausible:** Low — this helper is the simplest in the file.
- **Confirmation:** Stack trace pointing to `listEventTypesForFilter` or `event_types` SELECT.
- **Fix shape:** Same protocol as Candidate A.

---

## Diagnostic Levers (What Tools the Plan Has)

### Vercel server logs (PRIMARY)

- **Access pattern:** Manual handoff per CONTEXT — Andrew copies logs from Vercel dashboard into chat. Do NOT deploy temporary instrumentation as a first move.
- **What to ask Andrew for:** the exact stack trace (frames including file paths + line numbers), plus the visible response timestamp, so the log snapshot can be correlated to a specific failed request.
- **What to look for:** the topmost frame inside `app/(shell)/app/bookings/...` — that's the failure site. Any PostgREST error message body included in the throw.

### Supabase SQL Editor (SECONDARY)

- **Reproduce the RLS-scoped query:** Use SQL Editor's "Run as authenticated" feature with the failing owner's `auth.uid()` (Andrew supplies via screenshot of the Auth → Users panel).
- **Direct join inspection:** Run the literal `select id, start_at, ..., event_types!inner(id, name, duration_minutes) from bookings where account_id = '<failing-account-id>'` (translated to the PostgREST equivalent) and observe whether `event_types` is `null`, `[]`, or an object on each row.
- **Data-shape audit:** `SELECT b.id, b.booker_timezone, b.start_at, et.id IS NULL AS et_missing FROM bookings b LEFT JOIN event_types et ON et.id = b.event_type_id WHERE b.account_id = '<id>'`.

### Console.error sites (existing convention)

- **Established pattern:** `console.error("[<context>] <message>", err)` — used in `app/api/cron/send-reminders/route.ts:141`, several auth actions, and route handlers. NOT currently used in any `_lib/queries.ts` or page Server Component.
- **Decision per CONTEXT:** if a single `console.error` at the catch site of a fix is needed, it's acceptable. No new logging framework. If the established convention is "let it throw," preserve that.

### Error-boundary status quo

- **No `error.tsx` exists anywhere in the route tree** under `app/(shell)/app/`. Pages like `app/(shell)/app/page.tsx:34` use `throw new Error(...)` and rely on the framework default. `app/(shell)/app/bookings/[id]/page.tsx:44` uses `notFound()` for missing-row but not for query errors.
- **Decision:** CONTEXT delegates the error-boundary question to Claude's discretion. If the root cause is data/schema-shape (Candidate B/C/D), a targeted fix at the source is preferred over wrapping the page. If the root cause is "query helper occasionally throws on RLS race," a `error.tsx` boundary at `app/(shell)/app/bookings/error.tsx` is reasonable — but only if it preserves loud failure (don't swallow the error message, log via `console.error`, show a graceful "Bookings page failed to load" + retry-via-reload).

---

## Grep Audit: Other `!inner` join sites

Per CONTEXT decision on grep audit breadth, here's the full inventory of sites using the same anti-pattern (object-or-array normalization). Document risk in SUMMARY but do NOT fix unless actually broken.

| File:Line | Join | Normalization status | Risk |
|---|---|---|---|
| `app/(shell)/app/bookings/_lib/queries.ts:48` | `event_types!inner(id, name, duration_minutes)` | Lines 91-99 normalize | **Suspect site (Phase 26)** |
| `app/(shell)/app/_lib/load-month-bookings.ts:47` | `event_types!inner(name, account_id)` | Line 62 uses `row.event_types?.name ?? ""` (no normalization, optional chaining only) | Could undefined-deref if a future caller accesses `event_types.account_id`. Caller `page.tsx` only reads `name`. |
| `app/(shell)/app/_lib/regenerate-reschedule-token.ts:55` | `event_types!inner(account_id)` | Inline access without normalization | LOW — single-row read, used for ownership check. |
| `app/(shell)/app/bookings/[id]/_lib/actions.ts:158` | `event_types!inner(name, duration_minutes, location, account_id)` | Lines 192-201 normalize defensively | OK — same pattern as queries.ts but with explicit type cast. |
| `app/(shell)/app/bookings/[id]/page.tsx:37` | `event_types!inner(...) accounts!inner(...)` | Lines 50-55 normalize both | OK — defensive shape locked Phase 5/6. |
| `app/api/cron/send-reminders/route.ts:126-127` | `event_types!inner(...) accounts!inner(...)` | Lines 150-165 normalize both | OK — explicitly typed `ScanRow` interface + map step. |
| `app/api/bookings/route.ts:389-390` | `event_types!inner(...) accounts!inner(...)` | (route is admin-client; check normalization in file if relevant) | Cron path, unrelated to bookings page crash. |
| `lib/bookings/cancel.ts:89-90` | `event_types!inner(...) accounts!inner(...)` | (shared helper) | Different code path — cancel/reschedule, not list. |
| `lib/bookings/reschedule.ts:110-111` | Same as cancel | Same | Same — different path. |
| `app/cancel/[token]/_lib/resolve-cancel-token.ts:59-60` | `event_types!inner(...)` | Public-token path | Unrelated. |
| `app/reschedule/[token]/_lib/resolve-reschedule-token.ts:48-49` | `event_types!inner(...)` | Public-token path | Unrelated. |

**Key insight:** every site that normalizes does the SAME `Array.isArray(x) ? x[0] : x` pattern, but only `queries.ts` and `[id]/page.tsx` cast the result without checking for `undefined`. If the bug is generic to the pattern, it would manifest at any of those sites — but the bookings list page is the only one where many rows are processed in a loop and any single bad row crashes the whole render.

**Recommendation:** if Candidate B is confirmed, the right structural fix is to refactor the `BookingRow.event_types` type to `... | null`, filter null rows in the helper, and let the table render only the survivors. That makes the bug class impossible at the type level (CONTEXT decision: prefer this over a defensive `?? []` belt). Document the other potentially-fragile sites (load-month-bookings.ts:62, regenerate-reschedule-token.ts:55) in SUMMARY as deferred.

---

## Seeded Account Shapes (for SQL Editor diagnosis)

CONTEXT specifies six required-shape verifications. Mapping to actual seeded accounts and queries:

| Account / Shape | Slug or filter | Expected behavior on `/app/bookings` |
|---|---|---|
| Andrew's NSI prod account | `slug=nsi` | Renders all bookings |
| RLS test 2 | `slug=nsi-rls-test` (`TEST_OWNER_2_*` env) | Renders or "no bookings" |
| RLS test 3 | `slug=nsi-rls-test-3` (`TEST_OWNER_3_*` env) | Renders or "no bookings" |
| Empty bookings | Any account where `count(bookings) = 0` | Empty-state card (`bookings-table.tsx:42-50`) |
| Cancelled-only | All `bookings.status='cancelled'` | Empty for default `upcoming` filter; renders all when filter is `cancelled` |
| Many bookings (>50) | `count(bookings) > 50` for one account | Page 1 of 25 renders; pagination shows N pages |
| Mixed event types incl. soft-deleted | `bookings.event_type_id` references a row with `event_types.deleted_at IS NOT NULL` | `!inner` still matches (FK target exists), `eventName` falls back to `"(deleted event type)"` |

**SQL one-liner to find each shape:**

```sql
-- Empty bookings accounts
SELECT a.slug FROM accounts a
LEFT JOIN bookings b ON b.account_id = a.id
GROUP BY a.slug HAVING COUNT(b.id) = 0;

-- Cancelled-only accounts
SELECT a.slug FROM accounts a
JOIN bookings b ON b.account_id = a.id
GROUP BY a.slug
HAVING COUNT(*) FILTER (WHERE b.status = 'cancelled') = COUNT(*);

-- Many-booking accounts
SELECT a.slug, COUNT(b.id) AS n FROM accounts a
JOIN bookings b ON b.account_id = a.id
GROUP BY a.slug HAVING COUNT(b.id) > 50;

-- Bookings whose event_type is soft-deleted
SELECT b.id, b.account_id, et.deleted_at
FROM bookings b JOIN event_types et ON et.id = b.event_type_id
WHERE et.deleted_at IS NOT NULL;
```

Andrew runs these manually in Supabase SQL Editor and reports counts back, OR signs off that the seeded set already covers the shapes.

---

## Schema Facts (Relevant to Crash Hypotheses)

- `bookings.event_type_id uuid not null references event_types(id) on delete restrict` (initial_schema.sql:78) — hard delete is impossible while bookings exist; soft-delete (`deleted_at`) leaves the FK target intact, so `!inner` always finds a match at the FK level.
- `bookings.account_id` and `event_types.account_id` are independent denormalized references. If they drift out of sync, RLS-scoped reads can silently exclude joined rows.
- `bookings.booker_timezone text not null` — but DB-level `not null` does not prevent empty-string values. No CHECK constraint.
- `bookings.status` is a Postgres ENUM (`booking_status`); the table component's exhaustive switch covers all enum values.
- RLS policies on bookings + event_types are both `account_id in (select current_owner_account_ids())`. The function `current_owner_account_ids()` returns rows from `accounts` where `owner_user_id = auth.uid()`.

**Migration timeline:** the most recent migration touching the bookings render path was Phase 21's branding-column drop (2026-05-02), which only touched `accounts`. No bookings-table or event_types-table schema change has happened in the last few commits — so this is unlikely to be a fresh migration drift.

---

## Regression Test Pattern (One Test Only — CONTEXT Decision)

The canonical pattern is `tests/load-month-bookings.test.ts` — vitest + `@vitest-environment node` + structural mock of `@/lib/supabase/server` via `vi.mock`. No real DB. The test stubs the supabase chain and asserts the helper's output shape.

**Recommended new test file:** `tests/query-bookings.test.ts`

**Coverage (matches the candidate root cause once confirmed):**

- IF root cause is Candidate B (event_types `[]` from PostgREST): test that `queryBookings` correctly handles a fixture where one row's `event_types` is `[]` — should drop or null-fill that row, never throw, never produce an `event_types: undefined` in the output.
- IF root cause is Candidate C (bad timezone): test that `formatBookerStart` (or whatever fix is applied) handles `booker_timezone === ""` without throwing. (This may require exporting `formatBookerStart` for testability — currently it's a private function in the table component.)
- IF root cause is Candidate D (RLS data drift): a unit test cannot reproduce that — the regression test moves to the integration suite (`tests/rls-cross-tenant-matrix.test.ts` adjacent), or is replaced by a one-off SQL CHECK constraint as the "regression test" (data-integrity guarantee).

**Don't write the test until the root cause is confirmed.** A test that asserts the wrong shape locks in a fix to a problem that didn't exist.

---

## Common Pitfalls (Phase-Specific)

### Pitfall 1: V14-MP-04 — diagnostic-first, not assumption-first

- **What goes wrong:** Adding speculative null guards at `bookings-table.tsx:108` because the requirements line says so. The line is already optional-chained; the guard is a no-op and hides the real bug.
- **How to avoid:** Read the actual file before patching. Confirm root cause via Vercel logs + SQL Editor BEFORE proposing a fix. CONTEXT stop-condition: NO PR until repro + mechanism + working fix are all in hand.
- **Source:** PITFALLS.md V14-MP-04 (lines 214-224); CONTEXT.md "Reproduce-first protocol is non-negotiable."

### Pitfall 2: Stale line-number assumptions in REQUIREMENTS

- **What goes wrong:** REQUIREMENTS.md and ARCHITECTURE.md reference `bookings-table.tsx:108` as the duration access. As of HEAD, line 108 is `<Link href={...}>` inside the event-type cell; the duration access is line 67, and it's already guarded.
- **How to avoid:** Re-read source files before grounding plans. Don't trust line numbers in older planning docs.

### Pitfall 3: Treating PostgREST `!inner` as a null guarantee

- **What goes wrong:** Trusting that `event_types!inner` always produces a non-null joined object. supabase-js ts typings infer arrays even for `!inner`, AND PostgREST has historically returned empty arrays in schema-cache edge cases.
- **How to avoid:** Always normalize at the helper boundary. If the type allows null, the consumer must guard. If you want to assert non-null, do it via a runtime filter, not a type cast.

### Pitfall 4: Defensive `?? []` belts that hide future regressions

- **What goes wrong:** Adding `rows ?? []` or `event_types: et ?? { name: "", duration_minutes: 0 }` "to be safe" — papers over the actual bug, sets a precedent for the pattern across the codebase.
- **How to avoid:** CONTEXT says "Bias toward strict fixes (no dead `?? []` belts), but a single safety net at the page-component boundary is acceptable if it preserves a useful failure mode." A null-filter at the helper that filters bad rows and surfaces a count discrepancy is a useful failure mode. Silent zero-fill is not.

### Pitfall 5: Cross-account verification gap

- **What goes wrong:** Fix works for `nsi` but not `nsi-rls-test-3`. Different data shapes (different RLS state, different mix of soft-deleted event types) trigger different paths.
- **How to avoid:** CONTEXT verification table requires all three seeded accounts + four shape-coverage scenarios on production. Andrew live-verifies each and confirms in chat.

---

## Code Examples (Verified from Repo)

### A — How the existing normalization is structured (queries.ts:91-99)

```typescript
// Source: app/(shell)/app/bookings/_lib/queries.ts:88-99
// supabase-js join cardinality: event_types!inner returns either an object
// or a single-element array depending on schema-cache state. Defensively
// normalize to the object shape (matches Phase 5/6 lock).
const rows = (data ?? []).map((row) => {
  const et = Array.isArray(row.event_types)
    ? row.event_types[0]
    : row.event_types;
  return {
    ...row,
    event_types: et,    // ← `et` can be `undefined` if `row.event_types === []`
  };
}) as BookingRow[];     // ← cast lies; type says required but runtime can be undefined
```

### B — How a sibling helper handles the same pattern with optional-chaining only (load-month-bookings.ts:55-63)

```typescript
// Source: app/(shell)/app/_lib/load-month-bookings.ts:55-63
return (data ?? []).map((row: any) => ({
  id: row.id,
  start_at: row.start_at,
  // ...
  event_type: { name: row.event_types?.name ?? "" },   // safe; defaults name to ""
}));
```

### C — How the detail page normalizes both joined relations (bookings/[id]/page.tsx:50-55)

```typescript
// Source: app/(shell)/app/bookings/[id]/page.tsx:50-55
const eventType = Array.isArray(booking.event_types)
  ? booking.event_types[0]
  : booking.event_types;
const account = Array.isArray(booking.accounts)
  ? booking.accounts[0]
  : booking.accounts;
```

### D — The unguarded TZDate call inside the table (bookings-table.tsx:33-39)

```typescript
// Source: app/(shell)/app/bookings/_components/bookings-table.tsx:33-39
function formatBookerStart(row: BookingRow): string {
  const z = new TZDate(new Date(row.start_at), row.booker_timezone);
  // ↑ throws RangeError if booker_timezone is "" or invalid IANA string
  return format(z, "MMM d, yyyy 'at' h:mm a (zzz)");
}
```

### E — Existing test mock pattern for query helpers (load-month-bookings.test.ts)

```typescript
// Source: tests/load-month-bookings.test.ts:16-31
const mockGetClaims = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    from: mockFrom,
  })),
}));

import { loadMonthBookings } from "@/app/(shell)/app/_lib/load-month-bookings";
```

### F — Existing console.error convention (cron route)

```typescript
// Source: app/api/cron/send-reminders/route.ts:140-145
if (scanErr) {
  console.error("[cron/send-reminders] scan error", scanErr);
  return Response.json(
    { ok: false, error: "scan_failed" },
    { status: 500, headers: NO_STORE },
  );
}
```

---

## Open Questions (Cannot Be Answered Without Live Data)

1. **What does the actual stack trace look like?**
   - What we know: phase blocked until Andrew supplies Vercel logs.
   - What's unclear: which of Candidates A–E is the actual culprit.
   - Recommendation: planner builds Step 1 of Plan-01 around "ask Andrew for logs," and gates all subsequent tasks on the answer.

2. **Does `event_types!inner` actually return `[]` or `null` for any row in the failing account?**
   - What we know: theoretically possible per PostgREST behavior + ARCHITECTURE.md hypothesis.
   - What's unclear: whether it happens in practice for the seeded accounts.
   - Recommendation: SQL Editor query in Step 2 of Plan-01 confirms before any fix is written.

3. **Is the `nsi-rls-test-3` account fully seeded with test bookings, or is it empty?**
   - What we know: env vars exist (`TEST_OWNER_3_*`) per `tests/rls-cross-tenant-matrix.test.ts:64-68`. Phase 10 Plan 10-09 set it up.
   - What's unclear: current row counts for each shape.
   - Recommendation: Andrew runs the SQL one-liners in §"Seeded Account Shapes" and reports counts back; if a shape is missing, seed it before verification.

4. **Is there an `error.tsx` precedent that should be followed, or is "let it throw" the established pattern?**
   - What we know: NO `error.tsx` files exist anywhere in the repo. `app/(shell)/app/page.tsx:34` uses `throw new Error(...)` directly. `notFound()` is used for 404 cases.
   - What's unclear: whether CONTEXT's "loud-failure bias + don't show raw stack to contractors" is satisfied by the framework default, or requires a new boundary.
   - Recommendation: defer to fix-shape — if root cause is data/schema, no boundary needed; if root cause is "occasional RLS race," add a minimal `error.tsx` with `console.error` + a simple "Bookings page failed to load — please refresh" message.

---

## Sources

### Primary (HIGH confidence — direct code reading)

- `app/(shell)/app/bookings/_lib/queries.ts` (lines 1-117) — suspect file, full read
- `app/(shell)/app/bookings/_components/bookings-table.tsx` (lines 1-138) — table consumer, full read
- `app/(shell)/app/bookings/page.tsx` (lines 1-83) — Server Component, full read
- `app/(shell)/app/bookings/[id]/page.tsx` (lines 1-269) — sibling page using same join pattern
- `app/(shell)/app/_lib/load-month-bookings.ts` (lines 1-64) — adjacent helper for pattern compare
- `supabase/migrations/20260419120000_initial_schema.sql` — bookings/event_types schema
- `supabase/migrations/20260419120001_rls_policies.sql` — RLS policies
- `tests/load-month-bookings.test.ts` (lines 1-60) — regression-test pattern
- `tests/helpers/booking-fixtures.ts` — fixture creation helper
- `tests/rls-cross-tenant-matrix.test.ts` (lines 1-80) — N=3 owner test scaffolding

### Primary (HIGH confidence — planning docs)

- `.planning/research/PITFALLS.md` lines 214-224 — V14-MP-04 (diagnostic-first protocol)
- `.planning/research/ARCHITECTURE.md` lines 243-248 — bookings page crash debug start point
- `.planning/REQUIREMENTS.md` line 24 — BOOK-01 description
- `.planning/phases/26-bookings-page-crash-debug-fix/26-CONTEXT.md` — full phase context

### Secondary (MEDIUM confidence — observed but not exhaustively cross-checked)

- supabase-js `!inner` join cardinality behavior — based on existing code comments at multiple sites that all defensively normalize array-or-object. No external doc fetched (Context7 / Supabase docs not consulted, since the in-repo evidence is strong and consistent).

### Tertiary (LOW confidence — speculative without log data)

- Ranking of Candidates A–E — assigned by code-architectural plausibility, not by log evidence.

---

## Metadata

**Confidence breakdown:**

- Render-path mapping: HIGH — direct code read of every file in the path
- Candidate enumeration: HIGH — each candidate is grounded in a specific code line
- Root-cause attribution: MEDIUM — pending Vercel log evidence; will be HIGH after Step 1 of Plan-01
- Grep audit completeness: HIGH — exhaustive `!inner` search across `**/*.{ts,tsx}` performed
- Seeded-account data shapes: MEDIUM — inferred from CONTEXT and tests; Andrew confirmation needed for live counts

**Research date:** 2026-05-03
**Valid until:** until the bookings page render path or schema is touched. The line-numbered claims above will rot if files are edited; the grep audit and schema facts are stable.
