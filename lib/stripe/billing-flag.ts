/**
 * Billing kill-switch — v1.9 "free offering" scope change (2026-05-15).
 *
 * When `false`, the entire Stripe paywall is bypassed: no subscription
 * lockout, no widget-tier gating, no trial / past-due banners, no pricing
 * page. The app is fully usable for free by every account regardless of
 * `subscription_status` or `plan_tier`.
 *
 * ALL Stripe payment code is intentionally preserved in place — nothing was
 * deleted. To re-enable paid billing later, flip this constant to `true`,
 * restore the live-mode Stripe stack, and redeploy.
 *
 * WHERE THE STRIPE CODE LIVES (parked, not removed):
 *   - lib/stripe/                  Stripe SDK client, price map, webhook
 *                                  helpers, widget-tier gate
 *   - app/api/stripe/checkout/     Hosted Checkout session route
 *   - app/api/stripe/portal/       Customer Portal session route
 *   - app/api/stripe/webhook/      Stripe webhook handler
 *   - app/(shell)/app/billing/     Billing page + tier grid + status card
 *   - lib/email/send-trial-ending-email.ts
 *   - lib/email/send-payment-failed-email.ts
 *   - lib/supabase/proxy.ts        Paywall middleware gate (flag-guarded)
 *
 * Consumers of this flag (the surfaces that change behavior when it is off):
 *   - lib/supabase/proxy.ts                         — paywall lockout
 *   - app/embed/[account]/[event-slug]/page.tsx     — widget gate
 *   - app/(shell)/app/event-types/page.tsx          — embed-code dialog gate
 *   - app/(shell)/app/_components/subscription-banner.tsx — trial banners
 *   - app/(shell)/app/billing/page.tsx              — pricing grid
 *   - components/app-sidebar.tsx                    — Billing nav entry
 *
 * Re-enable checklist: see .planning/BILLING_PARKED.md and
 * .planning/memory/v1.8-live-mode-uat-handoff.md.
 */
export const BILLING_ENABLED = false;
