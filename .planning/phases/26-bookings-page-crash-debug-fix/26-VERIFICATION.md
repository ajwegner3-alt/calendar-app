---
phase: 26-bookings-page-crash-debug-fix
verified_at: 2026-05-03T00:00:00Z
status: passed
must_haves_verified: 3/3
---

# Phase 26 Verification

## Phase Goal

Identify and fix the root cause of the `/app/bookings` page crash so the page renders for all seeded production accounts.

---

## Must-Have Verification

### Criterion 1: /app/bookings loads for NSI on production

- **Source check:** `bookings-table.tsx` at the `<a href="tel:...">` element (lines 90-95 in current file) contains NO `onClick` prop. The git diff for commit `8e3116b` shows exactly one line deleted: `onClick={(e) => e.stopPropagation()}`. No other changes in the file. The element now has only `href` and `className`. Confirmed clean.
- **Commit check:** `8e3116b` is present on `main` (confirmed via `git log --oneline -20`). Fix is on HEAD.
- **Andrew confirmation:** 26-SUMMARY.md verification matrix records Shape 1 — NSI (`nsi`), real bookings with non-null phones, result: **PASS**. Andrew sign-off recorded: "Everything looks good." — 2026-05-03.
- **Status:** VERIFIED

---

### Criterion 2: Loads for all three seeded accounts

Per the 26-SUMMARY.md verification matrix (verified by Andrew, live production browser, 2026-05-03):

| Account | Shape | Condition | Result |
|---------|-------|-----------|--------|
| NSI (`nsi`) | Shape 1 | Real bookings with non-null phones | PASS |
| nsi-rls-test | Shape 2 | Empty account (no bookings) | PASS |
| nsi-rls-test-3 | Shape 3 | Empty account (no bookings) | PASS |

All three required accounts passed. Shapes 5-7 were waived (no production data exists for those shapes — zero rows returned by SQL queries). Waivers are legitimate: the crash is triggered by non-null `booker_phone` rows, and the fix is unconditional (single-line deletion from source); account-specific data shape only affected whether the crash was previously observable, not whether the fix is correct.

- **Status:** VERIFIED

---

### Criterion 3: Root cause documented (not speculative)

Evidence in 26-DIAGNOSIS.md:

1. **Stack trace is real:** Digest `2914592434` is explicitly quoted in the stack trace block (`Error: Event handlers cannot be passed to Client Component props. [...] digest: '2914592434'`). This is the Vercel log error, not an inference.
2. **Mechanism is named:** RSC boundary violation — `bookings-table.tsx` has no `"use client"` directive; `onClick` function prop on an intrinsic `<a>` element cannot be serialized by Next.js's RSC payload serializer.
3. **File and line are named:** `bookings-table.tsx` line 93, prop `onClick={(e) => e.stopPropagation()}`.
4. **Prop-shape match confirmed:** The diagnosis explicitly matches the error message prop shape (`{href: ..., className: ..., onClick: function onClick, children: ...}`) to the actual code at lines 85-99. Not speculative — the prop list matches the element's attributes exactly.
5. **Original research candidates A-E invalidated:** DIAGNOSIS.md explicitly states all five data-layer hypotheses from RESEARCH.md are ruled out by the Vercel log evidence.
6. **Andrew confirmed diagnosis** before any fix was written (commit `8cbfca9` records the confirmation; this commit is dated 2026-05-03 and precedes fix commit `8e3116b` by 4 minutes of commit ordering).

- **Status:** VERIFIED

---

## Pitfall Check (V14-MP-04 — Diagnostic-First Protocol)

**Ordering check (no speculative fix before confirmed diagnosis):**

Git log from diagnosis commit to fix commit:
```
ed7eb22  docs(26-01): write bookings crash diagnosis
8cbfca9  docs(26-01): andrew confirms bookings crash diagnosis   ← confirmation recorded
2214f5d  docs(26-01): complete diagnose-bookings-crash plan
8e3116b  fix(26-02): remove onClick from tel-link ...            ← fix written AFTER
```

