// @vitest-environment node
import { describe, it, expect } from "vitest";
import { requireWidgetTier } from "@/lib/stripe/widget-gate";

/**
 * Branch-coverage suite for requireWidgetTier (Plan 42.6-01).
 *
 * Covers all four branches of the gate:
 *   1. Trialing-first short-circuit (regardless of plan_tier — LD-15)
 *   2. Paid widget tier on active/past_due (LD-04 + LD-08)
 *   3. Paid basic tier on active/past_due → reason: 'basic_tier'
 *   4. Fallthrough → reason: 'no_subscription' (canceled / unpaid / null / etc.)
 *
 * Pure function = no mocks needed. Each `it()` constructs the input literal inline.
 */
describe("requireWidgetTier", () => {
  // ---------------------------------------------------------------------------
  // ALLOWED branches
  // ---------------------------------------------------------------------------

  it("trialing + plan_tier null → allowed (new account edge case, LD-15)", () => {
    const result = requireWidgetTier({
      plan_tier: null,
      subscription_status: "trialing",
    });
    expect(result).toEqual({ allowed: true });
  });

  it("trialing + plan_tier 'basic' → allowed (trialing wins over basic)", () => {
    const result = requireWidgetTier({
      plan_tier: "basic",
      subscription_status: "trialing",
    });
    expect(result).toEqual({ allowed: true });
  });

  it("trialing + plan_tier 'widget' → allowed", () => {
    const result = requireWidgetTier({
      plan_tier: "widget",
      subscription_status: "trialing",
    });
    expect(result).toEqual({ allowed: true });
  });

  it("active + plan_tier 'widget' → allowed (canonical paid widget)", () => {
    const result = requireWidgetTier({
      plan_tier: "widget",
      subscription_status: "active",
    });
    expect(result).toEqual({ allowed: true });
  });

  it("past_due + plan_tier 'widget' → allowed (LD-08 mirror — past_due is not lockout)", () => {
    const result = requireWidgetTier({
      plan_tier: "widget",
      subscription_status: "past_due",
    });
    expect(result).toEqual({ allowed: true });
  });

  // ---------------------------------------------------------------------------
  // GATED — basic_tier reason
  // ---------------------------------------------------------------------------

  it("active + plan_tier 'basic' → denied with reason 'basic_tier'", () => {
    const result = requireWidgetTier({
      plan_tier: "basic",
      subscription_status: "active",
    });
    expect(result).toEqual({ allowed: false, reason: "basic_tier" });
  });

  it("past_due + plan_tier 'basic' → denied with reason 'basic_tier'", () => {
    const result = requireWidgetTier({
      plan_tier: "basic",
      subscription_status: "past_due",
    });
    expect(result).toEqual({ allowed: false, reason: "basic_tier" });
  });

  // ---------------------------------------------------------------------------
  // GATED — no_subscription reason
  // ---------------------------------------------------------------------------

  it("canceled + plan_tier 'widget' → denied with reason 'no_subscription' (downgraded post-cancel)", () => {
    const result = requireWidgetTier({
      plan_tier: "widget",
      subscription_status: "canceled",
    });
    expect(result).toEqual({ allowed: false, reason: "no_subscription" });
  });

  it("canceled + plan_tier 'basic' → denied with reason 'no_subscription'", () => {
    const result = requireWidgetTier({
      plan_tier: "basic",
      subscription_status: "canceled",
    });
    expect(result).toEqual({ allowed: false, reason: "no_subscription" });
  });

  it("unpaid + plan_tier 'widget' → denied with reason 'no_subscription'", () => {
    const result = requireWidgetTier({
      plan_tier: "widget",
      subscription_status: "unpaid",
    });
    expect(result).toEqual({ allowed: false, reason: "no_subscription" });
  });

  it("null subscription_status + null plan_tier → denied with reason 'no_subscription' (defensive)", () => {
    const result = requireWidgetTier({
      plan_tier: null,
      subscription_status: null,
    });
    expect(result).toEqual({ allowed: false, reason: "no_subscription" });
  });

  it("incomplete + plan_tier null → denied with reason 'no_subscription'", () => {
    const result = requireWidgetTier({
      plan_tier: null,
      subscription_status: "incomplete",
    });
    expect(result).toEqual({ allowed: false, reason: "no_subscription" });
  });
});
