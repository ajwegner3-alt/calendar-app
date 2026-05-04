import { redirect } from "next/navigation";

import { Separator } from "@/components/ui/separator";

import { loadAvailabilityState } from "./_lib/queries";
import { AvailabilityEmptyBanner } from "./_components/availability-empty-banner";
import { WeeklyRulesEditor } from "./_components/weekly-rules-editor";
import { SettingsPanel } from "./_components/settings-panel";
import { DateOverridesSection } from "./_components/date-overrides-section";

export default async function AvailabilityPage() {
  const state = await loadAvailabilityState();
  if (!state) {
    // Unlinked user — redirect to dashboard root which handles the unlinked
    // banner (existing Phase 2 pattern in app/(shell)/app/page.tsx).
    redirect("/app");
  }

  const isEmpty = state.rules.length === 0 && state.overrides.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Define when people can book and customize notice and caps.
        </p>
      </header>

      {isEmpty && <AvailabilityEmptyBanner />}

      <section aria-label="Weekly availability">
        <h2 className="mb-4 text-lg font-medium">Weekly hours</h2>
        <WeeklyRulesEditor rules={state.rules} />
      </section>

      <Separator />

      <section aria-label="Date overrides">
        <h2 className="mb-4 text-lg font-medium">Date overrides</h2>
        <DateOverridesSection overrides={state.overrides} />
      </section>

      <Separator />

      <section aria-label="Booking settings">
        <h2 className="mb-4 text-lg font-medium">Booking settings</h2>
        <SettingsPanel
          initial={{
            min_notice_hours: state.account.min_notice_hours,
            max_advance_days: state.account.max_advance_days,
            daily_cap: state.account.daily_cap,
          }}
        />
      </section>
    </div>
  );
}
