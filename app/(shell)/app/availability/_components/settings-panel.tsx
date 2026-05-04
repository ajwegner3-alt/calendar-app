"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveAccountSettingsAction } from "../_lib/actions";

export interface SettingsPanelProps {
  initial: {
    min_notice_hours: number;
    max_advance_days: number;
    daily_cap: number | null;
  };
}

export function SettingsPanel({ initial }: SettingsPanelProps) {
  const router = useRouter();
  const [minNoticeHours, setMinNoticeHours] = useState(
    String(initial.min_notice_hours),
  );
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(
    String(initial.max_advance_days),
  );
  // daily_cap is nullable — empty string represents "no cap" in the form.
  const [dailyCap, setDailyCap] = useState(
    initial.daily_cap === null ? "" : String(initial.daily_cap),
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await saveAccountSettingsAction({
        min_notice_hours: Number(minNoticeHours),
        max_advance_days: Number(maxAdvanceDays),
        // Empty string → null (no cap).
        daily_cap: dailyCap.trim() === "" ? null : Number(dailyCap),
      });

      if (result.formError) {
        toast.error(result.formError);
        setFormError(result.formError);
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        toast.error("Please fix the highlighted fields.");
        return;
      }

      toast.success("Settings saved.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="min_notice_hours"
          label="Min notice (hours)"
          help="Earliest a slot becomes bookable, before now."
          value={minNoticeHours}
          onChange={setMinNoticeHours}
          min={0}
          max={8760}
          step={1}
          disabled={isPending}
          errors={fieldErrors.min_notice_hours}
        />
        <Field
          id="max_advance_days"
          label="Max advance (days)"
          help="How far into the future slots are shown."
          value={maxAdvanceDays}
          onChange={setMaxAdvanceDays}
          min={1}
          max={365}
          step={1}
          disabled={isPending}
          errors={fieldErrors.max_advance_days}
        />
        <Field
          id="daily_cap"
          label="Daily cap (bookings/day)"
          help="Leave empty for no cap."
          value={dailyCap}
          onChange={setDailyCap}
          min={1}
          max={1000}
          step={1}
          disabled={isPending}
          errors={fieldErrors.daily_cap}
          placeholder="No cap"
        />
      </div>

      {formError && <p className="text-destructive text-sm">{formError}</p>}

      <div>
        <Button type="button" onClick={save} disabled={isPending}>
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  errors?: string[];
  placeholder?: string;
}

function Field({
  id,
  label,
  help,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  errors,
  placeholder,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={errors && errors.length > 0 ? true : undefined}
      />
      <p className="text-muted-foreground text-xs">{help}</p>
      {errors?.map((err, i) => (
        <p key={i} className="text-destructive text-xs">
          {err}
        </p>
      ))}
    </div>
  );
}
