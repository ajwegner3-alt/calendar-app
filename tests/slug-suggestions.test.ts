import { describe, it, expect } from "vitest";
import { suggestSlugAlternatives } from "@/lib/slug-suggestions";

describe("suggestSlugAlternatives", () => {
  it("generates 3 alternatives for a normal base + email", () => {
    const result = suggestSlugAlternatives("acme", "andrew@example.com");
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("acme-2");
    expect(result[1]).toBe("acme-andrew");
    expect(result[2]).toBe("acme-bookings");
  });

  it("uses -3 as candidate 2 when email prefix equals base", () => {
    // email prefix "acme" == base "acme" → falls back to acme-3
    const result = suggestSlugAlternatives("acme", "acme@domain.com");
    expect(result[1]).toBe("acme-3");
  });

  it("lowercases and strips caps from base", () => {
    // base passed in should already be kebab, but function is defensive
    const result = suggestSlugAlternatives("acme-hvac", "Bob@Example.com");
    expect(result[0]).toBe("acme-hvac-2");
    expect(result[1]).toBe("acme-hvac-bob");
    expect(result[2]).toBe("acme-hvac-bookings");
  });

  it("handles email with no @ (empty prefix) by using -3 fallback", () => {
    const result = suggestSlugAlternatives("test-slug", "no-at-sign");
    // emailPrefix will be the full string toSlug'd; it won't equal base
    // so candidate 2 = "test-slug-no-at-sign"
    expect(result[0]).toBe("test-slug-2");
    expect(result[2]).toBe("test-slug-bookings");
    expect(result).toHaveLength(3);
  });

  it("truncates long base + suffix combinations to 40 chars", () => {
    const longBase = "a".repeat(35); // 35 chars
    const result = suggestSlugAlternatives(longBase, "user@example.com");
    for (const s of result) {
      expect(s.length).toBeLessThanOrEqual(40);
      expect(/^[a-z0-9-]{3,40}$/.test(s)).toBe(true);
    }
  });

  it("filters out invalid slugs (< 3 chars)", () => {
    // base "ab" + "-2" = "ab-2" (4 chars, valid)
    const result = suggestSlugAlternatives("ab", "x@y.com");
    for (const s of result) {
      expect(/^[a-z0-9-]{3,40}$/.test(s)).toBe(true);
    }
  });

  it("handles base with special characters (already toSlug'd input)", () => {
    const result = suggestSlugAlternatives("north-star", "nsi@northstar.com");
    expect(result[0]).toBe("north-star-2");
    expect(result[1]).toBe("north-star-nsi");
    expect(result[2]).toBe("north-star-bookings");
  });
});
