import { describe, it, expect } from "vitest";
import { shadeToGradient } from "@/lib/branding/gradient";

describe("shadeToGradient", () => {
  describe("shade=none", () => {
    it("returns flat tint with the given color", () => {
      const plan = shadeToGradient("#0A2540", "none");
      expect(plan.shade).toBe("none");
      expect(plan.flatTint).toBe("color-mix(in oklch, #0A2540 4%, white)");
      expect(plan.circles).toHaveLength(0);
    });

    it("uses gray-50 fallback when color is null", () => {
      const plan = shadeToGradient(null, "none");
      expect(plan.shade).toBe("none");
      expect(plan.flatTint).toBe("color-mix(in oklch, #F8FAFC 4%, white)");
      expect(plan.circles).toHaveLength(0);
    });
  });

  describe("shade=subtle", () => {
    it("returns 3 circles with low opacity and large blur", () => {
      const plan = shadeToGradient("#3B82F6", "subtle");
      expect(plan.shade).toBe("subtle");
      expect(plan.flatTint).toBeNull();
      expect(plan.circles).toHaveLength(3);
      for (const c of plan.circles) {
        expect(c.opacity).toBe(0.25);
        expect(c.blurPx).toBe(200);
      }
    });

    it("uses gray-50 fallback when color is null", () => {
      const plan = shadeToGradient(null, "subtle");
      expect(plan.circles[0].backgroundImage).toContain("#F8FAFC");
    });

    it("first circle gradient goes to transparent", () => {
      const plan = shadeToGradient("#0A2540", "subtle");
      expect(plan.circles[0].backgroundImage).toBe(
        "linear-gradient(to top right, #0A2540, transparent)",
      );
    });

    it("second and third circles gradient goes to dark slate", () => {
      const plan = shadeToGradient("#0A2540", "subtle");
      expect(plan.circles[1].backgroundImage).toBe(
        "linear-gradient(to top right, #0A2540, #0F172A)",
      );
      expect(plan.circles[2].backgroundImage).toBe(
        "linear-gradient(to top right, #0A2540, #0F172A)",
      );
    });
  });

  describe("shade=bold", () => {
    it("returns 3 circles with higher opacity and smaller blur", () => {
      const plan = shadeToGradient("#F97316", "bold");
      expect(plan.shade).toBe("bold");
      expect(plan.flatTint).toBeNull();
      expect(plan.circles).toHaveLength(3);
      for (const c of plan.circles) {
        expect(c.opacity).toBe(0.5);
        expect(c.blurPx).toBe(160);
      }
    });

    it("uses gray-50 fallback when color is null", () => {
      const plan = shadeToGradient(null, "bold");
      expect(plan.circles[0].backgroundImage).toContain("#F8FAFC");
    });
  });
});
