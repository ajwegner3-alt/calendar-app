import { describe, it, expect } from "vitest";
import {
  backgroundColorSchema,
  backgroundShadeSchema,
  brandingBackgroundSchema,
} from "@/app/(shell)/app/branding/_lib/schema";

describe("backgroundColorSchema", () => {
  it("accepts a valid lowercase hex", () => {
    const result = backgroundColorSchema.safeParse("#0a2540");
    expect(result.success).toBe(true);
  });

  it("accepts a valid uppercase hex", () => {
    const result = backgroundColorSchema.safeParse("#F97316");
    expect(result.success).toBe(true);
  });

  it("accepts null (clears the column)", () => {
    const result = backgroundColorSchema.safeParse(null);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("accepts undefined (field omitted)", () => {
    const result = backgroundColorSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it("rejects hex without leading #", () => {
    const result = backgroundColorSchema.safeParse("0A2540");
    expect(result.success).toBe(false);
  });

  it("rejects short hex", () => {
    const result = backgroundColorSchema.safeParse("#FFF");
    expect(result.success).toBe(false);
  });

  it("rejects 8-digit hex (alpha not supported)", () => {
    const result = backgroundColorSchema.safeParse("#0A254000");
    expect(result.success).toBe(false);
  });

  it("rejects non-hex characters", () => {
    const result = backgroundColorSchema.safeParse("#GGHHII");
    expect(result.success).toBe(false);
  });
});

describe("backgroundShadeSchema", () => {
  it("accepts none", () => {
    const result = backgroundShadeSchema.safeParse("none");
    expect(result.success).toBe(true);
    expect(result.data).toBe("none");
  });

  it("accepts subtle", () => {
    const result = backgroundShadeSchema.safeParse("subtle");
    expect(result.success).toBe(true);
    expect(result.data).toBe("subtle");
  });

  it("accepts bold", () => {
    const result = backgroundShadeSchema.safeParse("bold");
    expect(result.success).toBe(true);
    expect(result.data).toBe("bold");
  });

  it("defaults to subtle when undefined", () => {
    const result = backgroundShadeSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    expect(result.data).toBe("subtle");
  });

  it("rejects invalid shade", () => {
    const result = backgroundShadeSchema.safeParse("medium");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = backgroundShadeSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("brandingBackgroundSchema", () => {
  it("accepts valid color + shade", () => {
    const result = brandingBackgroundSchema.safeParse({
      background_color: "#3B82F6",
      background_shade: "bold",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null color with default shade", () => {
    const result = brandingBackgroundSchema.safeParse({
      background_color: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.background_shade).toBe("subtle");
    }
  });

  it("rejects invalid color", () => {
    const result = brandingBackgroundSchema.safeParse({
      background_color: "not-a-color",
      background_shade: "subtle",
    });
    expect(result.success).toBe(false);
  });
});
