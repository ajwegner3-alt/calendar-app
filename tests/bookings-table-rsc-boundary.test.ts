// @vitest-environment node

/**
 * Regression: Phase 26 - RSC boundary violation crash (digest 2914592434).
 *
 * bookings-table.tsx is a Server Component (no "use client" directive).
 * Passing onClick (or any function prop) to an intrinsic HTML element causes
 * Next.js RSC payload serialization to throw before render, producing the
 * visible error "ERROR 2914592434" for any account whose bookings include a
 * non-null booker_phone.
 *
 * The fix: deleted `onClick={(e) => e.stopPropagation()}` from the
 * <a href="tel:..."> element. The stopPropagation was dead code — browsers
 * always follow the deepest anchor's href, so row navigation was never
 * triggered by phone taps anyway.
 *
 * This test reads the source file as text and asserts that no `onClick`
 * attribute appears in the tel: anchor block of bookings-table.tsx.
 *
 * If a future refactor converts BookingsTable to a Client Component, this
 * test will fail (the regex won't find the RSC-unsafe pattern anymore since
 * onClick is legal in Client Components) — update or remove the test at that
 * point, with a comment explaining why the constraint no longer applies.
 *
 * To verify this test catches the regression:
 *   git stash                  → reverts the fix
 *   npx vitest run tests/bookings-table-rsc-boundary.test.ts  → FAILS
 *   git stash pop              → restores the fix
 *   npx vitest run tests/bookings-table-rsc-boundary.test.ts  → PASSES
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const BOOKINGS_TABLE_PATH = path.resolve(
  __dirname,
  "../app/(shell)/app/bookings/_components/bookings-table.tsx",
);

describe("bookings-table RSC boundary — tel: anchor must not have function props", () => {
  it("bookings-table.tsx has no 'use client' directive (confirming it is a Server Component)", () => {
    const source = fs.readFileSync(BOOKINGS_TABLE_PATH, "utf-8");
    // If someone adds "use client" in the future, this test should be revisited:
    // a Client Component CAN have onClick, so the RSC constraint no longer applies.
    expect(source).not.toMatch(/['"]use client['"]/);
  });

  it("tel: anchor in bookings-table.tsx does not contain an onClick prop (RSC boundary safe)", () => {
    const source = fs.readFileSync(BOOKINGS_TABLE_PATH, "utf-8");

    // Isolate the tel: anchor block: everything between the opening <a href={`tel: and its closing </a>
    const telAnchorMatch = source.match(/<a\s[^>]*href=\{`tel:[^`]*`\}[\s\S]*?<\/a>/);

    expect(telAnchorMatch).not.toBeNull();

    const telAnchorBlock = telAnchorMatch![0];

    // Assert: no onClick attribute exists anywhere in the tel: anchor element.
    // This is the exact RSC boundary violation that caused digest 2914592434.
    expect(telAnchorBlock).not.toMatch(/onClick\s*=/);
  });
});
