import { redirect } from "next/navigation";

import { Separator } from "@/components/ui/separator";

import { loadAvailabilityState } from "./_lib/queries";
import { AvailabilityEmptyBanner } from "./_components/availability-empty-banner";
import { WeeklyRulesEditor } from "./_components/weekly-rules-editor";
import { SettingsPanel } from "./_components/settings-panel";
// Plan 04-05 ships this component (DateOverridesSection). Until 04-05 lands,
// we fall back to a comment-only placeholder section. The import below is
// intentional and stable — 04-05 only needs to add the file.
// import { DateOverridesSection } from "./_components/date-overrides-section";

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
          Define when people can book and customize buffers, notice, and caps.
        </p>
      </header>

      {isEmpty && <AvailabilityEmptyBanner />}

      <section aria-label="Weekly availability">
        <h2 className="mb-4 text-lg font-medium">Weekly hours</h2>
        <WeeklyRulesEditor rules={state.rules} />
      </section>

      <Separator />

      {/* DATE OVERRIDES SECTION — Plan 04-05 placeholder
          Plan 04-05 will:
          1. Create _components/date-overrides-section.tsx
          2. Uncomment the import above (DateOverridesSection)
          3. Replace the paragraph below with: <DateOverridesSection overrides={state.overrides} />
      */}
      <section aria-label="Date overrides">
        <h2 className="mb-4 text-lg font-medium">Date overrides</h2>
        {/* PLAN-04-05-REPLACE-START */}
        <p className="text-muted-foreground text-sm">
          Date-specific overrides will appear here.
        </p>
        {/* PLAN-04-05-REPLACE-END */}
      </section>

      <Separator />

      <section aria-label="Booking settings">
        <h2 className="mb-4 text-lg font-medium">Booking settings</h2>
        <SettingsPanel
          initial={{
            buffer_minutes: state.account.buffer_minutes,
            min_notice_hours: state.account.min_notice_hours,
            max_advance_days: state.account.max_advance_days,
            daily_cap: state.account.daily_cap,
          }}
        />
      </section>
    </div>
  );
}