DIAGNOSIS.md was written (`ed7eb22`), Andrew confirmed (`8cbfca9`), plan closed (`2214f5d`), and only then was the source-code fix applied (`8e3116b`). Correct ordering. No source code was modified during the diagnosis plan.

**No speculative guards check:**

`git show 8e3116b -- 'app/(shell)/app/bookings/_components/bookings-table.tsx'` shows exactly one deleted line:
```
-                        onClick={(e) => e.stopPropagation()}
```

No null guards (`?? []`, `?? null`), no optional chains added, no `try/catch` introduced, no new imports, no added conditions. Deletion only. Scope held perfectly.

**Deferred findings not touched:**

`git diff 3945960..HEAD -- 'app/(shell)/app/bookings/_lib/queries.ts' 'app/(shell)/app/bookings/page.tsx'` produced no output — zero changes to either deferred file. The TZDate guard at bookings-table.tsx:37, queries.ts normalization, and queries.ts:86 throw were correctly left untouched.

- **Status:** VERIFIED (protocol honored cleanly)

---

## Scope Check

**Source commits in phase window** (`git log 3945960..HEAD --all -- 'app/' 'lib/' 'tests/'`):
```
359f4f1  test(26-02): add regression test for rsc boundary violation in bookings table
8e3116b  fix(26-02): remove onClick from tel-link in bookings table to fix rsc serialization crash
```

Exactly two source commits. `git diff --stat 3945960..HEAD -- 'app/' 'lib/' 'tests/'`:
```
app/(shell)/app/bookings/_components/bookings-table.tsx  |  1 -
tests/bookings-table-rsc-boundary.test.ts               | 63 +++
2 files changed, 63 insertions(+), 1 deletion(-)
```

This matches the declared scope precisely:
- `bookings-table.tsx` — 1 line deleted (the `onClick` prop)
- `tests/bookings-table-rsc-boundary.test.ts` — new file, 63 lines

No `lib/`, `app/api/`, or any other source directory was touched.

**Out-of-scope leak:** None.

- **Status:** VERIFIED

---

## Regression Test Assessment

`tests/bookings-table-rsc-boundary.test.ts` (63 lines, 2 test cases):

1. Asserts `bookings-table.tsx` has no `"use client"` directive — confirms the RSC constraint premise is still valid.
2. Regex-isolates the `<a href="tel:...">` block and asserts `onClick=` does not appear within it — directly guards against re-introduction of the crash.

Test design is sound: zero new runtime dependencies (reads source as `fs.readFileSync` text), catches exactly the regression class, includes a comment explaining the "if converted to Client Component, update this test" escape hatch. The test file path resolves correctly relative to the `__dirname` anchor.

---

## Final Status

**PASSED**

All three success criteria verified against actual codebase state. V14-MP-04 pitfall check confirms diagnostic-first ordering was honored and fix scope was held to exactly the named deletion. Andrew sign-off recorded in 26-SUMMARY.md for all three required production accounts. No gaps found.

---

## Notes for Phase 27

Three fragility sites were intentionally deferred (correct per V14-MP-04). These are real risks now that the RSC crash is removed — the TZDate guard in particular was previously masked by the crash firing first:

1. **bookings-table.tsx:37** — `new TZDate(new Date(row.start_at), row.booker_timezone)` throws `RangeError` if `booker_timezone` is null, empty, or invalid IANA. Now a live crash risk for any booking with a bad timezone value.
2. **queries.ts:92-94** — normalization returns `undefined` when event_types join returns `[]`. Safe today due to downstream optional chaining; track for future consumers.
3. **queries.ts:86** — `if (error) throw error` with no try/catch at page.tsx:46. PostgREST errors produce unhandled rejections → generic 500.

These should be addressed in a Phase 27 hardening plan.

---

*Verified: 2026-05-03*
*Verifier: Claude (gsd-verifier)*
