import { describe, it, expect } from "vitest";
import { chromeTintToCss, chromeTintTextColor } from "@/lib/branding/chrome-tint";

describe("chromeTintToCss", () => {
  describe("returns null for intensity='none'", () => {
    it("none + sidebar → null", () => {
      expect(chromeTintToCss("#0A2540", "none", "sidebar")).toBeNull();
    });

    it("none + page → null", () => {
      expect(chromeTintToCss("#0A2540", "none", "page")).toBeNull();
    });
  });

  describe("returns null when color is null", () => {
    it("null color + subtle + sidebar → null", () => {
      expect(chromeTintToCss(null, "subtle", "sidebar")).toBeNull();
    });

    it("null color + full + sidebar → null", () => {
      expect(chromeTintToCss(null, "full", "sidebar")).toBeNull();
    });

    it("null color + none + page → null", () => {
      expect(chromeTintToCss(null, "none", "page")).toBeNull();
    });

    it("null color + full + page → null", () => {
      expect(chromeTintToCss(null, "full", "page")).toBeNull();
    });
  });

  describe("sidebar surface percentages", () => {
    it("subtle + sidebar → 6%", () => {
      expect(chromeTintToCss("#0A2540", "subtle", "sidebar")).toBe(
        "color-mix(in oklch, #0A2540 6%, white)",
      );
    });

    it("full + sidebar → 14%", () => {
      expect(chromeTintToCss("#0A2540", "full", "sidebar")).toBe(
        "color-mix(in oklch, #0A2540 14%, white)",
      );
    });
  });

  describe("page surface percentages", () => {
    it("subtle + page → 3%", () => {
      expect(chromeTintToCss("#0A2540", "subtle", "page")).toBe(
        "color-mix(in oklch, #0A2540 3%, white)",
      );
    });

    it("full + page → 8%", () => {
      expect(chromeTintToCss("#0A2540", "full", "page")).toBe(
        "color-mix(in oklch, #0A2540 8%, white)",
      );
    });
  });

  describe("works with different brand colors", () => {
    it("blue brand color + full + sidebar → 14%", () => {
      expect(chromeTintToCss("#3B82F6", "full", "sidebar")).toBe(
        "color-mix(in oklch, #3B82F6 14%, white)",
      );
    });
  });
});

describe("chromeTintTextColor", () => {
  it("returns null when color is null", () => {
    expect(chromeTintTextColor(null, "full", "sidebar")).toBeNull();
  });

  it("returns null when intensity is none", () => {
    expect(chromeTintTextColor("#0A2540", "none", "sidebar")).toBeNull();
  });

  it("dark navy at full sidebar intensity → white text (dark color = high contrast = white text)", () => {
    // pickTextColor('#0A2540') = '#ffffff' because the original color is very dark.
    // At 14% mix into white the surface is light, but conservative approach uses original color luminance.
    expect(chromeTintTextColor("#0A2540", "full", "sidebar")).toBe("#ffffff");
  });

  it("light gray brand color + full sidebar → black text", () => {
    // #F8FAFC (gray-50) is very light → pickTextColor returns black
    expect(chromeTintTextColor("#F8FAFC", "full", "sidebar")).toBe("#000000");
  });
});
