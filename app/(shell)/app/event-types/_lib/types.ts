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
  // Phase 8 Plan 08-05: per-event-type location/address. Surfaced in the
  // reminder email body when accounts.reminder_include_location is true.
  location: string | null;
  // Phase 11 Plan 11-07: CAP-03 + CAP-08 capacity columns.
  max_bookings_per_slot: number;
  show_remaining_capacity: boolean;
};

export type EventTypeListItem = Pick<
  EventTypeRow,
  | "id"
  | "name"
  | "slug"
  | "duration_minutes"
  // Phase 28 LD-01: surface per-event-type buffer in the list table.
  | "buffer_after_minutes"
  | "is_active"
  | "deleted_at"
  | "created_at"
>;
