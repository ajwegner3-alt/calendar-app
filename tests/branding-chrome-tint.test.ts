import { describe, it, expect } from "vitest";
import { chromeTintToCss, chromeTintTextColor, resolveChromeColors } from "@/lib/branding/chrome-tint";
import type { Branding } from "@/lib/branding/types";

// ---------------------------------------------------------------------------
// Shared Branding fixture helpers
// ---------------------------------------------------------------------------

/** Build a minimal Branding object with sensible defaults for testing. */
function makeBranding(overrides: Partial<Branding> = {}): Branding {
  return {
    logoUrl: null,
    primaryColor: "#0A2540",
    textColor: "#ffffff",
    backgroundColor: null,
    backgroundShade: "subtle",
    chromeTintIntensity: "subtle",
    sidebarColor: null,
    ...overrides,
  };
}

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

// ---------------------------------------------------------------------------
// Phase 12.6 tests
// ---------------------------------------------------------------------------

describe("resolveChromeColors", () => {
  describe("sidebarColor field", () => {
    it("with sidebarColor=#0A2540: sidebarColor=#0A2540", () => {
      const result = resolveChromeColors(makeBranding({ sidebarColor: "#0A2540" }));
      expect(result.sidebarColor).toBe("#0A2540");
    });

    it("with sidebarColor=#0A2540: sidebarTextColor=#ffffff (dark bg → white text)", () => {
      const result = resolveChromeColors(makeBranding({ sidebarColor: "#0A2540" }));
      expect(result.sidebarTextColor).toBe("#ffffff");
    });

    it("with sidebarColor=null: sidebarColor=null", () => {
      const result = resolveChromeColors(makeBranding({ sidebarColor: null }));
      expect(result.sidebarColor).toBeNull();
    });

    it("with sidebarColor=null: sidebarTextColor=null", () => {
      const result = resolveChromeColors(makeBranding({ sidebarColor: null }));
      expect(result.sidebarTextColor).toBeNull();
    });

    it("light sidebar color → black text (auto-WCAG flip)", () => {
      // #F8FAFC is very light → pickTextColor returns black
      const result = resolveChromeColors(makeBranding({ sidebarColor: "#F8FAFC" }));
      expect(result.sidebarTextColor).toBe("#000000");
    });
  });

  describe("pageColor field", () => {
    it("with backgroundColor=#F8FAFC: pageColor=#F8FAFC", () => {
      const result = resolveChromeColors(makeBranding({ backgroundColor: "#F8FAFC" }));
      expect(result.pageColor).toBe("#F8FAFC");
    });

    it("with backgroundColor=null: pageColor=null", () => {
      const result = resolveChromeColors(makeBranding({ backgroundColor: null }));
      expect(result.pageColor).toBeNull();
    });
  });

  describe("primaryColor field", () => {
    it("primaryColor always returns the Branding.primaryColor string", () => {
      const result = resolveChromeColors(makeBranding({ primaryColor: "#3B82F6" }));
      expect(result.primaryColor).toBe("#3B82F6");
    });

    it("default primaryColor (#0A2540) is returned when no override", () => {
      const result = resolveChromeColors(makeBranding());
      expect(result.primaryColor).toBe("#0A2540");
    });

    it("dark primary color → primaryTextColor=#ffffff", () => {
      const result = resolveChromeColors(makeBranding({ primaryColor: "#0A2540" }));
      expect(result.primaryTextColor).toBe("#ffffff");
    });

    it("light primary color → primaryTextColor=#000000", () => {
      // #F8FAFC is very light → pickTextColor returns black
      const result = resolveChromeColors(makeBranding({ primaryColor: "#F8FAFC" }));
      expect(result.primaryTextColor).toBe("#000000");
    });
  });

  describe("all-null branding (full defaults path)", () => {
    it("null sidebar + null page → all color outputs null except primaryColor", () => {
      const result = resolveChromeColors(makeBranding({ sidebarColor: null, backgroundColor: null }));
      expect(result.sidebarColor).toBeNull();
      expect(result.sidebarTextColor).toBeNull();
      expect(result.pageColor).toBeNull();
      expect(result.primaryColor).toBe("#0A2540");
      expect(result.primaryTextColor).toBe("#ffffff");
    });
  });
});
