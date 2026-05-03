# Phase 26 Diagnosis

**Diagnosed:** 2026-05-03
**Status:** confirmed

## Stack Trace

```
Error: Event handlers cannot be passed to Client Component props.
  {href: ..., className: ..., onClick: function onClick, children: ...}
                                       ^^^^^^^^^^^^^^^^
If you need interactivity, consider converting part of this to a Client Component.
    at stringify (<anonymous>) {
  digest: '2914592434'
}
```

Visible to user: `ERROR 2914592434`

## Failing Account(s)

- Slug: nsi
- Other accounts likely affected: all — this is a code-path bug, not a data-shape bug. Every account with at least one booking where `booker_phone` is non-null will trigger the crash. Accounts with zero non-null phone bookings will not crash but are equally "affected" in that the file is broken.

## Reproduction

Visit `/app/bookings` while signed in as any owner whose account has at least one booking with a non-null `booker_phone`. The Next.js RSC serializer rejects the render tree during RSC payload generation — reproducible 100% on current production, regardless of booking data shape. No SQL query needed to reproduce; the bug is in the component tree, not the database.

Deterministic trigger:
1. Sign in as any owner (e.g., slug `nsi`).
2. Navigate to `/app/bookings`.
3. Server returns `ERROR 2914592434` immediately, before any row is rendered.

Root condition: `booker_phone` must be non-null in at least one booking row returned by `queryBookings`. If all bookings have `booker_phone = null`, the `<a onClick>` branch is never reached and the page renders (the `?: null` guard at `bookings-table.tsx:90-98` is the conditional that protects the null path, not the crash path).

## Mechanism

`bookings-table.tsx` is a Server Component (no `"use client"` directive) that renders `<a href="tel:..." className="hover:underline" onClick={(e) => e.stopPropagation()}>` at line 93; Next.js's RSC payload serializer (`stringify`) cannot serialize the `onClick` function prop across the Server→Client boundary and throws `digest: 2914592434` before any HTML reaches the browser.

## Matched Candidate

NEW — RSC boundary violation. Not Candidates A through E from `26-RESEARCH.md` (those were all data-layer hypotheses). The original RESEARCH ranking is invalidated by this evidence. No database query is malformed, no data shape is corrupted, no RLS rule is misfiring.

## Proposed Fix Shape

**File:** `app/(shell)/app/bookings/_components/bookings-table.tsx`
**Line:** 93
**Change type:** Remove `onClick` prop from `<a>` element

The `onClick={(e) => e.stopPropagation()}` on the `<a href="tel:...">` was intended to prevent row-click navigation when tapping a phone number link. The fix is to remove that handler entirely.

The stop-propagation intent is not needed: the `<a href="tel:...">` nests inside a `<Link>` (lines 85-100), but native browser behavior already handles this correctly — clicking a child `<a>` does not trigger the parent `<Link>`'s navigation because the browser follows the innermost anchor's `href`. The `stopPropagation` was defensive noise, not functional necessity.

Surgical change: delete lines 93 `onClick={(e) => e.stopPropagation()}` from `bookings-table.tsx`.

**No other files need modification.** The `<a>` element remains; only the function prop is removed.

Risk: **low**
Reason: Removing a `stopPropagation` call from an `<a>` that is already behaviorally isolated by its own `href="tel:..."` — browsers follow the deepest anchor, so row navigation was never triggered by phone taps anyway. Zero type changes, zero consumer impact, zero schema changes.

## Regression Timeline

The `onClick` was present since the initial commit of this file — `52ea36d feat(08-06): bookings table with status badges and row links` (2026-04-26). The bookings list page has never successfully rendered for accounts with phone-bearing bookings. Accounts with zero phone bookings would have seen the page work, masking the bug during early development.

## Deferred Findings (for Plan 02 SUMMARY, do not fix)

These fragility sites were observed during the prior pre-read. They are not the cause of the current crash but are real risks for future phases:

1. **Candidate C risk — unguarded `TZDate` at `bookings-table.tsx:37`**
   `new TZDate(new Date(row.start_at), row.booker_timezone)` will throw a `RangeError` if `booker_timezone` is null, empty string, or an invalid IANA identifier. Currently masked because the page never reaches render (RSC crash fires first). Once Plan 02 fixes the RSC crash, this line becomes a live crash risk for any booking with a bad timezone value. Flag for Phase 27 follow-up or add a defensive fallback in Plan 02 as a secondary fix.

2. **Candidate B risk — normalization yields undefined at `queries.ts:92-94`**
   The `queryBookings` normalization step returns `undefined` for `event_types` when the join returns an empty array (`[]`). Downstream, `bookings-table.tsx:66-67` already uses optional chaining (`row.event_types?.name`, `row.event_types?.duration_minutes`) so this is safe today. If any future consumer adds a direct deref, it will crash. Low immediate risk; note for housekeeping.

3. **Candidate A risk — `if (error) throw error` at `queries.ts:86`**
   Unguarded Supabase error rethrow with no try/catch at `page.tsx:46` (`Promise.all`). A PostgREST error (RLS misconfiguration, schema drift, network timeout) will produce an unhandled rejection and a generic 500. Not the current crash, but worth wrapping in Plan 02 or 27.

## Andrew Confirmation

_(empty — fill after Task 3 checkpoint)_
