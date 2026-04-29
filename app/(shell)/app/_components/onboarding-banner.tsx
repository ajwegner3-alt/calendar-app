import { OnboardingChecklist } from "@/components/onboarding-checklist";

/**
 * OnboardingBanner
 *
 * Thin wrapper around OnboardingChecklist that positions it above the calendar
 * in the /app Home tab. The underlying OnboardingChecklist already handles its
 * own visibility gate (onboarding_complete + within 7 days + not dismissed).
 *
 * This wrapper adds the `mb-6` spacing so the banner has breathing room above
 * the calendar header. It passes all props through to OnboardingChecklist
 * unchanged — no new logic lives here.
 */
export function OnboardingBanner(
  props: React.ComponentProps<typeof OnboardingChecklist>,
) {
  return (
    <div className="mb-6">
      <OnboardingChecklist {...props} />
    </div>
  );
}
