import { GradientBackdrop } from "@/app/_components/gradient-backdrop";

/**
 * Auth-page gradient backdrop. Uses fixed NSI tokens (CONTEXT.md lock):
 * pre-signup users have no account context, so auth pages always render NSI brand.
 *
 * Fixed tokens: color=#0A2540 (NSI navy), shade='subtle'
 */
export function NSIGradientBackdrop() {
  return <GradientBackdrop color="#0A2540" shade="subtle" />;
}
