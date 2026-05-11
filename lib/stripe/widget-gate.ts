import type { PriceTier } from "./prices";

/**
 * Pure widget-tier gate.
 *
 * Single source of truth for "is this account allowed to use the booking widget?"
 * Consumed by both the public embed route (Plan 42.6-02) and the owner-side embed
 * dialog (Plan 42.6-03). Both surfaces MUST call this helper so behavior cannot
 * drift between them.
 *
 * Pure function: no DB calls, no network, no I/O, no async. Just typed input
 * → typed output. Callers are responsible for fetching the account row and for
 * any logging/UX they want around the result.
 */

/**
 * Account fields required to compute gate access. Callers pass only the two
 * relevant columns — full account rows are not required.
 */
export interface AccountGateInput {
  plan_tier: PriceTier | null;
  subscription_status: string | null;
}

/**
 * Discriminated union return shape.
 *
 *   - { allowed: true }                            → render the widget / embed code
 *   - { allowed: false, reason: 'basic_tier' }     → show "upgrade to Widget tier" UX
 *   - { allowed: false, reason: 'no_subscription' } → show "subscription required" UX
 *
 * Callers branch on `result.allowed` first, then on `result.reason`.
 */
export type WidgetGateResult =
  | { allowed: true }
  | { allowed: false; reason: "basic_tier" | "no_subscription" };

/**
 * Decide whether an account is allowed to use the widget surface.
 *
 * Branch order matters — trialing is checked FIRST because new accounts have
 * `plan_tier = NULL` while trialing (webhook only writes plan_tier on the first
 * paid checkout). Per LD-15 the trial defaults to full app capability, so a
 * trialing account with NULL plan_tier MUST be allowed.
 *
 * Branches (evaluated in order):
 *   1. subscription_status === 'trialing' → ALLOWED, regardless of plan_tier.
 *      (LD-15: trial = full capability; plan_tier remains NULL until first
 *      paid checkout, and a NULL plan_tier during trial must not gate.)
 *   2. plan_tier === 'widget' AND status ∈ {active, past_due} → ALLOWED.
 *      (LD-04: active is the canonical paid state. LD-08: past_due is banner
 *      only, NOT lockout — preserve widget access while dunning resolves.)
 *   3. plan_tier === 'basic' AND status ∈ {active, past_due} → DENIED:'basic_tier'.
 *      (Caller renders "upgrade to Widget tier" CTA.)
 *   4. Fallthrough (canceled / unpaid / incomplete / NULL-without-trialing /
 *      any other state) → DENIED:'no_subscription'.
 *      (Caller renders "subscription required" CTA. No throw on unknown
 *      statuses — gate is defensive: when in doubt, deny.)
 */
export function requireWidgetTier(account: AccountGateInput): WidgetGateResult {
  const { plan_tier, subscription_status } = account;

  // 1. Trialing always wins — full capability during the 14-day trial window
  //    even when plan_tier is still NULL (pre-first-checkout).
  if (subscription_status === "trialing") {
    return { allowed: true };
  }

  // 2. Paid widget tier — active OR past_due (LD-08 mirror).
  if (
    plan_tier === "widget" &&
    (subscription_status === "active" || subscription_status === "past_due")
  ) {
    return { allowed: true };
  }

  // 3. Paid basic tier — explicitly denied with actionable reason so caller
  //    can render an upgrade CTA instead of a generic subscription wall.
  if (
    plan_tier === "basic" &&
    (subscription_status === "active" || subscription_status === "past_due")
  ) {
    return { allowed: false, reason: "basic_tier" };
  }

  // 4. Catch-all: canceled, unpaid, incomplete, NULL-status, NULL-tier without
  //    trialing, or any unknown status. Deny with no_subscription so callers
  //    render the generic "you need a subscription" path.
  return { allowed: false, reason: "no_subscription" };
}
