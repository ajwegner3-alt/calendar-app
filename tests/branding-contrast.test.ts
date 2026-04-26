import { describe, expect, it } from "vitest";
import { pickTextColor, relativeLuminance } from "@/lib/branding/contrast";

describe("relativeLuminance", () => {
  it("returns ~1.0 for white (#ffffff)", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1.0, 3);
  });

  it("returns exactly 0 for black (#000000)", () => {
    expect(relativeLuminance("#000000")).toBe(0);
  });
});

describe("pickTextColor", () => {
  it("returns #000000 (black) for white background", () => {
    // White is maximally light — black text gives best contrast
    expect(pickTextColor("#ffffff")).toBe("#000000");
  });

  it("returns #ffffff (white) for black background", () => {
    // Black is maximally dark — white text gives best contrast
    expect(pickTextColor("#000000")).toBe("#ffffff");
  });

  it("returns #ffffff for NSI navy (#0A2540 — very dark)", () => {
    // R=10, G=37, B=64 → very low luminance → white text wins
    expect(pickTextColor("#0A2540")).toBe("#ffffff");
  });

  it("returns #000000 for NSI orange (#F97316 — light enough for black text)", () => {
    // Per W3C formula: #F97316 has high luminance → black text wins
    expect(pickTextColor("#F97316")).toBe("#000000");
  });

  it("returns a valid color for mid-gray boundary (#777777)", () => {
    // #777777 is near the WCAG gray boundary; spec doesn't dictate which wins.
    // Assert only that the result is one of the two valid values.
    const result = pickTextColor("#777777");
    expect(["#ffffff", "#000000"]).toContain(result);
  });

  it("does not throw for malformed input and returns a valid color", () => {
    // Defensive — Zod gates upstream, but this helper should never throw.
    expect(() => pickTextColor("#bad-input")).not.toThrow();
    const result = pickTextColor("#bad-input");
    expect(["#ffffff", "#000000"]).toContain(result);
  });

  it("does not throw for empty string and returns a valid color", () => {
    expect(() => pickTextColor("")).not.toThrow();
    const result = pickTextColor("");
    expect(["#ffffff", "#000000"]).toContain(result);
  });
});
