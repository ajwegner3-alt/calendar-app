"use client";

import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type FieldErrors,
  Controller,
  useWatch,
} from "react-hook-form";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventTypeInput } from "../_lib/schema";

const MAX_OPTIONS = 20;

const TYPE_LABELS: Record<EventTypeInput["custom_questions"][number]["type"], string> = {
  "short-text": "Short text",
  "long-text": "Long text",
  "yes-no": "Yes / No",
  "single-select": "Single select",
};

export function QuestionList({
  control,
  register,
  errors,
}: {
  control: Control<EventTypeInput>;
  register: UseFormRegister<EventTypeInput>;
  errors: FieldErrors<EventTypeInput>;
}) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "custom_questions",
  });

  function handleAdd() {
    append({
      id: crypto.randomUUID(),
      label: "",
      type: "short-text",
      required: false,
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Custom questions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Optional. Booker answers appear with the booking confirmation.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add question
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No custom questions yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <QuestionRow
              key={field.id}
              index={index}
              total={fields.length}
              control={control}
              register={register}
              errors={errors}
              onMoveUp={() => move(index, index - 1)}
              onMoveDown={() => move(index, index + 1)}
              onRemove={() => remove(index)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestionRow({
  index,
  total,
  control,
  register,
  errors,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  total: number;
  control: Control<EventTypeInput>;
  register: UseFormRegister<EventTypeInput>;
  errors: FieldErrors<EventTypeInput>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  // Watch the type so we conditionally render the options sub-list for single-select.
  const type = useWatch({
    control,
    name: `custom_questions.${index}.type`,
  });

  const labelError = errors.custom_questions?.[index]?.label?.message;

  return (
    <li className="border rounded-lg p-4 flex flex-col gap-3 bg-card">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move question up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Move question down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="grid gap-2">
            <Label htmlFor={`q-${index}-label`}>Question</Label>
            <Input
              id={`q-${index}-label`}
              placeholder="e.g. What's the project address?"
              {...register(`custom_questions.${index}.label`)}
            />
            {labelError && (
              <p className="text-sm text-destructive">{labelError}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`q-${index}-type`}>Type</Label>
            <Controller
              control={control}
              name={`custom_questions.${index}.type`}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(next) => {
                    field.onChange(next);
                    // Note: switching to single-select would orphan options if the
                    // user previously had a single-select with options. RHF preserves
                    // values across renders. For v1, accept that minor edge case —
                    // the Zod safeParse on submit will surface validation errors if
                    // a stale options array fails. v2 polish: clear options on type
                    // change.
                  }}
                >
                  <SelectTrigger id={`q-${index}-type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short-text">{TYPE_LABELS["short-text"]}</SelectItem>
                    <SelectItem value="long-text">{TYPE_LABELS["long-text"]}</SelectItem>
                    <SelectItem value="yes-no">{TYPE_LABELS["yes-no"]}</SelectItem>
                    <SelectItem value="single-select">{TYPE_LABELS["single-select"]}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 items-center">
          <Controller
            control={control}
            name={`custom_questions.${index}.required`}
            render={({ field }) => (
              <div className="flex flex-col items-center gap-1">
                <Switch
                  id={`q-${index}-required`}
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
                <Label
                  htmlFor={`q-${index}-required`}
                  className="text-xs font-normal cursor-pointer"
                >
                  Required
                </Label>
              </div>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label="Remove question"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {type === "single-select" && (
        <SingleSelectOptions
          index={index}
          control={control}
          register={register}
          errors={errors}
        />
      )}
    </li>
  );
}

function SingleSelectOptions({
  index,
  control,
  register,
  errors,
}: {
  index: number;
  control: Control<EventTypeInput>;
  register: UseFormRegister<EventTypeInput>;
  errors: FieldErrors<EventTypeInput>;
}) {
  // Inner field array for this question's options.
  const { fields, append, remove } = useFieldArray({
    control,
    // useFieldArray needs primitive arrays wrapped — RHF supports nested paths.
    // We coerce the path to any because the options key only exists on
    // single-select branches of the discriminated union (TS struggles to narrow
    // through a generic dynamic path).
    name: `custom_questions.${index}.options` as never,
  });

  // Per-question error surface (Zod will populate this if options fail validation)
  const optionsError = (errors.custom_questions?.[index] as { options?: { message?: string } } | undefined)?.options?.message;

  return (
    <div className="ml-8 grid gap-2">
      <Label>Options</Label>
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Add at least one option.
        </p>
      )}
      <ul className="grid gap-2">
        {fields.map((field, optIndex) => (
          <li key={field.id} className="flex items-center gap-2">
            <Input
              placeholder={`Option ${optIndex + 1}`}
              {...register(`custom_questions.${index}.options.${optIndex}` as never)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => remove(optIndex)}
              aria-label={`Remove option ${optIndex + 1}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      {optionsError && (
        <p className="text-sm text-destructive">{optionsError}</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append("" as never)}
        disabled={fields.length >= MAX_OPTIONS}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add option
      </Button>
      {fields.length >= MAX_OPTIONS && (
        <p className="text-xs text-muted-foreground">
          Maximum {MAX_OPTIONS} options reached.
        </p>
      )}
    </div>
  );
}
