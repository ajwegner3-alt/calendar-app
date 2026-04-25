/**
 * Shared types for the event-types feature.
 *
 * - CustomQuestion: discriminated union, mirrors the customQuestionSchema in schema.ts
 * - EventTypeRow: full DB row shape (all columns) — for the form (edit) page
 * - EventTypeListItem: projected shape for the list page (subset of columns we SELECT)
 */

export type CustomQuestion =
  | {
      id: string;
      label: string;
      required: boolean;
      type: "short-text";
    }
  | {
      id: string;
      label: string;
      required: boolean;
      type: "long-text";
    }
  | {
      id: string;
      label: string;
      required: boolean;
      type: "yes-no";
    }
  | {
      id: string;
      label: string;
      required: boolean;
      type: "single-select";
      options: string[];
    };

export type EventTypeRow = {
  id: string;
  account_id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_advance_days: number;
  custom_questions: CustomQuestion[];
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type EventTypeListItem = Pick<
  EventTypeRow,
  "id" | "name" | "slug" | "duration_minutes" | "is_active" | "deleted_at" | "created_at"
>;
